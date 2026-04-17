import { NextResponse } from "next/server";
import { TILE_PRICE_USD } from "@/lib/config/grid";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";

interface CreateCheckoutIntentBody {
  walletAddress: string;
  tileIds: number[];
}

const RESERVATION_MINUTES = 15;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateCheckoutIntentBody;
    const walletAddress = body.walletAddress?.trim().toLowerCase();
    const tileIds = Array.isArray(body.tileIds) ? [...new Set(body.tileIds)] : [];

    if (!walletAddress || tileIds.length === 0) {
      return NextResponse.json({ error: "walletAddress and tileIds are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: tiles, error: tileError } = await supabase
      .from("tiles")
      .select("id,status,current_owner_wallet,reservation_expires_at")
      .in("id", tileIds);

    if (tileError) {
      return NextResponse.json({ error: "Failed to validate reserved tiles." }, { status: 500 });
    }

    if (!tiles || tiles.length !== tileIds.length) {
      return NextResponse.json({ error: "One or more selected tiles do not exist." }, { status: 400 });
    }

    const now = new Date();
    const invalidTile = tiles.find((tile) => {
      const expiresAt = tile.reservation_expires_at ? new Date(tile.reservation_expires_at) : null;
      return (
        tile.status !== "reserved" ||
        tile.current_owner_wallet !== walletAddress ||
        !expiresAt ||
        expiresAt <= now
      );
    });

    if (invalidTile) {
      return NextResponse.json(
        { error: "Selected tiles must be actively reserved by your wallet before checkout." },
        { status: 409 },
      );
    }

    const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000).toISOString();
    const amountUsd = tileIds.length * TILE_PRICE_USD;

    const { data: intent, error: intentError } = await supabase
      .from("checkout_intents")
      .insert({
        wallet_address: walletAddress,
        tile_ids: tileIds,
        tile_count: tileIds.length,
        amount_usd: amountUsd,
        status: "pending",
        expires_at: expiresAt,
        provider: "unconfigured",
      })
      .select("id,wallet_address,tile_ids,tile_count,amount_usd,status,expires_at")
      .single();

    if (intentError || !intent) {
      return NextResponse.json({ error: "Failed to create checkout intent." }, { status: 500 });
    }

    const { error: tileUpdateError } = await supabase
      .from("tiles")
      .update({
        last_checkout_intent_id: intent.id,
        updated_at: new Date().toISOString(),
      })
      .in("id", tileIds);

    if (tileUpdateError) {
      return NextResponse.json({ error: "Checkout intent created but tile linkage failed." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      checkoutIntent: {
        id: intent.id,
        walletAddress: intent.wallet_address,
        tileIds: intent.tile_ids,
        tileCount: intent.tile_count,
        amountUsd: intent.amount_usd,
        status: intent.status,
        expiresAt: intent.expires_at,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
