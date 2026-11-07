import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeterministicEmbedding,
  cosineSimilarity,
  extractMemoryCandidatesFromText,
  ingestMemoryCandidate,
  retrieveHybridMemories,
} from './memoryEngine';
import { executeDeviceCapability } from './deviceController';
import { evaluateProactiveEvent, isWithinQuietHours } from './proactiveEngine';
import {
  createInitialAndroidState,
  createInitialMemoryStore,
  createInitialProactivePolicy,
} from './initialSeedState';

test('Memory Engine: deterministic embeddings and cosine similarity rank related concepts higher', () => {
  const vecKotlin1 = computeDeterministicEmbedding('Building native Android UI with Kotlin and Jetpack Compose');
  const vecKotlin2 = computeDeterministicEmbedding('Kotlinoutines and Jetpack Compose on Android');
  const vecCoffee = computeDeterministicEmbedding('Brewing espresso coffee in the morning');

  const simRelated = cosineSimilarity(vecKotlin1, vecKotlin2);
  const simUnrelated = cosineSimilarity(vecKotlin1, vecCoffee);

  assert.equal(vecKotlin1.length, 32);
  assert.ok(simRelated > 0.55, `Expected high similarity for related Android/Kotlin texts, got ${simRelated}`);
  assert.ok(simRelated > simUnrelated, 'Expected related texts to have higher similarity than unrelated texts');
});

test('Memory Engine: duplicate consolidation and contradiction detection work accurately', () => {
  const initialStore = createInitialMemoryStore();
  const baseCount = initialStore.memories.length;

  // 1. Ingest a new explicit memory
  const candidates1 = extractMemoryCandidatesFromText(
    'Shaurya always uses Kotlin for Project Aether backend bridges.',
    'conversation'
  );
  assert.equal(candidates1.length, 1);
  assert.equal(candidates1[0].category, 'procedural');

  const res1 = ingestMemoryCandidate(initialStore, candidates1[0], {
    sourceId: 'src_test_1',
    sourceType: 'conversation',
    referenceId: 'conv_test',
    excerpt: candidates1[0].content,
    timestamp: new Date().toISOString(),
  });
  assert.equal(res1.action, 'created');
  assert.equal(res1.store.memories.length, baseCount + 1);

  // 2. Re-ingest exact duplicate -> should merge and bump version count instead of duplicating
  const resDup = ingestMemoryCandidate(res1.store, candidates1[0], {
    sourceId: 'src_test_2',
    sourceType: 'conversation',
    referenceId: 'conv_test',
    excerpt: candidates1[0].content,
    timestamp: new Date().toISOString(),
  });
  assert.equal(resDup.action, 'merged_duplicate');
  assert.equal(resDup.store.memories.length, baseCount + 1);
  assert.equal(resDup.memory.versions.length, 2);

  // 3. Ingest a contradicting statement -> should flag contradiction
  const candidatesContra = extractMemoryCandidatesFromText(
    'Shaurya never uses Kotlin for Project Aether backend bridges anymore.',
    'conversation'
  );
  const resContra = ingestMemoryCandidate(resDup.store, candidatesContra[0], {
    sourceId: 'src_test_3',
    sourceType: 'conversation',
    referenceId: 'conv_test',
    excerpt: candidatesContra[0].content,
    timestamp: new Date().toISOString(),
  });
  assert.equal(resContra.action, 'updated_contradiction');
  assert.ok(resContra.memory.contradictsMemoryId, 'New memory should reference superseded memory ID');
});

test('Memory Engine: hybrid retrieval combines vector, full-text, and knowledge graph boost', () => {
  const store = createInitialMemoryStore();
  const results = retrieveHybridMemories(store, {
    query: 'Ananya pgvector migration',
    limit: 3,
  });

  assert.ok(results.length > 0);
  assert.equal(results[0].memory.id, 'mem_04_relational_ananya');
  assert.ok(results[0].scoreBreakdown.graphBoost > 0, 'Expected positive graph boost for matched entity');
  assert.ok(results[0].connectedEntities.some((e) => e.name === 'Ananya Rao'));
});

test('DeviceController: enforces permissions, risk approval gates, and verifies state mutation', () => {
  const state = createInitialAndroidState();

  // 1. Launch application mutates foreground package and accessible UI nodes
  const launchRes = executeDeviceCapability(state, 'launch_application', {
    packageName: 'com.termux',
  });
  assert.equal(launchRes.execution.executionStatus, 'executed');
  assert.equal(launchRes.execution.verificationStatus, 'verified');
  assert.equal(launchRes.state.foregroundPackage, 'com.termux');

  // 2. High-risk capability initiated by agent without approval is paused for confirmation
  const highRiskPending = executeDeviceCapability(
    launchRes.state,
    'initiate_supported_phone_intent',
    { intentAction: 'android.intent.action.SENDTO', dataUri: 'mailto:test@aether.dev' },
    { initiatedBy: 'companion_agent', explicitApprovalGranted: false }
  );
  assert.equal(highRiskPending.execution.executionStatus, 'pending_approval');
  assert.equal(highRiskPending.execution.verificationStatus, 'unverified');

  // 3. Denied permission returns accurate failure
  const stateWithoutLocation = {
    ...launchRes.state,
    permissions: {
      ...launchRes.state.permissions,
      location: false,
    },
  };
  const deniedRes = executeDeviceCapability(stateWithoutLocation, 'get_location_with_permission');
  assert.equal(deniedRes.execution.permissionStatus, 'denied');
  assert.equal(deniedRes.execution.executionStatus, 'failed');
  assert.equal(deniedRes.execution.verificationStatus, 'failed_verification');
});

test('Proactive Engine: enforces privacy exclusion, OTP scrubbing, quiet hours, and relevance scoring', () => {
  const memoryStore = createInitialMemoryStore();
  const policy = createInitialProactivePolicy();

  // 1. Excluded app (WhatsApp) is suppressed immediately
  const excludedOutcome = evaluateProactiveEvent(
    {
      eventId: 'evt_1',
      eventType: 'notification_posted',
      packageName: 'com.whatsapp',
      title: 'Private Chat',
      content: 'Hey are you free?',
      timestamp: '2026-11-07T14:00:00.000Z',
    },
    policy,
    memoryStore,
    [],
    new Date('2026-11-07T14:00:00')
  );
  assert.equal(excludedOutcome.decision, 'suppress_privacy');

  // 2. OTP notification is scrubbed for privacy
  const otpOutcome = evaluateProactiveEvent(
    {
      eventId: 'evt_2',
      eventType: 'notification_posted',
      packageName: 'com.github.android',
      title: 'Verification Code',
      content: 'Your one-time OTP verification code is 839201',
      timestamp: '2026-11-07T14:05:00.000Z',
    },
    policy,
    memoryStore,
    [],
    new Date('2026-11-07T14:05:00')
  );
  assert.equal(otpOutcome.decision, 'suppress_privacy');

  // 3. Quiet hours check works across midnight
  assert.equal(isWithinQuietHours(new Date('2026-11-07T23:30:00'), '23:00', '07:00'), true);
  assert.equal(isWithinQuietHours(new Date('2026-11-07T06:15:00'), '23:00', '07:00'), true);
  assert.equal(isWithinQuietHours(new Date('2026-11-07T13:15:00'), '23:00', '07:00'), false);

  // 4. High-relevance project event outside quiet hours generates a proactive suggestion
  const activeOutcome = evaluateProactiveEvent(
    {
      eventId: 'evt_3',
      eventType: 'notification_posted',
      packageName: 'com.github.android',
      title: 'Project Aether Kotlin Build Alert',
      content: 'Ananya pushed a new commit to Project Aether pgvector branch',
      timestamp: '2026-11-07T14:15:00.000Z',
    },
    policy,
    memoryStore,
    [],
    new Date('2026-11-07T14:15:00')
  );
  assert.equal(activeOutcome.decision, 'proactive_suggestion');
  assert.ok(activeOutcome.suggestion);
  assert.ok(activeOutcome.relevanceScore >= policy.initiativeThreshold);
});

test('Companion Life Engine: manages autonomous scenes, vitals, and personal daily journal', async () => {
  const {
    createInitialCompanionLifeState,
    transitionCompanionLifeScene,
    resolveSceneForOutfit,
  } = await import('./companionLifeEngine');

  const initial = createInitialCompanionLifeState();
  assert.equal(initial.activeSceneId, 'coffee_sketchbook');
  assert.ok(initial.dailyJournal.length >= 3);
  assert.equal(resolveSceneForOutfit('cyber_kimono'), 'rooftop_balcony');

  const transitioned = transitionCompanionLifeScene(
    initial,
    'rooftop_balcony',
    'Watching the sunset together from the terrace.'
  );
  assert.equal(transitioned.lifeState.activeSceneId, 'rooftop_balcony');
  assert.equal(transitioned.activity.outfitKey, 'cyber_kimono');
  assert.equal(
    transitioned.lifeState.currentThought,
    'Watching the sunset together from the terrace.'
  );
  assert.equal(
    transitioned.lifeState.dailyJournal[0].entry,
    'Watching the sunset together from the terrace.'
  );
});
