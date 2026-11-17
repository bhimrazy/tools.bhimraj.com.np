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
  /** Encodes per quality search. Default 8. */
  maxPasses?: number;
  /** Smallest allowed scale; reaching it ends the downscale loop. Default 0.1. */
  minScale?: number;
  /** How many times dimensions may shrink. 0 disables downscaling. Default 12. */
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

interface Probe<T> {
  result: T;
  quality: number;
}

interface Search<T> {
  /** Highest-quality probe that fits maxBytes. */
  fit?: Probe<T>;
  smallest: Probe<T>;
  passes: number;
}

async function searchQuality<T extends Encoded>(
  encode: (quality: number) => Promise<T>,
  maxBytes: number,
  closeEnough: number,
  maxPasses: number,
  floorFirst: boolean,
  signal?: AbortSignal,
): Promise<Search<T>> {
  let passes = 0;
  let fit: Probe<T> | undefined;
  let smallest: Probe<T> | undefined;
  const probe = async (quality: number) => {
    signal?.throwIfAborted();
    const result = await encode(quality);
    passes++;
    const p = { result, quality };
    if (!smallest || result.bytes < smallest.result.bytes) smallest = p;
    if (result.bytes <= maxBytes && (!fit || quality > fit.quality)) fit = p;
    return result.bytes <= maxBytes;
  };
  const done = (): Search<T> =>
    fit
      ? { fit, smallest: smallest!, passes }
      : { smallest: smallest!, passes };

  // Floor first when we already know the image is too big (later downscale steps).
  const ends = floorFirst
    ? [MIN_QUALITY, MAX_QUALITY]
    : [MAX_QUALITY, MIN_QUALITY];
  for (const q of ends) {
    const fits = await probe(q);
    if (q === MAX_QUALITY && fits) return done();
    if (q === MIN_QUALITY && !fits) return done();
  }

  let lo = MIN_QUALITY;
  let hi = MAX_QUALITY;
  while (passes < maxPasses) {
    // Browsers quantise quality to whole percents, so finer steps are wasted encodes.
    const mid = Math.round((lo + hi) * 50) / 100;
    if (mid <= lo || mid >= hi) break;
    if (await probe(mid)) {
      lo = mid;
      if (fit!.result.bytes >= closeEnough) break;
    } else {
      hi = mid;
    }
  }
  return done();
}

/**
 * Finds the highest quality whose real encoded size fits `maxBytes`, shrinking
 * dimensions when even the lowest quality is too large. Returns the smallest
 * output with `withinTarget: false` when the target can't be met, and also
 * reports false when the best fit is still below `minBytes` (never padded).
 */
export async function fitToTarget<T extends Encoded>(
  encode: ScaledEncoder<T>,
  opts: FitOptions,
): Promise<FitResult<T>> {
  const {
    maxBytes,
    minBytes = 0,
    signal,
    maxPasses = 8,
    minScale = 0.1,
    maxScaleSteps = 12,
  } = opts;
  if (!(maxBytes > 0)) throw new RangeError("maxBytes must be positive");
  if (minBytes > maxBytes)
    throw new RangeError("minBytes must not exceed maxBytes");

  // A fit this close to the limit isn't worth more encodes.
  const closeEnough = Math.max(minBytes, maxBytes * 0.95);
  let scale = 1;
  let passes = 0;
  let smallest: FitResult<T> | undefined;

  for (let step = 0; ; step++) {
    const s = scale;
    const search = await searchQuality(
      (q) => encode(q, s),
      maxBytes,
      closeEnough,
      maxPasses,
      step > 0,
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
    if (!smallest || result.bytes < smallest.result.bytes) {
      smallest = { result, quality, scale, withinTarget: false, passes };
    }
    if (step >= maxScaleSteps || scale <= minScale) break;
    // Bytes scale roughly with area, so estimate the needed shrink; clamp so one bad guess can't overshoot.
    const factor = Math.min(
      0.85,
      Math.max(0.5, Math.sqrt(maxBytes / result.bytes) * 0.95),
    );
    scale = Math.max(minScale, scale * factor);
  }
  return { ...smallest, passes };
}
