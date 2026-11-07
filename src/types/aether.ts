export type MemoryCategory =
  | 'episodic'
  | 'semantic'
  | 'relational'
  | 'procedural'
  | 'temporal';

export type EpistemicStatus =
  | 'explicitly_stated'
  | 'observed_event'
  | 'model_inference'
  | 'unverified_assumption';

export type SensitivityLevel = 'public' | 'personal' | 'sensitive' | 'restricted';

export type VerificationStatus = 'verified' | 'unverified' | 'uncertain' | 'contradicted';

export type EntityType =
  | 'Person'
  | 'Project'
  | 'Place'
  | 'Event'
  | 'Interest'
  | 'Concept'
  | 'Preference'
  | 'Technology';

export interface MemoryVersion {
  versionId: string;
  content: string;
  updatedAt: string;
  reason: string;
  confidence: number;
}

export interface MemorySource {
  sourceId: string;
  sourceType: 'conversation' | 'device_event' | 'screen_observation' | 'user_edit' | 'proactive_consolidation';
  referenceId: string;
  excerpt: string;
  timestamp: string;
}

export interface MemoryRecord {
  id: string;
  content: string;
  category: MemoryCategory;
  epistemicStatus: EpistemicStatus;
  createdAt: string;
  updatedAt: string;
  eventTimestamp?: string;
  source: MemorySource;
  confidence: number;
  importance: number;
  sensitivity: SensitivityLevel;
  embedding: number[];
  relatedEntityIds: string[];
  verificationStatus: VerificationStatus;
  expirationPolicy?: string;
  accessCount: number;
  lastAccessedAt?: string;
  versions: MemoryVersion[];
  contradictsMemoryId?: string;
}

export interface KnowledgeEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  mentionCount: number;
}

export interface KnowledgeRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  predicate: string;
  confidence: number;
  evidenceMemoryIds: string[];
  createdAt: string;
  updatedAt: string;
  temporalNote?: string;
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  category: MemoryCategory;
  memoryId: string;
  entityIds: string[];
  sourceType: MemorySource['sourceType'];
}

export interface RetrievalScoreBreakdown {
  vectorScore: number;
  fullTextScore: number;
  temporalScore: number;
  graphBoost: number;
  totalScore: number;
}

export interface RetrievedMemoryItem {
  memory: MemoryRecord;
  connectedEntities: KnowledgeEntity[];
  connectedRelationships: KnowledgeRelationship[];
  scoreBreakdown: RetrievalScoreBreakdown;
}

export type AnimationState =
  | 'Idle'
  | 'Listening'
  | 'Speaking'
  | 'Thinking'
  | 'Happy'
  | 'Curious'
  | 'Confused'
  | 'Surprised'
  | 'Concerned'
  | 'Sleeping'
  | 'Waiting'
  | 'Processing an action';

export interface CharacterConfig {
  name: string;
  hairStyle: 'twin_tails' | 'short_bob' | 'long_flowing' | 'cyber_ponytail' | 'braided_crown';
  hairColor: string;
  secondaryHairColor: string;
  eyeColor: string;
  eyeShape: 'gentle' | 'sharp' | 'starry';
  outfit: 'aether_tactical' | 'casual_knit' | 'scholarly_coat' | 'cyber_kimono';
  primaryOutfitColor: string;
  accentColor: string;
  accessories: ('neural_headset' | 'glasses' | 'star_hairpin' | 'holo_choker')[];
  backgroundTheme: 'nebula_sanctuary' | 'tokyo_twilight' | 'minimal_atelier' | 'cyber_grid';
  voiceName: 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';
  animationIntensity: number;
  currentAnimation: AnimationState;
}

export interface PersonalityConfig {
  coreTraits: string[];
  conversationalStyle: 'warm_attentive' | 'crisp_analytical' | 'playful_witty' | 'calm_philosophical';
  humorLevel: number; // 0 - 100
  formality: number; // 0 - 100
  emotionalExpressiveness: number; // 0 - 100
  initiativeLevel: number; // 0 - 100
  preferredLanguage: 'en' | 'te' | 'te-en';
  relationshipStage: 'New Acquaintance' | 'Trusted Partner' | 'Close Companion' | 'Co-Architect';
  boundaries: string[];
  learnedHabits: string[];
}

export type DeviceCapabilityName =
  | 'launch_application'
  | 'get_installed_applications'
  | 'get_foreground_application'
  | 'open_url'
  | 'open_settings'
  | 'navigate_to_supported_system_page'
  | 'perform_accessibility_action'
  | 'inspect_accessible_ui'
  | 'request_screen_capture'
  | 'capture_authorized_screen_frame'
  | 'tap_accessible_element'
  | 'swipe'
  | 'scroll'
  | 'input_text'
  | 'press_back'
  | 'press_home_where_supported'
  | 'read_authorized_notifications'
  | 'dismiss_supported_notifications'
  | 'create_notification'
  | 'get_battery_status'
  | 'get_network_status'
  | 'get_device_information'
  | 'get_location_with_permission'
  | 'access_camera_with_permission'
  | 'create_calendar_event_with_permission'
  | 'create_reminder'
  | 'initiate_supported_phone_intent';

export type ActionRiskLevel = 'low' | 'medium' | 'high';

export interface DevicePermissionsState {
  accessibilityService: boolean;
  notificationListener: boolean;
  mediaProjectionActive: boolean;
  microphone: boolean;
  camera: boolean;
  location: boolean;
  calendar: boolean;
  foregroundService: boolean;
  overlayPermission: boolean;
}

export interface AccessibleUiNode {
  nodeId: string;
  className: string;
  text: string;
  contentDescription?: string;
  bounds: { x: number; y: number; width: number; height: number };
  clickable: boolean;
  editable: boolean;
  scrollable: boolean;
  focused?: boolean;
}

export interface InstalledAppInfo {
  packageName: string;
  appName: string;
  category: string;
  versionName: string;
  isExcludedFromObservation: boolean;
  lastUsed: string;
}

export interface AndroidNotificationItem {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  timestamp: string;
  category: 'message' | 'calendar' | 'system' | 'dev_alert' | 'social';
  dismissed: boolean;
}

export interface DeviceActionExecution {
  actionId: string;
  actionType: DeviceCapabilityName;
  parameters: Record<string, unknown>;
  requestTimestamp: string;
  permissionStatus: 'granted' | 'denied' | 'requires_prompt';
  executionStatus: 'pending_approval' | 'executed' | 'failed' | 'blocked_by_policy';
  result: Record<string, unknown> | null;
  errorDetails?: string;
  verificationStatus: 'verified' | 'unverified' | 'failed_verification';
  riskLevel: ActionRiskLevel;
  initiatedBy: 'user_direct' | 'companion_agent' | 'proactive_engine';
}

export interface ProactivePolicyConfig {
  quietHoursStart: string; // e.g., "23:00"
  quietHoursEnd: string;   // e.g., "07:30"
  maxProactiveMessagesPerDay: number;
  cooldownMinutes: number;
  respectDoNotDisturb: boolean;
  doNotDisturbActive: boolean;
  excludedPackages: string[];
  initiativeThreshold: number; // 0 - 100
}

export interface ProactiveSuggestion {
  id: string;
  timestamp: string;
  triggerEvent: string;
  title: string;
  message: string;
  reasoning: string;
  relevanceScore: number;
  riskLevel: ActionRiskLevel;
  status: 'pending' | 'approved' | 'dismissed' | 'executed_silently';
  proposedAction?: {
    capability: DeviceCapabilityName;
    parameters: Record<string, unknown>;
  };
}

export interface AgentTraceEntry {
  id: string;
  timestamp: string;
  agentName:
    | 'RootCompanionAgent'
    | 'DecisionAgent'
    | 'MemoryAgent'
    | 'PhoneInteractionAgent'
    | 'EventEvaluationAgent';
  operation: string;
  inputSummary: string;
  outputSummary: string;
  reasoning: string;
  latencyMs: number;
  status: 'success' | 'warning' | 'error' | 'awaiting_approval';
}

export interface ConversationMessageItem {
  id: string;
  role: 'user' | 'companion' | 'system';
  text: string;
  language?: 'en' | 'te' | 'te-en';
  timestamp: string;
  modality: 'voice' | 'text';
  emotionState?: AnimationState;
  extractedMemoryIds?: string[];
  triggeredActionIds?: string[];
  agentTraces?: AgentTraceEntry[];
}

export interface ReminderItem {
  id: string;
  title: string;
  dueAt: string;
  completed: boolean;
  projectTag?: string;
  createdBy: 'user' | 'companion';
}
