import React, { useState, useEffect, useMemo, useCallback } from 'react';
import NepaliDate from 'nepali-date-converter';
import { storageService } from '../services/storageService';
import { Search, ShieldAlert, Terminal, RefreshCw, Building2 } from 'lucide-react';
import { User, AuditLog, Branch, DailyData, OfficeExpenseRecord, Notice } from '../types';
import { useAuth } from '../AuthContext';
import { getTodayBsDateStr, toNormalizedBsDateStr } from '../utils/backDateControl';

interface EnrichedLog extends AuditLog {
  actorLabel?: string;
  bsDate?: string;
}

const parseBsOrAdTimestamp = (dateStr?: string, fallbackTs?: number): number => {
  if (fallbackTs && Number.isFinite(fallbackTs) && fallbackTs > 0) return fallbackTs;
  if (!dateStr) return Date.now();
  try {
    const clean = String(dateStr).trim().split('T')[0].replace(/\//g, '-');
    const parts = clean.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [y, m, d] = parts;
      if (y > 2070) {
        return new NepaliDate(y, m - 1, d).toJsDate().getTime();
      }
      if (y > 1900) {
        return new Date(y, m - 1, d).getTime();
      }
    }
    const parsed = new Date(dateStr).getTime();
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
  } catch {
    return Date.now();
  }
};

const AuditLogPage: React.FC = () => {
  const { user: currentUser, role } = useAuth();
  const [logs, setLogs] = useState<EnrichedLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'all'>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = Boolean(
    currentUser?.roleId === '1' ||
    currentUser?.roleId === '2' ||
    currentUser?.username === 'admin' ||
    (currentUser?.roleId || '').toLowerCase().includes('admin') ||
    (role?.name && role.name.toLowerCase().includes('admin'))
  );

  const loadAllActivity = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      if (isManual) {
        storageService.invalidateMemoryCache('audit_logs');
      }

      const [rawLogs, uList, bList, allDaily, expenses, notices] = await Promise.all([
        storageService.getLogs().catch(() => []),
        storageService.getUsers().catch(() => []),
        storageService.getBranches().catch(() => []),
        storageService.getAllData().catch(() => ({} as Record<string, DailyData>)),
        storageService.getOfficeExpenses().catch(() => [] as OfficeExpenseRecord[]),
        storageService.getNotices().catch(() => [] as Notice[])
      ]);

      const explicitLogs: EnrichedLog[] = (Array.isArray(rawLogs) ? rawLogs : []).map(l => ({
        ...l,
        bsDate: (() => {
          try {
            return new NepaliDate(new Date(Number(l.timestamp) || Date.now())).format('YYYY-MM-DD');
          } catch {
            return '';
          }
        })()
      }));

      // Reconstruct activity entries from existing daily transactions, expenses, and notices
      // so work already completed today or earlier also appears clearly in the audit trail.
      const reconstructed: EnrichedLog[] = [];

      Object.values(allDaily || {}).forEach((dayData: DailyData) => {
        if (!dayData) return;
        const dayBranch = dayData.branchId || 'main';
        const dayBs = dayData.date ? toNormalizedBsDateStr(dayData.date) : '';
        const baseTs = parseBsOrAdTimestamp(dayData.date);

        (dayData.officeTransactions || []).forEach((o, idx) => {
          const entryBs = o.date ? toNormalizedBsDateStr(o.date) : dayBs;
          reconstructed.push({
            id: `recon_counter_${o.id}`,
            timestamp: parseBsOrAdTimestamp(o.date || dayData.date, undefined) + 1000 + idx,
            userId: o.createdBy || o.createdByName || 'admin',
            actorLabel: o.createdByName || o.createdBy,
            branchId: o.branchId || dayBranch,
            bsDate: entryBs,
            action: 'COUNTER_ENTRY',
            details: `[${entryBs}] ${o.head} (${o.type === 'in' ? 'Received' : 'Paid'}) — NPR ${Number(o.amount || 0).toLocaleString()}${o.remarks ? ` • ${o.remarks}` : ''}`,
            ip: 'Internal',
            device: 'Front Teller'
          });
        });

        (dayData.transactions || []).forEach((t, idx) => {
          const entryBs = t.date ? toNormalizedBsDateStr(t.date) : dayBs;
          reconstructed.push({
            id: `recon_ledger_${t.id}`,
            timestamp: parseBsOrAdTimestamp(t.date || dayData.date, undefined) + 2000 + idx,
            userId: t.createdBy || t.createdByName || 'admin',
            actorLabel: t.createdByName || t.createdBy,
            branchId: t.branchId || dayBranch,
            bsDate: entryBs,
            action: 'LEDGER_ENTRY',
            details: `[${entryBs}] ${t.description} (${t.type === 'in' ? 'IN' : 'OUT'}) — NPR ${Number(t.amount || 0).toLocaleString()}${t.remarks ? ` • ${t.remarks}` : ''}`,
            ip: 'Internal',
            device: 'Teller Ledger'
          });
        });

        (dayData.remittances || []).forEach((r, idx) => {
          const entryBs = r.date ? toNormalizedBsDateStr(r.date) : dayBs;
          reconstructed.push({
            id: `recon_remit_${r.id}`,
            timestamp: parseBsOrAdTimestamp(r.date || dayData.date, r.transferredAt) + 3000 + idx,
            userId: r.createdBy || r.createdByName || 'admin',
            actorLabel: r.createdByName || r.createdBy,
            branchId: r.branchId || dayBranch,
            bsDate: entryBs,
            action: 'REMITTANCE_ENTRY',
            details: `[${entryBs}] ${r.companyName} (${r.type}) — NPR ${Number(r.amount || 0).toLocaleString()}${r.referenceNo ? ` [Ref: ${r.referenceNo}]` : ''}${r.remarks ? ` • ${r.remarks}` : ''}`,
            ip: 'Internal',
            device: 'Remittance Hub'
          });
        });

        (dayData.vaultTransactions || []).forEach((v, idx) => {
          const entryBs = v.date ? toNormalizedBsDateStr(v.date) : dayBs;
          reconstructed.push({
            id: `recon_vault_${v.id}`,
            timestamp: parseBsOrAdTimestamp(v.date || dayData.date, undefined) + 4000 + idx,
            userId: v.createdBy || v.createdByName || 'admin',
            actorLabel: v.createdByName || v.createdBy,
            branchId: v.branchId || dayBranch,
            bsDate: entryBs,
            action: 'VAULT_ENTRY',
            details: `[${entryBs}] Vault ${v.type === 'in' ? 'Deposit' : 'Withdrawal'} (${v.source}) — NPR ${Number(v.amount || 0).toLocaleString()}${v.remarks ? ` • ${v.remarks}` : ''}`,
            ip: 'Internal',
            device: 'Vault Control'
          });
        });

        (dayData.otherEntries || []).forEach((oe, idx) => {
          const entryBs = oe.date ? toNormalizedBsDateStr(oe.date) : dayBs;
          reconstructed.push({
            id: `recon_other_${oe.id}`,
            timestamp: oe.timestamp || baseTs + 5000 + idx,
            userId: oe.userId || oe.userName || 'admin',
            actorLabel: oe.userName || oe.userId,
            branchId: dayBranch,
            bsDate: entryBs,
            action: 'OTHER_ADJUSTMENT',
            details: `[${entryBs}] Other (${oe.type.toUpperCase()}) — NPR ${Number(oe.amount || 0).toLocaleString()}${oe.remarks ? ` • ${oe.remarks}` : ''}`,
            ip: 'Internal',
            device: 'Front Teller'
          });
        });
      });

      (Array.isArray(expenses) ? expenses : []).forEach((exp) => {
        const expBs = exp.date ? toNormalizedBsDateStr(exp.date) : '';
        reconstructed.push({
          id: `recon_exp_${exp.id}`,
          timestamp: parseBsOrAdTimestamp(exp.date, exp.createdAt),
          userId: exp.recordedBy || exp.approvedBy || 'admin',
          actorLabel: exp.recordedBy || exp.approvedBy,
          branchId: exp.branchId || 'main',
          bsDate: expBs,
          action: 'OFFICE_EXPENSE',
          details: `[${expBs}] ${exp.categoryLabel || exp.category} — NPR ${Number(exp.amount || 0).toLocaleString()}${exp.paidTo ? ` to ${exp.paidTo}` : ''}${exp.remarks ? ` • ${exp.remarks}` : ''}`,
          ip: 'Internal',
          device: 'Office Expenses'
        });
      });

      (Array.isArray(notices) ? notices : []).forEach((n) => {
        const nBs = n.date ? toNormalizedBsDateStr(n.date) : '';
        reconstructed.push({
          id: `recon_notice_${n.id}`,
          timestamp: parseBsOrAdTimestamp(n.date, n.createdAt),
          userId: 'admin',
          branchId: n.branchId || 'main',
          bsDate: nBs,
          action: 'NOTICE_PUBLISHED',
          details: `[${nBs}] ${n.title} (${n.status})`,
          ip: 'Internal',
          device: 'Notice/Download'
        });
      });

      const mergedMap = new Map<string, EnrichedLog>();
      [...explicitLogs, ...reconstructed].forEach(item => {
        if (item && item.id && !mergedMap.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      });

      const combined = Array.from(mergedMap.values()).sort(
        (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)
      );

      setLogs(combined);
      setUsers(uList || []);
      setBranches(bList || []);
    } catch (error) {
      console.error("Failed to fetch logs", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAllActivity();

    const handleRefresh = () => {
      void loadAllActivity(true);
    };
    window.addEventListener('auditLogsUpdated', handleRefresh);
    window.addEventListener('branchDayStatusChanged', handleRefresh);
    window.addEventListener('storage', handleRefresh);
    return () => {
      window.removeEventListener('auditLogsUpdated', handleRefresh);
      window.removeEventListener('branchDayStatusChanged', handleRefresh);
      window.removeEventListener('storage', handleRefresh);
    };
  }, [loadAllActivity]);

  const parseTimestamp = (ts: number | string | undefined): Date => {
    if (!ts) return new Date();
    const num = typeof ts === 'string' ? Number(ts) : ts;
    return new Date(Number.isFinite(num) && num > 0 ? num : ts);
  };

  const formatDate = (ts: number | string | undefined, bsDate?: string) => {
    if (bsDate) return `${bsDate} BS`;
    try {
      const dt = parseTimestamp(ts);
      return new NepaliDate(dt).format('YYYY-MM-DD') + ' BS';
    } catch {
      try {
        return parseTimestamp(ts).toLocaleDateString();
      } catch {
        return 'Invalid Date';
      }
    }
  };

  const formatTime = (ts: number | string | undefined) => {
    try {
      return parseTimestamp(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  const resolveUser = useCallback((log: EnrichedLog) => {
    const uid = String(log.userId || '').trim();
    const found = users.find(
      u => u.id === uid || u.username === uid || u.fullName === uid
    );
    if (found) return found;
    if (log.actorLabel) {
      return { fullName: log.actorLabel, username: uid || 'staff' };
    }
    if (uid && uid !== 'sys' && uid !== 'kernel') {
      return { fullName: uid, username: uid };
    }
    return { fullName: 'System', username: 'system' };
  }, [users]);

  const resolveBranchName = useCallback((branchId?: string) => {
    if (!branchId) return 'Head Office';
    const found = branches.find(b => b.id.toLowerCase() === branchId.toLowerCase());
    if (found) return found.name;
    if (branchId === 'main') return 'Ratauli Head Office';
    return branchId;
  }, [branches]);

  const todayBs = useMemo(() => getTodayBsDateStr(), []);
  const todayLocalStr = useMemo(() => new Date().toLocaleDateString(), []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (!isAdmin && currentUser) {
        const matchesUser =
          log.userId === currentUser.id ||
          log.userId === currentUser.username ||
          log.userId === currentUser.fullName;
        if (!matchesUser) return false;
      }

      if (periodFilter === 'today') {
        const logDateLocal = parseTimestamp(log.timestamp).toLocaleDateString();
        const isTodayBs = log.bsDate === todayBs;
        const isTodayLocal = logDateLocal === todayLocalStr;
        if (!isTodayBs && !isTodayLocal) return false;
      }

      if (selectedBranchId !== 'all') {
        if ((log.branchId || 'main').toLowerCase() !== selectedBranchId.toLowerCase()) {
          return false;
        }
      }

      if (isAdmin && selectedUserId !== 'all') {
        if (selectedUserId === 'system') {
          const userExists = users.some(
            u => u.id === log.userId || u.username === log.userId || u.fullName === log.userId
          );
          if (userExists) return false;
        } else {
          const targetUser = users.find(u => u.id === selectedUserId);
          const matches =
            log.userId === selectedUserId ||
            (targetUser && (log.userId === targetUser.username || log.userId === targetUser.fullName));
          if (!matches) return false;
        }
      }

      if (filter.trim()) {
        const searchStr = filter.toLowerCase();
        const actionMatch = (log.action || '').toLowerCase().includes(searchStr);
        const detailsMatch = (log.details || '').toLowerCase().includes(searchStr);
        const branchMatch = resolveBranchName(log.branchId).toLowerCase().includes(searchStr);
        const logUser = resolveUser(log);
        const userMatch =
          (logUser.fullName || '').toLowerCase().includes(searchStr) ||
          (logUser.username || '').toLowerCase().includes(searchStr);
        return actionMatch || detailsMatch || branchMatch || userMatch;
      }

      return true;
    });
  }, [logs, isAdmin, currentUser, periodFilter, todayBs, todayLocalStr, selectedBranchId, selectedUserId, users, filter, resolveBranchName, resolveUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 px-1">
        <div>
          <h2 className="text-sm font-black text-slate-800 tracking-tighter uppercase italic leading-none">
            Audit <span className="text-blue-600">Trail</span>
          </h2>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            Daily activity &amp; system operations log ({filteredLogs.length} entries)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Today vs All Time Toggle */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center">
            <button
              type="button"
              onClick={() => setPeriodFilter('today')}
              className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all cursor-pointer ${
                periodFilter === 'today' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all cursor-pointer ${
                periodFilter === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Logs
            </button>
          </div>

          {/* Branch Filter */}
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="h-8 bg-white border border-slate-200 rounded-lg px-2.5 font-black text-[9px] uppercase outline-none focus:border-blue-500 shadow-sm cursor-pointer"
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {isAdmin && (
            <select 
              value={selectedUserId} 
              onChange={e => setSelectedUserId(e.target.value)}
              className="h-8 bg-white border border-slate-200 rounded-lg px-2.5 font-black text-[9px] uppercase outline-none focus:border-blue-500 shadow-sm cursor-pointer"
            >
              <option value="all">All Users / Actors</option>
              <option value="system">System (Automated)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.fullName} (@{u.username})</option>
              ))}
            </select>
          )}

          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={filter} 
              onChange={e => setFilter(e.target.value)}
              placeholder="Search Activity Log..." 
              className="h-8 w-52 sm:w-60 bg-white border border-slate-200 rounded-lg pl-8 pr-3 font-black text-[10px] uppercase outline-none focus:border-blue-500 shadow-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => void loadAllActivity(true)}
            disabled={refreshing}
            className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-[9px] font-black uppercase text-slate-700 flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="bg-slate-900 p-2 flex items-center justify-between text-white font-black italic">
          <div className="flex items-center space-x-1.5">
            <Terminal size={14} className="text-blue-400" />
            <span className="text-[9px] font-black uppercase tracking-tighter">System Terminal Log</span>
          </div>
          <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Forensic Audit Trail</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px] font-black">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[8px] tracking-widest font-black italic">
                <th className="px-4 py-1.5 text-left w-36">Timestamp</th>
                <th className="px-4 py-1.5 text-left w-44">Entity / Actor</th>
                <th className="px-4 py-1.5 text-left w-36">Branch</th>
                <th className="px-4 py-1.5 text-left w-40">Action Code</th>
                <th className="px-4 py-1.5 text-left">Forensic Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic">
              {filteredLogs.map(log => {
                const actor = resolveUser(log);
                const actionUpper = (log.action || '').toUpperCase();
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors font-mono">
                    <td className="px-4 py-1.5 text-slate-400 text-[9px] leading-tight">
                      <span className="block text-slate-700 font-bold">{formatDate(log.timestamp, log.bsDate)}</span>
                      <span className="block text-[8px] opacity-60 font-medium">{formatTime(log.timestamp)}</span>
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[8px] font-black uppercase shrink-0">
                          {(actor.username || 'SY').slice(0, 2)}
                        </div>
                        <div className="leading-none min-w-0">
                          <span className="block text-slate-800 text-[9px] font-black uppercase truncate">{actor.fullName}</span>
                          <span className="block text-[6px] text-slate-400 uppercase tracking-widest mt-0.5 truncate">@{actor.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-1.5">
                      <span className="inline-flex items-center gap-1 text-[8px] font-bold text-slate-600 uppercase">
                        <Building2 size={10} className="text-slate-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{resolveBranchName(log.branchId)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-1.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[7px] uppercase tracking-widest font-black ${
                        actionUpper.includes('DELETE') || actionUpper.includes('RESET') || actionUpper.includes('END')
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : actionUpper.includes('CREATE') || actionUpper.includes('SAVED') || actionUpper.includes('OPEN') || actionUpper.includes('LOGIN')
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-slate-600 font-medium leading-normal max-w-md break-words text-[9px]">
                      {log.details}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <ShieldAlert size={24} className="mx-auto text-slate-300 mb-2 animate-pulse" />
                    <span className="text-slate-300 font-black uppercase tracking-widest italic text-[9px]">
                      No Forensic Logs Found
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
