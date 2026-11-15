import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowRightLeft,
  Trash2,
  Eye,
  Upload,
  Download,
  X,
  FileText,
  Edit2
} from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import {
  AssetCategory,
  AssetDocument,
  DepreciationMethod,
  DepreciationStoreData,
  DisposalType,
  FixedAsset,
  depreciationService,
  generateAssetSchedule
} from '../../services/depreciationService';
import { Branch } from '../../types';
import { NepaliDatePicker } from '../NepaliDatePicker';
import { DayEndFieldset } from '../DayEndFieldset';
import { getDayEndedBlockMessage, isDayEndedForBranch } from '../../utils/dayEndLock';

interface AssetManagementTabProps {
  store: DepreciationStoreData;
  branches: Branch[];
  currentBranchId: string;
  actorName: string;
  isDayEnded: boolean;
  initialSubSection?: string;
  onStoreUpdated: (updated: DepreciationStoreData) => void;
  onOpenCategoriesSettings: () => void;
}

type AssetSubView = 'register' | 'purchase' | 'categories' | 'transfer' | 'disposal';

const getTodayBs = (): string => {
  try {
    return new NepaliDate(new Date()).format('YYYY-MM-DD');
  } catch {
    return '2083-07-28';
  }
};

const getTodayAd = (): string => new Date().toISOString().split('T')[0];

const bsToAd = (bsStr: string): string => {
  try {
    const parts = bsStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const ad = new NepaliDate(parts[0], parts[1] - 1, parts[2]).toJsDate();
      return ad.toISOString().split('T')[0];
    }
  } catch {
    // Fallback
  }
  return getTodayAd();
};

export const AssetManagementTab: React.FC<AssetManagementTabProps> = ({
  store,
  branches,
  currentBranchId,
  actorName,
  isDayEnded,
  initialSubSection,
  onStoreUpdated
}) => {
  const [subView, setSubView] = useState<AssetSubView>(
    initialSubSection === 'purchase' ||
    initialSubSection === 'categories' ||
    initialSubSection === 'transfer' ||
    initialSubSection === 'disposal'
      ? initialSubSection
      : 'register'
  );

  // Filters for Asset Register
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Asset Purchase / Edit Form State
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetCode, setAssetCode] = useState(() => `FA-${String(store.assets.length + 1).padStart(4, '0')}`);
  const [assetName, setAssetName] = useState('');
  const [categoryId, setCategoryId] = useState(() => store.categories[0]?.id || '');
  const [branchId, setBranchId] = useState(() => currentBranchId || branches[0]?.id || 'main');
  const [purchaseDateBs, setPurchaseDateBs] = useState(() => getTodayBs());
  const [purchaseValue, setPurchaseValue] = useState('');
  const [salvageValue, setSalvageValue] = useState('');
  const [usefulLifeYears, setUsefulLifeYears] = useState(() => String(store.categories[0]?.usefulLifeYears || 5));
  const [method, setMethod] = useState<DepreciationMethod>(() => store.categories[0]?.defaultMethod || store.settings.defaultMethod);
  const [depreciationRate, setDepreciationRate] = useState(() => String(store.categories[0]?.rate || 15));
  const [vendorName, setVendorName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [location, setLocation] = useState('');
  const [custodian, setCustodian] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formDocuments, setFormDocuments] = useState<AssetDocument[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Transfer State
  const [transferAssetId, setTransferAssetId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [transferDateBs, setTransferDateBs] = useState(() => getTodayBs());
  const [transferRemarks, setTransferRemarks] = useState('');

  // Disposal State
  const [disposalAssetId, setDisposalAssetId] = useState('');
  const [disposalType, setDisposalType] = useState<DisposalType>('Sale');
  const [disposalDateBs, setDisposalDateBs] = useState(() => getTodayBs());
  const [saleProceeds, setSaleProceeds] = useState('');
  const [disposalRemarks, setDisposalRemarks] = useState('');

  // Details Modal
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const activeBranches = useMemo(() => {
    if (branches && branches.length > 0) return branches;
    return [
      { id: 'main', name: 'Ratauli Head Office', code: 'C01', status: 'Active' as const, createdAt: 0 },
      { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', status: 'Active' as const, createdAt: 0 },
      { id: 'pipra', name: 'Pipra Branch', code: 'C03', status: 'Active' as const, createdAt: 0 },
      { id: 'parsa', name: 'Parsa Branch', code: 'C04', status: 'Active' as const, createdAt: 0 }
    ];
  }, [branches]);

  const filteredAssets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return store.assets.filter(a => {
      if (filterBranch !== 'all' && a.branchId !== filterBranch) return false;
      if (filterCategory !== 'all' && a.categoryId !== filterCategory) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      if (!q) return true;
      return (
        a.assetCode.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.categoryName.toLowerCase().includes(q) ||
        a.branchName.toLowerCase().includes(q) ||
        (a.vendorName || '').toLowerCase().includes(q) ||
        (a.serialNo || '').toLowerCase().includes(q)
      );
    });
  }, [store.assets, searchTerm, filterBranch, filterCategory, filterStatus]);

  const activeAssets = useMemo(() => store.assets.filter(a => a.status === 'Active'), [store.assets]);

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const cat = store.categories.find(c => c.id === newCatId);
    if (cat && !editingAssetId) {
      setMethod(cat.defaultMethod);
      setDepreciationRate(String(cat.rate));
      setUsefulLifeYears(String(cat.usefulLifeYears));
      const pv = Number(purchaseValue || 0);
      if (pv > 0) {
        setSalvageValue(String(Math.round((pv * cat.salvagePercent) / 100)));
      }
    }
  };

  const handlePurchaseValueChange = (val: string) => {
    setPurchaseValue(val);
    if (!editingAssetId) {
      const cat = store.categories.find(c => c.id === categoryId);
      const pct = cat?.salvagePercent ?? store.settings.defaultSalvagePercent;
      const pv = Number(val || 0);
      if (pv > 0) {
        setSalvageValue(String(Math.round((pv * pct) / 100)));
      }
    }
  };

  const resetForm = () => {
    const firstCat: AssetCategory | undefined = store.categories[0];
    setEditingAssetId(null);
    setAssetCode(`FA-${String(store.assets.length + 1).padStart(4, '0')}`);
    setAssetName('');
    setCategoryId(firstCat?.id || '');
    setBranchId(currentBranchId || activeBranches[0]?.id || 'main');
    setPurchaseDateBs(getTodayBs());
    setPurchaseValue('');
    setSalvageValue('');
    setUsefulLifeYears(String(firstCat?.usefulLifeYears || store.settings.defaultUsefulLifeYears));
    setMethod(firstCat?.defaultMethod || store.settings.defaultMethod);
    setDepreciationRate(String(firstCat?.rate || 15));
    setVendorName('');
    setInvoiceNo('');
    setSerialNo('');
    setLocation('');
    setCustodian('');
    setRemarks('');
    setFormDocuments([]);
  };

  const handleEditAsset = (asset: FixedAsset) => {
    if (isDayEnded) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setEditingAssetId(asset.id);
    setAssetCode(asset.assetCode);
    setAssetName(asset.name);
    setCategoryId(asset.categoryId);
    setBranchId(asset.branchId);
    setPurchaseDateBs(asset.purchaseDateBs || getTodayBs());
    setPurchaseValue(String(asset.purchaseValue));
    setSalvageValue(String(asset.salvageValue));
    setUsefulLifeYears(String(asset.usefulLifeYears));
    setMethod(asset.method);
    setDepreciationRate(String(asset.depreciationRate));
    setVendorName(asset.vendorName || '');
    setInvoiceNo(asset.invoiceNo || '');
    setSerialNo(asset.serialNo || '');
    setLocation(asset.location || '');
    setCustodian(asset.custodian || '');
    setRemarks(asset.remarks || '');
    setFormDocuments(asset.documents || []);
    setSubView('purchase');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, targetAsset?: FixedAsset) => {
    if (isDayEndedForBranch(targetAsset?.branchId || branchId)) {
      alert(getDayEndedBlockMessage());
      e.target.value = '';
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async () => {
        const doc: AssetDocument = {
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl: String(reader.result || '')
        };

        if (targetAsset) {
          const updatedDocs = [...(targetAsset.documents || []), doc];
          const updatedStore = await depreciationService.saveAsset(
            {
              ...targetAsset,
              documents: updatedDocs
            },
            actorName
          );
          onStoreUpdated(updatedStore);
          const refreshed = updatedStore.assets.find(a => a.id === targetAsset.id) || null;
          setSelectedAsset(refreshed);
        } else {
          setFormDocuments(prev => [...prev, doc]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveDocumentFromSelected = async (asset: FixedAsset, docId: string) => {
    if (isDayEndedForBranch(asset.branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const updatedDocs = (asset.documents || []).filter(d => d.id !== docId);
    const updatedStore = await depreciationService.saveAsset(
      {
        ...asset,
        documents: updatedDocs
      },
      actorName
    );
    onStoreUpdated(updatedStore);
    setSelectedAsset(updatedStore.assets.find(a => a.id === asset.id) || null);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEndedForBranch(branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const pv = Number(purchaseValue || 0);
    if (!assetCode.trim() || !assetName.trim() || pv <= 0) {
      alert('Please provide Asset Code, Asset Name, and a valid Purchase Value.');
      return;
    }

    const cat = store.categories.find(c => c.id === categoryId) || store.categories[0];
    const br = activeBranches.find(b => b.id === branchId) || activeBranches[0];
    const existing = editingAssetId ? store.assets.find(a => a.id === editingAssetId) : null;
    const accum = existing ? existing.accumulatedDepreciation : 0;
    const sv = Math.min(pv, Math.max(0, Number(salvageValue || 0)));

    try {
      setIsSaving(true);
      const updated = await depreciationService.saveAsset(
        {
          id: editingAssetId || undefined,
          assetCode: assetCode.trim(),
          name: assetName.trim(),
          categoryId: cat?.id || '',
          categoryName: cat?.name || 'Uncategorized',
          branchId: br?.id || 'main',
          branchName: br?.name || 'Head Office',
          purchaseDate: bsToAd(purchaseDateBs),
          purchaseDateBs,
          putToUseDate: bsToAd(purchaseDateBs),
          putToUseDateBs: purchaseDateBs,
          purchaseValue: pv,
          salvageValue: sv,
          usefulLifeYears: Math.max(1, Number(usefulLifeYears || 5)),
          method,
          depreciationRate: Math.max(0, Number(depreciationRate || 15)),
          taxBlock: cat?.taxBlock || 'Block D',
          taxRate: cat?.taxRate || Number(depreciationRate || 15),
          vendorName: vendorName.trim(),
          invoiceNo: invoiceNo.trim(),
          serialNo: serialNo.trim(),
          location: location.trim(),
          custodian: custodian.trim(),
          remarks: remarks.trim(),
          status: existing?.status || 'Active',
          accumulatedDepreciation: accum,
          netBookValue: Math.max(sv, pv - accum),
          documents: formDocuments
        },
        actorName
      );
      onStoreUpdated(updated);
      setStatusFeedback(editingAssetId ? 'Fixed asset updated successfully.' : 'Fixed asset registered and journal entry recorded.');
      setTimeout(() => setStatusFeedback(null), 4000);
      resetForm();
      setSubView('register');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save fixed asset.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = async (asset: FixedAsset) => {
    if (isDayEndedForBranch(asset.branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!window.confirm(`Delete fixed asset ${asset.assetCode} (${asset.name})?`)) return;
    try {
      const updated = await depreciationService.deleteAsset(asset.id, actorName);
      onStoreUpdated(updated);
      if (selectedAsset?.id === asset.id) setSelectedAsset(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete asset.');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const targetAsset = store.assets.find(a => a.id === transferAssetId);
    const destBranch = activeBranches.find(b => b.id === toBranchId);
    if (!targetAsset || !destBranch) {
      alert('Please select an asset and a destination branch.');
      return;
    }
    if (targetAsset.branchId === destBranch.id) {
      alert('Destination branch must differ from the current branch.');
      return;
    }
    try {
      const updated = await depreciationService.transferAsset({
        assetId: targetAsset.id,
        toBranchId: destBranch.id,
        toBranchName: destBranch.name,
        transferDate: bsToAd(transferDateBs),
        transferDateBs,
        remarks: transferRemarks.trim(),
        actorName
      });
      onStoreUpdated(updated);
      setTransferAssetId('');
      setToBranchId('');
      setTransferRemarks('');
      setStatusFeedback(`Transferred ${targetAsset.assetCode} to ${destBranch.name}.`);
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to transfer asset.');
    }
  };

  const handleDisposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) {
      alert(getDayEndedBlockMessage());
      return;
    }
    const targetAsset = store.assets.find(a => a.id === disposalAssetId);
    if (!targetAsset) {
      alert('Please select an active asset to dispose.');
      return;
    }
    try {
      const updated = await depreciationService.disposeAsset({
        assetId: targetAsset.id,
        disposalType,
        disposalDate: bsToAd(disposalDateBs),
        disposalDateBs,
        saleProceeds: Number(saleProceeds || 0),
        remarks: disposalRemarks.trim(),
        actorName
      });
      onStoreUpdated(updated);
      setDisposalAssetId('');
      setSaleProceeds('');
      setDisposalRemarks('');
      setStatusFeedback(`${disposalType} recorded for ${targetAsset.assetCode}.`);
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record disposal.');
    }
  };

  const selectedDisposalAsset = store.assets.find(a => a.id === disposalAssetId);
  const projectedGainLoss = selectedDisposalAsset
    ? (disposalType === 'Sale' ? Number(saleProceeds || 0) : 0) - Number(selectedDisposalAsset.netBookValue || 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Sub-Menu Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'register', label: 'Asset Register' },
              { id: 'purchase', label: 'Asset Purchase & Entry' },
              { id: 'categories', label: 'Asset Categories' },
              { id: 'transfer', label: 'Asset Transfer' },
              { id: 'disposal', label: 'Asset Disposal & Sale' }
            ] as Array<{ id: AssetSubView; label: string }>
          ).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubView(item.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                subView === item.id
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {statusFeedback && (
          <span className="text-xs font-semibold text-emerald-700">{statusFeedback}</span>
        )}
      </div>

      {/* 1. ASSET REGISTER */}
      {subView === 'register' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search code, asset, vendor, serial..."
                  className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>

              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
              >
                <option value="all">All Branches</option>
                {activeBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
              >
                <option value="all">All Categories</option>
                {store.categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Sold">Sold</option>
                <option value="Disposed">Disposed</option>
              </select>
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-slate-700">No fixed assets match the selected criteria</p>
              <p className="text-xs text-slate-500">Add a fixed asset under Asset Purchase &amp; Entry to populate the register.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 pr-3">Code</th>
                    <th className="py-2.5 px-3">Asset Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3">Purchase BS</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3 text-right">Purchase Value</th>
                    <th className="py-2.5 px-3 text-right">Accumulated Dep.</th>
                    <th className="py-2.5 px-3 text-right">Net Book Value</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono font-bold text-slate-800">{asset.assetCode}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{asset.name}</div>
                        {asset.serialNo && <div className="text-[11px] text-slate-500 font-mono">S/N: {asset.serialNo}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{asset.categoryName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{asset.branchName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{asset.purchaseDateBs}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{asset.method} · {asset.depreciationRate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                        NPR {Math.round(asset.purchaseValue).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700">
                        NPR {Math.round(asset.accumulatedDepreciation).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        NPR {Math.round(asset.netBookValue).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{asset.status}</td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedAsset(asset)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                            title="View Details & Documents"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleEditAsset(asset)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Asset'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleDeleteAsset(asset)}
                            className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Delete Asset'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. ASSET PURCHASE & ENTRY */}
      {subView === 'purchase' && (
        <form onSubmit={handleSaveAsset} className="bg-white p-5 rounded-xl border border-slate-200 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingAssetId ? 'Edit Fixed Asset Record' : 'Asset Purchase & Capitalization Entry'}
              </h3>
            </div>
            {editingAssetId && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setSubView('register');
                }}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <DayEndFieldset branchId={branchId} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Code *</label>
                <input
                  type="text"
                  required
                  value={assetCode}
                  onChange={e => setAssetCode(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  value={assetName}
                  onChange={e => setAssetName(e.target.value)}
                  placeholder="e.g. Dell PowerEdge Server"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Category *</label>
                <select
                  value={categoryId}
                  onChange={e => handleCategoryChange(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                >
                  {store.categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.defaultMethod} {c.rate}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch *</label>
                <select
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                >
                  {activeBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date (BS) *</label>
                <NepaliDatePicker
                  value={purchaseDateBs}
                  onChange={setPurchaseDateBs}
                  enforceBackDateRestriction
                  disabled={isDayEnded}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Value (NPR) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={purchaseValue}
                  onChange={e => handlePurchaseValueChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Depreciation Method *</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value as DepreciationMethod)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                >
                  <option value="SLM">Straight Line Method (SLM)</option>
                  <option value="WDV">Written Down Value Method (WDV)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Depreciation Rate (% / Year) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.01"
                  value={depreciationRate}
                  onChange={e => setDepreciationRate(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Useful Life (Years) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={usefulLifeYears}
                  onChange={e => setUsefulLifeYears(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Salvage Value (NPR)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={salvageValue}
                  onChange={e => setSalvageValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Supplier Name</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  placeholder="Supplier name"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice / Bill No.</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={e => setInvoiceNo(e.target.value)}
                  placeholder="INV-001"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Serial / Model No.</label>
                <input
                  type="text"
                  value={serialNo}
                  onChange={e => setSerialNo(e.target.value)}
                  placeholder="Hardware serial"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Ground Floor Counter 1"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Custodian</label>
                <input
                  type="text"
                  value={custodian}
                  onChange={e => setCustodian(e.target.value)}
                  placeholder="Staff in charge"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supporting Documents (Invoice, Warranty, Photo)</label>
                <div className="flex items-center gap-3">
                  <label className={`px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 ${isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Document</span>
                    <input
                      type="file"
                      multiple
                      disabled={isDayEnded}
                      onChange={e => handleFileUpload(e)}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-500">{formDocuments.length} file(s) attached</span>
                </div>
                {formDocuments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                        <span className="truncate font-medium text-slate-700">{doc.name}</span>
                        <button
                          type="button"
                          onClick={() => setFormDocuments(prev => prev.filter(d => d.id !== doc.id))}
                          className="text-rose-600 hover:text-rose-800 ml-2 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DayEndFieldset>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setSubView('register');
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDayEnded || isSaving}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : editingAssetId ? 'Update Asset' : 'Save & Capitalize Asset'}
            </button>
          </div>
        </form>
      )}

      {/* 3. ASSET CATEGORIES OVERVIEW */}
      {subView === 'categories' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Asset Categories &amp; Standard Rates</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 px-3">Category Name</th>
                  <th className="py-2 px-3">Default Method</th>
                  <th className="py-2 px-3 text-right">Book Rate</th>
                  <th className="py-2 px-3">Tax Block</th>
                  <th className="py-2 px-3 text-right">Tax Rate</th>
                  <th className="py-2 px-3 text-right">Useful Life</th>
                  <th className="py-2 px-3 text-right">Salvage %</th>
                  <th className="py-2 pl-3 text-right">Active Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {store.categories.map(cat => {
                  const count = store.assets.filter(a => a.categoryId === cat.id && a.status === 'Active').length;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono font-bold text-slate-800">{cat.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{cat.name}</td>
                      <td className="py-2.5 px-3 font-mono">{cat.defaultMethod}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{cat.rate}%</td>
                      <td className="py-2.5 px-3">{cat.taxBlock}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{cat.taxRate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{cat.usefulLifeYears} yrs</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{cat.salvagePercent}%</td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-bold">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ASSET TRANSFER */}
      {subView === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form onSubmit={handleTransferSubmit} className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-700" />
              <span>Inter-Branch Asset Transfer</span>
            </h3>

            <DayEndFieldset className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Active Asset *</label>
                <select
                  required
                  value={transferAssetId}
                  onChange={e => setTransferAssetId(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                >
                  <option value="">Choose an asset...</option>
                  {activeAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} - {a.name} ({a.branchName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Branch *</label>
                <select
                  required
                  value={toBranchId}
                  onChange={e => setToBranchId(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                >
                  <option value="">Choose destination branch...</option>
                  {activeBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Date (BS) *</label>
                <NepaliDatePicker
                  value={transferDateBs}
                  onChange={setTransferDateBs}
                  enforceBackDateRestriction
                  disabled={isDayEnded}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Remarks</label>
                <textarea
                  rows={2}
                  value={transferRemarks}
                  onChange={e => setTransferRemarks(e.target.value)}
                  placeholder="Reason for transfer..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>
            </DayEndFieldset>

            <button
              type="submit"
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Execute Branch Transfer
            </button>
          </form>

          <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Asset Transfer History</h3>
            {store.transfers.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No asset transfers recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2 pr-3">Date (BS)</th>
                      <th className="py-2 px-3">Asset</th>
                      <th className="py-2 px-3">From Branch</th>
                      <th className="py-2 px-3">To Branch</th>
                      <th className="py-2 px-3">Authorized By</th>
                      <th className="py-2 pl-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {store.transfers.map(tr => (
                      <tr key={tr.id}>
                        <td className="py-2.5 pr-3 font-mono text-slate-600">{tr.transferDateBs}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{tr.assetCode} · {tr.assetName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{tr.fromBranchName}</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-700">{tr.toBranchName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{tr.transferredBy}</td>
                        <td className="py-2.5 pl-3 text-slate-500">{tr.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. ASSET DISPOSAL & SALE */}
      {subView === 'disposal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form onSubmit={handleDisposalSubmit} className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Record Asset Disposal or Sale</h3>

            <DayEndFieldset className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Active Asset *</label>
                <select
                  required
                  value={disposalAssetId}
                  onChange={e => setDisposalAssetId(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                >
                  <option value="">Choose an active asset...</option>
                  {activeAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} - {a.name} (NBV: NPR {Math.round(a.netBookValue).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Disposal Type *</label>
                <select
                  value={disposalType}
                  onChange={e => setDisposalType(e.target.value as DisposalType)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                >
                  <option value="Sale">Sale</option>
                  <option value="Scrap">Scrap</option>
                  <option value="Write-Off">Write-Off</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Disposal Date (BS) *</label>
                <NepaliDatePicker
                  value={disposalDateBs}
                  onChange={setDisposalDateBs}
                  enforceBackDateRestriction
                  disabled={isDayEnded}
                />
              </div>

              {disposalType === 'Sale' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Proceeds (NPR) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={saleProceeds}
                    onChange={e => setSaleProceeds(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600"
                  />
                </div>
              )}

              {selectedDisposalAsset && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Net Book Value</span>
                    <span className="font-mono font-bold">NPR {Math.round(selectedDisposalAsset.netBookValue).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Estimated Gain / Loss</span>
                    <span className={`font-mono font-bold ${projectedGainLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {projectedGainLoss >= 0 ? '+' : ''}NPR {Math.round(projectedGainLoss).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={disposalRemarks}
                  onChange={e => setDisposalRemarks(e.target.value)}
                  placeholder="Buyer details or write-off note..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>
            </DayEndFieldset>

            <button
              type="submit"
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Asset {disposalType}
            </button>
          </form>

          <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Disposed &amp; Sold Assets</h3>
            {store.assets.filter(a => a.status === 'Sold' || a.status === 'Disposed').length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No asset disposals recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 px-3">Asset Name</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Disposal BS</th>
                      <th className="py-2 px-3 text-right">NBV at Disposal</th>
                      <th className="py-2 px-3 text-right">Sale Proceeds</th>
                      <th className="py-2 pl-3 text-right">Gain / Loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {store.assets
                      .filter(a => a.status === 'Sold' || a.status === 'Disposed')
                      .map(a => (
                        <tr key={a.id}>
                          <td className="py-2.5 pr-3 font-mono font-bold text-slate-800">{a.assetCode}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{a.name}</td>
                          <td className="py-2.5 px-3">{a.disposalType || a.status}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{a.disposalDateBs}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            NPR {Math.round(a.netBookValue).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            NPR {Math.round(a.saleProceeds || 0).toLocaleString()}
                          </td>
                          <td className={`py-2.5 pl-3 text-right font-mono tabular-nums font-bold ${(a.disposalGainLoss || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            NPR {Math.round(a.disposalGainLoss || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ASSET DETAILS & DOCUMENT UPLOAD MODAL */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold">{selectedAsset.name} ({selectedAsset.assetCode})</h3>
                <p className="text-xs text-slate-300">
                  {selectedAsset.categoryName} · {selectedAsset.branchName} · {selectedAsset.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Financial Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500">Purchase Value</div>
                  <div className="text-sm font-bold font-mono tabular-nums mt-1">NPR {Math.round(selectedAsset.purchaseValue).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500">Accumulated Dep.</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-rose-700 mt-1">NPR {Math.round(selectedAsset.accumulatedDepreciation).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500">Net Book Value</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-emerald-700 mt-1">NPR {Math.round(selectedAsset.netBookValue).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500">Salvage Value</div>
                  <div className="text-sm font-bold font-mono tabular-nums mt-1">NPR {Math.round(selectedAsset.salvageValue).toLocaleString()}</div>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-t border-b border-slate-100 py-3">
                <div><span className="text-slate-500 block">Purchase Date (BS)</span><span className="font-mono font-semibold">{selectedAsset.purchaseDateBs}</span></div>
                <div><span className="text-slate-500 block">Method &amp; Rate</span><span className="font-mono font-semibold">{selectedAsset.method} ({selectedAsset.depreciationRate}%)</span></div>
                <div><span className="text-slate-500 block">Tax Block &amp; Rate</span><span className="font-mono font-semibold">{selectedAsset.taxBlock} ({selectedAsset.taxRate}%)</span></div>
                <div><span className="text-slate-500 block">Vendor</span><span className="font-semibold">{selectedAsset.vendorName || '-'}</span></div>
                <div><span className="text-slate-500 block">Invoice No.</span><span className="font-mono font-semibold">{selectedAsset.invoiceNo || '-'}</span></div>
                <div><span className="text-slate-500 block">Custodian &amp; Location</span><span className="font-semibold">{selectedAsset.custodian || '-'} · {selectedAsset.location || '-'}</span></div>
              </div>

              {/* Document Upload & Attachments */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Asset Documents</h4>
                  <label className={`px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 ${isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Document</span>
                    <input
                      type="file"
                      multiple
                      disabled={isDayEnded}
                      onChange={e => handleFileUpload(e, selectedAsset)}
                      className="hidden"
                    />
                  </label>
                </div>

                {(!selectedAsset.documents || selectedAsset.documents.length === 0) ? (
                  <p className="text-xs text-slate-500 py-3 border border-dashed border-slate-200 rounded-lg text-center">
                    No documents uploaded for this asset.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedAsset.documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{doc.name}</span>
                          <span className="text-slate-400 shrink-0">({Math.round(doc.size / 1024)} KB)</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={doc.dataUrl}
                            download={doc.name}
                            className="px-2 py-1 border border-slate-200 bg-white rounded text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </a>
                          <button
                            type="button"
                            disabled={isDayEnded}
                            onClick={() => handleRemoveDocumentFromSelected(selectedAsset, doc.id)}
                            className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Remove Document'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Multi-Year Schedule Preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Projected Depreciation Schedule</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2 px-3">Year</th>
                        <th className="py-2 px-3">FY</th>
                        <th className="py-2 px-3 text-right">Opening Value</th>
                        <th className="py-2 px-3 text-right">Depreciation ({selectedAsset.method})</th>
                        <th className="py-2 px-3 text-right">Tax Dep.</th>
                        <th className="py-2 px-3 text-right">Closing NBV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {generateAssetSchedule(selectedAsset).map(row => (
                        <tr key={row.yearIndex}>
                          <td className="py-2 px-3 font-mono">{row.yearIndex}</td>
                          <td className="py-2 px-3 font-mono">{row.financialYearLabel}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">NPR {row.openingBookValue.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-rose-700">NPR {row.activeDepreciation.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-blue-700">NPR {row.taxDepreciation.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">NPR {row.closingBookValue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
