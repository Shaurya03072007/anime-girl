# Project Aether — Full-Screen 3D Possessed Anime Ghost & Living AI Companion for Android (Aria)

Project Aether is a production-grade, native **Android AI Companion Ecosystem** powered by **Kotlin + Jetpack Compose + Three.js / `@pixiv/three-vrm`** on the device and **Python + Google Agent Development Kit (`google-adk`) + Gemini 3.8 Live (`Runner.run_live()`) + Gemini 3.5 Flash-Lite + Gemma 4 31B (`gemma-4-31b-it`) + PostgreSQL (`pgvector`)** on the backend.

Unlike a card-based chatbot or static avatar, **Aria** is a **full-screen 3D rigged VRM anime spirit** living inside your Android display that roams edge-to-edge across the screen — and even **floats over your home screen and other apps via a System-Wide Transparent Overlay (`SYSTEM_ALERT_WINDOW`)** — dynamically choreographed in real time by **Google ADK** with **Gemma 4 31B (`gemma-4-31b-it`)** and **Gemini 3.8 Live**.

---

## Core Highlights

### 1. Full-Screen 3D Rigged VRM Anime Girl (`aria_anime_girl.vrm`) + System-Wide Ghost Overlay
- **100% Edge-to-Edge 3D Stage (`Aria3DGhostStageView.kt` + `ghost_stage.html`)**: Renders a true 3D rigged humanoid `.vrm` anime character at 60fps with skeletal bone physics (`spine`, `chest`, `neck`, `head`, arms, legs), spring-bone hair/skirt physics, spectral wisp particles, glitch shaders, and real-time 24kHz audio lip-sync visemes (`aa`, `oh`, `ih`).
- **Dynamic 3D Choreography (Zero Fixed Loops)**:
  - Aria does not move on a fixed looping track. When idle, she holds her 3D coordinates in space with subtle breathing.
  - On every response and while speaking, the **ADK `GhostChoreographyAgent` (`gemma-4-31b-it`)** generates unique 3D waypoints, body roll/yaw, head tilts, and arm gestures (`reach_to_glass`, `wave_greet`, `curious_chin`, `zero_g_spread`, `possessed_claw`, `excited_up`) matching the emotional context of what she is saying.
- **10 Possessed Ghost Locomotion Styles (`control_3d_ghost_avatar`)**:
  1. `dynamic_choreography` — Multi-waypoint 3D trajectory generated on the fly by `gemma-4-31b-it`.
  2. `rush_to_glass` — Supernatural high-speed dash right up against the phone glass (`z = +1.26`) so her face fills the screen and stares at you.
  3. `ceiling_hang_upside_down` — Flips 180° upside-down (`roll = π`) and hangs from the top status bar of your phone display.
  4. `peek_left_edge` — Phases off the left bezel and peeks sideways from the left edge of the screen.
  5. `peek_right_edge` — Phases off the right bezel and peeks sideways from the right edge of the screen.
  6. `orbit_screen` — Glides across multiple perimeter screen quadrants.
  7. `glitch_teleport` — Flickers with chromatic aberration afterimages and teleports rapidly across screen coordinates.
  8. `possessed_head_tilt` — Approaches close to the glass with an eerie 42° supernatural head tilt.
  9. `possessed_levitate_spin` — Zero-gravity 360° levitation spin surrounded by spirit fireflies.
  10. `crawl_toward_user` — Stalks forward from deep Z-space (`z = -1.65`) right up to the front glass (`z = +1.12`).
- **System-Wide Pass-Through Haunt Overlay (`AetherGhostOverlayService.kt`)**: Uses `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY` (`MATCH_PARENT` × `MATCH_PARENT`) with `FLAG_NOT_TOUCHABLE` + `FLAG_NOT_FOCUSABLE` on the 3D WebGL stage so **Aria haunts your entire phone screen over WhatsApp, Chrome, YouTube, or your Home Launcher while all your touches pass cleanly through to the underlying app**, paired with a compact draggable floating `👻 Haunt | ⚡ App | ✕` control pill.

### 2. Multi-Model Google AI Architecture
- **Gemini 3.8 Live (`gemini-3.8-live`)**: Real-time bidirectional voice streaming through Google ADK `Runner.run_live()` with 16kHz PCM audio input and 24kHz PCM audio output.
- **Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`)**: Ultra-fast (~300ms) non-voice reasoning, hybrid memory consolidation, knowledge graph updates, phone action planning, and proactive event filtering.
- **Gemma 4 31B (`gemma-4-31b-it`)**: Dedicated ADK 3D Ghost Choreographer computing unique non-looping 3D flight paths, multi-waypoint sequences, and skeletal gestures during conversations.

### 3. Speaker-Conscious Duplex Voice Engine (`GeminiLiveAudioEngine.kt` — Zero Self-Listening Echo Loop)
Eliminates the classic Android voice-agent feedback bug where the phone's microphone hears its own speaker output and talks to itself:
1. **Hardware Acoustic Echo Cancellation (AEC) Reference Binding**:
   - Switches `AudioManager.mode = AudioManager.MODE_IN_COMMUNICATION`.
   - Binds `AudioTrack` (`24kHz` PCM output) to the **exact same `audioSessionId`** as `AudioRecord` (`16kHz` PCM input) and sets `AudioAttributes.USAGE_VOICE_COMMUNICATION` + `CONTENT_TYPE_SPEECH` so the Android HAL feeds speaker output directly into the hardware `AcousticEchoCanceler` and `NoiseSuppressor`.
2. **Exact Physical Speaker Playback Horizon + 420ms Reverb Tail Gate (`isEchoGateActive`)**:
   - `AudioTrack.write()` buffers audio asynchronously into the OS mixer and returns before the physical speaker finishes playing.
   - `GeminiLiveAudioEngine` computes the exact physical playback duration of every queued PCM chunk (`bytes / 48` ms at 24kHz 16-bit mono) into `speakerPlaybackEndEpochMs` plus a **420ms acoustic room-reverb tail**.
   - While the phone speaker is physically emitting sound (or within the 420ms tail), **outgoing microphone frames are gated (`echoGatedFramesCount`) and never transmitted to Gemini Live** when on speakerphone.
3. **True High-Energy / Tap Barge-In**:
   - If you wear wired/Bluetooth headphones (`isExternalHeadsetConnected()`), full-duplex streaming stays open continuously.
   - On speakerphone, you can interrupt Aria at any time either by speaking loudly right into the mic (`4` consecutive frames above `max(5200 RMS, speakerRms * 2.75)`) or by tapping the **Barge-In / Interrupt** button, which immediately flushes `AudioTrack` (`pause()` + `flush()`) and sends a client interrupt signal.

### 4. Persistent Hybrid Memory Graph & Native Android Device Control
- **Hybrid Memory Engine (`memory_service.py`)**: 16-table SQLAlchemy + `pgvector` schema storing **Episodic, Semantic, Relational, Procedural, and Temporal** memories with epistemic status tracking (`explicitly_stated`, `observed_event`, `model_inference`, `unverified_assumption`), duplicate consolidation, and an interactive pinch-to-zoom Knowledge Graph Explorer.
- **26 Verified Android Capabilities (`AndroidDeviceController.kt`)**: App launching, UI tree inspection (`AetherAccessibilityService`), semantic node clicking, scrolling/swiping, notification reading (`AetherNotificationListener`), battery/network telemetry, and on-device OTP/privacy scrubbing.

---

## Monorepo Architecture

```text
.
├── README.md                          # Complete Architecture, Setup & Android Backend URL Guide
├── .env.example                       # Root environment template (no secrets)
└── aether/
    ├── docker-compose.yml             # PostgreSQL 16 (pgvector) + Redis 7 + FastAPI ADK Backend
    ├── backend/                       # Python 3.10+ / 3.11+ Google ADK + FastAPI Backend
    │   ├── Dockerfile
    │   ├── requirements.txt
    │   ├── .env.example               # Backend environment template
    │   ├── migrations/
    │   │   └── 001_initial_pgvector_schema.sql
    │   ├── tests/
    │   │   └── test_backend_api.py    # Backend API, 3D Ghost Choreography, Memory & Privacy tests
    │   └── app/
    │       ├── main.py                # FastAPI REST + @app.websocket("/ws/live/{user_id}")
    │       ├── config.py              # Configurable Gemini 3.8 Live & 3.8 Flash models + fallbacks
    │       ├── db.py                  # Async SQLAlchemy (PostgreSQL pgvector + SQLite auto-fallback)
    │       ├── models.py              # 16 ORM models (Memory, Entity, Relationship, Version, Audit...)
    │       ├── agents/
    │       │   └── companion_hierarchy.py # Root, Decision, Memory, Phone & Event ADK Agents + control_3d_ghost_avatar
    │       └── services/
    │           ├── memory_service.py  # Hybrid Vector + Full-Text + 1-Hop Graph Engine
    │           └── proactive_service.py # Local OTP/privacy scrubber & initiative scorer
    └── android/                       # Native Kotlin + Jetpack Compose + Three.js/VRM Android Project
        ├── settings.gradle.kts
        ├── build.gradle.kts
        ├── gradle.properties
        ├── local.properties.example   # Compile-time Backend URL template
        └── app/
            ├── build.gradle.kts
            └── src/main/
                ├── AndroidManifest.xml
                ├── assets/vrm/
                │   ├── ghost_stage.html      # Full-Screen 60fps Three.js + @pixiv/three-vrm 3D Ghost Engine
                │   ├── aria_anime_girl.vrm   # Bundled 7.8MB Rigged 3D VRM Anime Girl (Offline Zero-Latency)
                │   ├── three.module.js
                │   ├── three-vrm.module.js
                │   ├── GLTFLoader.js
                │   └── BufferGeometryUtils.js
                └── java/dev/aether/companion/
                    ├── AetherApplication.kt
                    ├── MainActivity.kt               # Edge-to-Edge Full-Screen 3D Ghost Stage + Glassmorphic HUD Drawer
                    ├── audio/GeminiLiveAudioEngine.kt # Speaker-Conscious Echo Gate + Hardware AEC + Barge-In
                    ├── data/BackendPreferencesRepository.kt # Jetpack DataStore Runtime URL Store
                    ├── device/AndroidDeviceController.kt # 26 Verified Android OS Capabilities
                    ├── network/AetherLiveWebSocketClient.kt # OkHttp WebSocket + 3D Ghost Command Dispatcher
                    ├── service/
                    │   ├── AetherGhostOverlayService.kt  # System-Wide Pass-Through 3D Ghost Overlay + Command Bus
                    │   ├── AetherAccessibilityService.kt
                    │   ├── AetherNotificationListener.kt
                    │   └── AetherLiveForegroundService.kt
                    └── ui/
                        ├── Aria3DGhostStageView.kt       # Compose WebViewAssetLoader Host for 3D VRM Stage
                        ├── AriaLiveSanctuaryCanvas.kt
                        └── KnowledgeGraphSection.kt
```

---

## Step 1: Running the Python Google ADK Backend (`aether/backend/`)

Never put your `GEMINI_API_KEY` or database passwords inside the Android APK. All Gemini 3.8 Live / 3.8 Flash calls and `pgvector` operations run on the backend.

### Option A: Run Directly with Local Python (Fastest for Development)

1. Open a terminal in `aether/backend`:
   ```bash
   cd aether/backend
   cp .env.example .env
   ```
2. Open `aether/backend/.env` and set your `GOOGLE_API_KEY` / `GEMINI_API_KEY`:
   ```env
   GOOGLE_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
   GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
   GEMINI_LIVE_MODEL="gemini-3.8-live"
   GEMINI_REASONING_MODEL="gemini-3.8-flash"
   AETHER_API_TOKEN="aether-dev-local-token-2026"
   HOST="0.0.0.0"
   PORT="8000"
   ```
3. Install dependencies and start Uvicorn bound to `0.0.0.0:8000` so your Android phone can reach it:
   ```bash
   pip install -r requirements.txt
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. Verify the backend is healthy and test triggering a 3D Ghost movement remotely:
   ```bash
   curl http://localhost:8000/api/v1/health
   curl -X POST http://localhost:8000/api/v1/companion/ghost \
     -H "Content-Type: application/json" \
     -d '{"behavior":"rush_to_glass","expression":"Surprised","speed":2.2,"glitch_intensity":0.65}'
   ```

---

## Step 2: Android Backend URL Setup (`aether/android/`)

You can configure the backend URL in **two ways**:
1. **Live at Runtime inside the Android App (No Rebuild Needed!)**: Open the HUD drawer → **Settings** tab, tap one of the preset chips (**USB `adb reverse`**, **Wi-Fi LAN**, or **Emulator**) or type your custom URL, and tap **Save & Reconnect**.
2. **At Compile Time via `aether/android/local.properties`**:
   ```properties
   AETHER_BACKEND_HTTP_URL=http://192.168.29.248:8000
   AETHER_BACKEND_WS_URL=ws://192.168.29.248:8000
   AETHER_API_TOKEN=aether-dev-local-token-2026
   ```

### USB / Wireless ADB Port Forwarding (`adb reverse`)
If your phone is connected via ADB:
```bash
adb reverse tcp:8000 tcp:8000
```
Then use `http://127.0.0.1:8000` / `ws://127.0.0.1:8000`.

---

## Step 3: Building & Installing the Native Android App

```bash
cd aether/android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
*(On Windows PowerShell: `.\gradlew.bat assembleDebug`)*

### Enabling System-Wide 3D Ghost Overlay ("Overlay Haunt")
1. Launch **Aether Companion (Aria)** on your phone. Aria's 3D VRM body immediately fills 100% of your display edge-to-edge.
2. Tap the **`👻 Overlay Haunt`** button in the top HUD bar.
3. Grant **Display over other apps (`SYSTEM_ALERT_WINDOW`)** when prompted, then tap **`👻 Overlay Haunt`** again.
4. Press your phone's **Home** button — Aria's 3D anime ghost body now floats and roams across your entire phone display over all your other apps while your screen touches pass right through her! Use the floating `👻 Haunt | ⚡ App | ✕` mini-pill to cycle her possessed behaviors, return to the full app, or dismiss the overlay.

---

## Running Backend & Android Tests

### Backend Test Suite
```bash
cd aether/backend
python tests/test_backend_api.py -v
```

### Android Unit Test Suite
```bash
cd aether/android
./gradlew testDebugUnitTest
```
