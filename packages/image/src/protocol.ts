import type { ImageErrorCode } from "./errors";
import type { CompressOptions, CompressResult } from "./index";

export interface CompressRequest {
  id: number;
  file: Blob;
  options: CompressOptions;
}

export interface CancelRequest {
  id: number;
  cancel: true;
}

export type WorkerRequest = CompressRequest | CancelRequest;

export type WorkerResponse =
  | { id: number; ok: true; result: CompressResult }
  | { id: number; ok: false; code: ImageErrorCode; message: string };
