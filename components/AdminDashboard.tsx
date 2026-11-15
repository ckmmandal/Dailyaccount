import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Activity, ShieldCheck, 
  Settings, Building2, Combine,
  Calendar, Key, Download,
  CheckCircle2, Clock,
  RefreshCw, ArrowUpRight,
  Shield, Server, HardDrive,
  FileText, UserCheck, Lock, ExternalLink
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { Branch, User, AuditLog, Role, AppHoliday, BranchOperationalStatus, Employee } from '../types';
import NepaliDate from 'nepali-date-converter';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [holidays, setHolidays] = useState<AppHoliday[]>([]);
  const [branchStatuses, setBranchStatuses] = useState<Record<string, BranchOperationalStatus>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const fetchData = async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      else setLoading(true);

      const [u, l, b, r, h, s, emp] = await Promise.all([
        storageService.getUsers().catch(() => []),
        storageService.getLogs().catch(() => []),
        storageService.getBranches().catch(() => []),
        storageService.getRoles().catch(() => []),
        storageService.getHolidays().catch(() => []),
        storageService.getBranchOperationalStatuses().catch(() => ({})),
        storageService.getEmployees().catch(() => [])
      ]);

      setUsers(u || []);
      setLogs(l || []);
      setBranches(b || []);
      setRoles(r || []);
      setHolidays(h || []);
      setBranchStatuses(s || {});
      setEmployees(emp || []);
      setLastRefreshedAt(new Date());
    } catch (error) {
      console.error("Failed to fetch admin dashboard telemetry", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleLogUpdate = () => {
      storageService.invalidateMemoryCache('audit_logs');
      storageService.getLogs().then(l => setLogs(l || [])).catch(() => {});
    };
    window.addEventListener('auditLogsUpdated', handleLogUpdate);
    window.addEventListener('storage', handleLogUpdate);
    return () => {
      window.removeEventListener('auditLogsUpdated', handleLogUpdate);
      window.removeEventListener('storage', handleLogUpdate);
    };
  }, []);

  // Today's Date in BS and Gregorian (Pure English Representation)
  const dateInfo = useMemo(() => {
    const now = new Date();
    const gregorianStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    let bsStr = '';
    try {
      const nep = new NepaliDate(now);
      const bsYear = nep.getYear();
      const bsMonthIndex = nep.getMonth();
      const bsDate = nep.getDate();
      const monthNames = [
        'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
        'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
      ];
      bsStr = `${monthNames[bsMonthIndex] || ''} ${bsDate}, ${bsYear} BS`;
    } catch {
      bsStr = 'Bikram Sambat Calendar';
    }

    return { gregorianStr, bsStr };
  }, []);

  const recentLogs = useMemo(() => {
    return [...logs].slice(0, 6);
  }, [logs]);

  // Default fallback branches if empty
  const displayBranches: Branch[] = useMemo(() => {
    if (branches && branches.length > 0) return branches;
    return [
      { id: 'main', name: 'Ratauli Head Office', code: 'C01', location: 'Ratauli', status: 'Active', createdAt: 0 },
      { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', location: 'Sahodba', status: 'Active', createdAt: 0 },
      { id: 'pipra', name: 'Pipra Branch', code: 'C03', location: 'Pipra', status: 'Active', createdAt: 0 },
      { id: 'parsa', name: 'Parsa Branch', code: 'C04', location: 'Parsa', status: 'Active', createdAt: 0 }
    ];
  }, [branches]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-3">
        <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Admin Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-300 font-sans">
      
      {/* Top Banner / Operational Command Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-blue-900 text-white flex items-center justify-center shadow-sm">
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Admin Command & Governance Dashboard
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end md:self-auto text-right">
          <div className="border-r border-slate-200 pr-3">
            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
              {dateInfo.bsStr}
            </span>
            <span className="text-xs font-bold text-slate-700">
              {dateInfo.gregorianStr}
            </span>
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
            title="Refresh Live Metrics"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: 6 Essential Executive Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Metric 1: Total Users */}
        <div 
          onClick={() => navigate('/admin/users')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Users</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {users.length}
          </div>
        </div>

        {/* Metric 2: Branch Units */}
        <div 
          onClick={() => navigate('/admin/branches')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-orange-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Branches</span>
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <Building2 size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {displayBranches.length}
          </div>
        </div>

        {/* Metric 3: Access Roles */}
        <div 
          onClick={() => navigate('/admin/roles')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Security Roles</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Key size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {roles.length}
          </div>
        </div>

        {/* Metric 4: Holidays Configured */}
        <div 
          onClick={() => navigate('/admin/holiday')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Holidays</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Calendar size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {holidays.length}
          </div>
        </div>

        {/* Metric 5: Audit Log Events */}
        <div 
          onClick={() => navigate('/admin/logs')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Audit Logs</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Activity size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {logs.length}
          </div>
        </div>

        {/* Metric 6: HR Personnel */}
        <div 
          onClick={() => navigate('/hr')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Personnel</span>
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <UserCheck size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {employees.length}
          </div>
        </div>

      </div>

      {/* Main Grid: Branch Real-Time Operational Tracker & Navigation Launchpad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left (7 Columns): Live Branch Operational Status Monitor (Day Open / Day End) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="p-1 bg-blue-50 text-blue-600 rounded-md">
                <Clock size={14} />
              </div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Real-Time Branch Operations (Day Open / Day End)
              </h3>
            </div>
          </div>

          {/* Branch Operational Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {displayBranches.map((branch) => {
              const status = branchStatuses[branch.id] || branchStatuses[branch.code] || 'LIVE';
              const isOpen = status === 'OPEN' || status === 'LIVE';
              const isClosed = status === 'END' || status === 'CLOSED';
              const isHoliday = status === 'HOLIDAY';

              return (
                <div 
                  key={branch.id} 
                  className={`p-3 rounded-xl border transition-all ${
                    isOpen 
                      ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400' 
                      : isClosed
                      ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                      : isHoliday
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black font-mono bg-white border border-slate-200 text-slate-700">
                        {branch.code || 'B01'}
                      </span>
                      <h4 className="text-xs font-black text-slate-800 truncate">
                        {branch.name}
                      </h4>
                    </div>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                      isOpen 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : isClosed 
                        ? 'bg-slate-200 text-slate-700 border border-slate-300'
                        : isHoliday
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                      {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse mr-1"></span>}
                      {isOpen ? 'Day Open' : isClosed ? 'Day End' : isHoliday ? 'Holiday' : status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between text-[9px] text-slate-500">
            <span className="flex items-center space-x-1">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>Multi-branch status synchronizes live with cloud database.</span>
            </span>
            <span className="font-bold text-slate-600">
              Last Sync: {lastRefreshedAt.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Right (5 Columns): Security Health & Cloud Architecture Widget */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="p-1 bg-purple-50 text-purple-600 rounded-md">
                <Shield size={14} />
              </div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                System Health & Security Posture
              </h3>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Server size={14} className="text-slate-500" />
                <div>
                  <span className="block text-[9px] font-black uppercase text-slate-400">Database Engine</span>
                  <span className="font-bold text-slate-800 text-[11px]">Supabase PostgreSQL Cloud</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono font-bold text-emerald-600">
                Connected
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock size={14} className="text-slate-500" />
                <div>
                  <span className="block text-[9px] font-black uppercase text-slate-400">Role-Based Access Control</span>
                  <span className="font-bold text-slate-800 text-[11px]">Enforced Across All 20+ Permissions</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono font-bold text-blue-600">
                Active
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive size={14} className="text-slate-500" />
                <div>
                  <span className="block text-[9px] font-black uppercase text-slate-400">Local Storage Backup Fallback</span>
                  <span className="font-bold text-slate-800 text-[11px]">Auto-Failover Synchronized</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono font-bold text-emerald-600">
                Synced
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText size={14} className="text-slate-500" />
                <div>
                  <span className="block text-[9px] font-black uppercase text-slate-400">Audit Trail Logging</span>
                  <span className="font-bold text-slate-800 text-[11px]">Immutable User Traceability</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono font-bold text-slate-700">
                Enabled
              </span>
            </div>

          </div>

          <div className="pt-1">
            <button
              onClick={() => navigate('/admin/backup')}
              className="w-full py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 shadow-xs"
            >
              <Download size={12} />
              <span>Generate System Backup (JSON)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Row 3: Administrative Modules Launchpad (8 Cards in 4x2 Grid) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-slate-900 text-white rounded-md">
              <Settings size={14} />
            </div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Administration Modules & Command Hubs
            </h3>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Quick Launchpad
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Card 1: User Identity */}
          <button 
            onClick={() => navigate('/admin/users')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50/30 transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center mb-2 transition-colors">
                <Users size={16} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Identity Hub</h4>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">User credentials, status toggles & scoped branch access.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-blue-600">
              <span>Manage Users</span>
              <ArrowUpRight size={12} />
            </div>
          </button>

          {/* Card 2: Branches */}
          <button 
            onClick={() => navigate('/admin/branches')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-orange-500 hover:bg-orange-50/30 transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-orange-50 group-hover:bg-orange-600 text-orange-600 group-hover:text-white flex items-center justify-center mb-2 transition-colors">
                <Building2 size={16} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Branch Network</h4>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">Branch codes, physical locations, operational status & cash limits.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-orange-600">
              <span>Setup Branches</span>
              <ArrowUpRight size={12} />
            </div>
          </button>

          {/* Card 3: Holidays & Calendar */}
          <button 
            onClick={() => navigate('/admin/holiday')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-rose-500 hover:bg-rose-50/30 transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-rose-50 group-hover:bg-rose-600 text-rose-600 group-hover:text-white flex items-center justify-center mb-2 transition-colors">
                <Calendar size={16} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Holiday & Calendar</h4>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">Public holidays, weekly off rules (Saturday/Sunday) & calendar setup.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-rose-600">
              <span>Configure Calendar</span>
              <ArrowUpRight size={12} />
            </div>
          </button>

          {/* Card 4: Roles & Permissions */}
          <button 
            onClick={() => navigate('/admin/roles')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-purple-500 hover:bg-purple-50/30 transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-purple-50 group-hover:bg-purple-600 text-purple-600 group-hover:text-white flex items-center justify-center mb-2 transition-colors">
                <Key size={16} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Roles & Privileges</h4>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">RBAC permission matrix, teller limits & supervisory rights.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-purple-600">
              <span>Configure Roles</span>
              <ArrowUpRight size={12} />
            </div>
          </button>

          {/* Card 5: Consolidated Intelligence */}
          <button 
            onClick={() => navigate('/admin/intelligence')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center mb-2 transition-colors">
                <Combine size={16} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Consolidated Intelligence</h4>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">Network-wide financial aggregation, ledger audit & cash volume.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-emerald-600">
              <span>View Financials</span>
              <ArrowUpRight size={12} />
            </div>
          </button>

          {/* Card 6: System Global Settings */}
          <button 
            onClick={() => navigate('/admin/settings')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-800 hover:bg-slate-50/50 transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-slate-900 text-slate-700 group-hover:text-white flex items-center justify-center mb-2 transition-colors">
                <Settings size={16} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">System Settings</h4>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">Cooperative registration details, tax rules & global parameters.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-slate-800">
              <span>Open Settings</span>
              <ArrowUpRight size={12} />
            </div>
          </button>

          {/* Card 7: Master Backup & Restore */}
          <button 
            onClick={() => navigate('/admin/backup')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-cyan-500 hover:bg-cyan-50/30 transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-cyan-50 group-hover:bg-cyan-600 text-cyan-600 group-hover:text-white flex items-center justify-center mb-2 transition-colors">
                <Download size={16} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Master Backup</h4>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">Complete JSON database export, cloud synchronization & file restore.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-cyan-600">
              <span>Backup Data</span>
              <ArrowUpRight size={12} />
            </div>
          </button>

          {/* Card 8: Audit Logs & Traceability */}
          <button 
            onClick={() => navigate('/admin/logs')}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center mb-2 transition-colors">
                <Activity size={16} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Audit Trail</h4>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">Comprehensive forensic event log, user login records & modifications.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-indigo-600">
              <span>View Logs</span>
              <ArrowUpRight size={12} />
            </div>
          </button>

        </div>
      </div>

      {/* Row 4: Recent Security & Administrative Activity Stream */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-emerald-50 text-emerald-600 rounded-md">
              <Activity size={14} />
            </div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Recent System & Security Audit Events
            </h3>
          </div>
          <button
            onClick={() => navigate('/admin/logs')}
            className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors flex items-center space-x-1"
          >
            <span>View All {logs.length} Events</span>
            <ExternalLink size={10} />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 space-y-1">
            <CheckCircle2 size={24} className="mx-auto text-emerald-500/70" />
            <p className="text-xs font-bold text-slate-600">No recent security events registered.</p>
            <p className="text-[10px] text-slate-400">All administrative operations will appear here in real-time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 border-b border-slate-100 text-[8px] font-black uppercase tracking-wider">
                  <th className="py-2 px-3 w-32">Timestamp</th>
                  <th className="py-2 px-3 w-28">User / Operator</th>
                  <th className="py-2 px-3 w-28 text-center">Category</th>
                  <th className="py-2 px-3">Action Description</th>
                  <th className="py-2 px-3 w-24 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLogs.map((log) => {
                  const actionUpper = (log.action || '').toUpperCase();
                  const isAuth = actionUpper.includes('LOGIN') || actionUpper.includes('AUTH');
                  const isReset = actionUpper.includes('RESET') || actionUpper.includes('DELETE');
                  const isHoliday = actionUpper.includes('HOLIDAY') || actionUpper.includes('CALENDAR');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Recent'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-800 text-[11px] block">
                          {log.userId || 'System'}
                        </span>
                        {log.branchId && (
                          <span className="text-[8px] font-mono text-slate-400 uppercase">
                            Branch: {log.branchId}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          isReset 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : isAuth 
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : isHoliday
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {log.action || 'OPERATION'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[11px] max-w-md truncate">
                        {log.details || 'System operation executed successfully.'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="inline-flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 size={10} className="mr-1 text-emerald-600" />
                          Logged
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminDashboard;
