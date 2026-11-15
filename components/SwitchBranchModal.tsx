import React, { useState } from 'react';
import { 
  Building2, ArrowRightLeft, X, Shield, Search, 
  MapPin, CheckCircle2, Sparkles
} from 'lucide-react';
import { Branch } from '../types';

interface SwitchBranchModalProps {
  branches: Branch[];
  currentBranchId: string;
  onSelectBranch: (branch: Branch) => void;
  onClose: () => void;
}

export const SwitchBranchModal: React.FC<SwitchBranchModalProps> = ({
  branches,
  currentBranchId,
  onSelectBranch,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Standard fallback branches if list is empty
  const defaultBranches: Branch[] = [
    { id: 'main', name: 'Ratauli Head Office', code: 'C01', location: 'Ratauli', status: 'Active', createdAt: 1700000000000 },
    { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', location: 'Sahodba', status: 'Active', createdAt: 1700000000001 },
    { id: 'pipra', name: 'Pipra Branch', code: 'C03', location: 'Pipra', status: 'Active', createdAt: 1700000000002 },
    { id: 'parsa', name: 'Parsa Branch', code: 'C04', location: 'Parsa', status: 'Active', createdAt: 1700000000003 },
  ];

  const branchList = branches && branches.length > 0 ? branches : defaultBranches;

  // Merge any missing standard branches
  const map = new Map<string, Branch>();
  defaultBranches.forEach(b => map.set(b.id.toLowerCase(), b));
  branchList.forEach(b => map.set(b.id.toLowerCase(), b));
  const combinedBranches = Array.from(map.values());

  const filtered = combinedBranches.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.nameNp && b.nameNp.toLowerCase().includes(searchTerm.toLowerCase())) ||
    b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.codeNp && b.codeNp.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (b.location && b.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (b.locationNp && b.locationNp.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const normalizeId = (id?: string) => {
    if (!id) return 'main';
    const s = id.toLowerCase();
    if (s === 'main' || s === 'c01' || s === 'head_office' || s === 'head office' || s.includes('ratauli')) return 'main';
    if (s === 'sahodba' || s === 'c02') return 'sahodba';
    if (s === 'pipra' || s === 'c03') return 'pipra';
    if (s === 'parsa' || s === 'c04') return 'parsa';
    return s;
  };

  const activeNorm = normalizeId(currentBranchId);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[6000] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 border-b border-slate-700 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-black italic tracking-tight uppercase">Switch Operational Branch</h3>
                  <span className="bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[8px] font-black uppercase px-2 py-0.5 rounded-full flex items-center space-x-1">
                    <Sparkles size={10} />
                    <span>Super Admin Only</span>
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-300 tracking-wide mt-0.5">
                  Select a branch to switch operational context immediately
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-rose-500 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search Input */}
          <div className="mt-4 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search branch by name or code..."
              className="w-full h-10 bg-slate-950/60 border border-slate-700/80 rounded-xl pl-9 pr-3 text-xs text-white placeholder:text-slate-400 font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Branch List */}
        <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2 bg-slate-50/50">
          {filtered.map(b => {
            const isCurrent = normalizeId(b.id) === activeNorm || normalizeId(b.code) === activeNorm;

            return (
              <div
                key={b.id}
                onClick={() => {
                  onSelectBranch(b);
                  onClose();
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                  isCurrent
                    ? 'bg-emerald-50/90 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-colors shrink-0 ${
                      isCurrent
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                    }`}
                  >
                    <Building2 size={18} />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 tracking-tight leading-tight">{b.name}</h4>
                        {b.nameNp && <p className="text-[11px] font-bold text-slate-600 leading-tight">{b.nameNp}</p>}
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 group-hover:bg-white text-slate-700 text-[9px] font-black rounded-md border border-slate-200 font-mono">
                        {b.code}{b.codeNp ? ` (${b.codeNp})` : ''}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-500 mt-0.5">
                      {(b.location || b.locationNp) && (
                        <span className="flex items-center space-x-1">
                          <MapPin size={11} className="text-slate-400" />
                          <span>{b.location}{b.locationNp ? ` (${b.locationNp})` : ''}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center space-x-1 text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>{b.status === 'Inactive' ? 'Inactive (निष्क्रिय)' : 'Active (सक्रिय)'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {isCurrent ? (
                    <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-xs uppercase tracking-wider">
                      <CheckCircle2 size={13} />
                      <span>Active</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-slate-100 group-hover:bg-emerald-600 text-slate-700 group-hover:text-white rounded-xl text-[10px] font-black transition-colors uppercase tracking-wider flex items-center space-x-1.5"
                    >
                      <span>Switch</span>
                      <ArrowRightLeft size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs font-bold">
              No branches found matching search
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-500">
          <div className="flex items-center space-x-1.5 text-slate-600">
            <Shield size={14} className="text-emerald-600" />
            <span>Super Admin has global access to all branches.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
