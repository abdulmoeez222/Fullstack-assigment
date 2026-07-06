/**
 * Generates public/venue.json with exactly 1000 seats:
 * 10 sections (A-J), each having 100 seats (10x10 grid).
 * Configured in a wide, curved 5x2 amphitheater grid.
 * Run with: npm run generate:venue (or pnpm generate:venue)
 */
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type SeatStatus = "available" | "reserved" | "sold" | "held";

const STATUSES: SeatStatus[] = ["available", "available", "available", "reserved", "sold", "held"];

function randomStatus(): SeatStatus {
  return STATUSES[Math.floor(Math.random() * STATUSES.length)] as SeatStatus;
}

const SECTION_COUNT = 10;
const ROWS_PER_SECTION = 10;
const SEATS_PER_ROW = 10; // 10 * 10 * 10 = 1000 seats

const SEAT_SPACING_X = 18;
const SEAT_SPACING_Y = 18;
const SECTION_WIDTH = (SEATS_PER_ROW - 1) * SEAT_SPACING_X; // 162px
const SECTION_HEIGHT = (ROWS_PER_SECTION - 1) * SEAT_SPACING_Y; // 162px

const LEFT_PADDING = 40;
const SECTION_COL_GAP = 28;
const SECTION_ROW_GAP = 36;
const TOP_PADDING = 120;
const BOTTOM_PADDING = 50;

const MAP_WIDTH = LEFT_PADDING + 5 * SECTION_WIDTH + 4 * SECTION_COL_GAP + LEFT_PADDING; // 1002px
const X_MID = MAP_WIDTH / 2; // 501px

function buildSection(sectionIndex: number) {
  const id = String.fromCharCode(65 + sectionIndex); // A, B, C...
  const colIndex = sectionIndex % 5; // 0 to 4 (columns of sections)
  const rowIndex = Math.floor(sectionIndex / 5); // 0 or 1 (rows of sections: A-E in front, F-J in back)

  const sectionX = LEFT_PADDING + colIndex * (SECTION_WIDTH + SECTION_COL_GAP);
  const sectionY = TOP_PADDING + rowIndex * (SECTION_HEIGHT + SECTION_ROW_GAP);

  // Price tier: 4 for front sections A-E, 2 for back sections F-J
  const priceTier = rowIndex === 0 ? 4 : 2;
  const rows = [];

  for (let r = 1; r <= ROWS_PER_SECTION; r++) {
    const seats = [];
    for (let c = 1; c <= SEATS_PER_ROW; c++) {
      // Flat coordinates
      const localX = (c - 1) * SEAT_SPACING_X;
      const localY = (r - 1) * SEAT_SPACING_Y;
      const flatX = sectionX + localX;
      const flatY = sectionY + localY;

      // Parabolic curve: bends down on the sides
      const dx = flatX - X_MID;
      const curvedY = flatY + (dx * dx) * 0.0001;

      seats.push({
        id: `${id}-${r}-${String(c).padStart(2, "0")}`,
        col: c,
        x: flatX,
        y: curvedY,
        priceTier,
        status: randomStatus(),
      });
    }
    rows.push({ index: r, seats });
  }

  return {
    id,
    label: `Section ${id}`,
    transform: { x: 0, y: 0, scale: 1 },
    rows,
  };
}

const sections = Array.from({ length: SECTION_COUNT }, (_, i) => buildSection(i));

// Calculate final height dynamically
const mapHeight = Math.ceil(TOP_PADDING + 2 * SECTION_HEIGHT + SECTION_ROW_GAP + BOTTOM_PADDING + 25);

const venue = {
  venueId: "arena-01",
  name: "Metropolis Arena",
  map: {
    width: MAP_WIDTH,
    height: mapHeight,
  },
  screen: {
    x: X_MID,
    y: 35,
  },
  sections,
};

const outPath = resolve(__dirname, "../public/venue.json");
writeFileSync(outPath, JSON.stringify(venue));

console.log(`Generated wide layout with ${SECTION_COUNT * ROWS_PER_SECTION * SEATS_PER_ROW} seats -> ${outPath}`);
