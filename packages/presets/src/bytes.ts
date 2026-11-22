// Portals' "KB" is ambiguous and some reject the exact limit (strict `<`, rounding), so limits get ~1% headroom:
// maxBytes = KB x 1000 minus 1% (safe if KB means 1024 or the check is strict); minBytes = KB x 1024 plus 1%.
export const MAX_HEADROOM = 0.99;
export const MIN_MARGIN = 1.01;

export const kbMax = (kb: number): number =>
  Math.floor(kb * 1000 * MAX_HEADROOM);
export const kbMin = (kb: number): number => Math.ceil(kb * 1024 * MIN_MARGIN);
