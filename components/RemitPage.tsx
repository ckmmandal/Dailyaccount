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

const isImeRemitProfile = (name?: string, displayOrder?: number): boolean => {
  const n = (name || '').trim().toLowerCase();
  if (n.includes('ime')) return true;
  if (!n && Number(displayOrder) === 1) return true;
  return false;
};

export const RemitPage: React.FC = () => {
  const { user, branch, isSuperAdmin, branches: authBranches } = useAuth();

  const loggedInBranchId = useMemo(() => {
    const b = (branch?.id || user?.branchId || '').toLowerCase().trim();
    if (!b || b === 'main' || b === 'headoffice' || b === 'head_office') return 'main';
    return b;
  }, [branch?.id, user?.branchId]);

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

  // Active branch filter (Super Admin can switch branches; all other users are locked to their logged-in branch)
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(() => {
    return isSuperAdmin ? 'all' : loggedInBranchId;
  });

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedBranchFilter(loggedInBranchId);
    }
  }, [isSuperAdmin, loggedInBranchId]);

  const isDayEnded = useDayEndLock(
    isSuperAdmin
      ? (selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined)
      : loggedInBranchId
  );

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setToastMessage(`⚠️ Sync error: ${msg}`);
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
    selectedBranches: [] as string[],
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
  const [isMultiBranchEditMode, setIsMultiBranchEditMode] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

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

  const getAssignedBranchesForCompany = (companyName: string): string[] => {
    const key = companyName.trim().toLowerCase();
    const allIds = availableBranches.map(b => b.id.toLowerCase());
    const matched = companies.filter(c => c.name.trim().toLowerCase() === key);
    if (matched.some(c => (c.branchId || '').toLowerCase() === 'all')) {
      return allIds;
    }
    const found = new Set<string>();
    matched.forEach(c => {
      const bId = (!c.branchId || c.branchId === 'headoffice' || c.branchId === 'head_office')
        ? 'main'
        : c.branchId.toLowerCase();
      if (allIds.includes(bId)) found.add(bId);
    });
    return allIds.filter(id => found.has(id));
  };

  const openAddModal = () => {
    if (!isSuperAdmin) {
      setToastMessage('Only Super Admin can add new remittance partners.');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }
    setEditingCompany(null);
    setFormError(null);
    setIsMultiBranchEditMode(true);
    const nextOrder = companies.length > 0
      ? Math.max(...companies.map(c => Number(c.displayOrder || 0))) + 1
      : 1;

    const allBranchIds = availableBranches.map(b => b.id.toLowerCase());
    const initialBranches = selectedBranchFilter !== 'all'
      ? [selectedBranchFilter.toLowerCase()]
      : allBranchIds;

    setFormData({
      name: '',
      logoUrl: '',
      displayOrder: nextOrder,
      branchId: initialBranches.length === 1 ? initialBranches[0] : 'all',
      selectedBranches: initialBranches,
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
    setFormError(null);

    if (!isSuperAdmin) {
      // Non-Super-Admin branch user can ONLY change password
      setBranchNewPassword(comp.password || '');
      setIsPasswordOnlyModalOpen(true);
      return;
    }

    const editingFromAllView = selectedBranchFilter === 'all';
    setIsMultiBranchEditMode(editingFromAllView);

    const assignedBranches = editingFromAllView
      ? getAssignedBranchesForCompany(comp.name)
      : [selectedBranchFilter.toLowerCase()];

    const effectiveSelectedBranches = assignedBranches.length > 0
      ? assignedBranches
      : [((!comp.branchId || comp.branchId === 'all') ? 'main' : comp.branchId).toLowerCase()];

    // If exactly 1 branch is selected, load that specific branch's existing record if available
    const singleBranchRecord = effectiveSelectedBranches.length === 1
      ? (companies.find(
          c => c.name.trim().toLowerCase() === comp.name.trim().toLowerCase() &&
               (c.branchId || 'main').toLowerCase() === effectiveSelectedBranches[0]
        ) || comp)
      : comp;

    const isIme = isImeRemitProfile(singleBranchRecord.name, singleBranchRecord.displayOrder);

    setFormData({
      name: singleBranchRecord.name || '',
      logoUrl: singleBranchRecord.logoUrl || '',
      displayOrder: singleBranchRecord.displayOrder !== undefined ? singleBranchRecord.displayOrder : 1,
      branchId: effectiveSelectedBranches.length === 1 ? effectiveSelectedBranches[0] : 'all',
      selectedBranches: effectiveSelectedBranches,
      username: singleBranchRecord.username || '',
      password: singleBranchRecord.password || '',
      accessId: singleBranchRecord.accessId || '',
      hasPin: isIme ? true : (singleBranchRecord.hasPin !== undefined ? singleBranchRecord.hasPin : !!singleBranchRecord.txnPin),
      txnPin: singleBranchRecord.txnPin || '',
      contactPhone: singleBranchRecord.contactPhone || '',
      code: singleBranchRecord.code || '',
      portalUrl: singleBranchRecord.portalUrl || '',
      status: singleBranchRecord.status || 'Active'
    });
    setIsModalOpen(true);
  };

  const toggleFormBranch = (branchId: string) => {
    const normalized = branchId.toLowerCase();
    setFormError(null);
    setFormData(prev => {
      const exists = prev.selectedBranches.includes(normalized);
      const next = exists
        ? prev.selectedBranches.filter(id => id !== normalized)
        : [...prev.selectedBranches, normalized];

      // If transitioning down to a single branch while editing, prefill that branch's existing credentials
      let nextUsername = prev.username;
      let nextPassword = prev.password;
      let nextAccessId = prev.accessId;
      let nextTxnPin = prev.txnPin;
      if (next.length === 1 && (editingCompany || prev.name.trim())) {
        const lookupName = (editingCompany?.name || prev.name).trim().toLowerCase();
        const existingRec = companies.find(
          c => c.name.trim().toLowerCase() === lookupName &&
               (c.branchId || 'main').toLowerCase() === next[0]
        );
        if (existingRec) {
          nextUsername = existingRec.username || '';
          nextPassword = existingRec.password || '';
          nextAccessId = existingRec.accessId || '';
          nextTxnPin = existingRec.txnPin || '';
        }
      }

      return {
        ...prev,
        selectedBranches: next,
        branchId: next.length === 1 ? next[0] : 'all',
        username: nextUsername,
        password: nextPassword,
        accessId: nextAccessId,
        txnPin: nextTxnPin
      };
    });
  };

  const toggleAllFormBranches = () => {
    const allIds = availableBranches.map(b => b.id.toLowerCase());
    setFormError(null);
    setFormData(prev => {
      const allSelected = allIds.every(id => prev.selectedBranches.includes(id));
      const next = allSelected ? [] : allIds;
      return {
        ...prev,
        selectedBranches: next,
        branchId: next.length === 1 ? next[0] : 'all'
      };
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setFormError('File size exceeds 2MB limit. Please choose a smaller image.');
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

  // Full save for Super Admin
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Please enter company name.');
      return;
    }

    const targetBranches = Array.from(new Set(formData.selectedBranches.map(b => b.toLowerCase())));
    if (targetBranches.length === 0) {
      setFormError('Please select at least 1 branch for this remit.');
      return;
    }

    const isIme = isImeRemitProfile(formData.name, formData.displayOrder);
    const effectiveHasPin = isIme ? true : formData.hasPin;
    const todayDate = new Date().toISOString().split('T')[0];
    const normalizedNewName = formData.name.trim().toLowerCase();
    const normalizedOldName = editingCompany ? editingCompany.name.trim().toLowerCase() : normalizedNewName;

    // CASE 1: Multiple Branches Selected (2, 3, or All Branches)
    if (targetBranches.length > 1) {
      for (const bId of targetBranches) {
        const existing = companies.find(c =>
          (c.branchId || 'main').toLowerCase() === bId &&
          (c.name.trim().toLowerCase() === normalizedNewName ||
           (editingCompany && c.name.trim().toLowerCase() === normalizedOldName))
        );

        const payload: RemittanceCompany = {
          id: existing ? existing.id : `remit_${bId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: formData.name.trim(),
          logoUrl: formData.logoUrl.trim() || undefined,
          displayOrder: Number(formData.displayOrder) || 1,
          branchId: bId,
          code: formData.code.trim() || undefined,
          username: existing ? existing.username : '',
          password: existing ? existing.password : '',
          accessId: existing ? existing.accessId : '',
          hasPin: effectiveHasPin,
          txnPin: effectiveHasPin ? (existing ? existing.txnPin : undefined) : undefined,
          contactPhone: formData.contactPhone.trim() || undefined,
          portalUrl: formData.portalUrl.trim() || undefined,
          status: formData.status,
          lastPasswordChanged: existing?.lastPasswordChanged || todayDate,
          createdAt: existing ? existing.createdAt : Date.now(),
          updatedAt: Date.now()
        };

        await storageService.saveRemittanceCompany(payload);
      }

      // If editing in Multi-Branch mode, remove records for branches that were unchecked (and legacy 'all' records)
      if (editingCompany && isMultiBranchEditMode) {
        const toRemove = companies.filter(c => {
          const matchesName =
            c.name.trim().toLowerCase() === normalizedOldName ||
            c.name.trim().toLowerCase() === normalizedNewName;
          if (!matchesName) return false;
          const recBranch = (c.branchId || 'main').toLowerCase();
          return recBranch === 'all' || !targetBranches.includes(recBranch);
        });
        for (const rec of toRemove) {
          await storageService.deleteRemittanceCompany(rec.id);
        }
      }

      const syncResult = await storageService.syncAllRemittanceToSupabase();
      setIsModalOpen(false);
      const isAllSelected = availableBranches.every(b => targetBranches.includes(b.id.toLowerCase()));
      const branchScopeText = isAllSelected
        ? 'all branches'
        : `${targetBranches.length} selected branch${targetBranches.length > 1 ? 'es' : ''}`;
      if (syncResult.success) {
        setToastMessage(`Saved & synced for ${branchScopeText} in Supabase!`);
      } else {
        setToastMessage(`Saved locally for ${branchScopeText}! Supabase note: ${syncResult.error || 'Check project status'}`);
      }
      setTimeout(() => setToastMessage(null), 3500);
      loadCompanies();
      return;
    }

    // CASE 2: Single Specific Branch Selected (1 branch)
    const singleBranchId = targetBranches[0];
    if (isIme) {
      if (!formData.accessId.trim()) {
        setFormError('Please enter Agent ID for this branch.');
        return;
      }
      if (!formData.txnPin.trim()) {
        setFormError('Please enter Employee ID for this branch.');
        return;
      }
      if (!formData.username.trim()) {
        setFormError('Please enter Username for this branch.');
        return;
      }
      if (!formData.password.trim()) {
        setFormError('Please enter Password for this branch.');
        return;
      }
    } else {
      if (!formData.username.trim()) {
        setFormError('Please enter Username for this branch.');
        return;
      }
      if (!formData.password.trim()) {
        setFormError('Please enter Password for this branch.');
        return;
      }
      if (!formData.accessId.trim()) {
        setFormError('Please enter Access ID for this branch.');
        return;
      }
      if (effectiveHasPin && !formData.txnPin.trim()) {
        setFormError('Please enter the PIN or set Require PIN to No.');
        return;
      }
    }

    const existingForBranch =
      (editingCompany && (editingCompany.branchId || 'main').toLowerCase() === singleBranchId
        ? editingCompany
        : companies.find(c =>
            (c.branchId || 'main').toLowerCase() === singleBranchId &&
            (c.name.trim().toLowerCase() === normalizedNewName ||
             (editingCompany && c.name.trim().toLowerCase() === normalizedOldName))
          )) || null;

    const isPasswordChanged = !existingForBranch || existingForBranch.password !== formData.password;

    const payload: RemittanceCompany = {
      id: existingForBranch
        ? existingForBranch.id
        : `remit_${singleBranchId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: formData.name.trim(),
      logoUrl: formData.logoUrl.trim() || undefined,
      displayOrder: Number(formData.displayOrder) || 1,
      branchId: singleBranchId,
      code: formData.code.trim() || undefined,
      accessId: formData.accessId.trim(),
      username: formData.username.trim(),
      password: formData.password.trim(),
      hasPin: effectiveHasPin,
      txnPin: effectiveHasPin ? formData.txnPin.trim() : undefined,
      contactPhone: formData.contactPhone.trim() || undefined,
      portalUrl: formData.portalUrl.trim() || undefined,
      status: formData.status,
      lastPasswordChanged: isPasswordChanged ? todayDate : (existingForBranch?.lastPasswordChanged || todayDate),
      createdAt: existingForBranch ? existingForBranch.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    const res = await storageService.saveRemittanceCompany(payload);

    // If editing in Multi-Branch mode and narrowed down to 1 branch, remove unchecked branches
    if (editingCompany && isMultiBranchEditMode) {
      const toRemove = companies.filter(c => {
        if (c.id === payload.id) return false;
        const matchesName =
          c.name.trim().toLowerCase() === normalizedOldName ||
          c.name.trim().toLowerCase() === normalizedNewName;
        if (!matchesName) return false;
        const recBranch = (c.branchId || 'main').toLowerCase();
        return recBranch === 'all' || recBranch !== singleBranchId;
      });
      for (const rec of toRemove) {
        await storageService.deleteRemittanceCompany(rec.id);
      }
    }

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
      setToastMessage('Please enter the new password.');
      setTimeout(() => setToastMessage(null), 2500);
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
    if (!isSuperAdmin) {
      setToastMessage('Only Super Admin can delete remittance partners.');
      setTimeout(() => setToastMessage(null), 2500);
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

  // Map company name -> list of assigned branch IDs (for Super Admin overview)
  const companyBranchMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const allIds = availableBranches.map(b => b.id.toLowerCase());
    companies.forEach(c => {
      const key = c.name.trim().toLowerCase();
      const bId = (!c.branchId || c.branchId === 'headoffice' || c.branchId === 'head_office')
        ? 'main'
        : c.branchId.toLowerCase();
      if (bId === 'all') {
        map.set(key, [...allIds]);
      } else if (allIds.includes(bId)) {
        const cur = map.get(key) || [];
        if (!cur.includes(bId)) {
          map.set(key, [...cur, bId]);
        }
      }
    });
    return map;
  }, [companies, availableBranches]);

  // Filter and sort companies strictly by branch assignment (no fabricated cards for unassigned branches)
  const filteredAndSortedCompanies = useMemo(() => {
    let list = [...companies];
    const targetBranch = (isSuperAdmin ? selectedBranchFilter : loggedInBranchId).toLowerCase();

    if (targetBranch === 'all') {
      // In 'All Branches' mode, show unique company cards (preferring Head Office / main credentials)
      const uniqueMap = new Map<string, RemittanceCompany>();
      list.forEach(c => {
        const key = c.name.trim().toLowerCase();
        const existing = uniqueMap.get(key);
        const cBranch = (c.branchId || 'main').toLowerCase();
        const cHasCreds = Boolean(c.username || c.accessId || c.password);
        const existingHasCreds = Boolean(existing?.username || existing?.accessId || existing?.password);
        if (
          !existing ||
          (cBranch === 'main' && (existing.branchId || 'main').toLowerCase() !== 'main') ||
          (!existingHasCreds && cHasCreds && (existing.branchId || 'main').toLowerCase() !== 'main')
        ) {
          uniqueMap.set(key, c);
        }
      });
      list = Array.from(uniqueMap.values());
    } else {
      // Strictly show ONLY partners explicitly assigned to this branch (or legacy 'all')
      const uniqueBranchMap = new Map<string, RemittanceCompany>();
      list.forEach(c => {
        const recBranch = (!c.branchId || c.branchId === 'headoffice' || c.branchId === 'head_office')
          ? 'main'
          : c.branchId.toLowerCase();
        if (recBranch !== targetBranch && recBranch !== 'all') return;

        const key = c.name.trim().toLowerCase();
        const existing = uniqueBranchMap.get(key);
        const cIsExact = recBranch === targetBranch;
        const existingIsExact = existing ? (existing.branchId || 'main').toLowerCase() === targetBranch : false;
        const cHasCreds = Boolean(c.username || c.accessId || c.password);
        const existingHasCreds = Boolean(existing?.username || existing?.accessId || existing?.password);

        if (
          !existing ||
          (cIsExact && !existingIsExact) ||
          (cIsExact === existingIsExact && cHasCreds && !existingHasCreds) ||
          (cIsExact === existingIsExact && cHasCreds === existingHasCreds && Number(c.displayOrder ?? 999) < Number(existing.displayOrder ?? 999))
        ) {
          uniqueBranchMap.set(key, c);
        }
      });
      list = Array.from(uniqueBranchMap.values());
    }

    // Sort by internal S.N. (displayOrder)
    list.sort((a, b) => {
      const ordA = a.displayOrder !== undefined ? Number(a.displayOrder) : 999;
      const ordB = b.displayOrder !== undefined ? Number(b.displayOrder) : 999;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }, [companies, selectedBranchFilter, isSuperAdmin, loggedInBranchId]);

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
    if (branchId === 'all') return 'All Branches';
    const key = (!branchId || branchId === 'headoffice' || branchId === 'head_office') ? 'main' : branchId.toLowerCase();
    const found = availableBranches.find(b => b.id.toLowerCase() === key);
    if (found) return found.name;
    if (key === 'main') return 'Head Office';
    return key.toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-700 flex items-center justify-center text-white shadow-xs shrink-0">
            <Globe size={17} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 leading-tight">
              Remittance Login Detail
            </h1>
            <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500">
              <span>Branch:</span>
              <span className="text-rose-700 uppercase font-black">
                {isSuperAdmin
                  ? (selectedBranchFilter === 'all' ? 'All Branches' : getBranchLabel(selectedBranchFilter))
                  : (branch?.name || getBranchLabel(loggedInBranchId))}
              </span>
            </div>
          </div>
        </div>

        {/* Super Admin Controls Only (All Branches, Sync Supabase, Print Sheet, Add Partner) */}
        {isSuperAdmin && (
          <div className="flex items-center space-x-2">
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

            <button
              onClick={openAddModal}
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Add Remit</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area - Ultra Compact Cards Grid sorted by S.N. */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-bold uppercase tracking-wider">
            Loading...
          </div>
        ) : filteredAndSortedCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <Globe size={28} className="text-slate-400 mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Remittance Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {isSuperAdmin 
                ? 'No remittance partner credentials have been registered for this branch yet.' 
                : 'No remittance credentials found for your branch. Please contact Head Office.'}
            </p>
            {isSuperAdmin && (
              <button
                onClick={openAddModal}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="mt-3 px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Remit
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 items-start">
            {filteredAndSortedCompanies.map((comp) => {
              // Passwords are SHOWN by default; hidden ONLY if user explicitly toggled it
              const isPwdVisible = !hiddenPasswords[comp.id];
              const initialColor = getCompanyInitialColor(comp.name);
              const isImeCard = isImeRemitProfile(comp.name, comp.displayOrder);
              const usesPin = !isImeCard && (comp.hasPin === true || (comp.hasPin === undefined && !!comp.txnPin));
              const assignedIds = companyBranchMap.get(comp.name.trim().toLowerCase()) || [];
              const assignedAll = availableBranches.length > 0 && assignedIds.length >= availableBranches.length;
              const assignedBranchSummary = assignedAll
                ? `All Branches (${availableBranches.length})`
                : assignedIds.map(id => getBranchLabel(id)).join(', ');

              return (
                <div 
                  key={comp.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col overflow-hidden p-2.5 hover:border-slate-300"
                >
                  {/* Card Header: Logo + Company Name + Action Controls */}
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      {comp.logoUrl ? (
                        <div className="w-7 h-7 rounded-lg border border-slate-200 bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
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
                        <div className={`w-7 h-7 rounded-lg ${initialColor} flex items-center justify-center font-black text-[11px] uppercase shrink-0 shadow-2xs`}>
                          {comp.name.substring(0, 2)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-black text-slate-900 truncate tracking-tight leading-tight" title={comp.name}>
                          {comp.name}
                        </h3>
                        {isSuperAdmin && selectedBranchFilter === 'all' && assignedBranchSummary && (
                          <p
                            className="text-[10px] font-semibold text-slate-400 truncate leading-tight mt-0.5"
                            title={assignedBranchSummary}
                          >
                            {assignedBranchSummary}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center space-x-1 shrink-0 ml-1">
                      <button
                        onClick={() => openEditModal(comp)}
                        disabled={isDayEnded}
                        className={`p-1 rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isSuperAdmin 
                            ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' 
                            : 'text-rose-700 hover:bg-rose-50 border border-rose-200 px-1.5 py-0.5 flex items-center space-x-1'
                        }`}
                        title={isDayEnded ? getDayEndedBlockMessage() : (isSuperAdmin ? "Edit Remit Details" : "Change Password")}
                      >
                        <Edit3 size={12} />
                        {!isSuperAdmin && <span className="text-[9px] font-bold">Password</span>}
                      </button>

                      {/* Delete is ONLY available to Super Admin */}
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleDelete(comp)}
                          disabled={isDayEnded}
                          className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isDayEnded ? getDayEndedBlockMessage() : "Delete Remit"}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Compact uniform rows with zero wasted vertical gap */}
                  <div className="space-y-1 text-xs">
                    {isImeCard ? (
                      <>
                        {/* IME Remit Order: 1. Agent ID, 2. Employee ID, 3. Username, 4. Password */}
                        <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-500 w-20 shrink-0">Agent ID:</span>
                            <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                              {comp.accessId ? comp.accessId : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                            </span>
                          </div>
                          {comp.accessId && (
                            <button
                              onClick={() => handleCopy(comp.accessId, 'Agent ID', `${comp.id}_agent`)}
                              className={`p-0.5 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
                                copiedKey === `${comp.id}_agent`
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-400 hover:text-slate-800 hover:bg-white'
                              }`}
                              title="Copy Agent ID"
                            >
                              {copiedKey === `${comp.id}_agent` ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-500 w-20 shrink-0">Employee ID:</span>
                            <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                              {comp.txnPin ? comp.txnPin : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                            </span>
                          </div>
                          {comp.txnPin && (
                            <button
                              onClick={() => handleCopy(comp.txnPin || '', 'Employee ID', `${comp.id}_emp`)}
                              className={`p-0.5 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
                                copiedKey === `${comp.id}_emp`
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-400 hover:text-slate-800 hover:bg-white'
                              }`}
                              title="Copy Employee ID"
                            >
                              {copiedKey === `${comp.id}_emp` ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-500 w-20 shrink-0">Username:</span>
                            <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                              {comp.username ? comp.username : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                            </span>
                          </div>
                          {comp.username && (
                            <button
                              onClick={() => handleCopy(comp.username, 'Username', `${comp.id}_user`)}
                              className={`p-0.5 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
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

                        <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-500 w-20 shrink-0">Password:</span>
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
                                className="p-0.5 rounded text-slate-400 hover:text-slate-800 hover:bg-white transition-all cursor-pointer"
                                title={isPwdVisible ? 'Hide Password' : 'Show Password'}
                              >
                                {isPwdVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button
                                onClick={() => handleCopy(comp.password, 'Password', `${comp.id}_pwd`)}
                                className={`p-0.5 rounded text-xs transition-all cursor-pointer ${
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
                      </>
                    ) : (
                      <>
                        {/* Standard Remit Order: 1. Username, 2. Password, 3. Access ID, 4. PIN (if Yes) */}
                        <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">Username:</span>
                            <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                              {comp.username ? comp.username : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                            </span>
                          </div>
                          {comp.username && (
                            <button
                              onClick={() => handleCopy(comp.username, 'Username', `${comp.id}_user`)}
                              className={`p-0.5 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
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

                        <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
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
                                className="p-0.5 rounded text-slate-400 hover:text-slate-800 hover:bg-white transition-all cursor-pointer"
                                title={isPwdVisible ? 'Hide Password' : 'Show Password'}
                              >
                                {isPwdVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button
                                onClick={() => handleCopy(comp.password, 'Password', `${comp.id}_pwd`)}
                                className={`p-0.5 rounded text-xs transition-all cursor-pointer ${
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

                        <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">Access ID:</span>
                            <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                              {comp.accessId ? comp.accessId : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                            </span>
                          </div>
                          {comp.accessId && (
                            <button
                              onClick={() => handleCopy(comp.accessId, 'Access ID', `${comp.id}_acc`)}
                              className={`p-0.5 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
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

                        {usesPin && (
                          <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                            <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">PIN:</span>
                              <span className="font-mono font-bold text-slate-900 truncate select-all text-xs">
                                {comp.txnPin ? (isPwdVisible ? comp.txnPin : '••••') : <span className="text-slate-400 font-normal italic text-[11px]">Not configured</span>}
                              </span>
                            </div>
                            {comp.txnPin && (
                              <button
                                onClick={() => handleCopy(comp.txnPin || '', 'PIN', `${comp.id}_pin`)}
                                className={`p-0.5 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
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
                      </>
                    )}

                    {/* Contact Phone */}
                    {comp.contactPhone && (
                      <div className="flex items-center justify-between px-2 py-1 min-h-[28px] bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/70 transition-colors">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                          <span className={`text-[11px] font-bold text-slate-500 ${isImeCard ? 'w-20' : 'w-16'} shrink-0`}>Contact:</span>
                          <span className="font-semibold text-slate-800 truncate text-xs">
                            {comp.contactPhone}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(comp.contactPhone || '', 'Contact', `${comp.id}_contact`)}
                          className={`p-0.5 rounded text-xs transition-all shrink-0 cursor-pointer ml-1 ${
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

      {/* Full Add / Edit Modal (Super Admin Only) */}
      {isModalOpen && isSuperAdmin && (() => {
        const isImeForm = isImeRemitProfile(formData.name, formData.displayOrder);
        const allBranchIds = availableBranches.map(b => b.id.toLowerCase());
        const isAllBranchesSelected = allBranchIds.length > 0 && allBranchIds.every(id => formData.selectedBranches.includes(id));
        const selectedCount = formData.selectedBranches.length;
        const singleSelectedBranch = selectedCount === 1 ? formData.selectedBranches[0] : null;
        const selectedBranchNames = formData.selectedBranches.map(id => getBranchLabel(id)).join(', ');

        return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9000] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider">
                {editingCompany ? 'UPDATE REMIT' : 'ADD REMIT'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-3 max-h-[82vh] overflow-y-auto">
              <DayEndFieldset branchId={singleSelectedBranch || undefined} className="space-y-3">
              {formError && (
                <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {formError}
                </div>
              )}

              {/* S.N. + Company Name */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    S.N. *
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

                <div className="col-span-2">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    COMPANY NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IME Remit, Prabhu Remit"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                  />
                </div>
              </div>

              {/* Target Branches Selection (All / 1 / 2 / 3+ Branches) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    {isMultiBranchEditMode ? 'SELECT BRANCHES *' : 'TARGET BRANCH *'}
                  </label>
                  {isMultiBranchEditMode ? (
                    <button
                      type="button"
                      onClick={toggleAllFormBranches}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border transition-all cursor-pointer ${
                        isAllBranchesSelected
                          ? 'bg-rose-700 text-white border-rose-700'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {isAllBranchesSelected ? 'All Branches ✓' : 'Select All Branches'}
                    </button>
                  ) : (
                    <span className="text-[10px] font-black uppercase text-rose-700">
                      {singleSelectedBranch ? getBranchLabel(singleSelectedBranch) : ''}
                    </span>
                  )}
                </div>

                {isMultiBranchEditMode ? (
                  <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {availableBranches.map(b => {
                      const bId = b.id.toLowerCase();
                      const isChecked = formData.selectedBranches.includes(bId);
                      return (
                        <label
                          key={bId}
                          className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all select-none ${
                            isChecked
                              ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleFormBranch(bId)}
                            className="accent-rose-700 w-3.5 h-3.5 rounded cursor-pointer shrink-0"
                          />
                          <span className="truncate text-[11px]" title={b.name}>{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                    <Building2 size={14} className="text-rose-700 shrink-0" />
                    <span>{singleSelectedBranch ? getBranchLabel(singleSelectedBranch) : 'Selected Branch'}</span>
                  </div>
                )}

                {isMultiBranchEditMode && (
                  <p className="text-[10px] font-semibold text-slate-500 mt-1">
                    {selectedCount === 0
                      ? 'Select at least 1 branch where this remit is needed.'
                      : isAllBranchesSelected
                        ? `Enabled for all ${selectedCount} branches.`
                        : `Enabled for ${selectedCount} branch${selectedCount > 1 ? 'es' : ''}: ${selectedBranchNames}`}
                  </p>
                )}
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

              {/* PIN Yes / No Selection (Only for non-IME Remits; IME Remit uses fixed Agent ID, Employee ID, Username, Password) */}
              {!isImeForm && (
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
              )}

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
              {selectedCount !== 1 ? (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-900">
                  <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <p className="font-bold">
                      {selectedCount === 0
                        ? 'No Branch Selected:'
                        : isAllBranchesSelected
                          ? `All Branches Mode (${selectedCount} Branches):`
                          : `${selectedCount} Branches Selected:`}
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {selectedCount === 0
                        ? 'Select 1, 2, 3, or All Branches above to assign this remit.'
                        : <>This will enable <strong>{formData.name || 'this remit'}</strong> only for <strong>{isAllBranchesSelected ? 'all branches' : selectedBranchNames}</strong> with the common Name, S.N., Logo, and Contact.</>}
                    </p>
                    {selectedCount > 1 && (
                      <p className="text-[11px] text-amber-800 mt-1 font-semibold">
                        {isImeForm ? (
                          <>To enter or update <strong>Agent ID</strong>, <strong>Employee ID</strong>, <strong>Username</strong>, and <strong>Password</strong>, select a single branch.</>
                        ) : (
                          <>To enter or update <strong>Username</strong>, <strong>Password</strong>, <strong>Access ID</strong>, and <strong>PIN</strong>, select a single branch.</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Specific branch credentials fields */
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center space-x-1">
                    <Building2 size={12} />
                    <span>Credentials for {getBranchLabel(singleSelectedBranch || undefined)}</span>
                  </div>

                  {isImeForm ? (
                    <>
                      {/* IME Remit 1st Serial Number Fields: Agent ID, Employee ID, Username, Password */}
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                          AGENT ID *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. IMENP39156"
                          value={formData.accessId}
                          onChange={(e) => setFormData(prev => ({ ...prev, accessId: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                          EMPLOYEE ID *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 34544"
                          value={formData.txnPin}
                          onChange={(e) => setFormData(prev => ({ ...prev, txnPin: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                          USERNAME *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. rbtrsslparsa"
                          value={formData.username}
                          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-600"
                        />
                      </div>

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
                    </>
                  ) : (
                    <>
                      {/* Standard Remit Fields: Username, Password, Access ID, PIN */}
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
                    </>
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
                  disabled={isDayEnded || selectedCount === 0}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedCount === 1
                    ? (editingCompany ? 'SAVE DETAILS' : 'ADD REMIT')
                    : isAllBranchesSelected
                      ? (editingCompany ? 'UPDATE ALL BRANCHES' : 'ADD FOR ALL BRANCHES')
                      : (editingCompany ? `UPDATE ${selectedCount} BRANCHES` : `ADD FOR ${selectedCount} BRANCHES`)}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

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
                {isImeRemitProfile(editingCompany.name, editingCompany.displayOrder) ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold text-slate-400">Agent ID:</span>
                      <span className="font-mono font-bold text-slate-800">{editingCompany.accessId || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold text-slate-400">Employee ID:</span>
                      <span className="font-mono font-bold text-slate-800">{editingCompany.txnPin || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold text-slate-400">Username:</span>
                      <span className="font-mono font-bold text-slate-800">{editingCompany.username || '-'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold text-slate-400">Username:</span>
                      <span className="font-mono font-bold text-slate-800">{editingCompany.username || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold text-slate-400">Access ID:</span>
                      <span className="font-mono font-bold text-slate-800">{editingCompany.accessId || '-'}</span>
                    </div>
                  </>
                )}
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
