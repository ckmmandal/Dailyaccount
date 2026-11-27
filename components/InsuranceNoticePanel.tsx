import React, { useMemo, useState } from 'react';
import {
  BellRing,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileCheck2,
  Info,
  Megaphone,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import {
  InsuranceNoticeCategory,
  InsuranceNoticeItem,
  LoanInsuranceRateRow,
  loanInsuranceService,
  toNepaliDigits
} from '../services/loanInsuranceService';
import { getDayEndedBlockMessage } from '../utils/dayEndLock';

interface InsuranceNoticePanelProps {
  canEdit: boolean;
  canDelete: boolean;
  isDayEnded: boolean;
  currentUserName: string;
}

const CATEGORY_META: Record<
  InsuranceNoticeCategory,
  {
    labelNp: string;
    labelEn: string;
    topBar: string;
    iconBg: string;
    iconText: string;
    accentText: string;
    bulletColor: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  Notice: {
    labelNp: 'महत्वपूर्ण सूचना',
    labelEn: 'Notice',
    topBar: 'bg-amber-500',
    iconBg: 'bg-amber-50 border-amber-200/80',
    iconText: 'text-amber-700',
    accentText: 'text-amber-700',
    bulletColor: 'text-amber-600',
    icon: Megaphone
  },
  Rule: {
    labelNp: 'बीमा नियम',
    labelEn: 'Rule',
    topBar: 'bg-blue-600',
    iconBg: 'bg-blue-50 border-blue-200/80',
    iconText: 'text-blue-700',
    accentText: 'text-blue-700',
    bulletColor: 'text-blue-600',
    icon: ClipboardCheck
  },
  Guideline: {
    labelNp: 'ऋण बीमा जानकारी',
    labelEn: 'Guideline',
    topBar: 'bg-[#015e52]',
    iconBg: 'bg-emerald-50 border-emerald-200/80',
    iconText: 'text-[#015e52]',
    accentText: 'text-[#015e52]',
    bulletColor: 'text-emerald-600',
    icon: BookOpen
  },
  Claim: {
    labelNp: 'दाबी प्रक्रिया',
    labelEn: 'Claim Process',
    topBar: 'bg-rose-600',
    iconBg: 'bg-rose-50 border-rose-200/80',
    iconText: 'text-rose-700',
    accentText: 'text-rose-700',
    bulletColor: 'text-rose-600',
    icon: FileCheck2
  }
};

const QUICK_LOAN_PRESETS = [
  { label: 'रु. १ लाख', amount: 100000 },
  { label: 'रु. २ लाख', amount: 200000 },
  { label: 'रु. ५ लाख', amount: 500000 },
  { label: 'रु. १० लाख', amount: 1000000 }
];

const formatRateNp = (rate: number): string => {
  const fixed = Number.isFinite(rate) ? rate.toFixed(2) : '0.00';
  return `${toNepaliDigits(fixed)}%`;
};

const formatAmountNp = (amount: number): string => {
  const rounded = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `NPR ${toNepaliDigits(rounded)}`;
};

export const InsuranceNoticePanel: React.FC<InsuranceNoticePanelProps> = ({
  canEdit,
  canDelete,
  isDayEnded,
  currentUserName
}) => {
  const [rates, setRates] = useState<LoanInsuranceRateRow[]>(() => loanInsuranceService.getRates());
  const [notices, setNotices] = useState<InsuranceNoticeItem[]>(() => loanInsuranceService.getNotices());

  // Rate table editing state
  const [isEditingRates, setIsEditingRates] = useState(false);
  const [draftRates, setDraftRates] = useState<LoanInsuranceRateRow[]>([]);
  const [confirmResetRates, setConfirmResetRates] = useState(false);

  // Calculator state
  const [calcLoanAmount, setCalcLoanAmount] = useState<number>(500000);
  const [selectedRateId, setSelectedRateId] = useState<string>(() => {
    const initial = loanInsuranceService.getRates();
    return initial[0]?.id || 'rate_1y';
  });

  // Notice filters & search
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | InsuranceNoticeCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null);

  // Notice Create / Edit modal state
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<InsuranceNoticeItem | null>(null);
  const [noticeForm, setNoticeForm] = useState<{
    title: string;
    category: InsuranceNoticeCategory;
    effectiveDateBs: string;
    summary: string;
    pointsText: string;
    isPinned: boolean;
  }>({
    title: '',
    category: 'Notice',
    effectiveDateBs: '२०८३-०१-०१',
    summary: '',
    pointsText: '',
    isPinned: false
  });

  // Inline feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => {
      setFeedback(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Active selected rate row for calculator
  const activeRateRow = useMemo(() => {
    return rates.find(r => r.id === selectedRateId) || rates[0] || null;
  }, [rates, selectedRateId]);

  const calculatedPremium = useMemo(() => {
    if (!activeRateRow || !calcLoanAmount || calcLoanAmount <= 0) return 0;
    return Math.round((calcLoanAmount / 100000) * activeRateRow.amountPer100k);
  }, [activeRateRow, calcLoanAmount]);

  // Derived dynamic summary metrics from the live rate chart
  const rateMetrics = useMemo(() => {
    if (rates.length === 0) {
      return { minYears: 1, maxYears: 8, minRate: 0.35, minAmt: 350, count: 0 };
    }
    const sortedByYears = [...rates].sort((a, b) => a.termYears - b.termYears);
    const sortedByRate = [...rates].sort((a, b) => a.ratePercent - b.ratePercent);
    return {
      minYears: sortedByYears[0].termYears,
      maxYears: sortedByYears[sortedByYears.length - 1].termYears,
      minRate: sortedByRate[0].ratePercent,
      minAmt: sortedByRate[0].amountPer100k,
      count: rates.length
    };
  }, [rates]);

  // Rate Chart Edit Handlers
  const handleStartEditRates = () => {
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    setDraftRates(rates.map(r => ({ ...r })));
    setConfirmResetRates(false);
    setIsEditingRates(true);
  };

  const handleCancelEditRates = () => {
    setIsEditingRates(false);
    setConfirmResetRates(false);
    setDraftRates([]);
  };

  const handleDraftRateChange = (
    id: string,
    field: 'termYears' | 'termLabel' | 'ratePercent' | 'amountPer100k',
    rawValue: string
  ) => {
    setDraftRates(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        if (field === 'termYears') {
          const num = parseFloat(rawValue);
          const safeNum = Number.isFinite(num) ? num : 0;
          return {
            ...row,
            termYears: safeNum,
            termLabel: safeNum > 0 ? `${toNepaliDigits(safeNum)} वर्ष` : row.termLabel
          };
        }
        if (field === 'termLabel') {
          return { ...row, termLabel: rawValue };
        }
        if (field === 'ratePercent') {
          const num = parseFloat(rawValue);
          return { ...row, ratePercent: Number.isFinite(num) ? num : 0 };
        }
        const num = parseFloat(rawValue);
        return { ...row, amountPer100k: Number.isFinite(num) ? Math.round(num) : 0 };
      })
    );
  };

  const handleAddDraftRateRow = () => {
    const maxYear = draftRates.reduce((acc, r) => Math.max(acc, r.termYears), 0);
    const nextYear = Math.floor(maxYear) + 1;
    const prevRate = draftRates[draftRates.length - 1];
    const nextRate = prevRate ? Number((prevRate.ratePercent + 0.25).toFixed(2)) : 0.35;
    const nextAmt = Math.round(nextRate * 1000);
    setDraftRates(prev => [
      ...prev,
      {
        id: `rate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        termYears: nextYear,
        termLabel: `${toNepaliDigits(nextYear)} वर्ष`,
        ratePercent: nextRate,
        amountPer100k: nextAmt
      }
    ]);
  };

  const handleRemoveDraftRateRow = (id: string) => {
    if (draftRates.length <= 1) {
      showFeedback('error', 'दररेट तालिकामा कम्तीमा एक अवधि (Row) हुनुपर्दछ।');
      return;
    }
    setDraftRates(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveRates = () => {
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    if (draftRates.length === 0) {
      showFeedback('error', 'कम्तीमा एक दररेट प्रविष्टि आवश्यक छ।');
      return;
    }
    try {
      const saved = loanInsuranceService.saveRates(draftRates);
      setRates(saved);
      if (!saved.some(r => r.id === selectedRateId) && saved[0]) {
        setSelectedRateId(saved[0].id);
      }
      setIsEditingRates(false);
      setConfirmResetRates(false);
      showFeedback('success', 'ऋण बीमा दररेट तालिका सफलतापूर्वक अपडेट गरियो।');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'दररेट सेभ गर्न सकिएन।');
    }
  };

  const handleResetDefaultRates = () => {
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    try {
      const restored = loanInsuranceService.resetRates();
      setRates(restored);
      setDraftRates(restored.map(r => ({ ...r })));
      setSelectedRateId(restored[0]?.id || 'rate_1y');
      setConfirmResetRates(false);
      setIsEditingRates(false);
      showFeedback('success', 'दररेट तालिका पूर्वनिर्धारित (Default) अवस्थामा रिसेट गरियो।');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'रिसेट गर्न सकिएन।');
    }
  };

  // Notice CRUD Handlers
  const handleOpenCreateNotice = () => {
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    setEditingNotice(null);
    setNoticeForm({
      title: '',
      category: 'Notice',
      effectiveDateBs: '२०८३-०१-०१',
      summary: '',
      pointsText: '',
      isPinned: false
    });
    setIsNoticeModalOpen(true);
  };

  const handleOpenEditNotice = (item: InsuranceNoticeItem) => {
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    setEditingNotice(item);
    setNoticeForm({
      title: item.title,
      category: item.category,
      effectiveDateBs: item.effectiveDateBs || '',
      summary: item.summary,
      pointsText: (item.points || []).join('\n'),
      isPinned: Boolean(item.isPinned)
    });
    setIsNoticeModalOpen(true);
  };

  const handleSaveNoticeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (isDayEnded) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    const trimmedTitle = noticeForm.title.trim();
    const trimmedSummary = noticeForm.summary.trim();
    if (!trimmedTitle || !trimmedSummary) {
      showFeedback('error', 'कृपया सूचनाको शीर्षक र संक्षिप्त विवरण भर्नुहोस्।');
      return;
    }
    const parsedPoints = noticeForm.pointsText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    try {
      let updatedList: InsuranceNoticeItem[];
      if (editingNotice) {
        updatedList = notices.map(n =>
          n.id === editingNotice.id
            ? {
                ...n,
                title: trimmedTitle,
                category: noticeForm.category,
                effectiveDateBs: noticeForm.effectiveDateBs.trim() || undefined,
                summary: trimmedSummary,
                points: parsedPoints,
                isPinned: noticeForm.isPinned,
                updatedBy: currentUserName,
                updatedAt: Date.now()
              }
            : n
        );
      } else {
        const newNotice: InsuranceNoticeItem = {
          id: `ins_notice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: trimmedTitle,
          category: noticeForm.category,
          effectiveDateBs: noticeForm.effectiveDateBs.trim() || undefined,
          summary: trimmedSummary,
          points: parsedPoints,
          isPinned: noticeForm.isPinned,
          updatedBy: currentUserName,
          updatedAt: Date.now()
        };
        updatedList = [newNotice, ...notices];
      }

      loanInsuranceService.saveNotices(updatedList);
      setNotices(updatedList);
      setIsNoticeModalOpen(false);
      setEditingNotice(null);
      showFeedback(
        'success',
        editingNotice ? 'ऋण बीमा सूचना सफलतापूर्वक अपडेट गरियो।' : 'नयाँ ऋण बीमा सूचना सफलतापूर्वक प्रकाशित गरियो।'
      );
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'सूचना सेभ गर्न सकिएन।');
    }
  };

  const handleTogglePinNotice = (id: string) => {
    if (!canEdit || isDayEnded) return;
    try {
      const updated = notices.map(n =>
        n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n
      );
      loanInsuranceService.saveNotices(updated);
      setNotices(updated);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'अपडेट गर्न सकिएन।');
    }
  };

  const handleConfirmDeleteNotice = (id: string) => {
    if (!canDelete || isDayEnded) return;
    try {
      const updated = notices.filter(n => n.id !== id);
      loanInsuranceService.saveNotices(updated);
      setNotices(updated);
      setDeletingNoticeId(null);
      showFeedback('success', 'सूचना सफलतापूर्वक हटाइयो।');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'सूचना हटाउन सकिएन।');
    }
  };

  const filteredNotices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...notices]
      .filter(n => {
        const catOk = categoryFilter === 'ALL' || n.category === categoryFilter;
        if (!catOk) return false;
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q) ||
          n.points.some(p => p.toLowerCase().includes(q)) ||
          (n.effectiveDateBs || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [notices, categoryFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* ============================================================ */}
      {/* HERO HEADER BANNER (Cooperative Teal + Royal Blue Palette)   */}
      {/* ============================================================ */}
      <section className="rounded-2xl bg-gradient-to-r from-[#015e52] via-[#036a5c] to-[#0f4c75] text-white px-5 py-4 sm:px-6 sm:py-4 border border-[#014d43] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
            ऋण बीमा सूचना, दररेट तालिका तथा विस्तृत जानकारी
          </h2>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : 'नयाँ ऋण बीमा सूचना थप्नुहोस्'}
                onClick={handleOpenCreateNotice}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#015e52] hover:bg-emerald-50 text-xs font-extrabold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>नयाँ सूचना थप्नुहोस्</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Inline Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
            aria-label="Close message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* QUICK LOAN INSURANCE HIGHLIGHTS STRIP (4 Semantic Cards)     */}
      {/* ============================================================ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-[#015e52]" />
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">बीमा उमेर सीमा</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 font-mono tabular-nums">१८ – ६५ वर्ष</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/70 text-[#015e52] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-blue-600" />
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">कर्जा अवधि दायरा</p>
              <p className="mt-1 text-lg font-extrabold text-blue-700 font-mono tabular-nums">
                {toNepaliDigits(rateMetrics.minYears)} – {toNepaliDigits(rateMetrics.maxYears)} वर्ष
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-700 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-teal-600" />
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">न्यूनतम बीमा दर</p>
              <p className="mt-1 text-lg font-extrabold text-teal-800 font-mono tabular-nums">
                {formatRateNp(rateMetrics.minRate)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-1 bg-amber-500" />
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">दाबी सूचना अवधि</p>
              <p className="mt-1 text-lg font-extrabold text-amber-700 font-mono tabular-nums">३५ दिन भित्र</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* MAIN SPLIT WORKSPACE: RATE CHART (7) + CALCULATOR (5)        */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT: LOAN INSURANCE RATE CHART (Matches Reference Photo + Full Update Feature) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-blue-50/50 to-emerald-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-slate-900">
              ऋण बीमा दररेट तालिका (Loan Insurance Rate Chart)
            </h3>

            {canEdit && (
              <div className="flex items-center gap-1.5 shrink-0">
                {!isEditingRates ? (
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleStartEditRates}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#015e52] hover:bg-[#014940] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Update Rates</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleAddDraftRateRow}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>थप्नुहोस्</span>
                    </button>
                    {!confirmResetRates ? (
                      <button
                        type="button"
                        onClick={() => setConfirmResetRates(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                        title="Reset to default chart"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResetDefaultRates}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Reset</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCancelEditRates}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRates}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#015e52] hover:bg-[#014940] text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RATE CHART TABLE */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 px-5">Loan Term</th>
                  <th className="py-3.5 px-5">Insurance Rate (%)</th>
                  <th className="py-3.5 px-5 text-right">Insurance Amt (Per NPR 100K)</th>
                  {isEditingRates && <th className="py-3.5 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {!isEditingRates
                  ? rates.map((row, idx) => {
                      const isSelected = activeRateRow?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedRateId(row.id)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50/80'
                              : idx % 2 === 1
                              ? 'bg-slate-50/40 hover:bg-blue-50/40'
                              : 'bg-white hover:bg-blue-50/40'
                          }`}
                        >
                          <td className="py-3 px-5 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isSelected ? 'bg-[#015e52]' : 'bg-slate-300'
                                }`}
                              />
                              <span>{row.termLabel}</span>
                            </div>
                          </td>
                          <td className="py-3 px-5 font-semibold text-slate-700 font-mono tabular-nums">
                            {formatRateNp(row.ratePercent)}
                          </td>
                          <td className="py-3 px-5 text-right font-extrabold text-blue-700 font-mono tabular-nums">
                            {formatAmountNp(row.amountPer100k)}
                          </td>
                        </tr>
                      );
                    })
                  : draftRates.map(row => (
                      <tr key={row.id} className="bg-white hover:bg-slate-50/60">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              aria-label="Loan term years"
                              value={row.termYears}
                              onChange={e => handleDraftRateChange(row.id, 'termYears', e.target.value)}
                              className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#015e52]"
                            />
                            <input
                              type="text"
                              aria-label="Loan term label"
                              value={row.termLabel}
                              onChange={e => handleDraftRateChange(row.id, 'termLabel', e.target.value)}
                              className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#015e52]"
                              placeholder="१ वर्ष"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative inline-flex items-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              aria-label="Insurance rate percent"
                              value={row.ratePercent}
                              onChange={e => handleDraftRateChange(row.id, 'ratePercent', e.target.value)}
                              className="w-24 px-2.5 py-1.5 pr-6 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#015e52]"
                            />
                            <span className="absolute right-2 text-xs font-bold text-slate-400">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="relative inline-flex items-center">
                            <span className="mr-1.5 text-[11px] font-bold text-blue-700">NPR</span>
                            <input
                              type="number"
                              min="0"
                              step="5"
                              aria-label="Insurance amount per 100k"
                              value={row.amountPer100k}
                              onChange={e => handleDraftRateChange(row.id, 'amountPer100k', e.target.value)}
                              className="w-28 px-2.5 py-1.5 rounded-lg border border-blue-300 text-xs font-mono font-extrabold text-blue-700 text-right focus:outline-none focus:border-blue-600"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftRateRow(row.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="हटाउनुहोस्"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: LIVE LOAN INSURANCE PREMIUM CALCULATOR */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 bg-gradient-to-r from-[#015e52]/10 to-blue-50/70 border-b border-slate-200 flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">तुरुन्त ऋण बीमा प्रिमियम गणना</h3>
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-[#015e52] flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              {/* Loan Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  कर्जा रकम
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500">
                    NPR
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={calcLoanAmount || ''}
                    onChange={e => setCalcLoanAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white focus:border-[#015e52] focus:outline-none text-base font-extrabold text-slate-900 font-mono tabular-nums"
                    placeholder="500000"
                  />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {QUICK_LOAN_PRESETS.map(preset => (
                    <button
                      key={preset.amount}
                      type="button"
                      onClick={() => setCalcLoanAmount(preset.amount)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                        calcLoanAmount === preset.amount
                          ? 'bg-[#015e52] text-white border-[#015e52]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Term Selector Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  कर्जा अवधि छान्नुहोस् (Select Loan Term)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {rates.map(r => {
                    const active = activeRateRow?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRateId(r.id)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                      >
                        {r.termLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live Calculation Output Box */}
            <div className="rounded-2xl bg-gradient-to-br from-[#015e52] via-[#025b50] to-[#0f3d6e] text-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wider">
                    अनुमानित कुल बीमा प्रिमियम
                  </p>
                  <p className="mt-1 text-2xl font-extrabold font-mono tabular-nums tracking-tight">
                    NPR {toNepaliDigits(calculatedPremium.toLocaleString('en-IN'))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-emerald-200">लागू अवधि</p>
                  <p className="text-sm font-extrabold">{activeRateRow?.termLabel || '—'}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/15 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-emerald-200 uppercase">कर्जा रकम</p>
                  <p className="font-bold font-mono tabular-nums">
                    NPR {calcLoanAmount.toLocaleString('en-US')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-200 uppercase">बीमा दर</p>
                  <p className="font-bold font-mono tabular-nums">
                    {activeRateRow ? formatRateNp(activeRateRow.ratePercent) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-emerald-200 uppercase">प्रति १ लाख</p>
                  <p className="font-bold font-mono tabular-nums">
                    {activeRateRow ? formatAmountNp(activeRateRow.amountPer100k) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* LOAN INSURANCE GUIDELINES & NOTICES SECTION (FULL CRUD)      */}
      {/* ============================================================ */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
            ऋण बीमा सम्बन्धी जानकारी, नियम तथा आधिकारिक सूचनाहरू
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="सूचना वा जानकारी खोज्नुहोस्..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#015e52] w-48 sm:w-56"
              />
            </div>

            {/* Category Segmented Filter */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/70 border border-slate-200">
              {(
                [
                  { id: 'ALL', label: 'सबै' },
                  { id: 'Notice', label: 'सूचना' },
                  { id: 'Guideline', label: 'जानकारी' },
                  { id: 'Rule', label: 'नियम' },
                  { id: 'Claim', label: 'दाबी' }
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    categoryFilter === tab.id
                      ? 'bg-[#015e52] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notices Grid */}
        <div className="p-5">
          {filteredNotices.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-800">कुनै सूचना वा जानकारी भेटिएन</p>
              <p className="text-xs text-slate-500">
                अर्को श्रेणी छान्नुहोस् वा नयाँ ऋण बीमा सूचना प्रकाशित गर्नुहोस्।
              </p>
              {canEdit && (
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={handleOpenCreateNotice}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#015e52] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>नयाँ सूचना थप्नुहोस्</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredNotices.map(item => {
                const meta = CATEGORY_META[item.category] || CATEGORY_META.Guideline;
                const IconComp = meta.icon;
                const isConfirmingDelete = deletingNoticeId === item.id;

                return (
                  <article
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className={`h-1 ${meta.topBar}`} />
                      <div className="p-5 space-y-3">
                        {/* Card Top Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconBg} ${meta.iconText}`}
                            >
                              <IconComp className="w-4 h-4" />
                            </div>
                            <h4 className="text-sm sm:text-[15px] font-extrabold text-slate-900 leading-snug">
                              {item.title}
                            </h4>
                          </div>

                          {(canEdit || canDelete) && (
                            <div className="flex items-center gap-1 shrink-0">
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isDayEnded}
                                    onClick={() => handleTogglePinNotice(item.id)}
                                    title={item.isPinned ? 'Unpin notice' : 'Pin notice'}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 ${
                                      item.isPinned
                                        ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <Pin className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDayEnded}
                                    onClick={() => handleOpenEditNotice(item)}
                                    title="सम्पादन गर्नुहोस्"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-40"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  disabled={isDayEnded}
                                  onClick={() =>
                                    setDeletingNoticeId(isConfirmingDelete ? null : item.id)
                                  }
                                  title="हटाउनुहोस्"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Inline Delete Confirmation */}
                        {isConfirmingDelete && (
                          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs">
                            <span className="font-semibold text-rose-800">यो सूचना हटाउने हो?</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDeletingNoticeId(null)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                              >
                                रद्द
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteNotice(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                              >
                                हटाउनुहोस्
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Summary */}
                        <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                          {item.summary}
                        </p>

                        {/* Structured Key Points */}
                        {item.points && item.points.length > 0 && (
                          <ul className="space-y-2 pt-1">
                            {item.points.map((pt, pIdx) => (
                              <li
                                key={`${item.id}_pt_${pIdx}`}
                                className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed"
                              >
                                <CheckCircle2
                                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.bulletColor}`}
                                />
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Card Footer Metadata */}
                    <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="font-mono tabular-nums">
                        {item.effectiveDateBs ? `लागू मिति: ${item.effectiveDateBs}` : 'सक्रिय सूचना'}
                      </span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* CREATE / EDIT INSURANCE NOTICE MODAL                         */}
      {/* ============================================================ */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 bg-[#015e52] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold">
                  {editingNotice ? 'ऋण बीमा सूचना सम्पादन गर्नुहोस्' : 'नयाँ ऋण बीमा सूचना / जानकारी थप्नुहोस्'}
                </h3>
                <p className="text-[11px] text-emerald-100">
                  प्रकाशित जानकारी Insurance → Notice खण्डमा सबै अनुमति प्राप्त प्रयोगकर्ताले देख्नेछन्।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNoticeModalOpen(false)}
                className="p-1.5 rounded-lg text-emerald-100 hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNoticeForm} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  शीर्षक (Title) *
                </label>
                <input
                  type="text"
                  required
                  value={noticeForm.title}
                  onChange={e => setNoticeForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="जस्तै: नयाँ ऋण बीमा दररेट लागू भएको सूचना"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#015e52]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    श्रेणी (Category)
                  </label>
                  <select
                    value={noticeForm.category}
                    onChange={e =>
                      setNoticeForm(prev => ({
                        ...prev,
                        category: e.target.value as InsuranceNoticeCategory
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#015e52]"
                  >
                    <option value="Notice">महत्वपूर्ण सूचना (Notice)</option>
                    <option value="Guideline">ऋण बीमा जानकारी (Guideline)</option>
                    <option value="Rule">बीमा नियम (Rule)</option>
                    <option value="Claim">दाबी प्रक्रिया (Claim Process)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    लागू मिति (Effective Date BS)
                  </label>
                  <input
                    type="text"
                    value={noticeForm.effectiveDateBs}
                    onChange={e =>
                      setNoticeForm(prev => ({ ...prev, effectiveDateBs: e.target.value }))
                    }
                    placeholder="२०८३-०१-०१"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#015e52]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  संक्षिप्त विवरण (Summary) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={noticeForm.summary}
                  onChange={e => setNoticeForm(prev => ({ ...prev, summary: e.target.value }))}
                  placeholder="सूचना वा ऋण बीमा सम्बन्धी मुख्य सारांश लेख्नुहोस्..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#015e52]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  मुख्य बुँदाहरू (प्रत्येक लाइनमा एक बुँदा लेख्नुहोस्)
                </label>
                <textarea
                  rows={4}
                  value={noticeForm.pointsText}
                  onChange={e => setNoticeForm(prev => ({ ...prev, pointsText: e.target.value }))}
                  placeholder={'बुँदा १\nबुँदा २\nबुँदा ३'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#015e52]"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noticeForm.isPinned}
                  onChange={e => setNoticeForm(prev => ({ ...prev, isPinned: e.target.checked }))}
                  className="rounded border-slate-300 text-[#015e52] focus:ring-[#015e52]"
                />
                <span>यो सूचनालाई सबैभन्दा माथि पिन (Pin) गर्नुहोस्</span>
              </label>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNoticeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#015e52] hover:bg-[#014940] text-white text-xs font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingNotice ? 'अपडेट सेभ गर्नुहोस्' : 'सूचना प्रकाशित गर्नुहोस्'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
