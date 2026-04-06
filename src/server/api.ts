import express from "express";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import { workerRequest, setWorkerEventCallback } from "./worker-bridge";
import { getImageContentType } from "../main/lib/path-guard";

let io: Server;

export function setSocketIo(server: Server) {
  io = server;
  setWorkerEventCallback((event, payload) => {
    io.emit(event, payload);
  });
}

function parseAllowedRoots() {
  const envPaths = process.env.ALLOWED_ROOT_PATHS || "";
  return envPaths.split(",").map(p => p.trim()).filter(Boolean);
}

function isPathAllowed(filePath: string): boolean {
  if (!filePath) return false;
  // If allowed paths are set in .env, enforce them
  const allowedRoots = parseAllowedRoots();
  if (allowedRoots.length > 0) {
    const normalizedTarget = path.normalize(filePath).toLowerCase();
    return allowedRoots.some(root => {
      const normalizedRoot = path.normalize(root).toLowerCase();
      return normalizedTarget.startsWith(normalizedRoot);
    });
  }
  // If none set, default to secure but we might just return true for convenience in isolated environments.
  return true;
}

export function registerApiRoutes(app: express.Express) {
  // RPC Endpoint mapping typical bridge.request traffic
  app.post("/api/rpc", async (req, res) => {
    try {
      const { type, payload } = req.body;

      // Handle requests that were originally native to ipcMain in Electron
      if (type === "folder:listSubdirectoriesByPath") {
        const folderPath = payload;
        try {
          const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
          const result = entries
            .filter((e) => e.isDirectory())
            .map((e) => ({
              name: e.name,
              path: path.join(folderPath, e.name),
            }));
          return res.json({ result });
        } catch {
          return res.json({ result: [] });
        }
      } else if (type === "folder:revealInExplorer" || type === "image:revealInExplorer") {
        console.log(`[mock] Reveal in explorer requested for: ${payload}`);
        return res.json({ result: true });
      }

      const result = await workerRequest(type, payload);
      return res.json({ result });
    } catch (error: any) {
      console.error("[API RPC Error]", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/serve", async (req, res) => {
    const filePath = req.query.path as string;

    if (!filePath || !isPathAllowed(filePath)) {
      console.warn("[image serve] Blocked:", filePath);
      return res.status(403).send("Forbidden or invalid path");
    }

    const absPath = path.resolve(filePath);

    try {
      // 파일 존재 여부 선확인
      await fs.promises.access(absPath, fs.constants.R_OK);
    } catch {
      console.warn("[image serve] Not found:", absPath);
      return res.status(404).send("File not found");
    }

    const ext = path.extname(absPath).toLowerCase();
    const supportedExts = [".png", ".webp", ".jpg", ".jpeg", ".gif"];
    if (!supportedExts.includes(ext)) {
      return res.status(415).send("Unsupported media type");
    }

    res.set("Content-Type", getImageContentType(absPath));
    res.set("Cache-Control", "public, max-age=3600");

    // Windows 절대경로를 res.sendFile 대신 createReadStream으로 안전하게 전송
    const stream = fs.createReadStream(absPath);
    stream.on("error", (err) => {
      console.error("[image serve] Stream error:", absPath, err);
      if (!res.headersSent) res.status(500).send("Read error");
    });
    stream.pipe(res);
  });
}
