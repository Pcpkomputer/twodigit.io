"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";

interface MilestoneData {
  title: string;
  target: number;
  current: number;
  percentage: number;
  donorCount: number;
  startDate: string | null;
}

function MilestoneOverlayContent() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate") || "";
  const target = parseFloat(searchParams.get("target") || "1000000");
  const title = searchParams.get("title") || "Donation Goal";
  const theme = searchParams.get("theme") || "modern"; // modern | neon | minimal

  const [milestone, setMilestone] = useState<MilestoneData>({
    title,
    target,
    current: 0,
    percentage: 0,
    donorCount: 0,
    startDate: startDate || null,
  });

  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch initial progress from Supabase API
  const fetchMilestone = async () => {
    try {
      const url = `/api/milestone?target=${target}&title=${encodeURIComponent(title)}${
        startDate ? `&startDate=${encodeURIComponent(startDate)}` : ""
      }`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMilestone(data);
      }
    } catch (e) {
      console.error("Failed to fetch milestone data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMilestone();
  }, [startDate, target, title]);

  // 2. Realtime subscription to Pusher to increment milestone immediately
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, {
      cluster,
    });

    const channel = pusher.subscribe("donation-stream");

    channel.bind("new-donation", (donation: { amount: number; createdAt: string }) => {
      // If startDate is specified, check if donation happened on/after startDate
      if (startDate) {
        const donationTime = new Date(donation.createdAt || Date.now()).getTime();
        const startTime = new Date(startDate).getTime();
        if (donationTime < startTime) return;
      }

      setMilestone((prev) => {
        const newCurrent = prev.current + (Number(donation.amount) || 0);
        const newPercentage = prev.target > 0 ? Math.min(100, (newCurrent / prev.target) * 100) : 0;
        return {
          ...prev,
          current: newCurrent,
          percentage: Number(newPercentage.toFixed(1)),
          donorCount: prev.donorCount + 1,
        };
      });
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [startDate]);

  const formattedCurrent = new Intl.NumberFormat("id-ID").format(milestone.current);
  const formattedTarget = new Intl.NumberFormat("id-ID").format(milestone.target);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex items-start justify-center p-6 select-none font-sans pointer-events-none">
      {/* Saweria Style Milestone: Transparent floating overlay with bold yellow & black border */}
      <div className="w-full max-w-lg flex flex-col gap-2 drop-shadow-2xl">
        {/* Header Title & Percentage */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="saweria-text-yellow text-xl md:text-2xl tracking-tight uppercase font-black truncate">
            {milestone.title}
          </h2>

          <div className="saweria-text-white text-lg md:text-xl font-black">
            {milestone.percentage}%
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-6 bg-black/70 rounded-full overflow-hidden p-0.5 border-2 border-black shadow-2xl relative">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 rounded-full transition-all duration-700 ease-out shadow-inner"
            style={{ width: `${Math.max(milestone.percentage, 2)}%` }}
          />
        </div>

        {/* Footer Figures & Donors Count */}
        <div className="flex items-center justify-between">
          <div className="saweria-text-white text-sm md:text-base font-black flex items-center gap-1.5">
            <span className="saweria-text-yellow">Rp {formattedCurrent}</span>
            <span className="text-white">/</span>
            <span>Rp {formattedTarget}</span>
          </div>

          {milestone.donorCount > 0 && (
            <div className="saweria-text-yellow text-xs md:text-sm font-black">
              {milestone.donorCount} Donatur
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MilestoneOverlayPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center text-on-surface-variant">
          Loading milestone...
        </div>
      }
    >
      <MilestoneOverlayContent />
    </Suspense>
  );
}
