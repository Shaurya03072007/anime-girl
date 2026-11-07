import {
  AccessibleUiNode,
  ActionRiskLevel,
  AndroidNotificationItem,
  DeviceActionExecution,
  DeviceCapabilityName,
  DevicePermissionsState,
  InstalledAppInfo,
} from '../types/aether';

export interface AndroidRuntimeState {
  deviceModel: string;
  androidVersion: string;
  sdkInt: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryTempC: number;
  networkType: 'Wi-Fi 6E (5GHz)' | '5G Standalone' | 'Offline';
  ssid: string;
  ipAddress: string;
  foregroundPackage: string;
  foregroundActivity: string;
  screenScrollOffsetY: number;
  lastEnteredText: string;
  permissions: DevicePermissionsState;
  installedApps: InstalledAppInfo[];
  accessibleNodes: AccessibleUiNode[];
  notifications: AndroidNotificationItem[];
  calendarEvents: { id: string; title: string; startTime: string; location?: string }[];
  actionHistory: DeviceActionExecution[];
}

const CAPABILITY_RISK_MAP: Record<DeviceCapabilityName, ActionRiskLevel> = {
  get_installed_applications: 'low',
  get_foreground_application: 'low',
  inspect_accessible_ui: 'low',
  read_authorized_notifications: 'low',
  get_battery_status: 'low',
  get_network_status: 'low',
  get_device_information: 'low',
  create_notification: 'low',
  create_reminder: 'medium',
  launch_application: 'medium',
  open_url: 'medium',
  open_settings: 'medium',
  navigate_to_supported_system_page: 'medium',
  perform_accessibility_action: 'medium',
  request_screen_capture: 'medium',
  capture_authorized_screen_frame: 'medium',
  tap_accessible_element: 'medium',
  swipe: 'medium',
  scroll: 'medium',
  input_text: 'medium',
  press_back: 'low',
  press_home_where_supported: 'low',
  dismiss_supported_notifications: 'medium',
  get_location_with_permission: 'medium',
  access_camera_with_permission: 'high',
  create_calendar_event_with_permission: 'medium',
  initiate_supported_phone_intent: 'high',
};

export function getCapabilityRiskLevel(capability: DeviceCapabilityName): ActionRiskLevel {
  return CAPABILITY_RISK_MAP[capability] ?? 'medium';
}

export function getRequiredPermissionKey(
  capability: DeviceCapabilityName
): keyof DevicePermissionsState | null {
  switch (capability) {
    case 'inspect_accessible_ui':
    case 'perform_accessibility_action':
    case 'tap_accessible_element':
    case 'swipe':
    case 'scroll':
    case 'input_text':
    case 'press_back':
    case 'press_home_where_supported':
      return 'accessibilityService';
    case 'read_authorized_notifications':
    case 'dismiss_supported_notifications':
      return 'notificationListener';
    case 'capture_authorized_screen_frame':
      return 'mediaProjectionActive';
    case 'get_location_with_permission':
      return 'location';
    case 'access_camera_with_permission':
      return 'camera';
    case 'create_calendar_event_with_permission':
      return 'calendar';
    default:
      return null;
  }
}

export function buildAccessibleTreeForPackage(
  packageName: string,
  scrollY: number,
  lastText: string
): AccessibleUiNode[] {
  if (packageName === 'com.android.settings') {
    return [
      {
        nodeId: 'node_settings_header',
        className: 'android.widget.TextView',
        text: 'Settings',
        bounds: { x: 24, y: 48, width: 320, height: 44 },
        clickable: false,
        editable: false,
        scrollable: false,
      },
      {
        nodeId: 'node_settings_accessibility',
        className: 'androidx.preference.PreferenceView',
        text: 'Accessibility · Aether Companion Service (Active)',
        contentDescription: 'Open Accessibility settings',
        bounds: { x: 16, y: 120 - scrollY, width: 358, height: 68 },
        clickable: true,
        editable: false,
        scrollable: false,
      },
      {
        nodeId: 'node_settings_battery',
        className: 'androidx.preference.PreferenceView',
        text: 'Battery · 86% (Unrestricted for Aether ForegroundEngine)',
        contentDescription: 'Open Battery optimization settings',
        bounds: { x: 16, y: 200 - scrollY, width: 358, height: 68 },
        clickable: true,
        editable: false,
        scrollable: false,
      },
    ];
  }

  if (packageName === 'com.termux' || packageName === 'com.github.android') {
    return [
      {
        nodeId: 'node_repo_title',
        className: 'android.widget.TextView',
        text: 'aether-monorepo / main · All CI checks passing',
        bounds: { x: 20, y: 52, width: 350, height: 40 },
        clickable: true,
        editable: false,
        scrollable: false,
      },
      {
        nodeId: 'node_search_input',
        className: 'android.widget.EditText',
        text: lastText || 'Search commits, PRs, or issues...',
        contentDescription: 'Repository search field',
        bounds: { x: 20, y: 108, width: 350, height: 48 },
        clickable: true,
        editable: true,
        scrollable: false,
        focused: Boolean(lastText),
      },
      {
        nodeId: 'node_pr_merge_btn',
        className: 'android.widget.Button',
        text: 'Review PR #42: ADK Runner.run_live() Audio Bridge',
        contentDescription: 'Open Pull Request 42',
        bounds: { x: 20, y: 176 - scrollY, width: 350, height: 56 },
        clickable: true,
        editable: false,
        scrollable: false,
      },
      {
        nodeId: 'node_commit_list',
        className: 'androidx.recyclerview.widget.RecyclerView',
        text: 'Scrollable Commit History (pgvector schema + Room migration)',
        bounds: { x: 20, y: 248, width: 350, height: 320 },
        clickable: false,
        editable: false,
        scrollable: true,
      },
    ];
  }

  return [
    {
      nodeId: 'node_aether_root',
      className: 'androidx.compose.ui.platform.ComposeView',
      text: `Active Surface: ${packageName}`,
      bounds: { x: 16, y: 44, width: 358, height: 48 },
      clickable: false,
      editable: false,
      scrollable: false,
    },
    {
      nodeId: 'node_quick_input',
      className: 'android.widget.EditText',
      text: lastText || 'Tap to enter note or command...',
      contentDescription: 'Primary input field',
      bounds: { x: 16, y: 112, width: 358, height: 52 },
      clickable: true,
      editable: true,
      scrollable: false,
      focused: Boolean(lastText),
    },
    {
      nodeId: 'node_primary_action',
      className: 'android.widget.Button',
      text: 'Sync Workspace State',
      contentDescription: 'Trigger workspace synchronization',
      bounds: { x: 16, y: 184 - scrollY, width: 358, height: 54 },
      clickable: true,
      editable: false,
      scrollable: false,
    },
  ];
}

/**
 * Executes a native Android DeviceController capability against the current
 * runtime state, validating permissions, risk policies, and returning a verified
 * DeviceActionExecution record and updated state.
 */
export function executeDeviceCapability(
  state: AndroidRuntimeState,
  capability: DeviceCapabilityName,
  parameters: Record<string, unknown> = {},
  options: {
    initiatedBy?: DeviceActionExecution['initiatedBy'];
    explicitApprovalGranted?: boolean;
  } = {}
): {
  state: AndroidRuntimeState;
  execution: DeviceActionExecution;
} {
  const now = new Date().toISOString();
  const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const riskLevel = getCapabilityRiskLevel(capability);
  const initiatedBy = options.initiatedBy ?? 'user_direct';

  // 1. Check required OS permission
  const requiredPerm = getRequiredPermissionKey(capability);
  if (requiredPerm && !state.permissions[requiredPerm]) {
    const deniedRecord: DeviceActionExecution = {
      actionId,
      actionType: capability,
      parameters,
      requestTimestamp: now,
      permissionStatus: 'denied',
      executionStatus: 'failed',
      result: null,
      errorDetails: `Permission '${requiredPerm}' is not currently granted. Enable it in Phone > Permissions or Settings.`,
      verificationStatus: 'failed_verification',
      riskLevel,
      initiatedBy,
    };
    return {
      state: {
        ...state,
        actionHistory: [deniedRecord, ...state.actionHistory],
      },
      execution: deniedRecord,
    };
  }

  // 2. High-risk autonomous execution guard
  if (
    riskLevel === 'high' &&
    initiatedBy !== 'user_direct' &&
    !options.explicitApprovalGranted
  ) {
    const pendingRecord: DeviceActionExecution = {
      actionId,
      actionType: capability,
      parameters,
      requestTimestamp: now,
      permissionStatus: 'requires_prompt',
      executionStatus: 'pending_approval',
      result: {
        message: 'High-risk operation paused awaiting explicit user confirmation.',
      },
      verificationStatus: 'unverified',
      riskLevel,
      initiatedBy,
    };
    return {
      state: {
        ...state,
        actionHistory: [pendingRecord, ...state.actionHistory],
      },
      execution: pendingRecord,
    };
  }

  // 3. Execute actual capability logic & mutate runtime state
  let updatedState = { ...state };
  let resultPayload: Record<string, unknown> = {};

  switch (capability) {
    case 'get_battery_status': {
      resultPayload = {
        batteryLevel: state.batteryLevel,
        isCharging: state.isCharging,
        temperatureCelsius: state.batteryTempC,
        health: 'GOOD',
        powerSaveMode: false,
      };
      break;
    }

    case 'get_network_status': {
      resultPayload = {
        connected: state.networkType !== 'Offline',
        networkType: state.networkType,
        ssid: state.ssid,
        ipAddress: state.ipAddress,
        metered: false,
        signalStrengthDbm: -54,
      };
      break;
    }

    case 'get_device_information': {
      resultPayload = {
        model: state.deviceModel,
        androidVersion: state.androidVersion,
        sdkInt: state.sdkInt,
        securityPatch: '2026-10-05',
        abis: ['arm64-v8a'],
        aetherServiceStatus: state.permissions.foregroundService ? 'RUNNING_FOREGROUND' : 'IDLE',
      };
      break;
    }

    case 'get_installed_applications': {
      resultPayload = {
        count: state.installedApps.length,
        applications: state.installedApps,
      };
      break;
    }

    case 'get_foreground_application': {
      resultPayload = {
        packageName: state.foregroundPackage,
        activityName: state.foregroundActivity,
        observedAt: now,
      };
      break;
    }

    case 'launch_application': {
      const targetPkg = String(parameters.packageName || 'com.github.android');
      const matchedApp = state.installedApps.find(
        (a) =>
          a.packageName.toLowerCase() === targetPkg.toLowerCase() ||
          a.appName.toLowerCase().includes(targetPkg.toLowerCase())
      );
      const resolvedPkg = matchedApp ? matchedApp.packageName : targetPkg;
      const resolvedAppName = matchedApp ? matchedApp.appName : targetPkg;
      const newNodes = buildAccessibleTreeForPackage(resolvedPkg, 0, '');
      updatedState = {
        ...updatedState,
        foregroundPackage: resolvedPkg,
        foregroundActivity: `${resolvedPkg}.MainActivity`,
        screenScrollOffsetY: 0,
        accessibleNodes: newNodes,
      };
      resultPayload = {
        launchedPackage: resolvedPkg,
        appName: resolvedAppName,
        foregroundVerified: updatedState.foregroundPackage === resolvedPkg,
        visibleNodeCount: newNodes.length,
      };
      break;
    }

    case 'open_settings':
    case 'navigate_to_supported_system_page': {
      const section = String(parameters.section || 'ACCESSIBILITY_SETTINGS');
      const newNodes = buildAccessibleTreeForPackage('com.android.settings', 0, '');
      updatedState = {
        ...updatedState,
        foregroundPackage: 'com.android.settings',
        foregroundActivity: `com.android.settings.${section}`,
        accessibleNodes: newNodes,
      };
      resultPayload = {
        openedPackage: 'com.android.settings',
        section,
        verifiedForeground: true,
      };
      break;
    }

    case 'open_url': {
      const url = String(parameters.url || 'https://google.github.io/adk-docs/');
      updatedState = {
        ...updatedState,
        foregroundPackage: 'com.android.chrome',
        foregroundActivity: 'org.chromium.chrome.browser.ChromeTabbedActivity',
        accessibleNodes: buildAccessibleTreeForPackage('com.android.chrome', 0, url),
      };
      resultPayload = {
        intentAction: 'android.intent.action.VIEW',
        uri: url,
        browserPackage: 'com.android.chrome',
      };
      break;
    }

    case 'inspect_accessible_ui': {
      resultPayload = {
        packageName: state.foregroundPackage,
        activityName: state.foregroundActivity,
        nodeCount: state.accessibleNodes.length,
        nodes: state.accessibleNodes,
      };
      break;
    }

    case 'tap_accessible_element':
    case 'perform_accessibility_action': {
      const targetNodeId = String(
        parameters.nodeId || state.accessibleNodes.find((n) => n.clickable)?.nodeId || 'node_primary_action'
      );
      const node = state.accessibleNodes.find((n) => n.nodeId === targetNodeId);
      resultPayload = {
        nodeId: targetNodeId,
        actionPerformed: 'ACTION_CLICK',
        matchedText: node ? node.text : 'Primary Interactive Element',
        packageName: state.foregroundPackage,
      };
      break;
    }

    case 'input_text': {
      const textToEnter = String(parameters.text || 'Runner.run_live() verified');
      const updatedNodes = buildAccessibleTreeForPackage(
        state.foregroundPackage,
        state.screenScrollOffsetY,
        textToEnter
      );
      updatedState = {
        ...updatedState,
        lastEnteredText: textToEnter,
        accessibleNodes: updatedNodes,
      };
      resultPayload = {
        actionPerformed: 'ACTION_SET_TEXT',
        enteredText: textToEnter,
        targetNodeId: updatedNodes.find((n) => n.editable)?.nodeId ?? 'node_quick_input',
      };
      break;
    }

    case 'scroll':
    case 'swipe': {
      const deltaY = Number(parameters.deltaY ?? 30);
      const nextOffset = Math.max(0, Math.min(120, state.screenScrollOffsetY + deltaY));
      const updatedNodes = buildAccessibleTreeForPackage(
        state.foregroundPackage,
        nextOffset,
        state.lastEnteredText
      );
      updatedState = {
        ...updatedState,
        screenScrollOffsetY: nextOffset,
        accessibleNodes: updatedNodes,
      };
      resultPayload = {
        gesture: capability === 'scroll' ? 'ACTION_SCROLL_FORWARD' : 'GESTURE_SWIPE_VERTICAL',
        previousOffsetY: state.screenScrollOffsetY,
        newOffsetY: nextOffset,
      };
      break;
    }

    case 'press_back':
    case 'press_home_where_supported': {
      const nextPkg =
        capability === 'press_home_where_supported'
          ? 'com.google.android.apps.nexuslauncher'
          : 'ai.aether.companion';
      const updatedNodes = buildAccessibleTreeForPackage(nextPkg, 0, '');
      updatedState = {
        ...updatedState,
        foregroundPackage: nextPkg,
        foregroundActivity: `${nextPkg}.MainActivity`,
        screenScrollOffsetY: 0,
        accessibleNodes: updatedNodes,
      };
      resultPayload = {
        globalAction:
          capability === 'press_home_where_supported' ? 'GLOBAL_ACTION_HOME' : 'GLOBAL_ACTION_BACK',
        resultingForegroundPackage: nextPkg,
      };
      break;
    }

    case 'request_screen_capture': {
      updatedState = {
        ...updatedState,
        permissions: {
          ...updatedState.permissions,
          mediaProjectionActive: true,
        },
      };
      resultPayload = {
        mediaProjectionTokenGranted: true,
        ongoingIndicatorVisible: true,
        message: 'MediaProjection session authorized by user with persistent status bar indicator.',
      };
      break;
    }

    case 'capture_authorized_screen_frame': {
      resultPayload = {
        frameId: `frame_${Date.now()}`,
        resolution: '1080x2400',
        foregroundPackage: state.foregroundPackage,
        extractedSummary: `Screen shows ${state.foregroundPackage} with ${state.accessibleNodes.length} accessible UI elements. Primary text: "${state.accessibleNodes[0]?.text ?? ''}"`,
        visibleElements: state.accessibleNodes.map((n) => ({
          id: n.nodeId,
          text: n.text,
          clickable: n.clickable,
        })),
      };
      break;
    }

    case 'read_authorized_notifications': {
      const excludedSet = new Set(
        state.installedApps.filter((a) => a.isExcludedFromObservation).map((a) => a.packageName)
      );
      const permitted = state.notifications.filter(
        (n) => !n.dismissed && !excludedSet.has(n.packageName)
      );
      resultPayload = {
        permittedCount: permitted.length,
        excludedPackagesFiltered: Array.from(excludedSet),
        notifications: permitted,
      };
      break;
    }

    case 'dismiss_supported_notifications': {
      const targetId = parameters.notificationId ? String(parameters.notificationId) : undefined;
      const updatedNotifs = state.notifications.map((n) =>
        !targetId || n.id === targetId ? { ...n, dismissed: true } : n
      );
      updatedState = {
        ...updatedState,
        notifications: updatedNotifs,
      };
      resultPayload = {
        dismissedNotificationId: targetId ?? 'ALL_ACTIVE',
        remainingActiveCount: updatedNotifs.filter((n) => !n.dismissed).length,
      };
      break;
    }

    case 'create_notification': {
      const title = String(parameters.title || 'Aether Companion Insight');
      const text = String(parameters.text || 'Memory consolidation complete for Project Aether.');
      const newNotif: AndroidNotificationItem = {
        id: `notif_${Date.now()}`,
        packageName: 'ai.aether.companion',
        appName: 'Aether Companion',
        title,
        text,
        timestamp: now,
        category: 'system',
        dismissed: false,
      };
      updatedState = {
        ...updatedState,
        notifications: [newNotif, ...updatedState.notifications],
      };
      resultPayload = {
        notificationId: newNotif.id,
        channelId: 'aether_proactive_channel',
        postedAt: now,
      };
      break;
    }

    case 'create_reminder':
    case 'create_calendar_event_with_permission': {
      const title = String(parameters.title || 'Review ADK Memory Graph Migration');
      const startTime = String(parameters.startTime || new Date(Date.now() + 3600_000).toISOString());
      const newEvt = {
        id: `cal_${Date.now()}`,
        title,
        startTime,
        location: parameters.location ? String(parameters.location) : 'Android Studio / Remote',
      };
      updatedState = {
        ...updatedState,
        calendarEvents: [newEvt, ...updatedState.calendarEvents],
      };
      resultPayload = {
        createdId: newEvt.id,
        title: newEvt.title,
        scheduledFor: newEvt.startTime,
        provider: capability === 'create_calendar_event_with_permission' ? 'CalendarContract.Events' : 'AetherWorkManagerReminder',
      };
      break;
    }

    case 'get_location_with_permission': {
      resultPayload = {
        latitude: 17.385,
        longitude: 78.4867,
        locality: 'Hyderabad, Telangana',
        accuracyMeters: 14.2,
        provider: 'FusedLocationProviderClient',
      };
      break;
    }

    case 'access_camera_with_permission': {
      resultPayload = {
        cameraId: '0 (Back Wide)',
        lifecycleOwner: 'AetherMainActivity',
        captureStatus: 'AUTHORIZED_SINGLE_FRAME_READY',
        indicatorActive: true,
      };
      break;
    }

    case 'initiate_supported_phone_intent': {
      const action = String(parameters.intentAction || 'android.intent.action.SENDTO');
      const target = String(parameters.dataUri || 'mailto:team@aether.dev');
      resultPayload = {
        intentAction: action,
        dataUri: target,
        dispatchedToChooser: true,
        note: 'Opened Android system chooser for user final confirmation.',
      };
      break;
    }
  }

  const executionRecord: DeviceActionExecution = {
    actionId,
    actionType: capability,
    parameters,
    requestTimestamp: now,
    permissionStatus: 'granted',
    executionStatus: 'executed',
    result: resultPayload,
    verificationStatus: 'verified',
    riskLevel,
    initiatedBy,
  };

  updatedState = {
    ...updatedState,
    actionHistory: [executionRecord, ...updatedState.actionHistory],
  };

  return {
    state: updatedState,
    execution: executionRecord,
  };
}
