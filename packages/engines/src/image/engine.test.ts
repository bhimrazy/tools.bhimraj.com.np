import { describe, expect, test } from "bun:test";
import { createImageEngine, EngineError, type CompressResult } from "./index";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const file = new Blob([new Uint8Array(8)], { type: "image/jpeg" });
const opts = { maxBytes: 1000 };
const result = { bytes: 1 } as CompressResult;

/** Stand-in worker: records messages and replies via `respond`, or never. */
class FakeWorker {
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  posted: WorkerRequest[] = [];
  terminated = false;

  constructor(
    private respond?: (msg: WorkerRequest) => WorkerResponse | undefined,
  ) {}

  postMessage(msg: WorkerRequest) {
    this.posted.push(msg);
    const data = this.respond?.(msg);
    if (data) queueMicrotask(() => this.onmessage?.({ data } as MessageEvent));
  }

  terminate() {
    this.terminated = true;
  }
}

function fakeEngine(
  respond?: (msg: WorkerRequest) => WorkerResponse | undefined,
  timing = {},
) {
  const workers: FakeWorker[] = [];
  const engine = createImageEngine({
    createWorker: () => {
      const w = new FakeWorker(respond);
      workers.push(w);
      return w as unknown as Worker;
    },
    ...timing,
  });
  return { engine, workers };
}

const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe("error codes", () => {
  test("without OffscreenCanvas (as in Bun) it runs on the main thread and reports unsupported_browser", async () => {
    const engine = createImageEngine();
    const runs = [engine.compress(file, opts), engine.compress(file, opts)];
    for (const r of await Promise.allSettled(runs))
      expect(r).toMatchObject({ reason: { code: "unsupported_browser" } });
  });

  test("a real worker that can't draw hands the job to the main thread", async () => {
    const engine = createImageEngine({
      createWorker: () =>
        new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    });
    try {
      const err = await engine.compress(file, opts).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(EngineError);
      expect(err).toMatchObject({ code: "unsupported_browser" });
    } finally {
      engine.dispose();
    }
  });

  test("the worker's code survives the boundary", async () => {
    const { engine } = fakeEngine((msg) =>
      "cancel" in msg
        ? undefined
        : { id: msg.id, ok: false, code: "decode_failed", error: "bad file" },
    );
    const err = await engine.compress(file, opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err).toMatchObject({ code: "decode_failed", message: "bad file" });
  });

  test("unsupported_browser from the worker switches later jobs to the main thread", async () => {
    const { engine, workers } = fakeEngine((msg) =>
      "cancel" in msg
        ? undefined
        : { id: msg.id, ok: false, code: "unsupported_browser", error: "" },
    );
    const runs = [engine.compress(file, opts), engine.compress(file, opts)];
    for (const r of await Promise.allSettled(runs))
      expect(r).toMatchObject({ reason: { code: "unsupported_browser" } });
    expect(workers).toHaveLength(1);
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[0]!.posted).toHaveLength(1);
  });
});

describe("watchdog", () => {
  test("a silent worker is killed, the job fails with timeout, and the queue moves on", async () => {
    let first = true;
    const { engine, workers } = fakeEngine(
      (msg) => {
        if ("cancel" in msg) return undefined;
        if (first) return void (first = false);
        return { id: msg.id, ok: true, result };
      },
      { timeoutMs: 20 },
    );
    const hung = engine.compress(file, opts);
    const queued = engine.compress(file, opts);
    await expect(hung).rejects.toMatchObject({ code: "timeout" });
    expect(await queued).toBe(result);
    expect(workers).toHaveLength(2);
    expect(workers[0]!.terminated).toBe(true);
    engine.dispose();
  });

  test("a worker that ignores cancel is killed after the grace period", async () => {
    const { engine, workers } = fakeEngine(
      (msg) =>
        "cancel" in msg || msg.id === 1
          ? undefined
          : { id: msg.id, ok: true, result },
      { timeoutMs: 60_000, cancelGraceMs: 20 },
    );
    const ctrl = new AbortController();
    const cancelled = engine.compress(file, opts, ctrl.signal);
    const queued = engine.compress(file, opts);
    ctrl.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    await settle(5);
    // Still within the grace period: the slot is held, nothing new is posted.
    expect(workers[0]!.posted.map((m) => m.id)).toEqual([1, 1]);
    expect(await queued).toBe(result);
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.posted.map((m) => m.id)).toEqual([2]);
    engine.dispose();
  });
});

test("abort and dispose reject with AbortError", async () => {
  const { engine } = fakeEngine();
  expect(
    engine.compress(file, opts, AbortSignal.abort()),
  ).rejects.toMatchObject({ name: "AbortError" });

  const ctrl = new AbortController();
  const running = engine.compress(file, opts);
  const queued = engine.compress(file, opts, ctrl.signal);
  const pending = engine.compress(file, opts);
  ctrl.abort();
  expect(queued).rejects.toMatchObject({ name: "AbortError" });
  engine.dispose();
  expect(running).rejects.toMatchObject({
    name: "AbortError",
    code: "aborted",
  });
  expect(pending).rejects.toMatchObject({
    name: "AbortError",
    code: "aborted",
  });
  await Promise.allSettled([running, queued, pending]);
});
