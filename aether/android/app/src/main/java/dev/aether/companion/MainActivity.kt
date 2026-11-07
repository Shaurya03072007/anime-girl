package dev.aether.companion

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import dev.aether.companion.audio.GeminiLiveAudioEngine
import dev.aether.companion.data.BackendConnectionConfig
import dev.aether.companion.data.BackendPreferencesRepository
import dev.aether.companion.device.AndroidDeviceController
import dev.aether.companion.network.AetherLiveWebSocketClient
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var prefsRepo: BackendPreferencesRepository
    private lateinit var deviceController: AndroidDeviceController
    private lateinit var audioEngine: GeminiLiveAudioEngine
    private lateinit var wsClient: AetherLiveWebSocketClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefsRepo = BackendPreferencesRepository(applicationContext)
        deviceController = AndroidDeviceController(applicationContext)

        wsClient = AetherLiveWebSocketClient(
            scope = lifecycleScope,
            onAudioChunk24k = { pcm24k -> audioEngine.enqueueOutputPcm24k(pcm24k) },
            onTranscriptReceived = { _, _ -> },
            onBargeInInterrupted = { audioEngine.interruptPlaybackImmediately() }
        )

        audioEngine = GeminiLiveAudioEngine(
            scope = lifecycleScope,
            onPcm16kCaptured = { pcm16k -> wsClient.sendPcm16kAudioFrame(pcm16k) },
            onBargeInDetected = { wsClient.sendBargeInInterrupt() }
        )

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF6366F1),
                    secondary = Color(0xFF2DD4BF),
                    background = Color(0xFF070A12),
                    surface = Color(0xFF101626)
                )
            ) {
                AetherCompanionMobileApp(
                    prefsRepo = prefsRepo,
                    wsClient = wsClient,
                    audioEngine = audioEngine,
                    deviceController = deviceController
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
fun AetherCompanionMobileApp(
    prefsRepo: BackendPreferencesRepository,
    wsClient: AetherLiveWebSocketClient,
    audioEngine: GeminiLiveAudioEngine,
    deviceController: AndroidDeviceController
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
    val isListening by audioEngine.isListening.collectAsState()
    val voiceAmp by audioEngine.voiceAmplitude.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) }
    var httpInput by remember(config.httpUrl) { mutableStateOf(config.httpUrl) }
    var wsInput by remember(config.wsUrl) { mutableStateOf(config.wsUrl) }
    var tokenInput by remember(config.apiToken) { mutableStateOf(config.apiToken) }
    var deviceOutputLog by remember { mutableStateOf("Ready to execute Android capabilities.") }

    val micPermLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            wsClient.connect(config.wsUrl, config.apiToken, config.userId)
            audioEngine.startBidirectionalAudio()
        }
    }

    LaunchedEffect(config.wsUrl, config.apiToken) {
        wsClient.connect(config.wsUrl, config.apiToken, config.userId)
    }

    Scaffold(
        containerColor = Color(0xFF070A12),
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF0C111E)) {
                listOf(
                    Triple(0, "Aria Live", Icons.Default.Favorite),
                    Triple(1, "Phone Bridge", Icons.Default.PhoneAndroid),
                    Triple(2, "Backend URL", Icons.Default.SettingsEthernet)
                ).forEach { (idx, label, icon) ->
                    NavigationBarItem(
                        selected = selectedTab == idx,
                        onClick = { selectedTab = idx },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label, fontSize = 11.sp) }
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Top Status Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Aria · Living Companion",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = sessionStatus,
                        color = if (isConnected) Color(0xFF2DD4BF) else Color(0xFF94A3B8),
                        fontSize = 12.sp
                    )
                }
                Button(
                    onClick = {
                        if (isListening) {
                            audioEngine.stopAll()
                        } else {
                            micPermLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isListening) Color(0xFF0D9488) else Color(0xFF6366F1)
                    )
                ) {
                    Icon(
                        imageVector = if (isListening) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = "Toggle Live Voice"
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(if (isListening) "Listening (${(voiceAmp * 100).toInt()}%)" else "Start Live Voice")
                }
            }

            when (selectedTab) {
                0 -> {
                    // Tab 0: Aria Living Sanctuary & Voice Interaction
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF101626)),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                text = "Currently in: Vinyl & Coffee Sanctuary",
                                color = Color(0xFFFBBF24),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "“Namaskaram Shaurya! I just brewed a fresh pour-over coffee by the turntable while monitoring your pgvector PR #42. Tap Start Live Voice or send a command below!”",
                                color = Color(0xFFE2E8F0),
                                fontSize = 14.sp
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(onClick = { audioEngine.interruptPlaybackImmediately(); wsClient.sendBargeInInterrupt() }) {
                                    Text("Interrupt (Barge-In)", fontSize = 12.sp)
                                }
                                OutlinedButton(onClick = { wsClient.sendTextTurn("Namaskaram Aria, check my battery and PR #42 status") }) {
                                    Text("Ask Status (TE-EN)", fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }

                1 -> {
                    // Tab 1: Native Android Device Bridge & Permissions
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF101626)),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Native Android Device Capabilities", color = Color.White, fontWeight = FontWeight.Bold)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(onClick = {
                                    val res = deviceController.executeCapability("get_battery_status", emptyMap())
                                    deviceOutputLog = res.toString(2)
                                }) { Text("Battery Status", fontSize = 12.sp) }

                                Button(onClick = {
                                    val res = deviceController.executeCapability("inspect_accessible_ui", emptyMap())
                                    deviceOutputLog = res.toString(2)
                                }) { Text("Inspect UI Tree", fontSize = 12.sp) }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(onClick = {
                                    context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                                }) { Text("Open Accessibility Settings", fontSize = 11.sp) }

                                OutlinedButton(onClick = {
                                    context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                                }) { Text("Notification Access", fontSize = 11.sp) }
                            }
                            Text(
                                text = deviceOutputLog,
                                color = Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )
                        }
                    }
                }

                2 -> {
                    // Tab 2: Live Runtime Backend URL Configurator (DataStore)
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF101626)),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("ADK Backend Server URL Setup", color = Color.White, fontWeight = FontWeight.Bold)
                            Text(
                                text = "• USB adb reverse: ws://127.0.0.1:8000\n• Wi-Fi LAN IP: ws://192.168.1.X:8000\n• Android Emulator: ws://10.0.2.2:8000",
                                color = Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )
                            OutlinedTextField(
                                value = httpInput,
                                onValueChange = { httpInput = it },
                                label = { Text("Backend HTTP URL") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = wsInput,
                                onValueChange = { wsInput = it },
                                label = { Text("Backend WebSocket URL") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = tokenInput,
                                onValueChange = { tokenInput = it },
                                label = { Text("AETHER_API_TOKEN") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = {
                                    scope.launch {
                                        prefsRepo.updateBackendUrls(httpInput, wsInput, tokenInput)
                                        wsClient.connect(wsInput, tokenInput, config.userId)
                                    }
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Save & Reconnect WebSocket")
                            }
                        }
                    }
                }
            }
        }
    }
}
