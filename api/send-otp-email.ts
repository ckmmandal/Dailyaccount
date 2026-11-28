import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, createSmtpTransporter, escapeHtml, getLogoAttachment, parseJsonBody, requireVercelAuth, type SmtpPayload } from "./_emailHelper.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  if (!requireVercelAuth(req, res, { adminOnly: true })) return;

  try {
    const parsedBody = await parseJsonBody<{
      to?: string;
      username?: string;
      otpCode?: string;
      companyName?: string;
      companyAddress?: string;
      logoUrl?: string;
      smtpConfig?: SmtpPayload | null;
    }>(req);
    const { to, username, otpCode, companyName, companyAddress, logoUrl, smtpConfig } = parsedBody;

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }

    if (!otpCode) {
      return res.status(400).json({ success: false, message: "OTP code is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";
    const safeCompany = escapeHtml(effectiveCompanyName);
    const safeAddress = escapeHtml(effectiveAddress);
    const safeUsername = escapeHtml(username || "User");
    const safeOtp = escapeHtml(otpCode);

    const { transporter, from } = createSmtpTransporter(smtpConfig, effectiveCompanyName);
    const logoAttachment = await getLogoAttachment(logoUrl);

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <div style="background: #065f46; padding: 24px 26px 20px 26px; border-radius: 18px 18px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 58px; vertical-align: middle; padding-right: 14px;">
                <div style="width: 52px; height: 52px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; line-height: 1.25;">
                  ${safeCompany}
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 14px;">
                <div style="font-size: 13.5px; color: #ffffff; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 10px;">
                  ${safeAddress}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px 26px; text-align: center; color: #1e293b;">
          <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Password Reset Verification Code</h3>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.5;">
            Hello <strong>${safeUsername}</strong>, you have requested to reset your account password. Use the 6-digit verification code below to proceed:
          </p>
          <div style="background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 18px; margin: 0 auto 24px auto; max-width: 260px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #047857; display: block;">${safeOtp}</span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">If you did not request this, please ignore this email or contact support immediately.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${safeCompany}. All rights reserved.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from,
      to: to.trim(),
      subject: `Your Verification Code: ${otpCode} - ${effectiveCompanyName}`,
      text: `Hello ${username || "User"},\n\nYour password reset verification code is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\n${effectiveCompanyName}\n${effectiveAddress}`,
      html: emailHtml,
      attachments: [logoAttachment],
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Verification code successfully sent to ${to}`,
    });
  } catch (error: unknown) {
    console.error("OTP Email send error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send verification email.";
    return res.status(500).json({
      success: false,
      message: errMsg,
    });
  }
}
