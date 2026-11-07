package dev.aether.companion.service

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

class AetherAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile
        var instance: AetherAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Window state & foreground app changes can be streamed to CompanionViewModel if authorized
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
        if (node == null || depth > 8) return
        val text = node.text?.toString().orEmpty()
        val desc = node.contentDescription?.toString().orEmpty()
        val resId = node.viewIdResourceName.orEmpty()
        if (text.isNotEmpty() || desc.isNotEmpty() || node.isClickable) {
            val obj = JSONObject().apply {
                put("viewId", resId)
                put("className", node.className?.toString().orEmpty())
                put("text", text)
                put("contentDescription", desc)
                put("clickable", node.isClickable)
                put("scrollable", node.isScrollable)
                put("editable", node.isEditable)
            }
            out.put(obj)
        }
        for (i in 0 until node.childCount) {
            traverseNode(node.getChild(i), out, depth + 1)
        }
    }

    fun clickNodeByTextOrId(target: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val byId = root.findAccessibilityNodeInfosByViewId(target)
        val byText = root.findAccessibilityNodeInfosByText(target)
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
}
