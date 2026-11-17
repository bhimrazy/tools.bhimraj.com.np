import type {
  CancelRequest,
  CompressRequest,
  WorkerResponse,
} from "./protocol";

export type OutputFormat = "image/jpeg" | "image/webp";

export interface CompressOptions {
  maxBytes: number;
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
  /** false when the target could not be met even at the smallest size tried */
  withinTarget: boolean;
}

export interface ImageEngine {
  compress(
    file: Blob,
    opts: CompressOptions,
    signal?: AbortSignal,
  ): Promise<CompressResult>;
  /** Terminates the worker; the next call starts a fresh one. */
  dispose(): void;
}

/** WASM/canvas heap never shrinks, so an idle worker is terminated to give memory back. */
const IDLE_MS = 30_000;

interface Job {
  id: number;
  file: Blob;
  opts: CompressOptions;
  resolve(result: CompressResult): void;
  reject(reason: unknown): void;
}

/**
 * Runs compression in a lazily started module worker, one job at a time to keep
 * peak memory low on 2–3 GB phones.
 */
export function createImageEngine(): ImageEngine {
  let worker: Worker | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let running: Job | undefined;
  const queue: Job[] = [];
  let nextId = 1;

  const stop = () => {
    clearTimeout(idle);
    worker?.terminate();
    worker = undefined;
  };

  const finish = (settle: (job: Job) => void) => {
    const job = running;
    running = undefined;
    if (job) settle(job);
    next();
  };

  const spawn = () => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = ({ data: msg }: MessageEvent<WorkerResponse>) => {
      if (msg.id !== running?.id) return;
      finish((job) =>
        msg.ok
          ? job.resolve(msg.result)
          : job.reject(
              msg.aborted
                ? new DOMException("Aborted", "AbortError")
                : new Error(msg.error),
            ),
      );
    };
    const crash = (message: string) => {
      stop();
      finish((job) => job.reject(new Error(message)));
    };
    w.onerror = (e) => {
      e.preventDefault();
      crash(e.message || "Image worker failed");
    };
    w.onmessageerror = () => crash("Image worker sent an unreadable message");
    return w;
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
    worker ??= spawn();
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
          const i = queue.indexOf(job);
          if (i >= 0) queue.splice(i, 1);
          // The slot stays busy until the worker confirms, so the next job never overlaps it.
          else if (running === job)
            worker?.postMessage({
              id: job.id,
              cancel: true,
            } satisfies CancelRequest);
          reject(signal?.reason);
        };
        const job: Job = {
          id: nextId++,
          file,
          opts,
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
      const err = new DOMException("Image engine disposed", "AbortError");
      const jobs = running ? [running, ...queue.splice(0)] : queue.splice(0);
      running = undefined;
      for (const job of jobs) job.reject(err);
    },
  };
}
