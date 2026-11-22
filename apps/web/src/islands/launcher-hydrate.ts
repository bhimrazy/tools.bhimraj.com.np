import { Launcher } from "../components/Launcher";
import { hydrateIsland } from "../lib/hydrate";

export const hydrate = (el: HTMLElement) => hydrateIsland(el, Launcher);
