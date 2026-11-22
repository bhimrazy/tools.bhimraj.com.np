import type { OutputFormat } from "@tools/image";
import { kbToMaxBytes, maxBytesToKb, type SizeRule } from "@tools/presets";
import Check from "lucide-react/icons/check";
import ChevronRight from "lucide-react/icons/chevron-right";
import Download from "lucide-react/icons/download";
import ImageUp from "lucide-react/icons/image-up";
import Smartphone from "lucide-react/icons/smartphone";
import {
  lazy,
  type SubmitEvent,
  Suspense,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes, formatFigureKb, formatFileSize } from "../lib/units";
import { useCompressJob } from "../lib/use-compress-job";
import { formatVerdict } from "../lib/verdict";
import { ActionBar } from "./ActionBar";
import { FitsGauge } from "./brand/FitsGauge";
import { StatusGlyph } from "./brand/StatusGlyph";
import { ResultBand } from "./ResultBand";

export interface CompressToolProps {
  /** Prefix for element ids. */
  id?: string;
}

const DEFAULT_MAX_KB = 100;
const CHIPS_KB = [20, 50, 100, 200, 1000];
// Loaded after first paint: it pulls in Base UI's positioning code, and Select server-renders a style="".
const FormatSelect = lazy(() => import("./FormatSelect"));
export const FORMAT_NAME: Record<OutputFormat, string> = {
  "image/jpeg": "JPG",
  "image/webp": "WebP",
};

const positive = (v: string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

function toCustomRule(
  kb: string,
  w: string,
  h: string,
  format: OutputFormat,
): SizeRule {
  const out: SizeRule = {
    format,
    fit: "cover",
    // Same headroom as presets, so the stated limit reads back as typed.
    maxBytes: kbToMaxBytes(Number(kb) > 0 ? Number(kb) : DEFAULT_MAX_KB),
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

/** Compress to KB: the task as one sentence, and one work slot that changes state in place. */
export function CompressTool({ id = "compress" }: CompressToolProps) {
  const inputId = `${id}-file`;
  const resultId = `${id}-result-heading`;
  const [kb, setKb] = useState(String(DEFAULT_MAX_KB));
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const hydrated = useHydrated();
  const kbInput = useRef<HTMLInputElement>(null);
  const wInput = useRef<HTMLInputElement>(null);
  const hInput = useRef<HTMLInputElement>(null);

  const target = toCustomRule(kb, w, h, format);
  const job = useCompressJob({
    inputId,
    target,
    acceptsHandoff: () => true,
    // Values typed into the server HTML before hydration live only in the DOM; a size rule
    // from search arrives in the URL (?kb=50&w=300&h=350).
    readMountTarget: () => {
      const q = new URLSearchParams(location.search);
      const typedKb = String(
        positive(q.get("kb")) ?? (kbInput.current?.value || kb),
      );
      const typedW = q.get("w") ?? wInput.current?.value ?? w;
      const typedH = q.get("h") ?? hInput.current?.value ?? h;
      setKb(typedKb);
      setW(positive(typedW) ? typedW : "");
      setH(positive(typedH) ? typedH : "");
      if (positive(typedW) || positive(typedH) || location.hash === "#custom")
        setCustomOpen(true);
      return toCustomRule(typedKb, typedW, typedH, format);
    },
  });
  const { phase, original, result, failure, file } = job;

  const maxKb = maxBytesToKb(target.maxBytes);
  const limitText = `under ${maxKb} KB`;
  const ruleWords = `Your limit is ${limitText}.`;
  const reading = phase === "working" && !original;
  const pass = result?.fitsBytes ?? false;
  const fig = result ? formatFigureKb(result.bytes, pass) : "";
  const halfWidth = result ? Math.max(1, Math.round(result.width / 2)) : 0;
  const announcement = reading
    ? "Reading your image…"
    : phase === "working"
      ? "Making it smaller on this device…"
      : result
        ? formatVerdict(result.bytes, target)
        : "";

  const onSettings = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (file) void job.run(file);
  };

  const smaller = () => {
    if (!file || !result) return;
    const nh = positive(h)
      ? String(Math.max(1, Math.round(result.height / 2)))
      : "";
    setW(String(halfWidth));
    setH(nh);
    setCustomOpen(true);
    void job.run(file, toCustomRule(kb, String(halfWidth), nh, format));
  };

  const chooseLabel = (
    text: string,
    variant: "default" | "outline" = "default",
    className = "",
  ) => (
    <label
      htmlFor={inputId}
      className={cn(
        buttonVariants({ variant }),
        // The input is visually hidden, so its keyboard focus is drawn on every label for it.
        "cursor-pointer group-has-[input[type=file]:focus-visible]/tool:outline-2 group-has-[input[type=file]:focus-visible]/tool:outline-offset-2 group-has-[input[type=file]:focus-visible]/tool:outline-ring",
        className,
      )}
    >
      {text}
    </label>
  );

  const formatStatic = (
    <span className="inline-flex h-11 items-center rounded-sm border border-input bg-paper px-3 text-[19px] font-[650] text-ink md:h-12 md:text-2xl">
      {FORMAT_NAME[format]}
    </span>
  );

  return (
    <div className="group/tool" ref={job.root} data-tool-slot>
      <input
        ref={job.fileInput}
        id={inputId}
        name="file"
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={job.onInput}
      />
      {/* One live region, always mounted, so each change is announced. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {/* The task, said as one sentence. */}
        <form
          className="grid gap-3.5 p-4 md:px-6 md:py-5"
          onSubmit={onSettings}
        >
          <p
            className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[19px] leading-snug font-medium text-ink-2 md:text-[26px]"
            role="group"
            aria-label="Compress settings"
          >
            <span>Make your image smaller than</span>
            <label className="inline-flex items-center">
              <span className="sr-only">Size limit (KB)</span>
              <Input
                className="num h-11 w-[5.5rem] rounded-sm bg-paper px-2 text-center text-[19px] font-[650] text-ink md:h-12 md:w-24 md:text-2xl"
                ref={kbInput}
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
            <span translate="no">KB, as</span>
            {hydrated ? (
              <Suspense fallback={formatStatic}>
                <FormatSelect
                  value={format}
                  onChange={setFormat}
                  className="h-11 rounded-sm bg-paper text-[19px] font-[650] text-ink md:h-12 md:text-2xl"
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
                className="num rounded-full px-3.5 font-[520]"
                aria-pressed={Number(kb) === c}
                onClick={() => setKb(String(c))}
              >
                {kbLabel(c)}
              </Button>
            ))}
          </div>
          <details
            id="custom"
            className="group/custom scroll-mt-20"
            open={customOpen}
            onToggle={(e) => setCustomOpen(e.currentTarget.open)}
          >
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-ink">
              <ChevronRight
                aria-hidden="true"
                className="size-4 transition-transform group-open/custom:rotate-90"
                strokeWidth={2}
              />
              Width and height{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </summary>
            <fieldset className="flex flex-wrap items-end gap-3 pt-1 pb-1">
              <legend className="sr-only">Width and height</legend>
              <label className="grid gap-1 text-sm text-muted-foreground">
                Width (px)
                <Input
                  className="num w-28"
                  ref={wInput}
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
                  className="num w-28"
                  ref={hInput}
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
              <p className="basis-full text-[13px] text-muted-foreground">
                Set both to crop to that exact size from the centre.
              </p>
            </fieldset>
          </details>
          {file &&
            job.ranWith &&
            JSON.stringify(job.ranWith) !== JSON.stringify(target) && (
              <Button
                type="submit"
                variant="outline"
                className="justify-self-start"
                disabled={phase === "working"}
              >
                Try again with these settings
              </Button>
            )}
        </form>

        {/* The work slot: limits first, then the file, then the result, all in this one place. */}
        <div className="border-t border-line">
          {(phase === "empty" || phase === "error" || reading) && (
            <div className="grid gap-4 p-4 md:p-6">
              <div>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  {reading ? (
                    <span className="st text-ink-2">
                      <StatusGlyph status="work" />
                      Reading your image…
                    </span>
                  ) : (
                    <span className="st text-muted-foreground">
                      <StatusGlyph status="idle" />
                      No image yet
                    </span>
                  )}
                  <span className="num font-semibold">
                    Your limit: {limitText}
                  </span>
                </div>
                <FitsGauge
                  hi={target.maxBytes}
                  state="empty"
                  label={`No image yet. ${ruleWords}`}
                  hiText={`${maxKb} KB limit`}
                />
              </div>

              {phase === "error" && failure && (
                <div
                  role="alert"
                  className="flex gap-3 rounded-lg bg-status-bad-soft p-4"
                >
                  <StatusGlyph
                    status="err"
                    className="mt-0.5 size-6 shrink-0 text-status-bad"
                  />
                  <div className="grid gap-1">
                    <h2 className="t-h3">{failure.title}</h2>
                    <p className="text-[15px] text-ink-2">{failure.message}</p>
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "drop grid justify-items-center gap-2.5 rounded-lg border-[1.5px] border-dashed px-4 py-8 text-center transition-colors md:py-10",
                  job.dragging
                    ? "border-ink bg-sunk"
                    : "border-line-strong bg-paper",
                )}
                {...job.dropHandlers}
              >
                <ImageUp
                  aria-hidden="true"
                  className="size-7 text-ink-2"
                  strokeWidth={1.75}
                />
                <h2 className="t-h3">
                  {job.dragging ? "Drop it to start" : "Add an image"}
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  JPG, PNG or WebP. Drop it here, paste it, or choose one.
                </p>
                {chooseLabel(
                  phase === "error"
                    ? "Choose another image"
                    : "Choose an image",
                  "default",
                  "hidden md:inline-flex",
                )}
                <p className="text-center text-[13px] text-balance text-muted-foreground">
                  <Smartphone
                    aria-hidden="true"
                    className="mr-1.5 inline size-4 align-[-3px] text-accent-ink"
                    strokeWidth={2}
                  />
                  Your image stays on this device. Nothing is uploaded.
                </p>
              </div>
            </div>
          )}

          {(phase === "working" || phase === "done") && original && (
            <div className="grid items-start md:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
              <div className="grid content-start gap-2 p-4 md:p-6">
                <div className="relative grid aspect-[4/3] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center overflow-hidden rounded-lg bg-rail">
                  <img
                    src={result?.url ?? original.url}
                    alt={
                      result
                        ? `Saved image, ${result.width} by ${result.height} pixels`
                        : "Your image before compressing"
                    }
                    className="max-h-full max-w-full object-contain"
                  />
                  <span className="num absolute top-2.5 left-2.5 rounded-xs bg-image-scrim px-2 py-1 text-xs font-semibold text-on-image">
                    {!result
                      ? `Original · ${formatFileSize(original.bytes)}`
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
                      ? `${result.width} × ${result.height} px · ${fig} KB · was ${formatFileSize(original.bytes)}`
                      : `${original.width} × ${original.height} px · ${formatFileSize(original.bytes)}`}
                  </span>
                </p>
                <div className="justify-self-start">
                  {chooseLabel("Choose another image", "outline")}
                </div>
              </div>

              {/* Phone: the result comes first, the preview after it. */}
              <div
                className={cn(
                  "border-line md:min-h-full md:border-l",
                  phase === "done"
                    ? "order-first border-b md:order-none md:border-b-0"
                    : "border-t md:border-t-0",
                )}
              >
                {phase === "working" && (
                  <div className="grid gap-3 p-4 md:p-6">
                    <p className="st text-ink-2">
                      <StatusGlyph status="work" />
                      Making it smaller…
                    </p>
                    <p className="num">
                      <b>Now {formatFileSize(original.bytes)}.</b> {ruleWords}
                    </p>
                    <FitsGauge
                      hi={target.maxBytes}
                      at={original.bytes}
                      state="pending"
                      label={`Now ${formatFileSize(original.bytes)}. ${ruleWords}`}
                      hiText={`${maxKb} KB limit`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <Smartphone
                          aria-hidden="true"
                          className="size-4 text-accent-ink"
                          strokeWidth={2}
                        />
                        Working on this device. No files uploaded.
                      </p>
                      <Button
                        variant="outline"
                        className="hidden md:inline-flex"
                        onClick={job.cancel}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {phase === "done" && result && (
                  <>
                    <ResultBand
                      id={resultId}
                      headingRef={job.resultHeading}
                      result={result}
                      rule={target}
                      originalBytes={original.bytes}
                    />
                    {pass ? (
                      <div className="grid gap-3.5 px-4 pt-3.5 pb-4 md:px-[18px]">
                        <ul className="num grid gap-1.5 text-sm">
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
                            Width and height: {result.width} × {result.height}{" "}
                            px
                          </li>
                        </ul>
                        {/* A real link: Base UI's Button would give it role="button". */}
                        <a
                          className={cn(
                            buttonVariants(),
                            "hidden h-14 w-full justify-start md:flex",
                          )}
                          href={result.url}
                          download={result.filename}
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
                        </a>
                        <div>
                          <p className="mb-0.5 text-xs font-semibold text-muted-foreground">
                            Next
                          </p>
                          <button
                            type="button"
                            onClick={job.reset}
                            className="grid min-h-11 w-full cursor-pointer grid-cols-[1fr_16px] items-center gap-2.5 border-t border-line text-left text-[15px] font-[520] hover:bg-sunk"
                          >
                            Compress another image
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4"
                            />
                          </button>
                          <a
                            href="/#forms"
                            className="grid min-h-11 w-full grid-cols-[1fr_16px] items-center gap-2.5 border-y border-line text-[15px] font-[520] text-ink no-underline hover:bg-sunk"
                          >
                            Use it for a form
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4"
                            />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 p-4 md:px-[18px]">
                        <p>
                          At{" "}
                          <span className="num">
                            {result.width} × {result.height} px
                          </span>
                          , this image can't get below {fig} KB.
                        </p>
                        <div className="grid gap-2 rounded-lg border border-line bg-paper p-3.5">
                          <p className="text-[15px]">
                            <b>Fix:</b> make it fewer pixels wide, then try
                            again.
                          </p>
                          <Button
                            className="hidden w-full md:inline-flex"
                            onClick={smaller}
                          >
                            Make it {halfWidth} px wide and try again
                          </Button>
                        </div>
                        <a
                          className="inline-flex min-h-11 items-center gap-2 text-sm font-[550] underline"
                          href={result.url}
                          download={result.filename}
                        >
                          <Download aria-hidden="true" className="size-4" />
                          Download the {fig} KB file anyway (over your limit)
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phone: one figure and one verb, at the bottom of the screen while the tool is on it. */}
      <ActionBar
        glyph={
          result
            ? pass
              ? "fits"
              : "no"
            : phase === "working"
              ? "work"
              : "idle"
        }
        figure={
          result
            ? `${fig} KB`
            : phase === "working" && original
              ? `Now ${formatFileSize(original.bytes)}`
              : limitText.replace(/^under/, "Under")
        }
        caption={
          result
            ? pass
              ? `Under your ${maxKb} KB limit`
              : `Your limit is ${maxKb} KB`
            : phase === "working"
              ? "Making it smaller…"
              : "Your limit"
        }
        bad={Boolean(result && !pass)}
      >
        {phase === "done" && result && pass ? (
          <a
            className={cn(buttonVariants())}
            href={result.url}
            download={result.filename}
          >
            <Download aria-hidden="true" />
            Download image
          </a>
        ) : phase === "done" && result ? (
          <Button onClick={smaller}>Make it {halfWidth} px wide</Button>
        ) : phase === "working" ? (
          <Button variant="outline" onClick={job.cancel}>
            Cancel
          </Button>
        ) : (
          chooseLabel(
            phase === "error" ? "Choose another image" : "Choose an image",
          )
        )}
      </ActionBar>
    </div>
  );
}
