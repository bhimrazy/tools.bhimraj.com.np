/** Marker (2) + length (2) + up to 65,533 payload bytes. */
const MAX_SEGMENT = 2 + 0xffff;
const MIN_SEGMENT = 4;

/**
 * Grows a JPEG to `target` bytes with COM (comment) segments, valid metadata every decoder
 * skips. Used when a portal's byte minimum is above what quality 0.95 produces. They go after
 * the leading APPn segments so a JFIF APP0 stays first. An empty segment is 4 bytes, so a
 * shortfall under 4 overshoots the target by up to 3.
 */
export function padJpeg(
  jpeg: Uint8Array,
  target: number,
): Uint8Array<ArrayBuffer> {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("Not a JPEG");
  if (target <= jpeg.length) return jpeg.slice();
  const out = new Uint8Array(
    jpeg.length + Math.max(MIN_SEGMENT, target - jpeg.length),
  );
  let at = 2;
  while (jpeg[at] === 0xff && jpeg[at + 1]! >= 0xe0 && jpeg[at + 1]! <= 0xef)
    at += 2 + ((jpeg[at + 2]! << 8) | jpeg[at + 3]!);

  const extra = out.length - jpeg.length;
  // Even split keeps every segment within [4, 65537] bytes.
  const n = Math.ceil(extra / MAX_SEGMENT);
  out.set(jpeg.subarray(0, at));
  let o = at;
  for (let i = 0; i < n; i++) {
    const size = Math.floor(extra / n) + (i < extra % n ? 1 : 0);
    const len = size - 2;
    out.set([0xff, 0xfe, len >> 8, len & 0xff], o);
    out.fill(0x20, o + 4, o + size);
    o += size;
  }
  out.set(jpeg.subarray(at), o);
  return out;
}
