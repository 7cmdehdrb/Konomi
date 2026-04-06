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
      return res.status(403).send("Forbidden or invalid path");
    }

    try {
      const ext = path.extname(filePath).toLowerCase();
      const supportedExts = [".png", ".webp", ".jpg", ".jpeg", ".gif"];
      if (!supportedExts.includes(ext)) {
        return res.status(415).send("Unsupported media type");
      }

      // Web 서버 모드에서는 항상 원본 파일 전송 (sharp/nativeImage 미사용)
      res.set("Content-Type", getImageContentType(filePath));
      res.set("Cache-Control", "public, max-age=3600");
      return res.sendFile(filePath);
    } catch (e) {
      console.error("[image serve error]", filePath, e);
      res.status(404).send("File not found");
    }
  });
}
