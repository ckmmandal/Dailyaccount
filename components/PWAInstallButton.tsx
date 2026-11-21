import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'login';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (variant === 'login') {
      return (
        <button
          type="button"
          onClick={() => void install()}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer print:hidden"
          title="Install Ratauli SACCOS App"
        >
          <Download size={14} />
          <span>Install App</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void install()}
        className="px-3 py-1.5 border rounded-xl transition-all flex flex-col items-center relative cursor-pointer shadow-2xs backdrop-blur-xs bg-emerald-500/25 hover:bg-emerald-500/40 text-white border-emerald-300/60 hover:border-white print:hidden"
        title="Install Ratauli SACCOS App on this device"
      >
        <Download size={17} className="text-emerald-200" />
        <span className="text-[7.5px] font-bold uppercase mt-1 tracking-wider text-emerald-100">
          Install
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        {variant === 'login' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-700/30 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-900 transition-all cursor-pointer print:hidden"
            title="Install on iPhone / iPad"
          >
            <Smartphone size={14} />
            <span>Install App</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="px-3 py-1.5 border rounded-xl transition-all flex flex-col items-center relative cursor-pointer shadow-2xs backdrop-blur-xs bg-white/10 hover:bg-white/20 text-white border-white/25 hover:border-white/50 print:hidden"
            title="Install Ratauli SACCOS on iPhone / iPad"
          >
            <Smartphone size={17} className="text-rose-100" />
            <span className="text-[7.5px] font-bold uppercase mt-1 tracking-wider text-rose-100">
              Install
            </span>
          </button>
        )}

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 text-slate-900 print:hidden"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Install Ratauli SACCOS</h3>
                    <p className="text-[11px] font-semibold text-slate-500">iPhone / iPad (Safari)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-700 font-medium bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>
                    Safari को तल रहेको <strong className="inline-flex items-center gap-1 text-slate-900"><Share size={12} /> Share</strong> बटनमा ट्याप गर्नुहोस्।
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>
                    तल स्क्रोल गरेर <strong className="inline-flex items-center gap-1 text-slate-900"><PlusSquare size={12} /> Add to Home Screen</strong> चयन गर्नुहोस्।
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>
                    माथि दायाँपट्टि रहेको <strong className="text-slate-900">Add</strong> थिच्नुहोस्।
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-emerald-800 hover:bg-emerald-900 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
