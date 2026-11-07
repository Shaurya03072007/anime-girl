package ai.aether.companion.service

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

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
        // Observe window state changes when explicitly authorized by user policy
    }

    override fun onInterrupt() {
        // Handle accessibility interruption gracefully
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    fun captureHierarchySnapshot(): List<Map<String, Any?>> {
        val root = rootInActiveWindow ?: return emptyList()
        val results = mutableListOf<Map<String, Any?>>()
        traverseNode(root, results, 0)
        return results
    }

    private fun traverseNode(
        node: AccessibilityNodeInfo?,
        out: MutableList<Map<String, Any?>>,
        depth: Int
    ) {
        if (node == null || depth > 12) return
        val rect = Rect()
        node.getBoundsInScreen(rect)
        val text = node.text?.toString().orEmpty()
        val desc = node.contentDescription?.toString().orEmpty()
        if (text.isNotBlank() || desc.isNotBlank() || node.isClickable || node.isEditable) {
            out.add(
                mapOf(
                    "viewIdResourceName" to node.viewIdResourceName,
                    "className" to node.className?.toString(),
                    "text" to text,
                    "contentDescription" to desc,
                    "clickable" to node.isClickable,
                    "editable" to node.isEditable,
                    "scrollable" to node.isScrollable,
                    "bounds" to mapOf(
                        "left" to rect.left,
                        "top" to rect.top,
                        "right" to rect.right,
                        "bottom" to rect.bottom
                    )
                )
            )
        }
        for (i in 0 until node.childCount) {
            traverseNode(node.getChild(i), out, depth + 1)
        }
    }

    fun clickNodeByIdOrText(query: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val byId = root.findAccessibilityNodeInfosByViewId(query)
        val candidates = if (!byId.isNullOrEmpty()) byId else root.findAccessibilityNodeInfosByText(query)
        val target = candidates?.firstOrNull { it.isClickable } ?: candidates?.firstOrNull()?.parent
        return target?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
    }

    fun inputTextIntoFocusedField(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    fun performNavigation(navType: String): Boolean {
        val action = when (navType) {
            "HOME" -> GLOBAL_ACTION_HOME
            else -> GLOBAL_ACTION_BACK
        }
        return performGlobalAction(action)
    }
}
