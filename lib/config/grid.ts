/** Total canvas area: exactly one million pixels. */
export const TOTAL_CANVAS_PIXELS = 1_000_000;

/**
 * Classic million-pixel square: 1000×1000 = 1,000,000 px.
 * 10×10 sellable cells → 100×100 = 10,000 tiles (clear math, no fractional height).
 */
export const CANVAS_WIDTH_PX = 1000;
export const CANVAS_HEIGHT_PX = TOTAL_CANVAS_PIXELS / CANVAS_WIDTH_PX;

/** Each sellable cell is 10×10 pixels on the canvas. */
export const TILE_SIZE_PX = 10;

export const GRID_COLUMNS = CANVAS_WIDTH_PX / TILE_SIZE_PX;
export const GRID_ROWS = CANVAS_HEIGHT_PX / TILE_SIZE_PX;

export const TILE_COUNT = GRID_COLUMNS * GRID_ROWS;

export const TILE_PRICE_USD = 100;

/** Explicit CSS grid track sizes (avoids `1fr` collapse inside flex layouts). */
export const GRID_COL_TRACK_PX = TILE_SIZE_PX;
export const GRID_ROW_TRACK_PX = CANVAS_HEIGHT_PX / GRID_ROWS;
