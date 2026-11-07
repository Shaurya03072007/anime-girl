import React, { useState } from 'react';
import { Save, Sparkles, Volume2, Sliders, BookOpen, Heart, Zap, Compass } from 'lucide-react';
import {
  AnimationState,
  CharacterConfig,
  PersonalityConfig,
} from '../types/aether';
import {
  CompanionLifeState,
  LIFE_ACTIVITIES,
  LifeSceneId,
} from '../engine/companionLifeEngine';
import { AnimeCompanionCanvas } from './AnimeCompanionCanvas';

interface CharacterViewProps {
  character: CharacterConfig;
  personality: PersonalityConfig;
  lifeState?: CompanionLifeState;
  onTransitionLifeScene?: (sceneId: LifeSceneId) => void;
  onSaveCharacterAndPersonality: (
    nextCharacter: CharacterConfig,
    nextPersonality: PersonalityConfig
  ) => Promise<void>;
}

const ALL_ANIMATION_STATES: AnimationState[] = [
  'Idle',
  'Listening',
  'Speaking',
  'Thinking',
  'Happy',
  'Curious',
  'Confused',
  'Surprised',
  'Concerned',
  'Sleeping',
  'Waiting',
  'Processing an action',
];

export const CharacterView: React.FC<CharacterViewProps> = ({
  character,
  personality,
  lifeState,
  onTransitionLifeScene,
  onSaveCharacterAndPersonality,
}) => {
  const [draftChar, setDraftChar] = useState<CharacterConfig>(character);
  const [draftPers, setDraftPers] = useState<PersonalityConfig>(personality);
  const [savedNotice, setSavedNotice] = useState('');

  const toggleAccessory = (
    acc: 'neural_headset' | 'glasses' | 'star_hairpin' | 'holo_choker'
  ) => {
    const exists = draftChar.accessories.includes(acc);
    const nextAcc = exists
      ? draftChar.accessories.filter((a) => a !== acc)
      : [...draftChar.accessories, acc];
    setDraftChar({ ...draftChar, accessories: nextAcc });
  };

  const handleSceneAndOutfitSelect = (sceneId: LifeSceneId) => {
    const activity = LIFE_ACTIVITIES[sceneId];
    setDraftChar((prev) => ({
      ...prev,
      outfit: activity.outfitKey,
      currentAnimation: activity.defaultEmotion,
    }));
    if (onTransitionLifeScene) {
      onTransitionLifeScene(sceneId);
    }
  };

  const handleSave = async () => {
    await onSaveCharacterAndPersonality(draftChar, draftPers);
    setSavedNotice('Saved Aria’s studio appearance, voice, and personality configuration.');
    setTimeout(() => setSavedNotice(''), 3500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Live Studio 2.5D Anime Heroine & 12-State Trigger Matrix */}
      <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {draftChar.name} — Living Sanctuary
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              2.5D Live2D-style interactive portrait & autonomous life routine
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </button>
        </div>

        <AnimeCompanionCanvas
          config={draftChar}
          animationState={draftChar.currentAnimation}
          audioAmplitude={draftChar.currentAnimation === 'Speaking' ? 0.65 : 0}
          size="hero"
          lifeState={lifeState}
          onSelectLifeScene={handleSceneAndOutfitSelect}
        />

        {savedNotice && (
          <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
            {savedNotice}
          </p>
        )}

        {/* All 12 Required Animation States Selector */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 mb-2.5">
            Trigger Expression & Animation State (12 States)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ALL_ANIMATION_STATES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setDraftChar({ ...draftChar, currentAnimation: st })}
                className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-colors truncate ${
                  draftChar.currentAnimation === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Aria's Daily Life & Personal Journal + Appearance, Voice & Personality Configuration */}
      <div className="lg:col-span-7 space-y-6">
        {/* Aria's Autonomous Life, Vitals & Personal Diary */}
        {lifeState && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {draftChar.name}’s Autonomous Daily Life & Personal Journal
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mood: <strong className="text-slate-800 dark:text-slate-200">{lifeState.currentMood}</strong>
              </span>
            </div>

            {/* Vitals Bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Bond Level</span>
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {lifeState.bondLevel}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${lifeState.bondLevel}%` }}
                    className="h-full bg-rose-500 rounded-full"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Energy</span>
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {lifeState.energy}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${lifeState.energy}%` }}
                    className="h-full bg-amber-500 rounded-full"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Creative Focus</span>
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {lifeState.focus}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${lifeState.focus}%` }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
              </div>
            </div>

            {/* Recent Personal Journal Entries */}
            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                Recent Entries from {draftChar.name}’s Notebook
              </p>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {lifeState.dailyJournal.slice(0, 3).map((item) => (
                  <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.entry}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Appearance & Avatar Rig Customization */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Character Appearance, Wardrobe & Environment
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="char-name-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Companion Identity Name
              </label>
              <input
                id="char-name-input"
                type="text"
                value={draftChar.name}
                onChange={(e) => setDraftChar({ ...draftChar, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label
                htmlFor="char-outfit-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Wardrobe & Life Scene
              </label>
              <select
                id="char-outfit-select"
                value={draftChar.outfit}
                onChange={(e) => {
                  const nextOutfit = e.target.value as CharacterConfig['outfit'];
                  setDraftChar({ ...draftChar, outfit: nextOutfit });
                  const map: Record<CharacterConfig['outfit'], LifeSceneId> = {
                    casual_knit: 'coffee_sketchbook',
                    aether_tactical: 'twilight_study',
                    scholarly_coat: 'focused_dev_rig',
                    cyber_kimono: 'rooftop_balcony',
                  };
                  if (onTransitionLifeScene) {
                    onTransitionLifeScene(map[nextOutfit]);
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="casual_knit">Cozy Atelier Knit (Coffee & Sketchbook)</option>
                <option value="aether_tactical">Tailored Twilight Jacket (Rainy Study)</option>
                <option value="scholarly_coat">Researcher Coat (Multi-Monitor Dev Rig)</option>
                <option value="cyber_kimono">Neo-Tokyo Haori (Rooftop Sunset)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="char-hair-style"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Hair Styling Preference
              </label>
              <select
                id="char-hair-style"
                value={draftChar.hairStyle}
                onChange={(e) =>
                  setDraftChar({
                    ...draftChar,
                    hairStyle: e.target.value as CharacterConfig['hairStyle'],
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="long_flowing">Long Flowing Silver-Indigo</option>
                <option value="twin_tails">Twin Tails (Dynamic Sway)</option>
                <option value="short_bob">Short Atelier Bob</option>
                <option value="cyber_ponytail">Side Ponytail</option>
                <option value="braided_crown">Braided Crown</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="char-bg-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Sanctuary Atmosphere Lighting
              </label>
              <select
                id="char-bg-select"
                value={draftChar.backgroundTheme}
                onChange={(e) =>
                  setDraftChar({
                    ...draftChar,
                    backgroundTheme: e.target.value as CharacterConfig['backgroundTheme'],
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="tokyo_twilight">Tokyo Golden Twilight</option>
                <option value="nebula_sanctuary">Rainy Study Sanctuary</option>
                <option value="minimal_atelier">Warm Vinyl Atelier</option>
                <option value="cyber_grid">Dual-Monitor Studio</option>
              </select>
            </div>
          </div>

          {/* Accessories */}
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Equipped Signature Accessories
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'glasses', label: 'Reading Glasses' },
                  { id: 'star_hairpin', label: 'Celestial Hairpin' },
                  { id: 'neural_headset', label: 'Studio Headphones' },
                  { id: 'holo_choker', label: 'Crystal Brooch Collar' },
                ] as const
              ).map((item) => {
                const active = draftChar.accessories.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleAccessory(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Voice & Personality Configuration */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Gemini Live Voice & Personality Parameters
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="voice-prebuilt-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Gemini 3.8 Live Prebuilt Voice
              </label>
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  id="voice-prebuilt-select"
                  value={draftChar.voiceName}
                  onChange={(e) =>
                    setDraftChar({
                      ...draftChar,
                      voiceName: e.target.value as CharacterConfig['voiceName'],
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="Zephyr">Zephyr (Bright, Expressive)</option>
                  <option value="Kore">Kore (Calm, Warm)</option>
                  <option value="Puck">Puck (Playful, Energetic)</option>
                  <option value="Charon">Charon (Deep, Composed)</option>
                  <option value="Fenrir">Fenrir (Crisp, Direct)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="conv-style-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Conversational Style
              </label>
              <select
                id="conv-style-select"
                value={draftPers.conversationalStyle}
                onChange={(e) =>
                  setDraftPers({
                    ...draftPers,
                    conversationalStyle: e.target.value as PersonalityConfig['conversationalStyle'],
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="warm_attentive">Warm & Attentive Partner</option>
                <option value="crisp_analytical">Crisp & Analytical Architect</option>
                <option value="playful_witty">Playful & Witty Companion</option>
                <option value="calm_philosophical">Calm & Reflective</option>
              </select>
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {[
              {
                key: 'humorLevel' as const,
                label: 'Humor & Wit Level',
                value: draftPers.humorLevel,
              },
              {
                key: 'formality' as const,
                label: 'Formality Level',
                value: draftPers.formality,
              },
              {
                key: 'emotionalExpressiveness' as const,
                label: 'Emotional Expressiveness',
                value: draftPers.emotionalExpressiveness,
              },
              {
                key: 'initiativeLevel' as const,
                label: 'Proactive Initiative Level',
                value: draftPers.initiativeLevel,
              },
            ].map((slider) => (
              <div key={slider.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {slider.label}
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {slider.value}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={slider.value}
                  onChange={(e) =>
                    setDraftPers({
                      ...draftPers,
                      [slider.key]: Number(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </div>
            ))}
          </div>

          {/* Ethical & Operational Boundaries */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
            <p className="font-semibold text-slate-900 dark:text-slate-200">
              Enforced Identity & Privacy Boundaries
            </p>
            {draftPers.boundaries.map((b, i) => (
              <p key={i} className="text-slate-600 dark:text-slate-400">
                {i + 1}. {b}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
