import { NextResponse } from "next/server";
import { GRID_COLUMNS, TILE_COUNT } from "@/lib/config/grid";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";

function generateSeedRows() {
  return Array.from({ length: TILE_COUNT }, (_, index) => {
    const x = index % GRID_COLUMNS;
    const y = Math.floor(index / GRID_COLUMNS);
    return {
      id: index + 1,
      x,
      y,
      status: "available" as const,
      primary_price_usd: 100,
    };
  });
}

export async function POST() {
  try {
    const supabase = getSupabaseAdminClient();
    const { count, error: countError } = await supabase
      .from("tiles")
      .select("id", { count: "exact", head: true });

    if (countError) {
      return NextResponse.json({ error: "Failed to inspect tiles table." }, { status: 500 });
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json({ ok: true, seeded: false, message: "Tiles already seeded." });
    }

    const rows = generateSeedRows();
    const { error: insertError } = await supabase.from("tiles").insert(rows);
    if (insertError) {
      return NextResponse.json({ error: "Failed to seed tiles." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, seeded: true, totalTiles: TILE_COUNT });
  } catch {
    return NextResponse.json({ error: "Unexpected error while seeding tiles." }, { status: 500 });
  }
}
