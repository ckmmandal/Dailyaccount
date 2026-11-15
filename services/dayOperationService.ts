import NepaliDate from 'nepali-date-converter';
import { supabase } from './supabase';
import { BranchDayOperationRecord, DayOperationStatus } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'BRANCH_DAY_OPERATIONS_';

export const dayOperationService = {
  getTodayBsDate(): string {
    try {
      return new NepaliDate(new Date()).format('YYYY-MM-DD');
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  },

  isTodaySaturday(): boolean {
    return new Date().getDay() === 6;
  },

  formatTime(timestamp?: number): string {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleTimeString('ne-NP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return new Date(timestamp).toLocaleTimeString();
    }
  },

  async getAllDayOperations(targetDate?: string): Promise<Record<string, BranchDayOperationRecord>> {
    const dateStr = targetDate || this.getTodayBsDate();
    const docId = `BRANCH_DAY_OPS_${dateStr}`;
    let records: Record<string, BranchDayOperationRecord> = {};

    // 1. Try Local Storage first for instant response
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${dateStr}`);
        if (raw) {
          records = JSON.parse(raw);
        }
      }
    } catch (e) {
      console.warn("Notice: Local storage read day operations:", e);
    }

    // 2. Fetch from Supabase Cloud
    try {
      const { data, error } = await supabase
        .from('daily_data')
        .select('*')
        .eq('id', docId)
        .maybeSingle();

      if (!error && data?.data?.records) {
        records = { ...records, ...data.data.records };
        // Sync back to local storage
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${dateStr}`, JSON.stringify(records));
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn("Notice: Supabase fetch day operations:", err);
    }

    return records;
  },

  async getDayOperation(branchId: string, targetDate?: string, branchName?: string): Promise<BranchDayOperationRecord> {
    const dateStr = targetDate || this.getTodayBsDate();
    const all = await this.getAllDayOperations(dateStr);
    const existing = all[branchId] || all[branchId.toLowerCase()];

    if (existing) {
      return existing;
    }

    // Default status if no record exists for today
    const isSat = this.isTodaySaturday();
    const defaultStatus: DayOperationStatus = isSat ? 'holiday' : 'open';

    const defaultRecord: BranchDayOperationRecord = {
      id: `DAY_OP_${branchId}_${dateStr.replace(/[\/\-]/g, '_')}`,
      branchId,
      branchName: branchName || branchId.toUpperCase(),
      date: dateStr,
      status: defaultStatus,
      isHoliday: isSat,
      holidayReason: isSat ? 'साप्ताहिक बिदा (Saturday Weekly Off)' : undefined,
      updatedAt: Date.now()
    };

    return defaultRecord;
  },

  async beginDay(params: {
    branchId: string;
    branchName?: string;
    user: any;
    openingCash?: number;
    remarks?: string;
    date?: string;
  }): Promise<BranchDayOperationRecord> {
    const dateStr = params.date || this.getTodayBsDate();
    const all = await this.getAllDayOperations(dateStr);
    const now = Date.now();

    const updatedRecord: BranchDayOperationRecord = {
      id: `DAY_OP_${params.branchId}_${dateStr.replace(/[\/\-]/g, '_')}`,
      branchId: params.branchId,
      branchName: params.branchName || params.branchId.toUpperCase(),
      date: dateStr,
      status: 'live', // 🟢 Green - काम गर्दैछन् (Active)
      openedAt: now,
      openedBy: params.user?.id || params.user?.username || 'user',
      openedByName: params.user?.fullName || params.user?.username || 'कर्मचारी',
      openingCash: params.openingCash !== undefined ? Number(params.openingCash) : (all[params.branchId]?.openingCash || 0),
      remarks: params.remarks || 'दैनिक कारोबार सुरु गरियो।',
      isHoliday: false,
      updatedAt: now
    };

    all[params.branchId] = updatedRecord;
    await this.persistDayOperations(dateStr, all);

    try {
      window.dispatchEvent(new CustomEvent('branchDayStatusChanged', { detail: updatedRecord }));
    } catch {
      // ignore
    }

    return updatedRecord;
  },

  async closeDay(params: {
    branchId: string;
    branchName?: string;
    user: any;
    closingCash?: number;
    totalInflow?: number;
    totalOutflow?: number;
    totalVouchers?: number;
    remarks?: string;
    date?: string;
  }): Promise<BranchDayOperationRecord> {
    const dateStr = params.date || this.getTodayBsDate();
    const all = await this.getAllDayOperations(dateStr);
    const existing = all[params.branchId];
    const now = Date.now();

    const updatedRecord: BranchDayOperationRecord = {
      ...existing,
      id: `DAY_OP_${params.branchId}_${dateStr.replace(/[\/\-]/g, '_')}`,
      branchId: params.branchId,
      branchName: params.branchName || existing?.branchName || params.branchId.toUpperCase(),
      date: dateStr,
      status: 'end', // 🔴 Red - कारोबार बन्द (Closed & Locked)
      closedAt: now,
      closedBy: params.user?.id || params.user?.username || 'user',
      closedByName: params.user?.fullName || params.user?.username || 'कर्मचारी',
      closingCash: params.closingCash !== undefined ? Number(params.closingCash) : (existing?.closingCash || 0),
      totalInflow: params.totalInflow !== undefined ? Number(params.totalInflow) : existing?.totalInflow,
      totalOutflow: params.totalOutflow !== undefined ? Number(params.totalOutflow) : existing?.totalOutflow,
      totalVouchers: params.totalVouchers !== undefined ? Number(params.totalVouchers) : existing?.totalVouchers,
      remarks: params.remarks || 'दैनिक कारोबार बन्द गरी हेड अफिसमा सुरक्षित बुझाइयो।',
      updatedAt: now
    };

    all[params.branchId] = updatedRecord;
    await this.persistDayOperations(dateStr, all);

    try {
      window.dispatchEvent(new CustomEvent('branchDayStatusChanged', { detail: updatedRecord }));
    } catch {
      // ignore
    }

    return updatedRecord;
  },

  async reopenDay(params: {
    branchId: string;
    branchName?: string;
    adminUser: any;
    reason: string;
    date?: string;
  }): Promise<BranchDayOperationRecord> {
    const dateStr = params.date || this.getTodayBsDate();
    const all = await this.getAllDayOperations(dateStr);
    const existing = all[params.branchId];
    const now = Date.now();

    const updatedRecord: BranchDayOperationRecord = {
      ...existing,
      id: `DAY_OP_${params.branchId}_${dateStr.replace(/[\/\-]/g, '_')}`,
      branchId: params.branchId,
      branchName: params.branchName || existing?.branchName || params.branchId.toUpperCase(),
      date: dateStr,
      status: 'live', // 🟢 Re-opened back to Green
      reopenedAt: now,
      reopenedBy: params.adminUser?.id || params.adminUser?.username || 'admin',
      reopenedByName: params.adminUser?.fullName || params.adminUser?.username || 'हेड अफिस एडमिन',
      reopenReason: params.reason,
      updatedAt: now
    };

    all[params.branchId] = updatedRecord;
    await this.persistDayOperations(dateStr, all);

    try {
      window.dispatchEvent(new CustomEvent('branchDayStatusChanged', { detail: updatedRecord }));
    } catch {
      // ignore
    }

    return updatedRecord;
  },

  async setHolidayStatus(params: {
    branchId: string;
    branchName?: string;
    isHoliday: boolean;
    reason?: string;
    date?: string;
    adminUser?: any;
  }): Promise<BranchDayOperationRecord> {
    const dateStr = params.date || this.getTodayBsDate();
    const all = await this.getAllDayOperations(dateStr);
    const existing = all[params.branchId];
    const now = Date.now();

    const updatedRecord: BranchDayOperationRecord = {
      ...existing,
      id: `DAY_OP_${params.branchId}_${dateStr.replace(/[\/\-]/g, '_')}`,
      branchId: params.branchId,
      branchName: params.branchName || existing?.branchName || params.branchId.toUpperCase(),
      date: dateStr,
      status: params.isHoliday ? 'holiday' : 'open',
      isHoliday: params.isHoliday,
      holidayReason: params.isHoliday ? (params.reason || 'सार्वजनिक विदा (Holiday)') : undefined,
      updatedAt: now
    };

    all[params.branchId] = updatedRecord;
    await this.persistDayOperations(dateStr, all);

    try {
      window.dispatchEvent(new CustomEvent('branchDayStatusChanged', { detail: updatedRecord }));
    } catch {
      // ignore
    }

    return updatedRecord;
  },

  async persistDayOperations(dateStr: string, records: Record<string, BranchDayOperationRecord>): Promise<void> {
    // 1. Save to local storage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${dateStr}`, JSON.stringify(records));
      }
    } catch (e) {
      console.warn("Notice: Local storage save day operations:", e);
    }

    // 2. Save to Supabase Cloud
    const docId = `BRANCH_DAY_OPS_${dateStr}`;
    try {
      await supabase.from('daily_data').upsert({
        id: docId,
        date: dateStr,
        branch_id: 'main',
        data: { records }
      });
    } catch (e) {
      console.warn("Notice: Supabase save day operations:", e);
    }
  }
};
