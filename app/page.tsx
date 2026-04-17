import { Box, Container } from "@mui/material";
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
      <Box sx={{ height: "100%" }}>
        <TileBoard />
      </Box>
    </Container>
  );
}
