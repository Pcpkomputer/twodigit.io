import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { pusherServer } from "@/lib/pusher";
import { supabaseAdmin } from "@/lib/supabase";

const isAuthorized = (request: NextRequest) => {
  const sessionCookie = request.cookies.get("test_overlay_session")?.value;
  const configuredPassword = process.env.TEST_OVERLAY_PASSWORD || "p3rw1rapc";
  const expectedHash = crypto.createHash("sha256").update(configuredPassword).digest("hex");

  // Also support direct header authorization for external scripts/tools
  const authHeader = request.headers.get("x-test-password");
  if (authHeader && authHeader === configuredPassword) {
    return true;
  }

  return Boolean(sessionCookie && sessionCookie === expectedHash);
};

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name = "Donatur Tester",
      amount = 50000,
      message = "Ini adalah pesan tes notifikasi donasi live streaming!",
      mediaUrl = "",
      saveToDatabase = false,
    } = body;

    const numericAmount = Number(amount) || 10000;
    const donorName = (name || "Donatur Tester").trim();
    const donorMessage = (message || "").trim();
    const cleanMediaUrl = (mediaUrl || "").trim();
    const nowIso = new Date().toISOString();
    const orderId = `test-${Date.now()}`;

    // 1. If requested, save into Supabase donations table (so top-donors & milestone increment)
    if (saveToDatabase) {
      const { error: insertError } = await supabaseAdmin.from("donations").insert({
        order_id: orderId,
        amount: numericAmount,
        donor_name: donorName,
        message: donorMessage,
        media_url: cleanMediaUrl,
        created_at: nowIso,
      });

      if (insertError) {
        console.error("Failed to insert test donation into Supabase:", insertError);
        return NextResponse.json(
          { error: `Database insert failed: ${insertError.message}` },
          { status: 500 }
        );
      }
    }

    // 2. Broadcast via Pusher to 'donation-stream' channel
    const eventPayload = {
      orderId,
      amount: numericAmount,
      name: donorName,
      message: donorMessage,
      mediaUrl: cleanMediaUrl,
      createdAt: nowIso,
    };

    await pusherServer.trigger("donation-stream", "new-donation", eventPayload);

    return NextResponse.json({
      success: true,
      message: "Notifikasi test berhasil dikirim ke overlay!",
      payload: eventPayload,
      savedToDatabase: saveToDatabase,
    });
  } catch (error: any) {
    console.error("Test overlay error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
