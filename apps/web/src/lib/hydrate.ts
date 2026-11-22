import type { ComponentType } from "react";
import { hydrateRoot } from "react-dom/client";
import { islandPrefix, islandTree } from "./island";

/** Hydrates every `<Island name={name}>` on the page with its serialised props. */
export function hydrateIslands<P extends object>(
  name: string,
  Component: ComponentType<P>,
) {
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-island="${name}"]`,
  )) {
    const props = JSON.parse(el.dataset["props"] ?? "{}") as P;
    hydrateRoot(el, islandTree(Component, props), {
      identifierPrefix: islandPrefix(name),
    });
  }
}
