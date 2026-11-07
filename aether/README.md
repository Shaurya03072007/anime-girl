# Project Aether Monorepo (`aether/`)

See the root [`../README.md`](../README.md) for the complete step-by-step instructions to:
1. Run `aether/backend` via Docker Compose or Python 3.11 + Uvicorn (`--host 0.0.0.0 --port 8000`).
2. Configure `AETHER_BACKEND_HTTP_URL` and `AETHER_BACKEND_WS_URL` in `aether/android/local.properties` or live inside the Android app's **Backend URL** tab (`adb reverse tcp:8000 tcp:8000` for USB, `192.168.x.x:8000` for Wi-Fi LAN, or `10.0.2.2:8000` for Android Emulator).
3. Open `aether/android` in Android Studio and deploy to your physical Android device.
