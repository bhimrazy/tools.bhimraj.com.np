import { expect, test } from "bun:test";
import { padJpeg } from "./pad";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Structurally valid JPEG: SOI, JFIF APP0, DQT, SOF0, SOS + entropy data, EOI. */
const jpeg = new Uint8Array([
  0xff,
  0xd8,
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
  0xff,
  0xdb,
  0,
  67,
  0,
  ...new Array(64).fill(1),
  0xff,
  0xc0,
  0,
  11,
  8,
  0,
  80,
  1,
  44,
  1,
  1,
  0x11,
  0,
  0xff,
  0xda,
  0,
  8,
  1,
  1,
  0,
  0,
  63,
  0,
  0x12,
  0x34,
  0xff,
  0x00,
  0x56,
  0xff,
  0xd9,
]);

interface Segment {
  marker: number;
  start: number;
  size: number;
}

/** Walks marker segments up to SOS, failing on anything malformed, and checks the EOI tail. */
function parse(b: Uint8Array): Segment[] {
  expect([b[0], b[1]]).toEqual([0xff, 0xd8]);
  const out: Segment[] = [];
  let i = 2;
  for (;;) {
    expect(b[i]).toBe(0xff);
    const marker = b[i + 1]!;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    expect(len).toBeGreaterThanOrEqual(2);
    out.push({ marker, start: i, size: 2 + len });
    i += 2 + len;
    if (marker === 0xda) break;
    expect(i).toBeLessThan(b.length);
  }
  expect([b.at(-2), b.at(-1)]).toEqual([0xff, 0xd9]);
  return out;
}

const strip = (b: Uint8Array) => {
  const parts: number[] = [];
  let last = 0;
  for (const s of parse(b).filter((s) => s.marker === 0xfe)) {
    parts.push(...b.subarray(last, s.start));
    last = s.start + s.size;
  }
  return new Uint8Array([...parts, ...b.subarray(last)]);
};

test("pads to the exact target with COM segments after APP0", () => {
  const out = padJpeg(jpeg, 5_000);
  expect(out.length).toBe(5_000);
  const segs = parse(out);
  expect(segs.map((s) => s.marker)).toEqual([0xe0, 0xfe, 0xdb, 0xc0, 0xda]);
  expect(strip(out)).toEqual(jpeg);
});

test("splits padding over 64 KB into several valid segments", () => {
  const out = padJpeg(jpeg, 200_000);
  expect(out.length).toBe(200_000);
  const com = parse(out).filter((s) => s.marker === 0xfe);
  expect(com.length).toBe(4);
  for (const s of com) expect(s.size).toBeLessThanOrEqual(2 + 0xffff);
  expect(strip(out)).toEqual(jpeg);
});

test("a shortfall under 4 bytes adds one empty segment", () => {
  const out = padJpeg(jpeg, jpeg.length + 1);
  expect(out.length).toBe(jpeg.length + 4);
  expect(strip(out)).toEqual(jpeg);
});

test("already big enough is returned unchanged; non-JPEG throws", () => {
  expect(padJpeg(jpeg, 10)).toEqual(jpeg);
  expect(() => padJpeg(new Uint8Array([0x89, 0x50]), 100)).toThrow();
});
