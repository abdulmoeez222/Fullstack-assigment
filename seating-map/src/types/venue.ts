export type SeatStatus = "available" | "reserved" | "sold" | "held";

export interface Seat {
  id: string;
  col: number;
  x: number;
  y: number;
  priceTier: number;
  status: SeatStatus;
}

export interface Row {
  index: number;
  seats: Seat[];
}

export interface SectionTransform {
  x: number;
  y: number;
  scale: number;
}

export interface Section {
  id: string;
  label: string;
  transform: SectionTransform;
  rows: Row[];
}

export interface Venue {
  venueId: string;
  name: string;
  map: { width: number; height: number };
  sections: Section[];
  /**
   * Location of the main stage/screen, used to compute a simulated
   * "view from your seat." Optional so older venue.json files without it
   * still load — App.tsx falls back to a sensible default (top-center).
   */
  screen?: ScreenSpec;
}

export interface ScreenSpec {
  x: number;
  y: number;
  width: number;
}

/**
 * Flattened seat used internally for rendering + hit-testing.
 * Absolute coordinates already account for the section's transform.
 */
export interface FlatSeat extends Seat {
  sectionId: string;
  sectionLabel: string;
  rowIndex: number;
  absX: number;
  absY: number;
}