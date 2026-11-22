import type {
  CompressOptions,
  CompressResult,
  ImageEngine,
  OutputFormat,
} from "@tools/engines/image";
import type {
  TargetedDragEvent,
  TargetedEvent,
  TargetedSubmitEvent,
} from "preact";
import { kbMax } from "@tools/presets";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  formatBytes,
  formatKb,
  KB_MAX,
  statedMaxKb,
  statedMinKb,
} from "../lib/units";

export interface ToolSpec {
  format: OutputFormat;
  maxBytes: number;
  minBytes?: number;
  width?: number;
  height?: number;
  fit?: "cover" | "contain";
  background?: string;
}

export interface CompressToolProps {
  /** Fixed spec (preset pages). Omitted: the generic tool with editable target size. */
  spec?: ToolSpec;
  kind?: "photo" | "signature" | "scan";
}

interface Original {
  name: string;
  bytes: number;
  width: number;
  height: number;
}

type Result = CompressResult & { url: string; filename: string };

const INPUT_ID = "compress-file";
const DEFAULT_KB = 100;

const isHeic = (f: File) =>
  /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
const HEIC_MSG =
  "HEIC photos aren't supported yet. On iPhone, choose Settings › Camera › Formats › Most Compatible, or upload a screenshot of the photo.";

function stem(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 40) || "image";
}

async function readDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const positive = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

function genericSpec(kb: string, w: string, h: string): ToolSpec {
  const out: ToolSpec = {
    format: "image/jpeg",
    // Same 1% headroom as presets, so the stated limit reads back as typed.
    maxBytes: kbMax(positive(kb) ?? DEFAULT_KB),
  };
  const width = positive(w);
  const height = positive(h);
  if (width) out.width = width;
  if (height) out.height = height;
  return out;
}

export function CompressTool({ spec, kind = "photo" }: CompressToolProps) {
  const [kb, setKb] = useState(String(DEFAULT_KB));
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [original, setOriginal] = useState<Original | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const engine = useRef<ImageEngine | null>(null);
  const job = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const target: ToolSpec = spec ?? genericSpec(kb, w, h);

  useEffect(() => {
    if (!result) return;
    const { url } = result;
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(
    () => () => {
      job.current?.abort();
      engine.current?.dispose();
    },
    [],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const pasted = [...(e.clipboardData?.files ?? [])].find((f) =>
        f.type.startsWith("image/"),
      );
      if (pasted) {
        e.preventDefault();
        void run(pasted);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  async function run(next: File, opts: ToolSpec = target) {
    job.current?.abort();
    const ctrl = new AbortController();
    job.current = ctrl;
    setFile(next);
    setResult(null);
    setError("");
    setBusy(true);
    setStatus(`Reading ${next.name}…`);

    try {
      const dims = await readDimensions(next).catch(() => {
        throw new Error(
          isHeic(next)
            ? HEIC_MSG
            : "This file couldn't be opened as an image. Try a JPEG or PNG.",
        );
      });
      if (ctrl.signal.aborted) return;
      setOriginal({ name: next.name, bytes: next.size, ...dims });
      setStatus("Compressing on your device…");

      if (!engine.current) {
        const { createImageEngine } = await import("@tools/engines/image");
        engine.current = createImageEngine();
      }
      const options: CompressOptions = { fit: "cover", ...opts };
      const out = await engine.current.compress(next, options, ctrl.signal);
      if (ctrl.signal.aborted) return;

      const ext = out.format === "image/webp" ? "webp" : "jpg";
      const filename = `${stem(next.name)}-${out.width}x${out.height}-${Math.round(out.bytes / KB_MAX)}kb.${ext}`;
      setResult({ ...out, url: URL.createObjectURL(out.blob), filename });
      setStatus(
        out.withinTarget
          ? `Done: ${formatKb(out.bytes)}, ${out.width} × ${out.height} px. Ready to download.`
          : `Done, but the file is ${formatKb(out.bytes)}, still over the limit.`,
      );
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch (err) {
      if (
        ctrl.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      )
        return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        isHeic(next) && !msg.startsWith("HEIC")
          ? HEIC_MSG
          : msg || "Something went wrong.",
      );
      setStatus("");
    } finally {
      if (job.current === ctrl) setBusy(false);
    }
  }

  const onInput = (e: TargetedEvent<HTMLInputElement>) => {
    const picked = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (picked) void run(picked);
  };

  const onDrop = (e: TargetedDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer?.files[0];
    if (dropped) void run(dropped);
  };

  const onSettings = (e: TargetedSubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (file) void run(file);
  };

  const boxW = target.width ?? 4;
  const boxH = target.height ?? (target.width ? target.width : 5);
  const limit = spec?.minBytes
    ? `${statedMinKb(spec.minBytes)}–${statedMaxKb(target.maxBytes)} KB`
    : `≤ ${statedMaxKb(target.maxBytes)} KB`;

  return (
    <div class="grid gap-4">
      {!spec && (
        <form class="grid grid-cols-3 gap-3 sm:max-w-md" onSubmit={onSettings}>
          <label class="col-span-3 grid gap-1.5 text-sm font-medium sm:col-span-1">
            Max size (KB)
            <input
              class="field"
              name="kb"
              type="number"
              inputMode="numeric"
              min={1}
              max={20000}
              required
              value={kb}
              onInput={(e) => setKb(e.currentTarget.value)}
            />
          </label>
          <label class="grid gap-1.5 text-sm font-medium">
            <span>
              Width <span class="font-normal text-muted">px</span>
              <span class="sr-only">, optional</span>
            </span>
            <input
              class="field"
              name="width"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              placeholder="Auto"
              value={w}
              onInput={(e) => setW(e.currentTarget.value)}
            />
          </label>
          <label class="grid gap-1.5 text-sm font-medium">
            <span>
              Height <span class="font-normal text-muted">px</span>
              <span class="sr-only">, optional</span>
            </span>
            <input
              class="field"
              name="height"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              placeholder="Auto"
              value={h}
              onInput={(e) => setH(e.currentTarget.value)}
            />
          </label>
          {file && (
            <button
              class="btn-secondary col-span-3 justify-self-start"
              type="submit"
              disabled={busy}
            >
              Apply to {file.name}
            </button>
          )}
        </form>
      )}

      <div
        class={`grid place-items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent-subtle"
            : "border-border-strong bg-surface"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {/* Outline at the target aspect ratio; viewBox avoids a style attribute (CSP). */}
        <svg
          class="block max-h-20 w-full text-border-strong"
          viewBox={`0 0 ${boxW} ${boxH}`}
          aria-hidden="true"
          focusable="false"
        >
          <rect
            x="0"
            y="0"
            width={boxW}
            height={boxH}
            class="fill-subtle"
            stroke="currentColor"
            stroke-width="2"
            stroke-dasharray="4 3"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <p class="font-mono text-xs text-muted">
          {target.width && target.height
            ? `${target.width} × ${target.height} px · `
            : ""}
          {limit}
        </p>
        <input
          id={INPUT_ID}
          name="file"
          class="peer sr-only"
          type="file"
          accept="image/*"
          onChange={onInput}
        />
        <label
          for={INPUT_ID}
          class="btn-primary cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
        >
          {file ? `Choose another ${kind}` : `Choose ${kind}`}
        </label>
        <p class="text-sm text-muted">
          Or drop or paste an image. It never leaves this device.
        </p>
      </div>

      <p role="status" aria-live="polite" class="min-h-5 text-sm text-muted">
        {status}
      </p>
      {error && (
        <p
          role="alert"
          class="rounded-md border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-text"
        >
          <strong class="font-semibold text-danger">
            Couldn't process this file.{" "}
          </strong>
          {error}
        </p>
      )}

      {result && original && (
        <section
          class="card grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:p-6"
          aria-labelledby="result-heading"
        >
          <div class="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <h2
              id="result-heading"
              ref={resultHeading}
              tabIndex={-1}
              class="text-lg"
            >
              Result
            </h2>
            <span
              class={`badge ${result.withinTarget ? "badge-success" : "badge-danger"}`}
            >
              {result.withinTarget ? `Within ${limit}` : "Over the limit"}
            </span>
          </div>
          <img
            src={result.url}
            width={result.width}
            height={result.height}
            alt={`Compressed ${kind} preview, ${result.width} by ${result.height} pixels`}
            class="mx-auto h-auto max-h-72 w-auto max-w-full rounded-sm border border-border bg-subtle"
          />
          <div class="grid content-start gap-4">
            <dl class="kv text-sm">
              <div>
                <dt>Original</dt>
                <dd>
                  {formatKb(original.bytes)} · {original.width}×
                  {original.height}
                </dd>
              </div>
              <div>
                <dt>Result</dt>
                <dd class="font-semibold">
                  {formatKb(result.bytes)} · {result.width}×{result.height}
                </dd>
              </div>
              <div>
                <dt>Exact size</dt>
                <dd>{formatBytes(result.bytes)}</dd>
              </div>
            </dl>
            {!result.withinTarget && (
              <p class="text-sm text-muted">
                Couldn't get under {limit} even at the lowest quality. Crop
                closer or use a smaller width and height.
              </p>
            )}
            <a
              class="btn-primary justify-self-start"
              href={result.url}
              download={result.filename}
            >
              Download {result.filename.split(".").pop()?.toUpperCase()}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
