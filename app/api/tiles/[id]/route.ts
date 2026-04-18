import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";

interface TileRouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: TileRouteParams) {
  try {
    const { id } = await params;
    const tileId = Number(id);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return NextResponse.json({ error: "Invalid tile id." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: tile, error: tileError } = await supabase
      .from("tiles")
      .select("id,x,y,status,current_owner_wallet,current_listing_price_usd,last_checkout_intent_id,reservation_expires_at")
      .eq("id", tileId)
      .single();

    if (tileError || !tile) {
      return NextResponse.json({ error: "Tile not found." }, { status: 404 });
    }

    const { data: creative } = await supabase
      .from("tile_creatives")
      .select("title,description,outbound_url,media_url,moderation_status,updated_at")
      .eq("tile_id", tileId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      tile: {
        id: Number(tile.id),
        x: tile.x,
        y: tile.y,
        status: tile.status,
        ownerWallet: tile.current_owner_wallet ?? undefined,
        listingPriceUsd: tile.current_listing_price_usd ?? undefined,
        lastCheckoutIntentId: tile.last_checkout_intent_id ?? undefined,
        reservationExpiresAt: tile.reservation_expires_at ?? undefined,
      },
      creative: creative
        ? {
            title: creative.title ?? undefined,
            description: creative.description ?? undefined,
            outboundUrl: creative.outbound_url ?? undefined,
            mediaUrl: creative.media_url ?? undefined,
            moderationStatus: creative.moderation_status,
            updatedAt: creative.updated_at,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error loading tile." }, { status: 500 });
  }
}
