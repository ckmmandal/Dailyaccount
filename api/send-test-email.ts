import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, createSmtpTransporter } from "./_emailHelper";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const { to, companyName, companyAddress, smtpConfig } = req.body || {};

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Recipient email address is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";

    const { transporter, user, from } = createSmtpTransporter(smtpConfig, effectiveCompanyName);

    const info = await transporter.sendMail({
      from,
      to: to.trim(),
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
            <div><strong>Timestamp:</strong> ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kathmandu" })} (NPT)</div>
          </div>
          <div style="font-size: 11px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 14px;">
            Best Regards,<br />
            <strong>${effectiveCompanyName}</strong><br />
            ${effectiveAddress}
          </div>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Test email sent successfully to ${to}!`,
    });
  } catch (error: unknown) {
    console.error("Test email error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send test email.";
    return res.status(500).json({
      success: false,
      message: errMsg,
    });
  }
}
