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
  createdAt: string;
}

function ChatOverlayContent() {
  const searchParams = useSearchParams();
  const position = searchParams.get("pos") || "bottom-left"; // bottom-left | bottom-center | top-center | top-left

  const [currentChat, setCurrentChat] = useState<InteractiveChatMessage | null>(null);
  const [queue, setQueue] = useState<InteractiveChatMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedChatIdsRef = useRef<Set<string>>(new Set());

  // Helper to cleanly stop any ongoing speech/audio (does NOT clear the alert lifecycle timer)
  const stopAudio = () => {
    setIsSpeaking(false);
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
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

  // Initialize and unlock audio element on mount
  useEffect(() => {
    // Permanently cancel any lingering speech synthesis left in the browser
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
      stopAudio();
    };
  }, []);

  // Text-to-Speech playback helper
  const playTTS = (text: string, onEnded?: () => void) => {
    if (!text || typeof window === "undefined") {
      onEnded?.();
      return;
    }

    // Stop any ongoing audio before starting new playback
    stopAudio();
    setIsSpeaking(true);

    let endedCalled = false;
    const triggerEnd = () => {
      if (endedCalled) return;
      endedCalled = true;
      setIsSpeaking(false);
      onEnded?.();
    };

    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&t=${Date.now()}`;
      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      audio.onended = () => {
        triggerEnd();
      };

      audio.onerror = (e) => {
        console.warn("TTS audio failed to load:", e);
        triggerEnd();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name === "AbortError") {
            // Intentionally aborted; ignore
            return;
          }
          console.warn("Audio play blocked by browser policy:", err);
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
      console.log("Chat overlay received message:", data);
      if (!data || !data.id) return;

      if (processedChatIdsRef.current.has(data.id)) {
        return;
      }
      processedChatIdsRef.current.add(data.id);

      setQueue((prev) => [...prev, data]);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  // Pick next chat when queue has items and none currently showing
  useEffect(() => {
    if (currentChat === null && queue.length > 0) {
      const [nextChat, ...remainingQueue] = queue;
      setCurrentChat(nextChat);
      setQueue(remainingQueue);
    }
  }, [currentChat, queue]);

  // Handle active chat display, TTS playback, and auto-dismiss
  useEffect(() => {
    if (!currentChat) return;

    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }

    // Speak chat message directly without "Streamer mengatakan" prefix
    const speechText = currentChat.message;

    // Guaranteed fallback timer (proportional to message length, max 10s)
    // Ensures popup ALWAYS auto-closes even if audio is blocked or interrupted
    const fallbackTimeout = Math.min(10000, Math.max(4500, speechText.length * 120));
    dismissTimeoutRef.current = setTimeout(() => {
      setCurrentChat(null);
      setIsSpeaking(false);
    }, fallbackTimeout);

    // Speak and hold message on screen briefly after audio finishes
    playTTS(speechText, () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      // If there are more chats in queue, transition quicker (1s) so it doesn't backlog, otherwise 2.2s
      const delay = queue.length > 0 ? 1000 : 2200;
      dismissTimeoutRef.current = setTimeout(() => {
        setCurrentChat(null);
      }, delay);
    });

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
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
          onClick={() => setCurrentChat(null)}
          title="Klik untuk menutup"
          className="animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-lg w-full pointer-events-auto cursor-pointer"
        >
          {/* Streamer Speech Card */}
          <div className="bg-black/80 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-2 transition hover:border-yellow-300">
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
              {isSpeaking && (
                <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-yellow-400/20 rounded-md border border-yellow-400/40">
                  <span className="w-1 h-3.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                  <span className="w-1 h-5 bg-yellow-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-1 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  <span className="text-[11px] font-bold text-yellow-300 ml-1">TTS</span>
                </div>
              )}
            </div>

            {/* Message Body */}
            <div className="pt-1">
              <p className="saweria-text-white text-base md:text-lg font-black leading-snug drop-shadow-md break-words">
                &ldquo;{currentChat.message}&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}
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
