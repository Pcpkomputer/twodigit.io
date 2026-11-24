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

interface InteractiveChatMessage {
  id: string;
  sender: string;
  message: string;
  badge?: string;
  theme?: string;
  voice?: string;
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

// YouTube Video ID helper (Matching app/overlay/page.tsx)
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
    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border-4 border-black mt-2 bg-black flex items-center justify-center">
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

// Option colors for Poll (Matching app/overlay/poll/page.tsx)
const OPTION_COLORS = [
  {
    badge: "bg-blue-500 text-white border-blue-400",
    bar: "bg-gradient-to-r from-blue-500 to-indigo-600",
  },
  {
    badge: "bg-red-500 text-white border-red-400",
    bar: "bg-gradient-to-r from-red-500 to-rose-600",
  },
  {
    badge: "bg-amber-500 text-black border-amber-300",
    bar: "bg-gradient-to-r from-amber-400 to-yellow-500",
  },
  {
    badge: "bg-emerald-500 text-white border-emerald-400",
    bar: "bg-gradient-to-r from-emerald-500 to-teal-600",
  },
];

function BundleOverlayContent() {
  const searchParams = useSearchParams();

  // Scale factor: defaults to 0.75 (optimal for 1280x720 canvas, or 1.0 for 1080p)
  const rawScale = searchParams.get("scale");
  const scale = rawScale ? Math.max(0.4, Math.min(1.5, parseFloat(rawScale) || 0.75)) : 0.75;

  // Positioning per module (customizable via URL query params)
  const alertPos = searchParams.get("alertPos") || "center"; // center | top-center | bottom-center | top-left | top-right
  const eventsPos = searchParams.get("eventsPos") || "bottom-left"; // bottom-left | bottom-right | bottom-center | top-left | top-right
  const chatPos = searchParams.get("chatPos") || "bottom-left";
  const sfxPos = searchParams.get("sfxPos") || "bottom-right"; // bottom-right | bottom-left | top-right | top-left | center
  const pollPos = searchParams.get("pollPos") || "top-left"; // top-left | top-right | bottom-left | bottom-right

  // Modules enable/disable filter (default: all enabled)
  const modulesParam = searchParams.get("modules") || "alert,events,chat,sfx,poll";
  const enabledModules = new Set(modulesParam.split(",").map((m) => m.trim().toLowerCase()));

  const isPreview = searchParams.get("preview") === "1";

  // State: Donation Alert
  const [currentAlert, setCurrentAlert] = useState<DonationAlert | null>(null);
  const [alertQueue, setAlertQueue] = useState<DonationAlert[]>([]);

  // State: TikTok Events (TTS Sapaan & Live Chat)
  const [currentEvent, setCurrentEvent] = useState<TikTokEventPayload | null>(null);
  const [eventQueue, setEventQueue] = useState<TikTokEventPayload[]>([]);
  // STRICT ID GUARD: exitingEventId tracks the exact ID of the event exiting, preventing cross-event opacity leaks
  const [exitingEventId, setExitingEventId] = useState<string | null>(null);
  const [isEventSpeaking, setIsEventSpeaking] = useState<boolean>(false);
  const [eventDisplayDuration, setEventDisplayDuration] = useState<number>(4500);
  const [isEventCardVisible, setIsEventCardVisible] = useState<boolean>(false);

  // State: Host Interactive Chat & Announcement
  const [currentChat, setCurrentChat] = useState<InteractiveChatMessage | null>(null);
  const [chatQueue, setChatQueue] = useState<InteractiveChatMessage[]>([]);
  const [isChatSpeaking, setIsChatSpeaking] = useState<boolean>(false);
  const [isChatExiting, setIsChatExiting] = useState<boolean>(false);

  // State: SFX
  const [currentSfx, setCurrentSfx] = useState<SfxEvent | null>(null);

  // State: Live Poll
  const [poll, setPoll] = useState<PollState | null>(null);

  // Audio & Hardware Lock State
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(true);

  // Persistent Isolated Audio Players: 1 per module to guarantee zero audio collisions
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const eventAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronized countdown bar duration for host chat
  const [chatDisplayDuration, setChatDisplayDuration] = useState<number>(6000);

  // Dismiss timers
  const alertDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventWatchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventExitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventCardRevealTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sfxDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active item tracking refs to prevent async dismiss race conditions
  const activeEventIdRef = useRef<string | null>(null);
  const isDismissingEventRef = useRef<boolean>(false);
  const eventVisibleSinceRef = useRef<number>(0);
  const eventPlayBlockedRef = useRef<boolean>(false);
  const activeChatIdRef = useRef<string | null>(null);

  // Bounded LRU Deduplication Sets (Max 100 items to guarantee zero memory growth)
  const processedOrderIdsRef = useRef<Set<string>>(new Set());
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const processedChatIdsRef = useRef<Set<string>>(new Set());
  const processedSfxIdsRef = useRef<Set<string>>(new Set());

  const addBoundedId = (setRef: React.MutableRefObject<Set<string>>, id: string) => {
    if (setRef.current.has(id)) return true;
    setRef.current.add(id);
    if (setRef.current.size > 100) {
      const oldest = setRef.current.values().next().value;
      if (oldest) setRef.current.delete(oldest);
    }
    return false;
  };

  // Helper: Clear active event lifecycle timers (dismiss & watchdog, NOT exit timer)
  const clearEventTimers = () => {
    if (eventDismissTimerRef.current) {
      clearTimeout(eventDismissTimerRef.current);
      eventDismissTimerRef.current = null;
    }
    if (eventWatchdogTimerRef.current) {
      clearTimeout(eventWatchdogTimerRef.current);
      eventWatchdogTimerRef.current = null;
    }
    if (eventCardRevealTimeoutRef.current) {
      clearTimeout(eventCardRevealTimeoutRef.current);
      eventCardRevealTimeoutRef.current = null;
    }
  };

  // Helper: Stop Alert Audio cleanly
  const stopAlertAudio = () => {
    if (alertAudioRef.current) {
      alertAudioRef.current.onended = null;
      alertAudioRef.current.onerror = null;
      try {
        alertAudioRef.current.pause();
        alertAudioRef.current.currentTime = 0;
      } catch {}
    }
  };

  // Helper: Stop Event Audio cleanly (null listeners FIRST, no empty load() error trigger)
  const stopEventAudio = () => {
    setIsEventSpeaking(false);
    if (eventAudioRef.current) {
      eventAudioRef.current.onended = null;
      eventAudioRef.current.onerror = null;
      eventAudioRef.current.onstalled = null;
      eventAudioRef.current.onloadedmetadata = null;
      eventAudioRef.current.onplay = null;
      eventAudioRef.current.onpause = null;
      try {
        eventAudioRef.current.pause();
        eventAudioRef.current.currentTime = 0;
      } catch {}
    }
  };

  // Helper: Strict ID-Guarded dismiss routine for TikTok Live Events
  const dismissActiveEvent = (targetEventId: string) => {
    if (!targetEventId || activeEventIdRef.current !== targetEventId) {
      return;
    }

    clearEventTimers();
    stopEventAudio();
    setExitingEventId(targetEventId);

    if (eventExitTimerRef.current) {
      clearTimeout(eventExitTimerRef.current);
    }
    eventExitTimerRef.current = setTimeout(() => {
      eventExitTimerRef.current = null;
      if (activeEventIdRef.current === targetEventId) {
        activeEventIdRef.current = null;
        setExitingEventId(null);
        setCurrentEvent(null);
      }
    }, 280);
  };

  // If the user switches from /test-overlay tab to this overlay tab while an event is active,
  // reset the visible timestamp & ensure the popup stays visible for at least 3.2s after tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && activeEventIdRef.current && !isDismissingEventRef.current) {
        eventVisibleSinceRef.current = Date.now();
        const activeId = activeEventIdRef.current;
        if (eventDismissTimerRef.current) {
          clearTimeout(eventDismissTimerRef.current);
          eventDismissTimerRef.current = setTimeout(() => {
            dismissActiveEvent(activeId);
          }, 3200);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Helper: Stop Chat Audio cleanly
  const stopChatAudio = () => {
    if (chatAudioRef.current) {
      chatAudioRef.current.onended = null;
      chatAudioRef.current.onerror = null;
      chatAudioRef.current.onstalled = null;
      chatAudioRef.current.onloadedmetadata = null;
      try {
        chatAudioRef.current.pause();
        chatAudioRef.current.currentTime = 0;
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
      sfxAudioRef.current.onended = null;
      sfxAudioRef.current.onerror = null;
      try {
        sfxAudioRef.current.pause();
        sfxAudioRef.current.currentTime = 0;
      } catch {}
    }
  };

  // Safe dismiss routine for Host Chat: plays 300ms smooth exit fadeout
  const dismissChat = () => {
    if (chatDismissTimerRef.current) {
      clearTimeout(chatDismissTimerRef.current);
      chatDismissTimerRef.current = null;
    }
    setIsChatSpeaking(false);
    stopChatAudio();
    setIsChatExiting(true);
    const targetChatId = activeChatIdRef.current;

    setTimeout(() => {
      // Only clear if this exact chat is still the active one
      if (!targetChatId || activeChatIdRef.current === targetChatId) {
        setCurrentChat(null);
        setIsChatExiting(false);
        activeChatIdRef.current = null;
      }
    }, 300);
  };

  // Unlock Audio on Mount (exactly 4 persistent Audio instances for the entire lifecycle)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const alertAudio = new Audio();
      alertAudio.crossOrigin = "anonymous";
      alertAudioRef.current = alertAudio;

      const eventAudio = new Audio();
      eventAudio.crossOrigin = "anonymous";
      eventAudioRef.current = eventAudio;

      const chatAudio = new Audio();
      chatAudio.crossOrigin = "anonymous";
      chatAudioRef.current = chatAudio;

      const sfxAudio = new Audio();
      sfxAudio.crossOrigin = "anonymous";
      sfxAudioRef.current = sfxAudio;
    }

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
      clearEventTimers();
      if (eventExitTimerRef.current) {
        clearTimeout(eventExitTimerRef.current);
        eventExitTimerRef.current = null;
      }
      stopAlertAudio();
      stopEventAudio();
      stopChatAudio();
      stopSfxAudio();
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = "";
        preloadAudioRef.current = null;
      }
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
          message: "Semangat live streamingnya bro! Sukses selalu!",
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
        activeEventIdRef.current = "prev-event";
        setIsEventCardVisible(true);
        setEventDisplayDuration(6000);
      }

      if (enabledModules.has("chat") && !currentChat) {
        setCurrentChat({
          id: "prev-chat",
          sender: "Streamer Host",
          badge: "🎙️ Host",
          message: "Halo semua penonton! Jangan lupa follow dan tap-tap layarnya ya!",
          createdAt: new Date().toISOString(),
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

  // Fetch initial active poll once on mount (no recurring polling loop)
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
          return next.slice(-6);
        });
      });
    }

    // 2. TikTok Live Events (Join, Chat, Gift, Follow, Share)
    if (enabledModules.has("events")) {
      channel.bind("tiktok-live-event", (data: TikTokEventPayload) => {
        if (!data || !data.id) return;
        const isDuplicate = addBoundedId(processedEventIdsRef, data.id);
        if (isDuplicate) return;

        // If static preview card is currently displayed, clear it so real simulation events can play
        setCurrentEvent((curr) => {
          if (curr && curr.id === "prev-event") {
            activeEventIdRef.current = null;
            setExitingEventId(null);
            return null;
          }
          return curr;
        });
        setCurrentChat((curr) => (curr && curr.id === "prev-chat" ? null : curr));

        setEventQueue((prev) => {
          // SMART ANTI-COLLISION:
          // If a viewer sends a 'chat' or 'gift', remove any pending 'join' greeting for that same viewer!
          let filtered = prev;
          if (data.eventType === "chat" || data.eventType === "gift") {
            filtered = prev.filter(
              (item) => !(item.eventType === "join" && item.uniqueId === data.uniqueId)
            );
          }
          let updated = [...filtered, data];
          if (updated.length > 20) {
            const gifts = updated.filter((x) => x.priority === 1);
            const others = updated.filter((x) => x.priority > 1).slice(-15);
            updated = [...gifts, ...others];
          }
          return updated.sort((a, b) => (a.priority || 4) - (b.priority || 4));
        });
      });
    }

    // 3. Interactive Host Chat
    if (enabledModules.has("chat")) {
      channel.bind("interactive-chat", (data: InteractiveChatMessage) => {
        if (!data || !data.id || !data.message) return;
        const isDuplicate = addBoundedId(processedChatIdsRef, data.id);
        if (isDuplicate) return;

        // Instantly silence & quick-finish any active greeting so Host Chat has 100% stage priority
        clearEventTimers();
        if (eventExitTimerRef.current) {
          clearTimeout(eventExitTimerRef.current);
          eventExitTimerRef.current = null;
        }
        stopEventAudio();
        activeEventIdRef.current = null;
        setExitingEventId(null);
        setCurrentEvent(null);

        setChatQueue((prev) => {
          const next = [...prev, data];
          return next.slice(-6);
        });
      });
    }

    // 4. Meme SFX Soundboard
    if (enabledModules.has("sfx")) {
      channel.bind("sfx-trigger", (data: SfxEvent) => {
        if (!data || !data.id || !data.url) return;
        const isDuplicate = addBoundedId(processedSfxIdsRef, data.id);
        if (isDuplicate) return;

        if (sfxDismissTimerRef.current) {
          clearTimeout(sfxDismissTimerRef.current);
        }

        setCurrentSfx(data);

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

    // 5. Live Poll Updates
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
      stopAlertAudio();
    }, safetyTimeout);

    // Play TTS via persistent audio element
    if (speechText) {
      try {
        const audio = alertAudioRef.current;
        if (audio) {
          audio.src = `/api/tts?text=${encodeURIComponent(speechText)}`;
          audio.volume = 1.0;
          audio.onended = () => {
            if (!currentAlert.mediaUrl) {
              if (alertDismissTimerRef.current) clearTimeout(alertDismissTimerRef.current);
              alertDismissTimerRef.current = setTimeout(() => {
                setCurrentAlert(null);
                stopAlertAudio();
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

  // Preload audio for next TikTok Live Event in queue (Single reusable instance, zero memory leak)
  useEffect(() => {
    if (eventQueue.length > 0 && eventQueue[0].speechText) {
      if (!preloadAudioRef.current && typeof window !== "undefined") {
        preloadAudioRef.current = new Audio();
        preloadAudioRef.current.preload = "auto";
      }
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = `/api/tts?text=${encodeURIComponent(eventQueue[0].speechText)}`;
      }
    }
  }, [eventQueue]);

  // TikTok Live Events Queue Processor (Strictly paused while Host Chat is active, queued, or exiting)
  useEffect(() => {
    const isRealChatActive = currentChat !== null && currentChat.id !== "prev-chat";
    if (
      currentEvent === null &&
      eventQueue.length > 0 &&
      exitingEventId === null &&
      !isRealChatActive &&
      chatQueue.length === 0 &&
      !isChatExiting
    ) {
      const [nextEvent, ...remaining] = eventQueue;
      activeEventIdRef.current = nextEvent.id;
      setExitingEventId(null);
      setIsEventCardVisible(false);
      setCurrentEvent(nextEvent);
      setEventQueue(remaining);
    }
  }, [
    currentEvent,
    eventQueue,
    exitingEventId,
    currentChat,
    chatQueue,
    isChatExiting,
  ]);

  // TikTok Live Events TTS Player & Guaranteed Auto-Dismiss
  useEffect(() => {
    if (!currentEvent) {
      return;
    }
    if (currentEvent.id === "prev-event") return;

    const eventId = currentEvent.id;
    activeEventIdRef.current = eventId;
    eventVisibleSinceRef.current = Date.now();
    setIsEventSpeaking(false);
    setEventDisplayDuration(4500);
    clearEventTimers();
    stopEventAudio();

    const speechText = currentEvent.speechText || "";

    // Helper to compute remaining hold time so popup NEVER flashes for only 1 second
    const getHoldDelay = (postAudioMs = 1500, minTotalVisibleMs = 4000) => {
      const elapsedVisible = Date.now() - eventVisibleSinceRef.current;
      return Math.max(postAudioMs, minTotalVisibleMs - elapsedVisible);
    };

    // Helper: Reveal event card & synchronize countdown timer
    const revealEventCard = (durationMs?: number) => {
      if (eventCardRevealTimeoutRef.current) {
        clearTimeout(eventCardRevealTimeoutRef.current);
        eventCardRevealTimeoutRef.current = null;
      }
      if (activeEventIdRef.current !== eventId) return;
      eventVisibleSinceRef.current = Date.now();
      if (durationMs) {
        setEventDisplayDuration(durationMs);
      }
      setIsEventCardVisible(true);
    };

    // Dynamic non-blocking watchdog timer
    const estimatedDuration = Math.min(
      15000,
      Math.max(6000, Math.ceil(speechText.length * 120) + 4000)
    );
    eventWatchdogTimerRef.current = setTimeout(() => {
      if (activeEventIdRef.current === eventId) {
        dismissActiveEvent(eventId);
      }
    }, estimatedDuration);

    // Play TTS Audio Synchronously & Synchronize Card Reveal
    if (speechText) {
      // Safety reveal timer: if network/audio takes > 450ms, reveal card anyway so it never hangs
      eventCardRevealTimeoutRef.current = setTimeout(() => {
        revealEventCard(4500);
      }, 450);

      try {
        const audio = eventAudioRef.current;
        if (audio) {
          // No &t= cache buster to enable instant browser memory & HTTP caching
          audio.src = `/api/tts?text=${encodeURIComponent(speechText)}`;
          audio.volume = 1.0;

          // When audio metadata is loaded: set exact duration, reveal card, and play audio synchronously!
          audio.onloadedmetadata = () => {
            if (activeEventIdRef.current !== eventId) return;
            const audioMs =
              audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)
                ? Math.round(audio.duration * 1000)
                : 3000;
            const totalDisplayMs = Math.max(4000, audioMs + 1500);
            revealEventCard(totalDisplayMs);

            if (eventWatchdogTimerRef.current) clearTimeout(eventWatchdogTimerRef.current);
            eventWatchdogTimerRef.current = setTimeout(() => {
              if (activeEventIdRef.current === eventId) {
                dismissActiveEvent(eventId);
              }
            }, audioMs + 3200);

            audio.play().catch((err) => {
              if (activeEventIdRef.current !== eventId) return;
              setIsEventSpeaking(false);
              if (err.name === "AbortError") return;
              if (err.name === "NotAllowedError") {
                setAudioUnlocked(false);
              }
              console.warn("Event audio autoplay blocked:", err);
            });
          };

          audio.onplay = () => {
            if (activeEventIdRef.current === eventId) {
              setIsEventSpeaking(true);
              revealEventCard();
            }
          };

          audio.onended = () => {
            if (activeEventIdRef.current !== eventId) return;
            setIsEventSpeaking(false);
            if (eventDismissTimerRef.current) clearTimeout(eventDismissTimerRef.current);
            eventDismissTimerRef.current = setTimeout(() => {
              if (activeEventIdRef.current === eventId) {
                dismissActiveEvent(eventId);
              }
            }, getHoldDelay(1500, 4000));
          };

          audio.onerror = () => {
            if (activeEventIdRef.current !== eventId) return;
            setIsEventSpeaking(false);
            revealEventCard(4200);
            if (eventDismissTimerRef.current) clearTimeout(eventDismissTimerRef.current);
            eventDismissTimerRef.current = setTimeout(() => {
              if (activeEventIdRef.current === eventId) {
                dismissActiveEvent(eventId);
              }
            }, getHoldDelay(3500, 4200));
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                if (activeEventIdRef.current === eventId) {
                  setIsEventSpeaking(true);
                  revealEventCard();
                }
              })
              .catch((err) => {
                if (activeEventIdRef.current !== eventId) return;
                if (err.name === "AbortError") return;
              });
          }
        }
      } catch {
        setIsEventSpeaking(false);
        revealEventCard(4200);
        if (eventDismissTimerRef.current) clearTimeout(eventDismissTimerRef.current);
        eventDismissTimerRef.current = setTimeout(() => {
          if (activeEventIdRef.current === eventId) {
            dismissActiveEvent(eventId);
          }
        }, getHoldDelay(3500, 4200));
      }
    } else {
      revealEventCard(4200);
      if (eventDismissTimerRef.current) clearTimeout(eventDismissTimerRef.current);
      eventDismissTimerRef.current = setTimeout(() => {
        if (activeEventIdRef.current === eventId) {
          dismissActiveEvent(eventId);
        }
      }, 4200);
    }

    return () => {
      clearEventTimers();
    };
  }, [currentEvent]);

  // Interactive Host Chat Queue Processor (HIGHEST PRIORITY: Preempts and quick-finishes any greeting)
  useEffect(() => {
    if (chatQueue.length > 0) {
      // Instantly kill/quick-finish any active greeting overlay & audio
      if (currentEvent) {
        clearEventTimers();
        if (eventExitTimerRef.current) {
          clearTimeout(eventExitTimerRef.current);
          eventExitTimerRef.current = null;
        }
        stopEventAudio();
        activeEventIdRef.current = null;
        setExitingEventId(null);
        setCurrentEvent(null);
      }

      if (currentChat === null) {
        const [nextChat, ...remaining] = chatQueue;
        setCurrentChat(nextChat);
        setChatQueue(remaining);
      }
    }
  }, [currentChat, chatQueue, currentEvent]);

  // Interactive Host Chat TTS Player & Synchronized Countdown Bar Dismissal
  useEffect(() => {
    if (!currentChat) {
      setIsChatExiting(false);
      activeChatIdRef.current = null;
      return;
    }
    if (isPreview) return;

    setIsChatExiting(false);
    activeChatIdRef.current = currentChat.id;

    if (chatDismissTimerRef.current) {
      clearTimeout(chatDismissTimerRef.current);
      chatDismissTimerRef.current = null;
    }

    const estimatedDuration = Math.min(
      30000,
      Math.max(5000, Math.ceil(currentChat.message.length * 115) + 3500)
    );
    setChatDisplayDuration(estimatedDuration);
    setIsChatSpeaking(true);

    // 1. HARD WATCHDOG TIMER: Always guarantees popup dismissal
    chatDismissTimerRef.current = setTimeout(dismissChat, estimatedDuration);

    if (currentChat.message) {
      try {
        const audio = chatAudioRef.current;
        if (audio) {
          const voiceParam = currentChat.voice ? `&voice=${encodeURIComponent(currentChat.voice)}` : "&voice=schoolgirl";
          audio.src = `/api/tts?text=${encodeURIComponent(currentChat.message)}${voiceParam}`;
          audio.volume = 1.0;

          // When audio length is known, adapt countdown bar to EXACT audio length + reading buffer
          audio.onloadedmetadata = () => {
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
              const audioMs = Math.round(audio.duration * 1000);
              const postSpeechDelay = chatQueue.length > 0 ? 400 : 700;
              const totalDuration = audioMs + postSpeechDelay;
              setChatDisplayDuration(totalDuration);

              if (chatDismissTimerRef.current) clearTimeout(chatDismissTimerRef.current);
              chatDismissTimerRef.current = setTimeout(dismissChat, audioMs + 3000);
            }
          };

          audio.onended = () => {
            setIsChatSpeaking(false);
            const postSpeechDelay = chatQueue.length > 0 ? 400 : 700;
            if (chatDismissTimerRef.current) clearTimeout(chatDismissTimerRef.current);
            chatDismissTimerRef.current = setTimeout(dismissChat, postSpeechDelay);
          };

          audio.onerror = () => {
            setIsChatSpeaking(false);
            if (chatDismissTimerRef.current) clearTimeout(chatDismissTimerRef.current);
            chatDismissTimerRef.current = setTimeout(dismissChat, 2000);
          };

          audio.onstalled = () => {
            setIsChatSpeaking(false);
            if (chatDismissTimerRef.current) clearTimeout(chatDismissTimerRef.current);
            chatDismissTimerRef.current = setTimeout(dismissChat, 2500);
          };

          audio.play().catch(() => {
            setIsChatSpeaking(false);
          });
        }
      } catch {
        setIsChatSpeaking(false);
      }
    }

    return () => {
      if (chatDismissTimerRef.current) {
        clearTimeout(chatDismissTimerRef.current);
        chatDismissTimerRef.current = null;
      }
      setIsChatSpeaking(false);
      stopChatAudio();
    };
  }, [currentChat]);

  // Dynamic Position Class Builders (Exact matching individual overlay padding)
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
      case "center":
        return "items-center justify-center p-8";
      case "bottom-left":
      default:
        return "items-end justify-start p-8 pb-12";
    }
  };

  const getTransformOrigin = (pos: string) => {
    switch (pos) {
      case "top-left":
        return "top left";
      case "top-right":
        return "top right";
      case "top-center":
        return "top center";
      case "bottom-right":
        return "bottom right";
      case "bottom-center":
        return "bottom center";
      case "center":
        return "center center";
      case "bottom-left":
      default:
        return "bottom left";
    }
  };

  // Badge styling per event (Exact matching app/overlay/events/page.tsx)
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

  const videoId = currentAlert ? getYouTubeVideoId(currentAlert.mediaUrl) : null;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent overflow-hidden select-none font-sans pointer-events-none antialiased subpixel-antialiased [text-rendering:optimizeLegibility]">
      {/* Audio Unlock Notification (Exact matching individual overlay) */}
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
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/85 text-yellow-300 text-xs font-bold px-4 py-2 rounded-full border border-yellow-400 pointer-events-auto cursor-pointer animate-pulse z-50 shadow-lg flex items-center gap-1.5"
        >
          <span>🔊</span> Klik layar untuk mengaktifkan suara audio
        </div>
      )}

      {/* 1. DONATION ALERT WIDGET (100% IDENTICAL TO /overlay) */}
      {enabledModules.has("alert") && currentAlert && (
        <div
          className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
            alertPos
          )}`}
        >
          <div
            style={scale !== 1 ? { zoom: scale } : undefined}
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
        </div>
      )}

      {/* 2. TIKTOK LIVE EVENTS TTS WIDGET (100% IDENTICAL TO /overlay/events) */}
      {enabledModules.has("events") && currentEvent && isEventCardVisible && (
        <div
          className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
            eventsPos
          )}`}
        >
          <div
            key={currentEvent.id}
            style={scale !== 1 ? { zoom: scale } : undefined}
            onClick={() => dismissActiveEvent(currentEvent.id)}
            className={`w-full max-w-md flex flex-col gap-2 pointer-events-auto cursor-pointer transition-all duration-300 ease-out ${
              exitingEventId === currentEvent.id
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
                  {isEventSpeaking && (
                    <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 bg-yellow-400/20 rounded-md border border-yellow-400/40">
                      <span className="w-1 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                      <span className="w-1 h-4 bg-yellow-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                      <span className="w-1 h-2.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                      <span className="text-[10px] font-bold text-yellow-300 ml-0.5">TTS</span>
                    </div>
                  )}
                  {eventQueue.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-black tracking-wide">
                      +{eventQueue.length} antre
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
                  key={`${currentEvent.id}-${eventDisplayDuration}`}
                  className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full origin-left rounded-full"
                  style={{
                    animation: `shrinkWidth ${eventDisplayDuration}ms linear forwards`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. INTERACTIVE HOST CHAT WIDGET (100% IDENTICAL TO /overlay/chat) */}
      {enabledModules.has("chat") && currentChat && (
        <div
          className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
            chatPos
          )}`}
        >
          <div
            style={scale !== 1 ? { zoom: scale } : undefined}
            onClick={dismissChat}
            className={`transition-all duration-300 max-w-lg w-full pointer-events-auto cursor-pointer ${
              isChatExiting
                ? "opacity-0 translate-y-3 scale-95 pointer-events-none"
                : "opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-5"
            }`}
          >
            {/* Streamer Speech Card */}
            <div className="bg-black/85 backdrop-blur-none rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex flex-col gap-2.5 transition hover:border-yellow-300 relative overflow-hidden">
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
                {isChatSpeaking ? (
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
                  key={`${currentChat.id}-${chatDisplayDuration}`}
                  className="bg-yellow-400 h-full origin-left rounded-full"
                  onAnimationEnd={() => {
                    dismissChat();
                  }}
                  style={{
                    animation: `shrinkWidth ${chatDisplayDuration}ms linear forwards`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MEME SFX WIDGET (100% IDENTICAL TO /overlay/sfx) */}
      {enabledModules.has("sfx") && currentSfx && (
        <div
          className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
            sfxPos
          )}`}
        >
          <div
            style={scale !== 1 ? { zoom: scale } : undefined}
            onClick={() => {
              setCurrentSfx(null);
              stopSfxAudio();
            }}
            className="animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-sm w-full pointer-events-auto cursor-pointer"
          >
            {/* SFX Alert Toast Card */}
            <div className="bg-black/90 rounded-2xl p-4 border-2 border-yellow-400 shadow-2xl flex flex-col gap-2.5 backdrop-blur-none transition hover:border-yellow-300">
              {/* Top Row: Emoji & Sender */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-3xl shrink-0 animate-bounce">{currentSfx.emoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-yellow-400 text-black font-black text-[11px] uppercase tracking-wider">
                        {currentSfx.command}
                      </span>
                      <span className="text-[11px] text-gray-300 font-bold truncate">
                        @{currentSfx.sender}
                      </span>
                    </div>
                    <h3 className="saweria-text-yellow text-base font-black truncate">
                      {currentSfx.name}
                    </h3>
                  </div>
                </div>

                {/* Sound Wave Indicator */}
                <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-yellow-400/20 rounded-md border border-yellow-400/40">
                  <span className="w-1 h-3.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                  <span className="w-1 h-5 bg-yellow-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-1 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  <span className="text-[10px] font-bold text-yellow-300 ml-1">SFX</span>
                </div>
              </div>

              {/* Freemium Hook Bar */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                <span className="text-yellow-300/90 font-bold flex items-center gap-1">
                  <span>⚡</span> Cooldown: 30s
                </span>
                <span className="text-gray-400 font-semibold truncate">
                  Bypass cooldown? Donasi di <strong className="text-white">twodigit.io</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LIVE VOTING POLL WIDGET (100% IDENTICAL TO /overlay/poll) */}
      {enabledModules.has("poll") &&
        poll &&
        Array.isArray(poll.options) &&
        poll.options.length > 0 && (
          <div
            className={`absolute inset-0 flex pointer-events-none ${getContainerClasses(
              pollPos
            )}`}
          >
            <div
              style={scale !== 1 ? { zoom: scale } : undefined}
              className="w-full max-w-md animate-in fade-in duration-300 flex flex-col gap-3"
            >
              {/* Main Poll Card */}
              <div className="bg-black/85 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-3.5 backdrop-blur-none">
                {/* Header: Status Badge & Total Votes on top, Full-Width Title below */}
                <div className="border-b border-white/10 pb-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">📊</span>
                      {poll.status === "ended" ? (
                        <span className="px-2.5 py-0.5 rounded-md bg-red-500/25 border border-red-500/50 text-red-300 text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-400"></span>
                          Voting Selesai
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md bg-green-500/25 border border-green-400/50 text-green-300 text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                          Live Vote
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-300/90 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                        {poll.totalVotes} suara
                      </span>
                    </div>
                  </div>

                  {/* Title (Full width) */}
                  <h2 className="saweria-text-yellow text-lg md:text-xl uppercase font-black leading-snug break-words">
                    {poll.title}
                  </h2>
                </div>

                {/* Options List */}
                <div className="flex flex-col gap-2.5">
                  {poll.options.map((opt, idx) => {
                    const color = OPTION_COLORS[idx % OPTION_COLORS.length];
                    const isWinner = poll.status === "ended" && poll.winner?.index === opt.index;

                    return (
                      <div key={opt.index} className="flex flex-col gap-1">
                        {/* Option Label, Votes & Percentage */}
                        <div className="flex items-center justify-between text-xs md:text-sm font-black">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md border font-black text-xs shrink-0 ${color.badge}`}
                            >
                              !{opt.index}
                            </span>
                            <span className="saweria-text-white truncate">
                              {isWinner && <span className="mr-1">👑</span>}
                              {opt.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="saweria-text-sm text-[11px] text-gray-300">
                              {opt.votes} vote
                            </span>
                            <span className="saweria-text-yellow text-sm md:text-base">
                              {opt.percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Track */}
                        <div className="w-full h-4 bg-black/80 rounded-full overflow-hidden p-0.5 border border-white/20 relative shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${color.bar}`}
                            style={{
                              width: `${Math.max(opt.percentage, opt.votes > 0 ? 3 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Callout */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-yellow-300 font-bold flex items-center gap-1.5">
                    <span className="text-sm">💬</span> Ketik{" "}
                    <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-black font-black text-[11px]">
                      !1
                    </span>{" "}
                    atau{" "}
                    <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-black font-black text-[11px]">
                      !2
                    </span>{" "}
                    di live chat!
                  </span>
                  {poll.status === "ended" && poll.winner ? (
                    <span className="text-green-300 font-black text-[11px] flex items-center gap-1 shrink-0">
                      <span>👑</span> {poll.winner.label}
                    </span>
                  ) : null}
                </div>
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

export default function BundleOverlayPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center text-white/70 bg-transparent font-bold">
          Loading All-in-One Super Overlay...
        </div>
      }
    >
      <BundleOverlayContent />
    </Suspense>
  );
}
