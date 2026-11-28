import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, parseJsonBody, requireVercelAuth } from "../../../_emailHelper.js";
import {
  hashPassword,
  isPasswordHashed,
  isSameOriginMutationAllowed,
  resolveLiveUserAuthz,
} from "../../../_authHelper.js";

const SETTINGS_GOVERNANCE_TABLES = new Set([
  "roles",
  "branches",
  "branch_operational_status",
  "branch_operational_logs",
  "branch_fixed_expense_configs",
  "remittance_companies",
  "saving_products",
  "loan_products",
  "insurance_companies",
  "depreciation_settings",
  "depreciation_financial_years",
  "mf_settings",
  "tax_policy",
  "tax_configs",
  "tax_adjustments",
]);

const HR_ADMIN_WRITE_TABLES = new Set([
  "employees",
  "payroll_records",
  "leave_types",
  "holidays",
  "board_members",
]);

const HR_ADMIN_DELETE_TABLES = new Set(["attendance_records", "leave_requests"]);
const NOTICE_WRITE_TABLES = new Set(["notices", "downloadable_documents"]);

const FINANCIAL_DELETE_PROTECTED_TABLES = new Set([
  "daily_data",
  "daily_cash_data",
  "front_teller_counter_entries",
  "front_teller_deno_adjustments",
  "front_teller_ledger_entries",
  "front_teller_remittance_entries",
  "front_teller_vault_entries",
  "back_office_entries",
  "remittance_entries",
  "office_expenses",
  "saved_office_expense_sheets",
  "ledger_accounts",
  "fd_records",
  "loan_insurance_records",
  "insurance_claims",
  "mf_loans",
  "mf_deposit_sheets",
  "fixed_assets",
  "asset_categories",
  "asset_transfers",
  "depreciation_entries",
  "depreciation_vouchers",
]);

const ADMIN_SETTINGS_IDS = new Set([
  "global",
  "saccos_branches_meta",
  "saccos_branch_operational_statuses",
  "saccos_app_holidays",
  "saccos_weekend_days",
]);

function isAdminOnlySettingId(id: string): boolean {
  const normalized = id.replace(/^eq\./, "").trim();
  if (!normalized) return true;
  if (ADMIN_SETTINGS_IDS.has(normalized)) return true;
  if (normalized.startsWith("saccos_board_")) return true;
  return false;
}

function isHrProtectedSettingId(id: string): boolean {
  const normalized = id.replace(/^eq\./, "").trim();
  return normalized === "employee_kyc_store" || normalized.startsWith("employee_kyc_");
}

function stripPasswordsFromPayload(data: unknown): unknown {
  if (Array.isArray(data)) return data.map((item) => stripPasswordsFromPayload(item));
  if (data && typeof data === "object") {
    const clone = { ...(data as Record<string, unknown>) };
    if ("password" in clone) delete clone.password;
    return clone;
  }
  return data;
}

function sanitizeSelfUserUpdateBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const clone = { ...(body as Record<string, unknown>) };
  delete clone.role;
  delete clone.role_id;
  delete clone.roleId;
  delete clone.permissions;
  delete clone.is_admin;
  delete clone.isAdmin;
  delete clone.status;
  return clone;
}

function hashPasswordsInWriteBody(body: unknown): unknown {
  if (Array.isArray(body)) return body.map((item) => hashPasswordsInWriteBody(item));
  if (body && typeof body === "object") {
    const clone = { ...(body as Record<string, unknown>) };
    if (typeof clone.password === "string" && clone.password.trim() && !isPasswordHashed(clone.password)) {
      clone.password = hashPassword(clone.password);
    }
    return clone;
  }
  return body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    if (!isSameOriginMutationAllowed(req)) {
      return res.status(403).json({ message: "Cross-origin state-changing requests are not permitted." });
    }

    const rawTable = req.query.table;
    const table = (Array.isArray(rawTable) ? rawTable[0] : String(rawTable || "")).trim();
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      return res.status(400).json({ message: "Invalid table identifier." });
    }

    const method = (req.method || "GET").toUpperCase();
    const isReadOnly = method === "GET" || method === "HEAD";

    const idParam = typeof req.query.id === "string" ? req.query.id.trim() : "";
    const isPublicGlobalBrandingRead = isReadOnly && table === "settings" && idParam === "eq.global";

    let authUser = null;
    if (!isPublicGlobalBrandingRead) {
      authUser = requireVercelAuth(req, res);
      if (!authUser) return;
    }

    let isAdmin = false;
    let permissions = new Set<string>();
    if (authUser) {
      const liveAuthz = await resolveLiveUserAuthz(authUser);
      if (!liveAuthz.active) {
        return res.status(401).json({ message: "Account is deactivated. Please contact the administrator." });
      }
      isAdmin = liveAuthz.isAdmin;
      permissions = liveAuthz.permissions;
    }

    const hasPerm = (perm: string) => isAdmin || permissions.has(perm);

    if (table === "audit_logs" && (method === "DELETE" || method === "PATCH" || method === "PUT")) {
      return res.status(403).json({ message: "Audit logs cannot be modified or deleted." });
    }
    if (!isReadOnly && SETTINGS_GOVERNANCE_TABLES.has(table) && !hasPerm("manage_settings")) {
      return res.status(403).json({ message: "Administrator or Settings permissions are required to modify this resource." });
    }
    if (!isReadOnly && HR_ADMIN_WRITE_TABLES.has(table) && !hasPerm("manage_hr")) {
      return res.status(403).json({ message: "HR Management permissions are required to modify HR or payroll records." });
    }
    if (method === "DELETE" && HR_ADMIN_DELETE_TABLES.has(table) && !hasPerm("manage_hr")) {
      return res.status(403).json({ message: "HR Management permissions are required to delete attendance or leave records." });
    }
    if (!isReadOnly && NOTICE_WRITE_TABLES.has(table) && !hasPerm("manage_notices")) {
      return res.status(403).json({ message: "Notice management permissions are required to modify notices or downloads." });
    }
    if (method === "DELETE" && FINANCIAL_DELETE_PROTECTED_TABLES.has(table) && !hasPerm("delete_transaction")) {
      return res.status(403).json({ message: "Delete Transaction permissions are required to remove financial records." });
    }

    let parsedBody: unknown = undefined;
    if (!isReadOnly) {
      parsedBody = await parseJsonBody<unknown>(req);
    }

    if (!isReadOnly && table === "settings" && !isAdmin) {
      const queryId = typeof req.query.id === "string" ? req.query.id : "";
      const bodyItems = Array.isArray(parsedBody) ? parsedBody : parsedBody && typeof parsedBody === "object" ? [parsedBody] : [];
      const candidateIds: string[] = [];
      if (queryId) candidateIds.push(queryId);
      for (const item of bodyItems) {
        if (item && typeof item === "object" && "id" in item) {
          candidateIds.push(String((item as Record<string, unknown>).id || ""));
        }
      }
      if (candidateIds.length === 0) {
        return res.status(403).json({ message: "Administrator privileges are required to modify global settings." });
      }
      for (const cid of candidateIds) {
        if (isAdminOnlySettingId(cid) && !hasPerm("manage_settings")) {
          return res.status(403).json({ message: "Administrator privileges are required to modify global settings." });
        }
        if (isHrProtectedSettingId(cid) && !hasPerm("manage_hr")) {
          return res.status(403).json({ message: "HR Management permissions are required to modify employee KYC records." });
        }
      }
    }

    let isNonAdminSelfUserUpdate = false;
    if (!isReadOnly && table === "users" && !hasPerm("manage_users")) {
      if (method === "DELETE") {
        return res.status(403).json({ message: "Only administrators can delete user accounts." });
      }
      const queryId = typeof req.query.id === "string" ? req.query.id : "";
      const bodyId =
        parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
          ? String((parsedBody as Record<string, unknown>).id || "")
          : "";
      const isSelfUpdate = authUser && (queryId === `eq.${authUser.sub}` || (bodyId !== "" && bodyId === authUser.sub));
      if (!isSelfUpdate) {
        return res.status(403).json({ message: "Administrator privileges are required to manage other users." });
      }
      isNonAdminSelfUserUpdate = true;
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const supabaseKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ""
    ).trim();

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ message: "Supabase server configuration is missing." });
    }

    // Reconstruct PostgREST query string without Vercel's synthetic dynamic route `table` parameter
    const rawUrl = req.url || "";
    const qIdx = rawUrl.indexOf("?");
    let queryString = "";
    if (qIdx !== -1) {
      const sp = new URLSearchParams(rawUrl.slice(qIdx + 1));
      sp.delete("table");
      const rebuilt = sp.toString();
      if (rebuilt) queryString = `?${rebuilt}`;
    }

    const targetUrl = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}${queryString}`;
    const forwardHeaders: Record<string, string> = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    };

    const allowedHeaders = ["accept", "content-type", "prefer", "range", "accept-profile", "content-profile"];
    for (const h of allowedHeaders) {
      const val = req.headers[h];
      if (typeof val === "string" && val.trim()) {
        forwardHeaders[h] = val;
      }
    }

    let requestBody: string | undefined;
    if (!isReadOnly && parsedBody !== undefined) {
      let safeBody: unknown = parsedBody;
      if (table === "users") {
        if (isNonAdminSelfUserUpdate) {
          safeBody = sanitizeSelfUserUpdateBody(safeBody);
        }
        safeBody = hashPasswordsInWriteBody(safeBody);
      }
      requestBody = typeof safeBody === "string" ? safeBody : JSON.stringify(safeBody);
      if (!forwardHeaders["content-type"]) {
        forwardHeaders["content-type"] = "application/json";
      }
    }

    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: requestBody,
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    const contentRange = upstream.headers.get("content-range");
    res.status(upstream.status);
    res.setHeader("content-type", contentType);
    if (contentRange) {
      res.setHeader("content-range", contentRange);
    }

    if (method === "HEAD" || upstream.status === 204) {
      return res.end();
    }

    const rawText = await upstream.text();
    if (table === "users" && contentType.includes("application/json") && rawText.trim()) {
      try {
        const parsed = JSON.parse(rawText);
        return res.send(JSON.stringify(stripPasswordsFromPayload(parsed)));
      } catch {
        return res.send(rawText);
      }
    }

    return res.send(rawText);
  } catch (err: unknown) {
    console.error("Vercel Supabase proxy error:", err);
    return res.status(502).json({ message: "Database proxy request failed." });
  }
}
