import { pusherServer } from "@/lib/pusher";
import { supabaseAdmin } from "@/lib/supabase";

export type TikTokEventType = "join" | "chat" | "gift" | "follow" | "share";

export interface TikTokEventPayload {
  id: string;
  eventType: TikTokEventType;
  uniqueId: string;
  nickname: string;
  message?: string;
  giftName?: string;
  giftCount?: number;
  diamondCount?: number;
  speechText: string;
  displayText: string;
  badgeEmoji: string;
  timestamp: string;
  priority: number; // 1 = highest (gift), 4 = lowest (join)
}

export interface TikTokEventSettings {
  enableJoin: boolean;
  enableChat: boolean;
  enableGift: boolean;
  enableFollow: boolean;
  enableShare: boolean;
  enableTts: boolean;
}

const DEFAULT_SETTINGS: TikTokEventSettings = {
  enableJoin: true,
  enableChat: true,
  enableGift: true,
  enableFollow: true,
  enableShare: true,
  enableTts: true,
};

// In-memory settings cache attached to globalThis
const globalStore = globalThis as unknown as {
  __tiktokSettings?: TikTokEventSettings;
  __tiktokSettingsCacheTime?: number;
};

if (!globalStore.__tiktokSettings) {
  globalStore.__tiktokSettings = { ...DEFAULT_SETTINGS };
  globalStore.__tiktokSettingsCacheTime = 0;
}

const CACHE_TTL_MS = 15000; // 15s cache to avoid querying Supabase on every single incoming event packet

export async function getTikTokSettings(): Promise<TikTokEventSettings> {
  const now = Date.now();
  // Return cached settings if still fresh within TTL
  if (
    globalStore.__tiktokSettings &&
    globalStore.__tiktokSettingsCacheTime &&
    now - globalStore.__tiktokSettingsCacheTime < CACHE_TTL_MS
  ) {
    return globalStore.__tiktokSettings;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("tiktok_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (!error && data) {
      globalStore.__tiktokSettings = {
        enableJoin: data.enable_join ?? true,
        enableChat: data.enable_chat ?? true,
        enableGift: data.enable_gift ?? true,
        enableFollow: data.enable_follow ?? true,
        enableShare: data.enable_share ?? true,
        enableTts: data.enable_tts ?? true,
      };
      globalStore.__tiktokSettingsCacheTime = now;
      return globalStore.__tiktokSettings;
    }
  } catch (err) {
    console.warn("Could not load tiktok_settings from Supabase, using fallback cache:", err);
  }

  // Graceful fallback to in-memory store
  return globalStore.__tiktokSettings || { ...DEFAULT_SETTINGS };
}

export async function updateTikTokSettings(
  partial: Partial<TikTokEventSettings>
): Promise<TikTokEventSettings> {
  const current = globalStore.__tiktokSettings || { ...DEFAULT_SETTINGS };
  const updated: TikTokEventSettings = {
    ...current,
    ...partial,
  };

  // Immediately update in-memory cache for zero-latency local lookups
  globalStore.__tiktokSettings = updated;
  globalStore.__tiktokSettingsCacheTime = Date.now();

  try {
    const { error } = await supabaseAdmin.from("tiktok_settings").upsert({
      id: "default",
      enable_join: updated.enableJoin,
      enable_chat: updated.enableChat,
      enable_gift: updated.enableGift,
      enable_follow: updated.enableFollow,
      enable_share: updated.enableShare,
      enable_tts: updated.enableTts,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("Warning: Failed to persist tiktok_settings to Supabase:", error.message);
    }
  } catch (err) {
    console.warn("Exception updating tiktok_settings in Supabase:", err);
  }

  return updated;
}

/**
 * Builds structured event payload and natural speech text
 */
export function formatTikTokEvent(data: {
  eventType: TikTokEventType;
  uniqueId: string;
  nickname?: string;
  message?: string;
  giftName?: string;
  giftCount?: number;
  diamondCount?: number;
}): TikTokEventPayload {
  const cleanId = (data.uniqueId || "viewer").replace(/^@/, "").trim();
  const cleanName = (data.nickname || cleanId).trim();
  const eventId = `ttevt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  switch (data.eventType) {
    case "join":
      return {
        id: eventId,
        eventType: "join",
        uniqueId: cleanId,
        nickname: cleanName,
        speechText: `Halo ${cleanName}, selamat datang!`,
        displayText: `${cleanName} bergabung ke stream!`,
        badgeEmoji: "👋",
        timestamp: nowIso,
        priority: 4,
      };

    case "chat": {
      const cleanMsg = (data.message || "").trim().slice(0, 100);
      return {
        id: eventId,
        eventType: "chat",
        uniqueId: cleanId,
        nickname: cleanName,
        message: cleanMsg,
        speechText: `${cleanName} berkata: ${cleanMsg}`,
        displayText: `"${cleanMsg}"`,
        badgeEmoji: "💬",
        timestamp: nowIso,
        priority: 2,
      };
    }

    case "gift": {
      const gName = (data.giftName || "Hadiah").trim();
      const gCount = Number(data.giftCount) || 1;
      return {
        id: eventId,
        eventType: "gift",
        uniqueId: cleanId,
        nickname: cleanName,
        giftName: gName,
        giftCount: gCount,
        diamondCount: data.diamondCount || 0,
        speechText: `Terima kasih banyak ${cleanName} sudah mengirim ${gCount > 1 ? `${gCount} ` : ""}${gName}!`,
        displayText: `${cleanName} mengirim ${gName} x${gCount}!`,
        badgeEmoji: "🎁",
        timestamp: nowIso,
        priority: 1,
      };
    }

    case "follow":
      return {
        id: eventId,
        eventType: "follow",
        uniqueId: cleanId,
        nickname: cleanName,
        speechText: `Terima kasih banyak sudah follow, ${cleanName}!`,
        displayText: `${cleanName} mulai mengikuti!`,
        badgeEmoji: "➕",
        timestamp: nowIso,
        priority: 2,
      };

    case "share":
      return {
        id: eventId,
        eventType: "share",
        uniqueId: cleanId,
        nickname: cleanName,
        speechText: `Terima kasih banyak sudah membagikan live stream ini, ${cleanName}!`,
        displayText: `${cleanName} membagikan live!`,
        badgeEmoji: "📢",
        timestamp: nowIso,
        priority: 2,
      };
  }
}

/**
 * Dispatches event to Pusher channel for the OBS Overlay
 */
export async function broadcastTikTokEvent(payload: TikTokEventPayload): Promise<void> {
  await pusherServer.trigger("donation-stream", "tiktok-live-event", payload);
}
