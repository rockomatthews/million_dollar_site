"use client";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

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
      default: "#0a0a0f",
      paper: "#11131d",
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
