"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";
import { TikTokEventPayload } from "@/lib/tiktok-events";

function TikTokEventsOverlayContent() {
  const searchParams = useSearchParams();
  const position = searchParams.get("pos") || "bottom-left"; // bottom-left | bottom-right | bottom-center | top-left | top-right
  const isPreview = searchParams.get("preview") === "1";

  const [currentEvent, setCurrentEvent] = useState<TikTokEventPayload | null>(null);
  const [queue, setQueue] = useState<TikTokEventPayload[]>([]);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  // Audio and timer references
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeEventIdRef = useRef<string | null>(null);
  const isDismissingRef = useRef<boolean>(false);

  // Clear timers belonging to the active event (does NOT kill transitionTimeoutRef)
  const clearEventTimers = () => {
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
    if (watchdogTimeoutRef.current) {
      clearTimeout(watchdogTimeoutRef.current);
      watchdogTimeoutRef.current = null;
    }
  };

  // Clear all timers including transition timer (used on unmount)
  const clearAllTimers = () => {
    clearEventTimers();
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  };

  // Safely stop audio and null out all listeners FIRST to prevent ghost callbacks
  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.onloadedmetadata = null;
      audio.onstalled = null;
      audio.onplay = null;
      audio.onpause = null;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  };

  // Safe dismiss routine: guarantees clean transition and resets all flags
  const dismissCurrentEvent = (targetEventId?: string) => {
    if (
      targetEventId &&
      activeEventIdRef.current &&
      activeEventIdRef.current !== targetEventId
    ) {
      return;
    }
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    clearEventTimers();
    stopAudio();
    setIsExiting(true);

    exitTimeoutRef.current = setTimeout(() => {
      exitTimeoutRef.current = null;
      setCurrentEvent(null);
      setIsExiting(false);
      activeEventIdRef.current = null;
      isDismissingRef.current = false;

      // 200ms breather before showing next item (prevents visual collision & overlapping audio)
      setIsTransitioning(true);
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      transitionTimeoutRef.current = setTimeout(() => {
        transitionTimeoutRef.current = null;
        setIsTransitioning(false);
      }, 200);
    }, 250);
  };

  // Initialize persistent Audio element & unlock autoplay on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    const unlock = () => {
      try {
        const silent = new Audio(
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        );
        silent.volume = 0.01;
        silent.play().catch(() => {});
      } catch {}
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      clearAllTimers();
      stopAudio();
      audioRef.current = null;
    };
  }, []);

  // Demo preview mode
  useEffect(() => {
    if (isPreview && !currentEvent) {
      setCurrentEvent({
        id: "preview-1",
        eventType: "gift",
        uniqueId: "budi_gaming",
        nickname: "Budi Santoso",
        giftName: "Mawar",
        giftCount: 5,
        speechText: "Terima kasih banyak Budi Santoso sudah mengirim 5 Mawar!",
        displayText: "Budi Santoso mengirim Mawar x5!",
        badgeEmoji: "🎁",
        timestamp: new Date().toISOString(),
        priority: 1,
      });
      setIsExiting(false);
    }
  }, [isPreview]);

  // Subscribe to Pusher 'donation-stream'
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, { cluster });
    const channel = pusher.subscribe("donation-stream");

    channel.bind("tiktok-live-event", (data: TikTokEventPayload) => {
      if (!data || !data.id) return;
      console.log("Overlay received TikTok Live Event:", data.eventType, data.nickname);

      // If static preview card is currently displayed, clear it so real simulation events can play
      setCurrentEvent((curr) => (curr && curr.id === "preview-1" ? null : curr));

      setQueue((prev) => {
        // Prevent duplicate events
        if (prev.some((item) => item.id === data.id)) return prev;

        // SMART ANTI-COLLISION:
        // If a viewer sends a 'chat' or 'gift', remove any pending 'join' greeting for that same viewer!
        let filtered = prev;
        if (data.eventType === "chat" || data.eventType === "gift") {
          filtered = prev.filter(
            (item) => !(item.eventType === "join" && item.uniqueId === data.uniqueId)
          );
        }

        // Keep up to 15 pending events so rapid multi-click testing never drops categories
        let updated = [...filtered, data];
        if (updated.length > 15) {
          const gifts = updated.filter((x) => x.priority === 1);
          const others = updated.filter((x) => x.priority > 1).slice(-10);
          updated = [...gifts, ...others];
        }

        // Sort: Gifts (1) > Chat (2) > Follow/Share (2) > Join (4)
        return updated.sort((a, b) => (a.priority || 4) - (b.priority || 4));
      });
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  // Queue Consumer: Picks next item when idle
  useEffect(() => {
    if (currentEvent === null && queue.length > 0 && !isExiting && !isTransitioning) {
      const [nextItem, ...remaining] = queue;
      isDismissingRef.current = false;
      setIsExiting(false);
      setCurrentEvent(nextItem);
      setQueue(remaining);
    }
  }, [currentEvent, queue, isExiting, isTransitioning]);

  // Active event display and TTS audio playback
  useEffect(() => {
    if (!currentEvent) {
      setIsExiting(false);
      activeEventIdRef.current = null;
      isDismissingRef.current = false;
      return;
    }
    if (currentEvent.id === "preview-1") return;

    const eventId = currentEvent.id;

    // Guaranteed 100% visible from millisecond 0 (prevents opacity-0 race condition)
    setIsExiting(false);
    isDismissingRef.current = false;
    activeEventIdRef.current = eventId;
    clearEventTimers();
    stopAudio();

    const speechText = currentEvent.speechText || "";

    // 1. DYNAMIC WATCHDOG TIMER: Always guarantees the card auto-dismisses safely
    const estimatedDuration = Math.min(
      15000,
      Math.max(5000, Math.ceil(speechText.length * 110) + 3000)
    );
    watchdogTimeoutRef.current = setTimeout(() => {
      dismissCurrentEvent(eventId);
    }, estimatedDuration);

    // 2. PLAY TTS AUDIO VIA HTML5 AUDIO ELEMENT
    if (speechText) {
      try {
        const audio = audioRef.current;
        if (audio) {
          audio.src = `/api/tts?text=${encodeURIComponent(speechText)}&t=${Date.now()}`;
          audio.volume = 1.0;

          // When exact audio duration is loaded, adapt watchdog accurately
          audio.onloadedmetadata = () => {
            if (activeEventIdRef.current !== eventId || isDismissingRef.current) return;
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
              const audioMs = Math.round(audio.duration * 1000);
              if (watchdogTimeoutRef.current) {
                clearTimeout(watchdogTimeoutRef.current);
              }
              watchdogTimeoutRef.current = setTimeout(() => {
                dismissCurrentEvent(eventId);
              }, audioMs + 2500);
            }
          };

          // Audio finished cleanly: give smooth 650ms pause then dismiss
          audio.onended = () => {
            if (activeEventIdRef.current !== eventId || isDismissingRef.current) return;
            if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = setTimeout(() => {
              dismissCurrentEvent(eventId);
            }, 650);
          };

          audio.onerror = (e) => {
            if (activeEventIdRef.current !== eventId || isDismissingRef.current) return;
            console.warn("TTS audio failed to load:", e);
            if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
            // Keep visual popup readable for 3.2s even if TTS audio fails
            dismissTimeoutRef.current = setTimeout(() => {
              dismissCurrentEvent(eventId);
            }, 3200);
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              if (activeEventIdRef.current !== eventId || isDismissingRef.current) return;
              if (err.name === "AbortError") return;
              console.warn("Audio autoplay blocked or interrupted:", err);
              if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
              dismissTimeoutRef.current = setTimeout(() => {
                dismissCurrentEvent(eventId);
              }, 3200);
            });
          }
        }
      } catch (err) {
        console.error("TTS playback error:", err);
        if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = setTimeout(() => {
          dismissCurrentEvent(eventId);
        }, 3200);
      }
    } else {
      dismissTimeoutRef.current = setTimeout(() => {
        dismissCurrentEvent(eventId);
      }, 3500);
    }

    return () => {
      clearEventTimers();
      stopAudio();
    };
  }, [currentEvent]);

  if (!currentEvent) return null;

  // Positioning helper
  const getPositionClasses = () => {
    switch (position) {
      case "bottom-right":
        return "items-end justify-end p-8 pb-12";
      case "bottom-center":
        return "items-end justify-center pb-12";
      case "top-left":
        return "items-start justify-start p-8";
      case "top-right":
        return "items-start justify-end p-8";
      case "bottom-left":
      default:
        return "items-end justify-start p-8 pb-12";
    }
  };

  // Badge styling per event
  const getBadgeStyle = () => {
    switch (currentEvent.eventType) {
      case "gift":
        return "bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-yellow-300 font-black";
      case "chat":
        return "bg-blue-600/80 text-white border-blue-400 font-bold";
      case "follow":
        return "bg-purple-600/80 text-white border-purple-400 font-bold";
      case "share":
        return "bg-emerald-600/80 text-white border-emerald-400 font-bold";
      case "join":
      default:
        return "bg-gray-800 text-yellow-300 border-gray-600 font-bold";
    }
  };

  const getBadgeLabel = (type: string) => {
    switch (type) {
      case "gift":
        return "🎁 Gift Saweran";
      case "chat":
        return "💬 Live Chat";
      case "follow":
        return "➕ Follow Baru";
      case "share":
        return "📢 Share Live";
      case "join":
      default:
        return "👋 Sapaan Join";
    }
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex select-none font-sans pointer-events-none ${getPositionClasses()}`}
    >
      <div
        key={currentEvent.id}
        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
        onClick={() => dismissCurrentEvent(currentEvent.id)}
        className={`w-full max-w-md duration-300 flex flex-col gap-2 pointer-events-auto cursor-pointer transition-all ${
          isExiting
            ? "opacity-0 translate-y-3 scale-95 pointer-events-none"
            : "opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-5"
        }`}
      >
        {/* Saweria Style Floating Event Card */}
        <div className="bg-black/85 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-2 backdrop-blur-none">
          {/* Header Meta: Emoji, Event Badge & TikTok Live indicator */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl shrink-0">{currentEvent.badgeEmoji}</span>
              <span
                className={`px-2.5 py-0.5 rounded-lg border text-[11px] tracking-wider uppercase font-black shadow-sm ${getBadgeStyle()}`}
              >
                {getBadgeLabel(currentEvent.eventType)}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              TikTok Live
            </span>
          </div>

          {/* Nickname: Full width, NEVER covered by badge! */}
          <div className="pt-0.5">
            <h3 className="saweria-text-yellow text-lg md:text-xl uppercase font-black leading-tight break-words">
              {currentEvent.nickname}
            </h3>
          </div>

          {/* Event Content / Message */}
          <div className="pt-0.5">
            <p className="saweria-text-white text-base md:text-lg font-black leading-snug break-words">
              {currentEvent.displayText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TikTokEventsOverlayPage() {
  return (
    <Suspense fallback={null}>
      <TikTokEventsOverlayContent />
    </Suspense>
  );
}
