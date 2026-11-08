package dev.aether.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import dev.aether.companion.ui.ALL_ANIMATION_STATES
import dev.aether.companion.ui.SANCTUARY_SCENES
import dev.aether.companion.service.GhostSpatialCommandBus

class AetherCompanionUnitTest {

    @Test
    fun verifyTwelveReactiveAnimationStatesExist() {
        assertEquals(12, ALL_ANIMATION_STATES.size)
        assertTrue(ALL_ANIMATION_STATES.contains("Idle"))
        assertTrue(ALL_ANIMATION_STATES.contains("Listening"))
        assertTrue(ALL_ANIMATION_STATES.contains("Speaking"))
        assertTrue(ALL_ANIMATION_STATES.contains("Thinking"))
        assertTrue(ALL_ANIMATION_STATES.contains("Processing an action"))
    }

    @Test
    fun verifyFourSanctuaryLifeScenesConfigured() {
        assertEquals(4, SANCTUARY_SCENES.size)
        val ids = SANCTUARY_SCENES.map { it.id }
        assertTrue(ids.contains("coffee_sketchbook"))
        assertTrue(ids.contains("twilight_study"))
        assertTrue(ids.contains("focused_dev_rig"))
        assertTrue(ids.contains("rooftop_balcony"))
    }

    @Test
    fun verifyTenPossessedGhostBehaviorsAndCommandBus() {
        assertEquals(10, GhostSpatialCommandBus.ALL_GHOST_BEHAVIORS.size)
        val behaviorIds = GhostSpatialCommandBus.ALL_GHOST_BEHAVIORS.map { it.first }
        assertTrue(behaviorIds.contains("float_roam"))
        assertTrue(behaviorIds.contains("rush_to_glass"))
        assertTrue(behaviorIds.contains("ceiling_hang_upside_down"))
        assertTrue(behaviorIds.contains("glitch_teleport"))
        assertTrue(behaviorIds.contains("crawl_toward_user"))

        GhostSpatialCommandBus.dispatchBehavior(
            behavior = "rush_to_glass",
            expression = "Surprised",
            speed = 2.4,
            glitchIntensity = 0.55
        )
        assertEquals("rush_to_glass", GhostSpatialCommandBus.currentBehavior.value)

        GhostSpatialCommandBus.updateVoiceState(
            amplitude = 0.78f,
            isSpeaking = true,
            isListening = false,
            echoGateActive = true
        )
        assertTrue(GhostSpatialCommandBus.voiceFrames.value.isSpeaking)
        assertTrue(GhostSpatialCommandBus.voiceFrames.value.echoGateActive)
    }
}

