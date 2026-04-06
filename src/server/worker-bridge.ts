import { Worker } from "worker_threads";
import path from "path";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  type: string;
};

let utilityWorker: Worker | null = null;
let seq = 0;
const pending = new Map<number, PendingRequest>();

export async function startUtilityWorker(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Determine the typescript loader if needed, or if Bun/tsx handles it automatically.
    // For `tsx` or `ts-node`, loading .ts files works seamlessly if execArgv inherits the loader,
    // or we can pass a small wrapper. Let's assume standard loading.
    const ext = path.extname(__filename);
    const scriptPath = path.join(__dirname, `../main/utility${ext}`);

    try {
      const wrapperScript = `
        require('tsx/cjs');
        require('${scriptPath.replace(/\\/g, '\\\\')}');
      `;
      utilityWorker = new Worker(wrapperScript, { eval: true });
    } catch (e) {
      console.error("Failed to fork worker natively, trying tsx wrapper...", e);
      reject(e);
      return;
    }

    utilityWorker.on("online", () => {
      resolve();
    });

    utilityWorker.on("message", (msg: any) => {
      if (msg && msg.event !== undefined) {
        emitToSockets(msg.event, msg.payload);
      } else if (msg && msg.ack === true) {
        // acknowledged
      } else if (msg && msg.id !== undefined) {
        const id = msg.id;
        const p = pending.get(id);
        if (!p) return;
        pending.delete(id);
        if (msg.error !== undefined) {
          p.reject(new Error(msg.error));
        } else {
          p.resolve(msg.result);
        }
      }
    });

    utilityWorker.on("error", (err) => {
      console.error("Utility worker error:", err);
      reject(err);
    });

    utilityWorker.on("exit", (code) => {
      console.log(`Utility worker stopped with exit code ${code}`);
    });
  });
}

let emitFn: (event: string, payload: any) => void = () => {};
export function setWorkerEventCallback(fn: (event: string, payload: any) => void) {
  emitFn = fn;
}

function emitToSockets(event: string, payload: any) {
  emitFn(event, payload);
}

export function workerRequest<T>(type: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!utilityWorker) return reject(new Error("Utility worker not running"));
    const id = seq++;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, type });
    utilityWorker.postMessage({ id, type, payload });
  });
}
