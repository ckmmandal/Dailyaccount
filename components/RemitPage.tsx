import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Globe, Copy, Check, Eye, EyeOff, 
  Plus, Edit3, Trash2, Printer, CheckCircle2,
  Image as ImageIcon, Upload, X, Sparkles, Building2, RefreshCw,
  Info
} from 'lucide-react';
import { RemittanceCompany } from '../types';
import { storageService } from '../services/storageService';
import { useAuth } from '../AuthContext';
import { getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const DEFAULT_BRANCH_LIST: { id: string; name: string }[] = [
  { id: 'main', name: 'Head Office (Ratauli)' },
  { id: 'sahodba', name: 'Sahodba Branch' },
  { id: 'pipra', name: 'Pipra Branch' },
  { id: 'parsa', name: 'Parsa Branch' }
];

export const RemitPage: React.FC = () => {
  const { user, isSuperAdmin, branches: authBranches } = useAuth();

  const isHeadOfficeOrAdmin = useMemo(() => {
    if (isSuperAdmin) return true;
    const b = (user?.branchId || '').toLowerCase().trim();
    return !b || b === 'main' || b === 'headoffice' || b === 'head_office' || user?.roleId === '1';
  }, [isSuperAdmin, user?.branchId, user?.roleId]);

  const userBranchId = useMemo(() => {
    const b = (user?.branchId || '').toLowerCase().trim();
    if (!b || b === 'main' || b === 'headoffice' || b === 'head_office') return 'main';
    return b;
  }, [user?.branchId]);

  // Combined branch list
  const availableBranches = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    DEFAULT_BRANCH_LIST.forEach(b => map.set(b.id.toLowerCase(), b));
    if (authBranches && Array.isArray(authBranches)) {
      authBranches.forEach(b => {
        if (b && b.id) map.set(b.id.toLowerCase(), { id: b.id.toLowerCase(), name: b.name });
      });
    }
    return Array.from(map.values());
  }, [authBranches]);

  // Active branch filter for Head Office / Super Admin
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(() => {
    return isHeadOfficeOrAdmin ? 'all' : userBranchId;
  });

  useEffect(() => {
    if (!isHeadOfficeOrAdmin) {
      setSelectedBranchFilter(userBranchId);
    }
  }, [isHeadOfficeOrAdmin, userBranchId]);

  const isDayEnded = useDayEndLock(isHeadOfficeOrAdmin && selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined);

  const [companies, setCompanies] = useState<RemittanceCompany[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hidden password tracking (PASSWORDS ARE SHOWN IN CLEARTEXT BY DEFAULT!)
  const [hiddenPasswords, setHiddenPasswords] = useState<Record<string, boolean>>({});

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isPasswordOnlyModalOpen, setIsPasswordOnlyModalOpen] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<RemittanceCompany | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleManualSyncToSupabase = async () => {
    try {
      setIsSyncing(true);
      setToastMessage('Syncing with Supabase...');
      const res = await storageService.syncAllRemittanceToSupabase();
      if (res.success) {
        setToastMessage(`✅ Synced ${res.count} partners to Supabase!`);
      } else {
        setToastMessage(`⚠️ Supabase notice: ${res.error || 'Connection restricted'}`);
      }
    } catch (err: any) {
      setToastMessage(`⚠️ Sync error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    displayOrder: 1,
    branchId: 'all',
    username: '',
    password: '',
    accessId: '',
    hasPin: false,
    txnPin: '',
    contactPhone: '',
    code: '',
    portalUrl: '',
    status: 'Active' as 'Active' | 'Inactive' | 'Maintenance'
  });

  // Branch operator quick password update state
  const [branchNewPassword, setBranchNewPassword] = useState('');

  const isMountedRef = useRef<boolean>(true);

  const loadCompanies = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const data = await storageService.getRemittanceCompanies();
      if (isMountedRef.current) {
        setCompanies(data || []);
      }
    } catch (error) {
      console.error('Failed to load remittance companies:', error);
    } finally {
      if (isMountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadCompanies(false);

    const handleUpdate = () => {
      // Background silent update without setting isLoading to true
      loadCompanies(true);
    };

    window.addEventListener('remittanceCompaniesUpdated', handleUpdate);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('remittanceCompaniesUpdated', handleUpdate);
    };
  }, []);

  const handleCopy = (text: string, label: string, uniqueKey: string) => {
    if (!text || text === '-' || text === 'Not configured') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(uniqueKey);
    setToastMessage(`Copied ${label}!`);
    setTimeout(() => setCopiedKey(null), 1500);
    setTimeout(() => setToastMessage(null), 2200);
  };

  // Toggle password visibility (hidden only when user explicitly toggles it)
  const togglePasswordVisibility = (id: string) => {
    setHiddenPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const openAddModal = () => {
    if (!isHeadOfficeOrAdmin) {
      alert('Only Head Office / Super Admin can add new remittance partners.');
      return;
    }
    setEditingCompany(null);
    const nextOrder = companies.length > 0 
      ? Math.max(...companies.map(c => Number(c.displayOrder || 0))) + 1 
      : 1;

    setFormData({
      name: '',
      logoUrl: '',
      displayOrder: nextOrder,
      branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : 'all',
      username: '',
      password: '',
      accessId: '',
      hasPin: false,
      txnPin: '',
      contactPhone: '',
      code: '',
      portalUrl: '',
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (comp: RemittanceCompany) => {
    setEditingCompany(comp);

    // Determine target branch context: if viewing All Branches, keep 'all' mode to update template
    const targetBranch = selectedBranchFilter !== 'all' 
      ? selectedBranchFilter 
      : (comp.branchId && comp.branchId !== 'main' ? comp.branchId : 'all');

    if (!isHeadOfficeOrAdmin) {
      // Branch user can ONLY change password
      setBranchNewPassword(comp.password || '');
      setIsPasswordOnlyModalOpen(true);
      return;
    }

    // Head Office / Super Admin can edit all fields
    setFormData({
      name: comp.name || '',
      logoUrl: comp.logoUrl || '',
      displayOrder: comp.displayOrder !== undefined ? comp.displayOrder : 1,
      branchId: targetBranch,
      username: comp.username || '',
      password: comp.password || '',
      accessId: comp.accessId || '',
      hasPin: comp.hasPin !== undefined ? comp.hasPin : !!comp.txnPin,
      txnPin: comp.txnPin || '',
      contactPhone: comp.contactPhone || '',
      code: comp.code || '',
      portalUrl: comp.portalUrl || '',
      status: comp.status || 'Active'
    });
    setIsModalOpen(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size exceeds 2MB limit. Please choose a smaller image.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const generateRandomPassword = (forBranchOnly = false) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (forBranchOnly) {
      setBranchNewPassword(res);
    } else {
      setFormData(prev => ({ ...prev, password: res }));
    }
  };

  // Full save for Head Office / Super Admin
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter company name.');
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];

    // CASE 1: All Branches (Common Template Mode) selected
    // Creates or updates company name, S.N., logo, and contact across EVERY branch!
    // Preserves each branch's existing username, password, access ID, PIN.
    if (formData.branchId === 'all') {
      const branchesToSync = availableBranches.length > 0 
        ? availableBranches 
        : DEFAULT_BRANCH_LIST;

      for (const b of branchesToSync) {
        // Find existing record for this branch by matching name or existing edited ID
        const existing = companies.find(c => 
          (c.branchId || 'main').toLowerCase() === b.id.toLowerCase() &&
          (c.name.trim().toLowerCase() === formData.name.trim().toLowerCase() ||
           (editingCompany && c.name.trim().toLowerCase() === editingCompany.name.trim().toLowerCase()))
        );

        const payload: RemittanceCompany = {
          id: existing ? existing.id : `remit_${b.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: formData.name.trim(),
          logoUrl: formData.logoUrl.trim() || undefined,
          displayOrder: Number(formData.displayOrder) || 1,
          branchId: b.id,
          code: formData.code.trim() || undefined,
          username: existing ? existing.username : '',
          password: existing ? existing.password : '',
          accessId: existing ? existing.accessId : '',
          hasPin: formData.hasPin,
          txnPin: formData.hasPin ? (existing ? existing.txnPin : undefined) : undefined,
          contactPhone: formData.contactPhone.trim() || undefined,
          portalUrl: formData.portalUrl.trim() || undefined,
          status: formData.status,
          lastPasswordChanged: existing?.lastPasswordChanged || todayDate,
          createdAt: existing ? existing.createdAt : Date.now(),
          updatedAt: Date.now()
        };

        await storageService.saveRemittanceCompany(payload);
      }

      const syncResult = await storageService.syncAllRemittanceToSupabase();
      setIsModalOpen(false);
      if (syncResult.success) {
        setToastMessage('Saved & synced across all branches in Supabase!');
      } else {
        setToastMessage(`Saved locally! Supabase note: ${syncResult.error || 'Check project status'}`);
      }
      setTimeout(() => setToastMessage(null), 3500);
      loadCompanies();
      return;
    }

    // CASE 2: Specific Branch Selected (e.g. main, sahodba, pipra, parsa)
    // Username, Password, Access ID, and PIN are required for that specific branch!
    if (!formData.username.trim()) {
      alert('Please enter username for this branch.');
      return;
    }
    if (!formData.password.trim()) {
      alert('Please enter password for this branch.');
      return;
    }
    if (!formData.accessId.trim()) {
      alert('Please enter access ID for this branch.');
      return;
    }
    if (formData.hasPin && !formData.txnPin.trim()) {
      alert('Please enter the PIN or set Require PIN to No.');
      return;
    }

    const isPasswordChanged = !editingCompany || editingCompany.password !== formData.password;

    const payload: RemittanceCompany = {
      id: editingCompany ? editingCompany.id : `remit_${formData.branchId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: formData.name.trim(),
      logoUrl: formData.logoUrl.trim() || undefined,
      displayOrder: Number(formData.displayOrder) || 1,
      branchId: formData.branchId,
      code: formData.code.trim() || undefined,
      accessId: formData.accessId.trim(),
      username: formData.username.trim(),
      password: formData.password.trim(),
      hasPin: formData.hasPin,
      txnPin: formData.hasPin ? formData.txnPin.trim() : undefined,
      contactPhone: formData.contactPhone.trim() || undefined,
      portalUrl: formData.portalUrl.trim() || undefined,
      status: formData.status,
      lastPasswordChanged: isPasswordChanged ? todayDate : (editingCompany?.lastPasswordChanged || todayDate),
      createdAt: editingCompany ? editingCompany.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    const res = await storageService.saveRemittanceCompany(payload);
    setIsModalOpen(false);
    if (res.supabaseSynced) {
      setToastMessage('Branch credentials updated and saved to Supabase!');
    } else {
      setToastMessage(`Branch credentials saved locally! Supabase note: ${res.error || 'Offline'}`);
    }
    setTimeout(() => setToastMessage(null), 3500);
    loadCompanies();
  };

  // Password-only save for Branch Operators
  const handleSaveBranchPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    if (!branchNewPassword.trim()) {
      alert('Please enter the new password.');
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const updated: RemittanceCompany = {
      ...editingCompany,
      password: branchNewPassword.trim(),
      lastPasswordChanged: todayDate,
      updatedAt: Date.now()
    };

    const res = await storageService.saveRemittanceCompany(updated);
    setIsPasswordOnlyModalOpen(false);
    if (res.supabaseSynced) {
      setToastMessage('Password updated and saved to Supabase!');
    } else {
      setToastMessage(`Password saved locally! Supabase note: ${res.error || 'Offline'}`);
    }
    setTimeout(() => setToastMessage(null), 3500);
    loadCompanies();
  };

  const handleDelete = async (comp: RemittanceCompany) => {
    if (!isHeadOfficeOrAdmin) {
      alert('Only Head Office / Super Admin can delete remittance partners.');
      return;
    }
    if (window.confirm(`Delete "${comp.name}" login record for ${getBranchLabel(comp.branchId)}?`)) {
      const res = await storageService.deleteRemittanceCompany(comp.id);
      if (res.supabaseSynced) {
        setToastMessage(`Deleted "${comp.name}" from Supabase & local!`);
      } else {
        setToastMessage(`Deleted locally! Supabase note: ${res.error || 'Offline'}`);
      }
      setTimeout(() => setToastMessage(null), 3500);
      loadCompanies();
    }
  };

  // Filter and sort companies so EVERY branch has all companies
  const filteredAndSortedCompanies = useMemo(() => {
    let list = [...companies];
    const targetBranch = (isHeadOfficeOrAdmin ? selectedBranchFilter : userBranchId).toLowerCase();

    if (targetBranch === 'all') {
      // In 'All Branches' mode, show unique company cards (preferring Head Office / main credentials)
      const uniqueMap = new Map<string, RemittanceCompany>();
      list.forEach(c => {
        const key = c.name.trim().toLowerCase();
        if (!uniqueMap.has(key) || (c.branchId || 'main').toLowerCase() === 'main') {
          uniqueMap.set(key, c);
        }
      });
      list = Array.from(uniqueMap.values());
    } else {
      // When a specific branch is selected (e.g. main, sahodba, pipra, parsa):
      // 1. Get records existing specifically for this branch
      const branchItems = list.filter(c => (c.branchId || 'main').toLowerCase() === targetBranch);

      // 2. Ensure any company created in other branches/all is also visible in this branch
      const allCompanyNames = Array.from(new Set(list.map(c => c.name.trim())));
      const branchCompanyNames = new Set(branchItems.map(c => c.name.trim()));

      const missingForBranch: RemittanceCompany[] = [];
      allCompanyNames.forEach(name => {
        if (!branchCompanyNames.has(name)) {
          const master = list.find(c => c.name.trim() === name);
          if (master) {
            missingForBranch.push({
              ...master,
              id: `remit_${targetBranch}_${master.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              branchId: targetBranch,
              username: '',
              password: '',
              accessId: '',
              txnPin: undefined
            });
          }
        }
      });

      list = [...branchItems, ...missingForBranch];
    }

    // Sort by internal S.N. (displayOrder)
    list.sort((a, b) => {
      const ordA = a.displayOrder !== undefined ? Number(a.displayOrder) : 999;
      const ordB = b.displayOrder !== undefined ? Number(b.displayOrder) : 999;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }, [companies, selectedBranchFilter, isHeadOfficeOrAdmin, userBranchId]);

  const getCompanyInitialColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('prabhu')) return 'bg-rose-600 text-white';
    if (n.includes('ime')) return 'bg-orange-600 text-white';
    if (n.includes('city')) return 'bg-blue-600 text-white';
    if (n.includes('western')) return 'bg-amber-500 text-slate-950 font-black';
    if (n.includes('esewa')) return 'bg-emerald-600 text-white';
    if (n.includes('himal')) return 'bg-cyan-700 text-white';
    if (n.includes('muktinath')) return 'bg-amber-600 text-white';
    if (n.includes('surya')) return 'bg-red-600 text-white';
    return 'bg-slate-800 text-white';
  };

  const getBranchLabel = (branchId?: string) => {
    if (!branchId || branchId === 'main') return 'Head Office';
    if (branchId === 'all') return 'All Branches';
    const found = availableBranches.find(b => b.id.toLowerCase() === branchId.toLowerCase());
    return found ? found.name : branchId.toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-rose-700 flex items-center justify-center text-white shadow-xs">
            <Globe size={18} />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight text-slate-900 leading-tight">
              Remittance Login Detail
            </h1>
            <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500">
              <span>Branch:</span>
              <span className="text-rose-700 uppercase font-black">
                {isHeadOfficeOrAdmin 
                  ? (selectedBranchFilter === 'all' ? 'All Branches' : getBranchLabel(selectedBranchFilter)) 
                  : getBranchLabel(userBranchId)}
              </span>
              {!isHeadOfficeOrAdmin && (
                <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                  Password Change Only
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Branch Filter Selector (Visible for Head Office / Super Admin) */}
          {isHeadOfficeOrAdmin && (
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <Building2 size={13} className="text-slate-500 ml-1.5" />
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-2 py-0.5"
                title="Select Branch"
              >
                <option value="all">All Branches</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleManualSyncToSupabase}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg border border-sky-200 hover:border-sky-300 bg-sky-50 text-sky-800 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs hover:bg-sky-100 cursor-pointer disabled:opacity-50"
            title="Sync all credentials directly to Supabase table"
          >
            <RefreshCw size={13} className={isSyncing ? "animate-spin text-sky-600" : "text-sky-600"} />
            <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Supabase"}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs hover:bg-slate-50 cursor-pointer"
            title="Print Credentials Sheet"
          >
            <Printer size={14} />
            <span>Print Sheet</span>
          </button>

          {/* Add Partner Button (Strictly Super Admin / Head Office Only) */}
          {isHeadOfficeOrAdmin && (
            <button
              onClick={openAddModal}
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Add Remittance Partner</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area - Ultra Compact Cards Grid sorted by S.N. */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-bold uppercase tracking-wider">
            Loading...
          </div>
        ) : filteredAndSortedCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <Globe size={28} className="text-slate-400 mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Remittance Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {isHeadOfficeOrAdmin 
                ? 'No remittance partner credentials have been registered for this branch yet.' 
                : 'No remittance credentials found for your branch. Please contact Head Office.'}
            </p>
            {isHeadOfficeOrAdmin && (
              <button
                onClick={openAddModal}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="mt-3 px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add First Company
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredAndSortedCompanies.map((comp) => {
              // Passwords are SHOWN by default; hidden ONLY if user explicitly toggled it
              const isPwdVisible = !hiddenPasswords[comp.id];
              const initialColor = getCompanyInitialColor(comp.name);
              const usesPin = comp.hasPin === true || (comp.hasPin === undefined && !!comp.txnPin);

              return (
                <div 
                  key={comp.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between overflow-hidden p-3 hover:border-slate-300"
                >
                  {/* Card Header: Logo + Company Name + Action Controls (CLEAN, NO ALL BRANCHES SUBTITLE) */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      {comp.logoUrl ? (
                        <div className="w-8 h-8 rounded-lg border border-slate-200 bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                          <img 
                            src={comp.logoUrl} 
                            alt={comp.name} 
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className={`w-8 h-8 rounded-lg ${initialColor} flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-2xs`}>
                          {comp.name.substring(0, 2)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-black text-slate-900 truncate tracking-tight leading-tight" title={comp.name}>
                          {comp.name}
                        </h3>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center space-x-1 shrink-0 ml-1">
                      <button
                        onClick={() => openEditModal(comp)}
                        disabled={isDayEnded}
                        className={`p-1 rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isHeadOfficeOrAdmin 
                            ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' 
                            : 'text-rose-700 hover:bg-rose-50 border border-rose-200 px-1.5 flex items-center space-x-1'
                        }`}
                        title={isDayEnded ? getDayEndedBlockMessage() : (isHeadOfficeOrAdmin ? "Edit Remittance Details" : "Change Password")}
                      >
                        <Edit3 size={13} />
                        {!isHeadOfficeOrAdmin && <span className="text-[9px] font-bold">Password</span>}
                      </button>

                      {/* Delete is ONLY available to Super Admin / Head Office */}
                      {isHeadOfficeOrAdmin && (
                        <button
                          onClick={() => handleDelete(comp)}
                          disabled={isDayEnded}
                          className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isDayEnded ? getDayEndedBlockMessage() : "Delete Partner"}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Headings directly in front of values */}
                  {/* Order: 1. Username, 2. Password, 3. Access ID, 4. PIN (if Yes), 5. Contact */}
                  <div className="space-y-1.5 text-xs">
                    {/* 1. Username */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">Username:</span>
                        <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                          {comp.username ? comp.username : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                        </span>
                      </div>
                      {comp.username && (
                        <button
                          onClick={() => handleCopy(comp.username, 'Username', `${comp.id}_user`)}
                          className={`p-1 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
                            copiedKey === `${comp.id}_user`
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-slate-800 hover:bg-white'
                          }`}
                          title="Copy Username"
                        >
                          {copiedKey === `${comp.id}_user` ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>

                    {/* 2. Password (SHOWS BY DEFAULT; HIDES ON EYE CLICK) */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">Password:</span>
                        <span className="font-mono font-bold text-slate-900 truncate select-all text-xs tracking-wider">
                          {!comp.password ? (
                            <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>
                          ) : isPwdVisible ? (
                            comp.password
                          ) : (
                            '••••••••••••'
                          )}
                        </span>
                      </div>
                      {comp.password && (
                        <div className="flex items-center space-x-0.5 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(comp.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-white transition-all cursor-pointer"
                            title={isPwdVisible ? 'Hide Password' : 'Show Password'}
                          >
                            {isPwdVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            onClick={() => handleCopy(comp.password, 'Password', `${comp.id}_pwd`)}
                            className={`p-1 rounded text-xs transition-all cursor-pointer ${
                              copiedKey === `${comp.id}_pwd`
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-slate-800 hover:bg-white'
                            }`}
                            title="Copy Password"
                          >
                            {copiedKey === `${comp.id}_pwd` ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3. Access ID */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">Access ID:</span>
                        <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                          {comp.accessId ? comp.accessId : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                        </span>
                      </div>
                      {comp.accessId && (
                        <button
                          onClick={() => handleCopy(comp.accessId, 'Access ID', `${comp.id}_acc`)}
                          className={`p-1 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
                            copiedKey === `${comp.id}_acc`
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-slate-800 hover:bg-white'
                          }`}
                          title="Copy Access ID"
                        >
                          {copiedKey === `${comp.id}_acc` ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>

                    {/* 4. PIN (Only shown if usesPin / Has PIN is Yes) */}
                    {usesPin && (
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                          <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">PIN:</span>
                          <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                            {comp.txnPin ? (isPwdVisible ? comp.txnPin : '••••') : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                          </span>
                        </div>
                        {comp.txnPin && (
                          <button
                            onClick={() => handleCopy(comp.txnPin || '', 'PIN', `${comp.id}_pin`)}
                            className={`p-1 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
                              copiedKey === `${comp.id}_pin`
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-slate-800 hover:bg-white'
                            }`}
                            title="Copy PIN"
                          >
                            {copiedKey === `${comp.id}_pin` ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    )}

                    {/* 5. Contact Phone */}
                    {comp.contactPhone && (
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                          <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">Contact:</span>
                          <span className="font-semibold text-slate-800 truncate text-xs">
                            {comp.contactPhone}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(comp.contactPhone || '', 'Contact', `${comp.id}_contact`)}
                          className={`p-1 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
                            copiedKey === `${comp.id}_contact`
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-slate-800 hover:bg-white'
                          }`}
                          title="Copy Contact"
                        >
                          {copiedKey === `${comp.id}_contact` ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Copy Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[9999] bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-lg border border-slate-800 flex items-center space-x-2 animate-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-xs font-bold text-slate-100">{toastMessage}</span>
        </div>
      )}

      {/* Full Add / Edit Modal (Head Office / Super Admin Only) */}
      {isModalOpen && isHeadOfficeOrAdmin && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9000] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider">
                {editingCompany ? 'UPDATE REMITTANCE PARTNER' : 'ADD REMITTANCE PARTNER'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <DayEndFieldset branchId={formData.branchId === 'all' ? undefined : formData.branchId} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Internal S.N. (Serial Order) */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    S.N. (SERIAL ORDER) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.displayOrder}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                    title="Internal serial sorting order (1, 2, 3...)"
                  />
                </div>

                {/* Target Branch */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    TARGET BRANCH *
                  </label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                  >
                    <option value="all">All Branches (Common)</option>
                    <option value="main">Head Office</option>
                    {availableBranches.filter(b => b.id !== 'main').map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  COMPANY NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prabhu Remit, IME Remit"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                />
              </div>

              {/* Company Logo Upload & URL */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  COMPANY LOGO (UPLOAD OR URL)
                </label>
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon size={16} className="text-slate-400" />
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Paste logo image URL or upload"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                  />
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleLogoUpload} 
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                    title="Upload Logo"
                  >
                    <Upload size={13} />
                    <span>Upload</span>
                  </button>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                      className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Clear Logo"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* PIN Yes / No Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    REQUIRE PIN?
                  </label>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, hasPin: true }))}
                      className={`px-3 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        formData.hasPin ? 'bg-rose-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, hasPin: false, txnPin: '' }))}
                      className={`px-3 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        !formData.hasPin ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {/* Contact Field */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  CONTACT (HELPLINE / PHONE)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 01-4788500 / 9854000000"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                />
              </div>

              {/* Branch-Specific Credentials Section */}
              {formData.branchId === 'all' ? (
                /* Information note when All Branches is chosen */
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-900">
                  <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <p className="font-bold">All Branches Mode:</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      This will create <strong>{formData.name || 'this company'}</strong> across all branches with the common Name, S.N., Logo, and Contact.
                    </p>
                    <p className="text-[11px] text-amber-800 mt-1 font-semibold">
                      To enter or update <strong>Username</strong>, <strong>Password</strong>, <strong>Access ID</strong>, and <strong>PIN</strong>, select a specific branch above.
                    </p>
                  </div>
                </div>
              ) : (
                /* Specific branch credentials fields */
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center space-x-1">
                    <Building2 size={12} />
                    <span>Credentials for {getBranchLabel(formData.branchId)}</span>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      USERNAME *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ratauli_prabhu"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                    />
                  </div>

                  {/* Password with generator */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                        PASSWORD *
                      </label>
                      <button
                        type="button"
                        onClick={() => generateRandomPassword(false)}
                        className="text-[10px] font-black text-rose-700 hover:text-rose-900 uppercase flex items-center space-x-1 cursor-pointer"
                      >
                        <Sparkles size={11} />
                        <span>GENERATE</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="System password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                    />
                  </div>

                  {/* Access ID */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      ACCESS ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PRABHU-HO-101"
                      value={formData.accessId}
                      onChange={(e) => setFormData(prev => ({ ...prev, accessId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                    />
                  </div>

                  {/* PIN Field if Require PIN is Yes */}
                  {formData.hasPin && (
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        PIN *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter counter PIN (e.g. 4021)"
                        value={formData.txnPin}
                        onChange={(e) => setFormData(prev => ({ ...prev, txnPin: e.target.value }))}
                        className="w-full px-3 py-2 bg-rose-50/50 border border-rose-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                      />
                    </div>
                  )}
                </div>
              )}

              </DayEndFieldset>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formData.branchId === 'all' ? 'CREATE FOR ALL BRANCHES' : 'SAVE DETAILS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password-Only Modal for Branch Operators (Strictly Password Change Only) */}
      {isPasswordOnlyModalOpen && editingCompany && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9000] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider">
                  UPDATE PASSWORD
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">{editingCompany.name}</p>
              </div>
              <button
                onClick={() => setIsPasswordOnlyModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBranchPassword} className="p-5 space-y-3">
              <DayEndFieldset branchId={editingCompany.branchId === 'all' ? undefined : editingCompany.branchId} className="space-y-3">
              {/* Read-only info */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-slate-400">Username:</span>
                  <span className="font-mono font-bold text-slate-800">{editingCompany.username || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-slate-400">Access ID:</span>
                  <span className="font-mono font-bold text-slate-800">{editingCompany.accessId || '-'}</span>
                </div>
              </div>

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    NEW PASSWORD *
                  </label>
                  <button
                    type="button"
                    onClick={() => generateRandomPassword(true)}
                    className="text-[10px] font-black text-rose-700 hover:text-rose-900 uppercase flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles size={11} />
                    <span>GENERATE</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter new password"
                  value={branchNewPassword}
                  onChange={(e) => setBranchNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                />
              </div>
              </DayEndFieldset>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordOnlyModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  UPDATE PASSWORD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
