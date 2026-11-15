import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Boxes,
  Calculator,
  LayoutDashboard,
  RefreshCw,
  Settings,
  TrendingDown
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { storageService } from '../services/storageService';
import { DepreciationStoreData, depreciationService } from '../services/depreciationService';
import { Branch, LedgerAccount, Role } from '../types';
import { useDayEndLock } from '../utils/dayEndLock';
import { DepreciationDashboardTab } from './depreciation/DepreciationDashboardTab';
import { AssetManagementTab } from './depreciation/AssetManagementTab';
import { DepreciationCalculationTab } from './depreciation/DepreciationCalculationTab';
import { DepreciationAccountingTab } from './depreciation/DepreciationAccountingTab';
import { DepreciationReportsTab } from './depreciation/DepreciationReportsTab';
import { DepreciationSettingsTab } from './depreciation/DepreciationSettingsTab';

type DepreciationTabKey = 'dashboard' | 'assets' | 'depreciation' | 'accounting' | 'reports' | 'settings';

const TAB_ITEMS: Array<{ key: DepreciationTabKey; label: string; icon: React.ElementType }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'assets', label: 'Asset Management', icon: Boxes },
  { key: 'depreciation', label: 'Depreciation', icon: Calculator },
  { key: 'accounting', label: 'Accounting', icon: BookOpen },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings }
];

export const DepreciationManagement: React.FC = () => {
  const { user, branch, settings } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isDayEnded = useDayEndLock(branch?.id);
  const [store, setStore] = useState<DepreciationStoreData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subSectionHint, setSubSectionHint] = useState<string | undefined>(undefined);

  const pathPart = location.pathname.replace(/^\/depreciation\/?/, '').split('/')[0] as DepreciationTabKey;
  const activeTab: DepreciationTabKey = TAB_ITEMS.some(t => t.key === pathPart) ? pathPart : 'dashboard';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [depStore, branchList, roleList, ledgerList] = await Promise.all([
        depreciationService.getAll(),
        storageService.getBranches(),
        storageService.getRoles(),
        storageService.getLedgerAccounts(branch?.id)
      ]);
      setStore(depStore);
      setBranches(branchList);
      setRoles(roleList);
      setLedgerAccounts(ledgerList);
    } finally {
      setIsLoading(false);
    }
  }, [branch?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNavigateTab = (tab: DepreciationTabKey, subSection?: string) => {
    setSubSectionHint(subSection);
    navigate(`/depreciation/${tab}`);
  };

  const actorName = user?.fullName || user?.username || 'System';
  const institutionName = settings?.systemName || 'Fixed Asset & Depreciation Registry';

  return (
    <div className="space-y-4">
      {/* Header & 6-Tab Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-900 text-white flex items-center justify-center shrink-0">
              <TrendingDown size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Fixed Asset & Depreciation Management</h1>
              <p className="text-[11px] font-medium text-slate-500">
                Active FY: {store?.settings.currentFinancialYear || '-'} | Branch: {branch?.name || 'All Branches'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          {TAB_ITEMS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleNavigateTab(tab.key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {isLoading || !store ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs font-semibold text-slate-500">
          Loading fixed asset and depreciation records...
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <DepreciationDashboardTab
              store={store}
              isDayEnded={isDayEnded}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'assets' && (
            <AssetManagementTab
              store={store}
              branches={branches}
              currentBranchId={branch?.id || 'main'}
              actorName={actorName}
              isDayEnded={isDayEnded}
              initialSubSection={subSectionHint}
              onStoreUpdated={setStore}
              onOpenCategoriesSettings={() => handleNavigateTab('settings')}
            />
          )}

          {activeTab === 'depreciation' && (
            <DepreciationCalculationTab
              store={store}
              branches={branches}
              actorName={actorName}
              isDayEnded={isDayEnded}
              initialSubSection={subSectionHint}
              onStoreUpdated={setStore}
            />
          )}

          {activeTab === 'accounting' && (
            <DepreciationAccountingTab
              store={store}
              branches={branches}
              ledgerAccounts={ledgerAccounts}
              actorName={actorName}
              isDayEnded={isDayEnded}
              onStoreUpdated={setStore}
            />
          )}

          {activeTab === 'reports' && (
            <DepreciationReportsTab
              store={store}
              branches={branches}
              institutionName={institutionName}
            />
          )}

          {activeTab === 'settings' && (
            <DepreciationSettingsTab
              store={store}
              branches={branches}
              roles={roles}
              actorName={actorName}
              isDayEnded={isDayEnded}
              onStoreUpdated={setStore}
            />
          )}
        </>
      )}
    </div>
  );
};
