import React, { useState, createContext, useContext, useEffect, useRef, useCallback } from 'react';
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
  const userRef = useRef<User | null>(user);
  userRef.current = user;
  const lastFocusSyncRef = useRef<number>(0);

  const safePersistAuthUser = (u: User | null) => {
    try {
      if (!u) {
        localStorage.removeItem('ZEN_AUTH_USER');
        return;
      }
      localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(u));
    } catch {
      if (u) {
        try {
          const compact: User = {
            ...u,
            profilePhoto:
              typeof u.profilePhoto === 'string' && u.profilePhoto.length > 8000 ? undefined : u.profilePhoto
          };
          localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(compact));
        } catch {
          // Ignore persistent storage errors
        }
      }
    }
  };
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

      // If user is logged in, refresh latest permissions/role directly from Supabase (uncached)
      const activeUser = userRef.current;
      if (activeUser) {
        const remoteUser =
          (await supabaseService
            .getFreshUserByIdOrUsername({ id: activeUser.id, username: activeUser.username })
            .catch(() => null)) ||
          (await supabaseService
            .getUsers({ forceRefresh: true })
            .then(list =>
              (Array.isArray(list) ? list : []).find(
                u => u && (u.id === activeUser.id || u.username === activeUser.username)
              ) || null
            )
            .catch(() => null));

        const updatedUser: User = remoteUser
          ? {
              ...activeUser,
              ...remoteUser,
              permissions: Array.isArray(remoteUser.permissions) ? remoteUser.permissions : [],
              profilePhoto: remoteUser.profilePhoto || activeUser.profilePhoto
            }
          : { ...activeUser };
        let needsUpdate = Boolean(remoteUser);
        const userIsSuper = updatedUser.username === 'admin' || updatedUser.roleId === '1';

        if (!userIsSuper && !updatedUser.branchId) {
          const linkedEmp = (emps || []).find(e => {
            const empName = (e.fullName || '').toLowerCase().trim();
            const uName = (updatedUser.fullName || '').toLowerCase().trim();
            const sameName = empName !== '' && empName === uName;

            const empEmail = (e.email || '').toLowerCase().trim();
            const uEmail = (updatedUser.email || '').toLowerCase().trim();
            const sameEmail = empEmail !== '' && uEmail !== '' && empEmail === uEmail;

            const empCode = (e.employeeCode || '').toLowerCase().trim();
            const uUsername = (updatedUser.username || '').toLowerCase().trim();
            const sameCode = empCode !== '' && empCode === uUsername;

            return sameName || sameEmail || sameCode;
          });

          if (linkedEmp && linkedEmp.branchId) {
            updatedUser.branchId = linkedEmp.branchId;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          userRef.current = updatedUser;
          setUser(updatedUser);
          safePersistAuthUser(updatedUser);
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
    const rawBranch = (u as User & { branch_id?: string }).branch_id;
    const finalUser: User = {
      ...u,
      branchId: u.branchId || rawBranch || 'main',
      permissions: Array.isArray(u.permissions) ? u.permissions : []
    };
    userRef.current = finalUser;
    setUser(finalUser);
    safePersistAuthUser(finalUser);
    // Immediately refresh roles and latest user permissions directly from Supabase
    void refreshRoles().catch(() => {});
    void refreshUser(finalUser).catch(() => {});
  };

  const logout = () => {
    const activeUser = userRef.current;
    if (activeUser) {
      void supabaseService.saveLog(
        activeUser.id || activeUser.username || 'admin',
        'USER_LOGOUT',
        `User @${activeUser.username} (${activeUser.fullName}) signed out`,
        activeUser.branchId || 'main'
      ).catch(() => {});
    }
    supabaseService.invalidateMemoryCache('users');
    supabaseService.invalidateMemoryCache('roles');
    userRef.current = null;
    setUser(null);
    safePersistAuthUser(null);
    try {
      localStorage.removeItem('ZEN_ACTIVE_BRANCH_ID');
    } catch {
      // Ignore storage errors
    }
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
    userRef.current = updatedUser;
    setUser(updatedUser);
    safePersistAuthUser(updatedUser);
    try {
      localStorage.setItem('ZEN_ACTIVE_BRANCH_ID', targetId);
    } catch {
      // Ignore storage errors
    }
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

  const refreshRoles = useCallback(async () => {
    try {
      supabaseService.invalidateMemoryCache('roles');
      const r = await supabaseService.getRoles();
      if (Array.isArray(r) && r.length > 0) {
        setRoles(r);
        try { localStorage.setItem('saccos_db_roles', JSON.stringify(r)); } catch {}
      }
    } catch (e) {
      console.warn("Failed to refresh roles:", e);
    }
  }, []);

  const refreshBranches = useCallback(async () => {
    const b = await supabaseService.getBranches();
    setBranches(b || []);
  }, []);

  const refreshUser = useCallback(async (overrideUser?: User) => {
    const target = overrideUser || userRef.current;
    if (!target) return;
    try {
      const fresh =
        (await supabaseService
          .getFreshUserByIdOrUsername({ id: target.id, username: target.username })
          .catch(() => null)) ||
        (await supabaseService
          .getUsers({ forceRefresh: true })
          .then(users => {
            const safeUsers = Array.isArray(users) ? users : [];
            return (
              safeUsers.find(u => u && (u.id === target.id || u.username === target.username)) ||
              null
            );
          })
          .catch(() => null));

      if (fresh) {
        const merged: User = {
          ...target,
          ...fresh,
          permissions: Array.isArray(fresh.permissions) ? fresh.permissions : [],
          profilePhoto: fresh.profilePhoto || target.profilePhoto
        };
        // Avoid replacing if user logged out while request was in flight
        if (!userRef.current || userRef.current.username !== target.username) return;
        userRef.current = merged;
        setUser(merged);
        safePersistAuthUser(merged);
      }
    } catch (e) {
      console.warn("Could not refresh user:", e);
    }
  }, []);

  // Auto-sync latest permissions & roles when user returns to tab or User Management updates permissions
  useEffect(() => {
    if (!user) return;
    const handlePermEvent = () => {
      void refreshUser();
      void refreshRoles();
    };
    const handleFocusSync = () => {
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 5000) return;
      lastFocusSyncRef.current = now;
      void refreshUser();
      void refreshRoles();
    };
    window.addEventListener('userPermissionsUpdated', handlePermEvent);
    window.addEventListener('focus', handleFocusSync);
    return () => {
      window.removeEventListener('userPermissionsUpdated', handlePermEvent);
      window.removeEventListener('focus', handleFocusSync);
    };
  }, [user?.id, user?.username]);

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
        'sub_ins_dashboard_view', 'sub_ins_upload_view', 'sub_ins_report_view', 'sub_ins_alerts_view', 'sub_ins_claims_view', 'sub_ins_notice_view'
      ],
      view_microfinance: [
        'sub_mf_dashboard_view', 'sub_mf_centers_view', 'sub_mf_groups_view',
        'sub_mf_members_view', 'sub_mf_saving_view', 'sub_mf_loan_view',
        'sub_mf_reports_view', 'sub_mf_signature_sheet_view',
        'sub_mf_deposit_sheet_view', 'sub_mf_meeting_minutes_view', 'sub_mf_id_card_view'
      ],
      view_depreciation: [
        'sub_dep_dashboard_view', 'sub_dep_assets_view', 'sub_dep_calculate_view',
        'sub_dep_accounting_view', 'sub_dep_reports_view', 'sub_dep_settings_view'
      ],
      view_alerts: [
        'sub_alert_bima_maturity_view', 'sub_alert_loan_maturity_view', 'sub_alert_saving_maturity_view', 'sub_alert_notice_view'
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

    // If any granular Micro-Finance sub-menu permission (view/edit/delete) is granted, allow entering Micro-Finance
    if (p === 'view_microfinance') {
      if (
        userPerms.some(k => typeof k === 'string' && k.startsWith('sub_mf_')) ||
        rolePerms.some(k => typeof k === 'string' && k.startsWith('sub_mf_'))
      ) {
        return true;
      }
    }

    // If any granular Insurance sub-menu permission (view/edit/delete) is granted, allow entering Insurance
    if (p === 'view_insurance') {
      if (
        userPerms.some(k => typeof k === 'string' && k.startsWith('sub_ins_')) ||
        rolePerms.some(k => typeof k === 'string' && k.startsWith('sub_ins_'))
      ) {
        return true;
      }
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