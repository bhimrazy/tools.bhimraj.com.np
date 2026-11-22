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
  await expect(
    page.getByRole("heading", { name: /under your 100 KB limit$/ }),
  ).toBeVisible();
});

test("Lok Sewa photo preset gives exactly 300x350 inside its byte window", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/forms/np/psc/lok-sewa-application#photo");
  const section = page.locator("section#photo");
  const photo = await makeImage(page, {
    name: "me.jpg",
    width: 3000,
    height: 2000,
  });
  await pickFile(section, photo);

  const { filename, buffer } = await downloadResult(page, testInfo, section);
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
  await expect(page.getByRole("heading", { name: /^Done:/ })).toHaveCount(1);
  // The cancelled job must not overwrite the result later.
  await page.waitForTimeout(2_000);
  await expect(page.getByRole("link", { name: /^Download/ })).toHaveAttribute(
    "download",
    /^second-/,
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a form page holds one tool per upload, each with its own size rule", async ({
  page,
}) => {
  await page.goto("/forms/np/psc/lok-sewa-application");
  for (const [id, box] of [
    ["photo", "300 × 350 px"],
    ["signature", "300 × 80 px"],
  ] as const) {
    const section = page.locator(`section#${id}`);
    await expect(section.getByLabel(/^Choose/)).toHaveAttribute(
      "id",
      `${id}-file`,
    );
    await expect(section.getByText(box).first()).toBeVisible();
  }
});

test("a limit typed and a file picked before the tool's code loads are both used", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // Hold back the island's code until the user has typed and picked.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/compress-tool-hydrate.*\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/compress-image");
  await page.getByLabel("Size limit (KB)").fill("20");
  await pickFile(
    page,
    await makeImage(page, { name: "early.jpg", width: 2400, height: 1800 }),
  );
  release();

  const { buffer } = await downloadResult(page, testInfo);
  // 20 KB with the 1% headroom: at most 19,800 bytes.
  expect(buffer.length).toBeLessThanOrEqual(19_800);
  await expect(page.getByLabel("Size limit (KB)")).toHaveValue("20");
});
