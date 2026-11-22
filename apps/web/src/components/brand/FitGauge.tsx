import { gaugeScale, type GaugeState } from "../../lib/gauge";

export interface FitGaugeProps {
  /** Lower limit in bytes, if the form has one. */
  lo?: number | undefined;
  /** Upper limit in bytes. */
  hi: number;
  /** The saved file's size in bytes; omitted before a file exists. */
  at?: number | undefined;
  state: GaugeState;
  /** Plain-words summary, e.g. "47.2 KB. Your limit is under 50 KB." */
  label: string;
  loText?: string | undefined;
  hiText: string;
}

/**
 * The "it fits" rail. SVG with percentage attributes, so it renders on the server without
 * a style attribute (CSP). Limit ticks are drawn above the marker so a limit is never hidden.
 */
export function FitGauge({
  lo,
  hi,
  at,
  state,
  label,
  loText,
  hiText,
}: FitGaugeProps) {
  const g = gaugeScale({ lo, hi, at });
  const pct = (n: number) => `${n}%`;
  return (
    <svg
      className="gauge block h-[58px] w-full"
      data-state={state}
      role="img"
      aria-label={label}
    >
      <rect
        className="g-rail"
        x="0"
        y="12.5"
        width="100%"
        height="13"
        rx="6.5"
      />
      <rect
        className="g-band"
        x={pct(g.lo)}
        y="14"
        width={pct(g.hi - g.lo)}
        height="10"
        rx="2"
      />
      {g.offScale && (
        <svg x="100%" y="15" overflow="visible">
          <path className="g-off" d="M-9 0l5 4-5 4z" />
        </svg>
      )}
      {g.at !== undefined && (
        <svg x={pct(g.at)} y="19" overflow="visible">
          {state === "fit" || state === "pending" ? (
            <circle className="g-mark" r="9" />
          ) : (
            <rect
              className="g-mark"
              x="-7"
              y="-7"
              width="14"
              height="14"
              rx="2"
              transform="rotate(45)"
            />
          )}
        </svg>
      )}
      {lo !== undefined && (
        <rect
          className="g-tick"
          x={pct(g.lo)}
          y="5"
          width="2"
          height="28"
          rx="1"
          transform="translate(-1 0)"
        />
      )}
      <rect
        className="g-tick"
        x={pct(g.hi)}
        y="5"
        width="2"
        height="28"
        rx="1"
        transform="translate(-1 0)"
      />
      {lo !== undefined && loText && (
        <text
          x={pct(g.lo)}
          y="52"
          textAnchor={g.lo < 8 ? "start" : "middle"}
          aria-hidden="true"
        >
          {loText}
        </text>
      )}
      <text x={pct(g.hi)} y="52" textAnchor="middle" aria-hidden="true">
        {hiText}
      </text>
    </svg>
  );
}
