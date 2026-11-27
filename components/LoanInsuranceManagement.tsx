import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { 
  LineChart, Upload, FileText, Heart, Bell,
  ShieldCheck, Plus, Search, Download, Printer, 
  CheckCircle2, Clock, 
  Trash2, Edit3, Eye, Sparkles,
  HeartHandshake,
  TrendingUp, Award, RefreshCw, X,
  FileSpreadsheet, ArrowRight, Ban, Calendar,
  Database, AlertCircle,
  User, Building2, CreditCard, Lock, Megaphone,
  UserCheck, Camera, ArrowLeft, Save
} from 'lucide-react';
import { 
  LoanInsuranceRecord, 
  InsuranceClaimRecord, 
  InsurancePartnerCompany,
  ClaimLifecycleStage,
  ClaimStatusType,
  LoanInsuranceStatus,
  Branch
} from '../types';
import { 
  loanInsuranceService, 
  ExtractedOcrData,
  convertAdToBs,
  convertBsToAd,
  calculatePremium
} from '../services/loanInsuranceService';
import { microFinanceService } from '../services/microFinanceService';
import { useAuth } from '../AuthContext';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';
import {
  resolveCanonicalBranchKey,
  findMatchingBranch,
  parseUserInsuranceBranchAccess
} from '../utils/mfBranchFilter';
import { InsuranceNoticePanel } from './InsuranceNoticePanel';
import { InsuranceClaimsPanel } from './InsuranceClaimsPanel';

export const LoanInsuranceManagement: React.FC = () => {
  const { user, role, branch, branches, isSuperAdmin, hasPermission, refreshUser, refreshRoles, settings } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  
  // Navigation active menu (Top Menu format: Dashboard, Upload Policy, Report, Maturity Alerts, Claim, Notice)
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'upload' | 'report' | 'alerts' | 'claims' | 'notice'>('dashboard');

  // Refresh user & role permissions once on mount (AuthContext already listens for userPermissionsUpdated globally)
  const hasSyncedPermsRef = useRef(false);
  useEffect(() => {
    if (hasSyncedPermsRef.current) return;
    hasSyncedPermsRef.current = true;
    void refreshUser().catch(() => {});
    void refreshRoles().catch(() => {});
  }, [refreshUser, refreshRoles]);

  // Granular Role & User Permission Checks (synced with Admin Center -> Role & Permission Management)
  const insPermState = useMemo(() => {
    const rolePerms = Array.isArray(role?.permissions) ? role.permissions : [];
    const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];
    const roleHasGranular = rolePerms.some(p => typeof p === 'string' && p.startsWith('sub_'));
    const combined = roleHasGranular
      ? new Set<string>(rolePerms)
      : new Set<string>([...userPerms, ...rolePerms]);
    const hasGranularIns = Array.from(combined).some(p => typeof p === 'string' && p.startsWith('sub_ins_'));
    return { combined, hasGranularIns };
  }, [user?.permissions, role?.permissions]);

  const canInsAccess = useCallback(
    (subKey: 'ins_dashboard' | 'ins_upload' | 'ins_report' | 'ins_alerts' | 'ins_claims' | 'ins_notice', mode: 'view' | 'edit' | 'delete' = 'view'): boolean => {
      if (isSuperAdmin) return true;
      if (!insPermState.hasGranularIns) {
        if (mode === 'view') return hasPermission('view_insurance');
        if (mode === 'edit') return hasPermission('add_transaction') || hasPermission('edit_transaction');
        return hasPermission('delete_transaction');
      }
      if (mode === 'view') {
        return (
          insPermState.combined.has(`sub_${subKey}_view`) ||
          insPermState.combined.has(`sub_${subKey}_edit`) ||
          insPermState.combined.has(`sub_${subKey}_delete`)
        );
      }
      return insPermState.combined.has(`sub_${subKey}_${mode}`);
    },
    [isSuperAdmin, insPermState, hasPermission]
  );

  const canViewInsDashboard = canInsAccess('ins_dashboard', 'view');
  const canEditInsDashboard = canInsAccess('ins_dashboard', 'edit');
  const canDeleteInsDashboard = canInsAccess('ins_dashboard', 'delete');
  const canViewInsUpload = canInsAccess('ins_upload', 'view');
  const canEditInsUpload = canInsAccess('ins_upload', 'edit');
  const canViewInsReport = canInsAccess('ins_report', 'view');
  const canEditInsReport = canInsAccess('ins_report', 'edit');
  const canDeleteInsReport = canInsAccess('ins_report', 'delete');
  const canViewInsAlerts = canInsAccess('ins_alerts', 'view');
  const canEditInsAlerts = canInsAccess('ins_alerts', 'edit');
  const canViewInsClaims = canInsAccess('ins_claims', 'view');
  const canEditInsClaims = canInsAccess('ins_claims', 'edit');
  const canDeleteInsClaims = canInsAccess('ins_claims', 'delete');
  const canViewInsNotice = canInsAccess('ins_notice', 'view');
  const canEditInsNotice = canInsAccess('ins_notice', 'edit');
  const canDeleteInsNotice = canInsAccess('ins_notice', 'delete');

  const canRenewFromDashboard = canEditInsDashboard || canEditInsReport;
  const canRenewFromAlerts = canEditInsAlerts || canEditInsReport;
  const canDeletePolicy = canDeleteInsReport || canDeleteInsDashboard;
  const hasAnyInsuranceViewAccess =
    canViewInsDashboard || canViewInsUpload || canViewInsReport || canViewInsAlerts || canViewInsClaims || canViewInsNotice;

  // Auto-select first permitted Insurance tab when permissions restrict the active tab
  useEffect(() => {
    const allowedMenus: Array<'dashboard' | 'upload' | 'report' | 'alerts' | 'claims' | 'notice'> = [];
    if (canViewInsDashboard) allowedMenus.push('dashboard');
    if (canViewInsUpload) allowedMenus.push('upload');
    if (canViewInsReport) allowedMenus.push('report');
    if (canViewInsAlerts) allowedMenus.push('alerts');
    if (canViewInsClaims) allowedMenus.push('claims');
    if (canViewInsNotice) allowedMenus.push('notice');
    if (allowedMenus.length > 0 && !allowedMenus.includes(activeMenu)) {
      setActiveMenu(allowedMenus[0]);
    }
  }, [activeMenu, canViewInsDashboard, canViewInsUpload, canViewInsReport, canViewInsAlerts, canViewInsClaims, canViewInsNotice]);

  // Available cooperative branches with safe fallback
  const availableBranches = useMemo<Branch[]>(() => {
    if (Array.isArray(branches) && branches.length > 0) return branches;
    return [
      { id: 'main', name: 'Ratauli Central Head Office', code: 'C01', status: 'Active', createdAt: 0 },
      { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', status: 'Active', createdAt: 0 },
      { id: 'pipra', name: 'Pipra Branch', code: 'C03', status: 'Active', createdAt: 0 },
      { id: 'parsa', name: 'Parsa Branch', code: 'C04', status: 'Active', createdAt: 0 }
    ];
  }, [branches]);

  // Branch Scope:
  // - Super Admin: All branches + branch-wise filter dropdown
  // - Role / User granted 'All Branches' or 'Selected Branches': designated branches + branch-wise filter dropdown
  // - Standard branch user (default): strictly sees ONLY their logged-in branch
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

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

  const userInsBranchAccess = useMemo(
    () => parseUserInsuranceBranchAccess(user?.permissions, role?.permissions, loggedInBranchKey, availableBranches),
    [user?.permissions, role?.permissions, loggedInBranchKey, availableBranches]
  );

  const hasAllInsBranchesAccess = isSuperAdmin || userInsBranchAccess.mode === 'all';
  const canSwitchInsBranchView = isSuperAdmin || userInsBranchAccess.canSwitchViewBranch;

  const selectableInsBranches = useMemo(() => {
    if (hasAllInsBranchesAccess) return availableBranches;
    if (userInsBranchAccess.mode === 'selected') {
      const allowedSet = new Set(userInsBranchAccess.allowedBranchKeys);
      const matched = availableBranches.filter(b =>
        allowedSet.has(resolveCanonicalBranchKey(b.id, availableBranches))
      );
      return matched.length > 0 ? matched : availableBranches;
    }
    return loggedInBranchObj ? [loggedInBranchObj] : availableBranches.slice(0, 1);
  }, [hasAllInsBranchesAccess, userInsBranchAccess, availableBranches, loggedInBranchObj]);

  // Reset branch filter if the user's allowed branch list changes and excludes the current selection
  useEffect(() => {
    if (selectedBranchFilter === 'ALL') return;
    const targetKey = resolveCanonicalBranchKey(selectedBranchFilter, availableBranches);
    const stillAllowed = selectableInsBranches.some(
      b => resolveCanonicalBranchKey(b.id, availableBranches) === targetKey
    );
    if (!stillAllowed) {
      setSelectedBranchFilter('ALL');
    }
  }, [selectedBranchFilter, selectableInsBranches, availableBranches]);

  const effectiveInsBranchKeys = useMemo(() => {
    if (hasAllInsBranchesAccess) {
      if (!selectedBranchFilter || selectedBranchFilter === 'ALL') return [];
      const single = resolveCanonicalBranchKey(selectedBranchFilter, availableBranches);
      return single ? [single] : [];
    }
    if (userInsBranchAccess.mode === 'selected') {
      if (!selectedBranchFilter || selectedBranchFilter === 'ALL') {
        return userInsBranchAccess.allowedBranchKeys;
      }
      const single = resolveCanonicalBranchKey(selectedBranchFilter, availableBranches);
      if (single && userInsBranchAccess.allowedBranchKeys.includes(single)) {
        return [single];
      }
      return userInsBranchAccess.allowedBranchKeys;
    }
    return loggedInBranchKey ? [loggedInBranchKey] : [];
  }, [hasAllInsBranchesAccess, userInsBranchAccess, selectedBranchFilter, loggedInBranchKey, availableBranches]);

  // Raw Data states (full multi-branch datasets from service & Supabase)
  const [rawRecords, setRawRecords] = useState<LoanInsuranceRecord[]>(() => loanInsuranceService.getRecords());
  const [rawClaims, setRawClaims] = useState<InsuranceClaimRecord[]>(() => loanInsuranceService.getClaims());
  const [companies, setCompanies] = useState<InsurancePartnerCompany[]>(() => loanInsuranceService.getCompanies());

  // Branch-Scoped Datasets used across Dashboard, Report, Maturity Alerts, Claims, and Excel Export
  const records = useMemo(() => {
    if (effectiveInsBranchKeys.length === 0) return rawRecords;
    const allowedSet = new Set(effectiveInsBranchKeys);
    return rawRecords.filter(r => {
      const key = resolveCanonicalBranchKey(r.branchId || '1', availableBranches) || 'main';
      return allowedSet.has(key);
    });
  }, [rawRecords, effectiveInsBranchKeys, availableBranches]);

  const claims = useMemo(() => {
    if (effectiveInsBranchKeys.length === 0) return rawClaims;
    const allowedSet = new Set(effectiveInsBranchKeys);
    return rawClaims.filter(c => {
      const key = resolveCanonicalBranchKey(c.branchId || '1', availableBranches) || 'main';
      return allowedSet.has(key);
    });
  }, [rawClaims, effectiveInsBranchKeys, availableBranches]);
  
  // Report Tab Filter Pills (from image 3)
  // 'all' | 'active' | 'first_policy' | 'closed' | 'expired' | 'renewal' | 'reject' | 'premium' | 'statement'
  const [reportFilter, setReportFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Clear report search whenever switching between Report sub-menus or main Insurance tabs
  useEffect(() => {
    setSearchQuery('');
  }, [reportFilter, activeMenu]);

  const handleSelectReportFilter = (nextFilter: string) => {
    setSearchQuery('');
    setReportFilter(nextFilter);
  };

  // Maturity Alerts Period Filter (from image 4)
  // 'all' | 'today' | 'tomorrow' | 'week' | 'month'
  const [alertPeriod, setAlertPeriod] = useState<'all' | 'today' | 'tomorrow' | 'week' | 'month'>('all');

  // Dashboard Action Queue Switcher ('expired' | 'upcoming')
  const [dashboardAttentionTab, setDashboardAttentionTab] = useState<'expired' | 'upcoming'>('expired');

  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const period = params.get('period');
    if (tab === 'alerts' && canViewInsAlerts) {
      setActiveMenu('alerts');
    } else if ((tab === 'claims' || tab === 'claim') && canViewInsClaims) {
      setActiveMenu('claims');
    } else if (tab === 'notice' && canViewInsNotice) {
      setActiveMenu('notice');
    } else if (tab === 'dashboard' && canViewInsDashboard) {
      setActiveMenu('dashboard');
    } else if (tab === 'upload' && canViewInsUpload) {
      setActiveMenu('upload');
    } else if (tab === 'report' && canViewInsReport) {
      setActiveMenu('report');
    }
    if (period === 'today' || period === 'tomorrow' || period === 'week' || period === 'month' || period === 'all') {
      setAlertPeriod(period);
    }
  }, [location.search, canViewInsAlerts, canViewInsClaims, canViewInsNotice, canViewInsDashboard, canViewInsUpload, canViewInsReport]);

  // Modals state
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isHistoryViewModalOpen, setIsHistoryViewModalOpen] = useState(false);
  const [isKycViewOpen, setIsKycViewOpen] = useState(false);
  const [kycForm, setKycForm] = useState<{
    memberId: string;
    memberName: string;
    citizenshipNo: string;
    contactNumber: string;
    gender: 'Male' | 'Female' | 'Other';
    age: string;
    dateOfBirthBs: string;
    dateOfBirth: string;
    address: string;
    occupation: string;
    nomineeName: string;
    nomineeRelation: string;
    nomineeContact: string;
    nomineeCitizenship: string;
    memberPhoto: string;
  }>({
    memberId: '',
    memberName: '',
    citizenshipNo: '',
    contactNumber: '',
    gender: 'Female',
    age: '',
    dateOfBirthBs: '',
    dateOfBirth: '',
    address: '',
    occupation: '',
    nomineeName: '',
    nomineeRelation: '',
    nomineeContact: '',
    nomineeCitizenship: '',
    memberPhoto: ''
  });
  const [kycSavedNotice, setKycSavedNotice] = useState<string | null>(null);
  const [policyViewTab, setPolicyViewTab] = useState<'detail' | 'history' | 'combined'>('combined');
  const kycPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [isSettlementReceiptModalOpen, setIsSettlementReceiptModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumTargetPolicy, setPremiumTargetPolicy] = useState<LoanInsuranceRecord | null>(null);
  const [premiumForm, setPremiumForm] = useState({
    loanDateBs: '',
    loanDateAd: '',
    maturityDateBs: '',
    maturityDateAd: '',
    loanDurationYears: 5,
    insuranceTermMonths: 60,
    insuranceStartDateBs: '',
    insuranceStartDateAd: '',
    insuranceTillDateBs: '',
    insuranceTillDateAd: '',
    loanAmount: 0,
    premiumAmount: 0,
    loanTermYears: 5,
    paidYears: 3,
    paymentRemark: '',
    notes: ''
  });

  // Active items for modals
  const [editingPolicy, setEditingPolicy] = useState<LoanInsuranceRecord | null>(null);
  const [renewingPolicy, setRenewingPolicy] = useState<LoanInsuranceRecord | null>(null);
  const [deactivatingPolicy, setDeactivatingPolicy] = useState<LoanInsuranceRecord | null>(null);
  const [deactivationRemark, setDeactivationRemark] = useState('');
  const [editingClaim, setEditingClaim] = useState<InsuranceClaimRecord | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<LoanInsuranceRecord | null>(null);
  const [settlementClaim, setSettlementClaim] = useState<InsuranceClaimRecord | null>(null);

  // QR Code State
  const [certificateQrCodeUrl, setCertificateQrCodeUrl] = useState<string>('');
  const [settlementQrCodeUrl, setSettlementQrCodeUrl] = useState<string>('');

  // Helper formatters for clean branch labels
  const formatBranchLabel = useCallback((branchId?: string | number): string => {
    const raw = String(branchId ?? '').trim();
    if (!raw || raw === 'Select Branch') return 'Head Office';
    const lower = raw.toLowerCase();

    if (lower === '1' || lower === 'main' || lower === 'c01' || lower === 'head office' || lower === 'ratauli head office' || lower.includes('ratauli')) {
      return 'Head Office';
    }
    if (lower === '2' || lower === 'sahodba' || lower === 'c02' || lower.includes('sahodba')) {
      return 'Sahodba Branch';
    }
    if (lower === '3' || lower === 'pipra' || lower === 'c03' || lower.includes('pipra')) {
      return 'Pipra Branch';
    }
    if (lower === '4' || lower === 'parsa' || lower === 'c04' || lower.includes('parsa')) {
      return 'Parsa Branch';
    }

    const matched = availableBranches.find(
      b =>
        String(b.id).toLowerCase() === lower ||
        String(b.code || '').toLowerCase() === lower ||
        String(b.name || '').toLowerCase() === lower
    );
    if (matched?.name) return matched.name;

    return raw;
  }, [availableBranches]);

  const defaultBranchLabel = useMemo(() => {
    if (canSwitchInsBranchView && selectedBranchFilter && selectedBranchFilter !== 'ALL') {
      return formatBranchLabel(selectedBranchFilter);
    }
    return formatBranchLabel(loggedInBranchObj?.id || loggedInBranchObj?.name || branch?.id || 'main');
  }, [canSwitchInsBranchView, selectedBranchFilter, loggedInBranchObj, branch?.id, formatBranchLabel]);

  // Policy Form State matching image_85c066c5.png
  const getInitialPolicyForm = (): Partial<LoanInsuranceRecord> => {
    const todayStr = new Date().toISOString().split('T')[0];
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const expiryStr = expiryDate.toISOString().split('T')[0];

    return {
      memberName: '',
      gender: 'Select Gender' as unknown as 'Male' | 'Female' | 'Other',
      citizenshipNo: '',
      memberId: '',
      policyNo: '',
      dateOfBirthBs: '',
      dateOfBirth: '',
      age: 0,
      address: '',
      policyStartDateBs: '',
      policyStartDate: todayStr,
      termMonths: 12,
      policyExpiryDate: expiryStr,
      policyExpiryDateBs: convertAdToBs(expiryStr),
      loanAmount: 0,
      premiumAmount: 0,
      occupation: '',
      disability: 'No',
      livingActiveLife: 'yes',
      livingStatus: 'Active / Normal Life',
      branchId: defaultBranchLabel,
      nomineeName: '',
      nomineeRelation: '',
      nomineeDobBs: '',
      nomineeDob: '',
      loanType: '',
      status: 'Active',
      premiumPaymentStatus: 'Due',
      premiumPaymentRemark: '',
      notes: ''
    };
  };

  const [policyForm, setPolicyForm] = useState<Partial<LoanInsuranceRecord>>(getInitialPolicyForm);

  // Date and value auto-calculations matching image_85c066c5.png
  const handleDobAdChange = (adDate: string) => {
    const bs = adDate ? convertAdToBs(adDate) : '';
    let calcAge = policyForm.age ?? 0;
    if (adDate) {
      const birthYear = new Date(adDate).getFullYear();
      const currYear = new Date().getFullYear();
      if (!isNaN(birthYear) && birthYear > 1900 && birthYear <= currYear) {
        calcAge = currYear - birthYear;
      }
    }
    setPolicyForm(prev => ({
      ...prev,
      dateOfBirth: adDate,
      dateOfBirthBs: bs,
      age: calcAge
    }));
  };

  const handleDobBsChange = (bsDate: string) => {
    const ad = bsDate ? convertBsToAd(bsDate) : '';
    let calcAge = policyForm.age ?? 0;
    if (ad) {
      const birthYear = new Date(ad).getFullYear();
      const currYear = new Date().getFullYear();
      if (!isNaN(birthYear) && birthYear > 1900 && birthYear <= currYear) {
        calcAge = currYear - birthYear;
      }
    }
    setPolicyForm(prev => ({
      ...prev,
      dateOfBirthBs: bsDate,
      dateOfBirth: ad || prev.dateOfBirth,
      age: calcAge
    }));
  };

  const handleDocAdChange = (startDateAd: string) => {
    const startDateBs = startDateAd ? convertAdToBs(startDateAd) : '';
    let maturityAd = '';
    let maturityBs = '';
    const months = policyForm.termMonths ?? 12;
    if (startDateAd) {
      const d = new Date(startDateAd);
      d.setMonth(d.getMonth() + months);
      maturityAd = d.toISOString().split('T')[0];
      maturityBs = convertAdToBs(maturityAd);
    }
    setPolicyForm(prev => ({
      ...prev,
      policyStartDate: startDateAd,
      policyStartDateBs: startDateBs,
      policyExpiryDate: maturityAd,
      policyExpiryDateBs: maturityBs
    }));
  };

  const handleDocBsChange = (bsDate: string) => {
    const ad = bsDate ? convertBsToAd(bsDate) : '';
    let maturityAd = '';
    let maturityBs = '';
    const months = policyForm.termMonths ?? 12;
    if (ad) {
      const d = new Date(ad);
      d.setMonth(d.getMonth() + months);
      maturityAd = d.toISOString().split('T')[0];
      maturityBs = convertAdToBs(maturityAd);
    }
    setPolicyForm(prev => ({
      ...prev,
      policyStartDateBs: bsDate,
      policyStartDate: ad || prev.policyStartDate,
      policyExpiryDate: maturityAd,
      policyExpiryDateBs: maturityBs
    }));
  };

  const handleMaturityDateAdChange = (adDate: string) => {
    const bs = adDate ? convertAdToBs(adDate) : '';
    setPolicyForm(prev => ({
      ...prev,
      policyExpiryDate: adDate,
      policyExpiryDateBs: bs
    }));
  };

  const handleTermMonthChange = (months: number) => {
    let maturityAd = '';
    let maturityBs = '';
    const startDateAd = policyForm.policyStartDate;
    if (startDateAd && months > 0) {
      const d = new Date(startDateAd);
      d.setMonth(d.getMonth() + months);
      maturityAd = d.toISOString().split('T')[0];
      maturityBs = convertAdToBs(maturityAd);
    }
    const loanAmt = policyForm.loanAmount || 0;
    const prem = calculatePremium(loanAmt, months);
    setPolicyForm(prev => ({
      ...prev,
      termMonths: months,
      policyExpiryDate: maturityAd,
      policyExpiryDateBs: maturityBs,
      premiumAmount: prem
    }));
  };

  const handlePolicyAmountChange = (amount: number) => {
    const months = policyForm.termMonths ?? 12;
    const prem = calculatePremium(amount, months);
    setPolicyForm(prev => ({
      ...prev,
      loanAmount: amount,
      sumAssured: amount,
      outstandingBalance: amount,
      premiumAmount: prem
    }));
  };

  const handleNomineeDobAdChange = (adDate: string) => {
    const bs = adDate ? convertAdToBs(adDate) : '';
    setPolicyForm(prev => ({
      ...prev,
      nomineeDob: adDate,
      nomineeDobBs: bs
    }));
  };

  const handleNomineeDobBsChange = (bsDate: string) => {
    const ad = bsDate ? convertBsToAd(bsDate) : '';
    setPolicyForm(prev => ({
      ...prev,
      nomineeDobBs: bsDate,
      nomineeDob: ad || prev.nomineeDob
    }));
  };
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [isUploadFormVisible, setIsUploadFormVisible] = useState(false);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // Excel Bulk Import States
  const [excelPreviewRows, setExcelPreviewRows] = useState<Partial<LoanInsuranceRecord>[]>([]);
  const [isExcelParsing, setIsExcelParsing] = useState(false);
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const quickUploadInputRef = useRef<HTMLInputElement>(null);

  // Renewal Form State matching image_7c9690b7.png
  const [renewalForm, setRenewalForm] = useState({
    existingDateBs: '',
    existingDateAd: '',
    existingMaturityBs: '',
    existingMaturityAd: '',
    savedExistingSuccess: false,
    newRenewDateBs: '',
    newRenewDateAd: '',
    newMaturityDateBs: '',
    newMaturityDateAd: '',
    loanDurationYears: 1,
    insuranceTermMonths: 12,
    insuranceStartDateBs: '',
    insuranceStartDateAd: '',
    insuranceTillDateBs: '',
    insuranceTillDateAd: '',
    renewalAmount: 200000,
    premiumAmount: 700,
    oldLoanTermYears: 1,
    oldPaidYears: 0,
    oldPolicyPremiumStatus: 'DUE',
    oldPaidRemark: '',
    newLoanTermYears: 1,
    newPaidYears: 0,
    newPolicyPremiumStatus: 'DUE',
    newPaidRemark: '',
    renewalRemark: ''
  });

  // Claim Form State
  const initialClaimForm: Partial<InsuranceClaimRecord> = {
    claimNo: '',
    insuranceRecordId: '',
    policyNo: '',
    memberId: '',
    memberName: '',
    loanAccountNo: '',
    branchId: branch?.id || '1',
    claimDate: new Date().toISOString().split('T')[0],
    claimDateBs: convertAdToBs(new Date().toISOString().split('T')[0]),
    incidentDate: new Date().toISOString().split('T')[0],
    incidentDateBs: convertAdToBs(new Date().toISOString().split('T')[0]),
    claimCause: 'Borrower Demise',
    outstandingLoanAtClaim: 0,
    claimAmountRequested: 0,
    claimAmountApproved: 0,
    disbursedAmount: 0,
    payoutMethod: 'Direct Account Transfer',
    lifecycleStage: 'Claim Submission',
    status: 'Submitted',
    insurerReferenceNo: '',
    settlementDate: '',
    settlementVoucherNo: '',
    remarks: '',
    supportingDocuments: ['Citizenship Copy', 'Loan Agreement Deed']
  };

  const [claimForm, setClaimForm] = useState<Partial<InsuranceClaimRecord>>(initialClaimForm);

  // Refresh data from local service immediately; optionally sync from Supabase when explicitly requested
  const refreshData = (options?: { syncRemote?: boolean }) => {
    setRawRecords(loanInsuranceService.getRecords());
    setRawClaims(loanInsuranceService.getClaims());
    setCompanies(loanInsuranceService.getCompanies());
    if (options?.syncRemote) {
      void loanInsuranceService.syncAllFromSupabase().then(res => {
        setRawRecords(res.records);
        setRawClaims(res.claims);
        setCompanies(res.companies);
      });
    }
  };

  useEffect(() => {
    void loanInsuranceService.syncAllFromSupabase().then(res => {
      setRawRecords(res.records);
      setRawClaims(res.claims);
      setCompanies(res.companies);
    });
  }, []);

  // Generate QR Code when viewing policy certificate
  useEffect(() => {
    if (viewingPolicy) {
      const qrData = `RATAULI COOPERATIVE LOAN INSURANCE\nPolicy: ${viewingPolicy.policyNo}\nMember: ${viewingPolicy.memberName || viewingPolicy.name}\nSum Assured: NPR ${(viewingPolicy.sumAssured || viewingPolicy.loanAmount).toLocaleString()}\nTerm: ${viewingPolicy.policyStartDate} to ${viewingPolicy.policyExpiryDate}\nStatus: Verified Active`;
      QRCode.toDataURL(qrData, { width: 140, margin: 1 })
        .then(url => setCertificateQrCodeUrl(url))
        .catch(() => setCertificateQrCodeUrl(''));
    }
  }, [viewingPolicy]);

  // Generate QR Code when viewing settlement receipt
  useEffect(() => {
    if (settlementClaim) {
      const qrData = `RATAULI COOPERATIVE CLAIM SETTLEMENT\nClaim No: ${settlementClaim.claimNo}\nPolicy: ${settlementClaim.policyNo}\nClaimant: ${settlementClaim.memberName}\nDisbursed: NPR ${(settlementClaim.disbursedAmount || settlementClaim.claimAmountApproved || 0).toLocaleString()}\nVoucher: ${settlementClaim.settlementVoucherNo || 'VCH-CLM-FINAL'}`;
      QRCode.toDataURL(qrData, { width: 120, margin: 1 })
        .then(url => setSettlementQrCodeUrl(url))
        .catch(() => setSettlementQrCodeUrl(''));
    }
  }, [settlementClaim]);

  const formatTermLabel = (r: LoanInsuranceRecord): string => {
    if (r.loanDurationYears && r.loanDurationYears > 0) {
      return `${r.loanDurationYears} ${r.loanDurationYears === 1 ? 'yr' : 'yrs'}`;
    }
    if (r.termMonths && r.termMonths > 0) {
      if (r.termMonths % 12 === 0) {
        const yrs = r.termMonths / 12;
        return `${yrs} ${yrs === 1 ? 'yr' : 'yrs'}`;
      }
      return `${r.termMonths} mo`;
    }
    return '1 yr';
  };

  // Summary Metrics & Dashboard Analytics (100% derived from real records & claims)
  const summaryMetrics = useMemo(() => {
    const now = new Date();
    const monthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const isHiddenInTab = (r: LoanInsuranceRecord, tab: 'closed' | 'expired' | 'renewal' | 'premium' | 'statement') =>
      Boolean(r.hiddenReportTabs?.includes(tab));

    const isRenewalChild = (r: LoanInsuranceRecord) => r.recordKind === 'renewal';
    const isClosedChild = (r: LoanInsuranceRecord) => r.recordKind === 'closed';
    const isBasePolicy = (r: LoanInsuranceRecord) => !isRenewalChild(r) && !isClosedChild(r);
    const isRenewedStatus = (r: LoanInsuranceRecord) => r.status === 'renewed' || r.status === 'Renewed';

    const isClosed = (r: LoanInsuranceRecord) => {
      if (isHiddenInTab(r, 'closed')) return false;
      if (isClosedChild(r)) return true;
      const st = (r.status || '').toLowerCase();
      return st === 'closed' || st === 'rejected' || st === 'deactivated';
    };

    const isDateExpired = (r: LoanInsuranceRecord) => Boolean(r.policyExpiryDate && new Date(r.policyExpiryDate) < now);
    const isExplicitExpired = (r: LoanInsuranceRecord) => r.status === 'Expired' || r.status === 'expired';
    const isExp = (r: LoanInsuranceRecord) => isDateExpired(r) || isExplicitExpired(r);

    const supersededExpiredParentIds = new Set(
      records
        .filter(
          r =>
            r.parentPolicyId &&
            ((isRenewalChild(r) && !isHiddenInTab(r, 'renewal')) ||
              (isClosedChild(r) && !isHiddenInTab(r, 'closed')))
        )
        .map(r => String(r.parentPolicyId))
    );

    const allPolicyRecords = records.filter(r => isBasePolicy(r));
    const closedRecords = records.filter(r => isClosed(r));
    const expiredRecords = records.filter(
      r =>
        !isClosedChild(r) &&
        !isClosed(r) &&
        isExp(r) &&
        !isHiddenInTab(r, 'expired') &&
        !(isBasePolicy(r) && supersededExpiredParentIds.has(String(r.id)))
    );
    const renewedRecords = records.filter(
      r => !isClosedChild(r) && !isClosed(r) && (isRenewalChild(r) || isRenewedStatus(r)) && !isHiddenInTab(r, 'renewal')
    );
    const firstPolicyRecords = records.filter(
      r => isBasePolicy(r) && !isClosed(r) && (r.status === 'start_policy' || r.isFirstPolicy !== false)
    );
    const activeRecords = records.filter(r =>
      isBasePolicy(r) &&
      !isClosed(r) &&
      !isExp(r)
    );
    const upcomingMaturityRecords = records.filter(r => {
      if (isClosedChild(r) || isClosed(r) || !r.policyExpiryDate) return false;
      const expiry = new Date(r.policyExpiryDate);
      return expiry >= now && expiry <= monthAhead;
    });
    const premiumPendingRecords = records.filter(
      r => !isClosedChild(r) && !isClosed(r) && (!r.isPremiumSaved || r.premiumPaymentStatus === 'Due')
    );
    const premiumTabRecords = records.filter(
      r => !isClosedChild(r) && !r.isPremiumSaved && !isClosed(r) && !isHiddenInTab(r, 'premium')
    );
    const statementRecords = records.filter(
      r =>
        !isClosedChild(r) &&
        !isHiddenInTab(r, 'statement') &&
        !((isRenewalChild(r) || isRenewedStatus(r)) && isHiddenInTab(r, 'renewal'))
    );
    const rejectedRecords = records.filter(r => !isHiddenInTab(r, 'closed') && (r.status === 'rejected' || r.status === 'Rejected'));

    const sumLoan = (list: LoanInsuranceRecord[]) => list.reduce((sum, r) => sum + (r.loanAmount || 0), 0);
    const sumPremium = (list: LoanInsuranceRecord[]) => list.reduce((sum, r) => sum + (r.premiumAmount || r.premium || 0), 0);

    const portfolioCount = allPolicyRecords.length;
    const portfolioAmount = sumLoan(allPolicyRecords);
    const portfolioPremium = sumPremium(allPolicyRecords);

    const activeAmount = sumLoan(activeRecords);
    const activePremium = sumPremium(activeRecords);

    const expiredAmount = sumLoan(expiredRecords);
    const expiredPremium = sumPremium(expiredRecords);

    const renewedAmount = sumLoan(renewedRecords);
    const renewedPremium = sumPremium(renewedRecords);

    const closedAmount = sumLoan(closedRecords);
    const closedPremium = sumPremium(closedRecords);

    const upcomingMaturityAmount = sumLoan(upcomingMaturityRecords);
    const upcomingMaturityPremium = sumPremium(upcomingMaturityRecords);

    const pendingAmount = sumLoan(premiumPendingRecords);
    const pendingPremiumDue = sumPremium(premiumPendingRecords);

    const rejectedAmount = sumLoan(rejectedRecords);
    const rejectedLostPremium = sumPremium(rejectedRecords);

    const settledClaims = claims.filter(c => c.status === 'Settled');
    const inProcessClaims = claims.filter(
      c =>
        c.status === 'Submitted' ||
        c.status === 'Under Review' ||
        c.status === 'Submitted to Insurer' ||
        c.status === 'Approved'
    );
    const rejectedClaims = claims.filter(c => c.status === 'Rejected');
    const totalClaimDisbursed = settledClaims.reduce((sum, c) => sum + (c.disbursedAmount || c.claimAmountApproved || 0), 0);

    // Branch-wise coverage summary
    const branchMap = new Map<string, {
      branchName: string;
      total: number;
      active: number;
      expired: number;
      amount: number;
      premium: number;
    }>();

    allPolicyRecords.forEach(r => {
      const bName = formatBranchLabel(r.branchId);
      const entry = branchMap.get(bName) || {
        branchName: bName,
        total: 0,
        active: 0,
        expired: 0,
        amount: 0,
        premium: 0
      };
      entry.total += 1;
      if (!isClosed(r) && isExp(r)) {
        entry.expired += 1;
      } else if (!isClosed(r)) {
        entry.active += 1;
      }
      entry.amount += r.loanAmount || 0;
      entry.premium += r.premiumAmount || r.premium || 0;
      branchMap.set(bName, entry);
    });

    const branchBreakdown = Array.from(branchMap.values()).sort((a, b) => b.amount - a.amount);

    return {
      portfolioCount,
      portfolioAmount,
      portfolioPremium,
      activeCount: activeRecords.length,
      activeAmount,
      activePremium,
      firstPolicyCount: firstPolicyRecords.length,
      expiredCount: expiredRecords.length,
      expiredAmount,
      expiredPremium,
      renewedCount: renewedRecords.length,
      renewedAmount,
      renewedPremium,
      closedCount: closedRecords.length,
      closedAmount,
      closedPremium,
      premiumCount: premiumTabRecords.length,
      statementCount: statementRecords.length,
      pendingCount: premiumPendingRecords.length,
      pendingAmount,
      pendingPremiumDue,
      upcomingMaturityCount: upcomingMaturityRecords.length,
      upcomingMaturityAmount,
      upcomingMaturityPremium,
      upcomingMaturityRecords,
      rejectedCount: rejectedRecords.length,
      rejectedAmount,
      rejectedLostPremium,
      claimsTotal: claims.length,
      claimsInProcess: inProcessClaims.length,
      claimsSettled: settledClaims.length,
      claimsRejected: rejectedClaims.length,
      totalClaimDisbursed,
      branchBreakdown
    };
  }, [records, claims, formatBranchLabel]);

  // Safe date/timestamp normalizer for sorting (handles ISO strings, YYYY-MM-DD, Date, or epoch numbers)
  const toSortableTimestamp = (val: unknown): number => {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (val instanceof Date) return Number.isFinite(val.getTime()) ? val.getTime() : 0;
    if (typeof val === 'string' && val.trim()) {
      const asNum = Number(val);
      if (Number.isFinite(asNum) && val.trim().length >= 10 && !val.includes('-')) return asNum;
      const parsed = Date.parse(val);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  // Expired policies list (sorted by earliest expiry)
  const expiredPolicies = useMemo(() => {
    const isClosed = (r: LoanInsuranceRecord) =>
      r.status === 'Closed' || r.status === 'closed' || r.status === 'Settled' ||
      r.status === 'rejected' || r.status === 'Rejected' || r.status === 'deactivated' || r.status === 'Deactivated';
    return records
      .filter(r => !isClosed(r) && (r.status === 'Expired' || r.status === 'expired' || (r.policyExpiryDate && new Date(r.policyExpiryDate) < new Date())))
      .sort((a, b) => toSortableTimestamp(a.policyExpiryDate) - toSortableTimestamp(b.policyExpiryDate));
  }, [records]);

  // Recent policies list (sorted newest first)
  const recentPolicies = useMemo(() => {
    return [...records]
      .sort((a, b) => {
        const aTs = toSortableTimestamp(a.createdAt ?? a.policyStartDate);
        const bTs = toSortableTimestamp(b.createdAt ?? b.policyStartDate);
        return bTs - aTs;
      })
      .slice(0, 6);
  }, [records]);

  // Filtered records for Report table (matching Image 3)
  const filteredReportRecords = useMemo(() => {
    const isDateExpired = (r: LoanInsuranceRecord) => Boolean(r.policyExpiryDate && new Date(r.policyExpiryDate) < new Date());
    const isExplicitExpired = (r: LoanInsuranceRecord) => r.status === 'Expired' || r.status === 'expired';
    const isExp = (r: LoanInsuranceRecord) => isDateExpired(r) || isExplicitExpired(r);
    const supersededExpiredParentIds = new Set(
      records
        .filter(
          r =>
            r.parentPolicyId &&
            ((r.recordKind === 'renewal' && !r.hiddenReportTabs?.includes('renewal')) ||
              (r.recordKind === 'closed' && !r.hiddenReportTabs?.includes('closed')))
        )
        .map(r => String(r.parentPolicyId))
    );

    return records.filter(r => {
      // Search
      const searchMatch = !searchQuery || 
        (r.memberName && r.memberName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.policyNo && r.policyNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.citizenshipNo && r.citizenshipNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.memberId && r.memberId.toLowerCase().includes(searchQuery.toLowerCase()));

      const isHiddenInTab = (tab: 'closed' | 'expired' | 'renewal' | 'premium' | 'statement') =>
        Boolean(r.hiddenReportTabs?.includes(tab));

      const isRenewalChild = r.recordKind === 'renewal';
      const isClosedChild = r.recordKind === 'closed';
      const isBasePolicy = !isRenewalChild && !isClosedChild;
      const isRenewedStatus = r.status === 'renewed' || r.status === 'Renewed';

      const stLower = (r.status || '').toLowerCase();
      const isClosed =
        !isHiddenInTab('closed') &&
        (isClosedChild || stLower === 'closed' || stLower === 'rejected' || stLower === 'deactivated');

      // Tab pills filter
      let pillMatch = true;
      if (reportFilter === 'active') {
        // Active base policies (not expired, not closed)
        pillMatch = isBasePolicy && !isClosed && !isExp(r);
      } else if (reportFilter === 'first_policy') {
        // First policy uploaded data
        pillMatch = isBasePolicy && !isClosed && (r.status === 'start_policy' || r.isFirstPolicy !== false);
      } else if (reportFilter === 'expired') {
        // Mature / Expired policies (exclude already renewed or closed source policies)
        pillMatch =
          !isClosedChild &&
          !isClosed &&
          isExp(r) &&
          !isHiddenInTab('expired') &&
          !(isBasePolicy && supersededExpiredParentIds.has(String(r.id)));
      } else if (reportFilter === 'renewal') {
        // Only policies that have been renewed
        pillMatch = !isClosedChild && (isRenewalChild || isRenewedStatus) && !isClosed && !isHiddenInTab('renewal');
      } else if (reportFilter === 'closed' || reportFilter === 'reject') {
        // Closed or deactivated policies
        pillMatch = isClosed;
      } else if (reportFilter === 'premium') {
        // Only policies waiting for premium arrangement; once saved or removed from tab, excluded
        pillMatch = !isClosedChild && !r.isPremiumSaved && !isClosed && !isHiddenInTab('premium');
      } else if (reportFilter === 'statement') {
        // Statement policies (excludes closed-only copies and any deleted renewal records)
        pillMatch =
          !isClosedChild &&
          !isHiddenInTab('statement') &&
          !((isRenewalChild || isRenewedStatus) && isHiddenInTab('renewal'));
      } else if (reportFilter === 'all') {
        // All Policy keeps original pre-renewal / pre-close policies intact
        pillMatch = isBasePolicy;
      }

      return searchMatch && pillMatch;
    });
  }, [records, searchQuery, reportFilter]);

  // Filtered list for Maturity Alerts (matching Image 4)
  const filteredAlertRecords = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return records.filter(r => {
      if (!r.policyExpiryDate) return false;
      const expiry = new Date(r.policyExpiryDate);
      const expiryStr = r.policyExpiryDate;

      if (alertPeriod === 'today') {
        return expiryStr === todayStr;
      }
      if (alertPeriod === 'tomorrow') {
        return expiryStr === tomorrowStr;
      }
      if (alertPeriod === 'week') {
        return expiry >= now && expiry <= weekAhead;
      }
      if (alertPeriod === 'month') {
        return expiry >= now && expiry <= monthAhead;
      }
      return expiry <= monthAhead && expiry >= now; // 'all' default period
    });
  }, [records, alertPeriod]);

  // Handle OCR File Upload
  const handleOcrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditInsUpload) {
      alert('You do not have permission to upload or create Insurance policies.');
      if (e.target) e.target.value = '';
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      if (e.target) e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);

    try {
      const data: ExtractedOcrData = await loanInsuranceService.simulateOcrDocumentExtraction(file);
      
      setPolicyForm(prev => ({
        ...prev,
        memberName: data.name || data.memberName || prev.memberName,
        gender: data.gender || prev.gender,
        citizenshipNo: data.citizenshipNo || prev.citizenshipNo,
        memberId: data.memberId || prev.memberId,
        policyNo: data.policyNo || prev.policyNo,
        dateOfBirth: data.dateOfBirth || prev.dateOfBirth,
        dateOfBirthBs: data.dateOfBirthBs || prev.dateOfBirthBs,
        age: data.age ?? prev.age,
        address: data.address || prev.address,
        policyStartDate: data.startDate || prev.policyStartDate,
        policyStartDateBs: data.startDateBs || (data.startDate ? convertAdToBs(data.startDate) : prev.policyStartDateBs),
        termMonths: data.termMonths || prev.termMonths,
        policyExpiryDate: data.maturityDate || prev.policyExpiryDate,
        policyExpiryDateBs: data.maturityDateBs || (data.maturityDate ? convertAdToBs(data.maturityDate) : prev.policyExpiryDateBs),
        loanAmount: data.loanAmount || prev.loanAmount,
        outstandingBalance: data.loanAmount || prev.outstandingBalance,
        sumAssured: data.loanAmount || prev.sumAssured,
        premiumAmount: data.premium || prev.premiumAmount,
        occupation: data.occupation || prev.occupation,
        disability: (data.disability as 'No' | 'Yes') || prev.disability || 'No',
        livingActiveLife: (data.livingActiveLife as 'yes' | 'no') || prev.livingActiveLife || 'yes',
        livingStatus: data.livingActiveLife === 'yes' ? 'Active / Normal Life' : 'Critical / Bedridden',
        branchId: data.branch || prev.branchId || 'Head Office',
        nomineeName: data.nomineeName || prev.nomineeName,
        nomineeRelation: data.nomineeRelation || prev.nomineeRelation,
        nomineeDob: data.nomineeDob || prev.nomineeDob,
        nomineeDobBs: data.nomineeDobBs || prev.nomineeDobBs,
        loanType: data.loanType || prev.loanType,
        status: (data.status as LoanInsuranceStatus) || 'Active',
        premiumPaymentStatus: (data.paymentStatus as 'Paid' | 'Due') || 'Due',
        premiumPaymentRemark: data.paymentRemark || prev.premiumPaymentRemark,
        notes: data.notes || prev.notes,
        documentName: file.name,
        confidence: data.confidence,
        ocrExtractedText: data.rawText
      }));
      setIsPolicyModalOpen(false);
      setIsOcrModalOpen(false);
      setIsUploadFormVisible(true);
    } catch {
      alert('Error parsing document. Please fill the policy details manually.');
    } finally {
      setIsOcrProcessing(false);
      if (ocrFileInputRef.current) {
        ocrFileInputRef.current.value = '';
      }
    }
  };

  // Handle Excel Spreadsheet Upload for Bulk Import
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditInsUpload) {
      alert('You do not have permission to upload or import Insurance policies.');
      if (e.target) e.target.value = '';
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      if (e.target) e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExcelParsing(true);
    try {
      const parsedRows = await loanInsuranceService.parseSpreadsheetFile(file);
      setExcelPreviewRows(parsedRows);
      if (parsedRows.length > 0) {
        const first = parsedRows[0];
        setPolicyForm(prev => ({
          ...prev,
          memberName: first.memberName || first.name || prev.memberName,
          name: first.memberName || first.name || prev.memberName,
          gender: first.gender || prev.gender,
          citizenshipNo: first.citizenshipNo || prev.citizenshipNo,
          memberId: first.memberId || prev.memberId,
          policyNo: first.policyNo || first.policyNumber || prev.policyNo,
          policyNumber: first.policyNo || first.policyNumber || prev.policyNo,
          dateOfBirth: first.dateOfBirth || prev.dateOfBirth,
          dateOfBirthBs: first.dateOfBirthBs || prev.dateOfBirthBs,
          age: first.age ?? prev.age,
          address: first.address || prev.address,
          policyStartDate: first.policyStartDate || prev.policyStartDate,
          policyStartDateBs: first.policyStartDateBs || prev.policyStartDateBs,
          termMonths: first.termMonths ?? prev.termMonths,
          policyExpiryDate: first.policyExpiryDate || prev.policyExpiryDate,
          policyExpiryDateBs: first.policyExpiryDateBs || prev.policyExpiryDateBs,
          loanAmount: first.loanAmount ?? prev.loanAmount,
          outstandingBalance: first.loanAmount ?? prev.outstandingBalance,
          sumAssured: first.loanAmount ?? prev.sumAssured,
          premiumAmount: first.premiumAmount ?? prev.premiumAmount,
          occupation: first.occupation || prev.occupation,
          disability: first.disability || prev.disability,
          livingActiveLife: first.livingActiveLife || prev.livingActiveLife,
          branchId: first.branchId || prev.branchId,
          nomineeName: first.nomineeName || prev.nomineeName,
          nomineeRelation: first.nomineeRelation || prev.nomineeRelation,
          nomineeDob: first.nomineeDob || prev.nomineeDob,
          nomineeDobBs: first.nomineeDobBs || prev.nomineeDobBs,
          loanType: first.loanType || prev.loanType,
          status: first.status || prev.status,
          premiumPaymentStatus: first.premiumPaymentStatus || prev.premiumPaymentStatus,
          premiumPaymentRemark: first.premiumPaymentRemark || prev.premiumPaymentRemark,
          notes: first.notes || prev.notes
        }));
        setIsUploadFormVisible(true);
      }
    } catch {
      alert('Failed to parse spreadsheet file. Please check file format.');
    } finally {
      setIsExcelParsing(false);
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = '';
      }
      if (quickUploadInputRef.current) {
        quickUploadInputRef.current.value = '';
      }
    }
  };

  // Quick drag & drop or click upload handler
  const handleQuickUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditInsUpload) {
      alert('You do not have permission to upload Insurance policies.');
      if (e.target) e.target.value = '';
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      if (e.target) e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
      handleExcelFileUpload(e);
      setIsExcelImportModalOpen(false);
    } else {
      handleOcrFileUpload(e);
      setIsOcrModalOpen(false);
    }
  };

  // Helper to enforce branch scope on any created/imported policy
  const resolveAllowedBranchForSave = (candidate?: string): string => {
    if (!canSwitchInsBranchView) {
      return formatBranchLabel(loggedInBranchObj?.id || loggedInBranchObj?.name || branch?.id || 'main');
    }
    if (!candidate || candidate === 'Select Branch') {
      return defaultBranchLabel;
    }
    if (hasAllInsBranchesAccess) {
      return formatBranchLabel(candidate);
    }
    const candidateKey = resolveCanonicalBranchKey(candidate, availableBranches);
    const isAllowed = selectableInsBranches.some(
      b => resolveCanonicalBranchKey(b.id, availableBranches) === candidateKey
    );
    return isAllowed ? formatBranchLabel(candidate) : defaultBranchLabel;
  };

  // Bulk Excel import confirmation handler
  const handleConfirmExcelImport = () => {
    if (!canEditInsUpload) {
      alert('You do not have permission to import Insurance policies.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (excelPreviewRows.length === 0) return;
    const scopedRows = excelPreviewRows.map(row => ({
      ...row,
      branchId: resolveAllowedBranchForSave(row.branchId)
    }));
    loanInsuranceService.bulkImportRecords(scopedRows);
    refreshData();
    setExcelPreviewRows([]);
    setIsExcelImportModalOpen(false);
    if (canViewInsReport) {
      setReportFilter('all');
      setActiveMenu('report');
    }
  };

  // Direct Save Data handler: Saves current form (and any bulk rows) to DB and switches to Report -> All Policies
  const handleSaveDataDirect = () => {
    const canSave = editingPolicy ? (canEditInsReport || canEditInsUpload) : (canEditInsUpload || canEditInsReport);
    if (!canSave) {
      alert('You do not have permission to save or edit Insurance policies.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const assuredName = policyForm.memberName || policyForm.name;
    if (!assuredName) {
      alert('Please fill required field: Assured Name.');
      return;
    }
    const checkPolicyDate = policyForm.policyStartDateBs || policyForm.policyStartDate;
    if (!editingPolicy && checkPolicyDate && isBackDateBlockedForEntry(checkPolicyDate, settings)) {
      alert(getBackDateBlockedMessage(checkPolicyDate));
      return;
    }

    let polNum = policyForm.policyNo || policyForm.policyNumber;
    if (!polNum && policyForm.memberId) {
      polNum = `POL-2026-${policyForm.memberId}`;
    } else if (!polNum) {
      polNum = `POL-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const payload: Partial<LoanInsuranceRecord> = {
      ...policyForm,
      memberName: assuredName,
      name: assuredName,
      policyNo: polNum,
      policyNumber: polNum,
      status: policyForm.status || 'start_policy',
      isFirstPolicy: editingPolicy ? editingPolicy.isFirstPolicy : true,
      isPremiumSaved: editingPolicy ? editingPolicy.isPremiumSaved : false,
      loanAmount: policyForm.loanAmount || 0,
      sumAssured: policyForm.loanAmount || 0,
      premiumAmount: policyForm.premiumAmount || 0,
      branchId: resolveAllowedBranchForSave(policyForm.branchId)
    };

    if (editingPolicy) {
      loanInsuranceService.updateRecord(editingPolicy.id, payload);
    } else {
      loanInsuranceService.addRecord(payload as Omit<LoanInsuranceRecord, 'id' | 'createdAt' | 'updatedAt'>);
    }

    // Bulk import any extra spreadsheet rows beyond the first one
    if (excelPreviewRows.length > 1) {
      const remainingRows = excelPreviewRows.slice(1).map(row => ({
        ...row,
        branchId: resolveAllowedBranchForSave(row.branchId)
      }));
      loanInsuranceService.bulkImportRecords(remainingRows);
    }

    refreshData();
    setIsPolicyModalOpen(false);
    setIsUploadFormVisible(false);
    setExcelPreviewRows([]);
    setEditingPolicy(null);
    setPolicyForm(getInitialPolicyForm());

    // Switch view to Report -> All Policies immediately when permitted
    if (canViewInsReport) {
      setReportFilter('all');
      setActiveMenu('report');
    }
  };

  // Save Policy Form (for form submit)
  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveDataDirect();
  };

  // Open Edit Policy
  const handleOpenEditPolicy = (record: LoanInsuranceRecord) => {
    if (!canEditInsReport && !canEditInsUpload) {
      alert('You do not have permission to edit Insurance policies.');
      return;
    }
    setEditingPolicy(record);
    setPolicyForm({
      ...record,
      branchId: formatBranchLabel(record.branchId)
    });
    setIsPolicyModalOpen(true);
  };

  // Delete Policy:
  // - From All Policy, Active, or First Policy -> permanent full deletion across the entire system
  // - From Renewal -> delete the renewed record (removing from Renewal, Statement & Policy view) while keeping the original base policy intact
  // - From Closed -> delete the closed record (keeping original base policy intact) or hide legacy record from Closed
  // - From Expired, Premium, or Statement -> remove only from that specific report sub-tab
  const handleDeletePolicy = (id: string) => {
    if (!canDeletePolicy) {
      alert('You do not have permission to delete Insurance policies.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }

    const normalizedFilter = reportFilter === 'reject' ? 'closed' : reportFilter;
    const allStoredRecords = loanInsuranceService.getRecords();
    const target = allStoredRecords.find(r => String(r.id) === String(id));

    if (normalizedFilter === 'all' || normalizedFilter === 'active' || normalizedFilter === 'first_policy') {
      // Permanent full delete of the selected policy
      loanInsuranceService.deleteRecord(id);
      if (viewingPolicy?.id === id) {
        handleClosePolicyView();
      }
    } else if (normalizedFilter === 'renewal') {
      const hasSiblingBasePolicy = Boolean(
        target &&
          allStoredRecords.some(r => {
            if (r.id === target.id) return false;
            if (r.recordKind === 'renewal' || r.recordKind === 'closed') return false;
            const sameParent = Boolean(target.parentPolicyId && r.id === target.parentPolicyId);
            const samePolicyNo = Boolean(
              target.policyNo &&
                r.policyNo &&
                r.policyNo.trim().toLowerCase() === target.policyNo.trim().toLowerCase()
            );
            const sameCit = Boolean(
              target.citizenshipNo &&
                r.citizenshipNo &&
                target.citizenshipNo.trim().toLowerCase() === r.citizenshipNo.trim().toLowerCase()
            );
            return sameParent || samePolicyNo || sameCit;
          })
      );

      if (target?.recordKind === 'renewal' || hasSiblingBasePolicy) {
        // Separate renewal record: delete it completely so it disappears from Renewal, Statement, and View -> Policy
        loanInsuranceService.deleteRecord(id);
      } else if (target?.policyHistory && target.policyHistory.length > 0) {
        // Legacy in-place renewed record: restore pre-renewal snapshot so renewal is cleanly removed
        const remainingHistory = [...target.policyHistory];
        const prev = remainingHistory.pop()!;
        loanInsuranceService.updateRecord(target.id, {
          status: prev.stage === 'First Policy' ? 'Active' : 'renewed',
          policyStartDate: prev.policyStartDate,
          policyStartDateBs: prev.policyStartDateBs,
          policyExpiryDate: prev.policyExpiryDate,
          policyExpiryDateBs: prev.policyExpiryDateBs,
          termMonths: prev.termMonths || target.termMonths,
          loanAmount: prev.loanAmount,
          sumAssured: prev.sumAssured,
          premiumAmount: prev.premiumAmount,
          premiumPaymentStatus: prev.premiumPaymentStatus || target.premiumPaymentStatus,
          policyHistory: remainingHistory.length > 0 ? remainingHistory : undefined
        });
      } else {
        loanInsuranceService.removeRecordFromReportTab(id, ['renewal', 'statement']);
      }
      if (viewingPolicy?.id === id) {
        handleClosePolicyView();
      }
    } else if (normalizedFilter === 'closed') {
      if (target?.recordKind === 'closed') {
        loanInsuranceService.deleteRecord(id);
      } else {
        loanInsuranceService.removeRecordFromReportTab(id, 'closed');
      }
      if (viewingPolicy?.id === id) {
        handleClosePolicyView();
      }
    } else if (
      normalizedFilter === 'expired' ||
      normalizedFilter === 'premium' ||
      normalizedFilter === 'statement'
    ) {
      loanInsuranceService.removeRecordFromReportTab(id, normalizedFilter);
    }

    refreshData();
  };

  // Open Renewal Modal matching image_7c9690b7.png
  const handleOpenRenewalModal = (record: LoanInsuranceRecord) => {
    if (!canEditInsReport && !canEditInsAlerts && !canEditInsDashboard) {
      alert('You do not have permission to renew Insurance policies.');
      return;
    }
    setRenewingPolicy(record);

    const existStartAd = record.policyStartDate || record.start_date || '2024-05-10';
    const existStartBs = record.policyStartDateBs || convertAdToBs(existStartAd) || '2081-01-28';
    const existMatAd = record.policyExpiryDate || record.maturity_date || '2025-05-10';
    const existMatBs = record.policyExpiryDateBs || convertAdToBs(existMatAd) || '2082-01-27';

    // Base renewal date: use 2026-11-09 or today or existing maturity
    const pad = (n: number) => String(n).padStart(2, '0');
    let renewAd = '2026-11-09';
    if (existMatAd && existMatAd > new Date().toISOString().split('T')[0]) {
      renewAd = existMatAd;
    }
    const renewBs = convertAdToBs(renewAd) || '2083-07-23';

    // 12 months later
    const matAdObj = new Date(renewAd);
    matAdObj.setFullYear(matAdObj.getFullYear() + 1);
    const newMatAd = `${matAdObj.getFullYear()}-${pad(matAdObj.getMonth() + 1)}-${pad(matAdObj.getDate())}`;
    const newMatBs = convertAdToBs(newMatAd) || '2084-07-23';

    const amt = record.loanAmount || 200000;
    const prem = record.premiumAmount || calculatePremium(amt, 12, 350) || 700;

    const totalLoanYears = record.loanDurationYears ?? (record.termMonths ? Math.round(record.termMonths / 12) : 5);
    const oldPaidYears = record.paidYears !== undefined 
      ? record.paidYears 
      : (record.isPremiumSaved && record.premiumPaymentStatus === 'Paid' ? totalLoanYears : 0);
    // When renewing, default new paid years to min(totalLoanYears, oldPaidYears + 1)
    const nextPaidYears = Math.min(totalLoanYears, Math.max(oldPaidYears, oldPaidYears + 1));

    setRenewalForm({
      existingDateBs: existStartBs,
      existingDateAd: existStartAd,
      existingMaturityBs: existMatBs,
      existingMaturityAd: existMatAd,
      savedExistingSuccess: false,

      newRenewDateBs: renewBs,
      newRenewDateAd: renewAd,
      newMaturityDateBs: newMatBs,
      newMaturityDateAd: newMatAd,
      loanDurationYears: totalLoanYears,
      insuranceTermMonths: 12,
      insuranceStartDateBs: renewBs,
      insuranceStartDateAd: renewAd,
      insuranceTillDateBs: newMatBs,
      insuranceTillDateAd: newMatAd,
      renewalAmount: amt,
      premiumAmount: prem,

      oldLoanTermYears: totalLoanYears,
      oldPaidYears: oldPaidYears,
      oldPolicyPremiumStatus: oldPaidYears < totalLoanYears ? 'DUE' : 'PAID',
      oldPaidRemark: '',

      newLoanTermYears: totalLoanYears,
      newPaidYears: nextPaidYears,
      newPolicyPremiumStatus: nextPaidYears < totalLoanYears ? 'DUE' : 'PAID',
      newPaidRemark: '',

      renewalRemark: ''
    });

    setIsRenewalModalOpen(true);
  };

  // Renewal Form Change Handlers
  const handleRenewalExistingBsChange = (bs: string) => {
    const ad = bs ? convertBsToAd(bs) : '';
    setRenewalForm(prev => ({
      ...prev,
      existingDateBs: bs,
      existingDateAd: ad || prev.existingDateAd,
      savedExistingSuccess: false
    }));
  };

  const handleRenewalExistingAdChange = (ad: string) => {
    const bs = ad ? convertAdToBs(ad) : '';
    setRenewalForm(prev => ({
      ...prev,
      existingDateAd: ad,
      existingDateBs: bs || prev.existingDateBs,
      savedExistingSuccess: false
    }));
  };

  const handleRenewalExistingMatBsChange = (bs: string) => {
    const ad = bs ? convertBsToAd(bs) : '';
    setRenewalForm(prev => ({
      ...prev,
      existingMaturityBs: bs,
      existingMaturityAd: ad || prev.existingMaturityAd,
      savedExistingSuccess: false
    }));
  };

  const handleRenewalExistingMatAdChange = (ad: string) => {
    const bs = ad ? convertAdToBs(ad) : '';
    setRenewalForm(prev => ({
      ...prev,
      existingMaturityAd: ad,
      existingMaturityBs: bs || prev.existingMaturityBs,
      savedExistingSuccess: false
    }));
  };

  const handleRenewalNewDateBsChange = (bs: string) => {
    const ad = bs ? convertBsToAd(bs) : '';
    let newMatAd = renewalForm.newMaturityDateAd;
    let newMatBs = renewalForm.newMaturityDateBs;
    if (ad) {
      const d = new Date(ad);
      d.setMonth(d.getMonth() + renewalForm.insuranceTermMonths);
      newMatAd = d.toISOString().split('T')[0];
      newMatBs = convertAdToBs(newMatAd);
    }
    setRenewalForm(prev => ({
      ...prev,
      newRenewDateBs: bs,
      newRenewDateAd: ad || prev.newRenewDateAd,
      insuranceStartDateBs: bs,
      insuranceStartDateAd: ad || prev.insuranceStartDateAd,
      newMaturityDateAd: newMatAd,
      newMaturityDateBs: newMatBs,
      insuranceTillDateAd: newMatAd,
      insuranceTillDateBs: newMatBs
    }));
  };

  const handleRenewalNewDateAdChange = (ad: string) => {
    const bs = ad ? convertAdToBs(ad) : '';
    let newMatAd = renewalForm.newMaturityDateAd;
    let newMatBs = renewalForm.newMaturityDateBs;
    if (ad) {
      const d = new Date(ad);
      d.setMonth(d.getMonth() + renewalForm.insuranceTermMonths);
      newMatAd = d.toISOString().split('T')[0];
      newMatBs = convertAdToBs(newMatAd);
    }
    setRenewalForm(prev => ({
      ...prev,
      newRenewDateAd: ad,
      newRenewDateBs: bs || prev.newRenewDateBs,
      insuranceStartDateAd: ad,
      insuranceStartDateBs: bs || prev.insuranceStartDateBs,
      newMaturityDateAd: newMatAd,
      newMaturityDateBs: newMatBs,
      insuranceTillDateAd: newMatAd,
      insuranceTillDateBs: newMatBs
    }));
  };

  const handleRenewalNewMatBsChange = (bs: string) => {
    const ad = bs ? convertBsToAd(bs) : '';
    setRenewalForm(prev => ({
      ...prev,
      newMaturityDateBs: bs,
      newMaturityDateAd: ad || prev.newMaturityDateAd,
      insuranceTillDateBs: bs,
      insuranceTillDateAd: ad || prev.insuranceTillDateAd
    }));
  };

  const handleRenewalNewMatAdChange = (ad: string) => {
    const bs = ad ? convertAdToBs(ad) : '';
    setRenewalForm(prev => ({
      ...prev,
      newMaturityDateAd: ad,
      newMaturityDateBs: bs || prev.newMaturityDateBs,
      insuranceTillDateAd: ad,
      insuranceTillDateBs: bs || prev.insuranceTillDateBs
    }));
  };

  const handleRenewalInsuranceTermChange = (months: number) => {
    let newMatAd = renewalForm.newMaturityDateAd;
    let newMatBs = renewalForm.newMaturityDateBs;
    if (renewalForm.newRenewDateAd) {
      const d = new Date(renewalForm.newRenewDateAd);
      d.setMonth(d.getMonth() + months);
      newMatAd = d.toISOString().split('T')[0];
      newMatBs = convertAdToBs(newMatAd);
    }
    const prem = calculatePremium(renewalForm.renewalAmount, months, 350);
    setRenewalForm(prev => ({
      ...prev,
      insuranceTermMonths: months,
      newMaturityDateAd: newMatAd,
      newMaturityDateBs: newMatBs,
      insuranceTillDateAd: newMatAd,
      insuranceTillDateBs: newMatBs,
      premiumAmount: prem
    }));
  };

  const handleRenewalAmountChange = (amt: number) => {
    const prem = calculatePremium(amt, renewalForm.insuranceTermMonths, 350);
    setRenewalForm(prev => ({
      ...prev,
      renewalAmount: amt,
      premiumAmount: prem
    }));
  };

  // Execute Policy Renewal
  const handleConfirmRenewal = () => {
    if (!renewingPolicy) return;
    if (!canEditInsReport && !canEditInsAlerts && !canEditInsDashboard) {
      alert('You do not have permission to renew Insurance policies.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }

    const totalLoanYears = renewalForm.newLoanTermYears;
    const updatedPaidYears = Math.min(totalLoanYears, renewalForm.newPaidYears);
    const isPaid = updatedPaidYears >= totalLoanYears;
    const dueYrs = Math.max(0, totalLoanYears - updatedPaidYears);

    // Keep original policy untouched in All Policy; create a dedicated Renewal record for Renewal sub-menu
    const {
      id: _origId,
      createdAt: _origCreatedAt,
      updatedAt: _origUpdatedAt,
      hiddenReportTabs: _origHidden,
      policyHistory: _origHistory,
      ...baseFields
    } = renewingPolicy;
    void _origId;
    void _origCreatedAt;
    void _origUpdatedAt;
    void _origHidden;
    void _origHistory;

    loanInsuranceService.addRecord({
      ...baseFields,
      recordKind: 'renewal',
      parentPolicyId: renewingPolicy.parentPolicyId || renewingPolicy.id,
      isFirstPolicy: false,
      status: 'renewed',
      policyStartDate: renewalForm.newRenewDateAd,
      policyStartDateBs: renewalForm.newRenewDateBs,
      policyExpiryDate: renewalForm.newMaturityDateAd,
      policyExpiryDateBs: renewalForm.newMaturityDateBs,
      insuranceTillDate: renewalForm.insuranceTillDateAd,
      insuranceTillDateBs: renewalForm.insuranceTillDateBs,
      loanDurationYears: totalLoanYears,
      termMonths: renewalForm.insuranceTermMonths,
      paidYears: updatedPaidYears,
      dueYears: dueYrs,
      loanAmount: renewalForm.renewalAmount,
      sumAssured: renewalForm.renewalAmount,
      premiumAmount: renewalForm.premiumAmount,
      premiumPaymentStatus: isPaid ? 'Paid' : 'Due',
      premiumPaymentRemark: isPaid ? 'Full Coverage Paid' : `${dueYrs} Year(s) Premium Due`,
      isPremiumSaved: true,
      notes: renewalForm.renewalRemark?.trim() || 'Renewed policy agreement and coverage'
    });

    // Remove the renewed source policy from the Expired sub-menu while keeping it intact in All Policy / First Policy
    loanInsuranceService.removeRecordFromReportTab(renewingPolicy.id, 'expired');

    refreshData();
    setIsRenewalModalOpen(false);
    setRenewingPolicy(null);
    if (canViewInsReport) {
      setReportFilter('renewal');
      setActiveMenu('report');
    }
  };

  // Open Deactivate Modal
  const handleOpenDeactivateModal = (record: LoanInsuranceRecord) => {
    if (!canEditInsReport) {
      alert('You do not have permission to deactivate Insurance policies.');
      return;
    }
    setDeactivatingPolicy(record);
    setDeactivationRemark('');
    setIsDeactivateModalOpen(true);
  };

  // Confirm Deactivation: keep original policy untouched in All Policy and record a Closed entry in Closed sub-menu
  const handleConfirmDeactivation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivatingPolicy) return;
    if (!canEditInsReport) {
      alert('You do not have permission to deactivate Insurance policies.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }

    const remarkText = deactivationRemark.trim() || 'Deactivated from expired policies';
    const updatedNotes = deactivatingPolicy.notes 
      ? `${deactivatingPolicy.notes} | Deactivated: ${remarkText}`
      : `Deactivated: ${remarkText}`;

    const {
      id: _origId,
      createdAt: _origCreatedAt,
      updatedAt: _origUpdatedAt,
      hiddenReportTabs: _origHidden,
      policyHistory: _origHistory,
      ...baseFields
    } = deactivatingPolicy;
    void _origId;
    void _origCreatedAt;
    void _origUpdatedAt;
    void _origHidden;
    void _origHistory;

    loanInsuranceService.addRecord({
      ...baseFields,
      recordKind: 'closed',
      parentPolicyId: deactivatingPolicy.parentPolicyId || deactivatingPolicy.id,
      isFirstPolicy: false,
      status: 'Closed',
      notes: updatedNotes
    });

    // Remove the closed source policy from the Expired sub-menu while keeping it intact in All Policy / First Policy
    loanInsuranceService.removeRecordFromReportTab(deactivatingPolicy.id, 'expired');

    refreshData();
    setIsDeactivateModalOpen(false);
    setDeactivatingPolicy(null);
    setDeactivationRemark('');

    // Switch view to Report -> Closed tab immediately
    if (canViewInsReport) {
      setReportFilter('closed');
      setActiveMenu('report');
    }
  };

  // Open Premium & Dues Arrangement Modal (matching image_529b5b18.png)
  const handleOpenPremiumModal = (record: LoanInsuranceRecord) => {
    if (!canEditInsReport) {
      alert('You do not have permission to update Insurance premium & dues.');
      return;
    }
    setPremiumTargetPolicy(record);

    const pad = (n: number) => String(n).padStart(2, '0');
    const loanDateAd = record.loanDisbursedDate || record.policyStartDate || record.start_date || '2024-01-15';
    const loanDateBs = record.loanDisbursedDateBs || record.policyStartDateBs || convertAdToBs(loanDateAd) || '2080-10-01';

    const loanTermYears = record.loanDurationYears ?? (record.termMonths ? Math.round(record.termMonths / 12) : 5);
    const paidYears = record.paidYears !== undefined 
      ? record.paidYears 
      : (record.isPremiumSaved ? (record.premiumPaymentStatus === 'Paid' ? loanTermYears : 0) : 0);

    // Calculate Maturity Date from loanDateAd + loanTermYears
    let matAd = record.loanExpiryDate || record.policyExpiryDate || record.maturity_date || '';
    if (!matAd && loanDateAd) {
      const d = new Date(loanDateAd);
      if (!isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + loanTermYears);
        matAd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
    }
    const matBs = record.loanExpiryDateBs || record.policyExpiryDateBs || (matAd ? convertAdToBs(matAd) : '');

    const startDateAd = record.policyStartDate || loanDateAd;
    const startDateBs = record.policyStartDateBs || convertAdToBs(startDateAd);
    const termMonths = record.termMonths || (loanTermYears * 12);

    let tillAd = record.insuranceTillDate || record.policyExpiryDate || '';
    if (!tillAd && startDateAd) {
      const d = new Date(startDateAd);
      if (!isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + termMonths);
        tillAd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
    }
    const tillBs = record.insuranceTillDateBs || (tillAd ? convertAdToBs(tillAd) : '');

    setPremiumForm({
      loanDateBs,
      loanDateAd,
      maturityDateBs: matBs,
      maturityDateAd: matAd,
      loanDurationYears: loanTermYears,
      insuranceTermMonths: termMonths,
      insuranceStartDateBs: startDateBs,
      insuranceStartDateAd: startDateAd,
      insuranceTillDateBs: tillBs,
      insuranceTillDateAd: tillAd,
      loanAmount: record.loanAmount || 0,
      premiumAmount: record.premiumAmount || record.premium || 0,
      loanTermYears,
      paidYears,
      paymentRemark: record.premiumPaymentRemark || '',
      notes: record.notes || ''
    });

    setIsPremiumModalOpen(true);
  };

  // When Loan Duration changes in Premium modal -> auto-update maturity date
  const handlePremiumLoanDurationChange = (years: number) => {
    const y = Math.max(1, years);
    const pad = (n: number) => String(n).padStart(2, '0');
    let matAd = premiumForm.maturityDateAd;
    let matBs = premiumForm.maturityDateBs;

    if (premiumForm.loanDateAd) {
      const d = new Date(premiumForm.loanDateAd);
      if (!isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + y);
        matAd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        matBs = convertAdToBs(matAd);
      }
    }

    setPremiumForm(prev => ({
      ...prev,
      loanDurationYears: y,
      loanTermYears: y,
      maturityDateAd: matAd,
      maturityDateBs: matBs
    }));
  };

  // When Insurance Term changes in Premium modal -> auto-update till date
  const handlePremiumInsuranceTermChange = (months: number) => {
    const m = Math.max(1, months);
    const pad = (n: number) => String(n).padStart(2, '0');
    let tillAd = premiumForm.insuranceTillDateAd;
    let tillBs = premiumForm.insuranceTillDateBs;

    if (premiumForm.insuranceStartDateAd) {
      const d = new Date(premiumForm.insuranceStartDateAd);
      if (!isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + m);
        tillAd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        tillBs = convertAdToBs(tillAd);
      }
    }

    setPremiumForm(prev => ({
      ...prev,
      insuranceTermMonths: m,
      insuranceTillDateAd: tillAd,
      insuranceTillDateBs: tillBs
    }));
  };

  // When Loan Date AD changes in Premium modal
  const handlePremiumLoanDateAdChange = (ad: string) => {
    const bs = ad ? convertAdToBs(ad) : '';
    const pad = (n: number) => String(n).padStart(2, '0');
    let matAd = '';
    let matBs = '';
    if (ad) {
      const d = new Date(ad);
      if (!isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + premiumForm.loanDurationYears);
        matAd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        matBs = convertAdToBs(matAd);
      }
    }
    setPremiumForm(prev => ({
      ...prev,
      loanDateAd: ad,
      loanDateBs: bs,
      maturityDateAd: matAd,
      maturityDateBs: matBs
    }));
  };

  // When Loan Date BS changes in Premium modal
  const handlePremiumLoanDateBsChange = (bs: string) => {
    const ad = bs ? convertBsToAd(bs) : '';
    const pad = (n: number) => String(n).padStart(2, '0');
    let matAd = '';
    let matBs = '';
    if (ad) {
      const d = new Date(ad);
      if (!isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + premiumForm.loanDurationYears);
        matAd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        matBs = convertAdToBs(matAd);
      }
    }
    setPremiumForm(prev => ({
      ...prev,
      loanDateBs: bs,
      loanDateAd: ad || prev.loanDateAd,
      maturityDateAd: matAd || prev.maturityDateAd,
      maturityDateBs: matBs || prev.maturityDateBs
    }));
  };

  // When Insurance Start Date AD changes
  const handlePremiumStartDateAdChange = (ad: string) => {
    const bs = ad ? convertAdToBs(ad) : '';
    const pad = (n: number) => String(n).padStart(2, '0');
    let tillAd = '';
    let tillBs = '';
    if (ad) {
      const d = new Date(ad);
      if (!isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + premiumForm.insuranceTermMonths);
        tillAd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        tillBs = convertAdToBs(tillAd);
      }
    }
    setPremiumForm(prev => ({
      ...prev,
      insuranceStartDateAd: ad,
      insuranceStartDateBs: bs,
      insuranceTillDateAd: tillAd,
      insuranceTillDateBs: tillBs
    }));
  };

  // When Insurance Start Date BS changes
  const handlePremiumStartDateBsChange = (bs: string) => {
    const ad = bs ? convertBsToAd(bs) : '';
    const pad = (n: number) => String(n).padStart(2, '0');
    let tillAd = '';
    let tillBs = '';
    if (ad) {
      const d = new Date(ad);
      if (!isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + premiumForm.insuranceTermMonths);
        tillAd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        tillBs = convertAdToBs(tillAd);
      }
    }
    setPremiumForm(prev => ({
      ...prev,
      insuranceStartDateBs: bs,
      insuranceStartDateAd: ad || prev.insuranceStartDateAd,
      insuranceTillDateAd: tillAd || prev.insuranceTillDateAd,
      insuranceTillDateBs: tillBs || prev.insuranceTillDateBs
    }));
  };

  // Save Premium & Dues Arrangement handler
  const handleSavePremiumArrangement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!premiumTargetPolicy) return;
    if (!canEditInsReport) {
      alert('You do not have permission to update Insurance premium & dues.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const checkPremDate = premiumForm.insuranceStartDateBs || premiumForm.insuranceStartDateAd || premiumForm.loanDateBs;
    if (checkPremDate && isBackDateBlockedForEntry(checkPremDate, settings)) {
      alert(getBackDateBlockedMessage(checkPremDate));
      return;
    }

    const isPaid = premiumForm.paidYears >= premiumForm.loanTermYears;
    const dueYrs = Math.max(0, premiumForm.loanTermYears - premiumForm.paidYears);

    loanInsuranceService.updateRecord(premiumTargetPolicy.id, {
      loanDisbursedDate: premiumForm.loanDateAd,
      loanDisbursedDateBs: premiumForm.loanDateBs,
      loanExpiryDate: premiumForm.maturityDateAd,
      loanExpiryDateBs: premiumForm.maturityDateBs,
      insuranceTillDate: premiumForm.insuranceTillDateAd,
      insuranceTillDateBs: premiumForm.insuranceTillDateBs,
      loanDurationYears: premiumForm.loanTermYears,
      termMonths: premiumForm.insuranceTermMonths,
      paidYears: premiumForm.paidYears,
      dueYears: dueYrs,
      premiumPaymentStatus: isPaid ? 'Paid' : 'Due',
      premiumPaymentRemark: premiumForm.paymentRemark || (isPaid ? 'Full Coverage Paid' : `${dueYrs} Year(s) Premium Due`),
      isPremiumSaved: true,
      loanAmount: premiumForm.loanAmount,
      sumAssured: premiumForm.loanAmount,
      premiumAmount: premiumForm.premiumAmount,
      notes: premiumForm.notes
    });

    refreshData();
    setIsPremiumModalOpen(false);
    setPremiumTargetPolicy(null);
    if (canViewInsReport) {
      setReportFilter('premium');
      setActiveMenu('report');
    }
  };

  // Save Claim Form
  const handleSaveClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditInsReport && !canEditInsDashboard) {
      alert('You do not have permission to register or edit Insurance claims.');
      return;
    }
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!claimForm.policyNo || !claimForm.memberName || !claimForm.claimAmountRequested) {
      alert('Please complete required claim fields.');
      return;
    }
    const checkClaimDate = claimForm.claimDateBs || claimForm.claimDate;
    if (!editingClaim && checkClaimDate && isBackDateBlockedForEntry(checkClaimDate, settings)) {
      alert(getBackDateBlockedMessage(checkClaimDate));
      return;
    }

    const scopedClaimPayload: Partial<InsuranceClaimRecord> = {
      ...claimForm,
      branchId: resolveAllowedBranchForSave(claimForm.branchId)
    };

    if (editingClaim) {
      loanInsuranceService.updateClaim(editingClaim.id, scopedClaimPayload);
    } else {
      loanInsuranceService.addClaim(scopedClaimPayload as Omit<InsuranceClaimRecord, 'id' | 'createdAt' | 'updatedAt' | 'claimNo'>);
    }

    refreshData();
    setIsClaimModalOpen(false);
    setEditingClaim(null);
    setClaimForm(initialClaimForm);
  };

  // Helper to extract initials for avatar badge (e.g. "Sita Devi Chaudhary" -> "SD")
  const getInitials = (name?: string): string => {
    if (!name) return 'MB';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  // Export to Excel (.xlsx) matching exact MicroInsuranceTemplate format
  const exportToExcel = (recordsToExport: LoanInsuranceRecord[] = filteredReportRecords) => {
    const getNumericBranchCode = (rawBranch?: string | number): number => {
      const k = resolveCanonicalBranchKey(rawBranch, availableBranches);
      if (k === 'sahodba') return 2;
      if (k === 'pipra') return 3;
      if (k === 'parsa') return 4;
      return 1;
    };

    const rows = recordsToExport.map((r, i) => ({
      'SN': i + 1,
      'Assured Name': r.memberName || r.name || '',
      'Gender': r.gender || 'Male',
      'Citizenship No': r.citizenshipNo || '',
      'Customer Id': r.memberId || '',
      'Physical Disability, incapacity,infirmity': r.disability || 'No',
      'Living Active life': r.livingActiveLife || 'Yes',
      'Address': r.address || '',
      'Occupation': r.occupation || 'Agriculture',
      'DOB_BS': r.dateOfBirthBs || '',
      'DOB_AD': r.dateOfBirth || '',
      'DOC_AD': r.policyStartDate || '',
      'SumAssured': r.sumAssured || r.loanAmount || 0,
      'Term Month': r.termMonths || 12,
      'NomineeName': r.nomineeName || '',
      'NomineeRelation': r.nomineeRelation || '',
      'Nomiee DOB_BS': r.nomineeDobBs || '',
      'Nomiee DOB_AD': r.nomineeDob || '',
      'Nominee Gender': r.nomineeGender || (r.nomineeRelation === 'Wife' ? 'Female' : (r.nomineeRelation === 'Husband' ? 'Male' : (r.gender === 'Female' ? 'Male' : 'Female'))),
      'Micro Finance Branch': formatBranchLabel(r.branchId),
      'BranchCode': getNumericBranchCode(r.branchId),
      'MobileNumber': r.mobileNumber || ''
    }));

    const branchSuffix =
      effectiveInsBranchKeys.length === 1
        ? `_${formatBranchLabel(effectiveInsBranchKeys[0]).replace(/\s+/g, '')}`
        : '';

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MicroInsurance');
    XLSX.writeFile(workbook, `MicroInsuranceTemplate${branchSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };


  // Close full-page policy view with Escape key
  useEffect(() => {
    if (!isHistoryViewModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHistoryViewModalOpen(false);
        setIsKycViewOpen(false);
        setPolicyActionNotice(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isHistoryViewModalOpen]);

  // Match Micro-Finance member record for Shortcut KYC enrichment (photo/mobile fallback)
  const matchedKycMfMember = useMemo(() => {
    if (!isHistoryViewModalOpen || !viewingPolicy) return null;
    try {
      const members = microFinanceService.getMembers();
      const norm = (val?: string) => (val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetId = norm(viewingPolicy.memberId);
      const targetCit = norm(viewingPolicy.citizenshipNo);
      const targetName = (viewingPolicy.memberName || viewingPolicy.name || '').trim().toLowerCase();
      return (
        members.find(m => targetId && norm(m.memberId) === targetId) ||
        members.find(m => targetCit && norm(m.citizenshipNo) === targetCit) ||
        members.find(m => targetName && (m.name || '').trim().toLowerCase() === targetName) ||
        null
      );
    } catch {
      return null;
    }
  }, [isHistoryViewModalOpen, viewingPolicy]);

  // Populate fillable Shortcut KYC form from policy (+ Micro-Finance fallback)
  const populateKycFormFromPolicy = useCallback((record: LoanInsuranceRecord) => {
    let mfMatch: { memberId?: string; citizenshipNo?: string; mobile?: string; address?: string; gender?: 'Male' | 'Female' | 'Other'; photoUrl?: string } | null = null;
    try {
      const members = microFinanceService.getMembers();
      const norm = (val?: string) => (val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetId = norm(record.memberId);
      const targetCit = norm(record.citizenshipNo);
      const targetName = (record.memberName || record.name || '').trim().toLowerCase();
      mfMatch =
        members.find(m => targetId && norm(m.memberId) === targetId) ||
        members.find(m => targetCit && norm(m.citizenshipNo) === targetCit) ||
        members.find(m => targetName && (m.name || '').trim().toLowerCase() === targetName) ||
        null;
    } catch {
      mfMatch = null;
    }
    const rawGender = record.gender || mfMatch?.gender || 'Female';
    const safeGender: 'Male' | 'Female' | 'Other' =
      rawGender === 'Male' || rawGender === 'Female' || rawGender === 'Other' ? rawGender : 'Female';
    const dobAd = record.dateOfBirth || '';
    const dobBs = record.dateOfBirthBs || (dobAd ? convertAdToBs(dobAd) : '');
    setKycForm({
      memberId: record.memberId || mfMatch?.memberId || '',
      memberName: record.memberName || record.name || '',
      citizenshipNo: record.citizenshipNo || mfMatch?.citizenshipNo || '',
      contactNumber: record.contactNumber || mfMatch?.mobile || '',
      gender: safeGender,
      age: record.age !== undefined && record.age !== null && record.age > 0 ? String(record.age) : '',
      dateOfBirthBs: dobBs,
      dateOfBirth: dobAd,
      address: record.address || mfMatch?.address || '',
      occupation: record.occupation || '',
      nomineeName: record.nomineeName || record.nominee_name || '',
      nomineeRelation: record.nomineeRelation || record.nominee_relation || '',
      nomineeContact: record.nomineeContact || '',
      nomineeCitizenship: record.nomineeCitizenship || '',
      memberPhoto: record.memberPhoto || mfMatch?.photoUrl || ''
    });
    setKycSavedNotice(null);
  }, []);

  // Upload or update member photo directly from Shortcut KYC form
  const handleUploadKycMemberPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingPolicy) return;
    if (isDayEnded) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 360;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setKycForm(prev => ({ ...prev, memberPhoto: dataUrl }));
        const updated = loanInsuranceService.updateRecord(viewingPolicy.id, { memberPhoto: dataUrl });
        if (updated) {
          setViewingPolicy(updated);
          refreshData();
        }
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Save filled Shortcut KYC details onto the policy record
  const handleSaveKycForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingPolicy || isDayEnded) return;
    const parsedAge = Number(kycForm.age);
    const dobBs = kycForm.dateOfBirthBs.trim();
    const dobAd = kycForm.dateOfBirth.trim() || (dobBs ? convertBsToAd(dobBs) : '');
    const cleanName = kycForm.memberName.trim() || viewingPolicy.memberName || viewingPolicy.name || '';
    const updated = loanInsuranceService.updateRecord(viewingPolicy.id, {
      memberId: kycForm.memberId.trim(),
      memberName: cleanName,
      name: cleanName,
      citizenshipNo: kycForm.citizenshipNo.trim(),
      contactNumber: kycForm.contactNumber.trim() || undefined,
      gender: kycForm.gender,
      age: Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : undefined,
      dateOfBirthBs: dobBs || undefined,
      dateOfBirth: dobAd || undefined,
      address: kycForm.address.trim() || undefined,
      occupation: kycForm.occupation.trim() || undefined,
      nomineeName: kycForm.nomineeName.trim(),
      nomineeRelation: kycForm.nomineeRelation.trim(),
      nomineeContact: kycForm.nomineeContact.trim() || undefined,
      nomineeCitizenship: kycForm.nomineeCitizenship.trim() || undefined,
      memberPhoto: kycForm.memberPhoto || undefined
    });
    if (updated) {
      setViewingPolicy(updated);
      refreshData();
      setKycSavedNotice('Member KYC सफलतापूर्वक सेभ गरियो।');
      window.setTimeout(() => {
        setKycSavedNotice(prev => (prev === 'Member KYC सफलतापूर्वक सेभ गरियो।' ? null : prev));
      }, 3500);
    }
  };

  // Close Full-Page Policy View cleanly
  const handleClosePolicyView = () => {
    setIsHistoryViewModalOpen(false);
    setIsKycViewOpen(false);
    setKycSavedNotice(null);
    setPolicyViewTab('combined');
  };

  // View Insurance Records & History Detail (Full Page)
  const handleViewPolicyDetails = (record: LoanInsuranceRecord) => {
    setViewingPolicy(record);
    populateKycFormFromPolicy(record);
    setIsKycViewOpen(false);
    setPolicyViewTab('combined');
    setIsHistoryViewModalOpen(true);
  };

  // View Certificate
  const handleViewCertificate = (record: LoanInsuranceRecord) => {
    setViewingPolicy(record);
    setIsCertificateModalOpen(true);
  };

  // View Settlement Receipt
  const handleViewSettlementReceipt = (claim: InsuranceClaimRecord) => {
    setSettlementClaim(claim);
    setIsSettlementReceiptModalOpen(true);
  };

  // Render Policy Form (matches image_85c066c5.png exactly)
  const renderPolicyFormCard = (isModal: boolean = false) => {
    return (
      <div className={`overflow-hidden rounded-2xl shadow-xl border border-slate-200 bg-white transition-all ${isModal ? 'max-w-4xl w-full mx-auto' : 'w-full'}`}>
        {/* Header - Bright Blue banner matching image_85c066c5.png (Only shown in modal popup, hidden in inline upload view) */}
        {isModal && (
          <div className="bg-[#2563eb] text-white px-5 sm:px-6 py-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-white" />
              <h3 className="text-base font-bold text-white tracking-wide">
                {editingPolicy ? 'Edit Policy Record' : 'Add New Policy'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsPolicyModalOpen(false);
              }}
              className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Form Body - 2 Column Grid */}
        <form onSubmit={handleSavePolicy} className="p-6 sm:p-7 space-y-4 bg-white">
          <DayEndFieldset branchId={branch?.id}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Row 1: ASSURED NAME | GENDER */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                ASSURED NAME
              </label>
              <input
                type="text"
                required
                value={policyForm.memberName || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, memberName: e.target.value, name: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                GENDER
              </label>
              <select
                value={policyForm.gender || 'Select Gender'}
                onChange={e => setPolicyForm(prev => ({ ...prev, gender: e.target.value as 'Male' | 'Female' | 'Other' }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="Select Gender">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Row 2: CITIZENSHIP NO | CUSTOMER ID */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                CITIZENSHIP NO
              </label>
              <input
                type="text"
                required
                value={policyForm.citizenshipNo || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, citizenshipNo: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                CUSTOMER ID
              </label>
              <input
                type="text"
                value={policyForm.memberId || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, memberId: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 3: POLICY NO | DOB (BS) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                POLICY NO
              </label>
              <input
                type="text"
                required
                value={policyForm.policyNo || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, policyNo: e.target.value, policyNumber: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                DOB (BS)
              </label>
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                value={policyForm.dateOfBirthBs || ''}
                onChange={e => handleDobBsChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 4: DOB (AD) | AGE */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                DOB (AD)
              </label>
              <input
                type="date"
                value={policyForm.dateOfBirth || ''}
                onChange={e => handleDobAdChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                AGE
              </label>
              <input
                type="number"
                value={policyForm.age ?? 0}
                onChange={e => setPolicyForm(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 5: ADDRESS | DOC (BS) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                ADDRESS
              </label>
              <input
                type="text"
                value={policyForm.address || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                DOC (BS)
              </label>
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                value={policyForm.policyStartDateBs || ''}
                onChange={e => handleDocBsChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 6: DOC (AD) | TERM MONTH */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                DOC (AD)
              </label>
              <input
                type="date"
                value={policyForm.policyStartDate || ''}
                onChange={e => handleDocAdChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                TERM MONTH
              </label>
              <input
                type="number"
                value={policyForm.termMonths ?? 12}
                onChange={e => handleTermMonthChange(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 7: MATURITY DATE (AD) | POLICY AMOUNT */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                MATURITY DATE (AD)
              </label>
              <input
                type="date"
                value={policyForm.policyExpiryDate || ''}
                onChange={e => handleMaturityDateAdChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                POLICY AMOUNT
              </label>
              <input
                type="number"
                value={policyForm.loanAmount || 0}
                onChange={e => handlePolicyAmountChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 8: PREMIUM | OCCUPATION */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                PREMIUM
              </label>
              <input
                type="number"
                value={policyForm.premiumAmount || 0}
                onChange={e => setPolicyForm(prev => ({ ...prev, premiumAmount: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                OCCUPATION
              </label>
              <input
                type="text"
                value={policyForm.occupation || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, occupation: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 9: DISABILITY | LIVING ACTIVE LIFE */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                DISABILITY
              </label>
              <select
                value={policyForm.disability || 'No'}
                onChange={e => setPolicyForm(prev => ({ ...prev, disability: e.target.value as 'No' | 'Yes' }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                LIVING ACTIVE LIFE
              </label>
              <select
                value={policyForm.livingActiveLife || 'yes'}
                onChange={e => setPolicyForm(prev => ({ ...prev, livingActiveLife: e.target.value as 'yes' | 'no' }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </div>

            {/* Row 10: BRANCH | NOMINEE NAME */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                BRANCH {!canSwitchInsBranchView && <span className="text-[10px] font-normal text-slate-400">(Assigned Branch)</span>}
              </label>
              <select
                value={canSwitchInsBranchView ? formatBranchLabel(policyForm.branchId || defaultBranchLabel) : defaultBranchLabel}
                disabled={!canSwitchInsBranchView}
                onChange={e => setPolicyForm(prev => ({ ...prev, branchId: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
              >
                {selectableInsBranches.map(b => {
                  const label = formatBranchLabel(b.id);
                  return (
                    <option key={b.id} value={label}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                NOMINEE NAME
              </label>
              <input
                type="text"
                value={policyForm.nomineeName || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, nomineeName: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 11: NOMINEE RELATION | NOMINEE DOB (BS) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                NOMINEE RELATION
              </label>
              <input
                type="text"
                value={policyForm.nomineeRelation || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, nomineeRelation: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                NOMINEE DOB (BS)
              </label>
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                value={policyForm.nomineeDobBs || ''}
                onChange={e => handleNomineeDobBsChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 12: NOMINEE DOB (AD) | LOAN TYPE */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                NOMINEE DOB (AD)
              </label>
              <input
                type="date"
                value={policyForm.nomineeDob || ''}
                onChange={e => handleNomineeDobAdChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                LOAN TYPE
              </label>
              <input
                type="text"
                value={policyForm.loanType || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, loanType: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Row 13: STATUS | PAYMENT STATUS */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                STATUS
              </label>
              <select
                value={policyForm.status || 'Active (Start Policy)'}
                onChange={e => setPolicyForm(prev => ({ ...prev, status: e.target.value as LoanInsuranceStatus }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="Active (Start Policy)">Active (Start Policy)</option>
                <option value="Active">Active</option>
                <option value="Renewed">Renewed</option>
                <option value="Expired">Expired</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                PAYMENT STATUS
              </label>
              <select
                value={policyForm.premiumPaymentStatus || 'Due'}
                onChange={e => setPolicyForm(prev => ({ ...prev, premiumPaymentStatus: e.target.value as 'Paid' | 'Due' }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="Due">Due</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>

            {/* Row 14: PAYMENT REMARK */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                PAYMENT REMARK
              </label>
              <input
                type="text"
                placeholder="Payment notes..."
                value={policyForm.premiumPaymentRemark || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, premiumPaymentRemark: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="hidden md:block"></div>

            {/* Row 15: GENERAL REMARK / REJECTION REASON */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                GENERAL REMARK / REJECTION REASON
              </label>
              <textarea
                rows={3}
                placeholder="Notes or rejection reason..."
                value={policyForm.notes || ''}
                onChange={e => setPolicyForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y"
              />
            </div>
          </div>
          </DayEndFieldset>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                if (isModal) {
                  setIsPolicyModalOpen(false);
                } else {
                  setEditingPolicy(null);
                  setPolicyForm(getInitialPolicyForm());
                  setIsUploadFormVisible(false);
                  setExcelPreviewRows([]);
                }
              }}
              className="px-5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="px-6 py-2.5 bg-[#025e40] hover:bg-[#014730] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{editingPolicy ? 'Update Policy' : 'Save Data'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] bg-[#f8fafc] text-slate-800 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      {/* ======================================================== */}
      {/* TOP MENU NAVIGATION BAR (Permission & Branch-Scope Aware) */}
      {/* ======================================================== */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          {canViewInsDashboard && (
            <button
              type="button"
              onClick={() => setActiveMenu('dashboard')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMenu === 'dashboard'
                  ? 'bg-[#015e52] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          )}

          {canViewInsUpload && (
            <button
              type="button"
              onClick={() => {
                setActiveMenu('upload');
                setIsUploadFormVisible(false);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMenu === 'upload'
                  ? 'bg-[#015e52] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Policy</span>
            </button>
          )}

          {canViewInsReport && (
            <button
              type="button"
              onClick={() => setActiveMenu('report')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMenu === 'report'
                  ? 'bg-[#015e52] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Report</span>
            </button>
          )}

          {canViewInsAlerts && (
            <button
              type="button"
              onClick={() => setActiveMenu('alerts')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMenu === 'alerts'
                  ? 'bg-[#015e52] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Maturity Alerts</span>
              {summaryMetrics.upcomingMaturityCount > 0 && (
                <span className={`font-mono tabular-nums text-[11px] ${activeMenu === 'alerts' ? 'text-emerald-100' : 'text-amber-700'}`}>
                  ({summaryMetrics.upcomingMaturityCount})
                </span>
              )}
            </button>
          )}

          {canViewInsClaims && (
            <button
              type="button"
              onClick={() => setActiveMenu('claims')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMenu === 'claims'
                  ? 'bg-[#015e52] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Claim</span>
            </button>
          )}

          {canViewInsNotice && (
            <button
              type="button"
              onClick={() => setActiveMenu('notice')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMenu === 'notice'
                  ? 'bg-[#015e52] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Notice</span>
            </button>
          )}
        </div>

        {/* Top-Right Controls: Branch Scope Switcher / Locked Badge + Upload Action */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {canSwitchInsBranchView ? (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <Building2 className="w-3.5 h-3.5 text-[#015e52] shrink-0" />
              <select
                aria-label="Filter Insurance by Branch"
                value={selectedBranchFilter}
                onChange={e => setSelectedBranchFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL">
                  {hasAllInsBranchesAccess
                    ? 'All Branches'
                    : `All Allowed (${selectableInsBranches.length})`}
                </option>
                {selectableInsBranches.map(b => (
                  <option key={b.id} value={b.id}>
                    {formatBranchLabel(b.id)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold"
              title="Branch-isolated access: showing only your logged-in branch"
            >
              <Lock className="w-3 h-3 text-emerald-700" />
              <span>{formatBranchLabel(loggedInBranchObj?.id || branch?.id)}</span>
            </div>
          )}

          {activeMenu === 'upload' && canEditInsUpload && (
            <button
              type="button"
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : 'Add Policy Manually'}
              onClick={() => {
                setEditingPolicy(null);
                setPolicyForm(getInitialPolicyForm());
                setIsUploadFormVisible(true);
                setTimeout(() => {
                  document.getElementById('policy-form-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#025e40] hover:bg-[#014730] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Policy Manually</span>
            </button>
          )}
        </div>
      </header>

      {/* ======================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ======================================================== */}
      <main className="flex-1 p-3 sm:p-4 lg:p-5 overflow-y-auto">
        {!hasAnyInsuranceViewAccess && (
          <div className="max-w-lg mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Insurance Access Restricted</h3>
            <p className="text-xs text-slate-500">
              Your role does not currently have view permission for any Insurance tabs. Contact Super Admin to enable permissions in Role Management.
            </p>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: DASHBOARD (Redesigned Cooperative Insurance Overview) */}
        {/* ======================================================== */}
        {activeMenu === 'dashboard' && canViewInsDashboard && (() => {
          const totalForBar = Math.max(1, summaryMetrics.portfolioCount);
          const activeOnlyCount = Math.max(0, summaryMetrics.activeCount - summaryMetrics.renewedCount);
          const activePct = Math.round((summaryMetrics.activeCount / totalForBar) * 100);
          const activeBarPct = (activeOnlyCount / totalForBar) * 100;
          const renewedBarPct = (summaryMetrics.renewedCount / totalForBar) * 100;
          const expiredBarPct = (summaryMetrics.expiredCount / totalForBar) * 100;
          const closedBarPct = (summaryMetrics.closedCount / totalForBar) * 100;

          const attentionRows = dashboardAttentionTab === 'expired'
            ? expiredPolicies.slice(0, 6)
            : summaryMetrics.upcomingMaturityRecords.slice(0, 6);

          const getPolicyStatusDisplay = (r: LoanInsuranceRecord): { label: string; className: string } => {
            const st = (r.status || '').toLowerCase();
            if (st === 'closed' || st === 'settled' || st === 'deactivated') {
              return { label: 'Closed', className: 'text-slate-500' };
            }
            if (st === 'rejected') {
              return { label: 'Rejected', className: 'text-rose-700' };
            }
            if (st === 'expired' || (r.policyExpiryDate && new Date(r.policyExpiryDate) < new Date())) {
              return { label: 'Expired', className: 'text-rose-600' };
            }
            if (st === 'renewed') {
              return { label: 'Renewed', className: 'text-blue-700' };
            }
            return { label: 'Active', className: 'text-emerald-700' };
          };

          const getDaysRemainingLabel = (expiryDate?: string): string => {
            if (!expiryDate) return '—';
            const diffDays = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Tomorrow';
            return `In ${diffDays}d`;
          };

          return (
            <div className="space-y-4">
              {/* Top Overview Command Bar (Deep Cooperative Teal-Emerald Banner) */}
              <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#015e52] via-[#014f45] to-[#083c36] text-white px-5 py-3.5 rounded-xl border border-[#01483f] shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-200" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                    Loan Insurance Overview
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => refreshData({ syncRemote: true })}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-100" />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Row 1: 4 Color-Coded Primary Portfolio KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Total Insured Portfolio (Blue Accent) */}
                <button
                  type="button"
                  onClick={() => { if (canViewInsReport) { setReportFilter('all'); setActiveMenu('report'); } }}
                  className={`bg-gradient-to-br from-blue-50 via-white to-indigo-50/40 p-4 rounded-xl border border-blue-200 hover:border-blue-300 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs ${canViewInsReport ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-900/80">Total Insured Portfolio</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Database className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-blue-950">
                      {summaryMetrics.portfolioCount}
                    </span>
                    <span className="text-xs font-medium text-blue-700/80">policies</span>
                  </div>
                  <div className="pt-2.5 border-t border-blue-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Sum Assured</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        NPR {summaryMetrics.portfolioAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Total Premium</span>
                      <span className="font-mono tabular-nums font-semibold text-blue-700">
                        NPR {summaryMetrics.portfolioPremium.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 2. Active Coverage (Emerald Accent) */}
                <button
                  type="button"
                  onClick={() => { if (canViewInsReport) { setReportFilter('active'); setActiveMenu('report'); } }}
                  className={`bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 p-4 rounded-xl border border-emerald-200 hover:border-emerald-300 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs ${canViewInsReport ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-900/80">Active Coverage</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-emerald-950">
                      {summaryMetrics.activeCount}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                      {activePct}% active
                    </span>
                  </div>
                  <div className="pt-2.5 border-t border-emerald-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Active Amount</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        NPR {summaryMetrics.activeAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Active Premium</span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-700">
                        NPR {summaryMetrics.activePremium.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 3. Expired Policies (Rose Accent) */}
                <button
                  type="button"
                  onClick={() => { if (canViewInsReport) { setReportFilter('expired'); setActiveMenu('report'); } }}
                  className={`bg-gradient-to-br from-rose-50 via-white to-red-50/40 p-4 rounded-xl border border-rose-200 hover:border-rose-300 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs ${canViewInsReport ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-rose-900/80">Expired Policies</span>
                    <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-rose-700">
                      {summaryMetrics.expiredCount}
                    </span>
                    <span className="text-xs font-medium text-rose-700/80">
                      {summaryMetrics.expiredCount > 0 ? 'needs renewal' : 'none overdue'}
                    </span>
                  </div>
                  <div className="pt-2.5 border-t border-rose-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Expired Amount</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        NPR {summaryMetrics.expiredAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Premium Value</span>
                      <span className="font-mono tabular-nums font-semibold text-rose-700">
                        NPR {summaryMetrics.expiredPremium.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 4. Maturing in 30 Days (Amber Accent) */}
                <button
                  type="button"
                  onClick={() => { if (canViewInsAlerts) { setAlertPeriod('month'); setActiveMenu('alerts'); } }}
                  className={`bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-4 rounded-xl border border-amber-200 hover:border-amber-300 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs ${canViewInsAlerts ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-900/80">Maturing in 30 Days</span>
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Bell className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-amber-700">
                      {summaryMetrics.upcomingMaturityCount}
                    </span>
                    <span className="text-xs font-medium text-amber-700/80">upcoming</span>
                  </div>
                  <div className="pt-2.5 border-t border-amber-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Maturity Amount</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        NPR {summaryMetrics.upcomingMaturityAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Premium Value</span>
                      <span className="font-mono tabular-nums font-semibold text-amber-700">
                        NPR {summaryMetrics.upcomingMaturityPremium.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Row 2: Portfolio Health Distribution & Operational Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="px-5 py-3 bg-gradient-to-r from-slate-50 via-white to-emerald-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Portfolio Health & Lifecycle Status</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" aria-hidden="true" />
                      Active (<span className="font-mono tabular-nums">{activeOnlyCount}</span>)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" aria-hidden="true" />
                      Renewed (<span className="font-mono tabular-nums">{summaryMetrics.renewedCount}</span>)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" aria-hidden="true" />
                      Expired (<span className="font-mono tabular-nums">{summaryMetrics.expiredCount}</span>)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" aria-hidden="true" />
                      Closed (<span className="font-mono tabular-nums">{summaryMetrics.closedCount}</span>)
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Single Horizontal Stacked Progress Bar */}
                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                    {activeBarPct > 0 && (
                      <div
                        style={{ width: `${activeBarPct}%` }}
                        className="bg-emerald-600 h-full transition-all"
                        title={`Active: ${activeOnlyCount}`}
                      />
                    )}
                    {renewedBarPct > 0 && (
                      <div
                        style={{ width: `${renewedBarPct}%` }}
                        className="bg-blue-600 h-full transition-all"
                        title={`Renewed: ${summaryMetrics.renewedCount}`}
                      />
                    )}
                    {expiredBarPct > 0 && (
                      <div
                        style={{ width: `${expiredBarPct}%` }}
                        className="bg-rose-500 h-full transition-all"
                        title={`Expired: ${summaryMetrics.expiredCount}`}
                      />
                    )}
                    {closedBarPct > 0 && (
                      <div
                        style={{ width: `${closedBarPct}%` }}
                        className="bg-slate-400 h-full transition-all"
                        title={`Closed/Rejected: ${summaryMetrics.closedCount}`}
                      />
                    )}
                  </div>

                  {/* 5 Secondary Color-Tinted Operational Breakdown Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <button
                      type="button"
                      onClick={() => { setReportFilter('first_policy'); setActiveMenu('report'); }}
                      className="text-left cursor-pointer rounded-lg p-3 bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-100 transition-colors"
                    >
                      <div className="text-xs font-semibold text-indigo-900/80">First Policies</div>
                      <div className="text-lg font-extrabold font-mono tabular-nums text-indigo-950 mt-0.5">
                        {summaryMetrics.firstPolicyCount}
                      </div>
                      <div className="text-[11px] text-indigo-700/80 mt-0.5">Initial enrollments</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setReportFilter('renewal'); setActiveMenu('report'); }}
                      className="text-left cursor-pointer rounded-lg p-3 bg-blue-50/60 hover:bg-blue-50 border border-blue-100 transition-colors"
                    >
                      <div className="text-xs font-semibold text-blue-900/80">Renewed Policies</div>
                      <div className="text-lg font-extrabold font-mono tabular-nums text-blue-700 mt-0.5">
                        {summaryMetrics.renewedCount}
                      </div>
                      <div className="text-[11px] text-blue-700/80 font-mono tabular-nums mt-0.5">
                        NPR {summaryMetrics.renewedAmount.toLocaleString()}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setReportFilter('premium'); setActiveMenu('report'); }}
                      className="text-left cursor-pointer rounded-lg p-3 bg-amber-50/60 hover:bg-amber-50 border border-amber-100 transition-colors"
                    >
                      <div className="text-xs font-semibold text-amber-900/80">Premium Pending</div>
                      <div className="text-lg font-extrabold font-mono tabular-nums text-amber-700 mt-0.5">
                        {summaryMetrics.pendingCount}
                      </div>
                      <div className="text-[11px] text-amber-800/80 font-mono tabular-nums mt-0.5">
                        NPR {summaryMetrics.pendingPremiumDue.toLocaleString()} due
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setReportFilter('closed'); setActiveMenu('report'); }}
                      className="text-left cursor-pointer rounded-lg p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-colors"
                    >
                      <div className="text-xs font-semibold text-slate-700">Closed / Rejected</div>
                      <div className="text-lg font-extrabold font-mono tabular-nums text-slate-800 mt-0.5">
                        {summaryMetrics.closedCount}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono tabular-nums">{summaryMetrics.rejectedCount}</span> rejected · NPR{' '}
                        <span className="font-mono tabular-nums">{summaryMetrics.closedAmount.toLocaleString()}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setReportFilter('statement'); setActiveMenu('report'); }}
                      className="text-left cursor-pointer rounded-lg p-3 bg-teal-50/60 hover:bg-teal-50 border border-teal-100 transition-colors col-span-2 sm:col-span-1"
                    >
                      <div className="text-xs font-semibold text-teal-900/80">Claims Tracker</div>
                      <div className="text-lg font-extrabold font-mono tabular-nums text-teal-900 mt-0.5">
                        {summaryMetrics.claimsTotal}
                      </div>
                      <div className="text-[11px] text-teal-800/80 mt-0.5">
                        <span className="font-mono tabular-nums font-semibold text-amber-700">{summaryMetrics.claimsInProcess}</span> open ·{' '}
                        <span className="font-mono tabular-nums font-semibold text-emerald-700">{summaryMetrics.claimsSettled}</span> settled
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Action Queue (Expired / Upcoming) + Recent Policies */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Left (7 cols): Renewal & Maturity Action Queue */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-2xs">
                  <div className="px-5 py-3 bg-gradient-to-r from-rose-50/80 via-white to-amber-50/50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900">Renewal & Maturity Queue</h3>
                      <div className="inline-flex items-center p-0.5 bg-white rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setDashboardAttentionTab('expired')}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            dashboardAttentionTab === 'expired'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Expired (<span className="font-mono tabular-nums">{expiredPolicies.length}</span>)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashboardAttentionTab('upcoming')}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            dashboardAttentionTab === 'upcoming'
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Next 30d (<span className="font-mono tabular-nums">{summaryMetrics.upcomingMaturityCount}</span>)
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (dashboardAttentionTab === 'expired') {
                          setReportFilter('expired');
                          setActiveMenu('report');
                        } else {
                          setAlertPeriod('month');
                          setActiveMenu('alerts');
                        }
                      }}
                      className="text-xs font-semibold text-[#015e52] hover:underline cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>View All</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {attentionRows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
                      <div className="text-sm font-semibold text-slate-800">
                        {dashboardAttentionTab === 'expired' ? 'No expired policies pending' : 'No maturities due in the next 30 days'}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setReportFilter('all'); setActiveMenu('report'); }}
                        className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                      >
                        Browse All Policies
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-slate-100 text-[11px] font-semibold">
                            <th className="py-2.5 pl-5 pr-3">Assured Member</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Expiry Date</th>
                            <th className="py-2.5 px-3 text-right whitespace-nowrap">Sum Assured</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Payment</th>
                            <th className="py-2.5 pl-3 pr-5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {attentionRows.map(r => {
                            const payStatus = r.premiumPaymentStatus === 'Paid' ? 'Paid' : 'Due';
                            return (
                              <tr key={r.id} className="hover:bg-rose-50/30 transition-colors">
                                <td className="py-2.5 pl-5 pr-3">
                                  <div className="font-semibold text-slate-900 truncate max-w-[200px]">
                                    {r.memberName || r.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                                    {formatBranchLabel(r.branchId)} · {formatTermLabel(r)}
                                    {r.policyNo ? ` · ${r.policyNo}` : ''}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-mono tabular-nums font-medium text-slate-800">
                                    {r.policyExpiryDateBs || r.policyExpiryDate || '—'}
                                  </div>
                                  <div className={`text-[11px] font-semibold ${dashboardAttentionTab === 'expired' ? 'text-rose-600' : 'text-amber-700'}`}>
                                    {getDaysRemainingLabel(r.policyExpiryDate)}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                  NPR {(r.loanAmount || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className={`text-[11px] font-semibold ${payStatus === 'Paid' ? 'text-emerald-700' : 'text-rose-600'}`}>
                                    {payStatus}
                                  </span>
                                </td>
                                <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleViewPolicyDetails(r)}
                                      title="View policy details"
                                      className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    {canRenewFromDashboard && (
                                      <button
                                        type="button"
                                        disabled={isDayEnded}
                                        title={isDayEnded ? getDayEndedBlockMessage() : 'Renew or manage policy'}
                                        onClick={() => handleOpenRenewalModal(r)}
                                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#015e52] hover:bg-[#01473e] rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Renew
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right (5 cols): Recent Policies */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-2xs">
                  <div className="px-5 py-3 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/50 border-b border-slate-200/80 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Recent Policies</h3>
                    <button
                      type="button"
                      onClick={() => { setReportFilter('all'); setActiveMenu('report'); }}
                      className="text-xs font-semibold text-[#015e52] hover:underline cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>View All</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {recentPolicies.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
                      <FileText className="w-8 h-8 text-slate-300 mb-2" />
                      <div className="text-sm font-semibold text-slate-800">No insurance policies yet</div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 flex-1">
                      {recentPolicies.map(r => {
                        const statusMeta = getPolicyStatusDisplay(r);
                        const startDateText = r.policyStartDateBs || r.policyStartDate || '—';
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => handleViewPolicyDetails(r)}
                            className="w-full px-5 py-3 hover:bg-emerald-50/40 transition-colors flex items-center justify-between gap-3 text-left cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {r.memberName || r.name}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {formatBranchLabel(r.branchId)} · <span className="font-mono tabular-nums">{startDateText}</span>
                                {' · '}
                                <span className={`font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold font-mono tabular-nums text-blue-700">
                                NPR {(r.loanAmount || 0).toLocaleString()}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-emerald-700 mt-0.5">
                                Prem. NPR {(r.premiumAmount || r.premium || 0).toLocaleString()}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 4: Branch Portfolio Breakdown + Claims Desk */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Left (8 cols): Branch-Wise Coverage Summary */}
                <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-2xs">
                  <div className="px-5 py-3 bg-gradient-to-r from-blue-50/80 via-white to-emerald-50/50 border-b border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">Branch-Wise Coverage Summary</h3>
                      {canSwitchInsBranchView && selectedBranchFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setSelectedBranchFilter('ALL')}
                          className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer shrink-0"
                        >
                          Show All
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => exportToExcel(records)}
                      disabled={records.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#015e52] hover:bg-[#01473e] rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Excel</span>
                    </button>
                  </div>

                  {summaryMetrics.branchBreakdown.length === 0 ? (
                    <div className="px-6 py-8 text-center text-xs text-slate-500">
                      Branch coverage totals will appear here once policies are recorded.
                    </div>
                  ) : (
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#015e52] text-white text-[11px] font-semibold">
                            <th className="py-2.5 pl-5 pr-3">Branch</th>
                            <th className="py-2.5 px-3 text-right">Policies</th>
                            <th className="py-2.5 px-3 text-right">Active</th>
                            <th className="py-2.5 px-3 text-right">Expired</th>
                            <th className="py-2.5 px-3 text-right">Sum Assured</th>
                            <th className="py-2.5 pl-3 pr-5 text-right">Premium</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {summaryMetrics.branchBreakdown.map(row => {
                            const matchedBranchObj = findMatchingBranch(row.branchName, selectableInsBranches);
                            const canDrillDown = canViewInsReport && (canSwitchInsBranchView ? Boolean(matchedBranchObj) : true);
                            return (
                              <tr
                                key={row.branchName}
                                onClick={() => {
                                  if (!canDrillDown) return;
                                  if (canSwitchInsBranchView && matchedBranchObj) {
                                    setSelectedBranchFilter(matchedBranchObj.id);
                                  }
                                  setReportFilter('all');
                                  setActiveMenu('report');
                                }}
                                title={canDrillDown ? `View ${row.branchName} policies in Report` : undefined}
                                className={`hover:bg-blue-50/40 transition-colors ${canDrillDown ? 'cursor-pointer' : ''}`}
                              >
                                <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                                  {row.branchName}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-700">
                                  {row.total}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                                  {row.active}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold ${row.expired > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                  {row.expired}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                  NPR {row.amount.toLocaleString()}
                                </td>
                                <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums font-semibold text-blue-700 whitespace-nowrap">
                                  NPR {row.premium.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-emerald-200 bg-emerald-50/80 text-xs font-bold text-slate-900">
                            <td className="py-2.5 pl-5 pr-3 text-emerald-950">Total Portfolio</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">{summaryMetrics.portfolioCount}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">{summaryMetrics.activeCount}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-600">{summaryMetrics.expiredCount}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-emerald-950">
                              NPR {summaryMetrics.portfolioAmount.toLocaleString()}
                            </td>
                            <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums whitespace-nowrap text-blue-800">
                              NPR {summaryMetrics.portfolioPremium.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right (4 cols): Claims Desk */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-2xs">
                  <div className="px-5 py-3 bg-gradient-to-r from-teal-50/80 via-white to-blue-50/50 border-b border-slate-200/80 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Claims Desk</h3>
                    <button
                      type="button"
                      onClick={() => {
                        if (canViewInsClaims) {
                          setActiveMenu('claims');
                        } else {
                          setReportFilter('statement');
                          setActiveMenu('report');
                        }
                      }}
                      className="text-xs font-semibold text-[#015e52] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Manage Claims
                    </button>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    {/* 3-Column Color-Tinted Claims Stats */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="rounded-lg bg-amber-50/80 border border-amber-100 p-3">
                        <div className="text-[11px] font-semibold text-amber-800">In Process</div>
                        <div className="text-xl font-extrabold font-mono tabular-nums text-amber-700 mt-1">
                          {summaryMetrics.claimsInProcess}
                        </div>
                      </div>
                      <div className="rounded-lg bg-emerald-50/80 border border-emerald-100 p-3">
                        <div className="text-[11px] font-semibold text-emerald-800">Settled</div>
                        <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-700 mt-1">
                          {summaryMetrics.claimsSettled}
                        </div>
                      </div>
                      <div className="rounded-lg bg-rose-50/80 border border-rose-100 p-3">
                        <div className="text-[11px] font-semibold text-rose-800">Rejected</div>
                        <div className="text-xl font-extrabold font-mono tabular-nums text-rose-700 mt-1">
                          {summaryMetrics.claimsRejected}
                        </div>
                      </div>
                    </div>

                    {/* Total Claim Disbursed Highlight */}
                    <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50/80 border border-emerald-200 px-4 py-3.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold text-emerald-800">Total Claim Disbursed</div>
                        <div className="text-base font-extrabold font-mono tabular-nums text-emerald-950 mt-0.5">
                          NPR {summaryMetrics.totalClaimDisbursed.toLocaleString()}
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Heart className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ======================================================== */}
        {/* VIEW 2: UPLOAD POLICY (Clean upload without initial form or banners) */}
        {/* ======================================================== */}
        {activeMenu === 'upload' && canViewInsUpload && (
          <div className="max-w-4xl mx-auto space-y-6">
            {!canEditInsUpload ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">View-Only Access</h3>
                <p className="text-xs text-slate-500">
                  Your role has View access only for Policy Upload. Edit permission is required to upload or enroll new policies.
                </p>
              </div>
            ) : (
            <>
            {/* Hidden Direct File Inputs for Upload */}
            <input
              ref={quickUploadInputRef}
              type="file"
              accept="image/*,.pdf,.xlsx,.xls,.csv"
              disabled={isDayEnded}
              onChange={handleQuickUploadFile}
              className="hidden"
              id="quick-upload-input"
            />
            <input
              ref={ocrFileInputRef}
              type="file"
              accept="image/*,.pdf"
              disabled={isDayEnded}
              onChange={handleOcrFileUpload}
              className="hidden"
              id="direct-ocr-file-input"
            />
            <input
              ref={excelFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={isDayEnded}
              onChange={handleExcelFileUpload}
              className="hidden"
              id="direct-excel-file-input"
            />

            {/* Clean Upload Area without extra subtext or redundant pill buttons */}
            <div
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className={`border-2 border-dashed rounded-3xl p-12 text-center bg-white shadow-xs transition-colors ${isDayEnded ? 'border-slate-200 opacity-60' : 'border-emerald-300 hover:border-emerald-500'}`}
            >
              <label htmlFor={isDayEnded ? undefined : 'quick-upload-input'} className={isDayEnded ? 'cursor-not-allowed block' : 'cursor-pointer block'}>
                <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 hover:scale-105 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Upload Policy File</h3>
              </label>
            </div>

            {/* Scanning / Parsing Status Indicators */}
            {isOcrProcessing && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center justify-center gap-3 text-purple-900 text-xs font-bold animate-pulse shadow-xs">
                <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
                <span>AI OCR Scanning in progress... Auto-extracting assured borrower, policy parameters, and nominee details...</span>
              </div>
            )}

            {isExcelParsing && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-center gap-3 text-emerald-900 text-xs font-bold animate-pulse shadow-xs">
                <RefreshCw className="w-4 h-4 text-[#015e52] animate-spin" />
                <span>Reading and parsing spreadsheet records...</span>
              </div>
            )}

            {/* Spreadsheet Extracted Control Bar with Save Data */}
            {excelPreviewRows.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 text-xs">
                  <div className="p-2 rounded-xl bg-emerald-100 text-[#015e52]">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-800">
                      Spreadsheet Extracted: {excelPreviewRows.length} policy record(s) detected
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Data populated directly into the form fields below. Click "Save Data" to store in All Policies.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setExcelPreviewRows([]);
                      setPolicyForm(getInitialPolicyForm());
                      setIsUploadFormVisible(false);
                    }}
                    className="px-3.5 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={isDayEnded}
                    title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                    onClick={handleSaveDataDirect}
                    className="px-5 py-2 bg-[#025e40] hover:bg-[#014730] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Data</span>
                  </button>
                </div>
              </div>
            )}

            {/* Policy Entry Form - ONLY rendered when file is uploaded or explicitly opened */}
            {isUploadFormVisible && (
              <div id="policy-form-section" className="pt-2">
                {renderPolicyFormCard(false)}
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: REPORT (Branch-Wise & Permission-Aware) */}
        {/* ======================================================== */}
        {activeMenu === 'report' && canViewInsReport && (
          <div className="space-y-2">
            {/* Top Filter Badges (Compact horizontal scrollable pill buttons) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <button
                onClick={() => handleSelectReportFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'all'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>All Policy</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${reportFilter === 'all' ? 'bg-[#014730] text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {records.length}
                </span>
              </button>

              <button
                onClick={() => handleSelectReportFilter('active')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'active'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Active</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${reportFilter === 'active' ? 'bg-[#014730] text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {summaryMetrics.activeCount}
                </span>
              </button>

              <button
                onClick={() => handleSelectReportFilter('first_policy')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'first_policy'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>First Policy</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${reportFilter === 'first_policy' ? 'bg-[#014730] text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {summaryMetrics.firstPolicyCount}
                </span>
              </button>

              <button
                onClick={() => handleSelectReportFilter('closed')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'closed'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Closed</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${reportFilter === 'closed' ? 'bg-[#014730] text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {summaryMetrics.closedCount}
                </span>
              </button>

              <button
                onClick={() => handleSelectReportFilter('expired')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'expired'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Expired</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${reportFilter === 'expired' ? 'bg-[#014730] text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {summaryMetrics.expiredCount}
                </span>
              </button>

              <button
                onClick={() => handleSelectReportFilter('renewal')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'renewal'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Renewal</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${reportFilter === 'renewal' ? 'bg-[#014730] text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {summaryMetrics.renewedCount}
                </span>
              </button>

              <button
                onClick={() => handleSelectReportFilter('premium')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'premium'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Premium</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${reportFilter === 'premium' ? 'bg-[#014730] text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {summaryMetrics.premiumCount}
                </span>
              </button>

              <button
                onClick={() => handleSelectReportFilter('statement')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'statement'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Statement</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${reportFilter === 'statement' ? 'bg-[#014730] text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {summaryMetrics.statementCount}
                </span>
              </button>
            </div>

            {/* Sub-header with Branch-Wise Filter, Search, and Export to Excel */}
            <div className="bg-white rounded-xl border border-slate-200 px-3.5 py-2 shadow-2xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <h3 className="text-xs font-bold text-slate-900 shrink-0">
                  {effectiveInsBranchKeys.length === 1
                    ? `${formatBranchLabel(effectiveInsBranchKeys[0])} Policies`
                    : 'All Policies'}
                </h3>

                {/* Branch-Wise Filter Control */}
                {canSwitchInsBranchView ? (
                  <div className="flex items-center gap-1.5 bg-emerald-50/70 border border-emerald-200 rounded-lg px-2.5 py-1 shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-[#015e52] shrink-0" />
                    <span className="text-[10px] font-bold uppercase text-emerald-900/80 hidden sm:inline">Branch:</span>
                    <select
                      aria-label="Filter Report by Branch"
                      value={selectedBranchFilter}
                      onChange={e => setSelectedBranchFilter(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">
                        {hasAllInsBranchesAccess
                          ? 'All Branches'
                          : `All Allowed (${selectableInsBranches.length})`}
                      </option>
                      {selectableInsBranches.map(b => (
                        <option key={b.id} value={b.id}>
                          {formatBranchLabel(b.id)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold shrink-0">
                    <Building2 className="w-3 h-3 text-[#015e52]" />
                    <span>{formatBranchLabel(loggedInBranchObj?.id || branch?.id)}</span>
                  </div>
                )}

                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search borrower, policy, citizens"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#025e40]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => exportToExcel(filteredReportRecords)}
                className="px-3.5 py-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>Export to Excel</span>
              </button>
            </div>

            {/* Table with Branch Column & whitespace-nowrap */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
              <table className="w-full min-w-[1220px] text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">S.N.</th>
                    <th className="px-4 py-3 whitespace-nowrap">POLICY HOLDER</th>
                    <th className="px-4 py-3 whitespace-nowrap">BRANCH</th>
                    <th className="px-4 py-3 whitespace-nowrap">CITIZENSHIP NO</th>
                    <th className="px-4 py-3 whitespace-nowrap">DOB</th>
                    <th className="px-4 py-3 whitespace-nowrap">POLICY AMOUNT</th>
                    <th className="px-4 py-3 whitespace-nowrap">PREMIUM</th>
                    <th className="px-4 py-3 whitespace-nowrap">START DATE</th>
                    <th className="px-4 py-3 whitespace-nowrap">MATURITY DATE</th>
                    <th className="px-4 py-3 whitespace-nowrap">STATUS</th>
                    <th className="px-4 py-3 whitespace-nowrap">PAYMENT</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReportRecords.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-slate-400 whitespace-nowrap">
                        No policies match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredReportRecords.map((r, i) => {
                      const initialLetter = (r.memberName || r.name || 'S').charAt(0).toUpperCase();
                      const rawStatusLower = (r.status || '').toLowerCase();
                      const isHiddenClosed = Boolean(r.hiddenReportTabs?.includes('closed'));
                      const isRejected = !isHiddenClosed && rawStatusLower === 'rejected';
                      const isClosed =
                        !isHiddenClosed &&
                        (r.recordKind === 'closed' || rawStatusLower === 'closed' || rawStatusLower === 'deactivated');
                      const isExpired =
                        !isClosed &&
                        !isRejected &&
                        (rawStatusLower === 'expired' || Boolean(r.policyExpiryDate && new Date(r.policyExpiryDate) < new Date()));
                      const showRenewedBadge =
                        reportFilter === 'renewal' &&
                        !isExpired &&
                        !isClosed &&
                        !isRejected &&
                        (r.recordKind === 'renewal' || rawStatusLower === 'renewed');

                      const statusLabel = isRejected
                        ? 'REJECTED'
                        : isClosed
                          ? 'CLOSED'
                          : isExpired
                            ? 'EXPIRED'
                            : showRenewedBadge
                              ? 'RENEWED'
                              : 'ACTIVE';

                      const statusClass = isExpired
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : showRenewedBadge
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : isRejected
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isClosed
                              ? 'bg-slate-100 text-slate-700 border border-slate-300'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

                      return (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-500 whitespace-nowrap">{i + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                {initialLetter}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs whitespace-nowrap">{r.memberName || r.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-100 text-[10px] font-bold">
                              {formatBranchLabel(r.branchId)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 text-xs whitespace-nowrap">{r.citizenshipNo || 'N/A'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.dateOfBirth || 'N/A'}</td>
                          <td className="px-4 py-3 font-bold text-slate-900 font-mono whitespace-nowrap">
                            {(r.loanAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-bold text-blue-600 font-mono whitespace-nowrap">
                            {(r.premiumAmount || r.premium || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.policyStartDate || r.start_date}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1 font-semibold text-red-600 whitespace-nowrap">
                              <Calendar className="w-3 h-3 text-red-500 shrink-0" />
                              <span>{r.policyExpiryDate || r.maturity_date}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {(() => {
                              // When first coming or before premium is configured, this cell is empty
                              if (!r.isPremiumSaved) {
                                return null;
                              }

                              const loanYears = r.loanDurationYears ?? (r.termMonths ? Math.round(r.termMonths / 12) : 1);
                              const paidYears = r.paidYears !== undefined 
                                ? r.paidYears 
                                : (r.premiumPaymentStatus === 'Paid' ? loanYears : 0);
                              const isDue = paidYears < loanYears;

                              return isDue ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-300">
                                  DUE
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  PAID
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 text-slate-400 whitespace-nowrap">
                              {/* 'P' Premium & Dues Management Button: only in Premium sub-menu for records not yet updated */}
                              {canEditInsReport && reportFilter === 'premium' && !r.isPremiumSaved && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenPremiumModal(r)}
                                  className="w-5 h-5 rounded bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] flex items-center justify-center shadow-2xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isDayEnded ? getDayEndedBlockMessage() : 'Manage Premium & Dues (P)'}
                                >
                                  P
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleViewPolicyDetails(r)}
                                className="p-1 hover:text-blue-600 rounded cursor-pointer"
                                title="View Insurance Records & History"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => exportToExcel([r])}
                                className="p-1 hover:text-emerald-600 rounded cursor-pointer"
                                title="Download Policy in Excel Format"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              {canEditInsReport && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenEditPolicy(r)}
                                  className="p-1 hover:text-blue-600 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Policy'}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Renew Policy: never shown in 'all', only in 'expired' or 'renewal' */}
                              {canEditInsReport && reportFilter !== 'all' && (reportFilter === 'expired' || reportFilter === 'renewal') && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenRenewalModal(r)}
                                  className="p-1 hover:text-amber-600 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isDayEnded ? getDayEndedBlockMessage() : 'Renew Policy'}
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Deactivate Policy: only shown in 'expired' tab; opens remark modal to move to Closed */}
                              {canEditInsReport && reportFilter === 'expired' && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenDeactivateModal(r)}
                                  className="p-1 hover:text-red-600 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isDayEnded ? getDayEndedBlockMessage() : 'Deactivate Policy (Move to Closed)'}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canDeletePolicy && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleDeletePolicy(r.id)}
                                  className="p-1 hover:text-red-600 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={
                                    isDayEnded
                                      ? getDayEndedBlockMessage()
                                      : reportFilter === 'all' || reportFilter === 'active' || reportFilter === 'first_policy'
                                        ? 'Permanently Delete Policy'
                                        : reportFilter === 'renewal'
                                          ? 'Remove from Renewal & Statement'
                                          : 'Remove from this menu only'
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: MATURITY ALERTS (Branch-Wise & Permission-Aware) */}
        {/* ======================================================== */}
        {activeMenu === 'alerts' && canViewInsAlerts && (
          <div className="space-y-3 max-w-5xl mx-auto">
            {/* Header with Title and Filter pills */}
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Upcoming Maturities</h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Period Pills Filter matching Image 4 */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold text-slate-600">
                  <button
                    onClick={() => setAlertPeriod('all')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      alertPeriod === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setAlertPeriod('today')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      alertPeriod === 'today' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setAlertPeriod('tomorrow')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      alertPeriod === 'tomorrow' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Tomorrow
                  </button>
                  <button
                    onClick={() => setAlertPeriod('week')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      alertPeriod === 'week' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setAlertPeriod('month')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      alertPeriod === 'month' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Month
                  </button>
                </div>
              </div>
            </div>

            {/* Empty state container matching Image 4 */}
            {filteredAlertRecords.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-3xl p-16 text-center bg-white shadow-xs">
                <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-500">
                  No maturities found for the selected period.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Policy No</th>
                      <th className="p-3.5">Member Name</th>
                      <th className="p-3.5">Branch</th>
                      <th className="p-3.5">Loan Amount</th>
                      <th className="p-3.5">Maturity Date</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAlertRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-mono font-bold text-slate-900">{r.policyNo}</td>
                        <td className="p-3.5 font-bold text-slate-800">{r.memberName || r.name}</td>
                        <td className="p-3.5">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-100 text-[10px] font-bold">
                            {formatBranchLabel(r.branchId)}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono">NPR {(r.loanAmount || 0).toLocaleString()}</td>
                        <td className="p-3.5 text-red-600 font-bold">{r.policyExpiryDate}</td>
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewPolicyDetails(r)}
                              title="View policy details"
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {canRenewFromAlerts && (
                              <button
                                type="button"
                                disabled={isDayEnded}
                                title={isDayEnded ? getDayEndedBlockMessage() : 'Renew Policy'}
                                onClick={() => handleOpenRenewalModal(r)}
                                className="px-3 py-1 bg-[#025e40] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Renew Policy
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 5: LOAN INSURANCE NOTICE, RATE CHART & GUIDELINES   */}
        {/* ======================================================== */}
        {activeMenu === 'notice' && canViewInsNotice && (
          <InsuranceNoticePanel
            canEdit={canEditInsNotice}
            canDelete={canDeleteInsNotice}
            isDayEnded={isDayEnded}
            currentUserName={user?.fullName || user?.username || 'Admin'}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW 6: CLAIMS MANAGEMENT & SETTLEMENT                   */}
        {/* ======================================================== */}
        {activeMenu === 'claims' && canViewInsClaims && (
          <InsuranceClaimsPanel
            claims={claims}
            policies={records}
            formatBranchLabel={formatBranchLabel}
            resolveAllowedBranchForSave={resolveAllowedBranchForSave}
            canEdit={canEditInsClaims}
            canDelete={canDeleteInsClaims}
            isDayEnded={isDayEnded}
            currentUserName={user?.fullName || user?.username || 'Admin'}
            onDataChanged={() => refreshData()}
            onPrintSettlementVoucher={handleViewSettlementReceipt}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW 6: CONTROL PANEL / UNDERWRITERS */}
        {/* ======================================================== */}
        {activeMenu === 'control_panel' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">Approved Insurance Underwriting Partners</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-blue-50 text-blue-700">
                        {c.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {c.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mb-2">{c.name}</h3>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>Contact: {c.contactPerson}</div>
                      <div>Phone: {c.phone}</div>
                      <div>Email: {c.email}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs">
                    <span className="text-slate-500">Standard Rate:</span>
                    <span className="font-bold text-emerald-700 font-mono">{c.defaultPremiumRate}% p.a.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

      {/* OCR Scan Upload Modal */}
      {isOcrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Smart OCR Document Extraction</h3>
                  <p className="text-xs text-slate-500">Upload loan deed or insurance schedule to auto-extract fields</p>
                </div>
              </div>
              <button
                onClick={() => setIsOcrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div title={isDayEnded ? getDayEndedBlockMessage() : undefined} className={`border-2 border-dashed border-purple-200 rounded-2xl p-8 text-center bg-purple-50/20 transition-colors ${isDayEnded ? 'opacity-60' : 'hover:bg-purple-50/50'}`}>
              <input
                ref={ocrFileInputRef}
                type="file"
                accept="image/*,.pdf"
                disabled={isDayEnded}
                onChange={handleOcrFileUpload}
                className="hidden"
                id="ocr-file-input"
              />
              <label htmlFor={isDayEnded ? undefined : 'ocr-file-input'} className={isDayEnded ? 'cursor-not-allowed block' : 'cursor-pointer block'}>
                <div className="w-14 h-14 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="text-sm font-bold text-slate-800">
                  Select Loan Document or Photo
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Supports PNG, JPG, and PDF deeds, loan passbooks, or citizenship cards
                </div>
              </label>

              {isOcrProcessing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-purple-700 text-xs font-bold animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scanning document layout & extracting parameters...</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIsOcrModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Excel Import Modal */}
      {isExcelImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-emerald-100 text-[#015e52] rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Bulk Excel / CSV Policy Import</h3>
                  <p className="text-xs text-slate-500">Upload policy spreadsheets with auto-header mapping</p>
                </div>
              </div>
              <button
                onClick={() => setIsExcelImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {excelPreviewRows.length === 0 ? (
              <div title={isDayEnded ? getDayEndedBlockMessage() : undefined} className={`border-2 border-dashed border-emerald-200 rounded-2xl p-8 text-center bg-emerald-50/20 transition-colors ${isDayEnded ? 'opacity-60' : 'hover:bg-emerald-50/50'}`}>
                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  disabled={isDayEnded}
                  onChange={handleExcelFileUpload}
                  className="hidden"
                  id="excel-file-input"
                />
                <label htmlFor={isDayEnded ? undefined : 'excel-file-input'} className={isDayEnded ? 'cursor-not-allowed block' : 'cursor-pointer block'}>
                  <div className="w-14 h-14 bg-emerald-100 text-[#015e52] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    Upload Policy Spreadsheet (.xlsx or .csv)
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Columns: Member Name, Citizenship No, Loan Amount, Loan Type, Nominee, Relation
                  </div>
                </label>

                {isExcelParsing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-emerald-800 text-xs font-bold animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Parsing spreadsheet rows...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">
                    Parsed {excelPreviewRows.length} valid rows from spreadsheet:
                  </span>
                  <button
                    onClick={() => setExcelPreviewRows([])}
                    className="text-slate-500 hover:text-slate-800 underline text-xs"
                  >
                    Select Different File
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-[11px] text-slate-600">
                    <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2">Citizenship</th>
                        <th className="p-2">Loan Amount</th>
                        <th className="p-2">Premium</th>
                        <th className="p-2">Nominee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {excelPreviewRows.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{row.memberName}</td>
                          <td className="p-2 font-mono">{row.citizenshipNo}</td>
                          <td className="p-2 font-mono font-bold text-emerald-800">NPR {row.loanAmount?.toLocaleString()}</td>
                          <td className="p-2 font-mono">NPR {row.premiumAmount?.toLocaleString()}</td>
                          <td className="p-2">{row.nomineeName} ({row.nomineeRelation})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsExcelImportModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDayEnded}
                    title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                    onClick={handleConfirmExcelImport}
                    className="px-5 py-2 bg-[#025e40] hover:bg-[#014730] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import All {excelPreviewRows.length} Policies
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renewal Modal - Exact Match to image_7c9690b7.png */}
      {isRenewalModalOpen && renewingPolicy && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-start pt-16 sm:pt-20 pb-12 px-3 sm:px-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-2">
            {/* Header: Bright Blue bar with Renewal title & policy info */}
            <div className="bg-[#1d4ed8] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/20 text-white flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-wide">Renewal</h3>
                  <p className="text-xs text-blue-100 font-medium">
                    Member: <span className="font-bold text-white">{renewingPolicy.memberName || renewingPolicy.name}</span> · Cit: <span className="font-mono text-white">{renewingPolicy.citizenshipNo || 'N/A'}</span> · Policy: <span className="font-mono font-bold text-white">#{renewingPolicy.policyNo}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRenewalModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 text-xs text-slate-700 max-h-[calc(85vh-5rem)] overflow-y-auto">
              <DayEndFieldset branchId={branch?.id} className="space-y-5">
              {/* SECTION 1: EXISTING POLICY LOAN DATES */}
              <div className="rounded-2xl border border-amber-200/90 p-4 bg-amber-50/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="font-extrabold text-slate-800 tracking-wider text-[11px] uppercase">
                    EXISTING POLICY LOAN DATES
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Left: LOAN DATE */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>LOAN DATE</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">DATE BS</label>
                      <input
                        type="text"
                        value={renewalForm.existingDateBs}
                        onChange={e => handleRenewalExistingBsChange(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">DATE AD</label>
                      <input
                        type="date"
                        value={renewalForm.existingDateAd}
                        onChange={e => handleRenewalExistingAdChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  {/* Right: MATURITY DATE */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-red-600" />
                      <span>MATURITY DATE</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">MATURITY BS</label>
                      <input
                        type="text"
                        value={renewalForm.existingMaturityBs}
                        onChange={e => handleRenewalExistingMatBsChange(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">MATURITY AD</label>
                      <input
                        type="date"
                        value={renewalForm.existingMaturityAd}
                        onChange={e => handleRenewalExistingMatAdChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: NEW RENEWAL POLICY DATES & TERMS */}
              <div className="rounded-2xl border border-blue-200/90 p-4 bg-blue-50/10 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span className="font-extrabold text-slate-800 tracking-wider text-[11px] uppercase">
                      NEW RENEWAL POLICY DATES & TERMS
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                    NEW ACTIVE POLICY
                  </span>
                </div>

                {/* New Renew Date & New Maturity Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Left: NEW RENEW DATE */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>NEW RENEW DATE</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">DATE BS</label>
                      <input
                        type="text"
                        value={renewalForm.newRenewDateBs}
                        onChange={e => handleRenewalNewDateBsChange(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">DATE AD</label>
                      <input
                        type="date"
                        value={renewalForm.newRenewDateAd}
                        onChange={e => handleRenewalNewDateAdChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  {/* Right: NEW MATURITY DATE */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>NEW MATURITY DATE</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">MATURITY BS</label>
                      <input
                        type="text"
                        value={renewalForm.newMaturityDateBs}
                        onChange={e => handleRenewalNewMatBsChange(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">MATURITY AD</label>
                      <input
                        type="date"
                        value={renewalForm.newMaturityDateAd}
                        onChange={e => handleRenewalNewMatAdChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Loan Duration & Insurance Term */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800 text-[11px]">LOAN DURATION</span>
                      <span className="px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {renewalForm.loanDurationYears * 12} Months (From Premium)
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        readOnly
                        disabled
                        value={renewalForm.loanDurationYears}
                        className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 pr-16 cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                        Years (Locked)
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800 text-[11px]">INSURANCE TERM</span>
                      <span className="px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        {Math.round(renewalForm.insuranceTermMonths / 12)} Year(s)
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={renewalForm.insuranceTermMonths}
                        onChange={e => handleRenewalInsuranceTermChange(parseInt(e.target.value, 10) || 12)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 pr-14 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                        Months
                      </span>
                    </div>
                  </div>
                </div>

                {/* Insurance Start Date & Insurance Till Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>INSURANCE START DATE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">BS</label>
                        <input
                          type="text"
                          value={renewalForm.insuranceStartDateBs}
                          onChange={e => setRenewalForm(p => ({ ...p, insuranceStartDateBs: e.target.value }))}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">AD</label>
                        <input
                          type="date"
                          value={renewalForm.insuranceStartDateAd}
                          onChange={e => setRenewalForm(p => ({ ...p, insuranceStartDateAd: e.target.value }))}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>INSURANCE TILL DATE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">BS</label>
                        <input
                          type="text"
                          value={renewalForm.insuranceTillDateBs}
                          onChange={e => setRenewalForm(p => ({ ...p, insuranceTillDateBs: e.target.value }))}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">AD</label>
                        <input
                          type="date"
                          value={renewalForm.insuranceTillDateAd}
                          onChange={e => setRenewalForm(p => ({ ...p, insuranceTillDateAd: e.target.value }))}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Renewal Amount & Premium Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] mb-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>RENEWAL AMOUNT (POLICY AMT)</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs pointer-events-none">
                        NPR
                      </span>
                      <input
                        type="number"
                        value={renewalForm.renewalAmount}
                        onChange={e => handleRenewalAmountChange(parseFloat(e.target.value) || 0)}
                        className="w-full pl-12 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] mb-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>PREMIUM AMOUNT</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs pointer-events-none">
                        NPR
                      </span>
                      <input
                        type="number"
                        value={renewalForm.premiumAmount}
                        onChange={e => setRenewalForm(p => ({ ...p, premiumAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-12 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-700 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: PREMIUM & DUES ARRANGEMENT */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/30 space-y-3.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-extrabold text-slate-800 tracking-wider text-[11px] uppercase">
                    PREMIUM & DUES ARRANGEMENT
                  </span>
                </div>

                <div className="space-y-3">
                  {/* OLD POLICY PREMIUM STATUS box */}
                  <div className="rounded-xl border border-amber-300 p-3 bg-amber-50/20 space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                      <span>OLD POLICY PREMIUM STATUS</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          LOAN TERM (LOAN YEARS)
                        </label>
                        <input
                          type="number"
                          readOnly
                          disabled
                          value={renewalForm.oldLoanTermYears}
                          className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          PAID YEARS
                        </label>
                        <input
                          type="number"
                          readOnly
                          disabled
                          value={renewalForm.oldPaidYears}
                          className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-bold text-slate-700">Old Policy Premium Status:</span>
                      {renewalForm.oldPaidYears < renewalForm.oldLoanTermYears ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 border border-red-300 uppercase">
                          DUE ({renewalForm.oldLoanTermYears - renewalForm.oldPaidYears} Yr(s) Due)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                          PAID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* NEW RENEWAL PREMIUM ARRANGEMENT box */}
                  <div className="rounded-xl border border-blue-300 p-3 bg-blue-50/20 space-y-2.5">
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                      <span>NEW RENEWAL PREMIUM ARRANGEMENT</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          NEW LOAN TERM (YEARS)
                        </label>
                        <input
                          type="number"
                          readOnly
                          disabled
                          value={renewalForm.newLoanTermYears}
                          className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          NEW PAID YEARS (UP TO {renewalForm.newLoanTermYears} YRS)
                        </label>
                        <input
                          type="number"
                          min={renewalForm.oldPaidYears}
                          max={renewalForm.newLoanTermYears}
                          value={renewalForm.newPaidYears}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              const clamped = Math.min(renewalForm.newLoanTermYears, Math.max(renewalForm.oldPaidYears, val));
                              setRenewalForm(p => ({ ...p, newPaidYears: clamped }));
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-bold text-slate-700">New Policy Premium Status:</span>
                      {renewalForm.newPaidYears < renewalForm.newLoanTermYears ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 border border-red-300 uppercase">
                          DUE ({renewalForm.newLoanTermYears - renewalForm.newPaidYears} Yr(s) Due)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                          PAID
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              </DayEndFieldset>

            </div>

            {/* Modal Footer Bar */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsRenewalModalOpen(false)}
                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                onClick={handleConfirmRenewal}
                className="px-6 py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Renew Policy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy Form Modal (Add / Edit) */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-start pt-16 sm:pt-20 pb-12 px-3 sm:px-6 overflow-y-auto">
          <div className="max-w-4xl w-full my-8">
            {renderPolicyFormCard(true)}
          </div>
        </div>
      )}

      {/* Claim Form Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-start pt-16 sm:pt-20 pb-12 px-3 sm:px-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 my-2">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-red-100 text-[#C8102E] rounded-xl">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingClaim ? 'Review Claim Record' : 'Register New Microinsurance Claim'}
                  </h3>
                  <p className="text-xs text-slate-500">Document loan settlement upon borrower demise or severe accident</p>
                </div>
              </div>
              <button
                onClick={() => setIsClaimModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClaim} className="mt-4 space-y-3.5">
              <DayEndFieldset branchId={branch?.id} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Insured Member Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={claimForm.memberName || ''}
                    onChange={e => setClaimForm({ ...claimForm, memberName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Policy Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={claimForm.policyNo || ''}
                    onChange={e => setClaimForm({ ...claimForm, policyNo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cause of Claim *
                  </label>
                  <select
                    value={claimForm.claimCause || 'Borrower Demise'}
                    onChange={e => setClaimForm({ ...claimForm, claimCause: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                  >
                    <option value="Borrower Demise">Borrower Demise</option>
                    <option value="Permanent Disability">Permanent Disability</option>
                    <option value="Property Damage">Property Damage</option>
                    <option value="Livestock Loss">Livestock Loss</option>
                    <option value="Critical Illness">Critical Illness</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Claim Incident Date
                  </label>
                  <input
                    type="date"
                    value={claimForm.incidentDate || ''}
                    onChange={e => setClaimForm({ ...claimForm, incidentDate: e.target.value, incidentDateBs: convertAdToBs(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Requested Amount (NPR) *
                  </label>
                  <input
                    type="number"
                    required
                    value={claimForm.claimAmountRequested || ''}
                    onChange={e => setClaimForm({ ...claimForm, claimAmountRequested: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Approved Amount (NPR)
                  </label>
                  <input
                    type="number"
                    value={claimForm.claimAmountApproved || ''}
                    onChange={e => setClaimForm({ ...claimForm, claimAmountApproved: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50 rounded-xl text-xs font-mono font-bold text-emerald-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Current Lifecycle Stage
                  </label>
                  <select
                    value={claimForm.lifecycleStage || 'Claim Submission'}
                    onChange={e => setClaimForm({ ...claimForm, lifecycleStage: e.target.value as ClaimLifecycleStage })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                  >
                    <option value="Claim Submission">1. Claim Submission</option>
                    <option value="Document Verification">2. Document Verification</option>
                    <option value="Evaluation">3. Evaluation</option>
                    <option value="Admin Approval">4. Admin Approval</option>
                    <option value="Payout Disbursement">5. Payout Disbursement</option>
                    <option value="Settlement Receipt">6. Settlement Receipt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Overall Claim Status
                  </label>
                  <select
                    value={claimForm.status || 'Submitted'}
                    onChange={e => setClaimForm({ ...claimForm, status: e.target.value as ClaimStatusType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                  >
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Settled">Settled</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Investigation & Verification Notes
                </label>
                <textarea
                  rows={2}
                  value={claimForm.remarks || ''}
                  onChange={e => setClaimForm({ ...claimForm, remarks: e.target.value })}
                  placeholder="e.g. Ward death recommendation certificate verified by local representative..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>
              </DayEndFieldset>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-5 py-2 bg-[#C8102E] hover:bg-[#a50b23] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Page Insurance Policy View & Shortcut Member KYC */}
      {isHistoryViewModalOpen && viewingPolicy && (() => {
        const resolvedPhoto = viewingPolicy.memberPhoto || matchedKycMfMember?.photoUrl || '';
        const resolvedName = viewingPolicy.memberName || viewingPolicy.name || 'Member';
        const resolvedMemberId = viewingPolicy.memberId || matchedKycMfMember?.memberId || 'N/A';
        const resolvedCitizenship = viewingPolicy.citizenshipNo || matchedKycMfMember?.citizenshipNo || 'N/A';
        const resolvedContact = viewingPolicy.contactNumber || matchedKycMfMember?.phone || '—';
        const resolvedAddress = viewingPolicy.address || matchedKycMfMember?.address || '—';
        const resolvedGender = viewingPolicy.gender || matchedKycMfMember?.gender || '—';
        const resolvedBranch = formatBranchLabel(viewingPolicy.branchId);
        const resolvedDobBs = viewingPolicy.dateOfBirthBs || convertAdToBs(viewingPolicy.dateOfBirth || '') || '—';
        const resolvedStartBs = viewingPolicy.policyStartDateBs || convertAdToBs(viewingPolicy.policyStartDate) || viewingPolicy.policyStartDate || '—';
        const resolvedExpiryBs = viewingPolicy.policyExpiryDateBs || convertAdToBs(viewingPolicy.policyExpiryDate) || viewingPolicy.policyExpiryDate || '—';
        const resolvedSumAssured = viewingPolicy.sumAssured || viewingPolicy.loanAmount || 0;
        const resolvedLoanAmount = viewingPolicy.loanAmount || resolvedSumAssured;
        const resolvedPremium = viewingPolicy.premiumAmount || viewingPolicy.premium || 0;
        const isPremiumPaid = viewingPolicy.premiumPaymentStatus === 'Paid';
        const resolvedStatus = (() => {
          const stLower = (viewingPolicy.status || '').toLowerCase();
          const hiddenClosed = Boolean(viewingPolicy.hiddenReportTabs?.includes('closed'));
          if (!hiddenClosed && stLower === 'rejected') return 'Rejected';
          if (!hiddenClosed && (viewingPolicy.recordKind === 'closed' || stLower === 'closed' || stLower === 'deactivated')) {
            return 'Closed';
          }
          if (stLower === 'expired' || (viewingPolicy.policyExpiryDate && new Date(viewingPolicy.policyExpiryDate) < new Date())) {
            return 'Expired';
          }
          if (viewingPolicy.recordKind === 'renewal' || (stLower === 'renewed' && reportFilter === 'renewal')) {
            return 'Renewed';
          }
          return 'Active';
        })();
        const canUploadKycPhoto = (canEditInsReport || canEditInsUpload) && !isDayEnded;

        const daysRemaining = (() => {
          if (!viewingPolicy.policyExpiryDate) return null;
          const exp = new Date(viewingPolicy.policyExpiryDate);
          if (Number.isNaN(exp.getTime())) return null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          exp.setHours(0, 0, 0, 0);
          return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        })();

        const normKey = (val?: string) => (val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetCitKey = normKey(viewingPolicy.citizenshipNo);
        const targetNameKey = resolvedName.trim().toLowerCase();
        const targetMemberKey = normKey(viewingPolicy.memberId);

        const memberCombinedPolicies = records.filter(r => {
          // Exclude renewals already deleted/hidden from the Renewal table
          const isDeletedRenewal =
            (r.recordKind === 'renewal' || r.status === 'renewed' || r.status === 'Renewed') &&
            Boolean(r.hiddenReportTabs?.includes('renewal'));
          if (isDeletedRenewal) return false;

          // Exclude duplicate closed-only child records unless explicitly viewing that closed record
          if (r.recordKind === 'closed' && r.id !== viewingPolicy.id) return false;

          if (r.id === viewingPolicy.id) return true;
          if (r.parentPolicyId && r.parentPolicyId === viewingPolicy.id) return true;
          if (
            viewingPolicy.parentPolicyId &&
            (r.id === viewingPolicy.parentPolicyId || r.parentPolicyId === viewingPolicy.parentPolicyId)
          ) {
            return true;
          }
          const rCitKey = normKey(r.citizenshipNo);
          if (targetCitKey && targetCitKey !== 'na' && rCitKey && rCitKey === targetCitKey) {
            return true;
          }
          const rNameKey = (r.memberName || r.name || '').trim().toLowerCase();
          if (targetNameKey && rNameKey === targetNameKey) {
            const rMemberKey = normKey(r.memberId);
            return !targetMemberKey || !rMemberKey || rMemberKey === targetMemberKey;
          }
          return false;
        });

        const rawPolicyRows = memberCombinedPolicies.flatMap(pol => {
          const historyItems = Array.isArray(pol.policyHistory)
            ? [...pol.policyHistory].sort((a, b) => (a.recordedAt || 0) - (b.recordedAt || 0))
            : [];

          const historyRows = historyItems.map(entry => ({
            key: entry.id,
            stage: entry.stage as 'First Policy' | 'Renewal' | 'Closed',
            policyNo: entry.policyNo || pol.policyNo,
            branchId: entry.branchId || pol.branchId,
            startBs:
              entry.policyStartDateBs ||
              convertAdToBs(entry.policyStartDate) ||
              entry.policyStartDate ||
              '—',
            expiryBs:
              entry.policyExpiryDateBs ||
              convertAdToBs(entry.policyExpiryDate) ||
              entry.policyExpiryDate ||
              '—',
            sortDate: entry.policyStartDate || '',
            sortCreatedAt: entry.recordedAt || 0,
            sumAssured: entry.sumAssured || entry.loanAmount || 0,
            premiumAmount: entry.premiumAmount || 0,
            isPaid: entry.premiumPaymentStatus === 'Paid',
            status: entry.status || (entry.stage === 'First Policy' ? 'First Policy' : 'Renewed'),
            isHistory: true,
            isCurrent: false,
            sourcePolicy: pol
          }));

          const isRenewedCurrent =
            pol.recordKind === 'renewal' ||
            historyItems.length > 0 ||
            pol.status === 'renewed' ||
            pol.status === 'Renewed';
          const isClosedCurrent = pol.recordKind === 'closed';

          const currentRow = {
            key: pol.id,
            stage: (
              isClosedCurrent ? 'Closed' : isRenewedCurrent ? 'Renewal' : 'First Policy'
            ) as 'First Policy' | 'Renewal' | 'Closed',
            policyNo: pol.policyNo,
            branchId: pol.branchId,
            startBs:
              pol.policyStartDateBs || convertAdToBs(pol.policyStartDate) || pol.policyStartDate || '—',
            expiryBs:
              pol.policyExpiryDateBs || convertAdToBs(pol.policyExpiryDate) || pol.policyExpiryDate || '—',
            sortDate: pol.policyStartDate || '',
            sortCreatedAt: pol.createdAt || 0,
            sumAssured: pol.sumAssured || pol.loanAmount || 0,
            premiumAmount: pol.premiumAmount || pol.premium || 0,
            isPaid: pol.premiumPaymentStatus === 'Paid',
            status:
              pol.status === 'renewed'
                ? 'Renewed'
                : pol.status === 'start_policy'
                  ? 'First Policy'
                  : (pol.status || 'Active'),
            isHistory: false,
            isCurrent: pol.id === viewingPolicy.id,
            sourcePolicy: pol
          };

          return [...historyRows, currentRow];
        });

        // Always list First Policy at S.N. 1, followed chronologically by Renewal(s)
        const stageOrder = (stage: 'First Policy' | 'Renewal' | 'Closed') =>
          stage === 'First Policy' ? 0 : stage === 'Renewal' ? 1 : 2;

        const memberPolicyRows = [...rawPolicyRows].sort((a, b) => {
          const rankDiff = stageOrder(a.stage) - stageOrder(b.stage);
          if (rankDiff !== 0) return rankDiff;
          if (a.sortDate && b.sortDate && a.sortDate !== b.sortDate) {
            return a.sortDate.localeCompare(b.sortDate);
          }
          return a.sortCreatedAt - b.sortCreatedAt;
        });

        const combinedTotalSumAssured = memberPolicyRows.reduce(
          (sum, row) => sum + row.sumAssured,
          0
        );
        const combinedTotalPremium = memberPolicyRows.reduce(
          (sum, row) => sum + row.premiumAmount,
          0
        );
        const combinedActiveCount = memberCombinedPolicies.filter(r => {
          const st = (r.status || 'Active').toLowerCase();
          return st === 'active' || st === 'renewed' || st === 'start_policy';
        }).length;

        const policyRelatedClaims = claims.filter(c => {
          if (c.policyId === viewingPolicy.id) return true;
          if (c.policyNo && viewingPolicy.policyNo && c.policyNo.trim() === viewingPolicy.policyNo.trim()) {
            const cName = (c.memberName || '').trim().toLowerCase();
            return !cName || !targetNameKey || cName === targetNameKey;
          }
          return false;
        });

        const policyStatusTone =
          resolvedStatus === 'Active' || resolvedStatus === 'Renewed'
            ? 'text-emerald-700'
            : resolvedStatus === 'Expired' || resolvedStatus === 'Claimed'
              ? 'text-rose-700'
              : 'text-amber-700';

        const policyStatusSurface =
          resolvedStatus === 'Active' || resolvedStatus === 'Renewed'
            ? 'bg-emerald-50/60'
            : resolvedStatus === 'Expired' || resolvedStatus === 'Claimed'
              ? 'bg-rose-50/60'
              : 'bg-amber-50/60';

        return (
          <div className="fixed inset-0 z-[9999] bg-[#f1f5f9] flex flex-col overflow-hidden text-slate-900">
            {/* Hidden photo file input for Shortcut KYC photo upload */}
            <input
              ref={kycPhotoInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadKycMemberPhoto}
              className="hidden"
            />

            {/* Cooperative Brand Sticky Top Utility Bar */}
            <header className="bg-[#014a40] text-white border-b border-white/15 px-4 sm:px-6 h-14 flex justify-between items-center gap-4 shrink-0 print:hidden">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 text-emerald-200 flex items-center justify-center shrink-0">
                  {isKycViewOpen ? <UserCheck className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200/90 truncate">
                    <span>Insurance Report</span>
                    <span className="text-emerald-300/60">/</span>
                    <span className="text-white">{isKycViewOpen ? 'Member KYC' : 'Policy Dossier'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-bold tracking-tight text-white truncate">
                      {resolvedName}
                    </h3>
                    <span className="text-emerald-300/60 hidden sm:inline">·</span>
                    <span className="text-xs font-mono tabular-nums text-emerald-100 hidden sm:inline shrink-0">
                      {viewingPolicy.policyNo}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* KYC Button strictly to the LEFT of Print Icon */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isKycViewOpen && viewingPolicy) {
                      populateKycFormFromPolicy(viewingPolicy);
                    }
                    setIsKycViewOpen(prev => !prev);
                  }}
                  title={isKycViewOpen ? 'Back to Policy View' : 'Open Member Shortcut KYC'}
                  className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isKycViewOpen
                      ? 'bg-white border-white text-[#014a40] hover:bg-emerald-50'
                      : 'bg-white/12 border-white/25 text-white hover:bg-white/20'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>KYC</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportToExcel([viewingPolicy])}
                  className="px-3.5 py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
                <div className="h-5 w-px bg-white/20 mx-0.5" />
                <button
                  type="button"
                  onClick={handleClosePolicyView}
                  title="Close"
                  aria-label="Close"
                  className="w-8 h-8 rounded-lg border border-white/25 bg-white/10 hover:bg-rose-500 hover:border-rose-400 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Full-Page Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {isKycViewOpen ? (
                /* Fillable Shortcut Member KYC Form */
                <div className="max-w-3xl mx-auto p-5 sm:p-8">
                  <form
                    onSubmit={handleSaveKycForm}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                  >
                    {/* Compact Cooperative Header Strip */}
                    <div className="bg-[#015e52] text-white px-6 py-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200 truncate">
                          {settings?.systemName || 'RATAULI SAVING AND CREDIT COOPERATIVE LTD'}
                        </div>
                        <div className="text-base font-bold tracking-tight text-white">
                          Member Shortcut KYC
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsKycViewOpen(false)}
                        className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors print:hidden"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Policy View</span>
                      </button>
                    </div>

                    {kycSavedNotice && (
                      <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 print:hidden">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          {kycSavedNotice}
                        </span>
                        <button
                          type="button"
                          onClick={() => setKycSavedNotice(null)}
                          className="p-0.5 text-emerald-600 hover:text-emerald-900 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Photo & Core Identity Row */}
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="w-24 h-28 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                          {kycForm.memberPhoto ? (
                            <img
                              src={kycForm.memberPhoto}
                              alt={kycForm.memberName || resolvedName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#015e52] text-white flex flex-col items-center justify-center">
                              <span className="text-2xl font-bold tracking-tight">
                                {getInitials(kycForm.memberName || resolvedName)}
                              </span>
                            </div>
                          )}
                        </div>
                        {canUploadKycPhoto && (
                          <div className="flex items-center gap-1.5 print:hidden">
                            <button
                              type="button"
                              onClick={() => kycPhotoInputRef.current?.click()}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Camera className="w-3 h-3" />
                              <span>{kycForm.memberPhoto ? 'Change' : 'Add Photo'}</span>
                            </button>
                            {kycForm.memberPhoto && (
                              <button
                                type="button"
                                onClick={() => setKycForm(prev => ({ ...prev, memberPhoto: '' }))}
                                className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                title="Remove Photo"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 w-full space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Member Name *
                            </label>
                            <input
                              type="text"
                              required
                              disabled={!canUploadKycPhoto}
                              value={kycForm.memberName}
                              onChange={e => setKycForm(prev => ({ ...prev, memberName: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Member ID
                            </label>
                            <input
                              type="text"
                              disabled={!canUploadKycPhoto}
                              value={kycForm.memberId}
                              onChange={e => setKycForm(prev => ({ ...prev, memberId: e.target.value }))}
                              placeholder="e.g. RSCC-MEM-1042"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-semibold text-[#015e52] focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-0.5 text-slate-600">
                          <span className="font-mono font-semibold text-[#015e52]">
                            Policy: {viewingPolicy.policyNo}
                          </span>
                          <span>Branch: {resolvedBranch}</span>
                          <span className="font-mono tabular-nums font-semibold text-slate-800">
                            Sum Assured: NPR {resolvedSumAssured.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Compact 2-Column Fillable Shortcut KYC Inputs */}
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Citizenship No</label>
                        <input
                          type="text"
                          disabled={!canUploadKycPhoto}
                          value={kycForm.citizenshipNo}
                          onChange={e => setKycForm(prev => ({ ...prev, citizenshipNo: e.target.value }))}
                          placeholder="नागरिकता नं."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Contact / Mobile No</label>
                        <input
                          type="text"
                          disabled={!canUploadKycPhoto}
                          value={kycForm.contactNumber}
                          onChange={e => setKycForm(prev => ({ ...prev, contactNumber: e.target.value }))}
                          placeholder="98XXXXXXXX"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gender</label>
                          <select
                            disabled={!canUploadKycPhoto}
                            value={kycForm.gender}
                            onChange={e =>
                              setKycForm(prev => ({
                                ...prev,
                                gender: e.target.value as 'Male' | 'Female' | 'Other'
                              }))
                            }
                            className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                          >
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Age (Yrs)</label>
                          <input
                            type="number"
                            min="18"
                            max="90"
                            disabled={!canUploadKycPhoto}
                            value={kycForm.age}
                            onChange={e => setKycForm(prev => ({ ...prev, age: e.target.value }))}
                            placeholder="Age"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">DOB (BS)</label>
                          <input
                            type="text"
                            disabled={!canUploadKycPhoto}
                            value={kycForm.dateOfBirthBs}
                            onChange={e => {
                              const bs = e.target.value;
                              const ad = convertBsToAd(bs);
                              setKycForm(prev => ({
                                ...prev,
                                dateOfBirthBs: bs,
                                dateOfBirth: ad || prev.dateOfBirth
                              }));
                            }}
                            placeholder="YYYY-MM-DD"
                            className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">DOB (AD)</label>
                          <input
                            type="date"
                            disabled={!canUploadKycPhoto}
                            value={kycForm.dateOfBirth}
                            onChange={e => {
                              const ad = e.target.value;
                              setKycForm(prev => ({
                                ...prev,
                                dateOfBirth: ad,
                                dateOfBirthBs: convertAdToBs(ad) || prev.dateOfBirthBs
                              }));
                            }}
                            className="w-full px-2 py-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Address</label>
                        <input
                          type="text"
                          disabled={!canUploadKycPhoto}
                          value={kycForm.address}
                          onChange={e => setKycForm(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="ठेगाना"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Occupation</label>
                        <input
                          type="text"
                          disabled={!canUploadKycPhoto}
                          value={kycForm.occupation}
                          onChange={e => setKycForm(prev => ({ ...prev, occupation: e.target.value }))}
                          placeholder="पेशा (e.g. Agriculture)"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nominee Name</label>
                        <input
                          type="text"
                          disabled={!canUploadKycPhoto}
                          value={kycForm.nomineeName}
                          onChange={e => setKycForm(prev => ({ ...prev, nomineeName: e.target.value }))}
                          placeholder="इच्छाएको व्यक्तिको नाम"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nominee Relation</label>
                        <input
                          type="text"
                          disabled={!canUploadKycPhoto}
                          value={kycForm.nomineeRelation}
                          onChange={e => setKycForm(prev => ({ ...prev, nomineeRelation: e.target.value }))}
                          placeholder="नाता (e.g. Husband / Wife / Son)"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nominee Contact No</label>
                        <input
                          type="text"
                          disabled={!canUploadKycPhoto}
                          value={kycForm.nomineeContact}
                          onChange={e => setKycForm(prev => ({ ...prev, nomineeContact: e.target.value }))}
                          placeholder="98XXXXXXXX"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nominee Citizenship No</label>
                        <input
                          type="text"
                          disabled={!canUploadKycPhoto}
                          value={kycForm.nomineeCitizenship}
                          onChange={e => setKycForm(prev => ({ ...prev, nomineeCitizenship: e.target.value }))}
                          placeholder="इच्छाएको व्यक्तिको नागरिकता नं."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52] disabled:bg-slate-50 print:border-0 print:px-0"
                        />
                      </div>
                    </div>

                    {/* Compact Footer Action Bar */}
                    <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        Policy Period (BS): {resolvedStartBs} → {resolvedExpiryBs}
                      </span>
                      {canUploadKycPhoto && (
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#015e52] hover:bg-[#014940] text-white text-xs font-semibold cursor-pointer transition-colors print:hidden"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save KYC</span>
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              ) : (
                /* Fit-to-Page Full-Width Policy Dossier with Cooperative Color Combination */
                <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4">
                  {/* Unified Member Identity Banner & Color-Balanced Financial KPI Strip */}
                  <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="bg-gradient-to-r from-[#015247] via-[#015e52] to-[#036d60] text-white px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-white/15 text-white border border-white/30 flex items-center justify-center font-bold text-base tracking-tight shrink-0 overflow-hidden">
                          {resolvedPhoto ? (
                            <img src={resolvedPhoto} alt={resolvedName} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(resolvedName)
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                            <h2 className="text-lg font-bold tracking-tight text-white">
                              {resolvedName}
                            </h2>
                            <span className="text-xs font-mono tabular-nums font-medium text-emerald-200">
                              {viewingPolicy.policyNo}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-emerald-100">
                            <span>
                              Member ID:{' '}
                              <span className="font-mono tabular-nums font-semibold text-white">
                                {resolvedMemberId}
                              </span>
                            </span>
                            <span className="text-emerald-300/60">·</span>
                            <span>
                              Citizenship:{' '}
                              <span className="font-mono tabular-nums font-semibold text-white">
                                {resolvedCitizenship}
                              </span>
                            </span>
                            <span className="text-emerald-300/60">·</span>
                            <span className="font-semibold text-amber-200">{resolvedBranch}</span>
                            <span className="text-emerald-300/60 hidden sm:inline">·</span>
                            <span>
                              {resolvedGender}, {viewingPolicy.age || '—'} yrs
                            </span>
                            <span className="text-emerald-300/60">·</span>
                            <span>{resolvedAddress}</span>
                            <span className="text-emerald-300/60">·</span>
                            <span>{viewingPolicy.occupation || 'Agriculture'}</span>
                            {resolvedContact !== '—' && (
                              <>
                                <span className="text-emerald-300/60">·</span>
                                <span className="font-mono tabular-nums text-white">{resolvedContact}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Focused Primary Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                        <button
                          type="button"
                          onClick={() => {
                            handleClosePolicyView();
                            handleViewCertificate(viewingPolicy);
                          }}
                          className="px-3.5 py-1.5 rounded-lg border border-white/25 bg-white/12 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Certificate PDF</span>
                        </button>
                        <button
                          type="button"
                          disabled={isDayEnded}
                          title={isDayEnded ? getDayEndedBlockMessage() : 'Edit or Add Loan Policy'}
                          onClick={() => {
                            handleClosePolicyView();
                            handleOpenEditPolicy(viewingPolicy);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-[#015247] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Edit / Add Loan</span>
                        </button>
                      </div>
                    </div>

                    {/* Color-Harmonized 4-Column Financial KPI Strip */}
                    <div className="border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-200">
                      <div className="px-5 py-2.5 bg-teal-50/40">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800/80">
                          Sum Assured
                        </div>
                        <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-[#015e52]">
                          NPR {resolvedSumAssured.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                          Loan: NPR {resolvedLoanAmount.toLocaleString()}
                        </div>
                      </div>

                      <div className="px-5 py-2.5 bg-indigo-50/35">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800/80">
                          Insurance Premium
                        </div>
                        <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-indigo-950">
                          NPR {resolvedPremium.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-semibold">
                          <span className="text-slate-600 font-medium">Payment: </span>
                          <span className={isPremiumPaid ? 'text-emerald-700' : 'text-amber-700'}>
                            {isPremiumPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      </div>

                      <div className="px-5 py-2.5 bg-sky-50/40">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800/80">
                          Policy Period (BS)
                        </div>
                        <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-slate-900">
                          {resolvedStartBs} → {resolvedExpiryBs}
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                          Term: {viewingPolicy.termMonths || 12} months
                        </div>
                      </div>

                      <div className={`px-5 py-2.5 ${policyStatusSurface}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Policy Status
                        </div>
                        <div className={`mt-0.5 text-base font-bold ${policyStatusTone}`}>
                          {resolvedStatus}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">
                          {daysRemaining !== null
                            ? daysRemaining >= 0
                              ? `${daysRemaining} days remaining`
                              : `Expired ${Math.abs(daysRemaining)} days ago`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Clean Segmented Workspace Tabs (No underline, No count badges) */}
                  <nav className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200/90 shadow-2xs overflow-x-auto max-w-full print:hidden">
                    <button
                      type="button"
                      onClick={() => setPolicyViewTab('detail')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        policyViewTab === 'detail'
                          ? 'bg-[#015e52] text-white'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Policy Details</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPolicyViewTab('history')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        policyViewTab === 'history'
                          ? 'bg-[#015e52] text-white'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>History &amp; Audit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPolicyViewTab('combined')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        policyViewTab === 'combined'
                          ? 'bg-[#015e52] text-white'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Policy</span>
                    </button>
                  </nav>

                  {/* Tab 1: Fit-Page 4-Column Policy Dossier */}
                  {policyViewTab === 'detail' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                      {/* Card 1: Personal Information */}
                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
                        <div className="px-4 py-2.5 border-b border-teal-100 flex items-center gap-2 bg-teal-50/70">
                          <User className="w-3.5 h-3.5 text-[#015e52]" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-950">
                            Personal Information
                          </h4>
                        </div>
                        <dl className="divide-y divide-slate-100 px-4 text-xs flex-1">
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Gender</dt>
                            <dd className="font-semibold text-slate-900 text-right">{resolvedGender}</dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Age</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {viewingPolicy.age ? `${viewingPolicy.age} years` : '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">DOB (BS)</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {resolvedDobBs}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">DOB (AD)</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {viewingPolicy.dateOfBirth || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Contact No</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {resolvedContact}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Address</dt>
                            <dd className="font-semibold text-slate-900 text-right truncate max-w-[170px]" title={resolvedAddress}>
                              {resolvedAddress}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Occupation</dt>
                            <dd className="font-semibold text-slate-900 text-right">
                              {viewingPolicy.occupation || 'Agriculture'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* Card 2: Policy Schedule */}
                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
                        <div className="px-4 py-2.5 border-b border-indigo-100 flex items-center gap-2 bg-indigo-50/70">
                          <FileText className="w-3.5 h-3.5 text-indigo-700" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-950">
                            Policy Schedule
                          </h4>
                        </div>
                        <dl className="divide-y divide-slate-100 px-4 text-xs flex-1">
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Policy No</dt>
                            <dd className="font-semibold text-indigo-950 font-mono tabular-nums text-right">
                              {viewingPolicy.policyNo}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Member ID</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {resolvedMemberId}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Citizenship No</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {resolvedCitizenship}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">DOC (BS)</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {resolvedStartBs}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">DOC (AD)</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {viewingPolicy.policyStartDate || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Policy Term</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {viewingPolicy.termMonths || 12} months
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Maturity (BS)</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {resolvedExpiryBs}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* Card 3: Nominee & Health Declaration */}
                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
                        <div className="px-4 py-2.5 border-b border-sky-100 flex items-center gap-2 bg-sky-50/75">
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-sky-950">
                            Nominee &amp; Health
                          </h4>
                        </div>
                        <dl className="divide-y divide-slate-100 px-4 text-xs flex-1">
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Nominee Name</dt>
                            <dd className="font-semibold text-slate-900 text-right truncate max-w-[170px]" title={viewingPolicy.nomineeName}>
                              {viewingPolicy.nomineeName || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Relationship</dt>
                            <dd className="font-semibold text-slate-900 text-right">
                              {viewingPolicy.nomineeRelation || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Nominee Contact</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {viewingPolicy.nomineeContact || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Nominee Citizenship</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {viewingPolicy.nomineeCitizenship || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Nominee DOB (BS)</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {viewingPolicy.nomineeDobBs || convertAdToBs(viewingPolicy.nomineeDob || '') || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Disability</dt>
                            <dd className="font-semibold text-slate-900 text-right">
                              {viewingPolicy.disability || 'None'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Active Life</dt>
                            <dd className="font-semibold text-emerald-700 text-right">
                              {viewingPolicy.livingActiveLife || 'Yes'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* Card 4: Loan & Coverage Summary */}
                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
                        <div className="px-4 py-2.5 border-b border-amber-100 flex items-center gap-2 bg-amber-50/75">
                          <Award className="w-3.5 h-3.5 text-amber-700" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-950">
                            Loan &amp; Coverage
                          </h4>
                        </div>
                        <dl className="divide-y divide-slate-100 px-4 text-xs flex-1">
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Sum Assured</dt>
                            <dd className="font-bold text-[#015e52] font-mono tabular-nums text-right">
                              NPR {resolvedSumAssured.toLocaleString()}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Premium Amount</dt>
                            <dd className="font-bold text-indigo-900 font-mono tabular-nums text-right">
                              NPR {resolvedPremium.toLocaleString()}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Premium Payment</dt>
                            <dd className={`font-semibold text-right ${isPremiumPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {isPremiumPaid ? 'Paid' : 'Unpaid'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Policy Status</dt>
                            <dd className={`font-semibold text-right ${policyStatusTone}`}>
                              {resolvedStatus}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Maturity (AD)</dt>
                            <dd className="font-semibold text-slate-900 font-mono tabular-nums text-right">
                              {viewingPolicy.policyExpiryDate || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex justify-between items-center gap-3">
                            <dt className="text-slate-500 font-medium">Branch</dt>
                            <dd className="font-semibold text-slate-900 text-right">{resolvedBranch}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: History & Audit Timeline */}
                  {policyViewTab === 'history' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Policy Lifecycle Log */}
                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-teal-100 bg-teal-50/70 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-[#015e52]" />
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-950">
                              Policy Audit Trail
                            </h4>
                          </div>
                          <span className="text-[11px] font-mono tabular-nums font-semibold text-[#015e52]">
                            {viewingPolicy.policyNo}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 px-5 text-xs">
                          <div className="py-3.5 flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-slate-900">Policy Commenced (DOC)</div>
                              <p className="text-slate-500 mt-0.5">
                                Issued at {resolvedBranch} for NPR{' '}
                                <span className="font-mono tabular-nums font-semibold text-[#015e52]">
                                  {resolvedSumAssured.toLocaleString()}
                                </span>
                                .
                              </p>
                            </div>
                            <div className="text-right font-mono tabular-nums shrink-0">
                              <div className="font-semibold text-slate-800">{resolvedStartBs}</div>
                              <div className="text-[11px] text-slate-400">{viewingPolicy.policyStartDate || '—'}</div>
                            </div>
                          </div>

                          <div className="py-3.5 flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-slate-900">Premium Assessment</div>
                              <p className="text-slate-500 mt-0.5">
                                Premium of NPR{' '}
                                <span className="font-mono tabular-nums font-semibold text-indigo-900">
                                  {resolvedPremium.toLocaleString()}
                                </span>
                                {viewingPolicy.premiumPaymentRemark ? ` · ${viewingPolicy.premiumPaymentRemark}` : ''}
                              </p>
                            </div>
                            <span
                              className={`font-semibold shrink-0 ${
                                isPremiumPaid ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {isPremiumPaid ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>

                          <div className="py-3.5 flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-slate-900">Scheduled Maturity</div>
                              <p className="text-slate-500 mt-0.5">
                                {viewingPolicy.termMonths || 12}-month coverage period
                                {daysRemaining !== null
                                  ? daysRemaining >= 0
                                    ? ` · ${daysRemaining} days left`
                                    : ` · matured ${Math.abs(daysRemaining)} days ago`
                                  : ''}
                              </p>
                            </div>
                            <div className="text-right font-mono tabular-nums shrink-0">
                              <div className="font-semibold text-slate-800">{resolvedExpiryBs}</div>
                              <div className="text-[11px] text-slate-400">{viewingPolicy.policyExpiryDate || '—'}</div>
                            </div>
                          </div>

                          {viewingPolicy.updatedAt ? (
                            <div className="py-3.5 flex items-start justify-between gap-4">
                              <div>
                                <div className="font-semibold text-slate-900">Last Record Update</div>
                                <p className="text-slate-500 mt-0.5">
                                  Latest policy or KYC verification saved in core ledger.
                                </p>
                              </div>
                              <div className="text-right font-mono tabular-nums text-slate-600 shrink-0">
                                {new Date(viewingPolicy.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Linked Claims History */}
                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Heart className="w-3.5 h-3.5 text-rose-600" />
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-950">
                              Linked Insurance Claims
                            </h4>
                          </div>
                          <span className="text-[11px] font-mono tabular-nums font-semibold text-rose-700">
                            {policyRelatedClaims.length} {policyRelatedClaims.length === 1 ? 'record' : 'records'}
                          </span>
                        </div>
                        {policyRelatedClaims.length === 0 ? (
                          <div className="px-6 py-10 text-center">
                            <div className="text-sm font-semibold text-slate-700">No Claims Recorded</div>
                            <p className="text-xs text-slate-500 mt-1">
                              No insurance claim has been registered against policy{' '}
                              <span className="font-mono text-slate-700">{viewingPolicy.policyNo}</span>.
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 px-5 text-xs">
                            {policyRelatedClaims.map(claim => {
                              const claimTone =
                                claim.status === 'Settled' || claim.status === 'Approved'
                                  ? 'text-emerald-700'
                                  : claim.status === 'Rejected'
                                    ? 'text-rose-700'
                                    : 'text-amber-700';
                              return (
                                <div key={claim.id} className="py-3.5 flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono tabular-nums font-bold text-slate-900">
                                        {claim.claimNo}
                                      </span>
                                      <span className="text-slate-300">·</span>
                                      <span className="font-semibold text-slate-700">{claim.claimCause}</span>
                                    </div>
                                    <div className="text-slate-500 mt-0.5 font-mono tabular-nums">
                                      Requested: NPR {(claim.claimAmountRequested || 0).toLocaleString()}
                                      {claim.approvedAmount
                                        ? ` · Approved: NPR ${claim.approvedAmount.toLocaleString()}`
                                        : ''}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className={`font-semibold ${claimTone}`}>{claim.status}</div>
                                    <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                                      {claim.claimDateBs || claim.claimDate}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Member Policy Portfolio */}
                  {policyViewTab === 'combined' && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-200 overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50/60">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Total Policies
                          </div>
                          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900">
                            {memberPolicyRows.length}
                          </div>
                        </div>
                        <div className="px-5 py-3 bg-emerald-50/45">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/80">
                            Active Policies
                          </div>
                          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-emerald-700">
                            {combinedActiveCount}
                          </div>
                        </div>
                        <div className="px-5 py-3 bg-teal-50/45">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800/80">
                            Total Sum Assured
                          </div>
                          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-[#015e52]">
                            NPR {combinedTotalSumAssured.toLocaleString()}
                          </div>
                        </div>
                        <div className="px-5 py-3 bg-indigo-50/40">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800/80">
                            Total Premium
                          </div>
                          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-indigo-950">
                            NPR {combinedTotalPremium.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-teal-100 bg-teal-50/75 text-[11px] font-bold uppercase tracking-wider text-teal-950">
                                <th className="px-4 py-3 text-center w-12">S.N.</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Policy No</th>
                                <th className="px-4 py-3">Branch</th>
                                <th className="px-4 py-3">Period (BS)</th>
                                <th className="px-4 py-3 text-right">Sum Assured</th>
                                <th className="px-4 py-3 text-right">Premium</th>
                                <th className="px-4 py-3">Payment</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-5 py-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {memberPolicyRows.map((row, index) => (
                                <tr
                                  key={row.key}
                                  className={row.isCurrent ? 'bg-[#015e52]/[0.05]' : 'hover:bg-slate-50/80'}
                                >
                                  <td className="px-4 py-3 text-center font-mono tabular-nums font-bold text-slate-600 whitespace-nowrap">
                                    {index + 1}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span
                                      className={`font-semibold ${
                                        row.stage === 'Renewal' ? 'text-indigo-700' : 'text-[#015e52]'
                                      }`}
                                    >
                                      {row.stage}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono tabular-nums font-semibold text-indigo-950 whitespace-nowrap">
                                    {row.policyNo}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                    {formatBranchLabel(row.branchId)}
                                  </td>
                                  <td className="px-4 py-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                    {row.startBs} → {row.expiryBs}
                                  </td>
                                  <td className="px-4 py-3 font-mono tabular-nums font-semibold text-[#015e52] text-right whitespace-nowrap">
                                    NPR {row.sumAssured.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 font-mono tabular-nums font-medium text-indigo-900 text-right whitespace-nowrap">
                                    NPR {row.premiumAmount.toLocaleString()}
                                  </td>
                                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${row.isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {row.isPaid ? 'Paid' : 'Unpaid'}
                                  </td>
                                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${row.isHistory ? 'text-slate-600' : 'text-emerald-700'}`}>
                                    {row.status}
                                  </td>
                                  <td className="px-5 py-3 text-right whitespace-nowrap">
                                    {row.isHistory ? (
                                      <span className="text-[11px] font-semibold text-slate-500">Previous</span>
                                    ) : row.isCurrent ? (
                                      <span className="text-[11px] font-bold text-[#015e52]">Current</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleViewPolicyDetails(row.sourcePolicy)}
                                        className="text-xs font-semibold text-[#015e52] hover:underline cursor-pointer"
                                      >
                                        Open
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Official Printable Loan Insurance Certificate Modal */}
      {isCertificateModalOpen && viewingPolicy && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-start pt-16 sm:pt-20 pb-12 px-3 sm:px-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-2">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#025e40]" />
                <span className="text-sm font-black text-slate-900">Official Loan Insurance Certificate</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#025e40] hover:bg-[#014730] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Certificate</span>
                </button>
                <button
                  onClick={() => setIsCertificateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Certificate Document */}
            <div className="mt-4 p-8 border-4 border-double border-[#025e40] rounded-2xl bg-white relative overflow-hidden shadow-xs">
              {/* Header */}
              <div className="text-center pb-5 border-b-2 border-[#025e40]/20 relative">
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-800">
                  Cooperative Microinsurance Department
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#025e40] uppercase mt-1">
                  Ratauli Saving & Credit Cooperative Ltd.
                </h2>
                <div className="text-xs font-semibold text-slate-600 mt-0.5">
                  Ratauli, Pipra Rural Municipality-6, Mahottari, Madhesh Province, Nepal
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Registration No: 18-042/065 • Affiliated with NEFSCUN
                </div>
                <div className="inline-block mt-3 px-5 py-1.5 bg-gradient-to-r from-[#025e40] to-blue-900 text-white text-xs font-extrabold uppercase tracking-widest rounded-full shadow-xs">
                  Term Loan Insurance & Credit Life Certificate
                </div>
              </div>

              {/* Certificate Key Metas & QR Code */}
              <div className="flex justify-between items-center text-xs text-slate-700 py-4 border-b border-slate-200">
                <div className="space-y-1 font-mono">
                  <div>Certificate / Policy No: <strong className="text-slate-900 font-black">{viewingPolicy.policyNo}</strong></div>
                  <div>Member Account ID: <strong className="text-slate-900">{viewingPolicy.memberId}</strong></div>
                  <div>Issuing Branch: <strong className="text-slate-900">Head Office, Ratauli</strong></div>
                </div>

                {certificateQrCodeUrl && (
                  <div className="text-center">
                    <img src={certificateQrCodeUrl} alt="Policy QR" className="w-16 h-16 mx-auto border border-slate-200 rounded p-0.5" />
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">VERIFIED QR</div>
                  </div>
                )}
              </div>

              {/* Insured Policy Content */}
              <div className="mt-4 space-y-3.5 text-xs text-slate-700">
                <p className="leading-relaxed">
                  This is to certify that member borrower <strong className="text-slate-950 font-bold">{viewingPolicy.memberName || viewingPolicy.name}</strong>, holder of Citizenship No. <strong className="text-slate-950 font-mono">{viewingPolicy.citizenshipNo}</strong>, resident of <strong className="text-slate-950">{viewingPolicy.address || 'Ratauli, Mahottari'}</strong>, has been formally insured under the Cooperative Credit Life Protection Scheme.
                </p>

                <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500">Loan Facility Type:</span>
                    <div className="font-bold text-slate-900">{viewingPolicy.loanType}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Sum Assured (Protection Amount):</span>
                    <div className="font-black text-[#025e40] font-mono text-sm">
                      NPR {(viewingPolicy.sumAssured || viewingPolicy.loanAmount).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Annual Premium Paid:</span>
                    <div className="font-bold text-emerald-800 font-mono">
                      NPR {(viewingPolicy.premiumAmount || viewingPolicy.premium || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Coverage Validity:</span>
                    <div className="font-bold text-slate-900">
                      {viewingPolicy.policyStartDate} to {viewingPolicy.policyExpiryDate}
                      <span className="block text-[10px] text-slate-500 font-normal">
                        ({viewingPolicy.policyStartDateBs || convertAdToBs(viewingPolicy.policyStartDate)} to {viewingPolicy.policyExpiryDateBs || convertAdToBs(viewingPolicy.policyExpiryDate)} BS)
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Designated Beneficiary (Nominee):</span>
                    <div className="font-bold text-slate-900">
                      {viewingPolicy.nomineeName || viewingPolicy.nominee_name} ({viewingPolicy.nomineeRelation || viewingPolicy.nominee_relation})
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Underwriting Insurer:</span>
                    <div className="font-bold text-slate-900">{viewingPolicy.insuranceCompany}</div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic text-justify leading-relaxed">
                  Notice: In the unfortunate event of the borrower's demise or permanent incapacitation within the active term of this policy, the cooperative shall settle the outstanding loan balance up to the insured sum with the underwriting partner as per cooperative microinsurance regulations.
                </p>
              </div>

              {/* Signatures */}
              <div className="mt-12 pt-6 border-t border-slate-300 grid grid-cols-3 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 w-28 mx-auto mb-1"></div>
                  <div className="font-bold text-slate-800">Prepared By</div>
                  <div className="text-[10px] text-slate-500">Microinsurance Desk</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-28 mx-auto mb-1"></div>
                  <div className="font-bold text-slate-800">Verified By</div>
                  <div className="text-[10px] text-slate-500">Loan Officer</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-28 mx-auto mb-1"></div>
                  <div className="font-bold text-slate-800">Authorized Signatory</div>
                  <div className="text-[10px] text-slate-500">General Manager</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Claim Settlement Receipt Voucher Modal */}
      {isSettlementReceiptModalOpen && settlementClaim && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-start pt-16 sm:pt-20 pb-12 px-3 sm:px-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-2">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-700" />
                <span className="text-sm font-black text-slate-900">Claim Settlement Voucher</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Voucher</span>
                </button>
                <button
                  onClick={() => setIsSettlementReceiptModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 p-6 border-2 border-emerald-800 rounded-2xl bg-white relative">
              <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                <div className="text-left">
                  <h3 className="text-lg font-black text-emerald-950 uppercase tracking-tight">
                    Ratauli Saving & Credit Cooperative Ltd.
                  </h3>
                  <div className="text-xs text-slate-600">Credit Protection & Claims Settlement Division</div>
                  <div className="inline-block mt-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-wider rounded-full">
                    Official Claim Settlement Receipt
                  </div>
                </div>
                {settlementQrCodeUrl && (
                  <div className="text-center shrink-0">
                    <img src={settlementQrCodeUrl} alt="Settlement QR" className="w-16 h-16 border border-slate-200 rounded p-0.5" />
                    <div className="text-[8px] text-slate-400 font-mono mt-0.5">PAYOUT VERIFIED</div>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2.5 text-xs text-slate-700">
                <div className="flex justify-between items-center font-mono">
                  <span>Voucher No: <strong className="text-slate-900 font-bold">{settlementClaim.settlementVoucherNo || 'VCH-CLM-2081-04'}</strong></span>
                  <span>Date: <strong className="text-slate-900">{settlementClaim.settlementDate || new Date().toISOString().split('T')[0]} ({settlementClaim.settlementDateBs || '2081-07-17'} BS)</strong></span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Claimant / Member:</span>
                    <strong className="text-slate-900 font-bold">{settlementClaim.memberName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Policy Number:</span>
                    <strong className="font-mono text-slate-900">{settlementClaim.policyNo}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Claim Incident / Cause:</span>
                    <strong className="text-[#C8102E] font-bold">{settlementClaim.claimCause}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payout Method:</span>
                    <strong className="text-slate-900">{settlementClaim.payoutMethod || 'Direct Account Transfer'}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-700 font-bold">Total Disbursed Amount:</span>
                    <strong className="text-emerald-800 font-black font-mono text-sm">
                      NPR {(settlementClaim.disbursedAmount || settlementClaim.claimAmountApproved || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic mt-2">
                  This voucher confirms complete settlement of credit insurance liability for the specified loan account in accordance with cooperative microinsurance policies.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 w-28 mx-auto mb-1"></div>
                  <div className="font-bold text-slate-800">Claimant / Nominee Signature</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-28 mx-auto mb-1"></div>
                  <div className="font-bold text-slate-800">General Manager Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate & Close Policy Modal */}
      {isDeactivateModalOpen && deactivatingPolicy && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 text-red-700 rounded-xl">
                  <Ban className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Deactivate Policy</h3>
                  <p className="text-[11px] text-slate-500">Move policy to Closed records with remark</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDeactivateModalOpen(false);
                  setDeactivatingPolicy(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeactivation} className="mt-4 space-y-3.5">
              <DayEndFieldset branchId={branch?.id} className="space-y-3.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Policy No:</span>
                  <strong className="font-mono text-slate-900">{deactivatingPolicy.policyNo}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Policy Holder:</span>
                  <strong className="text-slate-900">{deactivatingPolicy.memberName || deactivatingPolicy.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Maturity Date:</span>
                  <strong className="text-red-600 font-semibold">{deactivatingPolicy.policyExpiryDate || deactivatingPolicy.maturity_date}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Policy Amount:</span>
                  <strong className="text-slate-900 font-mono">NPR {(deactivatingPolicy.loanAmount || 0).toLocaleString()}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Deactivation Remark / Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter reason for deactivation / closing policy..."
                  value={deactivationRemark}
                  onChange={e => setDeactivationRemark(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-red-500 bg-white resize-y"
                />
              </div>
              </DayEndFieldset>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeactivateModalOpen(false);
                    setDeactivatingPolicy(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Save & Deactivate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Premium & Dues Arrangement Modal (matching image_529b5b18.png) */}
      {isPremiumModalOpen && premiumTargetPolicy && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-start pt-8 pb-12 px-3 sm:px-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1d4ed8] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-wide">
                    Premium & Dues Arrangement
                  </h3>
                  <p className="text-[11px] text-blue-100 font-medium">
                    Member: <span className="font-bold text-white">{premiumTargetPolicy.memberName || premiumTargetPolicy.name}</span> · Cit: {premiumTargetPolicy.citizenshipNo || 'N/A'} · Policy: #{premiumTargetPolicy.policyNo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPremiumModalOpen(false);
                  setPremiumTargetPolicy(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePremiumArrangement} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <DayEndFieldset branchId={branch?.id} className="space-y-5">
              {/* SECTION 1: LOAN & POLICY DATES & TERMS */}
              <div className="border border-blue-200 rounded-2xl p-4.5 bg-blue-50/20 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span>LOAN & POLICY DATES & TERMS</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                    RECORD DETAILS
                  </span>
                </div>

                {/* Sub-grid 1: Loan Date & Maturity Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Loan Date */}
                  <div className="border border-slate-200 bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>LOAN DATE</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">DATE BS</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={premiumForm.loanDateBs}
                        onChange={e => handlePremiumLoanDateBsChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">DATE AD</label>
                      <input
                        type="date"
                        value={premiumForm.loanDateAd}
                        onChange={e => handlePremiumLoanDateAdChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  {/* Maturity Date */}
                  <div className="border border-slate-200 bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>MATURITY DATE</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">MATURITY BS</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={premiumForm.maturityDateBs}
                        onChange={e => setPremiumForm(p => ({ ...p, maturityDateBs: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">MATURITY AD</label>
                      <input
                        type="date"
                        value={premiumForm.maturityDateAd}
                        onChange={e => setPremiumForm(p => ({ ...p, maturityDateAd: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-grid 2: Loan Duration & Insurance Term */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Loan Duration */}
                  <div className="border border-slate-200 bg-white rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase">LOAN DURATION</span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {premiumForm.loanDurationYears * 12} Months
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={premiumForm.loanDurationYears}
                        onChange={e => handlePremiumLoanDurationChange(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-500 uppercase">Years</span>
                    </div>
                  </div>

                  {/* Insurance Term */}
                  <div className="border border-slate-200 bg-white rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase">INSURANCE TERM</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {Math.round((premiumForm.insuranceTermMonths / 12) * 10) / 10} Year(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="360"
                        value={premiumForm.insuranceTermMonths}
                        onChange={e => handlePremiumInsuranceTermChange(parseInt(e.target.value, 10) || 12)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-500 uppercase">Months</span>
                    </div>
                  </div>
                </div>

                {/* Sub-grid 3: Insurance Start Date & Till Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Start Date */}
                  <div className="border border-slate-200 bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>INSURANCE START DATE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">BS</label>
                        <input
                          type="text"
                          placeholder="YYYY-MM-DD"
                          value={premiumForm.insuranceStartDateBs}
                          onChange={e => handlePremiumStartDateBsChange(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">AD</label>
                        <input
                          type="date"
                          value={premiumForm.insuranceStartDateAd}
                          onChange={e => handlePremiumStartDateAdChange(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Till Date */}
                  <div className="border border-slate-200 bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>INSURANCE TILL DATE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">BS</label>
                        <input
                          type="text"
                          placeholder="YYYY-MM-DD"
                          value={premiumForm.insuranceTillDateBs}
                          onChange={e => setPremiumForm(p => ({ ...p, insuranceTillDateBs: e.target.value }))}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">AD</label>
                        <input
                          type="date"
                          value={premiumForm.insuranceTillDateAd}
                          onChange={e => setPremiumForm(p => ({ ...p, insuranceTillDateAd: e.target.value }))}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-grid 4: Loan Amount & Premium Amount */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="border border-slate-200 bg-white rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase mb-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>LOAN / POLICY AMOUNT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">NPR</span>
                      <input
                        type="number"
                        value={premiumForm.loanAmount}
                        onChange={e => setPremiumForm(p => ({ ...p, loanAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-200 bg-white rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase mb-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>PREMIUM AMOUNT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">NPR</span>
                      <input
                        type="number"
                        value={premiumForm.premiumAmount}
                        onChange={e => setPremiumForm(p => ({ ...p, premiumAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PREMIUM & DUES ARRANGEMENT (Matching image_529b5b18.png) */}
              <div className="border border-emerald-200 rounded-2xl p-4.5 bg-emerald-50/20 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider pb-2 border-b border-emerald-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>PREMIUM & DUES ARRANGEMENT</span>
                </div>

                <div className="border border-amber-300 bg-amber-50/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                    <span className="text-[11px] font-black text-amber-900 uppercase">POLICY PREMIUM & DUES STATUS</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        LOAN TERM (LOAN YEARS)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={premiumForm.loanTermYears}
                        onChange={e => handlePremiumLoanDurationChange(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        PAID YEARS
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={premiumForm.paidYears}
                        onChange={e => setPremiumForm(p => ({ ...p, paidYears: parseInt(e.target.value, 10) || 0 }))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Dynamic Status Badge */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-bold text-slate-700">Policy Premium Status:</span>
                    {premiumForm.paidYears < premiumForm.loanTermYears ? (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 border border-red-300 uppercase">
                        DUE ({premiumForm.loanTermYears - premiumForm.paidYears} Yr(s) Due)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                        PAID
                      </span>
                    )}
                  </div>

                  {/* Payment Remark Input */}
                  <div>
                    <input
                      type="text"
                      placeholder="Paid Remark (e.g. Paid for 3 years, 2 years premium remaining due...)"
                      value={premiumForm.paymentRemark}
                      onChange={e => setPremiumForm(p => ({ ...p, paymentRemark: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: POLICY NOTES / REMARKS */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>POLICY REMARKS / NOTES</span>
                </div>
                <textarea
                  rows={2}
                  value={premiumForm.notes}
                  onChange={e => setPremiumForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Enter policy arrangement details, remarks or approval notes...."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>
              </DayEndFieldset>

              {/* Modal Footer Bar */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsPremiumModalOpen(false);
                    setPremiumTargetPolicy(null);
                  }}
                  className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-6 py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Update Arrangement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
