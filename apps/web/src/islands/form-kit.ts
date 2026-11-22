import { loadIslandOnUse } from "../lib/load-island";

loadIslandOnUse("kit", () => import("./form-kit-hydrate"));
