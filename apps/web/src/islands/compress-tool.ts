import { loadIslandOnUse } from "../lib/load-island";

loadIslandOnUse("compress", () => import("./compress-tool-hydrate"));
