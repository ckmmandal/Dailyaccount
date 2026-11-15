import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  BookOpen,
  CheckCircle2,
  Printer,
  Search,
  Layers,
  X,
  ArrowUpRight
} from 'lucide-react';
import {
  DepreciationJournalVoucher,
  DepreciationStoreData,
  depreciationService
} from '../../services/depreciationService';
import { Branch, LedgerAccount } from '../../types';
import { getDayEndedBlockMessage } from '../../utils/dayEndLock';

interface DepreciationAccountingTabProps {
  store: DepreciationStoreData;
  branches: Branch[];
  ledgerAccounts: LedgerAccount[];
  actorName: string;
  isDayEnded: boolean;
  onStoreUpdated: (updated: DepreciationStoreData) => void;
}

type AccountingSubView = 'vouchers' | 'ledger_records' | 'gl_integration';

export const DepreciationAccountingTab: React.FC<DepreciationAccountingTabProps> = ({
  store,
  branches,
  ledgerAccounts,
  actorName,
  isDayEnded,
  onStoreUpdated
}) => {
  const [subView, setSubView] = useState<AccountingSubView>('vouchers');
  const [searchTerm, setSearchTerm] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<'all' | 'Depreciation' | 'Purchase' | 'Disposal'>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [drCrFilter, setDrCrFilter] = useState<'all' | 'Debit' | 'Credit'>('all');
  const [selectedVoucher, setSelectedVoucher] = useState<DepreciationJournalVoucher | null>(null);
  const [postingEntryId, setPostingEntryId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const f2 = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totals = useMemo(() => {
    const depExpenseDr = store.entries.reduce((s, e) => s + Number(e.depreciationAmount || 0), 0);
    const accumDepCr = store.assets
      .filter(a => a.status === 'Active')
      .reduce((s, a) => s + Number(a.accumulatedDepreciation || 0), 0);
    const totalVoucherDebit = store.vouchers.reduce((s, v) => s + Number(v.debitAmount || 0), 0);
    const totalVoucherCredit = store.vouchers.reduce((s, v) => s + Number(v.creditAmount || 0), 0);
    const unpostedEntries = store.entries.filter(e => !e.voucherId && e.depreciationAmount > 0);
    return {
      depExpenseDr,
      accumDepCr,
      totalVoucherDebit,
      totalVoucherCredit,
      voucherCount: store.vouchers.length,
      unpostedEntries
    };
  }, [store]);

  const filteredVouchers = useMemo(() => {
    return store.vouchers.filter(v => {
      if (voucherTypeFilter !== 'all' && v.voucherType !== voucherTypeFilter) return false;
      if (branchFilter !== 'all' && v.branchId !== branchFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const hit =
          v.voucherNo.toLowerCase().includes(q) ||
          v.narration.toLowerCase().includes(q) ||
          v.debitAccount.toLowerCase().includes(q) ||
          v.creditAccount.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [store.vouchers, voucherTypeFilter, branchFilter, searchTerm]);

  const debitCreditLines = useMemo(() => {
    const rows: Array<{
      voucherId: string;
      voucherNo: string;
      voucherDateBs: string;
      financialYear: string;
      branchName: string;
      voucherType: string;
      accountCode: string;
      accountName: string;
      type: 'Debit' | 'Credit';
      amount: number;
      description: string;
    }> = [];

    filteredVouchers.forEach(v => {
      v.lines.forEach(line => {
        if (drCrFilter !== 'all' && line.type !== drCrFilter) return;
        rows.push({
          voucherId: v.id,
          voucherNo: v.voucherNo,
          voucherDateBs: v.voucherDateBs,
          financialYear: v.financialYear,
          branchName: v.branchName,
          voucherType: v.voucherType,
          accountCode: line.accountCode,
          accountName: line.accountName,
          type: line.type,
          amount: line.amount,
          description: line.description
        });
      });
    });
    return rows;
  }, [filteredVouchers, drCrFilter]);

  const glIntegrationSummary = useMemo(() => {
    return store.categories.map(cat => {
      const catAssets = store.assets.filter(a => a.categoryId === cat.id && a.status === 'Active');
      const assetCost = catAssets.reduce((s, a) => s + Number(a.purchaseValue || 0), 0);
      const accumBalance = catAssets.reduce((s, a) => s + Number(a.accumulatedDepreciation || 0), 0);
      const expenseTotal = store.entries
        .filter(e => e.categoryId === cat.id)
        .reduce((s, e) => s + Number(e.depreciationAmount || 0), 0);
      return {
        category: cat,
        assetCount: catAssets.length,
        assetCost,
        accumBalance,
        expenseTotal,
        netBook: Math.max(0, assetCost - accumBalance)
      };
    });
  }, [store]);

  const handlePostManualVoucher = async (entryId: string) => {
    if (isDayEnded) {
      setFeedback(getDayEndedBlockMessage());
      return;
    }
    setPostingEntryId(entryId);
    setFeedback(null);
    try {
      const updated = await depreciationService.postManualVoucherForEntry(entryId, actorName);
      onStoreUpdated(updated);
      setFeedback('Journal voucher posted and integrated with General Ledger.');
    } catch (err: any) {
      setFeedback(err?.message || 'Unable to post journal voucher.');
    } finally {
      setPostingEntryId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Depreciation Expenses (Dr)</div>
          <div className="mt-1.5 text-xl font-black text-rose-700 font-mono tabular-nums">NPR {f2(totals.depExpenseDr)}</div>
          <div className="mt-1 text-[11px] text-slate-500">Total charged across posted entries</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Accumulated Depreciation (Cr)</div>
          <div className="mt-1.5 text-xl font-black text-amber-700 font-mono tabular-nums">NPR {f2(totals.accumDepCr)}</div>
          <div className="mt-1 text-[11px] text-slate-500">Active contra-asset balance</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Automatic Journal Vouchers</div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono tabular-nums">{totals.voucherCount}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            Dr / Cr Balanced: NPR {f2(totals.totalVoucherDebit)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">General Ledger Accounts</div>
          <div className="mt-1.5 text-xl font-black text-emerald-700 font-mono tabular-nums">{ledgerAccounts.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {totals.unpostedEntries.length} unposted depreciation entry(s)
          </div>
        </div>
      </div>

      {/* Sub-navigation & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubView('vouchers')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              subView === 'vouchers'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>Automatic Journal Vouchers</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('ledger_records')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              subView === 'ledger_records'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BookOpen size={14} />
            <span>Debit & Credit Records</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('gl_integration')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              subView === 'gl_integration'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers size={14} />
            <span>General Ledger Integration</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher or account..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>
          <select
            value={voucherTypeFilter}
            onChange={(e) => setVoucherTypeFilter(e.target.value as 'all' | 'Depreciation' | 'Purchase' | 'Disposal')}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">All Voucher Types</option>
            <option value="Depreciation">Depreciation</option>
            <option value="Purchase">Purchase</option>
            <option value="Disposal">Disposal</option>
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
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Unposted Depreciation Entries Banner (allows manual voucher generation if auto-post was off) */}
      {subView === 'vouchers' && totals.unpostedEntries.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Pending Depreciation Entries Without Journal Voucher ({totals.unpostedEntries.length})
            </h4>
          </div>
          <div className="overflow-x-auto bg-white border border-amber-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-amber-100/60 text-amber-950 uppercase text-[10px] font-bold">
                  <th className="py-2 px-3">Asset</th>
                  <th className="py-2 px-3">Branch</th>
                  <th className="py-2 px-3">FY / Period</th>
                  <th className="py-2 px-3 text-right">Depreciation (NPR)</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {totals.unpostedEntries.slice(0, 8).map(entry => (
                  <tr key={entry.id}>
                    <td className="py-2 px-3 font-semibold text-slate-900">{entry.assetCode} - {entry.assetName}</td>
                    <td className="py-2 px-3 text-slate-600">{entry.branchName}</td>
                    <td className="py-2 px-3 text-slate-600">{entry.financialYear} ({entry.periodLabel})</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{f2(entry.depreciationAmount)}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        disabled={isDayEnded || postingEntryId === entry.id}
                        onClick={() => handlePostManualVoucher(entry.id)}
                        className="px-2.5 py-1 rounded-md bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {postingEntryId === entry.id ? 'Posting...' : 'Post Voucher'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 1: Automatic Journal Vouchers */}
      {subView === 'vouchers' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Automatic Journal Vouchers</h3>
            <span className="text-xs font-semibold text-slate-500">{filteredVouchers.length} voucher(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Voucher No</th>
                  <th className="py-2.5 px-3">Date (BS)</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3">Debit Account</th>
                  <th className="py-2.5 px-3">Credit Account</th>
                  <th className="py-2.5 px-3 text-right">Amount (NPR)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No journal vouchers found. Register assets, run depreciation, or record disposals to generate automatic vouchers.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{v.voucherNo}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{v.voucherDateBs}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          v.voucherType === 'Depreciation'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : v.voucherType === 'Purchase'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {v.voucherType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{v.branchName}</td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">{v.debitAccount}</td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">{v.creditAccount}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">{f2(v.debitAmount)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                          {v.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                        >
                          <span>Voucher</span>
                          <ArrowUpRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 2: Debit & Credit Records */}
      {subView === 'ledger_records' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Debit & Credit Records</h3>
            <div className="flex items-center gap-1.5">
              {(['all', 'Debit', 'Credit'] as const).map(side => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setDrCrFilter(side)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                    drCrFilter === side
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {side === 'all' ? 'All Lines' : side}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Date (BS)</th>
                  <th className="py-2.5 px-3">Voucher No</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">GL Code</th>
                  <th className="py-2.5 px-3">Ledger Account</th>
                  <th className="py-2.5 px-3">Particulars</th>
                  <th className="py-2.5 px-3 text-right">Debit (NPR)</th>
                  <th className="py-2.5 px-3 text-right">Credit (NPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debitCreditLines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No debit or credit ledger records available.
                    </td>
                  </tr>
                ) : (
                  debitCreditLines.map((row, idx) => (
                    <tr key={`${row.voucherId}_${idx}`} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{row.voucherDateBs}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{row.voucherNo}</td>
                      <td className="py-2.5 px-3 text-slate-600">{row.voucherType}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{row.accountCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{row.accountName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{row.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-700">
                        {row.type === 'Debit' ? f2(row.amount) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {row.type === 'Credit' ? f2(row.amount) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {debitCreditLines.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs">
                    <td colSpan={6} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-600">Totals</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-800">
                      {f2(debitCreditLines.filter(r => r.type === 'Debit').reduce((s, r) => s + r.amount, 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800">
                      {f2(debitCreditLines.filter(r => r.type === 'Credit').reduce((s, r) => s + r.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: General Ledger Integration */}
      {subView === 'gl_integration' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Asset Category GL Account Mapping & Balances</h3>
              <span className="text-xs text-slate-500">Edit GL account codes in Depreciation Settings</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Asset GL Account</th>
                    <th className="py-2.5 px-3">Depreciation Expense GL</th>
                    <th className="py-2.5 px-3">Accumulated Depreciation GL</th>
                    <th className="py-2.5 px-3 text-right">Gross Cost</th>
                    <th className="py-2.5 px-3 text-right">Accumulated Dep.</th>
                    <th className="py-2.5 px-3 text-right">Net Book Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {glIntegrationSummary.map(({ category, assetCount, assetCost, accumBalance, netBook }) => (
                    <tr key={category.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {category.name} <span className="text-[10px] text-slate-400">({assetCount})</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{category.glAssetAccount}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{category.glExpenseAccount}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{category.glAccumulatedAccount}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">{f2(assetCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700">{f2(accumBalance)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">{f2(netBook)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Connected System Ledger Master Accounts</h3>
              <span className="text-xs text-slate-500">{ledgerAccounts.length} active ledger accounts</span>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2 px-3">Account Name</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Opening Balance (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No ledger master accounts registered yet.
                      </td>
                    </tr>
                  ) : (
                    ledgerAccounts.slice(0, 25).map(acc => (
                      <tr key={acc.id}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{acc.name}</td>
                        <td className="py-2 px-3 text-slate-600">{acc.type}</td>
                        <td className="py-2 px-3 text-emerald-700 font-semibold">{acc.status}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">{f2(acc.openingBalance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Journal Voucher Print / Detail Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Journal Voucher — {selectedVoucher.voucherNo}</h4>
                <p className="text-[11px] text-slate-500">
                  {selectedVoucher.voucherType} | FY {selectedVoucher.financialYear} | {selectedVoucher.branchName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Voucher No</div>
                  <div className="font-mono font-bold text-slate-900">{selectedVoucher.voucherNo}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Date (BS)</div>
                  <div className="font-mono font-bold text-slate-900">{selectedVoucher.voucherDateBs}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Financial Year</div>
                  <div className="font-semibold text-slate-900">{selectedVoucher.financialYear}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Created By</div>
                  <div className="font-semibold text-slate-900">{selectedVoucher.createdBy}</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                      <th className="py-2 px-3">Account Code</th>
                      <th className="py-2 px-3">Account Head</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Debit (NPR)</th>
                      <th className="py-2 px-3 text-right">Credit (NPR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedVoucher.lines.map((line, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-mono text-slate-600">{line.accountCode}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{line.accountName}</td>
                        <td className="py-2 px-3 text-slate-600">{line.description}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {line.type === 'Debit' ? f2(line.amount) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {line.type === 'Credit' ? f2(line.amount) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                      <td colSpan={3} className="py-2 px-3 text-right uppercase text-slate-600">Total</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-900">{f2(selectedVoucher.debitAmount)}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-900">{f2(selectedVoucher.creditAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Narration</span>
                <p className="text-slate-800 font-medium">{selectedVoucher.narration}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
