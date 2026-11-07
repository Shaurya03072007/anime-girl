import React, { useEffect, useState } from 'react';
import { Coffee, CloudRain, Terminal, Camera, Music, MapPin, Sparkles } from 'lucide-react';
import { AnimationState, CharacterConfig } from '../types/aether';
import {
  CompanionLifeState,
  LIFE_ACTIVITIES,
  LifeSceneId,
  resolveSceneForOutfit,
} from '../engine/companionLifeEngine';

interface AnimeCompanionCanvasProps {
  config: CharacterConfig;
  animationState?: AnimationState;
  audioAmplitude?: number; // 0.0 to 1.0
  size?: 'hero' | 'conversation' | 'compact';
  lifeState?: CompanionLifeState;
  onSelectLifeScene?: (sceneId: LifeSceneId) => void;
  onInteract?: () => void;
}

const SCENE_BUTTONS: {
  id: LifeSceneId;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'coffee_sketchbook', shortLabel: 'Coffee', icon: Coffee },
  { id: 'twilight_study', shortLabel: 'Study', icon: CloudRain },
  { id: 'focused_dev_rig', shortLabel: 'Studio', icon: Terminal },
  { id: 'rooftop_balcony', shortLabel: 'Rooftop', icon: Camera },
];

export const AnimeCompanionCanvas: React.FC<AnimeCompanionCanvasProps> = ({
  config,
  animationState,
  audioAmplitude = 0,
  size = 'hero',
  lifeState,
  onSelectLifeScene,
  onInteract,
}) => {
  const activeState: AnimationState = animationState || config.currentAnimation;
  const [phase, setPhase] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [imgError, setImgError] = useState(false);

  // Determine the active life scene from lifeState or fallback to outfit mapping
  const resolvedSceneId: LifeSceneId =
    lifeState?.activeSceneId || resolveSceneForOutfit(config.outfit);
  const activeActivity = LIFE_ACTIVITIES[resolvedSceneId] || LIFE_ACTIVITIES.coffee_sketchbook;

  useEffect(() => {
    setImgError(false);
  }, [activeActivity.imageUrl]);

  useEffect(() => {
    let frameId = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      setPhase((now - t0) / 1000);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // 2.5D Live2D Kinematics (breathing, micro-sway, head tilt, cursor parallax)
  const intensity = Math.max(0.3, (config.animationIntensity ?? 88) / 100);
  const breathFreq =
    activeState === 'Sleeping'
      ? 1.05
      : activeState === 'Speaking'
      ? 2.8
      : activeState === 'Happy'
      ? 2.2
      : 1.65;

  const breathY = Math.sin(phase * breathFreq) * 4.5 * intensity;
  const breathScale = 1.045 + Math.sin(phase * breathFreq) * 0.012 * intensity;
  const swayX = Math.cos(phase * 1.1) * 3.2 * intensity;

  let stateTiltDeg = Math.sin(phase * 0.85) * 0.9 * intensity;
  let stateOffsetY = breathY;

  if (activeState === 'Curious') stateTiltDeg = 2.2 + Math.sin(phase * 1.8) * 0.8;
  if (activeState === 'Confused') stateTiltDeg = -2.2 + Math.cos(phase * 2.0) * 0.9;
  if (activeState === 'Thinking') stateTiltDeg = -1.4;
  if (activeState === 'Happy') {
    stateOffsetY = breathY - Math.abs(Math.sin(phase * 3.6)) * 4.5;
  }
  if (activeState === 'Sleeping') {
    stateTiltDeg = 1.8;
    stateOffsetY = breathY + 4;
  }

  // 3D Parallax from pointer
  const rotateY = pointer.x * 6.5 * intensity;
  const rotateX = -pointer.y * 5.0 * intensity;
  const translateX = swayX + pointer.x * -7 * intensity;
  const translateY = stateOffsetY + pointer.y * -5 * intensity;

  const speakingLevel =
    activeState === 'Speaking'
      ? Math.max(0.32, audioAmplitude > 0.04 ? audioAmplitude : (Math.sin(phase * 13) + 1) * 0.42)
      : activeState === 'Listening'
      ? Math.max(0.18, audioAmplitude)
      : 0;

  // Color filter subtle grading based on emotional state
  const filterStyle =
    activeState === 'Sleeping'
      ? 'brightness(0.84) saturate(0.92) contrast(1.04)'
      : activeState === 'Happy' || activeState === 'Surprised'
      ? 'brightness(1.05) saturate(1.12) contrast(1.03)'
      : activeState === 'Thinking' || activeState === 'Processing an action'
      ? 'brightness(0.98) saturate(1.06) contrast(1.06)'
      : 'brightness(1.02) saturate(1.06) contrast(1.03)';

  const heightClass =
    size === 'hero'
      ? 'h-[470px]'
      : size === 'conversation'
      ? 'h-[410px]'
      : 'h-[310px]';

  const activeThought = lifeState?.currentThought || activeActivity.currentThought;

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none w-full"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        setPointer({ x: nx, y: ny });
      }}
      onMouseLeave={() => setPointer({ x: 0, y: 0 })}
    >
      {/* Main 2.5D Studio Anime Sanctuary Frame */}
      <div
        onClick={onInteract}
        data-testid="anime-companion-canvas"
        style={{ perspective: '1100px' }}
        className={`w-full ${heightClass} rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden cursor-pointer relative shadow-md group`}
      >
        {/* 2.5D Parallax & Breathing Portrait Layer */}
        <div
          style={{
            transform: `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(
              2
            )}px, 0) scale(${breathScale.toFixed(4)}) rotateX(${rotateX.toFixed(
              2
            )}deg) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${stateTiltDeg.toFixed(2)}deg)`,
            filter: filterStyle,
            transition: 'transform 90ms ease-out, filter 300ms ease',
            transformStyle: 'preserve-3d',
          }}
          className="w-full h-full relative"
        >
          {!imgError ? (
            <img
              src={activeActivity.imageUrl}
              alt={`${config.name} — ${activeActivity.title}`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-[50%_18%] block select-none pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-amber-950/60 flex items-center justify-center p-6 text-center">
              <p className="text-sm font-medium text-slate-200">
                {config.name} · {activeActivity.title}
              </p>
            </div>
          )}
        </div>

        {/* Dynamic Atmospheric Live2D Environment Overlay (Rain, Coffee Steam, Golden Dust Motes, Sunset Embers) */}
        <svg
          viewBox="0 0 400 500"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="live-warm-glow" cx="50%" cy="35%" r="60%">
              <stop
                offset="0%"
                stopColor={
                  resolvedSceneId === 'coffee_sketchbook'
                    ? '#f59e0b'
                    : resolvedSceneId === 'rooftop_balcony'
                    ? '#fb7185'
                    : resolvedSceneId === 'focused_dev_rig'
                    ? '#38bdf8'
                    : '#818cf8'
                }
                stopOpacity={0.14 + Math.sin(phase * 2) * 0.04}
              />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Subtle Atmospheric Light Wash */}
          <rect x="0" y="0" width="400" height="500" fill="url(#live-warm-glow)" />

          {/* Scene 1: Coffee & Sketchbook -> Rising warm coffee steam + golden dust motes */}
          {resolvedSceneId === 'coffee_sketchbook' && (
            <g>
              {[0, 1, 2].map((i) => {
                const offset = (phase * 28 + i * 35) % 95;
                const opacity = Math.sin((offset / 95) * Math.PI) * 0.32;
                const sway = Math.sin(phase * 2 + i) * 8;
                return (
                  <path
                    key={`steam-${i}`}
                    d={`M ${215 + i * 14 + sway} ${350 - offset} Q ${
                      205 + i * 14 - sway
                    } ${320 - offset} ${220 + i * 14 + sway} ${290 - offset}`}
                    fill="none"
                    stroke="#fef3c7"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity={opacity}
                  />
                );
              })}
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const px = (60 + i * 52 + Math.sin(phase * 0.9 + i) * 24) % 390;
                const py = (440 - ((phase * 16 + i * 65) % 400));
                const r = 1.8 + (i % 3) * 0.9;
                return (
                  <circle
                    key={`mote-${i}`}
                    cx={px}
                    cy={py}
                    r={r}
                    fill="#fde68a"
                    opacity={0.35 + Math.sin(phase * 2.5 + i) * 0.2}
                  />
                );
              })}
            </g>
          )}

          {/* Scene 2: Twilight Study -> Soft window rain streaks & bokeh */}
          {resolvedSceneId === 'twilight_study' && (
            <g stroke="#93c5fd" strokeLinecap="round">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                const rx = (35 + i * 45) % 380;
                const ry = (phase * 180 + i * 57) % 480;
                return (
                  <line
                    key={`rain-${i}`}
                    x1={rx}
                    y1={ry}
                    x2={rx - 8}
                    y2={ry + 28}
                    strokeWidth="1.2"
                    strokeOpacity="0.24"
                  />
                );
              })}
            </g>
          )}

          {/* Scene 3: Dev Workstation -> Subtle floating telemetry & focus nodes */}
          {resolvedSceneId === 'focused_dev_rig' && (
            <g>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const px = 40 + ((i * 68 + Math.cos(phase + i) * 16) % 340);
                const py = 420 - ((phase * 22 + i * 70) % 360);
                return (
                  <circle
                    key={`dev-node-${i}`}
                    cx={px}
                    cy={py}
                    r={2.2}
                    fill={i % 2 === 0 ? '#38bdf8' : '#818cf8'}
                    opacity={0.35 + Math.sin(phase * 3 + i) * 0.2}
                  />
                );
              })}
            </g>
          )}

          {/* Scene 4: Rooftop Balcony -> Golden hour sunset embers & breeze */}
          {resolvedSceneId === 'rooftop_balcony' && (
            <g>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const px = (45 + i * 55 + Math.sin(phase * 1.4 + i) * 30) % 385;
                const py = 450 - ((phase * 24 + i * 62) % 410);
                return (
                  <circle
                    key={`sunset-${i}`}
                    cx={px}
                    cy={py}
                    r={2 + (i % 2)}
                    fill={i % 2 === 0 ? '#fbbf24' : '#fb7185'}
                    opacity={0.42 + Math.cos(phase * 2.2 + i) * 0.22}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Top Scrim: Location, Weather/Light & Live Expression State */}
        <div className="absolute top-0 inset-x-0 p-3.5 bg-gradient-to-b from-slate-950/85 via-slate-950/40 to-transparent flex items-center justify-between gap-2 text-xs text-slate-100 pointer-events-none">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold tracking-tight truncate">
              {activeActivity.location}
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="text-slate-300 truncate hidden sm:inline">
              {activeActivity.weatherOrLight}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md border border-white/15 text-[11px] font-medium text-amber-200 shrink-0 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{activeState}</span>
          </div>
        </div>

        {/* Bottom Scrim: Live Voice Resonance Wave + Aria's Inner Thought & Current Activity */}
        <div className="absolute bottom-0 inset-x-0 p-4 pt-10 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent flex flex-col gap-2 pointer-events-none">
          {/* Real-time Audio-Reactive Voice Equalizer when Speaking or Listening */}
          {speakingLevel > 0.05 && (
            <div className="flex items-end gap-1 h-5 mb-0.5">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((bar) => {
                const h = Math.max(
                  4,
                  Math.abs(Math.sin(phase * 10 + bar * 0.55)) * speakingLevel * 20
                );
                return (
                  <span
                    key={bar}
                    style={{ height: `${h.toFixed(1)}px` }}
                    className="w-1 rounded-full bg-indigo-400"
                  />
                );
              })}
              <span className="ml-2 text-[11px] font-medium text-indigo-300">
                {activeState === 'Speaking'
                  ? `${config.name} is speaking (${config.voiceName})`
                  : 'Listening to you...'}
              </span>
            </div>
          )}

          {/* Current Autonomous Activity Title */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-amber-300/95 font-medium">
            <span className="truncate">Currently: {activeActivity.title}</span>
            {lifeState && (
              <span className="font-mono tabular-nums text-slate-300 shrink-0">
                Bond {lifeState.bondLevel}% · Energy {lifeState.energy}%
              </span>
            )}
          </div>

          {/* Aria's Live Thought / Dialogue Bubble */}
          {size !== 'compact' && (
            <p className="text-xs text-slate-100 leading-relaxed line-clamp-2 italic">
              “{activeThought}”
            </p>
          )}

          {/* Ambient Soundtrack Line */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 pt-0.5 border-t border-white/10">
            <span className="flex items-center gap-1.5 truncate">
              <Music className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="truncate">{activeActivity.ambientAudioTrack}</span>
            </span>
            <span className="text-slate-300 font-medium shrink-0">
              Voice: {config.voiceName}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Life Scene Switcher Bar below Portrait */}
      {onSelectLifeScene ? (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
          {SCENE_BUTTONS.map((btn) => {
            const Icon = btn.icon;
            const isSelected = resolvedSceneId === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => onSelectLifeScene(btn.id)}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{btn.shortLabel}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-2.5 flex items-center justify-between w-full px-1 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-200">{config.name}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{activeActivity.location}</span>
          <span aria-hidden="true">·</span>
          <span>State: {activeState}</span>
        </div>
      )}
    </div>
  );
};
