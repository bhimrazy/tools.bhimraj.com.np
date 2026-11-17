// User-facing copy for failed compress jobs.

export const isHeic = (f: File) =>
  /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
export const HEIC_MSG =
  "HEIC photos aren't supported yet. On iPhone, choose Settings › Camera › Formats › Most Compatible, or upload a screenshot of the photo.";

// Copy for engine failures, keyed by EngineError.code: what happened, then what to do next.
export const ENGINE_ERRORS: Record<string, string> = {
  decode_failed:
    "This file couldn't be read as an image. Try a JPG or PNG (HEIC support is coming).",
  unsupported_browser:
    "This browser can't process images on your device. Update it, or use a recent Chrome, Edge, Firefox or Safari.",
  too_large:
    "This image is too large to process on this device. Try a smaller photo, or a screenshot of it.",
  timeout:
    "Processing took too long on this device. Close other tabs or apps and try again, or use a smaller image.",
  internal:
    "Something went wrong while processing. Try again, and if it keeps happening, try a different image.",
};

/** User-facing message for a failed job, or null when it was cancelled. */
export function errorMessage(err: unknown, file: File): string | null {
  // Duck-typed so this compiles before EngineError is exported from @tools/engines/image.
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : undefined;
  if (
    code === "aborted" ||
    (err instanceof DOMException && err.name === "AbortError")
  )
    return null;
  // DOMException also has a numeric `code`, so only the engine's string codes match here.
  const known = code === undefined ? undefined : ENGINE_ERRORS[code];
  if (isHeic(file) && (!known || code === "decode_failed")) return HEIC_MSG;
  if (known) return known;
  const msg = err instanceof Error ? err.message : String(err);
  return msg || ENGINE_ERRORS["internal"]!;
}
