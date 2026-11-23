import React, { useState, useEffect } from 'react';
import NepaliDate from 'nepali-date-converter';
import { 
  Calendar, ArrowRightLeft, Copy, Check, X, 
  Clock
} from 'lucide-react';

interface DateConverterModalProps {
  onClose: () => void;
}

const NEPALI_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export const DateConverterModal: React.FC<DateConverterModalProps> = ({ onClose }) => {
  // Conversion mode: 'BS_TO_AD' or 'AD_TO_BS'
  const [mode, setMode] = useState<'BS_TO_AD' | 'AD_TO_BS'>('BS_TO_AD');
  
  const getTodayBs = () => {
    try {
      return new NepaliDate().format('YYYY-MM-DD');
    } catch {
      return '2083-05-04';
    }
  };

  const getTodayAd = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Manual input state (format: YYYY-MM-DD) - Default to empty
  const [inputDate, setInputDate] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Formatted conversion results
  const [convertedResult, setConvertedResult] = useState<{
    dateStr: string; // YYYY-MM-DD
    year: number;
    monthIndex: number;
    monthNameEn: string;
    day: number;
    dayOfWeek: string;
    fullFormatted: string;
  } | null>(null);

  // Perform Date Conversion
  useEffect(() => {
    setConversionError(null);
    if (!inputDate || inputDate.trim() === '') {
      setConvertedResult(null);
      return;
    }

    const cleaned = inputDate.trim();
    // Validate format YYYY-MM-DD
    const parts = cleaned.split('-');
    if (parts.length !== 3) {
      setConversionError('Please enter date in YYYY-MM-DD format (e.g. 2083-05-04)');
      setConvertedResult(null);
      return;
    }

    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);

    if (isNaN(y) || isNaN(m) || isNaN(d)) {
      setConversionError('Invalid date format. Use numeric values (YYYY-MM-DD)');
      setConvertedResult(null);
      return;
    }

    if (m < 1 || m > 12) {
      setConversionError('Month must be between 01 and 12');
      setConvertedResult(null);
      return;
    }

    if (d < 1 || d > 32) {
      setConversionError('Day must be between 01 and 32');
      setConvertedResult(null);
      return;
    }

    try {
      if (mode === 'BS_TO_AD') {
        // BS to AD conversion
        if (y < 2000 || y > 2100) {
          setConversionError('Bikram Sambat (BS) year must be between 2000 and 2100');
          setConvertedResult(null);
          return;
        }

        const nepDate = new NepaliDate(y, m - 1, d);
        const jsDate = nepDate.toJsDate();
        
        const adYear = jsDate.getFullYear();
        const adMonth = jsDate.getMonth(); // 0 to 11
        const adDay = jsDate.getDate();
        const dayIdx = jsDate.getDay(); // 0 to 6

        const adFormatted = `${adYear}-${String(adMonth + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
        const dayName = DAYS_OF_WEEK[dayIdx] || '';

        setConvertedResult({
          dateStr: adFormatted,
          year: adYear,
          monthIndex: adMonth,
          monthNameEn: ENGLISH_MONTHS[adMonth],
          day: adDay,
          dayOfWeek: dayName,
          fullFormatted: `${ENGLISH_MONTHS[adMonth]} ${adDay}, ${adYear} (${dayName})`
        });
      } else {
        // AD to BS conversion
        if (y < 1944 || y > 2043) {
          setConversionError('AD year must be between 1944 and 2043');
          setConvertedResult(null);
          return;
        }

        // Validate actual Gregorian date
        const jsDate = new Date(y, m - 1, d);
        if (jsDate.getFullYear() !== y || jsDate.getMonth() !== (m - 1) || jsDate.getDate() !== d) {
          setConversionError('Invalid English (AD) date. Please verify day and month.');
          setConvertedResult(null);
          return;
        }

        const nepDate = new NepaliDate(jsDate);
        const bsYear = nepDate.getYear();
        const bsMonth = nepDate.getMonth(); // 0 to 11
        const bsDay = nepDate.getDate();
        const dayIdx = nepDate.getDay(); // 0 to 6

        const bsFormatted = nepDate.format('YYYY-MM-DD');
        const dayName = DAYS_OF_WEEK[dayIdx] || '';

        setConvertedResult({
          dateStr: bsFormatted,
          year: bsYear,
          monthIndex: bsMonth,
          monthNameEn: NEPALI_MONTHS_EN[bsMonth],
          day: bsDay,
          dayOfWeek: dayName,
          fullFormatted: `${bsYear} ${NEPALI_MONTHS_EN[bsMonth]} ${String(bsDay).padStart(2, '0')}, ${dayName}`
        });
      }
    } catch {
      setConversionError('Could not convert date. Please check the entered date numbers.');
      setConvertedResult(null);
    }
  }, [inputDate, mode]);

  // Handle Switch Mode
  const handleToggleMode = () => {
    if (mode === 'BS_TO_AD') {
      setMode('AD_TO_BS');
      setInputDate(convertedResult?.dateStr || '');
    } else {
      setMode('BS_TO_AD');
      setInputDate(convertedResult?.dateStr || '');
    }
  };

  // Copy result to clipboard
  const handleCopy = () => {
    if (!convertedResult) return;
    navigator.clipboard.writeText(convertedResult.dateStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Set to today
  const handleSetToday = () => {
    if (mode === 'BS_TO_AD') {
      setInputDate(getTodayBs());
    } else {
      setInputDate(getTodayAd());
    }
  };

  // Clear field
  const handleClear = () => {
    setInputDate('');
    setConversionError(null);
    setConvertedResult(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[6000] flex items-center justify-center p-3 md:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 border-b border-slate-800 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <Calendar size={22} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight uppercase">
                  Date Converter
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-rose-500 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mt-5 grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (mode !== 'BS_TO_AD') {
                  setMode('BS_TO_AD');
                  setInputDate('');
                }
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                mode === 'BS_TO_AD'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className="font-mono">BS → AD</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (mode !== 'AD_TO_BS') {
                  setMode('AD_TO_BS');
                  setInputDate('');
                }
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                mode === 'AD_TO_BS'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className="font-mono">AD → BS</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 bg-slate-50/50">
          
          {/* Input Section */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>
                  {mode === 'BS_TO_AD' ? 'Enter BS Date' : 'Enter AD Date'}
                </span>
              </label>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer border border-emerald-200"
                >
                  <Clock size={11} />
                  <span>Today</span>
                </button>
                {inputDate && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer border border-slate-200"
                    title="Clear input"
                  >
                    <X size={11} />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleMode}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer border border-slate-200"
                  title="Swap Conversion Direction"
                >
                  <ArrowRightLeft size={11} />
                  <span>Swap</span>
                </button>
              </div>
            </div>

            {/* Manual Text Input Field - Empty by default */}
            <div className="relative">
              <input
                type="text"
                value={inputDate}
                onChange={(e) => setInputDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                maxLength={10}
                autoFocus
                className="w-full h-12 bg-slate-50 border-2 border-slate-300 focus:border-emerald-500 rounded-xl px-4 text-base font-black text-slate-900 font-mono tracking-widest focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal shadow-inner"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold pointer-events-none">
                {mode === 'BS_TO_AD' ? 'BS' : 'AD'}
              </div>
            </div>

            {conversionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                <span>{conversionError}</span>
              </div>
            )}
          </div>

          {/* Conversion Result Box */}
          {convertedResult && (
            <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white p-5 rounded-2xl shadow-lg border border-emerald-500/30 space-y-4 relative overflow-hidden">
              
              {/* Background ambient glow */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                    {mode === 'BS_TO_AD' ? 'Converted English (AD) Date' : 'Converted Bikram Sambat (BS) Date'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-emerald-500/40 cursor-pointer shadow-xs"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy YYYY-MM-DD'}</span>
                </button>
              </div>

              {/* Main Converted Output (Font Mono YYYY-MM-DD) */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <div className="text-3xl font-black font-mono tracking-widest text-emerald-300">
                    {convertedResult.dateStr}
                  </div>
                  <div className="text-sm font-bold text-slate-300 mt-1">
                    {convertedResult.fullFormatted}
                  </div>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="inline-block px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-black text-amber-300">
                    {convertedResult.dayOfWeek}
                  </div>
                </div>
              </div>

              {/* Additional Detail Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                <div className="p-2.5 bg-slate-950/50 rounded-xl border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Year</span>
                  <span className="text-sm font-black text-white font-mono mt-0.5 block">
                    {convertedResult.year}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/50 rounded-xl border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Month</span>
                  <span className="text-sm font-black text-emerald-400 mt-0.5 block truncate">
                    {convertedResult.monthNameEn}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/50 rounded-xl border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Day</span>
                  <span className="text-sm font-black text-white font-mono mt-0.5 block">
                    {convertedResult.day}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end text-xs font-bold text-slate-500">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
