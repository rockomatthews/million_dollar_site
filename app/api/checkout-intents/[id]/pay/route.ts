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

    const paymentApiKey = process.env.PAYMENT_API_KEY;
    const paymentProviderBaseUrl = process.env.PAYMENT_PROVIDER_BASE_URL ?? "https://api.nowpayments.io/v1";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const paymentIpnUrl = process.env.NOWPAYMENTS_IPN_URL ?? `${appUrl}/api/webhooks/payments`;
    const settlementCurrency = "usdc";
    const priceCurrency = "usd";
    const fallbackCheckoutUrl = `${appUrl}/?checkout_intent=${id}`;

    if (!paymentApiKey) {
      return NextResponse.json({
        ok: true,
        checkoutIntentId: intent.id,
        checkoutUrl: fallbackCheckoutUrl,
        provider: "unconfigured",
        message: "Set PAYMENT_API_KEY to enable NOWPayments checkout.",
      });
    }

    const createPaymentResponse = await fetch(`${paymentProviderBaseUrl.replace(/\/$/, "")}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": paymentApiKey,
      },
      body: JSON.stringify({
        price_amount: Number(intent.amount_usd),
        price_currency: priceCurrency,
        pay_currency: settlementCurrency,
        order_id: intent.id,
        order_description: `Grid tiles checkout ${intent.id}`,
        ipn_callback_url: paymentIpnUrl,
        success_url: `${appUrl}/?checkout=success&intent=${intent.id}`,
        cancel_url: `${appUrl}/?checkout=cancelled&intent=${intent.id}`,
      }),
    });

    const createPaymentPayload = (await createPaymentResponse.json()) as {
      payment_id?: string | number;
      invoice_url?: string;
      pay_address?: string;
      purchase_id?: string | number;
      message?: string;
    };

    if (!createPaymentResponse.ok) {
      return NextResponse.json(
        {
          error: createPaymentPayload.message ?? "NOWPayments checkout session creation failed.",
        },
        { status: 502 },
      );
    }

    const providerReference =
      (createPaymentPayload.payment_id ?? createPaymentPayload.purchase_id ?? intent.id).toString();
    const checkoutUrl = createPaymentPayload.invoice_url ?? fallbackCheckoutUrl;
    const provider = "nowpayments";

    const { error: updateError } = await supabase
      .from("checkout_intents")
      .update({
        provider,
        provider_reference: providerReference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update provider metadata." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      checkoutIntentId: intent.id,
      checkoutUrl,
      provider,
      providerReference,
      payAddress: createPaymentPayload.pay_address ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error while preparing checkout." }, { status: 500 });
  }
}
