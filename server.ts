import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

const app = express();
const PORT = 3000;

// Parse json payload up to 25MB for PDF base64 attachments
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Health check endpoint for dev server / cloud run container
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Default Cooperative Emblem PNG (Base64)
const DEFAULT_COOP_LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAACa0lEQVR4nO3cvU3EQBAFYEeIkCIohAbogAaogJiaiIiogxZogeAQARJC9np+3puZXeZJE97Z+91byXc+eds6nc537u8uqvnX0WI1KhFteUzhgj9erlWzPiQYzA06TQLRTJilkwwnhiwXANz2+KCadSCNcFowBGg9RAMeGk4LWQexGJwbsipeNJwGMgdRiJcNJ4WMRZwUrwbi5Hi5iIvg5SEG4X2+3YomDBGNdwQYgcbA5LeQiHcEchY0JBeRgKcF04JSEBnt8+Khg0b0txDYPnTrJIhaSGwLge2LgBtB5rQQ1D4r3s3r8+6wETEtJLQPgedBjG0huH1IvAhEfwsB7bNsXSmeFhGxleWAoO3LxrMi8rdxAl4EIByxGqAFUZspAL3Xeyw8C+KUgBJET7iAidtXiugNdxuD2of6yobGuxguaVIAR5F+8t6RIDZgAzZgAzZgAzZgAzYgFlB6If3+dAUdSUpfSEtbWAFQup7w78MrAZb/NaYBnYjRgFP8oNqAgTeVIgHjbiqBWzhCjAKMva15AohsYTSgFc8F6GnhGWIEYN4fjMAt3ENkA+b9uYjUQtS9EkkseLj2gVv4F5EJ+fc4Hjx7+wgtjGijFY7TPkILWW30tI7XPmELrYh7kFLQo9dZz+MUzwVIRhxBSsdzbD7eDuLeQb2IWkzEsQ7XAcfbZC1EIUaMCA8KuBBiDt4iiLl4kyPWwFMiVoAcnlsKngExA/L0fFLxDhArQKrh0vAciAxI0THL4f1k78T64WOGACCRMw/c7xyddD+AUZnRIvoRoIqcLcwIKn3f7OXjIl0wapZOoxHSWJ2OIV+gjclEh0yIQwAAAABJRU5ErkJggg==";

async function getLogoAttachment(logoUrl?: string) {
  const fs = await import("fs");
  if (logoUrl && typeof logoUrl === 'string') {
    const trimmed = logoUrl.trim();
    
    // Check if it's a local file path
    const localCleanPath = trimmed.split('?')[0].replace(/^\//, '');
    const candidatePaths = [
      path.resolve(process.cwd(), "public", localCleanPath),
      path.resolve(process.cwd(), "public", "system_logo.png"),
      path.resolve(process.cwd(), "public", "ratauli_official_coop_logo.png")
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const fileBuf = fs.readFileSync(p);
          return {
            filename: 'logo.png',
            content: fileBuf,
            cid: 'cooplogo',
            contentType: 'image/png'
          };
        } catch (e) {
          console.warn("Logo path read error:", e);
        }
      }
    }

    if (trimmed.startsWith('data:image/')) {
      try {
        const commaIndex = trimmed.indexOf(',');
        const meta = trimmed.substring(0, commaIndex);
        const cleanBase64 = commaIndex !== -1 ? trimmed.substring(commaIndex + 1).trim() : trimmed.trim();
        let contentType = 'image/png';
        if (meta.includes('image/jpeg') || meta.includes('image/jpg')) contentType = 'image/jpeg';
        else if (meta.includes('image/svg')) contentType = 'image/svg+xml';
        else if (meta.includes('image/webp')) contentType = 'image/webp';

        return {
          filename: 'logo.png',
          content: Buffer.from(cleanBase64, 'base64'),
          cid: 'cooplogo',
          contentType
        };
      } catch (err) {
        console.warn('Failed to parse base64 logo for email:', err);
      }
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const fetchRes = await fetch(trimmed);
        if (fetchRes.ok) {
          const arrBuf = await fetchRes.arrayBuffer();
          const contentType = fetchRes.headers.get('content-type') || 'image/png';
          return {
            filename: 'logo.png',
            content: Buffer.from(arrBuf),
            cid: 'cooplogo',
            contentType
          };
        }
      } catch (err) {
        console.warn('Failed to fetch remote logo for email:', err);
      }
    }
  }

  // Fallback to local system logo if exists on disk
  try {
    const defaultLocalPath = path.resolve(process.cwd(), "public", "system_logo.png");
    if (fs.existsSync(defaultLocalPath)) {
      return {
        filename: 'cooplogo.png',
        content: fs.readFileSync(defaultLocalPath),
        cid: 'cooplogo',
        contentType: 'image/png'
      };
    }
  } catch (e) {
    console.warn("Default logo read error:", e);
  }

  return {
    filename: 'cooplogo.png',
    content: Buffer.from(DEFAULT_COOP_LOGO_BASE64, 'base64'),
    cid: 'cooplogo',
    contentType: 'image/png'
  };
}

// API Route: Upload & Save System Logo to Disk
app.post("/api/upload-logo", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, message: "imageBase64 is required" });
    }
    const fs = await import("fs");
    const trimmed = imageBase64.trim();
    const commaIndex = trimmed.indexOf(',');
    const cleanBase64 = commaIndex !== -1 ? trimmed.substring(commaIndex + 1).trim() : trimmed;
    const buffer = Buffer.from(cleanBase64, 'base64');

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
    const msg = err instanceof Error ? err.message : "Failed to save logo";
    return res.status(500).json({ success: false, message: msg });
  }
});

// API Route: Get Server Logo
app.get("/api/system-logo", async (req, res) => {
  try {
    const fs = await import("fs");
    const publicPath = path.resolve(process.cwd(), "public", "system_logo.png");
    if (fs.existsSync(publicPath)) {
      return res.json({ success: true, logoUrl: `/system_logo.png?v=${fs.statSync(publicPath).mtimeMs}` });
    }
    return res.json({ success: true, logoUrl: "/system_logo.png" });
  } catch {
    return res.json({ success: true, logoUrl: "/system_logo.png" });
  }
});

// API Route: Send OTP Email for Forgot Password
app.post("/api/send-otp-email", async (req, res) => {
  try {
    const { to, username, otpCode, companyName, companyAddress, logoUrl, smtpConfig } = req.body;

    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }

    if (!otpCode) {
      return res.status(400).json({ success: false, message: "OTP code is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";

    // Determine SMTP settings
    const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
    const secure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : (port === 465);
    const user = smtpConfig?.user || process.env.SMTP_USER || "info.rataulisaccos@gmail.com";
    const pass = smtpConfig?.pass || process.env.SMTP_PASS || "wkztblmirjnyltga";
    const from = smtpConfig?.from || process.env.SMTP_FROM || `${effectiveCompanyName} <${user}>`;

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

    const logoAttachment = await getLogoAttachment(logoUrl);

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <div style="background: #065f46; padding: 24px 26px 20px 26px; border-radius: 18px 18px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 58px; vertical-align: middle; padding-right: 14px;">
                <div style="width: 52px; height: 52px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.18); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; line-height: 1.25; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                  ${effectiveCompanyName}
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 14px;">
                <div style="font-size: 13.5px; color: #ffffff; font-weight: 600; letter-spacing: 0.3px; text-align: center; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 10px;">
                  ${effectiveAddress}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px 26px; text-align: center; color: #1e293b;">
          <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Password Reset Verification Code</h3>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.5;">
            Hello <strong>${username || 'User'}</strong>, you have requested to reset your account password. Use the 6-digit verification code below to proceed:
          </p>
          <div style="background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 18px; margin: 0 auto 24px auto; max-width: 260px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #047857; display: block;">${otpCode}</span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">If you did not request this, please ignore this email or contact support immediately.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${effectiveCompanyName}. All rights reserved.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from,
      to,
      subject: `Your Verification Code: ${otpCode} - ${effectiveCompanyName}`,
      text: `Hello ${username || 'User'},\n\nYour password reset verification code is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\n${effectiveCompanyName}\n${effectiveAddress}`,
      html: emailHtml,
      attachments: [logoAttachment]
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Verification code successfully sent to ${to}`
    });
  } catch (error: unknown) {
    console.error("OTP Email send error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send verification email.";
    return res.status(500).json({
      success: false,
      message: errMsg
    });
  }
});

// API Route: Send Password Reset Notification Email with Credentials
app.post("/api/send-password-reset-email", async (req, res) => {
  try {
    const { to, userName, username, password, loginUrl, companyName, companyAddress, logoUrl, smtpConfig } = req.body;

    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";
    const effectiveLoginUrl = loginUrl || "https://rataulisaccos.org/login";
    const effectiveUserName = userName || username || "User";
    const effectiveUsername = username || "user";

    // Determine SMTP settings
    const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
    const secure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : (port === 465);
    const user = smtpConfig?.user || process.env.SMTP_USER || "info.rataulisaccos@gmail.com";
    const pass = smtpConfig?.pass || process.env.SMTP_PASS || "wkztblmirjnyltga";
    const from = smtpConfig?.from || process.env.SMTP_FROM || `${effectiveCompanyName} <${user}>`;

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

    const logoAttachment = await getLogoAttachment(logoUrl);

    const plainText = `Dear ${effectiveUserName},

Your password has been reset successfully.

**Username:** ${effectiveUsername}
**Password:** ${password}
**Login:** ${effectiveLoginUrl}

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
                <div style="width: 52px; height: 52px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.18); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; line-height: 1.25; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                  ${effectiveCompanyName}
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 14px;">
                <div style="font-size: 13.5px; color: #ffffff; font-weight: 600; letter-spacing: 0.3px; text-align: center; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 10px;">
                  ${effectiveAddress}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px 28px; color: #1e293b; line-height: 1.6; font-size: 14px;">
          <p style="margin: 0 0 16px 0;">Dear <strong>${effectiveUserName}</strong>,</p>
          <p style="margin: 0 0 20px 0; color: #334155;">Your password has been reset successfully.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00695c; border-radius: 12px; padding: 18px 20px; margin: 0 0 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 110px; font-weight: 600;">Username:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${effectiveUsername}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Password:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #b45309; font-family: monospace; font-size: 15px; letter-spacing: 0.5px;">${password}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Login:</td>
                <td style="padding: 6px 0;">
                  <a href="${effectiveLoginUrl}" style="color: #0284c7; text-decoration: underline; font-weight: 600;" target="_blank">${effectiveLoginUrl}</a>
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
            <strong>${effectiveCompanyName}</strong><br>
            <span style="font-size: 12px; color: #64748b;">${effectiveAddress}</span>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 14px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${effectiveCompanyName}. All rights reserved.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from,
      to,
      subject: `Password Reset Successful - ${effectiveCompanyName}`,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment]
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Password reset credentials email sent successfully to ${to}`
    });
  } catch (error: unknown) {
    console.error("Password reset email send error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send password reset email.";
    return res.status(500).json({
      success: false,
      message: errMsg
    });
  }
});

// API Route: Send Salary Pay Slip / Custom Email with Attachments
app.post("/api/send-pay-slip-email", async (req, res) => {
  try {
    const { to, subject, body, html, attachments: clientAttachments, pdfBase64, filename, smtpConfig } = req.body;

    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, message: "कर्मचारीको ईमेल ठेगाना आवश्यक छ।" });
    }

    // Determine SMTP settings (Priority: UI provided SMTP config > Environment Variables > Default Fallbacks)
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

    // Embed Cooperative Logo if requested or used in template
    if (req.body.logoUrl || (html && html.includes("cid:cooplogo"))) {
      const logoAttachment = await getLogoAttachment(req.body.logoUrl);
      if (logoAttachment) {
        attachments.push(logoAttachment);
      }
    }

    if (clientAttachments && Array.isArray(clientAttachments)) {
      for (const att of clientAttachments) {
        if (att.dataUrl || att.content) {
          const raw = att.dataUrl || att.content;
          const commaIndex = raw.indexOf(",");
          const cleanBase64 = commaIndex !== -1 ? raw.substring(commaIndex + 1).trim() : raw.trim();
          attachments.push({
            filename: att.filename || att.name || "attachment",
            content: Buffer.from(cleanBase64, "base64"),
            contentType: att.type || att.contentType
          });
        }
      }
    }

    if (pdfBase64) {
      // Remove data URI header safely
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
      text: body || "",
      html: html || body || "",
      attachments
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `${to} मा इमेल सफल रूपमा पठाइयो!`
    });
  } catch (error: unknown) {
    console.error("Email send error:", error);
    const errMsg = error instanceof Error ? error.message : "ईमेल पठाउँदा समस्या आयो।";
    return res.status(500).json({
      success: false,
      message: errMsg
    });
  }
});

// API Route: Send Real-Time Ledger Transaction Email Notification
app.post("/api/send-ledger-notification-email", async (req, res) => {
  try {
    const {
      to,
      recipientName,
      employeeCode,
      transactionType, // 'in' | 'out'
      amount,
      particular,
      dateBs,
      dateAd,
      branchName,
      tellerName,
      voucherId,
      previousBalance = 0,
      updatedBalance = 0,
      balanceType = 'balanced', // 'payable' | 'receivable' | 'balanced'
      actionType = 'create', // 'create' | 'edit' | 'delete'
      oldAmount,
      oldParticular,
      companyName,
      companyAddress,
      logoUrl,
      smtpConfig
    } = req.body;

    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, message: "Employee/account email address is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";
    const effectiveBranchName = branchName || "Main Branch";
    const effectiveRecipientName = recipientName || "Respected Member / Staff";
    const numAmount = Number(amount) || 0;
    const numPrevBalance = Number(previousBalance) || 0;
    const numUpdatedBalance = Number(updatedBalance) || 0;
    const isCredit = transactionType === 'in'; // IN = Credit, OUT = Debit
    const baseTypeLabel = isCredit ? 'CREDIT' : 'DEBIT';

    let typeLabel = baseTypeLabel;
    let typeBadgeBg = isCredit ? '#dcfce7' : '#ffe4e6';
    let typeBadgeColor = isCredit ? '#15803d' : '#be123c';
    let typeBadgeBorder = isCredit ? '#86efac' : '#fecdd3';
    let typeDescription = isCredit 
      ? 'Amount credited to account' 
      : 'Amount debited from account';
    let pillLabel = 'LEDGER TRANSACTION ALERT';
    let introText = 'A new ledger transaction entry has been successfully recorded in your account. The transaction breakdown is as follows:';
    let amountHeading = 'TRANSACTION AMOUNT';
    let emailSubject = `Transaction Alert: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;

    if (actionType === 'edit') {
      pillLabel = 'LEDGER TRANSACTION MODIFIED';
      typeLabel = `${baseTypeLabel} (UPDATED)`;
      introText = 'A ledger transaction entry in your account has been edited and updated by the administration. The revised transaction details and updated account balance are as follows:';
      amountHeading = 'UPDATED TRANSACTION AMOUNT';
      typeDescription = isCredit 
        ? 'Amount credited to account (Revised)' 
        : 'Amount debited from account (Revised)';
      emailSubject = `Transaction Updated: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;
    } else if (actionType === 'delete') {
      pillLabel = 'LEDGER TRANSACTION CANCELLED';
      typeLabel = `${baseTypeLabel} (CANCELLED)`;
      typeBadgeBg = '#fee2e2';
      typeBadgeColor = '#991b1b';
      typeBadgeBorder = '#fca5a5';
      introText = 'A ledger transaction entry in your account has been cancelled / deleted by the administration. The reversed transaction details and your updated account balance are as follows:';
      amountHeading = 'CANCELLED TRANSACTION AMOUNT';
      typeDescription = 'Transaction reversed & cancelled from account';
      emailSubject = `Transaction Cancelled / Deleted: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;
    }

    // Status explanation for Updated Balance (Payable vs Receivable)
    let balanceStatusLabel = '';
    let balanceStatusNote = '';
    let balanceCardBg = '#f8fafc';
    let balanceCardBorder = '#e2e8f0';
    let balanceTextColor = '#0f172a';

    if (numUpdatedBalance > 0 || (numUpdatedBalance === 0 && balanceType === 'receivable')) {
      // Positive = Coop owes employee/member -> Employee/member receivable
      balanceStatusLabel = 'RECEIVABLE FROM SACCOS (CREDIT BALANCE)';
      balanceStatusNote = `Following this transaction, the total net balance receivable by you from the cooperative is Rs. ${numUpdatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      balanceCardBg = '#ecfdf5';
      balanceCardBorder = '#a7f3d0';
      balanceTextColor = '#065f46';
    } else if (numUpdatedBalance < 0 || (numUpdatedBalance === 0 && balanceType === 'payable')) {
      // Negative = Employee/member owes coop -> Employee/member payable
      balanceStatusLabel = 'PAYABLE TO SACCOS (DEBIT DUE)';
      balanceStatusNote = `Following this transaction, the total net balance payable by you to the cooperative is Rs. ${Math.abs(numUpdatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      balanceCardBg = '#fff1f2';
      balanceCardBorder = '#fecdd3';
      balanceTextColor = '#9f1239';
    } else {
      balanceStatusLabel = 'FULLY SETTLED (ZERO BALANCE)';
      balanceStatusNote = 'Your account balance is currently fully settled and balanced (no outstanding receivables or payables).';
      balanceCardBg = '#f1f5f9';
      balanceCardBorder = '#cbd5e1';
      balanceTextColor = '#334155';
    }

    // Determine SMTP settings
    const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
    const secure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : (port === 465);
    const user = smtpConfig?.user || process.env.SMTP_USER || "info.rataulisaccos@gmail.com";
    const pass = smtpConfig?.pass || process.env.SMTP_PASS || "wkztblmirjnyltga";
    const from = smtpConfig?.from || process.env.SMTP_FROM || `${effectiveCompanyName} <${user}>`;

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

    const logoAttachment = await getLogoAttachment(logoUrl);

    const plainText = `Dear ${effectiveRecipientName},

${introText}

==============================================
TRANSACTION DETAILS
==============================================
Status: ${typeLabel}
${amountHeading}: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Date: ${dateBs} BS ${dateAd ? `(${dateAd} AD)` : ''}
Particulars / Remarks: ${particular || '-'}
Branch Office: ${effectiveBranchName}
Voucher / Ref ID: ${voucherId || '-'}
Teller / Operator: ${tellerName || 'Teller'}

==============================================
BALANCE SUMMARY (${balanceStatusLabel})
==============================================
${balanceStatusNote}

Previous Balance: Rs. ${Math.abs(numPrevBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numPrevBalance > 0 ? 'Receivable' : numPrevBalance < 0 ? 'Payable' : 'Balanced'})
Current Transaction: ${isCredit ? '+' : '-'} Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${isCredit ? 'Credit' : 'Debit'})
Closing Total Balance: Rs. ${Math.abs(numUpdatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Security Notice: If this transaction was not authorized by you or if there is any discrepancy in these details, please contact your branch office immediately.

Best Regards,
${effectiveCompanyName}
${effectiveAddress}`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.05);">
        <!-- Cooperative Header Banner -->
        <div style="background: #065f46; padding: 16px 20px 12px 20px; border-radius: 14px 14px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 48px; vertical-align: middle; padding-right: 12px;">
                <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); box-shadow: 0 2px 6px rgba(0,0,0,0.15); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="40" height="40" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; color: #ffffff; line-height: 1.25; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                  ${effectiveCompanyName}
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 8px;">
                <div style="font-size: 12px; color: #ffffff; font-weight: 600; letter-spacing: 0.2px; text-align: center; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 6px;">
                  ${effectiveAddress}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Subheader Pill / Notification Title -->
        <div style="background: ${actionType === 'delete' ? '#fff1f2' : '#f0fdf4'}; border-bottom: 1px solid ${actionType === 'delete' ? '#fecdd3' : '#bbf7d0'}; padding: 8px 16px; text-align: center;">
          <span style="background: ${actionType === 'delete' ? '#be123c' : (actionType === 'edit' ? '#0f766e' : '#065f46')}; color: #ffffff; padding: 3px 12px; border-radius: 16px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; display: inline-block;">
            ${pillLabel}
          </span>
        </div>

        <!-- Main Body -->
        <div style="padding: 16px 20px 14px 20px; color: #1e293b; line-height: 1.45;">
          <p style="margin: 0 0 4px 0; font-size: 14.5px; color: #0f172a;">
            Dear <strong>${effectiveRecipientName}</strong>,
          </p>
          <p style="margin: 0 0 12px 0; font-size: 12.5px; color: #475569; line-height: 1.4;">
            ${introText}
          </p>

          <!-- Transaction Details Highlight Card -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="background: ${typeBadgeBg}; color: ${typeBadgeColor}; border: 1px solid ${typeBadgeBorder}; padding: 2px 10px; border-radius: 5px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                ${typeLabel}
              </span>
              <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">
                Date: <strong>${dateBs} BS</strong>
              </span>
            </div>

            <!-- Prominent Amount -->
            <div style="text-align: center; margin: 6px 0 8px 0; padding: 8px 6px; background: #ffffff; border-radius: 8px; border: 1px dashed #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px;">
                ${amountHeading}
              </div>
              <div style="font-size: 24px; font-weight: 900; color: ${actionType === 'delete' ? '#be123c' : (isCredit ? '#059669' : '#e11d48')}; font-family: monospace; letter-spacing: 0.5px; line-height: 1.15;">
                Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style="font-size: 11.5px; font-weight: 600; color: ${actionType === 'delete' ? '#9f1239' : (isCredit ? '#047857' : '#be123c')}; margin-top: 3px;">
                ${typeDescription}
              </div>
            </div>

            <!-- Transaction Metadata Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 4px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; width: 140px; font-weight: 600;">Account Holder:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${effectiveRecipientName}${employeeCode ? ` <span style="font-size: 11px; color: #64748b; font-weight: normal;">(${employeeCode})</span>` : ''}</td>
              </tr>
              ${actionType === 'edit' && oldParticular ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #dc2626; font-weight: 600;">Previous Remarks:</td>
                <td style="padding: 4px 0; font-weight: 500; color: #64748b; text-decoration: line-through;">${oldParticular}</td>
              </tr>` : ''}
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">${actionType === 'edit' ? 'Updated Particulars:' : 'Particulars / Remarks:'}</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${particular || (actionType === 'delete' ? 'Cancelled Ledger Entry' : 'General Ledger Entry')}</td>
              </tr>
              ${actionType === 'edit' && oldAmount !== undefined && oldAmount !== null ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #dc2626; font-weight: 600;">Previous Amount:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #64748b; text-decoration: line-through;">NPR ${Number(oldAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>` : ''}
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Branch Office:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${effectiveBranchName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Teller / Operator:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${tellerName || 'Front Desk Teller'}</td>
              </tr>
              ${voucherId ? `
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Voucher / Ref ID:</td>
                <td style="padding: 4px 0; font-family: monospace; font-size: 11.5px; color: #475569;">${voucherId}</td>
              </tr>` : ''}
            </table>
          </div>

          <!-- Total Balance & Calculation Breakdown Card (Compact & Streamlined) -->
          <div style="background: ${balanceCardBg}; border: 1.5px solid ${balanceCardBorder}; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
            <!-- Concise Balance Clarification Note -->
            <div style="background: #ffffff; border-radius: 8px; padding: 8px 12px; border: 1px solid ${balanceCardBorder}; font-size: 12px; color: #1e293b; line-height: 1.45;">
              <strong>Balance Clarification:</strong><br />
              ${balanceStatusNote}
            </div>

            <!-- Compact Calculation Breakdown Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; background: rgba(255,255,255,0.7); border-radius: 6px; overflow: hidden;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 10px; color: #64748b;">Previous Balance:</td>
                <td style="padding: 6px 10px; text-align: right; font-weight: 700; font-family: monospace;">
                  Rs. ${Math.abs(numPrevBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style="font-size: 10.5px; color: #64748b; font-weight: normal;"> (${numPrevBalance > 0 ? 'Receivable' : numPrevBalance < 0 ? 'Payable' : 'Balanced'})</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 10px; color: #64748b;">Current Transaction:</td>
                <td style="padding: 6px 10px; text-align: right; font-weight: 700; font-family: monospace; color: ${isCredit ? '#059669' : '#e11d48'};">
                  ${isCredit ? '+' : '-'} Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style="font-size: 10.5px; font-weight: normal;"> (${isCredit ? 'Credit' : 'Debit'})</span>
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

          <!-- Security & Contact Note -->
          <div style="background: #f8fafc; border-left: 3.5px solid #065f46; border-radius: 6px; padding: 8px 12px; font-size: 11.5px; color: #475569; margin-bottom: 12px; line-height: 1.4;">
            <strong>Security Notice:</strong> If this transaction was not authorized by you or if there is any discrepancy in these details, please contact your branch office immediately.
          </div>

          <p style="margin: 0; font-size: 12px; color: #334155; line-height: 1.45;">
            Best Regards,<br />
            <strong style="color: #0f172a;">Ratauli Saving and Credit Cooperative Ltd</strong><br />
            Pipra Rural Municipality -6 (Mahottari)
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 10px 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #94a3b8; line-height: 1.4;">
          This is an automated system notification. Please do not reply directly to this email.<br />
          © ${new Date().getFullYear()} Ratauli Saving and Credit Cooperative Ltd. All rights reserved.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from,
      to,
      subject: emailSubject,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment]
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Transaction alert email sent successfully to ${to}!`
    });
  } catch (error: unknown) {
    console.error("Ledger notification email error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send transaction alert email.";
    return res.status(500).json({
      success: false,
      message: errMsg
    });
  }
});

// API Route: Send Leave Status Notification Email (Approval / Rejection / Application)
app.post("/api/send-leave-status-email", async (req, res) => {
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
      status = 'Approved', // 'Approved' | 'Rejected' | 'Pending'
      approverName,
      approvalRemarks,
      totalEntitledDays,
      takenDays,
      remainingDays,
      companyName,
      companyAddress,
      logoUrl,
      smtpConfig
    } = req.body;

    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, message: "Employee email address is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";
    const effectiveEmployeeName = employeeName || "Employee";
    const effectiveLeaveType = leaveType || "General Leave";
    const numDays = Number(days) || 1;
    const daysText = numDays === 1 ? '1 Day' : `${numDays} Days`;

    let pillBg = '#065f46';
    let pillText = '#ffffff';
    let statusLabel = 'APPROVED';
    let statusBadgeBg = '#ecfdf5';
    let statusBadgeColor = '#065f46';
    let statusBadgeBorder = '#a7f3d0';
    let subheaderBg = '#f0fdf4';
    let subheaderBorder = '#bbf7d0';
    let headline = 'Leave Request Approved';
    let introMessage = `We are pleased to inform you that your leave request for <strong>${daysText}</strong> (${effectiveLeaveType}) has been <strong>APPROVED</strong> by the administration.`;
    let emailSubject = `Leave Approved: ${effectiveLeaveType} (${daysText}) - ${effectiveEmployeeName} | ${effectiveCompanyName}`;

    if (status === 'Rejected') {
      pillBg = '#be123c';
      pillText = '#ffffff';
      statusLabel = 'REJECTED';
      statusBadgeBg = '#fff1f2';
      statusBadgeColor = '#9f1239';
      statusBadgeBorder = '#fecdd3';
      subheaderBg = '#fff1f2';
      subheaderBorder = '#fecdd3';
      headline = 'Leave Request Status: Rejected';
      introMessage = `Your leave request for <strong>${daysText}</strong> (${effectiveLeaveType}) has been reviewed by the administration and could not be approved at this time.`;
      emailSubject = `Leave Request Update: Rejected - ${effectiveEmployeeName} | ${effectiveCompanyName}`;
    } else if (status === 'Pending') {
      pillBg = '#2563eb';
      pillText = '#ffffff';
      statusLabel = 'PENDING REVIEW';
      statusBadgeBg = '#eff6ff';
      statusBadgeColor = '#1d4ed8';
      statusBadgeBorder = '#bfdbfe';
      subheaderBg = '#eff6ff';
      subheaderBorder = '#bfdbfe';
      headline = 'Leave Application Registered';
      introMessage = `Your leave application for <strong>${daysText}</strong> (${effectiveLeaveType}) has been received and registered into the HR governance system for administrative review.`;
      emailSubject = `Leave Application Received: ${effectiveLeaveType} (${daysText}) - ${effectiveEmployeeName} | ${effectiveCompanyName}`;
    }

    // Determine SMTP settings
    const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
    const secure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : (port === 465);
    const user = smtpConfig?.user || process.env.SMTP_USER || "info.rataulisaccos@gmail.com";
    const pass = smtpConfig?.pass || process.env.SMTP_PASS || "wkztblmirjnyltga";
    const from = smtpConfig?.from || process.env.SMTP_FROM || `${effectiveCompanyName} <${user}>`;

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

    const logoAttachment = await getLogoAttachment(logoUrl);

    const plainText = `Dear ${effectiveEmployeeName},

${introMessage.replace(/<[^>]+>/g, '')}

==============================================
LEAVE DETAILS & TIME-OFF SUMMARY
==============================================
Status: ${statusLabel}
Employee Name: ${effectiveEmployeeName} ${employeeCode ? `(${employeeCode})` : ''}
Designation / Dept: ${designation || '-'} / ${department || 'GENERAL'}
Leave Category: ${effectiveLeaveType}
Leave Duration: ${daysText}
Leave Schedule: ${startDate} to ${endDate}
Reason / Purpose: ${reason || '-'}
Authorized By: ${approverName || 'Administration / HR Central'}
${approvalRemarks ? `Remarks: ${approvalRemarks}\n` : ''}${totalEntitledDays !== undefined ? `Quota Entitled: ${totalEntitledDays} Days\n` : ''}${remainingDays !== undefined ? `Remaining Leave Balance: ${remainingDays} Days\n` : ''}
For any inquiries regarding your leave balance or scheduling, please consult with your Branch Manager or HR Administration.

Best Regards,
${effectiveCompanyName}
${effectiveAddress}`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.05);">
        <!-- Cooperative Header Banner -->
        <div style="background: #065f46; padding: 16px 20px 12px 20px; border-radius: 14px 14px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 48px; vertical-align: middle; padding-right: 12px;">
                <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); box-shadow: 0 2px 6px rgba(0,0,0,0.15); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="40" height="40" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; color: #ffffff; line-height: 1.25; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                  ${effectiveCompanyName}
                </div>
                <div style="font-size: 11px; color: #a7f3d0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                  HR Central • Leave &amp; Attendance Governance
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 8px;">
                <div style="font-size: 11.5px; color: #ffffff; font-weight: 600; letter-spacing: 0.2px; text-align: center; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 6px;">
                  ${effectiveAddress}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Subheader Pill / Notification Title -->
        <div style="background: ${subheaderBg}; border-bottom: 1px solid ${subheaderBorder}; padding: 8px 16px; text-align: center;">
          <span style="background: ${pillBg}; color: ${pillText}; padding: 3px 14px; border-radius: 16px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; display: inline-block;">
            ${headline}
          </span>
        </div>

        <!-- Main Body Content -->
        <div style="padding: 18px 22px 16px 22px; color: #1e293b; line-height: 1.5;">
          <div style="margin-bottom: 12px;">
            <p style="margin: 0 0 4px 0; font-size: 15px; color: #0f172a; font-weight: 700;">
              Dear <strong>${effectiveEmployeeName}</strong>,
            </p>
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
              ${introMessage}
            </p>
          </div>

          <!-- Highlight Card -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;">
            <!-- Status Badge Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
              <span style="background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeBorder}; padding: 3px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                ${statusLabel}
              </span>
              <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">
                Duration: <strong style="color: #0f172a; font-size: 13px;">${daysText}</strong>
              </span>
            </div>

            <!-- Leave Metadata Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; width: 140px; font-weight: 600;">Staff Name:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${effectiveEmployeeName}${employeeCode ? ` <span style="font-size: 11px; color: #64748b; font-weight: normal;">(Code: ${employeeCode})</span>` : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Designation / Dept:</td>
                <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${designation || '-'} • ${department || 'GENERAL'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Leave Category:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #047857;">${effectiveLeaveType}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Leave Period:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${startDate} to ${endDate}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Reason / Purpose:</td>
                <td style="padding: 5px 0; font-weight: 500; color: #334155;">${reason || 'Personal / General Leave'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Approved / Handled By:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${approverName || 'Administration / HR Central'}</td>
              </tr>
              ${approvalRemarks ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Approval Remarks:</td>
                <td style="padding: 5px 0; font-weight: 600; color: #047857;">${approvalRemarks}</td>
              </tr>
              ` : ''}
            </table>

            <!-- Leave Quota Summary if provided -->
            ${totalEntitledDays !== undefined || remainingDays !== undefined ? `
            <div style="margin-top: 12px; padding: 8px 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11.5px; display: flex; justify-content: space-around; text-align: center;">
              ${totalEntitledDays !== undefined ? `
              <div style="flex: 1; border-right: 1px solid #f1f5f9;">
                <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Total Quota</div>
                <div style="font-weight: 800; color: #0f172a; font-size: 13px; font-family: monospace;">${totalEntitledDays}D</div>
              </div>` : ''}
              ${takenDays !== undefined ? `
              <div style="flex: 1; border-right: 1px solid #f1f5f9;">
                <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Utilized</div>
                <div style="font-weight: 800; color: #e11d48; font-size: 13px; font-family: monospace;">${takenDays}D</div>
              </div>` : ''}
              ${remainingDays !== undefined ? `
              <div style="flex: 1;">
                <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Balance Remaining</div>
                <div style="font-weight: 800; color: #059669; font-size: 13px; font-family: monospace;">${remainingDays}D</div>
              </div>` : ''}
            </div>
            ` : ''}
          </div>

          <!-- HR Note -->
          <div style="background: #f8fafc; border-left: 3px solid #059669; padding: 8px 12px; border-radius: 0 6px 6px 0; font-size: 11.5px; color: #475569; margin-bottom: 12px; line-height: 1.45;">
            <strong>HR Policy Notice:</strong> Please ensure hand-over of critical operational duties to your designated alternate staff prior to proceeding on leave. For any scheduling amendments, kindly submit a request through HR Central.
          </div>

          <!-- Signoff -->
          <p style="margin: 0; font-size: 11.5px; color: #64748b; line-height: 1.5;">
            Best Regards,<br />
            <strong style="color: #0f172a;">HR &amp; Personnel Governance Department</strong><br />
            ${effectiveCompanyName}<br />
            ${effectiveAddress}
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 10px 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #94a3b8; line-height: 1.4;">
          This is an automated HR notification sent via Ratauli SACCOS HR Central.<br />
          © ${new Date().getFullYear()} ${effectiveCompanyName}. All rights reserved.
        </div>
      </div>
    `;

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to,
      subject: emailSubject,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment]
    };

    if (cc && typeof cc === 'string' && cc.trim()) {
      mailOptions.cc = cc.trim();
    }

    const info = await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Leave notification email sent successfully to ${to}!`
    });
  } catch (error: unknown) {
    console.error("Leave notification email error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send leave notification email.";
    return res.status(500).json({
      success: false,
      message: errMsg
    });
  }
});

// API Route: Send Test Email Notification
app.post("/api/send-test-email", async (req, res) => {
  try {
    const { to, companyName, companyAddress, smtpConfig } = req.body;

    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";

    const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
    const secure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : (port === 465);
    const user = smtpConfig?.user || process.env.SMTP_USER || "info.rataulisaccos@gmail.com";
    const pass = smtpConfig?.pass || process.env.SMTP_PASS || "wkztblmirjnyltga";
    const from = smtpConfig?.from || process.env.SMTP_FROM || `${effectiveCompanyName} <${user}>`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from,
      to,
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
            <div><strong>Sender Account:</strong> ${user}</div>
            <div><strong>Recipient:</strong> ${to}</div>
            <div><strong>Timestamp:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' })} (NPT)</div>
          </div>
          <div style="font-size: 11px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 14px;">
            Best Regards,<br />
            <strong>${effectiveCompanyName}</strong><br />
            ${effectiveAddress}
          </div>
        </div>
      `
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Test email sent successfully to ${to}!`
    });
  } catch (error: unknown) {
    console.error("Test email send error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send test email.";
    return res.status(500).json({
      success: false,
      message: errMsg
    });
  }
});

// ==========================================
// TERM LOAN INSURANCE REST API ENDPOINTS
// ==========================================
const INSURANCE_DB_PATH = path.resolve(process.cwd(), "public", "assets", "aistudio", "ratauli_database_16831a73.json");

app.get("/api/insurance/records", async (req, res) => {
  try {
    const fs = await import("fs");
    if (fs.existsSync(INSURANCE_DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(INSURANCE_DB_PATH, "utf-8"));
      return res.json({ success: true, records: data.insurance_records || [] });
    }
    return res.json({ success: true, records: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load records";
    return res.status(500).json({ success: false, message: msg });
  }
});

app.post("/api/insurance/records", async (req, res) => {
  try {
    const { record } = req.body;
    return res.json({ success: true, record });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save record";
    return res.status(500).json({ success: false, message: msg });
  }
});

app.post("/api/insurance/bulk-import", async (req, res) => {
  try {
    const { records } = req.body;
    return res.json({ success: true, imported: (records || []).length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bulk import failed";
    return res.status(500).json({ success: false, message: msg });
  }
});

// Explicit JSON 404 handler for any unmatched /api/* route so it never returns HTML index.html
app.all("/api/*all", (req, res) => {
  res.status(404).json({ success: false, message: "अनुरोध गरिएको API सर्भरमा फेला परेन (API Not Found)।" });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
