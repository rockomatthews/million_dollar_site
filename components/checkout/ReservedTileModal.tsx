"use client";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { requestCheckoutPaymentUrl } from "@/lib/checkout/openPayment";

interface ReservedTileModalProps {
  tileId: number | null;
  walletAddress?: string;
  open: boolean;
  onClose: () => void;
}

export function ReservedTileModal({ tileId, walletAddress, open, onClose }: ReservedTileModalProps) {
  const [payHint, setPayHint] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["tile", tileId],
    enabled: open && Boolean(tileId),
    queryFn: async () => {
      const response = await fetch(`/api/tiles/${tileId}`);
      if (!response.ok) {
        throw new Error("Failed to load tile.");
      }
      return (await response.json()) as {
        tile: {
          id: number;
          x: number;
          y: number;
          status: string;
          ownerWallet?: string;
          lastCheckoutIntentId?: string;
          reservationExpiresAt?: string;
        };
      };
    },
  });

  const intentId = detailQuery.data?.tile?.lastCheckoutIntentId;

  const intentQuery = useQuery({
    queryKey: ["checkout-intent", intentId],
    enabled: open && Boolean(intentId),
    queryFn: async () => {
      const response = await fetch(`/api/checkout-intents/${intentId}`);
      if (!response.ok) {
        throw new Error("Could not load checkout intent.");
      }
      const payload = (await response.json()) as {
        checkoutIntent: {
          id: string;
          status: string;
          amountUsd: number;
          tileCount: number;
          expiresAt: string;
          walletAddress: string;
        };
      };
      return payload.checkoutIntent;
    },
  });

  const tile = detailQuery.data?.tile;
  const normalizedWallet = walletAddress?.toLowerCase() ?? "";
  const normalizedOwner = tile?.ownerWallet?.toLowerCase() ?? "";
  const isReserver =
    Boolean(normalizedWallet) && Boolean(normalizedOwner) && normalizedOwner === normalizedWallet;

  const openPay = async () => {
    if (!intentId) return;
    setPayHint(null);
    const { checkoutUrl, message, provider } = await requestCheckoutPaymentUrl(intentId);
    if (message && provider === "unconfigured") {
      setPayHint(`${message} Set PAYMENT_API_KEY on the server for a live NOWPayments invoice.`);
    }
    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Tile #{tileId} — reserved</DialogTitle>
      <DialogContent dividers>
        {detailQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : detailQuery.isError || !tile ? (
          <Alert severity="error">Could not load this tile.</Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Grid position ({tile.x},{tile.y}). This tile is held for an unfinished checkout.
            </Typography>

            {!isReserver ? (
              <Alert severity="info">
                Connect the wallet that reserved this tile ({tile.ownerWallet?.slice(0, 6)}…{tile.ownerWallet?.slice(-4)}) to
                continue payment.
              </Alert>
            ) : null}

            {tile.reservationExpiresAt ? (
              <Typography variant="caption" color="text.secondary">
                Reservation window (if enforced): {new Date(tile.reservationExpiresAt).toLocaleString()}
              </Typography>
            ) : null}

            {intentId && intentQuery.isSuccess && intentQuery.data?.status === "pending" ? (
              <>
                <Alert severity="warning">
                  <strong>Art upload comes after payment.</strong> Complete crypto checkout first. When the tile status
                  becomes <strong>sold</strong>, click it again to open the owner panel and upload your image + details.
                </Alert>
                <Typography variant="body2">
                  Amount due: <strong>${intentQuery.data.amountUsd.toFixed(2)}</strong> · Checkout expires{" "}
                  {new Date(intentQuery.data.expiresAt).toLocaleString()}
                </Typography>
                {payHint ? (
                  <Typography variant="caption" color="text.secondary">
                    {payHint}
                  </Typography>
                ) : null}
              </>
            ) : intentId && intentQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading checkout…
              </Typography>
            ) : intentId && intentQuery.isError ? (
              <Alert severity="warning">
                Could not load payment details. If you have <code>?checkout_intent=…</code> in your address bar, use the
                blue banner above to open the payment page.
              </Alert>
            ) : intentId && intentQuery.isSuccess && intentQuery.data && intentQuery.data.status !== "pending" ? (
              <Alert severity="info">
                Checkout status: <strong>{intentQuery.data.status}</strong>. If you just paid, wait for confirmation; the tile
                will move to <strong>sold</strong> and you can upload art from the tile panel.
              </Alert>
            ) : (
              <Alert severity="info">
                No active checkout intent is linked to this tile yet, or it expired. If you paid, wait for confirmation; if
                not, start a new purchase from available tiles.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {intentId && intentQuery.data?.status === "pending" && isReserver ? (
          <Button variant="contained" onClick={() => void openPay()}>
            Open payment page
          </Button>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
