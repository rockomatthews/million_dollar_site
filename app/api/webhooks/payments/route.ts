import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";
import { verifyNowPaymentsSignature } from "@/server/payments/nowpayments";

interface PaymentWebhookBody {
  payment_id?: number | string;
  order_id?: string;
  payment_status?: string;
  actually_paid?: number;
  pay_amount?: number;
  purchase_id?: number | string;
}

export async function POST(request: Request) {
  try {
    const ipnSecret = process.env.PAYMENT_WEBHOOK_SECRET ?? process.env.NOWPAYMENTS_IPN_SECRET;
    const signature = request.headers.get("x-nowpayments-sig") ?? "";
    const rawBody = await request.text();

    if (!ipnSecret || !verifyNowPaymentsSignature(rawBody, signature, ipnSecret)) {
      return NextResponse.json({ error: "Unauthorized webhook request." }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as PaymentWebhookBody;
    const checkoutIntentId = body.order_id;
    const paymentStatus = body.payment_status?.toLowerCase();

    if (!checkoutIntentId || !paymentStatus) {
      return NextResponse.json({ error: "order_id and payment_status are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: intent, error: intentError } = await supabase
      .from("checkout_intents")
      .select("id,status,tile_ids")
      .eq("id", checkoutIntentId)
      .single();

    if (intentError || !intent) {
      return NextResponse.json({ error: "Checkout intent not found." }, { status: 404 });
    }

    const isPaidStatus = ["finished", "confirmed", "sending"].includes(paymentStatus);
    const isCancelledStatus = ["failed", "expired", "refunded", "cancelled"].includes(paymentStatus);

    if (intent.status === "paid" && isPaidStatus) {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    const nextIntentStatus = isPaidStatus ? "paid" : isCancelledStatus ? "cancelled" : "pending";
    const { error: updateIntentError } = await supabase
      .from("checkout_intents")
      .update({
        status: nextIntentStatus,
        amount_usdc: body.actually_paid ?? body.pay_amount ?? null,
        provider_reference: (body.payment_id ?? body.purchase_id ?? null)?.toString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id);

    if (updateIntentError) {
      return NextResponse.json({ error: "Failed to update checkout intent." }, { status: 500 });
    }

    const tileIds = intent.tile_ids as number[];

    if (isPaidStatus) {
      const { error: soldError } = await supabase
        .from("tiles")
        .update({
          status: "sold",
          reservation_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", tileIds)
        .eq("last_checkout_intent_id", intent.id);

      if (soldError) {
        return NextResponse.json({ error: "Checkout marked paid but tile state update failed." }, { status: 500 });
      }
    } else if (isCancelledStatus) {
      const { error: releaseError } = await supabase
        .from("tiles")
        .update({
          status: "available",
          current_owner_wallet: null,
          reservation_expires_at: null,
          last_checkout_intent_id: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", tileIds)
        .eq("last_checkout_intent_id", intent.id);

      if (releaseError) {
        return NextResponse.json({ error: "Checkout updated but tile release failed." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, status: nextIntentStatus, providerStatus: paymentStatus });
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
}
