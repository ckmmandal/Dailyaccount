import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Key, ShieldCheck, Users, Plus,
  CheckCircle2, Save, Trash2, Copy,
  X, Search, Sparkles, RefreshCw,
  Wallet, TrendingUp, TrendingDown, Megaphone,
  UserCheck, RotateCcw, AlertTriangle,
  Eye, CheckSquare, Square,
  ChevronDown, ChevronRight, LayoutDashboard,
  Building2, BookOpen, History,
  Layers, SlidersHorizontal, Calculator,
  UserPlus, Check, Bell, Coins, Receipt
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { storageService } from '../services/storageService';
import { Role, Permission, User } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

export interface SubMenuPermissionItem {
  id: string;
  name: string;
  description: string;
  viewPerm: string;
  editPerm: string;
  deletePerm: string;
  coarseView: Permission;
  coarseEdit?: Permission;
  coarseDelete?: Permission;
}

export type MenuGroupCategory = 'core' | 'modules' | 'tools_alerts' | 'admin';

export interface MainMenuGroup {
  id: string;
  name: string;
  description: string;
  category: MenuGroupCategory;
  icon: React.ElementType;
  routePath: string;
  subMenus: SubMenuPermissionItem[];
}

export const MENU_HIERARCHY: MainMenuGroup[] = [
  {
    id: 'dashboard',
    name: 'Dashboard & Analytics',
    description: 'System overview, financial indicators, and graphical business analytics',
    category: 'core',
    icon: LayoutDashboard,
    routePath: '/dashboard',
    subMenus: [
      {
        id: 'dash_overview',
        name: 'Executive Overview & Summary Cards',
        description: 'View real-time cash position, receivables, savings, loans, and branch summaries.',
        viewPerm: 'sub_dash_overview_view',
        editPerm: 'sub_dash_overview_edit',
        deletePerm: 'sub_dash_overview_delete',
        coarseView: 'view_reports',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'dash_charts',
        name: 'Financial Trends & Branch Comparison Graphs',
        description: 'Access monthly turnover charts, period inflow/outflow comparisons, and metrics.',
        viewPerm: 'sub_dash_charts_view',
        editPerm: 'sub_dash_charts_edit',
        deletePerm: 'sub_dash_charts_delete',
        coarseView: 'view_reports',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'front_teller',
    name: 'Front Teller Operations',
    description: 'Cash counter transactions, member deposits, withdrawals, and remittances',
    category: 'core',
    icon: Wallet,
    routePath: '/entry',
    subMenus: [
      {
        id: 'teller_savings',
        name: 'Member Deposit & Savings Counter',
        description: 'Process member cash deposits, periodic savings installments, and interest credits.',
        viewPerm: 'sub_teller_savings_view',
        editPerm: 'sub_teller_savings_edit',
        deletePerm: 'sub_teller_savings_delete',
        coarseView: 'view_cash_entry',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'teller_withdrawal',
        name: 'Cash Withdrawal & Payment Vouchers',
        description: 'Execute withdrawal vouchers, member payouts, and payment receipt verifications.',
        viewPerm: 'sub_teller_withdrawal_view',
        editPerm: 'sub_teller_withdrawal_edit',
        deletePerm: 'sub_teller_withdrawal_delete',
        coarseView: 'view_cash_entry',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'teller_remittance',
        name: 'Remittance Transfers & Agency Counter',
        description: 'Manage domestic and international remittance pay-ins, payouts, and commission logs.',
        viewPerm: 'sub_teller_remittance_view',
        editPerm: 'sub_teller_remittance_edit',
        deletePerm: 'sub_teller_remittance_delete',
        coarseView: 'view_cash_entry',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'teller_share_capital',
        name: 'Share Capital & Membership Fund Counter',
        description: 'Collect member share subscriptions, capital adjustments, and statutory fund entries.',
        viewPerm: 'sub_teller_share_capital_view',
        editPerm: 'sub_teller_share_capital_edit',
        deletePerm: 'sub_teller_share_capital_delete',
        coarseView: 'view_capital_entry',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'vault_settlement',
    name: 'Vault Control & Day-End Settlement',
    description: 'Main cash vault management, teller cash distribution, and physical counting audits',
    category: 'core',
    icon: Building2,
    routePath: '/settlement',
    subMenus: [
      {
        id: 'vault_monitoring',
        name: 'Vault Balance & Cash Position Terminal',
        description: 'Monitor central vault cash balance, opening reserves, and physical safety limits.',
        viewPerm: 'sub_vault_monitoring_view',
        editPerm: 'sub_vault_monitoring_edit',
        deletePerm: 'sub_vault_monitoring_delete',
        coarseView: 'view_cash_entry',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'vault_reconciliation',
        name: 'Day-End Denomination & Cash Drawer Settlement',
        description: 'Perform evening cash denomination counts, teller balancing, and cash drawer sign-offs.',
        viewPerm: 'sub_vault_reconciliation_view',
        editPerm: 'sub_vault_reconciliation_edit',
        deletePerm: 'sub_vault_reconciliation_delete',
        coarseView: 'view_cash_entry',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'vault_transfers',
        name: 'Inter-Vault & Commercial Bank Cash Transfers',
        description: 'Transfer cash between main vault, teller cash drawers, and external bank accounts.',
        viewPerm: 'sub_vault_transfers_view',
        editPerm: 'sub_vault_transfers_edit',
        deletePerm: 'sub_vault_transfers_delete',
        coarseView: 'view_cash_entry',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'teller_ledger',
    name: 'Teller Daily Ledger',
    description: 'Real-time transaction registers, teller-wise passbook records, and audit logs',
    category: 'core',
    icon: BookOpen,
    routePath: '/transaction',
    subMenus: [
      {
        id: 'daily_books',
        name: 'Teller Daily Journal & Entry Books',
        description: 'Inspect full itemized daily vouchers, cashier timestamps, and voucher verification trails.',
        viewPerm: 'sub_daily_books_view',
        editPerm: 'sub_daily_books_edit',
        deletePerm: 'sub_daily_books_delete',
        coarseView: 'view_daily_ledger',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'member_passbooks',
        name: 'Member Passbook Statement & Account Audit',
        description: 'Audit individual member ledger accounts, interest calculations, and transaction histories.',
        viewPerm: 'sub_member_passbooks_view',
        editPerm: 'sub_member_passbooks_edit',
        deletePerm: 'sub_member_passbooks_delete',
        coarseView: 'view_daily_ledger',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'back_office',
    name: 'Back Office & Financial Audit',
    description: 'Reconciliation reports, day-end balancing sheets, trial balances, and profit statements',
    category: 'core',
    icon: History,
    routePath: '/report',
    subMenus: [
      {
        id: 'daily_balancing',
        name: 'Daily Balancing & Back Office Reconciliation',
        description: 'Review end-of-day summary reports, teller variance reports, and transaction closures.',
        viewPerm: 'sub_daily_balancing_view',
        editPerm: 'sub_daily_balancing_edit',
        deletePerm: 'sub_daily_balancing_delete',
        coarseView: 'view_reports',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'trial_balance',
        name: 'Trial Balance, Balance Sheet & Profit & Loss',
        description: 'Generate institutional financial statements, balance sheets, and quarterly profitability sheets.',
        viewPerm: 'sub_trial_balance_view',
        editPerm: 'sub_trial_balance_edit',
        deletePerm: 'sub_trial_balance_delete',
        coarseView: 'view_reports',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'audit_summary',
        name: 'Comprehensive Financial Audit Records',
        description: 'Conduct supervisory audits, transaction trace inspections, and regulatory compliance checks.',
        viewPerm: 'sub_audit_summary_view',
        editPerm: 'sub_audit_summary_edit',
        deletePerm: 'sub_audit_summary_delete',
        coarseView: 'view_reports',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'income_expense',
    name: 'Income & Operational Expenses',
    description: 'Income vouchers, operational overhead entries, and commission revenues',
    category: 'core',
    icon: TrendingUp,
    routePath: '/income-expense',
    subMenus: [
      {
        id: 'office_expenses',
        name: 'Operational Expenses & Voucher Entries',
        description: 'Record and audit daily administrative outlays, utility expenses, and branch charges.',
        viewPerm: 'sub_office_expenses_view',
        editPerm: 'sub_office_expenses_edit',
        deletePerm: 'sub_office_expenses_delete',
        coarseView: 'view_income_expense',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'misc_income',
        name: 'Miscellaneous Revenues & Commission Fees',
        description: 'Manage service charges, membership fees, non-operating revenues, and interest income logs.',
        viewPerm: 'sub_misc_income_view',
        editPerm: 'sub_misc_income_edit',
        deletePerm: 'sub_misc_income_delete',
        coarseView: 'view_income_expense',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'office_expense_menu',
    name: 'Office Expenses Registry',
    description: 'Monthly office expense sheets, bills, utility units, and fixed recurring setups',
    category: 'core',
    icon: Receipt,
    routePath: '/office-expense',
    subMenus: [
      {
        id: 'office_exp_registry',
        name: 'Monthly Office Expense Sheets & Vouchers',
        description: 'Record stationery, rent, electricity units, internet, fuel bills, and export expense sheets.',
        viewPerm: 'sub_office_exp_registry_view',
        editPerm: 'sub_office_exp_registry_edit',
        deletePerm: 'sub_office_exp_registry_delete',
        coarseView: 'view_office_expenses',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'office_exp_fixed',
        name: 'Fixed & Recurring Expenses Setup',
        description: 'Configure fixed monthly expense templates and recurring branch utility schedules.',
        viewPerm: 'sub_office_exp_fixed_view',
        editPerm: 'sub_office_exp_fixed_edit',
        deletePerm: 'sub_office_exp_fixed_delete',
        coarseView: 'view_office_expenses',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'ledger_master',
    name: 'Ledger Master (Chart of Accounts)',
    description: 'Master account registry, member ledgers, vendor accounts, and financial heads',
    category: 'core',
    icon: Layers,
    routePath: '/ledger',
    subMenus: [
      {
        id: 'member_accounts',
        name: 'Member Savings & Deposit Accounts Directory',
        description: 'View, register, and modify member savings account portfolios, codes, and interest terms.',
        viewPerm: 'sub_member_accounts_view',
        editPerm: 'sub_member_accounts_edit',
        deletePerm: 'sub_member_accounts_delete',
        coarseView: 'view_ledger_names',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'loan_accounts',
        name: 'Loan Portfolios & Borrower Accounts Register',
        description: 'Maintain loan accounts, collateral records, repayment schedules, and interest rates.',
        viewPerm: 'sub_loan_accounts_view',
        editPerm: 'sub_loan_accounts_edit',
        deletePerm: 'sub_loan_accounts_delete',
        coarseView: 'view_ledger_names',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'vendor_accounts',
        name: 'Vendor, Bank & Institutional Accounts Directory',
        description: 'Manage institutional bank accounts, vendor books, supplier ledgers, and credit lines.',
        viewPerm: 'sub_vendor_accounts_view',
        editPerm: 'sub_vendor_accounts_edit',
        deletePerm: 'sub_vendor_accounts_delete',
        coarseView: 'view_ledger_names',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'notices_downloads',
    name: 'Notice Board & Resource Downloads',
    description: 'Internal circulars, downloadable resources, and login popup notices',
    category: 'modules',
    icon: Megaphone,
    routePath: '/notice-download',
    subMenus: [
      {
        id: 'internal_notices',
        name: 'Notices & Bulletins',
        description: 'Publish and distribute urgent staff announcements, board notices, and branch circulars.',
        viewPerm: 'sub_internal_notices_view',
        editPerm: 'sub_internal_notices_edit',
        deletePerm: 'sub_internal_notices_delete',
        coarseView: 'manage_notices',
        coarseEdit: 'manage_notices',
        coarseDelete: 'manage_notices'
      },
      {
        id: 'resource_downloads',
        name: 'Downloads & Resource Files',
        description: 'Upload, manage, and download membership forms, loan application kits, and policy PDF guides.',
        viewPerm: 'sub_resource_downloads_view',
        editPerm: 'sub_resource_downloads_edit',
        deletePerm: 'sub_resource_downloads_delete',
        coarseView: 'manage_notices',
        coarseEdit: 'manage_notices',
        coarseDelete: 'manage_notices'
      },
      {
        id: 'popup_notices',
        name: 'Login Popup Notices & Alerts',
        description: 'Configure priority login modal announcements, target branches, and validity dates.',
        viewPerm: 'sub_popup_notices_view',
        editPerm: 'sub_popup_notices_edit',
        deletePerm: 'sub_popup_notices_delete',
        coarseView: 'manage_notices',
        coarseEdit: 'manage_notices',
        coarseDelete: 'manage_notices'
      }
    ]
  },
  {
    id: 'hr_management',
    name: 'Human Resources & Payroll (HR)',
    description: 'HR dashboard, employees, attendance, leave approvals, payroll, board & complaints',
    category: 'modules',
    icon: Users,
    routePath: '/hr',
    subMenus: [
      {
        id: 'hr_dashboard',
        name: 'HR Overview Dashboard & Analytics',
        description: 'View staff headcount, attendance summaries, leave stats, and departmental distributions.',
        viewPerm: 'sub_hr_dashboard_view',
        editPerm: 'sub_hr_dashboard_edit',
        deletePerm: 'sub_hr_dashboard_delete',
        coarseView: 'manage_hr',
        coarseEdit: 'manage_hr',
        coarseDelete: 'manage_hr'
      },
      {
        id: 'hr_employees',
        name: 'Employee Registry, KYC & Service Records',
        description: 'Maintain staff profiles, citizenship KYC, appointment agreements, and personnel files.',
        viewPerm: 'sub_hr_employees_view',
        editPerm: 'sub_hr_employees_edit',
        deletePerm: 'sub_hr_employees_delete',
        coarseView: 'manage_hr',
        coarseEdit: 'manage_hr',
        coarseDelete: 'manage_hr'
      },
      {
        id: 'hr_attendance',
        name: 'Daily Attendance Register & Biometric Logs',
        description: 'Track daily staff clock-ins, biometric device punches, late arrivals, and official duties.',
        viewPerm: 'sub_hr_attendance_view',
        editPerm: 'sub_hr_attendance_edit',
        deletePerm: 'sub_hr_attendance_delete',
        coarseView: 'manage_attendance',
        coarseEdit: 'manage_attendance',
        coarseDelete: 'manage_attendance'
      },
      {
        id: 'hr_leaves',
        name: 'Leave Applications & Approval Workflow',
        description: 'Review staff leave requests, approve annual/sick/emergency quotas, and audit leave balances.',
        viewPerm: 'sub_hr_leaves_view',
        editPerm: 'sub_hr_leaves_edit',
        deletePerm: 'sub_hr_leaves_delete',
        coarseView: 'manage_leaves',
        coarseEdit: 'manage_leaves',
        coarseDelete: 'manage_leaves'
      },
      {
        id: 'hr_payroll',
        name: 'Monthly Payroll Generation & Salary Slips',
        description: 'Calculate monthly payroll, grade increments, SSF/tax deductions, pay slips, and email delivery.',
        viewPerm: 'sub_hr_payroll_view',
        editPerm: 'sub_hr_payroll_edit',
        deletePerm: 'sub_hr_payroll_delete',
        coarseView: 'manage_payroll',
        coarseEdit: 'manage_payroll',
        coarseDelete: 'manage_payroll'
      },
      {
        id: 'hr_documents',
        name: 'Official HR Letters & Experience Certificates',
        description: 'Generate appointment letters, experience certificates, promotion memos, and official PDF documents.',
        viewPerm: 'sub_hr_documents_view',
        editPerm: 'sub_hr_documents_edit',
        deletePerm: 'sub_hr_documents_delete',
        coarseView: 'manage_hr',
        coarseEdit: 'manage_hr',
        coarseDelete: 'manage_hr'
      },
      {
        id: 'hr_grievances',
        name: 'Staff Grievance & Complaints Box',
        description: 'Confidential channel for employee feedback, workplace suggestions, and formal complaints.',
        viewPerm: 'sub_hr_grievances_view',
        editPerm: 'sub_hr_grievances_edit',
        deletePerm: 'sub_hr_grievances_delete',
        coarseView: 'manage_hr',
        coarseEdit: 'manage_hr',
        coarseDelete: 'manage_hr'
      },
      {
        id: 'hr_board',
        name: 'Board of Directors & Governance (BOD)',
        description: 'Committee categories, director KYC profiles, tenure tracking, and monthly allowances with TDS.',
        viewPerm: 'sub_hr_board_view',
        editPerm: 'sub_hr_board_edit',
        deletePerm: 'sub_hr_board_delete',
        coarseView: 'manage_hr',
        coarseEdit: 'manage_hr',
        coarseDelete: 'manage_hr'
      }
    ]
  },
  {
    id: 'insurance',
    name: 'Insurance Management (Bima)',
    description: 'Loan & life insurance dashboard, policy upload, reports, claims, and maturity alerts',
    category: 'modules',
    icon: ShieldCheck,
    routePath: '/insurance',
    subMenus: [
      {
        id: 'ins_dashboard',
        name: 'Insurance Dashboard & Portfolio Summary',
        description: 'Monitor active insurance policies, insured volume, premiums, and insurer summaries.',
        viewPerm: 'sub_ins_dashboard_view',
        editPerm: 'sub_ins_dashboard_edit',
        deletePerm: 'sub_ins_dashboard_delete',
        coarseView: 'view_insurance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'ins_upload',
        name: 'Upload Policy, Manual Entry & Partner Setup',
        description: 'Create or import policies via Excel/OCR, manage partner insurers, and issue certificates.',
        viewPerm: 'sub_ins_upload_view',
        editPerm: 'sub_ins_upload_edit',
        deletePerm: 'sub_ins_upload_delete',
        coarseView: 'view_insurance',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'ins_report',
        name: 'Insurance Reports, Renewals, Claims & Statements',
        description: 'Filter active/expired/closed policies, process claims, record premiums, and export reports.',
        viewPerm: 'sub_ins_report_view',
        editPerm: 'sub_ins_report_edit',
        deletePerm: 'sub_ins_report_delete',
        coarseView: 'view_insurance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'ins_alerts',
        name: 'Policy Maturity & Renewal Alerts Tab',
        description: 'Track upcoming today, tomorrow, weekly, and monthly policy maturities and renewals.',
        viewPerm: 'sub_ins_alerts_view',
        editPerm: 'sub_ins_alerts_edit',
        deletePerm: 'sub_ins_alerts_delete',
        coarseView: 'view_insurance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'micro_finance',
    name: 'Micro-Finance Operations',
    description: 'Centers, Samuh groups, active/inactive members, active/closed savings, loans, collection & signature sheets, meeting minutes, and QR ID cards',
    category: 'modules',
    icon: Coins,
    routePath: '/micro-finance',
    subMenus: [
      {
        id: 'mf_dashboard',
        name: 'Micro-Finance Dashboard & Analytics',
        description: 'View centers, groups, active members, savings vs loan disbursement metrics, and charts.',
        viewPerm: 'sub_mf_dashboard_view',
        editPerm: 'sub_mf_dashboard_edit',
        deletePerm: 'sub_mf_dashboard_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_centers',
        name: 'Centers Management & Meeting Day Order',
        description: 'Create, edit, and delete field centers ordered by meeting day, center codes, and assigned field officers.',
        viewPerm: 'sub_mf_centers_view',
        editPerm: 'sub_mf_centers_edit',
        deletePerm: 'sub_mf_centers_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_groups',
        name: 'Groups (Samuh) Management',
        description: 'Manage Samuh groups linked under centers (ordered by center meeting day), group leaders, bulk upload, and deletion.',
        viewPerm: 'sub_mf_groups_view',
        editPerm: 'sub_mf_groups_edit',
        deletePerm: 'sub_mf_groups_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_members',
        name: 'Members Registry (Active / Inactive & Bulk Export)',
        description: 'Enroll members with center-filtered groups, view/edit/deactivate/activate (Active & Inactive lists), bulk Excel upload, Excel download, and delete.',
        viewPerm: 'sub_mf_members_view',
        editPerm: 'sub_mf_members_edit',
        deletePerm: 'sub_mf_members_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_saving',
        name: 'Savings Management (Active / Close & Bulk Export)',
        description: 'Open saving accounts, view/edit/deactivate/activate (Active & Close lists), bulk Excel upload, Excel download, and delete.',
        viewPerm: 'sub_mf_saving_view',
        editPerm: 'sub_mf_saving_edit',
        deletePerm: 'sub_mf_saving_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_loan',
        name: 'Loans Portfolio (Active / Mature / Close & Bulk Export)',
        description: 'Disburse member loans, track Active/Mature/Close tabs & kista schedules, bulk Excel upload, Excel download, and delete.',
        viewPerm: 'sub_mf_loan_view',
        editPerm: 'sub_mf_loan_edit',
        deletePerm: 'sub_mf_loan_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_reports',
        name: 'Reports: Collection Sheets',
        description: 'Generate monthly center & group collection sheets, print collection schedules, and export Excel reports.',
        viewPerm: 'sub_mf_reports_view',
        editPerm: 'sub_mf_reports_edit',
        deletePerm: 'sub_mf_reports_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_signature_sheet',
        name: 'Reports: Member Signature Sheets',
        description: 'Generate, view, print, and delete monthly Samuh member attendance and signature sheets.',
        viewPerm: 'sub_mf_signature_sheet_view',
        editPerm: 'sub_mf_signature_sheet_edit',
        deletePerm: 'sub_mf_signature_sheet_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_deposit_sheet',
        name: 'Reports: Deposit Sheets',
        description: 'Enter, save, view, print, and delete monthly Samuh member saving & loan deposit sheets.',
        viewPerm: 'sub_mf_deposit_sheet_view',
        editPerm: 'sub_mf_deposit_sheet_edit',
        deletePerm: 'sub_mf_deposit_sheet_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_meeting_minutes',
        name: 'Reports: Group Meeting Minutes',
        description: 'Record, edit, view, print, and delete official monthly Samuh group meeting minutes.',
        viewPerm: 'sub_mf_meeting_minutes_view',
        editPerm: 'sub_mf_meeting_minutes_edit',
        deletePerm: 'sub_mf_meeting_minutes_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'mf_id_card',
        name: 'Reports: Member ID Card Generator (Single & Bulk QR)',
        description: 'Create and print single or bulk CR80 member ID cards across 6 formats with signatory upload and full-detail QR codes.',
        viewPerm: 'sub_mf_id_card_view',
        editPerm: 'sub_mf_id_card_edit',
        deletePerm: 'sub_mf_id_card_delete',
        coarseView: 'view_microfinance',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'depreciation',
    name: 'Fixed Assets & Depreciation',
    description: 'Asset register, SLM/WDV depreciation calculation, journal vouchers, reports, and settings',
    category: 'modules',
    icon: TrendingDown,
    routePath: '/depreciation',
    subMenus: [
      {
        id: 'dep_dashboard',
        name: 'Depreciation Dashboard & Charts',
        description: 'View fixed asset KPIs, accumulated depreciation, net book value, and category/branch charts.',
        viewPerm: 'sub_dep_dashboard_view',
        editPerm: 'sub_dep_dashboard_edit',
        deletePerm: 'sub_dep_dashboard_delete',
        coarseView: 'view_depreciation',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'dep_assets',
        name: 'Asset Management (Register, Purchase, Transfer, Disposal)',
        description: 'Register purchases, upload asset documents, transfer between branches, and record disposals/sales.',
        viewPerm: 'sub_dep_assets_view',
        editPerm: 'sub_dep_assets_edit',
        deletePerm: 'sub_dep_assets_delete',
        coarseView: 'view_depreciation',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'dep_calculate',
        name: 'Depreciation Calculation, Schedule & FY Records',
        description: 'Calculate monthly/yearly SLM & WDV depreciation, inspect schedules, and compare accounting vs tax.',
        viewPerm: 'sub_dep_calculate_view',
        editPerm: 'sub_dep_calculate_edit',
        deletePerm: 'sub_dep_calculate_delete',
        coarseView: 'view_depreciation',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'dep_accounting',
        name: 'Accounting, Automatic Journal Vouchers & GL Integration',
        description: 'View and post automatic depreciation vouchers, debit/credit records, and GL mappings.',
        viewPerm: 'sub_dep_accounting_view',
        editPerm: 'sub_dep_accounting_edit',
        deletePerm: 'sub_dep_accounting_delete',
        coarseView: 'view_depreciation',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'dep_reports',
        name: 'Fixed Asset, Depreciation & Tax Reports (PDF / Excel)',
        description: 'Generate register, annual depreciation, net book value, branch-wise, disposal, and tax reports.',
        viewPerm: 'sub_dep_reports_view',
        editPerm: 'sub_dep_reports_edit',
        deletePerm: 'sub_dep_reports_delete',
        coarseView: 'view_depreciation',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'dep_settings',
        name: 'Depreciation Settings, Categories, Rates & FY Management',
        description: 'Configure asset categories, SLM/WDV rates, useful life, salvage percentage, and financial years.',
        viewPerm: 'sub_dep_settings_view',
        editPerm: 'sub_dep_settings_edit',
        deletePerm: 'sub_dep_settings_delete',
        coarseView: 'view_depreciation',
        coarseEdit: 'manage_settings',
        coarseDelete: 'manage_settings'
      }
    ]
  },
  {
    id: 'alerts_center',
    name: 'Header Alerts (1-Day Notifications)',
    description: 'Top header Alerts bell button & 1-day dropdown (Bima Maturity, Loan Maturity, Notice)',
    category: 'tools_alerts',
    icon: Bell,
    routePath: '/alerts',
    subMenus: [
      {
        id: 'alert_bima_maturity',
        name: 'Bima Maturity Alert (1-Day Count & Jump)',
        description: 'View daily insurance policy maturity alert count in header Alerts and jump to Insurance Alerts.',
        viewPerm: 'sub_alert_bima_maturity_view',
        editPerm: 'sub_alert_bima_maturity_edit',
        deletePerm: 'sub_alert_bima_maturity_delete',
        coarseView: 'view_alerts',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'alert_loan_maturity',
        name: 'Loan Maturity Alert (1-Day Count & Jump)',
        description: 'View daily loan maturity alert count in header Alerts and jump to Micro-Finance Loan ledger.',
        viewPerm: 'sub_alert_loan_maturity_view',
        editPerm: 'sub_alert_loan_maturity_edit',
        deletePerm: 'sub_alert_loan_maturity_delete',
        coarseView: 'view_alerts',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'alert_saving_maturity',
        name: 'Saving Maturity Alert (Count & Jump)',
        description: 'View matured Micro-Finance saving account count in header Alerts and jump to Mature Savings list.',
        viewPerm: 'sub_alert_saving_maturity_view',
        editPerm: 'sub_alert_saving_maturity_edit',
        deletePerm: 'sub_alert_saving_maturity_delete',
        coarseView: 'view_alerts',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'alert_notice',
        name: 'Notice Alert (1-Day Count & Jump)',
        description: 'View today active notices count in header Alerts and jump to Notice Board.',
        viewPerm: 'sub_alert_notice_view',
        editPerm: 'sub_alert_notice_edit',
        deletePerm: 'sub_alert_notice_delete',
        coarseView: 'view_alerts',
        coarseEdit: 'manage_notices',
        coarseDelete: 'manage_notices'
      }
    ]
  },
  {
    id: 'shortcuts_tools',
    name: 'Header Shortcuts & Quick Tools',
    description: 'All top-header Shortcuts dropdown items: Remit, Messages, Calculator, FD Certificate, EMI & Date Converter',
    category: 'tools_alerts',
    icon: Calculator,
    routePath: '/shortcuts',
    subMenus: [
      {
        id: 'tool_remit',
        name: 'Remit Portal Shortcut',
        description: 'Access remittance partner portals, agent credentials, and agency quick-login tools.',
        viewPerm: 'sub_tool_remit_view',
        editPerm: 'sub_tool_remit_edit',
        deletePerm: 'sub_tool_remit_delete',
        coarseView: 'view_shortcuts',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'tool_messages',
        name: 'Messages (Staff Internal Chat)',
        description: 'Open staff communicator drawer, send direct/branch messages, and manage chat threads.',
        viewPerm: 'sub_tool_messages_view',
        editPerm: 'sub_tool_messages_edit',
        deletePerm: 'sub_tool_messages_delete',
        coarseView: 'view_shortcuts',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'tool_calculator',
        name: 'Financial Calculator Page',
        description: 'Use interest, recurring deposit, denomination, and daily utility financial calculators.',
        viewPerm: 'sub_tool_calculator_view',
        editPerm: 'sub_tool_calculator_edit',
        deletePerm: 'sub_tool_calculator_delete',
        coarseView: 'view_shortcuts',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'tool_fd_cert',
        name: 'Fixed Deposit (FD) Certificate Generator',
        description: 'Issue official fixed deposit certificates, maturity date projections, and verification numbers.',
        viewPerm: 'sub_tool_fd_cert_view',
        editPerm: 'sub_tool_fd_cert_edit',
        deletePerm: 'sub_tool_fd_cert_delete',
        coarseView: 'view_shortcuts',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'tool_emi',
        name: 'EMI Loan Amortization Calculator',
        description: 'Interactive loan EMI & schedule calculator for member loan inquiries and rate comparisons.',
        viewPerm: 'sub_tool_emi_view',
        editPerm: 'sub_tool_emi_edit',
        deletePerm: 'sub_tool_emi_delete',
        coarseView: 'view_shortcuts',
        coarseEdit: 'add_transaction',
        coarseDelete: 'delete_transaction'
      },
      {
        id: 'tool_date_converter',
        name: 'BS / AD Nepali Date Converter',
        description: 'Convert Bikram Sambat (BS) and Gregorian (AD) dates cleanly from anywhere in the app.',
        viewPerm: 'sub_tool_date_converter_view',
        editPerm: 'sub_tool_date_converter_edit',
        deletePerm: 'sub_tool_date_converter_delete',
        coarseView: 'view_shortcuts',
        coarseEdit: 'edit_transaction',
        coarseDelete: 'delete_transaction'
      }
    ]
  },
  {
    id: 'admin_center',
    name: 'Administration Center & Security',
    description: 'System configurations, user authentication, multi-branch control, backups, and resets',
    category: 'admin',
    icon: ShieldCheck,
    routePath: '/admin',
    subMenus: [
      {
        id: 'admin_branches',
        name: 'Branch Offices Setup & Network Control',
        description: 'Register branch units, configure branch codes, operational locations, and active states.',
        viewPerm: 'sub_admin_branches_view',
        editPerm: 'sub_admin_branches_edit',
        deletePerm: 'sub_admin_branches_delete',
        coarseView: 'cross_branch_operation',
        coarseEdit: 'manage_branches',
        coarseDelete: 'manage_branches'
      },
      {
        id: 'admin_products',
        name: 'Saving & Loan Product Scheme Configurations',
        description: 'Configure interest rates, capitalization cycles, installment frequencies, and product rules.',
        viewPerm: 'sub_admin_products_view',
        editPerm: 'sub_admin_products_edit',
        deletePerm: 'sub_admin_products_delete',
        coarseView: 'manage_users',
        coarseEdit: 'manage_users',
        coarseDelete: 'manage_users'
      },
      {
        id: 'admin_holiday',
        name: 'Holiday & Calendar Management',
        description: 'Configure public holidays, weekend days, and branch operational calendar locks.',
        viewPerm: 'sub_admin_holiday_view',
        editPerm: 'sub_admin_holiday_edit',
        deletePerm: 'sub_admin_holiday_delete',
        coarseView: 'manage_settings',
        coarseEdit: 'manage_settings',
        coarseDelete: 'manage_settings'
      },
      {
        id: 'admin_users',
        name: 'User Accounts, Credentials & Security Policies',
        description: 'Create staff user logins, assign roles, reset passwords, and enforce security policies.',
        viewPerm: 'sub_admin_users_view',
        editPerm: 'sub_admin_users_edit',
        deletePerm: 'sub_admin_users_delete',
        coarseView: 'manage_users',
        coarseEdit: 'manage_users',
        coarseDelete: 'manage_users'
      },
      {
        id: 'admin_roles',
        name: 'Role & Permission Access Matrix Studio',
        description: 'Design custom roles, configure View/Edit/Delete access flags, and assign permissions.',
        viewPerm: 'sub_admin_roles_view',
        editPerm: 'sub_admin_roles_edit',
        deletePerm: 'sub_admin_roles_delete',
        coarseView: 'manage_users',
        coarseEdit: 'manage_users',
        coarseDelete: 'manage_users'
      },
      {
        id: 'admin_intelligence',
        name: 'Consolidated Multi-Branch Financial Intelligence',
        description: 'Institutional reporting, central consolidation balance sheets, and inter-branch performance.',
        viewPerm: 'sub_admin_intelligence_view',
        editPerm: 'sub_admin_intelligence_edit',
        deletePerm: 'sub_admin_intelligence_delete',
        coarseView: 'view_consolidated_report',
        coarseEdit: 'cross_branch_operation',
        coarseDelete: 'cross_branch_operation'
      },
      {
        id: 'admin_settings',
        name: 'System Parameters, Institutional Branding & SMTP',
        description: 'Configure institutional name, branding logos, currency, email notifications, and auto-lock timers.',
        viewPerm: 'sub_admin_settings_view',
        editPerm: 'sub_admin_settings_edit',
        deletePerm: 'sub_admin_settings_delete',
        coarseView: 'manage_settings',
        coarseEdit: 'manage_settings',
        coarseDelete: 'manage_settings'
      },
      {
        id: 'admin_backup',
        name: 'Database Master Backup & Disaster Recovery',
        description: 'Export complete JSON/Cloud database snapshots and execute system restoration procedures.',
        viewPerm: 'sub_admin_backup_view',
        editPerm: 'sub_admin_backup_edit',
        deletePerm: 'sub_admin_backup_delete',
        coarseView: 'manage_backup',
        coarseEdit: 'manage_backup',
        coarseDelete: 'manage_backup'
      },
      {
        id: 'admin_reset',
        name: 'Software Data Wipe & System Factory Reset',
        description: 'High-risk daily transaction reset, module purging, and master database initialization.',
        viewPerm: 'sub_admin_reset_view',
        editPerm: 'sub_admin_reset_edit',
        deletePerm: 'sub_admin_reset_delete',
        coarseView: 'system_reset',
        coarseEdit: 'system_reset',
        coarseDelete: 'system_reset'
      },
      {
        id: 'admin_logs',
        name: 'Security Audit Trails & Historical Access Logs',
        description: 'Review timestamped system actions, login sessions, transaction updates, and security events.',
        viewPerm: 'sub_admin_logs_view',
        editPerm: 'sub_admin_logs_edit',
        deletePerm: 'sub_admin_logs_delete',
        coarseView: 'view_reports',
        coarseEdit: 'view_reports',
        coarseDelete: 'delete_transaction'
      }
    ]
  }
];

// Helper to expand legacy or coarse permissions into granular sub-menu keys
export const expandRolePermissions = (perms: Permission[]): string[] => {
  const currentSet = new Set<string>(perms || []);
  const hasGranular = perms?.some(p => typeof p === 'string' && p.startsWith('sub_'));

  if (!hasGranular) {
    MENU_HIERARCHY.forEach(group => {
      group.subMenus.forEach(sub => {
        if (currentSet.has(sub.coarseView)) {
          currentSet.add(sub.viewPerm);
        }
        if (sub.editPerm && sub.coarseEdit && currentSet.has(sub.coarseEdit)) {
          currentSet.add(sub.editPerm);
        }
        if (sub.deletePerm && sub.coarseDelete && currentSet.has(sub.coarseDelete)) {
          currentSet.add(sub.deletePerm);
        }
      });
    });
  }

  return Array.from(currentSet);
};

// Helper to compute both granular keys and coarse parent permissions upon save
export const computeFullPermissions = (granularPerms: string[]): Permission[] => {
  const permSet = new Set<string>(granularPerms);

  MENU_HIERARCHY.forEach(group => {
    group.subMenus.forEach(sub => {
      if (permSet.has(sub.viewPerm)) {
        permSet.add(sub.coarseView);
      }
      if (sub.editPerm && permSet.has(sub.editPerm) && sub.coarseEdit) {
        permSet.add(sub.coarseEdit);
      }
      if (sub.deletePerm && permSet.has(sub.deletePerm) && sub.coarseDelete) {
        permSet.add(sub.coarseDelete);
      }
    });
  });

  return Array.from(permSet);
};

const CATEGORY_TABS: Array<{ id: 'all' | MenuGroupCategory; label: string }> = [
  { id: 'all', label: 'All Menus' },
  { id: 'core', label: 'Core Banking' },
  { id: 'modules', label: 'Modules' },
  { id: 'tools_alerts', label: 'Shortcuts & Alerts' },
  { id: 'admin', label: 'Admin Center' }
];

export const RolePermissionManagement: React.FC = () => {
  const { refreshRoles } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const isDayEnded = useDayEndLock();
  const [loading, setLoading] = useState(true);

  // Selected Role & Working Copy
  const [selectedRoleId, setSelectedRoleId] = useState<string>('1');
  const [workingRole, setWorkingRole] = useState<Role | null>(null);
  const [originalPermissions, setOriginalPermissions] = useState<Permission[]>([]);

  // Expanded Main Menus State: default all expanded
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    MENU_HIERARCHY.forEach(m => { initial[m.id] = true; });
    return initial;
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MenuGroupCategory>('all');
  const [roleSearch, setRoleSearch] = useState('');

  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleTemplate, setNewRoleTemplate] = useState<string>('teller');

  // Staff Assignment Modal
  const [showAssignStaffModal, setShowAssignStaffModal] = useState(false);
  const [staffModalSearch, setStaffModalSearch] = useState('');
  const [savingStaffAssignment, setSavingStaffAssignment] = useState(false);

  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ isOpen: boolean; roleId: string; roleName: string }>({
    isOpen: false,
    roleId: '',
    roleName: ''
  });

  const showNotice = useCallback((type: 'success' | 'error', text: string) => {
    setFeedbackBanner({ type, text });
    setTimeout(() => {
      setFeedbackBanner(prev => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  // Load roles and users
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [r, u] = await Promise.all([
        storageService.getRoles(),
        storageService.getUsers()
      ]);
      setRoles(r);
      setUsers(u);

      const targetId = selectedRoleId || '1';
      const initialRole = r.find(item => item.id === targetId) || r[0];
      if (initialRole) {
        setSelectedRoleId(initialRole.id);
        const expandedPerms = expandRolePermissions(initialRole.permissions);
        setWorkingRole({
          ...initialRole,
          permissions: expandedPerms
        });
        setOriginalPermissions(expandedPerms);
      }
    } catch (err) {
      console.error("Failed to load roles/users:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // When selected role changes, update working copy
  const handleSelectRole = (roleId: string) => {
    const target = roles.find(r => r.id === roleId);
    if (!target) return;
    setSelectedRoleId(roleId);
    const expandedPerms = expandRolePermissions(target.permissions);
    setWorkingRole({
      ...target,
      permissions: expandedPerms
    });
    setOriginalPermissions(expandedPerms);
    setFeedbackBanner(null);
  };

  // Check if current role has unsaved changes
  const isDirty = useMemo(() => {
    if (!workingRole) return false;
    const currentPerms = new Set(workingRole.permissions);
    const origPerms = new Set(originalPermissions);
    if (currentPerms.size !== origPerms.size) return true;
    for (const p of currentPerms) {
      if (!origPerms.has(p)) return true;
    }
    const originalRole = roles.find(r => r.id === workingRole.id);
    if (originalRole && originalRole.name !== workingRole.name) return true;
    return false;
  }, [workingRole, originalPermissions, roles]);

  const toggleMenuExpand = (menuId: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const handleExpandAll = () => {
    const all: Record<string, boolean> = {};
    MENU_HIERARCHY.forEach(m => { all[m.id] = true; });
    setExpandedMenus(all);
  };

  const handleCollapseAll = () => {
    const none: Record<string, boolean> = {};
    MENU_HIERARCHY.forEach(m => { none[m.id] = false; });
    setExpandedMenus(none);
  };

  const handleToggleSinglePermission = (permKey: string) => {
    if (!workingRole) return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    if (workingRole.id === '1') {
      showNotice('error', "Super Admin permissions are permanently unrestricted and cannot be modified.");
      return;
    }
    const current = new Set(workingRole.permissions);
    if (current.has(permKey)) {
      current.delete(permKey);
    } else {
      current.add(permKey);
    }
    setWorkingRole({
      ...workingRole,
      permissions: Array.from(current)
    });
  };

  // Toggle all View / Edit / Delete permissions for a single Main Menu group
  const handleToggleMainMenu = (menuGroup: MainMenuGroup) => {
    if (!workingRole || workingRole.id === '1') return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    const allKeysInMenu: string[] = [];
    menuGroup.subMenus.forEach(sub => {
      allKeysInMenu.push(sub.viewPerm, sub.editPerm, sub.deletePerm);
    });

    const current = new Set(workingRole.permissions);
    const allActive = allKeysInMenu.every(k => current.has(k));

    if (allActive) {
      allKeysInMenu.forEach(k => current.delete(k));
    } else {
      allKeysInMenu.forEach(k => current.add(k));
    }

    setWorkingRole({
      ...workingRole,
      permissions: Array.from(current)
    });
  };

  // Toggle a single column (view | edit | delete) within a Main Menu group
  const handleToggleMenuColumn = (menuGroup: MainMenuGroup, col: 'view' | 'edit' | 'delete') => {
    if (!workingRole || workingRole.id === '1') return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    const colKeys = menuGroup.subMenus.map(sub =>
      col === 'view' ? sub.viewPerm : col === 'edit' ? sub.editPerm : sub.deletePerm
    );
    const current = new Set(workingRole.permissions);
    const allActive = colKeys.every(k => current.has(k));

    if (allActive) {
      colKeys.forEach(k => current.delete(k));
    } else {
      colKeys.forEach(k => current.add(k));
    }

    setWorkingRole({
      ...workingRole,
      permissions: Array.from(current)
    });
  };

  // Toggle all 3 (View + Edit + Delete) on a single sub-menu row
  const handleToggleSubMenuRow = (sub: SubMenuPermissionItem) => {
    if (!workingRole || workingRole.id === '1') return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    const rowKeys = [sub.viewPerm, sub.editPerm, sub.deletePerm];
    const current = new Set(workingRole.permissions);
    const allActive = rowKeys.every(k => current.has(k));
    if (allActive) {
      rowKeys.forEach(k => current.delete(k));
    } else {
      rowKeys.forEach(k => current.add(k));
    }
    setWorkingRole({
      ...workingRole,
      permissions: Array.from(current)
    });
  };

  const handleGrantAll = () => {
    if (!workingRole || workingRole.id === '1') return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    const allKeys: string[] = [];
    MENU_HIERARCHY.forEach(m => {
      m.subMenus.forEach(s => {
        allKeys.push(s.viewPerm, s.editPerm, s.deletePerm);
      });
    });
    setWorkingRole({
      ...workingRole,
      permissions: Array.from(new Set(allKeys))
    });
  };

  const handleGrantOperational = () => {
    if (!workingRole || workingRole.id === '1') return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    const opsKeys: string[] = [];
    MENU_HIERARCHY.forEach(m => {
      m.subMenus.forEach(s => {
        opsKeys.push(s.viewPerm, s.editPerm);
      });
    });
    setWorkingRole({
      ...workingRole,
      permissions: Array.from(new Set(opsKeys))
    });
  };

  const handleGrantReadOnly = () => {
    if (!workingRole || workingRole.id === '1') return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    const views: string[] = [];
    MENU_HIERARCHY.forEach(m => {
      m.subMenus.forEach(s => {
        views.push(s.viewPerm);
      });
    });
    setWorkingRole({
      ...workingRole,
      permissions: Array.from(new Set(views))
    });
  };

  const handleClearAll = () => {
    if (!workingRole || workingRole.id === '1') return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    setWorkingRole({
      ...workingRole,
      permissions: []
    });
  };

  const handleResetToOriginal = () => {
    if (!workingRole) return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    setWorkingRole({
      ...workingRole,
      permissions: [...originalPermissions]
    });
  };

  const handleSaveRole = async () => {
    if (!workingRole) return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    if (!workingRole.name.trim()) {
      showNotice('error', "Please enter a valid Role Name.");
      return;
    }

    try {
      setIsSaving(true);
      const fullPerms = computeFullPermissions(workingRole.permissions);
      const roleToSave: Role = {
        ...workingRole,
        permissions: fullPerms
      };

      await storageService.saveRole(roleToSave);

      const updatedRoles = roles.map(r => r.id === roleToSave.id ? roleToSave : r);
      setRoles(updatedRoles);
      setOriginalPermissions([...workingRole.permissions]);

      await refreshRoles();
      window.dispatchEvent(new Event('userPermissionsUpdated'));

      showNotice('success', `Role '${roleToSave.name}' permissions saved & synced!`);
    } catch (err) {
      console.error("Failed to save role:", err);
      showNotice('error', "Failed to save role. Please check connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    const trimmed = newRoleName.trim();
    if (!trimmed) {
      showNotice('error', "Please specify a name for the new role.");
      return;
    }

    let templateKeys: string[] = [];
    if (newRoleTemplate === 'admin') {
      const all: string[] = [];
      MENU_HIERARCHY.forEach(m => m.subMenus.forEach(s => {
        all.push(s.viewPerm, s.editPerm, s.deletePerm);
      }));
      templateKeys = all;
    } else if (newRoleTemplate === 'manager') {
      templateKeys = [
        'sub_dash_overview_view', 'sub_dash_charts_view',
        'sub_teller_savings_view', 'sub_teller_savings_edit',
        'sub_teller_withdrawal_view', 'sub_teller_withdrawal_edit',
        'sub_teller_remittance_view', 'sub_teller_remittance_edit',
        'sub_vault_monitoring_view', 'sub_vault_reconciliation_view',
        'sub_daily_books_view', 'sub_member_passbooks_view',
        'sub_daily_balancing_view', 'sub_trial_balance_view',
        'sub_office_expenses_view', 'sub_office_expenses_edit',
        'sub_office_exp_registry_view', 'sub_office_exp_registry_edit',
        'sub_member_accounts_view', 'sub_loan_accounts_view',
        'sub_internal_notices_view', 'sub_internal_notices_edit',
        'sub_hr_dashboard_view', 'sub_hr_employees_view', 'sub_hr_attendance_view',
        'sub_hr_leaves_view', 'sub_hr_payroll_view',
        'sub_ins_dashboard_view', 'sub_ins_report_view', 'sub_ins_alerts_view',
        'sub_mf_dashboard_view', 'sub_mf_centers_view', 'sub_mf_groups_view', 'sub_mf_members_view', 'sub_mf_saving_view', 'sub_mf_loan_view',
        'sub_mf_reports_view', 'sub_mf_signature_sheet_view', 'sub_mf_deposit_sheet_view', 'sub_mf_meeting_minutes_view', 'sub_mf_id_card_view',
        'sub_dep_dashboard_view', 'sub_dep_assets_view', 'sub_dep_reports_view',
        'sub_alert_bima_maturity_view', 'sub_alert_loan_maturity_view', 'sub_alert_saving_maturity_view', 'sub_alert_notice_view',
        'sub_tool_remit_view', 'sub_tool_messages_view', 'sub_tool_calculator_view', 'sub_tool_fd_cert_view', 'sub_tool_emi_view', 'sub_tool_date_converter_view'
      ];
    } else if (newRoleTemplate === 'teller') {
      templateKeys = [
        'sub_teller_savings_view', 'sub_teller_savings_edit',
        'sub_teller_withdrawal_view', 'sub_teller_withdrawal_edit',
        'sub_teller_remittance_view', 'sub_teller_remittance_edit',
        'sub_daily_books_view', 'sub_member_passbooks_view',
        'sub_member_accounts_view',
        'sub_internal_notices_view', 'sub_resource_downloads_view',
        'sub_alert_bima_maturity_view', 'sub_alert_loan_maturity_view', 'sub_alert_saving_maturity_view', 'sub_alert_notice_view',
        'sub_tool_remit_view', 'sub_tool_messages_view', 'sub_tool_calculator_view', 'sub_tool_fd_cert_view', 'sub_tool_emi_view', 'sub_tool_date_converter_view'
      ];
    } else if (newRoleTemplate === 'hr') {
      templateKeys = [
        'sub_hr_dashboard_view',
        'sub_hr_employees_view', 'sub_hr_employees_edit',
        'sub_hr_attendance_view', 'sub_hr_attendance_edit',
        'sub_hr_leaves_view', 'sub_hr_leaves_edit',
        'sub_hr_payroll_view', 'sub_hr_payroll_edit',
        'sub_hr_documents_view', 'sub_hr_documents_edit',
        'sub_hr_grievances_view', 'sub_hr_board_view',
        'sub_internal_notices_view', 'sub_alert_notice_view',
        'sub_tool_messages_view', 'sub_tool_date_converter_view'
      ];
    } else if (newRoleTemplate === 'auditor') {
      templateKeys = [
        'sub_dash_overview_view', 'sub_dash_charts_view',
        'sub_daily_books_view', 'sub_member_passbooks_view',
        'sub_daily_balancing_view', 'sub_trial_balance_view', 'sub_audit_summary_view',
        'sub_office_expenses_view', 'sub_office_exp_registry_view',
        'sub_member_accounts_view', 'sub_loan_accounts_view',
        'sub_ins_dashboard_view', 'sub_ins_report_view',
        'sub_mf_dashboard_view', 'sub_mf_reports_view', 'sub_mf_signature_sheet_view', 'sub_mf_deposit_sheet_view', 'sub_mf_meeting_minutes_view',
        'sub_dep_dashboard_view', 'sub_dep_reports_view', 'sub_dep_accounting_view',
        'sub_admin_logs_view'
      ];
    }

    const fullPerms = computeFullPermissions(templateKeys);
    const newRole: Role = {
      id: crypto.randomUUID(),
      name: trimmed,
      permissions: fullPerms
    };

    try {
      await storageService.saveRole(newRole);
      const updated = await storageService.getRoles();
      setRoles(updated);
      await refreshRoles();

      setShowCreateModal(false);
      setNewRoleName('');
      handleSelectRole(newRole.id);
      showNotice('success', `New role '${trimmed}' created successfully!`);
    } catch (e) {
      console.error(e);
      showNotice('error', "Failed to create new role.");
    }
  };

  const handleCloneRole = async () => {
    if (!workingRole) return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    const clonedName = `${workingRole.name} (Copy)`;
    const newRole: Role = {
      id: crypto.randomUUID(),
      name: clonedName,
      permissions: [...workingRole.permissions]
    };

    try {
      await storageService.saveRole(newRole);
      const updated = await storageService.getRoles();
      setRoles(updated);
      await refreshRoles();
      handleSelectRole(newRole.id);
      showNotice('success', `Role '${clonedName}' duplicated successfully!`);
    } catch (e) {
      console.error(e);
      showNotice('error', "Failed to duplicate role.");
    }
  };

  const executeDeleteRole = async () => {
    const roleId = confirmDeleteModal.roleId;
    if (!roleId || roleId === '1') return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      setConfirmDeleteModal({ isOpen: false, roleId: '', roleName: '' });
      return;
    }

    try {
      await storageService.deleteRole(roleId);
      const updated = await storageService.getRoles();
      setRoles(updated);
      await refreshRoles();

      setConfirmDeleteModal({ isOpen: false, roleId: '', roleName: '' });
      if (selectedRoleId === roleId) {
        handleSelectRole(updated[0]?.id || '1');
      }
      showNotice('success', `Role deleted successfully.`);
    } catch (e) {
      console.error(e);
      showNotice('error', "Failed to delete role.");
    }
  };

  const handleToggleUserRole = async (targetUser: User) => {
    if (!workingRole) return;
    if (isDayEndedForBranch()) {
      showNotice('error', getDayEndedBlockMessage());
      return;
    }
    try {
      setSavingStaffAssignment(true);
      const isCurrentlyAssigned = targetUser.roleId === workingRole.id;
      const fallbackRole = roles.find(r => r.id === '3') || roles[0];
      const newRoleId = isCurrentlyAssigned ? (fallbackRole?.id || '3') : workingRole.id;

      const updatedUser: User = {
        ...targetUser,
        roleId: newRoleId
      };

      await storageService.saveUser(updatedUser);
      const updatedUsersList = await storageService.getUsers();
      setUsers(updatedUsersList);
    } catch (err) {
      console.error("Failed to update user role:", err);
      showNotice('error', "Failed to update user role assignment.");
    } finally {
      setSavingStaffAssignment(false);
    }
  };

  const filteredHierarchy = useMemo(() => {
    const byCategory = categoryFilter === 'all'
      ? MENU_HIERARCHY
      : MENU_HIERARCHY.filter(g => g.category === categoryFilter);

    if (!searchQuery.trim()) return byCategory;
    const query = searchQuery.toLowerCase();

    return byCategory.map(group => {
      const matchGroup =
        group.name.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query) ||
        group.routePath.toLowerCase().includes(query);
      const matchedSubs = group.subMenus.filter(sub =>
        sub.name.toLowerCase().includes(query) ||
        sub.description.toLowerCase().includes(query) ||
        sub.viewPerm.toLowerCase().includes(query)
      );

      if (matchGroup) return group;
      if (matchedSubs.length > 0) {
        return {
          ...group,
          subMenus: matchedSubs
        };
      }
      return null;
    }).filter((g): g is MainMenuGroup => g !== null);
  }, [searchQuery, categoryFilter]);

  const assignedUsers = useMemo(() => {
    if (!workingRole) return [];
    return users.filter(u => u.roleId === workingRole.id);
  }, [users, workingRole]);

  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return roles;
    return roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()));
  }, [roles, roleSearch]);

  const totalSubMenusCount = useMemo(() => {
    return MENU_HIERARCHY.reduce((acc, curr) => acc + curr.subMenus.length, 0);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-2">
        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
        <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Loading Role Permissions Matrix...</p>
      </div>
    );
  }

  const isSuperAdminRole = workingRole?.id === '1';
  const currentSet = new Set(workingRole?.permissions || []);

  let activeSubCount = 0;
  MENU_HIERARCHY.forEach(m => {
    m.subMenus.forEach(s => {
      if (isSuperAdminRole || currentSet.has(s.viewPerm)) {
        activeSubCount++;
      }
    });
  });

  return (
    <div className="space-y-3 not-italic font-sans text-slate-900 pb-6">

      {/* Compact Top Banner */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-slate-900 to-blue-900 text-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <Key size={17} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                Role & Menu Permission Matrix
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 leading-tight">
                {MENU_HIERARCHY.length} Main Groups • {totalSubMenusCount} Functions (View / Edit / Delete)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isDayEnded) return;
              setNewRoleName('');
              setNewRoleTemplate('teller');
              setShowCreateModal(true);
            }}
            disabled={isDayEnded}
            title={isDayEnded ? getDayEndedBlockMessage() : undefined}
            className="px-3.5 py-2 bg-slate-950 hover:bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-xs transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            <span>Create New Role</span>
          </button>
        </div>

        {feedbackBanner && (
          <div className={`mt-2 px-3 py-2 rounded-xl flex items-center space-x-2 font-bold text-xs animate-in fade-in border ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}>
            {feedbackBanner.type === 'success'
              ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              : <AlertTriangle size={15} className="text-rose-600 shrink-0" />}
            <span>{feedbackBanner.text}</span>
          </div>
        )}
      </div>

      {/* Main Dual Pane Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">

        {/* Left Column: Role Selector & Assigned Staff (3 Cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <div className="flex items-center space-x-1.5">
                <Layers size={14} className="text-slate-500" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Roles ({roles.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isDayEnded) return;
                  setNewRoleName('');
                  setNewRoleTemplate('teller');
                  setShowCreateModal(true);
                }}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : 'Add new role'}
                className="text-[10px] font-black text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded-md flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                placeholder="Search roles..."
                className="w-full h-8 pl-8 pr-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-0.5">
              {filteredRoles.map(r => {
                const isSelected = r.id === selectedRoleId;
                const isSuper = r.id === '1';
                const roleUsers = users.filter(u => u.roleId === r.id);

                let roleActiveCount = 0;
                if (isSuper) {
                  roleActiveCount = totalSubMenusCount;
                } else {
                  const set = new Set(r.permissions || []);
                  const hasSub = (r.permissions || []).some(p => typeof p === 'string' && p.startsWith('sub_'));
                  MENU_HIERARCHY.forEach(m => {
                    m.subMenus.forEach(s => {
                      if (set.has(s.viewPerm) || (!hasSub && set.has(s.coarseView))) roleActiveCount++;
                    });
                  });
                }

                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRole(r.id)}
                    className={`px-2.5 py-2 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-600 shadow-2xs ring-1 ring-blue-500/30'
                        : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <h4 className={`text-xs font-black truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                            {r.name}
                          </h4>
                          {isSuper && (
                            <span className="px-1 py-0.2 text-[8px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-200 rounded shrink-0">
                              System
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-semibold mt-0.5">
                          <span>{roleActiveCount}/{totalSubMenusCount}</span>
                          <span>•</span>
                          <span className="text-blue-700">{roleUsers.length} staff</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono font-black text-slate-600 shrink-0">
                        {isSuper ? '100%' : `${Math.min(100, Math.round((roleActiveCount / totalSubMenusCount) * 100))}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Assigned Staff Card */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <div className="flex items-center space-x-1.5">
                <Users size={14} className="text-slate-500" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Staff ({assignedUsers.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isDayEnded) return;
                  setStaffModalSearch('');
                  setShowAssignStaffModal(true);
                }}
                disabled={isDayEnded}
                className="text-[10px] font-black uppercase text-blue-700 hover:bg-blue-100 bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                title={isDayEnded ? getDayEndedBlockMessage() : "Assign staff members"}
              >
                <UserPlus size={11} />
                <span>Assign</span>
              </button>
            </div>

            {assignedUsers.length === 0 ? (
              <div className="py-3 text-center text-slate-400 text-[11px] font-semibold">
                <UserCheck size={18} className="mx-auto text-slate-300 mb-1" />
                <p>No staff assigned.</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[175px] overflow-y-auto pr-0.5">
                {assignedUsers.map(u => (
                  <div key={u.id} className="px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200/70 flex items-center justify-between text-[11px]">
                    <div className="min-w-0 flex-1 pr-1.5">
                      <p className="font-bold text-slate-900 truncate leading-tight">{u.fullName}</p>
                      <p className="text-[9.5px] text-slate-500 font-mono truncate">@{u.username}</p>
                    </div>
                    <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-600 shrink-0">
                      {u.branchId || 'main'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Compact Permission Matrix (9 Cols) */}
        <div className="lg:col-span-9 space-y-2.5">

          {/* Compact Header Controls */}
          {workingRole && (
            <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2 flex-1 min-w-[180px]">
                  <input
                    type="text"
                    value={workingRole.name}
                    onChange={e => {
                      if (isSuperAdminRole || isDayEnded) return;
                      setWorkingRole({ ...workingRole, name: e.target.value });
                    }}
                    disabled={isSuperAdminRole || isDayEnded}
                    className="text-base font-black text-slate-900 bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-blue-600 outline-none transition-all px-1 py-0.5 disabled:opacity-75 disabled:cursor-not-allowed max-w-xs w-full"
                    title={isDayEnded ? getDayEndedBlockMessage() : (isSuperAdminRole ? "Super Admin cannot be modified" : "Edit role name")}
                  />
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-mono font-bold shrink-0">
                    {activeSubCount}/{totalSubMenusCount} Active
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCloneRole}
                    disabled={isDayEnded}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    <Copy size={12} />
                    <span>Duplicate</span>
                  </button>

                  {!isSuperAdminRole && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isDayEnded) return;
                        setConfirmDeleteModal({
                          isOpen: true,
                          roleId: workingRole.id,
                          roleName: workingRole.name
                        });
                      }}
                      disabled={isDayEnded}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  )}

                  {!isSuperAdminRole && (
                    <button
                      type="button"
                      onClick={handleSaveRole}
                      disabled={isSaving || isDayEnded}
                      className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer ${
                        isDirty
                          ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      } disabled:opacity-50`}
                    >
                      <Save size={12} className={isSaving ? 'animate-spin' : ''} />
                      <span>{isSaving ? 'Saving...' : isDirty ? 'Save Permissions' : 'Saved'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Bulk Actions + Category Filter + Search in 2 crisp rows */}
              {!isSuperAdminRole && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1 mr-1">
                    <Sparkles size={11} className="text-amber-500" />
                    <span>Presets:</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleGrantAll}
                    disabled={isDayEnded}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                  >
                    <CheckSquare size={12} />
                    <span>Full Access (V+E+D)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGrantOperational}
                    disabled={isDayEnded}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                  >
                    <SlidersHorizontal size={12} />
                    <span>Operational (View+Edit)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGrantReadOnly}
                    disabled={isDayEnded}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                  >
                    <Eye size={12} />
                    <span>View Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={isDayEnded}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                  >
                    <Square size={12} />
                    <span>Revoke All</span>
                  </button>

                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleResetToOriginal}
                      disabled={isDayEnded}
                      className="px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center space-x-1 cursor-pointer ml-auto"
                    >
                      <RotateCcw size={11} />
                      <span>Discard</span>
                    </button>
                  )}
                </div>
              )}

              {/* Category Filter + Expand/Collapse + Search Bar */}
              <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {CATEGORY_TABS.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                        categoryFilter === tab.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Filter menu, shortcut, alert..."
                    className="w-full h-7 pl-7 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Compact Menus & Sub-Menus Accordion List */}
          <div className="space-y-2">
            {filteredHierarchy.map((menuGroup) => {
              const isExpanded = expandedMenus[menuGroup.id] ?? true;
              const MenuIcon = menuGroup.icon;

              let totalPermsInMenu = 0;
              let activePermsInMenu = 0;
              let viewActiveCount = 0;
              let editActiveCount = 0;
              let deleteActiveCount = 0;

              menuGroup.subMenus.forEach(s => {
                totalPermsInMenu += 3;
                if (isSuperAdminRole || currentSet.has(s.viewPerm)) {
                  activePermsInMenu++;
                  viewActiveCount++;
                }
                if (isSuperAdminRole || currentSet.has(s.editPerm)) {
                  activePermsInMenu++;
                  editActiveCount++;
                }
                if (isSuperAdminRole || currentSet.has(s.deletePerm)) {
                  activePermsInMenu++;
                  deleteActiveCount++;
                }
              });

              const isAllMenuGranted = totalPermsInMenu > 0 && activePermsInMenu === totalPermsInMenu;
              const isAllView = menuGroup.subMenus.length > 0 && viewActiveCount === menuGroup.subMenus.length;
              const isAllEdit = menuGroup.subMenus.length > 0 && editActiveCount === menuGroup.subMenus.length;
              const isAllDelete = menuGroup.subMenus.length > 0 && deleteActiveCount === menuGroup.subMenus.length;

              return (
                <div
                  key={menuGroup.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
                >
                  {/* Compact Menu Group Header */}
                  <div
                    onClick={() => toggleMenuExpand(menuGroup.id)}
                    className="px-3 py-2 bg-slate-50/90 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between gap-2 border-b border-slate-200 select-none transition-colors"
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <span className="text-slate-500 shrink-0">
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>

                      <div className="p-1.5 bg-white border border-slate-200 text-blue-700 rounded-lg shrink-0">
                        <MenuIcon size={14} />
                      </div>

                      <div className="min-w-0 flex items-center space-x-2">
                        <h3 className="text-xs font-black text-slate-900 tracking-tight truncate">
                          {menuGroup.name}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold hidden sm:inline">
                          {menuGroup.routePath}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {activePermsInMenu}/{totalPermsInMenu}
                      </span>

                      {!isSuperAdminRole && (
                        <button
                          type="button"
                          onClick={() => handleToggleMainMenu(menuGroup)}
                          disabled={isDayEnded}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50 ${
                            isAllMenuGranted
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {isAllMenuGranted ? <Square size={11} /> : <CheckSquare size={11} />}
                          <span>{isAllMenuGranted ? 'Clear Menu' : 'All V+E+D'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Compact Sub-Menus Permission Grid */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/60 text-slate-700 border-b border-slate-200 text-[9.5px] font-black uppercase tracking-wider">
                            <th className="py-1.5 px-3">Sub-Menu / Shortcut / Alert Item</th>
                            <th className="py-1.5 px-2 text-center w-24 bg-emerald-50/60 text-emerald-800 border-l border-slate-200">
                              <button
                                type="button"
                                disabled={isSuperAdminRole || isDayEnded}
                                onClick={() => handleToggleMenuColumn(menuGroup, 'view')}
                                title="Toggle View for all items in this menu"
                                className="inline-flex items-center space-x-1 cursor-pointer disabled:cursor-default hover:underline"
                              >
                                <span className={`w-2 h-2 rounded-full ${isAllView ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                                <span>View</span>
                              </button>
                            </th>
                            <th className="py-1.5 px-2 text-center w-24 bg-blue-50/60 text-blue-800 border-l border-slate-200">
                              <button
                                type="button"
                                disabled={isSuperAdminRole || isDayEnded}
                                onClick={() => handleToggleMenuColumn(menuGroup, 'edit')}
                                title="Toggle Edit for all items in this menu"
                                className="inline-flex items-center space-x-1 cursor-pointer disabled:cursor-default hover:underline"
                              >
                                <span className={`w-2 h-2 rounded-full ${isAllEdit ? 'bg-blue-600' : 'bg-slate-300'}`} />
                                <span>Edit</span>
                              </button>
                            </th>
                            <th className="py-1.5 px-2 text-center w-24 bg-rose-50/60 text-rose-800 border-l border-slate-200">
                              <button
                                type="button"
                                disabled={isSuperAdminRole || isDayEnded}
                                onClick={() => handleToggleMenuColumn(menuGroup, 'delete')}
                                title="Toggle Delete for all items in this menu"
                                className="inline-flex items-center space-x-1 cursor-pointer disabled:cursor-default hover:underline"
                              >
                                <span className={`w-2 h-2 rounded-full ${isAllDelete ? 'bg-rose-600' : 'bg-slate-300'}`} />
                                <span>Delete</span>
                              </button>
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {menuGroup.subMenus.map((sub) => {
                            const hasView = isSuperAdminRole || currentSet.has(sub.viewPerm);
                            const hasEdit = isSuperAdminRole || currentSet.has(sub.editPerm);
                            const hasDelete = isSuperAdminRole || currentSet.has(sub.deletePerm);
                            const rowAll = hasView && hasEdit && hasDelete;

                            return (
                              <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                                {/* Compact Sub-Menu Label */}
                                <td className="py-1.5 px-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 leading-tight truncate">
                                        {sub.name}
                                      </div>
                                      <p className="text-[10px] text-slate-400 leading-tight truncate max-w-lg">
                                        {sub.description}
                                      </p>
                                    </div>
                                    {!isSuperAdminRole && (
                                      <button
                                        type="button"
                                        disabled={isDayEnded}
                                        onClick={() => handleToggleSubMenuRow(sub)}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 cursor-pointer transition-colors disabled:opacity-50 ${
                                          rowAll
                                            ? 'bg-slate-800 text-white border-slate-800'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                        }`}
                                        title="Toggle View + Edit + Delete for this row"
                                      >
                                        {rowAll ? 'V+E+D' : 'All'}
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {/* View Permission */}
                                <td className="py-1.5 px-2 text-center bg-emerald-50/15 border-l border-slate-100">
                                  <label className="inline-flex items-center justify-center space-x-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={hasView}
                                      onChange={() => handleToggleSinglePermission(sub.viewPerm)}
                                      disabled={isSuperAdminRole || isDayEnded}
                                      className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-[9.5px] font-mono font-bold ${hasView ? 'text-emerald-700' : 'text-slate-400'}`}>
                                      {hasView ? 'Allow' : 'Deny'}
                                    </span>
                                  </label>
                                </td>

                                {/* Edit Permission */}
                                <td className="py-1.5 px-2 text-center bg-blue-50/15 border-l border-slate-100">
                                  <label className="inline-flex items-center justify-center space-x-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={hasEdit}
                                      onChange={() => handleToggleSinglePermission(sub.editPerm)}
                                      disabled={isSuperAdminRole || isDayEnded}
                                      className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-[9.5px] font-mono font-bold ${hasEdit ? 'text-blue-700' : 'text-slate-400'}`}>
                                      {hasEdit ? 'Allow' : 'Deny'}
                                    </span>
                                  </label>
                                </td>

                                {/* Delete Permission */}
                                <td className="py-1.5 px-2 text-center bg-rose-50/15 border-l border-slate-100">
                                  <label className="inline-flex items-center justify-center space-x-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={hasDelete}
                                      onChange={() => handleToggleSinglePermission(sub.deletePerm)}
                                      disabled={isSuperAdminRole || isDayEnded}
                                      className="w-3.5 h-3.5 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-[9.5px] font-mono font-bold ${hasDelete ? 'text-rose-700' : 'text-slate-400'}`}>
                                      {hasDelete ? 'Allow' : 'Deny'}
                                    </span>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Compact Bottom Save Bar */}
          {workingRole && !isSuperAdminRole && (
            <div className="mt-3 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white px-4 py-3 rounded-2xl shadow-md border border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Key size={17} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-black text-white tracking-tight">
                      {workingRole.name} • <span className="text-blue-400 font-mono">{activeSubCount}/{totalSubMenusCount} Functions</span>
                    </h4>
                    {isDirty ? (
                      <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded text-[9px] font-bold uppercase">
                        Unsaved
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-bold uppercase">
                        Synced
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {isDirty
                      ? 'Modified permissions pending. Click Save Permissions to apply.'
                      : 'All View, Edit & Delete permissions are synced with database.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0 ml-auto">
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    disabled={isDayEnded}
                    className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer border border-slate-700 disabled:opacity-50"
                  >
                    Discard
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveRole}
                  disabled={isSaving || isDayEnded}
                  className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                    isDirty
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white ring-2 ring-blue-400/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Save size={14} className={isSaving ? 'animate-spin' : ''} />
                  <span>{isSaving ? 'Saving...' : isDirty ? 'Save Permissions' : 'Saved'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create New Role */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 font-sans">
            <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-blue-600 rounded-lg"><Plus size={16} /></div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Create New Role</h3>
                  <p className="text-[10px] font-semibold text-slate-300">Define a new role & initial permissions template</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4">
              <DayEndFieldset className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    placeholder="e.g. Loan Officer, Accountant, Field Officer..."
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Starting Template Preset
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-left">
                    {[
                      { id: 'teller', label: 'Teller / Cashier', desc: 'Front counter, cash, shortcuts & alerts' },
                      { id: 'manager', label: 'Branch Manager', desc: 'Operations, modules, HR & reports' },
                      { id: 'hr', label: 'HR Officer', desc: 'Staff registry, attendance, leave & payroll' },
                      { id: 'auditor', label: 'Auditor (Read-Only)', desc: 'Reports, ledgers, depreciation & audit logs' },
                      { id: 'admin', label: 'Full Admin Access', desc: 'Unrestricted View, Edit & Delete access' }
                    ].map(tpl => (
                      <div
                        key={tpl.id}
                        onClick={() => !isDayEnded && setNewRoleTemplate(tpl.id)}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          newRoleTemplate === tpl.id
                            ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-500'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <h5 className="font-black text-xs text-slate-900">{tpl.label}</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5">{tpl.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </DayEndFieldset>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRole}
                disabled={isDayEnded}
                className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assign Staff */}
      {showAssignStaffModal && workingRole && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 font-sans">
            <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-blue-600 rounded-lg"><UserPlus size={16} /></div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Assign Staff Members</h3>
                  <p className="text-[10px] font-semibold text-slate-300">
                    Role: <span className="text-blue-300">{workingRole.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignStaffModal(false)}
                className="p-1 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={staffModalSearch}
                  onChange={e => setStaffModalSearch(e.target.value)}
                  placeholder="Search staff by name or username..."
                  className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {users
                  .filter(u => {
                    if (!staffModalSearch.trim()) return true;
                    const q = staffModalSearch.toLowerCase();
                    return (
                      u.fullName?.toLowerCase().includes(q) ||
                      u.username?.toLowerCase().includes(q) ||
                      u.branchId?.toLowerCase().includes(q)
                    );
                  })
                  .map(u => {
                    const isAssigned = u.roleId === workingRole.id;
                    const userRole = roles.find(r => r.id === u.roleId)?.name || 'Unknown Role';

                    return (
                      <div
                        key={u.id}
                        onClick={() => !isDayEnded && !savingStaffAssignment && handleToggleUserRole(u)}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          isDayEnded || savingStaffAssignment ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isAssigned
                            ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400/40'
                            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            isAssigned ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {isAssigned ? <Check size={14} /> : (u.fullName?.charAt(0) || 'U')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 text-xs truncate">{u.fullName}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              @{u.username} • {u.branchId || 'main'} • {userRole}
                            </p>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase shrink-0 ${
                          isAssigned
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isAssigned ? 'Assigned' : 'Assign'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-bold">
                {assignedUsers.length} staff assigned
              </span>
              <button
                type="button"
                onClick={() => setShowAssignStaffModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={confirmDeleteModal.isOpen}
        title="Confirm Role Deletion"
        message={`Are you sure you want to delete the role '${confirmDeleteModal.roleName}'? Any staff members currently assigned to this role will lose their custom access privileges.`}
        onConfirm={executeDeleteRole}
        onCancel={() => setConfirmDeleteModal({ isOpen: false, roleId: '', roleName: '' })}
      />
    </div>
  );
};

export default RolePermissionManagement;
