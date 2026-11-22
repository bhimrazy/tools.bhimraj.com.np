import type {
  CompressOptions,
  CompressResult,
  ImageEngine,
  OutputFormat,
} from "@tools/engines/image";
import Check from "lucide-react/icons/check";
import ChevronRight from "lucide-react/icons/chevron-right";
import Download from "lucide-react/icons/download";
import ImageUp from "lucide-react/icons/image-up";
import Smartphone from "lucide-react/icons/smartphone";
import {
  type ChangeEvent,
  type DragEvent,
  lazy,
  type SubmitEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gaugeState } from "../lib/gauge";
import {
  figureKb,
  formatBytes,
  formatKb,
  KB_MAX,
  statedMaxKb,
  statedMinKb,
} from "../lib/units";
import { FitGauge } from "./brand/FitGauge";
import { StatusGlyph } from "./brand/StatusGlyph";

export interface ToolSpec {
  format: OutputFormat;
  maxBytes: number;
  minBytes?: number;
  width?: number;
  height?: number;
  background?: string;
}

export interface CompressToolProps {
  /** Fixed size rule (preset pages). Omitted: the generic tool with an editable limit. */
  spec?: ToolSpec;
  kind?: "photo" | "signature" | "scan";
  /** Preset pages: false when the rule has not been checked against an official source. */
  verified?: boolean;
}

interface Original {
  name: string;
  bytes: number;
  width: number;
  height: number;
  url: string;
}

type Result = CompressResult & { url: string; filename: string };
type Phase = "empty" | "working" | "done" | "error";

const INPUT_ID = "compress-file";
const DEFAULT_KB = 50;
const CHIPS_KB = [20, 50, 100, 200, 1000];
// Loaded after first paint: both pull in Base UI's positioning code, and Select server-renders a style="".
const FormatSelect = lazy(() => import("./FormatSelect"));
const ExactSize = lazy(() => import("./ExactSize"));
const FORMAT_NAME: Record<OutputFormat, string> = {
  "image/jpeg": "JPG",
  "image/webp": "WebP",
};

const isHeic = (f: File) =>
  /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
const HEIC_MSG =
  "HEIC photos can't be opened yet. On iPhone, choose Settings › Camera › Formats › Most Compatible, or take a screenshot of the photo and add that.";

function stem(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 40) || "image";
}

async function readDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight };
}

const positive = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

function genericSpec(
  kb: string,
  w: string,
  h: string,
  format: OutputFormat,
): ToolSpec {
  const out: ToolSpec = {
    format,
    maxBytes: Math.round((Number(kb) > 0 ? Number(kb) : DEFAULT_KB) * KB_MAX),
  };
  const width = positive(w);
  const height = positive(h);
  if (width) out.width = width;
  if (height) out.height = height;
  return out;
}

const kbLabel = (kb: number) => (kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`);

/** False during the server render and hydration, true after: gates parts that SSR with style="". */
const subscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

export function CompressTool({
  spec,
  kind = "photo",
  verified,
}: CompressToolProps) {
  const [kb, setKb] = useState(String(DEFAULT_KB));
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [file, setFile] = useState<File | null>(null);
  const [original, setOriginal] = useState<Original | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [phase, setPhase] = useState<Phase>("empty");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const hydrated = useHydrated();

  const engine = useRef<ImageEngine | null>(null);
  const job = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const target: ToolSpec = spec ?? genericSpec(kb, w, h, format);
  const noun = spec ? kind : "image";
  const aNoun = noun === "image" ? "an image" : `a ${noun}`;
  const lo = spec?.minBytes;
  const limitText = lo
    ? `${statedMinKb(lo)}–${statedMaxKb(target.maxBytes)} KB`
    : `under ${statedMaxKb(target.maxBytes)} KB`;
  const ruleWords = `Your limit is ${limitText}.`;

  useEffect(() => {
    if (!result) return;
    const { url } = result;
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => {
    if (!original) return;
    const { url } = original;
    return () => URL.revokeObjectURL(url);
  }, [original]);

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
    setPhase("working");

    try {
      if (!original || file !== next) {
        const url = URL.createObjectURL(next);
        const dims = await readDimensions(url).catch(() => {
          URL.revokeObjectURL(url);
          throw new Error(
            isHeic(next)
              ? HEIC_MSG
              : `Can't open ${next.name}. Choose a JPG, PNG or WebP image.`,
          );
        });
        if (ctrl.signal.aborted) return URL.revokeObjectURL(url);
        setOriginal({ name: next.name, bytes: next.size, url, ...dims });
      }

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
      setPhase("done");
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
          : msg || "Something went wrong. Try again.",
      );
      setOriginal(null);
      setPhase("error");
    }
  }

  const cancel = () => {
    job.current?.abort();
    setOriginal(null);
    setFile(null);
    setPhase("empty");
  };

  const reset = () => {
    setResult(null);
    setOriginal(null);
    setFile(null);
    setPhase("empty");
    requestAnimationFrame(() => fileInput.current?.focus());
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (picked) void run(picked);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer?.files[0];
    if (dropped) void run(dropped);
  };

  const onSettings = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (file) void run(file);
  };

  const smaller = () => {
    if (!file || !result) return;
    const nw = Math.max(1, Math.round(result.width / 2));
    const nh = positive(h)
      ? String(Math.max(1, Math.round(result.height / 2)))
      : "";
    setW(String(nw));
    setH(nh);
    void run(file, genericSpec(kb, String(nw), nh, format));
  };

  const fileInputEl = (
    <input
      ref={fileInput}
      id={INPUT_ID}
      name="file"
      className="peer sr-only"
      type="file"
      accept="image/*"
      onChange={onInput}
    />
  );
  const chooseLabel = (
    text: string,
    variant: "default" | "outline" = "default",
  ) => (
    <label
      htmlFor={INPUT_ID}
      className={cn(
        buttonVariants({ variant }),
        "cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
      )}
    >
      {text}
    </label>
  );

  const formatClass =
    "h-10 rounded-sm bg-paper text-[17px] font-[650] text-ink md:h-11 md:text-xl";
  const formatStatic = (
    <span className="inline-flex h-10 items-center rounded-sm border border-input bg-paper px-3 text-[17px] font-[650] text-ink md:h-11 md:text-xl">
      {FORMAT_NAME[format]}
    </span>
  );

  const pass = result ? result.withinTarget : false;
  const state = result
    ? gaugeState(result.bytes, target.maxBytes, lo)
    : "empty";
  const fig = result ? figureKb(result.bytes, pass) : "";

  return (
    <div className="grid gap-4 md:gap-5">
      {/* The task, said as one sentence. */}
      <div className="rounded-xl border border-line bg-card p-3.5 md:px-5 md:py-[18px]">
        {spec ? (
          <p className="text-lg leading-snug font-medium text-ink-2 md:text-2xl">
            Make your {kind}{" "}
            {spec.width && spec.height && (
              <b className="num font-[650] text-ink" translate="no">
                {spec.width} × {spec.height} px
              </b>
            )}
            {spec.width && spec.height ? ", " : ""}
            <b className="num font-[650] text-ink" translate="no">
              {limitText}
            </b>
            , as{" "}
            <b className="font-[650] text-ink">{FORMAT_NAME[spec.format]}</b>
            {spec.background && /^#f{3}(f{3})?$/i.test(spec.background) ? (
              <> on a white background</>
            ) : null}
            .
          </p>
        ) : (
          <form className="grid gap-3" onSubmit={onSettings}>
            <p
              className="flex flex-wrap items-center gap-2 text-lg leading-snug font-medium text-ink-2 md:gap-2.5 md:text-2xl"
              role="group"
              aria-label="Compress settings"
            >
              <span>Make your image smaller than</span>
              <label className="inline-flex items-center">
                <span className="sr-only">Size limit (KB)</span>
                <Input
                  className="h-10 w-[5.5rem] rounded-sm bg-paper px-2 text-center text-[17px] font-[650] md:h-11 md:text-xl"
                  name="kb"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={20000}
                  step="any"
                  required
                  value={kb}
                  onChange={(e) => setKb(e.currentTarget.value)}
                />
              </label>
              <span translate="no">KB</span>
              <span>as</span>
              {hydrated ? (
                <Suspense fallback={formatStatic}>
                  <FormatSelect
                    value={format}
                    onChange={setFormat}
                    className={formatClass}
                  />
                </Suspense>
              ) : (
                formatStatic
              )}
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Common size limits"
            >
              {CHIPS_KB.map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="num rounded-full px-3 font-[520]"
                  aria-pressed={Number(kb) === c}
                  onClick={() => setKb(String(c))}
                >
                  {kbLabel(c)}
                </Button>
              ))}
            </div>
            <fieldset className="flex flex-wrap items-end gap-3">
              <legend className="mb-1.5 text-sm font-semibold">
                Width and height{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </legend>
              <label className="grid gap-1 text-sm text-muted-foreground">
                Width (px)
                <Input
                  className="w-28"
                  name="width"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  placeholder="Keep"
                  value={w}
                  onChange={(e) => setW(e.currentTarget.value)}
                />
              </label>
              <label className="grid gap-1 text-sm text-muted-foreground">
                Height (px)
                <Input
                  className="w-28"
                  name="height"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  placeholder="Keep"
                  value={h}
                  onChange={(e) => setH(e.currentTarget.value)}
                />
              </label>
              {file && (
                <Button
                  type="submit"
                  variant="outline"
                  disabled={phase === "working"}
                >
                  Try again with these settings
                </Button>
              )}
            </fieldset>
          </form>
        )}
      </div>

      {/* The work slot. */}
      {fileInputEl}
      {(phase === "empty" || phase === "error") && (
        <div className="grid gap-4">
          <div className="rounded-xl border border-line bg-card px-4 pt-3.5 pb-1">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="st text-muted-foreground">
                <StatusGlyph status="idle" />
                No {noun} yet
              </span>
              <span className="num font-semibold">Your limit: {limitText}</span>
            </div>
            <FitGauge
              lo={lo}
              hi={target.maxBytes}
              state="empty"
              label={`No ${noun} yet. ${ruleWords}`}
              loText={lo ? `${statedMinKb(lo)} KB` : undefined}
              hiText={`${statedMaxKb(target.maxBytes)} KB limit`}
            />
          </div>

          {phase === "error" && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-line bg-card p-4"
            >
              <StatusGlyph
                status="err"
                className="mt-0.5 size-6 shrink-0 text-status-bad"
              />
              <div className="grid gap-1">
                <h2 className="t-h3">Can't open this file</h2>
                <p className="text-[15px] text-ink-2">{error}</p>
              </div>
            </div>
          )}

          <div
            className={`grid justify-items-center gap-2.5 rounded-xl border-[1.5px] border-dashed px-4 py-8 text-center transition-colors ${
              dragging ? "border-ink bg-sunk" : "border-line-strong bg-card"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className="grid size-12 place-items-center rounded-full border-[1.5px] border-dashed border-line-strong text-ink-2">
              <ImageUp
                aria-hidden="true"
                className="size-6"
                strokeWidth={1.75}
              />
            </span>
            <h2 className="t-h3">Add {aNoun}</h2>
            <p className="text-[13px] text-muted-foreground">
              JPG, PNG or WebP. Drop it here, paste it, or choose one.
            </p>
            {chooseLabel(
              phase === "error" ? `Choose another ${noun}` : `Choose ${aNoun}`,
            )}
            <p className="flex items-start justify-center gap-1.5 text-[13px] text-balance text-muted-foreground">
              <Smartphone
                aria-hidden="true"
                className="size-4 text-accent-ink"
                strokeWidth={2}
              />
              Your {noun} stays on this device. Nothing is uploaded.
            </p>
          </div>
        </div>
      )}

      {(phase === "working" || phase === "done") && original && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)] md:gap-5">
          <div className="grid content-start gap-2">
            <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-rail">
              <img
                src={result?.url ?? original.url}
                alt={
                  result
                    ? `Saved ${noun}, ${result.width} by ${result.height} pixels`
                    : `Your ${noun} before compressing`
                }
                className="max-h-full max-w-full object-contain"
              />
              <span className="num absolute top-2.5 left-2.5 rounded-xs bg-image-scrim px-2 py-1 text-xs font-semibold text-on-image">
                {!result
                  ? `Original · ${formatKb(original.bytes)}`
                  : pass
                    ? `After · ${fig} KB`
                    : `Best try · ${fig} KB`}
              </span>
              {phase === "working" && (
                <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-xs bg-image-scrim px-2.5 py-1.5 text-[13px] font-[550] text-on-image">
                  <Smartphone
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={2}
                  />
                  Working on this device
                </span>
              )}
            </div>
            <p className="num flex flex-wrap gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
              <b
                className="font-semibold [overflow-wrap:anywhere] text-ink"
                translate="no"
              >
                {original.name}
              </b>
              <span>
                {result
                  ? `${result.width} × ${result.height} px · ${fig} KB · was ${formatKb(original.bytes)}`
                  : `${original.width} × ${original.height} px · ${formatKb(original.bytes)}`}
              </span>
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-card">
            {phase === "working" && (
              <>
                <div className="grid gap-2 border-b border-line p-4">
                  <p className="st text-ink-2" role="status">
                    <StatusGlyph status="work" />
                    Making it smaller…
                  </p>
                  <p className="num">
                    <b>Now {formatKb(original.bytes)}.</b> {ruleWords}
                  </p>
                  <FitGauge
                    lo={lo}
                    hi={target.maxBytes}
                    at={original.bytes}
                    state="pending"
                    label={`Now ${formatKb(original.bytes)}. ${ruleWords}`}
                    loText={lo ? `${statedMinKb(lo)} KB` : undefined}
                    hiText={`${statedMaxKb(target.maxBytes)} KB limit`}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5 p-4">
                  <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <Smartphone
                      aria-hidden="true"
                      className="size-4 text-accent-ink"
                      strokeWidth={2}
                    />
                    Working on this device. No files uploaded.
                  </p>
                  <Button variant="outline" onClick={cancel}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {phase === "done" && result && (
              <>
                <div
                  className={`grid gap-2.5 px-[18px] pt-[18px] pb-3.5 ${pass ? "on-band" : "bg-status-bad-soft text-ink"}`}
                >
                  <h2
                    ref={resultHeading}
                    tabIndex={-1}
                    className="flex items-start gap-2 text-[15px] leading-snug font-[650]"
                  >
                    <StatusGlyph
                      status={pass ? "fit" : "no"}
                      className={`size-5 shrink-0 ${pass ? "" : "text-status-bad"}`}
                    />
                    {pass
                      ? `Done: ${fig} KB, ${lo ? `inside your ${limitText} limit` : `under your ${statedMaxKb(target.maxBytes)} KB limit`}`
                      : state === "under"
                        ? `Too small: ${fig} KB. The smallest allowed is ${statedMinKb(lo ?? 0)} KB.`
                        : `Too big: ${fig} KB. Your limit is ${statedMaxKb(target.maxBytes)} KB.`}
                  </h2>
                  <Suspense
                    fallback={
                      <span className="figure">
                        <b>{fig}</b>
                        <span>KB</span>
                      </span>
                    }
                  >
                    <ExactSize fig={fig} bytes={formatBytes(result.bytes)} />
                  </Suspense>
                  <FitGauge
                    lo={lo}
                    hi={target.maxBytes}
                    at={result.bytes}
                    state={pass ? "fit" : state}
                    label={`${fig} KB. ${ruleWords}`}
                    loText={lo ? `${statedMinKb(lo)} KB` : undefined}
                    hiText={`${statedMaxKb(target.maxBytes)} KB limit`}
                  />
                  <p
                    className={`text-xs ${pass ? "text-on-band-muted" : "text-ink-2"}`}
                  >
                    {pass
                      ? "We checked the saved file, not an estimate."
                      : "This is the smallest we could make it at this size."}
                  </p>
                </div>

                {pass ? (
                  <>
                    <ul className="num grid gap-1.5 px-4 pt-3 pb-1 text-sm">
                      <li className="flex items-center gap-2">
                        <Check
                          aria-hidden="true"
                          className="size-[18px] text-status-ok"
                          strokeWidth={2}
                        />
                        Size: {fig} KB{" "}
                        <span className="text-muted-foreground">
                          ({formatBytes(result.bytes)})
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check
                          aria-hidden="true"
                          className="size-[18px] text-status-ok"
                          strokeWidth={2}
                        />
                        Format: {FORMAT_NAME[result.format]}
                      </li>
                      <li className="flex items-center gap-2">
                        <Check
                          aria-hidden="true"
                          className="size-[18px] text-status-ok"
                          strokeWidth={2}
                        />
                        Width and height: {result.width} × {result.height} px
                      </li>
                    </ul>
                    {verified === false && (
                      <p className="mx-4 mt-3 flex items-start gap-2.5 rounded-lg bg-sunk px-3.5 py-3 text-sm">
                        <StatusGlyph
                          status="unv"
                          className="mt-px size-5 shrink-0 text-status-warn"
                        />
                        <span>
                          <b>Not checked yet.</b> Meets the size rule we have.
                          Check your notice before you submit.
                        </span>
                      </p>
                    )}
                    <div className="px-4 pt-3.5">
                      <Button
                        className="h-14 w-full justify-start"
                        nativeButton={false}
                        render={
                          <a href={result.url} download={result.filename} />
                        }
                      >
                        <Download aria-hidden="true" />
                        <span className="grid text-left leading-tight">
                          Download image
                          <small
                            className="text-xs font-medium opacity-85"
                            translate="no"
                          >
                            {result.filename}
                          </small>
                        </span>
                      </Button>
                    </div>
                    <div className="px-4 pt-3 pb-3.5">
                      <p className="mb-0.5 text-xs font-semibold text-muted-foreground">
                        Next
                      </p>
                      <button
                        type="button"
                        onClick={reset}
                        className="grid min-h-11 w-full grid-cols-[1fr_16px] items-center gap-2.5 border-t border-line text-left text-[15px] font-[520]"
                      >
                        Make another {noun}
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-4 p-4">
                    <p>
                      At{" "}
                      <span className="num">
                        {result.width} × {result.height} px
                      </span>
                      , this image can't get{" "}
                      {state === "under" ? "above" : "below"} {fig} KB.
                    </p>
                    {state === "over" && (
                      <div className="grid gap-2 rounded-lg border border-line bg-paper p-3.5">
                        <p className="text-[15px]">
                          <b>Fix:</b>{" "}
                          {spec
                            ? `crop your ${kind} closer, or save it smaller, then add it again.`
                            : "make it fewer pixels wide, then try again."}
                        </p>
                        {!spec && (
                          <Button className="w-full" onClick={smaller}>
                            Make it {Math.max(1, Math.round(result.width / 2))}{" "}
                            px wide and try again
                          </Button>
                        )}
                        {chooseLabel(`Choose another ${noun}`, "outline")}
                      </div>
                    )}
                    <a
                      className="inline-flex min-h-11 items-center gap-2 text-sm font-[550] underline"
                      href={result.url}
                      download={result.filename}
                    >
                      <Download aria-hidden="true" className="size-4" />
                      Download the {fig} KB file anyway (
                      {state === "under" ? "under" : "over"} your limit)
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
