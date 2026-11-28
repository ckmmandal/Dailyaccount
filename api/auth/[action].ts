import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import {
  applyCors,
  createSmtpTransporter,
  escapeHtml,
  getLogoAttachment,
  parseJsonBody,
  requireVercelAuth,
} from "../_emailHelper.js";
import {
  clearSessionCookie,
  getServerSupabase,
  getSessionSecret,
  hashPassword,
  isPasswordHashed,
  issueSessionForUser,
  mapDbUserRowToClientUser,
  maskEmailAddress,
  setSessionCookie,
  signStatelessToken,
  validateStrongPasswordServer,
  verifyPassword,
  verifyStatelessToken,
} from "../_authHelper.js";

interface StatelessOtpPayload {
  kind: "otp";
  userId: string;
  username: string;
  email: string;
  otpHash: string;
  exp: number;
}

function sha256Hmac(val: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(val).digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const rawAction = req.query.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : String(rawAction || "").trim().toLowerCase();

  try {
    if (action === "bootstrap-status" && req.method === "GET") {
      if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
        return res.status(200).json({ success: true, needsBootstrap: false });
      }
      const sb = getServerSupabase();
      if (!sb) {
        return res.status(200).json({ success: true, needsBootstrap: false });
      }
      const { count, error } = await sb.from("users").select("id", { count: "exact", head: true });
      if (error) {
        return res.status(200).json({ success: true, needsBootstrap: false });
      }
      return res.status(200).json({ success: true, needsBootstrap: (count ?? 0) === 0 });
    }

    if (action === "bootstrap-admin" && req.method === "POST") {
      if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
        return res.status(403).json({ success: false, message: "Bootstrap setup is locked by server configuration." });
      }
      const sb = getServerSupabase();
      if (!sb) {
        return res.status(503).json({ success: false, message: "Database service unavailable." });
      }
      const { count, error: countErr } = await sb.from("users").select("id", { count: "exact", head: true });
      if (countErr || (count ?? 0) > 0) {
        return res.status(403).json({ success: false, message: "Administrator account has already been initialized." });
      }

      const body = await parseJsonBody<{
        username?: string;
        fullName?: string;
        email?: string;
        mobile?: string;
        password?: string;
      }>(req);

      const cleanUsername = String(body.username || "admin").trim().toLowerCase();
      const cleanFullName = String(body.fullName || "System Administrator").trim();
      const pwErr = validateStrongPasswordServer(String(body.password || ""));
      if (!/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
        return res.status(400).json({ success: false, message: "Username must be 3-40 alphanumeric characters." });
      }
      if (pwErr) {
        return res.status(400).json({ success: false, message: pwErr });
      }

      const adminPerms = [
        "view_transaction", "add_transaction", "edit_transaction", "delete_transaction",
        "view_reports", "manage_users", "manage_settings", "view_cash_entry",
        "view_daily_ledger", "view_income_expense", "view_ledger_names",
        "view_consolidated_report", "cross_branch_operation", "manage_hr", "manage_notices",
      ];

      const newAdminRow = {
        id: `admin-${crypto.randomUUID()}`,
        username: cleanUsername,
        password: hashPassword(String(body.password)),
        full_name: cleanFullName,
        role_id: "1",
        branch_id: "main",
        permissions: adminPerms,
        status: "Active",
        email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
        mobile: typeof body.mobile === "string" && body.mobile.trim() ? body.mobile.trim() : null,
        account_created: Date.now(),
      };

      const { error: insertErr } = await sb.from("users").insert(newAdminRow);
      if (insertErr) {
        return res.status(500).json({ success: false, message: "Failed to initialize administrator account." });
      }

      const safeUser = mapDbUserRowToClientUser(newAdminRow);
      const token = issueSessionForUser(safeUser);
      setSessionCookie(res, token);
      return res.status(200).json({ success: true, user: safeUser, token });
    }

    if (action === "login" && req.method === "POST") {
      if (!getSessionSecret()) {
        return res.status(503).json({
          success: false,
          message: "Server SESSION_SECRET is not configured in Vercel Environment Variables.",
        });
      }

      const body = await parseJsonBody<{ username?: string; password?: string }>(req);
      const enteredUsername = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      const enteredPassword = typeof body.password === "string" ? body.password : "";

      if (!enteredUsername || !enteredPassword) {
        return res.status(400).json({ success: false, message: "Username and password are required." });
      }

      const sb = getServerSupabase();
      if (!sb) {
        return res.status(503).json({ success: false, message: "Authentication database is not configured." });
      }

      const { data: rows, error } = await sb
        .from("users")
        .select("*")
        .ilike("username", enteredUsername)
        .limit(5);

      if (error) {
        console.error("Vercel login DB query error:", error.message);
        return res.status(500).json({
          success: false,
          message: "Could not verify credentials. Check SUPABASE_SERVICE_ROLE_KEY in server environment variables.",
        });
      }

      const matchedRow = (rows || []).find(
        (r) => typeof r.username === "string" && r.username.trim().toLowerCase() === enteredUsername
      );

      if (!matchedRow) {
        const envBootstrapPw = process.env.ADMIN_BOOTSTRAP_PASSWORD;
        if (envBootstrapPw && enteredUsername === "admin") {
          const { count } = await sb.from("users").select("id", { count: "exact", head: true });
          if ((count ?? 0) === 0 && verifyPassword(enteredPassword, envBootstrapPw).valid) {
            const safeAdmin = {
              id: "admin-bootstrap",
              username: "admin",
              fullName: "System Administrator",
              roleId: "1",
              branchId: "main",
              status: "Active" as const,
              accountCreated: Date.now(),
              permissions: [
                "view_transaction", "add_transaction", "edit_transaction", "delete_transaction",
                "view_reports", "manage_users", "manage_settings", "view_cash_entry",
                "view_daily_ledger", "view_income_expense", "view_ledger_names",
                "view_consolidated_report", "cross_branch_operation", "manage_hr", "manage_notices",
              ],
            };
            const token = issueSessionForUser(safeAdmin);
            setSessionCookie(res, token);
            return res.status(200).json({ success: true, user: safeAdmin, token });
          }
        }
        return res.status(401).json({ success: false, message: "Invalid username or password." });
      }

      if (matchedRow.status === "Inactive") {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact the administrator.",
        });
      }

      const check = verifyPassword(enteredPassword, typeof matchedRow.password === "string" ? matchedRow.password : "");
      if (!check.valid) {
        return res.status(401).json({ success: false, message: "Invalid username or password." });
      }

      if (check.needsMigration) {
        try {
          const upgradedHash = hashPassword(enteredPassword);
          await sb.from("users").update({ password: upgradedHash }).eq("id", matchedRow.id);
        } catch (migErr) {
          console.warn("Legacy password migration notice:", migErr);
        }
      }

      const safeUser = mapDbUserRowToClientUser(matchedRow as Record<string, unknown>);
      if (!safeUser.branchId || !safeUser.designation) {
        try {
          const { data: emps } = await sb.from("employees").select("full_name, email, employee_code, branch_id, designation");
          if (Array.isArray(emps)) {
            const linked = emps.find((e) => {
              const empName = String(e.full_name || "").toLowerCase().trim();
              const uName = safeUser.fullName.toLowerCase().trim();
              const empEmail = String(e.email || "").toLowerCase().trim();
              const uEmail = (safeUser.email || "").toLowerCase().trim();
              const empCode = String(e.employee_code || "").toLowerCase().trim();
              const uUsername = safeUser.username.toLowerCase().trim();
              return (
                (empName !== "" && empName === uName) ||
                (empEmail !== "" && uEmail !== "" && empEmail === uEmail) ||
                (empCode !== "" && empCode === uUsername)
              );
            });
            if (linked) {
              if (!safeUser.branchId && linked.branch_id) safeUser.branchId = String(linked.branch_id);
              if (!safeUser.designation && linked.designation) safeUser.designation = String(linked.designation);
            }
          }
        } catch {
          // Non-blocking enrichment
        }
      }

      const token = issueSessionForUser(safeUser);
      setSessionCookie(res, token);
      return res.status(200).json({ success: true, user: safeUser, token });
    }

    if (action === "me" && req.method === "GET") {
      const authUser = requireVercelAuth(req, res);
      if (!authUser) return;
      const sb = getServerSupabase();
      if (sb && authUser.sub !== "admin-bootstrap") {
        const { data: row, error } = await sb.from("users").select("*").eq("id", authUser.sub).maybeSingle();
        if (!error && row) {
          if (row.status === "Inactive") {
            clearSessionCookie(res);
            return res.status(401).json({ success: false, message: "Account is inactive." });
          }
          return res.status(200).json({
            success: true,
            session: authUser,
            user: mapDbUserRowToClientUser(row as Record<string, unknown>),
          });
        }
      }
      return res.status(200).json({ success: true, session: authUser });
    }

    if (action === "logout" && req.method === "POST") {
      clearSessionCookie(res);
      return res.status(200).json({ success: true });
    }

    if (action === "hash-password" && req.method === "POST") {
      const authUser = requireVercelAuth(req, res);
      if (!authUser) return;
      const body = await parseJsonBody<{ password?: string }>(req);
      if (typeof body.password !== "string" || !body.password) {
        return res.status(400).json({ success: false, message: "Password is required." });
      }
      if (isPasswordHashed(body.password)) {
        return res.status(200).json({ success: true, hash: body.password });
      }
      return res.status(200).json({ success: true, hash: hashPassword(body.password) });
    }

    if (action === "change-password" && req.method === "POST") {
      const authUser = requireVercelAuth(req, res);
      if (!authUser) return;
      const body = await parseJsonBody<{ currentPassword?: string; newPassword?: string }>(req);
      const { currentPassword, newPassword } = body;
      if (typeof currentPassword !== "string" || !currentPassword) {
        return res.status(400).json({ success: false, message: "Current password is required." });
      }
      if (typeof newPassword !== "string" || !newPassword) {
        return res.status(400).json({ success: false, message: "New password is required." });
      }
      const strengthError = validateStrongPasswordServer(newPassword);
      if (strengthError) {
        return res.status(400).json({ success: false, message: strengthError });
      }

      const sb = getServerSupabase();
      if (!sb) {
        return res.status(503).json({ success: false, message: "Database service unavailable." });
      }

      const { data: userRow, error: fetchErr } = await sb
        .from("users")
        .select("*")
        .eq("id", authUser.sub)
        .maybeSingle();

      if (fetchErr || !userRow) {
        return res.status(404).json({ success: false, message: "User account not found." });
      }

      const storedPassword = typeof userRow.password === "string" ? userRow.password : "";
      if (!verifyPassword(currentPassword, storedPassword).valid) {
        return res.status(400).json({ success: false, message: "हालको पासवर्ड गलत छ (Incorrect current password)." });
      }

      const updatedAt = Date.now();
      const { error: updateErr } = await sb
        .from("users")
        .update({
          password: hashPassword(newPassword),
          password_updated_at: updatedAt,
          force_password_change: false,
        })
        .eq("id", authUser.sub);

      if (updateErr) {
        return res.status(500).json({ success: false, message: "Could not update password. Please try again." });
      }

      const safeUser = mapDbUserRowToClientUser({
        ...(userRow as Record<string, unknown>),
        password_updated_at: updatedAt,
        force_password_change: false,
      });
      return res.status(200).json({ success: true, user: safeUser, message: "Password updated successfully." });
    }

    if (action === "request-otp" && req.method === "POST") {
      const secret = getSessionSecret();
      if (!secret) {
        return res.status(503).json({ success: false, message: "Server SESSION_SECRET is not configured." });
      }
      const body = await parseJsonBody<{
        identifier?: string;
        companyName?: string;
        companyAddress?: string;
        logoUrl?: string;
      }>(req);

      const target = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
      if (!target) {
        return res.status(400).json({ success: false, message: "Please enter your username or email address." });
      }

      const sb = getServerSupabase();
      if (!sb) {
        return res.status(503).json({ success: false, message: "Database service unavailable." });
      }

      const { data: users, error } = await sb.from("users").select("id, username, full_name, email, mobile, status");
      if (error || !Array.isArray(users)) {
        return res.status(500).json({ success: false, message: "Could not process password recovery request." });
      }

      const matchedUser = users.find(
        (u) =>
          (typeof u.username === "string" && u.username.trim().toLowerCase() === target) ||
          (typeof u.email === "string" && u.email.trim().toLowerCase() === target) ||
          (typeof u.mobile === "string" && u.mobile.trim() === target)
      );

      if (!matchedUser) {
        return res.status(404).json({ success: false, message: "No account found with that username or email." });
      }
      if (matchedUser.status === "Inactive") {
        return res.status(403).json({ success: false, message: "This account is deactivated. Please contact the administrator." });
      }

      let recipientEmail = typeof matchedUser.email === "string" ? matchedUser.email.trim() : "";
      if (!recipientEmail) {
        const { data: emps } = await sb.from("employees").select("full_name, email, employee_code");
        if (Array.isArray(emps)) {
          const linked = emps.find((e) => {
            const empName = String(e.full_name || "").toLowerCase().trim();
            const empCode = String(e.employee_code || "").toLowerCase().trim();
            return (
              (empName && empName === String(matchedUser.full_name || "").toLowerCase().trim()) ||
              (empCode && empCode === String(matchedUser.username || "").toLowerCase().trim())
            );
          });
          if (linked && typeof linked.email === "string" && linked.email.trim()) {
            recipientEmail = linked.email.trim();
          }
        }
      }

      if (!recipientEmail || !recipientEmail.includes("@")) {
        return res.status(400).json({
          success: false,
          message: "No email address is registered for this account. Please contact your Administrator.",
        });
      }

      const effectiveCompany = body.companyName || "Ratauli Saving and Credit Cooperative Ltd";
      const effectiveAddress = body.companyAddress || "Pipra Rural Municipality -6 (Mahottari)";
      const { transporter, from } = createSmtpTransporter(null, effectiveCompany);
      const otpCode = String(crypto.randomInt(100000, 1000000));

      const challengePayload: StatelessOtpPayload = {
        kind: "otp",
        userId: String(matchedUser.id),
        username: String(matchedUser.username),
        email: recipientEmail,
        otpHash: sha256Hmac(`${matchedUser.id}:${otpCode}`, secret),
        exp: Date.now() + 10 * 60 * 1000,
      };
      const challengeId = signStatelessToken(challengePayload as unknown as Record<string, unknown>);
      const logoAttachment = await getLogoAttachment(body.logoUrl);

      const safeCompany = escapeHtml(effectiveCompany);
      const safeAddress = escapeHtml(effectiveAddress);
      const safeUsername = escapeHtml(matchedUser.username || "User");

      await transporter.sendMail({
        from,
        to: recipientEmail,
        subject: `Your Verification Code: ${otpCode} - ${effectiveCompany}`,
        text: `Hello ${matchedUser.username},\n\nYour password reset verification code is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\n${effectiveCompany}\n${effectiveAddress}`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden;">
            <div style="background: #065f46; padding: 24px 26px 20px 26px; color: #ffffff;">
              <div style="font-size: 16px; font-weight: 900; text-transform: uppercase;">${safeCompany}</div>
              <div style="font-size: 13px; margin-top: 6px; opacity: 0.9;">${safeAddress}</div>
            </div>
            <div style="padding: 32px 26px; text-align: center; color: #1e293b;">
              <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Password Reset Verification Code</h3>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">Hello <strong>${safeUsername}</strong>, use the 6-digit code below to reset your password:</p>
              <div style="background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 18px; margin: 0 auto 24px auto; max-width: 260px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #047857; display: block;">${otpCode}</span>
              </div>
              <p style="margin: 0; font-size: 12px; color: #64748b;">This code is valid for 10 minutes. Do not share it with anyone.</p>
            </div>
          </div>
        `,
        attachments: [logoAttachment],
      });

      return res.status(200).json({
        success: true,
        challengeId,
        username: String(matchedUser.username),
        maskedEmail: maskEmailAddress(recipientEmail),
        message: "Verification code sent to your registered email.",
      });
    }

    if (action === "verify-otp-reset" && req.method === "POST") {
      const secret = getSessionSecret();
      if (!secret) {
        return res.status(503).json({ success: false, message: "Server SESSION_SECRET is not configured." });
      }
      const body = await parseJsonBody<{
        challengeId?: string;
        otpCode?: string;
        newPassword?: string;
      }>(req);

      const { challengeId, otpCode, newPassword } = body;
      if (typeof challengeId !== "string" || !challengeId) {
        return res.status(400).json({ success: false, message: "Verification session expired. Please request a new code." });
      }
      const challenge = verifyStatelessToken<StatelessOtpPayload>(challengeId);
      if (!challenge || challenge.kind !== "otp" || challenge.exp <= Date.now()) {
        return res.status(400).json({ success: false, message: "Verification code has expired. Please request a new code." });
      }

      const cleanOtp = typeof otpCode === "string" ? otpCode.trim() : "";
      const expectedBuf = Buffer.from(challenge.otpHash, "hex");
      const providedBuf = Buffer.from(sha256Hmac(`${challenge.userId}:${cleanOtp}`, secret), "hex");
      if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
        return res.status(400).json({ success: false, message: "Invalid verification code. Please check your email." });
      }

      const strengthError = validateStrongPasswordServer(String(newPassword || ""));
      if (strengthError) {
        return res.status(400).json({ success: false, message: strengthError });
      }

      const sb = getServerSupabase();
      if (!sb) {
        return res.status(503).json({ success: false, message: "Database service unavailable." });
      }

      const { error: updateErr } = await sb
        .from("users")
        .update({
          password: hashPassword(String(newPassword)),
          password_updated_at: Date.now(),
          force_password_change: false,
        })
        .eq("id", challenge.userId);

      if (updateErr) {
        return res.status(500).json({ success: false, message: "Could not update password. Please try again." });
      }

      return res.status(200).json({
        success: true,
        username: challenge.username,
        message: "Password updated successfully.",
      });
    }

    return res.status(404).json({ success: false, message: "Auth endpoint not found." });
  } catch (err: unknown) {
    console.error("Vercel auth error:", err);
    const errMsg = err instanceof Error ? err.message : "Authentication request failed.";
    return res.status(500).json({ success: false, message: errMsg });
  }
}
