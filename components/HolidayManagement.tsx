import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Plus, Trash2, Edit2, CheckCircle2, 
  AlertCircle, Building2, Search, Filter, ShieldCheck, 
  Clock, Sun, Sparkles, ChevronLeft, ChevronRight, X, Save, RefreshCw,
  Check, Info, CheckSquare, Square, SlidersHorizontal
} from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { storageService } from '../services/storageService';
import { AppHoliday, Branch } from '../types';
import { useAuth } from '../AuthContext';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const NEPALI_MONTHS = [
  { index: 1, name: 'Baishakh' },
  { index: 2, name: 'Jestha' },
  { index: 3, name: 'Ashadh' },
  { index: 4, name: 'Shrawan' },
  { index: 5, name: 'Bhadra' },
  { index: 6, name: 'Ashwin' },
  { index: 7, name: 'Kartik' },
  { index: 8, name: 'Mangshir' },
  { index: 9, name: 'Poush' },
  { index: 10, name: 'Magh' },
  { index: 11, name: 'Falgun' },
  { index: 12, name: 'Chaitra' }
];

const DAYS_OF_WEEK = [
  { id: 0, label: 'SUN', full: 'Sunday' },
  { id: 1, label: 'MON', full: 'Monday' },
  { id: 2, label: 'TUE', full: 'Tuesday' },
  { id: 3, label: 'WED', full: 'Wednesday' },
  { id: 4, label: 'THU', full: 'Thursday' },
  { id: 5, label: 'FRI', full: 'Friday' },
  { id: 6, label: 'SAT', full: 'Saturday' }
];

const HOLIDAY_TYPES = [
  'Public Holiday',
  'Weekly Off',
  'Local Holiday',
  'Festival',
  'Emergency Holiday'
] as const;

export const HolidayManagement: React.FC = () => {
  const { user } = useAuth();
  const isDayEnded = useDayEndLock();
  const today = useMemo(() => new NepaliDate(), []);
  const currentYear = today.getYear();
  const currentMonth = today.getMonth() + 1; // 1 to 12
  const currentDay = today.getDate();
  const todayBs = today.format('YYYY-MM-DD');

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [holidays, setHolidays] = useState<AppHoliday[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [weekendDays, setWeekendDays] = useState<number[]>([6]); // default Saturday (6)
  const [loading, setLoading] = useState<boolean>(true);
  const [weekendSaving, setWeekendSaving] = useState<boolean>(false);
  const [weekendSavedToast, setWeekendSavedToast] = useState<boolean>(false);

  // Weekly Off setup modal
  const [isWeeklyOffModalOpen, setIsWeeklyOffModalOpen] = useState<boolean>(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingHoliday, setEditingHoliday] = useState<AppHoliday | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDateBs, setFormDateBs] = useState<string>(todayBs);
  const [formType, setFormType] = useState<typeof HOLIDAY_TYPES[number]>('Public Holiday');
  const [formBranchId, setFormBranchId] = useState<string>('all');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formSaving, setFormSaving] = useState<boolean>(false);

  // Load holidays, branches, and weekend configuration
  const loadData = async () => {
    try {
      setLoading(true);
      const [hols, bList, wkDays] = await Promise.all([
        storageService.getHolidays(),
        storageService.getBranches(),
        storageService.getWeekendDays()
      ]);
      setHolidays(hols || []);
      setBranches(bList || []);
      setWeekendDays(wkDays && wkDays.length > 0 ? wkDays : [6]);
    } catch (err) {
      console.error('Failed to load holiday data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute number of days in selected month
  const daysInMonth = useMemo(() => {
    for (let day = 32; day >= 29; day--) {
      try {
        const d = new NepaliDate(selectedYear, selectedMonth - 1, day);
        if (d.getMonth() === selectedMonth - 1 && d.getDate() === day) {
          return day;
        }
      } catch (e) {}
    }
    return 30;
  }, [selectedYear, selectedMonth]);

  // First day day-of-week index (0 for SUN, 6 for SAT)
  const firstDayOfWeek = useMemo(() => {
    try {
      const d = new NepaliDate(selectedYear, selectedMonth - 1, 1);
      return d.getDay();
    } catch (e) {
      return 0;
    }
  }, [selectedYear, selectedMonth]);

  // Toggle a weekend day
  const handleToggleWeekendDay = async (dayId: number) => {
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    let updated: number[];
    if (weekendDays.includes(dayId)) {
      if (weekendDays.length === 1) {
        alert('At least one day must be configured as weekly off.');
        return;
      }
      updated = weekendDays.filter(d => d !== dayId);
    } else {
      updated = [...weekendDays, dayId].sort();
    }

    setWeekendDays(updated);
    try {
      setWeekendSaving(true);
      await storageService.saveWeekendDays(updated);
      setWeekendSavedToast(true);
      setTimeout(() => setWeekendSavedToast(false), 2000);
    } catch (err) {
      console.error('Failed to save weekend days:', err);
    } finally {
      setWeekendSaving(false);
    }
  };

  // Quick preset weekend apply
  const handleApplyWeekendPreset = async (preset: 'sat' | 'fri-sat' | 'sun') => {
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    let presetDays: number[];
    if (preset === 'sat') presetDays = [6];
    else if (preset === 'fri-sat') presetDays = [5, 6];
    else presetDays = [0];

    setWeekendDays(presetDays);
    try {
      setWeekendSaving(true);
      await storageService.saveWeekendDays(presetDays);
      setWeekendSavedToast(true);
      setTimeout(() => setWeekendSavedToast(false), 2000);
    } catch (err) {
      console.error('Failed to save preset weekend days:', err);
    } finally {
      setWeekendSaving(false);
    }
  };

  // Open modal to add or edit
  const handleOpenAddModal = (dateStr?: string) => {
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setEditingHoliday(null);
    setFormTitle('');
    setFormDateBs(dateStr || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`);
    setFormType('Public Holiday');
    setFormBranchId('all');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (hol: AppHoliday) => {
    setEditingHoliday(hol);
    setFormTitle(hol.title);
    setFormDateBs(hol.dateBs);
    setFormType(hol.type as typeof HOLIDAY_TYPES[number]);
    setFormBranchId(hol.branchId || 'all');
    setFormDescription(hol.description || '');
    setIsModalOpen(true);
  };

  const handleDeleteHoliday = async (id: string) => {
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!window.confirm('Are you sure you want to delete this holiday record?')) return;
    try {
      await storageService.deleteHoliday(id);
      setHolidays(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error('Failed to delete holiday:', err);
    }
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!formTitle.trim()) {
      alert('Please enter a holiday title.');
      return;
    }
    if (!formDateBs) {
      alert('Please enter a valid Nepali date (YYYY-MM-DD).');
      return;
    }

    try {
      setFormSaving(true);
      const holRecord: AppHoliday = {
        id: editingHoliday ? editingHoliday.id : `hol_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title: formTitle.trim(),
        dateBs: formDateBs,
        type: formType,
        branchId: formBranchId,
        description: formDescription.trim(),
        createdAt: editingHoliday?.createdAt || new Date().toISOString(),
        createdBy: user?.fullName || 'Admin'
      };

      await storageService.saveHoliday(holRecord);
      setHolidays(prev => [holRecord, ...prev.filter(h => h.id !== holRecord.id)]);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save holiday:', err);
      alert('Could not save holiday. Please try again.');
    } finally {
      setFormSaving(false);
    }
  };

  // Filtered holidays for table view
  const filteredHolidays = useMemo(() => {
    return holidays.filter(h => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = h.title.toLowerCase().includes(q);
        const matchDate = h.dateBs.includes(q);
        const matchType = h.type.toLowerCase().includes(q);
        if (!matchTitle && !matchDate && !matchType) return false;
      }
      if (typeFilter !== 'ALL' && h.type !== typeFilter) return false;
      if (branchFilter !== 'ALL' && h.branchId !== 'all' && h.branchId !== branchFilter) return false;

      if (selectedYear) {
        const holYear = parseInt(h.dateBs.split('-')[0], 10);
        if (holYear !== selectedYear) return false;
      }

      return true;
    }).sort((a, b) => a.dateBs.localeCompare(b.dateBs));
  }, [holidays, searchQuery, typeFilter, branchFilter, selectedYear]);

  // Count metrics for current selected month
  const monthStats = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const monthHols = holidays.filter(h => h.dateBs.startsWith(monthPrefix));
    
    let totalWeekends = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeek = (firstDayOfWeek + (d - 1)) % 7;
      if (weekendDays.includes(dayOfWeek)) {
        totalWeekends++;
      }
    }

    return {
      totalDays: daysInMonth,
      totalHolidays: monthHols.length,
      totalWeekends,
      workingDays: Math.max(0, daysInMonth - totalWeekends - monthHols.length)
    };
  }, [selectedYear, selectedMonth, holidays, daysInMonth, firstDayOfWeek, weekendDays]);

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const currentMonthName = NEPALI_MONTHS.find(m => m.index === selectedMonth)?.name || 'Month';

  // Label showing configured weekend days
  const weekendSummaryLabel = useMemo(() => {
    if (weekendDays.length === 1 && weekendDays[0] === 6) return 'Sat';
    if (weekendDays.length === 2 && weekendDays.includes(5) && weekendDays.includes(6)) return 'Fri, Sat';
    if (weekendDays.length === 1 && weekendDays[0] === 0) return 'Sun';
    return weekendDays.map(d => DAYS_OF_WEEK.find(dw => dw.id === d)?.label).join(', ');
  }, [weekendDays]);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      
      {/* 1. Compact Top Header & Action Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs px-4 py-3 md:px-5 md:py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs"></span>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-tight">
                Holiday Management
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Annual holidays and calendar schedules
              </p>
            </div>
          </div>

          {/* Action buttons: Add Holiday, Weekly Off (right side of Add Holiday), and Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isDayEnded}
              onClick={() => handleOpenAddModal()}
              title={isDayEnded ? getDayEndedBlockMessage() : 'Add Holiday'}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#133824] hover:bg-[#1b4d32] text-white rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={15} />
              <span>Add Holiday</span>
            </button>

            {/* Weekly Off Button right on the right side of Add Holiday */}
            <button
              onClick={() => setIsWeeklyOffModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90 rounded-xl text-xs font-extrabold transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
              title="Configure Weekly Off (Weekend) Days"
            >
              <Sun size={15} className="text-rose-500 group-hover:rotate-45 transition-transform" />
              <span>Weekly Off</span>
              <span className="text-[10px] bg-rose-200/80 text-rose-800 px-1.5 py-0.2 rounded-md font-black">
                {weekendSummaryLabel}
              </span>
            </button>

            <button
              onClick={loadData}
              title="Refresh Data"
              className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Compact Colorful Nepali Calendar View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* Calendar Header with Year and Month Dropdowns side by side */}
        <div className="px-4 py-2.5 md:px-5 md:py-3 bg-gradient-to-r from-slate-900 via-[#0d2a1b] to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-black shadow-inner shrink-0">
              <CalendarIcon size={16} />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white tracking-tight">
                {currentMonthName} {selectedYear} BS
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                Nepali Calendar
              </span>
            </div>
          </div>

          {/* Month & Year Dropdown Controls side-by-side */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Year Selector */}
            <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-2 py-1 shadow-2xs">
              <span className="text-[10px] font-black text-emerald-300 uppercase mr-1.5">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-xs font-black text-white cursor-pointer focus:outline-hidden [&>option]:text-slate-900 [&>option]:bg-white"
              >
                {[2080, 2081, 2082, 2083, 2084, 2085].map(yr => (
                  <option key={yr} value={yr}>Year {yr} BS</option>
                ))}
              </select>
            </div>

            {/* Month Selector Dropdown on the right side of year */}
            <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-2 py-1 shadow-2xs">
              <span className="text-[10px] font-black text-emerald-300 uppercase mr-1.5">Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-xs font-black text-white cursor-pointer focus:outline-hidden [&>option]:text-slate-900 [&>option]:bg-white"
              >
                {NEPALI_MONTHS.map(m => (
                  <option key={m.index} value={m.index}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Prev / Next Month Navigation */}
            <div className="flex items-center bg-white/10 backdrop-blur-md p-0.5 rounded-lg border border-white/20">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-white/20 rounded text-white transition-all cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-white/20 rounded text-white transition-all cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Compact Month Summary Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between gap-3 flex-wrap text-[11px]">
          <div className="flex items-center gap-3.5 flex-wrap font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>Total: <strong className="text-slate-900">{monthStats.totalDays}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Weekly Off: <strong className="text-rose-600">{monthStats.totalWeekends}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>Holidays: <strong className="text-purple-700">{monthStats.totalHolidays}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Working: <strong className="text-emerald-700">{monthStats.workingDays}</strong></span>
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-medium">
            Click day to add holiday
          </div>
        </div>

        {/* Calendar Grid Container with reduced padding & cell height */}
        <div className="p-2.5 md:p-3.5 bg-slate-50/40">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
            
            {/* Day of Week Header */}
            <div className="grid grid-cols-7 bg-slate-100 text-center border-b border-slate-200">
              {DAYS_OF_WEEK.map((day) => {
                const isWeekend = weekendDays.includes(day.id);
                return (
                  <div
                    key={day.id}
                    className={`py-1.5 px-1 text-[11px] font-black uppercase tracking-wider flex flex-col items-center justify-center ${
                      isWeekend 
                        ? 'text-rose-600 bg-rose-50/80 border-b-2 border-rose-500' 
                        : 'text-slate-700 bg-slate-100'
                    }`}
                  >
                    <span>{day.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Days Grid Cells (Reduced height to optimize page space) */}
            <div className="grid grid-cols-7 bg-slate-200/60 gap-px">
              {/* Empty offset cells before month starts */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} className="bg-slate-50/60 min-h-[58px] sm:min-h-[64px] p-1.5 select-none" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = dateStr === todayBs;

                // Check if configured weekend
                const dayOfWeekIndex = (firstDayOfWeek + idx) % 7;
                const isWeekend = weekendDays.includes(dayOfWeekIndex);

                // Holidays on this day
                const dayHolidays = holidays.filter(h => h.dateBs === dateStr);

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => !isDayEnded && handleOpenAddModal(dateStr)}
                    title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                    className={`min-h-[58px] sm:min-h-[64px] p-1.5 transition-all ${isDayEnded ? 'cursor-default' : 'cursor-pointer'} relative flex flex-col justify-between group ${
                      isToday
                        ? 'bg-emerald-50/60 ring-2 ring-emerald-500 ring-inset z-10'
                        : isWeekend
                        ? 'bg-rose-50/40 hover:bg-rose-100/50'
                        : dayHolidays.length > 0
                        ? 'bg-purple-50/40 hover:bg-purple-100/50'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-black rounded-md w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center transition-transform group-hover:scale-105 ${
                          isToday
                            ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-2xs ring-1 ring-emerald-300'
                            : isWeekend
                            ? 'bg-rose-100 text-rose-700 font-black'
                            : dayHolidays.length > 0
                            ? 'bg-purple-100 text-purple-800 font-black'
                            : 'text-slate-800 bg-slate-100/70'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {isToday && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-600 text-white shadow-2xs">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Holiday & Weekend Badges */}
                    <div className="space-y-1 mt-1">
                      {isWeekend && dayHolidays.length === 0 && (
                        <div className="text-[9px] font-extrabold text-rose-700 bg-rose-100/90 border border-rose-200/80 px-1 py-0.2 rounded truncate shadow-2xs flex items-center gap-0.5">
                          <Sun size={9} className="shrink-0 text-rose-500" />
                          <span className="truncate">Weekly Off</span>
                        </div>
                      )}

                      {dayHolidays.map(hol => {
                        const isFestival = hol.type === 'Festival';
                        const isPublic = hol.type === 'Public Holiday';
                        const isLocal = hol.type === 'Local Holiday';

                        const badgeColor = isFestival
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-700 shadow-2xs'
                          : isPublic
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-700 shadow-2xs'
                          : isLocal
                          ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                          : 'bg-rose-600 text-white border-rose-700 shadow-2xs';

                        return (
                          <div
                            key={hol.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(hol);
                            }}
                            className={`text-[9px] font-extrabold px-1 py-0.2 rounded truncate border flex items-center justify-between group/badge transition-transform hover:scale-102 ${badgeColor}`}
                            title={`${hol.title} (${hol.type}) - Click to Edit`}
                          >
                            <span className="truncate">{hol.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color Legend (Compact) */}
          <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap text-[11px] font-medium">
            <div className="flex items-center gap-3.5 flex-wrap">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Legend:</span>
              <span className="flex items-center gap-1 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600"></span>
                <span>Today</span>
              </span>
              <span className="flex items-center gap-1 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                <span>Weekly Off</span>
              </span>
              <span className="flex items-center gap-1 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-600"></span>
                <span>Festival</span>
              </span>
              <span className="flex items-center gap-1 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span>
                <span>Public Holiday</span>
              </span>
              <span className="flex items-center gap-1 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
                <span>Local Holiday</span>
              </span>
            </div>

            <div className="text-[10px] text-slate-400 font-medium">
              Click badge to edit/delete
            </div>
          </div>
        </div>
      </div>

      {/* 3. Compact Registered Holidays Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Annual Holidays Directory ({selectedYear} BS)
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Configured official holidays ({filteredHolidays.length} items)
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Types</option>
              {HOLIDAY_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Holidays Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 uppercase font-extrabold tracking-wider border-b border-slate-200">
                <th className="py-2 px-3">Date (BS)</th>
                <th className="py-2 px-3">Occasion / Holiday Title</th>
                <th className="py-2 px-3">Holiday Type</th>
                <th className="py-2 px-3">Applicable Branch</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHolidays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">
                    No holidays registered for this criteria. Click "+ Add Holiday" to configure one.
                  </td>
                </tr>
              ) : (
                filteredHolidays.map((hol) => {
                  const branchName = hol.branchId === 'all' 
                    ? 'All Branches' 
                    : branches.find(b => b.id === hol.branchId)?.name || hol.branchId;

                  return (
                    <tr key={hol.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {hol.dateBs}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {hol.title}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                          {hol.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium">
                        {branchName}
                      </td>
                      <td className="py-2 px-3 text-slate-500 max-w-xs truncate">
                        {hol.description || '-'}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleOpenEditModal(hol)}
                            className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Holiday'}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleDeleteHoliday(hol.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Delete Holiday'}
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* 4. Weekly Off (Weekend) Configuration Modal Popup */}
      {isWeeklyOffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black">
                  <Sun size={17} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Weekly Off Setup
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Select official weekend closure days
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWeeklyOffModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Quick Presets:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={weekendSaving || isDayEnded}
                  onClick={() => handleApplyWeekendPreset('sat')}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className={`px-2.5 py-1.5 text-xs font-black rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    weekendDays.length === 1 && weekendDays.includes(6)
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Saturday Only
                </button>
                <button
                  type="button"
                  disabled={weekendSaving || isDayEnded}
                  onClick={() => handleApplyWeekendPreset('fri-sat')}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className={`px-2.5 py-1.5 text-xs font-black rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    weekendDays.length === 2 && weekendDays.includes(5) && weekendDays.includes(6)
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Fri & Saturday
                </button>
                <button
                  type="button"
                  disabled={weekendSaving || isDayEnded}
                  onClick={() => handleApplyWeekendPreset('sun')}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className={`px-2.5 py-1.5 text-xs font-black rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    weekendDays.length === 1 && weekendDays.includes(0)
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Sunday Only
                </button>
              </div>
            </div>

            {/* Day checklist */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Customize Days:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = weekendDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => handleToggleWeekendDay(day.id)}
                      disabled={weekendSaving || isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-rose-500 text-white border-rose-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {isSelected ? <CheckSquare size={15} /> : <Square size={15} className="text-slate-400" />}
                        <span>{day.full}</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                        isSelected ? 'bg-rose-700 text-rose-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isSelected ? 'WEEKLY OFF' : 'WORKING'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feedback & Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                {weekendSavedToast ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg animate-in fade-in">
                    <Check size={13} /> Weekly off settings saved!
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">
                    Changes apply immediately to calendar and branch status.
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsWeeklyOffModalOpen(false)}
                className="px-4 py-2 bg-[#133824] hover:bg-[#1b4d32] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add / Edit Holiday Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <CalendarIcon size={16} />
                </div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-3.5">
              <DayEndFieldset className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Holiday / Occasion Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Dashain Festival, Constitution Day"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date (BS: YYYY-MM-DD) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDateBs}
                    onChange={(e) => setFormDateBs(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Holiday Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as typeof HOLIDAY_TYPES[number])}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {HOLIDAY_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Applicable Branch
                </label>
                <select
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Branches (Global Holiday)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code || b.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional details or instructions regarding this closure..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              </DayEndFieldset>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving || isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#133824] hover:bg-[#1b4d32] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Save size={14} />
                  <span>{formSaving ? 'Saving...' : editingHoliday ? 'Update Holiday' : 'Save Holiday'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
