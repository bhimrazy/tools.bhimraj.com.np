import { setPendingFile } from "./pending-file";

/** The file input a drop or paste on `target` is meant for: its slot's, else the island's first. */
const findInputId = (island: HTMLElement, target: EventTarget | null) => {
  const slot =
    target instanceof Element ? target.closest("[data-tool-slot]") : null;
  return (slot ?? island).querySelector<HTMLInputElement>('input[type="file"]')
    ?.id;
};

const INTENT = [
  "pointerdown",
  "touchstart",
  "focusin",
  "keydown",
  "dragenter",
] as const;
const isReady = (el: Element) => el.hasAttribute("data-island-ready");

/**
 * Loads an island's code on first use rather than on page load, so a tool page ships only its
 * HTML and CSS until someone touches the tool (docs/product-standards.md: at most 50 KB gzip
 * before a file is chosen). The server HTML already works: a file picked, dropped or pasted
 * before the code arrives is kept with setPendingFile and taken by the island when it mounts.
 * A URL with a query (a size rule from search, or a file from the home page) loads it at once.
 */
export function loadIslandOnUse(
  name: string,
  load: () => Promise<{ hydrate(el: HTMLElement): void }>,
) {
  const islands = [
    ...document.querySelectorAll<HTMLElement>(`[data-island="${name}"]`),
  ];
  if (!islands.length) return;
  let loading: Promise<unknown> | undefined;
  const start = () => {
    loading ??= load().then((mod) => {
      for (const el of islands) mod.hydrate(el);
    });
  };
  const keep = (
    el: HTMLElement,
    inputId: string | undefined,
    file: File | undefined,
  ) => {
    if (!file || !inputId) return;
    setPendingFile(el, inputId, file);
    start();
  };
  if (location.search) start();

  for (const el of islands) {
    for (const type of INTENT)
      el.addEventListener(type, start, { once: true, passive: true });
    el.addEventListener("dragover", (e) => {
      if (!isReady(el)) e.preventDefault();
    });
    el.addEventListener("drop", (e) => {
      if (isReady(el)) return;
      e.preventDefault();
      keep(el, findInputId(el, e.target), e.dataTransfer?.files[0]);
    });
    el.addEventListener("change", (e) => {
      const input = e.target;
      if (
        isReady(el) ||
        !(input instanceof HTMLInputElement) ||
        input.type !== "file"
      )
        return;
      keep(el, input.id, input.files?.[0]);
      input.value = "";
    });
  }

  document.addEventListener("paste", (e) => {
    const focused = islands.find((el) => el.contains(document.activeElement));
    const el = focused ?? (islands.length === 1 ? islands[0] : undefined);
    if (!el || isReady(el)) return;
    const file = [...(e.clipboardData?.files ?? [])].find((f) =>
      f.type.startsWith("image/"),
    );
    if (!file) return;
    e.preventDefault();
    keep(el, findInputId(el, document.activeElement), file);
  });
}
