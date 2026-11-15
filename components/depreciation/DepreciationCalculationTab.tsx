import React, { useState, useMemo } from 'react';
import { Calculator, Calendar, CheckCircle2 } from 'lucide-react';
import {
  DepreciationMethod,
  DepreciationPeriodType,
  DepreciationStoreData,
  calculatePeriodDepreciation,
  depreciationService,
  generateAssetSchedule
} from '../../services/depreciationService';
import { Branch } from '../../types';
import { DayEndFieldset } from '../DayEndFieldset';
import { getDayEndedBlockMessage } from '../../utils/dayEndLock';

interface DepreciationCalculationTabProps {
  store: DepreciationStoreData;
  branches: Branch[];
  actorName: string;
  isDayEnded: boolean;
  initialSubSection?: string;
  onStoreUpdated: (updated: DepreciationStoreData) => void;
}

type DepSubView = 'calculate' | 'schedule' | 'records';

const BS_MONTHS = [
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush',
  'Magh', 'Falgun', 'Chaitra', 'Baisakh', 'Jestha', 'Ashadh'
];

export const DepreciationCalculationTab: React.FC<DepreciationCalculationTabProps> = ({
  store,
  branches,
  actorName,
  isDayEnded,
  initialSubSection,
  onStoreUpdated
}) => {
  const [subView, setSubView] = useState<DepSubView>(
    initialSubSection === 'schedule' || initialSubSection === 'records' ? initialSubSection : 'calculate'
  );

  // Batch Calculation State
  const [selectedFy, setSelectedFy] = useState(() => store.settings.currentFinancialYear || store.financialYears[0]?.label || '2083/84');
  const [periodType, setPeriodType] = useState<DepreciationPeriodType>('Monthly');
  const [monthLabel, setMonthLabel] = useState('Kartik');
  const [methodOverride, setMethodOverride] = useState<'AssetDefault' | DepreciationMethod>('AssetDefault');
  const [branchFilter, setBranchFilter] = useState('all');
  const [postVoucher, setPostVoucher] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runFeedback, setRunFeedback] = useState<string | null>(null);

  // Schedule State
  const [scheduleAssetId, setScheduleAssetId] = useState(() => store.assets[0]?.id || '');

  // Financial Year-wise Records Filters
  const [recordsFyFilter, setRecordsFyFilter] = useState('all');
  const [recordsPeriodFilter, setRecordsPeriodFilter] = useState<'all' | DepreciationPeriodType>('all');
  const [recordsBranchFilter, setRecordsBranchFilter] = useState('all');

  const activeBranches = useMemo(() => {
    if (branches && branches.length > 0) return branches;
    return [
      { id: 'main', name: 'Ratauli Head Office', code: 'C01', status: 'Active' as const, createdAt: 0 },
      { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', status: 'Active' as const, createdAt: 0 },
      { id: 'pipra', name: 'Pipra Branch', code: 'C03', status: 'Active' as const, createdAt: 0 },
      { id: 'parsa', name: 'Parsa Branch', code: 'C04', status: 'Active' as const, createdAt: 0 }
    ];
  }, [branches]);

  const eligibleAssets = useMemo(() => {
    return store.assets.filter(a => {
      if (a.status !== 'Active') return false;
      if (branchFilter !== 'all' && a.branchId !== branchFilter) return false;
      return true;
    });
  }, [store.assets, branchFilter]);

  const effectiveSelectedIds = useMemo(() => {
    if (selectedAssetIds.length > 0) {
      return selectedAssetIds.filter(id => eligibleAssets.some(a => a.id === id));
    }
    return eligibleAssets.map(a => a.id);
  }, [selectedAssetIds, eligibleAssets]);

  const previewRows = useMemo(() => {
    return eligibleAssets.map(asset => {
      const calcSelected = calculatePeriodDepreciation({
        asset,
        methodOverride: methodOverride === 'AssetDefault' ? undefined : methodOverride,
        periodType,
        roundingRule: store.settings.roundingRule
      });
      const calcSlm = calculatePeriodDepreciation({
        asset,
        methodOverride: 'SLM',
        periodType,
        roundingRule: store.settings.roundingRule
      });
      const calcWdv = calculatePeriodDepreciation({
        asset,
        methodOverride: 'WDV',
        periodType,
        roundingRule: store.settings.roundingRule
      });
      return {
        asset,
        isSelected: effectiveSelectedIds.includes(asset.id),
        slmAmount: calcSlm.depreciationAmount,
        wdvAmount: calcWdv.depreciationAmount,
        ...calcSelected
      };
    });
  }, [eligibleAssets, effectiveSelectedIds, methodOverride, periodType, store.settings.roundingRule]);

  const totalPreviewBookDep = useMemo(() => {
    return previewRows.filter(r => r.isSelected).reduce((s, r) => s + r.depreciationAmount, 0);
  }, [previewRows]);

  const totalPreviewTaxDep = useMemo(() => {
    return previewRows.filter(r => r.isSelected).reduce((s, r) => s + r.taxDepreciationAmount, 0);
  }, [previewRows]);

  const toggleAssetCheck = (assetId: string) => {
    setSelectedAssetIds(prev => {
      const base = prev.length === 0 ? eligibleAssets.map(a => a.id) : prev;
      return base.includes(assetId) ? base.filter(id => id !== assetId) : [...base, assetId];
    });
  };

  const handleRunBatch = async () => {
    if (isDayEnded) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (effectiveSelectedIds.length === 0) {
      alert('Select at least one active fixed asset to run depreciation.');
      return;
    }
    const periodLabel = periodType === 'Monthly' ? `${monthLabel} (${selectedFy})` : `Full Year (${selectedFy})`;
    const branchName = branchFilter === 'all'
      ? 'All Branches'
      : activeBranches.find(b => b.id === branchFilter)?.name || branchFilter;

    try {
      setIsRunning(true);
      const res = await depreciationService.runDepreciationBatch({
        assetIds: effectiveSelectedIds,
        financialYear: selectedFy,
        periodType,
        periodLabel,
        methodOverride,
        postVoucher,
        actorName,
        branchFilterId: branchFilter,
        branchFilterName: branchName
      });
      onStoreUpdated(res.store);
      setRunFeedback(
        `Posted ${res.createdCount} depreciation entries for ${periodLabel} totaling NPR ${res.totalDepreciation.toLocaleString()}.`
      );
      setTimeout(() => setRunFeedback(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to run depreciation batch.');
    } finally {
      setIsRunning(false);
    }
  };

  const scheduleAsset = useMemo(() => {
    return store.assets.find(a => a.id === scheduleAssetId) || store.assets[0] || null;
  }, [store.assets, scheduleAssetId]);

  const scheduleRows = useMemo(() => {
    return scheduleAsset ? generateAssetSchedule(scheduleAsset) : [];
  }, [scheduleAsset]);

  const filteredRecords = useMemo(() => {
    return store.entries.filter(e => {
      if (recordsFyFilter !== 'all' && e.financialYear !== recordsFyFilter) return false;
      if (recordsPeriodFilter !== 'all' && e.periodType !== recordsPeriodFilter) return false;
      if (recordsBranchFilter !== 'all' && e.branchId !== recordsBranchFilter) return false;
      return true;
    });
  }, [store.entries, recordsFyFilter, recordsPeriodFilter, recordsBranchFilter]);

  return (
    <div className="space-y-4">
      {/* Sub-Menu Header */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'calculate', label: 'Depreciation Calculation (SLM / WDV)' },
              { id: 'schedule', label: 'Depreciation Schedule' },
              { id: 'records', label: 'Financial Year-wise Records' }
            ] as Array<{ id: DepSubView; label: string }>
          ).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubView(item.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                subView === item.id
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {runFeedback && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>{runFeedback}</span>
          </div>
        )}
      </div>

      {/* 1. DEPRECIATION CALCULATION */}
      {subView === 'calculate' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
            <DayEndFieldset className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Financial Year</label>
                <select
                  value={selectedFy}
                  onChange={e => setSelectedFy(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-600"
                >
                  {store.financialYears.map(fy => (
                    <option key={fy.id} value={fy.label}>{fy.label} ({fy.status})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Calculation Period</label>
                <select
                  value={periodType}
                  onChange={e => setPeriodType(e.target.value as DepreciationPeriodType)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-600"
                >
                  <option value="Monthly">Monthly Calculation</option>
                  <option value="Yearly">Yearly Calculation</option>
                </select>
              </div>

              {periodType === 'Monthly' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Month</label>
                  <select
                    value={monthLabel}
                    onChange={e => setMonthLabel(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-600"
                  >
                    {BS_MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Depreciation Method</label>
                <select
                  value={methodOverride}
                  onChange={e => setMethodOverride(e.target.value as 'AssetDefault' | DepreciationMethod)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-600"
                >
                  <option value="AssetDefault">Use Asset Default (SLM/WDV)</option>
                  <option value="SLM">Straight Line Method (SLM)</option>
                  <option value="WDV">Written Down Value Method (WDV)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Scope</label>
                <select
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-600"
                >
                  <option value="all">All Branches</option>
                  {activeBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </DayEndFieldset>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Accounting Depreciation: </span>
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    NPR {Math.round(totalPreviewBookDep).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Tax Depreciation: </span>
                  <span className="font-mono font-bold text-blue-700 tabular-nums">
                    NPR {Math.round(totalPreviewTaxDep).toLocaleString()}
                  </span>
                </div>
                <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    disabled={isDayEnded}
                    checked={postVoucher}
                    onChange={e => setPostVoucher(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700"
                  />
                  <span>Auto-post Journal Voucher</span>
                </label>
              </div>

              <button
                type="button"
                disabled={isDayEnded || isRunning || eligibleAssets.length === 0}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                onClick={handleRunBatch}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{isRunning ? 'Posting...' : `Post ${periodType} Depreciation`}</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Live Calculation Preview (Accounting SLM/WDV vs Tax Depreciation)</h3>
            {previewRows.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No active fixed assets available for calculation.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2 pr-2">Select</th>
                      <th className="py-2 px-2">Asset</th>
                      <th className="py-2 px-2">Branch</th>
                      <th className="py-2 px-2">Method</th>
                      <th className="py-2 px-2 text-right">Opening NBV</th>
                      <th className="py-2 px-2 text-right">SLM ({periodType})</th>
                      <th className="py-2 px-2 text-right">WDV ({periodType})</th>
                      <th className="py-2 px-2 text-right">Book Dep.</th>
                      <th className="py-2 px-2 text-right">Tax Dep.</th>
                      <th className="py-2 pl-2 text-right">Closing NBV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map(row => (
                      <tr key={row.asset.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-2">
                          <input
                            type="checkbox"
                            disabled={isDayEnded}
                            checked={row.isSelected}
                            onChange={() => toggleAssetCheck(row.asset.id)}
                            className="rounded border-slate-300 text-emerald-700"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-mono font-bold text-slate-800 mr-1.5">{row.asset.assetCode}</span>
                          <span className="font-semibold text-slate-900">{row.asset.name}</span>
                        </td>
                        <td className="py-2.5 px-2 text-slate-600">{row.asset.branchName}</td>
                        <td className="py-2.5 px-2 font-mono">
                          {methodOverride === 'AssetDefault' ? row.asset.method : methodOverride} ({row.asset.depreciationRate}%)
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums">NPR {Math.round(row.openingValue).toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600">NPR {Math.round(row.slmAmount).toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600">NPR {Math.round(row.wdvAmount).toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-rose-700">NPR {Math.round(row.depreciationAmount).toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-blue-700">NPR {Math.round(row.taxDepreciationAmount).toLocaleString()}</td>
                        <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-bold text-emerald-700">NPR {Math.round(row.closingNetBookValue).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. DEPRECIATION SCHEDULE */}
      {subView === 'schedule' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">Full Useful-Life Depreciation Schedule</h3>
            <select
              value={scheduleAsset?.id || ''}
              onChange={e => setScheduleAssetId(e.target.value)}
              className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-emerald-600 min-w-[260px]"
            >
              {store.assets.length === 0 && <option value="">No assets registered</option>}
              {store.assets.map(a => (
                <option key={a.id} value={a.id}>{a.assetCode} - {a.name} ({a.method})</option>
              ))}
            </select>
          </div>

          {!scheduleAsset ? (
            <p className="text-xs text-slate-500 py-8 text-center">Register a fixed asset to generate its depreciation schedule.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 pr-3">Year #</th>
                    <th className="py-2.5 px-3">Financial Year</th>
                    <th className="py-2.5 px-3 text-right">Opening Book Value</th>
                    <th className="py-2.5 px-3 text-right">SLM Depreciation</th>
                    <th className="py-2.5 px-3 text-right">WDV Depreciation</th>
                    <th className="py-2.5 px-3 text-right">Applied ({scheduleAsset.method})</th>
                    <th className="py-2.5 px-3 text-right">Tax Depreciation</th>
                    <th className="py-2.5 px-3 text-right">Accumulated Dep.</th>
                    <th className="py-2.5 pl-3 text-right">Closing Book Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scheduleRows.map(row => (
                    <tr key={row.yearIndex} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono font-bold">{row.yearIndex}</td>
                      <td className="py-2.5 px-3 font-mono">{row.financialYearLabel}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">NPR {row.openingBookValue.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">NPR {row.slmDepreciation.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">NPR {row.wdvDepreciation.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-700">NPR {row.activeDepreciation.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-blue-700">NPR {row.taxDepreciation.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">NPR {row.accumulatedDepreciation.toLocaleString()}</td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-bold text-emerald-700">NPR {row.closingBookValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. FINANCIAL YEAR-WISE RECORDS */}
      {subView === 'records' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Financial Year-wise Depreciation Records</span>
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={recordsFyFilter}
                onChange={e => setRecordsFyFilter(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"
              >
                <option value="all">All Financial Years</option>
                {store.financialYears.map(fy => (
                  <option key={fy.id} value={fy.label}>{fy.label}</option>
                ))}
              </select>

              <select
                value={recordsPeriodFilter}
                onChange={e => setRecordsPeriodFilter(e.target.value as 'all' | DepreciationPeriodType)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"
              >
                <option value="all">Monthly &amp; Yearly</option>
                <option value="Monthly">Monthly Only</option>
                <option value="Yearly">Yearly Only</option>
              </select>

              <select
                value={recordsBranchFilter}
                onChange={e => setRecordsBranchFilter(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"
              >
                <option value="all">All Branches</option>
                {activeBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No posted depreciation records match the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2 pr-3">FY</th>
                    <th className="py-2 px-3">Period</th>
                    <th className="py-2 px-3">Asset</th>
                    <th className="py-2 px-3">Branch</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3 text-right">Opening NBV</th>
                    <th className="py-2 px-3 text-right">Accounting Dep.</th>
                    <th className="py-2 px-3 text-right">Tax Dep.</th>
                    <th className="py-2 pl-3 text-right">Closing NBV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono font-bold">{entry.financialYear}</td>
                      <td className="py-2.5 px-3">{entry.periodLabel}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{entry.assetCode} · {entry.assetName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{entry.branchName}</td>
                      <td className="py-2.5 px-3 font-mono">{entry.method} ({entry.rate}%)</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">NPR {Math.round(entry.openingValue).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-700">NPR {Math.round(entry.depreciationAmount).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-blue-700">NPR {Math.round(entry.taxDepreciationAmount).toLocaleString()}</td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-bold text-emerald-700">NPR {Math.round(entry.closingNetBookValue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
