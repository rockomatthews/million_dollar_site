import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";

interface PaymentWebhookBody {
  checkoutIntentId: string;
  status: "paid" | "failed" | "cancelled";
  amountUsdc?: number;
  providerReference?: string;
}

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const receivedSecret = request.headers.get("x-payment-webhook-secret");

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized webhook request." }, { status: 401 });
    }

    const body = (await request.json()) as PaymentWebhookBody;
    if (!body.checkoutIntentId || !body.status) {
      return NextResponse.json({ error: "checkoutIntentId and status are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: intent, error: intentError } = await supabase
      .from("checkout_intents")
      .select("id,status,tile_ids")
      .eq("id", body.checkoutIntentId)
      .single();

    if (intentError || !intent) {
      return NextResponse.json({ error: "Checkout intent not found." }, { status: 404 });
    }

    if (intent.status === "paid" && body.status === "paid") {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    const nextIntentStatus = body.status === "paid" ? "paid" : body.status === "cancelled" ? "cancelled" : "expired";
    const { error: updateIntentError } = await supabase
      .from("checkout_intents")
      .update({
        status: nextIntentStatus,
        amount_usdc: body.amountUsdc ?? null,
        provider_reference: body.providerReference ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id);

    if (updateIntentError) {
      return NextResponse.json({ error: "Failed to update checkout intent." }, { status: 500 });
    }

    const tileIds = intent.tile_ids as number[];

    if (body.status === "paid") {
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
    } else {
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

    return NextResponse.json({ ok: true, status: nextIntentStatus });
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
}
