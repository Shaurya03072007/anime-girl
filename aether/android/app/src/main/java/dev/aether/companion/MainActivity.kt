package dev.aether.companion

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import dev.aether.companion.audio.GeminiLiveAudioEngine
import dev.aether.companion.data.BackendConnectionConfig
import dev.aether.companion.data.BackendPreferencesRepository
import dev.aether.companion.device.AndroidDeviceController
import dev.aether.companion.network.AetherLiveWebSocketClient
import dev.aether.companion.service.AetherAccessibilityService
import dev.aether.companion.service.AetherGhostOverlayService
import dev.aether.companion.service.AetherLiveForegroundService
import dev.aether.companion.service.AetherNotificationListener
import dev.aether.companion.service.GhostSpatialCommandBus
import dev.aether.companion.ui.*
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class ChatTurnUi(
    val id: String,
    val role: String,
    val text: String,
    val timestamp: String,
    val modality: String,
    val emotion: String
)

data class ProactiveSuggestionUi(
    val id: String,
    val title: String,
    val message: String,
    val capability: String,
    val targetPackage: String,
    val riskLevel: String,
    val status: String = "pending"
)

data class AgentTraceUi(
    val id: String,
    val timestamp: String,
    val agentName: String,
    val operation: String,
    val inputSummary: String,
    val outputSummary: String,
    val reasoning: String,
    val latencyMs: Int
)

class MainActivity : ComponentActivity() {

    private lateinit var prefsRepo: BackendPreferencesRepository
    private lateinit var deviceController: AndroidDeviceController
    private lateinit var audioEngine: GeminiLiveAudioEngine
    private lateinit var wsClient: AetherLiveWebSocketClient

    private val chatMessagesState = mutableStateListOf(
        ChatTurnUi(
            id = "msg_welcome",
            role = "companion",
            text = "Namaskaram Shaurya! I am floating right inside your phone screen in 3D now—and my Speaker-Conscious Echo Gate is active so I only hear YOU, never my own speaker! Tell me to come closer to the glass, hang upside-down, or teleport!",
            timestamp = "Live",
            modality = "voice",
            emotion = "Happy"
        )
    )

    private val proactiveSuggestionsState = mutableStateListOf(
        ProactiveSuggestionUi(
            id = "pro_01",
            title = "Inspect GitHub PR #42 (Ananya Rao)",
            message = "Ananya confirmed the pgvector HNSW migration scripts on PR #42. Shall I check your phone status or launch GitHub?",
            capability = "get_battery_status",
            targetPackage = "com.github.android",
            riskLevel = "low"
        ),
        ProactiveSuggestionUi(
            id = "pro_02",
            title = "Set 10-Min ADK Live Benchmark Timer",
            message = "Your ADK Live Voice Architecture review is coming up. Want me to start a 10-minute focus timer on your phone?",
            capability = "create_reminder",
            targetPackage = "",
            riskLevel = "medium"
        )
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Enable true edge-to-edge full-screen rendering so the 3D anime ghost covers 100% of the display
        WindowCompat.setDecorFitsSystemWindows(window, false)

        prefsRepo = BackendPreferencesRepository(applicationContext)
        deviceController = AndroidDeviceController(applicationContext)

        wsClient = AetherLiveWebSocketClient(
            scope = lifecycleScope,
            onAudioChunk24k = { pcm24k -> audioEngine.enqueueOutputPcm24k(pcm24k) },
            onTranscriptReceived = { turnId, role, text, anim, _ ->
                runOnUiThread {
                    val now = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                    val existingIdx = chatMessagesState.indexOfFirst { it.id == turnId }
                    if (existingIdx >= 0) {
                        chatMessagesState[existingIdx] = chatMessagesState[existingIdx].copy(
                            text = text,
                            emotion = anim,
                            timestamp = now
                        )
                    } else {
                        chatMessagesState.add(
                            0,
                            ChatTurnUi(
                                id = turnId,
                                role = role,
                                text = text,
                                timestamp = now,
                                modality = "voice",
                                emotion = anim
                            )
                        )
                    }
                }
            },
            onBargeInInterrupted = { audioEngine.interruptPlaybackImmediately() },
            onDeviceActionRequested = { actionId, capability, params ->
                deviceController.executeCapability(capability, params, actionId)
            },
            onProactiveSuggestion = { title, message, cap, pkg ->
                runOnUiThread {
                    proactiveSuggestionsState.add(
                        0,
                        ProactiveSuggestionUi(
                            id = "pro_${System.currentTimeMillis()}",
                            title = title,
                            message = message,
                            capability = cap,
                            targetPackage = pkg,
                            riskLevel = "medium"
                        )
                    )
                }
            },
            onRequestTelemetrySnapshot = {
                val bat = deviceController.executeCapability("get_battery_status")
                val net = deviceController.executeCapability("get_network_status")
                val dev = deviceController.executeCapability("get_device_information")
                JSONObject().apply {
                    put("batteryLevel", bat.optInt("batteryLevel", 82))
                    put("isCharging", bat.optBoolean("isCharging", false))
                    put("networkType", net.optString("networkType", "Wi-Fi"))
                    put("deviceModel", "${dev.optString("manufacturer", "")} ${dev.optString("model", "Android")}".trim())
                    put("androidVersion", dev.optString("androidRelease", "14"))
                }
            }
        )

        audioEngine = GeminiLiveAudioEngine(
            context = applicationContext,
            scope = lifecycleScope,
            onPcm16kCaptured = { pcm16k -> wsClient.sendPcm16kAudioFrame(pcm16k) },
            onBargeInDetected = { wsClient.sendBargeInInterrupt() }
        )

        // Forward permitted Android notifications to the ADK Proactive Engine
        lifecycleScope.launch {
            AetherNotificationListener.events.collect { notif ->
                wsClient.sendDeviceNotificationEvent(
                    packageName = notif.packageName,
                    title = notif.title,
                    content = notif.text
                )
            }
        }

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF6366F1),
                    secondary = Color(0xFF2DD4BF),
                    tertiary = Color(0xFFF59E0B),
                    background = Color(0xFF040711),
                    surface = Color(0xCC0D1324),
                    onPrimary = Color.White,
                    onBackground = Color(0xFFF8FAFC),
                    onSurface = Color(0xFFE2E8F0)
                )
            ) {
                AetherCompanionEcosystemApp(
                    prefsRepo = prefsRepo,
                    wsClient = wsClient,
                    audioEngine = audioEngine,
                    deviceController = deviceController,
                    chatMessages = chatMessagesState,
                    proactiveSuggestions = proactiveSuggestionsState
                )
            }
        }
    }

    override fun onDestroy() {
        audioEngine.stopAll()
        wsClient.disconnect()
        super.onDestroy()
    }
}

@Composable
fun AetherCompanionEcosystemApp(
    prefsRepo: BackendPreferencesRepository,
    wsClient: AetherLiveWebSocketClient,
    audioEngine: GeminiLiveAudioEngine,
    deviceController: AndroidDeviceController,
    chatMessages: MutableList<ChatTurnUi>,
    proactiveSuggestions: MutableList<ProactiveSuggestionUi>
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val config by prefsRepo.configFlow.collectAsState(
        initial = BackendConnectionConfig(
            httpUrl = BuildConfig.DEFAULT_BACKEND_HTTP_URL,
            wsUrl = BuildConfig.DEFAULT_BACKEND_WS_URL,
            apiToken = BuildConfig.DEFAULT_API_TOKEN,
            userId = "shaurya"
        )
    )
    val isConnected by wsClient.isConnected.collectAsState()
    val sessionStatus by wsClient.sessionStatus.collectAsState()
    val activeLiveModel by wsClient.activeLiveModel.collectAsState()
    val animationState by wsClient.animationState.collectAsState()
    val isListening by audioEngine.isListening.collectAsState()
    val isSpeaking by audioEngine.isSpeaking.collectAsState()
    val isEchoGateActive by audioEngine.isEchoGateActive.collectAsState()
    val aecStatus by audioEngine.aecHardwareStatus.collectAsState()
    val voiceAmp by audioEngine.voiceAmplitude.collectAsState()
    val currentGhostBehavior by GhostSpatialCommandBus.currentBehavior.collectAsState()
    val isSystemOverlayActive by AetherGhostOverlayService.isOverlayActive.collectAsState()
    val fgRunning by AetherLiveForegroundService.isRunning.collectAsState()
    val observedNotifs by AetherNotificationListener.recentNotifications.collectAsState()

    // 7 Main Sections: 0=3D Stage (Full-Screen), 1=Live Voice, 2=Memories, 3=Phone, 4=Ghost/Persona, 5=Activity, 6=Settings
    var selectedSection by remember { mutableIntStateOf(0) }
    var hideHudForPure3D by remember { mutableStateOf(false) }
    var showPoseStrip by remember { mutableStateOf(false) }

    // Companion Life & Customization State
    var companionName by remember { mutableStateOf("Aria") }
    var voiceName by remember { mutableStateOf("Zephyr") }
    var preferredLanguage by remember { mutableStateOf("te-en") }
    var humorLevel by remember { mutableFloatStateOf(65f) }
    var initiativeLevel by remember { mutableFloatStateOf(78f) }
    var currentThought by remember {
        mutableStateOf("Namaskaram Shaurya! I'm right here with you—tap Live Voice to talk or ask me anything!")
    }

    // Keep subtitle thought bubble in sync with latest companion message
    val latestCompanionTurn = chatMessages.firstOrNull { it.role == "companion" }?.text
    LaunchedEffect(latestCompanionTurn) {
        if (!latestCompanionTurn.isNullOrBlank()) {
            currentThought = latestCompanionTurn
        }
    }

    // Memory & Knowledge Graph State
    var memoriesList by remember {
        mutableStateOf(
            listOf(
                MemoryUiItem(
                    id = "mem_01_kotlin_arch",
                    content = "Shaurya develops native Android applications using Kotlin, Jetpack Compose, Coroutines, and Clean MVVM architecture.",
                    category = "semantic",
                    epistemicStatus = "explicitly_stated",
                    confidence = 0.98,
                    importance = 0.94,
                    verificationStatus = "verified",
                    relatedEntityIds = listOf("ent_shaurya", "ent_kotlin", "ent_aether"),
                    updatedAt = "2026-11-08"
                ),
                MemoryUiItem(
                    id = "mem_02_debugging_episode",
                    content = "Configured Speaker-Conscious Hardware AEC + 420ms Reverb Tail Gate and 3D VRM Possessed Ghost Engine for Project Aether.",
                    category = "episodic",
                    epistemicStatus = "observed_event",
                    confidence = 0.98,
                    importance = 0.95,
                    verificationStatus = "verified",
                    relatedEntityIds = listOf("ent_shaurya", "ent_aether", "ent_adk"),
                    updatedAt = "2026-11-08"
                ),
                MemoryUiItem(
                    id = "mem_03_bilingual_pref",
                    content = "Prefers direct, deeply technical architectural explanations without filler, and enjoys natural Telugu-English code-switching with Aria.",
                    category = "procedural",
                    epistemicStatus = "explicitly_stated",
                    confidence = 0.97,
                    importance = 0.93,
                    verificationStatus = "verified",
                    relatedEntityIds = listOf("ent_shaurya", "ent_telugu", "ent_hyderabad"),
                    updatedAt = "2026-11-08"
                ),
                MemoryUiItem(
                    id = "mem_04_ananya_pgvector",
                    content = "Ananya Rao collaborates with Shaurya on Project Aether to optimize PostgreSQL pgvector HNSW indexing and Alembic migrations on PR #42.",
                    category = "relational",
                    epistemicStatus = "explicitly_stated",
                    confidence = 0.94,
                    importance = 0.87,
                    verificationStatus = "verified",
                    relatedEntityIds = listOf("ent_shaurya", "ent_ananya", "ent_aether", "ent_pgvector"),
                    updatedAt = "2026-11-08"
                )
            )
        )
    }

    var entitiesList by remember {
        mutableStateOf(
            listOf(
                EntityUiItem("ent_shaurya", "Shaurya", "Person", "Lead Android & AI Architect", 18),
                EntityUiItem("ent_aether", "Project Aether", "Project", "3D Living AI Companion for Android", 15),
                EntityUiItem("ent_kotlin", "Kotlin & Compose", "Technology", "Native Android UI & Coroutines", 12),
                EntityUiItem("ent_adk", "Google ADK", "Technology", "Runner.run_live() Multi-Agent Engine", 11),
                EntityUiItem("ent_pgvector", "PostgreSQL pgvector", "Technology", "Hybrid Vector + Graph Storage", 9),
                EntityUiItem("ent_ananya", "Ananya Rao", "Person", "Collaborator on PR #42", 6),
                EntityUiItem("ent_telugu", "Telugu + English", "Preference", "Bilingual Code-Switching", 8),
                EntityUiItem("ent_hyderabad", "Hyderabad", "Place", "User Cultural Context", 5)
            )
        )
    }

    var relationshipsList by remember {
        mutableStateOf(
            listOf(
                RelationshipUiItem("rel_1", "ent_shaurya", "ent_aether", "architects"),
                RelationshipUiItem("rel_2", "ent_shaurya", "ent_kotlin", "develops_with"),
                RelationshipUiItem("rel_3", "ent_aether", "ent_adk", "orchestrated_by"),
                RelationshipUiItem("rel_4", "ent_aether", "ent_pgvector", "persists_graph_in"),
                RelationshipUiItem("rel_5", "ent_ananya", "ent_aether", "collaborates_on"),
                RelationshipUiItem("rel_6", "ent_shaurya", "ent_telugu", "converses_in"),
                RelationshipUiItem("rel_7", "ent_shaurya", "ent_hyderabad", "connected_to")
            )
        )
    }

    var tracesList by remember {
        mutableStateOf(
            listOf(
                AgentTraceUi(
                    id = "tr_1",
                    timestamp = "Live",
                    agentName = "RootCompanionAgent",
                    operation = "control_3d_ghost_avatar:float_roam",
                    inputSummary = "Initialized 3D VRM Anime Ghost + Speaker-Conscious Echo Gate",
                    outputSummary = "60fps Three.js + three-vrm full-screen stage active",
                    reasoning = "ADK Live model controls 3D spatial locomotion and facial blendshapes.",
                    latencyMs = 14
                ),
                AgentTraceUi(
                    id = "tr_2",
                    timestamp = "Live",
                    agentName = "MemoryAgent",
                    operation = "hybrid_graph_index",
                    inputSummary = "Vector cosine + full-text + 1-hop entity graph",
                    outputSummary = "Persistent memories & 8 entities active",
                    reasoning = "Distinguishes explicitly_stated facts from model_inference.",
                    latencyMs = 22
                )
            )
        )
    }

    fun syncFromBackend() {
        scope.launch {
            val stateJson = wsClient.getJson(config.httpUrl, "/api/v1/companion/state", config.apiToken)
                ?: return@launch
            stateJson.optJSONObject("character")?.let { ch ->
                companionName = ch.optString("name", companionName)
                voiceName = ch.optString("voiceName", voiceName)
            }
            stateJson.optJSONArray("memories")?.let { arr ->
                val parsed = mutableListOf<MemoryUiItem>()
                for (i in 0 until arr.length()) {
                    val m = arr.optJSONObject(i) ?: continue
                    val relArr = m.optJSONArray("related_entity_ids") ?: JSONArray()
                    val rels = (0 until relArr.length()).map { relArr.optString(it) }
                    parsed.add(
                        MemoryUiItem(
                            id = m.optString("id"),
                            content = m.optString("content"),
                            category = m.optString("category", "episodic"),
                            epistemicStatus = m.optString("epistemic_status", "explicitly_stated"),
                            confidence = m.optDouble("confidence", 0.95),
                            importance = m.optDouble("importance", 0.85),
                            verificationStatus = m.optString("verification_status", "verified"),
                            relatedEntityIds = rels,
                            updatedAt = m.optString("updated_at", "").take(10),
                            score = if (m.has("score")) m.optDouble("score") else null
                        )
                    )
                }
                if (parsed.isNotEmpty()) memoriesList = parsed
            }
            stateJson.optJSONArray("agent_traces")?.let { arr ->
                val parsedTraces = mutableListOf<AgentTraceUi>()
                for (i in 0 until arr.length()) {
                    val t = arr.optJSONObject(i) ?: continue
                    parsedTraces.add(
                        AgentTraceUi(
                            id = t.optString("id"),
                            timestamp = t.optString("timestamp").takeLast(9),
                            agentName = t.optString("agentName", "RootCompanionAgent"),
                            operation = t.optString("operation"),
                            inputSummary = t.optString("inputSummary"),
                            outputSummary = t.optString("outputSummary"),
                            reasoning = t.optString("reasoning"),
                            latencyMs = t.optInt("latencyMs", 22)
                        )
                    )
                }
                if (parsedTraces.isNotEmpty()) tracesList = parsedTraces
            }
            stateJson.optJSONArray("conversation_history")?.let { arr ->
                if (chatMessages.size <= 1 && arr.length() > 0) {
                    val hydrated = mutableListOf<ChatTurnUi>()
                    for (i in (arr.length() - 1) downTo 0) {
                        val item = arr.optJSONObject(i) ?: continue
                        hydrated.add(
                            ChatTurnUi(
                                id = item.optString("id", "hist_$i"),
                                role = item.optString("role", "companion"),
                                text = item.optString("text", ""),
                                timestamp = item.optString("timestamp", "Saved").takeLast(9),
                                modality = item.optString("modality", "voice"),
                                emotion = item.optString("emotion", "Happy")
                            )
                        )
                    }
                    if (hydrated.isNotEmpty()) {
                        chatMessages.clear()
                        chatMessages.addAll(hydrated)
                    }
                }
            }
        }
    }

    LaunchedEffect(config.wsUrl, config.apiToken) {
        wsClient.connect(config.wsUrl, config.apiToken, config.userId)
        syncFromBackend()
    }

    val micPermLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            val fgIntent = Intent(context, AetherLiveForegroundService::class.java).apply {
                putExtra(AetherLiveForegroundService.EXTRA_MODE, "Gemini 3.8 Live Voice")
            }
            ContextCompat.startForegroundService(context, fgIntent)
            wsClient.connect(config.wsUrl, config.apiToken, config.userId)
            audioEngine.startBidirectionalAudio()
            wsClient.setLocalAnimationState("Listening")
        }
    }

    val notifPermLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { _ -> }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    fun triggerGhostMove(behavior: String, expr: String = "Curious") {
        GhostSpatialCommandBus.dispatchBehavior(behavior, expr, 1.05, 0.35)
        scope.launch {
            val payload = JSONObject().apply {
                put("behavior", behavior)
                put("expression", expr)
                put("speed", 1.05)
                put("glitch_intensity", 0.35)
            }
            wsClient.postJson(config.httpUrl, "/api/v1/companion/ghost", config.apiToken, payload)
        }
    }

    fun sendCompanionMessage(text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return
        val now = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        chatMessages.add(
            0,
            ChatTurnUi(
                id = "user_${System.currentTimeMillis()}",
                role = "user",
                text = trimmed,
                timestamp = now,
                modality = "text",
                emotion = "Listening"
            )
        )
        wsClient.setLocalAnimationState("Thinking")

        // Single-path routing: if Live Voice stream is actively open and listening, route over Live WS so Aria speaks back;
        // otherwise route through the grounded ADK HTTP conversation turn endpoint (preventing duplicate responses!).
        if (isConnected && isListening) {
            wsClient.sendTextTurn(trimmed)
            scope.launch {
                kotlinx.coroutines.delay(2500)
                syncFromBackend()
            }
            return
        }

        scope.launch {
            val payload = JSONObject().apply {
                put("user_id", config.userId)
                put("text", trimmed)
                put("modality", "text")
                put("language", preferredLanguage)
            }
            val resp = wsClient.postJson(config.httpUrl, "/api/v1/conversation/turn", config.apiToken, payload)
            if (resp != null) {
                val reply = resp.optString("reply")
                val emo = resp.optString("emotion_state", "Happy")
                resp.optJSONObject("ghost_command")?.let { gc ->
                    GhostSpatialCommandBus.dispatchCommand(gc)
                }
                if (reply.isNotBlank()) {
                    wsClient.setLocalAnimationState(emo)
                    currentThought = reply
                    chatMessages.add(
                        0,
                        ChatTurnUi(
                            id = "aria_${System.currentTimeMillis()}",
                            role = "companion",
                            text = reply,
                            timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
                            modality = "text",
                            emotion = emo
                        )
                    )
                    syncFromBackend()
                }
            } else if (isConnected) {
                wsClient.sendTextTurn(trimmed)
            }
        }
    }

    fun toggleSystemWideGhostOverlay() {
        if (isSystemOverlayActive) {
            val stop = Intent(context, AetherGhostOverlayService::class.java).apply {
                action = AetherGhostOverlayService.ACTION_STOP_OVERLAY
            }
            context.startService(stop)
        } else {
            if (!Settings.canDrawOverlays(context)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${context.packageName}")
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            } else {
                val start = Intent(context, AetherGhostOverlayService::class.java).apply {
                    action = AetherGhostOverlayService.ACTION_START_OVERLAY
                }
                context.startService(start)
            }
        }
    }

    // =================================================================================
    // FULL-SCREEN EDGE-TO-EDGE LAYERED ARCHITECTURE:
    // Layer 0 (Bottom): 100% Full-Screen 3D VRM Anime Ghost Stage (covers entire display!)
    // Layer 1 (Top): Translucent Glass HUD & Hideable Drawers
    // =================================================================================
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF040711))
    ) {
        // LAYER 0: FULL-SCREEN 3D VRM ANIME GIRL STAGE
        Aria3DGhostStageView(
            modifier = Modifier.fillMaxSize(),
            animationState = animationState,
            voiceAmplitude = voiceAmp,
            isSpeaking = isSpeaking,
            isListening = isListening,
            echoGateActive = isEchoGateActive
        )

        // If user toggled Pure Full-Screen 3D Mode, show only a tiny floating restore pill
        if (hideHudForPure3D) {
            Surface(
                color = Color(0xAA090D1A),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .statusBarsPadding()
                    .padding(14.dp)
                    .border(1.dp, Color(0xFF818CF8), RoundedCornerShape(24.dp))
                    .clickable { hideHudForPure3D = false }
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Visibility,
                        contentDescription = "Show HUD",
                        tint = Color(0xFFA5B4FC),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("Show HUD", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            return@Box
        }

        // LAYER 1A: TOP FLOATING GLASS STATUS & ECHO-GATE TELEMETRY BAR
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Surface(
                color = Color(0xBB090D1C),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0x44818CF8), RoundedCornerShape(20.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(9.dp)
                                .clip(CircleShape)
                                .background(if (isConnected) Color(0xFF2DD4BF) else Color(0xFFF59E0B))
                        )
                        Spacer(Modifier.width(8.dp))
                        Column {
                            Text(
                                text = "$companionName · 3D Spirit ($currentGhostBehavior)",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            // Speaker-Conscious Echo Gate Live Badge
                            val micBadgeText = when {
                                isEchoGateActive -> "🔊 Speaker Playing · Mic Echo-Gated ($aecStatus)"
                                isListening -> "🎙️ Mic Open · Listening to You ($aecStatus)"
                                isConnected -> "⚡ ADK Live Ready ($activeLiveModel)"
                                else -> sessionStatus
                            }
                            val micBadgeColor = when {
                                isEchoGateActive -> Color(0xFFFBBF24)
                                isListening -> Color(0xFF2DD4BF)
                                else -> Color(0xFF94A3B8)
                            }
                            Text(
                                text = micBadgeText,
                                color = micBadgeColor,
                                fontSize = 10.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Toggle 3D Pose Strip
                        IconButton(
                            onClick = { showPoseStrip = !showPoseStrip },
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(
                                    if (showPoseStrip) Color(0xFF4F46E5) else Color(0xFF1E293B)
                                )
                        ) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesomeMotion,
                                contentDescription = "Toggle 3D Poses",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        // System-Wide Ghost Overlay Toggle Button (Haunts over Home Screen & Other Apps!)
                        IconButton(
                            onClick = { toggleSystemWideGhostOverlay() },
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isSystemOverlayActive) Color(0xFF9333EA) else Color(0xFF1E293B)
                                )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Layers,
                                contentDescription = "System-Wide Ghost Overlay",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        // Hide HUD for 100% Pure Full-Screen 3D View
                        IconButton(
                            onClick = { hideHudForPure3D = true },
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF1E293B))
                        ) {
                            Icon(
                                imageVector = Icons.Default.VisibilityOff,
                                contentDescription = "Pure 3D Fullscreen",
                                tint = Color(0xFFCBD5E1),
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        // Live Bidirectional Voice Button
                        Button(
                            onClick = {
                                if (isListening) {
                                    audioEngine.stopAll()
                                    wsClient.setLocalAnimationState("Happy")
                                    val stopIntent = Intent(context, AetherLiveForegroundService::class.java).apply {
                                        action = AetherLiveForegroundService.ACTION_STOP_LIVE
                                    }
                                    context.startService(stopIntent)
                                } else {
                                    micPermLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = when {
                                    isEchoGateActive -> Color(0xFFD97706)
                                    isListening -> Color(0xFF0D9488)
                                    else -> Color(0xFF4F46E5)
                                }
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(
                                imageVector = if (isListening) Icons.Default.GraphicEq else Icons.Default.Mic,
                                contentDescription = "Live Voice",
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = when {
                                    isEchoGateActive -> "Echo-Gated"
                                    isListening -> "Live ${(voiceAmp * 100).toInt()}%"
                                    else -> "Live Voice"
                                },
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Collapsible 3D Pose Strip (toggled by motion icon so Aria's 3D stage stays clean by default)
            if (showPoseStrip) {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(GhostSpatialCommandBus.ALL_GHOST_BEHAVIORS) { (behaviorKey, label) ->
                        val isActive = currentGhostBehavior == behaviorKey
                        Surface(
                            color = if (isActive) Color(0xDD6366F1) else Color(0xAA0F172A),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .border(
                                    1.dp,
                                    if (isActive) Color(0xFFC7D2FE) else Color(0x44475569),
                                    RoundedCornerShape(14.dp)
                                )
                                .clickable { triggerGhostMove(behaviorKey, "Surprised") }
                        ) {
                            Text(
                                text = "✨ $label",
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }
        }

        // LAYER 1B: TRANSLUCENT BOTTOM HUD / DRAWER OVER FULL-SCREEN 3D ANIME GIRL
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
        ) {
            when (selectedSection) {
                // =========================================================================
                // 0. FULL-SCREEN 3D GHOST STAGE (Minimal Floating Subtitle + Quick Input)
                // =========================================================================
                0 -> {
                    var quickInput by remember { mutableStateOf("") }
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Floating Translucent Dialogue / Thought Bubble at Bottom of 3D Stage
                        Surface(
                            color = Color(0xAA090D1C),
                            shape = RoundedCornerShape(18.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, Color(0x44818CF8), RoundedCornerShape(18.dp))
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "$companionName · $animationState",
                                        color = Color(0xFFA5B4FC),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        if (isSpeaking || isEchoGateActive) {
                                            Text(
                                                text = "Tap to Interrupt (0ms Barge-In)",
                                                color = Color(0xFFFBBF24),
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.clickable {
                                                    audioEngine.interruptPlaybackImmediately()
                                                    wsClient.sendBargeInInterrupt()
                                                }
                                            )
                                        }
                                        Text(
                                            text = if (isSystemOverlayActive) "System Overlay: ON" else "Tap Layers Icon for System Overlay",
                                            color = Color(0xFF2DD4BF),
                                            fontSize = 10.sp,
                                            modifier = Modifier.clickable { toggleSystemWideGhostOverlay() }
                                        )
                                    }
                                }

                                Text(
                                    text = "“$currentThought”",
                                    color = Color(0xFFF8FAFC),
                                    fontSize = 12.sp,
                                    fontStyle = FontStyle.Italic,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedTextField(
                                        value = quickInput,
                                        onValueChange = { quickInput = it },
                                        placeholder = {
                                            Text(
                                                "Tell Aria to rush to glass, hang upside-down, or chat (EN/TE)...",
                                                fontSize = 11.sp
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true
                                    )
                                    Button(
                                        onClick = {
                                            sendCompanionMessage(quickInput)
                                            quickInput = ""
                                        },
                                        shape = RoundedCornerShape(14.dp)
                                    ) {
                                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                        }
                    }
                }

                // =========================================================================
                // 1..6: TRANSLUCENT GLASS DRAWER OVER THE LIVE 3D ANIME GHOST
                // =========================================================================
                else -> {
                    Surface(
                        color = Color(0xD9080C18),
                        shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(0.58f)
                            .border(
                                1.dp,
                                Color(0x446366F1),
                                RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)
                            )
                    ) {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            contentPadding = PaddingValues(vertical = 12.dp)
                        ) {
                            when (selectedSection) {
                                // 1. VOICE & CONVERSATION LOG
                                1 -> {
                                    item {
                                        var inputTurn by remember { mutableStateOf("") }
                                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = "Speaker-Conscious Gemini 3.8 Live Stream",
                                                    color = Color.White,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                OutlinedButton(
                                                    onClick = {
                                                        audioEngine.interruptPlaybackImmediately()
                                                        wsClient.sendBargeInInterrupt()
                                                    },
                                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                                ) {
                                                    Text("Instant Barge-In Stop", fontSize = 11.sp)
                                                }
                                            }
                                            Text(
                                                text = "Audio Status: $aecStatus · Echo Gate: ${if (isEchoGateActive) "BLOCKING SPEAKER BLEED (420ms Tail)" else "MIC OPEN"}",
                                                color = if (isEchoGateActive) Color(0xFFFBBF24) else Color(0xFF2DD4BF),
                                                fontSize = 11.sp
                                            )
                                            Row(
                                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                OutlinedTextField(
                                                    value = inputTurn,
                                                    onValueChange = { inputTurn = it },
                                                    placeholder = { Text("Speak or type in English / Telugu...", fontSize = 12.sp) },
                                                    modifier = Modifier.weight(1f),
                                                    singleLine = true
                                                )
                                                Button(
                                                    onClick = {
                                                        sendCompanionMessage(inputTurn)
                                                        inputTurn = ""
                                                    }
                                                ) {
                                                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                                                }
                                            }
                                        }
                                    }

                                    items(chatMessages) { msg ->
                                        val isUser = msg.role == "user"
                                        Surface(
                                            color = if (isUser) Color(0xFF312E81) else Color(0xFF131C31),
                                            shape = RoundedCornerShape(14.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Column(modifier = Modifier.padding(10.dp)) {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween
                                                ) {
                                                    Text(
                                                        text = if (isUser) "Shaurya (${msg.modality})" else "$companionName · ${msg.emotion}",
                                                        color = if (isUser) Color(0xFFA5B4FC) else Color(0xFF2DD4BF),
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                    Text(text = msg.timestamp, color = Color(0xFF94A3B8), fontSize = 10.sp)
                                                }
                                                Spacer(Modifier.height(3.dp))
                                                Text(text = msg.text, color = Color.White, fontSize = 12.sp)
                                            }
                                        }
                                    }
                                }

                                // 2. MEMORIES & KNOWLEDGE GRAPH
                                2 -> {
                                    item {
                                        var selectedEntityId by remember { mutableStateOf<String?>("ent_shaurya") }
                                        var searchQuery by remember { mutableStateOf("") }
                                        var selectedCategory by remember { mutableStateOf("all") }
                                        var newMemoryText by remember { mutableStateOf("") }

                                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            InteractiveKnowledgeGraphCanvas(
                                                entities = entitiesList,
                                                relationships = relationshipsList,
                                                selectedEntityId = selectedEntityId,
                                                onSelectEntity = { selectedEntityId = it }
                                            )

                                            Row(
                                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                OutlinedTextField(
                                                    value = searchQuery,
                                                    onValueChange = { searchQuery = it },
                                                    placeholder = { Text("Search pgvector memory graph...", fontSize = 12.sp) },
                                                    modifier = Modifier.weight(1f),
                                                    singleLine = true
                                                )
                                                Button(
                                                    onClick = {
                                                        scope.launch {
                                                            val path = "/api/v1/memories?q=${java.net.URLEncoder.encode(searchQuery, "UTF-8")}&category=$selectedCategory"
                                                            val res = wsClient.getJson(config.httpUrl, path, config.apiToken)
                                                            res?.optJSONArray("memories")?.let { arr ->
                                                                val list = mutableListOf<MemoryUiItem>()
                                                                for (i in 0 until arr.length()) {
                                                                    val m = arr.optJSONObject(i) ?: continue
                                                                    list.add(
                                                                        MemoryUiItem(
                                                                            id = m.optString("id"),
                                                                            content = m.optString("content"),
                                                                            category = m.optString("category"),
                                                                            epistemicStatus = m.optString("epistemic_status"),
                                                                            confidence = m.optDouble("confidence", 0.95),
                                                                            importance = m.optDouble("importance", 0.85),
                                                                            verificationStatus = m.optString("verification_status", "verified"),
                                                                            relatedEntityIds = emptyList(),
                                                                            updatedAt = m.optString("updated_at").take(10),
                                                                            score = if (m.has("score")) m.optDouble("score") else null
                                                                        )
                                                                    )
                                                                }
                                                                if (list.isNotEmpty()) memoriesList = list
                                                            }
                                                        }
                                                    }
                                                ) {
                                                    Text("Search", fontSize = 11.sp)
                                                }
                                            }

                                            Row(
                                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                OutlinedTextField(
                                                    value = newMemoryText,
                                                    onValueChange = { newMemoryText = it },
                                                    placeholder = { Text("Add explicit memory...", fontSize = 12.sp) },
                                                    modifier = Modifier.weight(1f),
                                                    singleLine = true
                                                )
                                                Button(
                                                    onClick = {
                                                        if (newMemoryText.isNotBlank()) {
                                                            val txt = newMemoryText
                                                            newMemoryText = ""
                                                            scope.launch {
                                                                val body = JSONObject().apply {
                                                                    put("content", txt)
                                                                    put("category", "episodic")
                                                                    put("epistemic_status", "explicitly_stated")
                                                                    put("importance", 0.90)
                                                                }
                                                                wsClient.postJson(config.httpUrl, "/api/v1/memories", config.apiToken, body)
                                                                syncFromBackend()
                                                            }
                                                        }
                                                    }
                                                ) {
                                                    Text("+ Store", fontSize = 11.sp)
                                                }
                                            }
                                        }
                                    }

                                    items(memoriesList) { mem ->
                                        Surface(
                                            color = Color(0xFF131C31),
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Column(modifier = Modifier.padding(10.dp)) {
                                                Text(
                                                    text = "${mem.category.uppercase()} · ${mem.verificationStatus.uppercase()} (${(mem.confidence * 100).toInt()}%)",
                                                    color = Color(0xFF2DD4BF),
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Text(text = mem.content, color = Color.White, fontSize = 12.sp)
                                            }
                                        }
                                    }
                                }

                                // 3. PHONE BRIDGE & SYSTEM OVERLAY
                                3 -> {
                                    item {
                                        var lastDeviceOutput by remember {
                                            mutableStateOf(deviceController.executeCapability("get_device_information").toString(2))
                                        }
                                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            Button(
                                                onClick = { toggleSystemWideGhostOverlay() },
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = if (isSystemOverlayActive) Color(0xFFDC2626) else Color(0xFF7C3AED)
                                                ),
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                Icon(Icons.Default.Layers, contentDescription = null)
                                                Spacer(Modifier.width(8.dp))
                                                Text(
                                                    if (isSystemOverlayActive) "Stop System-Wide Possessed Ghost Overlay"
                                                    else "Launch System-Wide Possessed Ghost Overlay (Over All Apps)"
                                                )
                                            }

                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                OutlinedButton(
                                                    onClick = {
                                                        context.startActivity(
                                                            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                                                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                                        )
                                                    },
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Text("Accessibility Setup", fontSize = 11.sp)
                                                }
                                                OutlinedButton(
                                                    onClick = {
                                                        context.startActivity(
                                                            Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                                                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                                        )
                                                    },
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Text("Notification Access", fontSize = 11.sp)
                                                }
                                            }

                                            val capabilityButtons = listOf(
                                                "Battery" to "get_battery_status",
                                                "Network" to "get_network_status",
                                                "Device Info" to "get_device_information",
                                                "Installed Apps" to "get_installed_applications",
                                                "Inspect UI Tree" to "inspect_accessible_ui",
                                                "Notifications" to "read_authorized_notifications",
                                                "Scroll Down" to "scroll",
                                                "Swipe" to "swipe",
                                                "Press Back" to "press_back",
                                                "Press Home" to "press_home_where_supported",
                                                "Set 5m Timer" to "create_reminder"
                                            )
                                            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                items(capabilityButtons) { (label, cap) ->
                                                    ElevatedButton(
                                                        onClick = {
                                                            lastDeviceOutput = deviceController.executeCapability(cap).toString(2)
                                                        }
                                                    ) {
                                                        Text(label, fontSize = 11.sp)
                                                    }
                                                }
                                            }

                                            Surface(
                                                color = Color(0xFF050811),
                                                shape = RoundedCornerShape(12.dp),
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                Text(
                                                    text = lastDeviceOutput,
                                                    color = Color(0xFF2DD4BF),
                                                    fontSize = 10.sp,
                                                    fontFamily = FontFamily.Monospace,
                                                    modifier = Modifier.padding(10.dp)
                                                )
                                            }
                                        }
                                    }
                                }

                                // 4. GHOST LAB & PERSONA CUSTOMIZATION
                                4 -> {
                                    item {
                                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                            Text(
                                                text = "3D Possessed Ghost Behaviors (Controlled by ADK & Live Model)",
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                items(GhostSpatialCommandBus.ALL_GHOST_BEHAVIORS) { (bKey, bLabel) ->
                                                    FilterChip(
                                                        selected = currentGhostBehavior == bKey,
                                                        onClick = { triggerGhostMove(bKey, "Surprised") },
                                                        label = { Text(bLabel, fontSize = 11.sp) }
                                                    )
                                                }
                                            }

                                            Text(
                                                text = "12 Reactive VRM Facial Expressions",
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                items(ALL_ANIMATION_STATES) { st ->
                                                    FilterChip(
                                                        selected = animationState == st,
                                                        onClick = { wsClient.setLocalAnimationState(st) },
                                                        label = { Text(st, fontSize = 11.sp) }
                                                    )
                                                }
                                            }

                                            Text(
                                                text = "Gemini 3.8 Live Voice & Bilingual Mode",
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                items(listOf("Zephyr", "Kore", "Puck", "Charon", "Fenrir")) { v ->
                                                    FilterChip(
                                                        selected = voiceName == v,
                                                        onClick = {
                                                            voiceName = v
                                                            scope.launch {
                                                                val body = JSONObject().apply { put("voiceName", v) }
                                                                wsClient.postJson(config.httpUrl, "/api/v1/character", config.apiToken, body, "PUT")
                                                            }
                                                        },
                                                        label = { Text(v, fontSize = 11.sp) }
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }

                                // 5. ACTIVITY & ADK MULTI-AGENT TRACES
                                5 -> {
                                    items(tracesList) { tr ->
                                        Surface(
                                            color = Color(0xFF131C31),
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Column(modifier = Modifier.padding(10.dp)) {
                                                Text(
                                                    text = "${tr.agentName} · ${tr.operation} (${tr.latencyMs}ms)",
                                                    color = Color(0xFF818CF8),
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Text(text = tr.outputSummary, color = Color.White, fontSize = 12.sp)
                                                Text(text = tr.reasoning, color = Color(0xFF94A3B8), fontSize = 10.sp)
                                            }
                                        }
                                    }
                                }

                                // 6. SETTINGS & RUNTIME BACKEND URL CONFIGURATOR
                                6 -> {
                                    item {
                                        var httpInput by remember(config.httpUrl) { mutableStateOf(config.httpUrl) }
                                        var wsInput by remember(config.wsUrl) { mutableStateOf(config.wsUrl) }
                                        var tokenInput by remember(config.apiToken) { mutableStateOf(config.apiToken) }
                                        var healthJsonText by remember { mutableStateOf("Tap 'Test Health' to verify ADK connection.") }

                                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Text(
                                                text = "ADK Backend URL Setup (DataStore Runtime Switcher)",
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                AssistChip(
                                                    onClick = {
                                                        httpInput = "http://127.0.0.1:8000"
                                                        wsInput = "ws://127.0.0.1:8000"
                                                    },
                                                    label = { Text("USB (adb reverse)", fontSize = 11.sp) }
                                                )
                                                AssistChip(
                                                    onClick = {
                                                        httpInput = "http://192.168.29.248:8000"
                                                        wsInput = "ws://192.168.29.248:8000"
                                                    },
                                                    label = { Text("Wi-Fi LAN", fontSize = 11.sp) }
                                                )
                                                AssistChip(
                                                    onClick = {
                                                        httpInput = "http://10.0.2.2:8000"
                                                        wsInput = "ws://10.0.2.2:8000"
                                                    },
                                                    label = { Text("Emulator", fontSize = 11.sp) }
                                                )
                                            }
                                            OutlinedTextField(
                                                value = httpInput,
                                                onValueChange = { httpInput = it },
                                                label = { Text("Backend HTTP URL") },
                                                modifier = Modifier.fillMaxWidth(),
                                                singleLine = true
                                            )
                                            OutlinedTextField(
                                                value = wsInput,
                                                onValueChange = { wsInput = it },
                                                label = { Text("Backend WebSocket URL") },
                                                modifier = Modifier.fillMaxWidth(),
                                                singleLine = true
                                            )
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Button(
                                                    onClick = {
                                                        scope.launch {
                                                            prefsRepo.updateBackendUrls(httpInput, wsInput, tokenInput)
                                                            wsClient.connect(wsInput, tokenInput, config.userId)
                                                            syncFromBackend()
                                                        }
                                                    },
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Text("Save & Reconnect", fontSize = 11.sp)
                                                }
                                                OutlinedButton(
                                                    onClick = {
                                                        scope.launch {
                                                            val h = wsClient.getJson(httpInput, "/api/v1/health", tokenInput)
                                                            healthJsonText = h?.toString(2) ?: "Unreachable ($httpInput)"
                                                        }
                                                    },
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Text("Test Health", fontSize = 11.sp)
                                                }
                                            }
                                            Text(
                                                text = healthJsonText,
                                                color = Color(0xFF2DD4BF),
                                                fontSize = 10.sp,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Bottom Floating Glass Navigation Bar
            Surface(
                color = Color(0xDD070A14),
                modifier = Modifier.fillMaxWidth()
            ) {
                val navItems = listOf(
                    Triple(0, "3D Ghost", Icons.Default.AutoAwesome),
                    Triple(1, "Voice", Icons.Default.RecordVoiceOver),
                    Triple(2, "Memories", Icons.Default.AccountTree),
                    Triple(3, "Phone", Icons.Default.PhoneAndroid),
                    Triple(4, "Haunt Lab", Icons.Default.FaceRetouchingNatural),
                    Triple(5, "Activity", Icons.Default.Analytics),
                    Triple(6, "Backend", Icons.Default.SettingsEthernet)
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 6.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    navItems.forEach { (index, label, icon) ->
                        val selected = selectedSection == index
                        Surface(
                            color = if (selected) Color(0xFF312E81) else Color.Transparent,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .clickable { selectedSection = index }
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
                            ) {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = label,
                                    tint = if (selected) Color(0xFFA5B4FC) else Color(0xFF64748B),
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = label,
                                    color = if (selected) Color.White else Color(0xFF94A3B8),
                                    fontSize = 10.sp,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
