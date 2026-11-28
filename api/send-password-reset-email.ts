import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, createSmtpTransporter, DEFAULT_APP_URL, escapeHtml, getLogoAttachment, parseJsonBody, requireVercelAuth, safeHttpUrl, type SmtpPayload } from "./_emailHelper.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  if (!requireVercelAuth(req, res, { adminOnly: true })) return;

  try {
    const parsedBody = await parseJsonBody<{
      to?: string;
      userName?: string;
      username?: string;
      password?: string;
      loginUrl?: string;
      companyName?: string;
      companyAddress?: string;
      logoUrl?: string;
      smtpConfig?: SmtpPayload | null;
    }>(req);
    const { to, userName, username, password, loginUrl, companyName, companyAddress, logoUrl, smtpConfig } = parsedBody;

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";
    const effectiveLoginUrl = safeHttpUrl(loginUrl, DEFAULT_APP_URL);
    const effectiveUserName = userName || username || "User";
    const effectiveUsername = username || "user";

    const safeCompany = escapeHtml(effectiveCompanyName);
    const safeAddress = escapeHtml(effectiveAddress);
    const safeLoginUrl = escapeHtml(effectiveLoginUrl);
    const safeUserName = escapeHtml(effectiveUserName);
    const safeUsername = escapeHtml(effectiveUsername);
    const safePassword = escapeHtml(password);

    const { transporter, from } = createSmtpTransporter(smtpConfig, effectiveCompanyName);
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
        <div style="padding: 32px 28px; color: #1e293b; line-height: 1.6; font-size: 14px;">
          <p style="margin: 0 0 16px 0;">Dear <strong>${safeUserName}</strong>,</p>
          <p style="margin: 0 0 20px 0; color: #334155;">Your password has been reset successfully.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00695c; border-radius: 12px; padding: 18px 20px; margin: 0 0 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 110px; font-weight: 600;">Username:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${safeUsername}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Password:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #b45309; font-family: monospace; font-size: 15px; letter-spacing: 0.5px;">${safePassword}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Login:</td>
                <td style="padding: 6px 0;">
                  <a href="${safeLoginUrl}" style="color: #0284c7; text-decoration: underline; font-weight: 600;" target="_blank" rel="noopener noreferrer">${safeLoginUrl}</a>
                </td>
              </tr>
            </table>
          </div>
          <p style="margin: 0 0 12px 0; color: #475569; font-size: 13px;">Please keep your credentials secure and change your password after logging in.</p>
          <p style="margin: 0 0 24px 0; color: #64748b; font-size: 12.5px;">If you did not request this change, please contact the administrator.</p>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; color: #334155; font-size: 13px;">
            Regards,<br />
            <strong>${safeCompany}</strong><br />
            <span style="font-size: 12px; color: #64748b;">${safeAddress}</span>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 14px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${safeCompany}. All rights reserved.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from,
      to: to.trim(),
      subject: `Password Reset Successful - ${effectiveCompanyName}`,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment],
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Password reset credentials email sent successfully to ${to}`,
    });
  } catch (error: unknown) {
    console.error("Password reset email send error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send password reset email.";
    return res.status(500).json({
      success: false,
      message: errMsg,
    });
  }
}
