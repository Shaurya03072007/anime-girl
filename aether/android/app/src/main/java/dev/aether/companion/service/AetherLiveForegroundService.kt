package dev.aether.companion.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import dev.aether.companion.AetherApplication
import dev.aether.companion.MainActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AetherLiveForegroundService : Service() {

    companion object {
        const val ACTION_START_LIVE = "dev.aether.companion.START_LIVE"
        const val ACTION_STOP_LIVE = "dev.aether.companion.STOP_LIVE"
        const val EXTRA_MODE = "mode"

        private val _isRunning = MutableStateFlow(false)
        val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()

        private val _activeMode = MutableStateFlow("Idle")
        val activeMode: StateFlow<String> = _activeMode.asStateFlow()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_LIVE -> {
                _isRunning.value = false
                _activeMode.value = "Idle"
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val mode = intent?.getStringExtra(EXTRA_MODE) ?: "Live Voice Session"
                _activeMode.value = mode
                _isRunning.value = true
                val notification = buildNotification(mode)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        1001,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    )
                } else {
                    startForeground(1001, notification)
                }
            }
        }
        return START_STICKY
    }

    private fun buildNotification(mode: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val pendingOpen = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val stopIntent = Intent(this, AetherLiveForegroundService::class.java).apply {
            action = ACTION_STOP_LIVE
        }
        val pendingStop = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, AetherApplication.CHANNEL_LIVE_COMPANION)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Aria · $mode Active")
            .setContentText("Tap to open Project Aether or stop session immediately.")
            .setOngoing(true)
            .setContentIntent(pendingOpen)
            .addAction(android.R.drawable.ic_media_pause, "Stop Immediately", pendingStop)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        _isRunning.value = false
        _activeMode.value = "Idle"
        super.onDestroy()
    }
}

