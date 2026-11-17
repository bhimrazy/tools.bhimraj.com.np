import { expect, test } from "bun:test";
import { createImageEngine } from "./index";

// Bun has workers but no OffscreenCanvas, so this exercises the queue and error path, not encoding.
test("rejects cleanly when the worker can't encode, and keeps serving the queue", async () => {
  const engine = createImageEngine();
  const file = new Blob([new Uint8Array(8)], { type: "image/jpeg" });
  try {
    const runs = [
      engine.compress(file, { maxBytes: 1000 }),
      engine.compress(file, { maxBytes: 1000 }),
    ];
    for (const run of runs) expect(run).rejects.toThrow("can't process images");
    await Promise.allSettled(runs);
  } finally {
    engine.dispose();
  }
});

test("abort and dispose reject with AbortError", async () => {
  const engine = createImageEngine();
  const file = new Blob([]);
  expect(
    engine.compress(file, { maxBytes: 1 }, AbortSignal.abort()),
  ).rejects.toMatchObject({ name: "AbortError" });

  const ctrl = new AbortController();
  const running = engine.compress(file, { maxBytes: 1 });
  const queued = engine.compress(file, { maxBytes: 1 }, ctrl.signal);
  const pending = engine.compress(file, { maxBytes: 1 });
  ctrl.abort();
  expect(queued).rejects.toMatchObject({ name: "AbortError" });
  engine.dispose();
  expect(running).rejects.toMatchObject({ name: "AbortError" });
  expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await Promise.allSettled([running, queued, pending]);
});
