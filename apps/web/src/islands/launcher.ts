import { loadIslandOnUse } from "../lib/load-island";
import { showRecentForms } from "../lib/show-recent-forms";

showRecentForms();
loadIslandOnUse("launcher", () => import("./launcher-hydrate"));
