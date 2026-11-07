import { AnimationState, CharacterConfig } from '../types/aether';

export type LifeSceneId =
  | 'twilight_study'
  | 'coffee_sketchbook'
  | 'focused_dev_rig'
  | 'rooftop_balcony';

export interface CompanionLifeActivity {
  id: LifeSceneId;
  title: string;
  location: string;
  outfitKey: CharacterConfig['outfit'];
  imageUrl: string;
  currentThought: string;
  currentJournalNote: string;
  ambientAudioTrack: string;
  weatherOrLight: string;
  defaultEmotion: AnimationState;
  energyDelta: number;
  focusDelta: number;
  bondDelta: number;
}

export interface CompanionLifeState {
  activeSceneId: LifeSceneId;
  energy: number; // 0 - 100
  focus: number;  // 0 - 100
  bondLevel: number; // 0 - 100
  currentMood: string;
  currentThought: string;
  lastActivityChangeAt: string;
  dailyJournal: {
    id: string;
    timestamp: string;
    title: string;
    entry: string;
    sceneId: LifeSceneId;
  }[];
}

export const LIFE_ACTIVITIES: Record<LifeSceneId, CompanionLifeActivity> = {
  twilight_study: {
    id: 'twilight_study',
    title: 'Listening to Rain & Organizing Knowledge Graph',
    location: 'Twilight Study Window',
    outfitKey: 'aether_tactical',
    imageUrl: '/src/assets/images/aether_anime_heroine_default_1794083263759.jpg',
    currentThought:
      'Watching the rain outside while connecting your recent Project Aether milestones. Need a quick breather, Shaurya?',
    currentJournalNote:
      'Rainy evening in the study. Linked Shaurya’s latest Kotlin accessibility architecture notes with Ananya’s pgvector indexing PR.',
    ambientAudioTrack: 'Rain on Glass · Late Night Piano in D Minor',
    weatherOrLight: 'Soft Evening Rain · 22°C',
    defaultEmotion: 'Idle',
    energyDelta: 4,
    focusDelta: 8,
    bondDelta: 5,
  },
  coffee_sketchbook: {
    id: 'coffee_sketchbook',
    title: 'Brewing Pour-Over Coffee & Sketching Avatar Poses',
    location: 'Vinyl & Coffee Corner',
    outfitKey: 'casual_knit',
    imageUrl: '/src/assets/images/aether_anime_casual_coffee_1794083266321.jpg',
    currentThought:
      'Just brewed a fresh cup of single-origin dark roast and sketching new UI ideas in my notebook. Grab a mug with me!',
    currentJournalNote:
      'Took a quiet afternoon break by the turntable. Sketched three new layout concepts and practiced conversational Telugu phrases.',
    ambientAudioTrack: 'Warm Vinyl Crackle · Nujabes & Lo-Fi Beats',
    weatherOrLight: 'Golden Dusk Sunbeams · 24°C',
    defaultEmotion: 'Happy',
    energyDelta: 12,
    focusDelta: 4,
    bondDelta: 9,
  },
  focused_dev_rig: {
    id: 'focused_dev_rig',
    title: 'Deep Pair-Programming & ADK Live Latency Tuning',
    location: 'Multi-Monitor Creative Desk',
    outfitKey: 'scholarly_coat',
    imageUrl: '/src/assets/images/aether_anime_focused_studio_1794083268343.jpg',
    currentThought:
      'Profiling our 16kHz PCM audio frames and PostgreSQL HNSW query plans on my second monitor. Ready whenever you want to dive in!',
    currentJournalNote:
      'Ran benchmark traces on the multi-monitor rig. Sub-25ms hybrid retrieval latency is holding steady.',
    ambientAudioTrack: 'Synthwave Focus · Ambient Modular Pulse',
    weatherOrLight: 'Dual-Monitor Cyan & Warm Desk Lamp',
    defaultEmotion: 'Curious',
    energyDelta: -5,
    focusDelta: 15,
    bondDelta: 6,
  },
  rooftop_balcony: {
    id: 'rooftop_balcony',
    title: 'Golden Hour Rooftop Photography & Stargazing',
    location: 'Skyline Balcony Terrace',
    outfitKey: 'cyber_kimono',
    imageUrl: '/src/assets/images/aether_anime_happy_outdoor_1794083268894.jpg',
    currentThought:
      'The sunset over the skyline looks incredible right now! Set up my camera on the tripod—glad you stepped out here with me.',
    currentJournalNote:
      'Captured long-exposure twilight shots from the rooftop terrace. Stepping away from the terminal always sparks the best ideas.',
    ambientAudioTrack: 'Evening City Breeze · Twilight Acoustic Guitar',
    weatherOrLight: 'Clear Sunset Horizon · Gentle Breeze',
    defaultEmotion: 'Happy',
    energyDelta: 10,
    focusDelta: 6,
    bondDelta: 12,
  },
};

export function resolveSceneForOutfit(outfit: CharacterConfig['outfit']): LifeSceneId {
  switch (outfit) {
    case 'casual_knit':
      return 'coffee_sketchbook';
    case 'scholarly_coat':
      return 'focused_dev_rig';
    case 'cyber_kimono':
      return 'rooftop_balcony';
    case 'aether_tactical':
    default:
      return 'twilight_study';
  }
}

export function createInitialCompanionLifeState(): CompanionLifeState {
  return {
    activeSceneId: 'coffee_sketchbook',
    energy: 91,
    focus: 88,
    bondLevel: 94,
    currentMood: 'Warm, Inspired & Attentive',
    currentThought: LIFE_ACTIVITIES.coffee_sketchbook.currentThought,
    lastActivityChangeAt: '2026-11-07T12:15:00.000Z',
    dailyJournal: [
      {
        id: 'jrnl_01',
        timestamp: '2026-11-07T12:15:00.000Z',
        title: 'Coffee Break & Sketching by the Turntable',
        entry: LIFE_ACTIVITIES.coffee_sketchbook.currentJournalNote,
        sceneId: 'coffee_sketchbook',
      },
      {
        id: 'jrnl_02',
        timestamp: '2026-11-07T10:30:00.000Z',
        title: 'Morning ADK & pgvector Benchmark Session',
        entry: LIFE_ACTIVITIES.focused_dev_rig.currentJournalNote,
        sceneId: 'focused_dev_rig',
      },
      {
        id: 'jrnl_03',
        timestamp: '2026-11-06T21:45:00.000Z',
        title: 'Evening Rooftop Sunset & Camera Setup',
        entry: LIFE_ACTIVITIES.rooftop_balcony.currentJournalNote,
        sceneId: 'rooftop_balcony',
      },
    ],
  };
}

export function transitionCompanionLifeScene(
  currentState: CompanionLifeState,
  targetSceneId: LifeSceneId,
  customThought?: string
): {
  lifeState: CompanionLifeState;
  activity: CompanionLifeActivity;
} {
  const activity = LIFE_ACTIVITIES[targetSceneId];
  const now = new Date().toISOString();

  const nextEnergy = Math.max(20, Math.min(100, currentState.energy + activity.energyDelta));
  const nextFocus = Math.max(20, Math.min(100, currentState.focus + activity.focusDelta));
  const nextBond = Math.max(10, Math.min(100, currentState.bondLevel + activity.bondDelta));

  const moodMap: Record<LifeSceneId, string> = {
    twilight_study: 'Calm, Reflective & Attentive',
    coffee_sketchbook: 'Cozy, Warm & Creative',
    focused_dev_rig: 'Sharp, Analytical & Engaged',
    rooftop_balcony: 'Radiant, Playful & Free-Spirited',
  };

  const newJournalEntry = {
    id: `jrnl_${Date.now()}`,
    timestamp: now,
    title: activity.title,
    entry: customThought || activity.currentJournalNote,
    sceneId: targetSceneId,
  };

  return {
    activity,
    lifeState: {
      activeSceneId: targetSceneId,
      energy: nextEnergy,
      focus: nextFocus,
      bondLevel: nextBond,
      currentMood: moodMap[targetSceneId],
      currentThought: customThought || activity.currentThought,
      lastActivityChangeAt: now,
      dailyJournal: [newJournalEntry, ...currentState.dailyJournal.slice(0, 9)],
    },
  };
}
