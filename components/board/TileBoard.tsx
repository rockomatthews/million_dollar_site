"use client";

import { useMemo, useState } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { GRID_COLUMNS, GRID_ROWS, TILE_COUNT, TILE_PRICE_USD } from "@/lib/config/grid";
import type { Tile } from "@/lib/types/tile";
import { QuadrantNavigator, type Quadrant } from "@/components/board/QuadrantNavigator";
import { TileModal } from "@/components/tile/TileModal";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";

const STATUS_COLORS: Record<Tile["status"], string> = {
  available: "#1f2a44",
  reserved: "#5b3a00",
  sold: "#123524",
  listed: "#36215b",
};

function generateInitialTiles(): Tile[] {
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

export function TileBoard() {
  const [tiles] = useState<Tile[]>(() => generateInitialTiles());
  const [selectedTileIds, setSelectedTileIds] = useState<Set<number>>(new Set());
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant | null>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const boardSize = useMemo(() => 700, []);
  const selectedTiles = useMemo(
    () => tiles.filter((tile) => selectedTileIds.has(tile.id)),
    [tiles, selectedTileIds],
  );

  const handleQuadrantSelect = (quadrant: Quadrant) => {
    setActiveQuadrant(quadrant);
    setZoom(2);

    const offset = boardSize / 4;
    const map: Record<Quadrant, { x: number; y: number }> = {
      nw: { x: offset, y: offset },
      ne: { x: -offset, y: offset },
      sw: { x: offset, y: -offset },
      se: { x: -offset, y: -offset },
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Million Dollar Crypto Grid
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select one or more 10x10 tiles to build larger ad areas.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <WalletConnectButton />
          <QuadrantNavigator activeQuadrant={activeQuadrant} onSelectQuadrant={handleQuadrantSelect} onReset={resetView} />
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          1000x1000 Grid (10,000 total tiles)
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Selected: {selectedTiles.length} (${selectedTiles.length * TILE_PRICE_USD})
          </Typography>
          <Button size="small" variant="outlined" disabled={selectedTiles.length === 0} onClick={() => setSelectedTileIds(new Set())}>
            Clear
          </Button>
          <Button size="small" variant="contained" disabled={selectedTiles.length === 0} onClick={() => setIsBuyModalOpen(true)}>
            Buy Selected
          </Button>
        </Box>
      </Box>

      <Paper
        elevation={2}
        sx={{
          width: "100%",
          height: "calc(100vh - 240px)",
          minHeight: 520,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            width: boardSize,
            height: boardSize,
            transform: `scale(${zoom}) translate(${translate.x}px, ${translate.y}px)`,
            transformOrigin: "center center",
            transition: "transform 200ms ease",
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gap: "1px",
            backgroundColor: "#0f172a",
            p: "1px",
          }}
        >
          {tiles.map((tile) => (
            <Box
              key={tile.id}
              role="button"
              tabIndex={0}
              aria-label={`Tile ${tile.id}`}
              onClick={() => toggleTileSelection(tile)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  toggleTileSelection(tile);
                }
              }}
              sx={{
                backgroundColor: STATUS_COLORS[tile.status],
                cursor: "pointer",
                outline: selectedTileIds.has(tile.id) ? "1px solid #00d4ff" : "none",
                "&:hover": {
                  outline: "1px solid #00d4ff",
                  zIndex: 1,
                },
              }}
            />
          ))}
        </Box>
      </Paper>

      <TileModal tiles={selectedTiles} open={isBuyModalOpen} onClose={() => setIsBuyModalOpen(false)} />
    </Box>
  );
}
