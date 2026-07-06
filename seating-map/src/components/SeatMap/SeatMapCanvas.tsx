import { useEffect, useMemo, useRef, useState } from "react";
import type { FlatSeat, SeatStatus } from "../../types/venue";
import { SpatialGrid } from "../../utils/spatialIndex";
import { useKeyboardNav } from "./hooks/useKeyboardNav";

interface SeatMapCanvasProps {
  seats: FlatSeat[];
  mapWidth: number;
  mapHeight: number;
  selectedIds: ReadonlySet<string>;
  onSeatActivate: (seat: FlatSeat) => void;
  onSeatHover: (seat: FlatSeat | null) => void;
}

const STATUS_COLORS: Record<SeatStatus | "selected", string> = {
  available: "#4ade80",
  reserved: "#fbbf24",
  sold: "#4b5563",
  held: "#fb923c",
  selected: "#818cf8",
};

const SEAT_RADIUS = 5;
const SEAT_SIZE = 13;
const FOCUS_RING_COLOR = "rgba(255,255,255,0.9)";

function isSelectable(status: SeatStatus): boolean {
  return status === "available";
}

// Seat SVG paths from seats.svg
const SEAT_SVG_CONTENT = `
<path d="M86.667,40h-10v13.333l0.003,0.004h-0.003c0,3.682-2.985,6.666-6.667,6.666V60H30c-3.682,0-6.667-2.985-6.667-6.667V40h-10v6.667h3.334v6.666c0,7.363,5.97,13.334,13.333,13.334v6.666h16.667v10h-10V90h26.666v-6.667h-10v-10H70V66.67c7.363,0,13.333-5.97,13.333-13.333H83.33l0.003-0.004v-6.666h3.334V40z"/>
<path d="M63.333,16.667h-1.666V20c0,4.597-3.737,8.333-8.334,8.333h-6.666c-4.597,0-8.334-3.736-8.334-8.333v-3.333h-1.666c-3.682,0-6.667,2.982-6.667,6.667v30h40v-30C70,19.648,67.019,16.667,63.333,16.667z"/>
<path d="M56.667,20c0,1.833-1.501,3.333-3.334,3.333h-6.666c-1.833,0-3.334-1.501-3.334-3.333v-6.667c0-1.833,1.501-3.333,3.334-3.333h6.666c1.833,0,3.334,1.5,3.334,3.333V20z"/>
`.trim();

export function SeatMapCanvas({
  seats,
  mapWidth,
  mapHeight,
  selectedIds,
  onSeatActivate,
  onSeatHover,
}: SeatMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dprRef = useRef<number>(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Load and cache SVG icons for each status color
  useEffect(() => {
    let loadedCount = 0;
    const entries = Object.entries(STATUS_COLORS);
    const total = entries.length;

    entries.forEach(([key, color]) => {
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="${encodeURIComponent(color)}">
          ${SEAT_SVG_CONTENT}
        </svg>
      `.trim();
      
      const img = new Image();
      img.src = `data:image/svg+xml;utf8,${svgString}`;
      img.onload = () => {
        imagesRef.current.set(key, img);
        loadedCount++;
        if (loadedCount === total) {
          setImagesLoaded(true);
        }
      };
    });
  }, []);

  // Built once per venue load — O(n), not per-frame.
  const grid = useMemo(() => new SpatialGrid(seats), [seats]);

  const { focusedSeat, handleKeyDown } = useKeyboardNav({ seats, onActivate: onSeatActivate });

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = dprRef.current;
    canvas.width = mapWidth * dpr;
    canvas.height = mapHeight * dpr;
    canvas.style.width = `${mapWidth}px`;
    canvas.style.height = `${mapHeight}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, mapWidth, mapHeight);
    ctx.fillStyle = "rgba(15, 15, 28, 0)";
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    for (const seat of seats) {
      const selected = selectedIds.has(seat.id);
      const key = selected ? "selected" : seat.status;
      const img = imagesRef.current.get(key);

      if (img) {
        ctx.drawImage(img, seat.absX - SEAT_SIZE / 2, seat.absY - SEAT_SIZE / 2, SEAT_SIZE, SEAT_SIZE);
      } else {
        // Fallback to dot if image not loaded yet
        ctx.beginPath();
        ctx.arc(seat.absX, seat.absY, SEAT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = STATUS_COLORS[key];
        ctx.fill();
      }

      if (focusedSeat && focusedSeat.id === seat.id) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = FOCUS_RING_COLOR;
        ctx.beginPath();
        ctx.arc(seat.absX, seat.absY, SEAT_SIZE / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [seats, selectedIds, focusedSeat, mapWidth, mapHeight, imagesLoaded]);

  function getSeatFromEvent(e: React.MouseEvent<HTMLCanvasElement>): FlatSeat | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = mapWidth / rect.width;
    const scaleY = mapHeight / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return grid.findNearest(x, y);
  }

  return (
    <div ref={containerRef} className="seat-map-wrapper">
      <canvas
        ref={canvasRef}
        role="application"
        aria-label={`Seating map, ${seats.length} seats. Use arrow keys to move focus, Enter to select.`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          const seat = getSeatFromEvent(e);
          if (seat) onSeatActivate(seat);
        }}
        onMouseMove={(e) => {
          const seat = getSeatFromEvent(e);
          onSeatHover(seat);
        }}
        onMouseLeave={() => onSeatHover(null)}
      />
      {/* Visually hidden live region so screen readers announce the virtually
          focused seat, since the canvas itself has no per-seat DOM nodes. */}
      <div aria-live="polite" className="visually-hidden">
        {focusedSeat
          ? `${focusedSeat.sectionLabel}, row ${focusedSeat.rowIndex}, seat ${focusedSeat.col}, ` +
            `price tier ${focusedSeat.priceTier}, ${focusedSeat.status}` +
            (isSelectable(focusedSeat.status) ? "" : ", not available")
          : ""}
      </div>
    </div>
  );
}
