// A file picked, dropped or pasted before an island's code has loaded, waiting for the island.
const pending = new WeakMap<Element, File>();

export const setPendingFile = (island: Element, file: File) =>
  pending.set(island, file);

export function takePendingFile(
  island: Element | null | undefined,
): File | undefined {
  if (!island) return undefined;
  const file = pending.get(island);
  pending.delete(island);
  return file;
}

/** Set by the island once it has hydrated; until then the loader catches files for it. */
export const markIslandReady = (island: Element | null | undefined) =>
  island?.setAttribute("data-island-ready", "");
