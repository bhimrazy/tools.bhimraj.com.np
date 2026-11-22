export interface Encoded {
  /** Real size of the encoded output in bytes. */
  bytes: number;
}

/** Encodes at `quality` (0–1) with dimensions multiplied by `scale` (0–1]. */
export type ScaledEncoder<T extends Encoded> = (
  quality: number,
  scale: number,
) => Promise<T>;

export interface FitOptions {
  maxBytes: number;
  minBytes?: number;
  signal?: AbortSignal;
  /**
   * "fixed": dimensions are a requirement (a portal's photo size), so only quality moves.
   * "free": pick a scale where quality stays in FREE_QUALITY, then search quality there.
   */
  policy?: "fixed" | "free";
  /** Encodes per scale. Default 8. Free-size jobs make at most 3 at full size. */
  maxPasses?: number;
  /** Smallest allowed scale. Default 0.1. */
  minScale?: number;
  /** How many times a free-size job may shrink. Default 8. */
  maxScaleSteps?: number;
}

export interface FitResult<T extends Encoded> {
  result: T;
  quality: number;
  scale: number;
  withinTarget: boolean;
  /** Total encodes performed. */
  passes: number;
}

export const MIN_QUALITY = 0.05;
export const MAX_QUALITY = 0.95;
/**
 * Free-size jobs give up pixels rather than drop below `min`. `start` is probed first at each
 * scale and is the quality the next scale is estimated for.
 */
export const FREE_QUALITY = { min: 0.5, start: 0.8, max: 0.9 } as const;
/** Full-size encodes are the slow ones on a phone. */
const FREE_FULL_SIZE_PASSES = 3;

interface Range {
  lo: number;
  start: number;
  hi: number;
}

interface Probe<T> {
  result: T;
  quality: number;
}

interface Search<T> {
  /** Highest-quality probe that fits maxBytes. */
  fit?: Probe<T>;
  start: Probe<T>;
  smallest: Probe<T>;
  passes: number;
}

/** Probes `start`, then the floor if needed, then bisects between a fitting and a failing quality. */
async function searchQuality<T extends Encoded>(
  encode: (quality: number) => Promise<T>,
  range: Range,
  maxBytes: number,
  closeEnough: number,
  maxPasses: number,
  signal?: AbortSignal,
): Promise<Search<T>> {
  let passes = 0;
  let fit: Probe<T> | undefined;
  let smallest: Probe<T> | undefined;
  const probe = async (quality: number) => {
    signal?.throwIfAborted();
    const p = { result: await encode(quality), quality };
    passes++;
    if (p.result.bytes <= maxBytes && (!fit || quality > fit.quality)) fit = p;
    if (!smallest || p.result.bytes < smallest.result.bytes) smallest = p;
    return p;
  };
  const fits = (p: Probe<T>) => p.result.bytes <= maxBytes;
  const done = (): Search<T> => ({
    ...(fit && { fit }),
    start,
    smallest: smallest!,
    passes,
  });

  const start = await probe(range.start);
  let lo = range.start;
  let hi = range.hi;
  if (!fits(start)) {
    if (range.lo === range.start || !fits(await probe(range.lo))) return done();
    lo = range.lo;
    hi = range.start;
  }
  while (passes < maxPasses && fit!.result.bytes < closeEnough) {
    // Browsers quantise quality to whole percents, so finer steps are wasted encodes.
    const mid = Math.round((lo + hi) * 50) / 100;
    if (mid <= lo || mid >= hi) break;
    if (fits(await probe(mid))) lo = mid;
    else hi = mid;
  }
  return done();
}

/**
 * Finds the best output whose real encoded size fits `maxBytes`. Fixed-size jobs search quality
 * only; free-size jobs shrink until FREE_QUALITY.start roughly fits, then search quality there,
 * dropping below FREE_QUALITY.min only at the last scale. When nothing fits, returns the
 * smallest output with `withinTarget: false`; also false when the fit is under `minBytes`.
 */
export async function fitToTarget<T extends Encoded>(
  encode: ScaledEncoder<T>,
  opts: FitOptions,
): Promise<FitResult<T>> {
  const {
    maxBytes,
    minBytes = 0,
    signal,
    policy = "fixed",
    maxPasses = 8,
    minScale = 0.1,
    maxScaleSteps = 8,
  } = opts;
  if (!(maxBytes > 0)) throw new RangeError("maxBytes must be positive");
  if (minBytes > maxBytes)
    throw new RangeError("minBytes must not exceed maxBytes");

  const free = policy === "free";
  // A fit this close to the limit isn't worth more encodes.
  const closeEnough = Math.max(minBytes, maxBytes * 0.95);
  let scale = 1;
  let passes = 0;
  let smallest: FitResult<T> | undefined;

  for (let step = 0; ; step++) {
    const last = !free || step >= maxScaleSteps || scale <= minScale;
    const range: Range = !free
      ? { lo: MIN_QUALITY, start: MAX_QUALITY, hi: MAX_QUALITY }
      : {
          lo: last ? MIN_QUALITY : FREE_QUALITY.min,
          start: FREE_QUALITY.start,
          hi: FREE_QUALITY.max,
        };
    const s = scale;
    const search = await searchQuality(
      (q) => encode(q, s),
      range,
      maxBytes,
      closeEnough,
      free && step === 0
        ? Math.min(maxPasses, FREE_FULL_SIZE_PASSES)
        : maxPasses,
      signal,
    );
    passes += search.passes;
    if (search.fit) {
      const { result, quality } = search.fit;
      return {
        result,
        quality,
        scale,
        withinTarget: result.bytes >= minBytes,
        passes,
      };
    }
    const { result, quality } = search.smallest;
    if (!smallest || result.bytes < smallest.result.bytes)
      smallest = { result, quality, scale, withinTarget: false, passes };
    if (last) break;
    // Bytes scale roughly with area; the margin covers smaller images costing more per pixel.
    const k = Math.sqrt(maxBytes / search.start.result.bytes) * 0.95;
    scale = Math.max(minScale, scale * Math.min(k, 0.9));
  }
  return { ...smallest, passes };
}
