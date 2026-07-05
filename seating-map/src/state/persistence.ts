const STORAGE_KEY = "seating-map:selection";

export function readPersistedSelection(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // Corrupt or inaccessible storage shouldn't crash the app.
    return [];
  }
}

export function writePersistedSelection(seatIds: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seatIds));
  } catch {
    // Storage might be full or disabled (private browsing) — fail silently.
  }
}

/** Simple debounce so rapid selection changes don't hammer localStorage. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
