import React, { useState, useEffect } from 'react';
import { X, Settings, Home, Sparkles, PhoneCall, Coffee, CheckCircle2, Building2, Check } from 'lucide-react';
import { Branch, BranchFixedExpenseConfig, OfficeExpenseRecord } from '../types';
import { storageService } from '../services/storageService';
import { getDeterministicExpenseId, isSameExpenseSlot, deduplicateExpenses, normalizeMonth, normalizeFy } from '../utils/expenseHelpers';
import { getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

interface FixedExpensesSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  currentFiscalYear: string;
  currentMonth: string;
  onAutoGenerateFixed: (branchId: string, month: string, fiscalYear: string) => Promise<void>;
  isGenerating?: boolean;
}

export const FixedExpensesSetupModal: React.FC<FixedExpensesSetupModalProps> = ({
  isOpen,
  onClose,
  branches,
  currentFiscalYear,
  currentMonth,
  onAutoGenerateFixed,
  isGenerating = false
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || 'main');
  const [configs, setConfigs] = useState<Record<string, BranchFixedExpenseConfig>>({});
  const [activeTab, setActiveTab] = useState<'rent' | 'cleaner' | 'telecom' | 'khaja'>('rent');
  const [isSaving, setIsSaving] = useState(false);
  const [okFeedback, setOkFeedback] = useState<string | null>(null);
  const isDayEnded = useDayEndLock(selectedBranchId);

  const getDefaultConfigForBranch = (bId: string): BranchFixedExpenseConfig => ({
    branchId: bId,
    rentEnabled: true,
    rentAmount: 16666.67,
    rentTdsRate: 10,
    rentNetPaid: 15000,
    landlordName: '',
    landlordPan: '',
    rentPaymentMethod: 'Account Transfer',
    rentAccountNo: '',
    rentBankName: '',
    cleanerEnabled: true,
    cleanerName: '',
    cleanerAmount: 8000,
    cleanerTdsRate: 0,
    cleanerNetPaid: 8000,
    cleanerWorkingDays: 30,
    cleanerPaymentMethod: 'Account Transfer',
    cleanerAccountNo: '',
    cleanerBankName: '',
    telephoneEnabled: true,
    telephoneProvider: 'Nepal Telecom',
    telephoneAccountNo: '',
    telephoneAmount: 1500,
    telephoneRemark: '',
    telephonePaymentMethod: 'Account Transfer',
    telephoneBankName: '',
    khajaEnabled: true,
    khajaMonthlyAmount: 5000,
    khajaDescription: 'Daily office refreshments & meeting tea/snacks',
    khajaRemark: 'Daily office refreshments & meeting tea/snacks',
    khajaPaymentMethod: 'Cash'
  });

  // Form config state for selected branch
  const [currentConfig, setCurrentConfig] = useState<BranchFixedExpenseConfig>(
    getDefaultConfigForBranch(selectedBranchId)
  );

  const loadAllConfigs = async () => {
    const all = await storageService.getFixedExpenseConfigs();
    setConfigs(all);
    const existing = all[selectedBranchId];
    if (existing) {
      setCurrentConfig({
        ...getDefaultConfigForBranch(selectedBranchId),
        ...existing,
        cleanerNetPaid: existing.cleanerNetPaid !== undefined ? existing.cleanerNetPaid : (existing.cleanerAmount || 8000),
        cleanerTdsRate: existing.cleanerTdsRate !== undefined ? existing.cleanerTdsRate : 0,
        telephoneRemark: existing.telephoneRemark || '',
        khajaRemark: existing.khajaRemark || existing.khajaDescription || 'Daily office refreshments & meeting tea/snacks'
      });
    } else {
      setCurrentConfig(getDefaultConfigForBranch(selectedBranchId));
    }
  };

  // Only load from storage once when modal opens, NEVER re-fetch on branch change so in-memory table data is never lost
  useEffect(() => {
    if (isOpen) {
      loadAllConfigs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBranchChange = (nextBranchId: string) => {
    if (nextBranchId === selectedBranchId) return;

    // Automatically preserve the currently active branch's form values into configs state
    const currentBranchSaved: BranchFixedExpenseConfig = {
      ...currentConfig,
      branchId: selectedBranchId
    };

    const updatedConfigs = {
      ...configs,
      [selectedBranchId]: currentBranchSaved
    };

    setConfigs(updatedConfigs);
    setSelectedBranchId(nextBranchId);

    if (updatedConfigs[nextBranchId]) {
      const existing = updatedConfigs[nextBranchId];
      setCurrentConfig({
        ...getDefaultConfigForBranch(nextBranchId),
        ...existing,
        cleanerNetPaid: existing.cleanerNetPaid !== undefined ? existing.cleanerNetPaid : (existing.cleanerAmount || 8000),
        cleanerTdsRate: existing.cleanerTdsRate !== undefined ? existing.cleanerTdsRate : 0,
        telephoneRemark: existing.telephoneRemark || '',
        khajaRemark: existing.khajaRemark || existing.khajaDescription || 'Daily office refreshments & meeting tea/snacks'
      });
    } else {
      setCurrentConfig(getDefaultConfigForBranch(nextBranchId));
    }
  };

  // When clicking OK button in the top/summary bar: apply current form values to in-memory configs for this branch
  const handleApplyCurrentBranch = () => {
    const updated = {
      ...currentConfig,
      branchId: selectedBranchId
    };
    setCurrentConfig(updated);
    setConfigs(prev => ({
      ...prev,
      [selectedBranchId]: updated
    }));

    const branchObj = branches.find(b => b.id === selectedBranchId);
    const bName = branchObj ? branchObj.name : selectedBranchId;
    setOkFeedback(`✓ Updated ${bName} in table`);
    setTimeout(() => {
      setOkFeedback(null);
    }, 2500);
  };

  // Rent Calculations
  const handleRentGrossChange = (gross: number) => {
    const rate = currentConfig.rentTdsRate !== undefined ? currentConfig.rentTdsRate : 10;
    const tax = parseFloat((gross * (rate / 100)).toFixed(2));
    const net = parseFloat((gross - tax).toFixed(2));
    setCurrentConfig(prev => ({
      ...prev,
      rentAmount: gross,
      rentNetPaid: net
    }));
  };

  const handleRentTdsChange = (rate: number) => {
    const gross = currentConfig.rentAmount || 0;
    if (gross > 0) {
      const tax = parseFloat((gross * (rate / 100)).toFixed(2));
      const net = parseFloat((gross - tax).toFixed(2));
      setCurrentConfig(prev => ({
        ...prev,
        rentTdsRate: rate,
        rentNetPaid: net
      }));
    } else {
      const net = currentConfig.rentNetPaid || 0;
      const factor = rate < 100 ? (100 - rate) / 100 : 1;
      const calcGross = factor > 0 ? parseFloat((net / factor).toFixed(2)) : net;
      setCurrentConfig(prev => ({
        ...prev,
        rentTdsRate: rate,
        rentAmount: calcGross
      }));
    }
  };

  const handleRentNetChange = (net: number) => {
    const rate = currentConfig.rentTdsRate !== undefined ? currentConfig.rentTdsRate : 10;
    const factor = rate < 100 ? (100 - rate) / 100 : 0.9;
    const gross = factor > 0 ? parseFloat((net / factor).toFixed(2)) : net;
    setCurrentConfig(prev => ({
      ...prev,
      rentNetPaid: net,
      rentAmount: gross
    }));
  };

  // Cleaner Calculations: Gross Amount -> TDS Deduction -> Net Paid
  const handleCleanerGrossChange = (gross: number) => {
    const rate = currentConfig.cleanerTdsRate || 0;
    const tax = parseFloat((gross * (rate / 100)).toFixed(2));
    const net = parseFloat((gross - tax).toFixed(2));
    setCurrentConfig(prev => ({
      ...prev,
      cleanerAmount: gross,
      cleanerNetPaid: net
    }));
  };

  const handleCleanerTdsChange = (rate: number) => {
    const gross = currentConfig.cleanerAmount || 0;
    if (gross > 0) {
      const tax = parseFloat((gross * (rate / 100)).toFixed(2));
      const net = parseFloat((gross - tax).toFixed(2));
      setCurrentConfig(prev => ({
        ...prev,
        cleanerTdsRate: rate,
        cleanerNetPaid: net
      }));
    } else {
      const net = currentConfig.cleanerNetPaid || 0;
      const factor = rate < 100 ? (100 - rate) / 100 : 1;
      const calcGross = factor > 0 ? parseFloat((net / factor).toFixed(2)) : net;
      setCurrentConfig(prev => ({
        ...prev,
        cleanerTdsRate: rate,
        cleanerAmount: calcGross
      }));
    }
  };

  const handleCleanerNetChange = (net: number) => {
    const rate = currentConfig.cleanerTdsRate || 0;
    const factor = rate < 100 ? (100 - rate) / 100 : 1;
    const gross = factor > 0 ? parseFloat((net / factor).toFixed(2)) : net;
    setCurrentConfig(prev => ({
      ...prev,
      cleanerNetPaid: net,
      cleanerAmount: gross
    }));
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Merge current form changes for active branch
      const activeBranchConfig: BranchFixedExpenseConfig = {
        ...currentConfig,
        branchId: selectedBranchId
      };
      
      const allConfigsToSave = {
        ...configs,
        [selectedBranchId]: activeBranchConfig
      };

      // Save all updated configs
      for (const [bId, cfg] of Object.entries(allConfigsToSave)) {
        await storageService.saveFixedExpenseConfig(cfg);
      }
      setConfigs(allConfigsToSave);

      // If any existing expense records are in the system for currentFiscalYear and currentMonth,
      // update their values according to the new setup, using deterministic IDs.
      // NEVER insert new records if none existed yet (as per user directive: records are only created
      // when explicitly generated/saved from report preview, and must never duplicate).
      const existingExpenses = await storageService.getOfficeExpenses();
      const effectiveMonth = currentMonth;
      const targetFiscalYear = currentFiscalYear;

      let updatedList = [...existingExpenses];

      // Update existing records in place if they already exist, removing any duplicates
      for (const [bId, configToSave] of Object.entries(allConfigsToSave)) {
        // 1. House Rent (only update if existing record was already posted)
        if (configToSave.rentEnabled) {
          const net = configToSave.rentNetPaid || 15000;
          const gross = configToSave.rentAmount || (net / 0.9);
          const tax = gross - net;

          const existingRent = updatedList.find(e => isSameExpenseSlot(e, bId, targetFiscalYear, effectiveMonth, 'house_rent'));
          if (existingRent) {
            updatedList = updatedList.filter(e => !isSameExpenseSlot(e, bId, targetFiscalYear, effectiveMonth, 'house_rent'));
            const detId = getDeterministicExpenseId('house_rent', bId, targetFiscalYear, effectiveMonth);
            updatedList.push({
              ...existingRent,
              id: detId,
              branchId: bId,
              fiscalYear: targetFiscalYear,
              month: effectiveMonth,
              category: 'house_rent',
              amount: parseFloat(gross.toFixed(2)),
              taxDeduction: parseFloat(tax.toFixed(2)),
              netPaidAmount: net,
              paymentMethod: configToSave.rentPaymentMethod || 'Account Transfer',
              accountNo: configToSave.rentAccountNo || '',
              bankName: configToSave.rentBankName || '',
              landlordName: configToSave.landlordName,
              panVatNo: configToSave.landlordPan,
              paidTo: configToSave.landlordName || 'Landlord',
              createdAt: Date.now()
            });
          }
        }

        // 2. Cleaner Payment
        if (configToSave.cleanerEnabled) {
          const net = configToSave.cleanerNetPaid || configToSave.cleanerAmount || 8000;
          const gross = configToSave.cleanerAmount || net;
          const tax = parseFloat((gross - net).toFixed(2));

          const existingCln = updatedList.find(e => isSameExpenseSlot(e, bId, targetFiscalYear, effectiveMonth, 'cleaner_payment'));
          if (existingCln) {
            updatedList = updatedList.filter(e => !isSameExpenseSlot(e, bId, targetFiscalYear, effectiveMonth, 'cleaner_payment'));
            const detId = getDeterministicExpenseId('cleaner_payment', bId, targetFiscalYear, effectiveMonth);
            updatedList.push({
              ...existingCln,
              id: detId,
              branchId: bId,
              fiscalYear: targetFiscalYear,
              month: effectiveMonth,
              category: 'cleaner_payment',
              amount: parseFloat(gross.toFixed(2)),
              taxDeduction: tax > 0 ? parseFloat(tax.toFixed(2)) : 0,
              netPaidAmount: parseFloat(net.toFixed(2)),
              paymentMethod: configToSave.cleanerPaymentMethod || 'Account Transfer',
              accountNo: configToSave.cleanerAccountNo || '',
              bankName: configToSave.cleanerBankName || '',
              cleanerName: configToSave.cleanerName,
              workingDays: configToSave.cleanerWorkingDays || 30,
              paidTo: configToSave.cleanerName || 'Cleaner Staff',
              createdAt: Date.now()
            });
          }
        }

        // 3. Telephone
        if (configToSave.telephoneEnabled) {
          const amt = configToSave.telephoneAmount || 1500;
          const existingTel = updatedList.find(e => isSameExpenseSlot(e, bId, targetFiscalYear, effectiveMonth, 'telephone_bill'));
          if (existingTel) {
            updatedList = updatedList.filter(e => !isSameExpenseSlot(e, bId, targetFiscalYear, effectiveMonth, 'telephone_bill'));
            const detId = getDeterministicExpenseId('telephone_bill', bId, targetFiscalYear, effectiveMonth);
            updatedList.push({
              ...existingTel,
              id: detId,
              branchId: bId,
              fiscalYear: targetFiscalYear,
              month: effectiveMonth,
              category: 'telephone_bill',
              amount: amt,
              netPaidAmount: amt,
              paymentMethod: configToSave.telephonePaymentMethod || 'Account Transfer',
              accountNo: configToSave.telephoneAccountNo || '',
              remarks: configToSave.telephoneRemark || '',
              createdAt: Date.now()
            });
          }
        }

        // 4. Khaja
        if (configToSave.khajaEnabled) {
          const amt = configToSave.khajaMonthlyAmount || 5000;
          const existingKhj = updatedList.find(e => isSameExpenseSlot(e, bId, targetFiscalYear, effectiveMonth, 'khaja_kharch'));
          if (existingKhj) {
            updatedList = updatedList.filter(e => !isSameExpenseSlot(e, bId, targetFiscalYear, effectiveMonth, 'khaja_kharch'));
            const detId = getDeterministicExpenseId('khaja_kharch', bId, targetFiscalYear, effectiveMonth);
            updatedList.push({
              ...existingKhj,
              id: detId,
              branchId: bId,
              fiscalYear: targetFiscalYear,
              month: effectiveMonth,
              category: 'khaja_kharch',
              amount: amt,
              netPaidAmount: amt,
              paymentMethod: configToSave.khajaPaymentMethod || 'Cash',
              itemsDescription: configToSave.khajaRemark || configToSave.khajaDescription || 'Office refreshments',
              remarks: configToSave.khajaRemark || configToSave.khajaDescription || '',
              createdAt: Date.now()
            });
          }
        }
      }

      // Enforce strict deduplication: ek month ma ekpatak matrai hune ho
      const dedupedList = deduplicateExpenses(updatedList);
      await storageService.saveAllOfficeExpenses(dedupedList);

      // Close modal immediately upon saving
      onClose();
    } catch (e: any) {
      alert('Error saving fixed expenses: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[7000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <Settings size={16} className="text-emerald-400" />
            <h3 className="font-black text-xs sm:text-sm uppercase tracking-wide">
              Fixed Exp Setup
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/90 px-4 pt-1.5 space-x-1 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('rent')}
            className={`px-4 py-2 rounded-t-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'rent'
                ? 'bg-white text-blue-700 border-t-2 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Home size={14} className="text-blue-600" />
            <span>1. House Rent</span>
          </button>
          <button
            onClick={() => setActiveTab('cleaner')}
            className={`px-4 py-2 rounded-t-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'cleaner'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles size={14} className="text-emerald-600" />
            <span>2. Cleaner Payment</span>
          </button>
          <button
            onClick={() => setActiveTab('telecom')}
            className={`px-4 py-2 rounded-t-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'telecom'
                ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PhoneCall size={14} className="text-indigo-600" />
            <span>3. Telephone & Internet</span>
          </button>
          <button
            onClick={() => setActiveTab('khaja')}
            className={`px-4 py-2 rounded-t-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'khaja'
                ? 'bg-white text-orange-700 border-t-2 border-orange-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coffee size={14} className="text-orange-600" />
            <span>4. Refreshment & Snacks</span>
          </button>
        </div>

        {/* Scrollable Body: Form Top + Table Bottom */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          
          {/* TAB 1: HOUSE RENT */}
          {activeTab === 'rent' && (
            <div className="space-y-2">
              
              {/* Branch Selection Bar */}
              <div className="flex flex-wrap items-center justify-between bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200 gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-blue-950">Branch:</span>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="h-7.5 bg-white border border-blue-300 rounded-md px-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <DayEndFieldset branchId={selectedBranchId}>
                <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentConfig.rentEnabled ?? true}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, rentEnabled: e.target.checked })}
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span>Include House Rent in monthly auto-generation</span>
                </label>
                </DayEndFieldset>
              </div>
              <DayEndFieldset branchId={selectedBranchId} className="space-y-2">

              {/* Row 1: Landlord Name & PAN/VAT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Landlord Name</label>
                  <input
                    type="text"
                    value={currentConfig.landlordName || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, landlordName: e.target.value })}
                    placeholder="e.g. paltu sah"
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">PAN / VAT No.</label>
                  <input
                    type="text"
                    value={currentConfig.landlordPan || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, landlordPan: e.target.value })}
                    placeholder="3012020"
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs font-mono font-medium text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Gross Rent, TDS Rate, Net Paid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50/90 p-2 rounded-lg border border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-800 mb-0.5 block">Gross Rent (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentConfig.rentAmount || 0}
                    onChange={(e) => handleRentGrossChange(parseFloat(e.target.value) || 0)}
                    placeholder="20166.67"
                    className="w-full h-7.5 bg-white border border-slate-300 rounded-md px-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="text-[11px] font-bold text-rose-800 block">TDS Rate (%)</label>
                    <span className="text-[10px] font-mono text-rose-600 font-semibold">
                      TDS: Rs. {((currentConfig.rentAmount || 0) * ((currentConfig.rentTdsRate !== undefined ? currentConfig.rentTdsRate : 10) / 100)).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={currentConfig.rentTdsRate !== undefined ? currentConfig.rentTdsRate : 10}
                    onChange={(e) => handleRentTdsChange(parseFloat(e.target.value) || 0)}
                    placeholder="10"
                    className="w-full h-7.5 bg-white border border-rose-300 rounded-md px-2 text-xs font-mono font-bold text-rose-800 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-emerald-800 mb-0.5 block">Net Paid Amount (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentConfig.rentNetPaid || 0}
                    onChange={(e) => handleRentNetChange(parseFloat(e.target.value) || 0)}
                    placeholder="18150"
                    className="w-full h-7.5 bg-white border border-emerald-400 rounded-md px-2 text-xs font-mono font-bold text-emerald-900 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 3: Payment Mode, Account Number, Bank Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Payment Mode</label>
                  <select
                    value={currentConfig.rentPaymentMethod || 'Account Transfer'}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, rentPaymentMethod: e.target.value })}
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2 text-xs font-bold text-slate-900 outline-none focus:bg-white"
                  >
                    <option value="Account Transfer">Account Transfer</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="ConnectIPS">ConnectIPS</option>
                    <option value="E-Sewa">E-Sewa</option>
                    <option value="Khalti">Khalti</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-blue-900 mb-0.5 block">Account Number</label>
                  <input
                    type="text"
                    value={currentConfig.rentAccountNo || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, rentAccountNo: e.target.value })}
                    placeholder="0066002106000002512"
                    className="w-full h-7.5 bg-blue-50/40 border border-blue-300 rounded-md px-2 text-xs font-mono font-bold text-slate-900 focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Bank Name (Optional)</label>
                  <input
                    type="text"
                    value={currentConfig.rentBankName || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, rentBankName: e.target.value })}
                    placeholder="e.g. NIC Asia Bank"
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2 text-xs font-medium text-slate-900 focus:bg-white outline-none"
                  />
                </div>
              </div>
              </DayEndFieldset>

            </div>
          )}

          {/* TAB 2: CLEANER PAYMENT */}
          {activeTab === 'cleaner' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between bg-emerald-50/80 px-3 py-1.5 rounded-lg border border-emerald-200 gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-emerald-950">Branch:</span>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="h-7.5 bg-white border border-emerald-300 rounded-md px-2 text-xs font-bold text-slate-900 outline-none"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
                <DayEndFieldset branchId={selectedBranchId}>
                <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentConfig.cleanerEnabled ?? true}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, cleanerEnabled: e.target.checked })}
                    className="w-3.5 h-3.5 text-emerald-600 rounded"
                  />
                  <span>Include Cleaner Payment in monthly auto-generation</span>
                </label>
                </DayEndFieldset>
              </div>
              <DayEndFieldset branchId={selectedBranchId} className="space-y-2">

              {/* Row 1: Staff / Cleaner Name & Working Days */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Staff / Cleaner Name</label>
                  <input
                    type="text"
                    value={currentConfig.cleanerName || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, cleanerName: e.target.value })}
                    placeholder="e.g. Sita Devi Mandal"
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Working Days / Month</label>
                  <input
                    type="number"
                    value={currentConfig.cleanerWorkingDays || 30}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, cleanerWorkingDays: parseInt(e.target.value) || 30 })}
                    placeholder="30"
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs font-mono font-medium text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 2: Gross Paid, TDS Rate, Net Paid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50/90 p-2 rounded-lg border border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-800 mb-0.5 block">Gross Paid / Remuneration (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentConfig.cleanerAmount || 0}
                    onChange={(e) => handleCleanerGrossChange(parseFloat(e.target.value) || 0)}
                    placeholder="2020.20"
                    className="w-full h-7.5 bg-white border border-slate-300 rounded-md px-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="text-[11px] font-bold text-rose-800 block">TDS Rate (%)</label>
                    <span className="text-[10px] font-mono text-rose-600 font-semibold">
                      TDS: Rs. {((currentConfig.cleanerAmount || 0) * ((currentConfig.cleanerTdsRate || 0) / 100)).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={currentConfig.cleanerTdsRate ?? 0}
                    onChange={(e) => handleCleanerTdsChange(parseFloat(e.target.value) || 0)}
                    placeholder="0 or 1.5"
                    className="w-full h-7.5 bg-white border border-rose-300 rounded-md px-2 text-xs font-mono font-bold text-rose-800 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-emerald-800 mb-0.5 block">Net Paid Amount (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentConfig.cleanerNetPaid ?? (currentConfig.cleanerAmount || 0)}
                    onChange={(e) => handleCleanerNetChange(parseFloat(e.target.value) || 0)}
                    placeholder="2000"
                    className="w-full h-7.5 bg-white border border-emerald-400 rounded-md px-2 text-xs font-mono font-bold text-emerald-900 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 3: Payment Mode, Account Number, Bank Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Payment Mode</label>
                  <select
                    value={currentConfig.cleanerPaymentMethod || 'Account Transfer'}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, cleanerPaymentMethod: e.target.value })}
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2 text-xs font-bold text-slate-900 outline-none focus:bg-white"
                  >
                    <option value="Account Transfer">Account Transfer</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="ConnectIPS">ConnectIPS</option>
                    <option value="E-Sewa">E-Sewa</option>
                    <option value="Khalti">Khalti</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-emerald-900 mb-0.5 block">Account Number</label>
                  <input
                    type="text"
                    value={currentConfig.cleanerAccountNo || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, cleanerAccountNo: e.target.value })}
                    placeholder="e.g. 0066002106000002512"
                    className="w-full h-7.5 bg-emerald-50/40 border border-emerald-300 rounded-md px-2 text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Bank Name (Optional)</label>
                  <input
                    type="text"
                    value={currentConfig.cleanerBankName || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, cleanerBankName: e.target.value })}
                    placeholder="e.g. Global IME Bank"
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2 text-xs font-medium text-slate-900 outline-none focus:bg-white"
                  />
                </div>
              </div>
              </DayEndFieldset>
            </div>
          )}

          {/* TAB 3: TELEPHONE & INTERNET (Service Provider & Account No removed as requested) */}
          {activeTab === 'telecom' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-200 gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-indigo-950">Branch:</span>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="h-7.5 bg-white border border-indigo-300 rounded-md px-2 text-xs font-bold text-slate-900 outline-none"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
                <DayEndFieldset branchId={selectedBranchId}>
                <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentConfig.telephoneEnabled ?? true}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, telephoneEnabled: e.target.checked })}
                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                  />
                  <span>Include Telephone / Internet in monthly auto-generation</span>
                </label>
                </DayEndFieldset>
              </div>
              <DayEndFieldset branchId={selectedBranchId} className="space-y-2">

              {/* Amount & Remark */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Amount (Rs.)</label>
                  <input
                    type="number"
                    value={currentConfig.telephoneAmount || 0}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, telephoneAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="1500"
                    className="w-full h-7.5 bg-white border border-indigo-300 rounded-md px-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Remark</label>
                  <input
                    type="text"
                    value={currentConfig.telephoneRemark || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, telephoneRemark: e.target.value })}
                    placeholder="e.g. Monthly landline & high-speed FTTH internet bill"
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>
              </DayEndFieldset>
            </div>
          )}

          {/* TAB 4: REFRESHMENT & SNACKS */}
          {activeTab === 'khaja' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between bg-orange-50/80 px-3 py-1.5 rounded-lg border border-orange-200 gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-orange-950">Branch:</span>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="h-7.5 bg-white border border-orange-300 rounded-md px-2 text-xs font-bold text-slate-900 outline-none"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
                <DayEndFieldset branchId={selectedBranchId}>
                <label className="text-xs font-bold text-orange-900 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentConfig.khajaEnabled ?? true}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, khajaEnabled: e.target.checked })}
                    className="w-3.5 h-3.5 text-orange-600 rounded"
                  />
                  <span>Include Refreshment in monthly auto-generation</span>
                </label>
                </DayEndFieldset>
              </div>
              <DayEndFieldset branchId={selectedBranchId} className="space-y-2">

              {/* Amount & Remark */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Amount (Rs.)</label>
                  <input
                    type="number"
                    value={currentConfig.khajaMonthlyAmount || 0}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, khajaMonthlyAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="5000"
                    className="w-full h-7.5 bg-white border border-orange-300 rounded-md px-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-orange-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">Remark</label>
                  <input
                    type="text"
                    value={currentConfig.khajaRemark || currentConfig.khajaDescription || ''}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, khajaRemark: e.target.value, khajaDescription: e.target.value })}
                    placeholder="e.g. Daily office refreshments & meeting tea/snacks"
                    className="w-full h-7.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>
              </DayEndFieldset>
            </div>
          )}

          {/* TABLE SECTION WITH OK BUTTON HEADER */}
          <div className="pt-2">
            <div className="flex items-center justify-between pb-1.5">
              <div className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 size={13} className="text-slate-600" />
                <span>
                  {activeTab === 'rent' && 'Configured House Rent Summary'}
                  {activeTab === 'cleaner' && 'Configured Cleaner Payment Summary'}
                  {activeTab === 'telecom' && 'Configured Telephone & Internet Summary'}
                  {activeTab === 'khaja' && 'Configured Refreshment & Snacks Summary'}
                </span>
              </div>

              {/* OK Button replacing 'Click any row' as requested */}
              <div className="flex items-center space-x-2">
                {okFeedback && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded animate-in fade-in duration-200">
                    {okFeedback}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleApplyCurrentBranch}
                  disabled={isDayEnded}
                  className="h-7 px-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-xs font-black transition-all shadow-xs cursor-pointer flex items-center space-x-1"
                  title={isDayEnded ? getDayEndedBlockMessage() : "Update this branch's data into the summary table below"}
                >
                  <Check size={13} className="stroke-[3]" />
                  <span>OK</span>
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2 px-2.5 text-center w-12">S.N.</th>
                    
                    {activeTab === 'rent' && (
                      <>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Branch</th>
                        <th className="py-2 px-3">Account No</th>
                        <th className="py-2 px-3 text-right">Rent Exp</th>
                        <th className="py-2 px-3 text-right">Rent Tax</th>
                        <th className="py-2 px-3 text-right">Net Rent</th>
                      </>
                    )}

                    {activeTab === 'cleaner' && (
                      <>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Branch</th>
                        <th className="py-2 px-3">Account No</th>
                        <th className="py-2 px-3 text-right">Gross Paid</th>
                        <th className="py-2 px-3 text-right">TDS</th>
                        <th className="py-2 px-3 text-right">Net Paid</th>
                      </>
                    )}

                    {activeTab === 'telecom' && (
                      <>
                        <th className="py-2 px-3">Branch</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Remark</th>
                      </>
                    )}

                    {activeTab === 'khaja' && (
                      <>
                        <th className="py-2 px-3">Branch</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Remark</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {branches.map((b, idx) => {
                    const cfg = configs[b.id] || (b.id === selectedBranchId ? currentConfig : null);
                    const isCurrent = b.id === selectedBranchId;
                    
                    if (activeTab === 'rent') {
                      const name = cfg?.landlordName || '-';
                      const accNo = cfg?.rentAccountNo || '-';
                      const rentExp = cfg?.rentAmount ? `Rs. ${cfg.rentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                      const taxAmt = (cfg?.rentAmount && cfg?.rentNetPaid) ? (cfg.rentAmount - cfg.rentNetPaid) : ((cfg?.rentAmount || 0) * 0.1);
                      const rentTax = cfg?.rentAmount ? `Rs. ${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                      const netRent = cfg?.rentNetPaid ? `Rs. ${cfg.rentNetPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

                      return (
                        <tr
                          key={b.id}
                          onClick={() => handleBranchChange(b.id)}
                          className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                            isCurrent ? 'bg-blue-50/30 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 text-slate-900 font-bold">
                            {name !== '-' ? name : <span className="text-slate-400 italic">Not set</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {b.name} <span className="text-slate-400 text-[10px]">({b.code})</span>
                          </td>
                          <td className="py-2 px-3 font-mono text-blue-700 text-[11px]">
                            {accNo}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">
                            {rentExp}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-rose-600">
                            {rentTax}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">
                            {netRent}
                          </td>
                        </tr>
                      );
                    }

                    if (activeTab === 'cleaner') {
                      const name = cfg?.cleanerName || '-';
                      const accNo = cfg?.cleanerAccountNo || '-';
                      const grossVal = cfg?.cleanerAmount || 0;
                      const taxRate = cfg?.cleanerTdsRate || 0;
                      const taxVal = grossVal > 0 && taxRate > 0 ? parseFloat(((grossVal * taxRate) / 100).toFixed(2)) : (grossVal && cfg?.cleanerNetPaid !== undefined && grossVal > cfg.cleanerNetPaid ? parseFloat((grossVal - cfg.cleanerNetPaid).toFixed(2)) : 0);
                      const netVal = cfg?.cleanerNetPaid !== undefined ? cfg.cleanerNetPaid : parseFloat((grossVal - taxVal).toFixed(2));

                      const grossStr = grossVal ? `Rs. ${grossVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                      const taxStr = taxVal > 0 ? `Rs. ${taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs. 0.00';
                      const netStr = netVal ? `Rs. ${netVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

                      return (
                        <tr
                          key={b.id}
                          onClick={() => handleBranchChange(b.id)}
                          className={`hover:bg-emerald-50/50 cursor-pointer transition-colors ${
                            isCurrent ? 'bg-emerald-50/30 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 text-slate-900 font-bold">
                            {name !== '-' ? name : <span className="text-slate-400 italic">Not set</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {b.name} <span className="text-slate-400 text-[10px]">({b.code})</span>
                          </td>
                          <td className="py-2 px-3 font-mono text-emerald-700 text-[11px]">
                            {accNo}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">
                            {grossStr}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-rose-600">
                            {taxStr}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">
                            {netStr}
                          </td>
                        </tr>
                      );
                    }

                    if (activeTab === 'telecom') {
                      const amount = cfg?.telephoneAmount ? `Rs. ${cfg.telephoneAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                      const remark = cfg?.telephoneRemark || '-';

                      return (
                        <tr
                          key={b.id}
                          onClick={() => handleBranchChange(b.id)}
                          className={`hover:bg-indigo-50/50 cursor-pointer transition-colors ${
                            isCurrent ? 'bg-indigo-50/30 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 text-slate-900 font-bold">
                            {b.name} <span className="text-slate-400 text-[10px]">({b.code})</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-900 font-bold">
                            {amount}
                          </td>
                          <td className="py-2 px-3 text-slate-700 text-xs">
                            {remark !== '-' ? remark : <span className="text-slate-400 italic">No remark</span>}
                          </td>
                        </tr>
                      );
                    }

                    // Khaja / Refreshment Summary Table: S.N. | Branch | Amount | Remark
                    const budget = cfg?.khajaMonthlyAmount ? `Rs. ${cfg.khajaMonthlyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                    const remark = cfg?.khajaRemark || cfg?.khajaDescription || '-';

                    return (
                      <tr
                        key={b.id}
                        onClick={() => handleBranchChange(b.id)}
                        className={`hover:bg-orange-50/50 cursor-pointer transition-colors ${
                          isCurrent ? 'bg-orange-50/30 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 text-slate-900 font-bold">
                          {b.name} <span className="text-slate-400 text-[10px]">({b.code})</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 font-bold">
                          {budget}
                        </td>
                        <td className="py-2 px-3 text-slate-700 text-xs">
                          {remark !== '-' ? remark : <span className="text-slate-400 italic">No remark</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer Actions (Save & Close) */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-end space-x-2 shrink-0">
          <button
            onClick={onClose}
            className="h-8 px-3 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving || isDayEnded}
            title={isDayEnded ? getDayEndedBlockMessage() : undefined}
            className="h-8 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
          >
            <CheckCircle2 size={14} className="text-white" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
