"use client";

import { useState } from "react";
import { toast } from "sonner";

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
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (numericAmount <= 0) {
      toast.warning("Silakan pilih atau masukkan jumlah donasi yang valid.");
      return;
    }

    setIsLoading(true);

    try {
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
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memproses donasi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* pt-[88px] to offset fixed nav */}
      {/* TopNavBar */}
      {/* Main Content Canvas */}
      <main style={{ display: "flex", justifyContent: "center", alignItems: "center" }} className="flex-grow max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-stack-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left Column: Hero & Donation Form */}
          <div className="lg:col-span-12 flex flex-col gap-stack-md">
            {/* Hero / Profile Card */}
            <div className="bg-white rounded-xl p-stack-md flex flex-col sm:flex-row items-center sm:items-start gap-stack-md border border-outline-variant relative overflow-hidden group">


              <div className="text-center sm:text-left flex-grow">
                <h1 className="font-headline-lg text-headline-lg md:font-headline-xl md:text-headline-xl text-on-surface mb-2">
                  {creatorTitle}
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-lg">
                  {creatorDescription}
                </p>
              </div>
            </div>
            {/* Main Donation Form */}
            <div className="bg-white rounded-xl p-stack-md border border-outline-variant">
              <form
                className="flex flex-col gap-stack-md"
                onSubmit={handleSubmit}
              >
                {/* Amount Selection */}
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface-variant mb-stack-sm">
                    Pilih Jumlah
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-stack-sm">
                    {[25000, 50000, 100000, 500000].map((amt) => {
                      const isSelected = selectedAmount === amt;
                      return (
                        <button
                          style={{ cursor: "pointer" }}
                          key={amt}
                          className={`py-3 rounded-lg border font-body-md text-body-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isSelected
                            ? "border-2 border-primary bg-indigo-50 text-primary font-medium"
                            : "border-outline-variant bg-white text-on-surface hover:border-primary"
                            }`}
                          type="button"
                          onClick={() => handlePresetSelect(amt)}
                        >
                          Rp. {new Intl.NumberFormat("id-ID").format(amt)}
                        </button>
                      );
                    })}
                    <div className="col-span-3 sm:col-span-1 relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-on-surface-variant">
                        Rp.
                      </span>
                      <input
                        className={`w-full py-3 pl-11 pr-3 rounded-lg border bg-white text-on-surface font-body-md text-body-md outline-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow h-full ${customAmount
                          ? "border-2 border-primary"
                          : "border-outline-variant"
                          }`}
                        placeholder="Jumlah Lain"
                        type="text"
                        inputMode="numeric"
                        value={customAmount}
                        onChange={handleCustomAmountChange}
                      />
                    </div>
                  </div>
                </div>
                {/* Sender Name */}
                <div>
                  <label
                    className="block font-label-sm text-label-sm text-on-surface-variant mb-2"
                    htmlFor="senderName"
                  >
                    Nama (Opsional)
                  </label>
                  <input
                    className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-white text-on-surface font-body-md text-body-md outline-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
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
                    className="block font-label-sm text-label-sm text-on-surface-variant mb-2"
                    htmlFor="message"
                  >
                    Pesan (Opsional)
                  </label>
                  <textarea
                    className="w-full p-4 rounded-lg border border-outline-variant bg-white text-on-surface font-body-md text-body-md outline-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow resize-none"
                    id="message"
                    placeholder="Kirim pesan untuk saya..."
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
                      className="block font-label-sm text-label-sm text-on-surface"
                      htmlFor="mediaUrl"
                    >
                      Sematkan Media (Youtube, Twitch, Video URL)
                    </label>
                  </div>
                  <input
                    className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-white text-on-surface font-body-md text-body-md outline-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
                    id="mediaUrl"
                    placeholder="https://..."
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                </div>
                {/* Submit Action */}
                <button
                  style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
                  disabled={isLoading}
                  className="w-full bg-primary text-white py-4 rounded-xl font-label-sm text-label-sm font-semibold hover:bg-indigo-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 transform duration-200"
                  type="submit"
                >
                  {isLoading ? (
                    <span>Memproses...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">
                        favorite
                      </span>
                      Donasi Rp. {currentDisplayAmount}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

        </div>
      </main>
      {/* Footer */}
    </>

  );
}

