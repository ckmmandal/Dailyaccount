import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Download,
  Eye,
  Trash2,
  FileText,
  Settings,
  Plus,
  X,
  Edit,
  Save,
  RotateCcw
} from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import {
  GroupMeetingRecord,
  ProposalDecisionTemplate,
  AgendaTopicItem,
  MeetingDecisionItem,
  DEFAULT_PROPOSAL_TEMPLATES,
  meetingMinutesService
} from '../../services/meetingMinutesService';
import { MFSamuhGroup, MFMember, MFCenter, buildBsDateFromParts } from '../../services/microFinanceService';
import { Branch } from '../../types';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../../utils/dayEndLock';
import { DayEndFieldset } from '../DayEndFieldset';

interface GroupMeetingMinutesModuleProps {
  groups: MFSamuhGroup[];
  members: MFMember[];
  centers: MFCenter[];
  branches: Branch[];
  hrEmployees?: Array<{ id: string; fullName: string; employeeCode?: string; designation?: string }>;
  logoUrl?: string;
  onToast?: (msg: string) => void;
  branchId?: string;
}

const nepaliMonthsEnglish = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const toNepaliDigits = (num: number | string) => {
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).replace(/[0-9]/g, (match) => nepaliDigits[parseInt(match, 10)]);
};

export const GroupMeetingMinutesModule: React.FC<GroupMeetingMinutesModuleProps> = ({
  groups,
  members,
  centers,
  branches,
  hrEmployees = [],
  logoUrl = '/system_logo.png',
  onToast = () => {},
  branchId
}) => {
  const isDayEnded = useDayEndLock(branchId);
  // Current BS Date calculation
  const currentBsDate = useMemo(() => {
    try {
      const nep = new NepaliDate();
      const y = nep.getYear().toString();
      const m = nepaliMonthsEnglish[nep.getMonth()] || 'Kartik';
      const d = nep.getDate().toString();
      return { year: y, month: m, day: d };
    } catch {
      return { year: '2083', month: 'Kartik', day: '1' };
    }
  }, []);

  // Meetings Records
  const [meetings, setMeetings] = useState<GroupMeetingRecord[]>([]);

  // -------------------------------------------------------------
  // TOP FILTER STATE (Matching Signature Sheet layout)
  // -------------------------------------------------------------
  const [filterYear, setFilterYear] = useState(currentBsDate.year);
  const [filterMonth, setFilterMonth] = useState(currentBsDate.month);
  const [filterDay, setFilterDay] = useState(currentBsDate.day);
  const [filterCenterId, setFilterCenterId] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterEmployeeName, setFilterEmployeeName] = useState('');

  // -------------------------------------------------------------
  // RECORDS TABLE FILTERS (Right side: Year & Month)
  // -------------------------------------------------------------
  const [recordFilterYear, setRecordFilterYear] = useState('ALL');
  const [recordFilterMonth, setRecordFilterMonth] = useState('ALL');

  // -------------------------------------------------------------
  // PROPOSAL & DECISION TEMPLATES (Setting)
  // -------------------------------------------------------------
  const [templates, setTemplates] = useState<ProposalDecisionTemplate[]>([]);
  const [isTemplateSettingModalOpen, setIsTemplateSettingModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProposalDecisionTemplate | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState<Omit<ProposalDecisionTemplate, 'id'>>({
    proposalTitleNp: '',
    proposalTitleEn: '',
    defaultDiscussion: '',
    defaultDecision: '',
    defaultRecommendation: ''
  });

  // -------------------------------------------------------------
  // MEETING MINUTE PREVIEW & GENERATION MODAL
  // -------------------------------------------------------------
  const [isMinuteModalOpen, setIsMinuteModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'view'>('create');
  const [activeViewingMeeting, setActiveViewingMeeting] = useState<GroupMeetingRecord | null>(null);

  // Form State inside Minute Modal (for creating/generating)
  const [modalMeetingNo, setModalMeetingNo] = useState('');
  const [modalMeetingTime, setModalMeetingTime] = useState('07:30 AM');
  const [modalMeetingLocation, setModalMeetingLocation] = useState('');
  const [modalChairman, setModalChairman] = useState('');
  const [modalSecretary, setModalSecretary] = useState('');
  const [modalAttendance, setModalAttendance] = useState<GroupMeetingRecord['attendance']>([]);
  // Checkbox-based selection for proposal templates
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Record<string, boolean>>({});
  // Editable customization of proposals for current meeting
  const [customizedAgendas, setCustomizedAgendas] = useState<Record<string, { discussion: string; decision: string; recommendation?: string }>>({});

  // Initial Load
  const refreshMeetings = () => {
    const list = meetingMinutesService.getMeetings();
    setMeetings(list);
  };

  const loadTemplates = () => {
    const tpls = meetingMinutesService.getProposalTemplates();
    setTemplates(tpls);
  };

  useEffect(() => {
    refreshMeetings();
    loadTemplates();
  }, []);

  // Set default center, group, employee
  useEffect(() => {
    if (!filterCenterId && centers.length > 0) {
      setFilterCenterId(centers[0].id);
    }
  }, [centers, filterCenterId]);

  const filteredGroupsForTop = useMemo(() => {
    if (!filterCenterId || filterCenterId === 'ALL') return groups;
    return groups.filter(g => g.centerId === filterCenterId);
  }, [groups, filterCenterId]);

  useEffect(() => {
    if (filteredGroupsForTop.length > 0) {
      if (!filterGroupId || !filteredGroupsForTop.some(g => g.id === filterGroupId)) {
        setFilterGroupId(filteredGroupsForTop[0].id);
      }
    } else {
      setFilterGroupId('');
    }
  }, [filteredGroupsForTop, filterGroupId]);

  useEffect(() => {
    if (!filterEmployeeName && hrEmployees.length > 0) {
      setFilterEmployeeName(hrEmployees[0].fullName);
    } else if (!filterEmployeeName) {
      setFilterEmployeeName('Chandan (Field Officer)');
    }
  }, [hrEmployees, filterEmployeeName]);

  // Selected Group, Center & Members for generation
  const activeSelectedGroup = useMemo(() => {
    return groups.find(g => g.id === filterGroupId) || filteredGroupsForTop[0] || groups[0];
  }, [groups, filterGroupId, filteredGroupsForTop]);

  const activeSelectedCenter = useMemo(() => {
    return centers.find(c => c.id === filterCenterId || c.id === activeSelectedGroup?.centerId) || centers[0];
  }, [centers, filterCenterId, activeSelectedGroup]);

  const activeSelectedBranch = useMemo(() => {
    const branchName = activeSelectedCenter?.branch;
    return branches.find(b => b.name === branchName) || branches[0];
  }, [branches, activeSelectedCenter]);

  // Handle clicking Top "View" button -> Open Minute Generation Modal
  const handleOpenMinuteGenerator = () => {
    if (!activeSelectedGroup) {
      alert('कृपया पहिले समूह चयन गर्नुहोस् ।');
      return;
    }

    // Auto-generate meeting number
    const nextNo = meetingMinutesService.generateNextMeetingNumber(activeSelectedGroup.code || 'G-001');
    setModalMeetingNo(nextNo);

    // Group members for attendance
    const grpMembers = members.filter(
      m => m.samuhId === activeSelectedGroup.id || m.samuhName === activeSelectedGroup.name
    );

    const secretaryMember = grpMembers.find(m => m.role === 'Secretary');
    setModalChairman(activeSelectedGroup.leaderName || 'समूह अध्यक्ष');
    setModalSecretary(secretaryMember?.name || 'समूह सचिव');
    setModalMeetingLocation(activeSelectedGroup.place || activeSelectedCenter?.location || 'स्थानीय केन्द्र');

    const initialAttendance: GroupMeetingRecord['attendance'] = grpMembers.map(m => ({
      memberId: m.memberId,
      name: m.name,
      role: m.role || 'Member',
      savingsAccountNo: m.savingsAccountNo || '',
      mobile: m.mobile || '',
      status: 'PRESENT',
      remarks: ''
    }));
    setModalAttendance(initialAttendance);

    // Checkbox initialization: Default check first 2 templates (नियमित बचत and ऋण साँवा/किस्ता)
    const initialCheckboxes: Record<string, boolean> = {};
    const initialCustom: Record<string, { discussion: string; decision: string; recommendation?: string }> = {};

    templates.forEach((t, idx) => {
      initialCheckboxes[t.id] = idx < 2; // Checked by default
      initialCustom[t.id] = {
        discussion: t.defaultDiscussion,
        decision: t.defaultDecision,
        recommendation: t.defaultRecommendation || ''
      };
    });

    setSelectedTemplateIds(initialCheckboxes);
    setCustomizedAgendas(initialCustom);
    setModalMode('create');
    setActiveViewingMeeting(null);
    setIsMinuteModalOpen(true);
  };

  // Toggle Template Checkbox
  const handleToggleTemplateCheckbox = (templateId: string) => {
    setSelectedTemplateIds(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };

  // Select / Deselect all templates
  const handleSelectAllTemplates = (selectAll: boolean) => {
    const updated: Record<string, boolean> = {};
    templates.forEach(t => {
      updated[t.id] = selectAll;
    });
    setSelectedTemplateIds(updated);
  };

  // Handle Generate Minute Click
  const handleGenerateAndSaveMinute = async () => {
    if (isDayEndedForBranch(branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!activeSelectedGroup) return;

    // Check at least one proposal is checked
    const checkedTemplates = templates.filter(t => selectedTemplateIds[t.id]);
    if (checkedTemplates.length === 0) {
      alert('कृपया कम्तीमा एउटा प्रस्ताव तथा निर्णय छनौट (Tick) गर्नुहोस् ।');
      return;
    }

    const normalizedMeetingBs = buildBsDateFromParts(filterYear, filterMonth, filterDay);
    if (isBackDateBlockedForEntry(normalizedMeetingBs)) {
      alert(getBackDateBlockedMessage(normalizedMeetingBs));
      return;
    }

    const meetingDateBs = `${filterYear}-${filterMonth}-${filterDay}`;
    const branchName = activeSelectedCenter?.branch || activeSelectedBranch?.name || 'Ratauli Central Head Office';

    const presentCount = modalAttendance.filter(a => a.status === 'PRESENT').length;
    const absentCount = modalAttendance.filter(a => a.status === 'ABSENT').length;
    const leaveCount = modalAttendance.filter(a => a.status === 'LEAVE').length;
    const inactiveCount = modalAttendance.filter(a => a.status === 'INACTIVE').length;

    // Build Agendas from checked templates
    const selectedAgendasToSave: AgendaTopicItem[] = checkedTemplates.map((t, idx) => {
      const custom = customizedAgendas[t.id] || {
        discussion: t.defaultDiscussion,
        decision: t.defaultDecision,
        recommendation: t.defaultRecommendation
      };
      return {
        id: `ag-${Date.now()}-${idx + 1}`,
        key: t.id,
        titleNp: t.proposalTitleNp,
        titleEn: t.proposalTitleEn || t.proposalTitleNp,
        isSelected: true,
        discussion: custom.discussion,
        decision: custom.decision,
        groupRecommendation: custom.recommendation,
        records: []
      };
    });

    // Build Decisions from checked templates
    const decisionsToSave: MeetingDecisionItem[] = checkedTemplates.map((t, idx) => {
      const custom = customizedAgendas[t.id] || {
        discussion: t.defaultDiscussion,
        decision: t.defaultDecision,
        recommendation: t.defaultRecommendation
      };
      return {
        id: `dec-${Date.now()}-${idx + 1}`,
        meetingId: '',
        meetingNo: modalMeetingNo.trim(),
        groupName: activeSelectedGroup.name,
        decisionNo: `निर्णय नं. ${toNepaliDigits(idx + 1)}`,
        relatedAgenda: t.proposalTitleNp,
        subject: t.proposalTitleNp,
        decisionText: custom.decision,
        groupRecommendation: custom.recommendation || 'सर्वसम्मत पारित',
        institutionApprovalStatus: 'APPROVED',
        responsiblePerson: modalSecretary || 'समूह सचिव',
        deadlineBs: meetingDateBs,
        status: 'COMPLETED',
        remarks: 'बैठकद्वारा पारित'
      };
    });

    try {
      await meetingMinutesService.createMeeting({
        meetingNo: modalMeetingNo.trim() || `MTG-${Date.now()}`,
        groupId: activeSelectedGroup.id,
        groupName: activeSelectedGroup.name,
        groupCode: activeSelectedGroup.code || 'G-001',
        centerId: activeSelectedCenter.id,
        centerName: activeSelectedCenter.name,
        branchName,
        groupFormationDate: activeSelectedGroup.createdAt || '2080-01-15',
        groupChairperson: modalChairman,
        groupSecretary: modalSecretary,
        totalMembersCount: modalAttendance.length,

        meetingDateBs,
        meetingDateAd: new Date().toISOString().split('T')[0],
        meetingTime: modalMeetingTime,
        meetingLocation: modalMeetingLocation,
        meetingChairman: modalChairman,
        meetingSecretary: modalSecretary,
        fieldStaffName: filterEmployeeName || 'Chandan',
        meetingType: 'REGULAR',

        attendance: modalAttendance,
        presentCount,
        absentCount,
        leaveCount,
        inactiveCount,

        selectedAgendas: selectedAgendasToSave,
        decisions: decisionsToSave,

        preMeetingSummary: `बैठक प्रस्ताव संख्या: ${selectedAgendasToSave.length}`,
        actualOutcomesSummary: `उपस्थित: ${presentCount}/${modalAttendance.length} जना । निर्णयहरू पारित ।`,

        status: 'APPROVED',
        chairmanSigned: true,
        secretarySigned: true,
        fieldStaffVerified: true,
        branchManagerApproved: true
      });

      refreshMeetings();
      setIsMinuteModalOpen(false);
      onToast('माइन्युट सफलतापूर्वक सुरक्षित गरियो र Group Meetings record मा थपियो ।');
    } catch (e) {
      console.error(e);
      alert('माइन्युट सुरक्षित गर्दा त्रुटि भयो ।');
    }
  };

  // View Existing Meeting from Records table
  const handleViewExistingMeeting = (m: GroupMeetingRecord) => {
    setActiveViewingMeeting(m);
    setModalMode('view');
    setIsMinuteModalOpen(true);
  };

  // Delete Meeting Record
  const handleDeleteMeeting = async (id: string) => {
    if (isDayEndedForBranch(branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (confirm('के तपाईं यो बैठक रेकर्ड हटाउन चाहनुहुन्छ?')) {
      await meetingMinutesService.deleteMeeting(id);
      refreshMeetings();
      onToast('बैठक रेकर्ड हटाइयो ।');
    }
  };

  // Direct Clean Print
  const handlePrintDocument = () => {
    const el = document.getElementById('printable-minutes-paper');
    if (!el) {
      window.print();
      return;
    }

    try {
      let printContainer = document.getElementById('mf-direct-print-target');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'mf-direct-print-target';
        document.body.appendChild(printContainer);
      }
      printContainer.innerHTML = el.innerHTML;
      document.body.classList.add('printing-mf-sheet');

      const cleanup = () => {
        document.body.classList.remove('printing-mf-sheet');
        if (printContainer) {
          printContainer.innerHTML = '';
        }
        window.removeEventListener('afterprint', cleanup);
      };

      window.addEventListener('afterprint', cleanup);

      setTimeout(() => {
        try {
          window.print();
        } catch {
          // fallback
        } finally {
          setTimeout(cleanup, 2500);
        }
      }, 100);
    } catch {
      window.print();
    }
  };

  // Download Word
  const handleDownloadWordDoc = () => {
    const el = document.getElementById('printable-minutes-paper');
    if (!el) return;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Meeting Minutes</title>
        <style>
          body { font-family: 'Mukta', 'Inter', sans-serif; color: #000; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 10px; }
          table, th, td { border: 1px solid black; padding: 6px; font-size: 11pt; }
          th { background-color: #f2f2f2; }
          h1, h2, h3, p { margin: 4px 0; }
        </style>
      </head>
      <body>
        ${el.innerHTML}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Meeting_Minute_${activeSelectedGroup?.name || 'Group'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast('Word फाइल डाउनलोड भयो');
  };

  // Template CRUD Handlers
  const handleSaveEditedTemplate = () => {
    if (isDayEndedForBranch(branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!editingTemplate) return;
    const updated = templates.map(t => t.id === editingTemplate.id ? editingTemplate : t);
    setTemplates(updated);
    meetingMinutesService.saveProposalTemplates(updated);
    setEditingTemplate(null);
    onToast('टेम्प्लेट परिमार्जन गरियो');
  };

  const handleCreateNewTemplate = () => {
    if (isDayEndedForBranch(branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (!newTemplateForm.proposalTitleNp.trim()) {
      alert('कृपया प्रस्ताव शीर्षक प्रविष्ट गर्नुहोस् ।');
      return;
    }
    const newTpl: ProposalDecisionTemplate = {
      ...newTemplateForm,
      id: 'tpl-custom-' + Date.now(),
      isCustom: true
    };
    const updated = [...templates, newTpl];
    setTemplates(updated);
    meetingMinutesService.saveProposalTemplates(updated);
    setIsAddingTemplate(false);
    setNewTemplateForm({
      proposalTitleNp: '',
      proposalTitleEn: '',
      defaultDiscussion: '',
      defaultDecision: '',
      defaultRecommendation: ''
    });
    onToast('नयाँ प्रस्ताव तथा निर्णय टेम्प्लेट थपियो');
  };

  const handleDeleteTemplate = (id: string) => {
    if (isDayEndedForBranch(branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (confirm('के तपाईं यो टेम्प्लेट हटाउन चाहनुहुन्छ?')) {
      const updated = templates.filter(t => t.id !== id);
      setTemplates(updated);
      meetingMinutesService.saveProposalTemplates(updated);
      onToast('टेम्प्लेट हटाइयो');
    }
  };

  const handleResetTemplatesToDefault = () => {
    if (isDayEndedForBranch(branchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    if (confirm('के तपाईं सबै टेम्प्लेट पूर्वनिर्धारित (Default) अवस्थामा फर्काउन चाहनुहुन्छ?')) {
      setTemplates(DEFAULT_PROPOSAL_TEMPLATES);
      meetingMinutesService.saveProposalTemplates(DEFAULT_PROPOSAL_TEMPLATES);
      onToast('टेम्प्लेट पूर्वनिर्धारितमा रिसेट गरियो');
    }
  };

  // Filtered meetings for records table
  const filteredRecords = useMemo(() => {
    return meetings.filter(m => {
      const matchYear = recordFilterYear === 'ALL' || m.meetingDateBs.startsWith(recordFilterYear);
      const matchMonth = recordFilterMonth === 'ALL' || m.meetingDateBs.includes(recordFilterMonth);
      return matchYear && matchMonth;
    });
  }, [meetings, recordFilterYear, recordFilterMonth]);

  return (
    <div className="space-y-4">
      {/* ============================================================== */}
      {/* 1. TOP FILTER CARD: Exact Signature Sheet Layout */}
      {/* YEAR, MONTH, DAY, SELECT CENTER, SELECT GROUP, EMPLOYEE, SETTING, VIEW */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-end gap-2.5">
          {/* YEAR */}
          <div className="w-24 shrink-0">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">YEAR</label>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              <option value="2081">2081</option>
              <option value="2082">2082</option>
              <option value="2083">2083</option>
              <option value="2084">2084</option>
            </select>
          </div>

          {/* MONTH */}
          <div className="w-28 shrink-0">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">MONTH</label>
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {nepaliMonthsEnglish.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* DAY */}
          <div className="w-20 shrink-0">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">DAY</label>
            <select
              value={filterDay}
              onChange={e => setFilterDay(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {Array.from({ length: 32 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d.toString()}>{d}</option>
              ))}
            </select>
          </div>

          {/* SELECT CENTER */}
          <div className="flex-1 min-w-[130px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 truncate">SELECT CENTER</label>
            <select
              value={filterCenterId}
              onChange={e => setFilterCenterId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {centers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* SELECT GROUP */}
          <div className="flex-1 min-w-[130px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 truncate">SELECT GROUP</label>
            <select
              value={filterGroupId}
              onChange={e => setFilterGroupId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {filteredGroupsForTop.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* EMPLOYEE (Populated from HR Management) */}
          <div className="flex-1 min-w-[130px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 truncate">EMPLOYEE</label>
            <select
              value={filterEmployeeName}
              onChange={e => setFilterEmployeeName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {hrEmployees.length > 0 ? (
                hrEmployees.map(emp => (
                  <option key={emp.id} value={emp.fullName}>
                    {emp.fullName} ({emp.employeeCode || emp.designation || 'Staff'})
                  </option>
                ))
              ) : (
                <>
                  <option value="Chandan (Field Officer)">Chandan (Field Officer)</option>
                  <option value="Ramesh Sharma (Field Officer)">Ramesh Sharma (Field Officer)</option>
                </>
              )}
            </select>
          </div>

          {/* SETTING BUTTON (Replaces Digital Minutes Engine) */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsTemplateSettingModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              title="प्रस्ताव तथा निर्णय टेम्प्लेट सेटिङ"
            >
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              <span>Setting</span>
            </button>
          </div>

          {/* VIEW / SHOW BUTTON */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleOpenMinuteGenerator}
              className="px-3.5 py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              title="समूह बैठक माइन्युट तयार तथा अवलोकन गर्नुहोस्"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. GROUP MEETINGS RECORD TABLE (Replaces RECENT GROUP MEETINGS) */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Group Meetings record</span>
            </h3>
          </div>

          {/* Right side Year & Month filter + View button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Year:</label>
              <select
                value={recordFilterYear}
                onChange={e => setRecordFilterYear(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                <option value="ALL">All Years</option>
                <option value="2081">2081</option>
                <option value="2082">2082</option>
                <option value="2083">2083</option>
                <option value="2084">2084</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Month:</label>
              <select
                value={recordFilterMonth}
                onChange={e => setRecordFilterMonth(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                <option value="ALL">All Months</option>
                {nepaliMonthsEnglish.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => onToast(`फिल्टर गरिएका बैठक रेकर्डहरू: Year: ${recordFilterYear}, Month: ${recordFilterMonth}`)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#4f7df5] hover:bg-[#3b6ae8] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#0b1329] text-white font-black uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 w-12 text-center">S.N.</th>
                <th className="py-3 px-4">MEETING NO</th>
                <th className="py-3 px-4">CENTER</th>
                <th className="py-3 px-4">GROUP NAME</th>
                <th className="py-3 px-4">DATE (BS)</th>
                <th className="py-3 px-4">ATTENDANCE</th>
                <th className="py-3 px-4">AGENDAS</th>
                <th className="py-3 px-4 text-center">STATUS</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRecords.map((m, idx) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-emerald-800">{m.meetingNo}</td>
                  <td className="py-2.5 px-4 text-slate-600">{m.centerName || 'Center 01'}</td>
                  <td className="py-2.5 px-4 font-extrabold text-slate-900">{m.groupName}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">{m.meetingDateBs}</td>
                  <td className="py-2.5 px-4">
                    <span className="font-bold text-slate-800">{m.presentCount}</span>
                    <span className="text-slate-400">/{m.totalMembersCount}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      ({Math.round((m.presentCount / (m.totalMembersCount || 1)) * 100)}%)
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {m.selectedAgendas?.length || 0} विषयहरू
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      m.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleViewExistingMeeting(m)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                        title="View & Print Meeting Minute"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>View / Print</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDayEnded}
                        onClick={() => handleDeleteMeeting(m.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Meeting Record'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    कुनै बैठक रेकर्ड फेला परेन । माथिको View बटनमा क्लिक गरी नयाँ माइन्युट तयार गर्नुहोस् ।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. MODAL: TEMPLATE SETTING (प्रस्ताव तथा निर्णय टेम्प्लेट) */}
      {/* ============================================================== */}
      {isTemplateSettingModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
            {/* Header */}
            <div className="bg-[#0b1329] px-6 py-3.5 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-extrabold tracking-wide">
                  प्रस्ताव तथा निर्णय टेम्प्लेट व्यवस्थापन (Proposal &amp; Decision Templates)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTemplateSettingModalOpen(false);
                  setIsAddingTemplate(false);
                  setEditingTemplate(null);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <p className="text-xs text-slate-500 font-medium">
                  माइन्युट तयार गर्दा प्रयोग हुने नियमित प्रस्ताव, छलफल र निर्णयका पूर्वनिर्धारित ढाँचाहरू ।
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleResetTemplatesToDefault}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Reset Default'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Default</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={() => setIsAddingTemplate(true)}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Add New Template'}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ नयाँ टेम्प्लेट</span>
                  </button>
                </div>
              </div>

              {/* Add New Template Form */}
              {isAddingTemplate && (
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-emerald-900">नयाँ प्रस्ताव तथा निर्णय टेम्प्लेट थप्नुहोस्:</h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingTemplate(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      रद्द
                    </button>
                  </div>
                  <DayEndFieldset branchId={branchId} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      प्रस्ताव शीर्षक (Proposal Title) *
                    </label>
                    <input
                      type="text"
                      value={newTemplateForm.proposalTitleNp}
                      onChange={e => setNewTemplateForm({ ...newTemplateForm, proposalTitleNp: e.target.value })}
                      placeholder="e.g. प्रस्ताव नं. ११: थप कर्जा लगानी सम्बन्धमा"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        पूर्वनिर्धारित छलफल (Default Discussion)
                      </label>
                      <textarea
                        rows={3}
                        value={newTemplateForm.defaultDiscussion}
                        onChange={e => setNewTemplateForm({ ...newTemplateForm, defaultDiscussion: e.target.value })}
                        placeholder="यस प्रस्तावमाथि समूहमा भएको छलफलको विवरण..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        पूर्वनिर्धारित निर्णय (Default Decision)
                      </label>
                      <textarea
                        rows={3}
                        value={newTemplateForm.defaultDecision}
                        onChange={e => setNewTemplateForm({ ...newTemplateForm, defaultDecision: e.target.value })}
                        placeholder="पारित भएको निर्णय..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      समूह सिफारिस (Group Recommendation)
                    </label>
                    <input
                      type="text"
                      value={newTemplateForm.defaultRecommendation || ''}
                      onChange={e => setNewTemplateForm({ ...newTemplateForm, defaultRecommendation: e.target.value })}
                      placeholder="e.g. सर्वसम्मत पारित / ऋण सिफारिस स्वीकृत"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  </DayEndFieldset>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingTemplate(false)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      रद्द
                    </button>
                    <button
                      type="button"
                      disabled={isDayEnded}
                      onClick={handleCreateNewTemplate}
                      title={isDayEnded ? 'Day Ended - Action Locked' : 'Save Template'}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      टेम्प्लेट सुरक्षित गर्नुहोस्
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Template Form */}
              {editingTemplate && (
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-blue-900">टेम्प्लेट सम्पादन गर्नुहोस्:</h4>
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(null)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      रद्द
                    </button>
                  </div>
                  <DayEndFieldset branchId={branchId} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      प्रस्ताव शीर्षक
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.proposalTitleNp}
                      onChange={e => setEditingTemplate({ ...editingTemplate, proposalTitleNp: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        पूर्वनिर्धारित छलफल
                      </label>
                      <textarea
                        rows={3}
                        value={editingTemplate.defaultDiscussion}
                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultDiscussion: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        पूर्वनिर्धारित निर्णय
                      </label>
                      <textarea
                        rows={3}
                        value={editingTemplate.defaultDecision}
                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultDecision: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      समूह सिफारिस
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.defaultRecommendation || ''}
                      onChange={e => setEditingTemplate({ ...editingTemplate, defaultRecommendation: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  </DayEndFieldset>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      रद्द
                    </button>
                    <button
                      type="button"
                      disabled={isDayEnded}
                      onClick={handleSaveEditedTemplate}
                      title={isDayEnded ? 'Day Ended - Action Locked' : 'Save Changes'}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>परिमार्जन सुरक्षित गर्नुहोस्</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Templates List */}
              <div className="space-y-2">
                {templates.map((tpl, idx) => (
                  <div
                    key={tpl.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                        <strong className="text-slate-900 font-bold">{tpl.proposalTitleNp}</strong>
                      </div>
                      <div className="text-slate-600 pl-7 text-[11px] leading-relaxed">
                        <span className="font-semibold text-slate-700">छलफल:</span> {tpl.defaultDiscussion}
                      </div>
                      <div className="text-slate-700 pl-7 text-[11px] leading-relaxed">
                        <span className="font-semibold text-emerald-800">निर्णय:</span> {tpl.defaultDecision}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        disabled={isDayEnded}
                        onClick={() => setEditingTemplate(tpl)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isDayEnded ? 'Day Ended - Action Locked' : 'Edit Template'}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isDayEnded}
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isDayEnded ? 'Day Ended - Action Locked' : 'Delete Template'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTemplateSettingModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                बन्द गर्नुहोस् (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL: MEETING MINUTE PREVIEW & GENERATE (Printable Sheet) */}
      {/* ============================================================== */}
      {isMinuteModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[96vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
            {/* Action Bar Header (Clean top bar with Print & Close only per user circled screenshot) */}
            <div className="bg-[#0b1329] px-6 py-3.5 flex justify-end items-center text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDocument}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 text-xs font-bold"
                  title="Print Preview & Print"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadWordDoc}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 text-xs font-bold"
                  title="Download Word Document"
                >
                  <Download className="w-4 h-4" />
                  <span>Word (.doc)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinuteModalOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-100/60">
              {/* If in create mode: Checkbox selector for Proposal & Decision templates */}
              {modalMode === 'create' && (
                <DayEndFieldset branchId={branchId}>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        प्रस्ताव तथा निर्णयहरू छनौट गर्नुहोस् (Select Proposals &amp; Decisions):
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        टिक लगाइएका (Check गरिएका) प्रस्ताव र निर्णयहरू मात्र यस माइन्युटमा समावेश हुनेछन् ।
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleSelectAllTemplates(true)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 text-[11px] cursor-pointer"
                      >
                        सबै छनौट (Select All)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllTemplates(false)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 text-[11px] cursor-pointer"
                      >
                        खाली गर्नुहोस् (Deselect)
                      </button>
                    </div>
                  </div>

                  {/* Grid of Checkboxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {templates.map(tpl => {
                      const isChecked = !!selectedTemplateIds[tpl.id];
                      return (
                        <label
                          key={tpl.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-emerald-50/70 border-emerald-300 text-slate-900 shadow-2xs'
                              : 'bg-slate-50/80 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTemplateCheckbox(tpl.id)}
                            className="mt-0.5 w-4 h-4 accent-emerald-700 rounded cursor-pointer shrink-0"
                          />
                          <div className="space-y-0.5 text-xs">
                            <span className="font-bold leading-snug block">{tpl.proposalTitleNp}</span>
                            {isChecked && (
                              <span className="text-[10px] text-emerald-800 font-medium block">
                                ✓ निर्णय: {tpl.defaultDecision.slice(0, 50)}...
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                </DayEndFieldset>
              )}

              {/* PRINTABLE A4 MINUTES DOCUMENT */}
              <div
                id="printable-minutes-paper"
                className="bg-white rounded-xl border border-slate-300 p-6 sm:p-8 shadow-sm space-y-4 text-black font-sans max-w-3xl mx-auto"
              >
                {/* 1. Header (Equal balanced length for both Nepali & English per user request) */}
                <div className="flex items-center justify-between gap-4 pb-2 border-b-2 border-black">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    onError={e => { e.currentTarget.src = '/system_logo.png'; }}
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0"
                  />
                  <div className="flex-1 text-center space-y-0.5">
                    <div className="inline-block text-center mx-auto">
                      <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-snug whitespace-nowrap">
                        रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                      </h2>
                      <p className="text-[10.5px] sm:text-[11.5px] font-black uppercase text-black tracking-[0.065em] leading-tight whitespace-nowrap pl-[0.065em]">
                        RATAULI SAVING AND CREDIT COOPERATIVE LIMITED
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-black pt-0.5 leading-tight whitespace-nowrap">
                      {modalMode === 'view' && activeViewingMeeting
                        ? activeViewingMeeting.branchName
                        : activeSelectedCenter?.branch || 'सहोडवा सेवा केन्द्र'} • महोत्तरी
                    </p>
                    <div className="pt-1">
                      <span className="text-sm font-black uppercase tracking-wider border-2 border-black px-4 py-0.5 rounded-md inline-block">
                        समूह बैठक तथा निर्णय पुस्तिका
                      </span>
                    </div>
                  </div>
                  <div className="w-16 sm:w-20 shrink-0"></div>
                </div>

                {/* 2. Meeting Meta Info (Font size reduced, completely unbolded / normal weight, fixed 3 columns) */}
                <div className="p-2.5 bg-slate-50 border border-black rounded-lg text-[11px] font-normal text-black">
                  <table className="w-full table-fixed border-collapse border-none text-[11px] font-normal text-black">
                    <tbody>
                      <tr>
                        <td className="py-1 pr-2 w-1/3 align-top whitespace-nowrap">
                          समूहको नाम: {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.groupName : activeSelectedGroup?.name}
                        </td>
                        <td className="py-1 px-2 w-1/3 align-top whitespace-nowrap">
                          केन्द्र: {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.centerName : activeSelectedCenter?.name}
                        </td>
                        <td className="py-1 pl-2 w-1/3 align-top whitespace-nowrap">
                          बैठक नं.: {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.meetingNo : modalMeetingNo}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 w-1/3 align-top whitespace-nowrap">
                          मिति: {modalMode === 'view' && activeViewingMeeting
                            ? activeViewingMeeting.meetingDateBs
                            : `${filterYear}-${filterMonth}-${filterDay}`} BS
                        </td>
                        <td className="py-1 px-2 w-1/3 align-top whitespace-nowrap">
                          समय: {modalMode === 'create' ? (
                            <input
                              type="text"
                              disabled={isDayEnded}
                              value={modalMeetingTime}
                              onChange={e => setModalMeetingTime(e.target.value)}
                              className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-normal w-20 text-black text-center inline-block disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          ) : (
                            <span>{activeViewingMeeting?.meetingTime || '07:30 AM'}</span>
                          )}
                        </td>
                        <td className="py-1 pl-2 w-1/3 align-top whitespace-nowrap">
                          स्थान: {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.meetingLocation : modalMeetingLocation}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 w-1/3 align-top whitespace-nowrap">
                          अध्यक्ष: {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.meetingChairman : modalChairman}
                        </td>
                        <td className="py-1 px-2 w-1/3 align-top whitespace-nowrap">
                          सचिव: {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.meetingSecretary : modalSecretary}
                        </td>
                        <td className="py-1 pl-2 w-1/3 align-top whitespace-nowrap">
                          कर्मचारी: {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.fieldStaffName : filterEmployeeName}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. Attendance Table */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-black">
                    <span>उपस्थिति सदस्य</span>
                  </div>
                  <table className="w-full border-collapse border border-black text-xs text-black">
                    <thead>
                      <tr className="bg-slate-100 font-black text-[10px] uppercase border-b border-black">
                        <th className="p-1.5 border border-black text-center w-10">क्र.सं.</th>
                        <th className="p-1.5 border border-black">सदस्यको नाम</th>
                        <th className="p-1.5 border border-black text-center">सदस्य नं.</th>
                        <th className="p-1.5 border border-black text-center">पद</th>
                        <th className="p-1.5 border border-black text-center">उपस्थिति</th>
                        <th className="p-1.5 border border-black text-center w-32">हस्ताक्षर</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/30">
                      {(modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.attendance : modalAttendance).map((att, idx) => (
                        <tr key={att.memberId} className="border-b border-black/40">
                          <td className="p-1.5 border border-black text-center font-bold">{toNepaliDigits(idx + 1)}</td>
                          <td className="p-1.5 border border-black font-bold">{att.name}</td>
                          <td className="p-1.5 border border-black font-mono text-center">{att.memberId}</td>
                          <td className="p-1.5 border border-black text-center">{att.role}</td>
                          <td className="p-1.5 border border-black text-center w-28"></td>
                          <td className="p-1.5 border border-black text-center w-32"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. Proposals & Decisions (Only checked / selected ones appear) */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-black">
                    बैठकका प्रस्ताव तथा निर्णयहरू
                  </div>

                  {modalMode === 'create' ? (
                    (() => {
                      const checkedTpls = templates.filter(t => selectedTemplateIds[t.id]);
                      if (checkedTpls.length === 0) {
                        return (
                          <div className="p-4 border border-dashed border-slate-400 rounded-lg text-center text-xs text-slate-500">
                            कुनै प्रस्ताव छनौट गरिएको छैन । कृपया माथिको चेकबक्समा टिक लगाउनुहोस् ।
                          </div>
                        );
                      }
                      return checkedTpls.map((tpl, idx) => {
                        const custom = customizedAgendas[tpl.id] || {
                          discussion: tpl.defaultDiscussion,
                          decision: tpl.defaultDecision,
                          recommendation: tpl.defaultRecommendation
                        };
                        return (
                          <div key={tpl.id} className="p-3 border border-black rounded-lg space-y-1.5 text-xs">
                            <div className="font-black text-black text-sm border-b border-black pb-1">
                              प्रस्ताव नं. {toNepaliDigits(idx + 1)}: {tpl.proposalTitleNp.replace(/^प्रस्ताव नं\.\s*[^:]+:\s*/, '')}
                            </div>
                            <div>
                              <strong>छलफल:</strong> {custom.discussion}
                            </div>
                            <div>
                              <strong>निर्णय:</strong> <span className="font-black">{custom.decision}</span>
                            </div>
                            {custom.recommendation && (
                              <div className="text-[11px] italic">
                                <strong>समूह सिफारिस:</strong> {custom.recommendation}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  ) : (
                      activeViewingMeeting?.selectedAgendas?.map((ag, idx) => (
                        <div key={ag.id} className="p-3 border border-black rounded-lg space-y-1.5 text-xs">
                          <div className="font-black text-black text-sm border-b border-black pb-1">
                            प्रस्ताव नं. {toNepaliDigits(idx + 1)}: {ag.titleNp.replace(/^प्रस्ताव नं\.\s*[^:]+:\s*/, '')}
                          </div>
                          <div>
                            <strong>छलफल:</strong> {ag.discussion}
                          </div>
                          <div>
                            <strong>निर्णय:</strong> <span className="font-black">{ag.decision}</span>
                          </div>
                          {ag.groupRecommendation && (
                            <div className="text-[11px] italic">
                              <strong>समूह सिफारिस:</strong> {ag.groupRecommendation}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                </div>

                {/* 5. Signatures Footer (3 Signatures: Chairperson, Secretary, Field Staff per user request) */}
                <div className="pt-8 grid grid-cols-3 gap-8 text-center text-xs font-bold text-black">
                  <div>
                    <div className="border-t-2 border-black pt-1">
                      {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.meetingChairman : modalChairman}
                    </div>
                    <div className="text-[11px] text-slate-700">समूह अध्यक्ष</div>
                  </div>
                  <div>
                    <div className="border-t-2 border-black pt-1">
                      {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.meetingSecretary : modalSecretary}
                    </div>
                    <div className="text-[11px] text-slate-700">समूह सचिव</div>
                  </div>
                  <div>
                    <div className="border-t-2 border-black pt-1">
                      {modalMode === 'view' && activeViewingMeeting ? activeViewingMeeting.fieldStaffName : filterEmployeeName}
                    </div>
                    <div className="text-[11px] text-slate-700">फिल्ड कर्मचारी</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {modalMode === 'create'
                  ? `छनौट गरिएका प्रस्ताव संख्या: ${templates.filter(t => selectedTemplateIds[t.id]).length}`
                  : `स्थिति: ${activeViewingMeeting?.status || 'APPROVED'}`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMinuteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                {modalMode === 'create' ? (
                  <button
                    type="button"
                    disabled={isDayEnded}
                    onClick={handleGenerateAndSaveMinute}
                    title={isDayEnded ? 'Day Ended - Action Locked' : 'Generate & Save Minute'}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Generate Minute</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePrintDocument}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Sheet</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
