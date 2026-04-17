import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Failed to verify tile availability." }, { status: 500 });
    }

    if (!selectedTiles || selectedTiles.length !== uniqueTileIds.length) {
      return NextResponse.json({ error: "One or more selected tiles do not exist." }, { status: 400 });
    }

    const unavailable = selectedTiles.filter((tile) => tile.status !== "available").map((tile) => tile.id);
    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: "Some tiles are no longer available.", unavailableTileIds: unavailable },
        { status: 409 },
      );
    }

    const reservationExpiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();
    const { error: updateError } = await supabase
      .from("tiles")
      .update({
        status: "reserved",
        current_owner_wallet: walletAddress,
        reservation_expires_at: reservationExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .in("id", uniqueTileIds)
      .eq("status", "available");

    if (updateError) {
      return NextResponse.json({ error: "Failed to reserve selected tiles." }, { status: 500 });
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
