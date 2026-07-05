export const MAX_SELECTED_SEATS = 8;

export interface SelectionState {
  selectedIds: ReadonlySet<string>;
}

export type SelectionAction =
  | { type: "TOGGLE"; seatId: string; selectable: boolean }
  | { type: "REMOVE"; seatId: string }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; seatIds: string[] };

export interface SelectionReducerResult {
  state: SelectionState;
  rejected?: "MAX_REACHED" | "NOT_SELECTABLE";
}

export function initialSelectionState(): SelectionState {
  return { selectedIds: new Set() };
}

/**
 * Pure reducer. Returns both the new state and an optional rejection reason
 * so the UI can surface feedback (e.g. "you can only select 8 seats") without
 * the reducer needing to know about toasts, alerts, etc.
 */
export function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionReducerResult {
  switch (action.type) {
    case "TOGGLE": {
      const next = new Set(state.selectedIds);
      if (next.has(action.seatId)) {
        next.delete(action.seatId);
        return { state: { selectedIds: next } };
      }
      if (!action.selectable) {
        return { state, rejected: "NOT_SELECTABLE" };
      }
      if (next.size >= MAX_SELECTED_SEATS) {
        return { state, rejected: "MAX_REACHED" };
      }
      next.add(action.seatId);
      return { state: { selectedIds: next } };
    }

    case "REMOVE": {
      if (!state.selectedIds.has(action.seatId)) return { state };
      const next = new Set(state.selectedIds);
      next.delete(action.seatId);
      return { state: { selectedIds: next } };
    }

    case "CLEAR":
      return { state: { selectedIds: new Set() } };

    case "HYDRATE":
      return {
        state: { selectedIds: new Set(action.seatIds.slice(0, MAX_SELECTED_SEATS)) },
      };

    default:
      return { state };
  }
}
