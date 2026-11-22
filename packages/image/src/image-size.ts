export interface Size {
  width: number;
  height: number;
}

const ascii = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, at + n));

/**
 * Reads pixel dimensions from the start of a JPEG, PNG or WebP file without decoding it.
 * JPEG sizes are as displayed (EXIF orientation applied). Undefined when unknown or truncated.
 */
export function readImageSize(bytes: Uint8Array): Size | undefined {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    return jpeg(bytes, v) ?? png(bytes, v) ?? webp(bytes, v);
  } catch {
    // DataView reads past the end of a truncated header throw RangeError.
    return undefined;
  }
}

const isSof = (m: number) =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

function jpeg(b: Uint8Array, v: DataView): Size | undefined {
  if (v.getUint16(0) !== 0xffd8) return;
  let orientation = 1;
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xff) return;
    const m = b[i + 1]!;
    if (m === 0xff) {
      i++; // fill byte
      continue;
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
      i += 2; // standalone marker, no length
      continue;
    }
    if (m === 0xda || m === 0xd9) return;
    if (m === 0xe1 && ascii(b, i + 4, 6) === "Exif\0\0")
      orientation = exifOrientation(v, i + 10) ?? orientation;
    if (isSof(m)) {
      const h = v.getUint16(i + 5);
      const w = v.getUint16(i + 7);
      // Orientations 5–8 rotate by 90°.
      return orientation >= 5
        ? { width: h, height: w }
        : { width: w, height: h };
    }
    i += 2 + v.getUint16(i + 2);
  }
  return undefined;
}

function exifOrientation(v: DataView, tiff: number): number | undefined {
  const le = v.getUint16(tiff) === 0x4949; // "II"
  const ifd = tiff + v.getUint32(tiff + 4, le);
  const end = ifd + 2 + v.getUint16(ifd, le) * 12;
  for (let e = ifd + 2; e < end; e += 12)
    if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le);
  return undefined;
}

function png(b: Uint8Array, v: DataView): Size | undefined {
  if (v.getUint32(0) !== 0x89504e47 || ascii(b, 12, 4) !== "IHDR") return;
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

function webp(b: Uint8Array, v: DataView): Size | undefined {
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return;
  switch (ascii(b, 12, 4)) {
    case "VP8 ":
      return {
        width: v.getUint16(26, true) & 0x3fff,
        height: v.getUint16(28, true) & 0x3fff,
      };
    case "VP8L": {
      const bits = v.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    case "VP8X": {
      // EXIF may rotate it; leave those to the full decode.
      if (b[20]! & 0x08) return;
      const u24 = (at: number) => v.getUint16(at, true) + (b[at + 2]! << 16);
      return { width: u24(24) + 1, height: u24(27) + 1 };
    }
  }
  return undefined;
}
