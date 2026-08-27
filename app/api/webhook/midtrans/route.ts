import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { pusherServer } from "@/lib/pusher";

export async function POST(request: NextRequest) {
  try {
    const notification = await request.json();

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      custom_field1, // message
      custom_field2, // mediaUrl
      custom_field3, // name
      customer_details,
    } = notification;

    const serverKey = process.env.MIDTRANS_SERVER_KEY || "";

    // 1. Verify Midtrans SHA512 Signature Key: SHA512(order_id + status_code + gross_amount + ServerKey)
    const expectedSignature = crypto
      .createHash("sha512")
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest("hex");

    if (signature_key !== expectedSignature) {
      return NextResponse.json(
        { error: "Invalid signature key" },
        { status: 403 }
      );
    }

    // 2. Check if transaction is successful
    const isSettled =
      transaction_status === "settlement" ||
      (transaction_status === "capture" && fraud_status === "accept");

    if (isSettled) {
      const donorName =
        custom_field3 ||
        customer_details?.first_name ||
        customer_details?.customer_name ||
        "Anonim";

      const donationData = {
        orderId: order_id,
        amount: parseInt(String(gross_amount).split(".")[0], 10),
        name: donorName,
        message: custom_field1 || "",
        mediaUrl: custom_field2 || "",
        createdAt: new Date().toISOString(),
      };

      // 3. Trigger realtime event to Pusher channel for OBS Overlay
      await pusherServer.trigger("donation-stream", "new-donation", donationData);

      console.log("Broadcasted donation to Pusher:", donationData);
    }

    return NextResponse.json({
      status: "success",
      message: "Webhook processed",
      isSettled,
    });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
