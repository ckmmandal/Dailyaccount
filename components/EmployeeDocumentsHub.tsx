import React, { useState, useRef } from 'react';
import { 
  User, Award, CreditCard, Briefcase, FileCheck, 
  Printer, FileDown, Search, CheckCircle2, 
  Mail, Phone, MapPin, Globe, Loader2,
  Sparkles, Edit2, Copy, Check, ArrowRightLeft,
  FileBadge, Upload, Trash2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Employee, SystemSettings, Branch } from '../types';
import { RatauliOfficialEmblem } from './RatauliLogo';
import { CooperativeHeaderBrand } from './CooperativeHeaderBrand';
import { OfficialSecurityQrCode } from './OfficialSecurityQrCode';

export type EmployeeDocType = 
  | 'appointment_letter' 
  | 'transfer_letter' 
  | 'id_card' 
  | 'visiting_card' 
  | 'promotion_letter' 
  | 'appreciation_letter';

interface Props {
  employees: Employee[];
  branches: Branch[];
  settings?: SystemSettings | null;
  initialEmployeeId?: string | null;
  onBack?: () => void;
}

export const EmployeeDocumentsHub: React.FC<Props> = ({ 
  employees, 
  branches,
  settings,
  initialEmployeeId,
  onBack 
}) => {
  const [selectedDocType, setSelectedDocType] = useState<EmployeeDocType>('appointment_letter');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    initialEmployeeId || (employees[0]?.id || '')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveEditMode, setIsLiveEditMode] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isGeneratingJpg, setIsGeneratingJpg] = useState(false);
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  // Common Document Fields
  const [refNo, setRefNo] = useState('च.नं. २०८१/०८२-११४');
  const [dispatchDateBs, setDispatchDateBs] = useState('२०८१/०७/१५');
  const [dispatchDateAd, setDispatchDateAd] = useState('2024-10-31');
  const [registrationNo, setRegistrationNo] = useState('421/054/055');
  const [panNo, setPanNo] = useState('302488825');

  // Signatories & Uploaded Signatures
  const [primarySignatoryName, setPrimarySignatoryName] = useState('Dilip Kumar Sharma');
  const [primarySignatoryTitle, setPrimarySignatoryTitle] = useState('Chief Executive Officer (CEO)');
  const [primarySignatorySignature, setPrimarySignatorySignature] = useState<string | null>(null);

  const [secondarySignatoryName, setSecondarySignatoryName] = useState('Rameshwor Prasad Yadav');
  const [secondarySignatoryTitle, setSecondarySignatoryTitle] = useState('Chairperson, Board of Directors');
  const [secondarySignatorySignature, setSecondarySignatorySignature] = useState<string | null>(null);

  const [idCardSignatoryTitle, setIdCardSignatoryTitle] = useState('General Manager');
  const [idCardSignatorySignature, setIdCardSignatorySignature] = useState<string | null>(null);

  // Transfer Letter Specific
  const [transferredBranchId, setTransferredBranchId] = useState<string>(
    branches[1]?.id || branches[0]?.id || ''
  );
  const [transferEffectiveDate, setTransferEffectiveDate] = useState('२०८१/०८/०१');
  const [transferRemarks, setTransferRemarks] = useState(
    'तपाईंले हाल कार्यरत शाखाको सम्पूर्ण हिसाब-किताब तथा जिन्सी सामग्रीहरू सम्बन्धित शाखा प्रमुखलाई बुझबुझारथ गरी तोकिएको मितिमा नयाँ शाखामा हाजिर हुनुहोला।'
  );

  // Promotion / Appointed Letter Specific
  const [promotedDesignation, setPromotedDesignation] = useState('वरिष्ठ सहायक / शाखा प्रमुख');
  const [promotionEffectiveDate, setPromotionEffectiveDate] = useState('२०८१/०८/०१');
  const [revisedBasicSalary, setRevisedBasicSalary] = useState<string>('३५,०००/-');

  const handleSignatureUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setter(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Card Theme
  const [visitingCardTheme, setVisitingCardTheme] = useState<'emerald' | 'white' | 'navy'>('emerald');

  const printAreaRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

  const currentBranch = branches.find((b: Branch) => 
    b.id === selectedEmployee?.branchId || b.code === selectedEmployee?.branchId
  )?.name || 'केन्द्रीय कार्यालय (Head Office)';

  const targetBranch = branches.find((b: Branch) => 
    b.id === transferredBranchId || b.code === transferredBranchId
  )?.name || 'शाखा कार्यालय, पिपरा';

  const filteredEmployees = employees.filter(e => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (e.fullName || '').toLowerCase().includes(q) || (e.fullNameNepali || '').includes(q);
    const codeMatch = (e.employeeCode || '').toLowerCase().includes(q);
    const desMatch = (e.designation || '').toLowerCase().includes(q);
    return nameMatch || codeMatch || desMatch;
  });

  // Handle PDF Export
  const handleDownloadPdf = async () => {
    const el = document.getElementById('employee-doc-printable-canvas');
    if (!el) return;

    try {
      setIsExportingPdf(true);
      window.scrollTo(0, 0);

      const canvas = await html2canvas(el, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const isLandscape = selectedDocType === 'appreciation_letter';
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

      const fileSlug = selectedDocType.replace('_', '-');
      const empSlug = (selectedEmployee?.fullName || 'employee').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`${fileSlug}_${empSlug}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // JPG Download for Cards
  const handleDownloadJpg = async (elementId: string, fileName: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    setIsGeneratingJpg(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${fileName}.jpg`;
      link.click();
    } catch (err) {
      console.error('Failed to export JPG:', err);
    } finally {
      setIsGeneratingJpg(false);
    }
  };

  // Copy Image to Clipboard
  const handleCopyImage = async (elementId: string, label: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopySuccessMsg(`${label} copied to clipboard!`);
          setTimeout(() => setCopySuccessMsg(null), 3000);
        } catch {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/jpeg', 0.95);
          link.download = `${label.toLowerCase().replace(/\s+/g, '_')}.jpg`;
          link.click();
          setCopySuccessMsg(`${label} JPG downloaded!`);
          setTimeout(() => setCopySuccessMsg(null), 3000);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
  };

  return (
    <div className="space-y-3 font-sans text-slate-800">
      
      {/* Top Banner and Navigation Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-100 text-[#047857] rounded-lg">
                <FileBadge size={18} />
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Employee Documents & Identity Hub
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official Generator for Appointment Letters, Transfer Orders, Employee ID Cards, Visiting Cards, Promotion Orders & Appreciation Certificates
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Back to Staff List
              </button>
            )}

            <button
              onClick={() => setIsLiveEditMode(!isLiveEditMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors border ${
                isLiveEditMode 
                  ? 'bg-amber-50 text-amber-900 border-amber-300' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Edit2 size={13} className={isLiveEditMode ? 'text-amber-600' : 'text-slate-400'} />
              <span>{isLiveEditMode ? 'Live Edit Active' : 'Enable Live Edit'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs"
            >
              <Printer size={13} />
              <span>Print Document</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 bg-[#047857] hover:bg-[#065f46] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Document Selection Tabs - 100% English */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
          {[
            { id: 'appointment_letter', label: 'Appointment Letter', sub: 'Staff Appointment', icon: FileCheck },
            { id: 'transfer_letter', label: 'Transfer Order', sub: 'Branch Transfer', icon: ArrowRightLeft },
            { id: 'id_card', label: 'Staff ID Card', sub: 'CR80 Official ID', icon: CreditCard },
            { id: 'visiting_card', label: 'Visiting Card', sub: 'Executive Stationery', icon: Briefcase },
            { id: 'promotion_letter', label: 'Promotion Letter', sub: 'Promotion & Scale', icon: Sparkles },
            { id: 'appreciation_letter', label: 'Appreciation Cert', sub: 'Commendation Cert', icon: Award }
          ].map(tab => {
            const Icon = tab.icon;
            const active = selectedDocType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedDocType(tab.id as EmployeeDocType)}
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  active 
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50/60 border-[#047857] shadow-xs ring-1 ring-[#047857]' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon size={16} className={active ? 'text-[#047857]' : 'text-slate-400'} />
                  <span className={`text-xs font-black truncate block ${active ? 'text-[#064e3b]' : 'text-slate-800'}`}>
                    {tab.label}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium block truncate mt-0.5 pl-6">
                  {tab.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left Controls & Right Document Preview Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* Left Column: Employee & Document Parameters */}
        <div className="lg:col-span-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5 no-print">
          
          {/* Employee Selector with Search */}
          <div>
            <label className="text-xs font-black text-slate-800 block mb-1">
              1. Select Employee
            </label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, designation, code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
              {filteredEmployees.map(emp => {
                const active = emp.id === selectedEmployeeId;
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`w-full text-left p-1.5 rounded-lg flex items-center justify-between text-xs transition-all ${
                      active ? 'bg-[#064e3b] text-white shadow-2xs font-bold' : 'hover:bg-slate-200/70 text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="block truncate">{emp.fullName} {emp.fullNameNepali ? `(${emp.fullNameNepali})` : ''}</span>
                      <span className={`text-[10px] block truncate ${active ? 'text-amber-200' : 'text-slate-500'}`}>
                        {emp.designation} • {emp.employeeCode || 'EMP'}
                      </span>
                    </div>
                    {active && <Check size={14} className="shrink-0 text-amber-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Document General Settings */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
              2. Document Metadata
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Dispatch / Ref No.</label>
                <input
                  type="text"
                  value={refNo}
                  onChange={e => setRefNo(e.target.value)}
                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Date (BS)</label>
                <input
                  type="text"
                  value={dispatchDateBs}
                  onChange={e => setDispatchDateBs(e.target.value)}
                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Date (AD)</label>
                <input
                  type="text"
                  value={dispatchDateAd}
                  onChange={e => setDispatchDateAd(e.target.value)}
                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Regd No. / PAN</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={registrationNo}
                    onChange={e => setRegistrationNo(e.target.value)}
                    className="w-1/2 p-1 bg-white border border-slate-200 rounded text-[10px]"
                    title="Registration No"
                  />
                  <input
                    type="text"
                    value={panNo}
                    onChange={e => setPanNo(e.target.value)}
                    className="w-1/2 p-1 bg-white border border-slate-200 rounded text-[10px]"
                    title="PAN No"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Conditional Options: Transfer Letter */}
          {selectedDocType === 'transfer_letter' && (
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 text-xs">
              <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">
                3. Transfer Details
              </span>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">Target Branch</label>
                <select
                  value={transferredBranchId}
                  onChange={e => setTransferredBranchId(e.target.value)}
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">Effective Date (BS)</label>
                <input
                  type="text"
                  value={transferEffectiveDate}
                  onChange={e => setTransferEffectiveDate(e.target.value)}
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">Handover Instructions / Remarks</label>
                <textarea
                  value={transferRemarks}
                  onChange={e => setTransferRemarks(e.target.value)}
                  rows={2}
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {/* Conditional Options: Promotion / Appointed Letter */}
          {selectedDocType === 'promotion_letter' && (
            <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 space-y-2 text-xs">
              <span className="text-[10px] font-black text-teal-900 uppercase tracking-wider block">
                4. Promotion Details
              </span>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">New Designation</label>
                <input
                  type="text"
                  value={promotedDesignation}
                  onChange={e => setPromotedDesignation(e.target.value)}
                  className="w-full p-1.5 bg-white border border-teal-300 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Effective Date (BS)</label>
                  <input
                    type="text"
                    value={promotionEffectiveDate}
                    onChange={e => setPromotionEffectiveDate(e.target.value)}
                    className="w-full p-1.5 bg-white border border-teal-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Revised Basic Salary</label>
                  <input
                    type="text"
                    value={revisedBasicSalary}
                    onChange={e => setRevisedBasicSalary(e.target.value)}
                    className="w-full p-1.5 bg-white border border-teal-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Options: Visiting Card Palette */}
          {selectedDocType === 'visiting_card' && (
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">5. Card Color Theme</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setVisitingCardTheme('emerald')}
                  className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                    visitingCardTheme === 'emerald' ? 'border-[#064e3b] bg-gradient-to-r from-[#064e3b] to-[#047857] text-amber-300 shadow-xs' : 'border-slate-200 text-slate-700 bg-white hover:bg-emerald-50'
                  }`}
                >
                  Emerald Green
                </button>
                <button
                  type="button"
                  onClick={() => setVisitingCardTheme('white')}
                  className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                    visitingCardTheme === 'white' ? 'border-slate-800 bg-slate-900 text-white shadow-xs' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                >
                  Executive White
                </button>
                <button
                  type="button"
                  onClick={() => setVisitingCardTheme('navy')}
                  className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                    visitingCardTheme === 'navy' ? 'border-indigo-600 bg-indigo-900 text-amber-200 shadow-xs' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                  }`}
                >
                  Navy Blue
                </button>
              </div>
            </div>
          )}

          {/* Signatories Configuration & Uploads */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
              6. Authorized Signatories & Signatures
            </span>
            
            {/* Primary Signatory */}
            <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5">
              <label className="text-[9.5px] font-bold text-slate-700 block">Primary Signatory (CEO / Executive)</label>
              <input
                type="text"
                placeholder="Name"
                value={primarySignatoryName}
                onChange={e => setPrimarySignatoryName(e.target.value)}
                className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold"
              />
              <input
                type="text"
                placeholder="Title / Designation"
                value={primarySignatoryTitle}
                onChange={e => setPrimarySignatoryTitle(e.target.value)}
                className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600"
              />
              
              {/* Signature Upload for Primary */}
              <div className="pt-1 flex items-center justify-between gap-2">
                {primarySignatorySignature ? (
                  <div className="flex items-center space-x-2 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex-1 min-w-0">
                    <img src={primarySignatorySignature} alt="Primary Sign" className="h-6 w-12 object-contain bg-white rounded border border-emerald-100" />
                    <span className="text-[9px] text-[#064e3b] font-bold truncate">Signature Loaded</span>
                    <button
                      type="button"
                      onClick={() => setPrimarySignatorySignature(null)}
                      className="ml-auto text-rose-500 hover:text-rose-700 p-0.5 rounded"
                      title="Remove signature"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-dashed border-slate-300 cursor-pointer text-[10px] font-medium transition-colors">
                    <Upload size={12} className="text-[#047857]" />
                    <span>Upload Signature Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleSignatureUpload(e, setPrimarySignatorySignature)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Secondary Signatory */}
            <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5">
              <label className="text-[9.5px] font-bold text-slate-700 block">Secondary Signatory (Chairperson / Board)</label>
              <input
                type="text"
                placeholder="Name"
                value={secondarySignatoryName}
                onChange={e => setSecondarySignatoryName(e.target.value)}
                className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold"
              />
              <input
                type="text"
                placeholder="Title / Designation"
                value={secondarySignatoryTitle}
                onChange={e => setSecondarySignatoryTitle(e.target.value)}
                className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600"
              />
              
              {/* Signature Upload for Secondary */}
              <div className="pt-1 flex items-center justify-between gap-2">
                {secondarySignatorySignature ? (
                  <div className="flex items-center space-x-2 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex-1 min-w-0">
                    <img src={secondarySignatorySignature} alt="Secondary Sign" className="h-6 w-12 object-contain bg-white rounded border border-emerald-100" />
                    <span className="text-[9px] text-[#064e3b] font-bold truncate">Signature Loaded</span>
                    <button
                      type="button"
                      onClick={() => setSecondarySignatorySignature(null)}
                      className="ml-auto text-rose-500 hover:text-rose-700 p-0.5 rounded"
                      title="Remove signature"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-dashed border-slate-300 cursor-pointer text-[10px] font-medium transition-colors">
                    <Upload size={12} className="text-[#047857]" />
                    <span>Upload Signature Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleSignatureUpload(e, setSecondarySignatorySignature)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* ID Card Signatory */}
            <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5">
              <label className="text-[9.5px] font-bold text-slate-700 block">ID Card Signatory (Card Issuer)</label>
              <input
                type="text"
                placeholder="Signatory Title (e.g. General Manager)"
                value={idCardSignatoryTitle}
                onChange={e => setIdCardSignatoryTitle(e.target.value)}
                className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 font-semibold"
              />
              
              {/* Signature Upload for ID Card */}
              <div className="pt-1 flex items-center justify-between gap-2">
                {idCardSignatorySignature ? (
                  <div className="flex items-center space-x-2 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex-1 min-w-0">
                    <img src={idCardSignatorySignature} alt="ID Card Sign" className="h-6 w-12 object-contain bg-white rounded border border-amber-100" />
                    <span className="text-[9px] text-amber-900 font-bold truncate">ID Card Sign Loaded</span>
                    <button
                      type="button"
                      onClick={() => setIdCardSignatorySignature(null)}
                      className="ml-auto text-rose-500 hover:text-rose-700 p-0.5 rounded"
                      title="Remove signature"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-dashed border-slate-300 cursor-pointer text-[10px] font-medium transition-colors">
                    <Upload size={12} className="text-amber-600" />
                    <span>Upload ID Card Signature</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleSignatureUpload(e, setIdCardSignatorySignature)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Printable Preview Canvas */}
        <div className="lg:col-span-8 bg-slate-100 p-3 sm:p-5 rounded-2xl border border-slate-300 shadow-inner flex flex-col items-center justify-center overflow-x-auto min-h-[600px]">
          
          <div 
            id="employee-doc-printable-canvas"
            ref={printAreaRef}
            className={`bg-white shadow-2xl transition-all ${
              selectedDocType === 'appreciation_letter'
                ? 'w-full max-w-[900px] min-h-[600px]'
                : selectedDocType === 'id_card' || selectedDocType === 'visiting_card'
                ? 'w-full max-w-[850px] p-6 bg-transparent shadow-none'
                : 'w-full max-w-[780px] min-h-[960px] p-8 sm:p-12 text-slate-900 border border-slate-300'
            }`}
          >

            {/* ========================================================= */}
            {/* 1. APPOINTMENT LETTER (नियुक्ति पत्र)                       */}
            {/* ========================================================= */}
            {selectedDocType === 'appointment_letter' && (
              <div className="space-y-6 text-xs sm:text-sm leading-relaxed">
                {/* Official Letterhead Header */}
                <div className="border-b-2 border-[#064e3b] pb-4 pt-1 flex items-center justify-center gap-4 text-center w-full">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                    {settings?.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <RatauliOfficialEmblem className="w-full h-full" withoutCircle={true} />
                    )}
                  </div>
                  <div className="flex-1 max-w-[620px]">
                    <CooperativeHeaderBrand size="2xl" />
                  </div>
                </div>

                {/* Top Reference & Date Bar */}
                <div className="flex justify-between items-center text-[11px] text-slate-700 font-mono border-b border-slate-200 pb-2">
                  <span>{refNo}</span>
                  <span>मिति: <strong>{dispatchDateBs}</strong> ({dispatchDateAd})</span>
                </div>

                {/* Recipient Address */}
                <div className="space-y-0.5 pt-2">
                  <p className="font-bold">श्री <strong>{selectedEmployee?.fullNameNepali || selectedEmployee?.fullName}</strong></p>
                  <p className="text-slate-700">पद: <strong>{selectedEmployee?.designationNepali || selectedEmployee?.designation}</strong></p>
                  <p className="text-slate-600">ठेगाना: {selectedEmployee?.permanentAddressNepali || selectedEmployee?.permanentAddress || 'पिपरा, महोत्तरी'}</p>
                </div>

                {/* Subject Header */}
                <div className="text-center py-2">
                  <h3 className="text-base font-black text-[#064e3b] border-b-2 border-[#064e3b] inline-block pb-1 tracking-tight">
                    विषय: नियुक्ति सम्बन्धमा (Letter of Appointment)
                  </h3>
                </div>

                {/* Body Content */}
                <div className="space-y-3 text-justify text-slate-800 leading-relaxed font-sans">
                  <p>
                    महोदय,
                  </p>
                  <p>
                    यस रतौली बचत तथा ऋण सहकारी संस्था लिमिटेडको कर्मचारी सेवा नियमावली तथा पदपूर्ति समितिको सिफारिस बमोजिम तपाईंलाई यस संस्थाको <strong>{currentBranch}</strong> अन्तर्गत <strong>{selectedEmployee?.department || 'कार्यसञ्चालन'}</strong> विभागमा <strong>{selectedEmployee?.designationNepali || selectedEmployee?.designation}</strong> पदमा मिति <strong>{selectedEmployee?.joinedDate || dispatchDateBs}</strong> देखि लागू हुने गरी निम्न शर्त तथा सेवा सुविधाको अधीनमा रहने गरी नियुक्त गरिएको व्यहोरा सहर्ष जानकारी गराइन्छ।
                  </p>

                  {/* Terms Table */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden my-3">
                    <table className="w-full text-left text-xs">
                      <tbody>
                        <tr className="border-b border-slate-200 bg-emerald-50/50">
                          <td className="p-2.5 font-bold text-slate-700 w-1/3">पद (Designation):</td>
                          <td className="p-2.5 font-bold text-[#064e3b]">{selectedEmployee?.designation} ({selectedEmployee?.designationNepali || 'कर्मचारी'})</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-semibold text-slate-600">कर्मचारी कोड (Emp Code):</td>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{selectedEmployee?.employeeCode || 'EMP-001'}</td>
                        </tr>
                        <tr className="border-b border-slate-200 bg-slate-50/50">
                          <td className="p-2.5 font-semibold text-slate-600">कार्यक्षेत्र (Assigned Branch):</td>
                          <td className="p-2.5 font-bold text-slate-800">{currentBranch}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-semibold text-slate-600">सेवाको प्रकार (Type):</td>
                          <td className="p-2.5">{selectedEmployee?.employmentType === 'Permanent' ? 'स्थायी सेवा (Permanent)' : 'करार / परीक्षण सेवा (Probationary / Temporary)'}</td>
                        </tr>
                        <tr className="border-b border-slate-200 bg-slate-50/50">
                          <td className="p-2.5 font-semibold text-slate-600">सुरु पारिश्रमिक (Basic Salary):</td>
                          <td className="p-2.5 font-mono font-bold text-slate-900">रु. {selectedEmployee?.basicSalary?.toLocaleString() || '२५,०००'}/- (नियमानुसार थप भत्ता)</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-slate-600">परीक्षण काल (Probation):</td>
                          <td className="p-2.5">६ महिना (सन्तोषजनक कार्यसम्पादन पश्चात स्थायीकरण गरिनेछ)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p>
                    तपाईंले संस्थाको विधान, कर्मचारी नियमावली, आर्थिक कार्यविधि तथा सञ्चालक समिति र व्यवस्थापनले समय-समयमा दिएको नीति निर्देशनहरूको पूर्ण पालना गरी उच्च व्यावसायिक निष्ठाका साथ संस्थाको हितमा कार्य गर्नुहुनेछ भन्ने पूर्ण विश्वास लिइएको छ।
                  </p>
                  <p className="font-semibold text-slate-900">
                    तपाईंको सफल तथा उज्ज्वल कार्यकालको हार्दिक शुभकामना व्यक्त गर्दछौं।
                  </p>
                </div>

                {/* Signatures */}
                <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                  <div>
                    <div className="h-12 flex items-end justify-center mb-1">
                      {primarySignatorySignature ? (
                        <img 
                          src={primarySignatorySignature} 
                          alt="Primary Signature" 
                          className="max-h-12 max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : null}
                    </div>
                    <div className="w-36 border-b border-slate-400 mx-auto mb-1" />
                    <p className="font-bold text-slate-900">{primarySignatoryName}</p>
                    <p className="text-slate-600 text-[11px]">{primarySignatoryTitle}</p>
                  </div>
                  <div>
                    <div className="h-12 flex items-end justify-center mb-1">
                      {secondarySignatorySignature ? (
                        <img 
                          src={secondarySignatorySignature} 
                          alt="Secondary Signature" 
                          className="max-h-12 max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : null}
                    </div>
                    <div className="w-36 border-b border-slate-400 mx-auto mb-1" />
                    <p className="font-bold text-slate-900">{secondarySignatoryName}</p>
                    <p className="text-slate-600 text-[11px]">{secondarySignatoryTitle}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 2. TRANSFER LETTER (सरुवा पत्र)                             */}
            {/* ========================================================= */}
            {selectedDocType === 'transfer_letter' && (
              <div className="space-y-6 text-xs sm:text-sm leading-relaxed">
                {/* Official Letterhead Header */}
                <div className="border-b-2 border-[#064e3b] pb-4 pt-1 flex items-center justify-center gap-4 text-center w-full">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                    {settings?.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <RatauliOfficialEmblem className="w-full h-full" withoutCircle={true} />
                    )}
                  </div>
                  <div className="flex-1 max-w-[620px]">
                    <CooperativeHeaderBrand size="2xl" />
                  </div>
                </div>

                {/* Reference & Date Bar */}
                <div className="flex justify-between items-center text-[11px] text-slate-700 font-mono border-b border-slate-200 pb-2">
                  <span>{refNo}</span>
                  <span>मिति: <strong>{dispatchDateBs}</strong> ({dispatchDateAd})</span>
                </div>

                {/* Recipient Address */}
                <div className="space-y-0.5 pt-2">
                  <p className="font-bold">श्री <strong>{selectedEmployee?.fullNameNepali || selectedEmployee?.fullName}</strong></p>
                  <p className="text-slate-700">पद: <strong>{selectedEmployee?.designationNepali || selectedEmployee?.designation}</strong></p>
                  <p className="text-slate-600">हाल कार्यरत: <strong>{currentBranch}</strong></p>
                </div>

                {/* Subject Header */}
                <div className="text-center py-2">
                  <h3 className="text-base font-black text-[#064e3b] border-b-2 border-[#064e3b] inline-block pb-1 tracking-tight">
                    विषय: शाखा सरुवा सम्बन्धमा (Letter of Transfer)
                  </h3>
                </div>

                {/* Body Content */}
                <div className="space-y-3 text-justify text-slate-800 leading-relaxed font-sans">
                  <p>
                    महोदय,
                  </p>
                  <p>
                    यस संस्थाको कार्यसञ्चालनलाई थप प्रभावकारी, व्यवस्थित र सुदृढ बनाउन संस्थागत आवश्यकता अनुसार कर्मचारी सेवा नियमावलीको अधिकार प्रयोग गरी तपाईंलाई हाल कार्यरत <strong>{currentBranch}</strong> बाट <strong>{targetBranch}</strong> मा सोही पद तथा जिम्मेवारीमा मिति <strong>{transferEffectiveDate}</strong> देखि लागू हुने गरी सरुवा गरिएको व्यहोरा सूचित गरिन्छ।
                  </p>

                  <div className="p-3.5 bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl my-3 text-xs text-slate-800 space-y-1.5">
                    <p className="font-bold text-amber-950">
                      निर्देशन तथा बुझबुझारथ व्यहोरा:
                    </p>
                    <p>
                      {transferRemarks}
                    </p>
                    <p className="text-[11px] text-slate-600 font-mono pt-1">
                      सरुवा लागु मिति: <strong>{transferEffectiveDate}</strong> | हाजिर हुनुपर्ने कार्यालय: <strong>{targetBranch}</strong>
                    </p>
                  </div>

                  <p>
                    नयाँ शाखामा पनि तपाईंले पूर्ववत् लगनशीलता, इमानदारी र उच्च अनुशासनका साथ संस्थाको सदस्य सेवा र व्यवसाय अभिवृद्धिमा महत्त्वपूर्ण योगदान पुर्‍याउनुहुनेछ भन्ने संस्थाले अपेक्षा लिएको छ।
                  </p>
                  <p className="font-semibold text-slate-900">
                    तपाईंको नयाँ कार्यक्षेत्रमा सफलताको कामना गर्दछौं।
                  </p>
                </div>

                {/* Carbon Copy */}
                <div className="text-[11px] text-slate-600 pt-3 border-t border-slate-200">
                  <p className="font-bold text-slate-700">बोधार्थ (CC):</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-2 mt-1">
                    <li>श्री शाखा प्रमुख, {currentBranch} (आवश्यक बुझबुझारथ कार्य सम्पन्न गर्न)</li>
                    <li>श्री शाखा प्रमुख, {targetBranch} (नयाँ हाजिरी तथा कार्य विभाजनको लागि)</li>
                    <li>मानव संसाधन तथा प्रशासन शाखा, केन्द्रीय कार्यालय (व्यक्तिगत फाइलको लागि)</li>
                  </ul>
                </div>

                {/* Signatures */}
                <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                  <div>
                    <div className="h-12 flex items-end justify-center mb-1">
                      {primarySignatorySignature ? (
                        <img 
                          src={primarySignatorySignature} 
                          alt="Primary Signature" 
                          className="max-h-12 max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : null}
                    </div>
                    <div className="w-36 border-b border-slate-400 mx-auto mb-1" />
                    <p className="font-bold text-slate-900">{primarySignatoryName}</p>
                    <p className="text-slate-600 text-[11px]">{primarySignatoryTitle}</p>
                  </div>
                  <div>
                    <div className="h-12 flex items-end justify-center mb-1">
                      {secondarySignatorySignature ? (
                        <img 
                          src={secondarySignatorySignature} 
                          alt="Secondary Signature" 
                          className="max-h-12 max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : null}
                    </div>
                    <div className="w-36 border-b border-slate-400 mx-auto mb-1" />
                    <p className="font-bold text-slate-900">{secondarySignatoryName}</p>
                    <p className="text-slate-600 text-[11px]">{secondarySignatoryTitle}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 3. OFFICIAL EMPLOYEE ID CARD (कर्मचारी परिचयपत्र)          */}
            {/* ========================================================= */}
            {selectedDocType === 'id_card' && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider">
                    Official Employee Identity Card (CR80 Standard • Front & Back)
                  </h3>
                  <p className="text-xs text-slate-500">
                    High-resolution printable staff identity card matching institutional corporate colors.
                  </p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadJpg('emp-id-card-front-canvas', `${(selectedEmployee?.fullName || 'Employee').replace(/\s+/g, '_')}_ID_Front`)}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileDown size={13} className="text-amber-400" />
                    <span>Front JPG Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadJpg('emp-id-card-back-canvas', `${(selectedEmployee?.fullName || 'Employee').replace(/\s+/g, '_')}_ID_Back`)}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileDown size={13} className="text-amber-400" />
                    <span>Back JPG Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyImage('emp-id-card-front-canvas', 'Employee ID Front')}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
                  >
                    <Copy size={13} className="text-[#047857]" />
                    <span>Copy Front Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyImage('emp-id-card-back-canvas', 'Employee ID Back')}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
                  >
                    <Copy size={13} className="text-[#047857]" />
                    <span>Copy Back Image</span>
                  </button>
                </div>

                {/* Cards Container */}
                <div className="flex flex-wrap items-center justify-center gap-6">
                  
                  {/* FRONT SIDE */}
                  <div 
                    id="emp-id-card-front-canvas"
                    className="w-[320px] h-[490px] bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-[#064e3b] flex flex-col justify-between relative"
                  >
                    {/* Header Strip with Single-Line Institution Titles */}
                    <div className="bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#064e3b] text-white p-3 text-center relative overflow-hidden border-b-2 border-amber-400 shadow-xs">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400" />
                      
                      <div className="flex items-center justify-center space-x-2.5 mb-1">
                        <div className="w-10 h-10 rounded-full bg-white p-0.5 shadow-sm border border-amber-400 shrink-0 flex items-center justify-center">
                          {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <RatauliOfficialEmblem className="w-full h-full" withoutCircle={false} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-[#fef08a] font-black text-[11px] leading-tight block whitespace-nowrap tracking-tight font-sans drop-shadow-xs">
                            रतौली बचत तथा ऋण सहकारी संस्था लि.
                          </span>
                          <span className="text-white font-black text-[8px] leading-tight block whitespace-nowrap tracking-wide uppercase opacity-95 font-sans">
                            RATAULI SAVING & CREDIT CO-OPERATIVE LTD.
                          </span>
                        </div>
                      </div>
                      <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-[#064e3b] px-3.5 py-0.5 rounded-full font-black text-[8.5px] uppercase tracking-wider inline-block shadow-xs border border-amber-200 mt-0.5">
                        OFFICIAL STAFF IDENTITY CARD
                      </span>
                    </div>

                    {/* Employee Photo & Identification */}
                    <div className="flex flex-col items-center pt-2 px-4">
                      <div className="w-24 h-28 rounded-xl border-2 border-amber-400 p-0.5 bg-gradient-to-b from-amber-100 to-emerald-50 shadow-md overflow-hidden mb-1.5">
                        {selectedEmployee?.photoUrl ? (
                          <img src={selectedEmployee.photoUrl} alt={selectedEmployee.fullName} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <User size={36} />
                          </div>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-slate-950 text-center tracking-tight leading-tight uppercase font-sans">
                        {selectedEmployee?.fullName || 'EMPLOYEE FULL NAME'}
                      </h3>
                      <span className="text-xs font-black text-amber-200 bg-[#064e3b] border border-amber-400/80 px-3.5 py-0.5 rounded-full mt-1 text-center inline-block shadow-2xs">
                        {selectedEmployee?.designation || 'STAFF OFFICER'}
                      </span>
                      <span className="text-[10px] font-bold text-amber-800 text-center mt-0.5">
                        {selectedEmployee?.department || 'Operations Dept'} • {currentBranch}
                      </span>
                    </div>

                    {/* Key Attributes Grid */}
                    <div className="mx-3 px-3 py-2 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 rounded-xl border border-emerald-200/90 space-y-1 text-[10.5px] shadow-2xs">
                      <div className="flex justify-between items-center py-0.5 border-b border-emerald-100">
                        <span className="text-slate-500 font-semibold">Employee ID:</span>
                        <strong className="font-mono text-[#064e3b] font-bold">{selectedEmployee?.employeeCode || 'EMP-001'}</strong>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-emerald-100">
                        <span className="text-slate-500 font-semibold">Citizenship No:</span>
                        <strong className="font-mono text-slate-900 font-bold">{selectedEmployee?.citizenshipNo || '17-01-75-09876'}</strong>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-emerald-100">
                        <span className="text-slate-500 font-semibold">Blood Group:</span>
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.2 rounded font-black text-[9px]">
                          {selectedEmployee?.bloodGroup || 'O+ve'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 font-semibold">Joined Date:</span>
                        <strong className="text-[#064e3b] font-bold">{selectedEmployee?.joinedDate || '2080-04-01'}</strong>
                      </div>
                    </div>

                    {/* Bottom Bar with Barcode & Sign */}
                    <div>
                      <div className="bg-slate-50 px-4 py-1.5 flex items-center justify-between border-t border-slate-200">
                        <div className="text-left">
                          <span className="text-[7.5px] text-slate-400 block font-mono font-bold">STAFF VERIFICATION BARCODE</span>
                          <div className="h-5 flex items-center space-x-0.5">
                            {[2,1,3,1,2,1,1,3,2,1,2,3,1,2,1,2].map((w, idx) => (
                              <span key={idx} style={{ width: `${w}px` }} className="h-3.5 bg-slate-800 inline-block" />
                            ))}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="h-6 flex items-end justify-center mb-0.5">
                            {(idCardSignatorySignature || primarySignatorySignature) ? (
                              <img 
                                src={idCardSignatorySignature || primarySignatorySignature!} 
                                alt="Signature" 
                                className="h-6 max-w-[65px] object-contain ml-auto filter contrast-125"
                              />
                            ) : (
                              <div className="w-16 border-b border-slate-400 mb-0.5" />
                            )}
                          </div>
                          <div className="border-b border-slate-300 w-16 mb-0.5 ml-auto" />
                          <span className="text-[7.5px] font-bold text-slate-600 block">{idCardSignatoryTitle || 'General Manager'}</span>
                        </div>
                      </div>
                      <div className="bg-[#064e3b] text-amber-300 py-1 text-[8px] font-mono font-bold tracking-widest text-center border-t border-amber-400/50">
                        RSCCL • OFFICIAL EMPLOYEE IDENTITY
                      </div>
                    </div>
                  </div>

                  {/* BACK SIDE */}
                  <div 
                    id="emp-id-card-back-canvas"
                    className="w-[320px] h-[490px] bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-[#064e3b] flex flex-col justify-between relative text-center"
                  >
                    {/* Top Header Strip */}
                    <div className="bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#064e3b] text-white py-2 px-3 flex justify-between items-center text-[9.5px] font-black uppercase tracking-wider border-b-2 border-amber-400 shadow-xs">
                      <span>STAFF TERMS & DIGITAL VERIFICATION</span>
                      <span className="text-amber-300">REGD: 421/054/055</span>
                    </div>
                    
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      {/* Governance Rules */}
                      <div className="space-y-1 text-left bg-emerald-50/50 p-2 rounded-xl border border-emerald-200/80 text-[8.5px] text-slate-700 leading-tight">
                        <p className="flex items-start space-x-1">
                          <span className="text-[#047857] font-bold shrink-0">1.</span>
                          <span>This card is the official property of RSCCL and certifies bona fide staff employment.</span>
                        </p>
                        <p className="flex items-start space-x-1">
                          <span className="text-[#047857] font-bold shrink-0">2.</span>
                          <span>The bearer is authorized to execute institutional financial and administrative duties.</span>
                        </p>
                        <p className="flex items-start space-x-1">
                          <span className="text-[#047857] font-bold shrink-0">3.</span>
                          <span>If found, please return to Head Office, Pipara-6, Mahottari or handover to management.</span>
                        </p>
                      </div>

                      {/* Emergency Contact */}
                      <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200 text-left text-[10px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-semibold">Staff Mobile:</span>
                          <strong className="font-mono text-slate-900">{selectedEmployee?.mobile || '+977-9844000000'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-semibold">Emergency Contact:</span>
                          <strong className="font-mono text-slate-900">{selectedEmployee?.emergencyPhone || selectedEmployee?.mobile || '+977-9844012345'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-semibold">Permanent Address:</span>
                          <strong className="text-slate-900 truncate max-w-[150px]">
                            {selectedEmployee?.permanentAddress || 'Pipara-6, Mahottari, Nepal'}
                          </strong>
                        </div>
                      </div>

                      {/* Upgraded High-Tech Real Scannable QR Code */}
                      <div className="p-2.5 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 border-2 border-emerald-600/80 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                        <OfficialSecurityQrCode 
                          memberCode={selectedEmployee?.employeeCode || 'EMP-001'} 
                          memberName={selectedEmployee?.fullName}
                          designation={selectedEmployee?.designation}
                          size={82} 
                        />

                        <div className="text-left text-[8px] text-slate-600 space-y-0.5 leading-tight flex-1">
                          <strong className="text-[#064e3b] block text-[9.5px] font-black uppercase tracking-wider">
                            Head Office Contacts
                          </strong>
                          <span>Pipara Rural Municipality-6, Mahottari</span>
                          <span className="block font-mono text-slate-800">Tel: +977-44-520123</span>
                          <span className="block text-[#047857] font-bold">hr@ratauli.org.np</span>
                          <span className="block text-[#047857] font-bold">www.ratauli.org.np</span>
                          <span className="block text-[7.5px] text-slate-500 italic mt-0.5">
                            Scan QR with camera for instant employee credential verification.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Accreditation Strip */}
                    <div className="bg-[#064e3b] text-amber-300 py-1.5 text-[8px] font-bold tracking-wider uppercase text-center border-t border-amber-400">
                      Official Property of Ratauli Saving & Credit Co-operative Ltd.
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 4. EXECUTIVE VISITING CARD (भिजिटिङ कार्ड)                 */}
            {/* ========================================================= */}
            {selectedDocType === 'visiting_card' && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider">
                    Executive Employee Visiting Card (Front & Back Layout)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official business stationery for institutional officers and staff with single-line headers.
                  </p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadJpg('emp-visiting-card-front-canvas', `${(selectedEmployee?.fullName || 'Employee').replace(/\s+/g, '_')}_Visiting_Front`)}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileDown size={13} className="text-amber-400" />
                    <span>Front JPG Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadJpg('emp-visiting-card-back-canvas', `${(selectedEmployee?.fullName || 'Employee').replace(/\s+/g, '_')}_Visiting_Back`)}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileDown size={13} className="text-amber-400" />
                    <span>Back JPG Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyImage('emp-visiting-card-front-canvas', 'Visiting Card Front')}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
                  >
                    <Copy size={13} className="text-[#047857]" />
                    <span>Copy Front Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyImage('emp-visiting-card-back-canvas', 'Visiting Card Back')}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
                  >
                    <Copy size={13} className="text-[#047857]" />
                    <span>Copy Back Image</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6">
                  
                  {/* FRONT SIDE (3.5" x 2" standard proportions) */}
                  <div 
                    id="emp-visiting-card-front-canvas"
                    className={`w-[360px] h-[210px] rounded-xl shadow-2xl p-4 flex flex-col justify-between relative overflow-hidden text-slate-900 border-2 ${
                      visitingCardTheme === 'emerald'
                        ? 'bg-white border-[#064e3b]'
                        : visitingCardTheme === 'navy'
                        ? 'bg-white border-indigo-900'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {/* Top Accent Stripe matching logo colors */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#064e3b] via-amber-400 to-[#064e3b] border-b border-amber-400/70" />

                    {/* Header */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                          {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <RatauliOfficialEmblem className="w-full h-full" withoutCircle={true} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left pr-1">
                          <span className="text-[#064e3b] font-black text-[10.5px] leading-tight block whitespace-nowrap tracking-tight font-sans">
                            रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                          </span>
                          <span className="text-[#dc2626] font-extrabold text-[7.5px] leading-tight block whitespace-nowrap tracking-tight uppercase font-sans">
                            RATAULI SAVING & CREDIT CO-OPERATIVE LIMITED
                          </span>
                        </div>
                      </div>

                      <span className="bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold shadow-2xs shrink-0 whitespace-nowrap">
                        ESTD. 2062
                      </span>
                    </div>

                    {/* Member Name and Designation */}
                    <div className="py-0.5">
                      <h3 className="text-base font-black tracking-tight leading-tight text-slate-950 uppercase font-sans">
                        {selectedEmployee?.fullName || 'STAFF FULL NAME'}
                      </h3>
                      <span className="text-xs font-black text-amber-200 bg-[#064e3b] border border-amber-400/80 px-3 py-0.5 rounded-full inline-block mt-0.5 tracking-wide shadow-2xs">
                        {selectedEmployee?.designation || 'EMPLOYEE POSITION'}
                      </span>
                      <span className="text-[9.5px] font-bold text-amber-800 block mt-0.5">
                        {selectedEmployee?.department || 'Operations Dept'} • {currentBranch}
                      </span>
                    </div>

                    {/* Contacts Footer */}
                    <div className="pt-1.5 border-t border-emerald-100 text-[8.5px] grid grid-cols-2 gap-1 text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <Phone size={11} className="text-[#047857] shrink-0" />
                        <span className="font-mono text-slate-900 font-semibold">{selectedEmployee?.mobile || '+977-9844000000'}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Mail size={11} className="text-[#047857] shrink-0" />
                        <span className="truncate text-slate-900">{selectedEmployee?.email || 'staff@ratauli.org.np'}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <MapPin size={11} className="text-[#047857] shrink-0" />
                        <span className="truncate text-slate-900">{currentBranch}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Globe size={11} className="text-[#047857] shrink-0" />
                        <span className="text-slate-900 font-medium">www.ratauli.org.np</span>
                      </div>
                    </div>
                  </div>

                  {/* BACK SIDE - White Background matching Front with Exquisite Cooperative Design */}
                  <div 
                    id="emp-visiting-card-back-canvas"
                    className={`w-[360px] h-[210px] rounded-xl shadow-2xl p-3.5 flex flex-col justify-between items-center text-center relative overflow-hidden bg-white border-2 ${
                      visitingCardTheme === 'emerald'
                        ? 'border-[#064e3b]'
                        : visitingCardTheme === 'navy'
                        ? 'border-indigo-900'
                        : 'border-slate-300'
                    }`}
                  >
                    {/* Top Accent Stripe matching front side */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#064e3b] via-amber-400 to-[#064e3b] border-b border-amber-400/70" />

                    {/* Bottom Accent Line */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#064e3b] via-amber-400 to-[#064e3b]" />

                    {/* Subtle Centered Background Watermark for Premium Look */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none">
                      <RatauliOfficialEmblem className="w-52 h-52" withoutCircle={true} />
                    </div>

                    {/* Center Emblem without outer circle ring */}
                    <div className="w-16 h-16 flex items-center justify-center mt-1 drop-shadow-sm relative z-10 shrink-0">
                      <img 
                        src={(settings?.logoUrl && !settings.logoUrl.includes('picsum.photos')) ? settings.logoUrl : '/system_logo.png'} 
                        alt="Logo" 
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.includes('system_logo.png')) {
                            target.src = '/system_logo.png';
                          }
                        }}
                        className="w-full h-full object-contain" 
                      />
                    </div>

                    {/* Institution Name & Motto */}
                    <div className="w-full px-2 relative z-10 flex flex-col items-center">
                      <span className="text-[#064e3b] font-black text-[12.5px] leading-tight block tracking-tight font-sans whitespace-nowrap">
                        रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                      </span>
                      <span className="text-[#dc2626] font-extrabold text-[8.5px] leading-tight block tracking-wider uppercase font-sans mt-0.5 whitespace-nowrap">
                        Ratauli Saving & Credit Co-operative Limited
                      </span>
                      <div className="inline-flex items-center space-x-1.5 bg-amber-50 border border-amber-300/80 px-2.5 py-0.5 rounded-full mt-1 shadow-2xs">
                        <span className="text-[7.5px] font-bold text-amber-950 font-sans tracking-wide">
                          “Poverty Alleviation Through Trusted Financial Inclusivity”
                        </span>
                      </div>
                    </div>

                    {/* Statutory Registration & Address Footer */}
                    <div className="pt-1.5 pb-0.5 border-t border-emerald-100/90 w-full font-sans relative z-10 text-slate-600">
                      <div className="text-[7.5px] font-semibold text-slate-800 tracking-wide">
                        दर्ता नं. ४२१/०५४/०५५ • पान नं. ३०२४८८८२५
                      </div>
                      <div className="text-[7.5px] text-slate-600 mt-0.5">
                        केन्द्रीय कार्यालय: पिपरा गाउँपालिका-६, महोत्तरी, मधेश प्रदेश, नेपाल
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 5. PROMOTION & RE-APPOINTMENT ORDER (पदोन्नति पत्र)        */}
            {/* ========================================================= */}
            {selectedDocType === 'promotion_letter' && (
              <div className="space-y-6 text-xs sm:text-sm leading-relaxed">
                {/* Official Letterhead Header */}
                <div className="border-b-2 border-[#064e3b] pb-4 pt-1 flex items-center justify-center gap-4 text-center w-full">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                    <img 
                      src={(settings?.logoUrl && !settings.logoUrl.includes('picsum.photos')) ? settings.logoUrl : '/system_logo.png'} 
                      alt="Logo" 
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.includes('system_logo.png')) {
                          target.src = '/system_logo.png';
                        }
                      }}
                      className="w-full h-full object-contain" 
                    />
                  </div>
                  <div className="flex-1 max-w-[620px]">
                    <CooperativeHeaderBrand size="2xl" />
                  </div>
                </div>

                {/* Reference & Date Bar */}
                <div className="flex justify-between items-center text-[11px] text-slate-700 font-mono border-b border-slate-200 pb-2">
                  <span>{refNo}</span>
                  <span>मिति: <strong>{dispatchDateBs}</strong> ({dispatchDateAd})</span>
                </div>

                {/* Recipient */}
                <div className="space-y-0.5 pt-2">
                  <p className="font-bold">श्री <strong>{selectedEmployee?.fullNameNepali || selectedEmployee?.fullName}</strong></p>
                  <p className="text-slate-700">हालको पद: <strong>{selectedEmployee?.designationNepali || selectedEmployee?.designation}</strong></p>
                  <p className="text-slate-600">कार्यरत शाखा: <strong>{currentBranch}</strong></p>
                </div>

                {/* Subject Header */}
                <div className="text-center py-2">
                  <h3 className="text-base font-black text-[#064e3b] border-b-2 border-[#064e3b] inline-block pb-1 tracking-tight">
                    विषय: पदोन्नति तथा जिम्मेवारी थप सम्बन्धमा (Letter of Promotion)
                  </h3>
                </div>

                {/* Body Content */}
                <div className="space-y-3 text-justify text-slate-800 leading-relaxed font-sans">
                  <p>
                    महोदय,
                  </p>
                  <p>
                    यस संस्थामा तपाईंले पुर्‍याउनु भएको निष्ठावान सेवा, उत्कृष्ट कार्यसम्पादन तथा लगनशीलताको उच्च मूल्याङ्कन गर्दै कर्मचारी नियमावली तथा पदपूर्ति समितिको निर्णय अनुसार तपाईंलाई मिति <strong>{promotionEffectiveDate}</strong> देखि लागू हुने गरी <strong>{promotedDesignation}</strong> पदमा पदोन्नति (Promotion) सहित पदस्थापन गरिएको व्यहोरा सहर्ष जानकारी गराइन्छ।
                  </p>

                  {/* Revised Scale Box */}
                  <div className="border border-teal-300 bg-teal-50/40 rounded-xl p-3.5 space-y-2 text-xs">
                    <p className="font-bold text-teal-950">
                      संशोधित सेवा सुविधा तथा जिम्मेवारी विवरण:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-500 block">पदोन्नत पद:</span>
                        <strong className="text-[#064e3b] text-sm block">{promotedDesignation}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">लागु हुने मिति:</span>
                        <strong className="text-slate-900 block font-mono">{promotionEffectiveDate}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">संशोधित सुरु तलब:</span>
                        <strong className="text-slate-900 block font-mono">रु. {revisedBasicSalary}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">कार्यक्षेत्र तथा शाखा:</span>
                        <strong className="text-slate-900 block">{currentBranch}</strong>
                      </div>
                    </div>
                  </div>

                  <p>
                    यस पदोन्नतिसँगै तपाईंको जिम्मेवारीमा भएको वृद्धिलाई आत्मसात गर्दै संस्थाको नीति, नियम र उद्देश्य प्राप्तिका निम्ति पूर्ववत् भन्दा अझ बढी सक्रिय, निष्ठावान र समर्पित भई कार्यसम्पादन गर्नुहुनेछ भन्ने संस्थाको दृढ विश्वास छ।
                  </p>
                  <p className="font-semibold text-slate-900">
                    यस गरिमामय पदोन्नतिको सुखद अवसरमा तपाईंलाई हार्दिक बधाई तथा सफल कार्यकालको शुभकामना व्यक्त गर्दछौं।
                  </p>
                </div>

                {/* Signatures */}
                <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                  <div>
                    <div className="h-12 flex items-end justify-center mb-1">
                      {primarySignatorySignature ? (
                        <img 
                          src={primarySignatorySignature} 
                          alt="Primary Signature" 
                          className="max-h-12 max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : null}
                    </div>
                    <div className="w-36 border-b border-slate-400 mx-auto mb-1" />
                    <p className="font-bold text-slate-900">{primarySignatoryName}</p>
                    <p className="text-slate-600 text-[11px]">{primarySignatoryTitle}</p>
                  </div>
                  <div>
                    <div className="h-12 flex items-end justify-center mb-1">
                      {secondarySignatorySignature ? (
                        <img 
                          src={secondarySignatorySignature} 
                          alt="Secondary Signature" 
                          className="max-h-12 max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : null}
                    </div>
                    <div className="w-36 border-b border-slate-400 mx-auto mb-1" />
                    <p className="font-bold text-slate-900">{secondarySignatoryName}</p>
                    <p className="text-slate-600 text-[11px]">{secondarySignatoryTitle}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 6. LETTER OF APPRECIATION (प्रशंसा पत्र)                    */}
            {/* ========================================================= */}
            {selectedDocType === 'appreciation_letter' && (
              <div className="p-8 sm:p-12 relative overflow-hidden bg-gradient-to-br from-amber-50/40 via-white to-emerald-50/30 border-8 border-double border-amber-600/70 rounded-3xl shadow-2xl text-center space-y-4">
                
                {/* Decorative Guilloche Border Rim */}
                <div className="absolute inset-2 border-2 border-dashed border-amber-500/50 rounded-2xl pointer-events-none" />

                {/* Top Reference & Date Bar */}
                <div className="flex justify-between items-center text-[10.5px] text-slate-700 font-mono border-b border-amber-200/80 pb-2">
                  <span>Regd No: <strong>{registrationNo}</strong> | Pan: <strong>{panNo}</strong></span>
                  <span>Ref No: {refNo} | Date: {dispatchDateBs}</span>
                </div>

                {/* Institution Header with Full Official Logo */}
                <div className="flex items-center justify-center gap-4 py-1 w-full">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                    {settings?.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <RatauliOfficialEmblem className="w-full h-full" withoutCircle={false} />
                    )}
                  </div>
                  <div className="flex-1 max-w-[620px]">
                    <CooperativeHeaderBrand size="2xl" />
                  </div>
                </div>

                {/* Certificate Ribbon Title */}
                <div className="py-2">
                  <span className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-emerald-950 font-black text-xs sm:text-sm px-6 py-1.5 rounded-full uppercase tracking-widest inline-block shadow-md border-2 border-amber-200">
                    CERTIFICATE OF COMMENDATION • सम्मान तथा प्रशंसा पत्र
                  </span>
                </div>

                {/* Presentation Line */}
                <p className="text-xs sm:text-sm text-slate-600 italic font-serif">
                  यो सम्मान तथा प्रशंसा पत्र सहर्ष प्रदान गरिएको छ:
                </p>

                {/* Recipient Full Name in Bold Gold-Amber */}
                <div className="py-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-[#064e3b] tracking-tight uppercase border-b-2 border-amber-400 inline-block pb-1 font-serif">
                    {selectedEmployee?.fullNameNepali || selectedEmployee?.fullName}
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-amber-800 mt-1">
                    {selectedEmployee?.designationNepali || selectedEmployee?.designation} • {currentBranch}
                  </p>
                </div>

                {/* Commendation Body Text */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-[700px] mx-auto font-sans text-justify">
                  तपाईंले यस <strong>रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड</strong>मा सेवामा समर्पित रहँदा आफ्नो पदिय मर्यादा अनुसार उच्च व्यावसायिक निष्ठा, इमानदारी, लगनशीलता र अथक परिश्रमका साथ संस्थाको समृद्धि, वित्तीय अनुशासन तथा सदस्यहरूको सर्वतोमुखी हितमा पुर्‍याउनु भएको अतुलनीय योगदानको उच्च कदर गर्दै यो <strong>प्रशंसा पत्र (Letter of Appreciation)</strong> सहर्ष प्रदान गरिएको छ।
                </p>

                <p className="text-xs text-slate-600 italic">
                  संस्थाको श्रीवृद्धिमा तपाईंको यस्तै निष्ठावान सहभागिता र प्रेरणादायी कार्यसम्पादन सदैव निरन्तर रहिरहनेछ भन्ने पूर्ण विश्वास लिइएको छ।
                </p>

                {/* Dual Signatures */}
                <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
                  <div>
                    <div className="h-14 flex items-end justify-center mb-1">
                      {primarySignatorySignature ? (
                        <img 
                          src={primarySignatorySignature} 
                          alt="Primary Signature" 
                          className="max-h-14 max-w-[160px] object-contain filter contrast-125" 
                        />
                      ) : null}
                    </div>
                    <div className="w-40 border-b border-amber-700 mx-auto mb-1" />
                    <p className="font-bold text-slate-900">{primarySignatoryName}</p>
                    <p className="text-slate-600 text-[11px]">{primarySignatoryTitle}</p>
                  </div>
                  <div>
                    <div className="h-14 flex items-end justify-center mb-1">
                      {secondarySignatorySignature ? (
                        <img 
                          src={secondarySignatorySignature} 
                          alt="Secondary Signature" 
                          className="max-h-14 max-w-[160px] object-contain filter contrast-125" 
                        />
                      ) : null}
                    </div>
                    <div className="w-40 border-b border-amber-700 mx-auto mb-1" />
                    <p className="font-bold text-slate-900">{secondarySignatoryName}</p>
                    <p className="text-slate-600 text-[11px]">{secondarySignatoryTitle}</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Toast Notification Banner for Copy / Download */}
      {copySuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500 flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span className="text-xs font-bold">{copySuccessMsg}</span>
        </div>
      )}

    </div>
  );
};
