import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, 
  Search, Printer, Check, X, Edit3, Trash2, ArrowLeft, Sparkles,
  Mail, FileDown, Loader2, RefreshCw, Database, Copy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import NepaliDate from 'nepali-date-converter';
import { NepaliDatePicker } from './NepaliDatePicker';
import { storageService } from '../services/storageService';
import { sendAttendanceReportEmailApi } from '../services/pdfEmailService';
import { useAuth } from '../AuthContext';
import { Employee, Branch, AttendanceRecord, AttendanceStatus, User } from '../types';
import { 
  calculateNameSimilarity, 
  isSameEmployeeName, 
  cleanEmployeeCode 
} from '../services/nameMatcher';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { useDayEndLock, getDayEndedBlockMessage } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

// Default Cooperative Emblem SVG if logo is missing (clean, borderless)
const DefaultCoopEmblem: React.FC = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-800" fill="currentColor">
    <circle cx="50" cy="50" r="46" fill="#ecfdf5" />
    <path d="M50 20 L57 34 L72 34 L60 43 L65 57 L50 48 L35 57 L40 43 L28 34 L43 34 Z" fill="#044e29" />
    <path d="M28 70 C35 66 65 66 72 70 C65 74 35 74 28 70 Z" fill="#059669" />
    <text x="50" y="83" fontSize="7" fontWeight="900" textAnchor="middle" fill="#044e29">RATAULI SACCOS</text>
  </svg>
);

interface AttendanceModuleProps {
  employees: Employee[];
  branches: Branch[];
  currentBranch?: Branch | null;
  currentUser?: User | null;
}

const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// Helper to get today's BS date string YYYY-MM-DD
const getTodayBsString = (): string => {
  try {
    const nd = new NepaliDate();
    const y = nd.getYear();
    const m = String(nd.getMonth() + 1).padStart(2, '0');
    const d = String(nd.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '2083-05-15';
  }
};

// Calculate total days in a Nepali (BS) month
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

// Get details of a day in Nepali month (day name, weekend status, header formatted string)
const getBsDayInfo = (year: number, month1Indexed: number, day: number) => {
  try {
    const nd = new NepaliDate(year, month1Indexed - 1, day);
    const jsDate = nd.toJsDate();
    const dayOfWeekIdx = jsDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[dayOfWeekIdx] || 'Sun';
    // Saturday (6) and Sunday (0) are Weekend in standard schedule / template
    const isWeekend = dayOfWeekIdx === 6 || dayOfWeekIdx === 0;
    const dateStr = `${year}-${String(month1Indexed).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const colHeader = `${dateStr} (${dayName})`;
    return { dateStr, dayName, isWeekend, colHeader, dayOfWeekIdx, dayNumber: day };
  } catch {
    const dateStr = `${year}-${String(month1Indexed).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { dateStr, dayName: 'Day', isWeekend: false, colHeader: dateStr, dayOfWeekIdx: 0, dayNumber: day };
  }
};

// Helper to convert Excel time number, string, or Date to readable HH:MM AM/PM string
const formatExcelTime = (val: unknown): string => {
  if (val === undefined || val === null || val === '') return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    const h = val.getHours();
    const m = val.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  if (typeof val === 'number') {
    // Excel serial time where 1 = 24 hours
    const totalSeconds = Math.round(val * 86400);
    const hours24 = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }
  const str = String(val).trim();
  // If formatted like "09:30 AM" or "09:30"
  const match = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = match[2];
    const meridiem = match[3]?.toUpperCase();
    if (meridiem) {
      return `${String(h).padStart(2, '0')}:${m} ${meridiem}`;
    }
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
  }
  return str;
};

// Calculate work hours between inTime and outTime
const calculateWorkHours = (inTime?: string, outTime?: string): number | undefined => {
  if (!inTime || !outTime) return undefined;
  try {
    const parseTimeToMinutes = (t: string): number | null => {
      const match = t.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };
    const inMin = parseTimeToMinutes(inTime);
    const outMin = parseTimeToMinutes(outTime);
    if (inMin !== null && outMin !== null && outMin >= inMin) {
      const diffHrs = (outMin - inMin) / 60;
      return Math.round(diffHrs * 10) / 10;
    }
  } catch {
    // ignore
  }
  return undefined;
};

// Robust Date Normalizer: Converts Excel serial dates, AD dates, and BS dates to standardized YYYY-MM-DD in BS
const normalizeToBsDate = (val: unknown, fallbackYear = 2083, fallbackMonth = 4): string | null => {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    try {
      const nep = new NepaliDate(val);
      const y = nep.getYear();
      const m = String(nep.getMonth() + 1).padStart(2, '0');
      const d = String(nep.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch {
      return null;
    }
  }

  // If numeric Excel date serial (e.g. 20000 - 60000)
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    try {
      const jsMillis = Math.round((val - 25569) * 86400 * 1000);
      const jsDate = new Date(jsMillis);
      const nep = new NepaliDate(jsDate);
      const y = nep.getYear();
      const m = String(nep.getMonth() + 1).padStart(2, '0');
      const d = String(nep.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch {
      return null;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (even if followed by (Mon) or weekday label)
  const matchYMD = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (matchYMD) {
    const y = parseInt(matchYMD[1], 10);
    const m = String(parseInt(matchYMD[2], 10)).padStart(2, '0');
    const d = String(parseInt(matchYMD[3], 10)).padStart(2, '0');
    if (y >= 2000 && y <= 2120) {
      if (y >= 2070) {
        return `${y}-${m}-${d}`;
      } else {
        try {
          const jsDate = new Date(y, parseInt(m, 10) - 1, parseInt(d, 10));
          const nep = new NepaliDate(jsDate);
          const bsY = nep.getYear();
          const bsM = String(nep.getMonth() + 1).padStart(2, '0');
          const bsD = String(nep.getDate()).padStart(2, '0');
          return `${bsY}-${bsM}-${bsD}`;
        } catch {
          return `${y}-${m}-${d}`;
        }
      }
    }
  }

  // Check DD-MM-YYYY or MM-DD-YYYY
  const matchDMY = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (matchDMY) {
    const y = parseInt(matchDMY[3], 10);
    const p1 = parseInt(matchDMY[1], 10);
    const p2 = parseInt(matchDMY[2], 10);
    if (y >= 2070) {
      const m = p1 <= 12 && p2 > 12 ? String(p1).padStart(2, '0') : String(p2).padStart(2, '0');
      const d = p1 <= 12 && p2 > 12 ? String(p2).padStart(2, '0') : String(p1).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else if (y >= 2000) {
      try {
        const jsDate = new Date(y, p2 - 1, p1);
        const nep = new NepaliDate(jsDate);
        return `${nep.getYear()}-${String(nep.getMonth() + 1).padStart(2, '0')}-${String(nep.getDate()).padStart(2, '0')}`;
      } catch {
        // fallback
      }
    }
  }

  // Day only number (1 to 32)
  const matchDayOnly = str.match(/^0?([1-9]|[12][0-9]|3[0-2])$/);
  if (matchDayOnly) {
    const dInt = parseInt(matchDayOnly[1], 10);
    return `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-${String(dInt).padStart(2, '0')}`;
  }

  return null;
};

// Robust Day Column Header Inspector: Matches day numbers (1..32), "1(Sun)", "Day 1", "01/04", or full dates like "2083-05-01 (Mon)"
const parseDayFromHeaderCell = (val: unknown): { dayNumber: number; dateBs?: string } | null => {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    try {
      const nep = new NepaliDate(val);
      const bsY = nep.getYear();
      const bsM = nep.getMonth() + 1;
      const bsD = nep.getDate();
      return { dayNumber: bsD, dateBs: `${bsY}-${String(bsM).padStart(2, '0')}-${String(bsD).padStart(2, '0')}` };
    } catch {
      return { dayNumber: val.getDate() };
    }
  }

  const nepaliDigitsMap: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  const str = String(val).replace(/[०-९]/g, d => nepaliDigitsMap[d] || d).trim();
  if (!str) return null;

  // 1. Full date in cell: 2083-05-01 (Mon), 2083-04-01, 2081/04/01, etc.
  const fullDateMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (fullDateMatch) {
    const y = parseInt(fullDateMatch[1], 10);
    const m = parseInt(fullDateMatch[2], 10);
    const d = parseInt(fullDateMatch[3], 10);
    if (y >= 2000 && y <= 2120 && m >= 1 && m <= 12 && d >= 1 && d <= 32) {
      const formattedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { dayNumber: d, dateBs: formattedDate };
    }
  }

  const fullDate = normalizeToBsDate(str);
  if (fullDate) {
    const parts = fullDate.split('-');
    if (parts.length === 3) {
      const dNum = parseInt(parts[2], 10);
      if (dNum >= 1 && dNum <= 32) {
        return { dayNumber: dNum, dateBs: fullDate };
      }
    }
  }

  // 2. Pure day number: 1..32 or 01..32
  const pureNumMatch = str.match(/^0?([1-9]|[12][0-9]|3[0-2])$/);
  if (pureNumMatch) {
    return { dayNumber: parseInt(pureNumMatch[1], 10) };
  }

  // 3. Day with weekday label: e.g. "1(Sun)", "1 (Sun)", "1-Sun", "1 Sun", "1 (आइत)", "Sun 1", "Sun-1", "01-Sun", "01 (Mon)"
  const dayWithLabelMatch = str.match(/(?:^|\b)0?([1-9]|[12][0-9]|3[0-2])(?:\s*[\-_()]\s*[A-Za-z\u0900-\u097F]+|\s+[A-Za-z\u0900-\u097F]+|\([^\)]+\))?$/);
  if (dayWithLabelMatch) {
    const num = parseInt(dayWithLabelMatch[1], 10);
    if (num >= 1 && num <= 32) {
      return { dayNumber: num };
    }
  }

  // 4. "Day 1", "Day 01", "D1", "D01", "दिन १"
  const dayPrefixMatch = str.match(/^(?:day|d|दिन)\s*0?([1-9]|[12][0-9]|3[0-2])$/i);
  if (dayPrefixMatch) {
    return { dayNumber: parseInt(dayPrefixMatch[1], 10) };
  }

  // 5. Month/Day or Day/Month format like "04/01", "04-01", "01/04", "05-01 (Mon)"
  const mAndDMatch = str.match(/(\d{1,2})[-/.](\d{1,2})/);
  if (mAndDMatch) {
    const p1 = parseInt(mAndDMatch[1], 10);
    const p2 = parseInt(mAndDMatch[2], 10);
    const day = (p1 <= 12 && p2 > 12) ? p2 : (p2 <= 12 && p1 > 12 ? p1 : p2);
    if (day >= 1 && day <= 32) {
      return { dayNumber: day };
    }
  }

  return null;
};

// Festival and Public Holiday keywords (National & Nepali festive calendar)
const FESTIVAL_KEYWORDS = [
  'श्रीकृष्ण जन्माष्टमी', 'जन्माष्टमी', 'कृष्ण जन्माष्टमी', 'krishna janmashtami', 'janmashtami',
  'दशैं', 'दशै', 'dashain', 'विजयादशमी', 'घटस्थापना',
  'तिहार', 'tihar', 'दीपावली', 'दीवाली', 'लक्ष्मीपूजा', 'गोवर्धन पूजा', 'भाइटिका', 'bhai tika',
  'छठ', 'chhath',
  'माघे संक्रान्ति', 'मकर संक्रान्ति', 'maghe sankranti',
  'शिवरात्री', 'महाशिवरात्री', 'shivaratri', 'maha shivaratri',
  'फागु पूर्णिमा', 'होली', 'holi', 'fagu purnima',
  'बुद्ध जयन्ती', 'buddha jayanti',
  'तीज', 'teej', 'हरितालिका', 'ऋषि पञ्चमी',
  'इन्द्रजात्रा', 'indra jatra',
  'गाईजात्रा', 'gai jatra',
  'घोडेजात्रा', 'ghode jatra',
  'नेपाल संवत्', 'nepal sambat',
  'ल्होसार', 'लोसार', 'lhosar',
  'क्रिसमस', 'christmas',
  'उभौली', 'उधौली', 'ubhauli', 'udhauli',
  'प्रजातन्त्र दिवस', 'democracy day',
  'संविधान दिवस', 'constitution day',
  'गणतन्त्र दिवस', 'republic day',
  'शहीद दिवस', 'martyrs day',
  'मजदुर दिवस', 'may day', 'labour day', 'labor day',
  'महिला दिवस', 'womens day',
  'नयाँ वर्ष', 'new year', 'बैशाख १', 'baisakh 1',
  'गुरु पूर्णिमा', 'जनै पूर्णिमा', 'रक्षा बन्धन',
  'सार्वजनिक बिदा', 'holiday', 'public holiday'
];

interface ParsedCellData {
  status: AttendanceStatus;
  inTime?: string;
  outTime?: string;
  workHours?: number;
  remarks?: string;
}

// Helper to extract content enclosed in () or []
const extractBracketContent = (str: string): string | null => {
  const match = str.match(/\(([^)]+)\)|\[([^\]]+)\]/);
  return match ? (match[1] || match[2]).trim() : null;
};

// Helper to strip content in () or []
const stripBracketContent = (str: string): string => {
  return str.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
};

// Intelligent Attendance Cell Parser - handles complex biometric formats:
// Holiday(श्रीकृष्ण जन्माष्टमी), Branch Visit(00:00 | 00:00), HalfPresent(09:26 | 13:00), Absent(00:00 | 00:00), Weekend
const parseAttendanceCell = (cellVal: unknown): ParsedCellData => {
  const raw = String(cellVal ?? '').trim();
  if (!raw || raw === '-' || raw === '--' || raw === 'N/A') {
    return { status: 'Present' };
  }

  const lower = raw.toLowerCase();

  // 1. Holiday / Festival Detection (e.g. Holiday(श्रीकृष्ण जन्माष्टमी), Holiday (श्रीकृष्ण जन्माष्टमी), सार्वजनिक बिदा, श्रीकृष्ण जन्माष्टमी)
  const isHolidayKeyword = 
    lower.includes('holiday') || 
    lower.includes('सार्वजनिक') || 
    lower.includes('public holiday') ||
    lower.includes('चाडपर्व') ||
    lower.includes('राष्ट्रिय बिदा') ||
    lower === 'h' ||
    lower.startsWith('h(') ||
    FESTIVAL_KEYWORDS.some(k => lower.includes(k.toLowerCase()));

  if (isHolidayKeyword) {
    let remarks: string | undefined = undefined;
    const inside = extractBracketContent(raw);
    if (inside) {
      if (!/^holiday|सार्वजनिक/i.test(inside)) {
        remarks = inside;
      } else {
        const outside = stripBracketContent(raw);
        if (outside) remarks = outside;
      }
    } else {
      const sepMatch = raw.match(/(?:holiday|सार्वजनिक बिदा|बिदा)\s*[-:]\s*(.+)/i);
      if (sepMatch) {
        remarks = sepMatch[1].trim();
      } else {
        const matchedFest = FESTIVAL_KEYWORDS.find(k => lower.includes(k.toLowerCase()) && !/holiday|सार्वजनिक|बिदा/.test(k));
        if (matchedFest) {
          remarks = matchedFest;
        } else if (raw !== 'Holiday' && raw !== 'H' && raw !== 'सार्वजनिक बिदा' && raw !== 'सार्वजनिक') {
          remarks = raw;
        }
      }
    }
    return { status: 'Holiday', remarks, workHours: 0 };
  }

  // 2. Weekend / Weekly Off
  if (lower.includes('weekend') || lower.includes('weekly off') || lower === 'wo' || lower.includes('शनिबार') || lower === 'off') {
    let remarks: string | undefined = undefined;
    const inside = extractBracketContent(raw);
    if (inside && !/^\d{1,2}:\d{2}/.test(inside)) {
      remarks = inside;
    }
    return { status: 'Weekly Off', remarks, workHours: 0 };
  }

  // 3. Official Visits / Field Work / Deputation (e.g. Branch Visit(00:00 | 00:00) or Field Visit)
  const isDutyVisit = /branch\s*visit|field\s*visit|field\s*work|official\s*visit|काज|deputation|भ्रमण/i.test(lower);
  if (isDutyVisit) {
    const label = stripBracketContent(raw) || 'Branch Visit';
    let inTime: string | undefined = undefined;
    let outTime: string | undefined = undefined;

    const timeMatch = raw.match(/(\d{1,2}:\d{2})\s*[|\-,/]\s*(\d{1,2}:\d{2})/);
    if (timeMatch && timeMatch[1] !== '00:00') {
      inTime = timeMatch[1];
      outTime = timeMatch[2];
    }
    const workHours = inTime && outTime ? calculateWorkHours(inTime, outTime) : 8;
    return { status: 'Present', inTime, outTime, workHours, remarks: label };
  }

  // 4. Half Day / Half Present (e.g. HalfPresent(09:26 | 13:00))
  if (/half\s*present|half\s*day|आधा\s*दिन|hd/i.test(lower)) {
    let inTime: string | undefined = undefined;
    let outTime: string | undefined = undefined;
    const timeMatch = raw.match(/(\d{1,2}:\d{2})\s*[|\-,/]\s*(\d{1,2}:\d{2})/);
    if (timeMatch) {
      inTime = timeMatch[1];
      outTime = timeMatch[2];
    } else {
      const singleMatch = raw.match(/(\d{1,2}:\d{2})/);
      if (singleMatch) inTime = singleMatch[1];
    }
    const workHours = calculateWorkHours(inTime, outTime);
    return { status: 'Half Day', inTime, outTime, workHours: workHours && workHours > 0 ? workHours : 4, remarks: 'Half Present' };
  }

  // 5. Absent (e.g. Absent(00:00 | 00:00) or Absent)
  if (/^absent|गैरहाजिर|^a$|^ab$/i.test(lower) || lower.startsWith('absent(')) {
    let remarks: string | undefined = undefined;
    const inside = extractBracketContent(raw);
    if (inside && !/00:00/.test(inside) && !/\d{1,2}:\d{2}/.test(inside)) {
      remarks = inside;
    }
    return { status: 'Absent', workHours: 0, remarks };
  }

  // 6. Leave (e.g. Leave(Casual Leave) or On Leave)
  if (lower.includes('leave') || lower.includes('बिदा') || lower === 'cl' || lower === 'sl' || lower === 'l' || lower === 'lv') {
    let remarks: string | undefined = undefined;
    const inside = extractBracketContent(raw);
    if (inside) remarks = inside;
    return { status: 'On Leave', workHours: 0, remarks };
  }

  // 7. Regular In/Out Timings (e.g. "10:47 | 17:26", "09:00:12 | 18:04:30", "09:00\n18:04")
  let inTime: string | undefined = undefined;
  let outTime: string | undefined = undefined;
  let status: AttendanceStatus = 'Present';

  const dualMatch = raw.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[|\-,/\n\r]+|\s+)\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (dualMatch) {
    inTime = dualMatch[1].slice(0, 5);
    outTime = dualMatch[2].slice(0, 5);
  } else {
    const singleMatch = raw.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (singleMatch) inTime = singleMatch[1].slice(0, 5);
  }

  if (inTime) {
    const [hStr, mStr] = inTime.split(':');
    const hr = parseInt(hStr, 10);
    const mn = parseInt(mStr, 10);
    const totalMin = hr * 60 + mn;
    status = totalMin > 570 ? 'Late' : 'Present';
  }

  let remarks: string | undefined = undefined;
  const inside = extractBracketContent(raw);
  if (inside && !/\d{1,2}:\d{2}/.test(inside)) {
    remarks = inside;
  }

  const workHours = calculateWorkHours(inTime, outTime);
  return { status, inTime, outTime, workHours, remarks };
};

// Normalize status string to AttendanceStatus enum
const normalizeStatus = (rawStatus: string, hasInTime: boolean): AttendanceStatus => {
  if (!rawStatus) return hasInTime ? 'Present' : 'Absent';
  const s = rawStatus.toLowerCase().trim();
  if (s === 'p' || s === 'present' || s === 'हाजिर' || s === 'pr' || s === 'yes') return 'Present';
  if (s === 'a' || s === 'absent' || s === 'गैरहाजिर' || s === 'ab' || s === 'no' || s.startsWith('absent(')) return 'Absent';
  if (s === 'l' || s === 'late' || s === 'ढिलो' || s === 'lt') return 'Late';
  if (s === 'hd' || s === 'half day' || s === 'halfday' || s === 'half-day' || s === 'आधा दिन' || s.includes('halfpresent')) return 'Half Day';
  if (s === 'lv' || s === 'leave' || s === 'on leave' || s === 'बिदा' || s === 'cl' || s === 'sl' || s === 'al') return 'On Leave';
  if (
    s === 'h' || 
    s.includes('holiday') || 
    s.includes('सार्वजनिक') || 
    s === 'hol' || 
    FESTIVAL_KEYWORDS.some(k => s.includes(k.toLowerCase()))
  ) return 'Holiday';
  if (s === 'wo' || s === 'off' || s === 'weekly off' || s === 'शनिबार' || s.includes('weekend')) return 'Weekly Off';
  
  if (hasInTime) return 'Present';
  return 'Present';
};

// Helper to identify if a row name, employee code, or text represents a Holiday/Festival rather than an actual employee
const isHolidayEntity = (text: unknown): boolean => {
  if (!text) return false;
  const s = String(text).trim().toLowerCase();
  if (!s) return false;
  return (
    s.startsWith('holiday') ||
    s.includes('holiday(') ||
    s.includes('holiday [') ||
    s.includes('holiday -') ||
    s.includes('holiday:') ||
    s.includes('सार्वजनिक') ||
    s.includes('बिदा(') ||
    s.includes('public holiday') ||
    s.startsWith('h(') ||
    s.startsWith('hol(') ||
    s === 'holiday' ||
    s === 'public holiday' ||
    s === 'सार्वजनिक बिदा' ||
    s === 'बिदा' ||
    s === 'festival' ||
    s === 'festivals' ||
    FESTIVAL_KEYWORDS.some(k => s.includes(k.toLowerCase()))
  );
};

// Helper to extract clean holiday/festival name from strings like "Holiday(श्रीकृष्ण जन्माष्टमी)"
const extractHolidayRemark = (rawText: unknown): string => {
  if (!rawText) return 'सार्वजनिक बिदा';
  const text = String(rawText).trim();
  const inside = extractBracketContent(text);
  if (inside) {
    if (!/^holiday|सार्वजनिक\s*बिदा/i.test(inside)) {
      return inside;
    }
  }
  const sepMatch = text.match(/(?:holiday|बिदा|सार्वजनिक)\s*[-:]\s*([^\s-:][\s\S]*)/i);
  if (sepMatch && sepMatch[1].trim()) {
    return sepMatch[1].trim();
  }
  for (const kw of FESTIVAL_KEYWORDS) {
    if (text.toLowerCase().includes(kw.toLowerCase()) && !/^(holiday|सार्वजनिक बिदा|public holiday)$/i.test(kw)) {
      return kw;
    }
  }
  const clean = text.replace(/^holiday\s*[-:_]?\s*/i, '').replace(/[()[\]]/g, '').trim();
  return clean || 'सार्वजनिक बिदा';
};

// Standard branches with priority order: Head Office (1), Sahobda (2), Pipra (3), Parsa (4)
const STANDARD_BRANCHES: Branch[] = [
  { id: 'main', name: 'Ratauli Head Office', code: 'C01', location: 'Ratauli', status: 'Active', createdAt: 1700000000000 },
  { id: 'sahodba', name: 'Sahobda Branch', code: 'C02', location: 'Sahobda', status: 'Active', createdAt: 1700000000001 },
  { id: 'pipra', name: 'Pipra Branch', code: 'C03', location: 'Pipra', status: 'Active', createdAt: 1700000000002 },
  { id: 'parsa', name: 'Parsa Branch', code: 'C04', location: 'Parsa', status: 'Active', createdAt: 1700000000003 },
];

const getBranchRank = (branchIdOrName?: string): number => {
  if (!branchIdOrName) return 1; // Default to Head Office
  const s = String(branchIdOrName).trim().toLowerCase();

  // 1. Head Office (main / C01 / Ratauli Head Office)
  if (
    s === 'main' || 
    s === 'c01' || 
    s.includes('head') || 
    s.includes('office') || 
    s.includes('ratauli') || 
    s.includes('केन्द्रिय') || 
    s.includes('केन्द्रीय')
  ) {
    return 1;
  }

  // 2. Sahobda / Sahodba Branch (C02)
  if (
    s === 'sahobda' || 
    s === 'sahodba' || 
    s === 'c02' || 
    s.includes('sahob') || 
    s.includes('sahod') || 
    s.includes('सहोब्दा') || 
    s.includes('सहोदबा')
  ) {
    return 2;
  }

  // 3. Pipra Branch (C03)
  if (
    s === 'pipra' || 
    s === 'c03' || 
    s.includes('pipra') || 
    s.includes('पिपरा')
  ) {
    return 3;
  }

  // 4. Parsa Branch (C04)
  if (
    s === 'parsa' || 
    s === 'c04' || 
    s.includes('parsa') || 
    s.includes('पर्सा')
  ) {
    return 4;
  }

  return 5;
};

const getEmployeeBranchRank = (emp: Employee, branchesList?: Branch[]): number => {
  if (emp.branchId) {
    if (branchesList && branchesList.length > 0) {
      const bObj = branchesList.find(b => b.id === emp.branchId || (b.code && b.code.toLowerCase() === emp.branchId.toLowerCase()));
      if (bObj) {
        const rName = getBranchRank(bObj.name);
        if (rName < 5) return rName;
        const rCode = getBranchRank(bObj.code);
        if (rCode < 5) return rCode;
      }
    }
    return getBranchRank(emp.branchId);
  }
  return 1; // default Head Office
};

const compareEmployees = (a: Employee, b: Employee, branchesList?: Branch[]): number => {
  const rankA = getEmployeeBranchRank(a, branchesList);
  const rankB = getEmployeeBranchRank(b, branchesList);

  // 1. Branch priority order: Head Office (1), Sahobda (2), Pipra (3), Parsa (4), Others (5)
  if (rankA !== rankB) {
    return rankA - rankB;
  }

  // 2. Head Office (rank 1): Employee ID in ascending order (EMP-001, EMP-002...)
  if (rankA === 1) {
    const getNum = (emp: Employee) => {
      const codeOrId = (emp.employeeCode && emp.employeeCode !== '-' ? emp.employeeCode : emp.id) || '';
      const match = codeOrId.match(/\d+/);
      return match ? parseInt(match[0], 10) : 999999;
    };
    const numA = getNum(a);
    const numB = getNum(b);
    if (numA !== numB) {
      return numA - numB;
    }
    const strA = (a.employeeCode || a.id || '').toLowerCase();
    const strB = (b.employeeCode || b.id || '').toLowerCase();
    if (strA !== strB) {
      return strA.localeCompare(strB, undefined, { numeric: true });
    }
    return (a.fullName || '').localeCompare(b.fullName || '');
  }

  // 3. Other branches (Sahobda, Pipra, Parsa, and other): Employee Name in ascending order (A to Z)
  const nameA = (a.fullName || '').trim().toLowerCase();
  const nameB = (b.fullName || '').trim().toLowerCase();
  return nameA.localeCompare(nameB);
};

// Helper to display count values cleanly with decimals if present (e.g., 18.5, 1.5, 0.5, 19, 0)
const formatDecimalCount = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  if (Number.isInteger(val)) return String(val);
  return Number(val.toFixed(1)).toString();
};

// Default reference staff matching official biometric matrix export
const DEFAULT_ATTENDANCE_STAFF: Employee[] = [
  { id: '1', fullName: 'CHANDRA SHEKHAR MANDAL', employeeCode: 'EMP-001', department: 'CREDIT', designation: 'SENIOR OFFICER', branchId: 'main' },
  { id: '2', fullName: 'AMIT KUMAR THAKUR', employeeCode: 'EMP-002', department: 'GENERAL', designation: 'MANAGER', branchId: 'main' },
  { id: '3', fullName: 'ROSHAN KUMAR MANDAL', employeeCode: 'EMP-003', department: 'MICRO FINANCE', designation: 'SR.ASSISTANT', branchId: 'main' },
  { id: '4', fullName: 'AMBUJ KUMAR JHA', employeeCode: 'EMP-004', department: 'ACCOUNT', designation: 'ACCOUNTANT', branchId: 'main' },
  { id: 'c6e60006-6666-4000-8000-000000000006', fullName: 'SUMIT KUMAR THAKUR', fullNameNepali: 'सुमित कुमार ठाकुर', employeeCode: '6', department: 'FIELD', designation: 'JR ASSISTANT', branchId: 'main' },
  { id: '6', fullName: 'CHANDANI KUMARI', employeeCode: 'EMP-006', department: 'TELLER', designation: 'TELLER', branchId: 'main' },
  { id: '7', fullName: 'KRISHNA KUMAR SAPHI', employeeCode: 'EMP-007', department: 'IT', designation: 'OFFICER', branchId: 'main' },
  { id: '8', fullName: 'KAMNI DEVI KARN', employeeCode: 'EMP-008', department: 'SUPPORT', designation: 'OFFICE ASSISTANT', branchId: 'main' },
];

// Helper to generate biometric monthly records exactly matching the user's reference image
const generateBiometricDemoRecords = (year: number, month: number, staffList: Employee[]): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const daysInMonth = getDaysInBsMonth(year, month);

  // Exact sample punch timing patterns from the reference biometric spreadsheet
  const sampleTimesByDay: Record<number, { in: string; out: string }> = {
    1: { in: '09:00', out: '16:14' },
    4: { in: '09:37', out: '18:56' },
    5: { in: '09:17', out: '17:31' },
    6: { in: '09:07', out: '17:33' },
    7: { in: '09:11', out: '18:10' },
    8: { in: '09:12', out: '16:47' },
    11: { in: '09:12', out: '17:51' },
    12: { in: '09:07', out: '17:24' },
    13: { in: '09:15', out: '17:40' },
    14: { in: '09:20', out: '17:30' },
    15: { in: '09:05', out: '16:50' },
    18: { in: '09:10', out: '17:45' },
    19: { in: '09:18', out: '17:35' },
    20: { in: '09:14', out: '17:20' },
    21: { in: '09:08', out: '17:38' },
    22: { in: '09:22', out: '16:55' },
    25: { in: '09:16', out: '17:42' },
    26: { in: '09:11', out: '17:28' },
    27: { in: '09:09', out: '17:33' },
    28: { in: '09:13', out: '17:40' },
    29: { in: '09:06', out: '16:48' }
  };

  staffList.forEach((emp, empIdx) => {
    for (let d = 1; d <= daysInMonth; d++) {
      const dInfo = getBsDayInfo(year, month, d);
      const dateBs = dInfo.dateStr;

      if (dInfo.isWeekend) {
        // In the reference image, Saturdays and Sundays are Weekend
        continue;
      }

      // Holiday matching user's actual excel sheet on 2083-05-12 (Fri): Holiday(श्रीकृष्ण जन्माष्टमी)
      if (month === 5 && d === 12) {
        records.push({
          id: `demo_${emp.id}_${d}`,
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: emp.fullName,
          date: dateBs,
          dateBs,
          status: 'Holiday',
          remarks: 'श्रीकृष्ण जन्माष्टमी',
          branchId: emp.branchId || 'main',
          source: 'excel_upload',
          createdAt: Date.now()
        });
        continue;
      }

      // Check for specific absent days matching the user reference
      const isAbsent = 
        (empIdx === 1 && (d === 13 || d === 20)) || // Amit Kumar Thakur: 2 absent days
        ((empIdx === 4 || emp.fullName.toUpperCase().includes('SUMIT')) && (d === 6 || d === 13 || d === 20 || d === 27)) || // Sumit Kumar Thakur: 4 absent days (absent on 2083-04-06 Wed)
        (empIdx === 7 && (d === 14 || d === 21)); // Kamani Devi Karn: 2 absent days

      if (isAbsent) {
        records.push({
          id: `demo_${emp.id}_${d}`,
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: emp.fullName,
          date: dateBs,
          dateBs,
          status: 'Absent',
          branchId: emp.branchId || 'main',
          source: 'excel_upload',
          createdAt: Date.now()
        });
      } else {
        const defaultPair = sampleTimesByDay[d] || { 
          in: `09:${String(10 + ((empIdx * 3 + d * 7) % 25)).padStart(2, '0')}`, 
          out: `17:${String(20 + ((empIdx * 5 + d * 3) % 35)).padStart(2, '0')}` 
        };
        const inTime = defaultPair.in;
        const outTime = defaultPair.out;

        records.push({
          id: `demo_${emp.id}_${d}`,
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: emp.fullName,
          date: dateBs,
          dateBs,
          inTime,
          outTime,
          workHours: calculateWorkHours(inTime, outTime),
          status: 'Late', // Check-ins after 09:00 AM count as Late in standard bank shifts
          branchId: emp.branchId || 'main',
          source: 'excel_upload',
          createdAt: Date.now()
        });
      }
    }
  });

  return records;
};

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  employees,
  branches,
  currentBranch
}) => {
  // Navigation: Upload vs Report
  const [activeTab, setActiveTab] = useState<'upload' | 'report'>('report');
  
  // Persistence state
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Upload Tab state
  const [parsedPreview, setParsedPreview] = useState<AttendanceRecord[]>([]);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [savingProgress, setSavingProgress] = useState<string>('');
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewEmployeesCount = useMemo(() => {
    return new Set(parsedPreview.map(p => p.employeeId)).size;
  }, [parsedPreview]);

  const filteredPreview = useMemo(() => {
    if (!previewSearch.trim()) return parsedPreview;
    const q = previewSearch.toLowerCase();
    return parsedPreview.filter(p => 
      p.employeeName.toLowerCase().includes(q) || 
      (p.employeeCode && p.employeeCode.toLowerCase().includes(q)) || 
      (p.dateBs && p.dateBs.includes(q)) || 
      (p.remarks && p.remarks.toLowerCase().includes(q))
    );
  }, [parsedPreview, previewSearch]);

  // Supabase Cloud Sync & SQL Verification state
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Auth & System Settings for Logo and Cooperative Details
  const { settings } = useAuth();
  const [systemSettings, setSystemSettings] = useState<any>(null);

  useEffect(() => {
    storageService.getSettings().then(s => {
      if (s) setSystemSettings(s);
    });
  }, []);

  const effectiveLogoUrl = useMemo(() => {
    if (systemSettings?.logoUrl) return systemSettings.logoUrl;
    if (settings?.logoUrl) return settings.logoUrl;
    try {
      const savedAuth = localStorage.getItem('ZEN_AUTH_SETTINGS');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed?.logoUrl) return parsed.logoUrl;
      }
      const savedDb = localStorage.getItem('zen_local_db_settings');
      if (savedDb) {
        const parsed = JSON.parse(savedDb);
        if (parsed?.logoUrl) return parsed.logoUrl;
      }
    } catch {
      // ignore
    }
    return '';
  }, [systemSettings, settings]);

  // Report Tab state - default to Monthly Matrix view matching reference image
  const [reportViewMode] = useState<'daily' | 'monthly' | 'employee'>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayBsString());
  const [selectedYear, setSelectedYear] = useState<number>(2083);
  const [selectedMonth, setSelectedMonth] = useState<number>(4); // Shrawan (Month 4) as in reference image
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const lockedBranchId = filterBranch !== 'ALL' ? filterBranch : currentBranch?.id;
  const isDayEnded = useDayEndLock(lockedBranchId);
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matrixDisplayFormat, setMatrixDisplayFormat] = useState<'timings' | 'status'>('timings');

  // Branch display name for header
  const selectedBranchDisplayName = useMemo(() => {
    if (filterBranch && filterBranch !== 'ALL') {
      const b = branches?.find(item => item.id === filterBranch);
      if (b?.name) return b.name;
      return filterBranch;
    }
    return currentBranch?.name || 'Ratauli Head Office';
  }, [filterBranch, branches, currentBranch]);

  // Target Year and Month for Upload
  const [uploadYear, setUploadYear] = useState<number>(2083);
  const [uploadMonth, setUploadMonth] = useState<number>(4);

  // PDF Export state
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Direct Email Sending state
  const [sendingEmailEmpId, setSendingEmailEmpId] = useState<string | null>(null);
  const [sentEmailSuccessEmpId, setSentEmailSuccessEmpId] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Batch Email state (Send All)
  const [isSendingBatch, setIsSendingBatch] = useState<boolean>(false);
  const [batchEmailProgress, setBatchEmailProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchEmailStatuses, setBatchEmailStatuses] = useState<Record<string, { status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>>({});

  // Manual Edit / Punch modal state
  const [editingRecord, setEditingRecord] = useState<Partial<AttendanceRecord> | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false);

  // Data Deletion Modal state (for month, employee, or manual punches)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleteScope, setDeleteScope] = useState<'month' | 'employee' | 'manual'>('month');
  const [deleteTargetEmployeeId, setDeleteTargetEmployeeId] = useState<string>('ALL');
  const [isDeletingData, setIsDeletingData] = useState<boolean>(false);

  // Print Preview state
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);

  // Load records from storage; if empty and not previously initialized, seed initial records
  const loadAttendance = async () => {
    try {
      setIsLoading(true);
      let records = await storageService.getAttendanceRecords();
      const hasInitialized = localStorage.getItem('saccos_attendance_initialized') === 'true';
      if (records.length === 0 && !hasInitialized) {
        const staff = employees.length > 0 ? employees : DEFAULT_ATTENDANCE_STAFF;
        const demo = generateBiometricDemoRecords(2083, 4, staff);
        await storageService.saveAttendanceRecords(demo);
        records = demo;
        localStorage.setItem('saccos_attendance_initialized', 'true');
      }

      // Auto-purge any corrupted/bogus holiday entity records from storage and Supabase
      const bogusRecords = records.filter(r => {
        const name = (r.employeeName || '').trim().toLowerCase();
        const code = (r.employeeCode || '').trim().toLowerCase();
        const id = (r.employeeId || '').trim().toLowerCase();
        return isHolidayEntity(name) || isHolidayEntity(code) || isHolidayEntity(id) || 
               name.includes('holiday') || name.includes('जन्माष्टमी') || id.includes('holiday');
      });

      if (bogusRecords.length > 0) {
        const bogusIds = new Set(bogusRecords.map(r => r.id));
        records = records.filter(r => !bogusIds.has(r.id));
        for (const b of bogusRecords) {
          storageService.deleteAttendanceRecord(b.id).catch(() => {});
          storageService.deleteAttendanceByEmployee(b.employeeId, undefined, undefined, b.employeeName).catch(() => {});
        }
      }

      // Auto-purge duplicate/empty KAMANI records when real KAMNI records exist
      const hasRealKamniRecords = records.some(r => 
        r.employeeId !== 'emp_kamani_devi_karn' && 
        r.employeeName && isSameEmployeeName(r.employeeName, 'KAMNI DEVI KARN') &&
        Boolean(r.inTime || r.outTime)
      );

      const duplicateKamaniRecords = records.filter(r => 
        r.employeeId === 'emp_kamani_devi_karn' || 
        (r.employeeName && r.employeeName.trim().toUpperCase() === 'KAMANI DEVI KARN' && hasRealKamniRecords)
      );

      if (duplicateKamaniRecords.length > 0 && hasRealKamniRecords) {
        const dupIds = new Set(duplicateKamaniRecords.map(r => r.id));
        records = records.filter(r => !dupIds.has(r.id));
        for (const kr of duplicateKamaniRecords) {
          storageService.deleteAttendanceRecord(kr.id).catch(() => {});
        }
        storageService.deleteAttendanceByEmployee('emp_kamani_devi_karn').catch(() => {});
        storageService.deleteEmployee('emp_kamani_devi_karn').catch(() => {});
      }

      // Clean up any previously auto-injected "(Holiday Worked)" remarks from employees who worked regular shifts
      records = records.map(r => {
        if ((r.inTime || r.outTime) && r.remarks && r.remarks.includes('Holiday Worked')) {
          const cleanedRemarks = r.remarks
            .replace(/\s*\|\s*[^|]*Holiday Worked[^|)]*\)?/gi, '')
            .replace(/[^|]*Holiday Worked[^|)]*\)?\s*\|\s*/gi, '')
            .replace(/[^|]*Holiday Worked[^|)]*\)?/gi, '')
            .trim();
          return {
            ...r,
            remarks: cleanedRemarks || undefined
          };
        }
        return r;
      });

      setAttendanceList(records);
    } catch (e) {
      console.error('Failed to load attendance records:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const handleSyncToSupabase = async () => {
    if (isDayEnded) return;
    try {
      setIsSyncingSupabase(true);
      setSyncFeedback(null);
      const res = await storageService.syncAttendanceToSupabase();
      if (res.success) {
        setSyncFeedback({ type: 'success', text: `Supabase मा ${res.syncedCount} हाजिरी रेकर्ड सफलतापूर्वक सिंक भयो!` });
        await loadAttendance();
      } else {
        setSyncFeedback({ type: 'error', text: `सिंक गर्दा समस्या: ${res.error || 'Check network / table'}` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncFeedback({ type: 'error', text: `सिंक असफल: ${msg}` });
    } finally {
      setIsSyncingSupabase(false);
      setTimeout(() => setSyncFeedback(null), 7000);
    }
  };

  const effectiveBranches = useMemo(() => {
    if (branches && branches.length > 0) {
      const result = [...branches];
      STANDARD_BRANCHES.forEach(sb => {
        if (!result.some(b => b.id === sb.id || (b.code && b.code.toLowerCase() === sb.code.toLowerCase()))) {
          result.push(sb);
        }
      });
      return result;
    }
    return STANDARD_BRANCHES;
  }, [branches]);

  const baseEmployees = useMemo(() => {
    return employees.length > 0 ? employees : DEFAULT_ATTENDANCE_STAFF;
  }, [employees]);

  // System employees: ONLY real registered staff from system (strictly no holiday or invalid entities)
  const effectiveEmployees = useMemo(() => {
    const map = new Map<string, Employee>();

    baseEmployees.forEach(e => {
      const name = (e.fullName || '').trim().toLowerCase();
      const code = (e.employeeCode || '').trim().toLowerCase();
      const id = (e.id || '').trim().toLowerCase();
      if (!name || isHolidayEntity(name) || isHolidayEntity(code) || isHolidayEntity(id) || 
          name.includes('holiday') || name.includes('जन्माष्टमी') || id.includes('holiday')) {
        return;
      }

      // Check if an employee with fuzzy same name or identical code already exists
      const existing = Array.from(map.values()).find(ex => 
        isSameEmployeeName(ex.fullName, e.fullName) ||
        (cleanEmployeeCode(e.employeeCode) && cleanEmployeeCode(ex.employeeCode) === cleanEmployeeCode(e.employeeCode))
      );

      if (existing) {
        // Prefer official HR record or the one with valid employeeCode
        if ((!existing.employeeCode || existing.employeeCode === '-') && e.employeeCode && e.employeeCode !== '-') {
          map.delete(existing.id);
          map.set(e.id, e);
        }
        return;
      }

      map.set(e.id, e);
    });

    // Also include any real employees from attendance records if not already present
    attendanceList.forEach(rec => {
      if (!rec.employeeId && !rec.employeeName) return;
      const id = rec.employeeId || rec.employeeName;
      const name = (rec.employeeName || '').trim();
      const nameLower = name.toLowerCase();
      const code = (rec.employeeCode || '').trim();
      const codeLower = code.toLowerCase();
      if (isHolidayEntity(nameLower) || isHolidayEntity(codeLower) || isHolidayEntity(id.toLowerCase()) ||
          nameLower.includes('holiday') || nameLower.includes('जन्माष्टमी')) {
        return;
      }

      // Check if this record belongs to ANY employee already in map (by ID, code, or fuzzy name)
      const alreadyExists = map.has(rec.employeeId) || Array.from(map.values()).some(e => 
        e.id === rec.employeeId ||
        (cleanEmployeeCode(code) && cleanEmployeeCode(e.employeeCode) === cleanEmployeeCode(code)) ||
        isSameEmployeeName(e.fullName, name)
      );

      if (!alreadyExists) {
        map.set(rec.employeeId, {
          id: rec.employeeId,
          fullName: name,
          employeeCode: code || '-',
          branchId: rec.branchId || 'main',
          designation: rec.designation || 'STAFF',
          department: rec.department || 'GENERAL'
        });
      }
    });

    return Array.from(map.values());
  }, [baseEmployees, attendanceList]);

  // Quick lookup maps
  const employeeByCodeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    effectiveEmployees.forEach(emp => {
      if (emp.employeeCode) {
        map.set(emp.employeeCode.trim().toLowerCase(), emp);
      }
    });
    return map;
  }, [effectiveEmployees]);

  const employeeByNameMap = useMemo(() => {
    const map = new Map<string, Employee>();
    effectiveEmployees.forEach(emp => {
      if (emp.fullName) {
        map.set(emp.fullName.trim().toLowerCase(), emp);
      }
    });
    return map;
  }, [effectiveEmployees]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    effectiveEmployees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [effectiveEmployees]);

  // Handle Excel/CSV file upload & parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDayEnded) return;
    const file = e.target.files?.[0];
    if (!file) return;
    processAttendanceFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isDayEnded) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processAttendanceFile(file);
  };

  const processAttendanceFile = async (file: File) => {
    setIsProcessingFile(true);
    setUploadError('');
    setUploadFileName(file.name);
    setSavingProgress('');

    try {
      const buffer = await file.arrayBuffer();
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: true, cellText: true });
      } catch {
        // Fallback to reading file text directly (e.g. for non-standard CSV/TSV/TXT)
        const text = await file.text();
        workbook = XLSX.read(text, { type: 'string', cellDates: true, cellNF: true, cellText: true });
      }

      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('अपलोड गरिएको फाइलमा कुनै सिट (Worksheet) भेटिएन। कृपया सही एक्सेल/CSV फाइल छनोट गर्नुहोस्।');
      }

      // Helper to ensure worksheet has valid range !ref
      const ensureSheetRef = (ws: XLSX.WorkSheet) => {
        if (ws['!ref']) return;
        const cellKeys = Object.keys(ws).filter(k => /^[A-Z]+[0-9]+$/.test(k));
        if (cellKeys.length === 0) return;
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        for (const k of cellKeys) {
          const cell = XLSX.utils.decode_cell(k);
          if (cell.r < minR) minR = cell.r;
          if (cell.r > maxR) maxR = cell.r;
          if (cell.c < minC) minC = cell.c;
          if (cell.c > maxC) maxC = cell.c;
        }
        if (minR !== Infinity) {
          ws['!ref'] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
        }
      };

      let activeYear = uploadYear;
      let activeMonth = uploadMonth;
      const recordMap = new Map<string, AttendanceRecord>();
      const detectedHolidaysMap = new Map<string, string>();
      const defaultDate = `${uploadYear}-${String(uploadMonth).padStart(2, '0')}-01`;

      // Helper to match an employee from code or name
      const findEmployee = (rawCode?: string, rawName?: string): Employee | undefined => {
        const cClean = cleanEmployeeCode(rawCode);
        const nClean = String(rawName || '').trim();
        const nLower = nClean.toLowerCase();
        if (cClean && employeeByCodeMap.has(cClean)) {
          return employeeByCodeMap.get(cClean);
        }
        if (nLower && employeeByNameMap.has(nLower)) {
          return employeeByNameMap.get(nLower);
        }
        if (nClean) {
          // 1. Direct or substring match
          const direct = effectiveEmployees.find(e => {
            const eName = e.fullName.toLowerCase();
            return eName === nLower || eName.includes(nLower) || nLower.includes(eName);
          });
          if (direct) return direct;

          // 2. Fuzzy / Phonetic similarity match (e.g. KAMNI vs KAMANI, SEKHAR vs SHEKHAR)
          let bestEmp: Employee | undefined = undefined;
          let bestSim = 0;
          for (const emp of effectiveEmployees) {
            const sim = calculateNameSimilarity(emp.fullName, nClean);
            if (sim > bestSim && sim >= 0.82) {
              bestSim = sim;
              bestEmp = emp;
            }
          }
          if (bestEmp) return bestEmp;
        }
        return undefined;
      };

      // Process each sheet in the workbook
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        if (!ws) continue;
        ensureSheetRef(ws);

        // Extract both formatted text representations and raw objects
        const raw2DText: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
        const raw2DRaw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

        if (!raw2DText || raw2DText.length === 0) continue;

        // Scan all cells in sheet for standalone holiday banners/declarations
        for (let r = 0; r < raw2DText.length; r++) {
          const rowText = raw2DText[r];
          if (!Array.isArray(rowText)) continue;
          for (let c = 0; c < rowText.length; c++) {
            const cellStr = String(rowText[c] ?? '').trim();
            if (!cellStr) continue;
            if (isHolidayEntity(cellStr)) {
              const holRem = extractHolidayRemark(cellStr);
              // Check if cell contains a date, or if adjacent cell contains a date
              const selfDate = normalizeToBsDate(cellStr, uploadYear, uploadMonth);
              const nextCell = String(rowText[c + 1] ?? '').trim();
              const nextDate = normalizeToBsDate(nextCell, uploadYear, uploadMonth);
              const prevCell = String(rowText[c - 1] ?? '').trim();
              const prevDate = normalizeToBsDate(prevCell, uploadYear, uploadMonth);

              const matchedDate = selfDate || nextDate || prevDate;
              if (matchedDate) {
                detectedHolidaysMap.set(matchedDate, holRem);
              }
            }
          }
        }

        // =========================================================================
        // STRATEGY 1: 2D ATTENDANCE MATRIX PARSER (Multi-column Monthly Matrix)
        // =========================================================================
        let bestMatrixRow = -1;
        let bestDayCols: Array<{ colIdx: number; dayNumber: number; dateBs?: string }> = [];

        // Scan first 40 rows for a row containing sequential day numbers (1..32 or dates)
        for (let r = 0; r < Math.min(raw2DText.length, 40); r++) {
          const row = raw2DText[r];
          if (!Array.isArray(row)) continue;
          const dayCols: Array<{ colIdx: number; dayNumber: number; dateBs?: string }> = [];
          for (let c = 0; c < row.length; c++) {
            const cellText = String(row[c] ?? '').trim();
            const cellRaw = raw2DRaw[r]?.[c];
            const parsed = parseDayFromHeaderCell(cellText) || parseDayFromHeaderCell(cellRaw);
            if (parsed) {
              dayCols.push({ colIdx: c, ...parsed });
            }
          }
          if (dayCols.length >= 3 && dayCols.length > bestDayCols.length) {
            bestDayCols = dayCols;
            bestMatrixRow = r;
          }
        }

        if (bestMatrixRow >= 0 && bestDayCols.length >= 3) {
          // Detect year and month from bestDayCols if present (e.g. 2083-05-01)
          for (const dc of bestDayCols) {
            if (dc.dateBs) {
              const parts = dc.dateBs.split('-');
              if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                if (y >= 2070 && y <= 2120 && m >= 1 && m <= 12) {
                  activeYear = y;
                  activeMonth = m;
                  setUploadYear(y);
                  setUploadMonth(m);
                  break;
                }
              }
            }
          }

          const isSummaryHeader = (str: string) => {
            const s = str.toLowerCase().trim();
            return /^(?:t\s*days?|w\s*days?|l\s*days?|late\s*days?|a\s*days?|wp\s*days?|h\s*days?|total\s*days?|working\s*days?|leave\s*days?|absent\s*days?|holiday\s*days?|worked\s*days?|present\s*days?|total|summary|जम्मा|कुल)$/i.test(s);
          };

          // Identify Employee Name, Code, and Department columns
          const minDayCol = Math.min(...bestDayCols.map(d => d.colIdx));
          let nameCol = -1;
          let codeCol = -1;
          let deptCol = -1;

          // Check header rows (0 to bestMatrixRow + 1) for column titles
          for (let r = 0; r <= Math.min(bestMatrixRow + 1, raw2DText.length - 1); r++) {
            const row = raw2DText[r];
            if (!Array.isArray(row)) continue;
            for (let c = 0; c < row.length; c++) {
              if (bestDayCols.some(dc => dc.colIdx === c)) continue;
              const cellRaw = String(row[c] ?? '').trim();
              if (isSummaryHeader(cellRaw)) continue;
              const cellLower = cellRaw.toLowerCase();
              if (nameCol === -1 && /name|fullname|staffname|empname|employee|कर्मचारी|नाम|person|staff/.test(cellLower)) {
                nameCol = c;
              }
              if (codeCol === -1 && /code|empid|staffid|empcode|badgenumber|acno|संकेत|cardno|pin/.test(cellLower) && !/sn|sno|serial/.test(cellLower)) {
                codeCol = c;
              }
              if (deptCol === -1 && /department|designation|branch|post|शाखा|पद|विभाग/.test(cellLower)) {
                deptCol = c;
              }
            }
          }

          // If nameCol or codeCol not found by header text, infer by content in data rows
          if (nameCol === -1 || codeCol === -1) {
            const colScores: Record<number, { nameHits: number; codeHits: number }> = {};
            for (let c = 0; c < minDayCol; c++) {
              const hTitle = String(raw2DText[bestMatrixRow]?.[c] ?? '').trim();
              if (isSummaryHeader(hTitle)) continue;
              colScores[c] = { nameHits: 0, codeHits: 0 };
              for (let r = bestMatrixRow + 1; r < Math.min(bestMatrixRow + 25, raw2DText.length); r++) {
                const val = String(raw2DText[r]?.[c] ?? '').trim();
                if (!val) continue;
                if (isHolidayEntity(val)) continue;
                if (findEmployee(undefined, val)) colScores[c].nameHits += 10;
                else if (/^[\p{L}\s.]{3,35}$/u.test(val) && val.split(/\s+/).length >= 2) colScores[c].nameHits += 3;
                if (findEmployee(val, undefined)) colScores[c].codeHits += 10;
                else if (/^[A-Za-z0-9_-]{1,12}$/.test(val) && !/^\d{1,2}:\d{2}/.test(val) && val !== '31' && val !== '30' && val !== '29') colScores[c].codeHits += 3;
              }
            }

            if (nameCol === -1) {
              let maxNH = 0;
              for (const [cStr, sc] of Object.entries(colScores)) {
                const c = parseInt(cStr, 10);
                if (sc.nameHits > maxNH && c !== codeCol) {
                  maxNH = sc.nameHits;
                  nameCol = c;
                }
              }
            }
            if (codeCol === -1) {
              let maxCH = 0;
              for (const [cStr, sc] of Object.entries(colScores)) {
                const c = parseInt(cStr, 10);
                if (sc.codeHits > maxCH && c !== nameCol) {
                  maxCH = sc.codeHits;
                  codeCol = c;
                }
              }
            }
          }

          // Fallback column indexes if still unknown
          if (nameCol === -1 && minDayCol > 0) {
            nameCol = 0;
          }
          if (codeCol === -1 && minDayCol > 1) {
            const candidateCol = nameCol === 0 ? 1 : 0;
            const candidateHeader = String(raw2DText[bestMatrixRow]?.[candidateCol] ?? '').trim();
            if (!isSummaryHeader(candidateHeader)) {
              codeCol = candidateCol;
            }
          }

          let lastProcessedEmployee: { id: string; code: string; name: string; branchId: string } | null = null;

          // Iterate all rows below the matrix header
          for (let r = bestMatrixRow + 1; r < raw2DText.length; r++) {
            const rowText = raw2DText[r];
            if (!Array.isArray(rowText)) continue;

            let rawName = nameCol >= 0 ? String(rowText[nameCol] ?? '').trim() : '';
            let rawCode = codeCol >= 0 ? String(rowText[codeCol] ?? '').trim() : '';
            if (rawCode && /^\d+$/.test(rawCode) && (rawCode === '31' || rawCode === '30' || rawCode === '29' || rawCode === '28')) {
              if (!findEmployee(rawCode, undefined)) {
                rawCode = '';
              }
            }

            // If name is empty, look in any non-day column to the left of the matrix
            if (!rawName) {
              for (let c = 0; c < minDayCol; c++) {
                if (c === codeCol) continue;
                const candidateHeader = String(raw2DText[bestMatrixRow]?.[c] ?? '').trim();
                if (isSummaryHeader(candidateHeader)) continue;
                const candidateName = String(rowText[c] ?? '').trim();
                if (candidateName && !/^\d+$/.test(candidateName) && !isHolidayEntity(candidateName)) {
                  rawName = candidateName;
                  break;
                }
              }
            }

            // Skip total/summary rows
            if (/total|summary|average|count|जम्मा|कुल/i.test(rawName) || /total|summary/i.test(rawCode)) {
              continue;
            }

            // Check if this row is a dedicated Holiday / Festival declaration row (NOT an employee row)
            const isRowHoliday = (!rawName && isHolidayEntity(rawCode)) ||
              (isHolidayEntity(rawName) && !findEmployee(rawCode, rawName));

            if (isRowHoliday) {
              const rowHolidayRemark = extractHolidayRemark(rawName) || extractHolidayRemark(rawCode) || 'सार्वजनिक बिदा';
              bestDayCols.forEach(dc => {
                const cellVal = String(rowText[dc.colIdx] ?? '').trim();
                if (cellVal && cellVal !== '-' && cellVal !== '--' && cellVal !== 'N/A') {
                  const dateBs = dc.dateBs || `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(dc.dayNumber).padStart(2, '0')}`;
                  const cellParsed = parseAttendanceCell(cellVal);
                  const rem = cellParsed.remarks || extractHolidayRemark(cellVal) || rowHolidayRemark;
                  detectedHolidaysMap.set(dateBs, rem);
                }
              });
              continue; // Skip creating employee record for holiday row
            }

            // Check if this row is a secondary punch/OUT row for the previous employee
            if (!rawName && !rawCode && lastProcessedEmployee) {
              const hasTimings = bestDayCols.some(dc => {
                const s = String(rowText[dc.colIdx] ?? '').trim();
                return /^\d{1,2}:\d{2}/.test(s) || /out/i.test(s);
              });
              if (hasTimings) {
                bestDayCols.forEach(dc => {
                  const cellVal = String(rowText[dc.colIdx] ?? '').trim();
                  if (!cellVal || cellVal === '-' || cellVal === '--') return;
                  const dateBs = dc.dateBs || `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(dc.dayNumber).padStart(2, '0')}`;
                  const key = `${lastProcessedEmployee!.id}_${dateBs}`;
                  const existing = recordMap.get(key);
                  const parsed = parseAttendanceCell(cellVal);
                  if (existing) {
                    if (parsed.inTime && !existing.outTime) {
                      existing.outTime = parsed.inTime;
                      existing.workHours = calculateWorkHours(existing.inTime, existing.outTime);
                    }
                  }
                });
                continue;
              }
            }

            if (!rawName && !rawCode) continue;

            const matchedEmp = findEmployee(rawCode, rawName);
            const cleanCode = rawCode.replace(/[^a-zA-Z0-9_-]/g, '_');
            const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const employeeId = matchedEmp ? matchedEmp.id : (cleanCode ? `emp_${cleanCode}` : `emp_${cleanName || r}`);
            const employeeName = matchedEmp ? matchedEmp.fullName : (rawName || rawCode || 'Staff');
            const employeeCode = matchedEmp ? matchedEmp.employeeCode : (rawCode || '-');
            const branchId = matchedEmp?.branchId || currentBranch?.id || 'main';

            lastProcessedEmployee = { id: employeeId, code: employeeCode, name: employeeName, branchId };

            // Process each day cell for this employee
            bestDayCols.forEach(dc => {
              const dateBs = dc.dateBs || `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(dc.dayNumber).padStart(2, '0')}`;
              const cellVal = String(rowText[dc.colIdx] ?? '').trim();
              if (!cellVal || cellVal === '-' || cellVal === '--' || cellVal === 'N/A') return;

              const parsedCell = parseAttendanceCell(cellVal);
              const status = parsedCell.status;
              const inTime = parsedCell.inTime;
              const outTime = parsedCell.outTime;
              const remarks = parsedCell.remarks;
              const cellWorkHours = parsedCell.workHours;

              if (status === 'Holiday') {
                detectedHolidaysMap.set(dateBs, remarks || 'सार्वजनिक बिदा');
              }

              const key = `${employeeId}_${dateBs}`;
              const existing = recordMap.get(key);

              if (existing) {
                if (!existing.inTime && inTime) existing.inTime = inTime;
                if (!existing.outTime && outTime) existing.outTime = outTime;
                if (status !== 'Present' && existing.status === 'Present') existing.status = status;
                if (remarks) existing.remarks = remarks;
                existing.workHours = cellWorkHours ?? calculateWorkHours(existing.inTime, existing.outTime);
              } else {
                const workHours = cellWorkHours ?? calculateWorkHours(inTime, outTime);
                const cleanEmpKey = employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
                const cleanDateKey = dateBs.replace(/[^a-zA-Z0-9_-]/g, '_');
                recordMap.set(key, {
                  id: `att_${cleanEmpKey}_${cleanDateKey}`,
                  employeeId,
                  employeeCode,
                  employeeName,
                  date: dateBs,
                  dateBs,
                  inTime: inTime || undefined,
                  outTime: outTime || undefined,
                  workHours,
                  status,
                  remarks,
                  branchId,
                  source: 'excel_upload',
                  createdAt: Date.now()
                });
              }
            });
          }
        }

        // =========================================================================
        // STRATEGY 2: STANDARD LIST / BIOMETRIC PUNCH LOG PARSER
        // =========================================================================
        if (recordMap.size === 0) {
          let headerRowIndex = -1;
          let dateCol = -1;
          let inTimeCol = -1;
          let outTimeCol = -1;
          let singleTimeCol = -1;
          let codeCol = -1;
          let nameCol = -1;
          let statusCol = -1;
          let remarksCol = -1;

          // Scan first 25 rows for list headers
          for (let r = 0; r < Math.min(raw2DText.length, 25); r++) {
            const row = raw2DText[r];
            if (!Array.isArray(row)) continue;
            let score = 0;
            for (let c = 0; c < row.length; c++) {
              const cell = String(row[c] ?? '').toLowerCase().trim();
              if (/date|miti|मिति|attendancedate|day/.test(cell)) score += 10;
              if (/intime|checkin|punchin|timein|arrival|punch1|आएको/.test(cell)) score += 10;
              if (/outtime|checkout|punchout|timeout|departure|punch2|गएको/.test(cell)) score += 10;
              if (/name|fullname|staffname|empname|employee|कर्मचारी|नाम/.test(cell)) score += 10;
              if (/code|id|empid|staffid|empcode|badge|acno|sn|card|pin|संकेत/.test(cell)) score += 10;
            }
            if (score >= 20) {
              headerRowIndex = r;
              break;
            }
          }

          if (headerRowIndex >= 0) {
            const hRow = raw2DText[headerRowIndex];
            for (let c = 0; c < hRow.length; c++) {
              const cell = String(hRow[c] ?? '').toLowerCase().trim();
              if (dateCol === -1 && /date|miti|मिति|attendancedate/.test(cell)) dateCol = c;
              if (inTimeCol === -1 && /intime|checkin|punchin|timein|arrival|punch1|आएको/.test(cell)) inTimeCol = c;
              if (outTimeCol === -1 && /outtime|checkout|punchout|timeout|departure|punch2|गएको/.test(cell)) outTimeCol = c;
              if (singleTimeCol === -1 && /time|punchtime|timestamp|datetime/.test(cell) && c !== inTimeCol && c !== outTimeCol) singleTimeCol = c;
              if (nameCol === -1 && /name|fullname|staffname|empname|employee|कर्मचारी|नाम|staff|person/.test(cell)) nameCol = c;
              if (codeCol === -1 && /code|id|empid|staffid|empcode|badge|acno|sn|sno|card|pin|संकेत/.test(cell)) codeCol = c;
              if (statusCol === -1 && /status|state|attendance|हाजिरी|स्थिति/.test(cell)) statusCol = c;
              if (remarksCol === -1 && /remark|note|कैफियत/.test(cell)) remarksCol = c;
            }
          } else {
            // Infer column types from cell contents
            for (let c = 0; c < 20; c++) {
              let dateHits = 0, timeHits = 0, nameHits = 0, codeHits = 0;
              for (let r = 0; r < Math.min(raw2DText.length, 25); r++) {
                const val = String(raw2DText[r]?.[c] ?? '').trim();
                if (!val) continue;
                if (normalizeToBsDate(val, uploadYear, uploadMonth)) dateHits++;
                if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?$/i.test(val)) timeHits++;
                if (findEmployee(undefined, val)) nameHits += 5;
                else if (/^[\p{L}\s.]{3,35}$/u.test(val) && val.split(/\s+/).length >= 2) nameHits++;
                if (findEmployee(val, undefined)) codeHits += 5;
                else if (/^[A-Za-z0-9_-]{1,12}$/.test(val) && !/^\d{1,2}:\d{2}/.test(val)) codeHits++;
              }
              if (dateHits >= 2 && dateCol === -1) dateCol = c;
              else if (timeHits >= 2) {
                if (inTimeCol === -1) inTimeCol = c;
                else if (outTimeCol === -1) outTimeCol = c;
              } else if (nameHits >= 2 && nameCol === -1) nameCol = c;
              else if (codeHits >= 2 && codeCol === -1) codeCol = c;
            }
          }

          const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
          for (let r = startRow; r < raw2DText.length; r++) {
            const rowText = raw2DText[r];
            if (!Array.isArray(rowText)) continue;

            const rawName = nameCol >= 0 ? String(rowText[nameCol] ?? '').trim() : '';
            const rawCode = codeCol >= 0 ? String(rowText[codeCol] ?? '').trim() : '';
            if (!rawName && !rawCode) continue;

            // Date parsing with fallback
            const rawDateVal = dateCol >= 0 ? (raw2DRaw[r]?.[dateCol] ?? rowText[dateCol]) : undefined;
            let rowDate = normalizeToBsDate(rawDateVal, uploadYear, uploadMonth);

            if (isHolidayEntity(rawName) || isHolidayEntity(rawCode)) {
              const holRem = extractHolidayRemark(rawName) || extractHolidayRemark(rawCode) || 'सार्वजनिक बिदा';
              if (rowDate) detectedHolidaysMap.set(rowDate, holRem);
              continue;
            }

            let inTimeRaw = inTimeCol >= 0 ? (raw2DRaw[r]?.[inTimeCol] ?? rowText[inTimeCol]) : undefined;
            let outTimeRaw = outTimeCol >= 0 ? (raw2DRaw[r]?.[outTimeCol] ?? rowText[outTimeCol]) : undefined;

            if (singleTimeCol >= 0 && (!inTimeRaw || !outTimeRaw)) {
              const sTime = String(rowText[singleTimeCol] ?? '').trim();
              if (sTime) {
                const dtMatch = sTime.match(/(\d{4}[-/.]\d{2}[-/.]\d{2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?))?/i);
                if (dtMatch) {
                  if (!rowDate) rowDate = normalizeToBsDate(dtMatch[1], uploadYear, uploadMonth);
                  if (dtMatch[2]) {
                    if (!inTimeRaw) inTimeRaw = dtMatch[2];
                    else if (!outTimeRaw) outTimeRaw = dtMatch[2];
                  }
                } else if (/^\d{1,2}:\d{2}/.test(sTime)) {
                  if (!inTimeRaw) inTimeRaw = sTime;
                  else if (!outTimeRaw) outTimeRaw = sTime;
                }
              }
            }

            if (!rowDate) rowDate = defaultDate;

            const inTime = formatExcelTime(inTimeRaw);
            const outTime = formatExcelTime(outTimeRaw);
            const rawStatus = statusCol >= 0 ? String(rowText[statusCol] ?? '').trim() : '';
            const cellParsed = parseAttendanceCell(rawStatus || `${inTimeRaw || ''} | ${outTimeRaw || ''}`);
            const status = rawStatus ? normalizeStatus(rawStatus, Boolean(inTime)) : cellParsed.status;
            let remarks = remarksCol >= 0 ? String(rowText[remarksCol] ?? '').trim() : '';
            if (!remarks && cellParsed.remarks) remarks = cellParsed.remarks;

            if (status === 'Holiday') {
              detectedHolidaysMap.set(rowDate, remarks || 'सार्वजनिक बिदा');
            }

            const matchedEmp = findEmployee(rawCode, rawName);
            const cleanCode = rawCode.replace(/[^a-zA-Z0-9_-]/g, '_');
            const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const employeeId = matchedEmp ? matchedEmp.id : (cleanCode ? `emp_${cleanCode}` : `emp_${cleanName || r}`);
            const employeeName = matchedEmp ? matchedEmp.fullName : (rawName || 'Staff');
            const employeeCode = matchedEmp ? matchedEmp.employeeCode : (rawCode || '-');
            const branchId = matchedEmp?.branchId || currentBranch?.id || 'main';

            const key = `${employeeId}_${rowDate}`;
            const existing = recordMap.get(key);

            if (existing) {
              if (!existing.inTime && inTime) existing.inTime = inTime;
              if (!existing.outTime && outTime) existing.outTime = outTime;
              if (status !== 'Present' && existing.status === 'Present') existing.status = status;
              if (remarks) existing.remarks = remarks;
              existing.workHours = calculateWorkHours(existing.inTime, existing.outTime);
            } else {
              const workHours = calculateWorkHours(inTime, outTime);
              const cleanEmpKey = employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
              const cleanDateKey = rowDate.replace(/[^a-zA-Z0-9_-]/g, '_');
              recordMap.set(key, {
                id: `att_${cleanEmpKey}_${cleanDateKey}`,
                employeeId,
                employeeCode,
                employeeName,
                date: rowDate,
                dateBs: rowDate,
                inTime: inTime || undefined,
                outTime: outTime || undefined,
                workHours,
                status,
                remarks: remarks || undefined,
                branchId,
                source: 'excel_upload',
                createdAt: Date.now()
              });
            }
          }
        }

        // =========================================================================
        // STRATEGY 3: FUZZY EMPLOYEE CELL SCANNER (Ultimate Safety Net)
        // =========================================================================
        if (recordMap.size === 0) {
          for (let r = 0; r < raw2DText.length; r++) {
            const rowText = raw2DText[r];
            if (!Array.isArray(rowText)) continue;
            for (let c = 0; c < rowText.length; c++) {
              const cellVal = String(rowText[c] ?? '').trim();
              if (!cellVal || isHolidayEntity(cellVal)) continue;

              const matchedEmp = findEmployee(undefined, cellVal);
              if (matchedEmp) {
                // Look along the same row for punches across days
                for (let dayCol = c + 1; dayCol < rowText.length; dayCol++) {
                  const dayPunch = String(rowText[dayCol] ?? '').trim();
                  if (!dayPunch || dayPunch === '-' || dayPunch === '--') continue;
                  const dayNum = dayCol - c;
                  if (dayNum >= 1 && dayNum <= 32) {
                    const dateBs = `${uploadYear}-${String(uploadMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const parsed = parseAttendanceCell(dayPunch);
                    const key = `${matchedEmp.id}_${dateBs}`;
                    if (!recordMap.has(key)) {
                      recordMap.set(key, {
                        id: `att_${matchedEmp.id}_${dateBs}`,
                        employeeId: matchedEmp.id,
                        employeeCode: matchedEmp.employeeCode,
                        employeeName: matchedEmp.fullName,
                        date: dateBs,
                        dateBs,
                        inTime: parsed.inTime,
                        outTime: parsed.outTime,
                        workHours: parsed.workHours,
                        status: parsed.status,
                        remarks: parsed.remarks,
                        branchId: matchedEmp.branchId || currentBranch?.id || 'main',
                        source: 'excel_upload',
                        createdAt: Date.now()
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }

      // =========================================================================
      // POST-PROCESSING: APPLY DETECTED HOLIDAYS TO EXISTING UPLOADED ENTRIES
      // Only keep records for employees actually present in the uploaded file!
      // Strictly NO synthetic records on days without data!
      // =========================================================================
      const parsed: AttendanceRecord[] = [];
      recordMap.forEach(rec => {
        if (!isHolidayEntity(rec.employeeName) && !isHolidayEntity(rec.employeeCode) && !isHolidayEntity(rec.employeeId)) {
          // If this day was identified as a holiday from the holiday setup row or festival keywords,
          // ONLY apply the holiday remark if this employee's own status is 'Holiday'.
          // Strictly DO NOT apply "(Holiday Worked)" to employees who worked their regular shifts!
          const recDate = rec.dateBs || rec.date;
          if (detectedHolidaysMap.has(recDate)) {
            const hRem = detectedHolidaysMap.get(recDate)!;
            if (rec.status === 'Holiday') {
              rec.remarks = rec.remarks || hRem;
            }
          }
          parsed.push(rec);
        }
      });

      // Sort by dateBs ascending, then employeeName ascending
      parsed.sort((a, b) => (a.dateBs || a.date).localeCompare(b.dateBs || b.date) || a.employeeName.localeCompare(b.employeeName));

      if (parsed.length === 0) {
        throw new Error(
          `हाजिरी रेकर्डहरू फेला परेन। फाइलमा भएका पानाहरू (${workbook.SheetNames.join(', ')}) मा कर्मचारीको नाम, कोड वा हाजिरी समय पहिचान हुन सकेन। कृपया फाइलमा कर्मचारी विवरण र दिन/मिति रहेको सुनिश्चित गर्नुहोस्।`
        );
      }

      setParsedPreview(parsed);
    } catch (err) {
      console.error('Attendance parse error:', err);
      setUploadError(err instanceof Error ? err.message : 'एक्सेल फाइल पढ्न सकिएन। कृपया फाइल जाँच गर्नुहोस्।');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Days of the currently selected BS month with day of week & weekend flag
  const monthDays = useMemo(() => {
    const list = [];
    const daysInMonth = getDaysInBsMonth(selectedYear, selectedMonth);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(getBsDayInfo(selectedYear, selectedMonth, d));
    }
    return list;
  }, [selectedYear, selectedMonth]);

  // Working days in the selected month (excluding weekends)
  const workingDaysInMonth = useMemo(() => {
    return monthDays.filter(d => !d.isWeekend).length;
  }, [monthDays]);

  // Generate & Download clean Excel sample template matching user's monthly matrix
  const downloadSampleTemplate = () => {
    try {
      const daysInMonth = monthDays.length;
      const workingDaysCount = monthDays.filter(d => !d.isWeekend).length;

      const targetEmployees = effectiveEmployees;

      const sampleRows = targetEmployees.map((emp, empIdx) => {
        const absentCount = empIdx === 1 ? 2 : (empIdx === 4 ? 4 : 0);
        const lateCount = empIdx === 4 ? 17 : (empIdx === 1 ? 18 : 18);
        const workedCount = workingDaysCount - absentCount;

        const row: Record<string, unknown> = {
          'Employee Name': emp.fullName.toUpperCase(),
          'T Days': daysInMonth,
          'W Days': workingDaysCount,
          'L Days': 0,
          'Late Days': lateCount,
          'A Days': absentCount,
          'WP Days': workedCount
        };

        let currentAbsentAssigned = 0;

        monthDays.forEach((dInfo, dayIdx) => {
          if (dInfo.isWeekend) {
            row[dInfo.colHeader] = 'Weekend';
          } else {
            if (absentCount > 0 && currentAbsentAssigned < absentCount && (dayIdx === 4 || dayIdx === 10 || dayIdx === 15 || dayIdx === 22)) {
              row[dInfo.colHeader] = 'Absent(00:00 | 00:00)';
              currentAbsentAssigned++;
            } else {
              const sampleInMins = 9 * 60 + ((empIdx * 7 + dayIdx * 11) % 40);
              const inH = Math.floor(sampleInMins / 60);
              const inM = sampleInMins % 60;
              const inTimeStr = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`;
              
              const sampleOutMins = 16 * 60 + ((empIdx * 13 + dayIdx * 9) % 115);
              const outH = Math.floor(sampleOutMins / 60);
              const outM = sampleOutMins % 60;
              const outTimeStr = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;

              row[dInfo.colHeader] = `${inTimeStr} | ${outTimeStr}`;
            }
          }
        });

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(sampleRows);
      
      const colWidths = [
        { wch: 28 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        ...monthDays.map(() => ({ wch: 18 }))
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

      const fileName = `Attendance_Template_${selectedYear}_${NEPALI_MONTHS[selectedMonth - 1]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error('Failed to generate template:', e);
      alert('Could not download sample template.');
    }
  };

  // Save parsed preview records to persistence
  const handleSaveParsedRecords = async () => {
    if (isDayEnded) return;
    if (parsedPreview.length === 0) return;

    try {
      setIsProcessingFile(true);
      const distinctEmpCount = new Set(parsedPreview.map(p => p.employeeId)).size;
      setSavingProgress(`सुरक्षित गरिँदै: ${distinctEmpCount} जना कर्मचारीहरूको ${parsedPreview.length} वटा हाजिरी रेकर्ड...`);

      // 1. Re-map records to existing employees and identify only genuinely new employees
      const existingEmpIdSet = new Set(employees.map(e => e.id));
      const discoveredMap = new Map<string, { id: string; name: string; code: string; branchId: string }>();

      parsedPreview.forEach(p => {
        // Remap to existing employee if matching by ID, code, or fuzzy name!
        const matched = employees.find(e => 
          e.id === p.employeeId ||
          (p.employeeCode && p.employeeCode !== '-' && cleanEmployeeCode(e.employeeCode) === cleanEmployeeCode(p.employeeCode)) ||
          (p.employeeName && isSameEmployeeName(e.fullName, p.employeeName))
        );

        if (matched) {
          p.employeeId = matched.id;
          p.employeeName = matched.fullName;
          p.employeeCode = matched.employeeCode || p.employeeCode;
          p.branchId = matched.branchId || p.branchId;
          return;
        }

        const hasId = existingEmpIdSet.has(p.employeeId);
        const hasCode = p.employeeCode && p.employeeCode !== '-' && employees.some(e => cleanEmployeeCode(e.employeeCode) === cleanEmployeeCode(p.employeeCode));
        const hasName = p.employeeName && employees.some(e => isSameEmployeeName(e.fullName, p.employeeName));

        if (!hasId && !hasCode && !hasName && !discoveredMap.has(p.employeeId)) {
          discoveredMap.set(p.employeeId, {
            id: p.employeeId,
            name: p.employeeName || 'Staff',
            code: p.employeeCode && p.employeeCode !== '-' ? p.employeeCode : p.employeeId.replace(/^emp_/, '').toUpperCase(),
            branchId: p.branchId || currentBranch?.id || 'main'
          });
        }
      });

      if (discoveredMap.size > 0) {
        for (const empInfo of discoveredMap.values()) {
          const newEmp: Employee = {
            id: empInfo.id,
            fullName: empInfo.name,
            employeeCode: empInfo.code,
            department: 'General',
            designation: 'Staff',
            branchId: empInfo.branchId,
            status: 'Active',
            joinedDate: parsedPreview[0]?.dateBs || parsedPreview[0]?.date || '2081-01-01',
            basicSalary: 0,
            mobile: '',
            email: '',
            createdAt: Date.now()
          };
          try {
            await storageService.saveEmployee(newEmp);
          } catch (e) {
            console.warn('Auto-registering employee from excel warning:', e);
          }
        }
      }

      // 2. Deduplicate parsedPreview by (employeeId + date) to prevent duplicate punch rows
      const uniqueRecordsMap = new Map<string, AttendanceRecord>();
      parsedPreview.forEach(rec => {
        const key = `${rec.employeeId}_${rec.dateBs || rec.date}`;
        const existing = uniqueRecordsMap.get(key);
        // If entry already exists for this day, prefer the one with valid inTime / outTime
        if (!existing || (!existing.inTime && rec.inTime)) {
          uniqueRecordsMap.set(key, rec);
        }
      });
      const deduplicatedRecords = Array.from(uniqueRecordsMap.values());

      await storageService.saveAttendanceRecords(deduplicatedRecords);
      await loadAttendance();

      // If the parsed preview had a specific date, set selectedDate, selectedYear, and selectedMonth so Report immediately shows it
      if (parsedPreview[0]?.dateBs || parsedPreview[0]?.date) {
        const sampleDate = parsedPreview[0].dateBs || parsedPreview[0].date;
        setSelectedDate(sampleDate);
        const parts = sampleDate.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (y >= 2070 && y <= 2120 && m >= 1 && m <= 12) {
            setSelectedYear(y);
            setSelectedMonth(m);
            setUploadYear(y);
            setUploadMonth(m);
          }
        }
      } else {
        setSelectedYear(uploadYear);
        setSelectedMonth(uploadMonth);
      }

      setParsedPreview([]);
      setUploadFileName('');
      setToastNotification({
        type: 'success',
        message: `सफलतापूर्वक ${distinctEmpCount} जना कर्मचारीहरूको ${parsedPreview.length} वटा हाजिरी रेकर्ड सुरक्षित गरियो!`
      });
      
      // Switch to Report tab so the user immediately sees the imported data per employee
      setActiveTab('report');
    } catch (err) {
      console.error('Failed to save attendance records:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to save attendance records. Please try again.');
    } finally {
      setIsProcessingFile(false);
      setSavingProgress('');
    }
  };

  // Export current attendance report to Excel
  const exportReportToExcel = () => {
    try {
      let dataToExport: Array<Record<string, unknown>> = [];
      let filename = `Attendance_Report_${selectedDate}.xlsx`;

      if (reportViewMode === 'daily') {
        dataToExport = dailyReportData.map((item, idx) => ({
          'S.N.': idx + 1,
          'Date (BS)': item.date,
          'Employee Code': item.employeeCode,
          'Employee Name': item.employeeName,
          'Department': item.department,
          'Designation': item.designation,
          'Status': item.status,
          'In Time': item.inTime || '-',
          'Out Time': item.outTime || '-',
          'Working Hours': item.workHours || '-',
          'Remarks': item.remarks || '-'
        }));
      } else if (reportViewMode === 'monthly') {
        filename = `Monthly_Attendance_${selectedYear}_${NEPALI_MONTHS[selectedMonth - 1]}.xlsx`;
        dataToExport = monthlyMatrixData.map((row, idx) => {
          const obj: Record<string, unknown> = {
            'S.N.': idx + 1,
            'Employee Name': row.employee.fullName.toUpperCase(),
            'T Days': row.totalDays,
            'W Days': row.workingDays,
            'H Days': row.holidayCount,
            'L Days': row.leaveCount,
            'Late Days': row.lateCount,
            'A Days': row.absentCount,
            'WP Days': row.workedDays
          };

          monthDays.forEach(dInfo => {
            const rec = row.days[dInfo.dayNumber];
            if (rec) {
              const remarkStr = rec.remarks ? ` [${rec.remarks}]` : '';
              if (rec.status === 'Weekly Off') {
                obj[dInfo.colHeader] = `Weekend${remarkStr}`;
              } else if (rec.status === 'Absent') {
                obj[dInfo.colHeader] = `Absent(00:00 | 00:00)${remarkStr}`;
              } else if (rec.status === 'On Leave') {
                obj[dInfo.colHeader] = `Leave${remarkStr}`;
              } else if (rec.status === 'Holiday') {
                obj[dInfo.colHeader] = `Holiday${remarkStr}`;
              } else if (rec.inTime && rec.outTime) {
                obj[dInfo.colHeader] = `${rec.inTime} | ${rec.outTime}${remarkStr}`;
              } else if (rec.inTime) {
                obj[dInfo.colHeader] = `${rec.inTime} | --:--${remarkStr}`;
              } else {
                obj[dInfo.colHeader] = `${rec.status}${remarkStr}`;
              }
            } else if (dInfo.isWeekend) {
              obj[dInfo.colHeader] = 'Weekend';
            } else {
              obj[dInfo.colHeader] = '-';
            }
          });

          return obj;
        });
      }

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const colWidths = [
        { wch: 8 },  // S.N.
        { wch: 28 }, // Employee Name
        { wch: 10 }, // T Days
        { wch: 10 }, // W Days
        { wch: 10 }, // H Days
        { wch: 10 }, // L Days
        { wch: 11 }, // Late Days
        { wch: 10 }, // A Days
        { wch: 11 }, // WP Days
        ...monthDays.map(() => ({ wch: 16 }))
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance_Report');
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export Excel report.');
    }
  };

  // Export Monthly Matrix to PDF matching Print Preview exactly
  const exportReportToPdf = async () => {
    try {
      setIsExportingPdf(true);
      const rawMonthPdf = NEPALI_MONTHS[selectedMonth - 1] || 'Shrawan';
      const displayMonthPdf = rawMonthPdf === 'Shrawan' ? 'Sharwan' : rawMonthPdf;

      // Select printable area element (from modal or dedicated offscreen container)
      const printableEl = document.getElementById('attendance-printable-area') || document.getElementById('attendance-printable-area-export');
      if (!printableEl) {
        window.print();
        return;
      }

      const canvas = await html2canvas(printableEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 4;
      const printableWidth = pageWidth - (margin * 2);
      const printableHeight = (canvas.height * printableWidth) / canvas.width;

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, Math.min(printableHeight, pageHeight - (margin * 2)));

      const filename = `Attendance_${selectedYear}_${displayMonthPdf}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('PDF export failed, using window.print():', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Helper to get branch name for employee
  const getEmployeeBranchName = (emp: Employee): string => {
    if (emp.branchId) {
      const b = branches?.find(x => x.id === emp.branchId);
      if (b?.name) return b.name;
    }
    return currentBranch?.name || 'Main Branch';
  };

  // Generate Personalized Attendance HTML Report with Company Header
  const generateEmployeeAttendanceHtml = (row: any) => {
    const rawMonth = NEPALI_MONTHS[selectedMonth - 1] || 'Shrawan';
    const displayMonthName = rawMonth === 'Shrawan' ? 'Sharwan' : rawMonth;
    const yearBs = selectedYear;
    const branchName = getEmployeeBranchName(row.employee);

    const dayRowsHtml = monthDays.map(dInfo => {
      const rec = row.days[dInfo.dayNumber];
      const isWeekend = dInfo.isWeekend;
      let timingOrStatus = '-';
      let statusColor = '#475569';
      let bgColor = '#ffffff';

      if (isWeekend) {
        timingOrStatus = 'Weekend / Weekly Off';
        statusColor = '#64748b';
        bgColor = '#f8fafc';
      } else if (rec) {
        if (rec.status === 'Absent') {
          if (rec.remarks) {
            // Absent is removed, remark is displayed!
            timingOrStatus = rec.remarks;
            statusColor = '#1d4ed8';
            bgColor = '#eff6ff';
          } else {
            timingOrStatus = 'Absent (00:00 | 00:00)';
            statusColor = '#dc2626';
            bgColor = '#fef2f2';
          }
        } else if (rec.status === 'On Leave') {
          timingOrStatus = rec.remarks ? `Leave (${rec.remarks})` : 'Leave';
          statusColor = '#7e22ce';
          bgColor = '#faf5ff';
        } else if (rec.status === 'Holiday') {
          timingOrStatus = rec.remarks ? `Holiday (${rec.remarks})` : 'Holiday';
          statusColor = '#4338ca';
          bgColor = '#eef2ff';
        } else {
          const inT = rec.inTime || '09:00';
          const outT = rec.outTime || '17:00';
          timingOrStatus = `${inT} | ${outT}`;
          if (rec.status === 'Late') {
            statusColor = '#b45309';
            bgColor = '#fffbeb';
          } else {
            statusColor = '#047857';
            bgColor = '#f0fdf4';
          }
        }
      }

      const remarkBadge = (rec?.remarks && rec.status !== 'Absent') 
        ? `<br/><span style="display:inline-block; font-size:9.5px; color:#1d4ed8; background-color:#eff6ff; border:1px solid #bfdbfe; padding:1px 5px; border-radius:4px; margin-top:2px;">Remark: ${rec.remarks}</span>` 
        : '';

      let statusColText = isWeekend ? 'Weekend' : (rec?.status || 'Absent');
      if (rec?.status === 'Absent' && rec?.remarks) {
        statusColText = rec.remarks; // Absent is removed, remark is displayed!
      }

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${bgColor};">
          <td style="padding: 6px 10px; font-weight: bold; font-family: monospace; font-size: 11px; text-align: center; border-right: 1px solid #e2e8f0;">
            ${dInfo.colHeader}
          </td>
          <td style="padding: 6px 10px; font-weight: 600; font-size: 11px; color: ${statusColor}; text-align: center; border-right: 1px solid #e2e8f0;">
            ${timingOrStatus}${remarkBadge}
          </td>
          <td style="padding: 6px 10px; font-size: 11px; font-weight: bold; color: ${statusColor}; text-align: center;">
            ${statusColText}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; background-color: #ffffff; color: #0f172a; box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.12);">
        
        <!-- Official Cooperative Header with Left Logo, Centered Text, All White, Balanced Nepali & English -->
        <div style="background-color: #044e29; color: #ffffff; padding: 18px 20px; border-radius: 12px 12px 0 0;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="width: 60px; vertical-align: middle; text-align: left;">
                <div style="width: 56px; height: 56px; text-align: center; display: inline-block; vertical-align: middle;">
                  <img src="cid:cooplogo" alt="Logo" width="56" height="56" style="max-width: 56px; max-height: 56px; object-fit: contain; vertical-align: middle; display: block; margin: 0 auto; border: 0;" />
                </div>
              </td>
              <td style="vertical-align: middle; text-align: center; padding: 0 10px;">
                <!-- Nepali Text on Top - White Bold -->
                <div style="font-size: 17.5px; font-weight: 900; line-height: 1.3; color: #ffffff; letter-spacing: 0.2px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                  रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                </div>
                <!-- English Text Below Nepali - Harmonious font size, All White -->
                <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; line-height: 1.3; color: #ffffff; letter-spacing: 0.8px; margin-top: 3px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                  RATAULI SAVING AND CREDIT COOPERATIVE LTD
                </div>
                <!-- Address - पिपरा गाउँपालिका -६, महोत्तरी - All White -->
                <div style="font-size: 11.5px; color: #ffffff; font-weight: 600; opacity: 0.95; margin-top: 3px;">
                  पिपरा गाउँपालिका -६, महोत्तरी
                </div>
              </td>
              <td style="width: 60px; vertical-align: middle;"></td>
            </tr>
          </table>

          <!-- Report Title: Attendance 2083 Sharwan -->
          <div style="margin-top: 12px; padding: 7px 14px; background-color: rgba(0, 0, 0, 0.28); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); text-align: center;">
            <span style="font-size: 13.5px; font-weight: 900; color: #fef08a; letter-spacing: 0.8px; text-transform: uppercase;">
              Attendance ${yearBs} ${displayMonthName}
            </span>
          </div>
        </div>

        <!-- Employee Info Card: Branch instead of Staff Code -->
        <div style="padding: 16px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 30%;">Employee Name:</td>
              <td style="padding: 4px 0; font-weight: 800; color: #0f172a; text-transform: uppercase; font-size: 13px;">${row.employee.fullName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Branch:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #047857; font-size: 12.5px;">${branchName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Department / Post:</td>
              <td style="padding: 4px 0; font-weight: 600; color: #334155;">${row.employee.department || 'General'} (${row.employee.designation || 'Staff'})</td>
            </tr>
          </table>
        </div>

        <!-- Summary Statistics Grid -->
        <div style="padding: 16px 20px; background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px;">
            Monthly Summary Statistics
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px; border: 1px solid #e2e8f0;">
            <tr style="background-color: #f1f5f9; font-weight: 800; font-size: 10px; color: #475569; text-transform: uppercase;">
              <th style="padding: 8px 4px; border: 1px solid #cbd5e1;">T Days</th>
              <th style="padding: 8px 4px; border: 1px solid #cbd5e1;">W Days</th>
              <th style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #7e22ce;">Leave</th>
              <th style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #b45309;">Late</th>
              <th style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #dc2626;">Absent</th>
              <th style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #047857;">Worked</th>
            </tr>
            <tr style="font-weight: 800; font-family: monospace; font-size: 13px; background-color: #ffffff;">
              <td style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #334155;">${row.totalDays}</td>
              <td style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #334155;">${row.workingDays}</td>
              <td style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #7e22ce;">${formatDecimalCount(row.leaveCount)}</td>
              <td style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #b45309;">${row.lateCount}</td>
              <td style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #dc2626;">${formatDecimalCount(row.absentCount)}</td>
              <td style="padding: 8px 4px; border: 1px solid #cbd5e1; color: #047857; font-weight: 900; background-color: #f0fdf4;">${formatDecimalCount(row.workedDays)}</td>
            </tr>
          </table>
        </div>

        <!-- Daily Punch Log -->
        <div style="padding: 16px 20px;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px;">
            Daily Attendance Records & Remarks
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #334155; font-weight: 800; text-transform: uppercase; font-size: 10px;">
                <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; width: 45%;">Date (BS)</th>
                <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; width: 35%;">Punch Timings / Remarks</th>
                <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; width: 20%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${dayRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 14px 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">
          <div>This is an official automated attendance statement from <strong>Ratauli Saving and Credit Cooperative Ltd</strong>.</div>
          <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">For inquiries, contact HR / Administration at Ratauli SACCOS.</div>
        </div>

      </div>
    `;
  };

  // Generate downloadable employee attendance PDF base64 matching the new title & branch
  const generateEmployeeAttendancePdfBase64 = (row: any): string => {
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 12;
      let y = 14;

      const rawMonth = NEPALI_MONTHS[selectedMonth - 1] || 'Shrawan';
      const displayMonthName = rawMonth === 'Shrawan' ? 'Sharwan' : rawMonth;
      const branchName = getEmployeeBranchName(row.employee);

      // Deep emerald green header
      pdf.setFillColor(4, 78, 41);
      pdf.roundedRect(margin, y, pageWidth - (margin * 2), 26, 3, 3, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RATAULI SAVING AND CREDIT COOPERATIVE LTD', pageWidth / 2, y + 8, { align: 'center' });

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Pipra Rural Municipality -6, Mahottari', pageWidth / 2, y + 13, { align: 'center' });

      // Yellow banner: Attendance 2083 Sharwan
      pdf.setFillColor(0, 0, 0);
      pdf.roundedRect(margin + 25, y + 16.5, pageWidth - (margin * 2) - 50, 6.5, 1.5, 1.5, 'F');
      pdf.setTextColor(254, 240, 138);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`ATTENDANCE ${selectedYear} ${displayMonthName.toUpperCase()}`, pageWidth / 2, y + 21, { align: 'center' });

      y += 32;

      // Employee Info Box with Branch
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y, pageWidth - (margin * 2), 16, 2, 2, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, y, pageWidth - (margin * 2), 16, 2, 2, 'S');

      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Employee Name: ${row.employee.fullName.toUpperCase()}`, margin + 5, y + 6);

      pdf.setTextColor(4, 120, 87);
      pdf.text(`Branch: ${branchName}`, margin + 5, y + 11.5);

      pdf.setTextColor(71, 85, 105);
      pdf.text(`Post: ${row.employee.department || 'General'} (${row.employee.designation || 'Staff'})`, pageWidth / 2 + 10, y + 11.5);

      y += 22;

      // Summary Statistics bar
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(margin, y, pageWidth - (margin * 2), 12, 'S');

      const colW = (pageWidth - (margin * 2)) / 6;
      const statsHeaders = ['T DAYS', 'W DAYS', 'LEAVE', 'LATE', 'ABSENT', 'WORKED'];
      const statsValues = [
        row.totalDays, 
        row.workingDays, 
        formatDecimalCount(row.leaveCount), 
        row.lateCount, 
        formatDecimalCount(row.absentCount), 
        formatDecimalCount(row.workedDays)
      ];
      statsHeaders.forEach((h, idx) => {
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text(h, margin + (idx * colW) + (colW / 2), y + 4.5, { align: 'center' });
        pdf.setTextColor(idx === 5 ? 4 : 15, idx === 5 ? 120 : 23, idx === 5 ? 87 : 42);
        pdf.setFontSize(9);
        pdf.text(String(statsValues[idx]), margin + (idx * colW) + (colW / 2), y + 9.5, { align: 'center' });
      });

      y += 18;

      // Daily records table header
      pdf.setFillColor(4, 78, 41);
      pdf.rect(margin, y, pageWidth - (margin * 2), 7, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Date (BS)', margin + 15, y + 4.8);
      pdf.text('Punch Timings / Remarks', margin + 65, y + 4.8);
      pdf.text('Status', pageWidth - margin - 20, y + 4.8, { align: 'center' });

      y += 7;

      monthDays.forEach(dInfo => {
        const rec = row.days[dInfo.dayNumber];
        let timingStr = '-';
        let statusStr = 'Absent';

        if (dInfo.isWeekend) {
          timingStr = 'Weekend';
          statusStr = 'Weekend';
        } else if (rec) {
          if (rec.status === 'Absent') {
            if (rec.remarks) {
              timingStr = rec.remarks; // Absent is removed, remark displayed!
              statusStr = rec.remarks;
            } else {
              timingStr = 'Absent (00:00 | 00:00)';
              statusStr = 'Absent';
            }
          } else if (rec.status === 'On Leave') {
            timingStr = rec.remarks ? `Leave (${rec.remarks})` : 'Leave';
            statusStr = 'On Leave';
          } else {
            timingStr = `${rec.inTime || '09:00'} | ${rec.outTime || '17:00'}${rec.remarks ? ' • ' + rec.remarks : ''}`;
            statusStr = rec.status;
          }
        }

        pdf.setFillColor(dInfo.isWeekend ? 248 : 255, dInfo.isWeekend ? 250 : 255, dInfo.isWeekend ? 252 : 255);
        pdf.rect(margin, y, pageWidth - (margin * 2), 5.5, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, y + 5.5, pageWidth - margin, y + 5.5);

        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(dInfo.colHeader, margin + 15, y + 4);

        pdf.setTextColor(15, 23, 42);
        pdf.text(timingStr, margin + 65, y + 4);

        pdf.setTextColor(statusStr === 'Absent' ? 220 : 4, statusStr === 'Absent' ? 38 : 120, statusStr === 'Absent' ? 38 : 87);
        pdf.setFont('helvetica', 'bold');
        pdf.text(statusStr, pageWidth - margin - 20, y + 4, { align: 'center' });

        y += 5.5;
        if (y > 275) {
          pdf.addPage();
          y = 15;
        }
      });

      return pdf.output('datauristring');
    } catch (err) {
      console.warn('PDF generation fallback:', err);
      return '';
    }
  };

  // Direct send email on button click - NO confirmation page/modal opened
  const handleDirectSendEmail = async (row: any) => {
    const empId = row.employee.id;
    const recipientEmail = (row.employee.email || '').trim() || 'ckmmandal@gmail.com';
    const rawMonth = NEPALI_MONTHS[selectedMonth - 1] || 'Shrawan';
    const displayMonthName = rawMonth === 'Shrawan' ? 'Sharwan' : rawMonth;

    try {
      setSendingEmailEmpId(empId);
      setToastNotification({
        type: 'success',
        message: `Sending attendance report to ${row.employee.fullName} (${recipientEmail})...`
      });

      const htmlContent = generateEmployeeAttendanceHtml(row);
      const pdfBase64 = generateEmployeeAttendancePdfBase64(row);

      const res = await sendAttendanceReportEmailApi({
        to: recipientEmail,
        employeeName: row.employee.fullName,
        employeeCode: row.employee.employeeCode,
        department: row.employee.department,
        designation: row.employee.designation,
        monthName: displayMonthName,
        yearBs: selectedYear,
        totalDays: row.totalDays,
        workingDays: row.workingDays,
        workedDays: row.workedDays,
        leaveDays: row.leaveCount,
        lateDays: row.lateCount,
        absentDays: row.absentCount,
        htmlContent,
        pdfBase64,
        logoUrl: effectiveLogoUrl,
        subject: `Attendance ${selectedYear} ${displayMonthName} - ${row.employee.fullName}`
      });

      if (res.success) {
        setSentEmailSuccessEmpId(empId);
        setToastNotification({
          type: 'success',
          message: `Attendance report successfully sent to ${row.employee.fullName} (${recipientEmail})!`
        });
        setTimeout(() => {
          setSentEmailSuccessEmpId(null);
        }, 4000);
      } else {
        setToastNotification({
          type: 'error',
          message: `Failed to send email to ${row.employee.fullName}: ${res.message}`
        });
      }
    } catch (err: any) {
      console.error('Direct email error:', err);
      setToastNotification({
        type: 'error',
        message: `Error sending email: ${err?.message || 'Network error'}`
      });
    } finally {
      setSendingEmailEmpId(null);
    }
  };

  // One-click send email to ALL employees directly without opening page/modal
  const handleDirectSendAllEmails = async () => {
    if (monthlyMatrixData.length === 0) return;
    const rawMonth = NEPALI_MONTHS[selectedMonth - 1] || 'Shrawan';
    const displayMonthName = rawMonth === 'Shrawan' ? 'Sharwan' : rawMonth;

    try {
      setIsSendingBatch(true);
      const total = monthlyMatrixData.length;
      let successCount = 0;

      for (let i = 0; i < total; i++) {
        const row = monthlyMatrixData[i];
        const empId = row.employee.id;
        const recipientEmail = (row.employee.email || '').trim() || 'ckmmandal@gmail.com';

        setBatchEmailProgress({ current: i + 1, total });
        setBatchEmailStatuses(prev => ({
          ...prev,
          [empId]: { status: 'sending' }
        }));

        try {
          const htmlContent = generateEmployeeAttendanceHtml(row);
          const pdfBase64 = generateEmployeeAttendancePdfBase64(row);

          const res = await sendAttendanceReportEmailApi({
            to: recipientEmail,
            employeeName: row.employee.fullName,
            employeeCode: row.employee.employeeCode,
            department: row.employee.department,
            designation: row.employee.designation,
            monthName: displayMonthName,
            yearBs: selectedYear,
            totalDays: row.totalDays,
            workingDays: row.workingDays,
            workedDays: row.workedDays,
            leaveDays: row.leaveCount,
            lateDays: row.lateCount,
            absentDays: row.absentCount,
            htmlContent,
            pdfBase64,
            logoUrl: effectiveLogoUrl,
            subject: `Attendance ${selectedYear} ${displayMonthName} - ${row.employee.fullName}`
          });

          if (res.success) successCount++;

          setBatchEmailStatuses(prev => ({
            ...prev,
            [empId]: { status: res.success ? 'sent' : 'error', message: res.message }
          }));
        } catch (err: any) {
          setBatchEmailStatuses(prev => ({
            ...prev,
            [empId]: { status: 'error', message: err?.message || 'Failed' }
          }));
        }

        // Small delay between sends to avoid rate limiting
        await new Promise(r => setTimeout(r, 400));
      }

      setToastNotification({
        type: 'success',
        message: `Completed! Sent ${successCount} of ${total} attendance reports successfully.`
      });
    } catch (err: any) {
      setToastNotification({
        type: 'error',
        message: `Batch send error: ${err?.message || 'Failed'}`
      });
    } finally {
      setIsSendingBatch(false);
      setBatchEmailProgress(null);
    }
  };

  // Single record manual edit/save with remarks persistence
  const handleSaveManualRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) return;
    if (!editingRecord?.employeeId || !editingRecord?.date) {
      alert('Employee and Date are required.');
      return;
    }
    if (isBackDateBlockedForEntry(editingRecord.date)) {
      alert(getBackDateBlockedMessage(editingRecord.date));
      return;
    }

    try {
      setIsSavingRecord(true);
      const targetEmp = effectiveEmployees.find(emp => emp.id === editingRecord.employeeId);
      
      // Find if record already exists for this employee on this date
      const existingRec = attendanceList.find(r => 
        r.employeeId === editingRecord.employeeId && 
        (r.date === editingRecord.date || r.dateBs === editingRecord.date)
      );

      const updatedRecord: AttendanceRecord = {
        id: editingRecord.id || existingRec?.id || `att_manual_${Date.now()}`,
        employeeId: editingRecord.employeeId,
        employeeCode: targetEmp?.employeeCode || editingRecord.employeeCode || '-',
        employeeName: targetEmp?.fullName || editingRecord.employeeName || 'Staff',
        date: editingRecord.date,
        dateBs: editingRecord.date,
        inTime: editingRecord.inTime || undefined,
        outTime: editingRecord.outTime || undefined,
        workHours: calculateWorkHours(editingRecord.inTime, editingRecord.outTime),
        status: editingRecord.status || 'Present',
        remarks: editingRecord.remarks?.trim() || undefined,
        branchId: targetEmp?.branchId || currentBranch?.id || 'main',
        source: 'manual',
        createdAt: existingRec?.createdAt || Date.now()
      };

      await storageService.saveAttendanceRecords([updatedRecord]);
      
      // Update local state immediately so user sees remarks instantly
      setAttendanceList(prev => {
        const filtered = prev.filter(r => 
          r.id !== updatedRecord.id && 
          !(r.employeeId === updatedRecord.employeeId && (r.date === updatedRecord.date || r.dateBs === updatedRecord.date))
        );
        return [...filtered, updatedRecord];
      });

      setEditingRecord(null);
    } catch (err) {
      console.error('Failed to save manual record:', err);
      alert('Failed to save record.');
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (isDayEnded) return;
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await storageService.deleteAttendanceRecord(id);
      await loadAttendance();
      setToastNotification({
        type: 'success',
        message: 'Attendance record deleted successfully.'
      });
    } catch (err) {
      console.error('Failed to delete attendance record:', err);
      setToastNotification({
        type: 'error',
        message: 'Failed to delete attendance record.'
      });
    }
  };

  // Direct row-level delete for an employee's records in the currently selected BS month
  const handleDeleteEmployeeRow = async (emp: Employee) => {
    if (isDayEnded) return;
    const monthName = NEPALI_MONTHS[selectedMonth - 1];
    const confirmMsg = `के तपाईं "${emp.fullName}" को ${monthName} ${selectedYear} को सबै हाजिरी विवरण मेटाउन निश्चित हुनुहुन्छ?\n(Are you sure you want to delete all attendance records for "${emp.fullName}" for ${monthName} ${selectedYear}?)`;
    if (!window.confirm(confirmMsg)) {
      return;
    }
    try {
      setIsLoading(true);
      const mStr = String(selectedMonth).padStart(2, '0');
      const prefixDash = `${selectedYear}-${mStr}`;
      const prefixSlash = `${selectedYear}/${mStr}`;
      const empNameNorm = (emp.fullName || '').trim().toLowerCase();
      const empCodeNorm = (emp.employeeCode || '').trim().toLowerCase();

      // 1. Immediately update UI state
      setAttendanceList(prev => prev.filter(r => {
        const matchMonth = (r.dateBs && (r.dateBs.startsWith(prefixDash) || r.dateBs.startsWith(prefixSlash))) ||
                           (r.date && (r.date.startsWith(prefixDash) || r.date.startsWith(prefixSlash)));
        const rName = (r.employeeName || '').trim().toLowerCase();
        const rCode = (r.employeeCode || '').trim().toLowerCase();
        const matchEmp = r.employeeId === emp.id || 
                         (empNameNorm && rName === empNameNorm) ||
                         (empCodeNorm && rCode === empCodeNorm) ||
                         (r.employeeId && (r.employeeId.endsWith(emp.id) || emp.id.endsWith(r.employeeId)));
        
        return !(matchMonth && matchEmp);
      }));

      // 2. Persist deletion in storageService and Supabase
      await storageService.deleteAttendanceByEmployee(emp.id, selectedYear, selectedMonth, emp.fullName);

      // If the employee is an auto-generated row (e.g. from Excel) or duplicate, remove the employee record
      if (emp.id.startsWith('emp_') || isSameEmployeeName(emp.fullName, 'KAMANI DEVI KARN')) {
        await storageService.deleteEmployee(emp.id).catch(() => {});
      }

      setToastNotification({
        type: 'success',
        message: `${emp.fullName} को ${monthName} ${selectedYear} को हाजिरी सफलतापूर्वक मेटाइयो।`
      });

      // 3. Reload from storage to ensure consistency
      await loadAttendance();
    } catch (err) {
      console.error('Failed to delete employee attendance:', err);
      setToastNotification({
        type: 'error',
        message: `रेकर्ड मेटाउन समस्या भयो: ${err instanceof Error ? err.message : String(err)}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  // One-click cleanup for duplicate employees and empty ghost rows
  const handleCleanDuplicatesAndEmpty = async () => {
    if (isDayEnded) return;
    if (!window.confirm("के तपाईं डेटा नभएका तथा दोहोरिएका कर्मचारी (जस्तै खाली रो, दोहोरिएको नाम) स्वतः सफा तथा मर्ज गर्न चाहनुहुन्छ?")) {
      return;
    }
    try {
      setIsLoading(true);
      const idsToDelete = new Set<string>();

      // 1. Check for duplicate names across effectiveEmployees
      for (let i = 0; i < effectiveEmployees.length; i++) {
        for (let j = i + 1; j < effectiveEmployees.length; j++) {
          const e1 = effectiveEmployees[i];
          const e2 = effectiveEmployees[j];
          if (isSameEmployeeName(e1.fullName, e2.fullName)) {
            // Keep the official HR employee record
            const keep = !e1.id.startsWith('emp_') && (e1.employeeCode && e1.employeeCode !== '-') ? e1 : e2;
            const drop = keep === e1 ? e2 : e1;
            idsToDelete.add(drop.id);
          }
        }
      }

      // 2. Identify ghost emp_ IDs or names that have no real punch timings in attendance
      const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      effectiveEmployees.forEach(e => {
        if (e.id.startsWith('emp_') || isSameEmployeeName(e.fullName, 'KAMANI DEVI KARN')) {
          const punches = attendanceList.filter(r => 
            (r.employeeId === e.id || isSameEmployeeName(r.employeeName, e.fullName)) &&
            (r.dateBs?.startsWith(monthPrefix) || r.date?.startsWith(monthPrefix)) &&
            Boolean(r.inTime || r.outTime)
          );
          if (punches.length === 0) {
            idsToDelete.add(e.id);
          }
        }
      });

      // Always include emp_kamani_devi_karn if KAMNI exists
      if (effectiveEmployees.some(e => isSameEmployeeName(e.fullName, 'KAMNI DEVI KARN'))) {
        idsToDelete.add('emp_kamani_devi_karn');
      }

      for (const id of idsToDelete) {
        await storageService.deleteAttendanceByEmployee(id).catch(() => {});
        await storageService.deleteEmployee(id).catch(() => {});
      }

      setAttendanceList(prev => prev.filter(r => !idsToDelete.has(r.employeeId)));
      await loadAttendance();

      setToastNotification({
        type: 'success',
        message: 'दोहोरिएका तथा डेटा नभएका कर्मचारीहरू सफलतापूर्वक सफा गरियो!'
      });
    } catch (e: any) {
      console.error('Failed to clean duplicates:', e);
      setToastNotification({
        type: 'error',
        message: 'सफा गर्दा समस्या भयो।'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Count of matching records for deletion modal
  const affectedDeleteCount = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    return attendanceList.filter(r => {
      const matchMonth = (r.dateBs && r.dateBs.startsWith(monthPrefix)) || (r.date && r.date.startsWith(monthPrefix));
      const matchBranch = !filterBranch || filterBranch === 'ALL' || r.branchId === filterBranch;
      if (!matchMonth || !matchBranch) return false;
      if (deleteScope === 'employee') {
        return r.employeeId === deleteTargetEmployeeId;
      }
      if (deleteScope === 'manual') {
        return r.source === 'manual' || !!r.remarks;
      }
      return true;
    }).length;
  }, [attendanceList, selectedYear, selectedMonth, filterBranch, deleteScope, deleteTargetEmployeeId]);

  // Execute confirmed deletion
  const handleConfirmDeleteData = async () => {
    if (isDayEnded) return;
    try {
      setIsDeletingData(true);
      const mStr = String(selectedMonth).padStart(2, '0');
      const prefixDash = `${selectedYear}-${mStr}`;
      const prefixSlash = `${selectedYear}/${mStr}`;
      const isAll = !filterBranch || filterBranch === 'ALL' || filterBranch.toLowerCase() === 'all';

      // Instantly update UI state
      setAttendanceList(prev => prev.filter(r => {
        const matchMonth = (r.dateBs && (r.dateBs.startsWith(prefixDash) || r.dateBs.startsWith(prefixSlash))) ||
                           (r.date && (r.date.startsWith(prefixDash) || r.date.startsWith(prefixSlash)));
        const matchBranch = isAll || r.branchId === filterBranch || (r.branchId || 'main') === filterBranch;
        if (!matchMonth || !matchBranch) return true; // keep
        if (deleteScope === 'employee') {
          return r.employeeId !== deleteTargetEmployeeId; // keep other employees
        }
        if (deleteScope === 'manual') {
          return !(r.source === 'manual' || !!r.remarks); // keep non-manual
        }
        return false; // remove for entire month
      }));

      // Persist flag so loadAttendance never re-seeds empty table
      localStorage.setItem('saccos_attendance_initialized', 'true');

      if (deleteScope === 'month') {
        await storageService.deleteAttendanceByMonth(selectedYear, selectedMonth, filterBranch);
        setToastNotification({
          type: 'success',
          message: `Attendance records for ${NEPALI_MONTHS[selectedMonth - 1]} ${selectedYear} deleted.`
        });
      } else if (deleteScope === 'employee') {
        const targetEmp = effectiveEmployees.find(e => e.id === deleteTargetEmployeeId);
        await storageService.deleteAttendanceByEmployee(deleteTargetEmployeeId, selectedYear, selectedMonth, targetEmp?.fullName);
        setToastNotification({
          type: 'success',
          message: `Attendance records for ${targetEmp?.fullName || 'employee'} in ${NEPALI_MONTHS[selectedMonth - 1]} ${selectedYear} deleted.`
        });
      } else if (deleteScope === 'manual') {
        await storageService.deleteManualAttendanceOnly(selectedYear, selectedMonth, filterBranch);
        setToastNotification({
          type: 'success',
          message: `Manual punch records for ${NEPALI_MONTHS[selectedMonth - 1]} ${selectedYear} deleted.`
        });
      }
      await loadAttendance();
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error('Failed to delete attendance records:', err);
      setToastNotification({
        type: 'error',
        message: 'Failed to delete attendance records.'
      });
    } finally {
      setIsDeletingData(false);
    }
  };

  // Find existing punch for current modal selection
  const existingPunchRecord = useMemo(() => {
    if (!editingRecord?.employeeId || !editingRecord?.date) return null;
    return attendanceList.find(r => 
      r.employeeId === editingRecord.employeeId && 
      (r.date === editingRecord.date || r.dateBs === editingRecord.date)
    );
  }, [editingRecord?.employeeId, editingRecord?.date, attendanceList]);

  // Execute print via isolated hidden iframe for reliable printing in iframe
  const handleExecutePrint = () => {
    const printContent = document.getElementById('attendance-printable-area');
    if (!printContent) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Report - ${selectedYear} ${NEPALI_MONTHS[selectedMonth - 1]}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 4mm;
            }
            * {
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              margin: 0;
              padding: 0;
              color: #0f172a;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: auto;
            }
            th, td {
              border: 1px solid #94a3b8;
              padding: 1.5px 0.5px;
              text-align: center;
              font-size: 7.5px;
              line-height: 1.1;
              word-break: break-word;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: 800;
              color: #0f172a;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // ignore
        }
      }, 1000);
    }, 400);
  };

  // Seed or reload reference sample data matching biometric export
  const handleLoadDemoData = async () => {
    if (isDayEnded) return;
    try {
      setIsLoading(true);
      const staff = effectiveEmployees;
      const demo = generateBiometricDemoRecords(selectedYear, selectedMonth, staff);
      await storageService.saveAttendanceRecords(demo);
      setAttendanceList(demo);
    } catch (e) {
      console.error('Failed to load demo attendance:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // REPORT CALCULATIONS & FILTERING
  // -------------------------------------------------------------

  // 1. Filtered & Sorted Employees:
  // Branch Order: Head Office -> Sahobda -> Pipra -> Parsa -> Other
  // Head Office: Employee ID ascending
  // Other Branches: Employee Name ascending (A to Z)
  const filteredEmployees = useMemo(() => {
    const list = effectiveEmployees.filter(emp => {
      if (filterBranch !== 'ALL' && emp.branchId && emp.branchId !== filterBranch) return false;
      if (filterDepartment !== 'ALL' && emp.department && emp.department !== filterDepartment) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const code = (emp.employeeCode || '').toLowerCase();
        const name = (emp.fullName || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q)) return false;
      }
      return true;
    });

    return list.slice().sort((a, b) => compareEmployees(a, b, effectiveBranches));
  }, [effectiveEmployees, filterBranch, filterDepartment, searchQuery, effectiveBranches]);

  // 2. Daily Report Data
  const dailyReportData = useMemo(() => {
    // Map existing records for the selectedDate by employeeId
    const recordMap = new Map<string, AttendanceRecord>();
    attendanceList.forEach(r => {
      if (r.date === selectedDate || r.dateBs === selectedDate) {
        recordMap.set(r.employeeId, r);
      }
    });

    return filteredEmployees.map(emp => {
      const record = recordMap.get(emp.id);
      return {
        employee: emp,
        recordId: record?.id,
        employeeId: emp.id,
        employeeCode: emp.employeeCode || '-',
        employeeName: emp.fullName,
        designation: emp.designation,
        department: emp.department,
        date: selectedDate,
        inTime: record?.inTime || '',
        outTime: record?.outTime || '',
        workHours: record?.workHours,
        status: (record?.status || 'Absent') as AttendanceStatus,
        remarks: record?.remarks || '',
        hasRecord: Boolean(record)
      };
    }).filter(row => {
      if (filterStatus === 'ALL') return true;
      return row.status === filterStatus;
    });
  }, [filteredEmployees, attendanceList, selectedDate, filterStatus]);

  // 3. Monthly Matrix Data
  const monthlyMatrixData = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const daysInMonth = monthDays.length;
    const workingDaysCount = monthDays.filter(d => !d.isWeekend).length;

    // Group attendance by employeeId and day number
    const map = new Map<string, Map<number, AttendanceRecord>>();
    
    attendanceList.forEach(r => {
      const dStr = r.dateBs || r.date;
      if (dStr && dStr.startsWith(monthPrefix)) {
        const parts = dStr.split('-');
        if (parts.length === 3) {
          const dayNum = parseInt(parts[2], 10);

          // Find which filtered employee this record belongs to:
          // 1. Direct ID match
          let targetEmp = filteredEmployees.find(e => e.id === r.employeeId);
          // 2. Code or fuzzy name match if ID did not match directly
          if (!targetEmp) {
            targetEmp = filteredEmployees.find(e => 
              (cleanEmployeeCode(r.employeeCode) && cleanEmployeeCode(e.employeeCode) === cleanEmployeeCode(r.employeeCode)) ||
              isSameEmployeeName(e.fullName, r.employeeName)
            );
          }

          const targetId = targetEmp ? targetEmp.id : r.employeeId;

          if (!map.has(targetId)) {
            map.set(targetId, new Map());
          }
          const empDaysMap = map.get(targetId)!;
          const existing = empDaysMap.get(dayNum);
          
          let sanitizedRecord = r;
          if ((r.inTime || r.outTime) && r.remarks && r.remarks.includes('Holiday Worked')) {
            const cleanedRemarks = r.remarks
              .replace(/\s*\|\s*[^|]*Holiday Worked[^|)]*\)?/gi, '')
              .replace(/[^|]*Holiday Worked[^|)]*\)?\s*\|\s*/gi, '')
              .replace(/[^|]*Holiday Worked[^|)]*\)?/gi, '')
              .trim();
            sanitizedRecord = {
              ...r,
              remarks: cleanedRemarks || undefined
            };
          }

          // Prefer record with valid inTime or actual work status
          if (!existing || (!existing.inTime && sanitizedRecord.inTime)) {
            empDaysMap.set(dayNum, sanitizedRecord);
          }
        }
      }
    });

    const rows = filteredEmployees.map(emp => {
      const daysMap = map.get(emp.id) || new Map();
      const days: Record<number, AttendanceRecord | undefined> = {};
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let holidayCount = 0;
      let workedDays = 0;

      monthDays.forEach(dInfo => {
        const d = dInfo.dayNumber;
        const rec = daysMap.get(d);
        days[d] = rec;
        if (rec) {
          if (rec.status === 'Present') {
            presentCount++;
            workedDays++;
          } else if (rec.status === 'Late') {
            lateCount++;
            workedDays++;
          } else if (rec.status === 'Half Day') {
            workedDays += 0.5;
            absentCount += 0.5;
          } else if (rec.status === 'On Leave') {
            leaveCount++;
          } else if (rec.status === 'Holiday') {
            holidayCount++;
          } else if (rec.status === 'Absent') {
            if (rec.remarks) {
              // Absent is replaced by manual punch remark, count as worked day
              workedDays++;
            } else {
              absentCount++;
            }
          }
        }
      });

      const totalRecorded = presentCount + absentCount + lateCount + leaveCount + holidayCount;
      const attendanceRate = workingDaysCount > 0 
        ? Math.round((workedDays / workingDaysCount) * 100)
        : 0;

      return {
        employee: emp,
        days,
        totalDays: daysInMonth,
        workingDays: workingDaysCount,
        presentCount: Number(presentCount.toFixed(1)),
        absentCount: Number(absentCount.toFixed(1)),
        lateCount,
        leaveCount: Number(leaveCount.toFixed(1)),
        holidayCount,
        workedDays: Number(workedDays.toFixed(1)),
        totalRecorded,
        attendanceRate
      };
    });

    // Exclude any auto-created or ghost duplicate employee with 0 records
    return rows.filter(row => {
      if (row.employee.id.startsWith('emp_') && row.totalRecorded === 0) {
        return false;
      }
      return true;
    });
  }, [filteredEmployees, attendanceList, selectedYear, selectedMonth, monthDays]);

  // Detected public holidays in the active BS month (for badges, column highlights & tooltips)
  const monthHolidaysMap = useMemo(() => {
    const hMap = new Map<number, string>();
    const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    attendanceList.forEach(rec => {
      if (rec.status === 'Holiday') {
        const dStr = rec.dateBs || rec.date || '';
        if (dStr.startsWith(monthPrefix)) {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            const dayNum = parseInt(parts[2], 10);
            if (!hMap.has(dayNum)) {
              hMap.set(dayNum, rec.remarks || 'सार्वजनिक बिदा');
            }
          }
        }
      }
    });
    return hMap;
  }, [attendanceList, selectedYear, selectedMonth]);

  // Helper for status badge styling
  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Present':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Present</span>;
      case 'Late':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Late</span>;
      case 'Half Day':
        return <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Half Day</span>;
      case 'On Leave':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">On Leave</span>;
      case 'Holiday':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Holiday</span>;
      case 'Weekly Off':
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Off</span>;
      case 'Absent':
      default:
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Absent</span>;
    }
  };

  // Helper to render consistent printable attendance report for both Print Preview and PDF Export
  const renderPrintableReport = (containerId: string) => {
    const rawMonth = NEPALI_MONTHS[selectedMonth - 1] || 'Shrawan';
    const displayMonthName = rawMonth === 'Shrawan' ? 'Sharwan' : rawMonth;

    return (
      <div id={containerId} className="bg-white p-4 sm:p-5 text-slate-900 w-full">
        {/* Official Cooperative Header with White Background, Admin Center Logo, Branch Name & Centered Title */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '14px 20px', borderRadius: '8px', textAlign: 'center', marginBottom: '14px', border: '1.5px solid #cbd5e1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            
            {/* Admin Center Logo on Left - Clean without outer border */}
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {effectiveLogoUrl ? (
                <img
                  src={effectiveLogoUrl}
                  alt="Logo"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={(e: any) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.fallback-emblem');
                    if (fallback) (fallback as HTMLElement).style.display = 'block';
                  }}
                />
              ) : null}
              <div className="fallback-emblem" style={{ width: '100%', height: '100%', display: effectiveLogoUrl ? 'none' : 'block' }}>
                <DefaultCoopEmblem />
              </div>
            </div>

            {/* Cooperative Info & Centered Title */}
            <div style={{ textAlign: 'center', margin: '0 auto', maxWidth: '720px' }}>
              <div style={{ fontSize: '19px', fontWeight: 900, color: '#044e29', lineHeight: '1.25' }}>
                रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.8px', marginTop: '2px' }}>
                RATAULI SAVING AND CREDIT COOPERATIVE LTD
              </div>
              <div style={{ fontSize: '11px', color: '#475569', opacity: 0.95, marginTop: '2px', fontWeight: 600 }}>
                पिपरा गाउँपालिका -६, महोत्तरी
              </div>

              {/* Branch Name directly above Attendance */}
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#044e29', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '6px' }}>
                Branch: {selectedBranchDisplayName}
              </div>

              {/* Centered Attendance 2083 Sharwan */}
              <div style={{ marginTop: '4px' }}>
                <span style={{ display: 'inline-block', backgroundColor: '#f0fdf4', color: '#044e29', border: '1.5px solid #86efac', padding: '3px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: 900, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  Attendance {selectedYear} {displayMonthName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Table Preview: Month-wide, no Branch/Post column, with Signature column */}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-[8.5px] leading-tight" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold">
                <th className="border border-slate-300 px-1 py-1 text-center w-6">S.N.</th>
                <th className="border border-slate-300 px-2 py-1 text-left whitespace-nowrap min-w-[120px]">Employee Name</th>
                <th className="border border-slate-300 px-1 py-1 text-center bg-emerald-50 text-emerald-800 w-7" title="Worked Days">Worked</th>
                <th className="border border-slate-300 px-0.5 py-1 text-center text-slate-700 w-6" title="Present Days">Pres</th>
                <th className="border border-slate-300 px-0.5 py-1 text-center text-amber-700 w-6" title="Late Days">Late</th>
                <th className="border border-slate-300 px-0.5 py-1 text-center text-rose-700 w-6" title="Absent Days">Abs</th>
                <th className="border border-slate-300 px-0.5 py-1 text-center text-purple-700 w-6" title="Leave Days">Leave</th>
                <th className="border border-slate-300 px-0.5 py-1 text-center text-indigo-700 w-6" title="Public Holiday Days">Hol</th>
                {monthDays.map(d => {
                  const isHoliday = monthHolidaysMap.has(d.dayNumber);
                  return (
                    <th key={d.dayNumber} className={`border border-slate-300 px-0.5 py-0.5 text-center min-w-[17px] ${isHoliday ? 'bg-indigo-50 text-indigo-800' : d.isWeekend ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-800'}`}>
                      <div className="font-bold text-[8px] leading-tight">{d.dayNumber}</div>
                      <div className="text-[6.5px] font-normal uppercase leading-tight">{isHoliday ? 'HOL' : d.dayName.slice(0, 3)}</div>
                    </th>
                  );
                })}
                <th className="border border-slate-300 px-1 py-1 text-center font-bold text-[8px] bg-slate-100 text-slate-800 whitespace-nowrap min-w-[70px]">
                  Signature<br/><span className="text-[7px] font-normal text-slate-600">(दस्तखत)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlyMatrixData.map((row, idx) => (
                <tr key={row.employee.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                  <td className="border border-slate-300 px-0.5 py-1 text-center font-bold text-slate-600 text-[8px]">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-bold text-slate-900 text-left whitespace-nowrap text-[8.5px]">{row.employee.fullName}</td>
                  <td className="border border-slate-300 px-0.5 py-1 text-center font-black text-emerald-800 bg-emerald-50/40 text-[8.5px]">{formatDecimalCount(row.workedDays)}</td>
                  <td className="border border-slate-300 px-0.5 py-1 text-center font-bold text-slate-700 text-[8px]">{formatDecimalCount(row.presentCount)}</td>
                  <td className="border border-slate-300 px-0.5 py-1 text-center font-bold text-amber-700 text-[8px]">{row.lateCount}</td>
                  <td className="border border-slate-300 px-0.5 py-1 text-center font-bold text-rose-700 text-[8px]">{formatDecimalCount(row.absentCount)}</td>
                  <td className="border border-slate-300 px-0.5 py-1 text-center font-bold text-purple-700 text-[8px]">{formatDecimalCount(row.leaveCount)}</td>
                  <td className="border border-slate-300 px-0.5 py-1 text-center font-bold text-indigo-700 text-[8px]">{row.holidayCount}</td>
                  {monthDays.map(d => {
                    const rec = row.days[d.dayNumber];
                    let label = '-';
                    let cellClass = 'text-slate-400';
                    if (d.isWeekend) {
                      label = 'W';
                      cellClass = 'bg-rose-50 text-rose-600 font-bold';
                    } else if (rec) {
                      if (rec.status === 'Present') {
                        label = 'P';
                        cellClass = 'text-emerald-700 font-bold';
                      } else if (rec.status === 'Late') {
                        label = 'L';
                        cellClass = 'text-amber-700 font-bold';
                      } else if (rec.status === 'Half Day') {
                        label = 'HD';
                        cellClass = 'text-sky-700 font-bold bg-sky-50';
                      } else if (rec.status === 'On Leave') {
                        label = 'LV';
                        cellClass = 'text-purple-700 font-bold';
                      } else if (rec.status === 'Holiday') {
                        label = 'H';
                        cellClass = 'bg-indigo-50 text-indigo-700 font-bold';
                      } else if (rec.status === 'Absent') {
                        label = rec.remarks ? rec.remarks.slice(0, 4) : 'A';
                        cellClass = 'text-rose-700 font-bold';
                      }
                    } else {
                      label = 'A';
                      cellClass = 'text-rose-600 font-semibold';
                    }
                    return (
                      <td key={d.dayNumber} className={`border border-slate-300 px-0.5 py-1 text-center text-[7.5px] ${cellClass}`}>
                        {label}
                      </td>
                    );
                  })}
                  <td className="border border-slate-300 px-1 py-1 text-center text-slate-300 min-w-[70px]">
                    &nbsp;
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures Area */}
        <div className="mt-8 pt-4 flex justify-between items-center text-[10px] font-bold text-slate-700 px-6">
          <div className="text-center">
            <div className="w-32 sm:w-36 border-t border-dashed border-slate-400 mb-1"></div>
            <div>तयार गर्ने (Prepared By)</div>
          </div>
          <div className="text-center">
            <div className="w-32 sm:w-36 border-t border-dashed border-slate-400 mb-1"></div>
            <div>जाँच गर्ने (Checked By)</div>
          </div>
          <div className="text-center">
            <div className="w-32 sm:w-36 border-t border-dashed border-slate-400 mb-1"></div>
            <div>स्वीकृत गर्ने (Approved By)</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-300">
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        
        {/* ========================================================= */}
        {/* TAB 1: UPLOAD ATTENDANCE (Excel / CSV)                     */}
        {/* ========================================================= */}
        {activeTab === 'upload' && (
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Top Navigation in upload mode */}
            <div className="flex items-center justify-between no-print">
              <button
                onClick={() => setActiveTab('report')}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            </div>
            
            {/* Guide & Template download card with integrated Year/Month selectors */}
            <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-blue-50 border border-emerald-200/80 rounded-3xl p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Left: Title */}
                <div className="flex items-center space-x-2.5 shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                    <FileSpreadsheet className="text-emerald-700" size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                      Excel Upload
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Select period & upload biometric attendance file
                    </p>
                  </div>
                </div>

                {/* Middle: Integrated BS Year & BS Month Selectors */}
                <div className="flex items-center space-x-3 bg-white/90 border border-emerald-200/80 rounded-2xl px-3.5 py-2 shadow-2xs">
                  <div className="flex items-center space-x-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                      BS Year
                    </label>
                    <select
                      value={uploadYear}
                      onChange={(e) => setUploadYear(Number(e.target.value))}
                      className="bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 shadow-2xs transition-all cursor-pointer"
                    >
                      {[2080, 2081, 2082, 2083, 2084, 2085].map(y => (
                        <option key={y} value={y}>{y} BS</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-px h-5 bg-slate-200" />

                  <div className="flex items-center space-x-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                      BS Month
                    </label>
                    <select
                      value={uploadMonth}
                      onChange={(e) => setUploadMonth(Number(e.target.value))}
                      className="bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 shadow-2xs transition-all cursor-pointer"
                    >
                      {NEPALI_MONTHS.map((m, idx) => (
                        <option key={m} value={idx + 1}>{m} ({idx + 1})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Right: Download Sample */}
                <button
                  onClick={downloadSampleTemplate}
                  className="bg-white hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-300 px-4 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-wider shadow-2xs transition-all flex items-center space-x-2 active:scale-95 shrink-0 cursor-pointer"
                >
                  <Download size={15} />
                  <span>Download Sample Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop File Upload Box */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                if (isDayEnded) {
                  e.preventDefault();
                  return;
                }
                handleDrop(e);
              }}
              className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all bg-white ${
                isDayEnded
                  ? 'border-slate-200 opacity-50 cursor-not-allowed'
                  : isProcessingFile 
                  ? 'border-emerald-500 bg-emerald-50/20 cursor-pointer' 
                  : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/10 cursor-pointer'
              }`}
              onClick={() => { if (!isDayEnded) fileInputRef.current?.click(); }}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls, .csv" 
                disabled={isDayEnded}
                onChange={handleFileUpload} 
                className="hidden" 
              />

              <div className="w-16 h-16 bg-emerald-100/70 text-emerald-700 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                <Upload size={30} className={isProcessingFile ? 'animate-bounce' : ''} />
              </div>

              {isProcessingFile && (
                <p className="text-sm font-bold text-emerald-700 mb-3">
                  Processing File...
                </p>
              )}

              <button
                type="button"
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="bg-slate-950 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Browse File
              </button>
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center space-x-3 text-rose-800 animate-in fade-in">
                <AlertCircle size={20} className="shrink-0 text-rose-600" />
                <p className="text-xs font-bold leading-relaxed">{uploadError}</p>
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedPreview.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="text-emerald-600" size={18} />
                      <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                        Parsed Records Preview {uploadFileName ? `• ${uploadFileName}` : ''} ({parsedPreview.length} Entries across {previewEmployeesCount} Staff)
                      </h4>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Verify matched employee names and attendance details before importing
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <button
                      onClick={() => setParsedPreview([])}
                      disabled={isProcessingFile}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all disabled:opacity-50"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleSaveParsedRecords}
                      disabled={isProcessingFile || isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                      className="flex-1 sm:flex-none bg-emerald-600 hover:bg-slate-950 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isProcessingFile ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>{savingProgress || 'Saving to System...'}</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Confirm & Save to System</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Summary stat pills of parsed batch */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block">Total Staff</span>
                    <span className="text-lg font-black text-indigo-900">{previewEmployeesCount}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Rows</span>
                    <span className="text-lg font-black text-slate-900">{parsedPreview.length}</span>
                  </div>
                  <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block">Present</span>
                    <span className="text-lg font-black text-emerald-700">
                      {parsedPreview.filter(p => p.status === 'Present').length}
                    </span>
                  </div>
                  <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 block">Late</span>
                    <span className="text-lg font-black text-amber-700">
                      {parsedPreview.filter(p => p.status === 'Late').length}
                    </span>
                  </div>
                  <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-600 block">Absent</span>
                    <span className="text-lg font-black text-rose-700">
                      {parsedPreview.filter(p => p.status === 'Absent').length}
                    </span>
                  </div>
                  <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-purple-700 block">Holidays</span>
                    <span className="text-lg font-black text-purple-800">
                      {parsedPreview.filter(p => p.status === 'Holiday').length}
                    </span>
                  </div>
                </div>

                {/* Search Filter for Preview */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search preview by employee name, code, date..."
                      value={previewSearch}
                      onChange={e => setPreviewSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  {previewSearch && (
                    <button
                      onClick={() => setPreviewSearch('')}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                    >
                      Clear Filter ({filteredPreview.length} shown)
                    </button>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest sticky top-0">
                      <tr>
                        <th className="p-3">SN</th>
                        <th className="p-3">Date (BS)</th>
                        <th className="p-3">Emp Code</th>
                        <th className="p-3">Employee Name</th>
                        <th className="p-3">In Time</th>
                        <th className="p-3">Out Time</th>
                        <th className="p-3">Work Hours</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {filteredPreview.slice(0, 100).map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                          <td className="p-3 font-mono text-slate-900">{row.dateBs || row.date}</td>
                          <td className="p-3 font-mono text-emerald-700">{row.employeeCode}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900">{row.employeeName}</span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">{row.inTime || '-'}</td>
                          <td className="p-3 font-mono text-slate-600">{row.outTime || '-'}</td>
                          <td className="p-3 font-mono text-slate-600">{row.workHours ? `${row.workHours} hrs` : '-'}</td>
                          <td className="p-3">{getStatusBadge(row.status)}</td>
                          <td className="p-3 text-[10px]">
                            {row.status === 'Holiday' ? (
                              <span className="inline-flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                <span>✦</span>
                                <span>{row.remarks || 'सार्वजनिक बिदा'}</span>
                              </span>
                            ) : (
                              <span className="text-slate-500">{row.remarks || '-'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredPreview.length > 100 && (
                  <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">
                    Showing first 100 rows of {filteredPreview.length}. All rows will be imported.
                  </p>
                )}
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ATTENDANCE REPORT & ANALYTICS                       */}
        {/* ========================================================= */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            
            {/* Filter Bar & Action Controls */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 no-print">
              <div className="flex flex-col lg:flex-row justify-end items-start lg:items-center gap-4">

                {/* Right Action buttons: Upload, Manual Punch, Export & Print */}
                <div className="flex items-center space-x-2 flex-wrap gap-2 w-full justify-end">
                  <button
                    onClick={handleLoadDemoData}
                    disabled={isDayEnded}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-sm transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Load Shrawan 2083 biometric attendance sheet matching reference image"}
                  >
                    <Sparkles size={13} />
                    <span>Load Reference Data</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('upload')}
                    className="bg-slate-900 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-sm transition-all flex items-center space-x-1.5 active:scale-95"
                  >
                    <Upload size={13} />
                    <span>Upload</span>
                  </button>

                  <button
                    onClick={() => {
                      if (isDayEnded) return;
                      setEditingRecord({
                        date: selectedDate,
                        status: 'Present',
                        inTime: '09:30 AM',
                        outTime: '05:00 PM'
                      });
                    }}
                    disabled={isDayEnded}
                    title={isDayEnded ? getDayEndedBlockMessage() : "Manual Attendance Entry"}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Edit3 size={13} />
                    <span>Manual Punch</span>
                  </button>

                  <button
                    onClick={exportReportToExcel}
                    className="bg-slate-900 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-sm transition-all flex items-center space-x-1.5"
                    title="Export Attendance to Microsoft Excel (.xlsx)"
                  >
                    <Download size={13} />
                    <span>Export Excel</span>
                  </button>

                  <button
                    onClick={exportReportToPdf}
                    disabled={isExportingPdf}
                    className="bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-sm transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
                    title="Export Attendance Report to PDF"
                  >
                    {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                    <span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
                  </button>

                  <button
                    onClick={() => setIsPrintPreviewOpen(true)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    title="Open Attendance Print Preview"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>

                  <button
                    onClick={handleSyncToSupabase}
                    disabled={isSyncingSupabase || isDayEnded}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-sm transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Sync Attendance Records to Supabase Cloud"}
                  >
                    <RefreshCw size={13} className={isSyncingSupabase ? 'animate-spin' : ''} />
                    <span>{isSyncingSupabase ? 'Syncing...' : 'Sync Cloud'}</span>
                  </button>

                  <button
                    onClick={handleCleanDuplicatesAndEmpty}
                    disabled={isLoading || isDayEnded}
                    className="bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-300 hover:border-amber-600 px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Automatically clean empty rows and merge duplicate employees"}
                  >
                    <Sparkles size={13} />
                    <span>Clean Duplicates</span>
                  </button>

                  <button
                    onClick={() => {
                      if (isDayEnded) return;
                      setDeleteScope('month');
                      setDeleteTargetEmployeeId('ALL');
                      setIsDeleteModalOpen(true);
                    }}
                    disabled={isDayEnded}
                    className="bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 px-3.5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Delete Attendance Data"}
                  >
                    <Trash2 size={13} />
                    <span>Delete Data</span>
                  </button>
                </div>
              </div>

              {/* Sync feedback notification */}
              {syncFeedback && (
                <div className={`mt-3 p-3 rounded-xl border text-xs flex items-center space-x-2 font-medium animate-in fade-in duration-200 ${
                  syncFeedback.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {syncFeedback.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <AlertCircle size={16} className="shrink-0 text-rose-600" />}
                  <span>{syncFeedback.text}</span>
                </div>
              )}

              {/* Specific Filter Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                
                {/* 1. Date / Month selector */}
                {reportViewMode === 'daily' ? (
                  <div>
                    <NepaliDatePicker 
                      value={selectedDate} 
                      onChange={setSelectedDate} 
                      className="w-full" 
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800"
                      >
                        {[2080, 2081, 2082, 2083, 2084, 2085].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800"
                      >
                        {NEPALI_MONTHS.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* 2. Branch Filter */}
                <div>
                  <select
                    value={filterBranch}
                    onChange={(e) => setFilterBranch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800"
                  >
                    <option value="ALL">All Branches</option>
                    {effectiveBranches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Status Filter (Daily only) or Month Tag */}
                {reportViewMode === 'daily' ? (
                  <div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800"
                    >
                      <option value="ALL">All Status</option>
                      <option value="Present">Present</option>
                      <option value="Late">Late</option>
                      <option value="Half Day">Half Day</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold p-2 rounded-xl text-center">
                      {selectedYear} {NEPALI_MONTHS[selectedMonth - 1]}
                    </div>
                  </div>
                )}

                {/* 4. Search Bar */}
                <div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search Staff (Name or Code)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 focus:bg-white"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* VIEW 1: DAILY REPORT TABLE */}
            {isLoading ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
                <div className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading attendance records...</p>
              </div>
            ) : reportViewMode === 'daily' ? (
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-white font-black uppercase text-[9px] tracking-widest">
                      <tr>
                        <th className="p-3">Staff Details</th>
                        <th className="p-3">Department</th>
                        <th className="p-3">Designation</th>
                        <th className="p-3">In Time</th>
                        <th className="p-3">Out Time</th>
                        <th className="p-3">Work Hours</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Remarks</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {dailyReportData.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400 uppercase text-xs font-bold">
                            No attendance records match your filter criteria.
                          </td>
                        </tr>
                      ) : (
                        dailyReportData.map(row => (
                          <tr key={row.employeeId} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase shadow-sm">
                                  {(row.employeeName || 'S').charAt(0)}
                                </div>
                                <div>
                                  <span className="font-black text-slate-900 block leading-tight">{row.employeeName || 'Staff'}</span>
                                  <span className="font-mono text-[9px] text-emerald-700">{row.employeeCode || '-'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-slate-600">{row.department || '-'}</td>
                            <td className="p-3 text-slate-600">{row.designation || '-'}</td>
                            <td className="p-3 font-mono text-slate-900">
                              {row.inTime ? (
                                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {row.inTime}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-900">
                              {row.outTime ? (
                                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {row.outTime}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-700">
                              {row.workHours ? `${row.workHours} hrs` : '-'}
                            </td>
                            <td className="p-3">
                              {getStatusBadge(row.status)}
                            </td>
                            <td className="p-3 text-slate-500 text-[10px]">
                              {row.remarks || '-'}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  onClick={() => {
                                    if (isDayEnded) return;
                                    setEditingRecord({
                                      id: row.recordId,
                                      employeeId: row.employeeId,
                                      employeeCode: row.employeeCode,
                                      employeeName: row.employeeName,
                                      date: row.date,
                                      inTime: row.inTime,
                                      outTime: row.outTime,
                                      status: row.status,
                                      remarks: row.remarks
                                    });
                                  }}
                                  disabled={isDayEnded}
                                  title={isDayEnded ? getDayEndedBlockMessage() : "Edit Attendance Entry"}
                                  className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Edit3 size={14} />
                                </button>
                                {row.recordId && (
                                  <button
                                    onClick={() => handleDeleteRecord(row.recordId!)}
                                    disabled={isDayEnded}
                                    title={isDayEnded ? getDayEndedBlockMessage() : "Delete Attendance Entry"}
                                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* VIEW 2: MONTHLY MATRIX TABLE */}
            {reportViewMode === 'monthly' && (
              <div className="bg-white space-y-0" id="monthly-matrix-table">
                <div className="p-3 bg-slate-50 border-b border-slate-300 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 flex items-center gap-2 flex-wrap">
                      <span>Monthly Attendance Sheet • {NEPALI_MONTHS[selectedMonth - 1]} {selectedYear}</span>
                      <span className="text-[10px] font-normal text-slate-600 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        {monthDays.length} Total Days • {monthDays.filter(d => !d.isWeekend).length} Working Days
                      </span>
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Format Toggle */}
                    <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold uppercase">
                      <button
                        onClick={() => setMatrixDisplayFormat('timings')}
                        className={`px-3 py-1 rounded transition-all ${
                          matrixDisplayFormat === 'timings'
                            ? 'bg-white text-slate-950 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Biometric Times (In | Out)
                      </button>
                      <button
                        onClick={() => setMatrixDisplayFormat('status')}
                        className={`px-3 py-1 rounded transition-all ${
                          matrixDisplayFormat === 'status'
                            ? 'bg-white text-slate-950 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Status (P / L / A)
                      </button>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center space-x-2 text-[9px] font-bold uppercase bg-white px-2.5 py-1 rounded border border-slate-300 shadow-xs text-slate-700">
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded bg-emerald-600"></span>
                        <span>Present</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded bg-amber-500"></span>
                        <span>Late</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded bg-rose-600"></span>
                        <span>Absent</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded bg-slate-400"></span>
                        <span>Weekend</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Email Toast Notification */}
                {toastNotification && (
                  <div className={`mx-4 my-2 p-3 rounded-2xl flex items-center justify-between shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
                    toastNotification.type === 'success' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-rose-600 text-white'
                  }`}>
                    <div className="flex items-center space-x-2 text-xs font-bold">
                      {toastNotification.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                      <span>{toastNotification.message}</span>
                    </div>
                    <button 
                      onClick={() => setToastNotification(null)}
                      className="p-1 hover:bg-white/20 rounded-lg text-white"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Batch Email Sending Real-time Progress Bar */}
                {isSendingBatch && batchEmailProgress && (
                  <div className="mx-4 my-2 bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-between shadow-lg border border-slate-700 animate-in fade-in duration-200">
                    <div className="flex items-center space-x-3">
                      <Loader2 size={16} className="animate-spin text-emerald-400" />
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-emerald-300">
                          Sending Attendance Reports to All Employees...
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Processing {batchEmailProgress.current} of {batchEmailProgress.total} employees
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-black bg-emerald-950 text-emerald-300 border border-emerald-700 px-3 py-1 rounded-xl">
                        {Math.round((batchEmailProgress.current / batchEmailProgress.total) * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
                  <table className="w-full text-center text-[10.5px] border-collapse bg-white">
                    <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 z-20 text-[10px] border-b border-slate-300">
                      <tr>
                        <th className="px-2 py-2 text-center sticky left-0 bg-slate-100 z-30 w-12 min-w-[48px] max-w-[48px] border-r border-b border-slate-300 font-bold text-slate-700 shadow-[1px_0_0_0_#cbd5e1]">
                          S.N.
                        </th>
                        <th className="px-3 py-2 text-left sticky left-12 bg-slate-100 z-30 min-w-[200px] border-r border-b border-slate-300 font-bold text-slate-900 shadow-[1px_0_0_0_#cbd5e1]">
                          Employee Name
                        </th>
                        
                        {/* Summary Metrics Matching Reference Image */}
                        <th className="px-2 py-2 bg-slate-100 border-r border-b border-slate-300 min-w-[50px] font-black text-slate-900 text-center text-[10.5px]" title="Total Days in Month">T Days</th>
                        <th className="px-2 py-2 bg-slate-100 border-r border-b border-slate-300 min-w-[50px] font-black text-slate-900 text-center text-[10.5px]" title="Working Days (Excluding Weekends)">W Days</th>
                        <th className="px-2 py-2 bg-slate-100 border-r border-b border-slate-300 min-w-[50px] font-black text-indigo-950 text-center text-[10.5px]" title="Public Holiday Days (सार्वजनिक बिदा)">H Days</th>
                        <th className="px-2 py-2 bg-slate-100 border-r border-b border-slate-300 min-w-[50px] font-black text-slate-900 text-center text-[10.5px]" title="Leave Days">L Days</th>
                        <th className="px-2 py-2 bg-slate-100 border-r border-b border-slate-300 min-w-[55px] font-black text-slate-900 text-center text-[10.5px]" title="Late Days">Late Days</th>
                        <th className="px-2 py-2 bg-slate-100 border-r border-b border-slate-300 min-w-[50px] font-black text-slate-900 text-center text-[10.5px]" title="Absent Days">A Days</th>
                        <th className="px-2 py-2 bg-slate-100 border-r border-b border-slate-300 min-w-[55px] font-black text-slate-900 text-center text-[10.5px]" title="Worked Present Days">WP Days</th>
                        
                        {/* Day Columns for Selected BS Month */}
                        {monthDays.map(dInfo => {
                          const isHoliday = monthHolidaysMap.has(dInfo.dayNumber);
                          const holidayName = monthHolidaysMap.get(dInfo.dayNumber);
                          return (
                            <th 
                              key={dInfo.dayNumber} 
                              className={`px-2 py-2 border-r border-b border-slate-300 text-center whitespace-nowrap text-[10.5px] font-black ${
                                matrixDisplayFormat === 'timings' ? 'min-w-[130px]' : 'min-w-[40px]'
                              } ${
                                isHoliday 
                                  ? 'bg-indigo-100/70 text-indigo-950 border-b-2 border-indigo-500' 
                                  : dInfo.isWeekend 
                                    ? 'bg-slate-200 text-slate-800' 
                                    : 'bg-slate-100 text-slate-900'
                              }`}
                            >
                              <div className="font-extrabold">{matrixDisplayFormat === 'timings' ? dInfo.colHeader : `${String(dInfo.dayNumber).padStart(2, '0')} (${dInfo.dayName})`}</div>
                              {isHoliday && (
                                <div className="text-[8.5px] font-black text-indigo-950 bg-white border border-indigo-300 px-1 py-0.2 rounded mt-0.5 truncate max-w-[120px] mx-auto shadow-xs" title={`सार्वजनिक बिदा: ${holidayName}`}>
                                  ✦ {holidayName}
                                </div>
                              )}
                            </th>
                          );
                        })}

                        {/* Email Column with 'All' button */}
                        <th className="px-2 py-2 bg-slate-100 border-b border-slate-300 min-w-[105px] font-bold text-slate-900 text-center sticky right-0 z-30 shadow-[-1px_0_0_0_#cbd5e1]">
                          <div className="flex items-center justify-center space-x-1">
                            <Mail size={12} className="text-emerald-700" />
                            <span className="text-[10px]">Email</span>
                            <button
                              onClick={handleDirectSendAllEmails}
                              disabled={isSendingBatch}
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow-xs transition-all active:scale-95 ml-1 ${
                                isSendingBatch 
                                  ? 'bg-amber-500 text-white animate-pulse' 
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                              title="Send attendance report to all employees with one click"
                            >
                              {isSendingBatch ? 'Sending...' : 'All'}
                            </button>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {monthlyMatrixData.map((row, idx) => (
                        <tr key={row.employee.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-2 py-2 text-center sticky left-0 bg-white hover:bg-slate-50 z-10 w-12 min-w-[48px] max-w-[48px] border-r border-b border-slate-300 font-mono font-bold text-slate-800 text-[11px] shadow-[1px_0_0_0_#cbd5e1]">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-left sticky left-12 bg-white hover:bg-slate-50 z-10 min-w-[200px] border-r border-b border-slate-300 shadow-[1px_0_0_0_#cbd5e1]">
                            <span className="font-extrabold text-slate-950 block truncate max-w-[195px] uppercase text-[11.5px] tracking-tight" title={row.employee.fullName}>
                              {row.employee.fullName}
                            </span>
                          </td>

                          {/* Summary numbers - Bold and high contrast */}
                          <td className="px-2 py-2 font-mono font-bold text-center text-slate-900 bg-white border-r border-b border-slate-200 text-[11px]">
                            {row.totalDays}
                          </td>
                          <td className="px-2 py-2 font-mono font-bold text-center text-slate-900 bg-white border-r border-b border-slate-200 text-[11px]">
                            {row.workingDays}
                          </td>
                          <td className="px-2 py-2 font-mono font-black text-center text-indigo-950 bg-indigo-50/40 border-r border-b border-slate-200 text-[11px]">
                            {row.holidayCount}
                          </td>
                          <td className="px-2 py-2 font-mono font-bold text-center text-purple-950 bg-white border-r border-b border-slate-200 text-[11px]">
                            {formatDecimalCount(row.leaveCount)}
                          </td>
                          <td className="px-2 py-2 font-mono font-bold text-center text-amber-950 bg-white border-r border-b border-slate-200 text-[11px]">
                            {row.lateCount}
                          </td>
                          <td className="px-2 py-2 font-mono font-bold text-center text-rose-950 bg-white border-r border-b border-slate-200 text-[11px]">
                            {formatDecimalCount(row.absentCount)}
                          </td>
                          <td className="px-2 py-2 font-mono font-black text-center text-emerald-950 bg-emerald-50/50 border-r border-b border-slate-200 text-[11px]">
                            {formatDecimalCount(row.workedDays)}
                          </td>

                          {/* Day Columns - Direct Display Only (Manual punch only from toolbar button) */}
                          {monthDays.map(dInfo => {
                            const rec = row.days[dInfo.dayNumber];
                            const isWeekend = dInfo.isWeekend;

                            if (matrixDisplayFormat === 'timings') {
                              if (isWeekend) {
                                return (
                                  <td 
                                    key={dInfo.dayNumber} 
                                    title="Weekend / Weekly Off"
                                    className="px-2 py-2 border-r border-b border-slate-200 text-center text-slate-700 font-bold text-[10.5px] whitespace-nowrap bg-slate-100/90"
                                  >
                                    <div className="font-bold text-slate-700">Weekend</div>
                                    {rec?.remarks && (
                                      <div className="mt-0.5 inline-block text-[9px] font-bold text-blue-900 bg-blue-50 border border-blue-300 px-1 py-0.2 rounded truncate max-w-[110px]" title={`Remark: ${rec.remarks}`}>
                                        {rec.remarks}
                                      </div>
                                    )}
                                  </td>
                                );
                              }

                              if (rec) {
                                if (rec.status === 'Absent') {
                                  // Absent with manual punch remark: remove absent and show remark!
                                  if (rec.remarks) {
                                    return (
                                      <td 
                                        key={dInfo.dayNumber} 
                                        title={`Remark: ${rec.remarks}`}
                                        className="px-2 py-2 border-r border-b border-slate-200 text-center whitespace-nowrap text-[10px] bg-blue-50/50"
                                      >
                                        <span className="inline-block text-[9.5px] font-bold text-blue-900 bg-blue-100/90 border border-blue-300 px-1.5 py-0.5 rounded truncate max-w-[115px]">
                                          {rec.remarks}
                                        </span>
                                      </td>
                                    );
                                  }

                                  return (
                                    <td 
                                      key={dInfo.dayNumber} 
                                      title="Absent"
                                      className="px-2 py-2 border-r border-b border-slate-200 text-center whitespace-nowrap font-mono text-[10px] text-rose-800 font-bold bg-rose-50/50"
                                    >
                                      <div className="font-bold text-rose-800">Absent(00:00 | 00:00)</div>
                                    </td>
                                  );
                                }

                                if (rec.status === 'On Leave') {
                                  return (
                                    <td 
                                      key={dInfo.dayNumber} 
                                      title={rec.remarks ? `Leave • Remark: ${rec.remarks}` : 'Leave'}
                                      className="px-2 py-2 border-r border-b border-slate-200 text-center whitespace-nowrap text-purple-950 font-bold text-[10.5px] bg-purple-50/50"
                                    >
                                      <div className="font-bold text-purple-900">Leave</div>
                                      {rec.remarks && (
                                        <div className="mt-0.5 inline-block text-[9px] font-bold text-purple-900 bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded truncate max-w-[110px]" title={`Remark: ${rec.remarks}`}>
                                          {rec.remarks}
                                        </div>
                                      )}
                                    </td>
                                  );
                                }

                                if (rec.status === 'Holiday') {
                                  return (
                                    <td 
                                      key={dInfo.dayNumber} 
                                      title={rec.remarks ? `सार्वजनिक बिदा • ${rec.remarks}` : 'सार्वजनिक बिदा (Holiday)'}
                                      className="px-2 py-2 border-r border-b border-indigo-200 text-center whitespace-nowrap bg-indigo-50/70"
                                    >
                                      <div className="font-black text-indigo-950 text-[11px] uppercase tracking-wide">Holiday</div>
                                      {rec.remarks && (
                                        <div className="mt-0.5 inline-block text-[9.5px] font-black text-indigo-950 bg-white border border-indigo-300 px-2 py-0.5 rounded shadow-xs truncate max-w-[120px]" title={`बिदा विवरण: ${rec.remarks}`}>
                                          {rec.remarks}
                                        </div>
                                      )}
                                    </td>
                                  );
                                }

                                const inTimeStr = rec.inTime || '09:00';
                                const outTimeStr = rec.outTime || '17:00';
                                const isLate = rec.status === 'Late';

                                return (
                                  <td 
                                    key={dInfo.dayNumber} 
                                    title={rec.remarks ? `${inTimeStr} | ${outTimeStr} • Remark: ${rec.remarks}` : `${inTimeStr} | ${outTimeStr}`}
                                    className={`px-2 py-2 border-r border-b border-slate-200 text-center whitespace-nowrap font-mono text-[10.5px] font-bold ${
                                      isLate ? 'text-amber-950 bg-amber-50/40' : 'text-slate-900 bg-white'
                                    }`}
                                  >
                                    <div className="font-bold text-slate-900">{inTimeStr} | {outTimeStr}</div>
                                    {rec.remarks && (
                                      <div className="mt-0.5 inline-block text-[9px] font-bold text-blue-900 bg-blue-50 border border-blue-300 px-1.5 py-0.5 rounded truncate max-w-[110px]" title={`Remark: ${rec.remarks}`}>
                                        {rec.remarks}
                                      </div>
                                    )}
                                  </td>
                                );
                              }

                              return (
                                <td 
                                  key={dInfo.dayNumber} 
                                  title="No punch record"
                                  className="px-2 py-2 border-r border-b border-slate-200 text-center text-slate-400 font-bold font-mono text-[10.5px] bg-white"
                                >
                                  -
                                </td>
                              );
                            }

                            // Compact Status Format (P / L / A / LV / Weekend)
                            let cellContent = '-';
                            let cellBg = 'text-slate-300';

                            if (isWeekend) {
                              cellContent = 'OFF';
                              cellBg = 'bg-slate-100 text-slate-500 font-bold rounded';
                            } else if (rec) {
                              if (rec.status === 'Present') {
                                cellContent = 'P';
                                cellBg = 'bg-emerald-100 text-emerald-800 font-black rounded';
                              } else if (rec.status === 'Late') {
                                cellContent = 'L';
                                cellBg = 'bg-amber-100 text-amber-800 font-black rounded';
                              } else if (rec.status === 'Half Day') {
                                cellContent = 'HD';
                                cellBg = 'bg-sky-100 text-sky-800 font-black rounded';
                              } else if (rec.status === 'On Leave') {
                                cellContent = 'LV';
                                cellBg = 'bg-purple-100 text-purple-800 font-black rounded';
                              } else if (rec.status === 'Holiday') {
                                cellContent = 'H';
                                cellBg = 'bg-indigo-600 text-white font-black rounded shadow-xs';
                              } else if (rec.status === 'Absent') {
                                if (rec.remarks) {
                                  // Absent replaced by remark!
                                  cellContent = rec.remarks;
                                  cellBg = 'bg-blue-100 text-blue-800 font-bold px-1 rounded truncate max-w-[42px]';
                                } else {
                                  cellContent = 'A';
                                  cellBg = 'bg-rose-100 text-rose-800 font-black rounded';
                                }
                              }
                            }

                            return (
                              <td 
                                key={dInfo.dayNumber} 
                                title={rec ? `${row.employee.fullName} (${dInfo.colHeader}): ${rec.status} ${rec.remarks ? `| Remark: ${rec.remarks}` : ''}` : dInfo.colHeader}
                                className="px-1.5 py-1.5 border-r border-b border-slate-200 text-center"
                              >
                                <span className={`inline-block w-6 py-0.5 text-[9px] ${cellBg}`}>
                                  {cellContent}
                                </span>
                                {rec?.remarks && rec.status !== 'Absent' && (
                                  <div className="text-[7.5px] font-bold text-blue-700 truncate max-w-[36px]" title={rec.remarks}>
                                    • {rec.remarks}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* Email Action Cell - Direct Send without Modal */}
                          <td className="px-2 py-1.5 text-center bg-white border-b border-slate-200 sticky right-0 z-10 shadow-[-1px_0_0_0_#cbd5e1]">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleDirectSendEmail(row)}
                                disabled={sendingEmailEmpId === row.employee.id || isSendingBatch}
                                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[9.5px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
                                  sentEmailSuccessEmpId === row.employee.id 
                                    ? 'bg-emerald-600 text-white border border-emerald-600'
                                    : sendingEmailEmpId === row.employee.id
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                                    : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600'
                                }`}
                                title={`Send ${row.employee.fullName} attendance report via email directly`}
                              >
                                {sendingEmailEmpId === row.employee.id ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : sentEmailSuccessEmpId === row.employee.id ? (
                                  <Check size={11} />
                                ) : (
                                  <Mail size={11} />
                                )}
                                <span>
                                  {sendingEmailEmpId === row.employee.id 
                                    ? 'Sending...' 
                                    : sentEmailSuccessEmpId === row.employee.id 
                                    ? 'Sent!' 
                                    : 'Email'}
                                </span>
                              </button>

                              <button
                                onClick={() => {
                                  handleDeleteEmployeeRow(row.employee);
                                }}
                                disabled={isDayEnded}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isDayEnded ? getDayEndedBlockMessage() : `Delete ${row.employee.fullName}'s attendance data for ${NEPALI_MONTHS[selectedMonth - 1]} ${selectedYear}`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* MANUAL PUNCH / EDIT MODAL                                 */}
      {/* ========================================================= */}
      {editingRecord && (
        <div className="fixed inset-0 z-[7000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="text-emerald-600" size={18} />
                <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                  {editingRecord.id ? 'Edit Attendance Record' : 'Record Manual Attendance'}
                </h4>
              </div>
              <button 
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualRecord} className="space-y-4">
              <DayEndFieldset branchId={lockedBranchId} className="space-y-4">
                {/* Employee Selection */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                    Employee *
                  </label>
                  <select
                    required
                    value={editingRecord.employeeId || ''}
                    onChange={(e) => {
                      const emp = effectiveEmployees.find(x => x.id === e.target.value);
                      setEditingRecord(prev => ({
                        ...prev,
                        employeeId: e.target.value,
                        employeeCode: emp?.employeeCode,
                        employeeName: emp?.fullName
                      }));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  >
                    <option value="">-- Select Employee --</option>
                    {effectiveEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode || 'No Code'}) - {emp.department || 'General'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                    Date (BS) *
                  </label>
                  <NepaliDatePicker
                    value={editingRecord.date || getTodayBsString()}
                    onChange={(d) => setEditingRecord(prev => ({ ...prev, date: d, dateBs: d }))}
                    disallowBackDateIfDisabled={true}
                    disabled={isDayEnded}
                    className="w-full"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                    Attendance Status *
                  </label>
                  <select
                    value={editingRecord.status || 'Present'}
                    onChange={(e) => setEditingRecord(prev => ({ ...prev, status: e.target.value as AttendanceStatus }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Half Day">Half Day</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Weekly Off">Weekly Off</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>

                {/* In & Out Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                      In Time
                    </label>
                    <input
                      type="text"
                      placeholder="09:30 AM"
                      value={editingRecord.inTime || ''}
                      onChange={(e) => setEditingRecord(prev => ({ ...prev, inTime: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                      Out Time
                    </label>
                    <input
                      type="text"
                      placeholder="05:00 PM"
                      value={editingRecord.outTime || ''}
                      onChange={(e) => setEditingRecord(prev => ({ ...prev, outTime: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                    Remarks / Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Field visit, medical leave, or biometric device punch adjustment"
                    value={editingRecord.remarks || ''}
                    onChange={(e) => setEditingRecord(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                  />
                </div>

                {/* Existing Record Indicator */}
                {existingPunchRecord && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start space-x-2">
                    <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black">Existing Attendance Record:</span>
                      <div className="text-[11px] font-semibold mt-0.5 text-amber-800">
                        Status: <strong>{existingPunchRecord.status}</strong>
                        {existingPunchRecord.inTime ? ` • ${existingPunchRecord.inTime} - ${existingPunchRecord.outTime || '05:00 PM'}` : ''}
                        {existingPunchRecord.remarks ? ` • Note: "${existingPunchRecord.remarks}"` : ''}
                      </div>
                    </div>
                  </div>
                )}
              </DayEndFieldset>

              {/* Submit Buttons */}
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                {existingPunchRecord && (
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={async () => {
                      if (isDayEnded) return;
                      if (!window.confirm(`Are you sure you want to delete this punch record for ${editingRecord.employeeName || 'this employee'} on ${editingRecord.date}?`)) return;
                      try {
                        await storageService.deleteAttendanceRecord(existingPunchRecord.id);
                        await loadAttendance();
                        setToastNotification({
                          type: 'success',
                          message: 'Attendance punch entry deleted successfully.'
                        });
                        setEditingRecord(null);
                      } catch (err) {
                        console.error('Failed to delete punch record:', err);
                      }
                    }}
                    className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Delete this attendance record"}
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSavingRecord || isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-slate-950 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check size={14} />
                  <span>{isSavingRecord ? 'Saving...' : 'Save Record'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINT PREVIEW MODAL                                       */}
      {/* ========================================================= */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-1 sm:p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-[98vw] 2xl:max-w-[1600px] max-h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Top Toolbar (Non-printable) */}
            <div className="bg-slate-900 text-white px-4 sm:px-5 py-2.5 sm:py-3 flex flex-wrap justify-between items-center gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                <Printer className="text-emerald-400" size={18} />
                <h3 className="font-black text-xs sm:text-sm uppercase tracking-wide">
                  Attendance Report - Print Preview
                </h3>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExecutePrint}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Execute Print</span>
                </button>
                
                <button
                  onClick={exportReportToPdf}
                  disabled={isExportingPdf}
                  className="bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                  <span>Export PDF</span>
                </button>

                <button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Paper Area */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-4 bg-slate-100 flex justify-center">
              <div className="bg-white border border-slate-300 shadow-sm rounded-xl w-full max-w-full text-slate-900">
                {renderPrintableReport('attendance-printable-area')}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUPABASE SQL & DATABASE STATUS MODAL                     */}
      {/* ========================================================= */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Supabase HR Attendance Database Status
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Data storage verification and SQL script runner
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Status Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start space-x-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-emerald-950">Table Status: Active</div>
                  <div className="text-[10.5px] text-emerald-700 font-mono">public.attendance_records exists</div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start space-x-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-emerald-950">Local & Cloud Sync</div>
                  <div className="text-[10.5px] text-emerald-700">Offline-first auto synchronization</div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="font-bold text-slate-800">हाजिरी डाटा Supabase मा सुरक्षित राख्ने तरिका:</div>
              <p className="text-[11px] leading-relaxed">
                तल दिइएको SQL स्क्रिप्ट Supabase Dashboard को <strong>SQL Editor</strong> मा गएर रन (Run) गर्न सक्नुहुन्छ। यसले <code>attendance_records</code> टेबल तथा आवश्यक सम्पूर्ण कलमसहित RLS अनुमतिहरू कन्फिगर गर्दछ।
              </p>
            </div>

            {/* SQL Script Box */}
            <div className="relative">
              <div className="flex items-center justify-between bg-slate-900 text-slate-300 text-[11px] font-mono px-3.5 py-2 rounded-t-xl">
                <span>supabase_attendance_schema.sql</span>
                <button
                  type="button"
                  onClick={() => {
                    const sqlScript = `-- 8. ATTENDANCE RECORDS (हाजिरी) TABLE\nCREATE TABLE IF NOT EXISTS public.attendance_records (\n    id TEXT PRIMARY KEY,\n    employee_id TEXT NOT NULL,\n    employee_code TEXT,\n    employee_name TEXT,\n    date TEXT,\n    branch_id TEXT,\n    date_bs TEXT,\n    date_ad DATE,\n    in_time TIME,\n    out_time TIME,\n    work_hours NUMERIC DEFAULT 0,\n    status TEXT DEFAULT 'Present',\n    source TEXT DEFAULT 'biometric',\n    remarks TEXT,\n    created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- Ensure all columns exist\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS employee_code TEXT;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS employee_name TEXT;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date TEXT;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date_bs TEXT;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date_ad DATE;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS in_time TIME;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS out_time TIME;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS work_hours NUMERIC DEFAULT 0;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Present';\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'biometric';\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS remarks TEXT;\nALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS branch_id TEXT;\n\nCREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance_records(employee_id, date_bs);\nCREATE INDEX IF NOT EXISTS idx_attendance_branch ON public.attendance_records(branch_id);\n\nALTER TABLE public.attendance_records DISABLE ROW LEVEL SECURITY;\nGRANT ALL ON public.attendance_records TO anon, authenticated, service_role;`;
                    navigator.clipboard.writeText(sqlScript);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md text-[10px] font-sans font-bold flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <Copy size={11} />
                  <span>{copiedSql ? 'Copied!' : 'Copy SQL Script'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 text-emerald-400 p-3.5 rounded-b-xl text-[10px] font-mono overflow-x-auto max-h-48 border-t border-slate-800 leading-tight">
{`-- ATTENDANCE RECORDS (हाजिरी) TABLE
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    employee_code TEXT,
    employee_name TEXT,
    date TEXT,
    branch_id TEXT,
    date_bs TEXT,
    date_ad DATE,
    in_time TIME,
    out_time TIME,
    work_hours NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Present',
    source TEXT DEFAULT 'biometric',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade columns in case of minimal schema
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date_ad DATE;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS in_time TIME;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS out_time TIME;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS work_hours NUMERIC DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Present';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'biometric';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS branch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance_records(employee_id, date_bs);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON public.attendance_records(branch_id);

ALTER TABLE public.attendance_records DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.attendance_records TO anon, authenticated, service_role;`}
              </pre>
            </div>

            {/* Action footer */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleSyncToSupabase}
                disabled={isSyncingSupabase || isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw size={13} className={isSyncingSupabase ? 'animate-spin' : ''} />
                <span>{isSyncingSupabase ? 'Syncing Now...' : 'Sync Attendance to Cloud Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Off-Screen Printable Area for 100% Consistent PDF Export Anytime */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '1400px', background: '#ffffff', zIndex: -10 }} aria-hidden="true">
        {renderPrintableReport('attendance-printable-area-export')}
      </div>

      {/* ========================================================= */}
      {/* DELETE ATTENDANCE DATA MODAL                              */}
      {/* ========================================================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Trash2 size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                    Delete Attendance Records
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold">
                    Target Period: {NEPALI_MONTHS[selectedMonth - 1]} {selectedYear}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scope Selection */}
            <DayEndFieldset branchId={lockedBranchId} className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                Select Deletion Scope
              </label>

              <div className="space-y-2">
                {/* Option 1: Entire Month */}
                <label className={`flex items-start p-3 rounded-2xl border cursor-pointer transition-all ${deleteScope === 'month' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteScope === 'month'}
                    onChange={() => setDeleteScope('month')}
                    className="mt-0.5 text-rose-600 cursor-pointer"
                  />
                  <div className="ml-3">
                    <div className="text-xs font-black text-slate-900">
                      Delete Entire Month Attendance
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Deletes all attendance punch records for all employees in {NEPALI_MONTHS[selectedMonth - 1]} {selectedYear}.
                    </div>
                  </div>
                </label>

                {/* Option 2: Individual Employee */}
                <label className={`flex items-start p-3 rounded-2xl border cursor-pointer transition-all ${deleteScope === 'employee' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteScope === 'employee'}
                    onChange={() => setDeleteScope('employee')}
                    className="mt-0.5 text-rose-600 cursor-pointer"
                  />
                  <div className="ml-3 flex-1">
                    <div className="text-xs font-black text-slate-900">
                      Delete Individual Employee Data
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Deletes only the selected employee's attendance records in {NEPALI_MONTHS[selectedMonth - 1]} {selectedYear}.
                    </div>

                    {deleteScope === 'employee' && (
                      <div className="mt-2.5">
                        <select
                          value={deleteTargetEmployeeId}
                          onChange={(e) => setDeleteTargetEmployeeId(e.target.value)}
                          className="w-full bg-white border border-rose-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                        >
                          <option value="ALL">-- Select Employee to Delete --</option>
                          {effectiveEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.fullName} ({emp.employeeCode || 'No Code'}) - {emp.department || 'General'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </label>

                {/* Option 3: Manual Punches / Remarks Only */}
                <label className={`flex items-start p-3 rounded-2xl border cursor-pointer transition-all ${deleteScope === 'manual' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteScope === 'manual'}
                    onChange={() => setDeleteScope('manual')}
                    className="mt-0.5 text-rose-600 cursor-pointer"
                  />
                  <div className="ml-3">
                    <div className="text-xs font-black text-slate-900">
                      Delete Manual Punch & Remarks Only
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Clears manually adjusted punches and remarks in {NEPALI_MONTHS[selectedMonth - 1]} {selectedYear} while preserving raw biometric records.
                    </div>
                  </div>
                </label>
              </div>
            </DayEndFieldset>

            {/* Record Count Preview */}
            <div className="p-3 bg-slate-100 rounded-2xl flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Matching records found:</span>
              <span className="font-black text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                {affectedDeleteCount} records
              </span>
            </div>

            {/* Caution Banner */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2 text-rose-800 text-[11.5px]">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <div>
                <strong>Warning:</strong> This action is permanent and cannot be undone. Attendance records matching the selected criteria will be completely removed.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteData}
                disabled={isDeletingData || affectedDeleteCount === 0 || (deleteScope === 'employee' && deleteTargetEmployeeId === 'ALL') || isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDeletingData ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isDeletingData ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

