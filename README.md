# Project Aether — Living AI Companion Ecosystem for Android (Aria)

Project Aether is a complete, production-oriented AI companion ecosystem consisting of:
1. **Native Android Application (`aether/android/`)**: Built with **Kotlin 2.1, Jetpack Compose, Material 3, Coroutines/StateFlow, OkHttp WebSockets, Jetpack DataStore, Room, WorkManager, `AudioRecord` (16kHz PCM) / `AudioTrack` (24kHz PCM), `AccessibilityService`, and `NotificationListenerService`**.
2. **Google ADK + FastAPI Backend (`aether/backend/`)**: Built with **Python 3.11+, Google Agent Development Kit (`google-adk`), `Runner.run_live()`, `LiveRequestQueue`, FastAPI WebSockets, PostgreSQL 16 + `pgvector` (HNSW hybrid vector + knowledge graph), and Redis 7**.
3. **Interactive Android Companion & Architecture Sandbox (`src/` + `server.ts`)**: Live Android 15 (Pixel 9 Pro) device companion interface with studio-grade 2.5D interactive anime heroine **Aria**, bilingual English + Telugu voice/text streaming, hybrid memory graph, native Android device bridge, and an in-app **Android Studio & Backend Setup Inspector**.

---

## Repository Structure

```text
.
├── README.md                          # Complete Setup Guide (Backend + Android URL Setup)
├── aether/
│   ├── docker-compose.yml             # PostgreSQL 16 (pgvector) + Redis 7 + FastAPI ADK Backend
│   ├── backend/                       # Python 3.11 Google ADK + FastAPI Backend
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── .env.example
│   │   ├── migrations/
│   │   │   └── 001_initial_pgvector_schema.sql
│   │   └── app/
│   │       ├── main.py                # FastAPI + @app.websocket("/ws/live/{user_id}")
│   │       ├── config.py              # Environment & Gemini model settings
│   │       ├── db.py                  # Async SQLAlchemy + pgvector setup
│   │       ├── models.py              # MemoryRecordORM, KnowledgeEntityORM, RelationshipORM
│   │       ├── agents/
│   │       │   └── companion_hierarchy.py # Root, Decision, Memory, Phone & Event ADK Agents
│   │       └── services/
│   │           ├── memory_service.py  # Hybrid Vector + Full-Text + Graph Retrieval
│   │           └── proactive_service.py # Privacy scrubber, OTP filter, relevance scorer
│   └── android/                       # Native Kotlin + Jetpack Compose Android Studio Project
│       ├── settings.gradle.kts
│       ├── build.gradle.kts
│       ├── gradle.properties
│       ├── local.properties.example   # Backend HTTP & WebSocket URL configuration template
│       └── app/
│           ├── build.gradle.kts
│           └── src/main/
│               ├── AndroidManifest.xml
│               ├── res/
│               └── java/dev/aether/companion/
│                   ├── MainActivity.kt
│                   ├── audio/GeminiLiveAudioEngine.kt
│                   ├── data/BackendPreferencesRepository.kt
│                   ├── device/AndroidDeviceController.kt
│                   ├── network/AetherLiveWebSocketClient.kt
│                   └── service/
│                       ├── AetherAccessibilityService.kt
│                       └── AetherNotificationListener.kt
└── src/                               # Interactive Android 15 Companion Preview & Code Inspector
```

---

## Step 1: Running the Python Google ADK Backend (`aether/backend/`)

Never place your `GEMINI_API_KEY` or database credentials inside the Android APK. All LLM/Live sessions and pgvector queries run on the backend.

### Option A: Run with Docker Compose (Recommended — Starts Postgres + pgvector, Redis, and FastAPI)

1. Open a terminal and navigate to `aether/`:
   ```bash
   cd aether
   cp backend/.env.example backend/.env
   ```
2. Edit `aether/backend/.env` and set your Gemini API key:
   ```env
   GOOGLE_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
   GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
   GEMINI_LIVE_MODEL="gemini-2.5-flash-native-audio-preview-12-2025"
   GEMINI_REASONING_MODEL="gemini-2.5-flash"
   AETHER_API_TOKEN="aether-dev-local-token-2026"
   ```
   *(Note: If your Google Cloud / AI Studio account has access to `gemini-3.8-live` and `gemini-3.8-flash`, set `GEMINI_LIVE_MODEL="gemini-3.8-live"` and `GEMINI_REASONING_MODEL="gemini-3.8-flash"` in `.env`.)*

3. Start the stack:
   ```bash
   docker compose up --build -d
   ```
4. Verify the backend is healthy:
   ```bash
   curl http://localhost:8000/api/v1/health
   ```

### Option B: Run Backend Directly with Local Python 3.11+

1. Create a virtual environment and install dependencies:
   ```bash
   cd aether/backend
   python3.11 -m venv .venv
   source .venv/bin/activate   # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   ```
2. Put your `GOOGLE_API_KEY` in `.env`, then start Uvicorn bound to `0.0.0.0` (so your physical Android phone can reach it):
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

---

## Step 2: Configuring the Backend URL in the Android App (`aether/android/`)

You can connect your Android app to the backend in **two ways**:
- **At Compile Time** via `aether/android/local.properties`
- **At Runtime inside the Android App** via the **Backend URL** tab (persisted via Jetpack DataStore — no rebuild required when switching networks!).

### Choose Your Connection Mode:

#### Mode 1: Physical Android Phone Connected via USB Cable (Recommended & Fastest)
Use `adb reverse` so your phone's `127.0.0.1:8000` tunnels directly to your computer's `localhost:8000` over USB (works even on restricted Wi-Fi or mobile hotspot):
```bash
adb reverse tcp:8000 tcp:8000
```
Then set these URLs (either in `aether/android/local.properties` or in the Android app's **Backend URL** tab):
- **Backend HTTP URL**: `http://127.0.0.1:8000`
- **Backend WebSocket URL**: `ws://127.0.0.1:8000`

#### Mode 2: Physical Android Phone over Same Wi-Fi Network (LAN IP)
1. Find your computer's local LAN IPv4 address:
   - **macOS / Linux**: `ifconfig | grep "inet "` or `ip addr` (e.g., `192.168.1.42`)
   - **Windows**: `ipconfig` (look for IPv4 Address, e.g., `192.168.1.42`)
2. Make sure your backend is running with `--host 0.0.0.0 --port 8000`.
3. Set these URLs in `aether/android/local.properties` (or inside the app's **Backend URL** tab):
   ```properties
   AETHER_BACKEND_HTTP_URL=http://192.168.1.42:8000
   AETHER_BACKEND_WS_URL=ws://192.168.1.42:8000
   AETHER_API_TOKEN=aether-dev-local-token-2026
   ```

#### Mode 3: Android Studio Emulator
The Android Emulator routes `10.0.2.2` to your host machine's `127.0.0.1`:
```properties
AETHER_BACKEND_HTTP_URL=http://10.0.2.2:8000
AETHER_BACKEND_WS_URL=ws://10.0.2.2:8000
AETHER_API_TOKEN=aether-dev-local-token-2026
```

#### Mode 4: Cloud Run / Hosted HTTPS Backend
If you deploy `aether/backend` to Cloud Run or another HTTPS host (e.g. `https://aether-backend-xyz.run.app`):
- **Backend HTTP URL**: `https://aether-backend-xyz.run.app`
- **Backend WebSocket URL**: `wss://aether-backend-xyz.run.app`

---

## Step 3: Building & Running in Android Studio

1. Open **Android Studio (Ladybug / Meerkat or newer)**.
2. Click **Open** and select the **`aether/android`** folder (do **not** open the root web directory; open `aether/android` so Gradle detects `settings.gradle.kts`).
3. Copy `local.properties.example` to `local.properties` inside `aether/android/` (or let Android Studio generate `local.properties` with your `sdk.dir` and append `AETHER_BACKEND_HTTP_URL` and `AETHER_BACKEND_WS_URL`).
4. Click **Sync Project with Gradle Files**.
5. Connect your physical Android phone (API 29+ / Android 10–15) or start an emulator, and click **Run (`Shift+F10`)**.
6. Once installed on your phone:
   - Tap **Start Live Voice** and grant **Microphone (`RECORD_AUDIO`)** permission to stream 16kHz PCM audio to Aria and hear 24kHz PCM voice responses with real-time barge-in.
   - Open the **Phone Bridge** tab to grant **Accessibility Service (`AetherAccessibilityService`)** and **Notification Access (`AetherNotificationListener`)** so Aria can inspect allowed UI screens and observe non-excluded notifications.
   - Open the **Backend URL** tab anytime on your phone to switch between `ws://127.0.0.1:8000`, your Wi-Fi LAN IP `ws://192.168.x.x:8000`, or a remote `wss://` server on the fly.
