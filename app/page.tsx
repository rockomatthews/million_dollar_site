import { Box, Container, Typography } from "@mui/material";
import { TileBoard } from "@/components/board/TileBoard";

export default function HomePage() {
  return (
    <Container
      maxWidth={false}
      sx={{
        height: "100vh",
        overflow: "hidden",
        py: 2,
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Million Dollar Crypto Grid
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Buy 10x10 tiles for $100, pay with crypto, settle in USDC, and manage ownership with NFTs.
        </Typography>
        <TileBoard />
      </Box>
    </Container>
  );
}
