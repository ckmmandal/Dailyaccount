import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { 
  LayoutDashboard, MapPin, Users, UserCheck, UserX,
  PiggyBank, HandCoins, FileText,
  Search, Plus, RefreshCw, Upload, Download,
  Edit2, Trash2, CheckCircle2, Ban,
  Calendar, Clock, Building2, UserPlus,
  Printer, CreditCard, X, Camera, User, Eye, FileSpreadsheet,
  Lock, Loader2, AlertCircle, AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip
} from 'recharts';
import { 
  microFinanceService, 
  MFCenter, 
  MFSamuhGroup, 
  MFMember, 
  MFSavingsRecord, 
  MFLoanRecord, 
  MFCollectionSheet,
  MFSignatureSheet,
  MFSignatureSheetMember,
  normalizeBsDate,
  buildBsDateFromParts,
  getTodayBsDate,
  normalizeLoanProductKey,
  findUnclosedDuplicateLoan,
  DEFAULT_SAVING_PERIOD_YEARS,
  calculateBsMaturityDateByYears,
  resolveSavingOpenDateBs,
  resolveSavingPeriodYears,
  resolveSavingMaturityDateBs,
  getEffectiveSavingStatus,
  isSavingStatusClosed,
  normalizeSavingProductKey,
  findActiveDuplicateSaving,
  normalizeDuplicateMemberId,
  normalizeCitizenshipKey,
  findDuplicateMember
} from '../services/microFinanceService';
import { meetingMinutesService, GroupMeetingRecord } from '../services/meetingMinutesService';
import { useAuth } from '../AuthContext';
import { Branch, SavingProduct, LoanProduct, SystemSettings, Employee } from '../types';
import { storageService } from '../services/storageService';
import { productService } from '../services/productService';
import NepaliDate from 'nepali-date-converter';
import { GroupMeetingMinutesModule } from './microfinance/GroupMeetingMinutesModule';
import { MemberIdCardModule } from './microfinance/MemberIdCardModule';
import { DepositSheetModule } from './microfinance/DepositSheetModule';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';
import { NepaliDatePicker } from './NepaliDatePicker';
import {
  resolveCanonicalBranchKey,
  findMatchingBranch,
  parseUserMfBranchAccess,
  scopeMicroFinanceData
} from '../utils/mfBranchFilter';

// Helper to calculate BS Maturity Date based on BS Open Date (YYYY-MM-DD) and Period in months
const calculateBsMaturityDate = (openBs: string, periodMonths: number): string => {
  if (!openBs || !periodMonths || isNaN(periodMonths)) return openBs || '';
  try {
    const parts = openBs.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return openBs;
    const [y0, m0, d] = parts;
    let y = y0;
    let m = m0;
    m += Number(periodMonths);
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const mm = m < 10 ? `0${m}` : `${m}`;
    const dd = d < 10 ? `0${d}` : `${d}`;
    return `${y}-${mm}-${dd}`;
  } catch (e) {
    return openBs;
  }
};

const getEffectiveMemberStatus = (status?: string): 'ACTIVE' | 'INACTIVE' => {
  return String(status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
};

const getEffectiveLoanStatus = (loan: MFLoanRecord): 'ACTIVE' | 'MATURED' | 'CLOSED' => {
  const rawStatus = String(loan.status || '').trim().toUpperCase();
  if (rawStatus === 'CLOSED' || rawStatus === 'CLOSE') return 'CLOSED';
  if (rawStatus === 'MATURED') return 'MATURED';
  const matNorm = normalizeBsDate(loan.maturityDate);
  const isBsDate = /^20[7-9]\d-/.test(matNorm);
  if (rawStatus === 'ACTIVE' && isBsDate && matNorm <= getTodayBsDate()) {
    return 'MATURED';
  }
  return 'ACTIVE';
};

const extractMeetingDayNumber = (meetingDay?: string): number | null => {
  if (!meetingDay) return null;
  const np = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  const normalized = String(meetingDay).replace(/[०-९]/g, d => String(np.indexOf(d)));
  const match = normalized.match(/\d+/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  return isNaN(num) ? null : num;
};

const nepaliMonthsEnglishList = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// Helper to calculate BS Kista number (months difference between issue date and sheet date, e.g. 2083-06-20 to 2083-07-25 gives 1)
const calculateBsKistaNumber = (loanOpenBs: string, sheetYear: string, sheetMonthName: string): number => {
  if (!loanOpenBs) return 1;
  try {
    const parts = loanOpenBs.split('-').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 1;
    const loanYear = parts[0];
    const loanMonth = parts[1]; // 1 to 12

    const sheetYearNum = parseInt(sheetYear, 10) || loanYear;
    const nepaliMonthIndex = nepaliMonthsEnglishList.indexOf(sheetMonthName);
    const sheetMonthNum = nepaliMonthIndex >= 0 ? nepaliMonthIndex + 1 : 1;

    const diffMonths = (sheetYearNum - loanYear) * 12 + (sheetMonthNum - loanMonth);
    return diffMonths > 0 ? diffMonths : 1;
  } catch (e) {
    return 1;
  }
};

// Calculate Saving Kista number inclusively from the account creation BS month
// Example: created 2078-03-01 => 2078-03 (Ashadh) is 1, 2078-04 (Shrawan) is 2, etc.
const calculateSavingBsKistaNumber = (
  savingOpenBs: string,
  sheetYear: string,
  sheetMonthName: string
): number | null => {
  const openNorm = normalizeBsDate(savingOpenBs);
  if (!openNorm) return null;
  const match = openNorm.match(/^(\d{4})-(\d{1,2})/);
  if (!match) return null;

  const openYear = parseInt(match[1], 10);
  const openMonth = parseInt(match[2], 10);
  if (isNaN(openYear) || isNaN(openMonth) || openMonth < 1 || openMonth > 12) return null;

  const sheetYearNum = parseInt(fromNepaliDigits(sheetYear), 10);
  if (isNaN(sheetYearNum)) return null;

  const trimmedMonth = String(sheetMonthName || '').trim();
  let sheetMonthNum = nepaliMonthsEnglishList.findIndex(
    m => m.toLowerCase() === trimmedMonth.toLowerCase()
  ) + 1;
  if (sheetMonthNum <= 0) {
    const nepEntry = Object.entries(nepaliMonthMapNp).find(([, npName]) => npName === trimmedMonth);
    if (nepEntry) {
      sheetMonthNum = nepaliMonthsEnglishList.indexOf(nepEntry[0]) + 1;
    } else {
      const numericMonth = parseInt(fromNepaliDigits(trimmedMonth), 10);
      if (!isNaN(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
        sheetMonthNum = numericMonth;
      }
    }
  }
  if (sheetMonthNum <= 0) return null;

  const inclusiveMonths = (sheetYearNum - openYear) * 12 + (sheetMonthNum - openMonth) + 1;
  return inclusiveMonths >= 1 ? inclusiveMonths : null;
};

const nepaliMonthMapNp: Record<string, string> = {
  'Baisakh': 'बैशाख',
  'Jestha': 'जेष्ठ',
  'Ashadh': 'असार',
  'Shrawan': 'श्रावण',
  'Bhadra': 'भाद्र',
  'Ashwin': 'आश्विन',
  'Kartik': 'कार्तिक',
  'Mangsir': 'मंसिर',
  'Poush': 'पौष',
  'Magh': 'माघ',
  'Falgun': 'फाल्गुन',
  'Chaitra': 'चैत्र'
};

const toNepaliDigits = (num: string | number): string => {
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).replace(/[0-9]/g, (w) => nepaliDigits[+w]);
};

const fromNepaliDigits = (str: string): string => {
  const np = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(str || '').replace(/[०-९]/g, d => String(np.indexOf(d)));
};

const normalizeMfText = (val?: string): string =>
  fromNepaliDigits(String(val || ''))
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeMfMemberId = (val?: string): string =>
  fromNepaliDigits(String(val || ''))
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

const stripLeadingZerosId = (val?: string): string =>
  normalizeMfMemberId(val).replace(/^0+(?=\d)/, '');

const isSameMfMemberId = (a?: string, b?: string): boolean => {
  const normA = normalizeMfMemberId(a);
  const normB = normalizeMfMemberId(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const strippedA = stripLeadingZerosId(normA);
  const strippedB = stripLeadingZerosId(normB);
  return Boolean(strippedA && strippedB && strippedA === strippedB);
};

const matchesBsDateFilter = (
  dateText: string,
  selectedYear: string,
  selectedMonth: string,
  explicitYear?: string,
  explicitMonth?: string
): boolean => {
  const raw = dateText || '';
  const ascii = fromNepaliDigits(raw);

  if (selectedYear !== 'ALL' && selectedYear !== 'All') {
    const nepYear = toNepaliDigits(selectedYear);
    const expYearAscii = explicitYear ? fromNepaliDigits(explicitYear) : '';
    if (
      expYearAscii !== selectedYear &&
      !raw.includes(selectedYear) &&
      !raw.includes(nepYear) &&
      !ascii.includes(selectedYear)
    ) {
      return false;
    }
  }

  if (selectedMonth !== 'ALL' && selectedMonth !== 'All') {
    const nepMonth = nepaliMonthMapNp[selectedMonth] || selectedMonth;
    const monthIdx = nepaliMonthsEnglishList.indexOf(selectedMonth) + 1;
    const expMonthLower = (explicitMonth || '').trim().toLowerCase();
    const selMonthLower = selectedMonth.toLowerCase();
    const numericMatch = monthIdx > 0
      ? new RegExp(`[-/]0?${monthIdx}(?:[-/]|$)`).test(ascii)
      : false;
    const explicitMatch =
      expMonthLower === selMonthLower ||
      (explicitMonth || '').trim() === nepMonth ||
      (monthIdx > 0 && Number(fromNepaliDigits(explicitMonth || '')) === monthIdx);

    if (
      !explicitMatch &&
      !raw.toLowerCase().includes(selMonthLower) &&
      !raw.includes(nepMonth) &&
      !numericMatch
    ) {
      return false;
    }
  }

  return true;
};

const sortByNameAZ = <T extends { name?: string }>(items: T[]): T[] =>
  [...items].sort((a, b) =>
    (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' })
  );

const isEmergencyLoanProduct = (product?: string): boolean => {
  const p = (product || '').toLowerCase();
  return p.includes('emergency') || p.includes('family') || p.includes('आकस्मिक');
};

const splitMemberLoansByCategory = (memLoans: MFLoanRecord[]): { microLoan?: MFLoanRecord; emergencyLoan?: MFLoanRecord } => {
  const emergencyLoan = memLoans.find(l => isEmergencyLoanProduct(l.loanProduct));
  const nonEmergencyLoans = memLoans.filter(l => l.id !== emergencyLoan?.id && !isEmergencyLoanProduct(l.loanProduct));
  const microLoan =
    nonEmergencyLoans.find(l => {
      const p = (l.loanProduct || '').toLowerCase();
      return p.includes('micro') || p.includes('general') || p.includes('group') || p.includes('enterprise');
    }) || nonEmergencyLoans[0];
  return { microLoan, emergencyLoan };
};

type SubMenuTab = 'dashboard' | 'centers' | 'groups' | 'members' | 'saving' | 'loan' | 'reports';

export const MicroFinanceManagement: React.FC = () => {
  const { user, role, isSuperAdmin, hasPermission, branch, branches: authBranches, settings: authSettings, refreshUser, refreshRoles } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const [adminBranches, setAdminBranches] = useState<Branch[]>(authBranches || []);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(authSettings || null);

  // Granular Role Permission Helpers synced with Admin Center -> Role & Permission Management
  const mfPermState = useMemo(() => {
    const rolePerms = Array.isArray(role?.permissions) ? role.permissions : [];
    const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];
    const roleHasGranular = rolePerms.some(p => typeof p === 'string' && p.startsWith('sub_'));
    // When the user's Role uses the granular Admin Center Role Matrix, role.permissions is authoritative
    // so revoking Edit/Delete on the Role takes effect even if legacy user.permissions exist.
    const combined = roleHasGranular
      ? new Set<string>(rolePerms)
      : new Set<string>([...userPerms, ...rolePerms]);
    const hasGranularMf = Array.from(combined).some(p => typeof p === 'string' && p.startsWith('sub_mf_'));
    return { combined, hasGranularMf };
  }, [user?.permissions, role?.permissions]);

  const canMfAccess = (subKey: string, mode: 'view' | 'edit' | 'delete' = 'view'): boolean => {
    if (isSuperAdmin) return true;
    if (!mfPermState.hasGranularMf) {
      if (mode === 'view') return hasPermission('view_microfinance');
      if (mode === 'edit') return hasPermission('add_transaction') || hasPermission('edit_transaction');
      return hasPermission('delete_transaction');
    }
    if (mode === 'view') {
      return (
        mfPermState.combined.has(`sub_${subKey}_view`) ||
        mfPermState.combined.has(`sub_${subKey}_edit`) ||
        mfPermState.combined.has(`sub_${subKey}_delete`)
      );
    }
    return mfPermState.combined.has(`sub_${subKey}_${mode}`);
  };

  const canViewDashboard = canMfAccess('mf_dashboard', 'view');
  const canViewCenters = canMfAccess('mf_centers', 'view');
  const canEditCenters = canMfAccess('mf_centers', 'edit');
  const canDeleteCenters = canMfAccess('mf_centers', 'delete');
  const canViewGroups = canMfAccess('mf_groups', 'view');
  const canEditGroups = canMfAccess('mf_groups', 'edit');
  const canDeleteGroups = canMfAccess('mf_groups', 'delete');
  const canViewMembers = canMfAccess('mf_members', 'view');
  const canEditMembers = canMfAccess('mf_members', 'edit');
  const canDeleteMembers = canMfAccess('mf_members', 'delete');
  const canViewSaving = canMfAccess('mf_saving', 'view');
  const canEditSaving = canMfAccess('mf_saving', 'edit');
  const canDeleteSaving = canMfAccess('mf_saving', 'delete');
  const canViewLoan = canMfAccess('mf_loan', 'view');
  const canEditLoan = canMfAccess('mf_loan', 'edit');
  const canDeleteLoan = canMfAccess('mf_loan', 'delete');
  const canViewCollectionReport = canMfAccess('mf_reports', 'view');
  const canEditCollectionReport = canMfAccess('mf_reports', 'edit');
  const canDeleteCollectionReport = canMfAccess('mf_reports', 'delete');
  const canViewSignatureReport = canMfAccess('mf_signature_sheet', 'view');
  const canEditSignatureReport = canMfAccess('mf_signature_sheet', 'edit');
  const canDeleteSignatureReport = canMfAccess('mf_signature_sheet', 'delete');
  const canViewDepositSheet = canMfAccess('mf_deposit_sheet', 'view') || canViewSignatureReport;
  const canEditDepositSheet = canMfAccess('mf_deposit_sheet', 'edit');
  const canDeleteDepositSheet = canMfAccess('mf_deposit_sheet', 'delete');
  const canViewMeetingMinutes = canMfAccess('mf_meeting_minutes', 'view');
  const canEditMeetingMinutes = canMfAccess('mf_meeting_minutes', 'edit');
  const canDeleteMeetingMinutes = canMfAccess('mf_meeting_minutes', 'delete');
  const canViewIdCard = canMfAccess('mf_id_card', 'view');
  const canEditIdCard = canMfAccess('mf_id_card', 'edit');
  const canDeleteIdCard = canMfAccess('mf_id_card', 'delete');
  const canViewReports =
    canViewCollectionReport || canViewSignatureReport || canViewDepositSheet || canViewMeetingMinutes || canViewIdCard;

  useEffect(() => {
    void refreshUser().catch(() => {});
    void refreshRoles().catch(() => {});
    storageService.getBranches().then(b => {
      if (b && b.length > 0) setAdminBranches(b);
    }).catch(() => {});
    storageService.getSettings().then(s => {
      if (s) setSystemSettings(s);
    }).catch(() => {});
  }, []);

  const rawLogo = systemSettings?.logoUrl || authSettings?.logoUrl;
  const logoUrl = (rawLogo && !rawLogo.includes('picsum.photos')) ? rawLogo : '/system_logo.png';

  const availableBranches = useMemo(() => {
    if (adminBranches && adminBranches.length > 0) return adminBranches;
    return [
      { id: 'main', name: 'Ratauli Central Head Office', code: 'C01', status: 'Active' as const, createdAt: 0 },
      { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', status: 'Active' as const, createdAt: 0 },
      { id: 'pipra', name: 'Pipra Branch', code: 'C03', status: 'Active' as const, createdAt: 0 },
      { id: 'parsa', name: 'Parsa Branch', code: 'C04', status: 'Active' as const, createdAt: 0 }
    ];
  }, [adminBranches]);

  // Meeting Days 1 to 30 dropdown list
  const meetingDaysList = useMemo(() => {
    const getOrdinal = (n: number) => {
      if (n >= 11 && n <= 13) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    return Array.from({ length: 30 }, (_, i) => {
      const d = i + 1;
      return `Day ${d}${getOrdinal(d)}`;
    });
  }, []);
  
  // Current active sub-menu
  const [activeTab, setActiveTab] = useState<SubMenuTab>('dashboard');

  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const status = (params.get('status') || '').toUpperCase();
    if (tab === 'dashboard' || tab === 'centers' || tab === 'groups' || tab === 'members' || tab === 'saving' || tab === 'loan' || tab === 'reports') {
      setActiveTab(tab);
    }
    if (tab === 'saving' && (status === 'ACTIVE' || status === 'MATURED' || status === 'CLOSED')) {
      setSavingStatusTab(status);
    }
    if (tab === 'loan' && (status === 'ACTIVE' || status === 'MATURED' || status === 'CLOSED')) {
      setLoanStatusTab(status);
    }
  }, [location.search]);

  // Branch Scope:
  // - Super Admin: sees ALL branches by default (with branch filter dropdown)
  // - Designated User (granted 'All Branches' or 'Selected Branches' in Admin Center -> User Management):
  //   sees their designated branches across all Micro-Finance sub-menus (with branch filter dropdown)
  // - Standard User (default): strictly sees ONLY their logged-in branch across all Micro-Finance sub-menus
  const [superAdminBranchFilter, setSuperAdminBranchFilter] = useState<string>('ALL');

  const loggedInBranchObj = useMemo(() => {
    return (
      findMatchingBranch(branch?.id || branch?.name || user?.branchId, availableBranches) ||
      branch ||
      availableBranches[0]
    );
  }, [branch, user?.branchId, availableBranches]);

  const loggedInBranchKey = useMemo(() => {
    return resolveCanonicalBranchKey(
      loggedInBranchObj?.id || loggedInBranchObj?.name || branch?.id || branch?.name || user?.branchId,
      availableBranches
    );
  }, [loggedInBranchObj, branch?.id, branch?.name, user?.branchId, availableBranches]);

  const defaultBranchName = loggedInBranchObj?.name || branch?.name || availableBranches[0]?.name || 'Ratauli Head Office';

  const userMfBranchAccess = useMemo(
    () => parseUserMfBranchAccess(user?.permissions, role?.permissions, loggedInBranchKey, availableBranches),
    [user?.permissions, role?.permissions, loggedInBranchKey, availableBranches]
  );

  const hasAllBranchesAccess = isSuperAdmin || userMfBranchAccess.mode === 'all';
  const canSwitchBranchView = isSuperAdmin || userMfBranchAccess.canSwitchViewBranch;

  const selectableBranches = useMemo(() => {
    if (hasAllBranchesAccess) return availableBranches;
    if (userMfBranchAccess.mode === 'selected') {
      const allowedSet = new Set(userMfBranchAccess.allowedBranchKeys);
      const matched = availableBranches.filter(b =>
        allowedSet.has(resolveCanonicalBranchKey(b.id, availableBranches))
      );
      return matched.length > 0 ? matched : availableBranches;
    }
    return loggedInBranchObj ? [loggedInBranchObj] : availableBranches.slice(0, 1);
  }, [hasAllBranchesAccess, userMfBranchAccess, availableBranches, loggedInBranchObj]);

  const effectiveBranchKeys = useMemo(() => {
    if (hasAllBranchesAccess) {
      if (!superAdminBranchFilter || superAdminBranchFilter === 'ALL') return [];
      const single = resolveCanonicalBranchKey(superAdminBranchFilter, availableBranches);
      return single ? [single] : [];
    }
    if (userMfBranchAccess.mode === 'selected') {
      if (!superAdminBranchFilter || superAdminBranchFilter === 'ALL') {
        return userMfBranchAccess.allowedBranchKeys;
      }
      const single = resolveCanonicalBranchKey(superAdminBranchFilter, availableBranches);
      if (single && userMfBranchAccess.allowedBranchKeys.includes(single)) {
        return [single];
      }
      return userMfBranchAccess.allowedBranchKeys;
    }
    return loggedInBranchKey ? [loggedInBranchKey] : [];
  }, [hasAllBranchesAccess, userMfBranchAccess, superAdminBranchFilter, loggedInBranchKey, availableBranches]);

  const effectiveBranchKey = effectiveBranchKeys.length === 1 ? effectiveBranchKeys[0] : '';

  // Raw Datasets (full multi-branch data loaded from service/Supabase)
  const [rawCenters, setCenters] = useState<MFCenter[]>(() => microFinanceService.getCenters());
  const [rawGroups, setGroups] = useState<MFSamuhGroup[]>(() => microFinanceService.getGroups());
  const [rawMembers, setMembers] = useState<MFMember[]>(() => microFinanceService.getMembers());
  const [rawSavings, setSavings] = useState<MFSavingsRecord[]>(() => microFinanceService.getSavings());
  const [rawLoans, setLoans] = useState<MFLoanRecord[]>(() => microFinanceService.getLoans());
  const [rawSheets, setSheets] = useState<MFCollectionSheet[]>(() => microFinanceService.getSheets());
  const [rawSignatureSheets, setSignatureSheets] = useState<MFSignatureSheet[]>(() => microFinanceService.getSignatureSheets());
  const [rawMeetingMinutes, setMeetingMinutes] = useState<GroupMeetingRecord[]>(() => meetingMinutesService.getMeetings());
  const [rawClosedLoansArchive, setClosedLoansArchive] = useState<MFLoanRecord[]>([]);

  // Branch-Scoped Datasets used across EVERY Micro-Finance sub-menu (Dashboard, Centers, Groups, Members, Saving, Loan, Reports)
  const {
    centers,
    groups,
    members,
    savings,
    loans,
    closedLoansArchive,
    sheets,
    signatureSheets,
    meetingMinutes
  } = useMemo(
    () =>
      scopeMicroFinanceData({
        centers: rawCenters,
        groups: rawGroups,
        members: rawMembers,
        savings: rawSavings,
        loans: rawLoans,
        closedLoansArchive: rawClosedLoansArchive,
        sheets: rawSheets,
        signatureSheets: rawSignatureSheets,
        meetingMinutes: rawMeetingMinutes,
        targetBranchKeys: effectiveBranchKeys,
        branches: availableBranches
      }),
    [
      rawCenters,
      rawGroups,
      rawMembers,
      rawSavings,
      rawLoans,
      rawClosedLoansArchive,
      rawSheets,
      rawSignatureSheets,
      rawMeetingMinutes,
      effectiveBranchKeys,
      availableBranches
    ]
  );

  // Search & Center/Group Filter states
  const [dashboardCenterSearch, setDashboardCenterSearch] = useState('');
  const [centerSearch, setCenterSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberCenterFilterId, setMemberCenterFilterId] = useState('');
  const [memberGroupFilterId, setMemberGroupFilterId] = useState('');
  const [appliedMemberCenterId, setAppliedMemberCenterId] = useState('');
  const [appliedMemberGroupId, setAppliedMemberGroupId] = useState('');

  const [savingSearch, setSavingSearch] = useState('');
  const [savingStatusTab, setSavingStatusTab] = useState<'ACTIVE' | 'MATURED' | 'CLOSED'>('ACTIVE');
  const [selectedSavingToToggleStatus, setSelectedSavingToToggleStatus] = useState<MFSavingsRecord | null>(null);
  const [isToggleSavingStatusModalOpen, setIsToggleSavingStatusModalOpen] = useState(false);
  const [savingCenterFilterId, setSavingCenterFilterId] = useState('');
  const [savingGroupFilterId, setSavingGroupFilterId] = useState('');
  const [appliedSavingCenterId, setAppliedSavingCenterId] = useState('');
  const [appliedSavingGroupId, setAppliedSavingGroupId] = useState('');

  const [loanSearch, setLoanSearch] = useState('');
  const [loanCenterFilterId, setLoanCenterFilterId] = useState('');
  const [loanGroupFilterId, setLoanGroupFilterId] = useState('');
  const [appliedLoanCenterId, setAppliedLoanCenterId] = useState('');
  const [appliedLoanGroupId, setAppliedLoanGroupId] = useState('');
  const [loanStatusTab, setLoanStatusTab] = useState<'ACTIVE' | 'MATURED' | 'CLOSED'>('ACTIVE');
  const [isLoadingClosedLoans, setIsLoadingClosedLoans] = useState(false);

  // Current BS Date calculation for default values
  const currentBsDate = useMemo(() => {
    try {
      const nep = new NepaliDate();
      const y = nep.getYear().toString();
      const m = nepaliMonthsEnglishList[nep.getMonth()] || 'Kartik';
      const d = nep.getDate().toString();
      return { year: y, month: m, day: d };
    } catch (e) {
      return { year: '2083', month: 'Kartik', day: '1' };
    }
  }, []);

  // Reports state (Matching image_ff5945f2.png)
  const [reportTab, setReportTab] = useState<'collection' | 'signature' | 'deposit' | 'meeting-minutes' | 'id-card'>('collection');
  const [reportYear, setReportYear] = useState(currentBsDate.year);
  const [reportMonth, setReportMonth] = useState(currentBsDate.month);
  const [reportDay, setReportDay] = useState(currentBsDate.day);
  const [reportCenterId, setReportCenterId] = useState('');
  const [reportGroupId, setReportGroupId] = useState('');

  // Auto-select first permitted main tab / report sub-tab based on Admin Center role permissions
  useEffect(() => {
    const allowedTabs: SubMenuTab[] = [];
    if (canViewDashboard) allowedTabs.push('dashboard');
    if (canViewCenters) allowedTabs.push('centers');
    if (canViewGroups) allowedTabs.push('groups');
    if (canViewMembers) allowedTabs.push('members');
    if (canViewSaving) allowedTabs.push('saving');
    if (canViewLoan) allowedTabs.push('loan');
    if (canViewReports) allowedTabs.push('reports');
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [
    activeTab,
    canViewDashboard,
    canViewCenters,
    canViewGroups,
    canViewMembers,
    canViewSaving,
    canViewLoan,
    canViewReports
  ]);

  useEffect(() => {
    const allowedReportTabs: Array<'collection' | 'signature' | 'deposit' | 'meeting-minutes' | 'id-card'> = [];
    if (canViewCollectionReport) allowedReportTabs.push('collection');
    if (canViewSignatureReport) allowedReportTabs.push('signature');
    if (canViewDepositSheet) allowedReportTabs.push('deposit');
    if (canViewMeetingMinutes) allowedReportTabs.push('meeting-minutes');
    if (canViewIdCard) allowedReportTabs.push('id-card');
    if (allowedReportTabs.length > 0 && !allowedReportTabs.includes(reportTab)) {
      setReportTab(allowedReportTabs[0]);
    }
  }, [
    reportTab,
    canViewCollectionReport,
    canViewSignatureReport,
    canViewDepositSheet,
    canViewMeetingMinutes,
    canViewIdCard
  ]);

  const filteredReportCenters = useMemo(() => {
    const targetDay = parseInt(reportDay, 10);
    if (isNaN(targetDay)) return centers;
    return centers.filter(c => extractMeetingDayNumber(c.meetingDay) === targetDay);
  }, [centers, reportDay]);

  // Modals
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<MFCenter | null>(null);
  const [centerForm, setCenterForm] = useState({
    code: '',
    name: '',
    location: '',
    branch: defaultBranchName,
    meetingDay: 'Day 15th',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    fieldOfficer: 'Ramesh Sharma',
    contactNo: ''
  });

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MFSamuhGroup | null>(null);
  const [selectedCenterForGroupsList, setSelectedCenterForGroupsList] = useState<MFCenter | null>(null);
  const [selectedGroupForMembersList, setSelectedGroupForMembersList] = useState<MFSamuhGroup | null>(null);
  const [actionBlockNotice, setActionBlockNotice] = useState<{
    title: string;
    subtitle: string;
    message: string;
    items: Array<{ label: string; detail: string; status: string; kind: 'saving' | 'loan' | 'group' | 'member' }>;
    hint?: string;
    showGoToSaving?: boolean;
    showGoToLoan?: boolean;
  } | null>(null);
  const [groupForm, setGroupForm] = useState({
    code: '',
    name: '',
    centerId: '',
    place: '',
    meetingDay: 'Day 15th',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    leaderName: '',
    leaderMobile: ''
  });

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MFMember | null>(null);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);
  const [memberStatusTab, setMemberStatusTab] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [selectedMemberToView, setSelectedMemberToView] = useState<MFMember | null>(null);
  const [isViewMemberModalOpen, setIsViewMemberModalOpen] = useState(false);
  const [viewMemberDetailTab, setViewMemberDetailTab] = useState<'all' | 'saving' | 'loan'>('all');
  const [selectedMemberToToggleStatus, setSelectedMemberToToggleStatus] = useState<MFMember | null>(null);
  const [isToggleMemberStatusModalOpen, setIsToggleMemberStatusModalOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({
    memberId: '',
    name: '',
    citizenshipNo: '',
    mobile: '',
    gender: 'Female' as 'Female' | 'Male' | 'Other',
    branch: defaultBranchName,
    centerId: '',
    samuhId: '',
    role: 'Member' as 'Leader' | 'Secretary' | 'Treasurer' | 'Member',
    savingsAccountNo: '',
    address: '',
    joinedDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    totalSavings: 0,
    activeLoanAmount: 0,
    photoUrl: ''
  });

  // Saving products configured in Admin Center (filtered by checkbox)
  const [savingProductsList, setSavingProductsList] = useState<SavingProduct[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const prods = await productService.getSavingProducts();
        setSavingProductsList(prods);
      } catch (e) {
        console.error('Failed to load saving products:', e);
      }
    };
    loadProducts();
    const handleUpdate = () => loadProducts();
    window.addEventListener('savingProductsUpdated', handleUpdate);
    return () => window.removeEventListener('savingProductsUpdated', handleUpdate);
  }, []);

  const filteredMfSavingProducts = useMemo(() => {
    const enabled = savingProductsList.filter(
      p => Boolean(p.showInMicrofinance ?? p.showInMicrofinanceAndFD) && p.status !== 'Inactive'
    );
    return enabled.length > 0 ? enabled : savingProductsList.filter(p => p.status !== 'Inactive');
  }, [savingProductsList]);

  // Savings Account & Deposit Modal State (supports member search & multiple accounts at once)
  const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);
  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [selectedSavingMemberId, setSelectedSavingMemberId] = useState('');
  const [savingFormError, setSavingFormError] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState(() => getTodayBsDate());
  const [savingAccounts, setSavingAccounts] = useState<Array<{
    id: string;
    accountNo: string;
    savingType: string;
    product: string;
    amount: number;
    periodYears: number;
    maturityDateBs: string;
  }>>(() => {
    const initialDate = getTodayBsDate();
    return [
      {
        id: 'acc-1',
        accountNo: 'SAV-1001-01',
        savingType: 'Normal Saving',
        product: 'General Saving',
        amount: 1000,
        periodYears: DEFAULT_SAVING_PERIOD_YEARS,
        maturityDateBs: calculateBsMaturityDateByYears(initialDate, DEFAULT_SAVING_PERIOD_YEARS)
      }
    ];
  });

  // Loan Products from Admin Center (filtered by MF checkbox)
  const [loanProductsList, setLoanProductsList] = useState<LoanProduct[]>([]);

  useEffect(() => {
    const loadLoanProducts = async () => {
      try {
        const prods = await productService.getLoanProducts();
        setLoanProductsList(prods);
      } catch (e) {
        console.error('Failed to load loan products:', e);
      }
    };
    loadLoanProducts();
    const handleUpdate = () => loadLoanProducts();
    window.addEventListener('loanProductsUpdated', handleUpdate);
    return () => window.removeEventListener('loanProductsUpdated', handleUpdate);
  }, []);

  const filteredMfLoanProducts = useMemo(() => {
    const enabled = loanProductsList.filter(
      p => Boolean(p.showInMicrofinance ?? p.showInMicrofinanceAndFD) && p.status !== 'Inactive'
    );
    return enabled.length > 0 ? enabled : loanProductsList.filter(p => p.status !== 'Inactive');
  }, [loanProductsList]);

  // Issue Loan Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanMemberSearchInput, setLoanMemberSearchInput] = useState('');
  const [isLoanMemberDropdownOpen, setIsLoanMemberDropdownOpen] = useState(false);
  const [loanFormError, setLoanFormError] = useState<string | null>(null);
  const [loanForm, setLoanForm] = useState({
    memberId: '',
    accountNo: '',
    name: '',
    centerName: '',
    groupName: '',
    loanDate: new Date().toISOString().split('T')[0],
    loanDateBs: '2083-07-25',
    loanAmount: 50000,
    remainingAmount: 50000,
    installmentAmount: 4800,
    totalInstallments: 12,
    paidInstallments: 0,
    interestRate: 14,
    status: 'ACTIVE' as 'ACTIVE' | 'MATURED' | 'CLOSED',
    loanProduct: 'General Loan',
    maturityDate: '2084-07-25'
  });

  // Loan Actions Modals State: View, Edit, Delete
  const [selectedLoanToView, setSelectedLoanToView] = useState<MFLoanRecord | null>(null);
  const [isViewLoanModalOpen, setIsViewLoanModalOpen] = useState(false);

  const [selectedLoanToEdit, setSelectedLoanToEdit] = useState<MFLoanRecord | null>(null);
  const [isEditLoanModalOpen, setIsEditLoanModalOpen] = useState(false);
  const [editLoanForm, setEditLoanForm] = useState<MFLoanRecord | null>(null);

  const [selectedLoanToDelete, setSelectedLoanToDelete] = useState<MFLoanRecord | null>(null);
  const [isDeleteLoanModalOpen, setIsDeleteLoanModalOpen] = useState(false);

  const [selectedLoanToClose, setSelectedLoanToClose] = useState<MFLoanRecord | null>(null);
  const [isCloseLoanModalOpen, setIsCloseLoanModalOpen] = useState(false);
  const [closeLoanDateBs, setCloseLoanDateBs] = useState<string>(() => getTodayBsDate());
  const [isClosingLoan, setIsClosingLoan] = useState(false);

  const [isPrintSheetModalOpen, setIsPrintSheetModalOpen] = useState(false);
  const [collectionSheetModalMode, setCollectionSheetModalMode] = useState<'preview' | 'record'>('preview');
  const [activeSheetToPrint, setActiveSheetToPrint] = useState<MFCollectionSheet | null>(null);
  const [collectionSheetLoans, setCollectionSheetLoans] = useState<MFLoanRecord[]>([]);
  const [collectionSheetTargetBs, setCollectionSheetTargetBs] = useState<string>('');
  const [isLoadingCollectionSheet, setIsLoadingCollectionSheet] = useState(false);
  const [isLoadingSignatureSheet, setIsLoadingSignatureSheet] = useState(false);

  // Signature Sheets Modal State (data derived above with branch scoping)
  const [selectedSignatureSheetToPrint, setSelectedSignatureSheetToPrint] = useState<MFSignatureSheet | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureSheetModalMode, setSignatureSheetModalMode] = useState<'preview' | 'record'>('preview');
  const [selectedSignatureSheetToDelete, setSelectedSignatureSheetToDelete] = useState<MFSignatureSheet | null>(null);
  const [isDeleteSignatureModalOpen, setIsDeleteSignatureModalOpen] = useState(false);
  const [alreadyGeneratedNotice, setAlreadyGeneratedNotice] = useState<{
    reportName: string;
    groupName: string;
    periodLabel: string;
    existingDetail?: string;
  } | null>(null);

  const [selectedSavingToView, setSelectedSavingToView] = useState<MFSavingsRecord | null>(null);
  const [isViewSavingModalOpen, setIsViewSavingModalOpen] = useState(false);

  const [isEditSavingModalOpen, setIsEditSavingModalOpen] = useState(false);
  const [editSavingForm, setEditSavingForm] = useState<MFSavingsRecord | null>(null);

  const [selectedSavingToDelete, setSelectedSavingToDelete] = useState<MFSavingsRecord | null>(null);
  const [isDeleteSavingModalOpen, setIsDeleteSavingModalOpen] = useState(false);

  const [selectedSheetToDelete, setSelectedSheetToDelete] = useState<MFCollectionSheet | null>(null);
  const [isDeleteSheetModalOpen, setIsDeleteSheetModalOpen] = useState(false);

  const [selectedCenterToDelete, setSelectedCenterToDelete] = useState<MFCenter | null>(null);
  const [isDeleteCenterModalOpen, setIsDeleteCenterModalOpen] = useState(false);

  const [selectedGroupToDelete, setSelectedGroupToDelete] = useState<MFSamuhGroup | null>(null);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);

  const [selectedMemberToDelete, setSelectedMemberToDelete] = useState<MFMember | null>(null);
  const [isDeleteMemberModalOpen, setIsDeleteMemberModalOpen] = useState(false);

  // Manual Dues per member in Collection Sheet
  const [manualDues, setManualDues] = useState<Record<string, number>>({});

  // History filter on right side of Collection Sheet Records table (default ALL so all Supabase rows show)
  const [sheetHistoryYear, setSheetHistoryYear] = useState('ALL');
  const [sheetHistoryMonth, setSheetHistoryMonth] = useState('ALL');

  // Signature Sheet Tab Filter Card state (defaults to current BS date)
  const [sigFilterYear, setSigFilterYear] = useState(currentBsDate.year);
  const [sigFilterMonth, setSigFilterMonth] = useState(currentBsDate.month);
  const [sigFilterDay, setSigFilterDay] = useState(currentBsDate.day);
  const [sigFilterCenterId, setSigFilterCenterId] = useState('');
  const [sigFilterGroupId, setSigFilterGroupId] = useState('');
  const [sigFilterEmployeeId, setSigFilterEmployeeId] = useState('ALL');

  // History filter on right side of Signature Sheets records table (default ALL so all Supabase rows show)
  const [sigHistoryYear, setSigHistoryYear] = useState('ALL');
  const [sigHistoryMonth, setSigHistoryMonth] = useState('ALL');

  // HR Management Employees
  const [hrEmployees, setHrEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    storageService.getEmployees().then(emps => {
      if (emps && emps.length > 0) {
        setHrEmployees(emps);
      } else {
        try {
          const raw = localStorage.getItem('employees');
          if (raw) setHrEmployees(JSON.parse(raw));
        } catch (e) {
          // ignore error
        }
      }
    }).catch(() => {
      try {
        const raw = localStorage.getItem('employees');
        if (raw) setHrEmployees(JSON.parse(raw));
      } catch (e) {
        // ignore error
      }
    });
  }, []);

  const activeHrEmployees = useMemo(() => {
    if (hrEmployees && hrEmployees.length > 0) {
      if (effectiveBranchKeys.length > 0) {
        const keySet = new Set(effectiveBranchKeys);
        const scopedEmps = hrEmployees.filter(emp =>
          keySet.has(resolveCanonicalBranchKey(emp.branchId, availableBranches))
        );
        if (scopedEmps.length > 0) return scopedEmps;
      }
      return hrEmployees;
    }
    return [
      { id: 'emp-1', fullName: 'Chandan', employeeCode: 'EMP-001', designation: 'कर्मचारी', status: 'Active' },
      { id: 'emp-2', fullName: 'Ramesh Sharma', employeeCode: 'EMP-002', designation: 'Field Officer', status: 'Active' },
      { id: 'emp-3', fullName: 'Sunil Kumar', employeeCode: 'EMP-003', designation: 'Branch Manager', status: 'Active' },
      { id: 'emp-4', fullName: 'Pooja Kumari Yadav', employeeCode: 'EMP-004', designation: 'Loan Officer', status: 'Active' }
    ] as Employee[];
  }, [hrEmployees, effectiveBranchKeys, availableBranches]);

  // Robust Print Preview generator for both Collection and Signature sheets
  const handlePrintElement = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) {
      window.print();
      return;
    }

    try {
      let printContainer = document.getElementById('mf-direct-print-target');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'mf-direct-print-target';
        document.body.appendChild(printContainer);
      }
      printContainer.innerHTML = el.innerHTML;
      document.body.classList.add('printing-mf-sheet');

      const cleanup = () => {
        document.body.classList.remove('printing-mf-sheet');
        if (printContainer) {
          printContainer.innerHTML = '';
        }
        window.removeEventListener('afterprint', cleanup);
      };

      window.addEventListener('afterprint', cleanup);

      // Trigger native browser print preview dialog
      setTimeout(() => {
        try {
          window.print();
        } catch {
          // fallback
        } finally {
          setTimeout(cleanup, 2500);
        }
      }, 100);
    } catch {
      window.print();
    }
  };

  // Bulk Excel Upload & Sample Download State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState<string>('Centers');
  const [bulkFileName, setBulkFileName] = useState<string>('');
  const [bulkParsedRows, setBulkParsedRows] = useState<Record<string, unknown>[]>([]);
  const [bulkUploadError, setBulkUploadError] = useState<string | null>(null);
  const [bulkUploadSuccess, setBulkUploadSuccess] = useState<{
    entityType: string;
    count: number;
    fileName?: string;
    skippedCount?: number;
    skippedMessage?: string;
  } | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState<boolean>(false);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isBulkModalOpen) {
      setBulkFileName('');
      setBulkParsedRows([]);
      setBulkUploadError(null);
      setIsBulkUploading(false);
    }
  }, [isBulkModalOpen, bulkType]);

  const normalizeExcelHeader = (header: string): string =>
    header
      .trim()
      .toLowerCase()
      .replace(/[\s_\-().:/,%]+/g, '');

  const getExcelCell = (row: Record<string, unknown>, keys: string[]): string => {
    const entries = Object.entries(row).map(([k, v]) => ({
      norm: normalizeExcelHeader(k),
      val: v
    }));
    const targets = keys.map(normalizeExcelHeader).filter(Boolean);

    // 1. Exact normalized match
    for (const targetKey of targets) {
      const found = entries.find(e => e.norm === targetKey);
      if (found && found.val !== undefined && found.val !== null && String(found.val).trim() !== '') {
        const val = found.val;
        if (val instanceof Date && !isNaN(val.getTime())) {
          return val.toISOString().split('T')[0];
        }
        return String(val).trim();
      }
    }

    // 2. Safe prefix match for headers with units/notes like "Amount (NPR)" or "Member Name (Full)"
    for (const targetKey of targets) {
      if (targetKey.length < 5) continue;
      const found = entries.find(e => e.norm.startsWith(targetKey));
      if (found && found.val !== undefined && found.val !== null && String(found.val).trim() !== '') {
        const val = found.val;
        if (val instanceof Date && !isNaN(val.getTime())) {
          return val.toISOString().split('T')[0];
        }
        return String(val).trim();
      }
    }

    return '';
  };

  const parseExcelNumber = (raw: string | number | undefined | null): number => {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    const str = String(raw ?? '').trim();
    if (!str) return 0;
    const nepaliMap: Record<string, string> = {
      '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
      '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
    };
    const ascii = str.replace(/[०-९]/g, d => nepaliMap[d] || d);
    // Strip currency labels, commas, and spaces while keeping digits, decimal point, and leading minus
    const cleaned = ascii.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  const handleDownloadBulkSampleExcel = () => {
    let sampleRows: Record<string, string | number>[] = [];
    const defaultCenter = centers[0]?.name || 'Center 01 (Janaki Chowk)';
    const defaultGroup = groups[0]?.name || 'Laxmi Mahila Samuh';
    const defaultBranch = defaultBranchName;
    const todayBs = getTodayBsDate();

    if (bulkType === 'Centers') {
      sampleRows = [
        {
          'Code': `C-00${centers.length + 1}`,
          'Center Name': 'Center 04 (Ram Chowk)',
          'Location': 'Pipra Ward 3, Mahottari',
          'Branch': defaultBranch,
          'Meeting Day': 'Day 10th',
          'Field Officer': 'Ramesh Sharma',
          'Contact No': '9845000001',
          'Status': 'ACTIVE'
        },
        {
          'Code': `C-00${centers.length + 2}`,
          'Center Name': 'Center 05 (Bajar Chowk)',
          'Location': 'Ratauli Ward 2, Mahottari',
          'Branch': defaultBranch,
          'Meeting Day': 'Day 15th',
          'Field Officer': 'Sita Ram Yadav',
          'Contact No': '9845000002',
          'Status': 'ACTIVE'
        }
      ];
    } else if (bulkType === 'Groups') {
      sampleRows = [
        {
          'Code': `G-00${groups.length + 1}`,
          'Group Name': 'Annapurna Mahila Samuh',
          'Center Name': defaultCenter,
          'Place': 'Janakpur Ward 4',
          'Meeting Day': 'Day 15th',
          'Leader Name': 'Kamala Devi',
          'Leader Mobile': '9801112233',
          'Status': 'ACTIVE'
        },
        {
          'Code': `G-00${groups.length + 2}`,
          'Group Name': 'Shakti Mahila Samuh',
          'Center Name': defaultCenter,
          'Place': 'Ratauli Bazaar',
          'Meeting Day': 'Day 20th',
          'Leader Name': 'Mina Kumari',
          'Leader Mobile': '9801112244',
          'Status': 'ACTIVE'
        }
      ];
    } else if (bulkType === 'Members') {
      sampleRows = [
        {
          'Member ID': `M-${1001 + members.length}`,
          'Name': 'Sita Kumari Sah',
          'Citizenship No': '18-01-79-11223',
          'Mobile': '9801234500',
          'Gender': 'Female',
          'Branch': defaultBranch,
          'Center Name': defaultCenter,
          'Group Name': defaultGroup,
          'Role': 'Member',
          'Savings Account No': `SAV-${1001 + members.length}`,
          'Address': 'Pipra-6, Mahottari',
          'Joined Date': todayBs,
          'Total Savings': 1000,
          'Status': 'ACTIVE'
        },
        {
          'Member ID': `M-${1002 + members.length}`,
          'Name': 'Radha Devi Mandal',
          'Citizenship No': '18-01-80-22334',
          'Mobile': '9801234501',
          'Gender': 'Female',
          'Branch': defaultBranch,
          'Center Name': defaultCenter,
          'Group Name': defaultGroup,
          'Role': 'Member',
          'Savings Account No': `SAV-${1002 + members.length}`,
          'Address': 'Ratauli-3, Mahottari',
          'Joined Date': todayBs,
          'Total Savings': 1500,
          'Status': 'ACTIVE'
        }
      ];
    } else if (bulkType === 'Savings') {
      const m1 = members[0];
      const m2 = members[1] || m1;
      sampleRows = [
        {
          'Member ID': m1?.memberId || 'M-1001',
          'Account No': m1?.savingsAccountNo || 'SAV-1001',
          'Name': m1?.name || 'Sita Devi Chaudhary',
          'Group Name': m1?.samuhName || defaultGroup,
          'Center Name': m1?.centerName || defaultCenter,
          'Open Date': todayBs,
          'Period (Years)': DEFAULT_SAVING_PERIOD_YEARS,
          'Maturity Date (BS)': calculateBsMaturityDateByYears(todayBs, DEFAULT_SAVING_PERIOD_YEARS),
          'Recurring Amount': 1000,
          'Saving Type': filteredMfSavingProducts[0]?.name || 'Normal Saving',
          'Status': 'ACTIVE'
        },
        {
          'Member ID': m2?.memberId || 'M-1002',
          'Account No': m2?.savingsAccountNo || 'SAV-1002',
          'Name': m2?.name || 'Geeta Kumari Mandal',
          'Group Name': m2?.samuhName || defaultGroup,
          'Center Name': m2?.centerName || defaultCenter,
          'Open Date': todayBs,
          'Period (Years)': DEFAULT_SAVING_PERIOD_YEARS,
          'Maturity Date (BS)': calculateBsMaturityDateByYears(todayBs, DEFAULT_SAVING_PERIOD_YEARS),
          'Recurring Amount': 1000,
          'Saving Type': filteredMfSavingProducts[0]?.name || 'Normal Saving',
          'Status': 'ACTIVE'
        }
      ];
    } else if (bulkType === 'Loans') {
      const m1 = members[0];
      const m2 = members[1] || m1;
      sampleRows = [
        {
          'Member ID': m1?.memberId || 'M-1001',
          'Account No': `LN-${2001 + loans.length + 1}`,
          'Name': m1?.name || 'Sita Devi Chaudhary',
          'Center Name': m1?.centerName || defaultCenter,
          'Group Name': m1?.samuhName || defaultGroup,
          'Loan Product': filteredMfLoanProducts[0]?.name || 'General Group Loan',
          'Loan Date (BS)': todayBs,
          'Loan Amount': 50000,
          'Remaining Amount': 50000,
          'Installment Amount': 4800,
          'Period (Months)': 12,
          'Paid Installments': 0,
          'Interest Rate (%)': 14,
          'Maturity Date (BS)': calculateBsMaturityDate(todayBs, 12),
          'Status': 'ACTIVE'
        },
        {
          'Member ID': m2?.memberId || 'M-1002',
          'Account No': `LN-${2001 + loans.length + 2}`,
          'Name': m2?.name || 'Geeta Kumari Mandal',
          'Center Name': m2?.centerName || defaultCenter,
          'Group Name': m2?.samuhName || defaultGroup,
          'Loan Product': filteredMfLoanProducts[0]?.name || 'General Group Loan',
          'Loan Date (BS)': todayBs,
          'Loan Amount': 60000,
          'Remaining Amount': 60000,
          'Installment Amount': 5700,
          'Period (Months)': 12,
          'Paid Installments': 0,
          'Interest Rate (%)': 14,
          'Maturity Date (BS)': calculateBsMaturityDate(todayBs, 12),
          'Status': 'ACTIVE'
        }
      ];
    }

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const headers = Object.keys(sampleRows[0] || {});
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, bulkType);
    XLSX.writeFile(wb, `MF_${bulkType}_Sample_Template.xlsx`);
    showToast(`Sample Excel downloaded for ${bulkType}`);
  };

  const handleBulkFileSelected = async (file: File) => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setBulkUploadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setBulkUploadError('No worksheet found in the selected file.');
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      // Detect the actual header row even if the Excel sheet has title/banner rows at the top
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
      const knownHeaderTokens = new Set([
        'memberid', 'accountno', 'savingsaccountno', 'name', 'membername', 'fullname',
        'amount', 'recurringamount', 'openamount', 'savingamount', 'deposit', 'depositamount', 'totalsavings', 'saving', 'savings',
        'centername', 'groupname', 'samuhname', 'loanamount', 'loanproduct', 'savingtype', 'opendate', 'datebs', 'status'
      ]);
      let headerRowIndex = 0;
      let bestMatchScore = -1;
      for (let r = 0; r < Math.min(matrix.length, 15); r++) {
        const cells = Array.isArray(matrix[r]) ? matrix[r] : [];
        let score = 0;
        for (const cell of cells) {
          const norm = normalizeExcelHeader(String(cell ?? ''));
          if (norm && knownHeaderTokens.has(norm)) score += 1;
        }
        if (score > bestMatchScore && score >= 2) {
          bestMatchScore = score;
          headerRowIndex = r;
        }
      }

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
        range: headerRowIndex
      });
      const validRows = rawRows.filter(row => {
        const values = Object.values(row);
        if (!values.some(v => v !== undefined && v !== null && String(v).trim() !== '')) return false;
        // Skip trailing summary/total rows if present
        const firstNonEmpty = String(values.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? '')
          .trim()
          .toLowerCase();
        if (firstNonEmpty === 'total' || firstNonEmpty === 'grand total' || firstNonEmpty === 'जम्मा') {
          const idVal = getExcelCell(row, ['Member ID', 'Account No']);
          if (!idVal) return false;
        }
        return true;
      });
      if (validRows.length === 0) {
        setBulkUploadError('The uploaded Excel/CSV file contains no data rows.');
        setBulkFileName('');
        setBulkParsedRows([]);
        return;
      }
      setBulkFileName(file.name);
      setBulkParsedRows(validRows);
    } catch (err) {
      console.error('Excel parse error:', err);
      setBulkUploadError('Unable to read file. Please upload a valid .xlsx, .xls, or .csv file.');
      setBulkFileName('');
      setBulkParsedRows([]);
    }
  };

  const handleProcessBulkUpload = async () => {
    const canBulkEdit =
      bulkType === 'Centers'
        ? canEditCenters
        : bulkType === 'Groups'
        ? canEditGroups
        : bulkType === 'Members'
        ? canEditMembers
        : bulkType === 'Savings'
        ? canEditSaving
        : canEditLoan;
    if (!canBulkEdit) {
      showToast('Permission denied: You do not have edit access for this section.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (bulkParsedRows.length === 0) {
      bulkFileInputRef.current?.click();
      return;
    }

    setIsBulkUploading(true);
    setBulkUploadError(null);
    const todayBs = getTodayBsDate();
    const todayAd = new Date().toISOString().split('T')[0];

    try {
      let createdCount = 0;

      if (bulkType === 'Centers') {
        const items: Omit<MFCenter, 'id' | 'createdAt'>[] = [];
        bulkParsedRows.forEach((row, idx) => {
          const name = getExcelCell(row, ['Center Name', 'Name', 'Center']);
          if (!name) return;
          const code = getExcelCell(row, ['Code', 'Center Code']) || `C-${String(centers.length + idx + 1).padStart(3, '0')}`;
          const statusRaw = getExcelCell(row, ['Status']).toUpperCase();
          items.push({
            code,
            name,
            location: getExcelCell(row, ['Location', 'Address', 'Place']) || 'Mahottari',
            branch: !canSwitchBranchView
              ? defaultBranchName
              : (getExcelCell(row, ['Branch', 'Branch Name']) || defaultBranchName),
            meetingDay: getExcelCell(row, ['Meeting Day', 'Meeting Date']) || 'Day 15th',
            fieldOfficer: getExcelCell(row, ['Field Officer', 'Officer', 'Staff']) || 'Ramesh Sharma',
            contactNo: getExcelCell(row, ['Contact No', 'Mobile', 'Phone']) || '',
            status: statusRaw === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
          });
        });
        if (items.length === 0) {
          setBulkUploadError('No valid Centers found. Ensure the "Center Name" or "Name" column has values.');
          return;
        }
        const updated = microFinanceService.bulkAddCenters(items);
        setCenters(updated);
        createdCount = items.length;
      } else if (bulkType === 'Groups') {
        const items: Omit<MFSamuhGroup, 'id' | 'createdAt'>[] = [];
        bulkParsedRows.forEach((row, idx) => {
          const name = getExcelCell(row, ['Group Name', 'Name', 'Samuh Name']);
          if (!name) return;
          const centerQuery = getExcelCell(row, ['Center Name', 'Center', 'Center Code']);
          const matchedCenter =
            centers.find(c =>
              c.name.toLowerCase() === centerQuery.toLowerCase() ||
              c.code.toLowerCase() === centerQuery.toLowerCase()
            ) || centers[0];
          const code = getExcelCell(row, ['Code', 'Group Code']) || `G-${String(groups.length + idx + 1).padStart(3, '0')}`;
          const statusRaw = getExcelCell(row, ['Status']).toUpperCase();
          items.push({
            code,
            name,
            centerId: matchedCenter?.id || '',
            centerName: matchedCenter?.name || centerQuery || 'Center 01 (Janaki Chowk)',
            place: getExcelCell(row, ['Place', 'Location', 'Address']) || matchedCenter?.location || '',
            membersCount: parseInt(getExcelCell(row, ['Members Count', 'Members']), 10) || 0,
            meetingDay: getExcelCell(row, ['Meeting Day', 'Meeting Date']) || matchedCenter?.meetingDay || 'Day 15th',
            leaderName: getExcelCell(row, ['Leader Name', 'Chairperson', 'Leader']) || '',
            leaderMobile: getExcelCell(row, ['Leader Mobile', 'Mobile', 'Phone']) || '',
            status: statusRaw === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
          });
        });
        if (items.length === 0) {
          setBulkUploadError('No valid Groups found. Ensure the "Group Name" or "Name" column has values.');
          return;
        }
        const updated = microFinanceService.bulkAddGroups(items);
        setGroups(updated);
        createdCount = items.length;
      } else if (bulkType === 'Members') {
        const existingMembersList = microFinanceService.getMembers();
        const usedAutoMemberIds = new Set(
          existingMembersList.map(m => normalizeDuplicateMemberId(m.memberId)).filter(Boolean)
        );
        let autoMemberSeq = 1001 + existingMembersList.length;
        const getNextUnusedAutoMemberId = (): string => {
          while (usedAutoMemberIds.has(normalizeDuplicateMemberId(`M-${autoMemberSeq}`))) {
            autoMemberSeq += 1;
          }
          const nextId = `M-${autoMemberSeq}`;
          usedAutoMemberIds.add(normalizeDuplicateMemberId(nextId));
          autoMemberSeq += 1;
          return nextId;
        };

        const items: Omit<MFMember, 'id' | 'createdAt'>[] = [];
        bulkParsedRows.forEach((row, idx) => {
          const name = getExcelCell(row, ['Name', 'Member Name', 'Full Name']);
          if (!name) return;
          const centerQuery = getExcelCell(row, ['Center Name', 'Center']);
          const groupQuery = getExcelCell(row, ['Group Name', 'Group', 'Samuh Name']);
          const matchedGroup =
            groups.find(g =>
              g.name.toLowerCase() === groupQuery.toLowerCase() ||
              g.code.toLowerCase() === groupQuery.toLowerCase()
            ) || groups[0];
          const matchedCenter =
            centers.find(c =>
              c.name.toLowerCase() === centerQuery.toLowerCase() ||
              c.code.toLowerCase() === centerQuery.toLowerCase() ||
              (matchedGroup && c.id === matchedGroup.centerId)
            ) || centers[0];

          const rawMemberId = getExcelCell(row, ['Member ID', 'Member Code', 'ID', 'सदस्य नं']);
          const memberId = rawMemberId || getNextUnusedAutoMemberId();
          const genderRaw = getExcelCell(row, ['Gender']);
          const gender: 'Female' | 'Male' | 'Other' =
            genderRaw.toLowerCase() === 'male' ? 'Male' : genderRaw.toLowerCase() === 'other' ? 'Other' : 'Female';
          const roleRaw = getExcelCell(row, ['Role']);
          const role: 'Leader' | 'Secretary' | 'Treasurer' | 'Member' =
            roleRaw === 'Leader' || roleRaw === 'Secretary' || roleRaw === 'Treasurer' ? roleRaw : 'Member';
          const statusRaw = getExcelCell(row, ['Status']).toUpperCase();

          items.push({
            memberId,
            name,
            citizenshipNo: getExcelCell(row, ['Citizenship No', 'Citizenship']) || '',
            mobile: getExcelCell(row, ['Mobile', 'Phone', 'Contact No']) || '',
            gender,
            branch: !canSwitchBranchView
              ? (matchedCenter?.branch || defaultBranchName)
              : (getExcelCell(row, ['Branch', 'Branch Name']) || matchedCenter?.branch || defaultBranchName),
            centerId: matchedCenter?.id || '',
            centerName: matchedCenter?.name || centerQuery || '',
            samuhId: matchedGroup?.id || '',
            samuhName: matchedGroup?.name || groupQuery || '',
            role,
            savingsAccountNo: getExcelCell(row, ['Savings Account No', 'Account No', 'Saving Account']) || `SAV-${memberId.replace(/[^0-9]/g, '') || (1001 + idx)}`,
            address: getExcelCell(row, ['Address', 'Location']) || '',
            joinedDate: getExcelCell(row, ['Joined Date', 'Join Date', 'Date']) || todayBs,
            status: statusRaw === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            totalSavings: parseExcelNumber(getExcelCell(row, ['Total Savings', 'Savings', 'Balance'])) || 0,
            activeLoanAmount: parseExcelNumber(getExcelCell(row, ['Active Loan Amount', 'Loan Balance'])) || 0
          });
        });
        if (items.length === 0) {
          setBulkUploadError('No valid Members found. Ensure the "Name" column has values.');
          return;
        }

        const seenMemberIdKeys = new Set<string>();
        const seenCitizenshipKeys = new Set<string>();
        const filteredMemberItems = items.filter(item => {
          const memKey = normalizeDuplicateMemberId(item.memberId);
          const citKey = normalizeCitizenshipKey(item.citizenshipNo);
          if (
            findDuplicateMember(existingMembersList, { memberId: item.memberId, citizenshipNo: item.citizenshipNo }) ||
            (memKey && seenMemberIdKeys.has(memKey)) ||
            (citKey && seenCitizenshipKeys.has(citKey))
          ) {
            return false;
          }
          if (memKey) seenMemberIdKeys.add(memKey);
          if (citKey) seenCitizenshipKeys.add(citKey);
          return true;
        });

        const skippedDuplicateMembers = items.length - filteredMemberItems.length;
        if (filteredMemberItems.length === 0) {
          setBulkUploadError('This member is already registered in the system.');
          return;
        }

        const updatedMembers = microFinanceService.bulkAddMembers(filteredMemberItems);
        setMembers(updatedMembers);
        setGroups(microFinanceService.getGroups());
        createdCount = filteredMemberItems.length;
        if (skippedDuplicateMembers > 0) {
          const uploadedFileName = bulkFileName;
          setIsBulkModalOpen(false);
          setBulkUploadSuccess({
            entityType: bulkType,
            count: createdCount,
            fileName: uploadedFileName,
            skippedCount: skippedDuplicateMembers,
            skippedMessage: `${skippedDuplicateMembers} duplicate row(s) skipped: This member is already registered in the system.`
          });
          showToast(
            `Uploaded ${createdCount} member(s); skipped ${skippedDuplicateMembers} row(s) — This member is already registered in the system.`
          );
          return;
        }
      } else if (bulkType === 'Savings') {
        const items: Omit<MFSavingsRecord, 'id' | 'createdAt'>[] = [];
        let missingIdentityCount = 0;
        let invalidAmountCount = 0;

        bulkParsedRows.forEach((row, idx) => {
          const memberIdRaw = getExcelCell(row, ['Member ID', 'MemberId', 'Member Code', 'ID', 'सदस्य नं']);
          const accountNoRaw = getExcelCell(row, ['Account No', 'Savings Account No', 'Saving Account', 'Saving Account No', 'A/C No', 'खाता नं']);
          const nameRaw = getExcelCell(row, ['Name', 'Member Name', 'Full Name', 'Customer Name', 'Account Holder', 'नाम', 'सदस्यको नाम']);
          const cleanMemberId = stripLeadingZerosId(memberIdRaw).replace(/[^a-z0-9]/g, '');

          const excelGroupRaw = getExcelCell(row, ['Group Name', 'Group', 'Samuh Name', 'समुह', 'समूह']);
          const excelCenterRaw = getExcelCell(row, ['Center Name', 'Center', 'केन्द्र']);
          const excelGroupNorm = normalizeMfText(excelGroupRaw);
          const excelCenterNorm = normalizeMfText(excelCenterRaw);

          const findMemberByExcelRow = () => {
            const nameNorm = normalizeMfText(nameRaw);
            const byId = memberIdRaw
              ? members.find(m => {
                  if (isSameMfMemberId(m.memberId, memberIdRaw)) return true;
                  const mIdDigits = stripLeadingZerosId(m.memberId).replace(/[^a-z0-9]/g, '');
                  return Boolean(cleanMemberId && cleanMemberId.length >= 6 && mIdDigits === cleanMemberId);
                })
              : undefined;

            if (byId) {
              // Guard against Excel copy-paste typos where Member ID belongs to another member in the same group/center
              if (nameNorm && normalizeMfText(byId.name) !== nameNorm) {
                const nameMatches = members.filter(m => {
                  if (normalizeMfText(m.name) !== nameNorm) return false;
                  const targetGroup = excelGroupNorm || normalizeMfText(byId.samuhName);
                  const targetCenter = excelCenterNorm || normalizeMfText(byId.centerName);
                  if (targetGroup && normalizeMfText(m.samuhName) !== targetGroup) return false;
                  if (targetCenter && normalizeMfText(m.centerName) !== targetCenter) return false;
                  return true;
                });
                if (nameMatches.length === 1) return nameMatches[0];
              }
              return byId;
            }

            if (accountNoRaw) {
              const byAcc = members.find(
                m => normalizeMfMemberId(m.savingsAccountNo) === normalizeMfMemberId(accountNoRaw)
              );
              if (byAcc) return byAcc;
            }

            if (nameNorm) {
              return members.find(m => {
                if (normalizeMfText(m.name) !== nameNorm) return false;
                if (excelGroupNorm && normalizeMfText(m.samuhName) !== excelGroupNorm) return false;
                if (excelCenterNorm && normalizeMfText(m.centerName) !== excelCenterNorm) return false;
                return true;
              });
            }

            return undefined;
          };

          const matchedMember = findMemberByExcelRow();

          const matchedGroupFromExcel = excelGroupNorm
            ? groups.find(g => normalizeMfText(g.name) === excelGroupNorm || normalizeMfText(g.code) === excelGroupNorm)
            : undefined;
          const matchedCenterFromExcel = excelCenterNorm
            ? centers.find(c => normalizeMfText(c.name) === excelCenterNorm || normalizeMfText(c.code) === excelCenterNorm)
            : undefined;

          const name =
            matchedMember?.name ||
            nameRaw ||
            (memberIdRaw ? `Member ${memberIdRaw}` : accountNoRaw ? `Account ${accountNoRaw}` : '');

          const amount = parseExcelNumber(
            getExcelCell(row, [
              'Recurring Amount',
              'Open Amount',
              'Amount',
              'Saving Amount',
              'Savings Amount',
              'Deposit',
              'Deposit Amount',
              'Total Savings',
              'Total Saving',
              'Monthly Saving',
              'Savings',
              'Balance',
              'Amt',
              'रकम',
              'बचत रकम'
            ])
          );

          if (!name) {
            missingIdentityCount += 1;
            return;
          }
          if (amount <= 0) {
            invalidAmountCount += 1;
            return;
          }

          const dateRaw = getExcelCell(row, ['Open Date', 'Date (BS)', 'Date BS', 'Date']);
          const normalizedBs = normalizeBsDate(dateRaw || todayBs) || todayBs;
          const periodRaw = parseExcelNumber(getExcelCell(row, ['Period (Years)', 'Period Years', 'Period', 'Years', 'Tenure']));
          const periodYears = periodRaw > 0 ? periodRaw : DEFAULT_SAVING_PERIOD_YEARS;
          const maturityRaw = getExcelCell(row, ['Maturity Date (BS)', 'Maturity Date', 'Maturity']);
          const maturityDateBs = maturityRaw
            ? normalizeBsDate(maturityRaw) || calculateBsMaturityDateByYears(normalizedBs, periodYears)
            : calculateBsMaturityDateByYears(normalizedBs, periodYears);
          const statusRaw = getExcelCell(row, ['Status']).toUpperCase();
          const status: 'ACTIVE' | 'MATURED' | 'CLOSED' =
            statusRaw === 'CLOSED' || statusRaw === 'INACTIVE' || statusRaw === 'DUE' || statusRaw === 'PENDING'
              ? 'CLOSED'
              : statusRaw === 'MATURED'
              ? 'MATURED'
              : 'ACTIVE';

          items.push({
            memberId: matchedMember?.memberId || memberIdRaw || `M-${1001 + idx}`,
            accountNo: accountNoRaw || matchedMember?.savingsAccountNo || `SAV-${1001 + idx}`,
            name,
            groupName: matchedMember?.samuhName || matchedGroupFromExcel?.name || excelGroupRaw || '',
            centerName: matchedMember?.centerName || matchedGroupFromExcel?.centerName || matchedCenterFromExcel?.name || excelCenterRaw || '',
            date: todayAd,
            dateBs: normalizedBs,
            amount,
            savingType: getExcelCell(row, ['Saving Type', 'Product', 'Type']) || filteredMfSavingProducts[0]?.name || 'Normal Saving',
            status,
            periodYears,
            maturityDateBs,
            collectedBy: user?.fullName || '',
            receiptNo: '',
            remarks: '',
            createdBy: user?.id || user?.username || '',
            createdByName: user?.fullName || user?.username || ''
          });
        });

        if (items.length === 0) {
          const detectedCols = Object.keys(bulkParsedRows[0] || {}).filter(k => !k.startsWith('__EMPTY'));
          const reasons: string[] = [];
          if (missingIdentityCount > 0) reasons.push(`${missingIdentityCount} row(s) missing Name / Member ID`);
          if (invalidAmountCount > 0) reasons.push(`${invalidAmountCount} row(s) had Amount <= 0 or unreadable`);
          const colsHint = detectedCols.length > 0 ? ` Detected columns: [${detectedCols.join(', ')}].` : '';
          setBulkUploadError(
            `No valid Saving rows found (${reasons.join(', ') || 'check column headers'}). Ensure "Name" (or "Member ID") and "Amount" > 0 are provided.${colsHint}`
          );
          return;
        }
        const existingSavingsList = microFinanceService.getSavings();
        const seenSavingBatchKeys = new Set<string>();
        const filteredSavingItems = items.filter(item => {
          if (isSavingStatusClosed(item.status)) return true;
          const memKey = stripLeadingZerosId(item.memberId) || normalizeMfMemberId(item.memberId);
          const prodKey = normalizeSavingProductKey(item.savingType);
          const key = memKey && prodKey ? `${memKey}__${prodKey}` : '';
          if (
            findActiveDuplicateSaving(existingSavingsList, item.memberId, item.savingType) ||
            (key && seenSavingBatchKeys.has(key))
          ) {
            return false;
          }
          if (key) seenSavingBatchKeys.add(key);
          return true;
        });
        const skippedDuplicateSavings = items.length - filteredSavingItems.length;
        if (filteredSavingItems.length === 0) {
          setBulkUploadError(
            'Saving upload failed: Selected member(s) already have an ACTIVE saving account under the same Saving Product. Close existing active account(s) before opening a new one in the same product.'
          );
          return;
        }
        const updatedSavings = microFinanceService.bulkAddSavings(filteredSavingItems);
        setSavings(updatedSavings);
        setMembers(microFinanceService.getMembers());
        createdCount = filteredSavingItems.length;
        if (skippedDuplicateSavings > 0) {
          const uploadedFileName = bulkFileName;
          setIsBulkModalOpen(false);
          setBulkUploadSuccess({
            entityType: bulkType,
            count: createdCount,
            fileName: uploadedFileName,
            skippedCount: skippedDuplicateSavings,
            skippedMessage: `${skippedDuplicateSavings} active duplicate saving row(s) skipped: This Account Has Already Been Opened.`
          });
          showToast(
            `Data successfully uploaded: ${createdCount} saving account(s); skipped ${skippedDuplicateSavings} active duplicate product row(s).`
          );
          return;
        }
      } else if (bulkType === 'Loans') {
        const items: Omit<MFLoanRecord, 'id' | 'createdAt'>[] = [];
        bulkParsedRows.forEach((row, idx) => {
          const memberIdRaw = getExcelCell(row, ['Member ID', 'MemberId', 'Member Code']);
          const nameRaw = getExcelCell(row, ['Name', 'Member Name', 'Full Name']);
          const excelGroupRaw = getExcelCell(row, ['Group Name', 'Group', 'Samuh Name']);
          const excelCenterRaw = getExcelCell(row, ['Center Name', 'Center']);
          const excelGroupNorm = normalizeMfText(excelGroupRaw);
          const excelCenterNorm = normalizeMfText(excelCenterRaw);
          const findLoanMemberByExcelRow = () => {
            const nameNorm = normalizeMfText(nameRaw);
            const byId = memberIdRaw
              ? members.find(m => isSameMfMemberId(m.memberId, memberIdRaw))
              : undefined;

            if (byId) {
              if (nameNorm && normalizeMfText(byId.name) !== nameNorm) {
                const nameMatches = members.filter(m => {
                  if (normalizeMfText(m.name) !== nameNorm) return false;
                  const targetGroup = excelGroupNorm || normalizeMfText(byId.samuhName);
                  const targetCenter = excelCenterNorm || normalizeMfText(byId.centerName);
                  if (targetGroup && normalizeMfText(m.samuhName) !== targetGroup) return false;
                  if (targetCenter && normalizeMfText(m.centerName) !== targetCenter) return false;
                  return true;
                });
                if (nameMatches.length === 1) return nameMatches[0];
              }
              return byId;
            }

            if (nameNorm) {
              return members.find(m => {
                if (normalizeMfText(m.name) !== nameNorm) return false;
                if (excelGroupNorm && normalizeMfText(m.samuhName) !== excelGroupNorm) return false;
                if (excelCenterNorm && normalizeMfText(m.centerName) !== excelCenterNorm) return false;
                return true;
              });
            }

            return undefined;
          };

          const matchedMember = findLoanMemberByExcelRow();
          const matchedGroupFromExcel = excelGroupNorm
            ? groups.find(g => normalizeMfText(g.name) === excelGroupNorm || normalizeMfText(g.code) === excelGroupNorm)
            : undefined;
          const matchedCenterFromExcel = excelCenterNorm
            ? centers.find(c => normalizeMfText(c.name) === excelCenterNorm || normalizeMfText(c.code) === excelCenterNorm)
            : undefined;
          const name = matchedMember?.name || nameRaw || (memberIdRaw ? `Member ${memberIdRaw}` : '');
          const loanAmount = parseExcelNumber(getExcelCell(row, ['Loan Amount', 'Amount', 'Principal']));
          if (!name || loanAmount <= 0) return;

          const periodMonths = parseInt(getExcelCell(row, ['Period (Months)', 'Total Installments', 'Period', 'Months']), 10) || 12;
          const interestRate = parseExcelNumber(getExcelCell(row, ['Interest Rate (%)', 'Interest Rate', 'Rate'])) || 14;
          const loanDateRaw = getExcelCell(row, ['Loan Date (BS)', 'Open Date (BS)', 'Loan Date', 'Date']);
          const loanDateBs = normalizeBsDate(loanDateRaw || todayBs);
          const maturityDateRaw = getExcelCell(row, ['Maturity Date (BS)', 'Maturity Date']);
          const maturityDate = maturityDateRaw ? normalizeBsDate(maturityDateRaw) : calculateBsMaturityDate(loanDateBs, periodMonths);
          const installmentRaw = parseExcelNumber(getExcelCell(row, ['Installment Amount', 'Installment', 'EMI']));
          const installmentAmount = installmentRaw > 0
            ? installmentRaw
            : Math.round((loanAmount + (loanAmount * interestRate * (periodMonths / 12)) / 100) / periodMonths);
          const remainingRaw = parseExcelNumber(getExcelCell(row, ['Remaining Amount', 'Remaining', 'Balance']));
          const remainingText = getExcelCell(row, ['Remaining Amount', 'Remaining', 'Balance']);
          const statusRaw = getExcelCell(row, ['Status']).toUpperCase();
          const status: 'ACTIVE' | 'MATURED' | 'CLOSED' =
            statusRaw === 'CLOSED' ? 'CLOSED' : statusRaw === 'MATURED' ? 'MATURED' : 'ACTIVE';

          items.push({
            memberId: matchedMember?.memberId || memberIdRaw || `M-${1001 + idx}`,
            accountNo: getExcelCell(row, ['Account No', 'Loan Account No']) || `LN-${2001 + loans.length + idx}`,
            name,
            centerName: matchedMember?.centerName || matchedGroupFromExcel?.centerName || matchedCenterFromExcel?.name || excelCenterRaw || centers[0]?.name || '',
            groupName: matchedMember?.samuhName || matchedGroupFromExcel?.name || excelGroupRaw || groups[0]?.name || '',
            loanDate: todayAd,
            loanDateBs,
            loanAmount,
            remainingAmount: status === 'CLOSED' ? 0 : (remainingText !== '' && remainingRaw >= 0 ? remainingRaw : loanAmount),
            installmentAmount,
            totalInstallments: periodMonths,
            paidInstallments: parseInt(getExcelCell(row, ['Paid Installments', 'Paid']), 10) || 0,
            interestRate,
            status,
            loanProduct: getExcelCell(row, ['Loan Product', 'Product']) || filteredMfLoanProducts[0]?.name || 'General Group Loan',
            maturityDate,
            closedDate: status === 'CLOSED' ? todayAd : undefined,
            closedDateBs: status === 'CLOSED' ? normalizeBsDate(getExcelCell(row, ['Close Date (BS)', 'Closed Date']) || todayBs) : undefined,
            createdBy: user?.id || user?.username || '',
            createdByName: user?.fullName || user?.username || ''
          });
        });
        if (items.length === 0) {
          setBulkUploadError('No valid Loan rows found. Ensure "Name" (or Member ID) and "Loan Amount" > 0 are provided.');
          return;
        }
        const existingActiveLoans = microFinanceService.getLoans();
        const seenBatchKeys = new Set<string>();
        const filteredItems = items.filter(item => {
          if (item.status === 'CLOSED') return true;
          const key = `${String(item.memberId || '').trim().toLowerCase()}__${normalizeLoanProductKey(item.loanProduct)}`;
          if (findUnclosedDuplicateLoan(existingActiveLoans, item.memberId, item.loanProduct) || seenBatchKeys.has(key)) {
            return false;
          }
          seenBatchKeys.add(key);
          return true;
        });
        const skippedDuplicates = items.length - filteredItems.length;
        if (filteredItems.length === 0) {
          setBulkUploadError('Loan issue failed: Selected member(s) already have unclosed Active/Mature loan(s) under the same Loan Product. Close existing loans before issuing new ones.');
          return;
        }
        const updatedLoans = await microFinanceService.bulkAddLoans(filteredItems);
        setLoans(updatedLoans);
        setMembers(microFinanceService.getMembers());
        createdCount = filteredItems.length;
        if (skippedDuplicates > 0) {
          const uploadedFileName = bulkFileName;
          setIsBulkModalOpen(false);
          setBulkUploadSuccess({
            entityType: bulkType,
            count: createdCount,
            fileName: uploadedFileName,
            skippedCount: skippedDuplicates
          });
          showToast(`Data successfully uploaded: ${createdCount} loan(s); skipped ${skippedDuplicates} duplicate/unclosed row(s).`);
          return;
        }
      }

      const uploadedFileName = bulkFileName;
      setIsBulkModalOpen(false);
      setBulkUploadSuccess({
        entityType: bulkType,
        count: createdCount,
        fileName: uploadedFileName
      });
      showToast(`Data successfully uploaded: ${createdCount} ${bulkType} record(s) from Excel!`);
    } finally {
      setIsBulkUploading(false);
    }
  };

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Keep state in sync with service & hydrate all Micro-Finance entities from Supabase
  const reloadData = () => {
    void refreshUser().catch(() => {});
    void refreshRoles().catch(() => {});
    setCenters(microFinanceService.getCenters());
    setGroups(microFinanceService.getGroups());
    setMembers(microFinanceService.getMembers());
    setSavings(microFinanceService.getSavings());
    setLoans(microFinanceService.getLoans());
    setSheets(microFinanceService.getSheets());
    setSignatureSheets(microFinanceService.getSignatureSheets());
    setMeetingMinutes(meetingMinutesService.getMeetings());
    void microFinanceService.fetchAllFromSupabase().then(res => {
      setCenters(res.centers);
      setGroups(res.groups);
      setMembers(res.members);
      setSavings(res.savings);
      setLoans(res.loans);
      setSheets(res.sheets);
      setSignatureSheets(res.signatureSheets);
    });
    void meetingMinutesService.fetchAllFromSupabase().then(res => {
      setMeetingMinutes(res.meetings);
    });
    void microFinanceService.fetchClosedLoansFromSupabase().then(archived => {
      setClosedLoansArchive(archived);
    }).catch(() => {});
    showToast('Data refreshed successfully');
  };

  useEffect(() => {
    void microFinanceService.fetchAllFromSupabase().then(res => {
      setCenters(res.centers);
      setGroups(res.groups);
      setMembers(res.members);
      setSavings(res.savings);
      setLoans(res.loans);
      setSheets(res.sheets);
      setSignatureSheets(res.signatureSheets);
    });
    void meetingMinutesService.fetchAllFromSupabase().then(res => {
      setMeetingMinutes(res.meetings);
    });
    void microFinanceService.fetchClosedLoansFromSupabase().then(archived => {
      setClosedLoansArchive(archived);
    }).catch(() => {});
  }, []);

  const clearAllSubMenuSearchFilters = () => {
    setDashboardCenterSearch('');
    setCenterSearch('');
    setGroupSearch('');
    setMemberSearch('');
    setMemberCenterFilterId('');
    setMemberGroupFilterId('');
    setAppliedMemberCenterId('');
    setAppliedMemberGroupId('');
    setSavingSearch('');
    setSavingCenterFilterId('');
    setSavingGroupFilterId('');
    setAppliedSavingCenterId('');
    setAppliedSavingGroupId('');
    setLoanSearch('');
    setLoanCenterFilterId('');
    setLoanGroupFilterId('');
    setAppliedLoanCenterId('');
    setAppliedLoanGroupId('');
  };

  const handleSelectSubMenuTab = (tab: SubMenuTab) => {
    clearAllSubMenuSearchFilters();
    setActiveTab(tab);
  };

  useEffect(() => {
    clearAllSubMenuSearchFilters();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      setMeetingMinutes(meetingMinutesService.getMeetings());
    } else if (
      activeTab === 'reports' ||
      activeTab === 'saving' ||
      activeTab === 'loan' ||
      activeTab === 'members'
    ) {
      void microFinanceService.fetchAllFromSupabase().then(res => {
        setCenters(res.centers);
        setGroups(res.groups);
        setMembers(res.members);
        setSavings(res.savings);
        setLoans(res.loans);
        setSheets(res.sheets);
        setSignatureSheets(res.signatureSheets);
      });
      if (activeTab === 'reports') {
        void meetingMinutesService.fetchAllFromSupabase().then(res => {
          setMeetingMinutes(res.meetings);
        });
      }
    }
  }, [activeTab, reportTab]);

  // Month list strictly in English (NO NEPALI)
  const nepaliMonthsEnglish = [
    'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
  ];

  const sortedCentersByMeetingDay = useMemo(() => {
    return [...centers].sort((a, b) => {
      const dayA = extractMeetingDayNumber(a.meetingDay) ?? extractMeetingDayNumber(a.name) ?? Number.MAX_SAFE_INTEGER;
      const dayB = extractMeetingDayNumber(b.meetingDay) ?? extractMeetingDayNumber(b.name) ?? Number.MAX_SAFE_INTEGER;
      if (dayA !== dayB) return dayA - dayB;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [centers]);

  // Deduplicated full loan account list (Active + Matured + Archived Closed) for accurate operational counts
  const allLoanAccountsForCounts = useMemo(() => {
    const byId = new Map<string, MFLoanRecord>();
    loans.forEach(l => byId.set(l.id, l));
    closedLoansArchive.forEach(l => {
      if (!byId.has(l.id)) byId.set(l.id, l);
    });
    return Array.from(byId.values());
  }, [loans, closedLoansArchive]);

  // All-Menu Operational Dashboard Aggregates (Strictly counts & statuses — NO Saving Balance or Loan Portfolio amounts)
  const dashboardStats = useMemo(() => {
    const todayBsDayNum = parseInt(currentBsDate.day, 10) || 0;
    const totalCenters = centers.length;
    const activeCenters = centers.filter(c => String(c.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const inactiveCenters = totalCenters - activeCenters;
    const todayMeetingCentersCount = centers.filter(c => {
      const d = extractMeetingDayNumber(c.meetingDay) ?? extractMeetingDayNumber(c.name);
      return d !== null && d === todayBsDayNum;
    }).length;

    const totalGroups = groups.length;
    const activeSamuhs = groups.filter(g => String(g.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const inactiveSamuhs = totalGroups - activeSamuhs;

    const totalMembers = members.length;
    const activeMembers = members.filter(m => getEffectiveMemberStatus(m.status) === 'ACTIVE').length;
    const inactiveMembers = totalMembers - activeMembers;
    const membersWithPhotoCount = members.filter(m => Boolean(m.photoUrl && m.photoUrl.trim())).length;

    const totalSavingAccounts = savings.length;
    let activeSavingAccounts = 0;
    let maturedSavingAccounts = 0;
    let closedSavingAccounts = 0;
    savings.forEach(s => {
      const eff = getEffectiveSavingStatus(s);
      if (eff === 'CLOSED') closedSavingAccounts += 1;
      else if (eff === 'MATURED') maturedSavingAccounts += 1;
      else activeSavingAccounts += 1;
    });

    let activeLoansCount = 0;
    let maturedLoansCount = 0;
    let closedLoansCount = 0;
    allLoanAccountsForCounts.forEach(l => {
      const eff = getEffectiveLoanStatus(l);
      if (eff === 'CLOSED') closedLoansCount += 1;
      else if (eff === 'MATURED') maturedLoansCount += 1;
      else activeLoansCount += 1;
    });
    const totalLoanAccounts = activeLoansCount + maturedLoansCount + closedLoansCount;

    const collectionSheetsCount = sheets.length;
    const signatureSheetsCount = signatureSheets.length;
    const meetingMinutesCount = meetingMinutes.length;
    const idCardReadyCount = activeMembers;
    const totalReportsCount = collectionSheetsCount + signatureSheetsCount + meetingMinutesCount;

    return {
      totalCenters,
      activeCenters,
      inactiveCenters,
      todayMeetingCentersCount,
      totalGroups,
      activeSamuhs,
      inactiveSamuhs,
      totalMembers,
      activeMembers,
      inactiveMembers,
      membersWithPhotoCount,
      totalSavingAccounts,
      activeSavingAccounts,
      maturedSavingAccounts,
      closedSavingAccounts,
      totalLoanAccounts,
      activeLoansCount,
      maturedLoansCount,
      closedLoansCount,
      collectionSheetsCount,
      signatureSheetsCount,
      meetingMinutesCount,
      idCardReadyCount,
      totalReportsCount
    };
  }, [centers, groups, members, savings, allLoanAccountsForCounts, sheets, signatureSheets, meetingMinutes, currentBsDate.day]);

  // Live Center-wise operational breakdown (ordered ascending by Meeting Day — counts only, NO monetary amounts)
  const centerAnalytics = useMemo(() => {
    const todayBsDayNum = parseInt(currentBsDate.day, 10) || 0;
    const memberByIdMap = new Map<string, MFMember>();
    members.forEach(m => {
      const normId = normalizeMfMemberId(m.memberId);
      if (normId && !memberByIdMap.has(normId)) memberByIdMap.set(normId, m);
    });

    return sortedCentersByMeetingDay.map(c => {
      const normCenterName = normalizeMfText(c.name);
      const centerGroups = groups.filter(
        g => g.centerId === c.id || (normCenterName !== '' && normalizeMfText(g.centerName) === normCenterName)
      );
      const centerGroupNames = new Set(centerGroups.map(g => normalizeMfText(g.name)).filter(Boolean));
      const centerMembers = members.filter(
        m =>
          m.centerId === c.id ||
          (normCenterName !== '' && normalizeMfText(m.centerName) === normCenterName) ||
          (m.samuhName && centerGroupNames.has(normalizeMfText(m.samuhName)))
      );
      const activeMembersCount = centerMembers.filter(m => getEffectiveMemberStatus(m.status) === 'ACTIVE').length;
      const inactiveMembersCount = centerMembers.length - activeMembersCount;

      const centerSavings = savings.filter(s => {
        const linked = memberByIdMap.get(normalizeMfMemberId(s.memberId));
        const matchMember = Boolean(
          linked &&
            (linked.centerId === c.id ||
              (normCenterName !== '' && normalizeMfText(linked.centerName) === normCenterName))
        );
        const matchDirect =
          (normCenterName !== '' && normalizeMfText(s.centerName) === normCenterName) ||
          Boolean(s.groupName && centerGroupNames.has(normalizeMfText(s.groupName)));
        return matchMember || matchDirect;
      });
      const activeSavingsCount = centerSavings.filter(s => getEffectiveSavingStatus(s) !== 'CLOSED').length;
      const closedSavingsCount = centerSavings.length - activeSavingsCount;

      const centerLoans = allLoanAccountsForCounts.filter(l => {
        const linked = memberByIdMap.get(normalizeMfMemberId(l.memberId));
        const matchMember = Boolean(
          linked &&
            (linked.centerId === c.id ||
              (normCenterName !== '' && normalizeMfText(linked.centerName) === normCenterName))
        );
        const matchDirect =
          (normCenterName !== '' && normalizeMfText(l.centerName) === normCenterName) ||
          Boolean(l.groupName && centerGroupNames.has(normalizeMfText(l.groupName)));
        return matchMember || matchDirect;
      });
      let activeLoansCount = 0;
      let maturedLoansCount = 0;
      let closedLoansCount = 0;
      centerLoans.forEach(l => {
        const eff = getEffectiveLoanStatus(l);
        if (eff === 'CLOSED') closedLoansCount += 1;
        else if (eff === 'MATURED') maturedLoansCount += 1;
        else activeLoansCount += 1;
      });

      const meetingDayNum = extractMeetingDayNumber(c.meetingDay) ?? extractMeetingDayNumber(c.name);

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        shortName: c.code || c.name.split('(')[0].trim().slice(0, 14),
        branch: c.branch,
        meetingDay: c.meetingDay,
        meetingDayNum,
        isMeetingToday: meetingDayNum !== null && meetingDayNum === todayBsDayNum,
        fieldOfficer: c.fieldOfficer || 'Unassigned',
        status: c.status,
        groupsCount: centerGroups.length,
        membersCount: centerMembers.length,
        activeMembersCount,
        inactiveMembersCount,
        activeSavingsCount,
        closedSavingsCount,
        activeLoansCount,
        maturedLoansCount,
        closedLoansCount,
        openLoansCount: activeLoansCount + maturedLoansCount
      };
    });
  }, [sortedCentersByMeetingDay, groups, members, savings, allLoanAccountsForCounts, currentBsDate.day]);

  const filteredDashboardCenters = useMemo(() => {
    const q = dashboardCenterSearch.trim().toLowerCase();
    if (!q) return centerAnalytics;
    return centerAnalytics.filter(
      row =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.meetingDay.toLowerCase().includes(q) ||
        row.branch.toLowerCase().includes(q)
    );
  }, [centerAnalytics, dashboardCenterSearch]);

  const upcomingMeetingCenters = useMemo(() => {
    const todayBsDayNum = parseInt(currentBsDate.day, 10) || 1;
    const withDays = centerAnalytics.filter(c => c.meetingDayNum !== null);
    if (withDays.length === 0) return centerAnalytics.slice(0, 4);
    const ranked = [...withDays].sort((a, b) => {
      const da = ((a.meetingDayNum || 0) - todayBsDayNum + 32) % 32;
      const db = ((b.meetingDayNum || 0) - todayBsDayNum + 32) % 32;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });
    return ranked.slice(0, 4);
  }, [centerAnalytics, currentBsDate.day]);

  const recentGeneratedSheets = useMemo(() => {
    const combined = [
      ...sheets.map(s => ({
        id: `col-${s.id}`,
        kind: 'Collection' as const,
        groupName: s.groupName || s.centerName || 'Collection Sheet',
        centerName: s.centerName || '',
        dateLabel: s.dateDisplay || `${s.year} ${s.month} ${s.day}`.trim(),
        memberCount: s.memberCount || 0,
        createdAt: s.createdAt || ''
      })),
      ...signatureSheets.map(s => ({
        id: `sig-${s.id}`,
        kind: 'Signature' as const,
        groupName: s.groupName || s.centerName || 'Signature Sheet',
        centerName: s.centerName || '',
        dateLabel: s.dateBs || '',
        memberCount: s.totalMembers || s.members?.length || 0,
        createdAt: s.createdAt || ''
      }))
    ];
    return combined
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 5);
  }, [sheets, signatureSheets]);

  // Live Loan Accounts Status Breakdown for Donut Chart (Counts only, NO NPR amounts)
  const loanStatusChartData = useMemo(() => {
    const items = [
      { name: 'Active', value: dashboardStats.activeLoansCount, color: '#00593B' },
      { name: 'Matured', value: dashboardStats.maturedLoansCount, color: '#D97706' },
      { name: 'Closed', value: dashboardStats.closedLoansCount, color: '#64748B' }
    ].filter(item => item.value > 0);
    return items.length > 0 ? items : [{ name: 'No Loan Accounts', value: 1, color: '#E2E8F0' }];
  }, [dashboardStats.activeLoansCount, dashboardStats.maturedLoansCount, dashboardStats.closedLoansCount]);

  // Filtered Centers
  const filteredCenters = useMemo(() => {
    return sortedCentersByMeetingDay.filter(c => 
      c.name.toLowerCase().includes(centerSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(centerSearch.toLowerCase()) ||
      c.location.toLowerCase().includes(centerSearch.toLowerCase())
    );
  }, [sortedCentersByMeetingDay, centerSearch]);

  // Filtered Groups (sorted ascending by Center meeting date set during Center creation)
  const filteredGroups = useMemo(() => {
    const centerById = new Map<string, MFCenter>();
    const centerByName = new Map<string, MFCenter>();
    centers.forEach(c => {
      if (c.id) centerById.set(c.id, c);
      const normName = normalizeMfText(c.name);
      if (normName && !centerByName.has(normName)) centerByName.set(normName, c);
    });

    const getGroupCenterSortKey = (g: MFSamuhGroup) => {
      const parentCenter =
        (g.centerId ? centerById.get(g.centerId) : undefined) ||
        centerByName.get(normalizeMfText(g.centerName));
      const day =
        extractMeetingDayNumber(parentCenter?.meetingDay) ??
        extractMeetingDayNumber(g.meetingDay) ??
        extractMeetingDayNumber(parentCenter?.name || g.centerName) ??
        Number.MAX_SAFE_INTEGER;
      const centerName = parentCenter?.name || g.centerName || '';
      return { day, centerName };
    };

    const q = groupSearch.toLowerCase();
    return groups
      .filter(
        g =>
          g.name.toLowerCase().includes(q) ||
          g.code.toLowerCase().includes(q) ||
          g.centerName.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const keyA = getGroupCenterSortKey(a);
        const keyB = getGroupCenterSortKey(b);
        if (keyA.day !== keyB.day) return keyA.day - keyB.day;
        const centerCmp = keyA.centerName.localeCompare(keyB.centerName);
        if (centerCmp !== 0) return centerCmp;
        const codeCmp = String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true });
        if (codeCmp !== 0) return codeCmp;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
  }, [groups, centers, groupSearch]);

  const memberLookupById = useMemo(() => {
    const exact = new Map<string, MFMember>();
    const stripped = new Map<string, MFMember>();
    const byAccount = new Map<string, MFMember>();
    members.forEach(m => {
      const key = normalizeMfMemberId(m.memberId);
      if (key && !exact.has(key)) exact.set(key, m);
      const strippedKey = stripLeadingZerosId(m.memberId);
      if (strippedKey && !stripped.has(strippedKey)) stripped.set(strippedKey, m);
      const accKey = normalizeMfMemberId(m.savingsAccountNo);
      if (accKey && !byAccount.has(accKey)) byAccount.set(accKey, m);
    });
    const find = (memberId?: string, accountNo?: string): MFMember | undefined => {
      const exactKey = normalizeMfMemberId(memberId);
      if (exactKey) {
        const exactHit = exact.get(exactKey);
        if (exactHit) return exactHit;
        const strippedKey = stripLeadingZerosId(exactKey);
        if (strippedKey) {
          const strippedHit = stripped.get(strippedKey);
          if (strippedHit) return strippedHit;
        }
      }
      const accKey = normalizeMfMemberId(accountNo);
      if (accKey) {
        return byAccount.get(accKey);
      }
      return undefined;
    };
    return { exact, stripped, byAccount, find };
  }, [members]);

  const getGroupsForCenterFilter = (centerId: string) => {
    if (!centerId) return groups;
    const selectedCenter = centers.find(c => c.id === centerId);
    const centerNameNorm = normalizeMfText(selectedCenter?.name);
    return groups.filter(
      g => g.centerId === centerId || (centerNameNorm !== '' && normalizeMfText(g.centerName) === centerNameNorm)
    );
  };


  // Filtered Members (before Active/Inactive split, for live tab counts)
  const baseFilteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase();
    const selCenter = appliedMemberCenterId ? centers.find(c => c.id === appliedMemberCenterId) : undefined;
    const selGroup = appliedMemberGroupId ? groups.find(g => g.id === appliedMemberGroupId) : undefined;
    const selCenterNorm = normalizeMfText(selCenter?.name);
    const selGroupNorm = normalizeMfText(selGroup?.name);

    return members.filter(m => {
      if (appliedMemberCenterId) {
        const mCenterNorm = normalizeMfText(m.centerName);
        const matchCenter =
          m.centerId === appliedMemberCenterId ||
          (selCenterNorm !== '' && mCenterNorm === selCenterNorm);
        if (!matchCenter) return false;
      }
      if (appliedMemberGroupId) {
        const mGroupNorm = normalizeMfText(m.samuhName);
        const matchGroup =
          m.samuhId === appliedMemberGroupId ||
          (selGroupNorm !== '' && mGroupNorm === selGroupNorm);
        if (!matchGroup) return false;
      }
      return (
        m.name.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        m.samuhName.toLowerCase().includes(q) ||
        m.citizenshipNo.toLowerCase().includes(q)
      );
    });
  }, [members, centers, groups, memberSearch, appliedMemberCenterId, appliedMemberGroupId]);

  const memberStatusCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    baseFilteredMembers.forEach(m => {
      if (getEffectiveMemberStatus(m.status) === 'INACTIVE') inactive += 1;
      else active += 1;
    });
    return { active, inactive };
  }, [baseFilteredMembers]);

  // Filtered Members by Active / Inactive tab
  const filteredMembers = useMemo(() => {
    return baseFilteredMembers.filter(m => getEffectiveMemberStatus(m.status) === memberStatusTab);
  }, [baseFilteredMembers, memberStatusTab]);

  // Base Filtered Savings (search + center + group, used for Active / Close counts)
  const baseFilteredSavings = useMemo(() => {
    const selCenter = appliedSavingCenterId ? centers.find(c => c.id === appliedSavingCenterId) : undefined;
    const selGroup = appliedSavingGroupId ? groups.find(g => g.id === appliedSavingGroupId) : undefined;
    const selCenterNorm = normalizeMfText(selCenter?.name);
    const selGroupNorm = normalizeMfText(selGroup?.name);
    const centerGroupNames = appliedSavingCenterId
      ? new Set(
          groups
            .filter(
              g =>
                g.centerId === appliedSavingCenterId ||
                (selCenterNorm !== '' && normalizeMfText(g.centerName) === selCenterNorm)
            )
            .map(g => normalizeMfText(g.name))
            .filter(Boolean)
        )
      : null;

    const searchQ = savingSearch.trim().toLowerCase();
    const searchStripped = stripLeadingZerosId(savingSearch);

    return savings.filter(s => {
      const linkedMember = memberLookupById.find(s.memberId, s.accountNo);
      const recCenterNorm = normalizeMfText(s.centerName);
      const recGroupNorm = normalizeMfText(s.groupName);

      if (appliedSavingCenterId) {
        const memberMatchesCenter = Boolean(
          linkedMember &&
            (linkedMember.centerId === appliedSavingCenterId ||
              (selCenterNorm !== '' && normalizeMfText(linkedMember.centerName) === selCenterNorm))
        );
        const recordMatchesCenter =
          (selCenterNorm !== '' && recCenterNorm === selCenterNorm) ||
          Boolean(centerGroupNames && recGroupNorm && centerGroupNames.has(recGroupNorm));
        if (!memberMatchesCenter && !recordMatchesCenter) return false;
      }

      if (appliedSavingGroupId) {
        const memberMatchesGroup = Boolean(
          linkedMember &&
            (linkedMember.samuhId === appliedSavingGroupId ||
              (selGroupNorm !== '' && normalizeMfText(linkedMember.samuhName) === selGroupNorm))
        );
        const recordMatchesGroup = selGroupNorm !== '' && recGroupNorm === selGroupNorm;
        if (!memberMatchesGroup && !recordMatchesGroup) return false;
      }

      const matchSearch =
        !searchQ ||
        s.name.toLowerCase().includes(searchQ) ||
        s.memberId.toLowerCase().includes(searchQ) ||
        (searchStripped !== '' && stripLeadingZerosId(s.memberId).includes(searchStripped)) ||
        s.accountNo.toLowerCase().includes(searchQ) ||
        (s.groupName || '').toLowerCase().includes(searchQ) ||
        (linkedMember?.samuhName || '').toLowerCase().includes(searchQ);
      return matchSearch;
    });
  }, [savings, centers, groups, memberLookupById, savingSearch, appliedSavingCenterId, appliedSavingGroupId]);

  const savingStatusCounts = useMemo(() => {
    let active = 0;
    let matured = 0;
    let closed = 0;
    baseFilteredSavings.forEach(s => {
      const eff = getEffectiveSavingStatus(s);
      if (eff === 'CLOSED') closed += 1;
      else if (eff === 'MATURED') matured += 1;
      else active += 1;
    });
    return { active, matured, closed };
  }, [baseFilteredSavings]);

  // Filtered Savings by Active / Mature / Close tab
  const filteredSavings = useMemo(() => {
    return baseFilteredSavings.filter(s => getEffectiveSavingStatus(s) === savingStatusTab);
  }, [baseFilteredSavings, savingStatusTab]);


  const conflictingUnclosedLoan = useMemo(() => {
    return findUnclosedDuplicateLoan(loans, loanForm.memberId, loanForm.loanProduct);
  }, [loans, loanForm.memberId, loanForm.loanProduct]);

  // Filtered Loans: Active & Mature read from lightweight active state; Close loads on-demand from Supabase
  const filteredLoans = useMemo(() => {
    const query = loanSearch.trim().toLowerCase();
    const queryStripped = stripLeadingZerosId(loanSearch);
    const sourceList = loanStatusTab === 'CLOSED' ? closedLoansArchive : loans;
    const selCenter = appliedLoanCenterId ? centers.find(c => c.id === appliedLoanCenterId) : undefined;
    const selGroup = appliedLoanGroupId ? groups.find(g => g.id === appliedLoanGroupId) : undefined;
    const selCenterNorm = normalizeMfText(selCenter?.name);
    const selGroupNorm = normalizeMfText(selGroup?.name);
    const centerGroupNames = appliedLoanCenterId
      ? new Set(
          groups
            .filter(
              g =>
                g.centerId === appliedLoanCenterId ||
                (selCenterNorm !== '' && normalizeMfText(g.centerName) === selCenterNorm)
            )
            .map(g => normalizeMfText(g.name))
            .filter(Boolean)
        )
      : null;

    return sourceList.filter(l => {
      const effStatus = getEffectiveLoanStatus(l);
      if (effStatus !== loanStatusTab) return false;
      const linkedMember = memberLookupById.find(l.memberId);
      const recCenterNorm = normalizeMfText(l.centerName);
      const recGroupNorm = normalizeMfText(l.groupName);

      if (appliedLoanCenterId) {
        const memberMatchesCenter = Boolean(
          linkedMember &&
            (linkedMember.centerId === appliedLoanCenterId ||
              (selCenterNorm !== '' && normalizeMfText(linkedMember.centerName) === selCenterNorm))
        );
        const recordMatchesCenter =
          (selCenterNorm !== '' && recCenterNorm === selCenterNorm) ||
          Boolean(centerGroupNames && recGroupNorm && centerGroupNames.has(recGroupNorm));
        if (!memberMatchesCenter && !recordMatchesCenter) return false;
      }

      if (appliedLoanGroupId) {
        const memberMatchesGroup = Boolean(
          linkedMember &&
            (linkedMember.samuhId === appliedLoanGroupId ||
              (selGroupNorm !== '' && normalizeMfText(linkedMember.samuhName) === selGroupNorm))
        );
        const recordMatchesGroup = selGroupNorm !== '' && recGroupNorm === selGroupNorm;
        if (!memberMatchesGroup && !recordMatchesGroup) return false;
      }

      return (
        !query ||
        l.name.toLowerCase().includes(query) ||
        l.memberId.toLowerCase().includes(query) ||
        (queryStripped !== '' && stripLeadingZerosId(l.memberId).includes(queryStripped)) ||
        l.accountNo.toLowerCase().includes(query)
      );
    });
  }, [loans, closedLoansArchive, centers, groups, memberLookupById, loanSearch, loanStatusTab, appliedLoanCenterId, appliedLoanGroupId]);

  const exportRowsToExcel = (rows: Record<string, string | number>[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const keys = Object.keys(rows[0] || {});
    ws['!cols'] = keys.map(key => {
      const maxLen = rows.reduce((max, row) => Math.max(max, String(row[key] ?? '').length), key.length);
      return { wch: Math.min(Math.max(maxLen + 3, 10), 40) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, fileName);
  };

  const handleExportMembersExcel = () => {
    if (filteredMembers.length === 0) {
      showToast('No Members data available to download.');
      return;
    }
    const rows = filteredMembers.map((m, idx) => ({
      'S.N.': idx + 1,
      'Member ID': String(m.memberId || ''),
      'Member Name': String(m.name || ''),
      'Branch': String(m.branch || ''),
      'Center': String(m.centerName || ''),
      'Group': String(m.samuhName || ''),
      'Role': String(m.role || 'Member'),
      'Citizenship No': String(m.citizenshipNo || ''),
      'Mobile': String(m.mobile || ''),
      'Savings Account No': String(m.savingsAccountNo || ''),
      'Status': String(m.status || 'ACTIVE')
    }));
    exportRowsToExcel(rows, 'Members', `MF_Members_${getTodayBsDate()}.xlsx`);
    showToast(`Downloaded ${rows.length} Member record(s) to Excel.`);
  };

  const handleExportSavingsExcel = () => {
    if (filteredSavings.length === 0) {
      showToast('No Savings data available to download.');
      return;
    }
    const rows = filteredSavings.map((item, idx) => {
      const linked = memberLookupById.find(item.memberId, item.accountNo);
      return {
        'S.N.': idx + 1,
        'Member ID': String(item.memberId || ''),
        'Account No': String(item.accountNo || ''),
        'Name': String(item.name || ''),
        'Center': String(item.centerName || linked?.centerName || ''),
        'Group': String(item.groupName || linked?.samuhName || ''),
        'Saving Type': String(item.savingType || ''),
        'Open Date': String(resolveSavingOpenDateBs(item) || item.date || ''),
        'Period (Years)': resolveSavingPeriodYears(item),
        'Maturity Date (BS)': String(resolveSavingMaturityDateBs(item) || ''),
        'Recurring Amount': Number(item.amount) || 0,
        'Status': getEffectiveSavingStatus(item)
      };
    });
    exportRowsToExcel(rows, 'Savings', `MF_Savings_${getTodayBsDate()}.xlsx`);
    showToast(`Downloaded ${rows.length} Saving record(s) to Excel.`);
  };

  const handleExportLoansExcel = () => {
    if (filteredLoans.length === 0) {
      showToast('No Loan data available to download.');
      return;
    }
    const rows = filteredLoans.map((l, idx) => {
      const linked = memberLookupById.find(l.memberId);
      const baseRow: Record<string, string | number> = {
        'S.N.': idx + 1,
        'Member ID': String(l.memberId || ''),
        'Account No': String(l.accountNo || ''),
        'Name': String(l.name || ''),
        'Center': String(l.centerName || linked?.centerName || ''),
        'Group': String(l.groupName || linked?.samuhName || ''),
        'Loan Product': String(l.loanProduct || ''),
        'Loan Date': String(normalizeBsDate(l.loanDateBs || l.loanDate) || ''),
        'Maturity Date': String(normalizeBsDate(l.maturityDate) || ''),
        'Loan Amount': Number(l.loanAmount) || 0,
        'Period (Months)': Number(l.totalInstallments) || 0,
        'Installment': Number(l.installmentAmount) || 0,
        'Interest Rate (%)': Number(l.interestRate) || 0,
        'Status': getEffectiveLoanStatus(l)
      };
      if (loanStatusTab === 'CLOSED') {
        baseRow['Close Date'] = String(normalizeBsDate(l.closedDateBs || l.closedDate) || '');
      }
      return baseRow;
    });
    exportRowsToExcel(rows, `Loans_${loanStatusTab}`, `MF_Loans_${loanStatusTab}_${getTodayBsDate()}.xlsx`);
    showToast(`Downloaded ${rows.length} Loan record(s) to Excel.`);
  };

  // Handlers for Center
  const handleOpenAddCenter = () => {
    if (!canEditCenters) {
      showToast('Permission denied: You do not have permission to add centers.');
      return;
    }
    setEditingCenter(null);
    const activeScopedBranch =
      canSwitchBranchView && superAdminBranchFilter !== 'ALL'
        ? findMatchingBranch(superAdminBranchFilter, availableBranches)?.name || defaultBranchName
        : defaultBranchName;
    setCenterForm({
      code: `C-00${centers.length + 1}`,
      name: '',
      location: '',
      branch: activeScopedBranch,
      meetingDay: 'Day 15th',
      status: 'ACTIVE',
      fieldOfficer: 'Ramesh Sharma',
      contactNo: ''
    });
    setIsCenterModalOpen(true);
  };

  const handleEditCenter = (center: MFCenter) => {
    if (!canEditCenters) {
      showToast('Permission denied: You do not have permission to edit centers.');
      return;
    }
    setEditingCenter(center);
    setCenterForm({
      code: center.code,
      name: center.name,
      location: center.location,
      branch: !canSwitchBranchView ? defaultBranchName : center.branch,
      meetingDay: center.meetingDay,
      status: center.status,
      fieldOfficer: center.fieldOfficer || 'Ramesh Sharma',
      contactNo: center.contactNo || ''
    });
    setIsCenterModalOpen(true);
  };

  const handleSaveCenter = () => {
    if (!canEditCenters) {
      showToast('Permission denied: You do not have permission to save centers.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!centerForm.name) {
      alert('Please enter center name');
      return;
    }
    const payload = {
      ...centerForm,
      branch: !canSwitchBranchView ? defaultBranchName : (centerForm.branch || defaultBranchName)
    };
    if (editingCenter) {
      microFinanceService.updateCenter(editingCenter.id, payload);
      showToast('Center updated successfully');
    } else {
      microFinanceService.addCenter(payload);
      showToast('New center added successfully');
    }
    setCenters(microFinanceService.getCenters());
    setIsCenterModalOpen(false);
  };

  const getMemberAccountBlockInfo = (member: MFMember) => {
    const targetMemberKey = normalizeDuplicateMemberId(member.memberId);
    const targetSavingAccKey = normalizeDuplicateMemberId(member.savingsAccountNo);

    const savingsMap = new Map<string, MFSavingsRecord>();
    [...savings, ...microFinanceService.getSavings()].forEach(s => {
      if (s && s.id) savingsMap.set(s.id, s);
    });
    const allMemberSavings = Array.from(savingsMap.values()).filter(s => {
      const sMemKey = normalizeDuplicateMemberId(s.memberId);
      const sAccKey = normalizeDuplicateMemberId(s.accountNo);
      if (targetMemberKey && sMemKey && sMemKey === targetMemberKey) return true;
      if (targetSavingAccKey && sAccKey && sAccKey === targetSavingAccKey) return true;
      return false;
    });
    const openSavings = allMemberSavings.filter(s => !isSavingStatusClosed(s.status));

    const loansMap = new Map<string, MFLoanRecord>();
    [...loans, ...closedLoansArchive, ...microFinanceService.getLoans()].forEach(l => {
      if (l && l.id) loansMap.set(l.id, l);
    });
    const allMemberLoans = Array.from(loansMap.values()).filter(l => {
      const lMemKey = normalizeDuplicateMemberId(l.memberId);
      return Boolean(targetMemberKey && lMemKey && lMemKey === targetMemberKey);
    });
    const openLoans = allMemberLoans.filter(l => getEffectiveLoanStatus(l) !== 'CLOSED');

    return { allMemberSavings, openSavings, allMemberLoans, openLoans };
  };

  const getCenterLinkedBlockInfo = (center: MFCenter) => {
    const centerNameNorm = normalizeMfText(center.name);
    const allGroups = [...groups, ...microFinanceService.getGroups()].filter(
      (g, idx, arr) => arr.findIndex(x => x.id === g.id) === idx
    );
    const linkedGroups = allGroups.filter(
      g =>
        (g.centerId && g.centerId === center.id) ||
        (centerNameNorm && normalizeMfText(g.centerName) === centerNameNorm)
    );
    const allMembers = [...members, ...microFinanceService.getMembers()].filter(
      (m, idx, arr) => arr.findIndex(x => x.id === m.id) === idx
    );
    const linkedMembers = allMembers.filter(
      m =>
        (m.centerId && m.centerId === center.id) ||
        (centerNameNorm && normalizeMfText(m.centerName) === centerNameNorm)
    );
    return { linkedGroups, linkedMembers };
  };

  const getGroupLinkedBlockInfo = (group: MFSamuhGroup) => {
    const groupNameNorm = normalizeMfText(group.name);
    const centerNameNorm = normalizeMfText(group.centerName);
    const allMembers = [...members, ...microFinanceService.getMembers()].filter(
      (m, idx, arr) => arr.findIndex(x => x.id === m.id) === idx
    );
    const linkedMembers = allMembers.filter(m => {
      if (m.samuhId && group.id && m.samuhId === group.id) return true;
      if (groupNameNorm && normalizeMfText(m.samuhName) === groupNameNorm) {
        if (centerNameNorm && m.centerName && normalizeMfText(m.centerName) !== centerNameNorm) {
          return false;
        }
        return true;
      }
      return false;
    });
    return { linkedMembers };
  };

  const handleDeleteCenter = (id: string) => {
    if (!canDeleteCenters) {
      showToast('Permission denied: You do not have permission to delete centers.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const target = centers.find(c => c.id === id);
    if (!target) return;

    const { linkedGroups, linkedMembers } = getCenterLinkedBlockInfo(target);
    if (linkedGroups.length > 0 || linkedMembers.length > 0) {
      setActionBlockNotice({
        title: 'Center Delete Garna Mildaina',
        subtitle: `${target.name} (${target.code})`,
        message:
          'Yes center bhitra group wa member raheko chha. Pahila linked group ra member haru hataunu/transfer garnu parcha.',
        items: [
          ...linkedGroups.slice(0, 6).map(g => ({
            label: `${g.code} — ${g.name}`,
            detail: `${g.membersCount || 0} Member(s)`,
            status: g.status || 'ACTIVE',
            kind: 'group' as const
          })),
          ...(linkedGroups.length === 0
            ? linkedMembers.slice(0, 6).map(m => ({
                label: `${m.memberId} — ${m.name}`,
                detail: m.samuhName || 'Member',
                status: getEffectiveMemberStatus(m.status),
                kind: 'member' as const
              }))
            : [])
        ],
        hint: `Total Linked: ${linkedGroups.length} Group(s), ${linkedMembers.length} Member(s).`
      });
      return;
    }

    setSelectedCenterToDelete(target);
    setIsDeleteCenterModalOpen(true);
  };

  const handleConfirmDeleteCenter = () => {
    if (!selectedCenterToDelete) return;
    if (!canDeleteCenters) {
      showToast('Permission denied: You do not have permission to delete centers.');
      setIsDeleteCenterModalOpen(false);
      setSelectedCenterToDelete(null);
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const { linkedGroups, linkedMembers } = getCenterLinkedBlockInfo(selectedCenterToDelete);
    if (linkedGroups.length > 0 || linkedMembers.length > 0) {
      setIsDeleteCenterModalOpen(false);
      setSelectedCenterToDelete(null);
      showToast('Cannot delete center while groups or members are still linked to it.');
      return;
    }
    const updated = microFinanceService.deleteCenter(selectedCenterToDelete.id);
    setCenters(updated);
    setIsDeleteCenterModalOpen(false);
    setSelectedCenterToDelete(null);
    showToast('Center deleted');
  };

  // Handlers for Group
  const handleOpenAddGroup = () => {
    if (!canEditGroups) {
      showToast('Permission denied: You do not have permission to add groups.');
      return;
    }
    setEditingGroup(null);
    setGroupForm({
      code: `G-00${groups.length + 1}`,
      name: '',
      centerId: centers[0]?.id || '',
      place: '',
      meetingDay: 'Day 15th',
      status: 'ACTIVE',
      leaderName: '',
      leaderMobile: ''
    });
    setIsGroupModalOpen(true);
  };

  const handleEditGroup = (group: MFSamuhGroup) => {
    if (!canEditGroups) {
      showToast('Permission denied: You do not have permission to edit groups.');
      return;
    }
    setEditingGroup(group);
    setGroupForm({
      code: group.code,
      name: group.name,
      centerId: group.centerId,
      place: group.place,
      meetingDay: group.meetingDay,
      status: group.status,
      leaderName: group.leaderName || '',
      leaderMobile: group.leaderMobile || ''
    });
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = () => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!groupForm.name) {
      alert('Please enter group name');
      return;
    }
    const chosenCenter = centers.find(c => c.id === groupForm.centerId);
    const centerName = chosenCenter ? chosenCenter.name : 'N/A';

    if (editingGroup) {
      microFinanceService.updateGroup(editingGroup.id, {
        ...groupForm,
        centerName
      });
      showToast('Group updated successfully');
    } else {
      microFinanceService.addGroup({
        ...groupForm,
        centerName,
        membersCount: 0
      });
      showToast('New group added successfully');
    }
    setGroups(microFinanceService.getGroups());
    setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = (id: string) => {
    if (!canDeleteGroups) {
      showToast('Permission denied: You do not have permission to delete groups.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const target = groups.find(g => g.id === id);
    if (!target) return;

    const { linkedMembers } = getGroupLinkedBlockInfo(target);
    if (linkedMembers.length > 0) {
      setActionBlockNotice({
        title: 'Group Delete Garna Mildaina',
        subtitle: `${target.name} (${target.code})`,
        message:
          'Yes group bhitra sadasya (members) raheko chhan. Pahila sabai linked members hataunu/transfer garnu parcha.',
        items: linkedMembers.slice(0, 6).map(m => ({
          label: `${m.memberId} — ${m.name}`,
          detail: m.role || 'Member',
          status: getEffectiveMemberStatus(m.status),
          kind: 'member' as const
        })),
        hint: `Total Linked Members: ${linkedMembers.length}`
      });
      return;
    }

    setSelectedGroupToDelete(target);
    setIsDeleteGroupModalOpen(true);
  };

  const handleConfirmDeleteGroup = () => {
    if (!selectedGroupToDelete) return;
    if (!canDeleteGroups) {
      showToast('Permission denied: You do not have permission to delete groups.');
      setIsDeleteGroupModalOpen(false);
      setSelectedGroupToDelete(null);
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const { linkedMembers } = getGroupLinkedBlockInfo(selectedGroupToDelete);
    if (linkedMembers.length > 0) {
      setIsDeleteGroupModalOpen(false);
      setSelectedGroupToDelete(null);
      showToast('Cannot delete group while members are still linked to it.');
      return;
    }
    const updated = microFinanceService.deleteGroup(selectedGroupToDelete.id);
    setGroups(updated);
    setIsDeleteGroupModalOpen(false);
    setSelectedGroupToDelete(null);
    showToast('Group deleted');
  };

  // Photo Upload Handler for Member
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMemberPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Photo size exceeds 2MB limit. Please choose a smaller photo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (base64) {
        setMemberForm(prev => ({ ...prev, photoUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveMemberPhoto = () => {
    setMemberForm(prev => ({ ...prev, photoUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handlers for Member
  const handleOpenAddMember = () => {
    if (!canEditMembers) {
      showToast('Permission denied: You do not have permission to add members.');
      return;
    }
    setEditingMember(null);
    setMemberFormError(null);
    const existingIdKeys = new Set(
      members.map(m => normalizeDuplicateMemberId(m.memberId)).filter(Boolean)
    );
    let nextSeq = 1000 + members.length + 1;
    while (existingIdKeys.has(normalizeDuplicateMemberId(`M-${nextSeq}`))) {
      nextSeq += 1;
    }
    const genAccountNo = `SAV-${nextSeq}`;
    const defaultCenterId =
      appliedMemberCenterId ||
      sortedCentersByMeetingDay[0]?.id ||
      centers[0]?.id ||
      '';
    const centerGroups = defaultCenterId ? getGroupsForCenterFilter(defaultCenterId) : [];
    const defaultGroupId =
      (appliedMemberGroupId && centerGroups.some(g => g.id === appliedMemberGroupId)
        ? appliedMemberGroupId
        : centerGroups[0]?.id) || '';

    setMemberForm({
      memberId: `M-${nextSeq}`,
      name: '',
      citizenshipNo: '',
      mobile: '',
      gender: 'Female',
      branch: defaultBranchName,
      centerId: defaultCenterId,
      samuhId: defaultGroupId,
      role: 'Member',
      savingsAccountNo: genAccountNo,
      address: '',
      joinedDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      totalSavings: 0,
      activeLoanAmount: 0,
      photoUrl: ''
    });
    setIsMemberModalOpen(true);
  };

  const handleEditMember = (member: MFMember) => {
    if (!canEditMembers) {
      showToast('Permission denied: You do not have permission to edit members.');
      return;
    }
    setEditingMember(member);
    setMemberFormError(null);
    const resolvedCenterId =
      (member.centerId && centers.some(c => c.id === member.centerId)
        ? member.centerId
        : centers.find(c => normalizeMfText(c.name) === normalizeMfText(member.centerName))?.id) ||
      sortedCentersByMeetingDay[0]?.id ||
      centers[0]?.id ||
      '';
    const centerGroups = resolvedCenterId ? getGroupsForCenterFilter(resolvedCenterId) : [];
    const resolvedGroupId =
      (member.samuhId && centerGroups.some(g => g.id === member.samuhId)
        ? member.samuhId
        : centerGroups.find(g => normalizeMfText(g.name) === normalizeMfText(member.samuhName))?.id) ||
      centerGroups[0]?.id ||
      '';

    setMemberForm({
      memberId: member.memberId,
      name: member.name,
      citizenshipNo: member.citizenshipNo,
      mobile: member.mobile,
      gender: member.gender,
      branch: member.branch,
      centerId: resolvedCenterId,
      samuhId: resolvedGroupId,
      role: member.role,
      savingsAccountNo: member.savingsAccountNo,
      address: member.address,
      joinedDate: member.joinedDate,
      status: member.status,
      totalSavings: member.totalSavings,
      activeLoanAmount: member.activeLoanAmount,
      photoUrl: member.photoUrl || ''
    });
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = () => {
    setMemberFormError(null);
    if (isDayEndedForBranch(branch?.id)) {
      setMemberFormError(getDayEndedBlockMessage());
      return;
    }
    if (!memberForm.name || !memberForm.name.trim()) {
      setMemberFormError('Please enter member name.');
      return;
    }

    if (
      editingMember &&
      getEffectiveMemberStatus(editingMember.status) === 'ACTIVE' &&
      getEffectiveMemberStatus(memberForm.status) === 'INACTIVE'
    ) {
      const { openSavings, openLoans } = getMemberAccountBlockInfo(editingMember);
      if (openSavings.length > 0 || openLoans.length > 0) {
        setMemberFormError(
          `Cannot mark member Inactive: ${openSavings.length} active Saving account(s) and ${openLoans.length} active Loan account(s) must be closed first.`
        );
        return;
      }
    }

    const latestMembers = microFinanceService.getMembers();
    const duplicateMember = findDuplicateMember(
      latestMembers,
      { memberId: memberForm.memberId, citizenshipNo: memberForm.citizenshipNo },
      editingMember?.id
    );
    if (duplicateMember) {
      setMemberFormError('This member is already registered in the system.');
      return;
    }

    const c = centers.find(item => item.id === memberForm.centerId);
    const g = groups.find(item => item.id === memberForm.samuhId);

    const safeAccNo = memberForm.savingsAccountNo || `SAV-${Date.now().toString().slice(-4)}`;
    const safeJoinedDate = memberForm.joinedDate || new Date().toISOString().split('T')[0];
    const resolvedMemberBranch = c?.branch || (!canSwitchBranchView ? defaultBranchName : (memberForm.branch || defaultBranchName));

    try {
      if (editingMember) {
        microFinanceService.updateMember(editingMember.id, {
          ...memberForm,
          branch: resolvedMemberBranch,
          memberId: memberForm.memberId.trim(),
          name: memberForm.name.trim(),
          citizenshipNo: memberForm.citizenshipNo.trim(),
          savingsAccountNo: safeAccNo,
          joinedDate: safeJoinedDate,
          centerName: c ? c.name : 'N/A',
          samuhName: g ? g.name : 'N/A'
        });
        showToast('Member updated successfully');
      } else {
        microFinanceService.addMember({
          ...memberForm,
          branch: resolvedMemberBranch,
          memberId: memberForm.memberId.trim(),
          name: memberForm.name.trim(),
          citizenshipNo: memberForm.citizenshipNo.trim(),
          savingsAccountNo: safeAccNo,
          joinedDate: safeJoinedDate,
          centerName: c ? c.name : 'N/A',
          samuhName: g ? g.name : 'N/A'
        });
        showToast('New member registered');
      }
    } catch (err) {
      setMemberFormError(err instanceof Error ? err.message : 'Unable to save member.');
      return;
    }
    setMembers(microFinanceService.getMembers());
    setGroups(microFinanceService.getGroups());
    setIsMemberModalOpen(false);
  };

  const handleDeleteMember = (id: string) => {
    if (!canDeleteMembers) {
      showToast('Permission denied: You do not have permission to delete members.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const target = members.find(m => m.id === id);
    if (!target) return;

    const { allMemberSavings, openSavings, allMemberLoans, openLoans } = getMemberAccountBlockInfo(target);
    if (openSavings.length > 0 || openLoans.length > 0) {
      setActionBlockNotice({
        title: 'Member Delete Garna Mildaina',
        subtitle: `${target.name} (${target.memberId})`,
        message:
          'Yes member ko naam ma active/matured Saving athawa Loan khata chha. Active khata rahunjel member delete garna mildaina.',
        items: [
          ...openSavings.map(s => ({
            label: `Saving A/C: ${s.accountNo}`,
            detail: `NPR ${(Number(s.amount) || 0).toLocaleString()} (${s.savingType || 'Saving'})`,
            status: getEffectiveSavingStatus(s),
            kind: 'saving' as const
          })),
          ...openLoans.map(l => ({
            label: `Loan A/C: ${l.accountNo}`,
            detail: `NPR ${(Number(l.loanAmount) || 0).toLocaleString()} (${l.loanType || 'Loan'})`,
            status: getEffectiveLoanStatus(l),
            kind: 'loan' as const
          }))
        ],
        hint: 'Pahila sabai active Saving ra Loan khata close garnuhos; tyaspachhi member lai Inactive (Close) rakhna sakinchha.',
        showGoToSaving: openSavings.length > 0 && canViewSaving,
        showGoToLoan: openLoans.length > 0 && canViewLoan
      });
      return;
    }

    if (allMemberSavings.length > 0 || allMemberLoans.length > 0) {
      setActionBlockNotice({
        title: 'Record Bhayeko Member Delete Garna Mildaina',
        subtitle: `${target.name} (${target.memberId})`,
        message:
          'Yes member ko purano Saving/Loan khata record system ma raheko chha. Audit itihas surakshit rakhna ko lagi delete garna mildaina.',
        items: [
          ...allMemberSavings.slice(0, 4).map(s => ({
            label: `Saving A/C: ${s.accountNo}`,
            detail: `NPR ${(Number(s.amount) || 0).toLocaleString()}`,
            status: getEffectiveSavingStatus(s),
            kind: 'saving' as const
          })),
          ...allMemberLoans.slice(0, 4).map(l => ({
            label: `Loan A/C: ${l.accountNo}`,
            detail: `NPR ${(Number(l.loanAmount) || 0).toLocaleString()}`,
            status: getEffectiveLoanStatus(l),
            kind: 'loan' as const
          }))
        ],
        hint: 'Delete garne satta sabai khata close bhayepachhi Member lai Deactivate (Inactive) garera rakhnuhos.'
      });
      return;
    }

    setSelectedMemberToDelete(target);
    setIsDeleteMemberModalOpen(true);
  };

  const handleConfirmDeleteMember = () => {
    if (!selectedMemberToDelete) return;
    if (!canDeleteMembers) {
      showToast('Permission denied: You do not have permission to delete members.');
      setIsDeleteMemberModalOpen(false);
      setSelectedMemberToDelete(null);
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const { allMemberSavings, allMemberLoans } = getMemberAccountBlockInfo(selectedMemberToDelete);
    if (allMemberSavings.length > 0 || allMemberLoans.length > 0) {
      setIsDeleteMemberModalOpen(false);
      setSelectedMemberToDelete(null);
      showToast('Cannot delete member with Saving or Loan records. Use Deactivate instead.');
      return;
    }
    const updated = microFinanceService.deleteMember(selectedMemberToDelete.id);
    setMembers(updated);
    setGroups(microFinanceService.getGroups());
    setIsDeleteMemberModalOpen(false);
    setSelectedMemberToDelete(null);
    showToast('Member deleted');
  };

  const handleOpenViewMember = (member: MFMember) => {
    setSelectedMemberToView(member);
    setViewMemberDetailTab('all');
    setIsViewMemberModalOpen(true);
    if (closedLoansArchive.length === 0) {
      void microFinanceService.fetchClosedLoansFromSupabase().then(archived => {
        if (archived.length > 0) setClosedLoansArchive(archived);
      }).catch(() => {});
    }
  };

  const handleOpenToggleMemberStatus = (member: MFMember) => {
    if (!canEditMembers) {
      showToast('Permission denied: You do not have permission to update member status.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const currentStatus = getEffectiveMemberStatus(member.status);
    if (currentStatus === 'ACTIVE') {
      const { openSavings, openLoans } = getMemberAccountBlockInfo(member);
      if (openSavings.length > 0 || openLoans.length > 0) {
        setActionBlockNotice({
          title: 'Member Close / Deactivate Garna Mildaina',
          subtitle: `${member.name} (${member.memberId})`,
          message:
            'Pahila yes member ko sabai active/matured Saving ra Loan khata close garnuhos, tyaspachhi matrai member lai Deactivate (Inactive) garna milchha.',
          items: [
            ...openSavings.map(s => ({
              label: `Saving A/C: ${s.accountNo}`,
              detail: `NPR ${(Number(s.amount) || 0).toLocaleString()} (${s.savingType || 'Saving'})`,
              status: getEffectiveSavingStatus(s),
              kind: 'saving' as const
            })),
            ...openLoans.map(l => ({
              label: `Loan A/C: ${l.accountNo}`,
              detail: `NPR ${(Number(l.loanAmount) || 0).toLocaleString()} (${l.loanType || 'Loan'})`,
              status: getEffectiveLoanStatus(l),
              kind: 'loan' as const
            }))
          ],
          hint: `Active Accounts: ${openSavings.length} Saving, ${openLoans.length} Loan.`,
          showGoToSaving: openSavings.length > 0 && canViewSaving,
          showGoToLoan: openLoans.length > 0 && canViewLoan
        });
        return;
      }
    }
    setSelectedMemberToToggleStatus(member);
    setIsToggleMemberStatusModalOpen(true);
  };

  const handleConfirmToggleMemberStatus = () => {
    if (!selectedMemberToToggleStatus) return;
    if (!canEditMembers) {
      showToast('Permission denied: You do not have permission to update member status.');
      setIsToggleMemberStatusModalOpen(false);
      setSelectedMemberToToggleStatus(null);
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const currentStatus = getEffectiveMemberStatus(selectedMemberToToggleStatus.status);
    if (currentStatus === 'ACTIVE') {
      const { openSavings, openLoans } = getMemberAccountBlockInfo(selectedMemberToToggleStatus);
      if (openSavings.length > 0 || openLoans.length > 0) {
        setIsToggleMemberStatusModalOpen(false);
        setSelectedMemberToToggleStatus(null);
        showToast('Please close all active Saving and Loan accounts before deactivating this member.');
        return;
      }
    }
    const nextStatus: 'ACTIVE' | 'INACTIVE' = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    microFinanceService.updateMember(selectedMemberToToggleStatus.id, { status: nextStatus });
    setMembers(microFinanceService.getMembers());
    setGroups(microFinanceService.getGroups());
    setIsToggleMemberStatusModalOpen(false);
    setSelectedMemberToToggleStatus(null);
    showToast(
      nextStatus === 'INACTIVE'
        ? `Member ${selectedMemberToToggleStatus.name} deactivated & moved to Inactive`
        : `Member ${selectedMemberToToggleStatus.name} activated & moved to Active`
    );
  };

  const handleOpenViewSaving = (item: MFSavingsRecord) => {
    setSelectedSavingToView(item);
    setIsViewSavingModalOpen(true);
  };

  const handleOpenToggleSavingStatus = (item: MFSavingsRecord) => {
    if (!canEditSaving) {
      showToast('Permission denied: You do not have permission to update saving status.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setSelectedSavingToToggleStatus(item);
    setIsToggleSavingStatusModalOpen(true);
  };

  const handleConfirmToggleSavingStatus = () => {
    if (!selectedSavingToToggleStatus) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const currentStatus = getEffectiveSavingStatus(selectedSavingToToggleStatus);
    const nextStatus: 'ACTIVE' | 'CLOSED' = currentStatus !== 'CLOSED' ? 'CLOSED' : 'ACTIVE';
    if (nextStatus === 'ACTIVE') {
      const latestSavings = microFinanceService.getSavings();
      const conflict = findActiveDuplicateSaving(
        latestSavings,
        selectedSavingToToggleStatus.memberId,
        selectedSavingToToggleStatus.savingType,
        selectedSavingToToggleStatus.id
      );
      if (conflict) {
        setIsToggleSavingStatusModalOpen(false);
        setSelectedSavingToToggleStatus(null);
        showToast(
          `Cannot activate: Member ${selectedSavingToToggleStatus.memberId} already has an ACTIVE account (${conflict.accountNo}) in "${conflict.savingType}".`
        );
        return;
      }
    }
    const updated = microFinanceService.updateSaving(selectedSavingToToggleStatus.id, { status: nextStatus });
    setSavings(updated);
    setMembers(microFinanceService.getMembers());
    setIsToggleSavingStatusModalOpen(false);
    setSelectedSavingToToggleStatus(null);
    showToast(
      nextStatus === 'CLOSED'
        ? `Saving account ${selectedSavingToToggleStatus.accountNo} (${selectedSavingToToggleStatus.name}) closed & moved to Close`
        : `Saving account ${selectedSavingToToggleStatus.accountNo} (${selectedSavingToToggleStatus.name}) activated`
    );
  };

  const handleOpenEditSaving = (item: MFSavingsRecord) => {
    if (!canEditSaving) {
      showToast('Permission denied: You do not have permission to edit savings.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const openBs = resolveSavingOpenDateBs(item) || getTodayBsDate();
    const periodYears = resolveSavingPeriodYears(item);
    const maturityDateBs = resolveSavingMaturityDateBs({ ...item, dateBs: openBs, periodYears });
    setEditSavingForm({
      ...item,
      dateBs: openBs,
      periodYears,
      maturityDateBs,
      status: getEffectiveSavingStatus(item)
    });
    setIsEditSavingModalOpen(true);
  };

  const handleSaveEditSaving = () => {
    if (!editSavingForm) return;
    if (!canEditSaving) {
      showToast('Permission denied: You do not have permission to edit savings.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const targetBs = normalizeBsDate(editSavingForm.dateBs || editSavingForm.date || getTodayBsDate());
    if (isBackDateBlockedForEntry(targetBs, systemSettings || authSettings)) {
      alert(getBackDateBlockedMessage(targetBs));
      return;
    }
    if (!editSavingForm.accountNo || !editSavingForm.accountNo.trim()) {
      alert('Please enter a valid account number.');
      return;
    }
    if (Number(editSavingForm.amount) < 0 || isNaN(Number(editSavingForm.amount))) {
      alert('Please enter a valid recurring amount.');
      return;
    }

    const periodYears = resolveSavingPeriodYears(editSavingForm);
    const maturityDateBs =
      normalizeBsDate(editSavingForm.maturityDateBs) ||
      calculateBsMaturityDateByYears(targetBs, periodYears);
    const desiredStatusRaw = String(editSavingForm.status || 'ACTIVE').toUpperCase();
    const nextStatus: 'ACTIVE' | 'MATURED' | 'CLOSED' =
      desiredStatusRaw === 'CLOSED'
        ? 'CLOSED'
        : desiredStatusRaw === 'MATURED'
        ? 'MATURED'
        : 'ACTIVE';

    const updated = microFinanceService.updateSaving(editSavingForm.id, {
      ...editSavingForm,
      accountNo: editSavingForm.accountNo.trim(),
      name: editSavingForm.name.trim(),
      dateBs: targetBs,
      periodYears,
      maturityDateBs,
      amount: Number(editSavingForm.amount) || 0,
      status: nextStatus
    });
    setSavings(updated);
    setMembers(microFinanceService.getMembers());
    setIsEditSavingModalOpen(false);
    setEditSavingForm(null);
    showToast('Saving record updated successfully');
  };

  const handleOpenDeleteSaving = (item: MFSavingsRecord) => {
    if (!canDeleteSaving) {
      showToast('Permission denied: You do not have permission to delete savings.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setSelectedSavingToDelete(item);
    setIsDeleteSavingModalOpen(true);
  };

  const handleConfirmDeleteSaving = () => {
    if (!selectedSavingToDelete) return;
    if (!canDeleteSaving) {
      showToast('Permission denied: You do not have permission to delete savings.');
      setIsDeleteSavingModalOpen(false);
      setSelectedSavingToDelete(null);
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const updated = microFinanceService.deleteSaving(selectedSavingToDelete.id);
    setSavings(updated);
    setIsDeleteSavingModalOpen(false);
    setSelectedSavingToDelete(null);
    showToast('Saving record deleted successfully');
  };

  const handleOpenDeleteSheet = (sheet: MFCollectionSheet) => {
    if (!canDeleteCollectionReport) {
      showToast('Permission denied: You do not have permission to delete collection sheets.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setSelectedSheetToDelete(sheet);
    setIsDeleteSheetModalOpen(true);
  };

  const handleConfirmDeleteSheet = () => {
    if (!selectedSheetToDelete) return;
    if (!canDeleteCollectionReport) {
      showToast('Permission denied: You do not have permission to delete collection sheets.');
      setIsDeleteSheetModalOpen(false);
      setSelectedSheetToDelete(null);
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const updated = microFinanceService.deleteSheet(selectedSheetToDelete.id);
    setSheets(updated);
    setIsDeleteSheetModalOpen(false);
    setSelectedSheetToDelete(null);
    showToast('Collection sheet deleted successfully');
  };

  // Handlers for Savings (Supports search directly in input and multiple accounts)
  const handleOpenAddSaving = () => {
    if (!canEditSaving) {
      showToast('Permission denied: You do not have permission to create saving accounts.');
      return;
    }
    const defaultProduct = filteredMfSavingProducts[0]?.name || 'General Saving';
    const todayBs = getTodayBsDate();

    setSavingFormError(null);
    setSelectedSavingMemberId('');
    setMemberSearchInput('');
    setIsMemberDropdownOpen(false);
    setSavingDate(todayBs);
    // Start with 1 blank account row; period defaults to 6 years with auto-calculated maturity date
    setSavingAccounts([
      {
        id: 'acc-' + Date.now() + '-1',
        accountNo: '',
        savingType: 'Normal Saving',
        product: defaultProduct,
        amount: 1000,
        periodYears: DEFAULT_SAVING_PERIOD_YEARS,
        maturityDateBs: calculateBsMaturityDateByYears(todayBs, DEFAULT_SAVING_PERIOD_YEARS)
      }
    ]);
    setIsSavingModalOpen(true);
  };

  const handleSelectSavingMember = (member: MFMember) => {
    setSavingFormError(null);
    setSelectedSavingMemberId(member.memberId);
    setMemberSearchInput(`${member.name} (${member.memberId})`);
    setIsMemberDropdownOpen(false);
    const baseAccount = member.savingsAccountNo || `SAV-${member.memberId.replace('M-', '')}`;
    setSavingAccounts(prev => prev.map((acc, idx) => ({
      ...acc,
      accountNo: idx === 0 ? baseAccount : `${baseAccount}-0${idx + 1}`
    })));
  };

  const handleAddSavingAccount = () => {
    setSavingFormError(null);
    const mem = members.find(m => m.memberId === selectedSavingMemberId);
    const base = mem?.savingsAccountNo || (selectedSavingMemberId ? `SAV-${selectedSavingMemberId.replace('M-', '')}` : 'SAV-1001');
    const nextIdx = savingAccounts.length + 1;
    const defaultType = 'Recurring Saving';
    const usedProductKeys = new Set(
      savingAccounts.map(a => normalizeSavingProductKey(a.product ? `${a.savingType} (${a.product})` : a.savingType))
    );
    const availableProduct =
      filteredMfSavingProducts.find(p => {
        const key = normalizeSavingProductKey(p.name);
        if (usedProductKeys.has(key)) return false;
        if (selectedSavingMemberId && findActiveDuplicateSaving(savings, selectedSavingMemberId, p.name)) return false;
        return true;
      }) || filteredMfSavingProducts[0];
    const defaultProduct = availableProduct?.name || 'General Saving';
    const defaultAmt = 500;
    const baseDateBs = normalizeBsDate(savingDate || getTodayBsDate()) || getTodayBsDate();

    setSavingAccounts(prev => [
      ...prev,
      {
        id: 'acc-' + Date.now() + '-' + nextIdx,
        accountNo: `${base}-0${nextIdx}`,
        savingType: defaultType,
        product: defaultProduct,
        amount: defaultAmt,
        periodYears: DEFAULT_SAVING_PERIOD_YEARS,
        maturityDateBs: calculateBsMaturityDateByYears(baseDateBs, DEFAULT_SAVING_PERIOD_YEARS)
      }
    ]);
  };

  const handleRemoveSavingAccount = (id: string) => {
    if (savingAccounts.length <= 1) return;
    setSavingFormError(null);
    setSavingAccounts(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateSavingAccount = (
    id: string,
    field: 'accountNo' | 'savingType' | 'product' | 'amount' | 'periodYears' | 'maturityDateBs',
    value: string | number
  ) => {
    setSavingFormError(null);
    setSavingAccounts(prev =>
      prev.map(a => {
        if (a.id !== id) return a;
        if (field === 'periodYears') {
          const yrs = Number(value);
          const safeYears = Number.isFinite(yrs) && yrs > 0 ? yrs : 0;
          const baseDateBs = normalizeBsDate(savingDate || getTodayBsDate()) || getTodayBsDate();
          return {
            ...a,
            periodYears: safeYears,
            maturityDateBs:
              safeYears > 0 ? calculateBsMaturityDateByYears(baseDateBs, safeYears) : a.maturityDateBs
          };
        }
        return { ...a, [field]: value };
      })
    );
  };

  const handleSavingDateChange = (newDateBs: string) => {
    setSavingFormError(null);
    setSavingDate(newDateBs);
    const norm = normalizeBsDate(newDateBs);
    if (norm && /^\d{4}-\d{2}-\d{2}$/.test(norm)) {
      setSavingAccounts(prev =>
        prev.map(acc => ({
          ...acc,
          maturityDateBs: calculateBsMaturityDateByYears(
            norm,
            acc.periodYears > 0 ? acc.periodYears : DEFAULT_SAVING_PERIOD_YEARS
          )
        }))
      );
    }
  };

  const handleSaveSaving = () => {
    setSavingFormError(null);
    if (isDayEndedForBranch(branch?.id)) {
      setSavingFormError(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(savingDate, systemSettings || authSettings)) {
      setSavingFormError(getBackDateBlockedMessage(savingDate));
      return;
    }
    const mem = members.find(m => m.memberId === selectedSavingMemberId);
    if (!mem) {
      setSavingFormError('Please select a valid member.');
      return;
    }

    if (savingAccounts.length === 0) {
      setSavingFormError('Please add at least one saving account.');
      return;
    }

    const latestSavings = microFinanceService.getSavings();
    const seenProductKeys = new Set<string>();

    for (let i = 0; i < savingAccounts.length; i++) {
      const a = savingAccounts[i];
      if (!a.accountNo || !a.accountNo.trim()) {
        setSavingFormError(`Account #${i + 1}: Please enter a valid account number.`);
        return;
      }
      if (a.amount < 0 || isNaN(a.amount)) {
        setSavingFormError(`Account #${i + 1}: Please enter a valid deposit amount.`);
        return;
      }

      const typeLabel = a.product ? `${a.savingType} (${a.product})` : a.savingType;
      const prodKey = normalizeSavingProductKey(typeLabel);
      const conflict = findActiveDuplicateSaving(latestSavings, mem.memberId, typeLabel);
      if (conflict || (prodKey && seenProductKeys.has(prodKey))) {
        setSavingFormError('This Account Has Already Been Opened.');
        return;
      }
      if (prodKey) seenProductKeys.add(prodKey);
    }

    const dynamicBsDate = normalizeBsDate(savingDate || getTodayBsDate());
    const todayAd = new Date().toISOString().split('T')[0];

    try {
      // Save all accounts in a single batch
      savingAccounts.forEach(acc => {
        const typeLabel = acc.product ? `${acc.savingType} (${acc.product})` : acc.savingType;
        const periodYears = acc.periodYears > 0 ? acc.periodYears : DEFAULT_SAVING_PERIOD_YEARS;
        const maturityDateBs =
          normalizeBsDate(acc.maturityDateBs) ||
          calculateBsMaturityDateByYears(dynamicBsDate, periodYears);
        microFinanceService.addSaving({
          memberId: mem.memberId,
          accountNo: acc.accountNo.trim(),
          name: mem.name,
          groupName: mem.samuhName,
          centerName: mem.centerName,
          date: todayAd,
          dateBs: dynamicBsDate,
          amount: Number(acc.amount) || 0,
          savingType: typeLabel,
          status: 'ACTIVE',
          periodYears,
          maturityDateBs,
          collectedBy: user?.fullName || '',
          receiptNo: '',
          createdBy: user?.id || user?.username || '',
          createdByName: user?.fullName || user?.username || ''
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setSavingFormError(
        msg.toLowerCase().includes('already has an active saving account')
          ? 'This Account Has Already Been Opened.'
          : msg || 'Unable to create saving account.'
      );
      return;
    }

    setSavings(microFinanceService.getSavings());
    setMembers(microFinanceService.getMembers());
    setIsSavingModalOpen(false);
    showToast(`${savingAccounts.length} Saving Account(s) Opened & Saved Successfully`);
  };

  // Handlers for Loan
  const handleOpenIssueLoan = () => {
    if (!canEditLoan) {
      showToast('Permission denied: You do not have permission to issue loans.');
      return;
    }
    let todayBs = '2083-07-25';
    try {
      todayBs = new NepaliDate().format('YYYY-MM-DD');
    } catch {
      // fallback
    }

    const defaultProd = filteredMfLoanProducts[0];
    const defaultProdName = defaultProd?.name || 'General Loan';
    const defaultRate = defaultProd?.interestRate || 13;
    const defaultPeriod = defaultProd?.maxTenureMonths || 12;
    const defaultAmount = 50000;
    const defaultInstallment = Math.round((defaultAmount + (defaultAmount * (defaultRate / 100) * (defaultPeriod / 12))) / defaultPeriod);
    const defaultMaturity = calculateBsMaturityDate(todayBs, defaultPeriod);
    const maxLoanAccNum = [...loans, ...closedLoansArchive].reduce((max, l) => {
      const m = String(l.accountNo || '').match(/(\d+)$/);
      const num = m ? parseInt(m[1], 10) : 0;
      return num > max ? num : max;
    }, 2000 + loans.length);

    setLoanMemberSearchInput('');
    setIsLoanMemberDropdownOpen(false);
    setLoanFormError(null);

    setLoanForm({
      memberId: '',
      accountNo: `LN-${maxLoanAccNum + 1}`,
      name: '',
      centerName: '',
      groupName: '',
      loanDate: new Date().toISOString().split('T')[0],
      loanDateBs: todayBs,
      loanAmount: defaultAmount,
      remainingAmount: defaultAmount,
      installmentAmount: defaultInstallment,
      totalInstallments: defaultPeriod,
      paidInstallments: 0,
      interestRate: defaultRate,
      status: 'ACTIVE',
      loanProduct: defaultProdName,
      maturityDate: defaultMaturity
    });
    setIsLoanModalOpen(true);
  };

  const handleSelectLoanMember = (mem: MFMember) => {
    setLoanMemberSearchInput(`${mem.name} (${mem.memberId})`);
    setIsLoanMemberDropdownOpen(false);
    setLoanFormError(null);
    setLoanForm(prev => ({
      ...prev,
      memberId: mem.memberId,
      name: mem.name,
      centerName: mem.centerName,
      groupName: mem.samuhName
    }));
  };

  const handleLoanDateBsChange = (newDateBs: string) => {
    setLoanFormError(null);
    setLoanForm(prev => {
      const maturity = calculateBsMaturityDate(newDateBs, prev.totalInstallments);
      return {
        ...prev,
        loanDateBs: newDateBs,
        maturityDate: maturity
      };
    });
  };

  const handleLoanProductChange = (prodName: string) => {
    setLoanFormError(null);
    const matched = filteredMfLoanProducts.find(p => p.name === prodName);
    const rate = matched?.interestRate ?? loanForm.interestRate;
    const period = matched?.maxTenureMonths && matched.maxTenureMonths > 0 ? matched.maxTenureMonths : loanForm.totalInstallments;
    const amt = loanForm.loanAmount;
    const calculatedInstallment = Math.round((amt + (amt * (rate / 100) * (period / 12))) / period);
    const maturity = calculateBsMaturityDate(loanForm.loanDateBs, period);

    setLoanForm(prev => ({
      ...prev,
      loanProduct: prodName,
      interestRate: rate,
      totalInstallments: period,
      installmentAmount: calculatedInstallment,
      maturityDate: maturity
    }));
  };

  const handleLoanAmountChange = (amt: number) => {
    setLoanFormError(null);
    const rate = loanForm.interestRate || 13;
    const period = loanForm.totalInstallments || 12;
    const calculatedInstallment = Math.round((amt + (amt * (rate / 100) * (period / 12))) / period);
    setLoanForm(prev => ({
      ...prev,
      loanAmount: amt,
      remainingAmount: amt,
      installmentAmount: calculatedInstallment
    }));
  };

  const handleLoanPeriodChange = (period: number) => {
    setLoanFormError(null);
    const safePeriod = period > 0 ? period : 1;
    const amt = loanForm.loanAmount;
    const rate = loanForm.interestRate || 13;
    const calculatedInstallment = Math.round((amt + (amt * (rate / 100) * (safePeriod / 12))) / safePeriod);
    const maturity = calculateBsMaturityDate(loanForm.loanDateBs, safePeriod);

    setLoanForm(prev => ({
      ...prev,
      totalInstallments: safePeriod,
      installmentAmount: calculatedInstallment,
      maturityDate: maturity
    }));
  };

  const handleSaveLoan = () => {
    if (isDayEndedForBranch(branch?.id)) {
      setLoanFormError(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(loanForm.loanDateBs || loanForm.loanDate, systemSettings || authSettings)) {
      setLoanFormError(getBackDateBlockedMessage(loanForm.loanDateBs || loanForm.loanDate));
      return;
    }
    if (!loanForm.memberId || !loanForm.name) {
      setLoanFormError('Loan issue failed: Please select a member before issuing a loan.');
      return;
    }
    if (loanForm.loanAmount <= 0) {
      setLoanFormError('Loan issue failed: Loan Amount must be greater than NPR 0.');
      return;
    }

    const latestLoans = microFinanceService.getLoans();
    const unclosedConflict =
      findUnclosedDuplicateLoan(latestLoans, loanForm.memberId, loanForm.loanProduct) ||
      conflictingUnclosedLoan;
    if (unclosedConflict) {
      const conflictStatusLabel = getEffectiveLoanStatus(unclosedConflict) === 'MATURED' ? 'MATURE' : 'ACTIVE';
      const failMsg = `Loan issue failed: ${loanForm.name} (${loanForm.memberId}) already has an unclosed ${conflictStatusLabel} loan (${unclosedConflict.accountNo}) under "${unclosedConflict.loanProduct}" (Amount: NPR ${Number(unclosedConflict.loanAmount || 0).toLocaleString()}, Date: ${unclosedConflict.loanDateBs || unclosedConflict.loanDate}). Close the existing loan first before issuing a new loan of the same product.`;
      setLoanFormError(failMsg);
      showToast(`Failed: Unclosed ${conflictStatusLabel} ${unclosedConflict.loanProduct} loan (${unclosedConflict.accountNo}) exists.`);
      return;
    }

    const duplicateAccountLoan = latestLoans.find(
      l => String(l.accountNo || '').trim().toLowerCase() === String(loanForm.accountNo || '').trim().toLowerCase()
    );
    if (duplicateAccountLoan) {
      const failMsg = `Loan issue failed: Duplicate Loan Account No. (${loanForm.accountNo}) already exists for ${duplicateAccountLoan.name} (${duplicateAccountLoan.memberId}).`;
      setLoanFormError(failMsg);
      showToast(failMsg);
      return;
    }

    try {
      microFinanceService.addLoan({
        ...loanForm,
        remainingAmount: loanForm.loanAmount,
        createdBy: user?.id || user?.username || '',
        createdByName: user?.fullName || user?.username || ''
      });
    } catch (err) {
      const failMsg = err instanceof Error ? err.message : 'Loan issue failed: Could not create loan.';
      setLoanFormError(failMsg);
      showToast(failMsg);
      return;
    }

    setLoanFormError(null);
    setLoans(microFinanceService.getLoans());
    setMembers(microFinanceService.getMembers());
    setIsLoanModalOpen(false);
    showToast('New loan issued successfully');
  };

  // View Loan
  const handleOpenViewLoan = (loan: MFLoanRecord) => {
    setSelectedLoanToView(loan);
    setIsViewLoanModalOpen(true);
  };

  // Edit Loan
  const handleOpenEditLoan = (loan: MFLoanRecord) => {
    if (!canEditLoan) {
      showToast('Permission denied: You do not have permission to edit loans.');
      return;
    }
    setSelectedLoanToEdit(loan);
    setEditLoanForm({
      ...loan,
      closedDateBs: loan.closedDateBs || getTodayBsDate()
    });
    setIsEditLoanModalOpen(true);
  };

  const handleSaveEditLoan = () => {
    if (!editLoanForm || !selectedLoanToEdit) return;
    if (!canEditLoan) {
      showToast('Permission denied: You do not have permission to edit loans.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(editLoanForm.loanDateBs || editLoanForm.loanDate, systemSettings || authSettings)) {
      alert(getBackDateBlockedMessage(editLoanForm.loanDateBs || editLoanForm.loanDate));
      return;
    }
    if (editLoanForm.status === 'CLOSED' && isBackDateBlockedForEntry(editLoanForm.closedDateBs || getTodayBsDate(), systemSettings || authSettings)) {
      alert(getBackDateBlockedMessage(editLoanForm.closedDateBs || getTodayBsDate()));
      return;
    }
    if (!editLoanForm.name || editLoanForm.loanAmount <= 0) {
      alert('Please enter valid loan details');
      return;
    }
    const isClosing = editLoanForm.status === 'CLOSED';
    const updated = microFinanceService.updateLoan(selectedLoanToEdit.id, {
      ...editLoanForm,
      closedDateBs: isClosing ? normalizeBsDate(editLoanForm.closedDateBs || getTodayBsDate()) : editLoanForm.closedDateBs,
      closedDate: isClosing ? (editLoanForm.closedDate || new Date().toISOString().split('T')[0]) : editLoanForm.closedDate
    });
    setLoans(updated);
    setMembers(microFinanceService.getMembers());
    setIsEditLoanModalOpen(false);
    setSelectedLoanToEdit(null);
    setEditLoanForm(null);
    showToast(isClosing ? 'Loan closed, saved in Supabase & removed from active list' : 'Loan record updated successfully');
  };

  // Close Loan (After Maturity)
  const handleOpenCloseLoan = (loan: MFLoanRecord) => {
    if (!canEditLoan) {
      showToast('Permission denied: You do not have permission to close loans.');
      return;
    }
    setSelectedLoanToClose(loan);
    setCloseLoanDateBs(getTodayBsDate());
    setIsCloseLoanModalOpen(true);
  };

  const handleSelectLoanStatusTab = async (tab: 'ACTIVE' | 'MATURED' | 'CLOSED') => {
    setLoanStatusTab(tab);
    if (tab === 'CLOSED') {
      setIsLoadingClosedLoans(true);
      try {
        const archived = await microFinanceService.fetchClosedLoansFromSupabase();
        setClosedLoansArchive(archived);
      } finally {
        setIsLoadingClosedLoans(false);
      }
    }
  };

  const handleConfirmCloseLoan = async () => {
    if (!selectedLoanToClose || isClosingLoan) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const finalCheckBs = normalizeBsDate(closeLoanDateBs || getTodayBsDate());
    if (isBackDateBlockedForEntry(finalCheckBs, systemSettings || authSettings)) {
      alert(getBackDateBlockedMessage(finalCheckBs));
      return;
    }
    setIsClosingLoan(true);
    try {
      const finalBs = normalizeBsDate(closeLoanDateBs || getTodayBsDate());
      const updated = await microFinanceService.closeLoan(selectedLoanToClose.id, finalBs);
      setLoans(updated);
      setCollectionSheetLoans(prev => prev.filter(l => l.id !== selectedLoanToClose.id));
      setMembers(microFinanceService.getMembers());
      if (closedLoansArchive.length > 0) {
        setClosedLoansArchive(prev => [
          {
            ...selectedLoanToClose,
            status: 'CLOSED',
            remainingAmount: 0,
            closedDate: new Date().toISOString().split('T')[0],
            closedDateBs: finalBs
          },
          ...prev.filter(l => l.id !== selectedLoanToClose.id)
        ]);
      }
      setIsCloseLoanModalOpen(false);
      setSelectedLoanToClose(null);
      showToast(`Loan ${selectedLoanToClose.accountNo} closed & archived in Supabase`);
    } finally {
      setIsClosingLoan(false);
    }
  };

  // Delete Loan
  const handleOpenDeleteLoan = (loan: MFLoanRecord) => {
    if (!canDeleteLoan) {
      showToast('Permission denied: You do not have permission to delete loans.');
      return;
    }
    setSelectedLoanToDelete(loan);
    setIsDeleteLoanModalOpen(true);
  };

  const handleConfirmDeleteLoan = () => {
    if (!selectedLoanToDelete) return;
    if (!canDeleteLoan) {
      showToast('Permission denied: You do not have permission to delete loans.');
      setIsDeleteLoanModalOpen(false);
      setSelectedLoanToDelete(null);
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const updated = microFinanceService.deleteLoan(selectedLoanToDelete.id);
    setLoans(updated);
    setCollectionSheetLoans(prev => prev.filter(l => l.id !== selectedLoanToDelete.id));
    setClosedLoansArchive(prev => prev.filter(l => l.id !== selectedLoanToDelete.id));
    setIsDeleteLoanModalOpen(false);
    setSelectedLoanToDelete(null);
    showToast('Loan record deleted successfully');
  };

  // Helper: checks if an open (non-closed) loan is active on a given BS report date.
  // Closed loans are strictly excluded from all sheets regardless of report date.
  const isLoanActiveOnBsDate = (loan: MFLoanRecord, targetDateBs: string): boolean => {
    if (getEffectiveLoanStatus(loan) === 'CLOSED') return false;
    const target = normalizeBsDate(targetDateBs);
    const openBs = normalizeBsDate(loan.loanDateBs || loan.loanDate);
    if (openBs && target && openBs > target) return false;
    return true;
  };

  // Resolves a unique member when a saving/loan record's memberId was mistyped with another member's ID in the same group/center
  const resolveTrueOwnerForMislinkedRecord = (
    record: { memberId?: string; name?: string; groupName?: string; centerName?: string }
  ): MFMember | null => {
    const recName = normalizeMfText(record.name);
    const recMemId = normalizeMfMemberId(record.memberId);
    if (!recName || !recMemId) return null;

    const idOwner = members.find(m => isSameMfMemberId(m.memberId, recMemId));
    if (!idOwner || normalizeMfText(idOwner.name) === recName) return null;

    const recGroup = normalizeMfText(record.groupName) || normalizeMfText(idOwner.samuhName);
    const recCenter = normalizeMfText(record.centerName) || normalizeMfText(idOwner.centerName);

    const exactNameMatches = members.filter(m => {
      if (normalizeMfText(m.name) !== recName) return false;
      if (recGroup && normalizeMfText(m.samuhName) !== recGroup) return false;
      if (recCenter && normalizeMfText(m.centerName) !== recCenter) return false;
      return true;
    });

    return exactNameMatches.length === 1 ? exactNameMatches[0] : null;
  };

  // Strict matcher: ensures loans never leak across members sharing the same name or different center/group,
  // while safely correcting cross-member Member ID typos when name + group/center uniquely identify another member
  const doesLoanBelongToMember = (loan: MFLoanRecord, mem: MFMember): boolean => {
    const loanMemId = normalizeMfMemberId(loan.memberId);
    const memId = normalizeMfMemberId(mem.memberId);
    if (loanMemId && memId) {
      const mislinkedOwner = resolveTrueOwnerForMislinkedRecord(loan);
      if (mislinkedOwner) {
        return isSameMfMemberId(mislinkedOwner.memberId, memId);
      }
      return isSameMfMemberId(loanMemId, memId);
    }

    const loanGroup = normalizeMfText(loan.groupName);
    const memGroup = normalizeMfText(mem.samuhName);
    const loanCenter = normalizeMfText(loan.centerName);
    const memCenter = normalizeMfText(mem.centerName);

    if (loanGroup && memGroup && loanGroup !== memGroup) return false;
    if (loanCenter && memCenter && loanCenter !== memCenter) return false;

    const loanName = normalizeMfText(loan.name);
    const memName = normalizeMfText(mem.name);
    return Boolean(!loanMemId && loanName && memName && loanName === memName);
  };

  const doesSavingBelongToMember = (
    saving: MFSavingsRecord,
    mem: { memberId?: string; name?: string; centerName?: string; samuhName?: string; savingsAccountNo?: string }
  ): boolean => {
    const memId = normalizeMfMemberId(mem.memberId);
    const savMemId = normalizeMfMemberId(saving.memberId);
    if (memId && savMemId) {
      const mislinkedOwner = resolveTrueOwnerForMislinkedRecord(saving);
      if (mislinkedOwner) {
        return isSameMfMemberId(mislinkedOwner.memberId, memId);
      }
      if (isSameMfMemberId(savMemId, memId)) return true;
    }

    const memAcc = normalizeMfMemberId(mem.savingsAccountNo);
    if (memAcc && normalizeMfMemberId(saving.accountNo) === memAcc) {
      return true;
    }

    const memName = normalizeMfText(mem.name);
    const savName = normalizeMfText(saving.name);
    if (!savMemId && memName && savName === memName) {
      const sGroup = normalizeMfText(saving.groupName);
      const memGroup = normalizeMfText(mem.samuhName);
      const sCenter = normalizeMfText(saving.centerName);
      const memCenter = normalizeMfText(mem.centerName);
      if (sGroup && memGroup && sGroup !== memGroup) return false;
      if (sCenter && memCenter && sCenter !== memCenter) return false;
      return true;
    }

    return false;
  };

  // Helper: returns matching ACTIVE/MATURED (unclosed) saving accounts in Savings Management for a member
  const getMemberActiveSavings = (
    mem: { memberId?: string; name?: string; centerName?: string; samuhName?: string; savingsAccountNo?: string },
    savingsPool?: MFSavingsRecord[]
  ): MFSavingsRecord[] => {
    const source = savingsPool ?? savings;
    return source.filter(
      s => getEffectiveSavingStatus(s) !== 'CLOSED' && doesSavingBelongToMember(s, mem)
    );
  };

  // Helper: returns ALL matching saving accounts (Active + Matured + Closed) for a member for profile/history view
  const getMemberAllSavings = (mem: { memberId?: string; name?: string; centerName?: string; samuhName?: string; savingsAccountNo?: string }): MFSavingsRecord[] => {
    const matched = savings.filter(s => doesSavingBelongToMember(s, mem));
    const statusRank = (st: 'ACTIVE' | 'MATURED' | 'CLOSED') =>
      st === 'ACTIVE' ? 0 : st === 'MATURED' ? 1 : 2;

    return [...matched].sort((a, b) => {
      const aRank = statusRank(getEffectiveSavingStatus(a));
      const bRank = statusRank(getEffectiveSavingStatus(b));
      if (aRank !== bRank) return aRank - bRank;
      const dA = resolveSavingOpenDateBs(a) || a.date || '';
      const dB = resolveSavingOpenDateBs(b) || b.date || '';
      return dB.localeCompare(dA);
    });
  };

  // Helper: sums recurring amounts from unclosed saving accounts in Savings Management for a member
  const getMemberRecurringSavingAmount = (
    mem: { memberId?: string; name?: string; centerName?: string; samuhName?: string; savingsAccountNo?: string },
    savingsPool?: MFSavingsRecord[]
  ): number => {
    return getMemberActiveSavings(mem, savingsPool).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  };

  // Helper: calculates inclusive saving kista count from the earliest active saving account open date (BS)
  const getMemberSavingKistaInfo = (
    mem: { memberId?: string; name?: string; centerName?: string; samuhName?: string },
    sheetYear: string,
    sheetMonthName: string
  ): { kista: number | null; openDateBs: string } => {
    const memberSavings = getMemberActiveSavings(mem);
    if (memberSavings.length === 0) return { kista: null, openDateBs: '' };

    const openDates = memberSavings
      .map(s => resolveSavingOpenDateBs(s))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const earliestOpenDateBs = openDates[0] || '';
    if (!earliestOpenDateBs) return { kista: null, openDateBs: '' };

    return {
      kista: calculateSavingBsKistaNumber(earliestOpenDateBs, sheetYear, sheetMonthName),
      openDateBs: earliestOpenDateBs
    };
  };

  // Handler for "View" button in Collection Sheet filter card (on-demand date-aware query)
  const handleViewCollectionSheet = async () => {
    const center = centers.find(c => c.id === reportCenterId) || centers[0];
    const group = groups.find(g => g.id === reportGroupId) || groups[0];
    
    if (!center) {
      showToast('Please select a center first.');
      return;
    }

    const targetDateBs = buildBsDateFromParts(reportYear, reportMonth, reportDay);
    let dateAwareLoans: MFLoanRecord[] = loans.filter(l => getEffectiveLoanStatus(l) !== 'CLOSED');
    let freshSavingsPool: MFSavingsRecord[] = savings;
    setIsLoadingCollectionSheet(true);
    try {
      const [fetchedLoans, fetchedSavings] = await Promise.all([
        microFinanceService.fetchLoansForReportDate(targetDateBs),
        microFinanceService.fetchSavingsFromSupabase().catch(() => null)
      ]);
      dateAwareLoans = fetchedLoans.filter(l => getEffectiveLoanStatus(l) !== 'CLOSED');
      if (fetchedSavings) {
        freshSavingsPool = fetchedSavings;
        setSavings(fetchedSavings);
      }
      setLoans(microFinanceService.getLoans());
      setCollectionSheetLoans(dateAwareLoans);
      setCollectionSheetTargetBs(targetDateBs);
    } finally {
      setIsLoadingCollectionSheet(false);
    }

    const groupMembers = members.filter(m => (!group || group.id === 'all')
      ? (m.centerId === center.id || m.centerName === center.name)
      : m.samuhId === group.id);
    const totalRecurringSaving = groupMembers.reduce((sum, m) => sum + getMemberRecurringSavingAmount(m, freshSavingsPool), 0);
    const totalLoanDue = groupMembers.reduce((sum, m) => {
      const mLoans = dateAwareLoans.filter(l =>
        doesLoanBelongToMember(l, m) &&
        isLoanActiveOnBsDate(l, targetDateBs)
      );
      return sum + mLoans.reduce((lsum, l) => lsum + (Number(l.installmentAmount) || 0), 0);
    }, 0);

    const newSheet: MFCollectionSheet = {
      id: 'cs-' + Date.now(),
      centerId: center.id,
      centerName: center.name,
      groupId: group ? group.id : 'all',
      groupName: group ? group.name : 'All Groups in Center',
      year: reportYear,
      month: reportMonth,
      day: reportDay,
      dateDisplay: `${reportYear} ${reportMonth} ${reportDay}`,
      status: 'GENERATED',
      totalCompulsorySaving: totalRecurringSaving,
      totalOptionalSaving: 0,
      totalLoanPrincipal: totalLoanDue,
      totalLoanInterest: 0,
      totalExpected: totalRecurringSaving + totalLoanDue,
      totalCollected: 0,
      memberCount: groupMembers.length,
      collectedBy: user?.fullName || 'Field Officer',
      createdAt: new Date().toISOString().split('T')[0]
    };

    setCollectionSheetModalMode('preview');
    setActiveSheetToPrint(newSheet);
    setIsPrintSheetModalOpen(true);
  };

  const isSameReportCenterAndGroup = (
    rec: { centerId?: string; centerName?: string; groupId?: string; groupName?: string },
    target: { centerId?: string; centerName?: string; groupId?: string; groupName?: string }
  ): boolean => {
    const recGroupId = String(rec.groupId || '').trim();
    const targetGroupId = String(target.groupId || '').trim();

    if (targetGroupId === 'all' || recGroupId === 'all') {
      if (recGroupId !== targetGroupId) return false;
      if (rec.centerId && target.centerId && rec.centerId === target.centerId) return true;
      return normalizeMfText(rec.centerName) !== '' && normalizeMfText(rec.centerName) === normalizeMfText(target.centerName);
    }

    const sameGroup =
      (recGroupId !== '' && targetGroupId !== '' && recGroupId === targetGroupId) ||
      (normalizeMfText(rec.groupName) !== '' && normalizeMfText(rec.groupName) === normalizeMfText(target.groupName));
    if (!sameGroup) return false;

    if (rec.centerId && target.centerId && rec.centerId !== target.centerId) {
      if (normalizeMfText(rec.centerName) !== normalizeMfText(target.centerName)) return false;
    }
    return true;
  };

  const extractReportBsYearMonth = (
    dateText?: string,
    fallbackYear?: string,
    fallbackMonth?: string
  ): { year: string; month: string } => {
    const raw = String(dateText || '');
    const ascii = fromNepaliDigits(raw);

    const yearMatch = ascii.match(/\b(20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : (fallbackYear && fallbackYear !== 'ALL' ? fallbackYear : currentBsDate.year);

    let month = '';
    for (const enMonth of nepaliMonthsEnglishList) {
      const npMonth = nepaliMonthMapNp[enMonth];
      if (
        raw.toLowerCase().includes(enMonth.toLowerCase()) ||
        (npMonth && raw.includes(npMonth))
      ) {
        month = enMonth;
        break;
      }
    }
    if (!month) {
      const numMatch = ascii.match(/20\d{2}[-/](\d{1,2})(?:[-/]|$)/);
      if (numMatch) {
        const mIdx = parseInt(numMatch[1], 10) - 1;
        if (mIdx >= 0 && mIdx < nepaliMonthsEnglishList.length) {
          month = nepaliMonthsEnglishList[mIdx];
        }
      }
    }
    if (!month) {
      month = fallbackMonth && fallbackMonth !== 'ALL' ? fallbackMonth : currentBsDate.month;
    }
    return { year, month };
  };

  // Handler when user clicks "Generate Sheet" in Collection Sheet preview modal
  // Saves the sheet permanently into Available Collection Sheets (once per Group + Year + Month)!
  const handleGenerateSignatureSheetFromModal = () => {
    if (!activeSheetToPrint) return;
    if (!canEditCollectionReport) {
      showToast('Permission denied: You do not have permission to generate collection sheets.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }

    const { year: targetYear, month: targetMonth } = extractReportBsYearMonth(
      activeSheetToPrint.dateDisplay,
      activeSheetToPrint.year,
      activeSheetToPrint.month
    );
    const allSavedCollectionSheets = [...sheets, ...microFinanceService.getSheets()];
    const existingCollectionForMonth = allSavedCollectionSheets.find(
      s =>
        isSameReportCenterAndGroup(s, activeSheetToPrint) &&
        matchesBsDateFilter(s.dateDisplay, targetYear, targetMonth, s.year, s.month)
    );
    if (existingCollectionForMonth) {
      setAlreadyGeneratedNotice({
        reportName: 'Collection Sheet',
        groupName: activeSheetToPrint.groupName || existingCollectionForMonth.groupName,
        periodLabel: `${targetYear} ${targetMonth}`,
        existingDetail: `Existing Record: ${existingCollectionForMonth.dateDisplay || `${targetYear} ${targetMonth}`}`
      });
      return;
    }

    const center = centers.find(c => c.id === activeSheetToPrint.centerId || c.name === activeSheetToPrint.centerName);
    const branchInfo =
      findMatchingBranch(center?.branch, adminBranches.length > 0 ? adminBranches : availableBranches) ||
      loggedInBranchObj ||
      availableBranches[0];
    const groupMembers = members.filter(m => (!activeSheetToPrint.groupId || activeSheetToPrint.groupId === 'all') ? (m.centerId === activeSheetToPrint.centerId || m.centerName === activeSheetToPrint.centerName) : m.samuhId === activeSheetToPrint.groupId);

    const nepMonth = nepaliMonthMapNp[activeSheetToPrint.month] || activeSheetToPrint.month;
    const nepYear = toNepaliDigits(activeSheetToPrint.year);
    const nepDay = toNepaliDigits(activeSheetToPrint.day);
    const nepaliDateStr = `${nepYear} ${nepMonth} ${nepDay}`;
    const targetDateBs = collectionSheetTargetBs || buildBsDateFromParts(activeSheetToPrint.year, activeSheetToPrint.month, activeSheetToPrint.day);
    const loanPool = (collectionSheetLoans.length > 0 ? collectionSheetLoans : loans).filter(
      l => getEffectiveLoanStatus(l) !== 'CLOSED'
    );

    const membersToUse = sortByNameAZ(groupMembers);

    const sigMembers: MFSignatureSheetMember[] = membersToUse.map(m => {
      const memLoans = loanPool.filter(l =>
        doesLoanBelongToMember(l, m) &&
        isLoanActiveOnBsDate(l, targetDateBs)
      );
      const { microLoan, emergencyLoan } = splitMemberLoansByCategory(memLoans);
      
      const microLoanOpenDate = microLoan ? (microLoan.loanDateBs || microLoan.loanDate) : '-';
      const microLoanKista = microLoan ? calculateBsKistaNumber(microLoanOpenDate, activeSheetToPrint.year, activeSheetToPrint.month) : 0;
      const microInstallmentAmt = microLoan ? (microLoan.installmentAmount || 0) : 0;

      const emergencyLoanOpenDate = emergencyLoan ? (emergencyLoan.loanDateBs || emergencyLoan.loanDate) : '-';
      const emergencyLoanKista = emergencyLoan ? calculateBsKistaNumber(emergencyLoanOpenDate, activeSheetToPrint.year, activeSheetToPrint.month) : 0;
      const emergencyInstallmentAmt = emergencyLoan ? (emergencyLoan.installmentAmount || 0) : 0;

      const dueAmt = manualDues[m.memberId] || 0;
      const savingAmt = getMemberRecurringSavingAmount(m);
      const totalLoanAmt = microInstallmentAmt + emergencyInstallmentAmt;

      return {
        memberId: m.memberId,
        name: m.name,
        role: m.role || 'Member',
        savingsAmount: savingAmt,
        loanAmount: totalLoanAmt,
        dueAmount: dueAmt,
        microLoanDate: microLoanOpenDate,
        microLoanPrincipal: microLoan ? microLoan.loanAmount : 0,
        microLoanKista,
        microLoanAmount: microInstallmentAmt,
        emergencyLoanDate: emergencyLoanOpenDate,
        emergencyLoanPrincipal: emergencyLoan ? emergencyLoan.loanAmount : 0,
        emergencyLoanKista,
        emergencyLoanAmount: emergencyInstallmentAmt
      };
    });

    const totalSavings = sigMembers.reduce((acc, m) => acc + m.savingsAmount, 0);
    const totalLoans = sigMembers.reduce((acc, m) => acc + m.loanAmount, 0);
    const totalDue = sigMembers.reduce((acc, m) => acc + (m.dueAmount || 0), 0);

    // Save permanent Collection Sheet
    microFinanceService.addSheet({
      ...activeSheetToPrint,
      status: 'GENERATED',
      totalCollected: totalSavings + totalLoans + totalDue
    });
    setSheets(microFinanceService.getSheets());

    // Also save paired Signature Sheet only if one does not already exist for this Group + Year + Month
    const allSavedSignatureSheets = [...signatureSheets, ...microFinanceService.getSignatureSheets()];
    const existingSigForMonth = allSavedSignatureSheets.find(
      s => isSameReportCenterAndGroup(s, activeSheetToPrint) && matchesBsDateFilter(s.dateBs, targetYear, targetMonth)
    );
    let savedSheetLabel = `${targetYear} ${targetMonth}`;
    if (!existingSigForMonth) {
      const newSigSheet = microFinanceService.addSignatureSheet({
        sheetNo: `SS-${activeSheetToPrint.year}-${Date.now().toString().slice(-4)}`,
        centerId: activeSheetToPrint.centerId,
        centerName: activeSheetToPrint.centerName,
        groupId: activeSheetToPrint.groupId,
        groupName: activeSheetToPrint.groupName,
        dateBs: nepaliDateStr,
        location: center?.location || 'रतौली',
        branchName: branchInfo?.name || 'सहोडवा सेवा केन्द्र',
        branchAddress: branchInfo?.location || systemSettings?.address || 'पिपरा गाँउपालिका-६, महोत्तरी',
        members: sigMembers,
        totalMembers: sigMembers.length,
        totalSavings,
        totalLoans,
        totalDue,
        officerName: activeHrEmployees.find(e => e.id === sigFilterEmployeeId || e.fullName === sigFilterEmployeeId)?.fullName || user?.fullName || 'Chandan'
      });
      setSignatureSheets(microFinanceService.getSignatureSheets());
      savedSheetLabel = newSigSheet.sheetNo;
    }

    setIsPrintSheetModalOpen(false);
    showToast(`Collection Sheet generated successfully & saved to table! (${savedSheetLabel})`);
  };

  // Handler when user clicks "View" on the Signature Sheet filter bar
  const handleViewSignatureSheetFromFilter = async () => {
    // 1. Resolve Center
    const targetCenter = centers.find(c => c.id === sigFilterCenterId) || centers[0];
    if (!targetCenter) {
      showToast('Please select a center first.');
      return;
    }
    const targetCenterId = targetCenter.id;
    const targetCenterName = targetCenter.name;

    // 2. Resolve Group
    const availableGroupsForCenter = groups.filter(g => g.centerId === targetCenterId);
    const targetGroup = availableGroupsForCenter.find(g => g.id === sigFilterGroupId) || availableGroupsForCenter[0];
    const targetGroupId = targetGroup?.id || 'all';
    const targetGroupName = targetGroup?.name || 'All Groups in Center';

    // 3. Resolve Date
    const yr = sigFilterYear && sigFilterYear !== 'ALL' ? sigFilterYear : currentBsDate.year;
    const mo = sigFilterMonth && sigFilterMonth !== 'ALL' ? sigFilterMonth : currentBsDate.month;
    const dy = sigFilterDay && sigFilterDay !== 'ALL' ? sigFilterDay : currentBsDate.day;
    const nepMonth = nepaliMonthMapNp[mo] || mo;
    const nepYear = toNepaliDigits(yr);
    const nepDay = toNepaliDigits(dy);
    const nepaliDateStr = `${nepYear} ${nepMonth} ${nepDay}`;
    const targetDateBs = buildBsDateFromParts(yr, mo, dy);

    // 4. Resolve Employee from HR Management
    const selectedHrEmp = activeHrEmployees.find(e => e.id === sigFilterEmployeeId || e.fullName === sigFilterEmployeeId);
    const officerName = selectedHrEmp?.fullName || (sigFilterEmployeeId && sigFilterEmployeeId !== 'ALL' ? sigFilterEmployeeId : user?.fullName || 'Chandan');

    // 5. Check if already saved in signatureSheets (preserve id/sheetNo while recalculating live non-closed accounts)
    const existing = signatureSheets.find(s =>
      (s.groupId === targetGroupId || s.groupName === targetGroupName) &&
      matchesBsDateFilter(s.dateBs, yr, mo)
    );

    // 6. Dynamically build signature sheet with group members + live non-closed savings & loans
    setIsLoadingSignatureSheet(true);
    let dateAwareLoans: MFLoanRecord[] = loans.filter(l => getEffectiveLoanStatus(l) !== 'CLOSED');
    let freshSavingsPool: MFSavingsRecord[] = savings;
    try {
      const [fetchedLoans, fetchedSavings] = await Promise.all([
        microFinanceService.fetchLoansForReportDate(targetDateBs),
        microFinanceService.fetchSavingsFromSupabase().catch(() => null)
      ]);
      dateAwareLoans = fetchedLoans.filter(l => getEffectiveLoanStatus(l) !== 'CLOSED');
      if (fetchedSavings) {
        freshSavingsPool = fetchedSavings;
        setSavings(fetchedSavings);
      }
      setLoans(microFinanceService.getLoans());
    } finally {
      setIsLoadingSignatureSheet(false);
    }

    const groupMembers = members.filter(m => (!targetGroupId || targetGroupId === 'all')
      ? (m.centerId === targetCenterId || m.centerName === targetCenterName)
      : (m.samuhId === targetGroupId || m.samuhName === targetGroupName));
    const branchInfo =
      findMatchingBranch(targetCenter?.branch, adminBranches.length > 0 ? adminBranches : availableBranches) ||
      loggedInBranchObj ||
      availableBranches[0];

    const membersToUse = sortByNameAZ(groupMembers);

    const sigMembers: MFSignatureSheetMember[] = membersToUse.map(m => {
      const memLoans = dateAwareLoans.filter(l =>
        doesLoanBelongToMember(l, m) &&
        isLoanActiveOnBsDate(l, targetDateBs)
      );
      const { microLoan, emergencyLoan } = splitMemberLoansByCategory(memLoans);
      const microInstallmentAmt = microLoan ? (microLoan.installmentAmount || 0) : 0;
      const emergencyInstallmentAmt = emergencyLoan ? (emergencyLoan.installmentAmount || 0) : 0;
      const totalLoanAmt = microInstallmentAmt + emergencyInstallmentAmt;
      const savingAmt = getMemberRecurringSavingAmount(m, freshSavingsPool);

      return {
        memberId: m.memberId,
        name: m.name,
        role: m.role || 'Member',
        savingsAmount: savingAmt,
        loanAmount: totalLoanAmt,
        dueAmount: manualDues[m.memberId] || 0,
        microLoanDate: microLoan ? (microLoan.loanDateBs || microLoan.loanDate) : '-',
        microLoanPrincipal: microLoan ? microLoan.loanAmount : 0,
        microLoanKista: microLoan ? calculateBsKistaNumber(microLoan.loanDateBs || microLoan.loanDate, yr, mo) : 0,
        microLoanAmount: microInstallmentAmt,
        emergencyLoanDate: emergencyLoan ? (emergencyLoan.loanDateBs || emergencyLoan.loanDate) : '-',
        emergencyLoanPrincipal: emergencyLoan ? emergencyLoan.loanAmount : 0,
        emergencyLoanKista: emergencyLoan ? calculateBsKistaNumber(emergencyLoan.loanDateBs || emergencyLoan.loanDate, yr, mo) : 0,
        emergencyLoanAmount: emergencyInstallmentAmt
      };
    });

    const previewSheet: MFSignatureSheet = {
      id: existing?.id || `preview-${Date.now()}`,
      sheetNo: existing?.sheetNo || `SS-${yr}-${Date.now().toString().slice(-4)}`,
      centerId: targetCenterId,
      centerName: targetCenterName,
      groupId: targetGroupId,
      groupName: targetGroupName,
      dateBs: existing?.dateBs || nepaliDateStr,
      location: targetCenter?.location || existing?.location || 'सहोडवा, महोत्तरी',
      branchName: branchInfo?.name || existing?.branchName || 'सहोडवा सेवा केन्द्र',
      branchAddress: branchInfo?.location || systemSettings?.address || existing?.branchAddress || 'पिपरा गाँउपालिका-६, महोत्तरी',
      members: sigMembers,
      totalMembers: sigMembers.length,
      totalSavings: sigMembers.reduce((a, b) => a + b.savingsAmount, 0),
      totalLoans: sigMembers.reduce((a, b) => a + b.loanAmount, 0),
      totalDue: sigMembers.reduce((a, b) => a + (b.dueAmount || 0), 0),
      officerName: officerName || existing?.officerName || 'Chandan',
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    setSignatureSheetModalMode('preview');
    setSelectedSignatureSheetToPrint(previewSheet);
    setIsSignatureModalOpen(true);
  };

  // Handler when user clicks "Generate Sheet" in the Signature Sheet preview modal
  // Saves the sheet permanently into the Signature Sheets records table (once per Group + Year + Month)!
  const handleSaveAndGenerateSignatureSheet = () => {
    if (!selectedSignatureSheetToPrint) return;
    if (!canEditSignatureReport) {
      showToast('Permission denied: You do not have permission to generate signature sheets.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(selectedSignatureSheetToPrint.dateBs, systemSettings || authSettings)) {
      alert(getBackDateBlockedMessage(selectedSignatureSheetToPrint.dateBs));
      return;
    }

    const { year: targetYear, month: targetMonth } = extractReportBsYearMonth(
      selectedSignatureSheetToPrint.dateBs,
      sigFilterYear,
      sigFilterMonth
    );
    const allSavedSignatureSheets = [...signatureSheets, ...microFinanceService.getSignatureSheets()];
    const existingSigForMonth = allSavedSignatureSheets.find(
      s =>
        isSameReportCenterAndGroup(s, selectedSignatureSheetToPrint) &&
        matchesBsDateFilter(s.dateBs, targetYear, targetMonth)
    );

    if (existingSigForMonth) {
      setAlreadyGeneratedNotice({
        reportName: 'Signature Sheet',
        groupName: selectedSignatureSheetToPrint.groupName || existingSigForMonth.groupName,
        periodLabel: `${targetYear} ${targetMonth}`,
        existingDetail: `Sheet No: ${existingSigForMonth.sheetNo} (${existingSigForMonth.dateBs})`
      });
      return;
    }

    const savedSheet = microFinanceService.addSignatureSheet({
      sheetNo:
        selectedSignatureSheetToPrint.sheetNo.startsWith('SS-') && !selectedSignatureSheetToPrint.sheetNo.includes('preview')
          ? selectedSignatureSheetToPrint.sheetNo
          : `SS-${targetYear}-${Date.now().toString().slice(-4)}`,
      centerId: selectedSignatureSheetToPrint.centerId,
      centerName: selectedSignatureSheetToPrint.centerName,
      groupId: selectedSignatureSheetToPrint.groupId,
      groupName: selectedSignatureSheetToPrint.groupName,
      dateBs: selectedSignatureSheetToPrint.dateBs,
      location: selectedSignatureSheetToPrint.location,
      branchName: selectedSignatureSheetToPrint.branchName,
      branchAddress: selectedSignatureSheetToPrint.branchAddress,
      members: selectedSignatureSheetToPrint.members,
      totalMembers: selectedSignatureSheetToPrint.totalMembers,
      totalSavings: selectedSignatureSheetToPrint.totalSavings,
      totalLoans: selectedSignatureSheetToPrint.totalLoans,
      totalDue: selectedSignatureSheetToPrint.totalDue,
      officerName: selectedSignatureSheetToPrint.officerName
    });
    setSignatureSheets(microFinanceService.getSignatureSheets());

    // Set history filters so the saved sheet is immediately visible in the table
    if (sigFilterYear && sigFilterYear !== 'ALL') {
      setSigHistoryYear(sigFilterYear);
    } else {
      setSigHistoryYear('ALL');
    }
    if (sigFilterMonth && sigFilterMonth !== 'ALL') {
      setSigHistoryMonth(sigFilterMonth);
    } else {
      setSigHistoryMonth('ALL');
    }

    handlePrintElement('printable-signature-sheet');
    setIsSignatureModalOpen(false);
    showToast(`Signature Sheet (${savedSheet.sheetNo}) generated & saved permanently to records!`);
  };

  const handleConfirmDeleteSignatureSheet = () => {
    if (!selectedSignatureSheetToDelete) return;
    if (!canDeleteSignatureReport) {
      showToast('Permission denied: You do not have permission to delete signature sheets.');
      setIsDeleteSignatureModalOpen(false);
      setSelectedSignatureSheetToDelete(null);
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const updated = microFinanceService.deleteSignatureSheet(selectedSignatureSheetToDelete.id);
    setSignatureSheets(updated);
    setIsDeleteSignatureModalOpen(false);
    setSelectedSignatureSheetToDelete(null);
    showToast('Signature Sheet deleted successfully');
  };

  return (
    <div className="space-y-2.5">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[10000] bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar Header with Sub-Menus */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide pb-0.5 md:pb-0">
          <div className="flex items-center gap-1 shrink-0">
            {/* 1. Dashboard */}
            {canViewDashboard && (
              <button
                type="button"
                onClick={() => handleSelectSubMenuTab('dashboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#00593B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            )}

            {/* 2. Centers */}
            {canViewCenters && (
              <button
                type="button"
                onClick={() => handleSelectSubMenuTab('centers')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'centers'
                    ? 'bg-[#00593B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Centers</span>
              </button>
            )}

            {/* 3. Groups */}
            {canViewGroups && (
              <button
                type="button"
                onClick={() => handleSelectSubMenuTab('groups')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'groups'
                    ? 'bg-[#00593B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Groups</span>
              </button>
            )}

            {/* 4. Members */}
            {canViewMembers && (
              <button
                type="button"
                onClick={() => handleSelectSubMenuTab('members')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'members'
                    ? 'bg-[#00593B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Members</span>
              </button>
            )}

            {/* 5. Saving */}
            {canViewSaving && (
              <button
                type="button"
                onClick={() => handleSelectSubMenuTab('saving')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'saving'
                    ? 'bg-[#00593B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <PiggyBank className="w-4 h-4" />
                <span>Saving</span>
              </button>
            )}

            {/* 6. Loan */}
            {canViewLoan && (
              <button
                type="button"
                onClick={() => handleSelectSubMenuTab('loan')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'loan'
                    ? 'bg-[#00593B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <HandCoins className="w-4 h-4" />
                <span>Loan</span>
              </button>
            )}

            {/* 7. Reports */}
            {canViewReports && (
              <button
                type="button"
                onClick={() => handleSelectSubMenuTab('reports')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-[#00593B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Reports</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canSwitchBranchView ? (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                <Building2 className="w-3.5 h-3.5 text-[#00593B] shrink-0" />
                <select
                  value={superAdminBranchFilter}
                  onChange={e => {
                    setSuperAdminBranchFilter(e.target.value);
                    clearAllSubMenuSearchFilters();
                    setReportCenterId('');
                    setReportGroupId('');
                    setSigFilterCenterId('');
                    setSigFilterGroupId('');
                  }}
                  aria-label="Filter Micro-Finance by Branch"
                  className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-hidden cursor-pointer pr-1"
                >
                  <option value="ALL">
                    {hasAllBranchesAccess ? 'All Branches' : `All Assigned (${selectableBranches.length})`}
                  </option>
                  {selectableBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-[#00593B] rounded-xl px-2.5 py-1 text-[11px] font-bold"
                title="Logged-in Branch Scope"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[170px]">{defaultBranchName}</span>
              </div>
            )}
            <button
              type="button"
              onClick={reloadData}
              className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MENU CONTENT SECTIONS */}

      {/* ============================================================== */}
      {/* 1. DASHBOARD OVERVIEW (Operational Summary — No Saving Balance / Loan Portfolio) */}
      {/* ============================================================== */}
      {activeTab === 'dashboard' && canViewDashboard && (
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-4 rounded-xl border border-slate-200">
            <div className="space-y-0.5">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Micro-Finance Overview</h2>
              <p className="text-xs text-slate-500">
                <span className="font-mono tabular-nums text-slate-700">
                  {currentBsDate.year} {currentBsDate.month} {currentBsDate.day}
                </span>
                {' · '}
                <span className="font-mono tabular-nums">{dashboardStats.activeCenters}</span> active centers
                {dashboardStats.todayMeetingCentersCount > 0 && (
                  <>
                    {' · '}
                    <span className="font-semibold text-[#00593B]">
                      <span className="font-mono tabular-nums">{dashboardStats.todayMeetingCentersCount}</span> scheduled today
                    </span>
                  </>
                )}
              </p>
            </div>

          </div>

          {/* Row 1: 6 Operational KPI Cards (Pure Counts & Statuses — Zero Saving Balance / Loan Portfolio) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Centers */}
            <button
              type="button"
              disabled={!canViewCenters}
              onClick={() => canViewCenters && setActiveTab('centers')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 disabled:hover:border-slate-200 text-left transition-colors cursor-pointer disabled:cursor-default flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Centers</span>
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {dashboardStats.totalCenters}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">{dashboardStats.activeCenters}</span> active
                  {dashboardStats.inactiveCenters > 0 && (
                    <>
                      {' · '}
                      <span className="font-mono tabular-nums">{dashboardStats.inactiveCenters}</span> inactive
                    </>
                  )}
                </div>
              </div>
            </button>

            {/* 2. Groups (Samuh) */}
            <button
              type="button"
              disabled={!canViewGroups}
              onClick={() => canViewGroups && setActiveTab('groups')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 disabled:hover:border-slate-200 text-left transition-colors cursor-pointer disabled:cursor-default flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Groups</span>
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {dashboardStats.totalGroups}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">{dashboardStats.activeSamuhs}</span> active
                  {dashboardStats.inactiveSamuhs > 0 && (
                    <>
                      {' · '}
                      <span className="font-mono tabular-nums">{dashboardStats.inactiveSamuhs}</span> inactive
                    </>
                  )}
                </div>
              </div>
            </button>

            {/* 3. Members */}
            <button
              type="button"
              disabled={!canViewMembers}
              onClick={() => canViewMembers && setActiveTab('members')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 disabled:hover:border-slate-200 text-left transition-colors cursor-pointer disabled:cursor-default flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Members</span>
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {dashboardStats.totalMembers}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">{dashboardStats.activeMembers}</span> active
                  {' · '}
                  <span className="font-mono tabular-nums text-slate-600">{dashboardStats.inactiveMembers}</span> inactive
                </div>
              </div>
            </button>

            {/* 4. Saving Accounts (Count Only — No Balance) */}
            <button
              type="button"
              disabled={!canViewSaving}
              onClick={() => canViewSaving && setActiveTab('saving')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 disabled:hover:border-slate-200 text-left transition-colors cursor-pointer disabled:cursor-default flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Saving Accounts</span>
                <PiggyBank className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {dashboardStats.totalSavingAccounts}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">{dashboardStats.activeSavingAccounts}</span> active
                  {dashboardStats.maturedSavingAccounts > 0 ? (
                    <>
                      {' · '}
                      <span className="font-mono tabular-nums font-semibold text-amber-600">{dashboardStats.maturedSavingAccounts}</span> matured
                    </>
                  ) : (
                    <>
                      {' · '}
                      <span className="font-mono tabular-nums text-slate-600">{dashboardStats.closedSavingAccounts}</span> closed
                    </>
                  )}
                </div>
              </div>
            </button>

            {/* 5. Loan Accounts (Count Only — No Portfolio Amount) */}
            <button
              type="button"
              disabled={!canViewLoan}
              onClick={() => canViewLoan && setActiveTab('loan')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 disabled:hover:border-slate-200 text-left transition-colors cursor-pointer disabled:cursor-default flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Loan Accounts</span>
                <HandCoins className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {dashboardStats.totalLoanAccounts}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">{dashboardStats.activeLoansCount}</span> active
                  {' · '}
                  <span className="font-mono tabular-nums font-semibold text-amber-700">{dashboardStats.maturedLoansCount}</span> matured
                </div>
              </div>
            </button>

            {/* 6. Reports & ID Cards */}
            <button
              type="button"
              disabled={!canViewReports}
              onClick={() => canViewReports && setActiveTab('reports')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 disabled:hover:border-slate-200 text-left transition-colors cursor-pointer disabled:cursor-default flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Reports &amp; IDs</span>
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {dashboardStats.totalReportsCount}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  <span className="font-mono tabular-nums font-semibold text-[#00593B]">{dashboardStats.idCardReadyCount}</span> IDs ready
                </div>
              </div>
            </button>
          </div>

          {/* Row 2: Operational Analytics (Center-wise Membership & Account Counts + Loan Accounts Status) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            {/* Left (2/3): Center-wise Members, Saving Accounts & Loan Accounts (Counts Only) */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Center-wise Members &amp; Accounts</h3>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#00593B] inline-block" />
                    Active Members
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                    Saving A/Cs
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                    Loan A/Cs
                  </span>
                </div>
              </div>

              {centerAnalytics.length > 0 ? (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={centerAnalytics} barGap={3}>
                      <XAxis dataKey="shortName" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          boxShadow: 'none'
                        }}
                        formatter={(val: number | string | undefined, name: string | undefined) => [
                          `${Number(val) || 0}`,
                          name || ''
                        ]}
                      />
                      <Bar dataKey="activeMembersCount" name="Active Members" fill="#00593B" radius={[3, 3, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="activeSavingsCount" name="Active Saving A/Cs" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="openLoansCount" name="Open Loan A/Cs" fill="#D97706" radius={[3, 3, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-60 flex flex-col items-center justify-center text-center gap-2 border border-dashed border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">No centers created yet to compare membership and account counts.</p>
                  {canViewCenters && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('centers')}
                      className="text-xs font-semibold text-[#00593B] hover:underline cursor-pointer"
                    >
                      Add First Center
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right (1/3): Loan Accounts Status & Operational Health */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Loan Accounts Status</h3>
                </div>
              </div>

              <div className="relative h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={loanStatusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {loanStatusChartData.map((entry, index) => (
                        <Cell key={`loan-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        boxShadow: 'none'
                      }}
                      formatter={(v: number | string | undefined, name: string | undefined) => [`${v} accounts`, name || 'Status']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {dashboardStats.totalLoanAccounts}
                  </span>
                  <span className="text-[11px] text-slate-500">Accounts</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                <div>
                  <div className="text-sm font-bold font-mono tabular-nums text-[#00593B]">
                    {dashboardStats.activeLoansCount}
                  </div>
                  <div className="text-[11px] text-slate-500">Active</div>
                </div>
                <div className="border-x border-slate-100">
                  <div className="text-sm font-bold font-mono tabular-nums text-amber-700">
                    {dashboardStats.maturedLoansCount}
                  </div>
                  <div className="text-[11px] text-slate-500">Matured</div>
                </div>
                <div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-600">
                    {dashboardStats.closedLoansCount}
                  </div>
                  <div className="text-[11px] text-slate-500">Closed</div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>ID Photo Coverage</span>
                <span className="font-mono tabular-nums font-semibold text-slate-700">
                  {dashboardStats.membersWithPhotoCount} / {dashboardStats.totalMembers}
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: Centers Directory Summary (2/3) + Reports, ID Cards & Meeting Schedule Hub (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            {/* Centers & Groups Operational Summary Table (Zero NPR Columns) */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Centers &amp; Groups Summary</h3>
                  <p className="text-xs text-slate-500">Sorted ascending by meeting day</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={dashboardCenterSearch}
                      onChange={e => setDashboardCenterSearch(e.target.value)}
                      placeholder="Filter centers..."
                      className="pl-8 pr-2.5 py-1.5 w-44 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#00593B]"
                    />
                  </div>
                  {canViewCenters && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('centers')}
                      className="text-xs font-semibold text-[#00593B] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      View All
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 pr-3">Code</th>
                      <th className="py-2.5 px-3">Center Name</th>
                      <th className="py-2.5 px-3">Meeting Day</th>
                      <th className="py-2.5 px-3 text-right">Groups</th>
                      <th className="py-2.5 px-3 text-right">Members</th>
                      <th className="py-2.5 px-3 text-right">Saving A/Cs</th>
                      <th className="py-2.5 pl-3 text-right">Loan A/Cs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredDashboardCenters.map(row => (
                      <tr
                        key={row.id}
                        onClick={() => canViewCenters && setActiveTab('centers')}
                        className={`transition-colors ${canViewCenters ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                      >
                        <td className="py-2.5 pr-3 font-mono tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                          {row.code}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={row.isMeetingToday ? 'font-semibold text-[#00593B]' : 'text-slate-600'}>
                            {row.meetingDay || '—'}
                            {row.isMeetingToday ? ' · Today' : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium">
                          {row.groupsCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{row.activeMembersCount}</span>
                          {row.inactiveMembersCount > 0 && (
                            <span className="text-slate-400"> / {row.inactiveMembersCount}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="font-semibold text-emerald-700">{row.activeSavingsCount}</span>
                          {row.closedSavingsCount > 0 && (
                            <span className="text-slate-400"> / {row.closedSavingsCount}</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{row.activeLoansCount}</span>
                          {row.maturedLoansCount > 0 && (
                            <span className="text-amber-700"> · {row.maturedLoansCount} mat</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredDashboardCenters.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          {dashboardCenterSearch.trim()
                            ? 'No centers match your search filter.'
                            : 'No centers registered yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right (1/3): Reports & ID Card Hub + Upcoming Meetings */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Reports &amp; Documents</h3>
                    <p className="text-xs text-slate-500">All 4 Micro-Finance report modules</p>
                  </div>
                  {canViewReports && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('reports')}
                      className="text-xs font-semibold text-[#00593B] hover:underline cursor-pointer"
                    >
                      Open
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {canViewCollectionReport && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reports');
                        setReportTab('collection');
                      }}
                      className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 px-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                        <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Collection Sheet</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs text-slate-600">
                        {dashboardStats.collectionSheetsCount} sheets
                      </span>
                    </button>
                  )}

                  {canViewSignatureReport && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reports');
                        setReportTab('signature');
                      }}
                      className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 px-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                        <Printer className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Signature Sheet</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs text-slate-600">
                        {dashboardStats.signatureSheetsCount} sheets
                      </span>
                    </button>
                  )}

                  {canViewMeetingMinutes && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reports');
                        setReportTab('meeting-minutes');
                      }}
                      className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 px-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                        <FileText className="w-4 h-4 text-violet-600 shrink-0" />
                        <span>Meeting Minute</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs text-slate-600">
                        {dashboardStats.meetingMinutesCount} records
                      </span>
                    </button>
                  )}

                  {canViewIdCard && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reports');
                        setReportTab('id-card');
                      }}
                      className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 px-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                        <CreditCard className="w-4 h-4 text-[#00593B] shrink-0" />
                        <span>Member ID Card</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs text-slate-600">
                        {dashboardStats.idCardReadyCount} ready
                      </span>
                    </button>
                  )}

                  {!canViewReports && (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No report modules assigned to your role.
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Center Meeting Schedule */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Meeting Schedule</span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    Day {currentBsDate.day}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {upcomingMeetingCenters.map(c => (
                    <div key={`sched-${c.id}`} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 truncate">{c.name}</span>
                      <span
                        className={`font-mono tabular-nums shrink-0 ${
                          c.isMeetingToday ? 'font-semibold text-[#00593B]' : 'text-slate-500'
                        }`}
                      >
                        {c.isMeetingToday ? 'Today' : c.meetingDay}
                      </span>
                    </div>
                  ))}
                  {upcomingMeetingCenters.length === 0 && (
                    <div className="py-2 text-slate-400 text-xs">No scheduled centers</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Recent Operational Activity (Members, Meeting Minutes & Generated Sheets — ZERO Monetary Values) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            {/* 1. Recent Members */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#00593B]" />
                  <span>Recent Members</span>
                </h4>
                {canViewMembers && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    className="text-xs font-semibold text-[#00593B] hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {members.slice(0, 5).map(m => {
                  const isActive = getEffectiveMemberStatus(m.status) === 'ACTIVE';
                  return (
                    <div key={m.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{m.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {m.samuhName || m.centerName || 'Unassigned'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[11px] font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </div>
                        <div className="font-mono tabular-nums text-[10px] text-slate-400">{m.memberId}</div>
                      </div>
                    </div>
                  );
                })}
                {members.length === 0 && (
                  <div className="py-6 text-center text-slate-400 text-xs">No member records yet</div>
                )}
              </div>
            </div>

            {/* 2. Recent Meeting Minutes */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-600" />
                  <span>Recent Meeting Minutes</span>
                </h4>
                {canViewMeetingMinutes && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('reports');
                      setReportTab('meeting-minutes');
                    }}
                    className="text-xs font-semibold text-[#00593B] hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {meetingMinutes.slice(0, 5).map(m => (
                  <div key={m.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{m.groupName}</div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 truncate">
                        {m.meetingDateBs || '—'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-xs font-semibold text-slate-700">
                        {m.presentCount}/{m.totalMembersCount}
                      </div>
                      <div className="text-[10px] text-slate-400">Present</div>
                    </div>
                  </div>
                ))}
                {meetingMinutes.length === 0 && (
                  <div className="py-6 text-center text-slate-400 text-xs">No meeting minutes recorded</div>
                )}
              </div>
            </div>

            {/* 3. Recent Collection & Signature Sheets */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                  <span>Recent Generated Sheets</span>
                </h4>
                {(canViewCollectionReport || canViewSignatureReport) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('reports');
                      setReportTab(canViewCollectionReport ? 'collection' : 'signature');
                    }}
                    className="text-xs font-semibold text-[#00593B] hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {recentGeneratedSheets.map(item => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{item.groupName}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.kind} Sheet
                        {item.dateLabel ? ` · ${item.dateLabel}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-xs font-semibold text-slate-700">
                        {item.memberCount}
                      </div>
                      <div className="text-[10px] text-slate-400">Members</div>
                    </div>
                  </div>
                ))}
                {recentGeneratedSheets.length === 0 && (
                  <div className="py-6 text-center text-slate-400 text-xs">No sheets generated yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CENTERS MANAGEMENT (Matching image_fd131ba8.png) */}
      {/* ============================================================== */}
      {activeTab === 'centers' && canViewCenters && (
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">Center Management</h2>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search centers..."
                  value={centerSearch}
                  onChange={e => setCenterSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 w-52 sm:w-64"
                />
              </div>

              {canEditCenters && (
                <>
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={() => { setBulkType('Centers'); setIsBulkModalOpen(true); }}
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Bulk Upload Centers'}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Bulk</span>
                  </button>

                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleOpenAddCenter}
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Add Center'}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Center</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">CODE</th>
                    <th className="py-2 px-3">CENTER NAME</th>
                    <th className="py-2 px-3">BRANCH</th>
                    <th className="py-2 px-3">MEETING DATE</th>
                    <th className="py-2 px-3 text-center">STATUS</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredCenters.map(center => (
                    <tr key={center.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black font-mono bg-blue-50 text-blue-700 border border-blue-200">
                          {center.code}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-extrabold text-slate-900 text-[13px]">{center.name}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{center.branch}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{center.meetingDay}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {center.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCenterForGroupsList(center)}
                            className="p-1 text-slate-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                            title="View Groups in this Center"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEditCenters && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleEditCenter(center)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Center'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDeleteCenters && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleDeleteCenter(center.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Center'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredCenters.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No centers found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. GROUP MANAGEMENT (Matching image_e80ae620.png) */}
      {/* ============================================================== */}
      {activeTab === 'groups' && canViewGroups && (
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">Group Management</h2>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search groups..."
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 w-52 sm:w-64"
                />
              </div>

              {canEditGroups && (
                <>
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={() => { setBulkType('Groups'); setIsBulkModalOpen(true); }}
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Bulk Upload Groups'}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Bulk</span>
                  </button>

                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleOpenAddGroup}
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Add Group'}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Group</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">CODE</th>
                    <th className="py-2 px-3">GROUP NAME</th>
                    <th className="py-2 px-3">CENTER</th>
                    <th className="py-2 px-3">PLACE</th>
                    <th className="py-2 px-3">MEMBERS</th>
                    <th className="py-2 px-3">MEETING DATE</th>
                    <th className="py-2 px-3 text-center">STATUS</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredGroups.map(group => (
                    <tr key={group.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black font-mono bg-amber-50 text-amber-700 border border-amber-200">
                          {group.code}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-extrabold text-slate-900 text-[13px]">{group.name}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{group.centerName || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {group.place || 'N/A'}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => setSelectedGroupForMembersList(group)}
                          title="View members in this group"
                          className="text-blue-600 font-bold inline-flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{group.membersCount} Members</span>
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{group.meetingDay}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {group.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEditGroups && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleEditGroup(group)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Group'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDeleteGroups && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleDeleteGroup(group.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Group'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {!canEditGroups && !canDeleteGroups && (
                            <span className="text-[10px] font-semibold text-slate-400">View Only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No groups found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MEMBERS (Matching image_9a145ab7.png) */}
      {/* ============================================================== */}
      {activeTab === 'members' && canViewMembers && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Members</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                  MICROFINANCE SYSTEM
                </span>
              </div>
            </div>

            {/* Active / Inactive Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
              {([
                { key: 'ACTIVE', label: 'Active', count: memberStatusCounts.active },
                { key: 'INACTIVE', label: 'Inactive', count: memberStatusCounts.inactive }
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setMemberStatusTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    memberStatusTab === tab.key
                      ? tab.key === 'INACTIVE'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                      memberStatusTab === tab.key
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            <div className="relative w-full xl:w-56 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Center -> Group -> View Filter */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <select
                value={memberCenterFilterId}
                onChange={e => {
                  setMemberCenterFilterId(e.target.value);
                  setMemberGroupFilterId('');
                }}
                aria-label="Select Center for Members"
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 min-w-[155px] flex-1 sm:flex-initial max-w-[230px]"
              >
                <option value="">All Centers</option>
                {sortedCentersByMeetingDay.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={memberGroupFilterId}
                onChange={e => setMemberGroupFilterId(e.target.value)}
                aria-label="Select Group for Members"
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 min-w-[155px] flex-1 sm:flex-initial max-w-[230px]"
              >
                <option value="">All Groups</option>
                {getGroupsForCenterFilter(memberCenterFilterId).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setAppliedMemberCenterId(memberCenterFilterId);
                  setAppliedMemberGroupId(memberGroupFilterId);
                  const cName = centers.find(c => c.id === memberCenterFilterId)?.name || 'All Centers';
                  const gName = groups.find(g => g.id === memberGroupFilterId)?.name || 'All Groups';
                  showToast(`Viewing Members: ${cName} / ${gName}`);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all ${
                  memberCenterFilterId !== appliedMemberCenterId || memberGroupFilterId !== appliedMemberGroupId
                    ? 'ring-2 ring-blue-300'
                    : ''
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>

              {(appliedMemberCenterId || appliedMemberGroupId || memberCenterFilterId || memberGroupFilterId) && (
                <button
                  type="button"
                  onClick={() => {
                    setMemberCenterFilterId('');
                    setMemberGroupFilterId('');
                    setAppliedMemberCenterId('');
                    setAppliedMemberGroupId('');
                  }}
                  title="Reset Center & Group filter"
                  className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canEditMembers && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={() => { setBulkType('Members'); setIsBulkModalOpen(true); }}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Bulk Upload Members'}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Upload</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportMembersExcel}
                className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="Download Displayed Members to Excel"
              >
                <Download className="w-4 h-4" />
              </button>

              {canEditMembers && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={handleOpenAddMember}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Add Member'}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Member</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3 w-12 text-center">S.N.</th>
                    <th className="py-2 px-3">MEMBER ID</th>
                    <th className="py-2 px-3">MEMBER NAME</th>
                    <th className="py-2 px-3">BRANCH</th>
                    <th className="py-2 px-3">CENTER</th>
                    <th className="py-2 px-3">GROUP</th>
                    <th className="py-2 px-3 text-center">ROLE</th>
                    <th className="py-2 px-3 text-center">STATUS</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredMembers.map((member, idx) => {
                    const effMemberStatus = getEffectiveMemberStatus(member.status);
                    return (
                    <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700">{member.memberId}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {member.photoUrl ? (
                            <img 
                              src={member.photoUrl} 
                              alt={member.name} 
                              className="w-7 h-7 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0" 
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center shrink-0 border border-blue-200">
                              {member.name.charAt(0)}
                            </div>
                          )}
                          <div className="font-extrabold text-slate-900">{member.name}</div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{member.branch}</td>
                      <td className="py-2 px-3 text-slate-600">{member.centerName}</td>
                      <td className="py-2 px-3 text-slate-600">{member.samuhName}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          member.role === 'Leader'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : member.role === 'Secretary'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          effMemberStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {effMemberStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditMembers && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleOpenToggleMemberStatus(member)}
                              className={`p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                effMemberStatus === 'ACTIVE'
                                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={
                                isDayEnded
                                  ? 'Day Ended - Action Locked'
                                  : effMemberStatus === 'ACTIVE'
                                  ? 'Deactivate Member'
                                  : 'Activate Member'
                              }
                            >
                              {effMemberStatus === 'ACTIVE' ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenViewMember(member)}
                            className="p-1 text-slate-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                            title="View Member Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEditMembers && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleEditMember(member)}
                              className="p-1 text-slate-400 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Member'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDeleteMembers && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleDeleteMember(member.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Member'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}

                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No {memberStatusTab === 'ACTIVE' ? 'active' : 'inactive'} members found matching your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. SAVINGS MANAGEMENT (Matching image_a56aee7c.png) */}
      {/* ============================================================== */}
      {activeTab === 'saving' && canViewSaving && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <PiggyBank className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Savings Management</h2>
                <p className="text-xs text-slate-500 font-medium">Track member deposits and savings</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Active / Mature / Close Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                {([
                  { key: 'ACTIVE', label: 'Active', count: savingStatusCounts.active },
                  { key: 'MATURED', label: 'Mature', count: savingStatusCounts.matured },
                  { key: 'CLOSED', label: 'Close', count: savingStatusCounts.closed }
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSavingStatusTab(tab.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      savingStatusTab === tab.key
                        ? tab.key === 'MATURED'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : tab.key === 'CLOSED'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                        savingStatusTab === tab.key
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={reloadData}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              {canEditSaving && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={() => { setBulkType('Savings'); setIsBulkModalOpen(true); }}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Bulk Upload Savings'}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Upload</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportSavingsExcel}
                className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="Download Displayed Savings to Excel"
              >
                <Download className="w-4 h-4" />
              </button>

              {canEditSaving && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={handleOpenAddSaving}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Create Saving Account'}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#00593B] hover:bg-[#00472f] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Account</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Card: DEPOSIT HISTORY */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Card Header Filter Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider shrink-0">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>DEPOSIT HISTORY</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search member or account..."
                    value={savingSearch}
                    onChange={e => setSavingSearch(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 w-44 sm:w-48"
                  />
                </div>

                {/* Center -> Group -> View Filter */}
                <select
                  value={savingCenterFilterId}
                  onChange={e => {
                    setSavingCenterFilterId(e.target.value);
                    setSavingGroupFilterId('');
                  }}
                  aria-label="Select Center for Saving"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 max-w-[200px]"
                >
                  <option value="">All Centers</option>
                  {sortedCentersByMeetingDay.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={savingGroupFilterId}
                  onChange={e => setSavingGroupFilterId(e.target.value)}
                  aria-label="Select Group for Saving"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 max-w-[200px]"
                >
                  <option value="">All Groups</option>
                  {getGroupsForCenterFilter(savingCenterFilterId).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setAppliedSavingCenterId(savingCenterFilterId);
                    setAppliedSavingGroupId(savingGroupFilterId);
                    const cName = centers.find(c => c.id === savingCenterFilterId)?.name || 'All Centers';
                    const gName = groups.find(g => g.id === savingGroupFilterId)?.name || 'All Groups';
                    showToast(`Viewing Savings: ${cName} / ${gName}`);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all ${
                    savingCenterFilterId !== appliedSavingCenterId || savingGroupFilterId !== appliedSavingGroupId
                      ? 'ring-2 ring-blue-300'
                      : ''
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View</span>
                </button>

                {(appliedSavingCenterId || appliedSavingGroupId || savingCenterFilterId || savingGroupFilterId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSavingCenterFilterId('');
                      setSavingGroupFilterId('');
                      setAppliedSavingCenterId('');
                      setAppliedSavingGroupId('');
                    }}
                    title="Reset Center & Group filter"
                    className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3 w-12 text-center">S.N.</th>
                    <th className="py-2 px-3">MEMBER ID</th>
                    <th className="py-2 px-3">ACCOUNT NO.</th>
                    <th className="py-2 px-3">NAME</th>
                    <th className="py-2 px-3">GROUP</th>
                    <th className="py-2 px-3">OPEN DATE</th>
                    <th className="py-2 px-3">MATURITY DATE</th>
                    <th className="py-2 px-3 text-right">RECURRING AMOUNT</th>
                    <th className="py-2 px-3 text-center">STATUS</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredSavings.map((item, idx) => {
                    const effectiveStatus = getEffectiveSavingStatus(item);
                    const isOpenAccount = effectiveStatus !== 'CLOSED';
                    const maturityDateBs = resolveSavingMaturityDateBs(item);
                    const periodYears = resolveSavingPeriodYears(item);
                    return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700">{item.memberId}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800">{item.accountNo}</td>
                      <td className="py-2 px-3 font-extrabold text-slate-900">{item.name}</td>
                      <td className="py-2 px-3 text-slate-600">{item.groupName || memberLookupById.find(item.memberId, item.accountNo)?.samuhName || '-'}</td>
                      <td className="py-2 px-3 text-slate-700 font-mono font-bold whitespace-nowrap">
                        {resolveSavingOpenDateBs(item) || item.date || '2083-06-29'}
                      </td>
                      <td className="py-2 px-3 font-mono whitespace-nowrap">
                        <span className={`font-bold ${effectiveStatus === 'MATURED' ? 'text-amber-700' : 'text-slate-700'}`}>
                          {maturityDateBs || '-'}
                        </span>
                        <span className="ml-1.5 text-[10px] font-semibold text-slate-400">({periodYears}Y)</span>
                      </td>
                      <td className="py-2 px-3 text-right font-black font-mono text-emerald-700 whitespace-nowrap">
                        NPR {item.amount.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          effectiveStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : effectiveStatus === 'MATURED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {effectiveStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditSaving && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleOpenToggleSavingStatus(item)}
                              className={`p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                isOpenAccount
                                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={
                                isDayEnded
                                  ? 'Day Ended - Action Locked'
                                  : isOpenAccount
                                  ? 'Deactivate / Close Saving Account'
                                  : 'Activate Saving Account'
                              }
                            >
                              {isOpenAccount ? (
                                <Ban className="w-4 h-4" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenViewSaving(item)}
                            className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View Saving Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEditSaving && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleOpenEditSaving(item)}
                              className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Saving'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDeleteSaving && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleOpenDeleteSaving(item)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}

                  {filteredSavings.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                            <Search className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-800">
                            No {savingStatusTab === 'ACTIVE' ? 'active' : savingStatusTab === 'MATURED' ? 'matured' : 'closed'} saving accounts found.
                          </p>
                          <p className="text-xs text-slate-400">Try adjusting your filters or search term.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. LOAN PORTFOLIO (Matching image_f59f8220.png) */}
      {/* ============================================================== */}
      {activeTab === 'loan' && canViewLoan && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                <HandCoins className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Loan Portfolio</h2>
                <p className="text-xs text-slate-500 font-medium">Manage and track member loans</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status pills: Active, Mature, Close (Close loads on-demand from Supabase) */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                {([
                  { key: 'ACTIVE', label: 'Active' },
                  { key: 'MATURED', label: 'Mature' },
                  { key: 'CLOSED', label: 'Close' }
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => void handleSelectLoanStatusTab(tab.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      loanStatusTab === tab.key
                        ? tab.key === 'MATURED'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : tab.key === 'CLOSED'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={reloadData}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              {canEditLoan && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={() => { setBulkType('Loans'); setIsBulkModalOpen(true); }}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Bulk Upload Loans'}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Upload</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportLoansExcel}
                className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="Download Displayed Loans to Excel"
              >
                <Download className="w-4 h-4" />
              </button>

              {canEditLoan && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={handleOpenIssueLoan}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Issue New Loan'}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Issue New Loan</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Card: LOAN RECORDS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Card Filter Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider shrink-0">
                <Clock className="w-4 h-4 text-orange-600" />
                <span>LOAN RECORDS</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search loans..."
                    value={loanSearch}
                    onChange={e => setLoanSearch(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500 w-44 sm:w-48"
                  />
                </div>

                {/* Center -> Group -> View Filter */}
                <select
                  value={loanCenterFilterId}
                  onChange={e => {
                    setLoanCenterFilterId(e.target.value);
                    setLoanGroupFilterId('');
                  }}
                  aria-label="Select Center for Loans"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500 max-w-[200px]"
                >
                  <option value="">All Centers</option>
                  {sortedCentersByMeetingDay.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={loanGroupFilterId}
                  onChange={e => setLoanGroupFilterId(e.target.value)}
                  aria-label="Select Group for Loans"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500 max-w-[200px]"
                >
                  <option value="">All Groups</option>
                  {getGroupsForCenterFilter(loanCenterFilterId).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setAppliedLoanCenterId(loanCenterFilterId);
                    setAppliedLoanGroupId(loanGroupFilterId);
                    const cName = centers.find(c => c.id === loanCenterFilterId)?.name || 'All Centers';
                    const gName = groups.find(g => g.id === loanGroupFilterId)?.name || 'All Groups';
                    showToast(`Viewing Loans: ${cName} / ${gName}`);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all ${
                    loanCenterFilterId !== appliedLoanCenterId || loanGroupFilterId !== appliedLoanGroupId
                      ? 'ring-2 ring-blue-300'
                      : ''
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View</span>
                </button>

                {(appliedLoanCenterId || appliedLoanGroupId || loanCenterFilterId || loanGroupFilterId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLoanCenterFilterId('');
                      setLoanGroupFilterId('');
                      setAppliedLoanCenterId('');
                      setAppliedLoanGroupId('');
                    }}
                    title="Reset Center & Group filter"
                    className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3 w-12 text-center">S.N.</th>
                    <th className="py-2 px-3">MEMBER ID</th>
                    <th className="py-2 px-3">ACCOUNT NO.</th>
                    <th className="py-2 px-3">NAME</th>
                    <th className="py-2 px-3">CENTER / GROUP</th>
                    <th className="py-2 px-3">LOAN DATE</th>
                    <th className="py-2 px-3 text-right">LOAN</th>
                    <th className="py-2 px-3 text-center">PERIOD</th>
                    <th className="py-2 px-3 text-right">INSTALLMENT</th>
                    <th className="py-2 px-3 text-center">STATUS</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loanStatusTab === 'CLOSED' && isLoadingClosedLoans ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500">
                        <div className="inline-flex items-center gap-2 font-bold text-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                          <span>Loading archived closed loans from Supabase...</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan, idx) => {
                      const effStatus = getEffectiveLoanStatus(loan);
                      return (
                        <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-blue-700">{loan.memberId}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-800">{loan.accountNo}</td>
                          <td className="py-2 px-3">
                            <div className="font-extrabold text-slate-900">{loan.name}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            <div className="font-medium text-slate-800">{loan.centerName}</div>
                            {loan.groupName && <div className="text-[10px] text-slate-400 font-semibold">{loan.groupName}</div>}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono">
                            <div>{loan.loanDateBs || loan.loanDate}</div>
                            {effStatus === 'CLOSED' && (loan.closedDateBs || loan.closedDate) && (
                              <div className="text-[10px] text-slate-400">
                                Closed: {loan.closedDateBs || loan.closedDate}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-black font-mono text-slate-900">
                            NPR {loan.loanAmount.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                            {loan.totalInstallments || 12} Months
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            NPR {loan.installmentAmount.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              effStatus === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : effStatus === 'MATURED'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {effStatus === 'MATURED' ? 'Mature' : effStatus === 'CLOSED' ? 'Closed' : 'Active'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Close Loan Action: 'Close Loan' on Mature loans, 'LC' on Active loans */}
                              {effStatus !== 'CLOSED' && canEditLoan && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenCloseLoan(loan)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                                    effStatus === 'MATURED'
                                      ? 'px-2.5 bg-amber-500 text-white hover:bg-amber-600 shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-600 hover:text-white border border-slate-200'
                                  }`}
                                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Loan Close & Archive to Supabase'}
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>{effStatus === 'MATURED' ? 'Close Loan' : 'LC'}</span>
                                </button>
                              )}
                              {/* View Action */}
                              <button
                                type="button"
                                onClick={() => handleOpenViewLoan(loan)}
                                className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="View Loan Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {/* Edit Action */}
                              {canEditLoan && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenEditLoan(loan)}
                                  className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Loan'}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {/* Delete Action */}
                              {canDeleteLoan && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenDeleteLoan(loan)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Loan'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {!(loanStatusTab === 'CLOSED' && isLoadingClosedLoans) && filteredLoans.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                            <Search className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-800">
                            No {loanStatusTab === 'ACTIVE' ? 'Active' : loanStatusTab === 'MATURED' ? 'Mature' : 'Closed'} loans found.
                          </p>
                          <p className="text-xs text-slate-400">
                            {loanStatusTab === 'MATURED'
                              ? 'Loans appear here automatically when their maturity date arrives, and can be closed with one click.'
                              : loanStatusTab === 'CLOSED'
                              ? 'Closed loans are archived in Supabase and loaded here only when viewing the Close tab.'
                              : 'Try adjusting your filters or issue a new loan.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. REPORTS (Matching image_ff5945f2.png) */}
      {/* ============================================================== */}
      {activeTab === 'reports' && canViewReports && (
        <div className="space-y-2.5">
          {/* Top Switcher Tabs: Collection Sheet vs Signature Sheet vs Deposit Sheet vs Meeting Minute vs ID Card */}
          <div className="flex items-center gap-2 flex-wrap">
            {canViewCollectionReport && (
              <button
                type="button"
                onClick={() => setReportTab('collection')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer border ${
                  reportTab === 'collection'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${reportTab === 'collection' ? 'text-white' : 'text-blue-600'}`} />
                <span>Collection Sheet</span>
              </button>
            )}

            {canViewSignatureReport && (
              <button
                type="button"
                onClick={() => setReportTab('signature')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer border ${
                  reportTab === 'signature'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Printer className={`w-4 h-4 ${reportTab === 'signature' ? 'text-white' : 'text-indigo-600'}`} />
                <span>Signature Sheet</span>
              </button>
            )}

            {canViewDepositSheet && (
              <button
                type="button"
                onClick={() => setReportTab('deposit')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer border ${
                  reportTab === 'deposit'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 ${reportTab === 'deposit' ? 'text-white' : 'text-emerald-600'}`} />
                <span>Deposit Sheet</span>
              </button>
            )}

            {canViewMeetingMinutes && (
              <button
                type="button"
                onClick={() => setReportTab('meeting-minutes')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer border ${
                  reportTab === 'meeting-minutes'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <FileText className={`w-4 h-4 ${reportTab === 'meeting-minutes' ? 'text-white' : 'text-teal-600'}`} />
                <span>Meeting Minute</span>
              </button>
            )}

            {canViewIdCard && (
              <button
                type="button"
                onClick={() => setReportTab('id-card')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer border ${
                  reportTab === 'id-card'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <CreditCard className={`w-4 h-4 ${reportTab === 'id-card' ? 'text-white' : 'text-blue-600'}`} />
                <span>ID Card</span>
              </button>
            )}
          </div>

          {/* TAB 1: COLLECTION SHEET */}
          {reportTab === 'collection' && canViewCollectionReport && (
            <>
              {/* Filter Card with Year, Month, Day, Center, Group, View */}
              <div className="bg-white rounded-2xl border border-slate-200 px-3 py-2.5 shadow-2xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
                  {/* YEAR */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">YEAR</label>
                    <select
                      value={reportYear}
                      onChange={e => setReportYear(e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="2081">2081</option>
                      <option value="2082">2082</option>
                      <option value="2083">2083</option>
                      <option value="2084">2084</option>
                    </select>
                  </div>

                  {/* MONTH */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">MONTH</label>
                    <select
                      value={reportMonth}
                      onChange={e => setReportMonth(e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      {nepaliMonthsEnglish.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* DAY */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">DAY</label>
                    <select
                      value={reportDay}
                      onChange={e => {
                        const nextDay = e.target.value;
                        setReportDay(nextDay);
                        const dayNum = parseInt(nextDay, 10);
                        const validForDay = centers.some(
                          c => c.id === reportCenterId && extractMeetingDayNumber(c.meetingDay) === dayNum
                        );
                        if (!validForDay) {
                          setReportCenterId('');
                          setReportGroupId('');
                        }
                      }}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      {Array.from({ length: 32 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString()}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Center (Filtered strictly by selected DAY's meetingDay) */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">Center</label>
                    <select
                      value={reportCenterId}
                      onChange={e => {
                        setReportCenterId(e.target.value);
                        setReportGroupId('');
                      }}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="">
                        {filteredReportCenters.length > 0 ? 'Choose a center...' : `No center on Day ${reportDay}`}
                      </option>
                      {filteredReportCenters.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Group */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">Group</label>
                    <select
                      value={reportGroupId}
                      onChange={e => setReportGroupId(e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="">All Groups...</option>
                      {groups
                        .filter(g =>
                          reportCenterId
                            ? g.centerId === reportCenterId
                            : filteredReportCenters.some(c => c.id === g.centerId)
                        )
                        .map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* VIEW BUTTON (Date-aware: includes closed loans if closed after selected date) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => void handleViewCollectionSheet()}
                      disabled={isLoadingCollectionSheet}
                      className="w-full py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                    >
                      {isLoadingCollectionSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{isLoadingCollectionSheet ? 'Loading...' : 'View'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Results Card: Collection Sheet Records with Right-side Year & Month Dropdowns */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-3.5 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      <span>Collection Sheet Records</span>
                    </h3>
                  </div>

                  {/* Right side Year & Month filter + View button */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400">Year:</label>
                      <select
                        value={sheetHistoryYear}
                        onChange={e => setSheetHistoryYear(e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                      >
                        <option value="ALL">All Years</option>
                        <option value="2081">2081</option>
                        <option value="2082">2082</option>
                        <option value="2083">2083</option>
                        <option value="2084">2084</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400">Month:</label>
                      <select
                        value={sheetHistoryMonth}
                        onChange={e => setSheetHistoryMonth(e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                      >
                        <option value="ALL">All Months</option>
                        {nepaliMonthsEnglish.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast(`Showing collection sheets for Year: ${sheetHistoryYear}, Month: ${sheetHistoryMonth}`)}
                      className="flex items-center gap-1 px-3 py-1 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#0b1329] text-white font-black uppercase text-[10px] tracking-wider">
                        <th className="py-2 px-3 w-12 text-center whitespace-nowrap">S.N.</th>
                        <th className="py-2 px-3 whitespace-nowrap">CENTER NAME</th>
                        <th className="py-2 px-3 whitespace-nowrap">GROUP NAME</th>
                        <th className="py-2 px-3 whitespace-nowrap">DATE</th>
                        <th className="py-2 px-3 text-center whitespace-nowrap">STATUS</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {(() => {
                        const filteredCollectionSheets = sheets.filter(sheet =>
                          matchesBsDateFilter(sheet.dateDisplay, sheetHistoryYear, sheetHistoryMonth, sheet.year, sheet.month)
                        );

                        if (filteredCollectionSheets.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-8 text-center">
                                <div className="flex flex-col items-center justify-center space-y-1.5">
                                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-blue-400" />
                                  </div>
                                  <p className="text-sm font-extrabold text-slate-800">No collection sheets found for selected period.</p>
                                  <p className="text-xs text-slate-400">Click &quot;View&quot; above to view and generate a new collection sheet.</p>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return filteredCollectionSheets.map((sheet, idx) => (
                          <tr key={sheet.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-1.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-1.5 px-3 font-bold text-slate-900">{sheet.centerName}</td>
                            <td className="py-1.5 px-3 text-slate-600">{sheet.groupName}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-600 whitespace-nowrap">{sheet.dateDisplay}</td>
                            <td className="py-1.5 px-3 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-block ${
                                sheet.status === 'COLLECTED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {sheet.status}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCollectionSheetLoans([]);
                                    setCollectionSheetTargetBs(buildBsDateFromParts(sheet.year, sheet.month, sheet.day));
                                    setCollectionSheetModalMode('record');
                                    setActiveSheetToPrint(sheet);
                                    setIsPrintSheetModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View / Print</span>
                                </button>
                                {canDeleteCollectionReport && (
                                  <button
                                    type="button"
                                    disabled={isDayEnded}
                                    onClick={() => handleOpenDeleteSheet(sheet)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Sheet'}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: SIGNATURE SHEET (Permanent Table with Filters) */}
          {reportTab === 'signature' && canViewSignatureReport && (
            <div className="space-y-2.5">
              {/* Signature Sheet Filter Card: Compact Year, Month, Day, Center, Group, Employee, and small View button */}
              <div className="bg-white rounded-2xl border border-slate-200 px-3 py-2.5 shadow-2xs">
                <div className="flex flex-wrap items-end gap-2">
                  {/* YEAR */}
                  <div className="w-24 shrink-0">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">YEAR</label>
                    <select
                      value={sigFilterYear}
                      onChange={e => setSigFilterYear(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All</option>
                      <option value="2081">2081</option>
                      <option value="2082">2082</option>
                      <option value="2083">2083</option>
                      <option value="2084">2084</option>
                    </select>
                  </div>

                  {/* MONTH */}
                  <div className="w-28 shrink-0">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">MONTH</label>
                    <select
                      value={sigFilterMonth}
                      onChange={e => setSigFilterMonth(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All</option>
                      {nepaliMonthsEnglish.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* DAY */}
                  <div className="w-20 shrink-0">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">DAY</label>
                    <select
                      value={sigFilterDay}
                      onChange={e => {
                        const nextDay = e.target.value;
                        setSigFilterDay(nextDay);
                        if (nextDay !== 'ALL') {
                          const dayNum = parseInt(nextDay, 10);
                          const valid = centers.some(
                            c => c.id === sigFilterCenterId && extractMeetingDayNumber(c.meetingDay) === dayNum
                          );
                          if (!valid) {
                            setSigFilterCenterId('ALL');
                            setSigFilterGroupId('ALL');
                          }
                        }
                      }}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All</option>
                      {Array.from({ length: 32 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString()}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Center */}
                  <div className="flex-1 min-w-[130px]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5 truncate">Center</label>
                    <select
                      value={sigFilterCenterId}
                      onChange={e => {
                        setSigFilterCenterId(e.target.value);
                        setSigFilterGroupId('ALL');
                      }}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All Centers</option>
                      {centers
                        .filter(c => sigFilterDay === 'ALL' || extractMeetingDayNumber(c.meetingDay) === parseInt(sigFilterDay, 10))
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Group */}
                  <div className="flex-1 min-w-[130px]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5 truncate">Group</label>
                    <select
                      value={sigFilterGroupId}
                      onChange={e => setSigFilterGroupId(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All Groups</option>
                      {groups
                        .filter(g => {
                          if (sigFilterCenterId && sigFilterCenterId !== 'ALL') return g.centerId === sigFilterCenterId;
                          if (sigFilterDay === 'ALL') return true;
                          const dayNum = parseInt(sigFilterDay, 10);
                          return centers.some(c => c.id === g.centerId && extractMeetingDayNumber(c.meetingDay) === dayNum);
                        })
                        .map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* EMPLOYEE (Populated from HR Management) */}
                  <div className="flex-1 min-w-[130px]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5 truncate">EMPLOYEE</label>
                    <select
                      value={sigFilterEmployeeId}
                      onChange={e => setSigFilterEmployeeId(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All Employees</option>
                      {activeHrEmployees.map(emp => (
                        <option key={emp.id} value={emp.fullName}>
                          {emp.fullName} ({emp.employeeCode || emp.designation || 'Staff'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* VIEW BUTTON */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleViewSignatureSheetFromFilter()}
                      disabled={isLoadingSignatureSheet}
                      className="px-3.5 py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] disabled:opacity-60 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                    >
                      {isLoadingSignatureSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{isLoadingSignatureSheet ? 'Loading...' : 'View'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Table: Signature Sheets records */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-3.5 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      <span>Signature Sheets records</span>
                    </h3>
                  </div>

                  {/* Right side Year & Month filter + View button */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400">Year:</label>
                      <select
                        value={sigHistoryYear}
                        onChange={e => setSigHistoryYear(e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                      >
                        <option value="ALL">All Years</option>
                        <option value="2081">2081</option>
                        <option value="2082">2082</option>
                        <option value="2083">2083</option>
                        <option value="2084">2084</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400">Month:</label>
                      <select
                        value={sigHistoryMonth}
                        onChange={e => setSigHistoryMonth(e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                      >
                        <option value="ALL">All Months</option>
                        {nepaliMonthsEnglish.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast(`Showing records for Year: ${sigHistoryYear}, Month: ${sigHistoryMonth}`)}
                      className="flex items-center gap-1 px-3 py-1 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#0b1329] text-white font-black uppercase text-[10px] tracking-wider">
                        <th className="py-2 px-3 w-10 text-center whitespace-nowrap">S.N.</th>
                        <th className="py-2 px-3 whitespace-nowrap">SHEET NO</th>
                        <th className="py-2 px-3 whitespace-nowrap">CENTER NAME</th>
                        <th className="py-2 px-3 whitespace-nowrap">GROUP NAME</th>
                        <th className="py-2 px-3 whitespace-nowrap">DATE (BS)</th>
                        <th className="py-2 px-3 text-center whitespace-nowrap">MEMBERS</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">TOTAL SAVINGS</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">TOTAL LOANS</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {(() => {
                        const filteredSignatureSheets = signatureSheets.filter(sig =>
                          matchesBsDateFilter(sig.dateBs, sigHistoryYear, sigHistoryMonth)
                        );

                        if (filteredSignatureSheets.length === 0) {
                          return (
                            <tr>
                              <td colSpan={9} className="py-8 text-center">
                                <div className="flex flex-col items-center justify-center space-y-1.5">
                                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                  </div>
                                  <p className="text-sm font-extrabold text-slate-800">No signature sheets found matching criteria.</p>
                                  <p className="text-xs text-slate-400">
                                    Go to &quot;Collection Sheet&quot;, click &quot;View&quot;, then click &quot;Generate Sheet&quot; to save records here permanently.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return filteredSignatureSheets.map((sig, idx) => (
                          <tr key={sig.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-1.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-1.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">{sig.sheetNo}</td>
                            <td className="py-1.5 px-3 font-bold text-slate-900">{sig.centerName}</td>
                            <td className="py-1.5 px-3 text-slate-700">{sig.groupName}</td>
                            <td className="py-1.5 px-3 font-bold text-slate-800 whitespace-nowrap">{sig.dateBs}</td>
                            <td className="py-1.5 px-3 text-center font-bold whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono text-[11px]">
                                {sig.totalMembers || sig.members?.length || 0}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                              NPR {sig.totalSavings?.toLocaleString() || 0}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold text-orange-700 whitespace-nowrap">
                              NPR {sig.totalLoans?.toLocaleString() || 0}
                            </td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSignatureSheetModalMode('record');
                                    setSelectedSignatureSheetToPrint(sig);
                                    setIsSignatureModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                                  title="View & Print Signature Sheet"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>View / Print</span>
                                </button>
                                {canDeleteSignatureReport && (
                                  <button
                                    type="button"
                                    disabled={isDayEnded}
                                    onClick={() => {
                                      setSelectedSignatureSheetToDelete(sig);
                                      setIsDeleteSignatureModalOpen(true);
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Signature Sheet'}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2B: DEPOSIT SHEET */}
          {reportTab === 'deposit' && canViewDepositSheet && (
            <DepositSheetModule
              centers={centers}
              groups={groups}
              members={members}
              branches={adminBranches.length > 0 ? adminBranches : availableBranches}
              hrEmployees={activeHrEmployees}
              logoUrl={logoUrl}
              organizationNameNp={
                systemSettings?.systemNameNp ||
                authSettings?.systemNameNp ||
                'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड'
              }
              organizationName={
                systemSettings?.systemName ||
                authSettings?.systemName ||
                'RATAULI SAVING AND CREDIT COOPERATIVE LTD'
              }
              branchId={branch?.id}
              activeBranchKey={effectiveBranchKey}
              activeBranchKeys={effectiveBranchKeys}
              onToast={showToast}
              canEdit={canEditDepositSheet}
              canDelete={canDeleteDepositSheet}
            />
          )}

          {/* TAB 3: GROUP MEETING & MINUTES */}
          {reportTab === 'meeting-minutes' && canViewMeetingMinutes && (
            <GroupMeetingMinutesModule
              groups={groups}
              members={members}
              centers={centers}
              branches={adminBranches.length > 0 ? adminBranches : availableBranches}
              hrEmployees={activeHrEmployees}
              logoUrl={logoUrl}
              onToast={showToast}
              branchId={branch?.id}
              activeBranchKey={effectiveBranchKey}
              activeBranchKeys={effectiveBranchKeys}
              canEdit={canEditMeetingMinutes}
              canDelete={canDeleteMeetingMinutes}
            />
          )}

          {/* TAB 4: MEMBER ID CARD GENERATOR */}
          {reportTab === 'id-card' && canViewIdCard && (
            <MemberIdCardModule
              members={members}
              centers={centers}
              groups={groups}
              savings={savings}
              logoUrl={logoUrl}
              organizationNameNp={
                systemSettings?.systemNameNp ||
                authSettings?.systemNameNp ||
                'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड'
              }
              organizationName={
                systemSettings?.systemName ||
                authSettings?.systemName ||
                'RATAULI SAVING & CREDIT CO-OPERATIVE LIMITED'
              }
              organizationAddress={
                systemSettings?.addressNp ||
                systemSettings?.address ||
                authSettings?.addressNp ||
                authSettings?.address ||
                'पिपरा गाउँपालिका -६, रतौली, महोत्तरी'
              }
              organizationPhone={
                systemSettings?.phone ||
                authSettings?.phone ||
                '+977-044-000000'
              }
              registrationNo={
                systemSettings?.registrationNo ||
                authSettings?.registrationNo ||
                '421/054/055'
              }
              panNo={
                systemSettings?.panNo ||
                authSettings?.panNo ||
                '302488825'
              }
              defaultIssueDate={getTodayBsDate()}
              onMembersUpdated={setMembers}
              onToast={showToast}
              canEdit={canEditIdCard}
              canDelete={canDeleteIdCard}
            />
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT CENTER */}
      {/* ============================================================== */}
      {isCenterModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#1d4ed8] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <h3 className="text-sm font-extrabold tracking-wide">
                  {editingCenter ? 'Edit Center' : 'Add New Center'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCenterModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <DayEndFieldset branchId={branch?.id} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CENTER CODE</label>
                  <input
                    type="text"
                    value={centerForm.code}
                    onChange={e => setCenterForm({ ...centerForm, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">STATUS</label>
                  <select
                    value={centerForm.status}
                    onChange={e => setCenterForm({ ...centerForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CENTER NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Center 01 (Janaki Chowk)"
                  value={centerForm.name}
                  onChange={e => setCenterForm({ ...centerForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">LOCATION / ADDRESS</label>
                <input
                  type="text"
                  placeholder="e.g. Janakpur Ward 4"
                  value={centerForm.location}
                  onChange={e => setCenterForm({ ...centerForm, location: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">BRANCH</label>
                  <select
                    value={!canSwitchBranchView ? defaultBranchName : centerForm.branch}
                    disabled={!canSwitchBranchView}
                    onChange={e => setCenterForm({ ...centerForm, branch: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 disabled:opacity-80 disabled:cursor-not-allowed"
                  >
                    {!canSwitchBranchView ? (
                      <option value={defaultBranchName}>{defaultBranchName}</option>
                    ) : (
                      selectableBranches.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MEETING DAY</label>
                  <select
                    value={centerForm.meetingDay}
                    onChange={e => setCenterForm({ ...centerForm, meetingDay: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  >
                    {meetingDaysList.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </DayEndFieldset>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCenterModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleSaveCenter}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Save Center'}
                className="px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Center
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT GROUP */}
      {/* ============================================================== */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#1d4ed8] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <h3 className="text-sm font-extrabold tracking-wide">
                  {editingGroup ? 'Edit Group' : 'Add New Group'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <DayEndFieldset branchId={branch?.id} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GROUP CODE</label>
                  <input
                    type="text"
                    value={groupForm.code}
                    onChange={e => setGroupForm({ ...groupForm, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">STATUS</label>
                  <select
                    value={groupForm.status}
                    onChange={e => setGroupForm({ ...groupForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GROUP NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Laxmi Mahila Group"
                  value={groupForm.name}
                  onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ASSIGN CENTER</label>
                  <select
                    value={groupForm.centerId}
                    onChange={e => setGroupForm({ ...groupForm, centerId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {sortedCentersByMeetingDay.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MEETING DAY (DAY 1 - 30)</label>
                  <select
                    value={groupForm.meetingDay}
                    onChange={e => setGroupForm({ ...groupForm, meetingDay: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {meetingDaysList.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PLACE / WARD</label>
                <input
                  type="text"
                  placeholder="e.g. Janakpur Ward 4"
                  value={groupForm.place}
                  onChange={e => setGroupForm({ ...groupForm, place: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>
            </DayEndFieldset>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleSaveGroup}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Save Group'}
                className="px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CENTER GROUPS LIST (GROUPS UNDER SELECTED CENTER) */}
      {/* ============================================================== */}
      {selectedCenterForGroupsList && (() => {
        const targetCenterNameNorm = normalizeMfText(selectedCenterForGroupsList.name);
        const centerGroupsList = sortByNameAZ(
          groups.filter(g => {
            if (g.centerId && selectedCenterForGroupsList.id && g.centerId === selectedCenterForGroupsList.id) {
              return true;
            }
            if (targetCenterNameNorm && normalizeMfText(g.centerName) === targetCenterNameNorm) {
              return true;
            }
            return false;
          })
        );
        const totalCenterMembers = centerGroupsList.reduce((sum, g) => sum + (Number(g.membersCount) || 0), 0);

        return (
          <div
            className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex justify-center items-center p-3"
            onClick={() => setSelectedCenterForGroupsList(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[88vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Compact Header */}
              <div className="bg-[#00593B] px-4 py-2.5 flex items-center justify-between gap-2 text-white shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <h3 className="text-xs font-extrabold tracking-wide truncate">
                      {selectedCenterForGroupsList.name}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-mono font-bold shrink-0">
                      {selectedCenterForGroupsList.code}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-100 truncate mt-0.5">
                    {selectedCenterForGroupsList.branch || 'N/A'} • {selectedCenterForGroupsList.meetingDay} • {centerGroupsList.length} Groups
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCenterForGroupsList(null)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
                  aria-label="Close center groups list"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Compact Groups Table */}
              <div className="overflow-y-auto flex-1">
                {centerGroupsList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 font-semibold">
                    No groups found under this center.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-[11px] leading-tight">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                      <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-2 px-2.5 w-11 text-center border-r border-slate-100">S.N.</th>
                        <th className="py-2 px-2.5 w-20 border-r border-slate-100">Code</th>
                        <th className="py-2 px-2.5 border-r border-slate-100">Group Name</th>
                        <th className="py-2 px-2.5 border-r border-slate-100">Place</th>
                        <th className="py-2 px-2.5 w-24 text-center border-r border-slate-100">Members</th>
                        <th className="py-2 px-2.5 w-20 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {centerGroupsList.map((grp, idx) => (
                        <tr key={grp.id || idx} className="hover:bg-slate-50/80">
                          <td className="py-1.5 px-2.5 text-center font-mono tabular-nums text-slate-500 font-semibold border-r border-slate-100">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-slate-100 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black font-mono bg-amber-50 text-amber-700 border border-amber-200">
                              {grp.code}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 font-bold text-slate-900 border-r border-slate-100">
                            {grp.name}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-600 border-r border-slate-100">
                            {grp.place || 'N/A'}
                          </td>
                          <td className="py-1.5 px-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedGroupForMembersList(grp)}
                              title="View members in this group"
                              className="text-blue-600 font-bold inline-flex items-center gap-1 cursor-pointer hover:underline"
                            >
                              <Users className="w-3 h-3" />
                              <span>{grp.membersCount}</span>
                            </button>
                          </td>
                          <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              grp.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {grp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Compact Footer */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                  <span>
                    Total Groups: <span className="font-mono tabular-nums text-slate-800">{centerGroupsList.length}</span>
                  </span>
                  <span>
                    Total Members: <span className="font-mono tabular-nums text-slate-800">{totalCenterMembers}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCenterForGroupsList(null)}
                  className="px-3.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: GROUP MEMBERS LIST (COMPACT: S.N., NAME, POST) */}
      {/* ============================================================== */}
      {selectedGroupForMembersList && (() => {
        const groupNameNorm = normalizeMfText(selectedGroupForMembersList.name);
        const centerNameNorm = normalizeMfText(selectedGroupForMembersList.centerName);
        const groupMembersList = sortByNameAZ(
          members.filter(m => {
            if (m.samuhId && selectedGroupForMembersList.id && m.samuhId === selectedGroupForMembersList.id) {
              return true;
            }
            if (groupNameNorm && normalizeMfText(m.samuhName) === groupNameNorm) {
              if (centerNameNorm && m.centerName && normalizeMfText(m.centerName) !== centerNameNorm) {
                return false;
              }
              return true;
            }
            return false;
          })
        );

        return (
          <div
            className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex justify-center items-center p-3"
            onClick={() => setSelectedGroupForMembersList(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[88vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Compact Header */}
              <div className="bg-[#00593B] px-4 py-2.5 flex items-center justify-between gap-2 text-white shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    <h3 className="text-xs font-extrabold tracking-wide truncate">
                      {selectedGroupForMembersList.name}
                    </h3>
                  </div>
                  <p className="text-[10px] text-emerald-100 truncate mt-0.5">
                    {selectedGroupForMembersList.centerName || 'N/A'} • {groupMembersList.length} Members
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedGroupForMembersList(null)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
                  aria-label="Close group members list"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Ultra-compact Members Table */}
              <div className="overflow-y-auto flex-1">
                {groupMembersList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-semibold">
                    No members found in this group.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-[11px] leading-tight">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                      <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-1.5 px-2.5 w-12 text-center border-r border-slate-100">S.N.</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-100">Name</th>
                        <th className="py-1.5 px-2.5 w-28 text-center">Post</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupMembersList.map((mem, idx) => {
                        const postLabel = mem.role || 'Member';
                        const postColor =
                          postLabel === 'Leader'
                            ? 'text-blue-700 font-extrabold'
                            : postLabel === 'Secretary'
                              ? 'text-emerald-700 font-bold'
                              : postLabel === 'Treasurer'
                                ? 'text-amber-700 font-bold'
                                : 'text-slate-600 font-semibold';
                        return (
                          <tr key={mem.id || mem.memberId || idx} className="hover:bg-slate-50/80">
                            <td className="py-[3px] px-2.5 text-center font-mono tabular-nums text-slate-500 font-semibold border-r border-slate-100">
                              {idx + 1}
                            </td>
                            <td className="py-[3px] px-2.5 font-bold text-slate-900 border-r border-slate-100">
                              {mem.name}
                            </td>
                            <td className={`py-[3px] px-2.5 text-center whitespace-nowrap ${postColor}`}>
                              {postLabel}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Compact Footer */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-bold text-slate-500">
                  Total: <span className="font-mono tabular-nums text-slate-800">{groupMembersList.length}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedGroupForMembersList(null)}
                  className="px-3.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT MEMBER */}
      {/* ============================================================== */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#1d4ed8] px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-sm font-extrabold tracking-wide">
                  {editingMember ? 'Edit Member' : 'Register New Member'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 text-xs overflow-y-auto">
              <DayEndFieldset branchId={branch?.id} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MEMBER ID</label>
                  <input
                    type="text"
                    value={memberForm.memberId}
                    onChange={e => {
                      setMemberFormError(null);
                      setMemberForm({ ...memberForm, memberId: e.target.value });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ROLE</label>
                  <select
                    value={memberForm.role}
                    onChange={e => setMemberForm({ ...memberForm, role: e.target.value as 'Leader' | 'Secretary' | 'Treasurer' | 'Member' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="Leader">Leader</option>
                    <option value="Secretary">Secretary</option>
                    <option value="Treasurer">Treasurer</option>
                    <option value="Member">Member</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MEMBER FULL NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Sita Devi Chaudhary"
                  value={memberForm.name}
                  onChange={e => {
                    setMemberFormError(null);
                    setMemberForm({ ...memberForm, name: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CITIZENSHIP NO</label>
                  <input
                    type="text"
                    placeholder="e.g. 18-01-75-01234"
                    value={memberForm.citizenshipNo}
                    onChange={e => {
                      setMemberFormError(null);
                      setMemberForm({ ...memberForm, citizenshipNo: e.target.value });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MOBILE NUMBER</label>
                  <input
                    type="text"
                    placeholder="98XXXXXXXX"
                    value={memberForm.mobile}
                    onChange={e => {
                      setMemberFormError(null);
                      setMemberForm({ ...memberForm, mobile: e.target.value });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CENTER</label>
                  <select
                    value={memberForm.centerId}
                    onChange={e => {
                      const nextCenterId = e.target.value;
                      const nextCenterGroups = nextCenterId ? getGroupsForCenterFilter(nextCenterId) : [];
                      setMemberForm(prev => ({
                        ...prev,
                        centerId: nextCenterId,
                        samuhId: nextCenterGroups[0]?.id || ''
                      }));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {sortedCentersByMeetingDay.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GROUP</label>
                  {(() => {
                    const centerGroups = memberForm.centerId ? getGroupsForCenterFilter(memberForm.centerId) : [];
                    return (
                      <select
                        value={memberForm.samuhId}
                        onChange={e => setMemberForm({ ...memberForm, samuhId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                      >
                        {centerGroups.length === 0 ? (
                          <option value="">No groups in this center</option>
                        ) : (
                          centerGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))
                        )}
                      </select>
                    );
                  })()}
                </div>
              </div>

              {/* Member Photo Upload replaces SAVINGS ACCOUNT NO and JOINED DATE as requested */}
              <div className="p-3.5 rounded-2xl border border-dashed border-blue-200 bg-blue-50/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800 uppercase tracking-wider">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>MEMBER PHOTO</span>
                  </div>
                  {memberForm.photoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveMemberPhoto}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {memberForm.photoUrl ? (
                      <img src={memberForm.photoUrl} alt="Member Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleMemberPhotoUpload}
                      className="hidden"
                      id="member-photo-input"
                    />
                    <label
                      htmlFor="member-photo-input"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-400 text-slate-700 hover:text-blue-700 rounded-xl font-bold text-xs shadow-2xs cursor-pointer transition-all"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>{memberForm.photoUrl ? 'Change Photo' : 'Upload Member Photo'}</span>
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Upload JPEG, PNG or WEBP photo (max 2MB).
                    </p>
                  </div>
                </div>
              </div>
              {memberFormError && (
                <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{memberFormError}</span>
                </div>
              )}
              </DayEndFieldset>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMemberFormError(null);
                  setIsMemberModalOpen(false);
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleSaveMember}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Save Member'}
                className="px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD SAVING DEPOSIT */}
      {/* ============================================================== */}
      {isSavingModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#00593B] px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5" />
                <h3 className="text-sm font-extrabold tracking-wide">Create Savings Account & Record Deposit</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSavingModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 text-xs overflow-y-auto flex-1">
              <DayEndFieldset branchId={branch?.id} className="space-y-4">
              {/* SELECT MEMBER (Search directly by clicking & typing name or ID) */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  SELECT MEMBER
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by member name or ID (e.g. Sita, M-1001)..."
                    value={memberSearchInput}
                    onFocus={() => setIsMemberDropdownOpen(true)}
                    onChange={e => {
                      setMemberSearchInput(e.target.value);
                      setIsMemberDropdownOpen(true);
                    }}
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#00593B]/20 transition-all cursor-text"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {(memberSearchInput || selectedSavingMemberId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSavingFormError(null);
                        setMemberSearchInput('');
                        setSelectedSavingMemberId('');
                        setSavingAccounts(prev => prev.map(acc => ({ ...acc, accountNo: '' })));
                        setIsMemberDropdownOpen(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Results when user clicks/types */}
                {isMemberDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {(() => {
                      const filtered = members.filter(m => {
                        if (!memberSearchInput.trim()) return true;
                        const q = memberSearchInput.toLowerCase().trim();
                        return m.name.toLowerCase().includes(q) || m.memberId.toLowerCase().includes(q);
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-3 text-center text-slate-400 font-semibold text-xs">
                            No members found matching &quot;{memberSearchInput}&quot;
                          </div>
                        );
                      }

                      return filtered.map(m => {
                        const isSelected = m.memberId === selectedSavingMemberId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectSavingMember(m)}
                            className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-emerald-50/60 transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-50/80 font-bold text-[#00593B]' : 'text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="font-extrabold text-xs text-slate-900">{m.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {m.memberId} • {m.samuhName || m.centerName}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-[#00593B] shrink-0" />
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* MULTIPLE ACCOUNTS SECTION */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#00593B]" />
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      Account Open
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSavingAccount}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#00593B] border border-emerald-300/80 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Account</span>
                  </button>
                </div>

                {/* Accounts List */}
                <div className="space-y-3">
                  {savingAccounts.map((acc, idx) => (
                    <div 
                      key={acc.id}
                      className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5 relative group hover:border-emerald-300/80 transition-all"
                    >
                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#00593B] text-white flex items-center justify-center font-mono font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-black text-slate-800 text-xs">
                            <span className="text-[#00593B]">{acc.savingType} Account</span>
                          </span>
                        </div>
                        {savingAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSavingAccount(acc.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove this account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Single Row with Account No, Saving Type, Product, and Open Amount */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                        {/* Account Number (Manually editable) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            ACCOUNT NO.
                          </label>
                          <input
                            type="text"
                            value={acc.accountNo}
                            onChange={e => handleUpdateSavingAccount(acc.id, 'accountNo', e.target.value)}
                            placeholder="e.g. SAV-1001-01"
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#00593B]"
                          />
                        </div>

                        {/* Saving Type (Normal Saving, Recurring Saving only) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            SAVING TYPE
                          </label>
                          <select
                            value={acc.savingType}
                            onChange={e => handleUpdateSavingAccount(acc.id, 'savingType', e.target.value)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#00593B] cursor-pointer"
                          >
                            <option value="Normal Saving">Normal Saving</option>
                            <option value="Recurring Saving">Recurring Saving</option>
                          </select>
                        </div>

                        {/* Product (Saving Products configured in Admin Center) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            PRODUCT
                          </label>
                          <select
                            value={acc.product}
                            onChange={e => handleUpdateSavingAccount(acc.id, 'product', e.target.value)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#00593B] cursor-pointer"
                          >
                            {filteredMfSavingProducts.map(prod => (
                              <option key={prod.id} value={prod.name}>
                                {prod.name} ({prod.interestRate}%)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Recurring Amount (Monthly Saving Deposit) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            RECURRING AMOUNT
                          </label>
                          <input
                            type="number"
                            value={acc.amount}
                            onChange={e => handleUpdateSavingAccount(acc.id, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="Monthly deposit amount"
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-black font-mono text-sm text-emerald-800 focus:outline-hidden focus:ring-1 focus:ring-[#00593B]"
                          />
                        </div>
                      </div>

                      {/* Second Row: Period (Years, default 6) & Auto-Calculated Maturity Date (BS) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-200/60">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            PERIOD (YEARS)
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={acc.periodYears}
                              onChange={e => handleUpdateSavingAccount(acc.id, 'periodYears', parseFloat(e.target.value) || 0)}
                              placeholder="6"
                              className="w-full px-2.5 py-2 pr-14 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#00593B]"
                            />
                            <span className="absolute right-3 text-[10px] font-bold text-slate-400 uppercase pointer-events-none">
                              Years
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            MATURITY DATE (BS)
                          </label>
                          <div className="flex items-center bg-emerald-50/70 focus-within:bg-white border border-emerald-200 focus-within:ring-1 focus-within:ring-[#00593B] rounded-xl pr-1.5">
                            <input
                              type="text"
                              value={acc.maturityDateBs}
                              onChange={e => handleUpdateSavingAccount(acc.id, 'maturityDateBs', e.target.value)}
                              placeholder="YYYY-MM-DD"
                              maxLength={10}
                              className="w-full px-2.5 py-2 bg-transparent font-mono font-bold text-xs text-emerald-900 focus:outline-hidden"
                            />
                            <NepaliDatePicker
                              value={acc.maturityDateBs || calculateBsMaturityDateByYears(savingDate, acc.periodYears || DEFAULT_SAVING_PERIOD_YEARS)}
                              onChange={val => handleUpdateSavingAccount(acc.id, 'maturityDateBs', val)}
                              align="right"
                              iconOnly
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date (BS) Row with compact manual YYYY-MM-DD input & Nepali Calendar icon right beside the date */}
              <div className="pt-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  DATE (BS)
                </label>
                <div className="inline-flex items-center bg-slate-50 focus-within:bg-white border border-slate-200 focus-within:ring-1 focus-within:ring-[#00593B] rounded-xl pr-1.5">
                  <input
                    type="text"
                    value={savingDate}
                    onChange={e => handleSavingDateChange(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                    className="w-32 px-3 py-2 bg-transparent font-mono text-slate-800 font-bold focus:outline-hidden"
                  />
                  <NepaliDatePicker
                    value={savingDate}
                    onChange={val => handleSavingDateChange(val)}
                    align="left"
                    iconOnly
                    disallowBackDateIfDisabled
                  />
                </div>
              </div>

              {/* Error message shown only after clicking Create Account */}
              {savingFormError && (
                <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{savingFormError}</span>
                </div>
              )}
              </DayEndFieldset>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSavingModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleSaveSaving}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Create Saving Account'}
                className="px-5 py-2 bg-[#00593B] hover:bg-[#00472f] text-white rounded-xl font-bold cursor-pointer transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Create Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ISSUE NEW LOAN */}
      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* MODAL: ISSUE NEW LOAN */}
      {/* ============================================================== */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#ea580c] px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2">
                <HandCoins className="w-5 h-5" />
                <h3 className="text-sm font-extrabold tracking-wide uppercase">Issue Microfinance Loan</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLoanModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 text-xs overflow-y-auto flex-1">
              <DayEndFieldset branchId={branch?.id} className="space-y-3.5">
              {/* Member Search (Identical to Saving modal search UX) */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  SELECT MEMBER
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by member name or ID (e.g. Sita, M-1001)..."
                    value={loanMemberSearchInput}
                    onFocus={() => setIsLoanMemberDropdownOpen(true)}
                    onChange={e => {
                      setLoanMemberSearchInput(e.target.value);
                      setIsLoanMemberDropdownOpen(true);
                    }}
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#ea580c]/20 transition-all cursor-text"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {(loanMemberSearchInput || loanForm.memberId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoanMemberSearchInput('');
                        setLoanFormError(null);
                        setLoanForm(prev => ({
                          ...prev,
                          memberId: '',
                          name: '',
                          centerName: '',
                          groupName: ''
                        }));
                        setIsLoanMemberDropdownOpen(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Results */}
                {isLoanMemberDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {(() => {
                      const filtered = members.filter(m => {
                        if (!loanMemberSearchInput.trim()) return true;
                        const q = loanMemberSearchInput.toLowerCase().trim();
                        return m.name.toLowerCase().includes(q) || m.memberId.toLowerCase().includes(q);
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-3 text-center text-slate-400 font-semibold text-xs">
                            No members found matching &quot;{loanMemberSearchInput}&quot;
                          </div>
                        );
                      }

                      return filtered.map(m => {
                        const isSelected = m.memberId === loanForm.memberId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectLoanMember(m)}
                            className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-orange-50/60 transition-colors cursor-pointer ${
                              isSelected ? 'bg-orange-50 font-bold text-orange-700' : 'text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="font-extrabold text-xs text-slate-900">{m.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {m.memberId} • {m.samuhName || m.centerName}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Selected Member Details Badge */}
                {loanForm.name && (
                  <div className="mt-2 p-2.5 bg-orange-50/60 border border-orange-200/70 rounded-xl flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-bold text-slate-900">{loanForm.name}</span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="font-mono text-orange-800 font-bold">{loanForm.memberId}</span>
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      {loanForm.centerName || 'Center'} / {loanForm.groupName || 'Samuh'}
                    </div>
                  </div>
                )}
              </div>

              {/* Row 2: Open Date (BS) & Product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    OPEN DATE (BS)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={loanForm.loanDateBs}
                      onChange={e => handleLoanDateBsChange(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    PRODUCT <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={loanForm.loanProduct}
                    onChange={e => handleLoanProductChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    {filteredMfLoanProducts.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.interestRate}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Loan Amount & Period (Months) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    LOAN AMOUNT
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={loanForm.loanAmount}
                    onChange={e => handleLoanAmountChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black font-mono text-sm text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    PERIOD (MONTHS) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={loanForm.totalInstallments}
                    onChange={e => handleLoanPeriodChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Row 4: Installment Amount (Manually Editable) & Maturity Date (Auto-calculated from period) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    INSTALLMENT AMOUNT
                  </label>
                  <input
                    type="number"
                    value={loanForm.installmentAmount}
                    onChange={e => setLoanForm({ ...loanForm, installmentAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black font-mono text-sm text-orange-700 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                    <span>MATURITY DATE (BS)</span>
                    <span className="text-[9px] text-emerald-600 font-bold lowercase">auto-calculated</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={loanForm.maturityDate}
                      onChange={e => setLoanForm({ ...loanForm, maturityDate: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full pl-9 pr-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl font-mono font-black text-xs text-emerald-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                    <Clock className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Failure / Duplicate Unclosed Loan Alert */}
              {(loanFormError || conflictingUnclosedLoan) && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <div className="font-extrabold uppercase tracking-wide text-rose-700 mb-0.5">
                      {loanFormError ? 'Loan Issue Failed' : 'Unclosed Loan Exists — Cannot Issue Duplicate'}
                    </div>
                    <div className="font-semibold">
                      {loanFormError || (() => {
                        const c = conflictingUnclosedLoan!;
                        const st = getEffectiveLoanStatus(c) === 'MATURED' ? 'MATURE' : 'ACTIVE';
                        return `${loanForm.name} (${loanForm.memberId}) already has an unclosed ${st} loan (${c.accountNo}) under "${c.loanProduct}" (Amount: NPR ${Number(c.loanAmount || 0).toLocaleString()}, Date: ${c.loanDateBs || c.loanDate}). Close that loan first before issuing a new loan of the same product.`;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Account Number Preview */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>Account Number: <strong className="font-mono text-slate-800">{loanForm.accountNo}</strong></span>
                <span>Interest Rate: <strong className="text-emerald-700">{loanForm.interestRate}%</strong></span>
              </div>
              </DayEndFieldset>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsLoanModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleSaveLoan}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Issue Loan'}
                className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl font-bold cursor-pointer transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <HandCoins className="w-4 h-4" />
                <span>Issue Loan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VIEW LOAN DETAILS */}
      {/* ============================================================== */}
      {isViewLoanModalOpen && selectedLoanToView && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-extrabold tracking-wide uppercase">Loan Account Details</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{selectedLoanToView.accountNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewLoanModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Member Card */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black text-slate-900">{selectedLoanToView.name}</div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    selectedLoanToView.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : selectedLoanToView.status === 'MATURED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {selectedLoanToView.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Member ID: <span className="font-mono font-bold text-slate-700">{selectedLoanToView.memberId}</span> • Center: <span className="font-bold text-slate-700">{selectedLoanToView.centerName}</span>
                </div>
                {selectedLoanToView.groupName && (
                  <div className="text-[11px] text-slate-500">
                    Group: <span className="font-bold text-slate-700">{selectedLoanToView.groupName}</span>
                  </div>
                )}
              </div>

              {/* Loan Specs Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Loan Product</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{selectedLoanToView.loanProduct}</div>
                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">Interest: {selectedLoanToView.interestRate}%</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Loan Amount</div>
                  <div className="font-black font-mono text-base text-slate-900 mt-0.5">NPR {selectedLoanToView.loanAmount.toLocaleString()}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Open Date (BS)</div>
                  <div className="font-bold font-mono text-slate-800 mt-0.5">{selectedLoanToView.loanDateBs || selectedLoanToView.loanDate}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">AD: {selectedLoanToView.loanDate}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Maturity Date (BS)</div>
                  <div className="font-bold font-mono text-emerald-800 mt-0.5">{selectedLoanToView.maturityDate}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Tenure: {selectedLoanToView.totalInstallments} Months</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Monthly Installment</div>
                  <div className="font-black font-mono text-slate-900 mt-0.5">NPR {selectedLoanToView.installmentAmount.toLocaleString()}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Paid Installments</div>
                  <div className="font-bold text-slate-800 mt-0.5">{selectedLoanToView.paidInstallments || 0} of {selectedLoanToView.totalInstallments}</div>
                </div>

                {selectedLoanToView.status === 'CLOSED' && (selectedLoanToView.closedDateBs || selectedLoanToView.closedDate) && (
                  <div className="col-span-2 p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Closed Date (BS)</div>
                      <div className="font-bold font-mono text-slate-900 mt-0.5">{selectedLoanToView.closedDateBs || selectedLoanToView.closedDate}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white border border-slate-300 text-[10px] font-black text-slate-700">
                      Archived in Supabase
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              {getEffectiveLoanStatus(selectedLoanToView) !== 'CLOSED' && canEditLoan && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={() => {
                    setIsViewLoanModalOpen(false);
                    handleOpenCloseLoan(selectedLoanToView);
                  }}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Loan Close'}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{getEffectiveLoanStatus(selectedLoanToView) === 'MATURED' ? 'Close Loan' : 'LC'}</span>
                </button>
              )}
              {canEditLoan && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={() => {
                    setIsViewLoanModalOpen(false);
                    handleOpenEditLoan(selectedLoanToView);
                  }}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Loan'}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Loan</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsViewLoanModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT LOAN */}
      {/* ============================================================== */}
      {isEditLoanModalOpen && editLoanForm && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-800 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-extrabold tracking-wide uppercase">Edit Loan Record</h3>
                  <p className="text-[10px] text-emerald-200 font-mono">{editLoanForm.accountNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditLoanModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 text-xs overflow-y-auto flex-1">
              <DayEndFieldset branchId={branch?.id} className="space-y-3.5">
              {/* Member & Center Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MEMBER NAME</label>
                  <input
                    type="text"
                    value={editLoanForm.name}
                    onChange={e => setEditLoanForm({ ...editLoanForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MEMBER ID</label>
                  <input
                    type="text"
                    value={editLoanForm.memberId}
                    onChange={e => setEditLoanForm({ ...editLoanForm, memberId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Product & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">LOAN PRODUCT</label>
                  <select
                    value={editLoanForm.loanProduct}
                    onChange={e => setEditLoanForm({ ...editLoanForm, loanProduct: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                  >
                    {filteredMfLoanProducts.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.interestRate}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">STATUS</label>
                  <select
                    value={editLoanForm.status}
                    onChange={e => {
                      const nextStatus = e.target.value as 'ACTIVE' | 'MATURED' | 'CLOSED';
                      setEditLoanForm({
                        ...editLoanForm,
                        status: nextStatus,
                        closedDateBs: nextStatus === 'CLOSED' ? (editLoanForm.closedDateBs || getTodayBsDate()) : editLoanForm.closedDateBs
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MATURED">MATURED</option>
                    <option value="CLOSED">CLOSED (Archive to Supabase)</option>
                  </select>
                </div>
              </div>

              {editLoanForm.status === 'CLOSED' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 uppercase mb-1">CLOSE DATE (BS: YYYY-MM-DD)</label>
                    <input
                      type="text"
                      value={editLoanForm.closedDateBs || getTodayBsDate()}
                      onChange={e => setEditLoanForm({ ...editLoanForm, closedDateBs: e.target.value })}
                      placeholder="e.g. 2083-08-01"
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-mono font-bold text-slate-900"
                    />
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Saving as CLOSED keeps this loan permanently in Supabase and removes it from the Loan list. Collection Sheets for dates before this close date will still include it.
                  </p>
                </div>
              )}

              {/* Open Date BS & Maturity Date BS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">OPEN DATE (BS: YYYY-MM-DD)</label>
                  <input
                    type="text"
                    value={editLoanForm.loanDateBs || editLoanForm.loanDate}
                    onChange={e => {
                      const newBs = e.target.value;
                      const newMaturity = calculateBsMaturityDate(newBs, editLoanForm.totalInstallments);
                      setEditLoanForm({ ...editLoanForm, loanDateBs: newBs, maturityDate: newMaturity });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MATURITY DATE (BS: YYYY-MM-DD)</label>
                  <input
                    type="text"
                    value={editLoanForm.maturityDate}
                    onChange={e => setEditLoanForm({ ...editLoanForm, maturityDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-emerald-800"
                  />
                </div>
              </div>

              {/* Loan Amount */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">LOAN AMOUNT (NPR)</label>
                <input
                  type="number"
                  value={editLoanForm.loanAmount}
                  onChange={e => {
                    const amt = parseFloat(e.target.value) || 0;
                    setEditLoanForm({ ...editLoanForm, loanAmount: amt, remainingAmount: amt });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>

              {/* Period & Installment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PERIOD (MONTHS)</label>
                  <input
                    type="number"
                    min="1"
                    value={editLoanForm.totalInstallments}
                    onChange={e => {
                      const newPeriod = parseInt(e.target.value, 10) || 1;
                      const newMaturity = calculateBsMaturityDate(editLoanForm.loanDateBs || editLoanForm.loanDate, newPeriod);
                      setEditLoanForm({ ...editLoanForm, totalInstallments: newPeriod, maturityDate: newMaturity });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">INSTALLMENT (NPR)</label>
                  <input
                    type="number"
                    value={editLoanForm.installmentAmount}
                    onChange={e => setEditLoanForm({ ...editLoanForm, installmentAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-orange-700"
                  />
                </div>
              </div>
              </DayEndFieldset>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditLoanModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleSaveEditLoan}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Save Changes'}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE LOAN CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteLoanModalOpen && selectedLoanToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Are you sure you want to delete?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Loan account <strong className="font-mono text-slate-800">{selectedLoanToDelete.accountNo}</strong> for <strong>{selectedLoanToDelete.name}</strong> will be permanently deleted.
              </p>
              <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                Member ID: {selectedLoanToDelete.memberId} • Amount: NPR {selectedLoanToDelete.loanAmount.toLocaleString()}
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteLoanModalOpen(false); setSelectedLoanToDelete(null); }}
                className="min-w-[96px] px-5 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                No
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteLoan}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Loan'}
                className="min-w-[96px] px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CLOSE LOAN AFTER MATURITY (Archives to Supabase) */}
      {/* ============================================================== */}
      {isCloseLoanModalOpen && selectedLoanToClose && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-800 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-extrabold tracking-wide uppercase">Close Loan Account</h3>
                  <p className="text-[10px] text-emerald-200 font-mono">{selectedLoanToClose.accountNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseLoanModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <DayEndFieldset branchId={branch?.id} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-sm">{selectedLoanToClose.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                    {selectedLoanToClose.status}
                  </span>
                </div>
                <div className="text-slate-500">
                  Member ID: <span className="font-mono font-bold text-slate-700">{selectedLoanToClose.memberId}</span> • Amount: <span className="font-mono font-bold text-slate-900">NPR {selectedLoanToClose.loanAmount.toLocaleString()}</span>
                </div>
                <div className="text-slate-500">
                  Open: <span className="font-mono font-bold text-slate-700">{selectedLoanToClose.loanDateBs || selectedLoanToClose.loanDate}</span> • Maturity: <span className="font-mono font-bold text-emerald-700">{selectedLoanToClose.maturityDate}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                  CLOSE DATE (BS: YYYY-MM-DD)
                </label>
                <input
                  type="text"
                  value={closeLoanDateBs}
                  onChange={e => setCloseLoanDateBs(e.target.value)}
                  placeholder="2083-08-01"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed font-medium">
                This loan will be saved permanently in Supabase with status <strong>CLOSED</strong> and removed from the Loan table list to keep loading fast. When viewing <strong>Collection Sheet</strong> for any date before <strong>{closeLoanDateBs}</strong>, this loan will still appear.
              </div>
            </DayEndFieldset>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCloseLoanModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClosingLoan || isDayEnded}
                onClick={() => void handleConfirmCloseLoan()}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Close & Archive Loan'}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold cursor-pointer shadow-sm flex items-center gap-1.5 transition-colors"
              >
                {isClosingLoan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{isClosingLoan ? 'Closing...' : 'Close & Archive Loan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VIEW COLLECTION SHEET & GENERATE SIGNATURE SHEET (Full-Page View) */}
      {/* ============================================================== */}
      {isPrintSheetModalOpen && activeSheetToPrint && (() => {
        const centerObj = centers.find(c => c.id === activeSheetToPrint.centerId || c.name === activeSheetToPrint.centerName);
        const centerBranch =
          findMatchingBranch(centerObj?.branch, adminBranches.length > 0 ? adminBranches : availableBranches) ||
          loggedInBranchObj ||
          availableBranches[0];
        const groupMembers = members.filter(m => (!activeSheetToPrint.groupId || activeSheetToPrint.groupId === 'all') ? (m.centerId === activeSheetToPrint.centerId || m.centerName === activeSheetToPrint.centerName) : m.samuhId === activeSheetToPrint.groupId);
        const nepMonth = nepaliMonthMapNp[activeSheetToPrint.month] || activeSheetToPrint.month;
        const nepYear = toNepaliDigits(activeSheetToPrint.year);
        const nepDay = toNepaliDigits(activeSheetToPrint.day);
        const nepDateStr = `${nepYear}/${nepMonth}/${nepDay}`;

        // Totals calculations
        let totalSaving = 0;
        let totalMicroPrincipal = 0;
        let totalMicroAmount = 0;
        let totalEmergencyPrincipal = 0;
        let totalEmergencyAmount = 0;
        let totalDue = 0;
        let grandTotal = 0;

        const membersToRender = sortByNameAZ(groupMembers);

        const targetReportDateBs = collectionSheetTargetBs || buildBsDateFromParts(activeSheetToPrint.year, activeSheetToPrint.month, activeSheetToPrint.day);
        const sheetLoansPool = (collectionSheetLoans.length > 0 ? collectionSheetLoans : loans).filter(
          l => getEffectiveLoanStatus(l) !== 'CLOSED'
        );

        const rowsData = membersToRender.map((mem, i) => {
          const memLoans = sheetLoansPool.filter(l =>
            doesLoanBelongToMember(l, mem) &&
            isLoanActiveOnBsDate(l, targetReportDateBs)
          );
          const { microLoan, emergencyLoan } = splitMemberLoansByCategory(memLoans);
          
          const savingAmt = getMemberRecurringSavingAmount(mem);
          const savingKistaInfo = savingAmt > 0
            ? getMemberSavingKistaInfo(mem, activeSheetToPrint.year, activeSheetToPrint.month)
            : { kista: null, openDateBs: '' };
          
          // Micro Loan:
          // Date: Loan Open Date
          const microDate = microLoan ? (microLoan.loanDateBs || microLoan.loanDate) : '-';
          // Principal: Loan Issue Amount
          const microPrincipal = microLoan ? microLoan.loanAmount : 0;
          // Kista: Installment count
          const microKista = microLoan 
            ? calculateBsKistaNumber(microLoan.loanDateBs || microLoan.loanDate, activeSheetToPrint.year, activeSheetToPrint.month)
            : 0;
          // Amount: Installment Amount (not remaining loan)
          const microAmt = microLoan ? (microLoan.installmentAmount || 0) : 0;

          // Emergency Loan:
          const emergencyDate = emergencyLoan ? (emergencyLoan.loanDateBs || emergencyLoan.loanDate) : '-';
          const emergencyPrincipal = emergencyLoan ? emergencyLoan.loanAmount : 0;
          const emergencyKista = emergencyLoan ? calculateBsKistaNumber(emergencyLoan.loanDateBs || emergencyLoan.loanDate, activeSheetToPrint.year, activeSheetToPrint.month) : 0;
          const emergencyAmt = emergencyLoan ? (emergencyLoan.installmentAmount || 0) : 0;

          // Due: manual input
          const dueAmt = manualDues[mem.memberId] || 0;

          // Row Total: Saving + Micro Installment + Emergency Installment + Due
          const rowTotal = savingAmt + microAmt + emergencyAmt + dueAmt;

          totalSaving += savingAmt;
          totalMicroPrincipal += microPrincipal;
          totalMicroAmount += microAmt;
          totalEmergencyPrincipal += emergencyPrincipal;
          totalEmergencyAmount += emergencyAmt;
          totalDue += dueAmt;
          grandTotal += rowTotal;

          return {
            sn: i + 1,
            memberId: mem.memberId,
            name: mem.name,
            saving: savingAmt,
            savingKista: savingKistaInfo.kista,
            savingOpenDateBs: savingKistaInfo.openDateBs,
            microDate,
            microPrincipal,
            microKista,
            microAmount: microAmt,
            emergencyDate,
            emergencyPrincipal,
            emergencyKista,
            emergencyAmount: emergencyAmt,
            dueAmt,
            rowTotal
          };
        });

        return (
          <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
              {/* Modal Body: Proportional suitable column widths, Black & White high-contrast for printing */}
              <div id="printable-collection-sheet" className="flex-1 overflow-auto p-3 sm:p-4 space-y-2.5 bg-white text-black">
                {/* Organization & Center Heading (Dual language, equal length, no underline) */}
                <div className="flex items-center justify-between gap-3 pb-1.5 border-b-2 border-black">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    onError={(e) => { e.currentTarget.src = '/system_logo.png'; }}
                    className="w-14 h-14 object-contain shrink-0"
                  />
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-0.5">
                    <div className="inline-flex flex-col items-center justify-center text-center">
                      <h2 className="text-xl sm:text-[22px] font-black text-black tracking-tight leading-tight whitespace-nowrap">
                        रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                      </h2>
                      <p className="text-[11.5px] sm:text-[12px] font-black text-black uppercase tracking-[0.08em] leading-tight pt-0.5 whitespace-nowrap">
                        RATAULI SAVING AND CREDIT COOPERATIVE LIMITED
                      </p>
                    </div>

                    <div className="pt-0.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 border-2 border-black bg-slate-100 rounded-md text-[11px] font-black uppercase tracking-wider text-black">
                        <Building2 className="w-3.5 h-3.5 text-black" />
                        {centerBranch?.name || 'शाखा कार्यालय'} • {centerBranch?.location || systemSettings?.address || 'पिपरा गाँउपालिका-६, महोत्तरी'}
                      </span>
                    </div>

                    <div className="pt-0.5">
                      <span className="text-sm sm:text-base font-black text-black uppercase tracking-wider border-b border-black pb-0.5">
                        Collection Sheet
                      </span>
                    </div>
                  </div>
                  <div className="w-14 shrink-0"></div>
                </div>

                {/* Meta Row: समूह, केन्द्र, मिति, स्थान with clean black text & border */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-black px-3 py-1 bg-white rounded-lg border-2 border-black whitespace-nowrap">
                  <div>समूह: <span className="font-black text-black">{activeSheetToPrint.groupName}</span></div>
                  <div>केन्द्र: <span className="font-black text-black">{activeSheetToPrint.centerName}</span></div>
                  <div>मिति: <span className="font-black text-black">{nepDateStr}</span></div>
                  <div>स्थान: <span className="font-black text-black">{centerObj?.location || 'रतौली'}</span></div>
                </div>

                {/* Multi-tier Clean Black & White Table: Fixed proportional column widths for balanced print & preview */}
                <div className="overflow-x-auto rounded-lg border-2 border-black shadow-none">
                  <table className="w-full table-fixed border-collapse text-[11px] text-black">
                    <colgroup>
                      <col style={{ width: '3%' }} />
                      <col style={{ width: '9.5%' }} />
                      <col style={{ width: '14.5%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '7.5%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '3.5%' }} />
                      <col style={{ width: '6.5%' }} />
                      <col style={{ width: '7.5%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '3.5%' }} />
                      <col style={{ width: '6.5%' }} />
                      <col style={{ width: '6.5%' }} />
                      <col style={{ width: '7.5%' }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100 text-black font-black uppercase text-[9.5px] tracking-tight border-b-2 border-black">
                        <th rowSpan={2} className="py-1 px-0.5 border-r border-black text-center whitespace-nowrap">S.N.</th>
                        <th rowSpan={2} className="py-1 px-1 border-r border-black text-center whitespace-nowrap">Member ID</th>
                        <th rowSpan={2} className="py-1 px-1.5 border-r border-black text-left whitespace-nowrap">Name</th>
                        <th rowSpan={2} className="py-1 px-1 border-r border-black text-right whitespace-nowrap">Saving</th>
                        <th colSpan={4} className="py-0.5 px-1 border-r border-black text-center bg-slate-100 font-black whitespace-nowrap">
                          Micro-enterprises Loan
                        </th>
                        <th colSpan={4} className="py-0.5 px-1 border-r border-black text-center bg-slate-100 font-black whitespace-nowrap">
                          Emergency Loan
                        </th>
                        <th rowSpan={2} className="py-1 px-1 text-right border-r border-black whitespace-nowrap text-black font-black">
                          Due
                        </th>
                        <th rowSpan={2} className="py-1 px-1.5 text-right bg-slate-100 text-black font-black whitespace-nowrap">
                          Total
                        </th>
                      </tr>
                      <tr className="bg-slate-50 text-black font-black uppercase text-[8.5px] tracking-tight border-b-2 border-black">
                        <th className="py-0.5 px-0.5 border-r border-black text-center whitespace-nowrap">Date</th>
                        <th className="py-0.5 px-1 border-r border-black text-right whitespace-nowrap">Principal</th>
                        <th className="py-0.5 px-0.5 border-r border-black text-center whitespace-nowrap">Kista</th>
                        <th className="py-0.5 px-1 border-r border-black text-right text-black whitespace-nowrap">Amount</th>
                        <th className="py-0.5 px-0.5 border-r border-black text-center whitespace-nowrap">Date</th>
                        <th className="py-0.5 px-1 border-r border-black text-right whitespace-nowrap">Principal</th>
                        <th className="py-0.5 px-0.5 border-r border-black text-center whitespace-nowrap">Kista</th>
                        <th className="py-0.5 px-1 border-r border-black text-right text-black whitespace-nowrap">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/30 font-medium text-black bg-white">
                      {rowsData.map((row) => (
                        <tr key={row.memberId} className="hover:bg-slate-50 border-b border-black/40">
                          <td className="py-1 px-0.5 text-center font-bold font-mono tabular-nums text-black border-r border-black whitespace-nowrap">{row.sn}</td>
                          <td className="py-1 px-1 text-center font-mono tabular-nums font-bold text-[10px] text-black border-r border-black whitespace-nowrap">{row.memberId}</td>
                          <td className="py-1 px-1.5 font-bold text-black border-r border-black leading-tight break-words">{row.name}</td>
                          <td className="p-0 h-px font-mono tabular-nums text-black border-r border-black whitespace-nowrap">
                            <div className="flex items-stretch h-full">
                              <span
                                className="mf-saving-kista-cell w-6 py-1 px-0.5 flex items-center justify-center text-[9px] font-bold text-slate-700 border-r border-slate-700 shrink-0"
                                title={row.savingKista ? `Saving Kista: ${row.savingKista} (Open: ${row.savingOpenDateBs})` : undefined}
                              >
                                {row.savingKista ?? ''}
                              </span>
                              <span className="flex-1 py-1 px-1 flex items-center justify-end font-bold text-right">
                                {row.saving.toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="py-1 px-0.5 text-center font-mono tabular-nums text-[10px] text-black border-r border-black whitespace-nowrap">{row.microDate}</td>
                          <td className="py-1 px-1 text-right font-mono tabular-nums font-bold text-black border-r border-black whitespace-nowrap">{row.microPrincipal ? row.microPrincipal.toLocaleString() : '-'}</td>
                          <td className="py-1 px-0.5 text-center font-mono tabular-nums font-bold text-black border-r border-black whitespace-nowrap">{row.microKista || '-'}</td>
                          <td className="py-1 px-1 text-right font-mono tabular-nums font-bold text-black border-r border-black whitespace-nowrap">{row.microAmount ? row.microAmount.toLocaleString() : '-'}</td>
                          <td className="py-1 px-0.5 text-center font-mono tabular-nums text-[10px] text-black border-r border-black whitespace-nowrap">{row.emergencyDate}</td>
                          <td className="py-1 px-1 text-right font-mono tabular-nums font-bold text-black border-r border-black whitespace-nowrap">{row.emergencyPrincipal ? row.emergencyPrincipal.toLocaleString() : '-'}</td>
                          <td className="py-1 px-0.5 text-center font-mono tabular-nums font-bold text-black border-r border-black whitespace-nowrap">{row.emergencyKista || '-'}</td>
                          <td className="py-1 px-1 text-right font-mono tabular-nums font-bold text-black border-r border-black whitespace-nowrap">{row.emergencyAmount ? row.emergencyAmount.toLocaleString() : '-'}</td>
                          <td className="py-1 px-1 text-right font-mono tabular-nums border-r border-black whitespace-nowrap">
                            <input
                              type="number"
                              min={0}
                              disabled={isDayEnded}
                              value={manualDues[row.memberId] !== undefined ? (manualDues[row.memberId] || '') : ''}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                setManualDues(prev => ({ ...prev, [row.memberId]: val }));
                              }}
                              title={isDayEnded ? 'Day Ended - Action Locked' : 'Enter manual due amount'}
                              className="mf-due-input print:hidden w-full max-w-[54px] px-0.5 py-0 text-right font-mono tabular-nums font-bold text-[11px] text-black bg-transparent border border-transparent hover:border-slate-300 focus:border-slate-900 rounded-xs focus:outline-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                            <span className="mf-due-print-val hidden print:inline font-mono tabular-nums font-bold text-black">
                              {row.dueAmt ? row.dueAmt.toLocaleString() : '0'}
                            </span>
                          </td>
                          <td className="py-1 px-1.5 text-right font-mono tabular-nums font-black text-black whitespace-nowrap">
                            {row.rowTotal.toLocaleString()}
                          </td>
                        </tr>
                      ))}

                      {rowsData.length === 0 && (
                        <tr>
                          <td colSpan={14} className="py-16 text-center bg-white whitespace-nowrap">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="w-14 h-14 rounded-full border-2 border-black text-black flex items-center justify-center text-2xl font-bold">
                                !
                              </div>
                              <p className="text-base font-bold text-black">
                                यो समूहमा कुनै सदस्यहरू फेला परेनन् ।
                              </p>
                              <p className="text-xs text-black italic">
                                कृपया पहिले &quot;Members&quot; सेक्सनमा गएर सदस्यहरू थप्नुहोस् ।
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {/* Clean Black & White Total Footer */}
                    <tfoot>
                      <tr className="bg-slate-100 text-black font-black text-[10.5px] border-t-2 border-black whitespace-nowrap">
                        <td colSpan={3} className="py-1.5 px-2 text-center tracking-widest text-[11px] uppercase border-r border-black whitespace-nowrap">
                          TOTAL
                        </td>
                        <td className="py-1.5 px-1 text-right font-mono tabular-nums font-black text-black border-r border-black whitespace-nowrap">
                          {totalSaving.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-0.5 text-center text-black border-r border-black whitespace-nowrap">-</td>
                        <td className="py-1.5 px-1 text-right font-mono tabular-nums font-black text-black border-r border-black whitespace-nowrap">
                          {totalMicroPrincipal.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-0.5 text-center font-mono tabular-nums font-black text-black border-r border-black whitespace-nowrap">
                          -
                        </td>
                        <td className="py-1.5 px-1 text-right font-mono tabular-nums font-black text-black border-r border-black whitespace-nowrap">
                          {totalMicroAmount.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-0.5 text-center text-black border-r border-black whitespace-nowrap">-</td>
                        <td className="py-1.5 px-1 text-right font-mono tabular-nums font-black text-black border-r border-black whitespace-nowrap">
                          {totalEmergencyPrincipal.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-0.5 text-center font-mono tabular-nums font-black text-black border-r border-black whitespace-nowrap">
                          -
                        </td>
                        <td className="py-1.5 px-1 text-right font-mono tabular-nums font-black text-black border-r border-black whitespace-nowrap">
                          {totalEmergencyAmount.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1 text-right font-mono tabular-nums font-black text-black border-r border-black whitespace-nowrap">
                          {totalDue.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right bg-slate-200 text-black font-mono tabular-nums font-black text-[10.5px] whitespace-nowrap">
                          {grandTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Modal Footer: 'Generate Sheet' when previewing from filter; 'Print' when viewing saved record */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPrintSheetModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Close
                </button>
                {collectionSheetModalMode === 'record' ? (
                  <button
                    type="button"
                    onClick={() => handlePrintElement('printable-collection-sheet')}
                    title="Print Collection Sheet"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-md transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                ) : canEditCollectionReport ? (
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleGenerateSignatureSheetFromModal}
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Generate & Save Sheet'}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Generate Sheet</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: VIEW / PRINT SIGNATURE SHEET (Updated per image_e326d6fa.png & image_48fc49cc.png) */}
      {/* ============================================================== */}
      {isSignatureModalOpen && selectedSignatureSheetToPrint && (() => {
        const currentGroup = groups.find(g => g.id === selectedSignatureSheetToPrint.groupId || g.name === selectedSignatureSheetToPrint.groupName);
        const leaderMember = members.find(m => (m.samuhId === selectedSignatureSheetToPrint.groupId || m.samuhName === selectedSignatureSheetToPrint.groupName) && (m.role === 'Leader' || m.role === 'President' || m.role?.toLowerCase().includes('lead') || m.role?.toLowerCase().includes('अध्यक्ष')));
        const samuhAdhyakshyaName = currentGroup?.leaderName || leaderMember?.name || 'सीता देवी चौधरी';

        const selectedEmp = activeHrEmployees.find(e => e.id === sigFilterEmployeeId || e.fullName === sigFilterEmployeeId);
        const selectedOfficerName = selectedEmp?.fullName || (sigFilterEmployeeId && sigFilterEmployeeId !== 'ALL' ? sigFilterEmployeeId : (selectedSignatureSheetToPrint.officerName || user?.fullName || 'Chandan'));

        return (
          <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[95vh] flex flex-col">
              {/* Document Sheet Body */}
              <div id="printable-signature-sheet" className="p-6 space-y-3 text-xs overflow-y-auto bg-white print:p-0">
                {/* Header: Logo, Company Name Nepali & English (Equal balanced compact height) */}
                <div className="flex items-center gap-3">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    onError={(e) => { e.currentTarget.src = '/system_logo.png'; }}
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0"
                  />
                  <div className="flex-1 text-center space-y-0.5">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug whitespace-nowrap">
                      रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                    </h2>
                    <p className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-[0.14em] leading-tight whitespace-nowrap">
                      {systemSettings?.systemName || 'RATAULI SAVING AND CREDIT COOPERATIVE LTD'}
                    </p>
                    <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight pt-0.5">
                      {selectedSignatureSheetToPrint.branchName || 'सहोडवा सेवा केन्द्र'}
                    </p>
                  </div>
                  <div className="w-16 sm:w-20 shrink-0"></div>
                </div>

                {/* Clean divider line */}
                <div className="border-b border-slate-300"></div>

                {/* Meta fields: समूहको नाम, केन्द्रको नाम, मिति, स्थान with balanced equal height */}
                <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-900 py-1">
                  <div className="space-y-1 text-left">
                    <div>
                      समूहको नाम:{' '}
                      <span className="font-black text-slate-900">
                        {selectedSignatureSheetToPrint.groupName}
                      </span>
                    </div>
                    <div>
                      केन्द्रको नाम:{' '}
                      <span className="font-black text-slate-900">
                        {selectedSignatureSheetToPrint.centerName}
                      </span>
                    </div>
                  </div>

                  <div className="text-center self-center">
                    <div>
                      मिति:{' '}
                      <span className="font-black text-slate-900">
                        {selectedSignatureSheetToPrint.dateBs}
                      </span>
                    </div>
                  </div>

                  <div className="text-right self-center">
                    <div>
                      स्थान:{' '}
                      <span className="font-black text-slate-900">
                        {selectedSignatureSheetToPrint.location}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Table with crisp black borders (Compact row height & narrower बचत / ऋण रकम columns) */}
                <div className="overflow-x-auto pt-1">
                  <table className="w-full table-fixed border-collapse border-2 border-slate-900 text-xs">
                    <colgroup>
                      <col style={{ width: '5%' }} />
                      <col style={{ width: '24%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '21%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-50 font-black text-slate-900 text-[11px]">
                        <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">क्र.सं.</th>
                        <th className="py-1.5 px-2 border border-slate-900 text-left whitespace-nowrap">सदस्यको नाम</th>
                        <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">पद</th>
                        <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">सदस्य नं.</th>
                        <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">बचत (रु.)</th>
                        <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">ऋण रकम (रु.)</th>
                        <th className="py-1.5 px-2 border border-slate-900 text-center whitespace-nowrap">हस्ताक्षर</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortByNameAZ(selectedSignatureSheetToPrint.members || []).map((mem, idx) => {
                        const matchedMember = members.find(
                          m =>
                            isSameMfMemberId(m.memberId, mem.memberId) ||
                            (normalizeMfText(m.name) === normalizeMfText(mem.name) &&
                              (!selectedSignatureSheetToPrint.groupId ||
                                m.samuhId === selectedSignatureSheetToPrint.groupId ||
                                normalizeMfText(m.samuhName) === normalizeMfText(selectedSignatureSheetToPrint.groupName)))
                        );
                        const memberPost = mem.role || matchedMember?.role || 'Member';
                        return (
                        <tr key={mem.memberId || idx} className="border-b border-slate-800">
                          <td className="py-1.5 px-1.5 border border-slate-900 text-center font-bold text-slate-700 whitespace-nowrap">
                            {toNepaliDigits(idx + 1)}
                          </td>
                          <td className="py-1.5 px-2 border border-slate-900 font-bold text-slate-900 leading-tight break-words">
                            {mem.name}
                          </td>
                          <td className="py-1.5 px-1.5 border border-slate-900 text-center font-bold text-[11px] text-slate-800 whitespace-nowrap">
                            {memberPost}
                          </td>
                          <td className="py-1.5 px-1.5 border border-slate-900 text-center font-mono tabular-nums font-bold text-[11px] text-slate-800 whitespace-nowrap">
                            {mem.memberId}
                          </td>
                          {/* बचत (रु.) - Compact width, center aligned */}
                          <td className="py-1.5 px-1.5 border border-slate-900 text-center font-mono font-bold"></td>
                          {/* ऋण रकम (रु.) - Compact width, center aligned */}
                          <td className="py-1.5 px-1.5 border border-slate-900 text-center font-mono font-bold"></td>
                          {/* हस्ताक्षर - Compact height for neat single-page print */}
                          <td className="py-1 px-2 border border-slate-900 text-center h-8"></td>
                        </tr>
                        );
                      })}

                      {/* Total summary row (Center aligned) */}
                      <tr className="border-t-2 border-slate-900 bg-slate-100 font-black text-slate-900">
                        <td colSpan={4} className="py-1.5 px-2 border border-slate-900 text-center uppercase tracking-wider">
                          कुल जम्मा (Total)
                        </td>
                        <td className="py-1.5 px-1.5 border border-slate-900 text-center font-mono text-xs"></td>
                        <td className="py-1.5 px-1.5 border border-slate-900 text-center font-mono text-xs"></td>
                        <td className="py-1.5 px-2 border border-slate-900"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Meeting Loan Demand Table (2 blank rows for handwritten entry during meeting) */}
                <div className="overflow-x-auto pt-2">
                  <div className="text-[11px] font-black text-slate-900 mb-1">
                    बैठकमा ऋण माग विवरण
                  </div>
                  <table className="w-full border-collapse border-2 border-slate-900 text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-50 font-black text-slate-900 text-[11px]">
                        <th className="py-1.5 px-2 border border-slate-900 text-center w-14 whitespace-nowrap">S.N.</th>
                        <th className="py-1.5 px-2 border border-slate-900 text-left whitespace-nowrap">Name</th>
                        <th className="py-1.5 px-2 border border-slate-900 text-center w-28 whitespace-nowrap">Loan Amount</th>
                        <th className="py-1.5 px-2 border border-slate-900 text-center w-20 whitespace-nowrap">Duration</th>
                        <th className="py-1.5 px-2 border border-slate-900 text-center w-48 whitespace-nowrap">Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2].map((rowNum) => (
                        <tr key={rowNum} className="border-b border-slate-800">
                          <td className="py-1 px-2 border border-slate-900 text-center font-bold text-slate-700 h-7 whitespace-nowrap">
                            {rowNum}
                          </td>
                          <td className="py-1 px-2 border border-slate-900 h-7"></td>
                          <td className="py-1 px-2 border border-slate-900 h-7"></td>
                          <td className="py-1 px-2 border border-slate-900 h-7"></td>
                          <td className="py-1 px-2 border border-slate-900 h-7"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Signatures: समूह अध्यक्ष with Name (Left) and कर्मचारी (Right) */}
                <div className="mf-signature-footer flex justify-between items-end pt-8 pb-3 px-6 text-xs font-bold text-slate-900">
                  <div className="text-center space-y-1">
                    <div className="w-56 border-b-2 border-dotted border-slate-800 mx-auto"></div>
                    <div className="text-xs font-bold text-slate-800 pt-0.5">
                      {samuhAdhyakshyaName}
                    </div>
                    <div className="text-sm font-black">समूह अध्यक्ष</div>
                  </div>

                  <div className="text-center space-y-1">
                    <div className="w-56 border-b-2 border-dotted border-slate-800 mx-auto"></div>
                    <div className="text-xs font-bold text-slate-800 pt-0.5 font-mono">
                      {selectedOfficerName}
                    </div>
                    <div className="text-sm font-black">कर्मचारी</div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Screen only): 'Generate Sheet' when previewing; 'Print' when viewing saved record */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                {signatureSheetModalMode === 'record' ? (
                  <button
                    type="button"
                    onClick={() => handlePrintElement('printable-signature-sheet')}
                    title="Print Signature Sheet"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                ) : canEditSignatureReport ? (
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleSaveAndGenerateSignatureSheet}
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Generate & Save Signature Sheet'}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Generate Sheet</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: DELETE SIGNATURE SHEET CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteSignatureModalOpen && selectedSignatureSheetToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Signature Sheet?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete signature sheet <strong className="font-mono text-slate-800">{selectedSignatureSheetToDelete.sheetNo}</strong> for <strong>{selectedSignatureSheetToDelete.groupName}</strong>?
              </p>
              <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                Date: {selectedSignatureSheetToDelete.dateBs} • Members: {selectedSignatureSheetToDelete.totalMembers} • Center: {selectedSignatureSheetToDelete.centerName}
              </div>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteSignatureModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteSignatureSheet}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Signature Sheet'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VIEW SAVING DETAILS */}
      {/* ============================================================== */}
      {isViewSavingModalOpen && selectedSavingToView && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-extrabold tracking-wide uppercase">Saving Account Details</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{selectedSavingToView.accountNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewSavingModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black text-slate-900">{selectedSavingToView.name}</div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    getEffectiveSavingStatus(selectedSavingToView) === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : getEffectiveSavingStatus(selectedSavingToView) === 'MATURED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                    {getEffectiveSavingStatus(selectedSavingToView)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Member ID: <span className="font-mono font-bold text-slate-700">{selectedSavingToView.memberId}</span> • Center: <span className="font-bold text-slate-700">{selectedSavingToView.centerName || 'N/A'}</span>
                </div>
                {selectedSavingToView.groupName && (
                  <div className="text-[11px] text-slate-500">
                    Group: <span className="font-bold text-slate-700">{selectedSavingToView.groupName}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Account No.</div>
                  <div className="font-extrabold font-mono text-slate-900 mt-0.5">{selectedSavingToView.accountNo}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Recurring Amount</div>
                  <div className="font-black font-mono text-base text-emerald-700 mt-0.5">NPR {selectedSavingToView.amount.toLocaleString()}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Open Date (BS)</div>
                  <div className="font-bold font-mono text-slate-800 mt-0.5">{resolveSavingOpenDateBs(selectedSavingToView) || selectedSavingToView.date}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Saving Type / Product</div>
                  <div className="font-bold text-slate-800 mt-0.5">{selectedSavingToView.savingType || 'Normal Saving'}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Period</div>
                  <div className="font-bold font-mono text-slate-800 mt-0.5">{resolveSavingPeriodYears(selectedSavingToView)} Year(s)</div>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                  <div className="text-[10px] text-amber-700 uppercase font-bold">Maturity Date (BS)</div>
                  <div className="font-extrabold font-mono text-amber-900 mt-0.5">{resolveSavingMaturityDateBs(selectedSavingToView) || '-'}</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              {canEditSaving && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={() => {
                    setIsViewSavingModalOpen(false);
                    handleOpenEditSaving(selectedSavingToView);
                  }}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Saving'}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Saving</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsViewSavingModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT SAVING RECORD */}
      {/* ============================================================== */}
      {isEditSavingModalOpen && editSavingForm && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-800 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-extrabold tracking-wide uppercase">Edit Saving Record</h3>
                  <p className="text-[10px] text-emerald-200 font-mono">{editSavingForm.accountNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditSavingModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 text-xs overflow-y-auto flex-1">
              <DayEndFieldset branchId={branch?.id} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MEMBER NAME</label>
                    <input
                      type="text"
                      value={editSavingForm.name}
                      onChange={e => setEditSavingForm({ ...editSavingForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MEMBER ID</label>
                    <input
                      type="text"
                      value={editSavingForm.memberId}
                      onChange={e => setEditSavingForm({ ...editSavingForm, memberId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ACCOUNT NO.</label>
                    <input
                      type="text"
                      value={editSavingForm.accountNo}
                      onChange={e => setEditSavingForm({ ...editSavingForm, accountNo: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SAVING TYPE / PRODUCT</label>
                    <input
                      type="text"
                      value={editSavingForm.savingType}
                      onChange={e => setEditSavingForm({ ...editSavingForm, savingType: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RECURRING AMOUNT (NPR)</label>
                    <input
                      type="number"
                      value={editSavingForm.amount}
                      onChange={e => setEditSavingForm({ ...editSavingForm, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-emerald-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">STATUS</label>
                    <select
                      value={getEffectiveSavingStatus(editSavingForm)}
                      onChange={e => setEditSavingForm({ ...editSavingForm, status: e.target.value as 'ACTIVE' | 'MATURED' | 'CLOSED' })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="MATURED">MATURED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">OPEN DATE (BS)</label>
                    <div className="flex items-center bg-slate-50 focus-within:bg-white border border-slate-200 focus-within:ring-1 focus-within:ring-[#00593B] rounded-xl pr-1.5">
                      <input
                        type="text"
                        value={editSavingForm.dateBs || ''}
                        onChange={e => {
                          const newBs = e.target.value;
                          const norm = normalizeBsDate(newBs);
                          const yrs = resolveSavingPeriodYears(editSavingForm);
                          setEditSavingForm({
                            ...editSavingForm,
                            dateBs: newBs,
                            maturityDateBs: norm && /^\d{4}-\d{2}-\d{2}$/.test(norm)
                              ? calculateBsMaturityDateByYears(norm, yrs)
                              : editSavingForm.maturityDateBs
                          });
                        }}
                        placeholder="YYYY-MM-DD"
                        maxLength={10}
                        className="w-full px-2.5 py-2 bg-transparent font-mono text-slate-800 font-bold focus:outline-hidden"
                      />
                      <NepaliDatePicker
                        value={editSavingForm.dateBs || getTodayBsDate()}
                        onChange={val => {
                          const yrs = resolveSavingPeriodYears(editSavingForm);
                          setEditSavingForm({
                            ...editSavingForm,
                            dateBs: val,
                            maturityDateBs: calculateBsMaturityDateByYears(val, yrs)
                          });
                        }}
                        align="left"
                        iconOnly
                        disallowBackDateIfDisabled
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PERIOD (YEARS)</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={editSavingForm.periodYears ?? DEFAULT_SAVING_PERIOD_YEARS}
                      onChange={e => {
                        const yrs = parseFloat(e.target.value) || 0;
                        const openBs = normalizeBsDate(editSavingForm.dateBs || editSavingForm.date || getTodayBsDate());
                        setEditSavingForm({
                          ...editSavingForm,
                          periodYears: yrs,
                          maturityDateBs: yrs > 0 && openBs ? calculateBsMaturityDateByYears(openBs, yrs) : editSavingForm.maturityDateBs
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MATURITY DATE (BS)</label>
                    <div className="flex items-center bg-emerald-50/70 focus-within:bg-white border border-emerald-200 focus-within:ring-1 focus-within:ring-[#00593B] rounded-xl pr-1.5">
                      <input
                        type="text"
                        value={editSavingForm.maturityDateBs || ''}
                        onChange={e => setEditSavingForm({ ...editSavingForm, maturityDateBs: e.target.value })}
                        placeholder="YYYY-MM-DD"
                        maxLength={10}
                        className="w-full px-2.5 py-2 bg-transparent font-mono text-emerald-900 font-bold focus:outline-hidden"
                      />
                      <NepaliDatePicker
                        value={editSavingForm.maturityDateBs || resolveSavingMaturityDateBs(editSavingForm) || getTodayBsDate()}
                        onChange={val => setEditSavingForm({ ...editSavingForm, maturityDateBs: val })}
                        align="right"
                        iconOnly
                      />
                    </div>
                  </div>
                </div>
              </DayEndFieldset>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditSavingModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleSaveEditSaving}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE SAVING CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteSavingModalOpen && selectedSavingToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Are you sure you want to delete?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Saving record <strong className="font-mono text-slate-800">{selectedSavingToDelete.accountNo}</strong> for <strong>{selectedSavingToDelete.name}</strong> will be permanently deleted.
              </p>
              <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                Member ID: {selectedSavingToDelete.memberId} • Date: {selectedSavingToDelete.dateBs || selectedSavingToDelete.date} • Amount: NPR {selectedSavingToDelete.amount.toLocaleString()}
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteSavingModalOpen(false); setSelectedSavingToDelete(null); }}
                className="min-w-[96px] px-5 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                No
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteSaving}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Saving'}
                className="min-w-[96px] px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE COLLECTION SHEET CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteSheetModalOpen && selectedSheetToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Collection Sheet?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete collection sheet for <strong>{selectedSheetToDelete.groupName}</strong> ({selectedSheetToDelete.dateDisplay})?
              </p>
              <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                Center: {selectedSheetToDelete.centerName} • Members: {selectedSheetToDelete.memberCount}
              </div>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteSheetModalOpen(false); setSelectedSheetToDelete(null); }}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteSheet}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Sheet'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE CENTER CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteCenterModalOpen && selectedCenterToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Are you sure you want to delete?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Center <strong className="font-mono text-slate-800">{selectedCenterToDelete.code}</strong> (<strong>{selectedCenterToDelete.name}</strong>) will be permanently deleted.
              </p>
              {selectedCenterToDelete.location && (
                <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                  Location: {selectedCenterToDelete.location} • Meeting: {selectedCenterToDelete.meetingDay}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteCenterModalOpen(false); setSelectedCenterToDelete(null); }}
                className="min-w-[96px] px-5 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                No
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteCenter}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Center'}
                className="min-w-[96px] px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE GROUP CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteGroupModalOpen && selectedGroupToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Are you sure you want to delete?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Group <strong className="font-mono text-slate-800">{selectedGroupToDelete.code}</strong> (<strong>{selectedGroupToDelete.name}</strong>) will be permanently deleted.
              </p>
              {selectedGroupToDelete.centerName && (
                <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                  Center: {selectedGroupToDelete.centerName}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteGroupModalOpen(false); setSelectedGroupToDelete(null); }}
                className="min-w-[96px] px-5 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                No
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteGroup}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Group'}
                className="min-w-[96px] px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VIEW MEMBER DETAILS (With Full Saving & Loan Details) */}
      {/* ============================================================== */}
      {isViewMemberModalOpen && selectedMemberToView && (() => {
        const effStatus = getEffectiveMemberStatus(selectedMemberToView.status);
        const memberAllSavings = getMemberAllSavings(selectedMemberToView);
        const memberActiveSavings = memberAllSavings.filter(s => getEffectiveSavingStatus(s) !== 'CLOSED');
        const memberClosedSavingsCount = memberAllSavings.length - memberActiveSavings.length;
        const recurringSaving = memberActiveSavings.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

        const loanStatusRank = (st: 'ACTIVE' | 'MATURED' | 'CLOSED') =>
          st === 'ACTIVE' ? 0 : st === 'MATURED' ? 1 : 2;
        const memberAllLoans = allLoanAccountsForCounts
          .filter(l => doesLoanBelongToMember(l, selectedMemberToView))
          .sort((a, b) => {
            const rankDiff = loanStatusRank(getEffectiveLoanStatus(a)) - loanStatusRank(getEffectiveLoanStatus(b));
            if (rankDiff !== 0) return rankDiff;
            return String(b.loanDateBs || b.loanDate || '').localeCompare(String(a.loanDateBs || a.loanDate || ''));
          });

        const memberOpenLoans = memberAllLoans.filter(l => getEffectiveLoanStatus(l) !== 'CLOSED');
        const memberActiveLoansCount = memberAllLoans.filter(l => getEffectiveLoanStatus(l) === 'ACTIVE').length;
        const memberMaturedLoansCount = memberAllLoans.filter(l => getEffectiveLoanStatus(l) === 'MATURED').length;
        const memberClosedLoansCount = memberAllLoans.length - memberOpenLoans.length;
        const openLoanTotal = memberOpenLoans.reduce((sum, l) => sum + (Number(l.loanAmount) || 0), 0);
        const openLoanInstallmentTotal = memberOpenLoans.reduce((sum, l) => sum + (Number(l.installmentAmount) || 0), 0);

        return (
          <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="bg-[#00593B] px-6 py-4 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <User className="w-5 h-5" />
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Member Details</h3>
                    <p className="text-[11px] text-emerald-100/90">
                      Profile, Saving Accounts &amp; Loan Accounts
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsViewMemberModalOpen(false); setSelectedMemberToView(null); }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
                {/* Member Identity Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {selectedMemberToView.photoUrl ? (
                      <img
                        src={selectedMemberToView.photoUrl}
                        alt={selectedMemberToView.name}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-emerald-50 text-[#00593B] font-bold text-lg flex items-center justify-center border border-emerald-200 shrink-0">
                        {selectedMemberToView.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-base font-bold text-slate-900 truncate">{selectedMemberToView.name}</h4>
                        <span className={`text-[11px] font-semibold ${
                          effStatus === 'ACTIVE' ? 'text-emerald-700' : 'text-rose-600'
                        }`}>
                          · {effStatus === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        <span className="font-mono tabular-nums font-semibold text-slate-800">
                          ID: {selectedMemberToView.memberId}
                        </span>
                        {' · '}
                        <span>{selectedMemberToView.role || 'Member'}</span>
                        {selectedMemberToView.joinedDate && (
                          <>
                            {' · Joined '}
                            <span className="font-mono tabular-nums">{selectedMemberToView.joinedDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Account Totals Strip */}
                  <div className="flex items-center gap-5 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] text-slate-500">Saving Accounts</div>
                      <div className="font-mono tabular-nums text-sm font-bold text-emerald-700">
                        {memberActiveSavings.length} active
                        {memberClosedSavingsCount > 0 && (
                          <span className="text-slate-400 font-medium"> / {memberClosedSavingsCount} closed</span>
                        )}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] text-slate-500">Loan Accounts</div>
                      <div className="font-mono tabular-nums text-sm font-bold text-slate-900">
                        {memberOpenLoans.length} open
                        {memberClosedLoansCount > 0 && (
                          <span className="text-slate-400 font-medium"> / {memberClosedLoansCount} closed</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Member Basic Information Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  <div>
                    <div className="text-[11px] text-slate-500">Center</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{selectedMemberToView.centerName || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Group (Samuh)</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{selectedMemberToView.samuhName || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Branch</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{selectedMemberToView.branch || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Citizenship No.</div>
                    <div className="font-mono tabular-nums font-semibold text-slate-800 mt-0.5">
                      {selectedMemberToView.citizenshipNo || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Mobile Number</div>
                    <div className="font-mono tabular-nums font-semibold text-slate-800 mt-0.5">
                      {selectedMemberToView.mobile || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Primary Saving A/C</div>
                    <div className="font-mono tabular-nums font-semibold text-slate-800 mt-0.5">
                      {selectedMemberToView.savingsAccountNo || memberActiveSavings[0]?.accountNo || '—'}
                    </div>
                  </div>
                </div>

                {/* View Filter Switcher: All / Saving Details / Loan Details */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setViewMemberDetailTab('all')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        viewMemberDetailTab === 'all'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      All Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMemberDetailTab('saving')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                        viewMemberDetailTab === 'saving'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      <PiggyBank className="w-3.5 h-3.5" />
                      <span>Savings (<span className="font-mono tabular-nums">{memberAllSavings.length}</span>)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMemberDetailTab('loan')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                        viewMemberDetailTab === 'loan'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      <HandCoins className="w-3.5 h-3.5" />
                      <span>Loans (<span className="font-mono tabular-nums">{memberAllLoans.length}</span>)</span>
                    </button>
                  </div>
                </div>

                {/* SAVING DETAILS SECTION */}
                {(viewMemberDetailTab === 'all' || viewMemberDetailTab === 'saving') && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="w-4 h-4 text-[#00593B]" />
                        <h5 className="text-xs font-bold text-slate-900">Saving Details</h5>
                        <span className="text-[11px] text-slate-500">
                          · <span className="font-mono tabular-nums font-semibold text-emerald-700">{memberActiveSavings.length}</span> active
                          {memberClosedSavingsCount > 0 && (
                            <>
                              {' · '}
                              <span className="font-mono tabular-nums">{memberClosedSavingsCount}</span> closed
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Active Recurring:{' '}
                        <span className="font-mono tabular-nums font-bold text-emerald-700">
                          NPR {recurringSaving.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                              <th className="py-2 px-3">Account No.</th>
                              <th className="py-2 px-3">Saving Type</th>
                              <th className="py-2 px-3">Open / Maturity (BS)</th>
                              <th className="py-2 px-3 text-right">Recurring Amt</th>
                              <th className="py-2 px-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {memberAllSavings.map(sav => {
                              const savStatus = getEffectiveSavingStatus(sav);
                              const openDateBs = resolveSavingOpenDateBs(sav) || sav.date || '—';
                              const maturityDateBs = resolveSavingMaturityDateBs(sav) || '—';
                              return (
                                <tr key={sav.id} className="hover:bg-slate-50/70">
                                  <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                                    {sav.accountNo || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-slate-800">
                                    {sav.savingType || 'Regular Saving'}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                    <div>{openDateBs}</div>
                                    <div className="text-[10px] text-amber-700">Mat: {maturityDateBs}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                                    NPR {(Number(sav.amount) || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                    <span className={`font-semibold ${
                                      savStatus === 'ACTIVE'
                                        ? 'text-emerald-700'
                                        : savStatus === 'MATURED'
                                        ? 'text-amber-600'
                                        : 'text-slate-400'
                                    }`}>
                                      {savStatus === 'ACTIVE' ? 'Active' : savStatus === 'MATURED' ? 'Matured' : 'Closed'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                            {memberAllSavings.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-5 text-center text-slate-400">
                                  No saving accounts found for this member.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* LOAN DETAILS SECTION */}
                {(viewMemberDetailTab === 'all' || viewMemberDetailTab === 'loan') && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <HandCoins className="w-4 h-4 text-amber-600" />
                        <h5 className="text-xs font-bold text-slate-900">Loan Details</h5>
                        <span className="text-[11px] text-slate-500">
                          · <span className="font-mono tabular-nums font-semibold text-emerald-700">{memberActiveLoansCount}</span> active
                          {memberMaturedLoansCount > 0 && (
                            <>
                              {' · '}
                              <span className="font-mono tabular-nums font-semibold text-amber-700">{memberMaturedLoansCount}</span> matured
                            </>
                          )}
                          {memberClosedLoansCount > 0 && (
                            <>
                              {' · '}
                              <span className="font-mono tabular-nums">{memberClosedLoansCount}</span> closed
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Open Principal:{' '}
                        <span className="font-mono tabular-nums font-bold text-slate-900">
                          NPR {openLoanTotal.toLocaleString()}
                        </span>
                        {openLoanInstallmentTotal > 0 && (
                          <>
                            {' · Monthly: '}
                            <span className="font-mono tabular-nums font-semibold text-slate-800">
                              NPR {openLoanInstallmentTotal.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                              <th className="py-2 px-3">Account No.</th>
                              <th className="py-2 px-3">Loan Product</th>
                              <th className="py-2 px-3">Issue / Maturity (BS)</th>
                              <th className="py-2 px-3 text-right">Loan Amount</th>
                              <th className="py-2 px-3 text-right">Installment</th>
                              <th className="py-2 px-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {memberAllLoans.map(loan => {
                              const loanEffStatus = getEffectiveLoanStatus(loan);
                              const issueDate = loan.loanDateBs || loan.loanDate || '—';
                              const matDate = loan.maturityDate || '—';
                              return (
                                <tr key={loan.id} className="hover:bg-slate-50/70">
                                  <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                                    {loan.accountNo || '—'}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-medium text-slate-800">{loan.loanProduct || 'Group Loan'}</div>
                                    <div className="text-[10px] font-mono tabular-nums text-slate-500">
                                      {loan.interestRate || 0}% · {loan.totalInstallments || 0} mos
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                    <div>{issueDate} → {matDate}</div>
                                    {loanEffStatus === 'CLOSED' && (loan.closedDateBs || loan.closedDate) && (
                                      <div className="text-[10px] text-slate-400">
                                        Closed: {loan.closedDateBs || loan.closedDate}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                                    NPR {(Number(loan.loanAmount) || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                                    NPR {(Number(loan.installmentAmount) || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                    <span className={`font-semibold ${
                                      loanEffStatus === 'ACTIVE'
                                        ? 'text-emerald-700'
                                        : loanEffStatus === 'MATURED'
                                          ? 'text-amber-700'
                                          : 'text-slate-400'
                                    }`}>
                                      {loanEffStatus === 'ACTIVE'
                                        ? 'Active'
                                        : loanEffStatus === 'MATURED'
                                          ? 'Matured'
                                          : 'Closed'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                            {memberAllLoans.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-5 text-center text-slate-400">
                                  No loan accounts found for this member.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  {canViewIdCard && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsViewMemberModalOpen(false);
                        setSelectedMemberToView(null);
                        setActiveTab('reports');
                        setReportTab('id-card');
                      }}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-[#00593B]" />
                      <span>ID Card</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isDayEnded && canEditMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedMemberToView;
                        setIsViewMemberModalOpen(false);
                        setSelectedMemberToView(null);
                        handleEditMember(target);
                      }}
                      className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setIsViewMemberModalOpen(false); setSelectedMemberToView(null); }}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: DEACTIVATE / ACTIVATE MEMBER CONFIRMATION */}
      {/* ============================================================== */}
      {isToggleMemberStatusModalOpen && selectedMemberToToggleStatus && (() => {
        const isCurrentlyActive = getEffectiveMemberStatus(selectedMemberToToggleStatus.status) === 'ACTIVE';
        return (
          <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
                isCurrentlyActive ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {isCurrentlyActive ? <UserX className="w-7 h-7" /> : <UserCheck className="w-7 h-7" />}
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isCurrentlyActive ? 'Are you sure you want to deactivate?' : 'Are you sure you want to activate?'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Member <strong className="font-mono text-slate-800">{selectedMemberToToggleStatus.memberId}</strong> (<strong>{selectedMemberToToggleStatus.name}</strong>) will be moved to the <strong>{isCurrentlyActive ? 'Inactive' : 'Active'}</strong> list.
                </p>
                {(selectedMemberToToggleStatus.centerName || selectedMemberToToggleStatus.samuhName) && (
                  <div className={`mt-2.5 p-2.5 rounded-xl text-[11px] font-semibold border ${
                    isCurrentlyActive
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    {selectedMemberToToggleStatus.centerName}
                    {selectedMemberToToggleStatus.centerName && selectedMemberToToggleStatus.samuhName ? ' • ' : ''}
                    {selectedMemberToToggleStatus.samuhName}
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsToggleMemberStatusModalOpen(false); setSelectedMemberToToggleStatus(null); }}
                  className="min-w-[96px] px-5 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  No
                </button>
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={handleConfirmToggleMemberStatus}
                  className={`min-w-[96px] px-5 py-2 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isCurrentlyActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: DEACTIVATE / ACTIVATE SAVING ACCOUNT CONFIRMATION */}
      {/* ============================================================== */}
      {isToggleSavingStatusModalOpen && selectedSavingToToggleStatus && (() => {
        const isCurrentlyActive = getEffectiveSavingStatus(selectedSavingToToggleStatus) !== 'CLOSED';
        return (
          <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
                isCurrentlyActive ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {isCurrentlyActive ? <Ban className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isCurrentlyActive ? 'Are you sure you want to deactivate?' : 'Are you sure you want to activate?'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Saving account <strong className="font-mono text-slate-800">{selectedSavingToToggleStatus.accountNo}</strong> (<strong>{selectedSavingToToggleStatus.name}</strong>) will be moved to the <strong>{isCurrentlyActive ? 'Close' : 'Active'}</strong> list.
                </p>
                <div className={`mt-2.5 p-2.5 rounded-xl text-[11px] font-semibold border ${
                  isCurrentlyActive
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  Member ID: {selectedSavingToToggleStatus.memberId} • Recurring: NPR {selectedSavingToToggleStatus.amount.toLocaleString()}
                  {selectedSavingToToggleStatus.groupName ? ` • ${selectedSavingToToggleStatus.groupName}` : ''}
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsToggleSavingStatusModalOpen(false); setSelectedSavingToToggleStatus(null); }}
                  className="min-w-[96px] px-5 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  No
                </button>
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={handleConfirmToggleSavingStatus}
                  className={`min-w-[96px] px-5 py-2 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isCurrentlyActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL: DELETE MEMBER CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteMemberModalOpen && selectedMemberToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Are you sure you want to delete?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Member <strong className="font-mono text-slate-800">{selectedMemberToDelete.memberId}</strong> (<strong>{selectedMemberToDelete.name}</strong>) will be permanently deleted.
              </p>
              {(selectedMemberToDelete.centerName || selectedMemberToDelete.samuhName) && (
                <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                  {selectedMemberToDelete.centerName}{selectedMemberToDelete.centerName && selectedMemberToDelete.samuhName ? ' • ' : ''}{selectedMemberToDelete.samuhName}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteMemberModalOpen(false); setSelectedMemberToDelete(null); }}
                className="min-w-[96px] px-5 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
              >
                No
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteMember}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Member'}
                className="min-w-[96px] px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ACTION BLOCKED (ACTIVE ACCOUNTS / LINKED RECORDS GUARD) */}
      {/* ============================================================== */}
      {actionBlockNotice && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4"
          onClick={() => setActionBlockNotice(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-amber-200 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold text-slate-900">{actionBlockNotice.title}</h3>
                <p className="text-xs font-bold text-amber-800 truncate mt-0.5">{actionBlockNotice.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setActionBlockNotice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-amber-100/60 cursor-pointer"
                aria-label="Close warning"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {actionBlockNotice.message}
              </p>

              {actionBlockNotice.items.length > 0 && (
                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
                  {actionBlockNotice.items.map((item, idx) => (
                    <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{item.label}</div>
                        <div className="text-[11px] text-slate-500 truncate">{item.detail}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                        item.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.status === 'MATURED'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {actionBlockNotice.hint && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 font-semibold">
                  {actionBlockNotice.hint}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                {actionBlockNotice.showGoToSaving && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionBlockNotice(null);
                      setActiveTab('saving');
                    }}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Go to Saving
                  </button>
                )}
                {actionBlockNotice.showGoToLoan && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionBlockNotice(null);
                      setActiveTab('loan');
                    }}
                    className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Go to Loan
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActionBlockNotice(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  OK, Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: BULK EXCEL UPLOAD & SAMPLE DOWNLOAD */}
      {/* ============================================================== */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1d4ed8] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                <h3 className="text-sm font-extrabold tracking-wide">Bulk Upload {bulkType}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={isDayEnded}
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void handleBulkFileSelected(file);
                  e.target.value = '';
                }}
              />

              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (isDayEnded) return;
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleBulkFileSelected(file);
                }}
                className="p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>

                {bulkFileName ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                    <div className="font-extrabold truncate">{bulkFileName}</div>
                    <div className="text-[11px] font-bold text-emerald-700">
                      {bulkParsedRows.length} row(s) ready to create in {bulkType}
                    </div>
                    <button
                      type="button"
                      disabled={isDayEnded}
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Choose a different file
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      disabled={isDayEnded}
                      onClick={() => bulkFileInputRef.current?.click()}
                      title={isDayEnded ? 'Day Ended - Action Locked' : 'Select Excel File'}
                      className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl font-bold text-slate-800 shadow-2xs cursor-pointer inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>Select Excel File</span>
                    </button>
                  </div>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadBulkSampleExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[11px] font-bold text-blue-700 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Sample Excel</span>
                  </button>
                </div>
              </div>

              {bulkUploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-[11px]">
                  {bulkUploadError}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isBulkUploading || isDayEnded}
                onClick={() => void handleProcessBulkUpload()}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Upload File'}
                className="px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                {isBulkUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isBulkUploading
                    ? 'Uploading...'
                    : bulkParsedRows.length > 0
                    ? `Upload File (${bulkParsedRows.length})`
                    : 'Upload File'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: BULK UPLOAD SUCCESS NARRATION */}
      {/* ============================================================== */}
      {bulkUploadSuccess && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/75 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900">Data Successfully Uploaded</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>{bulkUploadSuccess.count}</strong> {bulkUploadSuccess.entityType} record(s) have been successfully uploaded and saved
                {bulkUploadSuccess.fileName ? ` from "${bulkUploadSuccess.fileName}"` : ''}.
              </p>
              {bulkUploadSuccess.skippedCount && bulkUploadSuccess.skippedCount > 0 && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold">
                  {bulkUploadSuccess.skippedMessage ||
                    `${bulkUploadSuccess.skippedCount} duplicate / unclosed loan row(s) were skipped.`}
                </div>
              )}
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setBulkUploadSuccess(null)}
                className="min-w-[120px] px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ALREADY GENERATED WARNING (ONCE PER YEAR & MONTH) */}
      {/* ============================================================== */}
      {alreadyGeneratedNotice && (
        <div
          className="fixed inset-0 z-[10010] bg-slate-950/75 backdrop-blur-xs flex justify-center items-center p-4"
          onClick={() => setAlreadyGeneratedNotice(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-amber-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900">Already Generated</h3>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                You have already generated <strong>{alreadyGeneratedNotice.reportName}</strong> for{' '}
                <strong>{alreadyGeneratedNotice.groupName}</strong> ({alreadyGeneratedNotice.periodLabel}).
              </p>
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold space-y-0.5">
                {alreadyGeneratedNotice.existingDetail && <div>{alreadyGeneratedNotice.existingDetail}</div>}
                <div>Only one {alreadyGeneratedNotice.reportName} can be generated per Year &amp; Month.</div>
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setAlreadyGeneratedNotice(null)}
                className="min-w-[120px] px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
