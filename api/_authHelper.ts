import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type VercelSessionPayload } from "./_emailHelper.js";

const SESSION_COOKIE_NAME = "ratauli_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function getSessionSecret(): string {
  const secret = (process.env.SESSION_SECRET || "").trim();
  if (secret.length >= 16) return secret;
  return "";
}

export function isUserAdminRecord(row: {
  username?: string;
  role_id?: string;
  roleId?: string;
  permissions?: string[];
}): boolean {
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

export function signSessionPayload(payload: VercelSessionPayload): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable (min 16 chars) is required.");
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function issueSessionForUser(user: {
  id: string;
  username: string;
  roleId?: string;
  role_id?: string;
  permissions?: string[];
}): string {
  const payload: VercelSessionPayload = {
    sub: String(user.id),
    username: String(user.username),
    roleId: String(user.roleId || user.role_id || "3"),
    isAdmin: isUserAdminRecord(user),
    jti: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + SESSION_TTL_MS,
  };
  return signSessionPayload(payload);
}

export function setSessionCookie(res: VercelResponse, token: string): void {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=${maxAgeSec}`
  );
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0`
  );
}

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function isPasswordHashed(stored?: string | null): boolean {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  return parts.length === 3 && parts[0] === "scrypt" && parts[1].length >= 16 && parts[2].length === 128;
}

export function verifyPassword(plain: string, stored?: string | null): { valid: boolean; needsMigration: boolean } {
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

  const hashA = crypto.createHash("sha256").update(plain).digest();
  const hashB = crypto.createHash("sha256").update(stored).digest();
  const valid = crypto.timingSafeEqual(hashA, hashB);
  return { valid, needsMigration: valid };
}

export function validateStrongPasswordServer(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, a number, and a special character.";
  }
  return null;
}

export function getServerSupabase(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function mapDbUserRowToClientUser(row: Record<string, unknown>) {
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

export interface LiveUserAuthz {
  active: boolean;
  isAdmin: boolean;
  permissions: Set<string>;
}

export async function resolveLiveUserAuthz(authUser: VercelSessionPayload): Promise<LiveUserAuthz> {
  if (authUser.sub === "admin-bootstrap") {
    return { active: true, isAdmin: true, permissions: new Set(["*"]) };
  }
  const fallback: LiveUserAuthz = {
    active: true,
    isAdmin: authUser.isAdmin,
    permissions: new Set<string>(),
  };
  try {
    const sb = getServerSupabase();
    if (!sb) return fallback;
    const { data: userRow, error } = await sb
      .from("users")
      .select("id, username, role_id, permissions, status")
      .eq("id", authUser.sub)
      .maybeSingle();
    if (error || !userRow) return fallback;

    const perms = new Set<string>(Array.isArray(userRow.permissions) ? userRow.permissions.map(String) : []);
    if (userRow.role_id) {
      const { data: roleRow } = await sb
        .from("roles")
        .select("permissions")
        .eq("id", String(userRow.role_id))
        .maybeSingle();
      if (roleRow && Array.isArray(roleRow.permissions)) {
        for (const p of roleRow.permissions) perms.add(String(p));
      }
    }

    return {
      active: userRow.status !== "Inactive",
      isAdmin: isUserAdminRecord({
        username: String(userRow.username || ""),
        role_id: String(userRow.role_id || ""),
        permissions: Array.from(perms),
      }),
      permissions: perms,
    };
  } catch {
    return fallback;
  }
}

export function isSameOriginMutationAllowed(req: VercelRequest): boolean {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const authHeader = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  if (authHeader.startsWith("Bearer ")) return true;
  const expectedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!expectedHost) return true;
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  const referer = typeof req.headers.referer === "string" ? req.headers.referer.trim() : "";
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

export function signStatelessToken(payload: Record<string, unknown>): string {
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyStatelessToken<T>(token: string): T | null {
  const secret = getSessionSecret();
  if (!secret || !token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expectedSig = crypto.createHmac("sha256", secret).update(parts[0]).digest("base64url");
  const sigBuf = Buffer.from(parts[1], "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    return JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function maskEmailAddress(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "***@rataulisaccos.org.np";
  const [name, domain] = parts;
  const maskedName = name.length > 2 ? `${name.charAt(0)}****${name.charAt(name.length - 1)}` : `${name.charAt(0)}****`;
  return `${maskedName}@${domain}`;
}
