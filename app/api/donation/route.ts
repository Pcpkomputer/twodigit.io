import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { amount, name, message, mediaUrl } = await request.json();

    const grossAmount = parseInt(String(amount), 10);
    if (isNaN(grossAmount) || grossAmount <= 0) {
      return NextResponse.json(
        { error: "Jumlah donasi tidak valid" },
        { status: 400 }
      );
    }

    const orderId = `DONATION-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const authHeader = Buffer.from(`${serverKey}:`).toString("base64");

    const endpoint = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: name?.trim() || "Anonim",
      },
      item_details: [
        {
          id: "DONATION_ITEM",
          price: grossAmount,
          quantity: 1,
          name: "Donasi Dukungan Kreator",
        },
      ],
      user_id: userId,
      gopay: {
        tokenization: true,
      },
      custom_field1: message || "",
      custom_field2: mediaUrl || "",
    };

    const midtransRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await midtransRes.json();

    if (!midtransRes.ok || !data.token) {
      return NextResponse.json(
        { error: data.error_messages?.join(", ") || "Gagal membuat transaksi Midtrans" },
        { status: midtransRes.status || 500 }
      );
    }

    return NextResponse.json({
      token: data.token,
      redirect_url: data.redirect_url,
      orderId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
