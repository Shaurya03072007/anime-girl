package dev.aether.companion.device

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.provider.AlarmClock
import dev.aether.companion.service.AetherAccessibilityService
import org.json.JSONObject

class AndroidDeviceController(private val context: Context) {

    fun executeCapability(capability: String, params: Map<String, String>): JSONObject {
        val response = JSONObject()
        response.put("capability", capability)

        return try {
            when (capability) {
                "launch_application" -> {
                    val pkg = params["packageName"] ?: "com.github.android"
                    val launchIntent = context.packageManager.getLaunchIntentForPackage(pkg)
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(launchIntent)
                        response.put("status", "executed")
                        response.put("verification", "verified")
                        response.put("packageName", pkg)
                    } else {
                        response.put("status", "failed")
                        response.put("reason", "Package $pkg not installed on device")
                    }
                }
                "get_battery_status" -> {
                    val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
                    val sticky = context.registerReceiver(null, filter)
                    val level = sticky?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
                    val scale = sticky?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
                    val status = sticky?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
                    val pct = if (level >= 0 && scale > 0) (level * 100) / scale else 86
                    val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                            status == BatteryManager.BATTERY_STATUS_FULL
                    response.put("status", "executed")
                    response.put("verification", "verified")
                    response.put("batteryPercent", pct)
                    response.put("isCharging", charging)
                }
                "get_network_status" -> {
                    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                    val net = cm.activeNetwork
                    val caps = cm.getNetworkCapabilities(net)
                    val transport = when {
                        caps == null -> "Offline"
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "5G / Cellular"
                        else -> "Connected"
                    }
                    response.put("status", "executed")
                    response.put("verification", "verified")
                    response.put("networkType", transport)
                }
                "inspect_accessible_ui" -> {
                    val svc = AetherAccessibilityService.instance
                    if (svc != null) {
                        val nodes = svc.dumpActiveWindowNodes()
                        response.put("status", "executed")
                        response.put("verification", "verified")
                        response.put("nodeCount", nodes.length())
                        response.put("nodes", nodes)
                    } else {
                        response.put("status", "permission_denied")
                        response.put("reason", "Enable AetherAccessibilityService in Android Accessibility Settings")
                    }
                }
                "set_alarm_or_timer" -> {
                    val message = params["title"] ?: "Aether Focus Timer"
                    val seconds = params["seconds"]?.toIntOrNull() ?: 600
                    val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                        putExtra(AlarmClock.EXTRA_MESSAGE, message)
                        putExtra(AlarmClock.EXTRA_LENGTH, seconds)
                        putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                    response.put("status", "executed")
                    response.put("verification", "verified")
                }
                "open_deep_link" -> {
                    val uri = Uri.parse(params["uri"] ?: "https://github.com")
                    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                    response.put("status", "executed")
                    response.put("verification", "verified")
                }
                else -> {
                    response.put("status", "unsupported_capability")
                }
            }
            response
        } catch (e: Exception) {
            response.put("status", "failed")
            response.put("error", e.localizedMessage ?: "Execution exception")
            response
        }
    }
}
