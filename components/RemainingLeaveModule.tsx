import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Download, Printer, Filter, Building2, 
  Calendar, RefreshCw
} from 'lucide-react';
import { Employee, LeaveType, LeaveRequest, AttendanceRecord, Branch } from '../types';
import { storageService } from '../services/storageService';
import { isBranchMatch } from '../services/supabaseService';

interface RemainingLeaveModuleProps {
  employees: Employee[];
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  branches?: Branch[];
  currentBranch?: Branch | null;
}

export const RemainingLeaveModule: React.FC<RemainingLeaveModuleProps> = ({
  employees,
  leaveTypes,
  leaveRequests,
  branches = [],
  currentBranch = null
}) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Load attendance records
  const loadAttendance = async () => {
    setIsLoadingAttendance(true);
    try {
      const records = await storageService.getAttendanceRecords();
      setAttendanceRecords(records || []);
    } catch (err) {
      console.error("Failed to load attendance records for remaining leave calculation:", err);
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  // Available BS years detected from attendance and leave records
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    attendanceRecords.forEach(r => {
      const d = r.dateBs || r.date || '';
      const yr = d.split('-')[0];
      if (yr && yr.length === 4) yearSet.add(yr);
    });
    leaveRequests.forEach(r => {
      const yr = (r.startDate || '').split('-')[0];
      if (yr && yr.length === 4) yearSet.add(yr);
    });
    const sorted = Array.from(yearSet).sort().reverse();
    return sorted;
  }, [attendanceRecords, leaveRequests]);

  // Normalization helper functions
  const cleanCode = (code?: string) => (code || '').trim().toLowerCase().replace(/^0+/, '');
  const cleanName = (name?: string) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

  // Categorize leave types
  const isHomeLeave = (typeId?: string, typeName?: string, typeNameNp?: string) => {
    const id = (typeId || '').toLowerCase();
    const n = (typeName || '').toLowerCase();
    const np = (typeNameNp || '');
    return id === 'lt1' || n.includes('annual') || n.includes('home') || np.includes('घर');
  };

  const isSickLeave = (typeId?: string, typeName?: string, typeNameNp?: string) => {
    const id = (typeId || '').toLowerCase();
    const n = (typeName || '').toLowerCase();
    const np = (typeNameNp || '');
    return id === 'lt2' || n.includes('sick') || np.includes('बिरामी');
  };

  const isCasualLeave = (typeId?: string, typeName?: string, typeNameNp?: string) => {
    const id = (typeId || '').toLowerCase();
    const n = (typeName || '').toLowerCase();
    const np = (typeNameNp || '');
    return id === 'lt3' || n.includes('emergency') || n.includes('casual') || np.includes('भैपरी');
  };

  // Extract base leave quotas from leaveTypes
  const homeLeaveType = leaveTypes.find(t => isHomeLeave(t.id, t.name, t.nameNp));
  const sickLeaveType = leaveTypes.find(t => isSickLeave(t.id, t.name, t.nameNp));
  const casualLeaveType = leaveTypes.find(t => isCasualLeave(t.id, t.name, t.nameNp));

  const defaultHomeLeaveQuota = homeLeaveType?.totalDays ?? 30;
  const defaultSickLeaveQuota = sickLeaveType?.totalDays ?? 12;
  const defaultCasualLeaveQuota = casualLeaveType?.totalDays ?? 3;

  // Branch sorting ranking helper
  // Order: 1. Head Office, 2. Sahodba, 3. Pipra, 4. Parsa, 5. Others
  const getBranchRank = (branchId?: string, empBranchName?: string) => {
    const bId = (branchId || '').toLowerCase().trim();
    const bName = (empBranchName || '').toLowerCase().trim();
    if (bId === 'main' || bId.includes('head') || bName.includes('head') || bName.includes('ratauli')) return 1;
    if (bId.includes('sahodba') || bName.includes('sahodba')) return 2;
    if (bId.includes('pipra') || bName.includes('pipra')) return 3;
    if (bId.includes('parsa') || bName.includes('parsa')) return 4;
    return 5;
  };

  const parseEmployeeCodeNum = (code?: string) => {
    if (!code) return 999999;
    const match = code.match(/\d+/);
    return match ? parseInt(match[0], 10) : 999999;
  };

  // Filtered and sorted employees list
  // Sorted by: 1. Head Office, 2. Sahodba, 3. Pipra, 4. Parsa
  // Within each branch: Ascending by employee code (numeric)
  const sortedEmployees = useMemo(() => {
    const filtered = employees.filter(emp => {
      if (statusFilter !== 'All' && emp.status !== statusFilter) {
        return false;
      }
      if (selectedBranchId !== 'all' && !isBranchMatch(emp.branchId, selectedBranchId)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (emp.fullName || '').toLowerCase().includes(q);
        const matchesCode = (emp.employeeCode || '').toLowerCase().includes(q);
        const matchesDesignation = (emp.designation || '').toLowerCase().includes(q);
        const matchesDept = (emp.department || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesignation && !matchesDept) {
          return false;
        }
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const branchA = branches.find(br => br.id === a.branchId);
      const branchB = branches.find(br => br.id === b.branchId);
      const rankA = getBranchRank(a.branchId, branchA?.name);
      const rankB = getBranchRank(b.branchId, branchB?.name);
      if (rankA !== rankB) return rankA - rankB;

      const codeNumA = parseEmployeeCodeNum(a.employeeCode);
      const codeNumB = parseEmployeeCodeNum(b.employeeCode);
      if (codeNumA !== codeNumB) return codeNumA - codeNumB;

      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [employees, statusFilter, selectedBranchId, searchQuery, branches]);

  // Compute remaining leave balance table data
  const leaveSummaryData = useMemo(() => {
    return sortedEmployees.map(emp => {
      const empCode = cleanCode(emp.employeeCode);
      const empName = cleanName(emp.fullName);

      // Quotas (Allocated Leave)
      const homeQuota = defaultHomeLeaveQuota;
      const sickQuota = defaultSickLeaveQuota;
      const casualQuota = defaultCasualLeaveQuota;
      // Total Leave = Home + Sick + Casual
      const totalLeave = homeQuota + sickQuota + casualQuota;

      // Filter employee's approved leave requests (with optional year filter)
      const empRequests = leaveRequests.filter(r => {
        if (r.status !== 'Approved') return false;
        const matchesId = r.employeeId === emp.id;
        if (!matchesId) {
          const reqEmp = employees.find(e => e.id === r.employeeId);
          if (reqEmp) {
            const matchesCode = empCode && cleanCode(reqEmp.employeeCode) === empCode;
            const matchesName = cleanName(reqEmp.fullName) === empName;
            if (!matchesCode && !matchesName) return false;
          } else {
            return false;
          }
        }
        if (selectedYear !== 'all') {
          const startYr = (r.startDate || '').split('-')[0];
          if (startYr !== selectedYear) return false;
        }
        return true;
      });

      // Calculate approved taken per leave category
      let approvedHomeTaken = 0;
      let approvedSickTaken = 0;
      let approvedCasualTaken = 0;

      empRequests.forEach(req => {
        const lt = leaveTypes.find(t => t.id === req.leaveTypeId);
        if (isHomeLeave(req.leaveTypeId, lt?.name, lt?.nameNp)) {
          approvedHomeTaken += req.days;
        } else if (isSickLeave(req.leaveTypeId, lt?.name, lt?.nameNp)) {
          approvedSickTaken += req.days;
        } else if (isCasualLeave(req.leaveTypeId, lt?.name, lt?.nameNp)) {
          approvedCasualTaken += req.days;
        } else {
          approvedCasualTaken += req.days;
        }
      });

      // Calculate absent count from attendance records
      const empAttendance = attendanceRecords.filter(rec => {
        const matchesId = rec.employeeId === emp.id;
        const matchesCode = empCode && cleanCode(rec.employeeCode) === empCode;
        const matchesName = empName && cleanName(rec.employeeName) === empName;
        if (!matchesId && !matchesCode && !matchesName) return false;

        if (selectedYear !== 'all') {
          const recYr = (rec.dateBs || rec.date || '').split('-')[0];
          if (recYr !== selectedYear) return false;
        }
        return true;
      });

      let absentDays = 0;
      empAttendance.forEach(rec => {
        if (rec.status === 'Absent' && !rec.remarks) {
          absentDays += 1;
        } else if (rec.status === 'Half Day') {
          absentDays += 0.5;
        }
      });

      // Rule: For Head Office (and all branches), absent is deducted from Bhaipari Bida (Casual Leave) first!
      // If absent exceeds available Casual Leave quota, the remainder is deducted from Home Leave.
      const branchObj = branches.find(b => b.id === emp.branchId);
      const isHeadOffice = getBranchRank(emp.branchId, branchObj?.name) === 1;

      // Available casual leave quota before absent deduction
      const casualAvailable = Math.max(0, casualQuota - approvedCasualTaken);
      const casualAbsentDeducted = Math.min(absentDays, casualAvailable);
      const casualTaken = approvedCasualTaken + casualAbsentDeducted;

      // Remaining absent after exhausting casual leave quota
      const remainingAbsent = absentDays - casualAbsentDeducted;

      // Available home leave quota before absent deduction
      const homeAvailable = Math.max(0, homeQuota - approvedHomeTaken);
      const homeAbsentDeducted = Math.min(remainingAbsent, homeAvailable);
      const homeTaken = approvedHomeTaken + homeAbsentDeducted;

      // Excess absent if any (beyond casual + home leave quotas)
      const excessAbsent = remainingAbsent - homeAbsentDeducted;
      const sickTaken = approvedSickTaken;

      // Total Taken = Home Taken + Sick Taken + Casual Taken + Excess Absent
      const totalTaken = homeTaken + sickTaken + casualTaken + excessAbsent;

      // Remaining Balance = Total Leave - Total Taken
      const remaining = totalLeave - totalTaken;

      const branchName = branchObj?.name || (isHeadOffice ? 'Head Office' : 'Branch');

      return {
        employee: emp,
        branchName,
        isHeadOffice,
        homeQuota,
        homeTaken,
        approvedHomeTaken,
        sickQuota,
        sickTaken,
        approvedSickTaken,
        casualQuota,
        casualTaken,
        approvedCasualTaken,
        casualAbsentDeducted,
        homeAbsentDeducted,
        excessAbsent,
        absentDays,
        totalLeave,
        totalTaken,
        remaining
      };
    });
  }, [
    sortedEmployees, leaveRequests, leaveTypes, employees, 
    attendanceRecords, selectedYear, branches,
    defaultHomeLeaveQuota, defaultSickLeaveQuota, defaultCasualLeaveQuota
  ]);

  // Aggregated totals across all visible employees
  const totals = useMemo(() => {
    return leaveSummaryData.reduce((acc, row) => {
      acc.totalEmployees += 1;
      acc.homeQuota += row.homeQuota;
      acc.homeTaken += row.homeTaken;
      acc.sickQuota += row.sickQuota;
      acc.sickTaken += row.sickTaken;
      acc.casualQuota += row.casualQuota;
      acc.casualTaken += row.casualTaken;
      acc.absentDays += row.absentDays;
      acc.totalLeave += row.totalLeave;
      acc.totalTaken += row.totalTaken;
      acc.remaining += row.remaining;
      return acc;
    }, {
      totalEmployees: 0,
      homeQuota: 0,
      homeTaken: 0,
      sickQuota: 0,
      sickTaken: 0,
      casualQuota: 0,
      casualTaken: 0,
      absentDays: 0,
      totalLeave: 0,
      totalTaken: 0,
      remaining: 0
    });
  }, [leaveSummaryData]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'S.N.',
      'Employee Name',
      'Employee Code',
      'Designation',
      'Branch',
      'Home Leave Quota',
      'Home Leave Taken',
      'Sick Leave Quota',
      'Sick Leave Taken',
      'Casual Leave Quota',
      'Casual Leave Taken',
      'Attendance Absent',
      'Total Leave',
      'Total Taken',
      'Remaining Balance'
    ];

    const rows = leaveSummaryData.map((row, idx) => [
      idx + 1,
      `"${row.employee.fullName}"`,
      `"${row.employee.employeeCode || ''}"`,
      `"${row.employee.designation || ''}"`,
      `"${row.branchName}"`,
      row.homeQuota,
      row.homeTaken,
      row.sickQuota,
      row.sickTaken,
      row.casualQuota,
      row.casualTaken,
      row.absentDays,
      row.totalLeave,
      row.totalTaken,
      row.remaining
    ]);

    // Add Grand Total row
    rows.push([
      'TOTAL',
      `"Total Employees: ${totals.totalEmployees}"`,
      '""',
      '""',
      '""',
      totals.homeQuota,
      totals.homeTaken,
      totals.sickQuota,
      totals.sickTaken,
      totals.casualQuota,
      totals.casualTaken,
      totals.absentDays,
      totals.totalLeave,
      totals.totalTaken,
      totals.remaining
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `remaining_leave_registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-3 md:p-5 space-y-4 animate-in fade-in bg-slate-50/50 min-h-full font-sans">
      {/* Clean Header with Title and Actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
            Remaining Leave Registry
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadAttendance}
            disabled={isLoadingAttendance}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
            title="Refresh Attendance & Leave Data"
          >
            <RefreshCw size={14} className={isLoadingAttendance ? 'animate-spin text-emerald-600' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs active:scale-95 cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs active:scale-95 cursor-pointer"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee by name, code, designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {/* Branch Filter */}
          {branches.length > 1 && (
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <Building2 size={13} className="text-slate-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
            <Filter size={13} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
              className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="Active">Active Only</option>
              <option value="All">All Statuses</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
            <Calendar size={13} className="text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">All Years</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>BS {yr}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Remaining Leave Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[900px]">
            <thead>
              {/* Group Headers */}
              <tr className="bg-slate-900 text-white uppercase text-[10.5px] font-black border-b border-slate-800 tracking-wider">
                <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-800 w-12">
                  S.N.
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left border-r border-slate-800 min-w-[200px]">
                  Employee
                </th>
                <th colSpan={2} className="px-3 py-2 text-center border-r border-slate-800 bg-sky-950 font-black tracking-widest text-sky-200">
                  Home Leave
                </th>
                <th colSpan={2} className="px-3 py-2 text-center border-r border-slate-800 bg-indigo-950 font-black tracking-widest text-indigo-200">
                  Sick Leave
                </th>
                <th colSpan={2} className="px-3 py-2 text-center border-r border-slate-800 bg-amber-950 font-black tracking-widest text-amber-200">
                  Casual Leave
                </th>
                <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-800 bg-rose-950 font-black tracking-wider text-rose-200 min-w-[85px]" title="Absent days recorded from Biometric attendance">
                  <div>Absent</div>
                  <div className="text-[8px] font-normal text-rose-300 lowercase">(attendance)</div>
                </th>
                <th colSpan={3} className="px-3 py-2 text-center bg-emerald-950 font-black tracking-widest text-emerald-200">
                  Remaining
                </th>
              </tr>

              {/* Sub-Column Headers */}
              <tr className="bg-slate-800 text-white text-[9.5px] uppercase tracking-wider border-b border-slate-300">
                {/* Home Leave Sub-cols */}
                <th className="px-2.5 py-1.5 border-r border-slate-700 font-bold bg-sky-900/60 text-sky-100 min-w-[60px]" title="Allocated Home Leave Quota">
                  Leave
                </th>
                <th className="px-2.5 py-1.5 border-r border-slate-700 font-bold bg-sky-900/40 text-sky-200 min-w-[60px]" title="Approved Home Leave Taken">
                  Taken
                </th>

                {/* Sick Leave Sub-cols */}
                <th className="px-2.5 py-1.5 border-r border-slate-700 font-bold bg-indigo-900/60 text-indigo-100 min-w-[60px]" title="Allocated Sick Leave Quota">
                  Leave
                </th>
                <th className="px-2.5 py-1.5 border-r border-slate-700 font-bold bg-indigo-900/40 text-indigo-200 min-w-[60px]" title="Approved Sick Leave Taken">
                  Taken
                </th>

                {/* Casual Leave Sub-cols */}
                <th className="px-2.5 py-1.5 border-r border-slate-700 font-bold bg-amber-900/60 text-amber-100 min-w-[60px]" title="Allocated Casual/Emergency Leave Quota">
                  Leave
                </th>
                <th className="px-2.5 py-1.5 border-r border-slate-700 font-bold bg-amber-900/40 text-amber-200 min-w-[60px]" title="Approved Casual Leave Taken + Absent Days Deducted">
                  Taken
                </th>

                {/* Remaining Sub-cols */}
                <th className="px-2.5 py-1.5 border-r border-slate-700 font-black bg-emerald-900/70 text-emerald-100 min-w-[70px]" title="Total Leave = Home + Sick + Casual">
                  Total Leave
                </th>
                <th className="px-2.5 py-1.5 border-r border-slate-700 font-black bg-emerald-900/50 text-rose-200 min-w-[75px]" title="Total Taken = Home Taken + Sick Taken + Casual Taken">
                  Taken
                </th>
                <th className="px-2.5 py-1.5 font-black bg-emerald-900 text-emerald-300 min-w-[75px]" title="Remaining Balance = Total Leave - Total Taken">
                  Remaining
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-900">
              {leaveSummaryData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                    No matching employee records found
                  </td>
                </tr>
              ) : (
                leaveSummaryData.map((row, idx) => (
                  <tr key={row.employee.id} className="hover:bg-slate-50/90 transition-colors">
                    {/* S.N. */}
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-700 border-r border-slate-200 text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Employee clean full name (no badges/pills) */}
                    <td className="px-4 py-2.5 text-left border-r border-slate-200">
                      <div className="font-extrabold text-slate-950 text-xs uppercase tracking-wide">
                        {row.employee.fullName}
                      </div>
                    </td>

                    {/* Home Leave: Leave & Taken */}
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-sky-50/20 border-r border-slate-200 text-[11px]">
                      {row.homeQuota}D
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-rose-700 bg-sky-50/10 border-r border-slate-200 text-[11px]">
                      {row.homeTaken > 0 ? `${row.homeTaken}D` : '-'}
                    </td>

                    {/* Sick Leave: Leave & Taken */}
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-indigo-50/20 border-r border-slate-200 text-[11px]">
                      {row.sickQuota}D
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-rose-700 bg-indigo-50/10 border-r border-slate-200 text-[11px]">
                      {row.sickTaken > 0 ? `${row.sickTaken}D` : '-'}
                    </td>

                    {/* Casual Leave: Leave & Taken */}
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-amber-50/20 border-r border-slate-200 text-[11px]">
                      {row.casualQuota}D
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-rose-700 bg-amber-50/10 border-r border-slate-200 text-[11px]" title={row.casualAbsentDeducted > 0 ? `${row.approvedCasualTaken}D Approved + ${row.casualAbsentDeducted}D Absent Deducted` : undefined}>
                      {row.casualTaken > 0 ? `${row.casualTaken}D` : '-'}
                    </td>

                    {/* Attendance Absent */}
                    <td className="px-2 py-2.5 text-center font-mono font-black text-rose-700 bg-rose-50/30 border-r border-slate-200 text-[11px]">
                      {row.absentDays > 0 ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-bold text-[10.5px]">
                          {row.absentDays}D
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Remaining Summary: Total Leave, Taken, Balance */}
                    <td className="px-2 py-2.5 text-center font-mono font-black text-slate-950 bg-emerald-50/20 border-r border-slate-200 text-[11.5px]">
                      {row.totalLeave}D
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-rose-700 bg-rose-50/10 border-r border-slate-200 text-[11.5px]">
                      <div>{row.totalTaken}D</div>
                    </td>
                    <td className={`px-2 py-2.5 text-center font-mono font-black text-[12px] ${
                      row.remaining <= 0 
                        ? 'text-rose-700 bg-rose-100/50' 
                        : 'text-emerald-800 bg-emerald-50/50'
                    }`}>
                      {row.remaining}D
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Total Row */}
            {leaveSummaryData.length > 0 && (
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-mono font-black text-slate-950 text-xs">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-left uppercase tracking-wider font-sans font-black text-slate-900 border-r border-slate-300">
                    Grand Total ({totals.totalEmployees} Employees)
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-slate-900">
                    {totals.homeQuota}D
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-rose-700">
                    {totals.homeTaken}D
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-slate-900">
                    {totals.sickQuota}D
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-rose-700">
                    {totals.sickTaken}D
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-slate-900">
                    {totals.casualQuota}D
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-rose-700">
                    {totals.casualTaken}D
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-rose-800 bg-rose-50/50">
                    {totals.absentDays}D
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-slate-950 bg-emerald-50/30">
                    {totals.totalLeave}D
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-300 text-rose-700 bg-rose-50/30">
                    {totals.totalTaken}D
                  </td>
                  <td className={`px-2 py-3 text-center ${
                    totals.remaining <= 0 ? 'text-rose-800 bg-rose-100' : 'text-emerald-800 bg-emerald-100'
                  }`}>
                    {totals.remaining}D
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
