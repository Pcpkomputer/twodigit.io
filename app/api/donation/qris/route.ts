import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateUniqueCode } from "@/lib/qris";

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

    // Generate unique numeric code (1 - 999) preventing collision
    const { uniqueCode, totalAmount } = await generateUniqueCode(grossAmount);

    const orderId = `QRIS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    // 15 minutes expiration window
    const expiredAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    const { error: dbError } = await supabaseAdmin.from("qris_transactions").insert({
      order_id: orderId,
      donor_name: name?.trim() || "Anonim",
      message: message || "",
      media_url: mediaUrl || "",
      base_amount: grossAmount,
      unique_code: uniqueCode,
      total_amount: totalAmount,
      status: "pending",
      expired_at: expiredAt,
      created_at: createdAt,
    });

    if (dbError) {
      console.error("Failed to insert QRIS transaction into Supabase:", dbError);
      return NextResponse.json(
        { error: "Gagal membuat transaksi QRIS di database. Pastikan tabel qris_transactions sudah dibuat." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId,
      donorName: name?.trim() || "Anonim",
      message: message || "",
      baseAmount: grossAmount,
      uniqueCode,
      totalAmount,
      expiredAt,
      qrisImageUrl: "/images/qris.jpg",
    });
  } catch (error: any) {
    console.error("QRIS creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
