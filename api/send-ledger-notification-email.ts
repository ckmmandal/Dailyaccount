import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, createSmtpTransporter, getLogoAttachment } from "./_emailHelper";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const {
      to,
      recipientName,
      employeeCode,
      transactionType,
      amount,
      particular,
      dateBs,
      dateAd,
      branchName,
      tellerName,
      voucherId,
      previousBalance = 0,
      updatedBalance = 0,
      balanceType = "balanced",
      actionType = "create",
      oldAmount,
      oldParticular,
      companyName,
      companyAddress,
      logoUrl,
      smtpConfig,
    } = req.body || {};

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Employee/account email address is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";
    const effectiveBranchName = branchName || "Main Branch";
    const effectiveRecipientName = recipientName || "Respected Member / Staff";
    const numAmount = Number(amount) || 0;
    const numPrevBalance = Number(previousBalance) || 0;
    const numUpdatedBalance = Number(updatedBalance) || 0;
    const isCredit = transactionType === "in";
    const baseTypeLabel = isCredit ? "CREDIT" : "DEBIT";

    let typeLabel = baseTypeLabel;
    let typeBadgeBg = isCredit ? "#dcfce7" : "#ffe4e6";
    let typeBadgeColor = isCredit ? "#15803d" : "#be123c";
    let typeBadgeBorder = isCredit ? "#86efac" : "#fecdd3";
    let typeDescription = isCredit ? "Amount credited to account" : "Amount debited from account";
    let pillLabel = "LEDGER TRANSACTION ALERT";
    let introText = "A new ledger transaction entry has been successfully recorded in your account. The transaction breakdown is as follows:";
    let amountHeading = "TRANSACTION AMOUNT";
    let emailSubject = `Transaction Alert: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;

    if (actionType === "edit") {
      pillLabel = "LEDGER TRANSACTION MODIFIED";
      typeLabel = `${baseTypeLabel} (UPDATED)`;
      introText = "A ledger transaction entry in your account has been edited and updated by the administration. The revised transaction details and updated account balance are as follows:";
      amountHeading = "UPDATED TRANSACTION AMOUNT";
      typeDescription = isCredit ? "Amount credited to account (Revised)" : "Amount debited from account (Revised)";
      emailSubject = `Transaction Updated: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;
    } else if (actionType === "delete") {
      pillLabel = "LEDGER TRANSACTION CANCELLED";
      typeLabel = `${baseTypeLabel} (CANCELLED)`;
      typeBadgeBg = "#fee2e2";
      typeBadgeColor = "#991b1b";
      typeBadgeBorder = "#fca5a5";
      introText = "A ledger transaction entry in your account has been cancelled / deleted by the administration. The reversed transaction details and your updated account balance are as follows:";
      amountHeading = "CANCELLED TRANSACTION AMOUNT";
      typeDescription = "Transaction reversed & cancelled from account";
      emailSubject = `Transaction Cancelled / Deleted: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${baseTypeLabel}] - ${effectiveRecipientName} | ${effectiveCompanyName}`;
    }

    let balanceStatusLabel = "";
    let balanceStatusNote = "";
    let balanceCardBg = "#f8fafc";
    let balanceCardBorder = "#e2e8f0";
    let balanceTextColor = "#0f172a";

    if (numUpdatedBalance > 0 || (numUpdatedBalance === 0 && balanceType === "receivable")) {
      balanceStatusLabel = "RECEIVABLE FROM SACCOS (CREDIT BALANCE)";
      balanceStatusNote = `Following this transaction, the total net balance receivable by you from the cooperative is Rs. ${numUpdatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      balanceCardBg = "#ecfdf5";
      balanceCardBorder = "#a7f3d0";
      balanceTextColor = "#065f46";
    } else if (numUpdatedBalance < 0 || (numUpdatedBalance === 0 && balanceType === "payable")) {
      balanceStatusLabel = "PAYABLE TO SACCOS (DEBIT DUE)";
      balanceStatusNote = `Following this transaction, the total net balance payable by you to the cooperative is Rs. ${Math.abs(numUpdatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      balanceCardBg = "#fff1f2";
      balanceCardBorder = "#fecdd3";
      balanceTextColor = "#9f1239";
    } else {
      balanceStatusLabel = "FULLY SETTLED (ZERO BALANCE)";
      balanceStatusNote = "Your account balance is currently fully settled and balanced (no outstanding receivables or payables).";
      balanceCardBg = "#f1f5f9";
      balanceCardBorder = "#cbd5e1";
      balanceTextColor = "#334155";
    }

    const { transporter, from } = createSmtpTransporter(smtpConfig, effectiveCompanyName);
    const logoAttachment = await getLogoAttachment(logoUrl);

    const plainText = `Dear ${effectiveRecipientName},

${introText}

Status: ${typeLabel}
${amountHeading}: Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Date: ${dateBs} BS ${dateAd ? `(${dateAd} AD)` : ""}
Particulars: ${particular || "-"}
Branch: ${effectiveBranchName}
Voucher / Ref ID: ${voucherId || "-"}
Teller: ${tellerName || "Teller"}

${balanceStatusLabel}: ${balanceStatusNote}
Previous Balance: Rs. ${Math.abs(numPrevBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Current Transaction: ${isCredit ? "+" : "-"} Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Closing Total Balance: Rs. ${Math.abs(numUpdatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Best Regards,
${effectiveCompanyName}
${effectiveAddress}`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.05);">
        <div style="background: #065f46; padding: 16px 20px 12px 20px; border-radius: 14px 14px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 48px; vertical-align: middle; padding-right: 12px;">
                <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="40" height="40" style="width: 40px; height: 40px; object-fit: contain; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 15px; font-weight: 900; text-transform: uppercase; color: #ffffff; line-height: 1.25;">${effectiveCompanyName}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 8px;">
                <div style="font-size: 12px; color: #ffffff; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 6px;">${effectiveAddress}</div>
              </td>
            </tr>
          </table>
        </div>
        <div style="background: ${actionType === "delete" ? "#fff1f2" : "#f0fdf4"}; border-bottom: 1px solid ${actionType === "delete" ? "#fecdd3" : "#bbf7d0"}; padding: 8px 16px; text-align: center;">
          <span style="background: ${actionType === "delete" ? "#be123c" : actionType === "edit" ? "#0f766e" : "#065f46"}; color: #ffffff; padding: 3px 12px; border-radius: 16px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; display: inline-block;">${pillLabel}</span>
        </div>
        <div style="padding: 16px 20px 14px 20px; color: #1e293b; line-height: 1.45;">
          <p style="margin: 0 0 4px 0; font-size: 14.5px; color: #0f172a;">Dear <strong>${effectiveRecipientName}</strong>,</p>
          <p style="margin: 0 0 12px 0; font-size: 12.5px; color: #475569; line-height: 1.4;">${introText}</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="background: ${typeBadgeBg}; color: ${typeBadgeColor}; border: 1px solid ${typeBadgeBorder}; padding: 2px 10px; border-radius: 5px; font-size: 11px; font-weight: 800; text-transform: uppercase;">${typeLabel}</span>
              <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">Date: <strong>${dateBs} BS</strong></span>
            </div>
            <div style="text-align: center; margin: 6px 0 8px 0; padding: 8px 6px; background: #ffffff; border-radius: 8px; border: 1px dashed #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">${amountHeading}</div>
              <div style="font-size: 24px; font-weight: 900; color: ${actionType === "delete" ? "#be123c" : isCredit ? "#059669" : "#e11d48"}; font-family: monospace;">Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="font-size: 11.5px; font-weight: 600; color: ${actionType === "delete" ? "#9f1239" : isCredit ? "#047857" : "#be123c"}; margin-top: 3px;">${typeDescription}</div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; width: 140px; font-weight: 600;">Account Holder:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${effectiveRecipientName}${employeeCode ? ` (${employeeCode})` : ""}</td>
              </tr>
              ${actionType === "edit" && oldParticular ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 4px 0; color: #dc2626; font-weight: 600;">Previous Remarks:</td><td style="padding: 4px 0; color: #64748b; text-decoration: line-through;">${oldParticular}</td></tr>` : ""}
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">${actionType === "edit" ? "Updated Particulars:" : "Particulars / Remarks:"}</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${particular || (actionType === "delete" ? "Cancelled Ledger Entry" : "General Ledger Entry")}</td>
              </tr>
              ${actionType === "edit" && oldAmount !== undefined && oldAmount !== null ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 4px 0; color: #dc2626; font-weight: 600;">Previous Amount:</td><td style="padding: 4px 0; color: #64748b; text-decoration: line-through;">NPR ${Number(oldAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>` : ""}
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Branch Office:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${effectiveBranchName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Teller / Operator:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${tellerName || "Front Desk Teller"}</td>
              </tr>
              ${voucherId ? `<tr><td style="padding: 4px 0; color: #64748b; font-weight: 600;">Voucher / Ref ID:</td><td style="padding: 4px 0; font-family: monospace; font-size: 11.5px; color: #475569;">${voucherId}</td></tr>` : ""}
            </table>
          </div>
          <div style="background: ${balanceCardBg}; border: 1.5px solid ${balanceCardBorder}; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="background: #ffffff; border-radius: 8px; padding: 8px 12px; border: 1px solid ${balanceCardBorder}; font-size: 12px; color: #1e293b; line-height: 1.45;">
              <strong>Balance Clarification:</strong><br />${balanceStatusNote}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; background: rgba(255,255,255,0.7); border-radius: 6px;">
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; color: #64748b;">Previous Balance:</td><td style="padding: 6px 10px; text-align: right; font-weight: 700; font-family: monospace;">Rs. ${Math.abs(numPrevBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
              <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 6px 10px; color: #64748b;">Current Transaction:</td><td style="padding: 6px 10px; text-align: right; font-weight: 700; font-family: monospace; color: ${isCredit ? "#059669" : "#e11d48"};">${isCredit ? "+" : "-"} Rs. ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
              <tr style="background: #ffffff; font-weight: bold;"><td style="padding: 7px 10px; color: #0f172a;">Closing Total Balance:</td><td style="padding: 7px 10px; text-align: right; font-weight: 900; font-family: monospace; color: ${balanceTextColor};">Rs. ${Math.abs(numUpdatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
            </table>
          </div>
          <p style="margin: 0; font-size: 12px; color: #334155;">Best Regards,<br /><strong>${effectiveCompanyName}</strong><br />${effectiveAddress}</p>
        </div>
        <div style="background: #f8fafc; padding: 10px 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${effectiveCompanyName}. All rights reserved.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from,
      to: to.trim(),
      subject: emailSubject,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment],
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Transaction alert email sent successfully to ${to}!`,
    });
  } catch (error: unknown) {
    console.error("Ledger notification email error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send transaction alert email.";
    return res.status(500).json({
      success: false,
      message: errMsg,
    });
  }
}
