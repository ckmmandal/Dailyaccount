import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Building2, Plus, Trash2, X } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { storageService } from '../services/storageService';
import { Branch, SystemSettings } from '../types';
import { getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const RemittanceManagement: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [newCompany, setNewCompany] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; company: string } | null>(null);
  const isDayEnded = useDayEndLock(selectedBranchId === 'all' ? undefined : selectedBranchId);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [b, s] = await Promise.all([
        storageService.getBranches(),
        storageService.getSettings()
      ]);
      setBranches(b);
      setSettings(s);
    } catch (error) {
      console.error("Failed to fetch remittance data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (updatedSettings: SystemSettings) => {
    await storageService.saveSettings(updatedSettings);
    setSettings(updatedSettings);
  };

  const addCompany = () => {
    if (!newCompany.trim() || !settings) return;
    const updatedSettings = { ...settings };
    if (!updatedSettings.remittanceCompanies.includes(newCompany.trim())) {
      updatedSettings.remittanceCompanies = [...updatedSettings.remittanceCompanies, newCompany.trim()];
      handleSave(updatedSettings);
    }
    setNewCompany('');
  };

  const deleteCompany = (company: string) => {
    setConfirmDelete({ isOpen: true, company });
  };

  const executeDelete = async () => {
    if (!confirmDelete || !settings) return;
    const { company } = confirmDelete;
    const updatedSettings = { ...settings };
    updatedSettings.remittanceCompanies = updatedSettings.remittanceCompanies.filter(c => c !== company);
    await handleSave(updatedSettings);
    setConfirmDelete(null);
  };

  const toggleHideCompany = (company: string) => {
    if (selectedBranchId === 'all' || !settings) return;
    
    const updatedSettings = { ...settings };
    if (!updatedSettings.hiddenRemittanceCompaniesByBranch) {
      updatedSettings.hiddenRemittanceCompaniesByBranch = {};
    }
    
    const hiddenInBranch = updatedSettings.hiddenRemittanceCompaniesByBranch[selectedBranchId] || [];
    if (hiddenInBranch.includes(company)) {
      updatedSettings.hiddenRemittanceCompaniesByBranch[selectedBranchId] = hiddenInBranch.filter(c => c !== company);
    } else {
      updatedSettings.hiddenRemittanceCompaniesByBranch[selectedBranchId] = [...hiddenInBranch, company];
    }
    
    handleSave(updatedSettings);
  };

  const isHidden = (company: string) => {
    if (selectedBranchId === 'all' || !settings) return false;
    return settings.hiddenRemittanceCompaniesByBranch?.[selectedBranchId]?.includes(company) || false;
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const currentCompanies = settings.remittanceCompanies;

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm font-black italic">
      <div className="p-2 bg-slate-900 text-white flex items-center justify-between font-black italic">
        <div className="flex items-center space-x-1.5">
          <Building2 size={14} className="text-orange-400"/>
          <h4 className="font-black uppercase italic tracking-tighter text-[9px]">Remit Management</h4>
        </div>
        <div className="flex items-center space-x-1.5">
          <select 
            value={selectedBranchId} 
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-0.5 text-[8px] uppercase font-black outline-none focus:ring-1 ring-blue-500"
          >
            <option value="all">Global Master</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {selectedBranchId === 'all' && (
            <button 
              onClick={() => setShowAddModal(true)}
              disabled={isDayEnded}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded font-black uppercase text-[8px] tracking-wider transition-all flex items-center space-x-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={isDayEnded ? getDayEndedBlockMessage() : "Add New Remittance Partner"}
            >
              <Plus size={10} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {currentCompanies.map(company => (
            <div key={company} className={`flex items-center justify-between px-3 py-1.5 border border-slate-100 rounded-lg group transition-all ${isHidden(company) ? 'bg-slate-100/50 opacity-40' : 'bg-slate-50/50 hover:border-blue-500'}`}>
              <span className={`uppercase font-black text-[9px] tracking-tight ${isHidden(company) ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{company}</span>
              <div className="flex items-center space-x-1">
                {selectedBranchId !== 'all' ? (
                  <button 
                    onClick={() => toggleHideCompany(company)}
                    disabled={isDayEnded}
                    className={`p-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isHidden(company) ? 'text-orange-500 hover:text-orange-600' : 'text-slate-400 hover:text-blue-600'}`}
                    title={isDayEnded ? getDayEndedBlockMessage() : (isHidden(company) ? "Show" : "Hide")}
                  >
                    {isHidden(company) ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                ) : (
                  <button 
                    onClick={() => deleteCompany(company)}
                    disabled={isDayEnded}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? getDayEndedBlockMessage() : "Delete Globally"}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {currentCompanies.length === 0 && (
            <div className="col-span-full py-6 text-center text-slate-300 uppercase tracking-widest text-[9px]">
              No companies found
            </div>
          )}
        </div>
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[2000] flex items-start justify-center pt-8 sm:pt-14 p-4 text-slate-900 font-black italic animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto sm:my-0 border border-slate-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Plus size={14}/></div>
                  <h3 className="text-xs font-black tracking-tighter uppercase">Add Remit Partner</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded transition-colors">
                  <X size={14} />
                </button>
              </div>

              <DayEndFieldset branchId={selectedBranchId === 'all' ? undefined : selectedBranchId}>
              <div className="space-y-3">
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Company Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. IME, WESTERN UNION" 
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isDayEnded) {
                        addCompany();
                        setShowAddModal(false);
                      }
                    }}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-xs uppercase outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>
              </div>
              </DayEndFieldset>

              <div className="flex justify-end space-x-2 pt-5">
                <button 
                  onClick={() => setShowAddModal(false)} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-1.5 rounded-lg font-black uppercase text-[8px] tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => { addCompany(); setShowAddModal(false); }} 
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Partner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={confirmDelete?.isOpen || false}
        title="Delete Remittance Company"
        message={`Are you sure you want to permanently delete ${confirmDelete?.company} from the global list?`}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default RemittanceManagement;
