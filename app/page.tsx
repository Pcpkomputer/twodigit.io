"use client";

import { useState } from "react";
import { toast } from "sonner";
import QrisModal, { QrisOrderData } from "@/app/components/QrisModal";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export default function Home() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [senderName, setSenderName] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"qris" | "midtrans">("qris");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // QRIS Modal State
  const [isQrisModalOpen, setIsQrisModalOpen] = useState<boolean>(false);
  const [qrisOrderData, setQrisOrderData] = useState<QrisOrderData | null>(null);

  const formatRupiah = (value: string) => {
    const rawValue = value.replace(/\D/g, "");
    if (!rawValue) return "";
    return new Intl.NumberFormat("id-ID").format(parseInt(rawValue, 10));
  };

  const handleCustomAmountChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const formatted = formatRupiah(e.target.value);
    setCustomAmount(formatted);
    setSelectedAmount(null);
  };

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const numericAmount = selectedAmount
    ? selectedAmount
    : parseInt(customAmount.replace(/\D/g, ""), 10) || 0;

  const currentDisplayAmount = selectedAmount
    ? new Intl.NumberFormat("id-ID").format(selectedAmount)
    : customAmount || "0";

  const creatorTitle =
    process.env.NEXT_PUBLIC_CREATOR_TITLE || "Support Yudhacode";
  const creatorDescription =
    process.env.NEXT_PUBLIC_CREATOR_DESCRIPTION ||
    "Membuat tools open source dan konten edukasi untuk para developer di seluruh dunia. Dukungan Anda membantu menjaga sumber daya ini tetap gratis dan dapat diakses oleh siapa saja.";

  const resetForm = () => {
    setMessage("");
    setMediaUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (numericAmount < 1000) {
      toast.warning("Minimal donasi adalah Rp 1.000.");
      return;
    }

    setIsLoading(true);

    try {
      if (paymentMethod === "qris") {
        // ==========================================
        // Process via QRIS Static & Unique Code
        // ==========================================
        const response = await fetch("/api/donation/qris", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: numericAmount,
            name: senderName,
            message,
            mediaUrl,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.orderId) {
          throw new Error(data.error || "Gagal membuat transaksi QRIS.");
        }

        setQrisOrderData(data);
        setIsQrisModalOpen(true);
      } else {
        // ==========================================
        // Process via Midtrans Snap Gateway
        // ==========================================
        const response = await fetch("/api/donation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: numericAmount,
            name: senderName,
            message,
            mediaUrl,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.token) {
          throw new Error(data.error || "Gagal memproses donasi.");
        }

        if (window.snap) {
          window.snap.pay(data.token, {
            onSuccess: (result: any) => {
              toast.success("Terima kasih! Pembayaran donasi berhasil.");
              console.log("Midtrans Success:", result);
              resetForm();
            },
            onPending: (result: any) => {
              toast.info("Pembayaran Anda sedang menunggu penyelesaian.");
              console.log("Midtrans Pending:", result);
            },
            onError: (result: any) => {
              toast.error("Pembayaran gagal. Silakan coba lagi.");
              console.error("Midtrans Error:", result);
            },
            onClose: () => {
              toast("Popup pembayaran ditutup.");
              console.log("Popup Midtrans ditutup tanpa menyelesaikan pembayaran.");
            },
          });
        } else if (data.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          toast.error("Midtrans Snap belum siap. Silakan muat ulang halaman.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memproses donasi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <main
        style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
        className="flex-grow max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-stack-lg"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter w-full max-w-2xl">
          {/* Main Column: Hero & Donation Form */}
          <div className="lg:col-span-12 flex flex-col gap-stack-md">
            {/* Hero / Profile Card */}
            <div className="bg-white rounded-xl p-stack-md flex flex-col sm:flex-row items-center sm:items-start gap-stack-md border border-outline-variant relative overflow-hidden group">
              <div className="text-center sm:text-left flex-grow">
                <h1 className="font-headline-lg text-headline-lg md:font-headline-xl md:text-headline-xl text-on-surface mb-2 font-bold">
                  {creatorTitle}
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-lg text-gray-600">
                  {creatorDescription}
                </p>
              </div>
            </div>

            {/* Main Donation Form */}
            <div className="bg-white rounded-xl p-stack-md border border-outline-variant shadow-sm">
              <form className="flex flex-col gap-stack-md" onSubmit={handleSubmit}>
                {/* Amount Selection */}
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface-variant mb-stack-sm font-medium text-gray-700">
                    Pilih Jumlah Donasi
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-stack-sm mb-3">
                    {[10000, 25000, 50000, 100000].map((amt) => {
                      const isSelected = selectedAmount === amt;
                      return (
                        <button
                          style={{ cursor: "pointer" }}
                          key={amt}
                          className={`py-3 rounded-lg border font-body-md text-body-md transition-all focus:outline-none focus:ring-2 focus:ring-primary ${isSelected
                            ? "border-2 border-primary bg-indigo-50 text-primary font-bold shadow-sm"
                            : "border-outline-variant bg-white text-on-surface hover:border-primary"
                            }`}
                          type="button"
                          onClick={() => handlePresetSelect(amt)}
                        >
                          Rp {new Intl.NumberFormat("id-ID").format(amt)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-medium">
                      Rp
                    </span>
                    <input
                      className={`w-full py-3 pl-11 pr-3 rounded-lg border bg-white text-on-surface font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow ${customAmount ? "border-2 border-primary" : "border-outline-variant"
                        }`}
                      placeholder="Atau masukkan jumlah lainnya (min. Rp 1.000)..."
                      type="text"
                      inputMode="numeric"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
                    * Minimal donasi adalah Rp 1.000
                  </p>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface-variant mb-2 font-medium text-gray-700">
                    Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("qris")}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${paymentMethod === "qris"
                        ? "border-2 border-primary bg-indigo-50/50 shadow-sm"
                        : "border-outline-variant hover:border-gray-300"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900">QRIS Instant</span>
                        <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">
                          0% Fee
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        BCA, GoPay, OVO, ShopeePay, DANA & Semua Bank
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-left flex flex-col gap-1 opacity-50 cursor-not-allowed select-none"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-500">Midtrans Gateway</span>
                        <span className="text-[10px] bg-gray-200 text-gray-600 font-medium px-1.5 py-0.5 rounded">
                          Nonaktif
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        Virtual Account & Kartu Kredit
                      </span>
                    </button>
                  </div>
                </div>

                {/* Sender Name */}
                <div>
                  <label
                    className="block font-label-sm text-label-sm text-on-surface-variant mb-2 font-medium text-gray-700"
                    htmlFor="senderName"
                  >
                    Nama Donatur (Opsional)
                  </label>
                  <input
                    className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-white text-on-surface font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
                    id="senderName"
                    placeholder="Anonim"
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                  />
                </div>

                {/* Message */}
                <div>
                  <label
                    className="block font-label-sm text-label-sm text-on-surface-variant mb-2 font-medium text-gray-700"
                    htmlFor="message"
                  >
                    Pesan Dukungan (Opsional)
                  </label>
                  <textarea
                    className="w-full p-4 rounded-lg border border-outline-variant bg-white text-on-surface font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow resize-none"
                    id="message"
                    placeholder="Tuliskan pesan yang akan dibacakan oleh TTS di livestream..."
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                {/* Media Share */}
                <div className="p-4 rounded-lg bg-gray-50 border border-outline-variant">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      play_circle
                    </span>
                    <label
                      className="block font-label-sm text-label-sm text-on-surface font-medium"
                      htmlFor="mediaUrl"
                    >
                      Sematkan Media Share (YouTube Video URL)
                    </label>
                  </div>
                  <input
                    className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-white text-on-surface font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
                    id="mediaUrl"
                    placeholder="https://www.youtube.com/watch?v=..."
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                </div>

                {/* Submit Action */}
                <button
                  style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
                  disabled={isLoading}
                  className="w-full bg-primary text-white py-4 rounded-xl font-label-sm text-label-sm font-semibold hover:bg-indigo-600 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99]"
                  type="submit"
                >
                  {isLoading ? (
                    <span>Memproses...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">
                        favorite
                      </span>
                      Lanjutkan Donasi Rp {currentDisplayAmount} (QRIS)
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* QRIS Interactive Payment Modal */}
      <QrisModal
        isOpen={isQrisModalOpen}
        onClose={() => setIsQrisModalOpen(false)}
        orderData={qrisOrderData}
        onSuccess={resetForm}
      />
    </>
  );
}
