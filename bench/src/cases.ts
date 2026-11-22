export type InputKind = "photo" | "transparent" | "signature";

export interface BenchInput {
  id: string;
  kind: InputKind;
  width: number;
  height: number;
}

export interface BenchJob {
  input: string;
  label: string;
  maxBytes: number;
  minBytes?: number;
  width?: number;
  height?: number;
}

export const inputs: BenchInput[] = [
  { id: "photo-12mp", kind: "photo", width: 4000, height: 3000 },
  { id: "photo-48mp", kind: "photo", width: 8000, height: 6000 },
  { id: "transparent-png", kind: "transparent", width: 1600, height: 1200 },
  { id: "signature-2000x600", kind: "signature", width: 2000, height: 600 },
];

// "KB" caps are x1000, floors x1024, as in @tools/presets.
export const jobs: BenchJob[] = [
  { input: "photo-12mp", label: "20 KB", maxBytes: 20_000 },
  { input: "photo-12mp", label: "100 KB", maxBytes: 100_000 },
  { input: "photo-12mp", label: "240 KB", maxBytes: 240_000 },
  {
    input: "photo-48mp",
    label: "100 KB (over the 16.7 MP cap)",
    maxBytes: 100_000,
  },
  { input: "transparent-png", label: "100 KB", maxBytes: 100_000 },
  { input: "signature-2000x600", label: "20 KB", maxBytes: 20_000 },
];
