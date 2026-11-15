import React, { useState, createContext, useContext, useEffect } from 'react';
import { User, Permission, Role, Branch, SystemSettings } from './types';
import { supabaseService } from './services/supabaseService';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  branch: Branch | null;
  branches: Branch[];
  isSuperAdmin: boolean;
  settings: SystemSettings | null;
  login: (u: User) => void;
  logout: () => void;
  switchBranch: (branch: string | Branch) => void;
  refreshSettings: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (p: Permission, targetBranchId?: string) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthContext must be used within provider");
  return context;
};

export const DEFAULT_SETTINGS: SystemSettings = {
  systemName: "RATAULI SACCOS DAILY ACCOUNT",
  systemNameNp: "रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड",
  currency: "NPR",
  remittanceCompanies: ["IME", "Prabhu", "City Express", "Sewa", "E-Sewa", "Khalti", "I-Pay"],
  officeHeads: ["Salary", "Rent", "Electricity", "Water", "Stationery", "Marketing", "Maintenance", "Interest Paid", "Interest Received", "Commission"],
  approvalLimit: 50000,
  enableApprovals: true,
  logoUrl: "/system_logo.png",
  address: "Pipra Rural Municipality-6, Ratauli, Mahottari",
  addressNp: "पिपरा गाउँपालिका -६, रतौली, महोत्तरी",
  registrationNo: "421/054/055",
  panNo: "302488825",
  email: "info.rataulisaccos@gmail.com",
  allowBackDateEntry: true,
  allowDayReopenSpecialAccess: false,
  emailNotifications: {
    enabled: true,
    transactionAlerts: true,
    payrollSalarySlips: true,
    securityPasswordReset: true,
    dayEndSettlementSummary: true,
    leaveAndAttendance: true,
    adminNotificationEmail: "info.rataulisaccos@gmail.com"
  },
  autoLogoutMinutes: 30
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ZEN_AUTH_USER');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse user from storage", e);
      return null;
    }
  });
  const [settings, setSettings] = useState<SystemSettings | null>(() => {
    try {
      const saved = localStorage.getItem('ZEN_AUTH_SETTINGS') || localStorage.getItem('saccos_db_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.logoUrl || parsed.logoUrl.includes('picsum.photos')) {
          parsed.logoUrl = '/system_logo.png';
        }
        return parsed;
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [roles, setRoles] = useState<Role[]>(() => {
    try {
      const saved = localStorage.getItem('saccos_db_roles');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [branches, setBranches] = useState<Branch[]>(() => {
    try {
      const saved = localStorage.getItem('saccos_db_branches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading] = useState(false);

  // Helper to resolve branch object robustly
  const resolveBranch = (targetUser: User | null, branchList: Branch[]): Branch | null => {
    if (!targetUser) return null;
    const safeList = Array.isArray(branchList) ? branchList : [];
    const rawBranchId = (targetUser.branchId || (targetUser as any).branch_id || (targetUser as any).department || '').trim();
    if (!rawBranchId) {
      return safeList.find(b => b && b.id === 'main') || { id: 'main', name: 'Ratauli Head Office', code: 'C01', location: 'Ratauli', status: 'Active', createdAt: 1700000000000 };
    }

    const lower = rawBranchId.toLowerCase();
    // 1. Direct match on branch list
    const directMatch = safeList.find(b => 
      b && (
        b.id.toLowerCase() === lower ||
        b.code?.toLowerCase() === lower ||
        b.name.toLowerCase() === lower ||
        b.name.toLowerCase().includes(lower) ||
        lower.includes(b.id.toLowerCase())
      )
    );
    if (directMatch) return directMatch;

    // 2. Known static aliases for standard branches
    if (lower === 'sahodba' || lower === 'c02' || lower.includes('sahodba')) {
      return { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', location: 'Sahodba', status: 'Active', createdAt: 1700000000001 };
    }
    if (lower === 'pipra' || lower === 'c03' || lower.includes('pipra')) {
      return { id: 'pipra', name: 'Pipra Branch', code: 'C03', location: 'Pipra', status: 'Active', createdAt: 1700000000002 };
    }
    if (lower === 'parsa' || lower === 'c04' || lower.includes('parsa')) {
      return { id: 'parsa', name: 'Parsa Branch', code: 'C04', location: 'Parsa', status: 'Active', createdAt: 1700000000003 };
    }
    if (lower === 'main' || lower === 'c01' || lower.includes('head office') || lower.includes('ratauli')) {
      return { id: 'main', name: 'Ratauli Head Office', code: 'C01', location: 'Ratauli', status: 'Active', createdAt: 1700000000000 };
    }

    // 3. Fallback customized branch object
    return {
      id: rawBranchId,
      name: rawBranchId.charAt(0).toUpperCase() + rawBranchId.slice(1) + (rawBranchId.toLowerCase().includes('branch') ? '' : ' Branch'),
      code: rawBranchId.toUpperCase(),
      status: 'Active',
      createdAt: Date.now()
    };
  };

  const fetchInitialData = async () => {
    try {
      const [s, r, b, emps] = await Promise.all([
        supabaseService.getSettings().catch(() => null),
        supabaseService.getRoles().catch(() => []),
        supabaseService.getBranches().catch(() => []),
        supabaseService.getEmployees().catch(() => [])
      ]);

      const finalSettings = s ? {
        ...DEFAULT_SETTINGS,
        ...s,
        logoUrl: (s.logoUrl && !s.logoUrl.includes('picsum.photos')) ? s.logoUrl : '/system_logo.png'
      } : (settings || DEFAULT_SETTINGS);
      setSettings(finalSettings);
      try {
        localStorage.setItem('ZEN_AUTH_SETTINGS', JSON.stringify(finalSettings));
        localStorage.setItem('saccos_db_settings', JSON.stringify(finalSettings));
      } catch {
        // Ignore storage errors
      }
      if (Array.isArray(r) && r.length > 0) {
        setRoles(r);
        try { localStorage.setItem('saccos_db_roles', JSON.stringify(r)); } catch {}
      }
      if (Array.isArray(b) && b.length > 0) {
        setBranches(b);
        try { localStorage.setItem('saccos_db_branches', JSON.stringify(b)); } catch {}
      }

      // If user is logged in, check if their branchId needs to be resolved or synced from HR employees (for non-superadmin)
      if (user) {
        const updatedUser = { ...user };
        let needsUpdate = false;
        const userIsSuper = user.username === 'admin' || user.roleId === '1';

        if (!userIsSuper) {
          const linkedEmp = (emps || []).find(e => {
            const empName = (e.fullName || '').toLowerCase().trim();
            const uName = (user.fullName || '').toLowerCase().trim();
            const sameName = empName !== '' && empName === uName;

            const empEmail = (e.email || '').toLowerCase().trim();
            const uEmail = (user.email || '').toLowerCase().trim();
            const sameEmail = empEmail !== '' && uEmail !== '' && empEmail === uEmail;

            const empCode = (e.employeeCode || '').toLowerCase().trim();
            const uUsername = (user.username || '').toLowerCase().trim();
            const sameCode = empCode !== '' && empCode === uUsername;

            return sameName || sameEmail || sameCode;
          });

          if (linkedEmp && linkedEmp.branchId && (!updatedUser.branchId || updatedUser.branchId === 'main' || updatedUser.branchId !== linkedEmp.branchId)) {
            updatedUser.branchId = linkedEmp.branchId;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          setUser(updatedUser);
          localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(updatedUser));
        }
      }
    } catch (error) {
      console.warn("Background sync notice:", error);
      if (!settings) {
        setSettings(DEFAULT_SETTINGS);
      }
    }
  };

  useEffect(() => {
    void fetchInitialData();
  }, []);

  const login = (u: User) => {
    // Normalizing user branchId on login
    let finalUser = { ...u };
    if (!finalUser.branchId && (finalUser as any).branch_id) {
      finalUser.branchId = (finalUser as any).branch_id;
    }
    setUser(finalUser);
    localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(finalUser));
    // Immediately refresh roles and user data in the background
    refreshRoles().catch(() => {});
    refreshUser().catch(() => {});
  };

  const logout = () => {
    if (user) {
      void supabaseService.saveLog(
        user.id || user.username || 'admin',
        'USER_LOGOUT',
        `User @${user.username} (${user.fullName}) signed out`,
        user.branchId || 'main'
      ).catch(() => {});
    }
    setUser(null);
    localStorage.removeItem('ZEN_AUTH_USER');
    localStorage.removeItem('ZEN_ACTIVE_BRANCH_ID');
  };

  const switchBranch = (target: string | Branch) => {
    if (!user) return;
    const targetId = typeof target === 'string' ? target : target.id;
    const targetName = typeof target === 'string' ? target : target.name;
    void supabaseService.saveLog(
      user.id || user.username || 'admin',
      'SWITCH_BRANCH',
      `Switched active branch workspace to ${targetName} (${targetId})`,
      targetId
    ).catch(() => {});
    const updatedUser: User = {
      ...user,
      branchId: targetId
    };
    setUser(updatedUser);
    localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(updatedUser));
    localStorage.setItem('ZEN_ACTIVE_BRANCH_ID', targetId);
    window.dispatchEvent(new CustomEvent('branchSwitched', { detail: { branchId: targetId } }));
    
    // Automatically refresh the page to reload all branch data cleanly
    setTimeout(() => {
      window.location.reload();
    }, 150);
  };

  // Configurable Inactivity Auto Logout (defaults to 30 minutes, configurable in Admin Center Settings)
  useEffect(() => {
    if (!user) return;

    // Timeout in minutes: defaults to 30 min. If explicitly set to 0, auto logout is disabled.
    const minutes = typeof settings?.autoLogoutMinutes === 'number' 
      ? settings.autoLogoutMinutes 
      : 30;

    if (minutes <= 0) {
      console.log('Inactivity auto logout is disabled (configured to 0 min)');
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn(`${minutes} min inactivity threshold reached. Auto logging out...`);
        logout();
      }, minutes * 60 * 1000);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'wheel'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetInactivityTimer, { passive: true }));

    resetInactivityTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [user, settings?.autoLogoutMinutes]);

  const refreshSettings = async () => {
    try {
      const s = await supabaseService.getSettings();
      const finalSettings = s ? {
        ...DEFAULT_SETTINGS,
        ...s,
        logoUrl: (s.logoUrl && !s.logoUrl.includes('picsum.photos')) ? s.logoUrl : '/system_logo.png'
      } : DEFAULT_SETTINGS;
      setSettings(finalSettings);
      try {
        localStorage.setItem('ZEN_AUTH_SETTINGS', JSON.stringify(finalSettings));
        localStorage.setItem('saccos_db_settings', JSON.stringify(finalSettings));
      } catch {
        // Ignore storage errors
      }
    } catch (e) {
      console.warn("Notice: refreshSettings failed:", e);
    }
  };

  const refreshRoles = async () => {
    try {
      const r = await supabaseService.getRoles();
      if (Array.isArray(r) && r.length > 0) {
        setRoles(r);
        try { localStorage.setItem('saccos_db_roles', JSON.stringify(r)); } catch {}
      }
    } catch (e) {
      console.warn("Failed to refresh roles:", e);
    }
  };

  const refreshBranches = async () => {
    const b = await supabaseService.getBranches();
    setBranches(b || []);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const users = await supabaseService.getUsers().catch(() => []);
      const safeUsers = Array.isArray(users) ? users : [];
      const current = safeUsers.find(u => u && (u.id === user.id || u.username === user.username));
      if (current) {
        setUser(current);
        localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(current));
      }
    } catch (e) {
      console.warn("Could not refresh user:", e);
    }
  };

  const role = user ? (Array.isArray(roles) ? roles : []).find(r => 
    r && (
      r.id === user.roleId || 
      String(r.id) === String(user.roleId) || 
      (r.name && user.role && r.name.toLowerCase() === user.role.toLowerCase())
    )
  ) || null : null;
  const branch = resolveBranch(user, branches);

  const isSuperAdmin = Boolean(
    user && (
      user.username === 'admin' ||
      user.roleId === '1' ||
      role?.name?.toLowerCase().includes('super') ||
      (role as any)?.isSuperAdmin ||
      (user as any).isSuperAdmin
    )
  );

  const hasPermission = (p: Permission) => {
    if (!user) return false;
    if (user.username === 'admin' || user.roleId === '1' || isSuperAdmin) return true;
    
    const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
    const rolePerms = Array.isArray(role?.permissions) ? role.permissions : [];

    // 1. Direct permission check
    if (userPerms.includes(p) || rolePerms.includes(p)) return true;

    // 2. Granular sub-permission mapping fallback:
    // If a component checks a parent route permission, grant access if any sub-menu under that category is enabled
    const coarseSubMap: Record<string, string[]> = {
      view_reports: [
        'sub_dash_overview_view', 'sub_dash_charts_view',
        'sub_daily_balancing_view', 'sub_trial_balance_view', 'sub_audit_summary_view',
        'sub_admin_logs_view'
      ],
      view_cash_entry: [
        'sub_teller_savings_view', 'sub_teller_withdrawal_view',
        'sub_teller_remittance_view', 'sub_teller_share_capital_view',
        'sub_vault_monitoring_view', 'sub_vault_reconciliation_view',
        'sub_vault_transfers_view'
      ],
      view_daily_ledger: [
        'sub_daily_books_view', 'sub_member_passbooks_view'
      ],
      view_income_expense: [
        'sub_office_expenses_view', 'sub_misc_income_view'
      ],
      view_office_expenses: [
        'sub_office_exp_registry_view', 'sub_office_exp_fixed_view'
      ],
      view_ledger_names: [
        'sub_member_accounts_view', 'sub_loan_accounts_view', 'sub_vendor_accounts_view'
      ],
      manage_notices: [
        'sub_internal_notices_view', 'sub_resource_downloads_view', 'sub_popup_notices_view'
      ],
      manage_hr: [
        'sub_hr_dashboard_view', 'sub_hr_employees_view', 'sub_hr_attendance_view',
        'sub_hr_leaves_view', 'sub_hr_payroll_view',
        'sub_hr_documents_view', 'sub_hr_grievances_view', 'sub_hr_board_view'
      ],
      manage_attendance: [
        'sub_hr_attendance_view', 'sub_hr_attendance_edit'
      ],
      manage_leaves: [
        'sub_hr_leaves_view', 'sub_hr_leaves_edit'
      ],
      manage_payroll: [
        'sub_hr_payroll_view', 'sub_hr_payroll_edit'
      ],
      view_insurance: [
        'sub_ins_dashboard_view', 'sub_ins_upload_view', 'sub_ins_report_view', 'sub_ins_alerts_view'
      ],
      view_microfinance: [
        'sub_mf_dashboard_view', 'sub_mf_centers_view', 'sub_mf_groups_view',
        'sub_mf_members_view', 'sub_mf_saving_view', 'sub_mf_loan_view', 'sub_mf_reports_view'
      ],
      view_depreciation: [
        'sub_dep_dashboard_view', 'sub_dep_assets_view', 'sub_dep_calculate_view',
        'sub_dep_accounting_view', 'sub_dep_reports_view', 'sub_dep_settings_view'
      ],
      view_alerts: [
        'sub_alert_bima_maturity_view', 'sub_alert_loan_maturity_view', 'sub_alert_notice_view'
      ],
      view_shortcuts: [
        'sub_tool_remit_view', 'sub_tool_messages_view', 'sub_tool_calculator_view',
        'sub_tool_fd_cert_view', 'sub_tool_emi_view', 'sub_tool_date_converter_view'
      ],
      manage_users: [
        'sub_admin_users_view', 'sub_admin_roles_view',
        'sub_admin_branches_view', 'sub_admin_intelligence_view',
        'sub_admin_products_view', 'sub_admin_products_edit', 'sub_admin_products_delete',
        'sub_admin_holiday_view', 'sub_admin_settings_view', 'sub_admin_backup_view',
        'sub_admin_reset_view', 'sub_admin_logs_view'
      ],
      manage_branches: [
        'sub_admin_branches_view', 'sub_admin_branches_edit'
      ],
      manage_settings: [
        'sub_admin_settings_view', 'sub_admin_settings_edit',
        'sub_admin_holiday_view', 'sub_admin_holiday_edit',
        'sub_dep_settings_view', 'sub_dep_settings_edit'
      ],
      manage_backup: [
        'sub_admin_backup_view', 'sub_admin_backup_edit'
      ],
      system_reset: [
        'sub_admin_reset_view', 'sub_admin_reset_edit'
      ],
      view_consolidated_report: [
        'sub_admin_intelligence_view'
      ],
      cross_branch_operation: [
        'sub_admin_branches_view', 'sub_admin_intelligence_view'
      ]
    };

    const subs = coarseSubMap[p];
    if (subs && subs.some(k => userPerms.includes(k) || rolePerms.includes(k))) {
      return true;
    }

    return false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      role, 
      branch, 
      branches, 
      isSuperAdmin, 
      settings: settings!, 
      login, 
      logout, 
      switchBranch, 
      refreshSettings, 
      refreshRoles, 
      refreshBranches, 
      refreshUser, 
      hasPermission, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};