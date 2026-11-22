import { FormKit } from "../components/FormKit";
import { hydrateIsland } from "../lib/hydrate";

export const hydrate = (el: HTMLElement) => hydrateIsland(el, FormKit);
