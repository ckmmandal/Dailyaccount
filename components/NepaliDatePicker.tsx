
import React, { useState, useRef, useEffect } from 'react';
import NepaliDate from 'nepali-date-converter';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTodayBsDateStr, isBackDateEntryAllowed } from '../utils/backDateControl';

interface NepaliDatePickerProps {
  value: string; // Accepts both AD (YYYY-MM-DD) or BS (YYYY-MM-DD)
  onChange: (value: string) => void; // Now consistently returns BS string
  className?: string;
  label?: string;
  align?: 'left' | 'right';
  disallowBackDateIfDisabled?: boolean;
  disabled?: boolean;
}

const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const NEPALI_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Intelligent parser that detects if a date string is AD or BS based on the year.
 */
const getSafeNepaliDate = (dateStr: string): NepaliDate => {
  if (!dateStr) return new NepaliDate();
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return new NepaliDate();
    
    const [y, m, d] = parts;
    if (y > 2070) {
      return new NepaliDate(y, m - 1, d);
    } else {
      return new NepaliDate(new Date(y, m - 1, d));
    }
  } catch {
    return new NepaliDate();
  }
};

export const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  value,
  onChange,
  className,
  label,
  align = 'left',
  disallowBackDateIfDisabled = false,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => getSafeNepaliDate(value));
  const [backDateAllowed, setBackDateAllowed] = useState(() => isBackDateEntryAllowed());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPolicy = () => {
      setBackDateAllowed(isBackDateEntryAllowed());
    };
    window.addEventListener('settingsUpdated', syncPolicy);
    window.addEventListener('storage', syncPolicy);
    return () => {
      window.removeEventListener('settingsUpdated', syncPolicy);
      window.removeEventListener('storage', syncPolicy);
    };
  }, []);

  const isRestricted = Boolean(disallowBackDateIfDisabled && !backDateAllowed);
  const todayBs = getTodayBsDateStr();

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  useEffect(() => {
    if (value) {
      setViewDate(getSafeNepaliDate(value));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getBsDisplayString = () => {
    try {
      if (!value) return '';
      const bs = getSafeNepaliDate(value);
      return bs.format('YYYY-MM-DD');
    } catch {
      return value || '';
    }
  };

  const handleDayClick = (day: number) => {
    try {
      const newBs = new NepaliDate(viewDate.getYear(), viewDate.getMonth(), day);
      const formatted = newBs.format('YYYY-MM-DD');
      if (isRestricted && formatted !== todayBs) {
        return;
      }
      onChange(formatted);
      setIsOpen(false);
    } catch {
      // ignore out of BS range
    }
  };

  const changeMonth = (e: React.MouseEvent, offset: number) => {
    e.stopPropagation();
    const newMonth = viewDate.getMonth() + offset;
    let newYear = viewDate.getYear();
    let finalMonth = newMonth;

    if (newMonth > 11) {
      finalMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      finalMonth = 11;
      newYear--;
    }

    try {
      setViewDate(new NepaliDate(newYear, finalMonth, 1));
    } catch {
      // out of BS range
    }
  };

  const renderCalendar = () => {
    const year = viewDate.getYear();
    const month = viewDate.getMonth();
    
    let daysInMonth: number;
    let startDay: number;
    try {
      const startOfMonth = new NepaliDate(year, month, 1);
      startDay = startOfMonth.getDay();
      
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextMonthYear = month === 11 ? year + 1 : year;
      const firstOfNext = new NepaliDate(nextMonthYear, nextMonth, 1);
      
      daysInMonth = Math.round((firstOfNext.toJsDate().getTime() - startOfMonth.toJsDate().getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return [<div key="err" className="col-span-7 py-4 text-rose-500 text-[10px] text-center">Calendar Error</div>];
    }

    const days = [];
    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    
    const currentSelected = getSafeNepaliDate(value);

    for (let d = 1; d <= daysInMonth; d++) {
      const bsStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isDateLocked = isRestricted && bsStr !== todayBs;
      const isSelected = Boolean(
        value &&
        currentSelected.getYear() === year &&
        currentSelected.getMonth() === month &&
        currentSelected.getDate() === d
      );
      
      days.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDayClick(d)}
          disabled={isDateLocked}
          title={bsStr}
          className={`h-8 w-8 rounded-full text-[10px] font-black transition-all flex items-center justify-center ${
            isDateLocked
              ? 'opacity-35 cursor-not-allowed text-slate-300 line-through bg-slate-50'
              : isSelected
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'hover:bg-emerald-50 text-slate-700'
          }`}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  return (
    <div className={`relative ${isOpen ? 'z-[100]' : 'z-auto'} ${className}`} ref={containerRef}>
      {label && <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">{label}</label>}
      <div 
        onClick={() => {
          if (disabled) return;
          setBackDateAllowed(isBackDateEntryAllowed());
          setIsOpen(!isOpen);
        }}
        aria-disabled={disabled}
        className={`flex items-center space-x-2 border-2 px-3 py-2 rounded-xl transition-all shadow-sm ${
          disabled
            ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-70 pointer-events-none select-none'
            : 'bg-white border-slate-200 cursor-pointer hover:border-emerald-600 active:scale-95'
        }`}
      >
        <CalendarIcon size={14} className={disabled ? 'text-slate-400' : 'text-emerald-500'} />
        <span className={`font-black text-[11px] leading-none whitespace-nowrap ${disabled ? 'text-slate-500' : 'text-slate-900'}`}>
          {getBsDisplayString()} <span className="text-[8px] text-slate-400 ml-0.5">BS</span>
        </span>
      </div>

      {isOpen && !disabled && (
        <div className={`absolute top-full mt-2 ${align === 'left' ? 'left-0' : 'right-0'} bg-white border-2 border-slate-950 rounded-[2rem] shadow-2xl p-4 w-[248px] z-[9999] animate-in zoom-in-95 duration-200 font-black italic`}>
          <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
            <button type="button" onClick={(e) => changeMonth(e, -1)} className="p-1.5 hover:bg-slate-50 rounded-lg"><ChevronLeft size={16}/></button>
            <div className="text-center">
              <div className="text-[12px] uppercase leading-none">{NEPALI_MONTHS[viewDate.getMonth()]}</div>
              <div className="text-[9px] text-emerald-600 mt-0.5">{viewDate.getYear()}</div>
            </div>
            <button type="button" onClick={(e) => changeMonth(e, 1)} className="p-1.5 hover:bg-slate-50 rounded-lg"><ChevronRight size={16}/></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {NEPALI_DAYS.map(d => <div key={d} className="text-[7px] text-slate-300 text-center uppercase">{d[0]}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">{renderCalendar()}</div>
          <button 
            type="button"
            onClick={() => {
              onChange(getTodayBsDateStr());
              setIsOpen(false);
            }}
            className="mt-3 w-full py-2 bg-slate-950 text-white rounded-xl text-[9px] font-black uppercase tracking-widest"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
};
