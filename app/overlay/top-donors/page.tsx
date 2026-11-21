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
  const position = searchParams.get("position") || "top-left";

  // Scale factor: defaults to 0.75 (optimal for 1280x720) or 1.0
  const rawScale = searchParams.get("scale");
  const scale = rawScale ? Math.max(0.4, Math.min(1.5, parseFloat(rawScale) || 0.75)) : 0.75;

  const [topDonors, setTopDonors] = useState<DonorLeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch initial top donors from API
  const fetchTopDonors = async () => {
    try {
      const url = `/api/top-donors?limit=${limit}${
        startDate ? `&startDate=${encodeURIComponent(startDate)}` : ""
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

  const getPositionClasses = () => {
    switch (position) {
      case "top-right":
        return "items-start justify-end p-8";
      case "top-center":
        return "items-start justify-center pt-8";
      case "bottom-left":
        return "items-end justify-start p-8 pb-12";
      case "bottom-right":
        return "items-end justify-end p-8 pb-12";
      case "bottom-center":
        return "items-end justify-center pb-12";
      case "center":
        return "items-center justify-center p-8";
      case "top-left":
      default:
        return "items-start justify-start p-8";
    }
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-transparent overflow-hidden flex select-none font-sans pointer-events-none antialiased subpixel-antialiased [text-rendering:optimizeLegibility] ${getPositionClasses()}`}
    >
      {/* Saweria Style Top Donors Card: High-contrast, crystal-sharp typography */}
      <div
        style={scale !== 1 ? { zoom: scale } : undefined}
        className="w-full max-w-sm flex flex-col gap-2.5 animate-in fade-in duration-300"
      >
        <div className="bg-black/85 rounded-2xl p-4 md:p-5 border-2 border-yellow-400 shadow-2xl flex flex-col gap-3 backdrop-blur-none">
          {/* Header Title */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl shrink-0">🏆</span>
              <h2 className="saweria-text-yellow text-xl md:text-2xl uppercase font-black tracking-wide truncate">
                {title}
              </h2>
            </div>
            {startDate && (
              <span className="text-[10px] text-yellow-300 font-bold bg-white/10 px-2 py-0.5 rounded-md border border-white/15 uppercase tracking-wider shrink-0">
                Live Filter
              </span>
            )}
          </div>

          {/* List of Top Donors */}
          {topDonors.length === 0 ? (
            <div className="text-gray-300 text-sm font-bold py-3 text-center">
              {isLoading ? "Memuat data donatur..." : "Belum ada donasi tercatat"}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {topDonors.map((donor, idx) => (
                <div
                  key={donor.name + idx}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-yellow-400/40 transition-all duration-300"
                >
                  {/* Rank & Name (Crystal-sharp text without blurry stroke) */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0 font-black">
                      {getCrownOrMedal(idx)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white text-sm md:text-base font-black truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                        {donor.name}
                      </p>
                      {donor.count > 1 && (
                        <p className="text-[11px] text-yellow-300 font-bold">
                          {donor.count}x donasi
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Amount (Crystal-sharp Gold Text) */}
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-yellow-400 text-sm md:text-base font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      Rp {new Intl.NumberFormat("id-ID").format(donor.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TopDonorsOverlayPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center text-white/70 bg-transparent font-bold">
          Loading leaderboard...
        </div>
      }
    >
      <TopDonorsOverlayContent />
    </Suspense>
  );
}
