
import React, { useState, useMemo, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { User, Role, Branch } from '../types';
import { 
  Edit2, Trash2, UserPlus, 
  Building2, Users, Search, 
  X, UserCheck, 
  RefreshCw, Eye, EyeOff, Briefcase,
  KeyRound, Clock, Copy, Check, ShieldAlert, Sparkles,
  Mail, CheckCircle2, AlertCircle
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { validateStrongPassword, getPasswordExpiryDetails } from '../utils/passwordPolicy';
import { PasswordRequirementGuide } from './PasswordRequirementGuide';
import { sendPasswordResetEmailApi } from '../services/pdfEmailService';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';
import {
  UserMfBranchAccessMode,
  UserInsBranchOverrideMode,
  parseUserMfBranchAccess,
  applyUserMfBranchAccessToPermissions,
  getMfBranchAccessSummary,
  parseUserInsuranceOverride,
  parseUserInsuranceBranchAccess,
  applyInsuranceBranchAccessToPermissions,
  getInsuranceBranchAccessSummary,
  resolveCanonicalBranchKey
} from '../utils/mfBranchFilter';

// Helper for safe UUID generation
const safeUUID = (): string => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    console.warn(e);
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Generates diverse, unpredictable random strong passwords
const generateDiverseRandomPassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const specials = '@#$%&*!';
  const all = upper + lower + digits + specials;

  const getRandom = (set: string) => set[Math.floor(Math.random() * set.length)];

  const chars = [
    getRandom(upper),
    getRandom(upper),
    getRandom(lower),
    getRandom(lower),
    getRandom(lower),
    getRandom(digits),
    getRandom(digits),
    getRandom(specials),
    getRandom(specials),
    getRandom(all)
  ];

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};

const UserManagement: React.FC = () => {
  const isDayEnded = useDayEndLock();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('');
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string } | null>(null);
  
  const [newUser, setNewUser] = useState<Partial<User>>({
    fullName: '', 
    username: '', 
    mobile: '', 
    roleId: '3', 
    branchId: 'main', 
    status: 'Active',
    password: ''
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [originalEditPassword, setOriginalEditPassword] = useState<string>('');
  const [editMfBranchMode, setEditMfBranchMode] = useState<UserMfBranchAccessMode>('login_only');
  const [editMfBranchIds, setEditMfBranchIds] = useState<string[]>([]);
  const [newMfBranchMode, setNewMfBranchMode] = useState<UserMfBranchAccessMode>('login_only');
  const [newMfBranchIds, setNewMfBranchIds] = useState<string[]>([]);
  const [editInsBranchMode, setEditInsBranchMode] = useState<UserInsBranchOverrideMode>('inherit_role');
  const [editInsBranchIds, setEditInsBranchIds] = useState<string[]>([]);
  const [newInsBranchMode, setNewInsBranchMode] = useState<UserInsBranchOverrideMode>('inherit_role');
  const [newInsBranchIds, setNewInsBranchIds] = useState<string[]>([]);

  // Password Reset by Super Admin State
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState<string>('');
  const [resetEmail, setResetEmail] = useState<string>('');
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [showTempPassword, setShowTempPassword] = useState<boolean>(true);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetSuccessData, setResetSuccessData] = useState<{ 
    user: User; 
    tempPass: string; 
    emailSent?: { success: boolean; message: string } | null;
    emailTarget?: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleOpenResetModal = async (u: User) => {
    let targetEmail = (u.email || '').trim();
    if (!targetEmail) {
      try {
        const emps = await storageService.getEmployees();
        const match = emps.find(
          e => (e.fullName && e.fullName.toLowerCase().trim() === u.fullName.toLowerCase().trim()) ||
               (e.mobile && e.mobile.trim() === u.mobile?.trim())
        );
        if (match?.email) {
          targetEmail = match.email.trim();
        }
      } catch (e) {
        console.warn("Could not find employee email", e);
      }
    }

    const defaultTemp = generateDiverseRandomPassword();
    setResetUser(u);
    setTempPassword(defaultTemp);
    setResetEmail(targetEmail);
    setSendEmail(Boolean(targetEmail));
    setShowTempPassword(true);
    setResetSuccessData(null);
    setCopied(false);
  };

  const handleGenerateRandomPass = () => {
    setTempPassword(generateDiverseRandomPassword());
  };

  const handleExecuteResetPassword = async () => {
    if (!resetUser || !tempPassword) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }

    setIsResetting(true);
    try {
      const updatedUser: User = {
        ...resetUser,
        email: resetEmail.trim() || resetUser.email,
        password: tempPassword,
        passwordUpdatedAt: Date.now(),
        forcePasswordChange: true, // Force user to set custom password on next login
      };

      await storageService.saveUser(updatedUser);
      await storageService.saveLog('admin', 'ADMIN_PASSWORD_RESET', `Super Admin reset password for user @${resetUser.username} with forced change on login`);

      const updated = await storageService.getUsers();
      setUsers(updated);

      let emailResult: { success: boolean; message: string } | null = null;

      if (sendEmail && resetEmail && resetEmail.trim()) {
        try {
          const sysSettings = await storageService.getSystemSettings().catch(() => null);
          const settings = await storageService.getSettings().catch(() => null);
          const compName = sysSettings?.systemName || settings?.systemName || "Ratauli Saving and Credit Cooperative Ltd";
          const compAddress = sysSettings?.address || settings?.address || "Pipra Rural Municipality -6 (Mahottari)";
          const logoUrl = sysSettings?.logoUrl || settings?.logoUrl;
          
          const emailResp = await sendPasswordResetEmailApi({
            to: resetEmail.trim(),
            userName: resetUser.fullName || resetUser.username,
            username: resetUser.username,
            password: tempPassword,
            loginUrl: window.location.origin,
            companyName: compName,
            companyAddress: compAddress,
            logoUrl: logoUrl,
          });
          emailResult = {
            success: emailResp.success,
            message: emailResp.message || (emailResp.success ? `Email sent to ${resetEmail.trim()}` : 'Failed to send email')
          };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Email sending failed';
          emailResult = {
            success: false,
            message: errMsg
          };
        }
      }

      setResetSuccessData({ 
        user: updatedUser, 
        tempPass: tempPassword,
        emailSent: emailResult,
        emailTarget: resetEmail.trim()
      });
    } catch (err: unknown) {
      console.error("Failed to reset password", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert("Could not reset password: " + errMsg);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!resetSuccessData) return;
    const textToCopy = `User: @${resetSuccessData.user.username}\nTemporary Password: ${resetSuccessData.tempPass}\nNote: Password change is required on next login.`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEditUser = async () => {
    if (!editingUser) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    try {
      // If password changed, enforce strong password policy (allowing admin flexibility)
      if (editingUser.password && editingUser.password !== originalEditPassword) {
        const validation = validateStrongPassword(editingUser.password, editingUser.username);
        if (!validation.isValid) {
          alert(`Weak Password:

${validation.errors.join("\n")}

Please use at least 8 characters with upper, lower, number, and special character.`);
          return;
        }
        editingUser.passwordUpdatedAt = Date.now();
      }

      const isEditingSuper =
        editingUser.username === 'admin' ||
        editingUser.roleId === '1' ||
        roles.find(r => r.id === editingUser.roleId)?.name?.toLowerCase().includes('super');

      const nextPermissions = isEditingSuper
        ? (editingUser.permissions || [])
        : applyInsuranceBranchAccessToPermissions(
            applyUserMfBranchAccessToPermissions(
              editingUser.permissions,
              editMfBranchMode,
              editMfBranchIds,
              branches
            ),
            editInsBranchMode,
            editInsBranchIds,
            branches,
            true
          );

      const userToSave: User = {
        ...editingUser,
        permissions: nextPermissions
      };

      setLoading(true);
      await storageService.saveUser(userToSave);
      const updated = await storageService.getUsers({ forceRefresh: true });
      setUsers(updated);
      window.dispatchEvent(new Event('userPermissionsUpdated'));
      setEditingUser(null);
      alert("User account updated successfully!");
    } catch (error) {
      console.error("Failed to update user", error);
      alert("Failed to update user: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [u, r, b] = await Promise.all([
        storageService.getUsers({ forceRefresh: true }),
        storageService.getRoles(),
        storageService.getBranches()
      ]);
      setUsers(u);
      setRoles(r);
      setBranches(b);
      
      if (b.length > 0 || r.length > 0) {
        setNewUser(prev => ({
          ...prev,
          branchId: b[0]?.id || prev.branchId,
          roleId: r[0]?.id || prev.roleId
        }));
      }
    } catch (error) {
      console.error("Failed to fetch user data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || 'Unknown Role';
  const getBranchName = (id: string) => {
    if (!id) return 'Head Office';
    const found = branches.find(b => 
      b.id.toLowerCase() === id.toLowerCase() || 
      b.code?.toLowerCase() === id.toLowerCase() ||
      b.name.toLowerCase() === id.toLowerCase()
    );
    if (found) return found.name;
    if (id.toLowerCase() === 'sahodba' || id.toLowerCase() === 'c02') return 'Sahodba Branch';
    if (id.toLowerCase() === 'pipra' || id.toLowerCase() === 'c03') return 'Pipra Branch';
    if (id.toLowerCase() === 'parsa' || id.toLowerCase() === 'c04') return 'Parsa Branch';
    if (id.toLowerCase() === 'main' || id.toLowerCase() === 'c01') return 'Ratauli Head Office';
    return id;
  };

  const handleSyncHR = async () => {
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    try {
      setLoading(true);
      const employees = await storageService.getEmployees();
      const existingUsers = await storageService.getUsers();

      if (!employees || employees.length === 0) {
        alert("No employees found in HR Registry. Please register employees in HR Management first.");
        return;
      }

      let createdCount = 0;
      let updatedCount = 0;

      const defaultRole = roles.find(r => r.id === '3') || roles.find(r => r.name.toLowerCase().includes('operator') || r.name.toLowerCase().includes('staff')) || roles[0];
      const defaultRoleId = defaultRole?.id || '3';

      const defaultBranch = branches.find(b => b.id === 'main') || branches[0];
      const defaultBranchId = defaultBranch?.id || 'main';

      for (const emp of employees) {
        if (!emp.fullName || emp.fullName.trim() === '') continue;
        
        const rawFirst = emp.fullName.trim().split(' ')[0].toLowerCase();
        const cleanedFirst = rawFirst.replace(/[^a-z0-9]/gi, '');
        const cleanCode = emp.employeeCode ? emp.employeeCode.toLowerCase().replace(/[^a-z0-9]/gi, '') : '';
        const baseUsername = cleanedFirst || cleanCode || 'user';

        const rawBranchId = emp.branchId && emp.branchId.trim() !== '' ? emp.branchId.trim() : defaultBranchId;
        const matchedBranch = branches.find(b => 
          b.id.toLowerCase() === rawBranchId.toLowerCase() ||
          b.code?.toLowerCase() === rawBranchId.toLowerCase() ||
          b.name.toLowerCase() === rawBranchId.toLowerCase() ||
          b.name.toLowerCase().includes(rawBranchId.toLowerCase())
        );
        const finalBranchId = matchedBranch ? matchedBranch.id : (rawBranchId || defaultBranchId);
        const finalRoleId = roles.some(r => r.id === defaultRoleId) ? defaultRoleId : (roles[0]?.id || '3');

        const matchedIndex = existingUsers.findIndex(u => {
          const uName = (u.fullName || '').toLowerCase().trim();
          const empName = (emp.fullName || '').toLowerCase().trim();
          const sameName = uName !== '' && uName === empName;
          
          const uEmail = (u.email || '').toLowerCase().trim();
          const empEmail = (emp.email || '').toLowerCase().trim();
          const sameEmail = uEmail !== '' && empEmail !== '' && uEmail === empEmail;

          const uMobile = (u.mobile || '').trim();
          const empMobile = (emp.mobile || '').trim();
          const sameMobile = uMobile !== '' && empMobile !== '' && uMobile === empMobile;

          const sameCode = cleanCode !== '' && u.username.toLowerCase() === cleanCode;

          return sameName || sameEmail || sameMobile || sameCode;
        });

        if (matchedIndex !== -1) {
          const matchedUser = existingUsers[matchedIndex];
          const updatedUser: User = {
            ...matchedUser,
            fullName: emp.fullName,
            email: emp.email || matchedUser.email,
            mobile: emp.mobile || matchedUser.mobile,
            profilePhoto: emp.photoUrl || matchedUser.profilePhoto,
            department: emp.department || matchedUser.department,
            designation: emp.designation || matchedUser.designation,
            branchId: finalBranchId
          };
          await storageService.saveUser(updatedUser);
          existingUsers[matchedIndex] = updatedUser;
          updatedCount++;
        } else {
          let uniqueUsername = baseUsername;
          let suffix = 1;
          while (existingUsers.some(u => u.username.toLowerCase() === uniqueUsername.toLowerCase())) {
            uniqueUsername = `${baseUsername}${suffix}`;
            suffix++;
          }

          // Initial strong default password conforming to rule: e.g. User@1234
          const defaultInitialPass = `${uniqueUsername.charAt(0).toUpperCase() + uniqueUsername.slice(1)}@1234`;

          const newUser: User = {
            id: safeUUID(),
            fullName: emp.fullName,
            username: uniqueUsername,
            password: defaultInitialPass,
            passwordUpdatedAt: Date.now(),
            forcePasswordChange: true, // Force user to set their custom password on first login
            email: emp.email || undefined,
            mobile: emp.mobile || '',
            roleId: finalRoleId,
            branchId: finalBranchId,
            status: 'Active',
            accountCreated: Date.now(),
            permissions: [],
            profilePhoto: emp.photoUrl || undefined,
            department: emp.department || undefined,
            designation: emp.designation || undefined
          };
          await storageService.saveUser(newUser);
          existingUsers.push(newUser);
          createdCount++;
        }
      }

      await storageService.saveLog('admin', 'HR_SYNC', `Synced HR Registry: Created ${createdCount} new users, Updated ${updatedCount} existing users.`);
      const finalUsers = await storageService.getUsers();
      setUsers(finalUsers);

      alert(`HR Data Synchronized Successfully!

- ${createdCount} new user accounts enrolled.
- ${updatedCount} existing user profiles updated.`);
    } catch (error) {
      console.error("Failed to sync HR data", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      alert("Failed to sync HR data: " + errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!newUser.fullName || !newUser.username || !newUser.password) {
      alert("Please fill in all required fields (Full Name, Username, Password).");
      return;
    }

    const validation = validateStrongPassword(newUser.password);
    if (!validation.isValid) {
      alert(`Weak Password:

${validation.errors.join("\n")}

Please use at least 8 characters with upper, lower, number, and special character.`);
      return;
    }

    try {
      setLoading(true);
      const isNewSuper =
        newUser.username === 'admin' ||
        newUser.roleId === '1' ||
        roles.find(r => r.id === newUser.roleId)?.name?.toLowerCase().includes('super');

      const user = {
        ...newUser,
        id: safeUUID(),
        accountCreated: Date.now(),
        passwordUpdatedAt: Date.now(),
        forcePasswordChange: false,
        permissions: isNewSuper
          ? []
          : applyInsuranceBranchAccessToPermissions(
              applyUserMfBranchAccessToPermissions([], newMfBranchMode, newMfBranchIds, branches),
              newInsBranchMode,
              newInsBranchIds,
              branches,
              true
            )
      } as User;
      await storageService.saveUser(user);
      const updated = await storageService.getUsers({ forceRefresh: true });
      setUsers(updated);
      window.dispatchEvent(new Event('userPermissionsUpdated'));
      setShowAdd(false);
      setNewMfBranchMode('login_only');
      setNewMfBranchIds([]);
      setNewInsBranchMode('inherit_role');
      setNewInsBranchIds([]);
      setNewUser({ 
        fullName: '', 
        username: '', 
        mobile: '', 
        roleId: roles[0]?.id || '3', 
        branchId: branches[0]?.id || 'main', 
        status: 'Active', 
        password: '' 
      });
      alert("User enrolled successfully!");
    } catch (error) {
      console.error("Failed to enroll user", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      alert("Failed to enroll user: " + errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (id === 'admin-temp') {
      console.warn("Cannot delete primary system account.");
      return;
    }
    setConfirmDelete({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      setConfirmDelete(null);
      return;
    }
    const { id } = confirmDelete;
    await storageService.deleteUser(id);
    const updated = await storageService.getUsers();
    setUsers(updated);
    setConfirmDelete(null);
  };

  const togglePassword = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const searchStr = (filter || '').toLowerCase();
      const fName = (u.fullName || '').toLowerCase();
      const uName = (u.username || '').toLowerCase();
      const mobile = u.mobile || '';
      const dept = (u.department || '').toLowerCase();
      const desig = (u.designation || '').toLowerCase();

      return fName.includes(searchStr) ||
             uName.includes(searchStr) ||
             mobile.includes(searchStr) ||
             dept.includes(searchStr) ||
             desig.includes(searchStr);
    });
  }, [users, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 font-sans">
       {/* Toolbar */}
       <div className="flex flex-col md:flex-row justify-between items-center bg-white p-3 rounded-2xl border border-slate-200 shadow-sm gap-3">
          <div className="flex items-center space-x-3">
             <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shadow-inner"><Users size={18}/></div>
             <div>
                <h3 className="text-base font-black italic tracking-tighter text-slate-950 uppercase leading-none">Identity Access Hub</h3>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">Total Managed Users: {users.length}</p>
             </div>
          </div>
          
          <div className="flex items-center space-x-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-52">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Search identity / username..." 
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 font-bold text-xs outline-none focus:border-blue-500 transition-all shadow-inner"
                />
             </div>
             <button type="button" disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : 'Sync HR Registry'} onClick={handleSyncHR} className="flex items-center space-x-1.5 bg-emerald-600 text-white h-9 px-4 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-md hover:bg-emerald-700 transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw size={12} />
                <span>Sync HR</span>
             </button>
             <button type="button" disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : 'Enroll User'} onClick={() => setShowAdd(true)} className="flex items-center space-x-1.5 bg-slate-950 text-white h-9 px-4 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-md hover:bg-blue-600 transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                <UserPlus size={12} />
                <span>Enroll User</span>
             </button>
          </div>
       </div>

       {/* Users Table */}
       <div className="bg-white rounded-[1.5rem] border-2 border-slate-950 shadow-lg overflow-hidden font-bold">
          <div className="overflow-x-auto">
             <table className="w-full text-[10px] border-collapse text-center">
                <thead>
                   <tr className="bg-slate-100 text-slate-950 uppercase tracking-wider text-[9px] border-b-2 border-slate-950 font-black">
                      <th className="p-3 text-left border-r border-slate-300">Photo</th>
                      <th className="p-3 text-left border-r border-slate-300">Identity & Contact</th>
                      <th className="p-3 border-r border-slate-300">Credentials & Policy</th>
                      <th className="p-3 border-r border-slate-300">3-Month Expiry Status</th>
                      <th className="p-3 border-r border-slate-300">Assignment</th>
                      <th className="p-3 border-r border-slate-300">Status</th>
                      <th className="p-3">Control</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                   {filteredUsers.length === 0 ? (
                      <tr>
                         <td colSpan={7} className="p-20 text-slate-300 uppercase tracking-widest font-black text-center">No user identity records found</td>
                      </tr>
                   ) : (
                      filteredUsers.map(u => {
                        const expiry = getPasswordExpiryDetails(u);
                        return (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                             <td className="p-2 border-r border-slate-100">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 mx-auto flex items-center justify-center overflow-hidden border border-slate-200 group-hover:border-blue-500 transition-all">
                                   {u.profilePhoto ? (
                                     <img src={u.profilePhoto} className="w-full h-full object-cover" />
                                   ) : (
                                     <Users size={16} className="text-slate-300" />
                                   )}
                                </div>
                             </td>
                             <td className="p-2 text-left border-r border-slate-100">
                                <div className="text-slate-950 font-black uppercase leading-tight mb-0.5">{u.fullName}</div>
                                <div className="text-[9px] text-slate-500 font-medium">{u.email || u.mobile || 'NO CONTACT'}</div>
                             </td>
                             <td className="p-2 border-r border-slate-100 bg-slate-50/40">
                                <div className="flex flex-col items-center space-y-1">
                                   <div className="flex items-center space-x-1 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px] text-blue-700 font-mono font-bold">
                                      <span className="opacity-60 text-[8px]">U:</span>
                                      <span>{u.username}</span>
                                   </div>
                                   <div className="flex items-center space-x-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-800 font-mono font-bold">
                                      <span className="opacity-60 text-[8px]">P:</span>
                                      <span>{showPassword[u.id] ? u.password : '••••••••'}</span>
                                      <button onClick={() => togglePassword(u.id)} className="text-slate-400 hover:text-blue-600 transition-colors ml-1">
                                         {showPassword[u.id] ? <EyeOff size={11}/> : <Eye size={11}/>}
                                      </button>
                                   </div>
                                </div>
                             </td>
                             <td className="p-2 border-r border-slate-100">
                                <div className="flex flex-col items-center space-y-1">
                                   <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${expiry.statusColorClass}`}>
                                      {expiry.statusBadge}
                                   </span>
                                   <div className="text-[8px] text-slate-400 flex items-center space-x-1">
                                      <Clock size={9} />
                                      <span>Updated: {expiry.lastChangedDateStr}</span>
                                   </div>
                                   {u.forcePasswordChange && (
                                     <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-1.5 rounded">Change Required on Next Login</span>
                                   )}
                                </div>
                             </td>
                             <td className="p-2 border-r border-slate-100">
                                <div className="flex flex-col items-start px-2 space-y-0.5">
                                   <div className="flex items-center space-x-1 text-slate-600">
                                      <Building2 size={10}/>
                                      <span className="uppercase text-[9px] font-black text-slate-800">{getBranchName(u.branchId)}</span>
                                   </div>
                                   <div className="flex items-center space-x-1 text-slate-400">
                                      <Briefcase size={10}/>
                                      <span className="text-[8px] text-slate-500 font-semibold">{u.department || 'N/A'}</span>
                                   </div>
                                   <div className="flex items-center space-x-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold">
                                      <span>{u.designation || getRoleName(u.roleId)}</span>
                                   </div>
                                   {(() => {
                                     const isSuper =
                                       u.username === 'admin' ||
                                       u.roleId === '1' ||
                                       getRoleName(u.roleId).toLowerCase().includes('super');
                                     if (isSuper) return null;
                                     const userRoleObj = roles.find(r => r.id === u.roleId);
                                     const mfBadge = getMfBranchAccessSummary(u.permissions, branches);
                                     const insBadge = getInsuranceBranchAccessSummary(
                                       u.permissions,
                                       userRoleObj?.permissions,
                                       branches
                                     );
                                     if (!mfBadge && !insBadge) return null;
                                     return (
                                       <div className="flex flex-wrap gap-1 pt-0.5">
                                         {mfBadge && (
                                           <div className="flex items-center space-x-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded text-[8px] uppercase font-black">
                                             <span>{mfBadge.label}</span>
                                           </div>
                                         )}
                                         {insBadge && (
                                           <div className="flex items-center space-x-1 bg-teal-50 border border-teal-200 text-teal-800 px-1.5 py-0.5 rounded text-[8px] uppercase font-black">
                                             <span>{insBadge.label}</span>
                                           </div>
                                         )}
                                       </div>
                                     );
                                   })()}
                                </div>
                             </td>
                             <td className="p-2 border-r border-slate-100">
                                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${u.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                   {u.status}
                                </span>
                             </td>
                             <td className="p-2">
                                <div className="flex justify-center space-x-1.5">
                                   <button 
                                     type="button"
                                     disabled={isDayEnded}
                                     onClick={() => handleOpenResetModal(u)} 
                                     title={isDayEnded ? getDayEndedBlockMessage() : 'Reset Password & Force Change on Next Login'}
                                     className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                   >
                                     <KeyRound size={13}/>
                                   </button>
                                   <button 
                                     type="button"
                                     disabled={isDayEnded}
                                     onClick={() => {
                                       setEditingUser(u);
                                       setOriginalEditPassword(u.password || '');
                                       const mfAccess = parseUserMfBranchAccess(u.permissions, [], u.branchId, branches);
                                       setEditMfBranchMode(mfAccess.mode);
                                       setEditMfBranchIds(
                                         mfAccess.mode === 'selected'
                                           ? mfAccess.explicitBranchKeys
                                           : [resolveCanonicalBranchKey(u.branchId, branches)].filter(Boolean)
                                       );
                                       const insOverride = parseUserInsuranceOverride(u.permissions, branches);
                                       setEditInsBranchMode(insOverride.mode);
                                       setEditInsBranchIds(
                                         insOverride.mode === 'selected'
                                           ? insOverride.explicitBranchKeys
                                           : [resolveCanonicalBranchKey(u.branchId, branches)].filter(Boolean)
                                       );
                                     }} 
                                     title={isDayEnded ? getDayEndedBlockMessage() : 'Edit User'}
                                     className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                   >
                                     <Edit2 size={13}/>
                                   </button>
                                   <button 
                                     type="button"
                                     disabled={isDayEnded}
                                     onClick={() => handleDelete(u.id)} 
                                     title={isDayEnded ? getDayEndedBlockMessage() : 'Delete User'}
                                     className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                   >
                                     <Trash2 size={13}/>
                                   </button>
                                </div>
                             </td>
                          </tr>
                        );
                      })
                   )}
                </tbody>
             </table>
          </div>
       </div>

       {/* Manual Enrollment Modal */}
       {showAdd && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-900 animate-in zoom-in-95 duration-200">
                <div className="p-6 md:p-8 max-h-[90vh] overflow-y-auto">
                   <div className="flex items-center justify-between mb-6 border-b pb-4">
                      <div className="flex items-center space-x-3">
                         <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><UserPlus size={22}/></div>
                         <div>
                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Manual User Enrollment</h3>
                            <p className="text-xs text-slate-500 font-medium">Enroll user with secure credentials & 3-month expiry policy</p>
                         </div>
                      </div>
                      <button onClick={() => setShowAdd(false)} className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:text-rose-600"><X size={18}/></button>
                   </div>
                   
                   <DayEndFieldset>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                         <label className="text-[11px] font-black uppercase text-slate-600">Full Name <span className="text-rose-500">*</span></label>
                         <input type="text" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} placeholder="e.g. Ram Bahadur Thapa" className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[11px] font-black uppercase text-slate-600">Username <span className="text-rose-500">*</span></label>
                         <input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s+/g, '')})} placeholder="e.g. ram.thapa" className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500 font-mono" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[11px] font-black uppercase text-slate-600">Mobile Number</label>
                         <input type="text" value={newUser.mobile} onChange={e => setNewUser({...newUser, mobile: e.target.value})} placeholder="98XXXXXXXX" className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500" />
                      </div>

                      <div className="col-span-2 space-y-1">
                         <label className="text-[11px] font-black uppercase text-slate-600">
                            Security Password (Min 8, Capital, Small, Number, Symbol) <span className="text-rose-500">*</span>
                         </label>
                         <input 
                           type="text" 
                           value={newUser.password} 
                           onChange={e => setNewUser({...newUser, password: e.target.value})} 
                           placeholder="e.g. User@2026" 
                           className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-mono font-bold text-xs outline-none focus:border-blue-500" 
                         />
                      </div>

                      {/* Password Requirements Guide */}
                      <div className="col-span-2">
                         <PasswordRequirementGuide password={newUser.password || ''} />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[11px] font-black uppercase text-slate-600">Role</label>
                         <select value={newUser.roleId} onChange={e => setNewUser({...newUser, roleId: e.target.value})} className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500">
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                         </select>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[11px] font-black uppercase text-slate-600">Base Branch</label>
                         <select value={newUser.branchId} onChange={e => setNewUser({...newUser, branchId: e.target.value})} className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-bold text-xs outline-none focus:border-blue-500">
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                         </select>
                      </div>

                      {!(newUser.roleId === '1' || getRoleName(newUser.roleId || '').toLowerCase().includes('super')) && (
                        <div className="col-span-2 bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-emerald-900">
                              Micro-Finance Branch Access (Optional)
                            </span>
                            <span className="text-[9px] font-bold text-emerald-700">
                              Cross-branch visibility
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {([
                              { id: 'login_only', label: 'Login Branch Only' },
                              { id: 'all', label: 'All Branches' },
                              { id: 'selected', label: 'Selected Branches' }
                            ] as const).map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setNewMfBranchMode(opt.id);
                                  if (opt.id === 'selected' && newMfBranchIds.length === 0 && newUser.branchId) {
                                    setNewMfBranchIds([resolveCanonicalBranchKey(newUser.branchId, branches)]);
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                                  newMfBranchMode === opt.id
                                    ? 'bg-[#00593B] text-white border-[#00593B]'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {newMfBranchMode === 'selected' && (
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              {branches.map(b => {
                                const bKey = resolveCanonicalBranchKey(b.id, branches);
                                const isChecked = newMfBranchIds.includes(bKey);
                                return (
                                  <label
                                    key={b.id}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                                      isChecked
                                        ? 'bg-white border-emerald-500 text-emerald-900'
                                        : 'bg-white/70 border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setNewMfBranchIds(prev => Array.from(new Set([...prev, bKey])));
                                        } else {
                                          setNewMfBranchIds(prev => prev.filter(k => k !== bKey));
                                        }
                                      }}
                                      className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300"
                                    />
                                    <span className="truncate">{b.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {!(newUser.roleId === '1' || getRoleName(newUser.roleId || '').toLowerCase().includes('super')) && (
                        <div className="col-span-2 bg-teal-50/60 border border-teal-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-teal-900">
                              Insurance Branch Access (Optional)
                            </span>
                            <span className="text-[9px] font-bold text-teal-700">
                              Dashboard, Report & Alerts
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {([
                              { id: 'inherit_role', label: 'Role Default' },
                              { id: 'login_only', label: 'Own Branch Only' },
                              { id: 'all', label: 'All Branches' },
                              { id: 'selected', label: 'Selected' }
                            ] as const).map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setNewInsBranchMode(opt.id);
                                  if (opt.id === 'selected' && newInsBranchIds.length === 0 && newUser.branchId) {
                                    setNewInsBranchIds([resolveCanonicalBranchKey(newUser.branchId, branches)]);
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                                  newInsBranchMode === opt.id
                                    ? 'bg-[#015e52] text-white border-[#015e52]'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {newInsBranchMode === 'selected' && (
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              {branches.map(b => {
                                const bKey = resolveCanonicalBranchKey(b.id, branches);
                                const isChecked = newInsBranchIds.includes(bKey);
                                return (
                                  <label
                                    key={b.id}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                                      isChecked
                                        ? 'bg-white border-teal-500 text-teal-900'
                                        : 'bg-white/70 border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setNewInsBranchIds(prev => Array.from(new Set([...prev, bKey])));
                                        } else {
                                          setNewInsBranchIds(prev => prev.filter(k => k !== bKey));
                                        }
                                      }}
                                      className="w-3.5 h-3.5 rounded text-teal-600 border-slate-300"
                                    />
                                    <span className="truncate">{b.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                   </div>
                   </DayEndFieldset>
                   
                   <div className="flex justify-end space-x-3 pt-6 border-t mt-5">
                      <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100">Cancel</button>
                      <button type="button" disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} onClick={handleAdd} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg hover:bg-blue-600 transition-all active:scale-95 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                         <UserCheck size={16} />
                         <span>Enroll User</span>
                      </button>
                   </div>
                </div>
             </div>
          </div>
       )}

       {/* Edit User Modal */}
       {editingUser && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                   <div className="flex items-center space-x-2">
                      <Edit2 size={18} className="text-blue-400" />
                      <div>
                         <h3 className="text-sm font-black uppercase italic leading-none">Edit User Account</h3>
                         <p className="text-[10px] text-slate-300 mt-0.5 font-bold">Edit branch, role, security credentials and password policy</p>
                      </div>
                   </div>
                   <button onClick={() => setEditingUser(null)} className="p-1 text-slate-400 hover:text-white"><X size={18}/></button>
                </div>
                
                <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                   <DayEndFieldset>
                   <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                      <div className="col-span-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase">Full Name</label>
                         <input 
                            type="text" 
                            value={editingUser.fullName} 
                            onChange={e => setEditingUser({ ...editingUser, fullName: e.target.value })}
                            className="w-full h-9 border border-slate-300 rounded-lg px-3 bg-slate-50 font-bold text-slate-900 mt-1"
                         />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-500 uppercase">Username (Immutable)</label>
                         <input 
                            type="text" 
                            value={editingUser.username} 
                            disabled 
                            className="w-full h-9 border border-slate-200 rounded-lg px-3 bg-slate-100 font-mono font-bold text-slate-500 mt-1 cursor-not-allowed"
                         />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-500 uppercase">Email</label>
                         <input 
                            type="email" 
                            value={editingUser.email || ''} 
                            onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                            placeholder="user@example.com"
                            className="w-full h-9 border border-slate-300 rounded-lg px-3 bg-white font-bold text-slate-900 mt-1"
                         />
                      </div>
                      
                      <div className="col-span-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase">
                            Security Password
                         </label>
                         <input 
                            type="text" 
                            value={editingUser.password || ''} 
                            onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                            placeholder="Enter new strong password..."
                            className="w-full h-9 border border-slate-300 rounded-lg px-3 bg-white font-mono font-bold text-slate-900 mt-1"
                         />
                      </div>

                      {/* Password Guide for Edit Modal if password altered */}
                      {editingUser.password !== originalEditPassword && (
                        <div className="col-span-2">
                           <PasswordRequirementGuide password={editingUser.password || ''} />
                        </div>
                      )}

                      <div className="col-span-2 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                         <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                               type="checkbox" 
                               checked={Boolean(editingUser.forcePasswordChange)} 
                               onChange={e => setEditingUser({ ...editingUser, forcePasswordChange: e.target.checked })}
                               className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                            />
                            <span className="text-[11px] font-bold text-slate-800">
                               Force Password Change on Next Login
                            </span>
                         </label>
                      </div>

                      <div>
                         <label className="text-[10px] font-black text-slate-500 uppercase">Role</label>
                         <select 
                            value={editingUser.roleId} 
                            onChange={e => setEditingUser({ ...editingUser, roleId: e.target.value })}
                            className="w-full h-9 border border-slate-300 rounded-lg px-3 bg-white font-bold text-slate-900 mt-1"
                         >
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-500 uppercase">Branch</label>
                         <select 
                            value={editingUser.branchId} 
                            onChange={e => setEditingUser({ ...editingUser, branchId: e.target.value })}
                            className="w-full h-9 border border-slate-300 rounded-lg px-3 bg-white font-bold text-slate-900 mt-1"
                         >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-500 uppercase">Mobile Number</label>
                         <input 
                            type="text" 
                            value={editingUser.mobile || ''} 
                            onChange={e => setEditingUser({ ...editingUser, mobile: e.target.value })}
                            className="w-full h-9 border border-slate-300 rounded-lg px-3 bg-white font-bold text-slate-900 mt-1"
                         />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-500 uppercase">Status</label>
                         <select 
                            value={editingUser.status} 
                            onChange={e => setEditingUser({ ...editingUser, status: e.target.value as 'Active' | 'Inactive' })}
                            className="w-full h-9 border border-slate-300 rounded-lg px-3 bg-white font-bold text-slate-900 mt-1"
                         >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                         </select>
                      </div>

                      {!(editingUser.username === 'admin' || editingUser.roleId === '1' || getRoleName(editingUser.roleId).toLowerCase().includes('super')) && (
                        <div className="col-span-2 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2 mt-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-emerald-900 flex items-center gap-1.5">
                              <Building2 size={12} className="text-emerald-700" />
                              <span>Micro-Finance Branch Access</span>
                            </span>
                            <span className="text-[9px] font-bold text-emerald-700">
                              All MF Sub-Menus Visibility
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {([
                              { id: 'login_only', label: 'Login Branch Only' },
                              { id: 'all', label: 'All Branches' },
                              { id: 'selected', label: 'Selected Branches' }
                            ] as const).map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setEditMfBranchMode(opt.id);
                                  if (opt.id === 'selected' && editMfBranchIds.length === 0 && editingUser.branchId) {
                                    setEditMfBranchIds([resolveCanonicalBranchKey(editingUser.branchId, branches)]);
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                                  editMfBranchMode === opt.id
                                    ? 'bg-[#00593B] text-white border-[#00593B] shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {editMfBranchMode === 'selected' && (
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              {branches.map(b => {
                                const bKey = resolveCanonicalBranchKey(b.id, branches);
                                const isChecked = editMfBranchIds.includes(bKey);
                                const isOwnBranch = bKey === resolveCanonicalBranchKey(editingUser.branchId, branches);
                                return (
                                  <label
                                    key={b.id}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                                      isChecked
                                        ? 'bg-white border-emerald-500 text-emerald-900'
                                        : 'bg-white/70 border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setEditMfBranchIds(prev => Array.from(new Set([...prev, bKey])));
                                        } else {
                                          setEditMfBranchIds(prev => prev.filter(k => k !== bKey));
                                        }
                                      }}
                                      className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300"
                                    />
                                    <span className="truncate">{b.name}</span>
                                    {isOwnBranch && (
                                      <span className="ml-auto text-[8px] font-black uppercase text-emerald-600">Own</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          <p className="text-[9px] font-semibold text-slate-500 leading-tight">
                            {editMfBranchMode === 'login_only' && 'Default: User only sees Micro-Finance data of their logged-in branch.'}
                            {editMfBranchMode === 'all' && 'Designated Access: User can view & filter Micro-Finance data of all branches.'}
                            {editMfBranchMode === 'selected' && 'Designated Access: User can view Micro-Finance data of the checked branches (plus their login branch).'}
                          </p>
                          {(() => {
                            if (editMfBranchMode === 'login_only') return null;
                            const selectedRole = roles.find(r => r.id === editingUser.roleId);
                            const rolePerms = Array.isArray(selectedRole?.permissions) ? selectedRole.permissions : [];
                            const hasRoleMfPerm = rolePerms.some(
                              p => typeof p === 'string' && (p === 'view_microfinance' || p.startsWith('sub_mf_'))
                            );
                            if (hasRoleMfPerm) return null;
                            return (
                              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-amber-800">
                                <AlertCircle size={12} className="shrink-0 mt-0.5 text-amber-600" />
                                <span>
                                  Selected role ({selectedRole?.name || 'Unknown'}) does not have Micro-Finance menu access yet. Assign the Micro Finance role or enable Micro-Finance permissions in Role Management.
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {!(editingUser.username === 'admin' || editingUser.roleId === '1' || getRoleName(editingUser.roleId).toLowerCase().includes('super')) && (
                        <div className="col-span-2 bg-teal-50/70 border border-teal-200 rounded-xl p-3 space-y-2 mt-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-teal-900 flex items-center gap-1.5">
                              <Building2 size={12} className="text-teal-700" />
                              <span>Insurance Branch Access</span>
                            </span>
                            <span className="text-[9px] font-bold text-teal-700">
                              Dashboard, Report & Alerts
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {([
                              { id: 'inherit_role', label: 'Role Default' },
                              { id: 'login_only', label: 'Own Branch Only' },
                              { id: 'all', label: 'All Branches' },
                              { id: 'selected', label: 'Selected' }
                            ] as const).map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setEditInsBranchMode(opt.id);
                                  if (opt.id === 'selected' && editInsBranchIds.length === 0 && editingUser.branchId) {
                                    setEditInsBranchIds([resolveCanonicalBranchKey(editingUser.branchId, branches)]);
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                                  editInsBranchMode === opt.id
                                    ? 'bg-[#015e52] text-white border-[#015e52] shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {editInsBranchMode === 'selected' && (
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              {branches.map(b => {
                                const bKey = resolveCanonicalBranchKey(b.id, branches);
                                const isChecked = editInsBranchIds.includes(bKey);
                                const isOwnBranch = bKey === resolveCanonicalBranchKey(editingUser.branchId, branches);
                                return (
                                  <label
                                    key={b.id}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                                      isChecked
                                        ? 'bg-white border-teal-500 text-teal-900'
                                        : 'bg-white/70 border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setEditInsBranchIds(prev => Array.from(new Set([...prev, bKey])));
                                        } else {
                                          setEditInsBranchIds(prev => prev.filter(k => k !== bKey));
                                        }
                                      }}
                                      className="w-3.5 h-3.5 rounded text-teal-600 border-slate-300"
                                    />
                                    <span className="truncate">{b.name}</span>
                                    {isOwnBranch && (
                                      <span className="ml-auto text-[8px] font-black uppercase text-teal-600">Own</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          <p className="text-[9px] font-semibold text-slate-600 leading-tight">
                            {editInsBranchMode === 'inherit_role' && (() => {
                              const selectedRole = roles.find(r => r.id === editingUser.roleId);
                              const roleScope = parseUserInsuranceBranchAccess([], selectedRole?.permissions, editingUser.branchId, branches);
                              const scopeText =
                                roleScope.mode === 'all'
                                  ? 'All Branches'
                                  : roleScope.mode === 'selected'
                                    ? `${roleScope.allowedBranchKeys.length} Selected Branches`
                                    : 'Own Login Branch Only';
                              return `Follows Role (${selectedRole?.name || 'Unknown'}): ${scopeText}.`;
                            })()}
                            {editInsBranchMode === 'login_only' && 'Override: User strictly sees Insurance data of their logged-in branch only.'}
                            {editInsBranchMode === 'all' && 'Override: User can view & filter Insurance data of all branches.'}
                            {editInsBranchMode === 'selected' && 'Override: User can view & filter Insurance data of the checked branches (plus own login branch).'}
                          </p>
                        </div>
                      )}
                   </div>
                   </DayEndFieldset>

                   <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                      <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                      <button type="button" disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} onClick={handleSaveEditUser} className="bg-slate-900 text-white px-5 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-blue-600 transition-all flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                         <UserCheck size={14} />
                         <span>Save Changes</span>
                      </button>
                   </div>
                </div>
             </div>
          </div>
       )}

       {/* Super Admin Password Reset Modal */}
       {resetUser && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border-2 border-amber-500 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-slate-900 text-white p-5 flex items-center justify-between">
                   <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
                         <KeyRound size={22} className="text-white" />
                      </div>
                      <div>
                         <div className="inline-block bg-white/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-full mb-0.5">
                            Super Admin Action
                         </div>
                         <h3 className="text-base font-black uppercase tracking-tight">Reset User Password</h3>
                      </div>
                   </div>
                   <button 
                     onClick={() => { setResetUser(null); setResetSuccessData(null); }} 
                     className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                   >
                      <X size={18}/>
                   </button>
                </div>

                {resetSuccessData ? (
                   /* Success Screen with Copy & Email Delivery Status */
                   <div className="p-6 md:p-8 text-center space-y-5">
                      <div className="w-14 h-14 bg-emerald-100 border-2 border-emerald-400 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                         <Check size={28} strokeWidth={2.5} className="text-emerald-600" />
                      </div>
                      <div className="space-y-1">
                         <h4 className="text-base md:text-lg font-black text-slate-900 tracking-tight">Password Reset Successfully!</h4>
                         <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            User <strong className="text-slate-900 font-mono">@{resetSuccessData.user.username}</strong> has been assigned a new password.
                         </p>
                      </div>

                      {/* Credentials Display Box */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 font-mono">
                         <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                            <span className="text-slate-500 font-sans font-bold">Username:</span>
                            <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">@{resetSuccessData.user.username}</span>
                         </div>
                         <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-sans font-bold">Temporary Password:</span>
                            <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{resetSuccessData.tempPass}</span>
                         </div>
                      </div>

                      {/* Email Delivery Status Badge */}
                      {resetSuccessData.emailSent ? (
                         resetSuccessData.emailSent.success ? (
                           <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 text-left font-medium flex items-center space-x-2">
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                              <span>Credentials email successfully sent to <strong>{resetSuccessData.emailTarget}</strong></span>
                           </div>
                         ) : (
                           <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 text-left font-medium flex items-center space-x-2">
                              <AlertCircle size={16} className="text-amber-600 shrink-0" />
                              <span>Password saved, but email notification failed: {resetSuccessData.emailSent.message}</span>
                           </div>
                         )
                      ) : (
                         <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 text-left font-medium flex items-center space-x-2">
                            <Mail size={16} className="text-blue-600 shrink-0" />
                            <span>No email was dispatched. Please share credentials securely.</span>
                         </div>
                      )}

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 text-left font-medium">
                         ℹ️ <strong>Note:</strong> The user will be required to change their password to a custom password upon their next login.
                      </div>

                      <div className="flex items-center space-x-3 pt-2">
                         <button
                           type="button"
                           onClick={handleCopyCredentials}
                           className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
                         >
                            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                            <span>{copied ? 'Copied!' : 'Copy Credentials'}</span>
                         </button>
                         <button
                           type="button"
                           onClick={() => { setResetUser(null); setResetSuccessData(null); }}
                           className="px-5 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                         >
                            Close
                         </button>
                      </div>
                   </div>
                ) : (
                   /* Reset Input Form */
                   <div className="p-6 md:p-7 space-y-4">
                      <DayEndFieldset className="space-y-4">
                      {/* Target User Info Summary */}
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between">
                         <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black uppercase text-sm border border-amber-200">
                               {resetUser.fullName?.charAt(0) || 'U'}
                            </div>
                            <div>
                               <div className="text-xs font-black text-slate-900">{resetUser.fullName}</div>
                               <div className="text-[10px] text-slate-500 font-mono font-bold">@{resetUser.username} • {getBranchName(resetUser.branchId)}</div>
                            </div>
                         </div>
                         <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-200">
                            {getRoleName(resetUser.roleId)}
                         </span>
                      </div>

                      {/* Temporary Password Input */}
                      <div className="space-y-1.5">
                         <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider">
                               New / Temporary Password <span className="text-rose-500">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={handleGenerateRandomPass}
                              className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200/80 transition-all cursor-pointer"
                            >
                               <Sparkles size={13} className="text-amber-600" />
                               <span>Auto-Generate</span>
                            </button>
                         </div>
                         
                         <div className="relative">
                            <input 
                              type={showTempPassword ? 'text' : 'password'} 
                              value={tempPassword} 
                              onChange={e => setTempPassword(e.target.value)}
                              placeholder="Enter or generate password"
                              className="w-full h-11 bg-slate-50 border-2 border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl px-3.5 pr-10 font-mono font-bold text-xs text-slate-900 outline-none transition-all"
                            />
                            <button 
                              type="button" 
                              onClick={() => setShowTempPassword(!showTempPassword)} 
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                               {showTempPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                         </div>
                      </div>

                      {/* Email Notification Option */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                         <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800">
                               <input 
                                 type="checkbox" 
                                 checked={sendEmail} 
                                 onChange={e => setSendEmail(e.target.checked)}
                                 className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                               />
                               <span className="flex items-center space-x-1.5">
                                  <Mail size={14} className="text-amber-600" />
                                  <span>Send Credentials to User Email</span>
                               </span>
                            </label>
                         </div>

                         {sendEmail && (
                            <div className="space-y-1.5 pt-1">
                               <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                                  Recipient Email Address
                                </label>
                               <input 
                                 type="email"
                                 value={resetEmail}
                                 onChange={e => setResetEmail(e.target.value)}
                                 placeholder="e.g. user@example.com"
                                 className="w-full h-9 bg-white border border-slate-300 focus:border-amber-500 rounded-lg px-3 text-xs font-bold text-slate-800 outline-none"
                               />
                               <p className="text-[10px] text-slate-500 leading-tight">
                                  An email with the formatted credentials template (Username, Password, Login link) will be delivered.
                               </p>
                            </div>
                         )}
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-amber-900 text-[11px] leading-relaxed font-medium">
                         <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-600" />
                         <span>
                            After resetting this password, the user will be required to change their password on next login.
                         </span>
                      </div>
                      </DayEndFieldset>

                      <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                         <button 
                           type="button" 
                           onClick={() => setResetUser(null)} 
                           className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
                         >
                            Cancel
                         </button>
                         <button 
                           type="button" 
                           onClick={handleExecuteResetPassword}
                           disabled={isResetting || !tempPassword || isDayEnded}
                           title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                           className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-95 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-600/20 flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                         >
                            {isResetting ? <RefreshCw size={15} className="animate-spin" /> : <KeyRound size={15} />}
                            <span>{isResetting ? 'Resetting...' : 'Confirm Reset Password'}</span>
                         </button>
                      </div>
                   </div>
                )}
             </div>
          </div>
       )}

      <ConfirmationModal 
        isOpen={confirmDelete?.isOpen || false}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default UserManagement;
