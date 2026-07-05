/**
 * Generates public/venue.json with a configurable seat count so we can test
 * rendering/interaction performance at the ~15,000-seat scale the spec calls
 * for. Run with: pnpm generate:venue
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

const SECTION_COUNT = 8;
const ROWS_PER_SECTION = 25;
const SEATS_PER_ROW = 75; // 8 * 25 * 75 = 15,000 seats
const SEAT_SPACING_X = 28;
const SEAT_SPACING_Y = 32;
const SECTION_GAP_X = SEATS_PER_ROW * SEAT_SPACING_X + 60;

function buildSection(sectionIndex: number) {
  const id = String.fromCharCode(65 + sectionIndex); // A, B, C...
  const rows = [];

  for (let r = 1; r <= ROWS_PER_SECTION; r++) {
    const seats = [];
    for (let c = 1; c <= SEATS_PER_ROW; c++) {
      seats.push({
        id: `${id}-${r}-${String(c).padStart(2, "0")}`,
        col: c,
        x: c * SEAT_SPACING_X,
        y: r * SEAT_SPACING_Y,
        priceTier: Math.ceil(r / (ROWS_PER_SECTION / 5)), // 1 (front) .. 5 (back)
        status: randomStatus(),
      });
    }
    rows.push({ index: r, seats });
  }

  return {
    id,
    label: `Section ${id}`,
    transform: { x: sectionIndex * SECTION_GAP_X, y: 0, scale: 1 },
    rows,
  };
}

const sections = Array.from({ length: SECTION_COUNT }, (_, i) => buildSection(i));

const venue = {
  venueId: "arena-01",
  name: "Metropolis Arena",
  map: {
    width: SECTION_COUNT * SECTION_GAP_X,
    height: ROWS_PER_SECTION * SEAT_SPACING_Y + 60,
  },
  sections,
};

const outPath = resolve(__dirname, "../public/venue.json");
writeFileSync(outPath, JSON.stringify(venue));

const totalSeats = SECTION_COUNT * ROWS_PER_SECTION * SEATS_PER_ROW;
console.log(`Generated ${totalSeats} seats -> ${outPath}`);
