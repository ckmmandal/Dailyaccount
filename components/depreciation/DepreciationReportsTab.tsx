import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { FileDown, FileSpreadsheet, Printer, Search } from 'lucide-react';
import { DepreciationStoreData } from '../../services/depreciationService';
import { Branch } from '../../types';

interface DepreciationReportsTabProps {
  store: DepreciationStoreData;
  branches: Branch[];
  institutionName: string;
}

type ReportKey =
  | 'fixed_asset_register'
  | 'asset_purchase'
  | 'annual_depreciation'
  | 'accumulated_depreciation'
  | 'net_book_value'
  | 'branch_wise'
  | 'asset_disposal'
  | 'tax_depreciation';

const REPORT_DEFINITIONS: Array<{ key: ReportKey; label: string }> = [
  { key: 'fixed_asset_register', label: 'Fixed Asset Register' },
  { key: 'asset_purchase', label: 'Asset Purchase Report' },
  { key: 'annual_depreciation', label: 'Annual Depreciation Report' },
  { key: 'accumulated_depreciation', label: 'Accumulated Depreciation Report' },
  { key: 'net_book_value', label: 'Net Book Value Report' },
  { key: 'branch_wise', label: 'Branch-wise Asset Report' },
  { key: 'asset_disposal', label: 'Asset Disposal Report' },
  { key: 'tax_depreciation', label: 'Tax Depreciation Report' }
];

export const DepreciationReportsTab: React.FC<DepreciationReportsTabProps> = ({
  store,
  branches,
  institutionName
}) => {
  const [activeReport, setActiveReport] = useState<ReportKey>('fixed_asset_register');
  const [fyFilter, setFyFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const f2 = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filteredAssets = useMemo(() => {
    return store.assets.filter(a => {
      if (branchFilter !== 'all' && a.branchId !== branchFilter) return false;
      if (categoryFilter !== 'all' && a.categoryId !== categoryFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!a.assetCode.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [store.assets, branchFilter, categoryFilter, searchTerm]);

  const filteredEntries = useMemo(() => {
    return store.entries.filter(e => {
      if (fyFilter !== 'all' && e.financialYear !== fyFilter) return false;
      if (branchFilter !== 'all' && e.branchId !== branchFilter) return false;
      if (categoryFilter !== 'all' && e.categoryId !== categoryFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!e.assetCode.toLowerCase().includes(q) && !e.assetName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [store.entries, fyFilter, branchFilter, categoryFilter, searchTerm]);

  const reportDataset = useMemo<{
    title: string;
    columns: string[];
    rows: Array<Array<string | number>>;
  }>(() => {
    switch (activeReport) {
      case 'fixed_asset_register':
        return {
          title: 'Fixed Asset Register',
          columns: ['Asset Code', 'Asset Name', 'Category', 'Branch', 'Purchase Date', 'Method', 'Rate %', 'Cost (NPR)', 'Accum. Dep.', 'Net Book Value', 'Status'],
          rows: filteredAssets.map(a => [
            a.assetCode,
            a.name,
            a.categoryName,
            a.branchName,
            a.purchaseDateBs,
            a.method,
            `${a.depreciationRate}%`,
            f2(a.purchaseValue),
            f2(a.accumulatedDepreciation),
            f2(a.netBookValue),
            a.status
          ])
        };

      case 'asset_purchase':
        return {
          title: 'Asset Purchase Report',
          columns: ['Asset Code', 'Asset Name', 'Category', 'Branch', 'Purchase Date (BS)', 'Vendor', 'Invoice No', 'Purchase Cost (NPR)', 'Salvage Value'],
          rows: filteredAssets.map(a => [
            a.assetCode,
            a.name,
            a.categoryName,
            a.branchName,
            a.purchaseDateBs,
            a.vendorName || '-',
            a.invoiceNo || '-',
            f2(a.purchaseValue),
            f2(a.salvageValue)
          ])
        };

      case 'annual_depreciation':
        return {
          title: 'Annual Depreciation Report',
          columns: ['FY', 'Period', 'Asset Code', 'Asset Name', 'Branch', 'Method', 'Opening Value', 'Depreciation (NPR)', 'Closing NBV'],
          rows: filteredEntries.map(e => [
            e.financialYear,
            `${e.periodType} (${e.periodLabel})`,
            e.assetCode,
            e.assetName,
            e.branchName,
            e.method,
            f2(e.openingValue),
            f2(e.depreciationAmount),
            f2(e.closingNetBookValue)
          ])
        };

      case 'accumulated_depreciation':
        return {
          title: 'Accumulated Depreciation Report',
          columns: ['Asset Code', 'Asset Name', 'Category', 'Branch', 'Purchase Cost', 'Accumulated Dep.', 'Remaining Depreciable', 'Depreciated %'],
          rows: filteredAssets.map(a => {
            const pct = a.purchaseValue > 0 ? ((a.accumulatedDepreciation / a.purchaseValue) * 100).toFixed(1) : '0.0';
            const remaining = Math.max(0, a.netBookValue - a.salvageValue);
            return [
              a.assetCode,
              a.name,
              a.categoryName,
              a.branchName,
              f2(a.purchaseValue),
              f2(a.accumulatedDepreciation),
              f2(remaining),
              `${pct}%`
            ];
          })
        };

      case 'net_book_value':
        return {
          title: 'Net Book Value Report',
          columns: ['Asset Code', 'Asset Name', 'Category', 'Branch', 'Gross Value', 'Accumulated Dep.', 'Net Book Value', 'Salvage Value'],
          rows: filteredAssets.map(a => [
            a.assetCode,
            a.name,
            a.categoryName,
            a.branchName,
            f2(a.purchaseValue),
            f2(a.accumulatedDepreciation),
            f2(a.netBookValue),
            f2(a.salvageValue)
          ])
        };

      case 'branch_wise': {
        const byBranch = new Map<string, { name: string; count: number; cost: number; accum: number; nbv: number }>();
        filteredAssets.forEach(a => {
          const cur = byBranch.get(a.branchId) || { name: a.branchName || a.branchId, count: 0, cost: 0, accum: 0, nbv: 0 };
          cur.count += 1;
          cur.cost += Number(a.purchaseValue || 0);
          cur.accum += Number(a.accumulatedDepreciation || 0);
          cur.nbv += Number(a.netBookValue || 0);
          byBranch.set(a.branchId, cur);
        });
        return {
          title: 'Branch-wise Asset Report',
          columns: ['Branch Name', 'Asset Count', 'Total Purchase Value', 'Accumulated Depreciation', 'Net Book Value'],
          rows: Array.from(byBranch.values()).map(b => [
            b.name,
            b.count,
            f2(b.cost),
            f2(b.accum),
            f2(b.nbv)
          ])
        };
      }

      case 'asset_disposal': {
        const disposed = filteredAssets.filter(a => a.status === 'Disposed' || a.status === 'Sold');
        return {
          title: 'Asset Disposal Report',
          columns: ['Asset Code', 'Asset Name', 'Branch', 'Disposal Type', 'Disposal Date (BS)', 'Original Cost', 'Net Book Value', 'Sale Proceeds', 'Gain / Loss'],
          rows: disposed.map(a => [
            a.assetCode,
            a.name,
            a.branchName,
            a.disposalType || a.status,
            a.disposalDateBs || '-',
            f2(a.purchaseValue),
            f2(a.netBookValue),
            f2(a.saleProceeds || 0),
            f2(a.disposalGainLoss || 0)
          ])
        };
      }

      case 'tax_depreciation':
        return {
          title: 'Tax Depreciation Report',
          columns: ['FY', 'Asset Code', 'Asset Name', 'Tax Block', 'Tax Rate %', 'Accounting Dep.', 'Tax Dep. (WDV)', 'Variance'],
          rows: filteredEntries.map(e => {
            const asset = store.assets.find(a => a.id === e.assetId);
            const variance = Number(e.depreciationAmount || 0) - Number(e.taxDepreciationAmount || 0);
            return [
              e.financialYear,
              e.assetCode,
              e.assetName,
              asset?.taxBlock || '-',
              `${asset?.taxRate ?? e.rate}%`,
              f2(e.depreciationAmount),
              f2(e.taxDepreciationAmount),
              f2(variance)
            ];
          })
        };
    }
  }, [activeReport, filteredAssets, filteredEntries, store.assets]);

  const handleExportExcel = () => {
    const sheetData = [
      [institutionName],
      [reportDataset.title],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      reportDataset.columns,
      ...reportDataset.rows
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${activeReport}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 32;
    let cursorY = 38;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(institutionName || 'Fixed Asset & Depreciation System', marginX, cursorY);
    cursorY += 18;

    doc.setFontSize(11);
    doc.text(reportDataset.title, marginX, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - marginX - 150, cursorY);
    cursorY += 14;

    const colCount = reportDataset.columns.length;
    const usableWidth = pageWidth - marginX * 2;
    const colWidth = usableWidth / Math.max(1, colCount);

    const drawHeader = () => {
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, cursorY, usableWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      reportDataset.columns.forEach((col, i) => {
        const text = String(col).slice(0, 18);
        doc.text(text, marginX + i * colWidth + 4, cursorY + 13);
      });
      cursorY += 22;
    };

    drawHeader();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    if (reportDataset.rows.length === 0) {
      doc.text('No records available for the selected filters.', marginX + 4, cursorY + 14);
    } else {
      reportDataset.rows.forEach((row) => {
        if (cursorY > pageHeight - 40) {
          doc.addPage();
          cursorY = 36;
          drawHeader();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
        }
        row.forEach((cell, i) => {
          const val = String(cell ?? '-').slice(0, 20);
          doc.text(val, marginX + i * colWidth + 4, cursorY + 11);
        });
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, cursorY + 16, marginX + usableWidth, cursorY + 16);
        cursorY += 18;
      });
    }

    doc.save(`${activeReport}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Report Selector Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-2xs flex flex-wrap gap-1.5 print:hidden">
        {REPORT_DEFINITIONS.map(rep => (
          <button
            key={rep.key}
            type="button"
            onClick={() => setActiveReport(rep.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              activeReport === rep.key
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {rep.label}
          </button>
        ))}
      </div>

      {/* Filters & Export Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code or asset..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
            />
          </div>
          <select
            value={fyFilter}
            onChange={(e) => setFyFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">All Financial Years</option>
            {store.financialYears.map(fy => (
              <option key={fy.id} value={fy.label}>FY {fy.label}</option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">All Categories</option>
            {store.categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileDown size={14} />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{reportDataset.title}</h3>
            <p className="text-[11px] text-slate-500">{institutionName}</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{reportDataset.rows.length} row(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">S.N.</th>
                {reportDataset.columns.map(col => (
                  <th key={col} className="py-2.5 px-3 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportDataset.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportDataset.columns.length + 1} className="py-10 text-center text-slate-400">
                    No records match the current report filters.
                  </td>
                </tr>
              ) : (
                reportDataset.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-3 text-slate-800 whitespace-nowrap font-medium">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
