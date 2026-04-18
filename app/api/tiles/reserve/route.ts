import { NextResponse } from "next/server";
import { formatPostgrestError, isMissingColumnError } from "@/server/db/formatPostgrestError";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";

interface ReserveTilesRequest {
  tileIds: number[];
  walletAddress: string;
}

const RESERVATION_MINUTES = 15;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReserveTilesRequest;
    const tileIds = Array.isArray(body.tileIds) ? body.tileIds : [];
    const walletAddress = body.walletAddress?.trim().toLowerCase();

    if (!walletAddress || tileIds.length === 0) {
      return NextResponse.json({ error: "walletAddress and tileIds are required." }, { status: 400 });
    }

    const uniqueTileIds = [...new Set(tileIds)].filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueTileIds.length === 0) {
      return NextResponse.json({ error: "No valid tile IDs were provided." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: selectedTiles, error: selectError } = await supabase
      .from("tiles")
      .select("id,status")
      .in("id", uniqueTileIds);

    if (selectError) {
      return NextResponse.json(
        {
          error: "Failed to verify tile availability.",
          details: formatPostgrestError(selectError),
        },
        { status: 500 },
      );
    }

    if (!selectedTiles || selectedTiles.length !== uniqueTileIds.length) {
      const foundIds = new Set((selectedTiles ?? []).map((t) => Number(t.id)));
      const missing = uniqueTileIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        {
          error:
            "One or more selected tiles do not exist in the database. Truncate and seed all 10,000 tiles if your grid was partially seeded.",
          missingTileIds: missing.slice(0, 20),
          missingCount: missing.length,
        },
        { status: 400 },
      );
    }

    const unavailable = selectedTiles.filter((tile) => tile.status !== "available").map((tile) => tile.id);
    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: "Some tiles are no longer available.", unavailableTileIds: unavailable },
        { status: 409 },
      );
    }

    const reservationExpiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();
    const { data: updatedRows, error: updateError } = await supabase
      .from("tiles")
      .update({
        status: "reserved",
        current_owner_wallet: walletAddress,
        reservation_expires_at: reservationExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .in("id", uniqueTileIds)
      .eq("status", "available")
      .select("id");

    if (updateError) {
      const missingReservationCol = isMissingColumnError(updateError, "reservation_expires_at");
      return NextResponse.json(
        {
          error: "Failed to reserve selected tiles.",
          details: formatPostgrestError(updateError),
          hint: missingReservationCol
            ? "Apply supabase/migrations/0002_checkout_intents_and_reservations.sql so tiles.reservation_expires_at exists."
            : undefined,
        },
        { status: 500 },
      );
    }

    if (!updatedRows || updatedRows.length !== uniqueTileIds.length) {
      return NextResponse.json(
        {
          error:
            "Not all tiles could be reserved (another request may have taken them, or rows are out of sync). Refresh and try again.",
          expected: uniqueTileIds.length,
          updated: updatedRows?.length ?? 0,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      reservedTileIds: uniqueTileIds,
      reservationExpiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
