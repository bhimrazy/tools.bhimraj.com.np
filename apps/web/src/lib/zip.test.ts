import { expect, test } from "bun:test";
import { computeCrc32, toZip } from "./zip";

test("crc32 matches the standard check value", () => {
  expect(computeCrc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
});

test("zip lists each file, stored as is", async () => {
  const a = new Uint8Array([1, 2, 3]);
  const b = new Uint8Array([4, 5]);
  const buf = new Uint8Array(
    await toZip([
      { name: "photo.jpg", bytes: a },
      { name: "signature.jpg", bytes: b },
    ]).arrayBuffer(),
  );
  const view = new DataView(buf.buffer);
  expect(view.getUint32(0, true)).toBe(0x04034b50);
  // End of central directory: 2 entries, directory starts after both local records.
  const end = buf.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  expect(view.getUint16(end + 10, true)).toBe(2);
  const dirAt = view.getUint32(end + 16, true);
  expect(dirAt).toBe(30 + 9 + 3 + 30 + 13 + 2);
  expect(view.getUint32(dirAt, true)).toBe(0x02014b50);
  // First file's bytes sit right after its local header and name.
  expect([...buf.subarray(39, 42)]).toEqual([1, 2, 3]);
});
