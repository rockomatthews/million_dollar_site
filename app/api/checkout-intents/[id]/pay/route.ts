import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";

interface PayRouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_: Request, { params }: PayRouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing checkout intent id." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: intent, error: intentError } = await supabase
      .from("checkout_intents")
      .select("id,status,amount_usd,wallet_address")
      .eq("id", id)
      .single();

    if (intentError || !intent) {
      return NextResponse.json({ error: "Checkout intent not found." }, { status: 404 });
    }

    if (intent.status !== "pending") {
      return NextResponse.json({ error: "Checkout intent is no longer payable." }, { status: 409 });
    }

    const paymentProviderBaseUrl = process.env.PAYMENT_PROVIDER_BASE_URL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const fallbackCheckoutUrl = `${appUrl}/?checkout_intent=${id}`;

    if (!paymentProviderBaseUrl) {
      return NextResponse.json({
        ok: true,
        checkoutIntentId: intent.id,
        checkoutUrl: fallbackCheckoutUrl,
        provider: "unconfigured",
        message: "Set PAYMENT_PROVIDER_BASE_URL to enable real crypto checkout.",
      });
    }

    const providerCheckoutUrl = `${paymentProviderBaseUrl.replace(/\/$/, "")}/checkout?reference=${encodeURIComponent(
      id,
    )}&amount_usd=${encodeURIComponent(String(intent.amount_usd))}&wallet=${encodeURIComponent(intent.wallet_address)}`;

    const { error: updateError } = await supabase
      .from("checkout_intents")
      .update({
        provider: "configured",
        provider_reference: id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update provider metadata." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      checkoutIntentId: intent.id,
      checkoutUrl: providerCheckoutUrl,
      provider: "configured",
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error while preparing checkout." }, { status: 500 });
  }
}
