package dev.aether.companion

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class AetherApplication : Application() {

    companion object {
        const val CHANNEL_LIVE_COMPANION = "aether_live_companion_channel"
        const val CHANNEL_PROACTIVE_ALERTS = "aether_proactive_alerts_channel"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            val liveChannel = NotificationChannel(
                CHANNEL_LIVE_COMPANION,
                "Aria Live Voice & Screen Observation",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Ongoing indicator when Aria Live Voice or authorized Screen Capture is active."
            }
            val proactiveChannel = NotificationChannel(
                CHANNEL_PROACTIVE_ALERTS,
                "Aria Proactive Companion Suggestions",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Context-aware suggestions, reminders, and follow-ups from Aria."
            }
            nm.createNotificationChannel(liveChannel)
            nm.createNotificationChannel(proactiveChannel)
        }
    }
}

