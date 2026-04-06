import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// 웹 구동 모드일 경우 Electron의 userData 대신 프로젝트 하위 .data 폴더를 기본값으로 사용
if (!process.env.KONOMI_USER_DATA) {
  process.env.KONOMI_USER_DATA = path.resolve(process.env.KONOMI_DATA_PATH || "./.data");
}
if (!fs.existsSync(process.env.KONOMI_USER_DATA)) {
  fs.mkdirSync(process.env.KONOMI_USER_DATA, { recursive: true });
}

// migrations path setup if needed by db.ts
if (!process.env.KONOMI_MIGRATIONS_PATH) {
  process.env.KONOMI_MIGRATIONS_PATH = path.join(process.cwd(), "prisma", "migrations");
}

import { registerApiRoutes, setSocketIo } from "./api";
import { startUtilityWorker } from "./worker-bridge";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

setSocketIo(io);
registerApiRoutes(app);

// 프로덕션 빌드일 경우 React 프론트엔드 정적 파일 서빙
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../../dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

const PORT = process.env.PORT || 3000;

startUtilityWorker().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Konomi Server Server listening on port ${PORT}`);
    console.log(`User Data Path: ${process.env.KONOMI_USER_DATA}`);
  });
}).catch(err => {
  console.error("Failed to start utility worker:", err);
});
