import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, CreditCard, AlertCircle, 
  Search, Trash2, Edit2, X, Save, 
  LayoutDashboard, FileText, Printer,
  User, User as UserIcon, LucideSettings,
  Calculator, Table, ChevronDown, Check, Mail, Send, ShieldCheck, Copy, ExternalLink,
  Eye, Sparkles, Camera, Briefcase, Building2, Phone, Award,
  History, CheckCircle2, Plus,
  ArrowRight, ShieldAlert, MessageSquare, CheckCircle,
  Database, ScrollText, PenTool, BookOpen, FileBadge,
  ArrowUp, ArrowUpDown, FileSpreadsheet, Upload, Download, FileCode, Clock,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image as ImageIcon, Link as LinkIcon, Type, Palette, Undo, Redo, RemoveFormatting, Paperclip, FileUp, File,
  Loader2, RefreshCw
} from 'lucide-react';
import { compressDocumentFile } from '../utils/imageCompression';
import { 
  cleanCitizenshipNo, 
  cleanMobileNo, 
  cleanEmployeeCode, 
  isSameEmployeeName,
  deduplicateEmployees
} from '../services/nameMatcher';
import { normalizeBranchId, isBranchMatch, SUMIT_KUMAR_THAKUR_RECORD, OFFICIAL_MASTER_STAFF } from '../services/supabaseService';
import { EmployeeDocumentsHub } from './EmployeeDocumentsHub';

const calculateRetirementInfo = (dobBsStr?: string, joinedDateStr?: string) => {
  const parseBs = (str?: string) => {
    if (!str) return null;
    const parts = str.trim().replace(/-/g, '/').split('/');
    if (parts.length >= 1 && !isNaN(Number(parts[0])) && Number(parts[0]) > 1900) {
      const year = Number(parts[0]);
      const month = parts[1] ? Number(parts[1]) : 1;
      const day = parts[2] ? Number(parts[2]) : 1;
      return { year, month, day };
    }
    return null;
  };

  const dob = parseBs(dobBsStr);
  const joined = parseBs(joinedDateStr);

  let retByAge: string | null = null;
  let retByAgeObj: { year: number; month: number; day: number } | null = null;
  if (dob) {
    const y = dob.year + 58;
    const m = String(dob.month).padStart(2, '0');
    const d = String(dob.day).padStart(2, '0');
    retByAge = `${y}-${m}-${d}`;
    retByAgeObj = { year: y, month: dob.month, day: dob.day };
  }

  let retByService: string | null = null;
  let retByServiceObj: { year: number; month: number; day: number } | null = null;
  if (joined) {
    const y = joined.year + 30;
    const m = String(joined.month).padStart(2, '0');
    const d = String(joined.day).padStart(2, '0');
    retByService = `${y}-${m}-${d}`;
    retByServiceObj = { year: y, month: joined.month, day: joined.day };
  }

  let finalRetDate: string | null = null;
  let retirementBasis: 'service' | 'age' | null = null;

  if (retByAge && retByService) {
    // Pick whichever date comes EARLIER (whichever age 58 or service 30 yrs is reached first)
    if (retByAge <= retByService) {
      finalRetDate = retByAge;
      retirementBasis = 'age';
    } else {
      finalRetDate = retByService;
      retirementBasis = 'service';
    }
  } else if (retByAge) {
    finalRetDate = retByAge;
    retirementBasis = 'age';
  } else if (retByService) {
    finalRetDate = retByService;
    retirementBasis = 'service';
  }

  // Calculate duration between two dates (y2-m2-d2 minus y1-m1-d1)
  const calcDiff = (y1: number, m1: number, d1: number, y2: number, m2: number, d2: number) => {
    let d = d2 - d1;
    let m = m2 - m1;
    let y = y2 - y1;

    if (d < 0) {
      d += 30;
      m -= 1;
    }
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    if (y >= 0) {
      const yy = String(y).padStart(2, '0');
      const mm = String(Math.max(0, m)).padStart(2, '0');
      const dd = String(Math.max(0, d)).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    return '00-00-00';
  };

  // 1. Current Completed Service (Joined Date to Today ~ 2083-04-25)
  let currentService = '-';
  if (joined) {
    currentService = calcDiff(joined.year, joined.month, joined.day, 2083, 4, 25);
  }

  // 2. Total Service Period at Retirement
  let totalServicePeriod = '-';
  if (retirementBasis === 'service') {
    totalServicePeriod = '30-00-00';
  } else if (retirementBasis === 'age' && dob && joined && retByAgeObj) {
    totalServicePeriod = calcDiff(joined.year, joined.month, joined.day, retByAgeObj.year, retByAgeObj.month, retByAgeObj.day);
  } else if (joined) {
    totalServicePeriod = '30-00-00';
  }

  return {
    retByAge,
    retByService,
    finalRetDate,
    retirementBasis,
    currentService,
    totalServicePeriod,
    workingPeriod: totalServicePeriod
  };
};
import { storageService } from '../services/storageService';
import { useAuth } from '../AuthContext';
import { ConfirmationModal } from './ConfirmationModal';
import { 
  Employee, LeaveType, LeaveRequest, PayrollRecord, Complaint, Branch, SystemSettings, TaxSlab, TaxConfig, DailyData, OfficeAccountEntry
} from '../types';
import { DEFAULT_DENOMINATIONS } from '../constants';
import NepaliDate from 'nepali-date-converter';
import { NepaliDatePicker } from './NepaliDatePicker';
import { AttendanceModule } from './AttendanceModule';
import { RemainingLeaveModule } from './RemainingLeaveModule';
import { HRDashboard } from './HRDashboard';
import { BoardManagement } from './BoardManagement';
import { getStoredSmtpConfig, saveSmtpConfig, generateElementPdfBase64, sendPaySlipApi, isEmailCategoryAllowed, SmtpConfig, sendLeaveNotificationEmailApi } from '../services/pdfEmailService';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { useDayEndLock, isDayEndedForBranch, getDayEndedBlockMessage } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

type HRTab = 'dashboard' | 'employees' | 'board' | 'payroll' | 'complaints' | 'leave';
type EmployeeSubTab = 'list' | 'leave' | 'attendance' | 'remaining-leave' | 'documents';
type PayrollMenuTab = 'monthly-salary' | 'calculate-tax' | 'sheet' | 'records' | 'settings';

interface TaxSlab { label: string; limit: number; rate: number; }
interface TaxConfig { singleSlabs: TaxSlab[]; marriedSlabs: TaxSlab[]; retirementCap: number; }

const DEFAULT_TAX_CONFIG: TaxConfig = {
  singleSlabs: [
    { label: 'First 5,00,000', limit: 500000, rate: 1 },
    { label: 'Next 2,00,000', limit: 200000, rate: 10 },
    { label: 'Next 3,00,000', limit: 300000, rate: 20 },
    { label: 'Next 10,00,000', limit: 1000000, rate: 30 },
    { label: 'Above 20 Lakh', limit: 999999999, rate: 39 },
  ],
  marriedSlabs: [
    { label: 'First 6,00,000', limit: 600000, rate: 1 },
    { label: 'Next 2,00,000', limit: 200000, rate: 10 },
    { label: 'Next 3,00,000', limit: 300000, rate: 20 },
    { label: 'Next 9,00,000', limit: 900000, rate: 30 },
    { label: 'Above 20 Lakh', limit: 999999999, rate: 39 },
  ],
  retirementCap: 500000
};

const NEPALI_MONTHS = ['वैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पौष', 'माघ', 'फागुन', 'चैत'];
const getDynamicFiscalYears = () => {
  try {
    const d = new NepaliDate();
    const year = d.getYear();
    const month = d.getMonth();
    const maxYear = month >= 3 ? year + 1 : year;
    const years: string[] = [];
    for (let y = 2079; y <= Math.max(2083, maxYear); y++) {
      years.push(`${y}/${y + 1}`);
    }
    return years;
  } catch (e) {
    return ['2079/2080', '2080/2081', '2081/2082', '2082/2083', '2083/2084'];
  }
};
const FISCAL_YEARS = getDynamicFiscalYears();

const calculateDetailedPayroll = (emp: Employee, taxConfig: TaxConfig, selectedMonth?: string, overrideAdj?: any) => {
  const isP = emp.employmentType === 'Permanent';
  const monthsCount = emp.monthsActive ?? 12;
  const basic = emp.basicSalary;
  
  const da = isP ? (basic * 0.20) : 0;
  const grade = isP ? ((basic / 30) * (emp.gradeRate || 0)) : 0;
  const ssf20 = isP ? (basic * 0.20) : 0;
  const pf10 = isP ? (basic * 0.10) : 0;
  const grat833 = isP ? (basic * 0.0833) : 0;
  const monthlyGross = basic + da + grade + ssf20 + pf10 + grat833;

  const dashain = emp.dashainBonus ?? basic;
  const festival = emp.sanchitLeaveAmount ?? 0;
  const bonus = emp.bonusYearly ?? 0;
  const medical = isP ? (emp.medicalAllowance ?? basic) : 0;
  const dress = (emp.hasDressAllowance || (emp.dressAllowance && emp.dressAllowance > 0)) ? (emp.dressAllowance || 0) : 0;
  const totalLumpsum = dashain + festival + bonus + medical + dress;

  const annSalary = basic * monthsCount;
  const annDa = da * monthsCount;
  const annGrade = grade * monthsCount;
  const annSsf20 = ssf20 * monthsCount;
  const annPf10 = pf10 * monthsCount;
  const annGrat833 = grat833 * monthsCount;

  // Base (unadjusted) calculation - assuming no bonus and no sanchit leave
  const baseBonus = 0;
  const baseFestival = 0;
  const baseTotalLumpsum = dashain + medical;
  const baseTotalAnnualIncome = annSalary + annDa + annGrade + annSsf20 + annPf10 + annGrat833 + baseTotalLumpsum;

  const ssfFund31 = isP ? (basic * 0.31 * monthsCount) : 0;
  const pfFund20 = isP ? (basic * 0.20 * monthsCount) : 0;
  const gratFund833 = isP ? (basic * 0.0833 * monthsCount) : 0;
  const totalContribution = ssfFund31 + pfFund20 + gratFund833;

  const baseOneThirdIncome = baseTotalAnnualIncome / 3;
  const baseAllowableDed = isP ? Math.min(totalContribution, baseOneThirdIncome, taxConfig.retirementCap) : 0;
  const baseAdjustedTaxableIncome = baseTotalAnnualIncome - baseAllowableDed;

  const lifeIns = Math.min(emp.lifeInsurance ?? 0, 40000);
  const healthIns = Math.min(emp.healthInsurance ?? 0, 20000);
  const buildingIns = Math.min(emp.buildingInsurance ?? 0, 5000);
  const remoteAreaCategory = emp.remoteAreaCategory || 'None';
  const remoteMap = { 'A': 50000, 'B': 40000, 'C': 30000, 'D': 20000, 'E': 10000, 'None': 0 };
  const remoteReduct = remoteMap[remoteAreaCategory] || 0;
  const incapacitatedReduct = emp.isIncapacitated ? 100000 : 0;
  const totalReductions = lifeIns + healthIns + buildingIns + remoteReduct + incapacitatedReduct;

  const baseFinalTaxableIncome = Math.max(0, baseAdjustedTaxableIncome - totalReductions);
  const isCouple = emp.maritalStatus === 'Couple';
  const slabs = isCouple ? taxConfig.marriedSlabs : taxConfig.singleSlabs;

  let baseRemainingIncome = baseFinalTaxableIncome;
  let baseTotalRemunerationTax = 0;
  slabs.forEach((slab, index) => {
    if (baseRemainingIncome <= 0) return;
    let effectiveRate = slab.rate;
    if (index === 0 && isP && effectiveRate === 1) effectiveRate = 0;
    const taxableInThisSlab = Math.min(baseRemainingIncome, slab.limit);
    const tax = taxableInThisSlab * (effectiveRate / 100);
    baseTotalRemunerationTax += tax;
    baseRemainingIncome -= taxableInThisSlab;
  });

  const baseFemaleTaxCredit = (emp.gender === 'Female' && !isCouple) ? baseTotalRemunerationTax * 0.10 : 0;
  const baseMedicalTaxCredit = Math.min(1500, (emp.medicalExpensesPaid ?? 0) * 0.15);
  const baseAnnualNetTax = Math.max(0, baseTotalRemunerationTax - baseFemaleTaxCredit - baseMedicalTaxCredit);
  const baseMonthlyTax = baseAnnualNetTax / 12;

  // New (actual) calculation with Bonus & Festival included
  const totalAnnualIncome = annSalary + annDa + annGrade + annSsf20 + annPf10 + annGrat833 + totalLumpsum;
  const oneThirdIncome = totalAnnualIncome / 3;
  const allowableDed = isP ? Math.min(totalContribution, oneThirdIncome, taxConfig.retirementCap) : 0;
  const adjustedTaxableIncome = totalAnnualIncome - allowableDed;
  const finalTaxableIncome = Math.max(0, adjustedTaxableIncome - totalReductions);

  let remainingIncome = finalTaxableIncome;
  let totalRemunerationTax = 0;
  const slabBreakdown: Record<number, number> = { 1: 0, 10: 0, 20: 0, 30: 0, 39: 0 };

  slabs.forEach((slab, index) => {
    if (remainingIncome <= 0) return;
    let effectiveRate = slab.rate;
    if (index === 0 && isP && effectiveRate === 1) effectiveRate = 0;
    const taxableInThisSlab = Math.min(remainingIncome, slab.limit);
    const tax = taxableInThisSlab * (effectiveRate / 100);
    totalRemunerationTax += tax;
    if (slab.rate !== 36) {
       slabBreakdown[slab.rate] = (slabBreakdown[slab.rate] || 0) + tax;
    }
    remainingIncome -= taxableInThisSlab;
  });

  const femaleTaxCredit = (emp.gender === 'Female' && !isCouple) ? totalRemunerationTax * 0.10 : 0;
  const medicalTaxCredit = Math.min(1500, (emp.medicalExpensesPaid ?? 0) * 0.15);
  const annualNetTax = Math.max(0, totalRemunerationTax - femaleTaxCredit - medicalTaxCredit);
  const rawMonthlyTax = annualNetTax / 12;

  // Read saved adjustments
  const savedAdjustmentsStr = typeof window !== 'undefined' ? localStorage.getItem('ZEN_TAX_ADJUSTMENTS_V1') : null;
  const adjustments = savedAdjustmentsStr ? JSON.parse(savedAdjustmentsStr) : {};
  const adj = overrideAdj !== undefined ? overrideAdj : adjustments[emp.id];

  let monthlyTax = rawMonthlyTax;
  let isAdjustmentActive = false;
  let adjMonthName = 'पौष';
  let monthsPaid = 5;
  let taxPaid = 5 * baseMonthlyTax;
  let remainingTax = annualNetTax - taxPaid;
  let remainingMonths = 7;
  let adjustedMonthlyTaxVal = rawMonthlyTax;

  if (adj && adj.isTaxAdjustmentActive) {
    isAdjustmentActive = true;
    adjMonthName = adj.taxAdjustedFromMonth || 'पौष';

    const fiscalOrder = ['साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पौष', 'माघ', 'फागुन', 'चैत', 'वैशाख', 'जेठ', 'असार'];
    const adjIdx = fiscalOrder.indexOf(adjMonthName);
    const currentIdx = adjIdx !== -1 ? adjIdx : 5; // default to Poush (index 5)

    monthsPaid = currentIdx; // months paid before distribution
    taxPaid = monthsPaid * baseMonthlyTax;
    remainingTax = Math.max(0, annualNetTax - taxPaid);
    remainingMonths = 12 - monthsPaid;

    if (remainingMonths > 0) {
      adjustedMonthlyTaxVal = remainingTax / remainingMonths;
    } else {
      adjustedMonthlyTaxVal = 0;
    }

    if (selectedMonth) {
      const curIdx = fiscalOrder.indexOf(selectedMonth);
      if (curIdx !== -1 && curIdx < currentIdx) {
        monthlyTax = baseMonthlyTax;
      } else {
        monthlyTax = adjustedMonthlyTaxVal;
      }
    } else {
      monthlyTax = adjustedMonthlyTaxVal; // default to adjusted monthly in generic views
    }
  }

  const totalDeduction = (isP ? (basic * 0.31 + basic * 0.20 + basic * 0.0833) : 0) + monthlyTax;

  return {
    employee: emp,
    monthly: { 
      basic, da, grade, ssf20, pf10, grat833, 
      monthlyGross, totalDeduction,
      ssf31: isP ? basic * 0.31 : 0,
      pf20_total: isP ? basic * 0.20 : 0
    },
    lumpsum: { dashain, festival, bonus, medical, dress, totalLumpsum },
    annual: { annSalary, annDa, annGrade, annSsf20, annPf10, annGrat833, totalAnnualIncome },
    approvedFund: { ssfFund31, pfFund20, gratFund833, totalContribution },
    reductions: { allowableDed, lifeIns, healthIns, buildingIns, remoteReduct, incapacitatedReduct, totalReductions, adjustedTaxableIncome },
    tax: { 
      finalTaxableIncome, 
      totalRemunerationTax, 
      slabBreakdown, 
      femaleTaxCredit, 
      medicalTaxCredit, 
      annualNetTax, 
      monthlyTax,
      baseMonthlyTax,
      adjustedMonthlyTax: adjustedMonthlyTaxVal,
      monthsPaidBeforeAdjustment: monthsPaid,
      taxPaidBeforeAdjustment: taxPaid,
      remainingMonths,
      isAdjustmentActive,
      taxAdjustedFromMonth: adjMonthName
    }
  };
};

const buildPaySlipEmailContent = ({
  emp,
  slip,
  year,
  month,
  settings
}: {
  emp: any;
  slip: PayrollRecord;
  year: string;
  month: string;
  settings?: any;
}) => {
  const f2 = (n: number | undefined | null) => (n ?? 0).toLocaleString('ne-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const basicSalary = slip.basicSalary ?? (slip as any).basic ?? emp.basicSalary ?? 0;
  const allowance = slip.allowance ?? 0;
  const gradeAmt = slip.gradeAmt ?? (slip as any).grade ?? 0;

  const dashainBonus = slip.dashainBonus ?? 0;
  const bonusAmount = slip.bonusAmount ?? 0;
  const sanchitLeaveAmount = slip.sanchitLeaveAmount ?? 0;
  const medicalAllowance = slip.medicalAllowance ?? 0;
  const dressAllowance = slip.dressAllowance ?? 0;
  const extraIncome = dashainBonus + bonusAmount + sanchitLeaveAmount + medicalAllowance + dressAllowance;

  const ssfEmployee = slip.ssfEmployee ?? (slip as any).ssfEmp ?? (basicSalary * 0.20);
  const pfEmployee = slip.pfEmployee ?? (slip as any).pfEmp ?? (basicSalary * 0.10);
  const gratuity = slip.gratuity ?? (basicSalary * 0.0833);

  // Check if there is any remaining unitemized difference in totalIncome
  const subTotalCalculated = basicSalary + allowance + gradeAmt + extraIncome + ssfEmployee + pfEmployee + gratuity;
  const totalIncome = slip.totalIncome ?? (slip as any).grossTotal ?? subTotalCalculated;
  const unitemizedDiff = Math.max(0, totalIncome - subTotalCalculated);

  const ssfEmployer = slip.ssfEmployer ?? (basicSalary * 0.31);
  const pfEmployer = slip.pfEmployer ?? (basicSalary * 0.20);
  const gratuityEmployer = slip.gratuity ?? (basicSalary * 0.0833);
  const tax = slip.tax ?? 0;
  const totalDeductions = (slip.ssfEmployer ? (slip.ssfEmployer + (slip.pfEmployer || 0) + (slip.gratuity || 0) + tax) : (ssfEmployer + pfEmployer + gratuityEmployer + tax));
  const netSalary = slip.netSalary ?? (slip as any).netPay ?? (totalIncome - totalDeductions);

  const hasExtra = (extraIncome > 0) || (unitemizedDiff > 0.01);
  const orgName = settings?.systemName || 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड';

  // Structured Plain Text Body with clear Nepali headings and sections
  let body = `आदरणीय ${emp.fullName} ज्यू,\n\n` +
    `${orgName}बाट तपाईंको आर्थिक वर्ष: ${year} (${month} महिना) को तलव भुक्तानी विवरण (Salary Pay Slip) PDF फाइल संलग्न गरी पठाइएको छ।\n\n` +
    `========================================\n` +
    `कर्मचारी विवरण (Employee Profile)\n` +
    `• नाम: ${emp.fullName}\n` +
    `• पद: ${emp.designation || '-'}\n` +
    `• PAN नं: ${emp.panNo || '-'}\n` +
    `• तलव महिना/आ.व.: ${month} ${year}\n` +
    `========================================\n\n` +
    `[ १. मासिक आम्दानी (Monthly Earnings) ]\n` +
    `• तलव स्केल (Basic Salary): रू. ${f2(basicSalary)}\n` +
    `• महंगी भत्ता (Dearness Allowance): रू. ${f2(allowance)}\n` +
    `• ग्रेड खर्च (Grade Amount): रू. ${f2(gradeAmt)}\n\n`;

  if (hasExtra) {
    body += `[ २. अतिरिक्त सुविधाहरू (Additional Benefits) ]\n`;
    if (dashainBonus > 0) body += `• दशैं भत्ता (Dashain Bonus): रू. ${f2(dashainBonus)}\n`;
    if (bonusAmount > 0) body += `• बोनस रकम (Bonus): रू. ${f2(bonusAmount)}\n`;
    if (sanchitLeaveAmount > 0) body += `• सञ्चित विदा (Leave Encashment): रू. ${f2(sanchitLeaveAmount)}\n`;
    if (medicalAllowance > 0) body += `• औषधोपचार खर्च (Medical Allowance): रू. ${f2(medicalAllowance)}\n`;
    if (dressAllowance > 0) body += `• पोशाक भत्ता (Dress Allowance): रू. ${f2(dressAllowance)}\n`;
    if (unitemizedDiff > 0.01) body += `• अन्य थप सुविधा (Other Allowance): रू. ${f2(unitemizedDiff)}\n`;
    body += `\n`;
  }

  const contribSecNum = hasExtra ? '३' : '२';
  body += `[ ${contribSecNum}. संस्था योगदान रकम (Employer Fund Contributions) ]\n` +
    `• सामाजिक सुरक्षा कोष (SSF 20%): रू. ${f2(ssfEmployee)}\n` +
    `• संचय कोष (PF 10%): रू. ${f2(pfEmployee)}\n` +
    `• उपदान कोष (Gratuity 8.33%): रू. ${f2(gratuity)}\n\n` +
    `----------------------------------------\n` +
    `कुल जम्मा आम्दानी (Gross Income): रू. ${f2(totalIncome)}\n` +
    `----------------------------------------\n\n`;

  const dedSecNum = hasExtra ? '४' : '३';
  body += `[ ${dedSecNum}. कोष तथा कर कट्टी (Deductions) ]\n` +
    `• सामाजिक सुरक्षा कोष कट्टी (३१%): रू. ${f2(ssfEmployer)}\n` +
    `• संचय कोष कट्टी (२०%): रू. ${f2(pfEmployer)}\n` +
    `• उपदान कोष कट्टी (८.३३%): रू. ${f2(gratuityEmployer)}\n` +
    `• पारिश्रमिक आयकर कट्टी (TDS Tax): रू. ${f2(tax)}\n` +
    `• जम्मा कट्टी रकम (Total Deductions): रू. ${f2(totalDeductions)}\n\n` +
    `========================================\n` +
    `शुद्ध भुक्तानी तलव (NET PAYABLE SALARY): रू. ${f2(netSalary)}\n` +
    `========================================\n\n` +
    `कृपया यस ईमेलमा संलग्न आधिकारिक "Salary_Pay_Slip.pdf" फाइल हेर्नुहोला।\n\n` +
    `धन्यवाद,\n` +
    `${orgName}\n` +
    `पिपरा गाउँपालिका-६, महोत्तरी`;

  // Rich HTML template
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #064e3b; color: #ffffff; padding: 22px 20px; text-align: center;">
        <h2 style="margin: 0 0 4px 0; font-size: 19px; font-weight: 800; letter-spacing: -0.5px;">${orgName}</h2>
        <p style="margin: 0; font-size: 12px; color: #a7f3d0; font-weight: 600;">पिपरा गाउँपालिका-६, महोत्तरी</p>
        <div style="margin-top: 10px; display: inline-block; background: rgba(255,255,255,0.18); padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.3px;">
          आ.व. ${year} (${month} महिना) - तलव भुक्तानी विवरण (Salary Pay Slip)
        </div>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 13px; margin: 0 0 16px 0; color: #334155;">
          आदरणीय <strong>${emp.fullName}</strong> ज्यू,<br>
          तपाईंको <strong>${year} (${month} महिना)</strong> को तलव भुक्तानी विवरण तल दिइए बमोजिम रहेको छ। आधिकारिक विस्तृत ई-पे स्लिप यस ईमेलमा संलग्न PDF फाइलमा उपलब्ध छ।
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;"><strong>कर्मचारीको नाम:</strong> <span style="text-transform: uppercase;">${emp.fullName}</span></td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;"><strong>पद:</strong> <span style="text-transform: uppercase;">${emp.designation || '-'}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 12px;"><strong>PAN नं:</strong> <span style="font-family: monospace;">${emp.panNo || '-'}</span></td>
            <td style="padding: 8px 12px;"><strong>ईमेल:</strong> ${emp.email || '-'}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #000000; margin-bottom: 18px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 8px 12px; text-align: left; border: 1px solid #000000; font-weight: bold; width: 40px;">क.स.</th>
              <th style="padding: 8px 12px; text-align: left; border: 1px solid #000000; font-weight: bold;">विवरण (Description)</th>
              <th style="padding: 8px 12px; text-align: right; border: 1px solid #000000; width: 140px; font-weight: bold;">रकम रु. (Amount)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="3" style="padding: 6px 12px; border: 1px solid #000000; color: #0f172a;">१. मासिक आम्दानी (Monthly Earnings)</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">१.१</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">तलव स्केल (Basic Scale)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(basicSalary)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">१.२</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">महंगी भत्ता (Dearness Allowance)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(allowance)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">१.३</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">ग्रेड खर्च (Grade Amount)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(gradeAmt)}</td>
            </tr>

            ${hasExtra ? `
            <tr style="background: #ecfdf5; font-weight: bold; color: #065f46;">
              <td colspan="3" style="padding: 6px 12px; border: 1px solid #000000;">२. अतिरिक्त सुविधाहरू (Additional Benefits)</td>
            </tr>
            ${dashainBonus > 0 ? `
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">२.१</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">दशैं भत्ता (Dashain Bonus)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(dashainBonus)}</td>
            </tr>` : ''}
            ${bonusAmount > 0 ? `
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">२.२</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">बोनस रकम (Bonus)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(bonusAmount)}</td>
            </tr>` : ''}
            ${sanchitLeaveAmount > 0 ? `
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">२.३</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">सञ्चित विदा (Leave Encashment)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(sanchitLeaveAmount)}</td>
            </tr>` : ''}
            ${medicalAllowance > 0 ? `
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">२.४</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">औषधोपचार खर्च (Medical Allowance)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(medicalAllowance)}</td>
            </tr>` : ''}
            ${dressAllowance > 0 ? `
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">२.५</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">पोशाक भत्ता (Dress Allowance)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(dressAllowance)}</td>
            </tr>` : ''}
            ${unitemizedDiff > 0.01 ? `
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">२.६</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">अन्य थप सुविधा (Other Allowance)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(unitemizedDiff)}</td>
            </tr>` : ''}
            ` : ''}

            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="3" style="padding: 6px 12px; border: 1px solid #000000; color: #0f172a;">${contribSecNum}. संस्था योगदान रकम (Employer Fund Contributions)</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">${contribSecNum}.१</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">सामाजिक सुरक्षा कोष (SSF 20%)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(ssfEmployee)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">${contribSecNum}.२</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">संचय कोष (PF 10%)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(pfEmployee)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">${contribSecNum}.३</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">उपदान कोष (Gratuity 8.33%)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(gratuity)}</td>
            </tr>

            <tr style="background: #e2e8f0; font-weight: 800; font-size: 13px;">
              <td colspan="2" style="padding: 8px 12px; border: 1px solid #000000;">जम्मा भुक्तानी/आम्दानी (Gross Income)</td>
              <td style="padding: 8px 12px; border: 1px solid #000000; text-align: right; font-weight: 900;">रू. ${f2(totalIncome)}</td>
            </tr>

            <tr style="background: #fff1f2; font-weight: bold; color: #9f1239;">
              <td colspan="3" style="padding: 6px 12px; border: 1px solid #000000;">${dedSecNum}. कोष तथा कर कट्टी (Deductions)</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">${dedSecNum}.१</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">सामाजिक सुरक्षा कोष कट्टी (३१%)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(ssfEmployer)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">${dedSecNum}.२</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">संचय कोष कट्टी (२०%)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(pfEmployer)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">${dedSecNum}.३</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">उपदान कोष कट्टी (८.३३%)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(gratuityEmployer)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: center;">${dedSecNum}.४</td>
              <td style="padding: 6px 12px; border: 1px solid #000000;">पारिश्रमिक आयकर कट्टी (TDS Tax)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: bold;">रू. ${f2(tax)}</td>
            </tr>
            <tr style="background: #fecdd3; font-weight: bold;">
              <td colspan="2" style="padding: 6px 12px; border: 1px solid #000000;">जम्मा कट्टी रकम (Total Deductions)</td>
              <td style="padding: 6px 12px; border: 1px solid #000000; text-align: right; font-weight: 900;">रू. ${f2(totalDeductions)}</td>
            </tr>

            <tr style="background: #dcfce7; font-weight: 900; font-size: 14px; color: #14532d;">
              <td colspan="2" style="padding: 10px 12px; border: 2px solid #15803d; text-transform: uppercase;">शुद्ध भुक्तानी तलव (NET PAYABLE SALARY)</td>
              <td style="padding: 10px 12px; border: 2px solid #15803d; text-align: right; font-size: 15px;">रू. ${f2(netSalary)}</td>
            </tr>
          </tbody>
        </table>

        <p style="font-size: 11px; color: #64748b; margin-top: 16px; text-align: center; font-style: italic;">
          द्रष्टव्य: यो कम्प्युटर प्रणालीबाट स्वतः तयार पारिएको (System Generated) तलब भुक्तानी विवरण हो।
        </p>
      </div>
    </div>
  `;

  return {
    subject: `Salary Pay Slip - ${emp.fullName} (${month} ${year}) | ${orgName}`,
    body,
    html,
    filename: `Salary_Pay_Slip_${emp.fullName.replace(/\s+/g, '_')}_${month}.pdf`
  };
};

const HRManagement: React.FC = () => {
  const { branch, user } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const location = useLocation();
  const navigate = useNavigate();

  // Route parser for /hr/:tab/:subTab?
  const { currentTab, currentEmployeeSubTab } = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'hr') {
      const tab = parts[1].toLowerCase();
      if (tab === 'employees' || tab === 'employee') {
        const sub = parts[2]?.toLowerCase();
        const validSubs: EmployeeSubTab[] = ['list', 'leave', 'attendance', 'remaining-leave', 'documents'];
        return {
          currentTab: 'employees' as HRTab,
          currentEmployeeSubTab: validSubs.includes(sub as EmployeeSubTab) ? (sub as EmployeeSubTab) : 'list'
        };
      }
      if (tab === 'payroll') return { currentTab: 'payroll' as HRTab, currentEmployeeSubTab: 'list' as EmployeeSubTab };
      if (tab === 'board' || tab === 'governance') return { currentTab: 'board' as HRTab, currentEmployeeSubTab: 'list' as EmployeeSubTab };
      if (tab === 'complaints') return { currentTab: 'complaints' as HRTab, currentEmployeeSubTab: 'list' as EmployeeSubTab };
      if (tab === 'dashboard') return { currentTab: 'dashboard' as HRTab, currentEmployeeSubTab: 'list' as EmployeeSubTab };
    }
    return { currentTab: 'dashboard' as HRTab, currentEmployeeSubTab: 'list' as EmployeeSubTab };
  }, [location.pathname]);

  const activeTab = currentTab;
  const activeEmployeeSubTab = currentEmployeeSubTab;

  const handleTabChange = (tabId: HRTab) => {
    if (tabId === 'dashboard') {
      navigate('/hr');
    } else if (tabId === 'employees') {
      navigate(`/hr/employees/${activeEmployeeSubTab || 'list'}`);
    } else {
      navigate(`/hr/${tabId}`);
    }
  };

  const handleEmployeeSubTabChange = (sub: EmployeeSubTab) => {
    navigate(`/hr/employees/${sub}`);
  };
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(() => {
    const saved = localStorage.getItem('ZEN_TAX_POLICY_V1');
    return saved ? JSON.parse(saved) : DEFAULT_TAX_CONFIG;
  });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, name: string } | null>(null);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [selectedDocEmployeeId, setSelectedDocEmployeeId] = useState<string | null>(null);
  const [isSyncingStaff, setIsSyncingStaff] = useState(false);

  const defaultEmployee: Employee = {
    id: '',
    fullName: '',
    employeeCode: '',
    designation: '',
    department: '',
    gender: 'Male',
    maritalStatus: 'Single',
    employmentType: 'Permanent',
    mobile: '',
    email: '',
    panNo: '',
    joinedDate: new Date().toISOString().split('T')[0],
    basicSalary: 0,
    daType: 'None',
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
    monthsActive: 12,
    hasDashain: false,
    dashainBonus: 0,
    hasMedical: false,
    medicalAllowance: 0,
    hasBonus: false,
    festivalBonus: 0,
    bonusYearly: 0,
    sanchitLeaveDays: 0,
    sanchitLeaveAmount: 0,
    status: 'Active',
    branchId: branch?.id || '',
    lifeInsurance: 0,
    healthInsurance: 0,
    buildingInsurance: 0,
    medicalExpensesPaid: 0,
    remoteAreaCategory: 'None',
    isIncapacitated: false
  };

  const loadData = useCallback(async () => {
    try {
      const [emps, lTypes, lReqs, pRecs, comps, sets, brs, savedTaxCfg] = await Promise.all([
        storageService.getEmployees(),
        storageService.getLeaveTypes(),
        storageService.getLeaveRequests(),
        storageService.getPayrollRecords(),
        storageService.getComplaints(),
        storageService.getSettings(),
        storageService.getBranches(),
        storageService.getTaxConfig(),
        storageService.getTaxAdjustments()
      ]);

      // Robust employee deduplication by ID, name, code, and citizenship
      const uniqueEmps: Employee[] = deduplicateEmployees(emps || []);

      // Guarantee Record #6: SUMIT KUMAR THAKUR is ALWAYS present in state
      const hasSumit = uniqueEmps.some(e => 
        e.id === SUMIT_KUMAR_THAKUR_RECORD.id ||
        (e.fullName && e.fullName.toUpperCase().includes('SUMIT KUMAR THAKUR')) ||
        (e.employeeCode && (e.employeeCode === '6' || e.employeeCode === 'EMP-006' || e.employeeCode === 'EMP-005'))
      );
      if (!hasSumit) {
        uniqueEmps.push({ ...SUMIT_KUMAR_THAKUR_RECORD });
      }

      // If duplicate records were found and cleaned, persist cleaned list to storage
      if (emps && emps.length > uniqueEmps.length) {
        try {
          localStorage.setItem('saccos_db_employees', JSON.stringify(uniqueEmps));
        } catch (_) {}
      }

      setEmployees(uniqueEmps);
      setLeaveTypes(lTypes);
      setLeaveRequests(lReqs);

      // Clean up orphaned payroll records whose employee does not exist in active staff
      const validEmpIdSet = new Set(uniqueEmps.map(e => e.id));
      const cleanPayrollRecords = (pRecs || []).filter(pr => pr && pr.employeeId && validEmpIdSet.has(pr.employeeId));
      if (pRecs && pRecs.length > cleanPayrollRecords.length) {
        // Automatically purge orphaned records from storage/database
        storageService.savePayrollRecords(cleanPayrollRecords).catch(() => {});
      }
      setPayrollRecords(cleanPayrollRecords);

      setComplaints(comps);
      setSettings(sets);
      setBranches(brs);
      if (savedTaxCfg) setTaxConfig(savedTaxCfg);
    } catch (error) {
      console.error("Error loading HR data:", error);
    }
  }, [branch, user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleAdjUpdate = () => {
      loadData();
    };
    const handleEmpUpdate = () => {
      loadData();
    };
    window.addEventListener('taxAdjustmentsUpdated', handleAdjUpdate);
    window.addEventListener('employeesUpdated', handleEmpUpdate);
    return () => {
      window.removeEventListener('taxAdjustmentsUpdated', handleAdjUpdate);
      window.removeEventListener('employeesUpdated', handleEmpUpdate);
    };
  }, [loadData]);

  const handleSyncStaff = async () => {
    if (isDayEnded) return;
    try {
      setIsSyncingStaff(true);
      await storageService.syncAllMasterEmployees();
      await loadData();
      setSaveSuccessMsg('कर्मचारी रेकर्ड ६ (सुमित कुमार ठाकुर) लगायत सबै १४ जना कर्मचारीहरूको रेकर्ड पूर्ण रूपमा अपडेट तथा सिंक भयो!');
      setTimeout(() => setSaveSuccessMsg(null), 4500);
    } catch (err: any) {
      console.warn('Sync staff error:', err);
      await loadData();
    } finally {
      setIsSyncingStaff(false);
    }
  };

  const handleUpdateEmployee = async (emp: Employee) => {
    if (isDayEndedForBranch(emp.branchId || branch?.id)) return;
    if (!emp.fullName || emp.fullName.trim() === '') {
      alert("Full Name is required.");
      return;
    }

    // 1. Check duplicate Citizenship Number
    const cleanCit = cleanCitizenshipNo(emp.citizenshipNo);
    if (cleanCit) {
      const dupCit = employees.find(e => e.id !== emp.id && cleanCitizenshipNo(e.citizenshipNo) === cleanCit);
      if (dupCit) {
        alert(`दोहोरो दर्ता त्रुटि (Duplicate Entry Error):\n\nनागरिकता नम्बर "${emp.citizenshipNo}" पहिले नै कर्मचारी "${dupCit.fullName}" को नाममा दर्ता भइसकेको छ।\nएउटै नागरिकता नम्बरबाट दोहोरो कर्मचारी सिर्जना गर्न मिल्दैन।`);
        return;
      }
    }

    // 2. Check duplicate Mobile Number
    const cleanMob = cleanMobileNo(emp.mobile);
    if (cleanMob.length >= 7) {
      const dupMob = employees.find(e => e.id !== emp.id && cleanMobileNo(e.mobile) === cleanMob);
      if (dupMob) {
        alert(`दोहोरो दर्ता त्रुटि (Duplicate Entry Error):\n\nमोबाइल नम्बर "${emp.mobile}" पहिले नै कर्मचारी "${dupMob.fullName}" को नाममा दर्ता छ।\nकृपया फरक मोबाइल नम्बर प्रयोग गर्नुहोस्।`);
        return;
      }
    }

    // 3. Check duplicate Employee Code
    const cleanCode = cleanEmployeeCode(emp.employeeCode);
    if (cleanCode) {
      const dupCode = employees.find(e => e.id !== emp.id && cleanEmployeeCode(e.employeeCode) === cleanCode);
      if (dupCode) {
        alert(`दोहोरो दर्ता त्रुटि (Duplicate Entry Error):\n\nकर्मचारी कोड / संकेत "${emp.employeeCode}" पहिले नै कर्मचारी "${dupCode.fullName}" को प्रयोगमा छ।`);
        return;
      }
    }

    // 4. Check duplicate PAN Number
    const cleanPan = (emp.panNo || '').trim().toLowerCase();
    if (cleanPan && cleanPan !== '-' && cleanPan !== 'n/a') {
      const dupPan = employees.find(e => e.id !== emp.id && (e.panNo || '').trim().toLowerCase() === cleanPan);
      if (dupPan) {
        alert(`दोहोरो दर्ता त्रुटि (Duplicate Entry Error):\n\nप्यान नम्बर "${emp.panNo}" पहिले नै कर्मचारी "${dupPan.fullName}" को नाममा दर्ता छ।`);
        return;
      }
    }

    // 5. Check duplicate Name when creating a new employee
    const isNewEmployee = !emp.id || !employees.some(e => e.id === emp.id);
    if (isNewEmployee) {
      const dupName = employees.find(e => isSameEmployeeName(e.fullName, emp.fullName));
      if (dupName) {
        alert(`दोहोरो दर्ता त्रुटि (Duplicate Entry Error):\n\nकर्मचारी "${dupName.fullName}" पहिले नै प्रणालीमा दर्ता भइसकेको छ।\nउस्तै वा मिल्दोजुल्दो नाम भएको दोहोरो कर्मचारी सिर्जना गर्न मिल्दैन।`);
        return;
      }
    }

    setIsSavingEmployee(true);
    try {
      const empId = emp.id && emp.id.trim() !== '' ? emp.id : crypto.randomUUID();
      const employeeToSave: Employee = {
        ...emp,
        id: empId,
        fullName: emp.fullName.toUpperCase().trim(),
        designation: (emp.designation || '').toUpperCase().trim(),
        employeeCode: (emp.employeeCode || '').trim()
      };
      
      console.log("Saving employee and full KYC to Supabase:", employeeToSave);
      await storageService.saveEmployee(employeeToSave);
      console.log("Employee saved successfully to Supabase");
      await loadData();
      setEditingEmployee(null);
      setSaveSuccessMsg(`कर्मचारी "${employeeToSave.fullName}" को सम्पूर्ण व्यक्तिगत विवरण तथा KYC कागजातहरू Supabase मा सुरक्षित भयो!`);
      setTimeout(() => setSaveSuccessMsg(null), 4500);
    } catch (error: any) {
      console.error("Detailed error saving employee to Supabase:", error);
      alert("Error saving employee to Supabase: " + (error.message || JSON.stringify(error)));
    } finally {
      setIsSavingEmployee(false);
    }
  };

  const executeDeleteEmployee = async () => {
    if (isDayEnded) return;
    if (confirmDelete) {
      await storageService.deleteEmployee(confirmDelete.id);
      setConfirmDelete(null);
      loadData();
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-2 h-full flex flex-col overflow-y-auto scrollbar-hide bg-white relative">
      {saveSuccessMsg && (
        <div className="fixed top-5 right-5 z-[7000] bg-emerald-800 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center space-x-3 animate-in slide-in-from-top-3">
          <CheckCircle2 size={20} className="text-emerald-300 shrink-0" />
          <span className="text-xs font-bold">{saveSuccessMsg}</span>
          <button type="button" onClick={() => setSaveSuccessMsg(null)} className="text-emerald-200 hover:text-white ml-2 p-1 rounded-lg">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm no-print mb-3 mx-1 shrink-0">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg"><Users size={20} /></div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tighter uppercase italic leading-none">HR <span className="text-emerald-600">CENTRAL</span></h2>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1 italic leading-none">Employee Governance</p>
            </div>
          </div>
          <nav className="bg-slate-50 p-1 rounded-xl border border-slate-100 flex flex-wrap items-center gap-1 shadow-inner">
            <MenuTab id="dashboard" label="Dashboard" icon={<LayoutDashboard size={12} />} active={activeTab} onClick={handleTabChange} />
            <MenuTab id="employees" label="Employee" icon={<Users size={12} />} active={activeTab} onClick={handleTabChange} />
            <MenuTab id="board" label="Board" icon={<Award size={12} />} active={activeTab} onClick={handleTabChange} />
            <MenuTab id="payroll" label="Payroll" icon={<CreditCard size={12} />} active={activeTab} onClick={handleTabChange} />
            <MenuTab id="complaints" label="Complaints" icon={<AlertCircle size={12} />} active={activeTab} onClick={handleTabChange} />
          </nav>
        </div>
      </div>

      <div className="flex-1 bg-white">
        {activeTab === 'dashboard' && (
          <HRDashboard 
            employees={employees} 
            payrollRecords={payrollRecords}
            leaveRequests={leaveRequests}
            complaints={complaints}
            branches={branches}
            onNavigateTab={handleTabChange}
            onNavigateEmployeeSubTab={handleEmployeeSubTabChange}
            onAddNewEmployee={() => {
              if (isDayEnded) return;
              handleTabChange('employees');
              handleEmployeeSubTabChange('list');
              setEditingEmployee({
                fullName: '',
                designation: '',
                department: 'General',
                gender: 'Male',
                maritalStatus: 'Single',
                employmentType: 'Permanent',
                mobile: '',
                joinedDate: new Date().toISOString().slice(0, 10),
                basicSalary: 0,
                status: 'Active',
                branchId: branch?.id || 'main'
              });
            }}
          />
        )}
        {activeTab === 'employees' && (
          <div className="flex flex-col h-full">
            {/* Employee Sub-Menu Navigation: List, Leave, Attendance */}
            <div className="px-4 py-2 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 no-print mb-2">
              <div className="flex items-center space-x-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => handleEmployeeSubTabChange('list')}
                  className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                    activeEmployeeSubTab === 'list'
                      ? 'bg-slate-950 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Users size={13} className={activeEmployeeSubTab === 'list' ? 'text-emerald-400' : ''} />
                  <span>List</span>
                </button>

                <button
                  onClick={() => handleEmployeeSubTabChange('leave')}
                  className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                    activeEmployeeSubTab === 'leave'
                      ? 'bg-slate-950 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Calendar size={13} className={activeEmployeeSubTab === 'leave' ? 'text-emerald-400' : ''} />
                  <span>Leave</span>
                </button>

                <button
                  onClick={() => handleEmployeeSubTabChange('attendance')}
                  className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                    activeEmployeeSubTab === 'attendance'
                      ? 'bg-slate-950 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Clock size={13} className={activeEmployeeSubTab === 'attendance' ? 'text-emerald-400' : ''} />
                  <span>Attendance</span>
                </button>

                <button
                  onClick={() => handleEmployeeSubTabChange('remaining-leave')}
                  className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                    activeEmployeeSubTab === 'remaining-leave'
                      ? 'bg-slate-950 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText size={13} className={activeEmployeeSubTab === 'remaining-leave' ? 'text-emerald-400' : ''} />
                  <span>Remaining Leave</span>
                </button>

                <button
                  onClick={() => handleEmployeeSubTabChange('documents')}
                  className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                    activeEmployeeSubTab === 'documents'
                      ? 'bg-slate-950 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileBadge size={13} className={activeEmployeeSubTab === 'documents' ? 'text-amber-400' : ''} />
                  <span>Staff Documents Hub</span>
                </button>
              </div>

              {/* Action buttons when in List sub-menu */}
              {activeEmployeeSubTab === 'list' && (
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => !isDayEnded && handleSyncStaff()}
                    disabled={isSyncingStaff || isDayEnded}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 flex items-center space-x-1.5 border border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Sync & Refresh Staff Records"}
                  >
                    <RefreshCw size={12} className={isSyncingStaff ? 'animate-spin' : ''} />
                    <span>{isSyncingStaff ? 'Syncing...' : 'Sync / Refresh Staff'}</span>
                  </button>
                  <button 
                    onClick={() => !isDayEnded && setShowBulkModal(true)}
                    disabled={isDayEnded}
                    title={isDayEnded ? getDayEndedBlockMessage() : "Bulk Employee Setup / Excel Import"}
                    className="bg-slate-900 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 flex items-center space-x-2 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FileSpreadsheet size={13} className="text-emerald-400" />
                    <span>BULK SETUP / EXCEL</span>
                  </button>
                  <button 
                    onClick={() => !isDayEnded && setEditingEmployee(defaultEmployee)}
                    disabled={isDayEnded}
                    title={isDayEnded ? getDayEndedBlockMessage() : "Add New Employee"}
                    className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-slate-900 transition-all active:scale-95 flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={13} />
                    <span>Add Employee</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sub-Tab 1: List */}
            {activeEmployeeSubTab === 'list' && (
              <EmployeeList 
                employees={employees} 
                branches={branches}
                branchId={branch?.id}
                onView={setViewingEmployee} 
                onEdit={(emp) => !isDayEndedForBranch(emp.branchId || branch?.id) && setEditingEmployee(emp)} 
                onDelete={(id, name) => !isDayEnded && setConfirmDelete({ id, name })} 
                onGenerateDoc={(emp) => {
                  setSelectedDocEmployeeId(emp.id);
                  handleEmployeeSubTabChange('documents');
                }}
              />
            )}

            {/* Sub-Tab 2: Leave */}
            {activeEmployeeSubTab === 'leave' && (
              <LeaveModule 
                employees={employees} 
                leaveTypes={leaveTypes} 
                leaveRequests={leaveRequests} 
                onReload={loadData} 
                branchId={branch?.id}
              />
            )}

            {/* Sub-Tab 3: Attendance */}
            {activeEmployeeSubTab === 'attendance' && (
              <AttendanceModule
                employees={employees}
                branches={branches}
                currentBranch={branch}
                currentUser={user}
              />
            )}

            {/* Sub-Tab 4: Remaining Leave */}
            {activeEmployeeSubTab === 'remaining-leave' && (
              <RemainingLeaveModule
                employees={employees}
                leaveTypes={leaveTypes}
                leaveRequests={leaveRequests}
                branches={branches}
                currentBranch={branch}
              />
            )}

            {/* Sub-Tab 5: Employee Documents Hub */}
            {activeEmployeeSubTab === 'documents' && (
              <EmployeeDocumentsHub
                employees={employees}
                branches={branches}
                settings={settings}
                initialEmployeeId={selectedDocEmployeeId}
                onBack={() => handleEmployeeSubTabChange('list')}
              />
            )}
          </div>
        )}
        {activeTab === 'leave' && (
          <div className="flex flex-col h-full">
            <LeaveModule employees={employees} leaveTypes={leaveTypes} leaveRequests={leaveRequests} onReload={loadData} branchId={branch?.id} />
          </div>
        )}
        {activeTab === 'payroll' && (
          <PayrollModule 
            employees={employees} 
            payrollRecords={payrollRecords} 
            reload={loadData} 
            taxConfig={taxConfig} 
            onUpdatePolicy={async (c: any) => { 
              setTaxConfig(c); 
              await storageService.saveTaxConfig(c); 
              window.dispatchEvent(new Event('taxAdjustmentsUpdated'));
            }} 
            onEditEmployee={setEditingEmployee}
            setPayrollRecords={setPayrollRecords}
            settings={settings}
            user={user}
            branch={branch}
          />
        )}
        {activeTab === 'board' && (
          <div className="flex flex-col h-full p-1">
            <BoardManagement currentBranch={branch} settings={settings} />
          </div>
        )}
        {activeTab === 'complaints' && <ComplaintsModule employees={employees} complaints={complaints} onReload={loadData} branchId={branch?.id} />}
      </div>

      {viewingEmployee && (
        <ViewEmployeeModal 
          employee={viewingEmployee} 
          onClose={() => setViewingEmployee(null)} 
          onEdit={(emp) => {
            setViewingEmployee(null);
            setEditingEmployee(emp);
          }}
          settings={settings}
          branches={branches}
          onGenerateDoc={(emp) => {
            setSelectedDocEmployeeId(emp.id);
            handleEmployeeSubTabChange('documents');
          }}
        />
      )}

      {editingEmployee && (
        <EditEmployeeModal 
          employee={editingEmployee} 
          onClose={() => setEditingEmployee(null)} 
          onSave={handleUpdateEmployee} 
          branches={branches}
          isSuper={user?.roleId === '1' || user?.username === 'admin'}
          isSaving={isSavingEmployee}
        />
      )}

      {showBulkModal && (
        <BulkEmployeeModal
          employees={employees}
          onClose={() => setShowBulkModal(false)}
          onSaveAll={loadData}
          branchId={branch?.id}
        />
      )}
      
      {confirmDelete && (
        <ConfirmationModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => { if (!isDayEnded) executeDeleteEmployee(); }}
          title="Remove Employee"
          message={`Are you sure you want to permanently remove ${confirmDelete.name} from the registry? This action cannot be undone and may affect historical payroll data.`}
          confirmText="Delete Record"
          type="danger"
        />
      )}
    </div>
  );
};

const MenuTab = ({ id, label, icon, active, onClick }: any) => (
  <button onClick={() => onClick(id)} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all duration-300 ${active === id ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>
    <span className={active === id ? 'text-emerald-600' : 'text-slate-300'}>{icon}</span>
    <span>{label}</span>
  </button>
);

const HorizontalMenuTab = ({ id, label, icon, active, onClick }: any) => (
  <button onClick={() => onClick(id)} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-widest transition-all duration-300 ${active === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
    <span className={active === id ? 'text-blue-600' : 'text-slate-300'}>{icon}</span>
    <span>{label}</span>
  </button>
);

const PayrollModule = ({ employees, payrollRecords, reload, taxConfig, onUpdatePolicy, onEditEmployee, setPayrollRecords, settings, user, branch }: any) => {
  const isDayEnded = useDayEndLock(branch?.id);
  const [activeMenu, setActiveMenu] = useState<PayrollMenuTab>('sheet');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      const d = new NepaliDate();
      return NEPALI_MONTHS[d.getMonth()] || 'पौष';
    } catch (e) {
      return 'पौष';
    }
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    try {
      const d = new NepaliDate();
      const year = d.getYear();
      const month = d.getMonth();
      if (month >= 3) { // Shrawan (3) to Chaitra (11)
        return `${year}/${year + 1}`;
      } else { // Baisakh (0) to Ashad (2)
        return `${year - 1}/${year}`;
      }
    } catch (e) {
      return '2081/2082';
    }
  });
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);
  const [isPeriodSelectorOpen, setIsPeriodSelectorOpen] = useState(false);
  
  const [viewingArchivedRun, setViewingArchivedRun] = useState<{year: string, month: string} | null>(null);

  const [preparedBy, setPreparedBy] = useState<string>('');
  const [checkedBy, setCheckedBy] = useState<string>('');
  const [approvedBy, setApprovedBy] = useState<string>('');

  const [showDashain, setShowDashain] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [showSanchit, setShowSanchit] = useState(false);
  const [showMedical, setShowMedical] = useState(false);
  const [showDress, setShowDress] = useState(false);

  const [postToTellerLedger, setPostToTellerLedger] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('payroll_post_to_teller');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleSetPostToTellerLedger = (val: boolean) => {
    setPostToTellerLedger(val);
    try {
      localStorage.setItem('payroll_post_to_teller', String(val));
    } catch (e) {
      console.warn("Could not persist posting toggle:", e);
    }
  };

  useEffect(() => {
    if (selectedSlip && selectedSlip.id?.startsWith('temp-')) {
      openSlipForEmployee(selectedSlip.employeeId);
    }
  }, [showDashain, showBonus, showSanchit, showMedical, showDress]);

  const openSlipForEmployee = (empId: string) => {
    const emp = employees.find((e: any) => e.id === empId);
    if (!emp) return;
    const existingRecord = payrollRecords.find(r => r.year === selectedYear && r.month === selectedMonth && r.employeeId === empId);
    if (existingRecord) {
      setSelectedSlip(existingRecord);
      return;
    }
    const data = calculateDetailedPayroll(emp, taxConfig, selectedMonth);
    const dashainAmt = showDashain ? (data.lumpsum.dashain || 0) : 0;
    const bonusAmt = showBonus ? (data.lumpsum.bonus || 0) : 0;
    const sanchitAmt = showSanchit ? (data.lumpsum.festival || 0) : 0;
    const medicalAmt = showMedical ? (data.lumpsum.medical || 0) : 0;
    const dressAmt = showDress ? (data.lumpsum.dress || 0) : 0;
    const extraIncome = dashainAmt + bonusAmt + sanchitAmt + medicalAmt + dressAmt;

    const slip: PayrollRecord = {
      id: 'temp-' + empId, employeeId: emp.id, month: selectedMonth, year: selectedYear,
      basicSalary: data.monthly.basic, 
      gradeAmt: data.monthly.grade, 
      allowance: data.monthly.da,
      ssfEmployee: data.monthly.basic * 0.20,
      pfEmployee: data.monthly.basic * 0.10,
      gratuity: data.monthly.basic * 0.0833,
      dashainBonus: dashainAmt,
      bonusAmount: bonusAmt,
      sanchitLeaveAmount: sanchitAmt,
      medicalAllowance: medicalAmt,
      dressAllowance: dressAmt,
      showDashain, showBonus, showSanchit, showMedical, showDress,
      totalIncome: data.monthly.monthlyGross + extraIncome, 
      ssfEmployer: data.monthly.basic * 0.31,
      pfEmployer: data.monthly.basic * 0.20,
      tax: data.tax.monthlyTax, 
      netSalary: (data.monthly.monthlyGross + extraIncome) - data.monthly.totalDeduction,
      generatedDate: Date.now(), status: 'Paid', preparedBy: 'System Registry', approvedBy: '',
      branchId: emp.branchId && emp.branchId !== '' ? emp.branchId : null
    };
    setSelectedSlip(slip);
  };

  const handleGenerateSheet = async () => {
    if (isDayEnded) return;
    if (window.confirm(`Generate and archive salary sheet for ${selectedMonth} ${selectedYear}?`)) {
      try {
        const activeEmps = employees.filter((e: any) => e.status === 'Active');
        
        const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;
        let totalGross = 0;
        let totalDeductions = 0;

        const newRecords = activeEmps.map(emp => {
          const data = calculateDetailedPayroll(emp, taxConfig, selectedMonth);
          const dashainAmt = showDashain ? (data.lumpsum.dashain || 0) : 0;
          const bonusAmt = showBonus ? (data.lumpsum.bonus || 0) : 0;
          const sanchitAmt = showSanchit ? (data.lumpsum.festival || 0) : 0;
          const medicalAmt = showMedical ? (data.lumpsum.medical || 0) : 0;
          const dressAmt = showDress ? (data.lumpsum.dress || 0) : 0;
          const extraIncome = dashainAmt + bonusAmt + sanchitAmt + medicalAmt + dressAmt;

          const gross = r2(data.monthly.monthlyGross + extraIncome);
          const ded = r2(data.monthly.totalDeduction);
          totalGross = r2(totalGross + gross);
          totalDeductions = r2(totalDeductions + ded);

          const slip: PayrollRecord = {
            id: `${selectedYear}-${selectedMonth}-${emp.id}`,
            employeeId: emp.id,
            month: selectedMonth,
            year: selectedYear,
            basicSalary: r2(data.monthly.basic), 
            gradeAmt: r2(data.monthly.grade), 
            allowance: r2(data.monthly.da),
            ssfEmployee: r2(data.monthly.basic * 0.20),
            pfEmployee: r2(data.monthly.basic * 0.10),
            gratuity: r2(data.monthly.basic * 0.0833),
            dashainBonus: dashainAmt,
            bonusAmount: bonusAmt,
            sanchitLeaveAmount: sanchitAmt,
            medicalAllowance: medicalAmt,
            dressAllowance: dressAmt,
            showDashain,
            showBonus,
            showSanchit,
            showMedical,
            showDress,
            totalIncome: gross, 
            ssfEmployer: r2(data.monthly.basic * 0.31),
            pfEmployer: r2(data.monthly.basic * 0.20),
            tax: r2(data.tax.monthlyTax), 
            netSalary: r2(gross - ded),
            generatedDate: Date.now(),
            status: 'Paid',
            preparedBy: `${preparedBy || 'System Admin'}||${checkedBy || 'Checked Admin'}`,
            approvedBy: approvedBy || 'Accountant',
            branchId: emp.branchId && emp.branchId !== '' ? emp.branchId : null
          };
          return slip;
        });

        const totalNetPay = r2(totalGross - totalDeductions);
        
        await storageService.savePayrollRecords(newRecords);

        // Auto post to Teller Ledger if Posting checkbox is ticked
        if (postToTellerLedger && totalGross > 0) {
          try {
            const todayBs = new NepaliDate().format('YYYY-MM-DD');
            const targetBranchId = branch?.id || 'main';
            const existingDay = await storageService.getDayData(todayBs, targetBranchId);

            const prefix = `payroll_${selectedYear.replace(/[/\\s]/g, '_')}_${selectedMonth}_`;
            const currentOfficeTx = (existingDay?.officeTransactions || []).filter(
              (t: any) => !t.id?.startsWith(prefix) && !(t.remarks && t.remarks.includes(`(${selectedMonth} ${selectedYear})`))
            );

            // 1. Debits side -> Other column: Total Gross Salary (जम्मा आम्दानी)
            const grossEntry: OfficeAccountEntry = {
              id: `${prefix}gross_${Date.now()}`,
              head: 'Other',
              amount: r2(totalGross),
              type: 'out',
              date: todayBs,
              remarks: `Staff Payroll Gross Earnings (${selectedMonth} ${selectedYear})`,
              createdBy: user?.id || user?.username || 'sys',
              createdByName: user?.fullName || user?.username || 'HR Payroll',
              branchId: targetBranchId,
              origin: 'payroll'
            };

            // 2. Credits side -> Other column: Total Contribution Deductions (योगदान कटौती)
            const dedEntry: OfficeAccountEntry = {
              id: `${prefix}ded_${Date.now()}`,
              head: 'Other',
              amount: r2(totalDeductions),
              type: 'in',
              date: todayBs,
              remarks: `Staff Payroll Contribution Deductions (${selectedMonth} ${selectedYear})`,
              createdBy: user?.id || user?.username || 'sys',
              createdByName: user?.fullName || user?.username || 'HR Payroll',
              branchId: targetBranchId,
              origin: 'payroll'
            };

            // 3. Credits side -> Saving column: Total Net Pay (शुद्ध भुक्तानी)
            const netEntry: OfficeAccountEntry = {
              id: `${prefix}net_${Date.now()}`,
              head: 'Saving',
              amount: r2(totalNetPay),
              type: 'in',
              date: todayBs,
              remarks: `Staff Net Salary Disbursement (Saving Transfer) (${selectedMonth} ${selectedYear})`,
              createdBy: user?.id || user?.username || 'sys',
              createdByName: user?.fullName || user?.username || 'HR Payroll',
              branchId: targetBranchId,
              origin: 'payroll'
            };

            currentOfficeTx.push(grossEntry, dedEntry, netEntry);

            const updatedDayData: DailyData = {
              ...(existingDay || {
                date: todayBs,
                branchId: targetBranchId,
                denominations: JSON.parse(JSON.stringify(DEFAULT_DENOMINATIONS)),
                denoAdjustments: [],
                transactions: [],
                officeTransactions: [],
                remittances: [],
                vaultTransactions: []
              }),
              officeTransactions: currentOfficeTx
            };

            await storageService.saveDayData(todayBs, targetBranchId, updatedDayData);
            window.dispatchEvent(new Event('storage'));
          } catch (postErr) {
            console.error("Failed to post payroll transactions to Teller Ledger:", postErr);
          }
        }

        // Directly fetch and update state to ensure UI sync
        const isSuper = user?.roleId === '1' || user?.username === 'admin';
        const bId = isSuper ? undefined : branch?.id;
        const freshRecords = await storageService.getPayrollRecords(bId);
        setPayrollRecords(freshRecords); 
        setActiveMenu('records'); // Switch active menu to ARCHIVE tab
        await reload(); // Call parent reload to sync all views
        if (postToTellerLedger) {
          alert('Salary sheet generated, archived, and posted to Teller Ledger successfully.');
        } else {
          alert('Salary sheet generated and archived successfully.');
        }
      } catch (err: any) {
        console.error("Failed to generate and save salary sheet:", err);
        alert(`Error: Could not save salary sheet. ${err?.message || err}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-[#000000]">
      <div className={`bg-white px-4 py-2 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between no-print gap-4 mb-2 mx-1 shrink-0 ${selectedSlip || viewingArchivedRun ? 'print:hidden' : ''}`}>
        <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 border border-slate-200/50 shadow-inner">
           <HorizontalMenuTab id="monthly-salary" label="MONTHLY" icon={<Table size={12}/>} active={activeMenu} onClick={setActiveMenu} />
           <HorizontalMenuTab id="calculate-tax" label="AUDIT TAX" icon={<Calculator size={12}/>} active={activeMenu} onClick={setActiveMenu} />
           <HorizontalMenuTab id="sheet" label="SHEET" icon={<FileText size={12}/>} active={activeMenu} onClick={setActiveMenu} />
           <div className="w-px h-4 bg-slate-300 mx-1"></div>
           <HorizontalMenuTab id="records" label="ARCHIVE" icon={<Database size={12}/>} active={activeMenu} onClick={setActiveMenu} />
           <HorizontalMenuTab id="settings" label="SIGNATORY" icon={<LucideSettings size={12}/>} active={activeMenu} onClick={setActiveMenu} />
           <HorizontalMenuTab id="email" label="EMAIL" icon={<Mail size={12}/>} active={activeMenu} onClick={setActiveMenu} />
        </div>
        <div className="flex items-center space-x-2.5">
           {(activeMenu === 'monthly-salary' || activeMenu === 'sheet') && (
             <button 
               onClick={() => !isDayEnded && handleGenerateSheet()}
               disabled={isDayEnded}
               title={isDayEnded ? getDayEndedBlockMessage() : "Generate & Archive Salary Sheet"}
               className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-black tracking-widest shadow-md hover:bg-emerald-700 transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
             >
               <Database size={13}/>
               <span>GENERATE SHEET</span>
             </button>
           )}
           
           <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-1 shadow-2xs">
             <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-white rounded border border-slate-200">
               <span className="text-[9px] font-black uppercase text-slate-400">FY:</span>
               <select 
                 value={selectedYear} 
                 onChange={(e) => setSelectedYear(e.target.value)}
                 className="bg-transparent text-[10px] font-black text-slate-900 outline-none cursor-pointer py-0.5"
               >
                 {FISCAL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
             </div>
             <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-white rounded border border-slate-200">
               <span className="text-[9px] font-black uppercase text-slate-400">महिना:</span>
               <select 
                 value={selectedMonth} 
                 onChange={(e) => setSelectedMonth(e.target.value)}
                 className="bg-transparent text-[10px] font-black text-emerald-700 outline-none cursor-pointer py-0.5"
               >
                 {NEPALI_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
             </div>
           </div>

           <button onClick={() => window.print()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-all shadow-sm"><Printer size={16}/></button>
        </div>
      </div>

      <div className={`flex-1 bg-white border border-slate-200 rounded-[2rem] relative mx-1 shadow-sm overflow-hidden flex flex-col print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0 print:overflow-visible ${selectedSlip || viewingArchivedRun ? 'print:hidden' : ''}`}>
        {activeMenu === 'monthly-salary' && (
          <SalarySheetView 
            employees={employees} 
            selectedMonth={selectedMonth} 
            selectedYear={selectedYear} 
            taxConfig={taxConfig} 
            preparedBy={preparedBy}
            setPreparedBy={setPreparedBy}
            checkedBy={checkedBy}
            setCheckedBy={setCheckedBy}
            approvedBy={approvedBy}
            setApprovedBy={setApprovedBy}
            showDashain={showDashain}
            setShowDashain={setShowDashain}
            showBonus={showBonus}
            setShowBonus={setShowBonus}
            showSanchit={showSanchit}
            setShowSanchit={setShowSanchit}
            showMedical={showMedical}
            setShowMedical={setShowMedical}
            showDress={showDress}
            setShowDress={setShowDress}
            postToTellerLedger={postToTellerLedger}
            setPostToTellerLedger={handleSetPostToTellerLedger}
          />
        )}
        {activeMenu === 'calculate-tax' && (
          <DetailedTaxBreakdown 
            employees={employees} 
            taxConfig={taxConfig} 
            onUpdatePolicy={onUpdatePolicy} 
            onEditEmployee={onEditEmployee} 
            settings={settings}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            preparedBy={preparedBy}
            setPreparedBy={setPreparedBy}
            checkedBy={checkedBy}
            setCheckedBy={setCheckedBy}
            approvedBy={approvedBy}
            setApprovedBy={setApprovedBy}
            branchId={branch?.id}
          />
        )}
        {activeMenu === 'sheet' && (
          <EmployeePaySlipList 
            employees={employees} 
            onView={openSlipForEmployee} 
            selectedYear={selectedYear} 
            selectedMonth={selectedMonth} 
            payrollRecords={payrollRecords} 
            settings={settings} 
            taxConfig={taxConfig} 
            showDashain={showDashain}
            showBonus={showBonus}
            showSanchit={showSanchit}
            showMedical={showMedical}
            showDress={showDress}
          />
        )}
        {activeMenu === 'records' && (
          <SlipRecordsList 
            records={payrollRecords} 
            employees={employees}
            onViewRun={(year: string, month: string) => setViewingArchivedRun({year, month})}
            onReload={reload}
            branchId={branch?.id}
          />
        )}
        {activeMenu === 'settings' && <PayrollSettings employees={employees} settings={settings} branchId={branch?.id} />}
        {activeMenu === 'email' && (
          <EmployeeEmailCenter 
            employees={employees} 
            selectedYear={selectedYear} 
            selectedMonth={selectedMonth} 
            settings={settings} 
            taxConfig={taxConfig} 
            payrollRecords={payrollRecords} 
          />
        )}
      </div>

      {isPeriodSelectorOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[5000] flex items-center justify-center p-6 font-bold uppercase no-print">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] border-2 border-slate-950 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="text-xl font-black tracking-tighter text-slate-900 uppercase">Select Payroll Period</h3>
               <button onClick={() => setIsPeriodSelectorOpen(false)} className="p-2 bg-white border-2 border-slate-100 rounded-xl text-slate-300 hover:text-rose-600 transition-all shadow-sm"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-8 text-[#000000]">
               <div className="space-y-4">
                  <label className="text-[10px] text-slate-400 tracking-widest ml-1">Choose Fiscal Year (आर्थिक वर्ष)</label>
                  <div className="grid grid-cols-2 gap-3">
                     {FISCAL_YEARS.map(year => (
                        <button key={year} onClick={() => setSelectedYear(year)} className={`py-3 rounded-xl text-xs font-black transition-all border-2 ${selectedYear === year ? 'bg-blue-600 text-white border-blue-700 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-300'}`}>{year}</button>
                     ))}
                  </div>
               </div>
               <div className="space-y-4">
                  <label className="text-[10px] text-slate-400 tracking-widest ml-1">Choose Month (महिना)</label>
                  <div className="grid grid-cols-3 gap-2">
                     {NEPALI_MONTHS.map(month => (
                        <button key={month} onClick={() => setSelectedMonth(month)} className={`py-2.5 rounded-xl text-[10px] font-black transition-all border-2 ${selectedMonth === month ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-300'}`}>{month}</button>
                     ))}
                  </div>
               </div>
               <button onClick={() => setIsPeriodSelectorOpen(false)} className="w-full h-14 bg-slate-950 text-white rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center space-x-3 active:scale-95"><Check size={20} strokeWidth={3}/><span>Apply Selection</span></button>
            </div>
          </div>
        </div>
      )}

      {selectedSlip && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[3000] flex items-center justify-center p-4 lg:p-10 overflow-y-auto print:static print:bg-white print:p-0 print:z-auto">
          <div className="bg-white w-full max-w-4xl min-h-fit rounded-[1.5rem] border border-slate-300 shadow-2xl relative animate-in zoom-in-95 duration-200 my-auto print:shadow-none print:border-none print:w-full print:max-w-none print:m-0">
             <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-20 rounded-t-[1.5rem] no-print">
                <div className="flex items-center space-x-3">
                   <button onClick={() => window.print()} className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-600 shadow-md transition-all"><Printer size={14}/><span>Print</span></button>
                   <button onClick={async (evt) => {
                      const btn = evt.currentTarget;
                      const emp = employees.find((e:any) => e.id === selectedSlip.employeeId);
                      if (!emp) return;
                      const email = (emp.email || '').trim();
                      if (!email) {
                        alert(`कर्मचारी ${emp.fullName} को ईमेल ठेगाना KYC/Employee Profile मा थपिएको छैन।\n\nकृपया HR Management > Employee Directory मा गई ${emp.fullName} को Profile Edit गरेर ईमेल दर्ता गर्नुहोस्।`);
                        return;
                      }
                      
                      const origText = btn.innerText;
                      btn.innerText = "Sending PDF Email...";
                      btn.disabled = true;

                      try {
                        const year = selectedSlip.year || selectedYear || '२०८३';
                        const month = selectedSlip.month || selectedMonth || 'साउन';
                        const emailContent = buildPaySlipEmailContent({
                          emp,
                          slip: selectedSlip,
                          year,
                          month,
                          settings
                        });

                        const slipEl = document.getElementById("salary-slip-modal-container");
                        let pdfBase64 = "";
                        if (slipEl) {
                          pdfBase64 = await generateElementPdfBase64(slipEl);
                        }

                        const res = await sendPaySlipApi({
                          to: email,
                          subject: emailContent.subject,
                          body: emailContent.body,
                          html: emailContent.html,
                          pdfBase64,
                          filename: emailContent.filename,
                          smtpConfig: getStoredSmtpConfig()
                        });

                        if (res.success) {
                          alert(`सफलतापूर्वक! कर्मचारी ${emp.fullName} को ईमेल (${email}) मा PDF र पूर्ण शीर्षक सहितको विवरण पठाइयो।`);
                        } else {
                          alert(`ईमेल पठाउन सकिएन: ${res.message || "कृपया SMTP सेटिङ जाँच गर्नुहोस्।"}`);
                        }
                      } catch (err: any) {
                        alert(`त्रुटि: ${err?.message || "PDF जेनेरेट वा ईमेल पठाउँदा समस्या आयो।"}`);
                      } finally {
                        btn.innerText = origText;
                        btn.disabled = false;
                      }
                   }} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-slate-800 shadow-md transition-all"><Mail size={14}/><span>Send to Email</span></button>
                </div>
                <button onClick={() => setSelectedSlip(null)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all"><X size={20}/></button>
             </div>
             <div id="salary-slip-modal-container" className="p-8 print:p-0"><SalarySlipPrintView slip={selectedSlip} employee={employees.find((e:any) => e.id === selectedSlip.employeeId)} settings={settings} employees={employees} /></div>
          </div>
        </div>
      )}

      {viewingArchivedRun && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[3000] flex items-center justify-center p-4 lg:p-10 overflow-y-auto print:static print:bg-white print:p-0 print:z-auto">
          <div className="bg-white w-full max-w-[95%] lg:max-w-7xl min-h-fit rounded-[2rem] border border-slate-300 shadow-2xl relative animate-in zoom-in-95 duration-200 my-auto print:shadow-none print:border-none print:w-full print:max-w-none print:m-0">
             <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-20 rounded-t-[2rem] no-print">
                <div className="flex items-center space-x-3">
                   <h3 className="font-black uppercase italic tracking-tighter text-slate-900">Archived Payroll Record: {viewingArchivedRun.year} {viewingArchivedRun.month}</h3>
                   <button onClick={() => window.print()} className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-600 shadow-md transition-all"><Printer size={14}/><span>Print Page</span></button>
                   <button 
                     disabled={isDayEnded}
                     title={isDayEnded ? getDayEndedBlockMessage() : "Delete Archived Payroll Sheet & Ledger Entries"}
                     onClick={async () => {
                       if (isDayEnded) return;
                       if (window.confirm(`Are you sure you want to delete the payroll sheet and linked Teller Ledger entries for ${viewingArchivedRun.year} ${viewingArchivedRun.month}?`)) {
                         await storageService.deletePayrollRun(viewingArchivedRun.year, viewingArchivedRun.month);
                         setViewingArchivedRun(null);
                         reload();
                       }
                     }}
                     className="flex items-center space-x-2 bg-rose-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-rose-700 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                   >
                     <Trash2 size={14}/>
                     <span>Delete Sheet & Ledger</span>
                   </button>
                </div>
                <button onClick={() => setViewingArchivedRun(null)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all"><X size={24}/></button>
             </div>
             <div className="p-8 print:p-0">
                <ArchivedSalarySheetView 
                  records={payrollRecords.filter(r => r.year === viewingArchivedRun.year && r.month === viewingArchivedRun.month && employees.some((e: any) => e.id === r.employeeId))} 
                  year={viewingArchivedRun.year} 
                  month={viewingArchivedRun.month}
                  employees={employees}
                />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const parseSignatory = (val: string) => {
  if (!val) return { name: '', designation: '' };
  const parts = val.split(' (');
  const name = parts[0] || '';
  const designation = parts[1] ? parts[1].replace(')', '') : '';
  return { name, designation };
};

const SalarySheetView = ({ 
  employees, 
  selectedMonth, 
  selectedYear, 
  taxConfig,
  preparedBy,
  setPreparedBy,
  checkedBy,
  setCheckedBy,
  approvedBy,
  setApprovedBy,
  showDashain,
  setShowDashain,
  showBonus,
  setShowBonus,
  showSanchit,
  setShowSanchit,
  showMedical,
  setShowMedical,
  showDress,
  setShowDress,
  postToTellerLedger,
  setPostToTellerLedger
}: any) => {
  const toNepaliDigits = (val: string | number): string => {
    const str = typeof val === 'number' ? val.toString() : val;
    const nepaliDigits: { [key: string]: string } = {
      '0': '०', '1': '१', '2': '२', '3': '३', '4': '४', '5': '५', '6': '६', '7': '७', '8': '८', '9': '९'
    };
    return str.replace(/[0-9]/g, (w) => nepaliDigits[w]);
  };
  const f2 = (n: number | undefined | null) => {
    const val = n ?? 0;
    const formatted = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return toNepaliDigits(formatted);
  };
  const [settings, setSettings] = useState<any>(null);
  const [sortField, setSortField] = useState<'fullName' | 'employeeCode' | null>('employeeCode');

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await storageService.getSettings();
      setSettings(s);
    };
    fetchSettings();
  }, []);

  const rows = useMemo(() => {
    const baseRows = employees.filter((e: any) => e.status === 'Active').map((emp: any) => {
      const d = calculateDetailedPayroll(emp, taxConfig, selectedMonth);
      return { emp, ...d.monthly, ...d.tax, lumpsum: d.lumpsum };
    });

    if (!sortField) return baseRows;

    return [...baseRows].sort((a, b) => {
      const valA = (sortField === 'fullName' ? a.emp.fullName : a.emp.employeeCode || '').toString().toLowerCase();
      const valB = (sortField === 'fullName' ? b.emp.fullName : b.emp.employeeCode || '').toString().toLowerCase();
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [employees, taxConfig, sortField, selectedMonth]);

  if (!settings) return null;

  return (
    <div className="flex flex-col p-4 bg-white animate-in fade-in flex-1 overflow-auto scrollbar-hide text-black font-normal print:pl-8 print:pr-4 print:py-6">
      {/* Sleek inline non-printing sorting toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4 no-print text-[11px] font-bold bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Sort By:</span>
          <button 
            onClick={() => setSortField(null)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${!sortField ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
          >
            Default
          </button>
          <button 
            onClick={() => setSortField('fullName')}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center space-x-1 ${sortField === 'fullName' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
          >
            <span>Staff Name (A-Z)</span>
            {sortField === 'fullName' && <ArrowUp size={10} />}
          </button>
          <button 
            onClick={() => setSortField('employeeCode')}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center space-x-1 ${sortField === 'employeeCode' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
          >
            <span>ID Code (Asc)</span>
            {sortField === 'employeeCode' && <ArrowUp size={10} />}
          </button>

          <label className="flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all select-none text-slate-800 font-bold ml-1 shadow-2xs" title="Post salary entries to Teller Ledger on Generate">
            <input 
              type="checkbox" 
              checked={!!postToTellerLedger} 
              onChange={(e) => setPostToTellerLedger && setPostToTellerLedger(e.target.checked)} 
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[11px] font-bold text-slate-800">Posting</span>
          </label>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400">अतिरिक्त सुविधाहरू (Additional Benefits):</span>
          <label className="flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all select-none">
            <input 
              type="checkbox" 
              checked={showDashain} 
              onChange={(e) => setShowDashain(e.target.checked)} 
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
            />
            <span>दशैं भत्ता</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all select-none">
            <input 
              type="checkbox" 
              checked={showBonus} 
              onChange={(e) => setShowBonus(e.target.checked)} 
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
            />
            <span>बोनस</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all select-none">
            <input 
              type="checkbox" 
              checked={showSanchit} 
              onChange={(e) => setShowSanchit(e.target.checked)} 
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
            />
            <span>सञ्चित विदा</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all select-none">
            <input 
              type="checkbox" 
              checked={showMedical} 
              onChange={(e) => setShowMedical(e.target.checked)} 
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
            />
            <span>औषधोपचार</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all select-none">
            <input 
              type="checkbox" 
              checked={showDress} 
              onChange={(e) => setShowDress(e.target.checked)} 
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
            />
            <span>पोशाक</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-center mb-6 print:mb-4">
        {settings.logoUrl && (
          <div className="w-20 h-20 mr-6 print:w-18 print:h-18">
             <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Institution Logo" />
          </div>
        )}
        <div className="text-center">
           <h1 className="text-3xl font-bold mb-0.5 text-black tracking-tighter">रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड</h1>
           <p className="text-[11.5px] font-bold text-black uppercase tracking-widest mb-2 text-center">पिपरा गाउँपालिका-६, महोत्तरी</p>
           <div className="inline-block border border-black px-6 py-1 rounded-full text-sm font-bold bg-slate-50 print:bg-white">
              आ.व. {toNepaliDigits(selectedYear)} को {selectedMonth} महिना तलव भुक्तानी तालिका
           </div>
        </div>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="mx-auto text-[11.5px] text-center border-collapse table-auto border border-black">
          <thead>
            <tr className="bg-slate-50 text-black border-b border-black font-bold uppercase text-[12px]">
               <th rowSpan={2} className="px-1 py-1.5 border-r border-black w-[35px] whitespace-nowrap">क्र.सं.</th>
               <th 
                 rowSpan={2} 
                 onClick={() => setSortField(sortField === 'fullName' ? null : 'fullName')}
                 className="px-2 py-1.5 border-r border-black text-left min-w-[160px] whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors select-none"
               >
                 <div className="flex items-center justify-between">
                   <span>कर्मचारीको नाम</span>
                   <span className="no-print text-[9px] text-slate-400 font-normal">
                     {sortField === 'fullName' ? '▲' : '⇅'}
                   </span>
                 </div>
               </th>
               <th colSpan={3} className="px-1 py-1.5 border-r border-black whitespace-nowrap">मासिक आम्दानी</th>
               {((showDashain ? 1 : 0) + (showBonus ? 1 : 0) + (showSanchit ? 1 : 0) + (showMedical ? 1 : 0) + (showDress ? 1 : 0)) > 0 && (
                 <th 
                   colSpan={(showDashain ? 1 : 0) + (showBonus ? 1 : 0) + (showSanchit ? 1 : 0) + (showMedical ? 1 : 0) + (showDress ? 1 : 0)} 
                   className="px-1 py-1.5 border-r border-black text-emerald-800 bg-emerald-50/10 whitespace-nowrap"
                 >
                   अतिरिक्त सुविधा
                 </th>
               )}
               <th colSpan={3} className="px-1 py-1.5 border-r border-black whitespace-nowrap">संस्था योगदान</th>
               <th rowSpan={2} className="px-1 py-1.5 border-r border-black bg-slate-50 whitespace-nowrap w-[75px]">जम्मा आम्दानी</th>
               <th colSpan={5} className="px-1 py-1.5 border-r border-black whitespace-nowrap">योगदान कटौती</th>
               <th rowSpan={2} className="px-1 py-1.5 bg-slate-50 font-bold whitespace-nowrap w-[85px]">शुद्ध भुक्तानी</th>
            </tr>
            <tr className="bg-slate-50 text-[10.5px] text-black uppercase border-b border-black font-bold">
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">तलव</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">भत्ता</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">ग्रेड</th>
               {showDashain && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">दशैं भत्ता</th>}
               {showBonus && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">बोनस</th>}
               {showSanchit && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">सञ्चित विदा</th>}
               {showMedical && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">औषधोपचार</th>}
               {showDress && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">पोशाक</th>}
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">SSF(२०%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">PF(१०%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">उपदान(८.३३%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">SSF(३१%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">PF(२०%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">उपदान(८.३३%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">आयकर</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">जम्मा</th>
             </tr>
          </thead>
          <tbody className="bg-white text-black font-normal text-[11px]">
            {rows.map((r: any, i: number) => {
              const extraAmt = 
                (showDashain ? (r.lumpsum?.dashain || 0) : 0) + 
                (showBonus ? (r.lumpsum?.bonus || 0) : 0) + 
                (showSanchit ? (r.lumpsum?.festival || 0) : 0) + 
                (showMedical ? (r.lumpsum?.medical || 0) : 0) +
                (showDress ? (r.lumpsum?.dress || 0) : 0);
              const rGross = r.monthlyGross + extraAmt;
              const rNet = rGross - r.totalDeduction;

              return (
                <tr key={i} className="border-b border-black hover:bg-slate-50">
                  <td className="px-1 py-1.5 border-r border-black text-center">{toNepaliDigits(i+1)}</td>
                  <td className="px-2 py-1 text-left border-r border-black whitespace-nowrap text-[11.5px]">
                    <div className="flex items-center space-x-2.5">
                      <div>
                        <div className="font-bold uppercase tracking-tight text-[10.5px] leading-tight text-slate-950">{r.emp.fullName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.basic)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.da)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.grade)}</td>
                  {showDashain && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.lumpsum?.dashain || 0)}</td>}
                  {showBonus && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.lumpsum?.bonus || 0)}</td>}
                  {showSanchit && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.lumpsum?.festival || 0)}</td>}
                  {showMedical && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.lumpsum?.medical || 0)}</td>}
                  {showDress && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.lumpsum?.dress || 0)}</td>}
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.ssf20)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.pf10)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.grat833)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums font-bold bg-slate-50/30">{f2(rGross)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.ssf31)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.pf20_total)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.grat833)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.monthlyTax)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums font-bold bg-slate-50/30">{f2(r.totalDeduction)}</td>
                  <td className="px-1 py-1.5 font-sans tabular-nums font-bold bg-slate-50 whitespace-nowrap text-[11.5px]">रू {f2(rNet)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 text-black text-[11px] font-bold uppercase border-t border-black">
             <tr>
                <td colSpan={2} className="text-right pr-2 border-r border-black whitespace-nowrap py-2 text-right">कुल जम्मा (Total):</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.basic,0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.da,0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.grade,0))}</td>
                {showDashain && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(rows.reduce((s:number,x:any)=>s+(x.lumpsum?.dashain || 0),0))}</td>}
                {showBonus && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(rows.reduce((s:number,x:any)=>s+(x.lumpsum?.bonus || 0),0))}</td>}
                {showSanchit && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(rows.reduce((s:number,x:any)=>s+(x.lumpsum?.festival || 0),0))}</td>}
                {showMedical && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(rows.reduce((s:number,x:any)=>s+(x.lumpsum?.medical || 0),0))}</td>}
                {showDress && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(rows.reduce((s:number,x:any)=>s+(x.lumpsum?.dress || 0),0))}</td>}
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.ssf20,0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.pf10,0))}</td>
                <td className="border-r border-black font-sans tabular-nums font-bold">{f2(rows.reduce((s:number,x:any)=>s+x.grat833,0))}</td>
                <td className="border-r border-black font-sans tabular-nums font-bold">{f2(rows.reduce((s:number,x:any)=>{
                  const extra = 
                    (showDashain ? (x.lumpsum?.dashain || 0) : 0) + 
                    (showBonus ? (x.lumpsum?.bonus || 0) : 0) + 
                    (showSanchit ? (x.lumpsum?.festival || 0) : 0) + 
                    (showMedical ? (x.lumpsum?.medical || 0) : 0) +
                    (showDress ? (x.lumpsum?.dress || 0) : 0);
                  return s + x.monthlyGross + extra;
                },0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.ssf31,0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.pf20_total,0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.grat833,0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(rows.reduce((s:number,x:any)=>s+x.monthlyTax,0))}</td>
                <td className="border-r border-black font-sans tabular-nums font-bold">{f2(rows.reduce((s:number,x:any)=>s+x.totalDeduction,0))}</td>
                <td className="font-sans tabular-nums font-bold bg-slate-50 whitespace-nowrap text-[11.5px]">रू {f2(rows.reduce((s:number,x:any)=>{
                  const extra = 
                    (showDashain ? (x.lumpsum?.dashain || 0) : 0) + 
                    (showBonus ? (x.lumpsum?.bonus || 0) : 0) + 
                    (showSanchit ? (x.lumpsum?.festival || 0) : 0) + 
                    (showMedical ? (x.lumpsum?.medical || 0) : 0) +
                    (showDress ? (x.lumpsum?.dress || 0) : 0);
                  return s + (x.monthlyGross + extra - x.totalDeduction);
                },0))}</td>
             </tr>
          </tfoot>
        </table>
      </div>

      {/* Signatory Selectors (Screen Only, No Print) */}
      <div className="mt-12 mb-6 grid grid-cols-3 gap-6 px-16 no-print bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">तयार पारेको (Prepared By)</label>
          <select 
            value={preparedBy} 
            onChange={(e) => setPreparedBy(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-bold"
          >
            <option value="">-- छान्नुहोस् (Select) --</option>
            {employees.map((emp: any) => (
              <option key={emp.id} value={`${emp.fullName} (${emp.designation || 'Staff'})`}>
                {emp.fullName} - {emp.designation || 'Staff'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">रुजु गरेको (Checked By)</label>
          <select 
            value={checkedBy} 
            onChange={(e) => setCheckedBy(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-bold"
          >
            <option value="">-- छान्नुहोस् (Select) --</option>
            {employees.map((emp: any) => (
              <option key={emp.id} value={`${emp.fullName} (${emp.designation || 'Staff'})`}>
                {emp.fullName} - {emp.designation || 'Staff'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">प्रमाणित गरेको (Approved By)</label>
          <select 
            value={approvedBy} 
            onChange={(e) => setApprovedBy(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-bold"
          >
            <option value="">-- छान्नुहोस् (Select) --</option>
            {employees.map((emp: any) => (
              <option key={emp.id} value={`${emp.fullName} (${emp.designation || 'Staff'})`}>
                {emp.fullName} - {emp.designation || 'Staff'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Signature Lines (Both Screen and Print) */}
      <div className="mt-12 flex justify-around items-start px-16 text-[11px] font-bold">
        <div className={`text-center w-52 flex flex-col items-center ${!preparedBy ? 'print:hidden' : ''}`}>
          <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
            ...................................................
          </div>
          <div className="text-center">
            <div className="text-black font-extrabold text-xs">
              {parseSignatory(preparedBy).name || '...................................'}
            </div>
            <div className="text-slate-600 font-bold text-[10px] mt-0.5">
              {parseSignatory(preparedBy).designation || 'पद (Designation)'}
            </div>
          </div>
          <p className="text-[11px] font-black uppercase text-slate-800 mt-2">तयार पारेको</p>
        </div>

        <div className={`text-center w-52 flex flex-col items-center ${!checkedBy ? 'print:hidden' : ''}`}>
          <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
            ...................................................
          </div>
          <div className="text-center">
            <div className="text-black font-extrabold text-xs">
              {parseSignatory(checkedBy).name || '...................................'}
            </div>
            <div className="text-slate-600 font-bold text-[10px] mt-0.5">
              {parseSignatory(checkedBy).designation || 'पद (Designation)'}
            </div>
          </div>
          <p className="text-[11px] font-black uppercase text-slate-800 mt-2">रुजु गरेको</p>
        </div>

        <div className={`text-center w-52 flex flex-col items-center ${!approvedBy ? 'print:hidden' : ''}`}>
          <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
            ...................................................
          </div>
          <div className="text-center">
            <div className="text-black font-extrabold text-xs">
              {parseSignatory(approvedBy).name || '...................................'}
            </div>
            <div className="text-slate-600 font-bold text-[10px] mt-0.5">
              {parseSignatory(approvedBy).designation || 'पद (Designation)'}
            </div>
          </div>
          <p className="text-[11px] font-black uppercase text-slate-800 mt-2">प्रमाणित गरेको</p>
        </div>
      </div>
    </div>
  );
};

const ArchivedSalarySheetView = ({ records = [], year, month, employees = [] }: any) => {
  const f2 = (n: number | undefined | null) => {
    const val = n ?? 0;
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await storageService.getSettings();
      setSettings(s);
    };
    fetchSettings();
  }, []);

  const validRecords = useMemo(() => {
    if (!records || !Array.isArray(records)) return [];
    return records.filter((r: PayrollRecord) => {
      const emp = employees?.find((e: any) => e.id === r.employeeId);
      return !!emp;
    });
  }, [records, employees]);

  const sortedRecords = useMemo(() => {
    if (!validRecords) return [];
    return [...validRecords].sort((a: PayrollRecord, b: PayrollRecord) => {
      const empA = employees?.find((e: any) => e.id === a.employeeId);
      const empB = employees?.find((e: any) => e.id === b.employeeId);
      const codeA = (empA?.employeeCode || '').toString().toLowerCase();
      const codeB = (empB?.employeeCode || '').toString().toLowerCase();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [validRecords, employees]);

  if (!settings) return null;

  const hasDashain = sortedRecords.some((r: any) => r.showDashain || (r.dashainBonus && r.dashainBonus > 0));
  const hasBonus = sortedRecords.some((r: any) => r.showBonus || (r.bonusAmount && r.bonusAmount > 0));
  const hasSanchit = sortedRecords.some((r: any) => r.showSanchit || (r.sanchitLeaveAmount && r.sanchitLeaveAmount > 0));
  const hasMedical = sortedRecords.some((r: any) => r.showMedical || (r.medicalAllowance && r.medicalAllowance > 0));
  const hasDress = sortedRecords.some((r: any) => r.showDress || (r.dressAllowance && r.dressAllowance > 0));
  const extraCount = (hasDashain ? 1 : 0) + (hasBonus ? 1 : 0) + (hasSanchit ? 1 : 0) + (hasMedical ? 1 : 0) + (hasDress ? 1 : 0);

  const sampleRecord = records?.[0];
  const rawPBy = sampleRecord?.preparedBy || '';
  const pByParts = rawPBy.split('||');
  const pBy = pByParts[0] || '';
  const cBy = pByParts[1] || '';
  const aBy = sampleRecord?.approvedBy || '';

  return (
    <div className="flex flex-col p-4 bg-white animate-in fade-in flex-1 overflow-auto scrollbar-hide text-black font-normal print:pl-8 print:pr-4 print:py-6">
      <div className="flex items-center justify-center mb-6 print:mb-4">
        {settings.logoUrl && (
          <div className="w-20 h-20 mr-6 print:w-18 print:h-18">
             <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Institution Logo" />
          </div>
        )}
        <div className="text-center">
           <h1 className="text-3xl font-bold mb-0.5 text-black tracking-tighter">रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड</h1>
           <p className="text-[11.5px] font-bold text-black uppercase tracking-widest mb-2 text-center">पिपरा गाउँपालिका-६, महोत्तरी</p>
           <div className="inline-block border border-black px-6 py-1 rounded-full text-sm font-bold bg-slate-50 print:bg-white">
              आ.व. {year} को {month} महिना तलव भुक्तानी तालिका (ARCHIVED)
           </div>
        </div>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="mx-auto text-[11.5px] text-center border-collapse table-auto border border-black">
          <thead>
            <tr className="bg-slate-50 text-black border-b border-black font-bold uppercase text-[12px]">
               <th rowSpan={2} className="px-1 py-1.5 border-r border-black w-[35px] whitespace-nowrap">क्र.सं.</th>
               <th rowSpan={2} className="px-2 py-1.5 border-r border-black text-left min-w-[160px] whitespace-nowrap">कर्मचारीको नाम</th>
               <th colSpan={3} className="px-1 py-1.5 border-r border-black whitespace-nowrap">मासिक आम्दानी</th>
               {extraCount > 0 && (
                 <th colSpan={extraCount} className="px-1 py-1.5 border-r border-black text-emerald-800 bg-emerald-50/10 whitespace-nowrap">
                   अतिरिक्त सुविधा
                 </th>
               )}
               <th colSpan={3} className="px-1 py-1.5 border-r border-black whitespace-nowrap">संस्था योगदान</th>
               <th rowSpan={2} className="px-1 py-1.5 border-r border-black bg-slate-50 whitespace-nowrap w-[75px]">जम्मा आम्दानी</th>
               <th colSpan={5} className="px-1 py-1.5 border-r border-black whitespace-nowrap">मासिक कटौती</th>
               <th rowSpan={2} className="px-1 py-1.5 bg-slate-50 font-bold whitespace-nowrap w-[85px]">शुद्ध भुक्तानी</th>
            </tr>
            <tr className="bg-slate-50 text-[10.5px] text-black uppercase border-b border-black font-bold">
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">तलव</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">भत्ता</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">ग्रेड</th>
               {hasDashain && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">दशैं भत्ता</th>}
               {hasBonus && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">बोनस</th>}
               {hasSanchit && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">सञ्चित विदा</th>}
               {hasMedical && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">औषधोपचार</th>}
               {hasDress && <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px] text-emerald-800 bg-emerald-50/20">पोशाक</th>}
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">SSF(२०%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">PF(१०%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">उपदान(८.३३%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">SSF(३१%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">PF(२०%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">उपदान(८.३३%)</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">आयकर</th>
               <th className="px-1 py-1.5 border-r border-black whitespace-nowrap w-[68px]">जम्मा</th>
            </tr>
          </thead>
          <tbody className="bg-white text-black font-normal text-[11px]">
            {sortedRecords.map((r: PayrollRecord, i: number) => {
              const emp = employees?.find((e: any) => e.id === r.employeeId);
              const basicVal = r.basicSalary || emp?.basicSalary || 0;
              const totalDeductions = (r.ssfEmployer ?? 0) + (r.pfEmployer ?? 0) + (r.gratuity ?? 0) + (r.tax ?? 0);
              return (
                <tr key={i} className="border-b border-black hover:bg-slate-50">
                  <td className="px-1 py-1.5 border-r border-black text-center">{i+1}</td>
                  <td className="px-3 py-1.5 text-left border-r border-black whitespace-nowrap text-[11.5px]">
                    <span className="font-bold uppercase tracking-tight text-[11.5px] text-slate-950">{emp?.fullName}</span>
                  </td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(basicVal)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.allowance)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.gradeAmt)}</td>
                  {hasDashain && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.dashainBonus || 0)}</td>}
                  {hasBonus && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.bonusAmount || 0)}</td>}
                  {hasSanchit && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.sanchitLeaveAmount || 0)}</td>}
                  {hasMedical && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.medicalAllowance || 0)}</td>}
                  {hasDress && <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(r.dressAllowance || 0)}</td>}
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.ssfEmployee)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.pfEmployee)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.gratuity)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums font-bold bg-slate-50/30">{f2(r.totalIncome)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.ssfEmployer)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.pfEmployer)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.gratuity)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums">{f2(r.tax)}</td>
                  <td className="px-1 py-1.5 border-r border-black font-sans tabular-nums font-bold bg-slate-50/30">{f2(totalDeductions)}</td>
                  <td className="px-1 py-1.5 font-sans tabular-nums font-bold bg-slate-50 whitespace-nowrap text-[11.5px]">रू {f2(r.netSalary)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 text-black text-[11px] font-bold uppercase border-t border-black">
             <tr>
                <td colSpan={2} className="text-right pr-2 border-r border-black whitespace-nowrap py-2 text-right">कुल जम्मा (Total):</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>{
                  const emp = employees?.find((e: any) => e.id === x.employeeId);
                  return s + (x.basicSalary || emp?.basicSalary || 0);
                },0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.allowance ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.gradeAmt ?? 0),0))}</td>
                {hasDashain && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(sortedRecords.reduce((s:number,x:any)=>s+(x.dashainBonus || 0),0))}</td>}
                {hasBonus && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(sortedRecords.reduce((s:number,x:any)=>s+(x.bonusAmount || 0),0))}</td>}
                {hasSanchit && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(sortedRecords.reduce((s:number,x:any)=>s+(x.sanchitLeaveAmount || 0),0))}</td>}
                {hasMedical && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(sortedRecords.reduce((s:number,x:any)=>s+(x.medicalAllowance || 0),0))}</td>}
                {hasDress && <td className="border-r border-black font-sans tabular-nums bg-slate-50/50">{f2(sortedRecords.reduce((s:number,x:any)=>s+(x.dressAllowance || 0),0))}</td>}
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.ssfEmployee ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.pfEmployee ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.gratuity ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums font-bold">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.totalIncome ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.ssfEmployer ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.pfEmployer ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.gratuity ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.tax ?? 0),0))}</td>
                <td className="border-r border-black font-sans tabular-nums font-bold">{f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+((x.ssfEmployer ?? 0) + (x.pfEmployer ?? 0) + (x.gratuity ?? 0) + (x.tax ?? 0)),0))}</td>
                <td className="font-sans tabular-nums font-bold whitespace-nowrap text-[11.5px]">रू {f2(sortedRecords.reduce((s:number,x:PayrollRecord)=>s+(x.netSalary ?? 0),0))}</td>
             </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-12 flex justify-around items-start px-16 text-[11px] font-bold">
        <div className={`text-center w-52 flex flex-col items-center ${!pBy ? 'print:hidden' : ''}`}>
          <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
            ...................................................
          </div>
          <div className="text-center">
            <div className="text-black font-extrabold text-xs">
              {parseSignatory(pBy).name || '...................................'}
            </div>
            <div className="text-slate-600 font-bold text-[10px] mt-0.5">
              {parseSignatory(pBy).designation || 'पद (Designation)'}
            </div>
          </div>
          <p className="text-[11px] font-black uppercase text-slate-800 mt-2">तयार पारेको</p>
        </div>

        <div className={`text-center w-52 flex flex-col items-center ${!cBy ? 'print:hidden' : ''}`}>
          <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
            ...................................................
          </div>
          <div className="text-center">
            <div className="text-black font-extrabold text-xs">
              {parseSignatory(cBy).name || '...................................'}
            </div>
            <div className="text-slate-600 font-bold text-[10px] mt-0.5">
              {parseSignatory(cBy).designation || 'पद (Designation)'}
            </div>
          </div>
          <p className="text-[11px] font-black uppercase text-slate-800 mt-2">रुजु गरेको</p>
        </div>

        <div className={`text-center w-52 flex flex-col items-center ${!aBy ? 'print:hidden' : ''}`}>
          <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
            ...................................................
          </div>
          <div className="text-center">
            <div className="text-black font-extrabold text-xs">
              {parseSignatory(aBy).name || '...................................'}
            </div>
            <div className="text-slate-600 font-bold text-[10px] mt-0.5">
              {parseSignatory(aBy).designation || 'पद (Designation)'}
            </div>
          </div>
          <p className="text-[11px] font-black uppercase text-slate-800 mt-2">प्रमाणित गरेको</p>
        </div>
      </div>
    </div>
  );
};

const DetailedTaxBreakdown = ({ 
  employees, 
  taxConfig, 
  onUpdatePolicy, 
  onEditEmployee,
  settings,
  selectedYear,
  selectedMonth,
  preparedBy,
  setPreparedBy,
  checkedBy,
  setCheckedBy,
  approvedBy,
  setApprovedBy,
  branchId
}: any) => {
  const isDayEnded = useDayEndLock(branchId);
  const toNepaliDigits = (val: string | number): string => {
    const str = typeof val === 'number' ? val.toString() : val;
    const nepaliDigits: { [key: string]: string } = {
      '0': '०', '1': '१', '2': '२', '3': '३', '4': '४', '5': '५', '6': '६', '7': '७', '8': '८', '9': '९'
    };
    return str.replace(/[0-9]/g, (w) => nepaliDigits[w]);
  };

  const f2 = (n: number | undefined | null) => {
    const val = n ?? 0;
    const formatted = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return toNepaliDigits(formatted);
  };

  const [showPolicyEditor, setShowPolicyEditor] = useState(false);
  const [sortField, setSortField] = useState<'fullName' | 'employeeCode' | null>('employeeCode');
  const [selectedAdjEmployee, setSelectedAdjEmployee] = useState<Employee | null>(null);
  const [adjustments, setAdjustments] = useState<any>(() => {
    const saved = localStorage.getItem('ZEN_TAX_ADJUSTMENTS_V1');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    storageService.getTaxAdjustments().then(saved => {
      if (saved && Object.keys(saved).length > 0) {
        setAdjustments(saved);
      }
    });
  }, []);

  const handleSaveAdjustment = async (adjData: any, newBonus: number, newSanchit: number) => {
    if (isDayEnded || !selectedAdjEmployee) return;
    
    // Save to local storage and Supabase for tax calculations
    const updatedAdjustments = { ...adjustments, [selectedAdjEmployee.id]: adjData };
    setAdjustments(updatedAdjustments);
    await storageService.saveTaxAdjustments(updatedAdjustments);

    // Update the employee profile itself (bonus & sanchit leave)
    const updatedEmployee: Employee = {
      ...selectedAdjEmployee,
      bonusYearly: newBonus,
      sanchitLeaveAmount: newSanchit,
      festivalBonus: newSanchit // align festivalBonus field
    };

    try {
      await storageService.saveEmployee(updatedEmployee);
      // Trigger update event to notify parent state / files
      window.dispatchEvent(new Event('taxAdjustmentsUpdated'));
      // Close the modal
      setSelectedAdjEmployee(null);
    } catch (e) {
      console.error("Failed to save employee profile updates:", e);
      alert("Failed to update employee profile database.");
    }
  };

  const dataRows = useMemo(() => {
    const baseRows = employees.filter(e => e.status === 'Active').map(emp => calculateDetailedPayroll(emp, taxConfig));
    
    if (!sortField) return baseRows;

    return [...baseRows].sort((a, b) => {
      const valA = (sortField === 'fullName' ? a.employee.fullName : a.employee.employeeCode || '').toString().toLowerCase();
      const valB = (sortField === 'fullName' ? b.employee.fullName : b.employee.employeeCode || '').toString().toLowerCase();
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [employees, taxConfig, sortField, adjustments]);

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in overflow-hidden font-bold text-[#000000] print:h-auto print:overflow-visible print:pl-8 print:pr-4 print:py-6">
       {/* Institutional Header (Shown on Print) */}
       <div className="hidden print:flex flex-col items-center justify-center mb-6 print:mb-4 w-full text-center">
          {settings?.logoUrl && (
            <div className="w-20 h-20 mb-3">
               <img src={settings.logoUrl} className="mx-auto w-full h-full object-contain" alt="Institution Logo" />
            </div>
          )}
          <h1 className="text-3xl font-bold mb-0.5 text-black tracking-tighter">
            {settings?.systemName || 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड'}
          </h1>
          <p className="text-[11.5px] font-bold text-black uppercase tracking-widest mb-3">
            {settings?.address || 'पिपरा गाउँपालिका-६, महोत्तरी'}
          </p>
          <div className="inline-block border border-black px-6 py-1.5 rounded-full text-xs font-black bg-slate-50 print:bg-white uppercase tracking-wider">
             आयकर गणना तथा लेखापरीक्षण विवरण (आ.व. {toNepaliDigits(selectedYear)}) - {selectedMonth} महिना
          </div>
       </div>
       {/* Header Toolbar */}
       <div className="px-4 py-2 flex justify-between items-center bg-white border-b border-slate-200 shrink-0 no-print">
          <div className="flex items-center space-x-4">
             <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                <Calculator size={18} />
             </div>
             <div>
                <h3 className="text-sm font-bold tracking-tight text-[#000000] uppercase leading-none">INCOME TAX GOVERNANCE HUB</h3>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">NEPAL INCOME TAX ACT COMPLIANT • FY 2081/82 SLABS</p>
             </div>
          </div>
          <div className="flex items-center space-x-4">
             <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-150">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold px-2">Sort:</span>
                <button 
                   onClick={() => setSortField(null)}
                   className={`px-3 py-1.5 h-8 rounded-lg text-[9px] font-bold uppercase transition-all ${!sortField ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                >
                   Default
                </button>
                <button 
                   onClick={() => setSortField('fullName')}
                   className={`px-3 py-1.5 h-8 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center space-x-1 ${sortField === 'fullName' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                >
                   <span>Name</span>
                   {sortField === 'fullName' && <ArrowUp size={10} />}
                </button>
                <button 
                   onClick={() => setSortField('employeeCode')}
                   className={`px-3 py-1.5 h-8 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center space-x-1 ${sortField === 'employeeCode' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                >
                   <span>ID Code</span>
                   {sortField === 'employeeCode' && <ArrowUp size={10} />}
                </button>
             </div>
             <div className="text-right">
                <div className="flex items-center justify-end space-x-2 text-emerald-600">
                   <Sparkles size={12} className="animate-pulse" />
                   <span className="text-[10px] font-bold tracking-widest uppercase">AUDIT SYNC: {new Date().toLocaleTimeString()}</span>
                </div>
                <p className="text-[7px] text-slate-500 uppercase tracking-widest mt-0.5 font-bold">RESIDENT NATURAL PERSON ASSESSMENT</p>
             </div>
             <button 
               type="button"
               disabled={isDayEnded}
               title={isDayEnded ? getDayEndedBlockMessage() : "Adjust Income Tax Policy"}
               onClick={() => !isDayEnded && setShowPolicyEditor(true)} 
               className="bg-emerald-600 text-white px-3 h-8 rounded-lg text-[8px] font-bold uppercase shadow hover:bg-emerald-700 transition-all flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
             >
                <ShieldCheck size={14}/>
                <span>ADJUST POLICY</span>
             </button>
          </div>
       </div>

       {/* AUDIT TABLE WITH SECTION BREAKS AND FROZEN HEADERS */}
       <div className="flex-1 overflow-auto relative bg-white scrollbar-hide print:overflow-visible print:h-auto print:block">
          <table className="w-full text-center border-collapse table-auto min-w-max">
             <thead className="sticky top-0 z-[110] shadow-sm print:static">
                <tr className="bg-slate-900 text-white text-[8px] uppercase tracking-widest h-7 font-bold border-b border-white/10">
                   <th colSpan={2} className="p-2 text-left pl-6 border-r border-white/5 sticky left-0 bg-slate-900 z-[120]">1. IDENTITY</th>
                   <th colSpan={2} className="p-2 border-r border-white/5 bg-blue-950 text-blue-300">INFO</th>
                   <th colSpan={7} className="p-2 border-r border-white/5 bg-blue-900 text-blue-100">2. MONTHLY EARNINGS</th>
                   <th colSpan={5} className="p-2 border-r border-white/5 bg-emerald-950 text-emerald-400">3. LUMPSUM YEARLY</th>
                   <th colSpan={7} className="p-2 border-r border-white/5 bg-amber-950 text-amber-400">4. ANNUAL GROSS TOTAL</th>
                   <th colSpan={4} className="p-2 border-r border-white/5 bg-purple-950 text-purple-400">🔹 APPROVED FUND (EMPLOYER)</th>
                   <th colSpan={6} className="p-2 border-r border-white/5 bg-rose-950 text-rose-400">5. DEDUCTIONS & REDUCTIONS</th>
                   <th colSpan={4} className="p-2 border-r border-white/5 bg-indigo-950 text-indigo-400">6. TAX SLAB BREAKDOWN</th>
                   <th colSpan={3} className="p-2 bg-slate-800 text-white hidden print:table-cell">7. FINAL LIABILITY</th>
                    <th colSpan={4} className="p-2 bg-slate-800 text-white print:hidden">7. FINAL LIABILITY</th>
                </tr>
                <tr className="bg-slate-800 text-white text-[8px] uppercase tracking-widest h-9 font-bold border-b border-white/10">
                   <th className="w-[50px] border-r border-white/5 sticky left-0 bg-slate-800 z-[120] whitespace-nowrap">S.N.</th>
                   <th 
                     onClick={() => setSortField(sortField === 'fullName' ? null : 'fullName')} 
                     className="text-left pl-6 border-r border-white/5 w-[180px] sticky left-[50px] bg-slate-800 z-[120] whitespace-nowrap cursor-pointer hover:bg-slate-750 transition-colors select-none"
                   >
                      <div className="flex items-center justify-between pr-2">
                         <span>EMPLOYEE NAME</span>
                         <span className="text-[8px] text-slate-400">
                            {sortField === 'fullName' ? '▲' : '⇅'}
                         </span>
                      </div>
                   </th>
                   
                   <th className="border-r border-white/5 w-[140px] whitespace-nowrap">DESIGNATION</th>
                   <th className="border-r border-white/5 w-[100px] text-blue-400 whitespace-nowrap">PAN</th>
                   
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">BASIC</th>
                   <th className="border-r border-white/5 w-[80px] whitespace-nowrap">D.A.</th>
                   <th className="border-r border-white/5 w-[80px] whitespace-nowrap">GRADE</th>
                   <th className="border-r border-white/5 w-[80px] whitespace-nowrap">SSF 20%</th>
                   <th className="border-r border-white/5 w-[80px] whitespace-nowrap">PF 10%</th>
                   <th className="border-r border-white/5 w-[80px] whitespace-nowrap">GRAT.</th>
                   <th className="border-r border-white/10 w-[100px] bg-blue-900 text-blue-100 whitespace-nowrap">TOTAL MO.</th>

                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">DASHAIN</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">SANCHIT</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">BONUS</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">MEDICAL</th>
                   <th className="border-r border-white/10 w-[100px] bg-emerald-900 text-emerald-100 whitespace-nowrap">TOT LUMPSUM</th>

                   <th className="border-r border-white/5 w-[90px] whitespace-nowrap">ANN SALARY</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">ANN D.A.</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">ANN GRADE</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">SSF (20%)</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">PF (10%)</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">GRAT (8.33%)</th>
                   <th className="border-r border-white/10 w-[110px] bg-amber-600 text-slate-950 whitespace-nowrap">TOT ANN INC</th>

                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">SSF (31%)</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">PF (20%)</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">GRAT (8.33%)</th>
                   <th className="border-r border-white/10 w-[100px] bg-purple-900 text-purple-100 whitespace-nowrap">TOT CONTRIB</th>

                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">ALLOW. DED</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">LIFE INS</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">HEALTH</th>
                   <th className="border-r border-white/5 w-[85px] whitespace-nowrap">BUILDING</th>
                   <th className="border-r border-white/5 w-[70px] whitespace-nowrap">REMOTE</th>
                   <th className="border-r border-white/10 w-[100px] bg-rose-900 text-rose-100 whitespace-nowrap">ADJ TAXABLE</th>

                   <th className="border-r border-white/5 w-[80px] text-indigo-400 whitespace-nowrap">1%</th>
                   <th className="border-r border-white/5 w-[80px] text-indigo-400 whitespace-nowrap">10%</th>
                   <th className="border-r border-white/5 w-[80px] text-indigo-400 whitespace-nowrap">20%</th>
                   <th className="border-r border-white/10 w-[80px] text-indigo-400 whitespace-nowrap">30%</th>

                   <th className="border-r border-white/5 w-[100px] text-emerald-400 whitespace-nowrap">CREDITS</th>
                   <th className="border-r border-white/5 w-[110px] text-rose-400 whitespace-nowrap">ANNUAL TAX</th>
                   <th className="border-r border-white/5 w-[110px] bg-emerald-600 text-white whitespace-nowrap">MONTHLY TAX</th>
                   <th className="w-[80px] bg-blue-600 text-white whitespace-nowrap no-print">ACTIONS</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 bg-white text-[#000000] font-bold">
                {dataRows.map((r, i) => (
                   <tr key={i} className="h-8 hover:bg-slate-50 transition-all text-[9px] font-bold">
                      <td className="border-r border-slate-100 text-[#000000] sticky left-0 bg-white z-[90] whitespace-nowrap text-center">{i+1}</td>
                      <td className="text-left pl-6 border-r border-slate-100 text-[#000000] text-[11px] sticky left-[50px] bg-white z-[90] whitespace-nowrap uppercase">{r.employee.fullName}</td>
                      
                      <td className="text-left pl-4 border-r border-slate-100 text-[10px] text-[#000000] font-bold uppercase whitespace-nowrap">{r.employee.designation}</td>
                      <td className="border-r border-slate-100 font-mono text-blue-700 whitespace-nowrap">{r.employee.panNo || '-'}</td>
                      
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.monthly.basic)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.monthly.da)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.monthly.grade)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.monthly.ssf20)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.monthly.pf10)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.monthly.grat833)}</td>
                      <td className="border-r border-white/10 bg-blue-50/50 font-bold text-[#000000] whitespace-nowrap text-right pr-2">{f2(r.monthly.monthlyGross)}</td>

                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.lumpsum.dashain)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.lumpsum.festival)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.lumpsum.bonus)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.lumpsum.medical)}</td>
                      <td className="border-r border-white/10 bg-emerald-50/50 font-bold text-[#000000] whitespace-nowrap text-right pr-2">{f2(r.lumpsum.totalLumpsum)}</td>

                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.annual.annSalary)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.annual.annDa)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.annual.annGrade)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.annual.annSsf20)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.annual.annPf10)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.annual.annGrat833)}</td>
                      <td className="border-r border-white/10 bg-amber-50/50 font-bold text-black whitespace-nowrap text-right pr-2">{f2(r.annual.totalAnnualIncome)}</td>

                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.approvedFund.ssfFund31)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.approvedFund.pfFund20)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.approvedFund.gratFund833)}</td>
                      <td className="border-r border-white/10 bg-purple-50/50 font-bold text-[#000000] whitespace-nowrap text-right pr-2">{f2(r.approvedFund.totalContribution)}</td>

                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2" title="Retirement Fund Limit (min 1/3 Income or 5,00,000)">{f2(r.reductions.allowableDed)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.reductions.lifeIns)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.reductions.healthIns)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-right pr-2">{f2(r.reductions.buildingIns)}</td>
                      <td className="border-r border-slate-100 font-sans whitespace-nowrap text-center text-[#000000]">{r.employee.remoteAreaCategory || '-'}</td>
                      <td className="border-r border-white/10 bg-rose-50/50 font-bold text-[#000000] whitespace-nowrap text-right pr-2">{f2(r.reductions.adjustedTaxableIncome)}</td>

                      <td className="border-r border-slate-100 font-sans text-[#000000] whitespace-nowrap text-right pr-2">{f2(r.tax.slabBreakdown[1] || 0)}</td>
                      <td className="border-r border-slate-100 font-sans text-[#000000] whitespace-nowrap text-right pr-2">{f2(r.tax.slabBreakdown[10] || 0)}</td>
                      <td className="border-r border-slate-100 font-sans text-[#000000] whitespace-nowrap text-right pr-2">{f2(r.tax.slabBreakdown[20] || 0)}</td>
                      <td className="border-r border-white/10 font-sans text-[#000000] whitespace-nowrap text-right pr-2">{f2(r.tax.slabBreakdown[30] || 0)}</td>

                      <td className="border-r border-slate-100 text-[#000000] font-bold whitespace-nowrap text-right pr-2">{f2(r.tax.femaleTaxCredit + r.tax.medicalTaxCredit)}</td>
                      <td className="border-r border-slate-100 font-bold text-[#000000] text-[11px] whitespace-nowrap text-right pr-2">{f2(r.tax.annualNetTax)}</td>
                      <td className="bg-emerald-50 border-r border-slate-100 font-bold text-[#000000] text-[12px] whitespace-nowrap text-right pr-2">
                         <div className="flex flex-col items-end justify-center">
                            <span>रू {f2(r.tax.monthlyTax)}</span>
                            {r.tax.isAdjustmentActive && (
                               <span className="text-[7.5px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200 mt-0.5 leading-none font-bold">
                                  समायोजित ({r.tax.taxAdjustedFromMonth})
                               </span>
                            )}
                         </div>
                      </td>
                      <td className="p-1">
                         {(() => {
                           const rowLocked = isDayEnded || isDayEndedForBranch(r.employee.branchId || branchId);
                           return (
                             <div className="flex items-center justify-center space-x-1">
                                <button 
                                  type="button"
                                  disabled={rowLocked}
                                  onClick={() => !rowLocked && onEditEmployee(r.employee)}
                                  title={rowLocked ? getDayEndedBlockMessage() : "Edit Employee Details"}
                                  className="p-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-600 hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                   <Edit2 size={10} />
                                </button>
                                <button 
                                  type="button"
                                  disabled={rowLocked}
                                  onClick={() => !rowLocked && setSelectedAdjEmployee(r.employee)}
                                  title={rowLocked ? getDayEndedBlockMessage() : "Tax Adjustment"}
                                  className="p-1 bg-amber-100 text-amber-700 rounded-md hover:bg-amber-600 hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                   <Calendar size={10} />
                                </button>
                             </div>
                           );
                         })()}
                      </td>
                   </tr>
                ))}
             </tbody>
             <tfoot className="sticky bottom-0 z-[100] print:static">
                <tr className="bg-slate-900 h-8 border-t-2 border-black font-bold text-[10px] text-white">
                   <td colSpan={2} className="text-left pl-6 uppercase tracking-tighter text-white sticky left-0 bg-slate-900 z-[120]">GRAND AUDIT TOTALS</td>
                   <td colSpan={2} className="border-r border-white/5"></td>
                   
                   <td className="border-r border-white/5 text-right pr-2">{f2(dataRows.reduce((s,x)=>s+x.monthly.basic,0))}</td>
                   <td colSpan={5} className="border-r border-white/5"></td>
                   <td className="border-r border-white/10 bg-blue-900/40 text-right pr-2">{f2(dataRows.reduce((s,x)=>s+x.monthly.monthlyGross,0))}</td>

                   <td colSpan={4} className="border-r border-white/5"></td>
                   <td className="border-r border-white/10 bg-emerald-900/40 text-right pr-2">{f2(dataRows.reduce((s,x)=>s+x.lumpsum.totalLumpsum,0))}</td>

                   <td colSpan={6} className="border-r border-white/5"></td>
                   <td className="border-r border-white/10 bg-amber-900/40 text-right pr-2">{f2(dataRows.reduce((s,x)=>s+x.annual.totalAnnualIncome,0))}</td>

                   <td colSpan={3} className="border-r border-white/5"></td>
                   <td className="border-r border-white/10 bg-purple-900/40 text-right pr-2">{f2(dataRows.reduce((s,x)=>s+x.approvedFund.totalContribution,0))}</td>

                   <td colSpan={5} className="border-r border-white/5"></td>
                   <td className="border-r border-white/10 bg-rose-900/40 text-right pr-2">{f2(dataRows.reduce((s,x)=>s+x.tax.finalTaxableIncome,0))}</td>

                   <td colSpan={4} className="border-r border-white/5"></td>

                   <td className="border-r border-white/5"></td>
                   <td className="border-r border-white/5 text-rose-400 text-right pr-2">{f2(dataRows.reduce((s,x)=>s+x.tax.annualNetTax,0))}</td>
                   <td className="bg-emerald-600 text-white text-[13px] text-right pr-4 font-bold border-r border-white/5">
                      रू {f2(dataRows.reduce((s,x)=>s+x.tax.monthlyTax,0))}
                   </td>
                </tr>
             </tfoot>
          </table>
       </div>

       {/* Signatory Selectors (Screen Only, No Print) */}
       <div className="mt-12 mb-6 grid grid-cols-3 gap-6 px-16 no-print bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0">
         <div>
           <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">तयार पारेको (Prepared By)</label>
           <select 
             value={preparedBy} 
             onChange={(e) => setPreparedBy(e.target.value)}
             className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-bold text-[#000000]"
           >
             <option value="">-- छान्नुहोस् (Select) --</option>
             {employees.map((emp: any) => (
               <option key={emp.id} value={`${emp.fullName} (${emp.designation || 'Staff'})`}>
                 {emp.fullName} - {emp.designation || 'Staff'}
               </option>
             ))}
           </select>
         </div>
         <div>
           <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">रुजु गरेको (Checked By)</label>
           <select 
             value={checkedBy} 
             onChange={(e) => setCheckedBy(e.target.value)}
             className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-bold text-[#000000]"
           >
             <option value="">-- छान्नुहोस् (Select) --</option>
             {employees.map((emp: any) => (
               <option key={emp.id} value={`${emp.fullName} (${emp.designation || 'Staff'})`}>
                 {emp.fullName} - {emp.designation || 'Staff'}
               </option>
             ))}
           </select>
         </div>
         <div>
           <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">प्रमाणित गरेको (Approved By)</label>
           <select 
             value={approvedBy} 
             onChange={(e) => setApprovedBy(e.target.value)}
             className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-bold text-[#000000]"
           >
             <option value="">-- छान्नुहोस् (Select) --</option>
             {employees.map((emp: any) => (
               <option key={emp.id} value={`${emp.fullName} (${emp.designation || 'Staff'})`}>
                 {emp.fullName} - {emp.designation || 'Staff'}
               </option>
             ))}
           </select>
         </div>
       </div>

       {/* Signature Lines (Both Screen and Print) */}
       <div className="mt-12 mb-8 flex justify-around items-start px-16 text-[11px] font-bold">
         <div className={`text-center w-52 flex flex-col items-center ${!preparedBy ? 'print:hidden' : ''}`}>
           <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
             ...................................................
           </div>
           <div className="text-center">
             <div className="text-black font-extrabold text-xs">
               {parseSignatory(preparedBy).name || '...................................'}
             </div>
             <div className="text-slate-600 font-bold text-[10px] mt-0.5">
               {parseSignatory(preparedBy).designation || 'पद (Designation)'}
             </div>
           </div>
           <p className="text-[11px] font-black uppercase text-slate-800 mt-2">तयार पारेको</p>
         </div>

         <div className={`text-center w-52 flex flex-col items-center ${!checkedBy ? 'print:hidden' : ''}`}>
           <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
             ...................................................
           </div>
           <div className="text-center">
             <div className="text-black font-extrabold text-xs">
               {parseSignatory(checkedBy).name || '...................................'}
             </div>
             <div className="text-slate-600 font-bold text-[10px] mt-0.5">
               {parseSignatory(checkedBy).designation || 'पद (Designation)'}
             </div>
           </div>
           <p className="text-[11px] font-black uppercase text-slate-800 mt-2">रुजु गरेको</p>
         </div>

         <div className={`text-center w-52 flex flex-col items-center ${!approvedBy ? 'print:hidden' : ''}`}>
           <div className="text-slate-400 select-none text-center leading-none text-xs tracking-tight mb-2">
             ...................................................
           </div>
           <div className="text-center">
             <div className="text-black font-extrabold text-xs">
               {parseSignatory(approvedBy).name || '...................................'}
             </div>
             <div className="text-slate-600 font-bold text-[10px] mt-0.5">
               {parseSignatory(approvedBy).designation || 'पद (Designation)'}
             </div>
           </div>
           <p className="text-[11px] font-black uppercase text-slate-800 mt-2">प्रमाणित गरेको</p>
         </div>
       </div>

       {showPolicyEditor && <TaxPolicyEditor config={taxConfig} branchId={branchId} onClose={() => setShowPolicyEditor(false)} onSave={(cfg: any) => { onUpdatePolicy(cfg); setShowPolicyEditor(false); }} />}
        {selectedAdjEmployee && (
          <LumpsumTaxAdjustmentModal 
            employee={selectedAdjEmployee}
            taxConfig={taxConfig}
            branchId={selectedAdjEmployee.branchId || branchId}
            onClose={() => setSelectedAdjEmployee(null)}
            onSave={handleSaveAdjustment}
          />
        )}
    </div>
  );
};

// Helper Components
const EmployeeList = ({ 
  employees, 
  branches = [],
  branchId,
  onView, 
  onEdit, 
  onDelete,
  onGenerateDoc
}: { 
  employees: Employee[], 
  branches?: Branch[],
  branchId?: string,
  onView?: (e: Employee) => void, 
  onEdit: (e: Employee) => void, 
  onDelete: (id: string, name: string) => void,
  onGenerateDoc?: (e: Employee) => void
}) => {
  const [sortField, setSortField] = useState<'fullName' | 'employeeCode' | 'branch' | 'status'>('employeeCode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Deduplicated unique employees list
  const uniqueEmployees = useMemo(() => {
    return deduplicateEmployees(employees || []);
  }, [employees]);

  const getBranchName = (branchId?: string) => {
    if (!branchId) return 'Ratauli Head Office';
    const norm = normalizeBranchId(branchId);
    if (norm === 'main') return 'Ratauli Head Office';
    if (norm === 'sahodba') return 'Sahodba Branch';
    if (norm === 'pipra') return 'Pipra Branch';
    if (norm === 'parsa') return 'Parsa Branch';
    const found = branches.find(b => b.id === branchId || b.code === branchId || normalizeBranchId(b.id) === norm);
    return found ? found.name : 'Ratauli Head Office';
  };

  const getBranchBadgeStyle = (branchId?: string) => {
    const norm = normalizeBranchId(branchId);
    if (norm === 'sahodba') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (norm === 'pipra') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (norm === 'parsa') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  // Sorted list
  const sortedEmployees = useMemo(() => {
    return [...uniqueEmployees].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'employeeCode') {
        const codeA = Number((a.employeeCode || '').replace(/\D/g, '')) || 999999;
        const codeB = Number((b.employeeCode || '').replace(/\D/g, '')) || 999999;
        cmp = codeA - codeB;
      } else if (sortField === 'fullName') {
        cmp = (a.fullName || '').localeCompare(b.fullName || '');
      } else if (sortField === 'branch') {
        cmp = getBranchName(a.branchId).localeCompare(getBranchName(b.branchId));
      } else if (sortField === 'status') {
        cmp = (a.status || '').localeCompare(b.status || '');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [uniqueEmployees, sortField, sortOrder, branches]);

  const toggleSort = (field: 'fullName' | 'employeeCode' | 'branch' | 'status') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="px-4 py-2 space-y-3">

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
            <tr>
              <th 
                className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none w-20"
                onClick={() => toggleSort('employeeCode')}
              >
                <div className="flex items-center space-x-1.5 font-black">
                  <span>ID</span>
                  <span className="text-slate-400">
                    {sortField === 'employeeCode' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-emerald-600" /> : <ArrowUpDown size={12} className="text-emerald-600 rotate-180" />
                    ) : <ArrowUpDown size={12} />}
                  </span>
                </div>
              </th>
              <th 
                className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                onClick={() => toggleSort('fullName')}
              >
                <div className="flex items-center space-x-1.5 font-black">
                  <span>Employee Name</span>
                  <span className="text-slate-400">
                    {sortField === 'fullName' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-emerald-600" /> : <ArrowUpDown size={12} className="text-emerald-600 rotate-180" />
                    ) : <ArrowUpDown size={12} />}
                  </span>
                </div>
              </th>
              <th 
                className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none font-black"
                onClick={() => toggleSort('branch')}
              >
                <div className="flex items-center space-x-1.5">
                  <span>Branch</span>
                  <span className="text-slate-400">
                    {sortField === 'branch' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-emerald-600" /> : <ArrowUpDown size={12} className="text-emerald-600 rotate-180" />
                    ) : <ArrowUpDown size={12} />}
                  </span>
                </div>
              </th>
              <th className="py-2.5 px-4 font-black">Department</th>
              <th 
                className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none font-black"
                onClick={() => toggleSort('status')}
              >
                <div className="flex items-center space-x-1.5">
                  <span>Status</span>
                  <span className="text-slate-400">
                    {sortField === 'status' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-emerald-600" /> : <ArrowUpDown size={12} className="text-emerald-600 rotate-180" />
                    ) : <ArrowUpDown size={12} />}
                  </span>
                </div>
              </th>
              <th className="py-2.5 px-4 font-black text-center w-28">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-bold">
            {sortedEmployees.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400 text-xs font-bold">
                  No employees found matching the selected branch or search filter.
                </td>
              </tr>
            ) : (
              sortedEmployees.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* ID */}
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-900 font-black">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                      {e.employeeCode || '-'}
                    </span>
                  </td>

                  {/* Employee Name */}
                  <td className="py-2.5 px-4 flex items-center space-x-3 text-slate-900">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                      {e.photoUrl ? (
                        <img src={e.photoUrl} alt={e.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={14} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-tight text-xs text-slate-900 block leading-tight">
                        {e.fullName}
                      </span>
                      {e.designation && (
                        <span className="text-[10px] text-slate-500 font-medium block leading-tight">
                          {e.designation}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="py-2.5 px-4 text-xs font-bold">
                    <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${getBranchBadgeStyle(e.branchId)}`}>
                      <Building2 size={11} className="shrink-0" />
                      {getBranchName(e.branchId)}
                    </span>
                  </td>

                  {/* Department */}
                  <td className="py-2.5 px-4 uppercase text-xs font-bold text-slate-700">
                    {e.department || 'GENERAL'}
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase font-black tracking-wider ${
                      e.status === 'Active' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : e.status === 'On Leave'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {e.status || 'Active'}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                      {onView && (
                        <button 
                          onClick={() => onView(e)} 
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                          title="View Profile & KYC"
                        >
                          <Eye size={15} />
                        </button>
                      )}
                      {onGenerateDoc && (
                        <button 
                          onClick={() => onGenerateDoc(e)} 
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" 
                          title="कागजात तथा परिचयपत्र (नियुक्ति, सरुवा, ID Card, Visiting Card, प्रशंसा पत्र)"
                        >
                          <FileBadge size={15} />
                        </button>
                      )}
                      {(() => {
                        const rowLocked = isDayEndedForBranch(e.branchId || branchId);
                        return (
                          <>
                            <button 
                              onClick={() => !rowLocked && onEdit(e)} 
                              disabled={rowLocked}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed" 
                              title={rowLocked ? getDayEndedBlockMessage() : "Edit"}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button 
                              onClick={() => !rowLocked && onDelete(e.id, e.fullName)} 
                              disabled={rowLocked}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed" 
                              title={rowLocked ? getDayEndedBlockMessage() : "Delete"}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BulkEmployeeModal = ({
  employees,
  onClose,
  onSaveAll,
  branchId
}: {
  employees: Employee[];
  onClose: () => void;
  onSaveAll: () => Promise<void>;
  branchId?: string;
}) => {
  const isDayEnded = useDayEndLock(branchId);
  const [draftList, setDraftList] = useState<Employee[]>(() => {
    const list = employees.length > 0 ? JSON.parse(JSON.stringify(employees)) : [];
    return list.sort((a: Employee, b: Employee) => {
      const numA = parseInt(a.employeeCode || '0', 10);
      const numB = parseInt(b.employeeCode || '0', 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return (a.employeeCode || '').localeCompare(b.employeeCode || '', undefined, { numeric: true });
    });
  });

  const [showPasteZone, setShowPasteZone] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDayEnded) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        parseAndAppendCSV(text);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseAndAppendCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    const newRows: Employee[] = [];
    const firstLineLower = lines[0].toLowerCase();
    const startIndex = (firstLineLower.includes('name') || firstLineLower.includes('code') || firstLineLower.includes('salary') || firstLineLower.includes('staff')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.includes('\t') ? line.split('\t') : line.split(',');
      if (cols.length < 1) continue;

      const fullName = (cols[0] || '').trim();
      if (!fullName) continue;

      const empCode = (cols[1] || `${draftList.length + newRows.length + 1}`).trim();
      const designation = (cols[2] || 'STAFF').trim();
      const department = (cols[3] || 'GENERAL').trim();
      const basicSalary = parseFloat(cols[4] || '0') || 0;
      const gradeRate = parseFloat(cols[5] || '0') || 0;
      const dearnessAllowance = parseFloat(cols[6] || '0') || 0;
      const bonusYearly = parseFloat(cols[7] || '0') || 0;
      const sanchitLeaveAmount = parseFloat(cols[8] || '0') || 0;
      const medicalAllowance = parseFloat(cols[9] || '0') || 0;
      const dressAllowance = parseFloat(cols[10] || '0') || 0;
      const mobile = (cols[11] || cols[10] || '').trim();

      const newEmp: Employee = {
        id: crypto.randomUUID(),
        fullName: fullName.toUpperCase(),
        employeeCode: empCode,
        designation: designation.toUpperCase(),
        department: department.toUpperCase(),
        gender: 'Male',
        maritalStatus: 'Single',
        employmentType: 'Permanent',
        mobile: mobile,
        email: '',
        panNo: '',
        joinedDate: new Date().toISOString().split('T')[0],
        basicSalary,
        daType: 'None',
        daValue: dearnessAllowance,
        dearnessAllowance,
        gradeRate,
        gradeRateAmount: gradeRate,
        hasSSF: false,
        ssfContribution: 0,
        hasPF: false,
        pfContribution: 0,
        hasGratuity: false,
        gratuity: 0,
        monthsActive: 12,
        hasDashain: false,
        dashainBonus: bonusYearly,
        hasMedical: false,
        medicalAllowance,
        hasDressAllowance: dressAllowance > 0,
        dressAllowance,
        hasBonus: bonusYearly > 0,
        festivalBonus: sanchitLeaveAmount,
        bonusYearly,
        sanchitLeaveDays: 0,
        sanchitLeaveAmount,
        status: 'Active',
        branchId: branchId || '',
        lifeInsurance: 0,
        healthInsurance: 0,
        buildingInsurance: 0,
        medicalExpensesPaid: 0,
        remoteAreaCategory: 'None',
        isIncapacitated: false
      };
      newRows.push(newEmp);
    }

    if (newRows.length > 0) {
      setDraftList(prev => {
        const combined = [...prev, ...newRows];
        return combined.sort((a, b) => {
          const numA = parseInt(a.employeeCode || '0', 10);
          const numB = parseInt(b.employeeCode || '0', 10);
          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numA - numB;
          }
          return (a.employeeCode || '').localeCompare(b.employeeCode || '', undefined, { numeric: true });
        });
      });
      setShowPasteZone(false);
      setPastedText('');
      alert(`${newRows.length} new employee records added successfully.`);
    } else {
      alert('No valid data found. Please check your Excel/CSV format.');
    }
  };

  const handlePasteProcess = () => {
    if (isDayEnded) return;
    if (!pastedText.trim()) return;
    parseAndAppendCSV(pastedText);
  };

  const downloadSampleTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Staff Name,ID Code,Designation,Department,Basic Salary,Grade Rate,DA Allowance,Yearly Bonus,Sanchit Leave,Medical Allowance,Mobile\n" +
      "RAM BAHADUR SHRESTHA,101,SENIOR OFFICER,FINANCE,35000,1200,3000,35000,5000,2000,9800000000\n" +
      "SITA DEVI SHARMA,102,ASSISTANT,TELLER,28000,800,2000,28000,3000,1500,9811111111";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "employee_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddBlankRow = () => {
    if (isDayEnded) return;
    const newEmp: Employee = {
      id: crypto.randomUUID(),
      fullName: '',
      employeeCode: `${draftList.length + 1}`,
      designation: 'STAFF',
      department: 'FINANCE',
      gender: 'Male',
      maritalStatus: 'Single',
      employmentType: 'Permanent',
      mobile: '',
      email: '',
      panNo: '',
      joinedDate: new Date().toISOString().split('T')[0],
      basicSalary: 0,
      daType: 'None',
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
      monthsActive: 12,
      hasDashain: false,
      dashainBonus: 0,
      hasMedical: false,
      medicalAllowance: 0,
      hasBonus: false,
      festivalBonus: 0,
      bonusYearly: 0,
      sanchitLeaveDays: 0,
      sanchitLeaveAmount: 0,
      status: 'Active',
      branchId: branchId || '',
      lifeInsurance: 0,
      healthInsurance: 0,
      buildingInsurance: 0,
      medicalExpensesPaid: 0,
      remoteAreaCategory: 'None',
      isIncapacitated: false
    };
    setDraftList(prev => [...prev, newEmp]);
  };

  const updateDraftField = (index: number, field: keyof Employee, value: any) => {
    if (isDayEnded) return;
    setDraftList(prev => {
      const next = [...prev];
      const updatedItem = { ...next[index], [field]: value };

      if (field === 'bonusYearly') {
        updatedItem.dashainBonus = Number(value) || 0;
        updatedItem.hasBonus = (Number(value) || 0) > 0;
      }
      if (field === 'sanchitLeaveAmount') {
        updatedItem.festivalBonus = Number(value) || 0;
      }
      if (field === 'gradeRate') {
        updatedItem.gradeRateAmount = Number(value) || 0;
      }
      if (field === 'dearnessAllowance') {
        updatedItem.daValue = Number(value) || 0;
      }
      if (field === 'dressAllowance') {
        updatedItem.hasDressAllowance = (Number(value) || 0) > 0;
      }

      next[index] = updatedItem;
      return next;
    });
  };

  const handleRemoveDraftRow = (index: number) => {
    if (isDayEnded) return;
    setDraftList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAllSubmit = async () => {
    if (isDayEnded) return;
    const invalid = draftList.find(e => !e.fullName || e.fullName.trim() === '');
    if (invalid) {
      alert('Please make sure all employees have a Staff Name.');
      return;
    }

    setIsSaving(true);
    setSaveStatus('Saving employee records...');

    try {
      for (let i = 0; i < draftList.length; i++) {
        const emp = draftList[i];
        const formatted: Employee = {
          ...emp,
          fullName: emp.fullName.toUpperCase().trim(),
          designation: (emp.designation || 'STAFF').toUpperCase().trim(),
          department: (emp.department || 'GENERAL').toUpperCase().trim(),
          basicSalary: Number(emp.basicSalary) || 0,
          gradeRate: Number(emp.gradeRate) || 0,
          gradeRateAmount: Number(emp.gradeRate) || 0,
          dearnessAllowance: Number(emp.dearnessAllowance) || 0,
          daValue: Number(emp.dearnessAllowance) || 0,
          bonusYearly: Number(emp.bonusYearly) || 0,
          dashainBonus: Number(emp.dashainBonus ?? emp.bonusYearly) || 0,
          sanchitLeaveAmount: Number(emp.sanchitLeaveAmount) || 0,
          medicalAllowance: Number(emp.medicalAllowance) || 0,
          dressAllowance: Number(emp.dressAllowance) || 0,
          hasDressAllowance: (Number(emp.dressAllowance) || 0) > 0,
        };
        setSaveStatus(`Saving: ${i + 1} / ${draftList.length} - ${formatted.fullName}`);
        await storageService.saveEmployee(formatted);
      }

      setSaveStatus('Saved successfully!');
      await onSaveAll();
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 400);
    } catch (err: any) {
      console.error('Error in bulk saving employees:', err);
      setIsSaving(false);
      alert('Saving failed: ' + (err?.message || err));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-100 z-[4000] flex flex-col w-screen h-screen overflow-hidden text-[#000000] animate-in fade-in duration-150">
      
      {/* Top Header Bar */}
      <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 border-b border-slate-800 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <span>UPDATE EMPLOYEE</span>
            </h2>
          </div>
        </div>

        {/* Top Right Corner Controls (Excel Template & Import options) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadSampleTemplate}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all flex items-center space-x-1.5"
            title="Download sample Excel CSV format"
          >
            <Download size={13} />
            <span>Sample Excel (.csv)</span>
          </button>

          <label
            title={isDayEnded ? getDayEndedBlockMessage() : "Import Excel / CSV"}
            className={`px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md ${isDayEnded ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Upload size={13} />
            <span>Import Excel / CSV</span>
            <input
              type="file"
              accept=".csv, .xlsx, .xls, .txt"
              disabled={isDayEnded}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            disabled={isDayEnded}
            title={isDayEnded ? getDayEndedBlockMessage() : "Paste Excel Table"}
            onClick={() => !isDayEnded && setShowPasteZone(!showPasteZone)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileCode size={13} />
            <span>Paste Excel Table</span>
          </button>

          <button
            disabled={isDayEnded}
            title={isDayEnded ? getDayEndedBlockMessage() : "Add Blank Row"}
            onClick={() => !isDayEnded && handleAddBlankRow()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            <span>Add Row</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all ml-2"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Optional Paste Excel Box */}
      {showPasteZone && (
        <div className="p-4 bg-indigo-50 border-b border-indigo-200 flex flex-col gap-2 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase text-indigo-900 flex items-center gap-2">
              <FileCode size={14} />
              Paste Excel or Google Sheet data (Columns: Staff Name, ID Code, Designation, Dept, Basic Salary, Grade Rate, DA, Bonus, Sanchit Leave, Medical)
            </span>
            <button
              onClick={() => setShowPasteZone(false)}
              className="text-indigo-500 hover:text-indigo-900 text-xs font-bold"
            >
              Cancel
            </button>
          </div>
          <textarea
            rows={3}
            disabled={isDayEnded}
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            placeholder="Paste Excel columns here (Tab or Comma separated)..."
            className="w-full bg-white p-2.5 rounded-xl border border-indigo-200 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
          />
          <div className="flex justify-end">
            <button
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : "Process & Append Data"}
              onClick={handlePasteProcess}
              className="px-4 py-1.5 bg-indigo-700 text-white rounded-lg font-black text-xs uppercase tracking-wider hover:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Process & Append Data
            </button>
          </div>
        </div>
      )}

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-auto p-4 lg:p-6 bg-slate-100 flex flex-col justify-between">
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-x-auto">
          <DayEndFieldset branchId={branchId}>
          <table className="w-full text-xs font-bold text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-widest sticky top-0 z-10">
              <tr>
                <th className="py-2 px-2 border-r border-slate-800 w-8 text-center">SN</th>
                <th className="py-2 px-2 border-r border-slate-800 w-20">ID Code</th>
                <th className="py-2 px-2 border-r border-slate-800 min-w-[180px]">Staff Name</th>
                <th className="py-2 px-2 border-r border-slate-800 w-28">Dept / Designation</th>
                <th className="py-2 px-2 border-r border-slate-800 w-28 bg-slate-800 text-emerald-400 text-right">Basic Salary</th>
                <th className="py-2 px-2 border-r border-slate-800 w-24 bg-slate-800 text-amber-300 text-right">Grade Rate</th>
                <th className="py-2 px-2 border-r border-slate-800 w-24 bg-slate-800 text-cyan-300 text-right">DA Allowance</th>
                <th className="py-2 px-2 border-r border-slate-800 w-28 bg-slate-800 text-purple-300 text-right">Yearly Bonus</th>
                <th className="py-2 px-2 border-r border-slate-800 w-28 bg-slate-800 text-rose-300 text-right">Sanchit Leave</th>
                <th className="py-2 px-2 border-r border-slate-800 w-28 bg-slate-800 text-sky-300 text-right">Medical Allowance</th>
                <th className="py-2 px-2 border-r border-slate-800 w-28 bg-slate-800 text-teal-300 text-right">Dress Allowance</th>
                <th className="py-2 px-2 border-r border-slate-800 w-20 text-center">Status</th>
                <th className="py-2 px-2 w-10 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {draftList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 font-bold uppercase tracking-wider">
                    No employees in list. Click "Import Excel / CSV" or "Add Row" above.
                  </td>
                </tr>
              ) : (
                draftList.map((emp, index) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-1 px-2 text-center text-slate-400 font-mono border-r border-slate-200 text-[11px]">
                      {index + 1}
                    </td>
                    
                    <td className="py-1 px-1.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={emp.employeeCode}
                        onChange={e => updateDraftField(index, 'employeeCode', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-xs uppercase focus:bg-white focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={emp.fullName}
                        onChange={e => updateDraftField(index, 'fullName', e.target.value)}
                        placeholder="FULL NAME..."
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-black uppercase text-slate-900 focus:bg-white focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 space-y-0.5">
                      <input
                        type="text"
                        value={emp.department}
                        onChange={e => updateDraftField(index, 'department', e.target.value)}
                        placeholder="DEPT..."
                        className="w-full px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold uppercase focus:bg-white"
                      />
                      <input
                        type="text"
                        value={emp.designation}
                        onChange={e => updateDraftField(index, 'designation', e.target.value)}
                        placeholder="DESIG..."
                        className="w-full px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold uppercase text-slate-500 focus:bg-white"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 bg-emerald-50/20">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={emp.basicSalary || ''}
                        onChange={e => updateDraftField(index, 'basicSalary', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-0.5 bg-white border border-emerald-300 rounded font-mono text-xs text-right font-black text-emerald-900 focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 bg-amber-50/20">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={emp.gradeRate || ''}
                        onChange={e => updateDraftField(index, 'gradeRate', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-0.5 bg-white border border-amber-300 rounded font-mono text-xs text-right font-black text-amber-900 focus:ring-1 focus:ring-amber-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 bg-cyan-50/20">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={emp.dearnessAllowance || ''}
                        onChange={e => updateDraftField(index, 'dearnessAllowance', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-0.5 bg-white border border-cyan-300 rounded font-mono text-xs text-right font-black text-cyan-900 focus:ring-1 focus:ring-cyan-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 bg-purple-50/20">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={emp.bonusYearly || ''}
                        onChange={e => updateDraftField(index, 'bonusYearly', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-0.5 bg-white border border-purple-300 rounded font-mono text-xs text-right font-black text-purple-900 focus:ring-1 focus:ring-purple-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 bg-rose-50/20">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={emp.sanchitLeaveAmount || ''}
                        onChange={e => updateDraftField(index, 'sanchitLeaveAmount', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-0.5 bg-white border border-rose-300 rounded font-mono text-xs text-right font-black text-rose-900 focus:ring-1 focus:ring-rose-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 bg-sky-50/20">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={emp.medicalAllowance || ''}
                        onChange={e => updateDraftField(index, 'medicalAllowance', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-0.5 bg-white border border-sky-300 rounded font-mono text-xs text-right font-black text-sky-900 focus:ring-1 focus:ring-sky-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 bg-teal-50/20">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={emp.dressAllowance || ''}
                        onChange={e => updateDraftField(index, 'dressAllowance', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-0.5 bg-white border border-teal-300 rounded font-mono text-xs text-right font-black text-teal-900 focus:ring-1 focus:ring-teal-500"
                      />
                    </td>

                    <td className="py-1 px-1.5 border-r border-slate-200 text-center">
                      <select
                        value={emp.status || "Active"}
                        onChange={e => updateDraftField(index, 'status', e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold uppercase"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </td>

                    <td className="py-1 px-1 text-center">
                      <button
                        onClick={() => handleRemoveDraftRow(index)}
                        className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </DayEndFieldset>
        </div>

        {/* Save & Actions Section at bottom after scrolling down list */}
        <div className="mt-6 pt-4 border-t border-slate-300 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
          <div className="text-xs font-bold text-slate-600">
            {saveStatus ? (
              <span className="text-emerald-600 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                {saveStatus}
              </span>
            ) : (
              <span>* Click "SAVE ALL CHANGES" to save all edited basic salary, grade rate, and bonus details.</span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={() => !isDayEnded && handleSaveAllSubmit()}
              disabled={isSaving || draftList.length === 0 || isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : "Save All Changes"}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center space-x-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving...' : 'SAVE ALL CHANGES'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

const LeaveModule = ({ employees, leaveTypes, leaveRequests, onReload, branchId }: { employees: Employee[], leaveTypes: LeaveType[], leaveRequests: LeaveRequest[], onReload: () => void, branchId?: string }) => {
  const isDayEnded = useDayEndLock(branchId);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | undefined>(undefined);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reqToDelete, setReqToDelete] = useState<LeaveRequest | null>(null);

  const { user: currentUser, hasPermission } = useAuth();
  
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.username === 'admin' ||
      currentUser.roleId === '1' ||
      currentUser.roleId === 'super_admin' ||
      currentUser.roleId === 'admin' ||
      hasPermission('manage_hr')
    );
  }, [currentUser, hasPermission]);

  // Find the matching employee for current user (if they are an employee)
  const matchedEmployee = useMemo(() => {
    return employees.find(e => {
      const empName = (e.fullName || '').toLowerCase().trim();
      const userName = (currentUser?.fullName || '').toLowerCase().trim();
      const sameName = empName !== '' && empName === userName;
      
      const empEmail = (e.email || '').toLowerCase().trim();
      const userEmail = (currentUser?.email || '').toLowerCase().trim();
      const sameEmail = empEmail !== '' && userEmail !== '' && empEmail === userEmail;
      
      return sameName || sameEmail;
    });
  }, [employees, currentUser]);

  const [selectedEmpId, setSelectedEmpId] = useState<string>('');

  useEffect(() => {
    if (!isAdmin && matchedEmployee) {
      setSelectedEmpId(matchedEmployee.id);
    } else if (employees.length > 0 && !selectedEmpId) {
      const firstActive = employees.find(e => e.status === 'Active');
      if (firstActive) {
        setSelectedEmpId(firstActive.id);
      } else {
        setSelectedEmpId(employees[0].id);
      }
    }
  }, [isAdmin, matchedEmployee, employees, selectedEmpId]);

  const activeEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmpId) || matchedEmployee || null;
  }, [employees, selectedEmpId, matchedEmployee]);

  const [processingStatusId, setProcessingStatusId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, status: 'Approved' | 'Rejected') => {
    if (isDayEnded) return;
    const req = leaveRequests.find(r => r.id === id);
    if (!req) return;

    setProcessingStatusId(id);
    try {
      const updatedReq: LeaveRequest = { ...req, status };
      await storageService.saveLeaveRequest(updatedReq);
      onReload();

      // Find employee and leave type details
      const emp = employees.find(e => e.id === req.employeeId);
      const lt = leaveTypes.find(t => t.id === req.leaveTypeId);

      if (emp && emp.email && emp.email.trim()) {
        const total = lt ? lt.totalDays : 0;
        const taken = leaveRequests
          .filter(r => r.employeeId === req.employeeId && r.leaveTypeId === req.leaveTypeId && (r.status === 'Approved' || (r.id === req.id && status === 'Approved')))
          .reduce((s, r) => s + r.days, 0);
        const remaining = Math.max(0, total - taken);
        const leaveTypeName = lt ? (lt.nameNp ? `${lt.nameNp} (${lt.name})` : lt.name) : 'General Leave';

        const emailResult = await sendLeaveNotificationEmailApi({
          to: emp.email.trim(),
          employeeName: emp.fullName,
          employeeCode: emp.employeeCode,
          designation: emp.designation,
          department: emp.department,
          leaveType: leaveTypeName,
          startDate: req.startDate,
          endDate: req.endDate,
          days: req.days,
          reason: req.reason,
          status,
          approverName: currentUser?.fullName || currentUser?.username || 'HR Administration',
          totalEntitledDays: total,
          takenDays: taken,
          remainingDays: remaining
        });

        if (emailResult.success) {
          alert(`Leave ${status} successfully!\n\nAutomated notification email sent to ${emp.fullName} (${emp.email}).`);
        } else if (emailResult.disabled) {
          console.log("Leave email notifications disabled in settings:", emailResult.message);
        } else {
          alert(`Leave ${status} in database, but notification email could not be delivered: ${emailResult.message}`);
        }
      } else if (emp) {
        alert(`Leave ${status} successfully!\n\nNote: Employee ${emp.fullName} does not have an email address configured in their Profile, so no notification email was dispatched.`);
      }
    } catch (err: any) {
      console.error("Error updating leave request status:", err);
      alert(`Error updating leave status: ${err?.message || err}`);
    } finally {
      setProcessingStatusId(null);
    }
  };

  const handleEditClick = (req: LeaveRequest) => {
    if (isDayEnded) return;
    setEditingRequest(req);
    setShowAddModal(true);
  };

  const handleDeleteClick = (req: LeaveRequest) => {
    if (isDayEnded) return;
    setReqToDelete(req);
  };

  const confirmDeleteLeave = async () => {
    if (isDayEnded) return;
    if (!reqToDelete) return;
    const id = reqToDelete.id;
    setReqToDelete(null);
    try {
      await storageService.deleteLeaveRequest(id);
      onReload();
    } catch (err: any) {
      console.error("Error deleting leave request:", err);
      alert(`Error deleting leave request: ${err?.message || err}`);
    }
  };

  const filteredRequests = useMemo(() => {
    let list = leaveRequests;

    // Standard user-level privacy filtering (non-admins only see their own requests)
    if (!isAdmin && activeEmployee) {
      list = list.filter(r => r.employeeId === activeEmployee.id);
    }

    if (statusFilter !== 'ALL') {
      list = list.filter(r => r.status === statusFilter);
    }

    if (filterText.trim()) {
      const query = filterText.toLowerCase();
      list = list.filter(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const lt = leaveTypes.find(t => t.id === r.leaveTypeId);
        return (
          (emp?.fullName || '').toLowerCase().includes(query) ||
          (lt?.nameNp || '').toLowerCase().includes(query) ||
          (lt?.name || '').toLowerCase().includes(query) ||
          (r.reason || '').toLowerCase().includes(query)
        );
      });
    }

    return list.sort((a, b) => b.appliedDate - a.appliedDate);
  }, [leaveRequests, employees, leaveTypes, isAdmin, activeEmployee, statusFilter, filterText]);

  return (
    <div className="p-2 md:p-3 space-y-3 animate-in fade-in bg-white h-full overflow-y-auto italic font-bold scrollbar-hide">
       {/* Title block & Buttons with more compact padding */}
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 py-3 px-5 rounded-xl border border-slate-200 text-[#000000] gap-3">
          <div>
             <h3 className="text-base font-black uppercase italic tracking-tighter leading-none mb-1">Leave & Attendance</h3>
             <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest italic">Time-Off Registry and Allocation</p>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
             {/* Manage Leave Categories Button (Only Admin & Super Admin) */}
             {isAdmin && (
                <button 
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : "Manage Leave Categories"}
                  onClick={() => !isDayEnded && setShowCategoryModal(true)} 
                  className="flex-1 sm:flex-initial bg-slate-100 hover:bg-slate-200 text-slate-950 px-3 h-9 rounded-lg text-[8.5px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center space-x-1.5 active:scale-95 border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                   <LucideSettings size={13}/>
                   <span>Manage Categories</span>
                </button>
             )}
             
             {/* Apply Leave Button (replaces Establish Request) */}
             <button 
               disabled={isDayEnded}
               title={isDayEnded ? getDayEndedBlockMessage() : "Apply for Leave"}
               onClick={() => {
                 if (isDayEnded) return;
                 setEditingRequest(undefined);
                 setShowAddModal(true);
               }} 
               className="flex-1 sm:flex-initial bg-slate-950 text-white px-4 h-9 rounded-lg text-[8.5px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-600 transition-all flex items-center justify-center space-x-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
             >
                <Plus size={13}/>
                <span>Apply Leave</span>
             </button>
          </div>
       </div>

       {/* Single Consolidated Leave Table Panel */}
       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-[#000000]">
          {/* Header & Filters Toolbar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center italic">
                   <FileText size={11} className="mr-2"/> Consolidated Leave Registry
                </h4>
                {/* Non-admin viewing label */}
                {!isAdmin && activeEmployee && (
                  <span className="bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-blue-100">
                     My Records: {activeEmployee.fullName}
                  </span>
                )}
             </div>

             {/* Search and filter controls */}
             <div className="flex flex-col sm:flex-row gap-2">
                {/* Search text input */}
                <div className="relative">
                   <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input
                     type="text"
                     placeholder="Search employee or type..."
                     value={filterText}
                     onChange={e => setFilterText(e.target.value)}
                     className="h-8 w-full sm:w-56 bg-white border border-slate-300 rounded-lg pl-8 pr-3 font-black text-[9px] outline-none focus:border-emerald-500 uppercase italic placeholder-slate-400"
                   />
                </div>

                {/* Status selector */}
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-8 bg-white border border-slate-300 rounded-lg px-2 font-black text-[9px] outline-none focus:border-emerald-500 uppercase italic"
                >
                   <option value="ALL">All Statuses (सबै अवस्था)</option>
                   <option value="Pending">Pending (स्थागित)</option>
                   <option value="Approved">Approved (स्वीकृत)</option>
                   <option value="Rejected">Rejected (अस्वीकृत)</option>
                </select>
             </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
             <table className="w-full text-[9px] font-black border-collapse text-center italic">
                <thead>
                   <tr className="bg-slate-950 text-white uppercase tracking-widest text-[8px] h-10">
                      <th className="py-2.5 px-3 text-left pl-5 border-r border-white/5 min-w-[130px]">Leave Type</th>
                      <th className="py-2.5 px-3 text-left border-r border-white/5 min-w-[210px]">Date</th>
                      <th className="py-2.5 px-3 text-center border-r border-white/5 w-18">Total</th>
                      <th className="py-2.5 px-3 text-center border-r border-white/5 w-18">Taken</th>
                      <th className="py-2.5 px-3 text-center border-r border-white/5 w-18">Remaining</th>
                      <th className="py-2.5 px-3 text-left border-r border-white/5 min-w-[180px]">Created By</th>
                      <th className="py-2.5 px-3 text-center border-r border-white/5 w-28">Approve/Reject</th>
                      <th className="py-2.5 px-3 text-center w-24">Action</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                   {filteredRequests.length === 0 ? (
                      <tr>
                         <td colSpan={8} className="py-12 text-slate-300 uppercase tracking-widest font-black italic text-center">
                            No matching leave requests found
                         </td>
                      </tr>
                   ) : (
                      filteredRequests.map(req => {
                         const emp = employees.find(e => e.id === req.employeeId);
                         const lt = leaveTypes.find(t => t.id === req.leaveTypeId);

                         const total = lt ? lt.totalDays : 0;
                         const taken = leaveRequests
                           .filter(r => r.employeeId === req.employeeId && r.leaveTypeId === req.leaveTypeId && r.status === 'Approved')
                           .reduce((s, r) => s + r.days, 0);
                         const remaining = total - taken;

                         const isPending = req.status === 'Pending';
                         const canEditOrDelete = isAdmin || isPending;

                         return (
                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                               {/* Leave Type */}
                               <td className="p-3 text-left pl-5 border-r border-slate-150">
                                  <div className="text-slate-950 uppercase text-[10px] leading-tight mb-0.5">{lt?.nameNp || 'Other'}</div>
                                  <div className="text-[7.5px] text-slate-400 uppercase font-bold tracking-widest leading-none">{lt?.name || 'CUSTOM'}</div>
                               </td>

                               {/* Date formatted as Requested: YYYY-MM-DD to YYYY-MM-DD, Day */}
                               <td className="p-3 text-left border-r border-slate-150">
                                  <div className="text-[10px] font-sans tabular-nums text-slate-900 flex items-center space-x-1 font-bold">
                                     <span>{req.startDate}</span>
                                     <ArrowRight size={10} className="text-slate-400 mx-0.5" />
                                     <span>{req.endDate}</span>
                                  </div>
                                  <div className="text-[7.5px] text-emerald-600 font-bold uppercase tracking-wide mt-0.5">
                                     {req.days} {req.days === 1 ? 'Day' : 'Days'}
                                  </div>
                               </td>

                               {/* Total */}
                               <td className="p-3 text-center border-r border-slate-150 font-black text-slate-700 font-sans">
                                  {total}D
                               </td>

                               {/* Taken */}
                               <td className="p-3 text-center border-r border-slate-150 font-black text-rose-600 font-sans">
                                  {taken}D
                               </td>

                               {/* Remaining: Total - Taken */}
                               <td className={`p-3 text-center border-r border-slate-150 font-black font-sans ${remaining <= 0 ? 'text-rose-600 bg-rose-50/20' : 'text-emerald-700 bg-emerald-50/20'}`}>
                                  {remaining}D
                               </td>

                               {/* Created By (Employee information) */}
                               <td className="p-3 text-left border-r border-slate-150">
                                  <div className="flex items-center space-x-2.5 text-left">
                                     <div className="w-7 h-7 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                                        {emp?.photoUrl ? (
                                          <img src={emp.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                          <UserIcon size={12} className="m-1.5 text-slate-300" />
                                        )}
                                     </div>
                                     <div>
                                        <div className="text-slate-950 uppercase text-[9.5px] leading-tight font-black mb-0.5">
                                          {emp?.fullName || 'EX-STAFF'}
                                        </div>
                                        <div className="text-[7px] text-slate-400 uppercase tracking-widest leading-none">
                                          {emp?.designation || '-'}
                                        </div>
                                     </div>
                                  </div>
                               </td>

                               {/* Approve/Reject status column */}
                               <td className="p-3 text-center border-r border-slate-150">
                                  {req.status === 'Pending' && isAdmin ? (
                                     <div className="flex items-center justify-center space-x-1.5">
                                        <button 
                                          onClick={() => !isDayEnded && handleStatusChange(req.id, 'Approved')} 
                                          disabled={processingStatusId === req.id || isDayEnded || isDayEndedForBranch(emp?.branchId)}
                                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-slate-950 transition-all shadow active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed" 
                                          title={isDayEnded || isDayEndedForBranch(emp?.branchId) ? getDayEndedBlockMessage() : "Approve / Authorize (Sends Email Notification)"}
                                        >
                                          <Check size={12}/>
                                        </button>
                                        <button 
                                          onClick={() => !isDayEnded && handleStatusChange(req.id, 'Rejected')} 
                                          disabled={processingStatusId === req.id || isDayEnded || isDayEndedForBranch(emp?.branchId)}
                                          className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-slate-950 transition-all shadow active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed" 
                                          title={isDayEnded || isDayEndedForBranch(emp?.branchId) ? getDayEndedBlockMessage() : "Reject / Decline (Sends Email Notification)"}
                                        >
                                          <X size={12}/>
                                        </button>
                                     </div>
                                  ) : (
                                     <div className="inline-flex items-center space-x-1 justify-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[7.5px] uppercase font-black tracking-widest italic border ${
                                           req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                           req.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                           'bg-blue-50 text-blue-600 border-blue-100 animate-pulse'
                                        }`}>
                                           {req.status}
                                        </span>
                                        {isAdmin && req.status === 'Approved' && (
                                           <button
                                             onClick={() => !isDayEnded && handleStatusChange(req.id, 'Approved')}
                                             disabled={processingStatusId === req.id || isDayEnded || isDayEndedForBranch(emp?.branchId)}
                                             className="p-1 text-slate-400 hover:text-emerald-600 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                             title={isDayEnded || isDayEndedForBranch(emp?.branchId) ? getDayEndedBlockMessage() : "Resend Leave Approval Email Notification"}
                                           >
                                             <Mail size={11} />
                                           </button>
                                        )}
                                     </div>
                                  )}
                               </td>

                               {/* Action: Edit and Delete buttons */}
                               <td className="p-3">
                                  <div className="flex items-center justify-center space-x-1.5">
                                     <button
                                       disabled={isDayEnded || isDayEndedForBranch(emp?.branchId)}
                                       onClick={() => handleEditClick(req)}
                                       className="p-1.5 rounded-lg transition-all text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                       title={isDayEnded || isDayEndedForBranch(emp?.branchId) ? getDayEndedBlockMessage() : "Edit Leave Request"}
                                     >
                                       <Edit2 size={12} />
                                     </button>
                                     <button
                                       disabled={isDayEnded || isDayEndedForBranch(emp?.branchId)}
                                       onClick={() => handleDeleteClick(req)}
                                       className="p-1.5 rounded-lg transition-all text-rose-600 hover:bg-rose-50 hover:text-rose-800 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                       title={isDayEnded || isDayEndedForBranch(emp?.branchId) ? getDayEndedBlockMessage() : "Delete Leave Request"}
                                     >
                                       <Trash2 size={12} />
                                     </button>
                                     {req.reason && (
                                       <button 
                                         onClick={() => alert(`Reason / Justification:\n\n${req.reason}`)} 
                                         className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                         title="View Justification"
                                       >
                                         <Eye size={12}/>
                                       </button>
                                     )}
                                  </div>
                               </td>
                            </tr>
                         );
                      })
                   )}
                </tbody>
             </table>
          </div>
       </div>

       {showAddModal && (
         <AddLeaveModal 
           employees={employees} 
           leaveTypes={leaveTypes} 
           branchId={branchId}
           onClose={() => {
             setShowAddModal(false);
             setEditingRequest(undefined);
           }} 
           onReload={onReload} 
           editingRequest={editingRequest}
         />
       )}
       {showCategoryModal && <ManageLeaveCategoriesModal leaveTypes={leaveTypes} branchId={branchId} onClose={() => setShowCategoryModal(false)} onReload={onReload} />}
       {reqToDelete && (
         <ConfirmationModal
           isOpen={!!reqToDelete}
           onCancel={() => setReqToDelete(null)}
           onConfirm={confirmDeleteLeave}
           title="Delete Leave Request"
           message={`Are you sure you want to delete this leave request (${reqToDelete.startDate} to ${reqToDelete.endDate})? This record will be permanently removed.`}
           confirmLabel="Delete Request"
           cancelLabel="Cancel"
           variant="danger"
         />
       )}
    </div>
  );};
const ManageLeaveCategoriesModal = ({ leaveTypes, branchId, onClose, onReload }: { leaveTypes: LeaveType[], branchId?: string, onClose: () => void, onReload: () => void }) => {
  const isDayEnded = useDayEndLock(branchId);
  const [editingCategory, setEditingCategory] = useState<LeaveType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameNp: '',
    totalDays: 0,
    leaveType: 'Paid',
    reserveLeave: 'No',
    nonReserveLeave: 'No'
  });

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name || '',
        nameNp: editingCategory.nameNp || '',
        totalDays: editingCategory.totalDays || 0,
        leaveType: editingCategory.leaveType || 'Paid',
        reserveLeave: String(editingCategory.reserveLeave || 'No'),
        nonReserveLeave: String(editingCategory.nonReserveLeave || 'No')
      });
    } else {
      setFormData({
        name: '',
        nameNp: '',
        totalDays: 0,
        leaveType: 'Paid',
        reserveLeave: 'No',
        nonReserveLeave: 'No'
      });
    }
  }, [editingCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) return;
    const payload: LeaveType = {
      id: editingCategory ? editingCategory.id : 'lt-' + crypto.randomUUID(),
      name: formData.name,
      nameNp: formData.nameNp || formData.name,
      totalDays: Number(formData.totalDays),
      leaveType: formData.leaveType,
      reserveLeave: formData.reserveLeave,
      nonReserveLeave: formData.nonReserveLeave
    };

    await storageService.saveLeaveType(payload);
    onReload();
    setEditingCategory(null);
    setFormData({
      name: '',
      nameNp: '',
      totalDays: 0,
      leaveType: 'Paid',
      reserveLeave: 'No',
      nonReserveLeave: 'No'
    });
  };

  const handleDelete = async (id: string) => {
    if (isDayEnded) return;
    if (confirm("Are you sure you want to delete this category? This may affect existing leave records of this category.")) {
      await storageService.deleteLeaveType(id);
      onReload();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[6000] flex items-center justify-center p-6 italic font-black no-print">
       <div className="bg-white w-full max-w-4xl rounded-[3rem] border-2 border-slate-950 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          <div className="p-8 bg-slate-50 border-b-2 border-slate-950 flex justify-between items-center shrink-0 text-slate-950">
             <div className="flex items-center space-x-4">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-md"><LucideSettings size={24}/></div>
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">Leave Category Configuration</h3>
             </div>
             <button onClick={onClose} className="p-2 bg-white rounded-xl text-slate-400 hover:text-rose-600 transition-all border border-slate-200"><X size={24}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 scrollbar-hide text-slate-900">
             <div className="lg:col-span-5 bg-slate-50 p-6 rounded-[2rem] border border-slate-150 flex flex-col h-fit">
                <h4 className="text-sm font-black uppercase tracking-tight text-slate-950 mb-4 pb-2 border-b border-slate-200">
                  {editingCategory ? 'Edit Leave Category' : 'Create Leave Category'}
                </h4>
                <form onSubmit={handleSubmit} className="space-y-4">
                   <DayEndFieldset branchId={branchId} className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Category Name (English)</label>
                      <input 
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-4 font-black text-[11px] outline-none focus:border-emerald-500 uppercase italic shadow-inner"
                        required
                        placeholder="e.g. SICK LEAVE"
                      />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">बिदाको नाम (Nepali)</label>
                      <input 
                        type="text"
                        value={formData.nameNp}
                        onChange={e => setFormData({...formData, nameNp: e.target.value})}
                        className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-4 font-black text-[11px] outline-none focus:border-emerald-500 uppercase italic shadow-inner"
                        placeholder="e.g. बिरामी बिदा"
                      />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Leave Type (Paid / Unpaid)</label>
                      <select 
                        value={formData.leaveType || "Paid"}
                        onChange={e => setFormData({...formData, leaveType: e.target.value})}
                        className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-4 font-black text-[11px] outline-none focus:border-emerald-500 uppercase italic shadow-inner appearance-none"
                      >
                         <option value="Paid">Paid</option>
                         <option value="Unpaid">Unpaid</option>
                      </select>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Total Leave Days</label>
                      <input 
                        type="number"
                        min="0"
                        value={formData.totalDays}
                        onChange={e => setFormData({...formData, totalDays: Number(e.target.value)})}
                        className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-4 font-black text-[11px] outline-none focus:border-emerald-500 uppercase italic shadow-inner"
                        required
                      />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Reserve Leave (Yes / No or Number)</label>
                      <input 
                        type="text"
                        value={formData.reserveLeave}
                        onChange={e => setFormData({...formData, reserveLeave: e.target.value})}
                        className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-4 font-black text-[11px] outline-none focus:border-emerald-500 uppercase italic shadow-inner"
                        placeholder="e.g. Yes, No, or 10 days"
                      />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Non-Reserve Leave (Yes / No or Number)</label>
                      <input 
                        type="text"
                        value={formData.nonReserveLeave}
                        onChange={e => setFormData({...formData, nonReserveLeave: e.target.value})}
                        className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-4 font-black text-[11px] outline-none focus:border-emerald-500 uppercase italic shadow-inner"
                        placeholder="e.g. Yes, No, or 5 days"
                      />
                   </div>
                   </DayEndFieldset>

                   <div className="flex space-x-3 pt-2">
                      {editingCategory && (
                         <button 
                           type="button" 
                           onClick={() => setEditingCategory(null)}
                           className="flex-1 h-11 bg-slate-200 text-slate-700 rounded-xl font-black uppercase text-[10px] tracking-wider"
                         >
                            Cancel
                         </button>
                      )}
                      <button 
                        type="submit" 
                        disabled={isDayEnded}
                        title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                        className="flex-1 h-11 bg-emerald-600 text-white hover:bg-slate-950 transition-colors rounded-xl font-black uppercase text-[10px] tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                         {editingCategory ? 'Save Changes' : 'Create Category'}
                      </button>
                   </div>
                </form>
             </div>

             <div className="lg:col-span-7 bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                <h4 className="text-sm font-black uppercase tracking-tight text-slate-950 p-5 bg-slate-50 border-b border-slate-200">
                  Active Leave Categories ({leaveTypes.length})
                </h4>
                <div className="overflow-x-auto text-left">
                   <table className="w-full text-[9px] font-black border-collapse text-center">
                      <thead>
                         <tr className="bg-slate-950 text-white uppercase tracking-wider text-[8px] h-10">
                            <th className="py-2 px-3 text-left pl-5">Category</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Total</th>
                            <th className="py-2 px-3">Reserve</th>
                            <th className="py-2 px-3">Non-Reserve</th>
                            <th className="py-2 px-3">Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {leaveTypes.map((lt: LeaveType) => (
                            <tr key={lt.id} className="hover:bg-slate-50 transition-colors text-slate-700">
                               <td className="p-3 text-left pl-5">
                                  <div className="text-slate-950 uppercase text-[10px] leading-tight mb-0.5">{lt.name}</div>
                                  <div className="text-[8px] text-slate-400 font-bold uppercase">{lt.nameNp}</div>
                               </td>
                               <td className="p-3 uppercase text-slate-600">{lt.leaveType || 'Paid'}</td>
                               <td className="p-3 text-slate-950">{lt.totalDays}D</td>
                               <td className="p-3 text-[8px] uppercase text-slate-500 font-bold">{String(lt.reserveLeave || 'No')}</td>
                               <td className="p-3 text-[8px] uppercase text-slate-500 font-bold">{String(lt.nonReserveLeave || 'No')}</td>
                               <td className="p-3">
                                  <div className="flex items-center justify-center space-x-1">
                                     <button 
                                       disabled={isDayEnded}
                                       onClick={() => !isDayEnded && setEditingCategory(lt)}
                                       className="p-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-600 hover:text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                       title={isDayEnded ? getDayEndedBlockMessage() : "Edit"}
                                     >
                                        <Edit2 size={10}/>
                                     </button>
                                     <button 
                                       disabled={isDayEnded}
                                       onClick={() => handleDelete(lt.id)}
                                       className="p-1.5 bg-slate-100 text-slate-600 hover:bg-rose-600 hover:text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                       title={isDayEnded ? getDayEndedBlockMessage() : "Delete"}
                                     >
                                        <Trash2 size={10}/>
                                     </button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const AddLeaveModal = ({ employees, leaveTypes, branchId, onClose, onReload, editingRequest }: { employees: Employee[], leaveTypes: LeaveType[], branchId?: string, onClose: () => void, onReload: () => void, editingRequest?: LeaveRequest }) => {
  const { user: currentUser, hasPermission } = useAuth();
  const isDayEnded = useDayEndLock(branchId);
  
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.username === 'admin' ||
      currentUser.roleId === '1' ||
      currentUser.roleId === 'super_admin' ||
      currentUser.roleId === 'admin' ||
      hasPermission('manage_hr')
    );
  }, [currentUser, hasPermission]);

  // Find matching employee record for the logged-in user
  const matchedEmployee = useMemo(() => {
    return employees.find(e => {
      const empName = (e.fullName || '').toLowerCase().trim();
      const userName = (currentUser?.fullName || '').toLowerCase().trim();
      const sameName = empName !== '' && empName === userName;
      
      const empEmail = (e.email || '').toLowerCase().trim();
      const userEmail = (currentUser?.email || '').toLowerCase().trim();
      const sameEmail = empEmail !== '' && userEmail !== '' && empEmail === userEmail;
      
      return sameName || sameEmail;
    });
  }, [employees, currentUser]);

  const [formData, setFormData] = useState(() => {
    if (editingRequest) {
      return {
        employeeId: editingRequest.employeeId,
        leaveTypeId: editingRequest.leaveTypeId,
        startDate: editingRequest.startDate,
        endDate: editingRequest.endDate,
        reason: editingRequest.reason
      };
    }
    return { 
      employeeId: isAdmin ? '' : (matchedEmployee?.id || ''), 
      leaveTypeId: '', 
      startDate: new NepaliDate().format('YYYY-MM-DD'), 
      endDate: new NepaliDate().format('YYYY-MM-DD'), 
      reason: '' 
    };
  });
  
  const calculateDays = (start: string, end: string) => {
    try {
      const s = new NepaliDate(start).toJsDate();
      const e = new NepaliDate(end).toJsDate();
      const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
      return diff > 0 ? diff : 0;
    } catch (e) { return 0; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) return;
    if (!formData.employeeId || !formData.leaveTypeId) return;
    if (isBackDateBlockedForEntry(formData.startDate)) {
      alert(getBackDateBlockedMessage(formData.startDate));
      return;
    }
    
    if (editingRequest) {
      const isPending = editingRequest.status === 'Pending';
      if (!isAdmin && !isPending) {
        alert("Permission denied: Non-admins can only edit pending leave requests.");
        return;
      }
      const updatedReq: LeaveRequest = {
        ...editingRequest,
        employeeId: formData.employeeId,
        leaveTypeId: formData.leaveTypeId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        days: calculateDays(formData.startDate, formData.endDate),
        reason: formData.reason,
      };
      await storageService.saveLeaveRequest(updatedReq);
    } else {
      const leaveReq: LeaveRequest = {
        id: crypto.randomUUID(),
        employeeId: formData.employeeId,
        leaveTypeId: formData.leaveTypeId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        days: calculateDays(formData.startDate, formData.endDate),
        reason: formData.reason,
        status: 'Pending',
        appliedDate: Date.now()
      };
      await storageService.saveLeaveRequest(leaveReq);

      // Asynchronously notify employee & administration of new leave application
      const emp = employees.find(e => e.id === formData.employeeId);
      const lt = leaveTypes.find(t => t.id === formData.leaveTypeId);
      if (emp && emp.email && emp.email.trim()) {
        const leaveTypeName = lt ? (lt.nameNp ? `${lt.nameNp} (${lt.name})` : lt.name) : 'General Leave';
        sendLeaveNotificationEmailApi({
          to: emp.email.trim(),
          employeeName: emp.fullName,
          employeeCode: emp.employeeCode,
          designation: emp.designation,
          department: emp.department,
          leaveType: leaveTypeName,
          startDate: formData.startDate,
          endDate: formData.endDate,
          days: leaveReq.days,
          reason: formData.reason,
          status: 'Pending',
          approverName: 'Pending Administrative Review'
        }).catch(err => console.warn("Failed to dispatch leave submission notification:", err));
      }
    }
    
    onReload();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[6000] flex items-center justify-center p-4 italic font-black no-print">
       <div className="bg-white w-full max-w-lg rounded-[2rem] border-2 border-slate-950 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
          {/* Header with reduced padding */}
          <div className="p-4 px-6 bg-slate-50 border-b-2 border-slate-950 flex justify-between items-center shrink-0">
             <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm"><Calendar size={18}/></div>
                <h3 className="text-lg font-black italic tracking-tighter uppercase text-slate-950">{editingRequest ? 'Edit Leave Request' : 'Apply for Leave'}</h3>
             </div>
             <button onClick={onClose} className="p-1.5 bg-white rounded-lg text-slate-400 hover:text-rose-600 transition-all border border-slate-200"><X size={18}/></button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide text-[#000000]">
             <DayEndFieldset branchId={branchId} className="space-y-3">
                
                {/* Employee selection: allows any employee */}
                <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Identity Selection (कर्मचारी)</label>
                   <select 
                     value={formData.employeeId || ""}
                     onChange={e => setFormData({...formData, employeeId: e.target.value})}
                     className="w-full h-10 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-black text-[10px] outline-none focus:border-emerald-500 uppercase italic shadow-inner appearance-none disabled:opacity-75 disabled:cursor-not-allowed"
                     required
                     disabled={!isAdmin}
                   >
                      {isAdmin ? (
                        <>
                          <option value="">Choose Employee...</option>
                          {employees.map((e:any) => (
                            <option key={e.id} value={e.id}>
                              {e.fullName} • {e.designation} {e.status === 'Inactive' ? '(Inactive)' : ''}
                            </option>
                          ))}
                        </>
                      ) : (
                        matchedEmployee ? (
                          <option value={matchedEmployee.id}>{matchedEmployee.fullName} • {matchedEmployee.designation}</option>
                        ) : (
                          <option value="">No matching active employee record</option>
                        )
                      )}
                   </select>
                </div>

                {/* Time-Off Category: compact dropdown to save height and support all categories */}
                <div className="space-y-1 text-left">
                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Time-Off Category (बिदाको प्रकार)</label>
                   <select 
                     value={formData.leaveTypeId || ""}
                     onChange={e => setFormData({...formData, leaveTypeId: e.target.value})}
                     className="w-full h-10 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-black text-[10px] outline-none focus:border-emerald-500 uppercase italic shadow-inner"
                     required
                   >
                      <option value="">Select Category (बिदाको विधा)...</option>
                      {leaveTypes.map((lt:any) => (
                        <option key={lt.id} value={lt.id}>
                          {lt.nameNp} ({lt.name})
                        </option>
                      ))}
                   </select>
                </div>

                {/* Nepali Date Range selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                   <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Effective Start (शुरु मिति)</label>
                      <NepaliDatePicker value={formData.startDate} onChange={v => setFormData({...formData, startDate: v})} disallowBackDateIfDisabled={true} disabled={isDayEnded} className="w-full" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Authorized End (अन्तिम मिति)</label>
                      <NepaliDatePicker value={formData.endDate} onChange={v => setFormData({...formData, endDate: v})} disallowBackDateIfDisabled={true} disabled={isDayEnded} className="w-full" />
                   </div>
                </div>

                {/* Duration Day Show */}
                <div className="px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                   <span className="text-[9px] font-black uppercase text-slate-500">Leave Duration:</span>
                   <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">{calculateDays(formData.startDate, formData.endDate)} Days</span>
                </div>

                {/* Justification / Reason */}
                <div className="space-y-1 text-left">
                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Clinical / Personal Justification (कारण)</label>
                   <textarea 
                     value={formData.reason}
                     onChange={e => setFormData({...formData, reason: e.target.value})}
                     className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-[10px] outline-none focus:border-emerald-500 uppercase italic resize-none shadow-inner leading-relaxed"
                     placeholder="PROVIDE SPECIFIC REASON FOR LEAVE..."
                     required
                   />
                </div>
             </DayEndFieldset>

             {/* Footer Button: Compact & clean */}
             <div className="bg-slate-950 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-xl flex items-center justify-between">
                <div>
                   <div className="text-[7px] font-black uppercase tracking-widest text-slate-500 leading-none mb-0.5">Calculated Days</div>
                   <div className="text-xl font-black text-emerald-400 italic tracking-tighter leading-none">{calculateDays(formData.startDate, formData.endDate)} <span className="text-[10px]">DAYS</span></div>
                </div>
                <button type="submit" disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} className="bg-white text-slate-950 px-5 h-10 rounded-xl font-black uppercase text-[9px] tracking-wider shadow-md hover:bg-emerald-600 hover:text-white transition-all active:scale-95 flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed">
                   <ShieldCheck size={14}/>
                   <span>{editingRequest ? 'Update Leave Request' : 'Create Leave Request'}</span>
                </button>
             </div>
          </form>
       </div>
    </div>
  );
};

const ComplaintsModule = ({ employees, complaints, onReload, branchId }: { employees: Employee[], complaints: Complaint[], onReload: () => void, branchId?: string }) => {
  const isDayEnded = useDayEndLock(branchId);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState<Complaint | null>(null);

  const handleStatusUpdate = async (complaint: Complaint, status: Complaint['status'], note?: string) => {
    if (isDayEnded) return;
    await storageService.saveComplaint({ ...complaint, status, resolutionNote: note || complaint.resolutionNote });
    onReload();
    setSelectedGrievance(null);
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in h-full overflow-y-auto scrollbar-hide italic font-bold">
       <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border-2 border-slate-950 text-[#000000]">
          <div className="flex items-center space-x-4">
             <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-100"><AlertCircle size={22}/></div>
             <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter leading-none mb-1">Grievance Portal</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Encrypted Workplace Feedback Loop</p>
             </div>
          </div>
          <button disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} onClick={() => !isDayEnded && setShowAddModal(true)} className="bg-slate-950 text-white px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-rose-600 transition-all flex items-center space-x-3 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
             <MessageSquare size={16}/>
             <span>File Grievance</span>
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-[#000000]">
          {complaints.length === 0 ? (
             <div className="col-span-full py-32 text-center">
                <ShieldAlert size={48} className="mx-auto text-slate-100 mb-4" />
                <p className="text-slate-300 uppercase tracking-[0.5em] font-black">No active workplace grievances registered</p>
             </div>
          ) : (
             complaints.sort((a,b) => b.date - a.date).map(c => {
                const emp = employees.find(e => e.id === c.employeeId);
                return (
                   <div 
                      key={c.id} 
                      onClick={() => setSelectedGrievance(c)}
                      className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:border-rose-500 hover:shadow-xl transition-all duration-300 group cursor-pointer flex flex-col relative"
                   >
                      <div className="flex justify-between items-start mb-6">
                         <span className={`px-4 py-1.5 rounded-full text-[8px] uppercase font-black tracking-widest border ${
                            c.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            c.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            'bg-rose-50 text-rose-600 border-rose-100 animate-pulse'
                         }`}>
                            {c.status}
                         </span>
                         <span className="text-[8px] font-black text-slate-300 uppercase italic">{new Date(c.date).toLocaleDateString()}</span>
                      </div>
                      
                      <h4 className="text-xl font-black uppercase tracking-tighter text-slate-900 mb-3 group-hover:text-rose-600 transition-colors line-clamp-2 leading-tight">
                         {c.subject}
                      </h4>
                      
                      <div className="flex items-center space-x-3 mt-auto pt-6 border-t border-slate-50">
                         <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            {c.isConfidential ? <ShieldAlert size={14} className="m-2 text-rose-300"/> : (emp?.photoUrl ? <img src={emp.photoUrl} className="w-full h-full object-cover" /> : <UserIcon size={14} className="m-2 text-slate-300"/>)}
                         </div>
                         <div>
                            <div className="text-slate-950 uppercase text-[10px] leading-tight mb-0.5">{c.isConfidential ? 'CONFIDENTIAL IDENTITY' : (emp?.fullName || 'UNKNOWN')}</div>
                            <div className="text-[7px] text-slate-400 uppercase tracking-widest leading-none">{c.isConfidential ? 'Identity Protected' : (emp?.designation || 'Staff')}</div>
                         </div>
                      </div>
                   </div>
                );
             })
          )}
       </div>

       {showAddModal && <AddComplaintModal employees={employees} branchId={branchId} onClose={() => setShowAddModal(false)} onReload={onReload} />}
       {selectedGrievance && <ViewGrievanceModal grievance={selectedGrievance} branchId={branchId} onStatusUpdate={handleStatusUpdate} onClose={() => setSelectedGrievance(null)} />}
    </div>
  );
};

const AddComplaintModal = ({ employees, branchId, onClose, onReload }: any) => {
  const isDayEnded = useDayEndLock(branchId);
  const [formData, setFormData] = useState({ employeeId: '', subject: '', description: '', isConfidential: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) return;
    if (!formData.employeeId || !formData.subject || !formData.description) return;

    const grievance: Complaint = {
      id: crypto.randomUUID(),
      employeeId: formData.employeeId,
      subject: formData.subject,
      description: formData.description,
      status: 'Pending',
      isConfidential: formData.isConfidential,
      date: Date.now()
    };

    await storageService.saveComplaint(grievance);
    onReload();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[6000] flex items-center justify-center p-6 italic font-black text-[#000000]">
       <div className="bg-white w-full max-w-2xl rounded-[3rem] border-2 border-slate-950 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
          <div className="p-8 bg-slate-50 border-b-2 border-slate-950 flex justify-between items-center">
             <div className="flex items-center space-x-4">
                <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-xl"><MessageSquare size={24}/></div>
                <h3 className="text-2xl font-black italic tracking-tighter uppercase text-slate-950">Lodge Grievance</h3>
             </div>
             <button onClick={onClose} className="p-2 bg-white rounded-xl text-slate-400 hover:text-rose-600 transition-all border border-slate-200"><X size={24}/></button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-10 space-y-6">
             <DayEndFieldset branchId={branchId} className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Identity Confirmation</label>
                   <select 
                     value={formData.employeeId || ""}
                     onChange={e => setFormData({...formData, employeeId: e.target.value})}
                     className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-[11px] outline-none focus:border-rose-500 uppercase italic"
                     required
                   >
                      <option value="">Confirm Identity...</option>
                      {employees.map((e:any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                   </select>
                </div>
                <div className="flex items-center pt-6">
                   <button 
                     type="button"
                     onClick={() => setFormData({...formData, isConfidential: !formData.isConfidential})}
                     className={`flex items-center space-x-3 px-6 py-2.5 rounded-2xl border-2 transition-all ${formData.isConfidential ? 'bg-rose-600 border-rose-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                   >
                      {formData.isConfidential ? <ShieldAlert size={16}/> : <ShieldCheck size={16}/>}
                      <span className="text-[9px] font-black uppercase tracking-widest">Confidential Posting</span>
                   </button>
                </div>
             </div>

             <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Grievance Subject</label>
                <input 
                  type="text" 
                  value={formData.subject}
                  onChange={e => setFormData({...formData, subject: e.target.value})}
                  className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-sm outline-none focus:border-rose-500 uppercase italic shadow-inner"
                  placeholder="WHAT IS THE PRIMARY CONCERN?"
                  required
                />
             </div>

             <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Detailed Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full h-40 bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 font-black text-xs outline-none focus:border-rose-500 uppercase italic resize-none shadow-inner leading-relaxed"
                  placeholder="DESCRIBE THE INCIDENT OR FEEDBACK IN DETAIL..."
                  required
                />
             </div>
             </DayEndFieldset>

             <div className="pt-6 flex justify-end">
                <button type="submit" disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} className="w-full h-16 bg-slate-950 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-rose-600 transition-all flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                   <Send size={20}/>
                   <span>Transmit to HR Registry</span>
                </button>
             </div>
          </form>
       </div>
    </div>
  );
};

const ViewGrievanceModal = ({ grievance, branchId, onStatusUpdate, onClose }: any) => {
  const { hasPermission } = useAuth();
  const isDayEnded = useDayEndLock(branchId);
  const [resolutionNote, setResolutionNote] = useState(grievance.resolutionNote || '');

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl z-[6000] flex items-center justify-center p-6 italic font-black text-[#000000]">
       <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[3rem] border-2 border-slate-950 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          <div className="p-8 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center shrink-0">
             <div className="flex items-center space-x-4">
                <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-xl"><ShieldAlert size={24}/></div>
                <div>
                   <h3 className="text-2xl font-black italic tracking-tighter uppercase text-slate-950 leading-none mb-1">Grievance Audit</h3>
                   <div className="flex items-center space-x-2 text-[9px] text-slate-400 uppercase tracking-[0.2em]">
                      <Calendar size={10}/> <span>Reported: {new Date(grievance.date).toLocaleString()}</span>
                   </div>
                </div>
             </div>
             <button onClick={onClose} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-rose-600 transition-all border border-slate-200"><X size={24}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-12 bg-white scrollbar-hide">
             <div className="max-w-2xl mx-auto space-y-12">
                <div className="space-y-4">
                   <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 border-l-8 border-rose-500 pl-6 py-2 leading-tight">
                      {grievance.subject}
                   </h1>
                   <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
                      <p className="text-base text-slate-700 uppercase tracking-wide leading-relaxed font-bold">
                         {grievance.description}
                      </p>
                   </div>
                </div>

                {hasPermission('manage_hr') ? (
                   <div className="space-y-6 pt-6 border-t-2 border-slate-50">
                      <div className="flex items-center space-x-3 text-rose-600">
                         <LucideSettings size={18}/>
                         <h4 className="text-[10px] font-black uppercase tracking-widest">HR Governance Action</h4>
                      </div>
                      <textarea 
                        disabled={isDayEnded}
                        value={resolutionNote}
                        onChange={e => setResolutionNote(e.target.value)}
                        className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 font-black text-xs outline-none focus:border-rose-500 uppercase italic shadow-inner resize-none leading-relaxed disabled:opacity-60"
                        placeholder="PROVIDE RESOLUTION NOTES OR SYSTEM UPDATE..."
                      />
                      <div className="flex flex-wrap gap-4">
                         <button disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} onClick={() => !isDayEnded && onStatusUpdate(grievance, 'In Progress', resolutionNote)} className="flex-1 h-14 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-slate-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed">Mark In Progress</button>
                         <button disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} onClick={() => !isDayEnded && onStatusUpdate(grievance, 'Resolved', resolutionNote)} className="flex-1 h-14 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-slate-950 transition-all flex items-center justify-center space-x-3 disabled:opacity-40 disabled:cursor-not-allowed"><CheckCircle size={18}/><span>Finalize Resolution</span></button>
                      </div>
                   </div>
                ) : grievance.resolutionNote && (
                   <div className="space-y-4 pt-6 border-t-2 border-slate-50">
                      <div className="flex items-center space-x-3 text-emerald-600">
                         <CheckCircle2 size={18}/>
                         <h4 className="text-[10px] font-black uppercase tracking-widest">Official Response</h4>
                      </div>
                      <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 text-[11px] text-emerald-800 uppercase leading-relaxed italic">
                         {grievance.resolutionNote}
                      </div>
                   </div>
                )}
             </div>
          </div>
          <div className="p-8 bg-slate-950 text-white flex items-center justify-between shrink-0">
             <div className="flex items-center space-x-3 opacity-40">
                <ShieldCheck size={14}/>
                <span className="text-[9px] uppercase font-black tracking-widest">Encrypted Legal Document Entry</span>
             </div>
             <div className={`px-4 py-1.5 rounded-full text-[9px] uppercase font-black tracking-widest border ${
                grievance.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
             }`}>
                {grievance.status}
             </div>
          </div>
       </div>
    </div>
  );
};

const ViewEmployeeModal = ({
  employee,
  onClose,
  onEdit,
  onGenerateDoc,
  settings,
  branches
}: {
  employee: Employee;
  onClose: () => void;
  onEdit?: (emp: Employee) => void;
  onGenerateDoc?: (emp: Employee) => void;
  settings: SystemSettings | null;
  branches: any[];
}) => {
  const isDayEnded = useDayEndLock(employee.branchId);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  const branchName = useMemo(() => {
    if (!employee.branchId) return 'मुख्य कार्यालय (Head Office)';
    const found = branches.find((b: any) => b.id === employee.branchId);
    return found ? found.name : 'मुख्य कार्यालय';
  }, [employee, branches]);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[5000] flex items-center justify-center p-2 lg:p-4 overflow-y-auto no-print">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col max-h-[95vh] my-auto">
        {/* Modal Top Bar (Screen Only) */}
        <div className="py-2.5 px-4 border-b border-emerald-600/30 flex justify-between items-center bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shrink-0 no-print shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow"><Eye size={16}/></div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">EMPLOYEE FULL PROFILE & KYC</h3>
              <p className="text-[9px] text-emerald-100 font-medium">Official Employee Dossier</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onGenerateDoc && (
              <button 
                onClick={() => {
                  onClose();
                  onGenerateDoc(employee);
                }} 
                title="कागजात तथा परिचयपत्र (ID Card, Visiting Card, Appointment, Transfer)"
                className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow transition-all active:scale-95 flex items-center space-x-1.5 text-xs font-bold"
              >
                <FileBadge size={15} />
                <span className="hidden sm:inline">कागजात तथा कार्ड</span>
              </button>
            )}
            {onEdit && (
              <button 
                disabled={isDayEnded}
                onClick={() => !isDayEnded && onEdit(employee)} 
                title={isDayEnded ? getDayEndedBlockMessage() : "Edit Profile"}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-all active:scale-95 flex items-center space-x-1 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Edit2 size={15} />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            <button 
              onClick={() => window.print()} 
              title="Print Profile"
              className="p-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg shadow transition-all active:scale-95 flex items-center space-x-1 text-xs font-bold"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button 
              onClick={onClose} 
              title="Close"
              className="p-2 bg-emerald-950/50 hover:bg-emerald-700 rounded-lg text-emerald-100 transition-all"
            >
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white text-slate-900 print:p-0 print:overflow-visible text-xs">
          
          {/* Header Section (Cooperative Logo & Details) */}
          <div className="relative border-b-2 border-slate-900 pb-4 mb-6 flex items-center justify-center min-h-[76px] px-16 text-center">
            <div className="absolute left-0 top-1/2 -translate-y-1/2">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} className="w-16 h-16 object-contain" alt="Coop Logo" />
              ) : (
                <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm">
                  Coop
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight uppercase">
                {settings?.companyName || 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड'}
              </h1>
              <p className="text-xs font-bold text-slate-700">
                {settings?.address || 'पिपरा गाउँपालिका-६, महोत्तरी'}
              </p>
              <span className="inline-block text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-1 rounded-full mt-1">
                कर्मचारीको विवरण
              </span>
            </div>
          </div>

          {/* Employee Hero Profile Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center md:items-start gap-4 mb-6">
            <div className="w-28 h-28 rounded-2xl overflow-hidden bg-slate-100 shadow-none shrink-0 flex items-center justify-center">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} className="w-full h-full object-cover" alt={employee.fullName} />
              ) : (
                <UserIcon size={54} className="text-slate-300" />
              )}
            </div>

            <div className="flex-1 w-full space-y-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight flex items-baseline gap-2 flex-wrap">
                    <span>{employee.fullName}</span>
                    {employee.fullNameNepali && <span className="text-sm font-bold text-slate-600">({employee.fullNameNepali})</span>}
                  </h2>
                  {employee.previousName && (
                    <p className="text-[10px] font-bold text-slate-500">
                      पहिलेको नाम (Previous): {employee.previousName} {employee.previousNameNepali ? `(${employee.previousNameNepali})` : ''}
                    </p>
                  )}
                  <p className="text-xs font-black text-emerald-700 uppercase tracking-wider mt-0.5">
                    {employee.designation || 'STAFF'} • {employee.department || 'GENERAL DEPARTMENT'}
                  </p>
                </div>
                <div className="mt-2 md:mt-0">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${employee.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                    {employee.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] pt-1">
                <div>
                  <span className="text-slate-400 text-[9px] font-bold block uppercase">कर्मचारी कोड (ID Code)</span>
                  <span className="font-mono font-bold text-slate-900">{employee.employeeCode || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] font-bold block uppercase">शाखा (Branch)</span>
                  <span className="font-bold text-slate-900">{branchName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] font-bold block uppercase">मोबाइल नम्बर (Mobile)</span>
                  <span className="font-bold text-slate-900">{employee.mobile || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] font-bold block uppercase">ईमेल (Email)</span>
                  <span className="font-bold text-slate-900">{employee.email || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: General & Personal Info */}
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-3">
              १. सामान्य तथा व्यक्तिगत विवरण (Personal & Service Details)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">लिंग (Gender)</span>
                <span className="font-bold text-slate-900">{employee.gender || 'Male'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">जन्म मिति (Date of Birth)</span>
                <span className="font-bold text-slate-900">{employee.dobBs || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">राष्ट्रियता (Nationality)</span>
                <span className="font-bold text-slate-900">{employee.nationality || 'नेपाली'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">वैवाहिक स्थिति (Marital Status)</span>
                <span className="font-bold text-slate-900">{employee.maritalStatus === 'Couple' ? 'Married (विवाहित)' : 'Single (अविवाहित)'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">सेवाको प्रकार (Employment Type)</span>
                <span className="font-bold text-slate-900">{employee.employmentType || 'Permanent'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">प्रवेश मिति (Joined Date)</span>
                <span className="font-bold text-slate-900">{employee.joinedDate || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">स्थायी लेखा नम्बर (PAN No)</span>
                <span className="font-mono font-bold text-slate-900">{employee.panNo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">रक्त समूह (Blood Group)</span>
                <span className="font-bold text-slate-900">{employee.bloodGroup || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">अनिवार्य अवकाश मिति (Retirement BS)</span>
                <span className="font-mono font-black text-emerald-800">
                  {calculateRetirementInfo(employee.dobBs, employee.joinedDate).finalRetDate || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: KYC & Family Details */}
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-3">
              २. ग्राहक पहिचान तथा पारिवारिक विवरण (KYC & Family Details)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">नागरिकता नं (Citizenship No)</span>
                <span className="font-mono font-bold text-slate-900">{employee.citizenshipNo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">जारी जिल्ला (Issue District)</span>
                <span className="font-bold text-slate-900">{employee.citizenshipDistrict || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">जारी मिति (Issue Date)</span>
                <span className="font-bold text-slate-900">{employee.citizenshipIssueDate || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">पति/पत्नीको नाम (Spouse Name)</span>
                <span className="font-bold text-slate-900">
                  {employee.spouseName || '-'}
                  {employee.spouseNameNepali ? ` (${employee.spouseNameNepali})` : ''}
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">बुबाको नाम (Father's Name)</span>
                <span className="font-bold text-slate-900">
                  {employee.fatherName || '-'}
                  {employee.fatherNameNepali ? ` (${employee.fatherNameNepali})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">आमाको नाम (Mother's Name)</span>
                <span className="font-bold text-slate-900">
                  {employee.motherName || '-'}
                  {employee.motherNameNepali ? ` (${employee.motherNameNepali})` : ''}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 text-[9px] font-bold block uppercase">हजुरबुबाको नाम (Grandfather Name)</span>
                <span className="font-bold text-slate-900">
                  {employee.grandfatherName || '-'}
                  {employee.grandfatherNameNepali ? ` (${employee.grandfatherNameNepali})` : ''}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-slate-400 text-[9px] font-bold block uppercase">स्थायी ठेगाना (Permanent Address)</span>
                <span className="font-bold text-slate-900">
                  {employee.permanentAddress || '-'}
                  {employee.permanentAddressNepali ? ` [नेपाली: ${employee.permanentAddressNepali}]` : ''}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 text-[9px] font-bold block uppercase">अस्थायी ठेगाना (Temporary Address)</span>
                <span className="font-bold text-slate-900">
                  {employee.temporaryAddress || '-'}
                  {employee.temporaryAddressNepali ? ` [नेपाली: ${employee.temporaryAddressNepali}]` : ''}
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">आपत्कालीन सम्पर्क व्यक्ति</span>
                <span className="font-bold text-slate-900">{employee.emergencyContact || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">सम्बन्ध (Relationship)</span>
                <span className="font-bold text-slate-900">{employee.emergencyRelation || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">आपत्कालीन फोन (Mobile)</span>
                <span className="font-mono font-bold text-slate-900">{employee.emergencyPhone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">आपत्कालीन ठेगाना (Address)</span>
                <span className="font-bold text-slate-900">{employee.emergencyAddress || '-'}</span>
              </div>
            </div>

            {/* Citizenship Document Photo Previews if available */}
            {(employee.citizenshipFrontUrl || employee.citizenshipBackUrl) && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-slate-700 block mb-2">नागरिकता कागजात फोटोहरू (Citizenship Document Scans)</span>
                <div className="grid grid-cols-2 gap-3">
                  {employee.citizenshipFrontUrl && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 block">Citizenship Front (अगाडि)</span>
                      <img src={employee.citizenshipFrontUrl} alt="Citizenship Front" className="h-28 rounded-lg border border-slate-300 object-cover shadow-xs" />
                    </div>
                  )}
                  {employee.citizenshipBackUrl && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 block">Citizenship Back (पछाडि)</span>
                      <img src={employee.citizenshipBackUrl} alt="Citizenship Back" className="h-28 rounded-lg border border-slate-300 object-cover shadow-xs" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Education & Experience Details */}
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-3">
              ३. शिक्षा तथा अनुभव विवरण (Education & Work Experience)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">उच्चतम योग्यता (Qualification)</span>
                <span className="font-bold text-slate-900">{employee.qualification || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">शिक्षण संस्था (Institution)</span>
                <span className="font-bold text-slate-900">{employee.institution || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">उत्तीर्ण वर्ष (Passed Year)</span>
                <span className="font-bold text-slate-900">{employee.passedYear || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">कुल अनुभव (Total Exp)</span>
                <span className="font-bold text-slate-900">{employee.totalExperience || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">अघिल्लो रोजगारदाता (Employer)</span>
                <span className="font-bold text-slate-900">{employee.previousEmployer || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">अघिल्लो पद (Previous Designation)</span>
                <span className="font-bold text-slate-900">{employee.previousDesignation || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">सेवा प्रवेश (Joined)</span>
                <span className="font-bold text-slate-900">{employee.expJoiningDate || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">सेवा छोडेको (Leaving)</span>
                <span className="font-bold text-slate-900">{employee.expLeavingDate || '-'}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Bank, Payroll & Allowance Details */}
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-3">
              ४. बैंक, सेवा-सुविधा तथा तलब विवरण (Bank & Payroll Details)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">बैंकको नाम (Bank Name)</span>
                <span className="font-bold text-slate-900">{employee.bankName || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">खातावालाको नाम (Account Holder)</span>
                <span className="font-bold text-slate-900">{employee.accountHolderName || employee.fullName || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">बैंक खाता नम्बर (Account No)</span>
                <span className="font-mono font-bold text-slate-900">{employee.bankAccountNo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">बैंक शाखा (Bank Branch)</span>
                <span className="font-bold text-slate-900">{employee.bankBranch || '-'}</span>
              </div>

              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">बेसिक तलब (Basic Salary)</span>
                <span className="font-black text-slate-900 text-sm">रू {employee.basicSalary?.toLocaleString('en-IN') || 0}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">महङ्गी भत्ता (D.A.)</span>
                <span className="font-bold text-slate-900">
                  {employee.daType === 'Percentage' ? `${employee.daValue}%` : employee.daType === 'Amount' ? `रू ${employee.daValue}` : 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">ग्रेड दर / रकम (Grade Rate)</span>
                <span className="font-bold text-slate-900">{employee.gradeRate || 0} दर (रू {employee.gradeRateAmount?.toFixed(2) || '0.00'})</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">सञ्चित बिदा दिन (Sanchit Leave)</span>
                <span className="font-bold text-slate-900">{employee.sanchitLeaveDays || 0} दिन (रू {employee.sanchitLeaveAmount?.toFixed(2) || '0.00'})</span>
              </div>

              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">सामाजिक सुरक्षा कोष (SSF)</span>
                <span className="font-bold text-slate-900">{employee.hasSSF ? 'लागू (Active)' : 'छैन (No)'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">कर्मचारी सञ्चय कोष (P.F.)</span>
                <span className="font-bold text-slate-900">{employee.hasPF ? 'लागू (Active)' : 'छैन (No)'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">दशैं खर्च (Dashain Allowance)</span>
                <span className="font-bold text-slate-900">{employee.hasDashain ? '१ महिना बेसिक' : 'छैन'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold block uppercase">उपचार खर्च (Medical Allowance)</span>
                <span className="font-bold text-slate-900">{employee.hasMedical ? '१ महिना बेसिक' : 'छैन'}</span>
              </div>
            </div>
          </div>

          {/* Section 5: Document Checklist Status */}
          <div className="mb-8">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-3">
              ५. पेश गरिएका कागजातहरूको स्थिति (Document Checklist)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
              {[
                { title: 'Citizenship Front Photo (नागरिकता अगाडि)', file: employee.citizenshipFrontUrl || employee.docsCitizenship },
                { title: 'Citizenship Back Photo (नागरिकता पछाडि)', file: employee.citizenshipBackUrl },
                { title: 'National ID (राष्ट्रिय परिचयपत्र)', file: employee.docsNid },
                { title: 'PAN Card (प्यान कार्ड)', file: employee.docsPan },
                { title: 'Education Certificate (शैक्षिक प्रमाणपत्र)', file: employee.docsEducation },
                { title: 'Experience Letter (अनुभव पत्र)', file: employee.docsExperience },
                { title: 'Contract / Appointment Letter (नियुक्ति पत्र)', file: employee.docsContract }
              ].map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                    <FileText size={13} className={doc.file ? "text-emerald-600 shrink-0" : "text-slate-400 shrink-0"} />
                    <span className="font-bold text-slate-700 text-[10px] truncate">{doc.title}</span>
                  </div>
                  {doc.file ? (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: doc.title, url: doc.file! })}
                      className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors flex items-center space-x-1 shrink-0"
                      title="Click to view"
                    >
                      <Eye size={10} />
                      <span>View ✅</span>
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-200 text-slate-600 shrink-0">
                      Pending ⏳
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center text-[9px] text-slate-400 font-bold border-t border-slate-100 pt-2">
            रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड - आधिकारिक कर्मचारी अभिलेख
          </div>

        </div>

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[6000] flex items-center justify-center p-3 sm:p-6 no-print">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-emerald-500/30 flex flex-col max-h-[92vh] animate-in zoom-in-95">
              <div className="py-2.5 px-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <FileText size={16} />
                  <h4 className="text-xs font-black uppercase tracking-wider">{previewDoc.title}</h4>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={previewDoc.url}
                    download="document"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase"
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-slate-900/90 flex items-center justify-center min-h-[350px]">
                {previewDoc.url.startsWith('data:application/pdf') || previewDoc.url.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={previewDoc.url} title={previewDoc.title} className="w-full h-[70vh] rounded-lg border-0 bg-white" />
                ) : (
                  <img src={previewDoc.url} alt={previewDoc.title} className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EditEmployeeModal = ({ employee, onClose, onSave, branches, isSuper, isSaving }: { employee: Employee, onClose: () => void, onSave: (e: Employee) => void, branches: any[], isSuper: boolean, isSaving?: boolean }) => {
  const [data, setData] = useState<Employee>(() => ({
    ...employee,
    gender: employee.gender || 'Male',
    maritalStatus: employee.maritalStatus || 'Single',
    employmentType: employee.employmentType || 'Permanent',
    status: employee.status || 'Active',
    branchId: employee.branchId || 'main',
    daType: employee.daType || 'None'
  }));
  const [activeModalTab, setActiveModalTab] = useState<'basic' | 'kyc'>('basic');
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDayEnded = useDayEndLock(data.branchId);

  useEffect(() => {
    let da = 0;
    if (data.daType === 'Percentage') {
      da = (data.basicSalary * (data.daValue || 0)) / 100;
    } else if (data.daType === 'Amount') {
      da = data.daValue || 0;
    }
    
    const gradeAmount = (data.basicSalary / 30) * (data.gradeRate || 0);
    const dashain = data.hasDashain ? data.basicSalary : 0;
    const medical = data.hasMedical ? data.basicSalary : 0;
    const ssf = data.hasSSF ? (data.ssfContribution || 0) : 0;
    const pf = data.hasPF ? (data.pfContribution || 0) : 0;
    const grat = data.hasGratuity ? (data.gratuity || 0) : 0;
    const bonus = data.hasBonus ? (data.bonusYearly || 0) : 0;
    const sanchitAmount = (data.basicSalary / 30) * (data.sanchitLeaveDays || 0);

    if (
      da !== data.dearnessAllowance || 
      gradeAmount !== data.gradeRateAmount ||
      dashain !== data.dashainBonus ||
      medical !== data.medicalAllowance ||
      ssf !== data.ssfContribution ||
      pf !== data.pfContribution ||
      grat !== data.gratuity ||
      sanchitAmount !== data.sanchitLeaveAmount ||
      bonus !== data.bonusYearly
    ) {
      setData(prev => ({
        ...prev,
        dearnessAllowance: da,
        gradeRateAmount: gradeAmount,
        dashainBonus: dashain,
        medicalAllowance: medical,
        ssfContribution: ssf,
        pfContribution: pf,
        gratuity: grat,
        sanchitLeaveAmount: sanchitAmount,
        bonusYearly: bonus
      }));
    }
  }, [
    data.basicSalary, 
    data.daType, 
    data.daValue, 
    data.gradeRate, 
    data.hasDashain, 
    data.hasMedical, 
    data.hasSSF, 
    data.hasPF, 
    data.hasGratuity,
    data.hasBonus,
    data.sanchitLeaveDays,
    data.dearnessAllowance,
    data.gradeRateAmount,
    data.dashainBonus,
    data.medicalAllowance,
    data.ssfContribution,
    data.pfContribution,
    data.gratuity,
    data.sanchitLeaveAmount,
    data.bonusYearly
  ]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDayEnded) return;
    const file = e.target.files?.[0];
    if (file) {
      try {
        const val = await compressDocumentFile(file);
        setData(prev => ({ ...prev, photoUrl: val }));
      } catch (err) {
        console.error("Failed to process photo:", err);
      }
    }
  };

  const handleFileUpload = (field: keyof Employee) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDayEnded) return;
    const file = e.target.files?.[0];
    if (file) {
      try {
        const val = await compressDocumentFile(file);
        setData(prev => {
          const next = { ...prev, [field]: val };
          if (field === 'citizenshipFrontUrl') {
            next.docsCitizenship = val;
          }
          return next;
        });
      } catch (err) {
        console.error("Failed to process document file:", err);
      }
    }
  };

  const handleRemoveFile = (field: keyof Employee) => {
    if (isDayEnded) return;
    setData(prev => {
      const next = { ...prev, [field]: undefined };
      if (field === 'citizenshipFrontUrl') {
        next.docsCitizenship = undefined;
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[5000] flex items-center justify-center p-2 lg:p-4 no-print">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 flex flex-col max-h-[98vh]">
        
        {/* Modal Header Bar with Tab Switches */}
        <div className="py-2.5 px-4 border-b border-emerald-600/30 flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shrink-0 gap-3 shadow-sm">
          <div className="flex items-center space-x-2.5">
             <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-md"><Briefcase size={16}/></div>
             <div>
               <h3 className="text-sm font-black tracking-tight uppercase text-white">EMPLOYEE REGISTER</h3>
               <p className="text-[9px] text-emerald-100 font-medium">{data.id ? 'Edit Employee Details & KYC' : 'New Employee Registration'}</p>
             </div>
          </div>

          <div className="flex items-center space-x-3 ml-auto">
            {/* Top Header Tabs */}
            <div className="flex items-center space-x-1.5 bg-emerald-950/40 p-1 rounded-xl border border-emerald-500/40 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveModalTab('basic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
                  activeModalTab === 'basic'
                    ? 'bg-white text-emerald-900 shadow-md font-black'
                    : 'text-emerald-100 hover:text-white hover:bg-emerald-700/60 font-bold'
                }`}
              >
                <User size={13} />
                <span>BASIC INFO</span>
              </button>
              
              <button
                type="button"
                onClick={() => setActiveModalTab('kyc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
                  activeModalTab === 'kyc'
                    ? 'bg-white text-emerald-900 shadow-md font-black'
                    : 'text-emerald-100 hover:text-white hover:bg-emerald-700/60 font-bold'
                }`}
              >
                <ShieldCheck size={13} />
                <span>FULL KYC FORM</span>
              </button>
            </div>

            <button onClick={onClose} className="p-1.5 hover:bg-emerald-600/70 rounded-lg text-emerald-100 transition-colors">
              <X size={18}/>
            </button>
          </div>
        </div>
        
        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide text-slate-900 bg-slate-50">

          {/* TAB 1: BASIC INFORMATION FORM */}
          {activeModalTab === 'basic' && (
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Photo & Basic Info - Updated to light green */}
                  <div className="lg:col-span-4 flex flex-col items-center space-y-3 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
                     <div className="relative group">
                        <div 
                          onClick={() => {
                            if (data.photoUrl) setPreviewDoc({ title: `${data.fullName || 'Employee'} - Photo`, url: data.photoUrl });
                          }}
                          className={`w-28 h-28 rounded-2xl bg-emerald-100/60 border-2 border-emerald-300 overflow-hidden shadow-inner flex items-center justify-center transition-all ${data.photoUrl ? 'cursor-pointer hover:border-emerald-500 hover:shadow-md' : ''}`}
                          title={data.photoUrl ? "Click to view photo (हेर्न क्लिक गर्नुहोस्)" : "Upload photo"}
                        >
                           {data.photoUrl ? (
                             <img src={data.photoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Employee Photo" />
                           ) : (
                             <UserIcon size={42} className="text-emerald-400" />
                           )}
                           {data.photoUrl && (
                             <div className="absolute inset-0 bg-emerald-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                               <Eye size={22} className="text-white drop-shadow" />
                             </div>
                           )}
                        </div>
                        <button 
                          type="button"
                          disabled={isDayEnded}
                          title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                          onClick={() => !isDayEnded && fileInputRef.current?.click()} 
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-emerald-600 hover:bg-emerald-700 text-white p-1 px-3 rounded-xl shadow-md border border-emerald-400 font-black text-[9px] uppercase tracking-wider transition-all active:scale-90 flex items-center space-x-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                           <Camera size={11} />
                           <span className="text-[8px] font-black tracking-wider uppercase">{data.photoUrl ? 'Change' : 'Photo'}</span>
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" disabled={isDayEnded} onChange={handlePhotoUpload} className="hidden" />
                     </div>

                     {data.photoUrl && (
                       <div className="flex items-center space-x-2 pt-0.5">
                         <button
                           type="button"
                           onClick={() => setPreviewDoc({ title: `${data.fullName || 'Employee'} - Photo`, url: data.photoUrl! })}
                           className="text-[10px] font-black text-emerald-800 bg-white hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300 flex items-center space-x-1 shadow-xs transition-all"
                         >
                           <Eye size={10} />
                           <span>View</span>
                         </button>
                         <button
                           type="button"
                           disabled={isDayEnded}
                           title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                           onClick={() => !isDayEnded && setData(prev => ({ ...prev, photoUrl: undefined }))}
                           className="text-[10px] font-bold text-rose-600 bg-white hover:bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 flex items-center space-x-1 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                         >
                           <Trash2 size={10} />
                           <span>Remove</span>
                         </button>
                       </div>
                     )}

                     <DayEndFieldset branchId={data.branchId} className="w-full space-y-2 pt-2">
                        <div className="space-y-0.5">
                           <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Staff ID Code</label>
                           <input type="text" value={data.employeeCode || ''} onChange={e => setData({...data, employeeCode: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="EMP-101" />
                        </div>
                        <div className="space-y-0.5">
                           <label className="text-[9px] font-black uppercase text-slate-500 ml-1">PAN Number</label>
                           <input type="text" value={data.panNo || ''} onChange={e => setData({...data, panNo: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="10-digit PAN" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-0.5">
                              <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Gender</label>
                              <select value={data.gender || 'Male'} onChange={e => setData({...data, gender: e.target.value as any})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                                 <option value="Male">Male</option>
                                 <option value="Female">Female</option>
                              </select>
                           </div>
                           <div className="space-y-0.5">
                              <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Status</label>
                              <select value={data.status || 'Active'} onChange={e => setData({...data, status: e.target.value as any})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                                 <option value="Active">Active</option>
                                 <option value="On Leave">On Leave</option>
                                 <option value="Terminated">Terminated</option>
                              </select>
                           </div>
                        </div>

                        {/* Retirement Calculation Card */}
                        {(() => {
                          const ret = calculateRetirementInfo(data.dobBs, data.joinedDate);
                          return (
                            <div className="w-full bg-emerald-50/90 p-3 rounded-xl border border-emerald-200/80 mt-2 space-y-2">
                              <div className="flex items-center space-x-1.5 text-emerald-950 border-b border-emerald-200/80 pb-1.5">
                                <Clock size={13} className="text-emerald-700 shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-wider">अवकाश तथा सेवा विवरण</span>
                              </div>

                              <div className="space-y-1.5 text-[11px] font-bold">
                                <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200/80 shadow-2xs">
                                  <span className="text-slate-600 font-bold uppercase text-[9px] tracking-wider">RETIREMENT DATE :</span>
                                  <span className="font-mono text-xs font-black text-emerald-800">{ret.finalRetDate || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200/80 shadow-2xs">
                                  <span className="text-slate-600 font-bold uppercase text-[9px] tracking-wider">SERVICE PERIOD :</span>
                                  <span className="font-mono text-xs font-black text-blue-800">{ret.totalServicePeriod || '-'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                     </DayEndFieldset>
                  </div>

                  {/* Advanced Controls */}
                  <DayEndFieldset branchId={data.branchId} className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5">
                     <div className="col-span-2 space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Full Legal Name</label>
                        <input type="text" value={data.fullName || ''} onChange={e => setData({...data, fullName: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-black text-xs outline-none focus:border-emerald-600 text-black" placeholder="Full Legal Name" />
                     </div>
                     
                     <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Designation</label>
                        <input type="text" value={data.designation || ''} onChange={e => setData({...data, designation: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="e.g. Sr. Manager" />
                     </div>
                     <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Department</label>
                        <input type="text" value={data.department || ''} onChange={e => setData({...data, department: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="e.g. Loan Department" />
                     </div>

                     <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Mobile Number</label>
                        <input type="text" value={data.mobile || ''} onChange={e => setData({...data, mobile: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="98XXXXXXXX" />
                     </div>
                     <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Email Address</label>
                        <input type="email" value={data.email || ''} onChange={e => setData({...data, email: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="example@gmail.com" />
                     </div>

                     <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Marital Status</label>
                        <select value={data.maritalStatus || 'Single'} onChange={e => setData({...data, maritalStatus: e.target.value as any})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                           <option value="Single">Single</option>
                           <option value="Couple">Married</option>
                        </select>
                     </div>

                     <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Employment Type</label>
                        <select value={data.employmentType || 'Permanent'} onChange={e => setData({...data, employmentType: e.target.value as any})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                           <option value="Permanent">Permanent</option>
                           <option value="Temporary">Contract / Temporary</option>
                        </select>
                     </div>

                     <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Joined Date (BS/AD)</label>
                        <input type="text" value={data.joinedDate || ''} onChange={e => setData({...data, joinedDate: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="YYYY-MM-DD" />
                     </div>

                     <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Assigned Branch</label>
                        <select 
                          value={data.branchId || 'main'} 
                          onChange={e => setData({...data, branchId: e.target.value})} 
                          className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black"
                        >
                           <option value="main">Ratauli Head Office (C01)</option>
                           <option value="sahodba">Sahodba Branch (C02)</option>
                           <option value="pipra">Pipra Branch (C03)</option>
                           <option value="parsa">Parsa Branch (C04)</option>
                           {branches.filter(b => !['main', 'sahodba', 'pipra', 'parsa'].includes(normalizeBranchId(b.id))).map(b => (
                             <option key={b.id} value={b.id}>{b.name}</option>
                           ))}
                        </select>
                     </div>

                      <div className="col-span-2 border-t border-slate-200 mt-2 pt-3">
                         <h4 className="text-[10px] font-black uppercase text-emerald-700 tracking-wider mb-2">Payroll & Allowances (तलब तथा भत्ता)</h4>
                         <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="space-y-0.5">
                               <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Basic Salary (शुरु तलब)</label>
                               <input type="number" value={data.basicSalary || 0} onChange={e => setData({...data, basicSalary: Number(e.target.value)})} className="w-full h-8 bg-slate-900 border border-emerald-900/10 rounded-lg px-3 font-black text-xs text-emerald-400 outline-none focus:border-emerald-500" />
                            </div>

                            <div className="space-y-0.5">
                               <label className="text-[9px] font-black uppercase text-slate-500 ml-1">D.A. (महङ्गी भत्ता)</label>
                               <div className="flex items-center space-x-1.5">
                                  <select value={data.daType || 'None'} onChange={e => setData({...data, daType: e.target.value as any})} className="h-8 bg-white border border-slate-300 rounded-lg px-2 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                                     <option value="None">None</option>
                                     <option value="Percentage">%</option>
                                     <option value="Amount">Amt</option>
                                  </select>
                                  {data.daType !== 'None' && (
                                     <input type="number" value={data.daValue || 0} onChange={e => setData({...data, daValue: Number(e.target.value)})} className="flex-1 h-8 bg-white border border-slate-300 rounded-lg px-2 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder={data.daType === 'Percentage' ? '%' : 'Amount'} />
                                  )}
                               </div>
                            </div>

                            <div className="space-y-0.5">
                               <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Grade Rate (ग्रेड दर)</label>
                               <input type="number" value={data.gradeRate || 0} onChange={e => setData({...data, gradeRate: Number(e.target.value)})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-3 font-bold text-xs outline-none focus:border-emerald-600 text-black" />
                            </div>

                            <div className="space-y-0.5">
                               <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Sanchit Leave (दिन)</label>
                               <input type="number" value={data.sanchitLeaveDays || 0} onChange={e => setData({...data, sanchitLeaveDays: Number(e.target.value)})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-3 font-bold text-xs outline-none focus:border-emerald-600 text-black" />
                            </div>

                            {/* Toggles Section */}
                            <div className="col-span-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                               {[
                                  { label: 'SSF', key: 'hasSSF', amountKey: 'ssfContribution' },
                                  { label: 'P.F.', key: 'hasPF', amountKey: 'pfContribution' },
                                  { label: 'Retirement', key: 'hasGratuity', amountKey: 'gratuity' },
                                  { label: 'Dashain', key: 'hasDashain', amountKey: 'dashainBonus' },
                                  { label: 'Medical', key: 'hasMedical', amountKey: 'medicalAllowance' },
                                  { label: 'Bonus', key: 'hasBonus', amountKey: 'bonusYearly' },
                                  { label: 'DRESS', key: 'hasDressAllowance', amountKey: 'dressAllowance' },
                                  { label: 'LIFE INS', key: 'hasLifeInsurance', amountKey: 'lifeInsurance' },
                                  { label: 'HEALTH', key: 'hasHealthInsurance', amountKey: 'healthInsurance' },
                                  { label: 'BUILDING', key: 'hasBuildingAllowance', amountKey: 'buildingInsurance' },
                                  { label: 'REMOTE', key: 'hasRemoteAllowance', amountKey: 'remoteAllowance' }
                               ].map((item) => (
                                  <div key={item.key} className="space-y-1">
                                     <div className="flex items-center justify-between">
                                        <label className="text-[9px] font-black uppercase text-slate-600">{item.label}</label>
                                        <button 
                                          type="button"
                                          onClick={() => setData({...data, [item.key]: !data[item.key as keyof Employee]})}
                                          className={`w-7 h-3.5 rounded-full relative transition-all ${data[item.key as keyof Employee] ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                        >
                                           <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${data[item.key as keyof Employee] ? 'right-0.5' : 'left-0.5'}`} />
                                        </button>
                                     </div>
                                     {data[item.key as keyof Employee] && (
                                       <input 
                                         type="number" 
                                         value={(data[item.amountKey as keyof Employee] as number) || 0} 
                                         onChange={e => setData({...data, [item.amountKey]: Number(e.target.value)})} 
                                         className="w-full h-7 bg-white border border-slate-200 rounded-lg px-1.5 font-bold text-[10px] outline-none focus:border-emerald-500 text-black"
                                         disabled={item.key === 'hasDashain' || item.key === 'hasMedical'}
                                       />
                                     )}
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>
                  </DayEndFieldset>
               </div>
            </div>
          )}

          {/* TAB 2: COMPREHENSIVE FULL KYC FORM (8 SECTIONS) */}
          {activeModalTab === 'kyc' && (
            <div className="space-y-6">
              <DayEndFieldset branchId={data.branchId} className="space-y-6">

              {/* SECTION 1: Personal Information */}
              <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg"><User size={14} /></div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    1. PERSONAL INFORMATION
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-0.5 col-span-2">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Full Legal Name</label>
                    <input type="text" value={data.fullName || ''} onChange={e => setData({...data, fullName: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Full Legal Name in English" />
                  </div>

                  <div className="space-y-0.5 col-span-2">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">पूरा नाम</label>
                    <input type="text" value={data.fullNameNepali || ''} onChange={e => setData({...data, fullNameNepali: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="नेपालीमा पूरा नाम" />
                  </div>



                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Gender</label>
                    <select value={data.gender || 'Male'} onChange={e => setData({...data, gender: e.target.value as any})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Date of Birth (BS / AD)</label>
                    <input type="text" value={data.dobBs || ''} onChange={e => setData({...data, dobBs: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="2050/04/15 (1993-08-01)" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Nationality</label>
                    <input type="text" value={data.nationality || 'Nepali'} onChange={e => setData({...data, nationality: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Nepali" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Marital Status</label>
                    <select value={data.maritalStatus || 'Single'} onChange={e => setData({...data, maritalStatus: e.target.value as any})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                      <option value="Single">Single</option>
                      <option value="Couple">Married</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Blood Group</label>
                    <input type="text" value={data.bloodGroup || ''} onChange={e => setData({...data, bloodGroup: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="A+ / B+ / O+ / AB+" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Mobile Number</label>
                    <input type="text" value={data.mobile || ''} onChange={e => setData({...data, mobile: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="98XXXXXXXX" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Email Address</label>
                    <input type="email" value={data.email || ''} onChange={e => setData({...data, email: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="email@domain.com" />
                  </div>

                  {/* Permanent Address: English and Nepali */}
                  <div className="space-y-0.5 col-span-2">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Permanent Address</label>
                    <input type="text" value={data.permanentAddress || ''} onChange={e => setData({...data, permanentAddress: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Province, District, Local Level, Ward No." />
                  </div>

                  <div className="space-y-0.5 col-span-2">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">स्थायी ठेगाना</label>
                    <input type="text" value={data.permanentAddressNepali || ''} onChange={e => setData({...data, permanentAddressNepali: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="प्रदेश, जिल्ला, गाउँपालिका/नगरपालिका, वडा नं." />
                  </div>

                  {/* Temporary Address: English and Nepali */}
                  <div className="space-y-0.5 col-span-2">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Temporary Address</label>
                    <input type="text" value={data.temporaryAddress || ''} onChange={e => setData({...data, temporaryAddress: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Current Living Address" />
                  </div>

                  <div className="space-y-0.5 col-span-2">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">हालको ठेगाना</label>
                    <input type="text" value={data.temporaryAddressNepali || ''} onChange={e => setData({...data, temporaryAddressNepali: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="हाल बसोबास रहेको पूरा ठेगाना" />
                  </div>

                  {/* Family Information with separate English & Nepali fields */}
                  <div className="col-span-full pt-2 border-t border-slate-100">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-800 mb-2">FAMILY DETAILS</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Father's Name</label>
                        <input type="text" value={data.fatherName || ''} onChange={e => setData({...data, fatherName: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Father's Full Name" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 ml-1">बुबाको नाम</label>
                        <input type="text" value={data.fatherNameNepali || ''} onChange={e => setData({...data, fatherNameNepali: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="नेपालीमा बुबाको नाम" />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Mother's Name</label>
                        <input type="text" value={data.motherName || ''} onChange={e => setData({...data, motherName: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Mother's Full Name" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 ml-1">आमाको नाम</label>
                        <input type="text" value={data.motherNameNepali || ''} onChange={e => setData({...data, motherNameNepali: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="नेपालीमा आमाको नाम" />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Grandfather's Name</label>
                        <input type="text" value={data.grandfatherName || ''} onChange={e => setData({...data, grandfatherName: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Grandfather's Name" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 ml-1">हजुरबुबाको नाम</label>
                        <input type="text" value={data.grandfatherNameNepali || ''} onChange={e => setData({...data, grandfatherNameNepali: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="नेपालीमा हजुरबुबाको नाम" />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Spouse's Name</label>
                        <input type="text" value={data.spouseName || ''} onChange={e => setData({...data, spouseName: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Spouse's Name" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 ml-1">पति/पत्नीको नाम</label>
                        <input type="text" value={data.spouseNameNepali || ''} onChange={e => setData({...data, spouseNameNepali: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="नेपालीमा पति/पत्नीको नाम" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Identity / KYC Documents */}
              <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg"><FileText size={14} /></div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    2. IDENTITY & KYC DOCUMENTS
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Citizenship / National ID No.</label>
                    <input type="text" value={data.citizenshipNo || ''} onChange={e => setData({...data, citizenshipNo: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="12-01-75-12345" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Issue District</label>
                    <input type="text" value={data.citizenshipDistrict || ''} onChange={e => setData({...data, citizenshipDistrict: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="e.g. Mahottari" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Issue Date</label>
                    <input type="text" value={data.citizenshipIssueDate || ''} onChange={e => setData({...data, citizenshipIssueDate: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="2075/05/10" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">PAN Number</label>
                    <input type="text" value={data.panNo || ''} onChange={e => setData({...data, panNo: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="PAN Number" />
                  </div>

                  <div className="col-span-full mt-1 px-3.5 py-2.5 bg-emerald-50/90 rounded-xl border border-emerald-200 text-emerald-900 text-[11px] font-medium flex items-center space-x-2">
                    <FileText size={15} className="text-emerald-600 shrink-0" />
                    <span>नागरिकता (Front & Back) तथा अन्य सम्पूर्ण आधिकारिक कागजातहरू तल <strong>खण्ड ८ (DOCUMENTS UPLOAD SECTION)</strong> बाट एकैठाउँ सुरक्षित रूपमा अपलोड र अवलोकन (View) गर्नुहोस्।</span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Employment Details */}
              <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg"><Briefcase size={14} /></div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    3. EMPLOYMENT DETAILS
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Employee ID / Code</label>
                    <input type="text" value={data.employeeCode || ''} onChange={e => setData({...data, employeeCode: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="EMP-101" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Designation</label>
                    <input type="text" value={data.designation || ''} onChange={e => setData({...data, designation: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Designation" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Department</label>
                    <input type="text" value={data.department || ''} onChange={e => setData({...data, department: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Department" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Branch / Location</label>
                    <select value={data.branchId || 'main'} onChange={e => setData({...data, branchId: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                      <option value="">Select Branch...</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Joining Date (BS / AD)</label>
                    <input type="text" value={data.joinedDate || ''} onChange={e => setData({...data, joinedDate: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="YYYY-MM-DD" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Employment Type</label>
                    <select value={data.employmentType || 'Permanent'} onChange={e => setData({...data, employmentType: e.target.value as any})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                      <option value="Permanent">Permanent</option>
                      <option value="Temporary">Contract / Temporary</option>
                      <option value="PartTime">Part Time</option>
                      <option value="Trainee">Trainee / Intern</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Reporting Manager</label>
                    <input type="text" value={data.reportingManager || ''} onChange={e => setData({...data, reportingManager: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Manager Name" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Work Location</label>
                    <input type="text" value={data.workLocation || ''} onChange={e => setData({...data, workLocation: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Head Office / Branch" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Employee Status</label>
                    <select value={data.status || 'Active'} onChange={e => setData({...data, status: e.target.value as any})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black">
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Terminated">Terminated</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Payroll & Bank Details */}
              <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg"><Building2 size={14} /></div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    4. PAYROLL & BANK DETAILS
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Bank Name</label>
                    <input type="text" value={data.bankName || ''} onChange={e => setData({...data, bankName: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="e.g. NIC Asia Bank" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Account Holder Name</label>
                    <input type="text" value={data.accountHolderName || data.fullName || ''} onChange={e => setData({...data, accountHolderName: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="As per bank record" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Account Number</label>
                    <input type="text" value={data.bankAccountNo || ''} onChange={e => setData({...data, bankAccountNo: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Bank Account Number" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Bank Branch</label>
                    <input type="text" value={data.bankBranch || ''} onChange={e => setData({...data, bankBranch: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Branch Name" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Basic Salary</label>
                    <input type="number" value={data.basicSalary || 0} onChange={e => setData({...data, basicSalary: Number(e.target.value)})} className="w-full h-8 bg-slate-900 border border-slate-700 rounded-lg px-3 font-mono font-black text-xs text-emerald-400 outline-none" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Grade Rate</label>
                    <input type="number" value={data.gradeRate || 0} onChange={e => setData({...data, gradeRate: Number(e.target.value)})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">D.A. Allowance</label>
                    <div className="flex items-center space-x-1">
                      <select value={data.daType || 'None'} onChange={e => setData({...data, daType: e.target.value as any})} className="h-8 bg-white border border-slate-300 rounded-lg px-1.5 font-bold text-xs outline-none text-black">
                        <option value="None">None</option>
                        <option value="Percentage">%</option>
                        <option value="Amount">Amt</option>
                      </select>
                      {data.daType !== 'None' && (
                        <input type="number" value={data.daValue || 0} onChange={e => setData({...data, daValue: Number(e.target.value)})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2 font-bold text-xs outline-none text-black" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Sanchit Leave (Days)</label>
                    <input type="number" value={data.sanchitLeaveDays || 0} onChange={e => setData({...data, sanchitLeaveDays: Number(e.target.value)})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" />
                  </div>
                </div>
              </div>

              {/* SECTION 5: Emergency Contact */}
              <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg"><Phone size={14} /></div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    5. EMERGENCY CONTACT
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Contact Person</label>
                    <input type="text" value={data.emergencyContact || ''} onChange={e => setData({...data, emergencyContact: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Contact Person's Name" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Relationship</label>
                    <input type="text" value={data.emergencyRelation || ''} onChange={e => setData({...data, emergencyRelation: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Relationship" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Mobile Number</label>
                    <input type="text" value={data.emergencyPhone || ''} onChange={e => setData({...data, emergencyPhone: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-mono font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Emergency Mobile" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Address</label>
                    <input type="text" value={data.emergencyAddress || ''} onChange={e => setData({...data, emergencyAddress: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Full Address" />
                  </div>
                </div>
              </div>

              {/* SECTION 6: Education & Experience */}
              <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg"><Award size={14} /></div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    6. EDUCATION & EXPERIENCE
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Highest Qualification</label>
                    <input type="text" value={data.qualification || ''} onChange={e => setData({...data, qualification: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Bachelor / Master / +2" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Institution / University</label>
                    <input type="text" value={data.institution || ''} onChange={e => setData({...data, institution: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Tribhuvan University / Board" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Passed Year</label>
                    <input type="text" value={data.passedYear || ''} onChange={e => setData({...data, passedYear: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="YYYY (2078 / 2021)" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Total Experience</label>
                    <input type="text" value={data.totalExperience || ''} onChange={e => setData({...data, totalExperience: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="e.g. 3 Years" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Previous Employer</label>
                    <input type="text" value={data.previousEmployer || ''} onChange={e => setData({...data, previousEmployer: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Previous Company Name" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Previous Designation</label>
                    <input type="text" value={data.previousDesignation || ''} onChange={e => setData({...data, previousDesignation: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="Previous Designation" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Joining Date</label>
                    <input type="text" value={data.expJoiningDate || ''} onChange={e => setData({...data, expJoiningDate: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="YYYY-MM-DD" />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Leaving Date</label>
                    <input type="text" value={data.expLeavingDate || ''} onChange={e => setData({...data, expLeavingDate: e.target.value})} className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 font-bold text-xs outline-none focus:border-emerald-600 text-black" placeholder="YYYY-MM-DD" />
                  </div>
                </div>
              </div>

              {/* SECTION 7: Verification & Declaration */}
              <div className="bg-emerald-50/80 p-4 md:p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-2">
                <div className="flex items-center space-x-2 border-b border-emerald-200 pb-2">
                  <div className="p-1.5 bg-emerald-700 text-white rounded-lg"><CheckCircle2 size={14} /></div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                    7. VERIFICATION & DECLARATION
                  </h4>
                </div>
                <div className="text-[10px] text-emerald-900 font-semibold leading-relaxed pt-1">
                  उपरोक्त उल्लेखित सम्पूर्ण व्यक्तिगत, पारिवारिक, शैक्षिक तथा सेवा सम्बन्धी विवरणहरू मेरो जानकारीमा सत्य र तथ्य छन्। यदि पछि विवरण फरक परेमा कानुन तथा संस्थाको नियमानुसार कारबाही भोग्न मञ्जुर गर्दछु।
                </div>
              </div>
              </DayEndFieldset>

              {/* SECTION 8: Unified Documents Upload & Verification Section */}
              <div className="bg-emerald-50/40 p-4 md:p-5 rounded-2xl border border-emerald-200/90 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-emerald-200/70 pb-3 gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs"><Upload size={16} /></div>
                    <div>
                      <h4 className="text-xs md:text-sm font-black uppercase tracking-wider text-emerald-950">
                        8. DOCUMENTS UPLOAD & VERIFICATION (कागजातहरू अपलोड र अवलोकन)
                      </h4>
                      <p className="text-[11px] text-emerald-800 font-medium">नागरिकता (अगाडि/पछाडि), राष्ट्रिय परिचयपत्र, प्यान लगायत सम्पूर्ण कागजातहरू यहाँबाट अपलोड गर्नुहोस् र फोटोमा क्लिक गरी तुरुन्त हेर्नुहोस्</p>
                    </div>
                  </div>
                  {/* Upload counter badge */}
                  <div className="self-start sm:self-center px-3 py-1 bg-white rounded-xl border border-emerald-300 shadow-xs text-xs font-black text-emerald-800 flex items-center space-x-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>
                      {[
                        data.citizenshipFrontUrl,
                        data.citizenshipBackUrl,
                        data.docsNid,
                        data.docsPan,
                        data.docsEducation,
                        data.docsExperience,
                        data.docsContract
                      ].filter(Boolean).length} / 7 कागजात प्राप्त
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {[
                    { title: 'Citizenship Front Photo', nepali: 'नागरिकता (अगाडि)', req: 'Required ✅', key: 'citizenshipFrontUrl' as keyof Employee },
                    { title: 'Citizenship Back Photo', nepali: 'नागरिकता (पछाडि)', req: 'Required ✅', key: 'citizenshipBackUrl' as keyof Employee },
                    { title: 'National ID (NID)', nepali: 'राष्ट्रिय परिचयपत्र', req: 'Optional', key: 'docsNid' as keyof Employee },
                    { title: 'PAN Card Copy', nepali: 'प्यान कार्ड', req: 'Required ✅', key: 'docsPan' as keyof Employee },
                    { title: 'Education Certificate', nepali: 'शैक्षिक प्रमाणपत्र', req: 'Company Policy', key: 'docsEducation' as keyof Employee },
                    { title: 'Experience Letter', nepali: 'अनुभव पत्र', req: 'Company Policy', key: 'docsExperience' as keyof Employee },
                    { title: 'Contract / Appointment Letter', nepali: 'नियुक्ति पत्र / सम्झौता', req: 'HR Record', key: 'docsContract' as keyof Employee }
                  ].map((doc) => {
                    const fileUrl = data[doc.key] as string | undefined;
                    const isPdf = fileUrl && (fileUrl.startsWith('data:application/pdf') || fileUrl.toLowerCase().endsWith('.pdf'));

                    return (
                      <div 
                        key={doc.key} 
                        className={`p-3.5 rounded-2xl border transition-all ${
                          fileUrl 
                            ? 'bg-white border-emerald-300 shadow-xs hover:border-emerald-500' 
                            : 'bg-white/90 border-slate-200 hover:border-slate-300'
                        } flex flex-col justify-between space-y-3`}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Thumbnail / Document Box */}
                          {fileUrl ? (
                            <div 
                              onClick={() => setPreviewDoc({ title: `${doc.title} (${doc.nepali})`, url: fileUrl })}
                              className="w-16 h-16 rounded-xl border-2 border-emerald-400 overflow-hidden shadow-xs cursor-pointer group relative shrink-0 bg-emerald-50 flex items-center justify-center transition-all hover:scale-105 hover:shadow-md"
                              title="Click to view full document (हेर्न क्लिक गर्नुहोस्)"
                            >
                              {!isPdf ? (
                                <img 
                                  src={fileUrl} 
                                  alt={doc.title} 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-emerald-800">
                                  <FileText size={22} className="text-emerald-600" />
                                  <span className="text-[8px] font-black uppercase mt-0.5">PDF</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-emerald-950/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                                <Eye size={16} />
                                <span className="text-[7px] font-black tracking-wider uppercase mt-0.5">View</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                              <FileUp size={20} className="text-slate-400" />
                              <span className="text-[8px] font-bold mt-0.5">No File</span>
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-900 block truncate">{doc.title}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${doc.req.includes('Required') ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                                {doc.req}
                              </span>
                            </div>
                            <span className="text-[11px] text-emerald-800 font-bold block">{doc.nepali}</span>

                            <div className="mt-1">
                              {fileUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc({ title: `${doc.title} (${doc.nepali})`, url: fileUrl })}
                                  className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-900 text-[10px] font-black transition-colors"
                                >
                                  <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                                  <span className="underline decoration-emerald-400 underline-offset-2">कागजात सुरक्षित (Click to view)</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">कागजात अपलोड गरिएको छैन</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end space-x-2 border-t border-slate-100 pt-2.5">
                          {fileUrl ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({ title: `${doc.title} (${doc.nepali})`, url: fileUrl })}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-xs active:scale-95"
                                title="View Document"
                              >
                                <Eye size={12} />
                                <span>हेर्नुहोस् (View)</span>
                              </button>

                              <label
                                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                                className={`px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1 ${isDayEnded ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <Upload size={11} />
                                <span>Replace</span>
                                <input 
                                  type="file" 
                                  accept="image/*,.pdf" 
                                  disabled={isDayEnded}
                                  onChange={handleFileUpload(doc.key)} 
                                  className="hidden" 
                                />
                              </label>

                              <button
                                type="button"
                                disabled={isDayEnded}
                                title={isDayEnded ? getDayEndedBlockMessage() : "Remove Document"}
                                onClick={() => handleRemoveFile(doc.key)}
                                className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <label
                              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                              className={`inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 ${isDayEnded ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <Upload size={12} />
                              <span>Upload Document</span>
                              <input 
                                type="file" 
                                accept="image/*,.pdf" 
                                disabled={isDayEnded}
                                onChange={handleFileUpload(doc.key)} 
                                className="hidden" 
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 bg-emerald-950/80 backdrop-blur-md z-[6000] flex items-center justify-center p-3 sm:p-6 no-print">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-emerald-500/40 flex flex-col max-h-[92vh] animate-in zoom-in-95">
              <div className="py-3 px-5 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center space-x-2.5">
                  <FileText size={18} />
                  <div>
                    <h4 className="text-xs md:text-sm font-black uppercase tracking-wider">{previewDoc.title}</h4>
                    <p className="text-[10px] text-emerald-200">कर्मचारी आधिकारिक कागजात पूर्वावलोकन</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={previewDoc.url}
                    download="employee_document"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase shadow-xs transition-all"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 hover:bg-white/20 rounded-xl transition-colors text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-slate-900/95 flex items-center justify-center min-h-[380px]">
                {previewDoc.url.startsWith('data:application/pdf') || previewDoc.url.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={previewDoc.url} title={previewDoc.title} className="w-full h-[72vh] rounded-xl border border-slate-700 bg-white" />
                ) : (
                  <img src={previewDoc.url} alt={previewDoc.title} className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-700" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Bar */}
        <div className="py-3 px-5 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2 ml-auto">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSaving}
              className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={() => !isDayEnded && onSave(data)} 
              disabled={isSaving || isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-xl font-black uppercase text-xs tracking-wider shadow-md transition-all active:scale-95 flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isSaving ? 'SAVING TO SUPABASE...' : (data.id ? 'UPDATE RECORD' : 'SAVE RECORD')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

const EmployeePaySlipList = ({ 
  employees, 
  onView, 
  selectedYear, 
  selectedMonth, 
  payrollRecords, 
  settings, 
  taxConfig,
  showDashain,
  showBonus,
  showSanchit,
  showMedical,
  showDress
}: any) => {
  const [filter, setFilter] = useState('');
  const [sendingEmployeeId, setSendingEmployeeId] = useState<string | null>(null);
  const [missingEmailEmp, setMissingEmailEmp] = useState<any>(null);
  
  // SMTP Config state
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [smtpForm, setSmtpForm] = useState<SmtpConfig>(() => {
    return getStoredSmtpConfig() || {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: '',
      pass: '',
      from: 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड <info.rataulisaccos@gmail.com>'
    };
  });

  // Target employee currently being rendered for PDF offscreen capture
  const [targetPdfEmp, setTargetPdfEmp] = useState<any>(null);

  // Bulk Email State
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkStatusModal, setBulkStatusModal] = useState<{
    isOpen: boolean;
    total: number;
    current: number;
    currentEmpName: string;
    successCount: number;
    failCount: number;
    isFinished: boolean;
    logs: Array<{ id: string; name: string; email: string; status: 'pending' | 'sending' | 'success' | 'failed'; message?: string }>;
  } | null>(null);

  // Success / Error status notification modal
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    success: boolean;
    title: string;
    message: string;
  } | null>(null);

  const filtered = employees
    .filter((e: any) => e.status === 'Active')
    .sort((a: any, b: any) => {
      const codeA = String(a.employeeCode || a.id || '');
      const codeB = String(b.employeeCode || b.id || '');
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

  // Helper to construct a complete, itemized slip with all benefits and exact headings
  const getCompleteSlip = (e: any, y: string, m: string): PayrollRecord => {
    const calcData = taxConfig ? calculateDetailedPayroll(e, taxConfig, m) : null;
    const matchedRec = payrollRecords?.find((r: any) => 
      r.employeeId === e.id && r.year === y && r.month === m
    );

    const isEffectiveDashain = matchedRec?.showDashain ?? (matchedRec?.dashainBonus ? true : Boolean(showDashain));
    const isEffectiveBonus = matchedRec?.showBonus ?? (matchedRec?.bonusAmount ? true : Boolean(showBonus));
    const isEffectiveSanchit = matchedRec?.showSanchit ?? (matchedRec?.sanchitLeaveAmount ? true : Boolean(showSanchit));
    const isEffectiveMedical = matchedRec?.showMedical ?? (matchedRec?.medicalAllowance ? true : Boolean(showMedical));
    const isEffectiveDress = matchedRec?.showDress ?? (matchedRec?.dressAllowance ? true : Boolean(showDress));

    const basicSalary = matchedRec?.basicSalary ?? matchedRec?.basic ?? e.basicSalary ?? 0;
    const allowance = matchedRec?.allowance ?? (calcData?.monthly?.da || 0);
    const gradeAmt = matchedRec?.gradeAmt ?? matchedRec?.grade ?? (calcData?.monthly?.grade || 0);

    const dashainBonus = matchedRec?.dashainBonus ?? (isEffectiveDashain ? (calcData?.lumpsum?.dashain || 0) : 0);
    const bonusAmount = matchedRec?.bonusAmount ?? (isEffectiveBonus ? (calcData?.lumpsum?.bonus || 0) : 0);
    const sanchitLeaveAmount = matchedRec?.sanchitLeaveAmount ?? (isEffectiveSanchit ? (calcData?.lumpsum?.festival || 0) : 0);
    const medicalAllowance = matchedRec?.medicalAllowance ?? (isEffectiveMedical ? (calcData?.lumpsum?.medical || 0) : 0);
    const dressAllowance = matchedRec?.dressAllowance ?? (isEffectiveDress ? (calcData?.lumpsum?.dress || 0) : 0);

    const extraIncome = dashainBonus + bonusAmount + sanchitLeaveAmount + medicalAllowance + dressAllowance;

    const ssfEmployee = matchedRec?.ssfEmployee ?? (basicSalary * 0.20);
    const pfEmployee = matchedRec?.pfEmployee ?? (basicSalary * 0.10);
    const gratuity = matchedRec?.gratuity ?? (basicSalary * 0.0833);

    const totalIncome = matchedRec?.totalIncome ?? matchedRec?.grossTotal ?? ((calcData?.monthly?.monthlyGross || (basicSalary + allowance + gradeAmt + ssfEmployee + pfEmployee + gratuity)) + extraIncome);

    const ssfEmployer = matchedRec?.ssfEmployer ?? (basicSalary * 0.31);
    const pfEmployer = matchedRec?.pfEmployer ?? (basicSalary * 0.20);
    const tax = matchedRec?.tax ?? (calcData?.tax?.monthlyTax || 0);
    const totalDeduction = ssfEmployer + pfEmployer + gratuity + tax;
    const netSalary = matchedRec?.netSalary ?? matchedRec?.netPay ?? (totalIncome - totalDeduction);

    return {
      id: matchedRec?.id || ('slip-' + e.id),
      employeeId: e.id,
      month: m,
      year: y,
      basicSalary,
      gradeAmt,
      allowance,
      dashainBonus,
      bonusAmount,
      sanchitLeaveAmount,
      medicalAllowance,
      dressAllowance,
      showDashain: isEffectiveDashain,
      showBonus: isEffectiveBonus,
      showSanchit: isEffectiveSanchit,
      showMedical: isEffectiveMedical,
      showDress: isEffectiveDress,
      ssfEmployee,
      pfEmployee,
      gratuity,
      totalIncome,
      ssfEmployer,
      pfEmployer,
      tax,
      netSalary,
      generatedDate: matchedRec?.generatedDate || Date.now(),
      status: 'Paid',
      preparedBy: matchedRec?.preparedBy || 'System Registry',
      approvedBy: matchedRec?.approvedBy || '',
      branchId: e.branchId || null
    };
  };

  const handleSendAllEmails = async () => {
    const activeWithEmail = filtered.filter((e: any) => e.email && e.email.trim().length > 0);
    const activeWithoutEmail = filtered.filter((e: any) => !e.email || e.email.trim().length === 0);

    if (activeWithEmail.length === 0) {
      alert("कुनै पनि सक्रिय कर्मचारीको प्रोफाइलमा ईमेल ठेगाना फेला परेन। कृपया पहिले Employee Directory मा ईमेल ठेगाना थप्नुहोस्।");
      return;
    }

    const year = selectedYear || '२०८३/२०८४';
    const month = selectedMonth || 'साउन';

    const initialLogs = filtered.map((e: any) => ({
      id: e.id,
      name: e.fullName,
      email: e.email ? e.email.trim() : 'ईमेल छैन (Missing)',
      status: e.email ? ('pending' as const) : ('failed' as const),
      message: e.email ? 'प्रतिक्षामा...' : 'ईमेल ठेगाना उपलब्ध छैन'
    }));

    setBulkStatusModal({
      isOpen: true,
      total: activeWithEmail.length,
      current: 0,
      currentEmpName: '',
      successCount: 0,
      failCount: activeWithoutEmail.length,
      isFinished: false,
      logs: initialLogs
    });

    setIsBulkSending(true);

    let successAcc = 0;
    let failAcc = activeWithoutEmail.length;

    for (let idx = 0; idx < activeWithEmail.length; idx++) {
      const e = activeWithEmail[idx];

      setBulkStatusModal((prev: any) => {
        if (!prev) return null;
        const updatedLogs = prev.logs.map((log: any) => 
          log.id === e.id ? { ...log, status: 'sending', message: 'PDF तयार गर्दै र पठाउँदै...' } : log
        );
        return {
          ...prev,
          current: idx + 1,
          currentEmpName: e.fullName,
          logs: updatedLogs
        };
      });

      setTargetPdfEmp(e);
      await new Promise((res) => setTimeout(res, 350));

      const slipForEmail = getCompleteSlip(e, year, month);
      const emailContent = buildPaySlipEmailContent({
        emp: e,
        slip: slipForEmail,
        year,
        month,
        settings
      });

      try {
        const renderEl = document.getElementById("pdf-offscreen-target");
        let pdfBase64 = "";
        if (renderEl) {
          pdfBase64 = await generateElementPdfBase64(renderEl, `Pay_Slip_${e.fullName}.pdf`);
        }

        const res = await sendPaySlipApi({
          to: e.email.trim(),
          subject: emailContent.subject,
          body: emailContent.body,
          html: emailContent.html,
          pdfBase64,
          filename: emailContent.filename,
          smtpConfig: getStoredSmtpConfig()
        });

        if (res.requiresConfig) {
          setIsSmtpModalOpen(true);
          setBulkStatusModal((prev: any) => prev ? {
            ...prev,
            isFinished: true,
            logs: prev.logs.map((log: any) => log.id === e.id ? { ...log, status: 'failed', message: 'SMTP कन्फिगरेसन आवश्यक' } : log)
          } : null);
          setIsBulkSending(false);
          return;
        }

        if (res.success) {
          successAcc++;
          setBulkStatusModal((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              successCount: successAcc,
              logs: prev.logs.map((log: any) => log.id === e.id ? { ...log, status: 'success', message: 'सफलतापूर्वक पठाइयो' } : log)
            };
          });
        } else {
          failAcc++;
          setBulkStatusModal((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              failCount: failAcc,
              logs: prev.logs.map((log: any) => log.id === e.id ? { ...log, status: 'failed', message: res.message || 'पठाउन सकिएन' } : log)
            };
          });
        }
      } catch (err: any) {
        failAcc++;
        setBulkStatusModal((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            failCount: failAcc,
            logs: prev.logs.map((log: any) => log.id === e.id ? { ...log, status: 'failed', message: err?.message || 'त्रुटि भयो' } : log)
          };
        });
      }

      await new Promise((res) => setTimeout(res, 250));
    }

    setBulkStatusModal((prev: any) => prev ? { ...prev, isFinished: true } : null);
    setIsBulkSending(false);
  };

  const handleSendEmail = async (e: any) => {
    const email = (e.email || '').trim();
    if (!email) {
      setMissingEmailEmp(e);
      return;
    }

    setSendingEmployeeId(e.id);
    setTargetPdfEmp(e);

    const year = selectedYear || '२०८३/२०८४';
    const month = selectedMonth || 'साउन';
    const slipForEmail = getCompleteSlip(e, year, month);
    const emailContent = buildPaySlipEmailContent({
      emp: e,
      slip: slipForEmail,
      year,
      month,
      settings
    });

    // Wait a brief tick for offscreen DOM to update
    await new Promise((res) => setTimeout(res, 250));

    try {
      const renderEl = document.getElementById("pdf-offscreen-target");
      let pdfBase64 = "";
      if (renderEl) {
        pdfBase64 = await generateElementPdfBase64(renderEl, `Pay_Slip_${e.fullName}.pdf`);
      }

      const res = await sendPaySlipApi({
        to: email,
        subject: emailContent.subject,
        body: emailContent.body,
        html: emailContent.html,
        pdfBase64,
        filename: emailContent.filename,
        smtpConfig: getStoredSmtpConfig()
      });

      if (res.requiresConfig) {
        setIsSmtpModalOpen(true);
        setStatusModal({
          isOpen: true,
          success: false,
          title: "SMTP (ईमेल पठाउने एकाउन्ट) सेटिङ आवश्यक",
          message: res.message || "स्वचालित ईमेल पठाउन Sender Email र App Password प्रविष्ट गर्नुहोस्।"
        });
      } else if (res.success) {
        setStatusModal({
          isOpen: true,
          success: true,
          title: "PDF ईमेल सफलतापुर्वक पठाइयो!",
          message: `कर्मचारी ${e.fullName} को ईमेल (${email}) मा पे-स्लिप PDF र पूर्ण विवरण तालिका सफ्टवेयरबाटै पठाइयो।`
        });
      } else {
        setStatusModal({
          isOpen: true,
          success: false,
          title: "ईमेल पठाउन असफल",
          message: res.message || "ईमेल पठाउन सकिएन। कृपया SMTP लगइन जानकारी जाँच गर्नुहोस्।"
        });
      }
    } catch (err: any) {
      console.error(err);
      setStatusModal({
        isOpen: true,
        success: false,
        title: "त्रुटि भयो",
        message: err?.message || "PDF जेनेरेट वा ईमेल पठाउँदा समस्या आयो।"
      });
    } finally {
      setSendingEmployeeId(null);
    }
  };

  const handleSaveSmtp = () => {
    if (!smtpForm.user || !smtpForm.pass) {
      alert("कृपया Sender Email र Password/App Key अनिवार्य भर्नुहोस्।");
      return;
    }
    saveSmtpConfig(smtpForm);
    setIsSmtpModalOpen(false);
    setStatusModal({
      isOpen: true,
      success: true,
      title: "SMTP सेटिङ सेभ भयो!",
      message: `अब स्वचालित रूपमा ${smtpForm.user} बाट कर्मचारीहरूलाई Pay Slip PDF ईमेल जानेछ।`
    });
  };

  const currentYear = selectedYear || '२०८३/२०८४';
  const currentMonth = selectedMonth || 'साउन';
  const targetPdfSlip: PayrollRecord | null = targetPdfEmp ? getCompleteSlip(targetPdfEmp, currentYear, currentMonth) : null;

  return (
    <div className="flex flex-col h-full bg-white font-bold text-[#000000]">
      {/* Offscreen Pay Slip Container using official HR SalarySlipPrintView */}
      <div className="fixed left-[-9999px] top-[-9999px] z-[-100]">
        <div id="pdf-offscreen-target" className="bg-white p-6 w-[750px] text-slate-900 border border-slate-300">
          {targetPdfEmp && targetPdfSlip && (
            <SalarySlipPrintView
              slip={targetPdfSlip}
              employee={targetPdfEmp}
              settings={settings}
              employees={employees}
            />
          )}
        </div>
      </div>

      {/* Top Header Controls */}
      <div className="px-4 py-2 flex justify-end items-center bg-slate-50 border-b shrink-0 no-print">
        <button 
          onClick={handleSendAllEmails}
          disabled={isBulkSending || !!sendingEmployeeId}
          className="flex items-center space-x-2 bg-[#3b8754] hover:bg-[#2e6d42] text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <Mail size={13} />
          <span>{isBulkSending ? 'SENDING ALL...' : 'SEND ALL EMAIL'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto scrollbar-hide">
        <table className="w-full text-[10px] font-bold border-collapse min-w-max">
          <thead className="sticky top-0 z-10 no-print">
            <tr className="bg-slate-900 text-white uppercase text-[8px] tracking-widest h-8 shadow-sm">
              <th className="p-3 text-center border-r border-white/5 w-14">S.N.</th>
              <th className="p-3 text-left border-r border-white/5 min-w-[200px]">Full Legal Name</th>
              <th className="p-3 text-left border-r border-white/5 min-w-[180px]">Designation</th>
              <th className="p-3 text-center border-r border-white/5 w-32">Basic Scale</th>
              <th className="p-3 text-center border-r border-white/5 w-32">PAN No.</th>
              <th className="p-3 text-center border-r border-white/5 w-40">Slip Action</th>
              <th className="p-3 text-center w-40">Send Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[#000000]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-300 uppercase tracking-widest font-black italic">No employee records found</td>
              </tr>
            ) : (
              filtered.map((e: any, i: number) => {
                const isSending = sendingEmployeeId === e.id;
                return (
                  <tr key={e.id} className="h-9 hover:bg-blue-50/50 transition-all">
                    <td className="py-1 px-3 text-center border-r border-slate-100 italic text-slate-400">{i + 1}</td>
                    <td className="py-1 px-3 text-left border-r border-slate-100 font-black">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                          {e.photoUrl ? <img src={e.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserIcon size={11}/>}
                        </div>
                        <span className="font-bold uppercase tracking-tighter text-[10px]">{e.fullName}</span>
                      </div>
                    </td>
                    <td className="py-1 px-3 text-left border-r border-slate-100 uppercase">{e.designation}</td>
                    <td className="py-1 px-3 text-center border-r border-slate-100 font-sans italic">रू {e.basicSalary.toLocaleString()}</td>
                    <td className="py-1 px-3 text-center border-r border-slate-100 font-mono italic text-slate-500">{e.panNo || '-'}</td>
                    <td className="py-1 px-3 text-center border-r border-slate-100">
                      <button onClick={() => onView(e.id)} className="inline-flex items-center justify-center space-x-2 bg-slate-950 text-white w-28 py-1 rounded-lg text-[8px] uppercase tracking-widest font-black hover:bg-blue-600 transition-all shadow active:scale-95">
                        <FileText size={14}/>
                        <span>View Slip</span>
                      </button>
                    </td>
                    <td className="py-1 px-3 text-center">
                      <button 
                        onClick={() => handleSendEmail(e)} 
                        disabled={isSending}
                        className={`inline-flex items-center justify-center space-x-2 text-white w-28 py-1 rounded-lg text-[8px] uppercase tracking-widest font-black transition-all shadow active:scale-95 ${
                          isSending ? 'bg-amber-600 animate-pulse' : 'bg-blue-600 hover:bg-slate-900'
                        }`}
                      >
                        <Mail size={14}/>
                        <span>{isSending ? 'Sending PDF...' : 'Email Send'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Missing Email Alert Modal */}
      {missingEmailEmp && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-amber-500 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <ShieldAlert size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Email Address Missing</h3>
                  <p className="text-[11px] text-amber-100 font-medium">ईमेल ठेगाना उपलब्ध छैन</p>
                </div>
              </div>
              <button onClick={() => setMissingEmailEmp(null)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-800">
              <p className="font-bold text-sm text-slate-900">
                कर्मचारी <u>{missingEmailEmp.fullName}</u> को KYC / Employee Profile मा ईमेल ठेगाना थपिएको छैन।
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-[11.5px] leading-relaxed text-amber-900">
                <div className="font-bold text-amber-950 flex items-center space-x-1.5">
                  <AlertCircle size={15} />
                  <span>ईमेल कसरी थप्ने?</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 font-medium text-slate-700">
                  <li>बाईं तर्फको <b>HR Management</b> मेनू खोलि <b>Employee Directory</b> मा जानुहोस्।</li>
                  <li><b>{missingEmailEmp.fullName}</b> को दायाँ पट्टी रहेको <b>Edit (पेंसिल)</b> आइकनमा थिच्नुहोस्।</li>
                  <li><b>Email Address</b> को कोठामा कर्मचारीको ईमेल (उदा: example@gmail.com) टाइप गरी <b>UPDATE</b> गर्नुहोस।</li>
                </ol>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button onClick={() => setMissingEmailEmp(null)} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all">
                बुझें (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Email Progress Modal */}
      {bulkStatusModal && bulkStatusModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-emerald-800 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Mail size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">सबै कर्मचारीलाई पे-स्लिप पठाउँदै...</h3>
                  <p className="text-[11px] text-emerald-100 font-medium">Bulk Pay Slip Email Progress Tracker</p>
                </div>
              </div>
              {bulkStatusModal.isFinished && (
                <button onClick={() => setBulkStatusModal(null)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="p-6 space-y-5">
              {/* Progress Bar Header */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center font-bold text-xs">
                  <span className="text-slate-800">
                    प्रगति: {bulkStatusModal.current} / {bulkStatusModal.total}
                  </span>
                  <span className="text-emerald-700 font-black">
                    {Math.round((bulkStatusModal.current / (bulkStatusModal.total || 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(bulkStatusModal.current / (bulkStatusModal.total || 1)) * 100}%` }}
                  />
                </div>
                {bulkStatusModal.currentEmpName && !bulkStatusModal.isFinished && (
                  <p className="text-[11px] font-bold text-slate-600 animate-pulse">
                    वर्तमान कर्मचारी: <span className="text-slate-900 font-black">{bulkStatusModal.currentEmpName}</span> को पे-स्लिप पठाउँदै...
                  </p>
                )}
              </div>

              {/* Status Table Log */}
              <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr className="border-b border-slate-200">
                      <th className="p-2.5">कर्मचारीको नाम</th>
                      <th className="p-2.5">ईमेल ठेगाना</th>
                      <th className="p-2.5 text-center">अवस्था</th>
                      <th className="p-2.5">विवरण</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {bulkStatusModal.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{log.name}</td>
                        <td className="p-2.5 text-slate-600 font-mono text-[11px]">{log.email}</td>
                        <td className="p-2.5 text-center">
                          {log.status === 'pending' && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">प्रतिक्षामा</span>}
                          {log.status === 'sending' && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold animate-pulse">पठाउँदै...</span>}
                          {log.status === 'success' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">सफल ✅</span>}
                          {log.status === 'failed' && <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">असफल ❌</span>}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-500">{log.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
              <div className="text-xs font-bold text-slate-700">
                सफलता: <span className="text-emerald-700 font-black">{bulkStatusModal.successCount}</span> | 
                असफलता/ईमेल नभएको: <span className="text-rose-600 font-black">{bulkStatusModal.failCount}</span>
              </div>
              {bulkStatusModal.isFinished && (
                <button 
                  onClick={() => setBulkStatusModal(null)} 
                  className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  सम्पन्न भयो (Close)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SMTP Email Config Modal */}
      {isSmtpModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md">
                  <LucideSettings size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">SMTP Email Configuration</h3>
                  <p className="text-[11px] text-slate-300 font-medium">सहकारीको आधिकारिक ईमेल पठाउने खाता सेटअप</p>
                </div>
              </div>
              <button onClick={() => setIsSmtpModalOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start space-x-3 text-[11px] text-blue-900 font-medium">
                <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <b>Gmail प्रयोग गर्दा:</b> <br />
                  १. आफ्नो Gmail मा 2-Step Verification अन गर्नुहोस्। <br />
                  २. Google Account &gt; Security &gt; <b>App Passwords</b> मा गई १६ अक्षरको एप पासवर्ड जेनेरेट गर्नुहोस्। <br />
                  ३. यहाँ Sender Email र उक्त App Password राखेपछि सिधै कर्मचारीहरूको ईमेलमा PDF संलग्न भई जानेछ।
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Sender Email (पठाउने ईमेल)*</label>
                  <input 
                    type="email" 
                    placeholder="e.g. cooperative.ratauli@gmail.com" 
                    value={smtpForm.user}
                    onChange={e => setSmtpForm({ ...smtpForm, user: e.target.value })}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Gmail App Password / Key (१६ अक्षरको पासवर्ड)*</label>
                  <input 
                    type="password" 
                    placeholder="e.g. abcd efgh ijkl mnop" 
                    value={smtpForm.pass}
                    onChange={e => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">SMTP Host</label>
                  <input 
                    type="text" 
                    value={smtpForm.host}
                    onChange={e => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">SMTP Port</label>
                  <input 
                    type="number" 
                    value={smtpForm.port}
                    onChange={e => setSmtpForm({ ...smtpForm, port: Number(e.target.value) })}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Sender Title / Header</label>
                  <input 
                    type="text" 
                    value={smtpForm.from}
                    onChange={e => setSmtpForm({ ...smtpForm, from: e.target.value })}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end space-x-2">
              <button onClick={() => setIsSmtpModalOpen(false)} className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                रद्द (Cancel)
              </button>
              <button onClick={handleSaveSmtp} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-2">
                <Save size={14} />
                <span>SAVE SMTP SETTINGS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Alert Modal */}
      {statusModal?.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-100 shadow-2xl overflow-hidden p-6 text-center animate-in zoom-in-95 duration-200">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              statusModal.success ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}>
              {statusModal.success ? (
                <Check size={32} strokeWidth={3} />
              ) : (
                <AlertCircle size={32} strokeWidth={2.5} />
              )}
            </div>

            <h3 className="font-bold text-lg text-slate-800 mb-6 leading-snug">
              {statusModal.success ? 'Email was successfully sent!' : statusModal.message}
            </h3>

            <div className="flex justify-center">
              <button 
                onClick={() => setStatusModal(null)} 
                className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95 ${
                  statusModal.success
                    ? 'bg-[#3b8754] hover:bg-[#2e6d42] text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SlipRecordsList = ({ records, employees = [], branchId, onViewRun, onReload }: { records: PayrollRecord[], employees?: any[], branchId?: string, onViewRun: (y: string, m: string) => void, onReload: () => void }) => {
  const isDayEnded = useDayEndLock(branchId);
  const validRecords = useMemo(() => {
    if (!records || !Array.isArray(records)) return [];
    if (!employees || employees.length === 0) return records;
    return records.filter(r => employees.some((e: any) => e.id === r.employeeId));
  }, [records, employees]);

  const groupedRuns = useMemo(() => {
    const runs: Record<string, { year: string, month: string }> = {};
    validRecords.forEach(r => {
      if (r.year && r.month) {
        const key = `${r.year}-${r.month}`;
        runs[key] = { year: r.year, month: r.month };
      }
    });
    return Object.values(runs).sort((a,b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      return NEPALI_MONTHS.indexOf(b.month) - NEPALI_MONTHS.indexOf(a.month);
    });
  }, [validRecords]);

  const handleDeleteRun = async (year: string, month: string) => {
    if (isDayEnded) return;
    if (window.confirm(`Are you sure you want to delete the payroll sheet and linked Teller Ledger entries for ${year} ${month}?`)) {
      await storageService.deletePayrollRun(year, month);
      onReload();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white font-bold text-[#000000]">
      <div className="px-4 py-2 flex justify-between items-center bg-slate-50 border-b shrink-0 no-print">
        <div className="flex items-center space-x-3">
          <History size={18} className="text-blue-600" />
          <h3 className="font-black text-[11px] uppercase italic tracking-tighter text-slate-900">Archived Payroll Registry</h3>
        </div>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">COMMITTED MONTHLY RUNS</p>
      </div>
      <div className="flex-1 overflow-auto scrollbar-hide">
        <table className="w-full text-[10px] font-bold border-collapse min-w-max">
          <thead className="sticky top-0 z-10 no-print">
            <tr className="bg-slate-900 text-white uppercase text-[8px] tracking-widest h-8 shadow-sm">
              <th className="p-3 text-center border-r border-white/5 w-20">S.N.</th>
              <th className="p-3 text-center border-r border-white/5 w-40">Fiscal Year</th>
              <th className="p-3 text-center border-r border-white/5 w-40">Month</th>
              <th className="p-3 text-center border-r border-white/5 w-40">Staff Count</th>
              <th className="p-3 text-center border-r border-white/5 w-48">View Full Sheet</th>
              <th className="p-3 text-center w-32">Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[#000000]">
            {groupedRuns.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-24 text-center">
                  <ScrollText size={48} className="text-slate-100 mx-auto mb-4" />
                  <p className="text-slate-300 uppercase tracking-widest font-black italic">No archived payroll runs detected</p>
                </td>
              </tr>
            ) : (
              groupedRuns.map((run, i) => {
                const count = validRecords.filter(r => r.year === run.year && r.month === run.month).length;
                return (
                  <tr key={i} className="h-9 hover:bg-slate-50 transition-all italic">
                    <td className="py-1 px-3 text-center border-r border-slate-100 text-slate-400">{i + 1}</td>
                    <td className="py-1 px-3 text-center border-r border-slate-100 font-sans text-xs">{run.year}</td>
                    <td className="py-1 px-3 text-center border-r border-slate-100 text-xs">{run.month}</td>
                    <td className="py-1 px-3 text-center border-r border-slate-100">
                      <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black">{count} Employee</span>
                    </td>
                    <td className="py-1 px-3 text-center border-r border-slate-100">
                      <button 
                        onClick={() => onViewRun(run.year, run.month)} 
                        className="inline-flex items-center justify-center space-x-2 bg-slate-900 text-white px-4 py-1 rounded-lg text-[8px] uppercase tracking-widest font-black hover:bg-blue-600 transition-all shadow-sm"
                      >
                        <Eye size={14}/>
                        <span>View / Print Sheet</span>
                      </button>
                    </td>
                    <td className="py-1 px-3 text-center">
                      <button 
                        disabled={isDayEnded}
                        title={isDayEnded ? getDayEndedBlockMessage() : "Delete Payroll Run"}
                        onClick={() => handleDeleteRun(run.year, run.month)}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PayrollSettings = ({ employees, settings, branchId }: { employees: Employee[], settings: any, branchId?: string }) => {
  const isDayEnded = useDayEndLock(branchId);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('Appointment / Offer Letter');
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [customContent, setCustomContent] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Document Categories Management
  const STORAGE_KEY_CATEGORIES = 'ratauli_hr_doc_categories_list_v2';
  const DEFAULT_CATEGORIES = [
    "Appointment / Offer Letter",
    "Confirmation Letter",
    "Promotion / Transfer Letter",
    "Warning / Show Cause Notice",
    "Termination / Resignation Acceptance",
    "Salary Certificate / Experience Letter",
    "Leave Approval Documents"
  ];

  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CATEGORIES;
  });

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Signatory Details Management (kasko name rakhne, pad, center aligned)
  const STORAGE_KEY_SIGNATORY = 'ratauli_hr_doc_signatory_v2';
  const [signatoryName, setSignatoryName] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SIGNATORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.name ?? 'चन्द्र शेखर मण्डल';
      }
    } catch (e) {}
    return 'चन्द्र शेखर मण्डल';
  });

  const [signatoryDesignation, setSignatoryDesignation] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SIGNATORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.designation ?? 'प्रबन्धक / मानव संशाधन प्रबन्धक';
      }
    } catch (e) {}
    return 'प्रबन्धक / मानव संशाधन प्रबन्धक';
  });

  const STORAGE_KEY_TEMPLATES = 'ratauli_hr_official_doc_templates_v2';

  // Default Templates for Customization
  const getTemplate = (type: string) => {
    switch(type) {
      case "Appointment / Offer Letter":
        return "तपाईंलाई हाम्रो संस्थाको रिक्त रहेको पदमा नियुक्त गरिएको सहर्ष जानकारी गराउँदछौं। संस्थाको नियमावली अनुसार तपाईंको पारिश्रमिक र सेवा सुविधाहरू तोकिएको बमोजिम हुनेछ। तपाईंले संस्थाको नीति र अनुशासनको पूर्ण पालना गर्नुहुनेछ भन्ने विश्वास लिएका छौं।";
      case "Confirmation Letter":
        return "तपाईंको कार्यसम्पादनको मूल्याङ्कन पश्चात् तपाईंको सेवालाई स्थायी (Confirm) गरिएको जानकारी गराउँदछौं। तपाईंको भविष्यको कार्यकाल अझ सफल रहनेछ भन्ने हाम्रो विश्वास छ।";
      case "Promotion / Transfer Letter":
        return "तपाईंको लगनशीलता र मेहनतको कदर गर्दै तपाईंलाई नयाँ पद/जिम्मेवारीमा पदोन्नति/सरुवा गरिएको छ। नयाँ जिम्मेवारीले संस्थाको लक्ष्य प्राप्तिमा मद्दत पुग्नेछ भन्ने अपेक्षा गरिएको छ।";
      case "Warning / Show Cause Notice":
        return "तपाईंको कार्य र व्यवहार संस्थाको आचारसंहिता विपरीत पाइएको हुनाले यो सचेत गराउने पत्र (Warning Letter) जारी गरिएको छ। यस विषयमा आफ्नो स्पष्टीकरण ३ दिन भित्र पेश गर्नुहुन सूचित गरिन्छ।";
      case "Termination / Resignation Acceptance":
        return "तपाईंले दिनुभएको राजीनामा स्वीकृत गरिएको छ। तपाईंको सेवा प्रति संस्था धन्यवाद व्यक्त गर्दछ र तपाईंको उज्ज्वल भविष्यको कामना गर्दछ।";
      case "Salary Certificate / Experience Letter":
        return "यो प्रमाणित गरिन्छ कि निज कर्मचारीले यस संस्थामा तोकिएको पदमा रही इमानदारीपूर्वक काम गर्नुभएको छ। कामको सिलसिलामा निजको व्यवहार र कार्यदक्षता सन्तोषजनक रहेको पाइएको छ।";
      case "Leave Approval Documents":
        return "तपाईंले माग गर्नुभएको बिदा स्वीकृत गरिएको छ। बिदाको अवधि समाप्त भए पश्चात समयमै कार्यालय उपस्थित हुन सूचित गरिन्छ।";
      default:
        return "तपाईंलाई हाम्रो संस्थाको रिक्त रहेको पदमा नियुक्त गरिएको सहर्ष जानकारी गराउँदछौं। संस्थाको नियमावली अनुसार तपाईंको पारिश्रमिक र सेवा सुविधाहरू तोकिएको बमोजिम हुनेछ।";
    }
  };

  const getSavedTemplates = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error("Error loading saved doc templates:", e);
    }
    return {};
  };

  // Load custom content on document type change
  useEffect(() => {
    const saved = getSavedTemplates();
    if (saved[selectedDocType] && saved[selectedDocType].trim()) {
      setCustomContent(saved[selectedDocType]);
      setIsSaved(true);
    } else {
      setCustomContent(getTemplate(selectedDocType));
      setIsSaved(false);
    }
  }, [selectedDocType]);

  const handleSaveTemplate = () => {
    if (isDayEnded) return;
    if (!customContent.trim()) {
      alert("कृपया सुरक्षित गर्न पत्रको बेहोरा लेख्नुहोस् !");
      return;
    }
    try {
      const saved = getSavedTemplates();
      saved[selectedDocType] = customContent;
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(saved));

      // Also save signatory details
      localStorage.setItem(STORAGE_KEY_SIGNATORY, JSON.stringify({
        name: signatoryName,
        designation: signatoryDesignation
      }));

      setIsSaved(true);
      setSaveStatusMsg("कागजातको बेहोरा तथा हस्ताक्षरकर्ता सुरक्षित भयो!");
      setTimeout(() => setSaveStatusMsg(""), 3500);
    } catch (e) {
      console.error("Error saving doc template:", e);
      alert("सुरक्षित गर्न सकिएन।");
    }
  };

  const handleResetTemplate = () => {
    if (isDayEnded) return;
    if (confirm("के तपाईं यस कागजातको बेहोरा पूर्ववत (Default) बनाउन चाहनुहुन्छ?")) {
      const def = getTemplate(selectedDocType);
      setCustomContent(def);
      try {
        const saved = getSavedTemplates();
        delete saved[selectedDocType];
        localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(saved));
      } catch (e) {
        console.error(e);
      }
      setIsSaved(false);
      setSaveStatusMsg("Default बेहोरा लोड गरियो।");
      setTimeout(() => setSaveStatusMsg(""), 3000);
    }
  };

  const handleAddCategory = () => {
    if (isDayEnded) return;
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setSelectedDocType(trimmed);
      setIsAddingCategory(false);
      setNewCategoryInput('');
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    try {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setSelectedDocType(trimmed);
    setIsAddingCategory(false);
    setNewCategoryInput('');
    setSaveStatusMsg(`नयाँ कागजात वर्ग '${trimmed}' थपियो!`);
    setTimeout(() => setSaveStatusMsg(""), 3000);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    if (isDayEnded) return;
    if (categories.length <= 1) {
      alert("कम्तीमा एक कागजात वर्ग हुनुपर्दछ!");
      return;
    }
    if (confirm(`के तपाईं '${catToDelete}' कागजात वर्ग हटाउन चाहनुहुन्छ?`)) {
      const updated = categories.filter(c => c !== catToDelete);
      setCategories(updated);
      try {
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      if (selectedDocType === catToDelete) {
        setSelectedDocType(updated[0]);
      }
    }
  };

  const orgNameNp = "रतौली बचत तथा ऋण सहकारी संस्था लि.";
  const orgNameEn = "Ratauli Saving & Credit Co-operative Ltd.";
  const orgAddressNp = "पिपरा गाउँपालिका -६, महोत्तरी";

  const handleSendEmail = async () => {
    if (!selectedEmpId) {
      alert("कृपया पहिले कर्मचारी छान्नुहोस् !");
      return;
    }
    if (!customContent.trim()) {
      alert("कृपया पत्रको बेहोरा लेख्नुहोस् !");
      return;
    }
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) {
      alert("कर्मचारी फेला परेन !");
      return;
    }
    if (!emp.email || !emp.email.trim()) {
      alert(`कर्मचारी ${emp.fullName} को प्रोफाइलमा कुनै पनि ईमेल ठेगाना भेटिएन।\nकृपया पहिले Employee Management मा गई कर्मचारीको ईमेल ठेगाना प्रविष्ट गर्नुहोस्।`);
      return;
    }

    // Auto-save the content and signatory
    if (!isDayEnded) handleSaveTemplate();

    setIsSendingEmail(true);
    try {
      const todayBS = new NepaliDate().format('YYYY/MM/DD');
      const nepaliYear = todayBS.split('/')[0] || '2083';
      const refCode = emp.employeeCode || (emp.id ? emp.id.substring(0, 4) : '101');
      const refNo = `RS/HR/${nepaliYear}/${refCode}`;

      // Generate High-Quality PDF using html2canvas & jsPDF
      let pdfBase64 = "";
      const renderEl = document.getElementById("hr-official-doc-hidden-renderer") || document.getElementById("hr-official-doc-printable-area");
      if (renderEl) {
        try {
          pdfBase64 = await generateElementPdfBase64(renderEl);
        } catch (pdfErr) {
          console.warn("Could not generate element PDF, sending fallback:", pdfErr);
        }
      }

      const safeFilename = `${selectedDocType.replace(/[^a-zA-Z0-9]/g, '_')}_${emp.fullName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      // Email HTML formatted cleanly for Gmail and modern email clients
      const emailHtml = `
        <div style="background-color: #f8fafc; padding: 30px 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            
            <!-- Header Card with light green background (#eaf5ec) matching official format -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #eaf5ec; border: 2px solid #86efac; border-radius: 20px; padding: 18px 20px; margin-bottom: 24px;">
              <tr>
                <td width="90" align="center" valign="middle" style="padding-right: 14px;">
                  <div style="width: 80px; height: 80px; background: #ffffff; border: 2px solid #059669; border-radius: 16px; padding: 4px; text-align: center; box-sizing: border-box; display: inline-block;">
                    <img src="cid:cooplogo" alt="Logo" width="70" height="70" style="width: 70px; height: 70px; object-fit: contain; display: block; margin: auto;" />
                  </div>
                </td>
                <td align="center" valign="middle">
                  <div style="font-size: 22px; font-weight: 900; color: #047857; line-height: 1.3; margin-bottom: 3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${orgNameNp}
                  </div>
                  <div style="font-size: 16px; font-weight: 900; color: #dc2626; line-height: 1.3; margin-bottom: 3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${orgNameEn}
                  </div>
                  <div style="font-size: 13px; font-weight: 700; color: #065f46; line-height: 1.3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${orgAddressNp}
                  </div>
                </td>
                <td width="90" align="center" valign="middle" style="display: none;"></td>
              </tr>
            </table>

            <!-- PDF Attached Notification Box -->
            <div style="background-color: #ecfdf5; border: 1.5px dashed #059669; border-radius: 12px; padding: 12px 18px; margin-bottom: 24px; text-align: center;">
              <span style="font-size: 13px; font-weight: 800; color: #065f46;">
                📎 आधिकारिक कागजात (Official Document) यस ईमेलमा PDF फाइलको रूपमा संलग्न छ।
              </span>
              <div style="font-size: 11px; color: #047857; margin-top: 3px; font-weight: 600;">
                File: <strong>${safeFilename}</strong>
              </div>
            </div>

            <!-- Document Metadata (Ref No & Date) -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <tr>
                <td align="left" style="font-size: 13px; font-weight: 700; color: #1e293b;">
                  Ref No: <span style="font-family: monospace; font-weight: 900;">${refNo}</span>
                </td>
                <td align="right" style="font-size: 13px; font-weight: 700; color: #1e293b;">
                  DATE: <span style="font-family: monospace; font-weight: 900;">${todayBS} B.S.</span>
                </td>
              </tr>
            </table>

            <!-- Document Title -->
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="font-size: 20px; font-weight: 900; text-transform: uppercase; text-decoration: underline; color: #0f172a; margin: 0; letter-spacing: 0.5px;">
                ${selectedDocType}
              </h2>
            </div>

            <!-- Employee Name -->
            <div style="margin-bottom: 20px;">
              <div style="font-size: 21px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px;">
                ${emp.fullName}
              </div>
            </div>

            <!-- Body Content -->
            <div style="font-size: 15px; line-height: 1.85; color: #0f172a; white-space: pre-line; margin-bottom: 40px; font-weight: 500;">
${customContent}
            </div>

            <!-- Redesigned Signatory Footer - Center Aligned under dotted line -->
            <div style="margin-top: 40px; text-align: center;">
              <div style="display: inline-block; text-align: center; min-width: 260px;">
                <div style="color: #94a3b8; letter-spacing: 4px; font-family: monospace; font-size: 14px; margin-bottom: 8px;">
                  ...........................................
                </div>
                ${signatoryName && signatoryName.trim() ? `
                  <div style="font-size: 15px; font-weight: 900; color: #0f172a; line-height: 1.3;">
                    ${signatoryName.trim()}
                  </div>
                ` : ''}
                <div style="font-size: 13px; font-weight: 700; color: #334155; margin-top: 3px; line-height: 1.3;">
                  ${signatoryDesignation || 'प्रबन्धक / मानव संशाधन प्रबन्धक'}
                </div>
                <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-top: 3px; line-height: 1.3;">
                  ${orgNameNp}
                </div>
              </div>
            </div>

            <!-- Footer Branding -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
              <tr>
                <td align="left" style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px;">
                  HR Official Document
                </td>
                <td align="right" style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px;">
                  © ${nepaliYear} Ratauli SACCOS
                </td>
              </tr>
            </table>

          </div>
        </div>
      `;

      const response = await fetch("/api/send-pay-slip-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emp.email.trim(),
          subject: `${selectedDocType} - ${emp.fullName} | Ratauli Saving & Credit Co-operative Ltd`,
          body: customContent,
          html: emailHtml,
          pdfBase64: pdfBase64,
          filename: safeFilename,
          logoUrl: settings?.logoUrl,
          smtpConfig: getStoredSmtpConfig()
        })
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const resData = await response.json();
        if (response.ok && resData.success) {
          alert(`आधिकारिक कागजात (PDF सहित) सफल रूपमा ${emp.fullName} (${emp.email}) लाई ईमेल गरियो!`);
        } else {
          alert(`ईमेल पठाउन सकिएन: ${resData.message || 'Error occurred'}`);
        }
      } else {
        const errText = await response.text();
        alert(`ईमेल सर्भर त्रुटि (${response.status}): ${errText.substring(0, 140)}`);
      }
    } catch (err: any) {
      console.error("Error sending official doc email:", err);
      alert(`ईमेल पठाउँदा त्रुटि आयो: ${err?.message || err}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrintClick = () => {
    if (!selectedEmpId) { 
      alert("कृपया पहिले कर्मचारी छान्नुहोस् !"); 
      return; 
    }
    if (!customContent.trim()) { 
      alert("कृपया पत्रको बेहोरा लेख्नुहोस् !"); 
      return; 
    }
    // Auto-save content on print
    if (!isDayEnded) handleSaveTemplate();
    setShowDocPreview(true);
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmpId);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 not-italic text-slate-900 font-sans scrollbar-hide no-print">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Document Generator Section - White Card Design as requested */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] text-slate-900 shadow-xl border border-slate-200/80 border-t-4 border-t-emerald-600 transition-all">
           <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                 <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-xs">
                   <FileBadge size={22}/>
                 </div>
                 <div>
                   <h3 className="text-xl font-black tracking-tight uppercase text-slate-900">
                     HR Official Document
                   </h3>
                   <p className="text-xs font-semibold text-slate-500 mt-0.5">
                     कर्मचारी आधिकारिक कागजात तयार, प्रिन्ट, PDF तथा ईमेल गर्नुहोस्
                   </p>
                 </div>
              </div>
           </div>
           
           {/* Form Inputs Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Select Employee */}
              <div className="space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider ml-1">
                   Select Employee (कर्मचारी छान्नुहोस्)
                 </label>
                 <select 
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-300 hover:border-emerald-500 focus:border-emerald-600 focus:bg-white rounded-xl px-4 font-bold text-xs uppercase outline-none text-slate-900 transition-all shadow-xs"
                 >
                    <option value="" className="text-slate-500">Choose Staff Member...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id} className="text-slate-900">
                        {e.fullName} ({e.designation || 'Staff'})
                      </option>
                    ))}
                 </select>
              </div>

              {/* Document Category with Customizable Support */}
              <div className="space-y-1.5">
                 <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider ml-1">
                      Document Category (कागजातको वर्ग)
                    </label>
                    <button
                      type="button"
                      disabled={isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                      onClick={() => !isDayEnded && setIsAddingCategory(!isAddingCategory)}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-md transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={11} />
                      <span>{isAddingCategory ? "Cancel" : "+ Add Category"}</span>
                    </button>
                 </div>

                 {isAddingCategory ? (
                   <div className="flex items-center space-x-2">
                     <input 
                       type="text"
                       disabled={isDayEnded}
                       value={newCategoryInput}
                       onChange={(e) => setNewCategoryInput(e.target.value)}
                       placeholder="नयाँ कागजात वर्ग लेख्नुहोस्..."
                       className="flex-1 h-11 bg-white border-2 border-emerald-500 rounded-xl px-4 font-bold text-xs text-slate-900 outline-none shadow-xs disabled:opacity-60"
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') handleAddCategory();
                       }}
                     />
                     <button
                       type="button"
                       disabled={isDayEnded}
                       onClick={handleAddCategory}
                       className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                     >
                       Add
                     </button>
                   </div>
                 ) : (
                   <div className="flex items-center space-x-2">
                     <select 
                        value={selectedDocType}
                        onChange={(e) => setSelectedDocType(e.target.value)}
                        className="flex-1 h-11 bg-slate-50 border border-slate-300 hover:border-emerald-500 focus:border-emerald-600 focus:bg-white rounded-xl px-4 font-bold text-xs uppercase outline-none text-slate-900 transition-all shadow-xs"
                     >
                        {categories.map(item => (
                          <option key={item} value={item} className="text-slate-900">
                            {item}
                          </option>
                        ))}
                     </select>
                     {categories.length > 1 && (
                       <button
                         type="button"
                         disabled={isDayEnded}
                         onClick={() => handleDeleteCategory(selectedDocType)}
                         className="h-11 w-11 flex items-center justify-center bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-slate-200 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                         title={isDayEnded ? getDayEndedBlockMessage() : "Delete this category"}
                       >
                         <Trash2 size={15} />
                       </button>
                     )}
                   </div>
                 )}
              </div>
           </div>

           {/* Editable Document Title Input */}
           <div className="mb-5 space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider ml-1 flex items-center space-x-1.5">
                <span>Document Title / Subject on Paper (पत्रको मुख्य शीर्षक):</span>
              </label>
              <input 
                type="text"
                disabled={isDayEnded}
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                placeholder="उदा: APPOINTMENT / OFFER LETTER"
                className="w-full h-11 bg-slate-50 border border-slate-300 hover:border-emerald-500 focus:border-emerald-600 focus:bg-white rounded-xl px-4 font-black text-xs uppercase outline-none text-slate-900 transition-all shadow-xs disabled:opacity-60"
              />
           </div>

           {/* Signatory Configuration (kasko name rakhne, pad) */}
           <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <span>Signatory Details (हस्ताक्षरकर्ताको विवरण)</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">पत्रको पुछारमा बीचमा देखिनेछ</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider ml-1">
                      हस्ताक्षरकर्ताको नाम (Signatory Name)
                    </label>
                    <input 
                       type="text"
                       disabled={isDayEnded}
                       value={signatoryName}
                       onChange={(e) => {
                         setSignatoryName(e.target.value);
                         setIsSaved(false);
                       }}
                       placeholder="उदा: चन्द्र शेखर मण्डल"
                       className="w-full h-10 bg-white border border-slate-300 hover:border-emerald-500 focus:border-emerald-600 rounded-xl px-3.5 font-bold text-xs outline-none text-slate-900 shadow-xs disabled:opacity-60"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider ml-1">
                      हस्ताक्षरकर्ताको पद (Designation / Post)
                    </label>
                    <input 
                       type="text"
                       disabled={isDayEnded}
                       value={signatoryDesignation}
                       onChange={(e) => {
                         setSignatoryDesignation(e.target.value);
                         setIsSaved(false);
                       }}
                       placeholder="उदा: प्रबन्धक / मानव संशाधन प्रबन्धक"
                       className="w-full h-10 bg-white border border-slate-300 hover:border-emerald-500 focus:border-emerald-600 rounded-xl px-3.5 font-bold text-xs outline-none text-slate-900 shadow-xs disabled:opacity-60"
                    />
                 </div>
              </div>
           </div>

           {/* Custom Content Area */}
           <div className="space-y-1.5 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase text-emerald-800 tracking-wider ml-1 flex items-center">
                  <Edit2 size={12} className="mr-2"/> Customize Document Content (पत्रको बेहोरा)
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleResetTemplate}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-bold transition-colors cursor-pointer px-2.5 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Reset to default template text"}
                  >
                    Reset Default
                  </button>
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleSaveTemplate}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Save this content and signatory for future use"}
                  >
                    <Save size={13} />
                    <span>{isSaved ? "Saved" : "Save Content"}</span>
                  </button>
                </div>
              </div>
              <textarea 
                disabled={isDayEnded}
                value={customContent}
                onChange={(e) => {
                  setCustomContent(e.target.value);
                  setIsSaved(false);
                }}
                className="w-full h-36 bg-slate-50 border border-slate-300 hover:border-emerald-500 focus:border-emerald-600 focus:bg-white rounded-xl p-4 font-normal text-sm text-slate-900 outline-none transition-all not-italic leading-relaxed shadow-xs disabled:opacity-60"
                placeholder="पत्रको बेहोरा यहाँ लेख्नुहोस्..."
              />
              {saveStatusMsg && (
                <p className="text-[11px] text-emerald-700 font-bold mt-1.5 ml-1 flex items-center space-x-1.5 animate-in fade-in duration-200">
                  <CheckCircle2 size={13} />
                  <span>{saveStatusMsg}</span>
                </p>
              )}
           </div>

           {/* Action Buttons: Left: Email (with PDF), Right: Print */}
           <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button 
                type="button"
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-11 rounded-xl font-black uppercase text-xs tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                title="Send document as PDF attachment to employee email"
              >
                 <Mail size={16} className={isSendingEmail ? "animate-spin" : ""}/>
                 <span>{isSendingEmail ? "Sending PDF..." : "Email (with PDF)"}</span>
              </button>
              <button 
                type="button"
                onClick={handlePrintClick}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 h-11 rounded-xl font-black uppercase text-xs tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center space-x-2 cursor-pointer"
                title="Print or export document as PDF"
              >
                 <Printer size={16}/>
                 <span>Print</span>
              </button>
           </div>
        </div>
      </div>

      {/* Hidden Offscreen Printable Paper for Real-Time High-Resolution PDF Rendering */}
      <div 
        id="hr-official-doc-hidden-renderer" 
        style={{ 
          position: 'fixed', 
          left: '-9999px', 
          top: '-9999px', 
          width: '800px', 
          backgroundColor: '#ffffff',
          zIndex: -1
        }}
        className="p-10 text-slate-950 font-sans not-italic"
      >
        <PrintableDocumentContent 
          type={selectedDocType}
          employee={selectedEmployee}
          content={customContent}
          settings={settings}
          signatoryName={signatoryName}
          signatoryDesignation={signatoryDesignation}
        />
      </div>

      {showDocPreview && selectedEmpId && (
         <DocumentPrintModal 
           type={selectedDocType} 
           employee={selectedEmployee} 
           content={customContent}
           signatoryName={signatoryName}
           signatoryDesignation={signatoryDesignation}
           onClose={() => setShowDocPreview(false)} 
           settings={settings}
           onSendEmail={handleSendEmail}
           isSendingEmail={isSendingEmail}
         />
      )}
    </div>
  );
};

// Reusable Printable Document Content Component
const PrintableDocumentContent = ({
  type,
  employee,
  content,
  settings,
  signatoryName,
  signatoryDesignation
}: {
  type: string;
  employee?: Employee;
  content: string;
  settings: any;
  signatoryName: string;
  signatoryDesignation: string;
}) => {
  const today = new NepaliDate().format('YYYY/MM/DD');
  const nepaliYear = today.split('/')[0] || '2083';
  const refCode = employee?.employeeCode || (employee?.id ? employee.id.substring(0, 4) : '101');
  const refNo = `RS/HR/${nepaliYear}/${refCode}`;

  const orgNameNp = "रतौली बचत तथा ऋण सहकारी संस्था लि.";
  const orgNameEn = "Ratauli Saving & Credit Co-operative Ltd.";
  const orgAddressNp = "पिपरा गाउँपालिका -६, महोत्तरी";

  return (
    <div className="text-slate-950 not-italic font-sans leading-relaxed bg-white">
      {/* Document Header - Symmetrically Equal and Centered */}
      <div 
        className="p-5 sm:p-6 rounded-3xl border-2 border-emerald-300 mb-8 relative flex items-center justify-between shadow-xs print:rounded-2xl"
        style={{ 
          backgroundColor: '#eaf5ec', 
          WebkitPrintColorAdjust: 'exact', 
          printColorAdjust: 'exact' 
        }}
      >
         {/* Logo on Left in rounded border card */}
         <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-white rounded-2xl border-2 border-emerald-600 p-2 shadow-xs flex items-center justify-center">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Institution Logo" />
            ) : (
              <div className="text-center font-black text-emerald-800 text-xs">
                रतौली साकोस
              </div>
            )}
         </div>

         {/* 3 Header Lines in Center - Equal balanced layout */}
         <div className="flex-1 text-center px-4">
            <h1 className="text-[23px] sm:text-[27px] md:text-[30px] font-black text-[#047857] tracking-tight leading-snug mb-1 font-sans not-italic">
              {orgNameNp}
            </h1>
            <h2 className="text-[17px] sm:text-[20px] md:text-[22px] font-black text-[#dc2626] tracking-tight leading-snug mb-1.5 font-sans not-italic">
              {orgNameEn}
            </h2>
            <p className="text-[13px] sm:text-[15px] font-bold text-[#065f46] tracking-wide leading-normal font-sans not-italic">
              {orgAddressNp}
            </p>
         </div>

         {/* Matching Right Spacer for Mathematical Equal Centering */}
         <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 hidden md:block invisible" aria-hidden="true" />
      </div>

      {/* Document Metadata (Ref No & Date) */}
      <div className="flex justify-between items-center mb-8 font-bold text-sm text-slate-800 border-b border-slate-200 pb-3 font-sans not-italic">
         <div>
            <span>Ref No: </span>
            <span className="font-mono font-black">{refNo}</span>
         </div>
         <div className="text-right">
            <span>DATE: </span>
            <span className="font-mono font-black">{today} B.S.</span>
         </div>
      </div>

      {/* Document Title */}
      <div className="text-center mb-8 font-sans not-italic">
         <h2 className="text-2xl font-black uppercase underline underline-offset-8 decoration-2 text-slate-900 tracking-wide font-sans not-italic">
           {type}
         </h2>
      </div>

      {/* Employee & Content */}
      <div className="min-h-[350px] mb-16 space-y-6 font-sans not-italic">
         <div>
            <p className="font-black text-slate-950 uppercase text-2xl tracking-tight font-sans not-italic">
              {employee?.fullName}
            </p>
         </div>

         <div className="pt-2">
            <p className="whitespace-pre-line text-[15px] md:text-base text-slate-900 leading-relaxed font-medium font-sans not-italic">
               {content}
            </p>
         </div>
      </div>

      {/* Document Footer / Signatory - Redesigned & Center Aligned as requested */}
      <div className="mt-16 flex flex-col items-center justify-center text-center font-sans not-italic">
         <div className="inline-flex flex-col items-center justify-center text-center min-w-[280px]">
            <div className="text-slate-400 tracking-[0.25em] text-base select-none font-mono mb-2">
              ...................................................
            </div>
            {signatoryName && signatoryName.trim() ? (
              <p className="text-base font-black text-slate-900 tracking-tight leading-tight">
                {signatoryName.trim()}
              </p>
            ) : null}
            <p className="text-sm font-bold text-slate-700 mt-1 leading-tight">
              {signatoryDesignation || 'प्रबन्धक / मानव संशाधन प्रबन्धक'}
            </p>
            <p className="text-xs font-semibold text-slate-500 mt-1 leading-tight">
              {orgNameNp}
            </p>
         </div>
      </div>

      {/* Document Footer Branding */}
      <div className="mt-14 pt-6 border-t border-slate-200 flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-400 font-bold font-sans not-italic">
         <span>HR Official Document</span>
         <span>© {nepaliYear} Ratauli SACCOS</span>
      </div>
    </div>
  );
};

const DocumentPrintModal = ({ 
  type, 
  employee, 
  content, 
  signatoryName,
  signatoryDesignation,
  onClose, 
  settings, 
  onSendEmail, 
  isSendingEmail 
}: any) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    const paperEl = document.getElementById("hr-official-doc-printable-area");
    if (!paperEl) return;
    setIsDownloadingPdf(true);
    try {
      const pdfDataUri = await generateElementPdfBase64(paperEl);
      const link = document.createElement("a");
      link.href = pdfDataUri;
      link.download = `${type.replace(/[^a-zA-Z0-9]/g, '_')}_${(employee?.fullName || 'Document').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("PDF डाउनलोड गर्न सकिएन।");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[7000] flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200 my-auto print:shadow-none print:border-none print:max-w-none print:w-full">
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-5 border-b flex justify-between items-center no-print sticky top-0 bg-white z-20 rounded-t-[2.5rem]">
           <div className="flex items-center space-x-3">
              <button 
                onClick={() => window.print()} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider flex items-center space-x-2 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                 <Printer size={16}/>
                 <span>Execute Print</span>
              </button>
              <button 
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider flex items-center space-x-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                 <Download size={16} className={isDownloadingPdf ? "animate-spin" : ""}/>
                 <span>{isDownloadingPdf ? "Generating..." : "Download PDF"}</span>
              </button>
              {onSendEmail && employee?.email && (
                <button 
                  onClick={onSendEmail}
                  disabled={isSendingEmail}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider flex items-center space-x-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                   <Mail size={16} className={isSendingEmail ? "animate-spin" : ""}/>
                   <span>{isSendingEmail ? "Sending..." : "Email with PDF"}</span>
                </button>
              )}
           </div>
           <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-rose-600 transition-all border border-slate-200 cursor-pointer">
             <X size={20}/>
           </button>
        </div>
        
        {/* Printable Paper Area */}
        <div id="hr-official-doc-printable-area" className="p-10 md:p-14 text-slate-950 not-italic font-sans leading-relaxed print:p-4 bg-white">
          <PrintableDocumentContent 
            type={type}
            employee={employee}
            content={content}
            settings={settings}
            signatoryName={signatoryName}
            signatoryDesignation={signatoryDesignation}
          />
        </div>
      </div>
    </div>
  );
};

const SalarySlipPrintView = ({ 
  slip, 
  employee, 
  settings, 
  employees 
}: { 
  slip: PayrollRecord, 
  employee: Employee | undefined, 
  settings: SystemSettings | null, 
  employees?: Employee[] 
}) => {
  const [selectedPrepId, setSelectedPrepId] = useState<string>('');
  const prepEmp = employees?.find((e: any) => e.id === selectedPrepId);
  const f2 = (n: number | undefined | null) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const basicSalary = slip.basicSalary || employee?.basicSalary || 0;
  const allowance = slip.allowance || 0;
  const gradeAmt = slip.gradeAmt || 0;

  const dashainBonus = slip.dashainBonus || 0;
  const bonusAmount = slip.bonusAmount || 0;
  const sanchitLeaveAmount = slip.sanchitLeaveAmount || 0;
  const medicalAllowance = slip.medicalAllowance || 0;
  const dressAllowance = slip.dressAllowance || 0;
  const extraIncome = dashainBonus + bonusAmount + sanchitLeaveAmount + medicalAllowance + dressAllowance;

  const ssfEmployee = slip.ssfEmployee ?? (basicSalary * 0.20);
  const pfEmployee = slip.pfEmployee ?? (basicSalary * 0.10);
  const gratuity = slip.gratuity ?? (basicSalary * 0.0833);

  const subTotalCalculated = basicSalary + allowance + gradeAmt + extraIncome + ssfEmployee + pfEmployee + gratuity;
  const totalIncome = slip.totalIncome ?? subTotalCalculated;
  const unitemizedDiff = Math.max(0, totalIncome - subTotalCalculated);
  const hasExtra = (extraIncome > 0) || (unitemizedDiff > 0.01);

  const contribSecNum = hasExtra ? '३' : '२';
  const dedSecNum = hasExtra ? '४' : '३';

  const ssfEmployer = slip.ssfEmployer ?? (basicSalary * 0.31);
  const pfEmployer = slip.pfEmployer ?? (basicSalary * 0.20);
  const gratuityEmployer = slip.gratuity ?? (basicSalary * 0.0833);
  const tax = slip.tax ?? 0;
  const totalDeductions = (slip.ssfEmployer ? (slip.ssfEmployer + (slip.pfEmployer || 0) + (slip.gratuity || 0) + tax) : (ssfEmployer + pfEmployer + gratuityEmployer + tax));
  const netSalary = slip.netSalary ?? (totalIncome - totalDeductions);

  return (
    <div className="bg-white p-8 max-w-3xl mx-auto text-black font-sans text-xs leading-relaxed">
      {/* Header with Non-overlapping Flex Layout */}
      <div className="mb-6 border-b-2 border-black pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="w-20 h-20 shrink-0 flex items-center justify-center">
             {settings?.logoUrl ? (
               <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Institution Logo" />
             ) : (
               <div className="w-16 h-16 bg-emerald-100 rounded-full border-2 border-black flex items-center justify-center text-black font-extrabold text-[10px] text-center p-1">Logo</div>
             )}
          </div>
          <div className="flex-1 text-center flex flex-col items-center justify-center">
            <h1 className="text-2xl font-black text-black tracking-tight leading-snug mb-0.5">रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड</h1>
            <p className="text-sm font-black text-black leading-normal">पिपरा गाउँपालिका-६, महोत्तरी</p>
            <div className="mt-2 text-center">
              <p className="text-sm font-black text-black leading-snug">
                आ.व. {slip.year} {slip.month ? `(${slip.month} महिना) ` : ''}तलव भुक्तानी विवरण
              </p>
            </div>
          </div>
          <div className="w-20 shrink-0" />
        </div>
      </div>

      {/* Employee Info Section (Without Border Box) */}
      <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 py-2.5 border-b-2 border-black text-xs font-black text-black">
        <div><span className="text-black font-bold">कर्मचारीको नाम:</span> <span className="uppercase text-black font-black">{employee?.fullName || '-'}</span></div>
        <div><span className="text-black font-bold">पद:</span> <span className="uppercase text-black font-black">{employee?.designation || '-'}</span></div>
        <div><span className="text-black font-bold">PAN नं:</span> <span className="font-mono text-black font-black">{employee?.panNo || '-'}</span></div>
        <div><span className="text-black font-bold">ईमेल:</span> <span className="text-black font-black">{employee?.email || '-'}</span></div>
      </div>

      {/* Salary Table */}
      <table className="w-full border-collapse border-2 border-black text-left mb-6 font-bold text-xs text-black">
        <thead>
          <tr className="bg-emerald-900 text-white border-b-2 border-black">
            <th className="border-r-2 border-black p-2.5 w-14 text-center font-bold">क.स.</th>
            <th className="border-r-2 border-black p-2.5 pl-4 font-bold">विवरण</th>
            <th className="p-2.5 pr-4 text-right w-40 font-bold">रकम रु.</th>
          </tr>
        </thead>
        <tbody>
          {/* Section 1: Monthly Earnings */}
          <tr className="bg-slate-100 border-b border-black text-black">
            <td colSpan={3} className="p-2 pl-4 text-left font-black text-[11px] uppercase tracking-wide">
              १. मासिक आम्दानी (Monthly Earnings)
            </td>
          </tr>
          <tr className="border-b border-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">१.१</td>
            <td className="border-r border-black p-2 pl-4 text-black font-bold">तलव स्केल (Basic Scale)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(basicSalary)}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">१.२</td>
            <td className="border-r border-black p-2 pl-4 text-black font-bold">महंगी भत्ता (Dearness Allowance)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(allowance)}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">१.३</td>
            <td className="border-r border-black p-2 pl-4 text-black font-bold">ग्रेड खर्च (Grade Amount)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(gradeAmt)}</td>
          </tr>

          {/* Section 2: Additional Benefits (when applicable) */}
          {hasExtra && (
            <>
              <tr className="bg-emerald-50 border-b border-black text-emerald-900">
                <td colSpan={3} className="p-2 pl-4 text-left font-black text-[11px] uppercase tracking-wide">
                  २. अतिरिक्त सुविधाहरू (Additional Benefits)
                </td>
              </tr>
              {dashainBonus > 0 && (
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 text-center text-black font-bold">२.१</td>
                  <td className="border-r border-black p-2 pl-4 text-black font-bold">दशैं भत्ता (Dashain Bonus)</td>
                  <td className="p-2 pr-4 text-right font-black text-black">{f2(dashainBonus)}</td>
                </tr>
              )}
              {bonusAmount > 0 && (
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 text-center text-black font-bold">२.२</td>
                  <td className="border-r border-black p-2 pl-4 text-black font-bold">बोनस रकम (Bonus)</td>
                  <td className="p-2 pr-4 text-right font-black text-black">{f2(bonusAmount)}</td>
                </tr>
              )}
              {sanchitLeaveAmount > 0 && (
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 text-center text-black font-bold">२.३</td>
                  <td className="border-r border-black p-2 pl-4 text-black font-bold">सञ्चित विदा (Leave Encashment)</td>
                  <td className="p-2 pr-4 text-right font-black text-black">{f2(sanchitLeaveAmount)}</td>
                </tr>
              )}
              {medicalAllowance > 0 && (
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 text-center text-black font-bold">२.४</td>
                  <td className="border-r border-black p-2 pl-4 text-black font-bold">औषधोपचार खर्च (Medical Allowance)</td>
                  <td className="p-2 pr-4 text-right font-black text-black">{f2(medicalAllowance)}</td>
                </tr>
              )}
              {dressAllowance > 0 && (
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 text-center text-black font-bold">२.५</td>
                  <td className="border-r border-black p-2 pl-4 text-black font-bold">पोशाक भत्ता (Dress Allowance)</td>
                  <td className="p-2 pr-4 text-right font-black text-black">{f2(dressAllowance)}</td>
                </tr>
              )}
              {unitemizedDiff > 0.01 && (
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 text-center text-black font-bold">२.६</td>
                  <td className="border-r border-black p-2 pl-4 text-black font-bold">अन्य थप सुविधा (Other Allowance)</td>
                  <td className="p-2 pr-4 text-right font-black text-black">{f2(unitemizedDiff)}</td>
                </tr>
              )}
            </>
          )}

          {/* Section 3 (or 2): Employer Fund Contributions */}
          <tr className="bg-slate-100 border-b border-black text-black">
            <td colSpan={3} className="p-2 pl-4 text-left font-black text-[11px] uppercase tracking-wide">
              {contribSecNum}. संस्था योगदान रकम (Employer Fund Contributions)
            </td>
          </tr>
          <tr className="border-b border-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">{contribSecNum}.१</td>
            <td className="border-r border-black p-2 pl-4 text-black font-bold">सामाजिक सुरक्षा कोष (SSF 20%)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(ssfEmployee)}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">{contribSecNum}.२</td>
            <td className="border-r border-black p-2 pl-4 text-black font-bold">संचय कोष (PF 10%)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(pfEmployee)}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">{contribSecNum}.३</td>
            <td className="border-r border-black p-2 pl-4 text-black font-bold">उपदान कोष (Gratuity 8.33%)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(gratuity)}</td>
          </tr>

          {/* Gross Total */}
          <tr className="border-b-2 border-black bg-slate-200 font-black text-black">
            <td colSpan={2} className="border-r-2 border-black p-2.5 pl-4 text-left text-xs">कुल जम्मा आम्दानी (Gross Income)</td>
            <td className="p-2.5 pr-4 text-right text-sm font-black">{f2(totalIncome)}</td>
          </tr>
          
          {/* Deductions Section */}
          <tr className="bg-rose-50 border-b-2 border-black font-black text-rose-900">
            <td colSpan={3} className="p-2 pl-4 text-left text-[11px] uppercase tracking-wide">
              {dedSecNum}. कोष तथा कर कट्टी (Deductions)
            </td>
          </tr>
          <tr className="border-b border-black text-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">{dedSecNum}.१</td>
            <td className="border-r border-black p-2 pl-4 font-bold">सामाजिक सुरक्षा कोष कट्टी (३१%)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(ssfEmployer)}</td>
          </tr>
          <tr className="border-b border-black text-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">{dedSecNum}.२</td>
            <td className="border-r border-black p-2 pl-4 font-bold">संचय कोष कट्टी (२०%)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(pfEmployer)}</td>
          </tr>
          <tr className="border-b border-black text-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">{dedSecNum}.३</td>
            <td className="border-r border-black p-2 pl-4 font-bold">उपदान कोष कट्टी (८.३३%)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(gratuityEmployer)}</td>
          </tr>
          <tr className="border-b border-black text-black">
            <td className="border-r border-black p-2 text-center text-black font-bold">{dedSecNum}.४</td>
            <td className="border-r border-black p-2 pl-4 font-bold">पारिश्रमिक आयकर कट्टी (TDS Tax)</td>
            <td className="p-2 pr-4 text-right font-black text-black">{f2(tax)}</td>
          </tr>
          
          <tr className="border-b-2 border-black font-black bg-rose-100/70 text-black">
            <td colSpan={2} className="border-r-2 border-black p-2 pl-4 text-black">जम्मा कट्टी रकम (Total Deductions)</td>
            <td className="p-2 pr-4 text-right text-black font-black">{f2(totalDeductions)}</td>
          </tr>
          <tr className="font-black bg-emerald-100 text-black border-2 border-black">
            <td colSpan={2} className="border-r-2 border-black p-2.5 pl-4 text-sm uppercase tracking-tight">शुद्ध भुक्तानी तलव (NET PAYABLE SALARY)</td>
            <td className="p-2.5 pr-4 text-right text-base font-black text-black">{f2(netSalary)}</td>
          </tr>
        </tbody>
      </table>

      {/* Signatures & Automatic Generation Note */}
      <div className="mt-10 space-y-5 italic font-bold">
        <div className="flex justify-center">
          {/* Prepared By Section */}
          <div className="flex flex-col items-center">
            <div className="border-b-2 border-black w-56 mb-2 flex flex-col items-center pb-1">
              {prepEmp ? (
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-tight text-black not-italic">{prepEmp.fullName}</p>
                  <p className="text-[10px] text-black uppercase tracking-widest font-black not-italic mt-0.5">{prepEmp.designation || 'Staff'}</p>
                </div>
              ) : (
                <span className="text-black font-normal text-xs not-italic">...................................................</span>
              )}
            </div>
            <p className="text-xs uppercase font-black text-black">तयार पार्ने</p>
            
            {/* Selector - Screen Only, Excluded from html2canvas screenshot */}
            {employees && (
              <div data-html2canvas-ignore="true" className="mt-3 w-56 no-print text-left">
                <label className="block text-[9px] uppercase text-black font-bold mb-1">तयार पार्नेको नाम (Prepared By):</label>
                <select
                  value={selectedPrepId}
                  onChange={(e) => setSelectedPrepId(e.target.value)}
                  className="w-full text-[11px] bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold focus:border-emerald-600 outline-none uppercase text-black"
                >
                  <option value="">-- छान्नुहोस् (Select) --</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName.toUpperCase()} ({emp.designation?.toUpperCase() || 'STAFF'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* System Generated Notice Footer */}
        <div className="pt-3 border-t-2 border-black text-center not-italic">
          <p className="text-[11px] font-black text-black bg-emerald-50/90 border-2 border-emerald-800 rounded-xl px-4 py-2 inline-block shadow-sm">
            द्रष्टव्य: यो कम्प्युटर प्रणालीबाट स्वतः तयार पारिएको (System Generated) तलब भुक्तानी विवरण (E-Pay Slip) हो।
          </p>
        </div>
      </div>
    </div>
  );
};

const TaxPolicyEditor = ({ config, branchId, onClose, onSave }: { config: TaxConfig, branchId?: string, onClose: () => void, onSave: (cfg: TaxConfig) => void }) => {
  const isDayEnded = useDayEndLock(branchId);
  const [data, setData] = useState<TaxConfig>({ ...config });
  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[6000] flex items-center justify-center p-3 font-bold uppercase no-print">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-4 px-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
           <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm"><ShieldCheck size={20}/></div>
              <div>
                <h3 className="text-lg font-bold italic tracking-tight text-slate-950 uppercase leading-none">Income Tax Policy Engine</h3>
                <p className="text-[10px] text-slate-500 font-medium normal-case mt-0.5">Configure Nepal Tax Slabs & Retirement Fund Limits</p>
              </div>
           </div>
           <button onClick={onClose} className="p-1.5 hover:bg-slate-200/70 rounded-lg text-slate-500 hover:text-slate-800 transition-all"><X size={18}/></button>
        </div>
        
        <DayEndFieldset branchId={branchId} className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 scrollbar-hide bg-white text-slate-900">
           <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="text-[10px] text-slate-600 tracking-wider font-extrabold uppercase block">Retirement Fund Limit (1/3 Income or Max Amount)</label>
              <input type="number" value={data.retirementCap} onChange={e => setData({...data, retirementCap: Number(e.target.value)})} className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 font-black text-lg italic outline-none focus:border-emerald-600 transition-all text-slate-900 shadow-sm" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-900">
              <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                 <h4 className="text-xs font-black border-b border-slate-200 pb-1.5 italic text-blue-600 uppercase flex items-center justify-between">
                   <span>Single Status Slabs</span>
                   <span className="text-[9px] text-slate-400 font-semibold normal-case">Personal Exemption</span>
                 </h4>
                 <div className="space-y-1.5">
                    {data.singleSlabs.map((s,i) => (
                       <div key={i} className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="w-20 text-[9px] font-extrabold text-slate-500 uppercase shrink-0 truncate" title={s.label}>{s.label}</span>
                          <input type="number" value={s.limit} onChange={e => {
                             const ns = [...data.singleSlabs];
                             ns[i].limit = Number(e.target.value);
                             setData({...data, singleSlabs: ns});
                          }} className="flex-1 bg-slate-50 border border-slate-200 h-7 rounded px-2 font-bold text-xs outline-none focus:border-blue-500" />
                          <div className="flex items-center space-x-1 shrink-0">
                            <input type="number" value={s.rate} onChange={e => {
                               const ns = [...data.singleSlabs];
                               ns[i].rate = Number(e.target.value);
                               setData({...data, singleSlabs: ns});
                            }} className="w-11 bg-slate-50 border border-slate-200 h-7 rounded px-1 font-bold text-xs text-center outline-none focus:border-blue-500" />
                            <span className="text-[10px] font-black text-slate-500">%</span>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                 <h4 className="text-xs font-black border-b border-slate-200 pb-1.5 italic text-emerald-600 uppercase flex items-center justify-between">
                   <span>Married Status Slabs</span>
                   <span className="text-[9px] text-slate-400 font-semibold normal-case">Couple Exemption</span>
                 </h4>
                 <div className="space-y-1.5">
                    {data.marriedSlabs.map((s,i) => (
                       <div key={i} className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="w-20 text-[9px] font-extrabold text-slate-500 uppercase shrink-0 truncate" title={s.label}>{s.label}</span>
                          <input type="number" value={s.limit} onChange={e => {
                             const ns = [...data.marriedSlabs];
                             ns[i].limit = Number(e.target.value);
                             setData({...data, marriedSlabs: ns});
                          }} className="flex-1 bg-slate-50 border border-slate-200 h-7 rounded px-2 font-bold text-xs outline-none focus:border-emerald-500" />
                          <div className="flex items-center space-x-1 shrink-0">
                            <input type="number" value={s.rate} onChange={e => {
                               const ns = [...data.marriedSlabs];
                               ns[i].rate = Number(e.target.value);
                               setData({...data, marriedSlabs: ns});
                            }} className="w-11 bg-slate-50 border border-slate-200 h-7 rounded px-1 font-bold text-xs text-center outline-none focus:border-emerald-500" />
                            <span className="text-[10px] font-black text-slate-500">%</span>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </DayEndFieldset>

        <div className="p-3.5 px-6 bg-slate-950 flex justify-between items-center shrink-0">
           <button onClick={onClose} className="px-4 py-2 font-bold uppercase text-[10px] tracking-wider text-slate-400 hover:text-white transition-all">Cancel Adjustment</button>
           <button disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} onClick={() => !isDayEnded && onSave(data)} className="bg-emerald-500 text-slate-950 px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-lg hover:bg-emerald-400 transition-all active:scale-95 flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <Save size={15}/>
              <span>Apply Policy Registry</span>
           </button>
        </div>
      </div>
    </div>
  );
};

interface LumpsumTaxAdjustmentModalProps {
  employee: Employee;
  taxConfig: TaxConfig;
  branchId?: string;
  onClose: () => void;
  onSave: (adjData: any, newBonus: number, newSanchit: number) => void;
}

const LumpsumTaxAdjustmentModal = ({ employee, taxConfig, branchId, onClose, onSave }: LumpsumTaxAdjustmentModalProps) => {
  const isDayEnded = useDayEndLock(branchId || employee.branchId);
  const [isActive, setIsActive] = useState<boolean>(() => {
    try {
      const savedStr = localStorage.getItem('ZEN_TAX_ADJUSTMENTS_V1');
      const allAdj = savedStr ? JSON.parse(savedStr) : {};
      const empAdj = allAdj[employee.id] || {};
      return !!empAdj.isTaxAdjustmentActive;
    } catch (e) {
      return false;
    }
  });

  const [adjMonth, setAdjMonth] = useState<string>(() => {
    try {
      const savedStr = localStorage.getItem('ZEN_TAX_ADJUSTMENTS_V1');
      const allAdj = savedStr ? JSON.parse(savedStr) : {};
      const empAdj = allAdj[employee.id] || {};
      return empAdj.taxAdjustedFromMonth || 'पौष';
    } catch (e) {
      return 'पौष';
    }
  });

  const [bonus, setBonus] = useState<number>(employee.bonusYearly ?? 0);
  const [sanchit, setSanchit] = useState<number>(employee.sanchitLeaveAmount ?? 0);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[6000] flex items-center justify-center p-4 font-bold uppercase no-print">
      <div className="bg-white w-full max-w-md max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden border border-slate-950 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
           <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-600 text-white rounded-lg shadow-sm"><Calendar size={18}/></div>
              <h3 className="text-base font-bold italic tracking-tighter text-slate-950 uppercase leading-none">Tax Adjustment</h3>
           </div>
           <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"><X size={18}/></button>
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center space-x-3 shrink-0">
           <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 text-sm font-black uppercase overflow-hidden">
              {employee.photoUrl ? (
                 <img src={employee.photoUrl} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : (
                 employee.fullName.charAt(0)
              )}
           </div>
           <div>
              <div className="text-slate-900 font-extrabold text-xs">{employee.fullName}</div>
              <div className="text-slate-500 font-bold text-[10px] uppercase">{employee.designation || 'Staff'} ({employee.employeeCode})</div>
           </div>
        </div>

        <DayEndFieldset branchId={branchId || employee.branchId} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-white text-[#000000]">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
             <div className="flex-1 pr-3">
                <label className="text-xs text-slate-900 font-extrabold block normal-case">Enable Tax Adjustment</label>
                <span className="text-[9px] text-slate-400 font-bold block mt-0.5 normal-case">Distribute large lump sum taxes evenly over remaining fiscal months.</span>
             </div>
             <button 
               type="button" 
               onClick={() => setIsActive(!isActive)}
               className={`w-12 h-7 flex items-center rounded-full p-1 duration-300 cursor-pointer shrink-0 ${isActive ? 'bg-amber-500' : 'bg-slate-300'}`}
             >
               <div className={`bg-white w-5 h-5 rounded-full shadow-md transform duration-300 ${isActive ? 'translate-x-5' : ''}`} />
             </button>
          </div>

          <div className="space-y-1">
             <label className="text-xs text-slate-900 font-extrabold block normal-case">Adjustment Start Month</label>
             <select 
               value={adjMonth} 
               onChange={e => setAdjMonth(e.target.value)}
               disabled={!isActive}
               className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-bold text-xs outline-none focus:border-amber-500 disabled:opacity-50 text-[#000000]"
             >
               {NEPALI_MONTHS.map(m => (
                 <option key={m} value={m}>{m}</option>
               ))}
             </select>
             <span className="text-[9px] text-slate-400 font-bold block normal-case">Tax will be calculated and divided starting from this month onwards.</span>
          </div>

          <div className="space-y-1">
             <label className="text-xs text-slate-900 font-extrabold block normal-case">Yearly Bonus Amount (NPR)</label>
             <input 
               type="number" 
               value={bonus === 0 ? '' : bonus} 
               onChange={e => setBonus(Number(e.target.value))}
               placeholder="0"
               className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-bold text-xs outline-none focus:border-amber-500 text-[#000000]" 
             />
          </div>

          <div className="space-y-1">
             <label className="text-xs text-slate-900 font-extrabold block normal-case">Accumulated Leave Amount (NPR)</label>
             <input 
               type="number" 
               value={sanchit === 0 ? '' : sanchit} 
               onChange={e => setSanchit(Number(e.target.value))}
               placeholder="0"
               className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-bold text-xs outline-none focus:border-amber-500 text-[#000000]" 
             />
          </div>
        </DayEndFieldset>

        <div className="p-4 bg-slate-950 flex justify-between items-center shrink-0 rounded-b-2xl">
           <button onClick={onClose} className="px-4 py-2 font-bold uppercase text-[9px] tracking-widest text-slate-400 hover:text-white transition-all">Cancel</button>
           <button 
             disabled={isDayEnded}
             title={isDayEnded ? getDayEndedBlockMessage() : undefined}
             onClick={() => {
               if (isDayEnded) return;
               onSave(
                 { isTaxAdjustmentActive: isActive, taxAdjustedFromMonth: adjMonth },
                 bonus,
                 sanchit
               );
             }} 
             className="bg-white text-slate-950 px-6 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-[0.12em] shadow-md hover:bg-amber-600 hover:text-white transition-all flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
           >
              <Save size={14}/>
              <span>Save</span>
           </button>
        </div>
      </div>
    </div>
  );
};

interface EmployeeEmailCenterProps {
  employees: Employee[];
  selectedYear: string;
  selectedMonth: string;
  settings: SystemSettings | null;
  taxConfig: TaxConfig;
  payrollRecords: PayrollRecord[];
}

const EmployeeEmailCenter = ({
  employees,
  selectedYear,
  selectedMonth,
  settings,
  taxConfig,
  payrollRecords
}: EmployeeEmailCenterProps) => {
  const [isAllEmailChecked, setIsAllEmailChecked] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emailSearchTerm, setEmailSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [subject, setSubject] = useState<string>('');
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [isSending, setIsSending] = useState(false);
  const [sendStatusLog, setSendStatusLog] = useState<{ name: string; email: string; status: 'pending' | 'success' | 'failed'; error?: string }[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; size: string; type: string; dataUrl?: string }[]>([]);

  // Function to clear all fields for a new email
  const handleClearAllFields = () => {
    setIsAllEmailChecked(false);
    setSelectedEmails([]);
    setEmailSearchTerm('');
    setSubject('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setAttachedFiles([]);
  };

  // Handle PDF & file attachments upload
  const handleAttachmentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: { id: string; name: string; size: string; type: string; dataUrl?: string }[] = [];
      Array.from(files).forEach((file) => {
        const sizeStr = file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          newFiles.push({
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: sizeStr,
            type: file.type || 'file',
            dataUrl
          });

          // Insert Attachment Element into Message Editor Box
          if (editorRef.current) {
            let attachBadgeHtml = '';
            if (file.type.startsWith('image/')) {
              attachBadgeHtml = `<div style="margin: 8px 0;"><img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; max-height: 250px; border-radius: 6px; border: 1px solid #cbd5e1; display: block;" /><span style="font-size: 11px; color: #64748b; font-family: sans-serif;">📎 Attachment: ${file.name} (${sizeStr})</span></div><p><br></p>`;
            } else {
              attachBadgeHtml = `<div contenteditable="false" style="display: inline-flex; align-items: center; gap: 8px; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; margin: 6px 0; font-family: sans-serif; font-size: 13px; color: #0f172a; font-weight: 600; user-select: none;"><span style="font-size: 16px;">📄</span><span>${file.name}</span> <span style="font-size: 11px; color: #64748b; font-weight: normal;">(${sizeStr})</span></div><p><br></p>`;
            }

            editorRef.current.focus();
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && editorRef.current.contains(selection.anchorNode)) {
              document.execCommand('insertHTML', false, attachBadgeHtml);
            } else {
              editorRef.current.innerHTML += attachBadgeHtml;
            }
          }

          if (newFiles.length === files.length) {
            setAttachedFiles(prev => [...prev, ...newFiles]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    if (e.target) e.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Active employees with valid email addresses
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Active'), [employees]);
  const employeesWithEmail = useMemo(() => activeEmployees.filter(e => e.email && e.email.trim().includes('@')), [activeEmployees]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle "All Email" Checkbox
  const handleAllEmailToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsAllEmailChecked(checked);
    if (checked) {
      const all = employeesWithEmail.map(emp => emp.email!.trim());
      setSelectedEmails(Array.from(new Set(all)));
    } else {
      setSelectedEmails([]);
    }
  };

  // Toggle individual email selection
  const handleToggleEmail = (emailStr: string) => {
    let next: string[] = [];
    if (selectedEmails.includes(emailStr)) {
      next = selectedEmails.filter(m => m !== emailStr);
    } else {
      next = [...selectedEmails, emailStr];
    }
    setSelectedEmails(next);
    setIsAllEmailChecked(next.length > 0 && next.length === employeesWithEmail.length);
  };

  // Filtered dropdown employees
  const filteredDropdownEmployees = useMemo(() => {
    if (!emailSearchTerm.trim()) return employeesWithEmail;
    const term = emailSearchTerm.toLowerCase();
    return employeesWithEmail.filter(emp =>
      emp.email?.toLowerCase().includes(term) ||
      emp.fullName.toLowerCase().includes(term) ||
      emp.employeeCode?.toLowerCase().includes(term)
    );
  }, [employeesWithEmail, emailSearchTerm]);

  // Rich Text Editor Commands
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Insert Local Image File
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string;
        if (dataUrl) {
          execCmd('insertHTML', `<img src="${dataUrl}" alt="Uploaded Image" style="max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0; border: 1px solid #e2e8f0; display: block;" />`);
        }
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  // Insert Image URL
  const handleInsertImageUrl = () => {
    const url = prompt('फोटोको URL प्रविष्टि गर्नुहोस् (Enter Image URL):');
    if (url && url.trim()) {
      execCmd('insertHTML', `<img src="${url.trim()}" alt="Inserted Image" style="max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0; display: block;" />`);
    }
  };

  // Insert Link
  const handleInsertLink = () => {
    const url = prompt('Enter Web Link URL (e.g. https://example.com):');
    if (url && url.trim()) {
      execCmd('createLink', url.trim());
    }
  };

  // Insert Variable Tag
  const handleInsertPlaceholder = (tag: string) => {
    execCmd('insertHTML', `<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: monospace; font-size: 12px;">${tag}</span> `);
  };

  // Handle Send Emails
  const handleSendEmails = async () => {
    let targetMails = selectedEmails;

    if (isAllEmailChecked) {
      targetMails = employeesWithEmail.map(e => e.email!.trim());
    }

    if (targetMails.length === 0) {
      alert('कृपया कम्तीमा एक जना इमेल भएको कर्मचारी छनोट गर्नुहोस् (Please select at least one email recipient).');
      return;
    }

    if (!subject.trim()) {
      alert('इमेलको विषय (Subject) प्रविष्टि गर्नुहोस्।');
      return;
    }

    const htmlContent = editorRef.current ? editorRef.current.innerHTML : '';
    if (!htmlContent.trim()) {
      alert('इमेलको सन्देश (Message) खाली छ।');
      return;
    }

    setIsSending(true);
    setShowLogModal(true);

    const normalizedTargets = Array.from(
      new Set(targetMails.map(m => m.trim()).filter(Boolean))
    );
    const targetRecipients = normalizedTargets.map(mail => {
      const matchedEmp = employeesWithEmail.find(
        e => (e.email || '').trim().toLowerCase() === mail.toLowerCase()
      );
      return {
        email: mail,
        emp: matchedEmp || ({ fullName: mail.split('@')[0], email: mail, basicSalary: 0 } as any)
      };
    });

    const initialLog = targetRecipients.map(r => ({
      name: r.emp.fullName,
      email: r.email,
      status: 'pending' as const
    }));
    setSendStatusLog(initialLog);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetRecipients.length; i++) {
      const { emp, email: recipientEmail } = targetRecipients[i];
      const payrollData = calculateDetailedPayroll(emp, taxConfig, selectedMonth);

      const extraEmpIncome = (emp.dashainBonus || 0) + (emp.bonusAmount || 0) + (emp.sanchitLeaveAmount || 0) + (emp.medicalAllowance || 0) + (emp.dressAllowance || 0);
      const grossEmpSalary = (payrollData.monthly.monthlyGross || 0) + extraEmpIncome;
      const netEmpSalary = grossEmpSalary - (payrollData.monthly.totalDeduction || 0);

      const personalizedHtml = htmlContent
        .replace(/{STAFF_NAME}/g, emp.fullName)
        .replace(/{YEAR}/g, selectedYear)
        .replace(/{MONTH}/g, selectedMonth)
        .replace(/{BASIC_SALARY}/g, (emp.basicSalary || 0).toLocaleString())
        .replace(/{ALLOWANCE}/g, (payrollData.monthly.da || 0).toLocaleString())
        .replace(/{GRADE}/g, (payrollData.monthly.grade || 0).toLocaleString())
        .replace(/{EXTRA_ALLOWANCE}/g, extraEmpIncome.toLocaleString())
        .replace(/{GROSS_SALARY}/g, grossEmpSalary.toLocaleString())
        .replace(/{TAX}/g, (payrollData.tax.monthlyTax || 0).toLocaleString())
        .replace(/{NET_SALARY}/g, netEmpSalary.toLocaleString())
        .replace(/{SYSTEM_NAME}/g, settings?.systemName || 'रतौली साकोस');

      const personalizedText = (editorRef.current?.innerText || '')
        .replace(/{STAFF_NAME}/g, emp.fullName)
        .replace(/{YEAR}/g, selectedYear)
        .replace(/{MONTH}/g, selectedMonth)
        .replace(/{BASIC_SALARY}/g, (emp.basicSalary || 0).toLocaleString())
        .replace(/{ALLOWANCE}/g, (payrollData.monthly.da || 0).toLocaleString())
        .replace(/{GRADE}/g, (payrollData.monthly.grade || 0).toLocaleString())
        .replace(/{EXTRA_ALLOWANCE}/g, extraEmpIncome.toLocaleString())
        .replace(/{GROSS_SALARY}/g, grossEmpSalary.toLocaleString())
        .replace(/{TAX}/g, (payrollData.tax.monthlyTax || 0).toLocaleString())
        .replace(/{NET_SALARY}/g, netEmpSalary.toLocaleString())
        .replace(/{SYSTEM_NAME}/g, settings?.systemName || 'रतौली साकोस');

      let isSuccess = false;
      let failReason = '';
      try {
        const emailAllowed = await isEmailCategoryAllowed('payslip');
        if (!emailAllowed.allowed) {
          failReason = emailAllowed.reason || 'ईमेल सूचना बन्द गरिएको छ';
          failCount++;
          setSendStatusLog(prev =>
            prev.map((item, idx) => (idx === i ? { ...item, status: 'failed', error: failReason } : item))
          );
          continue;
        }

        const response = await fetch('/api/send-pay-slip-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipientEmail,
            subject: subject.trim(),
            body: personalizedText,
            html: personalizedHtml,
            logoUrl: settings?.logoUrl,
            smtpConfig: getStoredSmtpConfig(),
            attachments: attachedFiles.map(f => ({
              filename: f.name,
              dataUrl: f.dataUrl,
              type: f.type
            }))
          })
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const resData = await response.json();
          if (response.ok && resData.success) {
            isSuccess = true;
          } else {
            failReason = resData.message || `Server error (${response.status})`;
          }
        } else {
          const errText = await response.text();
          failReason = `Server response error (${response.status}): ${errText.substring(0, 120)}`;
        }
      } catch (err: any) {
        failReason = err?.message || 'Network/server error';
      }

      if (isSuccess) {
        successCount++;
        setSendStatusLog(prev =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'success', error: undefined } : item))
        );
      } else {
        failCount++;
        setSendStatusLog(prev =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'failed', error: failReason } : item))
        );
      }
    }

    setIsSending(false);
    if (successCount > 0 && failCount === 0) {
      setShowLogModal(false);
      setShowSuccessModal(true);
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-white min-h-[600px] text-slate-900 font-sans space-y-4">
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageFileUpload}
      />

      {/* Hidden File Input for Document & PDF Attachments */}
      <input
        type="file"
        ref={attachmentInputRef}
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
        className="hidden"
        onChange={handleAttachmentFileUpload}
      />

      {/* Top Checkbox: All Email */}
      <div className="flex items-center space-x-2 pt-1 pb-1">
        <label className="flex items-center space-x-2 text-sm font-bold text-slate-900 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAllEmailChecked}
            onChange={handleAllEmailToggle}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer border-gray-400"
          />
          <span>All Email</span>
        </label>
        {isAllEmailChecked && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            ({employeesWithEmail.length} Recipients Selected)
          </span>
        )}
      </div>

      {/* Field 1: Email */}
      <div className="space-y-1.5 relative" ref={dropdownRef}>
        <label className="block text-sm font-bold text-slate-900">
          Email
        </label>

        {/* Selected Emails Summary / Search Bar */}
        <div
          onClick={() => setIsDropdownOpen(true)}
          className="w-full min-h-[38px] bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 cursor-text focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 flex flex-wrap items-center gap-1.5 shadow-xs"
        >
          {isAllEmailChecked ? (
            <span className="bg-blue-100 text-blue-900 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
              <span>All Active Employee Emails ({employeesWithEmail.length})</span>
            </span>
          ) : (
            selectedEmails.map(mail => (
              <span key={mail} className="bg-slate-100 text-slate-800 border border-slate-200 text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1">
                <span>{mail}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEmail(mail);
                  }}
                  className="text-slate-400 hover:text-slate-700 font-bold"
                >
                  ×
                </button>
              </span>
            ))
          )}

          <input
            type="text"
            value={emailSearchTerm}
            onFocus={() => setIsDropdownOpen(true)}
            onChange={e => {
              setEmailSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            placeholder={selectedEmails.length === 0 && !isAllEmailChecked ? "Search or select employee emails..." : ""}
            className="flex-1 min-w-[140px] outline-none bg-transparent text-sm text-slate-900"
          />
        </div>

        {/* Dropdown list as shown in Screenshot 1 */}
        {isDropdownOpen && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-60 overflow-y-auto">
            {filteredDropdownEmployees.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">
                No matching employee emails found.
              </div>
            ) : (
              filteredDropdownEmployees.map(emp => {
                const empEmail = emp.email?.trim() || '';
                const isSelected = selectedEmails.includes(empEmail) || isAllEmailChecked;

                return (
                  <div
                    key={emp.id}
                    onClick={() => handleToggleEmail(empEmail)}
                    className={`px-3 py-2 text-sm text-slate-800 cursor-pointer border-b border-slate-100 flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div onClick
                        className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                      />
                      <span className="font-mono text-xs text-slate-900">{empEmail}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      [{emp.employeeCode || 'ID'}] {emp.fullName}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Field 2: Subject */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-slate-900">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Enter email subject..."
          className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-xs"
        />
      </div>

      {/* Field 3: Message with Complete Rich Text Editor Toolbar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-bold text-slate-900">
            Message
          </label>

          {/* Quick Insert Placeholders */}
          <div className="flex items-center space-x-1 text-xs flex-wrap gap-y-1">
            <span className="text-slate-500 font-medium text-[11px] mr-1">Insert Tags:</span>
            {['{STAFF_NAME}', '{MONTH}', '{YEAR}', '{BASIC_SALARY}', '{ALLOWANCE}', '{GRADE}', '{EXTRA_ALLOWANCE}', '{GROSS_SALARY}', '{TAX}', '{NET_SALARY}'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => handleInsertPlaceholder(tag)}
                className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all"
                title={`Insert ${tag} placeholder`}
              >
                + {tag.replace(/[{}]/g, '')}
              </button>
            ))}
          </div>
        </div>

        {/* Rich Text Editor Container */}
        <div className="border border-slate-300 rounded shadow-xs overflow-hidden bg-white">
          {/* Rich Text Toolbar */}
          <div className="bg-slate-100 border-b border-slate-300 p-1.5 flex flex-wrap items-center gap-1 text-slate-700 select-none">
            {/* Font Family */}
            <select
              onChange={e => execCmd('fontName', e.target.value)}
              className="h-7 bg-white border border-slate-300 rounded text-xs px-1.5 text-slate-800 outline-none cursor-pointer hover:border-slate-400"
              title="Font Family"
            >
              <option value="sans-serif">Sans-Serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Trebuchet MS">Trebuchet MS</option>
            </select>

            {/* Font Size */}
            <select
              onChange={e => execCmd('fontSize', e.target.value)}
              className="h-7 bg-white border border-slate-300 rounded text-xs px-1.5 text-slate-800 outline-none cursor-pointer hover:border-slate-400"
              title="Font Size"
            >
              <option value="2">Small (12px)</option>
              <option value="3">Normal (14px)</option>
              <option value="4">Medium (16px)</option>
              <option value="5">Large (18px)</option>
              <option value="6">Huge (24px)</option>
            </select>

            <div className="w-px h-5 bg-slate-300 mx-0.5" />

            {/* Formatting Tools */}
            <button
              type="button"
              onClick={() => execCmd('bold')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700 font-bold"
              title="Bold (Ctrl+B)"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('italic')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Italic (Ctrl+I)"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('underline')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Underline (Ctrl+U)"
            >
              <Underline size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('strikeThrough')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Strikethrough"
            >
              <Strikethrough size={15} />
            </button>

            <div className="w-px h-5 bg-slate-300 mx-0.5" />

            {/* Alignment Tools */}
            <button
              type="button"
              onClick={() => execCmd('justifyLeft')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Align Left"
            >
              <AlignLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyCenter')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Align Center"
            >
              <AlignCenter size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyRight')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Align Right"
            >
              <AlignRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyFull')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Justify"
            >
              <AlignJustify size={15} />
            </button>

            <div className="w-px h-5 bg-slate-300 mx-0.5" />

            {/* Lists */}
            <button
              type="button"
              onClick={() => execCmd('insertUnorderedList')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Bullet List"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('insertOrderedList')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Numbered List"
            >
              <ListOrdered size={15} />
            </button>

            <div className="w-px h-5 bg-slate-300 mx-0.5" />

            {/* Color Pickers */}
            <div className="flex items-center space-x-1" title="Text Color">
              <span className="text-[10px] font-bold text-slate-500">Color:</span>
              <input
                type="color"
                defaultValue="#0f172a"
                onChange={e => execCmd('foreColor', e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border border-slate-300 bg-transparent"
              />
            </div>
            <div className="flex items-center space-x-1" title="Highlight Color">
              <span className="text-[10px] font-bold text-slate-500">Bg:</span>
              <input
                type="color"
                defaultValue="#fef08a"
                onChange={e => execCmd('hiliteColor', e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border border-slate-300 bg-transparent"
              />
            </div>

            <div className="w-px h-5 bg-slate-300 mx-0.5" />

            {/* Image & Media Tools */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="p-1.5 hover:bg-slate-200 rounded text-blue-700 flex items-center space-x-1"
              title="Upload & Insert Image File"
            >
              <ImageIcon size={15} />
              <span className="text-[10px] font-bold">Image</span>
            </button>
            <button
              type="button"
              onClick={handleInsertImageUrl}
              className="p-1 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-200 px-1.5"
              title="Insert Image URL"
            >
              URL Img
            </button>

            {/* Document / PDF Attachment Button */}
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className="p-1.5 hover:bg-slate-200 rounded text-emerald-700 flex items-center space-x-1"
              title="Attach PDF, Word, or Document Files"
            >
              <Paperclip size={15} />
              <span className="text-[10px] font-bold">Attach PDF/File</span>
            </button>

            {/* Link */}
            <button
              type="button"
              onClick={handleInsertLink}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Insert Link"
            >
              <LinkIcon size={15} />
            </button>

            <div className="w-px h-5 bg-slate-300 mx-0.5" />

            {/* Utilities */}
            <button
              type="button"
              onClick={() => execCmd('insertHorizontalRule')}
              className="p-1 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-200 px-1.5"
              title="Insert Divider Line"
            >
              ― HR
            </button>
            <button
              type="button"
              onClick={() => execCmd('removeFormat')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Clear Formatting"
            >
              <RemoveFormatting size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('undo')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Undo"
            >
              <Undo size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('redo')}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
              title="Redo"
            >
              <Redo size={15} />
            </button>
          </div>

          {/* Editable Content Area */}
          <div
            ref={editorRef}
            contentEditable
            className="min-h-[220px] max-h-[480px] overflow-y-auto p-4 text-sm text-slate-900 outline-none leading-relaxed focus:ring-0"
            style={{ minHeight: '220px' }}
          />
        </div>
      </div>

      {/* Attached Files List */}
      {attachedFiles.length > 0 && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
          <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Paperclip size={14} className="text-emerald-600" />
              <span>Attached Files ({attachedFiles.length}):</span>
            </span>
            <button
              type="button"
              onClick={() => setAttachedFiles([])}
              className="text-[10px] text-rose-600 hover:underline font-semibold cursor-pointer"
            >
              Remove All Attachments
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {attachedFiles.map(file => (
              <div
                key={file.id}
                className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 flex items-center space-x-2 shadow-2xs hover:border-emerald-400 transition-colors"
              >
                <File size={13} className="text-blue-600 flex-shrink-0" />
                <span className="font-medium max-w-[200px] truncate">{file.name}</span>
                <span className="text-[10px] text-slate-400">({file.size})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(file.id)}
                  className="text-slate-400 hover:text-rose-600 font-bold ml-1 text-sm leading-none cursor-pointer"
                  title="Remove attachment"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field 4: Action Buttons (Send & Clear Fields) */}
      <div className="pt-2 flex items-center space-x-3">
        <button
          type="button"
          onClick={handleSendEmails}
          disabled={isSending}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded px-6 py-2 text-sm shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
        >
          <Send size={15} />
          <span>{isSending ? 'Sending...' : 'Send'}</span>
        </button>

        <button
          type="button"
          onClick={handleClearAllFields}
          disabled={isSending}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded px-4 py-2 text-sm border border-slate-300 transition-all cursor-pointer"
        >
          Clear All Fields
        </button>
      </div>

      {/* Dispatch Status Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-[7000] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Mail size={16} className="text-blue-600" />
                <span>Email Dispatch Status Log</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {sendStatusLog.map((log, idx) => (
                <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800">{log.name}</span>
                      <span className="text-slate-500 ml-2">({log.email})</span>
                    </div>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        log.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.status === 'failed'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                  </div>
                  {log.status === 'failed' && log.error && (
                    <div className="text-[11px] text-rose-700 font-medium break-words">
                      {log.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 rounded text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Was Successfully Sent Modal (As requested in Image 2) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[7000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center space-y-6 border border-slate-100 animate-in fade-in zoom-in duration-200">
            {/* Big Green Circle with Checkmark as in Image 2 */}
            <div className="w-20 h-20 bg-[#00b04f] rounded-full flex items-center justify-center mx-auto text-white shadow-md">
              <Check size={48} strokeWidth={3.5} />
            </div>

            <p className="text-xl font-medium text-slate-800">
              Email was successfully sent!
            </p>

            <div>
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  handleClearAllFields();
                }}
                className="bg-[#00b04f] hover:bg-[#009643] text-white font-bold px-10 py-2.5 rounded-lg text-sm tracking-wide shadow-md transition-all active:scale-95 cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRManagement;