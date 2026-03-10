import { parentPort } from "worker_threads";
import { readImageMeta } from "./nai";

parentPort!.on(
  "message",
  ({ id, filePath }: { id: number; filePath: string }) => {
    parentPort!.postMessage({ id, result: readImageMeta(filePath) });
  },
);
