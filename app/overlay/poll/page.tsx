"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";

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

// Color gradients for different options
const OPTION_COLORS = [
  {
    bg: "from-cyan-500 to-blue-600",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/50",
    bar: "bg-gradient-to-r from-cyan-500 to-blue-500",
  },
  {
    bg: "from-amber-400 to-orange-500",
    badge: "bg-amber-500/20 text-amber-300 border-amber-400/50",
    bar: "bg-gradient-to-r from-amber-400 to-orange-500",
  },
  {
    bg: "from-emerald-400 to-green-600",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50",
    bar: "bg-gradient-to-r from-emerald-400 to-green-500",
  },
  {
    bg: "from-fuchsia-500 to-purple-600",
    badge: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/50",
    bar: "bg-gradient-to-r from-fuchsia-500 to-purple-500",
  },
  {
    bg: "from-rose-500 to-red-600",
    badge: "bg-rose-500/20 text-rose-300 border-rose-400/50",
    bar: "bg-gradient-to-r from-rose-500 to-red-500",
  },
];

function PollOverlayContent() {
  const searchParams = useSearchParams();
  const position = searchParams.get("pos") || "bottom-left"; // bottom-left | bottom-center | top-left | top-center
  const isPreview = searchParams.get("preview") === "1";

  const [poll, setPoll] = useState<PollState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch initial active poll on mount
  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const res = await fetch("/api/poll/active");
        if (res.ok) {
          const data = await res.json();
          if (data.active && data.poll) {
            setPoll(data.poll);
          } else if (isPreview) {
            // Sample preview for OBS layout design
            setPoll({
              id: "preview",
              title: "Hero Apa di Game Berikutnya?",
              options: [
                { index: 1, label: "Layla", votes: 42, percentage: 58.3 },
                { index: 2, label: "Miya", votes: 30, percentage: 41.7 },
              ],
              totalVotes: 72,
              status: "active",
              createdAt: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch active poll:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoll();
  }, [isPreview]);

  // Subscribe to real-time Pusher updates
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, {
      cluster,
    });

    const channel = pusher.subscribe("donation-stream");

    channel.bind("poll-update", (data: PollState) => {
      console.log("Overlay received poll update:", data);
      setPoll(data);
    });

    channel.bind("poll-ended", (data: PollState) => {
      console.log("Overlay received poll end:", data);
      setPoll(data);
    });

    channel.bind("poll-reset", () => {
      console.log("Overlay received poll reset");
      setPoll(null);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  if (!poll) {
    return null;
  }

  // Positioning
  const getPositionClasses = () => {
    switch (position) {
      case "bottom-center":
        return "items-end justify-center pb-10";
      case "top-center":
        return "items-start justify-center pt-8";
      case "top-left":
        return "items-start justify-start p-8";
      case "bottom-left":
      default:
        return "items-end justify-start p-8 pb-10";
    }
  };

  const isEnded = poll.status === "ended";

  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex select-none font-sans pointer-events-none ${getPositionClasses()}`}
    >
      <div className="w-full max-w-md animate-in fade-in duration-300 flex flex-col gap-3">
        {/* Main Poll Card */}
        <div className="bg-black/85 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-3.5 backdrop-blur-none">
          {/* Header Title & Status */}
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl shrink-0">📊</span>
              <h2 className="saweria-text-yellow text-lg md:text-xl uppercase font-black truncate">
                {poll.title}
              </h2>
            </div>
            <div className="shrink-0 text-right">
              {isEnded ? (
                <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 text-[11px] font-black uppercase">
                  Selesai
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-green-500/20 border border-green-500/40 text-green-300 text-[11px] font-black uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  Live Vote
                </span>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="flex flex-col gap-2.5">
            {poll.options.map((opt, idx) => {
              const color = OPTION_COLORS[idx % OPTION_COLORS.length];
              const isWinner = isEnded && poll.winner?.index === opt.index;

              return (
                <div key={opt.index} className="flex flex-col gap-1">
                  {/* Option Label, Votes & Percentage */}
                  <div className="flex items-center justify-between text-xs md:text-sm font-black">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-md border font-black text-xs ${color.badge}`}
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
                      style={{ width: `${Math.max(opt.percentage, opt.votes > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Callout */}
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-yellow-300/90 font-bold flex items-center gap-1">
              <span>💬</span> Ketik <span className="underline font-black">!1</span> atau{" "}
              <span className="underline font-black">!2</span> di live chat!
            </span>
            <span className="text-gray-400 font-semibold">{poll.totalVotes} total suara</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PollOverlayPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center text-white/70 bg-transparent font-bold">
          Loading poll overlay...
        </div>
      }
    >
      <PollOverlayContent />
    </Suspense>
  );
}
