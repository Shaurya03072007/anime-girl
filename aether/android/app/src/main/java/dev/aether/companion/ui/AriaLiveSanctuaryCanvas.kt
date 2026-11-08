package dev.aether.companion.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.aether.companion.R
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

data class SanctuarySceneInfo(
    val id: String,
    val shortLabel: String,
    val location: String,
    val activityTitle: String,
    val thought: String,
    val ambientTrack: String,
    val drawableRes: Int,
    val accentColor: Color
)

val SANCTUARY_SCENES = listOf(
    SanctuarySceneInfo(
        id = "coffee_sketchbook",
        shortLabel = "Coffee",
        location = "Vinyl & Coffee Sanctuary",
        activityTitle = "Brewing Pour-Over Coffee & Sketching UI Ideas",
        thought = "Just brewed a fresh single-origin pour-over by the turntable while sketching ideas. Grab a mug with me, Shaurya!",
        ambientTrack = "Warm Vinyl Crackle · Nujabes & Lo-Fi Jazz",
        drawableRes = R.drawable.aria_coffee_sketchbook,
        accentColor = Color(0xFFF59E0B)
    ),
    SanctuarySceneInfo(
        id = "twilight_study",
        shortLabel = "Study",
        location = "Rainy Twilight Study Window",
        activityTitle = "Listening to Rain & Organizing Knowledge Graph",
        thought = "Watching the evening rain outside while connecting your recent Project Aether milestones. Need a quick breather?",
        ambientTrack = "Rain on Glass · Late Night Piano in D Minor",
        drawableRes = R.drawable.aria_twilight_study,
        accentColor = Color(0xFF818CF8)
    ),
    SanctuarySceneInfo(
        id = "focused_dev_rig",
        shortLabel = "Dev Rig",
        location = "Dual-Monitor Creative Desk",
        activityTitle = "Pair-Programming & ADK Live Latency Tuning",
        thought = "Profiling our 16kHz PCM audio frames and PostgreSQL HNSW query plans on my second monitor. Ready to dive in!",
        ambientTrack = "Synthwave Focus · Modular Ambient Pulse",
        drawableRes = R.drawable.aria_focused_dev_rig,
        accentColor = Color(0xFF38BDF8)
    ),
    SanctuarySceneInfo(
        id = "rooftop_balcony",
        shortLabel = "Rooftop",
        location = "Skyline Balcony Terrace",
        activityTitle = "Golden Hour Photography & Stargazing",
        thought = "The sunset over the city skyline looks incredible right now! Set up my camera on the tripod—glad you stepped out here with me.",
        ambientTrack = "Evening City Breeze · Twilight Acoustic Guitar",
        drawableRes = R.drawable.aria_rooftop_balcony,
        accentColor = Color(0xFFFB7185)
    )
)

val ALL_ANIMATION_STATES = listOf(
    "Idle",
    "Listening",
    "Speaking",
    "Thinking",
    "Happy",
    "Curious",
    "Confused",
    "Surprised",
    "Concerned",
    "Sleeping",
    "Waiting",
    "Processing an action"
)

@Composable
fun AriaLiveSanctuaryCanvas(
    companionName: String,
    activeSceneId: String,
    animationState: String,
    voiceName: String,
    voiceAmplitude: Float,
    bondLevel: Int,
    energyLevel: Int,
    customThought: String? = null,
    height: Dp = 360.dp,
    showSceneSwitcher: Boolean = true,
    onSelectScene: (String) -> Unit = {},
    onCycleExpression: () -> Unit = {}
) {
    val scene = SANCTUARY_SCENES.find { it.id == activeSceneId } ?: SANCTUARY_SCENES.first()

    val infiniteTransition = rememberInfiniteTransition(label = "aria_25d_kinematics")
    val phase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2f * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 4200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "breath_phase"
    )
    val particlePhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 100f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 9000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "particle_phase"
    )

    var dragX by remember { mutableFloatStateOf(0f) }
    var dragY by remember { mutableFloatStateOf(0f) }

    val speedMultiplier = when (animationState) {
        "Sleeping" -> 0.55f
        "Speaking" -> 1.75f
        "Happy", "Surprised" -> 1.4f
        else -> 1.0f
    }

    val breathY = sin(phase * speedMultiplier) * 6.5f
    val breathScale = 1.045f + sin(phase * speedMultiplier) * 0.014f
    val swayX = cos(phase * 0.7f) * 4.2f

    val stateTiltZ = when (animationState) {
        "Curious" -> 2.4f + sin(phase) * 0.8f
        "Confused" -> -2.4f + cos(phase) * 0.8f
        "Thinking" -> -1.5f
        "Sleeping" -> 2.0f
        else -> sin(phase * 0.5f) * 0.8f
    }

    val speakingLevel = when (animationState) {
        "Speaking" -> maxOf(0.35f, if (voiceAmplitude > 0.05f) voiceAmplitude else (sin(phase * 6f) + 1f) * 0.42f)
        "Listening" -> maxOf(0.20f, voiceAmplitude)
        else -> voiceAmplitude
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(24.dp))
                .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(24.dp))
                .background(Color(0xFF050811))
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragEnd = {
                            dragX = 0f
                            dragY = 0f
                        },
                        onDragCancel = {
                            dragX = 0f
                            dragY = 0f
                        },
                        onDrag = { change, dragAmount ->
                            change.consume()
                            dragX = (dragX + dragAmount.x * 0.06f).coerceIn(-12f, 12f)
                            dragY = (dragY + dragAmount.y * 0.06f).coerceIn(-10f, 10f)
                        }
                    )
                }
                .clickable { onCycleExpression() }
        ) {
            // 2.5D Parallax & Breathing Anime Heroine Layer
            Image(
                painter = painterResource(id = scene.drawableRes),
                contentDescription = "$companionName in ${scene.location}",
                contentScale = ContentScale.Crop,
                alignment = Alignment.TopCenter,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = breathScale
                        scaleY = breathScale
                        translationX = swayX + dragX
                        translationY = breathY + dragY
                        rotationZ = stateTiltZ
                        rotationY = dragX * 0.45f
                        rotationX = -dragY * 0.35f
                    }
            )

            // Atmospheric Canvas Overlay (Coffee Steam, Rain Streaks, Dev Nodes, Sunset Embers + Voice Aura)
            Canvas(modifier = Modifier.fillMaxSize()) {
                val w = size.width
                val h = size.height

                // Ambient scene radial glow
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            scene.accentColor.copy(alpha = 0.16f + sin(phase) * 0.04f),
                            Color.Transparent
                        ),
                        center = Offset(w * 0.5f, h * 0.35f),
                        radius = w * 0.65f
                    )
                )

                when (scene.id) {
                    "coffee_sketchbook" -> {
                        // Rising warm coffee steam curves & golden motes
                        for (i in 0..2) {
                            val offset = (particlePhase * 3.2f + i * 32f) % 95f
                            val steamAlpha = sin((offset / 95f) * Math.PI).toFloat().coerceIn(0f, 1f) * 0.32f
                            val sway = sin(phase + i) * 14f
                            val startX = w * (0.52f + i * 0.04f) + sway
                            val startY = h * 0.72f - offset * 1.8f
                            val path = Path().apply {
                                moveTo(startX, startY)
                                quadraticTo(startX - 18f, startY - 35f, startX + 12f, startY - 70f)
                            }
                            drawPath(
                                path = path,
                                color = Color(0xFFFEF3C7).copy(alpha = steamAlpha),
                                style = Stroke(width = 5f, cap = StrokeCap.Round)
                            )
                        }
                        for (i in 0..7) {
                            val px = ((w * 0.12f * (i + 1)) + sin(phase + i) * 28f) % w
                            val py = h - ((particlePhase * 5.5f + i * 75f) % h)
                            drawCircle(
                                color = Color(0xFFFDE68A).copy(alpha = 0.38f),
                                radius = 4f + (i % 3) * 1.5f,
                                center = Offset(px, py)
                            )
                        }
                    }

                    "twilight_study" -> {
                        // Rain streaks on study window
                        for (i in 0..11) {
                            val rx = (w * ((i * 0.09f) % 1f))
                            val ry = ((particlePhase * 16f + i * 85f) % h)
                            drawLine(
                                color = Color(0xFF93C5FD).copy(alpha = 0.28f),
                                start = Offset(rx, ry),
                                end = Offset(rx - 14f, ry + 48f),
                                strokeWidth = 2.5f,
                                cap = StrokeCap.Round
                            )
                        }
                    }

                    "focused_dev_rig" -> {
                        // Floating cyan/indigo telemetry nodes
                        for (i in 0..6) {
                            val px = (w * 0.14f * (i + 1) + cos(phase + i) * 22f) % w
                            val py = h - ((particlePhase * 6.5f + i * 68f) % h)
                            drawCircle(
                                color = if (i % 2 == 0) Color(0xFF38BDF8).copy(alpha = 0.42f) else Color(0xFF818CF8).copy(alpha = 0.42f),
                                radius = 5f,
                                center = Offset(px, py)
                            )
                        }
                    }

                    "rooftop_balcony" -> {
                        // Sunset golden & rose embers
                        for (i in 0..7) {
                            val px = (w * 0.13f * (i + 1) + sin(phase * 1.2f + i) * 30f) % w
                            val py = h - ((particlePhase * 5.8f + i * 70f) % h)
                            drawCircle(
                                color = if (i % 2 == 0) Color(0xFFFBBF24).copy(alpha = 0.45f) else Color(0xFFFB7185).copy(alpha = 0.45f),
                                radius = 4.5f + (i % 2) * 2f,
                                center = Offset(px, py)
                            )
                        }
                    }
                }

                // Bottom & Top gradient scrims for crisp text readability
                drawRect(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color(0xCC040711),
                            Color.Transparent,
                            Color.Transparent,
                            Color(0xEE040711)
                        )
                    )
                )
            }

            // Top Scrim: Location + Live Animation Expression Badge
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp)
                    .align(Alignment.TopCenter),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xAA0B1120))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = scene.accentColor,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(Modifier.width(5.dp))
                    Text(
                        text = scene.location,
                        color = Color(0xFFF1F5F9),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xCC1E1B4B))
                        .border(1.dp, scene.accentColor.copy(alpha = 0.45f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = scene.accentColor,
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(Modifier.width(5.dp))
                    Text(
                        text = animationState,
                        color = Color(0xFFFEF3C7),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Bottom Scrim: Real-Time Voice Equalizer + Current Sanctuary Activity + Thought Bubble
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (speakingLevel > 0.05f || animationState == "Speaking" || animationState == "Listening") {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                        modifier = Modifier.height(20.dp)
                    ) {
                        for (bar in 0..11) {
                            val barFactor = abs(sin(phase * 4f + bar * 0.55f)) * maxOf(0.25f, speakingLevel)
                            val barHeight = (4f + barFactor * 16f).dp
                            Box(
                                modifier = Modifier
                                    .width(3.5.dp)
                                    .height(barHeight)
                                    .clip(CircleShape)
                                    .background(
                                        if (animationState == "Speaking") Color(0xFF818CF8)
                                        else Color(0xFF2DD4BF)
                                    )
                            )
                        }
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = if (animationState == "Speaking") "$companionName is speaking ($voiceName)"
                            else "Listening to you (16kHz PCM Live)...",
                            color = Color(0xFFA5B4FC),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Currently: ${scene.activityTitle}",
                        color = scene.accentColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "Bond $bondLevel% · Energy $energyLevel%",
                        color = Color(0xFFCBD5E1),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                Text(
                    text = "“${customThought ?: scene.thought}”",
                    color = Color(0xFFF8FAFC),
                    fontSize = 12.sp,
                    fontStyle = FontStyle.Italic,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.MusicNote,
                            contentDescription = null,
                            tint = Color(0xFF818CF8),
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = scene.ambientTrack,
                            color = Color(0xFF94A3B8),
                            fontSize = 10.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Text(
                        text = "Voice: $voiceName",
                        color = Color(0xFFCBD5E1),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        if (showSceneSwitcher) {
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                SANCTUARY_SCENES.forEach { s ->
                    val isSelected = s.id == scene.id
                    Surface(
                        color = if (isSelected) Color(0xFF4F46E5) else Color(0xFF111827),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .border(
                                1.dp,
                                if (isSelected) Color(0xFF818CF8) else Color(0xFF1F2937),
                                RoundedCornerShape(12.dp)
                            )
                            .clickable { onSelectScene(s.id) }
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp)
                        ) {
                            Text(
                                text = s.shortLabel,
                                color = if (isSelected) Color.White else Color(0xFF94A3B8),
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        }
    }
}

