import { kbToMaxBytes } from "@tools/presets";
import Camera from "lucide-react/icons/camera";
import ChevronRight from "lucide-react/icons/chevron-right";
import ImageUp from "lucide-react/icons/image-up";
import Plus from "lucide-react/icons/plus";
import Search from "lucide-react/icons/search";
import Shrink from "lucide-react/icons/shrink";
import Smartphone from "lucide-react/icons/smartphone";
import X from "lucide-react/icons/x";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { HANDOFF_PARAM, saveHandoff } from "../lib/handoff";
import { markIslandReady, takePendingFile } from "../lib/pending-file";
import {
  parseQuery,
  type SearchEntry,
  searchEntries,
  toCustomRuleHref,
} from "../lib/search";
import { formatFileSize } from "../lib/units";
import { FitsGauge } from "./brand/FitsGauge";
import { Silhouette } from "./brand/Silhouette";
import { StatusGlyph } from "./brand/StatusGlyph";

/** Where a dropped file can go: one form upload. */
export interface DropRoute {
  title: string;
  href: string;
  /** "300 × 350 px · 10–200 KB · Not checked" */
  detail: string;
  kind: "photo" | "signature" | "scan";
  width?: number;
  height?: number;
  minBytes?: number;
  maxBytes: number;
  minKb?: number;
  maxKb: number;
  /** "10–200 KB" or "under 100 KB" */
  limitText: string;
}

export interface LauncherProps {
  entries: SearchEntry[];
  routes: DropRoute[];
  /** Example searches under the field, all over real presets. */
  tries: { label: string; query: string; local?: SearchEntry["local"] }[];
}

const DEFAULT_KB = 100;
const DROP_ID = "drop-file";
const CAMERA_ID = "drop-camera";

interface Dropped {
  file: File;
  width: number;
  height: number;
}

async function readImage(file: File): Promise<Dropped | null> {
  if (!file.type.startsWith("image/") || /hei[cf]/i.test(file.type))
    return null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { file, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const withHandoff = (href: string) => {
  const [path, hash] = href.split("#");
  const url = new URL(path!, location.origin);
  url.searchParams.set(HANDOFF_PARAM, "1");
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
};

/** Home: search first, then a file dropped on the band is routed to the tool that can use it. */
export function Launcher({ entries, routes, tries }: LauncherProps) {
  const [query, setQuery] = useState("");
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const routeHeading = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const q = parseQuery(query);
  const found = searchEntries(entries, q);
  const forms = found.filter((e) => e.type === "form");
  const tools = found.filter((e) => e.type === "tool");
  const customHref = toCustomRuleHref(q);
  const open = query.trim().length > 0;
  const limitKb = q.maxKb ?? DEFAULT_KB;

  useEffect(() => {
    const island = root.current?.closest("[data-island]");
    markIslandReady(island);
    // Text typed, or a file picked, before this code arrived.
    const params = new URLSearchParams(location.search);
    const typed = input.current?.value || params.get("q") || "";
    if (typed) setQuery(typed);
    const waiting =
      takePendingFile(island, DROP_ID) ?? takePendingFile(island, CAMERA_ID);
    if (waiting) void take(waiting);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (document.activeElement === input.current) return;
      const f = [...(e.clipboardData?.files ?? [])][0];
      if (f) {
        e.preventDefault();
        void take(f);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  async function take(file: File) {
    setUnreadable(null);
    const img = await readImage(file);
    if (!img) {
      setDropped(null);
      setUnreadable(file.name);
      return;
    }
    setDropped(img);
    requestAnimationFrame(() => routeHeading.current?.focus());
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (f) void take(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files[0];
    if (f) void take(f);
  };

  /** Keeps the file on this device for the next page, then opens it. */
  const go = async (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!dropped) return;
    e.preventDefault();
    const kept = await saveHandoff(dropped.file);
    location.assign(kept ? withHandoff(href) : href);
  };

  // Arrow keys move between the field and the results; Escape clears.
  const onKey = (e: KeyboardEvent) => {
    const links = [
      ...(results.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ??
        []),
    ];
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown" && links.length) {
      e.preventDefault();
      links[Math.min(at + 1, links.length - 1)]?.focus();
    } else if (e.key === "ArrowUp" && at >= 0) {
      e.preventDefault();
      (at === 0 ? input.current : links[at - 1])?.focus();
    } else if (e.key === "Escape") {
      setQuery("");
      input.current?.focus();
    }
  };

  const onTry = (e: MouseEvent<HTMLAnchorElement>, value: string) => {
    e.preventDefault();
    setQuery(value);
    input.current?.focus();
  };

  // Routes for a dropped file: a wide image is likely a signature, others a photo. Forms
  // found by the search come first.
  const wide = dropped ? dropped.width / dropped.height >= 2 : false;
  const foundHrefs = new Set(forms.map((f) => f.href));
  const ranked = [...routes].sort(
    (a, b) =>
      Number(foundHrefs.has(b.href)) - Number(foundHrefs.has(a.href)) ||
      Number((b.kind === "signature") === wide) -
        Number((a.kind === "signature") === wide),
  );
  const top = ranked[0];
  const compressHref = `/compress-image?kb=${limitKb}`;

  return (
    <div
      ref={root}
      className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start md:gap-10"
    >
      <div>
        <h1 className="t-hero">
          Make your photo or signature the right size for any form.
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] text-ink-2 md:text-[18px]">
          Free. Works in your browser. Your files never leave your phone or
          computer.
        </p>

        <form
          role="search"
          className="mt-5 md:mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            results.current
              ?.querySelector<HTMLAnchorElement>("a[href]")
              ?.click();
          }}
          onKeyDown={onKey}
        >
          <label htmlFor="search" className="sr-only">
            Search forms and tools
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-2"
              strokeWidth={2}
            />
            <input
              ref={input}
              id="search"
              type="search"
              name="q"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="search-help"
              aria-controls="search-results"
              placeholder="Form name, or a size like 300x350 50kb"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              className="h-14 w-full scroll-mt-24 rounded-xl border border-line-strong bg-card pr-4 pl-12 text-[17px] text-ink shadow-e1 transition-colors outline-none placeholder:text-muted-foreground hover:border-ink focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-[60px] md:text-lg [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <p id="search-help" className="sr-only">
            Searches stay on this device. Use the down arrow to move to the
            results.
          </p>

          <div
            ref={results}
            id="search-results"
            aria-live="polite"
            className={cn(
              open &&
                "mt-2 overflow-hidden rounded-xl border border-line bg-card shadow-e2 animate-in fade-in-0 slide-in-from-top-1 duration-150",
            )}
          >
            {open && (
              <>
                {(q.width || q.maxKb) && (
                  <p className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5 text-[13px] text-muted-foreground">
                    We read this as:
                    {q.width && q.height && (
                      <span className="num inline-flex min-h-7 items-center rounded-full bg-accent-soft px-2.5 font-semibold text-ink">
                        {q.width} × {q.height} {q.unit}
                      </span>
                    )}
                    {q.maxKb && (
                      <span className="num inline-flex min-h-7 items-center rounded-full bg-accent-soft px-2.5 font-semibold text-ink">
                        under {q.maxKb} KB
                      </span>
                    )}
                  </p>
                )}
                {forms.length > 0 && (
                  <>
                    <p className="px-4 pt-2.5 pb-1 text-xs font-semibold text-muted-foreground">
                      Forms that match
                    </p>
                    <ul>
                      {forms.map((f) => (
                        <li key={f.href}>
                          <a
                            href={f.href}
                            className="grid min-h-14 grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-3 px-4 py-2 text-ink no-underline hover:bg-sunk focus-visible:bg-sunk focus-visible:outline-offset-[-2px]"
                          >
                            <Silhouette
                              width={f.width ?? 1}
                              height={f.height ?? f.width ?? 1}
                            />
                            <span className="grid min-w-0">
                              <span className="text-[15px] leading-snug font-semibold">
                                {f.title}
                                {f.local && (
                                  <span
                                    lang={f.local.lang}
                                    className={cn(
                                      "ml-1.5 text-sm font-normal text-muted-foreground",
                                      f.local.script,
                                    )}
                                  >
                                    {f.local.text}
                                  </span>
                                )}
                              </span>
                              <span className="num text-[13px] text-muted-foreground">
                                {f.detail}
                              </span>
                            </span>
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4 text-muted-foreground"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {tools.map((t) => (
                  <a
                    key={t.href}
                    href={t.href}
                    className="grid min-h-14 grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-3 border-t border-line px-4 py-2 text-ink no-underline first:border-t-0 hover:bg-sunk focus-visible:bg-sunk focus-visible:outline-offset-[-2px]"
                  >
                    <Shrink
                      aria-hidden="true"
                      className="mx-auto size-5 text-ink-2"
                      strokeWidth={1.75}
                    />
                    <span className="grid">
                      <span className="text-[15px] font-semibold">
                        {t.title}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {t.detail}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </a>
                ))}
                {customHref && (
                  <a
                    href={customHref}
                    className="grid min-h-14 grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-3 border-t border-line px-4 py-2.5 text-ink no-underline hover:bg-sunk focus-visible:bg-sunk focus-visible:outline-offset-[-2px]"
                  >
                    <span className="grid size-10 place-items-center rounded-lg bg-sunk">
                      <Plus
                        aria-hidden="true"
                        className="size-5"
                        strokeWidth={1.75}
                      />
                    </span>
                    <span className="grid">
                      <span className="num text-[15px] font-semibold">
                        Make an image
                        {q.unit === "px" && q.width && q.height
                          ? ` ${q.width} × ${q.height} px`
                          : ""}
                        {q.maxKb ? ` under ${q.maxKb} KB` : ""}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {q.unit === "mm"
                          ? "Sizes in mm can't be used as they are. Enter the pixel size from your notice in the tool."
                          : "Opens the tool with this size rule. You can share the link."}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </a>
                )}
                {!found.length && !customHref && (
                  <p className="px-4 py-3.5 text-sm text-ink-2">
                    No match for “{query.trim()}”. Try fewer words, or{" "}
                    <a href="/compress-image#custom">
                      enter your own size rule
                    </a>
                    .
                  </p>
                )}
                <p className="border-t border-line bg-paper px-4 py-2 text-xs text-muted-foreground">
                  Searches stay on this device.
                </p>
              </>
            )}
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[13px] text-muted-foreground">Try</span>
          {tries.map((t) => (
            <a
              key={t.query}
              href={`/?q=${encodeURIComponent(t.query)}#search`}
              onClick={(e) => onTry(e, t.query)}
              className="num inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong bg-card px-3.5 text-sm font-[520] text-ink no-underline transition-colors hover:border-ink hover:bg-sunk sm:min-h-9"
            >
              {t.label}
              {t.local && (
                <span
                  lang={t.local.lang}
                  className={cn("text-ink-2", t.local.script)}
                >
                  {t.local.text}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>

      {/* The band: the page's one brand moment. A file dropped here is routed by what it is. */}
      <section
        aria-labelledby="drop-h"
        className={cn(
          "group/drop on-band grid gap-4 rounded-xl p-5 transition-shadow md:mt-1.5 md:p-7",
          dragging && "shadow-[inset_0_0_0_2px_var(--color-on-band)]",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-tool-slot
      >
        <input
          id={DROP_ID}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onPick}
        />
        <input
          id={CAMERA_ID}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onPick}
        />
        {!dropped ? (
          <div className="grid justify-items-start gap-3">
            <ImageUp aria-hidden="true" className="size-6" strokeWidth={1.75} />
            <div>
              <h2 id="drop-h" className="t-h3">
                {dragging
                  ? "Drop it to see what fits"
                  : "Add a photo or signature"}
              </h2>
              <p className="mt-1 text-sm text-on-band-muted">
                Drop it here, paste it, or choose a file. We'll show the tools
                that can use it.
              </p>
            </div>
            {unreadable && (
              <p role="alert" className="flex items-start gap-2 text-sm">
                <StatusGlyph
                  status="err"
                  className="mt-px size-5 shrink-0 text-status-bad-bright"
                />
                <span>
                  Can't open{" "}
                  <b translate="no" className="[overflow-wrap:anywhere]">
                    {unreadable}
                  </b>
                  . Choose a JPG, PNG or WebP image.
                </span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <label
                htmlFor={DROP_ID}
                className={cn(
                  buttonVariants({ variant: "inverse" }),
                  "cursor-pointer group-has-[#drop-file:focus-visible]/drop:outline-2 group-has-[#drop-file:focus-visible]/drop:outline-offset-2 group-has-[#drop-file:focus-visible]/drop:outline-on-band",
                )}
              >
                Choose a file
              </label>
              <label
                htmlFor={CAMERA_ID}
                className={cn(
                  buttonVariants({ variant: "outline-band" }),
                  "cursor-pointer group-has-[#drop-camera:focus-visible]/drop:outline-2 group-has-[#drop-camera:focus-visible]/drop:outline-offset-2 group-has-[#drop-camera:focus-visible]/drop:outline-on-band md:hidden",
                )}
              >
                <Camera aria-hidden="true" />
                Take a photo
              </label>
            </div>
            <p className="flex items-center gap-1.5 text-[13px] text-on-band-muted">
              <Smartphone
                aria-hidden="true"
                className="size-4 text-on-band"
                strokeWidth={2}
              />
              Your file stays on this device.
            </p>
            <div className="mt-1 w-full border-t border-on-band/20 pt-4">
              <p className="num text-[13px] text-on-band-muted">
                Size limit{q.maxKb ? " from your search" : ""}:{" "}
                <b className="text-on-band">under {limitKb} KB</b>
              </p>
              <FitsGauge
                hi={kbToMaxBytes(limitKb)}
                state="empty"
                label={`Size limit: under ${limitKb} KB.`}
                hiText={`${limitKb} KB limit`}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center gap-3 rounded-lg p-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-on-band)_25%,transparent)]">
              <span className="sil-band">
                <Silhouette width={dropped.width} height={dropped.height} />
              </span>
              <p className="grid min-w-0 flex-1">
                <b className="truncate text-[15px]" translate="no">
                  {dropped.file.name}
                </b>
                <small className="num text-[13px] text-on-band-muted">
                  {formatFileSize(dropped.file.size)} · {dropped.width} ×{" "}
                  {dropped.height} px
                </small>
              </p>
              <button
                type="button"
                onClick={() => setDropped(null)}
                className="grid size-11 cursor-pointer place-items-center rounded-full text-on-band hover:bg-on-band/10"
                aria-label="Remove this file"
              >
                <X aria-hidden="true" className="size-5" strokeWidth={2} />
              </button>
            </div>
            <h2 id="drop-h" ref={routeHeading} tabIndex={-1} className="t-h3">
              What do you want to do with this file?
            </h2>
            {top && (
              <div className="border-t border-on-band/20 pt-3">
                <p className="num text-[13px] text-on-band-muted">
                  {top.title}: <b className="text-on-band">{top.limitText}</b>.
                  This file is {formatFileSize(dropped.file.size)} now.
                </p>
                <FitsGauge
                  lo={top.minBytes}
                  hi={top.maxBytes}
                  at={dropped.file.size}
                  state="pending"
                  label={`${top.title}: ${top.limitText}. This file is ${formatFileSize(dropped.file.size)} now.`}
                  loText={top.minKb ? `${top.minKb} KB` : undefined}
                  hiText={`${top.maxKb} KB`}
                />
              </div>
            )}
            <ul className="border-t border-on-band/20">
              {ranked.map((r) => (
                <li key={r.href}>
                  <a
                    href={r.href}
                    onClick={(e) => void go(e, r.href)}
                    className="grid min-h-14 grid-cols-[minmax(0,1fr)_16px] items-center gap-3 border-b border-on-band/20 py-2.5 text-on-band no-underline hover:bg-on-band/5"
                  >
                    <span className="grid">
                      <span className="text-[15px] font-semibold">
                        Make a {r.title}
                      </span>
                      <span className="num text-[13px] text-on-band-muted">
                        {r.detail}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={compressHref}
                  onClick={(e) => void go(e, compressHref)}
                  className="grid min-h-14 grid-cols-[minmax(0,1fr)_16px] items-center gap-3 py-2.5 text-on-band no-underline hover:bg-on-band/5"
                >
                  <span className="grid">
                    <span className="text-[15px] font-semibold">
                      Compress to a size in KB
                    </span>
                    <span className="num text-[13px] text-on-band-muted">
                      Under {limitKb} KB, or any limit you set
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4" />
                </a>
              </li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
