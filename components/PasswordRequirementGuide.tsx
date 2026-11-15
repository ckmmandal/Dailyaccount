import React from 'react';
import { Check, X, ShieldAlert, ShieldCheck } from 'lucide-react';
import { validateStrongPassword } from '../utils/passwordPolicy';

interface PasswordRequirementGuideProps {
  password: string;
  showTitle?: boolean;
}

export const PasswordRequirementGuide: React.FC<PasswordRequirementGuideProps> = ({
  password,
  showTitle = true
}) => {
  const result = validateStrongPassword(password);
  const { criteria, score, strengthLabel, isValid } = result;

  // Strength Bar color
  const getBarColor = () => {
    if (score === 100) return 'bg-emerald-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getTextColor = () => {
    if (score === 100) return 'text-emerald-700 font-black';
    if (score >= 80) return 'text-blue-700 font-bold';
    if (score >= 60) return 'text-amber-700 font-bold';
    return 'text-rose-700 font-bold';
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2.5 transition-all">
      {showTitle && (
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
          <div className="flex items-center space-x-1.5 font-bold text-slate-700 text-[11px]">
            {isValid ? (
              <ShieldCheck size={14} className="text-emerald-600" />
            ) : (
              <ShieldAlert size={14} className="text-amber-600" />
            )}
            <span>Security Policy Requirements</span>
          </div>
          <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${getTextColor()} bg-white border border-slate-200`}>
            {strengthLabel} ({score}%)
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${getBarColor()}`} 
          style={{ width: `${Math.max(password ? score : 0, 5)}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
        {/* 1. Min 8 Chars */}
        <div className={`flex items-center space-x-1.5 ${criteria.length ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${criteria.length ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
            {criteria.length ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
          </div>
          <span>Minimum 8 characters</span>
        </div>

        {/* 2. Uppercase */}
        <div className={`flex items-center space-x-1.5 ${criteria.uppercase ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${criteria.uppercase ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
            {criteria.uppercase ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
          </div>
          <span>1 Uppercase letter (A-Z)</span>
        </div>

        {/* 3. Lowercase */}
        <div className={`flex items-center space-x-1.5 ${criteria.lowercase ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${criteria.lowercase ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
            {criteria.lowercase ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
          </div>
          <span>1 Lowercase letter (a-z)</span>
        </div>

        {/* 4. Number */}
        <div className={`flex items-center space-x-1.5 ${criteria.number ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${criteria.number ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
            {criteria.number ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
          </div>
          <span>1 Numeric digit (0-9)</span>
        </div>

        {/* 5. Special Symbol */}
        <div className={`col-span-1 sm:col-span-2 flex items-center space-x-1.5 ${criteria.symbol ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${criteria.symbol ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
            {criteria.symbol ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
          </div>
          <span>1 Special symbol (@, #, $, %, !)</span>
        </div>
      </div>
    </div>
  );
};
