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
  // YouTube strict embed URL for iframe
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

  // Helper to play Text-to-Speech (Indonesian Female Voice)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playTTS = (text: string) => {
    if (!text || typeof window === "undefined") return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      const fallbackToWebSpeech = () => {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "id-ID";
          const voices = window.speechSynthesis.getVoices();
          const idFemaleVoice =
            voices.find(
              (v) =>
                v.lang.toLowerCase().includes("id") &&
                (v.name.toLowerCase().includes("female") ||
                  v.name.toLowerCase().includes("gadis") ||
                  v.name.toLowerCase().includes("wanita") ||
                  v.name.toLowerCase().includes("damayanti"))
            ) || voices.find((v) => v.lang.toLowerCase().includes("id"));

          if (idFemaleVoice) utterance.voice = idFemaleVoice;
          window.speechSynthesis.speak(utterance);
        }
      };

      audio.onerror = () => {
        console.warn("TTS audio failed to load, trying Web Speech fallback...");
        fallbackToWebSpeech();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Audio element play error:", err);
          fallbackToWebSpeech();
        });
      }
    } catch (e) {
      console.error("TTS error:", e);
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

  // 2. Play alert, trigger TTS, and schedule auto-dismiss
  useEffect(() => {
    if (!currentAlert) return;

    // Speak donor message with natural Indonesian TTS (terbilang for amount)
    const amountWords = numberToIndonesianWords(currentAlert.amount);
    const speechText = `${currentAlert.name} mendonasikan ${amountWords} rupiah. ${currentAlert.message ? currentAlert.message : ""}`;
    playTTS(speechText);

    // Display alert duration (15s if media attached, otherwise 8s)
    const alertDuration = currentAlert.mediaUrl ? 15000 : 8000;

    const timer = setTimeout(() => {
      setCurrentAlert(null); // Triggers next item cleanly
    }, alertDuration);

    return () => clearTimeout(timer);
  }, [currentAlert]);

  const videoId = currentAlert ? getYouTubeVideoId(currentAlert.mediaUrl) : null;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex flex-col items-center justify-center p-8 select-none font-sans pointer-events-none">
      {currentAlert && (
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-xl w-full flex flex-col items-center">
          {/* Main Card */}
          <div className="w-full bg-surface/95 backdrop-blur-xl border-2 border-primary rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center ring-4 ring-primary/20">
            {/* Header / Amount Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-primary-container text-white font-bold rounded-full shadow-lg text-lg mb-4 animate-bounce">
              <span className="material-symbols-outlined text-[24px]">
                favorite
              </span>
              <span>
                Rp.{" "}
                {new Intl.NumberFormat("id-ID").format(currentAlert.amount)}
              </span>
            </div>

            {/* Donor Name */}
            <h2 className="text-2xl font-extrabold text-on-surface mb-2">
              <span className="text-primary">{currentAlert.name}</span>
            </h2>

            {/* Message */}
            {currentAlert.message && (
              <p className="text-lg text-on-surface-variant font-medium bg-surface-container-low px-5 py-3 rounded-2xl w-full border border-outline-variant shadow-inner mb-4">
                &ldquo;{currentAlert.message}&rdquo;
              </p>
            )}

            {/* Media Share YouTube Player */}
            {videoId && <YouTubeMedia videoId={videoId} />}
          </div>
        </div>
      )}
    </div>
  );
}
