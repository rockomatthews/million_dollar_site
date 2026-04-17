export type TileStatus = "available" | "reserved" | "sold" | "listed";

export interface Tile {
  id: number;
  x: number;
  y: number;
  status: TileStatus;
  ownerWallet?: string;
  listingPriceUsd?: number;
  title?: string;
  description?: string;
  outboundUrl?: string;
}
