// A file picked, dropped or pasted before an island's code has loaded, waiting for the island.
// Keyed by the file input it was meant for, since a form's kit holds one input per upload.
const pending = new WeakMap<Element, Map<string, File>>();

export function setPendingFile(island: Element, inputId: string, file: File) {
  const map = pending.get(island) ?? new Map<string, File>();
  map.set(inputId, file);
  pending.set(island, map);
}

export function takePendingFile(
  island: Element | null | undefined,
  inputId: string,
): File | undefined {
  const map = island && pending.get(island);
  if (!map) return undefined;
  const file = map.get(inputId);
  map.delete(inputId);
  return file;
}

/** Set by the island once it has hydrated; until then the loader catches files for it. */
export const markIslandReady = (island: Element | null | undefined) =>
  island?.setAttribute("data-island-ready", "");
