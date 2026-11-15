import React, { useState, useEffect } from 'react';
import { 
  Building2, Camera, User, FileText, Check, Plus, Trash2, 
  Upload, Printer, X, ShieldCheck, Wallet, Calendar, Landmark, CheckSquare, Edit2, Award
} from 'lucide-react';
import { BoardMember, BoardCategory, BoardDesignation, SystemSettings } from '../types';
import { compressDocumentFile } from '../utils/imageCompression';
import { useDayEndLock, getDayEndedBlockMessage } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

interface Props {
  member: BoardMember;
  categories: BoardCategory[];
  designations?: BoardDesignation[];
  settings?: SystemSettings | null;
  branchId?: string;
  mode?: 'view' | 'edit';
  onSave: (member: BoardMember) => void;
  onClose: () => void;
  onOpenCreateDesignation?: () => void;
}

export const BoardKYMFormModal: React.FC<Props> = ({
  member: initialMember,
  categories,
  designations = [],
  settings,
  branchId,
  mode = 'edit',
  onSave,
  onClose,
  onOpenCreateDesignation
}) => {
  const isDayEnded = useDayEndLock(branchId);
  const [isViewMode, setIsViewMode] = useState(mode === 'view');
  const [formData, setFormData] = useState<BoardMember>(() => ({ ...initialMember }));
  const [isCustomDesignation, setIsCustomDesignation] = useState(false);

  useEffect(() => {
    setIsViewMode(mode === 'view');
    setFormData(prev => ({
      ...prev,
      ...initialMember
    }));
  }, [initialMember, mode]);
  const [newFamilyMember, setNewFamilyMember] = useState({ name: '', relation: '', age: '', occupation: '' });
  const [showAddFamilyRow, setShowAddFamilyRow] = useState(false);

  // Helper for text inputs
  const handleChange = (field: keyof BoardMember, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Helper for deep tenure inputs
  const handleTenureChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      tenure: {
        ...prev.tenure,
        [field]: value
      }
    }));
  };

  // Helper for deep allowance inputs
  const handleAllowanceChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      allowanceConfig: {
        ...prev.allowanceConfig,
        [field]: value
      }
    }));
  };

  // Handle PAN input and format into 9 digits
  const panDigits = (formData.panNo || '').replace(/\D/g, '').padEnd(9, ' ').slice(0, 9).split('');

  // 16 boxes for Member ID and Account No
  const memberIdBoxes = (formData.memberId || formData.memberCode || '').replace(/\s/g, '').padEnd(16, ' ').slice(0, 16).split('');
  const accountBoxes = (formData.accountNumber || '').replace(/\s/g, '').padEnd(16, ' ').slice(0, 16).split('');

  // Handle PP photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressDocumentFile(file, 260, 260, 0.85);
      handleChange('profilePhoto', compressed);
    }
  };

  // Handle generic image upload to base64
  const handleGenericFileUpload = (field: keyof BoardMember) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressDocumentFile(file, 600, 400, 0.85);
      handleChange(field, compressed);
    }
  };

  // Calculate live allowances
  const grossAllowance = 
    (formData.allowanceConfig?.meetingAllowance || 0) +
    (formData.allowanceConfig?.communicationAllowance || 0) +
    (formData.allowanceConfig?.travelAllowance || 0) +
    (formData.allowanceConfig?.refreshmentAllowance || 0) +
    (formData.allowanceConfig?.otherAllowance || 0);

  const tdsRate = formData.allowanceConfig?.customTdsRate ?? 15;
  const tdsAmount = Math.round((grossAllowance * tdsRate) / 100);
  const netPayable = grossAllowance - tdsAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayEnded) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-xl border border-slate-300 animate-in zoom-in-95 my-auto">
        {/* Top Control Bar */}
        <div className="bg-emerald-900 text-white px-4 py-2 flex justify-between items-center no-print rounded-t-xl">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              {isViewMode
                ? 'सदस्य पहिचान (KYM) फाराम • पूर्ण विवरण अवलोकन'
                : 'सदस्य पहिचान (KYM) फाराम • Board Member Enrollment'}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-md text-xs font-bold flex items-center space-x-1"
            >
              <Printer size={13} />
              <span>प्रिन्ट</span>
            </button>
            {isViewMode ? (
              <button
                type="button"
                onClick={() => !isDayEnded && setIsViewMode(false)}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Board Profile'}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Edit2 size={13} />
                <span>सम्पादन</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsViewMode(true)}
                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-emerald-200 rounded-md text-xs font-bold flex items-center space-x-1"
              >
                <span>अवलोकन</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-emerald-300 hover:text-white rounded-md hover:bg-emerald-800"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable/Authentic Form Body */}
        <form onSubmit={handleSubmit} className="p-2.5 sm:p-3.5 space-y-2 bg-[#f8fcf9] text-xs text-slate-800">
          <DayEndFieldset branchId={branchId} className="space-y-2">
          
          {/* HEADER SECTION (Hubahu image 1) */}
          <div className="border border-emerald-300 bg-white rounded-xl p-2.5 shadow-xs relative">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Left Logo */}
              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
                ) : (
                  <div className="w-14 h-14 rounded-full border border-emerald-600 bg-emerald-50 flex flex-col items-center justify-center text-emerald-800 p-1 text-center shadow-xs">
                    <Building2 size={18} className="text-emerald-700" />
                    <span className="text-[7.5px] font-black leading-tight mt-0.5">रतौली साकोस</span>
                  </div>
                )}
              </div>

              {/* Center Cooperative Details */}
              <div className="text-center flex-1 space-y-0.5">
                <h1 className="text-base sm:text-lg font-black text-emerald-800 tracking-tight leading-tight">
                  रतौली बचत तथा ऋण सहकारी संस्था लि.
                </h1>
                <h2 className="text-xs sm:text-sm font-bold text-rose-700 tracking-tight leading-tight">
                  Ratauli Saving & Credit Co-operative Ltd.
                </h2>
                <p className="text-[11px] text-slate-700 font-semibold">
                  पिपरा गाउँपालिका -६, महोत्तरी
                </p>
                <div className="pt-0.5">
                  <span className="bg-[#0c6b45] text-white px-3.5 py-0.5 rounded font-bold text-xs tracking-wide inline-block shadow-xs">
                    सदस्य पहिचान (KYM) फाराम
                  </span>
                </div>
              </div>

              {/* Right: Anusuchi-1 & PP Photo */}
              <div className="flex flex-col items-center shrink-0">
                <div className="self-end mb-1">
                  <span className="bg-[#0c6b45] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                    अनुसूची-१
                  </span>
                </div>
                <div className="relative group">
                  <label className="border border-dashed border-emerald-500 rounded-lg bg-emerald-50/50 w-20 h-24 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-100/50 transition-colors overflow-hidden">
                    {formData.profilePhoto ? (
                      <img src={formData.profilePhoto} alt="PP" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-1 text-emerald-700">
                        <User size={22} className="mx-auto mb-0.5 text-emerald-600" />
                        <span className="text-[8px] font-bold block leading-tight">पासपोर्ट फोटो</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  {formData.profilePhoto && (
                    <button
                      type="button"
                      onClick={() => handleChange('profilePhoto', undefined)}
                      className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 shadow-sm"
                      title="Remove Photo"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* FARAM DARTA BIBARAN (Registration Details) */}
          <div className="border border-emerald-300 bg-white rounded-xl p-2.5 space-y-1.5">
            <div className="flex justify-between items-center pb-1.5 border-b border-emerald-100">
              <div className="flex items-center space-x-1.5 text-emerald-800 font-black text-xs">
                <FileText size={15} />
                <span>फाराम दर्ता विवरण (Registration Details)</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold border border-emerald-300 bg-emerald-50 px-2 py-0.5 rounded">
                अनुसूची-१ आधिकारिक अभिलेख
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-0.5">फाराम भरेको मिति (Date) *</label>
                <input
                  type="text"
                  required
                  value={formData.registrationDateBs || '2081-06-15'}
                  onChange={e => handleChange('registrationDateBs', e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs font-bold"
                  placeholder="YYYY-MM-DD"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-0.5">सदस्यता नं. (Member ID)</label>
                <input
                  type="text"
                  value={formData.memberId || formData.memberCode || ''}
                  onChange={e => {
                    handleChange('memberId', e.target.value);
                    handleChange('memberCode', e.target.value);
                  }}
                  className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="सदस्य नम्बर"
                />
                <div className="flex space-x-0.5 mt-1 overflow-x-auto">
                  {memberIdBoxes.map((c, i) => (
                    <span key={i} className="w-3.5 h-4 border border-slate-300 rounded-[2px] bg-slate-50 text-[9px] font-mono flex items-center justify-center font-bold">
                      {c.trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-0.5">खाता नं. (Account Number)</label>
                <input
                  type="text"
                  value={formData.accountNumber || ''}
                  onChange={e => handleChange('accountNumber', e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="खाता नम्बर"
                />
                <div className="flex space-x-0.5 mt-1 overflow-x-auto">
                  {accountBoxes.map((c, i) => (
                    <span key={i} className="w-3.5 h-4 border border-slate-300 rounded-[2px] bg-slate-50 text-[9px] font-mono flex items-center justify-center font-bold">
                      {c.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION क: क. व्यक्तिगत विवरण (Personal Details) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>क. व्यक्तिगत विवरण (Personal Details)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (क)</span>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(१.क) नाम, थर (नेपालीमा) *</label>
                  <input
                    type="text"
                    value={formData.fullNameNp || ''}
                    onChange={e => handleChange('fullNameNp', e.target.value)}
                    placeholder="उदा. राम बहादुर महतो"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(१.ख) पुरा नाम, थर (अंग्रेजीमा - BLOCK LETTERS) *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={e => handleChange('fullName', e.target.value.toUpperCase())}
                    placeholder="E.G. RAM BAHADUR MAHATO"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(२) जन्म मिति (वि.सं.) *</label>
                  <input
                    type="text"
                    value={formData.dobBs || '२०४५/०५/१५'}
                    onChange={e => handleChange('dobBs', e.target.value)}
                    placeholder="२०४५/०५/१५"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">जन्म मिति (ई.सं. A.D.)</label>
                  <input
                    type="date"
                    value={formData.dobAd || ''}
                    onChange={e => handleChange('dobAd', e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(३) नागरिकता प्रमाण पत्र नं. *</label>
                  <input
                    type="text"
                    value={formData.citizenshipNo || ''}
                    onChange={e => handleChange('citizenshipNo', e.target.value)}
                    placeholder="उदा. १७-०१-७५-१२३४५"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(४) नागरिकता जारी मिति (वि.सं.)</label>
                  <input
                    type="text"
                    value={formData.citizenshipIssuedDateBs || '२०६०/०४/१५'}
                    onChange={e => handleChange('citizenshipIssuedDateBs', e.target.value)}
                    placeholder="२०६०/०४/१५"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">जारी मिति (ई.सं. A.D.)</label>
                  <input
                    type="date"
                    value={formData.citizenshipIssuedDateAd || ''}
                    onChange={e => handleChange('citizenshipIssuedDateAd', e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(५) नागरिकता जारी गर्ने कार्यालय र जिल्ला</label>
                  <input
                    type="text"
                    value={formData.citizenshipIssuedOffice || 'जिल्ला प्रशासन कार्यालय, महोत्तरी'}
                    onChange={e => {
                      handleChange('citizenshipIssuedOffice', e.target.value);
                      handleChange('citizenshipIssuedDistrict', e.target.value);
                    }}
                    placeholder="जिल्ला प्रशासन कार्यालय, महोत्तरी"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">(६) लिङ्ग (Gender) :</label>
                <div className="flex flex-wrap items-center gap-4">
                  {(['Female', 'Male', 'Other'] as const).map(g => (
                    <label key={g} className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border cursor-pointer ${formData.gender === g ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <input
                        type="radio"
                        name="gender"
                        checked={formData.gender === g}
                        onChange={() => handleChange('gender', g)}
                        className="text-emerald-600"
                      />
                      <span>{g === 'Female' ? 'महिला (Female)' : g === 'Male' ? 'पुरुष (Male)' : 'अन्य (Other)'}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION ख: ख. पारिवारिक विवरण (Family Details) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>ख. पारिवारिक विवरण (Family Details)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (ख)</span>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(६) आमाको नाम (Mother's Name)</label>
                  <input
                    type="text"
                    value={formData.motherName || ''}
                    onChange={e => handleChange('motherName', e.target.value)}
                    placeholder="आमाको पुरा नाम"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(७) बाबुको नाम (Father's Name)</label>
                  <input
                    type="text"
                    value={formData.fatherName || ''}
                    onChange={e => handleChange('fatherName', e.target.value)}
                    placeholder="बाबुको पुरा नाम"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">बाजे वा ससुराको नाम (Grandfather)</label>
                  <input
                    type="text"
                    value={formData.grandfatherName || ''}
                    onChange={e => handleChange('grandfatherName', e.target.value)}
                    placeholder="बाजे वा ससुराको नाम"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">(९) पति वा पत्नीको नाम (Spouse)</label>
                  <input
                    type="text"
                    value={formData.spouseName || ''}
                    onChange={e => handleChange('spouseName', e.target.value)}
                    placeholder="पति वा पत्नीको नाम"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">(८) वैवाहिक स्थिति (Marital Status) :</label>
                <div className="flex flex-wrap items-center gap-4">
                  {(['Married', 'Single', 'Other'] as const).map(s => (
                    <label key={s} className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border cursor-pointer ${formData.maritalStatus === s ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <input
                        type="radio"
                        name="maritalStatus"
                        checked={formData.maritalStatus === s}
                        onChange={() => handleChange('maritalStatus', s)}
                        className="text-emerald-600"
                      />
                      <span>{s === 'Married' ? 'विवाहित (Married)' : s === 'Single' ? 'अविवाहित (Unmarried)' : 'एकल (Single)'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">(१०) परिवारको किसिम (Family Type) :</label>
                <div className="flex flex-wrap items-center gap-4">
                  {['संयुक्त र एकै भान्सा', 'संयुक्त तर अलग भान्सा', 'छुट्टिभिन्न वा एकलरुवा (न्युक्लियर)'].map(t => (
                    <label key={t} className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border cursor-pointer ${formData.familyType === t ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <input
                        type="radio"
                        name="familyType"
                        checked={formData.familyType === t}
                        onChange={() => handleChange('familyType', t)}
                        className="text-emerald-600"
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Additional Family Members */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-slate-700 text-[11px]">
                    (११) थप पारिवारिक सदस्यहरूको विवरण (Additional Family Members)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddFamilyRow(!showAddFamilyRow)}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-[10px] flex items-center space-x-1"
                  >
                    <Plus size={11} />
                    <span>+ थप परिवार सदस्य थप्नुहोस्</span>
                  </button>
                </div>

                {showAddFamilyRow && (
                  <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 mb-2 grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="सदस्यको नाम"
                      value={newFamilyMember.name}
                      onChange={e => setNewFamilyMember({ ...newFamilyMember, name: e.target.value })}
                      className="p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="नाता (Relation)"
                      value={newFamilyMember.relation}
                      onChange={e => setNewFamilyMember({ ...newFamilyMember, relation: e.target.value })}
                      className="p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="उमेर / पेशा"
                      value={newFamilyMember.occupation}
                      onChange={e => setNewFamilyMember({ ...newFamilyMember, occupation: e.target.value })}
                      className="p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newFamilyMember.name) {
                          handleChange('additionalFamilyMembers', [...(formData.additionalFamilyMembers || []), newFamilyMember]);
                          setNewFamilyMember({ name: '', relation: '', age: '', occupation: '' });
                          setShowAddFamilyRow(false);
                        }
                      }}
                      className="px-2 py-1 bg-emerald-800 text-white rounded font-bold text-xs"
                    >
                      थप्नुहोस्
                    </button>
                  </div>
                )}

                {formData.additionalFamilyMembers && formData.additionalFamilyMembers.length > 0 ? (
                  <div className="space-y-1">
                    {formData.additionalFamilyMembers.map((fm, idx) => (
                      <div key={idx} className="flex justify-between items-center p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                        <span><strong>{fm.name}</strong> ({fm.relation}) - {fm.occupation}</span>
                        <button
                          type="button"
                          onClick={() => {
                            handleChange('additionalFamilyMembers', formData.additionalFamilyMembers?.filter((_, i) => i !== idx));
                          }}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-xl p-2.5 text-center text-slate-400 text-[11px] bg-slate-50/50">
                    हाल कुनै थप परिवार सदस्य थपिएको छैन। आवश्यकता अनुसार थप सदस्य प्रविष्टि गर्न माथिको '+ थप परिवार सदस्य थप्नुहोस्' बटन थिच्नुहोस्।
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION ग: ग. पेशाको विवरण (Occupation Details) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>ग. पेशाको विवरण (Occupation Details)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (ग)</span>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">११. आफ्नो मुख्य पेशा :</label>
                <div className="flex flex-wrap items-center gap-2">
                  {['खेतीपाती', 'नोकरी (खुलाउने)', 'व्यवसाय (खुलाउने)', 'वैदेशिक रोजगारी', 'अन्य (खुलाउने)'].map(o => (
                    <label key={o} className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border cursor-pointer ${formData.occupation === o ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <input
                        type="radio"
                        name="occupation"
                        checked={formData.occupation === o}
                        onChange={() => handleChange('occupation', o)}
                        className="text-emerald-600"
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  १२. स्थायी लेखा नम्बर (PAN Number - ऐच्छिक भएमा भर्नुहोस्) :
                </label>
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    {panDigits.map((d, idx) => (
                      <span key={idx} className="w-6 h-7 border border-slate-400 rounded bg-slate-50 font-mono font-bold text-xs flex items-center justify-center">
                        {d.trim()}
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={formData.panNo || ''}
                    onChange={e => handleChange('panNo', e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="9-अङ्कको PAN नम्बर"
                    className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold w-44"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">१३. पति वा पत्नीको मुख्य पेशा :</label>
                <div className="flex flex-wrap items-center gap-2">
                  {['खेतीपाती', 'नोकरी', 'व्यवसाय', 'वैदेशिक रोजगारी', 'अन्य'].map(o => (
                    <label key={o} className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border cursor-pointer ${formData.spouseOccupation === o ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <input
                        type="radio"
                        name="spouseOccupation"
                        checked={formData.spouseOccupation === o}
                        onChange={() => handleChange('spouseOccupation', o)}
                        className="text-emerald-600"
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">१४.१ आफू, पति/पत्नीबाहेक अर्को कमाउने सदस्यको नाता :</label>
                  <input
                    type="text"
                    value={formData.earningMemberRelation || ''}
                    onChange={e => handleChange('earningMemberRelation', e.target.value)}
                    placeholder="उदा. छोरा / भाई / बुहारी"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">१४.२ निजको पेशा :</label>
                  <input
                    type="text"
                    value={formData.earningMemberOccupation || ''}
                    onChange={e => handleChange('earningMemberOccupation', e.target.value)}
                    placeholder="उदा. सरकारी जागिर / वैदेशिक रोजगारी (दुबई)"
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">१५. आफू वा परिवारको कुनै सदस्य उच्च पदस्थ भूमिकामा रहे, नरहेको :</label>
                <div className="flex items-center space-x-4">
                  {['नरहेको', 'रहेको'].map(p => (
                    <label key={p} className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border cursor-pointer ${formData.isHighProfile === p ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <input
                        type="radio"
                        name="isHighProfile"
                        checked={formData.isHighProfile === p}
                        onChange={() => handleChange('isHighProfile', p)}
                        className="text-emerald-600"
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION घ: घ. बसाइँको विवरण (Residential Details) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>घ. बसाइँको विवरण (Residential Details)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (घ)</span>
            </div>

            <div className="p-3.5 space-y-3">
              {/* Permanent Address */}
              <div className="p-2.5 bg-emerald-50/30 rounded-xl border border-emerald-200 space-y-2">
                <span className="text-xs font-black text-emerald-900 block">१७. स्थायी ठेगाना (PERMANENT ADDRESS)</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">प्रदेश :</label>
                    <input
                      type="text"
                      value={formData.permanentProvince || 'मधेश प्रदेश (Madhesh Province)'}
                      onChange={e => handleChange('permanentProvince', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">जिल्ला :</label>
                    <input
                      type="text"
                      value={formData.permanentDistrict || 'महोत्तरी (Mahottari)'}
                      onChange={e => handleChange('permanentDistrict', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">न.पा./गाउँपालिका :</label>
                    <input
                      type="text"
                      value={formData.permanentMunicipality || 'पिपरा गाउँपालिका'}
                      onChange={e => handleChange('permanentMunicipality', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">वडा नं. :</label>
                    <input
                      type="text"
                      value={formData.permanentWard || '०३'}
                      onChange={e => handleChange('permanentWard', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">गाउँ/टोल :</label>
                    <input
                      type="text"
                      value={formData.permanentTole || 'रतौली'}
                      onChange={e => handleChange('permanentTole', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">घर नं. :</label>
                    <input
                      type="text"
                      value={formData.permanentHouseNo || ''}
                      onChange={e => handleChange('permanentHouseNo', e.target.value)}
                      placeholder="वैकल्पिक"
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">सम्पर्क मोबाइल नं. * :</label>
                    <input
                      type="text"
                      required
                      value={formData.mobile}
                      onChange={e => handleChange('mobile', e.target.value)}
                      placeholder="९८..."
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">ईमेल :</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={e => handleChange('email', e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Temporary Address */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-800">१८. अस्थायी ठेगाना (TEMPORARY ADDRESS)</span>
                  <label className="flex items-center space-x-1.5 text-[11px] font-bold text-emerald-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isSameAddress}
                      onChange={e => {
                        const checked = e.target.checked;
                        handleChange('isSameAddress', checked);
                        if (checked) {
                          handleChange('temporaryProvince', formData.permanentProvince);
                          handleChange('temporaryDistrict', formData.permanentDistrict);
                          handleChange('temporaryMunicipality', formData.permanentMunicipality);
                          handleChange('temporaryWard', formData.permanentWard);
                        }
                      }}
                      className="rounded text-emerald-600"
                    />
                    <span>स्थायी ठेगाना सरह (Same as Permanent)</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">प्रदेश :</label>
                    <input
                      type="text"
                      value={formData.temporaryProvince || ''}
                      onChange={e => handleChange('temporaryProvince', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">जिल्ला :</label>
                    <input
                      type="text"
                      value={formData.temporaryDistrict || ''}
                      onChange={e => handleChange('temporaryDistrict', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">न.पा./गाउँपालिका :</label>
                    <input
                      type="text"
                      value={formData.temporaryMunicipality || ''}
                      onChange={e => handleChange('temporaryMunicipality', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">वडा नं. :</label>
                    <input
                      type="text"
                      value={formData.temporaryWard || ''}
                      onChange={e => handleChange('temporaryWard', e.target.value)}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Other Residency Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">१९. संस्थाको कार्यक्षेत्रको बसोबास :</label>
                  <div className="flex items-center space-x-3">
                    {['स्थायी', 'अस्थायी'].map(b => (
                      <label key={b} className="flex items-center space-x-1 cursor-pointer">
                        <input
                          type="radio"
                          name="workingAreaResidency"
                          checked={formData.workingAreaResidency === b}
                          onChange={() => handleChange('workingAreaResidency', b)}
                          className="text-emerald-600"
                        />
                        <span>{b}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">२०. मतदाता परिचय-पत्र नं. :</label>
                  <input
                    type="text"
                    value={formData.voterIdNo || ''}
                    onChange={e => handleChange('voterIdNo', e.target.value)}
                    placeholder="मतदाता परिचय-पत्र नं."
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">२१. मतदान स्थल :</label>
                  <input
                    type="text"
                    value={formData.votingCenter || 'उदा. पिपरा मा.वि.'}
                    onChange={e => handleChange('votingCenter', e.target.value)}
                    placeholder="उदा. पिपरा मा.वि."
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">२२. कार्यक्षेत्रमा वर्षमा बिताउने अवधि :</label>
                  <input
                    type="text"
                    value={formData.stayDurationInArea || '१२ महिना (स्थायी)'}
                    onChange={e => handleChange('stayDurationInArea', e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">२३. राहदानी नं. (भएमा) :</label>
                  <input
                    type="text"
                    value={formData.passportNo || ''}
                    onChange={e => handleChange('passportNo', e.target.value)}
                    placeholder="Passport No."
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION ङ: ङ. सहकारी सदस्यता (Cooperative Membership) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>ङ. सहकारी सदस्यता (Cooperative Membership)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (ङ)</span>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-0.5">२४. संस्थाको सदस्य बन्नुको उद्देश्य :</label>
                <input
                  type="text"
                  value={formData.cooperativePurpose || 'नियमित बचत, कर्जा सुविधा तथा आर्थिक समृद्धि'}
                  onChange={e => handleChange('cooperativePurpose', e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">२५. आफूँ अर्को सहकारी संस्थाको पनि सदस्य भए, नभएको :</label>
                  <div className="flex items-center space-x-4">
                    {['नभएको', 'भएको'].map(o => (
                      <label key={o} className="flex items-center space-x-1 cursor-pointer">
                        <input
                          type="radio"
                          name="isOtherCoopMember"
                          checked={formData.isOtherCoopMember === o}
                          onChange={() => handleChange('isOtherCoopMember', o)}
                          className="text-emerald-600"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">३१. परिवारको अर्को सदस्य पनि यसै संस्थाको सदस्य भए, नभएको :</label>
                  <div className="flex items-center space-x-4">
                    {['नभएको', 'भएको'].map(o => (
                      <label key={o} className="flex items-center space-x-1 cursor-pointer">
                        <input
                          type="radio"
                          name="isFamilyOtherCoopMember"
                          checked={formData.isFamilyOtherCoopMember === o}
                          onChange={() => handleChange('isFamilyOtherCoopMember', o)}
                          className="text-emerald-600"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION च: च. आयस्रोतको विवरण (Annual Income Sources) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>च. आयस्रोतको विवरण (Annual Income Sources)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (च)</span>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">३३. वार्षिक पारिवारिक कुल आम्दानी (रु.) :</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['रु. ४ लाख सम्म', 'रु. ४ लाखभन्दा बढी १० लाखसम्म', 'रु. १० लाखभन्दा बढी २५ लाखसम्म', 'रु. ५० लाख भन्दा बढी'].map(r => (
                    <label key={r} className={`flex items-center space-x-1.5 p-2 rounded-lg border cursor-pointer text-xs ${formData.annualIncomeRange === r ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <input
                        type="radio"
                        name="annualIncomeRange"
                        checked={formData.annualIncomeRange === r}
                        onChange={() => handleChange('annualIncomeRange', r)}
                        className="text-emerald-600"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">३४. पछिल्लो आर्थिक वर्षको आय र स्रोतको विवरण (रु.) :</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 block">खेतीपाती (रु.) :</span>
                    <input
                      type="text"
                      placeholder="रु."
                      value={formData.annualIncomeSources?.agriculture || '३,००,०००'}
                      onChange={e => handleChange('annualIncomeSources', { ...formData.annualIncomeSources, agriculture: e.target.value })}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 block">व्यवसाय (रु.) :</span>
                    <input
                      type="text"
                      placeholder="रु."
                      value={formData.annualIncomeSources?.business || '१,००,०००'}
                      onChange={e => handleChange('annualIncomeSources', { ...formData.annualIncomeSources, business: e.target.value })}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 block">स्वदेशी रोजगारी (रु.) :</span>
                    <input
                      type="text"
                      placeholder="रु."
                      value={formData.annualIncomeSources?.domesticJob || '२,००,०००'}
                      onChange={e => handleChange('annualIncomeSources', { ...formData.annualIncomeSources, domesticJob: e.target.value })}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 block">वैदेशिक रोजगारी (रु.) :</span>
                    <input
                      type="text"
                      placeholder="रु."
                      value={formData.annualIncomeSources?.foreignJob || ''}
                      onChange={e => handleChange('annualIncomeSources', { ...formData.annualIncomeSources, foreignJob: e.target.value })}
                      className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION छ: छ. वित्तीय कारोबारको विवरण (Financial Transactions) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>छ. वित्तीय कारोबारको विवरण (Financial Transactions)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (छ)</span>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">३५.१ सेयर खरिद बापत रकम (रु.) :</label>
                  <input
                    type="text"
                    value={formData.shareAmount || '10000'}
                    onChange={e => handleChange('shareAmount', e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">३५.२ बचत जम्मा बापत रकम (रु.) :</label>
                  <input
                    type="text"
                    value={formData.savingsAmount || '5000'}
                    onChange={e => handleChange('savingsAmount', e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">३७. संस्थासँग अनुमानित ऋणधन (रु.) :</label>
                  <input
                    type="text"
                    value={formData.estimatedLoan || '२,००,००० (आवश्यक परेमा)'}
                    onChange={e => handleChange('estimatedLoan', e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">३६.क वर्षमा कारोबार गर्ने अनुमानित पटक :</label>
                  <input
                    type="text"
                    value={formData.estimatedTransactionsCount || '२४ पटक'}
                    onChange={e => handleChange('estimatedTransactionsCount', e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">३६.ख वार्षिक रुपमा जम्मा गर्ने अनुमानित रकम (रु.) :</label>
                  <input
                    type="text"
                    value={formData.estimatedAnnualDeposit || '१,००,०००'}
                    onChange={e => handleChange('estimatedAnnualDeposit', e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION ज: ज. स्व-घोषणा (Applicant Self Declaration) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>ज. स्व-घोषणा (Applicant Self Declaration)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (ज)</span>
            </div>

            <div className="p-3.5 space-y-3">
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 text-xs space-y-1.5 text-slate-800">
                <p>१. मैले पेश गरेको यो विवरणमा भविष्यमा कुनै परिवर्तन आएमा त्यस्तो परिवर्तन भएको मितिले ३५ दिनभित्र संस्थामा पेश गर्नेछु।</p>
                <p>२. मैले माथि पेश गरेको मेरो सम्पूर्ण विवरण ठिक दुरुस्त छ। झुट्टा ठहरे कानुनबमोजिम सहुँला, बुझाउँला।</p>
                <label className="flex items-center space-x-2 pt-1 font-bold text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.selfDeclarationConfirmed ?? true}
                    onChange={e => handleChange('selfDeclarationConfirmed', e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>माथि उल्लिखित स्व-घोषणा मलाई पूर्ण मन्जुर छ। (I agree & confirm)</span>
                </label>
              </div>

              {/* Signature and Thumb Impressions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Signature */}
                <div className="border-2 border-dashed border-emerald-400 rounded-xl p-2.5 text-center bg-slate-50/50">
                  <span className="font-bold text-[11px] text-slate-800 block mb-1">निवेदकको दस्तखत (Signature)</span>
                  <label className="cursor-pointer block">
                    {formData.signaturePhoto ? (
                      <img src={formData.signaturePhoto} alt="Signature" className="h-16 mx-auto object-contain my-1" />
                    ) : (
                      <div className="h-16 border border-slate-200 rounded-lg flex flex-col items-center justify-center bg-white text-slate-400 text-[10px] hover:bg-slate-50">
                        <Upload size={14} className="mb-0.5 text-emerald-600" />
                        <span>दस्तखत फोटो अपलोड गर्नुहोस्</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleGenericFileUpload('signaturePhoto')} className="hidden" />
                  </label>
                  <span className="text-[9px] text-slate-500 font-bold block mt-1">नाम: {formData.fullName || formData.fullNameNp || 'निवेदकको नाम'}</span>
                </div>

                {/* Right Thumb */}
                <div className="border-2 border-dashed border-emerald-400 rounded-xl p-2.5 text-center bg-slate-50/50">
                  <span className="font-bold text-[11px] text-slate-800 block mb-1">दायाँ औंठा छाप (Right Thumb)</span>
                  <label className="cursor-pointer block">
                    {formData.rightThumbPhoto ? (
                      <img src={formData.rightThumbPhoto} alt="Right Thumb" className="h-16 mx-auto object-contain my-1" />
                    ) : (
                      <div className="h-16 border border-slate-200 rounded-lg flex flex-col items-center justify-center bg-white text-slate-400 text-[10px] hover:bg-slate-50">
                        <Upload size={14} className="mb-0.5 text-emerald-600" />
                        <span>दायाँ औंठाको छाप</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleGenericFileUpload('rightThumbPhoto')} className="hidden" />
                  </label>
                  <span className="text-[9px] text-slate-400 block mt-1">फोटो / स्क्यान अपलोड</span>
                </div>

                {/* Left Thumb */}
                <div className="border-2 border-dashed border-emerald-400 rounded-xl p-2.5 text-center bg-slate-50/50">
                  <span className="font-bold text-[11px] text-slate-800 block mb-1">बायाँ औंठा छाप (Left Thumb)</span>
                  <label className="cursor-pointer block">
                    {formData.leftThumbPhoto ? (
                      <img src={formData.leftThumbPhoto} alt="Left Thumb" className="h-16 mx-auto object-contain my-1" />
                    ) : (
                      <div className="h-16 border border-slate-200 rounded-lg flex flex-col items-center justify-center bg-white text-slate-400 text-[10px] hover:bg-slate-50">
                        <Upload size={14} className="mb-0.5 text-emerald-600" />
                        <span>बायाँ औंठाको छाप</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleGenericFileUpload('leftThumbPhoto')} className="hidden" />
                  </label>
                  <span className="text-[9px] text-slate-400 block mt-1">फोटो / स्क्यान अपलोड</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION झ: झ. संलग्न कागजातहरू (Enclosed Documents) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0c6b45] text-white px-3.5 py-1.5 font-bold text-xs flex justify-between items-center">
              <span>झ. संलग्न कागजातहरू (Enclosed Documents)</span>
              <span className="text-[10px] text-emerald-200">खण्ड (झ)</span>
            </div>

            <div className="p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Citizenship Document */}
                <div className="border border-emerald-300 rounded-xl p-3 bg-emerald-50/20 text-center">
                  <div className="flex items-center space-x-1.5 font-bold text-[11px] text-emerald-950 mb-2">
                    <CheckSquare size={14} className="text-emerald-700" />
                    <span>नेपाली नागरिकता प्रमाणपत्रको प्रतिलिपि</span>
                  </div>
                  <label className="border-2 border-dashed border-emerald-400 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-emerald-50/50 transition-colors">
                    <Upload size={16} className="text-emerald-600 mb-1" />
                    <span className="text-[10px] font-bold text-emerald-800">JPG फाइल अपलोड गर्नुहोस्</span>
                    <span className="text-[8px] text-slate-400">(JPG / JPEG मात्र)</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const newDoc = {
                              id: `doc_${Date.now()}`,
                              title: 'नेपाली नागरिकता प्रमाणपत्र',
                              type: 'citizenship' as const,
                              fileUrl: reader.result as string,
                              fileName: file.name,
                              uploadedAt: Date.now()
                            };
                            handleChange('documents', [...(formData.documents || []), newDoc]);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Voter ID Document */}
                <div className="border border-emerald-300 rounded-xl p-3 bg-emerald-50/20 text-center">
                  <div className="flex items-center space-x-1.5 font-bold text-[11px] text-emerald-950 mb-2">
                    <CheckSquare size={14} className="text-emerald-700" />
                    <span>मतदाता परिचयपत्रको प्रतिलिपि</span>
                  </div>
                  <label className="border-2 border-dashed border-emerald-400 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-emerald-50/50 transition-colors">
                    <Upload size={16} className="text-emerald-600 mb-1" />
                    <span className="text-[10px] font-bold text-emerald-800">JPG फाइल अपलोड गर्नुहोस्</span>
                    <span className="text-[8px] text-slate-400">(JPG / JPEG मात्र)</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const newDoc = {
                              id: `doc_${Date.now()}`,
                              title: 'मतदाता परिचयपत्र',
                              type: 'other' as const,
                              fileUrl: reader.result as string,
                              fileName: file.name,
                              uploadedAt: Date.now()
                            };
                            handleChange('documents', [...(formData.documents || []), newDoc]);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* PP Photo Document */}
                <div className="border border-emerald-300 rounded-xl p-3 bg-emerald-50/20 text-center">
                  <div className="flex items-center space-x-1.5 font-bold text-[11px] text-emerald-950 mb-2">
                    <CheckSquare size={14} className="text-emerald-700" />
                    <span>पासपोर्ट साइजको फोटो प्रतिलिपि</span>
                  </div>
                  <label className="border-2 border-dashed border-emerald-400 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-emerald-50/50 transition-colors">
                    <Upload size={16} className="text-emerald-600 mb-1" />
                    <span className="text-[10px] font-bold text-emerald-800">JPG फाइल अपलोड गर्नुहोस्</span>
                    <span className="text-[8px] text-slate-400">(JPG / JPEG मात्र)</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Uploaded Documents List */}
              {formData.documents && formData.documents.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.documents.map((doc, dIdx) => (
                    <div key={doc.id} className="flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs">
                      <span className="font-semibold text-emerald-900">{doc.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('documents', formData.documents.filter((_, i) => i !== dIdx));
                        }}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION ञ: ञ. सञ्चालक समिति विवरण (Tenure, Mandate, Allowances & TDS 15%) as explicitly requested */}
          <div className="border-2 border-emerald-600 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-[#0c6b45] text-white px-4 py-2 font-bold text-xs flex justify-between items-center">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck size={16} className="text-emerald-300" />
                <span className="text-sm font-black tracking-tight">
                  ञ. सञ्चालक समिति विवरण (Tenure & Election Mandate, Monthly Allowances & Bank Credits)
                </span>
              </div>
              <span className="text-[10px] text-emerald-200 font-bold bg-emerald-900/60 px-2 py-0.5 rounded">
                खण्ड (ञ)
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Committee and Designation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-emerald-50/40 rounded-xl border border-emerald-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-800 block mb-1">
                    १. समिति / उप-समिति (Committee Category) *
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={e => {
                      const found = categories.find(c => c.id === e.target.value);
                      handleChange('categoryId', e.target.value);
                      handleChange('categoryName', found?.name || 'Board of Directors');
                    }}
                    className="w-full p-2 bg-white border border-emerald-300 rounded-xl font-bold text-xs"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-800 block">
                      २. पद / जिम्मेवारी (Designation & Mandate) *
                    </label>
                    <div className="flex items-center space-x-2">
                      {onOpenCreateDesignation && (
                        <button
                          type="button"
                          onClick={onOpenCreateDesignation}
                          className="text-[10px] text-purple-700 hover:text-purple-900 hover:underline font-bold"
                        >
                          + New Designation
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsCustomDesignation(!isCustomDesignation)}
                        className="text-[10px] text-indigo-700 hover:underline font-bold"
                      >
                        {isCustomDesignation ? '← Dropdown List' : '+ Type Custom'}
                      </button>
                    </div>
                  </div>

                  {!isCustomDesignation ? (
                    <select
                      required
                      value={formData.designation}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomDesignation(true);
                          return;
                        }
                        handleChange('designation', val);
                        const matchedDes = designations.find(d => d.title === val);
                        if (matchedDes) {
                          if (matchedDes.defaultAllowance && (!formData.allowanceConfig?.meetingAllowance || formData.allowanceConfig.meetingAllowance === 4000)) {
                            handleAllowanceChange('meetingAllowance', matchedDes.defaultAllowance);
                          }
                          if (matchedDes.mandate && (!formData.tenure?.notes || formData.tenure.notes === '')) {
                            handleTenureChange('notes', matchedDes.mandate);
                          }
                        }
                      }}
                      className="w-full p-2 bg-white border border-emerald-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Select Designation --</option>
                      {designations.map(d => (
                        <option key={d.id} value={d.title}>
                          {d.title} {d.defaultAllowance ? `(Rs. ${d.defaultAllowance.toLocaleString()})` : ''}
                        </option>
                      ))}
                      {formData.designation && !designations.some(d => d.title === formData.designation) && (
                        <option value={formData.designation}>{formData.designation} (Current)</option>
                      )}
                      <option value="__custom__">+ Type Custom...</option>
                    </select>
                  ) : (
                    <div className="flex space-x-1.5">
                      <input
                        type="text"
                        required
                        value={formData.designation}
                        onChange={e => handleChange('designation', e.target.value)}
                        placeholder="उदा. अध्यक्ष (Chairperson), सचिव, संयोजक"
                        className="flex-1 p-2 bg-white border border-emerald-300 rounded-xl font-bold text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomDesignation(false)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold shrink-0"
                      >
                        List
                      </button>
                    </div>
                  )}

                  {(() => {
                    const matched = designations.find(d => d.title === formData.designation);
                    if (matched?.mandate) {
                      return (
                        <p className="text-[10px] text-emerald-800 font-semibold mt-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <strong>जिम्मेवारी / Mandate:</strong> {matched.mandate}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Tenure and Mandate */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center space-x-1.5 text-xs font-black text-slate-800 uppercase">
                  <Calendar size={14} className="text-indigo-600" />
                  <span>कार्यकाल ट्र्याकिङ (Tenure & Term Mandate)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">कार्यकाल सत्र (Term Session)</label>
                    <input
                      type="text"
                      value={formData.tenure?.termLabel || '2080 - 2084'}
                      onChange={e => handleTenureChange('termLabel', e.target.value)}
                      placeholder="2080 - 2084"
                      className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">कार्यकाल स्थिति (Status)</label>
                    <select
                      value={formData.tenure?.status || 'Active'}
                      onChange={e => handleTenureChange('status', e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-emerald-800"
                    >
                      <option value="Active">Active (सक्रिय)</option>
                      <option value="Expiring Soon">Expiring Soon (म्याद सकिन लागेको)</option>
                      <option value="Completed">Completed (कार्यकाल पूरा)</option>
                      <option value="Resigned">Resigned (राजीनामा)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">निर्वाचित/नियुक्त मिति (BS)</label>
                    <input
                      type="text"
                      value={formData.tenure?.startDateBs || '2080-04-01'}
                      onChange={e => handleTenureChange('startDateBs', e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">म्याद समाप्त मिति (BS)</label>
                    <input
                      type="text"
                      value={formData.tenure?.endDateBs || '2084-03-30'}
                      onChange={e => handleTenureChange('endDateBs', e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Account Details */}
              <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center space-x-1.5 text-xs font-black text-emerald-950 uppercase">
                  <Landmark size={14} className="text-emerald-700" />
                  <span>बैंक खाता विवरण (Bank Details for Direct Allowance Disbursement)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">बैंकको नाम (Bank Name)</label>
                    <input
                      type="text"
                      value={formData.bankName || ''}
                      onChange={e => handleChange('bankName', e.target.value)}
                      placeholder="उदा. Nabil Bank Ltd."
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">शाखा (Branch)</label>
                    <input
                      type="text"
                      value={formData.bankBranch || ''}
                      onChange={e => handleChange('bankBranch', e.target.value)}
                      placeholder="उदा. Janakpur / Pipara"
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">खाता नं. (Account Number)</label>
                    <input
                      type="text"
                      value={formData.bankAccountNo || ''}
                      onChange={e => handleChange('bankAccountNo', e.target.value)}
                      placeholder="Account No"
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">खाताको किसिम (Account Type)</label>
                    <select
                      value={formData.bankAccountType || 'Savings'}
                      onChange={e => handleChange('bankAccountType', e.target.value)}
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold"
                    >
                      <option value="Savings">बचत खाता (Savings)</option>
                      <option value="Current">चल्ती खाता (Current)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Monthly Allowances (NPR) & TDS 15% Calculation */}
              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-300 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1.5 text-xs font-black text-emerald-950 uppercase">
                    <Wallet size={14} className="text-emerald-700" />
                    <span>मासिक सेवा सुविधा र १५% TDS कट्टी हिसाब (Monthly Allowances in NPR & TDS)</span>
                  </div>
                  <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                    १५% TDS (नेपाल आयकर ऐन)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-900 block">बैठक भत्ता (Meeting)</label>
                    <input
                      type="number"
                      value={formData.allowanceConfig?.meetingAllowance || 0}
                      onChange={e => handleAllowanceChange('meetingAllowance', Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-emerald-900 block">सञ्चार (Communication)</label>
                    <input
                      type="number"
                      value={formData.allowanceConfig?.communicationAllowance || 0}
                      onChange={e => handleAllowanceChange('communicationAllowance', Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-emerald-900 block">यातायात (Travel)</label>
                    <input
                      type="number"
                      value={formData.allowanceConfig?.travelAllowance || 0}
                      onChange={e => handleAllowanceChange('travelAllowance', Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-emerald-900 block">खाजा/दैनिक (TADA)</label>
                    <input
                      type="number"
                      value={formData.allowanceConfig?.refreshmentAllowance || 0}
                      onChange={e => handleAllowanceChange('refreshmentAllowance', Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-emerald-900 block">अन्य सुविधा (Other)</label>
                    <input
                      type="number"
                      value={formData.allowanceConfig?.otherAllowance || 0}
                      onChange={e => handleAllowanceChange('otherAllowance', Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-xs"
                    />
                  </div>
                </div>

                {/* Live Benefit Breakdown Card */}
                <div className="bg-white p-3 rounded-xl border border-emerald-300 flex flex-wrap justify-between items-center gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">कुल मासिक सुविधा (Gross)</span>
                    <span className="text-sm font-black text-slate-900 font-mono">Rs. {grossAllowance.toLocaleString()}</span>
                  </div>
                  <div className="h-7 w-px bg-slate-200 hidden sm:block" />
                  <div>
                    <span className="text-[10px] text-rose-600 font-bold block uppercase">१५% TDS कर कट्टी (Withholding)</span>
                    <span className="text-sm font-black text-rose-600 font-mono">- Rs. {tdsAmount.toLocaleString()}</span>
                  </div>
                  <div className="h-7 w-px bg-slate-200 hidden sm:block" />
                  <div className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-300">
                    <span className="text-[10px] text-emerald-800 font-black block uppercase">बैंक खातामा जम्मा हुने खुद रकम (Net Payable)</span>
                    <span className="text-base font-black text-emerald-700 font-mono">Rs. {netPayable.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </DayEndFieldset>

          {/* Form Actions (Submit / Cancel / View / Print) */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 no-print">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors"
              >
                <Printer size={14} />
                <span>फाराम प्रिन्ट गर्नुहोस् (Print KYM)</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {isViewMode ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    बन्द गर्नुहोस् (Close)
                  </button>
                  <button
                    type="button"
                    onClick={() => !isDayEnded && setIsViewMode(false)}
                    disabled={isDayEnded}
                    title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Profile'}
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs shadow-md uppercase tracking-wider flex items-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Edit2 size={15} />
                    <span>विवरण सम्पादन गर्नुहोस् (Edit Profile)</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    रद्द गर्नुहोस् (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={isDayEnded}
                    title={isDayEnded ? getDayEndedBlockMessage() : 'Save Board Profile'}
                    className="px-7 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs shadow-md uppercase tracking-wider flex items-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={16} />
                    <span>सुरक्षित गर्नुहोस् (Save Board Profile)</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
