import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";
import { TILE_COUNT } from "@/lib/config/grid";
import type { Tile } from "@/lib/types/tile";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tiles")
      .select("id,x,y,status,current_owner_wallet,current_listing_price_usd")
      .order("id", { ascending: true })
      .limit(TILE_COUNT);

    if (error) {
      return NextResponse.json({ error: "Failed to load tiles." }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        tiles: [],
        source: "empty",
        message: "Tiles are not seeded yet. Run POST /api/tiles/seed once.",
      });
    }

    const tiles: Tile[] = data.map((row) => ({
      id: Number(row.id),
      x: row.x,
      y: row.y,
      status: row.status,
      ownerWallet: row.current_owner_wallet ?? undefined,
      listingPriceUsd: row.current_listing_price_usd ?? undefined,
    }));

    return NextResponse.json({ tiles, source: "supabase" });
  } catch {
    return NextResponse.json({ error: "Unexpected error while loading tiles." }, { status: 500 });
  }
}
