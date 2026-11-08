package dev.aether.companion.ui

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import dev.aether.companion.service.GhostSpatialCommandBus

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun Aria3DGhostStageView(
    modifier: Modifier = Modifier.fillMaxSize(),
    animationState: String,
    voiceAmplitude: Float,
    isSpeaking: Boolean,
    isListening: Boolean,
    echoGateActive: Boolean
) {
    val context = LocalContext.current
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    val assetLoader = remember(context) {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()
    }

    // Push real-time voice lip-sync & echo-gate state into the 3D VRM WebGL stage
    LaunchedEffect(voiceAmplitude, isSpeaking, isListening, echoGateActive) {
        GhostSpatialCommandBus.updateVoiceState(
            amplitude = voiceAmplitude,
            isSpeaking = isSpeaking,
            isListening = isListening,
            echoGateActive = echoGateActive
        )
        webViewRef?.evaluateJavascript(
            "window.AetherGhost3D && window.AetherGhost3D.setVoiceState($voiceAmplitude, $isSpeaking, $isListening, $echoGateActive);",
            null
        )
    }

    // Push expression changes into 3D VRM blendshapes without interrupting active 3D trajectory
    LaunchedEffect(animationState) {
        webViewRef?.evaluateJavascript(
            "window.AetherGhost3D && window.AetherGhost3D.setExpression('$animationState');",
            null
        )
    }

    // Listen to ADK / Gemini 3.8 Live spatial ghost movement commands
    LaunchedEffect(webViewRef) {
        GhostSpatialCommandBus.commands.collect { cmdJson ->
            val raw = cmdJson.toString()
            webViewRef?.evaluateJavascript(
                "window.AetherGhost3D && window.AetherGhost3D.applyGhostCommand($raw);",
                null
            )
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setBackgroundColor(AndroidColor.TRANSPARENT)
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
                loadUrl("https://appassets.androidplatform.net/assets/vrm/ghost_stage.html")
                webViewRef = this
            }
        },
        update = { wv ->
            webViewRef = wv
        }
    )
}

