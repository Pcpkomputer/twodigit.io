"use client";

import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";

import { numberToIndonesianWords } from "@/lib/terbilang";

interface DonationAlert {
  orderId: string;
  amount: number;
  name: string;
  message: string;
  mediaUrl: string;
  createdAt: string;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Helper to extract clean YouTube Video ID
const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regExp =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
};

// Dedicated YouTube Player Component
function YouTubeMedia({ videoId }: { videoId: string }) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&loop=0&rel=0&modestbranding=1&enablejsapi=1`;

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg border border-outline-variant mt-2 bg-black flex items-center justify-center">
      <iframe
        className="w-full h-full border-0"
        src={embedUrl}
        title="Media Share Video"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export default function OverlayPage() {
  const [currentAlert, setCurrentAlert] = useState<DonationAlert | null>(null);
  const [queue, setQueue] = useState<DonationAlert[]>([]);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(true);

  // Dedicated Audio Element ref & dismiss timer
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedOrderIdsRef = useRef<Set<string>>(new Set());

  // Helper to cleanly stop any ongoing speech/audio (does NOT cancel the alert dismiss timer)
  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      } catch {}
      currentAudioRef.current = null;
    }
    // Aggressively flush Chrome background speech synthesis queue
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

    // Safely unlock audio using a silent snippet (NEVER replay previous audio!)
    const unlockAudio = () => {
      try {
        const silentAudio = new Audio(
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        );
        silentAudio.volume = 0.01;
        silentAudio.play().catch(() => {});
      } catch {}
      setAudioUnlocked(true);
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

  const playAlertAudio = (text: string, onEnded: () => void) => {
    if (!text || typeof window === "undefined") {
      onEnded();
      return;
    }

    // Stop any existing playback first
    stopAudio();

    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&t=${Date.now()}`;
      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      audio.onended = () => {
        onEnded();
      };

      audio.onerror = (e) => {
        console.warn("TTS audio failed to load:", e);
        onEnded();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name === "AbortError") {
            // Intentionally stopped/aborted; ignore
            return;
          }
          console.warn("Audio play blocked by browser policy:", err);
          setAudioUnlocked(false);
          // Still dismiss cleanly so queue does not freeze
          onEnded();
        });
      }
    } catch (e) {
      console.error("TTS playback error:", e);
      onEnded();
    }
  };

  // Listen to Pusher WebSocket channel
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) {
      console.warn("NEXT_PUBLIC_PUSHER_KEY is not defined.");
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster,
    });

    const channel = pusher.subscribe("donation-stream");

    channel.bind("new-donation", (data: DonationAlert) => {
      console.log("Overlay received donation:", data);
      if (!data || !data.orderId) return;

      // Deduplicate using session ref with bounded LRU (max 100 items)
      if (processedOrderIdsRef.current.has(data.orderId)) {
        console.warn("Ignored duplicate donation alert:", data.orderId);
        return;
      }
      processedOrderIdsRef.current.add(data.orderId);
      if (processedOrderIdsRef.current.size > 100) {
        const oldest = processedOrderIdsRef.current.values().next().value;
        if (oldest) processedOrderIdsRef.current.delete(oldest);
      }

      setQueue((prev) => [...prev, data]);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  // 1. Pick next donation when no alert is active
  useEffect(() => {
    if (currentAlert === null && queue.length > 0) {
      const [nextDonation, ...remainingQueue] = queue;
      setCurrentAlert(nextDonation);
      setQueue(remainingQueue);
    }
  }, [currentAlert, queue]);

  // 2. Play alert, trigger TTS, and synchronize dismissal with speech end
  useEffect(() => {
    if (!currentAlert) return;

    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }

    // Speak donor message with natural Indonesian TTS (terbilang for amount)
    const amountWords = numberToIndonesianWords(currentAlert.amount);
    const speechText = `${currentAlert.name} mendonasikan ${amountWords} rupiah. ${
      currentAlert.message ? currentAlert.message : ""
    }`;

    // Safety fallback timer (18s max for video, 15s for audio)
    const safetyTimeout = currentAlert.mediaUrl ? 18000 : 15000;
    dismissTimeoutRef.current = setTimeout(() => {
      setCurrentAlert(null);
    }, safetyTimeout);

    // Play TTS and dismiss smoothly 2s after audio ends
    playAlertAudio(speechText, () => {
      if (!currentAlert.mediaUrl) {
        if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = setTimeout(() => {
          setCurrentAlert(null);
        }, 2000);
      }
    });

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      stopAudio();
    };
  }, [currentAlert]);

  const videoId = currentAlert ? getYouTubeVideoId(currentAlert.mediaUrl) : null;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex flex-col items-center justify-center p-8 select-none font-sans pointer-events-none">
      {!audioUnlocked && (
        <div
          onClick={() => {
            const silent = new Audio(
              "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
            );
            silent.volume = 0.01;
            silent.play().catch(() => {});
            setAudioUnlocked(true);
          }}
          className="fixed top-4 bg-black/85 text-yellow-300 text-xs font-bold px-4 py-2 rounded-full border border-yellow-400 pointer-events-auto cursor-pointer animate-pulse z-50 shadow-lg flex items-center gap-1.5"
        >
          <span>🔊</span> Klik layar untuk mengaktifkan suara audio
        </div>
      )}

      {currentAlert && (
        <div
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
          className="animate-in fade-in duration-300 max-w-2xl w-full flex flex-col items-center text-center overflow-visible"
        >
          {/* Saweria Style Floating Alert: Clean vector stroke, no clipped box */}
          <div className="flex flex-col items-center justify-center gap-2 overflow-visible">
            {/* Donor Name */}
            <div>
              <span className="saweria-text-yellow text-4xl md:text-5xl uppercase font-black">
                {currentAlert.name}
              </span>
            </div>

            {/* Amount Banner */}
            <div className="flex items-center justify-center gap-2">
              <span className="saweria-text-white text-2xl md:text-3xl font-black">
                mendonasikan
              </span>
              <span className="saweria-text-yellow text-2xl md:text-3xl font-black">
                Rp {new Intl.NumberFormat("id-ID").format(currentAlert.amount)}
              </span>
            </div>

            {/* Message */}
            {currentAlert.message && (
              <div className="mt-3 px-6 py-2.5 rounded-2xl bg-black/45 border-2 border-black/80 max-w-xl">
                <p className="saweria-text-white text-xl md:text-2xl font-black italic">
                  &ldquo;{currentAlert.message}&rdquo;
                </p>
              </div>
            )}

            {/* Media Share YouTube Player */}
            {videoId && (
              <div className="w-full max-w-lg mt-3 rounded-2xl overflow-hidden border-4 border-black shadow-2xl">
                <YouTubeMedia videoId={videoId} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
