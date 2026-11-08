package dev.aether.companion.network

import android.util.Base64
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class AetherLiveWebSocketClient(
    private val scope: CoroutineScope,
    private val onAudioChunk24k: (ByteArray) -> Unit,
    private val onTranscriptReceived: (turnId: String, role: String, text: String, animState: String, isFinal: Boolean) -> Unit,
    private val onBargeInInterrupted: () -> Unit,
    private val onDeviceActionRequested: (actionId: String, capability: String, params: Map<String, String>) -> JSONObject,
    private val onProactiveSuggestion: (title: String, message: String, capability: String, pkg: String) -> Unit,
    private val onRequestTelemetrySnapshot: (() -> JSONObject)? = null
) {
    private val okHttp = OkHttpClient.Builder()
        .pingInterval(15, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var currentWsUrl: String = ""
    private var currentToken: String = ""
    private var currentUserId: String = "shaurya"

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _sessionStatus = MutableStateFlow("Disconnected")
    val sessionStatus: StateFlow<String> = _sessionStatus.asStateFlow()

    private val _activeLiveModel = MutableStateFlow("gemini-3.8-live")
    val activeLiveModel: StateFlow<String> = _activeLiveModel.asStateFlow()

    private val _animationState = MutableStateFlow("Happy")
    val animationState: StateFlow<String> = _animationState.asStateFlow()

    fun connect(wsBaseUrl: String, apiToken: String, userId: String = "shaurya") {
        currentWsUrl = wsBaseUrl.trimEnd('/')
        currentToken = apiToken
        currentUserId = userId
        webSocket?.cancel()

        val fullUrl = "$currentWsUrl/ws/live/$userId"
        _sessionStatus.value = "Connecting to $fullUrl..."

        val request = Request.Builder()
            .url(fullUrl)
            .addHeader("Authorization", "Bearer $apiToken")
            .build()

        webSocket = okHttp.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _isConnected.value = true
                _sessionStatus.value = "Connected ($fullUrl)"
                runCatching {
                    onRequestTelemetrySnapshot?.invoke()?.let { telJson ->
                        val payload = JSONObject().apply {
                            put("type", "device_telemetry")
                            put("telemetry", telJson)
                        }
                        webSocket.send(payload.toString())
                    }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching {
                    val json = JSONObject(text)
                    when (json.optString("type")) {
                        "session_status" -> {
                            val model = json.optString("model", "gemini-3.8-live")
                            val anim = json.optString("animation_state", "Happy")
                            _activeLiveModel.value = model
                            _animationState.value = anim
                            _sessionStatus.value = "Live Stream Ready ($model)"
                        }
                        "companion_state" -> {
                            val anim = json.optString("animation_state", "Thinking")
                            _animationState.value = anim
                            json.optJSONObject("ghost_command")?.let { gc ->
                                dev.aether.companion.service.GhostSpatialCommandBus.dispatchCommand(gc)
                            }
                        }
                        "ghost_control" -> {
                            val anim = json.optString("expression", _animationState.value)
                            _animationState.value = anim
                            dev.aether.companion.service.GhostSpatialCommandBus.dispatchCommand(json)
                        }
                        "audio_chunk" -> {
                            val b64 = json.optString("audio")
                            val anim = json.optString("animation_state", "Speaking")
                            _animationState.value = anim
                            if (b64.isNotEmpty()) {
                                val pcm24k = Base64.decode(b64, Base64.DEFAULT)
                                onAudioChunk24k(pcm24k)
                            }
                        }
                        "input_transcription" -> {
                            val txt = json.optString("text")
                            val turnId = json.optString("turn_id", "ut_active")
                            val isFinal = json.optBoolean("is_final", false)
                            _animationState.value = "Listening"
                            if (txt.isNotBlank()) {
                                onTranscriptReceived(turnId, "user", txt, "Listening", isFinal)
                            }
                        }
                        "output_transcription" -> {
                            val txt = json.optString("text")
                            val turnId = json.optString("turn_id", "at_active")
                            val isFinal = json.optBoolean("is_final", false)
                            val anim = json.optString("animation_state", "Speaking")
                            _animationState.value = anim
                            if (txt.isNotBlank()) {
                                onTranscriptReceived(turnId, "companion", txt, anim, isFinal)
                            }
                        }
                        "interrupted" -> {
                            _animationState.value = "Listening"
                            onBargeInInterrupted()
                        }
                        "device_action_request" -> {
                            val actionId = json.optString("action_id", "act_${System.currentTimeMillis()}")
                            val capability = json.optString("capability")
                            val paramsObj = json.optJSONObject("parameters")
                            val paramsMap = mutableMapOf<String, String>()
                            paramsObj?.keys()?.forEach { k ->
                                paramsMap[k] = paramsObj.optString(k)
                            }
                            _animationState.value = "Processing an action"
                            val execResult = onDeviceActionRequested(actionId, capability, paramsMap)
                            val replyPayload = JSONObject().apply {
                                put("type", "device_action_result")
                                put("action_id", actionId)
                                put("action_type", capability)
                                put("permission_status", execResult.optString("permissionStatus", "granted"))
                                put("execution_status", execResult.optString("status", "executed"))
                                put("verification_status", execResult.optString("verification", "verified"))
                                put("result", execResult)
                            }
                            webSocket.send(replyPayload.toString())
                            _animationState.value = "Happy"
                        }
                        "proactive_suggestion" -> {
                            val sug = json.optJSONObject("suggestion") ?: return
                            val title = sug.optString("title", "Aria Proactive Suggestion")
                            val msg = sug.optString("message", "")
                            val prop = sug.optJSONObject("proposed_action")
                            val cap = prop?.optString("capability") ?: "launch_application"
                            val pkg = prop?.optJSONObject("parameters")?.optString("packageName") ?: ""
                            _animationState.value = "Curious"
                            onProactiveSuggestion(title, msg, cap, pkg)
                        }
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _isConnected.value = false
                _sessionStatus.value = "Offline (${t.localizedMessage ?: "Check Backend URL"})"
                scope.launch {
                    delay(4500)
                    if (!_isConnected.value && currentWsUrl.isNotEmpty()) {
                        connect(currentWsUrl, currentToken, currentUserId)
                    }
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false
                _sessionStatus.value = "Closed ($reason)"
            }
        })
    }

    fun sendPcm16kAudioFrame(pcm16kBytes: ByteArray) {
        val ws = webSocket ?: return
        if (!_isConnected.value) return
        val b64 = Base64.encodeToString(pcm16kBytes, Base64.NO_WRAP)
        val payload = JSONObject().apply {
            put("type", "audio_input")
            put("audio", b64)
        }
        ws.send(payload.toString())
    }

    fun sendTextTurn(text: String) {
        val ws = webSocket ?: return
        val payload = JSONObject().apply {
            put("type", "text_input")
            put("text", text)
        }
        ws.send(payload.toString())
    }

    fun sendBargeInInterrupt() {
        val ws = webSocket ?: return
        _animationState.value = "Listening"
        val payload = JSONObject().apply {
            put("type", "barge_in")
        }
        ws.send(payload.toString())
    }

    fun sendDeviceNotificationEvent(packageName: String, title: String, content: String) {
        val ws = webSocket ?: return
        if (!_isConnected.value) return
        val payload = JSONObject().apply {
            put("type", "device_event")
            put("package_name", packageName)
            put("title", title)
            put("content", content)
        }
        ws.send(payload.toString())
    }

    suspend fun getJson(httpUrl: String, path: String, apiToken: String): JSONObject? =
        withContext(Dispatchers.IO) {
            runCatching {
                val req = Request.Builder()
                    .url("${httpUrl.trimEnd('/')}$path")
                    .addHeader("Authorization", "Bearer $apiToken")
                    .get()
                    .build()
                okHttp.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use null
                    val bodyStr = resp.body?.string() ?: return@use null
                    JSONObject(bodyStr)
                }
            }.getOrNull()
        }

    suspend fun postJson(
        httpUrl: String,
        path: String,
        apiToken: String,
        bodyJson: JSONObject,
        method: String = "POST"
    ): JSONObject? = withContext(Dispatchers.IO) {
        runCatching {
            val mediaType = "application/json; charset=utf-8".toMediaType()
            val reqBody = bodyJson.toString().toRequestBody(mediaType)
            val builder = Request.Builder()
                .url("${httpUrl.trimEnd('/')}$path")
                .addHeader("Authorization", "Bearer $apiToken")
            val req = when (method.uppercase()) {
                "PUT" -> builder.put(reqBody).build()
                "PATCH" -> builder.patch(reqBody).build()
                "DELETE" -> builder.delete().build()
                else -> builder.post(reqBody).build()
            }
            okHttp.newCall(req).execute().use { resp ->
                val str = resp.body?.string() ?: return@use null
                JSONObject(str)
            }
        }.getOrNull()
    }

    fun setLocalAnimationState(state: String) {
        _animationState.value = state
    }

    fun disconnect() {
        currentWsUrl = ""
        webSocket?.close(1000, "User closed session")
        webSocket = null
        _isConnected.value = false
    }
}
