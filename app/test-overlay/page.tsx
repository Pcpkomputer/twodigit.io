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

interface ChatHistoryItem {
  id: string;
  sender: string;
  badge: string;
  message: string;
  timestamp: string;
}

export default function TestOverlayPage() {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<"donation" | "chat">("chat");

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Donation Form state
  const [donorName, setDonorName] = useState<string>("Donatur Tester");
  const [amount, setAmount] = useState<number>(50000);
  const [customAmountStr, setCustomAmountStr] = useState<string>("50.000");
  const [message, setMessage] = useState<string>("Semangat live streamingnya bro! Sukses selalu!");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [saveToDatabase, setSaveToDatabase] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Interactive Chat state
  const [chatSender, setChatSender] = useState<string>("Streamer");
  const [chatBadge, setChatBadge] = useState<string>("🎙️ Host");
  const [chatMessage, setChatMessage] = useState<string>("");
  const [chatPosition, setChatPosition] = useState<string>("bottom-left");
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);

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
        toast.success("Login berhasil! Selamat datang di konsol overlay.");
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

  // Donation Amount Handlers
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

  // Interactive Chat Handler
  const sendInteractiveChat = async (customMessage?: string, customSender?: string, customBadge?: string) => {
    const msgToSend = (customMessage ?? chatMessage).trim();
    if (!msgToSend) {
      toast.warning("Tulis pesan chat terlebih dahulu.");
      return;
    }

    const senderToSend = (customSender ?? chatSender).trim() || "Streamer";
    const badgeToSend = (customBadge ?? chatBadge).trim() || "🎙️ Host";

    setIsSendingChat(true);
    try {
      const res = await fetch("/api/interactive-chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: senderToSend,
          badge: badgeToSend,
          message: msgToSend,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Pesan terkirim ke overlay! Suara TTS sedang diputar.");
        if (!customMessage) {
          setChatMessage("");
        }

        const historyItem: ChatHistoryItem = {
          id: data.chat?.id || `chat-${Date.now()}`,
          sender: senderToSend,
          badge: badgeToSend,
          message: msgToSend,
          timestamp: new Date().toLocaleTimeString("id-ID"),
        };
        setChatHistory((prev) => [historyItem, ...prev.slice(0, 9)]);
      } else {
        toast.error(data.error || "Gagal mengirim pesan ke overlay.");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi saat mengirim chat.");
    } finally {
      setIsSendingChat(false);
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
            <h1 className="text-xl font-bold text-gray-900">Admin Overlay Console</h1>
            <p className="text-sm text-gray-500 mt-1">
              Masukkan password untuk mengelola test donasi dan interaksi chat TTS di livestreaming.
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
            <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-lg">
              💬
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">Streamer Live Console</h1>
              <p className="text-[11px] text-gray-500 font-medium">Interactive Chat TTS & Test Overlay</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold rounded-lg">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Connected
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

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === "chat"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
            <span>💬 Interactive Chat & TTS (Live)</span>
          </button>

          <button
            onClick={() => setActiveTab("donation")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === "donation"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">payments</span>
            <span>💰 Test Donasi Alert</span>
          </button>
        </div>

        {/* Browser Source Links Card */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">tv</span>
              Tautan Browser Source untuk TikTok Live Studio / OBS
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Interactive Chat Overlay Card */}
            <div className={`p-3.5 rounded-xl border shadow-sm flex flex-col justify-between gap-2 ${
              activeTab === "chat" ? "bg-indigo-50/50 border-primary/50" : "bg-white border-gray-200"
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-900 flex items-center gap-1">
                    <span>💬 Chat & TTS</span>
                    <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.2 rounded font-black">
                      NEW
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-500">Bubble chat streamer + suara TTS</p>
                </div>
                <span className="text-[10px] bg-yellow-100 text-yellow-800 font-bold px-1.5 py-0.5 rounded">
                  /overlay/chat
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-200/60">
                <a
                  href={`/overlay/chat?pos=${chatPosition}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard(`/overlay/chat?pos=${chatPosition}`, "Chat TTS Overlay")}
                  className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                >
                  Salin
                </button>
              </div>
            </div>

            {/* Alert Overlay */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-900">📢 Donasi Alert</h3>
                  <p className="text-[11px] text-gray-500">Popup alert, nominal & TTS</p>
                </div>
                <span className="text-[10px] bg-indigo-50 text-primary font-bold px-1.5 py-0.5 rounded">
                  /overlay
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
                <a
                  href="/overlay"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard("/overlay", "Donasi Alert")}
                  className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                >
                  Salin
                </button>
              </div>
            </div>

            {/* Top Donors */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-900">🏆 Top Donatur</h3>
                  <p className="text-[11px] text-gray-500">Leaderboard ranking donatur</p>
                </div>
                <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                  /top-donors
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
                <a
                  href="/overlay/top-donors"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard("/overlay/top-donors", "Top Donors")}
                  className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                >
                  Salin
                </button>
              </div>
            </div>

            {/* Milestone */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-900">🎯 Milestone Target</h3>
                  <p className="text-[11px] text-gray-500">Progress bar target donasi</p>
                </div>
                <span className="text-[10px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded">
                  /milestone
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
                <a
                  href="/overlay/milestone"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard("/overlay/milestone", "Milestone")}
                  className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                >
                  Salin
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* TAB 1: INTERACTIVE CHAT & TTS (LIVE) */}
        {activeTab === "chat" && (
          <div className="flex flex-col gap-6">
            {/* Quick 1-Click Streamer Shouts */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">touch_app</span>
                Template Chat Cepat (1-Klik Langsung Bicara di Live)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {[
                  {
                    icon: "👋",
                    label: "Sapa Penonton",
                    text: "Halo teman-teman! Selamat datang di live streaming hari ini!",
                  },
                  {
                    icon: "❤️",
                    label: "Ajakan Tap-Tap Layar",
                    text: "Jangan lupa bantu tap tap layarnya ya teman-teman! Target kita 50k likes!",
                  },
                  {
                    icon: "✨",
                    label: "Follow & Share",
                    text: "Yuk follow dan share live ini ke teman-teman kalian biar makin ramai!",
                  },
                  {
                    icon: "🎁",
                    label: "Terima Kasih Support",
                    text: "Terima kasih banyak atas gift dan dukungannya guys! Berkah selalu!",
                  },
                  {
                    icon: "❓",
                    label: "Buka Sesi Tanya Jawab",
                    text: "Silakan tanyakan apa saja di kolom komentar, kita bahas bareng-bareng!",
                  },
                  {
                    icon: "☕",
                    label: "Istirahat Minum 1 Menit",
                    text: "Bentar ya teman-teman, streamer izin minum dulu satu menit!",
                  },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    disabled={isSendingChat}
                    onClick={() => sendInteractiveChat(item.text, chatSender, chatBadge)}
                    className="p-3 bg-white hover:bg-yellow-50/50 rounded-xl border border-gray-200 hover:border-yellow-400 text-left transition shadow-sm group disabled:opacity-50 flex items-start gap-2.5"
                  >
                    <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-gray-900 group-hover:text-yellow-700 transition">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-gray-500 line-clamp-1 italic">
                        &ldquo;{item.text}&rdquo;
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Chat Input & Live Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Chat Composer */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          chat_bubble
                        </span>
                        Tulis Pesan untuk Overlay & TTS
                      </h2>
                      <p className="text-xs text-gray-500">
                        Ketik teks apa pun, pesan akan muncul di layar streaming dan disuarakan oleh TTS.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendInteractiveChat();
                    }}
                    className="flex flex-col gap-4"
                  >
                    {/* Role & Sender Name Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Role / Badge
                        </label>
                        <div className="flex gap-1.5 flex-wrap">
                          {["🎙️ Host", "📢 Info", "👑 VIP", "💬 Chat"].map((badge) => (
                            <button
                              type="button"
                              key={badge}
                              onClick={() => setChatBadge(badge)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                                chatBadge === badge
                                  ? "bg-yellow-400 text-black border-yellow-500 shadow-xs"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              {badge}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Nama Pengirim
                        </label>
                        <input
                          type="text"
                          value={chatSender}
                          onChange={(e) => setChatSender(e.target.value)}
                          placeholder="Contoh: Streamer / Host"
                          className="w-full h-9 px-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-xs font-semibold"
                        />
                      </div>
                    </div>

                    {/* Message Box */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-gray-700">
                          Pesan Chat (Akan disuarakan & ditampilkan)
                        </label>
                        <span className="text-[11px] text-gray-400">Tekan Enter atau klik Kirim</span>
                      </div>
                      <textarea
                        rows={3}
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendInteractiveChat();
                          }
                        }}
                        placeholder="Ketik pesan yang ingin ditampilkan dan disuarakan di live streaming..."
                        className="w-full p-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm leading-relaxed"
                      />
                    </div>

                    {/* Position selector for URL */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-gray-700">
                        <span className="material-symbols-outlined text-[18px] text-gray-500">
                          place
                        </span>
                        <span>Posisi Muncul di Layar:</span>
                      </div>
                      <select
                        value={chatPosition}
                        onChange={(e) => setChatPosition(e.target.value)}
                        className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold outline-none focus:border-primary"
                      >
                        <option value="bottom-left">Kiri Bawah (Default)</option>
                        <option value="bottom-center">Tengah Bawah</option>
                        <option value="top-left">Kiri Atas</option>
                        <option value="top-center">Tengah Atas</option>
                      </select>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSendingChat}
                      className="w-full h-12 bg-primary hover:bg-indigo-600 active:scale-[0.99] text-white rounded-xl font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                    >
                      {isSendingChat ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Mengirim ke Overlay & TTS...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[20px]">
                            record_voice_over
                          </span>
                          <span>Kirim & Bicara di Live (TTS)</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Chat Activity & Tips */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {/* Chat History Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-gray-500">
                        history
                      </span>
                      Riwayat Chat Terkirim
                    </h3>
                    {chatHistory.length > 0 && (
                      <button
                        onClick={() => setChatHistory([])}
                        className="text-[11px] text-gray-400 hover:text-gray-600"
                      >
                        Hapus
                      </button>
                    )}
                  </div>

                  {chatHistory.length === 0 ? (
                    <div className="py-8 text-center text-gray-400">
                      <span className="material-symbols-outlined text-[36px] text-gray-300 mb-1">
                        forum
                      </span>
                      <p className="text-xs">Belum ada chat yang dikirim.</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Ketik pesan atau klik template cepat di atas.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {chatHistory.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-gray-900">
                              <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-black text-[10px] font-black">
                                {item.badge}
                              </span>
                              <span>{item.sender}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">{item.timestamp}</span>
                          </div>
                          <p className="text-gray-700 font-medium italic break-words">
                            &ldquo;{item.message}&rdquo;
                          </p>
                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => sendInteractiveChat(item.message, item.sender, item.badge)}
                              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">replay</span>
                              Kirim Ulang
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Setup Card */}
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border border-yellow-200 p-5 text-xs text-amber-950">
                  <h4 className="font-bold mb-2 flex items-center gap-1.5 text-amber-900 text-sm">
                    <span className="material-symbols-outlined text-[18px]">live_tv</span>
                    Cara Pasang di TikTok Live Studio
                  </h4>
                  <ol className="space-y-1.5 list-decimal list-inside text-amber-900">
                    <li>
                      Buka TikTok Live Studio &rarr; klik <strong>Add Source</strong> &rarr; pilih{" "}
                      <strong>Link / Browser Source</strong>.
                    </li>
                    <li>
                      Masukkan URL: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">
                        http://.../overlay/chat
                      </code>
                    </li>
                    <li>
                      Centang <strong>Control audio via software</strong> agar suara TTS masuk langsung ke live.
                    </li>
                    <li>
                      Latar belakang otomatis <strong>transparan 100%</strong> dan siap menerima pesan!
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DONATION ALERT TEST */}
        {activeTab === "donation" && (
          <div className="flex flex-col gap-6">
            {/* 1-Click Fast Test Scenarios */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                Preset Uji Coba Cepat Donasi Alert (1-Klik)
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
                    Kirim Notifikasi Donasi Kustom
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
                          <strong>Milestone</strong> ikut bertambah nilainya.
                        </span>
                      </label>
                    </div>

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

              {/* Right Column: Donation Test History */}
              <div className="lg:col-span-5 flex flex-col gap-6">
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
                      <p className="text-xs">Belum ada test donasi yang dikirim pada sesi ini.</p>
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
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
