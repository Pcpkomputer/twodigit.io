"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface TestHistoryItem {
  id: string;
  name: string;
  amount: number;
  message: string;
  mediaUrl?: string;
  savedToDatabase: boolean;
  timestamp: string;
}

export default function TestOverlayPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form state
  const [donorName, setDonorName] = useState<string>("Donatur Tester");
  const [amount, setAmount] = useState<number>(50000);
  const [customAmountStr, setCustomAmountStr] = useState<string>("50.000");
  const [message, setMessage] = useState<string>("Semangat live streamingnya bro! Sukses selalu!");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [saveToDatabase, setSaveToDatabase] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<TestHistoryItem[]>([]);

  // Check auth status on load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsCheckingAuth(true);
      const res = await fetch("/api/test-overlay/auth");
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      toast.warning("Masukkan password terlebih dahulu.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/test-overlay/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setPasswordInput("");
        toast.success("Login berhasil! Selamat datang di konsol test overlay.");
      } else {
        toast.error(data.error || "Password salah. Silakan coba lagi.");
      }
    } catch {
      toast.error("Gagal terhubung ke server.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/test-overlay/auth", { method: "DELETE" });
      setIsAuthenticated(false);
      toast.info("Anda telah keluar.");
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setCustomAmountStr("");
      setAmount(0);
      return;
    }
    const num = parseInt(rawValue, 10);
    setAmount(num);
    setCustomAmountStr(new Intl.NumberFormat("id-ID").format(num));
  };

  const handleSelectPresetNominal = (val: number) => {
    setAmount(val);
    setCustomAmountStr(new Intl.NumberFormat("id-ID").format(val));
  };

  const sendTestNotification = async (customPayload?: {
    name?: string;
    amount?: number;
    message?: string;
    mediaUrl?: string;
    saveToDatabase?: boolean;
  }) => {
    const payload = {
      name: customPayload?.name ?? donorName,
      amount: customPayload?.amount ?? amount,
      message: customPayload?.message ?? message,
      mediaUrl: customPayload?.mediaUrl ?? mediaUrl,
      saveToDatabase: customPayload?.saveToDatabase ?? saveToDatabase,
    };

    if (payload.amount <= 0) {
      toast.warning("Nominal donasi harus lebih dari 0.");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/test-overlay/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Notifikasi Rp ${new Intl.NumberFormat("id-ID").format(payload.amount)} terkirim ke overlay!`);

        // Add to history
        const historyItem: TestHistoryItem = {
          id: data.payload?.orderId || `test-${Date.now()}`,
          name: payload.name,
          amount: payload.amount,
          message: payload.message,
          mediaUrl: payload.mediaUrl,
          savedToDatabase: payload.saveToDatabase,
          timestamp: new Date().toLocaleTimeString("id-ID"),
        };
        setHistory((prev) => [historyItem, ...prev.slice(0, 9)]);
      } else {
        toast.error(data.error || "Gagal mengirim notifikasi test.");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan saat mengirim notifikasi.");
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = (urlPath: string, label: string) => {
    const fullUrl = `${window.location.origin}${urlPath}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success(`URL ${label} berhasil disalin!`);
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 font-medium">Memeriksa izin akses...</p>
        </div>
      </div>
    );
  }

  // Login view if unauthenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-outline-variant p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 bg-indigo-50 text-primary rounded-2xl flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[32px]">shield_person</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Admin Overlay Tester</h1>
            <p className="text-sm text-gray-500 mt-1">
              Masukkan password untuk mengakses konsol test notifikasi live streaming.
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Masukkan password admin..."
                  autoFocus
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-gray-900 placeholder:text-gray-400 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-12 bg-primary hover:bg-indigo-600 active:scale-[0.99] text-white rounded-xl font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:shadow"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">lock_open</span>
                  <span>Masuk ke Konsol</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <a
              href="/"
              className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Kembali ke Halaman Donasi
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Console
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold">
              ⚡
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">Overlay Test Console</h1>
              <p className="text-[11px] text-gray-500 font-medium">Uji Coba Notifikasi Tanpa Pembayaran</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold rounded-lg">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Admin Aktif
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Links to Live Overlays */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">tv</span>
              Tautan Browser Source Overlay
            </h2>
            <span className="text-xs text-gray-400">Buka di tab baru atau copy ke TikTok Live Studio / OBS</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Alert Overlay */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">📢 Alert Donasi + TTS</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Notifikasi popup, nama, pesan, & TTS</p>
                </div>
                <span className="text-[10px] bg-indigo-50 text-primary font-bold px-2 py-0.5 rounded">
                  /overlay
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <a
                  href="/overlay"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Buka Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard("/overlay", "Alert Overlay")}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                  title="Salin Link"
                >
                  Salin
                </button>
              </div>
            </div>

            {/* Top Donors Overlay */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">🏆 Top Donatur</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Leaderboard donasi terbanyak</p>
                </div>
                <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded">
                  /overlay/top-donors
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <a
                  href="/overlay/top-donors"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Buka Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard("/overlay/top-donors", "Top Donors Overlay")}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                  title="Salin Link"
                >
                  Salin
                </button>
              </div>
            </div>

            {/* Milestone Overlay */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">🎯 Milestone Target</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Progress bar target donasi livestream</p>
                </div>
                <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded">
                  /overlay/milestone
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <a
                  href="/overlay/milestone"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Buka Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard("/overlay/milestone", "Milestone Overlay")}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                  title="Salin Link"
                >
                  Salin
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 1-Click Fast Test Scenarios */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Preset Uji Coba Cepat (1-Klik Langsung Kirim)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              disabled={isSending}
              onClick={() =>
                sendTestNotification({
                  name: "Tester Cepat",
                  amount: 10000,
                  message: "Tes notifikasi overlay alert 10k berhasil!",
                  mediaUrl: "",
                })
              }
              className="p-3.5 bg-white hover:bg-indigo-50/50 rounded-xl border border-gray-200 hover:border-primary text-left transition shadow-sm group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">⚡</span>
                <span className="text-[11px] font-bold text-primary">Rp 10.000</span>
              </div>
              <p className="font-bold text-xs text-gray-900 group-hover:text-primary transition">
                Alert Standar
              </p>
              <p className="text-[11px] text-gray-400 truncate">Pesan singkat + suara TTS</p>
            </button>

            <button
              disabled={isSending}
              onClick={() =>
                sendTestNotification({
                  name: "Sultan Dermawan",
                  amount: 250000,
                  message: "Semangat live streamingnya bro, gaskeun kontennya!",
                  mediaUrl: "",
                  saveToDatabase: true,
                })
              }
              className="p-3.5 bg-white hover:bg-indigo-50/50 rounded-xl border border-gray-200 hover:border-primary text-left transition shadow-sm group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">👑</span>
                <span className="text-[11px] font-bold text-amber-600">Rp 250.000</span>
              </div>
              <p className="font-bold text-xs text-gray-900 group-hover:text-primary transition">
                Sultan + DB Save
              </p>
              <p className="text-[11px] text-gray-400 truncate">Masuk ke Top Donatur</p>
            </button>

            <button
              disabled={isSending}
              onClick={() =>
                sendTestNotification({
                  name: "Pencinta Musik",
                  amount: 50000,
                  message: "Titip lagu santai lofi ya bang!",
                  mediaUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
                })
              }
              className="p-3.5 bg-white hover:bg-indigo-50/50 rounded-xl border border-gray-200 hover:border-primary text-left transition shadow-sm group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">🎵</span>
                <span className="text-[11px] font-bold text-red-600">Media Share</span>
              </div>
              <p className="font-bold text-xs text-gray-900 group-hover:text-primary transition">
                Video YouTube
              </p>
              <p className="text-[11px] text-gray-400 truncate">Test player video otomatis</p>
            </button>

            <button
              disabled={isSending}
              onClick={() =>
                sendTestNotification({
                  name: "Budi Santoso",
                  amount: 100000,
                  message:
                    "Halo bang selamat sore salam dari Surabaya semoga sehat selalu sukses streamingnya dan lancar rezekinya ya bang terima kasih atas ilmunya!",
                  mediaUrl: "",
                })
              }
              className="p-3.5 bg-white hover:bg-indigo-50/50 rounded-xl border border-gray-200 hover:border-primary text-left transition shadow-sm group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">🗣️</span>
                <span className="text-[11px] font-bold text-indigo-600">TTS Panjang</span>
              </div>
              <p className="font-bold text-xs text-gray-900 group-hover:text-primary transition">
                Kalimat Panjang
              </p>
              <p className="text-[11px] text-gray-400 truncate">Test durasi baca TTS</p>
            </button>
          </div>
        </section>

        {/* Custom Test Notification Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
                Kirim Notifikasi Kustom
              </h2>
              <p className="text-xs text-gray-500 mb-5">
                Sesuaikan nama, jumlah uang, pesan TTS, dan video sesuka Anda.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendTestNotification();
                }}
                className="flex flex-col gap-4"
              >
                {/* Donor Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nama Donatur
                  </label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Contoh: Donatur Keren"
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-medium"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nominal Donasi (IDR)
                  </label>
                  <div className="relative mb-2">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-bold text-gray-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customAmountStr}
                      onChange={handleAmountChange}
                      placeholder="50.000"
                      className="w-full h-11 pl-11 pr-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-bold text-gray-900"
                    />
                  </div>

                  {/* Nominal Preset Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {[10000, 25000, 50000, 100000, 500000, 1000000].map((val) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => handleSelectPresetNominal(val)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                          amount === val
                            ? "bg-primary text-white border-primary"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        Rp {new Intl.NumberFormat("id-ID").format(val)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Pesan Suara (Dibacakan oleh TTS di Live)
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tulis pesan yang akan dibacakan oleh suara TTS..."
                    className="w-full p-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm resize-none"
                  />
                </div>

                {/* Media Share URL */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                    <span>YouTube Video URL (Opsional)</span>
                    <span className="text-[11px] text-gray-400 font-normal">Media Share</span>
                  </label>
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-medium"
                  />
                </div>

                {/* Save to Database Toggle */}
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="saveToDbCheckbox"
                    checked={saveToDatabase}
                    onChange={(e) => setSaveToDatabase(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="saveToDbCheckbox" className="text-xs text-gray-700 cursor-pointer select-none">
                    <span className="font-bold block text-gray-900">
                      Simpan ke Database Supabase (Permanen)
                    </span>
                    <span className="text-gray-500">
                      Centang ini jika Anda ingin leaderboard <strong>Top Donatur</strong> dan progress bar{" "}
                      <strong>Milestone</strong> ikut bertambah nilainya. Jika tidak dicentang, hanya popup
                      notifikasi alert yang muncul tanpa memodifikasi data leaderboard.
                    </span>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full h-12 mt-2 bg-primary hover:bg-indigo-600 active:scale-[0.99] text-white rounded-xl font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {isSending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Mengirim ke Overlay...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">send</span>
                      <span>Kirim Notifikasi Test Sekarang</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Test History & Info Sidebar */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Realtime History Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-gray-500">history</span>
                  Riwayat Test Terkirim
                </h3>
                {history.length > 0 && (
                  <button
                    onClick={() => setHistory([])}
                    className="text-[11px] text-gray-400 hover:text-gray-600"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <span className="material-symbols-outlined text-[36px] text-gray-300 mb-1">
                    notifications_paused
                  </span>
                  <p className="text-xs">Belum ada test yang dikirim pada sesi ini.</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Klik salah satu tombol preset di atas untuk mencoba.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">{item.name}</span>
                        <span className="font-black text-primary">
                          Rp {new Intl.NumberFormat("id-ID").format(item.amount)}
                        </span>
                      </div>
                      {item.message && (
                        <p className="text-gray-600 italic">&ldquo;{item.message}&rdquo;</p>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-[10px] text-gray-400">
                        <span>{item.timestamp}</span>
                        <span>{item.savedToDatabase ? "💾 Tersimpan di DB" : "📡 Broadcast Saja"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Helper Tips Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5 text-xs text-indigo-950">
              <h4 className="font-bold mb-2 flex items-center gap-1.5 text-indigo-900 text-sm">
                <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                Tips Uji Coba Overlay
              </h4>
              <ul className="space-y-2 text-indigo-800 list-disc list-inside">
                <li>
                  Buka tab <strong>Alert Overlay</strong> (/overlay) di samping halaman ini untuk langsung
                  melihat animasi dan mendengarkan suara TTS.
                </li>
                <li>
                  Untuk menguji <strong>Top Donatur</strong> dan <strong>Milestone</strong>, aktifkan centang{" "}
                  <strong>Simpan ke Database</strong> saat mengirim test.
                </li>
                <li>
                  Di TikTok Live Studio / OBS, Anda tidak perlu refresh browser source saat mengirim test;
                  notifikasi akan muncul secara otomatis dan realtime via Pusher.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
