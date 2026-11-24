"use client";

import React from "react";

export interface CohostEventPayload {
  id: string;
  prompt: string;
  reply: string;
  speechText: string;
  mood: "talk" | "smug" | "warning" | "excited";
  voice: string;
  source?: string;
  sender?: string;
  timestamp: string;
}

interface AiCohostWidgetProps {
  currentEvent: CohostEventPayload | null;
  isSpeaking: boolean;
  isCardVisible: boolean;
  position?: string; // "bottom-right" | "bottom-left" | "top-right" | "top-left"
  onDismiss?: (id: string) => void;
  scale?: number;
  isSfxActive?: boolean; // When SFX is active in the same corner, stack Co-Host upwards!
  sfxPosition?: string;
  extraBottomOffset?: number; // Custom bottom pixel offset (e.g. 56px to clear running text overlay)
}

export default function AiCohostWidget({
  currentEvent,
  isSpeaking,
  isCardVisible,
  position = "bottom-left",
  onDismiss,
  scale = 1,
  isSfxActive = false,
  sfxPosition = "bottom-left",
  extraBottomOffset = 56, // Default 56px margin bottom to safely clear TikTok Studio running text ticker
}: AiCohostWidgetProps) {
  // Check if SFX is currently occupying the same corner
  const isSharingCornerWithSfx = isSfxActive && position === sfxPosition;

  // Calculate dynamic bottom spacing:
  // Base margin: 56px (clears running text)
  // If SFX active in same corner: add +115px (height of SFX toast + gap) so Co-Host floats cleanly above it!
  const computedBottomPx = isSharingCornerWithSfx
    ? extraBottomOffset + 115
    : extraBottomOffset;

  const getContainerPosition = () => {
    switch (position) {
      case "bottom-left":
        return "left-6 items-start";
      case "top-left":
        return "top-6 left-6 items-start";
      case "top-right":
        return "top-6 right-6 items-end";
      case "bottom-right":
      default:
        return "right-6 items-end";
    }
  };

  const isBubbleVisible = Boolean(currentEvent && isCardVisible);
  const mood = currentEvent?.mood || "talk";

  // Mood border and tag coloring
  const getMoodTag = () => {
    switch (mood) {
      case "warning":
        return { label: "⚠️ Peringatan Missable", bg: "bg-red-500", border: "border-red-400" };
      case "excited":
        return { label: "🔥 Info Rahasia / Egg", bg: "bg-amber-500", border: "border-yellow-300" };
      case "smug":
        return { label: "😎 Tips Pro Mabar", bg: "bg-purple-600", border: "border-purple-400" };
      case "talk":
      default:
        return { label: "🎮 GTA 6 Co-Host", bg: "bg-pink-600", border: "border-pink-400" };
    }
  };

  const tag = getMoodTag();

  return (
    <div
      style={{
        ...(scale !== 1 ? { zoom: scale } : {}),
        ...(position.includes("bottom") ? { bottom: `${computedBottomPx}px` } : {}),
      }}
      className={`fixed ${getContainerPosition()} z-50 flex flex-col pointer-events-none select-none font-sans transition-all duration-300 ease-out`}
    >
      {/* 1. COMIC CLOUD SPEECH BUBBLE (Pop-up Cloud above Avatar) */}
      <div
        className={`w-full max-w-sm transition-all duration-300 ease-out origin-bottom mb-2 ${
          isBubbleVisible
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-75 translate-y-4 pointer-events-none"
        }`}
      >
        {currentEvent && (
          <div
            onClick={() => onDismiss && onDismiss(currentEvent.id)}
            className="relative cursor-pointer group"
          >
            {/* Retro Vice City Neon Glow Backdrop */}
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse"></div>

            {/* Cloud Speech Bubble Body */}
            <div className="relative bg-black/90 backdrop-blur-md text-white border-2 border-pink-400 rounded-3xl p-4 md:p-5 shadow-2xl flex flex-col gap-2">
              {/* Header: Co-Host Name, Status Equalizer & Mood Tag */}
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping"></span>
                  <span className="text-xs font-black tracking-wider text-pink-300 uppercase">
                    Veyra AI • Co-Host
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide text-white ${tag.bg} border ${tag.border} shadow-xs`}
                  >
                    {tag.label}
                  </span>
                  {isSpeaking && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-pink-500/20 rounded border border-pink-500/40">
                      <span className="w-1 h-3 bg-pink-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                      <span className="w-1 h-4 bg-pink-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                      <span className="w-1 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Reply Text: 1-2 Sentences max, Punchy GTA Typography */}
              <div className="pt-0.5">
                <p className="text-white text-base md:text-lg font-black leading-snug tracking-wide break-words drop-shadow-md">
                  &ldquo;{currentEvent.reply}&rdquo;
                </p>
              </div>

              {/* Little Footer Hint: Prompt asked */}
              {currentEvent.prompt && (
                <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="truncate italic">
                    Tanya: &ldquo;{currentEvent.prompt}&rdquo;
                  </span>
                  <span className="shrink-0 text-pink-400 font-bold ml-2">GTA VI</span>
                </div>
              )}

              {/* Cloud Speech Tail Arrow (pointing down to avatar) */}
              <div
                className={`absolute -bottom-3 ${
                  position.includes("right") ? "right-8" : "left-8"
                } w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[14px] border-t-pink-400`}
              ></div>
              <div
                className={`absolute -bottom-2 ${
                  position.includes("right") ? "right-[33px]" : "left-[33px]"
                } w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-black/90`}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 2. AUDIO-REACTIVE ANIME / GTA 6 CO-HOST AVATAR */}
      <div className="relative group cursor-pointer pointer-events-auto">
        {/* Outer Neon Glow Aura when Speaking */}
        <div
          className={`absolute -inset-2 rounded-full transition-all duration-300 ${
            isSpeaking
              ? "bg-gradient-to-r from-pink-500 to-cyan-400 opacity-90 blur-lg animate-pulse scale-105"
              : "bg-pink-500/20 opacity-40 blur-md scale-95"
          }`}
        ></div>

        {/* Character Circle Frame */}
        <div
          className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full border-3 overflow-hidden bg-gradient-to-br from-gray-900 via-purple-950 to-pink-950 shadow-2xl transition-all duration-300 flex items-center justify-center ${
            isSpeaking
              ? "border-pink-400 scale-105 rotate-1"
              : "border-purple-400/80 hover:border-pink-400 scale-100"
          }`}
        >
          {/* Animated 2D Vector Avatar: Cyberpunk GTA Girl with Headphones & Visor */}
          <svg
            viewBox="0 0 100 100"
            className={`w-full h-full transition-transform duration-200 ${
              isSpeaking ? "scale-105 animate-[bounce_1.2s_infinite]" : "scale-100"
            }`}
          >
            {/* Background Cyber Gradient */}
            <defs>
              <linearGradient id="cyberHair" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <linearGradient id="cyberSkin" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>

            {/* Back Hair */}
            <path
              d="M 18 55 C 10 30, 25 10, 50 10 C 75 10, 90 30, 82 55 C 88 75, 78 90, 70 95 C 65 75, 75 60, 68 50 C 60 55, 40 55, 32 50 C 25 60, 35 75, 30 95 C 22 90, 12 75, 18 55 Z"
              fill="url(#cyberHair)"
            />

            {/* Face / Head */}
            <ellipse cx="50" cy="52" rx="22" ry="24" fill="#fed7aa" />

            {/* Front Bangs (Hair) */}
            <path
              d="M 28 36 C 35 25, 65 25, 72 36 C 65 42, 60 38, 55 45 C 50 38, 42 42, 38 45 C 34 38, 30 42, 28 36 Z"
              fill="url(#cyberHair)"
            />

            {/* Anime Eyes */}
            {isSpeaking ? (
              // Excited / Talking Happy Eyes (Curves)
              <>
                <path
                  d="M 37 50 Q 42 45 47 50"
                  stroke="#1e1b4b"
                  strokeWidth="3.5"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M 53 50 Q 58 45 63 50"
                  stroke="#1e1b4b"
                  strokeWidth="3.5"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Blushing cheeks */}
                <ellipse cx="36" cy="56" rx="4" ry="2" fill="#f43f5e" opacity="0.6" />
                <ellipse cx="64" cy="56" rx="4" ry="2" fill="#f43f5e" opacity="0.6" />
              </>
            ) : (
              // Idle Eyes (Sparkling Big Anime Eyes)
              <>
                <ellipse cx="41" cy="50" rx="4" ry="5.5" fill="#1e1b4b" />
                <circle cx="42.5" cy="48.5" r="1.8" fill="#ffffff" />
                <ellipse cx="59" cy="50" rx="4" ry="5.5" fill="#1e1b4b" />
                <circle cx="60.5" cy="48.5" r="1.8" fill="#ffffff" />
                {/* Subtle Blush */}
                <ellipse cx="36" cy="56" rx="3.5" ry="1.5" fill="#f43f5e" opacity="0.4" />
                <ellipse cx="64" cy="56" rx="3.5" ry="1.5" fill="#f43f5e" opacity="0.4" />
              </>
            )}

            {/* Mouth: Audio-reactive mouth flap */}
            {isSpeaking ? (
              // Open Talking Mouth (Animates with speech)
              <path
                d="M 45 62 Q 50 71 55 62 Z"
                fill="#e11d48"
                className="animate-pulse"
              />
            ) : (
              // Idle Cute Smile
              <path
                d="M 47 62 Q 50 65 53 62"
                stroke="#881337"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            )}

            {/* Streamer Gaming Headset (Neon Pink & Cyan) */}
            <path
              d="M 23 48 C 23 28, 77 28, 77 48"
              stroke="#06b6d4"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
            {/* Left Ear Cushion */}
            <rect x="20" y="44" width="7" height="15" rx="3" fill="#ec4899" stroke="#ffffff" strokeWidth="1" />
            {/* Right Ear Cushion */}
            <rect x="73" y="44" width="7" height="15" rx="3" fill="#ec4899" stroke="#ffffff" strokeWidth="1" />
            {/* Headset Mic Boom */}
            <path d="M 24 56 Q 28 66 38 65" stroke="#06b6d4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="39" cy="65" r="2.5" fill="#ec4899" />
          </svg>

          {/* Online Co-Host Badge Dot */}
          <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-black rounded-full shadow-md animate-pulse"></span>
        </div>

        {/* Name Tag Pill */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/90 border border-pink-500/60 shadow-lg text-[10px] font-black text-pink-300 tracking-wider uppercase shrink-0 whitespace-nowrap">
          Veyra AI
        </div>
      </div>
    </div>
  );
}
