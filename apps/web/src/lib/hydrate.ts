import type { ComponentType } from "react";
import { hydrateRoot } from "react-dom/client";
import { toIslandTree } from "./island";

/** Hydrates one `<Island>` element with its serialised props and the server's useId prefix. */
export function hydrateIsland<P extends object>(
  el: HTMLElement,
  Component: ComponentType<P>,
) {
  const props = JSON.parse(el.dataset["props"] ?? "{}") as P;
  hydrateRoot(el, toIslandTree(Component, props), {
    identifierPrefix: el.dataset["islandPrefix"] ?? "",
  });
}
