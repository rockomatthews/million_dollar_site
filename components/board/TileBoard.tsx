"use client";

import { useMemo, useState } from "react";
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

const STATUS_COLORS: Record<Tile["status"], string> = {
  available: "#9e9e9e",
  reserved: "#a1887f",
  sold: "#78909c",
  listed: "#9575cd",
};

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
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff" }}>
            Million Dollar Crypto Grid
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
            {CANVAS_WIDTH_PX}×{CANVAS_HEIGHT_PX}px canvas (1,000,000 pixels) · 10×10px tiles · {TILE_COUNT.toLocaleString()} tiles
          </Typography>
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
              width: "fit-content",
              maxWidth: "100%",
              mx: "auto",
            }}
          >
            <Box
              sx={{
                width: boardMetrics.width,
                height: boardMetrics.height,
                transform: `scale(${zoom}) translate(${translate.x}px, ${translate.y}px)`,
                transformOrigin: "top center",
                transition: "transform 200ms ease",
                display: "grid",
                gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${GRID_COL_TRACK_PX}px)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, ${GRID_ROW_TRACK_PX}px)`,
                gap: "1px",
                backgroundColor: "#616161",
                p: "1px",
                boxSizing: "border-box",
              }}
            >
              {tiles.map((tile) => (
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
                    backgroundColor: STATUS_COLORS[tile.status],
                    cursor: "pointer",
                    outline: selectedTileIds.has(tile.id) ? "2px solid #1565c0" : "none",
                    "&:hover": {
                      outline: "2px solid #1565c0",
                      zIndex: 1,
                    },
                  }}
                />
              ))}
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
