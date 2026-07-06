import { useCallback, useEffect, useMemo, useState } from "react";
import { flattenVenue, loadVenue } from "./data/loadVenue";
import type { FlatSeat, Venue } from "./types/venue";
import { SeatMapCanvas } from "./components/SeatMap/SeatMapCanvas";
import { FpsCounter } from "./components/SeatMap/FpsCounter";
import { SelectionSummary } from "./components/SelectionSummary";
import {
  initialSelectionState,
  selectionReducer,
  type SelectionState,
} from "./state/selectionStore";
import { debounce, readPersistedSelection, writePersistedSelection } from "./state/persistence";
import { formatCurrency, priceForTier } from "./utils/price";

const persistDebounced = debounce(writePersistedSelection, 300);

/** Clamp a number between min and max */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Compute a "view from seat" transform:
 *  - scale: close seats => zoomed in (>1), far seats => zoomed out (<1)
 *  - translateX/Y: image pans toward where the stage is relative to the seat
 */
function computeSeatView(
  seat: FlatSeat,
  screenX: number,
  mapWidth: number
) {
  // Horizontal offset relative to center stage: -1 (far left) to +1 (far right)
  const dx = seat.absX - screenX;
  const nx = clamp(dx / (mapWidth / 2), -1, 1);

  // Compute global row depth from front to back of arena (1 to 50)
  const sectionLetter = (seat.sectionId ?? "A").toUpperCase();
  const sectionNum = sectionLetter.charCodeAt(0) - 65; // A=0, B=1...
  const sectionRowIndex = Math.max(0, Math.floor(sectionNum / 2)); // 0 to 4
  const globalRow = sectionRowIndex * 10 + seat.rowIndex; // 1 to 50
  
  // Normalized row depth (0 = front row, 1 = back row)
  const t = clamp((globalRow - 1) / 49, 0, 1);

  // Hypotenuse distance:
  // Front row is at 5m depth. Horizontal distance increases by 1.5m per row.
  // Elevation height increases by 0.6m per row.
  const dHoriz = 5 + (globalRow - 1) * 1.5;
  const hElevation = (globalRow - 1) * 0.6;
  const dist3D = Math.sqrt(dHoriz * dHoriz + hElevation * hElevation);

  // Scale (zoom): Back row is at 1.0 (default unscaled view), zooming in to 2.2 for front rows.
  const scale = 2.2 - t * 1.2;

  // Pan Y (elevation angle):
  // Front row looks up (panY = -14), back row is level (panY = 0) matching default view.
  const panY = -14 + t * 14;

  // Pan X: Side seats look at stage from an angle.
  // The side perspective is compressed as you move further back (lower t).
  const panX = -nx * 18 * (1 - t * 0.45);

  return {
    scale,
    panX,
    panY,
    dist: Math.round(dist3D),
  };
}

export default function App() {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>(initialSelectionState());
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [activeSeat, setActiveSeat] = useState<FlatSeat | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<FlatSeat | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const seats = useMemo(() => (venue ? flattenVenue(venue) : []), [venue]);
  const seatsById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);

  // Load venue once on mount
  useEffect(() => {
    let cancelled = false;
    loadVenue()
      .then((v) => { if (!cancelled) setVenue(v); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load venue");
      });
    return () => { cancelled = true; };
  }, []);

  // Hydrate persisted selection
  useEffect(() => {
    if (seats.length === 0) return;
    const persisted = readPersistedSelection().filter((id) => seatsById.has(id));
    if (persisted.length > 0) {
      setSelection((prev) => selectionReducer(prev, { type: "HYDRATE", seatIds: persisted }).state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats.length]);

  // Persist on every change (debounced)
  useEffect(() => {
    persistDebounced(Array.from(selection.selectedIds));
  }, [selection.selectedIds]);

  const handleSeatActivate = useCallback(
    (seat: FlatSeat) => {
      setActiveSeat(seat);
      const result = selectionReducer(selection, {
        type: "TOGGLE",
        seatId: seat.id,
        selectable: seat.status === "available",
      });
      setSelection(result.state);
      if (result.rejected === "MAX_REACHED") {
        setRejectionMessage("You can select up to 8 seats.");
      } else if (result.rejected === "NOT_SELECTABLE") {
        setRejectionMessage(`This seat is ${seat.status}.`);
      } else {
        setRejectionMessage(null);
      }
    },
    [selection]
  );

  const handleRemove = useCallback((seatId: string) => {
    setSelection((prev) => selectionReducer(prev, { type: "REMOVE", seatId }).state);
  }, []);

  const handleClear = useCallback(() => {
    setSelection((prev) => selectionReducer(prev, { type: "CLEAR" }).state);
  }, []);

  const selectedSeats = useMemo(
    () =>
      Array.from(selection.selectedIds)
        .map((id) => seatsById.get(id))
        .filter((s): s is FlatSeat => s !== undefined),
    [selection.selectedIds, seatsById]
  );

  const subtotal = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + priceForTier(s.priceTier), 0),
    [selectedSeats]
  );

  // The "current seat" for the view effect — hovered seat takes priority
  const viewSeat = hoveredSeat ?? activeSeat;

  // Screen position
  const screenX = venue?.screen?.x ?? (venue ? venue.map.width / 2 : 200);

  // Compute the camera transform
  const viewTransform = useMemo(() => {
    if (!viewSeat || !venue) return { scale: 1, panX: 0, panY: 0, dist: 0 };
    return computeSeatView(viewSeat, screenX, venue.map.width);
  }, [viewSeat, screenX, venue]);

  if (error) {
    return (
      <div className="app-error" role="alert">
        Couldn't load the seating map: {error}
      </div>
    );
  }

  if (!venue) {
    return <div className="app-loading">Loading seating map…</div>;
  }

  return (
    <div className="cinema-root">
      {/* ── Full-viewport arena screen background ── */}
      <div className="cinema-bg">
        {/* Vignette / ambient dark overlay */}
        <div className="cinema-bg__vignette" />

        {/* The main arena/screen image — zooms & pans based on seat */}
        <div
          className="cinema-bg__img-wrap"
          style={{
            transform: `scale(${viewTransform.scale}) translate(${viewTransform.panX}%, ${viewTransform.panY}%)`,
          }}
        >
          {!imgError && (
            <img
              src="/saitama.jpg"
              alt="Arena stage"
              className={`cinema-bg__img ${imgLoaded ? "cinema-bg__img--loaded" : ""}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              draggable={false}
            />
          )}
          {(!imgLoaded || imgError) && (
            <div className="cinema-bg__fallback">
              <div className="cinema-bg__fallback-screen">
                <span className="cinema-bg__fallback-icon">🎬</span>
                <p className="cinema-bg__fallback-hint">
                  {imgError
                    ? "Could not load saitama.jpg"
                    : "Loading…"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom fade so the seat map panel blends in */}
        <div className="cinema-bg__bottom-fade" />
      </div>

      {/* ── Top-left: venue/event info ── */}
      <header className="cinema-header">
        <p className="cinema-header__eyebrow">{venue.name}</p>
        <h1 className="cinema-header__title">Select Your Seat</h1>
        {rejectionMessage && (
          <p className="cinema-header__notice" role="status">
            {rejectionMessage}
          </p>
        )}
      </header>

      {/* ── Top-right: price chip ── */}
      {selectedSeats.length > 0 && (
        <div className="cinema-price-chip">
          <span className="cinema-price-chip__label">Subtotal</span>
          <span className="cinema-price-chip__value">{formatCurrency(subtotal)}</span>
        </div>
      )}

      {/* ── Bottom-left: seat info overlay ── */}
      <div className="cinema-seat-info">
        {viewSeat ? (
          <>
            <p className="cinema-seat-info__location">
              {viewSeat.sectionLabel} · Row {viewSeat.rowIndex} · Seat {viewSeat.col}
            </p>
            <div className="cinema-seat-info__meta">
              <span className={`cinema-seat-info__status cinema-seat-info__status--${viewSeat.status}`}>
                {viewSeat.status}
              </span>
              <span className="cinema-seat-info__price">
                {formatCurrency(priceForTier(viewSeat.priceTier))}
              </span>
              <span className="cinema-seat-info__dist">
                {viewTransform.dist}u from stage
              </span>
            </div>
          </>
        ) : (
          <p className="cinema-seat-info__empty">Hover or click a seat to preview the view</p>
        )}
      </div>

      {/* ── Floating seat map panel (bottom-center) ── */}
      <div className="cinema-map-panel">
        <div className="cinema-map-panel__header">
          <span className="cinema-map-panel__title">STAGE</span>
          <div className="cinema-map-panel__stage-indicator" />
          <span className="cinema-map-panel__subtitle">Choose a seat</span>
        </div>

        <div className="cinema-map-panel__canvas-wrap">
          <SeatMapCanvas
            seats={seats}
            mapWidth={venue.map.width}
            mapHeight={venue.map.height}
            selectedIds={selection.selectedIds}
            onSeatActivate={handleSeatActivate}
            onSeatHover={setHoveredSeat}
          />
        </div>

        {/* Legend */}
        <div className="cinema-map-panel__legend">
          {(["available", "reserved", "sold", "held"] as const).map((s) => (
            <span key={s} className="cinema-map-panel__legend-item">
              <span className={`cinema-map-panel__legend-dot cinema-map-panel__legend-dot--${s}`} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── Bottom-right: confirm / summary button ── */}
      <div className="cinema-confirm">
        {selectedSeats.length > 0 && (
          <>
            <button
              type="button"
              className="cinema-confirm__btn"
              onClick={() => setShowSummary((v) => !v)}
            >
              {showSummary ? "Hide" : `Confirm · ${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""}`}
            </button>
            {showSummary && (
              <div className="cinema-summary-popup">
                <SelectionSummary
                  selectedSeats={selectedSeats}
                  onRemove={handleRemove}
                  onClear={handleClear}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FPS Counter HUD ── */}
      <FpsCounter />
    </div>
  );
}
