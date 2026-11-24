"use client";

import React, { useState, useEffect, useRef } from "react";

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
  cooldownSeconds?: number;
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
  cooldownSeconds?: number;
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
  extraBottomOffset = 75, // Default 56px margin bottom to safely clear TikTok Studio running text ticker
  cooldownSeconds = 20,
}: AiCohostWidgetProps) {
  // Cooldown State Management
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [totalCooldown, setTotalCooldown] = useState<number>(cooldownSeconds);
  const cooldownEndTimeRef = useRef<number>(0);
  const lastTriggeredIdRef = useRef<string | null>(null);

  // Trigger cooldown timer whenever a new AI Co-Host event arrives
  useEffect(() => {
    if (currentEvent && currentEvent.id && currentEvent.id !== lastTriggeredIdRef.current) {
      lastTriggeredIdRef.current = currentEvent.id;
      const duration = currentEvent.cooldownSeconds || cooldownSeconds || 20;
      setTotalCooldown(duration);
      cooldownEndTimeRef.current = Date.now() + duration * 1000;
      setCooldownRemaining(duration);
    }
  }, [currentEvent, cooldownSeconds]);

  // Accurate interval tick that respects system clock
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownEndTimeRef.current - Date.now()) / 1000));
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

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
        className={`w-full max-w-sm transition-all duration-300 ease-out origin-bottom mb-2 ${isBubbleVisible
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
                    Budak Mimin • GTA 6
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
                className={`absolute -bottom-3 ${position.includes("right") ? "right-8" : "left-8"
                  } w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[14px] border-t-pink-400`}
              ></div>
              <div
                className={`absolute -bottom-2 ${position.includes("right") ? "right-[33px]" : "left-[33px]"
                  } w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-black/90`}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 2. AUDIO-REACTIVE PIXEL ART AVATAR: BUDAK MIMIN */}
      <div className="relative group cursor-pointer pointer-events-auto">
        {/* Outer Neon Glow Aura when Speaking */}
        <div
          className={`absolute -inset-2 rounded-2xl transition-all duration-300 ${isSpeaking
            ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 opacity-95 blur-md animate-pulse scale-110"
            : "bg-pink-500/20 opacity-40 blur-sm scale-95"
            }`}
        ></div>

        {/* Character Frame: Pixel Art Avatar with Audio Equalizer Bounce & Cooldown Border */}
        <div
          className={`relative w-20 h-20 md:w-24 md:h-24 rounded-2xl border-3 overflow-hidden bg-gray-900 shadow-2xl transition-all duration-300 flex items-center justify-center ${isSpeaking
            ? "border-pink-400 scale-105 rotate-1 animate-[bounce_1.2s_infinite]"
            : cooldownRemaining > 0
              ? "border-amber-400/90 shadow-amber-500/30 scale-100"
              : "border-purple-400/80 hover:border-pink-400 scale-100"
            }`}
        >
          {/* Mimin's Uploaded Pixel Art Image */}
          <img
            src="/images/budak-mimin.jpg"
            alt="Budak Mimin"
            className={`w-full h-full object-cover transition-transform duration-200 ${isSpeaking ? "scale-110" : "scale-100"
              }`}
            style={{ imageRendering: "pixelated" }}
          />

          {/* Speaking Equalizer Overlay on Avatar Bottom */}
          {isSpeaking && (
            <div className="absolute inset-x-0 bottom-0 py-1 bg-black/70 backdrop-blur-xs flex items-center justify-center gap-1">
              <span className="w-1 h-3 bg-pink-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
              <span className="w-1 h-4 bg-yellow-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
              <span className="w-1 h-2.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
              <span className="w-1 h-3.5 bg-pink-400 rounded-full animate-bounce [animation-delay:200ms]"></span>
            </div>
          )}

          {/* Online Co-Host Badge Dot (Amber during cooldown, Emerald when ready) */}
          {cooldownRemaining > 0 ? (
            <span
              title={`Cooldown: ${cooldownRemaining}s`}
              className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-amber-400 border-2 border-black rounded-full shadow-md animate-pulse"
            ></span>
          ) : (
            <span
              title="Siap ditanya (!tanyaai)"
              className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-black rounded-full shadow-md animate-pulse"
            ></span>
          )}
        </div>

        {/* Name Tag Pill */}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/90 border border-pink-500/80 shadow-lg text-[10px] font-black text-yellow-300 tracking-wider uppercase shrink-0 whitespace-nowrap flex items-center gap-1 z-10">
          <span>🎮</span>
          <span>Budak Mimin</span>
        </div>

        {/* Dynamic Cooldown & Availability Status Badge */}
        {cooldownRemaining > 0 ? (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/95 border border-amber-400/90 shadow-lg text-[9.5px] font-black text-amber-300 tracking-wider uppercase shrink-0 whitespace-nowrap flex items-center gap-1.5 shadow-amber-500/25">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>⏳ Cooldown {cooldownRemaining}s</span>
          </div>
        ) : (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/90 border border-emerald-400/80 shadow-lg text-[9.5px] font-black text-emerald-300 tracking-wider shrink-0 whitespace-nowrap flex items-center gap-1.5 shadow-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>✨ !tanyaai Siap</span>
          </div>
        )}
      </div>
    </div>
  );
}
