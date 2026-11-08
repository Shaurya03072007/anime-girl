package dev.aether.companion.service

import android.annotation.SuppressLint
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.webkit.WebViewAssetLoader
import dev.aether.companion.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject

data class GhostVoiceFrame(
    val amplitude: Float,
    val isSpeaking: Boolean,
    val isListening: Boolean,
    val echoGateActive: Boolean
)

/**
 * Shared real-time bus connecting Google ADK / Gemini 3.8 Live WebSocket events
 * to both the In-App Full-Screen 3D VRM Stage and the System-Wide Possessed Ghost Overlay.
 */
object GhostSpatialCommandBus {
    private val _commands = MutableSharedFlow<JSONObject>(extraBufferCapacity = 32)
    val commands: SharedFlow<JSONObject> = _commands.asSharedFlow()

    private val _voiceFrames = MutableStateFlow(GhostVoiceFrame(0f, false, false, false))
    val voiceFrames: StateFlow<GhostVoiceFrame> = _voiceFrames.asStateFlow()

    private val _currentBehavior = MutableStateFlow("float_roam")
    val currentBehavior: StateFlow<String> = _currentBehavior.asStateFlow()

    val ALL_GHOST_BEHAVIORS = listOf(
        "float_roam" to "Zero-G Float Roam",
        "rush_to_glass" to "Rush to Glass Stare",
        "ceiling_hang_upside_down" to "Upside-Down Ceiling Hang",
        "peek_left_edge" to "Peek Left Bezel",
        "peek_right_edge" to "Peek Right Bezel",
        "orbit_screen" to "Figure-8 Screen Orbit",
        "glitch_teleport" to "Spectral Glitch Teleport",
        "possessed_head_tilt" to "Possessed 42° Head Tilt",
        "possessed_levitate_spin" to "Zero-G Levitate Spin",
        "crawl_toward_user" to "Deep-Space Approach"
    )

    fun dispatchCommand(json: JSONObject) {
        val b = json.optString("behavior")
        if (b.isNotBlank()) {
            _currentBehavior.value = b
        }
        _commands.tryEmit(json)
    }

    fun dispatchBehavior(
        behavior: String,
        expression: String = "Curious",
        speed: Double = 1.25,
        glitchIntensity: Double = 0.4
    ) {
        _currentBehavior.value = behavior
        runCatching {
            val payload = JSONObject().apply {
                put("behavior", behavior)
                put("expression", expression)
                put("speed", speed)
                put("glitch_intensity", glitchIntensity)
            }
            _commands.tryEmit(payload)
        }
    }

    fun updateVoiceState(amplitude: Float, isSpeaking: Boolean, isListening: Boolean, echoGateActive: Boolean) {
        _voiceFrames.value = GhostVoiceFrame(amplitude, isSpeaking, isListening, echoGateActive)
    }
}

class AetherGhostOverlayService : Service() {

    companion object {
        const val ACTION_START_OVERLAY = "dev.aether.companion.START_GHOST_OVERLAY"
        const val ACTION_STOP_OVERLAY = "dev.aether.companion.STOP_GHOST_OVERLAY"

        private val _isOverlayActive = MutableStateFlow(false)
        val isOverlayActive: StateFlow<Boolean> = _isOverlayActive.asStateFlow()
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var windowManager: WindowManager? = null
    private var fullScreenGhostWebView: WebView? = null
    private var controlPillView: View? = null
    private var behaviorIndex = 0

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_OVERLAY) {
            removeOverlayWindows()
            stopSelf()
            return START_NOT_STICKY
        }

        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (fullScreenGhostWebView == null) {
            showFullScreenPossessedGhostOverlay()
        }
        return START_STICKY
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun showFullScreenPossessedGhostOverlay() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        // 1. Full-Screen Pass-Through 3D WebGL Window (Covers 100% of phone screen; touches pass through to apps below!)
        val stageParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                cacheMode = WebSettings.LOAD_DEFAULT
            }
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val url = request?.url ?: return null
                    return assetLoader.shouldInterceptRequest(url)
                }
            }
            loadUrl("https://appassets.androidplatform.net/assets/vrm/ghost_stage.html?transparent=1")
        }

        fullScreenGhostWebView = webView
        windowManager?.addView(webView, stageParams)

        // 2. Draggable Mini Spirit Control Pill so user can trigger ghost moves, return to app, or dismiss
        val pillParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = 24
            y = 140
        }

        val pillBg = GradientDrawable().apply {
            setColor(Color.parseColor("#CC090D1A"))
            cornerRadius = 48f
            setStroke(2, Color.parseColor("#818CF8"))
        }

        val pillLayout = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = pillBg
            setPadding(24, 14, 24, 14)
            gravity = Gravity.CENTER_VERTICAL
        }

        val hauntBtn = TextView(this).apply {
            text = "👻 Haunt"
            setTextColor(Color.parseColor("#E0E7FF"))
            textSize = 12f
            setPadding(12, 4, 16, 4)
            setOnClickListener {
                behaviorIndex = (behaviorIndex + 1) % GhostSpatialCommandBus.ALL_GHOST_BEHAVIORS.size
                val nextBehavior = GhostSpatialCommandBus.ALL_GHOST_BEHAVIORS[behaviorIndex].first
                GhostSpatialCommandBus.dispatchBehavior(nextBehavior, "Surprised", 1.4, 0.7)
            }
        }

        val openAppBtn = TextView(this).apply {
            text = "⚡ App"
            setTextColor(Color.parseColor("#2DD4BF"))
            textSize = 12f
            setPadding(12, 4, 16, 4)
            setOnClickListener {
                val launch = Intent(this@AetherGhostOverlayService, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                startActivity(launch)
            }
        }

        val closeBtn = TextView(this).apply {
            text = "✕"
            setTextColor(Color.parseColor("#FB7185"))
            textSize = 13f
            setPadding(12, 4, 8, 4)
            setOnClickListener {
                removeOverlayWindows()
                stopSelf()
            }
        }

        pillLayout.addView(hauntBtn)
        pillLayout.addView(openAppBtn)
        pillLayout.addView(closeBtn)

        var downX = 0f
        var downY = 0f
        var initialX = 0
        var initialY = 0
        pillLayout.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX
                    downY = event.rawY
                    initialX = pillParams.x
                    initialY = pillParams.y
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    pillParams.x = initialX - (event.rawX - downX).toInt()
                    pillParams.y = initialY + (event.rawY - downY).toInt()
                    windowManager?.updateViewLayout(pillLayout, pillParams)
                    true
                }
                else -> false
            }
        }

        controlPillView = pillLayout
        windowManager?.addView(pillLayout, pillParams)
        _isOverlayActive.value = true

        // Forward real-time ADK Ghost Commands and Voice Lip-Sync frames to the Overlay WebView
        serviceScope.launch {
            GhostSpatialCommandBus.commands.collect { cmdJson ->
                val escaped = cmdJson.toString()
                fullScreenGhostWebView?.evaluateJavascript(
                    "window.AetherGhost3D && window.AetherGhost3D.applyGhostCommand($escaped);",
                    null
                )
            }
        }

        serviceScope.launch {
            GhostSpatialCommandBus.voiceFrames.collect { vf ->
                fullScreenGhostWebView?.evaluateJavascript(
                    "window.AetherGhost3D && window.AetherGhost3D.setVoiceState(${vf.amplitude}, ${vf.isSpeaking}, ${vf.isListening}, ${vf.echoGateActive});",
                    null
                )
            }
        }
    }

    private fun removeOverlayWindows() {
        _isOverlayActive.value = false
        fullScreenGhostWebView?.let { wv ->
            runCatching {
                windowManager?.removeView(wv)
                wv.destroy()
            }
        }
        controlPillView?.let { pill ->
            runCatching {
                windowManager?.removeView(pill)
            }
        }
        fullScreenGhostWebView = null
        controlPillView = null
    }

    override fun onDestroy() {
        removeOverlayWindows()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

