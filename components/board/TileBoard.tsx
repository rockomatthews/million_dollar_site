"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Alert, Box, Button, CircularProgress, Paper, Snackbar, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CANVAS_HEIGHT_PX,
  CANVAS_WIDTH_PX,
  GRID_COL_TRACK_PX,
  GRID_COLUMNS,
  GRID_ROW_TRACK_PX,
  GRID_ROWS,
  TILE_COUNT,
  TILE_PRICE_USD,
} from "@/lib/config/grid";
import type { Tile } from "@/lib/types/tile";
import { QuadrantNavigator, type Quadrant } from "@/components/board/QuadrantNavigator";
import { TileModal } from "@/components/tile/TileModal";
import { TileOwnerModal } from "@/components/tile/TileOwnerModal";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { useAccount } from "wagmi";

/** Must read clearly against GRID_SURFACE (#5a5a5a); avoid outline (breaks on 10px cells — use inset shadows). */
const STATUS_COLORS: Record<Tile["status"], string> = {
  available: "#d5d5d5",
  reserved: "#bcaaa4",
  sold: "#90a4ae",
  listed: "#b39ddb",
};

const GRID_LINE_SHADOW = "inset 0 0 0 1px rgba(0,0,0,0.5)";
const SELECT_SHADOW = "inset 0 0 0 2px #0d47a1";
const HOVER_SHADOW = "inset 0 0 0 2px #1976d2";

export function TileBoard() {
  const [selectedTileIds, setSelectedTileIds] = useState<Set<number>>(new Set());
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [ownerTileId, setOwnerTileId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant | null>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const boardMetrics = useMemo(
    () => ({
      width: CANVAS_WIDTH_PX,
      height: CANVAS_HEIGHT_PX,
    }),
    [],
  );
  const { data: tilesResponse, isLoading } = useQuery<{ tiles: Tile[]; source?: string; message?: string }>({
    queryKey: ["tiles"],
    queryFn: async () => {
      const response = await fetch("/api/tiles");
      if (!response.ok) {
        throw new Error("Failed to fetch tiles.");
      }
      return (await response.json()) as { tiles: Tile[]; source?: string; message?: string };
    },
  });
  const tiles = useMemo(() => tilesResponse?.tiles ?? [], [tilesResponse?.tiles]);
  const needsSeed = Boolean(tilesResponse?.source === "empty" || (!isLoading && tiles.length === 0));

  const seedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/tiles/seed", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to seed tiles.");
      }
      return payload;
    },
    onSuccess: () => {
      setNotice("Grid initialized. You can select tiles now.");
      void queryClient.invalidateQueries({ queryKey: ["tiles"] });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Failed to initialize grid.");
    },
  });

  const selectedTiles = useMemo(
    () => tiles.filter((tile) => selectedTileIds.has(tile.id)),
    [tiles, selectedTileIds],
  );

  const reserveMutation = useMutation({
    mutationFn: async () => {
      if (!address || selectedTiles.length === 0) {
        throw new Error("Connect a wallet and select at least one tile.");
      }

      const response = await fetch("/api/tiles/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tileIds: selectedTiles.map((tile) => tile.id),
          walletAddress: address,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to reserve selected tiles.");
      }

      const checkoutResponse = await fetch("/api/checkout-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tileIds: selectedTiles.map((tile) => tile.id),
          walletAddress: address,
        }),
      });

      const checkoutPayload = (await checkoutResponse.json()) as {
        error?: string;
        checkoutIntent?: { id: string; amountUsd: number };
      };
      if (!checkoutResponse.ok || !checkoutPayload.checkoutIntent) {
        throw new Error(checkoutPayload.error ?? "Reservation succeeded, but checkout intent failed.");
      }

      const payResponse = await fetch(`/api/checkout-intents/${checkoutPayload.checkoutIntent.id}/pay`, {
        method: "POST",
      });
      const payPayload = (await payResponse.json()) as {
        error?: string;
        checkoutUrl?: string;
      };
      if (!payResponse.ok || !payPayload.checkoutUrl) {
        throw new Error(payPayload.error ?? "Checkout intent created, but payment session failed.");
      }

      return {
        ...checkoutPayload.checkoutIntent,
        checkoutUrl: payPayload.checkoutUrl,
      };
    },
    onSuccess: (checkoutIntent) => {
      setNotice(
        `Tiles reserved. Checkout intent ${checkoutIntent.id.slice(0, 8)}... created for $${checkoutIntent.amountUsd}.`,
      );
      window.open(checkoutIntent.checkoutUrl, "_blank", "noopener,noreferrer");
      setIsBuyModalOpen(false);
      setSelectedTileIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ["tiles"] });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Reservation failed.");
    },
  });

  const handleQuadrantSelect = (quadrant: Quadrant) => {
    setActiveQuadrant(quadrant);
    setZoom(2);

    const offsetX = boardMetrics.width / 4;
    const offsetY = boardMetrics.height / 4;
    const map: Record<Quadrant, { x: number; y: number }> = {
      nw: { x: offsetX, y: offsetY },
      ne: { x: -offsetX, y: offsetY },
      sw: { x: offsetX, y: -offsetY },
      se: { x: -offsetX, y: -offsetY },
    };
    setTranslate(map[quadrant]);
  };

  const resetView = () => {
    setActiveQuadrant(null);
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
  };

  const toggleTileSelection = (tile: Tile) => {
    if (tile.status !== "available") {
      return;
    }

    setSelectedTileIds((previous) => {
      const next = new Set(previous);
      if (next.has(tile.id)) {
        next.delete(tile.id);
      } else {
        next.add(tile.id);
      }
      return next;
    });
  };

  const handleTileActivate = (tile: Tile) => {
    if (tile.status === "available") {
      toggleTileSelection(tile);
      return;
    }

    if (tile.status === "sold" || tile.status === "listed") {
      setOwnerTileId(tile.id);
      return;
    }

    if (tile.status === "reserved") {
      setNotice("This tile is reserved for an active checkout.");
    }
  };

  const handleBuySelected = () => {
    if (!isConnected) {
      setNotice("Connect your wallet before buying tiles.");
      return;
    }
    setIsBuyModalOpen(true);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
          <Box
            sx={{
              position: "relative",
              width: { xs: 52, sm: 64 },
              height: { xs: 52, sm: 64 },
              flexShrink: 0,
              borderRadius: 1,
              overflow: "hidden",
              bgcolor: "#000",
              boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
            }}
          >
            <Image
              src="/millionsAuction.png"
              alt="millions.auction"
              fill
              sizes="(max-width: 600px) 52px, 64px"
              priority
              style={{ objectFit: "cover" }}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff" }}>
              millions.auction
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
              Million Dollar Crypto Grid · {CANVAS_WIDTH_PX}×{CANVAS_HEIGHT_PX}px (1M pixels) · {TILE_COUNT.toLocaleString()}{" "}
              tiles
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <WalletConnectButton />
          <QuadrantNavigator activeQuadrant={activeQuadrant} onSelectQuadrant={handleQuadrantSelect} onReset={resetView} />
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
          Grid · {TILE_COUNT.toLocaleString()} tiles
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
            Selected: {selectedTiles.length} (${selectedTiles.length * TILE_PRICE_USD})
          </Typography>
          <Button size="small" variant="outlined" disabled={selectedTiles.length === 0} onClick={() => setSelectedTileIds(new Set())}>
            Clear
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={selectedTiles.length === 0 || !isConnected}
            onClick={handleBuySelected}
          >
            Buy Selected
          </Button>
        </Box>
      </Box>

      <Paper
        elevation={2}
        sx={{
          width: "100%",
          maxHeight: "calc(100vh - 200px)",
          minHeight: 0,
          overflow: "auto",
          border: "1px solid",
          borderColor: "rgba(0,0,0,0.2)",
          bgcolor: "#bdbdbd",
          p: 2,
          display: "block",
        }}
      >
        {isLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <CircularProgress />
          </Box>
        ) : needsSeed ? (
          <Box sx={{ px: 2, maxWidth: 520 }}>
            <Alert severity="warning">
              The grid database is empty. Initialize it once to enable purchases ({tilesResponse?.message ?? "seed required"}).
            </Alert>
            <Box sx={{ mt: 2 }}>
              <Button variant="contained" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? "Initializing..." : `Initialize ${TILE_COUNT.toLocaleString()} Tiles`}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              overflow: "auto",
            }}
          >
            {/*
              Exact 1000×1000px. Do not use gap/padding on the grid: 100×(10px+gaps) exceeded 1000px and broke the layout.
            */}
            <Box
              sx={{
                width: CANVAS_WIDTH_PX,
                height: CANVAS_HEIGHT_PX,
                aspectRatio: "1 / 1",
                flexShrink: 0,
                transform: `scale(${zoom}) translate(${translate.x}px, ${translate.y}px)`,
                transformOrigin: "top center",
                transition: "transform 200ms ease",
                display: "grid",
                gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${GRID_COL_TRACK_PX}px)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, ${GRID_ROW_TRACK_PX}px)`,
                gap: 0,
                backgroundColor: "#5a5a5a",
              }}
            >
              {tiles.map((tile) => {
                const selected = selectedTileIds.has(tile.id);
                return (
                <Box
                  key={tile.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Tile ${tile.id}`}
                  onClick={() => handleTileActivate(tile)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      handleTileActivate(tile);
                    }
                  }}
                  sx={{
                    minWidth: 0,
                    minHeight: 0,
                    boxSizing: "border-box",
                    backgroundColor: STATUS_COLORS[tile.status],
                    cursor: "pointer",
                    // Inset shadows draw full frames on tiny cells; CSS outline often renders as corner artifacts.
                    boxShadow: selected ? `${GRID_LINE_SHADOW}, ${SELECT_SHADOW}` : GRID_LINE_SHADOW,
                    position: "relative",
                    zIndex: selected ? 2 : 0,
                    "&:hover": {
                      zIndex: 3,
                      boxShadow: `${GRID_LINE_SHADOW}, ${HOVER_SHADOW}`,
                    },
                  }}
                />
              );
              })}
            </Box>
          </Box>
        )}
      </Paper>

      <TileModal
        tiles={selectedTiles}
        open={isBuyModalOpen}
        isSubmitting={reserveMutation.isPending}
        onConfirmPurchase={() => reserveMutation.mutate()}
        onClose={() => setIsBuyModalOpen(false)}
      />
      <TileOwnerModal
        tileId={ownerTileId}
        walletAddress={address}
        open={Boolean(ownerTileId)}
        onClose={() => setOwnerTileId(null)}
      />
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice(null)}>
        <Alert severity="info" variant="filled" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
