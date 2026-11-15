import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Edit3,
  Layers,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react';
import {
  AssetCategory,
  DepreciationFinancialYear,
  DepreciationMethod,
  DepreciationSettings,
  DepreciationStoreData,
  depreciationService
} from '../../services/depreciationService';
import { Branch, Role } from '../../types';
import { DayEndFieldset } from '../DayEndFieldset';
import { getDayEndedBlockMessage } from '../../utils/dayEndLock';

interface DepreciationSettingsTabProps {
  store: DepreciationStoreData;
  branches: Branch[];
  roles: Role[];
  actorName: string;
  isDayEnded: boolean;
  onStoreUpdated: (updated: DepreciationStoreData) => void;
}

type SettingsSection = 'categories' | 'methods' | 'financial_year' | 'branches' | 'roles';

export const DepreciationSettingsTab: React.FC<DepreciationSettingsTabProps> = ({
  store,
  branches,
  roles,
  actorName,
  isDayEnded,
  onStoreUpdated
}) => {
  const navigate = useNavigate();
  const [section, setSection] = useState<SettingsSection>('categories');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Category Form State
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catMethod, setCatMethod] = useState<DepreciationMethod>('WDV');
  const [catRate, setCatRate] = useState('15');
  const [catTaxBlock, setCatTaxBlock] = useState<AssetCategory['taxBlock']>('Block B');
  const [catTaxRate, setCatTaxRate] = useState('25');
  const [catLife, setCatLife] = useState('5');
  const [catSalvage, setCatSalvage] = useState('5');
  const [catGlAsset, setCatGlAsset] = useState('1500 - Fixed Assets');
  const [catGlExpense, setCatGlExpense] = useState('5201 - Depreciation Expense');
  const [catGlAccum, setCatGlAccum] = useState('1590 - Accumulated Depreciation');

  // General Settings Form State
  const [settingsForm, setSettingsForm] = useState<DepreciationSettings>({ ...store.settings });

  // Financial Year Form State
  const [fyLabel, setFyLabel] = useState('2084/85');
  const [fyStartBs, setFyStartBs] = useState('2084-04-01');
  const [fyEndBs, setFyEndBs] = useState('2085-03-31');
  const [fyIsCurrent, setFyIsCurrent] = useState(false);

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCatCode('');
    setCatName('');
    setCatMethod('WDV');
    setCatRate('15');
    setCatTaxBlock('Block B');
    setCatTaxRate('25');
    setCatLife('5');
    setCatSalvage('5');
    setCatGlAsset('1500 - Fixed Assets');
    setCatGlExpense('5201 - Depreciation Expense');
    setCatGlAccum('1590 - Accumulated Depreciation');
  };

  const handleEditCategory = (cat: AssetCategory) => {
    setEditingCategoryId(cat.id);
    setCatCode(cat.code);
    setCatName(cat.name);
    setCatMethod(cat.defaultMethod);
    setCatRate(String(cat.rate));
    setCatTaxBlock(cat.taxBlock);
    setCatTaxRate(String(cat.taxRate));
    setCatLife(String(cat.usefulLifeYears));
    setCatSalvage(String(cat.salvagePercent));
    setCatGlAsset(cat.glAssetAccount);
    setCatGlExpense(cat.glExpenseAccount);
    setCatGlAccum(cat.glAccumulatedAccount);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    if (!catCode.trim() || !catName.trim()) {
      setErrorMsg('Category Code and Category Name are required.');
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const updated = await depreciationService.saveCategory(
        {
          id: editingCategoryId || undefined,
          code: catCode.trim().toUpperCase(),
          name: catName.trim(),
          defaultMethod: catMethod,
          rate: Number(catRate || 0),
          taxBlock: catTaxBlock,
          taxRate: Number(catTaxRate || 0),
          usefulLifeYears: Number(catLife || 5),
          salvagePercent: Number(catSalvage || 0),
          glAssetAccount: catGlAsset.trim(),
          glExpenseAccount: catGlExpense.trim(),
          glAccumulatedAccount: catGlAccum.trim(),
          status: 'Active'
        },
        actorName
      );
      onStoreUpdated(updated);
      resetCategoryForm();
      setFeedback('Asset category and depreciation rate saved.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to save asset category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (isDayEnded) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    setErrorMsg(null);
    setFeedback(null);
    try {
      const updated = await depreciationService.deleteCategory(id, actorName);
      onStoreUpdated(updated);
      setFeedback('Asset category removed.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to delete category.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const updated = await depreciationService.saveSettings(settingsForm, actorName);
      onStoreUpdated(updated);
      setFeedback('Depreciation methods, useful life, and salvage defaults saved.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFinancialYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    if (!fyLabel.trim()) {
      setErrorMsg('Financial Year label is required.');
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const updated = await depreciationService.saveFinancialYear(
        {
          label: fyLabel.trim(),
          startDateBs: fyStartBs.trim(),
          endDateBs: fyEndBs.trim(),
          isCurrent: fyIsCurrent,
          status: 'Open'
        },
        actorName
      );
      onStoreUpdated(updated);
      setSettingsForm(updated.settings);
      setFeedback(`Financial Year ${fyLabel} saved.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to save financial year.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetFyStatus = async (fy: DepreciationFinancialYear, changes: Partial<DepreciationFinancialYear>) => {
    if (isDayEnded) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    setErrorMsg(null);
    try {
      const updated = await depreciationService.saveFinancialYear({ ...fy, ...changes }, actorName);
      onStoreUpdated(updated);
      setSettingsForm(updated.settings);
      setFeedback(`Updated Financial Year ${fy.label}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to update financial year.');
    }
  };

  const f2 = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-2xs flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSection('categories')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            section === 'categories' ? 'bg-emerald-800 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers size={13} />
          <span>Asset Categories & Rates</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('methods')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            section === 'methods' ? 'bg-emerald-800 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <SlidersHorizontal size={13} />
          <span>Methods, Useful Life & Salvage</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('financial_year')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            section === 'financial_year' ? 'bg-emerald-800 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar size={13} />
          <span>Financial Year Management</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('branches')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            section === 'branches' ? 'bg-emerald-800 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 size={13} />
          <span>Branch Management</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('roles')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            section === 'roles' ? 'bg-emerald-800 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck size={13} />
          <span>User Roles & Permissions</span>
        </button>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-700" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {errorMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* SECTION 1: Asset Categories & Depreciation Rates */}
      {section === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingCategoryId ? 'Edit Asset Category' : 'Add Asset Category & Rate'}
            </h3>
            <form onSubmit={handleSaveCategory}>
              <DayEndFieldset isDayEnded={isDayEnded} className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Category Code</label>
                    <input
                      type="text"
                      value={catCode}
                      onChange={(e) => setCatCode(e.target.value)}
                      placeholder="e.g. FA-OFF"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Default Method</label>
                    <select
                      value={catMethod}
                      onChange={(e) => setCatMethod(e.target.value as DepreciationMethod)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                    >
                      <option value="WDV">Written Down Value (WDV)</option>
                      <option value="SLM">Straight Line Method (SLM)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Category Name</label>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="e.g. Office Equipment"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Book Depreciation Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={catRate}
                      onChange={(e) => setCatRate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Useful Life (Years)</label>
                    <input
                      type="number"
                      min={1}
                      value={catLife}
                      onChange={(e) => setCatLife(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Tax Block</label>
                    <select
                      value={catTaxBlock}
                      onChange={(e) => setCatTaxBlock(e.target.value as AssetCategory['taxBlock'])}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                    >
                      <option value="Block A">Block A</option>
                      <option value="Block B">Block B</option>
                      <option value="Block C">Block C</option>
                      <option value="Block D">Block D</option>
                      <option value="Block E">Block E</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={catTaxRate}
                      onChange={(e) => setCatTaxRate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Salvage (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={catSalvage}
                      onChange={(e) => setCatSalvage(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">GL Asset Account</label>
                  <input
                    type="text"
                    value={catGlAsset}
                    onChange={(e) => setCatGlAsset(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">GL Expense Account</label>
                    <input
                      type="text"
                      value={catGlExpense}
                      onChange={(e) => setCatGlExpense(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">GL Accumulated Dep.</label>
                    <input
                      type="text"
                      value={catGlAccum}
                      onChange={(e) => setCatGlAccum(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSaving || isDayEnded}
                    className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save size={13} />
                    <span>{editingCategoryId ? 'Update Category' : 'Save Category'}</span>
                  </button>
                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={resetCategoryForm}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </DayEndFieldset>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Configured Asset Categories</h3>
              <span className="text-xs text-slate-500">{store.categories.length} categories</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3 text-right">Book %</th>
                    <th className="py-2.5 px-3 text-right">Tax %</th>
                    <th className="py-2.5 px-3 text-right">Life</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {store.categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{cat.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{cat.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{cat.defaultMethod}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{cat.rate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{cat.taxRate}% ({cat.taxBlock})</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{cat.usefulLifeYears}y</td>
                      <td className="py-2.5 px-3 text-right space-x-1">
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => handleEditCategory(cat)}
                          className="p-1 text-slate-600 hover:text-emerald-700 disabled:opacity-40 cursor-pointer"
                          title="Edit Category"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1 text-slate-500 hover:text-rose-700 disabled:opacity-40 cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Depreciation Methods, Useful Life & Salvage Value */}
      {section === 'methods' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs max-w-3xl">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Depreciation Methods, Useful Life & Salvage Policy</h3>
          <p className="text-xs text-slate-500 mb-4">Configure default accounting rules and General Ledger voucher behavior.</p>
          <form onSubmit={handleSaveSettings}>
            <DayEndFieldset isDayEnded={isDayEnded} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Default Depreciation Method</label>
                  <select
                    value={settingsForm.defaultMethod}
                    onChange={(e) => setSettingsForm(s => ({ ...s, defaultMethod: e.target.value as DepreciationMethod }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="WDV">Written Down Value (WDV)</option>
                    <option value="SLM">Straight Line Method (SLM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Default Useful Life (Years)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settingsForm.defaultUsefulLifeYears}
                    onChange={(e) => setSettingsForm(s => ({ ...s, defaultUsefulLifeYears: Number(e.target.value || 5) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Default Salvage Value (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    value={settingsForm.defaultSalvagePercent}
                    onChange={(e) => setSettingsForm(s => ({ ...s, defaultSalvagePercent: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Rounding Rule</label>
                  <select
                    value={settingsForm.roundingRule}
                    onChange={(e) => setSettingsForm(s => ({ ...s, roundingRule: e.target.value as DepreciationSettings['roundingRule'] }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="Nearest">Round to Nearest Rupee</option>
                    <option value="Exact">Exact (2 Decimal Places)</option>
                    <option value="Floor">Round Down (Floor)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Active Financial Year</label>
                  <select
                    value={settingsForm.currentFinancialYear}
                    onChange={(e) => setSettingsForm(s => ({ ...s, currentFinancialYear: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    {store.financialYears.map(fy => (
                      <option key={fy.id} value={fy.label}>{fy.label} ({fy.status})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Default GL Asset Control</label>
                  <input
                    type="text"
                    value={settingsForm.defaultGlAssetAccount}
                    onChange={(e) => setSettingsForm(s => ({ ...s, defaultGlAssetAccount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Default GL Expense Account</label>
                  <input
                    type="text"
                    value={settingsForm.defaultGlExpenseAccount}
                    onChange={(e) => setSettingsForm(s => ({ ...s, defaultGlExpenseAccount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Default GL Accumulated Dep.</label>
                  <input
                    type="text"
                    value={settingsForm.defaultGlAccumulatedAccount}
                    onChange={(e) => setSettingsForm(s => ({ ...s, defaultGlAccumulatedAccount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.autoPostJournalVoucher}
                    onChange={(e) => setSettingsForm(s => ({ ...s, autoPostJournalVoucher: e.target.checked }))}
                    className="rounded border-slate-300 text-emerald-700"
                  />
                  <span>Automatically post Journal Vouchers on Asset Purchase, Depreciation & Disposal</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.taxComparisonEnabled}
                    onChange={(e) => setSettingsForm(s => ({ ...s, taxComparisonEnabled: e.target.checked }))}
                    className="rounded border-slate-300 text-emerald-700"
                  />
                  <span>Enable Accounting vs Income Tax Block Comparison</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving || isDayEnded}
                  className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  <span>Save Policy Settings</span>
                </button>
              </div>
            </DayEndFieldset>
          </form>
        </div>
      )}

      {/* SECTION 3: Financial Year Management */}
      {section === 'financial_year' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Create Financial Year</h3>
            <form onSubmit={handleSaveFinancialYear}>
              <DayEndFieldset isDayEnded={isDayEnded} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Financial Year Label</label>
                  <input
                    type="text"
                    value={fyLabel}
                    onChange={(e) => setFyLabel(e.target.value)}
                    placeholder="e.g. 2084/85"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Date (BS)</label>
                    <input
                      type="text"
                      value={fyStartBs}
                      onChange={(e) => setFyStartBs(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">End Date (BS)</label>
                    <input
                      type="text"
                      value={fyEndBs}
                      onChange={(e) => setFyEndBs(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fyIsCurrent}
                    onChange={(e) => setFyIsCurrent(e.target.checked)}
                  />
                  <span>Set as Active Financial Year</span>
                </label>
                <button
                  type="submit"
                  disabled={isSaving || isDayEnded}
                  className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Financial Year</span>
                </button>
              </DayEndFieldset>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Financial Years Registry</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">Financial Year</th>
                    <th className="py-2.5 px-3">Start Date (BS)</th>
                    <th className="py-2.5 px-3">End Date (BS)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Active</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {store.financialYears.map(fy => (
                    <tr key={fy.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{fy.label}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{fy.startDateBs}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{fy.endDateBs}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          fy.status === 'Open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {fy.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">{fy.isCurrent ? 'Current' : '-'}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        {!fy.isCurrent && (
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleSetFyStatus(fy, { isCurrent: true })}
                            className="px-2 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                          >
                            Set Current
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isDayEnded}
                          onClick={() => handleSetFyStatus(fy, { status: fy.status === 'Open' ? 'Closed' : 'Open' })}
                          className="px-2 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          {fy.status === 'Open' ? 'Close FY' : 'Reopen FY'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Branch Management */}
      {section === 'branches' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Branch Asset Allocation & Management</h3>
              <p className="text-[11px] text-slate-500">Overview of registered branches and their fixed asset portfolios.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/branches')}
              className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              Manage Branches
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Branch Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3 text-right">Active Assets</th>
                  <th className="py-2.5 px-3 text-right">Total Net Book Value</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map(b => {
                  const branchAssets = store.assets.filter(a => a.branchId === b.id && a.status === 'Active');
                  const nbv = branchAssets.reduce((s, a) => s + Number(a.netBookValue || 0), 0);
                  return (
                    <tr key={b.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{b.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{b.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{b.branchType || 'Branch Office'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{b.location || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{branchAssets.length}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">NPR {f2(nbv)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          b.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: User Roles & Permissions */}
      {section === 'roles' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">User Roles & Depreciation Access Permissions</h3>
              <p className="text-[11px] text-slate-500">Review system roles and configure granular view, edit, and delete access.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/roles')}
              className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              Configure Role Permissions
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Role Name</th>
                  <th className="py-2.5 px-3 text-right">Total Permissions</th>
                  <th className="py-2.5 px-3 text-right">Depreciation Permissions</th>
                  <th className="py-2.5 px-3">Access Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map(role => {
                  const perms = (role.permissions || []).map(p => String(p));
                  const depCount = perms.filter(p => p.startsWith('sub_dep_')).length;
                  const canManageSettings = perms.includes('manage_settings') || role.id === 'role_super_admin';
                  return (
                    <tr key={role.id}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{role.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">{perms.length}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{depCount}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {role.id === 'role_super_admin'
                          ? 'Full unrestricted Fixed Asset & Depreciation control'
                          : canManageSettings
                            ? 'View, Calculate, Post Vouchers & Manage Policies'
                            : 'Operational View & Standard Entry Access'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
