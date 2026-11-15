import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Building2, Calendar, CreditCard, 
  CheckCircle2, Clock3
} from 'lucide-react';
import { Employee, PayrollRecord, LeaveRequest, Branch, AttendanceRecord } from '../types';
import { storageService } from '../services/storageService';
import { normalizeBranchId } from '../services/supabaseService';
import NepaliDate from 'nepali-date-converter';

interface HRDashboardProps {
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  leaveRequests: LeaveRequest[];
  complaints?: Complaint[];
  branches: Branch[];
  onNavigateTab: (tab: 'dashboard' | 'employees' | 'payroll' | 'complaints' | 'leave') => void;
  onNavigateEmployeeSubTab: (subTab: 'list' | 'leave' | 'attendance' | 'remaining-leave') => void;
  onAddNewEmployee?: () => void;
}

const NEPALI_TO_ENGLISH_MONTH: Record<string, string> = {
  'बैशाख': 'Baisakh', 'वैशाख': 'Baisakh',
  'जेठ': 'Jestha', 'ज्येष्ठ': 'Jestha',
  'असार': 'Ashadh', 'आषाढ': 'Ashadh',
  'साउन': 'Shrawan', 'श्रावण': 'Shrawan',
  'भदौ': 'Bhadra', 'भाद्र': 'Bhadra',
  'असोज': 'Ashwin', 'आश्विन': 'Ashwin',
  'कार्तिक': 'Kartik', 'कात्तिक': 'Kartik',
  'मंसिर': 'Mangsir', 'मार्ग': 'Mangsir',
  'पुस': 'Poush', 'पौष': 'Poush',
  'माघ': 'Magh',
  'फागुन': 'Falgun', 'फाल्गुन': 'Falgun',
  'चैत': 'Chaitra', 'चैत्र': 'Chaitra'
};

const formatEnglishMonth = (m?: string) => {
  if (!m) return '';
  return NEPALI_TO_ENGLISH_MONTH[m.trim()] || m;
};

export const HRDashboard: React.FC<HRDashboardProps> = ({
  employees,
  payrollRecords,
  leaveRequests,
  branches,
  onNavigateTab,
  onNavigateEmployeeSubTab
}) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Fetch attendance records for today's live snapshot
  useEffect(() => {
    let isMounted = true;
    const fetchAttendance = async () => {
      try {
        const records = await storageService.getAttendanceRecords();
        if (isMounted) {
          setAttendanceRecords(records || []);
        }
      } catch (err) {
        console.error("Error loading attendance records for HR Dashboard:", err);
      }
    };
    fetchAttendance();
    return () => { isMounted = false; };
  }, []);

  // Today's BS Date
  const todayBs = useMemo(() => {
    try {
      const d = new NepaliDate();
      return d.format('YYYY-MM-DD');
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, []);

  // Employee Metrics
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter(e => (e.status || 'Active') === 'Active').length;

  // Today's Attendance Snapshot
  const todayAttendance = useMemo(() => {
    const todayNorm = todayBs.replace(/\//g, '-');
    const records = attendanceRecords.filter(r => {
      const recDate = (r.dateBs || r.date || '').replace(/\//g, '-');
      return recDate === todayNorm;
    });

    const present = records.filter(r => r.status === 'Present').length;
    const late = records.filter(r => r.status === 'Late').length;

    return {
      present,
      late,
      totalLogged: records.length
    };
  }, [attendanceRecords, todayBs]);

  // Leave Metrics
  const pendingLeaves = useMemo(() => {
    return leaveRequests.filter(r => r.status === 'Pending');
  }, [leaveRequests]);

  // Branches list with default cooperative branches if empty
  const allBranches = useMemo(() => {
    const defaultList: Branch[] = [
      { id: 'main', name: 'Ratauli Head Office', code: 'C01', location: 'Ratauli', status: 'Active', createdAt: 1700000000000 },
      { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', location: 'Sahodba', status: 'Active', createdAt: 1700000000001 },
      { id: 'pipra', name: 'Pipra Branch', code: 'C03', location: 'Pipra', status: 'Active', createdAt: 1700000000002 },
      { id: 'parsa', name: 'Parsa Branch', code: 'C04', location: 'Parsa', status: 'Active', createdAt: 1700000000003 },
    ];
    const map = new Map<string, Branch>();
    defaultList.forEach(b => map.set(b.id.toLowerCase(), b));
    (branches || []).forEach(b => map.set(b.id.toLowerCase(), b));
    return Array.from(map.values());
  }, [branches]);

  // Branch-wise staff distribution
  const branchDistribution = useMemo(() => {
    const counts: Record<string, { branch: Branch; count: number; totalSalary: number }> = {};
    
    allBranches.forEach(b => {
      counts[b.id] = { branch: b, count: 0, totalSalary: 0 };
    });

    employees.forEach(emp => {
      const bId = normalizeBranchId(emp.branchId);

      if (!counts[bId]) {
        const found = allBranches.find(b => b.id === bId);
        counts[bId] = {
          branch: found || { id: bId, name: bId.charAt(0).toUpperCase() + bId.slice(1) + ' Branch', code: 'N/A', location: 'Local', status: 'Active', createdAt: 0 },
          count: 0,
          totalSalary: 0
        };
      }

      counts[bId].count += 1;
      counts[bId].totalSalary += Number(emp.basicSalary || 0);
    });

    return Object.values(counts).sort((a, b) => {
      if (a.branch.id === 'main') return -1;
      if (b.branch.id === 'main') return 1;
      return b.count - a.count;
    });
  }, [allBranches, employees]);

  // Department & Designation Breakdown
  const designationDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach(e => {
      const des = (e.designation || 'Staff').trim().toUpperCase();
      map[des] = (map[des] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  // Latest Payroll Summary
  const payrollSummary = useMemo(() => {
    if (!payrollRecords || payrollRecords.length === 0) return null;

    const latestRec = payrollRecords[payrollRecords.length - 1];
    const targetMonth = formatEnglishMonth(latestRec?.month);
    const targetYear = latestRec?.year;

    const monthRecords = payrollRecords.filter(r => formatEnglishMonth(r.month) === targetMonth && r.year === targetYear);
    const totalDisbursed = monthRecords.reduce((sum, r) => sum + Number(r.netSalary || 0), 0);
    const totalTax = monthRecords.reduce((sum, r) => sum + Number(r.tax || 0), 0);

    return {
      month: targetMonth,
      year: targetYear,
      employeesPaid: monthRecords.length,
      totalDisbursed,
      totalTax
    };
  }, [payrollRecords]);

  return (
    <div className="space-y-6 not-italic font-sans text-slate-900 pb-8 p-3 sm:p-5">
      
      {/* Row 1: Key Performance Metrics (5 Cards - Clean, No Bottom Subtitles) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Metric 1: Total Staff */}
        <div 
          onClick={() => {
            onNavigateTab('employees');
            onNavigateEmployeeSubTab('list');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Total Staff</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors">
              <Users size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tight mt-2">
            {totalEmployeesCount}
          </div>
        </div>

        {/* Metric 2: Branches Staffed */}
        <div 
          onClick={() => {
            onNavigateTab('employees');
            onNavigateEmployeeSubTab('list');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Branches Staffed</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 group-hover:bg-teal-600 group-hover:text-white text-teal-700 flex items-center justify-center transition-colors">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-teal-900 font-mono tracking-tight mt-2">
            {allBranches.length} <span className="text-xs font-bold text-teal-600 font-sans">Units</span>
          </div>
        </div>

        {/* Metric 3: Today's Attendance */}
        <div 
          onClick={() => {
            onNavigateTab('employees');
            onNavigateEmployeeSubTab('attendance');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Today's Attendance</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 group-hover:bg-blue-600 group-hover:text-white text-blue-700 flex items-center justify-center transition-colors">
              <Clock3 size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-950 font-mono tracking-tight mt-2">
            {todayAttendance.totalLogged > 0 ? `${todayAttendance.present + todayAttendance.late}` : `${activeEmployeesCount}`}
            <span className="text-xs font-bold text-slate-400 font-sans ml-1">/ {activeEmployeesCount}</span>
          </div>
        </div>

        {/* Metric 4: Leave Applications */}
        <div 
          onClick={() => {
            onNavigateTab('employees');
            onNavigateEmployeeSubTab('leave');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Leave Applications</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              pendingLeaves.length > 0 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-slate-100 text-slate-600 group-hover:bg-amber-600 group-hover:text-white'
            }`}>
              <Calendar size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-900 font-mono tracking-tight mt-2">
            {pendingLeaves.length} <span className="text-xs font-bold text-amber-700 font-sans">Pending</span>
          </div>
        </div>

        {/* Metric 5: Payroll Slips */}
        <div 
          onClick={() => onNavigateTab('payroll')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Payroll Slips</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-700 flex items-center justify-center transition-colors">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-950 font-mono tracking-tight mt-2">
            {payrollRecords.length} <span className="text-xs font-bold text-indigo-600 font-sans">Slips</span>
          </div>
        </div>

      </div>

      {/* Row 2: Branch Workforce & Designation Matrix (Without left icon boxes, subtitles, or directory links) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Branch-Wise Staff Allocation */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Branch-Wise Workforce Allocation
            </h3>
          </div>

          <div className="space-y-3">
            {branchDistribution.map(({ branch, count, totalSalary }) => {
              const percentage = totalEmployeesCount > 0 ? Math.round((count / totalEmployeesCount) * 100) : 0;
              const isMain = branch.id === 'main';

              return (
                <div key={branch.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black font-mono ${
                        isMain ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {branch.code || 'B'}
                      </div>
                      <h4 className="text-xs font-black text-slate-900 leading-tight">
                        {branch.name}
                      </h4>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-slate-900 font-mono">
                        {count} Staff
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 ml-1.5 font-mono">
                        ({percentage}%)
                      </span>
                      <div className="text-[9px] font-bold text-slate-400">
                        NPR {totalSalary.toLocaleString()} Basic Vol.
                      </div>
                    </div>
                  </div>

                  {/* Visual Allocation Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isMain ? 'bg-slate-900' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.max(5, percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Designations & Roles (Clean, no bottom recent personnel box) */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Designations & Roles
            </h3>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {designationDistribution.map(({ name, count }) => {
              const pct = totalEmployeesCount > 0 ? Math.round((count / totalEmployeesCount) * 100) : 0;
              return (
                <div 
                  key={name} 
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></div>
                    <span className="font-black text-slate-800 truncate text-[11px]">{name}</span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-black text-[11px] text-slate-900">
                      {count}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono w-9 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}

            {designationDistribution.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs font-bold">
                No designation data registered yet.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Row 3: Leave Applications & Payroll Summary (Clean, no left icons, subtitles, or footer links) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Leave Applications & Status */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Leave Applications & Status
            </h3>
          </div>

          {leaveRequests.length === 0 ? (
            <div className="py-10 text-center text-slate-400 space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500/60" />
              <p className="text-xs font-bold text-slate-600">No active leave applications found.</p>
              <p className="text-[10px] text-slate-400">All submitted staff leaves have been processed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Dates & Days</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaveRequests.slice(0, 5).map(req => {
                    const emp = employees.find(e => e.id === req.employeeId);
                    const isPending = req.status === 'Pending';
                    const isApproved = req.status === 'Approved';

                    return (
                      <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900 leading-tight">
                            {emp?.fullName || 'Staff Member'}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {emp?.employeeCode || emp?.designation || 'Staff'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-slate-800">
                            {req.days} Day{req.days > 1 ? 's' : ''}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {req.startDate} to {req.endDate}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 max-w-xs truncate text-slate-600 text-[11px]">
                          {req.reason || 'Personal Duty'}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isPending 
                              ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                              : isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {req.status}
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

        {/* Right: Payroll & Salary Summary (Clean, no left icon, no subtitle, no grievance box) */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Payroll & Salary Summary
            </h3>
          </div>

          {payrollSummary ? (
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">
                  Disbursed Period
                </span>
                <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[10px] font-black font-mono">
                  {payrollSummary.month} {payrollSummary.year}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Net Salary Disbursed
                </span>
                <div className="text-2xl font-black text-indigo-950 font-mono tracking-tight">
                  NPR {payrollSummary.totalDisbursed.toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-200/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block font-semibold">Processed Staff</span>
                  <span className="font-mono font-black text-slate-800">{payrollSummary.employeesPaid} Employees</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-semibold">Taxes Deducted</span>
                  <span className="font-mono font-black text-slate-800">NPR {payrollSummary.totalTax.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <CreditCard size={32} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">No payroll cycles processed yet.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default HRDashboard;
