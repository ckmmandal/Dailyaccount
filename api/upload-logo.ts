import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, parseJsonBody, requireVercelAuth } from "./_emailHelper.js";

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

function detectImageMagic(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: "image/png", ext: ".png" };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { mime: "image/gif", ext: ".gif" };
  }
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  if (!requireVercelAuth(req, res, { adminOnly: true })) return;

  try {
    const body = await parseJsonBody<{ base64Image?: string }>(req);
    const { base64Image } = body;
    if (!base64Image || typeof base64Image !== "string") {
      return res.status(400).json({ success: false, message: "No base64Image provided." });
    }

    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) {
      return res.status(400).json({ success: false, message: "Logo image must be between 1 byte and 5MB." });
    }

    const detected = detectImageMagic(buffer);
    if (!detected) {
      return res.status(400).json({
        success: false,
        message: "Only valid PNG, JPEG, GIF, or WebP images are permitted for system logos.",
      });
    }

    // Vercel serverless filesystem is read-only; return validated Data URL to persist in global settings
    const safeDataUrl = `data:${detected.mime};base64,${buffer.toString("base64")}`;
    return res.status(200).json({
      success: true,
      logoUrl: safeDataUrl,
      message: "System logo validated successfully.",
    });
  } catch (err: unknown) {
    console.error("Vercel upload-logo error:", err);
    return res.status(500).json({ success: false, message: "Failed to process logo upload." });
  }
}
