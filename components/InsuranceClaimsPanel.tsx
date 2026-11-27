import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Heart,
  Paperclip,
  Plus,
  Printer,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  UserCheck,
  Wallet,
  X
} from 'lucide-react';
import {
  ClaimLifecycleStage,
  InsuranceClaimRecord,
  LoanInsuranceRecord
} from '../types';
import {
  convertAdToBs,
  convertBsToAd,
  loanInsuranceService
} from '../services/loanInsuranceService';
import { microFinanceService, MFMember } from '../services/microFinanceService';
import { getDayEndedBlockMessage } from '../utils/dayEndLock';

interface InsuranceClaimsPanelProps {
  claims: InsuranceClaimRecord[];
  policies: LoanInsuranceRecord[];
  formatBranchLabel: (branchId?: string) => string;
  resolveAllowedBranchForSave: (candidate?: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  isDayEnded: boolean;
  currentUserName: string;
  onDataChanged: () => void;
  onPrintSettlementVoucher: (claim: InsuranceClaimRecord) => void;
}

const CLAIM_STAGES: ClaimLifecycleStage[] = [
  'Claim Submission',
  'Document Verification',
  'Evaluation',
  'Admin Approval',
  'Payout Disbursement',
  'Settlement Receipt'
];

const STAGE_SHORT_LABELS: Record<ClaimLifecycleStage, string> = {
  'Claim Submission': 'Submission',
  'Document Verification': 'Verification',
  Evaluation: 'Evaluation',
  'Admin Approval': 'Approval',
  'Payout Disbursement': 'Disbursement',
  'Settlement Receipt': 'Settled'
};

const CLAIM_CAUSE_OPTIONS = [
  'Natural Death',
  'Accidental Death',
  'Permanent Disability',
  'Critical Illness'
];

const SUPPORTING_DOCUMENT_CHECKLIST = [
  'Death Certificate / Medical Board Report',
  'Member & Nominee Citizenship Copy',
  'Original Loan Deed (कर्जा तमसुक)',
  'Insurance Policy Certificate',
  'Nominee Relation Certificate (नाता प्रमाणित)',
  'Ward Recommendation Letter (वडा सिफारिस)',
  'Hospital / Post-Mortem / Police Report'
];

const PAYOUT_METHODS: Array<'Direct Account Transfer' | 'Cheque' | 'Cash Voucher'> = [
  'Direct Account Transfer',
  'Cheque',
  'Cash Voucher'
];

interface ClaimFormState {
  insuranceRecordId: string;
  policyNo: string;
  memberId: string;
  memberName: string;
  citizenshipNo: string;
  loanAccountNo: string;
  branchId: string;
  claimCause: string;
  incidentDate: string;
  incidentDateBs: string;
  claimDate: string;
  claimDateBs: string;
  outstandingLoanAtClaim: number;
  claimAmountRequested: number;
  claimAmountApproved: number;
  disbursedAmount: number;
  payoutMethod: 'Direct Account Transfer' | 'Cheque' | 'Cash Voucher';
  insurerReferenceNo: string;
  deathCertificateNo: string;
  hospitalReportSummary: string;
  verifiedBy: string;
  approvedBy: string;
  remarks: string;
  supportingDocuments: string[];
  documentUrl: string;
  documentFiles: Record<string, { name: string; dataUrl: string }>;
}

const getTodayIso = () => new Date().toISOString().split('T')[0];

const getInitials = (name?: string): string => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const findMatchingMfMember = (
  policy: LoanInsuranceRecord | null,
  mfMembers: MFMember[]
): MFMember | null => {
  if (!policy || mfMembers.length === 0) return null;
  const norm = (val?: string) => (val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetId = norm(policy.memberId);
  const targetCit = norm(policy.citizenshipNo);
  const targetName = (policy.memberName || policy.name || '').trim().toLowerCase();
  return (
    mfMembers.find(m => targetId && norm(m.memberId) === targetId) ||
    mfMembers.find(m => targetCit && norm(m.citizenshipNo) === targetCit) ||
    mfMembers.find(m => targetName && (m.name || '').trim().toLowerCase() === targetName) ||
    null
  );
};

const createEmptyClaimForm = (defaultBranch: string, defaultVerifier = ''): ClaimFormState => {
  const today = getTodayIso();
  const todayBs = convertAdToBs(today);
  return {
    insuranceRecordId: '',
    policyNo: '',
    memberId: '',
    memberName: '',
    citizenshipNo: '',
    loanAccountNo: '',
    branchId: defaultBranch,
    claimCause: 'Natural Death',
    incidentDate: today,
    incidentDateBs: todayBs,
    claimDate: today,
    claimDateBs: todayBs,
    outstandingLoanAtClaim: 0,
    claimAmountRequested: 0,
    claimAmountApproved: 0,
    disbursedAmount: 0,
    payoutMethod: 'Direct Account Transfer',
    insurerReferenceNo: '',
    deathCertificateNo: '',
    hospitalReportSummary: '',
    verifiedBy: defaultVerifier,
    approvedBy: '',
    remarks: '',
    supportingDocuments: [],
    documentUrl: '',
    documentFiles: {}
  };
};

export const InsuranceClaimsPanel: React.FC<InsuranceClaimsPanelProps> = ({
  claims,
  policies,
  formatBranchLabel,
  resolveAllowedBranchForSave,
  canEdit,
  canDelete,
  isDayEnded,
  currentUserName,
  onDataChanged,
  onPrintSettlementVoucher
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROCESS' | 'APPROVED' | 'SETTLED' | 'REJECTED'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Full-Page Register / Edit / Verification Wizard state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [isVerifyingExistingClaim, setIsVerifyingExistingClaim] = useState(false);
  const [editingClaim, setEditingClaim] = useState<InsuranceClaimRecord | null>(null);
  const [policySearchTerm, setPolicySearchTerm] = useState('');
  const [claimForm, setClaimForm] = useState<ClaimFormState>(() =>
    createEmptyClaimForm(resolveAllowedBranchForSave(), currentUserName)
  );
  const [stepValidationError, setStepValidationError] = useState<string | null>(null);
  const [previewDocFile, setPreviewDocFile] = useState<{ title: string; name: string; dataUrl: string } | null>(null);
  const docFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Claim Detail modal state
  const [viewingClaim, setViewingClaim] = useState<InsuranceClaimRecord | null>(null);

  // Stage Advance modal state
  const [advancingClaim, setAdvancingClaim] = useState<InsuranceClaimRecord | null>(null);
  const [stageForm, setStageForm] = useState<{
    verifiedBy: string;
    insurerReferenceNo: string;
    claimAmountApproved: number;
    approvedBy: string;
    disbursedAmount: number;
    payoutMethod: 'Direct Account Transfer' | 'Cheque' | 'Cash Voucher';
    settlementVoucherNo: string;
    actionDate: string;
    actionDateBs: string;
    remarks: string;
  }>({
    verifiedBy: currentUserName,
    insurerReferenceNo: '',
    claimAmountApproved: 0,
    approvedBy: currentUserName,
    disbursedAmount: 0,
    payoutMethod: 'Direct Account Transfer',
    settlementVoucherNo: '',
    actionDate: getTodayIso(),
    actionDateBs: convertAdToBs(getTodayIso()),
    remarks: ''
  });

  // Reject Claim modal state
  const [rejectingClaim, setRejectingClaim] = useState<InsuranceClaimRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Inline delete confirm state
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => {
      setFeedback(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Summary metrics
  const metrics = useMemo(() => {
    const settled = claims.filter(c => c.status === 'Settled');
    const approved = claims.filter(c => c.status === 'Approved');
    const rejected = claims.filter(c => c.status === 'Rejected');
    const inProcess = claims.filter(
      c =>
        c.status === 'Submitted' ||
        c.status === 'Under Review' ||
        c.status === 'Submitted to Insurer' ||
        c.status === 'Approved'
    );
    const totalDisbursed = settled.reduce(
      (sum, c) => sum + (Number(c.disbursedAmount) || Number(c.claimAmountApproved) || 0),
      0
    );
    return {
      total: claims.length,
      inProcess: inProcess.length,
      approved: approved.length,
      settled: settled.length,
      rejected: rejected.length,
      totalDisbursed
    };
  }, [claims]);

  // Policy lookup map
  const policyByIdOrNo = useMemo(() => {
    const map = new Map<string, LoanInsuranceRecord>();
    policies.forEach(p => {
      if (p.id) map.set(String(p.id), p);
      if (p.policyNo) map.set(String(p.policyNo), p);
    });
    return map;
  }, [policies]);

  // Searchable policies inside Claim Registration form (searches Reports KYC records)
  const matchingPolicies = useMemo(() => {
    const q = policySearchTerm.trim().toLowerCase();
    const list = policies.filter(p => {
      const st = String(p.status || '').toLowerCase();
      return st !== 'rejected';
    });
    if (!q) return list.slice(0, 15);
    return list
      .filter(
        p =>
          (p.memberName || p.name || '').toLowerCase().includes(q) ||
          (p.policyNo || '').toLowerCase().includes(q) ||
          (p.citizenshipNo || '').toLowerCase().includes(q) ||
          (p.memberId || '').toLowerCase().includes(q) ||
          formatBranchLabel(p.branchId).toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [policies, policySearchTerm, formatBranchLabel]);

  // Micro-Finance members cache for photo/contact KYC enrichment
  const mfMembers = useMemo<MFMember[]>(() => {
    if (!isFormModalOpen && !viewingClaim) return [];
    try {
      return microFinanceService.getMembers();
    } catch {
      return [];
    }
  }, [isFormModalOpen, viewingClaim]);

  // Close full-page claim wizard or document preview on Escape
  useEffect(() => {
    if (!isFormModalOpen && !previewDocFile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewDocFile) {
          setPreviewDocFile(null);
        } else if (isFormModalOpen) {
          setIsFormModalOpen(false);
          setEditingClaim(null);
          setIsVerifyingExistingClaim(false);
          setStepValidationError(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFormModalOpen, previewDocFile]);

  // Filtered claims list
  const filteredClaims = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...claims]
      .filter(c => {
        if (statusFilter === 'IN_PROCESS') {
          if (
            c.status !== 'Submitted' &&
            c.status !== 'Under Review' &&
            c.status !== 'Submitted to Insurer' &&
            c.status !== 'Approved'
          ) {
            return false;
          }
        } else if (statusFilter === 'APPROVED') {
          if (c.status !== 'Approved') return false;
        } else if (statusFilter === 'SETTLED') {
          if (c.status !== 'Settled') return false;
        } else if (statusFilter === 'REJECTED') {
          if (c.status !== 'Rejected') return false;
        }

        if (!q) return true;
        return (
          (c.claimNo || '').toLowerCase().includes(q) ||
          (c.memberName || '').toLowerCase().includes(q) ||
          (c.policyNo || '').toLowerCase().includes(q) ||
          (c.citizenshipNo || '').toLowerCase().includes(q) ||
          (c.insurerReferenceNo || '').toLowerCase().includes(q) ||
          (c.claimCause || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [claims, searchQuery, statusFilter]);

  const linkedSelectedPolicy = useMemo(() => {
    if (!claimForm.insuranceRecordId && !claimForm.policyNo) return null;
    return (
      policyByIdOrNo.get(claimForm.insuranceRecordId) ||
      policyByIdOrNo.get(claimForm.policyNo) ||
      null
    );
  }, [claimForm.insuranceRecordId, claimForm.policyNo, policyByIdOrNo]);

  const linkedSelectedMfMember = useMemo(
    () => findMatchingMfMember(linkedSelectedPolicy, mfMembers),
    [linkedSelectedPolicy, mfMembers]
  );

  // Handlers
  const handleCloseClaimWizard = () => {
    setIsFormModalOpen(false);
    setEditingClaim(null);
    setIsVerifyingExistingClaim(false);
    setStepValidationError(null);
    setFormStep(1);
  };

  const handleOpenNewClaim = () => {
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    setEditingClaim(null);
    setIsVerifyingExistingClaim(false);
    setPolicySearchTerm('');
    setStepValidationError(null);
    setFormStep(1);
    setClaimForm(createEmptyClaimForm(resolveAllowedBranchForSave(), currentUserName));
    setIsFormModalOpen(true);
  };

  const populateFormFromClaim = (claim: InsuranceClaimRecord): ClaimFormState => ({
    insuranceRecordId: claim.insuranceRecordId || '',
    policyNo: claim.policyNo || '',
    memberId: claim.memberId || '',
    memberName: claim.memberName || '',
    citizenshipNo: claim.citizenshipNo || '',
    loanAccountNo: claim.loanAccountNo || '',
    branchId: claim.branchId || resolveAllowedBranchForSave(),
    claimCause: claim.claimCause || 'Natural Death',
    incidentDate: claim.incidentDate || getTodayIso(),
    incidentDateBs: claim.incidentDateBs || (claim.incidentDate ? convertAdToBs(claim.incidentDate) : ''),
    claimDate: claim.claimDate || getTodayIso(),
    claimDateBs: claim.claimDateBs || (claim.claimDate ? convertAdToBs(claim.claimDate) : ''),
    outstandingLoanAtClaim: Number(claim.outstandingLoanAtClaim) || 0,
    claimAmountRequested: Number(claim.claimAmountRequested) || 0,
    claimAmountApproved: Number(claim.claimAmountApproved) || 0,
    disbursedAmount: Number(claim.disbursedAmount) || 0,
    payoutMethod: claim.payoutMethod || 'Direct Account Transfer',
    insurerReferenceNo: claim.insurerReferenceNo || '',
    deathCertificateNo: claim.deathCertificateNo || '',
    hospitalReportSummary: claim.hospitalReportSummary || '',
    verifiedBy: claim.verifiedBy || currentUserName,
    approvedBy: claim.approvedBy || '',
    remarks: claim.remarks || '',
    supportingDocuments: Array.isArray(claim.supportingDocuments) ? [...claim.supportingDocuments] : [],
    documentUrl: claim.documentUrl || '',
    documentFiles: claim.documentFiles ? { ...claim.documentFiles } : {}
  });

  const handleOpenEditClaim = (claim: InsuranceClaimRecord, startAtStep: 1 | 2 = 1, verifyingMode = false) => {
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    setEditingClaim(claim);
    setIsVerifyingExistingClaim(verifyingMode);
    setPolicySearchTerm('');
    setStepValidationError(null);
    setFormStep(startAtStep);
    setClaimForm(populateFormFromClaim(claim));
    setIsFormModalOpen(true);
  };

  const handleSelectPolicyForClaim = (policy: LoanInsuranceRecord) => {
    const assured = Number(policy.sumAssured || policy.loanAmount || 0);
    const outstanding = Number(policy.outstandingBalance || policy.loanAmount || assured);
    setClaimForm(prev => ({
      ...prev,
      insuranceRecordId: policy.id,
      policyNo: policy.policyNo || '',
      memberId: policy.memberId || '',
      memberName: policy.memberName || policy.name || '',
      citizenshipNo: policy.citizenshipNo || '',
      loanAccountNo: policy.loanAccountNo || prev.loanAccountNo,
      branchId: resolveAllowedBranchForSave(policy.branchId),
      outstandingLoanAtClaim: outstanding,
      claimAmountRequested: assured
    }));
    setPolicySearchTerm('');
    setStepValidationError(null);
  };

  const handleToggleSupportingDoc = (docName: string) => {
    setClaimForm(prev => {
      const exists = prev.supportingDocuments.includes(docName);
      return {
        ...prev,
        supportingDocuments: exists
          ? prev.supportingDocuments.filter(d => d !== docName)
          : [...prev.supportingDocuments, docName]
      };
    });
  };

  const handleToggleAllSupportingDocs = () => {
    setClaimForm(prev => {
      const allChecked = SUPPORTING_DOCUMENT_CHECKLIST.every(d => prev.supportingDocuments.includes(d));
      return {
        ...prev,
        supportingDocuments: allChecked ? [] : [...SUPPORTING_DOCUMENT_CHECKLIST]
      };
    });
  };

  const handleDocFileUpload = (docName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
      setStepValidationError('PDF/फाइल साइज अधिकतम 2MB भित्र हुनुपर्दछ।');
      return;
    }
    setStepValidationError(null);

    const saveFilePayload = (dataUrl: string) => {
      setClaimForm(prev => {
        const nextDocs = prev.supportingDocuments.includes(docName)
          ? prev.supportingDocuments
          : [...prev.supportingDocuments, docName];
        const nextFiles = {
          ...prev.documentFiles,
          [docName]: { name: file.name, dataUrl }
        };
        return {
          ...prev,
          supportingDocuments: nextDocs,
          documentFiles: nextFiles,
          documentUrl: prev.documentUrl || dataUrl
        };
      });
    };

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            saveFilePayload(reader.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          saveFilePayload(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      } else {
        saveFilePayload(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDocFile = (docName: string) => {
    setClaimForm(prev => {
      const nextFiles = { ...prev.documentFiles };
      delete nextFiles[docName];
      const firstRemainingUrl = Object.values(nextFiles)[0]?.dataUrl || '';
      return {
        ...prev,
        documentFiles: nextFiles,
        documentUrl: prev.documentFiles[docName]?.dataUrl === prev.documentUrl ? firstRemainingUrl : prev.documentUrl
      };
    });
  };

  const handleProceedToVerificationStep = () => {
    if (!claimForm.memberName.trim() || !claimForm.policyNo.trim()) {
      setStepValidationError('कृपया पहिले ऋणी/पोलिसी खोजेर छान्नुहोस् वा सदस्यको नाम र पोलिसी नं. भर्नुहोस्।');
      return;
    }
    if (!claimForm.claimAmountRequested || claimForm.claimAmountRequested <= 0) {
      setStepValidationError('कृपया मान्य दाबी रकम (Requested Claim Amount) भर्नुहोस्।');
      return;
    }
    setStepValidationError(null);
    setFormStep(2);
  };

  const handleSaveClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    if (formStep === 1) {
      handleProceedToVerificationStep();
      return;
    }
    if (!claimForm.memberName.trim() || !claimForm.policyNo.trim()) {
      setStepValidationError('कृपया पोलिसी छान्नुहोस् वा सदस्यको नाम र पोलिसी नं. भर्नुहोस्।');
      return;
    }
    if (!claimForm.claimAmountRequested || claimForm.claimAmountRequested <= 0) {
      setStepValidationError('कृपया मान्य दाबी रकम (Claim Amount) भर्नुहोस्।');
      return;
    }

    try {
      const scopedBranch = resolveAllowedBranchForSave(claimForm.branchId);
      const firstUploadedUrl = Object.values(claimForm.documentFiles)[0]?.dataUrl || '';
      const resolvedPrimaryDocUrl = claimForm.documentUrl || firstUploadedUrl || undefined;
      const hasVerifiedDocs =
        claimForm.supportingDocuments.length > 0 || Object.keys(claimForm.documentFiles).length > 0;

      if (editingClaim && isVerifyingExistingClaim) {
        loanInsuranceService.advanceClaimStage(editingClaim.id, 'Document Verification', {
          verifiedBy: claimForm.verifiedBy.trim() || currentUserName,
          status: 'Under Review',
          supportingDocuments: claimForm.supportingDocuments,
          documentFiles: claimForm.documentFiles,
          documentUrl: resolvedPrimaryDocUrl,
          remarks: claimForm.remarks.trim() || editingClaim.remarks
        });
        showFeedback('success', `${editingClaim.claimNo} → Document Verification सफलतापूर्वक सम्पन्न गरियो।`);
      } else if (editingClaim) {
        loanInsuranceService.updateClaim(editingClaim.id, {
          insuranceRecordId: claimForm.insuranceRecordId,
          policyNo: claimForm.policyNo.trim(),
          memberId: claimForm.memberId.trim(),
          memberName: claimForm.memberName.trim(),
          citizenshipNo: claimForm.citizenshipNo.trim() || undefined,
          loanAccountNo: claimForm.loanAccountNo.trim() || undefined,
          branchId: scopedBranch,
          claimCause: claimForm.claimCause,
          incidentDate: claimForm.incidentDate || undefined,
          incidentDateBs: claimForm.incidentDateBs || undefined,
          claimDate: claimForm.claimDate || getTodayIso(),
          claimDateBs: claimForm.claimDateBs || undefined,
          outstandingLoanAtClaim: Number(claimForm.outstandingLoanAtClaim) || 0,
          claimAmountRequested: Number(claimForm.claimAmountRequested) || 0,
          claimAmountApproved: claimForm.claimAmountApproved > 0 ? claimForm.claimAmountApproved : editingClaim.claimAmountApproved,
          disbursedAmount: claimForm.disbursedAmount > 0 ? claimForm.disbursedAmount : editingClaim.disbursedAmount,
          payoutMethod: claimForm.payoutMethod,
          insurerReferenceNo: claimForm.insurerReferenceNo.trim() || undefined,
          deathCertificateNo: claimForm.deathCertificateNo.trim() || undefined,
          hospitalReportSummary: claimForm.hospitalReportSummary.trim() || undefined,
          verifiedBy: claimForm.verifiedBy.trim() || undefined,
          approvedBy: claimForm.approvedBy.trim() || undefined,
          remarks: claimForm.remarks.trim() || undefined,
          supportingDocuments: claimForm.supportingDocuments,
          documentUrl: resolvedPrimaryDocUrl,
          documentFiles: claimForm.documentFiles
        });
        showFeedback('success', `दाबी ${editingClaim.claimNo} सफलतापूर्वक अपडेट गरियो।`);
      } else {
        const created = loanInsuranceService.addClaim({
          insuranceRecordId: claimForm.insuranceRecordId,
          policyNo: claimForm.policyNo.trim(),
          memberId: claimForm.memberId.trim() || `MEM-${Date.now().toString().slice(-4)}`,
          memberName: claimForm.memberName.trim(),
          citizenshipNo: claimForm.citizenshipNo.trim() || undefined,
          loanAccountNo: claimForm.loanAccountNo.trim() || undefined,
          branchId: scopedBranch,
          claimCause: claimForm.claimCause,
          incidentDate: claimForm.incidentDate || undefined,
          incidentDateBs: claimForm.incidentDateBs || undefined,
          claimDate: claimForm.claimDate || getTodayIso(),
          claimDateBs: claimForm.claimDateBs || undefined,
          outstandingLoanAtClaim: Number(claimForm.outstandingLoanAtClaim) || 0,
          claimAmountRequested: Number(claimForm.claimAmountRequested) || 0,
          payoutMethod: claimForm.payoutMethod,
          insurerReferenceNo: claimForm.insurerReferenceNo.trim() || undefined,
          deathCertificateNo: claimForm.deathCertificateNo.trim() || undefined,
          hospitalReportSummary: claimForm.hospitalReportSummary.trim() || undefined,
          verifiedBy: hasVerifiedDocs ? claimForm.verifiedBy.trim() || currentUserName : undefined,
          remarks: claimForm.remarks.trim() || undefined,
          supportingDocuments: claimForm.supportingDocuments,
          documentUrl: resolvedPrimaryDocUrl,
          documentFiles: claimForm.documentFiles,
          lifecycleStage: hasVerifiedDocs ? 'Document Verification' : 'Claim Submission',
          status: hasVerifiedDocs ? 'Under Review' : 'Submitted'
        });
        showFeedback('success', `नयाँ बीमा दाबी ${created.claimNo} सफलतापूर्वक दर्ता गरियो।`);
      }
      handleCloseClaimWizard();
      onDataChanged();
    } catch (err) {
      setStepValidationError(err instanceof Error ? err.message : 'दाबी सेभ गर्न सकिएन।');
    }
  };

  // Stage Advance Modal
  const getNextStage = (claim: InsuranceClaimRecord): ClaimLifecycleStage | null => {
    if (claim.status === 'Rejected' || claim.status === 'Settled') return null;
    const idx = CLAIM_STAGES.indexOf(claim.lifecycleStage || 'Claim Submission');
    if (idx < 0 || idx >= CLAIM_STAGES.length - 1) return null;
    return CLAIM_STAGES[idx + 1];
  };

  const handleOpenAdvanceModal = (claim: InsuranceClaimRecord) => {
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    const nextStage = getNextStage(claim);
    // Open full-page Step 2 Document Verification directly when advancing to Verification
    if (nextStage === 'Document Verification') {
      handleOpenEditClaim(claim, 2, true);
      return;
    }
    const today = getTodayIso();
    setAdvancingClaim(claim);
    setStageForm({
      verifiedBy: claim.verifiedBy || currentUserName,
      insurerReferenceNo: claim.insurerReferenceNo || '',
      claimAmountApproved: Number(claim.claimAmountApproved) || Number(claim.claimAmountRequested) || 0,
      approvedBy: claim.approvedBy || currentUserName,
      disbursedAmount:
        Number(claim.disbursedAmount) ||
        Number(claim.claimAmountApproved) ||
        Number(claim.claimAmountRequested) ||
        0,
      payoutMethod: claim.payoutMethod || 'Direct Account Transfer',
      settlementVoucherNo:
        claim.settlementVoucherNo ||
        `VCH-CLM-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`,
      actionDate: today,
      actionDateBs: convertAdToBs(today),
      remarks: claim.remarks || ''
    });
  };

  const handleConfirmAdvanceStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advancingClaim || !canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    const nextStage = getNextStage(advancingClaim);
    if (!nextStage) return;

    const updates: Partial<InsuranceClaimRecord> = {
      remarks: stageForm.remarks.trim() || advancingClaim.remarks
    };

    if (nextStage === 'Document Verification') {
      updates.verifiedBy = stageForm.verifiedBy.trim() || currentUserName;
      updates.status = 'Under Review';
    } else if (nextStage === 'Evaluation') {
      updates.insurerReferenceNo = stageForm.insurerReferenceNo.trim() || advancingClaim.insurerReferenceNo;
      updates.status = 'Submitted to Insurer';
    } else if (nextStage === 'Admin Approval') {
      updates.claimAmountApproved = Number(stageForm.claimAmountApproved) || advancingClaim.claimAmountRequested;
      updates.approvedBy = stageForm.approvedBy.trim() || currentUserName;
      updates.status = 'Approved';
    } else if (nextStage === 'Payout Disbursement') {
      updates.disbursedAmount =
        Number(stageForm.disbursedAmount) ||
        advancingClaim.claimAmountApproved ||
        advancingClaim.claimAmountRequested;
      updates.payoutMethod = stageForm.payoutMethod;
      updates.disbursementDate = stageForm.actionDate;
      updates.disbursementDateBs = stageForm.actionDateBs || convertAdToBs(stageForm.actionDate);
      updates.status = 'Settled';
    } else if (nextStage === 'Settlement Receipt') {
      updates.settlementVoucherNo = stageForm.settlementVoucherNo.trim() || advancingClaim.settlementVoucherNo;
      updates.settlementDate = stageForm.actionDate;
      updates.settlementDateBs = stageForm.actionDateBs || convertAdToBs(stageForm.actionDate);
      updates.status = 'Settled';
    }

    try {
      loanInsuranceService.advanceClaimStage(advancingClaim.id, nextStage, updates);
      setAdvancingClaim(null);
      onDataChanged();
      showFeedback('success', `${advancingClaim.claimNo} → ${nextStage} चरणमा अपडेट गरियो।`);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'चरण अपडेट गर्न सकिएन।');
    }
  };

  // Reject Claim Handler
  const handleConfirmRejectClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingClaim || !canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    const reason = rejectionReason.trim();
    if (!reason) {
      showFeedback('error', 'कृपया दाबी अस्वीकृत (Reject) गर्नुको कारण लेख्नुहोस्।');
      return;
    }
    try {
      loanInsuranceService.updateClaim(rejectingClaim.id, {
        status: 'Rejected',
        remarks: `Rejected by ${currentUserName}: ${reason}`
      });
      setRejectingClaim(null);
      setRejectionReason('');
      onDataChanged();
      showFeedback('success', `दाबी ${rejectingClaim.claimNo} Rejected स्थितिमा अद्यावधिक गरियो।`);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'अपडेट गर्न सकिएन।');
    }
  };

  // Delete Claim Handler
  const handleConfirmDeleteClaim = (id: string) => {
    if (!canDelete || isDayEnded) return;
    try {
      loanInsuranceService.deleteClaim(id);
      setDeletingClaimId(null);
      onDataChanged();
      showFeedback('success', 'दाबी रेकर्ड हटाइयो।');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'दाबी हटाउन सकिएन।');
    }
  };

  // Export Claims Excel
  const handleExportClaimsExcel = () => {
    const rows = filteredClaims.map((c, idx) => ({
      SN: idx + 1,
      'Claim No': c.claimNo,
      'Policy No': c.policyNo,
      'Member Name': c.memberName,
      'Citizenship No': c.citizenshipNo || '',
      Branch: formatBranchLabel(c.branchId),
      Cause: c.claimCause,
      'Incident Date (BS)': c.incidentDateBs || '',
      'Incident Date (AD)': c.incidentDate || '',
      'Claim Date (BS)': c.claimDateBs || '',
      'Claim Date (AD)': c.claimDate || '',
      'Outstanding Loan (NPR)': Number(c.outstandingLoanAtClaim) || 0,
      'Requested Amount (NPR)': Number(c.claimAmountRequested) || 0,
      'Approved Amount (NPR)': Number(c.claimAmountApproved) || 0,
      'Disbursed Amount (NPR)': Number(c.disbursedAmount) || 0,
      'Payout Method': c.payoutMethod || '',
      'Insurer Ref No': c.insurerReferenceNo || '',
      'Settlement Voucher': c.settlementVoucherNo || '',
      Stage: c.lifecycleStage || 'Claim Submission',
      Status: c.status,
      Remarks: c.remarks || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InsuranceClaims');
    XLSX.writeFile(wb, `Insurance_Claims_${getTodayIso()}.xlsx`);
  };

  const getStatusStyle = (status: InsuranceClaimRecord['status']) => {
    if (status === 'Settled') {
      return { topBar: 'bg-emerald-600', text: 'text-emerald-700', dot: 'bg-emerald-600' };
    }
    if (status === 'Approved') {
      return { topBar: 'bg-blue-600', text: 'text-blue-700', dot: 'bg-blue-600' };
    }
    if (status === 'Rejected') {
      return { topBar: 'bg-rose-600', text: 'text-rose-700', dot: 'bg-rose-600' };
    }
    return { topBar: 'bg-amber-500', text: 'text-amber-700', dot: 'bg-amber-500' };
  };

  return (
    <div className="space-y-5">
      {/* ============================================================ */}
      {/* COOPERATIVE HEADER BANNER                                    */}
      {/* ============================================================ */}
      <section className="rounded-2xl bg-gradient-to-r from-[#015e52] via-[#036a5c] to-[#0f4c75] text-white px-5 py-4 sm:px-6 sm:py-4 border border-[#014d43] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
            Loan Insurance Claims
          </h2>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportClaimsExcel}
              disabled={filteredClaims.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : 'नयाँ बीमा दाबी दर्ता गर्नुहोस्'}
                onClick={handleOpenNewClaim}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#015e52] hover:bg-emerald-50 text-xs font-extrabold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Claim</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5 COLOR-CODED SUMMARY CARDS                                  */}
      {/* ============================================================ */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-[#015e52]" />
          <div className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Claims</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900 font-mono tabular-nums">{metrics.total}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/70 text-[#015e52] flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-amber-500" />
          <div className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">In Process</p>
              <p className="mt-1 text-xl font-extrabold text-amber-700 font-mono tabular-nums">{metrics.inProcess}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-emerald-600" />
          <div className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Settled</p>
              <p className="mt-1 text-xl font-extrabold text-emerald-700 font-mono tabular-nums">{metrics.settled}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-rose-600" />
          <div className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rejected</p>
              <p className="mt-1 text-xl font-extrabold text-rose-700 font-mono tabular-nums">{metrics.rejected}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/70 text-rose-700 flex items-center justify-center shrink-0">
              <Ban className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-blue-600" />
          <div className="p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Disbursed</p>
              <p className="mt-1 text-base sm:text-lg font-extrabold text-blue-700 font-mono tabular-nums truncate">
                NPR {metrics.totalDisbursed.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-700 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SEARCH & STATUS FILTER BAR                                   */}
      {/* ============================================================ */}
      <section className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Claim No, Policy No, Member Name वा Citizenship खोज्नुहोस्..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#015e52] focus:outline-none text-xs text-slate-800"
          />
        </div>

        <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 overflow-x-auto">
          {(
            [
              { id: 'ALL', label: `All (${metrics.total})` },
              { id: 'IN_PROCESS', label: `In Process (${metrics.inProcess})` },
              { id: 'APPROVED', label: `Approved (${metrics.approved})` },
              { id: 'SETTLED', label: `Settled (${metrics.settled})` },
              { id: 'REJECTED', label: `Rejected (${metrics.rejected})` }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap font-mono tabular-nums ${
                statusFilter === tab.id
                  ? 'bg-[#015e52] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* CLAIMS LIST & 6-STAGE LIFECYCLE TRACKER                      */}
      {/* ============================================================ */}
      <section className="space-y-4">
        {filteredClaims.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Heart className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-800">कुनै बीमा दाबी रेकर्ड भेटिएन</p>
            {canEdit && (
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleOpenNewClaim}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#015e52] hover:bg-[#014940] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Claim</span>
              </button>
            )}
          </div>
        ) : (
          filteredClaims.map(claim => {
            const stStyle = getStatusStyle(claim.status);
            const nextStage = getNextStage(claim);
            const isConfirmingDel = deletingClaimId === claim.id;

            return (
              <article
                key={claim.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
              >
                <div className={`h-1 ${stStyle.topBar}`} />
                <div className="p-4 sm:p-5 space-y-3">
                  {/* Main Claim Row */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono tabular-nums font-extrabold text-slate-900 text-sm">
                          {claim.claimNo}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${stStyle.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stStyle.dot}`} />
                          {claim.status}
                        </span>
                        {claim.insurerReferenceNo && (
                          <span className="text-xs font-mono text-slate-500">
                            · Ref: {claim.insurerReferenceNo}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        {claim.memberName}
                        <span className="font-normal text-slate-500 font-mono">
                          {' '}· {claim.policyNo} · {formatBranchLabel(claim.branchId)}
                        </span>
                      </div>
                    </div>

                    {/* Key Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cause</div>
                        <div className="font-bold text-rose-700 mt-0.5">{claim.claimCause}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Claim Date</div>
                        <div className="font-mono tabular-nums font-bold text-slate-800 mt-0.5">
                          {claim.claimDateBs || claim.claimDate}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Requested</div>
                        <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                          NPR {(Number(claim.claimAmountRequested) || 0).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {claim.status === 'Settled' ? 'Disbursed' : 'Approved'}
                        </div>
                        <div className="font-mono tabular-nums font-extrabold text-blue-700 mt-0.5">
                          {claim.status === 'Settled'
                            ? `NPR ${(Number(claim.disbursedAmount) || Number(claim.claimAmountApproved) || 0).toLocaleString()}`
                            : claim.claimAmountApproved
                            ? `NPR ${Number(claim.claimAmountApproved).toLocaleString()}`
                            : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingClaim(claim)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      {canEdit && nextStage && (
                        <button
                          type="button"
                          disabled={isDayEnded}
                          title={isDayEnded ? getDayEndedBlockMessage() : `Advance to ${nextStage}`}
                          onClick={() => handleOpenAdvanceModal(claim)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#015e52] hover:bg-[#014940] text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <span>Next: {STAGE_SHORT_LABELS[nextStage]}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {canEdit && claim.status !== 'Settled' && claim.status !== 'Rejected' && (
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => {
                            setRejectingClaim(claim);
                            setRejectionReason('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      )}

                      {(claim.status === 'Settled' || claim.lifecycleStage === 'Settlement Receipt') && (
                        <button
                          type="button"
                          onClick={() => onPrintSettlementVoucher(claim)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Voucher</span>
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => handleOpenEditClaim(claim)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer disabled:opacity-40"
                          title="Edit Claim"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => setDeletingClaimId(isConfirmingDel ? null : claim.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-40"
                          title="Delete Claim"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Delete Confirmation */}
                  {isConfirmingDel && (
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs">
                      <span className="font-semibold text-rose-800">
                        के यो दाबी रेकर्ड ({claim.claimNo}) स्थायी रूपमा हटाउने हो?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDeletingClaimId(null)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                        >
                          रद्द
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmDeleteClaim(claim.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                        >
                          हटाउनुहोस्
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* ============================================================ */}
      {/* FULL-PAGE CLAIM REGISTRATION & VERIFICATION WIZARD           */}
      {/* Step 1: Rini Search + Reports KYC + Claim Details            */}
      {/* Step 2: Document Verification (Tick + Individual Upload)     */}
      {/* ============================================================ */}
      {isFormModalOpen && (() => {
        const kycPhoto = linkedSelectedPolicy?.memberPhoto || linkedSelectedMfMember?.photoUrl || '';
        const kycMemberName = linkedSelectedPolicy?.memberName || linkedSelectedPolicy?.name || claimForm.memberName || 'Member';
        const kycMemberId = linkedSelectedPolicy?.memberId || linkedSelectedMfMember?.memberId || claimForm.memberId || '—';
        const kycCitizenship = linkedSelectedPolicy?.citizenshipNo || linkedSelectedMfMember?.citizenshipNo || claimForm.citizenshipNo || '—';
        const kycContact = linkedSelectedPolicy?.contactNumber || linkedSelectedMfMember?.mobile || '—';
        const kycAddress = linkedSelectedPolicy?.address || linkedSelectedMfMember?.address || '—';
        const kycGender = linkedSelectedPolicy?.gender || linkedSelectedMfMember?.gender || '—';
        const kycDobBs =
          linkedSelectedPolicy?.dateOfBirthBs ||
          (linkedSelectedPolicy?.dateOfBirth ? convertAdToBs(linkedSelectedPolicy.dateOfBirth) : '') ||
          '—';
        const kycBranch = formatBranchLabel(linkedSelectedPolicy?.branchId || claimForm.branchId);
        const kycStartBs =
          linkedSelectedPolicy?.policyStartDateBs ||
          (linkedSelectedPolicy?.policyStartDate ? convertAdToBs(linkedSelectedPolicy.policyStartDate) : '') ||
          linkedSelectedPolicy?.policyStartDate ||
          '—';
        const kycExpiryBs =
          linkedSelectedPolicy?.policyExpiryDateBs ||
          (linkedSelectedPolicy?.policyExpiryDate ? convertAdToBs(linkedSelectedPolicy.policyExpiryDate) : '') ||
          linkedSelectedPolicy?.policyExpiryDate ||
          '—';
        const uploadedFilesCount = Object.keys(claimForm.documentFiles).length;
        const allDocsTicked = SUPPORTING_DOCUMENT_CHECKLIST.every(d => claimForm.supportingDocuments.includes(d));

        return (
          <div className="fixed inset-0 z-[9999] bg-[#f4f7fa] flex flex-col overflow-hidden">
            {/* Sticky Full-Width Top Header Bar */}
            <header className="bg-[#015e52] text-white px-5 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-white/15 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-white/15 text-emerald-200 shrink-0">
                  {formStep === 1 ? <UserCheck className="w-5 h-5" /> : <FileCheck2 className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold tracking-tight text-white truncate">
                    {isVerifyingExistingClaim && editingClaim
                      ? `Claim Verification (${editingClaim.claimNo})`
                      : editingClaim
                      ? `Edit Claim (${editingClaim.claimNo})`
                      : 'Register New Claim'}
                  </h3>
                  {claimForm.memberName && (
                    <p className="text-[11px] text-emerald-100 font-medium truncate">
                      {claimForm.memberName} · <span className="font-mono">{claimForm.policyNo}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Top-Right Close Cross Button */}
              <button
                type="button"
                onClick={handleCloseClaimWizard}
                title="Close"
                aria-label="Close"
                className="p-2 rounded-xl bg-white/15 border border-white/25 hover:bg-rose-500 hover:border-rose-400 text-white cursor-pointer transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Scrollable Body */}
            <form onSubmit={handleSaveClaim} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-8">
                <div className="max-w-6xl mx-auto space-y-5">
                  {stepValidationError && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{stepValidationError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStepValidationError(null)}
                        className="p-1 text-rose-500 hover:text-rose-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {formStep === 1 ? (
                    /* ==================================================== */
                    /* STEP 1: RINI SEARCH + REPORTS KYC + CLAIM DETAILS    */
                    /* ==================================================== */
                    <div className="space-y-5">
                      {/* Rini Search Box (from Insurance Report Policies) */}
                      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 space-y-3">
                          <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={policySearchTerm}
                              onChange={e => setPolicySearchTerm(e.target.value)}
                              placeholder="ऋणीको नाम, Member ID, Policy No, Citizenship No वा Branch खोज्नुहोस्..."
                              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white focus:border-[#015e52] focus:outline-none text-xs font-semibold text-slate-900"
                            />
                            {policySearchTerm && (
                              <button
                                type="button"
                                onClick={() => setPolicySearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                                aria-label="Clear search"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {policySearchTerm.trim().length > 0 && (
                            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                              {matchingPolicies.length === 0 ? (
                                <div className="p-4 text-xs text-slate-400 text-center">
                                  कुनै ऋणी / पोलिसी भेटिएन।
                                </div>
                              ) : (
                                matchingPolicies.map(p => {
                                  const isPicked = claimForm.insuranceRecordId === p.id;
                                  const pMf = findMatchingMfMember(p, mfMembers);
                                  const pPhoto = p.memberPhoto || pMf?.photoUrl || '';
                                  const pName = p.memberName || p.name || 'Member';
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handleSelectPolicyForClaim(p)}
                                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                                        isPicked ? 'bg-emerald-50 text-emerald-950' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-lg bg-[#0b5cab] text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                                          {pPhoto ? (
                                            <img src={pPhoto} alt={pName} className="w-full h-full object-cover" />
                                          ) : (
                                            getInitials(pName)
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-bold text-slate-900 truncate flex items-center gap-2">
                                            <span>{pName}</span>
                                            {p.memberId && (
                                              <span className="font-mono text-[11px] font-bold text-[#015e52]">
                                                {p.memberId}
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[11px] text-slate-500 font-mono truncate">
                                            {p.policyNo} · {formatBranchLabel(p.branchId)}
                                            {p.citizenshipNo ? ` · Cit: ${p.citizenshipNo}` : ''}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <div className="font-mono tabular-nums font-extrabold text-[#0b5cab]">
                                          NPR {(Number(p.sumAssured || p.loanAmount) || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-500">{p.status || 'Active'}</div>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Main 2-Column Content: Left Reports Shortcut KYC Card + Right Claim Form */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Left Column (5 cols): Auto-Filled Reports Shortcut KYC Card */}
                        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                          <div className="bg-[#0b5cab] text-white px-5 py-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-emerald-300" />
                              <span className="text-xs font-extrabold uppercase tracking-wide">
                                Member Shortcut KYC (Report)
                              </span>
                            </div>
                            {linkedSelectedPolicy && (
                              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                                {linkedSelectedPolicy.status || 'Active'}
                              </span>
                            )}
                          </div>

                          {linkedSelectedPolicy ? (
                            <div className="p-5 space-y-4">
                              {/* Photo & Core IDs */}
                              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                                <div className="w-20 h-24 rounded-xl border-2 border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                                  {kycPhoto ? (
                                    <img src={kycPhoto} alt={kycMemberName} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-[#0b5cab] text-white flex items-center justify-center font-black text-xl">
                                      {getInitials(kycMemberName)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 space-y-1.5 flex-1">
                                  <h4 className="text-base font-black text-slate-900 truncate">{kycMemberName}</h4>
                                  <div className="text-xs font-mono font-bold text-[#015e52]">
                                    Member ID: {kycMemberId}
                                  </div>
                                  <div className="text-xs font-mono font-bold text-[#0b5cab]">
                                    Policy: {linkedSelectedPolicy.policyNo}
                                  </div>
                                  <div className="text-[11px] font-semibold text-slate-500">
                                    Branch: {kycBranch}
                                  </div>
                                </div>
                              </div>

                              {/* Compact KYC Key-Value Rows */}
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 gap-2">
                                  <span className="text-slate-500 font-semibold">Citizenship No</span>
                                  <span className="font-bold font-mono text-slate-900 text-right">{kycCitizenship}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 gap-2">
                                  <span className="text-slate-500 font-semibold">Contact No</span>
                                  <span className="font-bold font-mono text-slate-900 text-right">{kycContact}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 gap-2">
                                  <span className="text-slate-500 font-semibold">Gender / Age</span>
                                  <span className="font-bold text-slate-900 text-right">
                                    {kycGender}{linkedSelectedPolicy.age ? ` · ${linkedSelectedPolicy.age} yrs` : ''}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 gap-2">
                                  <span className="text-slate-500 font-semibold">DOB (BS)</span>
                                  <span className="font-bold font-mono text-slate-900 text-right">{kycDobBs}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 gap-2">
                                  <span className="text-slate-500 font-semibold">Address</span>
                                  <span className="font-bold text-slate-900 text-right truncate max-w-[180px]" title={kycAddress}>
                                    {kycAddress}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 gap-2">
                                  <span className="text-slate-500 font-semibold">Nominee</span>
                                  <span className="font-bold text-slate-900 text-right truncate max-w-[180px]">
                                    {linkedSelectedPolicy.nomineeName || '—'}
                                    {linkedSelectedPolicy.nomineeRelation ? ` (${linkedSelectedPolicy.nomineeRelation})` : ''}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 gap-2">
                                  <span className="text-slate-500 font-semibold">Sum Assured</span>
                                  <span className="font-bold font-mono text-[#0b5cab] text-right">
                                    NPR {(Number(linkedSelectedPolicy.sumAssured || linkedSelectedPolicy.loanAmount) || 0).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 gap-2">
                                  <span className="text-slate-500 font-semibold">Policy Period (BS)</span>
                                  <span className="font-bold font-mono text-slate-900 text-right">
                                    {kycStartBs} → {kycExpiryBs}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-8 text-center space-y-2">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                                <UserCheck className="w-5 h-5" />
                              </div>
                              <p className="text-xs font-bold text-slate-700">
                                माथिबाट ऋणी खोजेर छान्नुहोस्
                              </p>
                              <p className="text-[11px] text-slate-500">
                                छान्नेबित्तिकै Report को KYC (Photo, Member ID, Citizenship, Nominee) र दाबी विवरण स्वचालित भरिनेछ।
                              </p>
                            </div>
                          )}
                        </section>

                        {/* Right Column (7 cols): Auto-Filled Claim Registration Form */}
                        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
                              Claim Registration Details
                            </span>
                            {linkedSelectedPolicy && (
                              <span className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Auto-filled
                              </span>
                            )}
                          </div>

                          <div className="p-5 space-y-4">
                            {/* Member & Policy Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Member Name *</label>
                                <input
                                  type="text"
                                  required
                                  value={claimForm.memberName}
                                  onChange={e => setClaimForm(prev => ({ ...prev, memberName: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#015e52]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Member ID</label>
                                <input
                                  type="text"
                                  value={claimForm.memberId}
                                  onChange={e => setClaimForm(prev => ({ ...prev, memberId: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Policy No *</label>
                                <input
                                  type="text"
                                  required
                                  value={claimForm.policyNo}
                                  onChange={e => setClaimForm(prev => ({ ...prev, policyNo: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Citizenship No</label>
                                <input
                                  type="text"
                                  value={claimForm.citizenshipNo}
                                  onChange={e => setClaimForm(prev => ({ ...prev, citizenshipNo: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#015e52]"
                                />
                              </div>
                            </div>

                            {/* Cause & Dates */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Claim Cause *</label>
                                <select
                                  value={claimForm.claimCause}
                                  onChange={e => setClaimForm(prev => ({ ...prev, claimCause: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#015e52]"
                                >
                                  {CLAIM_CAUSE_OPTIONS.map(cause => (
                                    <option key={cause} value={cause}>
                                      {cause}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Incident Date (BS / AD)</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    type="text"
                                    value={claimForm.incidentDateBs}
                                    onChange={e => {
                                      const bs = e.target.value;
                                      const ad = convertBsToAd(bs);
                                      setClaimForm(prev => ({
                                        ...prev,
                                        incidentDateBs: bs,
                                        incidentDate: ad || prev.incidentDate
                                      }));
                                    }}
                                    placeholder="YYYY-MM-DD"
                                    className="px-2 py-2 rounded-xl border border-slate-300 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-[#015e52]"
                                  />
                                  <input
                                    type="date"
                                    value={claimForm.incidentDate}
                                    onChange={e => {
                                      const ad = e.target.value;
                                      setClaimForm(prev => ({
                                        ...prev,
                                        incidentDate: ad,
                                        incidentDateBs: convertAdToBs(ad) || prev.incidentDateBs
                                      }));
                                    }}
                                    className="px-2 py-2 rounded-xl border border-slate-300 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-[#015e52]"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Claim Date (BS / AD)</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    type="text"
                                    value={claimForm.claimDateBs}
                                    onChange={e => {
                                      const bs = e.target.value;
                                      const ad = convertBsToAd(bs);
                                      setClaimForm(prev => ({
                                        ...prev,
                                        claimDateBs: bs,
                                        claimDate: ad || prev.claimDate
                                      }));
                                    }}
                                    placeholder="YYYY-MM-DD"
                                    className="px-2 py-2 rounded-xl border border-slate-300 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-[#015e52]"
                                  />
                                  <input
                                    type="date"
                                    value={claimForm.claimDate}
                                    onChange={e => {
                                      const ad = e.target.value;
                                      setClaimForm(prev => ({
                                        ...prev,
                                        claimDate: ad,
                                        claimDateBs: convertAdToBs(ad) || prev.claimDateBs
                                      }));
                                    }}
                                    className="px-2 py-2 rounded-xl border border-slate-300 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-[#015e52]"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Financial Amounts & References */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Outstanding Loan (NPR)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={claimForm.outstandingLoanAtClaim || ''}
                                  onChange={e =>
                                    setClaimForm(prev => ({
                                      ...prev,
                                      outstandingLoanAtClaim: Number(e.target.value) || 0
                                    }))
                                  }
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#015e52]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Requested Claim Amount (NPR) *
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={claimForm.claimAmountRequested || ''}
                                  onChange={e =>
                                    setClaimForm(prev => ({
                                      ...prev,
                                      claimAmountRequested: Number(e.target.value) || 0
                                    }))
                                  }
                                  className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs font-mono font-extrabold text-blue-700 focus:outline-none focus:border-blue-600"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Death Cert / Medical Report No.
                                </label>
                                <input
                                  type="text"
                                  value={claimForm.deathCertificateNo}
                                  onChange={e => setClaimForm(prev => ({ ...prev, deathCertificateNo: e.target.value }))}
                                  placeholder="e.g. DC-2083-0124"
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#015e52]"
                                />
                              </div>
                            </div>

                            {/* Insurer Ref & Payout Method */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Insurer Reference No.</label>
                                <input
                                  type="text"
                                  value={claimForm.insurerReferenceNo}
                                  onChange={e => setClaimForm(prev => ({ ...prev, insurerReferenceNo: e.target.value }))}
                                  placeholder="e.g. NLI-CLM-2083-01"
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#015e52]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Preferred Payout Method</label>
                                <select
                                  value={claimForm.payoutMethod}
                                  onChange={e =>
                                    setClaimForm(prev => ({
                                      ...prev,
                                      payoutMethod: e.target.value as ClaimFormState['payoutMethod']
                                    }))
                                  }
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#015e52]"
                                >
                                  {PAYOUT_METHODS.map(m => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Remarks */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Incident Summary &amp; Remarks
                              </label>
                              <textarea
                                rows={2}
                                value={claimForm.remarks}
                                onChange={e => setClaimForm(prev => ({ ...prev, remarks: e.target.value }))}
                                placeholder="घटना विवरण वा अतिरिक्त टिपोट लेख्नुहोस्..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#015e52]"
                              />
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  ) : (
                    /* ==================================================== */
                    /* STEP 2: DOCUMENT VERIFICATION (TICK + UPLOAD)        */
                    /* ==================================================== */
                    <div className="space-y-5">
                      {/* Compact Member & Claim Summary Strip */}
                      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-14 rounded-xl bg-[#0b5cab] text-white font-black text-sm flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                            {kycPhoto ? (
                              <img src={kycPhoto} alt={kycMemberName} className="w-full h-full object-cover" />
                            ) : (
                              getInitials(claimForm.memberName)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-900 truncate">{claimForm.memberName}</div>
                            <div className="text-xs font-mono text-slate-600 truncate">
                              ID: {claimForm.memberId || '—'} · Policy: {claimForm.policyNo} · {kycBranch}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 text-xs">
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Cause</div>
                            <div className="font-bold text-rose-700 mt-0.5">{claimForm.claimCause}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Claim Date</div>
                            <div className="font-mono font-bold text-slate-800 mt-0.5">
                              {claimForm.claimDateBs || claimForm.claimDate}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Requested Amount</div>
                            <div className="font-mono font-extrabold text-[#0b5cab] text-sm mt-0.5">
                              NPR {(Number(claimForm.claimAmountRequested) || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Document Verification Checklist + Per-Document Upload */}
                      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <FileCheck2 className="w-4 h-4 text-[#015e52]" />
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                              Step 2 · Document Verification (Tick &amp; Upload)
                            </h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-[#015e52]">
                              {claimForm.supportingDocuments.length}/{SUPPORTING_DOCUMENT_CHECKLIST.length} Ticked
                            </span>
                            <span className="text-xs font-mono font-bold text-[#0b5cab]">
                              {uploadedFilesCount} Uploaded
                            </span>
                            <button
                              type="button"
                              onClick={handleToggleAllSupportingDocs}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              {allDocsTicked ? 'Uncheck All' : 'Tick All'}
                            </button>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {SUPPORTING_DOCUMENT_CHECKLIST.map((doc, idx) => {
                            const checked = claimForm.supportingDocuments.includes(doc);
                            const uploadedFile = claimForm.documentFiles[doc];
                            return (
                              <div
                                key={doc}
                                className={`px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                  checked ? 'bg-emerald-50/50' : 'bg-white hover:bg-slate-50/70'
                                }`}
                              >
                                {/* Tick Checkbox + Label */}
                                <label className="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggleSupportingDoc(doc)}
                                    className="w-4 h-4 mt-0.5 sm:mt-0 rounded border-slate-300 text-[#015e52] accent-[#015e52] cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className={`text-xs sm:text-sm font-bold ${checked ? 'text-emerald-950' : 'text-slate-800'}`}>
                                      <span className="font-mono text-slate-400 mr-2">{idx + 1}.</span>
                                      {doc}
                                    </div>
                                    {uploadedFile && (
                                      <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                                        <Paperclip className="w-3 h-3 shrink-0" />
                                        <span className="truncate max-w-[280px]">{uploadedFile.name}</span>
                                      </div>
                                    )}
                                  </div>
                                </label>

                                {/* Per-Document Upload / View / Remove Actions */}
                                <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                                  <input
                                    ref={el => {
                                      docFileInputRefs.current[doc] = el;
                                    }}
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={e => handleDocFileUpload(doc, e)}
                                    className="hidden"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => docFileInputRefs.current[doc]?.click()}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                                      uploadedFile
                                        ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                                        : 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#0b5cab]'
                                    }`}
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>{uploadedFile ? 'Replace' : 'Upload'}</span>
                                  </button>

                                  {uploadedFile && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewDocFile({
                                            title: doc,
                                            name: uploadedFile.name,
                                            dataUrl: uploadedFile.dataUrl
                                          })
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                                        title="View Uploaded Document"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>View</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveDocFile(doc)}
                                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                        title="Remove Uploaded File"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Verifier & Remarks Footer Inside Verification Card */}
                        <div className="p-5 bg-slate-50/70 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Verified By</label>
                            <input
                              type="text"
                              value={claimForm.verifiedBy}
                              onChange={e => setClaimForm(prev => ({ ...prev, verifiedBy: e.target.value }))}
                              placeholder={currentUserName}
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#015e52]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Verification Remarks</label>
                            <input
                              type="text"
                              value={claimForm.remarks}
                              onChange={e => setClaimForm(prev => ({ ...prev, remarks: e.target.value }))}
                              placeholder="कागजात जाँच टिप्पणी..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#015e52]"
                            />
                          </div>
                        </div>
                      </section>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Full-Width Bottom Action Bar */}
              <footer className="bg-white border-t border-slate-200 px-5 sm:px-8 py-3.5 shrink-0 flex items-center justify-between gap-3">
                <div>
                  {formStep === 1 ? (
                    <button
                      type="button"
                      onClick={handleCloseClaimWizard}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setStepValidationError(null);
                        setFormStep(1);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Step 1</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  {formStep === 1 ? (
                    <button
                      type="button"
                      onClick={handleProceedToVerificationStep}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#015e52] hover:bg-[#014940] text-white text-xs font-extrabold shadow-xs cursor-pointer transition-colors"
                    >
                      <span>Next: Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#015e52] hover:bg-[#014940] text-white text-xs font-extrabold shadow-xs cursor-pointer transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {isVerifyingExistingClaim
                          ? 'Complete Verification'
                          : editingClaim
                          ? 'Update Claim'
                          : 'Submit Claim'}
                      </span>
                    </button>
                  )}
                </div>
              </footer>
            </form>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* MODAL 2: ADVANCE CLAIM STAGE (With Stage-Specific Inputs)    */}
      {/* ============================================================ */}
      {advancingClaim && (() => {
        const nextStage = getNextStage(advancingClaim);
        if (!nextStage) return null;
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
              <div className="px-5 py-3.5 bg-[#015e52] text-white flex items-center justify-between">
                <h3 className="text-sm font-extrabold">
                  Advance {advancingClaim.claimNo} → {nextStage}
                </h3>
                <button
                  type="button"
                  onClick={() => setAdvancingClaim(null)}
                  className="p-1 rounded-lg text-emerald-100 hover:bg-white/15 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmAdvanceStage} className="p-5 space-y-3.5">
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs flex justify-between items-center">
                  <span className="font-bold text-slate-800">{advancingClaim.memberName}</span>
                  <span className="font-mono font-extrabold text-blue-700">
                    NPR {(Number(advancingClaim.claimAmountRequested) || 0).toLocaleString()}
                  </span>
                </div>

                {nextStage === 'Document Verification' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Verified By *</label>
                    <input
                      type="text"
                      required
                      value={stageForm.verifiedBy}
                      onChange={e => setStageForm(prev => ({ ...prev, verifiedBy: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:border-[#015e52]"
                    />
                  </div>
                )}

                {nextStage === 'Evaluation' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Insurer Reference No.</label>
                    <input
                      type="text"
                      value={stageForm.insurerReferenceNo}
                      onChange={e => setStageForm(prev => ({ ...prev, insurerReferenceNo: e.target.value }))}
                      placeholder="e.g. NLI-CLM-2083-102"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold focus:outline-none focus:border-[#015e52]"
                    />
                  </div>
                )}

                {nextStage === 'Admin Approval' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Approved Amount (NPR) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={stageForm.claimAmountApproved || ''}
                        onChange={e =>
                          setStageForm(prev => ({ ...prev, claimAmountApproved: Number(e.target.value) || 0 }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs font-mono font-extrabold text-blue-700 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Approved By *</label>
                      <input
                        type="text"
                        required
                        value={stageForm.approvedBy}
                        onChange={e => setStageForm(prev => ({ ...prev, approvedBy: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:border-[#015e52]"
                      />
                    </div>
                  </div>
                )}

                {nextStage === 'Payout Disbursement' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Disbursed Amount (NPR) *</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={stageForm.disbursedAmount || ''}
                          onChange={e =>
                            setStageForm(prev => ({ ...prev, disbursedAmount: Number(e.target.value) || 0 }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-emerald-300 text-xs font-mono font-extrabold text-emerald-700 focus:outline-none focus:border-[#015e52]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Payout Method</label>
                        <select
                          value={stageForm.payoutMethod}
                          onChange={e =>
                            setStageForm(prev => ({
                              ...prev,
                              payoutMethod: e.target.value as ClaimFormState['payoutMethod']
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:border-[#015e52]"
                        >
                          {PAYOUT_METHODS.map(m => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Disbursement Date (AD)</label>
                      <input
                        type="date"
                        value={stageForm.actionDate}
                        onChange={e =>
                          setStageForm(prev => ({
                            ...prev,
                            actionDate: e.target.value,
                            actionDateBs: convertAdToBs(e.target.value)
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#015e52]"
                      />
                    </div>
                  </div>
                )}

                {nextStage === 'Settlement Receipt' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Settlement Voucher No. *</label>
                      <input
                        type="text"
                        required
                        value={stageForm.settlementVoucherNo}
                        onChange={e => setStageForm(prev => ({ ...prev, settlementVoucherNo: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:border-[#015e52]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Settlement Date (AD)</label>
                      <input
                        type="date"
                        value={stageForm.actionDate}
                        onChange={e =>
                          setStageForm(prev => ({
                            ...prev,
                            actionDate: e.target.value,
                            actionDateBs: convertAdToBs(e.target.value)
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#015e52]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stage Remarks</label>
                  <textarea
                    rows={2}
                    value={stageForm.remarks}
                    onChange={e => setStageForm(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#015e52]"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAdvancingClaim(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#015e52] hover:bg-[#014940] text-white text-xs font-bold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm {STAGE_SHORT_LABELS[nextStage]}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* MODAL 3: REJECT CLAIM                                        */}
      {/* ============================================================ */}
      {rejectingClaim && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 bg-rose-700 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Reject Claim ({rejectingClaim.claimNo})</h3>
              <button
                type="button"
                onClick={() => setRejectingClaim(null)}
                className="p-1 rounded-lg text-rose-100 hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmRejectClaim} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                सदस्य: <span className="font-bold text-slate-900">{rejectingClaim.memberName}</span> ({rejectingClaim.policyNo})
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="दाबी अस्वीकृत गर्नुको स्पष्ट कारण लेख्नुहोस्..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-rose-600"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingClaim(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Confirm Reject</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: CLAIM DETAIL VIEWER (With Attachment Preview)       */}
      {/* ============================================================ */}
      {viewingClaim && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl my-auto max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-[#015e52] text-white flex items-center justify-between shrink-0">
              <h3 className="text-sm font-extrabold font-mono">
                {viewingClaim.claimNo} · {viewingClaim.memberName}
              </h3>
              <button
                type="button"
                onClick={() => setViewingClaim(null)}
                className="p-1 rounded-lg text-emerald-100 hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Policy No</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{viewingClaim.policyNo}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Branch</span>
                  <div className="font-bold text-slate-900 mt-0.5">{formatBranchLabel(viewingClaim.branchId)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Status / Stage</span>
                  <div className="font-bold text-blue-700 mt-0.5">
                    {viewingClaim.status} · {viewingClaim.lifecycleStage || 'Claim Submission'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Cause</span>
                  <div className="font-bold text-rose-700 mt-0.5">{viewingClaim.claimCause}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Incident Date</span>
                  <div className="font-mono font-bold text-slate-800 mt-0.5">
                    {viewingClaim.incidentDateBs || viewingClaim.incidentDate || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Claim Date</span>
                  <div className="font-mono font-bold text-slate-800 mt-0.5">
                    {viewingClaim.claimDateBs || viewingClaim.claimDate || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Requested</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    NPR {(Number(viewingClaim.claimAmountRequested) || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Approved</span>
                  <div className="font-mono font-bold text-blue-700 mt-0.5">
                    {viewingClaim.claimAmountApproved
                      ? `NPR ${Number(viewingClaim.claimAmountApproved).toLocaleString()}`
                      : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Disbursed</span>
                  <div className="font-mono font-bold text-emerald-700 mt-0.5">
                    {viewingClaim.disbursedAmount
                      ? `NPR ${Number(viewingClaim.disbursedAmount).toLocaleString()}`
                      : '—'}
                  </div>
                </div>
              </div>

              {(viewingClaim.verifiedBy || viewingClaim.approvedBy || viewingClaim.insurerReferenceNo || viewingClaim.settlementVoucherNo) && (
                <div className="grid grid-cols-2 gap-3 border border-slate-200 rounded-xl p-3.5">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Verified By</span>
                    <div className="font-semibold text-slate-800 mt-0.5">{viewingClaim.verifiedBy || '—'}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Approved By</span>
                    <div className="font-semibold text-slate-800 mt-0.5">{viewingClaim.approvedBy || '—'}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Insurer Ref No</span>
                    <div className="font-mono font-semibold text-slate-800 mt-0.5">
                      {viewingClaim.insurerReferenceNo || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Settlement Voucher</span>
                    <div className="font-mono font-semibold text-emerald-700 mt-0.5">
                      {viewingClaim.settlementVoucherNo || '—'}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-extrabold text-slate-800 mb-2">Verified Supporting Documents</div>
                {viewingClaim.supportingDocuments && viewingClaim.supportingDocuments.length > 0 ? (
                  <ul className="space-y-1.5">
                    {viewingClaim.supportingDocuments.map((doc, i) => {
                      const docFile = viewingClaim.documentFiles?.[doc];
                      return (
                        <li
                          key={`${viewingClaim.id}_doc_${i}`}
                          className="flex items-center justify-between gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-semibold truncate">{doc}</span>
                          </div>
                          {docFile && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDocFile({
                                    title: doc,
                                    name: docFile.name,
                                    dataUrl: docFile.dataUrl
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-emerald-300 text-[#0b5cab] hover:bg-blue-50 text-[11px] font-bold cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View</span>
                              </button>
                              <a
                                href={docFile.dataUrl}
                                download={docFile.name || `${viewingClaim.claimNo}_doc`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-bold"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-slate-400">कुनै कागजात चेक गरिएको छैन।</p>
                )}
              </div>

              {viewingClaim.documentUrl && (!viewingClaim.documentFiles || Object.keys(viewingClaim.documentFiles).length === 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800">Uploaded Claim File</span>
                    <a
                      href={viewingClaim.documentUrl}
                      download={`${viewingClaim.claimNo}_document`}
                      className="text-xs font-bold text-blue-700 hover:underline"
                    >
                      Download Attachment
                    </a>
                  </div>
                  {viewingClaim.documentUrl.startsWith('data:image/') && (
                    <img
                      src={viewingClaim.documentUrl}
                      alt="Claim supporting attachment"
                      className="max-h-64 rounded-xl border border-slate-200 object-contain bg-slate-50 w-full"
                    />
                  )}
                </div>
              )}

              {viewingClaim.remarks && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Remarks</div>
                  <p className="text-slate-700">{viewingClaim.remarks}</p>
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              {(viewingClaim.status === 'Settled' || viewingClaim.lifecycleStage === 'Settlement Receipt') && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingClaim;
                    setViewingClaim(null);
                    onPrintSettlementVoucher(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Settlement Voucher</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingClaim(null)}
                className="px-4 py-2 rounded-xl bg-[#015e52] text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* INLINE UPLOADED DOCUMENT PREVIEW LIGHTBOX                    */}
      {/* ============================================================ */}
      {previewDocFile && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/75 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 bg-[#015e52] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-extrabold truncate">{previewDocFile.title}</div>
                <div className="text-[11px] text-emerald-100 truncate">{previewDocFile.name}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewDocFile.dataUrl}
                  download={previewDocFile.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDocFile(null)}
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-rose-500 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-auto flex-1 bg-slate-50 flex items-center justify-center">
              {previewDocFile.dataUrl.startsWith('data:image/') ? (
                <img
                  src={previewDocFile.dataUrl}
                  alt={previewDocFile.title}
                  className="max-h-[70vh] max-w-full rounded-xl border border-slate-200 object-contain bg-white"
                />
              ) : (
                <div className="text-center space-y-3 py-10">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0b5cab] flex items-center justify-center mx-auto">
                    <FileText className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{previewDocFile.name}</p>
                  <a
                    href={previewDocFile.dataUrl}
                    download={previewDocFile.name}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#015e52] text-white text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
