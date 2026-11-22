import { expect, type Page, type TestInfo } from "@playwright/test";
import type { TestImage } from "./images";

export async function pickFile(page: Page, file: TestImage) {
  await page.getByLabel(/^Choose/).setInputFiles(file);
}

/** Waits for the result card and downloads the file through its link. */
export async function downloadResult(page: Page, testInfo: TestInfo) {
  const link = page.getByRole("link", { name: /^Download/ });
  await expect(link).toBeVisible({ timeout: 60_000 });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    link.click(),
  ]);
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const buffer = await (await import("node:fs/promises")).readFile(path);
  return { filename: download.suggestedFilename(), buffer };
}

/** Collects console errors and CSP violations; call `.problems` at the end. */
export function watchPage(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  void page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return { problems };
}
