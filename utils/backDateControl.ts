import NepaliDate from 'nepali-date-converter';
import { SystemSettings } from '../types';

export function getTodayBsDateStr(): string {
  try {
    return new NepaliDate(new Date()).format('YYYY-MM-DD');
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export function toNormalizedBsDateStr(dateStr?: string | null): string {
  if (!dateStr) return getTodayBsDateStr();
  const clean = dateStr.trim().replace(/\//g, '-');
  if (!clean) return getTodayBsDateStr();

  try {
    const parts = clean.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [y, m, d] = parts;
      if (y > 2070) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      if (y >= 1970 && y <= 2070) {
        return new NepaliDate(new Date(y, m - 1, d)).format('YYYY-MM-DD');
      }
    }
    return new NepaliDate(new Date(clean)).format('YYYY-MM-DD');
  } catch {
    return clean;
  }
}

export function getStoredSystemSettings(): SystemSettings | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('ZEN_AUTH_SETTINGS') || localStorage.getItem('saccos_db_settings');
    if (!raw) return null;
    return JSON.parse(raw) as SystemSettings;
  } catch {
    return null;
  }
}

export function isBackDateEntryAllowed(settings?: SystemSettings | null): boolean {
  const effective = settings || getStoredSystemSettings();
  if (!effective || typeof effective.allowBackDateEntry === 'undefined') {
    return true;
  }
  return effective.allowBackDateEntry !== false;
}

export function isBackDate(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const targetBs = toNormalizedBsDateStr(dateStr);
  const todayBs = getTodayBsDateStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetBs) || !/^\d{4}-\d{2}-\d{2}$/.test(todayBs)) {
    return false;
  }
  return targetBs < todayBs;
}

export function isFutureDate(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const targetBs = toNormalizedBsDateStr(dateStr);
  const todayBs = getTodayBsDateStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetBs) || !/^\d{4}-\d{2}-\d{2}$/.test(todayBs)) {
    return false;
  }
  return targetBs > todayBs;
}

export function isNonTodayDate(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const targetBs = toNormalizedBsDateStr(dateStr);
  const todayBs = getTodayBsDateStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetBs) || !/^\d{4}-\d{2}-\d{2}$/.test(todayBs)) {
    return false;
  }
  return targetBs !== todayBs;
}

export function isBackDateBlockedForEntry(dateStr?: string | null, settings?: SystemSettings | null): boolean {
  if (isBackDateEntryAllowed(settings)) return false;
  return isNonTodayDate(dateStr);
}

export function getBackDateBlockedMessage(dateStr?: string | null): string {
  const targetBs = toNormalizedBsDateStr(dateStr);
  const todayBs = getTodayBsDateStr();
  return `Entry for ${targetBs} is not allowed. Only today's date (${todayBs}) is permitted. (कृपया आजको मिति ${todayBs} मात्र प्रयोग गर्नुहोस्।)`;
}
