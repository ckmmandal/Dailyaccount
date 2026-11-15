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
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[6000] flex items-center justify-center p-4 italic font-black text-slate-950 uppercase">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-slate-950">
        
        {/* Header Section - More Compact */}
        <div className="p-4 px-6 border-b-2 border-slate-100 flex items-center justify-between bg-white relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#059669] text-white rounded-xl flex items-center justify-center shadow-md">
              <Calculator size={20} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 leading-none italic">
                EMI <span className="text-[#059669]">CALCULATOR</span>
              </h3>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">
                INSTALLMENT ESTIMATOR
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-rose-600 transition-all border border-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Input Form Section - Optimized Spacing */}
        <div className="p-6 space-y-5 bg-white">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 italic">
                PRINCIPAL
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#10b981] font-black text-sm italic">Rs.</div>
                <input 
                  type="number" 
                  value={values.amount}
                  onChange={e => setValues({...values, amount: e.target.value})}
                  className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-6 font-black text-lg text-slate-900 italic outline-none focus:border-[#10b981] transition-all shadow-inner placeholder:text-slate-300"
                  placeholder="PRINCIPAL AMOUNT..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 italic">
                  INTEREST
                </label>
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-[#10b981]" size={16} />
                  <input 
                    type="number" 
                    value={values.interest}
                    onChange={e => setValues({...values, interest: e.target.value})}
                    className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl pl-10 pr-4 font-black text-lg text-slate-900 italic outline-none focus:border-[#10b981] transition-all shadow-inner placeholder:text-slate-300"
                    placeholder="RATE %"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 italic">
                  DURATION
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#10b981]" size={16} />
                  <input 
                    type="number" 
                    value={values.months}
                    onChange={e => setValues({...values, months: e.target.value})}
                    className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl pl-10 pr-4 font-black text-lg text-slate-900 italic outline-none focus:border-[#10b981] transition-all shadow-inner placeholder:text-slate-300"
                    placeholder="MONTHS"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Card - All White and Compact */}
          <div className="bg-emerald-50/30 p-6 rounded-[2rem] border-2 border-emerald-100 shadow-sm relative overflow-hidden text-center">
            <span className="text-[9px] font-black text-[#059669] uppercase tracking-[0.3em] mb-2 block italic">
              MONTHLY EMI AMOUNT
            </span>
            
            <div className="flex items-center justify-center space-x-1.5 mb-4">
              <span className="text-2xl font-black text-slate-900 italic tracking-tighter">Rs.</span>
              <div className="text-4xl font-black text-slate-950 italic tracking-tighter leading-none">
                {emiResult > 0 ? f2(emiResult) : "0.00"}
              </div>
            </div>

            <div className="w-24 h-1 bg-[#10b981]/20 mx-auto rounded-full mb-6"></div>

            <div className="grid grid-cols-2 w-full gap-4 pt-4 border-t border-emerald-200/50">
              <div className="text-center border-r border-emerald-200/50 pr-2">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">
                  TOTAL INTEREST
                </span>
                <div className="flex items-center justify-center space-x-1 text-[#059669] font-black text-base italic tracking-tight">
                  <span className="text-[10px]">Rs.</span>
                  <span>{totalInterest > 0 ? f0(totalInterest) : "0"}</span>
                </div>
              </div>
              <div className="text-center pl-2">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">
                  TOTAL REPAYMENT
                </span>
                <div className="flex items-center justify-center space-x-1 text-slate-900 font-black text-base italic tracking-tight">
                  <span className="text-[10px]">Rs.</span>
                  <span>{totalPayment > 0 ? f0(totalPayment) : "0"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col gap-2 pt-1">
            <button 
              onClick={() => {
                onClose();
                window.location.hash = '';
                // Navigate to full-page calculator
                window.location.href = '/calculator';
              }} 
              className="bg-emerald-600 text-white w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Calculator size={16} />
              <span>OPEN FULL CALCULATOR</span>
            </button>
            <button 
              onClick={onClose} 
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 w-full h-10 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <ShieldCheck size={16} />
              <span>DISMISS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};