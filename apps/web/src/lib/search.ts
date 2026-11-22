/** One thing search can find: a form upload or a tool. Built at build time from real presets. */
export interface SearchEntry {
  type: "form" | "tool";
  title: string;
  href: string;
  /** e.g. "300 × 350 px · 10–200 KB · Nepal · Not checked" */
  detail: string;
  /** The form's own name in its script, shown beside the title. */
  local?: { lang: string; text: string; script: "deva" | "beng" };
  /** Lower-case words search matches against: names in every script, country, kind. */
  terms: string;
  width?: number;
  height?: number;
  minKb?: number;
  maxKb?: number;
}

export interface ParsedQuery {
  width?: number;
  height?: number;
  unit?: "px" | "mm";
  maxKb?: number;
  words: string[];
}

const DIMS =
  /(\d{1,5}(?:\.\d+)?)\s*(?:x|×|\*|by)\s*(\d{1,5}(?:\.\d+)?)\s*(px|mm)?/i;
const SIZE =
  /(?:(?:under|below|less\s+than|max|up\s*to|<=?|≤)\s*)?(\d+(?:\.\d+)?)\s*(kb|k|mb)\b/i;
const FILLER = new Set(["a", "an", "the", "for", "to", "in", "of", "and"]);

/**
 * Reads sizes and limits out of what someone types: "35x45 50kb" is 35 × 45 mm under 50 KB,
 * "300x350 px" is pixels, "under 1 mb" is 1000 KB. What is left is matched as words.
 */
export function parseQuery(raw: string): ParsedQuery {
  let rest = raw.normalize("NFC");
  const out: ParsedQuery = { words: [] };
  const dims = DIMS.exec(rest);
  if (dims) {
    const w = Number(dims[1]);
    const h = Number(dims[2]);
    if (w > 0 && h > 0) {
      // Without a unit, small figures are a print size in mm (35 × 45); larger ones are pixels.
      out.unit =
        (dims[3]?.toLowerCase() as "px" | "mm" | undefined) ??
        (w <= 100 && h <= 100 ? "mm" : "px");
      out.width = w;
      out.height = h;
    }
    rest = rest.replace(dims[0], " ");
  }
  const size = SIZE.exec(rest);
  if (size) {
    const n = Number(size[1]);
    if (n > 0) out.maxKb = size[2]?.toLowerCase() === "mb" ? n * 1000 : n;
    rest = rest.replace(size[0], " ");
  }
  out.words = rest
    .toLowerCase()
    .split(/[\s,;·]+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}\p{M}]+$/gu, ""))
    .filter((w) => w && !FILLER.has(w) && w !== "px" && w !== "kb");
  return out;
}

const fitsSize = (e: SearchEntry, q: ParsedQuery) =>
  q.unit === "px" && e.width === q.width && e.height === q.height;
const fitsLimit = (e: SearchEntry, q: ParsedQuery) =>
  q.maxKb !== undefined &&
  e.maxKb !== undefined &&
  (e.minKb ?? 0) <= q.maxKb &&
  q.maxKb <= e.maxKb;

/**
 * Entries that match every word, ranked so exact size and limit matches come first. With no
 * words, figures alone find the forms that ask for them (a size in mm never matches: rules are px).
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  q: ParsedQuery,
  limit = 6,
): SearchEntry[] {
  const hasFigures = q.unit === "px" || q.maxKb !== undefined;
  if (!q.words.length && !hasFigures) return [];
  const scored: [number, number, SearchEntry][] = [];
  entries.forEach((e, i) => {
    if (!q.words.every((w) => e.terms.includes(w))) return;
    const score = (fitsSize(e, q) ? 2 : 0) + (fitsLimit(e, q) ? 1 : 0);
    // Figures alone: a typed size must match exactly; a limit alone must fit the form's range.
    if (!q.words.length && (score === 0 || (q.width && !fitsSize(e, q))))
      return;
    scored.push([score, i, e]);
  });
  return scored
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, limit)
    .map(([, , e]) => e);
}

/** The compress tool with the size rule someone typed, e.g. "/compress-image?kb=50&w=300&h=350". */
export function toCustomRuleHref(q: ParsedQuery): string | null {
  const params = new URLSearchParams();
  if (q.maxKb !== undefined) params.set("kb", String(q.maxKb));
  if (q.unit === "px" && q.width && q.height) {
    params.set("w", String(Math.round(q.width)));
    params.set("h", String(Math.round(q.height)));
  }
  return params.size ? `/compress-image?${params}` : null;
}
