import React, { useState } from 'react';
import { PiggyBank, HandCoins } from 'lucide-react';
import { SavingProductManagement } from './SavingProductManagement';
import { LoanProductManagement } from './LoanProductManagement';

interface ProductManagementProps {
  initialTab?: 'saving' | 'loan';
  onTabChange?: (tab: 'saving' | 'loan') => void;
}

export const ProductManagement: React.FC<ProductManagementProps> = ({ 
  initialTab = 'saving',
  onTabChange 
}) => {
  const [activeTab, setActiveTab] = useState<'saving' | 'loan'>(initialTab);

  const handleSelectTab = (tab: 'saving' | 'loan') => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Sub-menu Pills: 1. Saving Product, 2. Loan Product */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-fit">
        <button
          type="button"
          onClick={() => handleSelectTab('saving')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
            activeTab === 'saving'
              ? 'bg-[#006400] text-white shadow-sm ring-1 ring-[#006400]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <PiggyBank size={15} />
          <span>1. Saving Product</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('loan')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
            activeTab === 'loan'
              ? 'bg-[#006400] text-white shadow-sm ring-1 ring-[#006400]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <HandCoins size={15} />
          <span>2. Loan Product</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'saving' && (
        <SavingProductManagement />
      )}
      {activeTab === 'loan' && (
        <LoanProductManagement />
      )}
    </div>
  );
};

export default ProductManagement;
