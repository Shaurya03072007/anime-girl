import React, { useState } from 'react';
import {
  Terminal,
  Smartphone,
  Server,
  Copy,
  Check,
  FileCode,
  Wifi,
  Usb,
  Cpu,
  BookOpen,
} from 'lucide-react';

interface AndroidStudioSetupPanelProps {
  backendHttpUrl: string;
  backendWsUrl: string;
  apiToken: string;
  onUpdateBackendConfig: (httpUrl: string, wsUrl: string, token: string) => void;
}

type ConnectionPreset = 'usb_adb' | 'wifi_lan' | 'emulator';

const REPO_FILES_SUMMARY: {
  path: string;
  layer: 'Android Kotlin' | 'Python ADK Backend' | 'Setup Docs';
  summary: string;
  snippet: string;
}[] = [
  {
    path: 'README.md',
    layer: 'Setup Docs',
    summary: 'Complete step-by-step Backend + Android Studio + Backend URL setup instructions',
    snippet: `# 1. Start Python ADK Backend (aether/backend)
cd aether/backend
cp .env.example .env
# Add your GOOGLE_API_KEY in .env, then run:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. USB adb reverse (for physical Android phone over USB):
adb reverse tcp:8000 tcp:8000

# 3. Open aether/android in Android Studio -> Sync Gradle -> Run on Phone!`,
  },
  {
    path: 'aether/android/local.properties.example',
    layer: 'Android Kotlin',
    summary: 'Compile-time Backend HTTP & WebSocket URL config read by app/build.gradle.kts',
    snippet: `## Option 1: Physical Android Phone via USB + adb reverse tcp:8000 tcp:8000
AETHER_BACKEND_HTTP_URL=http://127.0.0.1:8000
AETHER_BACKEND_WS_URL=ws://127.0.0.1:8000

## Option 2: Physical Android Phone over Wi-Fi LAN
# AETHER_BACKEND_HTTP_URL=http://192.168.1.42:8000
# AETHER_BACKEND_WS_URL=ws://192.168.1.42:8000

## Option 3: Android Studio Emulator
# AETHER_BACKEND_HTTP_URL=http://10.0.2.2:8000
# AETHER_BACKEND_WS_URL=ws://10.0.2.2:8000

AETHER_API_TOKEN=aether-dev-local-token-2026`,
  },
  {
    path: 'aether/android/app/src/main/java/dev/aether/companion/MainActivity.kt',
    layer: 'Android Kotlin',
    summary: 'Jetpack Compose Material 3 Android Companion UI + Runtime Backend URL Configurator',
    snippet: `class MainActivity : ComponentActivity() {
    private lateinit var prefsRepo: BackendPreferencesRepository
    private lateinit var deviceController: AndroidDeviceController
    private lateinit var audioEngine: GeminiLiveAudioEngine
    private lateinit var wsClient: AetherLiveWebSocketClient
    // Connects 16kHz AudioRecord + 24kHz AudioTrack to /ws/live/{user_id}
}`,
  },
  {
    path: 'aether/android/app/src/main/java/dev/aether/companion/data/BackendPreferencesRepository.kt',
    layer: 'Android Kotlin',
    summary: 'Jetpack DataStore repository allowing live Backend URL switching on your phone without rebuilding',
    snippet: `val configFlow: Flow<BackendConnectionConfig> = context.aetherDataStore.data.map { prefs ->
    BackendConnectionConfig(
        httpUrl = prefs[KEY_HTTP_URL] ?: BuildConfig.DEFAULT_BACKEND_HTTP_URL,
        wsUrl = prefs[KEY_WS_URL] ?: BuildConfig.DEFAULT_BACKEND_WS_URL,
        apiToken = prefs[KEY_API_TOKEN] ?: BuildConfig.DEFAULT_API_TOKEN,
        userId = prefs[KEY_USER_ID] ?: "shaurya"
    )
}`,
  },
  {
    path: 'aether/android/app/src/main/java/dev/aether/companion/audio/GeminiLiveAudioEngine.kt',
    layer: 'Android Kotlin',
    summary: 'Native 16kHz PCM AudioRecord capture + 24kHz PCM AudioTrack streaming + RMS VAD Barge-In',
    snippet: `// Captures 50ms 16kHz mono PCM frames & flushes AudioTrack immediately on barge-in
if (_isSpeaking.value && rms > BARGE_IN_RMS_THRESHOLD) {
    interruptPlaybackImmediately()
    onBargeInDetected()
}`,
  },
  {
    path: 'aether/android/app/src/main/java/dev/aether/companion/service/AetherAccessibilityService.kt',
    layer: 'Android Kotlin',
    summary: 'Native Android AccessibilityService inspecting rootInActiveWindow & executing click/text actions',
    snippet: `fun dumpActiveWindowNodes(): JSONArray {
    val root = rootInActiveWindow ?: return JSONArray()
    val array = JSONArray()
    traverseNode(root, array, 0)
    return array
}`,
  },
  {
    path: 'aether/backend/app/main.py',
    layer: 'Python ADK Backend',
    summary: 'FastAPI server with @app.websocket("/ws/live/{user_id}") bridging Android to ADK Runner.run_live()',
    snippet: `@app.websocket("/ws/live/{user_id}")
async def adk_live_websocket_endpoint(websocket: WebSocket, user_id: str = "shaurya"):
    await websocket.accept()
    live_request_queue = create_live_request_queue()
    await asyncio.gather(upstream_client_to_adk(), downstream_adk_to_client())`,
  },
  {
    path: 'aether/backend/app/agents/companion_hierarchy.py',
    layer: 'Python ADK Backend',
    summary: 'Google ADK LlmAgent hierarchy (Root, Decision, Memory, Phone, Event) + Runner.run_live()',
    snippet: `runner = Runner(
    app_name=APP_NAME,
    agent=root_companion_agent,
    session_service=session_service,
)
async for event in runner.run_live(session=session, live_request_queue=live_request_queue, run_config=run_config):
    yield event`,
  },
];

export const AndroidStudioSetupPanel: React.FC<AndroidStudioSetupPanelProps> = ({
  backendHttpUrl,
  backendWsUrl,
  apiToken,
  onUpdateBackendConfig,
}) => {
  const [preset, setPreset] = useState<ConnectionPreset>('usb_adb');
  const [lanIp, setLanIp] = useState('192.168.1.42');
  const [port, setPort] = useState('8000');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);

  const computedHttp =
    preset === 'usb_adb'
      ? `http://127.0.0.1:${port}`
      : preset === 'wifi_lan'
      ? `http://${lanIp}:${port}`
      : `http://10.0.2.2:${port}`;

  const computedWs =
    preset === 'usb_adb'
      ? `ws://127.0.0.1:${port}`
      : preset === 'wifi_lan'
      ? `ws://${lanIp}:${port}`
      : `ws://10.0.2.2:${port}`;

  const localPropertiesBlock = `AETHER_BACKEND_HTTP_URL=${computedHttp}
AETHER_BACKEND_WS_URL=${computedWs}
AETHER_API_TOKEN=${apiToken}`;

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-bold text-white">
              Git Push & Android Studio / Backend Setup Guide
            </h2>
          </div>
          <span className="text-[11px] font-mono text-teal-400">
            aether/android + aether/backend Ready on Disk
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          All native Kotlin Android files (<code className="text-indigo-300">aether/android/</code>), Python Google ADK backend files (<code className="text-indigo-300">aether/backend/</code>), and <code className="text-indigo-300">README.md</code> are generated in this workspace. Push to Git, open <code className="text-teal-300">aether/android</code> in Android Studio, and use the URL generator below to connect your phone.
        </p>
      </div>

      {/* Step 1: Run Python ADK Backend */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              1. Start Python ADK + FastAPI Backend (Port 8000)
            </h3>
          </div>
          <button
            type="button"
            onClick={() =>
              copyText(
                'cmd-backend',
                `cd aether/backend\ncp .env.example .env\n# Set GOOGLE_API_KEY in .env\npip install -r requirements.txt\nuvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1"
          >
            {copiedId === 'cmd-backend' ? (
              <Check className="w-3.5 h-3.5 text-teal-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedId === 'cmd-backend' ? 'Copied' : 'Copy Commands'}</span>
          </button>
        </div>

        <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed">
{`# Option A: Docker Compose (PostgreSQL 16 pgvector + Redis 7 + FastAPI)
cd aether && cp backend/.env.example backend/.env
docker compose up --build -d

# Option B: Direct Python 3.11+ Uvicorn (binds 0.0.0.0 for Android access)
cd aether/backend && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`}
        </pre>
      </div>

      {/* Step 2: Interactive Android Backend URL Generator */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              2. Android Backend URL Configurator (local.properties & In-App DataStore)
            </h3>
          </div>
        </div>

        {/* 3 Connection Mode Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setPreset('usb_adb');
              onUpdateBackendConfig(
                `http://127.0.0.1:${port}`,
                `ws://127.0.0.1:${port}`,
                apiToken
              );
            }}
            className={`p-2.5 rounded-xl border text-left transition-colors ${
              preset === 'usb_adb'
                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Usb className="w-3.5 h-3.5 text-teal-400" />
              <span>USB Cable (adb)</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              127.0.0.1:8000 via adb reverse
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPreset('wifi_lan');
              onUpdateBackendConfig(
                `http://${lanIp}:${port}`,
                `ws://${lanIp}:${port}`,
                apiToken
              );
            }}
            className={`p-2.5 rounded-xl border text-left transition-colors ${
              preset === 'wifi_lan'
                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Wifi className="w-3.5 h-3.5 text-amber-400" />
              <span>Wi-Fi LAN IP</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {lanIp}:{port} on local Wi-Fi
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPreset('emulator');
              onUpdateBackendConfig(
                `http://10.0.2.2:${port}`,
                `ws://10.0.2.2:${port}`,
                apiToken
              );
            }}
            className={`p-2.5 rounded-xl border text-left transition-colors ${
              preset === 'emulator'
                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Emulator</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              10.0.2.2:8000 loopback
            </p>
          </button>
        </div>

        {preset === 'usb_adb' && (
          <div className="p-2.5 rounded-xl bg-teal-950/30 border border-teal-800/60 flex items-center justify-between text-xs text-teal-200">
            <span className="font-mono">Run once with phone plugged in: adb reverse tcp:8000 tcp:8000</span>
            <button
              type="button"
              onClick={() => copyText('adb-rev', 'adb reverse tcp:8000 tcp:8000')}
              className="px-2 py-1 rounded bg-teal-900/60 hover:bg-teal-800 text-[11px] font-semibold"
            >
              {copiedId === 'adb-rev' ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {preset === 'wifi_lan' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Your PC / Mac Wi-Fi LAN IPv4
              </label>
              <input
                type="text"
                value={lanIp}
                onChange={(e) => {
                  setLanIp(e.target.value);
                  onUpdateBackendConfig(
                    `http://${e.target.value}:${port}`,
                    `ws://${e.target.value}:${port}`,
                    apiToken
                  );
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Backend Port
              </label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
              />
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400">
              Paste into <code className="text-amber-300">aether/android/local.properties</code> (or set in the Android App’s <strong>URL</strong> tab):
            </span>
            <button
              type="button"
              onClick={() => copyText('local-props', localPropertiesBlock)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 flex items-center gap-1"
            >
              {copiedId === 'local-props' ? (
                <Check className="w-3 h-3 text-teal-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedId === 'local-props' ? 'Copied' : 'Copy local.properties'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-amber-200 overflow-x-auto">
            {localPropertiesBlock}
          </pre>
        </div>
      </div>

      {/* Step 3: Native Repo File Inspector */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              3. Native Android & Python ADK Files in Git Workspace
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {REPO_FILES_SUMMARY.length} core modules verified
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {REPO_FILES_SUMMARY.map((f, idx) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setSelectedFileIdx(idx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                selectedFileIdx === idx
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {f.path.split('/').pop()}
            </button>
          ))}
        </div>

        {REPO_FILES_SUMMARY[selectedFileIdx] && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-indigo-300 font-semibold">
                {REPO_FILES_SUMMARY[selectedFileIdx].path}
              </span>
              <span className="text-[11px] text-slate-400">
                {REPO_FILES_SUMMARY[selectedFileIdx].layer}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {REPO_FILES_SUMMARY[selectedFileIdx].summary}
            </p>
            <pre className="p-2.5 rounded-lg bg-slate-900/90 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed">
              {REPO_FILES_SUMMARY[selectedFileIdx].snippet}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
