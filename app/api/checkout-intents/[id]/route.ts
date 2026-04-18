import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";
import { formatPostgrestError } from "@/server/db/formatPostgrestError";

interface CheckoutIntentRouteParams {
  params: Promise<{ id: string }>;
}

/** Public read of a checkout intent (UUID acts as capability for resume links). */
export async function GET(_: Request, { params }: CheckoutIntentRouteParams) {
  try {
    const { id } = await params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid checkout intent id." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("checkout_intents")
      .select("id,status,amount_usd,tile_ids,tile_count,expires_at,wallet_address")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Checkout intent not found.", details: error ? formatPostgrestError(error) : undefined },
        { status: 404 },
      );
    }

    const tileIds = Array.isArray(data.tile_ids)
      ? data.tile_ids.map((n) => (typeof n === "bigint" ? Number(n) : Number(n)))
      : [];

    return NextResponse.json({
      checkoutIntent: {
        id: data.id,
        status: data.status,
        amountUsd: Number(data.amount_usd),
        tileIds,
        tileCount: data.tile_count,
        expiresAt: data.expires_at,
        walletAddress: data.wallet_address,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error loading checkout intent." }, { status: 500 });
  }
}
