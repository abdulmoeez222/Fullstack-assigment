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

  // Compute global row depth from front to back of arena (1 to 20)
  const sectionLetter = (seat.sectionId ?? "A").toUpperCase();
  const sectionNum = sectionLetter.charCodeAt(0) - 65; // A=0, B=1...
  const sectionRowIndex = Math.max(0, Math.floor(sectionNum / 5)); // A-E = 0, F-J = 1
  const globalRow = sectionRowIndex * 10 + seat.rowIndex; // 1 to 20
  
  // Normalized row depth (0 = front row, 1 = back row)
  const t = clamp((globalRow - 1) / 19, 0, 1);

  // Hypotenuse distance:
  // Front row is at 5m depth. Horizontal distance increases by 2.5m per row.
  // Elevation height increases by 0.8m per row.
  const dHoriz = 5 + (globalRow - 1) * 2.5;
  const hElevation = (globalRow - 1) * 0.8;
  const dist3D = Math.sqrt(dHoriz * dHoriz + hElevation * hElevation);

  // Scale (zoom): Front row (top seats) is at 1.0 (default view). Moving to back rows zooms out to 0.55.
  const scale = 1.0 - t * 0.45;

  // Pan Y (elevation angle):
  // Front row is at level view (panY = 0). Moving to back rows looks down from above (panY = 12).
  const panY = t * 12;

  // Pan X: Side seats look at stage from an angle.
  // The side perspective is compressed as you move further back (lower t).
  const panX = -nx * 15 * (1 - t * 0.45);

  return {
    scale,
    panX,
    panY,
    t,
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
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

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
    if (!viewSeat || !venue) return { scale: 1, panX: 0, panY: 0, t: 0, dist: 0 };
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

        {/* ── Foreground seats simulating 3D view perspective ── */}
        <div
          className="cinema-fg-seats"
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "220px",
            zIndex: 10,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "center",
            opacity: 0.88,
            transform: `translateY(${viewSeat ? (1 - viewTransform.t) * 120 : 60}px)`,
            transition: "opacity 0.75s cubic-bezier(0.4, 0, 0.2, 1), transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Row 1 (Further row, more blurred, smaller) */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "24px",
              width: "140%",
              transform: `translateX(${viewTransform.panX * 1.5}%)`,
              transition: "transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)",
              marginBottom: "-10px",
            }}
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <svg
                key={`fg-r1-${i}`}
                viewBox="0 0 100 100"
                style={{
                  width: "42px",
                  height: "42px",
                  fill: "#0a0a14",
                  stroke: "rgba(99, 102, 241, 0.15)",
                  strokeWidth: "2px",
                  filter: "blur(2px)",
                }}
              >
                <path d="M86.667,40h-10v13.333l0.003,0.004h-0.003c0,3.682-2.985,6.666-6.667,6.666V60H30c-3.682,0-6.667-2.985-6.667-6.667V40h-10v6.667h3.334v6.666c0,7.363,5.97,13.334,13.333,13.334v6.666h16.667v10h-10V90h26.666v-6.667h-10v-10H70V66.67c7.363,0,13.333-5.97,13.333-13.333H83.33l0.003-0.004v-6.666h3.334V40z"/>
                <path d="M63.333,16.667h-1.666V20c0,4.597-3.737,8.333-8.334,8.333h-6.666c-4.597,0-8.334-3.736-8.334-8.333v-3.333h-1.666c-3.682,0-6.667,2.982-6.667,6.667v30h40v-30C70,19.648,67.019,16.667,63.333,16.667z"/>
                <path d="M56.667,20c0,1.833-1.501,3.333-3.334,3.333h-6.666c-1.833,0-3.334-1.501-3.334-3.333v-6.667c0-1.833,1.501-3.333,3.334-3.333h6.666c1.833,0,3.334,1.5,3.334,3.333V20z"/>
              </svg>
            ))}
          </div>

          {/* Row 2 (Closer row, less blurred, larger, offset) */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "36px",
              width: "160%",
              transform: `translateX(${viewTransform.panX * 2.2}%)`,
              transition: "transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)",
              marginBottom: "-20px",
            }}
          >
            {Array.from({ length: 11 }).map((_, i) => (
              <svg
                key={`fg-r2-${i}`}
                viewBox="0 0 100 100"
                style={{
                  width: "56px",
                  height: "56px",
                  fill: "#05050a",
                  stroke: "rgba(99, 102, 241, 0.12)",
                  strokeWidth: "1.5px",
                  filter: "blur(3.5px)",
                }}
              >
                <path d="M86.667,40h-10v13.333l0.003,0.004h-0.003c0,3.682-2.985,6.666-6.667,6.666V60H30c-3.682,0-6.667-2.985-6.667-6.667V40h-10v6.667h3.334v6.666c0,7.363,5.97,13.334,13.333,13.334v6.666h16.667v10h-10V90h26.666v-6.667h-10v-10H70V66.67c7.363,0,13.333-5.97,13.333-13.333H83.33l0.003-0.004v-6.666h3.334V40z"/>
                <path d="M63.333,16.667h-1.666V20c0,4.597-3.737,8.333-8.334,8.333h-6.666c-4.597,0-8.334-3.736-8.334-8.333v-3.333h-1.666c-3.682,0-6.667,2.982-6.667,6.667v30h40v-30C70,19.648,67.019,16.667,63.333,16.667z"/>
                <path d="M56.667,20c0,1.833-1.501,3.333-3.334,3.333h-6.666c-1.833,0-3.334-1.501-3.334-3.333v-6.667c0-1.833,1.501-3.333,3.334-3.333h6.666c1.833,0,3.334,1.5,3.334,3.333V20z"/>
              </svg>
            ))}
          </div>
        </div>
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
      <div className={`cinema-map-panel ${isPanelCollapsed ? "cinema-map-panel--collapsed" : ""}`}>
        <div className="cinema-map-panel__header">
          <span className="cinema-map-panel__title">STAGE</span>
          <div className="cinema-map-panel__stage-indicator" />
          <span className="cinema-map-panel__subtitle">Choose a seat</span>
          <button
            type="button"
            className="cinema-map-panel__toggle-btn"
            onClick={() => setIsPanelCollapsed((prev) => !prev)}
            aria-label={isPanelCollapsed ? "Expand seating map" : "Collapse seating map"}
          >
            {isPanelCollapsed ? "▲" : "▼"}
          </button>
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
