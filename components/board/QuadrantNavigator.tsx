"use client";

import { Box, Button, ButtonGroup, Typography } from "@mui/material";

export type Quadrant = "nw" | "ne" | "sw" | "se";

const QUADRANTS: { key: Quadrant; label: string }[] = [
  { key: "nw", label: "NW" },
  { key: "ne", label: "NE" },
  { key: "sw", label: "SW" },
  { key: "se", label: "SE" },
];

interface QuadrantNavigatorProps {
  activeQuadrant: Quadrant | null;
  onSelectQuadrant: (quadrant: Quadrant) => void;
  onReset: () => void;
}

export function QuadrantNavigator({
  activeQuadrant,
  onSelectQuadrant,
  onReset,
}: QuadrantNavigatorProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="subtitle2" color="text.secondary">
        Quadrant Zoom
      </Typography>
      <ButtonGroup variant="outlined" size="small" color="primary">
        {QUADRANTS.map((item) => (
          <Button
            key={item.key}
            variant={activeQuadrant === item.key ? "contained" : "outlined"}
            onClick={() => onSelectQuadrant(item.key)}
          >
            {item.label}
          </Button>
        ))}
        <Button onClick={onReset}>Reset</Button>
      </ButtonGroup>
    </Box>
  );
}
