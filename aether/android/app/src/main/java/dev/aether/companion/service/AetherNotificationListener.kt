package dev.aether.companion.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow

data class ObservedAndroidNotification(
    val key: String,
    val packageName: String,
    val title: String,
    val text: String,
    val timestamp: Long,
    val blockedByPrivacy: Boolean = false
)

class AetherNotificationListener : NotificationListenerService() {

    companion object {
        @Volatile
        var instance: AetherNotificationListener? = null
            private set

        private val _events = MutableSharedFlow<ObservedAndroidNotification>(extraBufferCapacity = 32)
        val events: SharedFlow<ObservedAndroidNotification> = _events.asSharedFlow()

        private val _recentNotifications = MutableStateFlow<List<ObservedAndroidNotification>>(emptyList())
        val recentNotifications: StateFlow<List<ObservedAndroidNotification>> = _recentNotifications.asStateFlow()

        val excludedPackages = mutableSetOf(
            "com.whatsapp",
            "com.google.android.apps.nbu.paisa.user",
            "com.phonepe.app"
        )

        private val OTP_REGEX = Regex(
            "\\b(otp|one-time password|verification code|passcode|cvv|pin|netbanking)\\b",
            RegexOption.IGNORE_CASE
        )
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
    }

    override fun onListenerDisconnected() {
        instance = null
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val notification = sbn ?: return
        val pkg = notification.packageName ?: return
        if (pkg == packageName) return

        val extras = notification.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        if (title.isBlank() && text.isBlank()) return

        val isExcluded = pkg in excludedPackages
        val isOtp = OTP_REGEX.containsMatchIn("$title $text")

        if (isExcluded || isOtp) {
            val masked = ObservedAndroidNotification(
                key = notification.key,
                packageName = pkg,
                title = if (isOtp) "Protected OTP / Verification Code" else "Excluded App ($pkg)",
                text = "Content scrubbed locally by Project Aether Privacy Filter — never uploaded.",
                timestamp = notification.postTime,
                blockedByPrivacy = true
            )
            _recentNotifications.value = (listOf(masked) + _recentNotifications.value).take(25)
            return
        }

        val item = ObservedAndroidNotification(
            key = notification.key,
            packageName = pkg,
            title = title,
            text = text,
            timestamp = notification.postTime,
            blockedByPrivacy = false
        )
        _recentNotifications.value = (listOf(item) + _recentNotifications.value).take(25)
        _events.tryEmit(item)
    }

    fun dismissNotificationByKey(key: String): Boolean {
        return runCatching {
            cancelNotification(key)
            _recentNotifications.value = _recentNotifications.value.filterNot { it.key == key }
            true
        }.getOrDefault(false)
    }
}
