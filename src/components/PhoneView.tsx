import React, { useState } from 'react';
import {
  Smartphone,
  ShieldCheck,
  Eye,
  EyeOff,
  Play,
  Bell,
  Terminal,
  ArrowLeft,
  Home,
  ArrowDown,
  MousePointerClick,
} from 'lucide-react';
import {
  DeviceCapabilityName,
  DevicePermissionsState,
} from '../types/aether';
import { AndroidRuntimeState } from '../engine/deviceController';

interface PhoneViewProps {
  androidState: AndroidRuntimeState;
  onExecuteCapability: (
    capability: DeviceCapabilityName,
    parameters?: Record<string, unknown>
  ) => Promise<void>;
  onUpdatePermissions: (
    permissions?: Partial<DevicePermissionsState>,
    toggleExcludedPackage?: string
  ) => Promise<void>;
  onTriggerAndroidEvent: (payload: {
    eventType: string;
    packageName: string;
    title: string;
    content: string;
  }) => Promise<void>;
}

const ALL_CAPABILITIES: {
  name: DeviceCapabilityName;
  label: string;
  defaultParams: Record<string, unknown>;
}[] = [
  { name: 'get_battery_status', label: 'Get Battery Status', defaultParams: {} },
  { name: 'get_network_status', label: 'Get Network Status', defaultParams: {} },
  { name: 'get_device_information', label: 'Get Device Information', defaultParams: {} },
  { name: 'get_foreground_application', label: 'Get Foreground Application', defaultParams: {} },
  { name: 'get_installed_applications', label: 'Get Installed Applications', defaultParams: {} },
  {
    name: 'launch_application',
    label: 'Launch Application',
    defaultParams: { packageName: 'com.termux' },
  },
  {
    name: 'inspect_accessible_ui',
    label: 'Inspect Accessible UI Tree',
    defaultParams: {},
  },
  {
    name: 'tap_accessible_element',
    label: 'Tap Accessible Element',
    defaultParams: { nodeId: 'node_pr_merge_btn' },
  },
  {
    name: 'input_text',
    label: 'Input Text via Accessibility',
    defaultParams: { text: 'ADK Runner.run_live() verified' },
  },
  { name: 'scroll', label: 'Scroll Active View', defaultParams: { deltaY: 35 } },
  { name: 'swipe', label: 'Swipe Vertical Gesture', defaultParams: { deltaY: 45 } },
  { name: 'press_back', label: 'Press Back (Global Action)', defaultParams: {} },
  {
    name: 'press_home_where_supported',
    label: 'Press Home (Global Action)',
    defaultParams: {},
  },
  {
    name: 'open_settings',
    label: 'Open System Settings',
    defaultParams: { section: 'ACCESSIBILITY_SETTINGS' },
  },
  {
    name: 'open_url',
    label: 'Open URL in Browser',
    defaultParams: { url: 'https://google.github.io/adk-docs/' },
  },
  {
    name: 'request_screen_capture',
    label: 'Authorize MediaProjection Capture',
    defaultParams: {},
  },
  {
    name: 'capture_authorized_screen_frame',
    label: 'Capture Screen Frame',
    defaultParams: {},
  },
  {
    name: 'read_authorized_notifications',
    label: 'Read Authorized Notifications',
    defaultParams: {},
  },
  {
    name: 'dismiss_supported_notifications',
    label: 'Dismiss Supported Notifications',
    defaultParams: {},
  },
  {
    name: 'create_notification',
    label: 'Post Companion Notification',
    defaultParams: {
      title: 'Aether Memory Sync',
      text: 'Consolidated 2 new episodic records.',
    },
  },
  {
    name: 'create_reminder',
    label: 'Create WorkManager Reminder',
    defaultParams: { title: 'Test Pixel 9 Pro Voice Barge-in' },
  },
  {
    name: 'get_location_with_permission',
    label: 'Get Location (FusedProvider)',
    defaultParams: {},
  },
  {
    name: 'create_calendar_event_with_permission',
    label: 'Create Calendar Event',
    defaultParams: { title: 'ADK Architecture Sync' },
  },
];

export const PhoneView: React.FC<PhoneViewProps> = ({
  androidState,
  onExecuteCapability,
  onUpdatePermissions,
  onTriggerAndroidEvent,
}) => {
  const [selectedCapability, setSelectedCapability] =
    useState<DeviceCapabilityName>('launch_application');
  const [customParamText, setCustomParamText] = useState('com.termux');
  const [eventTitle, setEventTitle] = useState('CI Pipeline Passed on PR #42');
  const [eventContent, setEventContent] = useState(
    'Ananya approved the PostgreSQL pgvector HNSW migration on Project Aether.'
  );
  const [eventPkg, setEventPkg] = useState('com.github.android');

  const handleRunCapability = async () => {
    const preset = ALL_CAPABILITIES.find((c) => c.name === selectedCapability);
    const params = { ...(preset?.defaultParams || {}) };
    if (selectedCapability === 'launch_application' && customParamText.trim()) {
      params.packageName = customParamText.trim();
    } else if (selectedCapability === 'input_text' && customParamText.trim()) {
      params.text = customParamText.trim();
    } else if (selectedCapability === 'open_url' && customParamText.trim()) {
      params.url = customParamText.trim();
    }
    await onExecuteCapability(selectedCapability, params);
  };

  return (
    <div className="space-y-6">
      {/* Ongoing MediaProjection Indicator Banner when active */}
      {androidState.permissions.mediaProjectionActive && (
        <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                MediaProjection Screen Observation Active
              </p>
              <p className="text-xs text-amber-300/80">
                Authorized single-frame capture is enabled for {androidState.foregroundPackage}. No silent background recording is performed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUpdatePermissions({ mediaProjectionActive: false })}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Stop Screen Capture Immediately</span>
          </button>
        </div>
      )}

      {/* Top Row: Live Android Surface & Accessible UI Hierarchy (5 cols) + Capability Runner & Permissions (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Android Device Viewport & Accessibility Inspector */}
        <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Live Android Viewport & Accessible UI
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {androidState.deviceModel} · {androidState.androidVersion}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {androidState.batteryLevel}% · {androidState.networkType}
            </span>
          </div>

          {/* Phone Screen Frame */}
          <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span className="font-mono truncate">{androidState.foregroundPackage}</span>
              <span className="font-mono tabular-nums">
                ScrollY: {androidState.screenScrollOffsetY}px
              </span>
            </div>

            {/* Accessible UI Hierarchy Nodes */}
            <div className="space-y-2.5 py-1">
              {androidState.accessibleNodes.map((node) =>
                node.clickable ? (
                  <button
                    key={node.nodeId}
                    type="button"
                    onClick={() =>
                      onExecuteCapability('tap_accessible_element', { nodeId: node.nodeId })
                    }
                    className="w-full text-left p-3 rounded-xl border border-indigo-500/40 bg-indigo-950/20 hover:bg-indigo-950/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono">{node.nodeId}</span>
                      <span>{node.className.split('.').pop()} · Clickable</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-100">{node.text}</p>
                  </button>
                ) : (
                  <div
                    key={node.nodeId}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-900/70"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono">{node.nodeId}</span>
                      <span>
                        {node.className.split('.').pop()} ·{' '}
                        {node.scrollable ? 'Scrollable' : 'Static'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-100">{node.text}</p>
                  </div>
                )
              )}
            </div>

            {/* Android Navigation Bar Controls */}
            <div className="pt-3 border-t border-slate-800 grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onExecuteCapability('press_back')}
                className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => onExecuteCapability('press_home_where_supported')}
                className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
              <button
                type="button"
                onClick={() => onExecuteCapability('scroll', { deltaY: 30 })}
                className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Scroll</span>
              </button>
              <button
                type="button"
                onClick={() => onExecuteCapability('inspect_accessible_ui')}
                className="py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white flex items-center justify-center gap-1"
              >
                <MousePointerClick className="w-3.5 h-3.5" />
                <span>Inspect</span>
              </button>
            </div>
          </div>

          {/* Screen Observation Controls */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                androidState.permissions.mediaProjectionActive
                  ? onExecuteCapability('capture_authorized_screen_frame')
                  : onExecuteCapability('request_screen_capture')
              }
              className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              {androidState.permissions.mediaProjectionActive
                ? 'Capture Authorized Screen Frame'
                : 'Authorize MediaProjection Session'}
            </button>
          </div>
        </div>

        {/* Right: DeviceController Capability Console & Permissions Matrix */}
        <div className="lg:col-span-7 space-y-6">
          {/* Native DeviceController Execution Console */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-500" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Android DeviceController Capability Console
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                No ADB / No Root · Native Android APIs
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label
                  htmlFor="capability-select"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Select Native Capability
                </label>
                <select
                  id="capability-select"
                  value={selectedCapability}
                  onChange={(e) =>
                    setSelectedCapability(e.target.value as DeviceCapabilityName)
                  }
                  className="w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {ALL_CAPABILITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.label} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label
                  htmlFor="capability-param-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Target Package / Text / URL
                </label>
                <input
                  id="capability-param-input"
                  type="text"
                  value={customParamText}
                  onChange={(e) => setCustomParamText(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleRunCapability}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Execute</span>
                </button>
              </div>
            </div>

            {/* Action Execution & Verification Log */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 mb-2">
                Verified Action Execution History ({androidState.actionHistory.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {androidState.actionHistory.slice(0, 8).map((act) => (
                  <div
                    key={act.actionId}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {act.actionType}
                      </span>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>Status: {act.executionStatus}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            act.verificationStatus === 'verified'
                              ? 'text-teal-600 dark:text-teal-400 font-medium'
                              : 'text-amber-500 font-medium'
                          }
                        >
                          {act.verificationStatus}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Risk: {act.riskLevel}</span>
                      </div>
                    </div>
                    <p className="mt-1 font-mono text-slate-600 dark:text-slate-400 truncate">
                      {act.errorDetails
                        ? `Error: ${act.errorDetails}`
                        : `Result: ${JSON.stringify(act.result)}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Permissions Matrix & Installed Apps Exclusion Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Permission Onboarding Switches */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Android OS Permission Matrix
                </h3>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {(
                  Object.keys(androidState.permissions) as Array<keyof DevicePermissionsState>
                ).map((permKey) => {
                  const granted = androidState.permissions[permKey];
                  return (
                    <div
                      key={permKey}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {permKey}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePermissions({ [permKey]: !granted })
                        }
                        className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                          granted
                            ? 'bg-teal-600/15 text-teal-600 dark:text-teal-300 border border-teal-500/30'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {granted ? 'Granted' : 'Denied'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Installed Applications & Notification Exclusion + Event Simulator */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Installed Apps & Privacy Exclusion
                </h3>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {androidState.installedApps.map((app) => (
                  <div
                    key={app.packageName}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <p className="font-medium text-slate-900 dark:text-slate-200 truncate">
                        {app.appName}
                      </p>
                      <p className="font-mono text-slate-500 truncate">{app.packageName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdatePermissions(undefined, app.packageName)}
                      className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap shrink-0 ${
                        app.isExcludedFromObservation
                          ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {app.isExcludedFromObservation ? 'Excluded (Private)' : 'Observed'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Simulate Incoming Android Notification Event */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-200">
                  <Bell className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Emit Test Notification Event to Proactive Engine</span>
                </div>
                <select
                  aria-label="Notification Source Package"
                  value={eventPkg}
                  onChange={(e) => setEventPkg(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {androidState.installedApps.map((a) => (
                    <option key={a.packageName} value={a.packageName}>
                      {a.appName} ({a.packageName})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="Notification Event Title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <input
                  type="text"
                  aria-label="Notification Event Content"
                  value={eventContent}
                  onChange={(e) => setEventContent(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() =>
                    onTriggerAndroidEvent({
                      eventType: 'notification_posted',
                      packageName: eventPkg,
                      title: eventTitle,
                      content: eventContent,
                    })
                  }
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Dispatch Android Event to ADK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
