import { defineConfig } from "vite";

// The page imports @tools/image source from the sibling workspace package.
export default defineConfig({ server: { fs: { allow: [".."] } } });
