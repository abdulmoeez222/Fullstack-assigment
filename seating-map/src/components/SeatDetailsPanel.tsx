import type { FlatSeat } from "../types/venue";
import { formatCurrency, priceForTier } from "../utils/price";

interface SeatDetailsPanelProps {
  seat: FlatSeat | null;
}

export function SeatDetailsPanel({ seat }: SeatDetailsPanelProps) {
  if (!seat) {
    return (
      <aside className="seat-details" aria-label="Seat details">
        <p className="seat-details__empty">Select or focus a seat to see details.</p>
      </aside>
    );
  }

  return (
    <aside className="seat-details" aria-label="Seat details">
      <h2>{seat.sectionLabel}</h2>
      <dl>
        <div>
          <dt>Row</dt>
          <dd>{seat.rowIndex}</dd>
        </div>
        <div>
          <dt>Seat</dt>
          <dd>{seat.col}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{formatCurrency(priceForTier(seat.priceTier))}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd className={`status status--${seat.status}`}>{seat.status}</dd>
        </div>
      </dl>
    </aside>
  );
}
