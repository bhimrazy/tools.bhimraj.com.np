import { DEFAULT_SITE_ORIGIN } from "./origin";

export { DEFAULT_SITE_ORIGIN } from "./origin";

export interface Alternate {
  hreflang: string;
  href: string;
}

/** Validated origin from SITE_ORIGIN (build time), falling back to the default. */
export function siteOrigin(
  value: string | undefined = typeof process === "undefined"
    ? undefined
    : process.env.SITE_ORIGIN,
): URL {
  const raw = value?.trim() || DEFAULT_SITE_ORIGIN;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `SITE_ORIGIN must be an absolute http(s) origin, got "${raw}"`,
    );
  }
  const bare =
    url.pathname === "/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password;
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !bare) {
    throw new Error(
      `SITE_ORIGIN must be an http(s) origin without path, query or hash, got "${raw}"`,
    );
  }
  return url;
}

/** Absolute URL for a site path, e.g. "/np/lok-sewa-photo" -> "https://…/np/lok-sewa-photo". */
export function absoluteUrl(path: string, origin: URL = siteOrigin()): string {
  // Strip leading slashes and backslashes so "//x" or "/\\x" can't switch host.
  const url = new URL(`/${path.replace(/^[\\/]+/, "")}`, origin);
  if (url.origin !== origin.origin)
    throw new Error(`Path leaves site: ${path}`);
  return url.href;
}

/** hreflang alternates for a path; `x-default` is the unprefixed path. */
export function alternates(
  path: string,
  locales: readonly { hreflang: string; prefix: string }[],
  origin: URL = siteOrigin(),
): Alternate[] {
  const rest = path.replace(/^\/+/, "");
  const join = (prefix: string) =>
    absoluteUrl(
      [prefix.replace(/^\/+|\/+$/g, ""), rest].filter(Boolean).join("/"),
      origin,
    );
  return [
    ...locales.map((l) => ({ hreflang: l.hreflang, href: join(l.prefix) })),
    { hreflang: "x-default", href: join("") },
  ];
}
