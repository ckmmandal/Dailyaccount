import { supabase } from './supabase';
import NepaliDate from 'nepali-date-converter';
import { 
  DailyData, AuditLog, User, Role, SystemSettings, 
  LedgerAccount, Branch, Employee, LeaveType, 
  LeaveRequest, PayrollRecord, Complaint, Notice, PopupNotice,
  DownloadableDocument, FDRecordItem, TaxConfig,
  OfficeExpenseRecord, BranchFixedExpenseConfig, SavedOfficeExpenseSheet,
  ChatMessage, AttendanceRecord,
  BoardCategory, BoardMember, BoardAllowanceSheet, BoardDesignation,
  AppHoliday, BranchOperationalStatus, RemittanceCompany
} from '../types';

import { deduplicateEmployees } from './nameMatcher';

export const SUMIT_KUMAR_THAKUR_RECORD: Employee = {
  id: 'c6e60006-6666-4000-8000-000000000006',
  fullName: 'SUMIT KUMAR THAKUR',
  fullNameNepali: 'सुमित कुमार ठाकुर',
  employeeCode: '6',
  branchId: 'main',
  designation: 'JR ASSISTANT',
  designationNepali: 'कनिष्ठ सहायक',
  department: 'FIELD',
  departmentNepali: 'फिल्ड',
  status: 'Active',
  gender: 'Male',
  maritalStatus: 'Single',
  employmentType: 'Permanent',
  mobile: '9819800006',
  email: 'sumitrazz122@gmail.com',
  panNo: '126123243',
  basicSalary: 30000,
  joinedDate: '2078-04-01',
  daType: 'None',
  daValue: 1806000,
  dearnessAllowance: 541800000,
  gradeRate: 6,
  gradeRateAmount: 0,
  hasDashain: true,
  dashainBonus: 30000,
  festivalBonus: 30000,
  sanchitLeaveAmount: 30000,
  sanchitLeaveDays: 30,
  monthsActive: 12,
  hasSSF: false,
  ssfContribution: 0,
  hasPF: false,
  pfContribution: 0,
  hasGratuity: false,
  gratuity: 0,
  hasMedical: false,
  medicalAllowance: 0,
  hasBonus: false,
  bonusYearly: 0,
  lifeInsurance: 0,
  healthInsurance: 0,
  buildingInsurance: 0,
  medicalExpensesPaid: 0,
  remoteAreaCategory: 'None',
  isIncapacitated: false
};

export const OFFICIAL_MASTER_STAFF: Employee[] = [
  {
    id: '50bc4ff6-1eb8-4d97-8b53-51ba9d2998fe',
    fullName: 'AMIT KUMAR THAKUR',
    fullNameNepali: 'अमित कुमार ठाकुर',
    employeeCode: '1',
    branchId: 'main',
    designation: 'MANAGER',
    designationNepali: 'व्यवस्थापक',
    department: 'GENERAL',
    departmentNepali: 'सामान्य प्रशासन',
    status: 'Active',
    gender: 'Male',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000001',
    email: 'amit.thakur@rataulisaccos.com',
    basicSalary: 49200,
    joinedDate: '2075-01-01',
    gradeRate: 10,
    gradeRateAmount: 0,
    dearnessAllowance: 4851120,
    daValue: 4851120,
    hasDashain: true,
    dashainBonus: 49200,
    festivalBonus: 49200,
    monthsActive: 12
  },
  {
    id: 'a12a5d28-b0a4-4343-b87a-b7a63d1bdae7',
    fullName: 'CHANDRA SHEKHAR MANDAL',
    fullNameNepali: 'चन्द्र शेखर मण्डल',
    employeeCode: '2',
    branchId: 'main',
    designation: 'SENIOR OFFICER',
    designationNepali: 'वरिष्ठ अधिकृत',
    department: 'CREDIT',
    departmentNepali: 'ऋण विभाग',
    status: 'Active',
    gender: 'Male',
    maritalStatus: 'Married',
    employmentType: 'Permanent',
    mobile: '9854000002',
    email: 'chandrashekhar@rataulisaccos.com',
    basicSalary: 47600,
    joinedDate: '2075-04-01',
    gradeRate: 10,
    gradeRateAmount: 0,
    dearnessAllowance: 2161535040,
    daValue: 4541040,
    hasDashain: true,
    dashainBonus: 47600,
    festivalBonus: 47600,
    monthsActive: 12
  },
  {
    id: 'a34e204d-a050-46ad-93bf-1a4bddcca5cf',
    fullName: 'ROSHAN KUMAR MANDAL',
    fullNameNepali: 'रोशन कुमार मण्डल',
    employeeCode: '3',
    branchId: 'main',
    designation: 'SR.ASSISTANT',
    designationNepali: 'वरिष्ठ सहायक',
    department: 'MICRO FINANCE',
    departmentNepali: 'लघुवित्त',
    status: 'Active',
    gender: 'Male',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000003',
    email: 'roshan.mandal@rataulisaccos.com',
    basicSalary: 39500,
    joinedDate: '2076-01-01',
    gradeRate: 10,
    gradeRateAmount: 0,
    dearnessAllowance: 3128400,
    daValue: 3128400,
    hasDashain: true,
    dashainBonus: 39500,
    festivalBonus: 39500,
    monthsActive: 12
  },
  {
    id: 'e13ad4d6-ede6-4c03-8fd8-94ca6824d941',
    fullName: 'MANOJ KUMAR SAH',
    fullNameNepali: 'मनोज कुमार साह',
    employeeCode: '4',
    branchId: 'parsa',
    designation: 'ASSISTANT',
    designationNepali: 'सहायक',
    department: 'BRANCH INCHARGE',
    departmentNepali: 'शाखा इन्चार्ज',
    status: 'Active',
    gender: 'Male',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000004',
    email: 'manoj.sah@rataulisaccos.com',
    basicSalary: 35500,
    joinedDate: '2076-08-01',
    gradeRate: 9,
    gradeRateAmount: 0,
    dearnessAllowance: 897298000,
    daValue: 2527600,
    hasDashain: true,
    dashainBonus: 35500,
    festivalBonus: 35500,
    monthsActive: 12
  },
  {
    id: 'b7d29731-0e85-43b4-a1ac-bddb693ca416',
    fullName: 'AMBUJ KUMAR JHA',
    fullNameNepali: 'अम्बुज कुमार झा',
    employeeCode: '5',
    branchId: 'main',
    designation: 'ASSISTANT',
    designationNepali: 'सहायक',
    department: 'TELLER',
    departmentNepali: 'टेलार / लेखा',
    status: 'Active',
    gender: 'Male',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000005',
    email: 'ambuj.jha@rataulisaccos.com',
    basicSalary: 35500,
    joinedDate: '2077-01-01',
    gradeRate: 9,
    gradeRateAmount: 0,
    dearnessAllowance: 2527600,
    daValue: 2527600,
    hasDashain: true,
    dashainBonus: 35500,
    festivalBonus: 35500,
    monthsActive: 12
  },
  SUMIT_KUMAR_THAKUR_RECORD,
  {
    id: '07c0087f-11d7-494f-af4d-8228ef5acb96',
    fullName: 'CHANDANI KUMARI',
    fullNameNepali: 'चाँदनी कुमारी',
    employeeCode: '7',
    branchId: 'main',
    designation: 'JR ASSISTANT',
    designationNepali: 'कनिष्ठ सहायक',
    department: 'CSD',
    departmentNepali: 'ग्राहक सेवा (CSD)',
    status: 'Active',
    gender: 'Female',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000007',
    email: 'chandani@rataulisaccos.com',
    basicSalary: 30000,
    joinedDate: '2078-04-01',
    gradeRate: 8,
    gradeRateAmount: 0,
    dearnessAllowance: 541800000,
    daValue: 1806000,
    hasDashain: true,
    dashainBonus: 30000,
    festivalBonus: 30000,
    monthsActive: 12
  },
  {
    id: 'b68f60e8-d662-48dc-9dc4-fa710762c5b9',
    fullName: 'GOPAL KUMAR JHA',
    fullNameNepali: 'गोपाल कुमार झा',
    employeeCode: '8',
    branchId: 'sahodba',
    designation: 'JR ASSISTANT',
    designationNepali: 'कनिष्ठ सहायक',
    department: 'BRANCH INCHARGE',
    departmentNepali: 'शाखा इन्चार्ज',
    status: 'Active',
    gender: 'Male',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000008',
    email: 'gopal.jha@rataulisaccos.com',
    basicSalary: 30000,
    joinedDate: '2078-06-01',
    gradeRate: 6,
    gradeRateAmount: 0,
    dearnessAllowance: 541800000,
    daValue: 1806000,
    hasDashain: true,
    dashainBonus: 30000,
    festivalBonus: 30000,
    monthsActive: 12
  },
  {
    id: '26f94e8e-70fb-44a6-9823-60b3817a42f9',
    fullName: 'SWETA KUMARI',
    fullNameNepali: 'श्वेता कुमारी',
    employeeCode: '9',
    branchId: 'pipra',
    designation: 'MANAGEMENT TRAINE',
    designationNepali: 'व्यवस्थापन प्रशिक्षार्थी',
    department: 'BRANCH INCHARGE',
    departmentNepali: 'शाखा इन्चार्ज',
    status: 'Active',
    gender: 'Female',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000009',
    email: 'sweta.kumari@rataulisaccos.com',
    basicSalary: 26500,
    joinedDate: '2079-01-01',
    gradeRate: 6,
    gradeRateAmount: 0,
    dearnessAllowance: 1409800,
    daValue: 5320,
    hasDashain: true,
    dashainBonus: 26500,
    festivalBonus: 26500,
    monthsActive: 12
  },
  {
    id: '8d8c9298-f5f5-4e7e-b553-dec4da7eb1cd',
    fullName: 'KRISHNA KUMAR SAPHI',
    fullNameNepali: 'कृष्ण कुमार साफी',
    employeeCode: '10',
    branchId: 'main',
    designation: 'TRAINEE ASSISTANT',
    designationNepali: 'प्रशिक्षार्थी सहायक',
    department: 'FIELD',
    departmentNepali: 'फिल्ड / सूचना प्रविधि',
    status: 'Active',
    gender: 'Male',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000010',
    email: 'krishna.saphi@rataulisaccos.com',
    basicSalary: 23000,
    joinedDate: '2079-04-01',
    gradeRate: 6,
    gradeRateAmount: 0,
    dearnessAllowance: 1062600,
    daValue: 1062600,
    hasDashain: true,
    dashainBonus: 23000,
    festivalBonus: 23000,
    monthsActive: 12
  },
  {
    id: '91b9427a-3314-4bf6-b826-3868602932d6',
    fullName: 'ANSHU KUMAR THAKUR',
    fullNameNepali: 'अंशु कुमार ठाकुर',
    employeeCode: '11',
    branchId: 'sahodba',
    designation: 'TRAINEE ASSISTANT',
    designationNepali: 'प्रशिक्षार्थी सहायक',
    department: 'CASH TELLER',
    departmentNepali: 'नगद टेलार',
    status: 'Active',
    gender: 'Male',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000011',
    email: 'anshu.thakur@rataulisaccos.com',
    basicSalary: 23000,
    joinedDate: '2079-05-01',
    gradeRate: 6,
    gradeRateAmount: 0,
    dearnessAllowance: 1062600,
    daValue: 4620,
    hasDashain: true,
    dashainBonus: 23000,
    festivalBonus: 23000,
    monthsActive: 12
  },
  {
    id: '4e398b27-ec35-4243-928d-09d1cc0eaa41',
    fullName: 'RAKHI DEVI MANDAL',
    fullNameNepali: 'राखी देवी मण्डल',
    employeeCode: '12',
    branchId: 'pipra',
    designation: 'TELLER',
    designationNepali: 'टेलार',
    department: 'REMITTANCE',
    departmentNepali: 'विप्रेषण',
    status: 'Active',
    gender: 'Female',
    maritalStatus: 'Married',
    employmentType: 'Permanent',
    mobile: '9854000012',
    email: 'rakhi.mandal@rataulisaccos.com',
    basicSalary: 21500,
    joinedDate: '2079-08-01',
    gradeRate: 6,
    gradeRateAmount: 0,
    dearnessAllowance: 199692000,
    daValue: 928800,
    hasDashain: true,
    dashainBonus: 21500,
    festivalBonus: 21500,
    monthsActive: 12
  },
  {
    id: '01c80d16-da5b-4daf-8eef-2956fdeba15c',
    fullName: 'SIMA KUMARI MANDAL',
    fullNameNepali: 'सीमा कुमारी मण्डल',
    employeeCode: '13',
    branchId: 'sahodba',
    designation: 'TELLER',
    designationNepali: 'टेलार',
    department: 'REMITTANCE',
    departmentNepali: 'विप्रेषण',
    status: 'Active',
    gender: 'Female',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '9854000013',
    email: 'sima.mandal@rataulisaccos.com',
    basicSalary: 21500,
    joinedDate: '2080-01-01',
    gradeRate: 6,
    gradeRateAmount: 0,
    dearnessAllowance: 928800,
    daValue: 928800,
    hasDashain: true,
    dashainBonus: 21500,
    festivalBonus: 21500,
    monthsActive: 12
  },
  {
    id: '9641ad7c-d711-4e23-95b6-806f76f991ba',
    fullName: 'KAMNI DEVI KARN',
    fullNameNepali: 'कामनी देवी कर्ण',
    employeeCode: '14',
    branchId: 'main',
    designation: 'HELPER',
    designationNepali: 'सहयोगी',
    department: 'GENERAL',
    departmentNepali: 'कार्यालय सहयोग',
    status: 'Active',
    gender: 'Female',
    maritalStatus: 'Married',
    employmentType: 'Permanent',
    mobile: '9854000014',
    email: 'kamni.karn@rataulisaccos.com',
    basicSalary: 13340,
    joinedDate: '2077-01-01',
    gradeRate: 0,
    gradeRateAmount: 0,
    dearnessAllowance: 0,
    daValue: 0,
    hasDashain: true,
    dashainBonus: 13340,
    festivalBonus: 13340,
    monthsActive: 12
  }
];

// Helper functions for LocalStorage fallback DB
const getLocalDB = <T>(key: string, defaultVal: T): T => {
  try {
    const val = localStorage.getItem(`saccos_db_${key}`);
    if (val) {
      try {
        const parsed = JSON.parse(val);
        if (parsed !== null && parsed !== undefined) {
          if (key === 'employees' && Array.isArray(parsed)) {
            // Deduplicate employees by ID, name, code, and citizenship
            const deduped = deduplicateEmployees(parsed as Employee[]);
            // Guarantee Record #6: SUMIT KUMAR THAKUR is never missing
            const hasSumit = deduped.some((e: any) => 
              e && (e.id === SUMIT_KUMAR_THAKUR_RECORD.id || 
              (e.fullName && e.fullName.toUpperCase().includes('SUMIT KUMAR THAKUR')) ||
              (e.employeeCode && (e.employeeCode === '6' || e.employeeCode === 'EMP-006' || e.employeeCode === 'EMP-005')))
            );
            const finalDeduped = hasSumit ? deduped : [...deduped, SUMIT_KUMAR_THAKUR_RECORD];
            if (finalDeduped.length !== parsed.length) {
              try { localStorage.setItem(`saccos_db_${key}`, JSON.stringify(finalDeduped)); } catch (e) {
                console.warn("Could not save deduplicated employees:", e);
              }
            }
            return finalDeduped as unknown as T;
          }
          return parsed;
        }
      } catch {
        // invalid JSON in storage, fall through to default/seed
      }
    }
    
    // Seed default values if empty
    if (key === 'employees') {
      try { localStorage.setItem(`saccos_db_${key}`, JSON.stringify(OFFICIAL_MASTER_STAFF)); } catch (_) {}
      return OFFICIAL_MASTER_STAFF as unknown as T;
    }
    if (key === 'users') {
      const defaultUsers: User[] = [

        {
          id: 'admin-temp',
          fullName: 'System Administrator',
          username: 'admin',
          password: 'admin',
          mobile: '9800000000',
          roleId: '1',
          branchId: 'main',
          status: 'Active',
          accountCreated: 1700000000000,
          permissions: [
            'view_transaction', 'add_transaction', 'edit_transaction', 'delete_transaction',
            'view_reports', 'manage_users', 'manage_settings', 'view_cash_entry',
            'view_daily_ledger', 'view_income_expense', 'view_ledger_names',
            'view_consolidated_report', 'cross_branch_operation', 'manage_hr', 'manage_notices'
          ]
        }
      ];
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultUsers));
      return defaultUsers as unknown as T;
    }
    if (key === 'branches') {
      const defaultBranches = [
        {id: "main", name: "Ratauli Head Office", code: "C01", location: "Ratauli", status: "Active", createdAt: 1700000000000},
        {id: "sahodba", name: "Sahodba Branch", code: "C02", location: "Sahodba", status: "Active", createdAt: 1700000000001},
        {id: "pipra", name: "Pipra Branch", code: "C03", location: "Pipra", status: "Active", createdAt: 1700000000002},
        {id: "parsa", name: "Parsa Branch", code: "C04", location: "Parsa", status: "Active", createdAt: 1700000000003}
      ];
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultBranches));
      return defaultBranches as unknown as T;
    }
    if (key === 'roles') {
      const defaultRoles = [
        {
          id: "1",
          name: "Super Admin",
          permissions: ["view_transaction", "add_transaction", "edit_transaction", "delete_transaction", "view_reports", "manage_users", "manage_settings", "view_cash_entry", "view_daily_ledger", "view_income_expense", "view_ledger_names", "view_consolidated_report", "cross_branch_operation", "manage_hr", "manage_notices"]
        },
        {
          id: "2",
          name: "Manager",
          permissions: ["view_transaction", "add_transaction", "view_reports", "view_cash_entry", "view_daily_ledger", "view_ledger_names", "view_income_expense", "manage_hr", "manage_notices"]
        },
        {
          id: "3",
          name: "Branch Operator",
          permissions: ["view_transaction", "add_transaction", "view_reports", "view_cash_entry", "view_daily_ledger", "view_income_expense", "view_ledger_names"]
        }
      ];
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultRoles));
      return defaultRoles as unknown as T;
    }
    if (key === 'leave_types') {
      const defaultLeaveTypes = [
        {id: "lt1", name: "Annual Leave", nameNp: "घर बिदा", totalDays: 30, isOneTime: false, genderSpecific: null},
        {id: "lt2", name: "Sick Leave", nameNp: "बिरामी बिदा", totalDays: 12, isOneTime: false, genderSpecific: null},
        {id: "lt3", name: "Emergency Leave", nameNp: "भैपरी बिदा", totalDays: 3, isOneTime: false, genderSpecific: null},
        {id: "lt4", name: "Bereavement Leave", nameNp: "क्रिया बिदा", totalDays: 13, isOneTime: true, genderSpecific: null},
        {id: "lt5", name: "Maternity Leave", nameNp: "सुत्केरी बिदा", totalDays: 98, isOneTime: false, genderSpecific: "Female"},
        {id: "lt6", name: "Paternity / Care Leave", nameNp: "सुत्केरी स्याहार बिदा", totalDays: 15, isOneTime: false, genderSpecific: "Male"}
      ];
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultLeaveTypes));
      return defaultLeaveTypes as unknown as T;
    }
    if (key === 'remittance_companies') {
      const defaultRemittanceCompanies: RemittanceCompany[] = [
        {
          id: 'remit_prabhu',
          name: 'Prabhu Remit',
          code: 'PRB-01',
          accessId: 'PRABHU-HO-101',
          username: 'ratauli_prabhu',
          password: 'Prabhu@User2026',
          txnPin: '4021',
          portalUrl: 'https://remit.prabhubank.com',
          status: 'Active',
          contactPhone: '01-4788500',
          contactEmail: 'remit@prabhubank.com',
          branchId: 'all',
          notes: 'Daily limit NPR 500,000. Reset password every 90 days as per Prabhu policy.',
          lastPasswordChanged: '2026-08-01',
          createdAt: 1700000000000,
          updatedAt: 1700000000000
        },
        {
          id: 'remit_ime',
          name: 'IME Remit (IME Pay)',
          code: 'IME-702',
          accessId: 'IME-RAT-884',
          username: 'ratauli_ime',
          password: 'ImePay@Secure26',
          txnPin: '1190',
          portalUrl: 'https://imeremit.com.np',
          status: 'Active',
          contactPhone: '01-4430600',
          contactEmail: 'support@imeremit.com.np',
          branchId: 'all',
          notes: 'PIN required for counter payout authorization.',
          lastPasswordChanged: '2026-08-15',
          createdAt: 1700000000001,
          updatedAt: 1700000000001
        },
        {
          id: 'remit_city',
          name: 'City Express Money Transfer',
          code: 'CTX-109',
          accessId: 'CTX-ACC-552',
          username: 'ratauli_cityexpress',
          password: 'CityExp#2026Vault',
          txnPin: '8832',
          portalUrl: 'https://online.ctxpress.com',
          status: 'Active',
          contactPhone: '01-4431900',
          contactEmail: 'info@ctxpress.com',
          branchId: 'all',
          notes: 'Agent code must be entered along with username on login screen.',
          lastPasswordChanged: '2026-07-20',
          createdAt: 1700000000002,
          updatedAt: 1700000000002
        },
        {
          id: 'remit_western_union',
          name: 'Western Union',
          code: 'WU-NP-04',
          accessId: 'WU-TERM-901',
          username: 'ratauli_wu_agent',
          password: 'WU#SecureGlobal26',
          txnPin: '5612',
          portalUrl: 'https://wupos.westernunion.com',
          status: 'Active',
          contactPhone: '1660-01-44444',
          contactEmail: 'nepalcare@westernunion.com',
          branchId: 'all',
          notes: 'Supports inbound international remittances.',
          lastPasswordChanged: '2026-09-01',
          createdAt: 1700000000003,
          updatedAt: 1700000000003
        },
        {
          id: 'remit_himal',
          name: 'Himal Remit (HBL)',
          code: 'HML-330',
          accessId: 'HML-BRANCH-12',
          username: 'ratauli_himal',
          password: 'Himal@Remit2026',
          txnPin: '7721',
          portalUrl: 'https://himalremit.hbl.com.np',
          status: 'Active',
          contactPhone: '01-4227749',
          contactEmail: 'himalremit@hbl.com.np',
          branchId: 'all',
          notes: 'Gulf corridor incoming transfers direct account deposits.',
          lastPasswordChanged: '2026-08-28',
          createdAt: 1700000000004,
          updatedAt: 1700000000004
        },
        {
          id: 'remit_esewa',
          name: 'Esewa Money Transfer',
          code: 'EMT-881',
          accessId: 'EMT-ACC-410',
          username: 'ratauli_esewa_remit',
          password: 'EsewaRemit!2026',
          txnPin: '9045',
          portalUrl: 'https://esewamoneytransfer.com',
          status: 'Active',
          contactPhone: '1660-01-02121',
          contactEmail: 'care@esewamoneytransfer.com',
          branchId: 'all',
          notes: 'Instant wallet transfer and cash pick-up service.',
          lastPasswordChanged: '2026-09-10',
          createdAt: 1700000000005,
          updatedAt: 1700000000005
        },
        {
          id: 'remit_muktinath',
          name: 'Muktinath Remit',
          code: 'MNR-204',
          accessId: 'MNB-REMIT-055',
          username: 'ratauli_muktinath',
          password: 'Muktinath#Vault26',
          txnPin: '3310',
          portalUrl: 'https://remit.muktinathbank.com.np',
          status: 'Active',
          contactPhone: '01-4437368',
          contactEmail: 'remit@muktinathbank.com.np',
          branchId: 'all',
          notes: 'National network payout partner.',
          lastPasswordChanged: '2026-08-10',
          createdAt: 1700000000006,
          updatedAt: 1700000000006
        },
        {
          id: 'remit_surya',
          name: 'Surya Remit',
          code: 'SRY-99',
          accessId: 'SRY-ACC-302',
          username: 'ratauli_surya',
          password: 'SuryaRemit@2026',
          txnPin: '2289',
          portalUrl: 'https://suryaremit.com.np',
          status: 'Active',
          contactPhone: '01-4169000',
          contactEmail: 'support@suryaremit.com.np',
          branchId: 'all',
          notes: 'Malaysia and UAE remittance corridor partner.',
          lastPasswordChanged: '2026-07-15',
          createdAt: 1700000000007,
          updatedAt: 1700000000007
        }
      ];
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultRemittanceCompanies));
      return defaultRemittanceCompanies as unknown as T;
    }
    if (key === 'board_categories') {
      const defaultBoardCategories: BoardCategory[] = [
        { id: 'cat_bod', name: 'Board of Directors', code: 'BOD', description: 'Executive governing body responsible for institutional governance and compliance.', maxMembers: 11, displayOrder: 1, isCustom: false },
        { id: 'cat_asc', name: 'Account & Supervisory Committee', code: 'ASC', description: 'Internal audit and statutory committee ensuring financial integrity.', maxMembers: 3, displayOrder: 2, isCustom: false },
        { id: 'cat_lsc', name: 'Loan Sub-Committee', code: 'LSC', description: 'Credit appraisal, loan evaluation, and member portfolio reviews.', maxMembers: 3, displayOrder: 3, isCustom: false },
        { id: 'cat_etc', name: 'Education & Training Sub-Committee', code: 'ETC', description: 'Member cooperative awareness, capacity building, and education.', maxMembers: 3, displayOrder: 4, isCustom: false },
        { id: 'cat_adv', name: 'Advisory Board', code: 'ADV', description: 'Senior cooperative advisors providing institutional leadership and stewardship.', maxMembers: 5, displayOrder: 5, isCustom: false }
      ];
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultBoardCategories));
      return defaultBoardCategories as unknown as T;
    }
    if (key === 'board_designations') {
      const defaultBoardDesignations: BoardDesignation[] = [
        { id: 'des_1', title: 'अध्यक्ष (Chairperson)', code: 'CHAIR', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'समग्र संस्थाको नेतृत्व तथा साधारण सभा र सञ्चालक समितिको बैठक अध्यक्षता', defaultAllowance: 5000, displayOrder: 1, isCustom: false },
        { id: 'des_2', title: 'उपाध्यक्ष (Vice-Chairperson)', code: 'VCHAIR', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'अध्यक्षको अनुपस्थितिमा कार्यभार सञ्चालन तथा उप-समिति समन्वय', defaultAllowance: 4500, displayOrder: 2, isCustom: false },
        { id: 'des_3', title: 'सचिव (Secretary)', code: 'SEC', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'बैठक सञ्चालन, माइन्युट प्रमाणीकरण तथा प्रशासनिक समन्वय', defaultAllowance: 4000, displayOrder: 3, isCustom: false },
        { id: 'des_4', title: 'कोषाध्यक्ष (Treasurer)', code: 'TREAS', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'आर्थिक नीति तर्जुमा, बजेट तथा वित्तीय अनुशासन निगरानी', defaultAllowance: 4000, displayOrder: 4, isCustom: false },
        { id: 'des_5', title: 'सदस्य (Member)', code: 'MEM', categoryId: 'all', categoryName: 'All Committees', mandate: 'समिति निर्णय तथा नीतिगत छलफलमा सक्रिय सहभागिता', defaultAllowance: 3000, displayOrder: 5, isCustom: false },
        { id: 'des_6', title: 'संयोजक (Coordinator)', code: 'COORD', categoryId: 'all', categoryName: 'All Committees', mandate: 'सम्बन्धित उप-समिति वा अनुगमन समितिको नेतृत्व', defaultAllowance: 3500, displayOrder: 6, isCustom: false },
        { id: 'des_7', title: 'सह-सचिव (Joint-Secretary)', code: 'JSEC', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'सचिवलाई सघाउने तथा अभिलेख व्यवस्थापन', defaultAllowance: 3500, displayOrder: 7, isCustom: false },
        { id: 'des_8', title: 'सल्लाहकार (Advisor)', code: 'ADV', categoryId: 'cat_adv', categoryName: 'Advisory Board', mandate: 'संस्थागत मार्गदर्शन तथा नीतिगत सल्लाह', defaultAllowance: 2500, displayOrder: 8, isCustom: false }
      ];
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultBoardDesignations));
      return defaultBoardDesignations as unknown as T;
    }
    if (key === 'board_members') {
      const defaultBoardMembers: BoardMember[] = [
        {
          id: 'bm_1',
          registrationDateBs: '2081-06-15',
          memberId: 'MEM-0012',
          accountNumber: '01201017500123',
          fullName: 'RAMESH KUMAR SHRESTHA',
          fullNameNp: 'रमेश कुमार श्रेष्ठ',
          memberCode: 'MEM-0012',
          categoryId: 'cat_bod',
          categoryName: 'Board of Directors',
          designation: 'Chairperson / President',
          gender: 'Male',
          dobBs: '२०४५/०५/१५',
          dobAd: '1988-08-31',
          bloodGroup: 'O+',
          mobile: '9851023456',
          email: 'ramesh.shrestha@cooperative.org.np',
          panNo: '102394857',
          citizenshipNo: '१७-०१-७५-१२३४५',
          citizenshipIssuedDistrict: 'महोत्तरी',
          citizenshipIssuedOffice: 'जिल्ला प्रशासन कार्यालय, महोत्तरी',
          citizenshipIssuedDateBs: '२०६०/०४/१५',
          permanentProvince: 'मधेश प्रदेश (Madhesh Province)',
          permanentDistrict: 'महोत्तरी (Mahottari)',
          permanentMunicipality: 'पिपरा गाउँपालिका',
          permanentWard: '०३',
          permanentTole: 'रतौली',
          permanentHouseNo: '२४',
          temporaryProvince: 'मधेश प्रदेश (Madhesh Province)',
          temporaryDistrict: 'महोत्तरी (Mahottari)',
          temporaryMunicipality: 'पिपरा गाउँपालिका',
          temporaryWard: '०३',
          temporaryTole: 'रतौली',
          isSameAddress: true,
          workingAreaResidency: 'स्थायी',
          voterIdNo: 'VTR-9823412',
          votingCenter: 'पिपरा मा.वि.',
          stayDurationInArea: '१२ महिना (स्थायी)',
          passportNo: 'PP9823410',
          cooperativePurpose: 'नियमित बचत, कर्जा सुविधा तथा आर्थिक समृद्धि',
          isOtherCoopMember: 'नभएको',
          isFamilyOtherCoopMember: 'नभएको',
          annualIncomeRange: 'रु. ४ लाखभन्दा बढी १० लाखसम्म',
          annualIncomeSources: {
            agriculture: '३,००,०००',
            business: '१,००,०००',
            domesticJob: '२,००,०००',
            foreignJob: ''
          },
          shareAmount: 10000,
          savingsAmount: 5000,
          estimatedLoan: '२,००,००० (आवश्यक परेमा)',
          estimatedTransactionsCount: '२४ पटक',
          estimatedAnnualDeposit: '१,००,०००',
          selfDeclarationConfirmed: true,
          fatherName: 'हरि प्रसाद श्रेष्ठ',
          motherName: 'लक्ष्मी देवी श्रेष्ठ',
          grandfatherName: 'गणेश प्रसाद श्रेष्ठ',
          spouseName: 'गीता श्रेष्ठ',
          familyType: 'संयुक्त र एकै भान्सा',
          occupation: 'खेतीपाती',
          spouseOccupation: 'खेतीपाती',
          isHighProfile: 'नरहेको',
          bankName: 'Nabil Bank Ltd.',
          bankBranch: 'Janakpur',
          bankAccountNo: '01201017500123',
          bankAccountType: 'Savings',
          profilePhoto: '',
          documents: [],
          tenure: {
            termLabel: '2080 - 2084 (4-Year Term)',
            startDateBs: '2080-06-15',
            oathDateBs: '2080-06-16',
            endDateBs: '2084-06-14',
            status: 'Active',
            notes: 'Elected as Chairperson during the 18th Annual General Meeting.'
          },
          allowanceConfig: {
            meetingAllowance: 5000,
            communicationAllowance: 2500,
            travelAllowance: 3000,
            refreshmentAllowance: 1500,
            otherAllowance: 0,
            customTdsRate: 15,
            isEligibleForAllowance: true
          },
          branchId: 'main',
          createdAt: Date.now() - 1000000,
          updatedAt: Date.now()
        },
        {
          id: 'bm_2',
          registrationDateBs: '2081-06-15',
          memberId: 'MEM-0048',
          accountNumber: '109010002345',
          fullName: 'SUNITA DEVI THAPA',
          fullNameNp: 'सुनिता देवी थापा',
          memberCode: 'MEM-0048',
          categoryId: 'cat_bod',
          categoryName: 'Board of Directors',
          designation: 'General Secretary',
          gender: 'Female',
          dobBs: '२०३८/०८/२०',
          dobAd: '1981-12-05',
          bloodGroup: 'B+',
          mobile: '9841876543',
          email: 'sunita.thapa@cooperative.org.np',
          panNo: '203948571',
          citizenshipNo: '१७-०१-७२-९८२३१',
          citizenshipIssuedDistrict: 'महोत्तरी',
          citizenshipIssuedOffice: 'जिल्ला प्रशासन कार्यालय, महोत्तरी',
          citizenshipIssuedDateBs: '२०५८/०३/१०',
          permanentProvince: 'मधेश प्रदेश (Madhesh Province)',
          permanentDistrict: 'महोत्तरी (Mahottari)',
          permanentMunicipality: 'पिपरा गाउँपालिका',
          permanentWard: '०४',
          permanentTole: 'रतौली',
          permanentHouseNo: '१२',
          temporaryProvince: 'मधेश प्रदेश (Madhesh Province)',
          temporaryDistrict: 'महोत्तरी (Mahottari)',
          temporaryMunicipality: 'पिपरा गाउँपालिका',
          temporaryWard: '०४',
          temporaryTole: 'रतौली',
          isSameAddress: true,
          workingAreaResidency: 'स्थायी',
          voterIdNo: 'VTR-7612349',
          votingCenter: 'पिपरा मा.वि.',
          stayDurationInArea: '१२ महिना (स्थायी)',
          passportNo: '',
          cooperativePurpose: 'नियमित बचत, कर्जा सुविधा तथा आर्थिक समृद्धि',
          isOtherCoopMember: 'नभएको',
          isFamilyOtherCoopMember: 'नभएको',
          annualIncomeRange: 'रु. ४ लाखभन्दा बढी १० लाखसम्म',
          annualIncomeSources: {
            agriculture: '२,००,०००',
            business: '१,५०,०००',
            domesticJob: '१,८०,०००',
            foreignJob: ''
          },
          shareAmount: 10000,
          savingsAmount: 5000,
          estimatedLoan: '१,५०,०००',
          estimatedTransactionsCount: '२४ पटक',
          estimatedAnnualDeposit: '१,००,०००',
          selfDeclarationConfirmed: true,
          fatherName: 'भिम बहादुर थापा',
          motherName: 'माया देवी थापा',
          grandfatherName: 'टेक बहादुर थापा',
          spouseName: 'राजेश थापा',
          familyType: 'संयुक्त र एकै भान्सा',
          occupation: 'नोकरी (खुलाउने)',
          spouseOccupation: 'व्यवसाय',
          isHighProfile: 'नरहेको',
          bankName: 'Global IME Bank',
          bankBranch: 'Janakpur',
          bankAccountNo: '109010002345',
          bankAccountType: 'Savings',
          profilePhoto: '',
          documents: [],
          tenure: {
            termLabel: '2080 - 2084 (4-Year Term)',
            startDateBs: '2080-06-15',
            oathDateBs: '2080-06-16',
            endDateBs: '2084-06-14',
            status: 'Active',
            notes: 'Executive General Secretary managing board documentation and minutes.'
          },
          allowanceConfig: {
            meetingAllowance: 4000,
            communicationAllowance: 2000,
            travelAllowance: 2500,
            refreshmentAllowance: 1500,
            otherAllowance: 0,
            customTdsRate: 15,
            isEligibleForAllowance: true
          },
          branchId: 'main',
          createdAt: Date.now() - 900000,
          updatedAt: Date.now()
        },
        {
          id: 'bm_3',
          registrationDateBs: '2081-06-15',
          memberId: 'MEM-0089',
          accountNumber: '2450123987001',
          fullName: 'BIKASH RAJ POUDEL',
          fullNameNp: 'बिकास राज पौडेल',
          memberCode: 'MEM-0089',
          categoryId: 'cat_asc',
          categoryName: 'Account & Supervisory Committee',
          designation: 'Committee Coordinator',
          gender: 'Male',
          dobBs: '२०३५/११/१५',
          dobAd: '1979-02-27',
          bloodGroup: 'A+',
          mobile: '9860129876',
          email: 'bikash.poudel@cooperative.org.np',
          panNo: '304958672',
          citizenshipNo: '१७-०१-६८-३४५६१',
          citizenshipIssuedDistrict: 'महोत्तरी',
          citizenshipIssuedOffice: 'जिल्ला प्रशासन कार्यालय, महोत्तरी',
          citizenshipIssuedDateBs: '२०५४/०८/२२',
          permanentProvince: 'मधेश प्रदेश (Madhesh Province)',
          permanentDistrict: 'महोत्तरी (Mahottari)',
          permanentMunicipality: 'पिपरा गाउँपालिका',
          permanentWard: '०२',
          permanentTole: 'रतौली',
          permanentHouseNo: '०८',
          temporaryProvince: 'मधेश प्रदेश (Madhesh Province)',
          temporaryDistrict: 'महोत्तरी (Mahottari)',
          temporaryMunicipality: 'पिपरा गाउँपालिका',
          temporaryWard: '०२',
          temporaryTole: 'रतौली',
          isSameAddress: true,
          workingAreaResidency: 'स्थायी',
          voterIdNo: 'VTR-6519203',
          votingCenter: 'पिपरा मा.वि.',
          stayDurationInArea: '१२ महिना (स्थायी)',
          passportNo: '',
          cooperativePurpose: 'नियमित बचत, कर्जा सुविधा तथा आर्थिक समृद्धि',
          isOtherCoopMember: 'नभएको',
          isFamilyOtherCoopMember: 'नभएको',
          annualIncomeRange: 'रु. ४ लाखभन्दा बढी १० लाखसम्म',
          annualIncomeSources: {
            agriculture: '१,५०,०००',
            business: '२,५०,०००',
            domesticJob: '१,२०,०००',
            foreignJob: ''
          },
          shareAmount: 10000,
          savingsAmount: 5000,
          estimatedLoan: '१,००,०००',
          estimatedTransactionsCount: '२४ पटक',
          estimatedAnnualDeposit: '१,००,०००',
          selfDeclarationConfirmed: true,
          fatherName: 'कृष्ण प्रसाद पौडेल',
          motherName: 'सिता देवी पौडेल',
          grandfatherName: 'राम प्रसाद पौडेल',
          spouseName: 'राधा पौडेल',
          familyType: 'संयुक्त र एकै भान्सा',
          occupation: 'व्यवसाय (खुलाउने)',
          spouseOccupation: 'खेतीपाती',
          isHighProfile: 'नरहेको',
          bankName: 'NIC Asia Bank',
          bankBranch: 'Janakpur',
          bankAccountNo: '2450123987001',
          bankAccountType: 'Savings',
          profilePhoto: '',
          documents: [],
          tenure: {
            termLabel: '2080 - 2084 (4-Year Term)',
            startDateBs: '2080-06-15',
            oathDateBs: '2080-06-16',
            endDateBs: '2084-06-14',
            status: 'Active',
            notes: 'Supervisory committee coordinator overseeing internal audits.'
          },
          allowanceConfig: {
            meetingAllowance: 3500,
            communicationAllowance: 1500,
            travelAllowance: 2000,
            refreshmentAllowance: 1000,
            otherAllowance: 0,
            customTdsRate: 15,
            isEligibleForAllowance: true
          },
          branchId: 'main',
          createdAt: Date.now() - 800000,
          updatedAt: Date.now()
        }
      ];
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultBoardMembers));
      return defaultBoardMembers as unknown as T;
    }
    if (key === 'settings') {
      const defaultSettings = {
        systemName: "RATAULI SACCOS DAILY ACCOUNT",
        currency: "NPR",
        remittanceCompanies: ["IME", "Prabhu", "City Express", "Sewa", "E-Sewa", "Khalti", "I-Pay"],
        officeHeads: ["Salary", "Rent", "Electricity", "Water", "Stationery", "Marketing", "Maintenance", "Interest Paid", "Interest Received", "Commission"],
        approvalLimit: 50000,
        enableApprovals: true,
        logoUrl: "/system_logo.png"
      };
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(defaultSettings));
      return defaultSettings as unknown as T;
    }
    
    if (defaultVal !== undefined) return defaultVal;
    return [] as unknown as T;
  } catch (e) {
    if (defaultVal !== undefined) return defaultVal;
    return [] as unknown as T;
  }
};

const cleanDataForStorage = (val: unknown, keyName?: string): unknown => {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    if (keyName === 'imageUrl' || keyName === 'logoUrl' || keyName === 'attachment_url' || keyName === 'file_url') {
      return val;
    }
    if (val.length > 25000 && (val.startsWith('data:') || val.includes('base64'))) {
      return '[TRUNCATED_BASE64_FOR_CACHE]';
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => cleanDataForStorage(item, keyName));
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        cleaned[k] = cleanDataForStorage(obj[k], k);
      }
    }
    return cleaned;
  }
  return val;
};

const saveLocalDB = <T>(key: string, data: T): void => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (key === 'employees' && Array.isArray(data)) {
      const hasSumit = (data as any[]).some(e => 
        e && (e.id === SUMIT_KUMAR_THAKUR_RECORD.id || 
        (e.fullName && e.fullName.toUpperCase().includes('SUMIT KUMAR THAKUR')) ||
        (e.employeeCode && (e.employeeCode === '6' || e.employeeCode === 'EMP-006' || e.employeeCode === 'EMP-005')))
      );
      if (!hasSumit) {
        (data as any[]).push(SUMIT_KUMAR_THAKUR_RECORD);
      }
    }
    if (key === 'popup_notices' || key === 'settings') {
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(data));
      return;
    }
    const cleaned = cleanDataForStorage(data);
    localStorage.setItem(`saccos_db_${key}`, JSON.stringify(cleaned));
  } catch (e) {
    try {
      const cleaned = cleanDataForStorage(data);
      localStorage.setItem(`saccos_db_${key}`, JSON.stringify(cleaned));
    } catch (err) {
      console.warn(`Local storage save for ${key} was skipped:`, err);
    }
  }
};

// ==========================================
// High-Performance In-Memory Query Cache with SWR & Request Deduplication
// ==========================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export const getCachedData = <T>(key: string, maxAgeMs?: number): T | null => {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  const ttl = maxAgeMs !== undefined ? maxAgeMs : entry.ttl;
  if (Date.now() - entry.timestamp <= ttl) {
    return entry.data as T;
  }
  return null;
};

export const setCachedData = <T>(key: string, data: T, ttlMs: number = 30000): void => {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
};

export const invalidateMemoryCache = (pattern?: string): void => {
  if (!pattern) {
    memoryCache.clear();
    inFlightRequests.clear();
    return;
  }
  for (const k of Array.from(memoryCache.keys())) {
    if (k.includes(pattern)) memoryCache.delete(k);
  }
  for (const k of Array.from(inFlightRequests.keys())) {
    if (k.includes(pattern)) inFlightRequests.delete(k);
  }
};

export const withTimeout = <T>(promise: Promise<T>, timeoutMs = 10000, errorMsg = 'Operation timed out'): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export const fetchWithCache = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    ttlMs?: number;
    fallbackLocalKey?: string;
    defaultVal?: T;
    timeoutMs?: number;
    fallbackFn?: () => T | Promise<T>;
  } = {}
): Promise<T> => {
  const { ttlMs = 30000, fallbackLocalKey, defaultVal, timeoutMs = 10000, fallbackFn } = options;
  
  // 1. Return from memory cache if fresh (0 ms instant response)
  const cached = getCachedData<T>(key, ttlMs);
  if (cached !== null) {
    return cached;
  }

  // 2. Return active in-flight promise if identical query is already executing
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }

  // 3. Execute query with safety timeout and store in cache
  const fetchPromise = (async () => {
    try {
      const result = await withTimeout(fetchFn(), timeoutMs, `Fetch timeout for ${key}`);
      setCachedData(key, result, ttlMs);
      return result;
    } catch (err) {
      console.warn(`Fetch error or timeout for ${key}, falling back to local:`, err);
      
      if (fallbackFn) {
        try {
          const fallbackRes = await fallbackFn();
          if (fallbackRes !== undefined && fallbackRes !== null) {
            setCachedData(key, fallbackRes, ttlMs);
            return fallbackRes;
          }
        } catch (fErr) {
          console.warn(`Error in fallbackFn for ${key}:`, fErr);
        }
      }

      if (fallbackLocalKey) {
        const local = getLocalDB<T>(fallbackLocalKey, defaultVal as T);
        setCachedData(key, local, ttlMs);
        if (local !== undefined && local !== null) return local;
        if (defaultVal !== undefined) return defaultVal;
        return local;
      }

      if (defaultVal !== undefined) {
        setCachedData(key, defaultVal, ttlMs);
        return defaultVal;
      }

      // Built-in resilient fallback for daily_data queries
      if (key.startsWith('daily_data_')) {
        const local = getLocalDB<Record<string, DailyData>>('daily_data', {});
        const isAll = key === 'daily_data_all';
        const targetNorm = isAll ? 'all' : key.replace('daily_data_', '');
        const res: Record<string, DailyData> = {};
        Object.keys(local).forEach(k => {
          const item = local[k];
          if (!item) return;
          if (k === 'FD_RECORDS_STORE' || k === 'OFFICE_EXPENSES_STORE' || k === 'SAVED_EXPENSE_SHEETS_STORE' || k === 'FIXED_OFFICE_EXPENSE_CONFIGS') return;
          const itemBranch = item.branchId || (k.includes('_') ? k.split('_').slice(1).join('_') : 'main');
          if (!isAll && normalizeBranchId(itemBranch) !== targetNorm) return;
          const bsKey = toBsDateString(item.date || k.split('_')[0] || k);
          const itemData = { ...item, date: bsKey, branchId: itemBranch };
          if (res[bsKey]) {
            res[bsKey] = mergeDailyData(res[bsKey], itemData);
          } else {
            res[bsKey] = itemData;
          }
        });
        setCachedData(key, res as unknown as T, ttlMs);
        return res as unknown as T;
      }

      // Built-in resilient fallback for ledger_accounts queries
      if (key.startsWith('ledger_accounts_')) {
        const local = getLocalDB<LedgerAccount[]>('ledger_accounts', []);
        setCachedData(key, local as unknown as T, ttlMs);
        return local as unknown as T;
      }

      throw err;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
};

const safeUUID = (): string => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    console.warn(e);
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const nepaliToEnglishNumber = (str: string | number = ''): string => {
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  let result = String(str || '');
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(nepaliDigits[i], 'g'), englishDigits[i]);
  }
  return result;
};

export const toAdDateString = (dateStr?: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const raw = dateStr.includes('_') ? dateStr.split('_')[0] : dateStr;
  const parts = raw.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const [y, m, d] = parts;
    if (y > 2070) {
      try {
        const np = new NepaliDate(y, m - 1, d);
        const jsDate = np.toJsDate();
        const yyyy = jsDate.getFullYear();
        const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
        const dd = String(jsDate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      } catch (e) {
        return raw;
      }
    } else if (y > 1900) {
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }
  return raw;
};

export const toBsDateString = (dateStr?: string): string => {
  if (!dateStr) {
    try {
      return new NepaliDate().format('YYYY-MM-DD');
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  }

  // Strip branch suffix if present (e.g. "2083-04-06_HEAD_OFFICE" -> "2083-04-06")
  const raw = dateStr.includes('_') ? dateStr.split('_')[0] : dateStr;
  
  const parts = raw.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const [y, m, d] = parts;
    if (y > 2070) {
      // It's already BS year (e.g. 2083)
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    } else if (y > 1900) {
      // It's AD year (e.g. 2026), convert to BS
      try {
        return new NepaliDate(new Date(y, m - 1, d)).format('YYYY-MM-DD');
      } catch (e) {
        return raw;
      }
    }
  }
  return raw;
};

export const normalizeBranchId = (b?: string): string => {
  if (!b) return 'main';
  const s = String(b).toLowerCase().trim();
  if (
    s === 'main' || 
    s === 'c01' || 
    s === 'b01' || 
    s === 'head_office' || 
    s === 'head-office' || 
    s === 'headoffice' || 
    s === 'head office' || 
    s === 'ratauli' || 
    s.includes('head') || 
    s.includes('ratauli')
  ) {
    return 'main';
  }
  if (s === 'sahodba' || s === 'c02' || s === 'b02' || s.includes('sahodba')) return 'sahodba';
  if (s === 'pipra' || s === 'c03' || s === 'b03' || s.includes('pipra')) return 'pipra';
  if (s === 'parsa' || s === 'c04' || s === 'b04' || s.includes('parsa')) return 'parsa';
  return s;
};

export const isBranchMatch = (b1?: string, b2?: string): boolean => {
  if (!b1 || !b2) return true;
  if (b1 === 'all' || b2 === 'all') return true;
  return normalizeBranchId(b1) === normalizeBranchId(b2);
};

export function mergeDailyData(existing: DailyData, incoming: DailyData): DailyData {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const mergeById = <T extends { id?: string }>(arr1: T[] = [], arr2: T[] = []): T[] => {
    const map = new Map<string, T>();
    const getKey = (item: Record<string, unknown>, idx: number) => {
      if (item.id) return String(item.id);
      return `${item.companyName || item.head || item.value || ''}_${item.type || ''}_${item.amount || item.quantity || ''}_${item.date || ''}_${idx}`;
    };
    arr1.forEach((item, idx) => map.set(getKey(item as unknown as Record<string, unknown>, idx), item));
    arr2.forEach((item, idx) => {
      const k = getKey(item as unknown as Record<string, unknown>, idx);
      // Incoming data takes precedence over existing data to ensure edits and updates persist
      map.set(k, item);
    });
    return Array.from(map.values());
  };

  // Merge denominations array by summing quantities per note value
  const mergedDenos = (() => {
    const d1 = existing.denominations || [];
    const d2 = incoming.denominations || [];
    if (d1.length === 0) return d2;
    if (d2.length === 0) return d1;
    const valMap = new Map<number, number>();
    d1.forEach(d => {
      const v = Number(d.value) || 0;
      valMap.set(v, (valMap.get(v) || 0) + (Number(d.quantity) || 0));
    });
    d2.forEach(d => {
      const v = Number(d.value) || 0;
      valMap.set(v, (valMap.get(v) || 0) + (Number(d.quantity) || 0));
    });
    return Array.from(valMap.entries()).map(([value, quantity]) => ({ value, quantity }));
  })();

  return {
    ...existing,
    ...incoming,
    denominations: mergedDenos.length > 0 ? mergedDenos : (incoming.denominations || existing.denominations || []),
    denoAdjustments: mergeById(existing.denoAdjustments, incoming.denoAdjustments),
    transactions: mergeById(existing.transactions, incoming.transactions),
    officeTransactions: mergeById(existing.officeTransactions, incoming.officeTransactions),
    remittances: mergeById(existing.remittances, incoming.remittances),
    vaultTransactions: mergeById(existing.vaultTransactions, incoming.vaultTransactions),
  };
}

export const supabaseService = {
  // Cache invalidation utility
  invalidateMemoryCache(pattern?: string): void {
    invalidateMemoryCache(pattern);
  },

  // Helper to verify and ensure branch exists before committing foreign key constraints
  async verifyAndGetBranchId(branchId: string | null | undefined): Promise<string> {
    const targetBranch = branchId && branchId.trim() !== '' ? branchId : 'main';
    try {
      // First, check if the branch actually exists in the DB
      const { data, error } = await supabase.from('branches').select('id').eq('id', targetBranch);
      if (!error && data && data.length > 0) {
        return targetBranch;
      }
      
      // If it doesn't exist, try to dynamically create it to self-heal
      let name = `${targetBranch.charAt(0).toUpperCase() + targetBranch.slice(1)} Branch`;
      let code = 'B01';
      let location = 'Local';
      if (targetBranch === 'main') {
        name = 'Ratauli Head Office';
        code = 'C01';
        location = 'Ratauli';
      } else if (targetBranch === 'sahodba') {
        name = 'Sahodba Branch';
        code = 'C02';
        location = 'Sahodba';
      } else if (targetBranch === 'pipra') {
        name = 'Pipra Branch';
        code = 'C03';
        location = 'Pipra';
      } else if (targetBranch === 'parsa') {
        name = 'Parsa Branch';
        code = 'C04';
        location = 'Parsa';
      }
      
      await supabase.from('branches').upsert({
        id: targetBranch,
        name,
        code,
        location,
        status: 'Active'
      }).catch(e => console.warn("Notice upserting branch:", e));

    } catch (e) {
      console.warn("Notice in verifyAndGetBranchId helper:", e);
    }
    return targetBranch;
  },

  // Notices
  async getNotices(branchId?: string): Promise<Notice[]> {
    const targetNorm = normalizeBranchId(branchId);
    return fetchWithCache(`notices_${targetNorm}`, async () => {
      let remoteNotices: Notice[] = [];
      try {
        let query = supabase.from('notices').select('*');
        if (branchId) {
          query = query.or(`branch_id.eq.${branchId},branch_id.is.null,branch_id.eq.main`);
        }
        const queryRes = await query;
        let data = queryRes.data;
        const error = queryRes.error;
        if (error) {
          console.warn("Notice query filtered error, fetching all notices:", error.message);
          const { data: allData, error: allErr } = await supabase.from('notices').select('*');
          if (!allErr && allData) {
            data = allData;
          }
        }

        if (data) {
          remoteNotices = data.map(n => {
            let extDetails = {
              description: n.description || n.content || '',
              date: n.date || '',
              attachmentUrl: n.attachment_url || '',
              attachmentName: n.attachment_name || '',
              attachmentType: n.attachment_type || n.type
            };
            
            if (n.content && typeof n.content === 'string' && n.content.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(n.content);
                if (parsed && typeof parsed === 'object') {
                  extDetails = {
                    description: parsed.description || extDetails.description,
                    date: parsed.date || extDetails.date,
                    attachmentUrl: parsed.attachmentUrl || extDetails.attachmentUrl,
                    attachmentName: parsed.attachmentName || extDetails.attachmentName,
                    attachmentType: parsed.attachmentType || extDetails.attachmentType
                  };
                }
              } catch (e) {
                console.warn("Notice parsing content JSON:", e);
              }
            }

            let parsedCreatedAt = Date.now();
            if (n.created_at) {
              if (!isNaN(Number(n.created_at))) {
                parsedCreatedAt = Number(n.created_at);
              } else {
                const dt = new Date(n.created_at).getTime();
                if (!isNaN(dt)) parsedCreatedAt = dt;
              }
            }
            
            return {
              id: String(n.id),
              title: String(n.title || ''),
              date: extDetails.date || new NepaliDate(new Date(parsedCreatedAt)).format('YYYY-MM-DD'),
              description: extDetails.description || '',
              attachmentUrl: extDetails.attachmentUrl || undefined,
              attachmentName: extDetails.attachmentName || undefined,
              attachmentType: extDetails.attachmentType,
              status: (n.status || 'Active') as 'Active' | 'Archived',
              branchId: n.branch_id || 'main',
              createdAt: parsedCreatedAt
            } as Notice;
          });
        }
      } catch (e) {
        console.warn("Falling back to localStorage for getNotices query:", e);
      }

      // Merge remote items with local items so newly created local notices are never lost
      const local = getLocalDB<Notice[]>('notices', []);
      const map = new Map<string, Notice>();

      remoteNotices.forEach(n => map.set(n.id, n));
      local.forEach(n => {
        if (!n || !n.id) return;
        if (branchId && n.branchId && n.branchId !== branchId && n.branchId !== 'all') return;
        if (!map.has(n.id)) {
          map.set(n.id, n);
        }
      });

      const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      saveLocalDB('notices', merged);
      if (branchId) {
        return merged.filter(n => (n.branchId || 'main') === branchId || n.branchId === 'all');
      }
      return merged;
    }, { ttlMs: 45000, fallbackLocalKey: 'notices' });
  },
  async saveNotice(notice: Notice) {
    invalidateMemoryCache('notices');
    const payload = {
      description: notice.description,
      date: notice.date,
      attachmentUrl: notice.attachmentUrl,
      attachmentName: notice.attachmentName,
      attachmentType: notice.attachmentType
    };
    const finalBranchId = await this.verifyAndGetBranchId(notice.branchId).catch(() => notice.branchId || 'main');
    
    // Save locally first
    const local = getLocalDB<Notice[]>('notices', []);
    const updated = [notice, ...local.filter(n => n.id !== notice.id)];
    saveLocalDB('notices', updated);

    // Attempt 1: All columns including direct fields, JSON content, numeric created_at
    let { error } = await supabase.from('notices').upsert({
      id: notice.id,
      title: notice.title,
      content: JSON.stringify(payload),
      description: notice.description || '',
      date: notice.date || '',
      attachment_url: notice.attachmentUrl || null,
      attachment_name: notice.attachmentName || null,
      attachment_type: notice.attachmentType || null,
      type: notice.attachmentType || 'other',
      status: notice.status || 'Active',
      created_at: notice.createdAt || Date.now(),
      branch_id: finalBranchId
    });

    if (!error) return;
    console.warn("Notice upsert 1 warning, trying fallback 2:", error.message);

    // Attempt 2: ISO string created_at
    ({ error } = await supabase.from('notices').upsert({
      id: notice.id,
      title: notice.title,
      content: JSON.stringify(payload),
      description: notice.description || '',
      date: notice.date || '',
      attachment_url: notice.attachmentUrl || null,
      attachment_name: notice.attachmentName || null,
      attachment_type: notice.attachmentType || null,
      type: notice.attachmentType || 'other',
      status: notice.status || 'Active',
      created_at: new Date(notice.createdAt || Date.now()).toISOString(),
      branch_id: finalBranchId
    }));

    if (!error) return;
    console.warn("Notice upsert 2 warning, trying fallback 3 (without branch_id):", error.message);

    // Attempt 3: Without branch_id
    ({ error } = await supabase.from('notices').upsert({
      id: notice.id,
      title: notice.title,
      content: JSON.stringify(payload),
      description: notice.description || '',
      date: notice.date || '',
      attachment_url: notice.attachmentUrl || null,
      attachment_name: notice.attachmentName || null,
      attachment_type: notice.attachmentType || null,
      type: notice.attachmentType || 'other',
      status: notice.status || 'Active'
    }));

    if (!error) return;
    console.warn("Notice upsert 3 warning, trying fallback 4:", error.message);

    // Attempt 4: Minimal fields
    ({ error } = await supabase.from('notices').upsert({
      id: notice.id,
      title: notice.title,
      content: JSON.stringify(payload)
    }));

    if (error) {
      console.error("All notice upsert attempts failed in Supabase:", error.message);
      throw new Error(`Notice Supabase Error: ${error.message}`);
    }
  },
  async deleteNotice(id: string) {
    invalidateMemoryCache('notices');
    const local = getLocalDB<Notice[]>('notices', []);
    saveLocalDB('notices', local.filter(n => n.id !== id));
    try {
      const { error } = await supabase.from('notices').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete notice from Supabase, deleted locally:", e);
    }
  },

  // Popup Notices & Login Announcements
  async getPopupNotices(branchId?: string): Promise<PopupNotice[]> {
    const rawLocal = getLocalDB<PopupNotice[]>('popup_notices', []);
    const cleanImg = (url?: string) => (url && !url.startsWith('[TRUNCATED') && url.trim().length > 0 ? url : undefined);
    
    const local = rawLocal.map(p => ({
      ...p,
      imageUrl: cleanImg(p.imageUrl)
    }));

    const map = new Map<string, PopupNotice>();
    // Add local first
    local.forEach(p => map.set(p.id, p));

    try {
      // 1. Check remote notices table
      const { data } = await supabase.from('notices').select('*');
      if (data && Array.isArray(data)) {
        data.forEach(n => {
          let extra: any = {};
          const isExplicitPopup = String(n.type || '').toLowerCase().includes('popup');
          let hasPopupPayload = false;

          if (n.content && typeof n.content === 'string' && n.content.trim().startsWith('{')) {
            try {
              extra = JSON.parse(n.content);
              if (extra.showOnLogin !== undefined || extra.message !== undefined || isExplicitPopup) {
                hasPopupPayload = true;
              }
            } catch {
              // Ignore JSON parse errors for non-JSON content
            }
          }

          if (isExplicitPopup || hasPopupPayload) {
            let parsedCreatedAt = Date.now();
            if (n.created_at) {
              if (!isNaN(Number(n.created_at))) {
                parsedCreatedAt = Number(n.created_at);
              } else {
                const dt = new Date(n.created_at).getTime();
                if (!isNaN(dt)) parsedCreatedAt = dt;
              }
            }

            const noticeId = String(n.id);
            const existing = map.get(noticeId);
            const remotePopup: PopupNotice = {
              id: noticeId,
              title: String(n.title || extra.title || 'Official Announcement'),
              message: String(extra.message || n.description || n.content || ''),
              imageUrl: cleanImg(extra.imageUrl) || cleanImg(n.attachment_url) || cleanImg(existing?.imageUrl),
              imageName: extra.imageName || n.attachment_name || existing?.imageName,
              priority: extra.priority || 'Normal',
              targetBranchId: extra.targetBranchId || n.branch_id || 'all',
              isActive: extra.isActive !== undefined ? Boolean(extra.isActive) : ((n.status || '').toLowerCase() === 'active'),
              date: extra.date || n.date || '',
              validUntil: extra.validUntil || existing?.validUntil,
              showOnLogin: extra.showOnLogin !== undefined ? Boolean(extra.showOnLogin) : true,
              actionButtonText: extra.actionButtonText || 'I Acknowledge',
              createdAt: parsedCreatedAt,
              updatedAt: extra.updatedAt || Date.now(),
              createdBy: extra.createdBy || 'Admin'
            };
            map.set(noticeId, remotePopup);
          }
        });
      }
    } catch (e) {
      console.warn("Error fetching remote popup notices:", e);
    }

    // 2. Also check daily_data store for backup
    try {
      const { data: storeData } = await supabase.from('daily_data').select('data').eq('id', 'POPUP_NOTICES_STORE').maybeSingle();
      if (storeData?.data?.notices && Array.isArray(storeData.data.notices)) {
        storeData.data.notices.forEach((p: PopupNotice) => {
          const existing = map.get(p.id);
          map.set(p.id, {
            ...p,
            imageUrl: cleanImg(p.imageUrl) || cleanImg(existing?.imageUrl),
            imageName: p.imageName || existing?.imageName
          });
        });
      }
    } catch {
      // Ignore fallback store errors
    }

    const merged = Array.from(map.values()).sort((a, b) => {
      const timeA = Math.max(a.createdAt || 0, a.updatedAt || 0);
      const timeB = Math.max(b.createdAt || 0, b.updatedAt || 0);
      return timeB - timeA;
    });

    saveLocalDB('popup_notices', merged);

    if (branchId && branchId !== 'all') {
      return merged.filter(p => !p.targetBranchId || p.targetBranchId === 'all' || isBranchMatch(p.targetBranchId, branchId));
    }
    return merged;
  },

  async savePopupNotice(notice: PopupNotice): Promise<void> {
    const local = getLocalDB<PopupNotice[]>('popup_notices', []);
    const updated = [notice, ...local.filter(p => p.id !== notice.id)];
    saveLocalDB('popup_notices', updated);

    // Try syncing to Supabase notices table with type='popup'
    try {
      const payload = {
        title: notice.title,
        message: notice.message,
        imageUrl: notice.imageUrl,
        imageName: notice.imageName,
        priority: notice.priority || 'Normal',
        targetBranchId: notice.targetBranchId || 'all',
        isActive: notice.isActive,
        date: notice.date,
        validUntil: notice.validUntil,
        showOnLogin: notice.showOnLogin !== false,
        actionButtonText: notice.actionButtonText || 'I Acknowledge',
        createdAt: notice.createdAt,
        updatedAt: Date.now(),
        createdBy: notice.createdBy
      };

      const finalBranchId = notice.targetBranchId === 'all' ? 'main' : (normalizeBranchId(notice.targetBranchId) || 'main');
      const isoCreatedAt = new Date(notice.createdAt || Date.now()).toISOString();

      // Attempt 1: ISO string timestamp
      let { error } = await supabase.from('notices').upsert({
        id: notice.id,
        title: notice.title,
        content: JSON.stringify(payload),
        description: notice.message,
        date: notice.date || '',
        attachment_url: notice.imageUrl || null,
        attachment_name: notice.imageName || null,
        attachment_type: 'image',
        type: 'popup',
        status: notice.isActive ? 'Active' : 'Archived',
        branch_id: finalBranchId,
        created_at: isoCreatedAt
      });

      // Attempt 2: Numeric timestamp fallback
      if (error) {
        ({ error } = await supabase.from('notices').upsert({
          id: notice.id,
          title: notice.title,
          content: JSON.stringify(payload),
          description: notice.message,
          date: notice.date || '',
          attachment_url: notice.imageUrl || null,
          attachment_name: notice.imageName || null,
          attachment_type: 'image',
          type: 'popup',
          status: notice.isActive ? 'Active' : 'Archived',
          branch_id: finalBranchId,
          created_at: notice.createdAt || Date.now()
        }));
      }

      // Attempt 3: Minimal fields
      if (error) {
        ({ error } = await supabase.from('notices').upsert({
          id: notice.id,
          title: notice.title,
          content: JSON.stringify(payload),
          description: notice.message,
          type: 'popup',
          status: notice.isActive ? 'Active' : 'Archived'
        }));
      }
    } catch (e) {
      console.warn("Supabase popup notice sync fallback to local storage:", e);
    }

    // Dual-save into daily_data table to ensure persistence
    try {
      await supabase.from('daily_data').upsert({
        id: 'POPUP_NOTICES_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { notices: updated }
      });
    } catch (e) {
      console.warn("daily_data popup notices store upsert error:", e);
    }

    try {
      window.dispatchEvent(new CustomEvent('saccos_popup_notice_updated', { detail: notice }));
    } catch {
      // Ignore custom event dispatch errors in SSR or headless environments
    }
  },

  async deletePopupNotice(id: string): Promise<void> {
    const local = getLocalDB<PopupNotice[]>('popup_notices', []);
    const updated = local.filter(p => p.id !== id);
    saveLocalDB('popup_notices', updated);
    try {
      await supabase.from('notices').delete().eq('id', id);
    } catch (e) {
      console.warn("Failed to delete popup notice remotely:", e);
    }
    try {
      await supabase.from('daily_data').upsert({
        id: 'POPUP_NOTICES_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { notices: updated }
      });
    } catch {
      // Ignore store upsert errors on delete
    }
    try {
      window.dispatchEvent(new CustomEvent('saccos_popup_notice_updated', { detail: { id, deleted: true } }));
    } catch {
      // Ignore custom event dispatch errors
    }
  },

  async togglePopupNoticeStatus(id: string, isActive: boolean): Promise<void> {
    const local = getLocalDB<PopupNotice[]>('popup_notices', []);
    const target = local.find(p => p.id === id);
    if (target) {
      target.isActive = isActive;
      target.updatedAt = Date.now();
      await this.savePopupNotice(target);
    }
  },

  // Documents
  async getDocuments(branchId?: string): Promise<DownloadableDocument[]> {
    const targetNorm = normalizeBranchId(branchId);
    return fetchWithCache(`documents_${targetNorm}`, async () => {
      let remoteDocs: DownloadableDocument[] = [];
      try {
        let query = supabase.from('downloadable_documents').select('*');
        if (branchId) {
          query = query.or(`branch_id.eq.${branchId},branch_id.is.null,branch_id.eq.main`);
        }
        const queryRes = await query;
        let data = queryRes.data;
        const error = queryRes.error;
        if (error) {
          console.warn("Documents query filtered warning, fetching all documents:", error.message);
          const { data: allData, error: allErr } = await supabase.from('downloadable_documents').select('*');
          if (!allErr && allData) {
            data = allData;
          }
        }

        if (data) {
          remoteDocs = data.map(d => {
            let fileName = d.file_name || d.size || '';
            let date = d.date || '';
            if (d.size && typeof d.size === 'string' && d.size.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(d.size);
                if (parsed.fileName) fileName = parsed.fileName;
                if (parsed.date) date = parsed.date;
              } catch (e) {
                fileName = d.size;
              }
            }

            let parsedCreatedAt = Date.now();
            const rawDate = d.uploaded_at || d.created_at;
            if (rawDate) {
              if (!isNaN(Number(rawDate))) {
                parsedCreatedAt = Number(rawDate);
              } else {
                const dt = new Date(rawDate).getTime();
                if (!isNaN(dt)) parsedCreatedAt = dt;
              }
            }

            return {
              id: String(d.id),
              title: String(d.title || ''),
              category: String(d.category || 'Official Policy'),
              date: date || new NepaliDate(new Date(parsedCreatedAt)).format('YYYY-MM-DD'),
              fileUrl: d.file_url || d.url || '',
              fileName: fileName || 'document.pdf',
              fileType: (d.file_type || d.type || 'other') as 'image' | 'pdf' | 'other',
              branchId: d.branch_id || 'main',
              createdAt: parsedCreatedAt
            };
          });
        }
      } catch (e) {
        console.warn("Falling back to localStorage for getDocuments query:", e);
      }

      // Merge remote items with local items so newly uploaded local documents are never lost
      const local = getLocalDB<DownloadableDocument[]>('documents', []);
      const map = new Map<string, DownloadableDocument>();

      remoteDocs.forEach(d => map.set(d.id, d));
      local.forEach(d => {
        if (!d || !d.id) return;
        if (branchId && d.branchId && d.branchId !== branchId && d.branchId !== 'all') return;
        if (!map.has(d.id)) {
          map.set(d.id, d);
        }
      });

      const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      saveLocalDB('documents', merged);
      if (branchId) {
        return merged.filter(d => (d.branchId || 'main') === branchId || d.branchId === 'all');
      }
      return merged;
    }, { ttlMs: 45000, fallbackLocalKey: 'documents' });
  },
  async saveDocument(doc: DownloadableDocument) {
    invalidateMemoryCache('documents');
    const sizePayload = {
      fileName: doc.fileName,
      date: doc.date
    };
    const finalBranchId = await this.verifyAndGetBranchId(doc.branchId).catch(() => doc.branchId || 'main');
    
    // Save locally first
    const local = getLocalDB<DownloadableDocument[]>('documents', []);
    const updated = [doc, ...local.filter(d => d.id !== doc.id)];
    saveLocalDB('documents', updated);

    // Attempt 1: Full payload including direct columns and size JSON + numeric uploaded_at
    let { error } = await supabase.from('downloadable_documents').upsert({
      id: doc.id,
      title: doc.title,
      category: doc.category || '',
      url: doc.fileUrl || '',
      file_url: doc.fileUrl || '',
      file_name: doc.fileName || '',
      file_type: doc.fileType || 'other',
      date: doc.date || '',
      size: JSON.stringify(sizePayload),
      type: doc.fileType || 'other',
      uploaded_at: doc.createdAt || Date.now(),
      branch_id: finalBranchId
    });

    if (!error) return;
    console.warn("Document upsert 1 warning, trying fallback 2 (file_url standard schema):", error.message);

    // Attempt 2: Standard file_url schema without 'url' column (matches supabase_full_schema.sql)
    ({ error } = await supabase.from('downloadable_documents').upsert({
      id: doc.id,
      title: doc.title,
      category: doc.category || '',
      file_url: doc.fileUrl || '',
      file_name: doc.fileName || '',
      file_type: doc.fileType || 'other',
      date: doc.date || '',
      size: JSON.stringify(sizePayload),
      type: doc.fileType || 'other',
      uploaded_at: doc.createdAt || Date.now(),
      branch_id: finalBranchId
    }));

    if (!error) return;
    console.warn("Document upsert 2 warning, trying fallback 3 (file_url without branch_id):", error.message);

    // Attempt 3: Standard schema without branch_id
    ({ error } = await supabase.from('downloadable_documents').upsert({
      id: doc.id,
      title: doc.title,
      category: doc.category || '',
      file_url: doc.fileUrl || '',
      file_name: doc.fileName || '',
      file_type: doc.fileType || 'other',
      size: JSON.stringify(sizePayload),
      uploaded_at: doc.createdAt || Date.now()
    }));

    if (!error) return;
    console.warn("Document upsert 3 warning, trying minimal fallback 4 (file_url):", error.message);

    // Attempt 4: Minimal file_url payload
    ({ error } = await supabase.from('downloadable_documents').upsert({
      id: doc.id,
      title: doc.title,
      file_url: doc.fileUrl || ''
    }));

    if (!error) return;
    console.warn("Document upsert 4 warning, trying minimal fallback 5 (url):", error.message);

    // Attempt 5: Minimal url payload (if table has 'url' instead of 'file_url')
    ({ error } = await supabase.from('downloadable_documents').upsert({
      id: doc.id,
      title: doc.title,
      url: doc.fileUrl || ''
    }));

    if (!error) return;
    console.warn("Document upsert 5 warning, trying minimal fallback 6 (id & title):", error.message);

    // Attempt 6: Bare minimum payload (id, title)
    ({ error } = await supabase.from('downloadable_documents').upsert({
      id: doc.id,
      title: doc.title
    }));

    if (error) {
      console.warn("All document upsert attempts failed in Supabase, document is saved locally:", error.message);
    }
  },
  async deleteDocument(id: string) {
    invalidateMemoryCache('documents');
    const local = getLocalDB<DownloadableDocument[]>('documents', []);
    saveLocalDB('documents', local.filter(d => d.id !== id));
    try {
      const { error } = await supabase.from('downloadable_documents').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete document from Supabase, deleted locally:", e);
    }
  },

  // Employees
  async getEmployees(branchId?: string): Promise<Employee[]> {
    const targetNorm = normalizeBranchId(branchId);
    return fetchWithCache(`employees_${targetNorm}`, async () => {
      try {
        // Always query all employees from Supabase so full directory is cached
        const { data, error } = await supabase.from('employees').select('*');
        if (error) {
          console.warn("Supabase employees table query warning:", error.message);
        }

        // Fetch rich KYC details & document attachments stored in Supabase settings
        let kycMap: Record<string, any> = {};
        
        // 1. Fetch individual employee KYC records (guaranteed not to hit row size limits)
        try {
          const { data: indKycRecords } = await supabase
            .from('settings')
            .select('id, data')
            .like('id', 'employee_kyc_%');
          if (indKycRecords && Array.isArray(indKycRecords)) {
            indKycRecords.forEach(rec => {
              if (rec.id && rec.data && rec.id !== 'employee_kyc_store') {
                const eId = rec.id.replace('employee_kyc_', '');
                kycMap[eId] = rec.data;
                if (rec.data.employeeCode) {
                  kycMap[rec.data.employeeCode] = rec.data;
                }
              }
            });
          }
        } catch (e) {
          console.warn("Could not fetch individual employee_kyc_% from Supabase:", e);
        }

        // 2. Also check aggregated employee_kyc_store
        try {
          const { data: kycRecord } = await supabase.from('settings').select('data').eq('id', 'employee_kyc_store').maybeSingle();
          if (kycRecord?.data && typeof kycRecord.data === 'object') {
            kycMap = { ...kycRecord.data, ...kycMap };
          }
        } catch (e) {
          console.warn("Could not fetch employee_kyc_store from Supabase:", e);
        }

        const employees = (data || []).map(e => {
          const extraKyc = kycMap[e.id] || (e.employee_code ? kycMap[e.employee_code] : {}) || {};
          return {
            ...e,
            ...extraKyc,
            id: e.id,
            fullName: extraKyc.fullName || e.full_name,
            employeeCode: extraKyc.employeeCode || e.employee_code,
            mobile: extraKyc.mobile || e.mobile,
            email: extraKyc.email || e.email,
            department: extraKyc.department || e.department,
            branchId: extraKyc.branchId || e.branch_id,
            designation: extraKyc.designation || e.designation,
            joinedDate: extraKyc.joinedDate || e.joined_date,
            basicSalary: Number(extraKyc.basicSalary ?? e.basic_salary) || 0,
            daType: extraKyc.daType || e.da_type,
            daValue: Number(extraKyc.daValue ?? e.da_value) || 0,
            dearnessAllowance: Number(extraKyc.dearnessAllowance ?? e.dearness_allowance) || 0,
            gradeRate: Number(extraKyc.gradeRate ?? e.grade_rate) || 0,
            gradeRateAmount: Number(extraKyc.gradeRateAmount ?? e.grade_rate_amount) || 0,
            hasSSF: Boolean(extraKyc.hasSSF ?? e.has_ssf),
            ssfContribution: Number(extraKyc.ssfContribution ?? e.ssf_contribution) || 0,
            hasPF: Boolean(extraKyc.hasPF ?? e.has_pf),
            pfContribution: Number(extraKyc.pfContribution ?? e.pf_contribution) || 0,
            hasGratuity: Boolean(extraKyc.hasGratuity ?? e.has_gratuity),
            gratuity: Number(extraKyc.gratuity ?? e.gratuity) || 0,
            hasDashain: Boolean(extraKyc.hasDashain ?? e.has_dashain),
            dashainBonus: Number(extraKyc.dashainBonus ?? e.dashain_bonus) || 0,
            hasMedical: Boolean(extraKyc.hasMedical ?? e.has_medical),
            medicalAllowance: Number(extraKyc.medicalAllowance ?? e.medical_allowance) || 0,
            hasBonus: Boolean(extraKyc.hasBonus ?? e.has_bonus),
            panNo: extraKyc.panNo || e.pan_no,
            photoUrl: extraKyc.photoUrl || e.photo_url,
            gender: extraKyc.gender || e.gender || 'Male',
            maritalStatus: extraKyc.maritalStatus || e.marital_status || 'Single',
            monthsActive: Number(extraKyc.monthsActive ?? e.months_active) || 12,
            festivalBonus: extraKyc.festivalBonus || e.festival_bonus,
            sanchitLeaveAmount: Number(extraKyc.sanchitLeaveAmount ?? e.festival_bonus) || 0,
            sanchitLeaveDays: extraKyc.sanchitLeaveDays || (e.basic_salary > 0 ? Math.round(((e.festival_bonus || 0) / e.basic_salary) * 30) : 0),
            bonusYearly: Number(extraKyc.bonusYearly ?? e.bonus_yearly) || 0,
            employmentType: extraKyc.employmentType || e.employment_type || 'Permanent',
            lifeInsurance: Number(extraKyc.lifeInsurance ?? e.life_insurance) || 0,
            hasLifeInsurance: Boolean(extraKyc.hasLifeInsurance ?? e.has_life_insurance),
            healthInsurance: Number(extraKyc.healthInsurance ?? e.health_insurance) || 0,
            hasHealthInsurance: Boolean(extraKyc.hasHealthInsurance ?? e.has_health_insurance),
            buildingInsurance: Number(extraKyc.buildingInsurance ?? e.building_insurance) || 0,
            buildingAllowance: Number(extraKyc.buildingAllowance ?? e.building_allowance) || 0,
            hasBuildingAllowance: Boolean(extraKyc.hasBuildingAllowance ?? e.has_building_allowance),
            medicalExpensesPaid: Number(extraKyc.medicalExpensesPaid ?? e.medical_expenses_paid) || 0,
            remoteAreaCategory: extraKyc.remoteAreaCategory || e.remote_area_category || 'None',
            remoteAllowance: Number(extraKyc.remoteAllowance ?? e.remote_allowance) || 0,
            hasRemoteAllowance: Boolean(extraKyc.hasRemoteAllowance ?? e.has_remote_allowance),
            isIncapacitated: Boolean(extraKyc.isIncapacitated ?? e.is_incapacitated),
            dressAllowance: Number(extraKyc.dressAllowance ?? e.dress_allowance) || 0,
            // KYC fields
            citizenshipNo: extraKyc.citizenshipNo || e.citizenship_no,
            citizenshipDistrict: extraKyc.citizenshipDistrict || e.citizenship_district,
            citizenshipIssueDate: extraKyc.citizenshipIssueDate || e.citizenship_issue_date,
            citizenshipFrontUrl: extraKyc.citizenshipFrontUrl || e.citizenship_front_url,
            citizenshipBackUrl: extraKyc.citizenshipBackUrl || e.citizenship_back_url,
            fatherName: extraKyc.fatherName || e.father_name,
            fatherNameNepali: extraKyc.fatherNameNepali || e.father_name_nepali,
            motherName: extraKyc.motherName || e.mother_name,
            motherNameNepali: extraKyc.motherNameNepali || e.mother_name_nepali,
            grandfatherName: extraKyc.grandfatherName || e.grandfather_name,
            grandfatherNameNepali: extraKyc.grandfatherNameNepali || e.grandfather_name_nepali,
            spouseName: extraKyc.spouseName || e.spouse_name,
            spouseNameNepali: extraKyc.spouseNameNepali || e.spouse_name_nepali,
            previousName: extraKyc.previousName || e.previous_name,
            previousNameNepali: extraKyc.previousNameNepali || e.previous_name_nepali,
            fullNameNepali: extraKyc.fullNameNepali || e.full_name_nepali,
            designationNepali: extraKyc.designationNepali || e.designation_nepali,
            departmentNepali: extraKyc.departmentNepali || e.department_nepali,
            dobBs: extraKyc.dobBs || e.dob_bs,
            nationality: extraKyc.nationality || e.nationality || 'Nepali',
            permanentAddress: extraKyc.permanentAddress || e.permanent_address,
            permanentAddressNepali: extraKyc.permanentAddressNepali || e.permanent_address_nepali,
            temporaryAddress: extraKyc.temporaryAddress || e.temporary_address,
            temporaryAddressNepali: extraKyc.temporaryAddressNepali || e.temporary_address_nepali,
            bankName: extraKyc.bankName || e.bank_name,
            bankAccountNo: extraKyc.bankAccountNo || e.bank_account_no,
            accountHolderName: extraKyc.accountHolderName || e.account_holder_name,
            bankBranch: extraKyc.bankBranch || e.bank_branch,
            emergencyContact: extraKyc.emergencyContact || e.emergency_contact,
            emergencyRelation: extraKyc.emergencyRelation || extraKyc.emergency_relation || e.emergency_relation,
            emergencyPhone: extraKyc.emergencyPhone || e.emergency_phone,
            emergencyAddress: extraKyc.emergencyAddress || e.emergency_address,
            bloodGroup: extraKyc.bloodGroup || e.blood_group,
            qualification: extraKyc.qualification || e.qualification,
            institution: extraKyc.institution || e.institution,
            passedYear: extraKyc.passedYear || e.passed_year,
            previousEmployer: extraKyc.previousEmployer || e.previous_employer,
            previousDesignation: extraKyc.previousDesignation || e.previous_designation,
            totalExperience: extraKyc.totalExperience || e.total_experience,
            expJoiningDate: extraKyc.expJoiningDate || e.exp_joining_date,
            expLeavingDate: extraKyc.expLeavingDate || e.exp_leaving_date,
            reportingManager: extraKyc.reportingManager || e.reporting_manager,
            workLocation: extraKyc.workLocation || e.work_location,
            docsCitizenship: extraKyc.docsCitizenship || extraKyc.citizenshipFrontUrl || e.citizenship_front_url,
            docsNid: extraKyc.docsNid,
            docsPan: extraKyc.docsPan,
            docsEducation: extraKyc.docsEducation,
            docsExperience: extraKyc.docsExperience,
            docsContract: extraKyc.docsContract
          };
        });

        // Also check if there are employees in kycMap that were not in employees table
        Object.entries(kycMap).forEach(([kId, kData]) => {
          if (kData && typeof kData === 'object' && kData.fullName && !kData.deleted) {
            const exists = employees.some(e => e.id === kId || (kData.id && e.id === kData.id));
            if (!exists) {
              employees.push({
                ...kData,
                id: kData.id || kId
              });
            }
          }
        });
        const local = getLocalDB<Employee[]>('employees', []);
        const map = new Map<string, Employee>();
        
        // 1. Seed master staff first so full 14 staff including Record #6: SUMIT KUMAR THAKUR are always guaranteed
        OFFICIAL_MASTER_STAFF.forEach(me => {
          map.set(me.id, { ...me });
        });

        // 2. Overlay live Supabase query data
        (employees || []).forEach(e => {
          if (!e) return;
          const key = e.id || e.employeeCode || (e.fullName ? e.fullName.trim().toLowerCase() : '');
          if (key) map.set(key, e);
          if (e.id) map.set(e.id, e);
        });

        // 3. Overlay locally updated data / KYC
        (local || []).forEach(e => {
          if (!e) return;
          const key = e.id || e.employeeCode || (e.fullName ? e.fullName.trim().toLowerCase() : '');
          if (key && !map.has(key)) map.set(key, e);
          if (e.id && !map.has(e.id)) map.set(e.id, e);
        });

        // 4. Double check Record #6: SUMIT KUMAR THAKUR is present
        if (!map.has(SUMIT_KUMAR_THAKUR_RECORD.id)) {
          map.set(SUMIT_KUMAR_THAKUR_RECORD.id, { ...SUMIT_KUMAR_THAKUR_RECORD });
        }

        const merged = deduplicateEmployees(Array.from(map.values()));
        if (merged.length > 0 || local.length === 0) {
          saveLocalDB('employees', merged);
        }
        if (branchId && branchId !== 'all') {
          return merged.filter(e => isBranchMatch(e.branchId, branchId));
        }
        return merged;
      } catch (e) {
        console.warn("Falling back to localStorage for getEmployees:", e);
        const local = getLocalDB<Employee[]>('employees', []);
        const raw = [...(local || []), ...OFFICIAL_MASTER_STAFF, SUMIT_KUMAR_THAKUR_RECORD];
        const merged = deduplicateEmployees(raw);
        saveLocalDB('employees', merged);
        if (branchId && branchId !== 'all') {
          return merged.filter(emp => isBranchMatch(emp.branchId, branchId));
        }
        return merged;
      }
    }, { ttlMs: 15000, fallbackLocalKey: 'employees' });
  },
  async syncAllMasterEmployees(): Promise<Employee[]> {
    invalidateMemoryCache('employees');
    for (const emp of OFFICIAL_MASTER_STAFF) {
      await this.saveEmployee(emp).catch(err => console.warn('Sync master employee warning:', err));
    }
    const result = await this.getEmployees();
    try {
      window.dispatchEvent(new Event('employeesUpdated'));
    } catch (_) {}
    return result;
  },
  async saveEmployee(emp: Employee) {
    invalidateMemoryCache('employees');
    invalidateMemoryCache('ledger_accounts');
    const empId = (emp.id && emp.id.trim() !== '') ? emp.id : safeUUID();
    const verifiedBranchId = await this.verifyAndGetBranchId(emp.branchId);
    const empToSave = { ...emp, id: empId, branchId: verifiedBranchId };

    // 1. Direct database columns for Supabase PostgreSQL 'employees' table
    const validDbPayload = {
      id: empId,
      full_name: emp.fullName,
      employee_code: emp.employeeCode,
      mobile: emp.mobile,
      email: emp.email,
      department: emp.department,
      branch_id: verifiedBranchId,
      designation: emp.designation,
      joined_date: emp.joinedDate,
      basic_salary: emp.basicSalary,
      da_type: emp.daType,
      da_value: emp.daValue,
      dearness_allowance: emp.dearnessAllowance,
      grade_rate: emp.gradeRate,
      grade_rate_amount: emp.gradeRateAmount,
      has_ssf: emp.hasSSF,
      ssf_contribution: emp.ssfContribution,
      has_pf: emp.hasPF,
      pf_contribution: emp.pfContribution,
      has_gratuity: emp.hasGratuity,
      gratuity: emp.gratuity,
      has_dashain: emp.hasDashain,
      dashain_bonus: emp.dashainBonus,
      has_medical: emp.hasMedical,
      medical_allowance: emp.medicalAllowance,
      has_bonus: emp.hasBonus,
      bonus_yearly: emp.bonusYearly,
      pan_no: emp.panNo,
      status: emp.status,
      photo_url: emp.photoUrl,
      gender: emp.gender,
      marital_status: emp.maritalStatus,
      months_active: emp.monthsActive,
      festival_bonus: emp.sanchitLeaveAmount || 0,
      employment_type: emp.employmentType,
      life_insurance: emp.lifeInsurance,
      has_life_insurance: emp.hasLifeInsurance,
      health_insurance: emp.healthInsurance,
      has_health_insurance: emp.hasHealthInsurance,
      building_insurance: emp.buildingInsurance,
      building_allowance: emp.buildingAllowance,
      has_building_allowance: emp.hasBuildingAllowance,
      medical_expenses_paid: emp.medicalExpensesPaid,
      remote_area_category: emp.remoteAreaCategory,
      remote_allowance: emp.remoteAllowance,
      has_remote_allowance: emp.hasRemoteAllowance,
      is_incapacitated: emp.isIncapacitated,
      dress_allowance: emp.dressAllowance || 0,
      // KYC fields matching PostgreSQL columns
      citizenship_no: emp.citizenshipNo,
      citizenship_district: emp.citizenshipDistrict,
      citizenship_issue_date: emp.citizenshipIssueDate,
      citizenship_front_url: emp.citizenshipFrontUrl,
      citizenship_back_url: emp.citizenshipBackUrl,
      father_name: emp.fatherName,
      mother_name: emp.motherName,
      grandfather_name: emp.grandfatherName,
      spouse_name: emp.spouseName,
      dob_bs: emp.dobBs,
      permanent_address: emp.permanentAddress,
      temporary_address: emp.temporaryAddress,
      bank_name: emp.bankName,
      bank_account_no: emp.bankAccountNo,
      account_holder_name: emp.accountHolderName,
      bank_branch: emp.bankBranch,
      full_name_nepali: emp.fullNameNepali,
      designation_nepali: emp.designationNepali,
      department_nepali: emp.departmentNepali,
      emergency_contact: emp.emergencyContact,
      emergency_phone: emp.emergencyPhone,
      blood_group: emp.bloodGroup,
      qualification: emp.qualification
    };

    // Save locally first
    const local = getLocalDB<Employee[]>('employees', []);
    const updated = [empToSave, ...local.filter(e => {
      if (!e) return false;
      if (e.id && e.id === empId) return false;
      if (e.fullName && emp.fullName && e.fullName.trim().toLowerCase() === emp.fullName.trim().toLowerCase()) return false;
      return true;
    })];
    saveLocalDB('employees', updated);

    // Auto sync staff ledger account
    try {
      const localAccs = getLocalDB<LedgerAccount[]>('ledger_accounts', []);
      const matchedIdx = localAccs.findIndex(a => 
        (a.employeeId && a.employeeId === empId) ||
        (a.employeeCode && emp.employeeCode && a.employeeCode.trim().toLowerCase() === emp.employeeCode.trim().toLowerCase()) ||
        (a.name && emp.fullName && a.name.trim().toLowerCase() === emp.fullName.trim().toLowerCase())
      );
      if (matchedIdx >= 0) {
        localAccs[matchedIdx] = {
          ...localAccs[matchedIdx],
          name: emp.fullName.trim(),
          branchId: emp.branchId || 'main',
          employeeBranchId: emp.branchId || 'main',
          employeeId: empId,
          employeeCode: emp.employeeCode || localAccs[matchedIdx].employeeCode,
          type: 'Staff',
          mobile: emp.mobile || localAccs[matchedIdx].mobile,
          status: emp.status === 'Inactive' ? 'Closed' : 'Active'
        };
      } else {
        const newStaffAcc: LedgerAccount = {
          id: `staff_${empId}`,
          name: emp.fullName.trim(),
          branchId: emp.branchId || 'main',
          openingBalance: 0,
          initialBalance: 0,
          status: emp.status === 'Inactive' ? 'Closed' : 'Active',
          createdAt: Date.now(),
          type: 'Staff',
          interestRate: 0,
          mobile: emp.mobile || '',
          address: emp.permanentAddress || emp.temporaryAddress || '',
          capitalizationFrequency: 'None',
          capitalizeToPrincipal: true,
          employeeId: empId,
          employeeBranchId: emp.branchId || 'main',
          employeeCode: emp.employeeCode || ''
        };
        localAccs.unshift(newStaffAcc);
      }
      saveLocalDB('ledger_accounts', localAccs);
      window.dispatchEvent(new Event('ledgerAccountsUpdated'));
    } catch (e) {}

    // Persist to Supabase:
    // A. Upsert to 'employees' table in Supabase (with automatic schema fallback if extra columns don't exist)
    try {
      const { error: dbError } = await supabase.from('employees').upsert(validDbPayload);
      if (dbError) {
        console.warn('Supabase employees full upsert warning, retrying with core columns:', dbError.message);
        const basePayload = {
          id: empId,
          full_name: emp.fullName,
          employee_code: emp.employeeCode,
          mobile: emp.mobile,
          email: emp.email,
          department: emp.department,
          branch_id: (emp.branchId && emp.branchId.trim() !== '') ? emp.branchId : null,
          designation: emp.designation,
          joined_date: emp.joinedDate,
          basic_salary: emp.basicSalary,
          status: emp.status || 'Active',
          pan_no: emp.panNo,
          photo_url: emp.photoUrl,
          gender: emp.gender || 'Male',
          marital_status: emp.maritalStatus || 'Single',
          employment_type: emp.employmentType || 'Permanent'
        };
        const { error: baseError } = await supabase.from('employees').upsert(basePayload);
        if (baseError) {
          console.warn('Supabase employees base upsert warning:', baseError.message);
        } else {
          console.log('✅ Employee core record saved successfully to Supabase employees table');
        }
      } else {
        console.log('✅ Employee saved successfully to Supabase employees table');
      }
    } catch (dbEx) {
      console.warn('Failed to upsert to Supabase employees table:', dbEx);
    }

    // B. Persist individual employee KYC bundle into Supabase 'settings' under 'employee_kyc_${empId}'
    // This guarantees no row size limit collision with other employees' documents!
    try {
      const { error: indError } = await supabase.from('settings').upsert({
        id: `employee_kyc_${empId}`,
        data: empToSave,
        updated_at: new Date().toISOString()
      });
      if (indError) {
        console.warn(`Supabase employee_kyc_${empId} upsert warning:`, indError.message);
      } else {
        console.log(`✅ Individual employee KYC bundle saved to Supabase settings for ${empId}`);
      }
    } catch (indEx) {
      console.warn(`Failed to save employee_kyc_${empId}:`, indEx);
    }

    // C. Also maintain aggregated 'employee_kyc_store' for backward compatibility
    try {
      const { data: storeData } = await supabase.from('settings').select('data').eq('id', 'employee_kyc_store').maybeSingle();
      const currentStore = (storeData?.data && typeof storeData.data === 'object') ? storeData.data : {};
      currentStore[empId] = {
        ...empToSave,
        updatedAt: new Date().toISOString()
      };
      const { error: storeError } = await supabase.from('settings').upsert({
        id: 'employee_kyc_store',
        data: currentStore,
        updated_at: new Date().toISOString()
      });
      if (storeError) {
        console.warn('Supabase employee_kyc_store aggregate upsert warning:', storeError.message);
      }
    } catch (storeEx) {
      console.warn('Aggregated store error (non-fatal as individual record is saved):', storeEx);
    }

    try {
      window.dispatchEvent(new Event('employeesUpdated'));
    } catch (e) {}
  },
  async deleteEmployee(id: string) {
    const local = getLocalDB<Employee[]>('employees', []);
    saveLocalDB('employees', local.filter(e => e.id !== id));
    try {
      window.dispatchEvent(new Event('employeesUpdated'));
    } catch (e) {}
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete employee from Supabase, deleted locally:", e);
    }
    // Clean up individual KYC record
    try {
      await supabase.from('settings').delete().eq('id', `employee_kyc_${id}`);
    } catch (e) {}
    // Also clean up from aggregated employee_kyc_store
    try {
      const { data: storeData } = await supabase.from('settings').select('data').eq('id', 'employee_kyc_store').maybeSingle();
      if (storeData?.data && storeData.data[id]) {
        delete storeData.data[id];
        await supabase.from('settings').upsert({
          id: 'employee_kyc_store',
          data: storeData.data,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {}
    // Clean up associated payroll records
    try {
      await supabase.from('payroll_records').delete().eq('employee_id', id);
    } catch (e) {
      console.warn("Could not delete payroll_records remotely for employee:", id, e);
    }
    try {
      const localPR = getLocalDB<PayrollRecord[]>('payroll_records', []);
      saveLocalDB('payroll_records', localPR.filter(pr => (pr.employeeId || pr.employeeId) !== id));
      invalidateMemoryCache('payroll_records');
    } catch (e) {
      console.warn("Could not delete payroll_records locally for employee:", id, e);
    }
  },

  // Leave Types
  async getLeaveTypes(): Promise<LeaveType[]> {
    return fetchWithCache('leave_types', async () => {
      try {
        const { data, error } = await supabase.from('leave_types').select('*');
        if (error) throw error;
        const local = getLocalDB<LeaveType[]>('leave_types', []);
        const parsed = data.map(lt => {
          const localMatch = local.find(l => l.id === lt.id);
          return {
            ...lt,
            nameNp: lt.name_np,
            totalDays: lt.total_days,
            isOneTime: lt.is_one_time,
            genderSpecific: lt.gender_specific,
            leaveType: localMatch?.leaveType || 'Paid',
            reserveLeave: localMatch?.reserveLeave !== undefined ? localMatch.reserveLeave : 'No',
            nonReserveLeave: localMatch?.nonReserveLeave !== undefined ? localMatch.nonReserveLeave : ''
          };
        });
        saveLocalDB('leave_types', parsed);
        return parsed;
      } catch (e) {
        console.warn("Falling back to localStorage for getLeaveTypes:", e);
        return getLocalDB<LeaveType[]>('leave_types', []);
      }
    }, { ttlMs: 60000, fallbackLocalKey: 'leave_types' });
  },
  async saveLeaveType(lt: LeaveType) {
    invalidateMemoryCache('leave_types');
    const local = getLocalDB<LeaveType[]>('leave_types', []);
    const updated = [lt, ...local.filter(t => t.id !== lt.id)];
    saveLocalDB('leave_types', updated);

    try {
      const { error } = await supabase.from('leave_types').upsert({
        id: lt.id,
        name: lt.name,
        name_np: lt.nameNp || lt.name,
        total_days: lt.totalDays,
        is_one_time: lt.isOneTime || false,
        gender_specific: lt.genderSpecific || null
      });
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to save leave type to Supabase, saved locally:", e);
    }
  },
  async deleteLeaveType(id: string) {
    invalidateMemoryCache('leave_types');
    const local = getLocalDB<LeaveType[]>('leave_types', []);
    const updated = local.filter(t => t.id !== id);
    saveLocalDB('leave_types', updated);

    try {
      const { error } = await supabase.from('leave_types').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete leave type from Supabase, deleted locally:", e);
    }
  },

  // Leave Requests
  async getLeaveRequests(branchId?: string): Promise<LeaveRequest[]> {
    const cacheKey = `leave_requests_${branchId || 'all'}`;
    return fetchWithCache(cacheKey, async () => {
      try {
        let query = supabase.from('leave_requests').select('*');
        if (branchId) query = query.eq('branch_id', branchId);
        const { data, error } = await query;
        if (error) throw error;
        const parsed = data.map(lr => ({
          ...lr,
          employeeId: lr.employee_id,
          leaveTypeId: lr.leave_type_id,
          startDate: lr.start_date,
          endDate: lr.end_date,
          days: lr.total_days,
          totalDays: lr.total_days,
          appliedDate: lr.applied_date,
          approvedBy: lr.approved_by,
          branchId: lr.branch_id || 'main'
        }));
        const local = getLocalDB<LeaveRequest[]>('leave_requests', []);
        const deletedIds = new Set(getLocalDB<string[]>('deleted_leave_ids', []));
        const validParsed = parsed.filter(r => !deletedIds.has(r.id));
        const validLocal = local.filter(r => !deletedIds.has(r.id));
        const remoteIds = new Set(validParsed.map(r => r.id));
        const merged = [...validParsed, ...validLocal.filter(r => !remoteIds.has(r.id))];
        saveLocalDB('leave_requests', merged);
        if (branchId) {
          return merged.filter(lr => (lr.branchId || 'main') === branchId);
        }
        return merged;
      } catch (e) {
        console.warn("Falling back to localStorage for getLeaveRequests:", e);
        const local = getLocalDB<LeaveRequest[]>('leave_requests', []);
        const deletedIds = new Set(getLocalDB<string[]>('deleted_leave_ids', []));
        const filtered = local.filter(r => !deletedIds.has(r.id));
        if (branchId) {
          return filtered.filter(lr => (lr.branchId || 'main') === branchId);
        }
        return filtered;
      }
    }, { ttlMs: 45000, fallbackLocalKey: 'leave_requests' });
  },
  async saveLeaveRequest(lr: LeaveRequest) {
    invalidateMemoryCache('leave_requests');
    // Remove from deleted list if re-saving
    const deletedList = getLocalDB<string[]>('deleted_leave_ids', []);
    if (deletedList.includes(lr.id)) {
      saveLocalDB('deleted_leave_ids', deletedList.filter(id => id !== lr.id));
    }
    const local = getLocalDB<LeaveRequest[]>('leave_requests', []);
    const updated = [lr, ...local.filter(r => r.id !== lr.id)];
    saveLocalDB('leave_requests', updated);

    try {
      const { error } = await supabase.from('leave_requests').upsert({
        id: lr.id,
        employee_id: lr.employeeId,
        leave_type_id: lr.leaveTypeId,
        start_date: lr.startDate,
        end_date: lr.endDate,
        total_days: lr.days,
        reason: lr.reason,
        status: lr.status,
        applied_date: lr.appliedDate,
        approved_by: (lr as { approvedBy?: string }).approvedBy,
        branch_id: (lr as { branchId?: string }).branchId
      });
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to save leave request to Supabase, saved locally:", e);
    }
  },
  async deleteLeaveRequest(id: string) {
    invalidateMemoryCache('leave_requests');
    // 1. Add to deleted blacklist to guarantee it never reappears
    const deletedList = getLocalDB<string[]>('deleted_leave_ids', []);
    if (!deletedList.includes(id)) {
      deletedList.push(id);
      saveLocalDB('deleted_leave_ids', deletedList);
    }
    // 2. Remove from local array
    const local = getLocalDB<LeaveRequest[]>('leave_requests', []);
    const updated = local.filter(r => r.id !== id);
    saveLocalDB('leave_requests', updated);

    // 3. Delete from Supabase
    try {
      const { error } = await supabase.from('leave_requests').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete leave request from Supabase (handled locally):", e);
    }
  },

  // Payroll
  async getPayrollRecords(branchId?: string): Promise<PayrollRecord[]> {
    const cacheKey = `payroll_records_${branchId || 'all'}`;
    return fetchWithCache(cacheKey, async () => {
      try {
        let query = supabase.from('payroll_records').select('*');
        if (branchId) query = query.eq('branch_id', branchId);
        const { data, error } = await query;
        if (error) throw error;
        const parsed = data.map(pr => ({
          ...pr,
          employeeId: pr.employee_id,
          basicSalary: pr.basic_salary ?? pr.basicSalary ?? 0,
          gradeAmt: pr.grade_amt ?? pr.gradeAmt ?? 0,
          allowance: pr.allowance ?? 0,
          ssfEmployee: pr.ssf_employee ?? pr.ssfEmployee ?? 0,
          pfEmployee: pr.pf_employee ?? pr.pfEmployee ?? 0,
          gratuity: pr.gratuity ?? 0,
          dashainBonus: pr.dashain_bonus ?? pr.dashainBonus ?? 0,
          bonusAmount: pr.bonus_amount ?? pr.bonusAmount ?? 0,
          sanchitLeaveAmount: pr.sanchit_leave_amount ?? pr.sanchitLeaveAmount ?? 0,
          medicalAllowance: pr.medical_allowance ?? pr.medicalAllowance ?? 0,
          dressAllowance: pr.dress_allowance ?? pr.dressAllowance ?? 0,
          showDashain: pr.show_dashain ?? pr.showDashain ?? false,
          showBonus: pr.show_bonus ?? pr.showBonus ?? false,
          showSanchit: pr.show_sanchit ?? pr.showSanchit ?? false,
          showMedical: pr.show_medical ?? pr.showMedical ?? false,
          showDress: pr.show_dress ?? pr.showDress ?? false,
          totalIncome: pr.total_income ?? pr.totalIncome ?? 0,
          ssfEmployer: pr.ssf_employer ?? pr.ssfEmployer ?? 0,
          pfEmployer: pr.pf_employer ?? pr.pfEmployer ?? 0,
          tax: pr.tax ?? 0,
          netSalary: pr.net_salary ?? pr.netSalary ?? 0,
          generatedDate: pr.generated_date ?? pr.generatedDate ?? Date.now(),
          preparedBy: pr.prepared_by ?? pr.preparedBy ?? '',
          approvedBy: pr.approved_by ?? pr.approvedBy ?? '',
          branchId: pr.branch_id ?? pr.branchId
        }));
        const local = getLocalDB<PayrollRecord[]>('payroll_records', []);
        const remoteIds = new Set(parsed.map(r => r.id));
        const merged = [...parsed, ...local.filter(r => !remoteIds.has(r.id))];
        saveLocalDB('payroll_records', merged);
        if (branchId) {
          return merged.filter(pr => (pr.branchId || 'main') === branchId);
        }
        return merged;
      } catch (e) {
        console.warn("Falling back to localStorage for getPayrollRecords:", e);
        const local = getLocalDB<PayrollRecord[]>('payroll_records', []);
        if (branchId) {
          return local.filter(pr => (pr.branchId || 'main') === branchId);
        }
        return local;
      }
    }, { ttlMs: 45000, fallbackLocalKey: 'payroll_records' });
  },
  async savePayrollRecords(records: PayrollRecord[]) {
    invalidateMemoryCache('payroll_records');
    const local = getLocalDB<PayrollRecord[]>('payroll_records', []);
    const recordIds = new Set(records.map(r => r.id));
    const updated = [...records, ...local.filter(r => !recordIds.has(r.id))];
    saveLocalDB('payroll_records', updated);

    try {
      const payload = records.map(pr => ({
        id: pr.id,
        employee_id: pr.employeeId,
        year: pr.year,
        month: pr.month,
        basic_salary: pr.basicSalary,
        grade_amt: pr.gradeAmt,
        allowance: pr.allowance,
        ssf_employee: pr.ssfEmployee,
        pf_employee: pr.pfEmployee,
        gratuity: pr.gratuity,
        total_income: pr.totalIncome,
        ssf_employer: pr.ssfEmployer,
        pf_employer: pr.pfEmployer,
        tax: pr.tax,
        net_salary: pr.netSalary,
        dashain_bonus: pr.dashainBonus ?? 0,
        bonus_amount: pr.bonusAmount ?? 0,
        sanchit_leave_amount: pr.sanchitLeaveAmount ?? 0,
        medical_allowance: pr.medicalAllowance ?? 0,
        dress_allowance: pr.dressAllowance ?? 0,
        show_dashain: pr.showDashain ?? false,
        show_bonus: pr.showBonus ?? false,
        show_sanchit: pr.showSanchit ?? false,
        show_medical: pr.showMedical ?? false,
        show_dress: pr.showDress ?? false,
        generated_date: pr.generatedDate,
        status: pr.status,
        prepared_by: pr.preparedBy,
        approved_by: pr.approvedBy,
        branch_id: pr.branchId && pr.branchId.trim() !== '' ? pr.branchId : null
      }));
      const { error } = await supabase.from('payroll_records').upsert(payload);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to save payroll records to Supabase, saved locally:", e);
    }
  },

  async deletePayrollRun(year: string, month: string, branchId?: string) {
    try {
      invalidateMemoryCache('payroll_records');
      const targetYear = (year || '').trim();
      const targetMonth = (month || '').trim();

      // 1. Delete from local payroll records cache
      const localPR = getLocalDB<PayrollRecord[]>('payroll_records', []);
      const remainingPR = localPR.filter(r => {
        const matchY = (r.year || '').trim() === targetYear;
        const matchM = (r.month || '').trim() === targetMonth;
        const matchB = !branchId || branchId === 'all' || (r.branchId || 'main') === branchId;
        return !(matchY && matchM && matchB);
      });
      saveLocalDB('payroll_records', remainingPR);
      saveLocalDB('payroll', remainingPR);

      // 2. Delete from Supabase payroll_records table
      try {
        let query = supabase.from('payroll_records').delete().eq('year', targetYear).eq('month', targetMonth);
        if (branchId && branchId !== 'all') {
          query = query.eq('branch_id', branchId);
        }
        await query;
      } catch (err) {
        console.warn("delete payroll_records Supabase error:", err);
      }

      // 3. Delete posted payroll entries from DailyData.officeTransactions across branches & dates
      const branches = await this.getBranches().catch(() => []);
      const branchIdsToClean = new Set<string>();
      if (branchId && branchId !== 'all') {
        branchIdsToClean.add(branchId);
      } else {
        branches.forEach(b => branchIdsToClean.add(b.id));
      }
      branchIdsToClean.add('main');

      const targetYLower = targetYear.toLowerCase();
      const targetMLower = targetMonth.toLowerCase();
      const pfx = `payroll_${targetYear.replace(/[/\\s]/g, '_')}_${targetMonth}_`.toLowerCase();

      const isMatch = (t: any) => {
        if (!t) return false;
        const tid = (t.id || '').toLowerCase();
        if (tid.startsWith(pfx) || tid.includes(pfx)) return true;
        const rem = (t.remarks || '').toLowerCase();
        const hasYear = targetYLower && rem.includes(targetYLower);
        const hasMonth = targetMLower && rem.includes(targetMLower);
        if (hasYear && hasMonth && (
          t.origin === 'payroll' ||
          rem.includes('staff payroll') ||
          rem.includes('staff net salary') ||
          rem.includes('salary disbursement') ||
          rem.includes('contribution deductions') ||
          rem.includes('gross earnings')
        )) {
          return true;
        }
        return false;
      };

      for (const bId of branchIdsToClean) {
        const allDayData = await this.getAllDailyData(bId).catch(() => ({}));
        for (const [dateKey, dayData] of Object.entries(allDayData || {})) {
          if (!dayData || typeof dayData !== 'object') continue;
          const currentTx = (dayData as any).officeTransactions || [];
          const remaining = currentTx.filter((t: any) => !isMatch(t));
          if (remaining.length !== currentTx.length) {
            await this.saveDayData(dateKey, bId, {
              ...(dayData as any),
              officeTransactions: remaining
            });
          }
        }
      }

      this.invalidateMemoryCache();
      try {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('dailyDataUpdated'));
        window.dispatchEvent(new Event('ledgerAccountsUpdated'));
        window.dispatchEvent(new Event('employeesUpdated'));
      } catch (e) {}
    } catch (err) {
      console.warn("deletePayrollRun error:", err);
    }
  },

  // Attendance Records
  async getAttendanceRecords(branchId?: string, date?: string, month?: string): Promise<AttendanceRecord[]> {
    const cacheKey = `attendance_records_${branchId || 'all'}_${date || 'all'}_${month || 'all'}`;
    return fetchWithCache(cacheKey, async () => {
      try {
        let query = supabase.from('attendance_records').select('*');
        if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
        // Do not query 'date' column directly as it may not exist in database table. Use date_bs if date provided.
        if (date) {
          query = query.eq('date_bs', date);
        }
        const { data, error } = await query;
        if (error) throw error;

        // Fetch employee master to enrich employeeName & employeeCode if missing from database
        const employees = getLocalDB<Employee[]>('employees', []);
        const empMap = new Map(employees.map(e => [e.id, e]));

        const parsed: AttendanceRecord[] = (data || []).map((r: Record<string, unknown>) => {
          const empId = String(r.employee_id || r.employeeId || '');
          const matchedEmp = empMap.get(empId);
          const rawDateBs = r.date_bs ? String(r.date_bs) : (r.date ? String(r.date) : '');
          const rawDateAd = r.date_ad ? String(r.date_ad) : '';
          const displayDate = rawDateBs || rawDateAd || String(r.date || '');

          return {
            id: String(r.id),
            employeeId: empId,
            employeeCode: r.employee_code ? String(r.employee_code) : (matchedEmp?.employeeCode || undefined),
            employeeName: r.employee_name ? String(r.employee_name) : (matchedEmp?.fullName || undefined),
            date: displayDate,
            dateBs: rawDateBs || undefined,
            inTime: r.in_time ? String(r.in_time) : undefined,
            outTime: r.out_time ? String(r.out_time) : undefined,
            workHours: typeof r.work_hours === 'number' ? r.work_hours : (Number(r.work_hours) || 0),
            status: (r.status as AttendanceRecord['status']) || 'Present',
            remarks: r.remarks ? String(r.remarks) : undefined,
            branchId: r.branch_id ? String(r.branch_id) : 'main',
            source: (r.source as AttendanceRecord['source']) || 'biometric',
            createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now()
          };
        });

        const local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
        const remoteIds = new Set(parsed.map(r => r.id));
        const merged = [...parsed, ...local.filter(r => !remoteIds.has(r.id))];
        saveLocalDB('attendance_records', merged);

        // Auto-push any local records that aren't on Supabase
        const localOnly = local.filter(r => !remoteIds.has(r.id));
        if (localOnly.length > 0) {
          this.saveAttendanceRecords(localOnly).catch(e => console.warn('Auto-sync attendance warning:', e));
        }

        let res = merged;
        if (branchId && branchId !== 'all') res = res.filter(r => (r.branchId || 'main') === branchId);
        if (date) res = res.filter(r => r.date === date || r.dateBs === date);
        if (month) res = res.filter(r => (r.dateBs && (r.dateBs.startsWith(month) || r.dateBs.replace(/-/g, '/').startsWith(month))) || 
                                          (r.date && (r.date.startsWith(month) || r.date.replace(/-/g, '/').startsWith(month))));
        return res;
      } catch (err) {
        console.warn("Falling back to local DB for attendance:", err);
        const local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
        let res = local;
        if (branchId && branchId !== 'all') res = res.filter(r => (r.branchId || 'main') === branchId);
        if (date) res = res.filter(r => r.date === date || r.dateBs === date);
        if (month) res = res.filter(r => (r.dateBs && (r.dateBs.startsWith(month) || r.dateBs.replace(/-/g, '/').startsWith(month))) || 
                                          (r.date && (r.date.startsWith(month) || r.date.replace(/-/g, '/').startsWith(month))));
        return res;
      }
    }, { ttlMs: 15000, fallbackLocalKey: 'attendance_records' });
  },

  async saveAttendanceRecords(records: AttendanceRecord[]): Promise<{ success: boolean; count: number; error?: string }> {
    if (!records || records.length === 0) return { success: true, count: 0 };

    invalidateMemoryCache('attendance_records');
    const local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
    const recordMap = new Map<string, AttendanceRecord>();
    local.forEach(r => {
      const key = `${r.employeeId}_${r.dateBs || r.date || r.id}`;
      recordMap.set(key, r);
    });
    records.forEach(r => {
      const key = `${r.employeeId}_${r.dateBs || r.date || r.id}`;
      // Clean and ensure deterministic ID
      const cleanEmp = String(r.employeeId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanDate = String(r.dateBs || r.date || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const detId = (r.id && r.id.startsWith('att_')) ? r.id : `att_${cleanEmp}_${cleanDate}`;
      recordMap.set(key, { ...r, id: detId });
    });
    const updated = Array.from(recordMap.values());
    saveLocalDB('attendance_records', updated);

    // Sanitization helpers
    const sanitizeTime = (t?: string): string | null => {
      if (!t || typeof t !== 'string' || !t.trim()) return null;
      const clean = t.trim();
      if (/^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i.test(clean)) return clean;
      return null;
    };

    const sanitizeDateAd = (d?: string): string | null => {
      if (!d || typeof d !== 'string') return null;
      const clean = d.trim();
      if (/^20[0-3]\d-[01]\d-[0-3]\d$/.test(clean)) {
        const parts = clean.split('-').map(Number);
        if (parts[1] >= 1 && parts[1] <= 12 && parts[2] >= 1 && parts[2] <= 31) {
          return clean;
        }
      }
      return null;
    };

    // Full payload (including employee_code, employee_name, date if columns exist)
    const fullPayload = records.map(r => {
      const cleanEmp = String(r.employeeId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanDate = String(r.dateBs || r.date || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const detId = (r.id && r.id.startsWith('att_')) ? r.id : `att_${cleanEmp}_${cleanDate}`;

      return {
        id: detId,
        employee_id: String(r.employeeId || ''),
        employee_code: r.employeeCode || null,
        employee_name: r.employeeName || null,
        date: r.date || r.dateBs || null,
        branch_id: r.branchId && r.branchId.trim() !== '' ? r.branchId : null,
        date_bs: r.dateBs || r.date || '',
        date_ad: sanitizeDateAd(r.date),
        in_time: sanitizeTime(r.inTime),
        out_time: sanitizeTime(r.outTime),
        work_hours: typeof r.workHours === 'number' && !isNaN(r.workHours) ? r.workHours : 0,
        status: r.status || 'Present',
        source: r.source || 'biometric',
        remarks: r.remarks || null
      };
    });

    // Core guaranteed payload that matches standard schema columns
    const corePayload = fullPayload.map(r => ({
      id: r.id,
      employee_id: r.employee_id,
      branch_id: r.branch_id,
      date_bs: r.date_bs,
      date_ad: r.date_ad,
      in_time: r.in_time,
      out_time: r.out_time,
      work_hours: r.work_hours,
      status: r.status,
      source: r.source,
      remarks: r.remarks
    }));

    try {
      const chunkSize = 250;
      for (let i = 0; i < fullPayload.length; i += chunkSize) {
        const fullChunk = fullPayload.slice(i, i + chunkSize);
        let { error } = await supabase.from('attendance_records').upsert(fullChunk);

        // If error code is PGRST204 (column does not exist in schema cache), retry with corePayload
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
          const coreChunk = corePayload.slice(i, i + chunkSize);
          const coreRes = await supabase.from('attendance_records').upsert(coreChunk);
          error = coreRes.error;
        }

        if (error) {
          console.warn("Supabase attendance chunk upsert error:", error);
          throw error;
        }
      }
      return { success: true, count: fullPayload.length };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("Saved attendance records locally (Supabase write failed):", msg);
      return { success: false, count: 0, error: msg };
    }
  },

  async syncAttendanceToSupabase(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
    if (local.length === 0) {
      return { success: true, syncedCount: 0 };
    }
    const res = await this.saveAttendanceRecords(local);
    return { success: res.success, syncedCount: res.count, error: res.error };
  },

  async deleteAttendanceRecord(id: string) {
    invalidateMemoryCache('attendance_records');
    const local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
    const updated = local.filter(r => r.id !== id);
    saveLocalDB('attendance_records', updated);
    try {
      await supabase.from('attendance_records').delete().eq('id', id);
    } catch {
      // silent
    }
  },

  async deleteAttendanceByMonth(yearBs: number, monthBs: number, branchId?: string) {
    invalidateMemoryCache('attendance_records');
    const local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
    const mStr = String(monthBs).padStart(2, '0');
    const prefixDash = `${yearBs}-${mStr}`;
    const prefixSlash = `${yearBs}/${mStr}`;
    const toDeleteIds: string[] = [];
    const isAll = !branchId || branchId.toLowerCase() === 'all' || branchId.trim() === '';
    const updated = local.filter(r => {
      const matchMonth = (r.dateBs && (r.dateBs.startsWith(prefixDash) || r.dateBs.startsWith(prefixSlash))) ||
                         (r.date && (r.date.startsWith(prefixDash) || r.date.startsWith(prefixSlash)));
      const matchBranch = isAll || r.branchId === branchId || (r.branchId || 'main') === branchId;
      if (matchMonth && matchBranch) {
        if (r.id) toDeleteIds.push(r.id);
        return false;
      }
      return true;
    });
    saveLocalDB('attendance_records', updated);
    try {
      if (toDeleteIds.length > 0) {
        await supabase.from('attendance_records').delete().in('id', toDeleteIds);
      }
      let query = supabase.from('attendance_records').delete().gte('date_bs', `${yearBs}-${mStr}-01`).lte('date_bs', `${yearBs}-${mStr}-32`);
      if (!isAll) {
        query = query.eq('branch_id', branchId);
      }
      await query;
    } catch (e) {
      console.warn("Error deleting attendance from supabase:", e);
    }
  },

  async deleteAttendanceByEmployee(employeeId: string, yearBs?: number, monthBs?: number, employeeName?: string) {
    invalidateMemoryCache('attendance_records');
    const local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
    const mStr = monthBs ? String(monthBs).padStart(2, '0') : null;
    const prefixDash = (yearBs && mStr) ? `${yearBs}-${mStr}` : null;
    const prefixSlash = (yearBs && mStr) ? `${yearBs}/${mStr}` : null;
    const toDeleteIds: string[] = [];
    const targetNameNorm = employeeName ? employeeName.trim().toLowerCase() : null;

    const updated = local.filter(r => {
      const matchEmp = r.employeeId === employeeId || 
                       (targetNameNorm && r.employeeName && r.employeeName.trim().toLowerCase() === targetNameNorm) ||
                       (employeeId && r.employeeId && (r.employeeId.endsWith(employeeId) || employeeId.endsWith(r.employeeId)));
      if (matchEmp) {
        if (!prefixDash) {
          if (r.id) toDeleteIds.push(r.id);
          return false;
        }
        const matchMonth = (r.dateBs && (r.dateBs.startsWith(prefixDash) || r.dateBs.startsWith(prefixSlash!))) ||
                           (r.date && (r.date.startsWith(prefixDash) || r.date.startsWith(prefixSlash!)));
        if (matchMonth) {
          if (r.id) toDeleteIds.push(r.id);
          return false;
        }
      }
      return true;
    });
    saveLocalDB('attendance_records', updated);
    try {
      if (toDeleteIds.length > 0) {
        await supabase.from('attendance_records').delete().in('id', toDeleteIds);
      }
      if (employeeId) {
        let q = supabase.from('attendance_records').delete().eq('employee_id', employeeId);
        if (yearBs && mStr) {
          q = q.gte('date_bs', `${yearBs}-${mStr}-01`).lte('date_bs', `${yearBs}-${mStr}-32`);
        }
        await q;
      }
      if (employeeName) {
        let qName = supabase.from('attendance_records').delete().eq('employee_name', employeeName);
        if (yearBs && mStr) {
          qName = qName.gte('date_bs', `${yearBs}-${mStr}-01`).lte('date_bs', `${yearBs}-${mStr}-32`);
        }
        await qName;
      }
    } catch (e) {
      console.warn("Error deleting employee attendance from supabase:", e);
    }
  },

  async deleteManualAttendanceOnly(yearBs: number, monthBs: number, branchId?: string) {
    invalidateMemoryCache('attendance_records');
    const local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
    const mStr = String(monthBs).padStart(2, '0');
    const prefixDash = `${yearBs}-${mStr}`;
    const prefixSlash = `${yearBs}/${mStr}`;
    const toDeleteIds: string[] = [];
    const isAll = !branchId || branchId.toLowerCase() === 'all' || branchId.trim() === '';
    const updated = local.filter(r => {
      const matchMonth = (r.dateBs && (r.dateBs.startsWith(prefixDash) || r.dateBs.startsWith(prefixSlash))) ||
                         (r.date && (r.date.startsWith(prefixDash) || r.date.startsWith(prefixSlash)));
      const matchBranch = isAll || r.branchId === branchId || (r.branchId || 'main') === branchId;
      const isManual = r.source === 'manual' || !!r.remarks;
      if (matchMonth && matchBranch && isManual) {
        if (r.id) toDeleteIds.push(r.id);
        return false;
      }
      return true;
    });
    saveLocalDB('attendance_records', updated);
    try {
      if (toDeleteIds.length > 0) {
        await supabase.from('attendance_records').delete().in('id', toDeleteIds);
      }
    } catch (e) {
      console.warn("Error deleting manual attendance from supabase:", e);
    }
  },

  async clearAttendanceRecords(branchId?: string, date?: string) {
    invalidateMemoryCache('attendance_records');
    let local = getLocalDB<AttendanceRecord[]>('attendance_records', []);
    const toDeleteIds: string[] = [];
    if (branchId && date) {
      local = local.filter(r => {
        const match = (r.branchId === branchId) && (r.date === date || r.dateBs === date);
        if (match && r.id) toDeleteIds.push(r.id);
        return !match;
      });
    } else if (date) {
      local = local.filter(r => {
        const match = r.date === date || r.dateBs === date;
        if (match && r.id) toDeleteIds.push(r.id);
        return !match;
      });
    } else if (branchId) {
      local = local.filter(r => {
        const match = r.branchId === branchId;
        if (match && r.id) toDeleteIds.push(r.id);
        return !match;
      });
    } else {
      toDeleteIds.push(...local.map(r => r.id));
      local = [];
    }
    saveLocalDB('attendance_records', local);
    try {
      if (toDeleteIds.length > 0) {
        await supabase.from('attendance_records').delete().in('id', toDeleteIds);
      }
    } catch (e) {
      console.warn("Failed to clear attendance from Supabase:", e);
    }
  },

  // Tax Policy Config
  async getTaxConfig(): Promise<TaxConfig | null> {
    return fetchWithCache('tax_policy', async () => {
      try {
        const { data, error } = await supabase.from('tax_policy').select('*');
        if (error) throw error;
        if (data && data.length > 0) {
          const item = data.find((d: Record<string, unknown>) => d.id === 'default') || data[0];
          if (item && item.config) {
            if (typeof window !== 'undefined') {
              localStorage.setItem('ZEN_TAX_POLICY_V1', JSON.stringify(item.config));
            }
            return item.config as TaxConfig;
          }
        }
      } catch (e) {
        console.warn("Falling back to localStorage for getTaxConfig:", e);
      }
      const saved = typeof window !== 'undefined' ? localStorage.getItem('ZEN_TAX_POLICY_V1') : null;
      return saved ? JSON.parse(saved) : null;
    }, { ttlMs: 60000 });
  },

  async saveTaxConfig(cfg: TaxConfig) {
    invalidateMemoryCache('tax_policy');
    if (typeof window !== 'undefined') {
      localStorage.setItem('ZEN_TAX_POLICY_V1', JSON.stringify(cfg));
    }
    try {
      let { error } = await supabase.from('tax_policy').upsert({
        id: 'default',
        config: cfg,
        updated_at: new Date().toISOString()
      });
      if (!error) return;

      console.warn("tax_policy upsert 1 warning, trying fallback without updated_at:", error.message);
      ({ error } = await supabase.from('tax_policy').upsert({
        id: 'default',
        config: cfg
      }));
      if (error) {
        console.warn("Failed to save tax policy to Supabase, saved locally:", error.message);
      }
    } catch (e) {
      console.warn("Failed to save tax policy to Supabase, saved locally:", e);
    }
  },

  // Tax Adjustments
  async getTaxAdjustments(): Promise<Record<string, unknown>> {
    return fetchWithCache('tax_adjustments', async () => {
      try {
        const { data, error } = await supabase.from('tax_adjustments').select('*');
        if (error) throw error;
        const localStr = typeof window !== 'undefined' ? localStorage.getItem('ZEN_TAX_ADJUSTMENTS_V1') : null;
        const localMap: Record<string, unknown> = localStr ? JSON.parse(localStr) : {};
        const adjMap: Record<string, unknown> = { ...localMap };

        if (data && data.length > 0) {
          data.forEach((item: Record<string, unknown>) => {
            if (item.employee_id && item.adjustments_data) {
              adjMap[item.employee_id as string] = item.adjustments_data;
            } else if (item.id && item.id !== 'default' && item.adjustments_data) {
              adjMap[item.id as string] = item.adjustments_data;
            } else if (item.id === 'default' && item.adjustments_data) {
              Object.assign(adjMap, item.adjustments_data);
            }
          });
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('ZEN_TAX_ADJUSTMENTS_V1', JSON.stringify(adjMap));
        }
        return adjMap;
      } catch (e) {
        console.warn("Falling back to localStorage for getTaxAdjustments:", e);
      }
      const saved = typeof window !== 'undefined' ? localStorage.getItem('ZEN_TAX_ADJUSTMENTS_V1') : null;
      return saved ? JSON.parse(saved) : {};
    }, { ttlMs: 60000 });
  },

  async saveTaxAdjustments(adjustmentsMap: Record<string, Record<string, unknown>>) {
    invalidateMemoryCache('tax_adjustments');
    if (typeof window !== 'undefined') {
      localStorage.setItem('ZEN_TAX_ADJUSTMENTS_V1', JSON.stringify(adjustmentsMap));
    }
    try {
      const upsertItems = Object.entries(adjustmentsMap).map(([empId, adjData]) => ({
        employee_id: empId,
        id: empId,
        is_active: !!adjData?.isTaxAdjustmentActive,
        start_month: (adjData?.taxAdjustedFromMonth as string) || 'पौष',
        adjustments_data: adjData,
        updated_at: new Date().toISOString()
      }));

      if (upsertItems.length === 0) return;

      // Attempt 1: Full schema payload
      let { error } = await supabase.from('tax_adjustments').upsert(upsertItems);
      if (!error) return;
      console.warn("Tax adjustments upsert 1 warning, trying fallback 2 (employee_id & adjustments_data):", error.message);

      // Attempt 2: Minimal employee_id payload
      const minimalPayload = Object.entries(adjustmentsMap).map(([empId, adjData]) => ({
        employee_id: empId,
        adjustments_data: adjData
      }));
      ({ error } = await supabase.from('tax_adjustments').upsert(minimalPayload));
      if (!error) return;
      console.warn("Tax adjustments upsert 2 warning, trying fallback 3 (id & adjustments_data):", error.message);

      // Attempt 3: Payload using id column
      const idPayload = Object.entries(adjustmentsMap).map(([empId, adjData]) => ({
        id: empId,
        adjustments_data: adjData
      }));
      ({ error } = await supabase.from('tax_adjustments').upsert(idPayload));
      if (!error) return;
      console.warn("Tax adjustments upsert 3 warning, trying single default record fallback:", error.message);

      // Attempt 4: Upsert single global row (id: 'default')
      ({ error } = await supabase.from('tax_adjustments').upsert({
        id: 'default',
        adjustments_data: adjustmentsMap,
        updated_at: new Date().toISOString()
      }));
      if (error) {
        console.warn("All tax adjustments upsert attempts failed in Supabase, saved locally:", error.message);
      }
    } catch (e) {
      console.warn("Failed to save tax adjustments to Supabase, saved locally:", e);
    }
  },

  // Complaints
  async getComplaints(branchId?: string): Promise<Complaint[]> {
    const cacheKey = `complaints_${branchId || 'all'}`;
    return fetchWithCache(cacheKey, async () => {
      try {
        let query = supabase.from('complaints').select('*').order('created_at', { ascending: false });
        if (branchId) query = query.eq('branch_id', branchId);
        const { data, error } = await query;
        if (error) throw error;
        const parsed = data.map(c => ({
          ...c,
          createdAt: c.created_at,
          branchId: c.branch_id || 'main',
          resolutionNote: c.resolution_note
        }));
        const local = getLocalDB<Complaint[]>('complaints', []);
        const remoteIds = new Set(parsed.map(c => c.id));
        const merged = [...parsed, ...local.filter(c => !remoteIds.has(c.id))];
        saveLocalDB('complaints', merged);
        if (branchId) {
          return merged.filter(c => (c.branchId || 'main') === branchId);
        }
        return merged;
      } catch (e) {
        console.warn("Falling back to localStorage for getComplaints:", e);
        const local = getLocalDB<Complaint[]>('complaints', []);
        if (branchId) {
          return local.filter(c => (c.branchId || 'main') === branchId);
        }
        return local;
      }
    }, { ttlMs: 45000, fallbackLocalKey: 'complaints' });
  },
  async saveComplaint(c: Complaint) {
    invalidateMemoryCache('complaints');
    const local = getLocalDB<Complaint[]>('complaints', []);
    const updated = [c, ...local.filter(com => com.id !== c.id)];
    saveLocalDB('complaints', updated);

    try {
      const { error } = await supabase.from('complaints').upsert({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        priority: c.priority,
        status: c.status,
        created_at: c.createdAt,
        branch_id: c.branchId,
        resolution_note: c.resolutionNote
      });
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to save complaint to Supabase, saved locally:", e);
    }
  },

  // Branches
  async getBranches(): Promise<Branch[]> {
    return fetchWithCache('branches', async () => {
      try {
        const [{ data, error }, metaRes] = await Promise.all([
          supabase.from('branches').select('*').order('created_at', { ascending: true }),
          supabase.from('settings').select('data').eq('id', 'saccos_branches_meta').maybeSingle()
        ]);
        if (error) throw error;

        const metaMap = new Map<string, Partial<Branch>>();
        if (metaRes?.data?.data && Array.isArray(metaRes.data.data)) {
          (metaRes.data.data as Branch[]).forEach(mb => {
            if (mb?.id) metaMap.set(mb.id, mb);
          });
        }
        const localSaved = getLocalDB<Branch[]>('branches', []);
        const localMap = new Map<string, Branch>();
        (Array.isArray(localSaved) ? localSaved : []).forEach(lb => {
          if (lb?.id) localMap.set(lb.id, lb);
        });

        const parsed: Branch[] = (data || []).map((b: any) => {
          const meta = metaMap.get(b.id) || {};
          const loc = localMap.get(b.id) || ({} as Partial<Branch>);
          return {
            id: b.id,
            name: b.name,
            nameNp: b.name_np || b.nameNp || meta.nameNp || loc.nameNp || '',
            code: b.code,
            codeNp: b.code_np || b.codeNp || meta.codeNp || loc.codeNp || '',
            location: b.location,
            locationNp: b.location_np || b.locationNp || meta.locationNp || loc.locationNp || '',
            branchType: b.branch_type || b.branchType || meta.branchType || loc.branchType || (b.id === 'main' ? 'Head Office' : 'Branch Office'),
            branchTypeNp: b.branch_type_np || b.branchTypeNp || meta.branchTypeNp || loc.branchTypeNp || (b.id === 'main' ? 'मुख्य कार्यालय' : 'शाखा कार्यालय'),
            email: b.email || meta.email || loc.email || '',
            status: (b.status || meta.status || 'Active') as 'Active' | 'Inactive',
            createdAt: b.created_at || b.createdAt || meta.createdAt || Date.now()
          };
        });
        saveLocalDB('branches', parsed);
        return parsed;
      } catch (e) {
        console.warn("Falling back to localStorage for getBranches:", e);
        return getLocalDB<Branch[]>('branches', []);
      }
    }, { ttlMs: 60000, fallbackLocalKey: 'branches' });
  },
  async saveBranch(branch: Branch) {
    invalidateMemoryCache('branches');
    const local = getLocalDB<Branch[]>('branches', []);
    const updated = [branch, ...local.filter(b => b.id !== branch.id)];
    saveLocalDB('branches', updated);

    try {
      const { error } = await supabase.from('branches').upsert({
        id: branch.id,
        name: branch.name,
        name_np: branch.nameNp || '',
        code: branch.code,
        code_np: branch.codeNp || '',
        location: branch.location,
        location_np: branch.locationNp || '',
        branch_type: branch.branchType || 'Branch Office',
        branch_type_np: branch.branchTypeNp || 'शाखा कार्यालय',
        email: branch.email || '',
        status: branch.status,
        created_at: branch.createdAt
      });
      if (error) {
        // Fallback if Supabase branches table hasn't added extended columns yet
        const { error: baseError } = await supabase.from('branches').upsert({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          location: branch.location,
          status: branch.status,
          created_at: branch.createdAt
        });
        if (baseError) throw baseError;
      }
    } catch (e) {
      console.warn("Failed to save branch to Supabase, saved locally:", e);
    }

    // Dual-save enriched bilingual branch metadata in settings JSONB container
    try {
      await supabase.from('settings').upsert({
        id: 'saccos_branches_meta',
        data: updated,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Branch meta settings sync notice:", e);
    }
  },
  async deleteBranch(id: string) {
    invalidateMemoryCache();
    const targetNorm = normalizeBranchId(id);
    
    // 1. Remove from local branches
    const localBranches = getLocalDB<Branch[]>('branches', []);
    saveLocalDB('branches', localBranches.filter(b => normalizeBranchId(b.id) !== targetNorm));

    // 2. Remove all daily_data belonging to this branch from local cache
    const localDaily = getLocalDB<Record<string, DailyData>>('daily_data', {});
    Object.keys(localDaily).forEach(k => {
      if (k === 'FD_RECORDS_STORE' || k === 'OFFICE_EXPENSES_STORE' || k === 'SAVED_EXPENSE_SHEETS_STORE' || k === 'FIXED_OFFICE_EXPENSE_CONFIGS') return;
      const item = localDaily[k];
      const itemBranch = item?.branchId || (k.includes('_') ? k.split('_').slice(1).join('_') : 'main');
      if (normalizeBranchId(itemBranch) === targetNorm) {
        delete localDaily[k];
      }
    });
    saveLocalDB('daily_data', localDaily);

    // 3. Delete from Supabase tables
    const branchAliases = [
      id,
      id === 'main' ? 'C01' : '',
      id === 'sahodba' ? 'C02' : '',
      id === 'pipra' ? 'C03' : '',
      id === 'parsa' ? 'C04' : '',
      id === 'C01' ? 'main' : '',
      id === 'C02' ? 'sahodba' : '',
      id === 'C03' ? 'pipra' : '',
      id === 'C04' ? 'parsa' : ''
    ].filter(Boolean);

    try {
      await Promise.allSettled([
        supabase.from('branches').delete().in('id', branchAliases),
        supabase.from('daily_data').delete().in('branch_id', branchAliases),
        supabase.from('daily_cash_data').delete().in('branch_id', branchAliases),
        supabase.from('back_office_entries').delete().in('branch_id', branchAliases),
        supabase.from('front_teller_ledger_entries').delete().in('branch_id', branchAliases),
        supabase.from('ledger_accounts').delete().in('branch_id', branchAliases),
        supabase.from('office_expenses').delete().in('branch_id', branchAliases)
      ]);
    } catch (e) {
      console.warn("Notice during deleteBranch cascade:", e);
    }
  },

  // Roles
  async getRoles(): Promise<Role[]> {
    return fetchWithCache('roles', async () => {
      try {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        saveLocalDB('roles', data);
        return data;
      } catch (e) {
        console.warn("Falling back to localStorage for getRoles:", e);
        return getLocalDB<Role[]>('roles', []);
      }
    }, { ttlMs: 60000, fallbackLocalKey: 'roles' });
  },
  async saveRole(role: Role) {
    invalidateMemoryCache('roles');
    const local = getLocalDB<Role[]>('roles', []);
    const updated = [role, ...local.filter(r => r.id !== role.id)];
    saveLocalDB('roles', updated);

    try {
      const { error } = await supabase.from('roles').upsert(role);
      if (error) {
        console.error('Supabase saveRole error:', error);
        throw error;
      }
    } catch (e) {
      console.warn("Failed to save role to Supabase, saved locally:", e);
    }
  },
  async deleteRole(id: string) {
    invalidateMemoryCache('roles');
    const local = getLocalDB<Role[]>('roles', []);
    saveLocalDB('roles', local.filter(r => r.id !== id));
    try {
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete role from Supabase, deleted locally:", e);
    }
  },

  // Users
  async getUsers(): Promise<User[]> {
    try {
      const res = await fetchWithCache('users', async () => {
        try {
          const { data, error } = await supabase.from('users').select('*');
          if (error) throw error;
          const parsed = (data || []).map(u => ({
            ...u,
            fullName: u.full_name,
            roleId: u.role_id,
            branchId: u.branch_id,
            profilePhoto: u.profile_photo,
            accountCreated: u.account_created,
            passwordUpdatedAt: u.password_updated_at ?? u.passwordUpdatedAt,
            forcePasswordChange: u.force_password_change ?? u.forcePasswordChange ?? false,
            createdAt: u.created_at
          }));
          const local = getLocalDB<User[]>('users', []);
          const safeLocal = Array.isArray(local) ? local : [];
          const remoteIds = new Set(parsed.map(r => r.id));
          const merged = [...parsed, ...safeLocal.filter(r => !remoteIds.has(r.id))];
          saveLocalDB('users', merged);
          return merged;
        } catch (e) {
          console.warn("Falling back to localStorage for getUsers:", e);
          const local = getLocalDB<User[]>('users', []);
          return Array.isArray(local) ? local : [];
        }
      }, { ttlMs: 60000, fallbackLocalKey: 'users', defaultVal: [] });
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn("Falling back to localStorage for getUsers on outer catch:", err);
      const local = getLocalDB<User[]>('users', []);
      return Array.isArray(local) ? local : [];
    }
  },
  async saveUser(user: User) {
    invalidateMemoryCache('users');
    const local = getLocalDB<User[]>('users', []);
    const updated = [user, ...local.filter(u => u.id !== user.id)];
    saveLocalDB('users', updated);

    try {
      // Attempt 1: Full payload including password_updated_at & force_password_change
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        username: user.username,
        password: user.password,
        full_name: user.fullName,
        role_id: user.roleId,
        branch_id: user.branchId,
        permissions: user.permissions || [],
        status: user.status || 'Active',
        email: user.email || null,
        mobile: user.mobile || null,
        department: user.department || null,
        designation: user.designation || null,
        profile_photo: user.profilePhoto || null,
        account_created: user.accountCreated || null,
        password_updated_at: user.passwordUpdatedAt || null,
        force_password_change: user.forcePasswordChange || false
      });
      if (!error) return;

      // Fallback 2: without optional new columns if table schema differs
      const { error: fbErr } = await supabase.from('users').upsert({
        id: user.id,
        username: user.username,
        password: user.password,
        full_name: user.fullName,
        role_id: user.roleId,
        branch_id: user.branchId,
        permissions: user.permissions || [],
        status: user.status || 'Active',
        email: user.email || null,
        mobile: user.mobile || null,
        department: user.department || null,
        designation: user.designation || null,
        profile_photo: user.profilePhoto || null,
        account_created: user.accountCreated || null
      });
      if (fbErr) throw fbErr;
    } catch (e) {
      console.warn("Failed to save user to Supabase (saved in local DB):", e);
    }
  },
  async deleteUser(id: string) {
    invalidateMemoryCache('users');
    const local = getLocalDB<User[]>('users', []);
    saveLocalDB('users', local.filter(u => u.id !== id));
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete user from Supabase, deleted locally:", e);
    }
  },

  // Settings
  async getSettings(): Promise<SystemSettings> {
    return fetchWithCache('settings', async () => {
      try {
        const { data, error } = await supabase.from('settings').select('data').eq('id', 'global').single();
        if (error && error.code !== 'PGRST116') throw error;
        const settings = data?.data || getLocalDB<SystemSettings>('settings', null as unknown as SystemSettings);
        if (settings) {
          if (!settings.logoUrl || settings.logoUrl.includes('picsum.photos')) {
            settings.logoUrl = '/system_logo.png';
          }
        }
        saveLocalDB('settings', settings);
        return settings;
      } catch (e) {
        console.warn("Falling back to localStorage for getSettings:", e);
        const settings = getLocalDB<SystemSettings>('settings', null as unknown as SystemSettings);
        if (settings && (!settings.logoUrl || settings.logoUrl.includes('picsum.photos'))) {
          settings.logoUrl = '/system_logo.png';
        }
        return settings;
      }
    }, { ttlMs: 60000, fallbackLocalKey: 'settings' });
  },
  async saveSettings(settings: SystemSettings) {
    invalidateMemoryCache('settings');
    const finalSettings = {
      ...settings,
      logoUrl: (settings.logoUrl && !settings.logoUrl.includes('picsum.photos')) ? settings.logoUrl : '/system_logo.png'
    };
    saveLocalDB('settings', finalSettings);
    try {
      localStorage.setItem('ZEN_AUTH_SETTINGS', JSON.stringify(finalSettings));
    } catch {
      /* ignore storage quota errors */
    }
    try {
      const { error } = await supabase.from('settings').upsert({ id: 'global', data: finalSettings });
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to save settings to Supabase, saved locally:", e);
    }
  },

  // Daily Data
  async syncFrontTellerTransactions(date: string, branchId: string, data: DailyData) {
    try {
      const finalBranchId = await this.verifyAndGetBranchId(branchId);

      // 1. Sync Ledger Entries (front_teller_ledger_entries)
      const bsDateVal = toBsDateString(date);
      const adDateVal = toAdDateString(date);
      const allDates = Array.from(new Set([date, bsDateVal, adDateVal])).filter(Boolean);
      const branchAliases = [
        finalBranchId,
        branchId,
        finalBranchId === 'main' ? 'C01' : '',
        finalBranchId === 'sahodba' ? 'C02' : '',
        finalBranchId === 'pipra' ? 'C03' : '',
        finalBranchId === 'parsa' ? 'C04' : '',
        finalBranchId === 'C01' ? 'main' : '',
        finalBranchId === 'C02' ? 'sahodba' : '',
        finalBranchId === 'C03' ? 'pipra' : '',
        finalBranchId === 'C04' ? 'parsa' : ''
      ].filter(Boolean);

      try {
        await supabase.from('front_teller_ledger_entries').delete().in('date', allDates).in('branch_id', branchAliases);

        const ledgerRows = (data.transactions || []).map(t => ({
          id: t.id || safeUUID(),
          date,
          branch_id: finalBranchId,
          account_title: t.description || 'General',
          amount: Number(t.amount) || 0,
          type: t.type === 'in' ? 'in' : 'out',
          remarks: t.remarks || '',
          data: t,
          created_at: new Date().toISOString()
        }));

        if (ledgerRows.length > 0) {
          const { error } = await supabase.from('front_teller_ledger_entries').insert(ledgerRows);
          if (error) {
            console.warn("Notice syncing front_teller_ledger_entries primary rows:", error.message);
            const fallbackRows1 = ledgerRows.map(r => ({
              id: r.id,
              date: r.date,
              branch_id: r.branch_id,
              account_title: r.account_title,
              amount: r.amount,
              type: r.type,
              remarks: r.remarks
            }));
            const { error: errFb1 } = await supabase.from('front_teller_ledger_entries').insert(fallbackRows1);
            if (errFb1) {
              const fallbackRows2 = ledgerRows.map(r => ({
                id: r.id,
                date: r.date,
                branch_id: r.branch_id,
                data: r.data
              }));
              const { error: errFb2 } = await supabase.from('front_teller_ledger_entries').insert(fallbackRows2);
              if (errFb2) console.warn("Notice: front_teller_ledger_entries sync notice:", errFb2.message);
            }
          }
        }
      } catch (errLedger) {
        console.warn("Exception in ledger sync:", errLedger);
      }

      // 2. Sync Counter Entries (front_teller_counter_entries)
      try {
        await supabase.from('front_teller_counter_entries').delete().in('date', allDates).in('branch_id', branchAliases);

        const counterRows = (data.officeTransactions || []).map(o => ({
          id: o.id || safeUUID(),
          date,
          branch_id: finalBranchId,
          head: o.head || 'General',
          amount: Number(o.amount) || 0,
          type: o.type === 'in' ? 'in' : 'out',
          remarks: o.remarks || '',
          data: o,
          created_at: new Date().toISOString()
        }));

        if (counterRows.length > 0) {
          const { error } = await supabase.from('front_teller_counter_entries').insert(counterRows);
          if (error) {
            console.warn("Notice syncing front_teller_counter_entries primary rows:", error.message);
            const fallbackRows1 = counterRows.map(r => ({
              id: r.id,
              date: r.date,
              branch_id: r.branch_id,
              head: r.head,
              amount: r.amount,
              type: r.type,
              remarks: r.remarks
            }));
            const { error: errFb1 } = await supabase.from('front_teller_counter_entries').insert(fallbackRows1);
            if (errFb1) {
              const fallbackRows2 = counterRows.map(r => ({
                id: r.id,
                date: r.date,
                branch_id: r.branch_id,
                data: r.data
              }));
              const { error: errFb2 } = await supabase.from('front_teller_counter_entries').insert(fallbackRows2);
              if (errFb2) console.warn("Notice: front_teller_counter_entries sync notice:", errFb2.message);
            }
          }
        }
      } catch (errCounter) {
        console.warn("Exception in counter sync:", errCounter);
      }

      // 3. Sync Remittance Entries (front_teller_remittance_entries)
      try {
        await supabase.from('front_teller_remittance_entries').delete().in('date', allDates).in('branch_id', branchAliases);

        const remittanceRows = (data.remittances || []).map(r => ({
          id: r.id || safeUUID(),
          date,
          branch_id: finalBranchId,
          partner: r.companyName || 'Other',
          amount: Number(r.amount) || 0,
          type: (r.type === 'Send' || String(r.type) === 'Send') ? 'out' : 'in',
          remarks: r.remarks || '',
          quantity: 1,
          data: r,
          created_at: new Date().toISOString()
        }));

        if (remittanceRows.length > 0) {
          const { error } = await supabase.from('front_teller_remittance_entries').insert(remittanceRows);
          if (error) {
            console.warn("Notice syncing front_teller_remittance_entries primary rows:", error.message);
            const fallbackRows1 = remittanceRows.map(r => ({
              id: r.id,
              date: r.date,
              branch_id: r.branch_id,
              partner: r.partner,
              amount: r.amount,
              type: r.type,
              remarks: r.remarks
            }));
            const { error: errFb1 } = await supabase.from('front_teller_remittance_entries').insert(fallbackRows1);
            if (errFb1) {
              const fallbackRows2 = remittanceRows.map(r => ({
                id: r.id,
                date: r.date,
                branch_id: r.branch_id,
                data: r.data
              }));
              const { error: errFb2 } = await supabase.from('front_teller_remittance_entries').insert(fallbackRows2);
              if (errFb2) console.warn("Notice: front_teller_remittance_entries sync notice:", errFb2.message);
            }
          }
        }
      } catch (errRemit) {
        console.warn("Exception in remittance sync:", errRemit);
      }

      // 4. Sync Denomination Adjustments (front_teller_deno_adjustments)
      try {
        await supabase.from('front_teller_deno_adjustments').delete().in('date', allDates).in('branch_id', branchAliases);

        const denoRows = (data.denoAdjustments || []).map(d => {
          const breakdown: Record<string, number> = {};
          breakdown[String(d.value)] = Number(d.quantity) || 0;

          return {
            id: d.id || safeUUID(),
            date,
            branch_id: finalBranchId,
            type: d.type === 'add' ? 'add' : 'less',
            value: Number(d.value) || 0,
            quantity: Number(d.quantity) || 0,
            amount: (Number(d.value) || 0) * (Number(d.quantity) || 0),
            total_amount: (Number(d.value) || 0) * (Number(d.quantity) || 0),
            remarks: d.isVaultTransfer ? 'Vault Transfer' : d.isManualVault ? 'Manual Vault' : 'Teller Adj',
            denominations_breakdown: breakdown,
            data: d,
            created_at: new Date().toISOString()
          };
        });

        if (denoRows.length > 0) {
          const { error } = await supabase.from('front_teller_deno_adjustments').insert(denoRows);
          if (error) {
            console.warn("Notice syncing front_teller_deno_adjustments primary rows:", error.message);
            // Fallback 1: Try standard value/quantity/amount schema
            const fallbackRows1 = denoRows.map(r => ({
              id: r.id,
              date: r.date,
              branch_id: r.branch_id,
              type: r.type,
              value: r.value,
              quantity: r.quantity,
              amount: r.amount,
              remarks: r.remarks
            }));
            const { error: errFb1 } = await supabase.from('front_teller_deno_adjustments').insert(fallbackRows1);
            if (errFb1) {
              console.warn("Notice syncing front_teller_deno_adjustments fallback 1:", errFb1.message);
              // Fallback 2: Try breakdown schema
              const fallbackRows2 = denoRows.map(r => ({
                id: r.id,
                date: r.date,
                branch_id: r.branch_id,
                type: r.type,
                denominations_breakdown: r.denominations_breakdown,
                total_amount: r.total_amount,
                remarks: r.remarks
              }));
              const { error: errFb2 } = await supabase.from('front_teller_deno_adjustments').insert(fallbackRows2);
              if (errFb2) {
                console.warn("Notice syncing front_teller_deno_adjustments fallback 2:", errFb2.message);
                // Fallback 3: Try pure JSONB data schema
                const fallbackRows3 = denoRows.map(r => ({
                  id: r.id,
                  date: r.date,
                  branch_id: r.branch_id,
                  data: r.data
                }));
                const { error: errFb3 } = await supabase.from('front_teller_deno_adjustments').insert(fallbackRows3);
                if (errFb3) {
                  console.warn("Notice: front_teller_deno_adjustments sync notice:", errFb3.message);
                }
              }
            }
          }
        }
      } catch (errDeno) {
        console.warn("Exception in deno adjustment sync:", errDeno);
      }

      // 5. Sync Vault Control Entries (front_teller_vault_entries)
      try {
        await supabase.from('front_teller_vault_entries').delete().in('date', allDates).in('branch_id', branchAliases);

        const vaultRows = (data.vaultTransactions || []).map(v => ({
          id: v.id || safeUUID(),
          date: v.date || date,
          branch_id: finalBranchId,
          party_type: v.partyType || 'Teller Desk',
          party_name: v.partyName || '',
          tx_type: v.txType === 'in' ? 'in' : 'out',
          amount: Number(v.amount) || 0,
          remarks: v.remarks || '',
          denominations_breakdown: v.denominations || {},
          vault_snapshot: v.vaultSnapshot || {},
          is_vault_transfer: Boolean(v.isVaultTransfer),
          data: v,
          created_at: new Date().toISOString()
        }));

        if (vaultRows.length > 0) {
          const { error } = await supabase.from('front_teller_vault_entries').insert(vaultRows);
          if (error) {
            console.warn("Notice syncing front_teller_vault_entries primary rows:", error.message);
            const fallbackRows1 = vaultRows.map(r => ({
              id: r.id,
              date: r.date,
              branch_id: r.branch_id,
              party_type: r.party_type,
              tx_type: r.tx_type,
              amount: r.amount,
              remarks: r.remarks
            }));
            const { error: errFb1 } = await supabase.from('front_teller_vault_entries').insert(fallbackRows1);
            if (errFb1) {
              const fallbackRows2 = vaultRows.map(r => ({
                id: r.id,
                date: r.date,
                branch_id: r.branch_id,
                data: r.data
              }));
              const { error: errFb2 } = await supabase.from('front_teller_vault_entries').insert(fallbackRows2);
              if (errFb2) console.warn("Notice: front_teller_vault_entries sync notice:", errFb2.message);
            }
          }
        }
      } catch (errVault) {
        console.warn("Exception in vault entry sync:", errVault);
      }

      // 6. Sync Back Office Entries (back_office_entries)
      try {
        await supabase.from('back_office_entries').delete().in('date', allDates).in('branch_id', branchAliases);

        const boRows = (data.officeTransactions || []).filter(o => o.origin !== 'transaction').map(o => ({
          id: o.id || safeUUID(),
          date,
          branch_id: finalBranchId,
          head: o.head || 'General',
          amount: Number(o.amount) || 0,
          type: o.type === 'in' ? 'in' : 'out',
          remarks: o.remarks || '',
          data: o,
          created_at: new Date().toISOString()
        }));

        if (boRows.length > 0) {
          const { error } = await supabase.from('back_office_entries').insert(boRows);
          if (error) {
            console.warn("Notice inserting back_office_entries primary rows:", error.message);
            const fallbackRows1 = boRows.map(r => ({
              id: r.id,
              date: r.date,
              branch_id: r.branch_id,
              head: r.head,
              amount: r.amount,
              type: r.type,
              remarks: r.remarks
            }));
            const { error: errFb1 } = await supabase.from('back_office_entries').insert(fallbackRows1);
            if (errFb1) {
              const fallbackRows2 = boRows.map(r => ({
                id: r.id,
                date: r.date,
                branch_id: r.branch_id,
                data: r.data
              }));
              const { error: errFb2 } = await supabase.from('back_office_entries').insert(fallbackRows2);
              if (errFb2) console.warn("Notice: back_office_entries sync notice:", errFb2.message);
            }
          }
        }
      } catch (errBo) {
        console.warn("Exception in back office entry sync:", errBo);
      }
    } catch (e) {
      console.warn("Outermost error syncing granular Front Teller transactions:", e);
    }
  },
  async saveDayData(date: string, branchId: string, data: DailyData) {
    invalidateMemoryCache('daily_data');
    const bsDate = toBsDateString(date);
    const adDate = toAdDateString(date);
    const finalBranchId = await this.verifyAndGetBranchId(branchId).catch(() => branchId || 'main');

    const updatedData = { ...data, date: bsDate, branchId: finalBranchId };

    const local = getLocalDB<Record<string, DailyData>>('daily_data', {});
    local[`${bsDate}_${finalBranchId}`] = updatedData;
    if (branchId && branchId !== finalBranchId) {
      local[`${bsDate}_${branchId}`] = updatedData;
    }
    if (finalBranchId === 'main') {
      local[bsDate] = updatedData;
      local[adDate] = updatedData;
      local[date] = updatedData;
    }
    saveLocalDB('daily_data', local);

    try {
      const { error } = await supabase.from('daily_data').upsert({
        id: `${bsDate}_${finalBranchId}`,
        date: bsDate,
        branch_id: finalBranchId,
        data: updatedData
      });
      if (error) {
        console.warn("Failed primary daily_data upsert, trying fallback:", error.message);
        await supabase.from('daily_data').upsert({
          id: `${bsDate}_${branchId}`,
          date: bsDate,
          branch_id: finalBranchId,
          data: updatedData
        });
      }

      // Sync granular transaction tables on Supabase without deleting existing back office entries
      await this.syncFrontTellerTransactions(bsDate, finalBranchId, updatedData);
    } catch (e) {
      console.warn("Failed to save day data to Supabase, saved locally:", e);
    }
  },
  async getDayData(date: string, branchId: string): Promise<DailyData | null> {
    const bsDate = toBsDateString(date);
    const adDate = toAdDateString(date);
    const bId = branchId || 'main';

    try {
      const allData = await this.getAllDailyData(bId);
      if (allData[bsDate]) {
        return allData[bsDate];
      }
      if (allData[adDate]) {
        return allData[adDate];
      }
      return null;
    } catch (e) {
      console.warn("Falling back to local for getDayData on error:", e);
      const local = getLocalDB<Record<string, DailyData>>('daily_data', {});
      if (local[`${bsDate}_${bId}`]) {
        return { ...local[`${bsDate}_${bId}`], date: bsDate, branchId: bId };
      }
      return null;
    }
  },
  getLocalDailyData(branchId?: string): Record<string, DailyData> {
    const isAll = !branchId || branchId === 'all' || branchId === 'consolidated';
    const targetNormalized = isAll ? 'all' : normalizeBranchId(branchId);
    const isBranchMatchLocal = (itemBranch?: string) => {
      if (isAll) return true;
      return normalizeBranchId(itemBranch) === targetNormalized;
    };
    const local = getLocalDB<Record<string, DailyData>>('daily_data', {});
    const result: Record<string, DailyData> = {};
    Object.keys(local).forEach(k => {
      const item = local[k];
      if (!item) return;
      if (k === 'FD_RECORDS_STORE' || k === 'OFFICE_EXPENSES_STORE' || k === 'SAVED_EXPENSE_SHEETS_STORE' || k === 'FIXED_OFFICE_EXPENSE_CONFIGS') return;
      const itemBranch = item.branchId || (k.includes('_') ? k.split('_').slice(1).join('_') : 'main');
      if (!isBranchMatchLocal(itemBranch)) return;
      const bsKey = toBsDateString(item.date || k.split('_')[0] || k);
      const itemData = { ...item, date: bsKey, branchId: itemBranch };
      if (result[bsKey]) {
        result[bsKey] = mergeDailyData(result[bsKey], itemData);
      } else {
        result[bsKey] = itemData;
      }
    });
    return result;
  },
  async getAllDailyData(branchId?: string): Promise<Record<string, DailyData>> {
    const isAll = !branchId || branchId === 'all' || branchId === 'consolidated';
    const targetNormalized = isAll ? 'all' : normalizeBranchId(branchId);
    const cacheKey = `daily_data_${targetNormalized}`;

    const fallbackFetcher = () => this.getLocalDailyData(branchId);

    return fetchWithCache(cacheKey, async () => {
      const isBranchMatchLocal = (itemBranch?: string) => {
        if (isAll) return true;
        return normalizeBranchId(itemBranch) === targetNormalized;
      };

      try {
        let query = supabase.from('daily_data').select('*');
        if (!isAll && branchId) {
          const branchAliases = [
            branchId,
            branchId === 'main' ? 'C01' : '',
            branchId === 'sahodba' ? 'C02' : '',
            branchId === 'pipra' ? 'C03' : '',
            branchId === 'parsa' ? 'C04' : '',
            branchId === 'C01' ? 'main' : '',
            branchId === 'C02' ? 'sahodba' : '',
            branchId === 'C03' ? 'pipra' : '',
            branchId === 'C04' ? 'parsa' : ''
          ].filter(Boolean);
          query = query.in('branch_id', branchAliases);
        }
        const { data, error } = await query;
        if (error) throw error;
        
        const result: Record<string, DailyData> = {};
        
        (data || []).forEach(item => {
          if (item.id === 'FD_RECORDS_STORE' || item.id === 'OFFICE_EXPENSES_STORE' || item.id === 'SAVED_EXPENSE_SHEETS_STORE' || item.id === 'FIXED_OFFICE_EXPENSE_CONFIGS') return;
          const itemBranch = item.branch_id || item.data?.branchId || (item.id?.includes('_') ? item.id.split('_').slice(1).join('_') : 'main');
          if (!isBranchMatchLocal(itemBranch)) return;
          const bsKey = toBsDateString(item.date || item.id.split('_')[0] || item.id);
          const resolvedBranch = itemBranch !== 'consolidated' ? itemBranch : 'main';
          const itemData = { 
            ...item.data, 
            date: bsKey, 
            branchId: resolvedBranch,
            remittances: (item.data?.remittances || []).map((r: any) => ({
              ...r,
              branchId: r.branchId && r.branchId !== 'consolidated' ? r.branchId : resolvedBranch
            })),
            officeTransactions: (item.data?.officeTransactions || []).map((o: any) => ({
              ...o,
              branchId: o.branchId && o.branchId !== 'consolidated' ? o.branchId : resolvedBranch
            }))
          };
          
          if (result[bsKey]) {
            result[bsKey] = mergeDailyData(result[bsKey], itemData);
          } else {
            result[bsKey] = itemData;
          }
        });

        // Also populate from back_office_entries only for dates that do not already have daily_data
        try {
          let boQuery = supabase.from('back_office_entries').select('*');
          if (!isAll && branchId) {
            const branchAliases = [
              branchId,
              branchId === 'main' ? 'C01' : '',
              branchId === 'sahodba' ? 'C02' : '',
              branchId === 'pipra' ? 'C03' : '',
              branchId === 'parsa' ? 'C04' : '',
              branchId === 'C01' ? 'main' : '',
              branchId === 'C02' ? 'sahodba' : '',
              branchId === 'C03' ? 'pipra' : '',
              branchId === 'C04' ? 'parsa' : ''
            ].filter(Boolean);
            boQuery = boQuery.in('branch_id', branchAliases);
          }
          const { data: boData } = await boQuery;
          if (boData && boData.length > 0) {
            boData.forEach(row => {
              const bsKey = toBsDateString(row.date);
              const k = bsKey;
              // Only seed if no daily_data row exists for this date so deletions in daily_data are never reverted
              if (!result[k]) {
                result[k] = {
                  date: bsKey,
                  branchId: row.branch_id || (isAll ? 'main' : branchId) || 'main',
                  officeTransactions: [],
                  denominations: [],
                  denoAdjustments: [],
                  transactions: [],
                  remittances: []
                };
                const boItem: OfficeAccountEntry = row.data || {
                  id: String(row.id),
                  head: row.head || 'General',
                  amount: Number(row.amount) || 0,
                  type: row.type === 'in' ? 'in' : 'out',
                  date: bsKey,
                  remarks: row.remarks || '',
                  createdBy: 'sys',
                  branchId: row.branch_id || (isAll ? 'main' : branchId) || 'main',
                  origin: 'income_expense'
                };
                result[k].officeTransactions.push(boItem);
              }
            });
          }
        } catch (errBo) {
          console.warn("Notice fetching back_office_entries in getAllDailyData:", errBo);
        }

        // Ensure granular ledger entries from front_teller_ledger_entries are also merged
        try {
          let ledgerQuery = supabase.from('front_teller_ledger_entries').select('*');
          if (!isAll && branchId) {
            const branchAliases = [
              branchId,
              branchId === 'main' ? 'C01' : '',
              branchId === 'sahodba' ? 'C02' : '',
              branchId === 'pipra' ? 'C03' : '',
              branchId === 'parsa' ? 'C04' : '',
              branchId === 'C01' ? 'main' : '',
              branchId === 'C02' ? 'sahodba' : '',
              branchId === 'C03' ? 'pipra' : '',
              branchId === 'C04' ? 'parsa' : ''
            ].filter(Boolean);
            ledgerQuery = ledgerQuery.in('branch_id', branchAliases);
          }
          const { data: ledgerData } = await ledgerQuery;
          if (ledgerData && ledgerData.length > 0) {
            ledgerData.forEach(row => {
              const bsKey = toBsDateString(row.date);
              const k = bsKey;
              if (!result[k]) {
                result[k] = {
                  date: bsKey,
                  branchId: row.branch_id || (isAll ? 'main' : branchId) || 'main',
                  officeTransactions: [],
                  denominations: [],
                  denoAdjustments: [],
                  transactions: [],
                  remittances: []
                };
              }
              const txList = result[k].transactions || [];
              const rowId = String(row.id);
              const rowDesc = (row.account_title || row.description || '').trim();
              const rowAmt = Number(row.amount) || 0;
              const rowType = row.type === 'in' ? 'in' : 'out';
              const isAlreadyPresent = txList.some(t => 
                (t.id && t.id === rowId) || 
                (t.description?.trim().toUpperCase() === rowDesc.toUpperCase() && Number(t.amount) === rowAmt && t.type === rowType)
              );
              if (!isAlreadyPresent) {
                const txItem: ReceivablePayableEntry = {
                  id: rowId,
                  description: rowDesc,
                  accountId: row.account_id || row.data?.accountId,
                  amount: rowAmt,
                  type: rowType,
                  remarks: row.remarks || '',
                  date: bsKey,
                  createdBy: 'sys',
                  branchId: row.branch_id || (isAll ? 'main' : branchId) || 'main'
                };
                txList.push(txItem);
                result[k].transactions = txList;
              }
            });
          }
        } catch (errLedger) {
          console.warn("Notice fetching front_teller_ledger_entries in getAllDailyData:", errLedger);
        }
        
        // Update local storage cache: wipe stale keys for this branch and write fresh remote result
        const local = getLocalDB<Record<string, DailyData>>('daily_data', {});
        if (!isAll && branchId) {
          Object.keys(local).forEach(k => {
            if (k === 'FD_RECORDS_STORE' || k === 'OFFICE_EXPENSES_STORE' || k === 'SAVED_EXPENSE_SHEETS_STORE' || k === 'FIXED_OFFICE_EXPENSE_CONFIGS') return;
            const item = local[k];
            const itemBranch = item?.branchId || (k.includes('_') ? k.split('_').slice(1).join('_') : 'main');
            if (normalizeBranchId(itemBranch) === targetNormalized) {
              delete local[k];
            }
          });
          Object.keys(result).forEach(k => {
            local[`${k}_${branchId}`] = result[k];
          });
        } else {
          Object.keys(result).forEach(k => {
            local[k] = result[k];
          });
        }
        saveLocalDB('daily_data', local);

        return result;
      } catch (e) {
        console.warn("Falling back to localStorage for getAllDailyData:", e);
        const local = getLocalDB<Record<string, DailyData>>('daily_data', {});
        const result: Record<string, DailyData> = {};
        Object.keys(local).forEach(k => {
          const item = local[k];
          if (!item) return;
          if (k === 'FD_RECORDS_STORE' || k === 'OFFICE_EXPENSES_STORE' || k === 'SAVED_EXPENSE_SHEETS_STORE' || k === 'FIXED_OFFICE_EXPENSE_CONFIGS') return;
          const itemBranch = item.branchId || (k.includes('_') ? k.split('_').slice(1).join('_') : 'main');
          if (!isBranchMatchLocal(itemBranch)) return;
          const bsKey = toBsDateString(item.date || k.split('_')[0] || k);
          const itemData = { ...item, date: bsKey, branchId: itemBranch };
          if (result[bsKey]) {
            result[bsKey] = mergeDailyData(result[bsKey], itemData);
          } else {
            result[bsKey] = itemData;
          }
        });
        return result;
      }
    }, { 
      ttlMs: 30000, 
      timeoutMs: 12000, 
      fallbackFn: fallbackFetcher, 
      fallbackLocalKey: 'daily_data', 
      defaultVal: {} 
    });
  },
  async deleteDayData(date: string, branchId?: string) {
    invalidateMemoryCache('daily_data');
    const bsDate = toBsDateString(date);
    const adDate = toAdDateString(date);
    const targetBranch = branchId && branchId !== 'ALL' ? branchId : undefined;

    const getAliases = (bid: string) => {
      const norm = normalizeBranchId(bid);
      return Array.from(new Set([
        bid,
        norm,
        norm === 'main' ? 'C01' : '',
        norm === 'sahodba' ? 'C02' : '',
        norm === 'pipra' ? 'C03' : '',
        norm === 'parsa' ? 'C04' : '',
        bid === 'C01' ? 'main' : '',
        bid === 'C02' ? 'sahodba' : '',
        bid === 'C03' ? 'pipra' : '',
        bid === 'C04' ? 'parsa' : ''
      ].filter(Boolean)));
    };

    const branchAliases = targetBranch ? getAliases(targetBranch) : [];

    // Clean up local cache
    const local = getLocalDB<Record<string, DailyData>>('daily_data', {});
    const keysToDelete = Object.keys(local).filter(k => {
      const kBs = toBsDateString(k);
      const kAd = toAdDateString(k);
      const itemDateBs = local[k]?.date ? toBsDateString(local[k].date) : '';
      const itemDateAd = local[k]?.date ? toAdDateString(local[k].date) : '';
      const itemBranch = local[k]?.branchId;

      const dateMatches = (
        k === bsDate ||
        k === adDate ||
        k === date ||
        kBs === bsDate ||
        kAd === adDate ||
        itemDateBs === bsDate ||
        itemDateAd === adDate ||
        k.startsWith(`${bsDate}_`) ||
        k.startsWith(`${adDate}_`) ||
        k.startsWith(`${date}_`)
      );

      if (!dateMatches) return false;

      if (targetBranch) {
        if (itemBranch) {
          return branchAliases.some(alias => itemBranch === alias || normalizeBranchId(itemBranch) === normalizeBranchId(alias));
        }
        return branchAliases.some(alias => k.endsWith(`_${alias}`) || k.includes(`_${alias}_`)) || (normalizeBranchId(targetBranch) === 'main' && !k.includes('_'));
      }
      return true;
    });

    keysToDelete.forEach(k => delete local[k]);
    saveLocalDB('daily_data', local);

    try {
      const deletePromises: PromiseLike<unknown>[] = [];
      const granularTables = [
        'front_teller_ledger_entries',
        'front_teller_counter_entries',
        'front_teller_remittance_entries',
        'front_teller_deno_adjustments',
        'front_teller_vault_entries',
        'back_office_entries'
      ];
      const granularPromises: PromiseLike<unknown>[] = [];

      if (targetBranch) {
        branchAliases.forEach(alias => {
          deletePromises.push(
            supabase.from('daily_data').delete().eq('id', `${bsDate}_${alias}`),
            supabase.from('daily_data').delete().eq('id', `${adDate}_${alias}`),
            supabase.from('daily_data').delete().eq('id', `${date}_${alias}`),
            supabase.from('daily_data').delete().eq('date', bsDate).eq('branch_id', alias),
            supabase.from('daily_data').delete().eq('date', adDate).eq('branch_id', alias),
            supabase.from('daily_data').delete().eq('date', date).eq('branch_id', alias)
          );
        });

        granularTables.forEach(tbl => {
          branchAliases.forEach(alias => {
            granularPromises.push(
              supabase.from(tbl).delete().eq('date', bsDate).eq('branch_id', alias),
              supabase.from(tbl).delete().eq('date', adDate).eq('branch_id', alias),
              supabase.from(tbl).delete().eq('date', date).eq('branch_id', alias)
            );
          });
        });
      } else {
        deletePromises.push(
          supabase.from('daily_data').delete().like('id', `${bsDate}%`),
          supabase.from('daily_data').delete().like('id', `${adDate}%`),
          supabase.from('daily_data').delete().like('id', `${date}%`),
          supabase.from('daily_data').delete().eq('date', bsDate),
          supabase.from('daily_data').delete().eq('date', adDate),
          supabase.from('daily_data').delete().eq('date', date)
        );

        granularTables.forEach(tbl => {
          granularPromises.push(
            supabase.from(tbl).delete().eq('date', bsDate),
            supabase.from(tbl).delete().eq('date', adDate),
            supabase.from(tbl).delete().eq('date', date),
            supabase.from(tbl).delete().like('id', `${bsDate}%`),
            supabase.from(tbl).delete().like('id', `${adDate}%`),
            supabase.from(tbl).delete().like('id', `${date}%`)
          );
        });
      }

      await Promise.allSettled([...deletePromises, ...granularPromises]);
    } catch (e) {
      console.warn("Failed to delete day data from Supabase, deleted locally:", e);
    }
  },

  async deleteDayDataRange(fromDate: string, toDate: string, branchId?: string) {
    invalidateMemoryCache('daily_data');
    const fromBs = toBsDateString(fromDate);
    const toBs = toBsDateString(toDate);
    const fromAd = toAdDateString(fromDate);
    const toAd = toAdDateString(toDate);
    const targetBranch = branchId && branchId !== 'ALL' ? branchId : undefined;

    const getAliases = (bid: string) => {
      const norm = normalizeBranchId(bid);
      return Array.from(new Set([
        bid,
        norm,
        norm === 'main' ? 'C01' : '',
        norm === 'sahodba' ? 'C02' : '',
        norm === 'pipra' ? 'C03' : '',
        norm === 'parsa' ? 'C04' : '',
        bid === 'C01' ? 'main' : '',
        bid === 'C02' ? 'sahodba' : '',
        bid === 'C03' ? 'pipra' : '',
        bid === 'C04' ? 'parsa' : ''
      ].filter(Boolean)));
    };

    const branchAliases = targetBranch ? getAliases(targetBranch) : [];

    // Clean up local cache
    const local = getLocalDB<Record<string, DailyData>>('daily_data', {});
    const keysToDelete = Object.keys(local).filter(k => {
      const kBs = toBsDateString(k);
      const kAd = toAdDateString(k);
      const itemDateBs = local[k]?.date ? toBsDateString(local[k].date) : '';
      const itemDateAd = local[k]?.date ? toAdDateString(local[k].date) : '';
      const itemBranch = local[k]?.branchId;

      const targetBs = itemDateBs || kBs;
      const targetAd = itemDateAd || kAd;

      const bsInRange = targetBs >= fromBs && targetBs <= toBs;
      const adInRange = targetAd >= fromAd && targetAd <= toAd;
      const dateInRange = bsInRange || adInRange;

      if (!dateInRange) return false;

      if (targetBranch) {
        if (itemBranch) {
          return branchAliases.some(alias => itemBranch === alias || normalizeBranchId(itemBranch) === normalizeBranchId(alias));
        }
        return branchAliases.some(alias => k.endsWith(`_${alias}`) || k.includes(`_${alias}_`)) || (normalizeBranchId(targetBranch) === 'main' && !k.includes('_'));
      }
      return true;
    });

    keysToDelete.forEach(k => delete local[k]);
    saveLocalDB('daily_data', local);

    try {
      const promises: PromiseLike<unknown>[] = [];
      const granularTables = [
        'front_teller_ledger_entries',
        'front_teller_counter_entries',
        'front_teller_remittance_entries',
        'front_teller_deno_adjustments',
        'front_teller_vault_entries',
        'back_office_entries'
      ];

      if (targetBranch) {
        branchAliases.forEach(alias => {
          promises.push(
            supabase.from('daily_data').delete().gte('date', fromBs).lte('date', toBs).eq('branch_id', alias),
            supabase.from('daily_data').delete().gte('date', fromAd).lte('date', toAd).eq('branch_id', alias),
            supabase.from('daily_data').delete().gte('id', `${fromBs}_${alias}`).lte('id', `${toBs}_${alias}\uffff`).like('id', `%_${alias}`),
            supabase.from('daily_data').delete().gte('id', `${fromAd}_${alias}`).lte('id', `${toAd}_${alias}\uffff`).like('id', `%_${alias}`)
          );
          granularTables.forEach(tbl => {
            promises.push(
              supabase.from(tbl).delete().gte('date', fromBs).lte('date', toBs).eq('branch_id', alias),
              supabase.from(tbl).delete().gte('date', fromAd).lte('date', toAd).eq('branch_id', alias)
            );
          });
        });
      } else {
        promises.push(
          supabase.from('daily_data').delete().gte('date', fromBs).lte('date', toBs),
          supabase.from('daily_data').delete().gte('date', fromAd).lte('date', toAd),
          supabase.from('daily_data').delete().gte('id', fromBs).lte('id', `${toBs}_\uffff`),
          supabase.from('daily_data').delete().gte('id', fromAd).lte('id', `${toAd}_\uffff`)
        );

        granularTables.forEach(tbl => {
          promises.push(
            supabase.from(tbl).delete().gte('date', fromBs).lte('date', toBs),
            supabase.from(tbl).delete().gte('date', fromAd).lte('date', toAd)
          );
        });
      }

      await Promise.allSettled(promises);
    } catch (e) {
      console.warn("Failed range deletion from Supabase, deleted locally:", e);
    }
  },

  // Ledger Accounts
  async getLedgerAccounts(branchId?: string): Promise<LedgerAccount[]> {
    const key = `ledger_accounts_${normalizeBranchId(branchId)}`;
    return fetchWithCache(key, async () => {
      let remoteParsed: LedgerAccount[] = [];
    try {
      // Fetch all ledger accounts so employee accounts created at HO can be mapped to work branches
      const query = supabase.from('ledger_accounts').select('*');
      const { data, error } = await query;
      if (error) throw error;
      remoteParsed = (data || []).map(a => {
        let extra = {
          type: 'Customer',
          interestRate: 0,
          mobile: '',
          address: '',
          photoUrl: '',
          capitalizationFrequency: 'None',
          capitalizeToPrincipal: true,
          employeeId: '',
          employeeBranchId: '',
          employeeCode: ''
        };
        
        if (a.category) {
          try {
            if (typeof a.category === 'string' && a.category.trim().startsWith('{')) {
              const parsed = JSON.parse(a.category);
              extra = { ...extra, ...parsed };
            } else if (typeof a.category === 'object' && a.category !== null) {
              extra = { ...extra, ...a.category };
            } else {
              extra.type = String(a.category);
            }
          } catch (e) {
            extra.type = String(a.category);
          }
        }

        let parsedCreatedAt = Date.now();
        if (a.created_at) {
          if (!isNaN(Number(a.created_at))) {
            parsedCreatedAt = Number(a.created_at);
          } else {
            const dt = new Date(a.created_at).getTime();
            if (!isNaN(dt)) parsedCreatedAt = dt;
          }
        }

        return {
          id: String(a.id),
          name: String(a.name || ''),
          branchId: a.branch_id || 'main',
          openingBalance: Number(a.initial_balance) || 0,
          initialBalance: Number(a.initial_balance) || 0,
          status: (a.status || 'Active') as 'Active' | 'Closed',
          createdAt: parsedCreatedAt,
          type: (extra.type || 'Customer') as LedgerAccount['type'],
          interestRate: Number(extra.interestRate) || 0,
          mobile: extra.mobile || '',
          address: extra.address || '',
          photoUrl: extra.photoUrl || '',
          capitalizationFrequency: (extra.capitalizationFrequency || 'None') as LedgerAccount['capitalizationFrequency'],
          capitalizeToPrincipal: extra.capitalizeToPrincipal !== false,
          employeeId: extra.employeeId || undefined,
          employeeBranchId: extra.employeeBranchId || undefined,
          employeeCode: extra.employeeCode || undefined
        };
      });
    } catch (e) {
      console.warn("Falling back to localStorage for getLedgerAccounts query:", e);
    }

    // Merge remote items with local items so newly created local accounts are never lost
    const local = getLocalDB<LedgerAccount[]>('ledger_accounts', []);
    const map = new Map<string, LedgerAccount>();

    // 1. Put remote parsed items
    remoteParsed.forEach(acc => map.set(acc.id, acc));

    // 2. Merge local items if not already present or if local is newer
    local.forEach(acc => {
      if (!acc || !acc.id) return;
      if (!map.has(acc.id)) {
        map.set(acc.id, acc);
      }
    });

    // 3. Dynamic binding of all employees from HR Employee Directory
    let allEmployees: Employee[] = [];
    try {
      allEmployees = getLocalDB<Employee[]>('employees', []);
      if (allEmployees.length === 0) {
        const { data: empData } = await supabase.from('employees').select('*');
        if (empData) {
          allEmployees = empData.map(e => ({
            id: e.id,
            fullName: e.full_name,
            employeeCode: e.employee_code,
            branchId: e.branch_id || 'main',
            status: e.status || 'Active',
            mobile: e.mobile || '',
            permanentAddress: e.permanent_address || '',
            temporaryAddress: e.temporary_address || '',
            department: e.department || '',
            designation: e.designation || 'Staff',
            joinedDate: e.joined_date || '',
            basicSalary: Number(e.basic_salary) || 0,
            daType: 'Percentage',
            daValue: 0,
            dearnessAllowance: 0,
            gradeRate: 0,
            gradeRateAmount: 0,
            hasSSF: false,
            ssfContribution: 0,
            hasPF: false,
            pfContribution: 0,
            hasGratuity: false,
            gratuity: 0,
            hasDashain: false,
            dashainBonus: 0,
            hasMedical: false,
            medicalAllowance: 0,
            hasBonus: false,
            bonusYearly: 0,
            panNo: e.pan_no || '',
            photoUrl: e.photo_url || '',
            gender: 'Male',
            maritalStatus: 'Single',
            employmentType: 'Permanent'
          }));
        }
      }
    } catch (err) {
      allEmployees = getLocalDB<Employee[]>('employees', []);
    }

    allEmployees.forEach(emp => {
      if (!emp || !emp.fullName) return;
      const empClean = emp.fullName.trim().toLowerCase();
      const existing = Array.from(map.values()).find(a => 
        (a.employeeId && a.employeeId === emp.id) ||
        (a.employeeCode && emp.employeeCode && a.employeeCode.trim().toLowerCase() === emp.employeeCode.trim().toLowerCase()) ||
        (a.name && a.name.trim().toLowerCase() === empClean)
      );

      if (existing) {
        existing.employeeId = emp.id;
        existing.employeeCode = emp.employeeCode || existing.employeeCode;
        existing.employeeBranchId = emp.branchId || 'main';
        existing.type = existing.type || 'Staff';
        if (emp.status === 'Inactive') existing.status = 'Closed';
      } else {
        const autoStaff: LedgerAccount = {
          id: `staff_${emp.id}`,
          name: emp.fullName.trim(),
          branchId: emp.branchId || 'main',
          openingBalance: 0,
          initialBalance: 0,
          status: emp.status === 'Inactive' ? 'Closed' : 'Active',
          createdAt: Date.now(),
          type: 'Staff',
          interestRate: 0,
          mobile: emp.mobile || '',
          address: emp.permanentAddress || emp.temporaryAddress || '',
          capitalizationFrequency: 'None',
          capitalizeToPrincipal: true,
          employeeId: emp.id,
          employeeBranchId: emp.branchId || 'main',
          employeeCode: emp.employeeCode || ''
        };
        map.set(autoStaff.id, autoStaff);
      }
    });

    const merged = Array.from(map.values());
    saveLocalDB('ledger_accounts', merged);

    if (branchId && branchId !== 'all') {
      const targetNorm = normalizeBranchId(branchId);
      
      return merged.filter(a => {
        const aBranchNorm = normalizeBranchId(a.branchId);
        const empBranchNorm = normalizeBranchId(a.employeeBranchId);

        // 1. Direct branch account match
        if (aBranchNorm === targetNorm) return true;

        // 2. Direct employee branch match
        if (empBranchNorm === targetNorm) return true;

        // 3. Dynamic lookup from employee master
        if (a.employeeId || a.employeeCode || a.type === 'Staff') {
          const matchedEmp = allEmployees.find(e => 
            (a.employeeId && e.id === a.employeeId) ||
            (a.employeeCode && e.employeeCode && e.employeeCode.trim().toLowerCase() === a.employeeCode.trim().toLowerCase()) ||
            (e.fullName && a.name && e.fullName.trim().toLowerCase() === a.name.trim().toLowerCase())
          );
          if (matchedEmp) {
            const empActiveBranchNorm = normalizeBranchId(matchedEmp.branchId);
            if (empActiveBranchNorm === targetNorm) return true;
          }
        }

        return false;
      });
    }
    return merged;
    }, { ttlMs: 30000, timeoutMs: 10000, fallbackLocalKey: 'ledger_accounts', defaultVal: [] });
  },
  async saveLedgerAccount(account: LedgerAccount) {
    invalidateMemoryCache('ledger_accounts');
    const finalBranchId = await this.verifyAndGetBranchId(account.branchId).catch(() => account.branchId || 'main');
    
    const extraPayload = {
      type: account.type || 'Customer',
      interestRate: Number(account.interestRate) || 0,
      mobile: account.mobile || '',
      address: account.address || '',
      photoUrl: account.photoUrl || '',
      capitalizationFrequency: account.capitalizationFrequency || 'None',
      capitalizeToPrincipal: account.capitalizeToPrincipal !== false,
      employeeId: account.employeeId || '',
      employeeBranchId: account.employeeBranchId || '',
      employeeCode: account.employeeCode || ''
    };

    // Save locally first
    const local = getLocalDB<LedgerAccount[]>('ledger_accounts', []);
    const updated = [account, ...local.filter(a => a.id !== account.id)];
    saveLocalDB('ledger_accounts', updated);

    const initBal = account.openingBalance ?? account.initialBalance ?? 0;
    
    // Attempt 1: All potential columns including ISO created_at and branch_id
    let { error } = await supabase.from('ledger_accounts').upsert({
      id: account.id,
      name: account.name,
      category: JSON.stringify(extraPayload),
      type: account.type || 'Customer',
      branch_id: finalBranchId,
      initial_balance: initBal,
      status: account.status || 'Active',
      is_active: account.status !== 'Closed',
      created_at: new Date(account.createdAt || Date.now()).toISOString()
    });

    if (!error) return;
    console.warn("Ledger account upsert 1 notice, trying fallback 2:", error.message);

    // Attempt 2: Numerical timestamp created_at
    ({ error } = await supabase.from('ledger_accounts').upsert({
      id: account.id,
      name: account.name,
      category: JSON.stringify(extraPayload),
      type: account.type || 'Customer',
      branch_id: finalBranchId,
      initial_balance: initBal,
      status: account.status || 'Active',
      is_active: account.status !== 'Closed',
      created_at: account.createdAt || Date.now()
    }));

    if (!error) return;
    console.warn("Ledger account upsert 2 notice, trying fallback 3 (without branch_id):", error.message);

    // Attempt 3: Without branch_id
    ({ error } = await supabase.from('ledger_accounts').upsert({
      id: account.id,
      name: account.name,
      category: JSON.stringify(extraPayload),
      type: account.type || 'Customer',
      initial_balance: initBal,
      status: account.status || 'Active',
      is_active: account.status !== 'Closed'
    }));

    if (!error) return;
    console.warn("Ledger account upsert 3 notice, trying minimal fallback 4:", error.message);

    // Attempt 4: Minimal fallback (id, name, category)
    ({ error } = await supabase.from('ledger_accounts').upsert({
      id: account.id,
      name: account.name,
      category: JSON.stringify(extraPayload)
    }));

    try {
      window.dispatchEvent(new Event('ledgerAccountsUpdated'));
    } catch (e) {}

    if (error) {
      console.error("All ledger account upsert attempts failed in Supabase:", error.message);
      throw new Error(`Ledger Supabase Error: ${error.message}`);
    }
  },
  async deleteLedgerAccount(id: string) {
    invalidateMemoryCache('ledger_accounts');
    const local = getLocalDB<LedgerAccount[]>('ledger_accounts', []);
    saveLocalDB('ledger_accounts', local.filter(a => a.id !== id));
    try {
      window.dispatchEvent(new Event('ledgerAccountsUpdated'));
    } catch (e) {}
    try {
      const { error } = await supabase.from('ledger_accounts').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete ledger account from Supabase, deleted locally:", e);
    }
  },

  // Logs
  async getLogs(branchId?: string): Promise<AuditLog[]> {
    const key = `audit_logs_${normalizeBranchId(branchId)}`;
    return fetchWithCache(key, async () => {
      try {
        let query = supabase.from('audit_logs').select('*');
        if (branchId) query = query.eq('branch_id', branchId);
        
        let data: any[] | null = null;
        let error: any = null;

        // Try ordering by timestamp
        const res1 = await query.order('timestamp', { ascending: false }).limit(2000);
        if (res1.error) {
          // Fallback without explicit order
          const res2 = await supabase.from('audit_logs').select('*').limit(2000);
          data = res2.data;
          error = res2.error;
        } else {
          data = res1.data;
        }

        if (error || !data) {
          console.warn("Notice: Fetching remote audit logs fallback to local storage:", error?.message);
          const local = getLocalDB<AuditLog[]>('audit_logs', getLocalDB<AuditLog[]>('logs', []));
          if (branchId) {
            return local.filter(l => (l.branchId || 'main') === branchId);
          }
          return local;
        }

        const logs: AuditLog[] = (data || []).map(l => {
          const numTs = Number(l.timestamp);
          const parsedTs = Number.isFinite(numTs) && numTs > 0
            ? numTs
            : (l.created_at ? new Date(l.created_at).getTime() : Date.now());
          return {
            id: String(l.id || safeUUID()),
            timestamp: parsedTs,
            userId: l.user_id || l.userId || 'admin',
            branchId: l.branch_id || l.branchId || 'main',
            action: l.action || 'LOG',
            details: l.details || '',
            ip: l.ip || 'Internal',
            device: l.device || 'Admin Portal'
          };
        });

        const local = getLocalDB<AuditLog[]>('audit_logs', getLocalDB<AuditLog[]>('logs', []));
        const remoteIds = new Set(logs.map(l => l.id));
        const merged = [...logs, ...local.filter(l => l && l.id && !remoteIds.has(l.id))].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        saveLocalDB('audit_logs', merged);
        saveLocalDB('logs', merged);

        if (branchId) {
          return merged.filter(l => (l.branchId || 'main') === branchId);
        }
        return merged;
      } catch (e) {
        console.warn("Notice: Audit log fetch exception fallback to local storage:", e);
        const local = getLocalDB<AuditLog[]>('audit_logs', getLocalDB<AuditLog[]>('logs', []));
        if (branchId) {
          return local.filter(l => (l.branchId || 'main') === branchId);
        }
        return local;
      }
    }, { ttlMs: 30000 });
  },

  async saveLog(userId: string, action: string, details: string, branchId?: string) {
    invalidateMemoryCache('audit_logs');
    const logId = safeUUID();
    const logItem: AuditLog = {
      id: logId,
      timestamp: Date.now(),
      userId,
      branchId: branchId || 'main',
      action,
      details,
      ip: 'Internal',
      device: 'Admin Portal'
    };

    const localLogs = getLocalDB<AuditLog[]>('audit_logs', getLocalDB<AuditLog[]>('logs', []));
    const updatedLogs = [logItem, ...localLogs].slice(0, 2000);
    saveLocalDB('audit_logs', updatedLogs);
    saveLocalDB('logs', updatedLogs);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auditLogsUpdated', { detail: logItem }));
    }

    try {
      const payload1 = {
        id: logId,
        timestamp: logItem.timestamp,
        created_at: new Date(logItem.timestamp).toISOString(),
        user_id: userId || 'admin',
        branch_id: branchId || 'main',
        action,
        details,
        ip: 'Internal',
        device: 'Admin Portal'
      };

      const { error } = await supabase.from('audit_logs').upsert(payload1);
      if (error) {
        console.warn("Notice primary insert to audit_logs:", error.message);
        // Fallback payload without created_at if created_at column is missing
        const payload2 = {
          id: logId,
          timestamp: logItem.timestamp,
          user_id: userId || 'admin',
          branch_id: branchId || 'main',
          action,
          details,
          ip: 'Internal',
          device: 'Admin Portal'
        };
        const { error: err2 } = await supabase.from('audit_logs').upsert(payload2);
        if (err2) {
          const payload3 = {
            id: logId,
            user_id: userId || 'admin',
            action,
            details
          };
          const { error: err3 } = await supabase.from('audit_logs').upsert(payload3);
          if (err3) console.warn("Notice: audit_logs upsert fallback 3:", err3.message);
        }
      }
    } catch (e) {
      console.warn("Error saving audit log dynamically:", e);
    }
  },

  // FD Records
  async getFDRecords(): Promise<FDRecordItem[]> {
    return fetchWithCache('fd_records', async () => {
      let remoteParsed: FDRecordItem[] = [];
      try {
        const { data, error } = await supabase.from('fd_records').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        remoteParsed = (data || []).map(r => ({
          id: String(r.id),
          accountType: r.account_type || r.accountType || '',
          holderName: r.holder_name || r.holderName || r.member_name || '',
          holderNameNp: r.holder_name_np || r.holderNameNp || '',
          accountNo: r.account_no || r.accountNo || '',
          selectedBranch: r.selected_branch || r.selectedBranch || r.branch_id || 'main',
          signatoryName: r.signatory_name || r.signatoryName || '',
          issueDate: r.issue_date || r.issueDate || r.start_date || '',
          maturityDate: r.maturity_date || r.maturityDate || '',
          duration: r.duration || (r.duration_months ? String(r.duration_months) : ''),
          interestRate: String(r.interest_rate ?? r.interestRate ?? ''),
          compounding: r.compounding || 'Quarterly',
          tax: String(r.tax ?? '5'),
          amount: String(r.amount ?? '0'),
          amountInWords: r.amount_in_words || r.amountInWords || '',
          totalInterest: String(r.total_interest ?? r.totalInterest ?? '0'),
          taxDeduction: String(r.tax_deduction ?? r.taxDeduction ?? '0'),
          maturityAmount: String(r.maturity_amount ?? r.maturityAmount ?? '0'),
          maturityInWords: r.maturity_in_words || r.maturityInWords || '',
          createdAt: String(r.created_at || r.createdAt || Date.now())
        }));
      } catch (e) {
        console.warn("Notice: getFDRecords remote query fallback to local storage:", e);
      }

      let storeRecords: FDRecordItem[] = [];
      try {
        const { data: storeData } = await supabase
          .from('daily_data')
          .select('*')
          .eq('id', 'FD_RECORDS_STORE')
          .maybeSingle();
        if (storeData && storeData.data && Array.isArray(storeData.data.records)) {
          storeRecords = storeData.data.records;
        }
      } catch (err) {
        console.warn("Notice: daily_data store fetch for FD records:", err);
      }

      const local = getLocalDB<FDRecordItem[]>('fd_records', []);
      let legacySaved: FDRecordItem[] = [];
      try {
        const saved = localStorage.getItem('FD_CERTIFICATE_RECORDS');
        if (saved) {
          const p = JSON.parse(saved);
          if (Array.isArray(p)) legacySaved = p;
        }
      } catch (err) {}

      const map = new Map<string, FDRecordItem>();
      storeRecords.forEach(rec => { if (rec && rec.id) map.set(rec.id, rec); });
      remoteParsed.forEach(rec => { if (rec && rec.id) map.set(rec.id, { ...map.get(rec.id), ...rec }); });
      local.forEach(rec => { if (rec && rec.id) map.set(rec.id, { ...map.get(rec.id), ...rec }); });
      legacySaved.forEach(rec => { if (rec && rec.id) map.set(rec.id, { ...map.get(rec.id), ...rec }); });

      const merged = Array.from(map.values());
      saveLocalDB('fd_records', merged);
      try {
        localStorage.setItem('FD_CERTIFICATE_RECORDS', JSON.stringify(merged));
      } catch (err) {}
      return merged;
    }, { ttlMs: 30000 });
  },

  async saveFDRecord(rec: FDRecordItem) {
    invalidateMemoryCache('fd_records');
    const local = getLocalDB<FDRecordItem[]>('fd_records', []);
    const updated = [rec, ...local.filter(r => r.id !== rec.id)];
    saveLocalDB('fd_records', updated);
    try {
      localStorage.setItem('FD_CERTIFICATE_RECORDS', JSON.stringify(updated));
    } catch (e) {}

    // Dual-save into daily_data table to guarantee JSON persistence in Supabase
    try {
      await supabase.from('daily_data').upsert({
        id: 'FD_RECORDS_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { records: updated }
      });
    } catch (e) {
      console.warn("FD records secondary store upsert notice:", e);
    }

    const numRate = parseFloat(nepaliToEnglishNumber(rec.interestRate || '0')) || 0;
    const numTax = parseFloat(nepaliToEnglishNumber(rec.tax || '0')) || 0;
    const numAmount = parseFloat(nepaliToEnglishNumber(rec.amount || '0')) || 0;
    const numInterest = parseFloat(nepaliToEnglishNumber(rec.totalInterest || '0')) || 0;
    const numTaxDed = parseFloat(nepaliToEnglishNumber(rec.taxDeduction || '0')) || 0;
    const numMatAmt = parseFloat(nepaliToEnglishNumber(rec.maturityAmount || '0')) || 0;

    let isoCreatedAt = new Date().toISOString();
    try {
      if (rec.createdAt && !isNaN(Date.parse(rec.createdAt))) {
        isoCreatedAt = new Date(rec.createdAt).toISOString();
      }
    } catch (e) {}

    // Attempt 1: Standard clean fields (using converted numeric values)
    let { error } = await supabase.from('fd_records').upsert({
      id: rec.id,
      account_type: rec.accountType || '',
      holder_name: rec.holderName || rec.holderNameNp || 'N/A',
      holder_name_np: rec.holderNameNp || '',
      account_no: rec.accountNo || '',
      selected_branch: rec.selectedBranch || 'main',
      signatory_name: rec.signatoryName || '',
      issue_date: rec.issueDate || '',
      maturity_date: rec.maturityDate || '',
      duration: rec.duration || '',
      interest_rate: isNaN(numRate) ? 0 : numRate,
      compounding: rec.compounding || 'Quarterly',
      tax: isNaN(numTax) ? 0 : numTax,
      amount: isNaN(numAmount) ? 0 : numAmount,
      amount_in_words: rec.amountInWords || '',
      total_interest: isNaN(numInterest) ? 0 : numInterest,
      tax_deduction: isNaN(numTaxDed) ? 0 : numTaxDed,
      maturity_amount: isNaN(numMatAmt) ? 0 : numMatAmt,
      maturity_in_words: rec.maturityInWords || '',
      created_at: isoCreatedAt
    });

    if (!error) return;
    console.warn("FD record upsert 1 notice, trying text/string values attempt 2:", error.message);

    // Attempt 2: Direct string fields (for tables where interest_rate/amount are TEXT)
    ({ error } = await supabase.from('fd_records').upsert({
      id: rec.id,
      account_type: rec.accountType || '',
      holder_name: rec.holderName || rec.holderNameNp || 'N/A',
      holder_name_np: rec.holderNameNp || '',
      account_no: rec.accountNo || '',
      selected_branch: rec.selectedBranch || 'main',
      signatory_name: rec.signatoryName || '',
      issue_date: rec.issueDate || '',
      maturity_date: rec.maturityDate || '',
      duration: rec.duration || '',
      interest_rate: nepaliToEnglishNumber(rec.interestRate || '0'),
      compounding: rec.compounding || 'Quarterly',
      tax: nepaliToEnglishNumber(rec.tax || '5'),
      amount: nepaliToEnglishNumber(rec.amount || '0'),
      amount_in_words: rec.amountInWords || '',
      total_interest: nepaliToEnglishNumber(rec.totalInterest || '0'),
      tax_deduction: nepaliToEnglishNumber(rec.taxDeduction || '0'),
      maturity_amount: nepaliToEnglishNumber(rec.maturityAmount || '0'),
      maturity_in_words: rec.maturityInWords || '',
      created_at: isoCreatedAt
    }));

    if (!error) return;
    console.warn("FD record upsert 2 notice, trying legacy schema attempt 3:", error.message);

    // Attempt 3: Legacy table columns (member_name, start_date, branch_id)
    ({ error } = await supabase.from('fd_records').upsert({
      id: rec.id,
      account_no: rec.accountNo || rec.id,
      member_name: rec.holderName || rec.holderNameNp || 'N/A',
      amount: numAmount,
      interest_rate: numRate,
      duration_months: parseInt(nepaliToEnglishNumber(rec.duration || '0')) || 12,
      start_date: rec.issueDate || '',
      maturity_date: rec.maturityDate || '',
      branch_id: rec.selectedBranch || 'main',
      status: 'Active'
    }));

    if (error) {
      console.warn("FD record saved to daily_data store. Notice on fd_records table:", error.message);
    }
  },

  async deleteFDRecord(id: string) {
    invalidateMemoryCache('fd_records');
    const local = getLocalDB<FDRecordItem[]>('fd_records', []);
    const updated = local.filter(r => r.id !== id);
    saveLocalDB('fd_records', updated);
    localStorage.setItem('FD_CERTIFICATE_RECORDS', JSON.stringify(updated));

    try {
      await supabase.from('daily_data').upsert({
        id: 'FD_RECORDS_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { records: updated }
      });
    } catch (e) {}

    try {
      const { error } = await supabase.from('fd_records').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to delete FD record from Supabase, deleted locally:", e);
    }
  },

  // Office Expenses (Operating Expenses: House Rent, Cleaner, Khaja, Electricity Unit Entry, Telephone Bill, etc.)
  async getOfficeExpenses(branchId?: string): Promise<OfficeExpenseRecord[]> {
    const key = `office_expenses_${normalizeBranchId(branchId)}`;
    return fetchWithCache(key, async () => {
      let dbRecords: OfficeExpenseRecord[] = [];
      try {
        let query = supabase.from('office_expenses').select('*');
        if (branchId && branchId !== 'all') {
          query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          dbRecords = data.map((d: any) => {
            const prevVal = d.previous != null
              ? Number(d.previous)
              : (d.previous_unit != null ? Number(d.previous_unit) : (d.previous_reading != null ? Number(d.previous_reading) : undefined));
            const currVal = d.current != null
              ? Number(d.current)
              : (d.current_unit != null ? Number(d.current_unit) : (d.current_reading != null ? Number(d.current_reading) : undefined));
            const consumedVal = d.consumed_units != null
              ? Number(d.consumed_units)
              : (currVal !== undefined && prevVal !== undefined && currVal > prevVal ? currVal - prevVal : undefined);
            const rateVal = d.rate_per_unit != null
              ? Number(d.rate_per_unit)
              : (d.unit_rate != null ? Number(d.unit_rate) : undefined);
            const consNo = d.consumer_no || d.customer_no || undefined;

            return {
              id: d.id,
              branchId: d.branch_id || 'main',
              date: d.date_bs || d.date || '',
              fiscalYear: d.fiscal_year || '',
              month: d.month || '',
              category: d.category || 'other_expenses',
              categoryLabel: d.category_label || undefined,
              amount: Number(d.amount) || 0,
              taxDeduction: Number(d.tax_deduction) || 0,
              taxRate: Number(d.tax_rate) || 0,
              netPaidAmount: Number(d.net_paid_amount) || 0,
              paidTo: d.paid_to || undefined,
              accountNo: d.account_no || undefined,
              bankName: d.bank_name || undefined,
              paymentMethod: d.payment_method || 'Account Transfer',
              voucherNo: d.voucher_no || undefined,
              billNo: d.bill_no || undefined,
              previousUnit: prevVal,
              currentUnit: currVal,
              previous: prevVal,
              current: currVal,
              consumedUnits: consumedVal,
              ratePerUnit: rateVal,
              meterNo: d.meter_no || undefined,
              consumerNo: consNo,
              landlordName: d.landlord_name || undefined,
              cleanerName: d.cleaner_name || undefined,
              workingDays: d.working_days != null ? Number(d.working_days) : undefined,
              serviceProvider: d.service_provider || undefined,
              remarks: d.remarks || undefined,
              attachmentUrl: d.attachment_url || undefined,
              createdAt: Number(d.created_at) || Date.now()
            };
          });
        }
      } catch (err) {
        console.warn("Notice: office_expenses table query:", err);
      }

      let storeRecords: OfficeExpenseRecord[] = [];
      try {
        const { data: storeData } = await supabase
          .from('daily_data')
          .select('*')
          .eq('id', 'OFFICE_EXPENSES_STORE')
          .maybeSingle();
        if (storeData && storeData.data && Array.isArray(storeData.data.records)) {
          storeRecords = storeData.data.records;
        }
      } catch (err) {
        console.warn("Notice: daily_data store fetch for office expenses:", err);
      }

      const local = getLocalDB<OfficeExpenseRecord[]>('office_expenses', []);
      let legacySaved: OfficeExpenseRecord[] = [];
      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem('OFFICE_EXPENSES_RECORDS');
          if (saved) {
            const p = JSON.parse(saved);
            if (Array.isArray(p)) legacySaved = p;
          }
        }
      } catch (err) {
        console.warn("Storage parse error:", err);
      }

      const mergeExpenseRecord = (existing: OfficeExpenseRecord | undefined, incoming: OfficeExpenseRecord): OfficeExpenseRecord => {
        if (!existing) {
          const p = incoming.previousUnit ?? incoming.previous;
          const c = incoming.currentUnit ?? incoming.current;
          return { ...incoming, previousUnit: p, currentUnit: c, previous: p, current: c };
        }

        // Preserve non-zero readings if incoming has 0 or undefined
        const p = (incoming.previousUnit != null && Number(incoming.previousUnit) > 0)
          ? Number(incoming.previousUnit)
          : ((incoming.previous != null && Number(incoming.previous) > 0)
              ? Number(incoming.previous)
              : (existing.previousUnit ?? existing.previous));

        const c = (incoming.currentUnit != null && Number(incoming.currentUnit) > 0)
          ? Number(incoming.currentUnit)
          : ((incoming.current != null && Number(incoming.current) > 0)
              ? Number(incoming.current)
              : (existing.currentUnit ?? existing.current));

        const cons = (incoming.consumedUnits != null && Number(incoming.consumedUnits) > 0)
          ? Number(incoming.consumedUnits)
          : (existing.consumedUnits ?? (c != null && p != null && c >= p ? c - p : undefined));

        return {
          ...existing,
          ...incoming,
          previousUnit: p,
          currentUnit: c,
          previous: p,
          current: c,
          consumedUnits: cons,
          meterNo: incoming.meterNo || existing.meterNo,
          consumerNo: incoming.consumerNo || existing.consumerNo,
          ratePerUnit: incoming.ratePerUnit || existing.ratePerUnit
        };
      };

      const map = new Map<string, OfficeExpenseRecord>();
      dbRecords.forEach(rec => { if (rec && rec.id) map.set(rec.id, mergeExpenseRecord(map.get(rec.id), rec)); });
      storeRecords.forEach(rec => { if (rec && rec.id) map.set(rec.id, mergeExpenseRecord(map.get(rec.id), rec)); });
      local.forEach(rec => { if (rec && rec.id) map.set(rec.id, mergeExpenseRecord(map.get(rec.id), rec)); });
      legacySaved.forEach(rec => { if (rec && rec.id) map.set(rec.id, mergeExpenseRecord(map.get(rec.id), rec)); });

      // Sort so that records with actual readings or newer timestamps take priority
      const merged = Array.from(map.values()).sort((a, b) => {
        const aHasData = ((a.currentUnit && a.currentUnit > 0) || (a.consumedUnits && a.consumedUnits > 0) || (a.amount && a.amount > 0)) ? 1 : 0;
        const bHasData = ((b.currentUnit && b.currentUnit > 0) || (b.consumedUnits && b.consumedUnits > 0) || (b.amount && b.amount > 0)) ? 1 : 0;
        if (bHasData !== aHasData) return bHasData - aHasData;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      // Deduplicate single-entry monthly categories (house_rent, electricity_bill, cleaner_payment, telephone_bill, khaja_kharch)
      // to prevent ghost duplicate rows from accumulating across saves/stores
      const deduped: OfficeExpenseRecord[] = [];
      const seenFixed = new Set<string>();
      for (const rec of merged) {
        const isFixedCat = [
          'house_rent',
          'electricity_bill',
          'cleaner_payment',
          'telephone_bill',
          'khaja_kharch'
        ].includes(rec.category);

        if (isFixedCat) {
          const normBranch = normalizeBranchId(rec.branchId);
          const normFy = (rec.fiscalYear || '').replace(/[^0-9]/g, '');
          let normMo = (rec.month || '').trim().toLowerCase();
          if (normMo.includes('ashw') || normMo.includes('asoj') || normMo.includes('ashoj') || normMo.includes('असोज') || normMo.includes('आश्विन')) normMo = 'ashwin';
          else if (normMo.includes('bhad') || normMo.includes('bharda') || normMo.includes('bhadau') || normMo.includes('भदौ') || normMo.includes('भाद्र')) normMo = 'bhadra';
          else if (normMo.includes('shraw') || normMo.includes('saun') || normMo.includes('साउन')) normMo = 'shrawan';
          const key = `${rec.category}_${normBranch}_${normFy}_${normMo}`;
          if (seenFixed.has(key)) {
            continue; // Skip duplicate record
          }
          seenFixed.add(key);
        }
        deduped.push(rec);
      }

      saveLocalDB('office_expenses', deduped);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('OFFICE_EXPENSES_RECORDS', JSON.stringify(deduped));
        }
      } catch (err) {
        console.warn("Storage save error:", err);
      }

      if (branchId && branchId !== 'all') {
        return deduped.filter(e => (e.branchId || 'main') === branchId);
      }
      return deduped;
    }, { ttlMs: 30000 });
  },

  async saveOfficeExpense(expense: OfficeExpenseRecord) {
    invalidateMemoryCache('office_expenses');
    const local = getLocalDB<OfficeExpenseRecord[]>('office_expenses', []);

    const prevVal = expense.previousUnit != null && Number(expense.previousUnit) > 0
      ? Number(expense.previousUnit)
      : (expense.previous != null && Number(expense.previous) > 0
          ? Number(expense.previous)
          : (expense.currentUnit && expense.consumedUnits && Number(expense.currentUnit) > Number(expense.consumedUnits)
              ? Number(expense.currentUnit) - Number(expense.consumedUnits)
              : (expense.previousUnit != null ? Number(expense.previousUnit) : (expense.previous != null ? Number(expense.previous) : 0))));

    const currVal = expense.currentUnit != null && Number(expense.currentUnit) > 0
      ? Number(expense.currentUnit)
      : (expense.current != null && Number(expense.current) > 0
          ? Number(expense.current)
          : (prevVal > 0 && expense.consumedUnits && Number(expense.consumedUnits) > 0
              ? prevVal + Number(expense.consumedUnits)
              : (expense.currentUnit != null ? Number(expense.currentUnit) : (expense.current != null ? Number(expense.current) : 0))));

    const consumedVal = expense.consumedUnits != null && Number(expense.consumedUnits) > 0
      ? Number(expense.consumedUnits)
      : (currVal > 0 && prevVal > 0 && currVal >= prevVal ? currVal - prevVal : 0);

    const rateVal = expense.ratePerUnit != null ? Number(expense.ratePerUnit) : 12;
    const consNo = expense.consumerNo || (expense as any).customerNo || null;

    const normalizedExpense: OfficeExpenseRecord = {
      ...expense,
      previousUnit: prevVal,
      currentUnit: currVal,
      previous: prevVal,
      current: currVal,
      consumedUnits: consumedVal,
      ratePerUnit: rateVal
    };

    const updated = [normalizedExpense, ...local.filter(r => r.id !== expense.id)].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    saveLocalDB('office_expenses', updated);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('OFFICE_EXPENSES_RECORDS', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // 1. Direct Supabase Table Upsert (office_expenses)
    const baseDbRow: Record<string, any> = {
      id: normalizedExpense.id,
      branch_id: normalizedExpense.branchId || 'main',
      date: normalizedExpense.date || '',
      date_bs: normalizedExpense.date || '',
      fiscal_year: normalizedExpense.fiscalYear || '',
      month: normalizedExpense.month || '',
      category: normalizedExpense.category || 'other_expenses',
      category_label: normalizedExpense.categoryLabel || null,
      amount: Number(normalizedExpense.amount) || 0,
      tax_deduction: Number(normalizedExpense.taxDeduction) || 0,
      tax_rate: (normalizedExpense as any).taxRate ? Number((normalizedExpense as any).taxRate) : 0,
      net_paid_amount: Number(normalizedExpense.netPaidAmount) || 0,
      paid_to: normalizedExpense.paidTo || null,
      account_no: normalizedExpense.accountNo || null,
      bank_name: normalizedExpense.bankName || null,
      payment_method: normalizedExpense.paymentMethod || 'Account Transfer',
      voucher_no: normalizedExpense.voucherNo || null,
      bill_no: normalizedExpense.billNo || null,
      previous_unit: prevVal,
      current_unit: currVal,
      consumed_units: consumedVal,
      unit_rate: rateVal,
      rate_per_unit: rateVal,
      meter_no: normalizedExpense.meterNo || null,
      customer_no: consNo,
      consumer_no: consNo,
      landlord_name: normalizedExpense.landlordName || null,
      cleaner_name: normalizedExpense.cleanerName || null,
      working_days: normalizedExpense.workingDays != null ? Number(normalizedExpense.workingDays) : 30,
      service_provider: normalizedExpense.serviceProvider || null,
      remarks: normalizedExpense.remarks || null,
      attachment_url: normalizedExpense.attachmentUrl || null,
      created_at: normalizedExpense.createdAt || Date.now(),
      updated_at: Date.now()
    };

    try {
      // First attempt with both previous/current and previous_unit/current_unit
      const fullRow = { ...baseDbRow, previous: prevVal, current: currVal };
      const { error } = await supabase.from('office_expenses').upsert(fullRow);
      if (error && (error.message?.includes('previous') || error.message?.includes('current') || error.code === 'PGRST204')) {
        // Fallback if previous/current columns do not exist in DB schema yet
        const fbRes = await supabase.from('office_expenses').upsert(baseDbRow);
        if (fbRes.error) console.warn("office_expenses table fallback upsert notice:", fbRes.error.message);
      } else if (error) {
        console.warn("office_expenses table upsert error:", error.message);
      }
    } catch (e) {
      console.warn("office_expenses table upsert error:", e);
    }

    // 2. Persist into daily_data table in Supabase
    try {
      await supabase.from('daily_data').upsert({
        id: 'OFFICE_EXPENSES_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { records: updated }
      });
    } catch (e) {
      console.warn("Office expenses secondary store upsert notice:", e);
    }

    try {
      window.dispatchEvent(new Event('officeExpensesUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }
  },

  async saveAllOfficeExpenses(expenses: OfficeExpenseRecord[]) {
    invalidateMemoryCache('office_expenses');

    const normalizedExpenses: OfficeExpenseRecord[] = expenses.map(expense => {
      const prevVal = expense.previousUnit != null && Number(expense.previousUnit) > 0
        ? Number(expense.previousUnit)
        : (expense.previous != null && Number(expense.previous) > 0
            ? Number(expense.previous)
            : (expense.currentUnit && expense.consumedUnits && Number(expense.currentUnit) > Number(expense.consumedUnits)
                ? Number(expense.currentUnit) - Number(expense.consumedUnits)
                : (expense.previousUnit != null ? Number(expense.previousUnit) : (expense.previous != null ? Number(expense.previous) : 0))));

      const currVal = expense.currentUnit != null && Number(expense.currentUnit) > 0
        ? Number(expense.currentUnit)
        : (expense.current != null && Number(expense.current) > 0
            ? Number(expense.current)
            : (prevVal > 0 && expense.consumedUnits && Number(expense.consumedUnits) > 0
                ? prevVal + Number(expense.consumedUnits)
                : (expense.currentUnit != null ? Number(expense.currentUnit) : (expense.current != null ? Number(expense.current) : 0))));

      const consumedVal = expense.consumedUnits != null && Number(expense.consumedUnits) > 0
        ? Number(expense.consumedUnits)
        : (currVal > 0 && prevVal > 0 && currVal >= prevVal ? currVal - prevVal : 0);

      const rateVal = expense.ratePerUnit != null ? Number(expense.ratePerUnit) : 12;

      return {
        ...expense,
        previousUnit: prevVal,
        currentUnit: currVal,
        previous: prevVal,
        current: currVal,
        consumedUnits: consumedVal,
        ratePerUnit: rateVal
      };
    });

    saveLocalDB('office_expenses', normalizedExpenses);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('OFFICE_EXPENSES_RECORDS', JSON.stringify(normalizedExpenses));
      }
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // 1. Bulk Upsert into Supabase table (office_expenses)
    if (normalizedExpenses.length > 0) {
      const rows = normalizedExpenses.map(expense => {
        const consNo = expense.consumerNo || (expense as any).customerNo || null;
        return {
          id: expense.id,
          branch_id: expense.branchId || 'main',
          date: expense.date || '',
          date_bs: expense.date || '',
          fiscal_year: expense.fiscalYear || '',
          month: expense.month || '',
          category: expense.category || 'other_expenses',
          category_label: expense.categoryLabel || null,
          amount: Number(expense.amount) || 0,
          tax_deduction: Number(expense.taxDeduction) || 0,
          tax_rate: (expense as any).taxRate ? Number((expense as any).taxRate) : 0,
          net_paid_amount: Number(expense.netPaidAmount) || 0,
          paid_to: expense.paidTo || null,
          account_no: expense.accountNo || null,
          bank_name: expense.bankName || null,
          payment_method: expense.paymentMethod || 'Account Transfer',
          voucher_no: expense.voucherNo || null,
          bill_no: expense.billNo || null,
          previous_unit: Number(expense.previousUnit) || 0,
          current_unit: Number(expense.currentUnit) || 0,
          consumed_units: Number(expense.consumedUnits) || 0,
          unit_rate: Number(expense.ratePerUnit) || 12,
          rate_per_unit: Number(expense.ratePerUnit) || 12,
          meter_no: expense.meterNo || null,
          customer_no: consNo,
          consumer_no: consNo,
          landlord_name: expense.landlordName || null,
          cleaner_name: expense.cleanerName || null,
          working_days: expense.workingDays != null ? Number(expense.workingDays) : 30,
          service_provider: expense.serviceProvider || null,
          remarks: expense.remarks || null,
          attachment_url: expense.attachmentUrl || null,
          created_at: expense.createdAt || Date.now(),
          updated_at: Date.now()
        };
      });

      try {
        const rowsWithBoth = rows.map(r => ({ ...r, previous: r.previous_unit, current: r.current_unit }));
        const { error } = await supabase.from('office_expenses').upsert(rowsWithBoth);
        if (error && (error.message?.includes('previous') || error.message?.includes('current') || error.code === 'PGRST204')) {
          const fbRes = await supabase.from('office_expenses').upsert(rows);
          if (fbRes.error) console.warn("Bulk office_expenses fallback upsert notice:", fbRes.error.message);
        } else if (error) {
          console.warn("Bulk office_expenses table upsert error:", error.message);
        }
      } catch (e) {
        console.warn("Bulk office_expenses table upsert error:", e);
      }
    }

    // 2. Persist into daily_data table
    try {
      await supabase.from('daily_data').upsert({
        id: 'OFFICE_EXPENSES_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { records: normalizedExpenses }
      });
    } catch (e) {
      console.warn("Office expenses bulk upsert notice:", e);
    }

    try {
      window.dispatchEvent(new Event('officeExpensesUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }
  },

  async deleteOfficeExpense(id: string) {
    invalidateMemoryCache('office_expenses');
    const local = getLocalDB<OfficeExpenseRecord[]>('office_expenses', []);
    const updated = local.filter(r => r.id !== id);
    saveLocalDB('office_expenses', updated);
    try {
      localStorage.setItem('OFFICE_EXPENSES_RECORDS', JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // Delete from Supabase office_expenses table
    try {
      await supabase.from('office_expenses').delete().eq('id', id);
    } catch (e) {
      console.warn("Office expenses delete table error:", e);
    }

    try {
      await supabase.from('daily_data').upsert({
        id: 'OFFICE_EXPENSES_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { records: updated }
      });
    } catch (e) {
      console.warn("Office expenses delete upsert error:", e);
    }

    try {
      window.dispatchEvent(new Event('officeExpensesUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }
  },

  async deleteMonthlyOfficeExpenses(fiscalYear: string, month: string, branchId?: string) {
    invalidateMemoryCache('office_expenses');
    const local = getLocalDB<OfficeExpenseRecord[]>('office_expenses', []);
    const targetFy = (fiscalYear || '').trim().toLowerCase();
    const targetMo = (month || '').trim().toLowerCase();

    const updated = local.filter(e => {
      const matchFy = (e.fiscalYear || '').trim().toLowerCase() === targetFy;
      const matchMonth = (e.month || '').trim().toLowerCase() === targetMo;
      const matchBranch = !branchId || branchId === 'all' || e.branchId === branchId;
      return !(matchFy && matchMonth && matchBranch);
    });

    saveLocalDB('office_expenses', updated);
    try {
      localStorage.setItem('OFFICE_EXPENSES_RECORDS', JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // 1. Delete from Supabase office_expenses table
    try {
      let query = supabase.from('office_expenses').delete()
        .eq('fiscal_year', fiscalYear)
        .eq('month', month);
      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId);
      }
      await query;
    } catch (e) {
      console.warn("office_expenses delete by month error:", e);
    }

    // 2. Persist into daily_data table
    try {
      await supabase.from('daily_data').upsert({
        id: 'OFFICE_EXPENSES_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { records: updated }
      });
    } catch (e) {
      console.warn("daily_data office expenses update error:", e);
    }

    try {
      window.dispatchEvent(new Event('officeExpensesUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }
  },

  async deleteElectricityExpensesForMonth(fiscalYear: string, month: string) {
    invalidateMemoryCache('office_expenses');
    const local = getLocalDB<OfficeExpenseRecord[]>('office_expenses', []);
    const targetFy = (fiscalYear || '').trim().toLowerCase();
    const targetMo = (month || '').trim().toLowerCase();

    const updated = local.filter(e => {
      const isElec = e.category === 'electricity_bill';
      const matchFy = (e.fiscalYear || '').trim().toLowerCase() === targetFy;
      const matchMonth = (e.month || '').trim().toLowerCase() === targetMo;
      return !(isElec && matchFy && matchMonth);
    });

    saveLocalDB('office_expenses', updated);
    try {
      localStorage.setItem('OFFICE_EXPENSES_RECORDS', JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // 1. Delete from Supabase office_expenses table
    try {
      await supabase.from('office_expenses').delete()
        .eq('category', 'electricity_bill')
        .eq('fiscal_year', fiscalYear)
        .eq('month', month);
    } catch (e) {
      console.warn("office_expenses delete electricity error:", e);
    }

    // 2. Persist into daily_data table
    try {
      await supabase.from('daily_data').upsert({
        id: 'OFFICE_EXPENSES_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { records: updated }
      });
    } catch (e) {
      console.warn("daily_data electricity update error:", e);
    }

    try {
      window.dispatchEvent(new Event('officeExpensesUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }
  },

  // Fixed Monthly Operating Expenses Configuration per Branch (House Rent, Cleaner, Telephone, Khaja)
  async getFixedExpenseConfigs(): Promise<Record<string, BranchFixedExpenseConfig>> {
    return fetchWithCache('fixed_office_expense_configs', async () => {
      const dbConfigs: Record<string, BranchFixedExpenseConfig> = {};
      try {
        const { data, error } = await supabase.from('branch_fixed_expense_configs').select('*');
        if (!error && Array.isArray(data)) {
          data.forEach((d: any) => {
            if (d.branch_id) {
              dbConfigs[d.branch_id] = {
                branchId: d.branch_id,
                rentEnabled: d.rent_enabled,
                landlordName: d.landlord_name,
                rentAmount: Number(d.rent_gross_amount) || 0,
                rentTdsRate: Number(d.rent_tax_rate) || 10,
                rentNetPaid: Number(d.rent_net_amount) || 0,
                rentAccountNo: d.rent_account_no,
                rentBankName: d.rent_bank_name,
                rentPaymentMethod: d.rent_payment_method || 'Account Transfer',
                cleanerEnabled: d.cleaner_enabled,
                cleanerName: d.cleaner_name,
                cleanerAmount: Number(d.cleaner_gross_amount) || 0,
                cleanerTdsRate: Number(d.cleaner_tax_rate) || 1.5,
                cleanerNetPaid: Number(d.cleaner_net_amount) || 0,
                cleanerWorkingDays: Number(d.cleaner_working_days) || 30,
                cleanerAccountNo: d.cleaner_account_no,
                cleanerBankName: d.cleaner_bank_name,
                cleanerPaymentMethod: d.cleaner_payment_method || 'Account Transfer',
                telephoneEnabled: d.telephone_enabled,
                telephoneProvider: d.telephone_provider,
                telephoneAmount: Number(d.telephone_amount) || 0,
                khajaEnabled: d.khaja_enabled,
                khajaMonthlyAmount: Number(d.khaja_amount) || 0,
                electricityMeterNo: d.electricity_meter_no,
                electricityConsumerNo: d.electricity_customer_no,
                electricityRate: Number(d.electricity_unit_rate) || 10
              };
            }
          });
        }
      } catch (e) {
        console.warn("branch_fixed_expense_configs table fetch notice:", e);
      }

      const local = getLocalDB<Record<string, BranchFixedExpenseConfig>>('fixed_office_expense_configs', {});
      try {
        const { data, error } = await supabase.from('daily_data').select('*').eq('id', 'FIXED_OFFICE_EXPENSE_CONFIGS').maybeSingle();
        if (!error && data?.data?.configs) {
          return { ...local, ...data.data.configs, ...dbConfigs };
        }
      } catch (e) {
        console.warn("Notice: Fetching fixed expense configs fallback to local:", e);
      }
      return { ...local, ...dbConfigs };
    }, { ttlMs: 30000 });
  },

  async saveFixedExpenseConfig(config: BranchFixedExpenseConfig) {
    invalidateMemoryCache('fixed_office_expense_configs');
    const all = await this.getFixedExpenseConfigs();
    const updated = { ...all, [config.branchId]: config };
    saveLocalDB('fixed_office_expense_configs', updated);

    // Upsert into Supabase branch_fixed_expense_configs table
    try {
      await supabase.from('branch_fixed_expense_configs').upsert({
        id: config.branchId,
        branch_id: config.branchId,
        rent_enabled: config.rentEnabled ?? true,
        landlord_name: config.landlordName || null,
        rent_gross_amount: config.rentAmount || 0,
        rent_tax_rate: config.rentTdsRate || 10,
        rent_net_amount: config.rentNetPaid || 0,
        rent_account_no: config.rentAccountNo || null,
        rent_bank_name: config.rentBankName || null,
        rent_payment_method: config.rentPaymentMethod || 'Account Transfer',
        cleaner_enabled: config.cleanerEnabled ?? true,
        cleaner_name: config.cleanerName || null,
        cleaner_gross_amount: config.cleanerAmount || 0,
        cleaner_tax_rate: config.cleanerTdsRate || 1.5,
        cleaner_net_amount: config.cleanerNetPaid || 0,
        cleaner_working_days: config.cleanerWorkingDays || 30,
        cleaner_account_no: config.cleanerAccountNo || null,
        cleaner_bank_name: config.cleanerBankName || null,
        cleaner_payment_method: config.cleanerPaymentMethod || 'Account Transfer',
        telephone_enabled: config.telephoneEnabled ?? false,
        telephone_provider: config.telephoneProvider || null,
        telephone_amount: config.telephoneAmount || 0,
        khaja_enabled: config.khajaEnabled ?? false,
        khaja_amount: config.khajaMonthlyAmount || 0,
        electricity_meter_no: config.electricityMeterNo || null,
        electricity_customer_no: config.electricityConsumerNo || null,
        electricity_unit_rate: config.electricityRate || 10,
        updated_at: Date.now()
      });
    } catch (e) {
      console.warn("branch_fixed_expense_configs upsert error:", e);
    }

    try {
      await supabase.from('daily_data').upsert({
        id: 'FIXED_OFFICE_EXPENSE_CONFIGS',
        date: '2099-12-31',
        branch_id: 'main',
        data: { configs: updated }
      });
    } catch (e) {
      console.warn("Fixed expense config upsert notice:", e);
    }

    try {
      window.dispatchEvent(new Event('fixedExpenseConfigsUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }
  },

  // Saved Monthly Expense Report Sheets
  async getSavedExpenseSheets(branchId?: string): Promise<SavedOfficeExpenseSheet[]> {
    const key = `saved_expense_sheets_${normalizeBranchId(branchId)}`;
    return fetchWithCache(key, async () => {
      let dbSheets: SavedOfficeExpenseSheet[] = [];
      try {
        let query = supabase.from('saved_office_expense_sheets').select('*');
        if (branchId && branchId !== 'all') {
          query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          dbSheets = data.map((d: any) => ({
            id: d.id,
            fiscalYear: d.fiscal_year || '',
            month: d.month || '',
            monthNp: d.month_np || undefined,
            branchId: d.branch_id || 'all',
            branchName: d.branch_name || 'सम्पूर्ण शाखाहरू',
            totalExpenses: Number(d.total_expenses) || 0,
            taxAmount: Number(d.tax_amount) || 0,
            netPaidAmount: Number(d.net_paid_amount) || 0,
            recordsCount: Number(d.records_count) || 0,
            preparedBy: d.prepared_by || undefined,
            preparedByName: d.prepared_by_name || undefined,
            approvedBy: d.approved_by || undefined,
            approvedByName: d.approved_by_name || undefined,
            status: d.status || 'Approved',
            remarks: d.remarks || undefined,
            savedAt: Number(d.saved_at) || Date.now(),
            updatedAt: Number(d.updated_at) || Date.now()
          }));
        }
      } catch (err) {
        console.warn("Notice: saved_office_expense_sheets query:", err);
      }

      let storeSheets: SavedOfficeExpenseSheet[] = [];
      try {
        const { data: storeData } = await supabase
          .from('daily_data')
          .select('*')
          .eq('id', 'SAVED_EXPENSE_SHEETS_STORE')
          .maybeSingle();
        if (storeData && storeData.data && Array.isArray(storeData.data.sheets)) {
          storeSheets = storeData.data.sheets;
        }
      } catch (err) {
        console.warn("Notice: daily_data store fetch for saved expense sheets:", err);
      }

      const local = getLocalDB<SavedOfficeExpenseSheet[]>('saved_expense_sheets', []);
      let legacySaved: SavedOfficeExpenseSheet[] = [];
      try {
        const saved = localStorage.getItem('SAVED_OFFICE_EXPENSE_SHEETS');
        if (saved) {
          const p = JSON.parse(saved);
          if (Array.isArray(p)) legacySaved = p;
        }
      } catch (err) {
        console.warn("Storage parse error for saved expense sheets:", err);
      }

      const map = new Map<string, SavedOfficeExpenseSheet>();
      dbSheets.forEach(s => { if (s && s.id) map.set(s.id, s); });
      storeSheets.forEach(s => { if (s && s.id) map.set(s.id, s); });
      local.forEach(s => { if (s && s.id) map.set(s.id, { ...map.get(s.id), ...s }); });
      legacySaved.forEach(s => { if (s && s.id) map.set(s.id, { ...map.get(s.id), ...s }); });

      const merged = Array.from(map.values()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      saveLocalDB('saved_expense_sheets', merged);
      try {
        localStorage.setItem('SAVED_OFFICE_EXPENSE_SHEETS', JSON.stringify(merged));
      } catch (e) {
        console.warn("Storage save error:", e);
      }
      if (branchId && branchId !== 'all') {
        return merged.filter(s => (s.branchId || 'main') === branchId);
      }
      return merged;
    }, { ttlMs: 30000 });
  },

  async saveSavedExpenseSheet(sheet: SavedOfficeExpenseSheet) {
    invalidateMemoryCache('saved_expense_sheets');
    const local = getLocalDB<SavedOfficeExpenseSheet[]>('saved_expense_sheets', []);
    const updated = [sheet, ...local.filter(s => s.id !== sheet.id)].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    saveLocalDB('saved_expense_sheets', updated);
    try {
      localStorage.setItem('SAVED_OFFICE_EXPENSE_SHEETS', JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // 1. Direct Supabase Table Upsert (saved_office_expense_sheets)
    try {
      await supabase.from('saved_office_expense_sheets').upsert({
        id: sheet.id,
        fiscal_year: sheet.fiscalYear || '',
        month: sheet.month || '',
        month_np: sheet.monthNp || null,
        branch_id: sheet.branchId || 'all',
        branch_name: sheet.branchName || 'सम्पूर्ण शाखाहरू',
        total_expenses: Number(sheet.totalExpenses) || 0,
        tax_amount: Number(sheet.taxAmount) || 0,
        net_paid_amount: Number(sheet.netPaidAmount) || 0,
        records_count: Number(sheet.recordsCount) || 0,
        prepared_by: sheet.preparedBy || null,
        prepared_by_name: sheet.preparedByName || null,
        approved_by: sheet.approvedBy || null,
        approved_by_name: sheet.approvedByName || null,
        status: sheet.status || 'Approved',
        remarks: sheet.remarks || null,
        saved_at: sheet.savedAt || Date.now(),
        updated_at: Date.now()
      });
    } catch (e) {
      console.warn("saved_office_expense_sheets table upsert error:", e);
    }

    // 2. Persist into daily_data fallback
    try {
      await supabase.from('daily_data').upsert({
        id: 'SAVED_EXPENSE_SHEETS_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { sheets: updated }
      });
    } catch (e) {
      console.warn("Saved expense sheets store upsert notice:", e);
    }

    try {
      window.dispatchEvent(new Event('savedExpenseSheetsUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }
  },

  async saveAllSavedExpenseSheets(sheets: SavedOfficeExpenseSheet[]) {
    invalidateMemoryCache('saved_expense_sheets');
    saveLocalDB('saved_expense_sheets', sheets);
    try {
      localStorage.setItem('SAVED_OFFICE_EXPENSE_SHEETS', JSON.stringify(sheets));
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // 1. Bulk Upsert into saved_office_expense_sheets
    if (sheets.length > 0) {
      try {
        const rows = sheets.map(sheet => ({
          id: sheet.id,
          fiscal_year: sheet.fiscalYear || '',
          month: sheet.month || '',
          month_np: sheet.monthNp || null,
          branch_id: sheet.branchId || 'all',
          branch_name: sheet.branchName || 'सम्पूर्ण शाखाहरू',
          total_expenses: Number(sheet.totalExpenses) || 0,
          tax_amount: Number(sheet.taxAmount) || 0,
          net_paid_amount: Number(sheet.netPaidAmount) || 0,
          records_count: Number(sheet.recordsCount) || 0,
          prepared_by: sheet.preparedBy || null,
          prepared_by_name: sheet.preparedByName || null,
          approved_by: sheet.approvedBy || null,
          approved_by_name: sheet.approvedByName || null,
          status: sheet.status || 'Approved',
          remarks: sheet.remarks || null,
          saved_at: sheet.savedAt || Date.now(),
          updated_at: Date.now()
        }));
        await supabase.from('saved_office_expense_sheets').upsert(rows);
      } catch (e) {
        console.warn("saved_office_expense_sheets bulk upsert error:", e);
      }
    }

    // 2. Persist into daily_data table
    try {
      await supabase.from('daily_data').upsert({
        id: 'SAVED_EXPENSE_SHEETS_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { sheets }
      });
    } catch (e) {
      console.warn("Saved expense sheets bulk upsert notice:", e);
    }

    try {
      window.dispatchEvent(new Event('savedExpenseSheetsUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }
  },

  async deleteSavedExpenseSheet(id: string, fiscalYear?: string, month?: string, branchId?: string) {
    invalidateMemoryCache('saved_expense_sheets');
    const local = getLocalDB<SavedOfficeExpenseSheet[]>('saved_expense_sheets', []);
    const targetFy = fiscalYear ? fiscalYear.trim().toLowerCase() : '';
    const targetMo = month ? month.trim().toLowerCase() : '';

    const updated = local.filter(s => {
      if (s.id === id) return false;
      if (targetFy && targetMo && (s.fiscalYear || '').trim().toLowerCase() === targetFy && (s.month || '').trim().toLowerCase() === targetMo) {
        if (!branchId || branchId === 'all' || s.branchId === branchId) return false;
      }
      return true;
    });

    saveLocalDB('saved_expense_sheets', updated);
    try {
      localStorage.setItem('SAVED_OFFICE_EXPENSE_SHEETS', JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // Delete from Supabase saved_office_expense_sheets table
    try {
      await supabase.from('saved_office_expense_sheets').delete().eq('id', id);
      if (fiscalYear && month) {
        let query = supabase.from('saved_office_expense_sheets').delete()
          .eq('fiscal_year', fiscalYear)
          .eq('month', month);
        if (branchId && branchId !== 'all') {
          query = query.eq('branch_id', branchId);
        }
        await query;
      }
    } catch (e) {
      console.warn("saved_office_expense_sheets delete error:", e);
    }

    try {
      await supabase.from('daily_data').upsert({
        id: 'SAVED_EXPENSE_SHEETS_STORE',
        date: '2099-12-31',
        branch_id: 'main',
        data: { sheets: updated }
      });
    } catch (e) {
      console.warn("Daily data update error:", e);
    }

    try {
      window.dispatchEvent(new Event('savedExpenseSheetsUpdated'));
    } catch (e) {
      console.warn("Event dispatch notice:", e);
    }

    if (fiscalYear && month) {
      await this.deleteOfficeExpenseLedgerEntries(fiscalYear, month, branchId).catch(() => {});
    }
  },

  async deleteOfficeExpenseLedgerEntries(fiscalYear: string, month: string, branchId?: string, monthNp?: string) {
    try {
      const branches = await this.getBranches().catch(() => []);
      const branchIdsToClean = new Set<string>();
      if (branchId && branchId !== 'all') {
        branchIdsToClean.add(branchId);
      } else {
        branches.forEach(b => branchIdsToClean.add(b.id));
      }
      branchIdsToClean.add('main');

      const targetFy = (fiscalYear || '').trim().toLowerCase();
      const targetMo = (month || '').trim().toLowerCase();
      const targetMoNp = (monthNp || '').trim().toLowerCase();
      const pfx = `offexp_${fiscalYear.replace(/[/\\s]/g, '_')}_${month}_`.toLowerCase();

      const isMatch = (t: any) => {
        if (!t) return false;
        const tid = (t.id || '').toLowerCase();
        if (tid.startsWith(pfx) || tid.includes(pfx)) return true;
        const rem = (t.remarks || '').toLowerCase();
        const hasFy = targetFy && rem.includes(targetFy);
        const hasMo = (targetMo && rem.includes(targetMo)) || (targetMoNp && rem.includes(targetMoNp));
        if (hasFy && hasMo && (
          rem.includes('office operating') ||
          rem.includes('office expenses') ||
          rem.includes('office rent') ||
          rem.includes('office cleaner') ||
          rem.includes('office khaja')
        )) {
          return true;
        }
        return false;
      };

      for (const bId of branchIdsToClean) {
        const allDayData = await this.getAllDailyData(bId).catch(() => ({}));
        for (const [dateKey, dayData] of Object.entries(allDayData || {})) {
          if (!dayData || typeof dayData !== 'object') continue;
          const currentTx = (dayData as any).officeTransactions || [];
          const remaining = currentTx.filter((t: any) => !isMatch(t));
          if (remaining.length !== currentTx.length) {
            await this.saveDayData(dateKey, bId, {
              ...(dayData as any),
              officeTransactions: remaining
            });
          }
        }
      }

      this.invalidateMemoryCache();
      try {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('dailyDataUpdated'));
        window.dispatchEvent(new Event('ledgerAccountsUpdated'));
      } catch (e) {}
    } catch (err) {
      console.warn("deleteOfficeExpenseLedgerEntries error:", err);
    }
  },

  // Full Master System Backup
  async getFullBackupData(): Promise<Record<string, unknown>> {
    try {
      const [
        branches, users, roles, settings, daily_data, ledger_accounts,
        employees, leave_types, leave_requests, payroll_records,
        notices, downloadable_documents, complaints, tax_policy,
        tax_adjustments, fd_records, audit_logs
      ] = await Promise.all([
        this.getBranches().catch(() => getLocalDB('branches', [])),
        this.getUsers().catch(() => getLocalDB('users', [])),
        this.getRoles().catch(() => getLocalDB('roles', [])),
        this.getSettings().catch(() => getLocalDB('settings', null)),
        this.getAllDailyData().catch(() => getLocalDB('daily_data', {})),
        this.getLedgerAccounts().catch(() => getLocalDB('ledger_accounts', [])),
        this.getEmployees().catch(() => getLocalDB('employees', [])),
        this.getLeaveTypes().catch(() => getLocalDB('leave_types', [])),
        this.getLeaveRequests().catch(() => getLocalDB('leave_requests', [])),
        this.getPayrollRecords().catch(() => getLocalDB('payroll', [])),
        this.getNotices().catch(() => getLocalDB('notices', [])),
        this.getDocuments().catch(() => getLocalDB('documents', [])),
        this.getComplaints().catch(() => getLocalDB('complaints', [])),
        this.getTaxConfig().catch(() => getLocalDB('tax_policy', null)),
        this.getTaxAdjustments().catch(() => getLocalDB('tax_adjustments', {})),
        this.getFDRecords().catch(() => getLocalDB('fd_records', [])),
        this.getLogs().catch(() => getLocalDB('logs', []))
      ]);

      return {
        version: "2.0",
        system: "RATAULI_SACCOS_SYSTEM",
        exportDate: new Date().toISOString(),
        institution: (settings as SystemSettings)?.systemName || "RATAULI SACCOS",
        daily_data: daily_data || {},
        branches: branches || [],
        users: users || [],
        roles: roles || [],
        settings: settings || null,
        ledger_accounts: ledger_accounts || [],
        employees: employees || [],
        leave_types: leave_types || [],
        leave_requests: leave_requests || [],
        payroll_records: payroll_records || [],
        notices: notices || [],
        downloadable_documents: downloadable_documents || [],
        complaints: complaints || [],
        tax_policy: tax_policy || null,
        tax_adjustments: tax_adjustments || {},
        fd_records: fd_records || [],
        audit_logs: audit_logs || []
      };
    } catch (e) {
      console.warn("Failed to gather complete backup from Supabase, constructing from local DB:", e);
      return {
        version: "2.0",
        system: "RATAULI_SACCOS_SYSTEM",
        exportDate: new Date().toISOString(),
        daily_data: getLocalDB('daily_data', {}),
        branches: getLocalDB('branches', []),
        users: getLocalDB('users', []),
        roles: getLocalDB('roles', []),
        settings: getLocalDB('settings', null),
        ledger_accounts: getLocalDB('ledger_accounts', []),
        employees: getLocalDB('employees', []),
        payroll_records: getLocalDB('payroll', []),
        notices: getLocalDB('notices', [])
      };
    }
  },

  // Restore Master Backup Data to Supabase & LocalStorage
  async restoreBackupData(backupData: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error("Invalid backup file format.");
    }

    let itemsRestored = 0;

    // Check if it's a full v2.0 bundle or legacy daily_data dictionary
    const isFullBackup = 'daily_data' in backupData || 'branches' in backupData || 'settings' in backupData;

    if (isFullBackup) {
      // 1. Branches
      if (Array.isArray(backupData.branches)) {
        for (const b of backupData.branches as Branch[]) {
          await this.saveBranch(b).catch(err => console.warn("Restore branch warning:", err));
          itemsRestored++;
        }
      }

      // 2. Roles
      if (Array.isArray(backupData.roles)) {
        for (const r of backupData.roles as Role[]) {
          await this.saveRole(r).catch(err => console.warn("Restore role warning:", err));
          itemsRestored++;
        }
      }

      // 3. Users
      if (Array.isArray(backupData.users)) {
        for (const u of backupData.users as User[]) {
          await this.saveUser(u).catch(err => console.warn("Restore user warning:", err));
          itemsRestored++;
        }
      }

      // 4. Settings
      if (backupData.settings && typeof backupData.settings === 'object') {
        await this.saveSettings(backupData.settings as SystemSettings).catch(err => console.warn("Restore settings warning:", err));
        itemsRestored++;
      }

      // 5. Ledger Accounts
      if (Array.isArray(backupData.ledger_accounts)) {
        for (const la of backupData.ledger_accounts as LedgerAccount[]) {
          await this.saveLedgerAccount(la).catch(err => console.warn("Restore ledger warning:", err));
          itemsRestored++;
        }
      }

      // 6. Employees
      if (Array.isArray(backupData.employees)) {
        for (const emp of backupData.employees as Employee[]) {
          await this.saveEmployee(emp).catch(err => console.warn("Restore employee warning:", err));
          itemsRestored++;
        }
      }

      // 7. Leave Types
      if (Array.isArray(backupData.leave_types)) {
        for (const lt of backupData.leave_types as LeaveType[]) {
          await this.saveLeaveType(lt).catch(err => console.warn("Restore leave type warning:", err));
          itemsRestored++;
        }
      }

      // 8. Leave Requests
      if (Array.isArray(backupData.leave_requests)) {
        for (const lr of backupData.leave_requests as LeaveRequest[]) {
          await this.saveLeaveRequest(lr).catch(err => console.warn("Restore leave request warning:", err));
          itemsRestored++;
        }
      }

      // 9. Payroll Records
      if (Array.isArray(backupData.payroll_records)) {
        await this.savePayrollRecords(backupData.payroll_records as PayrollRecord[]).catch(err => console.warn("Restore payroll warning:", err));
        itemsRestored += (backupData.payroll_records as PayrollRecord[]).length;
      }

      // 10. Notices
      if (Array.isArray(backupData.notices)) {
        for (const n of backupData.notices as Notice[]) {
          await this.saveNotice(n).catch(err => console.warn("Restore notice warning:", err));
          itemsRestored++;
        }
      }

      // 11. Documents
      if (Array.isArray(backupData.downloadable_documents)) {
        for (const doc of backupData.downloadable_documents as DownloadableDocument[]) {
          await this.saveDocument(doc).catch(err => console.warn("Restore doc warning:", err));
          itemsRestored++;
        }
      }

      // 12. Complaints
      if (Array.isArray(backupData.complaints)) {
        for (const comp of backupData.complaints as Complaint[]) {
          await this.saveComplaint(comp).catch(err => console.warn("Restore complaint warning:", err));
          itemsRestored++;
        }
      }

      // 13. Tax Policy
      if (backupData.tax_policy && typeof backupData.tax_policy === 'object') {
        await this.saveTaxConfig(backupData.tax_policy as TaxConfig).catch(err => console.warn("Restore tax policy warning:", err));
        itemsRestored++;
      }

      // 14. Tax Adjustments
      if (backupData.tax_adjustments && typeof backupData.tax_adjustments === 'object') {
        await this.saveTaxAdjustments(backupData.tax_adjustments as Record<string, Record<string, unknown>>).catch(err => console.warn("Restore tax adj warning:", err));
        itemsRestored++;
      }

      // 15. FD Records
      if (Array.isArray(backupData.fd_records)) {
        for (const fd of backupData.fd_records as FDRecordItem[]) {
          await this.saveFDRecord(fd).catch(err => console.warn("Restore FD record warning:", err));
          itemsRestored++;
        }
      }

      // 16. Daily Data inside full backup
      if (backupData.daily_data && typeof backupData.daily_data === 'object') {
        const dailyMap = backupData.daily_data as Record<string, DailyData>;
        for (const [key, dData] of Object.entries(dailyMap)) {
          if (!dData) continue;
          const keyParts = key.split('_');
          const dateStr = dData.date || keyParts[0];
          const branchStr = dData.branchId || (keyParts.length > 1 ? keyParts[1] : 'main');
          await this.saveDayData(dateStr, branchStr, dData).catch(err => console.warn("Restore daily data item warning:", err));
          itemsRestored++;
        }
      }
    } else {
      // Legacy Format: backupData is directly daily_data object
      for (const [key, dData] of Object.entries(backupData)) {
        if (!dData || typeof dData !== 'object') continue;
        const typedData = dData as DailyData;
        const keyParts = key.split('_');
        const dateStr = typedData.date || keyParts[0];
        const branchStr = typedData.branchId || (keyParts.length > 1 ? keyParts[1] : 'main');
        await this.saveDayData(dateStr, branchStr, typedData).catch(err => console.warn("Restore legacy daily data item warning:", err));
        itemsRestored++;
      }
    }

    await this.saveLog('admin', 'RESTORE_BACKUP', `Restored ${itemsRestored} items from backup snapshot.`);

    return {
      success: true,
      message: `Successfully restored ${itemsRestored} records/objects into Supabase database and local storage.`
    };
  },

  // Modular or Full Database Reset (Deleting Data from Supabase and LocalStorage)
  async resetModuleData(moduleType: 'daily' | 'ledgers' | 'hr' | 'notices' | 'logs' | 'full'): Promise<{ success: boolean; message: string }> {
    try {
      if (moduleType === 'daily' || moduleType === 'full') {
        saveLocalDB('daily_data', {});
        await Promise.allSettled([
          supabase.from('daily_data').delete().neq('id', '___non_existent___'),
          supabase.from('daily_data').delete().not('id', 'is', null),
          supabase.from('front_teller_ledger_entries').delete().neq('id', '___non_existent___'),
          supabase.from('front_teller_counter_entries').delete().neq('id', '___non_existent___'),
          supabase.from('front_teller_remittance_entries').delete().neq('id', '___non_existent___'),
          supabase.from('front_teller_deno_adjustments').delete().neq('id', '___non_existent___'),
          supabase.from('front_teller_vault_entries').delete().neq('id', '___non_existent___'),
          supabase.from('back_office_entries').delete().neq('id', '___non_existent___')
        ]);
      }

      if (moduleType === 'ledgers' || moduleType === 'full') {
        saveLocalDB('ledger_accounts', []);
        await supabase.from('ledger_accounts').delete().neq('id', '___non_existent___');
      }

      if (moduleType === 'hr' || moduleType === 'full') {
        saveLocalDB('employees', []);
        saveLocalDB('payroll', []);
        saveLocalDB('leave_requests', []);
        saveLocalDB('tax_adjustments', {});
        await Promise.allSettled([
          supabase.from('employees').delete().neq('id', '___non_existent___'),
          supabase.from('payroll_records').delete().neq('id', '___non_existent___'),
          supabase.from('leave_requests').delete().neq('id', '___non_existent___'),
          supabase.from('tax_adjustments').delete().neq('id', '___non_existent___')
        ]);
      }

      if (moduleType === 'notices' || moduleType === 'full') {
        saveLocalDB('notices', []);
        saveLocalDB('documents', []);
        saveLocalDB('complaints', []);
        await Promise.allSettled([
          supabase.from('notices').delete().neq('id', '___non_existent___'),
          supabase.from('downloadable_documents').delete().neq('id', '___non_existent___'),
          supabase.from('complaints').delete().neq('id', '___non_existent___')
        ]);
      }

      if (moduleType === 'logs' || moduleType === 'full') {
        saveLocalDB('logs', []);
        saveLocalDB('audit_logs', []);
        await supabase.from('audit_logs').delete().neq('id', '___non_existent___');
      }

      if (moduleType === 'full') {
        saveLocalDB('fd_records', []);
        localStorage.removeItem('FD_CERTIFICATE_RECORDS');
        await Promise.allSettled([
          supabase.from('fd_records').delete().neq('id', '___non_existent___'),
          supabase.from('daily_data').delete().eq('id', 'FD_RECORDS_STORE')
        ]);
      }

      await this.saveLog('admin', 'RESET_MODULE', `Executed data reset for module: ${moduleType.toUpperCase()}`);

      return {
        success: true,
        message: `Module data (${moduleType}) cleared successfully from Supabase and local storage.`
      };
    } catch (e) {
      console.error("Failed to reset module data in Supabase:", e);
      throw e;
    }
  },

  // ==========================================
  // 14. STAFF CHAT & MESSAGING MODULE (REALTIME POWERED)
  // ==========================================
  getChatRealtimeChannel() {
    if (typeof window === 'undefined') return null;
    let channel = (window as any).__saccos_chat_realtime_ch;
    if (!channel) {
      try {
        channel = supabase.channel('saccos_chat_realtime', {
          config: { broadcast: { self: false } }
        });
        channel
          .on('broadcast', { event: 'new_message' }, ({ payload }: any) => {
            if (payload && payload.id) {
              window.dispatchEvent(new CustomEvent('saccos_chat_message', { detail: payload }));
            }
          })
          .on('broadcast', { event: 'read_message' }, ({ payload }: any) => {
            if (payload && payload.messageIds) {
              window.dispatchEvent(new CustomEvent('saccos_chat_read', { detail: payload }));
            }
          })
          .on('broadcast', { event: 'delete_message' }, ({ payload }: any) => {
            if (payload && payload.id) {
              window.dispatchEvent(new CustomEvent('saccos_chat_delete', { detail: payload }));
            }
          })
          .on('broadcast', { event: 'reaction_message' }, ({ payload }: any) => {
            if (payload && payload.messageId) {
              window.dispatchEvent(new CustomEvent('saccos_chat_reaction', { detail: payload }));
            }
          })
          .subscribe();

        (window as any).__saccos_chat_realtime_ch = channel;
      } catch (err) {
        console.warn('Realtime channel subscription initialization skipped:', err);
      }
    }
    return channel;
  },

  broadcastChatRealtime(event: string, payload: any) {
    try {
      const channel = this.getChatRealtimeChannel();
      if (channel) {
        channel.send({
          type: 'broadcast',
          event,
          payload
        }).catch(() => {});
      }
    } catch (e) {
      // Ignore
    }
  },

  async getChatMessages(): Promise<ChatMessage[]> {
    this.getChatRealtimeChannel();
    const local = getLocalDB<ChatMessage[]>('chat_messages', []);
    let remoteMsgs: ChatMessage[] = [];

    // 1. Try reading from individual recent message records in 'settings' (like saccos_chat_msg_%)
    try {
      const { data: indRecords } = await supabase
        .from('settings')
        .select('id, data')
        .like('id', 'saccos_chat_msg_%')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (indRecords && Array.isArray(indRecords)) {
        indRecords.forEach(rec => {
          if (rec.data && rec.data.id) {
            remoteMsgs.push(rec.data);
          }
        });
      }
    } catch (indErr) {
      console.warn("Could not fetch individual chat messages from settings:", indErr);
    }

    // 2. Try reading from Supabase 'settings' persistent cloud store
    try {
      const { data: storeData } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'saccos_chat_messages_store')
        .maybeSingle();

      if (storeData?.data && Array.isArray(storeData.data.messages)) {
        remoteMsgs = [...remoteMsgs, ...storeData.data.messages];
      }
    } catch (e) {
      console.warn("Could not fetch chat from settings store:", e);
    }

    // 3. Also try reading from 'chat_messages' table if present
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1000);

      if (!error && Array.isArray(data) && data.length > 0) {
        const tableMsgs: ChatMessage[] = data.map((row: any) => ({
          id: row.id,
          channelId: row.channel_id,
          recipientId: row.recipient_id,
          recipientName: row.recipient_name,
          senderId: row.sender_id,
          senderName: row.sender_name,
          senderUsername: row.sender_username,
          senderDesignation: row.sender_designation,
          senderBranchId: row.sender_branch_id,
          senderBranchName: row.sender_branch_name,
          senderPhoto: row.sender_photo,
          content: row.content || '',
          attachments: Array.isArray(row.attachments) ? row.attachments : [],
          reactions: Array.isArray(row.reactions) ? row.reactions : [],
          replyTo: row.reply_to || undefined,
          isImportant: Boolean(row.is_important),
          readBy: Array.isArray(row.read_by) ? row.read_by : [],
          createdAt: Number(row.created_at) || Date.now(),
          updatedAt: row.updated_at ? Number(row.updated_at) : undefined
        }));

        remoteMsgs = [...remoteMsgs, ...tableMsgs];
      }
    } catch (tableErr) {
      // Table doesn't exist, safely ignore
    }

    // 4. Merge all remote messages with local storage (union by ID)
    const mergedMap = new Map<string, ChatMessage>();
    local.forEach(m => mergedMap.set(m.id, m));

    remoteMsgs.forEach(rm => {
      const existing = mergedMap.get(rm.id);
      if (!existing) {
        mergedMap.set(rm.id, rm);
      } else {
        // Merge readBy sets and reactions
        const combinedReadBy = Array.from(new Set([...(existing.readBy || []), ...(rm.readBy || [])]));
        const latestTime = Math.max(existing.updatedAt || 0, rm.updatedAt || 0, existing.createdAt, rm.createdAt);
        mergedMap.set(rm.id, {
          ...rm,
          readBy: combinedReadBy,
          reactions: (rm.reactions && rm.reactions.length) ? rm.reactions : (existing.reactions || []),
          updatedAt: latestTime > existing.createdAt ? latestTime : undefined
        });
      }
    });

    const finalMessages = Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);
    saveLocalDB('chat_messages', finalMessages);
    return finalMessages;
  },

  async sendChatMessage(msg: ChatMessage): Promise<ChatMessage> {
    const local = getLocalDB<ChatMessage[]>('chat_messages', []);
    const updated = [...local.filter(m => m.id !== msg.id), msg];
    saveLocalDB('chat_messages', updated);

    // 1. Persist directly to Supabase cloud 'settings' store
    try {
      const { data: storeData } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'saccos_chat_messages_store')
        .maybeSingle();

      const existing: ChatMessage[] = Array.isArray(storeData?.data?.messages) ? storeData.data.messages : [];
      const mergedRemote = [...existing.filter(m => m.id !== msg.id), msg].slice(-1000);

      await supabase.from('settings').upsert({
        id: 'saccos_chat_messages_store',
        data: {
          messages: mergedRemote,
          lastUpdated: Date.now()
        },
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Failed to persist message to Supabase settings store:", e);
    }

    // 2. Also persist individual message record in 'settings' for guaranteed delivery
    try {
      await supabase.from('settings').upsert({
        id: `saccos_chat_msg_${msg.id}`,
        data: msg,
        updated_at: new Date().toISOString()
      });
    } catch (indErr) {
      console.warn("Failed to persist individual chat message to settings:", indErr);
    }

    // 3. Also try upserting to 'chat_messages' table if it exists
    try {
      await supabase.from('chat_messages').upsert({
        id: msg.id,
        channel_id: msg.channelId || null,
        recipient_id: msg.recipientId || null,
        recipient_name: msg.recipientName || null,
        sender_id: msg.senderId,
        sender_name: msg.senderName,
        sender_username: msg.senderUsername || null,
        sender_designation: msg.senderDesignation || null,
        sender_branch_id: msg.senderBranchId || null,
        sender_branch_name: msg.senderBranchName || null,
        sender_photo: msg.senderPhoto || null,
        content: msg.content || '',
        attachments: msg.attachments || [],
        reactions: msg.reactions || [],
        reply_to: msg.replyTo || null,
        is_important: Boolean(msg.isImportant),
        read_by: msg.readBy || [],
        created_at: msg.createdAt,
        updated_at: msg.updatedAt || null
      });
    } catch (tableErr) {
      // Ignore if table does not exist
    }

    // 4. Broadcast across tabs, local windows, and Supabase Realtime across devices
    try {
      this.broadcastChatRealtime('new_message', msg);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('saccos_chat_message', { detail: msg }));
        window.dispatchEvent(new Event('storage'));

        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('saccos_chat_broadcast');
          bc.postMessage({ type: 'saccos_chat_message', detail: msg });
          bc.close();
        }
      }
    } catch (evtErr) {
      console.warn(evtErr);
    }

    return msg;
  },

  async deleteChatMessage(id: string): Promise<void> {
    const local = getLocalDB<ChatMessage[]>('chat_messages', []);
    const updated = local.filter(m => m.id !== id);
    saveLocalDB('chat_messages', updated);

    // 1. Remove from Supabase 'settings' store
    try {
      const { data: storeData } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'saccos_chat_messages_store')
        .maybeSingle();

      if (storeData?.data && Array.isArray(storeData.data.messages)) {
        const remaining = storeData.data.messages.filter((m: ChatMessage) => m.id !== id);
        await supabase.from('settings').upsert({
          id: 'saccos_chat_messages_store',
          data: {
            messages: remaining,
            lastUpdated: Date.now()
          },
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("Notice updating chat deletion on settings store:", e);
    }

    // 2. Remove individual record from 'settings'
    try {
      await supabase.from('settings').delete().eq('id', `saccos_chat_msg_${id}`);
    } catch (delErr) {
      // Ignore
    }

    // 3. Try deleting from 'chat_messages' table
    try {
      await supabase.from('chat_messages').delete().eq('id', id);
    } catch (tableErr) {
      // Ignore
    }

    // 4. Broadcast deletion across Realtime and tabs
    try {
      this.broadcastChatRealtime('delete_message', { id });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('saccos_chat_delete', { detail: { id } }));
        window.dispatchEvent(new Event('storage'));

        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('saccos_chat_broadcast');
          bc.postMessage({ type: 'saccos_chat_delete', detail: { id } });
          bc.close();
        }
      }
    } catch (evtErr) {
      console.warn(evtErr);
    }
  },

  async markChatRead(messageIds: string[], userId: string): Promise<void> {
    if (!messageIds.length || !userId) return;
    const local = getLocalDB<ChatMessage[]>('chat_messages', []);
    let modified = false;

    const updated = local.map(m => {
      if (messageIds.includes(m.id)) {
        const readBy = Array.isArray(m.readBy) ? m.readBy : [];
        if (!readBy.includes(userId)) {
          modified = true;
          return { ...m, readBy: [...readBy, userId] };
        }
      }
      return m;
    });

    if (modified) {
      saveLocalDB('chat_messages', updated);

      // Update in Supabase settings store
      try {
        const { data: storeData } = await supabase
          .from('settings')
          .select('data')
          .eq('id', 'saccos_chat_messages_store')
          .maybeSingle();

        if (storeData?.data && Array.isArray(storeData.data.messages)) {
          const remoteUpdated = storeData.data.messages.map((m: ChatMessage) => {
            if (messageIds.includes(m.id)) {
              const readBy = Array.isArray(m.readBy) ? m.readBy : [];
              if (!readBy.includes(userId)) {
                return { ...m, readBy: [...readBy, userId] };
              }
            }
            return m;
          });

          await supabase.from('settings').upsert({
            id: 'saccos_chat_messages_store',
            data: {
              messages: remoteUpdated,
              lastUpdated: Date.now()
            },
            updated_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn("Notice updating read_by on settings store:", e);
      }

      // Also update individual message records
      try {
        for (const msgId of messageIds) {
          const item = updated.find(m => m.id === msgId);
          if (item) {
            await supabase.from('settings').upsert({
              id: `saccos_chat_msg_${msgId}`,
              data: item,
              updated_at: new Date().toISOString()
            });
          }
        }
      } catch (indErr) {
        // Ignore
      }

      // Try updating in table
      try {
        for (const msgId of messageIds) {
          const item = updated.find(m => m.id === msgId);
          if (item) {
            await supabase.from('chat_messages').update({
              read_by: item.readBy
            }).eq('id', msgId);
          }
        }
      } catch (e) {
        // Ignore
      }

      try {
        this.broadcastChatRealtime('read_message', { messageIds, userId });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('saccos_chat_read', { detail: { messageIds, userId } }));
          window.dispatchEvent(new Event('storage'));

          if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('saccos_chat_broadcast');
            bc.postMessage({ type: 'saccos_chat_read', detail: { messageIds, userId } });
            bc.close();
          }
        }
      } catch (evtErr) {
        console.warn(evtErr);
      }
    }
  },

  async addChatReaction(messageId: string, reaction: { emoji: string; userId: string; userName: string }): Promise<void> {
    const local = getLocalDB<ChatMessage[]>('chat_messages', []);
    const target = local.find(m => m.id === messageId);
    if (!target) return;

    const reactions = Array.isArray(target.reactions) ? [...target.reactions] : [];
    const existingIdx = reactions.findIndex(r => r.emoji === reaction.emoji && r.userId === reaction.userId);
    if (existingIdx >= 0) {
      reactions.splice(existingIdx, 1);
    } else {
      reactions.push(reaction);
    }

    const updatedTarget: ChatMessage = { ...target, reactions, updatedAt: Date.now() };
    const updatedAll = local.map(m => m.id === messageId ? updatedTarget : m);
    saveLocalDB('chat_messages', updatedAll);

    // Update in Supabase settings store
    try {
      const { data: storeData } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'saccos_chat_messages_store')
        .maybeSingle();

      if (storeData?.data && Array.isArray(storeData.data.messages)) {
        const remoteUpdated = storeData.data.messages.map((m: ChatMessage) => {
          if (m.id === messageId) {
            return { ...m, reactions, updatedAt: Date.now() };
          }
          return m;
        });

        await supabase.from('settings').upsert({
          id: 'saccos_chat_messages_store',
          data: {
            messages: remoteUpdated,
            lastUpdated: Date.now()
          },
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("Notice updating reactions on settings store:", e);
    }

    // Also update individual message record
    try {
      await supabase.from('settings').upsert({
        id: `saccos_chat_msg_${messageId}`,
        data: updatedTarget,
        updated_at: new Date().toISOString()
      });
    } catch (indErr) {
      // Ignore
    }

    try {
      await supabase.from('chat_messages').update({
        reactions: updatedTarget.reactions,
        updated_at: updatedTarget.updatedAt
      }).eq('id', messageId);
    } catch (e) {
      // Ignore
    }

    try {
      this.broadcastChatRealtime('reaction_message', { messageId, reactions });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('saccos_chat_reaction', { detail: { messageId, reactions } }));
        window.dispatchEvent(new Event('storage'));

        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('saccos_chat_broadcast');
          bc.postMessage({ type: 'saccos_chat_reaction', detail: { messageId, reactions } });
          bc.close();
        }
      }
    } catch (evtErr) {
      console.warn(evtErr);
    }
  },

  // ==========================================
  // Board of Directors & Governance API
  // ==========================================
  async getBoardCategories(): Promise<BoardCategory[]> {
    return fetchWithCache('board_categories', async () => {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 'saccos_board_categories').single();
        if (error || !data?.data) {
          return getLocalDB<BoardCategory[]>('board_categories', []);
        }
        return data.data as BoardCategory[];
      } catch {
        return getLocalDB<BoardCategory[]>('board_categories', []);
      }
    }, { ttlMs: 30000, fallbackLocalKey: 'board_categories' });
  },

  async saveBoardCategory(category: BoardCategory): Promise<void> {
    invalidateMemoryCache('board_categories');
    const local = getLocalDB<BoardCategory[]>('board_categories', []);
    const updated = [category, ...local.filter(c => c.id !== category.id)];
    saveLocalDB('board_categories', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_board_categories',
        data: updated,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save board category to Supabase, saved locally:', e);
    }
  },

  async deleteBoardCategory(id: string): Promise<void> {
    invalidateMemoryCache('board_categories');
    const local = getLocalDB<BoardCategory[]>('board_categories', []);
    const updated = local.filter(c => c.id !== id);
    saveLocalDB('board_categories', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_board_categories',
        data: updated,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to delete board category from Supabase, updated locally:', e);
    }
  },

  async getBoardDesignations(): Promise<BoardDesignation[]> {
    return fetchWithCache('board_designations', async () => {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 'saccos_board_designations').single();
        if (error || !data?.data) {
          return getLocalDB<BoardDesignation[]>('board_designations', []);
        }
        return data.data as BoardDesignation[];
      } catch {
        return getLocalDB<BoardDesignation[]>('board_designations', []);
      }
    }, { ttlMs: 30000, fallbackLocalKey: 'board_designations' });
  },

  async saveBoardDesignation(designation: BoardDesignation): Promise<void> {
    invalidateMemoryCache('board_designations');
    const local = getLocalDB<BoardDesignation[]>('board_designations', []);
    const updated = [designation, ...local.filter(d => d.id !== designation.id)];
    saveLocalDB('board_designations', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_board_designations',
        data: updated,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save board designation to Supabase, saved locally:', e);
    }
  },

  async deleteBoardDesignation(id: string): Promise<void> {
    invalidateMemoryCache('board_designations');
    const local = getLocalDB<BoardDesignation[]>('board_designations', []);
    const updated = local.filter(d => d.id !== id);
    saveLocalDB('board_designations', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_board_designations',
        data: updated,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to delete board designation from Supabase, updated locally:', e);
    }
  },

  async getBoardMembers(branchId?: string): Promise<BoardMember[]> {
    return fetchWithCache(`board_members_${branchId || 'all'}`, async () => {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 'saccos_board_members').single();
        let list: BoardMember[] = [];
        if (!error && data?.data && Array.isArray(data.data)) {
          list = data.data as BoardMember[];
        } else {
          list = getLocalDB<BoardMember[]>('board_members', []);
        }
        if (branchId && branchId !== 'all') {
          return list.filter(m => !m.branchId || isBranchMatch(m.branchId, branchId));
        }
        return list;
      } catch {
        const list = getLocalDB<BoardMember[]>('board_members', []);
        if (branchId && branchId !== 'all') {
          return list.filter(m => !m.branchId || isBranchMatch(m.branchId, branchId));
        }
        return list;
      }
    }, { ttlMs: 30000, fallbackLocalKey: 'board_members' });
  },

  async saveBoardMember(member: BoardMember): Promise<void> {
    invalidateMemoryCache('board_members');
    const local = getLocalDB<BoardMember[]>('board_members', []);
    const updated = [member, ...local.filter(m => m.id !== member.id)];
    saveLocalDB('board_members', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_board_members',
        data: updated,
        updated_at: new Date().toISOString()
      });
      // Also sync to dedicated board_members table
      await supabase.from('board_members').upsert({
        id: member.id,
        member_code: member.memberCode || member.memberId,
        full_name: member.fullName,
        full_name_np: member.fullNameNp || member.fullName,
        category_id: member.categoryId,
        category_name: member.categoryName,
        designation: member.designation,
        mobile: member.mobile,
        email: member.email,
        citizenship_no: member.citizenshipNo,
        branch_id: member.branchId || 'main',
        status: member.status || 'Active',
        tenure: member.tenure || {},
        allowance_config: member.allowanceConfig || {},
        documents: member.documents || [],
        notes: member.notes,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save board member to Supabase, saved locally:', e);
    }
  },

  async deleteBoardMember(id: string): Promise<void> {
    invalidateMemoryCache('board_members');
    const local = getLocalDB<BoardMember[]>('board_members', []);
    const updated = local.filter(m => m.id !== id);
    saveLocalDB('board_members', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_board_members',
        data: updated,
        updated_at: new Date().toISOString()
      });
      await supabase.from('board_members').delete().eq('id', id);
    } catch (e) {
      console.warn('Failed to delete board member from Supabase, updated locally:', e);
    }
  },

  async getBoardAllowanceSheets(): Promise<BoardAllowanceSheet[]> {
    return fetchWithCache('board_allowance_sheets', async () => {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 'saccos_board_allowance_sheets').single();
        if (error || !data?.data) {
          return getLocalDB<BoardAllowanceSheet[]>('board_allowance_sheets', []);
        }
        return data.data as BoardAllowanceSheet[];
      } catch {
        return getLocalDB<BoardAllowanceSheet[]>('board_allowance_sheets', []);
      }
    }, { ttlMs: 30000, fallbackLocalKey: 'board_allowance_sheets' });
  },

  async saveBoardAllowanceSheet(sheet: BoardAllowanceSheet): Promise<void> {
    invalidateMemoryCache('board_allowance_sheets');
    const local = getLocalDB<BoardAllowanceSheet[]>('board_allowance_sheets', []);
    const updated = [sheet, ...local.filter(s => s.id !== sheet.id)];
    saveLocalDB('board_allowance_sheets', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_board_allowance_sheets',
        data: updated,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save board allowance sheet to Supabase, saved locally:', e);
    }
  },

  async deleteBoardAllowanceSheet(id: string): Promise<void> {
    invalidateMemoryCache('board_allowance_sheets');
    const local = getLocalDB<BoardAllowanceSheet[]>('board_allowance_sheets', []);
    const updated = local.filter(s => s.id !== id);
    saveLocalDB('board_allowance_sheets', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_board_allowance_sheets',
        data: updated,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to delete board allowance sheet from Supabase, updated locally:', e);
    }
  },

  // ----------------------------------------------------
  // Holiday Management & Branch Operational Status Hub
  // ----------------------------------------------------
  async getHolidays(): Promise<AppHoliday[]> {
    return fetchWithCache('app_holidays', async () => {
      const DEFAULT_NEPALI_HOLIDAYS: AppHoliday[] = [
        { id: 'hol-1', title: 'Nepali New Year (Baishakh 1)', dateBs: '2083-01-01', type: 'Public Holiday', branchId: 'all', description: 'National New Year' },
        { id: 'hol-2', title: 'Buddha Jayanti', dateBs: '2083-01-28', type: 'Public Holiday', branchId: 'all', description: 'Lord Buddha Birth Anniversary' },
        { id: 'hol-3', title: 'Constitution Day', dateBs: '2083-06-03', type: 'Public Holiday', branchId: 'all', description: 'National Constitution Day' },
        { id: 'hol-4', title: 'Dashain Festival (Ghatasthapana)', dateBs: '2083-06-25', type: 'Festival', branchId: 'all', description: 'Commencement of Dashain' },
        { id: 'hol-5', title: 'Dashain (Phulpati to Vijaya Dashami)', dateBs: '2083-07-01', type: 'Festival', branchId: 'all', description: 'Dashain Festival Holidays' },
        { id: 'hol-6', title: 'Deepawali / Tihar (Laxmi Puja)', dateBs: '2083-07-19', type: 'Festival', branchId: 'all', description: 'Festival of Lights' },
        { id: 'hol-7', title: 'Bhai Tika', dateBs: '2083-07-22', type: 'Festival', branchId: 'all', description: 'Tihar Brother Sister Day' },
        { id: 'hol-8', title: 'Chhath Puja', dateBs: '2083-07-28', type: 'Festival', branchId: 'all', description: 'Major Sun Festival' },
        { id: 'hol-9', title: 'Maghe Sankranti', dateBs: '2083-10-01', type: 'Public Holiday', branchId: 'all', description: 'Makar Sankranti' },
        { id: 'hol-10', title: 'Maha Shivaratri', dateBs: '2083-11-27', type: 'Festival', branchId: 'all', description: 'Lord Shiva Festival' },
        { id: 'hol-11', title: 'Holi (Fagu Purnima)', dateBs: '2083-12-14', type: 'Festival', branchId: 'all', description: 'Festival of Colors' }
      ];

      try {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 'saccos_app_holidays').single();
        if (!error && Array.isArray(data?.data) && data.data.length > 0) {
          saveLocalDB('app_holidays', data.data);
          return data.data as AppHoliday[];
        }
      } catch (e) {
        console.warn('Error fetching holidays from settings:', e);
      }

      const local = getLocalDB<AppHoliday[]>('app_holidays', []);
      if (local && local.length > 0) return local;

      // Seed defaults
      saveLocalDB('app_holidays', DEFAULT_NEPALI_HOLIDAYS);
      try {
        await supabase.from('settings').upsert({
          id: 'saccos_app_holidays',
          data: DEFAULT_NEPALI_HOLIDAYS,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Notice: seed holidays cloud sync skipped:", e);
      }
      return DEFAULT_NEPALI_HOLIDAYS;
    }, { ttlMs: 30000, fallbackLocalKey: 'app_holidays' });
  },

  async saveHoliday(holiday: AppHoliday): Promise<void> {
    invalidateMemoryCache('app_holidays');
    const existing = await this.getHolidays();
    const updated = [holiday, ...existing.filter(h => h.id !== holiday.id)];
    saveLocalDB('app_holidays', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_app_holidays',
        data: updated,
        updated_at: new Date().toISOString()
      });
      // Also dual-save into daily_data as backup
      await supabase.from('daily_data').upsert({
        id: 'HOLIDAYS_STORE',
        data: { holidays: updated },
        updated_at: new Date().toISOString()
      });
      // Also sync to dedicated holidays table if present
      await supabase.from('holidays').upsert({
        id: holiday.id,
        title: holiday.title,
        date_bs: holiday.dateBs,
        type: holiday.type,
        branch_id: holiday.branchId || 'all',
        description: holiday.description || '',
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save holiday to cloud, cached locally:', e);
    }
  },

  async deleteHoliday(id: string): Promise<void> {
    invalidateMemoryCache('app_holidays');
    const existing = await this.getHolidays();
    const updated = existing.filter(h => h.id !== id);
    saveLocalDB('app_holidays', updated);

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_app_holidays',
        data: updated,
        updated_at: new Date().toISOString()
      });
      await supabase.from('daily_data').upsert({
        id: 'HOLIDAYS_STORE',
        data: { holidays: updated },
        updated_at: new Date().toISOString()
      });
      await supabase.from('holidays').delete().eq('id', id);
    } catch (e) {
      console.warn('Failed to delete holiday in cloud, cached locally:', e);
    }
  },

  async getWeekendDays(): Promise<number[]> {
    try {
      const { data } = await supabase.from('settings').select('*').eq('id', 'saccos_weekend_days').maybeSingle();
      if (data?.data && Array.isArray(data.data)) {
        saveLocalDB('weekend_days', data.data);
        return data.data as number[];
      }
    } catch (e) {
      console.warn('Failed to load weekend days from cloud:', e);
    }
    const local = getLocalDB<number[]>('weekend_days', [6]);
    return (local && local.length > 0) ? local : [6]; // 6 is Saturday
  },

  async saveWeekendDays(days: number[]): Promise<void> {
    saveLocalDB('weekend_days', days);
    try {
      await supabase.from('settings').upsert({
        id: 'saccos_weekend_days',
        data: days,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save weekend days to cloud:', e);
    }
  },

  async getBranchOperationalStatuses(): Promise<Record<string, BranchOperationalStatus>> {
    const todayBs = new NepaliDate().format('YYYY-MM-DD');
    const weekendDays = await this.getWeekendDays();
    const isWeekend = weekendDays.includes(new NepaliDate().getDay());

    // Load registered holidays
    const holidays = await this.getHolidays();
    const todayHolidays = holidays.filter(h => h.dateBs === todayBs);

    type StoredStatusEntry = {
      status?: BranchOperationalStatus;
      dateBs?: string;
      notes?: string;
      updatedAt?: number;
      headOfficeOpenedAfterAllEndAt?: number;
    };

    // Load manual overrides if any (with timestamp comparison so local/cloud stay coherent)
    const manualOverrides: Record<string, BranchOperationalStatus> = {};
    const mergedRecordsForToday: Record<string, StoredStatusEntry> = {};
    let hadStaleLocalDate = false;
    try {
      const local = getLocalDB<Record<string, StoredStatusEntry>>('branch_manual_statuses', {});
      Object.keys(local).forEach(bId => {
        const rec = local[bId];
        if (!rec) return;
        if (bId === '__cycleMeta') {
          if (rec.dateBs === todayBs) {
            mergedRecordsForToday.__cycleMeta = rec;
          } else {
            hadStaleLocalDate = true;
          }
          return;
        }
        if (rec.dateBs === todayBs && rec.status) {
          mergedRecordsForToday[bId] = rec;
          manualOverrides[bId] = rec.status;
        } else if (rec.dateBs && rec.dateBs !== todayBs) {
          hadStaleLocalDate = true;
        }
      });

      const { data } = await supabase.from('settings').select('*').eq('id', 'saccos_branch_operational_statuses').maybeSingle();
      if (data?.data && typeof data.data === 'object') {
        const cloudRecords = data.data as Record<string, StoredStatusEntry>;
        let changedFromCloud = false;
        Object.keys(cloudRecords).forEach(bId => {
          const cloudRec = cloudRecords[bId];
          if (!cloudRec) return;
          if (bId === '__cycleMeta') {
            if (cloudRec.dateBs === todayBs) {
              const localCycleTs = Number(mergedRecordsForToday.__cycleMeta?.headOfficeOpenedAfterAllEndAt || 0);
              const cloudCycleTs = Number(cloudRec.headOfficeOpenedAfterAllEndAt || 0);
              if (cloudCycleTs > localCycleTs) {
                mergedRecordsForToday.__cycleMeta = cloudRec;
                changedFromCloud = true;
              }
            }
            return;
          }
          if (cloudRec.dateBs === todayBs && cloudRec.status) {
            const localRec = mergedRecordsForToday[bId];
            const cloudTs = Number(cloudRec.updatedAt || 0);
            const localTs = Number(localRec?.updatedAt || 0);
            if (!localRec || cloudTs >= localTs) {
              if (localRec?.status !== cloudRec.status) changedFromCloud = true;
              mergedRecordsForToday[bId] = cloudRec;
              manualOverrides[bId] = cloudRec.status;
            }
          }
        });
        if (Object.keys(mergedRecordsForToday).length > 0 || hadStaleLocalDate) {
          saveLocalDB('branch_manual_statuses', mergedRecordsForToday);
        }
        if ((changedFromCloud || hadStaleLocalDate) && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('branchDayStatusChanged', { detail: { dateBs: todayBs } }));
        }
      } else if (hadStaleLocalDate) {
        saveLocalDB('branch_manual_statuses', mergedRecordsForToday);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('branchDayStatusChanged', { detail: { dateBs: todayBs } }));
        }
      }
    } catch (e) {
      console.warn("Notice: branch operational status read skipped:", e);
    }

    // All known branches (standard + registered active branches)
    const branchIdSet = new Set<string>(['main', 'sahodba', 'pipra', 'parsa']);
    const localBranches = getLocalDB<Branch[]>('branches', []);
    (localBranches || []).forEach(b => {
      if (b && b.status !== 'Inactive') {
        branchIdSet.add(normalizeBranchId(b.id || b.name));
      }
    });
    const branchIds = Array.from(branchIdSet);
    const result: Record<string, BranchOperationalStatus> = {};

    // Get daily data from local cache or memory
    const localDaily = getLocalDB<Record<string, DailyData>>('daily_data', {});

    branchIds.forEach(bId => {
      // 1. Manual override takes highest precedence if set for today
      if (manualOverrides[bId]) {
        result[bId] = manualOverrides[bId];
        return;
      }

      // 2. Check if today is a holiday for this branch
      const branchHoliday = todayHolidays.find(h => h.branchId === 'all' || normalizeBranchId(h.branchId) === normalizeBranchId(bId));
      if (branchHoliday || isWeekend) {
        result[bId] = 'HOLIDAY';
        return;
      }

      // 3. Check activity in today's daily_data
      const todayKey = `${todayBs}_${bId}`;
      const dayData = localDaily[todayKey] || localDaily[todayBs];

      if (dayData && normalizeBranchId(dayData.branchId || 'main') === normalizeBranchId(bId)) {
        const txCount = (dayData.transactions?.length || 0) + (dayData.officeTransactions?.length || 0) + (dayData.remittances?.length || 0);
        const hasDeno = (dayData.denominations?.length || 0) > 0;
        const hasVault = (dayData.vaultTransactions?.length || 0) > 0;

        if (txCount > 0 || hasDeno || hasVault) {
          result[bId] = 'LIVE';
          return;
        }
      }

      // 4. Default business status: Open
      result[bId] = 'OPEN';
    });

    return result;
  },

  async setBranchOperationalStatus(
    branchId: string,
    status: BranchOperationalStatus,
    notes?: string,
    options?: { recordHeadOfficeCycle?: boolean }
  ): Promise<void> {
    const todayBs = new NepaliDate().format('YYYY-MM-DD');
    const normBranch = normalizeBranchId(branchId);
    type StoredStatusEntry = {
      status?: BranchOperationalStatus;
      dateBs?: string;
      notes?: string;
      updatedAt?: number;
      headOfficeOpenedAfterAllEndAt?: number;
    };
    const rawLocal = getLocalDB<Record<string, StoredStatusEntry>>('branch_manual_statuses', {});
    const cleanedForToday: Record<string, StoredStatusEntry> = {};

    // Keep only today's records so prior calendar days auto-reset cleanly
    Object.keys(rawLocal).forEach(k => {
      const rec = rawLocal[k];
      if (rec?.dateBs === todayBs) {
        cleanedForToday[k] = rec;
      }
    });

    const nowTs = Date.now();
    cleanedForToday[normBranch] = { status, dateBs: todayBs, notes, updatedAt: nowTs };

    if (normBranch === 'main' && (status === 'OPEN' || status === 'LIVE') && options?.recordHeadOfficeCycle) {
      cleanedForToday.__cycleMeta = {
        dateBs: todayBs,
        headOfficeOpenedAfterAllEndAt: nowTs
      };
    }

    saveLocalDB('branch_manual_statuses', cleanedForToday);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('branchDayStatusChanged', {
          detail: { branchId: normBranch, status, dateBs: todayBs }
        })
      );
    }

    try {
      await supabase.from('settings').upsert({
        id: 'saccos_branch_operational_statuses',
        data: cleanedForToday,
        updated_at: new Date().toISOString()
      });
      // Also sync to dedicated operational status & audit logs tables
      await supabase.from('branch_operational_status').upsert({
        branch_id: normBranch,
        status: status,
        date_bs: todayBs,
        notes: notes || '',
        updated_at: new Date().toISOString()
      });
      await supabase.from('branch_operational_logs').insert({
        branch_id: normBranch,
        action: (status === 'END' || status === 'CLOSED') ? 'DAY_END' : 'DAY_OPEN',
        status: status,
        date_bs: todayBs,
        notes: notes || '',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to sync branch operational status to cloud:', e);
    }
  },

  // Remittance Company Directory & Credentials Vault
  async getRemittanceCompanies(branchId?: string): Promise<RemittanceCompany[]> {
    const DEFAULT_REMIT_COMPANIES: RemittanceCompany[] = [
      {
        id: 'remit_city',
        name: 'City Express Money Transfer',
        code: 'CTX-109',
        displayOrder: 1,
        hasPin: true,
        txnPin: '8832',
        accessId: 'CTX-ACC-552',
        username: 'ratauli_cityexpress',
        password: 'CityExp#2026Vault',
        contactPhone: '01-4431900',
        contactEmail: 'info@ctxpress.com',
        branchId: 'all',
        status: 'Active',
        lastPasswordChanged: '2026-07-20'
      },
      {
        id: 'remit_esewa',
        name: 'Esewa Money Transfer',
        code: 'EMT-881',
        displayOrder: 2,
        hasPin: true,
        txnPin: '9045',
        accessId: 'EMT-ACC-410',
        username: 'ratauli_esewa_remit',
        password: 'EsewaRemit!2026',
        contactPhone: '1660-01-02121',
        contactEmail: 'care@esewamoneytransfer.com',
        branchId: 'all',
        status: 'Active',
        lastPasswordChanged: '2026-09-10'
      },
      {
        id: 'remit_himal',
        name: 'Himal Remit (HBL)',
        code: 'HML-330',
        displayOrder: 3,
        hasPin: true,
        txnPin: '7721',
        accessId: 'HML-BRANCH-12',
        username: 'ratauli_himal',
        password: 'Himal@Remit2026',
        contactPhone: '01-4227749',
        contactEmail: 'himalremit@hbl.com.np',
        branchId: 'all',
        status: 'Active',
        lastPasswordChanged: '2026-08-28'
      },
      {
        id: 'remit_ime',
        name: 'IME Remit (IME Pay)',
        code: 'IME-702',
        displayOrder: 4,
        hasPin: true,
        txnPin: '1190',
        accessId: 'IME-RAT-884',
        username: 'ratauli_ime',
        password: 'ImePay@Secure26',
        contactPhone: '01-4430600',
        contactEmail: 'support@imeremit.com.np',
        branchId: 'all',
        status: 'Active',
        lastPasswordChanged: '2026-08-15'
      },
      {
        id: 'remit_muktinath',
        name: 'Muktinath Remit',
        code: 'MNR-204',
        displayOrder: 5,
        hasPin: true,
        txnPin: '3310',
        accessId: 'MNB-REMIT-055',
        username: 'ratauli_muktinath',
        password: 'Muktinath#Vault26',
        contactPhone: '01-4437368',
        contactEmail: 'remit@muktinathbank.com.np',
        branchId: 'all',
        status: 'Active',
        lastPasswordChanged: '2026-08-10'
      },
      {
        id: 'remit_prabhu',
        name: 'Prabhu Remit',
        code: 'PRB-01',
        displayOrder: 6,
        hasPin: true,
        txnPin: '4021',
        accessId: 'PRABHU-HO-101',
        username: 'ratauli_prabhu',
        password: 'Prabhu@User2026',
        contactPhone: '01-4788500',
        contactEmail: 'remit@prabhubank.com',
        branchId: 'all',
        status: 'Active',
        lastPasswordChanged: '2026-08-01'
      },
      {
        id: 'remit_surya',
        name: 'Surya Remit',
        code: 'SRY-99',
        displayOrder: 7,
        hasPin: false,
        accessId: 'SRY-RAT-201',
        username: 'ratauli_surya',
        password: 'Surya#Remit2026',
        contactPhone: '01-4221122',
        contactEmail: 'support@suryaremit.com',
        branchId: 'all',
        status: 'Active',
        lastPasswordChanged: '2026-07-15'
      },
      {
        id: 'remit_western_union',
        name: 'Western Union',
        code: 'WU-NP-04',
        displayOrder: 8,
        hasPin: true,
        txnPin: '5612',
        accessId: 'WU-TERM-901',
        username: 'ratauli_wu_agent',
        password: 'WU#SecureGlobal26',
        contactPhone: '1660-01-44444',
        contactEmail: 'nepalcare@westernunion.com',
        branchId: 'all',
        status: 'Active',
        lastPasswordChanged: '2026-09-01'
      }
    ];

    try {
      let list = getLocalDB<RemittanceCompany[]>('remittance_companies', []);
      if (!list || list.length === 0) {
        list = DEFAULT_REMIT_COMPANIES;
        saveLocalDB('remittance_companies', list);
      }
      try {
        const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 2000)
        );
        const fetchPromise = supabase.from('remittance_companies').select('*');
        const res: any = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res?.data;
        const error = res?.error;

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: RemittanceCompany[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            logoUrl: d.logo_url || d.logoUrl,
            code: d.code,
            displayOrder: d.display_order !== undefined ? d.display_order : d.displayOrder,
            hasPin: d.has_pin !== undefined ? d.has_pin : (d.hasPin !== undefined ? d.hasPin : !!d.txn_pin || !!d.txnPin),
            accessId: d.access_id || d.accessId || '',
            username: d.username,
            password: d.password,
            txnPin: d.txn_pin || d.txnPin,
            portalUrl: d.portal_url || d.portalUrl,
            status: d.status || 'Active',
            contactPhone: d.contact_phone || d.contactPhone,
            contactEmail: d.contact_email || d.contactEmail,
            branchId: d.branch_id || d.branchId || 'main',
            notes: d.notes,
            lastPasswordChanged: d.last_password_changed || d.lastPasswordChanged,
            createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
            updatedAt: d.updated_at ? new Date(d.updated_at).getTime() : Date.now()
          }));
          list = mapped;
          saveLocalDB('remittance_companies', list);
        }
      } catch (e) {
        // use local
      }

      // Sort by internal S.N. (displayOrder)
      list.sort((a, b) => {
        const ordA = a.displayOrder !== undefined ? Number(a.displayOrder) : 999;
        const ordB = b.displayOrder !== undefined ? Number(b.displayOrder) : 999;
        if (ordA !== ordB) return ordA - ordB;
        return (a.name || '').localeCompare(b.name || '');
      });

      if (branchId && branchId !== 'all') {
        return list.filter(c => !c.branchId || c.branchId === 'all' || c.branchId === branchId);
      }
      return list;
    } catch (err) {
      console.warn("getRemittanceCompanies error:", err);
      return [];
    }
  },

  async saveRemittanceCompany(company: RemittanceCompany): Promise<{ success: boolean; supabaseSynced: boolean; error?: string }> {
    try {
      const list = getLocalDB<RemittanceCompany[]>('remittance_companies', []);
      const idx = list.findIndex(c => c.id === company.id);
      let updated: RemittanceCompany[];
      if (idx >= 0) {
        updated = [...list];
        updated[idx] = { ...company, updatedAt: Date.now() };
      } else {
        updated = [company, ...list];
      }
      saveLocalDB('remittance_companies', updated);

      let supabaseSynced = false;
      let syncError: string | undefined;

      try {
        const payload = {
          id: String(company.id),
          name: String(company.name || '').trim(),
          logo_url: company.logoUrl || null,
          code: company.code || null,
          display_order: company.displayOrder !== undefined ? Number(company.displayOrder) : 1,
          has_pin: Boolean(company.hasPin),
          access_id: company.accessId || '',
          username: company.username || '',
          password: company.password || '',
          txn_pin: company.txnPin || null,
          portal_url: company.portalUrl || null,
          status: company.status || 'Active',
          contact_phone: company.contactPhone || null,
          contact_email: company.contactEmail || null,
          branch_id: company.branchId || 'main',
          notes: company.notes || null,
          last_password_changed: company.lastPasswordChanged || new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('remittance_companies')
          .upsert(payload, { onConflict: 'id' });

        if (error) {
          syncError = error.message;
          console.warn('Supabase saveRemittanceCompany error:', error.message);
        } else {
          supabaseSynced = true;
        }
      } catch (e: unknown) {
        const errObj = e as { message?: string };
        syncError = errObj?.message || String(e);
        console.warn('Supabase saveRemittanceCompany exception:', syncError);
      }

      try {
        window.dispatchEvent(new Event('remittanceCompaniesUpdated'));
      } catch (_e) {
        // ignore
      }

      return { success: true, supabaseSynced, error: syncError };
    } catch (err: any) {
      console.warn('saveRemittanceCompany error:', err);
      return { success: false, supabaseSynced: false, error: errObj?.message || String(err) };
    }
  },

  async deleteRemittanceCompany(id: string): Promise<{ success: boolean; supabaseSynced: boolean; error?: string }> {
    try {
      const list = getLocalDB<RemittanceCompany[]>('remittance_companies', []);
      const updated = list.filter(c => c.id !== id);
      saveLocalDB('remittance_companies', updated);

      let supabaseSynced = false;
      let syncError: string | undefined;

      try {
        const { error } = await supabase.from('remittance_companies').delete().eq('id', id);
        if (error) {
          syncError = error.message;
          console.warn('Supabase deleteRemittanceCompany error:', error.message);
        } else {
          supabaseSynced = true;
        }
      } catch (e: unknown) {
        const errObj = e as { message?: string };
        syncError = errObj?.message || String(e);
      }

      try {
        window.dispatchEvent(new Event('remittanceCompaniesUpdated'));
      } catch (_e) {
        // ignore
      }

      return { success: true, supabaseSynced, error: syncError };
    } catch (err: any) {
      console.warn('deleteRemittanceCompany error:', err);
      return { success: false, supabaseSynced: false, error: errObj?.message || String(err) };
    }
  },

  async syncAllRemittanceToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const list = getLocalDB<RemittanceCompany[]>('remittance_companies', []);
      if (!list || list.length === 0) {
        return { success: true, count: 0 };
      }

      const rows = list.map(c => ({
        id: String(c.id),
        name: String(c.name || '').trim(),
        logo_url: c.logoUrl || null,
        code: c.code || null,
        display_order: c.displayOrder !== undefined ? Number(c.displayOrder) : 1,
        has_pin: Boolean(c.hasPin),
        access_id: c.accessId || '',
        username: c.username || '',
        password: c.password || '',
        txn_pin: c.txnPin || null,
        portal_url: c.portalUrl || null,
        status: c.status || 'Active',
        contact_phone: c.contactPhone || null,
        contact_email: c.contactEmail || null,
        branch_id: c.branchId || 'main',
        notes: c.notes || null,
        last_password_changed: c.lastPasswordChanged || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('remittance_companies')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error('syncAllRemittanceToSupabase error:', error.message);
        return { success: false, count: 0, error: error.message };
      }

      return { success: true, count: rows.length };
    } catch (err: any) {
      console.error('syncAllRemittanceToSupabase exception:', err);
      return { success: false, count: 0, error: errObj?.message || String(err) };
    }
  }
};

