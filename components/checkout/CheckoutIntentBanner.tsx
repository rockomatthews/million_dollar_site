"use client";

import { Alert, Box, Button, Typography } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { requestCheckoutPaymentUrl } from "@/lib/checkout/openPayment";

type CheckoutIntentPayload = {
  checkoutIntent: {
    id: string;
    status: string;
    amountUsd: number;
    tileIds: number[];
    tileCount: number;
    expiresAt: string;
    walletAddress: string;
  };
};

function stripCheckoutParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("checkout_intent");
  params.delete("checkout");
  params.delete("intent");
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function CheckoutIntentBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [payHint, setPayHint] = useState<string | null>(null);

  const checkoutIntentId = searchParams.get("checkout_intent");
  const checkoutState = searchParams.get("checkout");

  const cleanUrl = useCallback(() => {
    const next = stripCheckoutParams(searchParams.toString());
    router.replace(`${pathname}${next}`);
  }, [pathname, router, searchParams]);

  const intentQuery = useQuery({
    queryKey: ["checkout-intent", checkoutIntentId],
    enabled: Boolean(checkoutIntentId && checkoutIntentId.length === 36),
    queryFn: async () => {
      const response = await fetch(`/api/checkout-intents/${checkoutIntentId}`);
      const payload = (await response.json()) as CheckoutIntentPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load checkout.");
      }
      return payload.checkoutIntent;
    },
  });

  const payHandler = useMemo(
    () => async () => {
      if (!checkoutIntentId) return;
      setPayHint(null);
      const { checkoutUrl, message, provider } = await requestCheckoutPaymentUrl(checkoutIntentId);
      if (message && provider === "unconfigured") {
        setPayHint(`${message} Bookmark this page; set PAYMENT_API_KEY on the server for a live NOWPayments invoice.`);
      }
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    },
    [checkoutIntentId],
  );

  if (checkoutState === "success") {
    return (
      <Alert
        severity="success"
        onClose={() => {
          void queryClient.invalidateQueries({ queryKey: ["tiles"] });
          cleanUrl();
        }}
        sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "#fff" }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Payment submitted
        </Typography>
        <Typography variant="body2">
          When the payment confirms, your tiles move to <strong>sold</strong>. Click each tile you own on the grid to open
          the panel and <strong>upload art</strong> (image, title, link).
        </Typography>
      </Alert>
    );
  }

  if (checkoutState === "cancelled") {
    return (
      <Alert severity="info" onClose={cleanUrl} sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "#fff" }}>
        Checkout was cancelled. Open your resume link (?checkout_intent=…) or select a reserved tile on the grid to pay
        again if the hold is still active.
      </Alert>
    );
  }

  if (!checkoutIntentId) {
    return null;
  }

  if (intentQuery.isLoading) {
    return (
      <Alert severity="info" sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "#fff" }}>
        Loading checkout…
      </Alert>
    );
  }

  if (intentQuery.isError || !intentQuery.data) {
    return (
      <Alert severity="warning" onClose={cleanUrl} sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "#fff" }}>
        {intentQuery.error instanceof Error ? intentQuery.error.message : "This checkout link is invalid or expired."}
      </Alert>
    );
  }

  const intent = intentQuery.data;
  const expires = new Date(intent.expiresAt);
  const expired = expires.getTime() <= Date.now();

  if (intent.status !== "pending" || expired) {
    return (
      <Alert severity="warning" onClose={cleanUrl} sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "#fff" }}>
        This checkout is no longer active ({intent.status}
        {expired ? ", expired" : ""}). Select tiles again to start a new purchase if tiles are still available.
      </Alert>
    );
  }

  return (
    <Alert
      severity="info"
      icon={false}
      onClose={cleanUrl}
      sx={{ bgcolor: "rgba(33, 150, 243, 0.2)", color: "#fff", border: "1px solid rgba(33, 150, 243, 0.5)" }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Resume crypto checkout · ${intent.amountUsd.toFixed(2)} · {intent.tileCount} tile{intent.tileCount === 1 ? "" : "s"}
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.92)" }}>
          <strong>Next:</strong> open the payment page and complete payment in USDC (or as shown).{" "}
          <strong>After it confirms</strong>, your tiles show as <strong>sold</strong> — click them on the grid to upload art
          and set your link.
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)" }}>
          Paying wallet should match the one you used to reserve: {intent.walletAddress.slice(0, 6)}…{intent.walletAddress.slice(-4)}{" "}
          · Intent expires {expires.toLocaleString()}
        </Typography>
        <Box>
          <Button variant="contained" color="primary" onClick={() => void payHandler()}>
            Open payment page
          </Button>
        </Box>
        {payHint ? (
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)" }}>
            {payHint}
          </Typography>
        ) : null}
      </Box>
    </Alert>
  );
}
