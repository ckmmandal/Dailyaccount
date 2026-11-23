import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { toBsDateString } from '../services/supabaseService';
import { supabase } from '../services/supabase';
import { LedgerAccount, CapitalizationFrequency, DailyData, ReceivablePayableEntry, Employee, Branch } from '../types';
import { 
  Plus, Search, Landmark, Trash2, Edit2, X, Save, 
  ShieldCheck, Phone, MapPin, AlertCircle, CheckCircle2,
  Building2, User, Eye, Percent, List, Camera, Calendar,
  CreditCard, Info, Printer, ArrowDownCircle, ArrowUpCircle, Calculator,
  UserPlus, RefreshCw, Users, AlertTriangle, Link as LinkIcon,
  Mail, Send, Download, XCircle, FileText, Check
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { useAuth } from '../AuthContext';
import { NepaliDatePicker } from './NepaliDatePicker';
import NepaliDate from 'nepali-date-converter';
import { getStoredSmtpConfig, generateElementPdfBase64, sendPaySlipApi, sendLedgerNotificationEmailApi } from '../services/pdfEmailService';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

interface StatementRow {
  sn: number;
  date: string;
  particulars: string;
  debit: number;
  credit: number;
  accrued: number;
  cap: number;
  balance: number;
  branchName?: string;
  type: 'transaction' | 'accrual' | 'cap' | 'opening';
  originalTx?: ReceivablePayableEntry;
  dayKey?: string;
  sourceBranchId?: string;
}

interface BreakdownEntry {
  id?: string;
  particulars: string;
  narration: string;
  type: 'in' | 'out';
  amount: number;
  dateBs: string;
  isReadOnly?: boolean;
  sourceBranchId?: string;
  branchName?: string;
  originalTx?: ReceivablePayableEntry;
  dayKey?: string;
  statementRow?: StatementRow;
}

const LedgerManagement: React.FC = () => {
  const { branch, user, settings } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filter, setFilter] = useState('');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string } | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<LedgerAccount | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [auditRange, setAuditRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [newAccount, setNewAccount] = useState<Partial<LedgerAccount>>({
    name: '', type: 'Customer', interestRate: 0, mobile: '', email: '', address: '',
    openingBalance: 0, status: 'Active', capitalizationFrequency: 'None', 
    capitalizeToPrincipal: true, photoUrl: '', createdAt: Date.now(),
    employeeId: '', employeeBranchId: '', employeeCode: ''
  });

  const [adCreateDate, setAdCreateDate] = useState(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const [allGlobalData, setAllGlobalData] = useState<Record<string, DailyData>>({});

  const [sendingEmailAccId, setSendingEmailAccId] = useState<string | null>(null);
  const [showEmailSuccessModal, setShowEmailSuccessModal] = useState(false);

  // Email Statement Modal state
  const [emailModal, setEmailModal] = useState<{
    isOpen: boolean;
    account: LedgerAccount | null;
    toEmail: string;
    recipientName: string;
    subject: string;
    body: string;
    isSending: boolean;
    isGeneratingPdf: boolean;
    statusMsg: { type: 'success' | 'error'; text: string } | null;
  }>({
    isOpen: false,
    account: null,
    toEmail: '',
    recipientName: '',
    subject: '',
    body: '',
    isSending: false,
    isGeneratingPdf: false,
    statusMsg: null
  });

  // Statement row edit & delete state
  const [editModalRow, setEditModalRow] = useState<StatementRow | null>(null);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<StatementRow | null>(null);
  const [editForm, setEditForm] = useState<{
    dateBs: string;
    particulars: string;
    amount: string;
    type: 'in' | 'out';
  }>({
    dateBs: '',
    particulars: '',
    amount: '',
    type: 'out'
  });

  // Breakdown modal state (matching image design with Nepali words)
  const [breakdownModal, setBreakdownModal] = useState<{
    isOpen: boolean;
    title: string;
    dateBs: string;
    entries: BreakdownEntry[];
    editingId: string | null;
    editingForm: {
      particulars: string;
      narration: string;
      type: 'in' | 'out';
      amount: string;
    };
  }>({
    isOpen: false,
    title: '',
    dateBs: '',
    entries: [],
    editingId: null,
    editingForm: {
      particulars: '',
      narration: '',
      type: 'out',
      amount: ''
    }
  });

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const branchMap = useMemo(() => {
    const m: Record<string, string> = { main: 'Head Office' };
    branches.forEach(b => {
      m[b.id] = b.name;
      if (b.code) m[b.code] = b.name;
    });
    return m;
  }, [branches]);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const [accs, emps, bList, globalData] = await Promise.all([
        storageService.getLedgerAccounts(branch?.id),
        storageService.getEmployees().catch(() => []),
        storageService.getBranches().catch(() => []),
        storageService.getAllData().catch(() => ({}))
      ]);
      setAccounts(accs || []);
      setEmployees(emps || []);
      setBranches(bList || []);
      setAllGlobalData(globalData || {});
    } catch (err) {
      console.warn("Notice loading ledger data:", err);
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  }, [branch]);

  useEffect(() => {
    loadData();

    const handleSyncEvent = () => {
      loadData(false);
    };

    window.addEventListener('storage', handleSyncEvent);
    window.addEventListener('dailyDataChanged', handleSyncEvent);
    window.addEventListener('account_balance_updated', handleSyncEvent);
    window.addEventListener('ledger_data_updated', handleSyncEvent);
    window.addEventListener('focus', handleSyncEvent);
    document.addEventListener('visibilitychange', handleSyncEvent);

    return () => {
      window.removeEventListener('storage', handleSyncEvent);
      window.removeEventListener('dailyDataChanged', handleSyncEvent);
      window.removeEventListener('account_balance_updated', handleSyncEvent);
      window.removeEventListener('ledger_data_updated', handleSyncEvent);
      window.removeEventListener('focus', handleSyncEvent);
      document.removeEventListener('visibilitychange', handleSyncEvent);
    };
  }, [loadData]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAccount(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStaffImport = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const bName = branchMap[emp.branchId || 'main'] || emp.branchId || 'Head Office';
      setNewAccount(prev => ({
        ...prev,
        name: emp.fullName,
        mobile: emp.mobile,
        email: emp.email || prev.email || '',
        address: `${emp.department || 'Staff'} • ${emp.designation || 'Employee'} (${bName})`,
        photoUrl: emp.photoUrl || prev.photoUrl,
        employeeId: emp.id,
        employeeBranchId: emp.branchId || 'main',
        employeeCode: emp.employeeCode || ''
      }));
    }
  };

  const handleAdd = async () => {
    if (!newAccount.name) return;
    if (isDayEndedForBranch(newAccount.branchId || branch?.id)) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(adCreateDate, settings)) {
      setErrorMsg(getBackDateBlockedMessage(adCreateDate));
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      let finalEmpBranchId = newAccount.employeeBranchId;
      let finalEmpId = newAccount.employeeId;
      let finalEmpCode = newAccount.employeeCode;
      
      const matchedEmp = employees.find(e => 
        (finalEmpId && e.id === finalEmpId) ||
        (finalEmpCode && e.employeeCode && e.employeeCode.trim().toLowerCase() === finalEmpCode.trim().toLowerCase()) ||
        (e.fullName && newAccount.name && e.fullName.trim().toLowerCase() === newAccount.name.trim().toLowerCase())
      );
      if (matchedEmp) {
        if (!finalEmpId) finalEmpId = matchedEmp.id;
        if (!finalEmpBranchId) finalEmpBranchId = matchedEmp.branchId || 'main';
        if (!finalEmpCode) finalEmpCode = matchedEmp.employeeCode || '';
      }

      const timestamp = new Date(adCreateDate).getTime();
      const account: LedgerAccount = {
        ...newAccount,
        id: newAccount.id || crypto.randomUUID(),
        branchId: newAccount.branchId || branch?.id || 'main',
        createdAt: isNaN(timestamp) ? Date.now() : timestamp,
        employeeId: finalEmpId || undefined,
        employeeBranchId: finalEmpBranchId || undefined,
        employeeCode: finalEmpCode || undefined
      } as LedgerAccount;
      
      await storageService.saveLedgerAccount(account);
      await storageService.saveLog(
        user?.id || 'sys', 
        account.id === newAccount.id ? 'UPDATE_LEDGER' : 'CREATE_LEDGER', 
        `Account: ${account.name} (Linked Emp: ${account.employeeId || 'None'})`, 
        branch?.id || 'main'
      );
      
      const updatedAccounts = await storageService.getLedgerAccounts(branch?.id);
      setAccounts(updatedAccounts || []);
      setShowAdd(false);
      resetForm();
    } catch (err: any) {
      console.error("Failed to save ledger account:", err);
      setErrorMsg(err.message || 'Error occurred while saving ledger account.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (acc: LedgerAccount) => {
    setNewAccount(acc);
    const adDate = new Date(acc.createdAt).toISOString().split('T')[0];
    setAdCreateDate(adDate);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    if (isDayEndedForBranch(branch?.id)) {
      setErrorMsg(getDayEndedBlockMessage());
      setConfirmDelete(null);
      return;
    }
    const { id } = confirmDelete;
    try {
      await storageService.deleteLedgerAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      await storageService.saveLog(user?.id || 'sys', 'DELETE_LEDGER', `ID: ${id}`, branch?.id).catch(() => {});
      const updatedAccounts = await storageService.getLedgerAccounts(branch?.id);
      setAccounts((updatedAccounts || []).filter(a => a.id !== id));
      setStatusToast('Ledger account deleted successfully!');
      setTimeout(() => setStatusToast(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete ledger account.';
      setStatusToast(msg);
      setTimeout(() => setStatusToast(null), 3500);
    } finally {
      setConfirmDelete(null);
    }
  };

  const resetForm = () => {
    setNewAccount({
        name: '', type: 'Customer', interestRate: 0, mobile: '', email: '', address: '',
        openingBalance: 0, status: 'Active', capitalizationFrequency: 'None', 
        capitalizeToPrincipal: true, photoUrl: '', createdAt: Date.now(),
        employeeId: '', employeeBranchId: '', employeeCode: ''
    });
    setAdCreateDate(new Date().toISOString().split('T')[0]);
    setErrorMsg(null);
    setStaffSearchQuery('');
  };

  const handleToggleStatus = async (acc: LedgerAccount, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isDayEndedForBranch(acc.branchId || branch?.id)) {
      setStatusToast(getDayEndedBlockMessage());
      setTimeout(() => setStatusToast(null), 3500);
      return;
    }
    const nextStatus = acc.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const updated = { ...acc, status: nextStatus };
      await storageService.saveLedgerAccount(updated);
      setAccounts(prev => prev.map(a => a.id === acc.id ? updated : a));
      await storageService.saveLog(
        user?.id || 'sys', 
        'UPDATE_LEDGER', 
        `Toggled status of ${acc.name} to ${nextStatus}`, 
        branch?.id || 'main'
      );
      setStatusToast(`Account status updated: ${acc.name} -> ${nextStatus}`);
      setTimeout(() => setStatusToast(null), 3500);
    } catch (err: any) {
      console.error("Failed to toggle status:", err);
      setStatusToast(err.message || 'Failed to update status.');
      setTimeout(() => setStatusToast(null), 3500);
    }
  };

  const handleDirectEmailSend = async (acc: LedgerAccount) => {
    if (sendingEmailAccId) return;

    const latestGlobalData = await storageService.getAllData().catch(() => ({}));
    const dataToUse = latestGlobalData || allGlobalData;
    setAllGlobalData(dataToUse);

    // Look up recipient email from linked employee or account
    let recipientEmail = '';
    if (acc.employeeId) {
      const linkedEmp = employees.find(e => e.id === acc.employeeId || e.employeeCode === acc.employeeCode);
      if (linkedEmp && linkedEmp.email) {
        recipientEmail = linkedEmp.email;
      }
    }

    const defaultSubject = `Account Statement - ${acc.name} | RATAULI SACCOS`;
    const defaultBody = 
`आदरणीय ${acc.name} ज्यू,

तपाईंको लेजर खाताको  विवरण यस ईमेलमा संलग्न  गरी PDF फाइल मार्फत पठाइएको छ।

धन्यवाद,
रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
पिपरा गाउँपालिका-६, रतौली, महोत्तरी`;

    // If no recipient email is configured on this employee, open the modal so user can enter email
    if (!recipientEmail || !recipientEmail.trim()) {
      setEmailModal({
        isOpen: true,
        account: acc,
        toEmail: '',
        recipientName: acc.name,
        subject: defaultSubject,
        body: defaultBody,
        isSending: false,
        isGeneratingPdf: false,
        statusMsg: { type: 'error', text: 'खातावालाको ईमेल फेला परेन। कृपया ईमेल ठेगाना राखेर पठाउनुहोस्।' }
      });
      return;
    }

    // Prepare state for rendering the hidden statement container
    setEmailModal({
      isOpen: false,
      account: acc,
      toEmail: recipientEmail,
      recipientName: acc.name,
      subject: defaultSubject,
      body: defaultBody,
      isSending: true,
      isGeneratingPdf: false,
      statusMsg: null
    });
    setSendingEmailAccId(acc.id);

    try {
      // Wait a microtask for DOM render of hidden statement target
      await new Promise(res => setTimeout(res, 120));
      const element = document.getElementById('ledger-statement-pdf-target');
      if (!element) {
        throw new Error('Statement element could not be prepared.');
      }

      const pdfBase64 = await generateElementPdfBase64(element);
      const filename = `Statement_${acc.name.replace(/\s+/g, '_')}_${new NepaliDate().format('YYYY-MM-DD')}.pdf`;

      const res = await sendPaySlipApi({
        to: recipientEmail.trim(),
        subject: defaultSubject,
        body: defaultBody,
        pdfBase64,
        filename,
        smtpConfig: getStoredSmtpConfig()
      });

      if (res.success) {
        setShowEmailSuccessModal(true);
        setStatusToast(`स्टेटमेन्ट PDF ${recipientEmail} मा सफलतापूर्वक पठाइयो!`);
        setTimeout(() => setStatusToast(null), 4000);
      } else {
        // Show modal with error to allow retry
        setEmailModal({
          isOpen: true,
          account: acc,
          toEmail: recipientEmail,
          recipientName: acc.name,
          subject: defaultSubject,
          body: defaultBody,
          isSending: false,
          isGeneratingPdf: false,
          statusMsg: { type: 'error', text: res.message || 'ईमेल पठाउन सकिएन।' }
        });
      }
    } catch (err: any) {
      console.error('Instant Email Send Error:', err);
      setEmailModal({
        isOpen: true,
        account: acc,
        toEmail: recipientEmail,
        recipientName: acc.name,
        subject: defaultSubject,
        body: defaultBody,
        isSending: false,
        isGeneratingPdf: false,
        statusMsg: { type: 'error', text: 'ईमेल सर्भर त्रुटि: ' + (err.message || 'Failed') }
      });
    } finally {
      setSendingEmailAccId(null);
    }
  };

  const handleOpenEmailModal = async (acc: LedgerAccount) => {
    const latestGlobalData = await storageService.getAllData().catch(() => ({}));
    const dataToUse = latestGlobalData || allGlobalData;
    setAllGlobalData(dataToUse);

    // Look up recipient email from linked employee or account
    let recipientEmail = '';
    if (acc.employeeId) {
      const linkedEmp = employees.find(e => e.id === acc.employeeId || e.employeeCode === acc.employeeCode);
      if (linkedEmp && linkedEmp.email) {
        recipientEmail = linkedEmp.email;
      }
    }

    const defaultSubject = `Account Statement - ${acc.name} | RATAULI SACCOS`;
    const defaultBody = 
`आदरणीय ${acc.name} ज्यू,

तपाईंको लेजर खाताको  विवरण यस ईमेलमा संलग्न  गरी PDF फाइल मार्फत पठाइएको छ।

धन्यवाद,
रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
पिपरा गाउँपालिका-६, रतौली, महोत्तरी`;

    setEmailModal({
      isOpen: true,
      account: acc,
      toEmail: recipientEmail,
      recipientName: acc.name,
      subject: defaultSubject,
      body: defaultBody,
      isSending: false,
      isGeneratingPdf: false,
      statusMsg: null
    });
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('ledger-statement-pdf-target');
    if (!element || !emailModal.account) return;
    setEmailModal(prev => ({ ...prev, isGeneratingPdf: true }));
    try {
      const pdfDataUri = await generateElementPdfBase64(element);
      const link = document.createElement('a');
      link.href = pdfDataUri;
      link.download = `Statement_${(emailModal.account.name || 'Account').replace(/\s+/g, '_')}_${new NepaliDate().format('YYYY-MM-DD')}.pdf`;
      link.click();
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      alert('PDF डाउनलोड गर्न सकिएन: ' + (err.message || 'Error'));
    } finally {
      setEmailModal(prev => ({ ...prev, isGeneratingPdf: false }));
    }
  };

  const handleSendEmailStatement = async () => {
    if (!emailModal.toEmail || !emailModal.toEmail.trim()) {
      setEmailModal(prev => ({ ...prev, statusMsg: { type: 'error', text: 'कृपया प्रापकको ईमेल ठेगाना प्रविष्ट गर्नुहोस्।' } }));
      return;
    }
    if (!emailModal.account) return;

    const element = document.getElementById('ledger-statement-pdf-target');
    if (!element) {
      setEmailModal(prev => ({ ...prev, statusMsg: { type: 'error', text: 'स्टेटमेन्ट कागजात फेला परेन।' } }));
      return;
    }

    setEmailModal(prev => ({ ...prev, isSending: true, statusMsg: null }));
    try {
      const pdfBase64 = await generateElementPdfBase64(element);
      const filename = `Statement_${emailModal.account.name.replace(/\s+/g, '_')}_${new NepaliDate().format('YYYY-MM-DD')}.pdf`;
      
      const res = await sendPaySlipApi({
        to: emailModal.toEmail.trim(),
        subject: emailModal.subject,
        body: emailModal.body,
        pdfBase64,
        filename,
        smtpConfig: getStoredSmtpConfig()
      });

      if (res.success) {
        setEmailModal(prev => ({
          ...prev,
          isOpen: false,
          isSending: false,
          statusMsg: null
        }));
        setShowEmailSuccessModal(true);
      } else {
        setEmailModal(prev => ({
          ...prev,
          isSending: false,
          statusMsg: { type: 'error', text: res.message || 'ईमेल पठाउन सकिएन।' }
        }));
      }
    } catch (err: any) {
      console.error('Email Send Error:', err);
      setEmailModal(prev => ({
        ...prev,
        isSending: false,
        statusMsg: { type: 'error', text: 'ईमेल सर्भर त्रुटि: ' + (err.message || 'Failed') }
      }));
    }
  };

  const handleOpenStatement = async (acc: LedgerAccount) => {
    setSelectedAccount(acc);
    const latestGlobalData = await storageService.getAllData().catch(() => ({}));
    const dataToUse = latestGlobalData || allGlobalData;
    setAllGlobalData(dataToUse);

    let earliestBs = new NepaliDate(new Date(acc.createdAt)).format('YYYY-MM-DD');
    Object.values(dataToUse).forEach(day => {
      (day.transactions || []).forEach(tx => {
        const isMatch = (tx.accountId && tx.accountId === acc.id) || 
          (tx.description && tx.description.trim().toUpperCase() === acc.name.trim().toUpperCase());
        if (isMatch && tx.date) {
          const txBs = toBsDateString(tx.date);
          if (txBs < earliestBs) earliestBs = txBs;
        }
      });
    });

    const todayBs = new NepaliDate().format('YYYY-MM-DD');
    setAuditRange({
      start: earliestBs,
      end: todayBs
    });
    setShowStatement(true);
  };

  const computeAccountBalance = (acc: LedgerAccount, globalData: Record<string, DailyData>): number => {
    if (!acc) return 0;
    
    const targetNameUpper = (acc.name || '').trim().toUpperCase();
    const targetId = acc.id;
    const targetEmpId = acc.employeeId;
    const targetEmpCodeUpper = (acc.employeeCode || '').trim().toUpperCase();

    const transactions: { type: 'in' | 'out'; amount: number; date: string }[] = [];

    Object.values(globalData).forEach(day => {
      (day.transactions || []).forEach(tx => {
        const txDescUpper = (tx.description || '').trim().toUpperCase();
        const txRemarksUpper = (tx.remarks || '').trim().toUpperCase();
        const isMatch = (
          (tx.accountId && (tx.accountId === targetId || (targetEmpId && tx.accountId === targetEmpId))) ||
          (txDescUpper && (txDescUpper === targetNameUpper || (targetEmpCodeUpper && txDescUpper === targetEmpCodeUpper))) ||
          (txRemarksUpper && (txRemarksUpper === targetNameUpper || (targetEmpCodeUpper && txRemarksUpper === targetEmpCodeUpper)))
        );
        if (isMatch) {
          transactions.push({
            type: tx.type,
            amount: Number(tx.amount) || 0,
            date: tx.date || ''
          });
        }
      });
    });

    const creationBs = new NepaliDate(new Date(acc.createdAt || Date.now())).format('YYYY-MM-DD');
    let calcStartBs = creationBs;
    transactions.forEach(t => {
      if (t.date) {
        const tBs = toBsDateString(t.date);
        if (tBs < calcStartBs) calcStartBs = tBs;
      }
    });

    let currentBalance = Number(acc.openingBalance ?? (acc as any).initialBalance ?? 0) || 0;
    let accumulatedInterest = 0;

    if (!acc.interestRate || acc.interestRate <= 0) {
      transactions.forEach(tx => {
        if (tx.type === 'in') currentBalance += tx.amount;
        else currentBalance -= tx.amount;
      });
      return currentBalance;
    }

    let simDate = new NepaliDate(calcStartBs);
    const today = new NepaliDate();
    const creationDateAd = new Date(acc.createdAt || Date.now()).toISOString().split('T')[0];

    while (simDate.toJsDate().getTime() <= today.toJsDate().getTime()) {
      const jsDate = simDate.toJsDate();
      const adDateStr = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;
      const bsDateStr = simDate.format('YYYY-MM-DD');

      const dayTxs = transactions.filter(t => {
        if (!t.date) return false;
        const tBs = toBsDateString(t.date);
        return t.date === adDateStr || t.date === bsDateStr || tBs === bsDateStr;
      });

      dayTxs.forEach(tx => {
        if (tx.type === 'in') currentBalance += tx.amount;
        else currentBalance -= tx.amount;
      });

      if (adDateStr >= creationDateAd) {
        const dailyRate = (acc.interestRate / 100) / 365;
        const dailyInterest = currentBalance * dailyRate;
        accumulatedInterest += dailyInterest;
      }

      const nextDay = new NepaliDate(simDate.toJsDate().getTime() + 86400000);
      let shouldCap = false;
      if (acc.capitalizationFrequency === 'Monthly' && nextDay.getMonth() !== simDate.getMonth()) shouldCap = true;
      if (acc.capitalizationFrequency === 'Yearly' && nextDay.getYear() !== simDate.getYear()) shouldCap = true;

      if (shouldCap && acc.capitalizeToPrincipal && accumulatedInterest > 0) {
        currentBalance += accumulatedInterest;
        accumulatedInterest = 0;
      }

      simDate = nextDay;
    }

    return currentBalance + accumulatedInterest;
  };

  const accountsWithBalance = useMemo(() => {
    const list = accounts.map(acc => ({
      ...acc,
      closingBalance: computeAccountBalance(acc, allGlobalData)
    }));

    // Sort: accounts with highest absolute balance magnitude on top
    return list.sort((a, b) => {
      const absA = Math.abs(a.closingBalance);
      const absB = Math.abs(b.closingBalance);
      if (absB !== absA) return absB - absA;
      return a.name.localeCompare(b.name);
    });
  }, [accounts, allGlobalData]);

  const vaultTotals = useMemo(() => {
    let totalPayable = 0;
    let totalReceivable = 0;
    accountsWithBalance.forEach(acc => {
      if (acc.closingBalance > 0) {
        totalPayable += acc.closingBalance;
      } else if (acc.closingBalance < 0) {
        totalReceivable += Math.abs(acc.closingBalance);
      }
    });
    return { totalPayable, totalReceivable };
  }, [accountsWithBalance]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return accountsWithBalance;
    const q = filter.toLowerCase();
    return accountsWithBalance.filter(a => 
      a.name.toLowerCase().includes(q) || 
      (a.mobile && a.mobile.includes(q)) ||
      (a.address && a.address.toLowerCase().includes(q)) ||
      (a.employeeCode && a.employeeCode.toLowerCase().includes(q))
    );
  }, [accountsWithBalance, filter]);

  const canManageStatementTransactions = useMemo(() => {
    if (!user) return false;
    if (user.role === 'superadmin' || user.role === 'admin' || user.role === 'manager') return true;
    if (user.permissions?.includes('edit_transaction') || user.permissions?.includes('delete_transaction')) return true;
    return false;
  }, [user]);

  const formatBalanceDrCr = (amount: number): { text: string; isDr: boolean; isCr: boolean; isZero: boolean; rawAmount: string } => {
    const abs = Math.abs(amount || 0);
    const formatted = `रू ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (amount < 0) {
      return { text: `${formatted} Dr`, isDr: true, isCr: false, isZero: false, rawAmount: formatted };
    } else if (amount > 0) {
      return { text: `${formatted} Cr`, isDr: false, isCr: true, isZero: false, rawAmount: formatted };
    }
    return { text: 'रू 0.00', isDr: false, isCr: false, isZero: true, rawAmount: 'रू 0.00' };
  };

  const statementData = useMemo(() => {
    if (!selectedAccount) return { rows: [], kpis: { opening: 0, accrued: 0, principal: 0, balance: 0 } };

    const transactions: (ReceivablePayableEntry & { sourceBranch?: string; dayKey?: string })[] = [];
    const targetNameUpper = selectedAccount.name.trim().toUpperCase();
    const targetId = selectedAccount.id;
    const targetEmpId = selectedAccount.employeeId;
    const targetEmpCodeUpper = (selectedAccount.employeeCode || '').trim().toUpperCase();

    Object.entries(allGlobalData).forEach(([dateKey, day]) => {
      (day.transactions || []).forEach(tx => {
        const txDescUpper = (tx.description || '').trim().toUpperCase();
        const txRemarksUpper = (tx.remarks || '').trim().toUpperCase();
        const isMatch = (
          (tx.accountId && (tx.accountId === targetId || (targetEmpId && tx.accountId === targetEmpId))) ||
          (txDescUpper && (txDescUpper === targetNameUpper || (targetEmpCodeUpper && txDescUpper === targetEmpCodeUpper))) ||
          (txRemarksUpper && (txRemarksUpper === targetNameUpper || (targetEmpCodeUpper && txRemarksUpper === targetEmpCodeUpper)))
        );
        if (isMatch) {
          transactions.push({
            ...tx,
            dayKey: dateKey || tx.date,
            sourceBranch: day.branchId || tx.branchId || 'main'
          });
        }
      });
    });

    const initialOpening = Number(selectedAccount.openingBalance ?? (selectedAccount as any).initialBalance ?? 0) || 0;
    const creationBs = new NepaliDate(new Date(selectedAccount.createdAt)).format('YYYY-MM-DD');

    let calcStartBs = creationBs;
    if (transactions.length > 0) {
      const allTxDates = transactions.map(t => toBsDateString(t.date || '')).filter(Boolean).sort();
      if (allTxDates.length > 0) {
        if (initialOpening === 0) {
          calcStartBs = allTxDates[0];
        } else if (allTxDates[0] < calcStartBs) {
          calcStartBs = allTxDates[0];
        }
      }
    }

    const rows: StatementRow[] = [];
    let currentPrincipal = initialOpening;
    let currentBalance = initialOpening;
    let accumulatedInterest = 0;
    let sn = 1;

    let simDate = new NepaliDate(calcStartBs);
    const today = new NepaliDate();
    const creationDateAd = new Date(selectedAccount.createdAt).toISOString().split('T')[0];

    // Only inject opening balance row if there is a non-zero opening balance OR if there are no transactions at all
    if (initialOpening !== 0 || transactions.length === 0) {
      rows.push({
        sn: sn++,
        date: creationBs,
        particulars: 'OPENING BALANCE (प्रारम्भिक मौज्दात)',
        debit: initialOpening < 0 ? Math.abs(initialOpening) : 0,
        credit: initialOpening > 0 ? initialOpening : 0,
        accrued: 0, cap: 0,
        balance: currentBalance,
        branchName: branchMap[selectedAccount.branchId] || 'Head Office',
        type: 'opening',
        sourceBranchId: selectedAccount.branchId
      });
    }

    while (simDate.toJsDate().getTime() <= today.toJsDate().getTime()) {
      const jsDate = simDate.toJsDate();
      const adDateStr = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;
      const bsDateStr = simDate.format('YYYY-MM-DD');
      
      const dayTxs = transactions.filter(t => {
        if (!t.date) return false;
        const tBs = toBsDateString(t.date);
        return t.date === adDateStr || t.date === bsDateStr || tBs === bsDateStr;
      });
      
      if (dayTxs.length > 0 && accumulatedInterest > 0) {
        rows.push({
          sn: sn++,
          date: bsDateStr,
          particulars: 'INTEREST ACCRUED (ब्याज गणना)',
          debit: 0, credit: 0, accrued: accumulatedInterest, cap: 0,
          balance: currentBalance,
          branchName: 'System Calculation',
          type: 'accrual'
        });
        accumulatedInterest = 0;
      }

      dayTxs.forEach(tx => {
        if (tx.type === 'in') currentBalance += tx.amount;
        else currentBalance -= tx.amount;

        const bName = branchMap[tx.sourceBranch || 'main'] || tx.sourceBranch || 'Branch';

        rows.push({
          sn: sn++,
          date: bsDateStr,
          particulars: tx.remarks || (tx.type === 'in' ? 'CASH RECEIVED (नगद प्राप्त)' : 'CASH PAYMENT / ADVANCE (भुक्तानी)'),
          debit: tx.type === 'out' ? tx.amount : 0,
          credit: tx.type === 'in' ? tx.amount : 0,
          accrued: 0, cap: 0,
          balance: currentBalance,
          branchName: bName,
          type: 'transaction',
          originalTx: tx,
          dayKey: (tx as any).dayKey || tx.date || bsDateStr,
          sourceBranchId: (tx as any).sourceBranch || tx.branchId || 'main'
        });
      });

      if (adDateStr >= creationDateAd) {
        const dailyRate = (selectedAccount.interestRate / 100) / 365;
        const dailyInterest = currentBalance * dailyRate;
        accumulatedInterest += dailyInterest;
      }

      const nextDay = new NepaliDate(simDate.toJsDate().getTime() + 86400000);
      
      let shouldCap = false;
      if (selectedAccount.capitalizationFrequency === 'Monthly' && nextDay.getMonth() !== simDate.getMonth()) shouldCap = true;
      if (selectedAccount.capitalizationFrequency === 'Yearly' && nextDay.getYear() !== simDate.getYear()) shouldCap = true;

      if (shouldCap && selectedAccount.capitalizeToPrincipal && accumulatedInterest > 0) {
        currentBalance += accumulatedInterest;
        currentPrincipal = currentBalance;
        rows.push({
          sn: sn++,
          date: bsDateStr,
          particulars: 'INTEREST CAPITALIZED (ब्याज पुँजीकरण)',
          debit: 0, credit: 0, accrued: 0, cap: accumulatedInterest,
          balance: currentBalance,
          branchName: 'System Calculation',
          type: 'cap'
        });
        accumulatedInterest = 0;
      }
      simDate = nextDay;
    }

    if (accumulatedInterest > 0) {
      rows.push({
        sn: sn++,
        date: today.format('YYYY-MM-DD'),
        particulars: 'INTEREST ACCRUED TO DATE (हालसम्मको ब्याज)',
        debit: 0, credit: 0, accrued: accumulatedInterest, cap: 0,
        balance: currentBalance,
        branchName: 'System Calculation',
        type: 'accrual'
      });
    }

    const startBs = toBsDateString(auditRange.start);
    const endBs = toBsDateString(auditRange.end);
    const filteredRows = rows
      .filter(r => r.date >= startBs && r.date <= endBs)
      .map((r, idx) => ({ ...r, sn: idx + 1 }));

    return { 
      rows: filteredRows, 
      kpis: { 
        opening: initialOpening, 
        accrued: accumulatedInterest, 
        principal: currentPrincipal, 
        balance: currentBalance + accumulatedInterest 
      } 
    };
  }, [selectedAccount, allGlobalData, auditRange, branchMap]);

  const emailStatementData = useMemo(() => {
    const acc = emailModal.account;
    if (!acc) return { rows: [], kpis: { opening: 0, accrued: 0, principal: 0, balance: 0, totalDebit: 0, totalCredit: 0 } };

    const transactions: (ReceivablePayableEntry & { sourceBranch?: string; dayKey?: string })[] = [];
    const targetNameUpper = acc.name.trim().toUpperCase();
    const targetId = acc.id;
    const targetEmpId = acc.employeeId;
    const targetEmpCodeUpper = (acc.employeeCode || '').trim().toUpperCase();

    Object.entries(allGlobalData).forEach(([dateKey, day]) => {
      (day.transactions || []).forEach(tx => {
        const txDescUpper = (tx.description || '').trim().toUpperCase();
        const txRemarksUpper = (tx.remarks || '').trim().toUpperCase();
        const isMatch = (
          (tx.accountId && (tx.accountId === targetId || (targetEmpId && tx.accountId === targetEmpId))) ||
          (txDescUpper && (txDescUpper === targetNameUpper || (targetEmpCodeUpper && txDescUpper === targetEmpCodeUpper))) ||
          (txRemarksUpper && (txRemarksUpper === targetNameUpper || (targetEmpCodeUpper && txRemarksUpper === targetEmpCodeUpper)))
        );
        if (isMatch) {
          transactions.push({
            ...tx,
            dayKey: dateKey || tx.date,
            sourceBranch: day.branchId || tx.branchId || 'main'
          });
        }
      });
    });

    const initialOpening = Number(acc.openingBalance ?? (acc as any).initialBalance ?? 0) || 0;
    const creationBs = new NepaliDate(new Date(acc.createdAt || Date.now())).format('YYYY-MM-DD');

    let calcStartBs = creationBs;
    if (transactions.length > 0) {
      const allTxDates = transactions.map(t => toBsDateString(t.date || '')).filter(Boolean).sort();
      if (allTxDates.length > 0) {
        if (initialOpening === 0) {
          calcStartBs = allTxDates[0];
        } else if (allTxDates[0] < calcStartBs) {
          calcStartBs = allTxDates[0];
        }
      }
    }

    const rows: StatementRow[] = [];
    let currentPrincipal = initialOpening;
    let currentBalance = initialOpening;
    let accumulatedInterest = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let sn = 1;

    let simDate = new NepaliDate(calcStartBs);
    const today = new NepaliDate();
    const creationDateAd = new Date(acc.createdAt || Date.now()).toISOString().split('T')[0];

    if (initialOpening !== 0 || transactions.length === 0) {
      rows.push({
        sn: sn++,
        date: creationBs,
        particulars: 'OPENING BALANCE (प्रारम्भिक मौज्दात)',
        debit: initialOpening < 0 ? Math.abs(initialOpening) : 0,
        credit: initialOpening > 0 ? initialOpening : 0,
        accrued: 0, cap: 0,
        balance: currentBalance,
        branchName: branchMap[acc.branchId] || 'Head Office',
        type: 'opening',
        sourceBranchId: acc.branchId
      });
    }

    while (simDate.toJsDate().getTime() <= today.toJsDate().getTime()) {
      const jsDate = simDate.toJsDate();
      const adDateStr = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;
      const bsDateStr = simDate.format('YYYY-MM-DD');
      
      const dayTxs = transactions.filter(t => {
        if (!t.date) return false;
        const tBs = toBsDateString(t.date);
        return t.date === adDateStr || t.date === bsDateStr || tBs === bsDateStr;
      });
      
      if (dayTxs.length > 0 && accumulatedInterest > 0) {
        rows.push({
          sn: sn++,
          date: bsDateStr,
          particulars: 'INTEREST ACCRUED',
          debit: 0, credit: 0, accrued: accumulatedInterest, cap: 0,
          balance: currentBalance,
          branchName: 'System Calculation',
          type: 'accrual'
        });
        accumulatedInterest = 0;
      }

      dayTxs.forEach(tx => {
        if (tx.type === 'in') {
          currentBalance += tx.amount;
          totalCredit += tx.amount;
        } else {
          currentBalance -= tx.amount;
          totalDebit += tx.amount;
        }

        const bName = branchMap[tx.sourceBranch || 'main'] || tx.sourceBranch || 'Branch';

        rows.push({
          sn: sn++,
          date: bsDateStr,
          particulars: tx.remarks || (tx.type === 'in' ? 'CASH RECEIVED' : 'CASH PAYMENT / ADVANCE'),
          debit: tx.type === 'out' ? tx.amount : 0,
          credit: tx.type === 'in' ? tx.amount : 0,
          accrued: 0, cap: 0,
          balance: currentBalance,
          branchName: bName,
          type: 'transaction',
          originalTx: tx,
          dayKey: (tx as any).dayKey || tx.date || bsDateStr,
          sourceBranchId: (tx as any).sourceBranch || tx.branchId || 'main'
        });
      });

      if (adDateStr >= creationDateAd) {
        const dailyRate = (Number(acc.interestRate || 0) / 100) / 365;
        const dailyInterest = currentBalance * dailyRate;
        accumulatedInterest += dailyInterest;
      }

      const nextDay = new NepaliDate(simDate.toJsDate().getTime() + 86400000);
      
      let shouldCap = false;
      if (acc.capitalizationFrequency === 'Monthly' && nextDay.getMonth() !== simDate.getMonth()) shouldCap = true;
      if (acc.capitalizationFrequency === 'Yearly' && nextDay.getYear() !== simDate.getYear()) shouldCap = true;

      if (shouldCap && acc.capitalizeToPrincipal && accumulatedInterest > 0) {
        currentBalance += accumulatedInterest;
        currentPrincipal = currentBalance;
        rows.push({
          sn: sn++,
          date: bsDateStr,
          particulars: 'INTEREST CAPITALIZED',
          debit: 0, credit: 0, accrued: 0, cap: accumulatedInterest,
          balance: currentBalance,
          branchName: 'System Calculation',
          type: 'cap'
        });
        accumulatedInterest = 0;
      }
      simDate = nextDay;
    }

    if (accumulatedInterest > 0) {
      rows.push({
        sn: sn++,
        date: today.format('YYYY-MM-DD'),
        particulars: 'INTEREST ACCRUED TO DATE',
        debit: 0, credit: 0, accrued: accumulatedInterest, cap: 0,
        balance: currentBalance,
        branchName: 'System Calculation',
        type: 'accrual'
      });
    }

    return { 
      rows, 
      kpis: { 
        opening: initialOpening, 
        accrued: accumulatedInterest, 
        principal: currentPrincipal, 
        balance: currentBalance + accumulatedInterest,
        totalDebit,
        totalCredit
      } 
    };
  }, [emailModal.account, allGlobalData, branchMap]);

  const sendStatementNotification = async ({
    account,
    txType,
    amount,
    particular,
    dateBs,
    actionType,
    prevBalance,
    newBalance,
    oldAmount,
    oldParticular
  }: {
    account: LedgerAccount;
    txType: 'in' | 'out';
    amount: number;
    particular: string;
    dateBs: string;
    actionType: 'edit' | 'delete';
    prevBalance: number;
    newBalance: number;
    oldAmount?: number;
    oldParticular?: string;
  }) => {
    const linkedEmp = (employees || []).find(e => 
      (account.employeeId && e.id === account.employeeId) ||
      (account.id && account.id.startsWith('staff_') && e.id === account.id.replace('staff_', '')) ||
      (account.employeeCode && e.employeeCode && e.employeeCode.trim().toUpperCase() === account.employeeCode.trim().toUpperCase()) ||
      (e.fullName && e.fullName.trim().toUpperCase() === (account.name || '').trim().toUpperCase()) ||
      (e.employeeCode && e.employeeCode.trim().toUpperCase() === (account.name || '').trim().toUpperCase())
    );
    const targetEmail = (account.email || linkedEmp?.email || '').trim();
    if (!targetEmail) {
      return;
    }

    const sysSettings = await storageService.getSystemSettings().catch(() => null);
    const balanceType: 'payable' | 'receivable' | 'balanced' = 
      newBalance > 0 ? 'receivable' : newBalance < 0 ? 'payable' : 'balanced';

    try {
      const res = await sendLedgerNotificationEmailApi({
        to: targetEmail,
        recipientName: account.name,
        employeeCode: linkedEmp?.employeeCode || account.employeeCode,
        transactionType: txType,
        amount,
        particular: particular || (actionType === 'delete' ? 'Cancelled Ledger Entry' : 'Updated Ledger Entry'),
        dateBs: dateBs || new NepaliDate().format('YYYY-MM-DD'),
        dateAd: new Date().toISOString().split('T')[0],
        branchName: branch?.name || 'Head Office',
        tellerName: user?.fullName || 'Ledger Administrator',
        voucherId: `LEDGER-${actionType.toUpperCase()}-${Date.now().toString().slice(-6)}`,
        previousBalance: prevBalance,
        updatedBalance: newBalance,
        balanceType,
        actionType,
        oldAmount,
        oldParticular,
        companyName: sysSettings?.systemName || "Ratauli Saving and Credit Cooperative Ltd",
        companyAddress: sysSettings?.address || "Pipra Rural Municipality -6 (Mahottari)",
        logoUrl: sysSettings?.logoUrl
      });

      if (res.success) {
        setStatusToast(`ईमेल सूचना सफलतापूर्वक पठाइयो: ${targetEmail}`);
        setTimeout(() => setStatusToast(null), 4500);
      }
    } catch (emailErr) {
      console.error("Error sending ledger notification email:", emailErr);
    }
  };

  const handleEditStatementRow = (row: StatementRow) => {
    if (row.type === 'accrual' || row.type === 'cap') return;
    setEditModalRow(row);
    setEditForm({
      dateBs: row.date,
      particulars: row.originalTx?.remarks || (row.type === 'opening' ? 'OPENING BALANCE (प्रारम्भिक मौज्दात)' : row.particulars) || '',
      amount: (row.debit > 0 ? row.debit : (row.credit > 0 ? row.credit : (row.type === 'opening' ? row.balance : 0))).toString(),
      type: row.debit > 0 ? 'out' : (row.credit > 0 ? 'in' : (row.originalTx?.type || 'out'))
    });
  };

  const handleSaveStatementEdit = async () => {
    if (!editModalRow || !selectedAccount) return;
    if (isDayEndedForBranch(editModalRow.sourceBranchId || selectedAccount.branchId || branch?.id)) {
      setStatusToast(getDayEndedBlockMessage());
      setTimeout(() => setStatusToast(null), 3500);
      return;
    }
    const checkDate = editForm.dateBs || editModalRow.date;
    if (isBackDateBlockedForEntry(checkDate, settings)) {
      setStatusToast(getBackDateBlockedMessage(checkDate));
      setTimeout(() => setStatusToast(null), 3500);
      return;
    }
    setIsSubmittingAction(true);
    try {
      const amt = parseFloat(editForm.amount);
      if (isNaN(amt) || amt < 0) {
        alert("Please enter a valid amount");
        setIsSubmittingAction(false);
        return;
      }

      const isTx = editModalRow.type === 'transaction' && !!editModalRow.originalTx;
      const prevBalance = computeAccountBalance(selectedAccount, allGlobalData);
      const oldTx = editModalRow.originalTx;
      const oldAmt = Number(oldTx?.amount) || 0;
      const oldRemarks = oldTx?.remarks || oldTx?.description || '';

      if (editModalRow.type === 'opening') {
        let newTimestamp = selectedAccount.createdAt;
        try {
          if (editForm.dateBs) {
            const npDate = new NepaliDate(editForm.dateBs);
            newTimestamp = npDate.toJsDate().getTime();
          }
        } catch (e) {
          console.warn("Date parse warning:", e);
        }

        const updatedAccount: LedgerAccount = {
          ...selectedAccount,
          openingBalance: amt,
          createdAt: newTimestamp
        };

        await storageService.saveLedgerAccount(updatedAccount);
        setSelectedAccount(updatedAccount);
        setAccounts(prev => prev.map(a => a.id === updatedAccount.id ? updatedAccount : a));
      } else if (editModalRow.type === 'transaction' && editModalRow.originalTx) {
        const targetTx = editModalRow.originalTx;
        const originalDateKey = editModalRow.dayKey || targetTx.date || editModalRow.date;
        const targetBranchId = editModalRow.sourceBranchId || targetTx.branchId || branch?.id || 'main';
        const newDateBs = editForm.dateBs || editModalRow.date;

        const originalDayData = await storageService.getDayData(originalDateKey, targetBranchId);
        
        if (originalDayData) {
          if (originalDateKey === newDateBs) {
            const updatedTxs = (originalDayData.transactions || []).map(t => {
              const isMatch = (t.id && targetTx.id && t.id === targetTx.id) || 
                              (t === targetTx) || 
                              (Number(t.amount) === Number(targetTx.amount) && t.description === targetTx.description);
              if (isMatch) {
                return {
                  ...t,
                  amount: amt,
                  type: editForm.type,
                  remarks: editForm.particulars,
                  date: newDateBs
                };
              }
              return t;
            });
            await storageService.saveDayData(originalDateKey, targetBranchId, {
              ...originalDayData,
              transactions: updatedTxs
            });
          } else {
            const remainingTxs = (originalDayData.transactions || []).filter(t => {
              if (t.id && targetTx.id) return t.id !== targetTx.id;
              return !(Number(t.amount) === Number(targetTx.amount) && t.description === targetTx.description && t.type === targetTx.type);
            });
            await storageService.saveDayData(originalDateKey, targetBranchId, {
              ...originalDayData,
              transactions: remainingTxs
            });

            const newDayData = (await storageService.getDayData(newDateBs, targetBranchId)) || {
              date: newDateBs,
              branchId: targetBranchId,
              denominations: [],
              denoAdjustments: [],
              transactions: [],
              officeTransactions: [],
              remittances: [],
              vaultTransactions: []
            };
            const movedTx: ReceivablePayableEntry = {
              ...targetTx,
              amount: amt,
              type: editForm.type,
              remarks: editForm.particulars,
              date: newDateBs
            };
            await storageService.saveDayData(newDateBs, targetBranchId, {
              ...newDayData,
              transactions: [...(newDayData.transactions || []), movedTx]
            });
          }
        }

        if (targetTx.id) {
          try {
            await supabase.from('front_teller_ledger_entries').update({
              amount: amt,
              type: editForm.type,
              remarks: editForm.particulars,
              date_bs: newDateBs
            }).eq('id', targetTx.id);
          } catch (supErr) {
            console.warn("Direct Supabase update notice:", supErr);
          }
        }
      }

      const freshGlobalData = await storageService.getAllData().catch(() => ({}));
      setAllGlobalData(freshGlobalData || {});
      setEditModalRow(null);
      window.dispatchEvent(new Event('storage'));

      if (isTx) {
        const newBalance = computeAccountBalance(selectedAccount, freshGlobalData || {});
        sendStatementNotification({
          account: selectedAccount,
          txType: editForm.type,
          amount: amt,
          particular: editForm.particulars,
          dateBs: editForm.dateBs || editModalRow.date,
          actionType: 'edit',
          prevBalance,
          newBalance,
          oldAmount: oldAmt,
          oldParticular: oldRemarks
        });
      }
    } catch (err) {
      console.error("Failed to save statement edit:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeleteStatementRow = (row: StatementRow) => {
    if (row.type === 'accrual' || row.type === 'cap') return;
    setDeleteConfirmRow(row);
  };

  const executeDeleteStatementRow = async () => {
    if (!deleteConfirmRow || !selectedAccount) return;
    if (isDayEndedForBranch(deleteConfirmRow.sourceBranchId || selectedAccount.branchId || branch?.id)) {
      setStatusToast(getDayEndedBlockMessage());
      setTimeout(() => setStatusToast(null), 3500);
      setDeleteConfirmRow(null);
      return;
    }
    setIsSubmittingAction(true);
    try {
      const isTx = deleteConfirmRow.type === 'transaction' && !!deleteConfirmRow.originalTx;
      const prevBalance = computeAccountBalance(selectedAccount, allGlobalData);
      const targetTx = deleteConfirmRow.originalTx;
      const delAmount = targetTx ? (Number(targetTx.amount) || 0) : (deleteConfirmRow.debit > 0 ? deleteConfirmRow.debit : deleteConfirmRow.credit);
      const delType: 'in' | 'out' = targetTx?.type || (deleteConfirmRow.debit > 0 ? 'out' : 'in');
      const delParticular = targetTx?.remarks || targetTx?.description || deleteConfirmRow.particulars;
      const delDate = targetTx?.date || deleteConfirmRow.date;

      if (deleteConfirmRow.type === 'opening') {
        const updatedAccount: LedgerAccount = {
          ...selectedAccount,
          openingBalance: 0
        };
        await storageService.saveLedgerAccount(updatedAccount);
        setSelectedAccount(updatedAccount);
        setAccounts(prev => prev.map(a => a.id === updatedAccount.id ? updatedAccount : a));
      } else if (deleteConfirmRow.type === 'transaction' && deleteConfirmRow.originalTx) {
        const targetTx = deleteConfirmRow.originalTx;
        const dateKey = deleteConfirmRow.dayKey || targetTx.date || deleteConfirmRow.date;
        const targetBranchId = deleteConfirmRow.sourceBranchId || targetTx.branchId || branch?.id || 'main';

        const dayData = await storageService.getDayData(dateKey, targetBranchId);
        if (dayData) {
          const remainingTxs = (dayData.transactions || []).filter(t => {
            if (t.id && targetTx.id) return t.id !== targetTx.id;
            return !(Number(t.amount) === Number(targetTx.amount) && t.description === targetTx.description && t.type === targetTx.type);
          });
          await storageService.saveDayData(dateKey, targetBranchId, {
            ...dayData,
            transactions: remainingTxs
          });
        }

        if (targetTx.id) {
          try {
            await supabase.from('front_teller_ledger_entries').delete().eq('id', targetTx.id);
            await supabase.from('front_teller_counter_entries').delete().eq('id', targetTx.id);
          } catch (supErr) {
            console.warn("Direct Supabase delete notice:", supErr);
          }
        }
      }

      const freshGlobalData = await storageService.getAllData().catch(() => ({}));
      setAllGlobalData(freshGlobalData || {});
      setDeleteConfirmRow(null);
      if (breakdownModal.isOpen) {
        setBreakdownModal(p => ({ ...p, isOpen: false, entries: [] }));
      }
      window.dispatchEvent(new Event('storage'));

      if (isTx) {
        const newBalance = computeAccountBalance(selectedAccount, freshGlobalData || {});
        sendStatementNotification({
          account: selectedAccount,
          txType: delType,
          amount: delAmount,
          particular: delParticular,
          dateBs: delDate,
          actionType: 'delete',
          prevBalance,
          newBalance
        });
      }
    } catch (err) {
      console.error("Failed to delete statement row:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleOpenBreakdownModal = (row: StatementRow) => {
    if (row.type === 'accrual' || row.type === 'cap') return;

    const isDebit = row.debit > 0;
    const isOpening = row.type === 'opening';
    const amt = isDebit ? row.debit : (row.credit > 0 ? row.credit : (isOpening ? row.balance : 0));
    const typeStr = isDebit ? 'DEBIT' : 'CREDIT';
    const headName = isOpening 
      ? 'OPENING BALANCE' 
      : (row.originalTx?.description || row.particulars || selectedAccount?.name || 'TRANSACTION');

    const title = `${headName.toUpperCase()} (${typeStr}) DETAILS - ${row.date}`;

    const entry: BreakdownEntry = {
      id: row.originalTx?.id || `${row.sn}-${row.date}-${row.type}`,
      particulars: isOpening ? 'OPENING BALANCE' : (row.originalTx?.description || row.particulars || selectedAccount?.name || 'TRANSACTION'),
      narration: row.originalTx?.remarks || (isOpening ? 'Opening Balance Account Initialization (प्रारम्भिक मौज्दात)' : (row.particulars || 'Regular Ledger Entry')),
      type: isDebit ? 'out' : 'in',
      amount: amt,
      dateBs: row.date,
      isReadOnly: !isOpening && row.type !== 'transaction',
      sourceBranchId: row.sourceBranchId || selectedAccount?.branchId || 'main',
      branchName: row.branchName || 'Head Office',
      originalTx: row.originalTx,
      dayKey: row.dayKey,
      statementRow: row
    };

    setBreakdownModal({
      isOpen: true,
      title,
      dateBs: row.date,
      entries: [entry],
      editingId: null,
      editingForm: {
        particulars: entry.particulars,
        narration: entry.narration,
        type: entry.type,
        amount: entry.amount.toString()
      }
    });
  };

  const startEditBreakdown = (ent: BreakdownEntry) => {
    setBreakdownModal(prev => ({
      ...prev,
      editingId: ent.id || '1',
      editingForm: {
        particulars: ent.particulars,
        narration: ent.narration,
        type: ent.type,
        amount: ent.amount.toString()
      }
    }));
  };

  const handleSaveBreakdownEdit = async (ent: BreakdownEntry) => {
    if (!selectedAccount) return;
    if (isDayEndedForBranch(ent.sourceBranchId || selectedAccount.branchId || branch?.id)) {
      setStatusToast(getDayEndedBlockMessage());
      setTimeout(() => setStatusToast(null), 3500);
      return;
    }
    if (isBackDateBlockedForEntry(ent.dateBs, settings)) {
      setStatusToast(getBackDateBlockedMessage(ent.dateBs));
      setTimeout(() => setStatusToast(null), 3500);
      return;
    }
    setIsSubmittingAction(true);
    try {
      const amt = parseFloat(breakdownModal.editingForm.amount);
      if (isNaN(amt) || amt < 0) {
        alert("कृपया मान्य रकम प्रविष्ट गर्नुहोस् / Please enter a valid amount");
        setIsSubmittingAction(false);
        return;
      }

      const isTx = ent.statementRow?.type === 'transaction' && !!ent.originalTx;
      const prevBalance = computeAccountBalance(selectedAccount, allGlobalData);
      const oldTx = ent.originalTx;
      const oldAmt = Number(oldTx?.amount) || ent.amount || 0;
      const oldRemarks = oldTx?.remarks || oldTx?.description || ent.narration || ent.particulars || '';

      if (ent.statementRow?.type === 'opening') {
        const updatedAccount: LedgerAccount = {
          ...selectedAccount,
          openingBalance: amt
        };
        await storageService.saveLedgerAccount(updatedAccount);
        setSelectedAccount(updatedAccount);
        setAccounts(prev => prev.map(a => a.id === updatedAccount.id ? updatedAccount : a));
      } else if (ent.statementRow?.type === 'transaction' && ent.originalTx) {
        const targetTx = ent.originalTx;
        const dateKey = ent.dayKey || targetTx.date || ent.dateBs;
        const targetBranchId = ent.sourceBranchId || targetTx.branchId || branch?.id || 'main';

        const dayData = await storageService.getDayData(dateKey, targetBranchId);
        if (dayData) {
          const updatedTxs = (dayData.transactions || []).map(t => {
            const isMatch = (t.id && targetTx.id && t.id === targetTx.id) || 
                            (t === targetTx) || 
                            (Number(t.amount) === Number(targetTx.amount) && t.description === targetTx.description);
            if (isMatch) {
              return {
                ...t,
                amount: amt,
                type: breakdownModal.editingForm.type,
                remarks: breakdownModal.editingForm.narration,
                description: breakdownModal.editingForm.particulars
              };
            }
            return t;
          });
          await storageService.saveDayData(dateKey, targetBranchId, {
            ...dayData,
            transactions: updatedTxs
          });
        }

        if (targetTx.id) {
          try {
            await supabase.from('front_teller_ledger_entries').update({
              amount: amt,
              type: breakdownModal.editingForm.type,
              remarks: breakdownModal.editingForm.narration,
              description: breakdownModal.editingForm.particulars
            }).eq('id', targetTx.id);
          } catch (supErr) {
            console.warn("Direct Supabase update notice:", supErr);
          }
        }
      }

      const freshGlobalData = await storageService.getAllData().catch(() => ({}));
      setAllGlobalData(freshGlobalData || {});

      // Update current breakdown modal entry
      setBreakdownModal(prev => ({
        ...prev,
        editingId: null,
        entries: prev.entries.map(e => (e.id === ent.id ? {
          ...e,
          particulars: prev.editingForm.particulars,
          narration: prev.editingForm.narration,
          type: prev.editingForm.type,
          amount: amt
        } : e))
      }));

      window.dispatchEvent(new Event('storage'));

      if (isTx) {
        const newBalance = computeAccountBalance(selectedAccount, freshGlobalData || {});
        sendStatementNotification({
          account: selectedAccount,
          txType: breakdownModal.editingForm.type,
          amount: amt,
          particular: breakdownModal.editingForm.narration || breakdownModal.editingForm.particulars,
          dateBs: ent.dateBs,
          actionType: 'edit',
          prevBalance,
          newBalance,
          oldAmount: oldAmt,
          oldParticular: oldRemarks
        });
      }
    } catch (err) {
      console.error("Failed to save breakdown edit:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeleteBreakdown = (ent: BreakdownEntry) => {
    if (!ent.statementRow) return;
    setDeleteConfirmRow(ent.statementRow);
  };

  const handlePrintBreakdown = () => {
    if (!breakdownModal.isOpen || breakdownModal.entries.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const totalAmt = breakdownModal.entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const rowsHtml = breakdownModal.entries.map((e, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px 12px; font-weight: bold; text-transform: uppercase;">${e.particulars}</td>
        <td style="padding: 10px 12px; color: #475569;">${e.narration || '-'}</td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: ${e.type === 'in' ? '#059669' : '#e11d48'};">
          ${e.type === 'in' ? 'CREDIT / जम्मा' : 'DEBIT / भुक्तानी'}
        </td>
        <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-weight: 900; font-size: 13px;">रू ${Number(e.amount || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${breakdownModal.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 25px; color: #0f172a; }
            .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
            h2 { margin: 0; font-size: 16px; text-transform: uppercase; color: #0f172a; font-weight: 900; }
            p { margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th { background: #0f172a; color: white; padding: 9px 8px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900; }
            .total-row { background: #0f172a; color: white; font-weight: 900; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <h2>${breakdownModal.title}</h2>
            <p>कारोबार विवरण लग • TRANSACTION BREAKDOWN LOG • मिति: ${breakdownModal.dateBs}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 45px;">क्र.सं. (S.N.)</th>
                <th style="width: 25%;">विवरण (PARTICULARS)</th>
                <th style="width: 35%;">कैफियत (NARRATION)</th>
                <th style="text-align: center; width: 120px;">प्रकार (TYPE)</th>
                <th style="text-align: right; width: 130px;">रकम (AMOUNT)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="4" style="padding: 12px 14px; text-align: right; text-transform: uppercase; font-style: italic;">जम्मा रकम (TOTAL AMOUNT):</td>
                <td style="padding: 12px 14px; text-align: right; color: #34d399; font-family: monospace; font-size: 15px;">रू ${totalAmt.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const getEstDate = (timestamp: number) => {
    try {
        return new NepaliDate(new Date(timestamp)).format('YYYY-MM-DD');
    } catch (e) {
        return 'N/A';
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!staffSearchQuery.trim()) return employees;
    const q = staffSearchQuery.toLowerCase();
    return employees.filter(e => 
      e.fullName.toLowerCase().includes(q) || 
      (e.employeeCode && e.employeeCode.toLowerCase().includes(q)) ||
      (e.designation && e.designation.toLowerCase().includes(q))
    );
  }, [employees, staffSearchQuery]);

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-8">
      
      {/* COMPACT Header Section */}
      <div className="bg-white py-2 px-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
           <h2 className="text-xl font-black text-slate-950 tracking-tighter uppercase italic leading-none shrink-0">
             LEDGER <span className="text-blue-600">MASTER</span>
           </h2>
           
           <div className="relative flex-1 w-full max-w-xl flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
                  <Search size={14} />
                </div>
                <input 
                  type="text" 
                  placeholder="SEARCH BY NAME, MOBILE, OR ADDRESS..." 
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 font-black text-[9px] text-slate-900 uppercase tracking-widest outline-none focus:border-blue-500 transition-all shadow-inner"
                />
              </div>

              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="h-8 px-2.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-300 rounded-lg flex items-center space-x-1 text-[8.5px] font-black uppercase tracking-wider text-slate-700 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                title="Refresh & Sync Ledger Data"
              >
                <RefreshCw size={12} className={isRefreshing ? "animate-spin text-blue-600" : ""} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
              </button>
           </div>
        </div>

        <button 
          onClick={() => { resetForm(); setShowAdd(true); }} 
          disabled={isDayEnded}
          title={isDayEnded ? getDayEndedBlockMessage() : "Create new ledger account"}
          className="bg-slate-950 text-white h-8 px-5 rounded-lg font-black uppercase text-[9px] tracking-widest hover:bg-blue-600 transition-all flex items-center space-x-1.5 shadow-md active:scale-95 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          <span>Create Account</span>
        </button>
      </div>

      {/* Status Toast Feedback */}
      {statusToast && (
        <div className="bg-emerald-950 text-emerald-100 border border-emerald-500/40 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-black shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{statusToast}</span>
          </div>
          <button onClick={() => setStatusToast(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Account Vault Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm overflow-hidden font-black">
         <div className="w-full overflow-x-auto">
           <div className="min-w-[980px]">
             {/* Header */}
             <div className="grid grid-cols-[44px_minmax(200px,1.4fr)_150px_120px_90px_120px_195px] gap-2.5 px-4 py-3 border-b-2 border-slate-300 bg-slate-100/90 text-left items-center">
                <div className="text-[11px] font-black text-black uppercase tracking-wider text-center">S.N.</div>
                <div className="text-[11px] font-black text-black uppercase tracking-wider text-left">Account Name</div>
                <div className="text-[11px] font-black text-black uppercase tracking-wider text-left">Branch</div>
                <div className="text-[11px] font-black text-black uppercase tracking-wider text-left">Contact</div>
                <div className="text-[11px] font-black text-black uppercase tracking-wider text-left">Interest</div>
                <div className="text-[11px] font-black text-black uppercase tracking-wider text-left">Balance</div>
                <div className="text-[11px] font-black text-black uppercase tracking-wider text-left">Actions</div>
             </div>

             {/* Rows */}
             <div className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                   <div className="p-16 text-center text-slate-400 uppercase tracking-[0.5em] font-black">
                      No account records found in vault
                   </div>
                ) : (
                   filtered.map((acc, index) => {
                     const linkedBranchName = branchMap[acc.employeeBranchId || acc.branchId || 'main'] || 'Head Office';
                     return (
                      <div key={acc.id} className="grid grid-cols-[44px_minmax(200px,1.4fr)_150px_120px_90px_120px_195px] gap-2.5 px-4 py-3 items-center hover:bg-slate-50 transition-colors group text-left">
                         {/* S.N. Column */}
                         <div className="text-center font-mono font-black text-black text-sm">
                            {index + 1}
                         </div>

                         {/* Account Name Column */}
                         <div className="flex items-center space-x-3 text-left min-w-0">
                            {acc.photoUrl ? (
                               <img src={acc.photoUrl} className="w-9 h-9 rounded-xl object-cover border border-slate-300 group-hover:border-blue-500 transition-all shadow-xs shrink-0" />
                            ) : (
                               <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-black text-base italic shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                                  {acc.name.charAt(0).toLowerCase()}
                                </div>
                            )}
                            <div className="text-left min-w-0">
                               <div className="flex items-center space-x-2 flex-wrap">
                                 <h4 className="text-[13.5px] font-black text-black uppercase tracking-tight leading-snug text-left truncate">{acc.name}</h4>
                                 {acc.employeeId && (
                                   <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded text-[8px] font-black uppercase tracking-wider flex items-center shrink-0">
                                     <LinkIcon size={7} className="mr-0.5 text-emerald-800" /> Staff
                                   </span>
                                 )}
                               </div>
                            </div>
                         </div>

                         {/* Branch Column */}
                         <div className="flex flex-col items-start text-left min-w-0">
                            <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-md text-[9.5px] font-black text-black uppercase tracking-wider italic group-hover:bg-white transition-colors max-w-full">
                               <Building2 size={11} className="text-black shrink-0" />
                               <span className="truncate">{linkedBranchName}</span>
                            </div>
                            {acc.employeeBranchId && acc.employeeBranchId !== acc.branchId && (
                              <span className="text-[8px] text-blue-700 font-black uppercase mt-0.5 text-left">Assigned Station</span>
                            )}
                         </div>

                         {/* Contact Column */}
                         <div className="flex flex-col items-start text-left min-w-0">
                            <div className="flex items-center space-x-1.5 text-xs font-black text-black font-mono text-left">
                               <Phone size={11} className="text-black shrink-0" />
                               <span>{acc.mobile || 'No Contact'}</span>
                            </div>
                         </div>

                         {/* Interest Column */}
                         <div className="flex flex-col items-start text-left">
                            <div className="flex items-center space-x-1 bg-blue-50/90 border border-blue-200 px-2 py-0.5 rounded-lg text-[10.5px] font-black text-black font-mono">
                               <Percent size={9} className="text-blue-700 shrink-0" />
                               <span>{acc.interestRate}% P.A.</span>
                            </div>
                         </div>

                         {/* Balance Column (Yellow for Payable, Red for Receivable) */}
                         <div 
                           onClick={() => handleOpenStatement(acc)}
                           className="flex flex-col items-start text-left cursor-pointer group/bal py-0.5"
                           title="Click to view full statement"
                         >
                            {acc.closingBalance > 0 ? (
                               <span className="text-xs font-mono font-black text-amber-600 group-hover/bal:underline transition-colors whitespace-nowrap">
                                 रू {acc.closingBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                               </span>
                            ) : acc.closingBalance < 0 ? (
                               <span className="text-xs font-mono font-black text-rose-600 group-hover/bal:underline transition-colors whitespace-nowrap">
                                 रू {Math.abs(acc.closingBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                               </span>
                            ) : (
                               <span className="text-xs font-mono font-black text-black whitespace-nowrap">
                                 रू 0.00
                               </span>
                            )}
                         </div>

                         {/* Actions Column (View, Edit, Delete, Status, Email) */}
                         <div className="flex items-center justify-start space-x-1.5 text-left">
                            {/* 1. View */}
                            <button 
                              onClick={() => handleOpenStatement(acc)} 
                              className="p-2 bg-slate-100 text-black hover:bg-blue-600 hover:text-white border border-slate-300 rounded-lg transition-all cursor-pointer shadow-2xs" 
                              title="View Statement / स्टेटमेन्ट हेर्नुहोस्"
                            >
                              <Eye size={13}/>
                            </button>

                            {/* 2. Edit */}
                            <button 
                              onClick={() => handleEdit(acc)} 
                              disabled={isDayEnded}
                              className="p-2 bg-slate-100 text-black hover:bg-emerald-600 hover:text-white border border-slate-300 rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed" 
                              title={isDayEnded ? getDayEndedBlockMessage() : "Edit Account"}
                            >
                              <Edit2 size={13}/>
                            </button>

                            {/* 3. Delete */}
                            <button 
                              onClick={() => handleDelete(acc.id)} 
                              disabled={isDayEnded}
                              className="p-2 bg-slate-100 text-black hover:bg-rose-600 hover:text-white border border-slate-300 rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed" 
                              title={isDayEnded ? getDayEndedBlockMessage() : "Delete Account"}
                            >
                              <Trash2 size={13}/>
                            </button>

                            {/* 4. Status Toggle */}
                            <button 
                              onClick={(e) => handleToggleStatus(acc, e)} 
                              disabled={isDayEnded}
                              className={`px-2 py-1 rounded-lg transition-all cursor-pointer shadow-2xs flex items-center space-x-1 text-[8px] font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed ${
                                acc.status === 'Active' 
                                  ? 'bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border border-emerald-300' 
                                  : 'bg-rose-50 text-rose-950 hover:bg-rose-100 border border-rose-300'
                              }`}
                              title={isDayEnded ? getDayEndedBlockMessage() : `Status: ${acc.status} (Click to set ${acc.status === 'Active' ? 'Inactive' : 'Active'})`}
                            >
                              {acc.status === 'Active' ? (
                                <>
                                  <CheckCircle2 size={12} className="text-emerald-700 shrink-0"/>
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <XCircle size={12} className="text-rose-700 shrink-0"/>
                                  <span>Inactive</span>
                                </>
                              )}
                            </button>

                            {/* 5. Email - Instant Send on Click */}
                            <button 
                              onClick={() => handleDirectEmailSend(acc)} 
                              disabled={sendingEmailAccId === acc.id}
                              className={`p-2 rounded-lg transition-all cursor-pointer shadow-2xs border ${
                                sendingEmailAccId === acc.id
                                  ? 'bg-blue-600 text-white border-blue-600 animate-pulse cursor-wait'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border-blue-300'
                              }`}
                              title="ईमेल पठाउनुहोस् (Click to send Statement PDF instantly)"
                            >
                              {sendingEmailAccId === acc.id ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Mail size={13}/>
                              )}
                            </button>
                         </div>
                      </div>
                     );
                   })
                )}
             </div>
           </div>
         </div>
      </div>

      {/* REFINED STATEMENT Modal */}
      {showStatement && selectedAccount && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[2000] flex items-center justify-center p-3 sm:p-4">
           <div className="bg-white w-full max-w-[96%] lg:max-w-[1320px] h-[88vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-300 animate-in zoom-in-95 duration-200">
              
              {/* Premium Statement Header */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 relative z-[2100] border-b border-slate-800">
                 <div className="flex items-center space-x-3.5 w-full md:w-auto">
                    <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 p-0.5 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
                       {selectedAccount.photoUrl ? (
                          <img src={selectedAccount.photoUrl} className="w-full h-full object-cover rounded-xl" alt={selectedAccount.name} />
                       ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-800 rounded-xl"><User size={20}/></div>
                       )}
                    </div>
                    <div>
                       <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-md text-[7px] font-black uppercase tracking-wider flex items-center shadow-xs">
                            <ShieldCheck size={8} className="mr-1 text-blue-400"/> CERTIFIED
                          </span>
                          <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                            {selectedAccount.type} • {selectedAccount.interestRate}% P.A.
                          </span>
                          {selectedAccount.employeeId && (
                            <span className="text-[7.5px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                              Linked Staff • {branchMap[selectedAccount.employeeBranchId || selectedAccount.branchId || 'main'] || 'Head Office'}
                            </span>
                          )}
                       </div>
                       <h1 className="text-xl font-black text-white uppercase tracking-tight leading-none">{selectedAccount.name}</h1>
                    </div>
                 </div>

                 <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
                    <div className="flex items-center space-x-2.5">
                      <div className="relative">
                         <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block mb-0.5 ml-1">AUDIT START</span>
                         <NepaliDatePicker value={auditRange.start} onChange={v => setAuditRange(p => ({...p, start: v}))} className="w-[110px]" />
                      </div>
                      <div className="relative">
                         <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block mb-0.5 ml-1">AUDIT END</span>
                         <NepaliDatePicker value={auditRange.end} onChange={v => setAuditRange(p => ({...p, end: v}))} className="w-[110px]" />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-1">
                       <button 
                         onClick={() => window.print()} 
                         className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition-all shadow-sm border border-slate-700/80 cursor-pointer" 
                         title="Print Statement (प्रिन्ट गर्नुहोस्)"
                       >
                         <Printer size={15}/>
                       </button>
                       <button 
                         onClick={() => setShowStatement(false)} 
                         className="p-2.5 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl transition-all shadow-sm border border-rose-500/30 cursor-pointer" 
                         title="Close (बन्द गर्नुहोस्)"
                       >
                         <X size={15}/>
                       </button>
                    </div>
                 </div>
              </div>

              {/* Modern Financial Intelligence Metrics Ribbon */}
              <div className="bg-slate-100/90 border-b border-slate-300 px-6 py-3 shrink-0">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-stretch">
                    {/* 1. Opening Balance */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex items-center space-x-3">
                       <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                          <Landmark size={15} />
                       </div>
                       <div className="min-w-0 flex-1">
                          <span className="block text-[8px] font-black uppercase tracking-wider text-slate-600 mb-0.5">
                            Opening Balance (प्रारम्भिक)
                          </span>
                          <div className="text-sm font-black font-mono text-slate-900 truncate">
                            {formatBalanceDrCr(statementData.kpis.opening).text}
                          </div>
                       </div>
                    </div>

                    {/* 2. Accrued Interest */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex items-center space-x-3">
                       <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                          <Calculator size={15} />
                       </div>
                       <div className="min-w-0 flex-1">
                          <span className="block text-[8px] font-black uppercase tracking-wider text-amber-900 mb-0.5">
                            Accrued Interest (संचित ब्याज)
                          </span>
                          <div className="text-sm font-black font-mono text-amber-600 truncate">
                            रू {statementData.kpis.accrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                       </div>
                    </div>

                    {/* 3. Principal Base */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex items-center space-x-3">
                       <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                          <CreditCard size={15} />
                       </div>
                       <div className="min-w-0 flex-1">
                          <span className="block text-[8px] font-black uppercase tracking-wider text-blue-900 mb-0.5">
                            Principal Base (मूल पुँजी)
                          </span>
                          <div className="text-sm font-black font-mono text-blue-700 truncate">
                            {formatBalanceDrCr(statementData.kpis.principal).text}
                          </div>
                       </div>
                    </div>

                    {/* 4. Closing Balance (Highlight Pill) */}
                    <div className={`rounded-xl p-3 border shadow-xs flex items-center space-x-3 ${
                      statementData.kpis.balance < 0 
                        ? 'bg-rose-50/90 border-rose-200 text-rose-950' 
                        : statementData.kpis.balance > 0 
                        ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950' 
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}>
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                         statementData.kpis.balance < 0 
                           ? 'bg-rose-100 text-rose-700 border border-rose-300' 
                           : statementData.kpis.balance > 0 
                           ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                           : 'bg-slate-200 text-slate-700 border border-slate-300'
                       }`}>
                          <CreditCard size={15} />
                       </div>
                       <div className="min-w-0 flex-1">
                          <span className="block text-[8px] font-black uppercase tracking-wider opacity-75 mb-0.5">
                            Closing Balance (अन्तिम मौज्दात)
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-sm font-black font-mono tracking-tight truncate">
                              रू {Math.abs(statementData.kpis.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            {statementData.kpis.balance < 0 ? (
                              <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[7px] font-black uppercase tracking-wider">
                                Dr
                              </span>
                            ) : statementData.kpis.balance > 0 ? (
                              <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[7px] font-black uppercase tracking-wider">
                                Cr
                              </span>
                            ) : null}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Statement Table */}
              <div className="flex-1 overflow-y-auto px-5 py-2.5 bg-white relative z-[100]">
                 <table className="w-full text-[9px] font-black border-collapse">
                    <thead>
                       <tr className="bg-slate-100 text-slate-950 border-y border-slate-300 uppercase tracking-widest text-[8px] text-center sticky top-0 z-10 shadow-2xs">
                          <th className="p-2 text-left border-r border-slate-300 w-10">S.N.</th>
                          <th className="p-2 text-left border-r border-slate-300 w-24">Date (B.S.)</th>
                          <th className="p-2 text-left border-r border-slate-300">Particulars Details</th>
                          <th className="p-2 border-r border-slate-300 text-right pr-3 w-28 text-rose-700 italic">Debit (-)</th>
                          <th className="p-2 border-r border-slate-300 text-right pr-3 w-28 text-emerald-700 italic">Credit (+)</th>
                          <th className="p-2 border-r border-slate-300 text-right pr-3 w-24 text-amber-700 italic">Int. Accrued</th>
                          <th className="p-2 border-r border-slate-300 text-right pr-3 w-24 text-cyan-700 italic">Int. Cap</th>
                          <th className="p-2 bg-slate-200 text-black text-right pr-3 w-32 italic text-[9.5px] border-r border-slate-300">Balance</th>
                          <th className="p-2 text-center border-r border-slate-300 w-28">Branch</th>
                          {canManageStatementTransactions && (
                            <th className="p-2 text-center w-20">Action</th>
                          )}
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-center">
                       {statementData.rows.length === 0 ? (
                         <tr>
                           <td colSpan={canManageStatementTransactions ? 10 : 9} className="p-12 text-slate-300 uppercase tracking-[0.4em] font-black italic text-center">
                             No transaction records detected for this range
                           </td>
                         </tr>
                       ) : (
                         statementData.rows.map(row => {
                           const balInfo = formatBalanceDrCr(row.balance);
                           return (
                             <tr key={`${row.sn}-${row.date}-${row.particulars}-${row.type}`} className={`hover:bg-blue-50/50 transition-all group ${row.type === 'accrual' ? 'bg-orange-50/20' : row.type === 'cap' ? 'bg-cyan-50/20' : ''}`}>
                                <td className="p-1.5 text-left text-slate-400 font-mono border-r border-slate-100">{row.sn}</td>
                                <td className="p-1.5 text-left font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap">{row.date}</td>
                                <td className="p-1.5 text-left border-r border-slate-100">
                                   <div className={`uppercase text-[8.5px] font-bold leading-tight ${row.type === 'accrual' ? 'text-orange-600' : row.type === 'cap' ? 'text-cyan-600' : 'text-slate-900'}`}>{row.particulars}</div>
                                </td>
                                <td 
                                  onClick={() => (row.type === 'transaction' || row.type === 'opening') && handleOpenBreakdownModal(row)}
                                  className={`p-1.5 text-right pr-3 border-r border-slate-100 font-mono font-bold text-rose-600 ${row.type === 'transaction' || row.type === 'opening' ? 'cursor-pointer hover:underline hover:bg-rose-50/60' : ''}`}
                                  title={row.type === 'transaction' || row.type === 'opening' ? 'Click to view breakdown details (विवरण हेर्नुहोस्)' : undefined}
                                >
                                  {row.debit > 0 ? `रू ${row.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                </td>
                                <td 
                                  onClick={() => (row.type === 'transaction' || row.type === 'opening') && handleOpenBreakdownModal(row)}
                                  className={`p-1.5 text-right pr-3 border-r border-slate-100 font-mono font-bold text-emerald-600 ${row.type === 'transaction' || row.type === 'opening' ? 'cursor-pointer hover:underline hover:bg-emerald-50/60' : ''}`}
                                  title={row.type === 'transaction' || row.type === 'opening' ? 'Click to view breakdown details (विवरण हेर्नुहोस्)' : undefined}
                                >
                                  {row.credit > 0 ? `रू ${row.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                </td>
                                <td className="p-1.5 text-right pr-3 border-r border-slate-100 font-mono text-orange-600 font-bold">
                                  {row.accrued > 0 ? `रू ${row.accrued.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                </td>
                                <td className="p-1.5 text-right pr-3 border-r border-slate-100 font-mono text-cyan-600 font-bold">
                                  {row.cap > 0 ? `रू ${row.cap.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                </td>
                                <td className="p-1.5 bg-slate-50 font-mono font-black text-[10px] text-right pr-3 border-r border-slate-100 whitespace-nowrap">
                                  <span className={balInfo.isDr ? 'text-rose-700' : balInfo.isCr ? 'text-emerald-700' : 'text-slate-900'}>
                                    {balInfo.text}
                                  </span>
                                </td>
                                <td className="p-1.5 text-center border-r border-slate-100">
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[7.5px] font-bold">
                                    {row.branchName || 'Head Office'}
                                  </span>
                                </td>
                                {canManageStatementTransactions && (
                                  <td className="p-1.5 text-center">
                                    {row.type === 'transaction' ? (
                                      <div className="flex items-center justify-center space-x-1">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenBreakdownModal(row)}
                                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                          title="View / Edit Breakdown Details (विवरण हेर्नुहोस् / सम्पादन)"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteStatementRow(row)}
                                          disabled={isDayEnded}
                                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                          title={isDayEnded ? getDayEndedBlockMessage() : "Delete Transaction"}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    ) : row.type === 'opening' ? (
                                      <div className="flex items-center justify-center space-x-1">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenBreakdownModal(row)}
                                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                          title="View / Edit Opening Balance"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[7px] text-slate-300 font-bold uppercase tracking-wider">System</span>
                                    )}
                                  </td>
                                )}
                             </tr>
                           );
                         })
                       )}
                    </tbody>
                 </table>
              </div>

              <div className="px-8 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                 <div className="flex items-center space-x-4 text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">
                    <MapPin size={10}/> <span>{branch?.name || 'Head Office'} Branch Operational Audit</span>
                    <span className="mx-2 opacity-30">|</span>
                    <User size={10}/> <span>Operator: {user?.fullName}</span>
                 </div>
                 <div className="text-[9px] font-black italic text-slate-950 uppercase tracking-tighter">
                   © {new Date().getFullYear()} Ratauli Saccos Financial Intelligence Unit
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* CREATE / EDIT Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
              
              <div className="bg-slate-950 px-5 py-3 flex items-center justify-between text-white shrink-0">
                 <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                      <Landmark size={14} />
                    </div>
                    <div>
                       <h3 className="font-black uppercase tracking-tight text-xs">{newAccount.id ? 'EDIT LEDGER ACCOUNT' : 'CREATE NEW LEDGER ACCOUNT'}</h3>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                         {newAccount.employeeId ? 'कर्मचारी लेजर खाता (Synced with Staff Profile & Front Teller)' : 'सहकारी लेजर खाता'}
                       </p>
                    </div>
                 </div>
                 <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"><X size={16} /></button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                 <DayEndFieldset branchId={newAccount.employeeBranchId || newAccount.branchId || branch?.id} className="space-y-4">
                 {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center space-x-2">
                       <AlertCircle size={16} />
                       <span>{errorMsg}</span>
                    </div>
                 )}

                 {/* Employee Linking Section */}
                 {!newAccount.id && (
                   <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl shadow-inner relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-2 opacity-5 group-hover:rotate-12 transition-transform"><Users size={40}/></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="flex items-center space-x-1.5 text-[8.5px] font-black uppercase text-blue-600 tracking-widest">
                             <RefreshCw size={11} className="animate-spin-slow" />
                             <span>Import Identity from Staff Registry (सबै शाखाका कर्मचारी)</span>
                          </label>
                          {newAccount.employeeId && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[7px] font-black uppercase tracking-wider">
                              Linked: {newAccount.name}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                           <input 
                             type="text"
                             placeholder="Search staff by name or code..."
                             value={staffSearchQuery}
                             onChange={e => setStaffSearchQuery(e.target.value)}
                             className="w-1/3 h-9 bg-white border border-blue-200 rounded-xl px-3 font-bold text-[10px] outline-none focus:border-blue-600 shadow-sm"
                           />
                           <select 
                             className="flex-1 h-9 bg-white border border-blue-200 rounded-xl px-3 font-black text-[10px] uppercase outline-none focus:border-blue-600 shadow-sm appearance-none"
                             onChange={(e) => handleStaffImport(e.target.value)}
                             defaultValue=""
                           >
                              <option value="" disabled>Select Employee to Link...</option>
                              {filteredEmployees.map(emp => {
                                const bName = branchMap[emp.branchId || 'main'] || emp.branchId || 'Head Office';
                                return (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.fullName} ({emp.employeeCode || 'EMP'}) • {emp.designation} • [{bName}]
                                  </option>
                                );
                              })}
                           </select>
                           <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md shrink-0"><UserPlus size={16}/></div>
                        </div>

                        <div className="flex items-center justify-between mt-1.5 text-[7px] text-blue-600 font-bold uppercase tracking-wider">
                          <span>कर्मचारी छनोट गरेपछि उसको प्रोफाइल र कार्यरत शाखाको फ्रन्ट टेलरमा यो खाता स्वतः देखिनेछ।</span>
                          {newAccount.employeeBranchId && (
                            <span className="text-emerald-700 font-black">
                              Station: {branchMap[newAccount.employeeBranchId] || 'Head Office'}
                            </span>
                          )}
                        </div>
                      </div>
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                    <div className="md:col-span-4 flex flex-col items-center space-y-3">
                       <div className="relative group">
                          <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-slate-100 overflow-hidden shadow-inner flex items-center justify-center group-hover:border-blue-500 transition-all">
                             {newAccount.photoUrl ? (
                               <img src={newAccount.photoUrl} className="w-full h-full object-cover" />
                             ) : (
                               <User size={32} className="text-slate-200" />
                             )}
                          </div>
                          <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white p-1.5 rounded-lg shadow-md hover:bg-slate-950 transition-all active:scale-90 border-2 border-white"><Camera size={12} /></button>
                          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                       </div>
                       <div className="w-full space-y-2">
                          <div className="space-y-0.5">
                             <label className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest ml-0.5 flex items-center"><MapPin size={8} className="mr-0.5" /> Profile Address</label>
                             <input type="text" value={newAccount.address} onChange={e => setNewAccount({...newAccount, address: e.target.value})} className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-xl px-3 font-black text-[10px] outline-none focus:border-blue-600 uppercase" placeholder="City, Area" />
                          </div>
                          <div className="space-y-0.5">
                             <label className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest ml-0.5 flex items-center"><Phone size={8} className="mr-0.5" /> Contact Link</label>
                             <input type="text" value={newAccount.mobile} onChange={e => setNewAccount({...newAccount, mobile: e.target.value})} className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-xl px-3 font-black text-[10px] outline-none focus:border-blue-600" placeholder="98XXXXXXXX" />
                          </div>
                          <div className="space-y-0.5">
                             <label className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest ml-0.5 flex items-center"><Mail size={8} className="mr-0.5 text-blue-600" /> Email Notification Address</label>
                             <input type="email" value={newAccount.email || ''} onChange={e => setNewAccount({...newAccount, email: e.target.value})} className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-[10px] outline-none focus:border-blue-600" placeholder="employee@example.com" />
                          </div>
                       </div>
                    </div>

                    <div className="md:col-span-8 space-y-3">
                       <div className="space-y-0.5">
                          <label className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest ml-0.5">Account Holder Full Name</label>
                          <input type="text" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-4 font-black text-xs uppercase outline-none focus:border-blue-600 shadow-sm" placeholder="ENTER LEGAL NAME" />
                       </div>
                       
                       <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-0.5">
                             <label className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest ml-0.5">Effective Opening Date (BS)</label>
                             <NepaliDatePicker value={adCreateDate} onChange={setAdCreateDate} disallowBackDateIfDisabled={true} disabled={isDayEnded} className="w-full scale-90 origin-left" />
                          </div>
                          <div className="space-y-0.5">
                             <label className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest ml-0.5">Interest Rate (% P.A.)</label>
                             <div className="relative">
                                <input type="number" value={newAccount.interestRate} onChange={e => setNewAccount({...newAccount, interestRate: parseFloat(e.target.value)})} className="w-full h-8.5 bg-slate-900 border border-blue-900/10 rounded-xl px-7 font-black text-sm text-blue-400 outline-none focus:border-blue-500 text-center tracking-tighter" />
                                <Percent size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600/50" />
                              </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-0.5">
                             <label className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest ml-0.5">Account Category</label>
                             <select 
                               value={newAccount.type} 
                               onChange={e => setNewAccount({...newAccount, type: e.target.value as any})}
                               className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-xl px-3 font-black text-[10px] outline-none focus:border-blue-600 uppercase italic shadow-inner appearance-none"
                             >
                                <option value="Customer">Customer (बचतकर्ता / कर्मचारी)</option>
                                <option value="Loan">Loan (ऋणी / पेश्की)</option>
                                <option value="Investment">Investment (लगानी)</option>
                                <option value="Vendor">Vendor (साहु)</option>
                                <option value="Other">Other</option>
                             </select>
                          </div>
                          <div className="space-y-0.5">
                             <label className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest ml-0.5">Capitalization Policy</label>
                             <select 
                               value={newAccount.capitalizationFrequency} 
                               onChange={e => setNewAccount({...newAccount, capitalizationFrequency: e.target.value as CapitalizationFrequency})} 
                               className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-xl px-3 font-black text-[10px] outline-none focus:border-blue-600 uppercase shadow-inner appearance-none"
                             >
                                <option value="None">No Capitalization</option>
                                <option value="Monthly">Monthly Anniversary</option>
                                <option value="Yearly">Annual Anniversary</option>
                             </select>
                          </div>
                       </div>

                       {/* Stationed Branch Selection (if employee is linked) */}
                       {newAccount.employeeId && (
                         <div className="space-y-0.5 pt-1">
                            <label className="text-[7.5px] font-black uppercase text-emerald-600 tracking-widest ml-0.5 flex items-center">
                              <Building2 size={9} className="mr-1" /> कर्मचारी कार्यरत शाखा (Working Branch / Station)
                            </label>
                            <select 
                              value={newAccount.employeeBranchId || newAccount.branchId || 'main'}
                              onChange={e => setNewAccount({...newAccount, employeeBranchId: e.target.value, branchId: e.target.value})}
                              className="w-full h-8.5 bg-emerald-50/50 border border-emerald-200 rounded-xl px-3 font-black text-[10px] outline-none focus:border-emerald-600 text-emerald-950 uppercase"
                            >
                              <option value="main">Ratauli Head Office</option>
                              {branches.filter(b => b.id !== 'main').map(b => (
                                <option key={b.id} value={b.id}>{b.name} Branch</option>
                              ))}
                            </select>
                         </div>
                       )}

                    </div>
                 </div>
                 </DayEndFieldset>
              </div>

              <div className="py-3 px-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                 <button onClick={() => setShowAdd(false)} disabled={saving} className="px-4 py-1.5 rounded-xl font-black uppercase text-[8.5px] tracking-widest text-slate-400 hover:text-rose-600 transition-all disabled:opacity-50 cursor-pointer">Dismiss</button>
                 <button onClick={handleAdd} disabled={saving || isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} className="bg-slate-950 text-white px-6 py-2 rounded-xl font-black uppercase text-[9.5px] tracking-widest shadow-lg hover:bg-blue-600 transition-all active:scale-95 flex items-center space-x-2 border-b-2 border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                     {saving ? (
                       <RefreshCw className="animate-spin" size={14} />
                     ) : (
                       <Save size={14} />
                     )}
                     <span>{saving ? 'Creating...' : (newAccount.id ? 'Save' : 'Create')}</span>
                 </button>
              </div>
           </div>
        </div>
      )}
      {confirmDelete?.isOpen && (
        <ConfirmationModal 
          isOpen={confirmDelete.isOpen}
          title="Delete Ledger Account"
          message="Are you sure you want to delete this ledger account? This will permanently remove the account and its associated logs."
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* TRANSACTION BREAKDOWN LOG MODAL (MATCHING SCREENSHOT DESIGN WITH NEPALI WORDS) */}
      {breakdownModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[2200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Header with Emerald Title & Actions */}
            <div className="bg-slate-950 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
              <div>
                <h2 className="text-sm sm:text-base font-black tracking-tight italic uppercase text-emerald-400">
                  {breakdownModal.title}
                </h2>
                <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  <span className="text-slate-300">कारोबार विवरण लग</span>
                  <span className="text-slate-600">•</span>
                  <span>TRANSACTION BREAKDOWN LOG</span>
                  {selectedAccount && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-blue-400 font-mono">{selectedAccount.name}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  type="button"
                  onClick={handlePrintBreakdown} 
                  className="px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-emerald-600 text-slate-300 hover:text-white transition-all flex items-center space-x-1.5 text-xs font-bold cursor-pointer shadow-sm"
                  title="Print Breakdown Details / विवरण छाप्नुहोस्"
                >
                  <Printer size={15} />
                  <span>Print / छाप्नुहोस्</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setBreakdownModal(p => ({ ...p, isOpen: false }))} 
                  className="p-1.5 bg-slate-800 rounded-lg hover:bg-rose-600 text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Close / बन्द गर्नुहोस्"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body Table */}
            <div className="p-4 max-h-[65vh] overflow-y-auto">
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10.5px] font-black uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3 px-3 text-center w-14 border-r border-slate-800">
                        <div>S.N.</div>
                        <div className="text-[8px] text-slate-400 font-normal">क्र.सं.</div>
                      </th>
                      <th className="py-3 px-3.5 w-1/4 border-r border-slate-800">
                        <div>PARTICULARS</div>
                        <div className="text-[8px] text-slate-400 font-normal">विवरण / शीर्षक</div>
                      </th>
                      <th className="py-3 px-3.5 w-1/3 border-r border-slate-800">
                        <div>NARRATION</div>
                        <div className="text-[8px] text-slate-400 font-normal">कैफियत / टिप्पणी</div>
                      </th>
                      <th className="py-3 px-3 text-center w-28 border-r border-slate-800">
                        <div>TYPE</div>
                        <div className="text-[8px] text-slate-400 font-normal">प्रकार</div>
                      </th>
                      <th className="py-3 px-3.5 text-right w-36 border-r border-slate-800">
                        <div>AMOUNT</div>
                        <div className="text-[8px] text-slate-400 font-normal">रकम (रू)</div>
                      </th>
                      <th className="py-3 px-3 text-center w-28">
                        <div>ACTION</div>
                        <div className="text-[8px] text-slate-400 font-normal">कार्य</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-semibold text-slate-800">
                    {breakdownModal.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 px-4 text-center text-slate-400 uppercase font-bold italic tracking-wider text-xs">
                          No transactions found for this record / कुनै विवरण भेटिएन
                        </td>
                      </tr>
                    ) : (
                      breakdownModal.entries.map((ent, idx) => {
                        const isEditing = breakdownModal.editingId === ent.id;
                        return (
                          <tr key={ent.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 text-center font-bold text-slate-500 text-xs align-middle border-r border-slate-100">
                              {idx + 1}
                            </td>
                              <td className="py-3 px-3.5 align-middle border-r border-slate-100">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  value={breakdownModal.editingForm.particulars} 
                                  onChange={e => setBreakdownModal(prev => ({
                                    ...prev,
                                    editingForm: { ...prev.editingForm, particulars: e.target.value }
                                  }))}
                                  disabled={isDayEnded}
                                  placeholder="Particulars..."
                                  className="w-full px-2.5 py-1.5 bg-white border border-blue-500 rounded-lg text-xs font-bold uppercase outline-none disabled:opacity-50"
                                />
                              ) : (
                                <div className="text-slate-900 font-black text-xs sm:text-sm italic uppercase tracking-tight">
                                  {ent.particulars}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 align-middle border-r border-slate-100">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  value={breakdownModal.editingForm.narration} 
                                  onChange={e => setBreakdownModal(prev => ({
                                    ...prev,
                                    editingForm: { ...prev.editingForm, narration: e.target.value }
                                  }))}
                                  disabled={isDayEnded}
                                  placeholder="Narration / Remarks..."
                                  className="w-full px-2.5 py-1.5 bg-white border border-blue-500 rounded-lg text-xs font-medium outline-none disabled:opacity-50"
                                />
                              ) : (
                                <div className="text-slate-600 text-xs sm:text-sm font-medium">
                                  {ent.narration || <span className="text-slate-300 italic">-</span>}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center align-middle border-r border-slate-100">
                              {isEditing ? (
                                <select 
                                  value={breakdownModal.editingForm.type} 
                                  onChange={e => setBreakdownModal(prev => ({
                                    ...prev,
                                    editingForm: { ...prev.editingForm, type: e.target.value as 'in' | 'out' }
                                  }))}
                                  disabled={isDayEnded}
                                  className="px-2 py-1.5 bg-white border border-blue-500 rounded-lg text-xs font-black uppercase cursor-pointer outline-none disabled:opacity-50"
                                >
                                  <option value="in">CREDIT</option>
                                  <option value="out">DEBIT</option>
                                </select>
                              ) : (
                                <span className={`inline-flex flex-col items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                  ent.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  <span>{ent.type === 'in' ? 'CREDIT' : 'DEBIT'}</span>
                                  <span className="text-[7.5px] font-bold opacity-80">{ent.type === 'in' ? 'जम्मा' : 'भुक्तानी'}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900 whitespace-nowrap align-middle border-r border-slate-100">
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={breakdownModal.editingForm.amount} 
                                  onChange={e => setBreakdownModal(prev => ({
                                    ...prev,
                                    editingForm: { ...prev.editingForm, amount: e.target.value }
                                  }))}
                                  disabled={isDayEnded}
                                  placeholder="0.00"
                                  className="w-32 px-2.5 py-1.5 bg-white border border-blue-500 rounded-lg text-xs font-mono font-black text-right outline-none disabled:opacity-50"
                                />
                              ) : (
                                <span className="text-sm font-black">
                                  रू {Number(ent.amount || 0).toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center align-middle">
                              {ent.isReadOnly ? (
                                <span className="text-[9px] text-slate-400 font-bold uppercase italic">System</span>
                              ) : isEditing ? (
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button 
                                    type="button"
                                    onClick={() => handleSaveBreakdownEdit(ent)}
                                    disabled={isSubmittingAction || isDayEnded}
                                    className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={isDayEnded ? getDayEndedBlockMessage() : "Save Changes"}
                                  >
                                    <CheckCircle2 size={15} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setBreakdownModal(p => ({ ...p, editingId: null }))}
                                    className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X size={15} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center space-x-2">
                                  <button 
                                    type="button"
                                    onClick={() => startEditBreakdown(ent)}
                                    disabled={isDayEnded}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={isDayEnded ? getDayEndedBlockMessage() : "Edit Entry"}
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteBreakdown(ent)}
                                    disabled={isDayEnded}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 hover:border-rose-400 rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={isDayEnded ? getDayEndedBlockMessage() : "Delete Entry"}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {breakdownModal.entries.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs sm:text-sm border-t border-slate-800">
                        <td colSpan={4} className="py-3.5 px-4 uppercase tracking-wider italic text-right">
                          <span className="text-slate-300 mr-2 font-normal text-xs">जम्मा रकम :</span>
                          <span>TOTAL AMOUNT:</span>
                        </td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-emerald-400 whitespace-nowrap text-sm sm:text-base font-black border-r border-slate-800">
                          रू {breakdownModal.entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STATEMENT ENTRY MODAL (FALLBACK) */}
      {editModalRow && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[2200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="bg-slate-950 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Edit2 size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase italic tracking-wider">
                    {editModalRow.type === 'opening' ? 'Edit Opening Balance / प्रारम्भिक मौज्दात सम्पादन' : 'Edit Ledger Entry / प्रविष्टि सम्पादन'}
                  </h3>
                  <p className="text-[8px] text-slate-400 font-mono">{selectedAccount?.name} • {editModalRow.branchName || 'Head Office'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalRow(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <DayEndFieldset branchId={editModalRow.sourceBranchId || branch?.id} className="space-y-4">
              <div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Date (B.S.) / मिति
                </label>
                <NepaliDatePicker
                  value={editForm.dateBs}
                  onChange={v => setEditForm(p => ({ ...p, dateBs: v }))}
                  disallowBackDateIfDisabled={true}
                  disabled={isDayEnded}
                  className="w-full h-10 font-bold text-xs"
                />
              </div>

              {editModalRow.type === 'transaction' && (
                <>
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      Transaction Type / प्रकार
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditForm(p => ({ ...p, type: 'out' }))}
                        className={`h-9 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          editForm.type === 'out'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <ArrowUpCircle size={14} />
                        <span>Debit (-) / भुक्तानी</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm(p => ({ ...p, type: 'in' }))}
                        className={`h-9 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          editForm.type === 'in'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <ArrowDownCircle size={14} />
                        <span>Credit (+) / जम्मा</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      Particulars / Remarks / विवरण
                    </label>
                    <input
                      type="text"
                      value={editForm.particulars}
                      onChange={e => setEditForm(p => ({ ...p, particulars: e.target.value }))}
                      placeholder="Enter particulars details..."
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-xs font-bold text-slate-900 focus:border-blue-500 outline-none uppercase transition-colors"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Amount (रू) / रकम
                </label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-base font-black text-slate-900 focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              </DayEndFieldset>

              <div className="pt-2 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalRow(null)}
                  className="px-5 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatementEdit}
                  disabled={isSubmittingAction || isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-6 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <Save size={14} />
                  <span>{isSubmittingAction ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE STATEMENT ENTRY MODAL */}
      {deleteConfirmRow && (
        <ConfirmationModal
          isOpen={!!deleteConfirmRow}
          title="Delete Statement Entry / प्रविष्टि मेटाउनुहोस्"
          message={`के तपाईं '${deleteConfirmRow.particulars}' (${deleteConfirmRow.debit > 0 ? `Debit रू ${deleteConfirmRow.debit.toLocaleString()}` : `Credit रू ${deleteConfirmRow.credit.toLocaleString()}`}) को प्रविष्टि मेटाउन निश्चित हुनुहुन्छ? / Are you sure you want to delete this record? This will permanently remove the entry and recalculate accrued interest and closing balance.`}
          confirmLabel={isSubmittingAction ? "Deleting..." : "Yes, Delete / मेटाउनुहोस्"}
          cancelLabel="Cancel / रद्द"
          variant="danger"
          onConfirm={executeDeleteStatementRow}
          onCancel={() => setDeleteConfirmRow(null)}
        />
      )}

      {/* STATEMENT EMAIL & PDF MODAL */}
      {emailModal.isOpen && emailModal.account && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[2500] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200 my-auto">
            {/* Modal Header */}
            <div className="bg-slate-950 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase italic tracking-wider flex items-center space-x-2">
                    <span>SEND STATEMENT EMAIL</span>
                    <span className="text-[10px] bg-blue-600 text-white font-normal px-2 py-0.5 rounded-full not-italic">PDF ATTACHMENT</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Account: <span className="text-white font-bold">{emailModal.account.name}</span> • Branch: {branchMap[emailModal.account.employeeBranchId || emailModal.account.branchId || 'main'] || 'Head Office'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailModal(p => ({ ...p, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {/* Notification Message */}
              {emailModal.statusMsg && (
                <div className={`p-4 rounded-2xl flex items-center justify-between border ${
                  emailModal.statusMsg.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}>
                  <div className="flex items-center space-x-2.5 text-xs font-black">
                    {emailModal.statusMsg.type === 'success' ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-rose-600 shrink-0" />
                    )}
                    <span>{emailModal.statusMsg.text}</span>
                  </div>
                  <button 
                    onClick={() => setEmailModal(p => ({ ...p, statusMsg: null }))}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Email Configuration Form */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                      RECIPIENT EMAIL <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={emailModal.toEmail}
                        onChange={e => setEmailModal(p => ({ ...p, toEmail: e.target.value }))}
                        placeholder="example@gmail.com"
                        className="w-full h-10 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                      ACCOUNT HOLDER NAME
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={emailModal.recipientName}
                        onChange={e => setEmailModal(p => ({ ...p, recipientName: e.target.value }))}
                        className="w-full h-10 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                    EMAIL SUBJECT
                  </label>
                  <input
                    type="text"
                    value={emailModal.subject}
                    onChange={e => setEmailModal(p => ({ ...p, subject: e.target.value }))}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                    EMAIL MESSAGE
                  </label>
                  <textarea
                    rows={8}
                    value={emailModal.body}
                    onChange={e => setEmailModal(p => ({ ...p, body: e.target.value }))}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition-all leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setEmailModal(p => ({ ...p, isOpen: false }))}
                className="px-5 h-10 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                CANCEL
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={emailModal.isGeneratingPdf}
                  className="px-5 h-10 rounded-xl bg-slate-800 text-white hover:bg-slate-900 font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>{emailModal.isGeneratingPdf ? 'GENERATING...' : 'PDF DOWNLOAD'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendEmailStatement}
                  disabled={emailModal.isSending}
                  className="px-6 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {emailModal.isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>SENDING EMAIL...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>SEND STATEMENT EMAIL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN OFFICIAL LETTERHEAD STATEMENT CONTAINER FOR PDF GENERATION */}
      {emailModal.account && (
        <div className="fixed -left-[9999px] top-0 pointer-events-none">
          <div
            id="ledger-statement-pdf-target"
            className="w-[850px] bg-white p-8 font-sans text-black space-y-5"
            style={{
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'geometricPrecision'
            }}
          >
            {/* Top Official Letterhead */}
            <div className="border-b-2 border-black pb-4">
              <div className="flex items-center justify-center space-x-6">
                {/* Logo on the left */}
                <div className="shrink-0">
                  {settings?.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      className="w-20 h-20 object-contain"
                      alt="Ratauli SACCOS Logo"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-18 h-18 bg-black text-white rounded-xl flex items-center justify-center font-black text-2xl italic shadow-xs">
                      र
                    </div>
                  )}
                </div>

                {/* Header Titles */}
                <div className="text-center">
                  <h1 className="text-[26px] font-black text-black uppercase tracking-tight leading-tight">
                    रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                  </h1>
                  <p className="text-[12.5px] font-black text-black uppercase tracking-[0.22em] mt-1">
                    Ratauli Saving And Credit Cooperative Limited
                  </p>
                  <p className="text-xs font-bold text-black mt-1">
                    ठेगाना : {settings?.address || "पिपरा गाउँपालिका-६, रतौली, महोत्तरी, मधेश प्रदेश, नेपाल"}
                  </p>
                </div>
              </div>
            </div>

            {/* Title Below Header */}
            <div className="text-center py-1">
              <h2 className="text-lg font-black text-black uppercase tracking-wider">
                खाताको विवरण
              </h2>
            </div>

            {/* Account & Member Info Card */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50/80 border-2 border-black/30 rounded-xl p-4 text-xs text-black">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-black uppercase text-[11px] w-32">खातावालाको नाम:</span>
                  <span className="font-black text-black text-sm uppercase">{emailModal.account.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-black uppercase text-[11px] w-32">सम्बद्ध शाखा:</span>
                  <span className="font-black text-black">
                    {branchMap[emailModal.account.employeeBranchId || emailModal.account.branchId || 'main'] || 'Head Office'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-black uppercase text-[11px] w-32">सम्पर्क नम्बर:</span>
                  <span className="font-black text-black font-mono">{emailModal.account.mobile || 'N/A'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-black uppercase text-[11px] w-32">ठेगाना:</span>
                  <span className="font-black text-black">{emailModal.account.address || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-2 border-l-2 border-black/20 pl-4">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-black uppercase text-[11px] w-32">खाता प्रकार:</span>
                  <span className="font-black text-black uppercase">{emailModal.account.type}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-black uppercase text-[11px] w-32">वार्षिक ब्याजदर:</span>
                  <span className="font-black text-black font-mono">{emailModal.account.interestRate}% P.A.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-black uppercase text-[11px] w-32">खाता स्थिति:</span>
                  <span className={`font-black uppercase text-xs px-2.5 py-0.5 rounded border border-black ${
                    emailModal.account.status === 'Active' ? 'bg-emerald-100 text-black' : 'bg-rose-100 text-black'
                  }`}>
                    {emailModal.account.status === 'Active' ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-black uppercase text-[11px] w-32">स्थापना मिति:</span>
                  <span className="font-black text-black font-mono">
                    {new NepaliDate(new Date(emailModal.account.createdAt)).format('YYYY-MM-DD')} B.S.
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Transaction Table (English Headers & Words) */}
            <div>
              <div className="border-2 border-black rounded-lg overflow-hidden">
                <table className="w-full text-[10px] border-collapse text-left text-black">
                  <thead>
                    <tr className="bg-slate-100 text-black font-black uppercase text-[9.5px] border-b-2 border-black">
                      <th className="py-2.5 px-2 text-center w-12 border-r border-black">S.N.</th>
                      <th className="py-2.5 px-3 w-28 border-r border-black">Date (B.S.)</th>
                      <th className="py-2.5 px-3 border-r border-black">Particulars</th>
                      <th className="py-2.5 px-3 border-r border-black">Branch</th>
                      <th className="py-2.5 px-3 text-right border-r border-black">Debit (-)</th>
                      <th className="py-2.5 px-3 text-right border-r border-black">Credit (+)</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/20">
                    {emailStatementData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-black font-black uppercase">
                          No transaction records found
                        </td>
                      </tr>
                    ) : (
                      emailStatementData.rows.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="py-2 px-2 text-center font-mono font-bold text-black border-r border-black/20">
                            {row.sn}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-black border-r border-black/20 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-2 px-3 font-bold text-black border-r border-black/20">
                            {row.particulars}
                          </td>
                          <td className="py-2 px-3 text-[9px] font-bold text-black border-r border-black/20">
                            {row.branchName || 'Head Office'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-black border-r border-black/20">
                            {row.debit > 0 ? `Rs. ${row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-black border-r border-black/20">
                            {row.credit > 0 ? `Rs. ${row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-black whitespace-nowrap">
                            Rs. {Math.abs(row.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {row.balance < 0 ? 'Dr' : row.balance > 0 ? 'Cr' : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 text-black font-black text-[10px] border-t-2 border-black">
                      <td colSpan={4} className="py-2.5 px-3 uppercase text-right tracking-wider border-r border-black">
                        FINAL CLOSING BALANCE:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black border-r border-black">
                        Rs. {emailStatementData.kpis.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black border-r border-black">
                        Rs. {emailStatementData.kpis.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-black">
                        Rs. {Math.abs(emailStatementData.kpis.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {emailStatementData.kpis.balance < 0 ? 'Dr' : emailStatementData.kpis.balance > 0 ? 'Cr' : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Automated System & Email Generated Footer Note */}
            <div className="pt-4 border-t-2 border-black/30 text-center">
              <p className="text-xs font-bold text-black italic">
                This statement is system-generated and does not require a signature.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL SENT SUCCESS MODAL (Exact match with requested UI) */}
      {showEmailSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-200">
            {/* Green Check Circle */}
            <div className="w-16 h-16 rounded-full bg-[#d1fadf] flex items-center justify-center">
              <Check size={32} strokeWidth={3.5} className="text-[#039855]" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-[#101828] text-center leading-snug px-2">
              Email was successfully sent!
            </h3>

            {/* OK Button */}
            <button
              type="button"
              onClick={() => setShowEmailSuccessModal(false)}
              className="w-28 py-2.5 bg-[#2e7d32] hover:bg-[#256629] active:scale-95 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CompactKpi = ({ icon, label, value, color, isMain }: any) => (
  <div className={`px-5 py-3.5 rounded-2xl border border-white shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 flex items-center space-x-3 ${isMain ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
     <div className={`p-2 rounded-xl ${isMain ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 ' + color}`}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 16 })}
     </div>
     <div className="flex flex-col">
        <span className={`block text-[8px] font-black uppercase tracking-widest leading-none mb-1 ${isMain ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
        <div className={`text-base font-black italic tracking-tighter leading-none ${isMain ? 'text-white' : color}`}>रू {value.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
     </div>
  </div>
);

export default LedgerManagement;