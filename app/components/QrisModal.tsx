"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Pusher from "pusher-js";
import { toast } from "sonner";

export interface QrisOrderData {
  orderId: string;
  donorName: string;
  message?: string;
  baseAmount: number;
  uniqueCode: number;
  totalAmount: number;
  expiredAt: string;
  qrisImageUrl: string;
}

interface QrisModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: QrisOrderData | null;
  onSuccess?: () => void;
}

export default function QrisModal({
  isOpen,
  onClose,
  orderData,
  onSuccess,
}: QrisModalProps) {
  const [status, setStatus] = useState<"pending" | "settled" | "expired">("pending");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15 * 60);
  const [copied, setCopied] = useState<boolean>(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isHandledRef = useRef<boolean>(false);

  // Reset state when a new order is opened
  useEffect(() => {
    if (!isOpen || !orderData) {
      setStatus("pending");
      isHandledRef.current = false;
      return;
    }

    setStatus("pending");
    setCopied(false);
    isHandledRef.current = false;

    // Calculate initial remaining seconds
    const expTime = new Date(orderData.expiredAt).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((expTime - now) / 1000));
    setSecondsRemaining(diffSec);

    // Helper to handle payment success only once
    const handlePaymentSuccess = () => {
      if (isHandledRef.current) return;
      isHandledRef.current = true;

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      setStatus("settled");
      toast.success("Pembayaran berhasil diverifikasi!", {
        id: `payment-success-${orderData.orderId}`,
      });
      onSuccess?.();
    };

    // 1. Setup Pusher Realtime Subscription for this order
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    let pusher: Pusher | null = null;
    if (pusherKey) {
      pusher = new Pusher(pusherKey, {
        cluster: pusherCluster,
      });

      const channelName = `order-${orderData.orderId}`;
      const channel = pusher.subscribe(channelName);

      channel.bind("payment-settled", () => {
        handlePaymentSuccess();
      });
    }

    // 2. Setup Polling Fallback every 3 seconds
    const checkStatus = async () => {
      if (isHandledRef.current) return;

      try {
        const res = await fetch(`/api/donation/qris/${orderData.orderId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "settled") {
          handlePaymentSuccess();
        } else if (data.status === "expired") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("expired");
        }
      } catch (err) {
        console.error("Error polling order status:", err);
      }
    };

    pollIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (pusher) pusher.disconnect();
    };
  }, [isOpen, orderData, onSuccess]);

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen || status !== "pending") return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status]);

  if (!isOpen || !orderData) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const formattedTotal = new Intl.NumberFormat("id-ID").format(orderData.totalAmount);
  const formattedBase = new Intl.NumberFormat("id-ID").format(orderData.baseAmount);

  const handleCopyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(orderData.totalAmount));
      setCopied(true);
      toast.success("Nominal disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Gagal menyalin nominal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-outline-variant overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-primary to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg tracking-tight">Pembayaran QRIS</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">Otomatis</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center">
          {status === "settled" ? (
            /* Success State */
            <div className="py-8 text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4 animate-bounce">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Pembayaran Berhasil!</h2>
              <p className="text-sm text-gray-600 max-w-xs mb-6">
                Terima kasih atas dukungan dari <span className="font-semibold text-gray-900">{orderData.donorName}</span>! Notifikasi dan alert donasi sedang ditayangkan di live stream.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-primary text-white py-3 px-6 rounded-xl font-medium hover:bg-indigo-600 transition-colors shadow-md"
              >
                Tutup
              </button>
            </div>
          ) : status === "expired" ? (
            /* Expired State */
            <div className="py-8 text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Waktu Pembayaran Habis</h2>
              <p className="text-sm text-gray-600 max-w-xs mb-6">
                Batas waktu pembayaran 15 menit telah terlewati. Silakan buat donasi ulang untuk mendapatkan kode unik baru.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                Kembali
              </button>
            </div>
          ) : (
            /* Pending State: QR & Payment Info */
            <>
              {/* QR Image Frame */}
              <div className="relative p-2 bg-white rounded-2xl border-2 border-dashed border-primary/40 shadow-sm mb-4">
                <div className="relative w-60 h-60 overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center">
                  <Image
                    src={orderData.qrisImageUrl || "/images/qris.jpg"}
                    alt="QRIS QR Code"
                    width={240}
                    height={240}
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              {/* Total Amount to Pay with Copy Button */}
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 text-center">
                <p className="text-xs text-amber-800 font-medium mb-1">
                  TOTAL YANG HARUS DITRANSFER (TEPAT):
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black text-gray-900 tracking-tight">
                    Rp {formattedTotal}
                  </span>
                  <button
                    onClick={handleCopyAmount}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-200 text-amber-900 hover:bg-amber-300 transition-colors flex items-center gap-1 active:scale-95"
                    title="Salin nominal tepat"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Disalin</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2 text-xs text-amber-900 leading-tight">
                  Termasuk kode unik <span className="font-bold underline">+{orderData.uniqueCode}</span> (Donasi Rp {formattedBase} + {orderData.uniqueCode})
                </div>
              </div>

              {/* Warning Notice */}
              <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 mb-4 text-[11px] text-gray-600 leading-relaxed text-left flex items-start gap-2">
                <span className="text-amber-500 font-bold text-sm leading-none mt-0.5">⚠️</span>
                <span>
                  Pastikan nominal yang Anda masukkan saat scan <strong className="text-gray-800">persis Rp {formattedTotal}</strong>. Jika berbeda, sistem otomatis tidak dapat mengenali donasi Anda.
                </span>
              </div>

              {/* Countdown & Live Indicator */}
              <div className="w-full flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="font-medium text-gray-700">Menunggu pembayaran...</span>
                </div>
                <div className="font-mono font-medium text-gray-600">
                  Sisa waktu: <span className="font-bold text-gray-900">{formattedTime}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
