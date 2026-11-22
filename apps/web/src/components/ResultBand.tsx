import { maxBytesToKb, minBytesToKb, type SizeRule } from "@tools/presets";
import { lazy, type Ref, Suspense } from "react";
import { cn } from "cn";
import { getGaugeState } from "../lib/gauge";
import { formatBytes, formatFigureKb } from "../lib/units";
import { isMotionAllowed, type JobResult } from "../lib/use-compress-job";
import { formatVerdict } from "../lib/verdict";
import { FitsGauge } from "./brand/FitsGauge";
import { StatusGlyph } from "./brand/StatusGlyph";

// Base UI's positioning code loads after the result appears, not with the tool.
const ExactSize = lazy(() => import("./ExactSize"));

/** The result in words, figure and gauge. On the band when it fits, magenta-tinted when not. */
export function ResultBand({
  id,
  headingRef,
  result,
  rule,
  originalBytes,
  small = false,
}: {
  id: string;
  headingRef: Ref<HTMLHeadingElement>;
  result: JobResult;
  rule: SizeRule;
  originalBytes: number;
  /** Kit slots: a smaller figure. */
  small?: boolean;
}) {
  const pass = result.fitsBytes;
  const state = getGaugeState(result.bytes, rule.maxBytes, rule.minBytes);
  const fig = formatFigureKb(result.bytes, pass);
  const maxKb = maxBytesToKb(rule.maxBytes);
  const lo = rule.minBytes;
  const limitText = lo
    ? `${minBytesToKb(lo)}–${maxKb} KB`
    : `under ${maxKb} KB`;
  return (
    <div
      className={cn(
        "grid gap-2.5 animate-in fade-in-0 duration-300",
        small ? "p-4" : "px-[18px] pt-[18px] pb-3.5",
        pass ? "on-band" : "bg-status-bad-soft text-ink",
      )}
    >
      <h2
        id={id}
        ref={headingRef}
        tabIndex={-1}
        className="flex items-start gap-2 text-[15px] leading-snug font-[650]"
      >
        <StatusGlyph
          status={pass ? "fits" : "no"}
          className={cn("size-5 shrink-0", !pass && "text-status-bad")}
        />
        {formatVerdict(result.bytes, rule)}
      </h2>
      <Suspense
        fallback={
          <span className={cn("figure", small && "figure-sm")}>
            <b>{fig}</b>
            <span>KB</span>
          </span>
        }
      >
        <ExactSize
          fig={fig}
          bytes={formatBytes(result.bytes)}
          className={small ? "figure-sm" : undefined}
        />
      </Suspense>
      <FitsGauge
        lo={lo}
        hi={rule.maxBytes}
        at={result.bytes}
        from={isMotionAllowed() ? originalBytes : undefined}
        state={pass ? "fits" : state}
        label={`${fig} KB. Your limit is ${limitText}.`}
        loText={lo ? `${minBytesToKb(lo)} KB` : undefined}
        hiText={`${maxKb} KB limit`}
      />
      <p className={cn("text-xs", pass ? "text-on-band-muted" : "text-ink-2")}>
        {pass
          ? "We checked the saved file, not an estimate."
          : "This is the smallest we could make it at this size."}
      </p>
    </div>
  );
}
