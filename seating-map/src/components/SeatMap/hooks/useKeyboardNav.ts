import { useCallback, useState } from "react";
import type { FlatSeat } from "../../../types/venue";

interface UseKeyboardNavArgs {
  seats: FlatSeat[];
  onActivate: (seat: FlatSeat) => void;
}

/**
 * Canvas has no native focusable DOM nodes, so keyboard navigation is
 * implemented as a "virtual focus": we track the focused seat's index and
 * move it with arrow keys, based on nearest-neighbor in the direction pressed.
 * The canvas draws a focus ring around whichever seat is currently focused,
 * and a visually-hidden live region (rendered by the parent) announces it.
 */
export function useKeyboardNav({ seats, onActivate }: UseKeyboardNavArgs) {
  const [focusedIndex, setFocusedIndex] = useState<number>(seats.length > 0 ? 0 : -1);

  const focusedSeat = focusedIndex >= 0 ? seats[focusedIndex] ?? null : null;

  const moveFocus = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (focusedIndex < 0 || seats.length === 0) return;
      const current = seats[focusedIndex];
      if (!current) return;

      let best: number = -1;
      let bestScore = Infinity;

      for (let i = 0; i < seats.length; i++) {
        if (i === focusedIndex) continue;
        const candidate = seats[i];
        if (!candidate) continue;
        const dx = candidate.absX - current.absX;
        const dy = candidate.absY - current.absY;

        const matchesDirection =
          (direction === "up" && dy < -1) ||
          (direction === "down" && dy > 1) ||
          (direction === "left" && dx < -1) ||
          (direction === "right" && dx > 1);

        if (!matchesDirection) continue;

        // Prefer seats mostly aligned on the perpendicular axis (same row/col)
        // and close along the movement axis.
        const primary = direction === "up" || direction === "down" ? Math.abs(dy) : Math.abs(dx);
        const secondary = direction === "up" || direction === "down" ? Math.abs(dx) : Math.abs(dy);
        const score = primary + secondary * 3;

        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }

      if (best >= 0) setFocusedIndex(best);
    },
    [focusedIndex, seats],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveFocus("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          moveFocus("down");
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveFocus("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          moveFocus("right");
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedSeat) onActivate(focusedSeat);
          break;
        default:
          break;
      }
    },
    [moveFocus, focusedSeat, onActivate],
  );

  return { focusedSeat, focusedIndex, setFocusedIndex, handleKeyDown };
}
