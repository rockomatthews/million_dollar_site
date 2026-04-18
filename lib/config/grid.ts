/** Total canvas area: exactly one million pixels. */
export const TOTAL_CANVAS_PIXELS = 1_000_000;

/** Width fixed at 1400px; height completes the million. */
export const CANVAS_WIDTH_PX = 1400;
export const CANVAS_HEIGHT_PX = TOTAL_CANVAS_PIXELS / CANVAS_WIDTH_PX;

/** Each sellable cell is 10×10 logical pixels on the canvas. */
export const TILE_SIZE_PX = 10;

export const GRID_COLUMNS = CANVAS_WIDTH_PX / TILE_SIZE_PX;
/** Last row may be slightly shorter than 10px visually when fitting exact canvas height; indices still 0..GRID_ROWS-1. */
export const GRID_ROWS = Math.ceil(CANVAS_HEIGHT_PX / TILE_SIZE_PX);

export const TILE_COUNT = GRID_COLUMNS * GRID_ROWS;

export const TILE_PRICE_USD = 100;
