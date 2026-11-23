
import { DailyData, AuditLog, User, Role, SystemSettings, LedgerAccount, Branch, Employee, LeaveType, LeaveRequest, PayrollRecord, Complaint, Notice, PopupNotice, DownloadableDocument, FDRecordItem, TaxConfig, OfficeExpenseRecord, BranchFixedExpenseConfig, SavedOfficeExpenseSheet, ChatMessage, AttendanceRecord, BoardCategory, BoardMember, BoardAllowanceSheet, BoardDesignation, AppHoliday, BranchOperationalStatus, RemittanceCompany, SavingProduct, LoanProduct } from '../types';
import { supabaseService, toBsDateString } from './supabaseService';
import { productService } from './productService';
import { assertDayNotEnded } from '../utils/dayEndLock';

let lastAutoLogKey = '';
let lastAutoLogAt = 0;

function getActiveActorContext(): { userId: string; branchId: string } {
  try {
    const rawUser = typeof localStorage !== 'undefined' ? localStorage.getItem('ZEN_AUTH_USER') : null;
    const activeBranch = typeof localStorage !== 'undefined' ? localStorage.getItem('ZEN_ACTIVE_BRANCH_ID') : null;
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      return {
        userId: String(parsed?.id || parsed?.username || 'admin'),
        branchId: String(activeBranch || parsed?.branchId || 'main')
      };
    }
    return { userId: 'admin', branchId: activeBranch || 'main' };
  } catch {
    return { userId: 'admin', branchId: 'main' };
  }
}

function recordAutoLog(action: string, details: string, branchId?: string) {
  try {
    const actor = getActiveActorContext();
    const targetBranch = branchId || actor.branchId || 'main';
    const dedupeKey = `${actor.userId}|${targetBranch}|${action}|${details}`;
    const now = Date.now();
    if (dedupeKey === lastAutoLogKey && now - lastAutoLogAt < 1500) {
      return;
    }
    lastAutoLogKey = dedupeKey;
    lastAutoLogAt = now;
    void supabaseService.saveLog(actor.userId, action, details, targetBranch).catch(() => {});
  } catch {
    // Never fail primary operations because of audit logging
  }
}

export const storageService = {
  // Remittance Company Vault
  getRemittanceCompanies: async (branchId?: string): Promise<RemittanceCompany[]> => {
    return supabaseService.getRemittanceCompanies(branchId);
  },
  saveRemittanceCompany: async (company: RemittanceCompany): Promise<{ success: boolean; supabaseSynced: boolean; error?: string }> => {
    assertDayNotEnded(company.branchId);
    return supabaseService.saveRemittanceCompany(company);
  },
  deleteRemittanceCompany: async (id: string): Promise<{ success: boolean; supabaseSynced: boolean; error?: string }> => {
    assertDayNotEnded();
    return supabaseService.deleteRemittanceCompany(id);
  },
  syncAllRemittanceToSupabase: async (): Promise<{ success: boolean; count: number; error?: string }> => {
    return supabaseService.syncAllRemittanceToSupabase();
  },

  // Board of Directors & Governance
  getBoardCategories: async (): Promise<BoardCategory[]> => {
    return supabaseService.getBoardCategories();
  },
  saveBoardCategory: async (category: BoardCategory): Promise<void> => {
    assertDayNotEnded();
    return supabaseService.saveBoardCategory(category);
  },
  deleteBoardCategory: async (id: string): Promise<void> => {
    assertDayNotEnded();
    return supabaseService.deleteBoardCategory(id);
  },

  getBoardDesignations: async (): Promise<BoardDesignation[]> => {
    return supabaseService.getBoardDesignations();
  },
  saveBoardDesignation: async (designation: BoardDesignation): Promise<void> => {
    assertDayNotEnded();
    return supabaseService.saveBoardDesignation(designation);
  },
  deleteBoardDesignation: async (id: string): Promise<void> => {
    assertDayNotEnded();
    return supabaseService.deleteBoardDesignation(id);
  },

  getBoardMembers: async (branchId?: string): Promise<BoardMember[]> => {
    return supabaseService.getBoardMembers(branchId);
  },
  saveBoardMember: async (member: BoardMember): Promise<void> => {
    assertDayNotEnded(member.branchId);
    return supabaseService.saveBoardMember(member);
  },
  deleteBoardMember: async (id: string): Promise<void> => {
    assertDayNotEnded();
    return supabaseService.deleteBoardMember(id);
  },

  getBoardAllowanceSheets: async (): Promise<BoardAllowanceSheet[]> => {
    return supabaseService.getBoardAllowanceSheets();
  },
  saveBoardAllowanceSheet: async (sheet: BoardAllowanceSheet): Promise<void> => {
    assertDayNotEnded();
    return supabaseService.saveBoardAllowanceSheet(sheet);
  },
  deleteBoardAllowanceSheet: async (id: string): Promise<void> => {
    assertDayNotEnded();
    return supabaseService.deleteBoardAllowanceSheet(id);
  },

  // Staff Chat & Messaging
  getChatMessages: async (): Promise<ChatMessage[]> => {
    return supabaseService.getChatMessages();
  },
  sendChatMessage: async (msg: ChatMessage): Promise<ChatMessage> => {
    return supabaseService.sendChatMessage(msg);
  },
  deleteChatMessage: async (id: string): Promise<void> => {
    return supabaseService.deleteChatMessage(id);
  },
  markChatRead: async (messageIds: string[], userId: string): Promise<void> => {
    return supabaseService.markChatRead(messageIds, userId);
  },
  addChatReaction: async (messageId: string, reaction: { emoji: string; userId: string; userName: string }): Promise<void> => {
    return supabaseService.addChatReaction(messageId, reaction);
  },

  // Notices
  getNotices: async (branchId?: string): Promise<Notice[]> => {
    return supabaseService.getNotices(branchId);
  },
  saveNotice: async (notice: Notice) => {
    assertDayNotEnded(notice.branchId);
    const res = await supabaseService.saveNotice(notice);
    recordAutoLog('NOTICE_SAVED', `Saved notice "${notice.title}" (${notice.date || 'Today'})`, notice.branchId);
    return res;
  },
  deleteNotice: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteNotice(id);
    recordAutoLog('NOTICE_DELETED', `Deleted notice ID: ${id}`);
    return res;
  },

  // Popup Notices & Login Announcements
  getPopupNotices: async (branchId?: string): Promise<PopupNotice[]> => {
    return supabaseService.getPopupNotices(branchId);
  },
  savePopupNotice: async (notice: PopupNotice): Promise<void> => {
    assertDayNotEnded(notice.targetBranchId);
    await supabaseService.savePopupNotice(notice);
    recordAutoLog('POPUP_NOTICE_SAVED', `Saved login announcement "${notice.title}"`, notice.targetBranchId);
  },
  deletePopupNotice: async (id: string): Promise<void> => {
    assertDayNotEnded();
    await supabaseService.deletePopupNotice(id);
    recordAutoLog('POPUP_NOTICE_DELETED', `Deleted login announcement ID: ${id}`);
  },
  togglePopupNoticeStatus: async (id: string, isActive: boolean): Promise<void> => {
    assertDayNotEnded();
    await supabaseService.togglePopupNoticeStatus(id, isActive);
    recordAutoLog('POPUP_NOTICE_STATUS', `${isActive ? 'Activated' : 'Deactivated'} login announcement ID: ${id}`);
  },

  // Documents
  getDocuments: async (branchId?: string): Promise<DownloadableDocument[]> => {
    return supabaseService.getDocuments(branchId);
  },
  saveDocument: async (doc: DownloadableDocument) => {
    assertDayNotEnded(doc.branchId);
    const res = await supabaseService.saveDocument(doc);
    recordAutoLog('DOCUMENT_UPLOADED', `Saved document "${doc.title}" (${doc.category || 'General'})`, doc.branchId);
    return res;
  },
  deleteDocument: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteDocument(id);
    recordAutoLog('DOCUMENT_DELETED', `Deleted document ID: ${id}`);
    return res;
  },

  // Employees
  getEmployees: async (branchId?: string): Promise<Employee[]> => {
    return supabaseService.getEmployees(branchId);
  },
  saveEmployee: async (emp: Employee) => {
    assertDayNotEnded(emp.branchId);
    const res = await supabaseService.saveEmployee(emp);
    recordAutoLog('EMPLOYEE_SAVED', `Saved employee record: ${emp.fullName} (${emp.employeeCode || emp.id})`, emp.branchId);
    return res;
  },
  deleteEmployee: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteEmployee(id);
    recordAutoLog('EMPLOYEE_DELETED', `Deleted employee ID: ${id}`);
    return res;
  },
  syncAllMasterEmployees: async (): Promise<Employee[]> => {
    return supabaseService.syncAllMasterEmployees();
  },

  // Leave Types
  getLeaveTypes: async (): Promise<LeaveType[]> => {
    return supabaseService.getLeaveTypes();
  },
  saveLeaveType: async (lt: LeaveType) => {
    assertDayNotEnded();
    return supabaseService.saveLeaveType(lt);
  },
  deleteLeaveType: async (id: string) => {
    assertDayNotEnded();
    return supabaseService.deleteLeaveType(id);
  },

  // Leave Requests
  getLeaveRequests: async (branchId?: string): Promise<LeaveRequest[]> => {
    return supabaseService.getLeaveRequests(branchId);
  },
  saveLeaveRequest: async (lr: LeaveRequest) => {
    assertDayNotEnded();
    const res = await supabaseService.saveLeaveRequest(lr);
    recordAutoLog('HR_LEAVE_SAVED', `Leave request (${lr.status}) for employee ID ${lr.employeeId}: ${lr.startDate} to ${lr.endDate}`);
    return res;
  },
  deleteLeaveRequest: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteLeaveRequest(id);
    recordAutoLog('HR_LEAVE_DELETED', `Deleted leave request ID: ${id}`);
    return res;
  },

  // Payroll
  getPayrollRecords: async (branchId?: string): Promise<PayrollRecord[]> => {
    return supabaseService.getPayrollRecords(branchId);
  },
  savePayrollRecords: async (records: PayrollRecord[]) => {
    assertDayNotEnded();
    const res = await supabaseService.savePayrollRecords(records);
    recordAutoLog('HR_PAYROLL_SAVED', `Saved payroll run for ${records?.length || 0} employee record(s)`);
    return res;
  },
  deletePayrollRun: async (year: string, month: string, branchId?: string) => {
    assertDayNotEnded(branchId);
    const res = await supabaseService.deletePayrollRun(year, month, branchId);
    recordAutoLog('HR_PAYROLL_DELETED', `Deleted payroll run for ${year}-${month}`, branchId);
    return res;
  },

  // Attendance
  getAttendanceRecords: async (branchId?: string, date?: string, month?: string): Promise<AttendanceRecord[]> => {
    return supabaseService.getAttendanceRecords(branchId, date, month);
  },
  saveAttendanceRecords: async (records: AttendanceRecord[]) => {
    assertDayNotEnded();
    const res = await supabaseService.saveAttendanceRecords(records);
    recordAutoLog('HR_ATTENDANCE_SAVED', `Updated attendance for ${records?.length || 0} staff record(s)`);
    return res;
  },
  syncAttendanceToSupabase: async (): Promise<{ success: boolean; syncedCount: number; error?: string }> => {
    return supabaseService.syncAttendanceToSupabase();
  },
  deleteAttendanceRecord: async (id: string) => {
    assertDayNotEnded();
    return supabaseService.deleteAttendanceRecord(id);
  },
  deleteAttendanceByMonth: async (yearBs: number, monthBs: number, branchId?: string) => {
    assertDayNotEnded(branchId);
    return supabaseService.deleteAttendanceByMonth(yearBs, monthBs, branchId);
  },
  deleteAttendanceByEmployee: async (employeeId: string, yearBs?: number, monthBs?: number, employeeName?: string) => {
    assertDayNotEnded();
    return supabaseService.deleteAttendanceByEmployee(employeeId, yearBs, monthBs, employeeName);
  },
  deleteManualAttendanceOnly: async (yearBs: number, monthBs: number, branchId?: string) => {
    assertDayNotEnded(branchId);
    return supabaseService.deleteManualAttendanceOnly(yearBs, monthBs, branchId);
  },
  clearAttendanceRecords: async (branchId?: string, date?: string) => {
    assertDayNotEnded(branchId);
    return supabaseService.clearAttendanceRecords(branchId, date);
  },

  // Tax Policy & Adjustments
  getTaxConfig: async (): Promise<TaxConfig | null> => {
    return supabaseService.getTaxConfig();
  },
  saveTaxConfig: async (cfg: TaxConfig) => {
    assertDayNotEnded();
    return supabaseService.saveTaxConfig(cfg);
  },
  getTaxAdjustments: async (): Promise<Record<string, any>> => {
    return supabaseService.getTaxAdjustments();
  },
  saveTaxAdjustments: async (adjustmentsMap: Record<string, any>) => {
    assertDayNotEnded();
    return supabaseService.saveTaxAdjustments(adjustmentsMap);
  },

  // Complaints
  getComplaints: async (branchId?: string): Promise<Complaint[]> => {
    return supabaseService.getComplaints(branchId);
  },
  saveComplaint: async (c: Complaint) => {
    assertDayNotEnded();
    return supabaseService.saveComplaint(c);
  },

  // Office Expenses (Operating Expenses)
  getOfficeExpenses: async (branchId?: string): Promise<OfficeExpenseRecord[]> => {
    return supabaseService.getOfficeExpenses(branchId);
  },
  saveOfficeExpense: async (expense: OfficeExpenseRecord) => {
    assertDayNotEnded(expense.branchId);
    const res = await supabaseService.saveOfficeExpense(expense);
    recordAutoLog('OFFICE_EXPENSE_SAVED', `Recorded office expense "${expense.categoryLabel || expense.category || 'Expense'}" — NPR ${Number(expense.amount || 0).toLocaleString()} (${expense.date || ''})`, expense.branchId);
    return res;
  },
  saveAllOfficeExpenses: async (expenses: OfficeExpenseRecord[]) => {
    assertDayNotEnded();
    const res = await supabaseService.saveAllOfficeExpenses(expenses);
    recordAutoLog('OFFICE_EXPENSE_BATCH', `Saved ${expenses?.length || 0} office expense record(s)`);
    return res;
  },
  deleteOfficeExpense: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteOfficeExpense(id);
    recordAutoLog('OFFICE_EXPENSE_DELETED', `Deleted office expense ID: ${id}`);
    return res;
  },
  deleteMonthlyOfficeExpenses: async (fiscalYear: string, month: string, branchId?: string) => {
    assertDayNotEnded(branchId);
    const res = await supabaseService.deleteMonthlyOfficeExpenses(fiscalYear, month, branchId);
    recordAutoLog('OFFICE_EXPENSE_CLEARED', `Cleared monthly office expenses (${fiscalYear} / ${month})`, branchId);
    return res;
  },
  deleteElectricityExpensesForMonth: async (fiscalYear: string, month: string) => {
    assertDayNotEnded();
    return supabaseService.deleteElectricityExpensesForMonth(fiscalYear, month);
  },
  getFixedExpenseConfigs: async (): Promise<Record<string, BranchFixedExpenseConfig>> => {
    return supabaseService.getFixedExpenseConfigs();
  },
  saveFixedExpenseConfig: async (config: BranchFixedExpenseConfig) => {
    assertDayNotEnded(config.branchId);
    const res = await supabaseService.saveFixedExpenseConfig(config);
    recordAutoLog('FIXED_EXPENSE_CONFIG', `Updated fixed expense rules for branch ${config.branchId}`, config.branchId);
    return res;
  },

  // Saved Expense Sheets
  getSavedExpenseSheets: async (branchId?: string): Promise<SavedOfficeExpenseSheet[]> => {
    return supabaseService.getSavedExpenseSheets(branchId);
  },
  saveSavedExpenseSheet: async (sheet: SavedOfficeExpenseSheet) => {
    assertDayNotEnded(sheet.branchId);
    const res = await supabaseService.saveSavedExpenseSheet(sheet);
    recordAutoLog('EXPENSE_SHEET_SAVED', `Saved office expense sheet (${sheet.fiscalYear} / ${sheet.month})`, sheet.branchId);
    return res;
  },
  saveAllSavedExpenseSheets: async (sheets: SavedOfficeExpenseSheet[]) => {
    assertDayNotEnded();
    return supabaseService.saveAllSavedExpenseSheets(sheets);
  },
  deleteSavedExpenseSheet: async (id: string, fiscalYear?: string, month?: string, branchId?: string) => {
    assertDayNotEnded(branchId);
    const res = await supabaseService.deleteSavedExpenseSheet(id, fiscalYear, month, branchId);
    recordAutoLog('EXPENSE_SHEET_DELETED', `Deleted expense sheet ID: ${id}`, branchId);
    return res;
  },
  deleteOfficeExpenseLedgerEntries: async (fiscalYear: string, month: string, branchId?: string, monthNp?: string) => {
    assertDayNotEnded(branchId);
    return supabaseService.deleteOfficeExpenseLedgerEntries(fiscalYear, month, branchId, monthNp);
  },

  // Branches
  getBranches: async (): Promise<Branch[]> => {
    return supabaseService.getBranches();
  },
  saveBranch: async (branch: Branch) => {
    assertDayNotEnded();
    const res = await supabaseService.saveBranch(branch);
    recordAutoLog('BRANCH_SAVED', `Saved branch "${branch.name}" (${branch.code})`, branch.id);
    return res;
  },
  deleteBranch: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteBranch(id);
    recordAutoLog('BRANCH_DELETED', `Deleted branch ID: ${id}`);
    return res;
  },

  // Saving Products
  getSavingProducts: async (): Promise<SavingProduct[]> => {
    return productService.getSavingProducts();
  },
  saveSavingProduct: async (product: SavingProduct): Promise<SavingProduct[]> => {
    assertDayNotEnded();
    const res = await productService.saveSavingProduct(product);
    recordAutoLog('SAVING_PRODUCT_SAVED', `Saved saving product "${product.name}"`);
    return res;
  },
  deleteSavingProduct: async (id: string): Promise<SavingProduct[]> => {
    assertDayNotEnded();
    const res = await productService.deleteSavingProduct(id);
    recordAutoLog('SAVING_PRODUCT_DELETED', `Deleted saving product ID: ${id}`);
    return res;
  },

  // Loan Products
  getLoanProducts: async (): Promise<LoanProduct[]> => {
    return productService.getLoanProducts();
  },
  saveLoanProduct: async (product: LoanProduct): Promise<LoanProduct[]> => {
    assertDayNotEnded();
    const res = await productService.saveLoanProduct(product);
    recordAutoLog('LOAN_PRODUCT_SAVED', `Saved loan product "${product.name}"`);
    return res;
  },
  deleteLoanProduct: async (id: string): Promise<LoanProduct[]> => {
    assertDayNotEnded();
    const res = await productService.deleteLoanProduct(id);
    recordAutoLog('LOAN_PRODUCT_DELETED', `Deleted loan product ID: ${id}`);
    return res;
  },

  // Roles
  getRoles: async (): Promise<Role[]> => {
    return supabaseService.getRoles();
  },
  saveRole: async (role: Role) => {
    assertDayNotEnded();
    const res = await supabaseService.saveRole(role);
    recordAutoLog('ROLE_SAVED', `Updated role & permissions: "${role.name}"`);
    return res;
  },
  deleteRole: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteRole(id);
    recordAutoLog('ROLE_DELETED', `Deleted role ID: ${id}`);
    return res;
  },

  // Users
  getUsers: async (options?: { forceRefresh?: boolean }): Promise<User[]> => {
    return supabaseService.getUsers(options);
  },
  getFreshUser: async (criteria: { id?: string; username?: string }): Promise<User | null> => {
    return supabaseService.getFreshUserByIdOrUsername(criteria);
  },
  saveUser: async (user: User) => {
    const res = await supabaseService.saveUser(user);
    recordAutoLog('USER_SAVED', `Saved user @${user.username} (${user.fullName})`, user.branchId);
    return res;
  },
  deleteUser: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteUser(id);
    recordAutoLog('USER_DELETED', `Deleted user ID: ${id}`);
    return res;
  },

  // Settings
  getSettings: async (): Promise<SystemSettings> => {
    return supabaseService.getSettings();
  },
  getSystemSettings: async (): Promise<SystemSettings> => {
    return supabaseService.getSettings();
  },
  saveSettings: async (settings: SystemSettings) => {
    const res = await supabaseService.saveSettings(settings);
    recordAutoLog('SETTINGS_SAVED', `Updated system settings (${settings.systemName})`);
    return res;
  },
  saveSystemSettings: async (settings: SystemSettings) => {
    const res = await supabaseService.saveSettings(settings);
    recordAutoLog('SETTINGS_SAVED', `Updated system settings (${settings.systemName})`);
    return res;
  },

  // Daily Data
  getDayData: async (date: string, branchId: string): Promise<DailyData | null> => {
    return supabaseService.getDayData(date, branchId);
  },
  saveDayData: async (date: string, branchId: string, data: DailyData) => {
    assertDayNotEnded(branchId);
    const res = await supabaseService.saveDayData(date, branchId, data);
    const ledgerCnt = Array.isArray(data.transactions) ? data.transactions.length : 0;
    const counterCnt = Array.isArray(data.officeTransactions) ? data.officeTransactions.length : 0;
    const remitCnt = Array.isArray(data.remittances) ? data.remittances.length : 0;
    const vaultCnt = Array.isArray(data.vaultTransactions) ? data.vaultTransactions.length : 0;
    recordAutoLog(
      'DAILY_TRANSACTION_SAVED',
      `Updated daily registry for ${date} (${branchId}): ${counterCnt} counter, ${ledgerCnt} ledger, ${remitCnt} remit, ${vaultCnt} vault entries`,
      branchId
    );
    return res;
  },
  deleteDayData: async (date: string, branchId?: string, options?: { skipBranchDayEndCheck?: boolean }): Promise<void> => {
    assertDayNotEnded(options?.skipBranchDayEndCheck ? undefined : branchId);
    return supabaseService.deleteDayData(date, branchId);
  },
  deleteDayDataRange: async (fromDate: string, toDate: string, branchId?: string, options?: { skipBranchDayEndCheck?: boolean }): Promise<void> => {
    assertDayNotEnded(options?.skipBranchDayEndCheck ? undefined : branchId);
    return supabaseService.deleteDayDataRange(fromDate, toDate, branchId);
  },
  getLocalDailyData: (branchId?: string): Record<string, DailyData> => {
    return supabaseService.getLocalDailyData(branchId);
  },
  getAllData: async (branchId?: string): Promise<Record<string, DailyData>> => {
    try {
      const data = await supabaseService.getAllDailyData(branchId);
      return data || {};
    } catch (e) {
      console.warn("Notice: Falling back to local data in storageService.getAllData:", e);
      return supabaseService.getLocalDailyData(branchId);
    }
  },
  invalidateMemoryCache: (pattern?: string): void => {
    supabaseService.invalidateMemoryCache(pattern);
  },
  getFullBackupData: async (): Promise<Record<string, unknown>> => {
    return supabaseService.getFullBackupData();
  },
  restoreBackupData: async (backupData: Record<string, unknown>): Promise<{ success: boolean; message: string }> => {
    assertDayNotEnded();
    return supabaseService.restoreBackupData(backupData);
  },
  resetModuleData: async (moduleType: 'daily' | 'ledgers' | 'hr' | 'notices' | 'logs' | 'full'): Promise<{ success: boolean; message: string }> => {
    assertDayNotEnded();
    return supabaseService.resetModuleData(moduleType);
  },

  // Ledger Accounts
  getLedgerAccounts: async (branchId?: string): Promise<LedgerAccount[]> => {
    return supabaseService.getLedgerAccounts(branchId);
  },
  saveLedgerAccount: async (account: LedgerAccount) => {
    assertDayNotEnded(account.branchId);
    return supabaseService.saveLedgerAccount(account);
  },
  deleteLedgerAccount: async (id: string) => {
    assertDayNotEnded();
    return supabaseService.deleteLedgerAccount(id);
  },

  // Logs
  getLogs: async (branchId?: string): Promise<AuditLog[]> => {
    return supabaseService.getLogs(branchId);
  },
  saveLog: async (userId: string, action: string, details: string, branchId?: string) => {
    return supabaseService.saveLog(userId, action, details, branchId);
  },

  // FD Records
  getFDRecords: async (): Promise<FDRecordItem[]> => {
    return supabaseService.getFDRecords();
  },
  saveFDRecord: async (rec: FDRecordItem) => {
    assertDayNotEnded(rec.selectedBranch);
    const res = await supabaseService.saveFDRecord(rec);
    recordAutoLog('FD_RECORD_SAVED', `Saved FD record for ${rec.holderName} (Acc: ${rec.accountNo}) — NPR ${Number(rec.amount || 0).toLocaleString()}`, rec.selectedBranch);
    return res;
  },
  deleteFDRecord: async (id: string) => {
    assertDayNotEnded();
    const res = await supabaseService.deleteFDRecord(id);
    recordAutoLog('FD_RECORD_DELETED', `Deleted FD record ID: ${id}`);
    return res;
  },

  // Helper for closing balance (needs to be async now)
  getPreviousDayClosing: async (currentDate: string, branchId: string): Promise<number> => {
    const targetBs = toBsDateString(currentDate);
    const allByBranch = await supabaseService.getAllDailyData(branchId);
    
    // Extract unique previous BS dates in ascending order
    const dates = Array.from(new Set(
      Object.keys(allByBranch).map(toBsDateString).filter(d => d < targetBs)
    )).sort();

    let balance = 0;
    dates.forEach(d => {
      const dayData = allByBranch[d] || Object.values(allByBranch).find((v: any) => toBsDateString(v?.date) === d);
      if (!dayData) return;
      
      let dayCredit = 0;
      let dayDebit = 0;

      (dayData.officeTransactions || []).forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'in') dayCredit += amt;
        else dayDebit += amt;
      });

      (dayData.transactions || []).forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'in') dayCredit += amt;
        else dayDebit += amt;
      });

      (dayData.vaultTransactions || []).forEach((vt: any) => {
        const amt = Number(vt.amount) || 0;
        const isTeller = vt.source === 'Teller' || vt.partyType === 'Teller Desk' || (!vt.source && !vt.partyType);
        if (isTeller) {
           if (vt.type === 'in') dayDebit += amt;
           else if (vt.type === 'out') dayCredit += amt;
        }
      });

      balance = balance + dayCredit - dayDebit;
    });

    return balance;
  },

  // Holiday Management & Branch Operational Status
  getHolidays: async (): Promise<AppHoliday[]> => {
    return supabaseService.getHolidays();
  },
  saveHoliday: async (holiday: AppHoliday): Promise<void> => {
    assertDayNotEnded();
    await supabaseService.saveHoliday(holiday);
    recordAutoLog('HOLIDAY_SAVED', `Saved holiday "${holiday.title}" (${holiday.dateBs || ''})`);
  },
  deleteHoliday: async (id: string): Promise<void> => {
    assertDayNotEnded();
    await supabaseService.deleteHoliday(id);
    recordAutoLog('HOLIDAY_DELETED', `Deleted holiday ID: ${id}`);
  },
  getBranchOperationalStatuses: async (): Promise<Record<string, BranchOperationalStatus>> => {
    return supabaseService.getBranchOperationalStatuses();
  },
  setBranchOperationalStatus: async (
    branchId: string,
    status: BranchOperationalStatus,
    notes?: string,
    options?: { recordHeadOfficeCycle?: boolean }
  ): Promise<void> => {
    await supabaseService.setBranchOperationalStatus(branchId, status, notes, options);
    recordAutoLog(`DAY_${status}`, notes || `Branch ${branchId} operational status changed to ${status}`, branchId);
  },
  getWeekendDays: async (): Promise<number[]> => {
    return supabaseService.getWeekendDays();
  },
  saveWeekendDays: async (days: number[]): Promise<void> => {
    assertDayNotEnded();
    await supabaseService.saveWeekendDays(days);
    recordAutoLog('WEEKEND_DAYS_SAVED', `Updated weekly off days: ${days.join(', ')}`);
  }
};


