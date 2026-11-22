// Forms someone made a file for, kept in this browser's localStorage: form names and dates only,
// never files. Every access is guarded, since storage can be off or full.

const KEY = "recent-forms";
const MAX = 4;

export interface RecentForm {
  path: string;
  title: string;
  /** Epoch ms of the last file made for it. */
  at: number;
}

const isRecentForm = (v: unknown): v is RecentForm =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as RecentForm).path === "string" &&
  (v as RecentForm).path.startsWith("/forms/") &&
  typeof (v as RecentForm).title === "string" &&
  typeof (v as RecentForm).at === "number";

export function readRecentForms(): RecentForm[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter(isRecentForm).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function recordRecentForm(path: string, title: string) {
  try {
    const rest = readRecentForms().filter((f) => f.path !== path);
    localStorage.setItem(
      KEY,
      JSON.stringify([{ path, title, at: Date.now() }, ...rest].slice(0, MAX)),
    );
  } catch {
    // Storage off or full: the list is a convenience, so nothing else changes.
  }
}

export function clearRecentForms() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}

/** "2 min ago", "Yesterday", "14 Oct 2026". */
export function formatWhen(at: number, now = Date.now()): string {
  const min = Math.round((now - at) / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
