import { CompressTool } from "../components/CompressTool";
import { hydrateIsland } from "../lib/hydrate";

export const hydrate = (el: HTMLElement) => hydrateIsland(el, CompressTool);
