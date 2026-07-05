import { describe, expect, it } from "vitest";
import {
  MAX_SELECTED_SEATS,
  initialSelectionState,
  selectionReducer,
} from "../src/state/selectionStore";

describe("selectionReducer", () => {
  it("adds a selectable seat", () => {
    const state = initialSelectionState();
    const result = selectionReducer(state, { type: "TOGGLE", seatId: "A-1-01", selectable: true });
    expect(result.state.selectedIds.has("A-1-01")).toBe(true);
    expect(result.rejected).toBeUndefined();
  });

  it("toggles a seat off when selected again", () => {
    let state = initialSelectionState();
    state = selectionReducer(state, { type: "TOGGLE", seatId: "A-1-01", selectable: true }).state;
    const result = selectionReducer(state, { type: "TOGGLE", seatId: "A-1-01", selectable: true });
    expect(result.state.selectedIds.has("A-1-01")).toBe(false);
  });

  it("rejects selecting a non-selectable seat", () => {
    const state = initialSelectionState();
    const result = selectionReducer(state, { type: "TOGGLE", seatId: "A-1-02", selectable: false });
    expect(result.rejected).toBe("NOT_SELECTABLE");
    expect(result.state.selectedIds.size).toBe(0);
  });

  it("rejects adding beyond the max seat limit", () => {
    let state = initialSelectionState();
    for (let i = 0; i < MAX_SELECTED_SEATS; i++) {
      state = selectionReducer(state, { type: "TOGGLE", seatId: `seat-${i}`, selectable: true }).state;
    }
    expect(state.selectedIds.size).toBe(MAX_SELECTED_SEATS);

    const result = selectionReducer(state, {
      type: "TOGGLE",
      seatId: "one-too-many",
      selectable: true,
    });
    expect(result.rejected).toBe("MAX_REACHED");
    expect(result.state.selectedIds.size).toBe(MAX_SELECTED_SEATS);
  });

  it("removes a seat explicitly", () => {
    let state = initialSelectionState();
    state = selectionReducer(state, { type: "TOGGLE", seatId: "A-1-01", selectable: true }).state;
    const result = selectionReducer(state, { type: "REMOVE", seatId: "A-1-01" });
    expect(result.state.selectedIds.has("A-1-01")).toBe(false);
  });

  it("clears all selections", () => {
    let state = initialSelectionState();
    state = selectionReducer(state, { type: "TOGGLE", seatId: "A-1-01", selectable: true }).state;
    state = selectionReducer(state, { type: "TOGGLE", seatId: "A-1-02", selectable: true }).state;
    const result = selectionReducer(state, { type: "CLEAR" });
    expect(result.state.selectedIds.size).toBe(0);
  });

  it("hydrates from persisted ids, capped at the max", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `seat-${i}`);
    const result = selectionReducer(initialSelectionState(), { type: "HYDRATE", seatIds: ids });
    expect(result.state.selectedIds.size).toBe(MAX_SELECTED_SEATS);
  });
});
