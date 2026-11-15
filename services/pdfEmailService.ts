import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { EmailNotificationSettings } from "../types";
import { storageService } from "./storageService";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

const STORAGE_KEY = "ratauli_smtp_settings_v1";

export function getStoredSmtpConfig(): SmtpConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    user: "info.rataulisaccos@gmail.com",
    pass: "wkztblmirjnyltga",
    from: "रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड <info.rataulisaccos@gmail.com>"
  };
}

export function saveSmtpConfig(config: SmtpConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function getEmailNotificationConfig(): Promise<EmailNotificationSettings> {
  try {
    const settings = await storageService.getSettings();
    if (settings && settings.emailNotifications) {
      return {
        enabled: settings.emailNotifications.enabled !== false,
        transactionAlerts: settings.emailNotifications.transactionAlerts !== false,
        payrollSalarySlips: settings.emailNotifications.payrollSalarySlips !== false,
        securityPasswordReset: settings.emailNotifications.securityPasswordReset !== false,
        dayEndSettlementSummary: settings.emailNotifications.dayEndSettlementSummary !== false,
        leaveAndAttendance: settings.emailNotifications.leaveAndAttendance !== false,
        adminNotificationEmail: settings.emailNotifications.adminNotificationEmail || ""
      };
    }
  } catch (err) {
    console.warn("Could not retrieve email notification config:", err);
  }
  return {
    enabled: true,
    transactionAlerts: true,
    payrollSalarySlips: true,
    securityPasswordReset: true,
    dayEndSettlementSummary: true,
    leaveAndAttendance: true,
    adminNotificationEmail: ""
  };
}

export async function isEmailCategoryAllowed(category: 'transaction' | 'payslip' | 'security' | 'settlement' | 'leave'): Promise<{ allowed: boolean; reason?: string }> {
  const config = await getEmailNotificationConfig();
  if (!config.enabled) {
    return {
      allowed: false,
      reason: "प्रशासक सेटिङबाट सबै प्रकारका ईमेल सूचनाहरू बन्द (Disabled) गरिएको छ।"
    };
  }
  if (category === 'transaction' && !config.transactionAlerts) {
    return {
      allowed: false,
      reason: "कारोबार तथा लेजरसम्बन्धी ईमेल सूचना प्रणाली सेटिङबाट बन्द (Disabled) गरिएको छ।"
    };
  }
  if (category === 'payslip' && !config.payrollSalarySlips) {
    return {
      allowed: false,
      reason: "पेरोल तथा तलब सिट ईमेल सूचना प्रणाली सेटिङबाट बन्द (Disabled) गरिएको छ।"
    };
  }
  if (category === 'security' && !config.securityPasswordReset) {
    return {
      allowed: false,
      reason: "पासवर्ड तथा सुरक्षा ईमेल सूचना प्रणाली सेटिङबाट बन्द (Disabled) गरिएको छ।"
    };
  }
  if (category === 'settlement' && !config.dayEndSettlementSummary) {
    return {
      allowed: false,
      reason: "दैनिक हिसाब बन्द सारांश ईमेल सूचना प्रणाली सेटिङबाट बन्द (Disabled) गरिएको छ।"
    };
  }
  if (category === 'leave' && !config.leaveAndAttendance) {
    return {
      allowed: false,
      reason: "बिदा तथा हाजिरी ईमेल सूचना प्रणाली सेटिङबाट बन्द (Disabled) गरिएको छ।"
    };
  }
  return { allowed: true };
}

export async function generateElementPdfBase64(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
    imageTimeout: 0,
    onclone: (clonedDoc) => {
      const clonedEl = element.id ? clonedDoc.getElementById(element.id) : null;
      if (clonedEl) {
        clonedEl.style.position = "static";
        clonedEl.style.left = "0";
        clonedEl.style.top = "0";
        clonedEl.style.visibility = "visible";
        clonedEl.style.display = "block";
      }
    }
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.88);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
  return pdf.output("datauristring");
}

export async function sendPaySlipApi({
  to,
  subject,
  body,
  html,
  pdfBase64,
  filename,
  smtpConfig
}: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  pdfBase64: string;
  filename: string;
  smtpConfig?: SmtpConfig | null;
}) {
  try {
    const check = await isEmailCategoryAllowed('payslip');
    if (!check.allowed) {
      return {
        success: false,
        disabled: true,
        message: check.reason || "पेरोल तथा तलब सिट सम्बन्धी ईमेल सूचना हाल निष्क्रिय गरिएको छ।"
      };
    }

    const response = await fetch("/api/send-pay-slip-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to,
        subject,
        body,
        html,
        pdfBase64,
        filename,
        smtpConfig: smtpConfig || getStoredSmtpConfig()
      })
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      if (!response.ok && data.success !== false) {
        return { ...data, success: false };
      }
      return data;
    } else {
      const text = await response.text();
      return {
        success: false,
        message: `ईमेल सर्भरबाट गलत प्रतिक्रिया आयो (${response.status}): ${text.substring(0, 100)}`
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Email service error';
    return {
      success: false,
      message: `नेटवर्क वा ईमेल सर्भर त्रुटि: ${errMsg}`
    };
  }
}

export async function sendPasswordResetEmailApi({
  to,
  userName,
  username,
  password,
  loginUrl,
  companyName,
  companyAddress,
  logoUrl,
  smtpConfig
}: {
  to: string;
  userName: string;
  username: string;
  password: string;
  loginUrl?: string;
  companyName?: string;
  companyAddress?: string;
  logoUrl?: string;
  smtpConfig?: SmtpConfig | null;
}): Promise<{ success: boolean; message: string; messageId?: string; disabled?: boolean }> {
  try {
    const check = await isEmailCategoryAllowed('security');
    if (!check.allowed) {
      return {
        success: false,
        disabled: true,
        message: check.reason || "पासवर्ड तथा सुरक्षा ईमेल सूचना प्रणाली हाल निष्क्रिय गरिएको छ।"
      };
    }

    const response = await fetch("/api/send-password-reset-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to,
        userName,
        username,
        password,
        loginUrl: loginUrl || window.location.origin,
        companyName: companyName || "Ratauli Saving and Credit Cooperative Ltd",
        companyAddress: companyAddress || "Pipra Rural Municipality -6 (Mahottari)",
        logoUrl: logoUrl,
        smtpConfig: smtpConfig || getStoredSmtpConfig()
      })
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return data;
    } else {
      const text = await response.text();
      return {
        success: false,
        message: `ईमेल सर्भरबाट गलत प्रतिक्रिया आयो (${response.status}): ${text.substring(0, 100)}`
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      message: `ईमेल पठाउन सकिएन: ${errMsg}`
    };
  }
}

export interface SendLedgerNotificationParams {
  to: string;
  recipientName: string;
  employeeCode?: string;
  transactionType: 'in' | 'out';
  amount: number;
  particular?: string;
  dateBs: string;
  dateAd?: string;
  branchName?: string;
  tellerName?: string;
  voucherId?: string;
  previousBalance?: number;
  updatedBalance?: number;
  balanceType?: 'payable' | 'receivable' | 'balanced';
  actionType?: 'create' | 'edit' | 'delete';
  oldAmount?: number;
  oldParticular?: string;
  companyName?: string;
  companyAddress?: string;
  logoUrl?: string;
  smtpConfig?: SmtpConfig | null;
}

export async function sendLedgerNotificationEmailApi(params: SendLedgerNotificationParams): Promise<{
  success: boolean;
  message: string;
  messageId?: string;
  disabled?: boolean;
}> {
  try {
    const check = await isEmailCategoryAllowed('transaction');
    if (!check.allowed) {
      return {
        success: false,
        disabled: true,
        message: check.reason || "कारोबारसम्बन्धी ईमेल सूचना प्रणाली हाल निष्क्रिय गरिएको छ।"
      };
    }

    const response = await fetch("/api/send-ledger-notification-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...params,
        companyName: params.companyName || "Ratauli Saving and Credit Cooperative Ltd",
        companyAddress: params.companyAddress || "Pipra Rural Municipality -6 (Mahottari)",
        smtpConfig: params.smtpConfig || getStoredSmtpConfig()
      })
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return data;
    } else {
      const text = await response.text();
      return {
        success: false,
        message: `ईमेल सर्भरबाट गलत प्रतिक्रिया आयो (${response.status}): ${text.substring(0, 100)}`
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      message: `ईमेल पठाउन सकिएन: ${errMsg}`
    };
  }
}

export async function sendTestEmailApi({
  to,
  companyName,
  companyAddress,
  smtpConfig
}: {
  to: string;
  companyName?: string;
  companyAddress?: string;
  smtpConfig?: SmtpConfig | null;
}): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("/api/send-test-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to,
        companyName: companyName || "Ratauli Saving and Credit Cooperative Ltd",
        companyAddress: companyAddress || "Pipra Rural Municipality -6 (Mahottari)",
        smtpConfig: smtpConfig || getStoredSmtpConfig()
      })
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return data;
    } else {
      const text = await response.text();
      return {
        success: false,
        message: `परीक्षण ईमेल पठाउन सकिएन (${response.status}): ${text.substring(0, 100)}`
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      message: `परीक्षण ईमेल त्रुटि: ${errMsg}`
    };
  }
}

export interface LeaveNotificationParams {
  to: string;
  cc?: string;
  employeeName: string;
  employeeCode?: string;
  designation?: string;
  department?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'Approved' | 'Rejected' | 'Pending';
  approverName?: string;
  approvalRemarks?: string;
  totalEntitledDays?: number;
  takenDays?: number;
  remainingDays?: number;
  companyName?: string;
  companyAddress?: string;
  logoUrl?: string;
  smtpConfig?: SmtpConfig | null;
}

export async function sendLeaveNotificationEmailApi(params: LeaveNotificationParams): Promise<{
  success: boolean;
  message: string;
  disabled?: boolean;
}> {
  try {
    const check = await isEmailCategoryAllowed('leave');
    if (!check.allowed) {
      return {
        success: false,
        disabled: true,
        message: check.reason || "Leave email notifications are disabled in System Settings."
      };
    }

    const settings = await storageService.getSettings();
    const emailConfig = await getEmailNotificationConfig();
    const adminEmail = emailConfig.adminNotificationEmail?.trim();

    const response = await fetch("/api/send-leave-status-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...params,
        cc: params.cc || (adminEmail && adminEmail !== params.to ? adminEmail : undefined),
        companyName: params.companyName || settings?.systemName || "Ratauli Saving and Credit Cooperative Ltd",
        companyAddress: params.companyAddress || settings?.address || "Pipra Rural Municipality -6 (Mahottari)",
        logoUrl: params.logoUrl || settings?.logoUrl,
        smtpConfig: params.smtpConfig || getStoredSmtpConfig()
      })
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return data;
    } else {
      const text = await response.text();
      return {
        success: false,
        message: `Email server error (${response.status}): ${text.substring(0, 100)}`
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      message: `Failed to send leave notification email: ${errMsg}`
    };
  }
}

export interface AttendanceReportEmailParams {
  to: string;
  employeeName: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  monthName: string;
  yearBs: number | string;
  totalDays: number;
  workingDays: number;
  workedDays: number;
  leaveDays: number;
  lateDays: number;
  absentDays: number;
  htmlContent: string;
  subject?: string;
  pdfBase64?: string;
  logoUrl?: string;
  smtpConfig?: SmtpConfig | null;
}

export async function sendAttendanceReportEmailApi(params: AttendanceReportEmailParams): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const smtp = params.smtpConfig || getStoredSmtpConfig();
    const subject = params.subject || `Monthly Attendance Report - ${params.monthName} ${params.yearBs} (${params.employeeName})`;
    
    const response = await fetch("/api/send-pay-slip-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: params.to,
        subject,
        html: params.htmlContent,
        body: `Monthly Attendance Report for ${params.employeeName} (${params.monthName} ${params.yearBs}).\n\nTotal Days: ${params.totalDays} | Working Days: ${params.workingDays} | Worked: ${params.workedDays} | Leave: ${params.leaveDays} | Late: ${params.lateDays} | Absent: ${params.absentDays}\n\nRatauli Saving and Credit Cooperative Ltd`,
        pdfBase64: params.pdfBase64,
        filename: `Attendance_${params.employeeName.replace(/\s+/g, '_')}_${params.monthName}_${params.yearBs}.pdf`,
        logoUrl: params.logoUrl,
        smtpConfig: smtp
      })
    });
    
    if (response.headers.get("content-type")?.includes("application/json")) {
      const data = await response.json();
      return {
        success: data.success ?? true,
        message: data.message || (data.success ? "Email successfully sent!" : "Failed to send email")
      };
    }
    return { success: response.ok, message: response.ok ? "Email successfully sent!" : "Failed to send email" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error sending email';
    return { success: false, message: msg };
  }
}

