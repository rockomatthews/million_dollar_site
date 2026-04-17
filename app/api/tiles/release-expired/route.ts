import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      // Vercel cron sets Authorization: Bearer <CRON_SECRET>.
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
      }
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tiles")
      .update({
        status: "available",
        current_owner_wallet: null,
        reservation_expires_at: null,
        last_checkout_intent_id: null,
        updated_at: nowIso,
      })
      .eq("status", "reserved")
      .lt("reservation_expires_at", nowIso)
      .select("id");

    if (error) {
      return NextResponse.json({ error: "Failed to release expired reservations." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      releasedCount: data?.length ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error releasing reservations." }, { status: 500 });
  }
}
