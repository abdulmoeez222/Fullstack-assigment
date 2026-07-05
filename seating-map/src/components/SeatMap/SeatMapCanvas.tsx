import { useEffect, useMemo, useRef } from "react";
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

const STATUS_COLORS: Record<SeatStatus, string> = {
  available: "#4ade80",
  reserved: "#fbbf24",
  sold: "#4b5563",
  held: "#fb923c",
};

const SEAT_RADIUS = 5;
const SELECTED_COLOR = "#818cf8";
const FOCUS_RING_COLOR = "rgba(255,255,255,0.9)";

function isSelectable(status: SeatStatus): boolean {
  return status === "available";
}

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

  // Built once per venue load — O(n), not per-frame.
  const grid = useMemo(() => new SpatialGrid(seats), [seats]);

  const { focusedSeat, handleKeyDown } = useKeyboardNav({ seats, onActivate: onSeatActivate });

  // Draw. Runs on seats/selection/focus change — not a render loop, since
  // nothing here is animating; this keeps CPU usage near zero at idle.
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
      ctx.beginPath();
      ctx.arc(seat.absX, seat.absY, SEAT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = selected ? SELECTED_COLOR : STATUS_COLORS[seat.status];
      ctx.fill();

      if (focusedSeat && focusedSeat.id === seat.id) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = FOCUS_RING_COLOR;
        ctx.beginPath();
        ctx.arc(seat.absX, seat.absY, SEAT_RADIUS + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [seats, selectedIds, focusedSeat, mapWidth, mapHeight]);

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
