import { describe, expect, test } from "bun:test";
import { errorMessage } from "./errors";

const jpg = new File([], "photo.jpg", { type: "image/jpeg" });
const heic = new File([], "IMG_1.HEIC", { type: "image/heic" });
const engineError = (code: string) =>
  Object.assign(new Error(`engine: ${code}`), { code });

describe("errorMessage", () => {
  test("cancelled jobs show nothing", () => {
    expect(errorMessage(engineError("aborted"), jpg)).toBeNull();
    expect(errorMessage(new DOMException("x", "AbortError"), jpg)).toBeNull();
  });

  test("each engine code gets its own next step", () => {
    const codes = [
      "decode_failed",
      "unsupported_browser",
      "too_large",
      "timeout",
      "internal",
    ];
    const messages = codes.map((c) => errorMessage(engineError(c), jpg));
    expect(new Set(messages).size).toBe(codes.length);
    for (const m of messages) expect(m).not.toContain("engine:");
  });

  test("HEIC files get the iPhone setting hint", () => {
    expect(errorMessage(engineError("decode_failed"), heic)).toContain(
      "Most Compatible",
    );
    expect(
      errorMessage(new DOMException("bad", "EncodingError"), heic),
    ).toContain("Most Compatible");
    expect(errorMessage(engineError("too_large"), heic)).toContain("too large");
  });

  test("unknown errors fall back to their message", () => {
    expect(errorMessage(new Error("Boom"), jpg)).toBe("Boom");
    expect(
      errorMessage(new DOMException("Bad data", "EncodingError"), jpg),
    ).toBe("Bad data");
  });
});
