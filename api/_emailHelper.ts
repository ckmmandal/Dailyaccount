import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

export const DEFAULT_APP_URL = process.env.VITE_APP_URL || "https://www.rataulicoop.com.np";

// Default Cooperative Emblem PNG (Base64 fallback when disk logo isn't bundled)
export const DEFAULT_COOP_LOGO_BASE64 =
  "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";

export interface SmtpPayload {
  host?: string;
  port?: number | string;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

export async function parseJsonBody<T = Record<string, unknown>>(req: VercelRequest): Promise<T> {
  const existing = (req as unknown as { body?: unknown }).body;
  if (existing !== undefined && existing !== null) {
    if (typeof existing === "string") {
      try {
        return JSON.parse(existing) as T;
      } catch {
        return {} as T;
      }
    }
    if (Buffer.isBuffer(existing)) {
      try {
        return JSON.parse(existing.toString("utf8")) as T;
      } catch {
        return {} as T;
      }
    }
    if (typeof existing === "object") {
      return existing as T;
    }
  }

  // Fallback: read raw stream if body helper didn't pre-parse
  try {
    if (typeof req.on === "function" && !req.readableEnded) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      if (chunks.length > 0) {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        if (raw) {
          return JSON.parse(raw) as T;
        }
      }
    }
  } catch {
    // ignore malformed stream
  }

  return {} as T;
}

export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = typeof req.headers?.origin === "string" ? req.headers.origin : "*";
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

export function resolveSmtpSettings(smtpConfig?: SmtpPayload | null, companyName?: string) {
  const effectiveCompany = companyName || "रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड";
  const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
  const secure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : port === 465;
  const user = smtpConfig?.user || process.env.SMTP_USER || "info.rataulisaccos@gmail.com";
  const pass = smtpConfig?.pass || process.env.SMTP_PASS || "wkztblmirjnyltga";
  const from = smtpConfig?.from || process.env.SMTP_FROM || `${effectiveCompany} <${user}>`;

  return { host, port, secure, user, pass, from };
}

export function createSmtpTransporter(smtpConfig?: SmtpPayload | null, companyName?: string) {
  const cfg = resolveSmtpSettings(smtpConfig, companyName);
  const nm = nodemailer as unknown as {
    createTransport?: typeof nodemailer.createTransport;
    default?: { createTransport?: typeof nodemailer.createTransport };
  };
  const createTransportFn = nm.createTransport || nm.default?.createTransport;
  if (typeof createTransportFn !== "function") {
    throw new Error("Nodemailer createTransport is unavailable in runtime");
  }

  const transporter = createTransportFn({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 18000,
    tls: {
      rejectUnauthorized: false,
    },
  });
  return { transporter, ...cfg };
}

export async function getLogoAttachment(logoUrl?: string) {
  try {
    if (logoUrl && typeof logoUrl === "string") {
      const trimmed = logoUrl.trim();

      // Base64 Data URI
      if (trimmed.startsWith("data:image/")) {
        try {
          const commaIndex = trimmed.indexOf(",");
          const meta = commaIndex !== -1 ? trimmed.substring(0, commaIndex) : "";
          const cleanBase64 = commaIndex !== -1 ? trimmed.substring(commaIndex + 1).trim() : trimmed.trim();
          let contentType = "image/png";
          if (meta.includes("image/jpeg") || meta.includes("image/jpg")) contentType = "image/jpeg";
          else if (meta.includes("image/svg")) contentType = "image/svg+xml";
          else if (meta.includes("image/webp")) contentType = "image/webp";

          return {
            filename: "logo.png",
            content: Buffer.from(cleanBase64, "base64"),
            cid: "cooplogo",
            contentType,
          };
        } catch (err) {
          console.warn("Failed to parse base64 logo for email:", err);
        }
      }

      // Remote URL (bounded timeout so slow external fetch never stalls serverless execution)
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          try {
            const fetchRes = await fetch(trimmed, { signal: controller.signal });
            if (fetchRes.ok) {
              const arrBuf = await fetchRes.arrayBuffer();
              const contentType = fetchRes.headers.get("content-type") || "image/png";
              return {
                filename: "logo.png",
                content: Buffer.from(arrBuf),
                cid: "cooplogo",
                contentType,
              };
            }
          } finally {
            clearTimeout(timer);
          }
        } catch (err) {
          console.warn("Failed to fetch remote logo for email:", err);
        }
      }
    }
  } catch (err) {
    console.warn("Logo attachment fallback triggered:", err);
  }

  return {
    filename: "cooplogo.png",
    content: Buffer.from(DEFAULT_COOP_LOGO_BASE64, "base64"),
    cid: "cooplogo",
    contentType: "image/png",
  };
}
