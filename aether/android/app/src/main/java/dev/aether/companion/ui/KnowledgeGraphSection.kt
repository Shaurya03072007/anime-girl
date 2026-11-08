package dev.aether.companion.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

data class MemoryUiItem(
    val id: String,
    val content: String,
    val category: String,
    val epistemicStatus: String,
    val confidence: Double,
    val importance: Double,
    val verificationStatus: String,
    val relatedEntityIds: List<String>,
    val updatedAt: String,
    val score: Double? = null
)

data class EntityUiItem(
    val id: String,
    val name: String,
    val type: String,
    val description: String,
    val mentionCount: Int
)

data class RelationshipUiItem(
    val id: String,
    val sourceEntityId: String,
    val targetEntityId: String,
    val predicate: String
)

@Composable
fun InteractiveKnowledgeGraphCanvas(
    entities: List<EntityUiItem>,
    relationships: List<RelationshipUiItem>,
    selectedEntityId: String?,
    onSelectEntity: (String) -> Unit
) {
    var scale by remember { mutableFloatStateOf(1f) }
    var panOffset by remember { mutableStateOf(Offset.Zero) }
    var nodePositions by remember { mutableStateOf<Map<String, Offset>>(emptyMap()) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(265.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xFF070B16))
            .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(20.dp))
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(entities) {
                    detectTransformGestures { _, pan, zoom, _ ->
                        scale = (scale * zoom).coerceIn(0.65f, 2.5f)
                        panOffset += pan
                    }
                }
                .pointerInput(entities, nodePositions) {
                    detectTapGestures { tapOffset ->
                        val hit = nodePositions.entries.firstOrNull { (_, pos) ->
                            hypot(tapOffset.x - pos.x, tapOffset.y - pos.y) <= 46f
                        }
                        if (hit != null) {
                            onSelectEntity(hit.key)
                        }
                    }
                }
        ) {
            val cx = size.width / 2f + panOffset.x
            val cy = size.height / 2f + panOffset.y
            val radius = (minOf(size.width, size.height) * 0.34f) * scale

            val computed = mutableMapOf<String, Offset>()
            entities.forEachIndexed { idx, ent ->
                if (idx == 0) {
                    computed[ent.id] = Offset(cx, cy)
                } else {
                    val angle = (2.0 * Math.PI * (idx - 1)) / maxOf(1, entities.size - 1)
                    val nx = cx + (cos(angle) * radius).toFloat()
                    val ny = cy + (sin(angle) * radius).toFloat()
                    computed[ent.id] = Offset(nx, ny)
                }
            }
            nodePositions = computed

            // Draw directed relationship edges
            relationships.forEach { rel ->
                val p1 = computed[rel.sourceEntityId]
                val p2 = computed[rel.targetEntityId]
                if (p1 != null && p2 != null) {
                    val isHighlighted =
                        selectedEntityId == rel.sourceEntityId || selectedEntityId == rel.targetEntityId
                    drawLine(
                        color = if (isHighlighted) Color(0xFF818CF8) else Color(0xFF334155),
                        start = p1,
                        end = p2,
                        strokeWidth = if (isHighlighted) 4.5f else 2.2f,
                        cap = StrokeCap.Round
                    )
                }
            }

            // Draw entity nodes
            entities.forEach { ent ->
                val pos = computed[ent.id] ?: return@forEach
                val isSelected = ent.id == selectedEntityId
                val nodeColor = when (ent.type) {
                    "Person" -> Color(0xFFF43F5E)
                    "Project" -> Color(0xFF6366F1)
                    "Technology" -> Color(0xFF06B6D4)
                    "Place" -> Color(0xFF10B981)
                    else -> Color(0xFFF59E0B)
                }
                if (isSelected) {
                    drawCircle(
                        color = nodeColor.copy(alpha = 0.32f),
                        radius = 34f * scale,
                        center = pos
                    )
                }
                drawCircle(
                    color = nodeColor,
                    radius = (if (ent.id == "ent_shaurya") 22f else 17f) * scale.coerceAtMost(1.4f),
                    center = pos
                )
            }
        }

        // Overlay Node Labels & Zoom Controls
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp)
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Interactive Knowledge Graph (Pinch/Pan/Tap Node)",
                color = Color(0xFF94A3B8),
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SmallFloatingActionButton(
                    onClick = { scale = (scale + 0.2f).coerceAtMost(2.4f) },
                    containerColor = Color(0xFF1E293B),
                    contentColor = Color.White,
                    modifier = Modifier.size(28.dp)
                ) {
                    Text("+", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
                SmallFloatingActionButton(
                    onClick = {
                        scale = 1f
                        panOffset = Offset.Zero
                    },
                    containerColor = Color(0xFF1E293B),
                    contentColor = Color.White,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(Icons.Default.CenterFocusStrong, contentDescription = "Reset", modifier = Modifier.size(14.dp))
                }
            }
        }

        // Interactive Entity Chips at Bottom of Graph
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .background(Color(0xCC070B16))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            items(entities) { ent ->
                val selected = ent.id == selectedEntityId
                FilterChip(
                    selected = selected,
                    onClick = { onSelectEntity(ent.id) },
                    label = {
                        Text(
                            text = "${ent.name} (${ent.type})",
                            fontSize = 11.sp,
                            maxLines = 1
                        )
                    }
                )
            }
        }
    }
}

