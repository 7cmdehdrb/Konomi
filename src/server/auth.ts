import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import type { Socket } from "socket.io";

const AUTH_COOKIE_NAME = "konomi_auth";
const SESSION_TTL_MS = Number(process.env.KONOMI_AUTH_SESSION_TTL_MS ?? 12 * 60 * 60 * 1000);

type SessionMap = Map<string, number>;

const sessions: SessionMap = new Map();

function readAuthConfig(): { salt: string; passwordHash: string } | null {
  const salt = process.env.KONOMI_AUTH_SALT?.trim() ?? "";
  const passwordHash = process.env.KONOMI_AUTH_PASSWORD_HASH?.trim().toLowerCase() ?? "";
  if (!salt || !passwordHash) return null;
  return { salt, passwordHash };
}

function hashPassword(password: string, salt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${password}${salt}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    result[k] = decodeURIComponent(rest.join("="));
  }
  return result;
}

function pruneExpiredSessions(now = Date.now()): void {
  for (const [token, expiresAt] of sessions.entries()) {
    if (expiresAt <= now) sessions.delete(token);
  }
}

function getTokenFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] ?? null;
}

function isSessionTokenValid(token: string | null): boolean {
  if (!token) return false;
  pruneExpiredSessions();
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function issueSessionToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function clearSessionToken(token: string | null): void {
  if (token) sessions.delete(token);
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function isAuthConfigured(): boolean {
  return readAuthConfig() !== null;
}

export function verifyPassword(password: string): boolean {
  const cfg = readAuthConfig();
  if (!cfg) return false;
  const computed = hashPassword(password, cfg.salt);
  if (!/^[a-f0-9]{64}$/.test(cfg.passwordHash)) return false;
  return safeEqualHex(computed, cfg.passwordHash);
}

export function createLoginSession(res: Response): void {
  const token = issueSessionToken();
  setAuthCookie(res, token);
}

export function destroyLoginSession(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);
  clearSessionToken(token);
  clearAuthCookie(res);
}

export function isAuthenticatedRequest(req: Request): boolean {
  return isSessionTokenValid(getTokenFromRequest(req));
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isAuthConfigured()) {
    res.status(503).json({ error: "Authentication is not configured on server." });
    return;
  }
  if (!isAuthenticatedRequest(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  if (!isAuthConfigured()) {
    next(new Error("Authentication is not configured on server."));
    return;
  }
  const token = parseCookies(socket.request.headers.cookie)[AUTH_COOKIE_NAME] ?? null;
  if (!isSessionTokenValid(token)) {
    next(new Error("Unauthorized"));
    return;
  }
  next();
}
