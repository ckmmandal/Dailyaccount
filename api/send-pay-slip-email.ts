import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const { to, subject, body, pdfBase64, filename, smtpConfig } = req.body || {};

    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, message: "कर्मचारीको ईमेल ठेगाना आवश्यक छ।" });
    }

    // Determine SMTP settings (Priority: UI provided SMTP config > Environment Variables > Cooperative Default Fallbacks)
    const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
    const secure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : (port === 465);
    const user = smtpConfig?.user || process.env.SMTP_USER || "info.rataulisaccos@gmail.com";
    const pass = smtpConfig?.pass || process.env.SMTP_PASS || "wkztblmirjnyltga";
    const from = smtpConfig?.from || process.env.SMTP_FROM || `रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड <${user}>`;

    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        requiresConfig: true,
        message: "SMTP (ईमेल पठाउने) एकाउन्ट र पासवर्ड सेटिङ मिलाउनु पर्नेछ। System Settings वा .env मा SMTP Setup गर्नुहोस्।"
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const attachments = [];
    if (pdfBase64) {
      const commaIndex = pdfBase64.indexOf(",");
      const cleanBase64 = commaIndex !== -1 ? pdfBase64.substring(commaIndex + 1).trim() : pdfBase64.trim();
      
      let safeFilename = filename || "Salary_Pay_Slip.pdf";
      if (!safeFilename.toLowerCase().endsWith(".pdf")) {
        safeFilename += ".pdf";
      }

      attachments.push({
        filename: safeFilename,
        content: Buffer.from(cleanBase64, "base64"),
        contentType: "application/pdf"
      });
    }

    const info = await transporter.sendMail({
      from,
      to,
      subject: subject || "Salary Pay Slip - Ratauli Cooperative",
      text: body,
      attachments
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `${to} मा PDF सहित पे-स्लिप सफल रूपमा पठाइयो!`
    });
  } catch (error: unknown) {
    console.error("Email send error:", error);
    const errMsg = error instanceof Error ? error.message : "ईमेल पठाउँदा समस्या आयो।";
    return res.status(500).json({
      success: false,
      message: errMsg
    });
  }
}
