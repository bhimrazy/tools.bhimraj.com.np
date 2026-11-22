import { clearRecentForms, formatWhen, readRecentForms } from "./recent-forms";

/**
 * Home: fills the "Your recent forms" section from localStorage, without React, so the page
 * needs no island code for it. Only paths the page lists as real forms are shown.
 */
export function showRecentForms() {
  const section = document.getElementById("recent");
  const list = section?.querySelector("ul");
  const item = document.querySelector<HTMLTemplateElement>("#recent-item");
  if (!section || !list || !item) return;
  const known = new Set(
    [...document.querySelectorAll<HTMLElement>("[data-form-path]")].map(
      (a) => a.dataset["formPath"],
    ),
  );
  const recent = readRecentForms().filter((f) => known.has(f.path));
  if (!recent.length) return;
  for (const f of recent) {
    const node = item.content.cloneNode(true) as DocumentFragment;
    const a = node.querySelector("a")!;
    a.href = f.path;
    node.querySelector("[data-title]")!.textContent = f.title;
    node.querySelector("[data-when]")!.textContent = formatWhen(f.at);
    list.append(node);
  }
  section.hidden = false;
  section.querySelector("button")?.addEventListener("click", () => {
    clearRecentForms();
    section.hidden = true;
  });
}
