import { CSPProvider } from "@base-ui/react/csp-provider";
import { type ComponentType, createElement } from "react";

/** useId prefix shared by the server render (Island.astro) and hydrateRoot (hydrate.ts). */
export const islandPrefix = (name: string) => `${name}-`;

/**
 * The island's tree, identical on server and client. Base UI may not insert <style> elements,
 * which `style-src 'self'` blocks; the one rule it needs is in global.css.
 */
export const islandTree = <P extends object>(
  Component: ComponentType<P>,
  props: P,
) =>
  createElement(
    CSPProvider,
    { disableStyleElements: true },
    createElement(Component, props),
  );
