import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/server/db/supabaseAdmin";

interface CreativeRouteParams {
  params: Promise<{ id: string }>;
}

function normalizeWallet(wallet: string) {
  return wallet.trim().toLowerCase();
}

export async function POST(request: Request, { params }: CreativeRouteParams) {
  try {
    const { id } = await params;
    const tileId = Number(id);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return NextResponse.json({ error: "Invalid tile id." }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    if (!bucket) {
      return NextResponse.json({ error: "SUPABASE_STORAGE_BUCKET is not configured." }, { status: 500 });
    }

    const formData = await request.formData();
    const walletAddress = normalizeWallet(String(formData.get("walletAddress") ?? ""));
    const title = formData.get("title") ? String(formData.get("title")) : null;
    const description = formData.get("description") ? String(formData.get("description")) : null;
    const outboundUrl = formData.get("outboundUrl") ? String(formData.get("outboundUrl")) : null;
    const file = formData.get("file");

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: tile, error: tileError } = await supabase
      .from("tiles")
      .select("id,status,current_owner_wallet")
      .eq("id", tileId)
      .single();

    if (tileError || !tile) {
      return NextResponse.json({ error: "Tile not found." }, { status: 404 });
    }

    if (tile.status !== "sold") {
      return NextResponse.json({ error: "Tiles must be purchased before uploading art." }, { status: 409 });
    }

    const ownerWallet = tile.current_owner_wallet ? normalizeWallet(tile.current_owner_wallet) : "";
    if (!ownerWallet || ownerWallet !== walletAddress) {
      return NextResponse.json({ error: "Wallet does not own this tile." }, { status: 403 });
    }

    const originalName = file.name || "upload";
    const safeExt = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : "";
    const objectPath = `tiles/${tileId}/${randomUUID()}${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: "Failed to upload image to storage." }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const mediaUrl = publicUrlData.publicUrl;

    const { data: existingCreative } = await supabase
      .from("tile_creatives")
      .select("id")
      .eq("tile_id", tileId)
      .maybeSingle();

    const nowIso = new Date().toISOString();

    if (existingCreative?.id) {
      const { error: updateCreativeError } = await supabase
        .from("tile_creatives")
        .update({
          title,
          description,
          outbound_url: outboundUrl,
          media_url: mediaUrl,
          moderation_status: "approved",
          updated_at: nowIso,
        })
        .eq("id", existingCreative.id);

      if (updateCreativeError) {
        return NextResponse.json({ error: "Failed to save creative metadata." }, { status: 500 });
      }
    } else {
      const { error: insertCreativeError } = await supabase.from("tile_creatives").insert({
        tile_id: tileId,
        title,
        description,
        outbound_url: outboundUrl,
        media_url: mediaUrl,
        moderation_status: "approved",
        updated_at: nowIso,
      });

      if (insertCreativeError) {
        return NextResponse.json({ error: "Failed to save creative metadata." }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      mediaUrl,
    });
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }
}
