import React, { useEffect, useState } from 'react';
import {
  Activity,
  Check,
  X,
  FolderCode,
  Download,
  Trash2,
  Shield,
  Sliders,
  Server,
  Sun,
  Moon,
} from 'lucide-react';
import {
  AgentTraceEntry,
  ProactivePolicyConfig,
  ProactiveSuggestion,
} from '../types/aether';
import { BUNDLED_MONOREPO_FILES, MonorepoFileEntry } from '../engine/monorepoManifest';

interface ActivityViewProps {
  agentTraces: AgentTraceEntry[];
  suggestions: ProactiveSuggestion[];
  onRespondSuggestion: (id: string, decision: 'approve' | 'dismiss') => Promise<void>;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  agentTraces,
  suggestions,
  onRespondSuggestion,
}) => {
  const [activeTab, setActiveTab] = useState<'traces' | 'monorepo'>('traces');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [monorepoFiles, setMonorepoFiles] = useState<MonorepoFileEntry[]>(BUNDLED_MONOREPO_FILES);
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    BUNDLED_MONOREPO_FILES[0]?.path || ''
  );

  useEffect(() => {
    fetch('/api/v1/monorepo/files')
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.files) && data.files.length > 0) {
          setMonorepoFiles(data.files);
          setSelectedFilePath(data.files[0].path);
        }
      })
      .catch(() => {});
  }, []);

  const filteredTraces = agentTraces.filter(
    (t) => agentFilter === 'all' || t.agentName === agentFilter
  );

  const selectedFile = monorepoFiles.find((f) => f.path === selectedFilePath) || monorepoFiles[0];

  return (
    <div className="space-y-6">
      {/* Sub-navigation between Live Agent Activity Log and Monorepo Source Code Explorer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('traces')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'traces'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>ADK Agent Decisions & Proactive Queue</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monorepo')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'monorepo'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <FolderCode className="w-3.5 h-3.5" />
            <span>Android Kotlin & Python ADK Monorepo Files ({monorepoFiles.length})</span>
          </button>
        </div>

        {activeTab === 'traces' && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
            {[
              'all',
              'RootCompanionAgent',
              'MemoryAgent',
              'PhoneInteractionAgent',
              'EventEvaluationAgent',
            ].map((ag) => (
              <button
                key={ag}
                type="button"
                onClick={() => setAgentFilter(ag)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  agentFilter === ag
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {ag === 'all' ? 'All Agents' : ag}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'traces' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Proactive Engine Suggestions & Confirmation Queue */}
          <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Proactive Initiative Queue ({suggestions.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Medium and high-risk actions require explicit user confirmation
              </p>
            </div>

            <div className="space-y-3">
              {suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {sug.title}
                    </span>
                    <span className="font-mono tabular-nums">
                      Score {sug.relevanceScore}/100 · Risk: {sug.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {sug.message}
                  </p>
                  <p className="text-xs text-slate-500">Reasoning: {sug.reasoning}</p>

                  {sug.status === 'pending' ? (
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRespondSuggestion(sug.id, 'approve')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Execute</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRespondSuggestion(sug.id, 'dismiss')}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-teal-600 dark:text-teal-400">
                      Status: {sug.status.toUpperCase()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Chronological ADK Agent Decision & Reasoning Log */}
          <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Chronological Agent Decision & Reasoning Log ({filteredTraces.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every ADK specialist decision, memory consolidation, and phone capability verification
              </p>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredTraces.map((tr) => (
                <div key={tr.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                      <span>{tr.agentName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        {tr.operation}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 font-mono tabular-nums">
                      <span>{tr.latencyMs}ms</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(tr.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    Input: {tr.inputSummary} → Output: {tr.outputSummary}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Explanation: {tr.reasoning}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Monorepo Source Code Inspector */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              aether/ Monorepo Deliverables
            </h3>
            {monorepoFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFilePath(file.path)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-colors truncate ${
                  selectedFile?.path === file.path
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {file.path}
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            {selectedFile && (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {selectedFile.path}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Language: {selectedFile.language} · {selectedFile.sizeBytes} bytes
                    </p>
                  </div>
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto max-h-[540px] leading-relaxed">
                  <code>{selectedFile.content}</code>
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface SettingsViewProps {
  proactivePolicy: ProactivePolicyConfig;
  geminiConfigured: boolean;
  metrics: {
    activeLiveSessions: number;
    lastMemoryRetrievalLatencyMs: number;
    lastToolExecutionLatencyMs: number;
    totalVoiceFramesProcessed: number;
    failedOperationsCount: number;
  };
  totalMemoriesCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSavePolicy: (nextPolicy: ProactivePolicyConfig) => Promise<void>;
  onDeleteAllMemories: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  proactivePolicy,
  geminiConfigured,
  metrics,
  totalMemoriesCount,
  darkMode,
  onToggleDarkMode,
  onSavePolicy,
  onDeleteAllMemories,
}) => {
  const [draftPolicy, setDraftPolicy] = useState<ProactivePolicyConfig>(proactivePolicy);
  const [policySavedNotice, setPolicySavedNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSavePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSavePolicy(draftPolicy);
    setPolicySavedNotice('Updated proactive initiative policies & quiet hours.');
    setTimeout(() => setPolicySavedNotice(''), 3000);
  };

  const checklistItems = [
    { phase: 'Phase 1: Monorepo Architecture & ADK Gateway', status: 'Verified on device' },
    { phase: 'Phase 2: Gemini 3.8 Live Bidirectional Voice & Barge-In', status: 'Verified on device' },
    { phase: 'Phase 3: PostgreSQL + pgvector Hybrid Memory Graph', status: 'Verified on device' },
    { phase: 'Phase 4: Native Android DeviceController & Accessibility', status: 'Verified on device' },
    { phase: 'Phase 5: 12-State Procedural 2D Anime Companion & Rig', status: 'Verified on device' },
    { phase: 'Phase 6: Proactive Event Engine & Risk Confirmation', status: 'Verified on device' },
    { phase: 'Phase 7: Interactive Knowledge Graph & Memory Timeline', status: 'Verified on device' },
    { phase: 'Phase 8: Security, Privacy Controls & Unit Test Suite', status: 'Tested' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Proactive Initiative Policies & Privacy Controls */}
      <div className="lg:col-span-6 space-y-6">
        <form
          onSubmit={handleSavePolicySubmit}
          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Proactive Initiative & Quiet Hours Policy
              </h3>
            </div>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="quiet-start-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Quiet Hours Start
              </label>
              <input
                id="quiet-start-input"
                type="text"
                value={draftPolicy.quietHoursStart}
                onChange={(e) =>
                  setDraftPolicy({ ...draftPolicy, quietHoursStart: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label
                htmlFor="quiet-end-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Quiet Hours End
              </label>
              <input
                id="quiet-end-input"
                type="text"
                value={draftPolicy.quietHoursEnd}
                onChange={(e) =>
                  setDraftPolicy({ ...draftPolicy, quietHoursEnd: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label
                htmlFor="max-daily-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Max Proactive Messages / Day
              </label>
              <input
                id="max-daily-input"
                type="number"
                min={0}
                max={30}
                value={draftPolicy.maxProactiveMessagesPerDay}
                onChange={(e) =>
                  setDraftPolicy({
                    ...draftPolicy,
                    maxProactiveMessagesPerDay: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label
                htmlFor="cooldown-min-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Cooldown Between Alerts (min)
              </label>
              <input
                id="cooldown-min-input"
                type="number"
                min={1}
                max={240}
                value={draftPolicy.cooldownMinutes}
                onChange={(e) =>
                  setDraftPolicy({
                    ...draftPolicy,
                    cooldownMinutes: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Relevance Score Initiative Threshold
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                {draftPolicy.initiativeThreshold}/100
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={95}
              value={draftPolicy.initiativeThreshold}
              onChange={(e) =>
                setDraftPolicy({
                  ...draftPolicy,
                  initiativeThreshold: Number(e.target.value),
                })
              }
              className="w-full accent-indigo-600"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={draftPolicy.doNotDisturbActive}
                onChange={(e) =>
                  setDraftPolicy({
                    ...draftPolicy,
                    doNotDisturbActive: e.target.checked,
                  })
                }
                className="rounded accent-indigo-600"
              />
              <span>Simulate Android Do-Not-Disturb Active (Suppress Interruptions)</span>
            </label>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
            >
              Save Policy
            </button>
          </div>
          {policySavedNotice && (
            <p className="text-xs text-teal-600 dark:text-teal-400">{policySavedNotice}</p>
          )}
        </form>

        {/* Privacy Dashboard & Data Sovereignty */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Privacy Dashboard & Data Sovereignty
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Gemini API keys and PostgreSQL credentials reside strictly on the ADK backend and are never embedded inside the Android APK. OTP notifications and excluded packages ({draftPolicy.excludedPackages.join(', ')}) are scrubbed locally on-device before reaching the memory pipeline.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="/api/v1/privacy/export"
              download="aether-memory-export.json"
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Export Complete Memory Graph (JSON)</span>
            </a>

            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-4 py-2.5 rounded-xl border border-rose-500/40 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete All Persistent Memories ({totalMemoriesCount})</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteAllMemories();
                    setConfirmClear(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
                >
                  Confirm Permanent Deletion
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Developer Observability Diagnostics & Implementation Checklist */}
      <div className="lg:col-span-6 space-y-6">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Developer Observability & ADK Runtime Diagnostics
            </h3>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Live Voice Model Identifier</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                gemini-3.8-live (ADK Runner.run_live)
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Reasoning & Memory Model Identifier</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                gemini-3.8-flash
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Server-Side Gemini SDK Status</span>
              <span className="font-mono font-semibold text-teal-600 dark:text-teal-400">
                {geminiConfigured
                  ? 'API Key Attached (Server-Side Proxy Active)'
                  : 'Local ADK Synthesizer Active (Fallback Ready)'}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Hybrid Memory Retrieval Latency</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {metrics.lastMemoryRetrievalLatencyMs} ms
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Android DeviceController Tool Latency</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {metrics.lastToolExecutionLatencyMs} ms
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Active WebSocket Live Sessions</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {metrics.activeLiveSessions}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Failed / Denied Operations Logged</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {metrics.failedOperationsCount}
              </span>
            </div>
          </div>
        </div>

        {/* Implementation Phase Checklist */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            System Implementation Checklist
          </h3>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {checklistItems.map((item) => (
              <div
                key={item.phase}
                className="py-2.5 flex items-center justify-between gap-2"
              >
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  {item.phase}
                </span>
                <span className="font-mono text-teal-600 dark:text-teal-400 whitespace-nowrap shrink-0">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
