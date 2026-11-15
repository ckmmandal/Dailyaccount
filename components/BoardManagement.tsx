import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, Users, ShieldCheck, Plus, Search, 
  Edit2, Trash2, Eye, CheckCircle2, AlertTriangle, 
  Printer, X, Filter,
  Wallet, Archive as ArchiveIcon,
  Maximize2, Minimize2, FileDown, Loader2, FileText
} from 'lucide-react';
import { 
  BoardCategory, BoardDesignation, BoardMember, BoardAllowanceSheet, BoardMonthlyAllowanceItem, 
  Branch, SystemSettings, Employee 
} from '../types';
import { storageService } from '../services/storageService';
import NepaliDate from 'nepali-date-converter';
import { BoardKYMFormModal } from './BoardKYMFormModal';
import { BoardKYMDetailView, BoardKYMPrintableContent, generateKYMDocPdf } from './BoardKYMDetailView';
import { BoardDocumentsHub } from './BoardDocumentsHub';
import { RatauliOfficialEmblem } from './RatauliLogo';
import { useDayEndLock, getDayEndedBlockMessage } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

interface Props {
  currentBranch?: Branch | null;
  settings?: SystemSettings | null;
}

type TabType = 'team' | 'committees' | 'designations' | 'payroll' | 'archive' | 'documents';
type PaymentFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

const FREQUENCY_OPTIONS: { id: PaymentFrequency; label: string; labelNp: string }[] = [
  { id: 'monthly', label: 'Monthly', labelNp: 'मासिक' },
  { id: 'quarterly', label: 'Quarterly', labelNp: 'त्रैमासिक' },
  { id: 'half_yearly', label: 'Half Yearly', labelNp: 'अर्धवार्षिक' },
  { id: 'yearly', label: 'Yearly', labelNp: 'वार्षिक' }
];

const FISCAL_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Asoj', 
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const MONTHS_BY_FREQUENCY: Record<PaymentFrequency, string[]> = {
  monthly: FISCAL_MONTHS,
  quarterly: ['Asoj', 'Poush', 'Chaitra', 'Ashadh'],
  half_yearly: ['Poush', 'Ashadh'],
  yearly: ['Ashadh']
};

const toNepaliNum = (str: string | number | undefined | null): string => {
  if (str === undefined || str === null) return '';
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(str).replace(/[0-9]/g, d => nepaliDigits[Number(d)]);
};

const NEPALI_MONTH_NAME_MAP: Record<string, string> = {
  Baisakh: 'बैशाख',
  Jestha: 'जेठ',
  Ashadh: 'असार',
  Shrawan: 'साउन',
  Bhadra: 'भदौ',
  Asoj: 'असोज',
  Ashwin: 'असोज',
  Kartik: 'कार्तिक',
  Mangsir: 'मंसिर',
  Poush: 'पुष',
  Magh: 'माघ',
  Falgun: 'फागुन',
  Chaitra: 'चैत'
};

const DEFAULT_CATEGORIES: BoardCategory[] = [
  { id: 'cat_bod', name: 'Board of Directors', code: 'BOD', description: 'Apex governing body of the cooperative', maxMembers: 9, displayOrder: 1 },
  { id: 'cat_asc', name: 'Audit & Supervisory Committee', code: 'ASC', description: 'Internal audit and statutory compliance oversight', maxMembers: 3, displayOrder: 2 },
  { id: 'cat_lsc', name: 'Loan Sub-Committee', code: 'LSC', description: 'Credit risk, collateral evaluation and loan sanctions', maxMembers: 3, displayOrder: 3 },
  { id: 'cat_esc', name: 'Education & Training Sub-Committee', code: 'ESC', description: 'Member education, financial literacy and social activities', maxMembers: 3, displayOrder: 4 }
];

const DEFAULT_DESIGNATIONS: BoardDesignation[] = [
  { id: 'des_001', title: 'अध्यक्ष (Chairperson)', code: 'CHAIR', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'समग्र संस्थाको नेतृत्व, नीति निर्माण, वार्षिक साधारण सभा तथा सञ्चालक समितिको बैठक अध्यक्षता', defaultAllowance: 5000, displayOrder: 1, isCustom: false },
  { id: 'des_002', title: 'उपाध्यक्ष (Vice-Chairperson)', code: 'VCHAIR', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'अध्यक्षको अनुपस्थितिमा सम्पूर्ण कार्यभार सञ्चालन, उप-समितिहरूको अनुगमन तथा सहजीकरण', defaultAllowance: 4500, displayOrder: 2, isCustom: false },
  { id: 'des_003', title: 'सचिव (Secretary)', code: 'SEC', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'बैठक सञ्चालन, माइन्युट प्रमाणीकरण, अभिलेख संरक्षण तथा संस्थागत पत्राचार', defaultAllowance: 4000, displayOrder: 3, isCustom: false },
  { id: 'des_004', title: 'सह-सचिव (Joint-Secretary)', code: 'JSEC', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'सचिवलाई सघाउने तथा सचिवको अनुपस्थितिमा दैनिक कार्य सम्पादन', defaultAllowance: 3500, displayOrder: 4, isCustom: false },
  { id: 'des_005', title: 'कोषाध्यक्ष (Treasurer)', code: 'TREAS', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'वार्षिक बजेट, वित्तीय योजना तर्जुमा, आन्तरिक नियन्त्रण प्रणाली तथा कोष व्यवस्थापन', defaultAllowance: 4000, displayOrder: 5, isCustom: false },
  { id: 'des_006', title: 'सञ्चालक सदस्य (Board Member)', code: 'MEM', categoryId: 'cat_bod', categoryName: 'Board of Directors', mandate: 'सञ्चालक समितिको नीतिगत निर्णय प्रक्रियामा सहभागिता तथा संस्थागत अनुगमन', defaultAllowance: 3000, displayOrder: 6, isCustom: false },
  { id: 'des_007', title: 'संयोजक (Coordinator - Audit Committee)', code: 'COORD_ASC', categoryId: 'cat_asc', categoryName: 'Audit & Supervisory Committee', mandate: 'लेखा तथा सुपरीवेक्षण समितिको नेतृत्व, त्रैमासिक आन्तरिक लेखापरीक्षण प्रतिवेदन', defaultAllowance: 3500, displayOrder: 7, isCustom: false },
  { id: 'des_008', title: 'सदस्य (Member - Audit Committee)', code: 'MEM_ASC', categoryId: 'cat_asc', categoryName: 'Audit & Supervisory Committee', mandate: 'लेखा सुपरीवेक्षण कार्यमा सहयोग तथा वित्तीय विवरण जाँच', defaultAllowance: 2500, displayOrder: 8, isCustom: false },
  { id: 'des_009', title: 'संयोजक (Coordinator - Loan Committee)', code: 'COORD_LSC', categoryId: 'cat_lsc', categoryName: 'Loan Sub-Committee', mandate: 'ऋण उप-समितिको नेतृत्व, धितो मूल्याङ्कन तथा कर्जा प्रवाह सिफारिस', defaultAllowance: 3500, displayOrder: 9, isCustom: false },
  { id: 'des_010', title: 'सदस्य (Member - Loan Committee)', code: 'MEM_LSC', categoryId: 'cat_lsc', categoryName: 'Loan Sub-Committee', mandate: 'कर्जा माग फाराम जाँच तथा ऋणीको स्थलगत अनुगमन', defaultAllowance: 2500, displayOrder: 10, isCustom: false },
  { id: 'des_011', title: 'संयोजक (Coordinator - Education Committee)', code: 'COORD_ESC', categoryId: 'cat_esc', categoryName: 'Education & Training Sub-Committee', mandate: 'सदस्य शिक्षा, वित्तीय साक्षरता तथा क्षमता विकास तालिम सञ्चालन', defaultAllowance: 3000, displayOrder: 11, isCustom: false },
  { id: 'des_012', title: 'सदस्य (Member - Education Committee)', code: 'MEM_ESC', categoryId: 'cat_esc', categoryName: 'Education & Training Sub-Committee', mandate: 'शिक्षा शिविर तथा सहकारी सचेतना कार्यक्रम सहजीकरण', defaultAllowance: 2000, displayOrder: 12, isCustom: false },
  { id: 'des_013', title: 'वरिष्ठ सल्लाहकार (Senior Advisor)', code: 'ADV', categoryId: 'all', categoryName: 'All Committees', mandate: 'संस्थागत नीति, रणनीति तथा कानुनी पक्षमा विशेष सल्लाह र सुझाव', defaultAllowance: 2500, displayOrder: 13, isCustom: false }
];

const DEFAULT_MEMBERS: BoardMember[] = [
  {
    id: 'bm_001',
    fullName: 'RAM BAHADUR MAHATO',
    fullNameNp: 'राम बहादुर महतो',
    memberCode: 'MEM-0001',
    memberId: 'MEM-0001',
    accountNumber: '01201017500123',
    registrationDateBs: '२०८०-०४-०१',
    categoryId: 'cat_bod',
    categoryName: 'Board of Directors',
    designation: 'अध्यक्ष (Chairperson)',
    gender: 'Male',
    maritalStatus: 'Married',
    dobBs: '२०३८/०२/१५',
    dobAd: '1981-05-28',
    citizenshipNo: '१७-०१-७५-००१२३',
    citizenshipIssuedDistrict: 'महोत्तरी',
    citizenshipIssuedOffice: 'जिल्ला प्रशासन कार्यालय, महोत्तरी',
    citizenshipIssuedDateBs: '२०५५/११/१०',
    motherName: 'मङ्गली देवी महतो',
    fatherName: 'राम नारायण महतो',
    grandfatherName: 'सुखदेव महतो',
    spouseName: 'सुनिता देवी महतो',
    familyType: 'संयुक्त र एकै भान्सा',
    occupation: 'खेतीपाती',
    spouseOccupation: 'खेतीपाती',
    earningMemberRelation: 'छोरा',
    earningMemberOccupation: 'शिक्षक (पिपरा मा.वि.)',
    isHighProfile: 'नरहेको',
    mobile: '9854023456',
    email: 'ram.mahato@ratauli.org.np',
    panNo: '109823451',
    permanentProvince: 'मधेश प्रदेश (Madhesh Province)',
    permanentDistrict: 'महोत्तरी (Mahottari)',
    permanentMunicipality: 'पिपरा गाउँपालिका',
    permanentWard: '०६',
    permanentTole: 'रतौली',
    permanentHouseNo: '१२',
    temporaryProvince: 'मधेश प्रदेश (Madhesh Province)',
    temporaryDistrict: 'महोत्तरी (Mahottari)',
    temporaryMunicipality: 'पिपरा गाउँपालिका',
    temporaryWard: '०६',
    temporaryTole: 'रतौली',
    isSameAddress: true,
    workingAreaResidency: 'स्थायी',
    voterIdNo: 'VTR-9821034',
    votingCenter: 'पिपरा मा.वि. मतदान केन्द्र',
    stayDurationInArea: '१२ महिना (स्थायी)',
    cooperativePurpose: 'नियमित बचत, कर्जा सुविधा तथा ग्रामीण आर्थिक समृद्धि',
    isOtherCoopMember: 'नभएको',
    isFamilyOtherCoopMember: 'नभएको',
    annualIncomeRange: 'रु. ४ लाखभन्दा बढी १० लाखसम्म',
    annualIncomeSources: {
      agriculture: '४,००,०००',
      business: '१,५०,०००',
      domesticJob: '२,००,०००',
      foreignJob: ''
    },
    shareAmount: 50000,
    savingsAmount: 25000,
    estimatedLoan: '५,००,००० (कृषि प्रयोजन)',
    estimatedTransactionsCount: '३६ पटक',
    estimatedAnnualDeposit: '२,५०,०००',
    selfDeclarationConfirmed: true,
    bankName: 'Nabil Bank Ltd.',
    bankBranch: 'Janakpur',
    bankAccountNo: '01201017500123',
    bankAccountType: 'Savings',
    documents: [],
    tenure: {
      termLabel: '2080 - 2084 (4-Year Term)',
      startDateBs: '2080-04-01',
      endDateBs: '2084-03-30',
      status: 'Active'
    },
    allowanceConfig: {
      meetingAllowance: 5000,
      communicationAllowance: 2500,
      travelAllowance: 2500,
      refreshmentAllowance: 1500,
      otherAllowance: 0,
      customTdsRate: 15,
      isEligibleForAllowance: true
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'bm_002',
    fullName: 'SHANTI DEVI YADAV',
    fullNameNp: 'शान्ति देवी यादव',
    memberCode: 'MEM-0002',
    memberId: 'MEM-0002',
    accountNumber: '01201017500456',
    registrationDateBs: '२०८०-०४-०१',
    categoryId: 'cat_bod',
    categoryName: 'Board of Directors',
    designation: 'उपाध्यक्ष (Vice-Chairperson)',
    gender: 'Female',
    maritalStatus: 'Married',
    dobBs: '२०४२/०७/२०',
    dobAd: '1985-11-05',
    citizenshipNo: '१७-०१-७५-००४५६',
    citizenshipIssuedDistrict: 'महोत्तरी',
    citizenshipIssuedOffice: 'जिल्ला प्रशासन कार्यालय, महोत्तरी',
    citizenshipIssuedDateBs: '२०५९/०३/१२',
    motherName: 'कमला देवी यादव',
    fatherName: 'विन्देश्वर यादव',
    grandfatherName: 'राजेन्द्र यादव',
    spouseName: 'प्रदीप यादव',
    familyType: 'संयुक्त र एकै भान्सा',
    occupation: 'व्यवसाय (खुलाउने)',
    spouseOccupation: 'खेतीपाती',
    earningMemberRelation: 'पति',
    earningMemberOccupation: 'कृषि तथा व्यापार',
    isHighProfile: 'नरहेको',
    mobile: '9844034567',
    email: 'shanti.yadav@ratauli.org.np',
    panNo: '109823452',
    permanentProvince: 'मधेश प्रदेश (Madhesh Province)',
    permanentDistrict: 'महोत्तरी (Mahottari)',
    permanentMunicipality: 'पिपरा गाउँपालिका',
    permanentWard: '०३',
    permanentTole: 'रतौली',
    permanentHouseNo: '२४',
    temporaryProvince: 'मधेश प्रदेश (Madhesh Province)',
    temporaryDistrict: 'महोत्तरी (Mahottari)',
    temporaryMunicipality: 'पिपरा गाउँपालिका',
    temporaryWard: '०३',
    temporaryTole: 'रतौली',
    isSameAddress: true,
    workingAreaResidency: 'स्थायी',
    voterIdNo: 'VTR-9821035',
    votingCenter: 'पिपरा मा.वि. मतदान केन्द्र',
    stayDurationInArea: '१२ महिना (स्थायी)',
    cooperativePurpose: 'नियमित बचत, कर्जा सुविधा तथा महिला सशक्तिकरण',
    isOtherCoopMember: 'नभएको',
    isFamilyOtherCoopMember: 'नभएको',
    annualIncomeRange: 'रु. ४ लाखभन्दा बढी १० लाखसम्म',
    annualIncomeSources: {
      agriculture: '२,५०,०००',
      business: '३,००,०००',
      domesticJob: '',
      foreignJob: ''
    },
    shareAmount: 40000,
    savingsAmount: 20000,
    estimatedLoan: '३,००,०००',
    estimatedTransactionsCount: '२४ पटक',
    estimatedAnnualDeposit: '२,००,०००',
    selfDeclarationConfirmed: true,
    bankName: 'Nabil Bank Ltd.',
    bankBranch: 'Janakpur',
    bankAccountNo: '01201017500456',
    bankAccountType: 'Savings',
    documents: [],
    tenure: {
      termLabel: '2080 - 2084 (4-Year Term)',
      startDateBs: '2080-04-01',
      endDateBs: '2084-03-30',
      status: 'Active'
    },
    allowanceConfig: {
      meetingAllowance: 4500,
      communicationAllowance: 2000,
      travelAllowance: 2000,
      refreshmentAllowance: 1000,
      otherAllowance: 0,
      customTdsRate: 15,
      isEligibleForAllowance: true
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'bm_003',
    fullName: 'BIKASH KUMAR MANDAL',
    fullNameNp: 'विकास कुमार मण्डल',
    memberCode: 'MEM-0003',
    memberId: 'MEM-0003',
    accountNumber: '01201017500789',
    registrationDateBs: '२०८०-०४-०१',
    categoryId: 'cat_bod',
    categoryName: 'Board of Directors',
    designation: 'सचिव (Secretary)',
    gender: 'Male',
    maritalStatus: 'Married',
    dobBs: '२०४६/०३/१०',
    dobAd: '1989-06-24',
    citizenshipNo: '१७-०१-७५-००७८९',
    citizenshipIssuedDistrict: 'महोत्तरी',
    citizenshipIssuedOffice: 'जिल्ला प्रशासन कार्यालय, महोत्तरी',
    citizenshipIssuedDateBs: '२०६३/०५/१४',
    motherName: 'पार्वती देवी मण्डल',
    fatherName: 'चन्देश्वर मण्डल',
    grandfatherName: 'राम सागर मण्डल',
    spouseName: 'अनिता मण्डल',
    familyType: 'संयुक्त र एकै भान्सा',
    occupation: 'नोकरी (खुलाउने)',
    spouseOccupation: 'खेतीपाती',
    earningMemberRelation: 'आफै',
    earningMemberOccupation: 'सामाजिक विकास अधिकृत',
    isHighProfile: 'नरहेको',
    mobile: '9864045678',
    email: 'bikash.mandal@ratauli.org.np',
    panNo: '109823453',
    permanentProvince: 'मधेश प्रदेश (Madhesh Province)',
    permanentDistrict: 'महोत्तरी (Mahottari)',
    permanentMunicipality: 'पिपरा गाउँपालिका',
    permanentWard: '०६',
    permanentTole: 'रतौली',
    permanentHouseNo: '३५',
    temporaryProvince: 'मधेश प्रदेश (Madhesh Province)',
    temporaryDistrict: 'महोत्तरी (Mahottari)',
    temporaryMunicipality: 'पिपरा गाउँपालिका',
    temporaryWard: '०६',
    temporaryTole: 'रतौली',
    isSameAddress: true,
    workingAreaResidency: 'स्थायी',
    voterIdNo: 'VTR-9821036',
    votingCenter: 'पिपरा मा.वि. मतदान केन्द्र',
    stayDurationInArea: '१२ महिना (स्थायी)',
    cooperativePurpose: 'सहकारी सुशासन, सामाजिक सशक्तिकरण तथा बचत वृद्धि',
    isOtherCoopMember: 'नभएको',
    isFamilyOtherCoopMember: 'नभएको',
    annualIncomeRange: 'रु. ४ लाखभन्दा बढी १० लाखसम्म',
    annualIncomeSources: {
      agriculture: '२,००,०००',
      business: '',
      domesticJob: '३,६०,०००',
      foreignJob: ''
    },
    shareAmount: 40000,
    savingsAmount: 20000,
    estimatedLoan: '२,५०,०००',
    estimatedTransactionsCount: '३० पटक',
    estimatedAnnualDeposit: '२,००,०००',
    selfDeclarationConfirmed: true,
    bankName: 'Nabil Bank Ltd.',
    bankBranch: 'Janakpur',
    bankAccountNo: '01201017500789',
    bankAccountType: 'Savings',
    documents: [],
    tenure: {
      termLabel: '2080 - 2084 (4-Year Term)',
      startDateBs: '2080-04-01',
      endDateBs: '2084-03-30',
      status: 'Active'
    },
    allowanceConfig: {
      meetingAllowance: 4500,
      communicationAllowance: 2000,
      travelAllowance: 2000,
      refreshmentAllowance: 1000,
      otherAllowance: 0,
      customTdsRate: 15,
      isEligibleForAllowance: true
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

export const BoardManagement: React.FC<Props> = ({ currentBranch, settings }) => {
  const isDayEnded = useDayEndLock(currentBranch?.id);
  const [activeTab, setActiveTab] = useState<TabType>('team');
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [designations, setDesignations] = useState<BoardDesignation[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [allowanceSheets, setAllowanceSheets] = useState<BoardAllowanceSheet[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [designationSearch, setDesignationSearch] = useState('');
  const [designationCommitteeFilter, setDesignationCommitteeFilter] = useState('all');

  // Modals
  const [viewingMember, setViewingMember] = useState<BoardMember | null>(null);
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BoardCategory | null>(null);
  const [isDesignationModalOpen, setIsDesignationModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<BoardDesignation | null>(null);
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<string | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  const [confirmDeleteDesignationId, setConfirmDeleteDesignationId] = useState<string | null>(null);
  const [confirmDeleteSheetId, setConfirmDeleteSheetId] = useState<string | null>(null);
  const [viewingArchivedSheet, setViewingArchivedSheet] = useState<BoardAllowanceSheet | null>(null);

  // Payroll active sheet state
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('2081/2082');
  const [selectedFrequency, setSelectedFrequency] = useState<PaymentFrequency>('monthly');
  const [selectedMonth, setSelectedMonth] = useState('Baisakh');
  const [preparedByEmployee, setPreparedByEmployee] = useState('');
  const [checkedByEmployee, setCheckedByEmployee] = useState('');
  const [approvedByEmployee, setApprovedByEmployee] = useState('');
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [activeAllowanceItems, setActiveAllowanceItems] = useState<BoardMonthlyAllowanceItem[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isSavingAllowance, setIsSavingAllowance] = useState(false);
  const [allowanceSaveSuccess, setAllowanceSaveSuccess] = useState(false);
  const [printingBankAdvice, setPrintingBankAdvice] = useState<BoardMonthlyAllowanceItem[] | null>(null);
  const [printingVoucher, setPrintingVoucher] = useState<BoardMonthlyAllowanceItem | null>(null);
  const [downloadingPdfMemberId, setDownloadingPdfMemberId] = useState<string | null>(null);
  const [pdfTargetMember, setPdfTargetMember] = useState<BoardMember | null>(null);

  const handleDownloadMemberPdf = async (member: BoardMember) => {
    try {
      setDownloadingPdfMemberId(member.id);
      setPdfTargetMember(member);
      // Wait for React to render and paint fonts/images
      await new Promise(resolve => setTimeout(resolve, 400));
      const el = document.getElementById('board-kym-pdf-offscreen-target');
      if (!el) {
        throw new Error('PDF render target not found');
      }
      const safeName = member.fullName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      await generateKYMDocPdf(el, `KYM_Form_${safeName}.pdf`);
    } catch (err) {
      console.error('Failed to generate KYM form PDF:', err);
    } finally {
      setDownloadingPdfMemberId(null);
      setPdfTargetMember(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, desList, mems, sheets, emps] = await Promise.all([
        storageService.getBoardCategories(),
        storageService.getBoardDesignations(),
        storageService.getBoardMembers(currentBranch?.id),
        storageService.getBoardAllowanceSheets(),
        storageService.getEmployees(currentBranch?.id)
      ]);
      
      const finalCats = (cats && cats.length > 0) ? cats : DEFAULT_CATEGORIES;
      if (!cats || cats.length === 0) {
        for (const c of DEFAULT_CATEGORIES) {
          storageService.saveBoardCategory(c).catch(() => {});
        }
      }

      const finalDes = (desList && desList.length > 0) ? desList : DEFAULT_DESIGNATIONS;
      if (!desList || desList.length === 0) {
        for (const d of DEFAULT_DESIGNATIONS) {
          storageService.saveBoardDesignation(d).catch(() => {});
        }
      }

      const finalMems = (mems && mems.length > 0) ? mems : DEFAULT_MEMBERS;
      if (!mems || mems.length === 0) {
        for (const m of DEFAULT_MEMBERS) {
          storageService.saveBoardMember(m).catch(() => {});
        }
      }

      setCategories(finalCats);
      setDesignations(finalDes);
      setMembers(finalMems);
      setAllowanceSheets(sheets || []);
      setEmployees(emps || []);
    } catch (err) {
      console.error('Failed to load board data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch?.id]);

  // Sync Monthly Allowance Sheet on Month, Fiscal Year or AllowanceSheets changes
  useEffect(() => {
    const existingSheet = allowanceSheets.find(
      s => s.fiscalYear === selectedFiscalYear && s.month === selectedMonth
    );

    if (existingSheet && existingSheet.items && existingSheet.items.length > 0) {
      setActiveAllowanceItems(existingSheet.items);
      setSelectedMemberIds(new Set(existingSheet.items.map(i => i.memberId)));
      if (existingSheet.paymentFrequency) {
        setSelectedFrequency(existingSheet.paymentFrequency);
      }
      setPreparedByEmployee(existingSheet.preparedBy || '');
      setCheckedByEmployee(existingSheet.checkedBy || '');
      setApprovedByEmployee(existingSheet.approvedBy || '');
    } else {
      // Generate default items ONLY for active board members
      const activeMems = members.filter(m => m.tenure?.status === 'Active' || !m.tenure?.status);
      const memberItems: BoardMonthlyAllowanceItem[] = activeMems.map(m => {
        const cfg = m.allowanceConfig || {
          meetingAllowance: 0,
          communicationAllowance: 0,
          travelAllowance: 0,
          refreshmentAllowance: 0,
          otherAllowance: 0,
          customTdsRate: 15,
          isEligibleForAllowance: true
        };
        const gross = (cfg.meetingAllowance || 0) + (cfg.communicationAllowance || 0) + 
                      (cfg.travelAllowance || 0) + (cfg.refreshmentAllowance || 0) + (cfg.otherAllowance || 0);
        const tdsRate = cfg.customTdsRate ?? 15;
        const tds = Math.round((gross * tdsRate) / 100);
        const net = gross - tds;

        return {
          memberId: m.id,
          memberName: m.fullName,
          categoryName: m.categoryName,
          designation: m.designation,
          panNo: m.panNo || 'N/A',
          bankName: m.bankName || 'N/A',
          bankAccountNo: m.bankAccountNo || m.accountNumber || 'N/A',
          meetingAllowance: cfg.meetingAllowance || 0,
          communicationAllowance: cfg.communicationAllowance || 0,
          travelAllowance: cfg.travelAllowance || 0,
          refreshmentAllowance: cfg.refreshmentAllowance || 0,
          otherAllowance: cfg.otherAllowance || 0,
          grossAllowance: gross,
          tdsRate,
          tdsAmount: tds,
          netPayable: net,
          status: 'Unpaid'
        };
      });

      setActiveAllowanceItems(memberItems);
      setSelectedMemberIds(new Set(memberItems.map(i => i.memberId)));
    }
  }, [selectedFiscalYear, selectedMonth, allowanceSheets, members]);

  const handleFrequencyChange = (freq: PaymentFrequency) => {
    setSelectedFrequency(freq);
    const validMonths = MONTHS_BY_FREQUENCY[freq] || [];
    if (!validMonths.includes(selectedMonth)) {
      setSelectedMonth(validMonths[0] || 'Ashadh');
    }
  };

  // Filtered Members for Board Team
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch = 
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.fullNameNp && m.fullNameNp.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.panNo && m.panNo.includes(searchQuery)) ||
        (m.mobile && m.mobile.includes(searchQuery));

      const matchCat = selectedCategoryFilter === 'all' || m.categoryId === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [members, searchQuery, selectedCategoryFilter]);

  // Handle Save Board Member
  const handleSaveMember = async (memberToSave: BoardMember) => {
    if (isDayEnded) return;
    try {
      await storageService.saveBoardMember(memberToSave);
      setEditingMember(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save member:', err);
    }
  };

  // Handle Delete Board Member
  const handleDeleteMember = async (id: string) => {
    if (isDayEnded) return;
    try {
      await storageService.deleteBoardMember(id);
      setConfirmDeleteMemberId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete member:', err);
    }
  };

  // Handle Save Category
  const handleSaveCategory = async (cat: BoardCategory) => {
    if (isDayEnded) return;
    try {
      await storageService.saveBoardCategory(cat);
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save category:', err);
    }
  };

  // Handle Delete Category
  const handleDeleteCategory = async (id: string) => {
    if (isDayEnded) return;
    try {
      await storageService.deleteBoardCategory(id);
      setConfirmDeleteCategoryId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  // Filtered Designations for Designations Tab
  const filteredDesignations = useMemo(() => {
    return designations.filter(d => {
      const matchSearch =
        d.title.toLowerCase().includes(designationSearch.toLowerCase()) ||
        (d.mandate && d.mandate.toLowerCase().includes(designationSearch.toLowerCase())) ||
        (d.code && d.code.toLowerCase().includes(designationSearch.toLowerCase())) ||
        (d.categoryName && d.categoryName.toLowerCase().includes(designationSearch.toLowerCase()));

      const matchCat = designationCommitteeFilter === 'all' || 
        d.categoryId === designationCommitteeFilter ||
        (!d.categoryId && designationCommitteeFilter === 'all');

      return matchSearch && matchCat;
    });
  }, [designations, designationSearch, designationCommitteeFilter]);

  // Handle Save Designation
  const handleSaveDesignation = async (des: BoardDesignation) => {
    if (isDayEnded) return;
    try {
      if (!des.title.trim()) return;
      const cleanDes: BoardDesignation = {
        ...des,
        title: des.title.trim(),
        categoryId: des.categoryId || 'all',
        categoryName: des.categoryName || 'All Committees',
        isCustom: true
      };

      // Immediately update local state so UI updates instantaneously
      setDesignations(prev => {
        const exists = prev.some(d => d.id === cleanDes.id);
        if (exists) {
          return prev.map(d => d.id === cleanDes.id ? cleanDes : d);
        }
        return [...prev, cleanDes];
      });

      setIsDesignationModalOpen(false);
      setEditingDesignation(null);

      await storageService.saveBoardDesignation(cleanDes);
      await loadData();
    } catch (err) {
      console.error('Failed to save designation:', err);
    }
  };

  // Handle Delete Designation
  const handleDeleteDesignation = async (id: string) => {
    if (isDayEnded) return;
    try {
      await storageService.deleteBoardDesignation(id);
      setConfirmDeleteDesignationId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete designation:', err);
    }
  };

  // Handle Save Monthly Allowance Sheet to Archive
  const handleSaveAllowanceSheet = async () => {
    if (isDayEnded) return;
    try {
      setIsSavingAllowance(true);
      const sheetId = `sheet_${selectedFiscalYear.replace('/', '_')}_${selectedMonth}`;
      let nepToday = '';
      try {
        nepToday = new NepaliDate().format('YYYY-MM-DD');
      } catch {
        nepToday = new Date().toISOString().slice(0, 10);
      }

      const totalGross = activeAllowanceItems.reduce((acc, i) => acc + i.grossAllowance, 0);
      const totalTds = activeAllowanceItems.reduce((acc, i) => acc + i.tdsAmount, 0);
      const totalNet = activeAllowanceItems.reduce((acc, i) => acc + i.netPayable, 0);

      const sheet: BoardAllowanceSheet = {
        id: sheetId,
        fiscalYear: selectedFiscalYear,
        month: selectedMonth,
        paymentFrequency: selectedFrequency,
        dateBs: nepToday,
        items: activeAllowanceItems,
        totalGross,
        totalTds,
        totalNet,
        status: 'Approved',
        preparedBy: preparedByEmployee || undefined,
        checkedBy: checkedByEmployee || undefined,
        approvedBy: approvedByEmployee || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await storageService.saveBoardAllowanceSheet(sheet);
      setAllowanceSaveSuccess(true);
      setTimeout(() => setAllowanceSaveSuccess(false), 3000);
      await loadData();
    } catch (err) {
      console.error('Failed to save sheet:', err);
    } finally {
      setIsSavingAllowance(false);
    }
  };

  // Delete Archived Sheet
  const handleDeleteSheet = async (id: string) => {
    if (isDayEnded) return;
    try {
      await storageService.deleteBoardAllowanceSheet(id);
      setConfirmDeleteSheetId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete archived sheet:', err);
    }
  };

  const handleUpdateItemAmount = (index: number, field: string, value: number) => {
    if (isDayEnded) return;
    setActiveAllowanceItems(prev => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      const gross = (item.meetingAllowance || 0) + (item.communicationAllowance || 0) + 
                    (item.travelAllowance || 0) + (item.refreshmentAllowance || 0) + (item.otherAllowance || 0);
      const tds = Math.round((gross * (item.tdsRate || 15)) / 100);
      item.grossAllowance = gross;
      item.tdsAmount = tds;
      item.netPayable = gross - tds;
      copy[index] = item;
      return copy;
    });
  };

  const handleToggleItemStatus = (index: number) => {
    if (isDayEnded) return;
    setActiveAllowanceItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        status: copy[index].status === 'Paid' ? 'Unpaid' : 'Paid',
        paymentMethod: copy[index].status === 'Paid' ? undefined : 'Bank Transfer'
      };
      return copy;
    });
  };

  const openAddBoardModal = () => {
    const defaultCat = categories[0] || { id: 'cat_bod', name: 'Board of Directors' };
    let nepToday = '2081-06-15';
    try {
      nepToday = new NepaliDate().format('YYYY-MM-DD');
    } catch {
      nepToday = '2081-06-15';
    }

    setEditingMember({
      id: `bm_${Date.now()}`,
      registrationDateBs: nepToday,
      memberId: '',
      accountNumber: '',
      fullName: '',
      fullNameNp: '',
      memberCode: '',
      categoryId: defaultCat.id,
      categoryName: defaultCat.name,
      designation: 'सञ्चालक सदस्य (Board Member)',
      gender: 'Male',
      maritalStatus: 'Married',
      dobBs: '२०४५/०५/१५',
      dobAd: '',
      bloodGroup: '',
      mobile: '',
      email: '',
      panNo: '',
      citizenshipNo: '',
      citizenshipIssuedDistrict: 'महोत्तरी',
      citizenshipIssuedOffice: 'जिल्ला प्रशासन कार्यालय, महोत्तरी',
      citizenshipIssuedDateBs: '२०६०/०४/१५',
      citizenshipIssuedDateAd: '',
      permanentProvince: 'मधेश प्रदेश (Madhesh Province)',
      permanentDistrict: 'महोत्तरी (Mahottari)',
      permanentMunicipality: 'पिपरा गाउँपालिका',
      permanentWard: '०३',
      permanentTole: 'रतौली',
      permanentHouseNo: '',
      temporaryProvince: 'मधेश प्रदेश (Madhesh Province)',
      temporaryDistrict: 'महोत्तरी (Mahottari)',
      temporaryMunicipality: 'पिपरा गाउँपालिका',
      temporaryWard: '०३',
      temporaryTole: 'रतौली',
      isSameAddress: true,
      workingAreaResidency: 'स्थायी',
      voterIdNo: '',
      votingCenter: 'पिपरा मा.वि.',
      stayDurationInArea: '१२ महिना (स्थायी)',
      passportNo: '',
      cooperativePurpose: 'नियमित बचत, कर्जा सुविधा तथा आर्थिक समृद्धि',
      isOtherCoopMember: 'नभएको',
      isFamilyOtherCoopMember: 'नभएको',
      annualIncomeRange: 'रु. ४ लाखभन्दा बढी १० लाखसम्म',
      annualIncomeSources: {
        agriculture: '३,००,०००',
        business: '१,००,०००',
        domesticJob: '२,००,०००',
        foreignJob: ''
      },
      shareAmount: 10000,
      savingsAmount: 5000,
      estimatedLoan: '२,००,००० (आवश्यक परेमा)',
      estimatedTransactionsCount: '२४ पटक',
      estimatedAnnualDeposit: '१,००,०००',
      selfDeclarationConfirmed: true,
      fatherName: '',
      motherName: '',
      grandfatherName: '',
      spouseName: '',
      familyType: 'संयुक्त र एकै भान्सा',
      occupation: 'खेतीपाती',
      spouseOccupation: 'खेतीपाती',
      isHighProfile: 'नरहेको',
      bankName: 'Nabil Bank Ltd.',
      bankBranch: 'Janakpur',
      bankAccountNo: '',
      bankAccountType: 'Savings',
      documents: [],
      tenure: {
        termLabel: '2080 - 2084 (4-Year Term)',
        startDateBs: '2080-04-01',
        endDateBs: '2084-03-30',
        status: 'Active'
      },
      allowanceConfig: {
        meetingAllowance: 4000,
        communicationAllowance: 2000,
        travelAllowance: 2000,
        refreshmentAllowance: 1000,
        otherAllowance: 0,
        customTdsRate: 15,
        isEligibleForAllowance: true
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  };

  return (
    <div className="space-y-1.5 text-slate-800 pb-4">
      {/* Top Header - Compact & Clean without borders/ghera or excess height */}
      <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs no-print">
        <div className="flex items-center space-x-2">
          <Award size={18} className="text-emerald-700" />
          <h1 className="text-sm font-black uppercase text-slate-900 tracking-tight">Board</h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              if (isDayEnded) return;
              setEditingDesignation({
                id: `des_${Date.now()}`,
                title: '',
                code: '',
                categoryId: 'all',
                categoryName: 'All Committees',
                mandate: '',
                defaultAllowance: 0,
                displayOrder: designations.length + 1,
                isCustom: true
              });
              setIsDesignationModalOpen(true);
            }}
            disabled={isDayEnded}
            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-bold rounded-lg flex items-center space-x-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title={isDayEnded ? getDayEndedBlockMessage() : "Create New Designation for Board & Committees"}
          >
            <Plus size={12} className="text-purple-700" />
            <span>New Designation</span>
          </button>
          <button
            onClick={() => {
              if (isDayEnded) return;
              setEditingCategory({
                id: `cat_${Date.now()}`,
                name: '',
                code: '',
                description: '',
                maxMembers: 5,
                displayOrder: categories.length + 1,
                isCustom: true
              });
              setIsCategoryModalOpen(true);
            }}
            disabled={isDayEnded}
            title={isDayEnded ? getDayEndedBlockMessage() : "Create New Committee"}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg flex items-center space-x-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={12} className="text-indigo-600" />
            <span>New Committee</span>
          </button>
          <button
            onClick={() => { if (!isDayEnded) openAddBoardModal(); }}
            disabled={isDayEnded}
            title={isDayEnded ? getDayEndedBlockMessage() : "Add Board Member"}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider rounded-lg shadow-2xs flex items-center space-x-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={12} />
            <span>Add Board</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Compact) */}
      <div className="bg-white p-1 rounded-xl border border-slate-200 flex flex-wrap items-center gap-1 no-print">
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'team'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users size={13} className={activeTab === 'team' ? 'text-emerald-400' : ''} />
          <span>Board Team</span>
        </button>

        <button
          onClick={() => setActiveTab('committees')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'committees'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck size={13} className={activeTab === 'committees' ? 'text-indigo-400' : ''} />
          <span>Committees</span>
        </button>

        <button
          onClick={() => setActiveTab('designations')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'designations'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award size={13} className={activeTab === 'designations' ? 'text-purple-400' : ''} />
          <span>Designations</span>
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'payroll'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Wallet size={13} className={activeTab === 'payroll' ? 'text-emerald-400' : ''} />
          <span>Payroll</span>
        </button>

        <button
          onClick={() => setActiveTab('archive')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'archive'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ArchiveIcon size={13} className={activeTab === 'archive' ? 'text-amber-400' : ''} />
          <span>Archive</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'documents'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText size={13} className={activeTab === 'documents' ? 'text-blue-400' : ''} />
          <span>Documents</span>
        </button>

        {loading && (
          <div className="ml-auto flex items-center space-x-1.5 px-2 text-[10px] text-slate-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Syncing...</span>
          </div>
        )}
      </div>

      {/* TAB 1: BOARD TEAM */}
      {activeTab === 'team' && (
        <div className="space-y-1.5">
          {/* Toolbar */}
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name, PAN, phone..."
                className="w-full pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-800"
              />
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] text-slate-500 font-bold flex items-center space-x-1">
                  <Filter size={12} />
                  <span>Committee:</span>
                </span>
                <select
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Committees</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => { if (!isDayEnded) openAddBoardModal(); }}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : "Add Board Member"}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider rounded-lg shadow-2xs flex items-center space-x-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                <span>Add Board</span>
              </button>
            </div>
          </div>

          {/* Board Team Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-1.5 px-2.5 w-10 text-center">S.N.</th>
                    <th className="py-1.5 px-2.5">Name</th>
                    <th className="py-1.5 px-2.5">Committee</th>
                    <th className="py-1.5 px-2.5">Designation</th>
                    <th className="py-1.5 px-2.5">Elected Date</th>
                    <th className="py-1.5 px-2.5">Expiry Date</th>
                    <th className="py-1.5 px-2.5 text-center w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((member, idx) => (
                    <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2.5">
                        <div 
                          onClick={() => setViewingMember(member)}
                          className="flex items-center space-x-2 cursor-pointer group"
                          title="Click to view full member details"
                        >
                          {member.profilePhoto ? (
                            <img
                              src={member.profilePhoto}
                              alt={member.fullName}
                              className="w-7 h-7 rounded-md object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-md bg-slate-800 group-hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center shrink-0 transition-colors">
                              {member.fullName.charAt(0)}
                            </div>
                          )}
                          <div className="leading-tight">
                            <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {member.fullName}
                            </span>
                            {member.fullNameNp && (
                              <span className="text-[10px] text-slate-500 font-medium ml-1">
                                ({member.fullNameNp})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5 font-semibold text-slate-700">
                        {member.categoryName}
                      </td>
                      <td className="py-1.5 px-2.5 font-semibold text-emerald-800">
                        {member.designation}
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-slate-600">
                        {member.tenure?.startDateBs || '-'}
                      </td>
                      <td className="py-1.5 px-2.5">
                        <span className="font-mono font-bold text-slate-900">
                          {member.tenure?.endDateBs || '-'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setViewingMember(member)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs flex items-center justify-center transition-colors"
                            title="View KYM Details"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => { if (!isDayEnded) setEditingMember(member); }}
                            disabled={isDayEnded}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : "Edit"}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => { if (!isDayEnded) setConfirmDeleteMemberId(member.id); }}
                            disabled={isDayEnded}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : "Delete"}
                          >
                            <Trash2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDownloadMemberPdf(member)}
                            disabled={downloadingPdfMemberId === member.id}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                            title="Download KYM Form (PDF)"
                          >
                            {downloadingPdfMemberId === member.id ? (
                              <Loader2 size={12} className="animate-spin text-rose-600" />
                            ) : (
                              <FileDown size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                        No board members found in roster.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMMITTEES DIRECTORY */}
      {activeTab === 'committees' && (
        <div className="space-y-1.5">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-900 uppercase">
                Committees Directory
              </h3>
              <button
                onClick={() => {
                  if (isDayEnded) return;
                  setEditingCategory({
                    id: `cat_${Date.now()}`,
                    name: '',
                    code: '',
                    description: '',
                    maxMembers: 5,
                    displayOrder: categories.length + 1,
                    isCustom: true
                  });
                  setIsCategoryModalOpen(true);
                }}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : "Add Committee"}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                <span>Add Committee</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-2.5 w-10 text-center">S.N.</th>
                    <th className="py-1.5 px-2.5 w-20">Code</th>
                    <th className="py-1.5 px-2.5">Committee Name</th>
                    <th className="py-1.5 px-2.5 text-center w-20">Members</th>
                    <th className="py-1.5 px-2.5 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat, idx) => {
                    const count = members.filter(m => m.categoryId === cat.id).length;
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-2.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {cat.code}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 font-bold text-slate-900">{cat.name}</td>
                        <td className="py-1.5 px-2.5 text-center font-bold text-indigo-700">
                          {count}
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setSelectedCategoryFilter(cat.id);
                                setActiveTab('team');
                              }}
                              className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                              title="View Members"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => {
                                if (isDayEnded) return;
                                setEditingCategory(cat);
                                setIsCategoryModalOpen(true);
                              }}
                              disabled={isDayEnded}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? getDayEndedBlockMessage() : "Edit"}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => { if (!isDayEnded) setConfirmDeleteCategoryId(cat.id); }}
                              disabled={isDayEnded}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? getDayEndedBlockMessage() : "Delete"}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                        No committees found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DESIGNATIONS DIRECTORY ( पद तथा जिम्मेवारी व्यवस्थापन ) */}
      {activeTab === 'designations' && (
        <div className="space-y-1.5">
          {/* Designations Toolbar */}
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={designationSearch}
                onChange={e => setDesignationSearch(e.target.value)}
                placeholder="Search designation title, mandate, code..."
                className="w-full pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-800"
              />
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] text-slate-500 font-bold flex items-center space-x-1">
                  <Filter size={12} />
                  <span>Committee:</span>
                </span>
                <select
                  value={designationCommitteeFilter}
                  onChange={e => setDesignationCommitteeFilter(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="all">All Committees</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  if (isDayEnded) return;
                  setEditingDesignation({
                    id: `des_${Date.now()}`,
                    title: '',
                    code: '',
                    categoryId: designationCommitteeFilter !== 'all' ? designationCommitteeFilter : 'all',
                    categoryName: designationCommitteeFilter !== 'all' ? categories.find(c => c.id === designationCommitteeFilter)?.name : 'All Committees',
                    mandate: '',
                    defaultAllowance: 0,
                    displayOrder: designations.length + 1,
                    isCustom: true
                  });
                  setIsDesignationModalOpen(true);
                }}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : "Add Designation"}
                className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-bold rounded-lg flex items-center space-x-1 transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                <span>Add Designation</span>
              </button>
            </div>
          </div>

          {/* Designations Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-2.5 w-10 text-center">S.N.</th>
                    <th className="py-1.5 px-2.5 min-w-[180px]">Designation Title</th>
                    <th className="py-1.5 px-2.5 min-w-[140px]">Committee</th>
                    <th className="py-1.5 px-2.5">Mandate & Scope</th>
                    <th className="py-1.5 px-2.5 text-right min-w-[110px]">Monthly Allowance</th>
                    <th className="py-1.5 px-2.5 text-center w-20">Members</th>
                    <th className="py-1.5 px-2.5 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDesignations.map((des, idx) => {
                    const assignedCount = members.filter(m => m.designation === des.title).length;
                    const catObj = categories.find(c => c.id === des.categoryId);
                    const catDisplay = des.categoryId === 'all' || !des.categoryId ? 'All Committees' : (catObj?.name || des.categoryName || 'General');

                    return (
                      <tr key={des.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-2.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
                            <span className="font-bold text-slate-900 text-xs">{des.title}</span>
                            {des.code && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                {des.code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {catDisplay}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600 max-w-md">
                          <p className="line-clamp-2 text-[11px] leading-snug">
                            {des.mandate || <span className="text-slate-400 italic">No mandate specified</span>}
                          </p>
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-800">
                          {des.defaultAllowance ? `Rs. ${des.defaultAllowance.toLocaleString()}` : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            assignedCount > 0 ? 'bg-emerald-50 text-emerald-800' : 'text-slate-400'
                          }`}>
                            {assignedCount}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                if (isDayEnded) return;
                                setEditingDesignation(des);
                                setIsDesignationModalOpen(true);
                              }}
                              disabled={isDayEnded}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? getDayEndedBlockMessage() : "Edit Designation"}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => { if (!isDayEnded) setConfirmDeleteDesignationId(des.id); }}
                              disabled={isDayEnded}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? getDayEndedBlockMessage() : "Delete Designation"}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredDesignations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                        No designations found matching your filter. Click "+ Add Designation" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAYROLL */}
      {activeTab === 'payroll' && (
        <div className="space-y-1.5">
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* Fiscal Year */}
              <div className="flex items-center space-x-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">FY:</label>
                <select
                  value={selectedFiscalYear}
                  onChange={e => setSelectedFiscalYear(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                >
                  <option value="2080/2081">2080/2081</option>
                  <option value="2081/2082">2081/2082</option>
                  <option value="2082/2083">2082/2083</option>
                  <option value="2083/2084">2083/2084</option>
                </select>
              </div>

              {/* Payment Frequency */}
              <div className="flex items-center space-x-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Payment:</label>
                <select
                  value={selectedFrequency}
                  onChange={e => handleFrequencyChange(e.target.value as PaymentFrequency)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                >
                  {FREQUENCY_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div className="flex items-center space-x-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Month:</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800"
                >
                  {(MONTHS_BY_FREQUENCY[selectedFrequency] || []).map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* TDS */}
              <div className="text-[11px] text-slate-600 font-semibold px-2 py-0.5 bg-rose-50 border border-rose-200 rounded-md">
                TDS: <span className="font-bold text-rose-600">15%</span>
              </div>
            </div>

            {/* Print & Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  const filtered = activeAllowanceItems.filter(i => selectedMemberIds.has(i.memberId));
                  setPrintingBankAdvice(filtered.length > 0 ? filtered : activeAllowanceItems);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-all shadow-2xs"
                title="Preview Payment Sheet"
              >
                <Eye size={13} className="text-emerald-700" />
                <span>Preview</span>
              </button>

              <button
                onClick={handleSaveAllowanceSheet}
                disabled={isSavingAllowance || isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : "Save & Archive"}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-2xs flex items-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArchiveIcon size={13} />
                <span>{isSavingAllowance ? 'Saving...' : 'Save & Archive'}</span>
              </button>
            </div>
          </div>

          {allowanceSaveSuccess && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Payroll sheet archived successfully!</span>
            </div>
          )}

          {/* Detailed Allowance Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-1.5 px-2 w-8 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.size === activeAllowanceItems.length && activeAllowanceItems.length > 0}
                        onChange={() => {
                          if (selectedMemberIds.size === activeAllowanceItems.length) {
                            setSelectedMemberIds(new Set());
                          } else {
                            setSelectedMemberIds(new Set(activeAllowanceItems.map(i => i.memberId)));
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-emerald-600 cursor-pointer"
                        title="Select All / Deselect All"
                      />
                    </th>
                    <th className="py-1.5 px-2 whitespace-nowrap">Member</th>
                    <th className="py-1.5 px-1.5 whitespace-nowrap">Meeting</th>
                    <th className="py-1.5 px-1.5 whitespace-nowrap">Comm.</th>
                    <th className="py-1.5 px-1.5 whitespace-nowrap">Travel</th>
                    <th className="py-1.5 px-1.5 whitespace-nowrap">TADA</th>
                    <th className="py-1.5 px-2 whitespace-nowrap">Gross</th>
                    <th className="py-1.5 px-2 text-rose-300 whitespace-nowrap">15% TDS</th>
                    <th className="py-1.5 px-2 text-emerald-300 whitespace-nowrap">Net Payable</th>
                    <th className="py-1.5 px-2 text-center whitespace-nowrap">Status</th>
                    <th className="py-1.5 px-2 text-right whitespace-nowrap">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {activeAllowanceItems.map((item, idx) => (
                    <tr key={item.memberId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-1 px-2 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.has(item.memberId)}
                          onChange={() => {
                            setSelectedMemberIds(prev => {
                              const next = new Set(prev);
                              if (next.has(item.memberId)) {
                                next.delete(item.memberId);
                              } else {
                                next.add(item.memberId);
                              }
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5 rounded text-emerald-600 cursor-pointer"
                        />
                      </td>
                      <td className="py-1 px-2 whitespace-nowrap">
                        <div className="font-bold text-slate-900 leading-tight whitespace-nowrap">{item.memberName}</div>
                        <div className="text-[10px] text-slate-500 leading-tight whitespace-nowrap">{item.designation}</div>
                      </td>
                      <td className="py-1 px-1.5 whitespace-nowrap">
                        <input
                          type="number"
                          disabled={isDayEnded}
                          value={item.meetingAllowance}
                          onChange={e => handleUpdateItemAmount(idx, 'meetingAllowance', Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-1 px-1.5 whitespace-nowrap">
                        <input
                          type="number"
                          disabled={isDayEnded}
                          value={item.communicationAllowance}
                          onChange={e => handleUpdateItemAmount(idx, 'communicationAllowance', Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-1 px-1.5 whitespace-nowrap">
                        <input
                          type="number"
                          disabled={isDayEnded}
                          value={item.travelAllowance}
                          onChange={e => handleUpdateItemAmount(idx, 'travelAllowance', Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-1 px-1.5 whitespace-nowrap">
                        <input
                          type="number"
                          disabled={isDayEnded}
                          value={item.refreshmentAllowance}
                          onChange={e => handleUpdateItemAmount(idx, 'refreshmentAllowance', Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-1 px-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.grossAllowance.toLocaleString()}
                      </td>
                      <td className="py-1 px-2 font-mono font-bold text-rose-600 whitespace-nowrap">
                        {item.tdsAmount.toLocaleString()}
                      </td>
                      <td className="py-1 px-2 font-mono font-black text-emerald-700 whitespace-nowrap">
                        {item.netPayable.toLocaleString()}
                      </td>
                      <td className="py-1 px-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleItemStatus(idx)}
                          disabled={isDayEnded}
                          title={isDayEnded ? getDayEndedBlockMessage() : "Toggle Paid Status"}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                            item.status === 'Paid'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {item.status}
                        </button>
                      </td>
                      <td className="py-1 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => setPrintingVoucher(item)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Print Pay Voucher"
                        >
                          <Printer size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-xs border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="py-1 px-2 uppercase text-[10px] whitespace-nowrap">Total</td>
                    <td colSpan={4} className="py-1 px-2 text-right text-slate-500 text-[10px] whitespace-nowrap">Summary:</td>
                    <td className="py-1 px-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                      Rs. {activeAllowanceItems.reduce((acc, i) => acc + i.grossAllowance, 0).toLocaleString()}
                    </td>
                    <td className="py-1 px-2 font-mono font-bold text-rose-600 whitespace-nowrap">
                      Rs. {activeAllowanceItems.reduce((acc, i) => acc + i.tdsAmount, 0).toLocaleString()}
                    </td>
                    <td className="py-1 px-2 font-mono font-black text-emerald-700 whitespace-nowrap">
                      Rs. {activeAllowanceItems.reduce((acc, i) => acc + i.netPayable, 0).toLocaleString()}
                    </td>
                    <td colSpan={2} className="whitespace-nowrap" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ARCHIVE */}
      {activeTab === 'archive' && (
        <div className="space-y-1.5">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
              <h3 className="text-xs font-black text-slate-900 uppercase">
                Allowance & Payroll Records
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-2.5 w-10 text-center">S.N.</th>
                    <th className="py-1.5 px-2.5">Fiscal Year</th>
                    <th className="py-1.5 px-2.5">Month</th>
                    <th className="py-1.5 px-2.5">Sheet Date (BS)</th>
                    <th className="py-1.5 px-2.5 text-right">Gross Total (Rs)</th>
                    <th className="py-1.5 px-2.5 text-right text-rose-600">15% TDS (Rs)</th>
                    <th className="py-1.5 px-2.5 text-right text-emerald-700">Net Payable (Rs)</th>
                    <th className="py-1.5 px-2.5 text-center">Status</th>
                    <th className="py-1.5 px-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allowanceSheets.map((sheet, idx) => (
                    <tr key={sheet.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-1.5 px-2.5 font-mono font-bold text-slate-800">{sheet.fiscalYear}</td>
                      <td className="py-1.5 px-2.5 font-bold text-slate-900">{sheet.month}</td>
                      <td className="py-1.5 px-2.5 font-mono text-slate-600">{sheet.dateBs}</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                        {sheet.totalGross.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-600">
                        {sheet.totalTds.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-black text-emerald-700">
                        {sheet.totalNet.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold uppercase">
                          {sheet.status || 'Approved'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => {
                              setSelectedFiscalYear(sheet.fiscalYear);
                              setSelectedMonth(sheet.month);
                              if (sheet.paymentFrequency) setSelectedFrequency(sheet.paymentFrequency);
                              setPreparedByEmployee(sheet.preparedBy || '');
                              setCheckedByEmployee(sheet.checkedBy || '');
                              setApprovedByEmployee(sheet.approvedBy || '');
                              setViewingArchivedSheet(sheet);
                            }}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[11px] flex items-center space-x-1"
                          >
                            <Eye size={11} />
                            <span>View Sheet</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFiscalYear(sheet.fiscalYear);
                              setSelectedMonth(sheet.month);
                              if (sheet.paymentFrequency) setSelectedFrequency(sheet.paymentFrequency);
                              setPreparedByEmployee(sheet.preparedBy || '');
                              setCheckedByEmployee(sheet.checkedBy || '');
                              setApprovedByEmployee(sheet.approvedBy || '');
                              setPrintingBankAdvice(sheet.items);
                            }}
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Print Bank Advice"
                          >
                            <Printer size={12} />
                          </button>
                          <button
                            onClick={() => { if (!isDayEnded) setConfirmDeleteSheetId(sheet.id); }}
                            disabled={isDayEnded}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : "Delete"}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allowanceSheets.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-slate-400 italic">
                        No allowance sheets archived yet. Go to the Payroll tab and click "Save & Archive Sheet".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW ARCHIVED SHEET DETAILS */}
      {viewingArchivedSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase">
                  Archived Allowance Sheet: {viewingArchivedSheet.month} {viewingArchivedSheet.fiscalYear}
                </h2>
                <p className="text-xs text-slate-500">Date: {viewingArchivedSheet.dateBs}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedFiscalYear(viewingArchivedSheet.fiscalYear);
                    setSelectedMonth(viewingArchivedSheet.month);
                    if (viewingArchivedSheet.paymentFrequency) setSelectedFrequency(viewingArchivedSheet.paymentFrequency);
                    setPreparedByEmployee(viewingArchivedSheet.preparedBy || '');
                    setCheckedByEmployee(viewingArchivedSheet.checkedBy || '');
                    setApprovedByEmployee(viewingArchivedSheet.approvedBy || '');
                    setPrintingBankAdvice(viewingArchivedSheet.items);
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center space-x-1"
                >
                  <Printer size={13} />
                  <span>Print Advice</span>
                </button>
                <button
                  onClick={() => setViewingArchivedSheet(null)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="p-2.5 whitespace-nowrap">Member Name</th>
                    <th className="p-2.5 whitespace-nowrap">Role</th>
                    <th className="p-2.5 whitespace-nowrap">Bank & A/C</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Gross (Rs)</th>
                    <th className="p-2.5 text-right text-rose-600 whitespace-nowrap">15% TDS</th>
                    <th className="p-2.5 text-right text-emerald-700 whitespace-nowrap">Net Payable</th>
                    <th className="p-2.5 text-center whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {viewingArchivedSheet.items.map(item => (
                    <tr key={item.memberId} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{item.memberName}</td>
                      <td className="p-2.5 whitespace-nowrap">{item.designation}</td>
                      <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{item.bankName} - {item.bankAccountNo}</td>
                      <td className="p-2.5 text-right font-mono whitespace-nowrap">{item.grossAllowance.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-mono text-rose-600 whitespace-nowrap">{item.tdsAmount.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">{item.netPayable.toLocaleString()}</td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DOCUMENTS HUB (ELECTION CERTIFICATE, APPRECIATION, ID CARD, VISITING CARD, MANDATE) */}
      {activeTab === 'documents' && (
        <BoardDocumentsHub
          members={members}
          settings={settings}
          onEditMember={(m) => setEditingMember(m)}
        />
      )}

      {/* MODAL: FULL HUBAHU KYM FOR BOARD MEMBER (MATCHING UPLOADED FORMS) */}
      {editingMember && (
        <BoardKYMFormModal
          key={editingMember.id}
          member={editingMember}
          categories={categories}
          designations={designations}
          settings={settings}
          branchId={currentBranch?.id}
          mode="edit"
          onSave={handleSaveMember}
          onClose={() => setEditingMember(null)}
          onOpenCreateDesignation={() => {
            if (isDayEnded) return;
            setEditingDesignation({
              id: `des_${Date.now()}`,
              title: '',
              code: '',
              categoryId: 'all',
              categoryName: 'All Committees',
              mandate: '',
              defaultAllowance: 0,
              displayOrder: designations.length + 1,
              isCustom: true
            });
            setIsDesignationModalOpen(true);
          }}
        />
      )}

      {/* MODAL: VIEW FULL KYM FARAM (Shows ALL details filled from Add Board) */}
      {viewingMember && (
        <BoardKYMDetailView
          member={viewingMember}
          settings={settings}
          branchId={currentBranch?.id}
          onEdit={() => {
            if (isDayEnded) return;
            const m = viewingMember;
            setViewingMember(null);
            setEditingMember(m);
          }}
          onClose={() => setViewingMember(null)}
        />
      )}

      {/* MODAL: ADD / EDIT COMMITTEE */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in zoom-in-95">
            <h2 className="text-base font-black text-slate-900 uppercase">
              {categories.some(c => c.id === editingCategory.id) ? 'Edit Committee' : 'New Committee Category'}
            </h2>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (isDayEnded) return;
                handleSaveCategory(editingCategory);
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              <DayEndFieldset branchId={currentBranch?.id} className="space-y-3.5">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Committee Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.name}
                    onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    placeholder="e.g. Loan Sub-Committee"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-1">Short Code *</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.code}
                    onChange={e => setEditingCategory({ ...editingCategory, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. LSC"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-1">Description & Scope</label>
                  <textarea
                    rows={3}
                    value={editingCategory.description || ''}
                    onChange={e => setEditingCategory({ ...editingCategory, description: e.target.value })}
                    placeholder="Committee objectives, quorum, and appraisal roles"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </DayEndFieldset>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-4 py-2 bg-slate-900 text-white font-black rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save Committee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DESIGNATION */}
      {isDesignationModalOpen && editingDesignation && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Award size={18} />
                </div>
                <h2 className="text-base font-black text-slate-900 uppercase">
                  {designations.some(d => d.id === editingDesignation.id) ? 'Edit Designation' : 'New Board Designation'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDesignationModalOpen(false);
                  setEditingDesignation(null);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (isDayEnded) return;
                handleSaveDesignation(editingDesignation);
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <DayEndFieldset branchId={currentBranch?.id}>
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5 text-xs">
                    Designation Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={editingDesignation.title}
                    onChange={e => setEditingDesignation({ ...editingDesignation, title: e.target.value })}
                    placeholder="e.g. Chairperson, Vice-Chairperson, General Secretary, Member, Coordinator"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all text-xs"
                  />
                </div>
              </DayEndFieldset>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDesignationModalOpen(false);
                    setEditingDesignation(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-black rounded-xl shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT DIALOG / PREVIEW MODAL */}
      {printingBankAdvice && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0 print:overflow-visible print:block print:w-full print:h-auto print:m-0 print:z-auto">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              #payroll-bank-advice-doc, #payroll-bank-advice-doc * {
                visibility: visible;
              }
              #payroll-bank-advice-doc {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 4mm;
                background: #ffffff !important;
              }
              @page {
                size: A4 portrait;
                margin: 5mm 5mm !important;
              }
              .no-print {
                display: none !important;
              }
            }
          ` }} />
          <div className={`bg-white rounded-2xl w-full ${isFullScreenPreview ? 'max-w-full' : 'max-w-6xl xl:max-w-7xl'} p-4 sm:p-8 md:p-10 shadow-2xl border border-slate-200 overflow-y-auto min-h-[92vh] transition-all print:min-h-0 print:max-h-none print:overflow-visible print:w-full print:max-w-none print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none`}>
            {/* Top Control Bar */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 no-print">
              <div className="flex items-center space-x-2">
                <span className="font-black text-xs uppercase tracking-wider text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
                  Preview
                </span>
                <button
                  type="button"
                  onClick={() => setIsFullScreenPreview(!isFullScreenPreview)}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors border border-slate-200"
                  title={isFullScreenPreview ? "Standard View" : "Full Page View"}
                >
                  {isFullScreenPreview ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{isFullScreenPreview ? "Standard View" : "Full Page"}</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveAllowanceSheet}
                  disabled={isSavingAllowance || isDayEnded}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  title={isDayEnded ? getDayEndedBlockMessage() : "Save & Archive Sheet"}
                >
                  <ArchiveIcon size={13} />
                  <span>{isSavingAllowance ? 'Saving...' : 'Save & Archive'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-xs"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintingBankAdvice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Document */}
            <div id="payroll-bank-advice-doc" className="mt-4 text-xs text-slate-900 space-y-4 print:mt-0 print:space-y-3">
              {/* HEADER MATCHING FIRST PHOTO */}
              <div className="flex flex-col items-center justify-center text-center pb-3 border-b-2 border-slate-900">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                    <img 
                      src={(settings?.logoUrl && !settings.logoUrl.includes('picsum.photos')) ? settings.logoUrl : '/system_logo.png'} 
                      alt="Logo" 
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.includes('system_logo.png')) {
                          target.src = '/system_logo.png';
                        }
                      }}
                      className="w-16 h-16 object-contain" 
                    />
                  </div>
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-snug">
                      रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                    </h1>
                    <p className="text-sm sm:text-base font-bold text-slate-800 mt-0.5">
                      पिपरा गाउँपालिका -६, महोत्तरी
                    </p>
                  </div>
                </div>

                {/* Pill Badge matching Request */}
                <div className="mt-1 inline-block border-2 border-slate-900 rounded-full px-8 py-1.5 bg-white">
                  <span className="text-sm sm:text-base font-black text-slate-950 whitespace-nowrap">
                    आ.व. {toNepaliNum(selectedFiscalYear)} को {NEPALI_MONTH_NAME_MAP[selectedMonth] || selectedMonth} {
                      selectedFrequency === 'quarterly'
                        ? 'त्रैमासिक'
                        : selectedFrequency === 'half_yearly'
                        ? 'अर्धवार्षिक'
                        : selectedFrequency === 'yearly'
                        ? 'वार्षिक'
                        : 'महिना'
                    } सञ्चालक भत्ता
                  </span>
                </div>
              </div>

              {/* TABLE WITH REQUESTED COLUMNS: S.N., Board Member, Gross NPR, TDS (15%), Net Payable NPR, Bank Name, Account No, Signature */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs border-2 border-slate-900 border-collapse my-3">
                  <thead>
                    <tr className="bg-slate-100 font-black text-slate-900 border-b-2 border-slate-900 text-center">
                      <th className="p-2 border-r border-slate-900 w-12 text-center whitespace-nowrap">S.N.</th>
                      <th className="p-2 border-r border-slate-900 text-left min-w-[150px] whitespace-nowrap">Board Member</th>
                      <th className="p-2 border-r border-slate-900 text-right min-w-[95px] whitespace-nowrap">Gross NPR</th>
                      <th className="p-2 border-r border-slate-900 text-right min-w-[85px] whitespace-nowrap">TDS (15%)</th>
                      <th className="p-2 border-r border-slate-900 text-right min-w-[105px] whitespace-nowrap">Net Payable NPR</th>
                      <th className="p-2 border-r border-slate-900 text-left min-w-[110px] whitespace-nowrap">Bank Name</th>
                      <th className="p-2 border-r border-slate-900 text-left min-w-[110px] whitespace-nowrap">Account No</th>
                      <th className="p-2 min-w-[90px] text-center whitespace-nowrap">Signature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b-2 border-slate-900">
                    {printingBankAdvice.map((item, idx) => (
                      <tr key={item.memberId} className="hover:bg-slate-50">
                        <td className="p-2 border-r border-slate-900 text-center font-bold text-slate-700 whitespace-nowrap">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-900 font-black text-slate-900 whitespace-nowrap">
                          {item.memberName}
                        </td>
                        <td className="p-2 border-r border-slate-900 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {item.grossAllowance.toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-slate-900 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                          {item.tdsAmount.toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-slate-900 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                          {item.netPayable.toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-slate-900 text-slate-800 font-medium whitespace-nowrap">
                          {item.bankName || '-'}
                        </td>
                        <td className="p-2 border-r border-slate-900 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {item.bankAccountNo || '-'}
                        </td>
                        <td className="p-2 text-center text-slate-300 whitespace-nowrap"></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-900">
                      <td colSpan={2} className="p-2 border-r border-slate-900 text-center uppercase tracking-wider text-xs whitespace-nowrap">
                        Total / जम्मा
                      </td>
                      <td className="p-2 border-r border-slate-900 text-right font-mono text-xs whitespace-nowrap">
                        {printingBankAdvice.reduce((sum, i) => sum + i.grossAllowance, 0).toLocaleString()}
                      </td>
                      <td className="p-2 border-r border-slate-900 text-right font-mono text-rose-600 text-xs whitespace-nowrap">
                        {printingBankAdvice.reduce((sum, i) => sum + i.tdsAmount, 0).toLocaleString()}
                      </td>
                      <td className="p-2 border-r border-slate-900 text-right font-mono text-emerald-800 text-xs font-black whitespace-nowrap">
                        {printingBankAdvice.reduce((sum, i) => sum + i.netPayable, 0).toLocaleString()}
                      </td>
                      <td colSpan={3} className="p-2 bg-slate-50 whitespace-nowrap" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* FOOTER MATCHING USER REQUEST */}
              <div className="pt-10 pb-4 grid grid-cols-3 gap-6 text-center font-bold text-xs">
                <div>
                  <div className="border-b border-dotted border-slate-900 w-48 mx-auto mb-2" />
                  <div className="no-print mb-1.5 flex justify-center">
                    <select
                      value={preparedByEmployee}
                      onChange={e => setPreparedByEmployee(e.target.value)}
                      className="w-48 text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-800"
                    >
                      <option value="">-- कर्मचारी छान्नुहोस् --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.fullName}>
                          {emp.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs font-bold text-slate-800 min-h-[18px]">
                    {preparedByEmployee ? `Name: ${preparedByEmployee}` : <span className="text-slate-400 print:text-slate-900">Name: ______________________</span>}
                  </div>
                  <div className="text-xs font-black text-slate-950 uppercase mt-0.5 tracking-wider">
                    Prepared By
                  </div>
                </div>

                <div>
                  <div className="border-b border-dotted border-slate-900 w-48 mx-auto mb-2" />
                  <div className="no-print mb-1.5 flex justify-center">
                    <select
                      value={checkedByEmployee}
                      onChange={e => setCheckedByEmployee(e.target.value)}
                      className="w-48 text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-800"
                    >
                      <option value="">-- कर्मचारी छान्नुहोस् --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.fullName}>
                          {emp.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs font-bold text-slate-800 min-h-[18px]">
                    {checkedByEmployee ? `Name: ${checkedByEmployee}` : <span className="text-slate-400 print:text-slate-900">Name: ______________________</span>}
                  </div>
                  <div className="text-xs font-black text-slate-950 uppercase mt-0.5 tracking-wider">
                    Checked By
                  </div>
                </div>

                <div>
                  <div className="border-b border-dotted border-slate-900 w-48 mx-auto mb-2" />
                  <div className="no-print mb-1.5 flex justify-center">
                    <select
                      value={approvedByEmployee}
                      onChange={e => setApprovedByEmployee(e.target.value)}
                      className="w-48 text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-800"
                    >
                      <option value="">-- कर्मचारी छान्नुहोस् --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.fullName}>
                          {emp.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs font-bold text-slate-800 min-h-[18px]">
                    {approvedByEmployee ? `Name: ${approvedByEmployee}` : <span className="text-slate-400 print:text-slate-900">Name: ______________________</span>}
                  </div>
                  <div className="text-xs font-black text-slate-950 uppercase mt-0.5 tracking-wider">
                    Approved By
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar in Preview for Save & Archive */}
              <div className="no-print pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleSaveAllowanceSheet}
                  disabled={isSavingAllowance || isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : "Save & Archive"}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArchiveIcon size={14} />
                  <span>{isSavingAllowance ? 'Saving...' : 'Save & Archive'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all"
                >
                  <Printer size={14} />
                  <span>Print Advice</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT DIALOG: SINGLE VOUCHER SLIP */}
      {printingVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 no-print">
              <span className="font-bold text-xs uppercase">E-Pay Slip Preview</span>
              <button onClick={() => setPrintingVoucher(null)} className="p-1 text-slate-400">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 p-4 border border-slate-300 rounded-2xl text-xs space-y-3">
              <div className="text-center pb-2 border-b border-slate-200">
                <h3 className="font-black text-sm uppercase">{settings?.systemName || 'RATAULI COOPERATIVE'}</h3>
                <span className="text-[10px] text-slate-500 font-bold block">Board Benefit Slip • {selectedMonth} {selectedFiscalYear}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Member:</span>
                <span className="font-bold">{printingVoucher.memberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Designation:</span>
                <span className="font-bold">{printingVoucher.designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PAN ID:</span>
                <span className="font-mono font-bold">{printingVoucher.panNo}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Meeting Allowance:</span>
                  <span>Rs. {printingVoucher.meetingAllowance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Communication:</span>
                  <span>Rs. {printingVoucher.communicationAllowance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Travel & Conveyance:</span>
                  <span>Rs. {printingVoucher.travelAllowance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>TADA / Snacks:</span>
                  <span>Rs. {printingVoucher.refreshmentAllowance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span>Gross Total:</span>
                  <span>Rs. {printingVoucher.grossAllowance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Less 15% TDS:</span>
                  <span>- Rs. {printingVoucher.tdsAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 border-t-2 border-slate-900 font-black text-emerald-700 text-sm">
                  <span>Net Payable:</span>
                  <span>Rs. {printingVoucher.netPayable.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-2 no-print">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Print Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODALS */}
      {confirmDeleteMemberId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
            <AlertTriangle size={36} className="mx-auto text-rose-500 mb-2" />
            <h3 className="text-sm font-black text-slate-900 uppercase">Remove Board Member?</h3>
            <p className="text-xs text-slate-500 mt-1">This will permanently delete this member's profile and KYC records.</p>
            <div className="mt-4 flex justify-center space-x-2">
              <button
                onClick={() => setConfirmDeleteMemberId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMember(confirmDeleteMemberId)}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteCategoryId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
            <AlertTriangle size={36} className="mx-auto text-rose-500 mb-2" />
            <h3 className="text-sm font-black text-slate-900 uppercase">Delete Committee?</h3>
            <p className="text-xs text-slate-500 mt-1">This will remove this committee category from the system.</p>
            <div className="mt-4 flex justify-center space-x-2">
              <button
                onClick={() => setConfirmDeleteCategoryId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCategory(confirmDeleteCategoryId)}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDesignationId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
            <AlertTriangle size={36} className="mx-auto text-rose-500 mb-2" />
            <h3 className="text-sm font-black text-slate-900 uppercase">Delete Designation?</h3>
            <p className="text-xs text-slate-500 mt-1">This will remove this designation from the board directory.</p>
            <div className="mt-4 flex justify-center space-x-2">
              <button
                onClick={() => setConfirmDeleteDesignationId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDesignation(confirmDeleteDesignationId)}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteSheetId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
            <AlertTriangle size={36} className="mx-auto text-rose-500 mb-2" />
            <h3 className="text-sm font-black text-slate-900 uppercase">Delete Archived Sheet?</h3>
            <p className="text-xs text-slate-500 mt-1">This will remove this archived monthly allowance record.</p>
            <div className="mt-4 flex justify-center space-x-2">
              <button
                onClick={() => setConfirmDeleteSheetId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSheet(confirmDeleteSheetId)}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean container for single-click PDF generation of KYM Form */}
      {pdfTargetMember && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center flex flex-col items-center">
            <Loader2 size={36} className="text-emerald-600 animate-spin mb-3" />
            <h3 className="text-base font-bold text-slate-800">KYM फाराम PDF तयार हुँदैछ...</h3>
            <p className="text-xs text-slate-500 mt-1">
              <strong>{pdfTargetMember.fullName}</strong> को आधिकारिक अनुसूची-१ डाउनलोड हुँदैछ।
            </p>
          </div>
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: '840px',
              backgroundColor: '#ffffff',
              zIndex: 9999,
              pointerEvents: 'none',
              overflow: 'visible'
            }}
          >
            <BoardKYMPrintableContent
              member={pdfTargetMember}
              settings={settings}
              id="board-kym-pdf-offscreen-target"
            />
          </div>
        </div>
      )}
    </div>
  );
};
