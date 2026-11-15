import { supabaseAdmin } from "@/lib/supabase";
import { pusherServer } from "@/lib/pusher";

/**
 * Extracts a numeric payment amount (IDR) from various Android notification formats
 * Supports BCA, Mandiri, BRI, BNI, GoPay, OVO, Dana, ShopeePay, LinkAja, etc.
 */
export function parseNotificationAmount(payload: any): number | null {
  if (!payload) return null;

  // 1. Direct amount field (e.g., { amount: 50412 })
  if (typeof payload.amount === "number" && !isNaN(payload.amount) && payload.amount > 0) {
    return Math.round(payload.amount);
  }

  if (typeof payload.amount === "string" && payload.amount.trim()) {
    const parsed = parseInt(payload.amount.replace(/\D/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // 2. Search text in various string fields commonly used by notification listener apps
  const textToScan = [
    payload.title,
    payload.message,
    payload.body,
    payload.text,
    payload.content,
    payload.subText,
    payload.bigText,
    typeof payload === "string" ? payload : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!textToScan.trim()) return null;

  return extractAmountFromText(textToScan);
}

/**
 * Parses nominal from Indonesian bank/e-wallet notification strings
 * Examples:
 * - "Transfer dr ... Sebesar Rp 50.412 BERHASIL"
 * - "m-Transfer: Rp. 50.412,00 dr ..."
 * - "Pembayaran QRIS Rp 50.412 berhasil diterima"
 * - "Kamu menerima uang Rp50.412 dari ..."
 * - "Dana masuk Rp 100.250"
 */
export function extractAmountFromText(text: string): number | null {
  // Regex pattern matching: Rp/IDR/sebesar followed by numbers, dots, commas
  // Handles optional spaces, dot separators, and optional cents (,00 or .00)
  const regexPatterns = [
    /(?:rp\.?|idr|sebesar|nominal|total|masuk)\s*[:=]?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+)/i,
    /([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\s*(?:berhasil|sukses|masuk|diterima)/i,
  ];

  for (const regex of regexPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      let rawNum = match[1];

      // If ends with ,00 or .00 (cents), strip them
      if (/[,.]00$/.test(rawNum)) {
        rawNum = rawNum.slice(0, -3);
      }

      // Remove any dots, commas, or spaces
      const cleanNum = rawNum.replace(/\D/g, "");
      const parsed = parseInt(cleanNum, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Generates an available unique code between 1 and 999
 * ensuring no currently active 'pending' transaction collides with (baseAmount + uniqueCode)
 */
export async function generateUniqueCode(baseAmount: number): Promise<{ uniqueCode: number; totalAmount: number }> {
  const nowIso = new Date().toISOString();

  // Fetch all pending transactions that haven't expired yet
  const { data: pendingTxs } = await supabaseAdmin
    .from("qris_transactions")
    .select("total_amount, unique_code")
    .eq("status", "pending")
    .gt("expired_at", nowIso);

  const usedTotalAmounts = new Set<number>();
  if (pendingTxs) {
    pendingTxs.forEach((tx: any) => {
      usedTotalAmounts.add(Number(tx.total_amount));
    });
  }

  // Generate random candidate between 1 and 999
  // Try up to 50 random attempts first to keep code distributed
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidateCode = Math.floor(Math.random() * 999) + 1;
    const candidateTotal = baseAmount + candidateCode;
    if (!usedTotalAmounts.has(candidateTotal)) {
      return { uniqueCode: candidateCode, totalAmount: candidateTotal };
    }
  }

  // Fallback: Sequential search if random attempts collided
  for (let code = 1; code <= 999; code++) {
    const candidateTotal = baseAmount + code;
    if (!usedTotalAmounts.has(candidateTotal)) {
      return { uniqueCode: code, totalAmount: candidateTotal };
    }
  }

  // If 1-999 are all occupied (very high traffic), expand to 1000-9999
  const expandedCode = Math.floor(Math.random() * 8999) + 1000;
  return { uniqueCode: expandedCode, totalAmount: baseAmount + expandedCode };
}

/**
 * Settles a QRIS transaction by matching the received amount
 */
export async function settleQrisTransaction(amount: number, rawPayload: any) {
  const nowIso = new Date().toISOString();

  // Find the earliest matching pending transaction that hasn't expired
  const { data: matchedTx, error: findError } = await supabaseAdmin
    .from("qris_transactions")
    .select("*")
    .eq("status", "pending")
    .eq("total_amount", amount)
    .gt("expired_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error("Error looking up QRIS transaction:", findError);
    throw new Error("Failed to lookup QRIS transaction in database");
  }

  if (!matchedTx) {
    return {
      success: false,
      message: `No active pending QRIS transaction found for amount Rp ${amount}`,
    };
  }

  // Update QRIS transaction to settled
  const { error: updateError } = await supabaseAdmin
    .from("qris_transactions")
    .update({
      status: "settled",
      settled_at: nowIso,
      raw_notification: typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload),
    })
    .eq("id", matchedTx.id);

  if (updateError) {
    console.error("Failed to update QRIS transaction status:", updateError);
  }

  // Insert into main donations table for overlays, top donors, and milestones
  const donationData = {
    order_id: matchedTx.order_id,
    amount: Number(matchedTx.total_amount),
    donor_name: matchedTx.donor_name || "Anonim",
    message: matchedTx.message || "",
    media_url: matchedTx.media_url || "",
    created_at: nowIso,
  };

  const { error: insertError } = await supabaseAdmin.from("donations").insert(donationData);
  if (insertError) {
    console.error("Failed to record donation in donations table:", insertError);
  }

  // Trigger Pusher broadcast for OBS Overlay
  try {
    await pusherServer.trigger("donation-stream", "new-donation", {
      orderId: donationData.order_id,
      amount: donationData.amount,
      name: donationData.donor_name,
      message: donationData.message,
      mediaUrl: donationData.media_url,
      createdAt: donationData.created_at,
    });

    // Also trigger order-specific channel so frontend modal updates instantly
    await pusherServer.trigger(`order-${matchedTx.order_id}`, "payment-settled", {
      orderId: matchedTx.order_id,
      status: "settled",
      amount: donationData.amount,
    });
  } catch (pusherErr) {
    console.error("Failed to broadcast via Pusher:", pusherErr);
  }

  return {
    success: true,
    matchedOrder: matchedTx,
  };
}
