import { defineConfig } from "vite";

// The page imports engine source from the sibling workspace package.
export default defineConfig({ server: { fs: { allow: [".."] } } });
