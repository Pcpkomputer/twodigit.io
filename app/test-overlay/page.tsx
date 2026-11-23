"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Pusher from "pusher-js";
import { SFX_CATALOG } from "@/lib/sfx";
import { TikTokEventSettings, TikTokEventType } from "@/lib/tiktok-events";

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

export default function TestOverlayPage() {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<"chat" | "poll" | "sfx" | "donation" | "tiktok-events">("poll");
  const [isTriggeringSfx, setIsTriggeringSfx] = useState<string | null>(null);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // TikTok Live Events state
  const [tiktokSettings, setTiktokSettings] = useState<TikTokEventSettings>({
    enableJoin: true,
    enableChat: true,
    enableGift: true,
    enableFollow: true,
    enableShare: true,
    enableTts: true,
  });
  const [isUpdatingSettings, setIsUpdatingSettings] = useState<boolean>(false);
  const [eventsPosition, setEventsPosition] = useState<string>("bottom-left");

  // Simulation state for TikTok Events
  const [simEventType, setSimEventType] = useState<TikTokEventType>("join");
  const [simUniqueId, setSimUniqueId] = useState<string>("budi_gaming");
  const [simNickname, setSimNickname] = useState<string>("Budi Gaming");
  const [simMessage, setSimMessage] = useState<string>("Halo bang, mantap live streamnya!");
  const [simGiftName, setSimGiftName] = useState<string>("Mawar");
  const [simGiftCount, setSimGiftCount] = useState<number>(5);
  const [isSimulatingEvent, setIsSimulatingEvent] = useState<boolean>(false);

  // Bundle All-in-One Super Overlay Layout Configurator State
  const [bundleAlertPos, setBundleAlertPos] = useState<string>("center");
  const [bundleEventsPos, setBundleEventsPos] = useState<string>("bottom-left");
  const [bundleChatPos, setBundleChatPos] = useState<string>("bottom-left");
  const [bundleSfxPos, setBundleSfxPos] = useState<string>("bottom-right");
  const [bundlePollPos, setBundlePollPos] = useState<string>("top-left");
  const [bundleScale, setBundleScale] = useState<string>("0.75");
  const [bundleModules, setBundleModules] = useState<{
    alert: boolean;
    events: boolean;
    chat: boolean;
    sfx: boolean;
    poll: boolean;
  }>({
    alert: true,
    events: true,
    chat: true,
    sfx: true,
    poll: true,
  });

  const getBundleUrl = (preview = false) => {
    const activeMods = Object.entries(bundleModules)
      .filter(([_, enabled]) => enabled)
      .map(([mod]) => mod)
      .join(",");

    const params = new URLSearchParams({
      alertPos: bundleAlertPos,
      eventsPos: bundleEventsPos,
      chatPos: bundleChatPos,
      sfxPos: bundleSfxPos,
      pollPos: bundlePollPos,
      scale: bundleScale,
      modules: activeMods || "none",
    });

    if (preview) {
      params.set("preview", "1");
    }

    return `/overlay/bundle?${params.toString()}`;
  };

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
  const [chatVoice, setChatVoice] = useState<string>("schoolgirl");
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);

  // Poll state
  const [poll, setPoll] = useState<PollState | null>(null);
  const [pollTitle, setPollTitle] = useState<string>("Hero Apa di Game Berikutnya?");
  const [pollOptions, setPollOptions] = useState<string[]>(["Layla", "Miya"]);
  const [pollPosition, setPollPosition] = useState<string>("bottom-left");
  const [isCreatingPoll, setIsCreatingPoll] = useState<boolean>(false);
  const [isActingOnPoll, setIsActingOnPoll] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [playSfxLocally, setPlaySfxLocally] = useState<boolean>(false);

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

  // Fetch active poll when authenticated
  const fetchActivePoll = async () => {
    try {
      const res = await fetch("/api/poll/active");
      if (res.ok) {
        const data = await res.json();
        setPoll(data.active ? data.poll : null);
      }
    } catch (e) {
      console.error("Failed to fetch poll:", e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchActivePoll();
      fetchTikTokSettings();

      // Realtime Pusher subscription for live poll updates
      const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
      const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";
      if (!pusherKey) return;

      const pusher = new Pusher(pusherKey, { cluster });
      const channel = pusher.subscribe("donation-stream");

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

      return () => {
        channel.unbind_all();
        channel.unsubscribe();
        pusher.disconnect();
      };
    }
  }, [isAuthenticated]);

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
          voice: chatVoice,
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

  // Poll Management Handlers
  const handleAddPollOption = () => {
    if (pollOptions.length >= 5) {
      toast.warning("Maksimal 5 opsi pilihan voting.");
      return;
    }
    setPollOptions([...pollOptions, `Opsi ${pollOptions.length + 1}`]);
  };

  const handleRemovePollOption = (idx: number) => {
    if (pollOptions.length <= 2) {
      toast.warning("Minimal 2 opsi pilihan voting.");
      return;
    }
    setPollOptions(pollOptions.filter((_, i) => i !== idx));
  };

  const handlePollOptionChange = (idx: number, val: string) => {
    const clone = [...pollOptions];
    clone[idx] = val;
    setPollOptions(clone);
  };

  const handleStartPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = pollTitle.trim();
    if (!cleanTitle) {
      toast.warning("Judul voting tidak boleh kosong.");
      return;
    }

    const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      toast.warning("Minimal 2 opsi pilihan harus diisi.");
      return;
    }

    setIsCreatingPoll(true);
    try {
      const res = await fetch("/api/poll/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle, options: cleanOptions }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPoll(data.poll);
        toast.success("Voting live berhasil dimulai di overlay!");
      } else {
        toast.error(data.error || "Gagal membuat voting.");
      }
    } catch {
      toast.error("Gagal terhubung ke server untuk membuat voting.");
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleSimulateVote = async (optionIndex: number) => {
    setIsActingOnPoll(true);
    try {
      const res = await fetch("/api/poll/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionIndex,
          userId: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          nickname: "Simulated Tester",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPoll(data.poll);
        toast.success(`+1 Vote terkirim untuk Opsi [!${optionIndex}]!`);
      } else {
        toast.error(data.error || "Gagal mengirim vote simulasi.");
      }
    } catch {
      toast.error("Gagal mengirim vote.");
    } finally {
      setIsActingOnPoll(false);
    }
  };

  const handleEndPoll = async () => {
    setIsActingOnPoll(true);
    try {
      const res = await fetch("/api/poll/end", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setPoll(data.poll);
        toast.success("Voting selesai! Pemenang telah ditentukan.");
      } else {
        toast.error(data.error || "Gagal mengakhiri voting.");
      }
    } catch {
      toast.error("Gagal mengakhiri voting.");
    } finally {
      setIsActingOnPoll(false);
    }
  };

  const handleResetPoll = async () => {
    if (!confirm("Apakah Anda yakin ingin mereset voting? Layar voting di overlay akan ditutup.")) {
      return;
    }
    setIsActingOnPoll(true);
    try {
      const res = await fetch("/api/poll/end?action=reset", { method: "POST" });
      if (res.ok) {
        setPoll(null);
        toast.info("Voting di-reset. Anda dapat membuat voting baru.");
      }
    } catch {
      toast.error("Gagal mereset voting.");
    } finally {
      setIsActingOnPoll(false);
    }
  };

  const handleTriggerSfx = async (sfxId: string) => {
    setIsTriggeringSfx(sfxId);
    try {
      const res = await fetch("/api/sfx/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sfxId,
          sender: "Streamer Host",
          nickname: "Host Tester",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`🔊 ${data.message}`);
        // Only play locally in this tab if explicitly enabled (prevents double audio with OBS overlay)
        if (playSfxLocally) {
          const matched = SFX_CATALOG.find((s) => s.id === sfxId);
          if (matched) {
            const audio = new Audio(matched.url);
            audio.volume = 0.8;
            audio.play().catch(() => {});
          }
        }
      } else {
        toast.error(data.error || "Gagal memicu SFX.");
      }
    } catch {
      toast.error("Gagal menghubungi server SFX.");
    } finally {
      setIsTriggeringSfx(null);
    }
  };

  const copyToClipboard = (urlPath: string, label: string) => {
    const fullUrl = `${window.location.origin}${urlPath}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success(`URL ${label} berhasil disalin!`);
  };

  // TikTok Live Events Handlers
  const fetchTikTokSettings = async () => {
    try {
      const res = await fetch("/api/tiktok-events");
      const data = await res.json();
      if (res.ok && data.settings) {
        setTiktokSettings(data.settings);
      }
    } catch (err) {
      console.error("Failed to fetch TikTok settings", err);
    }
  };

  const handleToggleSetting = async (key: keyof TikTokEventSettings) => {
    const updatedVal = !tiktokSettings[key];
    const newSettings = { ...tiktokSettings, [key]: updatedVal };
    setTiktokSettings(newSettings);
    setIsUpdatingSettings(true);
    try {
      const res = await fetch("/api/tiktok-events", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: updatedVal }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Pengaturan '${key}' berhasil diperbarui!`);
      } else {
        toast.error(data.error || "Gagal mengubah pengaturan.");
        setTiktokSettings(tiktokSettings);
      }
    } catch {
      toast.error("Gagal terhubung ke server.");
      setTiktokSettings(tiktokSettings);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleTriggerEventSim = async (
    type: TikTokEventType,
    customPayload?: Partial<{
      nickname: string;
      uniqueId: string;
      message: string;
      giftName: string;
      giftCount: number;
    }>
  ) => {
    setIsSimulatingEvent(true);
    try {
      const payload = {
        eventType: type,
        uniqueId: customPayload?.uniqueId || simUniqueId || "tester",
        nickname: customPayload?.nickname || simNickname || "Tester Live",
        message: customPayload?.message !== undefined ? customPayload.message : (type === "chat" ? simMessage : undefined),
        giftName: customPayload?.giftName !== undefined ? customPayload.giftName : (type === "gift" ? simGiftName : undefined),
        giftCount: customPayload?.giftCount !== undefined ? customPayload.giftCount : (type === "gift" ? simGiftCount : undefined),
      };

      const res = await fetch("/api/tiktok-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.ignored) {
          toast.warning(`Event '${type}' diabaikan: ${data.reason}`);
        } else {
          toast.success(`✨ Event '${type}' terkirim ke overlay!`);
        }
      } else {
        toast.error(data.error || "Gagal mengirim event simulasi.");
      }
    } catch {
      toast.error("Gagal terhubung ke server.");
    } finally {
      setIsSimulatingEvent(false);
    }
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
              Masukkan password untuk mengelola live voting, chat TTS, dan donasi alert.
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
              ⚡
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">Streamer Live Console</h1>
              <p className="text-[11px] text-gray-500 font-medium">Live Voting, Chat TTS & Test Overlay</p>
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
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab("tiktok-events")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition shrink-0 ${
              activeTab === "tiktok-events"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">waving_hand</span>
            <span>✨ TikTok Events (Sapaan & Hadiah)</span>
          </button>

          <button
            onClick={() => setActiveTab("poll")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition shrink-0 ${
              activeTab === "poll"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">poll</span>
            <span>📊 Live Voting (TikTok Poll)</span>
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition shrink-0 ${
              activeTab === "chat"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
            <span>💬 Interactive Chat & TTS</span>
          </button>

          <button
            onClick={() => setActiveTab("sfx")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition shrink-0 ${
              activeTab === "sfx"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">volume_up</span>
            <span>🔊 Meme SFX (Soundboard)</span>
          </button>

          <button
            onClick={() => setActiveTab("donation")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition shrink-0 ${
              activeTab === "donation"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">payments</span>
            <span>💰 Test Donasi Alert</span>
          </button>
        </div>

        {/* All-in-One Super Overlay Section (Recommended for Anti-Lag & Smooth PS5 Stream) */}
        <section className="mb-8">
          <div className="bg-gradient-to-br from-indigo-950 via-gray-900 to-black rounded-2xl border-2 border-indigo-500/40 p-5 sm:p-6 text-white shadow-xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-sm">
                    ⭐ Solusi Utama Anti-Lag &amp; Bebas Stutter Capture Card
                  </span>
                  <span className="text-[11px] text-green-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    Hemat RAM 85%
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <span>All-in-One Super Overlay</span>
                  <span className="text-xs font-mono bg-white/10 text-indigo-300 px-2 py-0.5 rounded-md border border-white/10">
                    /overlay/bundle
                  </span>
                </h2>
                <p className="text-xs text-gray-300 mt-1 max-w-2xl">
                  Cukup pasang <strong>1 Browser Source saja</strong> di TikTok Live Studio untuk Donasi, TTS Sapaan/Chat, SFX Meme, dan Live Poll. Laptop dingin, RAM enteng, dan video capture card PS5 100% mulus tanpa freeze atau fast-forward 2x!
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={getBundleUrl(true)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Buka Preview ↗</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard(getBundleUrl(false), "All-in-One Super Overlay")}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-indigo-600 text-xs font-bold text-white transition shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  <span>Salin URL Bundle</span>
                </button>
              </div>
            </div>

            {/* Layout Arranger & Interactive Preview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Position Dropdowns & Module Toggles */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-yellow-400">dashboard_customize</span>
                    Atur Posisi Masing-Masing Widget di Layar
                  </h3>
                  <span className="text-[11px] text-gray-400">Posisi bebas, tidak saling tumpuk</span>
                </div>

                {/* Resolution & Scale Setting */}
                <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">aspect_ratio</span>
                      Resolusi Layar Live &amp; Skala Ukuran Overlay
                    </label>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Pilih skala yang pas dengan kanvas TikTok Live Studio agar tidak kebesaran.
                    </p>
                  </div>
                  <select
                    value={bundleScale}
                    onChange={(e) => setBundleScale(e.target.value)}
                    className="w-full sm:w-auto h-9 px-3 rounded-lg bg-gray-900 border border-indigo-400/40 text-xs font-semibold text-yellow-400 outline-none focus:border-yellow-400 cursor-pointer"
                  >
                    <option value="0.75">1280x720 (720p HD) - Skala 75% ⭐ Pas untuk Live PS5</option>
                    <option value="0.70">1280x720 (Compact) - Skala 70%</option>
                    <option value="0.65">1280x720 (Mini) - Skala 65%</option>
                    <option value="0.85">Resolusi Sedang - Skala 85%</option>
                    <option value="1.0">1920x1080 (1080p FHD) - Skala 100% Penuh</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Alert Position */}
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-yellow-400 flex items-center justify-between">
                      <span>📢 Donasi Alert</span>
                      <input
                        type="checkbox"
                        checked={bundleModules.alert}
                        onChange={(e) => setBundleModules({ ...bundleModules, alert: e.target.checked })}
                        className="rounded border-gray-600 text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                    </label>
                    <select
                      value={bundleAlertPos}
                      disabled={!bundleModules.alert}
                      onChange={(e) => setBundleAlertPos(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-gray-900 border border-white/15 text-xs text-white outline-none focus:border-yellow-400 disabled:opacity-40"
                    >
                      <option value="center">Tengah Layar (Standar - Rekomendasi)</option>
                      <option value="top-center">Atas Tengah</option>
                      <option value="bottom-center">Bawah Tengah</option>
                      <option value="top-left">Kiri Atas</option>
                      <option value="top-right">Kanan Atas</option>
                      <option value="bottom-left">Kiri Bawah</option>
                      <option value="bottom-right">Kanan Bawah</option>
                    </select>
                  </div>

                  {/* Events Position */}
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-pink-400 flex items-center justify-between">
                      <span>✨ TikTok Events (Sapaan/TTS)</span>
                      <input
                        type="checkbox"
                        checked={bundleModules.events}
                        onChange={(e) => setBundleModules({ ...bundleModules, events: e.target.checked })}
                        className="rounded border-gray-600 text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                    </label>
                    <select
                      value={bundleEventsPos}
                      disabled={!bundleModules.events}
                      onChange={(e) => setBundleEventsPos(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-gray-900 border border-white/15 text-xs text-white outline-none focus:border-pink-400 disabled:opacity-40"
                    >
                      <option value="bottom-left">Kiri Bawah (Standar - Rekomendasi)</option>
                      <option value="bottom-right">Kanan Bawah</option>
                      <option value="top-center">Atas Tengah</option>
                      <option value="bottom-center">Bawah Tengah</option>
                      <option value="top-left">Kiri Atas</option>
                      <option value="top-right">Kanan Atas</option>
                      <option value="center">Tengah Layar</option>
                    </select>
                  </div>

                  {/* Host Interactive Chat Position */}
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                      <span>🎙️ Chat Streamer / Host</span>
                      <input
                        type="checkbox"
                        checked={bundleModules.chat}
                        onChange={(e) => setBundleModules({ ...bundleModules, chat: e.target.checked })}
                        className="rounded border-gray-600 text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                    </label>
                    <select
                      value={bundleChatPos}
                      disabled={!bundleModules.chat}
                      onChange={(e) => setBundleChatPos(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-gray-900 border border-white/15 text-xs text-white outline-none focus:border-emerald-400 disabled:opacity-40"
                    >
                      <option value="bottom-left">Kiri Bawah (Standar - Rekomendasi)</option>
                      <option value="bottom-right">Kanan Bawah</option>
                      <option value="top-center">Atas Tengah</option>
                      <option value="bottom-center">Bawah Tengah</option>
                      <option value="top-left">Kiri Atas</option>
                      <option value="top-right">Kanan Atas</option>
                      <option value="center">Tengah Layar</option>
                    </select>
                  </div>

                  {/* SFX Position */}
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-amber-400 flex items-center justify-between">
                      <span>🔊 Meme SFX Toast</span>
                      <input
                        type="checkbox"
                        checked={bundleModules.sfx}
                        onChange={(e) => setBundleModules({ ...bundleModules, sfx: e.target.checked })}
                        className="rounded border-gray-600 text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                    </label>
                    <select
                      value={bundleSfxPos}
                      disabled={!bundleModules.sfx}
                      onChange={(e) => setBundleSfxPos(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-gray-900 border border-white/15 text-xs text-white outline-none focus:border-amber-400 disabled:opacity-40"
                    >
                      <option value="bottom-right">Kanan Bawah (Standar - Rekomendasi)</option>
                      <option value="bottom-left">Kiri Bawah</option>
                      <option value="top-center">Atas Tengah</option>
                      <option value="bottom-center">Bawah Tengah</option>
                      <option value="top-right">Kanan Atas</option>
                      <option value="top-left">Kiri Atas</option>
                      <option value="center">Tengah Layar</option>
                    </select>
                  </div>

                  {/* Poll Position */}
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-cyan-400 flex items-center justify-between">
                      <span>📊 Live Voting Poll</span>
                      <input
                        type="checkbox"
                        checked={bundleModules.poll}
                        onChange={(e) => setBundleModules({ ...bundleModules, poll: e.target.checked })}
                        className="rounded border-gray-600 text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                    </label>
                    <select
                      value={bundlePollPos}
                      disabled={!bundleModules.poll}
                      onChange={(e) => setBundlePollPos(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-gray-900 border border-white/15 text-xs text-white outline-none focus:border-cyan-400 disabled:opacity-40"
                    >
                      <option value="top-left">Kiri Atas (Standar - Rekomendasi)</option>
                      <option value="top-right">Kanan Atas</option>
                      <option value="top-center">Atas Tengah</option>
                      <option value="bottom-center">Bawah Tengah</option>
                      <option value="bottom-left">Kiri Bawah</option>
                      <option value="bottom-right">Kanan Bawah</option>
                      <option value="center">Tengah Layar</option>
                    </select>
                  </div>
                </div>

                {/* Generated URL Bar */}
                <div className="p-3 bg-gray-950/80 rounded-xl border border-white/10 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-gray-400 shrink-0">URL:</span>
                  <input
                    type="text"
                    readOnly
                    value={
                      typeof window !== "undefined"
                        ? `${window.location.origin}${getBundleUrl(false)}`
                        : getBundleUrl(false)
                    }
                    className="flex-1 bg-transparent border-0 text-[11px] font-mono text-green-400 select-all outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(getBundleUrl(false), "All-in-One Super Overlay")}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg transition shrink-0"
                  >
                    Salin
                  </button>
                </div>
              </div>

              {/* Right Column: Visual Mini Screen Preview */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-indigo-400">preview</span>
                    Simulasi Tata Letak Layar (16:9)
                  </h3>
                  <span className="text-[10px] text-gray-400">Live Preview Posisi</span>
                </div>

                {/* Mini 16:9 Monitor Frame */}
                <div className="aspect-video w-full bg-gray-950 rounded-xl border-2 border-white/15 relative overflow-hidden flex items-center justify-center p-2 shadow-inner">
                  {/* Subtle Grid Watermark */}
                  <span className="text-[10px] text-gray-700 font-mono select-none pointer-events-none uppercase tracking-wider">
                    Kanvas Live 1280x720 / 1080p (Skala {Math.round(parseFloat(bundleScale) * 100)}%)
                  </span>

                  {/* Mini Alert Chip */}
                  {bundleModules.alert && (
                    <span
                      className={`absolute px-2 py-0.5 bg-yellow-400 text-black font-black text-[9px] rounded-md shadow-md transition-all duration-300 pointer-events-none ${
                        bundleAlertPos === "center"
                          ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                          : bundleAlertPos === "top-center"
                          ? "top-2 left-1/2 -translate-x-1/2"
                          : bundleAlertPos === "bottom-center"
                          ? "bottom-2 left-1/2 -translate-x-1/2"
                          : bundleAlertPos === "top-left"
                          ? "top-2 left-2"
                          : bundleAlertPos === "top-right"
                          ? "top-2 right-2"
                          : bundleAlertPos === "bottom-right"
                          ? "bottom-2 right-2"
                          : "bottom-2 left-2"
                      }`}
                    >
                      📢 Alert
                    </span>
                  )}

                  {/* Mini Events Chip */}
                  {bundleModules.events && (
                    <span
                      className={`absolute px-2 py-0.5 bg-pink-500 text-white font-black text-[9px] rounded-md shadow-md transition-all duration-300 pointer-events-none ${
                        bundleEventsPos === "bottom-left"
                          ? "bottom-2 left-2"
                          : bundleEventsPos === "bottom-right"
                          ? "bottom-2 right-2"
                          : bundleEventsPos === "top-left"
                          ? "top-2 left-2"
                          : bundleEventsPos === "top-right"
                          ? "top-2 right-2"
                          : bundleEventsPos === "top-center"
                          ? "top-2 left-1/2 -translate-x-1/2"
                          : bundleEventsPos === "bottom-center"
                          ? "bottom-2 left-1/2 -translate-x-1/2"
                          : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      }`}
                    >
                      💬 Sapaan &amp; Event
                    </span>
                  )}

                  {/* Mini Host Chat Chip */}
                  {bundleModules.chat && (
                    <span
                      className={`absolute px-2 py-0.5 bg-emerald-500 text-white font-black text-[9px] rounded-md shadow-md transition-all duration-300 pointer-events-none ${
                        bundleChatPos === "bottom-left"
                          ? "bottom-7 left-2"
                          : bundleChatPos === "bottom-right"
                          ? "bottom-7 right-2"
                          : bundleChatPos === "top-left"
                          ? "top-7 left-2"
                          : bundleChatPos === "top-right"
                          ? "top-7 right-2"
                          : bundleChatPos === "top-center"
                          ? "top-7 left-1/2 -translate-x-1/2"
                          : bundleChatPos === "bottom-center"
                          ? "bottom-7 left-1/2 -translate-x-1/2"
                          : "top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2"
                      }`}
                    >
                      🎙️ Host Chat
                    </span>
                  )}

                  {/* Mini SFX Chip */}
                  {bundleModules.sfx && (
                    <span
                      className={`absolute px-2 py-0.5 bg-amber-500 text-black font-black text-[9px] rounded-md shadow-md transition-all duration-300 pointer-events-none ${
                        bundleSfxPos === "bottom-right"
                          ? "bottom-2 right-2"
                          : bundleSfxPos === "bottom-left"
                          ? "bottom-2 left-2"
                          : bundleSfxPos === "top-right"
                          ? "top-2 right-2"
                          : bundleSfxPos === "top-left"
                          ? "top-2 left-2"
                          : bundleSfxPos === "top-center"
                          ? "top-2 left-1/2 -translate-x-1/2"
                          : bundleSfxPos === "bottom-center"
                          ? "bottom-2 left-1/2 -translate-x-1/2"
                          : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      }`}
                    >
                      🔊 SFX
                    </span>
                  )}

                  {/* Mini Poll Chip */}
                  {bundleModules.poll && (
                    <span
                      className={`absolute px-2 py-0.5 bg-cyan-500 text-black font-black text-[9px] rounded-md shadow-md transition-all duration-300 pointer-events-none ${
                        bundlePollPos === "top-left"
                          ? "top-2 left-2"
                          : bundlePollPos === "top-right"
                          ? "top-2 right-2"
                          : bundlePollPos === "top-center"
                          ? "top-2 left-1/2 -translate-x-1/2"
                          : bundlePollPos === "bottom-center"
                          ? "bottom-2 left-1/2 -translate-x-1/2"
                          : bundlePollPos === "bottom-left"
                          ? "bottom-2 left-2"
                          : bundlePollPos === "bottom-right"
                          ? "bottom-2 right-2"
                          : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      }`}
                    >
                      📊 Voting
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-300 space-y-1">
                  <div>
                    <strong className="text-white">💡 Tips TikTok Live Studio (1280x720):</strong> Tambahkan 1 Browser Source dengan URL di atas. Set resolusi <strong>Width: 1280, Height: 720</strong> (atau 1920x1080 jika streaming FHD).
                  </div>
                  <div className="text-indigo-300">
                    Skala otomatis menyesuaikan <strong>75%</strong> sehingga proporsional dan tidak menutupi gameplay PS5!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary: Individual Browser Source Links (For modular scene setups) */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">layers</span>
              Opsi Cadangan: Tautan Overlay Individual (Jika ingin dipasang terpisah per scene)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {/* TikTok Events Overlay Card */}
            <div
              className={`p-3.5 rounded-xl border shadow-sm flex flex-col justify-between gap-2 ${
                activeTab === "tiktok-events" ? "bg-indigo-50/50 border-primary/50" : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-900 flex items-center gap-1">
                    <span>✨ Live Events</span>
                    <span className="text-[10px] bg-pink-500 text-white px-1.5 py-0.2 rounded font-black">
                      TTS
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-500">Sapa join, chat, gift, follow</p>
                </div>
                <span className="text-[10px] bg-pink-100 text-pink-800 font-bold px-1.5 py-0.5 rounded">
                  /overlay/events
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-200/60">
                <a
                  href={`/overlay/events?pos=${eventsPosition}&preview=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard(`/overlay/events?pos=${eventsPosition}`, "Live Events")}
                  className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                >
                  Salin
                </button>
              </div>
            </div>
            {/* Live Voting Card */}
            <div
              className={`p-3.5 rounded-xl border shadow-sm flex flex-col justify-between gap-2 ${
                activeTab === "poll" ? "bg-indigo-50/50 border-primary/50" : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-900 flex items-center gap-1">
                    <span>📊 Live Voting</span>
                    <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.2 rounded font-black">
                      POLL
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-500">Live vote via komentar !1 / !2</p>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                  /overlay/poll
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-200/60">
                <a
                  href={`/overlay/poll?pos=${pollPosition}&preview=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard(`/overlay/poll?pos=${pollPosition}`, "Live Voting")}
                  className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                >
                  Salin
                </button>
              </div>
            </div>

            {/* Meme SFX Overlay Card */}
            <div
              className={`p-3.5 rounded-xl border shadow-sm flex flex-col justify-between gap-2 ${
                activeTab === "sfx" ? "bg-indigo-50/50 border-primary/50" : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-900 flex items-center gap-1">
                    <span>🔊 Meme SFX</span>
                    <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.2 rounded font-black">
                      SFX
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-500">Efek suara meme live chat</p>
                </div>
                <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                  /overlay/sfx
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-200/60">
                <a
                  href="/overlay/sfx?preview=1"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
                >
                  Preview ↗
                </a>
                <button
                  onClick={() => copyToClipboard("/overlay/sfx", "Meme SFX")}
                  className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition"
                >
                  Salin
                </button>
              </div>
            </div>

            {/* Interactive Chat Overlay Card */}
            <div
              className={`p-3.5 rounded-xl border shadow-sm flex flex-col justify-between gap-2 ${
                activeTab === "chat" ? "bg-indigo-50/50 border-primary/50" : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-900 flex items-center gap-1">
                    <span>💬 Chat & TTS</span>
                  </h3>
                  <p className="text-[11px] text-gray-500">Bubble chat streamer + TTS</p>
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
                  onClick={() => copyToClipboard(`/overlay/chat?pos=${chatPosition}`, "Chat TTS")}
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
                  <p className="text-[11px] text-gray-500">Leaderboard donasi</p>
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
                  <p className="text-[11px] text-gray-500">Progress bar donasi</p>
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

        {/* TAB 1: LIVE VOTING (TIKTOK POLL) */}
        {activeTab === "poll" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Poll Creator or Live Poll Dashboard */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {poll && Array.isArray(poll.options) && poll.options.length > 0 ? (
                  /* Active Poll Dashboard */
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">
                            {poll.status === "active" ? "Live Voting Berlangsung" : "Voting Selesai"}
                          </span>
                          <span className="text-xs text-gray-400">Total: {poll.totalVotes} suara</span>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{poll.title}</h2>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {poll.status === "active" ? (
                          <button
                            onClick={handleEndPoll}
                            disabled={isActingOnPoll}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">flag</span>
                            Selesaikan Voting
                          </button>
                        ) : (
                          <button
                            onClick={handleResetPoll}
                            disabled={isActingOnPoll}
                            className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs shadow-sm transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                            Buat Voting Baru
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Live Options & Progress */}
                    <div className="flex flex-col gap-3 mb-6">
                      {poll.options?.map((opt) => (
                        <div key={opt.index} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 font-bold text-gray-900">
                              <span className="px-2 py-0.5 rounded-lg bg-primary text-white text-xs font-black">
                                !{opt.index}
                              </span>
                              <span>
                                {poll.status === "ended" && poll.winner?.index === opt.index && "👑 "}
                                {opt.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 font-semibold">{opt.votes} vote</span>
                              <span className="text-sm font-black text-primary">{opt.percentage}%</span>
                            </div>
                          </div>

                          {/* Progress Track */}
                          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(opt.percentage, opt.votes > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Interactive Vote Simulators */}
                    {poll.status === "active" && (
                      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                        <p className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                          Simulasi Vote Manual (Uji Coba Animasi Overlay):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {poll.options?.map((opt) => (
                            <button
                              key={opt.index}
                              disabled={isActingOnPoll}
                              onClick={() => handleSimulateVote(opt.index)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 hover:bg-blue-100/50 text-blue-800 text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
                            >
                              <span>+1 Vote</span>
                              <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[10px]">
                                !{opt.index}
                              </span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Poll Creator Form */
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="mb-5">
                      <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">add_chart</span>
                        Buat Sesi Live Voting Baru
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Penonton dapat memilih opsi voting dengan mengetik <strong>!1</strong> atau <strong>!2</strong> di kolom komentar TikTok Live.
                      </p>
                    </div>

                    {/* Preset Templates */}
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Template Cepat:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { title: "Main Hero Apa di Game Berikutnya?", opts: ["Layla", "Miya", "Alucard"] },
                          { title: "Lanjut Main Game atau Ngobrol Santai?", opts: ["Lanjut Game", "Ngobrol Santai"] },
                          { title: "Rekomendasi Menu Makan Malam?", opts: ["Nasi Goreng", "Ayam Geprek", "Mie Instan"] },
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setPollTitle(preset.title);
                              setPollOptions(preset.opts);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 border border-gray-200 transition"
                          >
                            {preset.title.slice(0, 32)}...
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleStartPoll} className="flex flex-col gap-4">
                      {/* Poll Title */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Pertanyaan / Judul Voting
                        </label>
                        <input
                          type="text"
                          value={pollTitle}
                          onChange={(e) => setPollTitle(e.target.value)}
                          placeholder="Contoh: Pilih hero game berikutnya..."
                          className="w-full h-11 px-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-semibold"
                        />
                      </div>

                      {/* Options Input List */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-gray-700">
                            Daftar Pilihan Opsi
                          </label>
                          <span className="text-[11px] text-gray-400">Minimal 2, maksimal 5 opsi</span>
                        </div>

                        <div className="flex flex-col gap-2">
                          {pollOptions.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-10 h-10 shrink-0 bg-primary/10 text-primary font-black text-xs rounded-xl flex items-center justify-center border border-primary/20">
                                !{idx + 1}
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                                placeholder={`Opsi pilihan ${idx + 1}...`}
                                className="flex-1 h-10 px-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-xs font-semibold"
                              />
                              {pollOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePollOption(idx)}
                                  className="w-10 h-10 shrink-0 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-600 transition flex items-center justify-center"
                                  title="Hapus opsi ini"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {pollOptions.length < 5 && (
                          <button
                            type="button"
                            onClick={handleAddPollOption}
                            className="mt-2 text-xs font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            Tambah Opsi Pilihan
                          </button>
                        )}
                      </div>

                      {/* Position Selector */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-gray-700">
                          <span className="material-symbols-outlined text-[18px] text-gray-500">place</span>
                          <span>Posisi Muncul di Layar:</span>
                        </div>
                        <select
                          value={pollPosition}
                          onChange={(e) => setPollPosition(e.target.value)}
                          className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold outline-none focus:border-primary"
                        >
                          <option value="bottom-left">Kiri Bawah (Default)</option>
                          <option value="bottom-center">Tengah Bawah</option>
                          <option value="top-left">Kiri Atas</option>
                          <option value="top-center">Tengah Atas</option>
                        </select>
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={isCreatingPoll}
                        className="w-full h-12 bg-primary hover:bg-indigo-600 active:scale-[0.99] text-white rounded-xl font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg mt-2"
                      >
                        {isCreatingPoll ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Memulai Voting...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                            <span>Mulai Voting Live di Overlay</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Right Column: Setup Guide & TikTok Listener Helper */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5 text-xs text-blue-950">
                  <h4 className="font-bold mb-2 flex items-center gap-1.5 text-blue-900 text-sm">
                    <span className="material-symbols-outlined text-[18px]">sensors</span>
                    Menghubungkan Komentar TikTok Live
                  </h4>
                  <p className="text-blue-900 leading-relaxed mb-3">
                    Gunakan script local <strong>tiktok-listener</strong> untuk menangkap komentar penonton secara otomatis dan mengirimkannya ke sistem voting:
                  </p>
                  <ol className="space-y-2 list-decimal list-inside text-blue-900 font-medium">
                    <li>
                      Buka terminal di folder <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">twodigit.io/tiktok-listener</code>.
                    </li>
                    <li>
                      Jalankan <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">npm install</code> lalu <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">npm start</code>.
                    </li>
                    <li>
                      Saat penonton berkomentar <code className="bg-blue-200 px-1 rounded font-bold">!1</code> atau <code className="bg-blue-200 px-1 rounded font-bold">!2</code>, progress bar akan bertambah secara real-time!
                    </li>
                  </ol>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-xs text-gray-700">
                  <h4 className="font-bold mb-2 flex items-center gap-1.5 text-gray-900 text-sm">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Fitur Anti-Spam (1 Akun = 1 Vote)
                  </h4>
                  <p className="text-gray-600 leading-relaxed">
                    Sistem secara otomatis mengenali ID unik akun TikTok penonton. Jika penonton yang sama berkomentar <code className="bg-gray-100 px-1 rounded font-bold">!1</code> berkali-kali, hanya vote pertama yang dihitung untuk menjaga keadilan hasil voting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEME SFX SOUNDBOARD (LIVE CHAT TRIGGER) */}
        {activeTab === "sfx" && (
          <div className="flex flex-col gap-6">
            {/* Header info */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-yellow-400 text-black text-xs font-black uppercase tracking-wider">
                    FREEMIUM SFX
                  </span>
                  <span className="text-xs text-purple-200 font-semibold">
                    ⏱️ Global Cooldown: 30 Detik (Opsi 1)
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black">🔊 Meme SFX Soundboard</h2>
                <p className="text-xs md:text-sm text-purple-200 mt-1 max-w-2xl leading-relaxed">
                  Penonton dapat memicu efek suara lucu langsung di OBS dengan mengetik kata kunci di komentar TikTok Live.
                  Gunakan URL browser source <code className="bg-white/20 px-1.5 py-0.5 rounded text-white font-mono">/overlay/sfx</code> di TikTok Live Studio Anda.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="/overlay/sfx?preview=1"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition border border-white/20 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                  Preview Overlay
                </a>
                <button
                  onClick={() => copyToClipboard("/overlay/sfx", "Overlay SFX")}
                  className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs transition shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  Salin URL
                </button>
              </div>
            </div>

            {/* Soundboard Cards Grid */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">grid_view</span>
                  Katalog Efek Suara Meme Aktif
                </h3>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 shadow-xs transition select-none">
                  <input
                    type="checkbox"
                    checked={playSfxLocally}
                    onChange={(e) => setPlaySfxLocally(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>Dengar Preview di Tab Ini {playSfxLocally ? "(ON)" : "(Muted)"}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SFX_CATALOG.map((sfx) => (
                  <div
                    key={sfx.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between gap-4 hover:border-primary/40 hover:shadow-md transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-3xl p-2 rounded-xl bg-gray-50 border border-gray-100">
                          {sfx.emoji}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-yellow-100 text-yellow-900 border border-yellow-300 font-black text-xs font-mono">
                          {sfx.command}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">{sfx.name}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{sfx.description}</p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-400 font-mono">
                        Ketik: <strong className="text-gray-700">{sfx.command}</strong>
                      </span>
                      <button
                        onClick={() => handleTriggerSfx(sfx.id)}
                        disabled={isTriggeringSfx === sfx.id}
                        className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isTriggeringSfx === sfx.id ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Memutar...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                            <span>Uji Coba Suara</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Freemium & Architecture Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-xs text-gray-700">
                <h4 className="font-bold mb-2 flex items-center gap-1.5 text-gray-900 text-sm">
                  <span className="material-symbols-outlined text-[18px] text-primary">memory</span>
                  Cara Kerja Cooldown (Opsi 1: Local In-Memory)
                </h4>
                <p className="text-gray-600 leading-relaxed mb-2">
                  Timer cooldown 30 detik dihitung langsung di dalam script <code className="bg-gray-100 px-1 py-0.5 rounded font-mono font-bold">tiktok-listener</code> pada komputer lokal Anda.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li><strong>Global Cooldown (30s):</strong> Suara tidak akan tumpang tindih. Jika ada yang mencoba saat cooldown, request diabaikan di lokal tanpa membebani server Vercel.</li>
                  <li><strong>User Cooldown (45s):</strong> 1 penonton yang sama harus menunggu 45 detik agar penonton lain mendapat giliran.</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5 text-xs text-amber-950">
                <h4 className="font-bold mb-2 flex items-center gap-1.5 text-amber-900 text-sm">
                  <span className="material-symbols-outlined text-[18px]">monetization_on</span>
                  Strategi Pancingan Donasi (Freemium Hook)
                </h4>
                <p className="text-amber-900 leading-relaxed mb-2">
                  Setiap kali SFX gratis berbunyi, overlay di OBS menampilkan teks:
                  <br />
                  <em className="text-black font-semibold">&ldquo;Cooldown 30s | Mau bypass cooldown? Donasi di twodigit.io&rdquo;</em>
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Penonton yang ketagihan berinteraksi tetapi malas menunggu giliran cooldown akan terdorong untuk membuka <strong>twodigit.io</strong> dan berdonasi via QRIS!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INTERACTIVE CHAT & TTS (LIVE) */}
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
                        Ketik teks apa pun, pesan akan muncul di layar streaming dan disuarakan oleh TTS langsung tanpa prefix.
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
                          Pesan Chat (Disuarakan langsung oleh TTS)
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

                    {/* Voice Selector for TTS */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs">
                      <div>
                        <label className="font-bold text-indigo-950 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px] text-indigo-600">
                            record_voice_over
                          </span>
                          <span>Karakter Suara TTS:</span>
                        </label>
                        <p className="text-[11px] text-indigo-700/80 mt-0.5">
                          Pilihan suara untuk membacakan pesan interaktif di stream
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                          value={chatVoice}
                          onChange={(e) => setChatVoice(e.target.value)}
                          className="flex-1 sm:flex-initial bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800 outline-none focus:border-primary shadow-sm cursor-pointer"
                        >
                          <option value="schoolgirl">👧 Siswi SMP / Remaja (+20% Pitch Imut) ⭐</option>
                          <option value="anime">🌸 Cewek Anime / Imut Ceria (+30% Pitch)</option>
                          <option value="gadis">👩 Gadis Dewasa Natural (Microsoft Gadis)</option>
                          <option value="ardi">👨 Cowok Ardi Natural (Microsoft Ardi)</option>
                          <option value="google">🤖 Google Robot Klasik (Saweria)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const testAudio = new Audio(`/api/tts?text=${encodeURIComponent("Halo semua! Selamat datang di live streaming aku ya! Semangat selalu!")}&voice=${chatVoice}&t=${Date.now()}`);
                            testAudio.play().catch(() => {});
                          }}
                          title="Dengarkan Contoh Suara"
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shrink-0 flex items-center gap-1 shadow-sm transition"
                        >
                          <span>🔊</span>
                          <span>Tes Suara</span>
                        </button>
                      </div>
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
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DONATION ALERT TEST */}
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

        {/* TAB 5: TIKTOK LIVE EVENTS & TTS */}
        {activeTab === "tiktok-events" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Toggles & Simulators */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* Event Toggles Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
                        Pengaturan & Sakelar Live Event
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Kontrol jenis event TikTok apa saja yang direspons dan dibacakan oleh TTS
                      </p>
                    </div>
                    {isUpdatingSettings && (
                      <span className="text-xs text-primary font-semibold animate-pulse flex items-center gap-1">
                        <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        Menyimpan...
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {/* Toggle: Sapa Join */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 hover:bg-gray-100/50 transition">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">👋</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900">Sapaan Penonton Join Stream</span>
                            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                              Anti-Lag 6s
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Menyapa otomatis: <em>&ldquo;Halo [Nama], selamat datang di live stream!&rdquo;</em> (Deduplikasi per user)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSetting("enableJoin")}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                          tiktokSettings.enableJoin ? "bg-primary" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            tiktokSettings.enableJoin ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle: Bacakan Chat */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 hover:bg-gray-100/50 transition">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">💬</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900">Bacakan Komentar Chat</span>
                            <span className="px-1.5 py-0.2 bg-green-100 text-green-800 text-[10px] font-bold rounded">
                              TTS Natural
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Membacakan isi chat: <em>&ldquo;[Nama] berkata: [Komentar]&rdquo;</em> (Komentar vote &amp; SFX dipisah)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSetting("enableChat")}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                          tiktokSettings.enableChat ? "bg-primary" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            tiktokSettings.enableChat ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle: Notifikasi Gift */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 hover:bg-gray-100/50 transition">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">🎁</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900">Notifikasi Hadiah / Gift</span>
                            <span className="px-1.5 py-0.2 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded">
                              Prioritas Tinggi
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Mengumumkan apresiasi gift: <em>&ldquo;Terima kasih [Nama] sudah mengirim [Hadiah] x[Qty]!&rdquo;</em>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSetting("enableGift")}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                          tiktokSettings.enableGift ? "bg-primary" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            tiktokSettings.enableGift ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle: Follow */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 hover:bg-gray-100/50 transition">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">🔔</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900">Notifikasi Follow Baru</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Menyapa follower baru: <em>&ldquo;Terima kasih [Nama] sudah mem-follow stream ini!&rdquo;</em>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSetting("enableFollow")}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                          tiktokSettings.enableFollow ? "bg-primary" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            tiktokSettings.enableFollow ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle: Share */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 hover:bg-gray-100/50 transition">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">🚀</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900">Notifikasi Share Stream</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Mengapresiasi: <em>&ldquo;Terima kasih [Nama] sudah membagikan live ini!&rdquo;</em>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSetting("enableShare")}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                          tiktokSettings.enableShare ? "bg-primary" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            tiktokSettings.enableShare ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle: TTS Audio */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 hover:bg-indigo-50 transition">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">🔊</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900">Aktifkan Suara Audio TTS</span>
                            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                              Master Audio
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Jika dinonaktifkan, overlay hanya akan menampilkan kartu visual tanpa memutar suara TTS.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSetting("enableTts")}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                          tiktokSettings.enableTts ? "bg-primary" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            tiktokSettings.enableTts ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick 1-Click Simulation Buttons */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-primary">bolt</span>
                      Tes Cepat 1-Klik Simulasi Event
                    </h3>
                    <span className="text-[11px] text-gray-400">Klik untuk langsung trigger ke overlay</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleTriggerEventSim("join", {
                          nickname: "Budi Santoso",
                          uniqueId: "budi_santoso",
                        })
                      }
                      className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 active:scale-[0.98] text-left transition flex flex-col gap-1 cursor-pointer"
                    >
                      <span className="text-xl">👋</span>
                      <span className="font-bold text-xs text-gray-900">Tes Join Stream</span>
                      <span className="text-[10px] text-gray-500 truncate">Sapa &ldquo;Budi Santoso&rdquo;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleTriggerEventSim("chat", {
                          nickname: "Siti Rahma",
                          uniqueId: "siti_rahma",
                          message: "Halo bang, mantap banget gameplay-nya!",
                        })
                      }
                      className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-green-50 hover:border-green-300 active:scale-[0.98] text-left transition flex flex-col gap-1 cursor-pointer"
                    >
                      <span className="text-xl">💬</span>
                      <span className="font-bold text-xs text-gray-900">Tes Baca Chat</span>
                      <span className="text-[10px] text-gray-500 truncate">&ldquo;Halo bang, mantap...&rdquo;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleTriggerEventSim("gift", {
                          nickname: "Andi Wijaya",
                          uniqueId: "andi_w",
                          giftName: "Mawar",
                          giftCount: 5,
                        })
                      }
                      className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-yellow-50 hover:border-yellow-300 active:scale-[0.98] text-left transition flex flex-col gap-1 cursor-pointer"
                    >
                      <span className="text-xl">🌹</span>
                      <span className="font-bold text-xs text-gray-900">Tes Gift Mawar x5</span>
                      <span className="text-[10px] text-gray-500 truncate">Hadiah Mawar (5 buah)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleTriggerEventSim("gift", {
                          nickname: "Sultan Stream",
                          uniqueId: "sultan_stream",
                          giftName: "Ikan Paus",
                          giftCount: 1,
                        })
                      }
                      className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-amber-50 hover:border-amber-300 active:scale-[0.98] text-left transition flex flex-col gap-1 cursor-pointer"
                    >
                      <span className="text-xl">🪐</span>
                      <span className="font-bold text-xs text-gray-900">Tes Gift Paus x1</span>
                      <span className="text-[10px] text-gray-500 truncate">Hadiah Besar / Paus</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleTriggerEventSim("follow", {
                          nickname: "Rian Pratama",
                          uniqueId: "rian_p",
                        })
                      }
                      className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-purple-50 hover:border-purple-300 active:scale-[0.98] text-left transition flex flex-col gap-1 cursor-pointer"
                    >
                      <span className="text-xl">🔔</span>
                      <span className="font-bold text-xs text-gray-900">Tes Follow Baru</span>
                      <span className="text-[10px] text-gray-500 truncate">Follower baru</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleTriggerEventSim("share", {
                          nickname: "Dewi Lestari",
                          uniqueId: "dewi_l",
                        })
                      }
                      className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-pink-50 hover:border-pink-300 active:scale-[0.98] text-left transition flex flex-col gap-1 cursor-pointer"
                    >
                      <span className="text-xl">🚀</span>
                      <span className="font-bold text-xs text-gray-900">Tes Share Live</span>
                      <span className="text-[10px] text-gray-500 truncate">Bagikan link live</span>
                    </button>
                  </div>
                </div>

                {/* Custom Simulation Form */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5 mb-4">
                    <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
                    Simulasi Kustom (Nama &amp; Pesan Bebas)
                  </h3>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleTriggerEventSim(simEventType);
                    }}
                    className="flex flex-col gap-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Tipe Event
                        </label>
                        <select
                          value={simEventType}
                          onChange={(e) => setSimEventType(e.target.value as TikTokEventType)}
                          className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs font-semibold bg-white"
                        >
                          <option value="join">👋 Join Stream (Sapaan)</option>
                          <option value="chat">💬 Chat Komentar (TTS)</option>
                          <option value="gift">🎁 Gift Hadiah</option>
                          <option value="follow">🔔 Follow Baru</option>
                          <option value="share">🚀 Share Live Stream</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Nama Penonton (Nickname)
                        </label>
                        <input
                          type="text"
                          value={simNickname}
                          onChange={(e) => setSimNickname(e.target.value)}
                          placeholder="e.g. Budi Santoso"
                          className="w-full h-11 px-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs font-medium"
                          required
                        />
                      </div>
                    </div>

                    {simEventType === "chat" && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Isi Pesan Chat (Dibacakan oleh TTS)
                        </label>
                        <input
                          type="text"
                          value={simMessage}
                          onChange={(e) => setSimMessage(e.target.value)}
                          placeholder="Tulis pesan komentar..."
                          className="w-full h-11 px-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs font-medium"
                          required
                        />
                      </div>
                    )}

                    {simEventType === "gift" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Nama Hadiah / Gift
                          </label>
                          <input
                            type="text"
                            value={simGiftName}
                            onChange={(e) => setSimGiftName(e.target.value)}
                            placeholder="e.g. Mawar / Donat / Singa"
                            className="w-full h-11 px-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs font-medium"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Jumlah (Streak Count)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={simGiftCount}
                            onChange={(e) => setSimGiftCount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full h-11 px-3.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs font-medium"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSimulatingEvent}
                      className="w-full h-11 bg-primary hover:bg-indigo-600 text-white rounded-xl font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSimulatingEvent ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Mengirim Event ke Overlay...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">send</span>
                          <span>Kirim Event Simulasi Sekarang</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: OBS Setup & Architecture Instructions */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {/* OBS Setup Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[20px] text-primary">videocam</span>
                    Konfigurasi OBS / TikTok Studio
                  </h3>

                  <div className="flex flex-col gap-4 text-xs text-gray-600">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Posisi Tampilan di Layar
                      </label>
                      <select
                        value={eventsPosition}
                        onChange={(e) => setEventsPosition(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs font-semibold bg-white"
                      >
                        <option value="bottom-left">Kiri Bawah (Bottom Left - Rekomendasi)</option>
                        <option value="bottom-right">Kanan Bawah (Bottom Right)</option>
                        <option value="bottom-center">Tengah Bawah (Bottom Center)</option>
                        <option value="top-left">Kiri Atas (Top Left)</option>
                        <option value="top-right">Kanan Atas (Top Right)</option>
                      </select>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-700">URL Browser Source:</span>
                        <a
                          href={`/overlay/events?pos=${eventsPosition}&preview=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline font-bold"
                        >
                          Buka Preview ↗
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={
                            typeof window !== "undefined"
                              ? `${window.location.origin}/overlay/events?pos=${eventsPosition}`
                              : `/overlay/events?pos=${eventsPosition}`
                          }
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono select-all outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(`/overlay/events?pos=${eventsPosition}`, "Live Events")
                          }
                          className="px-3 py-1.5 bg-primary text-white font-bold text-xs rounded-lg hover:bg-indigo-600 transition shrink-0"
                        >
                          Salin
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                      <h4 className="font-bold text-amber-900 text-xs mb-1.5 flex items-center gap-1">
                        <span>💡 Rekomendasi Pengaturan Browser Source:</span>
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-amber-900/90 text-[11px]">
                        <li>
                          <strong>Lebar (Width):</strong> 450 px
                        </li>
                        <li>
                          <strong>Tinggi (Height):</strong> 500 px
                        </li>
                        <li>
                          <strong>FPS:</strong> 60 FPS
                        </li>
                        <li>
                          Centang <em>&ldquo;Control audio via OBS&rdquo;</em> jika ingin mengatur volume suara TTS langsung dari mixer OBS.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* TikTok Listener Background Worker Status */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[20px] text-green-600">terminal</span>
                    Menghubungkan ke Live TikTok
                  </h3>

                  <div className="flex flex-col gap-3 text-xs text-gray-600">
                    <p>
                      Agar live event TikTok otomatis terbaca, jalankan script listener di terminal Anda:
                    </p>

                    <div className="p-3 bg-gray-900 text-green-400 font-mono text-[11px] rounded-xl flex items-center justify-between">
                      <code>npm run tiktok @username_anda</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("npm run tiktok");
                          toast.success("Perintah disalin!");
                        }}
                        className="text-gray-400 hover:text-white text-[10px] font-sans px-2 py-0.5 rounded bg-gray-800"
                      >
                        Salin
                      </button>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex flex-col gap-1.5 text-[11px]">
                      <div className="flex items-center gap-1.5 font-semibold text-gray-800">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Filter Cerdas Otomatis:
                      </div>
                      <p className="text-gray-500 pl-3.5">
                        • Komentar berawalan <code>!1</code> atau <code>!2</code> diarahkan ke Live Poll.
                        <br />• Komentar meme seperti <code>!klakson</code> atau <code>!anjay</code> langsung membunyikan SFX.
                        <br />• Komentar biasa otomatis dibacakan oleh TTS ini.
                        <br />• Sapaan join dibatasi interval 6 detik agar tidak menumpuk saat penonton ramai.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
