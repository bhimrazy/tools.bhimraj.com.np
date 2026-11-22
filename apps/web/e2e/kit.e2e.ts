import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { makeImage } from "./images";
import { pickFile } from "./page";

test("a kit with every upload ready downloads them all as one zip", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/forms/np/psc/lok-sewa-application");
  await expect(page.getByText("0 of 2 files ready")).toBeVisible();
  await pickFile(
    page.locator("section#photo"),
    await makeImage(page, { name: "me.jpg", width: 1500, height: 2000 }),
  );
  await pickFile(
    page.locator("section#signature"),
    await makeImage(page, { name: "sign.jpg", width: 1200, height: 320 }),
  );
  await expect(page.getByText("2 of 2 files ready")).toBeVisible({
    timeout: 60_000,
  });

  const link = page
    .getByRole("link", { name: /^Download all/ })
    .filter({ visible: true })
    .first();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    link.click(),
  ]);
  expect(download.suggestedFilename()).toBe("lok-sewa-application.zip");
  const path = testInfo.outputPath("kit.zip");
  await download.saveAs(path);
  const zip = await readFile(path);
  expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  // End of central directory record: two entries.
  expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2);
});

test("an unchecked size rule says so, with a glyph and a word", async ({
  page,
}) => {
  await page.goto("/forms/us/state-dept/dv-lottery-entry");
  await expect(page.getByText("Not checked yet").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Report a different rule" }).first(),
  ).toBeVisible();
});
