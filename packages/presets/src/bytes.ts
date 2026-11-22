// Portals' "KB" is ambiguous and some reject the exact limit (strict `<`, rounding), so limits get ~1% headroom:
// maxBytes = KB x 1000 minus 1% (safe if KB means 1024 or the check is strict); minBytes = KB x 1024 plus 1%.
export const KB = 1000;
export const KIB = 1024;
export const MAX_BYTES_HEADROOM = 0.99;
export const MIN_BYTES_HEADROOM = 1.01;

export const kbToMaxBytes = (kb: number): number =>
  Math.floor(kb * KB * MAX_BYTES_HEADROOM);
export const kbToMinBytes = (kb: number): number =>
  Math.ceil(kb * KIB * MIN_BYTES_HEADROOM);

const tenths = (n: number) => Math.round(n * 10) / 10;

/** Inverse of `kbToMaxBytes`, to 0.1 KB: undoes the headroom to show the portal's number. */
export const maxBytesToKb = (bytes: number): number =>
  tenths(bytes / (KB * MAX_BYTES_HEADROOM));
/** Inverse of `kbToMinBytes`, to 0.1 KB. */
export const minBytesToKb = (bytes: number): number =>
  tenths(bytes / (KIB * MIN_BYTES_HEADROOM));
