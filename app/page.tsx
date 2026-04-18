import { Box, Container } from "@mui/material";
import { Suspense } from "react";
import { TileBoard } from "@/components/board/TileBoard";

export default function HomePage() {
  return (
    <Container
      maxWidth={false}
      sx={{
        height: "100vh",
        overflow: "hidden",
        py: 2,
        bgcolor: "transparent",
      }}
    >
      <Box sx={{ height: "100%" }}>
        <Suspense fallback={null}>
          <TileBoard />
        </Suspense>
      </Box>
    </Container>
  );
}
