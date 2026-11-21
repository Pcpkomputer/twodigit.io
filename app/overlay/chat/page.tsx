"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";

interface InteractiveChatMessage {
  id: string;
  sender: string;
  message: string;
  badge?: string;
  theme?: string;
  voice?: string;
  createdAt: string;
}

const MAX_QUEUE_SIZE = 4; // Drop oldest when intense chat creates high backlog

function ChatOverlayContent() {
  const searchParams = useSearchParams();
  const position = searchParams.get("pos") || "bottom-left"; // bottom-left | bottom-center | top-center | top-left

  const [currentChat, setCurrentChat] = useState<InteractiveChatMessage | null>(null);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [queue, setQueue] = useState<InteractiveChatMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [displayDuration, setDisplayDuration] = useState<number>(5000);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedChatIdsRef = useRef<Set<string>>(new Set());

  // Cleanly stops any ongoing speech / audio playback
  const stopAudio = () => {
    setIsSpeaking(false);
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.onpause = null;
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      } catch {}
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  };

  const clearAllTimers = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }
  };

  // Safe dismiss routine: plays exit animation and guarantees popup clears
  const dismissChat = () => {
    clearAllTimers();
    stopAudio();
    setIsExiting(true);

    setTimeout(() => {
      setCurrentChat(null);
      setIsExiting(false);
      // 400ms breather so popup visibly closes before opening the next message
      setIsTransitioning(true);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 400);
    }, 250);
  };

  // Initialize and unlock audio element on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    const unlockAudio = () => {
      try {
        const silentAudio = new Audio(
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        );
        silentAudio.volume = 0.01;
        silentAudio.play().catch(() => {});
      } catch {}
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      clearAllTimers();
      stopAudio();
    };
  }, []);

  // Text-to-Speech playback helper with dynamic duration detection and safety timeout
  const playTTS = (
    text: string,
    onEnded?: () => void,
    onDurationKnown?: (durationMs: number) => void,
    voiceName = "schoolgirl"
  ) => {
    if (!text || typeof window === "undefined") {
      onEnded?.();
      return;
    }

    stopAudio();
    setIsSpeaking(true);

    let endedCalled = false;
    const triggerEnd = () => {
      if (endedCalled) return;
      endedCalled = true;
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
        audioTimeoutRef.current = null;
      }
      setIsSpeaking(false);
      onEnded?.();
    };

    // Initial timeout before metadata loads (e.g. 6s for network handshake)
    audioTimeoutRef.current = setTimeout(() => {
      console.warn("TTS audio initial handshake timed out");
      triggerEnd();
    }, 6000);

    try {
      const voiceParam = voiceName ? `&voice=${encodeURIComponent(voiceName)}` : "&voice=schoolgirl";
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}${voiceParam}&t=${Date.now()}`;
      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      // When audio metadata is parsed, adapt timers to the EXACT audio length!
      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          const audioMs = Math.round(audio.duration * 1000);
          if (audioTimeoutRef.current) {
            clearTimeout(audioTimeoutRef.current);
          }
          // Safety timeout based on actual audio duration + 3.5s buffer
          audioTimeoutRef.current = setTimeout(() => {
            console.warn("TTS audio duration safety limit reached");
            triggerEnd();
          }, audioMs + 3500);

          onDurationKnown?.(audioMs);
        }
      };

      audio.onended = () => {
        triggerEnd();
      };

      audio.onerror = (e) => {
        console.warn("TTS audio failed to load:", e);
        triggerEnd();
      };

      audio.onstalled = () => {
        console.warn("TTS audio stalled");
        triggerEnd();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name === "AbortError") return;
          console.warn("Audio play blocked or interrupted:", err);
          triggerEnd();
        });
      }
    } catch (e) {
      console.error("TTS playback error:", e);
      triggerEnd();
    }
  };

  // Subscribe to Pusher 'donation-stream' channel
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, {
      cluster,
    });

    const channel = pusher.subscribe("donation-stream");

    channel.bind("interactive-chat", (data: InteractiveChatMessage) => {
      if (!data || !data.id || !data.message) return;

      // Prevent processing same message ID repeatedly
      if (processedChatIdsRef.current.has(data.id)) {
        return;
      }
      processedChatIdsRef.current.add(data.id);

      // Keep cache set bounded
      if (processedChatIdsRef.current.size > 200) {
        const oldest = Array.from(processedChatIdsRef.current).slice(0, 50);
        oldest.forEach((id) => processedChatIdsRef.current.delete(id));
      }

      // Add to queue with overflow trimming for intense traffic
      setQueue((prev) => {
        const trimmed = prev.length >= MAX_QUEUE_SIZE ? prev.slice(prev.length - (MAX_QUEUE_SIZE - 1)) : prev;
        return [...trimmed, data];
      });
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  // Pick next chat when idle and queue has items
  useEffect(() => {
    if (currentChat === null && queue.length > 0 && !isTransitioning && !isExiting) {
      const [nextChat, ...remainingQueue] = queue;
      setCurrentChat(nextChat);
      setQueue(remainingQueue);
    }
  }, [currentChat, queue, isTransitioning, isExiting]);

  // Handle active chat display, TTS playback, and guaranteed auto-dismiss
  useEffect(() => {
    if (!currentChat) return;

    clearAllTimers();
    setIsExiting(false);

    const speechText = currentChat.message;

    // Baseline estimated duration based on text length (~115ms per character + 3500ms safety buffer)
    const estimatedDuration = Math.min(
      30000,
      Math.max(5000, Math.ceil(speechText.length * 115) + 3500)
    );
    setDisplayDuration(estimatedDuration);

    // Initial reset of progress bar to 100%
    if (progressBarRef.current) {
      progressBarRef.current.style.transition = "none";
      progressBarRef.current.style.width = "100%";
      void progressBarRef.current.offsetWidth; // Force synchronous reflow
      progressBarRef.current.style.transition = `width ${estimatedDuration}ms linear`;
      progressBarRef.current.style.width = "0%";
    }

    // 1. HARD WATCHDOG TIMER: Always guarantees the popup closes even under heavy load / OBS background freeze
    watchdogTimerRef.current = setTimeout(() => {
      console.log("Watchdog dismiss triggered for chat:", currentChat.id);
      dismissChat();
    }, estimatedDuration);

    // 2. Play TTS audio and dynamically adapt to the exact audio duration
    playTTS(
      speechText,
      // onEnded:
      () => {
        // Audio finished cleanly: smoothly glide remaining bar to 0% over 1.5s
        const postSpeechDelay = 1500;
        if (progressBarRef.current) {
          progressBarRef.current.style.transition = `width ${postSpeechDelay}ms linear`;
          progressBarRef.current.style.width = "0%";
        }
        dismissTimerRef.current = setTimeout(() => {
          dismissChat();
        }, postSpeechDelay);
      },
      // onDurationKnown:
      (audioMs) => {
        // Update countdown bar to match actual audio duration + 1.5s reading buffer
        const totalDuration = audioMs + 1500;
        setDisplayDuration(totalDuration);

        if (progressBarRef.current) {
          progressBarRef.current.style.transition = `width ${totalDuration}ms linear`;
          progressBarRef.current.style.width = "0%";
        }

        // Adjust watchdog so it generously covers full speech + 3s safety margin
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
        }
        watchdogTimerRef.current = setTimeout(() => {
          dismissChat();
        }, totalDuration + 2000);
      },
      currentChat.voice || "schoolgirl"
    );

    return () => {
      clearAllTimers();
      stopAudio();
    };
  }, [currentChat]);

  // Position alignment styling helper
  const getPositionClasses = () => {
    switch (position) {
      case "bottom-center":
        return "items-end justify-center pb-12";
      case "top-center":
        return "items-start justify-center pt-10";
      case "top-left":
        return "items-start justify-start p-8";
      case "bottom-left":
      default:
        return "items-end justify-start p-8 pb-12";
    }
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex select-none font-sans pointer-events-none ${getPositionClasses()}`}
    >
      {currentChat && (
        <div
          onClick={dismissChat}
          title="Klik untuk menutup"
          className={`transition-all duration-300 max-w-lg w-full pointer-events-auto cursor-pointer ${
            isExiting
              ? "opacity-0 translate-y-3 scale-95"
              : "opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-5"
          }`}
        >
          {/* Streamer Speech Card */}
          <div className="bg-black/85 backdrop-blur-md rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex flex-col gap-2.5 transition hover:border-yellow-300 relative overflow-hidden">
            {/* Header: Badge, Sender Name, & Audio Wave Animation */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {currentChat.badge && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-yellow-400 text-black font-black text-xs uppercase tracking-wider shrink-0 shadow-sm">
                    {currentChat.badge}
                  </span>
                )}
                <span className="saweria-text-yellow text-lg md:text-xl font-black truncate">
                  {currentChat.sender}
                </span>
              </div>

              {/* Equalizer animation when speaking */}
              {isSpeaking ? (
                <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 bg-yellow-400/20 rounded-md border border-yellow-400/40">
                  <span className="w-1 h-3.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                  <span className="w-1 h-5 bg-yellow-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-1 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  <span className="text-[11px] font-bold text-yellow-300 ml-1">TTS</span>
                </div>
              ) : (
                <span className="text-yellow-400/60 text-xs font-semibold shrink-0">
                  Klik untuk tutup
                </span>
              )}
            </div>

            {/* Message Body */}
            <div className="pt-0.5">
              <p className="saweria-text-white text-base md:text-lg font-black leading-snug drop-shadow-md break-words">
                &ldquo;{currentChat.message}&rdquo;
              </p>
            </div>

            {/* Visual Lifetime Countdown Bar (Always cleanly hits 0% width) */}
            <div className="w-full bg-yellow-400/20 h-1 rounded-full overflow-hidden mt-1">
              <div
                ref={progressBarRef}
                className="bg-yellow-400 h-full origin-left rounded-full"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Inline animation keyframes for progress bar shrink */}
      <style jsx>{`
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

export default function InteractiveChatOverlayPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center text-white/70 bg-transparent font-bold">
          Loading chat overlay...
        </div>
      }
    >
      <ChatOverlayContent />
    </Suspense>
  );
}
