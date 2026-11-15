import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calculator, 
  ArrowLeft, 
  Percent, 
  Calendar as CalendarIcon, 
  FileText, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  TrendingUp, 
  Award, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../AuthContext';
import { NepaliDatePicker } from './NepaliDatePicker';

type CalculatorTab = 'emi' | 'recurring' | 'fd';

const formatNPR = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(n)) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Date calculation helpers
const getTodayBsString = (): string => {
  try {
    return new NepaliDate().format('YYYY-MM-DD');
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const NEPALI_MONTH_NAMES = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const getDaysInNepaliMonth = (bsYear: number, bsMonth: number): number => {
  try {
    const startOfMonth = new NepaliDate(bsYear, bsMonth - 1, 1);
    const nextMonthYear = bsMonth === 12 ? bsYear + 1 : bsYear;
    const nextMonth = bsMonth === 12 ? 1 : bsMonth + 1;
    const firstOfNext = new NepaliDate(nextMonthYear, nextMonth - 1, 1);
    const days = Math.round((firstOfNext.toJsDate().getTime() - startOfMonth.toJsDate().getTime()) / (1000 * 60 * 60 * 24));
    return days >= 28 && days <= 33 ? days : 30;
  } catch {
    return 30;
  }
};

interface EmiScheduleRow {
  sn: number;
  dateBs: string;
  dateAd: string;
  openingBalance: number;
  emiAmount: number;
  principalAmount: number;
  interestAmount: number;
  closingBalance: number;
}

interface RecurringScheduleRow {
  sn: number;
  monthLabel: string;
  depositAmount: number;
  interestAmount: number;
  taxAmount: number;
  balance: number;
}

interface FdScheduleRow {
  sn: number;
  periodLabel: string;
  openingBalance: number;
  interestAmount: number;
  taxAmount: number;
  closingBalance: number;
}

export const CalculatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useAuth();
  
  const institutionName = settings?.systemName || 'Ratauli Saving and Credit Cooperative Society Ltd.';
  const institutionAddress = settings?.address || 'Pipara-6, Ratauli (Mahottari)';

  const [activeTab, setActiveTab] = useState<CalculatorTab>('emi');

  // -------------------------------------------------------------
  // TAB 1: EMI CALCULATOR STATE & LOGIC
  // -------------------------------------------------------------
  const [emiPrincipal, setEmiPrincipal] = useState<string>('');
  const [emiInterestRate, setEmiInterestRate] = useState<string>('');
  const [emiDurationMonths, setEmiDurationMonths] = useState<string>('');
  const [emiCalcType, setEmiCalcType] = useState<'diminishing' | 'flat'>('diminishing');
  const [emiInstallmentType, setEmiInstallmentType] = useState<'on_due_date' | 'eom'>('on_due_date');
  const [emiDisbursementDate, setEmiDisbursementDate] = useState<string>(getTodayBsString());
  const [emiDueDay, setEmiDueDay] = useState<number>(15);
  
  const [emiCalculated, setEmiCalculated] = useState<boolean>(false);
  const [emiShowDetail, setEmiShowDetail] = useState<boolean>(false);
  const [isExportingEmiPdf, setIsExportingEmiPdf] = useState<boolean>(false);

  // Validation
  const emiValidation = useMemo(() => {
    const p = parseFloat(emiPrincipal);
    const r = parseFloat(emiInterestRate);
    const n = parseInt(emiDurationMonths, 10);
    const errors: string[] = [];
    if (isNaN(p) || p <= 0) errors.push('Principal amount must be greater than zero.');
    if (isNaN(r) || r < 0) errors.push('Interest rate must be greater than or equal to 0%.');
    if (isNaN(n) || n <= 0) errors.push('Loan duration must be at least 1 month.');
    return { isValid: errors.length === 0, errors, p, r, n };
  }, [emiPrincipal, emiInterestRate, emiDurationMonths]);

  // EMI Summary and Schedule computation
  const { emiSummary, emiSchedule } = useMemo(() => {
    const { isValid, p, r, n } = emiValidation;
    if (!isValid || !emiCalculated) {
      return {
        emiSummary: {
          principal: 0,
          interestRate: 0,
          duration: 0,
          calcType: emiCalcType,
          installmentType: emiInstallmentType,
          monthlyEmi: 0,
          totalInterest: 0,
          totalRepayment: 0
        },
        emiSchedule: [] as EmiScheduleRow[]
      };
    }

    const rows: EmiScheduleRow[] = [];
    let monthlyEmi = 0;
    let totalInterest = 0;
    let totalRepayment = 0;

    // Helper to calculate installment dates
    let startYear = 2081;
    let startMonth = 1;
    try {
      const parts = emiDisbursementDate.split(/[-/]/).map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        startYear = parts[0];
        startMonth = parts[1];
      }
    } catch {
      // fallback
    }

    const getInstallmentDate = (installmentIndex: number) => {
      let curMonth = startMonth + installmentIndex;
      let curYear = startYear;
      while (curMonth > 12) {
        curMonth -= 12;
        curYear += 1;
      }

      const daysInThisMonth = getDaysInNepaliMonth(curYear, curMonth);
      const curDay = emiInstallmentType === 'eom' ? daysInThisMonth : Math.min(Math.max(emiDueDay, 1), daysInThisMonth);
      const curMonthPadded = curMonth < 10 ? `0${curMonth}` : `${curMonth}`;
      const curDayPadded = curDay < 10 ? `0${curDay}` : `${curDay}`;
      const bsStr = `${curYear}/${curMonthPadded}/${curDayPadded}`;

      let adStr = '';
      try {
        const nepDate = new NepaliDate(curYear, curMonth - 1, curDay);
        const jsDate = nepDate.toJsDate();
        adStr = jsDate.toISOString().slice(0, 10);
      } catch {
        adStr = '-';
      }

      return { bsStr, adStr };
    };

    if (emiCalcType === 'diminishing') {
      const monthlyRate = (r / 12) / 100;
      if (monthlyRate > 0) {
        const factor = Math.pow(1 + monthlyRate, n);
        monthlyEmi = (p * monthlyRate * factor) / (factor - 1);
      } else {
        monthlyEmi = p / n;
      }

      let currentBal = p;
      let accumPrincipal = 0;
      let accumInterest = 0;

      for (let i = 1; i <= n; i++) {
        const openBal = currentBal;
        const interest = Math.round(openBal * monthlyRate * 100) / 100;

        let principalPortion = 0;
        let installmentPayment = 0;
        let closeBal = 0;

        if (i < n) {
          principalPortion = Math.round((monthlyEmi - interest) * 100) / 100;
          if (principalPortion > openBal) principalPortion = openBal;
          closeBal = Math.max(0, Math.round((openBal - principalPortion) * 100) / 100);
          installmentPayment = Math.round((principalPortion + interest) * 100) / 100;
        } else {
          // Last installment: exact settlement to zero
          principalPortion = openBal;
          closeBal = 0;
          installmentPayment = Math.round((principalPortion + interest) * 100) / 100;
        }

        accumPrincipal += principalPortion;
        accumInterest += interest;
        currentBal = closeBal;

        const dateObj = getInstallmentDate(i);
        rows.push({
          sn: i,
          dateBs: dateObj.bsStr,
          dateAd: dateObj.adStr,
          openingBalance: openBal,
          emiAmount: installmentPayment,
          principalAmount: principalPortion,
          interestAmount: interest,
          closingBalance: closeBal
        });
      }

      totalInterest = accumInterest;
      totalRepayment = accumPrincipal + accumInterest;
    } else {
      // Flat Rate Calculation
      totalInterest = p * (r / 100) * (n / 12);
      totalRepayment = p + totalInterest;
      monthlyEmi = totalRepayment / n;

      const monthlyPrincipal = p / n;
      const monthlyInt = totalInterest / n;
      let currentBal = p;
      let accumInterest = 0;
      let accumPrincipal = 0;

      for (let i = 1; i <= n; i++) {
        const openBal = currentBal;
        let principalPortion = 0;
        let interest = 0;
        let closeBal = 0;

        if (i < n) {
          principalPortion = Math.round(monthlyPrincipal * 100) / 100;
          interest = Math.round(monthlyInt * 100) / 100;
          closeBal = Math.max(0, Math.round((openBal - principalPortion) * 100) / 100);
        } else {
          // Last row settlement
          principalPortion = openBal;
          interest = Math.round((totalInterest - accumInterest) * 100) / 100;
          closeBal = 0;
        }

        const installmentPayment = Math.round((principalPortion + interest) * 100) / 100;
        accumPrincipal += principalPortion;
        accumInterest += interest;
        currentBal = closeBal;

        const dateObj = getInstallmentDate(i);
        rows.push({
          sn: i,
          dateBs: dateObj.bsStr,
          dateAd: dateObj.adStr,
          openingBalance: openBal,
          emiAmount: installmentPayment,
          principalAmount: principalPortion,
          interestAmount: interest,
          closingBalance: closeBal
        });
      }

      totalInterest = accumInterest;
      totalRepayment = accumPrincipal + accumInterest;
    }

    return {
      emiSummary: {
        principal: p,
        interestRate: r,
        duration: n,
        calcType: emiCalcType,
        installmentType: emiInstallmentType,
        monthlyEmi,
        totalInterest,
        totalRepayment
      },
      emiSchedule: rows
    };
  }, [emiValidation, emiCalculated, emiCalcType, emiInstallmentType, emiDisbursementDate, emiDueDay]);

  // -------------------------------------------------------------
  // TAB 2: RECURRING CALCULATOR STATE & LOGIC
  // -------------------------------------------------------------
  const [rdMonthlyDeposit, setRdMonthlyDeposit] = useState<string>('');
  const [rdInterestRate, setRdInterestRate] = useState<string>('');
  const [rdTaxRate, setRdTaxRate] = useState<string>('');
  const [rdDurationMonths, setRdDurationMonths] = useState<string>('');
  const [rdCompounding, setRdCompounding] = useState<'Monthly' | 'Quarterly' | 'Yearly'>('Quarterly');
  const [rdDepositTiming, setRdDepositTiming] = useState<'end_of_month' | 'start_of_month'>('end_of_month');
  
  const [rdCalculated, setRdCalculated] = useState<boolean>(false);
  const [rdShowDetail, setRdShowDetail] = useState<boolean>(false);
  const [isExportingRdPdf, setIsExportingRdPdf] = useState<boolean>(false);

  // Validation
  const rdValidation = useMemo(() => {
    const deposit = parseFloat(rdMonthlyDeposit);
    const r = parseFloat(rdInterestRate);
    const tax = parseFloat(rdTaxRate);
    const n = parseInt(rdDurationMonths, 10);
    const errors: string[] = [];
    if (isNaN(deposit) || deposit <= 0) errors.push('Monthly deposit amount must be greater than zero.');
    if (isNaN(r) || r < 0) errors.push('Interest rate must be greater than or equal to 0%.');
    if (isNaN(tax) || tax < 0) errors.push('Tax rate must be greater than or equal to 0%.');
    if (isNaN(n) || n <= 0) errors.push('Deposit duration must be at least 1 month.');
    return { isValid: errors.length === 0, errors, deposit, r, tax, n };
  }, [rdMonthlyDeposit, rdInterestRate, rdTaxRate, rdDurationMonths]);

  // Recurring month-by-month calculation engine
  const { rdSummary, rdSchedule } = useMemo(() => {
    const { isValid, deposit, r, tax, n } = rdValidation;
    if (!isValid || !rdCalculated) {
      return {
        rdSummary: {
          monthlyDeposit: 0,
          interestRate: 0,
          taxRate: 0,
          duration: 0,
          compounding: rdCompounding,
          totalDeposited: 0,
          grossInterest: 0,
          taxDeducted: 0,
          netInterest: 0,
          finalMaturity: 0
        },
        rdSchedule: [] as RecurringScheduleRow[]
      };
    }

    const rows: RecurringScheduleRow[] = [];
    const monthlyRate = (r / 12) / 100;
    const taxFraction = (tax / 100);

    let currentBalance = 0;
    let accruedInterestBucket = 0;
    let totalGrossInterest = 0;
    let totalTaxDeducted = 0;

    const compoundCycleMonths = rdCompounding === 'Monthly' ? 1 : rdCompounding === 'Quarterly' ? 3 : 12;

    const todayBs = getTodayBsString();
    let startYear = 2083;
    let startMonth = 1;
    try {
      const parts = todayBs.split(/[-/]/).map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        startYear = parts[0];
        startMonth = parts[1];
      }
    } catch {
      startYear = 2083;
      startMonth = 1;
    }

    for (let m = 1; m <= n; m++) {
      const eligibleBalance = rdDepositTiming === 'end_of_month' ? currentBalance : currentBalance + deposit;
      const monthInterest = eligibleBalance * monthlyRate;
      accruedInterestBucket += monthInterest;

      const isCapitalizeMonth = (m % compoundCycleMonths === 0) || (m === n);

      let creditedInterest = 0;
      let creditedTax = 0;

      if (isCapitalizeMonth) {
        creditedInterest = Math.round(accruedInterestBucket * 100) / 100;
        creditedTax = Math.round(creditedInterest * taxFraction * 100) / 100;
        const netInterest = creditedInterest - creditedTax;

        currentBalance += deposit + netInterest;
        totalGrossInterest += creditedInterest;
        totalTaxDeducted += creditedTax;
        accruedInterestBucket = 0;
      } else {
        currentBalance += deposit;
      }

      let curMonth = startMonth + m - 1;
      let curYear = startYear;
      while (curMonth > 12) {
        curMonth -= 12;
        curYear += 1;
      }
      const daysInThisMonth = getDaysInNepaliMonth(curYear, curMonth);
      const monthName = NEPALI_MONTH_NAMES[curMonth - 1] || `Month ${curMonth}`;
      const label = `Month ${m} (${monthName} ${curYear} - ${daysInThisMonth} Days)`;

      rows.push({
        sn: m,
        monthLabel: label,
        depositAmount: deposit,
        interestAmount: creditedInterest,
        taxAmount: creditedTax,
        balance: Math.round(currentBalance * 100) / 100
      });
    }

    const totalDeposited = deposit * n;
    const netInterest = totalGrossInterest - totalTaxDeducted;
    const finalMaturity = Math.round((totalDeposited + netInterest) * 100) / 100;

    return {
      rdSummary: {
        monthlyDeposit: deposit,
        interestRate: r,
        taxRate: tax,
        duration: n,
        compounding: rdCompounding,
        totalDeposited,
        grossInterest: totalGrossInterest,
        taxDeducted: totalTaxDeducted,
        netInterest,
        finalMaturity
      },
      rdSchedule: rows
    };
  }, [rdValidation, rdCalculated, rdCompounding, rdDepositTiming]);

  // -------------------------------------------------------------
  // TAB 3: FD CALCULATOR STATE & LOGIC
  // -------------------------------------------------------------
  const [fdPrincipal, setFdPrincipal] = useState<string>('');
  const [fdInterestRate, setFdInterestRate] = useState<string>('');
  const [fdTaxRate, setFdTaxRate] = useState<string>('');
  const [fdDurationMonths, setFdDurationMonths] = useState<string>('');
  const [fdCompounding, setFdCompounding] = useState<'Monthly' | 'Quarterly' | 'Yearly'>('Quarterly');
  
  const [fdCalculated, setFdCalculated] = useState<boolean>(false);
  const [fdShowDetail, setFdShowDetail] = useState<boolean>(false);
  const [isExportingFdPdf, setIsExportingFdPdf] = useState<boolean>(false);

  // Validation
  const fdValidation = useMemo(() => {
    const p = parseFloat(fdPrincipal);
    const r = parseFloat(fdInterestRate);
    const tax = parseFloat(fdTaxRate);
    const n = parseInt(fdDurationMonths, 10);
    const errors: string[] = [];
    if (isNaN(p) || p <= 0) errors.push('Fixed deposit principal must be greater than zero.');
    if (isNaN(r) || r < 0) errors.push('Interest rate must be greater than or equal to 0%.');
    if (isNaN(tax) || tax < 0) errors.push('Tax rate must be greater than or equal to 0%.');
    if (isNaN(n) || n <= 0) errors.push('Deposit duration must be at least 1 month.');
    return { isValid: errors.length === 0, errors, p, r, tax, n };
  }, [fdPrincipal, fdInterestRate, fdTaxRate, fdDurationMonths]);

  // Fixed Deposit Calculation & Schedule
  const { fdSummary, fdSchedule } = useMemo(() => {
    const { isValid, p, r, tax, n } = fdValidation;
    if (!isValid || !fdCalculated) {
      return {
        fdSummary: {
          principal: 0,
          interestRate: 0,
          taxRate: 0,
          duration: 0,
          compounding: fdCompounding,
          grossInterest: 0,
          taxDeducted: 0,
          netInterest: 0,
          finalMaturity: 0
        },
        fdSchedule: [] as FdScheduleRow[]
      };
    }

    const freq = fdCompounding === 'Monthly' ? 12 : fdCompounding === 'Quarterly' ? 4 : 1;
    const periodMonths = 12 / freq; // 1, 3, or 12
    const numFullPeriods = Math.floor(n / periodMonths);
    const remMonths = n % periodMonths;

    const rateFraction = r / 100;
    const periodRate = rateFraction / freq;
    const taxFraction = tax / 100;

    const rows: FdScheduleRow[] = [];
    let currentBalance = p;
    let totalGrossInterest = 0;
    let totalTaxDeducted = 0;

    // Full compounding periods
    for (let k = 1; k <= numFullPeriods; k++) {
      const openBal = currentBalance;
      const periodGrossInt = Math.round(openBal * periodRate * 100) / 100;
      const periodTax = Math.round(periodGrossInt * taxFraction * 100) / 100;
      const periodNetInt = periodGrossInt - periodTax;
      const closeBal = Math.round((openBal + periodNetInt) * 100) / 100;

      totalGrossInterest += periodGrossInt;
      totalTaxDeducted += periodTax;
      currentBalance = closeBal;

      const label = fdCompounding === 'Monthly'
        ? `Month ${k}`
        : fdCompounding === 'Quarterly'
        ? `Quarter ${k}`
        : `Year ${k}`;

      rows.push({
        sn: k,
        periodLabel: label,
        openingBalance: openBal,
        interestAmount: periodGrossInt,
        taxAmount: periodTax,
        closingBalance: closeBal
      });
    }

    // Partial remaining period if duration doesn't align exactly
    if (remMonths > 0) {
      const openBal = currentBalance;
      const partialGrossInt = Math.round(openBal * (rateFraction * (remMonths / 12)) * 100) / 100;
      const partialTax = Math.round(partialGrossInt * taxFraction * 100) / 100;
      const partialNetInt = partialGrossInt - partialTax;
      const closeBal = Math.round((openBal + partialNetInt) * 100) / 100;

      totalGrossInterest += partialGrossInt;
      totalTaxDeducted += partialTax;
      currentBalance = closeBal;

      rows.push({
        sn: numFullPeriods + 1,
        periodLabel: `Final ${remMonths} Month(s)`,
        openingBalance: openBal,
        interestAmount: partialGrossInt,
        taxAmount: partialTax,
        closingBalance: closeBal
      });
    }

    const netInterest = totalGrossInterest - totalTaxDeducted;
    const finalMaturity = Math.round((p + netInterest) * 100) / 100;

    return {
      fdSummary: {
        principal: p,
        interestRate: r,
        taxRate: tax,
        duration: n,
        compounding: fdCompounding,
        grossInterest: totalGrossInterest,
        taxDeducted: totalTaxDeducted,
        netInterest,
        finalMaturity
      },
      fdSchedule: rows
    };
  }, [fdValidation, fdCalculated, fdCompounding]);

  // -------------------------------------------------------------
  // HIGH-QUALITY MULTI-PAGE PDF GENERATOR HELPER
  // -------------------------------------------------------------
  const exportMultiPagePdf = async (
    elementId: string, 
    fileName: string, 
    setLoadingState: (loading: boolean) => void
  ) => {
    const el = document.getElementById(elementId);
    if (!el) {
      alert('Unable to generate printable document. Please refresh and try again.');
      return;
    }

    setLoadingState(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(fileName);
    } catch (err) {
      console.error('PDF Generation Failed:', err);
      alert('Error generating PDF. Please try again.');
    } finally {
      setLoadingState(false);
    }
  };

  const handleDownloadEmiPdf = () => {
    const filename = `EMI_Repayment_Schedule_${emiSummary.principal}_${emiSummary.duration}M.pdf`;
    exportMultiPagePdf('emi-pdf-printable-area', filename, setIsExportingEmiPdf);
  };

  const handleDownloadRdPdf = () => {
    const filename = `Recurring_Deposit_Report_${rdSummary.monthlyDeposit}_${rdSummary.duration}M.pdf`;
    exportMultiPagePdf('rd-pdf-printable-area', filename, setIsExportingRdPdf);
  };

  const handleDownloadFdPdf = () => {
    const filename = `Fixed_Deposit_Report_${fdSummary.principal}_${fdSummary.duration}M.pdf`;
    exportMultiPagePdf('fd-pdf-printable-area', filename, setIsExportingFdPdf);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-16">
      
      {/* Top Header & Sticky Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2">
          
          {/* Back button & Title */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider border border-slate-200 cursor-pointer shadow-2xs active:scale-95"
              title="Go Back"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-700 to-teal-500 text-white flex items-center justify-center shadow-sm">
                <Calculator size={18} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                  Calculator
                </h1>
              </div>
            </div>
          </div>

          {/* Quick Date Badge */}
          <div className="hidden md:flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black">
              Date: {getTodayBsString()}
            </span>
          </div>

        </div>

        {/* Tab Selector Buttons - Compact & Below the Subtitle */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            
            {/* Tab 1: EMI Calculator */}
            <button
              onClick={() => setActiveTab('emi')}
              className={`flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                activeTab === 'emi'
                  ? 'bg-white text-emerald-900 font-black shadow-xs border border-emerald-500'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60 font-bold border border-transparent'
              }`}
            >
              <Calculator size={16} className={activeTab === 'emi' ? 'text-emerald-600' : 'text-slate-500'} />
              <span className="text-xs sm:text-sm font-black whitespace-nowrap">EMI Calculator</span>
            </button>

            {/* Tab 2: Recurring Calculator */}
            <button
              onClick={() => setActiveTab('recurring')}
              className={`flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                activeTab === 'recurring'
                  ? 'bg-white text-teal-900 font-black shadow-xs border border-teal-500'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60 font-bold border border-transparent'
              }`}
            >
              <TrendingUp size={16} className={activeTab === 'recurring' ? 'text-teal-600' : 'text-slate-500'} />
              <span className="text-xs sm:text-sm font-black whitespace-nowrap">Recurring Calculator</span>
            </button>

            {/* Tab 3: FD Calculator */}
            <button
              onClick={() => setActiveTab('fd')}
              className={`flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                activeTab === 'fd'
                  ? 'bg-white text-amber-900 font-black shadow-xs border border-amber-500'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60 font-bold border border-transparent'
              }`}
            >
              <Award size={16} className={activeTab === 'fd' ? 'text-amber-600' : 'text-slate-500'} />
              <span className="text-xs sm:text-sm font-black whitespace-nowrap">FD Calculator</span>
            </button>

          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3">
        
        {/* ========================================================= */}
        {/* TAB 1: EMI CALCULATOR CONTENT */}
        {/* ========================================================= */}
        {activeTab === 'emi' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            
            {/* Top Grid: Form + Results Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* EMI Input Form Card (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-5 bg-emerald-600 rounded-full inline-block" />
                    <h2 className="text-sm font-black text-slate-900 uppercase">
                      EMI Calculator
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setEmiPrincipal('');
                      setEmiInterestRate('');
                      setEmiDurationMonths('');
                      setEmiCalcType('diminishing');
                      setEmiInstallmentType('on_due_date');
                      setEmiDueDay(15);
                      setEmiCalculated(false);
                      setEmiShowDetail(false);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-emerald-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Principal */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                      Principal <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700 font-black text-xs">Rs.</span>
                      <input
                        type="number"
                        min="1"
                        step="1000"
                        value={emiPrincipal}
                        onChange={(e) => setEmiPrincipal(e.target.value)}
                        placeholder="e.g. 500000"
                        className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Interest Rate & Duration in 2 Columns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Interest <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Percent size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700" />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={emiInterestRate}
                          onChange={(e) => setEmiInterestRate(e.target.value)}
                          placeholder="e.g. 14.5"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Duration <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <CalendarIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700" />
                        <input
                          type="number"
                          min="1"
                          max="360"
                          value={emiDurationMonths}
                          onChange={(e) => setEmiDurationMonths(e.target.value)}
                          placeholder="e.g. 24"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculation Type & Installment Type in 2 Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Calculation Type
                      </label>
                      <select
                        value={emiCalcType}
                        onChange={(e) => setEmiCalcType(e.target.value as 'diminishing' | 'flat')}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white text-slate-900 font-bold text-xs outline-none transition-all cursor-pointer"
                      >
                        <option value="diminishing">Diminishing</option>
                        <option value="flat">Flat</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Installment Type
                      </label>
                      <select
                        value={emiInstallmentType}
                        onChange={(e) => setEmiInstallmentType(e.target.value as 'on_due_date' | 'eom')}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white text-slate-900 font-bold text-xs outline-none transition-all cursor-pointer"
                      >
                        <option value="on_due_date">On Due Date</option>
                        <option value="eom">End of Month (EOM)</option>
                      </select>
                    </div>
                  </div>

                  {/* Disbursement Date & Due Day */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Disbursement Date
                      </label>
                      <NepaliDatePicker
                        value={emiDisbursementDate}
                        onChange={(val) => setEmiDisbursementDate(val)}
                        className="w-full"
                      />
                    </div>

                    {emiInstallmentType === 'on_due_date' ? (
                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                          Monthly Due Day (1 - 31)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={emiDueDay}
                          onChange={(e) => setEmiDueDay(parseInt(e.target.value, 10) || 15)}
                          className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col justify-center bg-slate-50 rounded-xl p-2 border border-slate-200 text-slate-600 text-[11px]">
                        <span className="font-bold">EOM Schedule Active:</span>
                        <span>Installments fall on the last day of each month.</span>
                      </div>
                    )}
                  </div>

                  {/* Submit / Calculate Button */}
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => setEmiCalculated(true)}
                      className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                    >
                      <Calculator size={17} />
                      <span>Calculate</span>
                    </button>
                  </div>

                  {/* Validation errors if any */}
                  {emiCalculated && !emiValidation.isValid && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs space-y-1">
                      {emiValidation.errors.map((err, i) => (
                        <div key={i} className="flex items-center space-x-1.5 font-bold">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>

              {/* EMI Results Summary Card (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-5">
                
                {/* Result Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    EMI Calculation Results
                  </h3>
                </div>

                {/* Big Highlight: EMI */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white shadow-lg relative overflow-hidden flex items-center">
                  <div className="relative z-10 flex flex-wrap items-baseline gap-2 sm:gap-3">
                    <span className="text-lg sm:text-xl font-black uppercase tracking-wider text-emerald-200">
                      EMI:
                    </span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl font-black text-emerald-300">Rs.</span>
                      <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                        {formatNPR(emiSummary.monthlyEmi)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-slate-500 mb-0.5">Principal Amount</span>
                    <div className="text-sm font-black text-slate-900">
                      Rs. {formatNPR(emiSummary.principal)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-slate-500 mb-0.5">Interest Rate</span>
                    <div className="text-sm font-black text-emerald-800">
                      {emiSummary.interestRate}%
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-rose-800 mb-0.5">Total Interest</span>
                    <div className="text-sm font-black text-rose-800">
                      Rs. {formatNPR(emiSummary.totalInterest)}
                    </div>
                  </div>

                  <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-teal-800 mb-0.5">Total Repayment</span>
                    <div className="text-sm font-black text-teal-800">
                      Rs. {formatNPR(emiSummary.totalRepayment)}
                    </div>
                  </div>
                </div>

                {/* Actions: Toggle Details & Download PDF */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => setEmiShowDetail(!emiShowDetail)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border border-slate-200"
                  >
                    <FileText size={16} className="text-emerald-700" />
                    <span>{emiShowDetail ? 'Hide Detail Report' : 'Detail Report'}</span>
                    {emiShowDetail ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  <button
                    onClick={handleDownloadEmiPdf}
                    disabled={isExportingEmiPdf || emiSchedule.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-emerald-700/20 active:scale-95 disabled:opacity-50"
                  >
                    <Download size={16} />
                    <span>{isExportingEmiPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                  </button>
                </div>

              </div>
            </div>

            {/* EMI Detailed Month-by-Month Report Table */}
            {emiShowDetail && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                    EMI Repayment Schedule
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white uppercase text-[11px] font-black">
                      <tr>
                        <th className="p-3 border-b border-slate-800 text-center w-12">S.N.</th>
                        <th className="p-3 border-b border-slate-800">Installment Date</th>
                        <th className="p-3 border-b border-slate-800 text-right">Opening Balance</th>
                        <th className="p-3 border-b border-slate-800 text-right bg-slate-800 text-emerald-300">EMI Amount</th>
                        <th className="p-3 border-b border-slate-800 text-right">Principal</th>
                        <th className="p-3 border-b border-slate-800 text-right">Interest</th>
                        <th className="p-3 border-b border-slate-800 text-right">Closing Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {emiSchedule.map((row) => (
                        <tr key={row.sn} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="p-2.5 text-center font-black text-slate-500 bg-slate-50/50">{row.sn}</td>
                          <td className="p-2.5 font-black text-slate-900">{row.dateBs}</td>
                          <td className="p-2.5 text-right">{formatNPR(row.openingBalance)}</td>
                          <td className="p-2.5 text-right font-black text-emerald-700 bg-emerald-50/30">{formatNPR(row.emiAmount)}</td>
                          <td className="p-2.5 text-right text-slate-900">{formatNPR(row.principalAmount)}</td>
                          <td className="p-2.5 text-right text-rose-600">{formatNPR(row.interestAmount)}</td>
                          <td className="p-2.5 text-right font-black text-slate-900">{formatNPR(row.closingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 text-slate-900 font-black text-xs border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={3} className="p-3 text-center uppercase tracking-wider">Total Sum:</td>
                        <td className="p-3 text-right text-emerald-700 text-sm">Rs. {formatNPR(emiSummary.totalRepayment)}</td>
                        <td className="p-3 text-right text-slate-900 text-sm">Rs. {formatNPR(emiSummary.principal)}</td>
                        <td className="p-3 text-right text-rose-700 text-sm">Rs. {formatNPR(emiSummary.totalInterest)}</td>
                        <td className="p-3 text-right text-slate-700 font-black">Rs. 0.00</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="text-[11px] text-slate-500 font-bold italic pt-1">
                  * Final installment includes rounding adjustments to bring the closing principal balance to exactly zero.
                </div>
              </div>
            )}

            {/* Hidden Printable Container for EMI High-Quality PDF */}
            <div className="fixed -left-[9999px] top-0 overflow-visible" aria-hidden="true">
              <div 
                id="emi-pdf-printable-area" 
                className="w-[794px] bg-white p-8 text-slate-900 text-xs font-sans leading-normal"
                style={{ minHeight: '1123px' }}
              >
                {/* Header */}
                <div className="border-b-2 border-emerald-800 pb-4 mb-4 text-center">
                  <h1 className="text-xl font-black text-emerald-950 uppercase tracking-tight">{institutionName}</h1>
                  <p className="text-xs font-bold text-slate-600">{institutionAddress}</p>
                  <div className="inline-block mt-2 px-4 py-1 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-950 text-xs font-black uppercase">
                    EMI Repayment Schedule
                  </div>
                </div>

                {/* Summary Box */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs font-bold">
                  <div>
                    <div>Principal Amount: <strong>Rs. {formatNPR(emiSummary.principal)}</strong></div>
                    <div>Annual Interest Rate: <strong>{emiSummary.interestRate}%</strong></div>
                    <div>Duration: <strong>{emiSummary.duration} Months</strong></div>
                    <div>Calculation Type: <strong>{emiSummary.calcType === 'diminishing' ? 'Diminishing Balance' : 'Flat Rate'}</strong></div>
                  </div>
                  <div>
                    <div>Monthly EMI: <strong className="text-emerald-800 text-sm">Rs. {formatNPR(emiSummary.monthlyEmi)}</strong></div>
                    <div>Total Interest: <strong>Rs. {formatNPR(emiSummary.totalInterest)}</strong></div>
                    <div>Total Repayment: <strong>Rs. {formatNPR(emiSummary.totalRepayment)}</strong></div>
                    <div>Disbursement Date: <strong>{emiDisbursementDate}</strong></div>
                  </div>
                </div>

                {/* Full Schedule Table */}
                <table className="w-full text-left text-[10px] border-collapse border border-slate-300">
                  <thead className="bg-slate-800 text-white font-black text-center">
                    <tr>
                      <th className="p-1.5 border border-slate-400 w-8">S.N.</th>
                      <th className="p-1.5 border border-slate-400">Installment Date</th>
                      <th className="p-1.5 border border-slate-400 text-right">Opening Bal. (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right bg-slate-900">EMI (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right">Principal (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right">Interest (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right">Closing Bal. (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emiSchedule.map((r) => (
                      <tr key={r.sn} className={r.sn % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="p-1 border border-slate-300 text-center font-bold">{r.sn}</td>
                        <td className="p-1 border border-slate-300 font-bold">{r.dateBs}</td>
                        <td className="p-1 border border-slate-300 text-right">{formatNPR(r.openingBalance)}</td>
                        <td className="p-1 border border-slate-300 text-right font-black text-emerald-900">{formatNPR(r.emiAmount)}</td>
                        <td className="p-1 border border-slate-300 text-right">{formatNPR(r.principalAmount)}</td>
                        <td className="p-1 border border-slate-300 text-right text-rose-700">{formatNPR(r.interestAmount)}</td>
                        <td className="p-1 border border-slate-300 text-right font-bold">{formatNPR(r.closingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-200 font-black text-[10px]">
                    <tr>
                      <td colSpan={3} className="p-1.5 border border-slate-400 text-center">Total Sum:</td>
                      <td className="p-1.5 border border-slate-400 text-right text-emerald-900">Rs. {formatNPR(emiSummary.totalRepayment)}</td>
                      <td className="p-1.5 border border-slate-400 text-right">Rs. {formatNPR(emiSummary.principal)}</td>
                      <td className="p-1.5 border border-slate-400 text-right text-rose-800">Rs. {formatNPR(emiSummary.totalInterest)}</td>
                      <td className="p-1.5 border border-slate-400 text-right">Rs. 0.00</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Footer Notice */}
                <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-end text-[9px] text-slate-500 font-bold">
                  <div>
                    Report Generation Date: {getTodayBsString()} | Computer generated electronic statement.
                  </div>
                  <div>
                    Authorized Signature / Official Seal: .......................................
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: RECURRING CALCULATOR CONTENT */}
        {/* ========================================================= */}
        {activeTab === 'recurring' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            
            {/* Top Grid: Form + Results Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Form Card (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-5 bg-teal-600 rounded-full inline-block" />
                    <h2 className="text-sm font-black text-slate-900 uppercase">
                      Recurring Calculator
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setRdMonthlyDeposit('');
                      setRdInterestRate('');
                      setRdTaxRate('');
                      setRdDurationMonths('');
                      setRdCompounding('Quarterly');
                      setRdDepositTiming('end_of_month');
                      setRdCalculated(false);
                      setRdShowDetail(false);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-teal-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Monthly Deposit */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                      Monthly Deposit <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700 font-black text-xs">Rs.</span>
                      <input
                        type="number"
                        min="100"
                        step="500"
                        value={rdMonthlyDeposit}
                        onChange={(e) => setRdMonthlyDeposit(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Interest Rate & Tax in 2 Columns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Interest <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Percent size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700" />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={rdInterestRate}
                          onChange={(e) => setRdInterestRate(e.target.value)}
                          placeholder="e.g. 10.5"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Tax (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Percent size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700" />
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={rdTaxRate}
                          onChange={(e) => setRdTaxRate(e.target.value)}
                          placeholder="e.g. 5.0"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Duration & Compounding in 2 Columns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Duration <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <CalendarIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700" />
                        <input
                          type="number"
                          min="1"
                          max="240"
                          value={rdDurationMonths}
                          onChange={(e) => setRdDurationMonths(e.target.value)}
                          placeholder="e.g. 36"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Compounding Frequency
                      </label>
                      <select
                        value={rdCompounding}
                        onChange={(e) => setRdCompounding(e.target.value as 'Monthly' | 'Quarterly' | 'Yearly')}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white text-slate-900 font-bold text-xs outline-none transition-all cursor-pointer"
                      >
                        <option value="Quarterly">Quarterly Compounding (Default)</option>
                        <option value="Monthly">Monthly Compounding</option>
                        <option value="Yearly">Annual Compounding</option>
                      </select>
                    </div>
                  </div>

                  {/* Deposit Timing convention */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                      Deposit Timing
                    </label>
                    <div className="grid grid-cols-2 gap-2 mt-0.5">
                      <button
                        type="button"
                        onClick={() => setRdDepositTiming('end_of_month')}
                        className={`py-1.5 px-3 rounded-lg text-[11px] font-black text-center transition-all cursor-pointer ${
                          rdDepositTiming === 'end_of_month'
                            ? 'bg-teal-700 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        End of Month (EOM)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRdDepositTiming('start_of_month')}
                        className={`py-1.5 px-3 rounded-lg text-[11px] font-black text-center transition-all cursor-pointer ${
                          rdDepositTiming === 'start_of_month'
                            ? 'bg-teal-700 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        Start of Month
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => setRdCalculated(true)}
                      className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-teal-700/20 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                    >
                      <TrendingUp size={17} />
                      <span>Calculate</span>
                    </button>
                  </div>

                  {/* Validation errors */}
                  {rdCalculated && !rdValidation.isValid && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs space-y-1">
                      {rdValidation.errors.map((err, i) => (
                        <div key={i} className="flex items-center space-x-1.5 font-bold">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>

              {/* Recurring Results Summary Card (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-5">
                
                {/* Result Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Recurring Deposit Results
                  </h3>
                </div>

                {/* Big Highlight: Maturity Amount */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-teal-900 via-emerald-900 to-slate-900 text-white shadow-lg relative overflow-hidden flex items-center">
                  <div className="relative z-10 flex flex-wrap items-baseline gap-2 sm:gap-3">
                    <span className="text-lg sm:text-xl font-black uppercase tracking-wider text-teal-200">
                      Maturity Amount:
                    </span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl font-black text-teal-300">Rs.</span>
                      <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                        {formatNPR(rdSummary.finalMaturity)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-slate-500 mb-0.5">Total Deposited</span>
                    <div className="text-sm font-black text-slate-900">
                      Rs. {formatNPR(rdSummary.totalDeposited)}
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-emerald-800 mb-0.5">Gross Interest</span>
                    <div className="text-sm font-black text-emerald-800">
                      Rs. {formatNPR(rdSummary.grossInterest)}
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-rose-800 mb-0.5">Tax Deducted ({rdSummary.taxRate}%)</span>
                    <div className="text-sm font-black text-rose-800">
                      Rs. {formatNPR(rdSummary.taxDeducted)}
                    </div>
                  </div>

                  <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-teal-800 mb-0.5">Net Interest</span>
                    <div className="text-sm font-black text-teal-800">
                      Rs. {formatNPR(rdSummary.netInterest)}
                    </div>
                  </div>
                </div>

                {/* Actions: Toggle Details & Download PDF */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => setRdShowDetail(!rdShowDetail)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border border-slate-200"
                  >
                    <FileText size={16} className="text-teal-700" />
                    <span>{rdShowDetail ? 'Hide Detail Report' : 'Detail Report'}</span>
                    {rdShowDetail ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  <button
                    onClick={handleDownloadRdPdf}
                    disabled={isExportingRdPdf || rdSchedule.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-teal-700/20 active:scale-95 disabled:opacity-50"
                  >
                    <Download size={16} />
                    <span>{isExportingRdPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                  </button>
                </div>

              </div>
            </div>

            {/* Recurring Detailed Month-by-Month Report Table */}
            {rdShowDetail && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                    Recurring Deposit Calculation Report
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white uppercase text-[11px] font-black">
                      <tr>
                        <th className="p-3 border-b border-slate-800 text-center w-12">S.N.</th>
                        <th className="p-3 border-b border-slate-800">Period</th>
                        <th className="p-3 border-b border-slate-800 text-right">Amount (Rs.)</th>
                        <th className="p-3 border-b border-slate-800 text-right text-emerald-300">Interest (Rs.)</th>
                        <th className="p-3 border-b border-slate-800 text-right text-rose-300">Tax (Rs.)</th>
                        <th className="p-3 border-b border-slate-800 text-right bg-slate-800 text-teal-300">Balance (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {rdSchedule.map((row) => (
                        <tr key={row.sn} className="hover:bg-teal-50/40 transition-colors">
                          <td className="p-2.5 text-center font-black text-slate-500 bg-slate-50/50">{row.sn}</td>
                          <td className="p-2.5 font-black text-slate-900">{row.monthLabel}</td>
                          <td className="p-2.5 text-right font-black">{formatNPR(row.depositAmount)}</td>
                          <td className="p-2.5 text-right text-emerald-700">{row.interestAmount > 0 ? formatNPR(row.interestAmount) : '-'}</td>
                          <td className="p-2.5 text-right text-rose-600">{row.taxAmount > 0 ? formatNPR(row.taxAmount) : '-'}</td>
                          <td className="p-2.5 text-right font-black text-slate-900 bg-teal-50/20">{formatNPR(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 text-slate-900 font-black text-xs border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={2} className="p-3 text-center uppercase tracking-wider">Total:</td>
                        <td className="p-3 text-right text-slate-900 text-sm">Rs. {formatNPR(rdSummary.totalDeposited)}</td>
                        <td className="p-3 text-right text-emerald-700 text-sm">Rs. {formatNPR(rdSummary.grossInterest)}</td>
                        <td className="p-3 text-right text-rose-700 text-sm">Rs. {formatNPR(rdSummary.taxDeducted)}</td>
                        <td className="p-3 text-right text-teal-800 font-black text-sm bg-teal-50">Rs. {formatNPR(rdSummary.finalMaturity)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="text-[11px] text-slate-500 font-bold italic pt-1">
                  * The final closing balance in the table exactly equals the final maturity amount displayed in the summary.
                </div>
              </div>
            )}

            {/* Hidden Printable Container for Recurring PDF */}
            <div className="fixed -left-[9999px] top-0 overflow-visible" aria-hidden="true">
              <div 
                id="rd-pdf-printable-area" 
                className="w-[794px] bg-white p-8 text-slate-900 text-xs font-sans leading-normal"
                style={{ minHeight: '1123px' }}
              >
                {/* Header */}
                <div className="border-b-2 border-teal-800 pb-4 mb-4 text-center">
                  <h1 className="text-xl font-black text-teal-950 uppercase tracking-tight">{institutionName}</h1>
                  <p className="text-xs font-bold text-slate-600">{institutionAddress}</p>
                  <div className="inline-block mt-2 px-4 py-1 bg-teal-100 border border-teal-300 rounded-lg text-teal-950 text-xs font-black uppercase">
                    Recurring Deposit Calculation Report
                  </div>
                </div>

                {/* Summary Box */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs font-bold">
                  <div>
                    <div>Monthly Deposit Amount: <strong>Rs. {formatNPR(rdSummary.monthlyDeposit)}</strong></div>
                    <div>Annual Interest Rate: <strong>{rdSummary.interestRate}%</strong></div>
                    <div>Tax Rate (TDS): <strong>{rdSummary.taxRate}%</strong></div>
                    <div>Deposit Duration: <strong>{rdSummary.duration} Months</strong></div>
                  </div>
                  <div>
                    <div>Compounding Frequency: <strong>{rdSummary.compounding}</strong></div>
                    <div>Total Deposited Amount: <strong>Rs. {formatNPR(rdSummary.totalDeposited)}</strong></div>
                    <div>Net Earned Interest: <strong>Rs. {formatNPR(rdSummary.netInterest)}</strong></div>
                    <div>Final Maturity Amount: <strong className="text-teal-900 text-sm">Rs. {formatNPR(rdSummary.finalMaturity)}</strong></div>
                  </div>
                </div>

                {/* Schedule Table */}
                <table className="w-full text-left text-[10px] border-collapse border border-slate-300">
                  <thead className="bg-slate-800 text-white font-black text-center">
                    <tr>
                      <th className="p-1.5 border border-slate-400 w-8">S.N.</th>
                      <th className="p-1.5 border border-slate-400">Period</th>
                      <th className="p-1.5 border border-slate-400 text-right">Amount (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right">Interest (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right">Tax (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right bg-slate-900">Balance (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdSchedule.map((r) => (
                      <tr key={r.sn} className={r.sn % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="p-1 border border-slate-300 text-center font-bold">{r.sn}</td>
                        <td className="p-1 border border-slate-300 font-bold">{r.monthLabel}</td>
                        <td className="p-1 border border-slate-300 text-right">{formatNPR(r.depositAmount)}</td>
                        <td className="p-1 border border-slate-300 text-right text-emerald-800">{r.interestAmount > 0 ? formatNPR(r.interestAmount) : '-'}</td>
                        <td className="p-1 border border-slate-300 text-right text-rose-700">{r.taxAmount > 0 ? formatNPR(r.taxAmount) : '-'}</td>
                        <td className="p-1 border border-slate-300 text-right font-black text-teal-950">{formatNPR(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-200 font-black text-[10px]">
                    <tr>
                      <td colSpan={2} className="p-1.5 border border-slate-400 text-center">Total:</td>
                      <td className="p-1.5 border border-slate-400 text-right">Rs. {formatNPR(rdSummary.totalDeposited)}</td>
                      <td className="p-1.5 border border-slate-400 text-right text-emerald-900">Rs. {formatNPR(rdSummary.grossInterest)}</td>
                      <td className="p-1.5 border border-slate-400 text-right text-rose-800">Rs. {formatNPR(rdSummary.taxDeducted)}</td>
                      <td className="p-1.5 border border-slate-400 text-right text-teal-950 font-black">Rs. {formatNPR(rdSummary.finalMaturity)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Footer Notice */}
                <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-end text-[9px] text-slate-500 font-bold">
                  <div>
                    Report Generation Date: {getTodayBsString()} | Computer generated electronic statement.
                  </div>
                  <div>
                    Authorized Signature / Official Seal: .......................................
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: FD CALCULATOR / CERTIFICATE CONTENT */}
        {/* ========================================================= */}
        {activeTab === 'fd' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            
            {/* Top Grid: Form + Results Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Form Card (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-5 bg-amber-600 rounded-full inline-block" />
                    <h2 className="text-sm font-black text-slate-900 uppercase">
                      FD Calculator
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setFdPrincipal('');
                      setFdInterestRate('');
                      setFdTaxRate('');
                      setFdDurationMonths('');
                      setFdCompounding('Quarterly');
                      setFdCalculated(false);
                      setFdShowDetail(false);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-amber-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {/* FD Amount */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                      Principal <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700 font-black text-xs">Rs.</span>
                      <input
                        type="number"
                        min="1000"
                        step="10000"
                        value={fdPrincipal}
                        onChange={(e) => setFdPrincipal(e.target.value)}
                        placeholder="e.g. 1000000"
                        className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Interest Rate & Tax in 2 Columns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Interest <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Percent size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700" />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={fdInterestRate}
                          onChange={(e) => setFdInterestRate(e.target.value)}
                          placeholder="e.g. 11.5"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Tax (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Percent size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700" />
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={fdTaxRate}
                          onChange={(e) => setFdTaxRate(e.target.value)}
                          placeholder="e.g. 5.0"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Duration & Compounding in 2 Columns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Duration <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <CalendarIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700" />
                        <input
                          type="number"
                          min="1"
                          max="240"
                          value={fdDurationMonths}
                          onChange={(e) => setFdDurationMonths(e.target.value)}
                          placeholder="e.g. 12"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-600 focus:bg-white text-slate-900 font-black text-sm outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Compounding Frequency
                      </label>
                      <select
                        value={fdCompounding}
                        onChange={(e) => setFdCompounding(e.target.value as 'Monthly' | 'Quarterly' | 'Yearly')}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-600 focus:bg-white text-slate-900 font-bold text-xs outline-none transition-all cursor-pointer"
                      >
                        <option value="Quarterly">Quarterly Compounding (Default)</option>
                        <option value="Monthly">Monthly Compounding</option>
                        <option value="Yearly">Annual Compounding</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                      Quick Presets
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '3 Months', m: '3' },
                        { label: '6 Months', m: '6' },
                        { label: '1 Year', m: '12' },
                        { label: '2 Years', m: '24' }
                      ].map((preset) => (
                        <button
                          key={preset.m}
                          type="button"
                          onClick={() => setFdDurationMonths(preset.m)}
                          className={`py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                            fdDurationMonths === preset.m
                              ? 'bg-amber-700 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => setFdCalculated(true)}
                      className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-amber-700/20 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                    >
                      <Award size={17} />
                      <span>Calculate</span>
                    </button>
                  </div>

                  {/* Validation errors */}
                  {fdCalculated && !fdValidation.isValid && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs space-y-1">
                      {fdValidation.errors.map((err, i) => (
                        <div key={i} className="flex items-center space-x-1.5 font-bold">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>

              {/* FD Results Summary Card (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-5">
                
                {/* Result Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Fixed Deposit Results
                  </h3>
                </div>

                {/* Big Highlight: Maturity Amount */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950 via-amber-900 to-slate-900 text-white shadow-lg relative overflow-hidden flex items-center">
                  <div className="relative z-10 flex flex-wrap items-baseline gap-2 sm:gap-3">
                    <span className="text-lg sm:text-xl font-black uppercase tracking-wider text-amber-200">
                      Maturity Amount:
                    </span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl font-black text-amber-300">Rs.</span>
                      <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                        {formatNPR(fdSummary.finalMaturity)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-slate-500 mb-0.5">FD Principal</span>
                    <div className="text-sm font-black text-slate-900">
                      Rs. {formatNPR(fdSummary.principal)}
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-emerald-800 mb-0.5">Gross Interest</span>
                    <div className="text-sm font-black text-emerald-800">
                      Rs. {formatNPR(fdSummary.grossInterest)}
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-rose-800 mb-0.5">Tax Deducted ({fdSummary.taxRate}%)</span>
                    <div className="text-sm font-black text-rose-800">
                      Rs. {formatNPR(fdSummary.taxDeducted)}
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/70 text-center">
                    <span className="block text-[10px] font-black uppercase text-amber-800 mb-0.5">Net Interest</span>
                    <div className="text-sm font-black text-amber-800">
                      Rs. {formatNPR(fdSummary.netInterest)}
                    </div>
                  </div>
                </div>

                {/* Actions: Toggle Details & Download PDF */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => setFdShowDetail(!fdShowDetail)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border border-slate-200"
                  >
                    <FileText size={16} className="text-amber-700" />
                    <span>{fdShowDetail ? 'Hide Detail Report' : 'Detail Report'}</span>
                    {fdShowDetail ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  <button
                    onClick={handleDownloadFdPdf}
                    disabled={isExportingFdPdf || fdSchedule.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-amber-700/20 active:scale-95 disabled:opacity-50"
                  >
                    <Download size={16} />
                    <span>{isExportingFdPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                  </button>
                </div>

              </div>
            </div>

            {/* FD Detailed Report Table */}
            {fdShowDetail && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                    Fixed Deposit Periodic Compounding Schedule
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white uppercase text-[11px] font-black">
                      <tr>
                        <th className="p-3 border-b border-slate-800 text-center w-12">S.N.</th>
                        <th className="p-3 border-b border-slate-800">Compounding Period</th>
                        <th className="p-3 border-b border-slate-800 text-right">Opening Balance (Rs.)</th>
                        <th className="p-3 border-b border-slate-800 text-right text-emerald-300">Interest (Rs.)</th>
                        <th className="p-3 border-b border-slate-800 text-right text-rose-300">Tax (Rs.)</th>
                        <th className="p-3 border-b border-slate-800 text-right bg-slate-800 text-amber-300">Closing Balance (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {fdSchedule.map((row) => (
                        <tr key={row.sn} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-2.5 text-center font-black text-slate-500 bg-slate-50/50">{row.sn}</td>
                          <td className="p-2.5 font-black text-slate-900">{row.periodLabel}</td>
                          <td className="p-2.5 text-right">{formatNPR(row.openingBalance)}</td>
                          <td className="p-2.5 text-right text-emerald-700">{formatNPR(row.interestAmount)}</td>
                          <td className="p-2.5 text-right text-rose-600">{formatNPR(row.taxAmount)}</td>
                          <td className="p-2.5 text-right font-black text-slate-900 bg-amber-50/20">{formatNPR(row.closingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 text-slate-900 font-black text-xs border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={3} className="p-3 text-center uppercase tracking-wider">Total:</td>
                        <td className="p-3 text-right text-emerald-700 text-sm">Rs. {formatNPR(fdSummary.grossInterest)}</td>
                        <td className="p-3 text-right text-rose-700 text-sm">Rs. {formatNPR(fdSummary.taxDeducted)}</td>
                        <td className="p-3 text-right text-amber-900 font-black text-sm bg-amber-50">Rs. {formatNPR(fdSummary.finalMaturity)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Hidden Printable Container for FD PDF */}
            <div className="fixed -left-[9999px] top-0 overflow-visible" aria-hidden="true">
              <div 
                id="fd-pdf-printable-area" 
                className="w-[794px] bg-white p-8 text-slate-900 text-xs font-sans leading-normal"
                style={{ minHeight: '1123px' }}
              >
                {/* Header */}
                <div className="border-b-2 border-amber-800 pb-4 mb-4 text-center">
                  <h1 className="text-xl font-black text-amber-950 uppercase tracking-tight">{institutionName}</h1>
                  <p className="text-xs font-bold text-slate-600">{institutionAddress}</p>
                  <div className="inline-block mt-2 px-4 py-1 bg-amber-100 border border-amber-300 rounded-lg text-amber-950 text-xs font-black uppercase">
                    Fixed Deposit Calculation Report
                  </div>
                </div>

                {/* Summary Box */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs font-bold">
                  <div>
                    <div>FD Principal Amount: <strong>Rs. {formatNPR(fdSummary.principal)}</strong></div>
                    <div>Annual Interest Rate: <strong>{fdSummary.interestRate}%</strong></div>
                    <div>Deposit Duration: <strong>{fdSummary.duration} Months</strong></div>
                    <div>Compounding Frequency: <strong>{fdSummary.compounding}</strong></div>
                  </div>
                  <div>
                    <div>Tax Rate (TDS): <strong>{fdSummary.taxRate}%</strong></div>
                    <div>Total Gross Interest: <strong>Rs. {formatNPR(fdSummary.grossInterest)}</strong></div>
                    <div>Tax Deducted: <strong>Rs. {formatNPR(fdSummary.taxDeducted)}</strong></div>
                    <div>Final Maturity Amount: <strong className="text-amber-900 text-sm">Rs. {formatNPR(fdSummary.finalMaturity)}</strong></div>
                  </div>
                </div>

                {/* Schedule Table */}
                <table className="w-full text-left text-[10px] border-collapse border border-slate-300">
                  <thead className="bg-slate-800 text-white font-black text-center">
                    <tr>
                      <th className="p-1.5 border border-slate-400 w-8">S.N.</th>
                      <th className="p-1.5 border border-slate-400">Compounding Period</th>
                      <th className="p-1.5 border border-slate-400 text-right">Opening Bal. (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right">Interest (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right">Tax (Rs.)</th>
                      <th className="p-1.5 border border-slate-400 text-right bg-slate-900">Closing Bal. (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fdSchedule.map((r) => (
                      <tr key={r.sn} className={r.sn % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="p-1 border border-slate-300 text-center font-bold">{r.sn}</td>
                        <td className="p-1 border border-slate-300 font-bold">{r.periodLabel}</td>
                        <td className="p-1 border border-slate-300 text-right">{formatNPR(r.openingBalance)}</td>
                        <td className="p-1 border border-slate-300 text-right text-emerald-800">{formatNPR(r.interestAmount)}</td>
                        <td className="p-1 border border-slate-300 text-right text-rose-700">{formatNPR(r.taxAmount)}</td>
                        <td className="p-1 border border-slate-300 text-right font-black text-amber-950">{formatNPR(r.closingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-200 font-black text-[10px]">
                    <tr>
                      <td colSpan={3} className="p-1.5 border border-slate-400 text-center">Total:</td>
                      <td className="p-1.5 border border-slate-400 text-right text-emerald-900">Rs. {formatNPR(fdSummary.grossInterest)}</td>
                      <td className="p-1.5 border border-slate-400 text-right text-rose-800">Rs. {formatNPR(fdSummary.taxDeducted)}</td>
                      <td className="p-1.5 border border-slate-400 text-right text-amber-950 font-black">Rs. {formatNPR(fdSummary.finalMaturity)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Footer Notice */}
                <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-end text-[9px] text-slate-500 font-bold">
                  <div>
                    Report Generation Date: {getTodayBsString()} | Computer generated electronic statement.
                  </div>
                  <div>
                    Authorized Signature / Official Seal: .......................................
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
