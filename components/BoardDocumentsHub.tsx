import React, { useState, useRef } from 'react';
import { 
  User, Award, CreditCard, Briefcase, FileCheck, 
  Printer, FileDown, Search, CheckCircle2, Shield, 
  Mail, Phone, MapPin, Globe, Loader2,
  FileText, Sparkles, Edit2, Copy, Check,
  Upload, Trash2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BoardMember, SystemSettings } from '../types';
import { RatauliOfficialEmblem } from './RatauliLogo';
import { CooperativeHeaderBrand } from './CooperativeHeaderBrand';
import { OfficialSecurityQrCode } from './OfficialSecurityQrCode';

export type DocumentType = 
  | 'election_certificate' 
  | 'appreciation_letter' 
  | 'id_card' 
  | 'visiting_card' 
  | 'appointment_letter';

interface Props {
  members: BoardMember[];
  settings?: SystemSettings | null;
  onEditMember?: (member: BoardMember) => void;
}

// Clean helper to extract English text only from bilingual strings
const toEnglishOnly = (text: string | undefined | null, fallback = ''): string => {
  if (!text) return fallback;
  // If text contains parenthesis e.g. "Vice-Chairperson", grab what's inside
  const match = text.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const clean = match[1].replace(/[^\x20-\x7E]/g, '').trim();
    if (clean) return clean;
  }
  // Strip non-ASCII (Nepali/Devanagari) characters
  const asciiOnly = text.replace(/[^\x20-\x7E]/g, '').trim();
  return asciiOnly || fallback;
};

export const BoardDocumentsHub: React.FC<Props> = ({ members, settings }) => {
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('election_certificate');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [memberSearch, setMemberSearch] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Document customization fields
  const [refNumber, setRefNumber] = useState('RSCCL/BOD/DOC-2081/042');
  const [registrationNo, setRegistrationNo] = useState('421/054/055');
  const [panNo, setPanNo] = useState('301294821');
  const [issueDate, setIssueDate] = useState('2024-07-16');
  const [agmLabel, setAgmLabel] = useState('16th Annual General Assembly');
  const [tenureLabel, setTenureLabel] = useState('2024 - 2028 (4-Year Term)');

  // Recipient text overrides (allows changing recipient directly)
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [customDesignation, setCustomDesignation] = useState('');
  const [customCommittee, setCustomCommittee] = useState('');

  // 1. Election Certificate Custom Texts
  const [electionSubtitle, setElectionSubtitle] = useState('OFFICIAL ACCREDITATION OF ELECTED OFFICE');
  const [electionTitle, setElectionTitle] = useState('CERTIFICATE OF ELECTION');
  const [electionPrefix, setElectionPrefix] = useState('This is to formally certify and affirm that');
  const [electionDeclaration, setElectionDeclaration] = useState('has been lawfully and duly declared elected to the distinguished executive office of');
  const [electionMandate, setElectionMandate] = useState(
    'in accordance with the democratic elections conducted during the General Assembly of Ratauli Saving and Credit Co-operative Limited, entrusted with all statutory mandates, governing rights, and fiduciary obligations.'
  );

  // 2. Appreciation Certificate Custom Texts
  const [appreciationSubtitle, setAppreciationSubtitle] = useState('HONORARY AWARD OF MERIT AND VALUED SERVICE');
  const [appreciationTitle, setAppreciationTitle] = useState('CERTIFICATE OF APPRECIATION');
  const [appreciationPrefix, setAppreciationPrefix] = useState('This prestigious commendation is proudly presented to');
  const [appreciationNote, setAppreciationNote] = useState(
    'In profound recognition and sincere appreciation of distinguished leadership, exceptional dedication, and visionary guidance rendered towards the sustained empowerment, institutional governance, and socioeconomic welfare of all members of the cooperative.'
  );
  const [appreciationClosing, setAppreciationClosing] = useState(
    'The Board of Directors, Audit Committee, and the entire cooperative membership convey our utmost gratitude for your enduring service, high ethical leadership, and valuable stewardship.'
  );

  // 3. Mandate & Appointment Letter Custom Texts
  const [appointmentSubject, setAppointmentSubject] = useState('SUBJECT: OFFICIAL LETTER OF APPOINTMENT AND PORTFOLIO MANDATE');
  const [appointmentSalutation, setAppointmentSalutation] = useState('Dear Respected Board Member,');
  const [appointmentBody, setAppointmentBody] = useState(
    'We have the distinct honor and privilege to formally communicate and certify your official appointment to the distinguished executive governance portfolio of Ratauli Saving and Credit Co-operative Limited.'
  );
  const [appointmentMandateText, setAppointmentMandateText] = useState(
    'Your mandate shall remain active for the statutory tenure of 2024–2028 (4-Year Term), during which you are empowered to guide strategic policies, oversee financial integrity, and ensure equitable prosperity for all cooperative members.'
  );

  // Signatories & Uploaded Signatures
  const [primarySignatoryName, setPrimarySignatoryName] = useState('Adv. Rameshwor Sharma');
  const [primarySignatoryTitle, setPrimarySignatoryTitle] = useState('Chief Election Officer');
  const [primarySignatorySignature, setPrimarySignatorySignature] = useState<string | null>(null);

  const [secondarySignatoryName, setSecondarySignatoryName] = useState('Dilip Kumar Sharma');
  const [secondarySignatoryTitle, setSecondarySignatoryTitle] = useState('Board Chairperson');
  const [secondarySignatorySignature, setSecondarySignatorySignature] = useState<string | null>(null);

  const [idCardSignatoryTitle, setIdCardSignatoryTitle] = useState('Chairperson Sign');
  const [idCardSignatorySignature, setIdCardSignatorySignature] = useState<string | null>(null);

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

  const [bloodGroup, setBloodGroup] = useState('O+ve');
  const [emergencyPhone, setEmergencyPhone] = useState('+977-9844012345');
  const [visitingCardTheme, setVisitingCardTheme] = useState<'emerald' | 'white' | 'navy'>('emerald');
  const [isLiveEditMode, setIsLiveEditMode] = useState(true);
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);
  const [isGeneratingJpg, setIsGeneratingJpg] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const selectedMember = members.find(m => m.id === selectedMemberId) || members[0];

  const filteredMembers = members.filter(m => {
    const nameMatch = m.fullName.toLowerCase().includes(memberSearch.toLowerCase());
    const desMatch = (m.designation || '').toLowerCase().includes(memberSearch.toLowerCase());
    return nameMatch || desMatch;
  });

  const memberEnglishName = customRecipientName.trim() || (selectedMember ? selectedMember.fullName.toUpperCase() : 'RAMESH KUMAR SHRESTHA');
  const memberEnglishDesignation = customDesignation.trim() || (selectedMember 
    ? toEnglishOnly(selectedMember.designation, selectedMember.designation || 'CHAIRPERSON / PRESIDENT')
    : 'CHAIRPERSON / PRESIDENT');
  const memberEnglishCommittee = customCommittee.trim() || (selectedMember 
    ? toEnglishOnly(selectedMember.categoryName, 'BOARD OF DIRECTORS')
    : 'BOARD OF DIRECTORS');

  // Handle PDF Export
  const handleDownloadPdf = async () => {
    const el = document.getElementById('board-doc-printable-canvas');
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

      const isLandscape = selectedDocType === 'election_certificate' || selectedDocType === 'appreciation_letter';
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = isLandscape ? 6 : 10;
      const printWidth = pageWidth - margin * 2;
      const printHeight = (canvas.height * printWidth) / canvas.width;

      let finalWidth = printWidth;
      let finalHeight = printHeight;

      if (finalHeight > pageHeight - margin * 2) {
        const ratio = (pageHeight - margin * 2) / finalHeight;
        finalHeight = pageHeight - margin * 2;
        finalWidth = printWidth * ratio;
      }

      const x = margin + (printWidth - finalWidth) / 2;
      const y = margin + (pageHeight - margin * 2 - finalHeight) / 2;

      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');

      const fileSlug = selectedDocType.replace('_', '-');
      const memberSlug = memberEnglishName.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`${fileSlug}_${memberSlug}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJpg = async (elementId: string, fileName: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    setIsGeneratingJpg(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
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

  const handleCopyImage = async (elementId: string, label: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
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
          // Fallback: download as JPG if clipboard write is blocked
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/jpeg', 0.95);
          link.download = `${label.toLowerCase().replace(/\s+/g, '_')}.jpg`;
          link.click();
          setCopySuccessMsg(`${label} downloaded as JPG!`);
          setTimeout(() => setCopySuccessMsg(null), 3000);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
  };

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* Scoped Dynamic Print Styling */}
      <style>{`
        @media print {
          /* Hide all page UI outside of the printable canvas */
          body * {
            visibility: hidden;
          }
          #board-doc-printable-canvas,
          #board-doc-printable-canvas * {
            visibility: visible;
          }
          #board-doc-printable-canvas {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .no-print, [no-print] {
            display: none !important;
            visibility: hidden !important;
          }

          ${(selectedDocType === 'election_certificate' || selectedDocType === 'appreciation_letter') ? `
            @page {
              size: A4 landscape !important;
              margin: 0mm !important;
            }
            html, body {
              width: 297mm !important;
              height: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              overflow: hidden !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #board-doc-printable-canvas {
              width: 297mm !important;
              max-width: 297mm !important;
              height: 210mm !important;
              min-height: 210mm !important;
              max-height: 210mm !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
            }
            .board-cert-landscape-sheet {
              width: 297mm !important;
              height: 210mm !important;
              min-height: 210mm !important;
              max-height: 210mm !important;
              box-sizing: border-box !important;
              margin: 0 auto !important;
              padding: 6mm 10mm 6mm 10mm !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          ` : selectedDocType === 'appointment_letter' ? `
            @page {
              size: A4 portrait !important;
              margin: 6mm 8mm !important;
            }
            html, body {
              background: #ffffff !important;
            }
            .board-appointment-sheet {
              width: 100% !important;
              box-sizing: border-box !important;
              padding: 6mm 10mm !important;
            }
          ` : `
            @page {
              size: A4 portrait !important;
              margin: 8mm !important;
            }
            html, body {
              background: #ffffff !important;
            }
            .board-cards-sheet {
              width: 100% !important;
              display: flex !important;
              flex-direction: row !important;
              justify-content: center !important;
              gap: 15mm !important;
              padding-top: 15mm !important;
            }
          `}
        }
      `}</style>

      {/* Top Banner and Navigation Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <FileText size={18} />
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Official Board Document Generator
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Issue verified election certificates, appreciation credentials, ID cards, business cards, and official mandate letters.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsLiveEditMode(!isLiveEditMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs ${
                isLiveEditMode 
                  ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                  : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
              }`}
              title="Toggle live on-canvas text editing"
            >
              <Edit2 size={13} className={isLiveEditMode ? 'text-amber-700' : 'text-slate-600'} />
              <span>{isLiveEditMode ? 'Live Edit: On' : 'Live Edit: Off'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs"
              title="Print document on connected printer"
            >
              <Printer size={13} />
              <span>Print Document</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs disabled:opacity-50"
              title="Export high-resolution PDF"
            >
              {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              <span>Download PDF</span>
            </button>

            {(selectedDocType === 'id_card' || selectedDocType === 'visiting_card') && (
              <>
                <button
                  onClick={() => {
                    const prefix = selectedDocType === 'id_card' ? 'id-card' : 'visiting-card';
                    const label = selectedDocType === 'id_card' ? 'ID' : 'Visiting';
                    handleDownloadJpg(`${prefix}-front-canvas`, `${memberEnglishName.replace(/\s+/g, '_')}_${label}_Front`);
                  }}
                  disabled={isGeneratingJpg}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs disabled:opacity-50"
                  title="Download Front as JPG"
                >
                  <FileDown size={13} className="text-amber-400" />
                  <span>JPG Front</span>
                </button>
                <button
                  onClick={() => {
                    const prefix = selectedDocType === 'id_card' ? 'id-card' : 'visiting-card';
                    const label = selectedDocType === 'id_card' ? 'ID Card Front' : 'Visiting Card Front';
                    handleCopyImage(`${prefix}-front-canvas`, label);
                  }}
                  disabled={isGeneratingJpg}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs disabled:opacity-50"
                  title="Copy card image to clipboard"
                >
                  <Copy size={13} className="text-emerald-700" />
                  <span>Copy Image</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Document Sub-Menu Tabs */}
        <div className="pt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedDocType('election_certificate')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDocType === 'election_certificate'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Award size={14} className={selectedDocType === 'election_certificate' ? 'text-amber-300' : 'text-slate-500'} />
            <span>Election Certificate</span>
          </button>

          <button
            onClick={() => setSelectedDocType('appreciation_letter')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDocType === 'appreciation_letter'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Sparkles size={14} className={selectedDocType === 'appreciation_letter' ? 'text-amber-300' : 'text-slate-500'} />
            <span>Letter of Appreciation</span>
          </button>

          <button
            onClick={() => setSelectedDocType('id_card')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDocType === 'id_card'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <CreditCard size={14} className={selectedDocType === 'id_card' ? 'text-emerald-300' : 'text-slate-500'} />
            <span>Member ID Card</span>
          </button>

          <button
            onClick={() => setSelectedDocType('visiting_card')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDocType === 'visiting_card'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Briefcase size={14} className={selectedDocType === 'visiting_card' ? 'text-indigo-300' : 'text-slate-500'} />
            <span>Visiting Card</span>
          </button>

          <button
            onClick={() => setSelectedDocType('appointment_letter')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDocType === 'appointment_letter'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <FileCheck size={14} className={selectedDocType === 'appointment_letter' ? 'text-purple-300' : 'text-slate-500'} />
            <span>Mandate & Appointment</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Left Controls, Right High-Resolution Document Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* LEFT COLUMN: Configuration Controls & Member Selector */}
        <div className="lg:col-span-4 space-y-3 no-print">
          
          {/* Member Picker */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Target Board Member
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                {members.length} Members
              </span>
            </div>

            {/* Quick Member Filter */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search member name or title..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Selected Member Active Badge */}
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {filteredMembers.map(m => {
                const isSelected = m.id === selectedMemberId;
                const engDes = toEnglishOnly(m.designation, m.designation || 'Director');
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`w-full text-left p-2 flex items-center space-x-2.5 transition-colors ${
                      isSelected ? 'bg-emerald-50/80 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center">
                      {m.profilePhoto ? (
                        <img src={m.profilePhoto} alt={m.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <User size={14} className="text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs truncate ${isSelected ? 'text-emerald-950 font-black' : 'text-slate-800'}`}>
                          {m.fullName}
                        </span>
                        {isSelected && <CheckCircle2 size={12} className="text-emerald-700 shrink-0 ml-1" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {engDes}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Document Content & Parameter Customizer */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 block">
                Document Content Editor
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomRecipientName('');
                  setCustomDesignation('');
                  setCustomCommittee('');
                }}
                className="text-[10px] text-emerald-700 font-bold hover:underline"
                title="Reset name and designation to selected member"
              >
                Reset to Member
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Recipient Customization */}
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  1. Recipient Details
                </span>
                <div>
                  <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Recipient Full Name</label>
                  <input
                    type="text"
                    value={memberEnglishName}
                    onChange={e => setCustomRecipientName(e.target.value)}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                    placeholder="Enter Recipient Name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Designation</label>
                    <input
                      type="text"
                      value={memberEnglishDesignation}
                      onChange={e => setCustomDesignation(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                      placeholder="e.g. CHAIRPERSON"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Committee / Category</label>
                    <input
                      type="text"
                      value={memberEnglishCommittee}
                      onChange={e => setCustomCommittee(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
                      placeholder="e.g. BOARD OF DIRECTORS"
                    />
                  </div>
                </div>
              </div>

              {/* Document Specific Titles & Paragraphs */}
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  2. Document Titles & Wording
                </span>

                {selectedDocType === 'election_certificate' && (
                  <>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Certificate Subtitle</label>
                      <input
                        type="text"
                        value={electionSubtitle}
                        onChange={e => setElectionSubtitle(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Certificate Main Title</label>
                      <input
                        type="text"
                        value={electionTitle}
                        onChange={e => setElectionTitle(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Introductory Prefix</label>
                      <input
                        type="text"
                        value={electionPrefix}
                        onChange={e => setElectionPrefix(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Mandate Statement / Paragraph</label>
                      <textarea
                        rows={3}
                        value={electionMandate}
                        onChange={e => setElectionMandate(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed"
                      />
                    </div>
                  </>
                )}

                {selectedDocType === 'appreciation_letter' && (
                  <>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Award Subtitle</label>
                      <input
                        type="text"
                        value={appreciationSubtitle}
                        onChange={e => setAppreciationSubtitle(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Award Main Title</label>
                      <input
                        type="text"
                        value={appreciationTitle}
                        onChange={e => setAppreciationTitle(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Presentation Prefix</label>
                      <input
                        type="text"
                        value={appreciationPrefix}
                        onChange={e => setAppreciationPrefix(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Commendation Citation Text</label>
                      <textarea
                        rows={4}
                        value={appreciationNote}
                        onChange={e => setAppreciationNote(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Closing Gratitude Statement</label>
                      <textarea
                        rows={2}
                        value={appreciationClosing}
                        onChange={e => setAppreciationClosing(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed"
                      />
                    </div>
                  </>
                )}

                {selectedDocType === 'appointment_letter' && (
                  <>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Subject Line</label>
                      <input
                        type="text"
                        value={appointmentSubject}
                        onChange={e => setAppointmentSubject(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Salutation</label>
                      <input
                        type="text"
                        value={appointmentSalutation}
                        onChange={e => setAppointmentSalutation(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Appointment Body</label>
                      <textarea
                        rows={3}
                        value={appointmentBody}
                        onChange={e => setAppointmentBody(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Mandate Statement</label>
                      <textarea
                        rows={3}
                        value={appointmentMandateText}
                        onChange={e => setAppointmentMandateText(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Reference & Registration Numbers */}
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  3. Reference & Registration
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Registration No.</label>
                    <input
                      type="text"
                      value={registrationNo}
                      onChange={e => setRegistrationNo(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">PAN No.</label>
                    <input
                      type="text"
                      value={panNo}
                      onChange={e => setPanNo(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Dispatch / Ref No.</label>
                    <input
                      type="text"
                      value={refNumber}
                      onChange={e => setRefNumber(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Issue Date (AD)</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={e => setIssueDate(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">Tenure / Term</label>
                  <input
                    type="text"
                    value={tenureLabel}
                    onChange={e => setTenureLabel(e.target.value)}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                {selectedDocType === 'election_certificate' && (
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">General Assembly Session</label>
                    <input
                      type="text"
                      value={agmLabel}
                      onChange={e => setAgmLabel(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              {selectedDocType === 'id_card' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Blood Group</label>
                    <input
                      type="text"
                      value={bloodGroup}
                      onChange={e => setBloodGroup(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Emergency Contact</label>
                    <input
                      type="text"
                      value={emergencyPhone}
                      onChange={e => setEmergencyPhone(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {selectedDocType === 'visiting_card' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">कार्ड रङ थिम (Color Palette)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setVisitingCardTheme('emerald')}
                      className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                        visitingCardTheme === 'emerald' ? 'border-[#064e3b] bg-gradient-to-r from-[#064e3b] to-[#047857] text-amber-300 shadow-xs' : 'border-slate-200 text-slate-700 bg-white hover:bg-emerald-50'
                      }`}
                    >
                      लोगो हरियो (Emerald)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisitingCardTheme('white')}
                      className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                        visitingCardTheme === 'white' ? 'border-slate-800 bg-slate-900 text-white shadow-xs' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                      }`}
                    >
                      गाढा सेतो (White)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisitingCardTheme('navy')}
                      className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                        visitingCardTheme === 'navy' ? 'border-indigo-600 bg-indigo-900 text-amber-200 shadow-xs' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                      }`}
                    >
                      एक्जिक्युटिभ नेभी
                    </button>
                  </div>
                </div>
              )}

              {/* Signatories & Uploaded Signatures */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  4. Authorized Signatories & Signatures
                </span>
                
                {/* Primary Signatory */}
                <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-700 block">Primary Signatory (Election Officer)</label>
                  <input
                    type="text"
                    value={primarySignatoryName}
                    onChange={e => setPrimarySignatoryName(e.target.value)}
                    className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold"
                  />
                  <input
                    type="text"
                    value={primarySignatoryTitle}
                    onChange={e => setPrimarySignatoryTitle(e.target.value)}
                    className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500"
                  />
                  
                  {/* Upload button */}
                  <div className="pt-0.5">
                    {primarySignatorySignature ? (
                      <div className="flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        <img src={primarySignatorySignature} alt="Sign" className="h-5 w-10 object-contain bg-white rounded border border-emerald-100" />
                        <span className="text-[8.5px] text-[#064e3b] font-bold truncate">Sign Loaded</span>
                        <button
                          type="button"
                          onClick={() => setPrimarySignatorySignature(null)}
                          className="ml-auto text-rose-500 hover:text-rose-700"
                          title="Remove signature"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-dashed border-slate-300 cursor-pointer text-[9.5px] font-medium transition-colors">
                        <Upload size={11} className="text-[#047857]" />
                        <span>Upload Signature</span>
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
                <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-700 block">Secondary Signatory (Chairperson)</label>
                  <input
                    type="text"
                    value={secondarySignatoryName}
                    onChange={e => setSecondarySignatoryName(e.target.value)}
                    className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold"
                  />
                  <input
                    type="text"
                    value={secondarySignatoryTitle}
                    onChange={e => setSecondarySignatoryTitle(e.target.value)}
                    className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500"
                  />

                  {/* Upload button */}
                  <div className="pt-0.5">
                    {secondarySignatorySignature ? (
                      <div className="flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        <img src={secondarySignatorySignature} alt="Sign" className="h-5 w-10 object-contain bg-white rounded border border-emerald-100" />
                        <span className="text-[8.5px] text-[#064e3b] font-bold truncate">Sign Loaded</span>
                        <button
                          type="button"
                          onClick={() => setSecondarySignatorySignature(null)}
                          className="ml-auto text-rose-500 hover:text-rose-700"
                          title="Remove signature"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-dashed border-slate-300 cursor-pointer text-[9.5px] font-medium transition-colors">
                        <Upload size={11} className="text-[#047857]" />
                        <span>Upload Signature</span>
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
                <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-700 block">ID Card Signatory (Chairperson / Authority)</label>
                  <input
                    type="text"
                    value={idCardSignatoryTitle}
                    onChange={e => setIdCardSignatoryTitle(e.target.value)}
                    className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 font-semibold"
                  />

                  {/* Upload button */}
                  <div className="pt-0.5">
                    {idCardSignatorySignature ? (
                      <div className="flex items-center space-x-1.5 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        <img src={idCardSignatorySignature} alt="ID Sign" className="h-5 w-10 object-contain bg-white rounded border border-amber-100" />
                        <span className="text-[8.5px] text-amber-900 font-bold truncate">ID Sign Loaded</span>
                        <button
                          type="button"
                          onClick={() => setIdCardSignatorySignature(null)}
                          className="ml-auto text-rose-500 hover:text-rose-700"
                          title="Remove signature"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-dashed border-slate-300 cursor-pointer text-[9.5px] font-medium transition-colors">
                        <Upload size={11} className="text-amber-600" />
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
          </div>
        </div>

        {/* RIGHT COLUMN: Document High-Resolution Preview Canvas */}
        <div className="lg:col-span-8 bg-slate-100/70 p-3 sm:p-5 rounded-2xl border border-slate-200 overflow-x-auto flex justify-center print:p-0 print:m-0 print:border-none print:bg-transparent print:block print:w-full">
          
          <div 
            id="board-doc-printable-canvas" 
            ref={printAreaRef}
            className="bg-white shadow-xl rounded-sm w-full transition-all duration-200 text-slate-900 print:shadow-none"
            style={{
              maxWidth: (selectedDocType === 'election_certificate' || selectedDocType === 'appreciation_letter') 
                ? '1040px' 
                : (selectedDocType === 'appointment_letter' ? '820px' : '760px')
            }}
          >
            
            {/* ========================================================= */}
            {/* 1. ELECTION CERTIFICATE (CERTIFICATE OF ELECTION)           */}
            {/* ========================================================= */}
            {selectedDocType === 'election_certificate' && (
              <div className="board-cert-landscape-sheet p-6 sm:p-8 lg:p-10 relative border-[10px] sm:border-[14px] border-double border-emerald-900 bg-[#fdfdf9] text-center flex flex-col justify-between min-h-[560px] space-y-3 sm:space-y-4">
                
                {/* Ornate Inner Border */}
                <div className="absolute inset-2 border-2 border-amber-600/60 pointer-events-none" />
                <div className="absolute inset-3 border border-dashed border-emerald-700/40 pointer-events-none" />

                {/* Corner Embellishments */}
                <div className="absolute top-4 left-4 text-amber-700 font-serif text-xl select-none">✦</div>
                <div className="absolute top-4 right-4 text-amber-700 font-serif text-xl select-none">✦</div>
                <div className="absolute bottom-4 left-4 text-amber-700 font-serif text-xl select-none">✦</div>
                <div className="absolute bottom-4 right-4 text-amber-700 font-serif text-xl select-none">✦</div>

                {/* Top Reference & Date Bar */}
                <div className="flex justify-between items-center text-[10.5px] sm:text-[11px] text-slate-700 font-mono border-b border-amber-200/80 pb-1.5">
                  <span>Registration No: <strong>{registrationNo}</strong></span>
                  <span>Pan No: <strong>{panNo}</strong></span>
                </div>

                {/* Institution Header: Logo on the left, clean official emblem without circle rim, prominent increased font sizes */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 py-1 w-full">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 shrink-0 flex items-center justify-center">
                    {settings?.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <RatauliOfficialEmblem className="w-full h-full" withoutCircle={true} />
                    )}
                  </div>

                  <div className="flex-1 max-w-[720px]">
                    <CooperativeHeaderBrand size="2xl" />
                  </div>
                </div>

                {/* Certificate Title (Editable) */}
                <div className="py-1">
                  <span 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setElectionSubtitle(e.currentTarget.textContent || '')}
                    className="text-[11px] sm:text-xs uppercase tracking-widest text-amber-800 font-bold block mb-1 outline-hidden focus:bg-amber-100/50 rounded px-1 transition-colors cursor-text"
                    title="Click to edit subtitle"
                  >
                    {electionSubtitle}
                  </span>
                  <div className="inline-block relative">
                    <h2 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setElectionTitle(e.currentTarget.textContent || '')}
                      className="text-2xl sm:text-3xl font-black text-emerald-900 uppercase tracking-wider font-serif px-6 py-1 border-y-2 border-amber-600 outline-hidden focus:bg-emerald-100/50 rounded transition-colors cursor-text"
                      title="Click to edit certificate title"
                    >
                      {electionTitle}
                    </h2>
                  </div>
                </div>

                {/* Certificate Body Text (Fully Editable) */}
                <div className="max-w-3xl mx-auto space-y-2 sm:space-y-3 text-slate-800 text-xs sm:text-sm leading-relaxed">
                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setElectionPrefix(e.currentTarget.textContent || '')}
                    className="font-serif italic text-slate-600 outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                    title="Click to edit prefix"
                  >
                    {electionPrefix}
                  </p>

                  <div className="py-0.5">
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setCustomRecipientName(e.currentTarget.textContent || '')}
                      className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-950 tracking-wide border-b-2 border-emerald-800 pb-0.5 inline-block px-6 outline-hidden focus:bg-emerald-100/60 rounded cursor-text"
                      title="Click to edit member name"
                    >
                      {memberEnglishName}
                    </span>
                  </div>

                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setElectionDeclaration(e.currentTarget.textContent || '')}
                    className="leading-relaxed outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                    title="Click to edit declaration statement"
                  >
                    {electionDeclaration}
                  </p>

                  <div className="p-2 sm:p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl inline-block max-w-lg">
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setCustomDesignation(e.currentTarget.textContent || '')}
                      className="text-sm sm:text-base font-black text-emerald-900 block uppercase tracking-wide outline-hidden focus:bg-emerald-200/50 rounded px-1 cursor-text"
                      title="Click to edit designation"
                    >
                      {memberEnglishDesignation}
                    </span>
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setCustomCommittee(e.currentTarget.textContent || '')}
                      className="text-[11px] sm:text-xs text-slate-600 font-semibold block mt-0.5 outline-hidden focus:bg-emerald-200/50 rounded px-1 cursor-text"
                      title="Click to edit committee"
                    >
                      {memberEnglishCommittee}
                    </span>
                  </div>

                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setElectionMandate(e.currentTarget.textContent || '')}
                    className="text-[11px] sm:text-xs text-slate-700 leading-normal max-w-2xl mx-auto outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                    title="Click to edit mandate paragraph"
                  >
                    {electionMandate}
                  </p>
                </div>

                {/* Bottom Row in Landscape: Left Signatory | Center Seal & Photo | Right Signatory */}
                <div className="pt-3 sm:pt-5 grid grid-cols-3 items-end gap-3 sm:gap-6 text-xs">
                  {/* Left: Primary Signatory (Election Officer) */}
                  <div className="text-center space-y-1">
                    <div className="h-10 sm:h-12 flex items-end justify-center mb-1">
                      {primarySignatorySignature ? (
                        <img 
                          src={primarySignatorySignature} 
                          alt="Primary Sign" 
                          className="max-h-10 sm:max-h-12 max-w-[130px] sm:max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : (
                        <div className="w-32 sm:w-40 border-b border-slate-700" />
                      )}
                    </div>
                    {primarySignatorySignature && <div className="w-32 sm:w-40 border-b border-slate-700 mx-auto" />}
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setPrimarySignatoryName(e.currentTarget.textContent || '')}
                      className="font-bold text-slate-900 block outline-hidden focus:bg-amber-100/40 rounded cursor-text text-[11px] sm:text-xs"
                      title="Click to edit primary signatory name"
                    >
                      {primarySignatoryName}
                    </span>
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setPrimarySignatoryTitle(e.currentTarget.textContent || '')}
                      className="text-[9.5px] sm:text-[10px] text-slate-500 block outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                      title="Click to edit title"
                    >
                      {primarySignatoryTitle}
                    </span>
                  </div>

                  {/* Center: Member Photo & Rosette Seal */}
                  <div className="flex justify-center items-center gap-3 sm:gap-4 pb-0.5">
                    {selectedMember?.profilePhoto && (
                      <div className="w-16 h-20 sm:w-18 sm:h-22 border-2 border-amber-600/70 p-0.5 rounded shadow-xs bg-white shrink-0">
                        <img src={selectedMember.profilePhoto} alt={memberEnglishName} className="w-full h-full object-cover rounded-2xs" />
                      </div>
                    )}

                    {/* Official Rosette Graphic */}
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-amber-500 bg-amber-50/70 flex flex-col items-center justify-center p-1 text-center shadow-xs shrink-0">
                      <Shield size={20} className="text-amber-700" />
                      <span className="text-[7px] sm:text-[7.5px] font-black uppercase text-amber-900 leading-tight mt-0.5">
                        OFFICIAL SEAL<br />VERIFIED
                      </span>
                    </div>
                  </div>

                  {/* Right: Secondary Signatory (Chairperson) */}
                  <div className="text-center space-y-1">
                    <div className="h-10 sm:h-12 flex items-end justify-center mb-1">
                      {secondarySignatorySignature ? (
                        <img 
                          src={secondarySignatorySignature} 
                          alt="Secondary Sign" 
                          className="max-h-10 sm:max-h-12 max-w-[130px] sm:max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : (
                        <div className="w-32 sm:w-40 border-b border-slate-700" />
                      )}
                    </div>
                    {secondarySignatorySignature && <div className="w-32 sm:w-40 border-b border-slate-700 mx-auto" />}
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setSecondarySignatoryName(e.currentTarget.textContent || '')}
                      className="font-bold text-slate-900 block outline-hidden focus:bg-amber-100/40 rounded cursor-text text-[11px] sm:text-xs"
                      title="Click to edit secondary signatory name"
                    >
                      {secondarySignatoryName}
                    </span>
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setSecondarySignatoryTitle(e.currentTarget.textContent || '')}
                      className="text-[9.5px] sm:text-[10px] text-slate-500 block outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                      title="Click to edit title"
                    >
                      {secondarySignatoryTitle}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 2. LETTER OF APPRECIATION (COMMENDATION CERTIFICATE)       */}
            {/* ========================================================= */}
            {selectedDocType === 'appreciation_letter' && (
              <div className="board-cert-landscape-sheet p-6 sm:p-8 lg:p-10 relative border-[10px] sm:border-[14px] border-double border-amber-800 bg-[#fffdfa] text-center flex flex-col justify-between min-h-[560px] space-y-3 sm:space-y-4">
                
                <div className="absolute inset-2 border-2 border-emerald-800/60 pointer-events-none" />
                <div className="absolute inset-3 border border-dotted border-amber-700/40 pointer-events-none" />

                {/* Top Reference & Date Bar */}
                <div className="flex justify-between items-center text-[10.5px] sm:text-[11px] text-slate-700 font-mono border-b border-amber-200/80 pb-1.5">
                  <span>Registration No: <strong>{registrationNo}</strong></span>
                  <span>Pan No: <strong>{panNo}</strong></span>
                </div>

                {/* Institution Header: Logo on the left, clean official emblem without circle rim, prominent increased font sizes */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 py-1 w-full">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 shrink-0 flex items-center justify-center">
                    {settings?.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <RatauliOfficialEmblem className="w-full h-full" withoutCircle={true} />
                    )}
                  </div>

                  <div className="flex-1 max-w-[720px]">
                    <CooperativeHeaderBrand size="2xl" />
                  </div>
                </div>

                {/* Certificate Title (Editable) */}
                <div className="py-1">
                  <span 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setAppreciationSubtitle(e.currentTarget.textContent || '')}
                    className="text-[11px] sm:text-xs uppercase tracking-widest text-emerald-800 font-bold block mb-1 outline-hidden focus:bg-emerald-100/40 rounded px-1 cursor-text"
                    title="Click to edit award subtitle"
                  >
                    {appreciationSubtitle}
                  </span>
                  <div className="inline-block relative">
                    <h2 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setAppreciationTitle(e.currentTarget.textContent || '')}
                      className="text-2xl sm:text-3xl font-black text-amber-900 uppercase tracking-wider font-serif px-8 py-1 border-y-2 border-amber-700 outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                      title="Click to edit certificate title"
                    >
                      {appreciationTitle}
                    </h2>
                  </div>
                </div>

                {/* Body (Fully Editable) */}
                <div className="max-w-3xl mx-auto space-y-2 sm:space-y-3 text-slate-800 text-xs sm:text-sm leading-relaxed">
                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setAppreciationPrefix(e.currentTarget.textContent || '')}
                    className="font-serif italic text-slate-600 outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                    title="Click to edit prefix"
                  >
                    {appreciationPrefix}
                  </p>

                  <div className="py-0.5">
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setCustomRecipientName(e.currentTarget.textContent || '')}
                      className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-950 tracking-wide border-b-2 border-amber-700 pb-0.5 inline-block px-6 outline-hidden focus:bg-emerald-100/50 rounded cursor-text"
                      title="Click to edit recipient name"
                    >
                      {memberEnglishName}
                    </span>
                  </div>

                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setCustomDesignation(e.currentTarget.textContent || '')}
                    className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-slate-600 outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                    title="Click to edit designation & role"
                  >
                    {memberEnglishDesignation} • {memberEnglishCommittee}
                  </p>

                  <div 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setAppreciationNote(e.currentTarget.textContent || '')}
                    className="p-3 sm:p-3.5 bg-amber-50/50 border border-amber-200/80 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed font-serif italic text-center max-w-2xl mx-auto outline-hidden focus:bg-amber-100/60 cursor-text"
                    title="Click to edit citation paragraph"
                  >
                    "{appreciationNote}"
                  </div>

                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setAppreciationClosing(e.currentTarget.textContent || '')}
                    className="text-[11px] sm:text-xs text-slate-600 leading-normal max-w-xl mx-auto outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                    title="Click to edit closing gratitude"
                  >
                    {appreciationClosing}
                  </p>
                </div>

                {/* Bottom Row in Landscape: Left Signatory (Chairperson) | Center Seal & Photo | Right Signatory (Secretary/Officer) */}
                <div className="pt-3 sm:pt-5 grid grid-cols-3 items-end gap-3 sm:gap-6 text-xs">
                  {/* Left: Chairperson */}
                  <div className="text-center space-y-1">
                    <div className="h-10 sm:h-12 flex items-end justify-center mb-1">
                      {secondarySignatorySignature ? (
                        <img 
                          src={secondarySignatorySignature} 
                          alt="Chairperson Sign" 
                          className="max-h-10 sm:max-h-12 max-w-[130px] sm:max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : (
                        <div className="w-32 sm:w-40 border-b border-slate-700" />
                      )}
                    </div>
                    {secondarySignatorySignature && <div className="w-32 sm:w-40 border-b border-slate-700 mx-auto" />}
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setSecondarySignatoryName(e.currentTarget.textContent || '')}
                      className="font-bold text-slate-900 block outline-hidden focus:bg-amber-100/40 rounded cursor-text text-[11px] sm:text-xs"
                      title="Click to edit chairperson name"
                    >
                      {secondarySignatoryName}
                    </span>
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setSecondarySignatoryTitle(e.currentTarget.textContent || '')}
                      className="text-[9.5px] sm:text-[10px] text-slate-500 block outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                      title="Click to edit title"
                    >
                      {secondarySignatoryTitle}
                    </span>
                  </div>

                  {/* Center: Member Photo & Rosette Seal */}
                  <div className="flex justify-center items-center gap-3 sm:gap-4 pb-0.5">
                    {selectedMember?.profilePhoto && (
                      <div className="w-16 h-20 sm:w-18 sm:h-22 border-2 border-amber-600/70 p-0.5 rounded shadow-xs bg-white shrink-0">
                        <img src={selectedMember.profilePhoto} alt={memberEnglishName} className="w-full h-full object-cover rounded-2xs" />
                      </div>
                    )}

                    {/* Official Rosette Graphic */}
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-amber-500 bg-amber-50/70 flex flex-col items-center justify-center p-1 text-center shadow-xs shrink-0">
                      <Shield size={20} className="text-amber-700" />
                      <span className="text-[7px] sm:text-[7.5px] font-black uppercase text-amber-900 leading-tight mt-0.5">
                        OFFICIAL SEAL<br />VERIFIED
                      </span>
                    </div>
                  </div>

                  {/* Right: Primary Signatory (Election Officer / General Secretary) */}
                  <div className="text-center space-y-1">
                    <div className="h-10 sm:h-12 flex items-end justify-center mb-1">
                      {primarySignatorySignature ? (
                        <img 
                          src={primarySignatorySignature} 
                          alt="Primary Sign" 
                          className="max-h-10 sm:max-h-12 max-w-[130px] sm:max-w-[150px] object-contain filter contrast-125" 
                        />
                      ) : (
                        <div className="w-32 sm:w-40 border-b border-slate-700" />
                      )}
                    </div>
                    {primarySignatorySignature && <div className="w-32 sm:w-40 border-b border-slate-700 mx-auto" />}
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setPrimarySignatoryName(e.currentTarget.textContent || '')}
                      className="font-bold text-slate-900 block outline-hidden focus:bg-amber-100/40 rounded cursor-text text-[11px] sm:text-xs"
                      title="Click to edit officer name"
                    >
                      {primarySignatoryName}
                    </span>
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setPrimarySignatoryTitle(e.currentTarget.textContent || '')}
                      className="text-[9.5px] sm:text-[10px] text-slate-500 block outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                      title="Click to edit title"
                    >
                      {primarySignatoryTitle}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 3. BOARD MEMBER IDENTITY CARD (CR80 FRONT & BACK)         */}
            {/* ========================================================= */}
            {selectedDocType === 'id_card' && (
              <div className="p-6 sm:p-10 space-y-6 bg-slate-50">
                <div className="text-center space-y-1 no-print">
                  <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider">
                    Official Executive Identity Card (CR80 Standard • Front & Back)
                  </h3>
                  <p className="text-xs text-slate-500">
                    High-resolution printable card format for official institutional identification.
                  </p>
                </div>

                {/* JPG Download & Copy Image Action Toolbar */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-1 no-print">
                  <button
                    type="button"
                    onClick={() => handleDownloadJpg('id-card-front-canvas', `${memberEnglishName.replace(/\s+/g, '_')}_ID_Front`)}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileDown size={13} className="text-amber-400" />
                    <span>Front JPG Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadJpg('id-card-back-canvas', `${memberEnglishName.replace(/\s+/g, '_')}_ID_Back`)}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileDown size={13} className="text-amber-400" />
                    <span>Back JPG Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyImage('id-card-front-canvas', 'ID Card Front')}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
                  >
                    <Copy size={13} className="text-emerald-700" />
                    <span>Copy Front Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyImage('id-card-back-canvas', 'ID Card Back')}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
                  >
                    <Copy size={13} className="text-emerald-700" />
                    <span>Copy Back Image</span>
                  </button>
                </div>

                {/* Container for both sides */}
                <div className="flex flex-wrap items-center justify-center gap-6">
                  
                  {/* FRONT SIDE */}
                  <div 
                    id="id-card-front-canvas"
                    className="w-[320px] h-[490px] bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-[#064e3b] flex flex-col justify-between relative"
                  >
                    {/* Top Header Background matching logo colors: Deep Emerald Gradient with Gold Accent */}
                    <div className="bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#064e3b] text-white p-3 text-center relative overflow-hidden border-b-2 border-amber-400 shadow-xs">
                      {/* Gold foil ribbon */}
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
                      <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-[#064e3b] px-4 py-0.5 rounded-full font-black text-[8.5px] uppercase tracking-wider inline-block shadow-xs border border-amber-200 mt-0.5">
                        BOARD OF DIRECTORS
                      </span>
                    </div>

                    {/* Member Photo & Identification */}
                    <div className="flex flex-col items-center pt-2 px-4">
                      <div className="w-24 h-28 rounded-xl border-2 border-amber-400 p-0.5 bg-gradient-to-b from-amber-100 to-emerald-50 shadow-md overflow-hidden mb-1.5">
                        {selectedMember?.profilePhoto ? (
                          <img src={selectedMember.profilePhoto} alt={memberEnglishName} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <User size={36} />
                          </div>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-slate-950 text-center tracking-tight leading-tight uppercase font-sans">
                        {memberEnglishName}
                      </h3>
                      <span className="text-xs font-black text-amber-200 bg-[#064e3b] border border-amber-400/80 px-3.5 py-0.5 rounded-full mt-1 text-center inline-block shadow-2xs">
                        {memberEnglishDesignation}
                      </span>
                      <span className="text-[10px] font-bold text-amber-800 text-center mt-0.5">
                        {memberEnglishCommittee}
                      </span>
                    </div>

                    {/* Key Attributes Grid */}
                    <div className="mx-3 px-3 py-2 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 rounded-xl border border-emerald-200/90 space-y-1 text-[10.5px] shadow-2xs">
                      <div className="flex justify-between items-center py-0.5 border-b border-emerald-100">
                        <span className="text-slate-500 font-semibold">Member Code:</span>
                        <strong className="font-mono text-[#064e3b] font-bold">{selectedMember?.memberCode || selectedMember?.memberId || 'MEM-001'}</strong>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-emerald-100">
                        <span className="text-slate-500 font-semibold">Citizenship No:</span>
                        <strong className="font-mono text-slate-900 font-bold">{selectedMember?.citizenshipNo || '17-01-75-12345'}</strong>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 font-semibold">Valid Term:</span>
                        <strong className="text-[#064e3b] font-bold">{tenureLabel}</strong>
                      </div>
                    </div>

                    {/* Bottom Bar with Barcode / Signature & Emerald Stripe */}
                    <div>
                      <div className="bg-slate-50 px-4 py-1.5 flex items-center justify-between border-t border-slate-200">
                        <div className="text-left">
                          <span className="text-[7.5px] text-slate-400 block font-mono font-bold">SECURITY BARCODE</span>
                          <div className="h-5 flex items-center space-x-0.5">
                            {[2,1,3,1,2,1,1,3,2,1,2,3,1,2,1,2].map((w, idx) => (
                              <span key={idx} style={{ width: `${w}px` }} className="h-3.5 bg-slate-800 inline-block" />
                            ))}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="h-6 flex items-end justify-center mb-0.5">
                            {(idCardSignatorySignature || secondarySignatorySignature || primarySignatorySignature) ? (
                              <img 
                                src={idCardSignatorySignature || secondarySignatorySignature || primarySignatorySignature!} 
                                alt="Signature" 
                                className="h-6 max-w-[65px] object-contain ml-auto filter contrast-125"
                              />
                            ) : (
                              <div className="w-16 border-b border-slate-400 mb-0.5" />
                            )}
                          </div>
                          <div className="border-b border-slate-300 w-16 mb-0.5 ml-auto" />
                          <span className="text-[7.5px] font-bold text-slate-600 block">{idCardSignatoryTitle || 'Chairperson Sign'}</span>
                        </div>
                      </div>
                      <div className="bg-[#064e3b] text-amber-300 py-1 text-[8px] font-mono font-bold tracking-widest text-center border-t border-amber-400/50">
                        RSCCL • OFFICIAL GOVERNING IDENTITY
                      </div>
                    </div>
                  </div>

                  {/* BACK SIDE */}
                  <div 
                    id="id-card-back-canvas"
                    className="w-[320px] h-[490px] bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-[#064e3b] flex flex-col justify-between relative text-center"
                  >
                    {/* Top Header Strip matching logo background colors */}
                    <div className="bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#064e3b] text-white py-2 px-3 flex justify-between items-center text-[9.5px] font-black uppercase tracking-wider border-b-2 border-amber-400 shadow-xs">
                      <span>RSCCL TERMS & DIGITAL VERIFICATION</span>
                      <span className="text-amber-300">REGD: 421/054/055</span>
                    </div>
                    
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      {/* Statutory governance notice */}
                      <div className="space-y-1 text-left bg-emerald-50/50 p-2 rounded-xl border border-emerald-200/80 text-[8.5px] text-slate-700 leading-tight">
                        <p className="flex items-start space-x-1">
                          <span className="text-[#047857] font-bold shrink-0">1.</span>
                          <span>This card affirms official executive membership on the Board of Directors of RSCCL.</span>
                        </p>
                        <p className="flex items-start space-x-1">
                          <span className="text-[#047857] font-bold shrink-0">2.</span>
                          <span>The bearer represents the cooperative in statutory governance and authorized proceedings.</span>
                        </p>
                        <p className="flex items-start space-x-1">
                          <span className="text-[#047857] font-bold shrink-0">3.</span>
                          <span>If found, please return to Head Office, Pipara-6, Mahottari or contact management.</span>
                        </p>
                      </div>

                      {/* Member Emergency & Medical Details */}
                      <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200 text-left text-[10px] space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-semibold">Blood Group:</span>
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-black text-[9.5px]">
                            {bloodGroup}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-semibold">Mobile Phone:</span>
                          <strong className="font-mono text-slate-900">{selectedMember?.mobile || '+977-9844000000'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-semibold">Emergency Contact:</span>
                          <strong className="font-mono text-slate-900">{emergencyPhone}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-semibold">Permanent Address:</span>
                          <strong className="text-slate-900 truncate max-w-[150px]">
                            Pipara-6, Mahottari, Nepal
                          </strong>
                        </div>
                      </div>

                      {/* Upgraded High-Tech Real Scannable QR Code & Verification Block */}
                      <div className="p-2.5 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 border-2 border-emerald-600/80 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                        <OfficialSecurityQrCode 
                          memberCode={selectedMember?.memberCode || selectedMember?.memberId || 'MEM-001'} 
                          memberName={memberEnglishName}
                          designation={memberEnglishDesignation}
                          size={82} 
                        />

                        <div className="text-left text-[8px] text-slate-600 space-y-0.5 leading-tight flex-1">
                          <strong className="text-[#064e3b] block text-[9.5px] font-black uppercase tracking-wider">
                            Head Office Contacts
                          </strong>
                          <span>Pipara Rural Municipality-6, Mahottari</span>
                          <span className="block font-mono text-slate-800">Tel: +977-44-520123</span>
                          <span className="block text-[#047857] font-bold">info@ratauli.org.np</span>
                          <span className="block text-[#047857] font-bold">www.ratauli.org.np</span>
                          <span className="block text-[7.5px] text-slate-500 italic mt-0.5">
                            Scan QR with camera for instant digital verification.
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
            {/* 4. EXECUTIVE VISITING CARD (BUSINESS CARD)                */}
            {/* ========================================================= */}
            {selectedDocType === 'visiting_card' && (
              <div className="p-6 sm:p-10 space-y-6 bg-slate-50">
                <div className="text-center space-y-1 no-print">
                  <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider">
                    Executive Visiting Card (Front & Back Layout)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dense solid white stationery with official cooperative branding for board members and executive meetings.
                  </p>
                </div>

                {/* JPG Download & Copy Image Action Toolbar for Visiting Card */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-1 no-print">
                  <button
                    type="button"
                    onClick={() => handleDownloadJpg('visiting-card-front-canvas', `${memberEnglishName.replace(/\s+/g, '_')}_Visiting_Front`)}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileDown size={13} className="text-amber-400" />
                    <span>Front JPG Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadJpg('visiting-card-back-canvas', `${memberEnglishName.replace(/\s+/g, '_')}_Visiting_Back`)}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileDown size={13} className="text-amber-400" />
                    <span>Back JPG Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyImage('visiting-card-front-canvas', 'Visiting Card Front')}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
                  >
                    <Copy size={13} className="text-emerald-700" />
                    <span>Copy Front Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyImage('visiting-card-back-canvas', 'Visiting Card Back')}
                    disabled={isGeneratingJpg}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
                  >
                    <Copy size={13} className="text-emerald-700" />
                    <span>Copy Back Image</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6">
                  
                  {/* FRONT SIDE (3.5" x 2" standard proportions) - Luxury Card with Logo-Matching Colors */}
                  <div 
                    id="visiting-card-front-canvas"
                    className={`w-[360px] h-[210px] rounded-xl shadow-2xl p-4 flex flex-col justify-between relative overflow-hidden text-slate-900 border-2 ${
                      visitingCardTheme === 'emerald'
                        ? 'bg-white border-[#064e3b]'
                        : visitingCardTheme === 'navy'
                        ? 'bg-white border-indigo-900'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {/* Top Accent Stripe matching logo colors (Emerald & Gold) */}
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
                        {memberEnglishName}
                      </h3>
                      <span className="text-xs font-black text-amber-200 bg-[#064e3b] border border-amber-400/80 px-3 py-0.5 rounded-full inline-block mt-0.5 tracking-wide shadow-2xs">
                        {memberEnglishDesignation}
                      </span>
                      <span className="text-[9.5px] font-bold text-amber-800 block mt-0.5">
                        {memberEnglishCommittee}
                      </span>
                    </div>

                    {/* Contacts Footer */}
                    <div className="pt-1.5 border-t border-emerald-100 text-[8.5px] grid grid-cols-2 gap-1 text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <Phone size={11} className="text-[#047857] shrink-0" />
                        <span className="font-mono text-slate-900 font-semibold">{selectedMember?.mobile || '+977-9844000000'}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Mail size={11} className="text-[#047857] shrink-0" />
                        <span className="truncate text-slate-900">{selectedMember?.email || 'board@ratauli.org.np'}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <MapPin size={11} className="text-[#047857] shrink-0" />
                        <span className="truncate text-slate-900">Pipara-6, Mahottari</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Globe size={11} className="text-[#047857] shrink-0" />
                        <span className="text-slate-900 font-medium">www.ratauli.org.np</span>
                      </div>
                    </div>
                  </div>

                  {/* BACK SIDE - White Background matching Front with Exquisite Cooperative Design */}
                  <div 
                    id="visiting-card-back-canvas"
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

                    {/* Official Full Logo Emblem without outer circular rim */}
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
            {/* 5. MANDATE & APPOINTMENT LETTER                           */}
            {/* ========================================================= */}
            {selectedDocType === 'appointment_letter' && (
              <div className="board-appointment-sheet p-8 sm:p-12 space-y-6 text-slate-800 text-xs sm:text-sm leading-relaxed border border-slate-300 bg-white">
                
                {/* Top Reference & Date Bar */}
                <div className="flex justify-between items-center text-[11px] text-slate-700 font-mono border-b border-emerald-200/80 pb-2">
                  <span>Registration No: <strong>{registrationNo}</strong></span>
                  <span>Pan No: <strong>{panNo}</strong></span>
                </div>

                {/* Centered Official Letterhead Header (without circle around logo, prominent increased font sizes) */}
                <div className="border-b-2 border-emerald-800 pb-4 pt-2 flex items-center justify-center gap-4 sm:gap-6 text-center w-full">
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

                  <div className="flex-1 max-w-[720px]">
                    <CooperativeHeaderBrand size="2xl" />
                  </div>
                </div>

                {/* Dispatch Ref & Date Bar */}
                <div className="flex justify-between items-center text-xs font-mono text-slate-600 pt-0.5 pb-1">
                  <span>Dispatch Ref: <strong>{refNumber}</strong></span>
                  <span>Date: <strong>{issueDate}</strong></span>
                </div>

                {/* Recipient Block (Editable) */}
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-slate-500">To,</span>
                  <div 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setCustomRecipientName(e.currentTarget.textContent || '')}
                    className="font-black text-sm text-slate-900 outline-hidden focus:bg-emerald-100/40 rounded px-1 cursor-text"
                    title="Click to edit recipient name"
                  >
                    {memberEnglishName}
                  </div>
                  <div 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setCustomDesignation(e.currentTarget.textContent || '')}
                    className="font-bold text-emerald-800 outline-hidden focus:bg-emerald-100/40 rounded px-1 cursor-text"
                    title="Click to edit designation"
                  >
                    {memberEnglishDesignation}
                  </div>
                  <div 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setCustomCommittee(e.currentTarget.textContent || '')}
                    className="text-slate-600 outline-hidden focus:bg-emerald-100/40 rounded px-1 cursor-text"
                    title="Click to edit committee"
                  >
                    {memberEnglishCommittee}
                  </div>
                  <div className="text-slate-500">Pipara Rural Municipality - 6, Mahottari, Nepal</div>
                </div>

                {/* Subject Line (Editable) */}
                <div className="py-1 text-center">
                  <span 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setAppointmentSubject(e.currentTarget.textContent || '')}
                    className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide border-b-2 border-slate-900 pb-0.5 inline-block outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                    title="Click to edit subject"
                  >
                    {appointmentSubject}
                  </span>
                </div>

                {/* Formal Letter Body (Editable) */}
                <div className="space-y-3 leading-relaxed text-slate-700">
                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setAppointmentSalutation(e.currentTarget.textContent || '')}
                    className="outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                  >
                    <strong>{appointmentSalutation}</strong>
                  </p>

                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setAppointmentBody(e.currentTarget.textContent || '')}
                    className="outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                    title="Click to edit appointment intro paragraph"
                  >
                    {appointmentBody}
                  </p>

                  <p 
                    contentEditable={isLiveEditMode}
                    suppressContentEditableWarning
                    onBlur={e => setAppointmentMandateText(e.currentTarget.textContent || '')}
                    className="outline-hidden focus:bg-amber-100/40 rounded px-1 cursor-text"
                    title="Click to edit mandate paragraph"
                  >
                    {appointmentMandateText}
                  </p>

                  <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-800">
                    <li>
                      <strong>Governance & Strategy:</strong> Participating actively in Board of Directors meetings, formulating institutional policies, evaluating annual financial budgets, and driving member-centric cooperative initiatives.
                    </li>
                    <li>
                      <strong>Fiduciary Oversight:</strong> Upholding the Cooperative Act 2074, institution bylaws, credit regulations, and ensuring transparency in member savings protection and loan portfolio administration.
                    </li>
                    <li>
                      <strong>Community Representation:</strong> Championing the socioeconomic welfare of the cooperative’s community members across Mahottari district and surrounding territories.
                    </li>
                    <li>
                      <strong>Ethical Standards & Confidentiality:</strong> Maintaining strict professional confidentiality, addressing conflicts of interest, and upholding the integrity of the institution.
                    </li>
                  </ul>

                  <p>
                    The cooperative administration and staff stand ready to provide you with complete administrative assistance and resources to ensure the successful execution of your mandate.
                  </p>

                  <p>
                    We look forward to your visionary leadership and commendable service in advancing the prosperity of our members.
                  </p>
                </div>

                {/* Signatures and Acceptance Block */}
                <div className="pt-8 grid grid-cols-2 gap-8 text-xs">
                  <div className="space-y-1">
                    <div className="h-10 flex items-end">
                      <div className="w-48 border-b border-slate-700" />
                    </div>
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setSecondarySignatoryName(e.currentTarget.textContent || '')}
                      className="font-bold text-slate-900 block outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                      title="Click to edit chairperson name"
                    >
                      {secondarySignatoryName}
                    </span>
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setSecondarySignatoryTitle(e.currentTarget.textContent || '')}
                      className="text-[10px] text-slate-500 block outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                    >
                      {secondarySignatoryTitle}
                    </span>
                    <span className="text-[10px] text-emerald-800 font-semibold block">Ratauli Saving & Credit Co-operative Ltd.</span>
                  </div>

                  <div className="space-y-1 text-right">
                    <div className="h-10 flex items-end justify-end">
                      <div className="w-48 border-b border-slate-700" />
                    </div>
                    <span 
                      contentEditable={isLiveEditMode}
                      suppressContentEditableWarning
                      onBlur={e => setCustomRecipientName(e.currentTarget.textContent || '')}
                      className="font-bold text-slate-900 block outline-hidden focus:bg-amber-100/40 rounded cursor-text"
                      title="Click to edit appointee name"
                    >
                      {memberEnglishName}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Accepted by Appointee (Signature)</span>
                    <span className="text-[10px] text-slate-400 block font-mono">Date: {issueDate}</span>
                  </div>
                </div>

                {/* Footer Notice */}
                <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                  Official Institutional Document • Ratauli Saving and Credit Co-operative Limited • All Rights Reserved
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Toast Notification Banner for Copy / Download */}
      {copySuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500/50 flex items-center space-x-2.5 animate-bounce">
          <Check className="text-emerald-400 shrink-0" size={18} />
          <span className="text-xs font-bold">{copySuccessMsg}</span>
        </div>
      )}
    </div>
  );
};
