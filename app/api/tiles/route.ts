import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";
import { GRID_COLUMNS, TILE_COUNT } from "@/lib/config/grid";
import type { Tile } from "@/lib/types/tile";

function generateFallbackTiles(): Tile[] {
  return Array.from({ length: TILE_COUNT }, (_, index) => {
    const x = index % GRID_COLUMNS;
    const y = Math.floor(index / GRID_COLUMNS);
    return {
      id: index + 1,
      x,
      y,
      status: "available",
    };
  });
}

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
      return NextResponse.json({ tiles: generateFallbackTiles(), source: "fallback" });
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
