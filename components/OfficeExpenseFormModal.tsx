import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Building2, AlertCircle, Zap } from 'lucide-react';
import { Branch, OfficeExpenseRecord, OfficeExpenseCategory, User } from '../types';
import { calculateElectricityBill } from '../utils/expenseHelpers';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const NEPALI_MONTHS = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

interface OfficeExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: OfficeExpenseRecord) => Promise<void>;
  editingExpense: OfficeExpenseRecord | null;
  branches: Branch[];
  currentBranchId: string;
  currentFiscalYear: string;
  currentMonth: string;
  currentDate: string;
  fiscalYearsList: string[];
  user?: User | null;
}

export const OfficeExpenseFormModal: React.FC<OfficeExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingExpense,
  branches,
  currentBranchId,
  currentFiscalYear,
  currentMonth,
  currentDate,
  fiscalYearsList,
  user
}) => {
  const [formData, setFormData] = useState<Partial<OfficeExpenseRecord>>({
    branchId: currentBranchId || branches[0]?.id || 'main',
    category: 'house_rent',
    date: currentDate,
    month: currentMonth,
    fiscalYear: currentFiscalYear,
    amount: 0, // Gross
    taxDeduction: 0, // TDS
    netPaidAmount: 0, // Net Paid
    paymentMethod: 'Bank Transfer',
    meterNo: '',
    consumerNo: '',
    previousUnit: 0,
    currentUnit: 0,
    consumedUnits: 0,
    ratePerUnit: 12,
    minDemandCharge: 0,
    rebateOrPenalty: 0,
    landlordName: '',
    panVatNo: '',
    rentPeriodFrom: '',
    rentPeriodTo: '',
    cleanerName: '',
    workingDays: 30,
    attendeesCount: 0,
    itemsDescription: '',
    phoneOrAccountNo: '',
    serviceProvider: 'Nepal Telecom',
    paidTo: '',
    voucherNo: '',
    billNo: '',
    recordedBy: user?.fullName || 'Admin',
    remarks: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [backDateError, setBackDateError] = useState<string | null>(null);
  const isDayEnded = useDayEndLock(formData.branchId || currentBranchId);

  useEffect(() => {
    setBackDateError(null);
    if (editingExpense) {
      setFormData({
        ...editingExpense,
        netPaidAmount: editingExpense.netPaidAmount ?? (editingExpense.amount - (editingExpense.taxDeduction || 0))
      });
    } else {
      setFormData({
        branchId: currentBranchId || branches[0]?.id || 'main',
        category: 'house_rent',
        date: currentDate,
        month: currentMonth,
        fiscalYear: currentFiscalYear,
        amount: 16666.67,
        taxDeduction: 1666.67,
        netPaidAmount: 15000,
        paymentMethod: 'Bank Transfer',
        meterNo: '',
        consumerNo: '',
        previousUnit: 0,
        currentUnit: 0,
        consumedUnits: 0,
        ratePerUnit: 12,
        minDemandCharge: 0,
        rebateOrPenalty: 0,
        landlordName: '',
        panVatNo: '',
        rentPeriodFrom: '',
        rentPeriodTo: '',
        cleanerName: '',
        workingDays: 30,
        attendeesCount: 0,
        itemsDescription: '',
        phoneOrAccountNo: '',
        serviceProvider: 'Nepal Telecom',
        paidTo: '',
        voucherNo: '',
        billNo: '',
        recordedBy: user?.fullName || 'Admin',
        remarks: ''
      });
    }
  }, [editingExpense, isOpen, currentBranchId, currentFiscalYear, currentMonth, currentDate, branches, user]);

  if (!isOpen) return null;

  // Calculation Handlers
  const handleNetPaidChange = (net: number) => {
    let tax = 0;
    if (formData.category === 'house_rent') {
      // 10% TDS: Gross = Net / 0.9 => TDS = Gross - Net
      tax = parseFloat(((net / 0.9) - net).toFixed(2));
    }
    const gross = parseFloat((net + tax).toFixed(2));
    setFormData(prev => ({
      ...prev,
      netPaidAmount: net,
      taxDeduction: tax,
      amount: gross
    }));
  };

  const handleTaxDeductionChange = (tax: number) => {
    const net = Number(formData.netPaidAmount) || 0;
    const gross = parseFloat((net + tax).toFixed(2));
    setFormData(prev => ({
      ...prev,
      taxDeduction: tax,
      amount: gross
    }));
  };

  const handleGrossChange = (gross: number) => {
    const tax = Number(formData.taxDeduction) || 0;
    const net = Math.max(0, parseFloat((gross - tax).toFixed(2)));
    setFormData(prev => ({
      ...prev,
      amount: gross,
      netPaidAmount: net
    }));
  };

  const handleCategoryChange = (cat: OfficeExpenseCategory) => {
    let net = Number(formData.netPaidAmount) || 0;
    let tax = 0;
    let gross = 0;

    if (cat === 'house_rent') {
      if (net === 0) net = 15000;
      tax = parseFloat(((net / 0.9) - net).toFixed(2));
      gross = parseFloat((net + tax).toFixed(2));
    } else if (cat === 'electricity_bill') {
      const prev = Number(formData.previousUnit) || 0;
      const curr = Number(formData.currentUnit) || 0;
      const consumed = Math.max(0, curr - prev);
      const rate = Number(formData.ratePerUnit) || 12;
      const bill = calculateElectricityBill(consumed, rate);
      net = bill.totalAmount;
      tax = bill.taxAmount;
      gross = bill.totalAmount;
    } else {
      tax = 0;
      gross = net;
    }

    setFormData(prev => ({
      ...prev,
      category: cat,
      taxDeduction: tax,
      netPaidAmount: net,
      amount: gross
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branchId || !formData.date) {
      alert('Please fill all required fields');
      return;
    }
    if (isDayEndedForBranch(formData.branchId)) {
      setBackDateError(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(formData.date)) {
      const msg = getBackDateBlockedMessage(formData.date);
      setBackDateError(msg);
      return;
    }
    setBackDateError(null);

    setIsSaving(true);
    const categoryLabels: Record<OfficeExpenseCategory, string> = {
      electricity_bill: 'Electricity Bill',
      house_rent: 'House Rent',
      cleaner_payment: 'Cleaner Payment',
      khaja_kharch: 'Refreshment & Snacks',
      telephone_bill: 'Telephone & Internet',
      other_expenses: 'Other Operating Expenses'
    };

    const finalRecord: OfficeExpenseRecord = {
      id: editingExpense?.id || `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      branchId: formData.branchId || 'main',
      category: formData.category || 'other_expenses',
      categoryLabel: categoryLabels[formData.category as OfficeExpenseCategory] || 'Operating Expense',
      date: formData.date || currentDate,
      month: formData.month || currentMonth,
      fiscalYear: formData.fiscalYear || currentFiscalYear,
      amount: Number(formData.amount) || 0,
      taxDeduction: Number(formData.taxDeduction) || 0,
      netPaidAmount: Number(formData.netPaidAmount) || Number(formData.amount) || 0,
      paymentMethod: formData.paymentMethod || 'Account Transfer',
      accountNo: formData.accountNo?.trim(),
      bankName: formData.bankName?.trim(),
      meterNo: formData.meterNo?.trim(),
      consumerNo: formData.consumerNo?.trim(),
      previousUnit: Number(formData.previousUnit) || 0,
      currentUnit: Number(formData.currentUnit) || 0,
      previous: Number(formData.previousUnit) || 0,
      current: Number(formData.currentUnit) || 0,
      consumedUnits: Math.max(0, (Number(formData.currentUnit) || 0) - (Number(formData.previousUnit) || 0)),
      ratePerUnit: Number(formData.ratePerUnit) || 12,
      minDemandCharge: Number(formData.minDemandCharge) || 0,
      rebateOrPenalty: Number(formData.rebateOrPenalty) || 0,
      landlordName: formData.landlordName?.trim(),
      panVatNo: formData.panVatNo?.trim(),
      rentPeriodFrom: formData.rentPeriodFrom?.trim(),
      rentPeriodTo: formData.rentPeriodTo?.trim(),
      cleanerName: formData.cleanerName?.trim(),
      workingDays: Number(formData.workingDays) || 30,
      attendeesCount: Number(formData.attendeesCount) || 0,
      itemsDescription: formData.itemsDescription?.trim(),
      phoneOrAccountNo: formData.phoneOrAccountNo?.trim(),
      serviceProvider: formData.serviceProvider?.trim(),
      paidTo: formData.paidTo?.trim(),
      voucherNo: formData.voucherNo?.trim(),
      billNo: formData.billNo?.trim(),
      recordedBy: formData.recordedBy || user?.fullName || 'Admin',
      remarks: formData.remarks?.trim(),
      createdAt: editingExpense?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    try {
      await onSave(finalRecord);
      onClose();
    } catch (err: any) {
      alert('Error saving record: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[7000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - Compact without subtitle */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 size={16} className="text-emerald-400" />
            <h3 className="font-black text-xs sm:text-sm uppercase tracking-wide">
              {editingExpense ? 'Edit Office Expense' : 'Add Office Expense'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3.5 space-y-2.5">
          {backDateError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start space-x-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{backDateError}</span>
            </div>
          )}
          
          <DayEndFieldset branchId={formData.branchId || currentBranchId} className="space-y-2.5">
          {/* Row 1: Category, Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Expense Category *</label>
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value as OfficeExpenseCategory)}
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
                required
              >
                <option value="house_rent">House Rent</option>
                <option value="electricity_bill">Electricity Bill</option>
                <option value="cleaner_payment">Cleaner Payment</option>
                <option value="khaja_kharch">Refreshment & Snacks</option>
                <option value="telephone_bill">Telephone & Internet</option>
                <option value="other_expenses">Other Operating Expenses</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Branch *</label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
                required
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date, Month, Fiscal Year */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Date (BS) *</label>
              <input
                type="text"
                value={formData.date || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                placeholder="2083/04/01"
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
                required
              >
              </input>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Month *</label>
              <select
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-bold text-slate-900 outline-none"
              >
                {NEPALI_MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Fiscal Year *</label>
              <select
                value={formData.fiscalYear}
                onChange={(e) => setFormData({ ...formData, fiscalYear: e.target.value })}
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-mono font-bold text-slate-900 outline-none"
              >
                {fiscalYearsList.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category-Specific Dynamic Fields */}
          {formData.category === 'house_rent' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-blue-900">Landlord Name</label>
                <input
                  type="text"
                  value={formData.landlordName || ''}
                  onChange={(e) => setFormData({ ...formData, landlordName: e.target.value, paidTo: e.target.value })}
                  placeholder="e.g. Ram Prasad Mandal"
                  className="w-full h-8 bg-white border border-blue-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-blue-900">PAN / VAT No.</label>
                <input
                  type="text"
                  value={formData.panVatNo || ''}
                  onChange={(e) => setFormData({ ...formData, panVatNo: e.target.value })}
                  placeholder="601234567"
                  className="w-full h-8 bg-white border border-blue-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none"
                />
              </div>
            </div>
          )}

          {formData.category === 'electricity_bill' && (() => {
            const prevU = Number(formData.previousUnit) || 0;
            const currU = Number(formData.currentUnit) || 0;
            const consumed = Math.max(0, currU - prevU);
            const rate = Number(formData.ratePerUnit) || 12;
            const bill = calculateElectricityBill(consumed, rate);

            const handleUnitsOrRateChange = (newPrev: number, newCurr: number, newRate: number) => {
              const newConsumed = Math.max(0, newCurr - newPrev);
              const newBill = calculateElectricityBill(newConsumed, newRate);
              setFormData(prev => ({
                ...prev,
                previousUnit: newPrev,
                currentUnit: newCurr,
                consumedUnits: newBill.consumedUnits,
                ratePerUnit: newBill.ratePerUnit,
                amount: newBill.totalAmount,
                netPaidAmount: newBill.totalAmount,
                taxDeduction: newBill.taxAmount
              }));
            };

            return (
              <div className="space-y-2 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-900">Prev Unit</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.previousUnit === 0 ? '' : formData.previousUnit}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                        handleUnitsOrRateChange(val, currU, rate);
                      }}
                      placeholder="0"
                      className="w-full h-7.5 bg-white border border-amber-300 rounded-lg px-2 text-xs font-mono outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-900">Curr Unit</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.currentUnit === 0 ? '' : formData.currentUnit}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                        handleUnitsOrRateChange(prevU, val, rate);
                      }}
                      placeholder="0"
                      className="w-full h-7.5 bg-white border border-amber-300 rounded-lg px-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-900">Rate / Unit (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.ratePerUnit || 12}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 12;
                        handleUnitsOrRateChange(prevU, currU, val);
                      }}
                      placeholder="12"
                      className="w-full h-7.5 bg-white border border-amber-300 rounded-lg px-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-900">Consumed</label>
                    <div className={`h-7.5 rounded-lg px-2 flex items-center justify-between text-xs font-mono font-black border ${
                      bill.consumedUnits > 50 
                        ? 'bg-amber-100 border-amber-400 text-amber-950' 
                        : 'bg-white border-amber-200 text-amber-900'
                    }`}>
                      <span>{bill.consumedUnits} u</span>
                      {bill.consumedUnits > 50 && (
                        <span className="text-[9px] bg-amber-200 px-1 py-0.2 rounded text-amber-900">&gt;50u</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-900">Meter No.</label>
                    <input
                      type="text"
                      value={formData.meterNo || ''}
                      onChange={(e) => setFormData({ ...formData, meterNo: e.target.value })}
                      placeholder="MTR-01"
                      className="w-full h-7.5 bg-white border border-amber-300 rounded-lg px-2 text-xs font-mono outline-none"
                    />
                  </div>
                </div>

                {/* Nepal Govt 5% Tax Calculation Breakdown */}
                <div className="bg-amber-100/70 border border-amber-300/80 rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center space-x-1.5 text-amber-950">
                    <Zap size={13} className="text-amber-600 fill-amber-500" />
                    <span>
                      Base Bill: <strong className="font-mono">Rs. {bill.baseAmount.toFixed(2)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {bill.consumedUnits > 50 ? (
                      <span className="text-rose-700 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                        Govt Tax (5% for &gt;50 Units): +Rs. {bill.taxAmount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-600">
                        Govt Tax: <span className="text-slate-500 font-mono">Rs. 0.00</span> (≤50 Units)
                      </span>
                    )}
                  </div>

                  <div className="text-emerald-900 font-black">
                    Total: <span className="font-mono text-xs">Rs. {bill.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {formData.category === 'cleaner_payment' && (
            <div className="grid grid-cols-2 gap-2.5 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900">Cleaner Name</label>
                <input
                  type="text"
                  value={formData.cleanerName || ''}
                  onChange={(e) => setFormData({ ...formData, cleanerName: e.target.value, paidTo: e.target.value })}
                  placeholder="e.g. Sita Devi"
                  className="w-full h-8 bg-white border border-emerald-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900">Working Days</label>
                <input
                  type="number"
                  value={formData.workingDays || 30}
                  onChange={(e) => setFormData({ ...formData, workingDays: parseInt(e.target.value) || 30 })}
                  className="w-full h-8 bg-white border border-emerald-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none"
                />
              </div>
            </div>
          )}

          {formData.category === 'telephone_bill' && (
            <div className="grid grid-cols-2 gap-2.5 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-200">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-indigo-900">Service Provider</label>
                <input
                  type="text"
                  value={formData.serviceProvider || 'Nepal Telecom'}
                  onChange={(e) => setFormData({ ...formData, serviceProvider: e.target.value, paidTo: e.target.value })}
                  className="w-full h-8 bg-white border border-indigo-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-indigo-900">Account / Phone No.</label>
                <input
                  type="text"
                  value={formData.phoneOrAccountNo || ''}
                  onChange={(e) => setFormData({ ...formData, phoneOrAccountNo: e.target.value })}
                  placeholder="044-520123"
                  className="w-full h-8 bg-white border border-indigo-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none"
                />
              </div>
            </div>
          )}

          {formData.category === 'khaja_kharch' && (
            <div className="grid grid-cols-2 gap-2.5 bg-orange-50/50 p-2.5 rounded-xl border border-orange-200">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-orange-900">Description</label>
                <input
                  type="text"
                  value={formData.itemsDescription || ''}
                  onChange={(e) => setFormData({ ...formData, itemsDescription: e.target.value })}
                  placeholder="Daily office tea & snacks"
                  className="w-full h-8 bg-white border border-orange-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-orange-900">Paid To / Vendor</label>
                <input
                  type="text"
                  value={formData.paidTo || ''}
                  onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                  placeholder="Local Vendor"
                  className="w-full h-8 bg-white border border-orange-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none"
                />
              </div>
            </div>
          )}

          {/* Financial Amounts: Net Paid -> Tax -> Gross Amount */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-emerald-800">Net Paid Amount *</label>
              <input
                type="number"
                step="any"
                value={formData.netPaidAmount || ''}
                onChange={(e) => handleNetPaidChange(parseFloat(e.target.value) || 0)}
                placeholder="15000"
                className="w-full h-8.5 bg-white border border-emerald-500 rounded-lg px-2.5 text-xs font-mono font-black text-emerald-950 outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-rose-800">TDS / Tax Deducted</label>
              <input
                type="number"
                step="any"
                value={formData.taxDeduction || ''}
                onChange={(e) => handleTaxDeductionChange(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-8.5 bg-white border border-rose-300 rounded-lg px-2.5 text-xs font-mono font-bold text-rose-800 outline-none focus:ring-1 focus:ring-rose-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-800">Gross Amount *</label>
              <input
                type="number"
                step="any"
                value={formData.amount || ''}
                onChange={(e) => handleGrossChange(parseFloat(e.target.value) || 0)}
                placeholder="16666.67"
                className="w-full h-8.5 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-mono font-black text-slate-900 outline-none focus:ring-1 focus:ring-slate-500"
                required
              />
            </div>
          </div>

          {/* Payment Mode, Account No, Bank Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Payment Mode</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-bold text-slate-900 outline-none"
              >
                <option value="Account Transfer">Account Transfer</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="ConnectIPS">ConnectIPS</option>
                <option value="Esewa">eSewa</option>
                <option value="Khalti">Khalti</option>
              </select>
            </div>

            {(formData.paymentMethod === 'Account Transfer' || formData.paymentMethod === 'Bank Transfer') ? (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Account Number</label>
                  <input
                    type="text"
                    value={formData.accountNo || ''}
                    onChange={(e) => setFormData({ ...formData, accountNo: e.target.value })}
                    placeholder="e.g. 01234567890123"
                    className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName || ''}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g. Global IME Bank"
                    className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Voucher No.</label>
                  <input
                    type="text"
                    value={formData.voucherNo || ''}
                    onChange={(e) => setFormData({ ...formData, voucherNo: e.target.value })}
                    placeholder="V-102"
                    className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Bill / Receipt No.</label>
                  <input
                    type="text"
                    value={formData.billNo || ''}
                    onChange={(e) => setFormData({ ...formData, billNo: e.target.value })}
                    placeholder="B-943"
                    className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
              </>
            )}
          </div>

          {(formData.paymentMethod === 'Account Transfer' || formData.paymentMethod === 'Bank Transfer') && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Voucher No.</label>
                <input
                  type="text"
                  value={formData.voucherNo || ''}
                  onChange={(e) => setFormData({ ...formData, voucherNo: e.target.value })}
                  placeholder="V-102"
                  className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Bill / Receipt No.</label>
                <input
                  type="text"
                  value={formData.billNo || ''}
                  onChange={(e) => setFormData({ ...formData, billNo: e.target.value })}
                  placeholder="B-943"
                  className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs font-mono text-slate-900 outline-none"
                />
              </div>
            </div>
          )}

          {/* Row 5: Remarks */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">Remarks</label>
            <input
              type="text"
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Any additional information..."
              className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none focus:bg-white"
            />
          </div>
          </DayEndFieldset>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-200 flex justify-end items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              <span>{isSaving ? 'Saving...' : (editingExpense ? 'Update Expense' : 'Save Expense')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
