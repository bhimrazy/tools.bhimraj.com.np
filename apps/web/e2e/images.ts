import { expect, type Page, type TestInfo } from "@playwright/test";

export interface TestImage {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ImageOptions {
  name: string;
  width: number;
  height: number;
  /** "photo": gradients + noise (hard to compress). "transparent": empty PNG with one red square. */
  kind?: "photo" | "transparent";
}

/** Draws the image in the page, so no binary fixtures are committed. */
export async function makeImage(
  page: Page,
  o: ImageOptions,
): Promise<TestImage> {
  const kind = o.kind ?? "photo";
  const base64 = await page.evaluate(
    async ({ width, height, kind }) => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d")!;
      if (kind === "photo") {
        const g = ctx.createLinearGradient(0, 0, width, height);
        g.addColorStop(0, "#1c3d6e");
        g.addColorStop(0.5, "#d9a441");
        g.addColorStop(1, "#7a2f4b");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
        // Noise in tiles keeps memory flat for 12 MP+ sizes.
        const tile = 512;
        let seed = 12345;
        const rand = () =>
          (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
        for (let y = 0; y < height; y += tile) {
          for (let x = 0; x < width; x += tile) {
            const w = Math.min(tile, width - x);
            const h = Math.min(tile, height - y);
            const img = ctx.getImageData(x, y, w, h);
            for (let i = 0; i < img.data.length; i += 4) {
              const n = (rand() - 0.5) * 60;
              img.data[i] = (img.data[i] ?? 0) + n;
              img.data[i + 1] = (img.data[i + 1] ?? 0) + n;
              img.data[i + 2] = (img.data[i + 2] ?? 0) + n;
            }
            ctx.putImageData(img, x, y);
          }
        }
      } else {
        ctx.fillStyle = "#e11d48";
        ctx.fillRect(width / 4, height / 4, width / 2, height / 2);
      }
      const blob = await canvas.convertToBlob(
        kind === "photo"
          ? { type: "image/jpeg", quality: 0.9 }
          : { type: "image/png" },
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(bin);
    },
    { width: o.width, height: o.height, kind },
  );
  return {
    name: o.name,
    mimeType: kind === "photo" ? "image/jpeg" : "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

export interface Decoded {
  width: number;
  height: number;
  /** RGBA at each requested point. */
  pixels: [number, number, number, number][];
}

export async function decodeImage(
  page: Page,
  buffer: Buffer,
  points: [number, number][] = [],
): Promise<Decoded> {
  return page.evaluate(
    async ({ b64, points }) => {
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes]));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const pixels = points.map(([x, y]) => [
        ...ctx.getImageData(x, y, 1, 1).data,
      ]);
      return { width: bmp.width, height: bmp.height, pixels } as Decoded;
    },
    { b64: buffer.toString("base64"), points },
  );
}

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
