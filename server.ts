import express, { type Request, type Response, type NextFunction } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  TOTP_VAULT_SETTING_ID,
  TWO_STEP_TRUST_COOKIE_NAME,
  type TwoStepFrequency,
  buildOtpAuthUri,
  buildTwoStepTrustCookieHeader,
  deleteUserTotpSecret,
  extractCookieValue,
  generateQrDataUrl,
  generateTotpSecret,
  getTotpEnrolledUserIds,
  getTrustMaxAgeSeconds,
  getUserTotpEntry,
  getUserTotpSecret,
  normalizeTwoStepFrequency,
  setUserTotpSecret,
  signTotpSetupToken,
  signTwoStepTrustToken,
  verifyTotpCode,
  verifyTotpSetupToken,
  verifyTwoStepTrustToken,
} from "./api/_totpHelper.js";

// Load local .env file without overriding already-set process environment variables
function loadLocalEnv(): void {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore .env read errors in restricted environments
  }
}

loadLocalEnv();

const app = express();
const PORT = 3000;

// Parse json payload up to 25MB for PDF base64 attachments
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Baseline security headers (avoid X-Frame-Options to preserve preview iframe compatibility)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

// ==========================================
// SECURITY HELPERS: HTML ESCAPING, CRYPTO & AUTH
// ==========================================
function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHttpUrl(rawUrl: unknown, fallback = "https://www.rataulicoop.com.np"): string {
  if (typeof rawUrl !== "string") return fallback;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // fallback
  }
  return fallback;
}

const SESSION_COOKIE_NAME = "ratauli_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString("hex");

interface SessionPayload {
  sub: string;
  username: string;
  roleId: string;
  isAdmin: boolean;
  jti: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: SessionPayload;
}

const revokedTokens = new Map<string, number>();

function pruneRevokedTokens(): void {
  const now = Date.now();
  for (const [jti, exp] of revokedTokens.entries()) {
    if (exp <= now) revokedTokens.delete(jti);
  }
}

function signTokenPayload(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed || typeof parsed.sub !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Date.now()) return null;
    if (revokedTokens.has(parsed.jti)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function extractRequestToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookieHeader(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  return null;
}

function setSessionCookie(res: Response, token: string): void {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${maxAgeSec}${secureFlag}`
  );
}

function appendSetCookie(res: Response, cookieStr: string): void {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieStr);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing.map(String), cookieStr]);
  } else {
    res.setHeader("Set-Cookie", [String(existing), cookieStr]);
  }
}

function isRequestHttps(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  return proto === "https" || process.env.NODE_ENV === "production";
}

function clearSessionCookie(res: Response): void {
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0${secureFlag}`
  );
}

function isUserAdminRecord(row: { username?: string; role_id?: string; roleId?: string; permissions?: string[] }): boolean {
  const uname = String(row.username || "").toLowerCase();
  const rid = String(row.role_id || row.roleId || "");
  const perms = Array.isArray(row.permissions) ? row.permissions : [];
  return (
    uname === "admin" ||
    rid === "1" ||
    perms.includes("manage_settings") ||
    perms.includes("manage_users")
  );
}

function issueSessionForUser(user: {
  id: string;
  username: string;
  roleId?: string;
  role_id?: string;
  permissions?: string[];
}): string {
  const payload: SessionPayload = {
    sub: String(user.id),
    username: String(user.username),
    roleId: String(user.roleId || user.role_id || "3"),
    isAdmin: isUserAdminRecord(user),
    jti: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + SESSION_TTL_MS,
  };
  return signTokenPayload(payload);
}

function isSameOriginMutationAllowed(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }
  // Bearer-authenticated requests are not vulnerable to ambient cookie CSRF
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return true;
  }
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  const referer = typeof req.headers.referer === "string" ? req.headers.referer.trim() : "";
  const expectedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  if (!expectedHost) return true;
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  }
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  }
  return true;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!isSameOriginMutationAllowed(req)) {
    res.status(403).json({
      success: false,
      message: "Cross-origin state-changing requests are not permitted.",
    });
    return;
  }
  const token = extractRequestToken(req);
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    res.status(401).json({
      success: false,
      message: "Authentication required. Please sign in to access this endpoint.",
    });
    return;
  }
  req.authUser = payload;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.authUser?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Administrator privileges are required for this action.",
      });
      return;
    }
    next();
  });
}

// Password hashing using Node scrypt + 16-byte random salt + constant-time compare
function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function isPasswordHashed(stored?: string | null): boolean {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  return parts.length === 3 && parts[0] === "scrypt" && parts[1].length >= 16 && parts[2].length === 128;
}

function verifyPassword(plain: string, stored?: string | null): { valid: boolean; needsMigration: boolean } {
  if (!plain || !stored || typeof stored !== "string") {
    return { valid: false, needsMigration: false };
  }
  if (isPasswordHashed(stored)) {
    const [, salt, expectedHex] = stored.split("$");
    const derivedBuf = crypto.scryptSync(plain, salt, 64);
    const expectedBuf = Buffer.from(expectedHex, "hex");
    if (derivedBuf.length !== expectedBuf.length) {
      return { valid: false, needsMigration: false };
    }
    return { valid: crypto.timingSafeEqual(derivedBuf, expectedBuf), needsMigration: false };
  }

  // Constant-time legacy plain-text comparison for seamless one-time hash migration
  const hashA = crypto.createHash("sha256").update(plain).digest();
  const hashB = crypto.createHash("sha256").update(stored).digest();
  const valid = crypto.timingSafeEqual(hashA, hashB);
  return { valid, needsMigration: valid };
}

// Simple sliding-window rate limiter for login and OTP endpoints
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxRequests) return false;
  existing.count += 1;
  return true;
}

// Server-side Supabase client helper (prefers SUPABASE_SERVICE_ROLE_KEY on server)
let cachedServerSupabase: SupabaseClient | null = null;

function getServerSupabase(): SupabaseClient | null {
  if (cachedServerSupabase) return cachedServerSupabase;
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key) return null;
  cachedServerSupabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedServerSupabase;
}

function mapDbUserRowToClientUser(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    username: String(row.username || ""),
    fullName: String(row.full_name || row.username || ""),
    roleId: String(row.role_id || "3"),
    branchId: String(row.branch_id || "main"),
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    status: (row.status === "Inactive" ? "Inactive" : "Active") as "Active" | "Inactive",
    email: typeof row.email === "string" ? row.email : undefined,
    mobile: typeof row.mobile === "string" ? row.mobile : undefined,
    department: typeof row.department === "string" ? row.department : undefined,
    designation: typeof row.designation === "string" ? row.designation : undefined,
    profilePhoto: typeof row.profile_photo === "string" ? row.profile_photo : undefined,
    accountCreated: typeof row.account_created === "number" ? row.account_created : undefined,
    passwordUpdatedAt: typeof row.password_updated_at === "number" ? row.password_updated_at : undefined,
    forcePasswordChange: Boolean(row.force_password_change),
  };
}

// Server-side OTP Challenge Store
interface OtpChallenge {
  userId: string;
  username: string;
  email: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  resetTokenHash?: string;
  resetExpiresAt?: number;
}

const otpChallenges = new Map<string, OtpChallenge>();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

interface LoginOtpChallenge {
  method: "email" | "authenticator" | "authenticator_setup";
  userId: string;
  username: string;
  fullName: string;
  email: string;
  otpHash: string;
  pendingTotpSecret?: string;
  expiresAt: number;
  attempts: number;
}

const loginOtpChallenges = new Map<string, LoginOtpChallenge>();
const LOGIN_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_TOTP_SETUP_TTL_MS = 10 * 60 * 1000; // 10 minutes for first-time QR scan

function pruneOtpChallenges(): void {
  const now = Date.now();
  for (const [id, ch] of otpChallenges.entries()) {
    const expiry = Math.max(ch.expiresAt, ch.resetExpiresAt || 0);
    if (expiry <= now) otpChallenges.delete(id);
  }
  for (const [id, ch] of loginOtpChallenges.entries()) {
    if (ch.expiresAt <= now) loginOtpChallenges.delete(id);
  }
}

function sha256Hex(val: string): string {
  return crypto.createHash("sha256").update(val).digest("hex");
}

function maskEmailAddress(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "***@rataulisaccos.org.np";
  const [name, domain] = parts;
  const maskedName = name.length > 2 ? `${name.charAt(0)}****${name.charAt(name.length - 1)}` : `${name.charAt(0)}****`;
  return `${maskedName}@${domain}`;
}

function validateStrongPasswordServer(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, a number, and a special character.";
  }
  return null;
}

// Server-side SMTP transporter factory (reads credentials strictly from process.env)
function createServerSmtpTransporter(companyName?: string) {
  const effectiveCompany = companyName || "रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड";
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : port === 465;
  const user = (process.env.SMTP_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || "").trim();
  const pass = host.toLowerCase().includes("gmail.com") ? rawPass.replace(/\s+/g, "") : rawPass;
  const from = (process.env.SMTP_FROM || "").trim() || (user ? `${effectiveCompany} <${user}>` : "");

  if (!user || !pass) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 18000,
  });

  return { transporter, user, from };
}

// ==========================================
// SSRF & PATH-TRAVERSAL SAFE LOGO ATTACHMENT
// ==========================================
const DEFAULT_COOP_LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAACa0lEQVR4nO3cvU3EQBAFYEeIkCIohAbogAaogJiaiIiogxZogeAQARJC9np+3puZXeZJE97Z+91byXc+eds6nc537u8uqvnX0WI1KhFteUzhgj9erlWzPiQYzA06TQLRTJilkwwnhiwXANz2+KCadSCNcFowBGg9RAMeGk4LWQexGJwbsipeNJwGMgdRiJcNJ4WMRZwUrwbi5Hi5iIvg5SEG4X2+3YomDBGNdwQYgcbA5LeQiHcEchY0JBeRgKcF04JSEBnt8+Khg0b0txDYPnTrJIhaSGwLge2LgBtB5rQQ1D4r3s3r8+6wETEtJLQPgedBjG0huH1IvAhEfwsB7bNsXSmeFhGxleWAoO3LxrMi8rdxAl4EIByxGqAFUZspAL3Xeyw8C+KUgBJET7iAidtXiugNdxuD2of6yobGuxguaVIAR5F+8t6RIDZgAzZgAzZgAzZgAzYgFlB6If3+dAUdSUpfSEtbWAFQup7w78MrAZb/NaYBnYjRgFP8oNqAgTeVIgHjbiqBWzhCjAKMva15AohsYTSgFc8F6GnhGWIEYN4fjMAt3ENkA+b9uYjUQtS9EkkseLj2gVv4F5EJ+fc4Hjx7+wgtjGijFY7TPkILWW30tI7XPmELrYh7kFLQo9dZz+MUzwVIRhxBSsdzbD7eDuLeQb2IWkzEsQ7XAcfbZC1EIUaMCA8KuBBiDt4iiLl4kyPWwFMiVoAcnlsKngExA/L0fFLxDhArQKrh0vAciAxI0THL4f1k78T64WOGACCRMw/c7xyddD+AUZnRIvoRoIqcLcwIKn3f7OXjIl0wapZOoxHSWJ2OIV+gjclEh0yIQwAAAABJRU5ErkJggg==";

const ALLOWED_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

function isPrivateOrReservedIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }
  const normalized = lower.startsWith("::ffff:") ? lower.slice(7) : lower;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function isSafeRemoteImageUrl(rawUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return false;
    }
    const resolved = await dns.promises.lookup(host, { all: true });
    if (!resolved || resolved.length === 0) return false;
    for (const entry of resolved) {
      if (isPrivateOrReservedIp(entry.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function detectImageMagic(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: "image/png", ext: ".png" };
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { mime: "image/gif", ext: ".gif" };
  }
  // WEBP: RIFF....WEBP
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }
  return null;
}

async function getLogoAttachment(logoUrl?: string) {
  const publicDir = path.resolve(process.cwd(), "public");
  const publicPrefix = publicDir + path.sep;

  if (logoUrl && typeof logoUrl === "string") {
    const trimmed = logoUrl.trim();

    if (trimmed.startsWith("data:image/")) {
      try {
        const commaIndex = trimmed.indexOf(",");
        const cleanBase64 = commaIndex !== -1 ? trimmed.substring(commaIndex + 1).trim() : trimmed.trim();
        const buf = Buffer.from(cleanBase64, "base64");
        const detected = detectImageMagic(buf);
        if (detected && buf.length <= MAX_LOGO_BYTES) {
          return {
            filename: `logo${detected.ext}`,
            content: buf,
            cid: "cooplogo",
            contentType: detected.mime,
          };
        }
      } catch (err) {
        console.warn("Failed to parse base64 logo for email:", err);
      }
    } else if (trimmed.startsWith("https://")) {
      if (await isSafeRemoteImageUrl(trimmed)) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          try {
            const fetchRes = await fetch(trimmed, { signal: controller.signal, redirect: "error" });
            const contentType = fetchRes.headers.get("content-type") || "";
            if (fetchRes.ok && contentType.toLowerCase().startsWith("image/")) {
              const arrBuf = await fetchRes.arrayBuffer();
              if (arrBuf.byteLength > 0 && arrBuf.byteLength <= MAX_LOGO_BYTES) {
                return {
                  filename: "logo.png",
                  content: Buffer.from(arrBuf),
                  cid: "cooplogo",
                  contentType,
                };
              }
            }
          } finally {
            clearTimeout(timer);
          }
        } catch (err) {
          console.warn("Failed to fetch remote logo for email:", err);
        }
      }
    } else if (!trimmed.startsWith("http://")) {
      // Safe local path strictly confined within /public with allowed image extension
      const localCleanPath = trimmed.split("?")[0].replace(/^\/+/, "");
      const resolvedPath = path.resolve(publicDir, localCleanPath);
      const ext = path.extname(resolvedPath).toLowerCase();
      if (
        resolvedPath.startsWith(publicPrefix) &&
        ALLOWED_IMAGE_EXTS.has(ext) &&
        fs.existsSync(resolvedPath) &&
        fs.statSync(resolvedPath).isFile()
      ) {
        try {
          const fileBuf = fs.readFileSync(resolvedPath);
          const detected = detectImageMagic(fileBuf);
          if (detected && fileBuf.length <= MAX_LOGO_BYTES) {
            return {
              filename: `logo${detected.ext}`,
              content: fileBuf,
              cid: "cooplogo",
              contentType: detected.mime,
            };
          }
        } catch (e) {
          console.warn("Logo path read error:", e);
        }
      }
    }
  }

  // Fallback to local system logo if exists on disk
  for (const fallbackName of ["system_logo.png", "ratauli_official_coop_logo.png"]) {
    try {
      const defaultLocalPath = path.resolve(publicDir, fallbackName);
      if (defaultLocalPath.startsWith(publicPrefix) && fs.existsSync(defaultLocalPath)) {
        return {
          filename: "cooplogo.png",
          content: fs.readFileSync(defaultLocalPath),
          cid: "cooplogo",
          contentType: "image/png",
        };
      }
    } catch (e) {
      console.warn("Default logo read error:", e);
    }
  }

  return {
    filename: "cooplogo.png",
    content: Buffer.from(DEFAULT_COOP_LOGO_BASE64, "base64"),
    cid: "cooplogo",
    contentType: "image/png",
  };
}

// ==========================================
// PUBLIC ROUTES (HEALTH, LOGO, AUTH)
// ==========================================
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/system-logo", (_req, res) => {
  try {
    const publicPath = path.resolve(process.cwd(), "public", "system_logo.png");
    if (fs.existsSync(publicPath)) {
      return res.json({ success: true, logoUrl: `/system_logo.png?v=${fs.statSync(publicPath).mtimeMs}` });
    }
    return res.json({ success: true, logoUrl: "/system_logo.png" });
  } catch {
    return res.json({ success: true, logoUrl: "/system_logo.png" });
  }
});

// Check whether first-run Admin Bootstrap is needed (true ONLY when DB has 0 users and no bootstrap env password is set)
app.get("/api/auth/bootstrap-status", async (_req, res) => {
  try {
    if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
      return res.json({ success: true, needsBootstrap: false });
    }
    const sb = getServerSupabase();
    if (!sb) {
      return res.json({ success: true, needsBootstrap: false });
    }
    const { count, error } = await sb.from("users").select("id", { count: "exact", head: true });
    if (error) {
      return res.json({ success: true, needsBootstrap: false });
    }
    return res.json({ success: true, needsBootstrap: (count ?? 0) === 0 });
  } catch {
    return res.json({ success: true, needsBootstrap: false });
  }
});

// One-time atomic first-run Admin Setup (only permitted when users table has 0 rows)
app.post("/api/auth/bootstrap-admin", async (req, res) => {
  try {
    const { fullName, username, password, email, mobile } = req.body || {};
    const cleanUsername = typeof username === "string" ? username.trim().toLowerCase() : "admin";
    const cleanFullName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : "System Administrator";

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ success: false, message: "Username must be at least 3 characters." });
    }
    const pwErr = validateStrongPasswordServer(String(password || ""));
    if (pwErr) {
      return res.status(400).json({ success: false, message: pwErr });
    }

    const sb = getServerSupabase();
    if (!sb) {
      return res.status(503).json({ success: false, message: "Database connection is not configured on the server." });
    }

    const { count, error: countErr } = await sb.from("users").select("id", { count: "exact", head: true });
    if (countErr) {
      return res.status(500).json({ success: false, message: "Could not verify user table status." });
    }
    if ((count ?? 0) > 0) {
      return res.status(409).json({ success: false, message: "Initial administrator has already been configured." });
    }

    const adminPerms = [
      "view_transaction", "add_transaction", "edit_transaction", "delete_transaction",
      "view_reports", "manage_users", "manage_settings", "view_cash_entry",
      "view_daily_ledger", "view_income_expense", "view_ledger_names",
      "view_consolidated_report", "cross_branch_operation", "manage_hr", "manage_notices"
    ];

    const newAdminRow = {
      id: `admin-${crypto.randomUUID()}`,
      username: cleanUsername,
      password: hashPassword(String(password)),
      full_name: cleanFullName,
      role_id: "1",
      branch_id: "main",
      permissions: adminPerms,
      status: "Active",
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      mobile: typeof mobile === "string" && mobile.trim() ? mobile.trim() : null,
      account_created: Date.now(),
    };

    const { error: insertErr } = await sb.from("users").insert(newAdminRow);
    if (insertErr) {
      return res.status(500).json({ success: false, message: "Failed to initialize administrator account." });
    }

    const safeUser = mapDbUserRowToClientUser(newAdminRow);
    const token = issueSessionForUser(safeUser);
    setSessionCookie(res, token);
    return res.json({ success: true, user: safeUser, token });
  } catch (err: unknown) {
    console.error("Bootstrap admin error:", err);
    return res.status(500).json({ success: false, message: "Failed to create initial administrator." });
  }
});

// Server-side Login with scrypt verification + transparent legacy password upgrade
app.post("/api/auth/login", async (req, res) => {
  try {
    pruneRevokedTokens();
    const { username, password } = req.body || {};
    const enteredUsername = typeof username === "string" ? username.trim().toLowerCase() : "";
    const enteredPassword = typeof password === "string" ? password : "";

    if (!enteredUsername || !enteredPassword) {
      return res.status(400).json({ success: false, message: "Username and password are required." });
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(`login:${clientIp}:${enteredUsername}`, 15, 10 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Please wait 10 minutes and try again.",
      });
    }

    const sb = getServerSupabase();
    if (!sb) {
      return res.status(503).json({ success: false, message: "Authentication database is not configured." });
    }

    // Fetch matching user row (case-insensitive username match)
    const { data: rows, error } = await sb
      .from("users")
      .select("*")
      .ilike("username", enteredUsername)
      .limit(5);

    if (error) {
      console.error("Login DB query error:", error.message);
      return res.status(500).json({ success: false, message: "Could not verify credentials. Please try again." });
    }

    const matchedRow = (rows || []).find(
      (r) => typeof r.username === "string" && r.username.trim().toLowerCase() === enteredUsername
    );

    if (!matchedRow) {
      // Optional env-configured bootstrap login ONLY when ADMIN_BOOTSTRAP_PASSWORD is explicitly set and DB has 0 users
      const envBootstrapPw = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (envBootstrapPw && enteredUsername === "admin") {
        const { count } = await sb.from("users").select("id", { count: "exact", head: true });
        if ((count ?? 0) === 0 && verifyPassword(enteredPassword, envBootstrapPw).valid) {
          const safeAdmin = {
            id: "admin-bootstrap",
            username: "admin",
            fullName: "System Administrator",
            roleId: "1",
            branchId: "main",
            status: "Active" as const,
            accountCreated: Date.now(),
            permissions: [
              "view_transaction", "add_transaction", "edit_transaction", "delete_transaction",
              "view_reports", "manage_users", "manage_settings", "view_cash_entry",
              "view_daily_ledger", "view_income_expense", "view_ledger_names",
              "view_consolidated_report", "cross_branch_operation", "manage_hr", "manage_notices"
            ],
          };
          const token = issueSessionForUser(safeAdmin);
          setSessionCookie(res, token);
          return res.json({ success: true, user: safeAdmin, token });
        }
      }
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    if (matchedRow.status === "Inactive") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact the administrator.",
      });
    }

    const check = verifyPassword(enteredPassword, typeof matchedRow.password === "string" ? matchedRow.password : "");
    if (!check.valid) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    // Transparently upgrade legacy plain-text password to salted scrypt hash in Supabase
    if (check.needsMigration) {
      try {
        const upgradedHash = hashPassword(enteredPassword);
        await sb.from("users").update({ password: upgradedHash }).eq("id", matchedRow.id);
      } catch (migErr) {
        console.warn("Legacy password hash migration notice:", migErr);
      }
    }

    // Enrich missing branchId/designation from linked employee if applicable
    const safeUser = mapDbUserRowToClientUser(matchedRow);
    if (!safeUser.branchId || !safeUser.designation) {
      try {
        const { data: emps } = await sb.from("employees").select("full_name, email, employee_code, branch_id, designation");
        if (Array.isArray(emps)) {
          const linked = emps.find((e) => {
            const empName = String(e.full_name || "").toLowerCase().trim();
            const uName = safeUser.fullName.toLowerCase().trim();
            const empEmail = String(e.email || "").toLowerCase().trim();
            const uEmail = (safeUser.email || "").toLowerCase().trim();
            const empCode = String(e.employee_code || "").toLowerCase().trim();
            const uUsername = safeUser.username.toLowerCase().trim();
            return (
              (empName !== "" && empName === uName) ||
              (empEmail !== "" && uEmail !== "" && empEmail === uEmail) ||
              (empCode !== "" && empCode === uUsername)
            );
          });
          if (linked) {
            if (!safeUser.branchId && linked.branch_id) safeUser.branchId = String(linked.branch_id);
            if (!safeUser.designation && linked.designation) safeUser.designation = String(linked.designation);
          }
        }
      } catch {
        // Non-blocking enrichment
      }
    }

    // Check global 2-Step Login setting directly from Supabase
    let twoStepEnabled = false;
    let twoStepMethod: "smart" | "authenticator" | "email" = "authenticator";
    let twoStepFrequency: TwoStepFrequency = "once_per_day";
    let twoStepCompanyName = "Ratauli Saving and Credit Cooperative Ltd";
    let twoStepCompanyAddress = "Pipra Rural Municipality -6 (Mahottari)";
    let twoStepLogoUrl = "";
    try {
      const { data: settingsRow } = await sb
        .from("settings")
        .select("data")
        .eq("id", "global")
        .maybeSingle();
      const sData =
        settingsRow && settingsRow.data && typeof settingsRow.data === "object"
          ? (settingsRow.data as Record<string, unknown>)
          : null;
      if (sData) {
        twoStepEnabled = sData.twoStepLoginEnabled === true;
        if (sData.twoStepLoginMethod === "email" || sData.twoStepLoginMethod === "authenticator" || sData.twoStepLoginMethod === "smart") {
          twoStepMethod = sData.twoStepLoginMethod;
        }
        twoStepFrequency = normalizeTwoStepFrequency(sData.twoStepFrequency);
        if (typeof sData.systemName === "string" && sData.systemName.trim()) {
          twoStepCompanyName = sData.systemName.trim();
        }
        if (typeof sData.address === "string" && sData.address.trim()) {
          twoStepCompanyAddress = sData.address.trim();
        }
        if (typeof sData.logoUrl === "string" && sData.logoUrl.trim()) {
          twoStepLogoUrl = sData.logoUrl.trim();
        }
      }
    } catch {
      // Non-blocking settings lookup
    }

    if (twoStepEnabled) {
      pruneOtpChallenges();

      // Check if user has Google Authenticator paired (used in 'smart' and 'authenticator' modes)
      let userTotpEntry: { enabledAt: number } | null = null;
      let userTotpSecret: string | null = null;
      if (twoStepMethod !== "email") {
        userTotpEntry = await getUserTotpEntry(sb, String(matchedRow.id)).catch(() => null);
        if (userTotpEntry) {
          userTotpSecret = await getUserTotpSecret(sb, String(matchedRow.id), SESSION_SECRET).catch(() => null);
        }
      }

      const requiredMethodForTrust: "authenticator" | "email" =
        twoStepMethod === "authenticator" || (twoStepMethod === "smart" && Boolean(userTotpSecret))
          ? "authenticator"
          : "email";

      // Honor trusted-device cookie when frequency is once_per_day / once_per_7_days / once_per_30_days
      // (Never skips first-time QR enrollment because currentTotpEnabledAt is null when unpaired)
      const trustCookie = extractCookieValue(req.headers.cookie, TWO_STEP_TRUST_COOKIE_NAME);
      const isTrustedDevice = verifyTwoStepTrustToken(
        trustCookie,
        {
          userId: String(matchedRow.id),
          requiredMethod: requiredMethodForTrust,
          currentTotpEnabledAt: userTotpEntry?.enabledAt ?? null,
          frequency: twoStepFrequency,
        },
        SESSION_SECRET
      );
      if (isTrustedDevice) {
        const token = issueSessionForUser(safeUser);
        setSessionCookie(res, token);
        return res.json({ success: true, user: safeUser, token, twoStepTrustedDevice: true });
      }

      if (twoStepMethod !== "email" && userTotpSecret) {
        const challengeId = crypto.randomBytes(20).toString("hex");
        loginOtpChallenges.set(challengeId, {
          method: "authenticator",
          userId: String(matchedRow.id),
          username: safeUser.username,
          fullName: safeUser.fullName,
          email: "",
          otpHash: "",
          expiresAt: Date.now() + LOGIN_OTP_TTL_MS,
          attempts: 0,
        });
        return res.json({
          success: true,
          requiresTwoStep: true,
          twoStepMethod: "authenticator",
          challengeId,
          expiresInSeconds: Math.floor(LOGIN_OTP_TTL_MS / 1000),
          message: "Open Google Authenticator and enter the 6-digit code.",
        });
      }

      if (twoStepMethod === "authenticator") {
        const pendingSecret = generateTotpSecret();
        const issuer = (twoStepCompanyName || "Ratauli SACCOS").slice(0, 40);
        const otpAuthUri = buildOtpAuthUri({
          secret: pendingSecret,
          accountName: safeUser.username,
          issuer,
        });
        const qrDataUrl = await generateQrDataUrl(otpAuthUri);
        const challengeId = crypto.randomBytes(20).toString("hex");
        loginOtpChallenges.set(challengeId, {
          method: "authenticator_setup",
          userId: String(matchedRow.id),
          username: safeUser.username,
          fullName: safeUser.fullName,
          email: "",
          otpHash: "",
          pendingTotpSecret: pendingSecret,
          expiresAt: Date.now() + LOGIN_TOTP_SETUP_TTL_MS,
          attempts: 0,
        });
        return res.json({
          success: true,
          requiresTwoStep: true,
          twoStepMethod: "authenticator_setup",
          challengeId,
          qrDataUrl,
          expiresInSeconds: Math.floor(LOGIN_TOTP_SETUP_TTL_MS / 1000),
          message: "One-time setup: Scan this QR code in Google Authenticator and enter the 6-digit code to sign in.",
        });
      }

      let recipientEmail =
        typeof matchedRow.email === "string" && matchedRow.email.includes("@") ? matchedRow.email.trim() : "";

      if (!recipientEmail) {
        try {
          const { data: emps } = await sb.from("employees").select("full_name, employee_code, email");
          const linked = (emps || []).find(
            (e) =>
              typeof e.email === "string" &&
              e.email.includes("@") &&
              (String(e.full_name || "").toLowerCase().trim() === String(matchedRow.full_name || "").toLowerCase().trim() ||
                String(e.employee_code || "").toLowerCase().trim() === String(matchedRow.username || "").toLowerCase().trim())
          );
          if (linked?.email) {
            recipientEmail = String(linked.email).trim();
          }
        } catch {
          // ignore
        }
      }

      if (!recipientEmail) {
        return res.status(400).json({
          success: false,
          message:
            "2-Step Login is enabled, but no email address is registered for your account. Please ask your Super Admin to add your email.",
        });
      }

      const smtp = createServerSmtpTransporter(twoStepCompanyName);
      if (!smtp) {
        return res.status(503).json({
          success: false,
          message: "2-Step Login is enabled, but server email (SMTP_USER / SMTP_PASS) is not configured.",
        });
      }

      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const challengeId = crypto.randomBytes(20).toString("hex");
      loginOtpChallenges.set(challengeId, {
        method: "email",
        userId: String(matchedRow.id),
        username: safeUser.username,
        fullName: safeUser.fullName,
        email: recipientEmail,
        otpHash: sha256Hex(`${matchedRow.id}:${otpCode}`),
        expiresAt: Date.now() + LOGIN_OTP_TTL_MS,
        attempts: 0,
      });

      const logoAttachment = await getLogoAttachment(twoStepLogoUrl);
      const safeCompany = escapeHtml(twoStepCompanyName);
      const safeAddress = escapeHtml(twoStepCompanyAddress);
      const safeDisplayName = escapeHtml(safeUser.fullName || safeUser.username);

      await smtp.transporter.sendMail({
        from: smtp.from,
        to: recipientEmail,
        subject: `Login Verification Code: ${otpCode} - ${twoStepCompanyName}`,
        text: `Hello ${safeUser.fullName || safeUser.username},\n\nYour 2-Step Login verification code is: ${otpCode}\n\nThis code is valid for 5 minutes. If you did not try to sign in, please change your password immediately.\n\n${twoStepCompanyName}\n${twoStepCompanyAddress}`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden;">
            <div style="background: #065f46; padding: 22px 26px; color: #ffffff;">
              <div style="font-size: 16px; font-weight: 900; text-transform: uppercase;">${safeCompany}</div>
              <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">${safeAddress}</div>
            </div>
            <div style="padding: 30px 26px; text-align: center; color: #1e293b;">
              <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #0f172a;">2-Step Login Verification Code</h3>
              <p style="margin: 0 0 22px 0; font-size: 14px; color: #475569;">Hello <strong>${safeDisplayName}</strong>, enter this 6-digit code to complete your sign-in:</p>
              <div style="background: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 18px; margin: 0 auto 22px auto; max-width: 260px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #047857; display: block;">${otpCode}</span>
              </div>
              <p style="margin: 0; font-size: 12px; color: #64748b;">Valid for 5 minutes. Never share this code with anyone.</p>
            </div>
          </div>
        `,
        attachments: [logoAttachment],
      });

      return res.json({
        success: true,
        requiresTwoStep: true,
        twoStepMethod: "email",
        challengeId,
        maskedEmail: maskEmailAddress(recipientEmail),
        expiresInSeconds: Math.floor(LOGIN_OTP_TTL_MS / 1000),
        message: "A 6-digit verification code has been sent to your registered email.",
      });
    }

    const token = issueSessionForUser(safeUser);
    setSessionCookie(res, token);
    return res.json({ success: true, user: safeUser, token });
  } catch (err: unknown) {
    console.error("Server login error:", err);
    return res.status(500).json({ success: false, message: "Could not complete login. Please try again." });
  }
});

app.post("/api/auth/verify-login-otp", async (req, res) => {
  try {
    pruneOtpChallenges();
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(`login-otp-verify:${clientIp}`, 15, 10 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: "Too many verification attempts. Please wait 10 minutes and try again.",
      });
    }

    const { challengeId, otpCode } = req.body || {};
    if (typeof challengeId !== "string" || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: "Verification session expired. Please sign in again." });
    }

    const challenge = loginOtpChallenges.get(challengeId.trim());
    if (!challenge || challenge.expiresAt <= Date.now()) {
      loginOtpChallenges.delete(challengeId.trim());
      return res.status(400).json({ success: false, message: "Verification code expired. Please sign in again." });
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      loginOtpChallenges.delete(challengeId.trim());
      return res.status(429).json({
        success: false,
        message: "Too many incorrect codes entered. Please sign in again to get a new code.",
      });
    }

    const sb = getServerSupabase();
    if (!sb) {
      return res.status(503).json({ success: false, message: "Authentication database is not configured." });
    }

    const cleanOtp = typeof otpCode === "string" ? otpCode.replace(/\D/g, "").trim() : "";
    let codeValid = false;
    if (challenge.method === "authenticator_setup") {
      codeValid = Boolean(
        challenge.pendingTotpSecret && verifyTotpCode(challenge.pendingTotpSecret, cleanOtp, 1)
      );
    } else if (challenge.method === "authenticator") {
      const secret = await getUserTotpSecret(sb, challenge.userId, SESSION_SECRET);
      codeValid = Boolean(secret && verifyTotpCode(secret, cleanOtp, 1));
    } else {
      const providedHash = sha256Hex(`${challenge.userId}:${cleanOtp}`);
      const expectedBuf = Buffer.from(challenge.otpHash, "hex");
      const providedBuf = Buffer.from(providedHash, "hex");
      codeValid = expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);
    }

    if (!codeValid) {
      challenge.attempts += 1;
      return res.status(401).json({
        success: false,
        message:
          challenge.method === "authenticator_setup"
            ? "Invalid 6-digit code. Make sure your phone clock is set to automatic and enter the latest code from Google Authenticator."
            : challenge.method === "authenticator"
            ? "Invalid 6-digit Google Authenticator code. Please check the current code in your app."
            : "Invalid verification code. Please check your email.",
      });
    }

    let totpJustEnrolled = false;
    let enrolledTotpAt: number | null = null;
    if (challenge.method === "authenticator_setup" && challenge.pendingTotpSecret) {
      const existingEntry = await getUserTotpEntry(sb, challenge.userId);
      if (existingEntry) {
        loginOtpChallenges.delete(challengeId.trim());
        return res.status(409).json({
          success: false,
          message: "Google Authenticator is already set up for this account. Please sign in again and enter your 6-digit code.",
        });
      }
      enrolledTotpAt = await setUserTotpSecret(
        sb,
        challenge.userId,
        challenge.username,
        challenge.pendingTotpSecret,
        SESSION_SECRET
      );
      totpJustEnrolled = true;
    } else if (challenge.method === "authenticator") {
      const currentEntry = await getUserTotpEntry(sb, challenge.userId).catch(() => null);
      enrolledTotpAt = currentEntry?.enabledAt ?? null;
    }

    loginOtpChallenges.delete(challengeId.trim());

    const { data: userRow, error } = await sb.from("users").select("*").eq("id", challenge.userId).maybeSingle();
    if (error || !userRow) {
      return res.status(404).json({ success: false, message: "User account no longer exists." });
    }
    if (userRow.status === "Inactive") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact the administrator.",
      });
    }

    const safeUser = mapDbUserRowToClientUser(userRow);
    if (!safeUser.branchId || !safeUser.designation) {
      try {
        const { data: emps } = await sb.from("employees").select("full_name, email, employee_code, branch_id, designation");
        if (Array.isArray(emps)) {
          const linked = emps.find((e) => {
            const empName = String(e.full_name || "").toLowerCase().trim();
            const uName = safeUser.fullName.toLowerCase().trim();
            const empEmail = String(e.email || "").toLowerCase().trim();
            const uEmail = (safeUser.email || "").toLowerCase().trim();
            const empCode = String(e.employee_code || "").toLowerCase().trim();
            const uUsername = safeUser.username.toLowerCase().trim();
            return (
              (empName !== "" && empName === uName) ||
              (empEmail !== "" && uEmail !== "" && empEmail === uEmail) ||
              (empCode !== "" && empCode === uUsername)
            );
          });
          if (linked) {
            if (!safeUser.branchId && linked.branch_id) safeUser.branchId = String(linked.branch_id);
            if (!safeUser.designation && linked.designation) safeUser.designation = String(linked.designation);
          }
        }
      } catch {
        // Non-blocking enrichment
      }
    }

    const token = issueSessionForUser(safeUser);
    setSessionCookie(res, token);

    // Issue or clear trusted-device 2FA cookie according to configured frequency
    try {
      const { data: settingsRow } = await sb.from("settings").select("data").eq("id", "global").maybeSingle();
      const sData =
        settingsRow && settingsRow.data && typeof settingsRow.data === "object"
          ? (settingsRow.data as Record<string, unknown>)
          : null;
      const freq = normalizeTwoStepFrequency(sData?.twoStepFrequency);
      const trustMethod: "authenticator" | "email" =
        challenge.method === "email" ? "email" : "authenticator";
      const trustToken = signTwoStepTrustToken(
        {
          userId: challenge.userId,
          method: trustMethod,
          totpEnabledAt: enrolledTotpAt,
          frequency: freq,
        },
        SESSION_SECRET
      );
      const trustHeader = buildTwoStepTrustCookieHeader(
        trustToken,
        getTrustMaxAgeSeconds(freq),
        isRequestHttps(req)
      );
      appendSetCookie(res, trustHeader);
    } catch {
      // Non-blocking trusted-device cookie update
    }

    return res.json({ success: true, user: safeUser, token, totpJustEnrolled });
  } catch (err: unknown) {
    console.error("Verify login OTP error:", err);
    return res.status(500).json({ success: false, message: "Could not verify login code. Please try again." });
  }
});

app.post("/api/auth/resend-login-otp", async (req, res) => {
  try {
    pruneOtpChallenges();
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(`login-otp-resend:${clientIp}`, 5, 10 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: "Too many resend requests. Please wait a few minutes and try again.",
      });
    }

    const { challengeId } = req.body || {};
    if (typeof challengeId !== "string" || !challengeId.trim()) {
      return res.status(400).json({ success: false, message: "Verification session expired. Please sign in again." });
    }

    const challenge = loginOtpChallenges.get(challengeId.trim());
    if (!challenge || challenge.expiresAt <= Date.now()) {
      loginOtpChallenges.delete(challengeId.trim());
      return res.status(400).json({ success: false, message: "Verification session expired. Please sign in again." });
    }
    if (challenge.method !== "email") {
      return res.status(400).json({ success: false, message: "Email resend is only available for Email OTP login." });
    }

    const sb = getServerSupabase();
    let companyName = "Ratauli Saving and Credit Cooperative Ltd";
    let companyAddress = "Pipra Rural Municipality -6 (Mahottari)";
    let logoUrl = "";
    if (sb) {
      try {
        const { data: settingsRow } = await sb.from("settings").select("data").eq("id", "global").maybeSingle();
        const sData =
          settingsRow && settingsRow.data && typeof settingsRow.data === "object"
            ? (settingsRow.data as Record<string, unknown>)
            : null;
        if (sData) {
          if (typeof sData.systemName === "string" && sData.systemName.trim()) companyName = sData.systemName.trim();
          if (typeof sData.address === "string" && sData.address.trim()) companyAddress = sData.address.trim();
          if (typeof sData.logoUrl === "string" && sData.logoUrl.trim()) logoUrl = sData.logoUrl.trim();
        }
      } catch {
        // ignore
      }
    }

    const smtp = createServerSmtpTransporter(companyName);
    if (!smtp) {
      return res.status(503).json({ success: false, message: "Server email service is not configured." });
    }

    const newOtp = crypto.randomInt(100000, 1000000).toString();
    challenge.otpHash = sha256Hex(`${challenge.userId}:${newOtp}`);
    challenge.expiresAt = Date.now() + LOGIN_OTP_TTL_MS;
    challenge.attempts = 0;

    const logoAttachment = await getLogoAttachment(logoUrl);
    await smtp.transporter.sendMail({
      from: smtp.from,
      to: challenge.email,
      subject: `New Login Verification Code: ${newOtp} - ${companyName}`,
      text: `Hello ${challenge.fullName || challenge.username},\n\nYour new 2-Step Login verification code is: ${newOtp}\n\nThis code is valid for 5 minutes.\n\n${companyName}\n${companyAddress}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden;">
          <div style="background: #065f46; padding: 22px 26px; color: #ffffff;">
            <div style="font-size: 16px; font-weight: 900; text-transform: uppercase;">${escapeHtml(companyName)}</div>
            <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">${escapeHtml(companyAddress)}</div>
          </div>
          <div style="padding: 30px 26px; text-align: center; color: #1e293b;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #0f172a;">New 2-Step Login Verification Code</h3>
            <p style="margin: 0 0 22px 0; font-size: 14px; color: #475569;">Hello <strong>${escapeHtml(challenge.fullName || challenge.username)}</strong>, enter this 6-digit code to complete your sign-in:</p>
            <div style="background: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 18px; margin: 0 auto 22px auto; max-width: 260px;">
              <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #047857; display: block;">${newOtp}</span>
            </div>
            <p style="margin: 0; font-size: 12px; color: #64748b;">Valid for 5 minutes. Never share this code with anyone.</p>
          </div>
        </div>
      `,
      attachments: [logoAttachment],
    });

    return res.json({
      success: true,
      challengeId: challengeId.trim(),
      maskedEmail: maskEmailAddress(challenge.email),
      expiresInSeconds: Math.floor(LOGIN_OTP_TTL_MS / 1000),
      message: "A new verification code has been sent to your registered email.",
    });
  } catch (err: unknown) {
    console.error("Resend login OTP error:", err);
    return res.status(500).json({ success: false, message: "Could not resend verification code." });
  }
});

// ==========================================
// GOOGLE AUTHENTICATOR (TOTP RFC 6238) ROUTES
// ==========================================
app.get("/api/auth/totp-status", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser!;
    const sb = getServerSupabase();
    if (!sb) return res.status(503).json({ success: false, message: "Database service unavailable." });
    const entry = await getUserTotpEntry(sb, authUser.sub);
    return res.json({
      success: true,
      enabled: Boolean(entry),
      enabledAt: entry?.enabledAt ?? null,
    });
  } catch (err) {
    console.error("TOTP status error:", err);
    return res.status(500).json({ success: false, message: "Could not read Authenticator status." });
  }
});

app.get("/api/auth/totp-enrolled-list", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser!;
    const liveAuthz = await resolveLiveUserAuthz(authUser);
    if (!liveAuthz.active || (!liveAuthz.isAdmin && !liveAuthz.permissions.has("manage_users"))) {
      return res.status(403).json({ success: false, message: "Administrator privileges are required." });
    }
    const sb = getServerSupabase();
    if (!sb) return res.status(503).json({ success: false, message: "Database service unavailable." });
    const userIds = await getTotpEnrolledUserIds(sb);
    return res.json({ success: true, userIds, enrolledUserIds: userIds });
  } catch (err) {
    console.error("TOTP enrolled list error:", err);
    return res.status(500).json({ success: false, message: "Could not read Authenticator enrollment list." });
  }
});

app.post("/api/auth/totp-setup", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser!;
    const sb = getServerSupabase();
    let issuer = "Ratauli SACCOS";
    if (sb) {
      try {
        const { data: settingsRow } = await sb.from("settings").select("data").eq("id", "global").maybeSingle();
        const sName = (settingsRow?.data as Record<string, unknown> | null)?.systemName;
        if (typeof sName === "string" && sName.trim()) {
          issuer = sName.trim().slice(0, 40);
        }
      } catch {
        // default issuer
      }
    }
    const secret = generateTotpSecret();
    const uri = buildOtpAuthUri({ secret, accountName: authUser.username, issuer });
    const qrDataUrl = await generateQrDataUrl(uri);
    const setupToken = signTotpSetupToken(
      { userId: authUser.sub, username: authUser.username, plainSecret: secret },
      SESSION_SECRET
    );
    return res.json({
      success: true,
      qrDataUrl,
      manualKey: secret,
      setupToken,
    });
  } catch (err) {
    console.error("TOTP setup error:", err);
    return res.status(500).json({ success: false, message: "Could not initialize Google Authenticator setup." });
  }
});

app.post("/api/auth/totp-enable", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser!;
    const { setupToken, code } = req.body || {};
    const pending = verifyTotpSetupToken(String(setupToken || ""), SESSION_SECRET);
    if (!pending || pending.userId !== authUser.sub) {
      return res.status(400).json({ success: false, message: "Setup session expired. Please generate a new QR code." });
    }
    if (!verifyTotpCode(pending.plainSecret, String(code || ""), 1)) {
      return res.status(400).json({
        success: false,
        message: "Invalid 6-digit code. Make sure your phone clock is set to automatic and enter the latest code.",
      });
    }
    const sb = getServerSupabase();
    if (!sb) return res.status(503).json({ success: false, message: "Database service unavailable." });
    const enabledAt = await setUserTotpSecret(sb, authUser.sub, authUser.username, pending.plainSecret, SESSION_SECRET);
    return res.json({ success: true, enabled: true, enabledAt, message: "Google Authenticator activated." });
  } catch (err) {
    console.error("TOTP enable error:", err);
    return res.status(500).json({ success: false, message: "Could not activate Google Authenticator." });
  }
});

app.post("/api/auth/totp-disable", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser!;
    const { verification } = req.body || {};
    const input = typeof verification === "string" ? verification.trim() : "";
    if (!input) {
      return res.status(400).json({ success: false, message: "Current 6-digit code or password is required." });
    }
    const sb = getServerSupabase();
    if (!sb) return res.status(503).json({ success: false, message: "Database service unavailable." });

    const existingSecret = await getUserTotpSecret(sb, authUser.sub, SESSION_SECRET);
    let verified = Boolean(existingSecret && verifyTotpCode(existingSecret, input, 1));
    if (!verified) {
      const { data: userRow } = await sb.from("users").select("password").eq("id", authUser.sub).maybeSingle();
      if (userRow && typeof userRow.password === "string" && verifyPassword(input, userRow.password).valid) {
        verified = true;
      }
    }
    if (!verified) {
      return res.status(401).json({ success: false, message: "Incorrect Authenticator code or password." });
    }
    await deleteUserTotpSecret(sb, authUser.sub);
    return res.json({ success: true, enabled: false, message: "Google Authenticator unlinked." });
  } catch (err) {
    console.error("TOTP disable error:", err);
    return res.status(500).json({ success: false, message: "Could not unlink Google Authenticator." });
  }
});

app.post("/api/auth/totp-admin-reset", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser!;
    const liveAuthz = await resolveLiveUserAuthz(authUser);
    if (!liveAuthz.active || (!liveAuthz.isAdmin && !liveAuthz.permissions.has("manage_users"))) {
      return res.status(403).json({ success: false, message: "Administrator privileges are required to reset user 2FA." });
    }
    const targetUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "Target user ID is required." });
    }
    const sb = getServerSupabase();
    if (!sb) return res.status(503).json({ success: false, message: "Database service unavailable." });
    await deleteUserTotpSecret(sb, targetUserId);
    return res.json({ success: true, message: "Google Authenticator has been reset for this user." });
  } catch (err) {
    console.error("TOTP admin reset error:", err);
    return res.status(500).json({ success: false, message: "Could not reset Google Authenticator." });
  }
});

app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const sb = getServerSupabase();
    if (sb && authUser.sub !== "admin-bootstrap") {
      const { data: row, error } = await sb
        .from("users")
        .select("*")
        .eq("id", authUser.sub)
        .maybeSingle();
      if (!error && row) {
        if (row.status === "Inactive") {
          clearSessionCookie(res);
          return res.status(401).json({ success: false, message: "Account is inactive." });
        }
        return res.json({
          success: true,
          session: authUser,
          user: mapDbUserRowToClientUser(row as Record<string, unknown>),
        });
      }
    }
    return res.json({ success: true, session: authUser });
  } catch (err: unknown) {
    console.error("Auth me lookup error:", err);
    return res.json({ success: true, session: req.authUser });
  }
});

app.post("/api/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || !currentPassword) {
      return res.status(400).json({ success: false, message: "Current password is required." });
    }
    if (typeof newPassword !== "string" || !newPassword) {
      return res.status(400).json({ success: false, message: "New password is required." });
    }

    const strengthError = validateStrongPasswordServer(newPassword);
    if (strengthError) {
      return res.status(400).json({ success: false, message: strengthError });
    }

    const sb = getServerSupabase();
    if (!sb) {
      return res.status(503).json({ success: false, message: "Database service unavailable." });
    }

    const { data: userRow, error: fetchErr } = await sb
      .from("users")
      .select("*")
      .eq("id", authUser.sub)
      .maybeSingle();

    if (fetchErr || !userRow) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    const storedPassword = typeof userRow.password === "string" ? userRow.password : "";
    const verification = verifyPassword(currentPassword, storedPassword);
    if (!verification.valid) {
      return res.status(400).json({ success: false, message: "हालको पासवर्ड गलत छ (Incorrect current password)." });
    }

    const updatedAt = Date.now();
    const hashed = hashPassword(newPassword);
    const { error: updateErr } = await sb
      .from("users")
      .update({
        password: hashed,
        password_updated_at: updatedAt,
        force_password_change: false,
      })
      .eq("id", authUser.sub);

    if (updateErr) {
      return res.status(500).json({ success: false, message: "Could not update password. Please try again." });
    }

    const safeUser = mapDbUserRowToClientUser({
      ...(userRow as Record<string, unknown>),
      password_updated_at: updatedAt,
      force_password_change: false,
    });
    return res.json({ success: true, user: safeUser, message: "Password updated successfully." });
  } catch (err: unknown) {
    console.error("Change password error:", err);
    return res.status(500).json({ success: false, message: "Failed to change password." });
  }
});

app.post("/api/auth/logout", requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.authUser) {
    revokedTokens.set(req.authUser.jti, req.authUser.exp);
  }
  clearSessionCookie(res);
  return res.json({ success: true });
});

app.post("/api/auth/hash-password", requireAuth, (req: AuthenticatedRequest, res) => {
  const { password } = req.body || {};
  if (typeof password !== "string" || !password) {
    return res.status(400).json({ success: false, message: "Password is required." });
  }
  if (isPasswordHashed(password)) {
    return res.json({ success: true, hash: password });
  }
  return res.json({ success: true, hash: hashPassword(password) });
});

// Server-side Forgot Password OTP Request (generates & stores OTP strictly on server)
app.post("/api/auth/request-otp", async (req, res) => {
  try {
    pruneOtpChallenges();
    const { identifier, companyName, companyAddress, logoUrl } = req.body || {};
    const target = typeof identifier === "string" ? identifier.trim().toLowerCase() : "";

    if (!target) {
      return res.status(400).json({ success: false, message: "Please enter your username or email address." });
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(`otp:${clientIp}:${target}`, 5, 10 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: "Too many verification code requests. Please wait 10 minutes before trying again.",
      });
    }

    const sb = getServerSupabase();
    if (!sb) {
      return res.status(503).json({ success: false, message: "Database service unavailable." });
    }

    const { data: users, error } = await sb.from("users").select("id, username, full_name, email, mobile, status");
    if (error || !Array.isArray(users)) {
      return res.status(500).json({ success: false, message: "Could not process password recovery request." });
    }

    const matchedUser = users.find(
      (u) =>
        (typeof u.username === "string" && u.username.toLowerCase() === target) ||
        (typeof u.email === "string" && u.email.toLowerCase() === target) ||
        (typeof u.mobile === "string" && u.mobile.trim() === target)
    );

    if (!matchedUser) {
      return res.status(404).json({ success: false, message: "User not found in system. Please verify your username." });
    }

    if (matchedUser.status === "Inactive") {
      return res.status(403).json({ success: false, message: "This account is inactive. Please contact the administrator." });
    }

    let recipientEmail =
      typeof matchedUser.email === "string" && matchedUser.email.includes("@") ? matchedUser.email.trim() : "";

    if (!recipientEmail) {
      const { data: emps } = await sb.from("employees").select("full_name, employee_code, email");
      const linked = (emps || []).find(
        (e) =>
          typeof e.email === "string" &&
          e.email.includes("@") &&
          (String(e.full_name || "").toLowerCase().trim() === String(matchedUser.full_name || "").toLowerCase().trim() ||
            String(e.employee_code || "").toLowerCase().trim() === String(matchedUser.username || "").toLowerCase().trim())
      );
      if (linked?.email) {
        recipientEmail = String(linked.email).trim();
      }
    }

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: "No email address is registered for this account. Please contact your administrator.",
      });
    }

    const smtp = createServerSmtpTransporter(companyName);
    if (!smtp) {
      return res.status(503).json({
        success: false,
        message: "Server email service (SMTP_USER / SMTP_PASS) is not configured.",
      });
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const challengeId = crypto.randomBytes(16).toString("hex");
    otpChallenges.set(challengeId, {
      userId: String(matchedUser.id),
      username: String(matchedUser.username),
      email: recipientEmail,
      otpHash: sha256Hex(otpCode),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    const effectiveCompanyName = String(companyName || "Ratauli Saving and Credit Cooperative Ltd");
    const effectiveAddress = String(companyAddress || "Pipra Rural Municipality -6 (Mahottari)");
    const displayUser = String(matchedUser.full_name || matchedUser.username || "User");
    const logoAttachment = await getLogoAttachment(logoUrl);

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <div style="background: #065f46; padding: 24px 26px 20px 26px; border-radius: 18px 18px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 58px; vertical-align: middle; padding-right: 14px;">
                <div style="width: 52px; height: 52px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; line-height: 1.25;">
                  ${escapeHtml(effectiveCompanyName)}
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 14px;">
                <div style="font-size: 13.5px; color: #ffffff; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 10px;">
                  ${escapeHtml(effectiveAddress)}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px 26px; text-align: center; color: #1e293b;">
          <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Password Reset Verification Code</h3>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.5;">
            Hello <strong>${escapeHtml(displayUser)}</strong>, you have requested to reset your account password. Use the 6-digit verification code below to proceed:
          </p>
          <div style="background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 18px; margin: 0 auto 24px auto; max-width: 260px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #047857; display: block;">${escapeHtml(otpCode)}</span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">If you did not request this, please ignore this email or contact support immediately.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${escapeHtml(effectiveCompanyName)}. All rights reserved.
        </div>
      </div>
    `;

    await smtp.transporter.sendMail({
      from: smtp.from,
      to: recipientEmail,
      subject: `Your Verification Code - ${effectiveCompanyName}`,
      text: `Hello ${displayUser},\n\nYour password reset verification code is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\n${effectiveCompanyName}\n${effectiveAddress}`,
      html: emailHtml,
      attachments: [logoAttachment],
    });

    return res.json({
      success: true,
      challengeId,
      username: matchedUser.username,
      maskedEmail: maskEmailAddress(recipientEmail),
      message: `A 6-digit verification code has been dispatched to ${maskEmailAddress(recipientEmail)}.`,
    });
  } catch (error: unknown) {
    console.error("Request OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification code. Please verify SMTP settings on the server.",
    });
  }
});

// Server-side OTP Verification & Password Reset
app.post("/api/auth/verify-otp-reset", async (req, res) => {
  try {
    pruneOtpChallenges();
    const { challengeId, otpCode, resetToken, newPassword, verifyOnly } = req.body || {};

    if (typeof challengeId !== "string" || !otpChallenges.has(challengeId)) {
      return res.status(400).json({ success: false, message: "Verification session expired. Please request a new code." });
    }

    const challenge = otpChallenges.get(challengeId)!;
    const now = Date.now();

    if (verifyOnly) {
      if (challenge.expiresAt <= now) {
        otpChallenges.delete(challengeId);
        return res.status(400).json({ success: false, message: "Verification code has expired. Please request a new code." });
      }
      if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
        otpChallenges.delete(challengeId);
        return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please request a new code." });
      }
      const entered = typeof otpCode === "string" ? otpCode.trim() : "";
      const hashA = Buffer.from(sha256Hex(entered), "hex");
      const hashB = Buffer.from(challenge.otpHash, "hex");
      if (entered.length !== 6 || !crypto.timingSafeEqual(hashA, hashB)) {
        challenge.attempts += 1;
        return res.status(400).json({ success: false, message: "The entered 6-digit verification code is incorrect." });
      }

      const issuedResetToken = crypto.randomBytes(24).toString("hex");
      challenge.resetTokenHash = sha256Hex(issuedResetToken);
      challenge.resetExpiresAt = now + 10 * 60 * 1000;
      return res.json({ success: true, resetToken: issuedResetToken, username: challenge.username });
    }

    // Complete password reset using either verified resetToken or otpCode
    let authorized = false;
    if (typeof resetToken === "string" && resetToken && challenge.resetTokenHash && (challenge.resetExpiresAt || 0) > now) {
      const a = Buffer.from(sha256Hex(resetToken), "hex");
      const b = Buffer.from(challenge.resetTokenHash, "hex");
      authorized = a.length === b.length && crypto.timingSafeEqual(a, b);
    } else if (typeof otpCode === "string" && otpCode.trim().length === 6 && challenge.expiresAt > now && challenge.attempts < MAX_OTP_ATTEMPTS) {
      const a = Buffer.from(sha256Hex(otpCode.trim()), "hex");
      const b = Buffer.from(challenge.otpHash, "hex");
      if (crypto.timingSafeEqual(a, b)) {
        authorized = true;
      } else {
        challenge.attempts += 1;
      }
    }

    if (!authorized) {
      return res.status(401).json({ success: false, message: "Invalid or expired verification code." });
    }

    const pwErr = validateStrongPasswordServer(String(newPassword || ""));
    if (pwErr) {
      return res.status(400).json({ success: false, message: pwErr });
    }

    const sb = getServerSupabase();
    if (!sb) {
      return res.status(503).json({ success: false, message: "Database service unavailable." });
    }

    const hashedPassword = hashPassword(String(newPassword));
    const { error: updateErr } = await sb
      .from("users")
      .update({
        password: hashedPassword,
        password_updated_at: Date.now(),
        force_password_change: false,
      })
      .eq("id", challenge.userId);

    if (updateErr) {
      // Retry without optional columns if schema differs
      const { error: fbErr } = await sb
        .from("users")
        .update({ password: hashedPassword })
        .eq("id", challenge.userId);
      if (fbErr) {
        return res.status(500).json({ success: false, message: "Failed to update password in database." });
      }
    }

    // Consume challenge so it can never be reused
    otpChallenges.delete(challengeId);
    return res.json({
      success: true,
      username: challenge.username,
      message: "Password reset successfully.",
    });
  } catch (err: unknown) {
    console.error("Verify OTP reset error:", err);
    return res.status(500).json({ success: false, message: "Failed to reset password." });
  }
});

// ==========================================
// PROTECTED ROUTES (REQUIRE VALID SESSION)
// ==========================================

// API Route: Upload & Save System Logo to Disk (Admin Only + Image Magic Byte Validation)
app.post("/api/upload-logo", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ success: false, message: "imageBase64 is required" });
    }
    const trimmed = imageBase64.trim();
    const commaIndex = trimmed.indexOf(",");
    const cleanBase64 = commaIndex !== -1 ? trimmed.substring(commaIndex + 1).trim() : trimmed;
    const buffer = Buffer.from(cleanBase64, "base64");

    if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) {
      return res.status(400).json({ success: false, message: "Logo file must be a valid image under 5MB." });
    }

    const detected = detectImageMagic(buffer);
    if (!detected) {
      return res.status(400).json({ success: false, message: "Only PNG, JPEG, GIF, or WEBP image files are permitted." });
    }

    const publicPath = path.resolve(process.cwd(), "public", "system_logo.png");
    fs.writeFileSync(publicPath, buffer);

    const distFolder = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distFolder)) {
      try {
        fs.writeFileSync(path.resolve(distFolder, "system_logo.png"), buffer);
      } catch (e) {
        console.warn("Dist logo write error:", e);
      }
    }

    const logoUrl = `/system_logo.png?v=${Date.now()}`;
    return res.json({ success: true, logoUrl });
  } catch (err: unknown) {
    console.error("Failed to upload logo:", err);
    return res.status(500).json({ success: false, message: "Failed to save logo" });
  }
});

// Legacy OTP email route locked behind auth (Forgot Password uses /api/auth/request-otp)
app.post("/api/send-otp-email", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { to, username, otpCode, companyName, companyAddress, logoUrl } = req.body || {};

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }
    if (!otpCode) {
      return res.status(400).json({ success: false, message: "OTP code is required." });
    }

    const effectiveCompanyName = String(companyName || "Ratauli Saving and Credit Cooperative Ltd");
    const effectiveAddress = String(companyAddress || "Pipra Rural Municipality -6 (Mahottari)");

    const smtp = createServerSmtpTransporter(effectiveCompanyName);
    if (!smtp) {
      return res.status(503).json({
        success: false,
        requiresConfig: true,
        message: "Server SMTP credentials (SMTP_USER / SMTP_PASS) are not configured.",
      });
    }

    const logoAttachment = await getLogoAttachment(logoUrl);
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <div style="background: #065f46; padding: 24px 26px 20px 26px; border-radius: 18px 18px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 58px; vertical-align: middle; padding-right: 14px;">
                <div style="width: 52px; height: 52px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; line-height: 1.25;">
                  ${escapeHtml(effectiveCompanyName)}
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 14px;">
                <div style="font-size: 13.5px; color: #ffffff; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 10px;">
                  ${escapeHtml(effectiveAddress)}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px 26px; text-align: center; color: #1e293b;">
          <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Password Reset Verification Code</h3>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.5;">
            Hello <strong>${escapeHtml(username || "User")}</strong>, use the 6-digit verification code below to proceed:
          </p>
          <div style="background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 18px; margin: 0 auto 24px auto; max-width: 260px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #047857; display: block;">${escapeHtml(otpCode)}</span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${escapeHtml(effectiveCompanyName)}. All rights reserved.
        </div>
      </div>
    `;

    const info = await smtp.transporter.sendMail({
      from: smtp.from,
      to: to.trim(),
      subject: `Your Verification Code - ${effectiveCompanyName}`,
      text: `Hello ${username || "User"},\n\nYour verification code is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\n${effectiveCompanyName}\n${effectiveAddress}`,
      html: emailHtml,
      attachments: [logoAttachment],
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Verification code successfully sent to ${to.trim()}`,
    });
  } catch (error: unknown) {
    console.error("OTP Email send error:", error);
    return res.status(500).json({ success: false, message: "Failed to send verification email." });
  }
});

// API Route: Send Password Reset Notification Email with Credentials (Admin Only)
app.post("/api/send-password-reset-email", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { to, userName, username, password, loginUrl, companyName, companyAddress, logoUrl } = req.body || {};

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required." });
    }

    const effectiveCompanyName = String(companyName || "Ratauli Saving and Credit Cooperative Ltd");
    const effectiveAddress = String(companyAddress || "Pipra Rural Municipality -6 (Mahottari)");
    const effectiveLoginUrl = sanitizeHttpUrl(loginUrl || process.env.VITE_APP_URL);
    const effectiveUserName = String(userName || username || "User");
    const effectiveUsername = String(username || "user");

    const smtp = createServerSmtpTransporter(effectiveCompanyName);
    if (!smtp) {
      return res.status(503).json({
        success: false,
        requiresConfig: true,
        message: "Server SMTP credentials (SMTP_USER / SMTP_PASS) are not configured.",
      });
    }

    const logoAttachment = await getLogoAttachment(logoUrl);

    const plainText = `Dear ${effectiveUserName},

Your password has been reset successfully.

Username: ${effectiveUsername}
Password: ${password}
Login: ${effectiveLoginUrl}

Please keep your credentials secure and change your password after logging in.

If you did not request this change, please contact the administrator.

Regards,
${effectiveCompanyName}
${effectiveAddress}`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <div style="background: #065f46; padding: 24px 26px 20px 26px; border-radius: 18px 18px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 58px; vertical-align: middle; padding-right: 14px;">
                <div style="width: 52px; height: 52px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; line-height: 1.25;">
                  ${escapeHtml(effectiveCompanyName)}
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 14px;">
                <div style="font-size: 13.5px; color: #ffffff; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 10px;">
                  ${escapeHtml(effectiveAddress)}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px 28px; color: #1e293b; line-height: 1.6; font-size: 14px;">
          <p style="margin: 0 0 16px 0;">Dear <strong>${escapeHtml(effectiveUserName)}</strong>,</p>
          <p style="margin: 0 0 20px 0; color: #334155;">Your password has been reset successfully.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00695c; border-radius: 12px; padding: 18px 20px; margin: 0 0 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 110px; font-weight: 600;">Username:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${escapeHtml(effectiveUsername)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Password:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #b45309; font-family: monospace; font-size: 15px; letter-spacing: 0.5px;">${escapeHtml(password)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Login:</td>
                <td style="padding: 6px 0;">
                  <a href="${escapeHtml(effectiveLoginUrl)}" style="color: #0284c7; text-decoration: underline; font-weight: 600;" target="_blank" rel="noopener noreferrer">${escapeHtml(effectiveLoginUrl)}</a>
                </td>
              </tr>
            </table>
          </div>
          <p style="margin: 0 0 12px 0; color: #475569; font-size: 13px;">
            Please keep your credentials secure and change your password after logging in.
          </p>
          <p style="margin: 0 0 24px 0; color: #64748b; font-size: 12.5px;">
            If you did not request this change, please contact the administrator.
          </p>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; color: #334155; font-size: 13px;">
            Regards,<br>
            <strong>${escapeHtml(effectiveCompanyName)}</strong><br>
            <span style="font-size: 12px; color: #64748b;">${escapeHtml(effectiveAddress)}</span>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 14px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${escapeHtml(effectiveCompanyName)}. All rights reserved.
        </div>
      </div>
    `;

    const info = await smtp.transporter.sendMail({
      from: smtp.from,
      to: to.trim(),
      subject: `Password Reset Successful - ${effectiveCompanyName}`,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment],
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Password reset credentials email sent successfully to ${to.trim()}`,
    });
  } catch (error: unknown) {
    console.error("Password reset email send error:", error);
    return res.status(500).json({ success: false, message: "Failed to send password reset email." });
  }
});

// API Route: Send Salary Pay Slip / Custom Email with Attachments
app.post("/api/send-pay-slip-email", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { to, subject, body, html, attachments: clientAttachments, pdfBase64, filename, logoUrl } = req.body || {};

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "कर्मचारीको ईमेल ठेगाना आवश्यक छ।" });
    }

    const smtp = createServerSmtpTransporter();
    if (!smtp) {
      return res.status(503).json({
        success: false,
        requiresConfig: true,
        message: "SMTP (ईमेल पठाउने) एकाउन्ट र पासवर्ड सर्भरको Environment Variables (SMTP_USER / SMTP_PASS) मा सेट गर्नुहोस्।",
      });
    }

    const attachments: nodemailer.SendMailOptions["attachments"] = [];

    if (logoUrl || (typeof html === "string" && html.includes("cid:cooplogo"))) {
      const logoAttachment = await getLogoAttachment(logoUrl);
      if (logoAttachment) {
        attachments.push(logoAttachment);
      }
    }

    if (clientAttachments && Array.isArray(clientAttachments)) {
      for (const att of clientAttachments.slice(0, 10)) {
        if (att && (att.dataUrl || att.content)) {
          const raw = String(att.dataUrl || att.content);
          const commaIndex = raw.indexOf(",");
          const cleanBase64 = commaIndex !== -1 ? raw.substring(commaIndex + 1).trim() : raw.trim();
          attachments.push({
            filename: String(att.filename || att.name || "attachment").replace(/[/\\]/g, "_"),
            content: Buffer.from(cleanBase64, "base64"),
            contentType: typeof att.type === "string" ? att.type : typeof att.contentType === "string" ? att.contentType : undefined,
          });
        }
      }
    }

    if (pdfBase64 && typeof pdfBase64 === "string") {
      const commaIndex = pdfBase64.indexOf(",");
      const cleanBase64 = commaIndex !== -1 ? pdfBase64.substring(commaIndex + 1).trim() : pdfBase64.trim();

      let safeFilename = String(filename || "Salary_Pay_Slip.pdf").replace(/[/\\]/g, "_");
      if (!safeFilename.toLowerCase().endsWith(".pdf")) {
        safeFilename += ".pdf";
      }

      attachments.push({
        filename: safeFilename,
        content: Buffer.from(cleanBase64, "base64"),
        contentType: "application/pdf",
      });
    }

    const info = await smtp.transporter.sendMail({
      from: smtp.from,
      to: to.trim(),
      subject: String(subject || "Salary Pay Slip - Ratauli Cooperative"),
      text: String(body || ""),
      html: typeof html === "string" && html.trim() ? html : escapeHtml(body || ""),
      attachments,
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `${to.trim()} मा इमेल सफल रूपमा पठाइयो!`,
    });
  } catch (error: unknown) {
    console.error("Email send error:", error);
    return res.status(500).json({ success: false, message: "ईमेल पठाउँदा समस्या आयो।" });
  }
});

// API Route: Send Real-Time Ledger Transaction Email Notification
app.post("/api/send-ledger-notification-email", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      to,
      recipientName,
      employeeCode,
      transactionType,
      amount,
      particular,
      dateBs,
      dateAd,
      branchName,
      tellerName,
      voucherId,
      previousBalance = 0,
      updatedBalance = 0,
      balanceType = "balanced",
      actionType = "create",
      oldAmount,
      oldParticular,
      companyName,
      companyAddress,
      logoUrl,
    } = req.body || {};

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Employee/account email address is required." });
    }

    const effectiveCompanyName = String(companyName || "Ratauli Saving and Credit Cooperative Ltd");
    const effectiveAddress = String(companyAddress || "Pipra Rural Municipality -6 (Mahottari)");
    const effectiveBranchName = String(branchName || "Main Branch");
    const effectiveRecipientName = String(recipientName || "Respected Member / Staff");
    const numAmount = Number(amount) || 0;
    const numPrevBalance = Number(previousBalance) || 0;
    const numUpdatedBalance = Number(updatedBalance) || 0;
    const isCredit = transactionType === "in";
    const baseTypeLabel = isCredit ? "CREDIT" : "DEBIT";

    let typeLabel = baseTypeLabel;
    let typeBadgeBg = isCredit ? "#dcfce7" : "#ffe4e6";
    let typeBadgeColor = isCredit ? "#15803d" : "#be123c";
    let typeBadgeBorder = isCredit ? "#86efac" : "#fecdd3";
    let typeDescription = isCredit ? "Amount credited to account" : "Amount debited from account";
    let pillLabel = "LEDGER TRANSACTION ALERT";
    let introText =
      "A new ledger transaction entry has been successfully recorded in your account. The transaction breakdown is as follows:";
    let amountHeading = "TRANSACTION AMOUNT";
    let emailSubject = `Transaction Alert: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;

    if (actionType === "edit") {
      pillLabel = "LEDGER TRANSACTION MODIFIED";
      typeLabel = `${baseTypeLabel} (UPDATED)`;
      introText =
        "A ledger transaction entry in your account has been edited and updated by the administration. The revised transaction details and updated account balance are as follows:";
      amountHeading = "UPDATED TRANSACTION AMOUNT";
      typeDescription = isCredit ? "Amount credited to account (Revised)" : "Amount debited from account (Revised)";
      emailSubject = `Transaction Updated: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;
    } else if (actionType === "delete") {
      pillLabel = "LEDGER TRANSACTION CANCELLED";
      typeLabel = `${baseTypeLabel} (CANCELLED)`;
      typeBadgeBg = "#fee2e2";
      typeBadgeColor = "#991b1b";
      typeBadgeBorder = "#fca5a5";
      introText =
        "A ledger transaction entry in your account has been cancelled / deleted by the administration. The reversed transaction details and your updated account balance are as follows:";
      amountHeading = "CANCELLED TRANSACTION AMOUNT";
      typeDescription = "Transaction reversed & cancelled from account";
      emailSubject = `Transaction Cancelled / Deleted: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;
    }

    let balanceStatusLabel = "";
    let balanceStatusNote = "";
    let balanceCardBg = "#f8fafc";
    let balanceCardBorder = "#e2e8f0";
    let balanceTextColor = "#0f172a";

    if (numUpdatedBalance > 0 || (numUpdatedBalance === 0 && balanceType === "receivable")) {
      balanceStatusLabel = "RECEIVABLE FROM SACCOS (CREDIT BALANCE)";
      balanceStatusNote = `Following this transaction, the total net balance receivable by you from the cooperative is Rs. ${numUpdatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      balanceCardBg = "#ecfdf5";
      balanceCardBorder = "#a7f3d0";
      balanceTextColor = "#065f46";
    } else if (numUpdatedBalance < 0 || (numUpdatedBalance === 0 && balanceType === "payable")) {
      balanceStatusLabel = "PAYABLE TO SACCOS (DEBIT DUE)";
      balanceStatusNote = `Following this transaction, the total net balance payable by you to the cooperative is Rs. ${Math.abs(numUpdatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      balanceCardBg = "#fff1f2";
      balanceCardBorder = "#fecdd3";
      balanceTextColor = "#9f1239";
    } else {
      balanceStatusLabel = "FULLY SETTLED (ZERO BALANCE)";
      balanceStatusNote =
        "Your account balance is currently fully settled and balanced (no outstanding receivables or payables).";
      balanceCardBg = "#f1f5f9";
      balanceCardBorder = "#cbd5e1";
      balanceTextColor = "#334155";
    }

    const smtp = createServerSmtpTransporter(effectiveCompanyName);
    if (!smtp) {
      return res.status(503).json({
        success: false,
        requiresConfig: true,
        message: "Server SMTP credentials (SMTP_USER / SMTP_PASS) are not configured.",
      });
    }

    const logoAttachment = await getLogoAttachment(logoUrl);

    const plainText = `Dear ${effectiveRecipientName},

${introText}

==============================================
TRANSACTION DETAILS
==============================================
Status: ${typeLabel}
${amountHeading}: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Date: ${dateBs} BS ${dateAd ? `(${dateAd} AD)` : ""}
Particulars / Remarks: ${particular || "-"}
Branch Office: ${effectiveBranchName}
Voucher / Ref ID: ${voucherId || "-"}
Teller / Operator: ${tellerName || "Teller"}

==============================================
BALANCE SUMMARY (${balanceStatusLabel})
==============================================
${balanceStatusNote}

Previous Balance: Rs. ${Math.abs(numPrevBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numPrevBalance > 0 ? "Receivable" : numPrevBalance < 0 ? "Payable" : "Balanced"})
Current Transaction: ${isCredit ? "+" : "-"} Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${isCredit ? "Credit" : "Debit"})
Closing Total Balance: Rs. ${Math.abs(numUpdatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Best Regards,
${effectiveCompanyName}
${effectiveAddress}`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.05);">
        <div style="background: #065f46; padding: 16px 20px 12px 20px; border-radius: 14px 14px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 48px; vertical-align: middle; padding-right: 12px;">
                <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="40" height="40" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; color: #ffffff; line-height: 1.25;">
                  ${escapeHtml(effectiveCompanyName)}
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 8px;">
                <div style="font-size: 12px; color: #ffffff; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 6px;">
                  ${escapeHtml(effectiveAddress)}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="background: ${actionType === "delete" ? "#fff1f2" : "#f0fdf4"}; border-bottom: 1px solid ${actionType === "delete" ? "#fecdd3" : "#bbf7d0"}; padding: 8px 16px; text-align: center;">
          <span style="background: ${actionType === "delete" ? "#be123c" : actionType === "edit" ? "#0f766e" : "#065f46"}; color: #ffffff; padding: 3px 12px; border-radius: 16px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; display: inline-block;">
            ${escapeHtml(pillLabel)}
          </span>
        </div>
        <div style="padding: 16px 20px 14px 20px; color: #1e293b; line-height: 1.45;">
          <p style="margin: 0 0 4px 0; font-size: 14.5px; color: #0f172a;">
            Dear <strong>${escapeHtml(effectiveRecipientName)}</strong>,
          </p>
          <p style="margin: 0 0 12px 0; font-size: 12.5px; color: #475569; line-height: 1.4;">
            ${escapeHtml(introText)}
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="background: ${typeBadgeBg}; color: ${typeBadgeColor}; border: 1px solid ${typeBadgeBorder}; padding: 2px 10px; border-radius: 5px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                ${escapeHtml(typeLabel)}
              </span>
              <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">
                Date: <strong>${escapeHtml(dateBs)} BS</strong>
              </span>
            </div>
            <div style="text-align: center; margin: 6px 0 8px 0; padding: 8px 6px; background: #ffffff; border-radius: 8px; border: 1px dashed #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px;">
                ${escapeHtml(amountHeading)}
              </div>
              <div style="font-size: 24px; font-weight: 900; color: ${actionType === "delete" ? "#be123c" : isCredit ? "#059669" : "#e11d48"}; font-family: monospace; letter-spacing: 0.5px; line-height: 1.15;">
                Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style="font-size: 11.5px; font-weight: 600; color: ${actionType === "delete" ? "#9f1239" : isCredit ? "#047857" : "#be123c"}; margin-top: 3px;">
                ${escapeHtml(typeDescription)}
              </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 4px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; width: 140px; font-weight: 600;">Account Holder:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${escapeHtml(effectiveRecipientName)}${employeeCode ? ` <span style="font-size: 11px; color: #64748b; font-weight: normal;">(${escapeHtml(employeeCode)})</span>` : ""}</td>
              </tr>
              ${actionType === "edit" && oldParticular ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #dc2626; font-weight: 600;">Previous Remarks:</td>
                <td style="padding: 4px 0; font-weight: 500; color: #64748b; text-decoration: line-through;">${escapeHtml(oldParticular)}</td>
              </tr>` : ""}
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">${actionType === "edit" ? "Updated Particulars:" : "Particulars / Remarks:"}</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${escapeHtml(particular || (actionType === "delete" ? "Cancelled Ledger Entry" : "General Ledger Entry"))}</td>
              </tr>
              ${actionType === "edit" && oldAmount !== undefined && oldAmount !== null ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #dc2626; font-weight: 600;">Previous Amount:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #64748b; text-decoration: line-through;">NPR ${Number(oldAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>` : ""}
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Branch Office:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${escapeHtml(effectiveBranchName)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Teller / Operator:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${escapeHtml(tellerName || "Front Desk Teller")}</td>
              </tr>
              ${voucherId ? `
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Voucher / Ref ID:</td>
                <td style="padding: 4px 0; font-family: monospace; font-size: 11.5px; color: #475569;">${escapeHtml(voucherId)}</td>
              </tr>` : ""}
            </table>
          </div>
          <div style="background: ${balanceCardBg}; border: 1.5px solid ${balanceCardBorder}; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="background: #ffffff; border-radius: 8px; padding: 8px 12px; border: 1px solid ${balanceCardBorder}; font-size: 12px; color: #1e293b; line-height: 1.45;">
              <strong>Balance Clarification:</strong><br />
              ${escapeHtml(balanceStatusNote)}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; background: rgba(255,255,255,0.7); border-radius: 6px; overflow: hidden;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 10px; color: #64748b;">Previous Balance:</td>
                <td style="padding: 6px 10px; text-align: right; font-weight: 700; font-family: monospace;">
                  Rs. ${Math.abs(numPrevBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style="font-size: 10.5px; color: #64748b; font-weight: normal;"> (${numPrevBalance > 0 ? "Receivable" : numPrevBalance < 0 ? "Payable" : "Balanced"})</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 10px; color: #64748b;">Current Transaction:</td>
                <td style="padding: 6px 10px; text-align: right; font-weight: 700; font-family: monospace; color: ${isCredit ? "#059669" : "#e11d48"};">
                  ${isCredit ? "+" : "-"} Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style="font-size: 10.5px; font-weight: normal;"> (${isCredit ? "Credit" : "Debit"})</span>
                </td>
              </tr>
              <tr style="background: #ffffff; font-weight: bold;">
                <td style="padding: 7px 10px; color: #0f172a;">Closing Total Balance:</td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 900; font-family: monospace; color: ${balanceTextColor};">
                  Rs. ${Math.abs(numUpdatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </table>
          </div>
          <div style="background: #f8fafc; border-left: 3.5px solid #065f46; border-radius: 6px; padding: 8px 12px; font-size: 11.5px; color: #475569; margin-bottom: 12px; line-height: 1.4;">
            <strong>Security Notice:</strong> If this transaction was not authorized by you or if there is any discrepancy in these details, please contact your branch office immediately.
          </div>
          <p style="margin: 0; font-size: 12px; color: #334155; line-height: 1.45;">
            Best Regards,<br />
            <strong style="color: #0f172a;">${escapeHtml(effectiveCompanyName)}</strong><br />
            ${escapeHtml(effectiveAddress)}
          </p>
        </div>
        <div style="background: #f8fafc; padding: 10px 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #94a3b8; line-height: 1.4;">
          This is an automated system notification. Please do not reply directly to this email.<br />
          © ${new Date().getFullYear()} ${escapeHtml(effectiveCompanyName)}. All rights reserved.
        </div>
      </div>
    `;

    const info = await smtp.transporter.sendMail({
      from: smtp.from,
      to: to.trim(),
      subject: emailSubject,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment],
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Transaction alert email sent successfully to ${to.trim()}!`,
    });
  } catch (error: unknown) {
    console.error("Ledger notification email error:", error);
    return res.status(500).json({ success: false, message: "Failed to send transaction alert email." });
  }
});

// API Route: Send Leave Status Notification Email
app.post("/api/send-leave-status-email", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      to,
      cc,
      employeeName,
      employeeCode,
      designation,
      department,
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      status = "Approved",
      approverName,
      approvalRemarks,
      totalEntitledDays,
      takenDays,
      remainingDays,
      companyName,
      companyAddress,
      logoUrl,
    } = req.body || {};

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Employee email address is required." });
    }

    const effectiveCompanyName = String(companyName || "Ratauli Saving and Credit Cooperative Ltd");
    const effectiveAddress = String(companyAddress || "Pipra Rural Municipality -6 (Mahottari)");
    const effectiveEmployeeName = String(employeeName || "Employee");
    const effectiveLeaveType = String(leaveType || "General Leave");
    const numDays = Number(days) || 1;
    const daysText = numDays === 1 ? "1 Day" : `${numDays} Days`;

    let pillBg = "#065f46";
    const pillText = "#ffffff";
    let statusLabel = "APPROVED";
    let statusBadgeBg = "#ecfdf5";
    let statusBadgeColor = "#065f46";
    let statusBadgeBorder = "#a7f3d0";
    let subheaderBg = "#f0fdf4";
    let subheaderBorder = "#bbf7d0";
    let headline = "Leave Request Approved";
    let introMessageHtml = `We are pleased to inform you that your leave request for <strong>${escapeHtml(daysText)}</strong> (${escapeHtml(effectiveLeaveType)}) has been <strong>APPROVED</strong> by the administration.`;
    let introMessagePlain = `We are pleased to inform you that your leave request for ${daysText} (${effectiveLeaveType}) has been APPROVED by the administration.`;
    let emailSubject = `Leave Approved: ${effectiveLeaveType} (${daysText}) - ${effectiveEmployeeName} | ${effectiveCompanyName}`;

    if (status === "Rejected") {
      pillBg = "#be123c";
      statusLabel = "REJECTED";
      statusBadgeBg = "#fff1f2";
      statusBadgeColor = "#9f1239";
      statusBadgeBorder = "#fecdd3";
      subheaderBg = "#fff1f2";
      subheaderBorder = "#fecdd3";
      headline = "Leave Request Status: Rejected";
      introMessageHtml = `Your leave request for <strong>${escapeHtml(daysText)}</strong> (${escapeHtml(effectiveLeaveType)}) has been reviewed by the administration and could not be approved at this time.`;
      introMessagePlain = `Your leave request for ${daysText} (${effectiveLeaveType}) has been reviewed by the administration and could not be approved at this time.`;
      emailSubject = `Leave Request Update: Rejected - ${effectiveEmployeeName} | ${effectiveCompanyName}`;
    } else if (status === "Pending") {
      pillBg = "#2563eb";
      statusLabel = "PENDING REVIEW";
      statusBadgeBg = "#eff6ff";
      statusBadgeColor = "#1d4ed8";
      statusBadgeBorder = "#bfdbfe";
      subheaderBg = "#eff6ff";
      subheaderBorder = "#bfdbfe";
      headline = "Leave Application Registered";
      introMessageHtml = `Your leave application for <strong>${escapeHtml(daysText)}</strong> (${escapeHtml(effectiveLeaveType)}) has been received and registered into the HR governance system for administrative review.`;
      introMessagePlain = `Your leave application for ${daysText} (${effectiveLeaveType}) has been received and registered into the HR governance system for administrative review.`;
      emailSubject = `Leave Application Received: ${effectiveLeaveType} (${daysText}) - ${effectiveEmployeeName} | ${effectiveCompanyName}`;
    }

    const smtp = createServerSmtpTransporter(effectiveCompanyName);
    if (!smtp) {
      return res.status(503).json({
        success: false,
        requiresConfig: true,
        message: "Server SMTP credentials (SMTP_USER / SMTP_PASS) are not configured.",
      });
    }

    const logoAttachment = await getLogoAttachment(logoUrl);

    const plainText = `Dear ${effectiveEmployeeName},

${introMessagePlain}

==============================================
LEAVE DETAILS & TIME-OFF SUMMARY
==============================================
Status: ${statusLabel}
Employee Name: ${effectiveEmployeeName} ${employeeCode ? `(${employeeCode})` : ""}
Designation / Dept: ${designation || "-"} / ${department || "GENERAL"}
Leave Category: ${effectiveLeaveType}
Leave Duration: ${daysText}
Leave Schedule: ${startDate} to ${endDate}
Reason / Purpose: ${reason || "-"}
Authorized By: ${approverName || "Administration / HR Central"}
${approvalRemarks ? `Remarks: ${approvalRemarks}\n` : ""}${totalEntitledDays !== undefined ? `Quota Entitled: ${totalEntitledDays} Days\n` : ""}${remainingDays !== undefined ? `Remaining Leave Balance: ${remainingDays} Days\n` : ""}
Best Regards,
${effectiveCompanyName}
${effectiveAddress}`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.05);">
        <div style="background: #065f46; padding: 16px 20px 12px 20px; border-radius: 14px 14px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 48px; vertical-align: middle; padding-right: 12px;">
                <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="40" height="40" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; color: #ffffff; line-height: 1.25;">
                  ${escapeHtml(effectiveCompanyName)}
                </div>
                <div style="font-size: 11px; color: #a7f3d0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                  HR Central • Leave &amp; Attendance Governance
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 8px;">
                <div style="font-size: 11.5px; color: #ffffff; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 6px;">
                  ${escapeHtml(effectiveAddress)}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="background: ${subheaderBg}; border-bottom: 1px solid ${subheaderBorder}; padding: 8px 16px; text-align: center;">
          <span style="background: ${pillBg}; color: ${pillText}; padding: 3px 14px; border-radius: 16px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; display: inline-block;">
            ${escapeHtml(headline)}
          </span>
        </div>
        <div style="padding: 18px 22px 16px 22px; color: #1e293b; line-height: 1.5;">
          <div style="margin-bottom: 12px;">
            <p style="margin: 0 0 4px 0; font-size: 15px; color: #0f172a; font-weight: 700;">
              Dear <strong>${escapeHtml(effectiveEmployeeName)}</strong>,
            </p>
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
              ${introMessageHtml}
            </p>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
              <span style="background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeBorder}; padding: 3px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                ${escapeHtml(statusLabel)}
              </span>
              <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">
                Duration: <strong style="color: #0f172a; font-size: 13px;">${escapeHtml(daysText)}</strong>
              </span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; width: 140px; font-weight: 600;">Staff Name:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${escapeHtml(effectiveEmployeeName)}${employeeCode ? ` <span style="font-size: 11px; color: #64748b; font-weight: normal;">(Code: ${escapeHtml(employeeCode)})</span>` : ""}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Designation / Dept:</td>
                <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${escapeHtml(designation || "-")} • ${escapeHtml(department || "GENERAL")}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Leave Category:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #047857;">${escapeHtml(effectiveLeaveType)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Leave Period:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${escapeHtml(startDate)} to ${escapeHtml(endDate)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Reason / Purpose:</td>
                <td style="padding: 5px 0; font-weight: 500; color: #334155;">${escapeHtml(reason || "Personal / General Leave")}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Approved / Handled By:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${escapeHtml(approverName || "Administration / HR Central")}</td>
              </tr>
              ${approvalRemarks ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Approval Remarks:</td>
                <td style="padding: 5px 0; font-weight: 600; color: #047857;">${escapeHtml(approvalRemarks)}</td>
              </tr>` : ""}
            </table>
            ${totalEntitledDays !== undefined || remainingDays !== undefined ? `
            <div style="margin-top: 12px; padding: 8px 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11.5px; display: flex; justify-content: space-around; text-align: center;">
              ${totalEntitledDays !== undefined ? `
              <div style="flex: 1; border-right: 1px solid #f1f5f9;">
                <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Total Quota</div>
                <div style="font-weight: 800; color: #0f172a; font-size: 13px; font-family: monospace;">${escapeHtml(totalEntitledDays)}D</div>
              </div>` : ""}
              ${takenDays !== undefined ? `
              <div style="flex: 1; border-right: 1px solid #f1f5f9;">
                <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Utilized</div>
                <div style="font-weight: 800; color: #e11d48; font-size: 13px; font-family: monospace;">${escapeHtml(takenDays)}D</div>
              </div>` : ""}
              ${remainingDays !== undefined ? `
              <div style="flex: 1;">
                <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Balance Remaining</div>
                <div style="font-weight: 800; color: #059669; font-size: 13px; font-family: monospace;">${escapeHtml(remainingDays)}D</div>
              </div>` : ""}
            </div>` : ""}
          </div>
          <p style="margin: 0; font-size: 11.5px; color: #64748b; line-height: 1.5;">
            Best Regards,<br />
            <strong style="color: #0f172a;">HR &amp; Personnel Governance Department</strong><br />
            ${escapeHtml(effectiveCompanyName)}<br />
            ${escapeHtml(effectiveAddress)}
          </p>
        </div>
        <div style="background: #f8fafc; padding: 10px 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #94a3b8; line-height: 1.4;">
          This is an automated HR notification sent via Ratauli SACCOS HR Central.<br />
          © ${new Date().getFullYear()} ${escapeHtml(effectiveCompanyName)}. All rights reserved.
        </div>
      </div>
    `;

    const mailOptions: nodemailer.SendMailOptions = {
      from: smtp.from,
      to: to.trim(),
      subject: emailSubject,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment],
    };

    if (cc && typeof cc === "string" && cc.trim()) {
      mailOptions.cc = cc.trim();
    }

    const info = await smtp.transporter.sendMail(mailOptions);
    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Leave notification email sent successfully to ${to.trim()}!`,
    });
  } catch (error: unknown) {
    console.error("Leave notification email error:", error);
    return res.status(500).json({ success: false, message: "Failed to send leave notification email." });
  }
});

// API Route: Send Test Email Notification (Admin Only)
app.post("/api/send-test-email", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { to, companyName, companyAddress } = req.body || {};

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }

    const effectiveCompanyName = String(companyName || "Ratauli Saving and Credit Cooperative Ltd");
    const effectiveAddress = String(companyAddress || "Pipra Rural Municipality -6 (Mahottari)");

    const smtp = createServerSmtpTransporter(effectiveCompanyName);
    if (!smtp) {
      return res.status(503).json({
        success: false,
        requiresConfig: true,
        message: "Server SMTP credentials (SMTP_USER / SMTP_PASS) are not configured.",
      });
    }

    const info = await smtp.transporter.sendMail({
      from: smtp.from,
      to: to.trim(),
      subject: `Test Email Notification - ${effectiveCompanyName}`,
      html: `
        <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #059669; margin: 0; font-size: 18px; font-weight: bold;">Email Notification Test Successful</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Ratauli SACCOS Automated Email Notification System</p>
          </div>
          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
            This is a test notification confirming that email alerts are properly configured and operational.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; color: #475569; margin-bottom: 20px;">
            <div><strong>Status:</strong> Active &amp; Operational</div>
            <div><strong>Sender Account:</strong> ${escapeHtml(smtp.user)}</div>
            <div><strong>Recipient:</strong> ${escapeHtml(to.trim())}</div>
            <div><strong>Timestamp:</strong> ${escapeHtml(new Date().toLocaleString("en-US", { timeZone: "Asia/Kathmandu" }))} (NPT)</div>
          </div>
          <div style="font-size: 11px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 14px;">
            Best Regards,<br />
            <strong>${escapeHtml(effectiveCompanyName)}</strong><br />
            ${escapeHtml(effectiveAddress)}
          </div>
        </div>
      `,
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Test email sent successfully to ${to.trim()}!`,
    });
  } catch (error: unknown) {
    console.error("Test email send error:", error);
    return res.status(500).json({ success: false, message: "Failed to send test email." });
  }
});

// ==========================================
// TERM LOAN INSURANCE REST API ENDPOINTS (PROTECTED)
// ==========================================
const INSURANCE_DB_PATH = path.resolve(process.cwd(), "public", "assets", "aistudio", "ratauli_database_16831a73.json");

app.get("/api/insurance/records", requireAuth, (_req: AuthenticatedRequest, res) => {
  try {
    if (fs.existsSync(INSURANCE_DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(INSURANCE_DB_PATH, "utf-8"));
      return res.json({ success: true, records: data.insurance_records || [] });
    }
    return res.json({ success: true, records: [] });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to load records" });
  }
});

app.post("/api/insurance/records", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { record } = req.body || {};
    return res.json({ success: true, record });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to save record" });
  }
});

app.post("/api/insurance/bulk-import", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { records } = req.body || {};
    return res.json({ success: true, imported: Array.isArray(records) ? records.length : 0 });
  } catch {
    return res.status(500).json({ success: false, message: "Bulk import failed" });
  }
});

// ==========================================
// AUTHENTICATED SUPABASE DATABASE PROXY (ENABLES FULL RLS LOCKDOWN & SERVER-SIDE RBAC)
// ==========================================
const SETTINGS_GOVERNANCE_TABLES = new Set([
  "roles",
  "branches",
  "branch_operational_status",
  "branch_operational_logs",
  "branch_fixed_expense_configs",
  "remittance_companies",
  "saving_products",
  "loan_products",
  "insurance_companies",
  "depreciation_settings",
  "depreciation_financial_years",
  "mf_settings",
  "tax_policy",
  "tax_configs",
  "tax_adjustments",
]);

const HR_ADMIN_WRITE_TABLES = new Set([
  "employees",
  "payroll_records",
  "leave_types",
  "holidays",
  "board_members",
]);

const HR_ADMIN_DELETE_TABLES = new Set([
  "attendance_records",
  "leave_requests",
]);

const NOTICE_WRITE_TABLES = new Set([
  "notices",
  "downloadable_documents",
]);

const FINANCIAL_DELETE_PROTECTED_TABLES = new Set([
  "daily_data",
  "daily_cash_data",
  "front_teller_counter_entries",
  "front_teller_deno_adjustments",
  "front_teller_ledger_entries",
  "front_teller_remittance_entries",
  "front_teller_vault_entries",
  "back_office_entries",
  "remittance_entries",
  "office_expenses",
  "saved_office_expense_sheets",
  "ledger_accounts",
  "fd_records",
  "loan_insurance_records",
  "insurance_claims",
  "mf_loans",
  "mf_deposit_sheets",
  "fixed_assets",
  "asset_categories",
  "asset_transfers",
  "depreciation_entries",
  "depreciation_vouchers",
]);

const ADMIN_SETTINGS_IDS = new Set([
  "global",
  "saccos_branches_meta",
  "saccos_branch_operational_statuses",
  "saccos_app_holidays",
  "saccos_weekend_days",
]);

function isAdminOnlySettingId(id: string): boolean {
  const normalized = id.replace(/^eq\./, "").trim();
  if (!normalized) return true;
  if (ADMIN_SETTINGS_IDS.has(normalized)) return true;
  if (normalized.startsWith("saccos_board_")) return true;
  return false;
}

function isHrProtectedSettingId(id: string): boolean {
  const normalized = id.replace(/^eq\./, "").trim();
  return normalized === "employee_kyc_store" || normalized.startsWith("employee_kyc_");
}

interface LiveUserAuthz {
  active: boolean;
  isAdmin: boolean;
  permissions: Set<string>;
  fetchedAt: number;
}

const liveAuthzCache = new Map<string, LiveUserAuthz>();
const LIVE_AUTHZ_TTL_MS = 15 * 1000;

async function resolveLiveUserAuthz(authUser: SessionPayload): Promise<LiveUserAuthz> {
  if (authUser.sub === "admin-bootstrap") {
    return { active: true, isAdmin: true, permissions: new Set(["*"]), fetchedAt: Date.now() };
  }
  const cached = liveAuthzCache.get(authUser.sub);
  if (cached && Date.now() - cached.fetchedAt < LIVE_AUTHZ_TTL_MS) {
    return cached;
  }

  const fallback: LiveUserAuthz = {
    active: true,
    isAdmin: authUser.isAdmin,
    permissions: new Set<string>(),
    fetchedAt: Date.now(),
  };

  try {
    const sb = getServerSupabase();
    if (!sb) return fallback;
    const { data: userRow, error } = await sb
      .from("users")
      .select("id, username, role_id, permissions, status")
      .eq("id", authUser.sub)
      .maybeSingle();
    if (error || !userRow) {
      return fallback;
    }

    const perms = new Set<string>(Array.isArray(userRow.permissions) ? userRow.permissions.map(String) : []);
    if (userRow.role_id) {
      const { data: roleRow } = await sb
        .from("roles")
        .select("permissions")
        .eq("id", String(userRow.role_id))
        .maybeSingle();
      if (roleRow && Array.isArray(roleRow.permissions)) {
        for (const p of roleRow.permissions) {
          perms.add(String(p));
        }
      }
    }

    const resolved: LiveUserAuthz = {
      active: userRow.status !== "Inactive",
      isAdmin: isUserAdminRecord({
        username: String(userRow.username || ""),
        role_id: String(userRow.role_id || ""),
        permissions: Array.from(perms),
      }),
      permissions: perms,
      fetchedAt: Date.now(),
    };
    liveAuthzCache.set(authUser.sub, resolved);
    return resolved;
  } catch {
    return fallback;
  }
}

function stripPasswordsFromPayload(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => stripPasswordsFromPayload(item));
  }
  if (data && typeof data === "object") {
    const clone = { ...(data as Record<string, unknown>) };
    if ("password" in clone) {
      delete clone.password;
    }
    return clone;
  }
  return data;
}

function sanitizeSelfUserUpdateBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const clone = { ...(body as Record<string, unknown>) };
  delete clone.role;
  delete clone.role_id;
  delete clone.roleId;
  delete clone.permissions;
  delete clone.is_admin;
  delete clone.isAdmin;
  delete clone.status;
  return clone;
}

function hashPasswordsInWriteBody(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map((item) => hashPasswordsInWriteBody(item));
  }
  if (body && typeof body === "object") {
    const clone = { ...(body as Record<string, unknown>) };
    if (typeof clone.password === "string" && clone.password.trim() && !isPasswordHashed(clone.password)) {
      clone.password = hashPassword(clone.password);
    }
    return clone;
  }
  return body;
}

app.all("/api/supabase-proxy/rest/v1/:table", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isSameOriginMutationAllowed(req)) {
      return res.status(403).json({ message: "Cross-origin state-changing requests are not permitted." });
    }

    const table = String(req.params.table || "").trim();
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      return res.status(400).json({ message: "Invalid table identifier." });
    }

    const method = req.method.toUpperCase();
    const isReadOnly = method === "GET" || method === "HEAD";

    // Allow public read ONLY on the global branding settings row (id=eq.global) for login screen
    const token = extractRequestToken(req);
    const authUser = token ? verifySessionToken(token) : null;
    const isPublicGlobalBrandingRead =
      isReadOnly &&
      table === "settings" &&
      typeof req.query.id === "string" &&
      req.query.id.trim() === "eq.global";

    if (!isPublicGlobalBrandingRead && !authUser) {
      return res.status(401).json({
        message: "Authentication required. Please sign in to access cooperative records.",
      });
    }

    // Resolve live server-side permissions & account status (prevents DevTools localStorage role spoofing)
    let liveAuthz: LiveUserAuthz | null = null;
    if (authUser) {
      liveAuthz = await resolveLiveUserAuthz(authUser);
      if (!liveAuthz.active) {
        return res.status(401).json({ message: "Account is deactivated. Please contact the administrator." });
      }
    }

    const isAdmin = Boolean(liveAuthz?.isAdmin);
    const hasPerm = (perm: string) => isAdmin || Boolean(liveAuthz?.permissions.has(perm));

    // Strictly block direct browser access to the encrypted server-side TOTP vault
    if (table === "settings") {
      const qId = typeof req.query.id === "string" ? req.query.id.trim() : "";
      const bodyItems = Array.isArray(req.body) ? req.body : req.body && typeof req.body === "object" ? [req.body] : [];
      const touchesVault =
        qId.includes(TOTP_VAULT_SETTING_ID) ||
        bodyItems.some(
          (item) => item && typeof item === "object" && String((item as Record<string, unknown>).id || "").trim() === TOTP_VAULT_SETTING_ID
        );
      if (touchesVault) {
        return res.status(403).json({ message: "Server security vault cannot be accessed directly." });
      }
    }

    // Audit logs are strictly append-only (cannot be altered or deleted even by admins)
    if (table === "audit_logs" && (method === "DELETE" || method === "PATCH" || method === "PUT")) {
      return res.status(403).json({ message: "Audit logs cannot be modified or deleted." });
    }

    // Governance / Master Configuration tables require Admin or manage_settings
    if (!isReadOnly && SETTINGS_GOVERNANCE_TABLES.has(table) && !hasPerm("manage_settings")) {
      return res.status(403).json({ message: "Administrator or Settings permissions are required to modify this resource." });
    }

    // HR Master & Payroll tables require Admin or manage_hr
    if (!isReadOnly && HR_ADMIN_WRITE_TABLES.has(table) && !hasPerm("manage_hr")) {
      return res.status(403).json({ message: "HR Management permissions are required to modify HR or payroll records." });
    }
    if (method === "DELETE" && HR_ADMIN_DELETE_TABLES.has(table) && !hasPerm("manage_hr")) {
      return res.status(403).json({ message: "HR Management permissions are required to delete attendance or leave records." });
    }

    // Notices & Downloads writes require Admin or manage_notices
    if (!isReadOnly && NOTICE_WRITE_TABLES.has(table) && !hasPerm("manage_notices")) {
      return res.status(403).json({ message: "Notice management permissions are required to modify notices or downloads." });
    }

    // Destructive DELETE on financial / ledger / microfinance / insurance / asset tables requires Admin or delete_transaction
    if (method === "DELETE" && FINANCIAL_DELETE_PROTECTED_TABLES.has(table) && !hasPerm("delete_transaction")) {
      return res.status(403).json({ message: "Delete Transaction permissions are required to remove financial records." });
    }

    // Granular RBAC on settings writes (protect global/governance & employee KYC while allowing staff chat)
    if (!isReadOnly && table === "settings" && !isAdmin) {
      const queryId = typeof req.query.id === "string" ? req.query.id : "";
      const bodyItems = Array.isArray(req.body) ? req.body : req.body && typeof req.body === "object" ? [req.body] : [];
      const candidateIds: string[] = [];
      if (queryId) candidateIds.push(queryId);
      for (const item of bodyItems) {
        if (item && typeof item === "object" && "id" in item) {
          candidateIds.push(String((item as Record<string, unknown>).id || ""));
        }
      }
      if (candidateIds.length === 0) {
        return res.status(403).json({ message: "Administrator privileges are required to modify global settings." });
      }
      for (const cid of candidateIds) {
        if (isAdminOnlySettingId(cid) && !hasPerm("manage_settings")) {
          return res.status(403).json({ message: "Administrator privileges are required to modify global settings." });
        }
        if (isHrProtectedSettingId(cid) && !hasPerm("manage_hr")) {
          return res.status(403).json({ message: "HR Management permissions are required to modify employee KYC records." });
        }
      }
    }

    // User table write protection: admin/manage_users only, except self profile update (no role/status escalation)
    let isNonAdminSelfUserUpdate = false;
    if (!isReadOnly && table === "users" && !hasPerm("manage_users")) {
      if (method === "DELETE") {
        return res.status(403).json({ message: "Only administrators can delete user accounts." });
      }
      const queryId = typeof req.query.id === "string" ? req.query.id : "";
      const bodyId = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? String(req.body.id || "") : "";
      const isSelfUpdate =
        authUser &&
        (queryId === `eq.${authUser.sub}` || (bodyId !== "" && bodyId === authUser.sub));
      if (!isSelfUpdate) {
        return res.status(403).json({ message: "Administrator privileges are required to manage other users." });
      }
      isNonAdminSelfUserUpdate = true;
    }

    // Invalidate live permission cache whenever users or roles are modified
    if (!isReadOnly && (table === "users" || table === "roles")) {
      liveAuthzCache.clear();
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const supabaseKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ""
    ).trim();

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ message: "Supabase server configuration is missing." });
    }

    const qIdx = req.originalUrl.indexOf("?");
    const queryString = qIdx !== -1 ? req.originalUrl.slice(qIdx) : "";
    const targetUrl = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}${queryString}`;

    const forwardHeaders: Record<string, string> = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    };

    const allowedHeaders = ["accept", "content-type", "prefer", "range", "accept-profile", "content-profile"];
    for (const h of allowedHeaders) {
      const val = req.headers[h];
      if (typeof val === "string" && val.trim()) {
        forwardHeaders[h] = val;
      }
    }

    let requestBody: string | undefined;
    if (!isReadOnly && req.body !== undefined) {
      let safeBody = req.body;
      if (table === "users") {
        if (isNonAdminSelfUserUpdate) {
          safeBody = sanitizeSelfUserUpdateBody(safeBody);
        }
        safeBody = hashPasswordsInWriteBody(safeBody);
      }
      requestBody = typeof safeBody === "string" ? safeBody : JSON.stringify(safeBody);
      if (!forwardHeaders["content-type"]) {
        forwardHeaders["content-type"] = "application/json";
      }
    }

    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: requestBody,
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    const contentRange = upstream.headers.get("content-range");
    res.status(upstream.status);
    res.setHeader("content-type", contentType);
    if (contentRange) {
      res.setHeader("content-range", contentRange);
    }

    if (method === "HEAD" || upstream.status === 204) {
      return res.end();
    }

    const rawText = await upstream.text();

    // Never expose user password hashes to browser clients
    if (table === "users" && contentType.includes("application/json") && rawText.trim()) {
      try {
        const parsed = JSON.parse(rawText);
        return res.send(JSON.stringify(stripPasswordsFromPayload(parsed)));
      } catch {
        return res.send(rawText);
      }
    }

    // Strip server-side encrypted TOTP vault row from any broad settings query response
    if (table === "settings" && contentType.includes("application/json") && rawText.trim()) {
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (row) => !(row && typeof row === "object" && (row as Record<string, unknown>).id === TOTP_VAULT_SETTING_ID)
          );
          return res.send(JSON.stringify(filtered));
        }
        if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).id === TOTP_VAULT_SETTING_ID) {
          return res.status(403).json({ message: "Server security vault cannot be accessed directly." });
        }
      } catch {
        // pass through non-JSON
      }
    }

    return res.send(rawText);
  } catch (err: unknown) {
    console.error("Supabase proxy error:", err);
    return res.status(502).json({ message: "Database proxy request failed." });
  }
});

// Explicit JSON 404 handler for any unmatched /api/* route so it never returns HTML index.html
app.all("/api/*all", (_req, res) => {
  res.status(404).json({ success: false, message: "अनुरोध गरिएको API सर्भरमा फेला परेन (API Not Found)।" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
