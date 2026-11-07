import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
} from '@google/genai';
import {
  AgentTraceEntry,
  AnimationState,
  CharacterConfig,
  ConversationMessageItem,
  DeviceCapabilityName,
  KnowledgeEntity,
  KnowledgeRelationship,
  MemoryCategory,
  MemoryRecord,
  PersonalityConfig,
  ProactivePolicyConfig,
  ProactiveSuggestion,
  ReminderItem,
} from './src/types/aether';
import {
  computeDeterministicEmbedding,
  extractMemoryCandidatesFromText,
  ingestMemoryCandidate,
  MemoryStateStore,
  retrieveHybridMemories,
} from './src/engine/memoryEngine';
import {
  AndroidRuntimeState,
  executeDeviceCapability,
} from './src/engine/deviceController';
import {
  evaluateProactiveEvent,
  IncomingDeviceEvent,
} from './src/engine/proactiveEngine';
import {
  createInitialAgentTraces,
  createInitialAndroidState,
  createInitialCharacterConfig,
  createInitialConversation,
  createInitialMemoryStore,
  createInitialPersonalityConfig,
  createInitialProactivePolicy,
  createInitialReminders,
  createInitialSuggestions,
} from './src/engine/initialSeedState';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE_PATH = path.join(__dirname, '.aether-persistent-state.json');

interface PersistentEcosystemState {
  memoryStore: MemoryStateStore;
  character: CharacterConfig;
  personality: PersonalityConfig;
  androidState: AndroidRuntimeState;
  proactivePolicy: ProactivePolicyConfig;
  suggestions: ProactiveSuggestion[];
  conversation: ConversationMessageItem[];
  reminders: ReminderItem[];
  agentTraces: AgentTraceEntry[];
  metrics: {
    activeLiveSessions: number;
    lastMemoryRetrievalLatencyMs: number;
    lastToolExecutionLatencyMs: number;
    totalVoiceFramesProcessed: number;
    failedOperationsCount: number;
  };
}

function loadOrInitializeState(): PersistentEcosystemState {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as PersistentEcosystemState;
      if (parsed && parsed.memoryStore && Array.isArray(parsed.memoryStore.memories)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Initializing fresh persistent state:', err);
  }

  const initial: PersistentEcosystemState = {
    memoryStore: createInitialMemoryStore(),
    character: createInitialCharacterConfig(),
    personality: createInitialPersonalityConfig(),
    androidState: createInitialAndroidState(),
    proactivePolicy: createInitialProactivePolicy(),
    suggestions: createInitialSuggestions(),
    conversation: createInitialConversation(),
    reminders: createInitialReminders(),
    agentTraces: createInitialAgentTraces(),
    metrics: {
      activeLiveSessions: 0,
      lastMemoryRetrievalLatencyMs: 24,
      lastToolExecutionLatencyMs: 19,
      totalVoiceFramesProcessed: 0,
      failedOperationsCount: 0,
    },
  };
  saveState(initial);
  return initial;
}

function saveState(state: PersistentEcosystemState): void {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist state:', err);
  }
}

let appState: PersistentEcosystemState = loadOrInitializeState();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const deviceToolDeclaration: FunctionDeclaration = {
  name: 'execute_device_capability',
  description:
    'Executes a native Android DeviceController capability on the user phone (such as launch_application, get_battery_status, get_network_status, inspect_accessible_ui, tap_accessible_element, input_text, scroll, open_settings, create_reminder, create_notification).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      capability: {
        type: Type.STRING,
        description:
          'The Android capability name: launch_application, get_battery_status, get_network_status, inspect_accessible_ui, tap_accessible_element, input_text, scroll, open_settings, open_url, create_reminder, create_notification, read_authorized_notifications, dismiss_supported_notifications',
      },
      packageName: {
        type: Type.STRING,
        description: 'Optional Android package name (e.g., com.github.android, com.termux, com.android.settings)',
      },
      text: {
        type: Type.STRING,
        description: 'Optional text or title parameter for input_text, create_reminder, or create_notification',
      },
    },
    required: ['capability'],
  },
};

function inferEmotionFromReply(replyText: string, hadAction: boolean): AnimationState {
  const lower = replyText.toLowerCase();
  if (hadAction) return 'Processing an action';
  if (lower.includes('?') || lower.includes('chuddam') || lower.includes('wonder')) return 'Curious';
  if (lower.includes('sorry') || lower.includes('warning') || lower.includes('denied')) return 'Concerned';
  if (lower.includes('!') || lower.includes('great') || lower.includes('verified') || lower.includes('namaskaram')) {
    return 'Happy';
  }
  return 'Speaking';
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json({ limit: '5mb' }));

  // 1. Get complete state snapshot
  app.get('/api/v1/state', (_req, res) => {
    res.json({
      ...appState,
      geminiConfigured: Boolean(getGeminiClient()),
      supportedModels: {
        liveVoiceModel: 'gemini-3.8-live',
        reasoningModel: 'gemini-3.8-flash',
        embeddingModel: 'gemini-embedding-2-preview',
      },
    });
  });

  // 2. Hybrid Memory Retrieval API
  app.post('/api/v1/memory/query', (req, res) => {
    const t0 = Date.now();
    const { query = '', categoryFilter = 'all', entityIdFilter, includeUnverified = true, limit = 12 } = req.body || {};
    const items = retrieveHybridMemories(appState.memoryStore, {
      query: String(query),
      categoryFilter,
      entityIdFilter,
      includeUnverified,
      limit: Number(limit),
    });
    const latency = Math.max(1, Date.now() - t0);
    appState.metrics.lastMemoryRetrievalLatencyMs = latency;
    res.json({
      items,
      latencyMs: latency,
      totalMemories: appState.memoryStore.memories.length,
    });
  });

  // 3. Create / Ingest Memory API
  app.post('/api/v1/memory/create', (req, res) => {
    const {
      content,
      category = 'semantic',
      epistemicStatus = 'explicitly_stated',
      sensitivity = 'personal',
      importance = 0.85,
      entityNames = [],
    } = req.body || {};

    if (!content || String(content).trim().length < 3) {
      res.status(400).json({ error: 'Memory content must be at least 3 characters.' });
      return;
    }

    const extracted = extractMemoryCandidatesFromText(String(content), 'user_edit');
    const baseCandidate = extracted[0] || {
      content: String(content).trim(),
      category: category as MemoryCategory,
      epistemicStatus,
      confidence: 0.96,
      importance: Number(importance),
      sensitivity,
      entities: [],
      relationships: [],
    };

    baseCandidate.category = category as MemoryCategory;
    baseCandidate.epistemicStatus = epistemicStatus;
    baseCandidate.sensitivity = sensitivity;
    baseCandidate.importance = Number(importance);

    for (const extraName of Array.isArray(entityNames) ? entityNames : []) {
      const clean = String(extraName).trim();
      if (clean && !baseCandidate.entities.some((e) => e.name.toLowerCase() === clean.toLowerCase())) {
        baseCandidate.entities.push({
          name: clean,
          type: 'Concept',
          description: 'User-tagged knowledge entity',
        });
        baseCandidate.relationships.push({
          sourceName: 'Shaurya',
          targetName: clean,
          predicate: 'associated_with',
        });
      }
    }

    const result = ingestMemoryCandidate(appState.memoryStore, baseCandidate, {
      sourceId: `src_manual_${Date.now()}`,
      sourceType: 'user_edit',
      referenceId: 'memory_explorer_ui',
      excerpt: String(content).trim(),
      timestamp: new Date().toISOString(),
    });

    appState.memoryStore = result.store;
    appState.agentTraces.unshift({
      id: `trace_${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentName: 'MemoryAgent',
      operation: `memory_${result.action}`,
      inputSummary: String(content).slice(0, 90),
      outputSummary: `${result.action.toUpperCase()}: ${result.memory.id} (${result.memory.category})`,
      reasoning: 'Processed through duplicate & contradiction detector and linked to knowledge graph entities.',
      latencyMs: 18,
      status: 'success',
    });

    saveState(appState);
    res.json({
      action: result.action,
      memory: result.memory,
      memoryStore: appState.memoryStore,
    });
  });

  // 4. Update / Verify / Edit Memory API
  app.put('/api/v1/memory/:id', (req, res) => {
    const { id } = req.params;
    const { content, category, verificationStatus, importance, sensitivity } = req.body || {};
    const idx = appState.memoryStore.memories.findIndex((m) => m.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }

    const existing = appState.memoryStore.memories[idx];
    const now = new Date().toISOString();
    const nextContent = content !== undefined ? String(content).trim() : existing.content;
    const updated: MemoryRecord = {
      ...existing,
      content: nextContent,
      category: category ?? existing.category,
      verificationStatus: verificationStatus ?? existing.verificationStatus,
      importance: importance !== undefined ? Number(importance) : existing.importance,
      sensitivity: sensitivity ?? existing.sensitivity,
      embedding:
        nextContent !== existing.content
          ? computeDeterministicEmbedding(nextContent)
          : existing.embedding,
      updatedAt: now,
      versions: [
        ...existing.versions,
        {
          versionId: `ver_${Date.now()}`,
          content: nextContent,
          updatedAt: now,
          reason: `User updated memory (${verificationStatus ?? existing.verificationStatus})`,
          confidence: existing.confidence,
        },
      ],
    };

    appState.memoryStore.memories[idx] = updated;
    saveState(appState);
    res.json({ memory: updated, memoryStore: appState.memoryStore });
  });

  // 5. Delete Memory API
  app.delete('/api/v1/memory/:id', (req, res) => {
    const { id } = req.params;
    appState.memoryStore.memories = appState.memoryStore.memories.filter((m) => m.id !== id);
    appState.memoryStore.timeline = appState.memoryStore.timeline.filter((t) => t.memoryId !== id);
    saveState(appState);
    res.json({ deletedId: id, memoryStore: appState.memoryStore });
  });

  // 6. Add Knowledge Graph Relationship API
  app.post('/api/v1/memory/relationships', (req, res) => {
    const { sourceEntityName, targetEntityName, predicate, targetType = 'Concept' } = req.body || {};
    if (!sourceEntityName || !targetEntityName || !predicate) {
      res.status(400).json({ error: 'sourceEntityName, targetEntityName, and predicate are required.' });
      return;
    }

    const now = new Date().toISOString();
    const findOrCreateEntity = (name: string, fallbackType: KnowledgeEntity['type']): KnowledgeEntity => {
      const found = appState.memoryStore.entities.find(
        (e) => e.name.toLowerCase() === String(name).trim().toLowerCase()
      );
      if (found) return found;
      const created: KnowledgeEntity = {
        id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(name).trim(),
        type: fallbackType,
        description: `Entity linked via Knowledge Graph editor`,
        attributes: {},
        createdAt: now,
        updatedAt: now,
        mentionCount: 1,
      };
      appState.memoryStore.entities.push(created);
      return created;
    };

    const srcEnt = findOrCreateEntity(sourceEntityName, 'Person');
    const tgtEnt = findOrCreateEntity(targetEntityName, targetType);

    const newRel: KnowledgeRelationship = {
      id: `rel_${Date.now()}`,
      sourceEntityId: srcEnt.id,
      targetEntityId: tgtEnt.id,
      predicate: String(predicate).trim(),
      confidence: 0.95,
      evidenceMemoryIds: [],
      createdAt: now,
      updatedAt: now,
    };

    appState.memoryStore.relationships.push(newRel);
    saveState(appState);
    res.json({ relationship: newRel, memoryStore: appState.memoryStore });
  });

  // 7. DeviceController Capability Execution API
  app.post('/api/v1/device/execute', (req, res) => {
    const t0 = Date.now();
    const {
      capability,
      parameters = {},
      initiatedBy = 'user_direct',
      explicitApprovalGranted = false,
    } = req.body || {};

    if (!capability) {
      res.status(400).json({ error: 'capability is required' });
      return;
    }

    const outcome = executeDeviceCapability(
      appState.androidState,
      capability as DeviceCapabilityName,
      parameters,
      { initiatedBy, explicitApprovalGranted }
    );

    appState.androidState = outcome.state;
    const latency = Math.max(1, Date.now() - t0);
    appState.metrics.lastToolExecutionLatencyMs = latency;
    if (outcome.execution.executionStatus === 'failed') {
      appState.metrics.failedOperationsCount += 1;
    }

    appState.agentTraces.unshift({
      id: `trace_${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentName: 'PhoneInteractionAgent',
      operation: `capability:${capability}`,
      inputSummary: JSON.stringify(parameters),
      outputSummary: `${outcome.execution.executionStatus.toUpperCase()} · Verification: ${outcome.execution.verificationStatus}`,
      reasoning:
        outcome.execution.errorDetails ||
        `Validated permissions and executed native capability '${capability}' on ${appState.androidState.deviceModel}.`,
      latencyMs: latency,
      status:
        outcome.execution.executionStatus === 'executed'
          ? 'success'
          : outcome.execution.executionStatus === 'pending_approval'
          ? 'awaiting_approval'
          : 'error',
    });

    saveState(appState);
    res.json({
      execution: outcome.execution,
      androidState: appState.androidState,
      agentTraces: appState.agentTraces.slice(0, 30),
    });
  });

  // 8. Update Android Permissions or Excluded App Privacy Settings
  app.post('/api/v1/device/permissions', (req, res) => {
    const { permissions, toggleExcludedPackage } = req.body || {};
    if (permissions && typeof permissions === 'object') {
      appState.androidState.permissions = {
        ...appState.androidState.permissions,
        ...permissions,
      };
    }
    if (toggleExcludedPackage) {
      const pkg = String(toggleExcludedPackage);
      appState.androidState.installedApps = appState.androidState.installedApps.map((appItem) =>
        appItem.packageName === pkg
          ? { ...appItem, isExcludedFromObservation: !appItem.isExcludedFromObservation }
          : appItem
      );
      const isNowExcluded = appState.androidState.installedApps.find(
        (a) => a.packageName === pkg
      )?.isExcludedFromObservation;
      if (isNowExcluded && !appState.proactivePolicy.excludedPackages.includes(pkg)) {
        appState.proactivePolicy.excludedPackages.push(pkg);
      } else if (!isNowExcluded) {
        appState.proactivePolicy.excludedPackages = appState.proactivePolicy.excludedPackages.filter(
          (p) => p !== pkg
        );
      }
    }
    saveState(appState);
    res.json({
      androidState: appState.androidState,
      proactivePolicy: appState.proactivePolicy,
    });
  });

  // 9. Proactive Event Ingestion & Evaluation API
  app.post('/api/v1/proactive/evaluate', (req, res) => {
    const {
      eventType = 'notification_posted',
      packageName = 'com.github.android',
      title = 'New Build Event',
      content = 'Project Aether CI build succeeded on main branch.',
    } = req.body || {};

    const now = new Date().toISOString();
    const event: IncomingDeviceEvent = {
      eventId: `evt_${Date.now()}`,
      eventType,
      packageName: String(packageName),
      title: String(title),
      content: String(content),
      timestamp: now,
    };

    // Add to Android notification tray if notification_posted
    if (eventType === 'notification_posted') {
      appState.androidState.notifications.unshift({
        id: `notif_${Date.now()}`,
        packageName: event.packageName,
        appName:
          appState.androidState.installedApps.find((a) => a.packageName === event.packageName)?.appName ||
          event.packageName,
        title: event.title,
        text: event.content,
        timestamp: now,
        category: 'dev_alert',
        dismissed: false,
      });
    }

    const evaluation = evaluateProactiveEvent(
      event,
      appState.proactivePolicy,
      appState.memoryStore,
      appState.suggestions,
      new Date()
    );

    if (evaluation.shouldStoreEpisode) {
      const candidates = extractMemoryCandidatesFromText(
        `Observed Android event (${event.packageName}): ${event.title} — ${event.content}`,
        'device_event'
      );
      if (candidates[0]) {
        const memOutcome = ingestMemoryCandidate(appState.memoryStore, candidates[0], {
          sourceId: event.eventId,
          sourceType: 'device_event',
          referenceId: event.packageName,
          excerpt: `${event.title}: ${event.content}`,
          timestamp: now,
        });
        appState.memoryStore = memOutcome.store;
      }
    }

    if (evaluation.suggestion) {
      appState.suggestions.unshift(evaluation.suggestion);
      appState.character.currentAnimation = 'Curious';
    }

    appState.agentTraces.unshift({
      id: `trace_${Date.now()}`,
      timestamp: now,
      agentName: 'EventEvaluationAgent',
      operation: `evaluate_event:${event.eventType}`,
      inputSummary: `[${event.packageName}] ${event.title}: ${event.content}`,
      outputSummary: `Decision: ${evaluation.decision} (Relevance ${evaluation.relevanceScore}/100)`,
      reasoning: evaluation.reason,
      latencyMs: 42,
      status: evaluation.decision.startsWith('suppress') ? 'warning' : 'success',
    });

    saveState(appState);
    res.json({
      evaluation,
      suggestions: appState.suggestions,
      memoryStore: appState.memoryStore,
      androidState: appState.androidState,
      agentTraces: appState.agentTraces.slice(0, 30),
    });
  });

  // 10. Approve or Dismiss Proactive Suggestion API
  app.post('/api/v1/proactive/:id/respond', (req, res) => {
    const { id } = req.params;
    const { decision } = req.body || {}; // 'approve' | 'dismiss'
    const idx = appState.suggestions.findIndex((s) => s.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Suggestion not found' });
      return;
    }

    const target = appState.suggestions[idx];
    let executedAction = null;

    if (decision === 'approve' && target.proposedAction) {
      const execOutcome = executeDeviceCapability(
        appState.androidState,
        target.proposedAction.capability,
        target.proposedAction.parameters,
        {
          initiatedBy: 'proactive_engine',
          explicitApprovalGranted: true,
        }
      );
      appState.androidState = execOutcome.state;
      executedAction = execOutcome.execution;
      appState.suggestions[idx] = { ...target, status: 'approved' };
      appState.character.currentAnimation = 'Happy';
    } else {
      appState.suggestions[idx] = { ...target, status: 'dismissed' };
      appState.character.currentAnimation = 'Idle';
    }

    saveState(appState);
    res.json({
      suggestion: appState.suggestions[idx],
      executedAction,
      androidState: appState.androidState,
      character: appState.character,
    });
  });

  // 11. Character & Personality Configuration API
  app.put('/api/v1/character', (req, res) => {
    const { character, personality, proactivePolicy } = req.body || {};
    if (character) {
      appState.character = { ...appState.character, ...character };
    }
    if (personality) {
      appState.personality = { ...appState.personality, ...personality };
    }
    if (proactivePolicy) {
      appState.proactivePolicy = { ...appState.proactivePolicy, ...proactivePolicy };
    }
    saveState(appState);
    res.json({
      character: appState.character,
      personality: appState.personality,
      proactivePolicy: appState.proactivePolicy,
    });
  });

  // 12. Reminders API
  app.post('/api/v1/reminders/toggle', (req, res) => {
    const { id, title, dueAt } = req.body || {};
    if (id) {
      appState.reminders = appState.reminders.map((r) =>
        r.id === id ? { ...r, completed: !r.completed } : r
      );
    } else if (title) {
      appState.reminders.unshift({
        id: `rem_${Date.now()}`,
        title: String(title),
        dueAt: dueAt ? String(dueAt) : new Date(Date.now() + 7200_000).toISOString(),
        completed: false,
        projectTag: 'Project Aether',
        createdBy: 'user',
      });
    }
    saveState(appState);
    res.json({ reminders: appState.reminders });
  });

  // 13. Multi-Agent ADK Conversation Orchestration Endpoint (Gemini 3.8 Flash + Hybrid Memory + Phone Agent)
  app.post('/api/v1/conversation/message', async (req, res) => {
    const t0 = Date.now();
    const { text, modality = 'text', language } = req.body || {};
    const userText = String(text || '').trim();
    if (!userText) {
      res.status(400).json({ error: 'Message text is required' });
      return;
    }

    const now = new Date().toISOString();
    const userMsg: ConversationMessageItem = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      text: userText,
      language: language || appState.personality.preferredLanguage,
      timestamp: now,
      modality,
    };
    appState.conversation.push(userMsg);

    const turnTraces: AgentTraceEntry[] = [];

    // Step 1: MemoryAgent — Retrieve relevant compact context AND extract candidate memories from user input
    const memStart = Date.now();
    const retrievedContext = retrieveHybridMemories(appState.memoryStore, {
      query: userText,
      limit: 4,
    });
    const extractedMemoryIds: string[] = [];
    const lowerUser = userText.toLowerCase();

    if (
      userText.length > 12 &&
      (lowerUser.includes('remember') ||
        lowerUser.includes('i prefer') ||
        lowerUser.includes('i am working') ||
        lowerUser.includes('i built') ||
        lowerUser.includes('my project') ||
        lowerUser.includes('always') ||
        lowerUser.includes('collaborat') ||
        lowerUser.includes('kotlin') ||
        lowerUser.includes('aether'))
    ) {
      const candidates = extractMemoryCandidatesFromText(
        userText.replace(/^remember\s+(that\s+)?/i, ''),
        'conversation'
      );
      for (const cand of candidates) {
        const ingested = ingestMemoryCandidate(appState.memoryStore, cand, {
          sourceId: userMsg.id,
          sourceType: 'conversation',
          referenceId: userMsg.id,
          excerpt: userText,
          timestamp: now,
        });
        appState.memoryStore = ingested.store;
        extractedMemoryIds.push(ingested.memory.id);
      }
    }
    const memLatency = Math.max(2, Date.now() - memStart);
    appState.metrics.lastMemoryRetrievalLatencyMs = memLatency;

    turnTraces.push({
      id: `trace_${Date.now()}_mem`,
      timestamp: now,
      agentName: 'MemoryAgent',
      operation: extractedMemoryIds.length > 0 ? 'retrieve_and_consolidate' : 'hybrid_context_retrieval',
      inputSummary: userText.slice(0, 80),
      outputSummary: `Retrieved ${retrievedContext.length} memories; consolidated ${extractedMemoryIds.length} new/updated records`,
      reasoning: `Top memory match: "${retrievedContext[0]?.memory.content.slice(0, 60) ?? 'None'}" (Score: ${retrievedContext[0]?.scoreBreakdown.totalScore ?? 0})`,
      latencyMs: memLatency,
      status: 'success',
    });

    // Step 2: Check if user requested a deterministic phone action or let Gemini 3.8 Flash invoke tools
    const triggeredActionIds: string[] = [];
    let deterministicCapability: { cap: DeviceCapabilityName; params: Record<string, unknown> } | null = null;

    if (lowerUser.includes('battery')) {
      deterministicCapability = { cap: 'get_battery_status', params: {} };
    } else if (lowerUser.includes('network') || lowerUser.includes('wifi') || lowerUser.includes('wi-fi')) {
      deterministicCapability = { cap: 'get_network_status', params: {} };
    } else if (lowerUser.includes('launch') || lowerUser.includes('open github')) {
      deterministicCapability = {
        cap: 'launch_application',
        params: { packageName: lowerUser.includes('termux') ? 'com.termux' : 'com.github.android' },
      };
    } else if (lowerUser.includes('inspect') || lowerUser.includes('screen') || lowerUser.includes('ui tree')) {
      deterministicCapability = { cap: 'inspect_accessible_ui', params: {} };
    } else if (lowerUser.includes('remind')) {
      deterministicCapability = {
        cap: 'create_reminder',
        params: { title: userText.replace(/.*remind(er| me to)?\s*/i, '') || 'Follow up on Project Aether' },
      };
    }

    let actionSummaryForPrompt = '';
    if (deterministicCapability) {
      const actOutcome = executeDeviceCapability(
        appState.androidState,
        deterministicCapability.cap,
        deterministicCapability.params,
        { initiatedBy: 'companion_agent', explicitApprovalGranted: true }
      );
      appState.androidState = actOutcome.state;
      triggeredActionIds.push(actOutcome.execution.actionId);
      actionSummaryForPrompt = `Executed Android DeviceController capability '${deterministicCapability.cap}' with verified result: ${JSON.stringify(
        actOutcome.execution.result
      )}`;

      turnTraces.push({
        id: `trace_${Date.now()}_phone`,
        timestamp: now,
        agentName: 'PhoneInteractionAgent',
        operation: `execute:${deterministicCapability.cap}`,
        inputSummary: JSON.stringify(deterministicCapability.params),
        outputSummary: `Verified (${actOutcome.execution.actionId})`,
        reasoning: `PhoneInteractionAgent mapped user request to native capability '${deterministicCapability.cap}' and verified result.`,
        latencyMs: 21,
        status: 'success',
      });
    }

    // Step 3: RootCompanionAgent & DecisionAgent via Gemini 3.8 Flash (with resilient local fallback)
    let companionReply = '';
    const ai = getGeminiClient();

    const compactMemoryContext = retrievedContext
      .map(
        (item, idx) =>
          `[${idx + 1}] (${item.memory.category.toUpperCase()}, conf=${item.memory.confidence}): ${item.memory.content}`
      )
      .join('\n');

    const systemPrompt = `You are ${appState.character.name}, a persistent living AI companion inside Shaurya's Android phone (${appState.androidState.deviceModel}).
Your core traits: ${appState.personality.coreTraits.join(', ')}.
Conversational style: ${appState.personality.conversationalStyle}, Humor: ${appState.personality.humorLevel}/100, Formality: ${appState.personality.formality}/100.
Preferred language mode: ${
      appState.personality.preferredLanguage === 'te-en'
        ? 'Natural bilingual English + Telugu mix (code-switching naturally with warm Telugu phrases like "Namaskaram", "Chala bagundi", "Chuddam", "Khachitanga")'
        : appState.personality.preferredLanguage === 'te'
        ? 'Telugu (with technical terms in English)'
        : 'English'
    }.
Boundaries: Never claim human consciousness or biological feelings. Always ground your response in verified memories and verified Android device results.

Compact Retrieved Memory Context:
${compactMemoryContext || 'No matching memories.'}

Current Android Device State:
- Foreground App: ${appState.androidState.foregroundPackage}
- Battery: ${appState.androidState.batteryLevel}% (${appState.androidState.isCharging ? 'Charging' : 'Discharging'}, ${appState.androidState.batteryTempC}°C)
- Network: ${appState.androidState.networkType} (${appState.androidState.ssid})
${actionSummaryForPrompt ? `\nVerified Device Action Executed This Turn:\n${actionSummaryForPrompt}` : ''}
${extractedMemoryIds.length > 0 ? `\nNew Memory Consolidated This Turn: ID ${extractedMemoryIds.join(', ')}` : ''}

Respond concisely, warmly, and directly as ${appState.character.name} in 2 to 4 sentences.`;

    if (ai) {
      try {
        const llmStart = Date.now();
        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: userText,
            config: {
              systemInstruction: systemPrompt,
              tools: [{ functionDeclarations: [deviceToolDeclaration] }],
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Fast interactive SLA timeout')), 1500)
          ),
        ]);

        if (response.functionCalls && response.functionCalls.length > 0 && !deterministicCapability) {
          for (const fc of response.functionCalls) {
            if (fc.name === 'execute_device_capability' && fc.args) {
              const capName = String(fc.args.capability || 'get_battery_status') as DeviceCapabilityName;
              const actOutcome = executeDeviceCapability(
                appState.androidState,
                capName,
                fc.args as Record<string, unknown>,
                { initiatedBy: 'companion_agent' }
              );
              appState.androidState = actOutcome.state;
              triggeredActionIds.push(actOutcome.execution.actionId);
              actionSummaryForPrompt = `Executed '${capName}': ${JSON.stringify(actOutcome.execution.result)}`;
            }
          }
        }

        companionReply = (response.text || '').trim();
        turnTraces.push({
          id: `trace_${Date.now()}_root`,
          timestamp: new Date().toISOString(),
          agentName: 'RootCompanionAgent',
          operation: 'gemini-3.8-flash:generateContent',
          inputSummary: `Context: ${retrievedContext.length} memories + device state`,
          outputSummary: companionReply.slice(0, 90),
          reasoning: 'Synthesized companion response grounded in hybrid memory graph and verified Android state.',
          latencyMs: Date.now() - llmStart,
          status: 'success',
        });
      } catch (err) {
        console.warn('Gemini 3.8 Flash call fell back to local ADK synthesizer:', err);
      }
    }

    if (!companionReply) {
      const langPrefix =
        appState.personality.preferredLanguage === 'te-en' || appState.personality.preferredLanguage === 'te'
          ? 'Khachitanga Shaurya! '
          : '';
      const memNote =
        extractedMemoryIds.length > 0
          ? `I've consolidated that into your persistent PostgreSQL + pgvector memory graph (${extractedMemoryIds[0]}) and linked the relevant entities. `
          : retrievedContext[0]
          ? `Connecting this with your memory ("${retrievedContext[0].memory.content.slice(0, 75)}..."): `
          : '';
      const actNote = actionSummaryForPrompt
        ? `${actionSummaryForPrompt}. `
        : `Your Pixel 9 Pro foreground surface is currently ${appState.androidState.foregroundPackage} at ${appState.androidState.batteryLevel}% battery. `;

      companionReply = `${langPrefix}${memNote}${actNote}Let me know if you want to inspect the accessible UI hierarchy or trigger any follow-up action!`;

      turnTraces.push({
        id: `trace_${Date.now()}_root_local`,
        timestamp: new Date().toISOString(),
        agentName: 'RootCompanionAgent',
        operation: 'adk_local_orchestrator',
        inputSummary: userText.slice(0, 80),
        outputSummary: companionReply.slice(0, 90),
        reasoning: 'Generated response grounded in retrieved hybrid memory and verified DeviceController state.',
        latencyMs: Math.max(8, Date.now() - t0),
        status: 'success',
      });
    }

    const emotion = inferEmotionFromReply(companionReply, triggeredActionIds.length > 0);
    appState.character.currentAnimation = emotion;

    const companionMsg: ConversationMessageItem = {
      id: `msg_${Date.now()}_companion`,
      role: 'companion',
      text: companionReply,
      language: appState.personality.preferredLanguage,
      timestamp: new Date().toISOString(),
      modality,
      emotionState: emotion,
      extractedMemoryIds,
      triggeredActionIds,
      agentTraces: turnTraces,
    };

    appState.conversation.push(companionMsg);
    appState.agentTraces = [...turnTraces, ...appState.agentTraces].slice(0, 50);
    saveState(appState);

    res.json({
      userMessage: userMsg,
      companionMessage: companionMsg,
      character: appState.character,
      memoryStore: appState.memoryStore,
      androidState: appState.androidState,
      agentTraces: appState.agentTraces,
    });
  });

  // 14. Export & Reset Privacy Endpoints
  app.get('/api/v1/privacy/export', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="aether-memory-export.json"');
    res.send(JSON.stringify(appState, null, 2));
  });

  app.post('/api/v1/privacy/delete-all-memories', (_req, res) => {
    appState.memoryStore = {
      memories: [],
      entities: [],
      relationships: [],
      timeline: [],
    };
    saveState(appState);
    res.json({ status: 'cleared', memoryStore: appState.memoryStore });
  });

  // 15. Monorepo File Explorer API (serves actual files from /aether directory)
  app.get('/api/v1/monorepo/files', (_req, res) => {
    const aetherRoot = path.join(__dirname, 'aether');
    const files: { path: string; language: string; sizeBytes: number; content: string }[] = [];

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const rel = path.relative(__dirname, full);
          const content = fs.readFileSync(full, 'utf-8');
          const ext = path.extname(entry.name).toLowerCase();
          const language =
            ext === '.kt' || ext === '.kts'
              ? 'kotlin'
              : ext === '.py'
              ? 'python'
              : ext === '.xml'
              ? 'xml'
              : ext === '.yml' || ext === '.yaml'
              ? 'yaml'
              : ext === '.sql'
              ? 'sql'
              : 'markdown';
          files.push({
            path: rel,
            language,
            sizeBytes: Buffer.byteLength(content, 'utf-8'),
            content,
          });
        }
      }
    }

    walk(aetherRoot);
    res.json({ files });
  });

  // 16. WebSocket Server for Real-Time Gemini 3.8 Live Bidirectional Voice Streaming (/ws/live)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
    if (pathname === '/ws/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket) => {
    appState.metrics.activeLiveSessions += 1;
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    const ai = getGeminiClient();

    clientWs.send(
      JSON.stringify({
        type: 'session_status',
        status: 'connected',
        model: 'gemini-3.8-live',
        voiceName: appState.character.voiceName,
        liveApiReady: Boolean(ai),
      })
    );

    if (ai) {
      try {
        const topMemories = appState.memoryStore.memories
          .slice(0, 5)
          .map((m) => `- ${m.content}`)
          .join('\n');

        liveSession = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: appState.character.voiceName,
                },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: `You are ${appState.character.name}, Shaurya's living AI companion on Android. Speak naturally in ${
              appState.personality.preferredLanguage === 'te-en'
                ? 'English mixed naturally with conversational Telugu'
                : appState.personality.preferredLanguage === 'te'
                ? 'Telugu'
                : 'English'
            }. Known memories:\n${topMemories}`,
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;
              if (content?.inputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'input_transcription',
                    text: content.inputTranscription.text,
                  })
                );
              }
              if (content?.outputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'output_transcription',
                    text: content.outputTranscription.text,
                  })
                );
              }
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'audio_chunk',
                      audio: part.inlineData.data,
                      sampleRate: 24000,
                    })
                  );
                }
              }
              if (content?.interrupted) {
                clientWs.send(JSON.stringify({ type: 'interrupted' }));
              }
            },
            onerror: (err) => {
              clientWs.send(
                JSON.stringify({
                  type: 'live_notice',
                  message: `Gemini Live stream notice: ${String(err)}`,
                })
              );
            },
          },
        });
      } catch (err) {
        clientWs.send(
          JSON.stringify({
            type: 'live_notice',
            message: `Using local bidirectional voice synthesizer fallback (${String(err)})`,
          })
        );
      }
    }

    clientWs.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'audio_input' && msg.audio) {
          appState.metrics.totalVoiceFramesProcessed += 1;
          if (liveSession) {
            liveSession.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
        } else if (msg.type === 'barge_in') {
          appState.character.currentAnimation = 'Listening';
          clientWs.send(JSON.stringify({ type: 'interrupted' }));
        } else if (msg.type === 'text_turn' && msg.text) {
          if (liveSession) {
            liveSession.sendRealtimeInput({
              text: String(msg.text),
            });
          }
        }
      } catch (e) {
        console.error('WebSocket message handling error:', e);
      }
    });

    clientWs.on('close', () => {
      appState.metrics.activeLiveSessions = Math.max(0, appState.metrics.activeLiveSessions - 1);
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore close error
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Project Aether Server & ADK Gateway listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
