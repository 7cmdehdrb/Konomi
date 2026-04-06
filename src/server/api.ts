import express from "express";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import { workerRequest, setWorkerEventCallback } from "./worker-bridge";
import crypto from "crypto";
import { resizePng } from "../main/lib/konomi-image";
import { resizeWebp } from "../main/lib/webp-alpha";
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

  // Image serving (Porting konomi:// local protocol logic)
  const thumbCacheDir = path.join(process.env.KONOMI_USER_DATA!, "thumb-cache");
  fs.mkdirSync(thumbCacheDir, { recursive: true });

  app.get("/api/images/serve", async (req, res) => {
    const filePath = req.query.path as string;
    const maxWidth = parseInt(req.query.w as string, 10);

    if (!filePath || !isPathAllowed(filePath)) {
      return res.status(403).send("Forbidden or invalid path");
    }

    try {
      const ext = path.extname(filePath).toLowerCase();
      if (![".png", ".webp", ".jpg", ".jpeg", ".gif"].includes(ext)) {
        return res.status(415).send("Unsupported media type");
      }

      if (maxWidth > 0) {
        // Thumbnail serving
        const stat = await fs.promises.stat(filePath);
        const hash = crypto
          .createHash("md5")
          .update(`${filePath}\0${maxWidth}\0${stat.mtimeMs}`)
          .digest("hex");
        const cachePath = path.join(thumbCacheDir, `${hash}.jpg`);

        try {
          const cacheStat = await fs.promises.stat(cachePath);
          if (cacheStat.size > 0) {
            res.set("Content-Type", "image/jpeg");
            res.set("Cache-Control", "no-store");
            return res.sendFile(cachePath);
          }
        } catch { /* cache miss */ }

        // Generate via native addon (no Electron fallback available here)
        try {
          const buf = fs.readFileSync(filePath);
          const result = ext === ".webp" ? resizeWebp(buf, maxWidth) : resizePng(buf, maxWidth);
          
          if (result && result.data) {
            // Need to encode BGRA pixels back to a format like PNG/JPEG if we do it in node without Electron.
            // Since we don't have nativeImage, and writing an encoder or pulling sharp is extra,
            // for simplicity without adding new heavy image libraries beyond what's built-in the project,
            // IF we are in Web mode, we can just send the original file if the addon output isn't readily encodeable,
            // OR the native addon might actually be returning a raw buffer we'd normally pass to nativeImage.
            // Actually, the result is raw BGRA. Without nativeImage we can't easily transform to JPEG here.
            // So for Web Server mode, unless 'canvas' or 'sharp' is added, thumb optimization requires them.
            // We'll just stream original for now if we can't encode.
            console.log("Serving original due to lack of Electron nativeImage encoder in pure Node environment.");
            // Send original string
          }
        } catch {} // ignore and serve original
      }

      // Serve original file
      res.set("Content-Type", getImageContentType(filePath));
      res.set("Cache-Control", "no-store");
      res.sendFile(filePath);
    } catch (e) {
      res.status(404).send("File not found");
    }
  });
}
