import { expect, test } from "bun:test";
import { readImageSize } from "./image-size";

const u16 = (n: number) => [n >> 8, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** SOI, optional big-endian EXIF APP1 with an orientation tag, SOF0 w×h, SOS. */
function jpeg(w: number, h: number, orientation?: number): Uint8Array {
  const app1 = orientation
    ? (() => {
        const tiff = [
          ...ascii("MM"),
          0,
          42,
          0,
          0,
          0,
          8, // header, IFD0 at 8
          0,
          1, // one entry
          0x01,
          0x12,
          0,
          3,
          0,
          0,
          0,
          1,
          ...u16(orientation),
          0,
          0,
          0,
          0,
          0,
          0, // next IFD
        ];
        const body = [...ascii("Exif\0\0"), ...tiff];
        return [0xff, 0xe1, ...u16(body.length + 2), ...body];
      })()
    : [];
  const app0 = [
    0xff,
    0xe0,
    0,
    16,
    ...ascii("JFIF\0"),
    1,
    1,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
  ];
  const sof = [
    0xff,
    0xc0,
    0,
    17,
    8,
    ...u16(h),
    ...u16(w),
    3,
    ...new Array(9).fill(0),
  ];
  return new Uint8Array([
    0xff,
    0xd8,
    ...app0,
    ...app1,
    ...sof,
    0xff,
    0xda,
    0,
    2,
  ]);
}

test("JPEG size from SOF", () => {
  expect(readImageSize(jpeg(4000, 3000))).toEqual({
    width: 4000,
    height: 3000,
  });
});

test("JPEG EXIF orientations 5–8 swap width and height", () => {
  expect(readImageSize(jpeg(4000, 3000, 6))).toEqual({
    width: 3000,
    height: 4000,
  });
  expect(readImageSize(jpeg(4000, 3000, 3))).toEqual({
    width: 4000,
    height: 3000,
  });
});

test("PNG size from IHDR", () => {
  const png = new Uint8Array([
    0x89,
    ...ascii("PNG\r\n\x1a\n"),
    0,
    0,
    0,
    13,
    ...ascii("IHDR"),
    0,
    0,
    0x1f,
    0x40,
    0,
    0,
    0x17,
    0x70, // 8000 × 6000
  ]);
  expect(readImageSize(png)).toEqual({ width: 8000, height: 6000 });
});

const riff = (chunk: string, data: number[]) =>
  new Uint8Array([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBP"),
    ...ascii(chunk),
    0,
    0,
    0,
    0,
    ...data,
  ]);

test("WebP size from VP8, VP8L and VP8X", () => {
  // VP8: frame tag, start code, 14-bit width/height little-endian.
  expect(
    readImageSize(
      riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0xa0, 0x0f, 0xb8, 0x0b]),
    ),
  ).toEqual({
    width: 4000,
    height: 3000,
  });
  // VP8L: signature, then (w-1) and (h-1) as packed 14-bit fields.
  const bits = 3999 | (2999 << 14);
  expect(
    readImageSize(
      riff("VP8L", [
        0x2f,
        bits & 0xff,
        (bits >> 8) & 0xff,
        (bits >> 16) & 0xff,
        bits >>> 24,
      ]),
    ),
  ).toEqual({
    width: 4000,
    height: 3000,
  });
  // VP8X: flags, reserved, 24-bit (w-1) and (h-1).
  expect(
    readImageSize(riff("VP8X", [0, 0, 0, 0, 0x9f, 0x0f, 0, 0xb7, 0x0b, 0])),
  ).toEqual({
    width: 4000,
    height: 3000,
  });
  // EXIF flag: orientation unknown, so no answer.
  expect(
    readImageSize(riff("VP8X", [0x08, 0, 0, 0, 0x9f, 0x0f, 0, 0xb7, 0x0b, 0])),
  ).toBeUndefined();
});

test("unknown or truncated headers give undefined", () => {
  expect(readImageSize(new Uint8Array([]))).toBeUndefined();
  expect(
    readImageSize(new Uint8Array(ascii("GIF89a\x01\x00\x01\x00"))),
  ).toBeUndefined();
  expect(readImageSize(jpeg(4000, 3000).subarray(0, 24))).toBeUndefined();
});
