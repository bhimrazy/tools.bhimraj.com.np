import { h, hydrate } from "preact";
import {
  CompressTool,
  type CompressToolProps,
} from "../components/CompressTool";

for (const el of document.querySelectorAll<HTMLElement>(
  "[data-compress-tool]",
)) {
  const props = JSON.parse(el.dataset["props"] ?? "{}") as CompressToolProps;
  hydrate(h(CompressTool, props), el);
}
