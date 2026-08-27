"use client";

import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";

interface DonationAlert {
  orderId: string;
  amount: number;
  name: string;
  message: string;
  mediaUrl: string;
  createdAt: string;
}

export default function OverlayPage() {
  const [currentAlert, setCurrentAlert] = useState<DonationAlert | null>(null);
  const [queue, setQueue] = useState<DonationAlert[]>([]);
  const isPlayingRef = useRef(false);

  // Helper to extract YouTube embed URL
  const getYouTubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11
      ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&controls=0&modestbranding=1`
      : null;
  };

  // Helper to play Text-to-Speech
  const playTTS = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(
        (v) => v.lang.includes("id") || v.lang.includes("ID")
      );
      if (idVoice) utterance.voice = idVoice;

      window.speechSynthesis.speak(utterance);
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

    // Speak donor message with TTS
    const speechText = `${currentAlert.name} mendonasikan ${new Intl.NumberFormat("id-ID").format(currentAlert.amount)} Rupiah. ${currentAlert.message ? currentAlert.message : ""}`;
    playTTS(speechText);

    // Display alert duration (12s if media attached, otherwise 8s)
    const alertDuration = currentAlert.mediaUrl ? 12000 : 8000;

    const timer = setTimeout(() => {
      setCurrentAlert(null); // Triggers next item cleanly
    }, alertDuration);

    return () => clearTimeout(timer);
  }, [currentAlert]);

  const ytEmbedUrl = currentAlert
    ? getYouTubeEmbedUrl(currentAlert.mediaUrl)
    : null;

  // Debug function to manually trigger a test alert
  const triggerTestAlert = (withMedia: boolean = false) => {
    const testDonation: DonationAlert = {
      orderId: `TEST-${Date.now()}`,
      amount: withMedia ? 100000 : 50000,
      name: withMedia ? "Reza Gaming" : "Budi Santoso",
      message: withMedia
        ? "Semangat terus streamingnya bang! Lagu favorit nih!"
        : "Terima kasih banyak konten dan ilmunya bang!",
      mediaUrl: withMedia
        ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        : "",
      createdAt: new Date().toISOString(),
    };
    setQueue((prev) => [...prev, testDonation]);
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex flex-col items-center justify-center p-8 select-none font-sans pointer-events-none">
      {/* Debug Controls (Clickable in browser test) */}
      {/* <div className="fixed top-4 right-4 flex gap-2 pointer-events-auto z-50 opacity-40 hover:opacity-100 transition-opacity">
        <button
          onClick={() => triggerTestAlert(false)}
          className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg font-medium shadow-md text-sm backdrop-blur-md cursor-pointer transition-all active:scale-95"
        >
          🧪 Test Donasi
        </button>
        <button
          onClick={() => triggerTestAlert(true)}
          className="px-4 py-2 bg-pink-600/80 hover:bg-pink-600 text-white rounded-lg font-medium shadow-md text-sm backdrop-blur-md cursor-pointer transition-all active:scale-95"
        >
          🎬 Test MediaShare
        </button>
      </div> */}

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

            {/* Media Share Preview */}
            {ytEmbedUrl && (
              <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg border border-outline-variant mt-2 bg-black">
                <iframe
                  className="w-full h-full"
                  src={ytEmbedUrl}
                  title="Media Share"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
