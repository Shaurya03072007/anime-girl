import {
  ActionRiskLevel,
  DeviceCapabilityName,
  ProactivePolicyConfig,
  ProactiveSuggestion,
} from '../types/aether';
import { MemoryStateStore, retrieveHybridMemories } from './memoryEngine';

export interface IncomingDeviceEvent {
  eventId: string;
  eventType: 'notification_posted' | 'app_foreground_changed' | 'battery_low' | 'recurring_pattern' | 'unfinished_task_check';
  packageName: string;
  title: string;
  content: string;
  timestamp: string;
}

export interface ProactiveEvaluationOutcome {
  decision: 'suppress_privacy' | 'suppress_policy' | 'silent_memory_update' | 'proactive_suggestion';
  reason: string;
  relevanceScore: number;
  riskLevel: ActionRiskLevel;
  suggestion?: ProactiveSuggestion;
  shouldStoreEpisode: boolean;
}

export function isWithinQuietHours(nowDate: Date, startHm: string, endHm: string): boolean {
  const [startH, startM] = startHm.split(':').map(Number);
  const [endH, endM] = endHm.split(':').map(Number);
  if (Number.isNaN(startH) || Number.isNaN(endH)) return false;

  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Crosses midnight (e.g., 23:00 to 07:30)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * Evaluates an incoming Android event through the 7-stage Proactive Companion Pipeline:
 * 1. Event normalization
 * 2. Privacy filtering (excluded packages & sensitive content)
 * 3. Context retrieval from Memory Engine
 * 4. Relevance scoring
 * 5. Initiative policy checks (DND, quiet hours, daily quota, cooldown)
 * 6. Action selection & risk classification
 * 7. Output decision
 */
export function evaluateProactiveEvent(
  event: IncomingDeviceEvent,
  policy: ProactivePolicyConfig,
  memoryStore: MemoryStateStore,
  recentSuggestions: ProactiveSuggestion[],
  evaluationTime: Date = new Date(event.timestamp || Date.now())
): ProactiveEvaluationOutcome {
  // Stage 1 & 2: Normalization & Privacy Filtering
  const normalizedPkg = event.packageName.trim().toLowerCase();
  if (policy.excludedPackages.some((pkg) => pkg.toLowerCase() === normalizedPkg)) {
    return {
      decision: 'suppress_privacy',
      reason: `Package '${event.packageName}' is in the user's excluded privacy list.`,
      relevanceScore: 0,
      riskLevel: 'low',
      shouldStoreEpisode: false,
    };
  }

  const combinedText = `${event.title} ${event.content}`.trim();
  const lowerText = combinedText.toLowerCase();
  if (lowerText.includes('otp') || lowerText.includes('verification code') || lowerText.includes('password')) {
    return {
      decision: 'suppress_privacy',
      reason: 'Filtered sensitive authentication/OTP payload before memory or agent ingestion.',
      relevanceScore: 0,
      riskLevel: 'low',
      shouldStoreEpisode: false,
    };
  }

  // Stage 3: Context retrieval from hybrid memory
  const relatedMemories = retrieveHybridMemories(memoryStore, {
    query: combinedText,
    limit: 3,
  });
  const topMemoryScore = relatedMemories[0]?.scoreBreakdown.totalScore ?? 0;

  // Stage 4: Relevance Scoring
  let relevanceScore = Math.min(100, Math.round(topMemoryScore * 75 + 20));
  if (event.eventType === 'battery_low') relevanceScore = Math.max(relevanceScore, 78);
  if (event.eventType === 'unfinished_task_check') relevanceScore = Math.max(relevanceScore, 84);
  if (lowerText.includes('aether') || lowerText.includes('kotlin') || lowerText.includes('adk') || lowerText.includes('deadline')) {
    relevanceScore = Math.min(98, relevanceScore + 22);
  }

  // Stage 5: Policy & Cooldown Evaluation
  if (policy.respectDoNotDisturb && policy.doNotDisturbActive) {
    return {
      decision: 'silent_memory_update',
      reason: 'Do Not Disturb is active; recorded context silently without interrupting user.',
      relevanceScore,
      riskLevel: 'low',
      shouldStoreEpisode: relevanceScore >= 55,
    };
  }

  if (isWithinQuietHours(evaluationTime, policy.quietHoursStart, policy.quietHoursEnd)) {
    return {
      decision: 'silent_memory_update',
      reason: `Within configured Quiet Hours (${policy.quietHoursStart}–${policy.quietHoursEnd}); suppressed notification and logged memory silently.`,
      relevanceScore,
      riskLevel: 'low',
      shouldStoreEpisode: relevanceScore >= 55,
    };
  }

  const todayPrefix = evaluationTime.toISOString().slice(0, 10);
  const sentTodayCount = recentSuggestions.filter((s) => s.timestamp.startsWith(todayPrefix)).length;
  if (sentTodayCount >= policy.maxProactiveMessagesPerDay) {
    return {
      decision: 'suppress_policy',
      reason: `Daily proactive message cap (${policy.maxProactiveMessagesPerDay}) reached.`,
      relevanceScore,
      riskLevel: 'low',
      shouldStoreEpisode: relevanceScore >= 60,
    };
  }

  const latestSuggestion = recentSuggestions[0];
  if (latestSuggestion) {
    const elapsedMinutes =
      (evaluationTime.getTime() - new Date(latestSuggestion.timestamp).getTime()) / 60000;
    if (
      elapsedMinutes >= 0 &&
      elapsedMinutes < policy.cooldownMinutes &&
      latestSuggestion.triggerEvent.toLowerCase() === event.title.toLowerCase()
    ) {
      return {
        decision: 'suppress_policy',
        reason: `Cooldown active (${policy.cooldownMinutes}m between similar proactive alerts).`,
        relevanceScore,
        riskLevel: 'low',
        shouldStoreEpisode: false,
      };
    }
  }

  if (relevanceScore < policy.initiativeThreshold) {
    return {
      decision: 'silent_memory_update',
      reason: `Relevance score (${relevanceScore}) is below initiative threshold (${policy.initiativeThreshold}); updated episodic context silently.`,
      relevanceScore,
      riskLevel: 'low',
      shouldStoreEpisode: relevanceScore >= 50,
    };
  }

  // Stage 6 & 7: Action Selection & Risk Classification
  let proposedCapability: DeviceCapabilityName = 'create_reminder';
  let proposedParams: Record<string, unknown> = {
    title: `Follow up: ${event.title}`,
  };
  let riskLevel: ActionRiskLevel = 'medium';

  if (event.eventType === 'battery_low') {
    proposedCapability = 'open_settings';
    proposedParams = { section: 'BATTERY_SAVER_SETTINGS' };
    riskLevel = 'medium';
  } else if (lowerText.includes('call') || lowerText.includes('email') || lowerText.includes('send')) {
    proposedCapability = 'initiate_supported_phone_intent';
    proposedParams = {
      intentAction: 'android.intent.action.SENDTO',
      dataUri: 'mailto:team@aether.dev',
    };
    riskLevel = 'high';
  } else if (lowerText.includes('github') || lowerText.includes('pr') || lowerText.includes('commit')) {
    proposedCapability = 'launch_application';
    proposedParams = { packageName: 'com.github.android' };
    riskLevel = 'medium';
  }

  const matchedMemoryNote = relatedMemories[0]
    ? `Connected to existing memory: "${relatedMemories[0].memory.content}"`
    : 'Evaluated via proactive context rules.';

  const suggestion: ProactiveSuggestion = {
    id: `pro_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: evaluationTime.toISOString(),
    triggerEvent: `${event.packageName}: ${event.title}`,
    title: `Proactive Insight: ${event.title}`,
    message: `I noticed "${event.content}". Would you like me to run ${proposedCapability.replace(/_/g, ' ')}?`,
    reasoning: `${matchedMemoryNote} (Relevance ${relevanceScore}/100, Risk: ${riskLevel.toUpperCase()})`,
    relevanceScore,
    riskLevel,
    status: 'pending',
    proposedAction: {
      capability: proposedCapability,
      parameters: proposedParams,
    },
  };

  return {
    decision: 'proactive_suggestion',
    reason: suggestion.reasoning,
    relevanceScore,
    riskLevel,
    suggestion,
    shouldStoreEpisode: true,
  };
}
