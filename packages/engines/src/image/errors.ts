export type ErrorCode =
  | "decode_failed"
  | "unsupported_browser"
  | "too_large"
  | "aborted"
  | "timeout"
  | "internal";

/** An engine failure the UI can switch on by `code`. Aborts keep the standard `AbortError` name. */
export class EngineError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = code === "aborted" ? "AbortError" : "EngineError";
  }
}

export function errorCode(err: unknown): ErrorCode {
  if (err instanceof EngineError) return err.code;
  if (err instanceof Error && err.name === "AbortError") return "aborted";
  return "internal";
}
