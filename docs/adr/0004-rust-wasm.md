# 0004: Rust and WASM, only where measured

Status: accepted (2026-11-17)

Default to the browser's own codecs (`createImageBitmap`, `OffscreenCanvas`,
`convertToBlob`). Add WASM only for formats or speed the browser lacks, and prefer a
maintained, permissively licensed build (jSquash codecs, pdf.js) before writing Rust.

When a Rust crate is justified:

- Cargo workspace at the repo root, crates in `crates/<name>` (`crate-type = ["cdylib"]`).
- Build with `cargo build --target wasm32-unknown-unknown --release`, then
  `wasm-bindgen --target web` (CLI version must equal the crate's in `Cargo.lock`),
  then `wasm-opt -O3`. Output goes to the consuming package's `src/wasm/` (gitignored) via
  a `build:wasm` script run with `bun run --filter`.
- Single-threaded by default: threads need cross-origin isolation, which blocks most
  ad scripts and adds little on phones.
- Loaded by dynamic `import()` inside the capability package's worker, never on page load.
