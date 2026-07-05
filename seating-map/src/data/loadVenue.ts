import type { FlatSeat, Venue } from "../types/venue";

export async function loadVenue(url = "/venue.json"): Promise<Venue> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load venue data: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as Venue;
  return data;
}

/**
 * Flattens the nested section/row/seat structure into a single array,
 * applying each section's transform to produce absolute canvas coordinates.
 * Flattening once up front means render + hit-test code never has to walk
 * the tree, which matters a lot once we're at ~15k seats.
 */
export function flattenVenue(venue: Venue): FlatSeat[] {
  const flat: FlatSeat[] = [];

  for (const section of venue.sections) {
    const { x: tx, y: ty, scale } = section.transform;
    for (const row of section.rows) {
      for (const seat of row.seats) {
        flat.push({
          ...seat,
          sectionId: section.id,
          sectionLabel: section.label,
          rowIndex: row.index,
          absX: tx + seat.x * scale,
          absY: ty + seat.y * scale,
        });
      }
    }
  }

  return flat;
}
