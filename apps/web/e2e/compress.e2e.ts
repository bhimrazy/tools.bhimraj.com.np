import { expect, test } from "@playwright/test";
import { decodeImage, makeImage } from "./images";
import { downloadResult, pickFile } from "./page";

test("free-size 12 MP photo compresses to 100 KB", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/compress-image");
  const photo = await makeImage(page, {
    name: "Holiday Photo.jpg",
    width: 4000,
    height: 3000,
  });
  await pickFile(page, photo);

  const { filename, buffer } = await downloadResult(page, testInfo);
  expect(buffer.length).toBeLessThanOrEqual(100_000);
  expect(buffer.length).toBeGreaterThan(20_000);
  expect(filename).toMatch(/^holiday-photo-\d+x\d+-\d+kb\.jpg$/);
  const { width, height } = await decodeImage(page, buffer);
  expect(width / height).toBeCloseTo(4 / 3, 1);
  await expect(page.getByText("Within ≤ 100 KB")).toBeVisible();
});

test("Lok Sewa photo preset gives exactly 300x350 inside its byte window", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/np/lok-sewa-photo");
  const photo = await makeImage(page, {
    name: "me.jpg",
    width: 3000,
    height: 2000,
  });
  await pickFile(page, photo);

  const { filename, buffer } = await downloadResult(page, testInfo);
  const { width, height } = await decodeImage(page, buffer);
  expect([width, height]).toEqual([300, 350]);
  expect(filename).toMatch(/-300x350-\d+kb\.jpg$/);
  // Preset: floor 10 KB x 1024, cap 200 KB x 1000.
  expect(buffer.length).toBeGreaterThanOrEqual(10 * 1024);
  expect(buffer.length).toBeLessThanOrEqual(200_000);
});

test("transparent PNG becomes a JPEG on a white background", async ({
  page,
}, testInfo) => {
  await page.goto("/compress-image");
  const png = await makeImage(page, {
    name: "logo.png",
    width: 800,
    height: 600,
    kind: "transparent",
  });
  await pickFile(page, png);

  const { filename, buffer } = await downloadResult(page, testInfo);
  expect(filename.endsWith(".jpg")).toBe(true);
  expect([...buffer.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  const { pixels } = await decodeImage(page, buffer, [
    [5, 5],
    [400, 300],
  ]);
  const [corner, centre] = pixels;
  if (!corner || !centre) throw new Error("pixels missing");
  expect(Math.min(corner[0], corner[1], corner[2])).toBeGreaterThanOrEqual(245);
  expect(centre[0]).toBeGreaterThan(180);
  expect(centre[1]).toBeLessThan(80);
});

test("picking a new file mid-job cancels the first", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/compress-image");
  const big = await makeImage(page, {
    name: "first-big.jpg",
    width: 6000,
    height: 4000,
  });
  const small = await makeImage(page, {
    name: "second.jpg",
    width: 800,
    height: 600,
  });

  await pickFile(page, big);
  await expect(page.getByRole("status")).not.toHaveText("");
  await pickFile(page, small);

  const { filename } = await downloadResult(page, testInfo);
  expect(filename).toMatch(/^second-/);
  await expect(page.getByRole("heading", { name: "Result" })).toHaveCount(1);
  // The cancelled job must not overwrite the result later.
  await page.waitForTimeout(2_000);
  await expect(page.getByRole("link", { name: /^Download/ })).toHaveAttribute(
    "download",
    /^second-/,
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});
