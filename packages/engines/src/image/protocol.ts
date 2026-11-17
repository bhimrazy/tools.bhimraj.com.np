import type { CompressOptions, CompressResult } from "./index";

export interface CompressRequest {
  id: number;
  file: Blob;
  opts: CompressOptions;
}

export interface CancelRequest {
  id: number;
  cancel: true;
}

export type WorkerRequest = CompressRequest | CancelRequest;

export type WorkerResponse =
  | { id: number; ok: true; result: CompressResult }
  | { id: number; ok: false; error: string; aborted: boolean };
