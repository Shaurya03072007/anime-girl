import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Smartphone,
  Brain,
  Sparkles,
  Settings,
  MessageSquare,
  BatteryCharging,
  Wifi,
  ShieldCheck,
  Check,
  X,
  Volume2,
  Square,
  Plus,
  Trash2,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import {
  AgentTraceEntry,
  AnimationState,
  CharacterConfig,
  ConversationMessageItem,
  DeviceCapabilityName,
  DevicePermissionsState,
  KnowledgeEntity,
  MemoryCategory,
  PersonalityConfig,
  ProactivePolicyConfig,
  ProactiveSuggestion,
  ReminderItem,
  VerificationStatus,
} from './types/aether';
import {
  computeDeterministicEmbedding,
  extractMemoryCandidatesFromText,
  ingestMemoryCandidate,
  MemoryStateStore,
  retrieveHybridMemories,
} from './engine/memoryEngine';
import {
  AndroidRuntimeState,
  executeDeviceCapability,
} from './engine/deviceController';
import { evaluateProactiveEvent } from './engine/proactiveEngine';
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
} from './engine/initialSeedState';
import {
  CompanionLifeState,
  createInitialCompanionLifeState,
  LIFE_ACTIVITIES,
  LifeSceneId,
  transitionCompanionLifeScene,
} from './engine/companionLifeEngine';
import { AnimeCompanionCanvas } from './components/AnimeCompanionCanvas';
import { ConversationView } from './components/ConversationView';
import { MemoriesView } from './components/MemoriesView';
import { PhoneView } from './components/PhoneView';
import { CharacterView } from './components/CharacterView';
import { AndroidStudioSetupPanel } from './components/AndroidStudioSetupPanel';

type AndroidBottomTab =
  | 'AriaLive'
  | 'VoiceChat'
  | 'Memories'
  | 'PhoneBridge'
  | 'ServerUrl';

type RightWorkbenchTab =
  | 'AndroidStudioSetup'
  | 'ExpandedMemories'
  | 'ExpandedPhone'
  | 'ExpandedCharacter'
  | 'ExpandedVoice';

const STORAGE_KEY = 'aether_android_companion_v3';

async function tryJsonFetch(url: string, options?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(url, options);
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [androidTab, setAndroidTab] = useState<AndroidBottomTab>('AriaLive');
  const [workbenchTab, setWorkbenchTab] = useState<RightWorkbenchTab>('AndroidStudioSetup');

  const loadStored = <T,>(field: string, fallback: () => T): T => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed[field] !== undefined) {
          return parsed[field] as T;
        }
      }
    } catch {
      // ignore
    }
    return fallback();
  };

  const [memoryStore, setMemoryStore] = useState<MemoryStateStore>(() =>
    loadStored('memoryStore', createInitialMemoryStore)
  );
  const [character, setCharacter] = useState<CharacterConfig>(() =>
    loadStored('character', createInitialCharacterConfig)
  );
  const [personality, setPersonality] = useState<PersonalityConfig>(() =>
    loadStored('personality', createInitialPersonalityConfig)
  );
  const [androidState, setAndroidState] = useState<AndroidRuntimeState>(() =>
    loadStored('androidState', createInitialAndroidState)
  );
  const [proactivePolicy, setProactivePolicy] = useState<ProactivePolicyConfig>(() =>
    loadStored('proactivePolicy', createInitialProactivePolicy)
  );
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>(() =>
    loadStored('suggestions', createInitialSuggestions)
  );
  const [conversation, setConversation] = useState<ConversationMessageItem[]>(() =>
    loadStored('conversation', createInitialConversation)
  );
  const [reminders, setReminders] = useState<ReminderItem[]>(() =>
    loadStored('reminders', createInitialReminders)
  );
  const [agentTraces, setAgentTraces] = useState<AgentTraceEntry[]>(() =>
    loadStored('agentTraces', createInitialAgentTraces)
  );
  const [lifeState, setLifeState] = useState<CompanionLifeState>(() =>
    loadStored('lifeState', createInitialCompanionLifeState)
  );

  // Android DataStore Backend Connection Settings (mirrors BackendPreferencesRepository.kt)
  const [backendHttpUrl, setBackendHttpUrl] = useState<string>(() =>
    loadStored('backendHttpUrl', () => 'http://127.0.0.1:8000')
  );
  const [backendWsUrl, setBackendWsUrl] = useState<string>(() =>
    loadStored('backendWsUrl', () => 'ws://127.0.0.1:8000')
  );
  const [apiToken, setApiToken] = useState<string>(() =>
    loadStored('apiToken', () => 'aether-dev-local-token-2026')
  );
  const [connectionBanner, setConnectionBanner] = useState<string>(
    'Connected · ws://127.0.0.1:8000/ws/live/shaurya (16kHz PCM In / 24kHz Out)'
  );

  const [mobileInputText, setMobileInputText] = useState('');
  const [mobileMicActive, setMobileMicActive] = useState(false);
  const [mobileVoiceAmp, setMobileVoiceAmp] = useState(0);
  const [newMemoryMobileText, setNewMemoryMobileText] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          memoryStore,
          character,
          personality,
          androidState,
          proactivePolicy,
          suggestions,
          conversation,
          reminders,
          agentTraces,
          lifeState,
          backendHttpUrl,
          backendWsUrl,
          apiToken,
        })
      );
    } catch {
      // ignore quota error
    }
  }, [
    memoryStore,
    character,
    personality,
    androidState,
    proactivePolicy,
    suggestions,
    conversation,
    reminders,
    agentTraces,
    lifeState,
    backendHttpUrl,
    backendWsUrl,
    apiToken,
  ]);

  const handleTransitionLifeScene = (sceneId: LifeSceneId, customThought?: string) => {
    const { lifeState: nextLife, activity } = transitionCompanionLifeScene(
      lifeState,
      sceneId,
      customThought
    );
    setLifeState(nextLife);
    setCharacter((prev) => ({
      ...prev,
      outfit: activity.outfitKey,
      currentAnimation: activity.defaultEmotion,
    }));
  };

  const handleToggleMobileVoice = () => {
    if (mobileMicActive) {
      setMobileMicActive(false);
      setMobileVoiceAmp(0);
      setCharacter((prev) => ({ ...prev, currentAnimation: 'Idle' }));
    } else {
      setMobileMicActive(true);
      setMobileVoiceAmp(0.55);
      setCharacter((prev) => ({ ...prev, currentAnimation: 'Listening' }));
    }
  };

  const handleMobileBargeIn = () => {
    setMobileVoiceAmp(0.25);
    setCharacter((prev) => ({ ...prev, currentAnimation: 'Listening' }));
  };

  const handleSendMessage = async (
    text: string,
    modality: 'voice' | 'text' = 'text',
    language: 'en' | 'te' | 'te-en' = personality.preferredLanguage
  ) => {
    const data = await tryJsonFetch('/api/v1/conversation/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, modality, language }),
    });

    if (data && data.userMessage && data.companionMessage) {
      setConversation((prev) => [...prev, data.userMessage, data.companionMessage]);
      if (data.character) setCharacter(data.character);
      if (data.memoryStore) setMemoryStore(data.memoryStore);
      if (data.androidState) setAndroidState(data.androidState);
      if (data.agentTraces) setAgentTraces(data.agentTraces);
      setMobileVoiceAmp(0.75);
      setTimeout(() => setMobileVoiceAmp(0), 2200);
      return;
    }

    const now = new Date().toISOString();
    const userMsg: ConversationMessageItem = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      text,
      language,
      timestamp: now,
      modality,
    };

    let nextMemoryStore = memoryStore;
    const extractedMemoryIds: string[] = [];
    const lowerUser = text.toLowerCase();

    if (
      text.length > 10 &&
      (lowerUser.includes('remember') ||
        lowerUser.includes('prefer') ||
        lowerUser.includes('testing') ||
        lowerUser.includes('working') ||
        lowerUser.includes('kotlin') ||
        lowerUser.includes('aether'))
    ) {
      const candidates = extractMemoryCandidatesFromText(
        text.replace(/^remember\s+(that\s+)?/i, ''),
        'conversation'
      );
      for (const cand of candidates) {
        const ingested = ingestMemoryCandidate(nextMemoryStore, cand, {
          sourceId: userMsg.id,
          sourceType: 'conversation',
          referenceId: userMsg.id,
          excerpt: text,
          timestamp: now,
        });
        nextMemoryStore = ingested.store;
        extractedMemoryIds.push(ingested.memory.id);
      }
    }

    const retrieved = retrieveHybridMemories(nextMemoryStore, { query: text, limit: 3 });

    let nextAndroidState = androidState;
    const triggeredActionIds: string[] = [];
    let actionNote = '';

    if (lowerUser.includes('battery')) {
      const out = executeDeviceCapability(
        nextAndroidState,
        'get_battery_status',
        {},
        { initiatedBy: 'companion_agent' }
      );
      nextAndroidState = out.state;
      triggeredActionIds.push(out.execution.actionId);
      actionNote = `Checked your ${nextAndroidState.deviceModel} battery: ${nextAndroidState.batteryLevel}% (Charging, ${nextAndroidState.batteryTempC}°C). `;
    } else if (
      lowerUser.includes('launch') ||
      lowerUser.includes('github') ||
      lowerUser.includes('termux')
    ) {
      const pkg = lowerUser.includes('termux') ? 'com.termux' : 'com.github.android';
      const out = executeDeviceCapability(
        nextAndroidState,
        'launch_application',
        { packageName: pkg },
        { initiatedBy: 'companion_agent' }
      );
      nextAndroidState = out.state;
      triggeredActionIds.push(out.execution.actionId);
      actionNote = `Launched ${pkg} on your Pixel 9 Pro and indexed ${nextAndroidState.accessibleNodes.length} accessible UI nodes. `;
    } else if (lowerUser.includes('inspect') || lowerUser.includes('ui tree')) {
      const out = executeDeviceCapability(
        nextAndroidState,
        'inspect_accessible_ui',
        {},
        { initiatedBy: 'companion_agent' }
      );
      nextAndroidState = out.state;
      triggeredActionIds.push(out.execution.actionId);
      actionNote = `Inspected accessible UI hierarchy for ${nextAndroidState.foregroundPackage} (${nextAndroidState.accessibleNodes.length} nodes). `;
    }

    const turnTraces: AgentTraceEntry[] = [
      {
        id: `trace_${Date.now()}_mem`,
        timestamp: now,
        agentName: 'MemoryAgent',
        operation:
          extractedMemoryIds.length > 0
            ? 'retrieve_and_consolidate'
            : 'hybrid_context_retrieval',
        inputSummary: text.slice(0, 80),
        outputSummary: `Retrieved ${retrieved.length} memories; consolidated ${extractedMemoryIds.length} new record(s)`,
        reasoning: `Hybrid vector + graph retrieval top score: ${
          retrieved[0]?.scoreBreakdown.totalScore ?? 0
        }`,
        latencyMs: 18,
        status: 'success',
      },
    ];

    const prefix = language === 'en' ? 'Got it, Shaurya! ' : 'Khachitanga Shaurya! ';
    const memSummary =
      extractedMemoryIds.length > 0
        ? `I saved that into our shared memory graph (${extractedMemoryIds[0]}). `
        : retrieved[0]
        ? `Remembering "${retrieved[0].memory.content.slice(0, 64)}...": `
        : '';

    const replyText = `${prefix}${memSummary}${
      actionNote ||
      `Right now I'm at the ${LIFE_ACTIVITIES[lifeState.activeSceneId].location} while your phone is on ${nextAndroidState.foregroundPackage} (${nextAndroidState.batteryLevel}% battery).`
    }`;
    const nextEmotion: AnimationState =
      triggeredActionIds.length > 0 ? 'Processing an action' : 'Speaking';

    const companionMsg: ConversationMessageItem = {
      id: `msg_${Date.now()}_companion`,
      role: 'companion',
      text: replyText,
      language,
      timestamp: new Date().toISOString(),
      modality,
      emotionState: nextEmotion,
      extractedMemoryIds,
      triggeredActionIds,
      agentTraces: turnTraces,
    };

    setMemoryStore(nextMemoryStore);
    setAndroidState(nextAndroidState);
    setCharacter((prev) => ({ ...prev, currentAnimation: nextEmotion }));
    setConversation((prev) => [...prev, userMsg, companionMsg]);
    setAgentTraces((prev) => [...turnTraces, ...prev]);
    setMobileVoiceAmp(0.75);
    setTimeout(() => {
      setMobileVoiceAmp(0);
      setCharacter((prev) => ({ ...prev, currentAnimation: 'Happy' }));
    }, 2200);
  };

  const handleMobileChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileInputText.trim()) return;
    const txt = mobileInputText.trim();
    setMobileInputText('');
    await handleSendMessage(txt, mobileMicActive ? 'voice' : 'text', personality.preferredLanguage);
  };

  const handleCreateMemory = async (payload: {
    content: string;
    category: MemoryCategory;
    importance: number;
    entityNames: string[];
  }) => {
    const extracted = extractMemoryCandidatesFromText(payload.content, 'user_edit');
    const cand = extracted[0] || {
      content: payload.content,
      category: payload.category,
      epistemicStatus: 'explicitly_stated' as const,
      confidence: 0.96,
      importance: payload.importance,
      sensitivity: 'personal' as const,
      entities: [],
      relationships: [],
    };
    cand.category = payload.category;
    cand.importance = payload.importance;
    for (const name of payload.entityNames) {
      const clean = name.trim();
      if (clean && !cand.entities.some((e) => e.name.toLowerCase() === clean.toLowerCase())) {
        cand.entities.push({ name: clean, type: 'Concept', description: 'User-tagged entity' });
        cand.relationships.push({
          sourceName: 'Shaurya',
          targetName: clean,
          predicate: 'associated_with',
        });
      }
    }
    const res = ingestMemoryCandidate(memoryStore, cand, {
      sourceId: `src_manual_${Date.now()}`,
      sourceType: 'user_edit',
      referenceId: 'android_memory_ui',
      excerpt: payload.content,
      timestamp: new Date().toISOString(),
    });
    setMemoryStore(res.store);
  };

  const handleUpdateMemory = async (
    id: string,
    payload: {
      content?: string;
      category?: MemoryCategory;
      verificationStatus?: VerificationStatus;
    }
  ) => {
    const now = new Date().toISOString();
    setMemoryStore((prev) => ({
      ...prev,
      memories: prev.memories.map((m) => {
        if (m.id !== id) return m;
        const nextContent = payload.content !== undefined ? payload.content.trim() : m.content;
        return {
          ...m,
          content: nextContent,
          category: payload.category ?? m.category,
          verificationStatus: payload.verificationStatus ?? m.verificationStatus,
          embedding:
            nextContent !== m.content ? computeDeterministicEmbedding(nextContent) : m.embedding,
          updatedAt: now,
        };
      }),
    }));
  };

  const handleDeleteMemory = async (id: string) => {
    setMemoryStore((prev) => ({
      ...prev,
      memories: prev.memories.filter((m) => m.id !== id),
      timeline: prev.timeline.filter((t) => t.memoryId !== id),
    }));
  };

  const handleCreateRelationship = async (payload: {
    sourceEntityName: string;
    targetEntityName: string;
    predicate: string;
  }) => {
    const now = new Date().toISOString();
    setMemoryStore((prev) => {
      const entities = [...prev.entities];
      const ensureEnt = (name: string): KnowledgeEntity => {
        const found = entities.find((e) => e.name.toLowerCase() === name.toLowerCase());
        if (found) return found;
        const created: KnowledgeEntity = {
          id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          type: 'Concept',
          description: 'Entity linked via Knowledge Graph editor',
          attributes: {},
          createdAt: now,
          updatedAt: now,
          mentionCount: 1,
        };
        entities.push(created);
        return created;
      };
      const src = ensureEnt(payload.sourceEntityName);
      const tgt = ensureEnt(payload.targetEntityName);
      return {
        ...prev,
        entities,
        relationships: [
          ...prev.relationships,
          {
            id: `rel_${Date.now()}`,
            sourceEntityId: src.id,
            targetEntityId: tgt.id,
            predicate: payload.predicate,
            confidence: 0.95,
            evidenceMemoryIds: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
    });
  };

  const handleExecuteCapability = async (
    capability: DeviceCapabilityName,
    parameters: Record<string, unknown> = {}
  ) => {
    const outcome = executeDeviceCapability(androidState, capability, parameters, {
      initiatedBy: 'user_direct',
    });
    setAndroidState(outcome.state);
  };

  const handleUpdatePermissions = async (
    permissions?: Partial<DevicePermissionsState>,
    toggleExcludedPackage?: string
  ) => {
    if (permissions) {
      setAndroidState((prev) => ({
        ...prev,
        permissions: { ...prev.permissions, ...permissions },
      }));
    }
    if (toggleExcludedPackage) {
      setAndroidState((prev) => ({
        ...prev,
        installedApps: prev.installedApps.map((a) =>
          a.packageName === toggleExcludedPackage
            ? { ...a, isExcludedFromObservation: !a.isExcludedFromObservation }
            : a
        ),
      }));
    }
  };

  const handleTriggerAndroidEvent = async (payload: {
    eventType: string;
    packageName: string;
    title: string;
    content: string;
  }) => {
    const now = new Date().toISOString();
    const evaluation = evaluateProactiveEvent(
      {
        eventId: `evt_${Date.now()}`,
        eventType: 'notification_posted',
        packageName: payload.packageName,
        title: payload.title,
        content: payload.content,
        timestamp: now,
      },
      proactivePolicy,
      memoryStore,
      suggestions,
      new Date()
    );
    if (evaluation.suggestion) {
      setSuggestions((prev) => [evaluation.suggestion!, ...prev]);
    }
  };

  const handleRespondSuggestion = async (id: string, decision: 'approve' | 'dismiss') => {
    const target = suggestions.find((s) => s.id === id);
    if (target && decision === 'approve' && target.proposedAction) {
      const out = executeDeviceCapability(
        androidState,
        target.proposedAction.capability,
        target.proposedAction.parameters,
        { initiatedBy: 'proactive_engine', explicitApprovalGranted: true }
      );
      setAndroidState(out.state);
    }
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: decision === 'approve' ? 'approved' : 'dismissed' } : s
      )
    );
  };

  const handleSaveCharacterAndPersonality = async (
    nextCharacter: CharacterConfig,
    nextPersonality: PersonalityConfig
  ) => {
    setCharacter(nextCharacter);
    setPersonality(nextPersonality);
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const latestMessages = conversation.slice(-2);

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col">
      {/* Compact Android Studio & Device Header Bar (3-Zone Contract) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-5 py-3 border-b border-slate-800/80 bg-[#070A14]/95 backdrop-blur-md">
        <div className="flex items-center gap-2.5 shrink-0">
          <Smartphone className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-bold tracking-tight text-white">
            dev.aether.companion · Android 15 (API 35)
          </span>
        </div>

        <nav
          aria-label="Workbench Mode"
          className="flex items-center gap-5 overflow-x-auto text-xs font-medium text-slate-400"
        >
          {(
            [
              { id: 'AndroidStudioSetup', label: 'README & Backend URL Setup' },
              { id: 'ExpandedVoice', label: 'Live Voice' },
              { id: 'ExpandedMemories', label: 'Memory Graph' },
              { id: 'ExpandedPhone', label: 'Android Bridge' },
              { id: 'ExpandedCharacter', label: 'Aria & Life' },
            ] as { id: RightWorkbenchTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setWorkbenchTab(tab.id)}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                workbenchTab === tab.id
                  ? 'border-teal-400 text-white font-semibold'
                  : 'border-transparent hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleToggleMobileVoice}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              mobileMicActive
                ? 'bg-teal-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {mobileMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{mobileMicActive ? 'Stop Live Audio' : 'Start Gemini Live Voice'}</span>
          </button>
        </div>
      </header>

      {/* Main Split: Left Native Android 15 Device Frame (Pixel 9 Pro) + Right Git/Android Studio Setup & Expanded Inspector */}
      <main className="flex-1 w-full max-w-[1420px] mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (5 cols): NATIVE ANDROID 15 PIXEL 9 PRO DEVICE APP */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div
              data-testid="android-device-frame"
              className="w-full max-w-[430px] rounded-[38px] border-[6px] border-slate-800 bg-[#070A12] shadow-2xl overflow-hidden flex flex-col min-h-[810px]"
            >
              {/* Android 15 Status Bar */}
              <div className="px-6 pt-2.5 pb-2 bg-[#070A12] flex items-center justify-between text-[11px] font-mono text-slate-300 select-none">
                <span className="font-semibold">12:48</span>
                <div className="w-16 h-4 rounded-full bg-black border border-slate-800/80" />
                <div className="flex items-center gap-2">
                  <span>5G</span>
                  <Wifi className="w-3.5 h-3.5 text-teal-400" />
                  <span className="flex items-center gap-0.5 text-teal-300">
                    <BatteryCharging className="w-3.5 h-3.5" />
                    {androidState.batteryLevel}%
                  </span>
                </div>
              </div>

              {/* Android App Top AppBar */}
              <div className="px-4 py-2.5 border-b border-slate-800/80 bg-[#0B101E] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{character.name}</span>
                    <span className="text-[11px] text-amber-300 font-medium">
                      · {lifeState.currentMood}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-[250px]">
                    {backendWsUrl}/ws/live/shaurya
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAndroidTab('ServerUrl')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[11px] font-medium text-teal-300 border border-slate-700"
                >
                  Backend URL
                </button>
              </div>

              {/* Android Screen Body */}
              <div className="flex-1 flex flex-col justify-between p-3.5 space-y-3 overflow-y-auto">
                {/* TAB 1: ARIA LIVE SANCTUARY (Default Native Companion Screen) */}
                {androidTab === 'AriaLive' && (
                  <div className="flex flex-col justify-between h-full space-y-3">
                    {/* Studio 2.5D Anime Heroine with Scene Switcher */}
                    <AnimeCompanionCanvas
                      config={character}
                      animationState={character.currentAnimation}
                      audioAmplitude={mobileVoiceAmp}
                      size="conversation"
                      lifeState={lifeState}
                      onSelectLifeScene={(sceneId) => handleTransitionLifeScene(sceneId)}
                      onInteract={() => {
                        const cycle: AnimationState[] = [
                          'Happy',
                          'Curious',
                          'Listening',
                          'Speaking',
                          'Thinking',
                          'Idle',
                        ];
                        const next =
                          cycle[(cycle.indexOf(character.currentAnimation) + 1) % cycle.length];
                        setCharacter((c) => ({ ...c, currentAnimation: next }));
                      }}
                    />

                    {/* Proactive Android Event Toast inside Mobile Screen */}
                    {pendingSuggestions.length > 0 && (
                      <div className="p-3 rounded-2xl bg-indigo-950/50 border border-indigo-500/40 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-indigo-200">
                            Proactive Android Alert · {pendingSuggestions[0].title}
                          </span>
                          <span className="font-mono text-indigo-300">
                            {pendingSuggestions[0].relevanceScore}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-snug">
                          {pendingSuggestions[0].message}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleRespondSuggestion(pendingSuggestions[0].id, 'approve')
                            }
                            className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve on Phone</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRespondSuggestion(pendingSuggestions[0].id, 'dismiss')
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px]"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Recent Conversation Bubbles on Mobile Screen */}
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto px-0.5">
                      {latestMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                            m.role === 'user'
                              ? 'bg-indigo-600 text-white ml-8'
                              : 'bg-slate-900 border border-slate-800 text-slate-200 mr-4'
                          }`}
                        >
                          <span className="font-semibold text-[11px] block text-amber-300/90 mb-0.5">
                            {m.role === 'user' ? 'You' : character.name}
                          </span>
                          {m.text}
                        </div>
                      ))}
                    </div>

                    {/* Native Android Bottom Voice Orb & Chat Bar */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleMobileVoice}
                          className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                            mobileMicActive
                              ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/25'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {mobileMicActive ? (
                            <MicOff className="w-4 h-4" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                          <span>
                            {mobileMicActive
                              ? 'Streaming 16kHz PCM Audio...'
                              : 'Tap for Live Voice (TE-EN)'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={handleMobileBargeIn}
                          title="Interrupt (Barge-In)"
                          className="py-2.5 px-3 rounded-2xl bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-1"
                        >
                          <Square className="w-3.5 h-3.5 text-rose-400" />
                          <span>Barge-In</span>
                        </button>
                      </div>

                      <form onSubmit={handleMobileChatSubmit} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={mobileInputText}
                          onChange={(e) => setMobileInputText(e.target.value)}
                          placeholder={`Message ${character.name} in English or Telugu...`}
                          className="flex-1 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500"
                        />
                        <button
                          type="submit"
                          aria-label="Send mobile message"
                          className="p-2.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* TAB 2: VOICE & ADK STREAM INSIDE ANDROID PHONE */}
                {androidTab === 'VoiceChat' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">
                          GeminiLiveAudioEngine.kt
                        </span>
                        <span className="font-mono text-[11px] text-teal-400">
                          16kHz In · 24kHz Out
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Voice: {character.voiceName} · Lang: {personality.preferredLanguage.toUpperCase()} · Barge-In RMS Threshold: 1900
                      </p>
                      <div className="flex gap-1.5 pt-1">
                        {(['te-en', 'en', 'te'] as const).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() =>
                              setPersonality((p) => ({ ...p, preferredLanguage: lang }))
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                              personality.preferredLanguage === lang
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {lang === 'te-en' ? 'Telugu + English' : lang.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
                      {conversation.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-2xl text-xs space-y-1 ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white ml-6'
                              : 'bg-slate-900 border border-slate-800 text-slate-100 mr-4'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-80">
                            <span className="font-semibold">
                              {msg.role === 'user' ? 'Shaurya' : character.name}
                            </span>
                            <span>{msg.emotionState || msg.modality}</span>
                          </div>
                          <p className="leading-relaxed">{msg.text}</p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleMobileChatSubmit} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={mobileInputText}
                        onChange={(e) => setMobileInputText(e.target.value)}
                        placeholder="Say or type a command..."
                        className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-semibold"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 3: MEMORIES & KNOWLEDGE GRAPH INSIDE ANDROID PHONE */}
                {androidTab === 'Memories' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          Add Memory to pgvector Graph
                        </span>
                        <span className="text-[11px] font-mono text-teal-400">
                          {memoryStore.memories.length} records
                        </span>
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newMemoryMobileText.trim()) return;
                          handleCreateMemory({
                            content: newMemoryMobileText.trim(),
                            category: 'semantic',
                            importance: 0.9,
                            entityNames: ['Project Aether'],
                          });
                          setNewMemoryMobileText('');
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={newMemoryMobileText}
                          onChange={(e) => setNewMemoryMobileText(e.target.value)}
                          placeholder="Add explicit fact or preference..."
                          className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </form>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {memoryStore.memories.map((mem) => (
                        <div
                          key={mem.id}
                          className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="uppercase font-semibold text-indigo-300">
                              {mem.category} · {mem.verificationStatus}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteMemory(mem.id)}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed">{mem.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 4: NATIVE ANDROID PHONE BRIDGE INSIDE ANDROID PHONE */}
                {androidTab === 'PhoneBridge' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">
                          AndroidDeviceController.kt
                        </span>
                        <span className="font-mono text-[11px] text-teal-400">
                          {androidState.foregroundPackage}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleExecuteCapability('launch_application', {
                              packageName: 'com.github.android',
                            })
                          }
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-left"
                        >
                          Launch GitHub App
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleExecuteCapability('launch_application', {
                              packageName: 'com.termux',
                            })
                          }
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-left"
                        >
                          Launch Termux
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecuteCapability('inspect_accessible_ui', {})}
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-left"
                        >
                          Inspect UI Tree ({androidState.accessibleNodes.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecuteCapability('get_battery_status', {})}
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-left"
                        >
                          Read Battery ({androidState.batteryLevel}%)
                        </button>
                      </div>
                    </div>

                    {/* Accessible UI Nodes List */}
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <p className="text-xs font-bold text-white">
                        AetherAccessibilityService · Active Window Nodes
                      </p>
                      <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                        {androidState.accessibleNodes.map((n) => (
                          <div
                            key={n.nodeId}
                            className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="truncate">
                              <span className="font-mono text-indigo-300">{n.nodeId}</span>
                              <p className="text-slate-300 truncate">{n.text}</p>
                            </div>
                            {n.clickable && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleExecuteCapability('tap_accessible_element', {
                                    nodeId: n.nodeId,
                                  })
                                }
                                className="px-2 py-1 rounded bg-indigo-600 text-white text-[10px] shrink-0"
                              >
                                Click Node
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: ANDROID RUNTIME BACKEND URL SETUP (Mirrors MainActivity.kt Tab 2) */}
                {androidTab === 'ServerUrl' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          ADK Backend Server URL (Jetpack DataStore)
                        </span>
                        <ShieldCheck className="w-4 h-4 text-teal-400" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Mirrors <code className="text-indigo-300">BackendPreferencesRepository.kt</code> in the Android app. Switch between USB <code className="text-teal-300">adb reverse</code>, Wi-Fi LAN IP, or Emulator without rebuilding the APK:
                      </p>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setBackendHttpUrl('http://127.0.0.1:8000');
                            setBackendWsUrl('ws://127.0.0.1:8000');
                            setConnectionBanner(
                              'Saved USB adb reverse URL: ws://127.0.0.1:8000/ws/live/shaurya'
                            );
                          }}
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-teal-400 text-[11px] text-center"
                        >
                          USB adb
                          <span className="block font-mono text-[10px] text-teal-400">
                            127.0.0.1
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBackendHttpUrl('http://192.168.1.42:8000');
                            setBackendWsUrl('ws://192.168.1.42:8000');
                            setConnectionBanner(
                              'Saved Wi-Fi LAN URL: ws://192.168.1.42:8000/ws/live/shaurya'
                            );
                          }}
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-[11px] text-center"
                        >
                          Wi-Fi LAN
                          <span className="block font-mono text-[10px] text-amber-400">
                            192.168.1.42
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBackendHttpUrl('http://10.0.2.2:8000');
                            setBackendWsUrl('ws://10.0.2.2:8000');
                            setConnectionBanner(
                              'Saved Emulator URL: ws://10.0.2.2:8000/ws/live/shaurya'
                            );
                          }}
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-400 text-[11px] text-center"
                        >
                          Emulator
                          <span className="block font-mono text-[10px] text-indigo-400">
                            10.0.2.2
                          </span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Backend HTTP URL (AETHER_BACKEND_HTTP_URL)
                          </label>
                          <input
                            type="text"
                            value={backendHttpUrl}
                            onChange={(e) => setBackendHttpUrl(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Backend WebSocket URL (AETHER_BACKEND_WS_URL)
                          </label>
                          <input
                            type="text"
                            value={backendWsUrl}
                            onChange={(e) => setBackendWsUrl(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            AETHER_API_TOKEN
                          </label>
                          <input
                            type="text"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setConnectionBanner(
                            `Reconnected OkHttp WebSocket to ${backendWsUrl}/ws/live/shaurya`
                          )
                        }
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Save to DataStore & Reconnect WebSocket</span>
                      </button>

                      <p className="text-[11px] font-mono text-teal-300">{connectionBanner}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Material 3 Android Bottom Navigation Bar */}
              <div className="px-2 py-2 bg-[#0B101E] border-t border-slate-800/90 grid grid-cols-5 gap-1">
                {(
                  [
                    { id: 'AriaLive', label: 'Aria Live', icon: Sparkles },
                    { id: 'VoiceChat', label: 'Voice/Chat', icon: MessageSquare },
                    { id: 'Memories', label: 'Memories', icon: Brain },
                    { id: 'PhoneBridge', label: 'Phone UI', icon: Smartphone },
                    { id: 'ServerUrl', label: 'Server URL', icon: Settings },
                  ] as { id: AndroidBottomTab; label: string; icon: React.FC<{ className?: string }> }[]
                ).map((item) => {
                  const Icon = item.icon;
                  const active = androidTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAndroidTab(item.id)}
                      className={`py-1.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                        active
                          ? 'bg-indigo-600/25 text-indigo-300 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Android 15 Gesture Pill */}
              <div className="py-2 bg-[#070A12] flex justify-center">
                <div className="w-32 h-1 rounded-full bg-slate-700" />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (7 cols): GIT PUSH, ANDROID STUDIO & BACKEND URL SETUP WORKBENCH + EXPANDED INSPECTORS */}
          <div className="lg:col-span-7 space-y-5">
            {workbenchTab === 'AndroidStudioSetup' && (
              <AndroidStudioSetupPanel
                backendHttpUrl={backendHttpUrl}
                backendWsUrl={backendWsUrl}
                apiToken={apiToken}
                onUpdateBackendConfig={(http, ws, tok) => {
                  setBackendHttpUrl(http);
                  setBackendWsUrl(ws);
                  setApiToken(tok);
                  setConnectionBanner(`Synced URL: ${ws}/ws/live/shaurya`);
                }}
              />
            )}

            {workbenchTab === 'ExpandedVoice' && (
              <ConversationView
                character={character}
                personality={personality}
                messages={conversation}
                lifeState={lifeState}
                onTransitionLifeScene={(sceneId) => handleTransitionLifeScene(sceneId)}
                onSendMessage={handleSendMessage}
                onUpdateAnimation={(st) =>
                  setCharacter((prev) => ({ ...prev, currentAnimation: st }))
                }
                onUpdateLanguage={(lang) =>
                  setPersonality((prev) => ({ ...prev, preferredLanguage: lang }))
                }
              />
            )}

            {workbenchTab === 'ExpandedMemories' && (
              <MemoriesView
                memoryStore={memoryStore}
                onCreateMemory={handleCreateMemory}
                onUpdateMemory={handleUpdateMemory}
                onDeleteMemory={handleDeleteMemory}
                onCreateRelationship={handleCreateRelationship}
              />
            )}

            {workbenchTab === 'ExpandedPhone' && (
              <PhoneView
                androidState={androidState}
                onExecuteCapability={handleExecuteCapability}
                onUpdatePermissions={handleUpdatePermissions}
                onTriggerAndroidEvent={handleTriggerAndroidEvent}
              />
            )}

            {workbenchTab === 'ExpandedCharacter' && (
              <CharacterView
                character={character}
                personality={personality}
                lifeState={lifeState}
                onTransitionLifeScene={(sceneId) => handleTransitionLifeScene(sceneId)}
                onSaveCharacterAndPersonality={handleSaveCharacterAndPersonality}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
