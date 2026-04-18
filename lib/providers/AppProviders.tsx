"use client";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wallet/wagmiConfig";

const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#00d4ff",
    },
    secondary: {
      main: "#7c4dff",
    },
    background: {
      default: "#2e7d32",
      paper: "#9e9e9e",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={appTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
