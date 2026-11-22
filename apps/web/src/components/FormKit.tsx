import {
  maxBytesToKb,
  minBytesToKb,
  type SizeRule,
  type UploadKind,
} from "@tools/presets";
import Check from "lucide-react/icons/check";
import Circle from "lucide-react/icons/circle";
import Download from "lucide-react/icons/download";
import ScanLine from "lucide-react/icons/scan-line";
import Signature from "lucide-react/icons/signature";
import SquareUser from "lucide-react/icons/square-user";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { recordRecentForm } from "../lib/recent-forms";
import { formatFigureKb, formatFileSize } from "../lib/units";
import { type JobResult, useCompressJob } from "../lib/use-compress-job";
import { formatVerdict } from "../lib/verdict";
import { toZip } from "../lib/zip";
import { ActionBar } from "./ActionBar";
import { FitsGauge } from "./brand/FitsGauge";
import { SilhouetteFrame } from "./brand/Silhouette";
import { StatusGlyph } from "./brand/StatusGlyph";
import { ResultBand } from "./ResultBand";

export interface KitUpload {
  /** Slug; the slot's section id. */
  upload: string;
  kind: UploadKind;
  /** "Photo", "Signature" */
  label: string;
  rule: SizeRule;
  /** e.g. "300 × 350 px · 10–200 KB · JPG · white background" */
  ruleText: string;
  verified: boolean;
}

export interface FormKitProps {
  /** Form slug; makes the island's id prefix unique. */
  id: string;
  path: string;
  formTitle: string;
  uploads: KitUpload[];
  reportUrl: string;
  /** Where unchecked figures came from, in a few words. */
  sourceLabel: string | null;
}

const KIND_ICON = { photo: SquareUser, signature: Signature, scan: ScanLine };
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** A form's kit: one slot per upload, side by side on desktop, and one summary with Download all. */
export function FormKit({
  path,
  formTitle,
  uploads,
  reportUrl,
  sourceLabel,
}: FormKitProps) {
  const [results, setResults] = useState<Record<string, JobResult | null>>({});
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const ready = uploads.filter((u) => results[u.upload]?.fitsBytes);
  const next = uploads.find((u) => !results[u.upload]?.fitsBytes);
  const unverified = uploads.some((u) => !u.verified);
  const many = uploads.length > 1;
  const zipName = `${path.split("/").pop()}.zip`;

  const onResult = (upload: string) => (r: JobResult | null) => {
    setResults((prev) => ({ ...prev, [upload]: r }));
    if (r?.fitsBytes) recordRecentForm(path, formTitle);
  };

  // Download all: one .zip of the ready files, rebuilt whenever one changes.
  useEffect(() => {
    if (!many || !ready.length) return setZipUrl(null);
    let url: string | null = null;
    let live = true;
    void Promise.all(
      ready.map(async (u) => {
        const r = results[u.upload]!;
        return {
          name: r.filename,
          bytes: new Uint8Array(await r.blob.arrayBuffer()),
        };
      }),
    ).then((entries) => {
      if (!live) return;
      url = URL.createObjectURL(toZip(entries));
      setZipUrl(url);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [results]);

  const downloadAll = zipUrl && (
    <a
      className={cn(buttonVariants(), "h-auto min-h-14 justify-start py-2")}
      href={zipUrl}
      download={zipName}
    >
      <Download aria-hidden="true" />
      <span className="grid text-left leading-tight">
        {ready.length === uploads.length
          ? "Download all"
          : `Download ${ready.length} of ${uploads.length} files`}
        <small className="text-xs font-medium opacity-85">as one .zip</small>
      </span>
    </a>
  );

  return (
    <div className="grid gap-4 md:gap-5">
      <div
        className={cn(
          "grid items-start gap-3 md:gap-4",
          uploads.length === 2 && "md:grid-cols-2",
          uploads.length >= 3 && "md:grid-cols-2 lg:grid-cols-3",
          !many && "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]",
        )}
      >
        {uploads.map((u) => (
          <KitSlot
            key={u.upload}
            slot={u}
            single={!many}
            onResult={onResult(u.upload)}
          />
        ))}
        {!many && (
          <KitSummary
            uploads={uploads}
            results={results}
            unverified={unverified}
            reportUrl={reportUrl}
            sourceLabel={sourceLabel}
          />
        )}
      </div>
      {many && (
        <KitSummary
          uploads={uploads}
          results={results}
          unverified={unverified}
          reportUrl={reportUrl}
          sourceLabel={sourceLabel}
          download={downloadAll}
        />
      )}

      <ActionBar
        glyph={next ? (ready.length ? "work" : "idle") : "fits"}
        figure={`${ready.length} of ${uploads.length} ready`}
        caption={
          next ? `Next: ${lower(next.label)}` : "Every file meets its size rule"
        }
      >
        {next ? (
          <label
            htmlFor={`${next.upload}-file`}
            className={cn(buttonVariants(), "cursor-pointer")}
          >
            Add {lower(next.label)}
          </label>
        ) : many && downloadAll ? (
          <a className={cn(buttonVariants())} href={zipUrl!} download={zipName}>
            <Download aria-hidden="true" />
            Download all
          </a>
        ) : (
          <a className={cn(buttonVariants())} href={`#${uploads[0]!.upload}`}>
            Go to download
          </a>
        )}
      </ActionBar>
    </div>
  );
}

function KitSlot({
  slot,
  single,
  onResult,
}: {
  slot: KitUpload;
  single: boolean;
  onResult: (r: JobResult | null) => void;
}) {
  const { upload, kind, label, rule, ruleText, verified } = slot;
  const inputId = `${upload}-file`;
  const job = useCompressJob({
    inputId,
    target: rule,
    acceptsHandoff: () => single || location.hash === `#${upload}`,
    onResult,
  });
  const { phase, original, result, failure } = job;
  const Icon = KIND_ICON[kind];
  const noun = lower(label);
  const aNoun = `a ${noun}`;
  const pass = result?.fitsBytes ?? false;
  const reading = phase === "working" && !original;
  const lo = rule.minBytes;
  const maxKb = maxBytesToKb(rule.maxBytes);
  const limitText = lo
    ? `${minBytesToKb(lo)}–${maxKb} KB`
    : `under ${maxKb} KB`;
  const fig = result ? formatFigureKb(result.bytes, pass) : "";
  const status = result
    ? pass
      ? { glyph: "fits" as const, word: "Ready" }
      : { glyph: "no" as const, word: "Doesn't fit" }
    : phase === "working"
      ? { glyph: "work" as const, word: "Working" }
      : phase === "error"
        ? { glyph: "err" as const, word: "Can't open" }
        : { glyph: "idle" as const, word: "Not added" };

  const choose = (text: string, variant: "default" | "outline" | "link") => (
    <label
      htmlFor={inputId}
      className={cn(
        buttonVariants({ variant }),
        "cursor-pointer group-has-[input[type=file]:focus-visible]/slot:outline-2 group-has-[input[type=file]:focus-visible]/slot:outline-offset-2 group-has-[input[type=file]:focus-visible]/slot:outline-ring",
        variant === "link" && "min-h-11",
      )}
    >
      {text}
    </label>
  );

  return (
    <section
      id={upload}
      aria-labelledby={`${upload}-heading`}
      ref={job.root}
      data-tool-slot
      className="group/slot flex scroll-mt-20 flex-col overflow-hidden rounded-xl border border-line bg-card transition-colors hover:border-line-strong/50"
    >
      <input
        ref={job.fileInput}
        id={inputId}
        name={`${upload}-file`}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={job.onInput}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {reading
          ? `Reading your ${noun}…`
          : phase === "working"
            ? `Making your ${noun} on this device…`
            : result
              ? `${label}: ${formatVerdict(result.bytes, rule)}`
              : ""}
      </p>
      <header
        className={cn(
          "flex items-center gap-2 border-b px-4 py-3 transition-colors duration-150 ease-[var(--ease-state)]",
          pass ? "on-band border-transparent" : "border-line",
        )}
      >
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
        <h2
          id={`${upload}-heading`}
          className="min-w-0 flex-1 text-base font-[650] tracking-[-0.01em]"
        >
          {label}
        </h2>
        <span
          className={cn(
            "st",
            !pass && !result && "text-muted-foreground",
            result && !pass && "text-status-bad",
          )}
        >
          <StatusGlyph status={status.glyph} />
          {status.word}
        </span>
      </header>

      <div
        className={cn(
          "relative grid h-[168px] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center border-b border-line p-4 transition-colors md:h-[212px]",
          job.dragging ? "bg-sunk" : "bg-paper",
        )}
        {...job.dropHandlers}
      >
        {original ? (
          <>
            <img
              src={result?.url ?? original.url}
              alt={
                result
                  ? `Saved ${noun}, ${result.width} by ${result.height} pixels`
                  : `Your ${noun} before it is made smaller`
              }
              className="h-full w-full object-contain"
            />
            {phase === "working" && (
              <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-xs bg-image-scrim px-2.5 py-1.5 text-[13px] font-[550] text-on-image">
                Working on this device
              </span>
            )}
          </>
        ) : rule.width && rule.height ? (
          <SilhouetteFrame
            width={rule.width}
            height={rule.height}
            className="h-full w-full"
          />
        ) : null}
      </div>

      {phase === "done" && result && original ? (
        <ResultBand
          id={`${upload}-result-heading`}
          headingRef={job.resultHeading}
          result={result}
          rule={rule}
          originalBytes={original.bytes}
          small
        />
      ) : null}

      <div className="grid flex-1 content-start gap-3 p-4">
        {phase !== "done" && (
          <FitsGauge
            lo={lo}
            hi={rule.maxBytes}
            at={phase === "working" && original ? original.bytes : undefined}
            state={phase === "working" && original ? "pending" : "empty"}
            label={
              phase === "working" && original
                ? `Now ${formatFileSize(original.bytes)}. Your limit is ${limitText}.`
                : `No ${noun} yet. Your limit is ${limitText}.`
            }
            loText={lo ? `${minBytesToKb(lo)} KB` : undefined}
            hiText={`${maxKb} KB`}
          />
        )}
        <p className="num text-[13px] text-ink-2" translate="no">
          {ruleText}
        </p>
        {!verified && (
          <p className="flex items-start gap-2 text-[13px] text-ink-2">
            <StatusGlyph
              status="unv"
              className="mt-px size-4 shrink-0 text-status-warn"
            />
            Rule not checked yet. Check your notice.
          </p>
        )}

        {phase === "error" && failure && (
          <div
            role="alert"
            className="flex gap-2.5 rounded-lg bg-status-bad-soft p-3"
          >
            <StatusGlyph
              status="err"
              className="mt-0.5 size-5 shrink-0 text-status-bad"
            />
            <div className="grid gap-0.5">
              <h3 className="text-[15px] font-[650]">{failure.title}</h3>
              <p className="text-sm text-ink-2">{failure.message}</p>
            </div>
          </div>
        )}

        {result && !pass && (
          <p className="text-sm text-ink-2">
            Fix: crop your {noun} closer, or save it smaller, then add it again.
          </p>
        )}

        {phase === "working" ? (
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={job.cancel}
          >
            Cancel
          </Button>
        ) : result ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <a
              className={cn(
                pass
                  ? buttonVariants()
                  : "inline-flex min-h-11 items-center gap-2 text-sm font-[550] underline",
              )}
              href={result.url}
              download={result.filename}
            >
              <Download
                aria-hidden="true"
                className={pass ? undefined : "size-4"}
              />
              {pass ? `Download ${noun}` : `Download the ${fig} KB file anyway`}
            </a>
            {choose(`Choose another ${noun}`, "link")}
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="hidden md:block">
              {choose(
                phase === "error"
                  ? `Choose another ${noun}`
                  : `Choose ${aNoun}`,
                "default",
              )}
            </div>
            <div className="md:hidden">
              {choose(
                phase === "error"
                  ? `Choose another ${noun}`
                  : `Choose ${aNoun}`,
                "outline",
              )}
            </div>
            <p className="text-[13px] text-muted-foreground">
              Or drop it on the shape above, or paste it.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function KitSummary({
  uploads,
  results,
  unverified,
  reportUrl,
  sourceLabel,
  download,
}: {
  uploads: KitUpload[];
  results: Record<string, JobResult | null>;
  unverified: boolean;
  reportUrl: string;
  sourceLabel: string | null;
  download?: React.ReactNode;
}) {
  const readyCount = uploads.filter((u) => results[u.upload]?.fitsBytes).length;
  return (
    <section
      aria-labelledby="kit-summary-heading"
      className={cn(
        "grid gap-5 rounded-xl border border-line bg-card p-4 md:p-5",
        download !== undefined &&
          "md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)] md:gap-6",
      )}
    >
      <div className="grid content-start gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="kit-summary-heading" className="t-h3">
            Before you submit the form
          </h2>
          <span className="flex gap-1" aria-hidden="true">
            {uploads.map((u) => (
              <i
                key={u.upload}
                className={cn(
                  "h-2 w-[18px] rounded-[2px] transition-colors duration-150",
                  results[u.upload]?.fitsBytes
                    ? "bg-ink"
                    : "bg-line shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                )}
              />
            ))}
          </span>
        </div>
        <p className="num text-[13px] font-semibold text-ink-2">
          {readyCount} of {uploads.length}{" "}
          {uploads.length === 1 ? "file" : "files"} ready
        </p>
        <ul className="grid gap-1.5 text-sm">
          {uploads.map((u) => {
            const ok = results[u.upload]?.fitsBytes;
            return (
              <li key={u.upload} className="flex items-start gap-2">
                {ok ? (
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-status-ok"
                    strokeWidth={2.25}
                  />
                ) : (
                  <Circle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    strokeWidth={2}
                  />
                )}
                <span className={ok ? "" : "text-ink-2"}>
                  {u.label} {ok ? "meets the size rule" : "is not added yet"}
                </span>
              </li>
            );
          })}
          <li className="flex items-start gap-2 text-ink-2">
            <Circle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            Check the rule in your notice
          </li>
        </ul>
      </div>
      {unverified && (
        <div className="flex items-start gap-2.5 self-start rounded-lg bg-sunk px-3.5 py-3 text-sm">
          <StatusGlyph
            status="unv"
            className="mt-px size-5 shrink-0 text-status-warn"
          />
          <p>
            <b>Not checked yet.</b> Meets the size rule we have. These figures
            come from{" "}
            {sourceLabel ? lower(sourceLabel) : "no source we could confirm"},
            and we have not checked them against an official notice. Check your
            notice before you submit.{" "}
            <a
              href={reportUrl}
              rel="noopener noreferrer external"
              className="font-[550]"
            >
              Report a different rule
            </a>
          </p>
        </div>
      )}
      {download !== undefined && (
        <div className="grid content-start gap-2">
          {download ?? (
            <p className="rounded-lg border border-dashed border-line-strong p-3.5 text-sm text-ink-2">
              Download all appears here when a file is ready.
            </p>
          )}
          <p className="text-[13px] text-muted-foreground">
            Or download each file from its own slot.
          </p>
        </div>
      )}
    </section>
  );
}
