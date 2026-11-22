"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";

interface SfxEvent {
  id: string;
  sfxId: string;
  name: string;
  command: string;
  emoji: string;
  url: string;
  sender: string;
  nickname: string;
  timestamp: string;
}

function SfxOverlayContent() {
  const searchParams = useSearchParams();
  const position = searchParams.get("pos") || "bottom-left";
  const isPreview = searchParams.get("preview") === "1";

  const [currentSfx, setCurrentSfx] = useState<SfxEvent | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(true);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTriggerRef = useRef<{ id: string; sfxId: string; time: number } | null>(null);

  // Stop any active audio and release decoder resources
  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = "";
      } catch (e) {
        // Ignore audio stop errors
      }
      currentAudioRef.current = null;
    }
  };

  // Unlock audio autoplay on mount
  useEffect(() => {
    const unlock = () => {
      try {
        const silentAudio = new Audio(
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        );
        silentAudio.volume = 0.01;
        silentAudio
          .play()
          .then(() => setAudioUnlocked(true))
          .catch(() => setAudioUnlocked(false));
      } catch {
        setAudioUnlocked(false);
      }
    };

    unlock();
    window.addEventListener("click", unlock, { once: true });
    return () => window.removeEventListener("click", unlock);
  }, []);

  // Handle incoming SFX trigger
  const triggerSfxAlert = (data: SfxEvent) => {
    const now = Date.now();
    // Debounce: prevent duplicate trigger within 2 seconds for the same event id or sfxId
    if (
      lastTriggerRef.current &&
      (lastTriggerRef.current.id === data.id ||
        (lastTriggerRef.current.sfxId === data.sfxId && now - lastTriggerRef.current.time < 2000))
    ) {
      console.log("Ignored duplicate SFX trigger:", data);
      return;
    }
    lastTriggerRef.current = { id: data.id, sfxId: data.sfxId, time: now };

    // 1. Clear any active dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    // 2. Stop previous sound
    stopAudio();

    // 3. Set visual state
    setCurrentSfx(data);

    // 4. Play audio
    try {
      const audio = new Audio(data.url);
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Autoplay blocked or audio failed to load:", err);
          setAudioUnlocked(false);
        });
      }
    } catch (err) {
      console.error("Audio trigger failed:", err);
    }

    // 5. Auto dismiss after 4.5 seconds
    dismissTimerRef.current = setTimeout(() => {
      setCurrentSfx(null);
      stopAudio();
    }, 4500);
  };

  // Preview mode
  useEffect(() => {
    if (isPreview) {
      triggerSfxAlert({
        id: "preview-sfx",
        sfxId: "klakson",
        name: "Klakson Mobil",
        command: "!klakson",
        emoji: "🚗",
        url: "/sfx/klakson.mp3",
        sender: "yudhacode",
        nickname: "Yudha Streamer",
        timestamp: new Date().toISOString(),
      });
    }
  }, [isPreview]);

  // Subscribe to Pusher donation-stream
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, {
      cluster,
    });

    const channel = pusher.subscribe("donation-stream");

    channel.bind("sfx-trigger", (data: SfxEvent) => {
      console.log("Overlay received sfx-trigger:", data);
      triggerSfxAlert(data);
    });

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      stopAudio();
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case "bottom-center":
        return "items-end justify-center pb-12";
      case "top-center":
        return "items-start justify-center pt-8";
      case "top-left":
        return "items-start justify-start p-8";
      case "top-right":
        return "items-start justify-end p-8";
      case "bottom-right":
        return "items-end justify-end p-8 pb-12";
      case "bottom-left":
      default:
        return "items-end justify-start p-8 pb-12";
    }
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex select-none font-sans pointer-events-none ${getPositionClasses()}`}
    >
      {/* Audio unlock banner if blocked */}
      {!audioUnlocked && (
        <div
          onClick={() => {
            const silent = new Audio(
              "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
            );
            silent.play().then(() => setAudioUnlocked(true));
          }}
          className="fixed top-4 left-4 z-50 bg-amber-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-lg cursor-pointer pointer-events-auto flex items-center gap-2 animate-bounce"
        >
          <span>🔊</span> Klik layar untuk mengaktifkan audio SFX
        </div>
      )}

      {currentSfx && (
        <div
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
          onClick={() => {
            setCurrentSfx(null);
            stopAudio();
          }}
          title="Klik untuk menutup"
          className="animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-sm w-full pointer-events-auto cursor-pointer"
        >
          {/* SFX Alert Toast Card */}
          <div className="bg-black/90 rounded-2xl p-4 border-2 border-yellow-400 shadow-2xl flex flex-col gap-2.5 backdrop-blur-none transition hover:border-yellow-300">
            {/* Top Row: Emoji & Sender */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-3xl shrink-0 animate-bounce">{currentSfx.emoji}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-yellow-400 text-black font-black text-[11px] uppercase tracking-wider">
                      {currentSfx.command}
                    </span>
                    <span className="text-[11px] text-gray-300 font-bold truncate">
                      @{currentSfx.sender}
                    </span>
                  </div>
                  <h3 className="saweria-text-yellow text-base font-black truncate">
                    {currentSfx.name}
                  </h3>
                </div>
              </div>

              {/* Sound Wave Indicator */}
              <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-yellow-400/20 rounded-md border border-yellow-400/40">
                <span className="w-1 h-3.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                <span className="w-1 h-5 bg-yellow-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                <span className="w-1 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                <span className="text-[10px] font-bold text-yellow-300 ml-1">SFX</span>
              </div>
            </div>

            {/* Freemium Hook Bar */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
              <span className="text-yellow-300/90 font-bold flex items-center gap-1">
                <span>⚡</span> Cooldown: 30s
              </span>
              <span className="text-gray-400 font-semibold truncate">
                Bypass cooldown? Donasi di <strong className="text-white">twodigit.io</strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SfxOverlayPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center text-white/70 bg-transparent font-bold">
          Loading SFX overlay...
        </div>
      }
    >
      <SfxOverlayContent />
    </Suspense>
  );
}
