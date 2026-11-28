import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, createSmtpTransporter, getLogoAttachment, parseJsonBody, requireVercelAuth, type SmtpPayload } from "./_emailHelper.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  if (!requireVercelAuth(req, res)) return;

  try {
    const parsedBody = await parseJsonBody<{
      to?: string;
      subject?: string;
      body?: string;
      html?: string;
      attachments?: Array<{ dataUrl?: string; content?: string; filename?: string; name?: string; type?: string; contentType?: string }>;
      pdfBase64?: string;
      filename?: string;
      logoUrl?: string;
      smtpConfig?: SmtpPayload | null;
    }>(req);

    const {
      to,
      subject,
      body,
      html,
      attachments: clientAttachments,
      pdfBase64,
      filename,
      logoUrl,
      smtpConfig,
    } = parsedBody;

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "कर्मचारीको ईमेल ठेगाना आवश्यक छ।" });
    }

    const { transporter, user, pass, from } = createSmtpTransporter(
      smtpConfig,
      "रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड"
    );

    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        requiresConfig: true,
        message: "SMTP (ईमेल पठाउने) एकाउन्ट र पासवर्ड सेटिङ मिलाउनु पर्नेछ। System Settings वा .env मा SMTP Setup गर्नुहोस्।",
      });
    }

    const attachments: Array<{
      filename: string;
      content: Buffer;
      cid?: string;
      contentType?: string;
    }> = [];

    // Embed Cooperative Logo if requested or referenced in HTML
    if (logoUrl || (typeof html === "string" && html.includes("cid:cooplogo"))) {
      const logoAttachment = await getLogoAttachment(logoUrl);
      if (logoAttachment) {
        attachments.push(logoAttachment);
      }
    }

    // Handle generic client attachments (Compose / Bulk Email in HR Management)
    if (Array.isArray(clientAttachments)) {
      for (const att of clientAttachments) {
        if (att && (att.dataUrl || att.content)) {
          const raw = String(att.dataUrl || att.content);
          const commaIndex = raw.indexOf(",");
          const cleanBase64 = commaIndex !== -1 ? raw.substring(commaIndex + 1).trim() : raw.trim();
          attachments.push({
            filename: att.filename || att.name || "attachment",
            content: Buffer.from(cleanBase64, "base64"),
            contentType: att.type || att.contentType,
          });
        }
      }
    }

    // Handle single PDF Base64 attachment (Salary Slip, Official Doc, Attendance Report)
    if (pdfBase64 && typeof pdfBase64 === "string") {
      const commaIndex = pdfBase64.indexOf(",");
      const cleanBase64 = commaIndex !== -1 ? pdfBase64.substring(commaIndex + 1).trim() : pdfBase64.trim();

      let safeFilename = filename || "Salary_Pay_Slip.pdf";
      if (!safeFilename.toLowerCase().endsWith(".pdf")) {
        safeFilename += ".pdf";
      }

      attachments.push({
        filename: safeFilename,
        content: Buffer.from(cleanBase64, "base64"),
        contentType: "application/pdf",
      });
    }

    const info = await transporter.sendMail({
      from,
      to: to.trim(),
      subject: subject || "Salary Pay Slip - Ratauli Cooperative",
      text: body || "",
      html: html || body || "",
      attachments,
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `${to} मा इमेल सफल रूपमा पठाइयो!`,
    });
  } catch (error: unknown) {
    console.error("Email send error:", error);
    const errMsg = error instanceof Error ? error.message : "ईमेल पठाउँदा समस्या आयो।";
    return res.status(500).json({
      success: false,
      message: errMsg,
    });
  }
}
