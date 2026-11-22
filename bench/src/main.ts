import { createImageEngine } from "@tools/image";
// Not exported by the package: called directly so CPU throttling (main thread only) applies.
import { compressImage } from "@tools/image/compress";
import { presets } from "@tools/presets";
import { inputs, jobs, type InputSpec, type JobSpec } from "./cases";

export interface JobResult {
  input: string;
  label: string;
  inputBytes: number;
  wallMs: number;
  outBytes: number;
  maxBytes: number;
  withinTarget: boolean;
  width: number;
  height: number;
  quality: number;
}

const blobs = new Map<string, Blob>();
let seed = 1;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

async function generate(spec: InputSpec): Promise<Blob> {
  const { width, height, kind } = spec;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  if (kind === "photo") {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#1c3d6e");
    g.addColorStop(0.5, "#d9a441");
    g.addColorStop(1, "#7a2f4b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    const tile = 512;
    for (let y = 0; y < height; y += tile) {
      for (let x = 0; x < width; x += tile) {
        const img = ctx.getImageData(
          x,
          y,
          Math.min(tile, width - x),
          Math.min(tile, height - y),
        );
        for (let i = 0; i < img.data.length; i += 4) {
          const n = (rand() - 0.5) * 60;
          img.data[i] = (img.data[i] ?? 0) + n;
          img.data[i + 1] = (img.data[i + 1] ?? 0) + n;
          img.data[i + 2] = (img.data[i + 2] ?? 0) + n;
        }
        ctx.putImageData(img, x, y);
      }
    }
  } else if (kind === "signature") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#101828";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(80, height * 0.6);
    for (let x = 80; x < width - 80; x += 160) {
      ctx.bezierCurveTo(
        x + 40,
        height * 0.1,
        x + 90,
        height * 0.95,
        x + 160,
        height * 0.5,
      );
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(width / 4, height / 4, width / 2, height / 2);
  }
  return canvas.convertToBlob(
    kind === "photo"
      ? { type: "image/jpeg", quality: 0.9 }
      : { type: "image/png" },
  );
}

const api = {
  inputs,
  jobs,
  async prepare(): Promise<void> {
    for (const spec of inputs) blobs.set(spec.id, await generate(spec));
  },
  async run(job: JobSpec, where: "worker" | "main"): Promise<JobResult> {
    const file = blobs.get(job.input)!;
    // Fresh engine per job: cold worker start is part of what a phone pays.
    const engine = where === "worker" ? createImageEngine() : undefined;
    const run = (file: Blob, o: Parameters<typeof compressImage>[1]) =>
      engine ? engine.compress(file, o) : compressImage(file, o);
    const start = performance.now();
    try {
      const r = await run(file, {
        maxBytes: job.maxBytes,
        ...(job.minBytes !== undefined && { minBytes: job.minBytes }),
        ...(job.width !== undefined && { width: job.width }),
        ...(job.height !== undefined && { height: job.height }),
        fit: "cover",
      });
      const wallMs = Math.round(performance.now() - start);
      return {
        input: job.input,
        label: job.label,
        inputBytes: file.size,
        wallMs,
        outBytes: r.bytes,
        maxBytes: job.maxBytes,
        withinTarget: r.withinTarget,
        width: r.width,
        height: r.height,
        quality: Math.round(r.quality * 100) / 100,
      };
    } finally {
      engine?.dispose();
    }
  },
};

/** Lok Sewa photo and signature presets, run on the matching generated inputs. */
export function presetJobs(): JobSpec[] {
  const out: JobSpec[] = [];
  for (const [id, input] of [
    ["np-lok-sewa-photo", "photo-12mp"],
    ["np-lok-sewa-signature", "signature-2000x600"],
  ] as const) {
    const p = presets.find((x) => x.id === id);
    if (!p) continue;
    const o = p.output;
    out.push({
      input,
      label: `${id} ${o.width}x${o.height}`,
      maxBytes: o.maxBytes,
      ...(o.minBytes !== undefined && { minBytes: o.minBytes }),
      ...(o.width !== undefined && { width: o.width }),
      ...(o.height !== undefined && { height: o.height }),
    });
  }
  return out;
}

Object.assign(window, { bench: { ...api, presetJobs } });
