"use client";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from "@mui/material";
import { TILE_PRICE_USD, TILE_SIZE_PX } from "@/lib/config/grid";
import type { Tile } from "@/lib/types/tile";

interface TileModalProps {
  tiles: Tile[];
  open: boolean;
  isSubmitting?: boolean;
  onConfirmPurchase: () => void;
  onClose: () => void;
}

export function TileModal({
  tiles,
  open,
  isSubmitting = false,
  onConfirmPurchase,
  onClose,
}: TileModalProps) {
  if (tiles.length === 0) {
    return null;
  }

  const isBulk = tiles.length > 1;
  const firstTile = tiles[0];
  const isAvailable = tiles.every((tile) => tile.status === "available");
  const totalPrice = tiles.length * TILE_PRICE_USD;
  const xValues = tiles.map((tile) => tile.x);
  const yValues = tiles.map((tile) => tile.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const widthPx = (maxX - minX + 1) * TILE_SIZE_PX;
  const heightPx = (maxY - minY + 1) * TILE_SIZE_PX;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isBulk ? `Buy ${tiles.length} Tiles` : `Tile #${firstTile.id} (${firstTile.x},${firstTile.y})`}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Chip label={isAvailable ? "AVAILABLE" : "MIXED STATUS"} color={isAvailable ? "success" : "warning"} />
            <Typography variant="body2" color="text.secondary">
              Total Price: ${totalPrice}
            </Typography>
          </Box>

          {isBulk ? (
            <Typography variant="body2" color="text.secondary">
              Selection footprint: {widthPx}px x {heightPx}px (from {tiles.length} individual 10x10 tiles)
            </Typography>
          ) : firstTile.ownerWallet ? (
            <Typography variant="body2">Owner: {firstTile.ownerWallet}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No owner yet
            </Typography>
          )}

          {!isBulk && firstTile.title ? (
            <Box>
              <Typography variant="h6">{firstTile.title}</Typography>
              {firstTile.description ? (
                <Typography variant="body2" color="text.secondary">
                  {firstTile.description}
                </Typography>
              ) : null}
            </Box>
          ) : null}

          {!isBulk && firstTile.outboundUrl ? (
            <Link href={firstTile.outboundUrl} target="_blank" rel="noopener noreferrer">
              Visit linked site
            </Link>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        {isAvailable ? (
          <Button variant="contained" onClick={onConfirmPurchase} disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : `Buy ${tiles.length > 1 ? "Tiles" : "Tile"}`}
          </Button>
        ) : (
          <Button variant="outlined">View History</Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
