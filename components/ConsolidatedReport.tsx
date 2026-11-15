
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowUpRight, ArrowDownRight, 
  Wallet, 
  Printer, 
  Banknote, ArrowRightLeft, PieChart
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { DEFAULT_SETTINGS } from '../AuthContext';
import { NepaliDatePicker } from './NepaliDatePicker';
import { Branch, DailyData, RemittanceType, SystemSettings, LedgerAccount } from '../types';
import { DENOMINATIONS } from '../constants';

import RemittanceManagement from './RemittanceManagement';

type ReportTab = 'summary' | 'deno' | 'remittance' | 'ledger' | 'manage_remit';

const ConsolidatedReport: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTabFromUrl = useMemo<ReportTab>(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'admin' && parts[1] === 'intelligence') {
      const sub = parts[2].toLowerCase() as ReportTab;
      const valid: ReportTab[] = ['summary', 'deno', 'remittance', 'ledger', 'manage_remit'];
      if (valid.includes(sub)) return sub;
    }
    return 'summary';
  }, [location.pathname]);

  const activeTab = activeTabFromUrl;

  const handleTabChange = (tab: ReportTab) => {
    if (tab === 'summary') {
      navigate('/admin/intelligence');
    } else {
      navigate(`/admin/intelligence/${tab}`);
    }
  };

  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [allRawData, setAllRawData] = useState<Record<string, DailyData>>({});
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [b, d, s] = await Promise.all([
          storageService.getBranches(),
          storageService.getAllData(),
          storageService.getSettings()
        ]);
        setBranches(b);
        setAllRawData(d);
        setSettings(s || DEFAULT_SETTINGS);
      } catch (error) {
        console.error("Failed to fetch report data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const consolidatedStats = useMemo(() => {
    if (loading || !settings) return { summaries: [] as (Branch & { inflow: number; outflow: number; vault: number; net: number })[], totalIn: 0, totalOut: 0, totalVault: 0, denoMatrix: {} as Record<string, Record<number, number>>, remitMatrix: {} as Record<string, Record<string, number>> };
    
    const branchSummaries: (Branch & { inflow: number; outflow: number; vault: number; net: number })[] = [];
    const denoMatrix: Record<string, Record<number, number>> = {};
    const remitMatrix: Record<string, Record<string, number>> = {};
    
    let grandTotalIn = 0;
    let grandTotalOut = 0;
    let grandTotalVault = 0;

    branches.forEach(branch => {
      let branchIn = 0;
      let branchOut = 0;
      let branchVault = 0;
      denoMatrix[branch.id] = {};
      remitMatrix[branch.id] = {};
      
      const dates = [];
      const curr = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      dates.forEach(date => {
        const key = `${date}_${branch.id}`;
        const day = allRawData[key] || allRawData[date] || Object.values(allRawData).find((d: any) => 
          (d?.date === date) && (d?.branchId === branch.id || (!d?.branchId && branch.id === 'main'))
        );
        if (day) {
          (day.officeTransactions || []).forEach(t => {
            if (t.type === 'in') branchIn += t.amount;
            else branchOut += t.amount;
          });
          
          (day.denoAdjustments || []).forEach(a => {
            if (!denoMatrix[branch.id][a.value]) denoMatrix[branch.id][a.value] = 0;
            const amt = a.value * a.quantity;
            if (a.type === 'add') {
               branchVault += amt;
               denoMatrix[branch.id][a.value] += a.quantity;
            } else {
               branchVault -= amt;
               denoMatrix[branch.id][a.value] -= a.quantity;
            }
          });

          (day.remittances || []).forEach(r => {
             if (
               r.origin === 'report' ||
               r.transferredToConsolidated === true ||
               (r.transferredToBackOffice === true && r.transferredToConsolidated !== false) ||
               r.origin === 'transferred'
             ) {
                if (!remitMatrix[branch.id][r.companyName]) remitMatrix[branch.id][r.companyName] = 0;
                if (r.type === RemittanceType.SEND) remitMatrix[branch.id][r.companyName] += r.amount;
                else remitMatrix[branch.id][r.companyName] -= r.amount;
             }
          });
        }
      });

      branchSummaries.push({
        ...branch,
        inflow: branchIn,
        outflow: branchOut,
        vault: branchVault,
        net: branchIn - branchOut
      });

      grandTotalIn += branchIn;
      grandTotalOut += branchOut;
      grandTotalVault += branchVault;
    });

    return { summaries: branchSummaries, totalIn: grandTotalIn, totalOut: grandTotalOut, totalVault: grandTotalVault, denoMatrix, remitMatrix };
  }, [dateRange, branches, allRawData, loading, settings]);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'summary': return <SummaryView stats={consolidatedStats} />;
      case 'deno': return <DenoView branches={branches} matrix={consolidatedStats.denoMatrix} />;
      case 'remittance': return <RemitView branches={branches} settings={settings} matrix={consolidatedStats.remitMatrix} />;
      case 'ledger': return <LedgerView branches={branches} />;
      case 'manage_remit': return <RemittanceManagement />;
      default: return null;
    }
  };

  return (
    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 px-1">
        <div>
           <h3 className="text-sm font-black text-slate-800 tracking-tighter uppercase italic leading-none">Global <span className="text-blue-600">Intelligence</span></h3>
           <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Consolidated multi-unit performance metrics</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button onClick={() => handleTabChange('summary')} className={`px-2.5 py-1 rounded-md font-black text-[8px] uppercase tracking-wider transition-all ${activeTab === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Financials</button>
              <button onClick={() => handleTabChange('deno')} className={`px-2.5 py-1 rounded-md font-black text-[8px] uppercase tracking-wider transition-all ${activeTab === 'deno' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Denomination</button>
              <button onClick={() => handleTabChange('remittance')} className={`px-2.5 py-1 rounded-md font-black text-[8px] uppercase tracking-wider transition-all ${activeTab === 'remittance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Remittance</button>
              <button onClick={() => handleTabChange('ledger')} className={`px-2.5 py-1 rounded-md font-black text-[8px] uppercase tracking-wider transition-all ${activeTab === 'ledger' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Ledger</button>
              <button onClick={() => handleTabChange('manage_remit')} className={`px-2.5 py-1 rounded-md font-black text-[8px] uppercase tracking-wider transition-all ${activeTab === 'manage_remit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Manage Remit</button>
           </div>
           <div className="flex items-center space-x-1.5 bg-white p-1 border border-slate-200 rounded-lg shadow-sm">
              <NepaliDatePicker value={dateRange.start} onChange={v => setDateRange(p => ({...p, start: v}))} label="Start" />
              <div className="w-2 h-px bg-slate-200 mt-2.5"></div>
              <NepaliDatePicker value={dateRange.end} onChange={v => setDateRange(p => ({...p, end: v}))} label="End" />
           </div>
           <button onClick={() => window.print()} className="p-2 bg-slate-950 text-white rounded-lg hover:bg-blue-600 shadow-md transition-all" title="Print Report"><Printer size={12}/></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
         <GlobalKpi label="Global Inflow" value={consolidatedStats.totalIn} color="text-emerald-600" icon={<ArrowUpRight size={14}/>} />
         <GlobalKpi label="Global Outflow" value={consolidatedStats.totalOut} color="text-rose-600" icon={<ArrowDownRight size={14}/>} />
         <GlobalKpi label="Consolidated Liquidity" value={consolidatedStats.totalVault} color="text-blue-600" icon={<Wallet size={14}/>} />
      </div>

      {renderContent()}
    </div>
  );
};

interface SummaryStats {
  summaries: (Branch & { inflow: number; outflow: number; vault: number; net: number })[];
  totalIn: number;
  totalOut: number;
  totalVault: number;
}

const SummaryView: React.FC<{ stats: SummaryStats }> = ({ stats }) => (
  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
     <div className="p-2 bg-slate-900 text-white flex items-center justify-between font-black italic">
        <h4 className="font-black uppercase italic tracking-tighter text-[9px]">Branch Comparison Matrix</h4>
        <span className="text-[7px] font-black uppercase tracking-widest opacity-60 italic">Head Office Verified Data</span>
     </div>
     <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-black border-collapse">
           <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[8px] uppercase text-slate-400 tracking-widest text-center italic">
                 <th className="px-4 py-1.5 text-left w-48">Branch Unit</th>
                 <th className="px-4 py-1.5">Inflow (+)</th>
                 <th className="px-4 py-1.5">Outflow (-)</th>
                 <th className="px-4 py-1.5">Net Pos.</th>
                 <th className="px-4 py-1.5 bg-slate-100/50">Vault Balance</th>
                 <th className="px-4 py-1.5">Unit Status</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-100 text-center italic">
              {stats.summaries.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                   <td className="px-4 py-1.5 text-left flex items-center space-x-2">
                      <div className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center font-black italic shadow-sm text-[8px]">{b.code}</div>
                      <div>
                         <span className="block text-slate-900 uppercase italic leading-none mb-0.5 group-hover:text-blue-600 text-[9px]">{b.name}</span>
                         <span className="block text-[6px] font-bold text-slate-400 uppercase tracking-widest">{b.location || 'Not Specified'}</span>
                      </div>
                   </td>
                   <td className="px-4 py-1.5 text-emerald-600 font-bold">रू {b.inflow.toLocaleString()}</td>
                   <td className="px-4 py-1.5 text-rose-600 font-bold">रू {b.outflow.toLocaleString()}</td>
                   <td className={`px-4 py-1.5 font-black italic text-[10px] ${b.net >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>रू {b.net.toLocaleString()}</td>
                   <td className="px-4 py-1.5 bg-slate-100/30 text-slate-950 font-black">रू {b.vault.toLocaleString()}</td>
                   <td className="px-4 py-1.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${b.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{b.status}</span>
                   </td>
                </tr>
              ))}
           </tbody>
           <tfoot className="bg-slate-50 border-t border-slate-100 font-black italic">
              <tr className="uppercase text-[9px]">
                 <td className="px-4 py-2 text-left text-slate-400 uppercase tracking-tighter">Consolidated Totals</td>
                 <td className="px-4 py-2 text-emerald-700 font-black">रू {stats.totalIn.toLocaleString()}</td>
                 <td className="px-4 py-2 text-rose-700 font-black">रू {stats.totalOut.toLocaleString()}</td>
                 <td className="px-4 py-2 text-blue-700 font-black">रू {(stats.totalIn - stats.totalOut).toLocaleString()}</td>
                 <td className="px-4 py-2 bg-slate-900 text-white">रू {stats.totalVault.toLocaleString()}</td>
                 <td className="px-4 py-2"></td>
              </tr>
           </tfoot>
        </table>
     </div>
  </div>
);

const DenoView: React.FC<{ branches: Branch[], matrix: Record<string, Record<number, number>> }> = ({ branches, matrix }) => (
  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
     <div className="p-2 bg-slate-900 text-white flex items-center justify-between font-black italic">
        <div className="flex items-center space-x-1.5"><Banknote size={14} className="text-emerald-400"/><h4 className="font-black uppercase italic tracking-tighter text-[9px]">Global Denomination Audit</h4></div>
        <span className="text-[7px] font-black uppercase tracking-widest opacity-60 italic">Quantity breakdown per unit</span>
     </div>
     <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-black border-collapse">
           <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[8px] uppercase text-slate-400 tracking-widest">
                 <th className="px-4 py-1.5 text-left w-48 border-r border-slate-100">Branch Unit</th>
                 {DENOMINATIONS.map(d => <th key={d} className="p-1 text-center border-r border-slate-100">{d}</th>)}
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-100 text-center italic">
              {branches.map(b => (
                 <tr key={b.id} className="hover:bg-emerald-50/20 transition-colors">
                    <td className="px-4 py-1.5 text-left border-r border-slate-100 font-black uppercase text-[9px] text-slate-700">{b.name}</td>
                    {DENOMINATIONS.map(d => {
                       const qty = matrix[b.id]?.[d] || 0;
                       return <td key={d} className={`p-1 border-r border-slate-100 ${qty !== 0 ? 'text-slate-950 font-black' : 'text-slate-200'}`}>{qty.toLocaleString()}</td>
                    })}
                 </tr>
              ))}
           </tbody>
        </table>
     </div>
  </div>
);

const RemitView: React.FC<{ branches: Branch[], settings: SystemSettings, matrix: Record<string, Record<string, number>> }> = ({ branches, settings, matrix }) => (
  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
     <div className="p-2 bg-slate-900 text-white flex items-center justify-between font-black italic">
        <div className="flex items-center space-x-1.5"><ArrowRightLeft size={14} className="text-orange-400"/><h4 className="font-black uppercase italic tracking-tighter text-[9px]">Global Remittance Flow</h4></div>
        <span className="text-[7px] font-black uppercase tracking-widest opacity-60 italic">Volume per partner per unit</span>
     </div>
     <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-black border-collapse">
           <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[8px] uppercase text-slate-400 tracking-widest">
                 <th className="px-4 py-1.5 text-left w-48 border-r border-slate-100">Branch Unit</th>
                 {branches.length > 0 && (
                   (settings.remittanceCompaniesByBranch?.[branches[0].id] || settings.remittanceCompanies).filter((c: string) => !(settings.hiddenRemittanceCompaniesByBranch?.[branches[0].id]?.includes(c)))
                 ).map((c: string) => <th key={c} className="p-1.5 text-center border-r border-slate-100">{c}</th>)}
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-100 text-center italic">
              {branches.map(b => {
                 const baseCompanies = settings.remittanceCompaniesByBranch?.[b.id] || settings.remittanceCompanies;
                 const hiddenCompanies = settings.hiddenRemittanceCompaniesByBranch?.[b.id] || [];
                 const companies = baseCompanies.filter((c: string) => !hiddenCompanies.includes(c));
                 return (
                   <tr key={b.id} className="hover:bg-orange-50/20 transition-colors">
                      <td className="px-4 py-1.5 text-left border-r border-slate-100 font-black uppercase text-[9px] text-slate-700">{b.name}</td>
                      {companies.map((c: string) => {
                         const val = matrix[b.id]?.[c] || 0;
                         return <td key={c} className={`p-1.5 border-r border-slate-100 ${val !== 0 ? 'text-slate-950 font-black' : 'text-slate-200'}`}>रू {val.toLocaleString()}</td>
                      })}
                   </tr>
                 );
              })}
           </tbody>
        </table>
     </div>
  </div>
);

const LedgerView: React.FC<{ branches: Branch[] }> = ({ branches }) => {
   const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
     const fetchAccounts = async () => {
       try {
         setLoading(true);
         const accs = await storageService.getLedgerAccounts();
         setAccounts(accs);
       } catch (error) {
         console.error("Failed to fetch ledger accounts", error);
       } finally {
         setLoading(false);
       }
     };
     fetchAccounts();
   }, []);

   if (loading) {
     return (
       <div className="flex items-center justify-center p-10">
         <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
       </div>
     );
   }

   return (
     <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-2 bg-slate-900 text-white flex items-center justify-between font-black italic">
           <div className="flex items-center space-x-1.5"><PieChart size={14} className="text-blue-400"/><h4 className="font-black uppercase italic tracking-tighter text-[9px]">Network Ledger Snapshot</h4></div>
        </div>
        <div className="p-3">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {branches.map(b => {
                 const branchAccts = accounts.filter(a => a.branchId === b.id);
                 return (
                    <div key={b.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-blue-500 transition-all group font-black italic">
                       <span className="block text-[6px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{b.code}</span>
                       <h5 className="font-black uppercase italic text-slate-800 text-[10px] group-hover:text-blue-600 leading-none">{b.name}</h5>
                       <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-baseline leading-none">
                          <span className="text-[8px] font-bold text-slate-400">Accounts</span>
                          <span className="text-sm font-black italic text-slate-900">{branchAccts.length}</span>
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>
     </div>
   );
 };

const GlobalKpi: React.FC<{ label: string, value: number, color: string, icon: React.ReactNode }> = ({ label, value, color, icon }) => (
  <div className="bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3 group hover:border-blue-500 transition-all">
     <div className={`p-1.5 rounded-lg bg-slate-50 ${color} group-hover:scale-105 transition-transform`}>{icon}</div>
     <div className="text-left leading-none">
        <span className="block text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</span>
        <span className={`text-xs font-black italic ${color}`}>रू {value.toLocaleString()}</span>
     </div>
  </div>
);

export default ConsolidatedReport;
