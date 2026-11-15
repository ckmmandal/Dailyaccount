import React, { useMemo, useState, useEffect } from 'react';
import { 
  X, Mail, Calendar, 
  CreditCard, PieChart, Printer, 
  CheckCircle2,
  FileText,
  Key, Eye, EyeOff, Save, ShieldAlert,
  FileCheck, Phone, Shield, ChevronRight,
  Landmark, Loader2, Clock, CalendarCheck, Check,
  Receipt, Search, ArrowUpRight, ArrowDownRight, Filter, Building2
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { microFinanceService, MFSavingsRecord, MFLoanRecord, normalizeBsDate } from '../services/microFinanceService';
import { toBsDateString } from '../services/supabaseService';
import { User as UserType, Employee, PayrollRecord, LeaveRequest, LedgerAccount, SystemSettings, Branch, LeaveType, DailyData, ReceivablePayableEntry, AttendanceRecord, OfficeExpenseRecord } from '../types';
import { EmployeeKYCModal } from './EmployeeKYCModal';
import { NepaliDatePicker } from './NepaliDatePicker';
import { validateStrongPassword } from '../utils/passwordPolicy';
import { PasswordRequirementGuide } from './PasswordRequirementGuide';
import NepaliDate from 'nepali-date-converter';

const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const getDaysInBsMonth = (year: number, month1Indexed: number): number => {
  try {
    for (let d = 32; d >= 28; d--) {
      const nd = new NepaliDate(year, month1Indexed - 1, d);
      if (nd.getMonth() === month1Indexed - 1) {
        return d;
      }
    }
  } catch {
    return 30;
  }
  return 30;
};

interface UserProfilePortalProps {
  user: UserType;
  onClose: () => void;
  onViewSlip: (slip: PayrollRecord) => void;
  initialTab?: 'overview' | 'transactions' | 'attendance' | 'ledger' | 'payroll' | 'security';
}

interface UserTransactionItem {
  id: string;
  dateBs: string;
  module: string;
  accountHead: string;
  particulars: string;
  branchName: string;
  flowType: 'IN' | 'OUT';
  amount: number;
  sortTime: number;
}

interface StatementRow {
  sn: number;
  dateBs: string;
  dateAd: string;
  particulars: string;
  debit: number;
  credit: number;
  accrued: number;
  cap: number;
  balance: number;
  branchName: string;
  type: 'transaction' | 'accrual' | 'cap' | 'opening';
}

export const UserProfilePortal: React.FC<UserProfilePortalProps> = ({ user, onClose, onViewSlip, initialTab = 'overview' }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [allGlobalData, setAllGlobalData] = useState<Record<string, DailyData>>({});
  const [officeExpenses, setOfficeExpenses] = useState<OfficeExpenseRecord[]>([]);
  const [mfSavings, setMfSavings] = useState<MFSavingsRecord[]>([]);
  const [mfLoans, setMfLoans] = useState<MFLoanRecord[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'attendance' | 'ledger' | 'payroll' | 'security'>(initialTab);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');

  // Unified User Transaction Filters
  const [txSearch, setTxSearch] = useState('');
  const [txModuleFilter, setTxModuleFilter] = useState('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [txDateRange, setTxDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [isTxPrintOpen, setIsTxPrintOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Attendance state
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceYear, setAttendanceYear] = useState<number>(() => {
    try {
      return new NepaliDate().getYear();
    } catch {
      return 2083;
    }
  });
  const [attendanceMonth, setAttendanceMonth] = useState<number>(() => {
    try {
      return new NepaliDate().getMonth() + 1;
    } catch {
      return 4;
    }
  });
  const [isAttendancePrintOpen, setIsAttendancePrintOpen] = useState(false);

  const [statementDateRange, setStatementDateRange] = useState({
    start: new NepaliDate().format('YYYY') + '-01-01',
    end: new NepaliDate().format('YYYY-MM-DD')
  });

  useEffect(() => {
    const loadAllData = async () => {
      setLoadingData(true);
      try {
        const [b, lt, pr, lr, la, emps, sys, allData, attRecs, offExps, mfClosedLoans] = await Promise.all([
          storageService.getBranches(),
          storageService.getLeaveTypes(),
          storageService.getPayrollRecords(),
          storageService.getLeaveRequests(),
          storageService.getLedgerAccounts(),
          storageService.getEmployees().catch(() => []),
          storageService.getSettings().catch(() => null),
          storageService.getAllData().catch(() => ({})),
          storageService.getAttendanceRecords().catch(() => []),
          storageService.getOfficeExpenses().catch(() => []),
          microFinanceService.fetchClosedLoansFromSupabase().catch(() => [])
        ]);
        setBranches(b || []);
        setLeaveTypes(lt || []);
        setPayrollRecords(pr || []);
        setLeaveRequests(lr || []);
        setLedgerAccounts(la || []);
        setSettings(sys || null);
        setAllGlobalData(allData || {});
        setAttendanceRecords(attRecs || []);
        setOfficeExpenses(offExps || []);
        setMfSavings(microFinanceService.getSavings() || []);

        const localLoans = microFinanceService.getLoans() || [];
        const loanMap = new Map<string, MFLoanRecord>();
        [...(mfClosedLoans || []), ...localLoans].forEach(l => {
          if (l && l.id) loanMap.set(l.id, l);
        });
        setMfLoans(Array.from(loanMap.values()));
        
        const foundEmp = (emps || []).find(e => {
          const empName = (e.fullName || '').toLowerCase().trim();
          const userName = (user.fullName || '').toLowerCase().trim();
          const sameName = empName !== '' && empName === userName;
          
          const empEmail = (e.email || '').toLowerCase().trim();
          const userEmail = (user.email || '').toLowerCase().trim();
          const sameEmail = empEmail !== '' && userEmail !== '' && empEmail === userEmail;

          const empCode = (e.employeeCode || '').toLowerCase().trim();
          const username = (user.username || '').toLowerCase().trim();
          const sameCode = empCode !== '' && empCode === username;
          
          return sameName || sameEmail || sameCode;
        });
        setEmployee(foundEmp || null);
      } catch (error) {
        console.error("Failed to load profile data", error);
      } finally {
        setLoadingData(false);
      }
    };
    loadAllData();
  }, [user]);

  // Guaranteed Effective Employee for KYC generation even if not yet created in HR module
  const effectiveEmployee: Employee = useMemo(() => {
    if (employee) return employee;
    return {
      id: user.id || 'emp-user',
      employeeCode: 'EMP-' + (user.username || 'USR').toUpperCase(),
      fullName: user.fullName || 'User Profile',
      email: user.email || '',
      mobile: user.mobile || '9800000000',
      designation: user.roleId === '1' ? 'Chief Executive / Admin' : 'Operation Officer',
      department: 'Management & Operations',
      branchId: user.branchId || 'main',
      joinedDate: '2080-01-01',
      salary: 0,
      allowance: 0,
      status: 'Active',
      gender: 'Male',
      photoUrl: user.profilePhoto || '',
      citizenshipNo: '12-01-78-00000',
      panNo: '100000000',
      dobBs: '2050-01-01',
      fatherName: 'Not Registered',
      motherName: 'Not Registered',
      spouseName: '',
      grandFatherName: '',
      permanentAddress: 'Dhanusha, Madhesh Province, Nepal',
      temporaryAddress: 'Ratauli, Mahottari, Nepal'
    };
  }, [employee, user]);

  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSavingPass, setIsSavingPass] = useState(false);

  // Fetch linked Payroll Slips
  const mySlips = useMemo(() => {
    const targetId = employee?.id || user.id;
    return payrollRecords
      .filter(r => r.employeeId === targetId || r.employeeName?.toLowerCase() === user.fullName.toLowerCase())
      .sort((a, b) => b.generatedDate - a.generatedDate);
  }, [employee, user, payrollRecords]);

  // Fetch linked Ledger Account (for Advances/Payables)
  const myLedger = useMemo(() => {
    if (selectedLedgerId) {
      const found = ledgerAccounts.find(a => a.id === selectedLedgerId);
      if (found) return found;
    }
    return ledgerAccounts.find(a => 
      (a.employeeId && (a.employeeId === (employee?.id || user.id))) ||
      (a.employeeCode && (a.employeeCode.toUpperCase() === effectiveEmployee.employeeCode.toUpperCase())) ||
      (a.name && a.name.trim().toUpperCase() === (employee?.fullName || user.fullName).trim().toUpperCase())
    );
  }, [employee, user, ledgerAccounts, effectiveEmployee, selectedLedgerId]);

  const branchName = useMemo(() => {
    const bId = user.branchId || employee?.branchId;
    if (!bId || bId === 'main') return 'Ratauli Head Office';
    const found = branches.find(b => b.id === bId || b.code === bId);
    return found ? found.name : bId;
  }, [user, employee, branches]);

  const branchMap = useMemo(() => {
    const m: Record<string, string> = { main: 'Head Office' };
    branches.forEach(b => {
      m[b.id] = b.name;
      if (b.code) m[b.code] = b.name;
    });
    return m;
  }, [branches]);

  const f2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filter Attendance Records for Logged-In Employee
  const myAttendanceRecords = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return [];
    const empId = (employee?.id || '').toLowerCase().trim();
    const userEmpId = (user.id || '').toLowerCase().trim();
    const empCode = (employee?.employeeCode || effectiveEmployee.employeeCode || '').toLowerCase().trim();
    const empName = (employee?.fullName || user.fullName || '').toLowerCase().trim();
    const username = (user.username || '').toLowerCase().trim();

    return attendanceRecords.filter(r => {
      const rEmpId = (r.employeeId || '').toLowerCase().trim();
      const rCode = (r.employeeCode || '').toLowerCase().trim();
      const rName = (r.employeeName || '').toLowerCase().trim();

      if (empId && rEmpId === empId) return true;
      if (userEmpId && rEmpId === userEmpId) return true;
      if (empCode && (rCode === empCode || rEmpId === empCode)) return true;
      if (username && (rCode === username || rEmpId === username)) return true;
      if (empName && (rName === empName || rName.includes(empName) || empName.includes(rName))) return true;
      return false;
    });
  }, [attendanceRecords, employee, user, effectiveEmployee]);

  const monthDaysCount = useMemo(() => {
    return getDaysInBsMonth(attendanceYear, attendanceMonth);
  }, [attendanceYear, attendanceMonth]);

  const monthlyAttendanceList = useMemo(() => {
    const list = [];
    const mPad = String(attendanceMonth).padStart(2, '0');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let d = 1; d <= monthDaysCount; d++) {
      const dPad = String(d).padStart(2, '0');
      const bsDateStr = `${attendanceYear}-${mPad}-${dPad}`;
      
      let dayName = 'Day';
      let isWeekend = false;
      let adDateStr = '';

      try {
        const nd = new NepaliDate(attendanceYear, attendanceMonth - 1, d);
        const jsDate = nd.toJsDate();
        const dayIdx = jsDate.getDay();
        dayName = dayNames[dayIdx] || 'Day';
        isWeekend = dayIdx === 6; // Saturday is weekly off in Nepal
        const adY = jsDate.getFullYear();
        const adM = String(jsDate.getMonth() + 1).padStart(2, '0');
        const adD = String(jsDate.getDate()).padStart(2, '0');
        adDateStr = `${adY}-${adM}-${adD}`;
      } catch {
        // fallback
      }

      // Find matching attendance punch
      const record = myAttendanceRecords.find(r => {
        const rDate = (r.dateBs || r.date || '').replace(/\//g, '-').trim();
        return rDate === bsDateStr;
      });

      let status = record ? record.status : (isWeekend ? 'Weekend' : 'Not Recorded');
      if (!record && !isWeekend) {
        // Check leave requests
        const isApprovedLeave = leaveRequests.some(lr => {
          const matchEmp = lr.employeeId === employee?.id || lr.employeeId === user.id;
          if (!matchEmp || lr.status !== 'Approved') return false;
          return lr.startDate <= bsDateStr && lr.endDate >= bsDateStr;
        });
        if (isApprovedLeave) {
          status = 'Leave';
        }
      }

      list.push({
        dayNumber: d,
        bsDate: bsDateStr,
        adDate: adDateStr,
        dayName,
        isWeekend,
        status,
        inTime: record?.inTime || '-',
        outTime: record?.outTime || '-',
        workHours: record?.workHours || (record?.inTime && record?.outTime && record?.inTime !== '-' ? 8 : 0),
        remarks: record?.remarks || (isWeekend ? 'Weekly Off (Saturday)' : ''),
        source: record?.source || 'system'
      });
    }
    return list;
  }, [attendanceYear, attendanceMonth, monthDaysCount, myAttendanceRecords, leaveRequests, employee, user]);

  const attStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let halfDay = 0;
    let leave = 0;
    let absent = 0;
    let weekend = 0;
    let totalHours = 0;

    monthlyAttendanceList.forEach(item => {
      if (item.status === 'Present') {
        present++;
      } else if (item.status === 'Late') {
        present++;
        late++;
      } else if (item.status === 'HalfDay') {
        halfDay++;
        present += 0.5;
      } else if (item.status === 'Leave') {
        leave++;
      } else if (item.status === 'Absent') {
        absent++;
      } else if (item.status === 'Weekend') {
        weekend++;
      }
      
      if (item.workHours) totalHours += Number(item.workHours);
    });

    const workingDays = Math.max(1, monthDaysCount - weekend);
    const attendanceRate = Math.min(100, Math.round((present / workingDays) * 100));

    return {
      totalDays: monthDaysCount,
      workingDays,
      present,
      late,
      halfDay,
      leave,
      absent,
      weekend,
      totalHours: totalHours.toFixed(1),
      attendanceRate
    };
  }, [monthlyAttendanceList, monthDaysCount]);

  // Generate Multi-Branch Statement Data
  const statementData = useMemo(() => {
    if (!myLedger) {
      return { 
        rows: [], 
        kpis: { opening: 0, totalDebit: 0, totalCredit: 0, accrued: 0, balance: 0, principal: 0 } 
      };
    }

    const transactions: (ReceivablePayableEntry & { sourceBranch?: string })[] = [];
    const targetNameUpper = myLedger.name.trim().toUpperCase();

    // Iterate through all data across all branches
    Object.values(allGlobalData).forEach((day) => {
      (day.transactions || []).forEach(tx => {
        const txDescUpper = (tx.description || '').trim().toUpperCase();
        if (
          (tx.accountId && tx.accountId === myLedger.id) || 
          (txDescUpper && txDescUpper === targetNameUpper)
        ) {
          transactions.push({
            ...tx,
            sourceBranch: day.branchId || tx.branchId || 'main'
          });
        }
      });
    });

    const creationBs = new NepaliDate(new Date(myLedger.createdAt)).format('YYYY-MM-DD');
    let calcStartBs = creationBs;
    transactions.forEach(t => {
      if (t.date) {
        const tBs = toBsDateString(t.date);
        if (tBs < calcStartBs) calcStartBs = tBs;
      }
    });

    const rows: StatementRow[] = [];
    let currentPrincipal = myLedger.openingBalance;
    let currentBalance = myLedger.openingBalance;
    let accumulatedInterest = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let sn = 1;

    let simDate = new NepaliDate(calcStartBs);
    const today = new NepaliDate();
    const creationDateAd = new Date(myLedger.createdAt).toISOString().split('T')[0];

    rows.push({
      sn: sn++,
      dateBs: creationBs,
      dateAd: creationDateAd,
      particulars: 'OPENING BALANCE',
      debit: 0, 
      credit: 0, 
      accrued: 0, 
      cap: 0,
      balance: currentBalance,
      branchName: branchMap[myLedger.branchId] || 'Head Office',
      type: 'opening'
    });

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
          dateBs: bsDateStr,
          dateAd: adDateStr,
          particulars: 'INTEREST ACCRUED',
          debit: 0, 
          credit: 0, 
          accrued: accumulatedInterest, 
          cap: 0,
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
          dateBs: bsDateStr,
          dateAd: adDateStr,
          particulars: tx.remarks || (tx.type === 'in' ? 'CASH RECEIVED' : 'CASH PAYMENT / ADVANCE'),
          debit: tx.type === 'out' ? tx.amount : 0,
          credit: tx.type === 'in' ? tx.amount : 0,
          accrued: 0, 
          cap: 0,
          balance: currentBalance,
          branchName: bName,
          type: 'transaction'
        });
      });

      if (adDateStr >= creationDateAd) {
        const dailyRate = ((myLedger.interestRate || 0) / 100) / 365;
        const dailyInterest = currentBalance * dailyRate;
        accumulatedInterest += dailyInterest;
      }

      const nextDay = new NepaliDate(simDate.toJsDate().getTime() + 86400000);
      
      let shouldCap = false;
      if (myLedger.capitalizationFrequency === 'Monthly' && nextDay.getMonth() !== simDate.getMonth()) shouldCap = true;
      if (myLedger.capitalizationFrequency === 'Yearly' && nextDay.getYear() !== simDate.getYear()) shouldCap = true;

      if (shouldCap && myLedger.capitalizeToPrincipal && accumulatedInterest > 0) {
        currentBalance += accumulatedInterest;
        currentPrincipal = currentBalance;
        rows.push({
          sn: sn++,
          dateBs: bsDateStr,
          dateAd: adDateStr,
          particulars: 'INTEREST CAPITALIZED',
          debit: 0, 
          credit: 0, 
          accrued: 0, 
          cap: accumulatedInterest,
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
        dateBs: today.format('YYYY-MM-DD'),
        dateAd: new Date().toISOString().split('T')[0],
        particulars: 'INTEREST ACCRUED TO DATE',
        debit: 0, 
        credit: 0, 
        accrued: accumulatedInterest, 
        cap: 0,
        balance: currentBalance,
        branchName: 'System Calculation',
        type: 'accrual'
      });
    }

    const startBs = toBsDateString(statementDateRange.start);
    const endBs = toBsDateString(statementDateRange.end);
    const filteredRows = rows.filter(r => r.dateBs >= startBs && r.dateBs <= endBs);

    return { 
      rows: filteredRows, 
      allRows: rows,
      kpis: { 
        opening: myLedger.openingBalance, 
        totalDebit,
        totalCredit,
        accrued: accumulatedInterest, 
        principal: currentPrincipal, 
        balance: currentBalance + accumulatedInterest 
      } 
    };
  }, [myLedger, allGlobalData, statementDateRange, branchMap]);

  const myTransactions = useMemo<UserTransactionItem[]>(() => {
    const userIdSet = new Set<string>();
    const userNameSet = new Set<string>();
    [user.id, user.username, employee?.id, employee?.employeeCode].forEach(val => {
      const clean = (val || '').toString().trim().toLowerCase();
      if (clean && clean !== 'sys' && clean !== 'system') {
        userIdSet.add(clean);
      }
    });
    [user.fullName, employee?.fullName].forEach(val => {
      const clean = (val || '').toString().trim().toLowerCase();
      if (clean && clean !== 'sys' && clean !== 'system') {
        userNameSet.add(clean);
      }
    });

    const matchesUserCreator = (...candidates: (string | undefined | null)[]): boolean => {
      for (const raw of candidates) {
        const clean = (raw || '').toString().trim().toLowerCase();
        if (!clean || clean === 'sys' || clean === 'system') continue;
        if (userIdSet.has(clean) || userNameSet.has(clean)) return true;
      }
      return false;
    };

    const ledgerNameMap = new Map<string, string>();
    (ledgerAccounts || []).forEach(acc => {
      if (acc.id) ledgerNameMap.set(acc.id, acc.name);
    });

    const items: UserTransactionItem[] = [];
    const seen = new Set<string>();

    const pushItem = (item: UserTransactionItem) => {
      const dedupeKey = `${item.module}__${item.id}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      items.push(item);
    };

    Object.entries(allGlobalData || {}).forEach(([dayKey, dayData]) => {
      if (!dayData) return;
      const rawDate = dayData.date || dayKey.split('__')[0] || '';
      const dateBs = normalizeBsDate(toBsDateString(rawDate));
      const bId = dayData.branchId || dayKey.split('__')[1] || 'main';
      const bName = branchMap[bId] || bId || 'Head Office';

      (dayData.transactions || []).forEach((tx, idx) => {
        if (!matchesUserCreator(tx.createdBy, tx.createdByName)) return;
        const headName = (tx.accountId && ledgerNameMap.get(tx.accountId)) || tx.description || 'Ledger Account';
        pushItem({
          id: tx.id || `ledger-${dayKey}-${idx}`,
          dateBs,
          module: 'Teller Ledger',
          accountHead: headName,
          particulars: tx.remarks || tx.description || 'Ledger Posting',
          branchName: branchMap[tx.branchId || bId] || bName,
          flowType: tx.type === 'in' ? 'IN' : 'OUT',
          amount: Number(tx.amount || 0),
          sortTime: Number(tx.id?.match(/\d{10,}/)?.[0] || 0)
        });
      });

      (dayData.officeTransactions || []).forEach((tx, idx) => {
        if (!matchesUserCreator(tx.createdBy, tx.createdByName)) return;
        const origin = String(tx.origin || '');
        const moduleLabel =
          origin === 'teller_counter' ? 'Front Teller' :
          origin === 'income_expense' ? 'Income/Exp' :
          origin === 'office_expense' ? 'Office Expenses' :
          origin === 'payroll' ? 'HR Payroll' :
          origin === 'report' || origin === 'back_office' || origin === 'transferred' ? 'Back Office' :
          'Office Counter';

        pushItem({
          id: tx.id || `office-${dayKey}-${idx}`,
          dateBs,
          module: moduleLabel,
          accountHead: tx.head || 'Office Account',
          particulars: tx.remarks || `${moduleLabel} Entry`,
          branchName: branchMap[tx.branchId || bId] || bName,
          flowType: tx.type === 'in' ? 'IN' : 'OUT',
          amount: Number(tx.amount || 0),
          sortTime: Number(tx.id?.match(/\d{10,}/)?.[0] || 0)
        });
      });

      (dayData.remittances || []).forEach((r, idx) => {
        if (!matchesUserCreator(r.createdBy, r.createdByName)) return;
        const isReceive = String(r.type).toLowerCase() === 'receive';
        pushItem({
          id: r.id || `remit-${dayKey}-${idx}`,
          dateBs,
          module: r.origin === 'report' ? 'Back Office Remit' : 'Front Teller Remit',
          accountHead: r.companyName || 'Remittance',
          particulars: [r.type, r.referenceNo ? `Ref: ${r.referenceNo}` : '', r.remarks].filter(Boolean).join(' • ') || 'Remittance Entry',
          branchName: branchMap[r.branchId || bId] || bName,
          flowType: isReceive ? 'IN' : 'OUT',
          amount: Number(r.amount || 0),
          sortTime: Number(r.transferredAt || r.id?.match(/\d{10,}/)?.[0] || 0)
        });
      });

      (dayData.vaultTransactions || []).forEach((v, idx) => {
        if (!matchesUserCreator(v.createdBy, v.createdByName)) return;
        pushItem({
          id: v.id || `vault-${dayKey}-${idx}`,
          dateBs,
          module: 'Vault Control',
          accountHead: `${v.source || 'Vault'} ${v.type === 'in' ? 'Deposit' : 'Withdrawal'}`,
          particulars: v.remarks || (v.counterBranchName ? `Branch: ${v.counterBranchName}` : 'Vault Operation'),
          branchName: branchMap[v.branchId || bId] || bName,
          flowType: v.type === 'in' ? 'IN' : 'OUT',
          amount: Number(v.amount || 0),
          sortTime: Number(v.id?.match(/\d{10,}/)?.[0] || 0)
        });
      });

      (dayData.denoAdjustments || []).forEach((d, idx) => {
        if (!matchesUserCreator(d.createdBy, d.createdByName)) return;
        pushItem({
          id: d.id || `deno-${dayKey}-${idx}`,
          dateBs,
          module: 'Denomination',
          accountHead: `Note Rs. ${d.value} x ${d.quantity}`,
          particulars: d.isManualVault ? 'Vault Denomination Adjustment' : 'Counter Denomination Adjustment',
          branchName: bName,
          flowType: d.type === 'add' ? 'IN' : 'OUT',
          amount: Number(d.value || 0) * Number(d.quantity || 0),
          sortTime: Number(d.createdAt || d.id?.match(/\d{10,}/)?.[0] || 0)
        });
      });

      (dayData.otherEntries || []).forEach((o, idx) => {
        if (!matchesUserCreator(o.userId, o.userName)) return;
        pushItem({
          id: o.id || `other-${dayKey}-${idx}`,
          dateBs,
          module: 'Cash Adjustment',
          accountHead: 'Other Cash Adjustment',
          particulars: o.remarks || (o.type === 'add' ? 'Cash Added' : 'Cash Deducted'),
          branchName: bName,
          flowType: o.type === 'add' ? 'IN' : 'OUT',
          amount: Number(o.amount || 0),
          sortTime: Number(o.timestamp || o.id?.match(/\d{10,}/)?.[0] || 0)
        });
      });
    });

    (officeExpenses || []).forEach((exp, idx) => {
      if (!matchesUserCreator(exp.recordedBy)) return;
      const dateBs = normalizeBsDate(toBsDateString(exp.date || ''));
      pushItem({
        id: exp.id || `offexp-${idx}`,
        dateBs,
        module: 'Office Expenses',
        accountHead: exp.categoryLabel || exp.category || 'Office Expense',
        particulars: [exp.paidTo ? `Paid to: ${exp.paidTo}` : '', exp.billNo ? `Bill: ${exp.billNo}` : '', exp.remarks].filter(Boolean).join(' • ') || exp.month || 'Office Expense Entry',
        branchName: branchMap[exp.branchId] || exp.branchId || 'Head Office',
        flowType: 'OUT',
        amount: Number(exp.netPaidAmount || exp.amount || 0),
        sortTime: Number(exp.createdAt || 0)
      });
    });

    (mfSavings || []).forEach((s, idx) => {
      if (!matchesUserCreator(s.createdBy, s.createdByName, s.collectedBy)) return;
      const dateBs = normalizeBsDate(s.dateBs || toBsDateString(s.date || ''));
      pushItem({
        id: s.id || `mfsav-${idx}`,
        dateBs,
        module: 'Micro-Finance Saving',
        accountHead: `${s.name} (${s.accountNo})`,
        particulars: [s.savingType, s.groupName, s.receiptNo ? `Rec: ${s.receiptNo}` : '', s.remarks].filter(Boolean).join(' • '),
        branchName: branchName,
        flowType: 'IN',
        amount: Number(s.amount || 0),
        sortTime: s.createdAt ? new Date(s.createdAt).getTime() || 0 : 0
      });
    });

    (mfLoans || []).forEach((l, idx) => {
      if (!matchesUserCreator(l.createdBy, l.createdByName)) return;
      const dateBs = normalizeBsDate(l.loanDateBs || toBsDateString(l.loanDate || ''));
      pushItem({
        id: l.id || `mfln-${idx}`,
        dateBs,
        module: 'Micro-Finance Loan',
        accountHead: `${l.name} (${l.accountNo})`,
        particulars: `${l.loanProduct} • ${l.totalInstallments}M @ ${l.interestRate}% (${l.status})`,
        branchName: branchName,
        flowType: 'OUT',
        amount: Number(l.loanAmount || 0),
        sortTime: l.createdAt ? new Date(l.createdAt).getTime() || 0 : 0
      });
    });

    return items.sort((a, b) => {
      if (b.dateBs !== a.dateBs) return b.dateBs.localeCompare(a.dateBs);
      return b.sortTime - a.sortTime;
    });
  }, [allGlobalData, officeExpenses, mfSavings, mfLoans, ledgerAccounts, branchMap, branchName, user, employee]);

  const txModuleOptions = useMemo(() => {
    const set = new Set<string>();
    myTransactions.forEach(t => set.add(t.module));
    return Array.from(set).sort();
  }, [myTransactions]);

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    const startBs = txDateRange.start ? normalizeBsDate(toBsDateString(txDateRange.start)) : '';
    const endBs = txDateRange.end ? normalizeBsDate(toBsDateString(txDateRange.end)) : '';

    return myTransactions.filter(tx => {
      if (txModuleFilter !== 'ALL' && tx.module !== txModuleFilter) return false;
      if (txTypeFilter !== 'ALL' && tx.flowType !== txTypeFilter) return false;
      if (startBs && tx.dateBs < startBs) return false;
      if (endBs && tx.dateBs > endBs) return false;
      if (q) {
        const hay = `${tx.dateBs} ${tx.module} ${tx.accountHead} ${tx.particulars} ${tx.branchName} ${tx.amount}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [myTransactions, txSearch, txModuleFilter, txTypeFilter, txDateRange]);

  const txStats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    filteredTransactions.forEach(t => {
      if (t.flowType === 'IN') totalIn += t.amount;
      else totalOut += t.amount;
    });
    return {
      count: filteredTransactions.length,
      totalIn,
      totalOut,
      netFlow: totalIn - totalOut
    };
  }, [filteredTransactions]);

  const handlePrintStatement = () => {
    window.print();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      setUpdateMsg({ text: 'New password and confirm password do not match or are empty!', type: 'error' });
      return;
    }

    const validation = validateStrongPassword(newPassword, user.username);
    if (!validation.isValid) {
      setUpdateMsg({ text: validation.errors[0] || 'Password must meet strong security policy requirements.', type: 'error' });
      return;
    }

    setIsSavingPass(true);
    try {
      const users = await storageService.getUsers().catch(() => []);
      const userList = Array.isArray(users) ? users : [];
      const userIndex = userList.findIndex(u => u && (u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase()));
      
      if (userIndex > -1) {
        const updatedUser = { 
          ...userList[userIndex], 
          password: newPassword,
          passwordUpdatedAt: Date.now(),
          forcePasswordChange: false 
        };
        await storageService.saveUser(updatedUser);
        localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(updatedUser));
        await storageService.saveLog(user.id, 'CHANGE_PASSWORD', `User @${user.username} updated password in profile (3-month policy renewed)`);
        
        setUpdateMsg({ text: 'Security password updated successfully!', type: 'success' });
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setUpdateMsg(null);
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to update password", error);
      setUpdateMsg({ text: 'Error updating password.', type: 'error' });
    } finally {
      setIsSavingPass(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[6000] flex flex-col overflow-hidden animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-100 w-full h-full flex flex-col overflow-hidden">
        
        {/* Modern Full-Width Header */}
        <div className="px-6 py-4 bg-emerald-50 text-slate-900 relative overflow-hidden shrink-0 border-b border-emerald-200">
          <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-emerald-500/60 overflow-hidden bg-white shadow-sm shrink-0 relative">
                {(employee?.photoUrl || user.profilePhoto) ? (
                  <img src={employee?.photoUrl || user.profilePhoto} className="w-full h-full object-cover" alt="User Profile" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-emerald-800 font-black text-2xl bg-emerald-100">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-2xs">
                    {user.roleId === '1' ? 'Super Admin' : 'Staff'}
                  </span>
                  <span className="text-emerald-900/70 text-xs font-bold tracking-wider">
                    @{user.username} • {effectiveEmployee.employeeCode}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase leading-tight text-slate-900">
                  {employee?.fullName || user.fullName}
                </h2>
                <div className="flex items-center space-x-3 text-xs text-emerald-700 font-bold mt-0.5">
                  <span>{employee?.designation || (user.roleId === '1' ? 'System Administrator' : 'Operator')}</span>
                  <span className="text-emerald-300">•</span>
                  <span className="text-slate-600">{branchName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button 
                onClick={onClose} 
                className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-600 flex items-center space-x-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                title="Close Portal"
              >
                <X size={16}/>
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="max-w-7xl mx-auto w-full flex items-center space-x-2 mt-4 pt-3 border-t border-emerald-200/80 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-100/60'
              }`}
            >
              Overview & KYC
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'transactions'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-100/60'
              }`}
            >
              <Receipt size={13}/>
              <span>Transaction</span>
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-100/60'
              }`}
            >
              <Clock size={13}/>
              <span>My Attendance</span>
              {attStats.present > 0 && (
                <span className={`ml-1 px-1.5 py-0.2 rounded text-[9px] font-black ${
                  activeTab === 'attendance' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {attStats.present}d
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-100/60'
              }`}
            >
              <FileText size={13}/>
              <span>Ledger Statement</span>
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'payroll'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-100/60'
              }`}
            >
              Leaves & Salary ({mySlips.length})
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-100/60'
              }`}
            >
              Security
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          <div className="max-w-7xl mx-auto w-full space-y-4">
          {loadingData ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <Loader2 className="animate-spin text-emerald-500" size={36} />
              <span className="text-xs font-bold uppercase tracking-wider">Loading Profile Data...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & KYC */}
          {activeTab === 'overview' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Prominent KYC Document Action Card */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 text-slate-900 p-4 rounded-2xl shadow-xs border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-300 shrink-0">
                    <FileCheck size={22} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black uppercase tracking-tight text-slate-900">Employee KYC Form</span>
                      <span className="bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded uppercase">Verified PDF</span>
                    </div>
                    <span className="text-[11px] text-slate-600 block mt-0.5 font-medium">
                      Citizenship, family background, service records and official KYC verification document
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowKYCModal(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer shrink-0"
                >
                  <Printer size={15} />
                  <span>View KYC PDF</span>
                </button>
              </div>

              {/* Personal & Contact Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0"><Mail size={15}/></div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Email Address</span>
                    <span className="text-xs text-slate-900 font-bold truncate block">{user.email || effectiveEmployee.email || 'not.linked@system.com'}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center space-x-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0"><Phone size={15}/></div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Mobile Number</span>
                    <span className="text-xs text-slate-900 font-bold block">{effectiveEmployee.mobile || user.mobile || 'N/A'}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center space-x-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0"><Calendar size={15}/></div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Joined Date</span>
                    <span className="text-xs text-slate-900 font-bold uppercase">{effectiveEmployee.joinedDate || '2080-01-01'}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center space-x-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0"><Shield size={15}/></div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Citizenship / ID No.</span>
                    <span className="text-xs text-slate-900 font-bold uppercase">{effectiveEmployee.citizenshipNo || 'Verified On File'}</span>
                  </div>
                </div>
              </div>

              {/* Staff Ledger Standing Quick Card */}
              {myLedger ? (
                <div className="bg-emerald-50/90 text-slate-900 p-4 rounded-2xl shadow-xs border border-emerald-200 border-l-4 border-l-emerald-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider">Linked Staff Ledger Account</span>
                      <span className="text-[8px] font-black uppercase bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded">
                        {myLedger.status}
                      </span>
                    </div>
                    <h5 className="text-sm font-black uppercase text-slate-900">{myLedger.name}</h5>
                    <div className="flex items-center space-x-3 text-xs text-slate-600 mt-1">
                      <span>Balance: <b className="text-slate-900">NPR {f2(statementData.kpis.balance)}</b></span>
                      <span>•</span>
                      <span>Interest Rate: <b className="text-emerald-700">{myLedger.interestRate}% P.A.</b></span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('ledger')}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    <FileText size={15}/>
                    <span>View Ledger Statement</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><FileText size={18}/></div>
                    <div>
                      <h5 className="text-xs font-black uppercase text-slate-900">Staff Ledger Statement</h5>
                      <p className="text-[11px] text-slate-500">View detailed staff ledger statement and multi-branch transactions.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('ledger')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                  >
                    Open Statement
                  </button>
                </div>
              )}

              {/* Leave Balance Overview */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center">
                    <PieChart size={13} className="mr-1.5 text-emerald-600"/> Leave Balance Summary
                  </h4>
                  <button 
                    onClick={() => setActiveTab('payroll')} 
                    className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center space-x-0.5"
                  >
                    <span>View Details</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {leaveTypes.slice(0, 3).map(lt => {
                    const taken = employee ? leaveRequests
                      .filter(r => r.employeeId === employee.id && r.leaveTypeId === lt.id && r.status === 'Approved')
                      .reduce((s, r) => s + r.days, 0) : 0;
                    return (
                      <div key={lt.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                        <span className="text-[9px] font-bold text-slate-600 truncate w-full mb-0.5">{lt.name || lt.nameNp}</span>
                        <div className="text-base font-black text-slate-900 leading-none">{lt.totalDays - taken}</div>
                        <span className="text-[8px] text-emerald-600 uppercase font-black mt-0.5">Days Left</span>
                      </div>
                    );
                  })}
                  {leaveTypes.length === 0 && (
                    <div className="col-span-3 text-center py-2 text-slate-400 text-xs font-medium">
                      No leave records found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: MY ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Header & Filter Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                      <Clock size={20}/>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        My Monthly Attendance Record
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Track your daily check-in, check-out, working hours, and monthly punch status.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* BS Year Selector */}
                    <div className="flex items-center space-x-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                        BS Year
                      </label>
                      <select
                        value={attendanceYear}
                        onChange={(e) => setAttendanceYear(Number(e.target.value))}
                        className="h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        {[2080, 2081, 2082, 2083, 2084, 2085].map(y => (
                          <option key={y} value={y}>{y} BS</option>
                        ))}
                      </select>
                    </div>

                    {/* BS Month Selector */}
                    <div className="flex items-center space-x-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                        BS Month
                      </label>
                      <select
                        value={attendanceMonth}
                        onChange={(e) => setAttendanceMonth(Number(e.target.value))}
                        className="h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        {NEPALI_MONTHS.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m} ({idx + 1})</option>
                        ))}
                      </select>
                    </div>

                    {/* Print Attendance Button */}
                    <button
                      onClick={() => setIsAttendancePrintOpen(true)}
                      className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
                    >
                      <Printer size={13}/>
                      <span>Print Sheet</span>
                    </button>
                  </div>
                </div>

                {/* Target Period & Employee Info summary row */}
                <div className="flex flex-wrap items-center justify-between text-xs font-bold text-slate-600 gap-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-[10px] uppercase font-black">Employee:</span>
                    <span className="text-slate-900 font-black">{employee?.fullName || user.fullName} ({effectiveEmployee.employeeCode})</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-emerald-700">{employee?.designation || 'Staff'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <span className="text-slate-400 text-[10px] uppercase font-black">Period:</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black">
                      {NEPALI_MONTHS[attendanceMonth - 1]} {attendanceYear} BS
                    </span>
                    <span className="text-slate-400 text-[10px]">({monthDaysCount} Total Days)</span>
                  </div>
                </div>
              </div>

              {/* Summary Metric KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {/* Total Working Days */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Working Days</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{attStats.workingDays}</div>
                  <div className="text-[9px] font-bold text-slate-500 mt-0.5">Excl. {attStats.weekend} Saturdays</div>
                </div>

                {/* Present */}
                <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Present</div>
                  <div className="text-xl font-black text-emerald-900 mt-1">{attStats.present}</div>
                  <div className="text-[9px] font-bold text-emerald-700 mt-0.5">Days Recorded</div>
                </div>

                {/* Late */}
                <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80 shadow-2xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">Late Punch</div>
                  <div className="text-xl font-black text-amber-900 mt-1">{attStats.late}</div>
                  <div className="text-[9px] font-bold text-amber-700 mt-0.5">Delayed Arrivals</div>
                </div>

                {/* Leave */}
                <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200/80 shadow-2xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-800">Leave</div>
                  <div className="text-xl font-black text-blue-900 mt-1">{attStats.leave}</div>
                  <div className="text-[9px] font-bold text-blue-700 mt-0.5">Approved Leaves</div>
                </div>

                {/* Absent */}
                <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200/80 shadow-2xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-rose-800">Absent</div>
                  <div className="text-xl font-black text-rose-900 mt-1">{attStats.absent}</div>
                  <div className="text-[9px] font-bold text-rose-700 mt-0.5">Missed Days</div>
                </div>

                {/* Attendance Rate */}
                <div className="bg-emerald-50/90 p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Attendance Rate</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{attStats.attendanceRate}%</div>
                  <div className="w-full bg-emerald-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${attStats.attendanceRate}%` }} />
                  </div>
                </div>
              </div>

              {/* Daily Attendance Breakdown Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CalendarCheck size={15} className="text-emerald-600"/>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-tight">
                      Daily Attendance Log ({NEPALI_MONTHS[attendanceMonth - 1]} {attendanceYear})
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
                    Total Work Hours: {attStats.totalHours} hrs
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-[11px] border-collapse text-left">
                    <thead className="bg-slate-50 text-slate-800 uppercase font-black tracking-wider text-[9px] sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 border-r border-slate-200 w-12 text-center">Day</th>
                        <th className="p-2.5 border-r border-slate-200 w-32">BS Date</th>
                        <th className="p-2.5 border-r border-slate-200 w-28 text-slate-500">AD Date</th>
                        <th className="p-2.5 border-r border-slate-200 w-28">In Time</th>
                        <th className="p-2.5 border-r border-slate-200 w-28">Out Time</th>
                        <th className="p-2.5 border-r border-slate-200 w-20 text-center">Hours</th>
                        <th className="p-2.5 border-r border-slate-200 w-28 text-center">Status</th>
                        <th className="p-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {monthlyAttendanceList.map(item => {
                        const isSat = item.isWeekend;
                        return (
                          <tr 
                            key={item.bsDate}
                            className={`hover:bg-slate-50 transition-colors ${
                              isSat ? 'bg-slate-50/70 font-semibold' : 
                              item.status === 'Late' ? 'bg-amber-50/30' : 
                              item.status === 'Absent' ? 'bg-rose-50/30' : 
                              item.status === 'Leave' ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            <td className="p-2.5 border-r border-slate-100 text-slate-400 font-mono text-center font-bold">
                              {item.dayNumber}
                            </td>
                            <td className="p-2.5 border-r border-slate-100 whitespace-nowrap font-bold">
                              <span className="font-mono text-slate-800">{item.bsDate}</span>
                              <span className={`text-[10px] ml-1.5 font-bold ${isSat ? 'text-rose-600' : 'text-slate-500'}`}>
                                ({item.dayName})
                              </span>
                            </td>
                            <td className="p-2.5 border-r border-slate-100 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                              {item.adDate || '-'}
                            </td>
                            <td className="p-2.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap font-bold">
                              {item.inTime}
                            </td>
                            <td className="p-2.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap font-bold">
                              {item.outTime}
                            </td>
                            <td className="p-2.5 border-r border-slate-100 font-mono text-center text-slate-600 font-bold">
                              {item.workHours > 0 ? `${item.workHours}h` : '-'}
                            </td>
                            <td className="p-2.5 border-r border-slate-100 text-center whitespace-nowrap">
                              {item.status === 'Present' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                  <Check size={10} className="stroke-[3]" />
                                  <span>Present</span>
                                </span>
                              )}
                              {item.status === 'Late' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                                  <span>Late</span>
                                </span>
                              )}
                              {item.status === 'HalfDay' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                                  <span>Half Day</span>
                                </span>
                              )}
                              {item.status === 'Leave' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-black uppercase">
                                  <span>Leave</span>
                                </span>
                              )}
                              {item.status === 'Absent' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                                  <span>Absent</span>
                                </span>
                              )}
                              {item.status === 'Weekend' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-black uppercase">
                                  <span>Weekly Off</span>
                                </span>
                              )}
                              {item.status === 'Not Recorded' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[10px] font-bold">
                                  <span>-</span>
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-500 text-[11px]">
                              {item.remarks || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LEDGER STATEMENT BUILDER */}
          {activeTab === 'ledger' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              
              {/* Account Selection / Header Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                      <Landmark size={20}/>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                          STAFF LEDGER (MULTI-BRANCH)
                        </span>
                        {myLedger && (
                          <span className="text-[9px] font-bold text-slate-500">
                            {myLedger.interestRate}% P.A. • {myLedger.capitalizationFrequency} Cap
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-black uppercase text-slate-900 mt-0.5">
                        {myLedger?.name || effectiveEmployee.fullName}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    {/* Account Selector if multiple or switch */}
                    {ledgerAccounts.length > 1 && (
                      <select 
                        value={myLedger?.id || ''}
                        onChange={e => setSelectedLedgerId(e.target.value)}
                        className="h-8.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                      >
                        <option value="">-- Auto-Linked Account --</option>
                        {ledgerAccounts.map(la => (
                          <option key={la.id} value={la.id}>{la.name} (NPR {la.openingBalance})</option>
                        ))}
                      </select>
                    )}
                    
                    <button 
                      onClick={handlePrintStatement}
                      className="px-3.5 h-8.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Printer size={13}/>
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {/* Date Range Selector & Presets */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">DATE RANGE:</span>
                    <div className="flex items-center space-x-2">
                      <NepaliDatePicker 
                        value={statementDateRange.start} 
                        onChange={v => setStatementDateRange(p => ({ ...p, start: v }))} 
                        className="w-[110px] scale-90 origin-left"
                      />
                      <span className="text-slate-400 font-black text-xs uppercase">TO</span>
                      <NepaliDatePicker 
                        value={statementDateRange.end} 
                        onChange={v => setStatementDateRange(p => ({ ...p, end: v }))} 
                        className="w-[110px] scale-90 origin-left"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button 
                      onClick={() => setStatementDateRange({
                        start: '2080-01-01',
                        end: new NepaliDate().format('YYYY-MM-DD')
                      })}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                    >
                      All Time
                    </button>
                    <button 
                      onClick={() => {
                        const now = new NepaliDate();
                        setStatementDateRange({
                          start: `${now.getYear()}-04-01`,
                          end: now.format('YYYY-MM-DD')
                        });
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                    >
                      Fiscal Year
                    </button>
                    <button 
                      onClick={() => {
                        const now = new NepaliDate();
                        setStatementDateRange({
                          start: `${now.getYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
                          end: now.format('YYYY-MM-DD')
                        });
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                    >
                      This Month
                    </button>
                  </div>
                </div>
              </div>

              {/* Multi-Branch Statement Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText size={14} className="text-blue-600"/>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-tight">
                      DETAILED STATEMENT ENTRIES
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
                    Total Records: {statementData.rows.length}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-[10px] border-collapse text-left">
                    <thead className="bg-slate-50 text-slate-800 uppercase font-black tracking-wider text-[8px] sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="p-2 border-r border-slate-200 w-10">SN</th>
                        <th className="p-2 border-r border-slate-200 w-24">DATE (BS)</th>
                        <th className="p-2 border-r border-slate-200">PARTICULARS</th>
                        <th className="p-2 border-r border-slate-200 text-right w-24 text-rose-600">DEBIT (-)</th>
                        <th className="p-2 border-r border-slate-200 text-right w-24 text-emerald-600">CREDIT (+)</th>
                        <th className="p-2 border-r border-slate-200 text-right w-20 text-amber-600">INTEREST</th>
                        <th className="p-2 border-r border-slate-200 text-right w-28 bg-slate-100 font-black">BALANCE</th>
                        <th className="p-2 text-center w-24">BRANCH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {statementData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                            No transaction records found for this date range.
                          </td>
                        </tr>
                      ) : (
                        statementData.rows.map(row => (
                          <tr 
                            key={`${row.sn}-${row.dateBs}-${row.particulars}`}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              row.type === 'accrual' ? 'bg-amber-50/20' : 
                              row.type === 'cap' ? 'bg-blue-50/20' : 
                              row.type === 'opening' ? 'bg-slate-50/40 font-bold' : ''
                            }`}
                          >
                            <td className="p-2 border-r border-slate-100 text-slate-400 font-mono text-center">{row.sn}</td>
                            <td className="p-2 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">{row.dateBs}</td>
                            <td className="p-2 border-r border-slate-100">
                              <div className={`font-bold text-[9.5px] ${
                                row.type === 'accrual' ? 'text-amber-700' :
                                row.type === 'cap' ? 'text-blue-700' : 'text-slate-900'
                              }`}>
                                {row.particulars}
                              </div>
                            </td>
                            <td className="p-2 border-r border-slate-100 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                              {row.debit > 0 ? `NPR ${f2(row.debit)}` : '-'}
                            </td>
                            <td className="p-2 border-r border-slate-100 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                              {row.credit > 0 ? `NPR ${f2(row.credit)}` : '-'}
                            </td>
                            <td className="p-2 border-r border-slate-100 text-right font-mono text-amber-600 whitespace-nowrap">
                              {row.accrued > 0 ? `NPR ${f2(row.accrued)}` : row.cap > 0 ? `(Cap) ${f2(row.cap)}` : '-'}
                            </td>
                            <td className="p-2 border-r border-slate-100 text-right font-mono font-black text-slate-950 bg-slate-50 whitespace-nowrap">
                              NPR {f2(row.balance)}
                            </td>
                            <td className="p-2 text-center whitespace-nowrap">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[8px] font-bold">
                                {row.branchName}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: LEAVES & SALARY SLIPS */}
          {activeTab === 'payroll' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Full Leave Types list */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2.5 flex items-center">
                  <PieChart size={13} className="mr-1.5 text-emerald-600"/> Full Leave Balances
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {leaveTypes.map(lt => {
                    const taken = employee ? leaveRequests
                      .filter(r => r.employeeId === employee.id && r.leaveTypeId === lt.id && r.status === 'Approved')
                      .reduce((s, r) => s + r.days, 0) : 0;
                    return (
                      <div key={lt.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                        <span className="text-[9px] font-bold text-slate-600 truncate block">{lt.name || lt.nameNp}</span>
                        <div className="text-sm font-black text-slate-900 mt-1">{lt.totalDays - taken} / {lt.totalDays}</div>
                        <span className="text-[8px] text-emerald-600 uppercase font-black">Days Remaining</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Salary Slips */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2.5 flex items-center">
                  <CreditCard size={13} className="mr-1.5 text-blue-600"/> Monthly Salary Slips
                </h4>
                {mySlips.length === 0 ? (
                  <div className="p-5 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-xs font-bold">No salary slips have been issued from the payroll system yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mySlips.map(slip => (
                      <div 
                        key={slip.id}
                        onClick={() => onViewSlip(slip)}
                        className="bg-slate-50 hover:bg-emerald-50/50 p-3 rounded-xl border border-slate-100 flex items-center justify-between transition-all cursor-pointer group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white text-emerald-600 rounded-lg shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <FileText size={15}/>
                          </div>
                          <div>
                            <span className="block text-xs font-black text-slate-900 uppercase">{slip.month} {slip.year}</span>
                            <span className="block text-[10px] text-slate-500 font-bold">Net Salary: NPR {f2(slip.netSalary)}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-100 px-2 py-0.5 rounded">
                            {slip.paymentStatus || 'Paid'}
                          </span>
                          <ChevronRight size={15} className="text-slate-400 group-hover:text-emerald-600 transition-colors"/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <form onSubmit={handlePasswordChange} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Key size={16}/>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900">Change Security Password</h4>
                    <p className="text-[10px] text-slate-400 font-bold">Keep your user account credentials safe and secure.</p>
                  </div>
                </div>

                {updateMsg && (
                  <div className={`p-2.5 rounded-xl text-xs font-black flex items-center space-x-2 ${
                    updateMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {updateMsg.type === 'success' ? <CheckCircle2 size={15}/> : <ShieldAlert size={15}/>}
                    <span>{updateMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">New Password *</label>
                    <div className="relative">
                      <input 
                        type={showPass ? "text" : "password"} 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-xs outline-none focus:border-emerald-500"
                        placeholder="Enter new password"
                        required
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPass(!showPass)} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Confirm Password *</label>
                    <input 
                      type={showPass ? "text" : "password"} 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-xs outline-none focus:border-emerald-500 font-mono"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                </div>

                {/* Live Password Policy Guide */}
                <PasswordRequirementGuide password={newPassword} />

                <div className="pt-2 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={isSavingPass}
                    className="px-5 h-10 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save size={14}/>
                    <span>{isSavingPass ? 'Saving...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 6: USER TRANSACTIONS HISTORY */}
          {activeTab === 'transactions' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Header Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
                    <Receipt size={17} className="text-emerald-600" />
                    <span>My Transaction Entries</span>
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsTxPrintOpen(true)}
                    disabled={filteredTransactions.length === 0}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Printer size={14} />
                    <span>Print Statement</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Entries</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{txStats.count}</div>
                </div>
                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center space-x-1">
                    <ArrowDownRight size={13} />
                    <span>Total In / Credit</span>
                  </span>
                  <div className="text-xl font-black text-emerald-800 mt-1 font-mono">NPR {f2(txStats.totalIn)}</div>
                </div>
                <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 flex items-center space-x-1">
                    <ArrowUpRight size={13} />
                    <span>Total Out / Debit</span>
                  </span>
                  <div className="text-xl font-black text-rose-800 mt-1 font-mono">NPR {f2(txStats.totalOut)}</div>
                </div>
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">Net Flow</span>
                  <div className="text-xl font-black mt-1 font-mono">NPR {f2(txStats.netFlow)}</div>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
                <div className="lg:col-span-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Search Entry</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={e => setTxSearch(e.target.value)}
                      placeholder="Account, head, particulars, branch..."
                      className="w-full h-9 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Module</label>
                  <div className="relative">
                    <select
                      value={txModuleFilter}
                      onChange={e => setTxModuleFilter(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">All Modules ({myTransactions.length})</option>
                      {txModuleOptions.map(mod => (
                        <option key={mod} value={mod}>{mod}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Type</label>
                  <select
                    value={txTypeFilter}
                    onChange={e => setTxTypeFilter(e.target.value as 'ALL' | 'IN' | 'OUT')}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="ALL">All Types</option>
                    <option value="IN">IN / Credit</option>
                    <option value="OUT">OUT / Debit</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">From Date (BS)</label>
                  <NepaliDatePicker
                    value={txDateRange.start}
                    onChange={val => setTxDateRange(prev => ({ ...prev, start: val }))}
                    className="w-full"
                  />
                </div>

                <div className="flex items-end space-x-1.5">
                  <div className="flex-1 min-w-0">
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">To Date (BS)</label>
                    <NepaliDatePicker
                      value={txDateRange.end}
                      onChange={val => setTxDateRange(prev => ({ ...prev, end: val }))}
                      className="w-full"
                    />
                  </div>
                  {(txSearch || txModuleFilter !== 'ALL' || txTypeFilter !== 'ALL' || txDateRange.start || txDateRange.end) && (
                    <button
                      type="button"
                      onClick={() => {
                        setTxSearch('');
                        setTxModuleFilter('ALL');
                        setTxTypeFilter('ALL');
                        setTxDateRange({ start: '', end: '' });
                      }}
                      className="h-9 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase cursor-pointer shrink-0"
                      title="Reset Filters"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 px-3 text-center w-12">S.N.</th>
                        <th className="py-2.5 px-3 w-28">Date (BS)</th>
                        <th className="py-2.5 px-3 w-40">Module</th>
                        <th className="py-2.5 px-3">Account / Head</th>
                        <th className="py-2.5 px-3">Particulars</th>
                        <th className="py-2.5 px-3 w-36">Branch</th>
                        <th className="py-2.5 px-3 text-center w-20">Type</th>
                        <th className="py-2.5 px-3 text-right w-36">Amount (NPR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredTransactions.map((tx, idx) => (
                        <tr key={`${tx.module}-${tx.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{tx.dateBs || '-'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wide whitespace-nowrap">
                              {tx.module}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{tx.accountHead}</td>
                          <td className="py-2.5 px-3 text-slate-600">{tx.particulars || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-600 font-semibold whitespace-nowrap">
                            <span className="inline-flex items-center space-x-1">
                              <Building2 size={11} className="text-slate-400" />
                              <span>{tx.branchName}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              tx.flowType === 'IN'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {tx.flowType}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-black whitespace-nowrap ${
                            tx.flowType === 'IN' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {f2(tx.amount)}
                          </td>
                        </tr>
                      ))}

                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-16 text-center">
                            <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                              <Filter size={28} />
                              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                                No Transactions Found
                              </span>
                              <span className="text-[11px] font-medium text-slate-400">
                                Entries created by @{user.username} will automatically appear here.
                              </span>
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
          </>
        )}
          </div>
        </div>

        {/* Clean Full-Width Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-end shrink-0">
          <button 
            onClick={onClose} 
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 h-10 rounded-xl font-black uppercase text-xs tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            Close Portal
          </button>
        </div>

      </div>

      {/* Employee KYC Full Profile Document / PDF Modal */}
      {showKYCModal && (
        <EmployeeKYCModal 
          employee={effectiveEmployee}
          onClose={() => setShowKYCModal(false)}
          settings={settings}
          branches={branches}
        />
      )}

      {/* Monthly Attendance Print Modal */}
      {isAttendancePrintOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[7000] flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-300">
            {/* Action Bar (Hidden on actual print) */}
            <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 text-slate-900 flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer size={16} className="text-emerald-700" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Attendance Sheet Print Preview
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Printer size={13}/>
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsAttendancePrintOpen(false)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-600 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <X size={14}/>
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-6 sm:p-8 overflow-y-auto font-sans text-slate-900 print:p-0 print:overflow-visible">
              {/* Organization Header */}
              <div className="text-center pb-4 border-b-2 border-slate-900 mb-4">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950">
                  {settings?.cooperativeName || 'RATAULI SAVING AND CREDIT COOPERATIVE LTD.'}
                </h1>
                <p className="text-xs font-bold text-slate-700 mt-0.5">
                  {settings?.address || 'Pipara Rural Municipality - 6, Mahottari, Nepal'}
                </p>
                <div className="inline-block mt-2 px-3 py-1 bg-slate-100 rounded-md border border-slate-300 text-xs font-black uppercase tracking-wider text-slate-900">
                  EMPLOYEE MONTHLY ATTENDANCE STATEMENT
                </div>
              </div>

              {/* Employee & Period Details Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 border border-slate-300 rounded-xl mb-4 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Employee Name</span>
                  <span className="font-black text-slate-900">{employee?.fullName || user.fullName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Employee Code</span>
                  <span className="font-black text-slate-900">{effectiveEmployee.employeeCode}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Designation</span>
                  <span className="font-bold text-slate-800">{employee?.designation || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Branch Office</span>
                  <span className="font-bold text-slate-800">{branchName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Attendance Period</span>
                  <span className="font-black text-emerald-800">{NEPALI_MONTHS[attendanceMonth - 1]} {attendanceYear} BS</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Total Working Days</span>
                  <span className="font-black text-slate-900">{attStats.workingDays} Days</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Days Present</span>
                  <span className="font-black text-emerald-700">{attStats.present} Days</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Attendance Rate</span>
                  <span className="font-black text-blue-700">{attStats.attendanceRate}%</span>
                </div>
              </div>

              {/* Attendance Daily Punch Table */}
              <table className="w-full text-[10px] border-collapse border border-slate-300 text-left mb-6">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 uppercase font-black tracking-wider text-[9px] border-b border-slate-300">
                    <th className="p-1.5 border border-slate-300 text-center w-8">#</th>
                    <th className="p-1.5 border border-slate-300 w-24">Date (BS)</th>
                    <th className="p-1.5 border border-slate-300 w-20">Day</th>
                    <th className="p-1.5 border border-slate-300 w-20 text-center">In Time</th>
                    <th className="p-1.5 border border-slate-300 w-20 text-center">Out Time</th>
                    <th className="p-1.5 border border-slate-300 w-16 text-center">Hours</th>
                    <th className="p-1.5 border border-slate-300 w-24 text-center">Status</th>
                    <th className="p-1.5 border border-slate-300">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyAttendanceList.map(item => (
                    <tr 
                      key={`print-${item.bsDate}`}
                      className={`border-b border-slate-200 ${item.isWeekend ? 'bg-slate-50 font-bold' : ''}`}
                    >
                      <td className="p-1.5 border border-slate-300 text-center font-mono">{item.dayNumber}</td>
                      <td className="p-1.5 border border-slate-300 font-mono font-bold whitespace-nowrap">{item.bsDate}</td>
                      <td className="p-1.5 border border-slate-300 whitespace-nowrap">{item.dayName}</td>
                      <td className="p-1.5 border border-slate-300 font-mono text-center">{item.inTime}</td>
                      <td className="p-1.5 border border-slate-300 font-mono text-center">{item.outTime}</td>
                      <td className="p-1.5 border border-slate-300 font-mono text-center">{item.workHours > 0 ? `${item.workHours}h` : '-'}</td>
                      <td className="p-1.5 border border-slate-300 text-center font-bold">
                        {item.status === 'Weekend' ? 'Weekly Off' : item.status}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-slate-600">{item.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures Section */}
              <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs font-bold text-slate-700">
                <div>
                  <div className="border-t border-slate-400 pt-1 mx-4">Employee Signature</div>
                  <span className="text-[10px] text-slate-400">Date: ____________</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 mx-4">Checked By (Supervisor)</div>
                  <span className="text-[10px] text-slate-400">Date: ____________</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 mx-4">Authorized By (Manager)</div>
                  <span className="text-[10px] text-slate-400">Date: ____________</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Transactions Print Modal */}
      {isTxPrintOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[7000] flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-300">
            <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 text-slate-900 flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer size={16} className="text-emerald-700" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  User Transaction Statement Preview
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Printer size={13}/>
                  <span>Print Statement</span>
                </button>
                <button
                  onClick={() => setIsTxPrintOpen(false)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-600 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <X size={14}/>
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto font-sans text-slate-900 print:p-0 print:overflow-visible">
              <div className="text-center pb-4 border-b-2 border-slate-900 mb-4">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950">
                  {settings?.systemName || 'RATAULI SAVING AND CREDIT COOPERATIVE LTD.'}
                </h1>
                <p className="text-xs font-bold text-slate-700 mt-0.5">
                  {settings?.address || 'Pipara Rural Municipality - 6, Mahottari, Nepal'}
                </p>
                <div className="inline-block mt-2 px-3 py-1 bg-slate-100 rounded-md border border-slate-300 text-xs font-black uppercase tracking-wider text-slate-900">
                  USER TRANSACTION ENTRY STATEMENT
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 border border-slate-300 rounded-xl mb-4 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Staff Name</span>
                  <span className="font-black text-slate-900">{employee?.fullName || user.fullName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Username</span>
                  <span className="font-black text-slate-900">@{user.username}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Total Entries</span>
                  <span className="font-black text-slate-900">{txStats.count}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Net Flow (NPR)</span>
                  <span className="font-black text-emerald-700">{f2(txStats.netFlow)}</span>
                </div>
              </div>

              <table className="w-full text-[10px] border-collapse border border-slate-300 text-left mb-6">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 uppercase font-black tracking-wider text-[9px] border-b border-slate-300">
                    <th className="p-1.5 border border-slate-300 text-center w-10">S.N.</th>
                    <th className="p-1.5 border border-slate-300 w-24">Date (BS)</th>
                    <th className="p-1.5 border border-slate-300 w-32">Module</th>
                    <th className="p-1.5 border border-slate-300">Account / Head</th>
                    <th className="p-1.5 border border-slate-300">Particulars</th>
                    <th className="p-1.5 border border-slate-300 w-28">Branch</th>
                    <th className="p-1.5 border border-slate-300 w-16 text-center">Type</th>
                    <th className="p-1.5 border border-slate-300 w-28 text-right">Amount (NPR)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, idx) => (
                    <tr key={`tx-print-${tx.module}-${tx.id}-${idx}`} className="border-b border-slate-200">
                      <td className="p-1.5 border border-slate-300 text-center font-mono">{idx + 1}</td>
                      <td className="p-1.5 border border-slate-300 font-mono font-bold whitespace-nowrap">{tx.dateBs || '-'}</td>
                      <td className="p-1.5 border border-slate-300 font-bold">{tx.module}</td>
                      <td className="p-1.5 border border-slate-300 font-bold">{tx.accountHead}</td>
                      <td className="p-1.5 border border-slate-300">{tx.particulars || '-'}</td>
                      <td className="p-1.5 border border-slate-300">{tx.branchName}</td>
                      <td className="p-1.5 border border-slate-300 text-center font-black">{tx.flowType}</td>
                      <td className="p-1.5 border border-slate-300 text-right font-mono font-bold">{f2(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
