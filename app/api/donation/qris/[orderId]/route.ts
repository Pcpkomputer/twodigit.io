import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const { data: tx, error } = await supabaseAdmin
      .from("qris_transactions")
      .select("order_id, donor_name, total_amount, base_amount, unique_code, status, expired_at, settled_at")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Check if pending has expired
    const isExpired = tx.status === "pending" && new Date() > new Date(tx.expired_at);
    if (isExpired) {
      await supabaseAdmin
        .from("qris_transactions")
        .update({ status: "expired" })
        .eq("order_id", orderId);
      tx.status = "expired";
    }

    return NextResponse.json({
      orderId: tx.order_id,
      donorName: tx.donor_name,
      totalAmount: Number(tx.total_amount),
      baseAmount: Number(tx.base_amount),
      uniqueCode: tx.unique_code,
      status: tx.status,
      expiredAt: tx.expired_at,
      settledAt: tx.settled_at,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
