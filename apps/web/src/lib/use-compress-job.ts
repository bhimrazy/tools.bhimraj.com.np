import {
  type CompressResult,
  ImageError,
  type ImageWorker,
} from "@tools/image";
import { KB, type SizeRule } from "@tools/presets";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { clearHandoffUrl, isHandoffUrl, takeHandoff } from "./handoff";
import { markIslandReady, takePendingFile } from "./pending-file";

export interface Original {
  name: string;
  bytes: number;
  width: number;
  height: number;
  url: string;
}

export type JobResult = CompressResult & { url: string; filename: string };
export type Phase = "empty" | "working" | "done" | "error";
export interface Failure {
  title: string;
  message: string;
}

const isHeic = (f: File) =>
  /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
const HEIC_MSG =
  "HEIC photos can't be opened yet. On iPhone, choose Settings › Camera › Formats › Most Compatible, or take a screenshot of the photo and add that.";

/** Plain words for each way a job can fail (`ImageError.code`). */
function toFailure(err: unknown, file: File): Failure {
  const code = err instanceof ImageError ? err.code : "internal";
  switch (code) {
    case "decode_failed":
      return {
        title: "Can't open this file",
        message: isHeic(file)
          ? HEIC_MSG
          : `Can't open ${file.name}. Choose a JPG, PNG or WebP image.`,
      };
    case "too_many_pixels":
      return {
        title: "Too large to open on this device",
        message:
          "Choose a smaller copy of the image, or open this page on a computer.",
      };
    case "timeout":
      return {
        title: "This took too long",
        message:
          "It was stopped so the page stays usable. Try a smaller image.",
      };
    case "unsupported_browser":
      return {
        title: "This browser can't make images",
        message: "Update your browser, or open this page in another one.",
      };
    default:
      return {
        title: "Something went wrong",
        message: "Try again, or choose another image.",
      };
  }
}

function toStem(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 40) || "image";
}

async function readDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight };
}

interface JobOptions {
  /** The file input's id; also the key for a file caught before the code loaded. */
  inputId: string;
  /** The size rule to meet now. */
  target: SizeRule;
  /** On mount: the rule from values typed before hydration or from the URL, if they differ. */
  readMountTarget?: () => SizeRule;
  /** Takes a file handed over from the home page when the URL asks for this slot. */
  acceptsHandoff: () => boolean;
  /** Called with each new result, and null when it is cleared. */
  onResult?: (result: JobResult | null) => void;
}

/** One image job: the file, its preview, the worker run and the result. Shared by every tool UI. */
export function useCompressJob({
  inputId,
  target,
  readMountTarget,
  acceptsHandoff,
  onResult,
}: JobOptions) {
  const [file, setFile] = useState<File | null>(null);
  const [original, setOriginal] = useState<Original | null>(null);
  const [result, setResultState] = useState<JobResult | null>(null);
  const [phase, setPhase] = useState<Phase>("empty");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The rule the current file was last run with, to tell whether settings changed since. */
  const [ranWith, setRanWith] = useState<SizeRule | null>(null);

  const worker = useRef<ImageWorker | null>(null);
  const job = useRef<AbortController | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const report = useRef(onResult);
  report.current = onResult;

  const setResult = (r: JobResult | null) => {
    setResultState(r);
    report.current?.(r);
  };

  useEffect(() => {
    if (!result) return;
    const { url } = result;
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => {
    if (!original) return;
    const { url } = original;
    return () => URL.revokeObjectURL(url);
  }, [original]);

  useEffect(
    () => () => {
      job.current?.abort();
      worker.current?.dispose();
    },
    [],
  );

  // Mounted: take over from the page's loader (src/lib/load-island.ts), and take any file that
  // arrived before the code did, or one handed over from the home page.
  useEffect(() => {
    const island = root.current?.closest("[data-island]");
    markIslandReady(island);
    const opts = readMountTarget?.() ?? target;
    const waiting = takePendingFile(island, inputId);
    if (waiting) void run(waiting, opts);
    else if (isHandoffUrl() && acceptsHandoff()) {
      clearHandoffUrl();
      void takeHandoff().then((f) => f && run(f, opts));
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // With several tools on a page, the paste goes to the one holding focus.
      const tools = document.querySelectorAll("[data-tool-slot]").length;
      if (tools > 1 && !root.current?.contains(document.activeElement)) return;
      const pasted = [...(e.clipboardData?.files ?? [])].find((f) =>
        f.type.startsWith("image/"),
      );
      if (pasted) {
        e.preventDefault();
        void run(pasted);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  async function run(next: File, opts: SizeRule = target) {
    job.current?.abort();
    const ctrl = new AbortController();
    job.current = ctrl;
    setFile(next);
    setRanWith(opts);
    setResult(null);
    setFailure(null);
    setPhase("working");

    try {
      if (!original || file !== next) {
        const url = URL.createObjectURL(next);
        const dims = await readDimensions(url).catch((cause: unknown) => {
          URL.revokeObjectURL(url);
          throw new ImageError("decode_failed", `Can't decode ${next.name}`, {
            cause,
          });
        });
        if (ctrl.signal.aborted) return URL.revokeObjectURL(url);
        setOriginal({ name: next.name, bytes: next.size, url, ...dims });
      }

      if (!worker.current) {
        const { createImageWorker } = await import("@tools/image");
        worker.current = createImageWorker();
      }
      const out = await worker.current.compress(next, opts, ctrl.signal);
      if (ctrl.signal.aborted) return;

      const ext = out.format === "image/webp" ? "webp" : "jpg";
      const filename = `${toStem(next.name)}-${out.width}x${out.height}-${Math.round(out.bytes / KB)}kb.${ext}`;
      setResult({ ...out, url: URL.createObjectURL(out.blob), filename });
      setPhase("done");
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch (err) {
      if (
        ctrl.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      )
        return;
      setFailure(toFailure(err, next));
      setOriginal(null);
      setPhase("error");
    }
  }

  const focusPicker = () =>
    requestAnimationFrame(() => fileInput.current?.focus());

  const cancel = () => {
    job.current?.abort();
    setOriginal(null);
    setFile(null);
    setPhase("empty");
    focusPicker();
  };

  const reset = () => {
    setResult(null);
    setOriginal(null);
    setFile(null);
    setPhase("empty");
    focusPicker();
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (picked) void run(picked);
  };

  const dropHandlers = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer?.files[0];
      if (dropped) void run(dropped);
    },
  };

  return {
    root,
    fileInput,
    resultHeading,
    file,
    ranWith,
    original,
    result,
    phase,
    failure,
    dragging,
    run,
    cancel,
    reset,
    onInput,
    dropHandlers,
  };
}

/** False under `prefers-reduced-motion: reduce`; read only after a result exists (client side). */
export const isMotionAllowed = () =>
  typeof matchMedia === "function" &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;
