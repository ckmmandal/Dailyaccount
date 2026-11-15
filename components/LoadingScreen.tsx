import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types';

interface LoadingScreenProps {
  settings?: SystemSettings | null;
  message?: string;
  onDismiss?: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ settings, message, onDismiss }) => {
  const [cachedSettings] = useState<SystemSettings | null>(() => {
    if (settings) return settings;
    try {
      const saved = localStorage.getItem('ZEN_AUTH_SETTINGS') || localStorage.getItem('saccos_db_settings');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showBypass, setShowBypass] = useState(false);

  useEffect(() => {
    const bypassTimer = setTimeout(() => {
      setShowBypass(true);
    }, 1800);
    return () => clearTimeout(bypassTimer);
  }, []);

  const rawLogo = settings?.logoUrl || cachedSettings?.logoUrl;
  const logoUrl = (rawLogo && typeof rawLogo === 'string' && !rawLogo.includes('picsum.photos')) 
    ? rawLogo 
    : '/system_logo.png';
  const systemName = settings?.systemName || cachedSettings?.systemName || "RATAULI SACCOS";

  return (
    <div className="fixed inset-0 z-[9999] min-h-screen bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200 font-sans">
      {/* Background Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Logo-Centric Card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 flex flex-col items-center text-center overflow-hidden">
        {/* Top Emerald Accent Strip */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700" />

        {/* Logo Container with Subtle Breathing Halo */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute -inset-2 rounded-full bg-emerald-100/70 blur-md animate-pulse" />
          
          <div className="relative w-28 h-28 rounded-2xl bg-white flex items-center justify-center p-1.5 transition-transform duration-300">
            <img 
              src={logoUrl} 
              alt={systemName} 
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('system_logo.png')) {
                  target.src = '/system_logo.png';
                }
              }}
              className="w-full h-full object-contain filter drop-shadow-xs"
            />
          </div>
        </div>

        {/* Organization Name & System Title */}
        <div className="space-y-1 mb-6">
          <h1 className="text-base sm:text-[17px] font-black text-slate-900 tracking-tight leading-snug">
            रतौली बचत तथा ऋण सहकारी संस्था लि.
          </h1>
          <p className="text-[11.5px] font-bold text-emerald-800 tracking-wide">
            Ratauli Saving & Credit Co-operative Society Ltd.
          </p>
          <div className="pt-1">
            <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200/60">
              दैनिक हिसाब तथा टेलर प्रणाली
            </span>
          </div>
        </div>

        {/* Minimalist Loading Bar & Indicator */}
        <div className="w-full max-w-[220px] space-y-2.5">
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden relative shadow-inner">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-full w-full animate-shimmer relative" />
          </div>

          <p className="text-[11px] font-bold text-slate-500">
            {message || "प्रणाली लोड हुँदैछ..."}
          </p>
        </div>

        {/* Quick Skip button if network is slow */}
        {showBypass && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-5 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
          >
            सिधै अघि बढ्नुहोस् (Continue)
          </button>
        )}
      </div>
    </div>
  );
};
