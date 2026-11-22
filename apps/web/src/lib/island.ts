import { CSPProvider } from "@base-ui/react/csp-provider";
import { type ComponentType, createElement } from "react";

/** useId prefix for one island, unique per page (a form page holds one tool per upload). */
export const getIslandPrefix = (name: string, key?: string) =>
  key ? `${name}-${key}-` : `${name}-`;

/**
 * The island's tree, identical on server and client. Base UI may not insert <style> elements,
 * which `style-src 'self'` blocks; the one rule it needs is in global.css.
 */
export const toIslandTree = <P extends object>(
  Component: ComponentType<P>,
  props: P,
) =>
  createElement(
    CSPProvider,
    { disableStyleElements: true },
    createElement(Component, props),
  );
