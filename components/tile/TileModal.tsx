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
import { TILE_PRICE_USD } from "@/lib/config/grid";
import type { Tile } from "@/lib/types/tile";

interface TileModalProps {
  tile: Tile | null;
  open: boolean;
  onClose: () => void;
}

export function TileModal({ tile, open, onClose }: TileModalProps) {
  if (!tile) {
    return null;
  }

  const isAvailable = tile.status === "available";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Tile #{tile.id} ({tile.x},{tile.y})
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Chip label={tile.status.toUpperCase()} color={isAvailable ? "success" : "warning"} />
            <Typography variant="body2" color="text.secondary">
              Primary Price: ${TILE_PRICE_USD}
            </Typography>
          </Box>

          {tile.ownerWallet ? (
            <Typography variant="body2">Owner: {tile.ownerWallet}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No owner yet
            </Typography>
          )}

          {tile.title ? (
            <Box>
              <Typography variant="h6">{tile.title}</Typography>
              {tile.description ? (
                <Typography variant="body2" color="text.secondary">
                  {tile.description}
                </Typography>
              ) : null}
            </Box>
          ) : null}

          {tile.outboundUrl ? (
            <Link href={tile.outboundUrl} target="_blank" rel="noopener noreferrer">
              Visit linked site
            </Link>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        {isAvailable ? <Button variant="contained">Buy Tile</Button> : <Button variant="outlined">View History</Button>}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
