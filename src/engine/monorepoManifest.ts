export interface MonorepoFileEntry {
  path: string;
  language: string;
  sizeBytes: number;
  content: string;
}

export const BUNDLED_MONOREPO_FILES: MonorepoFileEntry[] = [
  {
    path: 'aether/README.md',
    language: 'markdown',
    sizeBytes: 2140,
    content: `# PROJECT AETHER — A Living AI Companion Ecosystem for Android

Project Aether is a production-oriented AI companion ecosystem combining:
1. Native Android Client (aether/android/): Kotlin 2.1, Jetpack Compose (Material 3), Coroutines/StateFlow, Room + DataStore, AetherAccessibilityService, AetherNotificationListenerService, MediaProjection screen frame observer, and 16kHz/24kHz PCM AudioRecord/AudioTrack WebSocket streaming.
2. Google ADK Backend (aether/backend/): Python 3.11+, Google Agent Development Kit (google-adk) using Runner.run_live() for bidirectional gemini-3.8-live audio streaming and gemini-3.8-flash for multi-agent planning (RootCompanionAgent, DecisionAgent, MemoryAgent, PhoneInteractionAgent, EventEvaluationAgent).
3. Hybrid PostgreSQL + pgvector Memory Graph (aether/backend/app/memory/): Episodic, Semantic, Relational, Procedural, and Temporal memories with HNSW cosine vector search, PostgreSQL full-text search (tsvector), duplicate consolidation, contradiction resolution, and 1-hop entity relationship traversal.`,
  },
  {
    path: 'aether/docker-compose.yml',
    language: 'yaml',
    sizeBytes: 1120,
    content: `version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: aether
      POSTGRES_DB: aether_memory_graph
    ports:
      - "5432:5432"
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  adk-backend:
    build: ./backend
    environment:
      GEMINI_LIVE_MODEL: gemini-3.8-live
      GEMINI_REASONING_MODEL: gemini-3.8-flash
    ports:
      - "8080:8080"`,
  },
  {
    path: 'aether/backend/app/agents/companion_hierarchy.py',
    language: 'python',
    sizeBytes: 3890,
    content: `from google.adk.agents import Agent, LiveRequestQueue
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

LIVE_MODEL_ID = "gemini-3.8-live"
REASONING_MODEL_ID = "gemini-3.8-flash"

root_companion_agent = Agent(
    name="RootCompanionAgent",
    model=LIVE_MODEL_ID,
    description="Primary living companion persona coordinating voice conversation, memory recall, and phone specialists.",
    sub_agents=[memory_specialist_agent, phone_interaction_agent, decision_planning_agent, event_evaluation_agent],
)`,
  },
  {
    path: 'aether/backend/migrations/001_initial_pgvector_schema.sql',
    language: 'sql',
    sizeBytes: 2480,
    content: `CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS memories (
    id VARCHAR(64) PRIMARY KEY,
    content TEXT NOT NULL,
    category VARCHAR(32) NOT NULL,
    epistemic_status VARCHAR(32) NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.9,
    embedding vector(768),
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);
CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw ON memories USING hnsw (embedding vector_cosine_ops);`,
  },
  {
    path: 'aether/android/app/src/main/AndroidManifest.xml',
    language: 'xml',
    sizeBytes: 2150,
    content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="ai.aether.companion">
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <application android:label="Project Aether">
        <service android:name=".service.AetherAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE" />
        <service android:name=".service.AetherNotificationListenerService"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />
    </application>
</manifest>`,
  },
  {
    path: 'aether/android/app/src/main/java/ai/aether/companion/device/AndroidDeviceController.kt',
    language: 'kotlin',
    sizeBytes: 6420,
    content: `package ai.aether.companion.device

class AndroidDeviceController(private val context: Context) {
    suspend fun executeCapability(
        actionId: String,
        capability: String,
        params: Map<String, Any?>
    ): ActionExecutionResult = withContext(Dispatchers.Main) {
        when (capability) {
            "get_battery_status" -> getBatteryStatus(actionId)
            "get_network_status" -> getNetworkStatus(actionId)
            "launch_application" -> launchApplication(actionId, params["packageName"]?.toString().orEmpty())
            "inspect_accessible_ui" -> inspectAccessibleUi(actionId)
            "tap_accessible_element" -> tapAccessibleElement(actionId, params["nodeId"]?.toString().orEmpty())
            else -> executeVerifiedIntent(actionId, capability, params)
        }
    }
}`,
  },
  {
    path: 'aether/android/app/src/main/java/ai/aether/companion/voice/GeminiLiveAudioEngine.kt',
    language: 'kotlin',
    sizeBytes: 3910,
    content: `package ai.aether.companion.voice

class GeminiLiveAudioEngine(
    private val scope: CoroutineScope,
    private val onSendPcmBase64: (String) -> Unit,
    private val onUserBargeInDetected: () -> Unit
) {
    // 16kHz PCM AudioRecord capture & 24kHz PCM AudioTrack playback with instant barge-in interruption
}`,
  },
];
