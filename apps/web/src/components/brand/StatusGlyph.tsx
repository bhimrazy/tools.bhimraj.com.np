import type { SVGProps } from "react";

export type Status = "fits" | "work" | "no" | "err" | "unv" | "idle";

/**
 * Status glyphs built from the mark's ring (24-unit grid). Decorative: always pair one with a word.
 * fits = the mark; work = faint ring, arc and dot (never spins); no = ring opens, dot outside;
 * err = ring with a mark; unv = dashed ring, amber fill; idle = empty ring.
 */
export function StatusGlyph({
  status,
  ...props
}: { status: Status } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {status === "fits" && (
        <>
          <circle cx="12" cy="12" r="8.75" strokeWidth="2.25" />
          <circle
            className="fits-dot"
            cx="15.4"
            cy="12"
            r="2.6"
            stroke="none"
          />
        </>
      )}
      {status === "work" && (
        <>
          <circle cx="12" cy="12" r="8.75" opacity=".3" />
          <path d="M12 3.25a8.75 8.75 0 0 1 0 17.5" />
          <circle
            cx="12"
            cy="20.75"
            r="2.1"
            fill="currentColor"
            stroke="none"
          />
        </>
      )}
      {status === "no" && (
        <>
          <path d="M15.4 3.9A8.75 8.75 0 1 0 20.1 8.6" />
          <circle
            cx="19.6"
            cy="4.4"
            r="2.9"
            fill="currentColor"
            stroke="none"
          />
        </>
      )}
      {status === "err" && (
        <>
          <circle cx="12" cy="12" r="8.75" />
          <path d="M12 7.5v5.5" />
          <circle cx="12" cy="16.4" r=".45" fill="currentColor" />
        </>
      )}
      {status === "unv" && (
        <>
          <circle
            className="unv-fill"
            cx="12"
            cy="12"
            r="8.75"
            strokeDasharray="2.4 2.6"
          />
          <path d="M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.3" />
          <circle cx="12" cy="16.4" r=".45" fill="currentColor" />
        </>
      )}
      {status === "idle" && <circle cx="12" cy="12" r="8.75" />}
    </svg>
  );
}
