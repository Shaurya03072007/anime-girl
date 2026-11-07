package dev.aether.companion.network

import android.util.Base64
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class AetherLiveWebSocketClient(
    private val scope: CoroutineScope,
    private val onAudioChunk24k: (ByteArray) -> Unit,
    private val onTranscriptReceived: (String, String) -> Unit,
    private val onBargeInInterrupted: () -> Unit
) {
    private val okHttp = OkHttpClient.Builder()
        .pingInterval(15, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var currentWsUrl: String = ""
    private var currentToken: String = ""
    private var currentUserId: String = "shaurya"

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _sessionStatus = MutableStateFlow("Disconnected")
    val sessionStatus: StateFlow<String> = _sessionStatus.asStateFlow()

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
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching {
                    val json = JSONObject(text)
                    when (json.optString("type")) {
                        "session_status" -> {
                            val model = json.optString("model", "gemini-live")
                            _sessionStatus.value = "Live Stream Ready ($model)"
                        }
                        "audio_chunk" -> {
                            val b64 = json.optString("audio")
                            if (b64.isNotEmpty()) {
                                val pcm24k = Base64.decode(b64, Base64.DEFAULT)
                                onAudioChunk24k(pcm24k)
                            }
                        }
                        "output_transcription" -> {
                            val txt = json.optString("text")
                            val anim = json.optString("animation_state", "Speaking")
                            onTranscriptReceived(txt, anim)
                        }
                        "interrupted" -> {
                            onBargeInInterrupted()
                        }
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _isConnected.value = false
                _sessionStatus.value = "Disconnected (${t.localizedMessage ?: "Network Error"})"
                scope.launch {
                    delay(4000)
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
        val payload = JSONObject().apply {
            put("type", "barge_in")
        }
        ws.send(payload.toString())
    }

    fun disconnect() {
        currentWsUrl = ""
        webSocket?.close(1000, "User closed session")
        webSocket = null
        _isConnected.value = false
    }
}
