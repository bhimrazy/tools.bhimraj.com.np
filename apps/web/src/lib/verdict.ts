import { maxBytesToKb, minBytesToKb } from "@tools/presets";
import { formatFigureKb } from "./units";

interface Limits {
  maxBytes: number;
  minBytes?: number | undefined;
}

/** "99" or "99.5": a KB figure without a trailing ".0". */
const trimKb = (s: string) => s.replace(/\.0$/, "");

/**
 * The result in one line. Limits carry ~1% headroom (kbToMaxBytes), so a file can miss the safe
 * target while its rounded size still reads as inside the form's limit. Then we say what we aim
 * for, so a number never contradicts its verdict.
 */
export function formatVerdict(bytes: number, limits: Limits): string {
  const { maxBytes, minBytes } = limits;
  const maxKb = maxBytesToKb(maxBytes);
  if (bytes > maxBytes) {
    const fig = formatFigureKb(bytes, false);
    const aim = trimKb(formatFigureKb(maxBytes, true));
    return Number(fig) > maxKb
      ? `Too big: ${fig} KB. Your limit is ${maxKb} KB.`
      : `Too big: ${fig} KB. We aim for ${aim} KB or less, just under your ${maxKb} KB limit, so the form accepts it.`;
  }
  if (minBytes !== undefined && bytes < minBytes) {
    const fig = formatFigureKb(bytes, true);
    const minKb = minBytesToKb(minBytes);
    const aim = trimKb(formatFigureKb(minBytes, false));
    return Number(fig) < minKb
      ? `Too small: ${fig} KB. The smallest allowed is ${minKb} KB.`
      : `Too small: ${fig} KB. We aim for ${aim} KB or more, just over your ${minKb} KB minimum, so the form accepts it.`;
  }
  const fig = formatFigureKb(bytes, true);
  return minBytes === undefined
    ? `Done: ${fig} KB, under your ${maxKb} KB limit`
    : `Done: ${fig} KB, inside your ${minBytesToKb(minBytes)}–${maxKb} KB limit`;
}
