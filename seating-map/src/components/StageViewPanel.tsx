import { useEffect, useRef, useState } from "react";
import type { FlatSeat } from "../types/venue";

interface StageViewPanelProps {
  seat: FlatSeat | null;
  mapWidth: number;
  mapHeight: number;
  screenX?: number;
  screenY?: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function computeView(
  seatX: number,
  seatY: number,
  screenX: number,
  screenY: number,
  mapWidth: number,
  mapHeight: number
) {
  const nx = clamp((seatX - screenX) / (mapWidth / 2), -1, 1);
  const ny = clamp((seatY - screenY) / (mapHeight / 2), -1, 1);
  const originX = 50 + nx * 30;
  const originY = 50 + ny * 20;
  const rotateX = clamp(ny * 30, -35, 35);
  const rotateY = clamp(-nx * 20, -25, 25);
  return { originX, originY, rotateX, rotateY };
}

export function StageViewPanel({
  seat,
  mapWidth,
  mapHeight,
  screenX,
  screenY,
}: StageViewPanelProps) {
  const defaultScreenX = screenX ?? mapWidth / 2;
  const defaultScreenY = screenY ?? 10;

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setImgLoaded(true);
    }
  }, []);

  const view = seat
    ? computeView(seat.absX, seat.absY, defaultScreenX, defaultScreenY, mapWidth, mapHeight)
    : { originX: 50, originY: 30, rotateX: -5, rotateY: 0 };

  const label = seat
    ? `${seat.sectionLabel} \u00B7 Row ${seat.rowIndex} \u00B7 Seat ${seat.col}`
    : null;

  return (
    <div className="stage-view" aria-label="View from seat">
      <div className="stage-view__header">
        <span className="stage-view__icon">&#127917;</span>
        <div>
          <h3 className="stage-view__title">View from your seat</h3>
          {label ? (
            <p className="stage-view__label">{label}</p>
          ) : (
            <p className="stage-view__label stage-view__label--empty">
              Hover or select a seat to preview
            </p>
          )}
        </div>
      </div>

      <div className="stage-view__viewport">
        <div
          className="stage-view__scene"
          style={{
            perspectiveOrigin: `${view.originX}% ${view.originY}%`,
          }}
        >
          <div
            className="stage-view__screen-wrap"
            style={{
              transform: `rotateX(${view.rotateX}deg) rotateY(${view.rotateY}deg)`,
            }}
          >
            {!imgError ? (
              <img
                ref={imgRef}
                src="/screen.jpg"
                alt="Arena stage view"
                className={`stage-view__img ${imgLoaded ? "stage-view__img--loaded" : ""}`}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                draggable={false}
              />
            ) : null}

            {(!imgLoaded || imgError) && (
              <div className="stage-view__placeholder">
                <div className="stage-view__placeholder-inner">
                  <span className="stage-view__placeholder-icon">&#127916;</span>
                  <span className="stage-view__placeholder-text">
                    {imgError ? "Add screen.jpg to public/" : "Loading\u2026"}
                  </span>
                </div>
              </div>
            )}

            <div className="stage-view__glow" />
          </div>
        </div>

        {seat && (
          <div className="stage-view__badge">
            {Math.round(
              Math.hypot(seat.absX - defaultScreenX, seat.absY - defaultScreenY)
            )}{" "}
            units away
          </div>
        )}
      </div>
    </div>
  );
}
