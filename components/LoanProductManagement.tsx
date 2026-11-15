import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  HandCoins, Plus, Eye, Edit2, Trash2, X, Check, 
  AlertTriangle, Percent, ChevronLeft, ChevronRight, Info
} from 'lucide-react';
import { LoanProduct, LoanProductInstallment } from '../types';
import { productService } from '../services/productService';
import { useAuth } from '../AuthContext';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const INSTALLMENT_OPTIONS: LoanProductInstallment[] = [
  'Daily',
  'Weekly',
  'Fortnightly',
  'Monthly',
  'Quarterly',
  'Half-Yearly',
  'Yearly'
];

interface LoanProductManagementProps {
  onProductCountChange?: (count: number) => void;
}

export const LoanProductManagement: React.FC<LoanProductManagementProps> = ({ onProductCountChange }) => {
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

  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    nameNp: string;
    interestRate: string;
    installment: LoanProductInstallment;
    maxTenureMonths: string;
    description: string;
    status: 'Active' | 'Inactive';
    showInMicrofinanceAndFD: boolean;
  }>({
    name: '',
    nameNp: '',
    interestRate: '13.0',
    installment: 'Monthly',
    maxTenureMonths: '36',
    description: '',
    status: 'Active',
    showInMicrofinanceAndFD: false
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await productService.getLoanProducts();
      setProducts(data);
      if (onProductCountChange) onProductCountChange(data.length);
    } catch (err) {
      console.error('Failed to load loan products:', err);
    } finally {
      setLoading(false);
    }
  }, [onProductCountChange]);

  useEffect(() => {
    loadProducts();
    const handleUpdate = () => loadProducts();
    window.addEventListener('loanProductsUpdated', handleUpdate);
    return () => window.removeEventListener('loanProductsUpdated', handleUpdate);
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
      interestRate: '13.0',
      installment: 'Monthly',
      maxTenureMonths: '36',
      description: '',
      status: 'Active',
      showInMicrofinanceAndFD: false
    });
    setFormError(null);
    setSelectedProduct(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (product: LoanProduct) => {
    if (!isAdmin) return;
    setSelectedProduct(product);
    setFormData({
      id: product.id,
      name: product.name,
      nameNp: product.nameNp || '',
      interestRate: product.interestRate.toString(),
      installment: product.installment,
      maxTenureMonths: product.maxTenureMonths !== undefined ? product.maxTenureMonths.toString() : '36',
      description: product.description || '',
      status: product.status || 'Active',
      showInMicrofinanceAndFD: Boolean(product.showInMicrofinanceAndFD)
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleToggleMFFD = async (product: LoanProduct) => {
    if (!isAdmin) return;
    if (isDayEndedForBranch()) {
      alert(getDayEndedBlockMessage());
      return;
    }
    try {
      const updatedProduct: LoanProduct = {
        ...product,
        showInMicrofinanceAndFD: !product.showInMicrofinanceAndFD,
        updatedAt: Date.now()
      };
      const updated = await productService.saveLoanProduct(updatedProduct);
      setProducts(updated);
    } catch (err) {
      console.error('Failed to toggle MF status:', err);
    }
  };

  const handleOpenView = (product: LoanProduct) => {
    setSelectedProduct(product);
    setIsViewModalOpen(true);
  };

  const handleOpenDelete = (product: LoanProduct) => {
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
      setFormError('Please enter loan product name');
      return;
    }
    const rate = parseFloat(formData.interestRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setFormError('Interest rate must be between 0% and 100%');
      return;
    }

    try {
      setSaving(true);
      const productPayload: LoanProduct = {
        id: formData.id || 'lp-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        name: formData.name.trim(),
        nameNp: formData.nameNp.trim(),
        interestRate: rate,
        installment: formData.installment,
        maxTenureMonths: formData.maxTenureMonths ? parseInt(formData.maxTenureMonths, 10) : 36,
        description: formData.description.trim(),
        status: formData.status,
        showInMicrofinanceAndFD: formData.showInMicrofinanceAndFD,
        createdAt: selectedProduct?.createdAt || Date.now(),
        updatedAt: Date.now(),
        createdBy: user?.username || 'admin'
      };

      const updated = await productService.saveLoanProduct(productPayload);
      setProducts(updated);
      if (onProductCountChange) onProductCountChange(updated.length);
      setIsFormModalOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error('Failed to save loan product:', err);
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
      const updated = await productService.deleteLoanProduct(selectedProduct.id);
      setProducts(updated);
      if (onProductCountChange) onProductCountChange(updated.length);
      setIsDeleteModalOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error('Failed to delete loan product:', err);
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
            <HandCoins size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">Loan Product Management</h3>
          </div>
        </div>

        {/* Right action button */}
        {isAdmin && (
          <button
            type="button"
            disabled={isDayEnded}
            onClick={handleOpenAdd}
            title={isDayEnded ? getDayEndedBlockMessage() : 'Add New Loan Product'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006400] hover:bg-[#005000] text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={15} />
            <span>Add New Loan Product</span>
          </button>
        )}
      </div>

      {/* Main Loan Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/90 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-14 text-center">S.N.</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 text-center">Interest</th>
                <th className="py-3 px-4 text-center">Installment</th>
                <th className="py-3 px-4 text-center">Max Tenure</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-3 text-center w-16">MF</th>
                <th className="py-3 px-4 text-right w-36">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-[#006400] border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading loan products...</div>
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <HandCoins size={32} className="mx-auto mb-2 text-slate-300" />
                    <div className="font-bold text-slate-600">No loan products found</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click &quot;Add New Loan Product&quot; to create one.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, idx) => {
                  const serialNumber = (currentPage - 1) * pageSize + idx + 1;
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
                          {product.installment}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                        {product.maxTenureMonths ? `${product.maxTenureMonths} Months` : 'Flexible'}
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
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isAdmin || isDayEnded}
                          onClick={() => handleToggleMFFD(product)}
                          title={isDayEnded ? getDayEndedBlockMessage() : (product.showInMicrofinanceAndFD ? "Enabled in Microfinance (Click to disable)" : "Disabled in Microfinance (Click to enable)")}
                          className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center transition-all ${
                            product.showInMicrofinanceAndFD
                              ? 'bg-[#006400] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-300 hover:text-slate-500 border border-slate-200'
                          } ${isAdmin && !isDayEnded ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        >
                          <Check size={14} className={product.showInMicrofinanceAndFD ? 'opacity-100' : 'opacity-0'} />
                        </button>
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
            <span className="font-black text-slate-900">{filteredProducts.length}</span> loan products
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
      {/* MODAL: ADD / EDIT LOAN PRODUCT */}
      {/* ============================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#006400] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <HandCoins size={20} />
                <h3 className="text-sm font-black tracking-wide uppercase">
                  {selectedProduct ? 'Edit Loan Product' : 'Add New Loan Product'}
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
                    LOAN PRODUCT NAME (ENGLISH) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. General Loan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    ऋण प्रोडक्टको नाम (नेपाली)
                  </label>
                  <input
                    type="text"
                    placeholder="उदा. साधारण ऋण"
                    value={formData.nameNp}
                    onChange={(e) => setFormData({ ...formData, nameNp: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all"
                  />
                </div>
              </div>

              {/* Interest Rate & Installment Frequency Grid */}
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
                      placeholder="e.g. 13.00"
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
                    INSTALLMENT FREQUENCY <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formData.installment}
                    onChange={(e) => setFormData({ ...formData, installment: e.target.value as LoanProductInstallment })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all cursor-pointer"
                  >
                    {INSTALLMENT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Max Tenure Months & Status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    MAX TENURE (MONTHS)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 36"
                    value={formData.maxTenureMonths}
                    onChange={(e) => setFormData({ ...formData, maxTenureMonths: e.target.value })}
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
                  LOAN PURPOSE / DETAILS
                </label>
                <textarea
                  rows={3}
                  placeholder="Collateral criteria, eligible borrowers, required documentation..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#006400] rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006400]/20 transition-all"
                />
              </div>

              {/* Checkbox for MF */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="loanShowInMF"
                  checked={formData.showInMicrofinanceAndFD}
                  onChange={(e) => setFormData({ ...formData, showInMicrofinanceAndFD: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-[#006400] focus:ring-[#006400] border-slate-300 cursor-pointer"
                />
                <label htmlFor="loanShowInMF" className="cursor-pointer">
                  <div className="font-bold text-slate-900 text-xs">
                    Enable in Microfinance
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    When checked, this loan product is enabled for Microfinance operations.
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
      {/* MODAL: VIEW LOAN PRODUCT DETAILS */}
      {/* ============================================================== */}
      {isViewModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#006400] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-black tracking-wide uppercase">Loan Product Details</h3>
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
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Installment Frequency</span>
                  <div className="text-sm font-black text-slate-800 mt-0.5">{selectedProduct.installment}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Max Tenure</span>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedProduct.maxTenureMonths ? `${selectedProduct.maxTenureMonths} Months` : 'Flexible'}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Product Code / ID</span>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-0.5">{selectedProduct.id}</div>
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
                Are you sure you want to delete the loan product{' '}
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
