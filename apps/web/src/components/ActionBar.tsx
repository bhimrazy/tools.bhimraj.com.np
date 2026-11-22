import type { ReactNode } from "react";
import { cn } from "cn";
import { type Status, StatusGlyph } from "./brand/StatusGlyph";

/**
 * Phone only: sticks to the bottom of the screen while its tool is in view, then scrolls away
 * with it, so the page still ends above the footer. One figure and one verb.
 */
export function ActionBar({
  glyph,
  figure,
  caption,
  bad = false,
  children,
}: {
  glyph: Status;
  figure: string;
  caption: string;
  bad?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex items-center gap-3 border-t border-line bg-card px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-e2 md:hidden">
      <p className="grid min-w-0 flex-1 leading-tight">
        <b className="st num text-[17px] font-[680] tracking-[-0.01em]">
          <StatusGlyph
            status={glyph}
            className={cn(bad ? "text-status-bad" : "text-ink")}
          />
          {figure}
        </b>
        <span className="truncate text-xs text-muted-foreground">
          {caption}
        </span>
      </p>
      <div className="flex-none [&>*]:max-w-[60vw] [&>*]:whitespace-normal [&>*]:text-center [&>*]:leading-tight">
        {children}
      </div>
    </div>
  );
}
