import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SendMailOptions } from "nodemailer";
import { applyCors, createSmtpTransporter, escapeHtml, getLogoAttachment, parseJsonBody, requireVercelAuth, type SmtpPayload } from "./_emailHelper.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  if (!requireVercelAuth(req, res)) return;

  try {
    const parsedBody = await parseJsonBody<{
      to?: string;
      cc?: string;
      employeeName?: string;
      employeeCode?: string;
      designation?: string;
      department?: string;
      leaveType?: string;
      startDate?: string;
      endDate?: string;
      days?: number | string;
      reason?: string;
      status?: string;
      approverName?: string;
      approvalRemarks?: string;
      totalEntitledDays?: number;
      takenDays?: number;
      remainingDays?: number;
      companyName?: string;
      companyAddress?: string;
      logoUrl?: string;
      smtpConfig?: SmtpPayload | null;
    }>(req);

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
      status = "Approved",
      approverName,
      approvalRemarks,
      totalEntitledDays,
      takenDays,
      remainingDays,
      companyName,
      companyAddress,
      logoUrl,
      smtpConfig,
    } = parsedBody;

    if (!to || typeof to !== "string" || !to.trim()) {
      return res.status(400).json({ success: false, message: "Employee email address is required." });
    }

    const effectiveCompanyName = companyName || "Ratauli Saving and Credit Cooperative Ltd";
    const effectiveAddress = companyAddress || "Pipra Rural Municipality -6 (Mahottari)";
    const effectiveEmployeeName = employeeName || "Employee";
    const effectiveLeaveType = leaveType || "General Leave";
    const numDays = Number(days) || 1;
    const daysText = numDays === 1 ? "1 Day" : `${numDays} Days`;

    let pillBg = "#065f46";
    const pillText = "#ffffff";
    let statusLabel = "APPROVED";
    let statusBadgeBg = "#ecfdf5";
    let statusBadgeColor = "#065f46";
    let statusBadgeBorder = "#a7f3d0";
    let subheaderBg = "#f0fdf4";
    let subheaderBorder = "#bbf7d0";
    let headline = "Leave Request Approved";
    let introMessage = `We are pleased to inform you that your leave request for <strong>${daysText}</strong> (${effectiveLeaveType}) has been <strong>APPROVED</strong> by the administration.`;
    let emailSubject = `Leave Approved: ${effectiveLeaveType} (${daysText}) - ${effectiveEmployeeName} | ${effectiveCompanyName}`;

    if (status === "Rejected") {
      pillBg = "#be123c";
      statusLabel = "REJECTED";
      statusBadgeBg = "#fff1f2";
      statusBadgeColor = "#9f1239";
      statusBadgeBorder = "#fecdd3";
      subheaderBg = "#fff1f2";
      subheaderBorder = "#fecdd3";
      headline = "Leave Request Status: Rejected";
      introMessage = `Your leave request for <strong>${daysText}</strong> (${effectiveLeaveType}) has been reviewed by the administration and could not be approved at this time.`;
      emailSubject = `Leave Request Update: Rejected - ${effectiveEmployeeName} | ${effectiveCompanyName}`;
    } else if (status === "Pending") {
      pillBg = "#2563eb";
      statusLabel = "PENDING REVIEW";
      statusBadgeBg = "#eff6ff";
      statusBadgeColor = "#1d4ed8";
      statusBadgeBorder = "#bfdbfe";
      subheaderBg = "#eff6ff";
      subheaderBorder = "#bfdbfe";
      headline = "Leave Application Registered";
      introMessage = `Your leave application for <strong>${daysText}</strong> (${effectiveLeaveType}) has been received and registered into the HR governance system for administrative review.`;
      emailSubject = `Leave Application Received: ${effectiveLeaveType} (${daysText}) - ${effectiveEmployeeName} | ${effectiveCompanyName}`;
    }

    const { transporter, from } = createSmtpTransporter(smtpConfig, effectiveCompanyName);
    const logoAttachment = await getLogoAttachment(logoUrl);

    const plainText = `Dear ${effectiveEmployeeName},

${introMessage.replace(/<[^>]+>/g, "")}

==============================================
LEAVE DETAILS & TIME-OFF SUMMARY
==============================================
Status: ${statusLabel}
Employee Name: ${effectiveEmployeeName} ${employeeCode ? `(${employeeCode})` : ""}
Designation / Dept: ${designation || "-"} / ${department || "GENERAL"}
Leave Category: ${effectiveLeaveType}
Leave Duration: ${daysText}
Leave Schedule: ${startDate} to ${endDate}
Reason / Purpose: ${reason || "-"}
Authorized By: ${approverName || "Administration / HR Central"}
${approvalRemarks ? `Remarks: ${approvalRemarks}\n` : ""}${totalEntitledDays !== undefined ? `Quota Entitled: ${totalEntitledDays} Days\n` : ""}${remainingDays !== undefined ? `Remaining Leave Balance: ${remainingDays} Days\n` : ""}
For any inquiries regarding your leave balance or scheduling, please consult with your Branch Manager or HR Administration.

Best Regards,
${effectiveCompanyName}
${effectiveAddress}`;

    const safeCompany = escapeHtml(effectiveCompanyName);
    const safeAddress = escapeHtml(effectiveAddress);
    const safeEmpName = escapeHtml(effectiveEmployeeName);
    const safeEmpCode = employeeCode ? escapeHtml(employeeCode) : "";
    const safeDesignation = escapeHtml(designation || "-");
    const safeDepartment = escapeHtml(department || "GENERAL");
    const safeLeaveType = escapeHtml(effectiveLeaveType);
    const safeStartDate = escapeHtml(startDate || "-");
    const safeEndDate = escapeHtml(endDate || "-");
    const safeReason = escapeHtml(reason || "Personal / General Leave");
    const safeApprover = escapeHtml(approverName || "Administration / HR Central");
    const safeRemarks = approvalRemarks ? escapeHtml(approvalRemarks) : "";
    const safeIntroHtml = introMessage.replace(effectiveLeaveType, safeLeaveType);

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.05);">
        <div style="background: #065f46; padding: 16px 20px 12px 20px; border-radius: 14px 14px 0 0; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 48px; vertical-align: middle; padding-right: 12px;">
                <div style="width: 44px; height: 44px; background: #ffffff; border-radius: 50%; padding: 2px; text-align: center; border: 2px solid rgba(255,255,255,0.95); overflow: hidden; display: inline-block;">
                  <img src="cid:cooplogo" alt="Logo" width="40" height="40" style="width: 40px; height: 40px; object-fit: contain; display: block; border-radius: 50%; margin: 0 auto;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; color: #ffffff; line-height: 1.25;">
                  ${safeCompany}
                </div>
                <div style="font-size: 11px; color: #a7f3d0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                  HR Central • Leave &amp; Attendance Governance
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: center; padding-top: 8px;">
                <div style="font-size: 11.5px; color: #ffffff; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 6px;">
                  ${safeAddress}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="background: ${subheaderBg}; border-bottom: 1px solid ${subheaderBorder}; padding: 8px 16px; text-align: center;">
          <span style="background: ${pillBg}; color: ${pillText}; padding: 3px 14px; border-radius: 16px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; display: inline-block;">
            ${headline}
          </span>
        </div>
        <div style="padding: 18px 22px 16px 22px; color: #1e293b; line-height: 1.5;">
          <div style="margin-bottom: 12px;">
            <p style="margin: 0 0 4px 0; font-size: 15px; color: #0f172a; font-weight: 700;">Dear <strong>${safeEmpName}</strong>,</p>
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">${safeIntroHtml}</p>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
              <span style="background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeBorder}; padding: 3px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">${statusLabel}</span>
              <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">Duration: <strong style="color: #0f172a; font-size: 13px;">${escapeHtml(daysText)}</strong></span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; width: 140px; font-weight: 600;">Staff Name:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${safeEmpName}${safeEmpCode ? ` <span style="font-size: 11px; color: #64748b; font-weight: normal;">(Code: ${safeEmpCode})</span>` : ""}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Designation / Dept:</td>
                <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${safeDesignation} • ${safeDepartment}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Leave Category:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #047857;">${safeLeaveType}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Leave Period:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${safeStartDate} to ${safeEndDate}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Reason / Purpose:</td>
                <td style="padding: 5px 0; font-weight: 500; color: #334155;">${safeReason}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Approved / Handled By:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${safeApprover}</td>
              </tr>
              ${safeRemarks ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Approval Remarks:</td>
                <td style="padding: 5px 0; font-weight: 600; color: #047857;">${safeRemarks}</td>
              </tr>` : ""}
            </table>
            ${totalEntitledDays !== undefined || remainingDays !== undefined ? `
            <div style="margin-top: 12px; padding: 8px 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11.5px; display: flex; justify-content: space-around; text-align: center;">
              ${totalEntitledDays !== undefined ? `<div style="flex: 1; border-right: 1px solid #f1f5f9;"><div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Total Quota</div><div style="font-weight: 800; color: #0f172a; font-size: 13px; font-family: monospace;">${escapeHtml(totalEntitledDays)}D</div></div>` : ""}
              ${takenDays !== undefined ? `<div style="flex: 1; border-right: 1px solid #f1f5f9;"><div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Utilized</div><div style="font-weight: 800; color: #e11d48; font-size: 13px; font-family: monospace;">${escapeHtml(takenDays)}D</div></div>` : ""}
              ${remainingDays !== undefined ? `<div style="flex: 1;"><div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Balance Remaining</div><div style="font-weight: 800; color: #059669; font-size: 13px; font-family: monospace;">${escapeHtml(remainingDays)}D</div></div>` : ""}
            </div>` : ""}
          </div>
          <p style="margin: 0; font-size: 11.5px; color: #64748b; line-height: 1.5;">
            Best Regards,<br />
            <strong style="color: #0f172a;">HR &amp; Personnel Governance Department</strong><br />
            ${safeCompany}<br />
            ${safeAddress}
          </p>
        </div>
        <div style="background: #f8fafc; padding: 10px 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #94a3b8;">
          © ${new Date().getFullYear()} ${safeCompany}. All rights reserved.
        </div>
      </div>
    `;

    const mailOptions: SendMailOptions = {
      from,
      to: to.trim(),
      subject: emailSubject,
      text: plainText,
      html: emailHtml,
      attachments: [logoAttachment],
    };

    if (cc && typeof cc === "string" && cc.trim()) {
      mailOptions.cc = cc.trim();
    }

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Leave notification email sent successfully to ${to}!`,
    });
  } catch (error: unknown) {
    console.error("Leave notification email error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to send leave notification email.";
    return res.status(500).json({
      success: false,
      message: errMsg,
    });
  }
}
