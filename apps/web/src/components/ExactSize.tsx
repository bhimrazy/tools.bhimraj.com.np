import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** The result figure; hover or focus shows the exact byte count. */
export default function ExactSize({
  fig,
  bytes,
}: {
  fig: string;
  bytes: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<span tabIndex={0} />}
          className="figure w-fit rounded-xs"
          aria-label={`${fig} KB, exactly ${bytes}`}
        >
          <b>{fig}</b>
          <span>KB</span>
        </TooltipTrigger>
        <TooltipContent>{bytes}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
