export type ImageErrorCode =
  | "decode_failed"
  | "unsupported_browser"
  | "too_many_pixels"
  | "aborted"
  | "timeout"
  | "internal";

/** An image failure the UI can switch on by `code`. Aborts keep the standard `AbortError` name. */
export class ImageError extends Error {
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = code === "aborted" ? "AbortError" : "ImageError";
  }
}

export function toErrorCode(err: unknown): ImageErrorCode {
  if (err instanceof ImageError) return err.code;
  if (err instanceof Error && err.name === "AbortError") return "aborted";
  return "internal";
}
