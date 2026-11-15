import React, { useMemo } from 'react';
import { 
  Eye, Edit2, Printer, X, User as UserIcon, CheckCircle2, 
  FileText, ShieldCheck, Download, Calendar, MapPin, Briefcase, 
  Phone, Mail, Landmark, CreditCard, Award, HeartHandshake, FileCheck
} from 'lucide-react';
import { Employee, SystemSettings, Branch } from '../types';
import { useDayEndLock, getDayEndedBlockMessage } from '../utils/dayEndLock';

export const calculateRetirementInfo = (dobBsStr?: string, joinedDateStr?: string) => {
  const parseBs = (str?: string) => {
    if (!str) return null;
    const parts = str.trim().replace(/-/g, '/').split('/');
    if (parts.length >= 1 && !isNaN(Number(parts[0])) && Number(parts[0]) > 1900) {
      const year = Number(parts[0]);
      const month = parts[1] ? Number(parts[1]) : 1;
      const day = parts[2] ? Number(parts[2]) : 1;
      return { year, month, day };
    }
    return null;
  };

  const dob = parseBs(dobBsStr);
  const joined = parseBs(joinedDateStr);

  let retByAge: string | null = null;
  if (dob) {
    const y = dob.year + 58;
    const m = String(dob.month).padStart(2, '0');
    const d = String(dob.day).padStart(2, '0');
    retByAge = `${y}-${m}-${d}`;
  }

  let retByService: string | null = null;
  if (joined) {
    const y = joined.year + 30;
    const m = String(joined.month).padStart(2, '0');
    const d = String(joined.day).padStart(2, '0');
    retByService = `${y}-${m}-${d}`;
  }

  let finalRetDate: string | null = null;
  let retirementBasis: 'service' | 'age' | null = null;

  if (retByAge && retByService) {
    if (retByAge <= retByService) {
      finalRetDate = retByAge;
      retirementBasis = 'age';
    } else {
      finalRetDate = retByService;
      retirementBasis = 'service';
    }
  } else if (retByAge) {
    finalRetDate = retByAge;
    retirementBasis = 'age';
  } else if (retByService) {
    finalRetDate = retByService;
    retirementBasis = 'service';
  }

  return { finalRetDate, retirementBasis, retByAge, retByService };
};

interface EmployeeKYCModalProps {
  employee: Employee;
  onClose: () => void;
  onEdit?: (emp: Employee) => void;
  settings?: SystemSettings | null;
  branches?: Branch[];
}

export const EmployeeKYCModal: React.FC<EmployeeKYCModalProps> = ({
  employee,
  onClose,
  onEdit,
  settings,
  branches = []
}) => {
  const isDayEnded = useDayEndLock(employee.branchId);

  const branchName = useMemo(() => {
    if (!employee.branchId) return 'मुख्य कार्यालय (Head Office)';
    const found = branches.find((b: any) => b.id === employee.branchId);
    return found ? found.name : 'मुख्य कार्यालय';
  }, [employee, branches]);

  const retirement = useMemo(() => {
    return calculateRetirementInfo(employee.dobBs, employee.joinedDate);
  }, [employee.dobBs, employee.joinedDate]);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[7000] flex items-start justify-center pt-4 sm:pt-8 p-2 sm:p-4 overflow-y-auto no-print animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col my-auto sm:my-0 animate-in zoom-in-95 duration-150">
        
        {/* Top Action Bar */}
        <div className="py-2.5 px-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 text-white shrink-0 no-print">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
              <FileCheck size={16}/>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white">
                EMPLOYEE FULL PROFILE & KYC DOCUMENT (PDF)
              </h3>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button 
                onClick={() => !isDayEnded && onEdit(employee)} 
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Profile'}
                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Edit2 size={15} />
              </button>
            )}
            <button 
              onClick={() => window.print()} 
              title="Print / Save PDF"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-xs transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer size={15} />
              <span>PRINT / PDF</span>
            </button>
            <button 
              onClick={onClose} 
              title="Close"
              className="p-1.5 bg-slate-800 hover:bg-rose-600 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X size={17}/>
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="overflow-y-auto p-4 sm:p-6 md:p-8 bg-white text-slate-900 print:p-0 print:overflow-visible text-xs">
          
          {/* Header Section (Cooperative Logo & Details) */}
          <div className="relative border-b-2 border-slate-900 pb-3 mb-5 flex items-center justify-center min-h-[70px] px-12 text-center">
            <div className="absolute left-0 top-1/2 -translate-y-1/2">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} className="w-14 h-14 object-contain" alt="Coop Logo" />
              ) : (
                <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-xs">
                  Coop
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                {settings?.systemName || 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड'}
              </h1>
              <p className="text-[11px] font-bold text-slate-600">
                {settings?.address || 'पिपरा गाउँपालिका-६, महोत्तरी'}
              </p>
              <span className="inline-block text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 border border-emerald-300 px-3 py-0.5 rounded-full mt-1">
                कर्मचारी व्यक्तिगत तथा ग्राहक पहिचान फारम (EMPLOYEE KYC FORM)
              </span>
            </div>
          </div>

          {/* Employee Hero Profile Box */}
          <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center md:items-start gap-4 mb-5">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center border border-slate-300">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} className="w-full h-full object-cover" alt={employee.fullName} />
              ) : (
                <UserIcon size={44} className="text-slate-400" />
              )}
            </div>

            <div className="flex-1 w-full space-y-1.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-1.5">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-baseline gap-2 flex-wrap">
                    <span>{employee.fullName}</span>
                    {employee.fullNameNepali && <span className="text-xs font-bold text-slate-600">({employee.fullNameNepali})</span>}
                  </h2>
                  {employee.previousName && (
                    <p className="text-[10px] font-bold text-slate-500">
                      पहिलेको नाम (Previous): {employee.previousName} {employee.previousNameNepali ? `(${employee.previousNameNepali})` : ''}
                    </p>
                  )}
                  <p className="text-[11px] font-black text-emerald-800 uppercase tracking-wide mt-0.5">
                    {employee.designation || 'STAFF'} • {employee.department || 'GENERAL DEPARTMENT'}
                  </p>
                </div>
                <div className="mt-1 md:mt-0">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${employee.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                    {employee.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-500 text-[9px] font-bold block uppercase">कर्मचारी कोड (ID Code)</span>
                  <span className="font-mono font-bold text-slate-900">{employee.employeeCode || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] font-bold block uppercase">शाखा (Branch)</span>
                  <span className="font-bold text-slate-900">{branchName}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] font-bold block uppercase">मोबाइल नम्बर (Mobile)</span>
                  <span className="font-bold text-slate-900">{employee.mobile || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] font-bold block uppercase">ईमेल (Email)</span>
                  <span className="font-bold text-slate-900">{employee.email || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: General & Personal Info */}
          <div className="mb-5">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-2">
              १. सामान्य तथा व्यक्तिगत विवरण (Personal & Service Details)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">लिंग (Gender)</span>
                <span className="font-bold text-slate-900">{employee.gender || 'Male'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">जन्म मिति (Date of Birth)</span>
                <span className="font-bold text-slate-900">{employee.dobBs || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">राष्ट्रियता (Nationality)</span>
                <span className="font-bold text-slate-900">{employee.nationality || 'नेपाली'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">वैवाहिक स्थिति (Marital Status)</span>
                <span className="font-bold text-slate-900">{employee.maritalStatus === 'Couple' ? 'Married (विवाहित)' : 'Single (अविवाहित)'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">सेवाको प्रकार (Employment Type)</span>
                <span className="font-bold text-slate-900">{employee.employmentType || 'Permanent'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">प्रवेश मिति (Joined Date)</span>
                <span className="font-bold text-slate-900">{employee.joinedDate || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">स्थायी लेखा नम्बर (PAN No)</span>
                <span className="font-mono font-bold text-slate-900">{employee.panNo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">रक्त समूह (Blood Group)</span>
                <span className="font-bold text-slate-900">{employee.bloodGroup || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">अनिवार्य अवकाश मिति (Retirement BS)</span>
                <span className="font-mono font-black text-emerald-800">
                  {retirement.finalRetDate || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: KYC & Family Details */}
          <div className="mb-5">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-2">
              २. ग्राहक पहिचान तथा पारिवारिक विवरण (KYC & Family Details)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">नागरिकता नं (Citizenship No)</span>
                <span className="font-mono font-bold text-slate-900">{employee.citizenshipNo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">जारी जिल्ला (Issue District)</span>
                <span className="font-bold text-slate-900">{employee.citizenshipDistrict || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">जारी मिति (Issue Date)</span>
                <span className="font-bold text-slate-900">{employee.citizenshipIssueDate || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">पति/पत्नीको नाम (Spouse Name)</span>
                <span className="font-bold text-slate-900">
                  {employee.spouseName || '-'}
                  {employee.spouseNameNepali ? ` (${employee.spouseNameNepali})` : ''}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">बुबाको नाम (Father's Name)</span>
                <span className="font-bold text-slate-900">
                  {employee.fatherName || '-'}
                  {employee.fatherNameNepali ? ` (${employee.fatherNameNepali})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">आमाको नाम (Mother's Name)</span>
                <span className="font-bold text-slate-900">
                  {employee.motherName || '-'}
                  {employee.motherNameNepali ? ` (${employee.motherNameNepali})` : ''}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 text-[9px] font-bold block uppercase">हजुरबुबाको नाम (Grandfather Name)</span>
                <span className="font-bold text-slate-900">
                  {employee.grandfatherName || '-'}
                  {employee.grandfatherNameNepali ? ` (${employee.grandfatherNameNepali})` : ''}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-slate-500 text-[9px] font-bold block uppercase">स्थायी ठेगाना (Permanent Address)</span>
                <span className="font-bold text-slate-900">
                  {employee.permanentAddress || '-'}
                  {employee.permanentAddressNepali ? ` [नेपाली: ${employee.permanentAddressNepali}]` : ''}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 text-[9px] font-bold block uppercase">अस्थायी ठेगाना (Temporary Address)</span>
                <span className="font-bold text-slate-900">
                  {employee.temporaryAddress || '-'}
                  {employee.temporaryAddressNepali ? ` [नेपाली: ${employee.temporaryAddressNepali}]` : ''}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">आपत्कालीन सम्पर्क व्यक्ति</span>
                <span className="font-bold text-slate-900">{employee.emergencyContact || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">सम्बन्ध (Relationship)</span>
                <span className="font-bold text-slate-900">{employee.emergencyRelation || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">आपत्कालीन फोन (Mobile)</span>
                <span className="font-mono font-bold text-slate-900">{employee.emergencyPhone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">आपत्कालीन ठेगाना (Address)</span>
                <span className="font-bold text-slate-900">{employee.emergencyAddress || '-'}</span>
              </div>
            </div>

            {/* Scanned Document Photos */}
            {(employee.citizenshipFrontUrl || employee.citizenshipBackUrl) && (
              <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-slate-700 block mb-1.5">नागरिकता कागजात फोटोहरू (Citizenship Scans)</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {employee.citizenshipFrontUrl && (
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-slate-500 block">Citizenship Front</span>
                      <img src={employee.citizenshipFrontUrl} alt="Citizenship Front" className="h-24 rounded-lg border border-slate-300 object-cover shadow-2xs" />
                    </div>
                  )}
                  {employee.citizenshipBackUrl && (
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-slate-500 block">Citizenship Back</span>
                      <img src={employee.citizenshipBackUrl} alt="Citizenship Back" className="h-24 rounded-lg border border-slate-300 object-cover shadow-2xs" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Education & Experience Details */}
          <div className="mb-5">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-2">
              ३. शिक्षा तथा अनुभव विवरण (Education & Work Experience)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">उच्चतम योग्यता (Qualification)</span>
                <span className="font-bold text-slate-900">{employee.qualification || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">शिक्षण संस्था (Institution)</span>
                <span className="font-bold text-slate-900">{employee.institution || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">उत्तीर्ण वर्ष (Passed Year)</span>
                <span className="font-bold text-slate-900">{employee.passedYear || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">कुल अनुभव (Total Exp)</span>
                <span className="font-bold text-slate-900">{employee.totalExperience || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">अघिल्लो रोजगारदाता (Employer)</span>
                <span className="font-bold text-slate-900">{employee.previousEmployer || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">अघिल्लो पद (Previous Designation)</span>
                <span className="font-bold text-slate-900">{employee.previousDesignation || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">सेवा प्रवेश (Joined)</span>
                <span className="font-bold text-slate-900">{employee.expJoiningDate || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">सेवा छोडेको (Leaving)</span>
                <span className="font-bold text-slate-900">{employee.expLeavingDate || '-'}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Bank, Payroll & Allowance Details */}
          <div className="mb-5">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-2">
              ४. बैंक, सेवा-सुविधा तथा तलब विवरण (Bank & Payroll Details)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">बैंकको नाम (Bank Name)</span>
                <span className="font-bold text-slate-900">{employee.bankName || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">खातावालाको नाम (Account Holder)</span>
                <span className="font-bold text-slate-900">{employee.accountHolderName || employee.fullName || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">बैंक खाता नम्बर (Account No)</span>
                <span className="font-mono font-bold text-slate-900">{employee.bankAccountNo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">बैंक शाखा (Bank Branch)</span>
                <span className="font-bold text-slate-900">{employee.bankBranch || '-'}</span>
              </div>

              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">बेसिक तलब (Basic Salary)</span>
                <span className="font-black text-slate-900 text-xs sm:text-sm">रू {employee.basicSalary?.toLocaleString('en-IN') || 0}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">महङ्गी भत्ता (D.A.)</span>
                <span className="font-bold text-slate-900">
                  {employee.daType === 'Percentage' ? `${employee.daValue}%` : employee.daType === 'Amount' ? `रू ${employee.daValue}` : 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">ग्रेड दर / रकम (Grade Rate)</span>
                <span className="font-bold text-slate-900">{employee.gradeRate || 0} दर (रू {employee.gradeRateAmount?.toFixed(2) || '0.00'})</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">सञ्चित बिदा दिन (Sanchit Leave)</span>
                <span className="font-bold text-slate-900">{employee.sanchitLeaveDays || 0} दिन (रू {employee.sanchitLeaveAmount?.toFixed(2) || '0.00'})</span>
              </div>

              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">सामाजिक सुरक्षा कोष (SSF)</span>
                <span className="font-bold text-slate-900">{employee.hasSSF ? 'लागू (Active)' : 'छैन (No)'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">कर्मचारी सञ्चय कोष (P.F.)</span>
                <span className="font-bold text-slate-900">{employee.hasPF ? 'लागू (Active)' : 'छैन (No)'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">दशैं खर्च (Dashain Allowance)</span>
                <span className="font-bold text-slate-900">{employee.hasDashain ? '१ महिना बेसिक' : 'छैन'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] font-bold block uppercase">उपचार खर्च (Medical Allowance)</span>
                <span className="font-bold text-slate-900">{employee.hasMedical ? '१ महिना बेसिक' : 'छैन'}</span>
              </div>
            </div>
          </div>

          {/* Section 5: Document Checklist Status */}
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border-l-4 border-emerald-600 tracking-wider mb-2">
              ५. पेश गरिएका कागजातहरूको स्थिति (Document Checklist)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
              {[
                { title: 'Citizenship Copy (नागरिकता)', key: employee.docsCitizenship || !!employee.citizenshipFrontUrl },
                { title: 'National ID (राष्ट्रिय परिचयपत्र)', key: employee.docsNid },
                { title: 'PAN Card (प्यान कार्ड)', key: employee.docsPan || !!employee.panNo },
                { title: 'Education Certificate (शैक्षिक प्रमाणपत्र)', key: employee.docsEducation || !!employee.qualification },
                { title: 'Experience Letter (अनुभव पत्र)', key: employee.docsExperience || !!employee.totalExperience },
                { title: 'Contract / Appointment Letter', key: employee.docsContract }
              ].map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-700 text-[10px]">{doc.title}</span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${doc.key ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {doc.key ? 'Verified ✅' : 'Pending ⏳'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 text-center text-[9px] text-slate-400 font-bold border-t border-slate-200 pt-2">
            {settings?.systemName || 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड'} - आधिकारिक कर्मचारी व्यक्तिगत तथा KYC अभिलेख
          </div>

        </div>
      </div>
    </div>
  );
};
