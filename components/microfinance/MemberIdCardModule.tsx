import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import NepaliDate from 'nepali-date-converter';
import {
  CreditCard,
  Printer,
  Search,
  Check,
  Upload,
  User,
  Users,
  CheckSquare,
  Square,
  SlidersHorizontal,
  RotateCcw,
  Camera,
  FileCheck2,
  Layers,
  X
} from 'lucide-react';
import {
  MFCenter,
  MFSamuhGroup,
  MFMember,
  MFSavingsRecord,
  isSavingStatusClosed,
  microFinanceService,
  normalizeBsDate,
  normalizeDuplicateMemberId
} from '../../services/microFinanceService';

export type IdCardTemplateId =
  | 'single-card-official'
  | 'classic-crimson'
  | 'executive-navy'
  | 'emerald-trust'
  | 'modern-vertical'
  | 'minimal-ivory';

export type IdCardSideMode = 'front' | 'back' | 'both';

interface IdCardTemplateConfig {
  id: IdCardTemplateId;
  name: string;
  orientation: 'horizontal' | 'vertical';
  subtitle: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  headerText: string;
  isLightHeader?: boolean;
  isSingleSideAllInOne?: boolean;
}

const ID_CARD_TEMPLATES: IdCardTemplateConfig[] = [
  {
    id: 'single-card-official',
    name: 'Official Single Card',
    orientation: 'horizontal',
    subtitle: 'Single Side · All-in-One',
    primary: '#007a4d',
    secondary: '#c81e1e',
    accent: '#eab308',
    surface: '#ffffff',
    headerText: '#ffffff',
    isSingleSideAllInOne: true
  },
  {
    id: 'classic-crimson',
    name: 'Classic Cooperative',
    orientation: 'horizontal',
    subtitle: 'Horizontal · Crimson & Gold',
    primary: '#881337',
    secondary: '#4c0519',
    accent: '#d97706',
    surface: '#ffffff',
    headerText: '#ffffff'
  },
  {
    id: 'executive-navy',
    name: 'Executive Navy',
    orientation: 'horizontal',
    subtitle: 'Horizontal · Navy & Brass',
    primary: '#0f294a',
    secondary: '#1e3a5f',
    accent: '#ca8a04',
    surface: '#ffffff',
    headerText: '#ffffff'
  },
  {
    id: 'emerald-trust',
    name: 'Emerald Trust',
    orientation: 'horizontal',
    subtitle: 'Horizontal · Forest & Sage',
    primary: '#065f46',
    secondary: '#064e3b',
    accent: '#10b981',
    surface: '#f8fafc',
    headerText: '#ffffff'
  },
  {
    id: 'modern-vertical',
    name: 'Modern Portrait',
    orientation: 'vertical',
    subtitle: 'Vertical · Portrait Layout',
    primary: '#0f172a',
    secondary: '#0d9488',
    accent: '#14b8a6',
    surface: '#ffffff',
    headerText: '#ffffff'
  },
  {
    id: 'minimal-ivory',
    name: 'Minimal Institutional',
    orientation: 'horizontal',
    subtitle: 'Horizontal · Print-Friendly',
    primary: '#18181b',
    secondary: '#3f3f46',
    accent: '#1d4ed8',
    surface: '#ffffff',
    headerText: '#18181b',
    isLightHeader: true
  }
];

const ACCENT_PRESETS = [
  { label: 'Template Default', value: '' },
  { label: 'Crimson', value: '#881337' },
  { label: 'Navy', value: '#0f294a' },
  { label: 'Emerald', value: '#065f46' },
  { label: 'Royal Blue', value: '#1d4ed8' },
  { label: 'Charcoal', value: '#1e293b' },
  { label: 'Teal', value: '#0f766e' }
];

interface CardData {
  id: string;
  memberId: string;
  name: string;
  role: string;
  centerName: string;
  groupName: string;
  branch: string;
  mobile: string;
  citizenshipNo: string;
  savingsAccountNo: string;
  photoUrl: string;
  bloodGroup?: string;
  issueDate?: string;
  validUntil?: string;
}

interface MemberIdCardModuleProps {
  members: MFMember[];
  centers: MFCenter[];
  groups: MFSamuhGroup[];
  savings?: MFSavingsRecord[];
  logoUrl: string;
  organizationNameNp?: string;
  organizationName: string;
  organizationAddress: string;
  organizationPhone: string;
  registrationNo?: string;
  panNo?: string;
  defaultIssueDate: string;
  onMembersUpdated: (updated: MFMember[]) => void;
  onToast: (msg: string) => void;
}

const fromNepaliDigitsLocal = (str: string): string => {
  const np = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(str || '').replace(/[०-९]/g, d => String(np.indexOf(d)));
};

const normalizeTextLocal = (val?: string): string =>
  fromNepaliDigitsLocal(String(val || ''))
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const extractMeetingDayLocal = (meetingDay?: string): number | null => {
  if (!meetingDay) return null;
  const normalized = fromNepaliDigitsLocal(meetingDay);
  const match = normalized.match(/\d+/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  return isNaN(num) ? null : num;
};

const addYearsToDateString = (dateStr: string, years: number): string => {
  const clean = fromNepaliDigitsLocal(dateStr || '').trim();
  const m = clean.match(/^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/);
  if (m) {
    const nextYear = parseInt(m[1], 10) + years;
    return `${nextYear}-${m[3].padStart(2, '0')}-${m[4].padStart(2, '0')}`;
  }
  return clean || '2029-12-31';
};

const resolveSavingOpenDateBsLocal = (saving: { dateBs?: string; date?: string }): string => {
  const bsNorm = normalizeBsDate(saving.dateBs);
  if (bsNorm && /^\d{4}-\d{2}-\d{2}$/.test(bsNorm)) return bsNorm;

  const rawNorm = normalizeBsDate(saving.date);
  if (rawNorm && /^20[5-9]\d-\d{2}-\d{2}$/.test(rawNorm)) return rawNorm;

  if (saving.date) {
    try {
      const converted = new NepaliDate(new Date(saving.date)).format('YYYY-MM-DD');
      return normalizeBsDate(converted);
    } catch {
      return rawNorm || '';
    }
  }
  return '';
};

const findMemberSavingOpenDateBs = (
  savingsList: MFSavingsRecord[],
  member?: { memberId?: string; savingsAccountNo?: string } | null
): string => {
  if (!member || savingsList.length === 0) return '';
  const memKey = normalizeDuplicateMemberId(member.memberId);
  const accKey = normalizeDuplicateMemberId(member.savingsAccountNo);
  if (!memKey && !accKey) return '';

  const matched = savingsList.filter(s => {
    const sMemKey = normalizeDuplicateMemberId(s.memberId);
    const sAccKey = normalizeDuplicateMemberId(s.accountNo);
    if (memKey && sMemKey && sMemKey === memKey) return true;
    if (accKey && sAccKey && sAccKey === accKey) return true;
    return false;
  });

  if (matched.length === 0) return '';

  const activeMatched = matched.filter(s => !isSavingStatusClosed(s.status));
  const pool = activeMatched.length > 0 ? activeMatched : matched;

  const dates = pool
    .map(s => resolveSavingOpenDateBsLocal(s))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort((a, b) => a.localeCompare(b));

  return dates[0] || '';
};

// Deterministic pseudo-barcode bars from Member ID string
const buildBarcodeBars = (code: string): { x: number; w: number }[] => {
  const text = (code || 'MEMBER-0001').toUpperCase();
  const bars: { x: number; w: number }[] = [];
  let x = 2;
  // Start guard
  bars.push({ x, w: 1.8 }); x += 3;
  bars.push({ x, w: 1 }); x += 2.2;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const pattern = [
      (c % 3) === 0 ? 2 : 1,
      ((c >> 1) % 2) === 0 ? 1.2 : 2.2,
      ((c >> 2) % 3) === 0 ? 1.8 : 1,
      ((c >> 3) % 2) === 0 ? 1.4 : 0.9
    ];
    for (let j = 0; j < pattern.length; j++) {
      if (j % 2 === 0) {
        bars.push({ x, w: pattern[j] });
      }
      x += pattern[j] + 0.9;
      if (x > 168) break;
    }
    if (x > 168) break;
  }
  // End guard
  bars.push({ x: Math.min(x, 170), w: 1 });
  bars.push({ x: Math.min(x + 2.2, 173), w: 1.8 });
  return bars;
};

const escapeHtml = (val: string): string =>
  String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const SIGNATORY_STORAGE_KEY = 'mf_id_card_signatory_photo';

const buildBarcodeSvgString = (code: string, color = '#0f172a'): string => {
  const bars = buildBarcodeBars(code);
  const rects = bars
    .map(b => `<rect x="${b.x.toFixed(1)}" y="0" width="${b.w.toFixed(1)}" height="18" fill="${color}" />`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 18" preserveAspectRatio="none" style="width:100%;height:14px;display:block;">${rects}</svg>`;
};

const buildMemberQrPayload = (
  card: CardData,
  meta: {
    orgName: string;
    regdNo: string;
    panNumber: string;
    issueDate: string;
    validUntil: string;
    orgWebsite: string;
  }
): string => {
  const lines: string[] = [
    meta.orgName,
    `Name: ${(card.name || '-').toUpperCase()}`,
    `Member ID: ${card.memberId || '-'}`,
    `Role: ${card.role || 'Member'}`,
    `Center: ${card.centerName || '-'}`,
    `Group: ${card.groupName || '-'}`,
    `Branch: ${card.branch || '-'}`
  ];
  if (card.mobile) lines.push(`Mobile: ${card.mobile}`);
  if (card.citizenshipNo) lines.push(`Citizenship: ${card.citizenshipNo}`);
  if (card.savingsAccountNo) lines.push(`Savings A/C: ${card.savingsAccountNo}`);
  if (card.bloodGroup) lines.push(`Blood Group: ${card.bloodGroup}`);
  lines.push(`Regd: ${meta.regdNo} | PAN: ${meta.panNumber}`);
  lines.push(`Issued: ${meta.issueDate} | Valid: ${meta.validUntil}`);
  if (meta.orgWebsite) lines.push(`Web: ${meta.orgWebsite}`);
  return lines.join('\n');
};

const buildQrSvgData = (payload: string): { size: number; path: string } => {
  const makeMatrix = (text: string) => {
    const qr = QRCode.create(text || 'MEMBER', { errorCorrectionLevel: 'L' });
    const n = qr.modules.size;
    const margin = 2;
    const total = n + margin * 2;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.modules.get(r, c)) {
          d += `M${c + margin},${r + margin}h1v1h-1z`;
        }
      }
    }
    return { size: total, path: d };
  };
  try {
    return makeMatrix(payload);
  } catch {
    return makeMatrix(payload.slice(0, 180));
  }
};

const buildQrSvgString = (payload: string, sizeCss = '15mm'): string => {
  const { size, path } = buildQrSvgData(payload);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" style="width:${sizeCss};height:${sizeCss};display:block;background:#ffffff;"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${path}" fill="#0f172a"/></svg>`;
};

export const MemberIdCardModule: React.FC<MemberIdCardModuleProps> = ({
  members,
  centers,
  groups,
  savings,
  logoUrl,
  organizationNameNp,
  organizationName,
  organizationAddress,
  organizationPhone,
  registrationNo,
  panNo,
  defaultIssueDate,
  onMembersUpdated,
  onToast
}) => {
  const effectiveSavings = useMemo(
    () => (savings !== undefined ? savings : microFinanceService.getSavings()),
    [savings]
  );

  const fallbackIssueDate = defaultIssueDate || new Date().toISOString().split('T')[0];

  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [selectedTemplateId, setSelectedTemplateId] = useState<IdCardTemplateId>('single-card-official');
  const [cardSide, setCardSide] = useState<IdCardSideMode>('front');
  const [customPrimaryColor, setCustomPrimaryColor] = useState<string>('');
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);

  // Official Letterhead & Card Branding Settings
  const [regdNo, setRegdNo] = useState<string>(registrationNo || '421/054/055');
  const [panNumber, setPanNumber] = useState<string>(panNo || '302488825');
  const [orgNameNp, setOrgNameNp] = useState<string>(
    organizationNameNp || 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड'
  );
  const [orgName, setOrgName] = useState<string>(
    (organizationName || 'RATAULI SAVING & CREDIT CO-OPERATIVE LIMITED').toUpperCase()
  );
  const [orgAddress, setOrgAddress] = useState<string>(
    organizationAddress || 'पिपरा गाउँपालिका -६, रतौली, महोत्तरी'
  );
  const [orgPhone, setOrgPhone] = useState<string>(
    organizationPhone || '+977-044-000000'
  );
  const [orgWebsite, setOrgWebsite] = useState<string>('www.rataulisaccos.org.np');
  const [cardTitle, setCardTitle] = useState<string>('MEMBER IDENTITY CARD');
  const [isManualDateOverride, setIsManualDateOverride] = useState<boolean>(false);
  const [issueDate, setIssueDate] = useState<string>(() => {
    const firstSavingDate = findMemberSavingOpenDateBs(
      savings !== undefined ? savings : microFinanceService.getSavings(),
      members[0]
    );
    return firstSavingDate || fallbackIssueDate;
  });
  const [validUntil, setValidUntil] = useState<string>(() => {
    const firstSavingDate = findMemberSavingOpenDateBs(
      savings !== undefined ? savings : microFinanceService.getSavings(),
      members[0]
    );
    return addYearsToDateString(firstSavingDate || fallbackIssueDate, 6);
  });
  const [signatoryTitle, setSignatoryTitle] = useState<string>('Authorized Signatory');
  const [signatoryPhotoUrl, setSignatoryPhotoUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(SIGNATORY_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const signatoryPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Visible Field Toggles
  const [showMobile, setShowMobile] = useState<boolean>(true);
  const [showCitizenship, setShowCitizenship] = useState<boolean>(true);
  const [showBranch, setShowBranch] = useState<boolean>(true);
  const [showBarcode, setShowBarcode] = useState<boolean>(true);
  const [showQrCode, setShowQrCode] = useState<boolean>(true);
  const [showCutMarks, setShowCutMarks] = useState<boolean>(true);

  // Single Mode State
  const [singleCenterId, setSingleCenterId] = useState<string>('');
  const [singleGroupId, setSingleGroupId] = useState<string>('');
  const [singleSearch, setSingleSearch] = useState<string>('');
  const [selectedSingleMemberId, setSelectedSingleMemberId] = useState<string>(members[0]?.id || '');
  const [singleDraft, setSingleDraft] = useState<CardData>(() => {
    const first = members[0];
    const firstSavingDate = findMemberSavingOpenDateBs(
      savings !== undefined ? savings : microFinanceService.getSavings(),
      first
    );
    const resolvedIssue = firstSavingDate || fallbackIssueDate;
    return {
      id: first?.id || 'manual-1',
      memberId: first?.memberId || 'M-1001',
      name: first?.name || 'Member Full Name',
      role: first?.role || 'Member',
      centerName: first?.centerName || '',
      groupName: first?.samuhName || '',
      branch: first?.branch || 'Head Office',
      mobile: first?.mobile || '',
      citizenshipNo: first?.citizenshipNo || '',
      savingsAccountNo: first?.savingsAccountNo || '',
      photoUrl: first?.photoUrl || '',
      bloodGroup: '',
      issueDate: resolvedIssue,
      validUntil: addYearsToDateString(resolvedIssue, 6)
    };
  });
  const singlePhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Keep Single Card's Issued & Valid (+6 years) dates synced with the selected member's Saving open date
  useEffect(() => {
    const savingOpenDate = findMemberSavingOpenDateBs(effectiveSavings, {
      memberId: singleDraft.memberId,
      savingsAccountNo: singleDraft.savingsAccountNo
    });
    const resolvedIssue = savingOpenDate || fallbackIssueDate;
    const resolvedValid = addYearsToDateString(resolvedIssue, 6);

    setSingleDraft(prev => {
      if (prev.issueDate === resolvedIssue && prev.validUntil === resolvedValid) return prev;
      return { ...prev, issueDate: resolvedIssue, validUntil: resolvedValid };
    });

    if (!isManualDateOverride) {
      setIssueDate(resolvedIssue);
      setValidUntil(resolvedValid);
    }
  }, [effectiveSavings, singleDraft.memberId, singleDraft.savingsAccountNo, fallbackIssueDate, isManualDateOverride]);

  const resolveCardDates = (card: CardData): { cardIssueDate: string; cardValidUntil: string } => {
    if (isManualDateOverride) {
      return { cardIssueDate: issueDate, cardValidUntil: validUntil };
    }
    const savingOpenDate =
      card.issueDate ||
      findMemberSavingOpenDateBs(effectiveSavings, {
        memberId: card.memberId,
        savingsAccountNo: card.savingsAccountNo
      });
    const resolvedIssue = savingOpenDate || fallbackIssueDate;
    const resolvedValid = card.validUntil || addYearsToDateString(resolvedIssue, 6);
    return { cardIssueDate: resolvedIssue, cardValidUntil: resolvedValid };
  };

  // Bulk Mode State
  const [bulkCenterId, setBulkCenterId] = useState<string>('');
  const [bulkGroupId, setBulkGroupId] = useState<string>('');
  const [bulkStatusFilter, setBulkStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [bulkSearch, setBulkSearch] = useState<string>('');
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(() => new Set());
  const bulkPhotoTargetIdRef = useRef<string | null>(null);
  const bulkInlinePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const sortedCenters = useMemo(() => {
    return [...centers].sort((a, b) => {
      const dayA = extractMeetingDayLocal(a.meetingDay) ?? extractMeetingDayLocal(a.name) ?? Number.MAX_SAFE_INTEGER;
      const dayB = extractMeetingDayLocal(b.meetingDay) ?? extractMeetingDayLocal(b.name) ?? Number.MAX_SAFE_INTEGER;
      if (dayA !== dayB) return dayA - dayB;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [centers]);

  const getGroupsByCenter = (centerId: string) => {
    if (!centerId) return groups;
    const targetCenter = centers.find(c => c.id === centerId);
    const normCenter = normalizeTextLocal(targetCenter?.name);
    return groups.filter(
      g => g.centerId === centerId || (normCenter !== '' && normalizeTextLocal(g.centerName) === normCenter)
    );
  };

  const activeTemplate = useMemo(() => {
    const base = ID_CARD_TEMPLATES.find(t => t.id === selectedTemplateId) || ID_CARD_TEMPLATES[0];
    if (!customPrimaryColor) return base;
    return {
      ...base,
      primary: customPrimaryColor,
      secondary: customPrimaryColor,
      headerText: base.isLightHeader ? customPrimaryColor : '#ffffff'
    };
  }, [selectedTemplateId, customPrimaryColor]);

  // Filtered members for Single picker
  const singlePickerMembers = useMemo(() => {
    const q = singleSearch.trim().toLowerCase();
    const selCenter = singleCenterId ? centers.find(c => c.id === singleCenterId) : undefined;
    const selGroup = singleGroupId ? groups.find(g => g.id === singleGroupId) : undefined;
    const selCenterNorm = normalizeTextLocal(selCenter?.name);
    const selGroupNorm = normalizeTextLocal(selGroup?.name);

    return members.filter(m => {
      if (singleCenterId) {
        const matchC = m.centerId === singleCenterId || (selCenterNorm !== '' && normalizeTextLocal(m.centerName) === selCenterNorm);
        if (!matchC) return false;
      }
      if (singleGroupId) {
        const matchG = m.samuhId === singleGroupId || (selGroupNorm !== '' && normalizeTextLocal(m.samuhName) === selGroupNorm);
        if (!matchG) return false;
      }
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        (m.samuhName || '').toLowerCase().includes(q) ||
        (m.mobile || '').toLowerCase().includes(q)
      );
    });
  }, [members, centers, groups, singleCenterId, singleGroupId, singleSearch]);

  // Filtered members for Bulk mode
  const bulkFilteredMembers = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    const selCenter = bulkCenterId ? centers.find(c => c.id === bulkCenterId) : undefined;
    const selGroup = bulkGroupId ? groups.find(g => g.id === bulkGroupId) : undefined;
    const selCenterNorm = normalizeTextLocal(selCenter?.name);
    const selGroupNorm = normalizeTextLocal(selGroup?.name);

    return members.filter(m => {
      const effStatus = String(m.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (bulkStatusFilter !== 'ALL' && effStatus !== bulkStatusFilter) return false;

      if (bulkCenterId) {
        const matchC = m.centerId === bulkCenterId || (selCenterNorm !== '' && normalizeTextLocal(m.centerName) === selCenterNorm);
        if (!matchC) return false;
      }
      if (bulkGroupId) {
        const matchG = m.samuhId === bulkGroupId || (selGroupNorm !== '' && normalizeTextLocal(m.samuhName) === selGroupNorm);
        if (!matchG) return false;
      }
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        (m.samuhName || '').toLowerCase().includes(q) ||
        (m.centerName || '').toLowerCase().includes(q)
      );
    });
  }, [members, centers, groups, bulkCenterId, bulkGroupId, bulkStatusFilter, bulkSearch]);

  const selectedBulkCards: CardData[] = useMemo(() => {
    return members
      .filter(m => selectedBulkIds.has(m.id))
      .map(m => {
        const savingOpenDate = findMemberSavingOpenDateBs(effectiveSavings, m);
        const resolvedIssue = savingOpenDate || fallbackIssueDate;
        return {
          id: m.id,
          memberId: m.memberId || '',
          name: m.name || '',
          role: m.role || 'Member',
          centerName: m.centerName || '',
          groupName: m.samuhName || '',
          branch: m.branch || '',
          mobile: m.mobile || '',
          citizenshipNo: m.citizenshipNo || '',
          savingsAccountNo: m.savingsAccountNo || '',
          photoUrl: m.photoUrl || '',
          issueDate: resolvedIssue,
          validUntil: addYearsToDateString(resolvedIssue, 6)
        };
      });
  }, [members, selectedBulkIds, effectiveSavings, fallbackIssueDate]);

  const handleSelectSingleMember = (member: MFMember) => {
    setSelectedSingleMemberId(member.id);
    const savingOpenDate = findMemberSavingOpenDateBs(effectiveSavings, member);
    const resolvedIssue = savingOpenDate || fallbackIssueDate;
    const resolvedValid = addYearsToDateString(resolvedIssue, 6);
    setSingleDraft({
      id: member.id,
      memberId: member.memberId || '',
      name: member.name || '',
      role: member.role || 'Member',
      centerName: member.centerName || '',
      groupName: member.samuhName || '',
      branch: member.branch || '',
      mobile: member.mobile || '',
      citizenshipNo: member.citizenshipNo || '',
      savingsAccountNo: member.savingsAccountNo || '',
      photoUrl: member.photoUrl || '',
      bloodGroup: '',
      issueDate: resolvedIssue,
      validUntil: resolvedValid
    });
    if (!isManualDateOverride) {
      setIssueDate(resolvedIssue);
      setValidUntil(resolvedValid);
    }
  };

  const handleResetManualSingle = () => {
    setSelectedSingleMemberId('');
    setSingleDraft({
      id: `manual-${Date.now()}`,
      memberId: '',
      name: '',
      role: 'Member',
      centerName: '',
      groupName: '',
      branch: 'Head Office',
      mobile: '',
      citizenshipNo: '',
      savingsAccountNo: '',
      photoUrl: '',
      bloodGroup: '',
      issueDate: fallbackIssueDate,
      validUntil: addYearsToDateString(fallbackIssueDate, 6)
    });
  };

  const handleSinglePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onToast('Photo must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      setSingleDraft(prev => ({ ...prev, photoUrl: dataUrl }));
      if (selectedSingleMemberId) {
        microFinanceService.updateMember(selectedSingleMemberId, { photoUrl: dataUrl });
        onMembersUpdated(microFinanceService.getMembers());
        onToast('Member photo updated & saved.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBulkInlinePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = bulkPhotoTargetIdRef.current;
    if (!file || !targetId) return;
    if (file.size > 2 * 1024 * 1024) {
      onToast('Photo must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      microFinanceService.updateMember(targetId, { photoUrl: dataUrl });
      onMembersUpdated(microFinanceService.getMembers());
      onToast('Member photo saved.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleBulkMember = (id: string) => {
    setSelectedBulkIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFilteredBulk = () => {
    setSelectedBulkIds(prev => {
      const next = new Set(prev);
      bulkFilteredMembers.forEach(m => next.add(m.id));
      return next;
    });
    onToast(`Selected ${bulkFilteredMembers.length} member(s).`);
  };

  const handleSelectWithPhotoBulk = () => {
    const withPhoto = bulkFilteredMembers.filter(m => Boolean(m.photoUrl));
    setSelectedBulkIds(new Set(withPhoto.map(m => m.id)));
    onToast(`Selected ${withPhoto.length} member(s) with photos.`);
  };

  const handleClearBulkSelection = () => {
    setSelectedBulkIds(new Set());
  };

  const handleSignatoryPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onToast('Signature photo must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      setSignatoryPhotoUrl(dataUrl);
      try {
        localStorage.setItem(SIGNATORY_STORAGE_KEY, dataUrl);
      } catch {
        // Ignore storage quota errors
      }
      onToast('Authorized signatory photo uploaded.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveSignatoryPhoto = () => {
    setSignatoryPhotoUrl('');
    try {
      localStorage.removeItem(SIGNATORY_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    onToast('Authorized signatory photo removed.');
  };

  // Build self-contained printable HTML for CR80 cards (uses offscreen iframe, never window.open)
  const buildCardPrintHtml = (card: CardData, side: 'front' | 'back'): string => {
    const tpl = activeTemplate;
    const { cardIssueDate, cardValidUntil } = resolveCardDates(card);
    const isVert = tpl.orientation === 'vertical';
    const wMm = isVert ? '54mm' : '85.6mm';
    const hMm = isVert ? '85.6mm' : '54mm';
    const safeLogo = logoUrl.startsWith('http') || logoUrl.startsWith('data:')
      ? logoUrl
      : `${window.location.origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;

    const initials = (card.name || 'M')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(s => s[0] || '')
      .join('')
      .toUpperCase() || 'M';

    const photoHtml = card.photoUrl
      ? `<img src="${escapeHtml(card.photoUrl)}" alt="Photo" style="width:100%;height:100%;object-fit:cover;display:block;" />`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#334155;font-weight:800;font-size:${isVert ? '18px' : '16px'};">${escapeHtml(initials)}</div>`;

    const barcodeHtml = showBarcode
      ? `<div style="margin-top:${isVert ? '4px' : '2px'};">
           ${buildBarcodeSvgString(card.memberId || card.savingsAccountNo || 'MEMBER')}
         </div>`
      : '';

    const cutStyle = showCutMarks
      ? 'outline: 0.4pt dashed #94a3b8; outline-offset: 1.2mm;'
      : '';

    if (side === 'back') {
      return `
        <div class="id-card-shell" style="width:${wMm};height:${hMm};${cutStyle}background:#ffffff;border:0.6pt solid #cbd5e1;border-radius:3mm;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;position:relative;box-sizing:border-box;">
          <div style="background:${tpl.isLightHeader ? '#f8fafc' : tpl.primary};color:${tpl.isLightHeader ? tpl.primary : '#ffffff'};padding:${isVert ? '3mm 3.5mm' : '2.2mm 3.5mm'};border-bottom:${tpl.isLightHeader ? `1.5pt solid ${tpl.primary}` : `1.5pt solid ${tpl.accent}`};display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:6.5pt;font-weight:800;letter-spacing:0.6pt;text-transform:uppercase;">TERMS &amp; VERIFICATION</span>
            <span style="font-size:6pt;font-weight:700;font-family:monospace;">ID: ${escapeHtml(card.memberId || '-')}</span>
          </div>

          <div style="padding:${isVert ? '3mm 3.5mm' : '2.2mm 3.8mm'};flex:1;display:flex;flex-direction:column;justify-content:space-between;font-size:${isVert ? '6pt' : '6.2pt'};color:#334155;line-height:1.38;">
            <ul style="margin:0;padding-left:3.2mm;list-style:disc;">
              <li style="margin-bottom:1mm;">This identity card is the property of <strong>${escapeHtml(orgName)}</strong>.</li>
              <li style="margin-bottom:1mm;">Cardholder must present this ID during group meetings, savings deposits, and loan transactions.</li>
              <li style="margin-bottom:1mm;">Non-transferable. If found, please return to the issuing office listed below.</li>
            </ul>

            <div style="margin-top:1.5mm;padding:1.6mm 2.2mm;background:#f8fafc;border:0.5pt solid #e2e8f0;border-radius:1.5mm;display:grid;grid-template-columns:1fr 1fr;gap:1.5mm;font-size:5.8pt;">
              <div><span style="color:#64748b;display:block;font-size:5.2pt;text-transform:uppercase;">Issued Date</span><strong style="font-family:monospace;color:#0f172a;">${escapeHtml(cardIssueDate)}</strong></div>
              <div><span style="color:#64748b;display:block;font-size:5.2pt;text-transform:uppercase;">Valid Until</span><strong style="font-family:monospace;color:#0f172a;">${escapeHtml(cardValidUntil)}</strong></div>
            </div>

            <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:2mm;gap:3mm;">
              <div style="font-size:5.6pt;color:#475569;max-width:${isVert ? '58%' : '62%'};">
                <div style="font-weight:800;color:#0f172a;">${escapeHtml(orgName)}</div>
                <div>${escapeHtml(orgAddress)}</div>
                <div>Tel: ${escapeHtml(orgPhone)}</div>
              </div>
              <div style="text-align:center;min-width:20mm;display:flex;flex-direction:column;align-items:center;">
                ${
                  signatoryPhotoUrl
                    ? `<img src="${escapeHtml(signatoryPhotoUrl)}" alt="Signature" style="height:6mm;max-width:20mm;object-fit:contain;display:block;margin-bottom:0.3mm;mix-blend-mode:multiply;" />`
                    : ''
                }
                <div style="width:100%;border-top:0.6pt solid #475569;padding-top:0.8mm;font-size:5.5pt;font-weight:700;color:#0f172a;">${escapeHtml(signatoryTitle)}</div>
              </div>
            </div>
          </div>

          <div style="height:2mm;background:${tpl.primary};"></div>
        </div>
      `;
    }

    const isSingleAllInOne = Boolean(tpl.isSingleSideAllInOne);
    const upperName = (card.name || 'Member Name').toUpperCase();
    const qrPayload = buildMemberQrPayload(card, {
      orgName,
      regdNo,
      panNumber,
      issueDate: cardIssueDate,
      validUntil: cardValidUntil,
      orgWebsite
    });
    const qrBoxHtml = showQrCode
      ? `<div style="flex-shrink:0;width:15.2mm;height:15.2mm;padding:0.45mm;background:#ffffff;border:0.5pt solid #cbd5e1;border-radius:1.2mm;display:flex;align-items:center;justify-content:center;">
           ${buildQrSvgString(qrPayload, '14.1mm')}
         </div>`
      : '';
    const vertQrBoxHtml = showQrCode
      ? `<div style="flex-shrink:0;width:11.5mm;height:11.5mm;padding:0.35mm;background:#ffffff;border:0.5pt solid #cbd5e1;border-radius:1mm;display:flex;align-items:center;justify-content:center;">
           ${buildQrSvgString(qrPayload, '10.6mm')}
         </div>`
      : '';

    // FRONT SIDE — VERTICAL (Modern Portrait with Official Letterhead Header)
    if (isVert) {
      return `
        <div class="id-card-shell" style="width:${wMm};height:${hMm};${cutStyle}background:${tpl.surface};border:0.6pt solid #cbd5e1;border-radius:3mm;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;position:relative;box-sizing:border-box;">
          <div style="background:#ffffff;padding:1.4mm 2.2mm 1.1mm;text-align:center;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:4pt;font-weight:700;color:#1e293b;padding-bottom:0.3mm;">
              <span>Regd: ${escapeHtml(regdNo)}</span>
              <span>Pan: ${escapeHtml(panNumber)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:1.5mm;margin-top:0.3mm;">
              <img src="${escapeHtml(safeLogo)}" alt="Logo" style="width:8mm;height:8mm;border-radius:50%;background:#ffffff;object-fit:contain;flex-shrink:0;" />
              <div style="flex:1;min-width:0;text-align:center;">
                <div style="font-size:5.5pt;font-weight:900;color:#007a4d;line-height:1.52;padding-top:0.45mm;white-space:nowrap;overflow-x:clip;overflow-y:visible;">${escapeHtml(orgNameNp)}</div>
                <div style="font-size:3.9pt;font-weight:900;color:#d62828;text-transform:uppercase;letter-spacing:0.12pt;line-height:1.2;margin-top:-0.15mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(orgName)}</div>
                <div style="font-size:4.1pt;font-weight:700;color:#1e293b;line-height:1.35;margin-top:0.25mm;text-align:center;white-space:nowrap;overflow-x:clip;overflow-y:visible;">${escapeHtml(orgAddress)}</div>
              </div>
            </div>
          </div>

          <div style="background:${tpl.primary};color:#ffffff;padding:0.85mm 2mm;text-align:center;font-size:5.2pt;font-weight:900;letter-spacing:0.9pt;text-transform:uppercase;border-bottom:1.2pt solid ${tpl.accent};">
            ${escapeHtml(cardTitle)}
          </div>

          <div style="padding:1.8mm 2.8mm 1.4mm;flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;">
            <div style="width:17.5mm;height:20.5mm;border-radius:2mm;overflow:hidden;border:1.2pt solid ${tpl.primary};box-shadow:0 1pt 3pt rgba(15,23,42,0.12);background:#ffffff;">
              ${photoHtml}
            </div>
            <div style="font-size:5.3pt;font-weight:800;color:${tpl.primary};text-transform:uppercase;letter-spacing:0.5pt;margin-top:0.7mm;">${escapeHtml(card.role || 'Member')}</div>

            <div style="width:100%;margin-top:1.2mm;padding-top:1.1mm;border-top:0.5pt solid #e2e8f0;text-align:left;font-size:5.2pt;line-height:1.42;color:#0f172a;display:grid;grid-template-columns:12.5mm minmax(0,1fr);column-gap:1.2mm;row-gap:0.35mm;align-items:baseline;">
              <span style="font-size:5.8pt;font-weight:900;color:#0f172a;white-space:nowrap;">Name</span>
              <strong style="font-size:5.8pt;color:#0f172a;font-weight:900;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(upperName)}</strong>
              <span style="color:#334155;font-weight:600;white-space:nowrap;">Member ID</span>
              <span style="font-family:monospace;color:#0f172a;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(card.memberId || '-')}</span>
              <span style="color:#334155;font-weight:600;white-space:nowrap;">Center</span>
              <strong style="color:#0f172a;font-weight:800;white-space:nowrap;overflow-x:clip;overflow-y:visible;">${escapeHtml(card.centerName || '-')}</strong>
              <span style="color:#334155;font-weight:600;white-space:nowrap;">Group</span>
              <span style="color:#0f172a;font-weight:600;white-space:nowrap;overflow-x:clip;overflow-y:visible;">${escapeHtml(card.groupName || '-')}</span>
              ${showBranch ? `<span style="color:#334155;font-weight:600;white-space:nowrap;">Branch</span><span style="color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(card.branch || '-')}</span>` : ''}
              ${showMobile && card.mobile ? `<span style="color:#334155;font-weight:600;white-space:nowrap;">Mobile</span><span style="font-family:monospace;color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(card.mobile)}</span>` : ''}
              ${showCitizenship && card.citizenshipNo ? `<span style="color:#334155;font-weight:600;white-space:nowrap;">Cit. No</span><span style="font-family:monospace;color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(card.citizenshipNo)}</span>` : ''}
            </div>

            <div style="width:100%;margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:1.5mm;padding-top:0.8mm;">
              <div style="flex:1;min-width:0;">${barcodeHtml}</div>
              ${vertQrBoxHtml}
            </div>
          </div>

          <div style="background:${tpl.primary};color:#ffffff;padding:1mm 2.5mm;display:flex;justify-content:space-between;font-size:4.6pt;font-weight:700;">
            <span>ISS: ${escapeHtml(cardIssueDate)}</span>
            <span>VAL: ${escapeHtml(cardValidUntil)}</span>
          </div>
        </div>
      `;
    }

    // FRONT SIDE — HORIZONTAL (Official Letterhead Header + Full-Detail QR Code)
    return `
      <div class="id-card-shell" style="width:${wMm};height:${hMm};${cutStyle}background:${tpl.surface};border:0.6pt solid #cbd5e1;border-radius:3mm;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;position:relative;box-sizing:border-box;">
        <div style="background:#ffffff;padding:1.1mm 2.8mm 0.95mm;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:4.4pt;font-weight:700;color:#1e293b;padding-bottom:0.25mm;">
            <span>Regd No: ${escapeHtml(regdNo)}</span>
            <span>Pan: ${escapeHtml(panNumber)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:2.2mm;margin-top:0.15mm;">
            <img src="${escapeHtml(safeLogo)}" alt="Logo" style="width:9.2mm;height:9.2mm;border-radius:50%;background:#ffffff;object-fit:contain;flex-shrink:0;" />
            <div style="flex:1;min-width:0;text-align:center;">
              <div style="font-size:7.8pt;font-weight:900;color:#007a4d;letter-spacing:0.08pt;line-height:1.5;padding-top:0.55mm;white-space:nowrap;overflow-x:clip;overflow-y:visible;">${escapeHtml(orgNameNp)}</div>
              <div style="font-size:5.6pt;font-weight:900;color:#d62828;text-transform:uppercase;letter-spacing:0.22pt;line-height:1.2;margin-top:-0.25mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(orgName)}</div>
              <div style="font-size:4.9pt;font-weight:700;color:#1e293b;line-height:1.35;margin-top:0.2mm;white-space:nowrap;overflow-x:clip;overflow-y:visible;">${escapeHtml(orgAddress)}</div>
            </div>
          </div>
        </div>

        <div style="background:${tpl.isLightHeader ? '#f1f5f9' : tpl.primary};color:${tpl.isLightHeader ? tpl.primary : '#ffffff'};padding:0.75mm 2.8mm;display:flex;align-items:center;justify-content:center;text-align:center;border-top:${tpl.isLightHeader ? `0.8pt solid ${tpl.primary}` : 'none'};border-bottom:${tpl.isLightHeader ? '0.6pt solid #cbd5e1' : `1pt solid ${tpl.accent}`};">
          <span style="font-size:5.2pt;font-weight:900;letter-spacing:1.1pt;text-transform:uppercase;">${escapeHtml(cardTitle)}</span>
        </div>

        <div style="padding:1.5mm 2.8mm 1.1mm;flex:1;display:flex;gap:2.3mm;align-items:stretch;min-height:0;">
          <div style="width:17.2mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;flex-shrink:0;">
            <div style="width:17.2mm;height:20mm;border-radius:1.6mm;overflow:hidden;border:1pt solid ${tpl.primary};background:#f1f5f9;">
              ${photoHtml}
            </div>
            <div style="font-size:5pt;font-weight:800;color:${tpl.primary};text-transform:uppercase;letter-spacing:0.4pt;margin-top:0.4mm;text-align:center;">
              ${escapeHtml(card.role || 'Member')}
            </div>
          </div>

          <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1.5mm;min-width:0;">
              <div style="flex:1;min-width:0;font-size:5.2pt;line-height:1.38;color:#0f172a;display:grid;grid-template-columns:12.4mm minmax(0,1fr);column-gap:1.4mm;row-gap:0.35mm;align-items:baseline;">
                <span style="font-size:6.1pt;font-weight:900;color:#0f172a;white-space:nowrap;">Name</span>
                <strong style="font-size:6.1pt;color:#0f172a;font-weight:900;text-transform:uppercase;letter-spacing:0.12pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(upperName)}</strong>
                <span style="color:#334155;font-weight:600;white-space:nowrap;">Member ID</span>
                <span style="font-family:monospace;color:#0f172a;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(card.memberId || '-')}</span>
                <span style="color:#334155;font-weight:600;white-space:nowrap;">Center</span>
                <strong style="color:#0f172a;font-weight:800;white-space:nowrap;overflow-x:clip;overflow-y:visible;">${escapeHtml(card.centerName || '-')}</strong>
                <span style="color:#334155;font-weight:600;white-space:nowrap;">Group</span>
                <span style="color:#0f172a;font-weight:600;white-space:nowrap;overflow-x:clip;overflow-y:visible;">${escapeHtml(card.groupName || '-')}</span>
                ${showBranch ? `<span style="color:#334155;font-weight:600;white-space:nowrap;">Branch</span><span style="color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(card.branch || '-')}</span>` : ''}
                ${showMobile && card.mobile ? `<span style="color:#334155;font-weight:600;white-space:nowrap;">Mobile</span><span style="font-family:monospace;color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(card.mobile)}</span>` : ''}
                ${showCitizenship && card.citizenshipNo ? `<span style="color:#334155;font-weight:600;white-space:nowrap;">Cit. No</span><span style="font-family:monospace;color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(card.citizenshipNo)}</span>` : ''}
              </div>
              ${qrBoxHtml}
            </div>

            ${
              isSingleAllInOne
                ? `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:2mm;margin-top:0.5mm;">
                     <div style="flex:1;min-width:0;">${barcodeHtml}</div>
                     <div style="text-align:center;min-width:19mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;">
                       ${
                         signatoryPhotoUrl
                           ? `<img src="${escapeHtml(signatoryPhotoUrl)}" alt="Signature" style="height:4.8mm;max-width:19mm;object-fit:contain;display:block;margin-bottom:0.25mm;mix-blend-mode:multiply;" />`
                           : ''
                       }
                       <div style="width:100%;border-top:0.6pt solid #475569;padding-top:0.4mm;font-size:4.5pt;font-weight:800;color:#0f172a;">${escapeHtml(signatoryTitle)}</div>
                     </div>
                   </div>`
                : barcodeHtml
            }
          </div>
        </div>

        <div style="background:${tpl.isLightHeader ? '#f1f5f9' : tpl.primary};color:${tpl.isLightHeader ? '#334155' : '#ffffff'};padding:0.85mm 2.8mm;display:flex;justify-content:space-between;align-items:center;font-size:4.8pt;font-weight:700;border-top:${tpl.isLightHeader ? '0.5pt solid #cbd5e1' : 'none'};">
          <span>ISSUED: ${escapeHtml(cardIssueDate)}</span>
          ${orgWebsite ? `<span style="font-weight:700;">${escapeHtml(orgWebsite)}</span>` : ''}
          <span>VALID: ${escapeHtml(cardValidUntil)}</span>
        </div>
      </div>
    `;
  };

  const handlePrintCards = (cardsToPrint: CardData[]) => {
    if (cardsToPrint.length === 0) {
      onToast('Please select at least one member to print.');
      return;
    }

    const isVert = activeTemplate.orientation === 'vertical';
    const cardItemsHtml: string[] = [];

    cardsToPrint.forEach(card => {
      if (cardSide === 'front') {
        cardItemsHtml.push(`<div class="card-unit">${buildCardPrintHtml(card, 'front')}</div>`);
      } else if (cardSide === 'back') {
        cardItemsHtml.push(`<div class="card-unit">${buildCardPrintHtml(card, 'back')}</div>`);
      } else {
        cardItemsHtml.push(
          `<div class="card-pair">${buildCardPrintHtml(card, 'front')}${buildCardPrintHtml(card, 'back')}</div>`
        );
      }
    });

    const gridLayoutCss =
      cardSide === 'both'
        ? isVert
          ? 'display:flex;flex-wrap:wrap;gap:6mm;justify-content:flex-start;'
          : 'display:flex;flex-direction:column;gap:5mm;align-items:center;'
        : isVert
        ? 'display:grid;grid-template-columns:repeat(3, 54mm);gap:6mm;justify-content:center;'
        : 'display:grid;grid-template-columns:repeat(2, 85.6mm);gap:5mm;justify-content:center;';

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Member ID Cards - ${escapeHtml(orgName)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif; background: #ffffff; }
    .print-sheet { ${gridLayoutCss} }
    .card-unit { break-inside: avoid; page-break-inside: avoid; }
    .card-pair { display: flex; gap: 4mm; align-items: center; break-inside: avoid; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="print-sheet">
    ${cardItemsHtml.join('\n')}
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      onToast('Unable to initialize print frame.');
      return;
    }

    doc.open();
    doc.write(htmlDoc);
    doc.close();

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1200);
      }
    };

    setTimeout(triggerPrint, 350);
  };

  // Interactive Live Card Preview Component (React JSX matching exact Print layout)
  const renderCardPreview = (card: CardData, side: 'front' | 'back', compact = false) => {
    const tpl = activeTemplate;
    const { cardIssueDate, cardValidUntil } = resolveCardDates(card);
    const isVert = tpl.orientation === 'vertical';
    const initials = (card.name || 'M')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(s => s[0] || '')
      .join('')
      .toUpperCase() || 'M';

    const cardDimensionsClass = isVert
      ? compact
        ? 'w-[204px] h-[323px]'
        : 'w-[240px] h-[380px]'
      : compact
      ? 'w-[322px] h-[203px]'
      : 'w-[388px] h-[245px]';

    const isSingleAllInOne = Boolean(tpl.isSingleSideAllInOne);
    const bars = buildBarcodeBars(card.memberId || card.savingsAccountNo || 'MEMBER');
    const qrPayload = buildMemberQrPayload(card, {
      orgName,
      regdNo,
      panNumber,
      issueDate: cardIssueDate,
      validUntil: cardValidUntil,
      orgWebsite
    });
    const qrSvg = showQrCode ? buildQrSvgData(qrPayload) : null;

    if (side === 'back') {
      return (
        <div
          className={`${cardDimensionsClass} bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col justify-between select-none shrink-0`}
        >
          <div
            style={{
              backgroundColor: tpl.isLightHeader ? '#f8fafc' : tpl.primary,
              color: tpl.isLightHeader ? tpl.primary : '#ffffff',
              borderBottom: `2px solid ${tpl.isLightHeader ? tpl.primary : tpl.accent}`
            }}
            className="px-3.5 py-2 flex items-center justify-between"
          >
            <span className="text-[9px] font-black tracking-wider uppercase">Terms &amp; Verification</span>
            <span className="text-[9px] font-mono tabular-nums font-bold">ID: {card.memberId || '-'}</span>
          </div>

          <div className="p-3.5 flex-1 flex flex-col justify-between text-[9.5px] text-slate-600 leading-relaxed">
            <ul className="list-disc pl-3.5 space-y-1">
              <li>
                This card is official property of <strong className="text-slate-900">{orgName}</strong>.
              </li>
              <li>Present this ID during group meetings, savings deposits, and loan repayments.</li>
              <li>Non-transferable. If found, please return to the office address below.</li>
            </ul>

            <div className="grid grid-cols-2 gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px]">
              <div>
                <div className="text-[8px] uppercase text-slate-400 font-bold">Issued Date</div>
                <div className="font-mono tabular-nums font-bold text-slate-900">{cardIssueDate}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase text-slate-400 font-bold">Valid Until</div>
                <div className="font-mono tabular-nums font-bold text-slate-900">{cardValidUntil}</div>
              </div>
            </div>

            <div className="flex items-end justify-between gap-2 pt-1">
              <div className="text-[8.5px] leading-snug text-slate-500 min-w-0">
                <div className="font-bold text-slate-900 truncate">{orgName}</div>
                <div className="truncate">{orgAddress}</div>
                <div className="font-mono tabular-nums">Tel: {orgPhone}</div>
              </div>
              <div className="text-center shrink-0 min-w-[78px] flex flex-col items-center">
                {signatoryPhotoUrl && (
                  <img
                    src={signatoryPhotoUrl}
                    alt="Authorized Signature"
                    className="h-5 max-w-[76px] object-contain -mb-0.5 mix-blend-multiply"
                  />
                )}
                <div className="w-full border-t border-slate-500 pt-0.5 text-[8.5px] font-bold text-slate-800">
                  {signatoryTitle}
                </div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: tpl.primary }} className="h-1.5 w-full" />
        </div>
      );
    }

    // FRONT VERTICAL (with Official Letterhead Header)
    if (isVert) {
      return (
        <div
          style={{ backgroundColor: tpl.surface }}
          className={`${cardDimensionsClass} rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col justify-between select-none shrink-0`}
        >
          {/* Official Cooperative Letterhead Header */}
          <div className="bg-white px-2.5 pt-1.5 pb-1">
            <div className="flex items-center justify-between text-[7px] font-bold text-slate-700 pb-0.5">
              <span className="font-mono tabular-nums">Regd: {regdNo}</span>
              <span className="font-mono tabular-nums">Pan: {panNumber}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <img
                src={logoUrl}
                alt="Cooperative Logo"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full bg-white object-contain shrink-0"
              />
              <div className="flex-1 min-w-0 text-center">
                <div className="text-[9px] font-black text-[#007a4d] leading-[1.52] pt-[2px] whitespace-nowrap overflow-x-clip overflow-y-visible">
                  {orgNameNp}
                </div>
                <div className="text-[6.3px] font-black text-[#d62828] uppercase tracking-[0.02em] leading-tight truncate -mt-0.5">
                  {orgName}
                </div>
                <div className="text-[6.6px] font-bold text-slate-800 leading-[1.35] whitespace-nowrap overflow-x-clip overflow-y-visible mt-0.5">
                  {orgAddress}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: tpl.primary,
              borderBottom: `2px solid ${tpl.accent}`
            }}
            className="px-3 py-1 text-white text-center text-[8px] font-black tracking-[0.14em] uppercase"
          >
            {cardTitle}
          </div>

          <div className="px-3.5 py-2 flex-1 flex flex-col items-center text-center min-h-0">
            <div
              style={{ borderColor: tpl.primary }}
              className="w-[66px] h-[76px] rounded-lg overflow-hidden border-2 bg-slate-100 shadow-xs shrink-0"
            >
              {card.photoUrl ? (
                <img
                  src={card.photoUrl}
                  alt={card.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-lg text-slate-500">
                  {initials}
                </div>
              )}
            </div>

            <div style={{ color: tpl.primary }} className="text-[8px] font-black uppercase tracking-wider mt-1">
              {card.role || 'Member'}
            </div>

            <div className="w-full mt-1.5 pt-1.5 border-t border-slate-200 text-left text-[8.3px] leading-[1.4] text-slate-900 grid grid-cols-[50px_minmax(0,1fr)] gap-x-1.5 gap-y-0.5 items-baseline">
              <span className="text-[9.2px] font-black text-slate-900 whitespace-nowrap">Name</span>
              <strong className="text-[9.2px] text-slate-900 font-black uppercase truncate">
                {card.name || 'MEMBER NAME'}
              </strong>
              <span className="text-slate-700 font-semibold whitespace-nowrap">Member ID</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 truncate">{card.memberId || '-'}</span>
              <span className="text-slate-700 font-semibold whitespace-nowrap">Center</span>
              <strong className="text-slate-900 font-extrabold whitespace-nowrap overflow-x-clip overflow-y-visible">
                {card.centerName || '-'}
              </strong>
              <span className="text-slate-700 font-semibold whitespace-nowrap">Group</span>
              <span className="text-slate-900 font-semibold whitespace-nowrap overflow-x-clip overflow-y-visible">
                {card.groupName || '-'}
              </span>
              {showBranch && (
                <>
                  <span className="text-slate-700 font-semibold whitespace-nowrap">Branch</span>
                  <span className="text-slate-900 font-semibold truncate">{card.branch || '-'}</span>
                </>
              )}
              {showMobile && card.mobile && (
                <>
                  <span className="text-slate-700 font-semibold whitespace-nowrap">Mobile</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 truncate">{card.mobile}</span>
                </>
              )}
              {showCitizenship && card.citizenshipNo && (
                <>
                  <span className="text-slate-700 font-semibold whitespace-nowrap">Cit. No</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 truncate">
                    {card.citizenshipNo}
                  </span>
                </>
              )}
            </div>

            {(showBarcode || qrSvg) && (
              <div className="w-full mt-auto pt-1 flex items-end justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {showBarcode && (
                    <svg viewBox="0 0 176 18" preserveAspectRatio="none" className="w-full h-3 block">
                      {bars.map((b, i) => (
                        <rect key={i} x={b.x} y={0} width={b.w} height={18} fill="#0f172a" />
                      ))}
                    </svg>
                  )}
                </div>
                {qrSvg && (
                  <div
                    title="Scan QR for full member details"
                    className="w-10 h-10 p-[2px] rounded border border-slate-200 bg-white shrink-0 flex items-center justify-center"
                  >
                    <svg
                      viewBox={`0 0 ${qrSvg.size} ${qrSvg.size}`}
                      shapeRendering="crispEdges"
                      className="w-full h-full block"
                    >
                      <rect width={qrSvg.size} height={qrSvg.size} fill="#ffffff" />
                      <path d={qrSvg.path} fill="#0f172a" />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{ backgroundColor: tpl.primary }}
            className="px-3 py-1 text-white flex justify-between text-[7.2px] font-mono tabular-nums font-bold"
          >
            <span>ISS: {cardIssueDate}</span>
            <span>VAL: {cardValidUntil}</span>
          </div>
        </div>
      );
    }

    // FRONT HORIZONTAL (Official Letterhead Header with equal-width Nepali & English titles)
    return (
      <div
        style={{ backgroundColor: tpl.surface }}
        className={`${cardDimensionsClass} rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col justify-between select-none shrink-0`}
      >
        {/* Official Cooperative Letterhead Header */}
        <div className="bg-white px-3 pt-1 pb-1">
          <div className="flex items-center justify-between text-[7.5px] font-bold text-slate-700">
            <span className="font-mono tabular-nums">Regd No: {regdNo}</span>
            <span className="font-mono tabular-nums">Pan: {panNumber}</span>
          </div>
          <div className="flex items-center gap-2.5 mt-0.5">
            <img
              src={logoUrl}
              alt="Cooperative Logo"
              referrerPolicy="no-referrer"
              className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-white object-contain shrink-0`}
            />
            <div className="min-w-0 flex-1 text-center">
              <div
                className={`${
                  compact ? 'text-[10.8px]' : 'text-[13.2px]'
                } font-black text-[#007a4d] tracking-[0.01em] leading-[1.52] pt-[2px] whitespace-nowrap overflow-x-clip overflow-y-visible`}
              >
                {orgNameNp}
              </div>
              <div
                className={`${
                  compact ? 'text-[7.6px]' : 'text-[9.4px]'
                } font-black text-[#d62828] uppercase tracking-[0.025em] leading-tight truncate -mt-0.5`}
              >
                {orgName}
              </div>
              <div
                className={`${
                  compact ? 'text-[7.1px]' : 'text-[8.2px]'
                } font-bold text-slate-800 text-center leading-[1.35] whitespace-nowrap overflow-x-clip overflow-y-visible mt-0.5`}
              >
                {orgAddress}
              </div>
            </div>
          </div>
        </div>

        {/* Centered Template Title Strip */}
        <div
          style={{
            backgroundColor: tpl.isLightHeader ? '#f1f5f9' : tpl.primary,
            color: tpl.isLightHeader ? tpl.primary : '#ffffff',
            borderTop: tpl.isLightHeader ? `1.5px solid ${tpl.primary}` : 'none',
            borderBottom: tpl.isLightHeader ? '1px solid #cbd5e1' : `2px solid ${tpl.accent}`
          }}
          className="px-3 py-0.5 flex items-center justify-center text-center"
        >
          <span className="text-[8px] font-black tracking-[0.16em] uppercase">{cardTitle}</span>
        </div>

        {/* Card Body */}
        <div className="px-3 py-1.5 flex-1 flex gap-2.5 items-stretch min-h-0">
          <div className={`${compact ? 'w-[60px]' : 'w-[70px]'} flex flex-col items-center justify-between shrink-0`}>
            <div
              style={{ borderColor: tpl.primary }}
              className={`${
                compact ? 'w-[60px] h-[72px]' : 'w-[70px] h-[82px]'
              } rounded-lg overflow-hidden border-[1.5px] bg-slate-100`}
            >
              {card.photoUrl ? (
                <img
                  src={card.photoUrl}
                  alt={card.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-base text-slate-500">
                  {initials}
                </div>
              )}
            </div>
            <div
              style={{ color: tpl.primary }}
              className="text-[8px] font-black uppercase tracking-wider text-center truncate w-full mt-0.5"
            >
              {card.role || 'Member'}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1.5 min-w-0">
              <div
                className={`${
                  compact
                    ? 'text-[7.8px] grid-cols-[46px_minmax(0,1fr)] gap-x-1'
                    : 'text-[8.7px] grid-cols-[52px_minmax(0,1fr)] gap-x-1.5'
                } flex-1 min-w-0 grid gap-y-[1.5px] leading-[1.38] text-slate-900 items-baseline`}
              >
                <span
                  className={`${
                    compact ? 'text-[9.2px]' : 'text-[10.2px]'
                  } font-black text-slate-900 whitespace-nowrap`}
                >
                  Name
                </span>
                <strong
                  className={`${
                    compact ? 'text-[9.2px]' : 'text-[10.2px]'
                  } font-black uppercase tracking-wide text-slate-900 truncate`}
                >
                  {card.name || 'MEMBER NAME'}
                </strong>

                <span className="text-slate-700 font-semibold whitespace-nowrap">Member ID</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 truncate">
                  {card.memberId || '-'}
                </span>

                <span className="text-slate-700 font-semibold whitespace-nowrap">Center</span>
                <strong className="font-extrabold text-slate-900 whitespace-nowrap overflow-x-clip overflow-y-visible">
                  {card.centerName || '-'}
                </strong>

                <span className="text-slate-700 font-semibold whitespace-nowrap">Group</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap overflow-x-clip overflow-y-visible">
                  {card.groupName || '-'}
                </span>

                {showBranch && (
                  <>
                    <span className="text-slate-700 font-semibold whitespace-nowrap">Branch</span>
                    <span className="font-semibold text-slate-900 truncate">{card.branch || '-'}</span>
                  </>
                )}
                {showMobile && card.mobile && (
                  <>
                    <span className="text-slate-700 font-semibold whitespace-nowrap">Mobile</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 truncate">
                      {card.mobile}
                    </span>
                  </>
                )}
                {showCitizenship && card.citizenshipNo && (
                  <>
                    <span className="text-slate-700 font-semibold whitespace-nowrap">Cit. No</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 truncate">
                      {card.citizenshipNo}
                    </span>
                  </>
                )}
              </div>

              {qrSvg && (
                <div
                  title="Scan QR code to view full member details"
                  className={`${
                    compact ? 'w-[52px] h-[52px]' : 'w-[62px] h-[62px]'
                  } p-[2px] rounded-[5px] border border-slate-200 bg-white shrink-0 flex items-center justify-center`}
                >
                  <svg
                    viewBox={`0 0 ${qrSvg.size} ${qrSvg.size}`}
                    shapeRendering="crispEdges"
                    className="w-full h-full block"
                  >
                    <rect width={qrSvg.size} height={qrSvg.size} fill="#ffffff" />
                    <path d={qrSvg.path} fill="#0f172a" />
                  </svg>
                </div>
              )}
            </div>

            {isSingleAllInOne ? (
              <div className="flex items-end justify-between gap-2.5 pt-0.5">
                <div className="flex-1 min-w-0">
                  {showBarcode && (
                    <svg viewBox="0 0 176 18" preserveAspectRatio="none" className="w-full h-3 block">
                      {bars.map((b, i) => (
                        <rect key={i} x={b.x} y={0} width={b.w} height={18} fill="#0f172a" />
                      ))}
                    </svg>
                  )}
                </div>
                <div className="text-center shrink-0 min-w-[74px] flex flex-col items-center">
                  {signatoryPhotoUrl && (
                    <img
                      src={signatoryPhotoUrl}
                      alt="Authorized Signature"
                      className="h-5 max-w-[74px] object-contain -mb-0.5 mix-blend-multiply"
                    />
                  )}
                  <div className="w-full border-t border-slate-600 pt-0.5 text-[7.2px] font-extrabold text-slate-800 whitespace-nowrap">
                    {signatoryTitle}
                  </div>
                </div>
              </div>
            ) : (
              showBarcode && (
                <div className="pt-0.5">
                  <svg viewBox="0 0 176 18" preserveAspectRatio="none" className="w-full h-3 block">
                    {bars.map((b, i) => (
                      <rect key={i} x={b.x} y={0} width={b.w} height={18} fill="#0f172a" />
                    ))}
                  </svg>
                </div>
              )
            )}
          </div>
        </div>

        {/* Footer Bar (Website in center instead of Tel) */}
        <div
          style={{
            backgroundColor: tpl.isLightHeader ? '#f1f5f9' : tpl.primary,
            color: tpl.isLightHeader ? '#334155' : '#ffffff'
          }}
          className={`px-3 py-1 flex justify-between items-center text-[7.5px] font-mono tabular-nums font-bold ${
            tpl.isLightHeader ? 'border-t border-slate-200' : ''
          }`}
        >
          <span>ISSUED: {cardIssueDate}</span>
          {orgWebsite && <span className="truncate mx-1.5 font-sans font-bold tracking-tight">{orgWebsite}</span>}
          <span>VALID: {cardValidUntil}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Hidden inline photo input for bulk table */}
      <input
        ref={bulkInlinePhotoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleBulkInlinePhotoUpload}
      />

      {/* Hidden input for Authorized Signatory signature image */}
      <input
        ref={signatoryPhotoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleSignatoryPhotoUpload}
      />

      {/* Top Studio Control Header */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-blue-700 shrink-0" />
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight truncate">
              Member ID Card Generator
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Single vs Bulk Mode Segmented Control */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                mode === 'single'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Single Card</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                mode === 'bulk'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Bulk Cards</span>
              {selectedBulkIds.size > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-blue-700">({selectedBulkIds.size})</span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSettingsPanel(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
              showSettingsPanel
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Card Settings</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handlePrintCards(mode === 'single' ? [singleDraft] : selectedBulkCards)
            }
            disabled={mode === 'bulk' && selectedBulkCards.length === 0}
            className="px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>
              {mode === 'single'
                ? 'Print ID Card'
                : `Print Bulk (${selectedBulkCards.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Clickable Design Template Selector Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              <span>Select ID Card Format</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any design below to switch your Single or Bulk print format instantly.
            </p>
          </div>

          {/* Card Side + Color Override */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              {([
                { key: 'front', label: 'Front Only' },
                { key: 'back', label: 'Back Only' },
                { key: 'both', label: 'Front & Back' }
              ] as const).map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setCardSide(s.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    cardSide === s.key
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Theme:</span>
              {ACCENT_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  title={preset.label}
                  onClick={() => setCustomPrimaryColor(preset.value)}
                  className={`w-5 h-5 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${
                    customPrimaryColor === preset.value
                      ? 'ring-2 ring-offset-1 ring-blue-600 scale-110 border-slate-900'
                      : 'border-slate-300 hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: preset.value || '#ffffff'
                  }}
                >
                  {preset.value === '' && <RotateCcw className="w-2.5 h-2.5 text-slate-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 6 Clickable Design Thumbnails (including Official Single Card All-in-One) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {ID_CARD_TEMPLATES.map(tpl => {
            const isSelected = selectedTemplateId === tpl.id;
            const isVert = tpl.orientation === 'vertical';
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(tpl.id);
                  setCustomPrimaryColor('');
                  if (tpl.isSingleSideAllInOne) {
                    setCardSide('front');
                  }
                }}
                className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                {/* Mini Visual Wireframe Preview showing Official Letterhead Header */}
                <div className="w-full h-20 rounded-lg bg-slate-100/80 flex items-center justify-center p-2 overflow-hidden relative">
                  {tpl.isSingleSideAllInOne && (
                    <span className="absolute top-1 right-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-700 text-white">
                      1-Side
                    </span>
                  )}
                  {isVert ? (
                    <div className="w-11 h-16 rounded-md bg-white border border-slate-300 overflow-hidden shadow-2xs flex flex-col justify-between">
                      <div className="px-1 pt-1 pb-0.5 bg-white space-y-0.5">
                        <div className="h-0.5 bg-[#007a4d] rounded-full w-4/5 mx-auto" />
                        <div className="h-0.5 bg-[#d62828] rounded-full w-4/5 mx-auto" />
                      </div>
                      <div style={{ backgroundColor: tpl.primary }} className="h-1.5 w-full" />
                      <div className="w-4 h-4 rounded-sm bg-slate-200 mx-auto border border-slate-300" />
                      <div className="px-1.5 space-y-0.5 pb-0.5">
                        <div className="h-1 bg-slate-400 rounded-full w-4/5 mx-auto" />
                        <div className="h-1 bg-slate-200 rounded-full w-3/5 mx-auto" />
                      </div>
                      <div style={{ backgroundColor: tpl.primary }} className="h-1.5 w-full" />
                    </div>
                  ) : (
                    <div className="w-24 h-15 rounded-md bg-white border border-slate-300 overflow-hidden shadow-2xs flex flex-col justify-between">
                      <div className="px-1.5 pt-1 pb-0.5 bg-white flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600/80 shrink-0" />
                        <div className="flex-1 space-y-0.5">
                          <div className="h-0.5 bg-[#007a4d] rounded-full w-full" />
                          <div className="h-0.5 bg-[#d62828] rounded-full w-full" />
                        </div>
                      </div>
                      <div
                        style={{ backgroundColor: tpl.isLightHeader ? '#e2e8f0' : tpl.primary }}
                        className="h-1.5 w-full"
                      />
                      <div className="flex items-center gap-1.5 px-1.5 flex-1">
                        <div className="w-4.5 h-5.5 rounded-xs bg-slate-200 border border-slate-300 shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-1 bg-slate-400 rounded-full w-5/6" />
                          <div className="h-0.5 bg-slate-200 rounded-full w-4/6" />
                          {tpl.isSingleSideAllInOne && (
                            <div className="flex justify-between items-center pt-0.5">
                              <div className="h-1 bg-slate-700 w-5" />
                              <div className="h-0.5 bg-slate-500 w-4" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div
                        style={{ backgroundColor: tpl.isLightHeader ? '#e2e8f0' : tpl.primary }}
                        className="h-1.5 w-full"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 truncate">{tpl.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{tpl.subtitle}</div>
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Card Branding & Print Settings Panel */}
      {showSettingsPanel && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-extrabold text-slate-900">Card Branding, Dates &amp; Field Options</h3>
            <button
              type="button"
              onClick={() => setShowSettingsPanel(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Regd No.</label>
                <input
                  type="text"
                  value={regdNo}
                  onChange={e => setRegdNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">PAN No.</label>
                <input
                  type="text"
                  value={panNumber}
                  onChange={e => setPanNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Header Title (Green Line)</label>
              <input
                type="text"
                value={orgNameNp}
                onChange={e => setOrgNameNp(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Organization Name (Red Line)</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Office Address</label>
              <input
                type="text"
                value={orgAddress}
                onChange={e => setOrgAddress(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Website (Card Footer)</label>
              <input
                type="text"
                value={orgWebsite}
                onChange={e => setOrgWebsite(e.target.value)}
                placeholder="www.rataulisaccos.org.np"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Office Phone (Back Side)</label>
              <input
                type="text"
                value={orgPhone}
                onChange={e => setOrgPhone(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Card Strip Title</label>
              <input
                type="text"
                value={cardTitle}
                onChange={e => setCardTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-600">Issued Date</label>
                  {isManualDateOverride && (
                    <button
                      type="button"
                      onClick={() => setIsManualDateOverride(false)}
                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Auto (Saving Date)
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={issueDate}
                  onChange={e => {
                    const nextVal = e.target.value;
                    setIsManualDateOverride(true);
                    setIssueDate(nextVal);
                    setValidUntil(addYearsToDateString(nextVal, 6));
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Valid Until (+6 Yrs)</label>
                <input
                  type="text"
                  value={validUntil}
                  onChange={e => {
                    setIsManualDateOverride(true);
                    setValidUntil(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Signatory Label</label>
              <input
                type="text"
                value={signatoryTitle}
                onChange={e => setSignatoryTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Authorized Signatory Photo</label>
              <div className="flex items-center gap-2">
                {signatoryPhotoUrl && (
                  <div className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-1 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={signatoryPhotoUrl}
                      alt="Signature preview"
                      className="max-h-7 max-w-full object-contain"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => signatoryPhotoInputRef.current?.click()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{signatoryPhotoUrl ? 'Replace' : 'Upload Signature'}</span>
                </button>
                {signatoryPhotoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveSignatoryPhoto}
                    className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-700 font-semibold">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showMobile} onChange={e => setShowMobile(e.target.checked)} className="rounded" />
              <span>Show Mobile</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showCitizenship} onChange={e => setShowCitizenship(e.target.checked)} className="rounded" />
              <span>Show Citizenship No.</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showBranch} onChange={e => setShowBranch(e.target.checked)} className="rounded" />
              <span>Show Branch</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showBarcode} onChange={e => setShowBarcode(e.target.checked)} className="rounded" />
              <span>Show Barcode</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showQrCode} onChange={e => setShowQrCode(e.target.checked)} className="rounded" />
              <span>Show QR Code</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showCutMarks} onChange={e => setShowCutMarks(e.target.checked)} className="rounded" />
              <span>Show Print Cut Guides</span>
            </label>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 1: SINGLE CARD CREATOR */}
      {/* ============================================================== */}
      {mode === 'single' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Left Panel: Member Selection & Card Details */}
          <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-extrabold text-slate-900">Member Details</h3>
              <button
                type="button"
                onClick={handleResetManualSingle}
                className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
              >
                New Manual Entry
              </button>
            </div>

            {/* Quick Member Picker */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={singleCenterId}
                  onChange={e => {
                    setSingleCenterId(e.target.value);
                    setSingleGroupId('');
                  }}
                  aria-label="Filter Center"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="">All Centers</option>
                  {sortedCenters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={singleGroupId}
                  onChange={e => setSingleGroupId(e.target.value)}
                  aria-label="Filter Group"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="">All Groups</option>
                  {getGroupsByCenter(singleCenterId).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search member by name or ID..."
                  value={singleSearch}
                  onChange={e => setSingleSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <select
                value={selectedSingleMemberId}
                onChange={e => {
                  const found = members.find(m => m.id === e.target.value);
                  if (found) handleSelectSingleMember(found);
                }}
                aria-label="Choose Member"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Select Member ({singlePickerMembers.length}) --</option>
                {singlePickerMembers.slice(0, 300).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.memberId} — {m.name} ({m.samuhName || 'No Group'})
                  </option>
                ))}
              </select>
            </div>

            {/* Editable Fields for Live Preview */}
            <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-14 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                  {singleDraft.photoUrl ? (
                    <img
                      src={singleDraft.photoUrl}
                      alt="Member Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <input
                    ref={singlePhotoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleSinglePhotoUpload}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => singlePhotoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{singleDraft.photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {singleDraft.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setSingleDraft(prev => ({ ...prev, photoUrl: '' }))}
                        className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    JPEG, PNG or WEBP · Auto-saved when linked to a member
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={singleDraft.name}
                    onChange={e => setSingleDraft(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter member name"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Member ID</label>
                  <input
                    type="text"
                    value={singleDraft.memberId}
                    onChange={e => setSingleDraft(prev => ({ ...prev, memberId: e.target.value }))}
                    placeholder="e.g. 660010001305"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Role</label>
                  <select
                    value={singleDraft.role}
                    onChange={e => setSingleDraft(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-hidden"
                  >
                    <option value="Member">Member</option>
                    <option value="Leader">Leader</option>
                    <option value="Secretary">Secretary</option>
                    <option value="Treasurer">Treasurer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Center</label>
                  <input
                    type="text"
                    value={singleDraft.centerName}
                    onChange={e => setSingleDraft(prev => ({ ...prev, centerName: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Group</label>
                  <input
                    type="text"
                    value={singleDraft.groupName}
                    onChange={e => setSingleDraft(prev => ({ ...prev, groupName: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={singleDraft.mobile}
                    onChange={e => setSingleDraft(prev => ({ ...prev, mobile: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Citizenship No.</label>
                  <input
                    type="text"
                    value={singleDraft.citizenshipNo}
                    onChange={e => setSingleDraft(prev => ({ ...prev, citizenshipNo: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Live High-Resolution Single Card Stage */}
          <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">Live Card Preview</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Format: {activeTemplate.name} · {activeTemplate.orientation === 'vertical' ? '54 × 85.6 mm' : '85.6 × 54 mm'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePrintCards([singleDraft])}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print This Card</span>
              </button>
            </div>

            <div className="rounded-xl bg-slate-100/80 border border-slate-200/80 p-6 min-h-[340px] flex flex-wrap items-center justify-center gap-6">
              {(cardSide === 'front' || cardSide === 'both') && (
                <div className="space-y-2 flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-500">Front Side</span>
                  {renderCardPreview(singleDraft, 'front', false)}
                </div>
              )}
              {(cardSide === 'back' || cardSide === 'both') && (
                <div className="space-y-2 flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-500">Back Side</span>
                  {renderCardPreview(singleDraft, 'back', false)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 2: BULK ID CARD CREATOR */}
      {/* ============================================================== */}
      {mode === 'bulk' && (
        <div className="space-y-4">
          {/* Bulk Member Filter & Selection Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <select
                  value={bulkCenterId}
                  onChange={e => {
                    setBulkCenterId(e.target.value);
                    setBulkGroupId('');
                  }}
                  aria-label="Bulk Filter Center"
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden min-w-[165px]"
                >
                  <option value="">All Centers</option>
                  {sortedCenters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={bulkGroupId}
                  onChange={e => setBulkGroupId(e.target.value)}
                  aria-label="Bulk Filter Group"
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden min-w-[165px]"
                >
                  <option value="">All Groups</option>
                  {getGroupsByCenter(bulkCenterId).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>

                <select
                  value={bulkStatusFilter}
                  onChange={e => setBulkStatusFilter(e.target.value as 'ACTIVE' | 'INACTIVE' | 'ALL')}
                  aria-label="Bulk Filter Status"
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="ACTIVE">Active Members</option>
                  <option value="INACTIVE">Inactive Members</option>
                  <option value="ALL">All Status</option>
                </select>

                <div className="relative flex-1 min-w-[180px] max-w-[260px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search member or ID..."
                    value={bulkSearch}
                    onChange={e => setBulkSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(bulkCenterId || bulkGroupId) && bulkFilteredMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      handlePrintCards(
                        bulkFilteredMembers.map(m => ({
                          id: m.id,
                          memberId: m.memberId || '',
                          name: m.name || '',
                          role: m.role || 'Member',
                          centerName: m.centerName || '',
                          groupName: m.samuhName || '',
                          branch: m.branch || '',
                          mobile: m.mobile || '',
                          citizenshipNo: m.citizenshipNo || '',
                          savingsAccountNo: m.savingsAccountNo || '',
                          photoUrl: m.photoUrl || ''
                        }))
                      )
                    }
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>
                      {bulkGroupId
                        ? `Print Group (${bulkFilteredMembers.length})`
                        : `Print Center (${bulkFilteredMembers.length})`}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSelectAllFilteredBulk}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  Select All ({bulkFilteredMembers.length})
                </button>
                <button
                  type="button"
                  onClick={handleSelectWithPhotoBulk}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  With Photo Only
                </button>
                {selectedBulkIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBulkSelection}
                    className="px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    Clear ({selectedBulkIds.size})
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr className="text-[11px] font-bold text-slate-500">
                    <th className="py-2 px-3 w-10 text-center">Pick</th>
                    <th className="py-2 px-3 w-14">Photo</th>
                    <th className="py-2 px-3">Member ID</th>
                    <th className="py-2 px-3">Full Name</th>
                    <th className="py-2 px-3">Center</th>
                    <th className="py-2 px-3">Group</th>
                    <th className="py-2 px-3">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {bulkFilteredMembers.map(member => {
                    const isChecked = selectedBulkIds.has(member.id);
                    return (
                      <tr
                        key={member.id}
                        className={`transition-colors ${isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleBulkMember(member.id)}
                            aria-label={`Select ${member.name}`}
                            className="text-slate-500 hover:text-blue-700 cursor-pointer"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            {member.photoUrl ? (
                              <img
                                src={member.photoUrl}
                                alt={member.name}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-md object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                {member.name.charAt(0)}
                              </div>
                            )}
                            <button
                              type="button"
                              title="Upload Member Photo"
                              onClick={() => {
                                bulkPhotoTargetIdRef.current = member.id;
                                bulkInlinePhotoInputRef.current?.click();
                              }}
                              className="p-1 text-slate-400 hover:text-blue-700 rounded cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums font-bold text-blue-700">
                          {member.memberId}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">{member.name}</td>
                        <td className="py-2 px-3 text-slate-600">{member.centerName || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{member.samuhName || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{member.role}</td>
                      </tr>
                    );
                  })}

                  {bulkFilteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No members match your current Center, Group, or search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bulk Live Preview Sheet */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  <span>Bulk Print Sheet Preview ({selectedBulkCards.length} Selected)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Format: {activeTemplate.name} · Prints cleanly on A4 paper with CR80 dimensions.
                </p>
              </div>
              <button
                type="button"
                disabled={selectedBulkCards.length === 0}
                onClick={() => handlePrintCards(selectedBulkCards)}
                className="px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print All Selected ({selectedBulkCards.length})</span>
              </button>
            </div>

            {selectedBulkCards.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <Users className="w-7 h-7 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-700">No members selected for bulk ID generation</div>
                <p className="text-[11px] text-slate-500">
                  Filter by Center or Group above and check members (or click Select All) to preview and print their ID cards.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/80 flex flex-wrap justify-center gap-4 max-h-[540px] overflow-y-auto">
                {selectedBulkCards.map(card => (
                  <div key={card.id} className="flex flex-wrap items-center justify-center gap-2.5">
                    {(cardSide === 'front' || cardSide === 'both') && renderCardPreview(card, 'front', true)}
                    {(cardSide === 'back' || cardSide === 'both') && renderCardPreview(card, 'back', true)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
