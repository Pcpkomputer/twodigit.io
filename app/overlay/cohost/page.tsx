"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";
import AiCohostWidget, { CohostEventPayload } from "../components/AiCohostWidget";

function CohostOverlayContent() {
  const searchParams = useSearchParams();
  const position = searchParams.get("pos") || "bottom-right";
  const isPreview = searchParams.get("preview") === "1";
  const scale = parseFloat(searchParams.get("scale") || "1");

  const [currentEvent, setCurrentEvent] = useState<CohostEventPayload | null>(null);
  const [queue, setQueue] = useState<CohostEventPayload[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isCardVisible, setIsCardVisible] = useState<boolean>(false);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeEventIdRef = useRef<string | null>(null);

  // Initialize Persistent Audio
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
    }

    const unlock = () => {
      try {
        const silent = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        silent.volume = 0.01;
        silent.play().catch(() => {});
      } catch {}
      setAudioUnlocked(true);
      window.removeEventListener("click", unlock);
    };

    window.addEventListener("click", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Demo Preview Mode
  useEffect(() => {
    if (isPreview && !currentEvent) {
      setCurrentEvent({
        id: "prev-cohost",
        prompt: "Di mana lokasi Skunk Ape?",
        reply: "Skunk Ape ada di rawa Gullet Marsh deket Cottonmouth Lake. Cari selebarannya malam hari terus kontak Kirk!",
        speechText: "Skunk Ape ada di rawa Gullet Marsh deket Cottonmouth Lake. Cari selebarannya malam hari terus kontak Kirk!",
        mood: "excited",
        voice: "schoolgirl",
        timestamp: new Date().toISOString(),
      });
      setIsCardVisible(true);
    }
  }, [isPreview]);

  // Subscribe Pusher
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";
    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, { cluster });
    const channel = pusher.subscribe("donation-stream");

    channel.bind("ai-cohost-event", (data: CohostEventPayload) => {
      if (!data || !data.id) return;
      setQueue((prev) => [...prev, data].slice(-10));
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  // Queue Consumer
  useEffect(() => {
    if (currentEvent === null && queue.length > 0) {
      const [nextItem, ...remaining] = queue;
      activeEventIdRef.current = nextItem.id;
      setCurrentEvent(nextItem);
      setIsCardVisible(false);
      setQueue(remaining);
    }
  }, [currentEvent, queue]);

  // Audio Playback & Auto Dismiss
  useEffect(() => {
    if (!currentEvent || currentEvent.id === "prev-cohost") return;

    const eventId = currentEvent.id;
    const speechText = currentEvent.speechText || currentEvent.reply || "";
    const voice = currentEvent.voice || "schoolgirl";

    const dismissCurrent = () => {
      setIsSpeaking(false);
      setIsCardVisible(false);
      setTimeout(() => {
        if (activeEventIdRef.current === eventId) {
          setCurrentEvent(null);
          activeEventIdRef.current = null;
        }
      }, 350);
    };

    if (speechText) {
      try {
        const audio = audioRef.current;
        if (audio) {
          audio.src = `/api/tts?text=${encodeURIComponent(speechText)}&voice=${encodeURIComponent(voice)}`;
          audio.volume = 1.0;

          audio.onloadedmetadata = () => {
            if (activeEventIdRef.current !== eventId) return;
            setIsCardVisible(true);
            setIsSpeaking(true);
            audio.play().catch(() => {
              setAudioUnlocked(false);
            });
          };

          audio.onended = () => {
            if (activeEventIdRef.current !== eventId) return;
            setIsSpeaking(false);
            // Hold cloud bubble for 1.8 seconds after speech finishes so viewer can read cleanly
            dismissTimerRef.current = setTimeout(dismissCurrent, 1800);
          };

          audio.onerror = () => {
            setIsSpeaking(false);
            setIsCardVisible(true);
            dismissTimerRef.current = setTimeout(dismissCurrent, 4000);
          };

          audio.play().catch(() => {});
        }
      } catch {
        setIsCardVisible(true);
        dismissTimerRef.current = setTimeout(dismissCurrent, 4000);
      }
    } else {
      setIsCardVisible(true);
      dismissTimerRef.current = setTimeout(dismissCurrent, 4000);
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [currentEvent]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent overflow-hidden select-none pointer-events-none">
      {!audioUnlocked && (
        <div
          onClick={() => {
            try {
              const silent = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
              silent.volume = 0.01;
              silent.play().catch(() => {});
            } catch {}
            setAudioUnlocked(true);
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/85 text-pink-300 text-xs font-bold px-4 py-2 rounded-full border border-pink-400 pointer-events-auto cursor-pointer animate-pulse z-50 shadow-lg flex items-center gap-1.5"
        >
          <span>🔊</span> Klik layar untuk mengaktifkan suara Co-Host
        </div>
      )}

      <AiCohostWidget
        currentEvent={currentEvent}
        isSpeaking={isSpeaking}
        isCardVisible={isCardVisible}
        position={position}
        scale={scale}
        onDismiss={() => {
          setIsSpeaking(false);
          setIsCardVisible(false);
          setCurrentEvent(null);
        }}
      />
    </div>
  );
}

export default function CohostOverlayPage() {
  return (
    <Suspense fallback={<div className="bg-transparent" />}>
      <CohostOverlayContent />
    </Suspense>
  );
}
