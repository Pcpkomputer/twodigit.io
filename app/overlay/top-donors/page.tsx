"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";

interface DonorLeaderboardItem {
  name: string;
  totalAmount: number;
  count: number;
  lastDonation: string;
}

function TopDonorsOverlayContent() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate") || "";
  const limit = parseInt(searchParams.get("limit") || "5", 10);
  const title = searchParams.get("title") || "Top Donatur";

  const [topDonors, setTopDonors] = useState<DonorLeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch initial top donors from API
  const fetchTopDonors = async () => {
    try {
      const url = `/api/top-donors?limit=${limit}${startDate ? `&startDate=${encodeURIComponent(startDate)}` : ""
        }`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTopDonors(data.topDonors || []);
      }
    } catch (e) {
      console.error("Failed to fetch top donors:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopDonors();
  }, [startDate, limit]);

  // 2. Realtime Pusher subscription to update leaderboard instantly
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    if (!pusherKey) return;

    const pusher = new Pusher(pusherKey, {
      cluster,
    });

    const channel = pusher.subscribe("donation-stream");

    channel.bind(
      "new-donation",
      (donation: { name: string; amount: number; createdAt: string }) => {
        // Date check if startDate filter is specified
        if (startDate) {
          const donationTime = new Date(donation.createdAt || Date.now()).getTime();
          const startTime = new Date(startDate).getTime();
          if (donationTime < startTime) return;
        }

        const donorName = donation.name || "Anonim";
        const amount = Number(donation.amount) || 0;

        setTopDonors((prev) => {
          const clone = [...prev];
          const existingIndex = clone.findIndex(
            (item) => item.name.toLowerCase() === donorName.toLowerCase()
          );

          if (existingIndex > -1) {
            clone[existingIndex] = {
              ...clone[existingIndex],
              totalAmount: clone[existingIndex].totalAmount + amount,
              count: clone[existingIndex].count + 1,
              lastDonation: donation.createdAt || new Date().toISOString(),
            };
          } else {
            clone.push({
              name: donorName,
              totalAmount: amount,
              count: 1,
              lastDonation: donation.createdAt || new Date().toISOString(),
            });
          }

          // Re-sort descending and apply limit
          return clone
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, limit);
        });
      }
    );

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [startDate, limit]);

  // Rank badge styling helper
  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return "bg-amber-400/20 text-amber-300 border-amber-400/40 ring-2 ring-amber-400/30";
      case 1:
        return "bg-slate-300/20 text-slate-200 border-slate-300/40 ring-1 ring-slate-300/30";
      case 2:
        return "bg-amber-700/20 text-amber-500 border-amber-700/40";
      default:
        return "bg-surface-container-high text-on-surface-variant border-outline-variant";
    }
  };

  const getCrownOrMedal = (index: number) => {
    switch (index) {
      case 0:
        return "👑";
      case 1:
        return "🥈";
      case 2:
        return "🥉";
      default:
        return `#${index + 1}`;
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex items-start justify-start p-6 select-none font-sans pointer-events-none">
      <div className="w-full max-w-sm bg-surface/95 backdrop-blur-2xl border-2 border-primary/40 rounded-3xl p-5 shadow-2xl ring-4 ring-primary/10 transition-all duration-500 animate-in fade-in zoom-in-95">
        {/* Header Title */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h2 className="font-extrabold text-base text-on-surface tracking-tight truncate">
              {title}
            </h2>
          </div>
          {startDate && (
            <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant">
              Filtered
            </span>
          )}
        </div>

        {/* List of Top Donors */}
        {topDonors.length === 0 ? (
          <div className="text-center py-6 text-xs text-on-surface-variant font-medium">
            {isLoading ? "Memuat data donatur..." : "Belum ada donasi tercatat"}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {topDonors.map((donor, idx) => (
              <div
                key={donor.name + idx}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-surface-container-low/90 border border-outline-variant/60 shadow-sm transition-all duration-300 hover:scale-[1.02]"
              >
                {/* Rank & Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs border shrink-0 ${getRankBadge(
                      idx
                    )}`}
                  >
                    {getCrownOrMedal(idx)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-on-surface truncate">
                      {donor.name}
                    </p>
                    {donor.count > 1 && (
                      <p className="text-[10px] text-on-surface-variant">
                        {donor.count}x donasi
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-primary">
                    Rp {new Intl.NumberFormat("id-ID").format(donor.totalAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TopDonorsOverlayPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center text-on-surface-variant">
          Loading leaderboard...
        </div>
      }
    >
      <TopDonorsOverlayContent />
    </Suspense>
  );
}
