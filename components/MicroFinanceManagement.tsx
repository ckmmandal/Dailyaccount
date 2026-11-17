import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { 
  LayoutDashboard, MapPin, Users, UserCheck, 
  PiggyBank, HandCoins, FileText,
  Search, Plus, RefreshCw, Upload, Download,
  Edit2, Trash2, CheckCircle2,
  Calendar, Clock, Building2, UserPlus,
  Printer, CreditCard, X, Camera, User, Eye, FileSpreadsheet,
  Lock, Loader2
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
  getTodayBsDate
} from '../services/microFinanceService';
import { meetingMinutesService, GroupMeetingRecord } from '../services/meetingMinutesService';
import { useAuth } from '../AuthContext';
import { Branch, SavingProduct, LoanProduct, SystemSettings, Employee } from '../types';
import { storageService } from '../services/storageService';
import { productService } from '../services/productService';
import NepaliDate from 'nepali-date-converter';
import { GroupMeetingMinutesModule } from './microfinance/GroupMeetingMinutesModule';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

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

type SubMenuTab = 'dashboard' | 'centers' | 'groups' | 'members' | 'saving' | 'loan' | 'reports';

export const MicroFinanceManagement: React.FC = () => {
  const { user, branch, branches: authBranches, settings: authSettings } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const [adminBranches, setAdminBranches] = useState<Branch[]>(authBranches || []);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(authSettings || null);

  useEffect(() => {
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
    if (tab === 'dashboard' || tab === 'centers' || tab === 'groups' || tab === 'members' || tab === 'saving' || tab === 'loan' || tab === 'reports') {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Datasets
  const [centers, setCenters] = useState<MFCenter[]>(() => microFinanceService.getCenters());
  const [groups, setGroups] = useState<MFSamuhGroup[]>(() => microFinanceService.getGroups());
  const [members, setMembers] = useState<MFMember[]>(() => microFinanceService.getMembers());
  const [savings, setSavings] = useState<MFSavingsRecord[]>(() => microFinanceService.getSavings());
  const [loans, setLoans] = useState<MFLoanRecord[]>(() => microFinanceService.getLoans());
  const [sheets, setSheets] = useState<MFCollectionSheet[]>(() => microFinanceService.getSheets());
  const [meetingMinutes, setMeetingMinutes] = useState<GroupMeetingRecord[]>(() => meetingMinutesService.getMeetings());

  // Search states
  const [centerSearch, setCenterSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [savingSearch, setSavingSearch] = useState('');
  const [savingStatusFilter, setSavingStatusFilter] = useState('All');
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatusTab, setLoanStatusTab] = useState<'ACTIVE' | 'MATURED' | 'CLOSED'>('ACTIVE');
  const [closedLoansArchive, setClosedLoansArchive] = useState<MFLoanRecord[]>([]);
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
  const [reportTab, setReportTab] = useState<'collection' | 'signature' | 'meeting-minutes'>('collection');
  const [reportYear, setReportYear] = useState(currentBsDate.year);
  const [reportMonth, setReportMonth] = useState(currentBsDate.month);
  const [reportDay, setReportDay] = useState(currentBsDate.day);
  const [reportCenterId, setReportCenterId] = useState('');
  const [reportGroupId, setReportGroupId] = useState('');

  // Modals
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<MFCenter | null>(null);
  const [centerForm, setCenterForm] = useState({
    code: '',
    name: '',
    location: '',
    branch: availableBranches[0]?.name || branch?.name || 'Ratauli Central Head Office',
    meetingDay: 'Day 15th',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    fieldOfficer: 'Ramesh Sharma',
    contactNo: ''
  });

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MFSamuhGroup | null>(null);
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
  const [memberForm, setMemberForm] = useState({
    memberId: '',
    name: '',
    citizenshipNo: '',
    mobile: '',
    gender: 'Female' as 'Female' | 'Male' | 'Other',
    branch: availableBranches[0]?.name || branch?.name || 'Ratauli Central Head Office',
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
    const enabled = savingProductsList.filter(p => p.showInMicrofinanceAndFD && p.status !== 'Inactive');
    return enabled.length > 0 ? enabled : savingProductsList.filter(p => p.status !== 'Inactive');
  }, [savingProductsList]);

  // Savings Account & Deposit Modal State (supports member search & multiple accounts at once)
  const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);
  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [selectedSavingMemberId, setSelectedSavingMemberId] = useState('');
  const [savingDate, setSavingDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingAccounts, setSavingAccounts] = useState<Array<{
    id: string;
    accountNo: string;
    savingType: string;
    product: string;
    amount: number;
  }>>([
    { id: 'acc-1', accountNo: 'SAV-1001-01', savingType: 'Normal Saving', product: 'General Saving', amount: 1000 }
  ]);

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
    const enabled = loanProductsList.filter(p => p.showInMicrofinanceAndFD && p.status !== 'Inactive');
    return enabled.length > 0 ? enabled : loanProductsList.filter(p => p.status !== 'Inactive');
  }, [loanProductsList]);

  // Issue Loan Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanMemberSearchInput, setLoanMemberSearchInput] = useState('');
  const [isLoanMemberDropdownOpen, setIsLoanMemberDropdownOpen] = useState(false);
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
  const [activeSheetToPrint, setActiveSheetToPrint] = useState<MFCollectionSheet | null>(null);
  const [collectionSheetLoans, setCollectionSheetLoans] = useState<MFLoanRecord[]>([]);
  const [collectionSheetTargetBs, setCollectionSheetTargetBs] = useState<string>('');
  const [isLoadingCollectionSheet, setIsLoadingCollectionSheet] = useState(false);
  const [isLoadingSignatureSheet, setIsLoadingSignatureSheet] = useState(false);

  // Signature Sheets State (Permanent records)
  const [signatureSheets, setSignatureSheets] = useState<MFSignatureSheet[]>(() => microFinanceService.getSignatureSheets());
  const [selectedSignatureSheetToPrint, setSelectedSignatureSheetToPrint] = useState<MFSignatureSheet | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedSignatureSheetToDelete, setSelectedSignatureSheetToDelete] = useState<MFSignatureSheet | null>(null);
  const [isDeleteSignatureModalOpen, setIsDeleteSignatureModalOpen] = useState(false);

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

  // History filter on right side of Collection Sheet Records table
  const [sheetHistoryYear, setSheetHistoryYear] = useState(currentBsDate.year);
  const [sheetHistoryMonth, setSheetHistoryMonth] = useState(currentBsDate.month);

  // Signature Sheet Tab Filter Card state (defaults to current BS date)
  const [sigFilterYear, setSigFilterYear] = useState(currentBsDate.year);
  const [sigFilterMonth, setSigFilterMonth] = useState(currentBsDate.month);
  const [sigFilterDay, setSigFilterDay] = useState(currentBsDate.day);
  const [sigFilterCenterId, setSigFilterCenterId] = useState('');
  const [sigFilterGroupId, setSigFilterGroupId] = useState('');
  const [sigFilterEmployeeId, setSigFilterEmployeeId] = useState('ALL');

  // History filter on right side of Signature Sheets records table (defaults to current BS date)
  const [sigHistoryYear, setSigHistoryYear] = useState(currentBsDate.year);
  const [sigHistoryMonth, setSigHistoryMonth] = useState(currentBsDate.month);

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
    if (hrEmployees && hrEmployees.length > 0) return hrEmployees;
    return [
      { id: 'emp-1', fullName: 'Chandan', employeeCode: 'EMP-001', designation: 'कर्मचारी', status: 'Active' },
      { id: 'emp-2', fullName: 'Ramesh Sharma', employeeCode: 'EMP-002', designation: 'Field Officer', status: 'Active' },
      { id: 'emp-3', fullName: 'Sunil Kumar', employeeCode: 'EMP-003', designation: 'Branch Manager', status: 'Active' },
      { id: 'emp-4', fullName: 'Pooja Kumari Yadav', employeeCode: 'EMP-004', designation: 'Loan Officer', status: 'Active' }
    ] as Employee[];
  }, [hrEmployees]);

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

  const getExcelCell = (row: Record<string, unknown>, keys: string[]): string => {
    const normalizedEntries = Object.entries(row).map(([k, v]) => [k.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), v] as const);
    for (const candidate of keys) {
      const targetKey = candidate.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = normalizedEntries.find(([k]) => k === targetKey);
      if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
        const val = found[1];
        if (val instanceof Date && !isNaN(val.getTime())) {
          return val.toISOString().split('T')[0];
        }
        return String(val).trim();
      }
    }
    return '';
  };

  const handleDownloadBulkSampleExcel = () => {
    let sampleRows: Record<string, string | number>[] = [];
    const defaultCenter = centers[0]?.name || 'Center 01 (Janaki Chowk)';
    const defaultGroup = groups[0]?.name || 'Laxmi Mahila Samuh';
    const defaultBranch = availableBranches[0]?.name || 'Ratauli Central Head Office';
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
          'Date (BS)': todayBs,
          'Amount': 1000,
          'Saving Type': filteredMfSavingProducts[0]?.name || 'Normal Saving',
          'Status': 'PAID',
          'Collected By': 'Ramesh Sharma',
          'Receipt No': `REC-${601 + savings.length}`,
          'Remarks': 'Monthly compulsory saving'
        },
        {
          'Member ID': m2?.memberId || 'M-1002',
          'Account No': m2?.savingsAccountNo || 'SAV-1002',
          'Name': m2?.name || 'Geeta Kumari Mandal',
          'Group Name': m2?.samuhName || defaultGroup,
          'Center Name': m2?.centerName || defaultCenter,
          'Date (BS)': todayBs,
          'Amount': 1000,
          'Saving Type': filteredMfSavingProducts[0]?.name || 'Normal Saving',
          'Status': 'PAID',
          'Collected By': 'Ramesh Sharma',
          'Receipt No': `REC-${602 + savings.length}`,
          'Remarks': 'Monthly compulsory saving'
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
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      const validRows = rawRows.filter(row =>
        Object.values(row).some(v => v !== undefined && v !== null && String(v).trim() !== '')
      );
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
            branch: getExcelCell(row, ['Branch', 'Branch Name']) || availableBranches[0]?.name || 'Ratauli Central Head Office',
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

          const memberId = getExcelCell(row, ['Member ID', 'Member Code', 'ID']) || `M-${1001 + members.length + idx}`;
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
            branch: getExcelCell(row, ['Branch', 'Branch Name']) || matchedCenter?.branch || availableBranches[0]?.name || 'Ratauli Central Head Office',
            centerId: matchedCenter?.id || '',
            centerName: matchedCenter?.name || centerQuery || '',
            samuhId: matchedGroup?.id || '',
            samuhName: matchedGroup?.name || groupQuery || '',
            role,
            savingsAccountNo: getExcelCell(row, ['Savings Account No', 'Account No', 'Saving Account']) || `SAV-${memberId.replace(/[^0-9]/g, '') || (1001 + idx)}`,
            address: getExcelCell(row, ['Address', 'Location']) || '',
            joinedDate: getExcelCell(row, ['Joined Date', 'Join Date', 'Date']) || todayBs,
            status: statusRaw === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            totalSavings: parseFloat(getExcelCell(row, ['Total Savings', 'Savings', 'Balance'])) || 0,
            activeLoanAmount: parseFloat(getExcelCell(row, ['Active Loan Amount', 'Loan Balance'])) || 0
          });
        });
        if (items.length === 0) {
          setBulkUploadError('No valid Members found. Ensure the "Name" column has values.');
          return;
        }
        const updatedMembers = microFinanceService.bulkAddMembers(items);
        setMembers(updatedMembers);
        setGroups(microFinanceService.getGroups());
        createdCount = items.length;
      } else if (bulkType === 'Savings') {
        const items: Omit<MFSavingsRecord, 'id' | 'createdAt'>[] = [];
        bulkParsedRows.forEach((row, idx) => {
          const memberIdRaw = getExcelCell(row, ['Member ID', 'MemberId']);
          const nameRaw = getExcelCell(row, ['Name', 'Member Name']);
          const matchedMember = members.find(
            m =>
              (memberIdRaw && m.memberId.toLowerCase() === memberIdRaw.toLowerCase()) ||
              (nameRaw && m.name.trim().toLowerCase() === nameRaw.toLowerCase())
          );
          const name = nameRaw || matchedMember?.name || '';
          const amount = parseFloat(getExcelCell(row, ['Amount', 'Saving Amount', 'Deposit'])) || 0;
          if (!name || amount <= 0) return;

          const dateRaw = getExcelCell(row, ['Date (BS)', 'Date BS', 'Date']);
          const normalizedBs = normalizeBsDate(dateRaw || todayBs);
          const statusRaw = getExcelCell(row, ['Status']).toUpperCase();
          const status: 'PAID' | 'DUE' | 'PENDING' =
            statusRaw === 'DUE' ? 'DUE' : statusRaw === 'PENDING' ? 'PENDING' : 'PAID';

          items.push({
            memberId: memberIdRaw || matchedMember?.memberId || `M-${1001 + idx}`,
            accountNo: getExcelCell(row, ['Account No', 'Savings Account No']) || matchedMember?.savingsAccountNo || `SAV-${1001 + idx}`,
            name,
            groupName: getExcelCell(row, ['Group Name', 'Group']) || matchedMember?.samuhName || '',
            centerName: getExcelCell(row, ['Center Name', 'Center']) || matchedMember?.centerName || '',
            date: todayAd,
            dateBs: normalizedBs || todayBs,
            amount,
            savingType: getExcelCell(row, ['Saving Type', 'Product', 'Type']) || filteredMfSavingProducts[0]?.name || 'Normal Saving',
            status,
            collectedBy: getExcelCell(row, ['Collected By', 'Staff', 'Officer']) || user?.fullName || 'Field Officer',
            receiptNo: getExcelCell(row, ['Receipt No', 'Receipt']) || `REC-${Date.now().toString().slice(-3)}${idx}`,
            remarks: getExcelCell(row, ['Remarks', 'Note']) || 'Bulk Excel Import',
            createdBy: user?.id || user?.username || '',
            createdByName: user?.fullName || user?.username || ''
          });
        });
        if (items.length === 0) {
          setBulkUploadError('No valid Saving rows found. Ensure "Name" (or Member ID) and "Amount" > 0 are provided.');
          return;
        }
        const updatedSavings = microFinanceService.bulkAddSavings(items);
        setSavings(updatedSavings);
        setMembers(microFinanceService.getMembers());
        createdCount = items.length;
      } else if (bulkType === 'Loans') {
        const items: Omit<MFLoanRecord, 'id' | 'createdAt'>[] = [];
        bulkParsedRows.forEach((row, idx) => {
          const memberIdRaw = getExcelCell(row, ['Member ID', 'MemberId']);
          const nameRaw = getExcelCell(row, ['Name', 'Member Name']);
          const matchedMember = members.find(
            m =>
              (memberIdRaw && m.memberId.toLowerCase() === memberIdRaw.toLowerCase()) ||
              (nameRaw && m.name.trim().toLowerCase() === nameRaw.toLowerCase())
          );
          const name = nameRaw || matchedMember?.name || '';
          const loanAmount = parseFloat(getExcelCell(row, ['Loan Amount', 'Amount', 'Principal'])) || 0;
          if (!name || loanAmount <= 0) return;

          const periodMonths = parseInt(getExcelCell(row, ['Period (Months)', 'Total Installments', 'Period', 'Months']), 10) || 12;
          const interestRate = parseFloat(getExcelCell(row, ['Interest Rate (%)', 'Interest Rate', 'Rate'])) || 14;
          const loanDateRaw = getExcelCell(row, ['Loan Date (BS)', 'Open Date (BS)', 'Loan Date', 'Date']);
          const loanDateBs = normalizeBsDate(loanDateRaw || todayBs);
          const maturityDateRaw = getExcelCell(row, ['Maturity Date (BS)', 'Maturity Date']);
          const maturityDate = maturityDateRaw ? normalizeBsDate(maturityDateRaw) : calculateBsMaturityDate(loanDateBs, periodMonths);
          const installmentRaw = parseFloat(getExcelCell(row, ['Installment Amount', 'Installment', 'EMI']));
          const installmentAmount = installmentRaw > 0
            ? installmentRaw
            : Math.round((loanAmount + (loanAmount * interestRate * (periodMonths / 12)) / 100) / periodMonths);
          const remainingRaw = parseFloat(getExcelCell(row, ['Remaining Amount', 'Remaining', 'Balance']));
          const statusRaw = getExcelCell(row, ['Status']).toUpperCase();
          const status: 'ACTIVE' | 'MATURED' | 'CLOSED' =
            statusRaw === 'CLOSED' ? 'CLOSED' : statusRaw === 'MATURED' ? 'MATURED' : 'ACTIVE';

          items.push({
            memberId: memberIdRaw || matchedMember?.memberId || `M-${1001 + idx}`,
            accountNo: getExcelCell(row, ['Account No', 'Loan Account No']) || `LN-${2001 + loans.length + idx}`,
            name,
            centerName: getExcelCell(row, ['Center Name', 'Center']) || matchedMember?.centerName || centers[0]?.name || '',
            groupName: getExcelCell(row, ['Group Name', 'Group']) || matchedMember?.samuhName || groups[0]?.name || '',
            loanDate: todayAd,
            loanDateBs,
            loanAmount,
            remainingAmount: status === 'CLOSED' ? 0 : (!isNaN(remainingRaw) && remainingRaw >= 0 ? remainingRaw : loanAmount),
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
        const updatedLoans = await microFinanceService.bulkAddLoans(items);
        setLoans(updatedLoans);
        setMembers(microFinanceService.getMembers());
        createdCount = items.length;
      }

      setIsBulkModalOpen(false);
      showToast(`Successfully created ${createdCount} ${bulkType} record(s) from Excel!`);
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
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      setMeetingMinutes(meetingMinutesService.getMeetings());
    }
  }, [activeTab]);

  // All-Menu Live Dashboard Aggregates (100% English)
  const dashboardStats = useMemo(() => {
    const totalCenters = centers.length;
    const activeCenters = centers.filter(c => c.status === 'ACTIVE').length;
    const totalGroups = groups.length;
    const activeSamuhs = groups.filter(g => g.status === 'ACTIVE').length;
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'ACTIVE').length;
    const femaleMembers = members.filter(m => m.gender === 'Female').length;

    const paidSavingsList = savings.filter(s => s.status === 'PAID');
    const dueSavingsList = savings.filter(s => s.status === 'DUE' || s.status === 'PENDING');
    const savingBalance = paidSavingsList.reduce((acc, s) => acc + s.amount, 0) +
                          members.reduce((acc, m) => acc + (m.totalSavings || 0), 0);
    const dueSavingsAmount = dueSavingsList.reduce((acc, s) => acc + s.amount, 0);

    const activeLoansList = loans.filter(l => l.status === 'ACTIVE');
    const maturedLoansList = loans.filter(l => l.status === 'MATURED');
    const closedLoansList = loans.filter(l => l.status === 'CLOSED');
    const loanPortfolio = loans.reduce((acc, l) => acc + l.loanAmount, 0);
    const outstandingLoan = loans.reduce((acc, l) => acc + l.remainingAmount, 0);
    const recoveredLoan = Math.max(0, loanPortfolio - outstandingLoan);
    const monthlyInstallmentTotal = activeLoansList.reduce((acc, l) => acc + (l.installmentAmount || 0), 0);
    const parRate = loanPortfolio > 0
      ? ((maturedLoansList.reduce((acc, l) => acc + l.remainingAmount, 0) / loanPortfolio) * 100).toFixed(2)
      : '0.00';

    const collectionSheetsCount = sheets.length;
    const signatureSheetsCount = signatureSheets.length;
    const meetingMinutesCount = meetingMinutes.length;
    const totalReportsCount = collectionSheetsCount + signatureSheetsCount + meetingMinutesCount;

    return {
      totalCenters,
      activeCenters,
      totalGroups,
      activeSamuhs,
      totalMembers,
      activeMembers,
      femaleMembers,
      savingBalance,
      paidSavingsCount: paidSavingsList.length,
      dueSavingsCount: dueSavingsList.length,
      dueSavingsAmount,
      loanPortfolio,
      outstandingLoan,
      recoveredLoan,
      activeLoansCount: activeLoansList.length,
      maturedLoansCount: maturedLoansList.length,
      closedLoansCount: closedLoansList.length,
      monthlyInstallmentTotal,
      parRate,
      collectionSheetsCount,
      signatureSheetsCount,
      meetingMinutesCount,
      totalReportsCount
    };
  }, [centers, groups, members, savings, loans, sheets, signatureSheets, meetingMinutes]);

  // Live Center-wise breakdown across Centers, Groups, Members, Saving & Loan
  const centerAnalytics = useMemo(() => {
    return centers.map(c => {
      const centerGroups = groups.filter(g => g.centerId === c.id || g.centerName === c.name);
      const centerMembers = members.filter(m => m.centerId === c.id || m.centerName === c.name);
      const centerSavings = savings
        .filter(s => s.centerName === c.name && s.status === 'PAID')
        .reduce((sum, s) => sum + s.amount, 0) +
        centerMembers.reduce((sum, m) => sum + (m.totalSavings || 0), 0);
      const centerLoans = loans.filter(l => l.centerName === c.name);
      const centerLoanTotal = centerLoans.reduce((sum, l) => sum + l.loanAmount, 0);
      const centerOutstanding = centerLoans.reduce((sum, l) => sum + l.remainingAmount, 0);

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        shortName: c.code || c.name.split('(')[0].trim(),
        branch: c.branch,
        meetingDay: c.meetingDay,
        fieldOfficer: c.fieldOfficer || 'Unassigned',
        status: c.status,
        groupsCount: centerGroups.length,
        membersCount: centerMembers.length,
        savings: centerSavings,
        loans: centerLoanTotal,
        outstanding: centerOutstanding
      };
    });
  }, [centers, groups, members, savings, loans]);

  // Live Loan Status Breakdown for Pie Chart
  const loanStatusChartData = useMemo(() => {
    const activeCount = loans.filter(l => l.status === 'ACTIVE').length;
    const maturedCount = loans.filter(l => l.status === 'MATURED').length;
    const closedCount = loans.filter(l => l.status === 'CLOSED').length;
    const items = [
      { name: 'Active Loans', value: activeCount, color: '#2563eb' },
      { name: 'Matured Loans', value: maturedCount, color: '#f59e0b' },
      { name: 'Closed Loans', value: closedCount, color: '#10b981' }
    ].filter(item => item.value > 0);
    return items.length > 0 ? items : [{ name: 'No Loans', value: 1, color: '#e2e8f0' }];
  }, [loans]);

  // Month list strictly in English (NO NEPALI)
  const nepaliMonthsEnglish = [
    'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
  ];

  // Filtered Centers
  const filteredCenters = useMemo(() => {
    return centers.filter(c => 
      c.name.toLowerCase().includes(centerSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(centerSearch.toLowerCase()) ||
      c.location.toLowerCase().includes(centerSearch.toLowerCase())
    );
  }, [centers, centerSearch]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return groups.filter(g => 
      g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
      g.code.toLowerCase().includes(groupSearch.toLowerCase()) ||
      g.centerName.toLowerCase().includes(groupSearch.toLowerCase())
    );
  }, [groups, groupSearch]);

  // Filtered Members
  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.memberId.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.samuhName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.citizenshipNo.toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [members, memberSearch]);

  // Filtered Savings
  const filteredSavings = useMemo(() => {
    return savings.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(savingSearch.toLowerCase()) ||
                          s.memberId.toLowerCase().includes(savingSearch.toLowerCase()) ||
                          s.accountNo.toLowerCase().includes(savingSearch.toLowerCase());
      const matchStatus = savingStatusFilter === 'All' || s.status === savingStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [savings, savingSearch, savingStatusFilter]);

  const getEffectiveLoanStatus = (loan: MFLoanRecord): 'ACTIVE' | 'MATURED' | 'CLOSED' => {
    if (loan.status === 'CLOSED') return 'CLOSED';
    if (loan.status === 'MATURED') return 'MATURED';
    const matNorm = normalizeBsDate(loan.maturityDate);
    const isBsDate = /^20[7-9]\d-/.test(matNorm);
    if (loan.status === 'ACTIVE' && isBsDate && matNorm <= getTodayBsDate()) {
      return 'MATURED';
    }
    return 'ACTIVE';
  };

  // Filtered Loans: Active & Mature read from lightweight active state; Close loads on-demand from Supabase
  const filteredLoans = useMemo(() => {
    const query = loanSearch.toLowerCase();
    const sourceList = loanStatusTab === 'CLOSED' ? closedLoansArchive : loans;
    return sourceList.filter(l => {
      const effStatus = getEffectiveLoanStatus(l);
      if (effStatus !== loanStatusTab) return false;
      return (
        l.name.toLowerCase().includes(query) ||
        l.memberId.toLowerCase().includes(query) ||
        l.accountNo.toLowerCase().includes(query)
      );
    });
  }, [loans, closedLoansArchive, loanSearch, loanStatusTab]);

  // Handlers for Center
  const handleOpenAddCenter = () => {
    setEditingCenter(null);
    setCenterForm({
      code: `C-00${centers.length + 1}`,
      name: '',
      location: '',
      branch: availableBranches[0]?.name || branch?.name || 'Ratauli Central Head Office',
      meetingDay: 'Day 15th',
      status: 'ACTIVE',
      fieldOfficer: 'Ramesh Sharma',
      contactNo: ''
    });
    setIsCenterModalOpen(true);
  };

  const handleEditCenter = (center: MFCenter) => {
    setEditingCenter(center);
    setCenterForm({
      code: center.code,
      name: center.name,
      location: center.location,
      branch: center.branch,
      meetingDay: center.meetingDay,
      status: center.status,
      fieldOfficer: center.fieldOfficer || 'Ramesh Sharma',
      contactNo: center.contactNo || ''
    });
    setIsCenterModalOpen(true);
  };

  const handleSaveCenter = () => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!centerForm.name) {
      alert('Please enter center name');
      return;
    }
    if (editingCenter) {
      microFinanceService.updateCenter(editingCenter.id, centerForm);
      showToast('Center updated successfully');
    } else {
      microFinanceService.addCenter(centerForm);
      showToast('New center added successfully');
    }
    setCenters(microFinanceService.getCenters());
    setIsCenterModalOpen(false);
  };

  const handleDeleteCenter = (id: string) => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const target = centers.find(c => c.id === id);
    if (!target) return;
    setSelectedCenterToDelete(target);
    setIsDeleteCenterModalOpen(true);
  };

  const handleConfirmDeleteCenter = () => {
    if (!selectedCenterToDelete) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
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
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const target = groups.find(g => g.id === id);
    if (!target) return;
    setSelectedGroupToDelete(target);
    setIsDeleteGroupModalOpen(true);
  };

  const handleConfirmDeleteGroup = () => {
    if (!selectedGroupToDelete) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
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
    setEditingMember(null);
    const genAccountNo = `SAV-${1000 + members.length + 1}`;
    setMemberForm({
      memberId: `M-${1000 + members.length + 1}`,
      name: '',
      citizenshipNo: '',
      mobile: '',
      gender: 'Female',
      branch: availableBranches[0]?.name || branch?.name || 'Ratauli Central Head Office',
      centerId: centers[0]?.id || '',
      samuhId: groups[0]?.id || '',
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
    setEditingMember(member);
    setMemberForm({
      memberId: member.memberId,
      name: member.name,
      citizenshipNo: member.citizenshipNo,
      mobile: member.mobile,
      gender: member.gender,
      branch: member.branch,
      centerId: member.centerId,
      samuhId: member.samuhId,
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
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!memberForm.name) {
      alert('Please enter member name');
      return;
    }
    const c = centers.find(item => item.id === memberForm.centerId);
    const g = groups.find(item => item.id === memberForm.samuhId);

    const safeAccNo = memberForm.savingsAccountNo || `SAV-${Date.now().toString().slice(-4)}`;
    const safeJoinedDate = memberForm.joinedDate || new Date().toISOString().split('T')[0];

    if (editingMember) {
      microFinanceService.updateMember(editingMember.id, {
        ...memberForm,
        savingsAccountNo: safeAccNo,
        joinedDate: safeJoinedDate,
        centerName: c ? c.name : 'N/A',
        samuhName: g ? g.name : 'N/A'
      });
      showToast('Member updated successfully');
    } else {
      microFinanceService.addMember({
        ...memberForm,
        savingsAccountNo: safeAccNo,
        joinedDate: safeJoinedDate,
        centerName: c ? c.name : 'N/A',
        samuhName: g ? g.name : 'N/A'
      });
      showToast('New member registered');
    }
    setMembers(microFinanceService.getMembers());
    setGroups(microFinanceService.getGroups());
    setIsMemberModalOpen(false);
  };

  const handleDeleteMember = (id: string) => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const target = members.find(m => m.id === id);
    if (!target) return;
    setSelectedMemberToDelete(target);
    setIsDeleteMemberModalOpen(true);
  };

  const handleConfirmDeleteMember = () => {
    if (!selectedMemberToDelete) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const updated = microFinanceService.deleteMember(selectedMemberToDelete.id);
    setMembers(updated);
    setGroups(microFinanceService.getGroups());
    setIsDeleteMemberModalOpen(false);
    setSelectedMemberToDelete(null);
    showToast('Member deleted');
  };

  const handleOpenDeleteSaving = (item: MFSavingsRecord) => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setSelectedSavingToDelete(item);
    setIsDeleteSavingModalOpen(true);
  };

  const handleConfirmDeleteSaving = () => {
    if (!selectedSavingToDelete) return;
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
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setSelectedSheetToDelete(sheet);
    setIsDeleteSheetModalOpen(true);
  };

  const handleConfirmDeleteSheet = () => {
    if (!selectedSheetToDelete) return;
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
    const firstMember = members[0];
    const initialMemId = firstMember?.memberId || 'M-1001';
    const baseAccount = firstMember?.savingsAccountNo || `SAV-${initialMemId.replace('M-', '')}`;
    const defaultProduct = filteredMfSavingProducts[0]?.name || 'General Saving';

    setSelectedSavingMemberId(initialMemId);
    setMemberSearchInput(firstMember ? `${firstMember.name} (${firstMember.memberId})` : '');
    setIsMemberDropdownOpen(false);
    setSavingDate(new Date().toISOString().split('T')[0]);
    // Start with 1 account (Normal Saving), "+ Add Account" adds 2nd account (Recurring Saving)
    setSavingAccounts([
      {
        id: 'acc-' + Date.now() + '-1',
        accountNo: baseAccount,
        savingType: 'Normal Saving',
        product: defaultProduct,
        amount: 1000
      }
    ]);
    setIsSavingModalOpen(true);
  };

  const handleSelectSavingMember = (member: MFMember) => {
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
    const mem = members.find(m => m.memberId === selectedSavingMemberId);
    const base = mem?.savingsAccountNo || (selectedSavingMemberId ? `SAV-${selectedSavingMemberId.replace('M-', '')}` : 'SAV-1001');
    const nextIdx = savingAccounts.length + 1;
    const defaultType = 'Recurring Saving';
    const defaultProduct = filteredMfSavingProducts[0]?.name || 'General Saving';
    const defaultAmt = 500;

    setSavingAccounts(prev => [
      ...prev,
      {
        id: 'acc-' + Date.now() + '-' + nextIdx,
        accountNo: `${base}-0${nextIdx}`,
        savingType: defaultType,
        product: defaultProduct,
        amount: defaultAmt
      }
    ]);
  };

  const handleRemoveSavingAccount = (id: string) => {
    if (savingAccounts.length <= 1) return;
    setSavingAccounts(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateSavingAccount = (id: string, field: 'accountNo' | 'savingType' | 'product' | 'amount', value: string | number) => {
    setSavingAccounts(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleSaveSaving = () => {
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(savingDate, systemSettings || authSettings)) {
      alert(getBackDateBlockedMessage(savingDate));
      return;
    }
    const mem = members.find(m => m.memberId === selectedSavingMemberId);
    if (!mem) {
      alert('Please select a valid member.');
      return;
    }

    if (savingAccounts.length === 0) {
      alert('Please add at least one saving account.');
      return;
    }

    for (let i = 0; i < savingAccounts.length; i++) {
      const a = savingAccounts[i];
      if (!a.accountNo || !a.accountNo.trim()) {
        alert(`Account #${i + 1}: Please enter a valid account number.`);
        return;
      }
      if (a.amount < 0 || isNaN(a.amount)) {
        alert(`Account #${i + 1}: Please enter a valid deposit amount.`);
        return;
      }
    }

    const dynamicBsDate = (() => {
      try {
        if (savingDate && savingDate.startsWith('208')) return savingDate;
        return new NepaliDate(new Date(savingDate)).format('YYYY-MM-DD');
      } catch {
        return new NepaliDate().format('YYYY-MM-DD');
      }
    })();

    // Save all accounts in a single batch
    savingAccounts.forEach(acc => {
      const typeLabel = acc.product ? `${acc.savingType} (${acc.product})` : acc.savingType;
      microFinanceService.addSaving({
        memberId: mem.memberId,
        accountNo: acc.accountNo.trim(),
        name: mem.name,
        groupName: mem.samuhName,
        centerName: mem.centerName,
        date: savingDate,
        dateBs: dynamicBsDate,
        amount: Number(acc.amount) || 0,
        savingType: typeLabel,
        status: 'PAID',
        collectedBy: user?.fullName || 'Field Officer',
        receiptNo: `REC-${Math.floor(100 + Math.random() * 900)}`,
        createdBy: user?.id || user?.username || '',
        createdByName: user?.fullName || user?.username || ''
      });
    });

    setSavings(microFinanceService.getSavings());
    setMembers(microFinanceService.getMembers());
    setIsSavingModalOpen(false);
    showToast(`${savingAccounts.length} Saving Account(s) Opened & Saved Successfully`);
  };

  // Handlers for Loan
  const handleOpenIssueLoan = () => {
    const firstMember = members[0];
    const initialMemId = firstMember?.memberId || 'M-1001';
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

    setLoanMemberSearchInput(firstMember ? `${firstMember.name} (${firstMember.memberId})` : '');
    setIsLoanMemberDropdownOpen(false);

    setLoanForm({
      memberId: initialMemId,
      accountNo: `LN-${2000 + loans.length + 1}`,
      name: firstMember?.name || '',
      centerName: firstMember?.centerName || '',
      groupName: firstMember?.samuhName || '',
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
    setLoanForm(prev => ({
      ...prev,
      memberId: mem.memberId,
      name: mem.name,
      centerName: mem.centerName,
      groupName: mem.samuhName
    }));
  };

  const handleLoanDateBsChange = (newDateBs: string) => {
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
      alert(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(loanForm.loanDateBs || loanForm.loanDate, systemSettings || authSettings)) {
      alert(getBackDateBlockedMessage(loanForm.loanDateBs || loanForm.loanDate));
      return;
    }
    if (!loanForm.name || loanForm.loanAmount <= 0) {
      alert('Please enter valid member and loan amount');
      return;
    }
    microFinanceService.addLoan({
      ...loanForm,
      remainingAmount: loanForm.loanAmount,
      createdBy: user?.id || user?.username || '',
      createdByName: user?.fullName || user?.username || ''
    });
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
    setSelectedLoanToEdit(loan);
    setEditLoanForm({
      ...loan,
      closedDateBs: loan.closedDateBs || getTodayBsDate()
    });
    setIsEditLoanModalOpen(true);
  };

  const handleSaveEditLoan = () => {
    if (!editLoanForm || !selectedLoanToEdit) return;
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
    setSelectedLoanToDelete(loan);
    setIsDeleteLoanModalOpen(true);
  };

  const handleConfirmDeleteLoan = () => {
    if (!selectedLoanToDelete) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const updated = microFinanceService.deleteLoan(selectedLoanToDelete.id);
    setLoans(updated);
    setClosedLoansArchive(prev => prev.filter(l => l.id !== selectedLoanToDelete.id));
    setIsDeleteLoanModalOpen(false);
    setSelectedLoanToDelete(null);
    showToast('Loan record deleted successfully');
  };

  // Helper: checks if a loan was active on a given BS report date
  const isLoanActiveOnBsDate = (loan: MFLoanRecord, targetDateBs: string): boolean => {
    const target = normalizeBsDate(targetDateBs);
    const openBs = normalizeBsDate(loan.loanDateBs || loan.loanDate);
    if (openBs && target && openBs > target) return false;
    if (loan.status === 'CLOSED') {
      const closedBs = normalizeBsDate(loan.closedDateBs || loan.closedDate || loan.maturityDate);
      return Boolean(closedBs && target && closedBs > target);
    }
    return true;
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
    setIsLoadingCollectionSheet(true);
    try {
      const dateAwareLoans = await microFinanceService.fetchLoansForReportDate(targetDateBs);
      setCollectionSheetLoans(dateAwareLoans);
      setCollectionSheetTargetBs(targetDateBs);
    } finally {
      setIsLoadingCollectionSheet(false);
    }

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
      totalCompulsorySaving: 5000,
      totalOptionalSaving: 2000,
      totalLoanPrincipal: 25000,
      totalLoanInterest: 3500,
      totalExpected: 35500,
      totalCollected: 0,
      memberCount: group ? group.membersCount || 5 : 15,
      collectedBy: user?.fullName || 'Field Officer',
      createdAt: new Date().toISOString().split('T')[0]
    };

    setActiveSheetToPrint(newSheet);
    setIsPrintSheetModalOpen(true);
  };

  // Handler when user clicks "Generate Sheet" in Collection Sheet preview modal
  // Saves the sheet permanently into the Signature Sheet table and Available Collection Sheets!
  const handleGenerateSignatureSheetFromModal = () => {
    if (!activeSheetToPrint) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }

    const center = centers.find(c => c.id === activeSheetToPrint.centerId || c.name === activeSheetToPrint.centerName);
    const branchInfo = adminBranches.find(b => b.name === center?.branch) || availableBranches[0];
    const groupMembers = members.filter(m => (!activeSheetToPrint.groupId || activeSheetToPrint.groupId === 'all') ? (m.centerId === activeSheetToPrint.centerId || m.centerName === activeSheetToPrint.centerName) : m.samuhId === activeSheetToPrint.groupId);

    const nepMonth = nepaliMonthMapNp[activeSheetToPrint.month] || activeSheetToPrint.month;
    const nepYear = toNepaliDigits(activeSheetToPrint.year);
    const nepDay = toNepaliDigits(activeSheetToPrint.day);
    const nepaliDateStr = `${nepYear} ${nepMonth} ${nepDay}`;
    const targetDateBs = collectionSheetTargetBs || buildBsDateFromParts(activeSheetToPrint.year, activeSheetToPrint.month, activeSheetToPrint.day);
    const loanPool = collectionSheetLoans.length > 0 ? collectionSheetLoans : loans;

    const membersToUse = groupMembers.length > 0 ? groupMembers : (members.length > 0 ? members.slice(0, 4) : []);

    const sigMembers: MFSignatureSheetMember[] = membersToUse.map(m => {
      const memLoans = loanPool.filter(l => 
        (l.memberId === m.memberId || (l.name && m.name && l.name.trim().toLowerCase() === m.name.trim().toLowerCase())) && 
        isLoanActiveOnBsDate(l, targetDateBs)
      );
      const microLoan = memLoans.find(l => l.loanProduct.toLowerCase().includes('micro') || l.loanProduct.toLowerCase().includes('general') || l.loanProduct.toLowerCase().includes('group')) || memLoans[0];
      const emergencyLoan = memLoans.find(l => l.loanProduct.toLowerCase().includes('emergency') || l.loanProduct.toLowerCase().includes('family'));
      
      const microLoanOpenDate = microLoan ? (microLoan.loanDateBs || microLoan.loanDate) : '-';
      const microLoanKista = microLoan ? calculateBsKistaNumber(microLoanOpenDate, activeSheetToPrint.year, activeSheetToPrint.month) : 0;
      const microInstallmentAmt = microLoan ? (microLoan.installmentAmount || 0) : 0;

      const emergencyLoanOpenDate = emergencyLoan ? (emergencyLoan.loanDateBs || emergencyLoan.loanDate) : '-';
      const emergencyLoanKista = emergencyLoan ? calculateBsKistaNumber(emergencyLoanOpenDate, activeSheetToPrint.year, activeSheetToPrint.month) : 0;
      const emergencyInstallmentAmt = emergencyLoan ? (emergencyLoan.installmentAmount || 0) : 0;

      const dueAmt = manualDues[m.memberId] || 0;
      const savingAmt = m.totalSavings > 0 ? (m.totalSavings >= 2000 ? 1000 : 500) : 500;
      const totalLoanAmt = microInstallmentAmt + emergencyInstallmentAmt;

      return {
        memberId: m.memberId,
        name: m.name,
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

    // Save permanent signature sheet
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

    // Also add to available collection sheets if not exists
    const existingSheet = sheets.find(s => s.id === activeSheetToPrint.id);
    if (!existingSheet) {
      microFinanceService.addSheet({
        ...activeSheetToPrint,
        status: 'GENERATED',
        totalCollected: totalSavings + totalLoans + totalDue
      });
      setSheets(microFinanceService.getSheets());
    }

    setSignatureSheets(microFinanceService.getSignatureSheets());
    setIsPrintSheetModalOpen(false);
    showToast(`Sheet generated successfully & saved to table! (${newSigSheet.sheetNo})`);
  };

  // Handler when user clicks "View" on the Signature Sheet filter bar
  const handleViewSignatureSheetFromFilter = async () => {
    // 1. Resolve Center
    const targetCenter = centers.find(c => c.id === sigFilterCenterId) || centers[0];
    const targetCenterId = targetCenter?.id || '';
    const targetCenterName = targetCenter?.name || 'Center 01 (Janaki Chowk)';

    // 2. Resolve Group
    const availableGroupsForCenter = groups.filter(g => !targetCenterId || g.centerId === targetCenterId);
    const targetGroup = availableGroupsForCenter.find(g => g.id === sigFilterGroupId) || availableGroupsForCenter[0] || groups[0];
    const targetGroupId = targetGroup?.id || '';
    const targetGroupName = targetGroup?.name || 'Laxmi Mahila Samuh';

    // 3. Resolve Date
    const yr = sigFilterYear && sigFilterYear !== 'ALL' ? sigFilterYear : '2083';
    const mo = sigFilterMonth && sigFilterMonth !== 'ALL' ? sigFilterMonth : 'Kartik';
    const dy = sigFilterDay && sigFilterDay !== 'ALL' ? sigFilterDay : '1';
    const nepMonth = nepaliMonthMapNp[mo] || mo;
    const nepYear = toNepaliDigits(yr);
    const nepDay = toNepaliDigits(dy);
    const nepaliDateStr = `${nepYear} ${nepMonth} ${nepDay}`;
    const targetDateBs = buildBsDateFromParts(yr, mo, dy);

    // 4. Resolve Employee from HR Management
    const selectedHrEmp = activeHrEmployees.find(e => e.id === sigFilterEmployeeId || e.fullName === sigFilterEmployeeId);
    const officerName = selectedHrEmp?.fullName || (sigFilterEmployeeId && sigFilterEmployeeId !== 'ALL' ? sigFilterEmployeeId : user?.fullName || 'Chandan');

    // 5. Check if already saved in signatureSheets
    const existing = signatureSheets.find(s => 
      (s.groupId === targetGroupId || s.groupName === targetGroupName) &&
      (s.dateBs.includes(yr) || s.dateBs.includes(nepYear)) &&
      (s.dateBs.includes(mo) || s.dateBs.includes(nepMonth))
    );

    if (existing) {
      setSelectedSignatureSheetToPrint({
        ...existing,
        officerName: officerName || existing.officerName
      });
      setIsSignatureModalOpen(true);
      return;
    }

    // 6. Dynamically build signature sheet with group members + date-aware loans (includes loans closed after targetDateBs)
    setIsLoadingSignatureSheet(true);
    let dateAwareLoans: MFLoanRecord[] = loans;
    try {
      dateAwareLoans = await microFinanceService.fetchLoansForReportDate(targetDateBs);
    } finally {
      setIsLoadingSignatureSheet(false);
    }

    const groupMembers = members.filter(m => (!targetGroupId || targetGroupId === 'all') 
      ? (m.centerId === targetCenterId || m.centerName === targetCenterName) 
      : (m.samuhId === targetGroupId || m.samuhName === targetGroupName));
    const branchInfo = adminBranches.find(b => b.name === targetCenter?.branch) || availableBranches[0];

    const membersToUse = groupMembers.length > 0 ? groupMembers : (members.length > 0 ? members.slice(0, 4) : []);

    const sigMembers: MFSignatureSheetMember[] = membersToUse.map(m => {
      const memLoans = dateAwareLoans.filter(l => 
        (l.memberId === m.memberId || (l.name && m.name && l.name.trim().toLowerCase() === m.name.trim().toLowerCase())) && 
        isLoanActiveOnBsDate(l, targetDateBs)
      );
      const microLoan = memLoans.find(l => l.loanProduct.toLowerCase().includes('micro') || l.loanProduct.toLowerCase().includes('general') || l.loanProduct.toLowerCase().includes('group')) || memLoans[0];
      const emergencyLoan = memLoans.find(l => l.loanProduct.toLowerCase().includes('emergency') || l.loanProduct.toLowerCase().includes('family'));
      const microInstallmentAmt = microLoan ? (microLoan.installmentAmount || 0) : 0;
      const emergencyInstallmentAmt = emergencyLoan ? (emergencyLoan.installmentAmount || 0) : 0;
      const totalLoanAmt = microInstallmentAmt + emergencyInstallmentAmt;
      const savingAmt = m.totalSavings > 0 ? (m.totalSavings >= 2000 ? 1000 : 500) : 500;

      return {
        memberId: m.memberId,
        name: m.name,
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
      id: `preview-${Date.now()}`,
      sheetNo: `SS-${yr}-${Date.now().toString().slice(-4)}`,
      centerId: targetCenterId,
      centerName: targetCenterName,
      groupId: targetGroupId,
      groupName: targetGroupName,
      dateBs: nepaliDateStr,
      location: targetCenter?.location || 'सहोडवा, महोत्तरी',
      branchName: branchInfo?.name || 'सहोडवा सेवा केन्द्र',
      branchAddress: branchInfo?.location || systemSettings?.address || 'पिपरा गाँउपालिका-६, महोत्तरी',
      members: sigMembers,
      totalMembers: sigMembers.length,
      totalSavings: sigMembers.reduce((a, b) => a + b.savingsAmount, 0),
      totalLoans: sigMembers.reduce((a, b) => a + b.loanAmount, 0),
      totalDue: sigMembers.reduce((a, b) => a + (b.dueAmount || 0), 0),
      officerName: officerName,
      createdAt: new Date().toISOString()
    };

    setSelectedSignatureSheetToPrint(previewSheet);
    setIsSignatureModalOpen(true);
  };

  // Handler when user clicks "Generate Sheet" in the Signature Sheet preview modal
  // Saves the sheet permanently into the Signature Sheets records table and opens print preview!
  const handleSaveAndGenerateSignatureSheet = () => {
    if (!selectedSignatureSheetToPrint) return;
    if (isDayEndedForBranch(branch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(selectedSignatureSheetToPrint.dateBs, systemSettings || authSettings)) {
      alert(getBackDateBlockedMessage(selectedSignatureSheetToPrint.dateBs));
      return;
    }

    const existingIndex = signatureSheets.findIndex(s => 
      s.id === selectedSignatureSheetToPrint.id ||
      s.sheetNo === selectedSignatureSheetToPrint.sheetNo ||
      (s.groupId === selectedSignatureSheetToPrint.groupId && s.dateBs === selectedSignatureSheetToPrint.dateBs)
    );

    let savedSheet: MFSignatureSheet;
    if (existingIndex >= 0) {
      savedSheet = {
        ...signatureSheets[existingIndex],
        ...selectedSignatureSheetToPrint,
        id: signatureSheets[existingIndex].id
      };
      const updated = microFinanceService.updateSignatureSheet(savedSheet.id, savedSheet);
      setSignatureSheets(updated);
    } else {
      savedSheet = microFinanceService.addSignatureSheet({
        sheetNo: selectedSignatureSheetToPrint.sheetNo.startsWith('SS-') && !selectedSignatureSheetToPrint.sheetNo.includes('preview')
          ? selectedSignatureSheetToPrint.sheetNo 
          : `SS-${sigFilterYear !== 'ALL' ? sigFilterYear : '2083'}-${Date.now().toString().slice(-4)}`,
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
    }

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
    <div className="space-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[10000] bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar Header with Sub-Menus */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-3 overflow-x-auto scrollbar-hide pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 1. Dashboard */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#00593B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            {/* 2. Centers */}
            <button
              type="button"
              onClick={() => setActiveTab('centers')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'centers'
                  ? 'bg-[#00593B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Centers</span>
            </button>

            {/* 3. Groups */}
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'groups'
                  ? 'bg-[#00593B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Groups</span>
            </button>

            {/* 4. Members */}
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-[#00593B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Members</span>
            </button>

            {/* 5. Saving */}
            <button
              type="button"
              onClick={() => setActiveTab('saving')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'saving'
                  ? 'bg-[#00593B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <PiggyBank className="w-4 h-4" />
              <span>Saving</span>
            </button>

            {/* 6. Loan */}
            <button
              type="button"
              onClick={() => setActiveTab('loan')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'loan'
                  ? 'bg-[#00593B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HandCoins className="w-4 h-4" />
              <span>Loan</span>
            </button>

            {/* 7. Reports */}
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-[#00593B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Reports</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={reloadData}
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MENU CONTENT SECTIONS */}

      {/* ============================================================== */}
      {/* 1. DASHBOARD OVERVIEW (All Menus Summary - Strictly English) */}
      {/* ============================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Clean Dashboard Header Bar (Removed Welcome back, ADMIN SYSTEM, and Quick Action) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-xl font-black text-slate-900">Dashboard Overview</h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentBsDate.year} {currentBsDate.month} {currentBsDate.day}</span>
              </div>
            </div>
          </div>

          {/* Row 1: 6 All-Menu Interactive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. CENTERS */}
            <button
              type="button"
              onClick={() => setActiveTab('centers')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-blue-300 shadow-2xs space-y-2 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">CENTERS</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900">{dashboardStats.totalCenters}</div>
            </button>

            {/* 2. GROUPS */}
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-purple-300 shadow-2xs space-y-2 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">GROUPS</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900">{dashboardStats.totalGroups}</div>
            </button>

            {/* 3. MEMBERS */}
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-2xs space-y-2 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">MEMBERS</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900">{dashboardStats.totalMembers}</div>
            </button>

            {/* 4. SAVING */}
            <button
              type="button"
              onClick={() => setActiveTab('saving')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-2xs space-y-2 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">SAVING BALANCE</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <PiggyBank className="w-4 h-4" />
                </div>
              </div>
              <div className="text-base font-black text-slate-900">
                NPR {dashboardStats.savingBalance.toLocaleString()}
              </div>
            </button>

            {/* 5. LOAN */}
            <button
              type="button"
              onClick={() => setActiveTab('loan')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-amber-300 shadow-2xs space-y-2 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">LOAN PORTFOLIO</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <HandCoins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-base font-black text-slate-900">
                NPR {dashboardStats.loanPortfolio.toLocaleString()}
              </div>
            </button>

            {/* 6. REPORTS */}
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-violet-300 shadow-2xs space-y-2 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">REPORTS</span>
                <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900">{dashboardStats.totalReportsCount}</div>
            </button>
          </div>

          {/* Row 2: Live Portfolio Analytics (Center-wise Comparison & Loan Status Breakdown) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Center-wise Saving vs Loan (Real Center Data) */}
            <div className="lg:col-span-2 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Center-wise Saving &amp; Loan Portfolio</h3>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span> Savings
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-700">
                    <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block"></span> Total Loans
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block"></span> Outstanding
                  </span>
                </div>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={centerAnalytics}>
                    <XAxis dataKey="shortName" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <Tooltip formatter={(val: number | string | undefined) => [`NPR ${(Number(val) || 0).toLocaleString()}`, '']} />
                    <Bar dataKey="savings" name="Total Savings" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="loans" name="Loan Disbursed" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Loan Portfolio & PAR Status */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Loan Portfolio Status</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  Number(dashboardStats.parRate) > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  PAR: {dashboardStats.parRate}%
                </span>
              </div>

              <div className="h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={loanStatusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {loanStatusChartData.map((entry, index) => (
                        <Cell key={`loan-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number | string | undefined) => [`${v} Loans`, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center text-[11px]">
                <div className="p-1.5 rounded-lg bg-blue-50/70">
                  <div className="font-black text-blue-700">{dashboardStats.activeLoansCount}</div>
                  <div className="text-[10px] font-bold text-slate-500">Active</div>
                </div>
                <div className="p-1.5 rounded-lg bg-amber-50/70">
                  <div className="font-black text-amber-700">{dashboardStats.maturedLoansCount}</div>
                  <div className="text-[10px] font-bold text-slate-500">Matured</div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Centers & Groups Directory Table + Saving/Loan/Reports Hub */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Centers & Groups Overview Table */}
            <div className="lg:col-span-2 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Centers &amp; Groups Summary</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('centers')}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  View All Centers
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-black uppercase text-[10px]">
                      <th className="py-2 pr-2">CODE</th>
                      <th className="py-2 px-2">CENTER NAME</th>
                      <th className="py-2 px-2 text-center">GROUPS</th>
                      <th className="py-2 px-2 text-center">MEMBERS</th>
                      <th className="py-2 px-2 text-right">SAVINGS</th>
                      <th className="py-2 px-2 text-right">OUTSTANDING</th>
                      <th className="py-2 pl-2 text-center">MEETING DAY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {centerAnalytics.map(row => (
                      <tr
                        key={row.id}
                        onClick={() => setActiveTab('centers')}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 pr-2 font-mono font-bold text-blue-700">{row.code}</td>
                        <td className="py-2.5 px-2">
                          <div className="font-extrabold text-slate-900">{row.name}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold">{row.groupsCount}</td>
                        <td className="py-2.5 px-2 text-center font-bold">{row.membersCount}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-700">
                          NPR {row.savings.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-amber-700">
                          NPR {row.outstanding.toLocaleString()}
                        </td>
                        <td className="py-2.5 pl-2 text-center">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            {row.meetingDay}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {centerAnalytics.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No centers available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reports & Financial Health Summary Card */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800">Reports &amp; Financial Summary</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Open Reports
                  </button>
                </div>

                {/* Reports 3 Sub-Menu Links */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('reports'); setReportTab('collection'); }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                      <span>Collection Sheet</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono font-bold text-[11px] text-slate-700">
                      {dashboardStats.collectionSheetsCount} records
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('reports'); setReportTab('signature'); }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <Printer className="w-4 h-4 text-emerald-600" />
                      <span>Signature Sheet</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono font-bold text-[11px] text-slate-700">
                      {dashboardStats.signatureSheetsCount} records
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('reports'); setReportTab('meeting-minutes'); }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-violet-50/70 border border-slate-200 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <FileText className="w-4 h-4 text-violet-600" />
                      <span>Meeting Minute</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono font-bold text-[11px] text-slate-700">
                      {dashboardStats.meetingMinutesCount} records
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Recent Records Across Saving, Loan & Meeting Minutes (Strictly English) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Savings */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <PiggyBank className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Recent Savings</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('saving')}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {savings.slice(0, 4).map(s => (
                  <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{s.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-emerald-700">NPR {s.amount.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
                {savings.length === 0 && (
                  <div className="py-6 text-center text-slate-400 text-xs">No saving records</div>
                )}
              </div>
            </div>

            {/* Active Loans */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <HandCoins className="w-3.5 h-3.5 text-amber-600" />
                  <span>Loan Accounts</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('loan')}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {loans.slice(0, 4).map(l => (
                  <div key={l.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{l.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-slate-900">NPR {l.loanAmount.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
                {loans.length === 0 && (
                  <div className="py-6 text-center text-slate-400 text-xs">No loan records</div>
                )}
              </div>
            </div>

            {/* Recent Meeting Minutes & Sheets */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-600" />
                  <span>Recent Meeting Minutes</span>
                </h4>
                <button
                  type="button"
                  onClick={() => { setActiveTab('reports'); setReportTab('meeting-minutes'); }}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {meetingMinutes.slice(0, 4).map(m => (
                  <div key={m.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{m.groupName}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold text-slate-700">
                        {m.presentCount}/{m.totalMembersCount} Present
                      </div>
                    </div>
                  </div>
                ))}
                {meetingMinutes.length === 0 && (
                  <div className="py-6 text-center text-slate-400 text-xs">No meeting records</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CENTERS MANAGEMENT (Matching image_fd131ba8.png) */}
      {/* ============================================================== */}
      {activeTab === 'centers' && (
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
                            disabled={isDayEnded}
                            onClick={() => handleEditCenter(center)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Center'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleDeleteCenter(center.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Center'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
      {activeTab === 'groups' && (
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
                        <span className="text-blue-600 font-bold flex items-center gap-1 cursor-pointer hover:underline">
                          <Users className="w-3.5 h-3.5" />
                          <span>{group.membersCount} Members</span>
                        </span>
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
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleEditGroup(group)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Group'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Group'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h2 className="text-xl font-black text-slate-900">Members</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                MICROFINANCE SYSTEM
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-2">
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

              <button
                type="button"
                onClick={() => showToast('Exporting members to Excel...')}
                className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="Download Member List"
              >
                <Download className="w-4 h-4" />
              </button>

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
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredMembers.map((member, idx) => (
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
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleEditMember(member)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Member'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleDeleteMember(member.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Member'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No members found matching search.
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
      {activeTab === 'saving' && (
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reloadData}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

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
            </div>
          </div>

          {/* Main Card: DEPOSIT HISTORY */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Card Header Filter Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>DEPOSIT HISTORY</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search member or account..."
                    value={savingSearch}
                    onChange={e => setSavingSearch(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 w-52 sm:w-64"
                  />
                </div>

                <select
                  value={savingStatusFilter}
                  onChange={e => setSavingStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="All">All Status</option>
                  <option value="PAID">Paid</option>
                  <option value="DUE">Due</option>
                  <option value="PENDING">Pending</option>
                </select>
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
                    <th className="py-2 px-3">DATE (BS)</th>
                    <th className="py-2 px-3 text-right">AMOUNT</th>
                    <th className="py-2 px-3 text-center">STATUS</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredSavings.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700">{item.memberId}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800">{item.accountNo}</td>
                      <td className="py-2 px-3 font-extrabold text-slate-900">{item.name}</td>
                      <td className="py-2 px-3 text-slate-600">{item.groupName}</td>
                      <td className="py-2 px-3 text-slate-700 font-mono font-bold">
                        {item.dateBs || (item.date && item.date.startsWith('208') ? item.date : (() => {
                          try {
                            return new NepaliDate(new Date(item.date)).format('YYYY-MM-DD');
                          } catch {
                            return item.date || '2083-06-29';
                          }
                        })())}
                      </td>
                      <td className="py-2 px-3 text-right font-black font-mono text-emerald-700">
                        NPR {item.amount.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => handleOpenDeleteSaving(item)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredSavings.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                            <Search className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-800">No savings records found.</p>
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
      {activeTab === 'loan' && (
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
                    className={`px-3.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      loanStatusTab === tab.key
                        ? tab.key === 'MATURED'
                          ? 'bg-white text-amber-600 shadow-2xs'
                          : tab.key === 'CLOSED'
                          ? 'bg-white text-slate-800 shadow-2xs'
                          : 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
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
            </div>
          </div>

          {/* Main Card: LOAN RECORDS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Card Filter Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-orange-600" />
                <span>LOAN RECORDS</span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search loans..."
                  value={loanSearch}
                  onChange={e => setLoanSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500 w-52 sm:w-64"
                />
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
                    <th className="py-2 px-3 text-right">INSTALLMENT</th>
                    <th className="py-2 px-3 text-center">STATUS</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loanStatusTab === 'CLOSED' && isLoadingClosedLoans ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
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
                              {/* Close Loan Action (Shown on Active & Mature loans to close & archive to Supabase) */}
                              {effStatus !== 'CLOSED' && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenCloseLoan(loan)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                                    effStatus === 'MATURED'
                                      ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-600 hover:text-white border border-slate-200'
                                  }`}
                                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Close Loan & Archive to Supabase'}
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Close Loan</span>
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
                              <button
                                type="button"
                                disabled={isDayEnded}
                                onClick={() => handleOpenEditLoan(loan)}
                                className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Loan'}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {/* Delete Action */}
                              <button
                                type="button"
                                disabled={isDayEnded}
                                onClick={() => handleOpenDeleteLoan(loan)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Loan'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {!(loanStatusTab === 'CLOSED' && isLoadingClosedLoans) && filteredLoans.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
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
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* Top Switcher Tabs: Collection Sheet vs Signature Sheet */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReportTab('collection')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer ${
                reportTab === 'collection'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Collection Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setReportTab('signature')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer ${
                reportTab === 'signature'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Signature Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setReportTab('meeting-minutes')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer ${
                reportTab === 'meeting-minutes'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Meeting Minute</span>
            </button>
          </div>

          {/* TAB 1: COLLECTION SHEET */}
          {reportTab === 'collection' && (
            <>
              {/* Filter Card with Year, Month, Day, Center, Group, View */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                  {/* YEAR */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">YEAR</label>
                    <select
                      value={reportYear}
                      onChange={e => setReportYear(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="2081">2081</option>
                      <option value="2082">2082</option>
                      <option value="2083">2083</option>
                      <option value="2084">2084</option>
                    </select>
                  </div>

                  {/* MONTH */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">MONTH</label>
                    <select
                      value={reportMonth}
                      onChange={e => setReportMonth(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      {nepaliMonthsEnglish.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* DAY */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">DAY</label>
                    <select
                      value={reportDay}
                      onChange={e => setReportDay(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      {Array.from({ length: 32 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString()}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* SELECT CENTER (Red-circled REFRESH removed) */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">SELECT CENTER</label>
                    <select
                      value={reportCenterId}
                      onChange={e => setReportCenterId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="">Choose a center...</option>
                      {centers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* SELECT GROUP */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">SELECT GROUP</label>
                    <select
                      value={reportGroupId}
                      onChange={e => setReportGroupId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="">All Groups...</option>
                      {groups
                        .filter(g => !reportCenterId || g.centerId === reportCenterId)
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
                      className="w-full py-2 bg-[#4f7df5] hover:bg-[#3b6ae8] disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                    >
                      {isLoadingCollectionSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                      <span>{isLoadingCollectionSheet ? 'Loading...' : 'View'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Results Card: Collection Sheet Records with Right-side Year & Month Dropdowns */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
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
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
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
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
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
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
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
                        <th className="py-3 px-4 w-14 text-center">S.N.</th>
                        <th className="py-3 px-4">CENTER NAME</th>
                        <th className="py-3 px-4">GROUP NAME</th>
                        <th className="py-3 px-4">DATE</th>
                        <th className="py-3 px-4 text-center">STATUS</th>
                        <th className="py-3 px-4 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {(() => {
                        const filteredCollectionSheets = sheets.filter(sheet => {
                          if (sheetHistoryYear !== 'ALL' && sheetHistoryYear !== 'All') {
                            const nepYear = toNepaliDigits(sheetHistoryYear);
                            if (!sheet.dateDisplay.includes(sheetHistoryYear) && !sheet.dateDisplay.includes(nepYear) && sheet.year !== sheetHistoryYear) return false;
                          }
                          if (sheetHistoryMonth !== 'ALL' && sheetHistoryMonth !== 'All') {
                            const nepMonth = nepaliMonthMapNp[sheetHistoryMonth] || sheetHistoryMonth;
                            if (!sheet.dateDisplay.includes(sheetHistoryMonth) && !sheet.dateDisplay.includes(nepMonth) && sheet.month !== sheetHistoryMonth) return false;
                          }
                          return true;
                        });

                        if (filteredCollectionSheets.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-16 text-center">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-blue-400" />
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
                            <td className="py-3 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{sheet.centerName}</td>
                            <td className="py-3 px-4 text-slate-600">{sheet.groupName}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">{sheet.dateDisplay}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                sheet.status === 'COLLECTED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {sheet.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setActiveSheetToPrint(sheet); setIsPrintSheetModalOpen(true); }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View / Print</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => handleOpenDeleteSheet(sheet)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Sheet'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
          {reportTab === 'signature' && (
            <div className="space-y-4">
              {/* Signature Sheet Filter Card: Compact Year, Month, Day, Center, Group, Employee, and small View button */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-end gap-2.5">
                  {/* YEAR (Compact - No extra space per image_0a190e6f.png) */}
                  <div className="w-24 shrink-0">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">YEAR</label>
                    <select
                      value={sigFilterYear}
                      onChange={e => setSigFilterYear(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All</option>
                      <option value="2081">2081</option>
                      <option value="2082">2082</option>
                      <option value="2083">2083</option>
                      <option value="2084">2084</option>
                    </select>
                  </div>

                  {/* MONTH (Compact - No extra space per image_0a190e6f.png) */}
                  <div className="w-28 shrink-0">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">MONTH</label>
                    <select
                      value={sigFilterMonth}
                      onChange={e => setSigFilterMonth(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All</option>
                      {nepaliMonthsEnglish.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* DAY (Compact - No extra space per image_0a190e6f.png) */}
                  <div className="w-20 shrink-0">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">DAY</label>
                    <select
                      value={sigFilterDay}
                      onChange={e => setSigFilterDay(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All</option>
                      {Array.from({ length: 32 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString()}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* SELECT CENTER */}
                  <div className="flex-1 min-w-[130px]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 truncate">SELECT CENTER</label>
                    <select
                      value={sigFilterCenterId}
                      onChange={e => setSigFilterCenterId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All Centers</option>
                      {centers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* SELECT GROUP */}
                  <div className="flex-1 min-w-[130px]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 truncate">SELECT GROUP</label>
                    <select
                      value={sigFilterGroupId}
                      onChange={e => setSigFilterGroupId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="ALL">All Groups</option>
                      {groups
                        .filter(g => sigFilterCenterId === 'ALL' || !sigFilterCenterId || g.centerId === sigFilterCenterId)
                        .map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* EMPLOYEE (Populated from HR Management) */}
                  <div className="flex-1 min-w-[130px]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 truncate">EMPLOYEE</label>
                    <select
                      value={sigFilterEmployeeId}
                      onChange={e => setSigFilterEmployeeId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
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
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
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
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
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
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
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
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
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
                        <th className="py-3 px-4 w-12 text-center">S.N.</th>
                        <th className="py-3 px-4">SHEET NO</th>
                        <th className="py-3 px-4">CENTER NAME</th>
                        <th className="py-3 px-4">GROUP NAME</th>
                        <th className="py-3 px-4">DATE (BS)</th>
                        <th className="py-3 px-4 text-center">MEMBERS</th>
                        <th className="py-3 px-4 text-right">TOTAL SAVINGS</th>
                        <th className="py-3 px-4 text-right">TOTAL LOANS</th>
                        <th className="py-3 px-4 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {(() => {
                        const filteredSignatureSheets = signatureSheets.filter(sig => {
                          // Filter strictly by History Year & Month from table's own header
                          if (sigHistoryYear !== 'ALL' && sigHistoryYear !== 'All') {
                            const nepYear = toNepaliDigits(sigHistoryYear);
                            if (!sig.dateBs.includes(sigHistoryYear) && !sig.dateBs.includes(nepYear)) return false;
                          }
                          if (sigHistoryMonth !== 'ALL' && sigHistoryMonth !== 'All') {
                            const nepMonth = nepaliMonthMapNp[sigHistoryMonth] || sigHistoryMonth;
                            if (!sig.dateBs.includes(sigHistoryMonth) && !sig.dateBs.includes(nepMonth)) return false;
                          }
                          return true;
                        });

                        if (filteredSignatureSheets.length === 0) {
                          return (
                            <tr>
                              <td colSpan={9} className="py-16 text-center">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                    <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
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
                            <td className="py-3 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono font-bold text-blue-700">{sig.sheetNo}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{sig.centerName}</td>
                            <td className="py-3 px-4 text-slate-700">{sig.groupName}</td>
                            <td className="py-3 px-4 font-bold text-slate-800">{sig.dateBs}</td>
                            <td className="py-3 px-4 text-center font-bold">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono text-[11px]">
                                {sig.totalMembers || sig.members?.length || 0}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                              NPR {sig.totalSavings?.toLocaleString() || 0}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-orange-700">
                              NPR {sig.totalLoans?.toLocaleString() || 0}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSignatureSheetToPrint(sig);
                                    setIsSignatureModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                                  title="View & Print Signature Sheet"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>View / Print</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() => {
                                    setSelectedSignatureSheetToDelete(sig);
                                    setIsDeleteSignatureModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Signature Sheet'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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

          {/* TAB 3: GROUP MEETING & MINUTES */}
          {reportTab === 'meeting-minutes' && (
            <GroupMeetingMinutesModule
              groups={groups}
              members={members}
              centers={centers}
              branches={adminBranches.length > 0 ? adminBranches : availableBranches}
              hrEmployees={activeHrEmployees}
              logoUrl={logoUrl}
              onToast={showToast}
              branchId={branch?.id}
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
                    value={centerForm.branch}
                    onChange={e => setCenterForm({ ...centerForm, branch: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  >
                    {availableBranches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
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
                    {centers.map(c => (
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
                    onChange={e => setMemberForm({ ...memberForm, memberId: e.target.value })}
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
                  onChange={e => setMemberForm({ ...memberForm, name: e.target.value })}
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
                    onChange={e => setMemberForm({ ...memberForm, citizenshipNo: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MOBILE NUMBER</label>
                  <input
                    type="text"
                    placeholder="98XXXXXXXX"
                    value={memberForm.mobile}
                    onChange={e => setMemberForm({ ...memberForm, mobile: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CENTER</label>
                  <select
                    value={memberForm.centerId}
                    onChange={e => setMemberForm({ ...memberForm, centerId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {centers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GROUP</label>
                  <select
                    value={memberForm.samuhId}
                    onChange={e => setMemberForm({ ...memberForm, samuhId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
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
              </DayEndFieldset>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
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
                  {memberSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setMemberSearchInput('');
                        setIsMemberDropdownOpen(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
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
                      className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 space-y-2.5 relative group hover:border-emerald-300/80 transition-all"
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

                        {/* Open Amount */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            OPEN AMOUNT
                          </label>
                          <input
                            type="number"
                            value={acc.amount}
                            onChange={e => handleUpdateSavingAccount(acc.id, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-black font-mono text-sm text-emerald-800 focus:outline-hidden focus:ring-1 focus:ring-[#00593B]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date & Total Summary Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DATE (BS / AD)</label>
                  <input
                    type="date"
                    value={savingDate}
                    onChange={e => setSavingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#00593B]"
                  />
                </div>
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80 flex flex-col justify-center">
                  <div className="text-[10px] font-bold uppercase text-emerald-800">TOTAL OPENING DEPOSIT</div>
                  <div className="font-mono font-black text-base text-[#00593B]">
                    NPR {savingAccounts.reduce((sum, a) => sum + (Number(a.amount) || 0), 0).toLocaleString()}
                  </div>
                </div>
              </div>
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
                  SELECT MEMBER (SEARCH BY ID OR NAME) <span className="text-rose-500">*</span>
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
                  {loanMemberSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoanMemberSearchInput('');
                        setIsLoanMemberDropdownOpen(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
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

              {/* Row 2: Open Date (BS: YYYY-MM-DD) & Product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    OPEN DATE (BS: YYYY-MM-DD) <span className="text-rose-500">*</span>
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
                    AMOUNT (NPR) <span className="text-rose-500">*</span>
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

              {/* Row 4: Installment (Manually Editable) & Maturity Date (Auto-calculated from period) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    INSTALLMENT (NPR) <span className="text-slate-400 font-normal">(Manual Edit)</span>
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
              {selectedLoanToView.status !== 'CLOSED' && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={() => {
                    setIsViewLoanModalOpen(false);
                    handleOpenCloseLoan(selectedLoanToView);
                  }}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Close Loan'}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Close Loan</span>
                </button>
              )}
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
              <h3 className="text-base font-extrabold text-slate-900">Delete Loan Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete loan account <strong className="font-mono text-slate-800">{selectedLoanToDelete.accountNo}</strong> for <strong>{selectedLoanToDelete.name}</strong>?
              </p>
              <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                Amount: NPR {selectedLoanToDelete.loanAmount.toLocaleString()}
              </div>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteLoanModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteLoan}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Loan'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete
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
        const centerBranch = adminBranches.find(b => b.name === centerObj?.branch) || availableBranches[0];
        const groupMembers = members.filter(m => (!activeSheetToPrint.groupId || activeSheetToPrint.groupId === 'all') ? (m.centerId === activeSheetToPrint.centerId || m.centerName === activeSheetToPrint.centerName) : m.samuhId === activeSheetToPrint.groupId);
        const nepMonth = nepaliMonthMapNp[activeSheetToPrint.month] || activeSheetToPrint.month;
        const nepYear = toNepaliDigits(activeSheetToPrint.year);
        const nepDay = toNepaliDigits(activeSheetToPrint.day);
        const nepDateStr = `${nepYear}/${nepMonth}/${nepDay}`;

        // Totals calculations
        let totalSaving = 0;
        let totalMicroPrincipal = 0;
        let totalMicroKista = 0;
        let totalMicroAmount = 0;
        let totalEmergencyPrincipal = 0;
        let totalEmergencyKista = 0;
        let totalEmergencyAmount = 0;
        let totalDue = 0;
        let grandTotal = 0;

        // If groupMembers is empty, fall back to members or realistic sample members so user sees table filled
        const membersToRender = groupMembers.length > 0 ? groupMembers : (members.length > 0 ? members.slice(0, 4) : [
          {
            id: 'mem-1',
            memberId: 'M-1001',
            name: 'Sita Devi Chaudhary',
            citizenshipNo: '18-01-75-01234',
            mobile: '9801234567',
            gender: 'Female',
            branch: 'Ratauli Central Head Office',
            centerId: activeSheetToPrint.centerId,
            centerName: activeSheetToPrint.centerName,
            samuhId: activeSheetToPrint.groupId,
            samuhName: activeSheetToPrint.groupName,
            role: 'Member',
            savingsAccountNo: 'SAV-1001',
            address: 'Pipra-6, Mahottari',
            joinedDate: '2080-01-15',
            status: 'ACTIVE',
            totalSavings: 2000,
            activeLoanAmount: 60000
          },
          {
            id: 'mem-2',
            memberId: 'M-1002',
            name: 'Geeta Kumari Mandal',
            citizenshipNo: '18-02-76-08912',
            mobile: '9812345678',
            gender: 'Female',
            branch: 'Ratauli Central Head Office',
            centerId: activeSheetToPrint.centerId,
            centerName: activeSheetToPrint.centerName,
            samuhId: activeSheetToPrint.groupId,
            samuhName: activeSheetToPrint.groupName,
            role: 'Member',
            savingsAccountNo: 'SAV-1002',
            address: 'Pipra-6, Mahottari',
            joinedDate: '2081-03-20',
            status: 'ACTIVE',
            totalSavings: 18200,
            activeLoanAmount: 40000
          }
        ] as MFMember[]);

        const targetReportDateBs = collectionSheetTargetBs || buildBsDateFromParts(activeSheetToPrint.year, activeSheetToPrint.month, activeSheetToPrint.day);
        const sheetLoansPool = collectionSheetLoans.length > 0 ? collectionSheetLoans : loans;

        const rowsData = membersToRender.map((mem, i) => {
          const memLoans = sheetLoansPool.filter(l => 
            (l.memberId === mem.memberId || (l.name && mem.name && l.name.trim().toLowerCase() === mem.name.trim().toLowerCase())) && 
            isLoanActiveOnBsDate(l, targetReportDateBs)
          );
          const microLoan = memLoans.find(l => l.loanProduct.toLowerCase().includes('micro') || l.loanProduct.toLowerCase().includes('general') || l.loanProduct.toLowerCase().includes('group')) || memLoans[0];
          const emergencyLoan = memLoans.find(l => l.loanProduct.toLowerCase().includes('emergency') || l.loanProduct.toLowerCase().includes('family'));
          
          const savingAmt = mem.totalSavings > 0 ? (mem.totalSavings >= 2000 ? 1000 : 500) : 500;
          
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
          totalMicroKista += microKista;
          totalMicroAmount += microAmt;
          totalEmergencyPrincipal += emergencyPrincipal;
          totalEmergencyKista += emergencyKista;
          totalEmergencyAmount += emergencyAmt;
          totalDue += dueAmt;
          grandTotal += rowTotal;

          return {
            sn: i + 1,
            memberId: mem.memberId,
            name: mem.name,
            saving: savingAmt,
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
              {/* Top Header Bar: Clean title, Print icon button, Close button */}
              <div className="bg-[#0b1329] px-6 py-3.5 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-extrabold tracking-wide">Micro-Finance Collection Sheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintElement('printable-collection-sheet')}
                    className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs transition-colors"
                    title="Print Sheet"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrintSheetModalOpen(false)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

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

                {/* Multi-tier Clean Black & White Table: Suitable compact columns, zero horizontal stretch */}
                <div className="overflow-x-auto rounded-lg border-2 border-black shadow-none">
                  <table className="w-full border-collapse text-xs text-black">
                    <thead>
                      <tr className="bg-slate-100 text-black font-black uppercase text-[10px] tracking-wider border-b-2 border-black">
                        <th rowSpan={2} className="py-1 px-1 border-r border-black text-center w-10 whitespace-nowrap">S.N.</th>
                        <th rowSpan={2} className="py-1 px-1.5 border-r border-black text-center w-20 whitespace-nowrap">Member ID</th>
                        <th rowSpan={2} className="py-1 px-2 border-r border-black text-left min-w-[130px] whitespace-nowrap">Name</th>
                        <th rowSpan={2} className="py-1 px-1.5 border-r border-black text-right w-16 whitespace-nowrap">Saving</th>
                        <th colSpan={4} className="py-0.5 px-1.5 border-r border-black text-center bg-slate-100 font-black whitespace-nowrap">
                          Micro-enterprises Loan
                        </th>
                        <th colSpan={4} className="py-0.5 px-1.5 border-r border-black text-center bg-slate-100 font-black whitespace-nowrap">
                          Emergency Loan
                        </th>
                        <th rowSpan={2} className="py-1 px-1 text-right border-r border-black w-16 whitespace-nowrap text-black font-black">
                          Due
                        </th>
                        <th rowSpan={2} className="py-1 px-2 text-right bg-slate-100 text-black font-black w-20 whitespace-nowrap">
                          Total
                        </th>
                      </tr>
                      <tr className="bg-slate-50 text-black font-black uppercase text-[9px] tracking-wider border-b-2 border-black">
                        <th className="py-0.5 px-1 border-r border-black text-center w-20 whitespace-nowrap">Date</th>
                        <th className="py-0.5 px-1 border-r border-black text-right w-18 whitespace-nowrap">Principal</th>
                        <th className="py-0.5 px-1 border-r border-black text-center w-10 whitespace-nowrap">Kista</th>
                        <th className="py-0.5 px-1 border-r border-black text-right text-black w-16 whitespace-nowrap">Amount</th>
                        <th className="py-0.5 px-1 border-r border-black text-center w-14 whitespace-nowrap">Date</th>
                        <th className="py-0.5 px-1 border-r border-black text-right w-16 whitespace-nowrap">Principal</th>
                        <th className="py-0.5 px-1 border-r border-black text-center w-10 whitespace-nowrap">Kista</th>
                        <th className="py-0.5 px-1 border-r border-black text-right text-black w-16 whitespace-nowrap">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/30 font-medium text-black bg-white">
                      {rowsData.map((row) => (
                        <tr key={row.memberId} className="hover:bg-slate-50 border-b border-black/40">
                          <td className="py-1 px-1 text-center font-bold text-black border-r border-black whitespace-nowrap">{row.sn}</td>
                          <td className="py-1 px-1.5 text-center font-mono font-bold text-black border-r border-black whitespace-nowrap">{row.memberId}</td>
                          <td className="py-1 px-2 font-bold text-black border-r border-black whitespace-nowrap">{row.name}</td>
                          <td className="py-1 px-1.5 text-right font-mono font-bold text-black border-r border-black whitespace-nowrap">
                            {row.saving.toLocaleString()}
                          </td>
                          <td className="py-1 px-1 text-center font-mono text-[11px] text-black border-r border-black whitespace-nowrap">{row.microDate}</td>
                          <td className="py-1 px-1 text-right font-mono font-bold text-black border-r border-black whitespace-nowrap">{row.microPrincipal ? row.microPrincipal.toLocaleString() : '-'}</td>
                          <td className="py-1 px-1 text-center font-mono font-bold text-black border-r border-black whitespace-nowrap">{row.microKista || '-'}</td>
                          <td className="py-1 px-1 text-right font-mono font-bold text-black border-r border-black whitespace-nowrap">{row.microAmount ? row.microAmount.toLocaleString() : '-'}</td>
                          <td className="py-1 px-1 text-center font-mono text-[11px] text-black border-r border-black whitespace-nowrap">{row.emergencyDate}</td>
                          <td className="py-1 px-1 text-right font-mono font-bold text-black border-r border-black whitespace-nowrap">{row.emergencyPrincipal ? row.emergencyPrincipal.toLocaleString() : '-'}</td>
                          <td className="py-1 px-1 text-center font-mono font-bold text-black border-r border-black whitespace-nowrap">{row.emergencyKista || '-'}</td>
                          <td className="py-1 px-1 text-right font-mono font-bold text-black border-r border-black whitespace-nowrap">{row.emergencyAmount ? row.emergencyAmount.toLocaleString() : '-'}</td>
                          <td className="py-0.5 px-1 text-right font-mono border-r border-black whitespace-nowrap">
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
                              className="w-14 px-1 py-0.5 text-right font-mono font-bold text-black bg-white border border-black rounded shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-black disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-black text-black whitespace-nowrap">
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
                      <tr className="bg-slate-100 text-black font-black text-xs border-t-2 border-black whitespace-nowrap">
                        <td colSpan={3} className="py-1.5 px-2 text-center tracking-widest text-xs uppercase border-r border-black whitespace-nowrap">
                          TOTAL
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-mono font-black text-black border-r border-black whitespace-nowrap">
                          {totalSaving.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1 text-center text-black border-r border-black whitespace-nowrap">-</td>
                        <td className="py-1.5 px-1 text-right font-mono font-black text-black border-r border-black whitespace-nowrap">
                          {totalMicroPrincipal.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1 text-center font-mono font-black text-black border-r border-black whitespace-nowrap">
                          {totalMicroKista > 0 ? totalMicroKista : '-'}
                        </td>
                        <td className="py-1.5 px-1 text-right font-mono font-black text-black border-r border-black whitespace-nowrap">
                          {totalMicroAmount.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1 text-center text-black border-r border-black whitespace-nowrap">-</td>
                        <td className="py-1.5 px-1 text-right font-mono font-black text-black border-r border-black whitespace-nowrap">
                          {totalEmergencyPrincipal.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1 text-center font-mono font-black text-black border-r border-black whitespace-nowrap">
                          {totalEmergencyKista > 0 ? totalEmergencyKista : '-'}
                        </td>
                        <td className="py-1.5 px-1 text-right font-mono font-black text-black border-r border-black whitespace-nowrap">
                          {totalEmergencyAmount.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-1 text-right font-mono font-black text-black border-r border-black whitespace-nowrap">
                          {totalDue.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-right bg-slate-200 text-black font-mono font-black text-xs whitespace-nowrap">
                          {grandTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Modal Footer: 'Generate Sheet' button saves permanently and closes modal */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPrintSheetModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Close
                </button>
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
              {/* Action Bar (Top Print & Close) - Clean bar with icon only per red circle */}
              <div className="bg-[#0b1329] px-6 py-3.5 flex justify-end items-center text-white shrink-0 print:hidden">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintElement('printable-signature-sheet')}
                    className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs transition-colors"
                    title="Print Sheet"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(false)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

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

                {/* Table with crisp black borders (Center aligned बचत & ऋण रकम per user request) */}
                <div className="overflow-x-auto pt-1">
                  <table className="w-full border-collapse border-2 border-slate-900 text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-50 font-black text-slate-900 text-[11px]">
                        <th className="p-2 border border-slate-900 text-center w-14 whitespace-nowrap">क्र.सं.</th>
                        <th className="p-2 border border-slate-900 text-left whitespace-nowrap">सदस्यको नाम</th>
                        <th className="p-2 border border-slate-900 text-center w-32 whitespace-nowrap">सदस्य नं.</th>
                        <th className="p-2 border border-slate-900 text-center w-32 whitespace-nowrap">बचत (रु.)</th>
                        <th className="p-2 border border-slate-900 text-center w-36 whitespace-nowrap">ऋण रकम (रु.)</th>
                        <th className="p-2 border border-slate-900 text-center w-40 whitespace-nowrap">हस्ताक्षर</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSignatureSheetToPrint.members?.map((mem, idx) => (
                        <tr key={mem.memberId || idx} className="border-b border-slate-800">
                          <td className="p-3 border border-slate-900 text-center font-bold text-slate-700 whitespace-nowrap">
                            {toNepaliDigits(idx + 1)}
                          </td>
                          <td className="p-3 border border-slate-900 font-bold text-slate-900 whitespace-nowrap">
                            {mem.name}
                          </td>
                          <td className="p-3 border border-slate-900 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                            {mem.memberId}
                          </td>
                          {/* बचत (रु.) - Center aligned */}
                          <td className="p-3 border border-slate-900 text-center font-mono font-bold"></td>
                          {/* ऋण रकम (रु.) - Center aligned */}
                          <td className="p-3 border border-slate-900 text-center font-mono font-bold"></td>
                          {/* हस्ताक्षर - Blank for physical signature */}
                          <td className="p-3 border border-slate-900 text-center h-12"></td>
                        </tr>
                      ))}

                      {/* Total summary row (Center aligned) */}
                      <tr className="border-t-2 border-slate-900 bg-slate-100 font-black text-slate-900">
                        <td colSpan={3} className="p-2.5 border border-slate-900 text-center uppercase tracking-wider">
                          कुल जम्मा (Total)
                        </td>
                        <td className="p-2.5 border border-slate-900 text-center font-mono text-xs"></td>
                        <td className="p-2.5 border border-slate-900 text-center font-mono text-xs"></td>
                        <td className="p-2.5 border border-slate-900"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Bottom Signatures: समूह अध्यक्ष with Name (Left) and कर्मचारी (Right) */}
                <div className="flex justify-between items-end pt-12 pb-3 px-6 text-xs font-bold text-slate-900">
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

              {/* Modal Footer (Screen only) - Updated to Generate Sheet */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
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
      {/* MODAL: DELETE SAVING CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteSavingModalOpen && selectedSavingToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Saving Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete saving record <strong className="font-mono text-slate-800">{selectedSavingToDelete.accountNo}</strong> for <strong>{selectedSavingToDelete.name}</strong>?
              </p>
              <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                Member ID: {selectedSavingToDelete.memberId} • Date: {selectedSavingToDelete.dateBs || selectedSavingToDelete.date} • Amount: NPR {selectedSavingToDelete.amount.toLocaleString()}
              </div>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteSavingModalOpen(false); setSelectedSavingToDelete(null); }}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteSaving}
                title={isDayEnded ? 'Day Ended - Action Locked' : 'Confirm Delete Saving'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete
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
              <h3 className="text-base font-extrabold text-slate-900">Delete Center?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete center <strong className="font-mono text-slate-800">{selectedCenterToDelete.code}</strong> ({selectedCenterToDelete.name})?
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteCenterModalOpen(false); setSelectedCenterToDelete(null); }}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteCenter}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete
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
              <h3 className="text-base font-extrabold text-slate-900">Delete Group?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete group <strong className="font-mono text-slate-800">{selectedGroupToDelete.code}</strong> ({selectedGroupToDelete.name})?
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteGroupModalOpen(false); setSelectedGroupToDelete(null); }}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteGroup}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
              <h3 className="text-base font-extrabold text-slate-900">Delete Member?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete member <strong className="font-mono text-slate-800">{selectedMemberToDelete.memberId}</strong> (<strong>{selectedMemberToDelete.name}</strong>)?
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteMemberModalOpen(false); setSelectedMemberToDelete(null); }}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={handleConfirmDeleteMember}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete
              </button>
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
    </div>
  );
};
