import type { FlatSeat } from "../types/venue";
import { formatCurrency, priceForTier } from "../utils/price";
import { MAX_SELECTED_SEATS } from "../state/selectionStore";

interface SelectionSummaryProps {
  selectedSeats: FlatSeat[];
  onRemove: (seatId: string) => void;
  onClear: () => void;
}

export function SelectionSummary({ selectedSeats, onRemove, onClear }: SelectionSummaryProps) {
  const subtotal = selectedSeats.reduce((sum, seat) => sum + priceForTier(seat.priceTier), 0);

  return (
    <section className="selection-summary" aria-label="Selected seats summary">
      <h2>
        Your Seats ({selectedSeats.length}/{MAX_SELECTED_SEATS})
      </h2>

      {selectedSeats.length === 0 ? (
        <p className="selection-summary__empty">No seats selected yet.</p>
      ) : (
        <>
          <ul>
            {selectedSeats.map((seat) => (
              <li key={seat.id}>
                <span>
                  {seat.sectionLabel} · Row {seat.rowIndex} · Seat {seat.col}
                </span>
                <span>{formatCurrency(priceForTier(seat.priceTier))}</span>
                <button
                  type="button"
                  aria-label={`Remove ${seat.sectionLabel} row ${seat.rowIndex} seat ${seat.col}`}
                  onClick={() => onRemove(seat.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="selection-summary__subtotal">
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>

          <button type="button" className="selection-summary__clear" onClick={onClear}>
            Clear selection
          </button>
        </>
      )}
    </section>
  );
}
