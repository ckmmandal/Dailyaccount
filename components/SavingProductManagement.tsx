import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  PiggyBank, Plus, Eye, Edit2, Trash2, X, Check, 
  AlertTriangle, Percent, ChevronLeft, ChevronRight, Info
} from 'lucide-react';
import { SavingProduct, SavingProductCapitalization } from '../types';
import { productService } from '../services/productService';
import { useAuth } from '../AuthContext';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const CAPITALIZATION_OPTIONS: SavingProductCapitalization[] = [
  'Monthly',
  'Quarterly',
  'Half-Yearly',
  'Yearly',
  'At Maturity'
];

interface SavingProductManagementProps {
  onProductCountChange?: (count: number) => void;
}

export const SavingProductManagement: React.FC<SavingProductManagementProps> = ({ onProductCountChange }) => {
  const { user, isSuperAdmin } = useAuth();
  const isDayEnded = useDayEndLock();
  
  // Role-based access: Only authorized Admin users can create, edit, delete
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return Boolean(
      isSuperAdmin || 
      user.roleId === '1' || 
      user.username === 'admin' || 
      (user.role && user.role.toLowerCase().includes('admin')) ||
      (Array.isArray(user.permissions) && user.permissions.includes('manage_users'))
    );
  }, [user, isSuperAdmin]);

  const [products, setProducts] = useState<SavingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SavingProduct | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    nameNp: string;
    interestRate: string;
    capitalization: SavingProductCapitalization;
    minimumBalance: string;
    description: string;
    status: 'Active' | 'Inactive';
    showInMicrofinance: boolean;
    showInFD: boolean;
  }>({
    name: '',
    nameNp: '',
    interestRate: '6.0',
    capitalization: 'Quarterly',
    minimumBalance: '500',
    description: '',
    status: 'Active',
    showInMicrofinance: false,
    showInFD: false
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toggleEpochRef = React.useRef(0);

  const loadProducts = useCallback(async (silent = false) => {
    const startEpoch = toggleEpochRef.current;
    try {
      if (!silent) setLoading(true);
      const data = await productService.getSavingProducts();
      if (toggleEpochRef.current === startEpoch) {
        setProducts(data);
        if (onProductCountChange) onProductCountChange(data.length);
      }
    } catch (err) {
      console.error('Failed to load saving products:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onProductCountChange]);

  useEffect(() => {
    loadProducts();
    const handleUpdate = () => loadProducts(true);
    window.addEventListener('savingProductsUpdated', handleUpdate);
    return () => window.removeEventListener('savingProductsUpdated', handleUpdate);
  }, [loadProducts]);

  // Filtered products
  const filteredProducts = products;

  // Paginated products
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Handle Form open
  const handleOpenAdd = () => {
    if (!isAdmin) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setFormData({
      name: '',
      nameNp: '',
      interestRate: '6.0',
      capitalization: 'Quarterly',
      minimumBalance: '500',
      description: '',
      status: 'Active',
      showInMicrofinance: false,
      showInFD: false
    });
    setFormError(null);
    setSelectedProduct(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (product: SavingProduct) => {
    if (!isAdmin) return;
    setSelectedProduct(product);
    const mfEnabled = Boolean(product.showInMicrofinance ?? product.showInMicrofinanceAndFD);
    const fdEnabled = Boolean(product.showInFD ?? product.showInMicrofinanceAndFD);
    setFormData({
      id: product.id,
      name: product.name,
      nameNp: product.nameNp || '',
      interestRate: product.interestRate.toString(),
      capitalization: product.capitalization,
      minimumBalance: product.minimumBalance !== undefined ? product.minimumBalance.toString() : '',
      description: product.description || '',
      status: product.status || 'Active',
      showInMicrofinance: mfEnabled,
      showInFD: fdEnabled
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleToggleProductChannel = async (
    product: SavingProduct,
    channel: 'showInMicrofinance' | 'showInFD'
  ) => {
    if (!isAdmin) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }

    const myEpoch = ++toggleEpochRef.current;
    const currentMf = Boolean(product.showInMicrofinance ?? product.showInMicrofinanceAndFD);
    const currentFd = Boolean(product.showInFD ?? product.showInMicrofinanceAndFD);
    const nextMf = channel === 'showInMicrofinance' ? !currentMf : currentMf;
    const nextFd = channel === 'showInFD' ? !currentFd : currentFd;

    const updatedProduct: SavingProduct = {
      ...product,
      showInMicrofinance: nextMf,
      showInFD: nextFd,
      showInMicrofinanceAndFD: nextMf || nextFd,
      updatedAt: Date.now()
    };

    // Optimistic immediate UI update so user can check multiple products smoothly
    setProducts(prev => prev.map(p => (p.id === product.id ? updatedProduct : p)));

    try {
      const updated = await productService.saveSavingProduct(updatedProduct);
      if (toggleEpochRef.current === myEpoch) {
        setProducts(updated);
      }
    } catch (err) {
      console.error(`Failed to toggle ${channel}:`, err);
      loadProducts(true);
    }
  };

  const handleOpenView = (product: SavingProduct) => {
    setSelectedProduct(product);
    setIsViewModalOpen(true);
  };

  const handleOpenDelete = (product: SavingProduct) => {
    if (!isAdmin) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setSelectedProduct(product);
    setIsDeleteModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }

    if (!formData.name.trim()) {
      setFormError('Please enter saving product name');
      return;
    }
    const rate = parseFloat(formData.interestRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setFormError('Interest rate must be between 0% and 100%');
      return;
    }

    try {
      setSaving(true);
      const productPayload: SavingProduct = {
        id: formData.id || 'sp-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        name: formData.name.trim(),
        nameNp: formData.nameNp.trim(),
        interestRate: rate,
        capitalization: formData.capitalization,
        minimumBalance: formData.minimumBalance ? parseFloat(formData.minimumBalance) : 0,
        description: formData.description.trim(),
        status: formData.status,
        showInMicrofinance: formData.showInMicrofinance,
        showInFD: formData.showInFD,
        showInMicrofinanceAndFD: formData.showInMicrofinance || formData.showInFD,
        createdAt: selectedProduct?.createdAt || Date.now(),
        updatedAt: Date.now(),
        createdBy: user?.username || 'admin'
      };

      const updated = await productService.saveSavingProduct(productPayload);
      setProducts(updated);
      if (onProductCountChange) onProductCountChange(updated.length);
      setIsFormModalOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error('Failed to save saving product:', err);
      setFormError('Failed to save product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isAdmin || !selectedProduct) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    try {
      setSaving(true);
      const updated = await productService.deleteSavingProduct(selectedProduct.id);
      setProducts(updated);
      if (onProductCountChange) onProductCountChange(updated.length);
      setIsDeleteModalOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error('Failed to delete saving product:', err);
      alert('Failed to delete product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 py-1">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#006400]/10 text-[#006400] rounded-xl border border-[#006400]/20 shadow-2xs">
            <PiggyBank size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">Saving Product Management</h3>
          </div>
        </div>

        {/* Right action button */}
        {isAdmin && (
          <button
            type="button"
            disabled={isDayEnded}
            onClick={handleOpenAdd}
            title={isDayEnded ? getDayEndedBlockMessage() : 'Add New Saving Product'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006400] hover:bg-[#005000] text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={15} />
            <span>Add New Saving Product</span>
          </button>
        )}
      </div>

      {/* Main Saving Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/90 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-14 text-center">S.N.</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 text-center">Interest</th>
                <th className="py-3 px-4 text-center">Capitalization</th>
                <th className="py-3 px-4 text-center">Min. Balance</th>
                <th className="py-3 px-3 text-center">MF</th>
                <th className="py-3 px-3 text-center">FD</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right w-36">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-[#006400] border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading saving products...</div>
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <PiggyBank size={32} className="mx-auto mb-2 text-slate-300" />
                    <div className="font-bold text-slate-600">No saving products found</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click &quot;Add New Saving Product&quot; to create one.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, idx) => {
                  const serialNumber = (currentPage - 1) * pageSize + idx + 1;
                  const isMfEnabled = Boolean(product.showInMicrofinance ?? product.showInMicrofinanceAndFD);
                  const isFdEnabled = Boolean(product.showInFD ?? product.showInMicrofinanceAndFD);
                  return (
                    <tr 
                      key={product.id}
                      className="hover:bg-emerald-50/30 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {serialNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 group-hover:text-[#006400] transition-colors">
                          {product.name}
                        </div>
                        {product.nameNp && (
                          <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
                            {product.nameNp}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#006400] font-black text-xs border border-emerald-200/60 shadow-2xs">
                          {product.interestRate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200/80">
                          {product.capitalization}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                        {product.minimumBalance ? `NPR ${product.minimumBalance.toLocaleString()}` : 'NPR 0'}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <label className={`inline-flex items-center gap-1.5 ${!isAdmin || isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={isMfEnabled}
                            onChange={() => handleToggleProductChannel(product, 'showInMicrofinance')}
                            disabled={!isAdmin || isDayEnded}
                            className="w-4 h-4 rounded border-slate-300 text-[#006400] focus:ring-[#006400] cursor-pointer disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Tick to show in Microfinance (MF)'}
                          />
                          <span className={`text-[10px] font-black uppercase tracking-tight ${isMfEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {isMfEnabled ? 'Yes' : 'No'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <label className={`inline-flex items-center gap-1.5 ${!isAdmin || isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={isFdEnabled}
                            onChange={() => handleToggleProductChannel(product, 'showInFD')}
                            disabled={!isAdmin || isDayEnded}
                            className="w-4 h-4 rounded border-slate-300 text-[#006400] focus:ring-[#006400] cursor-pointer disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : 'Tick to show in Fixed Deposit (FD)'}
                          />
                          <span className={`text-[10px] font-black uppercase tracking-tight ${isFdEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {isFdEnabled ? 'Yes' : 'No'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          product.status === 'Active' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {product.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenView(product)}
                            title="View Product Details"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Edit Button */}
                          {isAdmin && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleOpenEdit(product)}
                              title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Product'}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Edit2 size={15} />
                            </button>
                          )}

                          {/* Delete Button */}
                          {isAdmin && (
                            <button
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => handleOpenDelete(product)}
                              title={isDayEnded ? getDayEndedBlockMessage() : 'Delete Product'}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-600">
          <div className="font-semibold">
            Showing <span className="font-black text-slate-900">{filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-black text-slate-900">{Math.min(currentPage * pageSize, filteredProducts.length)}</span> of{' '}
            <span className="font-black text-slate-900">{filteredProducts.length}</span> saving products
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 py-1 font-bold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT SAVING PRODUCT */}
      {/* ============================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#006400] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <PiggyBank size={20} />
                <h3 className="text-sm font-black tracking-wide uppercase">
                  {selectedProduct ? 'Edit Saving Product' : 'Add New Saving Product'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 font-bold">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <DayEndFieldset className="space-y-4">
              {/* Product Name (English & Nepali) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    SAVING PRODUCT NAME (ENGLISH) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. General Saving"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    बचत प्रोडक्टको नाम (नेपाली)
                  </label>
                  <input
                    type="text"
                    placeholder="उदा. साधारण बचत"
                    value={formData.nameNp}
                    onChange={(e) => setFormData({ ...formData, nameNp: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all"
                  />
                </div>
              </div>

              {/* Interest Rate & Capitalization Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    ANNUAL INTEREST RATE (%) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="e.g. 6.00"
                      value={formData.interestRate}
                      onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all"
                      required
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    CAPITALIZATION CYCLE <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formData.capitalization}
                    onChange={(e) => setFormData({ ...formData, capitalization: e.target.value as SavingProductCapitalization })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all cursor-pointer"
                  >
                    {CAPITALIZATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Minimum Balance & Status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    MINIMUM BALANCE (NPR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={formData.minimumBalance}
                    onChange={(e) => setFormData({ ...formData, minimumBalance: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    STATUS
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  PRODUCT DESCRIPTION / REMARKS
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional details, conditions, eligibility criteria..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all"
                />
              </div>

              {/* Separate Microfinance (MF) & Fixed Deposit (FD) Visibility Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  htmlFor="showInMicrofinance"
                  className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/90 flex items-start gap-2.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    id="showInMicrofinance"
                    checked={formData.showInMicrofinance}
                    onChange={(e) => setFormData({ ...formData, showInMicrofinance: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#006400] focus:ring-[#006400] cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show in MF (Micro-Finance)</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">लघुवित्त (MF) बचतमा देखाउने</div>
                  </div>
                </label>

                <label
                  htmlFor="showInFD"
                  className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/90 flex items-start gap-2.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    id="showInFD"
                    checked={formData.showInFD}
                    onChange={(e) => setFormData({ ...formData, showInFD: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#006400] focus:ring-[#006400] cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show in FD (Fixed Deposit)</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">मुद्दती (FD) खातामा देखाउने</div>
                  </div>
                </label>
              </div>
              </DayEndFieldset>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || isDayEnded}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-5 py-2 bg-[#006400] hover:bg-[#005000] text-white rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>{selectedProduct ? 'Update Product' : 'Save Product'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VIEW SAVING PRODUCT DETAILS */}
      {/* ============================================================== */}
      {isViewModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#006400] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-black tracking-wide uppercase">Saving Product Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Details Content */}
            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#006400] tracking-wider">Product Name (EN / NP)</span>
                  <div className="text-base font-black text-slate-900 mt-0.5">{selectedProduct.name}</div>
                  {selectedProduct.nameNp && (
                    <div className="text-xs font-bold text-emerald-700 mt-0.5">{selectedProduct.nameNp}</div>
                  )}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  selectedProduct.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {selectedProduct.status || 'Active'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Interest Rate</span>
                  <div className="text-sm font-black text-[#006400] mt-0.5">{selectedProduct.interestRate}% p.a.</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Capitalization</span>
                  <div className="text-sm font-black text-slate-800 mt-0.5">{selectedProduct.capitalization}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Minimum Balance</span>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    NPR {selectedProduct.minimumBalance?.toLocaleString() || '0'}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Product Code / ID</span>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-0.5">{selectedProduct.id}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Micro-Finance (MF)</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    (selectedProduct.showInMicrofinance ?? selectedProduct.showInMicrofinanceAndFD)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {(selectedProduct.showInMicrofinance ?? selectedProduct.showInMicrofinanceAndFD) ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fixed Deposit (FD)</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    (selectedProduct.showInFD ?? selectedProduct.showInMicrofinanceAndFD)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {(selectedProduct.showInFD ?? selectedProduct.showInMicrofinanceAndFD) ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Description & Notes</span>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">{selectedProduct.description}</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ============================================================== */}
      {isDeleteModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-600 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} />
                <h3 className="text-sm font-black tracking-wide uppercase">Confirm Deletion</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 font-medium leading-relaxed">
                Are you sure you want to delete the saving product{' '}
                <strong className="text-slate-900 font-black">"{selectedProduct.name}"</strong>?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-semibold">
                This action is permanent and will remove this product from the database.
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || isDayEnded}
                  onClick={handleConfirmDelete}
                  title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Deleting...' : 'Delete Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
