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
  // STRICT ID GUARD: exitingEventId tracks the exact ID of the event exiting, preventing cross-event opacity leaks
  const [exitingEventId, setExitingEventId] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(true);

  // Active audio state & countdown duration (forces continuous 60fps compositing on macOS CEF / Apple Silicon M1)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [displayDuration, setDisplayDuration] = useState<number>(4500);
  const [isCardVisible, setIsCardVisible] = useState<boolean>(false);

  // Audio and timer references
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentEventIdRef = useRef<string | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cardRevealTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventVisibleSinceRef = useRef<number>(0);

  // Clear timers belonging to the active event (does NOT touch exitTimer)
  const clearActiveEventTimers = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (cardRevealTimeoutRef.current) {
      clearTimeout(cardRevealTimeoutRef.current);
      cardRevealTimeoutRef.current = null;
    }
  };

  // Safely stop audio and null out all listeners FIRST to prevent ghost callbacks
  const stopAudio = () => {
    setIsSpeaking(false);
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

  // Strict ID-Guarded Dismiss Routine: CAN NEVER DISMISS OR FADE OUT A DIFFERENT EVENT!
  const dismissCurrentEvent = (targetEventId: string) => {
    // If the active event ID doesn't match targetEventId, this timer belongs to an old/different event -> IGNORE!
    if (!targetEventId || currentEventIdRef.current !== targetEventId) {
      return;
    }

    clearActiveEventTimers();
    stopAudio();

    // Mark THIS EXACT event ID as exiting
    setExitingEventId(targetEventId);

    // After CSS fade-out transition (280ms), atomically unmount the event if ID still matches
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      if (currentEventIdRef.current === targetEventId) {
        currentEventIdRef.current = null;
        setExitingEventId(null);
        setCurrentEvent(null);
      }
    }, 280);
  };

  // Tab switch recovery: ensure the card remains visible if user switches tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentEventIdRef.current) {
        eventVisibleSinceRef.current = Date.now();
        const activeId = currentEventIdRef.current;
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = setTimeout(() => {
            if (currentEventIdRef.current === activeId) {
              dismissCurrentEvent(activeId);
            }
          }, 3200);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

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
      setAudioUnlocked(true);
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      clearActiveEventTimers();
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
      stopAudio();
      audioRef.current = null;
    };
  }, []);

  // Demo preview mode
  useEffect(() => {
    if (isPreview && !currentEvent) {
      const previewItem: TikTokEventPayload = {
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
      };
      currentEventIdRef.current = "preview-1";
      setCurrentEvent(previewItem);
      setIsCardVisible(true);
      setExitingEventId(null);
      setDisplayDuration(6000);
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
      setCurrentEvent((curr) => {
        if (curr && curr.id === "preview-1") {
          currentEventIdRef.current = null;
          setExitingEventId(null);
          return null;
        }
        return curr;
      });

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

        // Buffer up to 25 items so fast multi-click testing never drops any category
        let updated = [...filtered, data];
        if (updated.length > 25) {
          const gifts = updated.filter((x) => x.priority === 1);
          const others = updated.filter((x) => x.priority > 1).slice(-18);
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

  // Preload audio for next in queue so playback starts instantly when popped
  useEffect(() => {
    if (queue.length > 0 && queue[0].speechText) {
      const preloadAudio = new Audio();
      preloadAudio.preload = "auto";
      preloadAudio.src = `/api/tts?text=${encodeURIComponent(queue[0].speechText)}`;
    }
  }, [queue]);

  // Queue Consumer: Deterministically picks next item when idle and previous exit animation has cleared
  useEffect(() => {
    if (currentEvent === null && queue.length > 0 && exitingEventId === null) {
      const [nextItem, ...remaining] = queue;
      currentEventIdRef.current = nextItem.id;
      setExitingEventId(null);
      setIsCardVisible(false);
      setCurrentEvent(nextItem);
      setQueue(remaining);
    }
  }, [currentEvent, queue, exitingEventId]);

  // Active event display and TTS audio playback
  useEffect(() => {
    if (!currentEvent) {
      setIsSpeaking(false);
      return;
    }
    if (currentEvent.id === "preview-1") return;

    const eventId = currentEvent.id;
    currentEventIdRef.current = eventId;
    eventVisibleSinceRef.current = Date.now();
    setIsSpeaking(false);
    setDisplayDuration(4500);

    // Clear stale event timers
    clearActiveEventTimers();
    stopAudio();

    const speechText = currentEvent.speechText || "";

    // Helper: compute remaining hold time so popup NEVER disappears prematurely
    const getHoldDelay = (postAudioMs = 1500, minTotalVisibleMs = 4000) => {
      const elapsedVisible = Date.now() - eventVisibleSinceRef.current;
      return Math.max(postAudioMs, minTotalVisibleMs - elapsedVisible);
    };

    // Helper: Reveal card & start visible countdown timer
    const revealCard = (durationMs?: number) => {
      if (cardRevealTimeoutRef.current) {
        clearTimeout(cardRevealTimeoutRef.current);
        cardRevealTimeoutRef.current = null;
      }
      if (currentEventIdRef.current !== eventId) return;
      eventVisibleSinceRef.current = Date.now();
      if (durationMs) {
        setDisplayDuration(durationMs);
      }
      setIsCardVisible(true);
    };

    // 1. SAFETY WATCHDOG TIMER: Always guarantees the card auto-dismisses eventually
    const estimatedDuration = Math.min(
      15000,
      Math.max(6000, Math.ceil(speechText.length * 120) + 4000)
    );
    watchdogTimerRef.current = setTimeout(() => {
      if (currentEventIdRef.current === eventId) {
        dismissCurrentEvent(eventId);
      }
    }, estimatedDuration);

    // 2. PLAY TTS AUDIO DIRECTLY & SYNCHRONIZE CARD REVEAL
    if (speechText) {
      // Safety reveal timer: if network/audio takes > 450ms, reveal card anyway so it never hangs
      cardRevealTimeoutRef.current = setTimeout(() => {
        revealCard(4500);
      }, 450);

      try {
        const audio = audioRef.current;
        if (audio) {
          audio.src = `/api/tts?text=${encodeURIComponent(speechText)}`;
          audio.volume = 1.0;

          // When audio metadata is loaded: set exact duration, reveal card, and play audio synchronously!
          audio.onloadedmetadata = () => {
            if (currentEventIdRef.current !== eventId) return;
            const audioMs =
              audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)
                ? Math.round(audio.duration * 1000)
                : 3000;
            const totalDisplayMs = Math.max(4000, audioMs + 1500);
            revealCard(totalDisplayMs);

            if (watchdogTimerRef.current) {
              clearTimeout(watchdogTimerRef.current);
            }
            watchdogTimerRef.current = setTimeout(() => {
              if (currentEventIdRef.current === eventId) {
                dismissCurrentEvent(eventId);
              }
            }, audioMs + 3200);

            audio.play().catch((err) => {
              if (currentEventIdRef.current !== eventId) return;
              setIsSpeaking(false);
              if (err.name === "AbortError") return;
              if (err.name === "NotAllowedError") {
                setAudioUnlocked(false);
              }
              console.warn("Audio autoplay blocked:", err);
            });
          };

          audio.onplay = () => {
            if (currentEventIdRef.current === eventId) {
              setIsSpeaking(true);
              revealCard();
            }
          };

          // Audio finished cleanly: hold card for reading time (at least 4.0s total display)
          audio.onended = () => {
            if (currentEventIdRef.current !== eventId) return;
            setIsSpeaking(false);
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = setTimeout(() => {
              if (currentEventIdRef.current === eventId) {
                dismissCurrentEvent(eventId);
              }
            }, getHoldDelay(1500, 4000));
          };

          audio.onerror = (e) => {
            if (currentEventIdRef.current !== eventId) return;
            setIsSpeaking(false);
            revealCard(4200);
            console.warn("TTS audio failed to load:", e);
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = setTimeout(() => {
              if (currentEventIdRef.current === eventId) {
                dismissCurrentEvent(eventId);
              }
            }, getHoldDelay(3500, 4200));
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                if (currentEventIdRef.current === eventId) {
                  setIsSpeaking(true);
                  revealCard();
                }
              })
              .catch((err) => {
                if (currentEventIdRef.current !== eventId) return;
                if (err.name === "AbortError") return;
              });
          }
        }
      } catch (err) {
        console.error("TTS playback error:", err);
        revealCard(4200);
        setIsSpeaking(false);
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => {
          if (currentEventIdRef.current === eventId) {
            dismissCurrentEvent(eventId);
          }
        }, getHoldDelay(3500, 4200));
      }
    } else {
      // Event without audio text: display for 4.2 seconds
      revealCard(4200);
      dismissTimerRef.current = setTimeout(() => {
        if (currentEventIdRef.current === eventId) {
          dismissCurrentEvent(eventId);
        }
      }, 4200);
    }

    return () => {
      clearActiveEventTimers();
    };
  }, [currentEvent]);

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
  const getBadgeStyle = (type?: string) => {
    switch (type) {
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

  // STRICT ID MATCH: this card ONLY has opacity-0 if its exact ID equals exitingEventId!
  const isCardExiting = currentEvent && exitingEventId === currentEvent.id;

  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex select-none font-sans pointer-events-none ${getPositionClasses()}`}
    >
      {!audioUnlocked && (
        <div
          onClick={() => {
            try {
              const silent = new Audio(
                "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
              );
              silent.volume = 0.01;
              silent.play().catch(() => {});
            } catch {}
            setAudioUnlocked(true);
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/85 text-yellow-300 text-xs font-bold px-4 py-2 rounded-full border border-yellow-400 pointer-events-auto cursor-pointer animate-pulse z-50 shadow-lg flex items-center gap-1.5"
        >
          <span>🔊</span> Klik layar untuk mengaktifkan suara audio
        </div>
      )}
      {currentEvent && isCardVisible && (
        <div
          key={currentEvent.id}
          onClick={() => dismissCurrentEvent(currentEvent.id)}
          className={`w-full max-w-md flex flex-col gap-2 pointer-events-auto cursor-pointer transition-all duration-300 ease-out ${
            isCardExiting
              ? "opacity-0 translate-y-3 scale-95 pointer-events-none"
              : "opacity-100 translate-y-0 scale-100"
          }`}
        >
          {/* Saweria Style Floating Event Card */}
          <div className="bg-black/85 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-2.5 backdrop-blur-none">
            {/* Header Meta: Emoji, Event Badge, Speaking Equalizer & Queue Counter */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xl shrink-0">{currentEvent.badgeEmoji}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg border text-[11px] tracking-wider uppercase font-black shadow-sm ${getBadgeStyle(
                    currentEvent.eventType
                  )}`}
                >
                  {getBadgeLabel(currentEvent.eventType)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isSpeaking && (
                  <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 bg-yellow-400/20 rounded-md border border-yellow-400/40">
                    <span className="w-1 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                    <span className="w-1 h-4 bg-yellow-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                    <span className="w-1 h-2.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                    <span className="text-[10px] font-bold text-yellow-300 ml-0.5">TTS</span>
                  </div>
                )}
                {queue.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-black tracking-wide">
                    +{queue.length} antre
                  </span>
                )}
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  TikTok Live
                </span>
              </div>
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

            {/* Visual Lifetime Countdown Bar (Forces active 60fps repaints on macOS CEF / M1) */}
            <div className="w-full bg-yellow-400/20 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                key={`${currentEvent.id}-${displayDuration}`}
                className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full origin-left rounded-full"
                style={{
                  animation: `shrinkWidth ${displayDuration}ms linear forwards`,
                }}
              />
            </div>
          </div>
        </div>
      )}
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
