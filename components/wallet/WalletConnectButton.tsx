"use client";

import { Button, Typography } from "@mui/material";
import { useMemo } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.type === "injected"),
    [connectors],
  );

  if (typeof window === "undefined") {
    return <Button variant="outlined">Connect Wallet</Button>;
  }

  if (isConnected && address) {
    return (
      <Button variant="outlined" color="secondary" onClick={() => disconnect()}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {formatAddress(address)}
        </Typography>
      </Button>
    );
  }

  return (
    <Button
      variant="contained"
      onClick={() => {
        if (injectedConnector) {
          connect({ connector: injectedConnector });
        }
      }}
      disabled={!injectedConnector || isPending}
    >
      Connect Wallet
    </Button>
  );
}
