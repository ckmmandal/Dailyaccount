import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { 
  LineChart, Upload, FileText, Heart, Bell, Sliders,
  ShieldCheck, Plus, Search, Download, Printer, 
  CheckCircle2, Clock, 
  Trash2, Edit3, Eye, Sparkles,
  HeartHandshake,
  TrendingUp, Award, RefreshCw, X,
  FileSpreadsheet, ArrowRight, Ban, Calendar,
  Database, AlertCircle,
  User, MapPin, Briefcase, Building, CreditCard
} from 'lucide-react';
import { 
  LoanInsuranceRecord, 
  InsuranceClaimRecord, 
  InsurancePartnerCompany,
  ClaimLifecycleStage,
  ClaimStatusType,
  LoanInsuranceStatus
} from '../types';
import { 
  loanInsuranceService, 
  ExtractedOcrData,
  convertAdToBs,
  convertBsToAd,
  calculatePremium
} from '../services/loanInsuranceService';
import { useAuth } from '../AuthContext';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

export const LoanInsuranceManagement: React.FC = () => {
  const { branch, settings } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  
  // Navigation active menu (Top Menu format: Dashboard, Upload Policy, Report, Maturity Alerts)
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'upload' | 'report' | 'alerts'>('dashboard');

  // Data states
  const [records, setRecords] = useState<LoanInsuranceRecord[]>(() => loanInsuranceService.getRecords());
  const [claims, setClaims] = useState<InsuranceClaimRecord[]>(() => loanInsuranceService.getClaims());
  const [companies, setCompanies] = useState<InsurancePartnerCompany[]>(() => loanInsuranceService.getCompanies());
  
  // Report Tab Filter Pills (from image 3)
  // 'all' | 'active' | 'first_policy' | 'closed' | 'expired' | 'renewal' | 'reject' | 'premium' | 'statement'
  const [reportFilter, setReportFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Maturity Alerts Period Filter (from image 4)
  // 'all' | 'today' | 'tomorrow' | 'week' | 'month'
  const [alertPeriod, setAlertPeriod] = useState<'all' | 'today' | 'tomorrow' | 'week' | 'month'>('all');

  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const period = params.get('period');
    if (tab === 'alerts' || tab === 'dashboard' || tab === 'upload' || tab === 'report') {
      setActiveMenu(tab);
    }
    if (period === 'today' || period === 'tomorrow' || period === 'week' || period === 'month' || period === 'all') {
      setAlertPeriod(period);
    }
  }, [location.search]);

  // Modals state
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isHistoryViewModalOpen, setIsHistoryViewModalOpen] = useState(false);
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
      branchId: 'Select Branch',
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

  // Refresh data from service & Supabase
  const refreshData = () => {
    setRecords(loanInsuranceService.getRecords());
    setClaims(loanInsuranceService.getClaims());
    setCompanies(loanInsuranceService.getCompanies());
    void loanInsuranceService.syncAllFromSupabase().then(res => {
      setRecords(res.records);
      setClaims(res.claims);
      setCompanies(res.companies);
    });
  };

  useEffect(() => {
    void loanInsuranceService.syncAllFromSupabase().then(res => {
      setRecords(res.records);
      setClaims(res.claims);
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

  // Summary Metrics matching Image 1
  const summaryMetrics = useMemo(() => {
    const isClosed = (r: LoanInsuranceRecord) => 
      r.status === 'Closed' || r.status === 'closed' || r.status === 'Settled' || 
      r.status === 'rejected' || r.status === 'Rejected' || r.status === 'deactivated' || r.status === 'Deactivated';

    const isDateExpired = (r: LoanInsuranceRecord) => Boolean(r.policyExpiryDate && new Date(r.policyExpiryDate) < new Date());
    const isExplicitExpired = (r: LoanInsuranceRecord) => r.status === 'Expired' || r.status === 'expired';
    const isExp = (r: LoanInsuranceRecord) => isDateExpired(r) || isExplicitExpired(r);

    const closedRecords = records.filter(isClosed);
    const expiredRecords = records.filter(r => !isClosed(r) && isExp(r));
    const renewedRecords = records.filter(r => !isClosed(r) && (r.status === 'renewed' || r.status === 'Renewed'));
    const firstPolicyRecords = records.filter(r => !isClosed(r) && (r.status === 'start_policy' || r.isFirstPolicy === true));
    // First time + renewal active records (active, not expired, not closed)
    const activeRecords = records.filter(r => 
      !isClosed(r) && 
      !isExp(r) && 
      (r.status === 'Active' || r.status === 'start_policy' || r.status === 'renewed' || r.status === 'Renewed' || r.isFirstPolicy === true)
    );
    const premiumPendingRecords = records.filter(r => !isClosed(r) && !r.isPremiumSaved);
    const rejectedRecords = records.filter(r => r.status === 'rejected' || r.status === 'Rejected');

    // Portfolio summary: count of primary portfolio loans
    const portfolioCount = records.length;
    const portfolioAmount = records.reduce((sum, r) => sum + (r.loanAmount || 0), 0);
    const portfolioPremium = records.reduce((sum, r) => sum + (r.premiumAmount || r.premium || 0), 0);

    const expiredAmount = expiredRecords.reduce((sum, r) => sum + (r.loanAmount || 0), 0);
    const expiredPremium = expiredRecords.reduce((sum, r) => sum + (r.premiumAmount || r.premium || 0), 0);

    const renewedAmount = renewedRecords.reduce((sum, r) => sum + (r.loanAmount || 0), 0);
    const renewedPremium = renewedRecords.reduce((sum, r) => sum + (r.premiumAmount || r.premium || 0), 0);

    const activeAmount = activeRecords.reduce((sum, r) => sum + (r.loanAmount || 0), 0);
    const activePremium = activeRecords.reduce((sum, r) => sum + (r.premiumAmount || r.premium || 0), 0);

    const closedAmount = closedRecords.reduce((sum, r) => sum + (r.loanAmount || 0), 0);
    const closedPremium = closedRecords.reduce((sum, r) => sum + (r.premiumAmount || r.premium || 0), 0);

    const settledClaims = claims.filter(c => c.status === 'Settled');
    const inProcessClaims = claims.filter(c => c.status === 'Submitted' || c.status === 'Under Review');
    const rejectedClaims = claims.filter(c => c.status === 'Rejected');

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
      premiumCount: premiumPendingRecords.length,
      pendingCount: 0,
      pendingAmount: 0,
      pendingPremiumDue: 0,
      upcomingMaturityCount: 0,
      upcomingMaturityAmount: 0,
      upcomingMaturityPremium: 0,
      rejectedCount: rejectedRecords.length,
      rejectedAmount: 0,
      rejectedLostPremium: 0,
      claimsTotal: claims.length,
      claimsInProcess: inProcessClaims.length,
      claimsSettled: settledClaims.length,
      claimsRejected: rejectedClaims.length
    };
  }, [records, claims]);

  // Expired policies list (matching Image 1 middle card)
  const expiredPolicies = useMemo(() => {
    const isClosed = (r: LoanInsuranceRecord) => 
      r.status === 'Closed' || r.status === 'closed' || r.status === 'Settled' || 
      r.status === 'rejected' || r.status === 'Rejected' || r.status === 'deactivated' || r.status === 'Deactivated';
    return records.filter(r => !isClosed(r) && (r.status === 'Expired' || r.status === 'expired' || (r.policyExpiryDate && new Date(r.policyExpiryDate) < new Date())));
  }, [records]);

  // Filtered records for Report table (matching Image 3)
  const filteredReportRecords = useMemo(() => {
    const isClosed = (r: LoanInsuranceRecord) => 
      r.status === 'Closed' || r.status === 'closed' || r.status === 'Settled' || 
      r.status === 'rejected' || r.status === 'Rejected' || r.status === 'deactivated' || r.status === 'Deactivated';

    const isDateExpired = (r: LoanInsuranceRecord) => Boolean(r.policyExpiryDate && new Date(r.policyExpiryDate) < new Date());
    const isExplicitExpired = (r: LoanInsuranceRecord) => r.status === 'Expired' || r.status === 'expired';
    const isExp = (r: LoanInsuranceRecord) => isDateExpired(r) || isExplicitExpired(r);

    return records.filter(r => {
      // Search
      const searchMatch = !searchQuery || 
        (r.memberName && r.memberName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.policyNo && r.policyNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.citizenshipNo && r.citizenshipNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.memberId && r.memberId.toLowerCase().includes(searchQuery.toLowerCase()));

      // Tab pills filter
      let pillMatch = true;
      if (reportFilter === 'active') {
        // First time + renewal (active, not expired, not closed)
        pillMatch = !isClosed(r) && !isExp(r) && (r.status === 'Active' || r.status === 'start_policy' || r.status === 'renewed' || r.status === 'Renewed' || r.isFirstPolicy === true);
      } else if (reportFilter === 'first_policy') {
        // First policy uploaded data
        pillMatch = (r.status === 'start_policy' || r.isFirstPolicy === true) && !isClosed(r);
      } else if (reportFilter === 'expired') {
        // Mature / Expired policies
        pillMatch = !isClosed(r) && isExp(r);
      } else if (reportFilter === 'renewal') {
        // Only policies that have been renewed
        pillMatch = (r.status === 'renewed' || r.status === 'Renewed') && !isClosed(r);
      } else if (reportFilter === 'closed' || reportFilter === 'reject') {
        // Closed or deactivated policies
        pillMatch = isClosed(r);
      } else if (reportFilter === 'premium') {
        // Only policies waiting for premium arrangement; once saved, removed from this table
        pillMatch = !r.isPremiumSaved && !isClosed(r);
      } else if (reportFilter === 'all') {
        // All policies
        pillMatch = true;
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

  // Bulk Excel import confirmation handler
  const handleConfirmExcelImport = () => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (excelPreviewRows.length === 0) return;
    loanInsuranceService.bulkImportRecords(excelPreviewRows);
    refreshData();
    setExcelPreviewRows([]);
    setIsExcelImportModalOpen(false);
    setReportFilter('all');
    setActiveMenu('report');
  };

  // Direct Save Data handler: Saves current form (and any bulk rows) to DB and switches to Report -> All Policies
  const handleSaveDataDirect = () => {
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
      branchId: policyForm.branchId && policyForm.branchId !== 'Select Branch' ? policyForm.branchId : (branch?.name || 'Head Office')
    };

    if (editingPolicy) {
      loanInsuranceService.updateRecord(editingPolicy.id, payload);
    } else {
      loanInsuranceService.addRecord(payload as Omit<LoanInsuranceRecord, 'id' | 'createdAt' | 'updatedAt'>);
    }

    // Bulk import any extra spreadsheet rows beyond the first one
    if (excelPreviewRows.length > 1) {
      const remainingRows = excelPreviewRows.slice(1);
      loanInsuranceService.bulkImportRecords(remainingRows);
    }

    refreshData();
    setIsPolicyModalOpen(false);
    setIsUploadFormVisible(false);
    setExcelPreviewRows([]);
    setEditingPolicy(null);
    setPolicyForm(getInitialPolicyForm());

    // Switch view to Report -> All Policies immediately
    setReportFilter('all');
    setActiveMenu('report');
  };

  // Save Policy Form (for form submit)
  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveDataDirect();
  };

  // Open Edit Policy
  const handleOpenEditPolicy = (record: LoanInsuranceRecord) => {
    setEditingPolicy(record);
    setPolicyForm(record);
    setIsPolicyModalOpen(true);
  };

  // Delete Policy - Direct and reliable without iframe-blocking window.confirm
  const handleDeletePolicy = (id: string) => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    loanInsuranceService.deleteRecord(id);
    refreshData();
  };

  // Open Renewal Modal matching image_7c9690b7.png
  const handleOpenRenewalModal = (record: LoanInsuranceRecord) => {
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
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }

    const totalLoanYears = renewalForm.newLoanTermYears;
    const updatedPaidYears = Math.min(totalLoanYears, renewalForm.newPaidYears);
    const isPaid = updatedPaidYears >= totalLoanYears;
    const dueYrs = Math.max(0, totalLoanYears - updatedPaidYears);

    loanInsuranceService.updateRecord(renewingPolicy.id, {
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
      notes: 'Renewed policy agreement and coverage'
    });

    refreshData();
    setIsRenewalModalOpen(false);
    setRenewingPolicy(null);
    setReportFilter('renewal');
    setActiveMenu('report');
  };

  // Open Deactivate Modal
  const handleOpenDeactivateModal = (record: LoanInsuranceRecord) => {
    setDeactivatingPolicy(record);
    setDeactivationRemark('');
    setIsDeactivateModalOpen(true);
  };

  // Confirm Deactivation with user remark and move to Closed tab
  const handleConfirmDeactivation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivatingPolicy) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }

    const remarkText = deactivationRemark.trim() || 'Deactivated from expired policies';
    const updatedNotes = deactivatingPolicy.notes 
      ? `${deactivatingPolicy.notes} | Deactivated: ${remarkText}`
      : `Deactivated: ${remarkText}`;

    loanInsuranceService.updateRecord(deactivatingPolicy.id, {
      status: 'Closed',
      notes: updatedNotes
    });

    refreshData();
    setIsDeactivateModalOpen(false);
    setDeactivatingPolicy(null);
    setDeactivationRemark('');

    // Switch view to Report -> Closed tab immediately
    setReportFilter('closed');
    setActiveMenu('report');
  };

  // Open Premium & Dues Arrangement Modal (matching image_529b5b18.png)
  const handleOpenPremiumModal = (record: LoanInsuranceRecord) => {
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
      policyStartDate: premiumForm.insuranceStartDateAd,
      policyStartDateBs: premiumForm.insuranceStartDateBs,
      policyExpiryDate: premiumForm.maturityDateAd || premiumForm.insuranceTillDateAd,
      policyExpiryDateBs: premiumForm.maturityDateBs || premiumForm.insuranceTillDateBs,
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
    setReportFilter('premium');
    setActiveMenu('report');
  };

  // Save Claim Form
  const handleSaveClaim = (e: React.FormEvent) => {
    e.preventDefault();
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

    if (editingClaim) {
      loanInsuranceService.updateClaim(editingClaim.id, claimForm);
    } else {
      loanInsuranceService.addClaim(claimForm as Omit<InsuranceClaimRecord, 'id' | 'createdAt' | 'updatedAt' | 'claimNo'>);
    }

    refreshData();
    setIsClaimModalOpen(false);
    setEditingClaim(null);
    setClaimForm(initialClaimForm);
  };

  // Advance Claim Stage in 6-stage lifecycle
  const handleAdvanceClaimLifecycle = (claim: InsuranceClaimRecord) => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const stages: ClaimLifecycleStage[] = [
      'Claim Submission',
      'Document Verification',
      'Evaluation',
      'Admin Approval',
      'Payout Disbursement',
      'Settlement Receipt'
    ];

    const currentIndex = stages.indexOf(claim.lifecycleStage || 'Claim Submission');
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      const updates: Partial<InsuranceClaimRecord> = {};

      if (nextStage === 'Admin Approval') {
        updates.claimAmountApproved = claim.claimAmountApproved || claim.claimAmountRequested;
        updates.approvedBy = 'Board of Directors & Chief Underwriter';
      } else if (nextStage === 'Payout Disbursement') {
        updates.disbursedAmount = claim.claimAmountApproved || claim.claimAmountRequested;
        updates.disbursementDate = new Date().toISOString().split('T')[0];
        updates.disbursementDateBs = convertAdToBs(new Date().toISOString().split('T')[0]);
      } else if (nextStage === 'Settlement Receipt') {
        updates.settlementDate = new Date().toISOString().split('T')[0];
        updates.settlementDateBs = convertAdToBs(new Date().toISOString().split('T')[0]);
        updates.settlementVoucherNo = `VCH-CLM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      }

      loanInsuranceService.advanceClaimStage(claim.id, nextStage, updates);
      refreshData();
    }
  };

  // Open Edit Claim
  const handleOpenEditClaim = (claim: InsuranceClaimRecord) => {
    setEditingClaim(claim);
    setClaimForm(claim);
    setIsClaimModalOpen(true);
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
      'Micro Finance Branch': r.branchId || 'Head Office',
      'BranchCode': r.branchId === 'Sahodba Branch' || r.branchId === '2' ? 2 : 1,
      'MobileNumber': r.mobileNumber || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MicroInsurance');
    XLSX.writeFile(workbook, `MicroInsuranceTemplate_${new Date().toISOString().split('T')[0]}.xlsx`);
  };


  // View Insurance Records & History Detail (image_fe26df2f.png)
  const handleViewPolicyDetails = (record: LoanInsuranceRecord) => {
    setViewingPolicy(record);
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
                BRANCH
              </label>
              <select
                value={policyForm.branchId || 'Select Branch'}
                onChange={e => setPolicyForm(prev => ({ ...prev, branchId: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="Select Branch">Select Branch</option>
                <option value="Head Office">Head Office</option>
                <option value="Sahodba Branch">Sahodba Branch</option>
                <option value="Pipra Branch">Pipra Branch</option>
                <option value="Janakpur Branch">Janakpur Branch</option>
                <option value="Ramgopalpur Branch">Ramgopalpur Branch</option>
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
      {/* TOP MENU NAVIGATION BAR (Replaces blue sidebar format) */}
      {/* ======================================================== */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <button
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

          <button
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

          <button
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

          <button
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
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Top-Right Quick Action Button - Only rendered on Upload Policy */}
        {activeMenu === 'upload' && (
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#025e40] hover:bg-[#014730] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Policy Manually</span>
            </button>
          </div>
        )}
      </header>

      {/* ======================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ======================================================== */}
      <main className="flex-1 p-3 sm:p-4 lg:p-5 overflow-y-auto">
        {/* ======================================================== */}
        {/* VIEW 1: DASHBOARD (Exact Match to Image 1: image_0695b558.png) */}
        {/* ======================================================== */}
        {activeMenu === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 2 Cards (Cols 1-7 on desktop) */}
            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Recent Policy */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Recent Policy</h3>
                  <button 
                    onClick={() => setActiveMenu('report')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {records.slice(0, 4).map(r => (
                    <div key={r.id} className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-all flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{r.memberName || r.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Added Oct 29, 2026</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600 text-xs font-mono">
                          NPR {(r.loanAmount || 0).toLocaleString()}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          POLICY AMOUNT
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: Expired Policy */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Expired Policy</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {expiredPolicies.length} total
                  </span>
                </div>

                <div className="space-y-3">
                  {expiredPolicies.slice(0, 4).map(r => (
                    <div key={r.id} className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-all flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{r.memberName || r.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {r.branchId === '2' ? 'Sahodba Branch · 1 year' : 'Head Office · 1 year'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            {r.policyExpiryDate || '2025-01-14'}
                          </div>
                          <div className="mt-1 flex items-center justify-end gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700">DUE</span>
                            <button
                              type="button"
                              disabled={isDayEnded}
                              title={isDayEnded ? getDayEndedBlockMessage() : 'Manage Policy'}
                              onClick={() => handleOpenRenewalModal(r)}
                              className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Manage
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: SUMMARY (Cols 8-12 on desktop) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center gap-2 text-slate-700 text-xs font-bold uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>SUMMARY</span>
              </div>

              {/* 8 Summary Cards in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. PORTFOLIO SUMMARY */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      PORTFOLIO SUMMARY
                    </span>
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <Database className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900">{summaryMetrics.portfolioCount}</span>
                    <span className="text-xs text-slate-500 ml-1">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <strong className="text-slate-800 font-mono">NPR {summaryMetrics.portfolioAmount.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Premium:</span>
                      <strong className="text-slate-800 font-mono">NPR {summaryMetrics.portfolioPremium.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. ACTIVE RECORDS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ACTIVE RECORDS</div>
                      <div className="text-[9px] text-slate-400">Active + Pending + Renewed</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900">{summaryMetrics.activeCount}</span>
                    <span className="text-xs text-slate-500 ml-1">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>Active Amount:</span>
                      <strong className="text-slate-800 font-mono">NPR {summaryMetrics.activeAmount.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Premium:</span>
                      <strong className="text-slate-800 font-mono">NPR {summaryMetrics.activePremium.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* 3. UPCOMING MATURITY */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">UPCOMING MATURITY</div>
                      <div className="text-[9px] text-slate-400">Next 30 days</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                      <Bell className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900">{summaryMetrics.upcomingMaturityCount}</span>
                    <span className="text-xs text-slate-500 ml-1">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>Maturity Amount:</span>
                      <strong className="text-slate-800 font-mono">NPR 0</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Premium Value:</span>
                      <strong className="text-slate-800 font-mono">NPR 0</strong>
                    </div>
                  </div>
                </div>

                {/* 4. PENDING RECORDS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PENDING RECORDS</span>
                    <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900">{summaryMetrics.pendingCount}</span>
                    <span className="text-xs text-slate-500 ml-1">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>Pending Amount:</span>
                      <strong className="text-slate-800 font-mono">NPR 0</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Premium Due:</span>
                      <strong className="text-slate-800 font-mono">NPR 0</strong>
                    </div>
                  </div>
                </div>

                {/* 5. EXPIRED RECORDS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">EXPIRED RECORDS</span>
                    <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900">{summaryMetrics.expiredCount}</span>
                    <span className="text-xs text-slate-500 ml-1">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>Expired Amount:</span>
                      <strong className="text-slate-800 font-mono">NPR {summaryMetrics.expiredAmount.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Premium Value:</span>
                      <strong className="text-slate-800 font-mono">NPR {summaryMetrics.expiredPremium.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* 6. RENEWED RECORDS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">RENEWED RECORDS</span>
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900">{summaryMetrics.renewedCount}</span>
                    <span className="text-xs text-slate-500 ml-1">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>Renewed Amount:</span>
                      <strong className="text-slate-800 font-mono">NPR {summaryMetrics.renewedAmount.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Premium:</span>
                      <strong className="text-slate-800 font-mono">NPR {summaryMetrics.renewedPremium.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* 7. REJECTED RECORDS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">REJECTED RECORDS</span>
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <X className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900">{summaryMetrics.rejectedCount}</span>
                    <span className="text-xs text-slate-500 ml-1">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>Rejected Amount:</span>
                      <strong className="text-slate-800 font-mono">NPR 0</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Lost Premium:</span>
                      <strong className="text-slate-800 font-mono">NPR 0</strong>
                    </div>
                  </div>
                </div>

                {/* 8. CLAIMS TRACKER */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CLAIMS TRACKER</div>
                      <div className="text-[9px] text-slate-400">Claims Tracker</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <Heart className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-900">{summaryMetrics.claimsTotal}</span>
                    <span className="text-xs text-slate-500 ml-1">total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>In Process:</span>
                      <strong className="text-slate-800 font-mono">{summaryMetrics.claimsInProcess}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Settled:</span>
                      <strong className="text-slate-800 font-mono">{summaryMetrics.claimsSettled}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Rejected:</span>
                      <strong className="text-slate-800 font-mono">{summaryMetrics.claimsRejected}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: UPLOAD POLICY (Clean upload without initial form or banners) */}
        {/* ======================================================== */}
        {activeMenu === 'upload' && (
          <div className="max-w-4xl mx-auto space-y-6">
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
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: REPORT (Exact Match to Image 3: image_4f57aee9.png) */}
        {/* ======================================================== */}
        {activeMenu === 'report' && (
          <div className="space-y-2">
            {/* Top Filter Badges (Compact horizontal scrollable pill buttons) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <button
                onClick={() => setReportFilter('all')}
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
                onClick={() => setReportFilter('active')}
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
                onClick={() => setReportFilter('first_policy')}
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
                onClick={() => setReportFilter('closed')}
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
                onClick={() => setReportFilter('expired')}
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
                onClick={() => setReportFilter('renewal')}
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
                onClick={() => setReportFilter('premium')}
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
                onClick={() => setReportFilter('statement')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  reportFilter === 'statement'
                    ? 'bg-[#025e40] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Statement</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">0</span>
              </button>
            </div>

            {/* Sub-header with Search and Export to Excel (Compact height) */}
            <div className="bg-white rounded-xl border border-slate-200 px-3.5 py-1.5 shadow-2xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
              <div className="flex items-center gap-3 flex-1">
                <h3 className="text-xs font-bold text-slate-900 shrink-0">All Policies</h3>
                <div className="relative flex-1 max-w-sm">
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
                onClick={() => exportToExcel(filteredReportRecords)}
                className="px-3.5 py-1 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>Export to Excel</span>
              </button>
            </div>

            {/* Table matching Image 3 */}
            {/* Table matching Image 3 with whitespace-nowrap (No Text Wrapping) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
              <table className="w-full min-w-[1150px] text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">S.N.</th>
                    <th className="px-4 py-3 whitespace-nowrap">POLICY HOLDER</th>
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
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400 whitespace-nowrap">
                        No policies match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredReportRecords.map((r, i) => {
                      const initialLetter = (r.memberName || r.name || 'S').charAt(0).toUpperCase();
                      const isClosed = r.status === 'Closed' || r.status === 'closed' || r.status === 'Settled' || r.status === 'deactivated' || r.status === 'Deactivated';
                      const isRejected = r.status === 'rejected' || r.status === 'Rejected';
                      const isExpired = !isClosed && (r.status === 'Expired' || r.status === 'expired' || (r.policyExpiryDate && new Date(r.policyExpiryDate) < new Date()));

                      return (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-500 whitespace-nowrap">{r.sn || i + 1}</td>
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
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${
                              isExpired 
                                ? 'bg-red-50 text-red-700 border border-red-200' 
                                : r.status === 'renewed'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isRejected
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isClosed
                                ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isExpired ? 'EXPIRED' : isRejected ? 'REJECTED' : isClosed ? 'CLOSED' : (r.status === 'start_policy' ? 'ACTIVE' : r.status.toUpperCase())}
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
                              {/* 'P' Premium & Dues Management Button */}
                              <button
                                type="button"
                                disabled={isDayEnded}
                                onClick={() => handleOpenPremiumModal(r)}
                                className="w-5 h-5 rounded bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] flex items-center justify-center shadow-2xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isDayEnded ? getDayEndedBlockMessage() : 'Manage Premium & Dues (P)'}
                              >
                                P
                              </button>
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
                              <button
                                type="button"
                                disabled={isDayEnded}
                                onClick={() => handleOpenEditPolicy(r)}
                                className="p-1 hover:text-blue-600 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Policy'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Renew Policy: never shown in 'all', only in 'expired' or 'renewal' */}
                              {reportFilter !== 'all' && (reportFilter === 'expired' || reportFilter === 'renewal') && (
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
                              {reportFilter === 'expired' && (
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

                              <button
                                type="button"
                                disabled={isDayEnded}
                                onClick={() => handleDeletePolicy(r.id)}
                                className="p-1 hover:text-red-600 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isDayEnded ? getDayEndedBlockMessage() : 'Delete Policy'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
        {/* VIEW 4: MATURITY ALERTS (Exact Match to Image 4: image_4ef379c4.png) */}
        {/* ======================================================== */}
        {activeMenu === 'alerts' && (
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
                        <td className="p-3.5 font-mono">NPR {(r.loanAmount || 0).toLocaleString()}</td>
                        <td className="p-3.5 text-red-600 font-bold">{r.policyExpiryDate}</td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            disabled={isDayEnded}
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Renew Policy'}
                            onClick={() => handleOpenRenewalModal(r)}
                            className="px-3 py-1 bg-[#025e40] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Renew Policy
                          </button>
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
        {/* VIEW 5: CLAIMS TRACKER */}
        {/* ======================================================== */}
        {activeMenu === 'claims' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Credit Protection Claims Lifecycle</h2>
                <p className="text-xs text-slate-500">6-Stage End-to-End Tracking: Submission → Verification → Evaluation → Approval → Payout → Settlement.</p>
              </div>
              <button
                type="button"
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : 'Register New Claim'}
                onClick={() => {
                  setEditingClaim(null);
                  setClaimForm(initialClaimForm);
                  setIsClaimModalOpen(true);
                }}
                className="px-4 py-2 bg-[#C8102E] hover:bg-[#a50b23] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Register New Claim</span>
              </button>
            </div>

            <div className="space-y-4">
              {claims.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <Heart className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-600">No active claims on record</p>
                </div>
              ) : (
                claims.map(claim => {
                  const stages: ClaimLifecycleStage[] = [
                    'Claim Submission',
                    'Document Verification',
                    'Evaluation',
                    'Admin Approval',
                    'Payout Disbursement',
                    'Settlement Receipt'
                  ];
                  const currentStageIndex = stages.indexOf(claim.lifecycleStage || 'Claim Submission');

                  return (
                    <div key={claim.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                      <div className="flex flex-wrap justify-between items-center pb-3 border-b border-slate-100 gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">{claim.claimNo}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              {claim.status}
                            </span>
                          </div>
                          <div className="font-bold text-slate-800 text-xs mt-0.5">{claim.memberName} ({claim.policyNo})</div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Cause</div>
                          <div className="font-bold text-red-600 text-xs">{claim.claimCause}</div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Claim Amount</div>
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            NPR {claim.claimAmountRequested.toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {currentStageIndex < stages.length - 1 && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                              onClick={() => handleAdvanceClaimLifecycle(claim)}
                              className="px-3 py-1.5 bg-[#025e40] hover:bg-[#014730] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span>Next: {stages[currentStageIndex + 1]}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {claim.lifecycleStage === 'Settlement Receipt' && (
                            <button
                              type="button"
                              onClick={() => handleViewSettlementReceipt(claim)}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Voucher</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isDayEnded}
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Claim'}
                            onClick={() => handleOpenEditClaim(claim)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      {/* 6-Stage Visual Stepper */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
                        {stages.map((stage, idx) => {
                          const isDone = idx < currentStageIndex;
                          const isCurrent = idx === currentStageIndex;

                          return (
                            <div 
                              key={stage}
                              className={`p-2 rounded-xl border text-center text-[10px] font-bold ${
                                isDone 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                  : isCurrent
                                  ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-100'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              }`}
                            >
                              {stage}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
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

      {/* Insurance Records & History Modal - Exact Match to image_fe26df2f.png */}
      {isHistoryViewModalOpen && viewingPolicy && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-start pt-16 sm:pt-20 pb-12 px-3 sm:px-6 overflow-y-auto">
          <div className="bg-[#0b5cab] rounded-3xl max-w-5xl w-full shadow-2xl border border-blue-400/40 my-2 overflow-hidden">
            {/* Modal Top Header Bar */}
            <div className="px-6 pt-5 pb-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10 text-amber-300">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-wide text-white">Insurance Records & History</h3>
                  <p className="text-[11px] text-blue-100 font-medium">Insurance Records & History View</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl border border-white/25 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportToExcel([viewingPolicy])}
                  className="px-3.5 py-1.5 rounded-xl border border-white/25 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryViewModalOpen(false)}
                  className="p-1.5 rounded-xl border border-white/25 hover:bg-white/10 text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Blue Member Profile Card */}
            <div className="px-6 pb-6">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 text-white">
                {/* Left Member Details */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#053b75] border-2 border-white/30 flex items-center justify-center font-extrabold text-lg text-white shadow-inner shrink-0">
                    {getInitials(viewingPolicy.memberName || viewingPolicy.name)}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight">
                      {viewingPolicy.memberName || viewingPolicy.name}
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs text-blue-100 mt-0.5 font-mono">
                      <CreditCard className="w-3.5 h-3.5 text-blue-200" />
                      <span>Citizenship No: {viewingPolicy.citizenshipNo || 'N/A'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-semibold text-white flex items-center gap-1.5">
                        <User className="w-3 h-3 text-blue-200" />
                        {viewingPolicy.gender || 'Female'} · {viewingPolicy.age || 34} yrs
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-semibold text-white flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-blue-200" />
                        {viewingPolicy.address || 'Ratauli-3, Mahottari'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-semibold text-white flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3 text-blue-200" />
                        {viewingPolicy.occupation || 'Agriculture'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-semibold text-white flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-blue-200" />
                        {viewingPolicy.branchId || 'Head Office'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons & Status Indicators */}
                <div className="flex flex-col sm:flex-row xl:flex-col items-start xl:items-end gap-3 shrink-0 w-full xl:w-auto justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-blue-800 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Policy Audit: ${viewingPolicy.policyNo} recorded and verified in core system.`)}
                      className="px-3.5 py-1.5 bg-blue-950/40 hover:bg-blue-950/60 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>History</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsHistoryViewModalOpen(false);
                        handleViewCertificate(viewingPolicy);
                      }}
                      className="px-3.5 py-1.5 bg-[#10b981] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      disabled={isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : 'Add Loan Policy'}
                      onClick={() => {
                        setIsHistoryViewModalOpen(false);
                        handleOpenEditPolicy(viewingPolicy);
                      }}
                      className="px-3.5 py-1.5 bg-[#f59e0b] hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Loan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Combined Insurance Coverage: Active under Ratauli Credit Protection Scheme.`)}
                      className="px-3.5 py-1.5 bg-[#0284c7] hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Combined Insu</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4 self-end mt-1">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">POLICY STATUS</div>
                      <div className="mt-0.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white text-blue-800 text-xs font-bold shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span>{viewingPolicy.status || 'Active'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">PREMIUM PAYMENT</div>
                      <div className={`mt-0.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white text-xs font-bold shadow-xs ${
                        viewingPolicy.premiumPaymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          viewingPolicy.premiumPaymentStatus === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}></span>
                        <span>{viewingPolicy.premiumPaymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Cards Grid - Crisp White Section Matching image_fe26df2f.png */}
            <div className="bg-[#f0f4f8] p-5 sm:p-6 rounded-b-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: PERSONAL INFO */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center gap-2 pb-3 mb-2 border-b border-slate-100">
                    <User className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-black text-slate-800 tracking-wider uppercase">PERSONAL INFO</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Gender</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.gender || 'Female'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">DOB (AD)</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.dateOfBirth || '1990-04-15'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">DOB (BS)</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.dateOfBirthBs || convertAdToBs(viewingPolicy.dateOfBirth) || '2047-01-02'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Age</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.age || 34} years</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Address</span>
                      <span className="font-bold text-slate-900 truncate max-w-[130px] text-right" title={viewingPolicy.address}>
                        {viewingPolicy.address || 'Ratauli-3, Mahottari'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-blue-600 font-semibold">Occupation</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.occupation || 'Agriculture'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: POLICY DETAILS */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center gap-2 pb-3 mb-2 border-b border-slate-100">
                    <FileText className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-black text-slate-800 tracking-wider uppercase">POLICY DETAILS</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Policy No</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.policyNo}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Customer ID</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.memberId || 'RSCC-MEM-1042'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">DOC (BS)</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.policyStartDateBs || convertAdToBs(viewingPolicy.policyStartDate) || '2080-10-01'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">DOC (AD)</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.policyStartDate || '2024-01-15'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Term</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.termMonths || 12} months</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-blue-600 font-semibold">Maturity date</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.policyExpiryDate || '2025-01-14'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: NOMINEE */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center gap-2 pb-3 mb-2 border-b border-slate-100">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-black text-slate-800 tracking-wider uppercase">NOMINEE</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Name</span>
                      <span className="font-bold text-slate-900 truncate max-w-[130px] text-right" title={viewingPolicy.nomineeName}>
                        {viewingPolicy.nomineeName || 'Ramesh Chaudhary'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Relation</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.nomineeRelation || 'Husband'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Nominee DOB (AD)</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.nomineeDob || '1988-06-20'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Nominee DOB (BS)</span>
                      <span className="font-bold text-slate-900 font-mono">{viewingPolicy.nomineeDobBs || convertAdToBs(viewingPolicy.nomineeDob) || '2045-03-06'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Disability</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.disability || 'None'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-blue-600 font-semibold">Active life</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.livingActiveLife || 'Yes'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 4: LOAN & COVERAGE */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center gap-2 pb-3 mb-2 border-b border-slate-100">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black text-slate-800 tracking-wider uppercase">LOAN & COVERAGE</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Policy Amount</span>
                      <span className="font-bold text-blue-600 font-mono">
                        NPR {(viewingPolicy.sumAssured || viewingPolicy.loanAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Premium</span>
                      <span className="font-bold text-blue-600 font-mono">
                        NPR {(viewingPolicy.premiumAmount || viewingPolicy.premium || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Payment</span>
                      <span className={`font-bold ${viewingPolicy.premiumPaymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {viewingPolicy.premiumPaymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Status</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.status || 'Active'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-blue-600 font-semibold">Loan Type</span>
                      <span className="font-bold text-slate-900 text-right truncate max-w-[130px]" title={viewingPolicy.loanType}>
                        {viewingPolicy.loanType || 'Agricultural Term Loan'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-blue-600 font-semibold">Branch</span>
                      <span className="font-bold text-slate-900">{viewingPolicy.branchId || 'Head Office'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
