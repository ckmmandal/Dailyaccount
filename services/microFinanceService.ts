import NepaliDate from 'nepali-date-converter';
import { supabase } from './supabase';
import { assertDayNotEnded } from '../utils/dayEndLock';

export interface MFCenter {
  id: string;
  code: string;
  name: string;
  location: string;
  branch: string;
  meetingDay: string; // e.g. "Day 15th"
  status: 'ACTIVE' | 'INACTIVE';
  fieldOfficer?: string;
  contactNo?: string;
  createdAt: string;
}

export interface MFSamuhGroup {
  id: string;
  code: string;
  name: string;
  centerId: string;
  centerName: string;
  place: string;
  membersCount: number;
  meetingDay: string;
  status: 'ACTIVE' | 'INACTIVE';
  leaderName?: string;
  leaderMobile?: string;
  createdAt: string;
}

export interface MFMember {
  id: string;
  memberId: string;
  name: string;
  citizenshipNo: string;
  mobile: string;
  gender: 'Female' | 'Male' | 'Other';
  branch: string;
  centerId: string;
  centerName: string;
  samuhId: string;
  samuhName: string;
  role: 'Leader' | 'Secretary' | 'Treasurer' | 'Member';
  savingsAccountNo: string;
  address: string;
  joinedDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  totalSavings: number;
  activeLoanAmount: number;
  photoUrl?: string;
  createdAt: string;
}

export interface MFSavingsRecord {
  id: string;
  memberId: string;
  accountNo: string;
  name: string;
  groupName: string;
  centerName: string;
  date: string; // e.g. "2026-11-10"
  dateBs?: string;
  amount: number;
  savingType: 'Normal Saving' | 'Recurring Saving' | 'Compulsory' | 'Optional' | 'Fixed Deposit' | string;
  status: 'ACTIVE' | 'CLOSED' | 'INACTIVE' | 'PAID' | 'DUE' | 'PENDING';
  collectedBy?: string;
  createdBy?: string;
  createdByName?: string;
  receiptNo?: string;
  remarks?: string;
  createdAt: string;
}

export interface MFLoanRecord {
  id: string;
  memberId: string;
  accountNo: string;
  name: string;
  centerName: string;
  groupName: string;
  loanDate: string;
  loanDateBs?: string;
  loanAmount: number;
  remainingAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  interestRate: number; // percentage e.g. 14
  status: 'ACTIVE' | 'MATURED' | 'CLOSED';
  loanProduct: string; // e.g. "General Group Loan"
  maturityDate: string;
  closedDate?: string;   // AD YYYY-MM-DD when loan was closed
  closedDateBs?: string; // BS YYYY-MM-DD when loan was closed
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface MFCollectionSheet {
  id: string;
  centerId: string;
  centerName: string;
  groupId: string;
  groupName: string;
  year: string;
  month: string;
  day: string;
  dateDisplay: string;
  status: 'GENERATED' | 'COLLECTED' | 'PENDING';
  totalCompulsorySaving: number;
  totalOptionalSaving: number;
  totalLoanPrincipal: number;
  totalLoanInterest: number;
  totalExpected: number;
  totalCollected: number;
  memberCount: number;
  collectedBy?: string;
  createdAt: string;
}

export interface MFSignatureSheetMember {
  memberId: string;
  name: string;
  role?: string;
  savingsAmount: number;
  loanAmount: number;
  dueAmount?: number;
  microLoanDate?: string;
  microLoanPrincipal?: number;
  microLoanKista?: number;
  microLoanAmount?: number;
  emergencyLoanDate?: string;
  emergencyLoanPrincipal?: number;
  emergencyLoanKista?: number;
  emergencyLoanAmount?: number;
  signature?: string;
}

export interface MFSignatureSheet {
  id: string;
  sheetNo: string;
  centerId: string;
  centerName: string;
  groupId: string;
  groupName: string;
  dateBs: string;
  location: string;
  branchName: string;
  branchAddress: string;
  members: MFSignatureSheetMember[];
  totalMembers: number;
  totalSavings: number;
  totalLoans: number;
  totalDue?: number;
  officerName: string;
  createdAt: string;
}

export interface MFDepositSheetRow {
  memberId: string;
  name: string;
  savingAmount: number;
  loanAmount: number;
  totalAmount: number;
  savedAt?: string;
}

export interface MFDepositSheet {
  id: string;
  sheetNo: string;
  year: string;
  month: string;
  day: string;
  dateBs: string;
  dateDisplay: string;
  centerId: string;
  centerName: string;
  groupId: string;
  groupName: string;
  location: string;
  branchName: string;
  employeeName: string;
  rows: MFDepositSheetRow[];
  totalSaving: number;
  totalLoan: number;
  grandTotal: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MFSettings {
  interestRateDefault: number;
  compulsorySavingDefault: number;
  meetingFrequency: 'Monthly' | 'Bi-Weekly' | 'Weekly';
  penaltyPerDayLate: number;
  loanSchemes: { id: string; name: string; rate: number; maxLimit: number; maxMonths: number }[];
  fieldOfficers: string[];
}

const STORAGE_KEYS = {
  CENTERS: 'ratauli_mf_centers_v1',
  GROUPS: 'ratauli_mf_groups_v1',
  MEMBERS: 'ratauli_mf_members_v1',
  SAVINGS: 'ratauli_mf_savings_v1',
  LOANS: 'ratauli_mf_loans_v1',
  CLOSED_LOANS: 'ratauli_mf_closed_loans_v1',
  SHEETS: 'ratauli_mf_sheets_v1',
  SIGNATURE_SHEETS: 'ratauli_mf_signature_sheets_v1',
  DEPOSIT_SHEETS: 'ratauli_mf_deposit_sheets_v1',
  SETTINGS: 'ratauli_mf_settings_v1',
};

const NEPALI_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const toEnglishDigits = (val: string): string => {
  const np = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(val || '').replace(/[०-९]/g, d => String(np.indexOf(d)));
};

export const normalizeBsDate = (raw?: string): string => {
  if (!raw) return '';
  const cleaned = toEnglishDigits(raw).trim();
  // Match YYYY-M-D or YYYY/M/D
  const slashOrDash = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (slashOrDash) {
    const [, y, m, d] = slashOrDash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Match "2083 Kartik 1"
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 3 && /^\d{4}$/.test(parts[0])) {
    const mIdx = NEPALI_MONTHS_EN.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
    if (mIdx >= 0) {
      const mStr = String(mIdx + 1).padStart(2, '0');
      const dStr = String(parseInt(parts[2], 10) || 1).padStart(2, '0');
      return `${parts[0]}-${mStr}-${dStr}`;
    }
  }
  return cleaned;
};

export const buildBsDateFromParts = (year: string, monthName: string, day: string): string => {
  const y = toEnglishDigits(year || '2083').trim();
  const mIdx = NEPALI_MONTHS_EN.findIndex(m => m.toLowerCase() === (monthName || '').trim().toLowerCase());
  const mNum = mIdx >= 0 ? mIdx + 1 : 1;
  const dNum = parseInt(toEnglishDigits(day || '1'), 10) || 1;
  return `${y}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
};

export const getTodayBsDate = (): string => {
  try {
    const nep = new NepaliDate();
    const y = nep.getYear();
    const m = String(nep.getMonth() + 1).padStart(2, '0');
    const d = String(nep.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '2083-07-25';
  }
};

export const normalizeLoanProductKey = (product?: string): string =>
  String(product || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const normalizeDuplicateMemberId = (val?: string): string =>
  toEnglishDigits(String(val || ''))
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase()
    .replace(/^0+(?=\d)/, '');

export const normalizeCitizenshipKey = (val?: string): string => {
  const cleaned = toEnglishDigits(String(val || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!cleaned || cleaned.length < 4 || /^0+$/.test(cleaned) || cleaned === 'none' || cleaned === 'null') {
    return '';
  }
  return cleaned;
};

export const findDuplicateMember = (
  existingMembers: MFMember[],
  candidate: { memberId?: string; citizenshipNo?: string },
  excludeRecordId?: string
): MFMember | undefined => {
  const memKey = normalizeDuplicateMemberId(candidate.memberId);
  const citKey = normalizeCitizenshipKey(candidate.citizenshipNo);
  if (!memKey && !citKey) return undefined;
  return existingMembers.find(m => {
    if (excludeRecordId && m.id === excludeRecordId) return false;
    if (memKey && normalizeDuplicateMemberId(m.memberId) === memKey) return true;
    if (citKey && normalizeCitizenshipKey(m.citizenshipNo) === citKey) return true;
    return false;
  });
};

export const findUnclosedDuplicateLoan = (
  existingLoans: MFLoanRecord[],
  memberId: string,
  loanProduct: string
): MFLoanRecord | undefined => {
  const memKey = normalizeDuplicateMemberId(memberId);
  const prodKey = normalizeLoanProductKey(loanProduct);
  if (!memKey || !prodKey) return undefined;
  return existingLoans.find(l => {
    if (l.status === 'CLOSED') return false;
    const lMemKey = normalizeDuplicateMemberId(l.memberId);
    const lProdKey = normalizeLoanProductKey(l.loanProduct);
    return lMemKey === memKey && lProdKey === prodKey;
  });
};

export const isSavingStatusClosed = (status?: string): boolean => {
  const raw = String(status || '').toUpperCase();
  return raw === 'CLOSED' || raw === 'INACTIVE' || raw === 'DUE' || raw === 'PENDING';
};

export const normalizeSavingProductKey = (savingTypeOrProduct?: string): string => {
  const raw = String(savingTypeOrProduct || '').trim();
  if (!raw) return '';
  const typeWrapperMatch = raw.match(/^(?:normal saving|recurring saving)\s*\(([^)]+)\)\s*$/i);
  const extracted = typeWrapperMatch ? typeWrapperMatch[1] : raw;
  return extracted
    .replace(/\s*\(\s*\d+(?:\.\d+)?%\s*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

export const findActiveDuplicateSaving = (
  existingSavings: MFSavingsRecord[],
  memberId: string,
  savingTypeOrProduct: string,
  excludeSavingId?: string
): MFSavingsRecord | undefined => {
  const memKey = normalizeDuplicateMemberId(memberId);
  const prodKey = normalizeSavingProductKey(savingTypeOrProduct);
  if (!memKey || !prodKey) return undefined;
  return existingSavings.find(s => {
    if (excludeSavingId && s.id === excludeSavingId) return false;
    if (isSavingStatusClosed(s.status)) return false;
    const sMemKey = normalizeDuplicateMemberId(s.memberId);
    const sProdKey = normalizeSavingProductKey(s.savingType);
    return sMemKey === memKey && sProdKey === prodKey;
  });
};

const DEFAULT_CENTERS: MFCenter[] = [
  {
    id: 'cnt-1',
    code: 'C-001',
    name: 'Center 01 (Janaki Chowk)',
    location: 'Janakpur Ward 4',
    branch: 'Ratauli Central Head Office',
    meetingDay: 'Day 15th',
    status: 'ACTIVE',
    fieldOfficer: 'Ramesh Sharma',
    contactNo: '9845012345',
    createdAt: '2024-01-10'
  },
  {
    id: 'cnt-2',
    code: 'C-002',
    name: 'Center 02 (Shree Ram Chowk)',
    location: 'Ratauli Bazaar',
    branch: 'Ratauli Central Head Office',
    meetingDay: 'Day 20th',
    status: 'ACTIVE',
    fieldOfficer: 'Sita Ram Yadav',
    contactNo: '9845098765',
    createdAt: '2024-02-15'
  },
  {
    id: 'cnt-3',
    code: 'C-003',
    name: 'Center 03 (Mahabir Chowk)',
    location: 'Pipra Ward 2',
    branch: 'Pipra Branch',
    meetingDay: 'Day 10th',
    status: 'ACTIVE',
    fieldOfficer: 'Prakash Mandal',
    contactNo: '9845022334',
    createdAt: '2024-03-01'
  }
];

const DEFAULT_GROUPS: MFSamuhGroup[] = [
  {
    id: 'grp-1',
    code: 'G-001',
    name: 'Laxmi Mahila Samuh',
    centerId: 'cnt-1',
    centerName: 'Center 01 (Janaki Chowk)',
    place: 'Janakpur Ward 4',
    membersCount: 5,
    meetingDay: 'Day 15th',
    status: 'ACTIVE',
    leaderName: 'Sita Devi Chaudhary',
    leaderMobile: '9801234567',
    createdAt: '2024-01-15'
  },
  {
    id: 'grp-2',
    code: 'G-002',
    name: 'Saraswati Mahila Samuh',
    centerId: 'cnt-2',
    centerName: 'Center 02 (Shree Ram Chowk)',
    place: 'Ratauli Bazaar',
    membersCount: 5,
    meetingDay: 'Day 20th',
    status: 'ACTIVE',
    leaderName: 'Sunita Devi Yadav',
    leaderMobile: '9812345678',
    createdAt: '2024-02-20'
  },
  {
    id: 'grp-3',
    code: 'G-003',
    name: 'Radha Krishna Mahila Samuh',
    centerId: 'cnt-1',
    centerName: 'Center 01 (Janaki Chowk)',
    place: 'Janakpur Ward 4',
    membersCount: 4,
    meetingDay: 'Day 15th',
    status: 'ACTIVE',
    leaderName: 'Radha Kumari Sah',
    leaderMobile: '9802233445',
    createdAt: '2024-03-05'
  }
];

const DEFAULT_MEMBERS: MFMember[] = [
  {
    id: 'mem-1',
    memberId: 'M-1001',
    name: 'Sita Devi Chaudhary',
    citizenshipNo: '18-01-75-01234',
    mobile: '9801234567',
    gender: 'Female',
    branch: 'Ratauli Central Head Office',
    centerId: 'cnt-1',
    centerName: 'Center 01 (Janaki Chowk)',
    samuhId: 'grp-1',
    samuhName: 'Laxmi Mahila Samuh',
    role: 'Leader',
    savingsAccountNo: 'SAV-1001',
    address: 'Janakpur Ward 4',
    joinedDate: '2024-01-15',
    status: 'ACTIVE',
    totalSavings: 24500,
    activeLoanAmount: 60000,
    createdAt: '2024-01-15'
  },
  {
    id: 'mem-2',
    memberId: 'M-1002',
    name: 'Geeta Kumari Mandal',
    citizenshipNo: '18-02-76-08912',
    mobile: '9807654321',
    gender: 'Female',
    branch: 'Ratauli Central Head Office',
    centerId: 'cnt-1',
    centerName: 'Center 01 (Janaki Chowk)',
    samuhId: 'grp-1',
    samuhName: 'Laxmi Mahila Samuh',
    role: 'Secretary',
    savingsAccountNo: 'SAV-1002',
    address: 'Janakpur Ward 4',
    joinedDate: '2024-01-15',
    status: 'ACTIVE',
    totalSavings: 18200,
    activeLoanAmount: 40000,
    createdAt: '2024-01-15'
  },
  {
    id: 'mem-3',
    memberId: 'M-1003',
    name: 'Sunita Devi Yadav',
    citizenshipNo: '18-01-72-04567',
    mobile: '9812345678',
    gender: 'Female',
    branch: 'Ratauli Central Head Office',
    centerId: 'cnt-2',
    centerName: 'Center 02 (Shree Ram Chowk)',
    samuhId: 'grp-2',
    samuhName: 'Saraswati Mahila Samuh',
    role: 'Leader',
    savingsAccountNo: 'SAV-1003',
    address: 'Ratauli Bazaar',
    joinedDate: '2024-02-20',
    status: 'ACTIVE',
    totalSavings: 31000,
    activeLoanAmount: 75000,
    createdAt: '2024-02-20'
  },
  {
    id: 'mem-4',
    memberId: 'M-1004',
    name: 'Anita Kumari Sah',
    citizenshipNo: '18-01-79-11223',
    mobile: '9823456789',
    gender: 'Female',
    branch: 'Ratauli Central Head Office',
    centerId: 'cnt-2',
    centerName: 'Center 02 (Shree Ram Chowk)',
    samuhId: 'grp-2',
    samuhName: 'Saraswati Mahila Samuh',
    role: 'Member',
    savingsAccountNo: 'SAV-1004',
    address: 'Ratauli Bazaar',
    joinedDate: '2024-02-20',
    status: 'ACTIVE',
    totalSavings: 14000,
    activeLoanAmount: 30000,
    createdAt: '2024-02-20'
  }
];

const DEFAULT_SAVINGS: MFSavingsRecord[] = [
  {
    id: 'sav-1',
    memberId: 'M-1001',
    accountNo: 'SAV-1001',
    name: 'Sita Devi Chaudhary',
    groupName: 'Laxmi Mahila Samuh',
    centerName: 'Center 01 (Janaki Chowk)',
    date: '2026-10-15',
    dateBs: '2083-06-29',
    amount: 1500,
    savingType: 'Compulsory',
    status: 'ACTIVE',
    collectedBy: 'Ramesh Sharma',
    receiptNo: 'REC-501',
    createdAt: '2026-10-15'
  },
  {
    id: 'sav-2',
    memberId: 'M-1002',
    accountNo: 'SAV-1002',
    name: 'Geeta Kumari Mandal',
    groupName: 'Laxmi Mahila Samuh',
    centerName: 'Center 01 (Janaki Chowk)',
    date: '2026-10-15',
    dateBs: '2083-06-29',
    amount: 1500,
    savingType: 'Compulsory',
    status: 'ACTIVE',
    collectedBy: 'Ramesh Sharma',
    receiptNo: 'REC-502',
    createdAt: '2026-10-15'
  },
  {
    id: 'sav-3',
    memberId: 'M-1003',
    accountNo: 'SAV-1003',
    name: 'Sunita Devi Yadav',
    groupName: 'Saraswati Mahila Samuh',
    centerName: 'Center 02 (Shree Ram Chowk)',
    date: '2026-10-20',
    dateBs: '2083-07-04',
    amount: 2000,
    savingType: 'Compulsory',
    status: 'ACTIVE',
    collectedBy: 'Sita Ram Yadav',
    receiptNo: 'REC-503',
    createdAt: '2026-10-20'
  }
];

const DEFAULT_LOANS: MFLoanRecord[] = [
  {
    id: 'ln-1',
    memberId: 'M-1001',
    accountNo: 'LN-2001',
    name: 'Sita Devi Chaudhary',
    centerName: 'Center 01 (Janaki Chowk)',
    groupName: 'Laxmi Mahila Samuh',
    loanDate: '2026-01-15',
    loanDateBs: '2082-10-01',
    loanAmount: 100000,
    remainingAmount: 60000,
    installmentAmount: 9500,
    totalInstallments: 12,
    paidInstallments: 5,
    interestRate: 14,
    status: 'ACTIVE',
    loanProduct: 'General Group Loan',
    maturityDate: '2027-01-15',
    createdAt: '2026-01-15'
  },
  {
    id: 'ln-2',
    memberId: 'M-1002',
    accountNo: 'LN-2002',
    name: 'Geeta Kumari Mandal',
    centerName: 'Center 01 (Janaki Chowk)',
    groupName: 'Laxmi Mahila Samuh',
    loanDate: '2026-03-10',
    loanDateBs: '2082-11-26',
    loanAmount: 60000,
    remainingAmount: 40000,
    installmentAmount: 5700,
    totalInstallments: 12,
    paidInstallments: 4,
    interestRate: 14,
    status: 'ACTIVE',
    loanProduct: 'Agriculture Micro Loan',
    maturityDate: '2027-03-10',
    createdAt: '2026-03-10'
  },
  {
    id: 'ln-3',
    memberId: 'M-1003',
    accountNo: 'LN-2003',
    name: 'Sunita Devi Yadav',
    centerName: 'Center 02 (Shree Ram Chowk)',
    groupName: 'Saraswati Mahila Samuh',
    loanDate: '2025-05-20',
    loanDateBs: '2082-02-06',
    loanAmount: 80000,
    remainingAmount: 0,
    installmentAmount: 7600,
    totalInstallments: 12,
    paidInstallments: 12,
    interestRate: 14,
    status: 'CLOSED',
    loanProduct: 'Livestock Enterprise Loan',
    maturityDate: '2026-05-20',
    closedDate: '2026-05-20',
    closedDateBs: '2083-02-06',
    createdAt: '2025-05-20'
  }
];

interface SupabaseLoanRow {
  id: string;
  member_id: string;
  account_no: string;
  name: string;
  center_name: string;
  group_name: string;
  loan_date: string;
  loan_date_bs: string;
  loan_amount: number;
  remaining_amount: number;
  installment_amount: number;
  total_installments: number;
  paid_installments: number;
  interest_rate: number;
  status: 'ACTIVE' | 'MATURED' | 'CLOSED';
  loan_product: string;
  maturity_date: string;
  closed_date?: string;
  closed_date_bs?: string;
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
}

const mapLoanToRow = (loan: MFLoanRecord): SupabaseLoanRow => ({
  id: loan.id,
  member_id: loan.memberId,
  account_no: loan.accountNo,
  name: loan.name,
  center_name: loan.centerName || '',
  group_name: loan.groupName || '',
  loan_date: loan.loanDate || '',
  loan_date_bs: normalizeBsDate(loan.loanDateBs || loan.loanDate),
  loan_amount: Number(loan.loanAmount) || 0,
  remaining_amount: Number(loan.remainingAmount) || 0,
  installment_amount: Number(loan.installmentAmount) || 0,
  total_installments: Math.max(1, Math.round(Number(loan.totalInstallments) || 12)),
  paid_installments: Math.max(0, Math.round(Number(loan.paidInstallments) || 0)),
  interest_rate: Number(loan.interestRate) || 14,
  status: loan.status,
  loan_product: loan.loanProduct || '',
  maturity_date: loan.maturityDate || '',
  closed_date: loan.closedDate || '',
  closed_date_bs: normalizeBsDate(loan.closedDateBs || ''),
  created_by: loan.createdBy || '',
  created_by_name: loan.createdByName || '',
  created_at: loan.createdAt ? (loan.createdAt.includes('T') ? loan.createdAt : `${loan.createdAt}T00:00:00.000Z`) : new Date().toISOString()
});

const mapRowToLoan = (row: SupabaseLoanRow): MFLoanRecord => ({
  id: row.id,
  memberId: row.member_id,
  accountNo: row.account_no,
  name: row.name,
  centerName: row.center_name || '',
  groupName: row.group_name || '',
  loanDate: row.loan_date || '',
  loanDateBs: row.loan_date_bs || row.loan_date || '',
  loanAmount: Number(row.loan_amount) || 0,
  remainingAmount: Number(row.remaining_amount) || 0,
  installmentAmount: Number(row.installment_amount) || 0,
  totalInstallments: Number(row.total_installments) || 12,
  paidInstallments: Number(row.paid_installments) || 0,
  interestRate: Number(row.interest_rate) || 14,
  status: (row.status as 'ACTIVE' | 'MATURED' | 'CLOSED') || 'ACTIVE',
  loanProduct: row.loan_product || '',
  maturityDate: row.maturity_date || '',
  closedDate: row.closed_date || '',
  closedDateBs: row.closed_date_bs || '',
  createdBy: row.created_by || undefined,
  createdByName: row.created_by_name || undefined,
  createdAt: row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0]
});

const mapCenterToRow = (c: MFCenter) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  location: c.location || '',
  branch: c.branch || '',
  meeting_day: c.meetingDay || '',
  status: c.status || 'ACTIVE',
  field_officer: c.fieldOfficer || '',
  contact_no: c.contactNo || '',
  created_at: c.createdAt || new Date().toISOString().split('T')[0],
  updated_at: new Date().toISOString()
});

const mapRowToCenter = (r: Record<string, unknown>): MFCenter => ({
  id: String(r.id),
  code: String(r.code || ''),
  name: String(r.name || ''),
  location: String(r.location || ''),
  branch: String(r.branch || ''),
  meetingDay: String(r.meeting_day || ''),
  status: r.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  fieldOfficer: r.field_officer ? String(r.field_officer) : undefined,
  contactNo: r.contact_no ? String(r.contact_no) : undefined,
  createdAt: String(r.created_at || '')
});

const mapGroupToRow = (g: MFSamuhGroup) => ({
  id: g.id,
  code: g.code,
  name: g.name,
  center_id: g.centerId,
  center_name: g.centerName || '',
  place: g.place || '',
  members_count: Math.max(0, Math.round(Number(g.membersCount) || 0)),
  meeting_day: g.meetingDay || '',
  status: g.status || 'ACTIVE',
  leader_name: g.leaderName || '',
  leader_mobile: g.leaderMobile || '',
  created_at: g.createdAt || new Date().toISOString().split('T')[0],
  updated_at: new Date().toISOString()
});

const mapRowToGroup = (r: Record<string, unknown>): MFSamuhGroup => ({
  id: String(r.id),
  code: String(r.code || ''),
  name: String(r.name || ''),
  centerId: String(r.center_id || ''),
  centerName: String(r.center_name || ''),
  place: String(r.place || ''),
  membersCount: Number(r.members_count) || 0,
  meetingDay: String(r.meeting_day || ''),
  status: r.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  leaderName: r.leader_name ? String(r.leader_name) : undefined,
  leaderMobile: r.leader_mobile ? String(r.leader_mobile) : undefined,
  createdAt: String(r.created_at || '')
});

const mapMemberToRow = (m: MFMember) => ({
  id: m.id,
  member_id: m.memberId,
  name: m.name,
  citizenship_no: m.citizenshipNo || '',
  mobile: m.mobile || '',
  gender: m.gender || 'Female',
  branch: m.branch || '',
  center_id: m.centerId || '',
  center_name: m.centerName || '',
  samuh_id: m.samuhId || '',
  samuh_name: m.samuhName || '',
  role: m.role || 'Member',
  savings_account_no: m.savingsAccountNo || '',
  address: m.address || '',
  joined_date: m.joinedDate || '',
  status: m.status || 'ACTIVE',
  total_savings: Number(m.totalSavings) || 0,
  active_loan_amount: Number(m.activeLoanAmount) || 0,
  photo_url: m.photoUrl || null,
  created_at: m.createdAt || new Date().toISOString().split('T')[0],
  updated_at: new Date().toISOString()
});

const mapRowToMember = (r: Record<string, unknown>): MFMember => ({
  id: String(r.id),
  memberId: String(r.member_id || ''),
  name: String(r.name || ''),
  citizenshipNo: String(r.citizenship_no || ''),
  mobile: String(r.mobile || ''),
  gender: (r.gender === 'Male' || r.gender === 'Other' ? r.gender : 'Female'),
  branch: String(r.branch || ''),
  centerId: String(r.center_id || ''),
  centerName: String(r.center_name || ''),
  samuhId: String(r.samuh_id || ''),
  samuhName: String(r.samuh_name || ''),
  role: (['Leader', 'Secretary', 'Treasurer', 'Member'].includes(String(r.role)) ? String(r.role) : 'Member') as MFMember['role'],
  savingsAccountNo: String(r.savings_account_no || ''),
  address: String(r.address || ''),
  joinedDate: String(r.joined_date || ''),
  status: r.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  totalSavings: Number(r.total_savings) || 0,
  activeLoanAmount: Number(r.active_loan_amount) || 0,
  photoUrl: r.photo_url ? String(r.photo_url) : undefined,
  createdAt: String(r.created_at || '')
});

const mapSavingToRow = (s: MFSavingsRecord) => ({
  id: s.id,
  member_id: s.memberId,
  account_no: s.accountNo,
  name: s.name,
  group_name: s.groupName || '',
  center_name: s.centerName || '',
  date: s.date || '',
  date_bs: s.dateBs || '',
  amount: Number(s.amount) || 0,
  saving_type: s.savingType || 'Compulsory',
  status: s.status || 'ACTIVE',
  collected_by: s.collectedBy || '',
  created_by: s.createdBy || null,
  created_by_name: s.createdByName || null,
  receipt_no: s.receiptNo || '',
  remarks: s.remarks || '',
  created_at: s.createdAt || new Date().toISOString().split('T')[0],
  updated_at: new Date().toISOString()
});

const mapRowToSaving = (r: Record<string, unknown>): MFSavingsRecord => ({
  id: String(r.id),
  memberId: String(r.member_id || ''),
  accountNo: String(r.account_no || ''),
  name: String(r.name || ''),
  groupName: String(r.group_name || ''),
  centerName: String(r.center_name || ''),
  date: String(r.date || ''),
  dateBs: r.date_bs ? String(r.date_bs) : undefined,
  amount: Number(r.amount) || 0,
  savingType: String(r.saving_type || 'Compulsory'),
  status: ((): MFSavingsRecord['status'] => {
    const raw = String(r.status || '').toUpperCase();
    if (raw === 'CLOSED' || raw === 'INACTIVE' || raw === 'DUE' || raw === 'PENDING') return 'CLOSED';
    return 'ACTIVE';
  })(),
  collectedBy: r.collected_by ? String(r.collected_by) : undefined,
  createdBy: r.created_by ? String(r.created_by) : undefined,
  createdByName: r.created_by_name ? String(r.created_by_name) : undefined,
  receiptNo: r.receipt_no ? String(r.receipt_no) : undefined,
  remarks: r.remarks ? String(r.remarks) : undefined,
  createdAt: String(r.created_at || '')
});

const mapSheetToRow = (s: MFCollectionSheet) => ({
  id: s.id,
  center_id: s.centerId,
  center_name: s.centerName || '',
  group_id: s.groupId,
  group_name: s.groupName || '',
  year: s.year || '',
  month: s.month || '',
  day: s.day || '',
  date_display: s.dateDisplay || '',
  status: s.status || 'GENERATED',
  total_compulsory_saving: Number(s.totalCompulsorySaving) || 0,
  total_optional_saving: Number(s.totalOptionalSaving) || 0,
  total_loan_principal: Number(s.totalLoanPrincipal) || 0,
  total_loan_interest: Number(s.totalLoanInterest) || 0,
  total_expected: Number(s.totalExpected) || 0,
  total_collected: Number(s.totalCollected) || 0,
  member_count: Math.max(0, Math.round(Number(s.memberCount) || 0)),
  collected_by: s.collectedBy || '',
  created_at: s.createdAt || new Date().toISOString().split('T')[0],
  updated_at: new Date().toISOString()
});

const parseSigMembers = (val: unknown): MFSignatureSheetMember[] => {
  if (Array.isArray(val)) return val as MFSignatureSheetMember[];
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as MFSignatureSheetMember[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapRowToSheet = (r: Record<string, unknown>): MFCollectionSheet => {
  const year = String(r.year || '');
  const month = String(r.month || '');
  const day = String(r.day || '');
  const rawDisplay = String(r.date_display || '').trim();
  const dateDisplay = rawDisplay || [year, month, day].filter(Boolean).join(' ');
  const rawStatus = String(r.status || 'GENERATED').toUpperCase();
  const status = (['GENERATED', 'COLLECTED', 'PENDING'].includes(rawStatus) ? rawStatus : 'GENERATED') as MFCollectionSheet['status'];
  return {
    id: String(r.id),
    centerId: String(r.center_id || ''),
    centerName: String(r.center_name || ''),
    groupId: String(r.group_id || ''),
    groupName: String(r.group_name || ''),
    year,
    month,
    day,
    dateDisplay,
    status,
    totalCompulsorySaving: Number(r.total_compulsory_saving) || 0,
    totalOptionalSaving: Number(r.total_optional_saving) || 0,
    totalLoanPrincipal: Number(r.total_loan_principal) || 0,
    totalLoanInterest: Number(r.total_loan_interest) || 0,
    totalExpected: Number(r.total_expected) || 0,
    totalCollected: Number(r.total_collected) || 0,
    memberCount: Number(r.member_count) || 0,
    collectedBy: r.collected_by ? String(r.collected_by) : undefined,
    createdAt: String(r.created_at || '')
  };
};

const mapSigSheetToRow = (s: MFSignatureSheet) => ({
  id: s.id,
  sheet_no: s.sheetNo,
  center_id: s.centerId,
  center_name: s.centerName || '',
  group_id: s.groupId,
  group_name: s.groupName || '',
  date_bs: s.dateBs || '',
  location: s.location || '',
  branch_name: s.branchName || '',
  branch_address: s.branchAddress || '',
  members: Array.isArray(s.members) ? s.members : [],
  total_members: Math.max(0, Math.round(Number(s.totalMembers) || 0)),
  total_savings: Number(s.totalSavings) || 0,
  total_loans: Number(s.totalLoans) || 0,
  total_due: Number(s.totalDue) || 0,
  officer_name: s.officerName || '',
  created_at: s.createdAt || new Date().toISOString().split('T')[0],
  updated_at: new Date().toISOString()
});

const mapRowToSigSheet = (r: Record<string, unknown>): MFSignatureSheet => ({
  id: String(r.id),
  sheetNo: String(r.sheet_no || ''),
  centerId: String(r.center_id || ''),
  centerName: String(r.center_name || ''),
  groupId: String(r.group_id || ''),
  groupName: String(r.group_name || ''),
  dateBs: String(r.date_bs || ''),
  location: String(r.location || ''),
  branchName: String(r.branch_name || ''),
  branchAddress: String(r.branch_address || ''),
  members: parseSigMembers(r.members),
  totalMembers: Number(r.total_members) || 0,
  totalSavings: Number(r.total_savings) || 0,
  totalLoans: Number(r.total_loans) || 0,
  totalDue: r.total_due !== undefined && r.total_due !== null ? Number(r.total_due) : undefined,
  officerName: String(r.officer_name || ''),
  createdAt: String(r.created_at || '')
});

const safeSetLocalStorage = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`localStorage write skipped for ${key}:`, err);
  }
};

const bgUpsert = async (table: string, rows: Record<string, unknown>[]): Promise<void> => {
  if (!supabase || rows.length === 0) return;
  const CHUNK_SIZE = 500;
  try {
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) console.warn(`Supabase ${table} upsert warning:`, error.message);
    }
  } catch (err) {
    console.warn(`Supabase ${table} upsert failed:`, err);
  }
};

const fetchAllRowsPaginated = async (
  table: string,
  options?: {
    orderColumn?: string;
    filter?: { column: string; op: 'eq' | 'neq'; value: string };
  }
): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> => {
  if (!supabase) return { data: null, error: null };
  const PAGE_SIZE = 1000;
  const orderCol = options?.orderColumn || 'created_at';

  const runPaged = async (useOrderCol: boolean): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> => {
    const allRows: Record<string, unknown>[] = [];
    const seenIds = new Set<string>();
    let from = 0;

    while (from < 50000) {
      let query = supabase.from(table).select('*');
      if (options?.filter) {
        if (options.filter.op === 'eq') {
          query = query.eq(options.filter.column, options.filter.value);
        } else {
          query = query.neq(options.filter.column, options.filter.value);
        }
      }
      if (useOrderCol) {
        query = query.order(orderCol, { ascending: false }).order('id', { ascending: false });
      } else {
        query = query.order('id', { ascending: false });
      }

      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) return { data: null, error };
      const page = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      page.forEach(row => {
        const rowId = row?.id !== undefined && row?.id !== null ? String(row.id) : '';
        if (rowId) {
          if (!seenIds.has(rowId)) {
            seenIds.add(rowId);
            allRows.push(row);
          }
        } else {
          allRows.push(row);
        }
      });

      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return { data: allRows, error: null };
  };

  const primary = await runPaged(true);
  if (!primary.error) return primary;
  console.warn(`Supabase ${table} ordered paginated select failed, retrying by id:`, primary.error.message);
  return await runPaged(false);
};

const bgDelete = async (table: string, id: string): Promise<void> => {
  if (!supabase || !id) return;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) console.warn(`Supabase ${table} delete warning:`, error.message);
  } catch (err) {
    console.warn(`Supabase ${table} delete failed:`, err);
  }
};

const getClosedLoansLocalRaw = (): MFLoanRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLOSED_LOANS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  const defaultClosed = DEFAULT_LOANS.filter(l => l.status === 'CLOSED');
  localStorage.setItem(STORAGE_KEYS.CLOSED_LOANS, JSON.stringify(defaultClosed));
  return defaultClosed;
};

const saveClosedLoansLocalRaw = (closedLoans: MFLoanRecord[]): void => {
  localStorage.setItem(STORAGE_KEYS.CLOSED_LOANS, JSON.stringify(closedLoans));
};

const mergeClosedLoanArchive = (loan: MFLoanRecord): MFLoanRecord[] => {
  const existing = getClosedLoansLocalRaw();
  const filtered = existing.filter(l => l.id !== loan.id);
  const next = [loan, ...filtered];
  saveClosedLoansLocalRaw(next);
  return next;
};

// Legacy default sheet IDs removed — reports rely strictly on real user/Supabase data.
const LEGACY_DEFAULT_SHEET_IDS = new Set(['cs-1', 'cs-2', 'cs-3']);
const LEGACY_DEFAULT_SIG_SHEET_IDS = new Set(['sig-1', 'sig-2']);

const DEFAULT_SETTINGS: MFSettings = {
  interestRateDefault: 14,
  compulsorySavingDefault: 500,
  meetingFrequency: 'Monthly',
  penaltyPerDayLate: 25,
  loanSchemes: [
    { id: 'sch-1', name: 'General Group Loan', rate: 14, maxLimit: 150000, maxMonths: 24 },
    { id: 'sch-2', name: 'Agriculture Micro Loan', rate: 12, maxLimit: 200000, maxMonths: 24 },
    { id: 'sch-3', name: 'Livestock Enterprise Loan', rate: 13, maxLimit: 120000, maxMonths: 18 },
    { id: 'sch-4', name: 'Emergency Family Loan', rate: 10, maxLimit: 50000, maxMonths: 12 }
  ],
  fieldOfficers: ['Ramesh Sharma', 'Sita Ram Yadav', 'Prakash Mandal', 'Binita Kumari']
};

export const microFinanceService = {
  // Centers
  getCenters: (): MFCenter[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CENTERS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(STORAGE_KEYS.CENTERS, JSON.stringify(DEFAULT_CENTERS));
    return DEFAULT_CENTERS;
  },

  saveCenters: (centers: MFCenter[]): void => {
    localStorage.setItem(STORAGE_KEYS.CENTERS, JSON.stringify(centers));
    void bgUpsert('mf_centers', centers.map(mapCenterToRow));
  },

  addCenter: (center: Omit<MFCenter, 'id' | 'createdAt'>): MFCenter => {
    assertDayNotEnded(center.branch);
    const centers = microFinanceService.getCenters();
    const newCenter: MFCenter = {
      ...center,
      id: 'cnt-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newCenter, ...centers];
    localStorage.setItem(STORAGE_KEYS.CENTERS, JSON.stringify(updated));
    void bgUpsert('mf_centers', [mapCenterToRow(newCenter)]);
    return newCenter;
  },

  updateCenter: (id: string, updates: Partial<MFCenter>): MFCenter[] => {
    assertDayNotEnded(updates.branch);
    let updatedItem: MFCenter | null = null;
    const centers = microFinanceService.getCenters().map(c => {
      if (c.id === id) {
        updatedItem = { ...c, ...updates };
        return updatedItem;
      }
      return c;
    });
    localStorage.setItem(STORAGE_KEYS.CENTERS, JSON.stringify(centers));
    if (updatedItem) void bgUpsert('mf_centers', [mapCenterToRow(updatedItem)]);
    return centers;
  },

  deleteCenter: (id: string): MFCenter[] => {
    assertDayNotEnded();
    const centers = microFinanceService.getCenters().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CENTERS, JSON.stringify(centers));
    void bgDelete('mf_centers', id);
    return centers;
  },

  // Groups
  getGroups: (): MFSamuhGroup[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GROUPS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(DEFAULT_GROUPS));
    return DEFAULT_GROUPS;
  },

  saveGroups: (groups: MFSamuhGroup[]): void => {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    void bgUpsert('mf_groups', groups.map(mapGroupToRow));
  },

  addGroup: (group: Omit<MFSamuhGroup, 'id' | 'createdAt'>): MFSamuhGroup => {
    assertDayNotEnded();
    const groups = microFinanceService.getGroups();
    const newGroup: MFSamuhGroup = {
      ...group,
      id: 'grp-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newGroup, ...groups];
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(updated));
    void bgUpsert('mf_groups', [mapGroupToRow(newGroup)]);
    return newGroup;
  },

  updateGroup: (id: string, updates: Partial<MFSamuhGroup>): MFSamuhGroup[] => {
    assertDayNotEnded();
    let updatedItem: MFSamuhGroup | null = null;
    const groups = microFinanceService.getGroups().map(g => {
      if (g.id === id) {
        updatedItem = { ...g, ...updates };
        return updatedItem;
      }
      return g;
    });
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    if (updatedItem) void bgUpsert('mf_groups', [mapGroupToRow(updatedItem)]);
    return groups;
  },

  deleteGroup: (id: string): MFSamuhGroup[] => {
    assertDayNotEnded();
    const groups = microFinanceService.getGroups().filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    void bgDelete('mf_groups', id);
    return groups;
  },

  // Members
  getMembers: (): MFMember[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(DEFAULT_MEMBERS));
    return DEFAULT_MEMBERS;
  },

  saveMembers: (members: MFMember[]): void => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    void bgUpsert('mf_members', members.map(mapMemberToRow));
  },

  addMember: (member: Omit<MFMember, 'id' | 'createdAt'>): MFMember => {
    assertDayNotEnded(member.branch);
    const members = microFinanceService.getMembers();
    if (findDuplicateMember(members, { memberId: member.memberId, citizenshipNo: member.citizenshipNo })) {
      throw new Error('This member is already registered in the system.');
    }
    const newMember: MFMember = {
      ...member,
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newMember, ...members];
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(updated));
    void bgUpsert('mf_members', [mapMemberToRow(newMember)]);
    // Also update member count in group
    if (newMember.samuhId) {
      const groups = microFinanceService.getGroups();
      let changedGroup: MFSamuhGroup | null = null;
      const updatedGroups = groups.map(g => {
        if (g.id === newMember.samuhId) {
          changedGroup = { ...g, membersCount: g.membersCount + 1 };
          return changedGroup;
        }
        return g;
      });
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(updatedGroups));
      if (changedGroup) void bgUpsert('mf_groups', [mapGroupToRow(changedGroup)]);
    }
    return newMember;
  },

  updateMember: (id: string, updates: Partial<MFMember>): MFMember[] => {
    assertDayNotEnded(updates.branch);
    const existing = microFinanceService.getMembers();
    const target = existing.find(m => m.id === id);
    if (target) {
      const nextMemberId = updates.memberId !== undefined ? updates.memberId : target.memberId;
      const nextCitizenshipNo = updates.citizenshipNo !== undefined ? updates.citizenshipNo : target.citizenshipNo;
      if (findDuplicateMember(existing, { memberId: nextMemberId, citizenshipNo: nextCitizenshipNo }, id)) {
        throw new Error('This member is already registered in the system.');
      }
    }
    let updatedItem: MFMember | null = null;
    const members = existing.map(m => {
      if (m.id === id) {
        updatedItem = { ...m, ...updates };
        return updatedItem;
      }
      return m;
    });
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    if (updatedItem) void bgUpsert('mf_members', [mapMemberToRow(updatedItem)]);
    return members;
  },

  deleteMember: (id: string): MFMember[] => {
    assertDayNotEnded();
    const members = microFinanceService.getMembers();
    const target = members.find(m => m.id === id);
    const updated = members.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(updated));
    void bgDelete('mf_members', id);
    if (target?.samuhId) {
      const groups = microFinanceService.getGroups();
      let changedGroup: MFSamuhGroup | null = null;
      const updatedGroups = groups.map(g => {
        if (g.id === target.samuhId) {
          changedGroup = { ...g, membersCount: Math.max(0, g.membersCount - 1) };
          return changedGroup;
        }
        return g;
      });
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(updatedGroups));
      if (changedGroup) void bgUpsert('mf_groups', [mapGroupToRow(changedGroup)]);
    }
    return updated;
  },

  // Savings
  getSavings: (): MFSavingsRecord[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVINGS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.map((s: MFSavingsRecord, idx: number) => {
            const rawStatus = String(s.status || '').toUpperCase();
            return {
              ...s,
              status: (rawStatus === 'CLOSED' || rawStatus === 'INACTIVE' || rawStatus === 'DUE' || rawStatus === 'PENDING') ? 'CLOSED' : 'ACTIVE',
              dateBs: s.dateBs || (s.date && /^20[5-9]\d-/.test(normalizeBsDate(s.date)) ? normalizeBsDate(s.date) : (DEFAULT_SAVINGS[idx]?.dateBs || '2083-06-29'))
            };
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(STORAGE_KEYS.SAVINGS, JSON.stringify(DEFAULT_SAVINGS));
    return DEFAULT_SAVINGS;
  },

  saveSavings: (savings: MFSavingsRecord[]): void => {
    localStorage.setItem(STORAGE_KEYS.SAVINGS, JSON.stringify(savings));
    void bgUpsert('mf_savings', savings.map(mapSavingToRow));
  },

  addSaving: (saving: Omit<MFSavingsRecord, 'id' | 'createdAt'>): MFSavingsRecord => {
    assertDayNotEnded();
    const savings = microFinanceService.getSavings();
    if (!isSavingStatusClosed(saving.status)) {
      const conflict = findActiveDuplicateSaving(savings, saving.memberId, saving.savingType);
      if (conflict) {
        throw new Error(
          `Cannot open saving account: Member (${saving.name} • ${saving.memberId}) already has an ACTIVE account (${conflict.accountNo}) under "${conflict.savingType}". Please close the existing account first before opening a new one in the same product.`
        );
      }
    }
    const newSaving: MFSavingsRecord = {
      ...saving,
      id: `sav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newSaving, ...savings];
    localStorage.setItem(STORAGE_KEYS.SAVINGS, JSON.stringify(updated));
    void bgUpsert('mf_savings', [mapSavingToRow(newSaving)]);
    // Also update member's total savings
    const members = microFinanceService.getMembers();
    let changedMember: MFMember | null = null;
    const updatedMembers = members.map(m => {
      if (m.memberId === newSaving.memberId) {
        changedMember = { ...m, totalSavings: m.totalSavings + newSaving.amount };
        return changedMember;
      }
      return m;
    });
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(updatedMembers));
    if (changedMember) void bgUpsert('mf_members', [mapMemberToRow(changedMember)]);
    return newSaving;
  },

  updateSaving: (id: string, updates: Partial<MFSavingsRecord>): MFSavingsRecord[] => {
    assertDayNotEnded();
    const existingList = microFinanceService.getSavings();
    const oldItem = existingList.find(s => s.id === id) || null;
    let updatedItem: MFSavingsRecord | null = null;

    const savings = existingList.map(s => {
      if (s.id === id) {
        const nextStatusRaw = String(updates.status ?? s.status ?? 'ACTIVE').toUpperCase();
        const normalizedStatus: 'ACTIVE' | 'CLOSED' =
          nextStatusRaw === 'CLOSED' || nextStatusRaw === 'INACTIVE' || nextStatusRaw === 'DUE' || nextStatusRaw === 'PENDING'
            ? 'CLOSED'
            : 'ACTIVE';
        const nextDateBs = normalizeBsDate(updates.dateBs ?? s.dateBs ?? s.date);
        updatedItem = {
          ...s,
          ...updates,
          status: normalizedStatus,
          dateBs: nextDateBs,
          amount: updates.amount !== undefined ? Number(updates.amount) || 0 : s.amount
        };
        return updatedItem;
      }
      return s;
    });

    localStorage.setItem(STORAGE_KEYS.SAVINGS, JSON.stringify(savings));
    if (updatedItem) {
      void bgUpsert('mf_savings', [mapSavingToRow(updatedItem)]);

      // Adjust member totalSavings if amount, status, or memberId changed
      if (oldItem) {
        const oldRaw = String(oldItem.status || '').toUpperCase();
        const wasActive = oldRaw !== 'CLOSED' && oldRaw !== 'INACTIVE' && oldRaw !== 'DUE' && oldRaw !== 'PENDING';
        const isNowActive = updatedItem.status === 'ACTIVE';
        const oldDelta = wasActive ? Number(oldItem.amount) || 0 : 0;
        const newDelta = isNowActive ? Number(updatedItem.amount) || 0 : 0;

        if (oldItem.memberId !== updatedItem.memberId || oldDelta !== newDelta) {
          const changedMembers: MFMember[] = [];
          const members = microFinanceService.getMembers().map(m => {
            let nextTotal = Number(m.totalSavings) || 0;
            let changed = false;
            if (m.memberId === oldItem.memberId && oldDelta !== 0) {
              nextTotal = Math.max(0, nextTotal - oldDelta);
              changed = true;
            }
            if (m.memberId === updatedItem!.memberId && newDelta !== 0) {
              nextTotal += newDelta;
              changed = true;
            }
            if (changed) {
              const updatedMember = { ...m, totalSavings: nextTotal };
              changedMembers.push(updatedMember);
              return updatedMember;
            }
            return m;
          });
          if (changedMembers.length > 0) {
            localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
            void bgUpsert('mf_members', changedMembers.map(mapMemberToRow));
          }
        }
      }
    }
    return savings;
  },

  deleteSaving: (id: string): MFSavingsRecord[] => {
    assertDayNotEnded();
    const savings = microFinanceService.getSavings().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SAVINGS, JSON.stringify(savings));
    void bgDelete('mf_savings', id);
    return savings;
  },

  // Loans (Active & Matured in main state; CLOSED archived in Supabase + CLOSED_LOANS)
  getLoans: (): MFLoanRecord[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOANS);
      if (data) {
        const parsed: MFLoanRecord[] = JSON.parse(data);
        if (Array.isArray(parsed)) {
          // Separate any CLOSED loans so main active table never carries closed rows
          const closedInMain = parsed.filter(l => l.status === 'CLOSED');
          if (closedInMain.length > 0) {
            closedInMain.forEach(cl => {
              mergeClosedLoanArchive({
                ...cl,
                closedDate: cl.closedDate || cl.maturityDate || new Date().toISOString().split('T')[0],
                closedDateBs: normalizeBsDate(cl.closedDateBs || cl.maturityDate || getTodayBsDate())
              });
            });
            const activeOnly = parsed.filter(l => l.status !== 'CLOSED');
            localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(activeOnly));
            return activeOnly;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    const defaultActive = DEFAULT_LOANS.filter(l => l.status !== 'CLOSED');
    getClosedLoansLocalRaw();
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(defaultActive));
    return defaultActive;
  },

  saveLoans: (loans: MFLoanRecord[]): void => {
    const activeOnly = loans.filter(l => l.status !== 'CLOSED');
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(activeOnly));
  },

  upsertLoanToSupabase: async (loan: MFLoanRecord): Promise<void> => {
    try {
      const row = mapLoanToRow(loan);
      const { error } = await supabase.from('mf_loans').upsert(row, { onConflict: 'id' });
      if (!error) return;

      // Fallback if mf_loans SQL migration hasn't been executed yet: keep both stores in sync
      const activeLoans = microFinanceService.getLoans();
      const closedLoans = getClosedLoansLocalRaw();
      await Promise.all([
        supabase.from('daily_data').upsert({
          id: 'MF_ACTIVE_LOANS_STORE',
          data: { loans: activeLoans, updatedAt: Date.now() }
        }),
        supabase.from('daily_data').upsert({
          id: 'MF_CLOSED_LOANS_ARCHIVE',
          data: { loans: closedLoans, updatedAt: Date.now() }
        })
      ]);
    } catch (e) {
      console.warn('Supabase loan upsert skipped (offline/local fallback active):', e);
    }
  },

  deleteLoanFromSupabase: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('mf_loans').delete().eq('id', id);
      if (!error) return;
      await supabase.from('daily_data').upsert({
        id: 'MF_ACTIVE_LOANS_STORE',
        data: { loans: microFinanceService.getLoans(), updatedAt: Date.now() }
      });
    } catch (e) {
      console.warn('Supabase loan delete skipped:', e);
    }
  },

  // Fetch ONLY ACTIVE & MATURED loans from Supabase (excludes CLOSED to keep data load light)
  fetchActiveLoansFromSupabase: async (): Promise<MFLoanRecord[]> => {
    const localActive = microFinanceService.getLoans();
    try {
      const { data, error } = await fetchAllRowsPaginated('mf_loans', {
        orderColumn: 'created_at',
        filter: { column: 'status', op: 'neq', value: 'CLOSED' }
      });

      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          const mapped = data.map(r => mapRowToLoan(r as unknown as SupabaseLoanRow)).filter(l => l.status !== 'CLOSED');
          safeSetLocalStorage(STORAGE_KEYS.LOANS, mapped);
          return mapped;
        }
        // Check if table is completely empty (initial seed)
        const { count } = await supabase.from('mf_loans').select('id', { count: 'exact', head: true });
        if (count === 0) {
          const allSeed = [...localActive, ...getClosedLoansLocalRaw()];
          if (allSeed.length > 0) {
            await supabase.from('mf_loans').upsert(allSeed.map(mapLoanToRow), { onConflict: 'id' });
          }
        }
        return localActive;
      }

      // Fallback store if mf_loans table does not exist yet
      const { data: fallbackRow } = await supabase
        .from('daily_data')
        .select('data')
        .eq('id', 'MF_ACTIVE_LOANS_STORE')
        .maybeSingle();

      if (fallbackRow?.data?.loans && Array.isArray(fallbackRow.data.loans)) {
        const remoteActive = (fallbackRow.data.loans as MFLoanRecord[]).filter(l => l.status !== 'CLOSED');
        safeSetLocalStorage(STORAGE_KEYS.LOANS, remoteActive);
        return remoteActive;
      }
    } catch (e) {
      console.warn('Failed to fetch active loans from Supabase, using local cache:', e);
    }
    return localActive;
  },

  // On-demand fetch of CLOSED loans from Supabase (ONLY called when user explicitly opens the Close tab)
  fetchClosedLoansFromSupabase: async (): Promise<MFLoanRecord[]> => {
    const localClosed = getClosedLoansLocalRaw();
    try {
      const { data, error } = await fetchAllRowsPaginated('mf_loans', {
        orderColumn: 'closed_date_bs',
        filter: { column: 'status', op: 'eq', value: 'CLOSED' }
      });

      if (!error && Array.isArray(data)) {
        const mapped = data.map(r => mapRowToLoan(r as unknown as SupabaseLoanRow));
        const map = new Map<string, MFLoanRecord>();
        localClosed.forEach(l => map.set(l.id, l));
        mapped.forEach(l => map.set(l.id, l));
        const merged = Array.from(map.values());
        saveClosedLoansLocalRaw(merged);
        return merged;
      }

      const { data: fallbackRow } = await supabase
        .from('daily_data')
        .select('data')
        .eq('id', 'MF_CLOSED_LOANS_ARCHIVE')
        .maybeSingle();

      if (fallbackRow?.data?.loans && Array.isArray(fallbackRow.data.loans)) {
        const remoteClosed = fallbackRow.data.loans as MFLoanRecord[];
        const map = new Map<string, MFLoanRecord>();
        localClosed.forEach(l => map.set(l.id, l));
        remoteClosed.forEach(l => map.set(l.id, l));
        const merged = Array.from(map.values());
        saveClosedLoansLocalRaw(merged);
        return merged;
      }
    } catch (e) {
      console.warn('Failed to fetch closed loans from Supabase, using local archive:', e);
    }
    return localClosed;
  },

  addLoan: (loan: Omit<MFLoanRecord, 'id' | 'createdAt'>): MFLoanRecord => {
    assertDayNotEnded();
    const loans = microFinanceService.getLoans();
    const conflict = findUnclosedDuplicateLoan(loans, loan.memberId, loan.loanProduct);
    if (conflict) {
      throw new Error(
        `Cannot issue loan: Member (${loan.name} • ${loan.memberId}) already has an unclosed ${conflict.status} loan (${conflict.accountNo}) under "${conflict.loanProduct}". Please close the existing loan first.`
      );
    }
    const newLoan: MFLoanRecord = {
      ...loan,
      id: 'ln-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newLoan, ...loans];
    microFinanceService.saveLoans(updated);
    // update member loan amount
    const members = microFinanceService.getMembers();
    const updatedMembers = members.map(m => m.memberId === newLoan.memberId ? { ...m, activeLoanAmount: m.activeLoanAmount + newLoan.remainingAmount } : m);
    microFinanceService.saveMembers(updatedMembers);
    void microFinanceService.upsertLoanToSupabase(newLoan);
    return newLoan;
  },

  updateLoan: (id: string, updates: Partial<MFLoanRecord>): MFLoanRecord[] => {
    assertDayNotEnded();
    if (updates.status === 'CLOSED') {
      const closedDateBs = normalizeBsDate(updates.closedDateBs || getTodayBsDate());
      const closedDate = updates.closedDate || new Date().toISOString().split('T')[0];
      const current = microFinanceService.getLoans().find(l => l.id === id);
      if (current) {
        const closedLoan: MFLoanRecord = {
          ...current,
          ...updates,
          status: 'CLOSED',
          remainingAmount: 0,
          closedDate,
          closedDateBs
        };
        mergeClosedLoanArchive(closedLoan);
        const remainingActive = microFinanceService.getLoans().filter(l => l.id !== id);
        microFinanceService.saveLoans(remainingActive);
        const members = microFinanceService.getMembers();
        const updatedMembers = members.map(m =>
          m.memberId === current.memberId
            ? { ...m, activeLoanAmount: Math.max(0, (m.activeLoanAmount || 0) - (current.remainingAmount || 0)) }
            : m
        );
        microFinanceService.saveMembers(updatedMembers);
        void microFinanceService.upsertLoanToSupabase(closedLoan);
        return remainingActive;
      }
    }

    let updatedLoanObj: MFLoanRecord | null = null;
    const loans = microFinanceService.getLoans().map(l => {
      if (l.id === id) {
        updatedLoanObj = { ...l, ...updates };
        return updatedLoanObj;
      }
      return l;
    });
    microFinanceService.saveLoans(loans);
    if (updatedLoanObj) {
      void microFinanceService.upsertLoanToSupabase(updatedLoanObj);
    }
    return loans;
  },

  // Close loan after maturity: keeps data permanently in Supabase + archive, removes from active Loan table list
  closeLoan: async (id: string, closedDateBs?: string, closedDateAd?: string): Promise<MFLoanRecord[]> => {
    assertDayNotEnded();
    const activeLoans = microFinanceService.getLoans();
    const target = activeLoans.find(l => l.id === id);
    if (!target) return activeLoans;

    const finalClosedBs = normalizeBsDate(closedDateBs || getTodayBsDate());
    const finalClosedAd = closedDateAd || new Date().toISOString().split('T')[0];

    const closedRecord: MFLoanRecord = {
      ...target,
      status: 'CLOSED',
      remainingAmount: 0,
      paidInstallments: target.totalInstallments || target.paidInstallments,
      closedDate: finalClosedAd,
      closedDateBs: finalClosedBs
    };

    // 1. Archive locally & remove from active list
    mergeClosedLoanArchive(closedRecord);
    const remainingActive = activeLoans.filter(l => l.id !== id);
    microFinanceService.saveLoans(remainingActive);

    // 2. Reduce member activeLoanAmount
    const members = microFinanceService.getMembers();
    const updatedMembers = members.map(m =>
      m.memberId === target.memberId
        ? { ...m, activeLoanAmount: Math.max(0, (m.activeLoanAmount || 0) - (target.remainingAmount || 0)) }
        : m
    );
    microFinanceService.saveMembers(updatedMembers);

    // 3. Persist permanently to Supabase (mf_loans + fallback)
    await microFinanceService.upsertLoanToSupabase(closedRecord);
    return remainingActive;
  },

  deleteLoan: (id: string): MFLoanRecord[] => {
    assertDayNotEnded();
    const loans = microFinanceService.getLoans().filter(l => l.id !== id);
    microFinanceService.saveLoans(loans);
    const remainingClosed = getClosedLoansLocalRaw().filter(l => l.id !== id);
    saveClosedLoansLocalRaw(remainingClosed);
    void microFinanceService.deleteLoanFromSupabase(id);
    return loans;
  },

  // On-demand Report Query: Fetches active loans + ONLY closed loans whose closedDateBs > selectedDateBs
  fetchLoansForReportDate: async (selectedDateBs: string): Promise<MFLoanRecord[]> => {
    const targetBs = normalizeBsDate(selectedDateBs);
    const todayBs = getTodayBsDate();
    const activeLoans = microFinanceService.getLoans();

    const isEligibleForDate = (l: MFLoanRecord): boolean => {
      const openBs = normalizeBsDate(l.loanDateBs || l.loanDate);
      if (openBs && targetBs && openBs > targetBs) return false;
      if (l.status === 'CLOSED') {
        const closedBs = normalizeBsDate(l.closedDateBs || l.closedDate || l.maturityDate);
        // Must have been closed STRICTLY AFTER the selected report date
        return Boolean(closedBs && targetBs && closedBs > targetBs);
      }
      return true;
    };

    const resultMap = new Map<string, MFLoanRecord>();
    activeLoans.filter(isEligibleForDate).forEach(l => resultMap.set(l.id, l));

    // Include any matching closed loans from local archive cache
    const localClosed = getClosedLoansLocalRaw();
    localClosed.filter(isEligibleForDate).forEach(l => {
      if (!resultMap.has(l.id)) resultMap.set(l.id, l);
    });

    // Only query Supabase for historical closed loans if target date is before or equal to today
    if (targetBs && targetBs <= todayBs) {
      try {
        const { data, error } = await supabase
          .from('mf_loans')
          .select('*')
          .eq('status', 'CLOSED')
          .gt('closed_date_bs', targetBs);

        if (!error && Array.isArray(data)) {
          data
            .map((r: SupabaseLoanRow) => mapRowToLoan(r))
            .filter(isEligibleForDate)
            .forEach(l => resultMap.set(l.id, l));
        } else if (error) {
          // Fallback to daily_data archive store
          const { data: fallbackRow } = await supabase
            .from('daily_data')
            .select('data')
            .eq('id', 'MF_CLOSED_LOANS_ARCHIVE')
            .maybeSingle();
          if (fallbackRow?.data?.loans && Array.isArray(fallbackRow.data.loans)) {
            (fallbackRow.data.loans as MFLoanRecord[])
              .filter(isEligibleForDate)
              .forEach(l => resultMap.set(l.id, l));
          }
        }
      } catch (e) {
        console.warn('Historical closed loan query failed, using local archive:', e);
      }
    }

    return Array.from(resultMap.values());
  },

  // Bulk Import Helpers (Unique IDs + single atomic save + Supabase loan sync)
  bulkAddCenters: (items: Omit<MFCenter, 'id' | 'createdAt'>[]): MFCenter[] => {
    assertDayNotEnded();
    const existing = microFinanceService.getCenters();
    const today = new Date().toISOString().split('T')[0];
    const stamp = Date.now();
    const created: MFCenter[] = items.map((item, idx) => ({
      ...item,
      id: `cnt-${stamp}-${idx}`,
      createdAt: today
    }));
    const updated = [...created, ...existing];
    microFinanceService.saveCenters(updated);
    return updated;
  },

  bulkAddGroups: (items: Omit<MFSamuhGroup, 'id' | 'createdAt'>[]): MFSamuhGroup[] => {
    assertDayNotEnded();
    const existing = microFinanceService.getGroups();
    const today = new Date().toISOString().split('T')[0];
    const stamp = Date.now();
    const created: MFSamuhGroup[] = items.map((item, idx) => ({
      ...item,
      id: `grp-${stamp}-${idx}`,
      createdAt: today
    }));
    const updated = [...created, ...existing];
    microFinanceService.saveGroups(updated);
    return updated;
  },

  bulkAddMembers: (items: Omit<MFMember, 'id' | 'createdAt'>[]): MFMember[] => {
    assertDayNotEnded();
    const existing = microFinanceService.getMembers();
    const today = new Date().toISOString().split('T')[0];
    const stamp = Date.now();
    const seenMemberIds = new Set<string>();
    const seenCitizenships = new Set<string>();
    const created: MFMember[] = [];

    items.forEach((item, idx) => {
      const memKey = normalizeDuplicateMemberId(item.memberId);
      const citKey = normalizeCitizenshipKey(item.citizenshipNo);
      if (
        findDuplicateMember(existing, { memberId: item.memberId, citizenshipNo: item.citizenshipNo }) ||
        (memKey && seenMemberIds.has(memKey)) ||
        (citKey && seenCitizenships.has(citKey))
      ) {
        return;
      }
      if (memKey) seenMemberIds.add(memKey);
      if (citKey) seenCitizenships.add(citKey);
      created.push({
        ...item,
        id: `mem-${stamp}-${idx}`,
        createdAt: today
      });
    });

    if (created.length === 0) {
      return existing;
    }

    const updated = [...created, ...existing];
    microFinanceService.saveMembers(updated);

    // Increment group member counts in batch
    const groupAdds = new Map<string, number>();
    created.forEach(m => {
      if (m.samuhId) groupAdds.set(m.samuhId, (groupAdds.get(m.samuhId) || 0) + 1);
    });
    if (groupAdds.size > 0) {
      const groups = microFinanceService.getGroups().map(g =>
        groupAdds.has(g.id) ? { ...g, membersCount: (g.membersCount || 0) + (groupAdds.get(g.id) || 0) } : g
      );
      microFinanceService.saveGroups(groups);
    }
    return updated;
  },

  bulkAddSavings: (items: Omit<MFSavingsRecord, 'id' | 'createdAt'>[]): MFSavingsRecord[] => {
    assertDayNotEnded();
    const existing = microFinanceService.getSavings();
    const today = new Date().toISOString().split('T')[0];
    const stamp = Date.now();
    const created: MFSavingsRecord[] = [];
    const seenBatchKeys = new Set<string>();
    items.forEach((item, idx) => {
      if (!isSavingStatusClosed(item.status)) {
        const memKey = normalizeDuplicateMemberId(item.memberId);
        const prodKey = normalizeSavingProductKey(item.savingType);
        const batchKey = memKey && prodKey ? `${memKey}__${prodKey}` : '';
        if (
          findActiveDuplicateSaving(existing, item.memberId, item.savingType) ||
          (batchKey && seenBatchKeys.has(batchKey))
        ) {
          return;
        }
        if (batchKey) seenBatchKeys.add(batchKey);
      }
      created.push({
        ...item,
        id: `sav-${stamp}-${idx}`,
        createdAt: today
      });
    });
    const updated = [...created, ...existing];
    safeSetLocalStorage(STORAGE_KEYS.SAVINGS, updated);
    void bgUpsert('mf_savings', created.map(mapSavingToRow));

    // Update member totalSavings in batch for ACTIVE (or legacy PAID) savings
    const memberAdds = new Map<string, number>();
    created.forEach(s => {
      if ((s.status === 'ACTIVE' || s.status === 'PAID') && s.memberId) {
        memberAdds.set(s.memberId, (memberAdds.get(s.memberId) || 0) + (Number(s.amount) || 0));
      }
    });
    if (memberAdds.size > 0) {
      const changedMembers: MFMember[] = [];
      const members = microFinanceService.getMembers().map(m => {
        if (memberAdds.has(m.memberId)) {
          const next = { ...m, totalSavings: (m.totalSavings || 0) + (memberAdds.get(m.memberId) || 0) };
          changedMembers.push(next);
          return next;
        }
        return m;
      });
      safeSetLocalStorage(STORAGE_KEYS.MEMBERS, members);
      if (changedMembers.length > 0) {
        void bgUpsert('mf_members', changedMembers.map(mapMemberToRow));
      }
    }
    return updated;
  },

  bulkAddLoans: async (items: Omit<MFLoanRecord, 'id' | 'createdAt'>[]): Promise<MFLoanRecord[]> => {
    assertDayNotEnded();
    const existingActive = microFinanceService.getLoans();
    const today = new Date().toISOString().split('T')[0];
    const stamp = Date.now();
    const created: MFLoanRecord[] = [];
    const seenBatchKeys = new Set<string>();
    items.forEach((item, idx) => {
      if (item.status !== 'CLOSED') {
        const key = `${String(item.memberId || '').trim().toLowerCase()}__${normalizeLoanProductKey(item.loanProduct)}`;
        if (findUnclosedDuplicateLoan(existingActive, item.memberId, item.loanProduct) || seenBatchKeys.has(key)) {
          return;
        }
        seenBatchKeys.add(key);
      }
      created.push({
        ...item,
        id: `ln-${stamp}-${idx}`,
        createdAt: today
      });
    });

    const activeCreated = created.filter(l => l.status !== 'CLOSED');
    const closedCreated = created.filter(l => l.status === 'CLOSED');

    const updatedActive = [...activeCreated, ...existingActive];
    microFinanceService.saveLoans(updatedActive);

    closedCreated.forEach(cl => {
      mergeClosedLoanArchive({
        ...cl,
        remainingAmount: 0,
        closedDate: cl.closedDate || today,
        closedDateBs: normalizeBsDate(cl.closedDateBs || getTodayBsDate())
      });
    });

    // Update member activeLoanAmount in batch for non-closed loans
    const memberLoanAdds = new Map<string, number>();
    activeCreated.forEach(l => {
      if (l.memberId) {
        memberLoanAdds.set(l.memberId, (memberLoanAdds.get(l.memberId) || 0) + (Number(l.remainingAmount) || 0));
      }
    });
    if (memberLoanAdds.size > 0) {
      const members = microFinanceService.getMembers().map(m =>
        memberLoanAdds.has(m.memberId)
          ? { ...m, activeLoanAmount: (m.activeLoanAmount || 0) + (memberLoanAdds.get(m.memberId) || 0) }
          : m
      );
      microFinanceService.saveMembers(members);
    }

    // Batch upsert all created loans to Supabase (with daily_data fallback)
    try {
      const rows = created.map(l => mapLoanToRow(l));
      const { error } = await supabase.from('mf_loans').upsert(rows, { onConflict: 'id' });
      if (error) {
        await Promise.all([
          supabase.from('daily_data').upsert({
            id: 'MF_ACTIVE_LOANS_STORE',
            data: { loans: updatedActive, updatedAt: Date.now() }
          }),
          supabase.from('daily_data').upsert({
            id: 'MF_CLOSED_LOANS_ARCHIVE',
            data: { loans: getClosedLoansLocalRaw(), updatedAt: Date.now() }
          })
        ]);
      }
    } catch (e) {
      console.warn('Supabase bulk loan sync skipped:', e);
    }

    return updatedActive;
  },

  // Sheets (Reports) - never auto-seed default rows
  getSheets: (): MFCollectionSheet[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SHEETS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((s: MFCollectionSheet) => !LEGACY_DEFAULT_SHEET_IDS.has(s.id));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveSheets: (sheets: MFCollectionSheet[]): void => {
    localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(sheets));
    void bgUpsert('mf_collection_sheets', sheets.map(mapSheetToRow));
  },

  addSheet: (sheet: Omit<MFCollectionSheet, 'id' | 'createdAt'>): MFCollectionSheet => {
    assertDayNotEnded();
    const sheets = microFinanceService.getSheets();
    const newSheet: MFCollectionSheet = {
      ...sheet,
      id: 'cs-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newSheet, ...sheets];
    localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(updated));
    void bgUpsert('mf_collection_sheets', [mapSheetToRow(newSheet)]);
    return newSheet;
  },

  deleteSheet: (id: string): MFCollectionSheet[] => {
    assertDayNotEnded();
    const sheets = microFinanceService.getSheets().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(sheets));
    void bgDelete('mf_collection_sheets', id);
    return sheets;
  },

  // Permanent Signature Sheets - never auto-seed default rows
  getSignatureSheets: (): MFSignatureSheet[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SIGNATURE_SHEETS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((s: MFSignatureSheet) => !LEGACY_DEFAULT_SIG_SHEET_IDS.has(s.id));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveSignatureSheets: (sheets: MFSignatureSheet[]): void => {
    localStorage.setItem(STORAGE_KEYS.SIGNATURE_SHEETS, JSON.stringify(sheets));
    void bgUpsert('mf_signature_sheets', sheets.map(mapSigSheetToRow));
  },

  addSignatureSheet: (sheet: Omit<MFSignatureSheet, 'id' | 'createdAt'>): MFSignatureSheet => {
    assertDayNotEnded();
    const sheets = microFinanceService.getSignatureSheets();
    const newSheet: MFSignatureSheet = {
      ...sheet,
      id: 'sig-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newSheet, ...sheets];
    localStorage.setItem(STORAGE_KEYS.SIGNATURE_SHEETS, JSON.stringify(updated));
    void bgUpsert('mf_signature_sheets', [mapSigSheetToRow(newSheet)]);
    return newSheet;
  },

  updateSignatureSheet: (id: string, updatedSheet: Partial<MFSignatureSheet>): MFSignatureSheet[] => {
    assertDayNotEnded();
    let changed: MFSignatureSheet | null = null;
    const sheets = microFinanceService.getSignatureSheets().map(s => {
      if (s.id === id) {
        changed = { ...s, ...updatedSheet };
        return changed;
      }
      return s;
    });
    localStorage.setItem(STORAGE_KEYS.SIGNATURE_SHEETS, JSON.stringify(sheets));
    if (changed) void bgUpsert('mf_signature_sheets', [mapSigSheetToRow(changed)]);
    return sheets;
  },

  deleteSignatureSheet: (id: string): MFSignatureSheet[] => {
    assertDayNotEnded();
    const sheets = microFinanceService.getSignatureSheets().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SIGNATURE_SHEETS, JSON.stringify(sheets));
    void bgDelete('mf_signature_sheets', id);
    return sheets;
  },

  // Deposit Sheets (Group member Saving & Loan deposit entry records)
  getDepositSheets: (): MFDepositSheet[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DEPOSIT_SHEETS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed as MFDepositSheet[];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveDepositSheets: (sheets: MFDepositSheet[]): void => {
    safeSetLocalStorage(STORAGE_KEYS.DEPOSIT_SHEETS, sheets);
  },

  upsertDepositSheet: (
    sheet: Omit<MFDepositSheet, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
  ): { savedSheet: MFDepositSheet; allSheets: MFDepositSheet[] } => {
    assertDayNotEnded();
    const existing = microFinanceService.getDepositSheets();
    const nowIso = new Date().toISOString();
    const existingIdx = existing.findIndex(
      s =>
        (sheet.id && s.id === sheet.id) ||
        (s.groupId === sheet.groupId && s.dateBs === sheet.dateBs)
    );

    if (existingIdx >= 0) {
      const prev = existing[existingIdx];
      const updatedSheet: MFDepositSheet = {
        ...prev,
        ...sheet,
        id: prev.id,
        sheetNo: prev.sheetNo || sheet.sheetNo,
        createdAt: prev.createdAt,
        updatedAt: nowIso
      };
      const allSheets = existing.map((s, idx) => (idx === existingIdx ? updatedSheet : s));
      safeSetLocalStorage(STORAGE_KEYS.DEPOSIT_SHEETS, allSheets);
      return { savedSheet: updatedSheet, allSheets };
    }

    const newSheet: MFDepositSheet = {
      ...sheet,
      id: sheet.id || `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: sheet.createdAt || nowIso.split('T')[0],
      updatedAt: nowIso
    };
    const allSheets = [newSheet, ...existing];
    safeSetLocalStorage(STORAGE_KEYS.DEPOSIT_SHEETS, allSheets);
    return { savedSheet: newSheet, allSheets };
  },

  deleteDepositSheet: (id: string): MFDepositSheet[] => {
    assertDayNotEnded();
    const sheets = microFinanceService.getDepositSheets().filter(s => s.id !== id);
    safeSetLocalStorage(STORAGE_KEYS.DEPOSIT_SHEETS, sheets);
    return sheets;
  },

  // Settings
  getSettings: (): MFSettings => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  },

  saveSettings: (settings: MFSettings): void => {
    assertDayNotEnded();
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    void bgUpsert('mf_settings', [{ id: 'mf_general_settings', data: settings, updated_at: new Date().toISOString() }]);
  },

  // Hydrate ALL Micro-Finance entities from Supabase (and seed local items if Supabase tables are empty)
  fetchAllFromSupabase: async (): Promise<{
    centers: MFCenter[];
    groups: MFSamuhGroup[];
    members: MFMember[];
    savings: MFSavingsRecord[];
    loans: MFLoanRecord[];
    sheets: MFCollectionSheet[];
    signatureSheets: MFSignatureSheet[];
    settings: MFSettings;
  }> => {
    const localCenters = microFinanceService.getCenters();
    const localGroups = microFinanceService.getGroups();
    const localMembers = microFinanceService.getMembers();
    const localSavings = microFinanceService.getSavings();
    const localSheets = microFinanceService.getSheets();
    const localSigSheets = microFinanceService.getSignatureSheets();
    const localSettings = microFinanceService.getSettings();

    if (!supabase) {
      return {
        centers: localCenters,
        groups: localGroups,
        members: localMembers,
        savings: localSavings,
        loans: microFinanceService.getLoans(),
        sheets: localSheets,
        signatureSheets: localSigSheets,
        settings: localSettings
      };
    }

    try {
      const [
        cRes,
        gRes,
        mRes,
        sRes,
        shRes,
        sigRes,
        setRes,
        loans
      ] = await Promise.all([
        fetchAllRowsPaginated('mf_centers'),
        fetchAllRowsPaginated('mf_groups'),
        fetchAllRowsPaginated('mf_members'),
        fetchAllRowsPaginated('mf_savings'),
        fetchAllRowsPaginated('mf_collection_sheets'),
        fetchAllRowsPaginated('mf_signature_sheets'),
        supabase.from('mf_settings').select('data').eq('id', 'mf_general_settings').maybeSingle(),
        microFinanceService.fetchActiveLoansFromSupabase()
      ]);

      let centers = localCenters;
      if (!cRes.error && Array.isArray(cRes.data)) {
        if (cRes.data.length > 0) {
          centers = cRes.data.map(mapRowToCenter);
          safeSetLocalStorage(STORAGE_KEYS.CENTERS, centers);
        } else if (localCenters.length > 0) {
          void bgUpsert('mf_centers', localCenters.map(mapCenterToRow));
        }
      }

      let groups = localGroups;
      if (!gRes.error && Array.isArray(gRes.data)) {
        if (gRes.data.length > 0) {
          groups = gRes.data.map(mapRowToGroup);
          safeSetLocalStorage(STORAGE_KEYS.GROUPS, groups);
        } else if (localGroups.length > 0) {
          void bgUpsert('mf_groups', localGroups.map(mapGroupToRow));
        }
      }

      let members = localMembers;
      if (!mRes.error && Array.isArray(mRes.data)) {
        if (mRes.data.length > 0) {
          members = mRes.data.map(mapRowToMember);
          safeSetLocalStorage(STORAGE_KEYS.MEMBERS, members);
        } else if (localMembers.length > 0) {
          void bgUpsert('mf_members', localMembers.map(mapMemberToRow));
        }
      }

      let savings = localSavings;
      if (!sRes.error && Array.isArray(sRes.data)) {
        if (sRes.data.length > 0) {
          savings = sRes.data.map(mapRowToSaving);
          safeSetLocalStorage(STORAGE_KEYS.SAVINGS, savings);
        } else {
          const nonDefaultSavings = localSavings.filter(s => !['sav-1', 'sav-2', 'sav-3'].includes(s.id));
          if (nonDefaultSavings.length > 0) {
            void bgUpsert('mf_savings', nonDefaultSavings.map(mapSavingToRow));
          }
        }
      }

      // Sync mf_collection_sheets directly from Supabase (authoritative, no auto-default seeding)
      let sheets = localSheets;
      if (!shRes.error && Array.isArray(shRes.data)) {
        sheets = shRes.data.map(mapRowToSheet);
        safeSetLocalStorage(STORAGE_KEYS.SHEETS, sheets);
      }

      // Sync mf_signature_sheets directly from Supabase (authoritative, no auto-default seeding)
      let signatureSheets = localSigSheets;
      if (!sigRes.error && Array.isArray(sigRes.data)) {
        signatureSheets = sigRes.data.map(mapRowToSigSheet);
        safeSetLocalStorage(STORAGE_KEYS.SIGNATURE_SHEETS, signatureSheets);
      }

      let settings = localSettings;
      if (!setRes.error && setRes.data?.data) {
        settings = { ...DEFAULT_SETTINGS, ...(setRes.data.data as Partial<MFSettings>) };
        safeSetLocalStorage(STORAGE_KEYS.SETTINGS, settings);
      }

      return { centers, groups, members, savings, loans, sheets, signatureSheets, settings };
    } catch (err) {
      console.warn('Supabase MF fetchAll failed, using local cache:', err);
      return {
        centers: localCenters,
        groups: localGroups,
        members: localMembers,
        savings: localSavings,
        loans: microFinanceService.getLoans(),
        sheets: localSheets,
        signatureSheets: localSigSheets,
        settings: localSettings
      };
    }
  }
};
