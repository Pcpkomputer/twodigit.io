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

  // Dedicated Audio Element ref & dismiss timer
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to cleanly stop any ongoing speech/audio
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  };

  // Initialize and unlock audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    // Safely unlock audio using a silent snippet (NEVER replay audioRef.current with previous sound!)
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

  const fallbackSpeech = (text: string, onEnded?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnded?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 1.0;
      utterance.onend = () => {
        onEnded?.();
      };
      utterance.onerror = () => {
        onEnded?.();
      };
      window.speechSynthesis.speak(utterance);
    } catch (synthErr) {
      console.error("SpeechSynthesis fallback failed:", synthErr);
      onEnded?.();
    }
  };

  const playTTS = (text: string, onEnded?: () => void) => {
    if (!text || typeof window === "undefined") return;

    // Immediately stop any ongoing audio to prevent overlapping speech
    stopAudio();

    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&t=${Date.now()}`;

      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;
      }

      audio.src = audioUrl;
      audio.volume = 1.0;

      // Hook onended callback so visual card stays until audio finishes!
      audio.onended = () => {
        onEnded?.();
      };

      audio.onerror = () => {
        console.warn("Audio element error, falling back to Web Speech API");
        fallbackSpeech(text, onEnded);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Audio element play failed, falling back to Web Speech API:", err);
          fallbackSpeech(text, onEnded);
        });
      }
    } catch (e) {
      console.error("TTS error:", e);
      fallbackSpeech(text, onEnded);
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

      setQueue((prev) => {
        // Prevent duplicate alerts in queue
        if (prev.some((item) => item.orderId === data.orderId)) {
          return prev;
        }
        return [...prev, data];
      });
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

    // Safety fallback timer (18s max) in case of any network timeout
    const safetyTimeout = currentAlert.mediaUrl ? 18000 : 15000;
    dismissTimeoutRef.current = setTimeout(() => {
      setCurrentAlert(null);
    }, safetyTimeout);

    // Play TTS and dismiss smoothly 2.5s after audio ends
    playTTS(speechText, () => {
      if (!currentAlert.mediaUrl) {
        if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = setTimeout(() => {
          setCurrentAlert(null);
        }, 2500);
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
      {currentAlert && (
        <div className="animate-in fade-in duration-300 max-w-2xl w-full flex flex-col items-center text-center overflow-visible">
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
