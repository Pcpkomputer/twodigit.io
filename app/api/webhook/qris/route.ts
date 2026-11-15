import { NextRequest, NextResponse } from "next/server";
import { parseNotificationAmount, settleQrisTransaction } from "@/lib/qris";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Secret Key if configured in environment
    const configuredSecret = process.env.QRIS_WEBHOOK_SECRET;
    if (configuredSecret) {
      const headerKey = request.headers.get("x-api-key") || request.headers.get("authorization");
      const urlSecret = request.nextUrl.searchParams.get("secret");
      
      const isAuthorized =
        headerKey === configuredSecret ||
        headerKey === `Bearer ${configuredSecret}` ||
        urlSecret === configuredSecret;

      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized webhook access" }, { status: 401 });
      }
    }

    // 2. Parse payload (supports JSON or raw text)
    let payload: any;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const rawText = await request.text();
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = { text: rawText };
      }
    }

    console.log("Received Android Notification webhook payload:", payload);

    // 3. Extract amount
    const amount = parseNotificationAmount(payload);

    if (!amount) {
      return NextResponse.json({
        status: "ignored",
        message: "No monetary amount detected in notification",
        payload,
      });
    }

    // 4. Settle matching transaction
    const result = await settleQrisTransaction(amount, payload);

    return NextResponse.json({
      status: result.success ? "success" : "unmatched",
      amount,
      ...result,
    });
  } catch (error: any) {
    console.error("QRIS webhook error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "QRIS Android Notification Listener Webhook endpoint is active",
  });
}
