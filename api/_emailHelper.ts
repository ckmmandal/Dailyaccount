import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_APP_URL = process.env.VITE_APP_URL || "https://www.rataulicoop.com.np";

// Default Cooperative Emblem PNG (Base64 fallback when disk logo isn't bundled)
export const DEFAULT_COOP_LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAACa0lEQVR4nO3cvU3EQBAFYEeIkCIohAbogAaogJiaiIiogxZogeAQARJC9np+3puZXeZJE97Z+91byXc+eds6nc537u8uqvnX0WI1KhFteUzhgj9erlWzPiQYzA06TQLRTJilkwwnhiwXANz2+KCadSCNcFowBGg9RAMeGk4LWQexGJwbsipeNJwGMgdRiJcNJ4WMRZwUrwbi5Hi5iIvg5SEG4X2+3YomDBGNdwQYgcbA5LeQiHcEchY0JBeRgKcF04JSEBnt8+Khg0b0txDYPnTrJIhaSGwLge2LgBtB5rQQ1D4r3s3r8+6wETEtJLQPgedBjG0huH1IvAhEfwsB7bNsXSmeFhGxleWAoO3LxrMi8rdxAl4EIByxGqAFUZspAL3Xeyw8C+KUgBJET7iAidtXiugNdxuD2of6yobGuxguaVIAR5F+8t6RIDZgAzZgAzZgAzZgAzYgFlB6If3+dAUdSUpfSEtbWAFQup7w78MrAZb/NaYBnYjRgFP8oNqAgTeVIgHjbiqBWzhCjAKMva15AohsYTSgFc8F6GnhGWIEYN4fjMAt3ENkA+b9uYjUQtS9EkkseLj2gVv4F5EJ+fc4Hjx7+wgtjGijFY7TPkILWW30tI7XPmELrYh7kFLQo9dZz+MUzwVIRhxBSsdzbD7eDuLeQb2IWkzEsQ7XAcfbZC1EIUaMCA8KuBBiDt4iiLl4kyPWwFMiVoAcnlsKngExA/L0fFLxDhArQKrh0vAciAxI0THL4f1k78T64WOGACCRMw/c7xyddD+AUZnRIvoRoIqcLcwIKn3f7OXjIl0wapZOoxHSWJ2OIV+gjclEh0yIQwAAAABJRU5ErkJggg==";

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

      // Local disk path (when bundled in Vercel deployment or local Node)
      const localCleanPath = trimmed.split("?")[0].replace(/^\//, "");
      const candidatePaths = [
        path.resolve(process.cwd(), "public", localCleanPath),
        path.resolve(process.cwd(), "dist", localCleanPath),
        path.resolve(process.cwd(), "public", "system_logo.png"),
        path.resolve(process.cwd(), "dist", "system_logo.png"),
        path.resolve(process.cwd(), "public", "ratauli_official_coop_logo.png"),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          try {
            return {
              filename: "logo.png",
              content: fs.readFileSync(p),
              cid: "cooplogo",
              contentType: "image/png",
            };
          } catch {
            // continue to next candidate
          }
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

    // Fallback to default local logo or embedded base64 emblem
    for (const fallbackPath of [
      path.resolve(process.cwd(), "public", "system_logo.png"),
      path.resolve(process.cwd(), "dist", "system_logo.png"),
    ]) {
      if (fs.existsSync(fallbackPath)) {
        try {
          return {
            filename: "cooplogo.png",
            content: fs.readFileSync(fallbackPath),
            cid: "cooplogo",
            contentType: "image/png",
          };
        } catch {
          // continue
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
