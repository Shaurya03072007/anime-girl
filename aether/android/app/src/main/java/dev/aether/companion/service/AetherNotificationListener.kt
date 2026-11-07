package dev.aether.companion.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

data class ObservedAndroidNotification(
    val key: String,
    val packageName: String,
    val title: String,
    val text: String,
    val timestamp: Long
)

class AetherNotificationListener : NotificationListenerService() {

    companion object {
        private val _events = MutableSharedFlow<ObservedAndroidNotification>(extraBufferCapacity = 32)
        val events: SharedFlow<ObservedAndroidNotification> = _events.asSharedFlow()

        private val EXCLUDED_PACKAGES = setOf(
            "com.whatsapp",
            "com.google.android.apps.nbu.paisa.user",
            "com.phonepe.app"
        )
        private val OTP_REGEX = Regex(
            "\\b(otp|one-time password|verification code|passcode|cvv|pin)\\b",
            RegexOption.IGNORE_CASE
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val notification = sbn ?: return
        val pkg = notification.packageName ?: return
        if (pkg in EXCLUDED_PACKAGES) return

        val extras = notification.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        if (title.isBlank() && text.isBlank()) return

        // Privacy scrubber: never forward OTPs or banking codes
        if (OTP_REGEX.containsMatchIn("$title $text")) return

        _events.tryEmit(
            ObservedAndroidNotification(
                key = notification.key,
                packageName = pkg,
                title = title,
                text = text,
                timestamp = notification.postTime
            )
        )
    }
}
