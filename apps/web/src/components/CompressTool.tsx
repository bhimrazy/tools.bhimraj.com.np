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
import { useEffect, useRef, useState } from "preact/hooks";
import {
  formatBytes,
  formatKb,
  KB_MAX,
  statedMaxKb,
  statedMinKb,
} from "../lib/units";
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconError,
  IconLock,
} from "./icons";

export interface ToolSpec {
  format: OutputFormat;
  maxBytes: number;
  minBytes?: number;
  width?: number;
  height?: number;
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

const FORMAT_NAME: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};
const colourName = (hex: string) =>
  /^#f{3}(f{3})?$/i.test(hex) ? "White" : hex.toUpperCase();

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
    maxBytes: (positive(kb) ?? DEFAULT_KB) * KB_MAX,
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
    // A file dropped anywhere on the page is used too, instead of the browser opening it.
    const onPageDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onPageDrop = (e: DragEvent) => {
      if (e.defaultPrevented) return;
      const dropped = e.dataTransfer?.files[0];
      if (dropped) {
        e.preventDefault();
        void run(dropped);
      }
    };
    document.addEventListener("paste", onPaste);
    document.addEventListener("dragover", onPageDragOver);
    document.addEventListener("drop", onPageDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragover", onPageDragOver);
      document.removeEventListener("drop", onPageDrop);
    };
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
      const options: CompressOptions = { ...opts, fit: "cover" };
      const out = await engine.current.compress(next, options, ctrl.signal);
      if (ctrl.signal.aborted) return;

      const ext = out.format === "image/webp" ? "webp" : "jpg";
      const filename = `${stem(next.name)}-${out.width}x${out.height}-${Math.round(out.bytes / KB_MAX)}kb.${ext}`;
      setResult({ ...out, url: URL.createObjectURL(out.blob), filename });
      setStatus(
        out.withinTarget
          ? `Done: ${formatKb(out.bytes)}, ${out.width} × ${out.height} px. Ready to download.`
          : opts.minBytes !== undefined && out.bytes < opts.minBytes
            ? `Done, but the file is ${formatKb(out.bytes)}, under the ${statedMinKb(opts.minBytes)} KB minimum.`
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

  const shape = target.width && target.height;
  const limit = spec?.minBytes
    ? `${statedMinKb(spec.minBytes)}–${statedMaxKb(target.maxBytes)} KB`
    : `≤ ${statedMaxKb(target.maxBytes)} KB`;

  return (
    <div class="grid gap-4">
      {!spec && (
        <form
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:max-w-lg"
          onSubmit={onSettings}
        >
          <label class="col-span-2 grid gap-1.5 text-sm font-medium sm:col-span-1">
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
              class="btn-secondary col-span-2 max-w-full min-w-0 justify-self-start sm:col-span-3"
              type="submit"
              disabled={busy}
            >
              <span class="truncate">Apply to {file.name}</span>
            </button>
          )}
        </form>
      )}

      {spec && (
        <dl class="readout" aria-label="Required output">
          {target.width && target.height && (
            <div>
              <dt>Dimensions</dt>
              <dd>
                {target.width} × {target.height} px
              </dd>
            </div>
          )}
          <div>
            <dt>File size</dt>
            <dd>
              {spec.minBytes
                ? limit
                : `Up to ${statedMaxKb(target.maxBytes)} KB`}
            </dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{FORMAT_NAME[target.format] ?? target.format}</dd>
          </div>
          {target.background && (
            <div>
              <dt>Background</dt>
              <dd>{colourName(target.background)}</dd>
            </div>
          )}
        </dl>
      )}

      <div
        class="dropzone group"
        data-dragging={dragging || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // dragleave also fires when moving onto a child; only clear when leaving the zone.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={onDrop}
      >
        {shape && (
          /* Outline at the target aspect ratio; viewBox avoids a style attribute (CSP). */
          <svg
            class="block h-14 w-full text-border-strong group-data-dragging:text-accent"
            viewBox={`0 0 ${target.width} ${target.height}`}
            aria-hidden="true"
            focusable="false"
          >
            <rect
              x="0"
              y="0"
              width={target.width}
              height={target.height}
              class="fill-subtle"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="3 3"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        )}
        <p class="hidden text-sm font-medium pointer-fine:block">
          {dragging
            ? `Release to use this ${kind}`
            : `Drop your ${kind} here, or`}
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
          class={`${result ? "btn-secondary" : "btn-primary"} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus`}
        >
          {file ? `Choose another ${kind}` : `Choose ${kind}`}
        </label>
        <p class="text-xs text-muted">
          JPEG, PNG or WebP. You can also paste an image.
        </p>
        <p class="flex items-center gap-1.5 text-xs text-muted">
          <IconLock class="size-3.5" />
          Processed on this device. Nothing is uploaded.
        </p>
      </div>

      <p
        role="status"
        aria-live="polite"
        class="flex min-h-5 items-center gap-2 text-sm text-muted"
      >
        {busy && <span class="spinner" aria-hidden="true" />}
        {status}
      </p>
      {error && (
        <div role="alert" class="alert alert-danger">
          <IconError />
          <p>
            <strong class="font-semibold">Couldn't process this file. </strong>
            {error}
          </p>
        </div>
      )}

      {result && original && (
        <section class="card" aria-labelledby="result-heading">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
            <h2
              id="result-heading"
              ref={resultHeading}
              tabIndex={-1}
              class="text-base"
            >
              Result
            </h2>
            {result.withinTarget ? (
              <span class="badge badge-success">
                <IconCheck class="size-3.5" />
                Within {limit}
              </span>
            ) : (
              <span class="badge badge-danger">
                <IconError class="size-3.5" />
                Not within {limit}
              </span>
            )}
          </div>
          <div class="grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:p-5">
            <div class="grid place-items-center rounded-md border border-border bg-subtle p-3">
              <img
                src={result.url}
                width={result.width}
                height={result.height}
                alt={`Compressed ${kind} preview, ${result.width} by ${result.height} pixels`}
                class="h-auto max-h-56 w-auto max-w-full sm:max-h-64"
              />
            </div>
            <div class="grid content-start gap-4">
              <dl class="readout">
                <div>
                  <dt>File size</dt>
                  <dd class={result.withinTarget ? "" : "text-danger"}>
                    {formatKb(result.bytes)}
                  </dd>
                </div>
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {result.width} × {result.height} px
                  </dd>
                </div>
              </dl>
              <dl class="kv text-sm">
                <div>
                  <dt>Exact size</dt>
                  <dd>{formatBytes(result.bytes)}</dd>
                </div>
                <div>
                  <dt>Original</dt>
                  <dd>
                    {formatKb(original.bytes)} · {original.width} ×{" "}
                    {original.height} px
                  </dd>
                </div>
              </dl>
              {!result.withinTarget && (
                <div class="alert alert-warning">
                  <IconAlert />
                  <p>
                    {spec?.minBytes !== undefined &&
                    result.bytes < spec.minBytes
                      ? `This image has too little detail to reach ${statedMinKb(spec.minBytes)} KB, even at full quality. Try a larger or sharper ${kind}.`
                      : `Couldn't get under ${statedMaxKb(target.maxBytes)} KB, even at the lowest quality. ${
                          spec
                            ? `Crop your ${kind} closer and try again.`
                            : "Crop closer, or set a smaller width and height."
                        }`}
                  </p>
                </div>
              )}
              <a
                class={`${result.withinTarget ? "btn-primary" : "btn-secondary"} w-full sm:w-auto sm:justify-self-start`}
                href={result.url}
                download={result.filename}
              >
                <IconDownload />
                Download {result.filename.split(".").pop()?.toUpperCase()}
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
