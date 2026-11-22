import { compressImage } from "./compress";
import { toErrorCode } from "./errors";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const jobs = new Map<number, AbortController>();
const reply = (msg: WorkerResponse) => scope.postMessage(msg);

scope.onmessage = async ({ data: msg }: MessageEvent<WorkerRequest>) => {
  if ("cancel" in msg) {
    jobs.get(msg.id)?.abort();
    return;
  }
  const ctrl = new AbortController();
  jobs.set(msg.id, ctrl);
  try {
    reply({
      id: msg.id,
      ok: true,
      result: await compressImage(msg.file, msg.options, ctrl.signal),
    });
  } catch (err) {
    reply({
      id: msg.id,
      ok: false,
      code: ctrl.signal.aborted ? "aborted" : toErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    jobs.delete(msg.id);
  }
};
