import { useEffect, useState } from 'react';
import { Branch, SystemSettings } from '../types';
import { getTodayBsDateStr, toNormalizedBsDateStr } from './backDateControl';

interface BranchStatusRecord {
  status?: string;
  dateBs?: string;
  notes?: string;
  updatedAt?: number;
  headOfficeOpenedAfterAllEndAt?: number;
}

export interface DayCycleMetaRecord {
  dateBs?: string;
  headOfficeOpenedAfterAllEndAt?: number;
}

export interface DayOpenCheckResult {
  allowed: boolean;
  reason?: string;
  pendingBranches?: string[];
  unlockedBy?: 'not_ended' | 'calendar_changed' | 'special_access' | 'head_office_cycle';
}

export const CYCLE_META_KEY = '__cycleMeta';

export function normalizeLockBranchId(branchId?: string | null): string {
  const b = (branchId || '').toString().trim().toLowerCase();
  if (
    !b ||
    b === 'main' ||
    b === 'c01' ||
    b === 'head_office' ||
    b === 'headoffice' ||
    b === 'head office' ||
    b.includes('ratauli')
  ) {
    return 'main';
  }
  if (b === 'sahodba' || b === 'c02' || b.includes('sahodba')) return 'sahodba';
  if (b === 'pipra' || b === 'c03' || b.includes('pipra')) return 'pipra';
  if (b === 'parsa' || b === 'c04' || b.includes('parsa')) return 'parsa';
  return b;
}

export function getActiveBranchIdForLock(): string {
  try {
    if (typeof localStorage === 'undefined') return 'main';
    const active = localStorage.getItem('ZEN_ACTIVE_BRANCH_ID');
    if (active && active.trim()) {
      return normalizeLockBranchId(active);
    }
    const authUserRaw = localStorage.getItem('ZEN_AUTH_USER');
    if (authUserRaw) {
      const parsed = JSON.parse(authUserRaw);
      if (parsed?.branchId) {
        return normalizeLockBranchId(parsed.branchId);
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return 'main';
}

export function getDayEndedBlockMessage(): string {
  return 'Day Closed: End Day has been completed. All data entry forms are locked until Day Open is activated.';
}

export function isSpecialDayReopenAllowed(settingsOverride?: Partial<SystemSettings> | null): boolean {
  if (settingsOverride && typeof settingsOverride.allowDayReopenSpecialAccess === 'boolean') {
    return settingsOverride.allowDayReopenSpecialAccess;
  }
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw =
      localStorage.getItem('ZEN_AUTH_SETTINGS') ||
      localStorage.getItem('saccos_db_settings');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<SystemSettings>;
    return parsed?.allowDayReopenSpecialAccess === true;
  } catch {
    return false;
  }
}

export function getStoredBranchStatusRecords(): Record<string, BranchStatusRecord> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem('saccos_db_branch_manual_statuses');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BranchStatusRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getStoredDayCycleMeta(): DayCycleMetaRecord | null {
  try {
    const all = getStoredBranchStatusRecords();
    const meta = all[CYCLE_META_KEY];
    if (!meta || typeof meta !== 'object') return null;
    return {
      dateBs: meta.dateBs ? toNormalizedBsDateStr(meta.dateBs) : undefined,
      headOfficeOpenedAfterAllEndAt: typeof meta.headOfficeOpenedAfterAllEndAt === 'number'
        ? meta.headOfficeOpenedAfterAllEndAt
        : undefined
    };
  } catch {
    return null;
  }
}

export function isDayEndedForBranch(branchId?: string | null): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const parsed = getStoredBranchStatusRecords();
    const todayBs = getTodayBsDateStr();
    const targetNorm = branchId ? normalizeLockBranchId(branchId) : getActiveBranchIdForLock();
    const activeNorm = getActiveBranchIdForLock();

    for (const [key, rec] of Object.entries(parsed)) {
      if (key === CYCLE_META_KEY) continue;
      if (!rec || !rec.status) continue;
      const recDateBs = rec.dateBs ? toNormalizedBsDateStr(rec.dateBs) : '';
      if (recDateBs !== todayBs) continue;

      const upperStatus = String(rec.status).trim().toUpperCase();
      if (upperStatus !== 'END' && upperStatus !== 'CLOSED') continue;

      const keyNorm = normalizeLockBranchId(key);
      if (
        keyNorm === targetNorm ||
        keyNorm === activeNorm ||
        (branchId && key.toLowerCase() === branchId.toLowerCase())
      ) {
        return true;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return false;
}

export function canPerformDayOpen(params: {
  targetBranchId: string;
  branches: Branch[];
  branchStatuses: Record<string, string>;
  settings?: Partial<SystemSettings> | null;
}): DayOpenCheckResult {
  const { targetBranchId, branches, branchStatuses, settings } = params;
  const todayBs = getTodayBsDateStr();
  const targetNorm = normalizeLockBranchId(targetBranchId);
  const storedRecords = getStoredBranchStatusRecords();

  // Find stored record for target branch matching today's BS date
  let targetTodayEndRecord: BranchStatusRecord | null = null;
  for (const [key, rec] of Object.entries(storedRecords)) {
    if (key === CYCLE_META_KEY || !rec) continue;
    if (normalizeLockBranchId(key) === targetNorm || key.toLowerCase() === targetBranchId.toLowerCase()) {
      const recDateBs = rec.dateBs ? toNormalizedBsDateStr(rec.dateBs) : '';
      if (recDateBs === todayBs) {
        targetTodayEndRecord = rec;
        break;
      }
    }
  }

  const targetStatusFromState = String(branchStatuses[targetNorm] || branchStatuses[targetBranchId] || '').trim().toUpperCase();
  const targetStatusFromRec = String(targetTodayEndRecord?.status || '').trim().toUpperCase();
  const isTargetEndedToday =
    targetStatusFromRec === 'END' ||
    targetStatusFromRec === 'CLOSED' ||
    targetStatusFromState === 'END' ||
    targetStatusFromState === 'CLOSED';

  // Rule 1: Calendar date changed (no END record exists for today's BS date)
  if (!isTargetEndedToday) {
    const hadPreviousEnd = Object.entries(storedRecords).some(([key, rec]) => {
      if (key === CYCLE_META_KEY || !rec?.status) return false;
      const sameBranch = normalizeLockBranchId(key) === targetNorm;
      const st = String(rec.status).trim().toUpperCase();
      const dt = rec.dateBs ? toNormalizedBsDateStr(rec.dateBs) : '';
      return sameBranch && (st === 'END' || st === 'CLOSED') && dt !== '' && dt !== todayBs;
    });
    return {
      allowed: true,
      unlockedBy: hadPreviousEnd ? 'calendar_changed' : 'not_ended'
    };
  }

  // Rule 2: Super Admin Special Access Override enabled in System Settings
  if (isSpecialDayReopenAllowed(settings)) {
    return {
      allowed: true,
      unlockedBy: 'special_access'
    };
  }

  // Build deduplicated list of active branches (defaulting to standard 4 if empty)
  const fallbackBranches: Array<{ normId: string; name: string }> = [
    { normId: 'main', name: 'Ratauli Head Office' },
    { normId: 'sahodba', name: 'Sahodba Branch' },
    { normId: 'pipra', name: 'Pipra Branch' },
    { normId: 'parsa', name: 'Parsa Branch' }
  ];

  const branchMap = new Map<string, string>();
  fallbackBranches.forEach(b => branchMap.set(b.normId, b.name));
  (branches || []).forEach(b => {
    if (!b) return;
    if (b.status === 'Inactive') return;
    const norm = normalizeLockBranchId(b.id || b.name);
    branchMap.set(norm, b.name || norm.toUpperCase());
  });

  const getBranchTodayEndRecord = (normId: string): { isEnded: boolean; status: string; updatedAt: number } => {
    for (const [key, rec] of Object.entries(storedRecords)) {
      if (key === CYCLE_META_KEY || !rec) continue;
      if (normalizeLockBranchId(key) === normId) {
        const recDateBs = rec.dateBs ? toNormalizedBsDateStr(rec.dateBs) : '';
        if (recDateBs === todayBs && rec.status) {
          const st = String(rec.status).trim().toUpperCase();
          return {
            isEnded: st === 'END' || st === 'CLOSED',
            status: st,
            updatedAt: Number(rec.updatedAt || 0)
          };
        }
      }
    }
    const stateStatus = String(branchStatuses[normId] || '').trim().toUpperCase();
    return {
      isEnded: stateStatus === 'END' || stateStatus === 'CLOSED',
      status: stateStatus || 'OPEN',
      updatedAt: 0
    };
  };

  // Rule 3A: Head Office ('main') can perform Day Open ONLY after EVERY active branch has completed Day End today
  if (targetNorm === 'main') {
    const pendingBranches: string[] = [];
    branchMap.forEach((name, normId) => {
      const info = getBranchTodayEndRecord(normId);
      if (!info.isEnded) {
        pendingBranches.push(name);
      }
    });

    if (pendingBranches.length > 0) {
      return {
        allowed: false,
        pendingBranches,
        reason: 'Branch End Day Pending'
      };
    }

    return {
      allowed: true,
      unlockedBy: 'head_office_cycle'
    };
  }

  // Rule 3B: Sub-branches can perform Day Open ONLY after all branches completed Day End AND Head Office performed Day Open first
  const cycleMeta = getStoredDayCycleMeta();
  const mainInfo = getBranchTodayEndRecord('main');
  const isMainCurrentlyOpen = mainInfo.status === 'OPEN' || mainInfo.status === 'LIVE';
  const branchEndTs = Number(targetTodayEndRecord?.updatedAt || 0);
  const headOfficeCycleTs = cycleMeta?.dateBs === todayBs ? Number(cycleMeta.headOfficeOpenedAfterAllEndAt || 0) : 0;

  if (headOfficeCycleTs > 0 && isMainCurrentlyOpen && headOfficeCycleTs >= branchEndTs) {
    return {
      allowed: true,
      unlockedBy: 'head_office_cycle'
    };
  }

  // Gather helpful pending list so operator knows exact next step
  const pendingBranches: string[] = [];
  branchMap.forEach((name, normId) => {
    const info = getBranchTodayEndRecord(normId);
    if (!info.isEnded) {
      pendingBranches.push(name);
    }
  });

  if (pendingBranches.length > 0 && !isMainCurrentlyOpen) {
    return {
      allowed: false,
      pendingBranches,
      reason: 'Head Office Open Day Pending'
    };
  }

  return {
    allowed: false,
    reason: 'Head Office Open Day Pending'
  };
}

export function notifyDayEndBlocked(branchId?: string | null): string {
  const message = getDayEndedBlockMessage();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('dayEndEntryBlocked', {
        detail: {
          message,
          branchId: branchId || getActiveBranchIdForLock()
        }
      })
    );
  }
  return message;
}

export function assertDayNotEnded(branchId?: string | null): void {
  if (isDayEndedForBranch(branchId)) {
    const message = notifyDayEndBlocked(branchId);
    throw new Error(message);
  }
}

export function useDayEndLock(branchId?: string | null): boolean {
  const [locked, setLocked] = useState<boolean>(() => isDayEndedForBranch(branchId));

  useEffect(() => {
    const refresh = () => {
      setLocked(isDayEndedForBranch(branchId));
    };
    refresh();

    window.addEventListener('branchDayStatusChanged', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    const interval = setInterval(refresh, 10000);

    return () => {
      window.removeEventListener('branchDayStatusChanged', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      clearInterval(interval);
    };
  }, [branchId]);

  return locked;
}
