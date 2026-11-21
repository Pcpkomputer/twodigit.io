"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";

import { numberToIndonesianWords } from "@/lib/terbilang";
import { TikTokEventPayload } from "@/lib/tiktok-events";

// Interfaces
interface DonationAlert {
  orderId: string;
  amount: number;
  name: string;
  message: string;
  mediaUrl: string;
  createdAt: string;
}

interface SfxEvent {
  id: string;
  sfxId: string;
  name: string;
  command: string;
  emoji: string;
  url: string;
  sender: string;
  nickname: string;
  timestamp: string;
}

interface PollOption {
  index: number;
  label: string;
  votes: number;
  percentage: number;
}

interface PollState {
  id: string;
  title: string;
  options: PollOption[];
  totalVotes: number;
  status: "active" | "ended";
  createdAt: string;
  endedAt?: string;
  winner?: PollOption | null;
}

// YouTube Video ID helper
const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regExp =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
};

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

// Option colors for Poll
const OPTION_COLORS = [
  {
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/50",
    bar: "bg-gradient-to-r from-cyan-500 to-blue-500",
  },
  {
    badge: "bg-amber-500/20 text-amber-300 border-amber-400/50",
    bar: "bg-gradient-to-r from-amber-400 to-orange-500",
  },
  {
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50",
    bar: "bg-gradient-to-r from-emerald-400 to-green-500",
  },
  {
    badge: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/50",
    bar: "bg-gradient-to-r from-fuchsia-500 to-purple-500",
  },
  {
    badge: "bg-rose-500/20 text-rose-300 border-rose-400/50",
    bar: "bg-gradient-to-r from-rose-500 to-red-500",
  },
];

function BundleOverlayContent() {
  const searchParams = useSearchParams();

  // Positioning per module (customizable via URL query params)
  const alertPos = searchParams.get("alertPos") || "center"; // center | top-center | bottom-center | top-left | top-right
  const eventsPos = searchParams.get("eventsPos") || "bottom-left"; // bottom-left | bottom-right | bottom-center | top-left | top-right
  const sfxPos = searchParams.get("sfxPos") || "bottom-right"; // bottom-right | bottom-left | top-right | top-left
  const pollPos = searchParams.get("pollPos") || "top-left"; // top-left | top-right | bottom-left | bottom-right

  // Modules enable/disable filter (default: all enabled)
  const modulesParam = searchParams.get("modules") || "alert,events,sfx,poll";
  const enabledModules = new Set(modulesParam.split(",").map((m) => m.trim().toLowerCase()));

  const isPreview = searchParams.get("preview") === "1";

  // State: Donation Alert
  const [currentAlert, setCurrentAlert] = useState<DonationAlert | null>(null);
  const [alertQueue, setAlertQueue] = useState<DonationAlert[]>([]);

  // State: TikTok Events (TTS Sapaan & Chat)
  const [currentEvent, setCurrentEvent] = useState<TikTokEventPayload | null>(null);
  const [eventQueue, setEventQueue] = useState<TikTokEventPayload[]>([]);

  // State: SFX
  const [currentSfx, setCurrentSfx] = useState<SfxEvent | null>(null);

  // State: Live Poll
  const [poll, setPoll] = useState<PollState | null>(null);

  // Audio & Hardware Lock State
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(true);

  // Zero-Leak Persistent Audio Players (Reused across alerts, never allocated repeatedly)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);

  // Dismiss timers
  const alertDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sfxDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Bounded LRU Deduplication Sets (Max 100 items to guarantee zero memory growth)
  const processedOrderIdsRef = useRef<Set<string>>(new Set());
  const processedSfxIdsRef = useRef<Set<string>>(new Set());
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const addBoundedId = (setRef: React.MutableRefObject<Set<string>>, id: string) => {
    if (setRef.current.has(id)) return true;
    setRef.current.add(id);
    if (setRef.current.size > 100) {
      const oldest = setRef.current.values().next().value;
      if (oldest) setRef.current.delete(oldest);
    }
    return false;
  };

  // Helper: Stop TTS Audio cleanly
  const stopTTSAudio = () => {
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.removeAttribute("src");
        ttsAudioRef.current.load();
        ttsAudioRef.current.onended = null;
        ttsAudioRef.current.onerror = null;
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  };

  // Helper: Stop SFX Audio cleanly
  const stopSfxAudio = () => {
    if (sfxAudioRef.current) {
      try {
        sfxAudioRef.current.pause();
        sfxAudioRef.current.removeAttribute("src");
        sfxAudioRef.current.load();
        sfxAudioRef.current.onended = null;
        sfxAudioRef.current.onerror = null;
      } catch {}
    }
  };

  // Unlock Audio on Mount
  useEffect(() => {
    // Instantiate the single persistent audio elements
    const ttsAudio = new Audio();
    ttsAudio.crossOrigin = "anonymous";
    ttsAudioRef.current = ttsAudio;

    const sfxAudio = new Audio();
    sfxAudio.crossOrigin = "anonymous";
    sfxAudioRef.current = sfxAudio;

    const unlock = () => {
      try {
        const silentAudio = new Audio(
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        );
        silentAudio.volume = 0.01;
        silentAudio.play().catch(() => {});
      } catch {}
      setAudioUnlocked(true);
      window.removeEventListener("click", unlock);
    };

    window.addEventListener("click", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      stopTTSAudio();
      stopSfxAudio();
    };
  }, []);

  // Demo Preview Mode
  useEffect(() => {
    if (isPreview) {
      if (enabledModules.has("alert") && !currentAlert) {
        setCurrentAlert({
          orderId: "prev-alert",
          amount: 50000,
          name: "Sultan Dermawan",
          message: "Semangat live streamingnya bro! Semoga lancar!",
          mediaUrl: "",
          createdAt: new Date().toISOString(),
        });
      }

      if (enabledModules.has("events") && !currentEvent) {
        setCurrentEvent({
          id: "prev-event",
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

      if (enabledModules.has("sfx") && !currentSfx) {
        setCurrentSfx({
          id: "prev-sfx",
          sfxId: "wasted",
          name: "GTA Wasted",
          command: "!wasted",
          emoji: "💀",
          url: "/sfx/wasted.mp3",
          sender: "gamer_pro",
          nickname: "Gamer Pro",
          timestamp: new Date().toISOString(),
        });
      }

      if (enabledModules.has("poll") && !poll) {
        setPoll({
          id: "prev-poll",
          title: "Hero Apa di Game Berikutnya?",
          options: [
            { index: 1, label: "Layla", votes: 45, percentage: 60 },
            { index: 2, label: "Miya", votes: 30, percentage: 40 },
          ],
          totalVotes: 75,
          status: "active",
          createdAt: new Date().toISOString(),
        });
      }
    }
  }, [isPreview]);

  // Fetch initial active poll once on mount (no recurring setInterval!)
  useEffect(() => {
    if (!enabledModules.has("poll")) return;

    fetch("/api/poll/active")
      .then((res) => res.json())
      .then((data) => {
        if (data.active && data.poll) {
          setPoll(data.poll);
        }
      })
      .catch(() => {});
  }, []);

  // SINGLE UNIFIED PUSHER SUBSCRIPTION (Replaces 4-5 independent WebSockets)
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, { cluster });
    const channel = pusher.subscribe("donation-stream");

    // 1. Donation Alert
    if (enabledModules.has("alert")) {
      channel.bind("new-donation", (data: DonationAlert) => {
        if (!data || !data.orderId) return;
        const isDuplicate = addBoundedId(processedOrderIdsRef, data.orderId);
        if (isDuplicate) return;

        setAlertQueue((prev) => {
          const next = [...prev, data];
          return next.slice(-6); // Bound queue to prevent memory leak
        });
      });
    }

    // 2. TikTok Live Events (Join, Chat, Gift, Follow, Share)
    if (enabledModules.has("events")) {
      channel.bind("tiktok-live-event", (data: TikTokEventPayload) => {
        if (!data || !data.id) return;
        const isDuplicate = addBoundedId(processedEventIdsRef, data.id);
        if (isDuplicate) return;

        setEventQueue((prev) => {
          const updated = [...prev, data];
          if (updated.length > 6) {
            const gifts = updated.filter((x) => x.priority === 1);
            const others = updated.filter((x) => x.priority > 1).slice(-4);
            return [...gifts, ...others];
          }
          return updated.sort((a, b) => {
            if (a.priority === 1 && b.priority !== 1) return -1;
            if (b.priority === 1 && a.priority !== 1) return 1;
            return 0;
          });
        });
      });
    }

    // 3. SFX Trigger
    if (enabledModules.has("sfx")) {
      channel.bind("sfx-trigger", (data: SfxEvent) => {
        if (!data || !data.id) return;
        const isDuplicate = addBoundedId(processedSfxIdsRef, data.id);
        if (isDuplicate) return;

        // Clear previous sfx dismiss timer
        if (sfxDismissTimerRef.current) clearTimeout(sfxDismissTimerRef.current);
        stopSfxAudio();

        setCurrentSfx(data);

        // Play audio cleanly via persistent sfxAudioRef
        try {
          const sfxAudio = sfxAudioRef.current;
          if (sfxAudio) {
            sfxAudio.src = data.url;
            sfxAudio.volume = 1.0;
            sfxAudio.play().catch(() => {});
          }
        } catch {}

        sfxDismissTimerRef.current = setTimeout(() => {
          setCurrentSfx(null);
          stopSfxAudio();
        }, 4500);
      });
    }

    // 4. Live Poll Updates
    if (enabledModules.has("poll")) {
      channel.bind("poll-update", (data: any) => {
        if (!data || data.action === "reset" || !Array.isArray(data.options)) {
          setPoll(null);
        } else {
          setPoll(data);
        }
      });

      channel.bind("poll-ended", (data: any) => {
        if (data && Array.isArray(data.options)) {
          setPoll(data);
        }
      });

      channel.bind("poll-reset", () => {
        setPoll(null);
      });
    }

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  // Donation Alert Queue Processor
  useEffect(() => {
    if (currentAlert === null && alertQueue.length > 0) {
      const [nextAlert, ...remaining] = alertQueue;
      setCurrentAlert(nextAlert);
      setAlertQueue(remaining);
    }
  }, [currentAlert, alertQueue]);

  // Donation Alert TTS Player & Dismiss
  useEffect(() => {
    if (!currentAlert || isPreview) return;

    if (alertDismissTimerRef.current) {
      clearTimeout(alertDismissTimerRef.current);
    }

    const amountWords = numberToIndonesianWords(currentAlert.amount);
    const speechText = `${currentAlert.name} mendonasikan ${amountWords} rupiah. ${
      currentAlert.message ? currentAlert.message : ""
    }`;

    const safetyTimeout = currentAlert.mediaUrl ? 18000 : 15000;
    alertDismissTimerRef.current = setTimeout(() => {
      setCurrentAlert(null);
      stopTTSAudio();
    }, safetyTimeout);

    // Play TTS via persistent audio element
    if (speechText) {
      try {
        const audio = ttsAudioRef.current;
        if (audio) {
          audio.src = `/api/tts?text=${encodeURIComponent(speechText)}&t=${Date.now()}`;
          audio.volume = 1.0;
          audio.onended = () => {
            if (!currentAlert.mediaUrl) {
              if (alertDismissTimerRef.current) clearTimeout(alertDismissTimerRef.current);
              alertDismissTimerRef.current = setTimeout(() => {
                setCurrentAlert(null);
                stopTTSAudio();
              }, 2000);
            }
          };
          audio.play().catch(() => {});
        }
      } catch {}
    }

    return () => {
      if (alertDismissTimerRef.current) clearTimeout(alertDismissTimerRef.current);
    };
  }, [currentAlert]);

  // TikTok Live Events Queue Processor
  useEffect(() => {
    if (currentEvent === null && eventQueue.length > 0) {
      const [nextEvent, ...remaining] = eventQueue;
      setCurrentEvent(nextEvent);
      setEventQueue(remaining);
    }
  }, [currentEvent, eventQueue]);

  // TikTok Live Events TTS Player & Dismiss
  useEffect(() => {
    if (!currentEvent || isPreview) return;

    if (eventDismissTimerRef.current) {
      clearTimeout(eventDismissTimerRef.current);
    }

    eventDismissTimerRef.current = setTimeout(() => {
      setCurrentEvent(null);
    }, 12000);

    if (currentEvent.speechText) {
      try {
        const audio = ttsAudioRef.current;
        if (audio) {
          audio.src = `/api/tts?text=${encodeURIComponent(currentEvent.speechText)}&t=${Date.now()}`;
          audio.volume = 1.0;
          audio.onended = () => {
            if (eventDismissTimerRef.current) clearTimeout(eventDismissTimerRef.current);
            eventDismissTimerRef.current = setTimeout(() => {
              setCurrentEvent(null);
            }, 1500);
          };
          audio.play().catch(() => {});
        }
      } catch {}
    }

    return () => {
      if (eventDismissTimerRef.current) clearTimeout(eventDismissTimerRef.current);
    };
  }, [currentEvent]);

  // Dynamic Position Class Builders
  const getContainerClasses = (pos: string) => {
    switch (pos) {
      case "top-left":
        return "items-start justify-start p-8";
      case "top-right":
        return "items-start justify-end p-8";
      case "top-center":
        return "items-start justify-center pt-8";
      case "bottom-right":
        return "items-end justify-end p-8 pb-12";
      case "bottom-center":
        return "items-end justify-center pb-12";
      case "bottom-left":
      default:
        return "items-end justify-start p-8 pb-12";
      case "center":
        return "items-center justify-center p-8";
    }
  };

  const getBadgeStyle = (eventType: string) => {
    switch (eventType) {
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

  const videoId = currentAlert ? getYouTubeVideoId(currentAlert.mediaUrl) : null;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent overflow-hidden select-none font-sans pointer-events-none">
      {/* Audio Unlock Notification if browser policy blocks autoplay */}
      {!audioUnlocked && (
        <div
          onClick={() => setAudioUnlocked(true)}
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/85 text-yellow-300 text-xs font-bold px-4 py-2 rounded-full border border-yellow-400 pointer-events-auto cursor-pointer animate-pulse z-50 shadow-lg flex items-center gap-1.5"
        >
          <span>🔊</span> Klik layar untuk mengaktifkan audio stream
        </div>
      )}

      {/* 1. DONATION ALERT WIDGET */}
      {enabledModules.has("alert") && currentAlert && (
        <div
          className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
            alertPos
          )}`}
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
        >
          <div className="max-w-2xl w-full flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center justify-center gap-2 overflow-visible">
              <div>
                <span className="saweria-text-yellow text-4xl md:text-5xl uppercase font-black">
                  {currentAlert.name}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="saweria-text-white text-2xl md:text-3xl font-black">
                  mendonasikan
                </span>
                <span className="saweria-text-yellow text-2xl md:text-3xl font-black">
                  Rp {new Intl.NumberFormat("id-ID").format(currentAlert.amount)}
                </span>
              </div>
              {currentAlert.message && (
                <div className="mt-3 px-6 py-2.5 rounded-2xl bg-black/45 border-2 border-black/80 max-w-xl">
                  <p className="saweria-text-white text-xl md:text-2xl font-black italic">
                    &ldquo;{currentAlert.message}&rdquo;
                  </p>
                </div>
              )}
              {videoId && (
                <div className="w-full max-w-lg mt-3 rounded-2xl overflow-hidden border-4 border-black shadow-2xl">
                  <YouTubeMedia videoId={videoId} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. TIKTOK LIVE EVENTS TTS WIDGET (Join, Chat, Gift, Follow, Share) */}
      {enabledModules.has("events") && currentEvent && (
        <div
          className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
            eventsPos
          )}`}
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
        >
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300 flex flex-col gap-2">
            <div className="bg-black/85 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">{currentEvent.badgeEmoji}</span>
                  <span className="saweria-text-yellow text-xl md:text-2xl uppercase font-black truncate">
                    {currentEvent.nickname}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-lg border text-xs tracking-wider uppercase shrink-0 shadow-sm ${getBadgeStyle(
                    currentEvent.eventType
                  )}`}
                >
                  {currentEvent.eventType}
                </span>
              </div>
              <div className="pt-0.5">
                <p className="saweria-text-white text-base md:text-lg font-black leading-snug break-words">
                  {currentEvent.displayText}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MEME SFX WIDGET */}
      {enabledModules.has("sfx") && currentSfx && (
        <div
          className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
            sfxPos
          )}`}
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
        >
          <div className="w-full max-w-sm animate-in fade-in zoom-in-90 duration-200">
            <div className="bg-black/85 rounded-2xl p-4 border-2 border-amber-400 shadow-2xl flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-3xl shrink-0">
                {currentSfx.emoji}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="saweria-text-yellow text-base font-black truncate">
                    {currentSfx.name}
                  </span>
                  <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.2 rounded font-black shrink-0">
                    {currentSfx.command}
                  </span>
                </div>
                <span className="text-xs text-gray-300 font-semibold truncate mt-0.5">
                  Dipicu oleh: <span className="saweria-text-white font-bold">{currentSfx.nickname}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LIVE VOTING POLL WIDGET */}
      {enabledModules.has("poll") &&
        poll &&
        Array.isArray(poll.options) &&
        poll.options.length > 0 && (
          <div
            className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
              pollPos
            )}`}
            style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
          >
            <div className="w-full max-w-sm animate-in fade-in duration-300">
              <div className="bg-black/85 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black inline-block mb-1">
                      {poll.status === "active" ? "📊 Live Voting" : "🏆 Hasil Voting"}
                    </span>
                    <h3 className="saweria-text-white text-base md:text-lg font-black leading-tight">
                      {poll.title}
                    </h3>
                  </div>
                  <span className="saweria-text-yellow text-xs font-black shrink-0">
                    {poll.totalVotes} Vote
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {poll.options.map((opt, idx) => {
                    const color = OPTION_COLORS[idx % OPTION_COLORS.length];
                    const isWinner = poll.status === "ended" && poll.winner?.index === opt.index;

                    return (
                      <div
                        key={opt.index}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isWinner
                            ? "bg-yellow-400/20 border-yellow-400"
                            : "bg-white/5 border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-1.5 font-black text-white">
                            <span className="px-1.5 py-0.2 rounded bg-yellow-400 text-black text-[11px] font-black">
                              !{opt.index}
                            </span>
                            <span className="saweria-text-white truncate max-w-[170px]">
                              {isWinner && "👑 "}
                              {opt.label}
                            </span>
                          </div>
                          <span className="saweria-text-yellow font-black">
                            {opt.percentage}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                            style={{ width: `${opt.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 font-medium">Ketik di komentar live:</span>
                  <span className="saweria-text-yellow font-black">
                    {poll.options.map((o) => `!${o.index}`).join(" / ")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default function BundleOverlayPage() {
  return (
    <Suspense fallback={null}>
      <BundleOverlayContent />
    </Suspense>
  );
}
