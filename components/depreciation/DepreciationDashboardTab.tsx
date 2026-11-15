import React, { useMemo } from 'react';
import {
  Coins,
  Layers,
  TrendingDown,
  Wallet
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { DepreciationStoreData } from '../../services/depreciationService';

interface DepreciationDashboardTabProps {
  store: DepreciationStoreData;
  isDayEnded: boolean;
  onNavigateTab: (tab: 'dashboard' | 'assets' | 'depreciation' | 'accounting' | 'reports' | 'settings', subSection?: string) => void;
}

const CHART_COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#059669', '#dc2626'];

export const DepreciationDashboardTab: React.FC<DepreciationDashboardTabProps> = ({
  store,
  onNavigateTab
}) => {
  const { assets, entries, categories, settings } = store;

  const metrics = useMemo(() => {
    const activeAssets = assets.filter(a => a.status === 'Active');
    const totalFixedAssets = activeAssets.length;
    const totalPurchaseValue = activeAssets.reduce((sum, a) => sum + Number(a.purchaseValue || 0), 0);
    const accumulatedDepreciation = activeAssets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation || 0), 0);
    const netBookValue = activeAssets.reduce((sum, a) => sum + Number(a.netBookValue || 0), 0);
    const currentYearDepreciation = entries
      .filter(e => e.financialYear === settings.currentFinancialYear)
      .reduce((sum, e) => sum + Number(e.depreciationAmount || 0), 0);

    return {
      totalFixedAssets,
      totalPurchaseValue,
      currentYearDepreciation,
      accumulatedDepreciation,
      netBookValue
    };
  }, [assets, entries, settings.currentFinancialYear]);

  const categoryChartData = useMemo(() => {
    return categories.map(cat => {
      const catAssets = assets.filter(a => a.categoryId === cat.id && a.status === 'Active');
      const purchase = catAssets.reduce((s, a) => s + Number(a.purchaseValue || 0), 0);
      const accumulated = catAssets.reduce((s, a) => s + Number(a.accumulatedDepreciation || 0), 0);
      const netBook = catAssets.reduce((s, a) => s + Number(a.netBookValue || 0), 0);
      return {
        name: cat.name.length > 18 ? `${cat.name.slice(0, 16)}..` : cat.name,
        fullName: cat.name,
        count: catAssets.length,
        purchaseValue: purchase,
        accumulatedDepreciation: accumulated,
        netBookValue: netBook
      };
    });
  }, [categories, assets]);

  const branchChartData = useMemo(() => {
    const map = new Map<string, { name: string; purchaseValue: number; netBookValue: number; count: number }>();
    assets
      .filter(a => a.status === 'Active')
      .forEach(a => {
        const key = a.branchName || a.branchId || 'Head Office';
        const existing = map.get(key) || { name: key, purchaseValue: 0, netBookValue: 0, count: 0 };
        existing.purchaseValue += Number(a.purchaseValue || 0);
        existing.netBookValue += Number(a.netBookValue || 0);
        existing.count += 1;
        map.set(key, existing);
      });
    return Array.from(map.values());
  }, [assets]);

  const formatNpr = (val: number) => `NPR ${Math.round(val).toLocaleString()}`;

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Depreciation &amp; Fixed Assets Overview</h2>
      </div>

      {/* 5 Core KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('assets', 'register')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Fixed Assets</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            {metrics.totalFixedAssets}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reports', 'purchase')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Purchase Value</span>
            <Coins className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-2 font-mono tabular-nums">
            {formatNpr(metrics.totalPurchaseValue)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('depreciation', 'records')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Current Year Depreciation</span>
            <TrendingDown className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-700 mt-2 font-mono tabular-nums">
            {formatNpr(metrics.currentYearDepreciation)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reports', 'accumulated')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Accumulated Depreciation</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg font-bold text-rose-700 mt-2 font-mono tabular-nums">
            {formatNpr(metrics.accumulatedDepreciation)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reports', 'nbv')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Net Book Value</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-700 mt-2 font-mono tabular-nums">
            {formatNpr(metrics.netBookValue)}
          </div>
        </button>
      </div>

      {/* Category-wise and Branch-wise Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Category-wise Chart */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Category-wise Asset Value &amp; Depreciation</h3>
          </div>
          {assets.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-lg p-6">
              <p className="text-xs font-semibold text-slate-500">No fixed asset allocation yet</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip formatter={(val: number | string | undefined) => [`NPR ${(Number(val) || 0).toLocaleString()}`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="purchaseValue" name="Purchase Value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="accumulatedDepreciation" name="Accumulated Dep." fill="#dc2626" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netBookValue" name="Net Book Value" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Branch-wise Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Branch-wise Net Book Value</h3>
          </div>
          {branchChartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-lg p-6">
              <p className="text-xs font-semibold text-slate-500">No branch asset allocation yet</p>
            </div>
          ) : (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={branchChartData}
                      dataKey="netBookValue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {branchChartData.map((_, idx) => (
                        <Cell key={`branch-cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number | string | undefined) => [`NPR ${(Number(val) || 0).toLocaleString()}`, 'Net Book Value']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                {branchChartData.map((b, idx) => (
                  <div key={b.name} className="flex items-center justify-between">
                    <span className="text-slate-700 font-medium flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="truncate">{b.name} ({b.count})</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                      NPR {Math.round(b.netBookValue).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Operational Summary Table */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Recent Fixed Asset Entries</h3>
        </div>
        {assets.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No fixed asset records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2 pr-3">Asset Code</th>
                  <th className="py-2 px-3">Asset Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Branch</th>
                  <th className="py-2 px-3">Method</th>
                  <th className="py-2 px-3 text-right">Purchase Value</th>
                  <th className="py-2 px-3 text-right">Accumulated Dep.</th>
                  <th className="py-2 pl-3 text-right">Net Book Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.slice(0, 8).map(asset => (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-mono font-bold text-slate-800">{asset.assetCode}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{asset.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{asset.categoryName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{asset.branchName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{asset.method} ({asset.depreciationRate}%)</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                      NPR {Math.round(asset.purchaseValue).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700">
                      NPR {Math.round(asset.accumulatedDepreciation).toLocaleString()}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                      NPR {Math.round(asset.netBookValue).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
