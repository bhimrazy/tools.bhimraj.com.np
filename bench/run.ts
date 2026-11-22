import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import type { JobResult } from "./src/main";

const PORT = 4402;
const THROTTLE = 4; // CPU slowdown as a rough proxy for a low-end Android phone

const server = await createServer({
  root: import.meta.dir,
  server: { port: PORT, strictPort: true, host: "127.0.0.1" },
  logLevel: "warn",
});
await server.listen();

const executablePath = process.env.BROWSER_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});

interface Row extends JobResult {
  mode: string;
  heapPeakMiB: number | null;
}
const rows: Row[] = [];

try {
  // CDP cannot throttle workers, so the throttled run runs the image code on the main thread.
  const modes = [
    { mode: "worker", where: "worker", rate: 1 },
    { mode: "main-thread", where: "main", rate: 1 },
    { mode: `main-thread cpu x${THROTTLE}`, where: "main", rate: THROTTLE },
  ] as const;
  for (const { mode, where, rate } of modes) {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("pageerror:", e.message));
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.waitForFunction(() => "bench" in window);
    // Generate inputs first so throttling only slows the code under test.
    await page.evaluate(() => (window as any).bench.prepare());
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });

    const jobs = await page.evaluate(() => {
      const b = (window as any).bench;
      return [...b.jobs, ...b.presetJobs()];
    });
    for (const job of jobs) {
      let peak = 0;
      const sample = setInterval(async () => {
        try {
          const { metrics } = await cdp.send("Performance.getMetrics");
          peak = Math.max(
            peak,
            metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0,
          );
        } catch {}
      }, 50);
      const r: JobResult = await page.evaluate(
        ([j, w]) => (window as any).bench.run(j, w),
        [job, where] as const,
      );
      clearInterval(sample);
      rows.push({
        ...r,
        mode,
        heapPeakMiB:
          where === "main" && peak ? Math.round(peak / 104857.6) / 10 : null,
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

const kb = (n: number) => `${(n / 1000).toFixed(1)}`;
console.table(
  rows.map((r) => ({
    mode: r.mode,
    input: r.input,
    target: r.label,
    "wall ms": r.wallMs,
    "out KB": kb(r.outBytes),
    "max KB": kb(r.maxBytes),
    ok: r.fitsBytes,
    size: `${r.width}x${r.height}`,
    quality: r.quality,
    "heap peak MiB": r.heapPeakMiB ?? "n/a",
  })),
);

const dir = `${import.meta.dir}/results`;
await mkdir(dir, { recursive: true });
const file = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(
  file,
  JSON.stringify(
    { date: new Date().toISOString(), throttle: THROTTLE, rows },
    null,
    2,
  ),
);
console.log(`Wrote ${file}`);
process.exit(0);
