import React, { useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Coins,
  PiggyBank,
  Megaphone,
  FileText,
  Bell
} from 'lucide-react';
import { LoanInsuranceRecord, Notice, Branch } from '../types';
import { MFLoanRecord, MFSavingsRecord, resolveSavingMaturityDateBs } from '../services/microFinanceService';

export type DailyAlertCategory = 'bima' | 'loan' | 'saving' | 'notice';

interface DailyAlertViewerModalProps {
  activeCategory: DailyAlertCategory;
  onClose: () => void;
  todayBs: string;
  bimaItems: LoanInsuranceRecord[];
  loanItems: MFLoanRecord[];
  savingItems: MFSavingsRecord[];
  noticeItems: Notice[];
  branches: Branch[];
}

const formatBranchName = (branchId: string | number | undefined, branches: Branch[]): string => {
  const raw = String(branchId ?? '').trim();
  if (!raw) return 'Head Office';
  const lower = raw.toLowerCase();
  if (lower === '1' || lower === 'main' || lower === 'c01' || lower === 'head office') return 'Head Office';
  if (lower === '2' || lower === 'sahodba' || lower === 'c02') return 'Sahodba Branch';
  if (lower === '3' || lower === 'pipra' || lower === 'c03') return 'Pipra Branch';
  if (lower === '4' || lower === 'parsa' || lower === 'c04') return 'Parsa Branch';
  const match = branches.find(
    b =>
      String(b.id).toLowerCase() === lower ||
      String(b.code || '').toLowerCase() === lower ||
      String(b.name || '').toLowerCase() === lower
  );
  return match?.name || raw;
};

export const DailyAlertViewerModal: React.FC<DailyAlertViewerModalProps> = ({
  activeCategory,
  onClose,
  todayBs,
  bimaItems,
  loanItems,
  savingItems,
  noticeItems,
  branches
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const categoryMeta: Record<
    DailyAlertCategory,
    {
      label: string;
      icon: React.ReactNode;
      count: number;
      headerBg: string;
    }
  > = {
    bima: {
      label: 'Bima Maturity',
      icon: <ShieldCheck size={15} />,
      count: bimaItems.length,
      headerBg: 'bg-amber-50/80 border-amber-100 text-amber-950'
    },
    loan: {
      label: 'Loan Maturity',
      icon: <Coins size={15} />,
      count: loanItems.length,
      headerBg: 'bg-emerald-50/80 border-emerald-100 text-emerald-950'
    },
    saving: {
      label: 'Saving Maturity',
      icon: <PiggyBank size={15} />,
      count: savingItems.length,
      headerBg: 'bg-teal-50/80 border-teal-100 text-teal-950'
    },
    notice: {
      label: 'Notice',
      icon: <Megaphone size={15} />,
      count: noticeItems.length,
      headerBg: 'bg-sky-50/80 border-sky-100 text-sky-950'
    }
  };

  const currentMeta = categoryMeta[activeCategory];

  return (
    <div className="fixed inset-0 z-[5000] bg-[#f1f5f9] flex flex-col overflow-hidden text-slate-900 animate-in fade-in duration-150">
      {/* Sticky Full-Page Cooperative Teal Header */}
      <div className="bg-[#014a40] text-white px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-amber-300" />
          </div>
          <h2 className="text-sm sm:text-base font-bold tracking-tight truncate">
            {currentMeta.label} Notifications
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications"
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
        >
          <X size={17} />
        </button>
      </div>

      {/* Active Category Strip (Only Selected Category, No Count Badge) */}
      <div className="bg-white border-b border-slate-200 px-5 sm:px-6 py-2.5 flex items-center shrink-0">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#015e52] text-white shadow-2xs">
          <span className="text-emerald-200">{currentMeta.icon}</span>
          <span>{currentMeta.label}</span>
        </div>
      </div>

      {/* Full-Page Read-Only Content Body */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
        <div className="max-w-[1600px] mx-auto w-full">
          {/* 1. BIMA MATURITY */}
          {activeCategory === 'bima' && (
            bimaItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 py-16 px-6 text-center">
                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck size={22} />
                </div>
                <div className="text-sm font-bold text-slate-800">No Bima Maturity Alerts Today</div>
                <p className="text-xs text-slate-500 mt-1">
                  There are no loan insurance policies maturing on {todayBs}.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${currentMeta.headerBg}`}>
                        <th className="px-4 py-3.5 text-center w-14">S.N.</th>
                        <th className="px-4 py-3.5">Policy No</th>
                        <th className="px-4 py-3.5">Member ID</th>
                        <th className="px-4 py-3.5">Member Name</th>
                        <th className="px-4 py-3.5">Branch</th>
                        <th className="px-4 py-3.5 text-right">Sum Assured</th>
                        <th className="px-4 py-3.5 text-right">Premium</th>
                        <th className="px-4 py-3.5">Maturity Date (BS)</th>
                        <th className="px-4 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bimaItems.map((rec, idx) => (
                        <tr key={rec.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3.5 text-center font-mono tabular-nums font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-indigo-950 whitespace-nowrap">
                            {rec.policyNo || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {rec.memberId || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                            {rec.memberName || rec.name || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                            {formatBranchName(rec.branchId, branches)}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-[#015e52] text-right whitespace-nowrap">
                            NPR {(rec.sumAssured || rec.loanAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-medium text-indigo-900 text-right whitespace-nowrap">
                            NPR {(rec.premiumAmount || rec.premium || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-amber-800 whitespace-nowrap">
                            {rec.policyExpiryDateBs || rec.insuranceTillDateBs || rec.policyExpiryDate || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-amber-700 whitespace-nowrap">
                            {rec.status || 'Active'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* 2. LOAN MATURITY */}
          {activeCategory === 'loan' && (
            loanItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 py-16 px-6 text-center">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Coins size={22} />
                </div>
                <div className="text-sm font-bold text-slate-800">No Loan Maturity Alerts Today</div>
                <p className="text-xs text-slate-500 mt-1">
                  There are no active member loans maturing on {todayBs}.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${currentMeta.headerBg}`}>
                        <th className="px-4 py-3.5 text-center w-14">S.N.</th>
                        <th className="px-4 py-3.5">Member ID</th>
                        <th className="px-4 py-3.5">Account No</th>
                        <th className="px-4 py-3.5">Member Name</th>
                        <th className="px-4 py-3.5">Center / Group</th>
                        <th className="px-4 py-3.5">Loan Product</th>
                        <th className="px-4 py-3.5 text-right">Loan Amount</th>
                        <th className="px-4 py-3.5 text-right">Remaining</th>
                        <th className="px-4 py-3.5">Maturity Date</th>
                        <th className="px-4 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loanItems.map((loan, idx) => (
                        <tr key={loan.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3.5 text-center font-mono tabular-nums font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-blue-700 whitespace-nowrap">
                            {loan.memberId || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                            {loan.accountNo || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                            {loan.name || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700">
                            <div className="font-medium text-slate-800">{loan.centerName || '—'}</div>
                            {loan.groupName ? (
                              <div className="text-[11px] text-slate-500">{loan.groupName}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                            {loan.loanProduct || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-[#015e52] text-right whitespace-nowrap">
                            NPR {(loan.loanAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-medium text-rose-700 text-right whitespace-nowrap">
                            NPR {(loan.remainingAmount ?? 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-emerald-800 whitespace-nowrap">
                            {loan.maturityDate || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-emerald-700 whitespace-nowrap">
                            {loan.status || 'ACTIVE'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* 3. SAVING MATURITY */}
          {activeCategory === 'saving' && (
            savingItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 py-16 px-6 text-center">
                <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center mx-auto mb-3">
                  <PiggyBank size={22} />
                </div>
                <div className="text-sm font-bold text-slate-800">No Saving Maturity Alerts Today</div>
                <p className="text-xs text-slate-500 mt-1">
                  There are no member saving accounts maturing on {todayBs}.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${currentMeta.headerBg}`}>
                        <th className="px-4 py-3.5 text-center w-14">S.N.</th>
                        <th className="px-4 py-3.5">Member ID</th>
                        <th className="px-4 py-3.5">Account No</th>
                        <th className="px-4 py-3.5">Member Name</th>
                        <th className="px-4 py-3.5">Center / Group</th>
                        <th className="px-4 py-3.5">Saving Type</th>
                        <th className="px-4 py-3.5 text-right">Amount</th>
                        <th className="px-4 py-3.5">Maturity Date (BS)</th>
                        <th className="px-4 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {savingItems.map((sav, idx) => (
                        <tr key={sav.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3.5 text-center font-mono tabular-nums font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-blue-700 whitespace-nowrap">
                            {sav.memberId || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                            {sav.accountNo || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                            {sav.name || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700">
                            <div className="font-medium text-slate-800">{sav.centerName || '—'}</div>
                            {sav.groupName ? (
                              <div className="text-[11px] text-slate-500">{sav.groupName}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                            {sav.savingType || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-[#015e52] text-right whitespace-nowrap">
                            NPR {(sav.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 font-mono tabular-nums font-semibold text-teal-800 whitespace-nowrap">
                            {resolveSavingMaturityDateBs(sav) || sav.maturityDateBs || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-teal-700 whitespace-nowrap">
                            {sav.status || 'MATURED'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* 4. TODAY'S NOTICES */}
          {activeCategory === 'notice' && (
            noticeItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 py-16 px-6 text-center">
                <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-3">
                  <Megaphone size={22} />
                </div>
                <div className="text-sm font-bold text-slate-800">No Active Notices Today</div>
                <p className="text-xs text-slate-500 mt-1">
                  There are no active notices scheduled for {todayBs}.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {noticeItems.map((notice, idx) => (
                  <div
                    key={notice.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 leading-snug">
                            {notice.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <span className="font-mono tabular-nums font-semibold text-sky-800">
                              Date: {notice.date || todayBs}
                            </span>
                            <span>·</span>
                            <span>{formatBranchName(notice.branchId, branches)}</span>
                            <span>·</span>
                            <span className="font-semibold text-emerald-700">{notice.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {notice.description && (
                      <p className="text-xs text-slate-700 leading-relaxed mt-3 pl-10 whitespace-pre-line">
                        {notice.description}
                      </p>
                    )}

                    {notice.attachmentUrl && (
                      <div className="mt-3 pl-10">
                        {notice.attachmentType === 'image' ? (
                          <img
                            src={notice.attachmentUrl}
                            alt={notice.attachmentName || notice.title}
                            className="max-h-72 rounded-lg border border-slate-200 object-contain bg-slate-50"
                          />
                        ) : (
                          <a
                            href={notice.attachmentUrl}
                            download={notice.attachmentName || 'notice-attachment'}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                          >
                            <FileText size={14} />
                            <span>{notice.attachmentName || 'View Attachment'}</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Clean Sticky Footer */}
      <div className="bg-white border-t border-slate-200 px-5 sm:px-6 py-3 flex items-center justify-between text-xs shrink-0">
        <span className="text-slate-500">
          Showing <span className="font-mono font-bold text-slate-800">{currentMeta.count}</span>{' '}
          {currentMeta.label.toLowerCase()} {currentMeta.count === 1 ? 'notification' : 'notifications'} (Read-only view)
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
