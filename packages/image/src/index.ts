import { EngineError, errorCode } from "./errors";
import type {
  CancelRequest,
  CompressRequest,
  WorkerResponse,
} from "./protocol";

export { EngineError, type ErrorCode } from "./errors";

export type OutputFormat = "image/jpeg" | "image/webp";

export interface CompressOptions {
  maxBytes: number;
  /** JPEG output under this is padded with a comment segment to reach it. */
  minBytes?: number;
  width?: number;
  height?: number;
  fit?: "cover" | "contain";
  format?: OutputFormat;
  /** CSS colour to flatten transparency onto (JPEG has no alpha). Default white. */
  background?: string;
}

export interface CompressResult {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  /** encoder quality used, 0–1 */
  quality: number;
  format: OutputFormat;
  /** false when the output is outside [minBytes, maxBytes] even at the smallest size tried */
  withinTarget: boolean;
}

export interface ImageEngine {
  /** Rejects with an `EngineError` (switch on `code`), or the signal's reason when aborted. */
  compress(
    file: Blob,
    opts: CompressOptions,
    signal?: AbortSignal,
  ): Promise<CompressResult>;
  /** Terminates the worker; the next call starts a fresh one. */
  dispose(): void;
}

export interface EngineOptions {
  /** Worker factory (tests pass a fake). Default: the bundled worker, or the main thread without OffscreenCanvas. */
  createWorker?: () => Worker;
  /** A worker job running longer than this is presumed hung: the worker is killed and the job fails with "timeout". */
  timeoutMs?: number;
  /** How long a cancelled job's worker gets to stop before it's killed. */
  cancelGraceMs?: number;
}

/** WASM/canvas heap never shrinks, so an idle worker is terminated to give memory back. */
const IDLE_MS = 30_000;
const TIMEOUT_MS = 60_000;
const CANCEL_GRACE_MS = 5_000;

interface Job {
  id: number;
  file: Blob;
  opts: CompressOptions;
  ctrl: AbortController;
  resolve(result: CompressResult): void;
  reject(reason: unknown): void;
}

const bundledWorker = () =>
  new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

const toEngineError = (err: unknown) =>
  err instanceof EngineError
    ? err
    : new EngineError(
        errorCode(err),
        err instanceof Error ? err.message : String(err),
        { cause: err },
      );

/**
 * Runs compression in a lazily started module worker, one job at a time to keep
 * peak memory low on 2–3 GB phones. Falls back to the main thread where workers
 * can't draw (iOS < 16.4).
 */
export function createImageEngine(options: EngineOptions = {}): ImageEngine {
  const { timeoutMs = TIMEOUT_MS, cancelGraceMs = CANCEL_GRACE_MS } = options;
  const createWorker =
    options.createWorker ??
    (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"
      ? bundledWorker
      : undefined);
  let mainThread = !createWorker;
  let worker: Worker | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let running: Job | undefined;
  const queue: Job[] = [];
  let nextId = 1;

  const stop = () => {
    clearTimeout(idle);
    clearTimeout(watchdog);
    worker?.terminate();
    worker = undefined;
  };

  /** Settles `job` if it still holds the slot, then starts the next one. */
  const finish = (job: Job, settle: (job: Job) => void) => {
    if (running !== job) return;
    clearTimeout(watchdog);
    running = undefined;
    settle(job);
    next();
  };

  const kill = (err: EngineError) => {
    const job = running;
    stop();
    if (job) finish(job, (j) => j.reject(err));
  };

  const arm = (ms: number, err: () => EngineError) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => kill(err()), ms);
  };

  const spawn = () => {
    const w = createWorker!();
    w.onmessage = ({ data: msg }: MessageEvent<WorkerResponse>) => {
      const job = running;
      if (msg.id !== job?.id) return;
      if (msg.ok) return finish(job, (j) => j.resolve(msg.result));
      if (msg.code === "unsupported_browser" && !job.ctrl.signal.aborted) {
        // The worker can't draw (no 2D OffscreenCanvas): rerun this and later jobs on the main thread.
        mainThread = true;
        stop();
        running = undefined;
        queue.unshift(job);
        return next();
      }
      finish(job, (j) => j.reject(new EngineError(msg.code, msg.error)));
    };
    w.onerror = (e) => {
      e.preventDefault();
      kill(new EngineError("internal", e.message || "Image worker failed"));
    };
    w.onmessageerror = () =>
      kill(
        new EngineError("internal", "Image worker sent an unreadable message"),
      );
    return w;
  };

  const runOnMain = (job: Job) => {
    import("./compress")
      .then(({ compressImage }) =>
        compressImage(job.file, job.opts, job.ctrl.signal),
      )
      .then(
        (result) => finish(job, (j) => j.resolve(result)),
        (err) => finish(job, (j) => j.reject(toEngineError(err))),
      );
  };

  function next() {
    if (running) return;
    clearTimeout(idle);
    const job = queue.shift();
    if (!job) {
      if (worker) idle = setTimeout(stop, IDLE_MS);
      return;
    }
    running = job;
    if (mainThread) return runOnMain(job);
    worker ??= spawn();
    arm(
      timeoutMs,
      () => new EngineError("timeout", "Image processing took too long"),
    );
    worker.postMessage({
      id: job.id,
      file: job.file,
      opts: job.opts,
    } satisfies CompressRequest);
  }

  return {
    compress(file, opts, signal) {
      return new Promise<CompressResult>((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);
        const onAbort = () => {
          job.ctrl.abort(signal?.reason);
          const i = queue.indexOf(job);
          if (i >= 0) queue.splice(i, 1);
          // The slot stays busy until the job stops, so the next one never overlaps it.
          else if (running === job && worker) {
            worker.postMessage({
              id: job.id,
              cancel: true,
            } satisfies CancelRequest);
            arm(
              cancelGraceMs,
              () => new EngineError("timeout", "Image worker didn't stop"),
            );
          }
          reject(signal?.reason);
        };
        const job: Job = {
          id: nextId++,
          file,
          opts,
          ctrl: new AbortController(),
          resolve: (result) => {
            signal?.removeEventListener("abort", onAbort);
            resolve(result);
          },
          reject: (reason) => {
            signal?.removeEventListener("abort", onAbort);
            reject(reason);
          },
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        queue.push(job);
        next();
      });
    },
    dispose() {
      stop();
      const err = new EngineError("aborted", "Image engine disposed");
      const jobs = running ? [running, ...queue.splice(0)] : queue.splice(0);
      running = undefined;
      for (const job of jobs) {
        job.ctrl.abort(err);
        job.reject(err);
      }
    },
  };
}
