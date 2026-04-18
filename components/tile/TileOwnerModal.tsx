"use client";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface TileOwnerModalProps {
  tileId: number | null;
  walletAddress?: string;
  open: boolean;
  onClose: () => void;
}

export function TileOwnerModal({ tileId, walletAddress, open, onClose }: TileOwnerModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const detailQuery = useQuery({
    queryKey: ["tile", tileId],
    enabled: open && Boolean(tileId),
    queryFn: async () => {
      const response = await fetch(`/api/tiles/${tileId}`);
      if (!response.ok) {
        throw new Error("Failed to load tile details.");
      }
      return (await response.json()) as {
        tile: {
          id: number;
          x: number;
          y: number;
          status: string;
          ownerWallet?: string;
        };
        creative: {
          title?: string;
          description?: string;
          outboundUrl?: string;
          mediaUrl?: string;
        } | null;
      };
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!tileId || !walletAddress || !file) {
        throw new Error("Select an image file and ensure your wallet is connected.");
      }

      const formElement = document.getElementById("tile-creative-form") as HTMLFormElement | null;
      if (!formElement) {
        throw new Error("Creative form is not ready.");
      }

      const formData = new FormData(formElement);
      formData.append("walletAddress", walletAddress);

      const response = await fetch(`/api/tiles/${tileId}/creative`, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed.");
      }
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tile", tileId] });
      await queryClient.invalidateQueries({ queryKey: ["tiles"] });
      onClose();
    },
  });

  const tile = detailQuery.data?.tile;
  const creative = detailQuery.data?.creative;
  const title = creative?.title ?? "";
  const description = creative?.description ?? "";
  const outboundUrl = creative?.outboundUrl ?? "";
  const normalizedWallet = walletAddress?.toLowerCase() ?? "";
  const normalizedOwner = tile?.ownerWallet?.toLowerCase() ?? "";
  const isOwner = Boolean(normalizedWallet) && Boolean(normalizedOwner) && normalizedOwner === normalizedWallet;

  return (
    <Dialog key={tileId ?? "closed"} open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Tile #{tileId}</DialogTitle>
      <DialogContent dividers>
        {detailQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading tile...
          </Typography>
        ) : detailQuery.isError ? (
          <Alert severity="error">Could not load this tile.</Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Position: ({tile?.x},{tile?.y}) · Status: {tile?.status}
            </Typography>

            {creative?.mediaUrl ? (
              <Box
                component="img"
                src={creative.mediaUrl}
                alt="Tile creative"
                sx={{ width: "100%", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
              />
            ) : null}

            {creative?.outboundUrl ? (
              <Link href={creative.outboundUrl} target="_blank" rel="noopener noreferrer">
                Open linked URL
              </Link>
            ) : null}

            {!isOwner ? (
              <Alert severity="info">Connect the wallet that owns this tile to upload or edit art.</Alert>
            ) : tile?.status !== "sold" ? (
              <Alert severity="warning">Complete payment before uploading art.</Alert>
            ) : (
              <Box component="form" id="tile-creative-form" key={detailQuery.dataUpdatedAt} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField label="Title" name="title" defaultValue={title} fullWidth />
                <TextField label="Description" name="description" defaultValue={description} fullWidth multiline minRows={3} />
                <TextField label="Outbound URL" name="outboundUrl" defaultValue={outboundUrl} fullWidth />
                <Button variant="outlined" component="label">
                  Choose Image
                  <input type="file" hidden accept="image/*" name="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </Button>
                {file ? <Typography variant="caption">{file.name}</Typography> : null}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {isOwner && tile?.status === "sold" ? (
          <Button onClick={() => uploadMutation.mutate()} variant="contained" disabled={uploadMutation.isPending || !file}>
            {uploadMutation.isPending ? "Uploading..." : "Save Creative"}
          </Button>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
