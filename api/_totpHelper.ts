import crypto from "crypto";
import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TOTP_VAULT_SETTING_ID = "saccos_totp_vault";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface TotpVaultEntry {
  encryptedSecret: string;
  username: string;
  enabledAt: number;
}

export type TotpVaultData = Record<string, TotpVaultEntry>;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function generateTotpCodeForCounter(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const msg = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  msg.writeUInt32BE(high, 0);
  msg.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

export function verifyTotpCode(secretBase32: string, rawCode: string, driftSteps = 1): boolean {
  const code = String(rawCode || "").replace(/\D/g, "").trim();
  if (code.length !== 6) return false;
  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  const providedBuf = Buffer.from(code, "utf8");

  for (let delta = -driftSteps; delta <= driftSteps; delta++) {
    const expected = generateTotpCodeForCounter(secretBase32, currentCounter + delta);
    const expectedBuf = Buffer.from(expected, "utf8");
    if (expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(params: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  const cleanIssuer = (params.issuer || "Ratauli SACCOS").replace(/:/g, "").trim();
  const cleanAccount = (params.accountName || "user").replace(/:/g, "").trim();
  const label = `${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(cleanAccount)}`;
  const qs = new URLSearchParams({
    secret: params.secret,
    issuer: cleanIssuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${qs.toString()}`;
}

export async function generateQrDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

function deriveVaultKey(keyMaterial: string): Buffer {
  return crypto.createHash("sha256").update(`ratauli-totp-vault-v1:${keyMaterial}`).digest();
}

export function encryptTotpSecret(plainSecret: string, keyMaterial: string): string {
  const key = deriveVaultKey(keyMaterial);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptTotpSecret(payload: string, keyMaterial: string): string | null {
  try {
    const parts = String(payload || "").split(":");
    if (parts.length !== 4 || parts[0] !== "v1") return null;
    const iv = Buffer.from(parts[1], "hex");
    const tag = Buffer.from(parts[2], "hex");
    const encrypted = Buffer.from(parts[3], "hex");
    const key = deriveVaultKey(keyMaterial);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export async function readTotpVault(sb: SupabaseClient): Promise<TotpVaultData> {
  const { data, error } = await sb
    .from("settings")
    .select("data")
    .eq("id", TOTP_VAULT_SETTING_ID)
    .maybeSingle();

  if (error || !data || !data.data || typeof data.data !== "object" || Array.isArray(data.data)) {
    return {};
  }
  return data.data as TotpVaultData;
}

export async function writeTotpVault(sb: SupabaseClient, vault: TotpVaultData): Promise<void> {
  const { error } = await sb
    .from("settings")
    .upsert({ id: TOTP_VAULT_SETTING_ID, data: vault }, { onConflict: "id" });
  if (error) {
    throw new Error(`Failed to persist Authenticator vault: ${error.message}`);
  }
}

export async function getUserTotpEntry(
  sb: SupabaseClient,
  userId: string
): Promise<TotpVaultEntry | null> {
  const vault = await readTotpVault(sb);
  const entry = vault[String(userId)];
  return entry && typeof entry.encryptedSecret === "string" ? entry : null;
}

export async function getUserTotpSecret(
  sb: SupabaseClient,
  userId: string,
  keyMaterial: string
): Promise<string | null> {
  const entry = await getUserTotpEntry(sb, userId);
  if (!entry) return null;
  return decryptTotpSecret(entry.encryptedSecret, keyMaterial);
}

export async function setUserTotpSecret(
  sb: SupabaseClient,
  userId: string,
  username: string,
  plainSecret: string,
  keyMaterial: string
): Promise<number> {
  const vault = await readTotpVault(sb);
  const enabledAt = Date.now();
  vault[String(userId)] = {
    encryptedSecret: encryptTotpSecret(plainSecret, keyMaterial),
    username: String(username || ""),
    enabledAt,
  };
  await writeTotpVault(sb, vault);
  return enabledAt;
}

export async function deleteUserTotpSecret(sb: SupabaseClient, userId: string): Promise<void> {
  const vault = await readTotpVault(sb);
  if (String(userId) in vault) {
    delete vault[String(userId)];
    await writeTotpVault(sb, vault);
  }
}

export async function getTotpEnrolledUserIds(sb: SupabaseClient): Promise<string[]> {
  const vault = await readTotpVault(sb);
  return Object.keys(vault).filter((id) => Boolean(vault[id]?.encryptedSecret));
}

export interface PendingTotpSetupPayload {
  kind: "totp_setup";
  userId: string;
  username: string;
  encryptedSecret: string;
  exp: number;
}

export function signTotpSetupToken(
  params: { userId: string; username: string; plainSecret: string },
  keyMaterial: string
): string {
  const payload: PendingTotpSetupPayload = {
    kind: "totp_setup",
    userId: String(params.userId),
    username: String(params.username),
    encryptedSecret: encryptTotpSecret(params.plainSecret, keyMaterial),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", keyMaterial).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyTotpSetupToken(
  token: string,
  keyMaterial: string
): { userId: string; username: string; plainSecret: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expectedSig = crypto.createHmac("sha256", keyMaterial).update(parts[0]).digest("base64url");
  const sigBuf = Buffer.from(parts[1], "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as PendingTotpSetupPayload;
    if (!payload || payload.kind !== "totp_setup" || payload.exp <= Date.now()) return null;
    const plainSecret = decryptTotpSecret(payload.encryptedSecret, keyMaterial);
    if (!plainSecret) return null;
    return {
      userId: String(payload.userId),
      username: String(payload.username),
      plainSecret,
    };
  } catch {
    return null;
  }
}

export type TwoStepFrequency =
  | "every_login"
  | "once_per_day"
  | "once_per_7_days"
  | "once_per_30_days";

export const TWO_STEP_TRUST_COOKIE_NAME = "ratauli_2fa_trust";

export function normalizeTwoStepFrequency(raw: unknown): TwoStepFrequency {
  if (
    raw === "every_login" ||
    raw === "once_per_day" ||
    raw === "once_per_7_days" ||
    raw === "once_per_30_days"
  ) {
    return raw;
  }
  return "once_per_day";
}

export function getNepalDateKey(nowMs = Date.now()): string {
  // Nepal Standard Time is fixed UTC+5:45 (345 minutes), no daylight saving time
  const npt = new Date(nowMs + 345 * 60 * 1000);
  const y = npt.getUTCFullYear();
  const m = String(npt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(npt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface TwoStepTrustPayload {
  kind: "2fa_trust";
  userId: string;
  method: "authenticator" | "email";
  totpEnabledAt: number | null;
  nptDay: string;
  verifiedAt: number;
  exp: number;
}

export function getTrustMaxAgeSeconds(frequency: TwoStepFrequency): number {
  if (frequency === "every_login") return 0;
  if (frequency === "once_per_7_days") return 7 * 24 * 60 * 60;
  if (frequency === "once_per_30_days") return 30 * 24 * 60 * 60;
  return 24 * 60 * 60; // once_per_day (exact calendar day enforced by nptDay)
}

export function signTwoStepTrustToken(
  params: {
    userId: string;
    method: "authenticator" | "email";
    totpEnabledAt: number | null;
    frequency: TwoStepFrequency;
  },
  keyMaterial: string
): string | null {
  const maxAgeSec = getTrustMaxAgeSeconds(params.frequency);
  if (maxAgeSec <= 0 || !keyMaterial) return null;
  const now = Date.now();
  const payload: TwoStepTrustPayload = {
    kind: "2fa_trust",
    userId: String(params.userId),
    method: params.method,
    totpEnabledAt: typeof params.totpEnabledAt === "number" ? params.totpEnabledAt : null,
    nptDay: getNepalDateKey(now),
    verifiedAt: now,
    exp: now + maxAgeSec * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", keyMaterial).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyTwoStepTrustToken(
  token: string | undefined,
  expected: {
    userId: string;
    requiredMethod: "authenticator" | "email";
    currentTotpEnabledAt: number | null;
    frequency: TwoStepFrequency;
  },
  keyMaterial: string
): boolean {
  if (expected.frequency === "every_login") return false;
  if (!token || typeof token !== "string" || !keyMaterial) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  const expectedSig = crypto.createHmac("sha256", keyMaterial).update(parts[0]).digest("base64url");
  const sigBuf = Buffer.from(parts[1], "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as TwoStepTrustPayload;
    const now = Date.now();
    if (!payload || payload.kind !== "2fa_trust") return false;
    if (String(payload.userId) !== String(expected.userId)) return false;
    if (typeof payload.exp !== "number" || payload.exp <= now) return false;
    if (typeof payload.verifiedAt !== "number" || payload.verifiedAt > now + 60_000) return false;

    if (expected.requiredMethod === "authenticator") {
      if (payload.method !== "authenticator") return false;
      if (
        typeof expected.currentTotpEnabledAt !== "number" ||
        payload.totpEnabledAt !== expected.currentTotpEnabledAt
      ) {
        return false;
      }
    }

    if (expected.frequency === "once_per_day") {
      return payload.nptDay === getNepalDateKey(now);
    }
    const maxWindowMs = getTrustMaxAgeSeconds(expected.frequency) * 1000;
    return now - payload.verifiedAt <= maxWindowMs;
  } catch {
    return false;
  }
}

export function extractCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) {
      const v = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return undefined;
}

export function buildTwoStepTrustCookieHeader(
  token: string | null,
  maxAgeSec: number,
  isHttps: boolean
): string {
  const sameSitePart = isHttps ? "Secure; SameSite=None; Partitioned" : "SameSite=Lax";
  if (!token || maxAgeSec <= 0) {
    return `${TWO_STEP_TRUST_COOKIE_NAME}=; HttpOnly; ${sameSitePart}; Path=/api/auth; Max-Age=0`;
  }
  return `${TWO_STEP_TRUST_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; ${sameSitePart}; Path=/api/auth; Max-Age=${maxAgeSec}`;
}

