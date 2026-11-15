import React, { useState, useEffect } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { PopupNotice } from '../types';
import { storageService } from '../services/storageService';
import { useAuth } from '../AuthContext';

interface LoginPopupNoticeModalProps {
  popup: PopupNotice;
  onClose: () => void;
  isPreview?: boolean;
}

// Authentic Circular Cooperative Logo Seal
export const CooperativeLogoEmblem: React.FC<{ className?: string }> = ({ className = "w-16 h-16" }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer Double Circle */}
    <circle cx="100" cy="100" r="95" stroke="#10b981" strokeWidth="4" fill="#ffffff" />
    <circle cx="100" cy="100" r="87" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
    <circle cx="100" cy="100" r="62" stroke="#10b981" strokeWidth="2" fill="#f0fdf4" />

    {/* Top Text Path */}
    <path id="topTextArc" d="M 25 100 A 75 75 0 0 1 175 100" fill="none" />
    <text className="text-[12px] font-black fill-emerald-600" textAnchor="middle">
      <textPath href="#topTextArc" startOffset="50%">
        श्री रतौली बचत तथा ऋण सहकारी संस्था लि.
      </textPath>
    </text>

    {/* Bottom Text Path */}
    <path id="bottomTextArc" d="M 175 100 A 75 75 0 0 1 25 100" fill="none" />
    <text className="text-[10px] font-bold fill-emerald-600" textAnchor="middle">
      <textPath href="#bottomTextArc" startOffset="50%">
        • स्था. २०६९ • रतौली-५, महोत्तरी •
      </textPath>
    </text>

    {/* Central Auspicious Kalash (Pot) with Leaves & Coconut */}
    <g transform="translate(68, 62)">
      {/* Mango Leaves */}
      <path d="M 10 32 C 0 16 12 5 32 10 C 52 5 64 16 54 32 Z" fill="#10b981" />
      <path d="M 20 28 C 12 12 24 2 32 0 C 40 2 52 12 44 28 Z" fill="#059669" />
      
      {/* Coconut on top */}
      <ellipse cx="32" cy="24" rx="11" ry="13" fill="#10b981" />
      <circle cx="32" cy="16" r="2.5" fill="#ffffff" />

      {/* Kalash Neck and Neckband */}
      <path d="M 20 32 L 44 32 L 40 40 L 24 40 Z" fill="#047857" />
      <rect x="22" y="38" width="20" height="3" rx="1.5" fill="#10b981" />

      {/* Kalash Body (Pot) */}
      <path d="M 14 44 C 10 52 10 66 18 74 C 24 80 40 80 46 74 C 54 66 54 52 50 44 Z" fill="#10b981" />
      <path d="M 17 47 C 14 54 14 64 21 70 C 26 75 38 75 43 70 C 50 64 50 54 47 47 Z" fill="#f0fdf4" />

      {/* Auspicious Swastika inside Pot */}
      <g stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="32" y1="52" x2="32" y2="66" />
        <line x1="25" y1="59" x2="39" y2="59" />
        <line x1="32" y1="52" x2="38" y2="52" />
        <line x1="32" y1="66" x2="26" y2="66" />
        <line x1="25" y1="59" x2="25" y2="53" />
        <line x1="39" y1="59" x2="39" y2="65" />
      </g>

      {/* Kalash Base Stand */}
      <path d="M 22 76 L 42 76 L 45 80 L 19 80 Z" fill="#047857" />
    </g>

    {/* Side Stars */}
    <g fill="#10b981">
      <polygon points="52,118 54,122 58,122 55,125 56,129 52,126 48,129 49,125 46,122 50,122" />
      <polygon points="148,118 150,122 154,122 151,125 152,129 148,126 144,129 145,125 142,122 146,122" />
    </g>
  </svg>
);

export const LoginPopupNoticeModal: React.FC<LoginPopupNoticeModalProps> = ({ 
  popup, 
  onClose 
}) => {
  const { settings: authSettings } = useAuth();
  const [settings, setSettings] = useState(authSettings);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    storageService.getSettings().then(s => {
      if (s) setSettings(s);
    });
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-xl md:max-w-2xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-200 relative p-3.5 sm:p-4.5 pb-3 sm:pb-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 p-2 bg-slate-900/80 hover:bg-slate-950 text-white rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="Close Notice"
        >
          <X size={18} />
        </button>

        {/* Modal Inner Container - Screen Auto-Fitting */}
        <div className="flex flex-col justify-between space-y-2.5 overflow-hidden w-full">
          {/* Announcement Title (if present) */}
          {popup.title && popup.title.trim().length > 0 && (
            <div className="text-center px-8">
              <h1 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                {popup.title}
              </h1>
            </div>
          )}

          {/* Photo / Image Container (Auto-Constrained to viewport & spans full available area) */}
          {popup.imageUrl && (
            <div className="w-full rounded-2xl overflow-hidden bg-slate-900/5 flex items-center justify-center relative group shadow-sm shrink">
              <img
                src={popup.imageUrl}
                alt={popup.imageName || 'Announcement attachment'}
                className={`w-full max-h-[48vh] sm:max-h-[55vh] object-contain mx-auto rounded-xl transition-transform duration-300 ${isZoomed ? 'scale-105' : ''}`}
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="absolute top-3 right-3 bg-slate-950/80 hover:bg-slate-950 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex items-center space-x-1 shadow-md"
              >
                <Maximize2 size={11} />
                <span>{isZoomed ? 'Reset' : 'Zoom'}</span>
              </button>
            </div>
          )}

          {/* Notice Message Text (Always placed above the green line & official letterhead - Justify Alignment) */}
          {popup.message && popup.message.trim().length > 0 && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 text-slate-800 text-xs sm:text-sm md:text-[14.5px] leading-relaxed whitespace-pre-line font-medium text-justify shadow-inner">
              {popup.message}
            </div>
          )}

          {/* Green Divider Line above header (Full Width) */}
          <div className="w-full h-1 bg-emerald-500 rounded-full my-1 sm:my-1.5"></div>

          {/* Official Cooperative Letterhead Banner */}
          <div className="w-full bg-white px-1 sm:px-2 flex items-center justify-between gap-2.5 sm:gap-4 select-none shrink-0 py-0.5">
            {/* Round Logo Seal */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
              {settings?.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Ratauli SACCOS Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <CooperativeLogoEmblem className="w-14 h-14 sm:w-16 sm:h-16" />
              )}
            </div>

            {/* Banner Header Texts */}
            <div className="flex-1 text-center flex flex-col justify-center min-w-0">
              <div className="flex items-center justify-between text-[9px] sm:text-[11px] md:text-[12px] font-semibold text-emerald-700 tracking-tight leading-none px-2 sm:px-5 md:px-7 mb-0.5">
                <span>रजि नं. ११४०/०६९/७०</span>
                <span>नेपाल सरकार सहकारी ऐन २०४८ बामेजिम स्थापित</span>
              </div>
              <h2 className="text-[18px] sm:text-[24px] md:text-[28px] font-black text-emerald-600 tracking-normal sm:tracking-wide leading-tight scale-y-105">
                रतौली बचत तथा ऋण सहकारी संस्था लि.
              </h2>
              <p className="text-[12.5px] sm:text-[15.5px] md:text-[18px] font-bold text-red-600 tracking-wider leading-tight mt-0.5 uppercase">
                Ratauli Saving And Credit Co-operative Ltd.
              </p>
            </div>
          </div>

          {/* Red Divider Line below header (Exact same size, width & thickness as top green line) */}
          <div className="w-full h-1 bg-red-500 rounded-full my-1 sm:my-1.5"></div>
        </div>
      </div>
    </div>
  );
};
