import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";
import { TILE_COUNT } from "@/lib/config/grid";
import type { Tile, TileStatus } from "@/lib/types/tile";

/** PostgREST/Supabase often caps each response at ~1000 rows; paginate to load the full grid. */
const PAGE_SIZE = 1000;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const selectColumns = "id,x,y,status,current_owner_wallet,current_listing_price_usd";

    const rows: {
      id: number;
      x: number;
      y: number;
      status: string;
      current_owner_wallet: string | null;
      current_listing_price_usd: number | null;
    }[] = [];

    for (let offset = 0; offset < TILE_COUNT; offset += PAGE_SIZE) {
      const { data: batch, error } = await supabase
        .from("tiles")
        .select(selectColumns)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        return NextResponse.json({ error: "Failed to load tiles." }, { status: 500 });
      }

      if (!batch?.length) {
        break;
      }

      rows.push(...batch);

      if (batch.length < PAGE_SIZE) {
        break;
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          tiles: [],
          source: "empty",
          message: "Tiles are not seeded yet. Run POST /api/tiles/seed once.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const tiles: Tile[] = rows.map((row) => ({
      id: Number(row.id),
      x: row.x,
      y: row.y,
      status: row.status as TileStatus,
      ownerWallet: row.current_owner_wallet ?? undefined,
      listingPriceUsd: row.current_listing_price_usd ?? undefined,
    }));

    return NextResponse.json(
      { tiles, source: "supabase" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unexpected error while loading tiles." }, { status: 500 });
  }
}
