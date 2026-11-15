import React, { useState } from 'react';
import { 
  User, FileText, Printer, X, ShieldCheck, 
  Wallet, Calendar, Landmark, CheckSquare, Edit2,
  FileDown, Loader2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BoardMember, SystemSettings } from '../types';
import { RatauliOfficialEmblem } from './RatauliLogo';
import { CooperativeHeaderBrand } from './CooperativeHeaderBrand';
import { useDayEndLock, getDayEndedBlockMessage } from '../utils/dayEndLock';

export const generateKYMDocPdf = async (element: HTMLElement, fileName: string): Promise<void> => {
  const prevScrollY = window.scrollY;
  const prevScrollX = window.scrollX;
  window.scrollTo(0, 0);

  try {
    const page1El = (element.querySelector('[data-kym-page="1"]') as HTMLElement) || element;
    const page2El = element.querySelector('[data-kym-page="2"]') as HTMLElement | null;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const margin = 6;
    const printWidth = pageWidth - margin * 2; // 198mm
    const maxPrintHeight = pageHeight - margin * 2; // 285mm

    const renderPageToPdf = async (pageEl: HTMLElement, isFirst: boolean) => {
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 840
      });

      let h = (canvas.height * printWidth) / canvas.width;
      let w = printWidth;

      // Maintain strict aspect ratio if height exceeds max printable height
      if (h > maxPrintHeight) {
        const scale = maxPrintHeight / h;
        h = maxPrintHeight;
        w = printWidth * scale;
      }

      // Center horizontally and vertically
      const x = margin + (printWidth - w) / 2;
      const y = margin + (maxPrintHeight - h) / 2;

      if (!isFirst) {
        pdf.addPage();
      }

      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', x, y, w, h, undefined, 'FAST');
    };

    // Render Page 1
    await renderPageToPdf(page1El, true);

    // Render Page 2 if exists
    if (page2El) {
      await renderPageToPdf(page2El, false);
    }

    pdf.save(fileName);
  } finally {
    window.scrollTo(prevScrollX, prevScrollY);
  }
};

export const BoardKYMPrintableContent: React.FC<{
  member: BoardMember;
  settings?: SystemSettings | null;
  id?: string;
}> = ({ member, settings, id = 'kym-printable-document' }) => {
  // Format PAN into 9 digits
  const panDigits = (member.panNo || '').replace(/\D/g, '').padEnd(9, ' ').slice(0, 9).split('');

  // Clean member ID and account characters for individual boxes
  const memberIdClean = (member.memberId || member.memberCode || 'MEM-0012').trim();
  const memberIdBoxes = memberIdClean.split('');

  const accountClean = (member.accountNumber || member.bankAccountNo || '01201017500123').replace(/\s/g, '');
  const accountBoxes = accountClean.split('');

  // Allowance calculation
  const grossAllowance = 
    (member.allowanceConfig?.meetingAllowance || 0) +
    (member.allowanceConfig?.communicationAllowance || 0) +
    (member.allowanceConfig?.travelAllowance || 0) +
    (member.allowanceConfig?.refreshmentAllowance || 0) +
    (member.allowanceConfig?.otherAllowance || 0);

  const tdsRate = member.allowanceConfig?.customTdsRate ?? 15;
  const tdsAmount = Math.round((grossAllowance * tdsRate) / 100);
  const netPayable = grossAllowance - tdsAmount;

  return (
    <div id={id} className="p-2 sm:p-3 space-y-4 bg-white text-xs text-slate-900 print:p-0 print:space-y-0 w-full max-w-[840px] mx-auto leading-normal font-sans">
      
      {/* ======================================================== */}
      {/* ======================= PAGE 1 ======================== */}
      {/* ======================================================== */}
      <div 
        data-kym-page="1" 
        className="bg-white p-3 space-y-2 border border-slate-300 rounded-lg shadow-2xs print:border-none print:shadow-none print:p-0 print:space-y-2"
      >
        {/* HEADER SECTION */}
        <div className="border border-emerald-500 bg-white rounded-lg p-2.5 shadow-2xs">
          <div className="flex flex-row items-center justify-between gap-3">
            
            {/* Left Logo - Clean Official Emblem without circle */}
            <div className="w-18 h-18 shrink-0 flex items-center justify-center">
              <img 
                src={(settings?.logoUrl && !settings.logoUrl.includes('picsum.photos')) ? settings.logoUrl : '/system_logo.png'} 
                alt="Logo" 
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes('system_logo.png')) {
                    target.src = '/system_logo.png';
                  }
                }}
                className="w-16 h-16 object-contain" 
              />
            </div>

            {/* Center Details with matching Nepali and English text width matching photo */}
            <div className="text-center flex-1 space-y-0.5">
              <CooperativeHeaderBrand size="md" showAddress={true} />
              <div className="pt-1 flex justify-center pb-0.5">
                <span className="bg-[#0c6b45] text-white px-5 py-1 rounded font-black text-xs sm:text-sm tracking-wide inline-block leading-normal shadow-xs text-center font-sans">
                  सदस्य पहिचान (KYM) फाराम
                </span>
              </div>
            </div>

            {/* Right: Anusuchi-1 & Passport Photo */}
            <div className="flex flex-col items-center shrink-0">
              <div className="self-end mb-1">
                <span className="bg-[#0c6b45] text-white text-[10.5px] font-black px-2.5 py-0.5 rounded leading-normal shadow-2xs">
                  अनुसूची-१
                </span>
              </div>
              <div className="border border-emerald-500 rounded bg-emerald-50 w-20 h-24 flex flex-col items-center justify-center overflow-hidden shadow-2xs">
                {member.profilePhoto ? (
                  <img src={member.profilePhoto} alt={member.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-1 text-emerald-800 flex flex-col items-center justify-center">
                    <User size={26} className="mx-auto mb-0.5 text-emerald-700" />
                    <span className="text-[8px] font-bold block leading-tight text-center">पासपोर्ट साइज फोटो</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FARAM DARTA BIBARAN (Registration Details) */}
        <div className="border border-emerald-400 bg-white rounded-lg p-2 space-y-1">
          <div className="flex justify-between items-center pb-1 border-b border-emerald-100">
            <div className="flex items-center space-x-1.5 text-emerald-800 font-black text-xs">
              <FileText size={14} />
              <span>फाराम दर्ता विवरण (Registration Details)</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold border border-emerald-300 bg-emerald-50 px-2 py-0.5 rounded">
              अनुसूची-१ आधिकारिक अभिलेख
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
            <div className="md:col-span-4 p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">फाराम भरेको मिति:</span>
              <span className="text-xs font-black text-slate-900 font-mono">
                {member.registrationDateBs || '२०८१-०६-१५'}
              </span>
            </div>

            <div className="md:col-span-4 p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">सदस्यता नं.:</span>
              <div className="flex items-center gap-0.5">
                {memberIdBoxes.map((c, i) => (
                  <span key={i} className="w-4 h-5 border border-slate-400 rounded-2xs bg-white text-[10px] font-mono flex items-center justify-center text-center font-bold leading-none text-slate-900">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="md:col-span-4 p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">खाता नं.:</span>
              <div className="flex items-center gap-0.5">
                {accountBoxes.map((c, i) => (
                  <span key={i} className="w-3.5 h-5 border border-slate-400 rounded-2xs bg-white text-[10px] font-mono flex items-center justify-center text-center font-bold leading-none text-slate-900">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION क: क. व्यक्तिगत विवरण (Personal Details) */}
        <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
          <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs flex justify-between items-center leading-normal">
            <span>क. व्यक्तिगत विवरण (Personal Details)</span>
            <span className="text-[9.5px] text-emerald-200">खण्ड (क)</span>
          </div>

          <div className="p-2 space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(१.क) नाम, थर (नेपालीमा)</span>
                <span className="text-xs font-black text-slate-900 block mt-0.5 leading-snug">{member.fullNameNp || '-'}</span>
              </div>
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(१.ख) पुरा नाम, थर (अंग्रेजीमा - BLOCK LETTERS)</span>
                <span className="text-xs font-black text-slate-900 uppercase block mt-0.5 leading-snug">{member.fullName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(२) जन्म मिति (वि.सं. / ई.सं.)</span>
                <span className="text-xs font-bold text-slate-900 font-mono block mt-0.5 leading-snug">
                  {member.dobBs || '२०४५/०५/१५'} {member.dobAd ? `(${member.dobAd})` : ''}
                </span>
              </div>

              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(३) नागरिकता प्रमाण पत्र नं.</span>
                <span className="text-xs font-black text-slate-900 font-mono block mt-0.5 leading-snug">
                  {member.citizenshipNo || '१७-०१-७५-१२३४५'}
                </span>
              </div>

              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(४) नागरिकता जारी मिति</span>
                <span className="text-xs font-bold text-slate-900 font-mono block mt-0.5 leading-snug">
                  {member.citizenshipIssuedDateBs || '२०६०/०४/१५'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(५) नागरिकता जारी गर्ने कार्यालय र जिल्ला</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5 leading-snug">
                  {member.citizenshipIssuedOffice || 'जिल्ला प्रशासन कार्यालय, महोत्तरी'}
                </span>
              </div>

              <div className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                <span className="text-[9.5px] font-bold text-slate-500">(६) लिङ्ग (Gender)</span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-xs leading-none">
                  {member.gender === 'Female' ? 'महिला (Female)' : member.gender === 'Male' ? 'पुरुष (Male)' : 'अन्य (Other)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION ख: ख. पारिवारिक विवरण (Family Details) */}
        <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
          <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs flex justify-between items-center leading-normal">
            <span>ख. पारिवारिक विवरण (Family Details)</span>
            <span className="text-[9.5px] text-emerald-200">खण्ड (ख)</span>
          </div>

          <div className="p-2 space-y-1.5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(६) आमाको नाम</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5">{member.motherName || '-'}</span>
              </div>
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(७) बाबुको नाम</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5">{member.fatherName || '-'}</span>
              </div>
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">बाजे वा ससुराको नाम</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5">{member.grandfatherName || '-'}</span>
              </div>
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">(९) पति वा पत्नीको नाम</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5">{member.spouseName || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                <span className="text-[9.5px] font-bold text-slate-500">(८) वैवाहिक स्थिति (Marital Status)</span>
                <span className="px-2.5 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-xs">
                  {member.maritalStatus === 'Married' ? 'विवाहित' : member.maritalStatus === 'Single' ? 'अविवाहित' : 'एकल'}
                </span>
              </div>

              <div className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                <span className="text-[9.5px] font-bold text-slate-500">(१०) परिवारको किसिम (Family Type)</span>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold text-xs">
                  {member.familyType || 'संयुक्त र एकै भान्सा'}
                </span>
              </div>
            </div>

            {/* Additional Family Members (if present) */}
            {member.additionalFamilyMembers && member.additionalFamilyMembers.length > 0 && (
              <div className="p-1.5 bg-emerald-50/40 rounded border border-emerald-200">
                <span className="text-[10px] font-black text-emerald-900 block mb-1">
                  (११) थप पारिवारिक सदस्यहरूको विवरण
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {member.additionalFamilyMembers.map((fm, idx) => (
                    <div key={idx} className="p-1 bg-white border border-emerald-200 rounded text-xs flex justify-between items-center">
                      <span className="text-slate-800"><strong>{fm.name}</strong> ({fm.relation})</span>
                      <span className="text-slate-600 font-semibold">{fm.occupation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION ग: ग. पेशा तथा पहिचान विवरण (Occupation Details) */}
        <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
          <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs flex justify-between items-center leading-normal">
            <span>ग. पेशा तथा पहिचान विवरण (Occupation & Identification Details)</span>
            <span className="text-[9.5px] text-emerald-200">खण्ड (ग)</span>
          </div>

          <div className="p-2 space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                <span className="text-[9.5px] font-bold text-slate-500">११. आफ्नो मुख्य पेशा:</span>
                <span className="px-3 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-bold text-xs leading-normal">
                  {member.occupation || 'खेतीपाती'}
                </span>
              </div>

              {/* १२. स्थायी लेखा नम्बर (PAN Number) - Strictly 9 centered boxes, no duplicate outside text */}
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[9.5px] font-bold text-slate-500 whitespace-nowrap">१२. स्थायी लेखा नम्बर (PAN):</span>
                <div className="flex items-center gap-0.5">
                  {panDigits.map((d, idx) => (
                    <span key={idx} className="w-4.5 h-5.5 border border-slate-400 rounded-2xs bg-white font-mono font-bold text-xs flex items-center justify-center text-center leading-none text-slate-900 shadow-2xs">
                      {d.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">१३. पति वा पत्नीको मुख्य पेशा</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5">{member.spouseOccupation || 'खेतीपाती'}</span>
              </div>

              <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">१४. अर्को कमाउने सदस्यको नाता / पेशा</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5">
                  {member.earningMemberRelation || 'छोरा'} - {member.earningMemberOccupation || 'सरकारी जागिर'}
                </span>
              </div>

              <div className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                <span className="text-[9.5px] font-bold text-slate-500">१५. उच्च पदस्थ भूमिका (PEP)</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${member.isHighProfile === 'रहेको' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'}`}>
                  {member.isHighProfile || 'नरहेको'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page 1 Bottom Footer */}
        <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-[10px] text-slate-500 font-medium">
          <span>रतौली बचत तथा ऋण सहकारी संस्था लि. • अनुसूची-१ (सदस्य पहिचान फाराम)</span>
          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">पृष्ठ १ / २</span>
        </div>
      </div>

      {/* Page break marker for browser print */}
      <div className="print:break-before-page h-2 hidden print:block" />

      {/* ======================================================== */}
      {/* ======================= PAGE 2 ======================== */}
      {/* ======================================================== */}
      <div 
        data-kym-page="2" 
        className="bg-white p-3 space-y-2 border border-slate-300 rounded-lg shadow-2xs print:border-none print:shadow-none print:p-0 print:space-y-2"
      >
        {/* Top Header on Page 2 for official continuity */}
        <div className="flex justify-between items-center pb-1.5 border-b-2 border-emerald-600 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-black text-[#0c6b45] text-xs sm:text-sm">
              रतौली बचत तथा ऋण सहकारी संस्था लि.
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600 font-bold text-xs">
              सदस्य पहिचान (KYM) फाराम
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-700 font-semibold text-xs">
              सदस्य: <strong className="text-emerald-900">{member.fullName}</strong>
            </span>
            <span className="font-bold text-slate-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded text-[10px]">
              पृष्ठ २ / २
            </span>
          </div>
        </div>

        {/* SECTION घ: घ. बसाइँको विवरण (Residential Details) */}
        <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
          <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs flex justify-between items-center leading-normal">
            <span>घ. बसाइँको विवरण (Residential Details)</span>
            <span className="text-[9.5px] text-emerald-200">खण्ड (घ)</span>
          </div>

          <div className="p-2 space-y-1.5">
            {/* Permanent Address */}
            <div className="p-1.5 bg-emerald-50/30 rounded border border-emerald-200 space-y-1">
              <span className="text-[10px] font-black text-emerald-900 block">१७. स्थायी ठेगाना (PERMANENT ADDRESS)</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs">
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">प्रदेश:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.permanentProvince || 'मधेश प्रदेश'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">जिल्ला:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.permanentDistrict || 'महोत्तरी'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">गाउँपालिका:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.permanentMunicipality || 'पिपरा गाउँपालिका'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">वडा नं.:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.permanentWard || '०३'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">गाउँ/टोल:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.permanentTole || 'रतौली'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">घर नं.:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.permanentHouseNo || '-'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">मोबाइल नं.:</span>
                  <strong className="text-emerald-800 font-mono font-bold block mt-0.5">{member.mobile}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">ईमेल:</span>
                  <strong className="text-slate-900 text-[10px] block mt-0.5 break-all leading-tight">
                    {member.email || '-'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Temporary Address */}
            <div className="p-1.5 bg-slate-50 rounded border border-slate-200 space-y-1">
              <span className="text-[10px] font-black text-slate-800 block">१८. अस्थायी ठेगाना (TEMPORARY ADDRESS)</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs">
                <div className="p-1 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">प्रदेश:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.temporaryProvince || member.permanentProvince || 'मधेश प्रदेश'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">जिल्ला:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.temporaryDistrict || member.permanentDistrict || 'महोत्तरी'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">गाउँपालिका:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.temporaryMunicipality || member.permanentMunicipality || 'पिपरा गाउँपालिका'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 text-[9px] block leading-none font-semibold">वडा नं.:</span>
                  <strong className="text-slate-900 block mt-0.5">{member.temporaryWard || member.permanentWard || '०३'}</strong>
                </div>
              </div>
            </div>

            {/* Area Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs p-1 bg-slate-50 rounded border border-slate-200">
              <div className="p-1 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[9px] block leading-none font-semibold">१९. कार्यक्षेत्र बसोबास:</span>
                <strong className="block mt-0.5">{member.workingAreaResidency || 'स्थायी'}</strong>
              </div>
              <div className="p-1 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[9px] block leading-none font-semibold">२०. मतदाता नं.:</span>
                <strong className="font-mono block mt-0.5">{member.voterIdNo || 'VTR-9823412'}</strong>
              </div>
              <div className="p-1 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[9px] block leading-none font-semibold">२१. मतदान स्थल:</span>
                <strong className="block mt-0.5">{member.votingCenter || 'पिपरा मा.वि.'}</strong>
              </div>
              <div className="p-1 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[9px] block leading-none font-semibold">२२. वर्षमा बिताउने अवधि:</span>
                <strong className="block mt-0.5">{member.stayDurationInArea || '१२ महिना (स्थायी)'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION ङ, च, छ: सहकारी सदस्यता, आयस्रोत, वित्तीय कारोबार */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
          
          {/* SECTION ङ */}
          <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs leading-normal">
              ङ. सहकारी सदस्यता
            </div>
            <div className="p-1.5 space-y-1 text-xs">
              <div>
                <span className="text-[9.5px] text-slate-500 block leading-tight">२४. सदस्य बन्नुको उद्देश्य</span>
                <span className="font-bold text-slate-800 text-[11px] block">{member.cooperativePurpose || 'नियमित बचत, कर्जा सुविधा तथा आर्थिक समृद्धि'}</span>
              </div>
              <div>
                <span className="text-[9.5px] text-slate-500 block leading-tight">२५. अन्य सहकारीमा संलग्नता</span>
                <span className="font-bold text-slate-800 text-[11px] block">{member.isOtherCoopMember || 'नभएको'}</span>
              </div>
              <div>
                <span className="text-[9.5px] text-slate-500 block leading-tight">३१. परिवार यसै सहकारीमा</span>
                <span className="font-bold text-slate-800 text-[11px] block">{member.isFamilyOtherCoopMember || 'नभएको'}</span>
              </div>
            </div>
          </div>

          {/* SECTION च */}
          <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs leading-normal">
              च. आयस्रोतको विवरण
            </div>
            <div className="p-1.5 space-y-1 text-xs">
              <div className="flex justify-between items-center pb-0.5 border-b border-slate-100">
                <span className="text-[9.5px] text-slate-500">३३. कुल आम्दानी:</span>
                <span className="font-black text-emerald-800 text-[11px]">{member.annualIncomeRange || '४ लाख-१० लाख'}</span>
              </div>
              <div className="text-[10.5px] space-y-0.5">
                <div className="flex justify-between"><span>खेतीपाती:</span> <strong className="font-mono">रु. {member.annualIncomeSources?.agriculture || '३,००,०००'}</strong></div>
                <div className="flex justify-between"><span>व्यवसाय:</span> <strong className="font-mono">रु. {member.annualIncomeSources?.business || '१,००,०००'}</strong></div>
                <div className="flex justify-between"><span>स्वदेशी जागिर:</span> <strong className="font-mono">रु. {member.annualIncomeSources?.domesticJob || '२,००,०००'}</strong></div>
                <div className="flex justify-between"><span>वैदेशिक रोजगारी:</span> <strong className="font-mono">रु. {member.annualIncomeSources?.foreignJob || '०'}</strong></div>
              </div>
            </div>
          </div>

          {/* SECTION छ */}
          <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs leading-normal">
              छ. वित्तीय कारोबार विवरण
            </div>
            <div className="p-1.5 space-y-0.5 text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-slate-600">सेयर रकम:</span>
                <strong className="text-emerald-800 font-mono">रु. {Number(member.shareAmount || 10000).toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">बचत जम्मा:</span>
                <strong className="text-emerald-800 font-mono">रु. {Number(member.savingsAmount || 5000).toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">अनुमानित ऋणधन:</span>
                <strong className="font-mono">रु. {member.estimatedLoan || '२,००,०००'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">वार्षिक कारोबार:</span>
                <strong>{member.estimatedTransactionsCount || '२४ पटक'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">वार्षिक जम्मा:</span>
                <strong className="font-mono">रु. {member.estimatedAnnualDeposit || '१,००,०००'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION ज & झ: स्व-घोषणा, औंठाछाप तथा कागजातहरू */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          
          {/* SECTION ज */}
          <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs flex justify-between items-center leading-normal">
              <span>ज. स्व-घोषणा तथा औंठाछाप (Biometrics)</span>
              <span className="text-[9.5px] text-emerald-200">मन्जुर छ</span>
            </div>
            <div className="p-1.5 grid grid-cols-3 gap-1.5 text-center text-[9.5px]">
              <div className="border border-slate-200 rounded p-1 bg-slate-50 flex flex-col items-center justify-between">
                <span className="font-bold text-slate-700 block leading-tight">निवेदकको दस्तखत</span>
                <div className="h-12 w-full border border-dashed border-slate-300 rounded flex items-center justify-center bg-white overflow-hidden my-0.5">
                  {member.signaturePhoto ? (
                    <img src={member.signaturePhoto} alt="Sign" className="max-h-full object-contain" />
                  ) : (
                    <span className="text-slate-400 italic text-[8px]">हस्ताक्षर प्रमाणित</span>
                  )}
                </div>
                <span className="text-[8.5px] font-bold text-slate-700 truncate w-full">{member.fullName}</span>
              </div>

              <div className="border border-slate-200 rounded p-1 bg-slate-50 flex flex-col items-center justify-between">
                <span className="font-bold text-slate-700 block leading-tight">दायाँ औंठा छाप</span>
                <div className="h-12 w-full border border-dashed border-slate-300 rounded flex items-center justify-center bg-white overflow-hidden my-0.5">
                  {member.rightThumbPhoto ? (
                    <img src={member.rightThumbPhoto} alt="Thumb" className="max-h-full object-contain" />
                  ) : (
                    <span className="text-slate-400 italic text-[8px]">दायाँ औंठा</span>
                  )}
                </div>
                <span className="text-[8.5px] text-slate-500">Right Thumb</span>
              </div>

              <div className="border border-slate-200 rounded p-1 bg-slate-50 flex flex-col items-center justify-between">
                <span className="font-bold text-slate-700 block leading-tight">बायाँ औंठा छाप</span>
                <div className="h-12 w-full border border-dashed border-slate-300 rounded flex items-center justify-center bg-white overflow-hidden my-0.5">
                  {member.leftThumbPhoto ? (
                    <img src={member.leftThumbPhoto} alt="Thumb" className="max-h-full object-contain" />
                  ) : (
                    <span className="text-slate-400 italic text-[8px]">बायाँ औंठा</span>
                  )}
                </div>
                <span className="text-[8.5px] text-slate-500">Left Thumb</span>
              </div>
            </div>
          </div>

          {/* SECTION झ */}
          <div className="border border-emerald-400 rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs flex justify-between items-center leading-normal">
              <span>झ. संलग्न कागजातहरू (Documents)</span>
              <span className="text-[9.5px] text-emerald-200">अनुसूची-१ संलग्न</span>
            </div>
            <div className="p-1.5 space-y-1 text-xs">
              <div className="flex items-center space-x-1.5 p-1 bg-emerald-50 rounded border border-emerald-200">
                <CheckSquare size={13} className="text-emerald-700 shrink-0" />
                <span className="font-bold text-emerald-950 text-[10.5px]">नेपाली नागरिकता प्रमाणपत्रको प्रतिलिपि (संलग्न)</span>
              </div>
              <div className="flex items-center space-x-1.5 p-1 bg-emerald-50 rounded border border-emerald-200">
                <CheckSquare size={13} className="text-emerald-700 shrink-0" />
                <span className="font-bold text-emerald-950 text-[10.5px]">मतदाता परिचयपत्रको प्रतिलिपि (संलग्न)</span>
              </div>
              <div className="flex items-center space-x-1.5 p-1 bg-emerald-50 rounded border border-emerald-200">
                <CheckSquare size={13} className="text-emerald-700 shrink-0" />
                <span className="font-bold text-emerald-950 text-[10.5px]">पासपोर्ट साइजको फोटो प्रतिलिपि (संलग्न)</span>
              </div>
              {member.documents && member.documents.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {member.documents.map(d => (
                    <span key={d.id} className="px-1.5 py-0.2 bg-slate-100 border border-slate-300 rounded text-[9px] font-bold">
                      {d.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION ञ: सञ्चालक समिति विवरण (Tenure, Mandate, Allowances & TDS 15%) */}
        <div className="border border-emerald-500 rounded-lg overflow-hidden bg-white shadow-xs">
          <div className="bg-[#0c6b45] text-white px-2.5 py-1 font-bold text-xs flex justify-between items-center leading-normal">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck size={14} className="text-emerald-300" />
              <span className="font-black">
                ञ. सञ्चालक समिति विवरण (Tenure, Mandate & Allowances)
              </span>
            </div>
            <span className="text-[9.5px] text-emerald-200">खण्ड (ञ)</span>
          </div>

          <div className="p-2 space-y-1.5">
            {/* Committee & Designation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              <div className="p-1.5 bg-emerald-50/50 rounded border border-emerald-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">१. समिति (Committee Category)</span>
                <span className="text-xs font-black text-slate-900 block mt-0.5">{member.categoryName}</span>
              </div>
              <div className="p-1.5 bg-emerald-50/50 rounded border border-emerald-200">
                <span className="text-[9.5px] font-bold text-slate-500 block leading-tight">२. पद / जिम्मेवारी (Designation)</span>
                <span className="text-xs font-black text-emerald-800 block mt-0.5">{member.designation}</span>
              </div>
            </div>

            {/* Tenure Info */}
            <div className="p-1.5 bg-slate-50 rounded border border-slate-200 space-y-1">
              <div className="flex items-center space-x-1 text-xs font-black text-slate-800">
                <Calendar size={13} className="text-indigo-600" />
                <span>कार्यकाल (Tenure Mandate):</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs">
                <div className="p-1 bg-white rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 block">कार्यकाल सत्र:</span>
                  <strong className="text-slate-900 font-mono text-[11px]">{member.tenure?.termLabel || '2080 - 2084'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 block">स्थिति:</span>
                  <span className="text-emerald-800 font-black text-[11px]">{member.tenure?.status || 'Active'}</span>
                </div>
                <div className="p-1 bg-white rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 block">सुरु मिति:</span>
                  <strong className="text-slate-900 font-mono text-[11px]">{member.tenure?.startDateBs || '2080-04-01'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 block">समाप्त मिति:</span>
                  <strong className="text-slate-900 font-mono text-[11px]">{member.tenure?.endDateBs || '2084-03-30'}</strong>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="p-1.5 bg-emerald-50/30 rounded border border-emerald-200 space-y-1">
              <div className="flex items-center space-x-1 text-xs font-black text-emerald-950">
                <Landmark size={13} className="text-emerald-700" />
                <span>बैंक खाता विवरण:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs">
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-[9px] text-slate-500 block">बैंक:</span>
                  <strong className="text-slate-900 text-[11px]">{member.bankName || 'Nabil Bank Ltd.'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-[9px] text-slate-500 block">शाखा:</span>
                  <strong className="text-slate-900 text-[11px]">{member.bankBranch || 'Janakpur'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-[9px] text-slate-500 block">खाता नं.:</span>
                  <strong className="text-slate-900 font-mono text-[11px]">{member.bankAccountNo || '01201017500123'}</strong>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-100">
                  <span className="text-[9px] text-slate-500 block">किसिम:</span>
                  <strong className="text-slate-900 text-[11px]">{member.bankAccountType || 'Savings'}</strong>
                </div>
              </div>
            </div>

            {/* Monthly Allowance & TDS */}
            <div className="p-2 bg-emerald-50/60 rounded border border-emerald-300 space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1 text-xs font-black text-emerald-950">
                  <Wallet size={13} className="text-emerald-700" />
                  <span>मासिक सेवा सुविधा र १५% TDS कट्टी (Allowances & TDS):</span>
                </div>
                <span className="text-[9.5px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                  १५% TDS कट्टी
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1 text-xs">
                <div className="p-1 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-[9.5px] text-slate-500 block">बैठक भत्ता</span>
                  <span className="font-mono font-bold text-slate-900 text-[11px]">Rs. {(member.allowanceConfig?.meetingAllowance || 0).toLocaleString()}</span>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-[9.5px] text-slate-500 block">सञ्चार</span>
                  <span className="font-mono font-bold text-slate-900 text-[11px]">Rs. {(member.allowanceConfig?.communicationAllowance || 0).toLocaleString()}</span>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-[9.5px] text-slate-500 block">यातायात</span>
                  <span className="font-mono font-bold text-slate-900 text-[11px]">Rs. {(member.allowanceConfig?.travelAllowance || 0).toLocaleString()}</span>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-[9.5px] text-slate-500 block">खाजा/दैनिक</span>
                  <span className="font-mono font-bold text-slate-900 text-[11px]">Rs. {(member.allowanceConfig?.refreshmentAllowance || 0).toLocaleString()}</span>
                </div>
                <div className="p-1 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-[9.5px] text-slate-500 block">अन्य</span>
                  <span className="font-mono font-bold text-slate-900 text-[11px]">Rs. {(member.allowanceConfig?.otherAllowance || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Net Summary Card */}
              <div className="bg-white p-1.5 rounded border border-emerald-300 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold block uppercase">कुल सुविधा (Gross):</span>
                  <span className="text-xs font-black text-slate-900 font-mono">Rs. {grossAllowance.toLocaleString()}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-[9px] text-rose-600 font-bold block uppercase">१५% TDS कर कट्टी:</span>
                  <span className="text-xs font-black text-rose-600 font-mono">- Rs. {tdsAmount.toLocaleString()}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 text-right">
                  <span className="text-[9px] text-emerald-800 font-black block uppercase">खुद भुक्तानी (Net Payable):</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">Rs. {netPayable.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION ट: संस्थाको आधिकारिक प्रयोगका लागि (कार्यालय प्रयोजन) */}
        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/70">
          <div className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1.5 text-center">
            संस्थाको आधिकारिक प्रयोगका लागि (कार्यालय प्रयोजन मात्र)
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[9.5px]">
            <div className="border border-slate-200 rounded p-1.5 bg-white flex flex-col justify-between h-18">
              <span className="text-slate-500">फाराम रुजु गर्ने कर्मचारी:</span>
              <div className="border-b border-dashed border-slate-300 mx-4 my-1" />
              <span className="font-bold text-slate-800">दस्तखत / मिति</span>
            </div>
            <div className="border border-slate-200 rounded p-1.5 bg-white flex flex-col justify-between h-18">
              <span className="text-slate-500">स्वीकृत गर्ने (व्यवस्थापक/अध्यक्ष):</span>
              <div className="border-b border-dashed border-slate-300 mx-4 my-1" />
              <span className="font-bold text-slate-800">दस्तखत / मिति</span>
            </div>
            <div className="border border-slate-200 rounded p-1.5 bg-white flex flex-col justify-between h-18">
              <span className="text-slate-500">संस्थाको छाप:</span>
              <div className="border-b border-dashed border-slate-300 mx-4 my-1" />
              <span className="font-bold text-slate-800">आधिकारिक छाप</span>
            </div>
          </div>
        </div>

        {/* Page 2 Bottom Footer */}
        <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-[10px] text-slate-500 font-medium">
          <span>रतौली बचत तथा ऋण सहकारी संस्था लि. • मुख्य कार्यालय, पिपरा-६, महोत्तरी</span>
          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">पृष्ठ २ / २</span>
        </div>
      </div>
    </div>
  );
};

interface Props {
  member: BoardMember;
  settings?: SystemSettings | null;
  branchId?: string;
  onEdit: () => void;
  onClose: () => void;
}

export const BoardKYMDetailView: React.FC<Props> = ({
  member,
  settings,
  branchId,
  onEdit,
  onClose
}) => {
  const isDayEnded = useDayEndLock(branchId);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('kym-printable-document');
    if (!el) return;
    try {
      setIsExportingPdf(true);
      const safeName = member.fullName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      await generateKYMDocPdf(el, `KYM_Form_${safeName}.pdf`);
    } catch (e) {
      console.error('Failed to export PDF:', e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0 print:overflow-visible print:block print:w-full print:h-auto print:m-0 print:z-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #kym-printable-document, #kym-printable-document * {
            visibility: visible;
          }
          #kym-printable-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
          }
          [data-kym-page="2"] {
            page-break-before: always;
            break-before: page;
          }
          @page {
            size: A4 portrait;
            margin: 6mm 6mm !important;
          }
        }
      ` }} />
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-xl border border-slate-300 animate-in zoom-in-95 my-auto print:max-h-none print:overflow-visible print:w-full print:max-w-none print:shadow-none print:border-none print:m-0 print:rounded-none">
        
        {/* Top Control Bar */}
        <div className="bg-emerald-900 text-white px-3 py-2 flex justify-between items-center no-print rounded-t-xl sticky top-0 z-20">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              सदस्य पहिचान (KYM) फाराम • पूर्ण विवरण अवलोकन
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-md text-xs font-bold flex items-center space-x-1 transition-colors shadow-xs disabled:opacity-50"
              title="KYM फाराम PDF डाउनलोड गर्नुहोस्"
            >
              {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              <span>PDF डाउनलोड</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-md text-xs font-bold flex items-center space-x-1 transition-colors"
            >
              <Printer size={13} />
              <span>प्रिन्ट</span>
            </button>
            <button
              type="button"
              onClick={() => !isDayEnded && onEdit()}
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Board Profile'}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-md text-xs font-bold flex items-center space-x-1 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Edit2 size={13} />
              <span>सम्पादन</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-emerald-300 hover:text-white rounded-md hover:bg-emerald-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body */}
        <BoardKYMPrintableContent member={member} settings={settings} id="kym-printable-document" />

        {/* Bottom Actions */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 no-print">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors"
            >
              <Printer size={13} />
              <span>फाराम प्रिन्ट गर्नुहोस् (Print)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              <span>PDF डाउनलोड (Download PDF)</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
            >
              बन्द गर्नुहोस् (Close)
            </button>
            <button
              type="button"
              onClick={() => !isDayEnded && onEdit()}
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Board Profile'}
              className="px-5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-lg text-xs shadow-sm uppercase tracking-wider flex items-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Edit2 size={14} />
              <span>विवरण सम्पादन (Edit)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
