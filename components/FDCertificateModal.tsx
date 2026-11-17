import React, { useState, useEffect } from 'react';
import { X, Printer, ShieldCheck, Award, FileText, ChevronRight, Calculator, Sparkles, User, Calendar as CalendarIcon, Hash, Percent, MapPin, PenTool, RefreshCcw, Edit2, Save, Plus, Trash2, RotateCcw, Database, BookmarkPlus, Search, Eye, CheckCircle2 } from 'lucide-react';
import { FDPrintCertificate } from './FDPrintCertificate';
import { NepaliDatePicker } from './NepaliDatePicker';
import { ConfirmationModal } from './ConfirmationModal';
import { storageService } from '../services/storageService';
import { productService } from '../services/productService';
import { useAuth } from '../AuthContext';
import { SystemSettings, FDRecordItem, SavingProduct } from '../types';
import NepaliDate from 'nepali-date-converter';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

// Helper to convert Nepali digits to English digits for calculations
const nepaliToEnglishNumber = (str: string): string => {
  const map: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  return str.replace(/[०-९]/g, (d) => map[d]);
};

// Helper to convert English digits back to Nepali digits for output
const englishToNepaliNumber = (val: string | number): string => {
  const map: Record<string, string> = {
    '0': '०', '1': '१', '2': '२', '3': '३', '4': '४', '5': '५', '6': '६', '7': '७', '8': '८', '9': '९', '.': '.'
  };
  return val.toString().replace(/[0-9.]/g, (d) => map[d] || d);
};

// Helper to convert numbers to Nepali words
const NEP_DIGITS = [
  "शून्य", "एक", "दुई", "तीन", "चार", "पाँच", "छ", "सात", "आठ", "नौ", "दश",
  "एघार", "बाह्र", "तेह्र", "चौध", "पन्ध्र", "सोह्र", "सत्र", "अठार", "उन्नाइस", "बीस",
  "एक्काइस", "बाइस", "तेइस", "चौबिस", "पच्चिस", "छब्बीस", "सत्ताइस", "अठ्ठाइस", "उनन्तीस", "तीस",
  "एकतीस", "बत्तीस", "तेत्तीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अठतीस", "उनन्चालीस", "चालीस",
  "एकचालीस", "बयालीस", "त्रिचालीस", "चवालीस", "पैंतालीस", "छयालीस", "सत्तालीस", "अठचालीस", "उनन्चास", "पचास",
  "एकाउन्न", "बाउन्न", "त्रिपन्न", "चौपन्न", "पचपन्न", "छपन्न", "सन्ताउन्न", "अन्ठाउन्न", "उनन्साठ्ठी", "साठ्ठी",
  "एकसठ्ठी", "बासठ्ठी", "त्रिसठ्ठी", "चौसठ्ठी", "पैंसठ्ठी", "छैसठ्ठी", "सत्सठ्ठी", "अठसठ्ठी", "उनन्सत्तरी", "सत्तरी",
  "एकहत्तर", "बहत्तर", "त्रिहत्तर", "चौहत्तर", "पचहत्तर", "छहत्तर", "सतहत्तर", "अठहत्तर", "उनन्असी", "असी",
  "एकासी", "बयासी", "त्रियासी", "चौरासी", "पचासी", "छयासी", "सत्तासी", "अठासी", "उनन्नब्बे", "नब्बे",
  "एकानब्बे", "बयानब्बे", "त्रियानब्बे", "चौरानब्बे", "पञ्चानब्बे", "छ्यानब्बे", "सन्तानब्बे", "अन्ठानब्बे", "उनन्सय"
];

export const numberToNepaliWords = (n: number): string => {
  if (isNaN(n) || n === 0) return "शून्य रुपैयाँ मात्र ।";
  
  const isNegative = n < 0;
  const absN = Math.abs(n);
  const rupees = Math.floor(absN);
  const paisa = Math.round((absN - rupees) * 100);

  const convertTwoDigits = (num: number): string => {
    if (num <= 0) return "";
    if (num < 100) return NEP_DIGITS[num] || num.toString();
    return num.toString();
  };

  const convertThreeDigits = (num: number): string => {
    let text = "";
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    if (hundred > 0) {
      text += NEP_DIGITS[hundred] + " सय ";
    }
    if (rest > 0) {
      text += convertTwoDigits(rest) + " ";
    }
    return text.trim();
  };

  let words = "";
  if (rupees === 0) {
    words = "शून्य";
  } else {
    let rem = rupees;

    const crore = Math.floor(rem / 10000000);
    rem = rem % 10000000;

    const lakh = Math.floor(rem / 100000);
    rem = rem % 100000;

    const thousand = Math.floor(rem / 1000);
    rem = rem % 1000;

    const hundredAndRest = rem;

    if (crore > 0) {
      words += (crore < 100 ? NEP_DIGITS[crore] : crore.toString()) + " करोड ";
    }
    if (lakh > 0) {
      words += NEP_DIGITS[lakh] + " लाख ";
    }
    if (thousand > 0) {
      words += NEP_DIGITS[thousand] + " हजार ";
    }
    if (hundredAndRest > 0) {
      words += convertThreeDigits(hundredAndRest) + " ";
    }
  }

  let finalStr = words.trim() + " रुपैयाँ";

  if (paisa > 0 && paisa < 100) {
    finalStr += " " + NEP_DIGITS[paisa] + " पैसा";
  }

  finalStr += " मात्र ।";
  if (isNegative) finalStr = "ऋण " + finalStr;
  return finalStr;
};

const ACCOUNT_TYPES = [
  '३ महिने मुद्दती खाता',
  '६ महिने मुद्दती खाता',
  '१ वर्षे मुद्दती खाता',
  '२ वर्षे मुद्दती खाता',
  '३ वर्षे मुद्दती खाता',
  '५ वर्षे मुद्दती खाता',
  '६ वर्षे मुद्दती खाता'
];

const COMPOUNDING_OPTIONS = ['None', 'Quarterly', 'Yearly'];

const BRANCH_LIST = [
  'प्रधान कार्यालय',
  'सहोडवा सेवा केन्द्र',
  'पिपरा सेवा केन्द्र',
  'पर्सा सेवा केन्द्र'
];

const SIGNATORY_MAPPING: Record<string, string> = {
  'प्रधान कार्यालय': 'चन्द्रशेखर मण्डल',
  'सहोडवा सेवा केन्द्र': 'गाेपाल झा',
  'पिपरा सेवा केन्द्र': 'स्वेता कुमारी',
  'पर्सा सेवा केन्द्र': 'मनाेज कुमार साह'
};

const SIGNATORY_LIST = [
  'चन्द्रशेखर मण्डल',
  'गाेपाल झा',
  'स्वेता कुमारी',
  'मनाेज कुमार साह'
];

export interface FDTermItem {
  np: string;
  en: string;
  title?: string;
  text?: string;
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

const DEFAULT_FD_TERMS: FDTermItem[] = [
  {
    np: 'यो प्रमाणपत्र परिपक्व नभएसम्म सुरक्षित राख्नुपर्नेछ र भुक्तानीको समयमा अनिवार्य रूपमा पेश गर्नुपर्नेछ।',
    en: 'This certificate must be kept safely and presented at the time of encashment.'
  },
  {
    np: 'म्याद नाघेपछि मात्र साँवा र ब्याज भुक्तानी लिन सकिनेछ, म्याद अगावै झिक्न चाहेमा संस्थाको प्रचलित नियम अनुसार जरिवाना/छुट कट्टा हुनेछ।',
    en: 'Premature withdrawal is subject to applicable penalty as per institutional policy.'
  },
  {
    np: 'ब्याजमा प्रचलित कानून बमोजिम स्रोतमै कर (TDS) कट्टा गरिनेछ।',
    en: 'Tax will be deducted at source (TDS) on interest as per prevailing law.'
  },
  {
    np: 'प्रमाणपत्र हराएमा वा नष्ट भएमा तुरुन्त सम्बन्धित शाखामा लिखित जानकारी गराई प्रतिलिपिको लागि निवेदन दिनुपर्नेछ।',
    en: 'Loss of certificate must be reported immediately in writing for a duplicate to be issued.'
  },
  {
    np: 'यदि निक्षेपकर्ताले म्याद सकिनु अगावै नवीकरण नगरेमा, संस्थाको नियम अनुसार स्वतः नवीकरण वा साधारण बचत दरमा रूपान्तरण हुन सक्नेछ।',
    en: 'Deposits not renewed at maturity may be auto‑renewed or moved to a regular savings rate, per policy.'
  },
  {
    np: 'यस प्रमाणपत्रमा उल्लेखित रकम र दरमा कुनै त्रुटि भएमा संस्थाको खाता विवरणलाई अन्तिम मानिनेछ।',
    en: "In case of discrepancy, the institution's account records shall be considered final."
  },
  {
    np: 'संयुक्त खाताको हकमा सबै खातावालाहरूको संयुक्त सहमति/हस्ताक्षर बिना भुक्तानी वा परिवर्तन गरिने छैन।',
    en: 'For joint accounts, payment or changes require consent/signature of all account holders.'
  },
  {
    np: 'यो प्रमाणपत्र हस्तान्तरणयोग्य (transferable) छैन, जबसम्म संस्थाले लिखित रूपमा अनुमति नदिएको हुन्छ।',
    en: 'This certificate is non‑transferable unless authorized in writing by the institution.'
  }
];

export const FDCertificateModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { branch, settings: authSettings } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const [settings, setSettings] = useState<SystemSettings | null>(authSettings);
  const [isPrintView, setIsPrintView] = useState(false);

  // Custom Editable Terms State
  const [terms, setTerms] = useState<FDTermItem[]>(() => {
    try {
      const saved = localStorage.getItem('FD_CERTIFICATE_CUSTOM_TERMS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load FD custom terms:", e);
    }
    return DEFAULT_FD_TERMS;
  });

  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [editingTerms, setEditingTerms] = useState<FDTermItem[]>(terms);

  // Dynamic Saving Products configured in Admin Center with MF & FD check
  const [fdSavingProducts, setFdSavingProducts] = useState<SavingProduct[]>([]);

  useEffect(() => {
    const loadFdProducts = async () => {
      try {
        const allProducts = await productService.getSavingProducts();
        const filtered = allProducts.filter(
          p => Boolean(p.showInFD ?? p.showInMicrofinanceAndFD) && p.status !== 'Inactive'
        );
        setFdSavingProducts(filtered);
      } catch (e) {
        console.error("Failed to load FD products:", e);
      }
    };
    loadFdProducts();
    const handleUpdate = () => loadFdProducts();
    window.addEventListener('savingProductsUpdated', handleUpdate);
    return () => window.removeEventListener('savingProductsUpdated', handleUpdate);
  }, []);

  const combinedAccountTypes = React.useMemo(() => {
    const customNames = fdSavingProducts.map(p => p.name);
    const set = new Set([...ACCOUNT_TYPES, ...customNames]);
    return Array.from(set);
  }, [fdSavingProducts]);

  const startEditingTerms = () => {
    setEditingTerms([...terms]);
    setIsEditingTerms(true);
  };

  const handleTermChange = (index: number, field: 'np' | 'en' | 'title' | 'text', val: string) => {
    const updated = [...editingTerms];
    const current = updated[index];
    if (field === 'np' || field === 'text') {
      updated[index] = { ...current, np: val, text: val };
    } else {
      updated[index] = { ...current, en: val, title: val };
    }
    setEditingTerms(updated);
  };

  const handleAddTerm = () => {
    setEditingTerms([...editingTerms, { np: 'नयाँ नियम तथा सर्त विवरण...', en: 'New rule and condition details...' }]);
  };

  const handleRemoveTerm = (index: number) => {
    const updated = editingTerms.filter((_, i) => i !== index);
    setEditingTerms(updated);
  };

  const handleSaveTerms = () => {
    setTerms(editingTerms);
    try {
      localStorage.setItem('FD_CERTIFICATE_CUSTOM_TERMS', JSON.stringify(editingTerms));
    } catch (e) {
      console.error("Error saving FD terms:", e);
    }
    setIsEditingTerms(false);
  };

  const handleResetTerms = () => {
    setEditingTerms(DEFAULT_FD_TERMS);
    setTerms(DEFAULT_FD_TERMS);
    try {
      localStorage.removeItem('FD_CERTIFICATE_CUSTOM_TERMS');
    } catch (e) {
      console.error("Error resetting FD terms:", e);
    }
    setIsEditingTerms(false);
  };

  const [activeTab, setActiveTab] = useState<'editor' | 'records'>('editor');
  const [recordSearch, setRecordSearch] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FDRecordItem | null>(null);

  const [fdRecords, setFdRecords] = useState<FDRecordItem[]>(() => {
    try {
      const saved = localStorage.getItem('FD_CERTIFICATE_RECORDS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to load FD records:", e);
    }
    return [];
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const s = await storageService.getSettings();
        if (s) setSettings(s);
      } catch (e) {
        console.error("Failed to load settings in FDCertificateModal:", e);
      }
      try {
        const recs = await storageService.getFDRecords();
        if (recs && recs.length > 0) {
          setFdRecords(recs);
        }
      } catch (e) {
        console.error("Failed to load FD records in FDCertificateModal:", e);
      }
    };
    fetchInitialData();
  }, []);
  const [data, setData] = useState({
    accountType: '१ वर्षे मुद्दती खाता',
    holderName: '',
    holderNameNp: '',
    accountNo: '',
    selectedBranch: 'प्रधान कार्यालय',
    signatoryName: 'चन्द्रशेखर मण्डल',
    issueDate: new NepaliDate().format('YYYY-MM-DD'),
    maturityDate: '',
    amount: '',
    amountInWords: '',
    duration: '१ वर्ष',
    interestRate: '८.१',
    compounding: 'None',
    tax: '६',
    totalInterest: '0',
    taxDeduction: '0',
    maturityAmount: '0',
    maturityInWords: ''
  });

  const isSixYear = data.accountType.includes('६ वर्षे');
  const showCompounding = data.accountType.includes('१ वर्षे') || 
                        data.accountType.includes('२ वर्षे') || 
                        data.accountType.includes('३ वर्षे') || 
                        data.accountType.includes('५ वर्षे');

  // Sync Duration with Account Type selection
  const handleAccountTypeChange = (val: string) => {
    const matchedProduct = fdSavingProducts.find(p => p.name === val);
    if (matchedProduct) {
      setData(prev => ({ 
        ...prev, 
        accountType: val, 
        duration: prev.duration || '१ वर्ष', 
        interestRate: matchedProduct.interestRate.toString(),
        compounding: (matchedProduct.capitalization === 'Monthly' || matchedProduct.capitalization === 'Quarterly' || matchedProduct.capitalization === 'Half-Yearly' || matchedProduct.capitalization === 'Yearly') ? (matchedProduct.capitalization === 'Monthly' ? 'Quarterly' : matchedProduct.capitalization) : 'None'
      }));
      return;
    }

    let dur = '१ वर्ष';
    if (val.includes('३ महिने')) dur = '३ महिना';
    else if (val.includes('६ महिने')) dur = '६ महिना';
    else if (val.includes('१ वर्षे')) dur = '१ वर्ष';
    else if (val.includes('२ वर्षे')) dur = '२ वर्ष';
    else if (val.includes('३ वर्षे')) dur = '३ वर्ष';
    else if (val.includes('५ वर्षे')) dur = '५ वर्ष';
    else if (val.includes('६ वर्षे')) dur = '६ वर्ष';

    const baseRate = 8.1;
    const finalRate = (dur === '६ वर्ष' || val.includes('६ वर्षे')) ? '२ गुणा' : baseRate.toString();

    // Reset compounding if not applicable
    const isMultiYear = val.includes('१ वर्षे') || val.includes('२ वर्षे') || val.includes('३ वर्षे') || val.includes('५ वर्षे');
    
    setData(prev => ({ 
      ...prev, 
      accountType: val, 
      duration: dur, 
      interestRate: finalRate,
      compounding: isMultiYear ? prev.compounding : 'None'
    }));
  };

  // Sync Signatory with Branch selection
  const handleBranchChange = (branchName: string) => {
    setData(prev => ({
      ...prev,
      selectedBranch: branchName,
      signatoryName: SIGNATORY_MAPPING[branchName] || prev.signatoryName
    }));
  };

  // Effect for Auto Maturity Date
  useEffect(() => {
    if (!data.issueDate || !data.duration) return;
    try {
      const issueDateEng = nepaliToEnglishNumber(data.issueDate);
      const durationEng = nepaliToEnglishNumber(data.duration);
      
      const [y, m, d] = issueDateEng.split('-').map(Number);
      let newY = y;
      let newM = m;
      let newD = d;

      const durationVal = parseInt(durationEng) || 0;

      if (data.duration.includes('वर्ष')) {
        newY += durationVal;
      } else if (data.duration.includes('महिना')) {
        newM += durationVal;
        while (newM > 12) {
          newM -= 12;
          newY += 1;
        }
      }
      
      const mDate = `${newY}-${String(newM).padStart(2, '0')}-${String(newD).padStart(2, '0')}`;
      setData(prev => ({ ...prev, maturityDate: mDate }));
    } catch (e) {
      console.error("Maturity date calc error", e);
    }
  }, [data.issueDate, data.duration]);

  // Effect for Auto Calculations
  useEffect(() => {
    const amountVal = parseFloat(nepaliToEnglishNumber(data.amount)) || 0;
    const rateVal = parseFloat(nepaliToEnglishNumber(data.interestRate)) || 0;
    const taxRateVal = parseFloat(nepaliToEnglishNumber(data.tax)) || 6;
    const durationEng = nepaliToEnglishNumber(data.duration);
    
    let interestGross = 0;
    let taxAmt = 0;
    let netMaturity = 0;

    if (isSixYear) {
      const taxRateDecimal = taxRateVal / 100;
      interestGross = amountVal / (1 - taxRateDecimal);
      taxAmt = interestGross - amountVal;
      netMaturity = amountVal + amountVal;
    } else {
      let years = 1;
      const durNum = parseInt(durationEng) || 1;
      if (data.duration.includes('महिना')) {
        years = durNum / 12;
      } else {
        years = durNum;
      }

      if (data.compounding === 'None') {
        // Simple Interest
        interestGross = (amountVal * rateVal * years) / 100;
      } else {
        // Compound Interest Formula: A = P(1 + r/n)^(nt)
        const n = data.compounding === 'Quarterly' ? 4 : 1;
        const r = rateVal / 100;
        const maturityValueTotal = amountVal * Math.pow((1 + r / n), (n * years));
        interestGross = maturityValueTotal - amountVal;
      }

      taxAmt = (interestGross * taxRateVal) / 100;
      netMaturity = amountVal + interestGross - taxAmt;
    }

    setData(prev => ({
      ...prev,
      totalInterest: parseFloat(interestGross.toFixed(2)).toString(),
      taxDeduction: parseFloat(taxAmt.toFixed(2)).toString(),
      maturityAmount: parseFloat(netMaturity.toFixed(2)).toString(),
      amountInWords: amountVal > 0 ? numberToNepaliWords(amountVal) : '',
      maturityInWords: netMaturity > 0 ? numberToNepaliWords(netMaturity) : ''
    }));
  }, [data.amount, data.interestRate, data.tax, data.duration, data.accountType, data.compounding]);

  const handleRecordFD = async () => {
    if (isDayEndedForBranch()) {
      showToast(getDayEndedBlockMessage());
      return;
    }
    if (!data.holderName && !data.holderNameNp) {
      showToast('Please enter account holder name');
      return;
    }
    const normalizedIssueDate = nepaliToEnglishNumber(data.issueDate);
    if (isBackDateBlockedForEntry(normalizedIssueDate, settings || authSettings)) {
      showToast(getBackDateBlockedMessage(normalizedIssueDate));
      return;
    }

    const newRecord: FDRecordItem = {
      id: `fd-${Date.now()}`,
      ...data,
      createdAt: new NepaliDate().format('YYYY-MM-DD HH:mm')
    };

    const updated = [newRecord, ...fdRecords];
    setFdRecords(updated);
    await storageService.saveFDRecord(newRecord);
    const refreshed = await storageService.getFDRecords();
    if (refreshed && refreshed.length > 0) {
      setFdRecords(refreshed);
    }
    window.dispatchEvent(new Event('storage'));
    showToast('FD Record सफलतापूर्वक सेभ भयो! (Recorded Successfully)');
  };

  const confirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    if (isDayEndedForBranch()) {
      showToast(getDayEndedBlockMessage());
      setRecordToDelete(null);
      return;
    }
    const id = recordToDelete.id;
    setRecordToDelete(null);
    try {
      const updated = fdRecords.filter(r => r.id !== id);
      setFdRecords(updated);
      await storageService.deleteFDRecord(id);
      const refreshed = await storageService.getFDRecords();
      setFdRecords(refreshed || []);
      window.dispatchEvent(new Event('storage'));
      showToast('रेकर्ड हटाइयो (Record Deleted)');
    } catch (e) {
      console.error("Failed to delete FD record:", e);
      showToast('रेकर्ड हटाउन सकिएन');
    }
  };

  const handlePreviewRecord = (rec: FDRecordItem) => {
    setData({
      accountType: rec.accountType || '१ वर्षे मुद्दती खाता',
      holderName: rec.holderName || '',
      holderNameNp: rec.holderNameNp || '',
      accountNo: rec.accountNo || '',
      selectedBranch: rec.selectedBranch || 'प्रधान कार्यालय',
      signatoryName: rec.signatoryName || 'चन्द्रशेखर मण्डल',
      issueDate: rec.issueDate || '',
      maturityDate: rec.maturityDate || '',
      amount: rec.amount || '',
      amountInWords: rec.amountInWords || '',
      duration: rec.duration || '१ वर्ष',
      interestRate: rec.interestRate || '८.१',
      compounding: rec.compounding || 'None',
      tax: rec.tax || '६',
      totalInterest: rec.totalInterest || '0',
      taxDeduction: rec.taxDeduction || '0',
      maturityAmount: rec.maturityAmount || '0',
      maturityInWords: rec.maturityInWords || ''
    });
    setIsPrintView(true);
  };

  const handleLoadRecordToEditor = (rec: FDRecordItem) => {
    setData({
      accountType: rec.accountType || '१ वर्षे मुद्दती खाता',
      holderName: rec.holderName || '',
      holderNameNp: rec.holderNameNp || '',
      accountNo: rec.accountNo || '',
      selectedBranch: rec.selectedBranch || 'प्रधान कार्यालय',
      signatoryName: rec.signatoryName || 'चन्द्रशेखर मण्डल',
      issueDate: rec.issueDate || '',
      maturityDate: rec.maturityDate || '',
      amount: rec.amount || '',
      amountInWords: rec.amountInWords || '',
      duration: rec.duration || '१ वर्ष',
      interestRate: rec.interestRate || '८.१',
      compounding: rec.compounding || 'None',
      tax: rec.tax || '६',
      totalInterest: rec.totalInterest || '0',
      taxDeduction: rec.taxDeduction || '0',
      maturityAmount: rec.maturityAmount || '0',
      maturityInWords: rec.maturityInWords || ''
    });
    setActiveTab('editor');
    showToast('रेकर्ड सम्पादन फारममा लोड गरियो (Loaded into Editor)');
  };

  const filteredRecords = fdRecords.filter(rec => {
    if (!recordSearch.trim()) return true;
    const q = recordSearch.toLowerCase();
    return (
      (rec.holderName || '').toLowerCase().includes(q) ||
      (rec.holderNameNp || '').toLowerCase().includes(q) ||
      (rec.accountNo || '').toLowerCase().includes(q) ||
      (rec.selectedBranch || '').toLowerCase().includes(q) ||
      (rec.issueDate || '').toLowerCase().includes(q) ||
      (rec.accountType || '').toLowerCase().includes(q)
    );
  });

  const currentLogo = settings?.logoUrl || authSettings?.logoUrl;

  if (isPrintView) {
    return (
      <FDPrintCertificate
        data={data}
        settings={settings}
        currentLogo={currentLogo}
        terms={terms}
        isSixYear={isSixYear}
        onBack={() => setIsPrintView(false)}
        onClose={onClose}
      />
    );
  }

  const isDoubleScheme = data.duration === '६ वर्ष' || isSixYear;

  return (
    <div className={activeTab === 'records' ? "fixed inset-0 bg-white z-[6000] flex flex-col w-screen h-screen m-0 p-0 overflow-hidden no-print italic font-black text-slate-950 uppercase" : "fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[6000] flex items-center justify-center p-2 sm:p-4 italic font-black text-slate-950 uppercase no-print"}>
      <div className={activeTab === 'records' ? "bg-white w-full h-full rounded-none shadow-none border-0 flex flex-col overflow-hidden" : "bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[92vh]"}>
        
        {/* Compact Header */}
        {activeTab === 'records' ? (
          <div className="p-3.5 px-6 border-b flex items-center justify-between bg-white shrink-0 relative gap-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-9 h-9 bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-md shrink-0">
                <Database size={18} />
              </div>
              <div className="shrink-0">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tighter text-slate-900 leading-none italic">
                  FD <span className="text-orange-600">CERTIFICATE REGISTER</span>
                </h3>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic opacity-80 flex items-center">
                  <Sparkles size={9} className="mr-1 text-orange-400"/> MUWDATI PRAMANPATRA REGISTER ({fdRecords.length})
                </p>
              </div>

              {/* Search Bar right next to FD CERTIFICATE REGISTER */}
              <div className="relative flex-1 max-w-lg ml-4 hidden sm:block">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  placeholder="नाम, खाता नं, शाखा, वा मितिबाट खोज्नुहोस्..."
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-orange-500 focus:bg-white transition-all shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer active:scale-95"
              >
                <Plus size={14} />
                <span>नयाँ FD फारम</span>
              </button>

              <button onClick={onClose} className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all border border-slate-100 cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            {toastMsg && (
              <div className="absolute top-14 right-6 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl border border-slate-700 text-xs font-black flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 italic">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>{toastMsg}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 px-6 border-b flex items-center justify-between bg-white shrink-0 relative">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-md">
                <Award size={18} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 leading-none italic">
                  FD <span className="text-orange-600">CERTIFICATE</span>
                </h3>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic opacity-80 flex items-center">
                  <Sparkles size={9} className="mr-1 text-orange-400"/> MUWDATI PRAMANPATRA GENERATOR
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('records')}
                className="px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border cursor-pointer bg-orange-50 text-orange-950 border-orange-200 hover:bg-orange-100 shadow-2xs"
                title="सबै FD रेकर्ड सूची हेर्नुहोस्"
              >
                <Database size={14} className="text-orange-600" />
                <span>FD Records</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-orange-200 text-orange-900">
                  {fdRecords.length}
                </span>
              </button>

              <button onClick={onClose} className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all border border-slate-100 cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            {toastMsg && (
              <div className="absolute top-14 right-6 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl border border-slate-700 text-xs font-black flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 italic">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>{toastMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Content Tabs (Editor vs Records) */}
        <div className={activeTab === 'records' ? "flex-1 overflow-hidden p-4 sm:p-6 bg-slate-50/50 flex flex-col space-y-3" : "flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide bg-white"}>
           {activeTab === 'records' ? (
              <div className="flex-1 overflow-hidden flex flex-col space-y-3 not-italic">
                 {/* Mobile Search Bar */}
                 <div className="relative sm:hidden">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={recordSearch}
                      onChange={(e) => setRecordSearch(e.target.value)}
                      placeholder="नाम, खाता नं, शाखा, वा मितिबाट खोज्नुहोस्..."
                      className="w-full h-8 bg-white border border-slate-200 rounded-xl pl-9 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-orange-500 shadow-2xs"
                    />
                 </div>

                 {/* Full Height Records Table */}
                 <div className="flex-1 overflow-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                       <thead className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                          <tr>
                             <th className="p-3 pl-4 border-b border-slate-800">S.N.</th>
                             <th className="p-3 border-b border-slate-800">Name (नाम)</th>
                             <th className="p-3 border-b border-slate-800">Account Type</th>
                             <th className="p-3 border-b border-slate-800">Branch</th>
                             <th className="p-3 border-b border-slate-800">FD Date</th>
                             <th className="p-3 border-b border-slate-800">Maturity Date</th>
                             <th className="p-3 border-b border-slate-800 text-right">Principal</th>
                             <th className="p-3 border-b border-slate-800 text-right">Int</th>
                             <th className="p-3 border-b border-slate-800 text-right">Tax</th>
                             <th className="p-3 border-b border-slate-800 text-right">Maturity Amount</th>
                             <th className="p-3 pr-4 border-b border-slate-800 text-center">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                          {filteredRecords.length === 0 ? (
                             <tr>
                                <td colSpan={11} className="p-12 text-center text-slate-400 italic font-semibold">
                                   {recordSearch ? 'खोजिएको विवरण अनुसार कुनै FD रेकर्ड भेटिएन' : 'कुनै पनि FD रेकर्ड राखिएको छैन। नयाँ FD फारम भरेर "Record FD" मा थिच्नुहोस्।'}
                                </td>
                             </tr>
                          ) : (
                             filteredRecords.map((rec, idx) => (
                                <tr key={rec.id} className="hover:bg-orange-50/50 transition-colors">
                                   <td className="p-3 pl-4 font-mono font-bold text-slate-400 text-xs">{idx + 1}</td>
                                   <td className="p-3">
                                      <div className="font-black text-slate-950 uppercase text-xs">{rec.holderNameNp || rec.holderName || '-'}</div>
                                      {rec.holderName && rec.holderNameNp && (
                                         <div className="text-[10px] text-slate-400 uppercase font-semibold">{rec.holderName}</div>
                                      )}
                                      <div className="text-[10px] text-slate-400 font-mono">Acc: {englishToNepaliNumber(rec.accountNo || '-')}</div>
                                   </td>
                                   <td className="p-3 text-xs font-semibold text-slate-700">{rec.accountType}</td>
                                   <td className="p-3 text-xs text-emerald-800 font-bold">{rec.selectedBranch}</td>
                                   <td className="p-3 font-mono text-xs text-slate-700">{englishToNepaliNumber(rec.issueDate || '-')}</td>
                                   <td className="p-3 font-mono text-xs text-slate-700">{englishToNepaliNumber(rec.maturityDate || '-')}</td>
                                   <td className="p-3 text-right font-mono font-black text-slate-900 text-xs">
                                      रू. {englishToNepaliNumber(parseFloat(nepaliToEnglishNumber(rec.amount || '0')).toLocaleString())}
                                   </td>
                                   <td className="p-3 text-right font-mono font-bold text-emerald-600 text-xs">
                                      रू. {englishToNepaliNumber(parseFloat(rec.totalInterest || '0').toLocaleString())}
                                   </td>
                                   <td className="p-3 text-right font-mono font-bold text-rose-500 text-xs">
                                      रू. {englishToNepaliNumber(parseFloat(rec.taxDeduction || '0').toLocaleString())}
                                   </td>
                                   <td className="p-3 text-right font-mono font-black text-slate-950 text-xs">
                                      रू. {englishToNepaliNumber(parseFloat(rec.maturityAmount || '0').toLocaleString())}
                                   </td>
                                   <td className="p-3 pr-4 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center space-x-1.5">
                                         <button
                                           type="button"
                                           onClick={() => handlePreviewRecord(rec)}
                                           className="px-3 py-1 bg-slate-900 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-2xs transition-all cursor-pointer"
                                           title="Preview & Print PDF Certificate"
                                         >
                                           <Printer size={12} />
                                           <span>Preview & Print</span>
                                         </button>
                                         <button
                                           type="button"
                                           onClick={() => handleLoadRecordToEditor(rec)}
                                           className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                           title="फारममा लोड गर्नुहोस्"
                                         >
                                           <Edit2 size={13} />
                                         </button>
                                         <button
                                           type="button"
                                           disabled={isDayEnded}
                                           onClick={() => setRecordToDelete(rec)}
                                           className="p-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-600 rounded-lg transition-colors cursor-pointer"
                                           title={isDayEnded ? getDayEndedBlockMessage() : 'Delete Record'}
                                         >
                                           <Trash2 size={13} />
                                         </button>
                                      </div>
                                   </td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           ) : (
           <DayEndFieldset branchId={branch?.id}>
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Form Entry */}
              <div className="lg:col-span-7 space-y-2.5">
                 <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                       <label className="text-[8px] font-black uppercase text-slate-400 ml-1 tracking-widest flex items-center"><FileText size={9} className="mr-1"/> खाताको प्रकार</label>
                       <select 
                         value={data.accountType} 
                         onChange={e => handleAccountTypeChange(e.target.value)} 
                         className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-[10px] outline-none focus:border-orange-500 shadow-sm uppercase appearance-none"
                       >
                         {combinedAccountTypes.map(type => <option key={type} value={type}>{type}</option>)}
                       </select>
                    </div>
                    <div className="space-y-0.5">
                       <label className="text-[8px] font-black text-slate-400 ml-1 tracking-widest flex items-center"><MapPin size={9} className="mr-1"/> शाखा / सेवा केन्द्र</label>
                       <select 
                         value={data.selectedBranch} 
                         onChange={e => handleBranchChange(e.target.value)} 
                         className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-[10px] outline-none focus:border-orange-500 shadow-sm uppercase appearance-none"
                       >
                         {BRANCH_LIST.map(br => <option key={br} value={br}>{br}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                       <label className="text-[8px] font-black text-slate-400 ml-1 tracking-widest flex items-center"><User size={9} className="mr-1"/> खाताधारीको नाम (ENGLISH)</label>
                       <input type="text" value={data.holderName} onChange={e => setData({...data, holderName: e.target.value})} placeholder="FULL LEGAL NAME" className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-xs outline-none focus:border-orange-500 shadow-sm uppercase" />
                    </div>
                    <div className="space-y-0.5">
                       <label className="text-[8px] font-black text-slate-400 ml-1 tracking-widest flex items-center"><User size={9} className="mr-1"/> खाताधारीको नाम (नेपालीमा)</label>
                       <input type="text" value={data.holderNameNp} onChange={e => setData({...data, holderNameNp: e.target.value})} placeholder="पुरा नाम (नेपाली)" className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-xs outline-none focus:border-orange-500 shadow-sm" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                       <label className="text-[8px] font-black text-slate-400 ml-1 tracking-widest flex items-center"><Hash size={9} className="mr-1"/> खाता नं.</label>
                       <input type="text" value={data.accountNo} onChange={e => setData({...data, accountNo: e.target.value})} className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-xs outline-none focus:border-orange-500 shadow-sm font-mono" />
                    </div>
                    <div className="space-y-0.5">
                       <label className="text-[8px] font-black text-slate-400 ml-1 tracking-widest flex items-center"><PenTool size={9} className="mr-1"/> प्रमाणित गर्ने (हस्ताक्षरकर्ता)</label>
                       <select 
                         value={data.signatoryName} 
                         onChange={e => setData({...data, signatoryName: e.target.value})} 
                         className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-[10px] outline-none focus:border-orange-500 shadow-sm uppercase appearance-none"
                       >
                         {SIGNATORY_LIST.map(name => <option key={name} value={name}>{name}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                       <label className="text-[8px] font-black text-slate-400 ml-1 tracking-widest">मुद्दती मिति (BS)</label>
                       <NepaliDatePicker value={data.issueDate} onChange={v => setData({...data, issueDate: v})} disallowBackDateIfDisabled={true} disabled={isDayEnded} className="w-full scale-90 origin-left" />
                    </div>
                    <div className="space-y-0.5">
                       <label className="text-[8px] font-black text-slate-400 ml-1 tracking-widest">ब्याज दर (%)</label>
                       <input 
                         type="text" 
                         value={data.interestRate} 
                         onChange={e => setData({...data, interestRate: e.target.value})} 
                         disabled={isDoubleScheme}
                         className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-xs outline-none focus:border-orange-500 shadow-sm disabled:bg-slate-100 disabled:text-slate-500" 
                         placeholder="Interest Rate %"
                       />
                    </div>
                 </div>

                 {showCompounding && (
                    <div className="grid grid-cols-2 gap-2.5 animate-in slide-in-from-top-2 duration-300">
                       <div className="space-y-0.5">
                          <label className="text-[8px] font-black uppercase text-orange-600 ml-1 tracking-widest flex items-center">
                             <RefreshCcw size={9} className="mr-1"/> Interest Compounding
                          </label>
                          <select 
                            value={data.compounding} 
                            onChange={e => setData({...data, compounding: e.target.value})} 
                            className="w-full h-8 bg-orange-50 border border-orange-200 rounded-lg px-3 font-black text-[10px] outline-none focus:border-orange-500 shadow-sm uppercase appearance-none"
                          >
                            {COMPOUNDING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                       </div>
                    </div>
                 )}

                 <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 ml-1 tracking-widest">मुद्दती रकम (रू अंकमा)</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-600 italic">रू.</span>
                       <input type="text" value={data.amount} onChange={e => setData({...data, amount: e.target.value})} className="w-full h-9 bg-white border border-slate-200 rounded-xl pl-8 pr-4 font-black text-lg outline-none focus:border-orange-500 transition-all shadow-sm" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-0.5">
                       <label className="text-[7px] font-black text-slate-400 ml-1 tracking-widest uppercase">रकम अक्षरेपी (AUTO)</label>
                       <input type="text" value={data.amountInWords} readOnly className="w-full h-7 bg-slate-50 border border-slate-200 rounded-lg px-2 font-black text-[9px] outline-none shadow-inner text-slate-500 italic" />
                    </div>
                    <div className="space-y-0.5">
                       <label className="text-[7px] font-black text-slate-400 ml-1 tracking-widest uppercase">भुक्तानी अक्षरेपी (AUTO)</label>
                       <input type="text" value={data.maturityInWords} readOnly className="w-full h-7 bg-slate-50 border border-slate-200 rounded-lg px-2 font-black text-[9px] outline-none shadow-inner text-slate-500 italic" />
                    </div>
                 </div>
              </div>

              {/* STATS & TERMS SECTION */}
              <div className="lg:col-span-5 space-y-3">
                 <div className="bg-rose-50/40 p-3.5 rounded-2xl border border-rose-100 shadow-sm space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                       <h4 className="text-xs font-black tracking-tight text-rose-900 font-serif">गणना विवरण (Calculation Summary)</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm text-left">
                          <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">मुद्दती रकम</span>
                          <span className="text-xs font-black italic tracking-tighter">रू. {englishToNepaliNumber(parseFloat(nepaliToEnglishNumber(data.amount || '0')).toLocaleString())}/-</span>
                       </div>
                       <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm text-left">
                          <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ब्याज दर</span>
                          <span className="text-xs font-black italic tracking-tighter">{isDoubleScheme ? '२ गुणा' : englishToNepaliNumber(data.interestRate) + '%'}</span>
                       </div>
                       <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm text-left">
                          <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">कुल ब्याज</span>
                          <span className="text-xs font-black italic tracking-tighter text-emerald-600">रू. {englishToNepaliNumber(parseFloat(data.totalInterest || '0').toLocaleString())}/-</span>
                       </div>
                       <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm text-left">
                          <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">कर कट्टी ({englishToNepaliNumber(data.tax)}%)</span>
                          <span className="text-xs font-black italic tracking-tighter text-rose-500">रू. {englishToNepaliNumber(parseFloat(data.taxDeduction || '0').toLocaleString())}/-</span>
                       </div>
                    </div>

                    <div className="bg-rose-100/60 border border-rose-200 p-2.5 rounded-xl text-left">
                       <span className="block text-[7px] font-black text-rose-900 uppercase tracking-[0.15em] mb-0.5 opacity-70">भुक्तानी रकम (Net Payable)</span>
                       <span className="text-lg font-black italic tracking-tighter text-rose-600 leading-none">
                          रू. {englishToNepaliNumber(parseFloat(data.maturityAmount || '0').toLocaleString())}/-
                       </span>
                    </div>
                 </div>

                 {/* Integrated Rules & Terms Panel in Modal */}
                  {!isEditingTerms ? (
                 <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1.5 text-slate-900 not-italic">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                       <span className="text-[10px] font-black text-slate-950 uppercase tracking-wider italic flex items-center">
                          <ShieldCheck size={12} className="mr-1 text-emerald-600"/> नियम तथा सर्तहरू (Certificate Rules)
                       </span>
                       <button 
                          type="button"
                          onClick={startEditingTerms}
                          className="px-2 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-900 rounded-md text-[8.5px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all border border-orange-200 cursor-pointer"
                        >
                          <Edit2 size={10} />
                          <span>नियम सम्पादन</span>
                        </button>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[8.5px] leading-snug text-slate-800 font-bold">
                       {terms.map((term, idx) => (
                          <li key={idx}>
                             <span className="font-bold text-slate-950">{term.np || term.text}</span>
                             {(term.en || term.title) && (
                               <span className="block text-[8px] italic text-slate-500 ml-3">
                                 {term.en || term.title}
                               </span>
                             )}
                          </li>
                       ))}
                    </ol>
                 </div>
                 ) : (
                    <div className="bg-orange-50/90 border border-orange-200 p-3 rounded-2xl space-y-2 text-slate-900 not-italic animate-in fade-in duration-200">
                       <div className="flex items-center justify-between border-b border-orange-200 pb-1.5">
                          <span className="text-[10px] font-black text-orange-950 uppercase tracking-wider italic flex items-center">
                             <Edit2 size={12} className="mr-1 text-orange-600"/> नियम सम्पादन गर्दै (Editing Rules)
                          </span>
                          <div className="flex items-center space-x-1">
                             <button 
                               type="button"
                               onClick={handleResetTerms}
                               className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-[8.5px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer"
                               title="मूल डिफ़ल्ट नियमहरूमा फर्काउनुहोस्"
                             >
                               <RotateCcw size={9} />
                               <span>रिसेट</span>
                             </button>
                             <button 
                               type="button"
                               onClick={() => setIsEditingTerms(false)}
                               className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
                             >
                               रद्द
                             </button>
                             <button 
                               type="button"
                               onClick={handleSaveTerms}
                               className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[8.5px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                             >
                               <Save size={9} />
                               <span>सेभ गर्नुहोस्</span>
                             </button>
                          </div>
                       </div>

                       <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {editingTerms.map((term, idx) => (
                             <div key={idx} className="bg-white p-2 rounded-xl border border-orange-200 space-y-1 shadow-2xs">
                                <div className="flex items-center justify-between gap-1.5">
                                   <span className="text-[9px] font-black text-slate-400 w-3">{idx + 1}.</span>
                                   <span className="text-[8.5px] font-bold text-slate-600 flex-1">नेपाली विवरण र अङ्ग्रेजी अनुवाद</span>
                                   <button
                                     type="button"
                                     onClick={() => handleRemoveTerm(idx)}
                                     className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                     title="हटाउनुहोस्"
                                   >
                                     <Trash2 size={11} />
                                   </button>
                                </div>
                                <textarea
                                  value={term.np || term.text || ''}
                                  onChange={(e) => handleTermChange(idx, 'np', e.target.value)}
                                  placeholder="नेपाली विवरण (Nepali clause)..."
                                  rows={2}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-md p-1.5 text-[9px] font-bold text-slate-800 outline-none focus:border-orange-500 resize-y"
                                />
                                <input
                                  type="text"
                                  value={term.en || term.title || ''}
                                  onChange={(e) => handleTermChange(idx, 'en', e.target.value)}
                                  placeholder="English Translation / Subtitle..."
                                  className="w-full h-6 bg-slate-50 border border-slate-200 rounded-md px-2 text-[8.5px] italic text-slate-700 outline-none focus:border-orange-500"
                                />
                             </div>
                          ))}
                       </div>

                       <button
                         type="button"
                         onClick={handleAddTerm}
                         className="w-full py-1.5 bg-white hover:bg-orange-100/80 border border-dashed border-orange-300 text-orange-900 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center space-x-1 transition-all cursor-pointer shadow-2xs"
                       >
                         <Plus size={11} />
                         <span>नयाँ नियम थप्नुहोस् (Add Rule)</span>
                       </button>
                    </div>
                 )}
              </div>
           </div>
           </DayEndFieldset>
           )}
        </div>

        {/* Footer */}
        {activeTab === 'records' ? (
          <div className="p-3 border-t bg-slate-50 shrink-0 flex justify-between items-center px-6">
             <div className="flex items-center space-x-2 text-slate-500 text-[9px] font-black uppercase tracking-widest italic opacity-80">
                <Database size={12} className="text-orange-600"/>
                <span>FD CERTIFICATE REGISTER • कुल {filteredRecords.length} रेकर्डहरू</span>
             </div>

             <div className="flex items-center space-x-2">
                <button 
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-5 h-9 rounded-xl font-black uppercase text-[10px] tracking-[0.12em] shadow-md transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>नयाँ FD फारम</span>
                </button>
             </div>
          </div>
        ) : (
          <div className="p-3 border-t bg-slate-50 shrink-0 flex justify-between items-center px-6">
             <div className="flex items-center space-x-2 text-slate-400 text-[8px] font-black uppercase tracking-widest italic opacity-70">
                <ShieldCheck size={12} className="text-emerald-500"/>
                <span>Authorized Printing Hub • Half A4 Certificate + Rules</span>
             </div>

             <div className="flex items-center space-x-2">
                <button 
                  type="button"
                  onClick={handleRecordFD}
                  disabled={isDayEnded}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 h-9 rounded-xl font-black uppercase text-[10px] tracking-[0.12em] shadow-md transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
                  title={isDayEnded ? getDayEndedBlockMessage() : "Save FD details to record list"}
                >
                  <BookmarkPlus size={14} />
                  <span>Record FD</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setIsPrintView(true)}
                  className="bg-slate-950 text-white px-6 h-9 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-md hover:bg-orange-600 transition-all active:scale-95 flex items-center space-x-2 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Preview & Print</span>
                </button>
             </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!recordToDelete}
        title="FD रेकर्ड हटाउने पुष्टि"
        message={`के तपाईं "${recordToDelete?.holderNameNp || recordToDelete?.holderName || 'यो'}" को मुद्दती निक्षेप (FD) रेकर्ड साँच्चिकै मेटाउन चाहनुहुन्छ? यो कार्य फिर्ता गर्न सकिने छैन।`}
        confirmLabel="हटाउनुहोस् (Delete)"
        cancelLabel="रद्द गर्नुहोस् (Cancel)"
        variant="danger"
        onConfirm={confirmDeleteRecord}
        onCancel={() => setRecordToDelete(null)}
      />
    </div>
  );
};
