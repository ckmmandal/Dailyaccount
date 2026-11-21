import React, { useEffect, useMemo, useState } from 'react';
import NepaliDate from 'nepali-date-converter';
import {
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Printer,
  Save,
  SaveAll,
  Trash2,
  X
} from 'lucide-react';
import {
  MFCenter,
  MFDepositSheet,
  MFDepositSheetRow,
  MFMember,
  MFSamuhGroup,
  buildBsDateFromParts,
  microFinanceService
} from '../../services/microFinanceService';
import { Branch } from '../../types';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../../utils/dayEndLock';

interface DepositSheetModuleProps {
  centers: MFCenter[];
  groups: MFSamuhGroup[];
  members: MFMember[];
  branches: Branch[];
  hrEmployees?: Array<{ id: string; fullName: string; employeeCode?: string; designation?: string }>;
  logoUrl?: string;
  organizationNameNp?: string;
  organizationName?: string;
  branchId?: string;
  onToast?: (msg: string) => void;
}

interface RowEntryDraft {
  savingInput: string;
  loanInput: string;
  saved: boolean;
  dirty: boolean;
  savedAt?: string;
}

const NEPALI_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const NEPALI_MONTH_NP: Record<string, string> = {
  Baisakh: 'बैशाख',
  Jestha: 'जेष्ठ',
  Ashadh: 'असार',
  Shrawan: 'श्रावण',
  Bhadra: 'भाद्र',
  Ashwin: 'आश्विन',
  Kartik: 'कार्तिक',
  Mangsir: 'मंसिर',
  Poush: 'पौष',
  Magh: 'माघ',
  Falgun: 'फाल्गुन',
  Chaitra: 'चैत्र'
};

const toNepaliDigits = (num: number | string): string => {
  const nep = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).replace(/[0-9]/g, d => nep[parseInt(d, 10)]);
};

const fromNepaliDigits = (str: string): string => {
  const nep = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(str || '').replace(/[०-९]/g, d => String(nep.indexOf(d)));
};

const extractMeetingDayNumber = (val?: string): number | null => {
  if (!val) return null;
  const normalized = fromNepaliDigits(val);
  const match = normalized.match(/\d+/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  return isNaN(num) ? null : num;
};

const normalizeText = (val?: string): string =>
  String(val || '').replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeMemberIdKey = (val?: string): string =>
  fromNepaliDigits(String(val || ''))
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase()
    .replace(/^0+(?=\d)/, '');

const parseAmount = (raw: string): number => {
  const cleaned = fromNepaliDigits(String(raw || '')).replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) || n < 0 ? 0 : n;
};

const formatAmount = (val: number): string => {
  const n = Number(val) || 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const escapeHtml = (val: string): string =>
  String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const DepositSheetModule: React.FC<DepositSheetModuleProps> = ({
  centers,
  groups,
  members,
  branches,
  hrEmployees = [],
  logoUrl = '/system_logo.png',
  organizationNameNp = 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड',
  organizationName = 'RATAULI SAVING AND CREDIT COOPERATIVE LTD',
  branchId,
  onToast = () => {}
}) => {
  const isDayEnded = useDayEndLock(branchId);

  const currentBsDate = useMemo(() => {
    try {
      const nep = new NepaliDate();
      return {
        year: nep.getYear().toString(),
        month: NEPALI_MONTHS_EN[nep.getMonth()] || 'Mangsir',
        day: nep.getDate().toString()
      };
    } catch {
      return { year: '2083', month: 'Mangsir', day: '1' };
    }
  }, []);

  // Top filter states (YEAR, MONTH, DAY, CENTER, GROUP, EMPLOYEE)
  const [filterYear, setFilterYear] = useState<string>(currentBsDate.year);
  const [filterMonth, setFilterMonth] = useState<string>(currentBsDate.month);
  const [filterDay, setFilterDay] = useState<string>(currentBsDate.day);
  const [filterCenterId, setFilterCenterId] = useState<string>('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [filterEmployeeName, setFilterEmployeeName] = useState<string>('');

  // Saved Deposit Sheets history
  const [savedSheets, setSavedSheets] = useState<MFDepositSheet[]>(() =>
    microFinanceService.getDepositSheets()
  );
  const [isSheetDetailOpen, setIsSheetDetailOpen] = useState<boolean>(false);
  const [recordFilterYear, setRecordFilterYear] = useState<string>('ALL');
  const [recordFilterMonth, setRecordFilterMonth] = useState<string>('ALL');
  const [pendingDeleteSheet, setPendingDeleteSheet] = useState<MFDepositSheet | null>(null);

  // Per-member editable entry drafts keyed by memberId
  const [rowEntries, setRowEntries] = useState<Record<string, RowEntryDraft>>({});

  // Centers filtered strictly by selected DAY (when DAY !== 'ALL')
  const filteredCenters = useMemo(() => {
    if (filterDay === 'ALL') return centers;
    const dayNum = parseInt(fromNepaliDigits(filterDay), 10);
    if (isNaN(dayNum)) return centers;
    return centers.filter(c => {
      const centerDay = extractMeetingDayNumber(c.meetingDay) ?? extractMeetingDayNumber(c.name);
      return centerDay === dayNum;
    });
  }, [centers, filterDay]);

  // Sync selected center when Day or centers list changes
  useEffect(() => {
    if (filteredCenters.length > 0) {
      if (!filterCenterId || !filteredCenters.some(c => c.id === filterCenterId)) {
        setFilterCenterId(filteredCenters[0].id);
      }
    } else if (filterCenterId !== '') {
      setFilterCenterId('');
    }
  }, [filteredCenters, filterCenterId]);

  // Groups strictly inside selected center
  const filteredGroups = useMemo(() => {
    if (!filterCenterId) return [];
    const selectedCenter =
      filteredCenters.find(c => c.id === filterCenterId) ||
      centers.find(c => c.id === filterCenterId);
    const centerNameNorm = normalizeText(selectedCenter?.name);
    return groups.filter(
      g =>
        g.centerId === filterCenterId ||
        (centerNameNorm !== '' && normalizeText(g.centerName) === centerNameNorm)
    );
  }, [groups, filterCenterId, filteredCenters, centers]);

  // Sync selected group when center changes
  useEffect(() => {
    if (filteredGroups.length > 0) {
      if (!filterGroupId || !filteredGroups.some(g => g.id === filterGroupId)) {
        setFilterGroupId(filteredGroups[0].id);
      }
    } else if (filterGroupId !== '') {
      setFilterGroupId('');
    }
  }, [filteredGroups, filterGroupId]);

  // Default employee selection
  useEffect(() => {
    if (!filterEmployeeName) {
      if (hrEmployees.length > 0) {
        setFilterEmployeeName(hrEmployees[0].fullName);
      } else {
        setFilterEmployeeName('Field Officer');
      }
    }
  }, [hrEmployees, filterEmployeeName]);

  const activeCenter = useMemo(
    () => (filterCenterId ? filteredCenters.find(c => c.id === filterCenterId) : undefined),
    [filteredCenters, filterCenterId]
  );

  const activeGroup = useMemo(
    () => (filterGroupId ? filteredGroups.find(g => g.id === filterGroupId) : undefined),
    [filteredGroups, filterGroupId]
  );

  const activeBranch = useMemo(() => {
    const bName = activeCenter?.branch;
    return branches.find(b => b.name === bName) || branches[0];
  }, [branches, activeCenter]);

  const effectiveDay = filterDay === 'ALL' ? currentBsDate.day : filterDay;
  const targetDateBs = useMemo(
    () => buildBsDateFromParts(filterYear, filterMonth, effectiveDay),
    [filterYear, filterMonth, effectiveDay]
  );

  const displayNepaliDate = useMemo(() => {
    const nepMonth = NEPALI_MONTH_NP[filterMonth] || filterMonth;
    return `${toNepaliDigits(filterYear)} ${nepMonth} ${toNepaliDigits(effectiveDay)}`;
  }, [filterYear, filterMonth, effectiveDay]);

  // Members of selected group sorted A-Z
  const groupMembers = useMemo(() => {
    if (!activeGroup) return [];
    const groupNameNorm = normalizeText(activeGroup.name);
    const centerNameNorm = normalizeText(activeCenter?.name || activeGroup.centerName);
    const matched = members.filter(m => {
      if (m.samuhId && activeGroup.id && m.samuhId === activeGroup.id) return true;
      if (groupNameNorm && normalizeText(m.samuhName) === groupNameNorm) {
        if (centerNameNorm && m.centerName && normalizeText(m.centerName) !== centerNameNorm) {
          return false;
        }
        return true;
      }
      return false;
    });
    return [...matched].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );
  }, [members, activeGroup, activeCenter]);

  // Existing saved sheet for current Group + BS Date (if any)
  const existingSheetForSelection = useMemo(() => {
    if (!activeGroup) return undefined;
    return savedSheets.find(s => s.groupId === activeGroup.id && s.dateBs === targetDateBs);
  }, [savedSheets, activeGroup, targetDateBs]);

  // Hydrate editable row entries whenever Group, Date, or saved sheet changes
  useEffect(() => {
    const nextDrafts: Record<string, RowEntryDraft> = {};
    const savedRowByKey = new Map<string, MFDepositSheetRow>();

    if (existingSheetForSelection) {
      existingSheetForSelection.rows.forEach(r => {
        const key = normalizeMemberIdKey(r.memberId);
        if (key) savedRowByKey.set(key, r);
      });
    }

    groupMembers.forEach(mem => {
      const key = normalizeMemberIdKey(mem.memberId);
      const savedRow = key ? savedRowByKey.get(key) : undefined;
      if (savedRow) {
        nextDrafts[mem.memberId] = {
          savingInput: savedRow.savingAmount > 0 ? String(savedRow.savingAmount) : '',
          loanInput: savedRow.loanAmount > 0 ? String(savedRow.loanAmount) : '',
          saved: true,
          dirty: false,
          savedAt: savedRow.savedAt
        };
      } else {
        nextDrafts[mem.memberId] = {
          savingInput: '',
          loanInput: '',
          saved: false,
          dirty: false
        };
      }
    });

    setRowEntries(nextDrafts);
  }, [groupMembers, existingSheetForSelection]);

  // Live totals
  const sheetTotals = useMemo(() => {
    let totalSaving = 0;
    let totalLoan = 0;
    let savedRowsCount = 0;
    let unsavedDirtyCount = 0;

    groupMembers.forEach(mem => {
      const entry = rowEntries[mem.memberId];
      const sav = parseAmount(entry?.savingInput || '');
      const ln = parseAmount(entry?.loanInput || '');
      totalSaving += sav;
      totalLoan += ln;
      if (entry?.saved && !entry?.dirty) savedRowsCount += 1;
      if (entry?.dirty) unsavedDirtyCount += 1;
    });

    return {
      totalSaving,
      totalLoan,
      grandTotal: totalSaving + totalLoan,
      savedRowsCount,
      unsavedDirtyCount
    };
  }, [groupMembers, rowEntries]);

  const handleFieldChange = (memberId: string, field: 'savingInput' | 'loanInput', value: string) => {
    // Allow digits and at most one decimal point
    const sanitized = fromNepaliDigits(value).replace(/[^0-9.]/g, '');
    setRowEntries(prev => {
      const curr = prev[memberId] || { savingInput: '', loanInput: '', saved: false, dirty: false };
      return {
        ...prev,
        [memberId]: {
          ...curr,
          [field]: sanitized,
          dirty: true
        }
      };
    });
  };

  // Persist a single member row into the Deposit Sheet record
  const handleSaveSingleRow = (mem: MFMember) => {
    if (isDayEndedForBranch(branchId)) {
      onToast(getDayEndedBlockMessage());
      return;
    }
    if (!activeCenter || !activeGroup) {
      onToast('कृपया पहिले मान्य केन्द्र र समूह चयन गर्नुहोस् ।');
      return;
    }
    if (isBackDateBlockedForEntry(targetDateBs)) {
      onToast(getBackDateBlockedMessage(targetDateBs));
      return;
    }

    const entry = rowEntries[mem.memberId] || { savingInput: '', loanInput: '', saved: false, dirty: false };
    const savingAmount = parseAmount(entry.savingInput);
    const loanAmount = parseAmount(entry.loanInput);
    const totalAmount = savingAmount + loanAmount;
    const nowIso = new Date().toISOString();

    const prevRows = existingSheetForSelection?.rows || [];
    const targetKey = normalizeMemberIdKey(mem.memberId);
    const updatedRow: MFDepositSheetRow = {
      memberId: mem.memberId,
      name: mem.name,
      savingAmount,
      loanAmount,
      totalAmount,
      savedAt: nowIso
    };

    const rowMap = new Map<string, MFDepositSheetRow>();
    prevRows.forEach(r => {
      const k = normalizeMemberIdKey(r.memberId);
      if (k) rowMap.set(k, r);
    });
    if (targetKey) rowMap.set(targetKey, updatedRow);

    // Order rows according to current A-Z groupMembers list
    const orderedRows: MFDepositSheetRow[] = groupMembers
      .map(m => {
        const k = normalizeMemberIdKey(m.memberId);
        return k ? rowMap.get(k) : undefined;
      })
      .filter((r): r is MFDepositSheetRow => Boolean(r));

    const totalSaving = orderedRows.reduce((acc, r) => acc + (Number(r.savingAmount) || 0), 0);
    const totalLoan = orderedRows.reduce((acc, r) => acc + (Number(r.loanAmount) || 0), 0);

    const { allSheets } = microFinanceService.upsertDepositSheet({
      id: existingSheetForSelection?.id,
      sheetNo:
        existingSheetForSelection?.sheetNo ||
        `DS-${filterYear}-${Date.now().toString().slice(-4)}`,
      year: filterYear,
      month: filterMonth,
      day: effectiveDay,
      dateBs: targetDateBs,
      dateDisplay: displayNepaliDate,
      centerId: activeCenter.id,
      centerName: activeCenter.name,
      groupId: activeGroup.id,
      groupName: activeGroup.name,
      location: activeGroup.place || activeCenter.location || '',
      branchName: activeBranch?.name || activeCenter.branch || 'Ratauli Head Office',
      employeeName: filterEmployeeName || 'Field Officer',
      rows: orderedRows,
      totalSaving,
      totalLoan,
      grandTotal: totalSaving + totalLoan
    });

    setSavedSheets(allSheets);
    setRowEntries(prev => ({
      ...prev,
      [mem.memberId]: {
        savingInput: savingAmount > 0 ? String(savingAmount) : '',
        loanInput: loanAmount > 0 ? String(loanAmount) : '',
        saved: true,
        dirty: false,
        savedAt: nowIso
      }
    }));
    onToast(`${mem.name} को जम्मा रु. ${formatAmount(totalAmount)} सुरक्षित गरियो ।`);
  };

  // Persist ALL member rows at once
  const handleSaveAllRows = () => {
    if (isDayEndedForBranch(branchId)) {
      onToast(getDayEndedBlockMessage());
      return;
    }
    if (!activeCenter || !activeGroup) {
      onToast('कृपया पहिले मान्य केन्द्र र समूह चयन गर्नुहोस् ।');
      return;
    }
    if (groupMembers.length === 0) {
      onToast('यस समूहमा कुनै सदस्य फेला परेन ।');
      return;
    }
    if (isBackDateBlockedForEntry(targetDateBs)) {
      onToast(getBackDateBlockedMessage(targetDateBs));
      return;
    }

    const nowIso = new Date().toISOString();
    const allRows: MFDepositSheetRow[] = groupMembers.map(mem => {
      const entry = rowEntries[mem.memberId];
      const savingAmount = parseAmount(entry?.savingInput || '');
      const loanAmount = parseAmount(entry?.loanInput || '');
      return {
        memberId: mem.memberId,
        name: mem.name,
        savingAmount,
        loanAmount,
        totalAmount: savingAmount + loanAmount,
        savedAt: nowIso
      };
    });

    const totalSaving = allRows.reduce((acc, r) => acc + r.savingAmount, 0);
    const totalLoan = allRows.reduce((acc, r) => acc + r.loanAmount, 0);

    const { savedSheet, allSheets } = microFinanceService.upsertDepositSheet({
      id: existingSheetForSelection?.id,
      sheetNo:
        existingSheetForSelection?.sheetNo ||
        `DS-${filterYear}-${Date.now().toString().slice(-4)}`,
      year: filterYear,
      month: filterMonth,
      day: effectiveDay,
      dateBs: targetDateBs,
      dateDisplay: displayNepaliDate,
      centerId: activeCenter.id,
      centerName: activeCenter.name,
      groupId: activeGroup.id,
      groupName: activeGroup.name,
      location: activeGroup.place || activeCenter.location || '',
      branchName: activeBranch?.name || activeCenter.branch || 'Ratauli Head Office',
      employeeName: filterEmployeeName || 'Field Officer',
      rows: allRows,
      totalSaving,
      totalLoan,
      grandTotal: totalSaving + totalLoan
    });

    setSavedSheets(allSheets);
    const nextEntries: Record<string, RowEntryDraft> = {};
    allRows.forEach(r => {
      nextEntries[r.memberId] = {
        savingInput: r.savingAmount > 0 ? String(r.savingAmount) : '',
        loanInput: r.loanAmount > 0 ? String(r.loanAmount) : '',
        saved: true,
        dirty: false,
        savedAt: nowIso
      };
    });
    setRowEntries(nextEntries);
    onToast(
      `Deposit Sheet (${savedSheet.sheetNo}) को सबै ${allRows.length} सदस्यको विवरण सुरक्षित गरियो (कुल जम्मा: रु. ${formatAmount(totalSaving + totalLoan)}) ।`
    );
  };

  // Print clean A4 Deposit Sheet (uses offscreen iframe, never window.open; ONLY Employee signature in footer)
  const handlePrintSheet = (sheetOverride?: MFDepositSheet) => {
    const printRows: Array<{
      memberId: string;
      name: string;
      savingAmount: number;
      loanAmount: number;
      totalAmount: number;
    }> = sheetOverride
      ? sheetOverride.rows
      : groupMembers.map(mem => {
          const entry = rowEntries[mem.memberId];
          const sav = parseAmount(entry?.savingInput || '');
          const ln = parseAmount(entry?.loanInput || '');
          return {
            memberId: mem.memberId,
            name: mem.name,
            savingAmount: sav,
            loanAmount: ln,
            totalAmount: sav + ln
          };
        });

    if (printRows.length === 0) {
      onToast('प्रिन्ट गर्नको लागि कुनै सदस्य विवरण उपलब्ध छैन ।');
      return;
    }

    const totalSav = printRows.reduce((s, r) => s + (Number(r.savingAmount) || 0), 0);
    const totalLn = printRows.reduce((s, r) => s + (Number(r.loanAmount) || 0), 0);
    const grandTot = totalSav + totalLn;

    const grpName = sheetOverride?.groupName || activeGroup?.name || '-';
    const ctrName = sheetOverride?.centerName || activeCenter?.name || '-';
    const dtDisplay = sheetOverride?.dateDisplay || displayNepaliDate;
    const locDisplay = sheetOverride?.location || activeGroup?.place || activeCenter?.location || '-';
    const brName = sheetOverride?.branchName || activeBranch?.name || activeCenter?.branch || 'Ratauli Head Office';
    const empName = sheetOverride?.employeeName || filterEmployeeName || 'कर्मचारी';

    const safeLogo = logoUrl.startsWith('http') || logoUrl.startsWith('data:')
      ? logoUrl
      : `${window.location.origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;

    const rowsHtml = printRows
      .map(
        (r, idx) => `
          <tr>
            <td class="tc bold">${escapeHtml(toNepaliDigits(idx + 1))}</td>
            <td class="tl bold">${escapeHtml(r.name)}</td>
            <td class="tc mono bold">${escapeHtml(r.memberId)}</td>
            <td class="tr mono">${r.savingAmount > 0 ? escapeHtml(formatAmount(r.savingAmount)) : '-'}</td>
            <td class="tr mono">${r.loanAmount > 0 ? escapeHtml(formatAmount(r.loanAmount)) : '-'}</td>
            <td class="tr mono bold">${r.totalAmount > 0 ? escapeHtml(formatAmount(r.totalAmount)) : '-'}</td>
          </tr>
        `
      )
      .join('');

    const htmlDoc = `<!DOCTYPE html>
<html lang="ne">
<head>
  <meta charset="UTF-8" />
  <title>Deposit Sheet - ${escapeHtml(grpName)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #fff; font-size: 11px; }
    .header { display: flex; align-items: center; justify-content: center; gap: 14px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 8px; position: relative; }
    .header img { width: 52px; height: 52px; object-fit: contain; position: absolute; left: 0; top: 0; }
    .header-text { text-align: center; }
    .org-np { font-size: 18px; font-weight: 900; color: #0f172a; line-height: 1.2; }
    .org-en { font-size: 11px; font-weight: 800; letter-spacing: 0.6px; color: #334155; margin-top: 2px; }
    .branch { font-size: 10.5px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .sheet-title { display: inline-block; margin-top: 4px; padding: 2px 12px; border: 1px solid #0f172a; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
    .meta { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
    .meta-left div { line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid #0f172a; font-size: 11px; }
    th, td { border: 1px solid #0f172a; padding: 4px 6px; }
    thead th { background: #f1f5f9; font-weight: 900; font-size: 10.5px; }
    tfoot td { background: #f1f5f9; font-weight: 900; border-top: 1.5px solid #0f172a; }
    .tc { text-align: center; }
    .tl { text-align: left; }
    .tr { text-align: right; }
    .bold { font-weight: 700; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
    .footer-sign { margin-top: 14mm; display: flex; justify-content: flex-end; padding-right: 10mm; }
    .sign-box { text-align: center; width: 58mm; }
    .sign-line { border-bottom: 1.5px dotted #0f172a; width: 100%; margin-bottom: 4px; }
    .sign-name { font-size: 10.5px; font-weight: 700; font-family: ui-monospace, monospace; }
    .sign-role { font-size: 12px; font-weight: 900; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${escapeHtml(safeLogo)}" alt="Logo" />
    <div class="header-text">
      <div class="org-np">${escapeHtml(organizationNameNp)}</div>
      <div class="org-en">${escapeHtml(organizationName)}</div>
      <div class="branch">${escapeHtml(brName)}</div>
      <div class="sheet-title">DEPOSIT SHEET</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-left">
      <div>समूहको नाम: ${escapeHtml(grpName)}</div>
      <div>केन्द्रको नाम: ${escapeHtml(ctrName)}</div>
    </div>
    <div>मिति: ${escapeHtml(dtDisplay)}</div>
    <div>स्थान: ${escapeHtml(locDisplay)}</div>
  </div>

  <table>
    <colgroup>
      <col style="width: 7%;" />
      <col style="width: 31%;" />
      <col style="width: 18%;" />
      <col style="width: 14%;" />
      <col style="width: 15%;" />
      <col style="width: 15%;" />
    </colgroup>
    <thead>
      <tr>
        <th class="tc">क्र.सं.</th>
        <th class="tl">सदस्यको नाम</th>
        <th class="tc">सदस्य नं.</th>
        <th class="tr">बचत (रु.)</th>
        <th class="tr">ऋण रकम (रु.)</th>
        <th class="tr">जम्मा (रु.)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="tc">कुल जम्मा (Total)</td>
        <td class="tr mono">${escapeHtml(formatAmount(totalSav))}</td>
        <td class="tr mono">${escapeHtml(formatAmount(totalLn))}</td>
        <td class="tr mono">${escapeHtml(formatAmount(grandTot))}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer-sign">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-name">${escapeHtml(empName)}</div>
      <div class="sign-role">कर्मचारी</div>
    </div>
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
      onToast('प्रिन्ट फ्रेम सुरु गर्न सकिएन ।');
      return;
    }

    doc.open();
    doc.write(htmlDoc);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1200);
      }
    }, 300);
  };

  // Open Deposit Sheet detail only when View is clicked
  const handleViewDepositSheet = () => {
    if (!activeCenter) {
      onToast(
        filterDay === 'ALL'
          ? 'कृपया पहिले केन्द्र चयन गर्नुहोस् ।'
          : `Day ${filterDay} मा कुनै केन्द्र फेला परेन । कृपया अर्को DAY वा CENTER चयन गर्नुहोस् ।`
      );
      return;
    }
    if (!activeGroup) {
      onToast('यस केन्द्रमा कुनै समूह फेला परेन । कृपया मान्य समूह चयन गर्नुहोस् ।');
      return;
    }
    setIsSheetDetailOpen(true);
  };

  // Filtered saved sheets for the Deposit Sheets Record table
  const filteredSavedSheets = useMemo(() => {
    return savedSheets.filter(sheet => {
      if (recordFilterYear !== 'ALL' && String(sheet.year) !== recordFilterYear) return false;
      if (recordFilterMonth !== 'ALL' && String(sheet.month) !== recordFilterMonth) return false;
      return true;
    });
  }, [savedSheets, recordFilterYear, recordFilterMonth]);

  // Load a previously saved sheet back into the filter bar & open editable detail sheet
  const handleLoadSavedSheet = (sheet: MFDepositSheet) => {
    setFilterYear(sheet.year || currentBsDate.year);
    setFilterMonth(sheet.month || currentBsDate.month);
    const matchingCenter = centers.find(c => c.id === sheet.centerId);
    const centerDay = matchingCenter
      ? extractMeetingDayNumber(matchingCenter.meetingDay) ?? extractMeetingDayNumber(matchingCenter.name)
      : null;
    if (centerDay !== null && String(centerDay) === String(parseInt(sheet.day, 10))) {
      setFilterDay(sheet.day);
    } else if (sheet.day) {
      setFilterDay(centerDay !== null ? String(centerDay) : 'ALL');
    }
    setFilterCenterId(sheet.centerId);
    setFilterGroupId(sheet.groupId);
    if (sheet.employeeName) setFilterEmployeeName(sheet.employeeName);
    setIsSheetDetailOpen(true);
    onToast(`${sheet.groupName} (${sheet.dateDisplay}) लोड गरियो ।`);
  };

  const handleConfirmDeleteSheet = () => {
    if (!pendingDeleteSheet) return;
    if (isDayEndedForBranch(branchId)) {
      onToast(getDayEndedBlockMessage());
      setPendingDeleteSheet(null);
      return;
    }
    const updated = microFinanceService.deleteDepositSheet(pendingDeleteSheet.id);
    setSavedSheets(updated);
    setPendingDeleteSheet(null);
    onToast('Deposit Sheet हटाइयो ।');
  };

  return (
    <div className="space-y-3">
      {/* 1. TOP FILTER BAR: YEAR, MONTH, DAY, CENTER, GROUP, EMPLOYEE + VIEW */}
      <div className="bg-white rounded-2xl border border-slate-200 px-3 py-2.5 shadow-2xs print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          {/* YEAR */}
          <div className="w-24 shrink-0">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">YEAR</label>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              <option value="2081">2081</option>
              <option value="2082">2082</option>
              <option value="2083">2083</option>
              <option value="2084">2084</option>
            </select>
          </div>

          {/* MONTH */}
          <div className="w-28 shrink-0">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">MONTH</label>
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {NEPALI_MONTHS_EN.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* DAY */}
          <div className="w-20 shrink-0">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">DAY</label>
            <select
              value={filterDay}
              onChange={e => {
                const nextDay = e.target.value;
                setFilterDay(nextDay);
                const matchingCenters =
                  nextDay === 'ALL'
                    ? centers
                    : centers.filter(c => {
                        const cDay =
                          extractMeetingDayNumber(c.meetingDay) ?? extractMeetingDayNumber(c.name);
                        return cDay === parseInt(fromNepaliDigits(nextDay), 10);
                      });
                const nextCenter = matchingCenters[0];
                const nextCenterId = nextCenter?.id || '';
                setFilterCenterId(nextCenterId);
                if (nextCenterId) {
                  const centerNameNorm = normalizeText(nextCenter?.name);
                  const matchingGroups = groups.filter(
                    g =>
                      g.centerId === nextCenterId ||
                      (centerNameNorm !== '' && normalizeText(g.centerName) === centerNameNorm)
                  );
                  setFilterGroupId(matchingGroups[0]?.id || '');
                } else {
                  setFilterGroupId('');
                }
              }}
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All</option>
              {Array.from({ length: 32 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d.toString()}>{d}</option>
              ))}
            </select>
          </div>

          {/* CENTER */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5 truncate">CENTER</label>
            <select
              value={filterCenterId}
              onChange={e => {
                const nextCenterId = e.target.value;
                setFilterCenterId(nextCenterId);
                if (nextCenterId) {
                  const selCenter =
                    filteredCenters.find(c => c.id === nextCenterId) ||
                    centers.find(c => c.id === nextCenterId);
                  const centerNameNorm = normalizeText(selCenter?.name);
                  const matchingGroups = groups.filter(
                    g =>
                      g.centerId === nextCenterId ||
                      (centerNameNorm !== '' && normalizeText(g.centerName) === centerNameNorm)
                  );
                  setFilterGroupId(matchingGroups[0]?.id || '');
                } else {
                  setFilterGroupId('');
                }
              }}
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {filteredCenters.length === 0 ? (
                <option value="">No center on Day {filterDay}</option>
              ) : (
                filteredCenters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          {/* GROUP */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5 truncate">GROUP</label>
            <select
              value={filterGroupId}
              onChange={e => setFilterGroupId(e.target.value)}
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {filteredGroups.length === 0 ? (
                <option value="">No group in this center</option>
              ) : (
                filteredGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))
              )}
            </select>
          </div>

          {/* EMPLOYEE */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-0.5 truncate">EMPLOYEE</label>
            <select
              value={filterEmployeeName}
              onChange={e => setFilterEmployeeName(e.target.value)}
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {hrEmployees.length > 0 ? (
                hrEmployees.map(emp => (
                  <option key={emp.id} value={emp.fullName}>
                    {emp.fullName} ({emp.employeeCode || emp.designation || 'Staff'})
                  </option>
                ))
              ) : (
                <option value="Field Officer">Field Officer</option>
              )}
            </select>
          </div>

          {/* VIEW BUTTON (Opens Deposit Sheet detail only when clicked) */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleViewDepositSheet}
              title="View Deposit Sheet"
              className="px-3.5 py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SAVED DEPOSIT SHEETS RECORDS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden print:hidden">
        <div className="px-3.5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#00593B]" />
            <h3 className="text-sm font-black text-slate-900">Deposit Sheets Record</h3>
            <span className="text-[11px] font-mono tabular-nums font-bold text-slate-500">
              ({filteredSavedSheets.length})
            </span>
          </div>

          {/* Right side Year & Month filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Year:</label>
              <select
                value={recordFilterYear}
                onChange={e => setRecordFilterYear(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                <option value="ALL">All Years</option>
                <option value="2081">2081</option>
                <option value="2082">2082</option>
                <option value="2083">2083</option>
                <option value="2084">2084</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Month:</label>
              <select
                value={recordFilterMonth}
                onChange={e => setRecordFilterMonth(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                <option value="ALL">All Months</option>
                {NEPALI_MONTHS_EN.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0b1329] text-white text-[10px] font-black uppercase tracking-wider">
                <th className="py-2 px-3 text-center w-12">S.N.</th>
                <th className="py-2 px-3">Sheet No</th>
                <th className="py-2 px-3">Date (BS)</th>
                <th className="py-2 px-3">Center</th>
                <th className="py-2 px-3">Group</th>
                <th className="py-2 px-3">Employee</th>
                <th className="py-2 px-3 text-right">Saving (Rs.)</th>
                <th className="py-2 px-3 text-right">Loan (Rs.)</th>
                <th className="py-2 px-3 text-right">Total (Rs.)</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSavedSheets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-slate-400 font-semibold">
                    कुनै Deposit Sheet रेकर्ड फेला परेन । माथिको View बटनमा क्लिक गरी नयाँ Deposit Sheet प्रविष्ट तथा सुरक्षित गर्नुहोस् ।
                  </td>
                </tr>
              ) : (
                filteredSavedSheets.map((sheet, idx) => (
                  <tr key={sheet.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 text-center font-mono tabular-nums font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums font-bold text-blue-700 whitespace-nowrap">
                      {sheet.sheetNo}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">
                      {sheet.dateDisplay || sheet.dateBs}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-semibold">{sheet.centerName}</td>
                    <td className="py-2 px-3 text-slate-900 font-bold">{sheet.groupName}</td>
                    <td className="py-2 px-3 text-slate-700 font-semibold">{sheet.employeeName}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                      {formatAmount(sheet.totalSaving)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-blue-700">
                      {formatAmount(sheet.totalLoan)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-black text-slate-900">
                      {formatAmount(sheet.grandTotal)}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedSheet(sheet)}
                          title="View & Edit Deposit Sheet"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintSheet(sheet)}
                          title="Print Deposit Sheet"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] cursor-pointer transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => setPendingDeleteSheet(sheet)}
                          title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Deposit Sheet'}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* 3. DEPOSIT SHEET DETAIL MODAL (Opens ONLY when View is clicked) */}
      {isSheetDetailOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:backdrop-blur-none print:block print:p-0 print:overflow-visible"
          onClick={() => setIsSheetDetailOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col print:max-w-none print:max-h-none print:rounded-none print:shadow-none print:border-0 print:overflow-visible print:block"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Top Action Bar */}
            <div className="bg-[#0b1329] px-5 py-3 flex items-center justify-between gap-3 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs sm:text-sm font-black tracking-wide truncate">
                  Deposit Sheet — {activeGroup?.name || ''} ({displayNepaliDate})
                </span>
                {existingSheetForSelection && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3" />
                    {existingSheetForSelection.sheetNo}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isDayEnded || groupMembers.length === 0}
                  onClick={handleSaveAllRows}
                  title={isDayEnded ? 'Day Ended - Action Locked' : 'Save all rows to Deposit Sheets Record'}
                  className="px-3 py-1.5 rounded-xl bg-[#00593B] hover:bg-[#00704b] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <SaveAll className="w-3.5 h-3.5" />
                  <span>Save All</span>
                </button>
                <button
                  type="button"
                  disabled={groupMembers.length === 0}
                  onClick={() => handlePrintSheet()}
                  title="Print Deposit Sheet"
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSheetDetailOpen(false)}
                  title="Close"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Sheet Body */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-white space-y-3 print:p-0 print:overflow-visible">
              {/* Institutional Header */}
              <div className="relative flex flex-col items-center justify-center border-b border-slate-200 pb-3 text-center">
                <img
                  src={logoUrl}
                  alt="Cooperative Logo"
                  className="w-12 h-12 object-contain sm:absolute sm:left-0 sm:top-0 mb-1 sm:mb-0"
                />
                <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                  {organizationNameNp}
                </h2>
                <p className="text-[11px] font-extrabold tracking-wider text-slate-600 uppercase mt-0.5">
                  {organizationName}
                </p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">
                  {activeBranch?.name || activeCenter?.branch || 'Ratauli Head Office'}
                </p>
                <span className="mt-1 inline-block px-3 py-0.5 border border-slate-800 rounded-full text-[10px] font-black tracking-widest uppercase text-slate-900">
                  DEPOSIT SHEET
                </span>
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-end justify-between gap-2 text-xs font-bold text-slate-800 px-0.5">
                <div className="space-y-0.5">
                  <div>
                    समूहको नाम: <span className="font-extrabold text-slate-950">{activeGroup?.name || '—'}</span>
                  </div>
            <div>
              केन्द्रको नाम: <span className="font-extrabold text-slate-950">{activeCenter?.name || '—'}</span>
            </div>
          </div>
          <div>
            मिति: <span className="font-extrabold text-slate-950">{displayNepaliDate}</span>
          </div>
          <div>
            स्थान: <span className="font-extrabold text-slate-950">{activeGroup?.place || activeCenter?.location || '—'}</span>
          </div>
        </div>

        {/* Deposit Entry Table */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full table-fixed border-collapse border-2 border-slate-900 text-xs">
            <colgroup>
              <col className="w-[6%] print:w-[7%]" />
              <col className="w-[27%] print:w-[31%]" />
              <col className="w-[16%] print:w-[18%]" />
              <col className="w-[15%] print:w-[14%]" />
              <col className="w-[15%] print:w-[15%]" />
              <col className="w-[14%] print:w-[15%]" />
              <col className="w-[7%] print:hidden" />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-50 font-black text-slate-900 text-[11px]">
                <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">क्र.सं.</th>
                <th className="py-1.5 px-2 border border-slate-900 text-left whitespace-nowrap">सदस्यको नाम</th>
                <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">सदस्य नं.</th>
                <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">बचत (रु.)</th>
                <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">ऋण रकम (रु.)</th>
                <th className="py-1.5 px-1.5 border border-slate-900 text-center whitespace-nowrap">जम्मा (रु.)</th>
                <th className="py-1 px-1 border border-slate-900 text-center whitespace-nowrap print:hidden">
                  <button
                    type="button"
                    disabled={isDayEnded || groupMembers.length === 0}
                    onClick={handleSaveAllRows}
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Save All Rows'}
                    className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-[#00593B] hover:bg-[#00472f] disabled:opacity-40 text-white text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    <SaveAll className="w-3 h-3" />
                    <span>All</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {groupMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400 font-semibold border border-slate-900">
                    {!activeCenter
                      ? `Day ${filterDay} मा कुनै केन्द्र फेला परेन । कृपया अर्को DAY वा CENTER चयन गर्नुहोस् ।`
                      : 'यस समूहमा कुनै सदस्य फेला परेन ।'}
                  </td>
                </tr>
              ) : (
                groupMembers.map((mem, idx) => {
                  const entry = rowEntries[mem.memberId] || {
                    savingInput: '',
                    loanInput: '',
                    saved: false,
                    dirty: false
                  };
                  const savVal = parseAmount(entry.savingInput);
                  const lnVal = parseAmount(entry.loanInput);
                  const rowTotal = savVal + lnVal;
                  const isRowSavedClean = entry.saved && !entry.dirty;

                  return (
                    <tr
                      key={mem.id || mem.memberId || idx}
                      className={`border-b border-slate-800 transition-colors ${
                        isRowSavedClean ? 'bg-emerald-50/30' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-1 px-1.5 border border-slate-900 text-center font-bold text-slate-700 whitespace-nowrap">
                        {toNepaliDigits(idx + 1)}
                      </td>
                      <td className="py-1 px-2 border border-slate-900 font-bold text-slate-900 leading-tight break-words">
                        {mem.name}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-900 text-center font-mono tabular-nums font-bold text-[11px] text-slate-800 whitespace-nowrap">
                        {mem.memberId}
                      </td>
                      {/* बचत (रु.) editable input */}
                      <td className="py-0.5 px-1 border border-slate-900">
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={isDayEnded}
                          value={entry.savingInput}
                          onChange={e => handleFieldChange(mem.memberId, 'savingInput', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveSingleRow(mem);
                            }
                          }}
                          placeholder="0"
                          aria-label={`Saving deposit for ${mem.name}`}
                          className="w-full px-2 py-1 text-right font-mono tabular-nums font-bold text-xs text-slate-900 bg-white border border-slate-200 focus:border-[#00593B] focus:ring-1 focus:ring-[#00593B] rounded-md focus:outline-hidden disabled:bg-slate-100 print:border-0 print:bg-transparent print:px-1 print:py-0"
                        />
                      </td>
                      {/* ऋण रकम (रु.) editable input */}
                      <td className="py-0.5 px-1 border border-slate-900">
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={isDayEnded}
                          value={entry.loanInput}
                          onChange={e => handleFieldChange(mem.memberId, 'loanInput', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveSingleRow(mem);
                            }
                          }}
                          placeholder="0"
                          aria-label={`Loan deposit for ${mem.name}`}
                          className="w-full px-2 py-1 text-right font-mono tabular-nums font-bold text-xs text-slate-900 bg-white border border-slate-200 focus:border-[#00593B] focus:ring-1 focus:ring-[#00593B] rounded-md focus:outline-hidden disabled:bg-slate-100 print:border-0 print:bg-transparent print:px-1 print:py-0"
                        />
                      </td>
                      {/* जम्मा (रु.) auto-calculated = बचत + ऋण */}
                      <td className="py-1 px-2 border border-slate-900 text-right font-mono tabular-nums font-black text-slate-900 whitespace-nowrap bg-slate-50/70">
                        {formatAmount(rowTotal)}
                      </td>
                      {/* Row Save Icon Button (Hidden on Print) */}
                      <td className="py-0.5 px-1 border border-slate-900 text-center print:hidden">
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => handleSaveSingleRow(mem)}
                          title={
                            isDayEnded
                              ? 'Day Ended - Action Locked'
                              : isRowSavedClean
                                ? 'Saved (Click to re-save row)'
                                : 'Save this row'
                          }
                          aria-label={`Save row for ${mem.name}`}
                          className={`p-1.5 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isRowSavedClean
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : entry.dirty
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-[#00593B] hover:text-white'
                          }`}
                        >
                          {isRowSavedClean ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Total Summary Row */}
              {groupMembers.length > 0 && (
                <tr className="border-t-2 border-slate-900 bg-slate-100 font-black text-slate-900">
                  <td colSpan={3} className="py-1.5 px-2 border border-slate-900 text-center uppercase tracking-wider">
                    कुल जम्मा (Total)
                  </td>
                  <td className="py-1.5 px-2 border border-slate-900 text-right font-mono tabular-nums text-xs">
                    {formatAmount(sheetTotals.totalSaving)}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-900 text-right font-mono tabular-nums text-xs">
                    {formatAmount(sheetTotals.totalLoan)}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-900 text-right font-mono tabular-nums text-xs text-[#00593B]">
                    {formatAmount(sheetTotals.grandTotal)}
                  </td>
                  <td className="py-1 px-1 border border-slate-900 text-center print:hidden">
                    <button
                      type="button"
                      disabled={isDayEnded}
                      onClick={handleSaveAllRows}
                      title="Save All Rows"
                      className="p-1.5 rounded-lg bg-[#00593B] hover:bg-[#00472f] disabled:opacity-40 text-white inline-flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <SaveAll className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

              {/* Footer Signature: ONLY Employee Signature (कर्मचारी) */}
              <div className="flex justify-end items-end pt-10 pb-2 px-6 text-xs font-bold text-slate-900">
                <div className="text-center space-y-1">
                  <div className="w-56 border-b-2 border-dotted border-slate-800 mx-auto" />
                  <div className="text-xs font-bold text-slate-800 pt-0.5 font-mono">
                    {filterEmployeeName || 'Field Officer'}
                  </div>
                  <div className="text-sm font-black">कर्मचारी</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (iframe-safe, no window.confirm) */}
      {pendingDeleteSheet && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex justify-center items-center p-4"
          onClick={() => setPendingDeleteSheet(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-rose-600 text-white flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider">Delete Deposit Sheet</h4>
              <button
                type="button"
                onClick={() => setPendingDeleteSheet(null)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-xs text-slate-700 space-y-2">
              <p className="font-semibold">
                Are you sure you want to delete Deposit Sheet{' '}
                <strong className="font-mono text-slate-900">{pendingDeleteSheet.sheetNo}</strong> for{' '}
                <strong>{pendingDeleteSheet.groupName}</strong>?
              </p>
              <p className="text-[11px] text-slate-500">
                Date: {pendingDeleteSheet.dateDisplay} • Total: Rs. {formatAmount(pendingDeleteSheet.grandTotal)}
              </p>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteSheet(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSheet}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
