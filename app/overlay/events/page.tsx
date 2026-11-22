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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and unlock audio on mount
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const unlock = () => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      window.removeEventListener("click", unlock);
    };

    window.addEventListener("click", unlock);
    return () => window.removeEventListener("click", unlock);
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
    }
  }, [isPreview]);

  // Subscribe to Pusher channel
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, { cluster });
    const channel = pusher.subscribe("donation-stream");

    channel.bind("tiktok-live-event", (data: TikTokEventPayload) => {
      console.log("Overlay received TikTok Live Event:", data);

      setQueue((prev) => {
        // Prevent duplicate events
        if (prev.some((item) => item.id === data.id)) return prev;

        const updated = [...prev, data];
        // Anti-lag limit: Keep max 6 pending items so audio stays real-time
        if (updated.length > 6) {
          const gifts = updated.filter((x) => x.priority === 1);
          const others = updated.filter((x) => x.priority > 1).slice(-4);
          return [...gifts, ...others];
        }

        // Sort: Gifts (priority 1) jump to front, others maintain chronological order
        return updated.sort((a, b) => {
          if (a.priority === 1 && b.priority !== 1) return -1;
          if (b.priority === 1 && a.priority !== 1) return 1;
          return 0;
        });
      });
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  // 1. Pick next event when none is active
  useEffect(() => {
    if (currentEvent === null && queue.length > 0 && !isExiting) {
      const [nextItem, ...remaining] = queue;
      setCurrentEvent(nextItem);
      setQueue(remaining);
    }
  }, [currentEvent, queue, isExiting]);

  // 2. Play TTS and schedule auto-dismiss
  useEffect(() => {
    if (!currentEvent) return;

    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }

    const dismissEvent = (delay = 0) => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
      if (delay > 0) {
        dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), delay);
        return;
      }
      setIsExiting(true);
      setTimeout(() => {
        setCurrentEvent(null);
        setIsExiting(false);
      }, 250);
    };

    // Snappy safety fallback timer (join sapaan 4.5s max, gifts 7s max)
    const watchdogTime = currentEvent.eventType === "join" ? 4500 : 7000;
    dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), watchdogTime);

    // Play TTS audio
    const playEventTTS = (text: string) => {
      try {
        const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&t=${Date.now()}`;
        let audio = audioRef.current;
        if (!audio) {
          audio = new Audio();
          audioRef.current = audio;
        }

        audio.pause();
        audio.src = audioUrl;
        audio.volume = 1.0;

        audio.onloadedmetadata = () => {
          if (audio && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            const audioMs = Math.round(audio.duration * 1000);
            if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), audioMs + 1000);
          }
        };

        audio.onended = () => {
          if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
          dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), 800);
        };

        audio.onerror = () => {
          if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
          dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), 2000);
        };

        audio.onstalled = () => {
          if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
          dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), 2500);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("Audio autoplay blocked, using fallback dismiss:", err);
            if ("speechSynthesis" in window) {
              try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = "id-ID";
                utterance.rate = 1.05;
                utterance.onend = () => {
                  if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
                  dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), 800);
                };
                window.speechSynthesis.speak(utterance);
              } catch {
                if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
                dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), 2500);
              }
            } else {
              if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
              dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), 2500);
            }
          });
        }
      } catch (e) {
        console.error("TTS trigger error:", e);
        if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), 2500);
      }
    };

    if (currentEvent.speechText) {
      playEventTTS(currentEvent.speechText);
    } else {
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = setTimeout(() => dismissEvent(0), 3000);
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
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
        return "bg-gray-800/80 text-yellow-300 border-gray-600 font-bold";
    }
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex select-none font-sans pointer-events-none ${getPositionClasses()}`}
    >
      <div
        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => {
            setCurrentEvent(null);
            setIsExiting(false);
          }, 200);
        }}
        className={`w-full max-w-md duration-300 flex flex-col gap-2 pointer-events-auto cursor-pointer transition-all ${
          isExiting
            ? "opacity-0 translate-y-3 scale-95 pointer-events-none"
            : "opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-5"
        }`}
      >
        {/* Saweria Style Floating Event Card */}
        <div className="bg-black/85 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-2.5 backdrop-blur-none">
          {/* Header Badge & Nickname */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl shrink-0">{currentEvent.badgeEmoji}</span>
              <span className="saweria-text-yellow text-xl md:text-2xl uppercase font-black truncate">
                {currentEvent.nickname}
              </span>
            </div>

            <span className={`px-2.5 py-0.5 rounded-lg border text-xs tracking-wider uppercase shrink-0 shadow-sm ${getBadgeStyle()}`}>
              {currentEvent.eventType}
            </span>
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
