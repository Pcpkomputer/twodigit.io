import { pusherServer } from "@/lib/pusher";

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

// In-memory settings attached to globalThis
const globalStore = globalThis as unknown as {
  __tiktokSettings?: TikTokEventSettings;
};

if (!globalStore.__tiktokSettings) {
  globalStore.__tiktokSettings = {
    enableJoin: true,
    enableChat: true,
    enableGift: true,
    enableFollow: true,
    enableShare: true,
    enableTts: true,
  };
}

export function getTikTokSettings(): TikTokEventSettings {
  return globalStore.__tiktokSettings!;
}

export function updateTikTokSettings(
  partial: Partial<TikTokEventSettings>
): TikTokEventSettings {
  globalStore.__tiktokSettings = {
    ...globalStore.__tiktokSettings!,
    ...partial,
  };
  return globalStore.__tiktokSettings;
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
        speechText: `Halo ${cleanName}, selamat datang di live stream!`,
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
        priority: 3,
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
