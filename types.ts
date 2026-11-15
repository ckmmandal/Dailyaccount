
export enum RemittanceType {
  SEND = 'Send',
  RECEIVE = 'Receive'
}

export type CapitalizationFrequency = 'None' | 'Monthly' | 'Quarterly' | 'HalfYearly' | 'Yearly';

export type Permission = 
  | 'view_transaction' 
  | 'add_transaction' 
  | 'edit_transaction' 
  | 'delete_transaction' 
  | 'view_reports' 
  | 'view_ledger_names'
  | 'view_income_expense'
  | 'view_office_expenses'
  | 'view_daily_ledger'
  | 'view_capital_entry'
  | 'view_cash_entry' 
  | 'manage_users' 
  | 'manage_settings'
  | 'view_consolidated_report'
  | 'cross_branch_operation'
  | 'manage_hr'
  | 'manage_notices'
  | 'manage_branches'
  | 'manage_attendance'
  | 'manage_leaves'
  | 'manage_payroll'
  | 'manage_backup'
  | 'system_reset'
  | 'view_insurance'
  | 'view_microfinance'
  | 'view_depreciation'
  | 'view_alerts'
  | 'view_shortcuts'
  | string;

export interface Notice {
  id: string;
  title: string;
  date: string; // BS
  description: string;
  attachmentUrl?: string; // Base64
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'other';
  status: 'Active' | 'Archived';
  branchId: string;
  createdAt: number;
}

export interface PopupNotice {
  id: string;
  title: string;
  message: string;
  imageUrl?: string;
  imageName?: string;
  priority?: 'Normal' | 'Important' | 'Urgent';
  targetBranchId?: string; // 'all' or branch ID
  isActive: boolean;
  date?: string; // Display / BS date
  validUntil?: string; // Expiration BS date / Valid Until
  showOnLogin?: boolean;
  actionButtonText?: string;
  createdAt: number;
  updatedAt?: number;
  createdBy?: string;
}

export interface DownloadableDocument {
  id: string;
  title: string;
  date: string; // BS
  fileUrl: string; // Base64
  fileName: string;
  fileType: 'image' | 'pdf' | 'other';
  category: string;
  branchId: string;
  createdAt: number;
}

export interface Branch {
  id: string;
  name: string;
  nameNp?: string;
  code: string;
  codeNp?: string;
  location?: string;
  locationNp?: string;
  branchType?: 'Head Office' | 'Branch Office' | 'Sub-Branch' | 'Extension Counter' | string;
  branchTypeNp?: string;
  email?: string;
  status: 'Active' | 'Inactive';
  createdAt: number;
}

export interface Employee {
  id: string;
  fullName: string;
  employeeCode: string;
  designation: string;
  department: string;
  gender: 'Male' | 'Female';
  maritalStatus: 'Single' | 'Couple';
  employmentType: 'Permanent' | 'Temporary';
  mobile: string;
  email?: string;
  panNo?: string;
  joinedDate: string; // AD
  basicSalary: number;
  daType?: 'Percentage' | 'Amount' | 'None';
  daValue?: number;
  dearnessAllowance?: number;
  gradeRate?: number;
  gradeRateAmount?: number;
  hasSSF?: boolean;
  ssfContribution?: number;
  hasPF?: boolean;
  pfContribution?: number;
  hasGratuity?: boolean;
  gratuity?: number;
  monthsActive?: number; // Default 12
  hasDashain?: boolean;
  dashainBonus?: number; // Default 1 month basic
  festivalBonus?: number; // New field
  hasMedical?: boolean;
  medicalAllowance?: number; // Default 1 month basic
  hasBonus?: boolean;
  bonusYearly?: number;
  sanchitLeaveDays?: number;
  sanchitLeaveAmount?: number;
  hasDressAllowance?: boolean;
  dressAllowance?: number;
  status: 'Active' | 'On Leave' | 'Terminated';
  photoUrl?: string;
  branchId: string;
  // KYC & Personal Details
  citizenshipNo?: string;
  citizenshipDistrict?: string;
  citizenshipIssueDate?: string;
  citizenshipFrontUrl?: string;
  citizenshipBackUrl?: string;
  fatherName?: string;
  fatherNameNepali?: string;
  motherName?: string;
  motherNameNepali?: string;
  grandfatherName?: string;
  grandfatherNameNepali?: string;
  spouseName?: string;
  spouseNameNepali?: string;
  previousName?: string;
  previousNameNepali?: string;
  fullNameNepali?: string;
  designationNepali?: string;
  departmentNepali?: string;
  dobBs?: string;
  nationality?: string;
  permanentAddress?: string;
  permanentAddressNepali?: string;
  temporaryAddress?: string;
  temporaryAddressNepali?: string;
  bankName?: string;
  bankAccountNo?: string;
  accountHolderName?: string;
  bankBranch?: string;
  emergencyContact?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;
  emergencyAddress?: string;
  bloodGroup?: string;
  qualification?: string;
  institution?: string;
  passedYear?: string;
  previousEmployer?: string;
  previousDesignation?: string;
  totalExperience?: string;
  expJoiningDate?: string;
  expLeavingDate?: string;
  reportingManager?: string;
  workLocation?: string;
  docsCitizenship?: string;
  docsNid?: string;
  docsPan?: string;
  docsEducation?: string;
  docsExperience?: string;
  docsContract?: string;
  // Tax & Allowances Related
  lifeInsurance?: number;
  hasLifeInsurance?: boolean;
  healthInsurance?: number;
  hasHealthInsurance?: boolean;
  buildingInsurance?: number;
  buildingAllowance?: number;
  hasBuildingAllowance?: boolean;
  medicalExpensesPaid?: number;
  remoteAreaCategory?: 'A' | 'B' | 'C' | 'D' | 'E' | 'None';
  remoteAllowance?: number;
  hasRemoteAllowance?: boolean;
  isIncapacitated?: boolean;
}

export interface LeaveType {
  id: string;
  name: string;
  nameNp: string;
  totalDays: number;
  genderSpecific?: 'Male' | 'Female';
  isOneTime?: boolean;
  leaveType?: string;
  reserveLeave?: string | number;
  nonReserveLeave?: string | number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string; // AD
  endDate: string; // AD
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  appliedDate: number;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: string; 
  year: string;
  basicSalary: number;
  gradeAmt: number;
  allowance: number; 
  ssfEmployee: number; 
  pfEmployee: number; 
  gratuity: number; 
  totalIncome: number;
  ssfEmployer: number; 
  pfEmployer: number; 
  tax: number;
  netSalary: number;
  generatedDate: number;
  status: 'Paid' | 'Pending';
  preparedBy: string;
  approvedBy: string;
  branchId?: string | null;
  dashainBonus?: number;
  bonusAmount?: number;
  sanchitLeaveAmount?: number;
  medicalAllowance?: number;
  dressAllowance?: number;
  showDashain?: boolean;
  showBonus?: boolean;
  showSanchit?: boolean;
  showMedical?: boolean;
  showDress?: boolean;
}

export interface Complaint {
  id: string;
  employeeId: string;
  subject: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Resolved';
  isConfidential: boolean;
  date: number;
  resolutionNote?: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Holiday' | 'Weekly Off';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  date: string; // YYYY-MM-DD (AD or BS)
  dateBs?: string; // e.g. 2083-05-15
  inTime?: string;
  outTime?: string;
  workHours?: number;
  status: AttendanceStatus;
  remarks?: string;
  branchId?: string;
  source?: 'excel_upload' | 'manual' | 'biometric';
  createdAt?: number;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface LedgerAccount {
  id: string;
  name: string;
  branchId: string; 
  type: 'Customer' | 'Vendor' | 'Investment' | 'Loan' | 'Other' | 'Staff';
  interestRate: number; 
  mobile?: string;
  email?: string;
  address?: string;
  photoUrl?: string; 
  openingBalance: number;
  initialBalance?: number;
  status: 'Active' | 'Closed';
  capitalizationFrequency: CapitalizationFrequency;
  capitalizeToPrincipal: boolean;
  createdAt: number;
  employeeId?: string;
  employeeBranchId?: string;
  employeeCode?: string;
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  mobile: string;
  password?: string;
  passwordUpdatedAt?: number; // Timestamp of when password was last changed
  forcePasswordChange?: boolean; // Flag to force password change on next login
  roleId: string;
  branchId: string; 
  status: 'Active' | 'Inactive';
  accountCreated: number;
  lastLogin?: number;
  lastActivity?: number;
  address?: string;
  idNumber?: string;
  dob?: string;
  profilePhoto?: string;
  permissions: Permission[];
  documents?: { id: string; name: string; type: string; date: number }[];
  notes?: string;
  department?: string;
  designation?: string;
}

export interface TaxSlab { 
  label: string; 
  limit: number; 
  rate: number; 
}

export interface TaxConfig { 
  singleSlabs: TaxSlab[]; 
  marriedSlabs: TaxSlab[]; 
  retirementCap: number; 
}

export interface EmailNotificationSettings {
  enabled: boolean; // Master Switch for all email notifications
  transactionAlerts: boolean; // Transaction & Ledger (creation, edit, delete)
  payrollSalarySlips: boolean; // Employee payroll & pay slip emails
  securityPasswordReset: boolean; // Password reset, OTP, security emails
  dayEndSettlementSummary: boolean; // Day-end / settlement summary alerts
  leaveAndAttendance: boolean; // HR leave applications & approvals
  adminNotificationEmail?: string; // Optional administrator email for notifications/alerts
}

export interface SystemSettings {
  systemName: string;
  systemNameNp?: string;
  currency: string;
  remittanceCompanies: string[];
  remittanceCompaniesByBranch?: Record<string, string[]>;
  hiddenRemittanceCompaniesByBranch?: Record<string, string[]>;
  officeHeads: string[];
  approvalLimit: number;
  enableApprovals: boolean;
  logoUrl?: string;
  masterLock?: boolean;
  address?: string;
  addressNp?: string;
  registrationNo?: string;
  panNo?: string;
  email?: string;
  phone?: string;
  allowBackDateEntry?: boolean;
  allowDayReopenSpecialAccess?: boolean;
  emailNotifications?: EmailNotificationSettings;
  autoLogoutMinutes?: number;
}

export interface DenominationEntry {
  value: number;
  quantity: number;
}

export interface DenoAdjustmentEntry {
  id: string;
  value: number;
  quantity: number;
  type: 'add' | 'less';
  date: string;
  isManualVault?: boolean;
  isVaultTransfer?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt?: number;
}

export interface VaultTransaction {
  id: string;
  date: string;
  type: 'in' | 'out'; 
  source: 'Teller' | 'Bank' | 'Branch' | 'Manual';
  amount: number;
  denominations: DenominationEntry[];
  remarks: string;
  createdBy: string;
  branchId: string;
  targetBranchId?: string;
  senderBranchId?: string;
  partyType?: string;
  counterBranchId?: string;
  counterBranchName?: string;
  createdByName?: string;
}

export interface OfficeAccountEntry {
  id: string;
  head: string;
  amount: number;
  type: 'in' | 'out'; 
  date: string;
  remarks?: string;
  approved?: boolean;
  createdBy: string;
  createdByName?: string;
  branchId: string; 
  origin?: 'transaction' | 'report' | 'income_expense' | 'vault';
}

export interface RemittanceEntry {
  id: string;
  companyName: string;
  type: RemittanceType;
  amount: number;
  date: string;
  remarks?: string;
  referenceNo?: string;
  approved?: boolean;
  createdBy: string;
  createdByName?: string;
  branchId: string; 
  origin?: 'teller' | 'report' | 'transferred';
  transferredToBackOffice?: boolean;
  transferredToConsolidated?: boolean;
  transferredAt?: number;
}

export interface ReceivablePayableEntry {
  id: string;
  description: string;
  accountId?: string;
  amount: number;
  type: 'in' | 'out';
  date: string;
  remarks?: string;
  createdBy: string;
  createdByName?: string;
  branchId: string; 
}

export interface OtherAdjustmentEntry {
  id: string;
  type: 'add' | 'less';
  amount: number;
  remarks: string;
  userName?: string;
  userId?: string;
  timestamp?: number;
  date?: string;
  runningBalance?: number;
}

export interface DailyData {
  date: string;
  branchId: string;
  denominations: DenominationEntry[];
  denoAdjustments: DenoAdjustmentEntry[];
  transactions: ReceivablePayableEntry[];
  officeTransactions: OfficeAccountEntry[];
  remittances: RemittanceEntry[];
  vaultTransactions?: VaultTransaction[]; 
  otherAmount?: number;
  otherType?: 'add' | 'less';
  otherRemarks?: string;
  otherEntries?: OtherAdjustmentEntry[];
}

export type BranchOperationalStatus = 'LIVE' | 'OPEN' | 'END' | 'CLOSED' | 'HOLIDAY' | 'CLOSING';

export interface AppHoliday {
  id: string;
  title: string;
  dateBs: string; // YYYY-MM-DD in Bikram Sambat e.g. 2083-07-01
  dateAd?: string;
  type: 'Public Holiday' | 'Weekly Off' | 'Local Holiday' | 'Festival' | 'Emergency Holiday';
  branchId: 'all' | string; // 'all' or branch ID
  description?: string;
  isRecurringSaturday?: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface BranchDayStatusRecord {
  branchId: string;
  status: BranchOperationalStatus;
  dateBs: string;
  updatedAt?: string;
  updatedBy?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  userId: string;
  branchId?: string;
  action: string; 
  details: string;
  ip?: string;
  device?: string;
}

export interface FDRecordItem {
  id: string;
  accountType: string;
  holderName: string;
  holderNameNp: string;
  accountNo: string;
  selectedBranch: string;
  signatoryName: string;
  issueDate: string;
  maturityDate: string;
  duration: string;
  interestRate: string;
  compounding: string;
  tax: string;
  amount: string;
  amountInWords: string;
  totalInterest: string;
  taxDeduction: string;
  maturityAmount: string;
  maturityInWords: string;
  createdAt: string;
}

export type OfficeExpenseCategory = 
  | 'house_rent' 
  | 'cleaner_payment' 
  | 'khaja_kharch' 
  | 'electricity_bill' 
  | 'telephone_bill' 
  | 'other_expenses';

export interface BranchFixedExpenseConfig {
  branchId: string;
  // House Rent
  rentEnabled?: boolean;
  rentAmount?: number; // Gross Rent
  rentTdsRate?: number; // e.g. 10%
  rentNetPaid?: number; // Net Rent
  landlordName?: string;
  landlordPan?: string;
  rentPaymentMethod?: 'Account Transfer' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'ConnectIPS' | 'Esewa' | 'Khalti' | string;
  rentAccountNo?: string;
  rentBankName?: string;

  // Cleaner Payment
  cleanerEnabled?: boolean;
  cleanerName?: string;
  cleanerAmount?: number; // Gross Paid
  cleanerTdsRate?: number; // TDS %
  cleanerNetPaid?: number; // Net Paid
  cleanerWorkingDays?: number;
  cleanerPaymentMethod?: 'Account Transfer' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'ConnectIPS' | 'Esewa' | 'Khalti' | string;
  cleanerAccountNo?: string;
  cleanerBankName?: string;

  // Telephone & Internet
  telephoneEnabled?: boolean;
  telephoneProvider?: string;
  telephoneAccountNo?: string;
  telephoneAmount?: number;
  telephoneRemark?: string;
  telephonePaymentMethod?: 'Account Transfer' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'ConnectIPS' | 'Esewa' | 'Khalti' | string;
  telephoneBankName?: string;

  // Khaja / Refreshment
  khajaEnabled?: boolean;
  khajaMonthlyAmount?: number;
  khajaDescription?: string;
  khajaRemark?: string;
  khajaPaymentMethod?: 'Account Transfer' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'ConnectIPS' | 'Esewa' | 'Khalti' | string;

  // Electricity Defaults
  electricityMeterNo?: string;
  electricityConsumerNo?: string;
  electricityRate?: number;
  electricityMinCharge?: number;
}

export interface OfficeExpenseRecord {
  id: string;
  branchId: string;
  category: OfficeExpenseCategory;
  categoryLabel?: string;
  date: string; // BS Date (e.g. 2083/04/25)
  month: string; // Nepali Month (e.g. साउन)
  fiscalYear: string; // e.g. 2083/2084
  
  // Financials
  amount: number;
  taxDeduction?: number;
  netPaidAmount: number;
  
  // Electricity / Utility Units (Previous & Current Units)
  meterNo?: string;
  consumerNo?: string;
  previousUnit?: number;
  currentUnit?: number;
  previous?: number;
  current?: number;
  consumedUnits?: number;
  ratePerUnit?: number;
  minDemandCharge?: number;
  rebateOrPenalty?: number;
  
  // House Rent
  landlordName?: string;
  panVatNo?: string;
  rentPeriodFrom?: string;
  rentPeriodTo?: string;
  
  // Cleaner Payment
  cleanerName?: string;
  workingDays?: number;
  
  // Khaja / Refreshment
  attendeesCount?: number;
  itemsDescription?: string;
  
  // Telephone & Internet
  phoneOrAccountNo?: string;
  serviceProvider?: string;
  
  // General details
  paidTo?: string;
  paymentMethod: 'Account Transfer' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'ConnectIPS' | 'Esewa' | 'Khalti' | string;
  accountNo?: string;
  bankName?: string;
  voucherNo?: string;
  billNo?: string;
  approvedBy?: string;
  recordedBy?: string;
  remarks?: string;
  attachmentUrl?: string;
  createdAt: number;
}

export interface SavedOfficeExpenseSheet {
  id: string;
  fiscalYear: string;
  month: string;
  monthNp?: string;
  branchId: string;
  branchName?: string;
  totalExpenses: number; // Gross Total
  taxAmount: number; // TDS Tax Amount
  netPaidAmount: number; // Net Paid Amount
  recordsCount?: number;
  preparedBy?: string;
  preparedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  savedAt: number;
  updatedAt?: number;
  remarks?: string;
  status?: 'Approved' | 'Draft' | 'Finalized';
}

export interface ChatAttachment {
  id: string;
  name: string;
  url: string; // Base64 data URL or external URL
  size?: number; // File size in bytes
  type: 'image' | 'file' | 'pdf' | 'audio';
  mimeType?: string;
}

export interface ChatReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface ChatMessage {
  id: string;
  channelId?: string; // Channel ID (e.g., 'all_staff', 'operations', 'branch_sahodba')
  recipientId?: string; // For 1-on-1 direct message (User ID or Employee ID)
  recipientName?: string;
  senderId: string; // User ID or Employee ID
  senderName: string;
  senderUsername?: string;
  senderDesignation?: string;
  senderBranchId?: string;
  senderBranchName?: string;
  senderPhoto?: string;
  content: string;
  attachments?: ChatAttachment[];
  reactions?: ChatReaction[];
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  isImportant?: boolean;
  readBy?: string[]; // Array of User IDs who have viewed/read the message
  createdAt: number; // Timestamp (e.g. Date.now())
  updatedAt?: number;
}

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  type: 'public' | 'branch' | 'direct';
  branchId?: string;
  memberIds?: string[];
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: number;
}

// ==========================================
// Board of Directors & Governance Models
// ==========================================

export interface BoardCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  maxMembers?: number;
  isCustom?: boolean;
  displayOrder: number;
}

export interface BoardDesignation {
  id: string;
  title: string;
  titleNp?: string;
  code?: string;
  categoryId?: string; // Specific committee ID or 'all'
  categoryName?: string;
  mandate?: string; // Roles, responsibilities & powers
  defaultAllowance?: number;
  displayOrder: number;
  isCustom?: boolean;
}

export interface BoardDocument {
  id: string;
  title: string;
  type: 'citizenship' | 'pan' | 'election_certificate' | 'signature' | 'property_declaration' | 'bank_cheque' | 'other';
  fileUrl: string; // Base64 or URL
  fileName: string;
  uploadedAt: number;
}

export interface BoardTenure {
  termLabel: string; // e.g., "2080 - 2084 (4-Year Tenure)"
  startDateBs: string; // BS Date
  oathDateBs?: string; // BS Date
  endDateBs: string; // BS Date
  status: 'Active' | 'Expiring Soon' | 'Completed' | 'Resigned' | 'Vacant';
  notes?: string;
}

export interface BoardAllowanceConfig {
  meetingAllowance: number;
  communicationAllowance: number;
  travelAllowance: number;
  refreshmentAllowance: number;
  otherAllowance?: number;
  customTdsRate?: number; // Defaults to 15%
  isEligibleForAllowance: boolean;
}

export interface BoardMember {
  id: string;
  fullName: string; // English
  fullNameNp?: string; // Nepali
  memberCode?: string; // Cooperative Share/Account No
  registrationDateBs?: string; // फाराम भरेको मिति (Date)
  memberId?: string; // सदस्यता नं.
  accountNumber?: string; // खाता नं.
  categoryId: string;
  categoryName: string;
  designation: string;
  gender: 'Male' | 'Female' | 'Other';
  dobBs?: string;
  dobAd?: string;
  bloodGroup?: string;
  maritalStatus?: 'Single' | 'Married' | 'Other';
  familyType?: string;
  additionalFamilyMembers?: Array<{ name: string; relation: string; age?: string; occupation?: string }>;
  occupation?: string;
  occupationDetail?: string;
  spouseOccupation?: string;
  earningMemberRelation?: string;
  earningMemberOccupation?: string;
  isHighProfile?: string; // 'रहेको' | 'नरहेको'
  mobile: string;
  email?: string;
  panNo: string;
  citizenshipNo?: string;
  citizenshipIssuedDistrict?: string;
  citizenshipIssuedOffice?: string;
  citizenshipIssuedDateBs?: string;
  citizenshipIssuedDateAd?: string;
  permanentAddress?: string;
  temporaryAddress?: string;
  permanentProvince?: string;
  permanentDistrict?: string;
  permanentMunicipality?: string;
  permanentWard?: string;
  permanentTole?: string;
  permanentHouseNo?: string;
  temporaryProvince?: string;
  temporaryDistrict?: string;
  temporaryMunicipality?: string;
  temporaryWard?: string;
  temporaryTole?: string;
  isSameAddress?: boolean;
  workingAreaResidency?: string; // 'स्थायी' | 'अस्थायी'
  voterIdNo?: string;
  votingCenter?: string;
  stayDurationInArea?: string;
  passportNo?: string;
  cooperativePurpose?: string;
  isOtherCoopMember?: string; // 'भएको' | 'नभएको'
  isFamilyOtherCoopMember?: string; // 'भएको' | 'नभएको'
  annualIncomeRange?: string;
  annualIncomeSources?: {
    agriculture?: string;
    business?: string;
    domesticJob?: string;
    foreignJob?: string;
  };
  shareAmount?: number | string;
  savingsAmount?: number | string;
  estimatedLoan?: number | string;
  estimatedTransactionsCount?: string;
  estimatedAnnualDeposit?: string;
  selfDeclarationConfirmed?: boolean;
  signaturePhoto?: string;
  rightThumbPhoto?: string;
  leftThumbPhoto?: string;
  fatherName?: string;
  motherName?: string;
  grandfatherName?: string;
  spouseName?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNo?: string;
  bankAccountType?: string;
  profilePhoto?: string;
  documents: BoardDocument[];
  tenure: BoardTenure;
  allowanceConfig: BoardAllowanceConfig;
  branchId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BoardMonthlyAllowanceItem {
  memberId: string;
  memberName: string;
  categoryName: string;
  designation: string;
  panNo: string;
  bankName: string;
  bankAccountNo: string;
  meetingAllowance: number;
  communicationAllowance: number;
  travelAllowance: number;
  refreshmentAllowance: number;
  otherAllowance: number;
  grossAllowance: number;
  tdsRate: number; // usually 15
  tdsAmount: number;
  netPayable: number;
  status: 'Unpaid' | 'Paid';
  paymentDateBs?: string;
  paymentMethod?: 'Bank Transfer' | 'Cheque' | 'Cash';
  referenceNo?: string;
  notes?: string;
}

export interface BoardAllowanceSheet {
  id: string;
  fiscalYear: string; // e.g. "2081/2082"
  month: string; // e.g. "Baisakh", "Jestha", etc.
  paymentFrequency?: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
  dateBs: string;
  items: BoardMonthlyAllowanceItem[];
  totalGross: number;
  totalTds: number;
  totalNet: number;
  status: 'Draft' | 'Approved' | 'Disbursed';
  preparedBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  remarks?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RemittanceCompany {
  id: string;
  name: string;
  logoUrl?: string;
  code?: string;
  displayOrder?: number;
  hasPin?: boolean;
  accessId: string;
  username: string;
  password: string;
  txnPin?: string;
  contactPhone?: string;
  contactEmail?: string;
  portalUrl?: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  branchId?: string;
  notes?: string;
  lastPasswordChanged?: string;
  createdAt: number;
  updatedAt: number;
}

// ==========================================
// LOAN INSURANCE MANAGEMENT (PURE ENGLISH DEFINITIONS)
// ==========================================

export type LoanInsuranceStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Claimed' | 'Settled' | 'Rejected' | 'start_policy' | 'renewed' | 'Closed' | 'closed' | 'rejected' | 'deactivated' | 'Deactivated';

export type LoanTypeCategory = 
  | 'Agricultural Term Loan'
  | 'Business Microloan'
  | 'Personal Term Loan'
  | 'Gold & Silver Loan'
  | 'Emergency Loan'
  | 'Hire Purchase / Auto'
  | 'Deprived Sector Loan'
  | 'General Loan';

export type InsurancePolicyType = 
  | 'Credit Life Protection'
  | 'Collateral Property Insurance'
  | 'Livestock & Crop Insurance'
  | 'Accidental & Critical Illness';

export interface LoanInsuranceRecord {
  id: string;
  sn?: number;
  policyNo: string;
  memberId: string; // e.g. RSCC-MEM-1042
  memberName: string;
  gender?: 'Male' | 'Female' | 'Other';
  citizenshipNo: string;
  contactNumber?: string;
  branchId: string;
  loanAccountNo?: string;
  loanType: LoanTypeCategory | string;
  loanDisbursedDate?: string;
  loanDisbursedDateBs?: string;
  loanExpiryDate?: string;
  loanExpiryDateBs?: string;
  loanAmount: number;
  outstandingBalance?: number;
  insuranceCompany: string; // e.g. National Life Insurance, Nepal Micro Insurance, Shikhar Insurance, Sanima GIC, etc.
  insuranceType: InsurancePolicyType | string;
  sumAssured: number;
  premiumRatePercent?: number;
  premiumAmount: number;
  policyStartDate: string;
  policyStartDateBs?: string;
  policyExpiryDate: string;
  policyExpiryDateBs?: string;
  status: LoanInsuranceStatus;
  termMonths?: number;
  age?: number;
  dateOfBirth?: string;
  dateOfBirthBs?: string;
  address?: string;
  occupation?: string;
  disability?: 'None' | 'Partial' | 'Total' | string;
  livingActiveLife?: 'Yes' | 'No' | string;
  livingStatus?: 'Active / Normal Life' | 'Critical / Bedridden' | string;
  nomineeName: string;
  nomineeRelation: string;
  nomineeContact?: string;
  nomineeCitizenship?: string;
  nomineeDob?: string;
  nomineeDobBs?: string;
  nomineeGender?: 'Male' | 'Female' | 'Other' | string;
  documentUrl?: string;
  documentName?: string;
  ocrExtractedText?: string;
  confidence?: number;
  premiumPaymentStatus?: 'Paid' | 'Due';
  premiumPaymentRemark?: string;
  loanDurationYears?: number;
  paidYears?: number;
  dueYears?: number;
  insuranceTillDate?: string;
  insuranceTillDateBs?: string;
  isPremiumSaved?: boolean;
  isFirstPolicy?: boolean;
  memberPhoto?: string;
  signatureMember?: string;
  signatureManager?: string;
  signatureOfficer?: string;
  notes?: string;
  // Legacy / Database schema aliases
  name?: string;
  branch?: string;
  premium?: number;
  premium_payment_status?: string;
  start_date?: string;
  maturity_date?: string;
  term_month?: number;
  nominee_name?: string;
  nominee_relation?: string;
  createdAt: number;
  updatedAt: number;
}

export type ClaimCauseType = 
  | 'Borrower Demise'
  | 'Permanent Disability'
  | 'Property Damage'
  | 'Livestock Loss'
  | 'Critical Illness';

export type ClaimLifecycleStage = 
  | 'Claim Submission'
  | 'Document Verification'
  | 'Evaluation'
  | 'Admin Approval'
  | 'Payout Disbursement'
  | 'Settlement Receipt';

export type ClaimStatusType = 
  | 'Submitted'
  | 'Under Review'
  | 'Submitted to Insurer'
  | 'Approved'
  | 'Settled'
  | 'Rejected';

export interface InsuranceClaimRecord {
  id: string;
  claimNo: string;
  insuranceRecordId: string;
  policyNo: string;
  memberId: string;
  memberName: string;
  citizenshipNo?: string;
  loanAccountNo?: string;
  branchId: string;
  claimDate: string;
  claimDateBs?: string;
  incidentDate?: string;
  incidentDateBs?: string;
  claimCause: ClaimCauseType | string;
  outstandingLoanAtClaim: number;
  claimAmountRequested: number;
  claimAmountApproved?: number;
  disbursedAmount?: number;
  disbursementDate?: string;
  disbursementDateBs?: string;
  payoutMethod?: 'Cheque' | 'Direct Account Transfer' | 'Cash Voucher';
  lifecycleStage?: ClaimLifecycleStage;
  status: ClaimStatusType;
  insurerReferenceNo?: string;
  settlementDate?: string;
  settlementDateBs?: string;
  settlementVoucherNo?: string;
  deathCertificateNo?: string;
  hospitalReportSummary?: string;
  verifiedBy?: string;
  approvedBy?: string;
  remarks?: string;
  supportingDocuments?: string[];
  documentUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface InsurancePartnerCompany {
  id: string;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  portalUrl?: string;
  defaultPremiumRate: number;
  status: 'Active' | 'Inactive';
}

// ============================================================================
// ADMIN CENTER: SAVING & LOAN PRODUCTS
// ============================================================================

export type SavingProductCapitalization = 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'At Maturity';

export interface SavingProduct {
  id: string;
  name: string;
  nameNp?: string;
  interestRate: number; // Annual interest percentage e.g. 6.0
  capitalization: SavingProductCapitalization;
  minimumBalance?: number;
  description?: string;
  status: 'Active' | 'Inactive';
  showInMicrofinanceAndFD?: boolean; // When checked in Admin Center, visible in Microfinance & FD Certificate
  createdAt: number | string;
  updatedAt?: number | string;
  createdBy?: string;
}

export type LoanProductInstallment = 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';

export interface LoanProduct {
  id: string;
  name: string;
  nameNp?: string;
  interestRate: number; // Annual interest percentage e.g. 13.0
  installment: LoanProductInstallment;
  maxTenureMonths?: number;
  description?: string;
  status: 'Active' | 'Inactive';
  showInMicrofinanceAndFD?: boolean; // When checked in Admin Center, visible in Microfinance Loan
  createdAt: number | string;
  updatedAt?: number | string;
  createdBy?: string;
}



