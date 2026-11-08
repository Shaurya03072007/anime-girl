package dev.aether.companion.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

class AetherAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile
        var instance: AetherAccessibilityService? = null
            private set

        private val _foregroundPackage = MutableStateFlow("dev.aether.companion")
        val foregroundPackage: StateFlow<String> = _foregroundPackage.asStateFlow()
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val pkg = event?.packageName?.toString()
        if (!pkg.isNullOrBlank()) {
            _foregroundPackage.value = pkg
        }
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    fun dumpActiveWindowNodes(): JSONArray {
        val root = rootInActiveWindow ?: return JSONArray()
        val array = JSONArray()
        traverseNode(root, array, 0)
        return array
    }

    private fun traverseNode(node: AccessibilityNodeInfo?, out: JSONArray, depth: Int) {
        if (node == null || depth > 10 || out.length() >= 80) return
        val text = node.text?.toString().orEmpty()
        val desc = node.contentDescription?.toString().orEmpty()
        val resId = node.viewIdResourceName.orEmpty()
        val rect = Rect()
        node.getBoundsInScreen(rect)

        if (text.isNotEmpty() || desc.isNotEmpty() || node.isClickable || node.isEditable || node.isScrollable) {
            val obj = JSONObject().apply {
                put("viewId", resId)
                put("className", node.className?.toString().orEmpty())
                put("text", text)
                put("contentDescription", desc)
                put("clickable", node.isClickable)
                put("scrollable", node.isScrollable)
                put("editable", node.isEditable)
                put("bounds", "${rect.left},${rect.top}-${rect.right},${rect.bottom}")
            }
            out.put(obj)
        }
        for (i in 0 until node.childCount) {
            traverseNode(node.getChild(i), out, depth + 1)
        }
    }

    fun clickNodeByTextOrId(target: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val byId = root.findAccessibilityNodeInfosByViewId(target) ?: emptyList()
        val byText = root.findAccessibilityNodeInfosByText(target) ?: emptyList()
        val candidates = (byId + byText)
        for (node in candidates) {
            if (node.isClickable) {
                return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            var parent = node.parent
            while (parent != null) {
                if (parent.isClickable) {
                    return parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                }
                parent = parent.parent
            }
        }
        return false
    }

    fun enterTextInEditableField(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focused != null && focused.isEditable) {
            val args = Bundle().apply {
                putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    text
                )
            }
            return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        }
        return false
    }

    fun performScroll(forward: Boolean = true): Boolean {
        val root = rootInActiveWindow ?: return false
        val scrollable = findScrollableNode(root) ?: return false
        val action = if (forward) {
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        } else {
            AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        }
        return scrollable.performAction(action)
    }

    private fun findScrollableNode(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isScrollable) return node
        for (i in 0 until node.childCount) {
            val found = findScrollableNode(node.getChild(i))
            if (found != null) return found
        }
        return null
    }

    fun performSwipeGesture(startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long = 300L): Boolean {
        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0L, durationMs)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGesture(gesture, null, null)
    }

    fun performGlobalNavigation(navType: String): Boolean {
        val action = when (navType.uppercase()) {
            "HOME" -> GLOBAL_ACTION_HOME
            "RECENTS" -> GLOBAL_ACTION_RECENTS
            "NOTIFICATIONS" -> GLOBAL_ACTION_NOTIFICATIONS
            else -> GLOBAL_ACTION_BACK
        }
        return performGlobalAction(action)
    }
}
