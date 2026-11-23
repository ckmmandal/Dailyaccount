import React, { useState, useMemo } from 'react';
import { X, Calculator, Percent, Calendar, ShieldCheck } from 'lucide-react';

export const EMICalculator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [values, setValues] = useState({
    amount: '',
    interest: '',
    months: ''
  });

  const emiResult = useMemo(() => {
    const P = parseFloat(values.amount);
    const R = parseFloat(values.interest) / 12 / 100;
    const N = parseInt(values.months);

    if (isNaN(P) || isNaN(R) || isNaN(N) || P <= 0 || R < 0 || N <= 0) return 0;
    
    // Formula: [P x R x (1+R)^N] / [(1+R)^N - 1]
    const emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
    return isFinite(emi) ? emi : 0;
  }, [values]);

  const totalPayment = emiResult * parseInt(values.months || '0');
  const totalInterest = totalPayment - parseFloat(values.amount || '0');

  const f2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const f0 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[6000] flex items-center justify-center p-3 italic font-black text-slate-950 uppercase">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-slate-950">
        
        {/* Header Section - Compact */}
        <div className="py-3 px-5 border-b border-slate-100 flex items-center justify-between bg-white relative">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-[#059669] text-white rounded-xl flex items-center justify-center shadow-sm">
              <Calculator size={18} />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 leading-none italic">
              EMI <span className="text-[#059669]">CALCULATOR</span>
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 bg-slate-50 rounded-xl text-slate-400 hover:text-rose-600 transition-all border border-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Form Section - Compact Spacing */}
        <div className="p-4 space-y-3 bg-white">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 italic block">
                PRINCIPAL
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#10b981] font-black text-xs italic">Rs.</div>
                <input 
                  type="number" 
                  value={values.amount}
                  onChange={e => setValues({...values, amount: e.target.value})}
                  className="w-full h-10 bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 font-black text-base text-slate-900 italic outline-none focus:border-[#10b981] transition-all shadow-inner placeholder:text-slate-300"
                  placeholder="PRINCIPAL AMOUNT..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 italic block">
                  INTEREST
                </label>
                <div className="relative">
                  <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#10b981]" size={15} />
                  <input 
                    type="number" 
                    value={values.interest}
                    onChange={e => setValues({...values, interest: e.target.value})}
                    className="w-full h-10 bg-slate-50 border-2 border-slate-100 rounded-xl pl-9 pr-3 font-black text-base text-slate-900 italic outline-none focus:border-[#10b981] transition-all shadow-inner placeholder:text-slate-300"
                    placeholder="RATE %"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 italic block">
                  DURATION
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#10b981]" size={15} />
                  <input 
                    type="number" 
                    value={values.months}
                    onChange={e => setValues({...values, months: e.target.value})}
                    className="w-full h-10 bg-slate-50 border-2 border-slate-100 rounded-xl pl-9 pr-3 font-black text-base text-slate-900 italic outline-none focus:border-[#10b981] transition-all shadow-inner placeholder:text-slate-300"
                    placeholder="MONTHS"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Card - Compact */}
          <div className="bg-emerald-50/30 px-4 py-3.5 rounded-2xl border-2 border-emerald-100 shadow-sm relative overflow-hidden text-center">
            <span className="text-[9px] font-black text-[#059669] uppercase tracking-[0.25em] mb-1 block italic">
              MONTHLY EMI AMOUNT
            </span>
            
            <div className="flex items-center justify-center space-x-1.5 mb-2">
              <span className="text-xl font-black text-slate-900 italic tracking-tighter">Rs.</span>
              <div className="text-3xl font-black text-slate-950 italic tracking-tighter leading-none">
                {emiResult > 0 ? f2(emiResult) : "0.00"}
              </div>
            </div>

            <div className="w-20 h-0.5 bg-[#10b981]/25 mx-auto rounded-full mb-2.5"></div>

            <div className="grid grid-cols-2 w-full gap-3 pt-2.5 border-t border-emerald-200/50">
              <div className="text-center border-r border-emerald-200/50 pr-2">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 italic">
                  TOTAL INTEREST
                </span>
                <div className="flex items-center justify-center space-x-1 text-[#059669] font-black text-sm italic tracking-tight">
                  <span className="text-[10px]">Rs.</span>
                  <span>{totalInterest > 0 ? f0(totalInterest) : "0"}</span>
                </div>
              </div>
              <div className="text-center pl-2">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 italic">
                  TOTAL REPAYMENT
                </span>
                <div className="flex items-center justify-center space-x-1 text-slate-900 font-black text-sm italic tracking-tight">
                  <span className="text-[10px]">Rs.</span>
                  <span>{totalPayment > 0 ? f0(totalPayment) : "0"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer - Compact Single Row */}
          <div className="flex items-center gap-2 pt-0.5">
            <button 
              onClick={() => {
                onClose();
                window.location.hash = '';
                // Navigate to full-page calculator
                window.location.href = '/calculator';
              }} 
              className="bg-emerald-600 text-white flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-[0.12em] shadow-md hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Calculator size={15} />
              <span>OPEN FULL CALCULATOR</span>
            </button>
            <button 
              onClick={onClose} 
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 h-10 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
            >
              <ShieldCheck size={15} />
              <span>DISMISS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};