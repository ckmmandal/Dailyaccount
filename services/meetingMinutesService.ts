import { supabase } from './supabase';
import NepaliDate from 'nepali-date-converter';
import { assertDayNotEnded } from '../utils/dayEndLock';

export interface MeetingMemberAttendance {
  memberId: string;
  name: string;
  role: string;
  savingsAccountNo?: string;
  mobile?: string;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'INACTIVE';
  remarks?: string;
}

export interface ProposalDecisionTemplate {
  id: string;
  proposalTitleNp: string;
  proposalTitleEn?: string;
  defaultDiscussion: string;
  defaultDecision: string;
  defaultRecommendation?: string;
  isCustom?: boolean;
}

export interface AgendaTopicItem {
  id: string;
  key: string;
  titleNp: string;
  titleEn: string;
  isSelected: boolean;
  isCustom?: boolean;
  discussion?: string;
  decision?: string;
  groupRecommendation?: string;
  // Dynamic structured sub-records for members mentioned under this agenda
  records?: Array<Record<string, unknown>>;
}

export interface MeetingDecisionItem {
  id: string;
  meetingId: string;
  meetingNo: string;
  groupName: string;
  decisionNo: string; // e.g. D-01
  relatedAgenda: string;
  subject: string;
  decisionText: string;
  groupRecommendation: string;
  institutionApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  responsiblePerson: string;
  deadlineBs: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  remarks: string;
  memberId?: string;
  memberName?: string;
}

export type MeetingWorkflowStatus =
  | 'DRAFT'
  | 'READY_TO_PRINT'
  | 'MEETING_CONDUCTED'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'ARCHIVED';

export interface GroupMeetingRecord {
  id: string;
  meetingNo: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  centerId: string;
  centerName: string;
  branchName: string;
  groupFormationDate: string;
  groupChairperson: string;
  groupSecretary: string;
  totalMembersCount: number;

  meetingDateBs: string;
  meetingDateAd: string;
  meetingTime: string;
  meetingLocation: string;
  meetingChairman: string;
  meetingSecretary: string;
  fieldStaffName: string;
  fieldStaffId?: string;
  meetingType: 'REGULAR' | 'EMERGENCY' | 'SPECIAL' | 'ANNUAL';

  attendance: MeetingMemberAttendance[];
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  inactiveCount: number;

  selectedAgendas: AgendaTopicItem[];
  decisions: MeetingDecisionItem[];

  preMeetingSummary?: string;
  actualOutcomesSummary?: string;

  status: MeetingWorkflowStatus;

  // Verification & Signatures
  chairmanSigned?: boolean;
  secretarySigned?: boolean;
  fieldStaffVerified?: boolean;
  branchManagerApproved?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;

  createdAt: string;
  updatedAt: string;
}

export interface MeetingMinutesSettings {
  autoGenerateMeetingNo: boolean;
  meetingNoPrefix: string;
  defaultMeetingType: 'REGULAR' | 'EMERGENCY' | 'SPECIAL' | 'ANNUAL';
  defaultMeetingTime: string;
  requireStaffVerification: boolean;
  autoApproveDraftOnConduct: boolean;
  institutionNameNp: string;
  institutionNameEn: string;
  institutionAddressNp: string;
  institutionBranchNp: string;
  enabledAgendas: string[];
}

export const PREDEFINED_AGENDAS: Array<{ key: string; titleNp: string; titleEn: string }> = [
  { key: 'regular_savings', titleNp: '१. नियमित बचत संकलन', titleEn: '1. Regular Savings Collection' },
  { key: 'loan_payment', titleNp: '२. ऋण साँवा तथा ब्याज भुक्तानी', titleEn: '2. Loan Principal and Interest Payment' },
  { key: 'new_member', titleNp: '३. नयाँ सदस्य प्रवेश', titleEn: '3. New Member Admission' },
  { key: 'member_withdrawal', titleNp: '४. सदस्यता त्याग/फिर्ता', titleEn: '4. Member Withdrawal' },
  { key: 'member_removal', titleNp: '५. सदस्य निष्कासन', titleEn: '5. Member Removal' },
  { key: 'new_loan', titleNp: '६. नयाँ ऋण लगानी', titleEn: '6. New Loan Investment' },
  { key: 'loan_renewal', titleNp: '७. ऋण नवीकरण', titleEn: '7. Loan Renewal' },
  { key: 'additional_loan', titleNp: '८. थप ऋण माग', titleEn: '8. Additional Loan' },
  { key: 'overdue_recovery', titleNp: '९. भाखा नाघेको ऋण असुली', titleEn: '9. Overdue Loan Recovery' },
  { key: 'savings_withdrawal', titleNp: '१०. बचत फिर्ता भुक्तानी', titleEn: '10. Savings Withdrawal' },
  { key: 'committee_selection', titleNp: '११. समूह कार्यसमिति चयन/पुनर्गठन', titleEn: '11. Group Committee Selection' },
  { key: 'member_transfer', titleNp: '१२. सदस्य स्थानान्तरण', titleEn: '12. Member Transfer' },
  { key: 'group_discipline', titleNp: '१३. समूह अनुशासन तथा आचारसंहिता', titleEn: '13. Group Discipline' },
  { key: 'financial_literacy', titleNp: '१४. वित्तीय साक्षरता छलफल', titleEn: '14. Financial Literacy' },
  { key: 'business_development', titleNp: '१५. व्यवसाय प्रवर्द्धन तथा आयआर्जन', titleEn: '15. Business Development' },
  { key: 'member_complaints', titleNp: '१६. सदस्य गुनासो तथा समस्या समाधान', titleEn: '16. Member Complaints' },
  { key: 'group_restructuring', titleNp: '१७. समूह पुनर्संरचना', titleEn: '17. Group Restructuring' },
  { key: 'absent_member_discussion', titleNp: '१८. अनुपस्थित सदस्यबारे छलफल', titleEn: '18. Absent Member Discussion' },
  { key: 'loan_utilization_monitoring', titleNp: '१९. ऋण सदुपयोगिता अनुगमन', titleEn: '19. Loan Utilization Monitoring' },
  { key: 'other_matters', titleNp: '२०. विविध विषयहरू', titleEn: '20. Other Matters' },
];

const STORAGE_KEY_MEETINGS = 'mf_group_meetings_v2';
const STORAGE_KEY_SETTINGS = 'mf_meeting_settings_v2';
const STORAGE_KEY_TEMPLATES = 'mf_proposal_templates_v2';

export const DEFAULT_PROPOSAL_TEMPLATES: ProposalDecisionTemplate[] = [
  {
    id: 'tpl-1',
    proposalTitleNp: 'प्रस्ताव नं. १: नियमित बचत संकलन सम्बन्धमा',
    proposalTitleEn: 'Regular Savings Collection',
    defaultDiscussion: 'समूहका सम्पूर्ण उपस्थित सदस्यहरूबाट नियमित मासिक बचत बापत तोकिएको रकम संकलन गर्ने विषयमा छलफल गरियो ।',
    defaultDecision: 'सबै सदस्यहरूबाट नियमित बचत संकलन गरी संस्थाको बचत खातामा आजै दाखिला गर्ने निर्णय सर्वसम्मतले पारित गरियो ।',
    defaultRecommendation: 'नियमित बचत समयमै संकलन गर्न सहमति ।'
  },
  {
    id: 'tpl-2',
    proposalTitleNp: 'प्रस्ताव नं. २: ऋण साँवा तथा किस्ता भुक्तानी सम्बन्धमा',
    proposalTitleEn: 'Loan Principal and Installment Payment',
    defaultDiscussion: 'ऋणी सदस्यहरूको चालु महिनाको ऋण किस्ता तथा साँवा रकम असुली सम्बन्धमा छलफल भयो ।',
    defaultDecision: 'ऋणी सदस्यहरूबाट पाकेको किस्ता तथा साँवा रकम बुझिलिई सम्बन्धित ऋण खातामा जम्मा गर्ने निर्णय गरियो ।',
    defaultRecommendation: 'ऋण किस्ता शतप्रतिशत असुल गर्न सबैको ऐक्यबद्धता ।'
  },
  {
    id: 'tpl-3',
    proposalTitleNp: 'प्रस्ताव नं. ३: नयाँ सदस्य समूह प्रवेश सम्बन्धमा',
    proposalTitleEn: 'New Member Admission',
    defaultDiscussion: 'समूहमा आबद्ध हुन इच्छुक नयाँ सदस्यको निवेदन तथा आवश्यक कागजात रुजु गरी समूहमा समावेश गर्ने सम्बन्धमा छलफल भयो ।',
    defaultDecision: 'आवेदकको समूह नियम पालना गर्ने प्रतिबद्धता पत्र बुझी समूहमा नयाँ सदस्यका रूपमा समावेश गर्न संस्थामा सिफारिस गर्ने निर्णय गरियो ।',
    defaultRecommendation: 'समूहमा समावेश गर्न सिफारिस गर्दछौं ।'
  },
  {
    id: 'tpl-4',
    proposalTitleNp: 'प्रस्ताव नं. ४: नयाँ कर्जा लगानी तथा माग सम्बन्धमा',
    proposalTitleEn: 'New Loan Demand and Recommendation',
    defaultDiscussion: 'व्यवसाय विस्तार तथा आयआर्जन कार्यका लागि सदस्यले माग गरेको नयाँ कर्जा रकम र निजको भुक्तानी क्षमता सम्बन्धमा छलफल भयो ।',
    defaultDecision: 'माग गरिएको कर्जा रकम उपयुक्त देखिएकाले समूहको सिफारिस सहित संस्थाको कर्जा समितिमा फाइल पेश गर्ने निर्णय गरियो ।',
    defaultRecommendation: 'ऋण लगानीका लागि पूर्ण सिफारिस गर्दछौं ।'
  },
  {
    id: 'tpl-5',
    proposalTitleNp: 'प्रस्ताव नं. ५: ऋण नवीकरण सम्बन्धमा',
    proposalTitleEn: 'Loan Renewal',
    defaultDiscussion: 'म्याद पुग्न लागेको कर्जाको नियमित ब्याज चुक्ता गरी कर्जा नवीकरण गर्न सदस्यले दिएको निवेदन उपर छलफल गरियो ।',
    defaultDecision: 'नियम अनुसार लाग्ने शुल्क र ब्याज चुक्ता गरी कर्जा नवीकरणका लागि संस्थामा सिफारिस गर्ने निर्णय गरियो ।',
    defaultRecommendation: 'कर्जा नवीकरण गर्न सहमति ।'
  },
  {
    id: 'tpl-6',
    proposalTitleNp: 'प्रस्ताव नं. ६: भाखा नाघेको ऋण असुली सम्बन्धमा',
    proposalTitleEn: 'Overdue Loan Recovery',
    defaultDiscussion: 'भाखा नाघेको ऋण बाँकी रहेका सदस्यहरूलाई सम्पर्क गरी समयमै चुक्ता गराउने बारे समूहगत छलफल गरियो ।',
    defaultDecision: 'भाखा नाघेका ऋणी सदस्यलाई समूह प्रतिनिधि र फिल्ड कर्मचारीले भेट गरी तत्काल बक्यौता चुक्ता गर्न ताकेता गर्ने निर्णय गरियो ।',
    defaultRecommendation: 'शीघ्र असुलीका लागि समूहले सहयोग गर्ने ।'
  },
  {
    id: 'tpl-7',
    proposalTitleNp: 'प्रस्ताव नं. ७: ऐच्छिक/विशेष बचत फिर्ता सम्बन्धमा',
    proposalTitleEn: 'Savings Withdrawal',
    defaultDiscussion: 'सदस्यको आवश्यक घरायसी कामका लागि जम्मा रहेको ऐच्छिक बचत रकम फिर्ता भुक्तानी सम्बन्धमा छलफल भयो ।',
    defaultDecision: 'सदस्यको खातामा मौज्दात रकम यकिन गरी माग बमोजिम बचत फिर्ता भुक्तानीका लागि संस्थामा सिफारिस गर्ने निर्णय गरियो ।',
    defaultRecommendation: 'बचत फिर्ता भुक्तानी गर्न सिफारिस ।'
  },
  {
    id: 'tpl-8',
    proposalTitleNp: 'प्रस्ताव नं. ८: वित्तीय साक्षरता तथा अनुशासन सम्बन्धमा',
    proposalTitleEn: 'Financial Literacy and Group Discipline',
    defaultDiscussion: 'सदस्यहरू बीच पारिवारिक बजेट व्यवस्थापन, अनावश्यक खर्च नियन्त्रण र समूह बैठक अनुशासन सम्बन्धी छलफल गरियो ।',
    defaultDecision: 'प्रत्येक सदस्यले मासिक आयव्यय हिसाब दुरुस्त राख्ने तथा समूहका नियमहरू पूर्ण रूपमा पालना गर्ने निर्णय गरियो ।',
    defaultRecommendation: 'नियमित उपस्थित हुन सबै सदस्यलाई अनुरोध ।'
  },
  {
    id: 'tpl-9',
    proposalTitleNp: 'प्रस्ताव नं. ९: ऋण सदुपयोगिता अनुगमन सम्बन्धमा',
    proposalTitleEn: 'Loan Utilization Monitoring',
    defaultDiscussion: 'संस्थाबाट कर्जा लिएका सदस्यहरूको व्यवसाय तथा परियोजनाको स्थलगत अनुगमन सम्बन्धमा छलफल भयो ।',
    defaultDecision: 'कर्जा सदुपयोग भएको पाइएकाले सदस्यको प्रगतिमा सन्तोष व्यक्त गरियो र थप उत्पादनमूलक काममा लगाउन सुझाव दिने निर्णय गरियो ।',
    defaultRecommendation: 'सदुपयोगिता सन्तोषजनक रहेको व्यहोरा प्रमाणित गरिन्छ ।'
  },
  {
    id: 'tpl-10',
    proposalTitleNp: 'प्रस्ताव नं. १०: विविध विषयहरू',
    proposalTitleEn: 'Miscellaneous Topics',
    defaultDiscussion: 'आगामी बैठकको मिति, समय र स्थान तय गर्ने तथा समसामयिक विषयमा छलफल गरियो ।',
    defaultDecision: 'आगामी महिनाको बैठक तोकिएको मिति र समयमा समूह केन्द्रमै बस्ने गरी निर्णय गरियो ।',
    defaultRecommendation: 'आगामी बैठकमा सबै सदस्य अनिवार्य उपस्थित हुने ।'
  }
];

export const DEFAULT_MEETING_SETTINGS: MeetingMinutesSettings = {
  autoGenerateMeetingNo: true,
  meetingNoPrefix: 'MTG-',
  defaultMeetingType: 'REGULAR',
  defaultMeetingTime: '07:30 AM',
  requireStaffVerification: true,
  autoApproveDraftOnConduct: false,
  institutionNameNp: 'रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड',
  institutionNameEn: 'RATAULI SAVING AND CREDIT COOPERATIVE LTD',
  institutionAddressNp: 'पिपरा गाँउपालिका-६, महोत्तरी',
  institutionBranchNp: 'सहोडवा सेवा केन्द्र',
  enabledAgendas: PREDEFINED_AGENDAS.map(a => a.key),
};

const SAMPLE_INITIAL_MEETINGS: GroupMeetingRecord[] = [
  {
    id: 'mtg-101',
    meetingNo: 'MTG-2083-001',
    groupId: 'grp-1',
    groupName: 'Laxmi Mahila Samuh',
    groupCode: 'G-001',
    centerId: 'c-1',
    centerName: 'Center 01 (Janaki Chowk)',
    branchName: 'Ratauli Central Head Office',
    groupFormationDate: '2080-01-15',
    groupChairperson: 'Sita Devi Chaudhary',
    groupSecretary: 'Geeta Kumari Mandal',
    totalMembersCount: 4,
    meetingDateBs: '2083-07-25',
    meetingDateAd: '2026-11-10',
    meetingTime: '07:30 AM',
    meetingLocation: 'जानकी चोक, रतौली',
    meetingChairman: 'Sita Devi Chaudhary',
    meetingSecretary: 'Geeta Kumari Mandal',
    fieldStaffName: 'Chandan',
    fieldStaffId: 'EMP-01',
    meetingType: 'REGULAR',
    attendance: [
      { memberId: 'M-1001', name: 'Sita Devi Chaudhary', role: 'Leader', status: 'PRESENT', savingsAccountNo: 'SAV-001' },
      { memberId: 'M-1002', name: 'Geeta Kumari Mandal', role: 'Secretary', status: 'PRESENT', savingsAccountNo: 'SAV-002' },
      { memberId: 'M-1003', name: 'Sunita Devi Yadav', role: 'Member', status: 'PRESENT', savingsAccountNo: 'SAV-003' },
      { memberId: 'M-1004', name: 'Anita Kumari Sah', role: 'Member', status: 'LEAVE', remarks: 'स्वास्थ्य समस्या', savingsAccountNo: 'SAV-004' }
    ],
    presentCount: 3,
    absentCount: 0,
    leaveCount: 1,
    inactiveCount: 0,
    selectedAgendas: [
      {
        id: 'ag-1',
        key: 'regular_savings',
        titleNp: '१. नियमित बचत संकलन',
        titleEn: '1. Regular Savings Collection',
        isSelected: true,
        discussion: 'उपस्थित ३ जना सदस्यहरूबाट जनही रु. १,००० का दरले जम्मा रु. ३,००० नियमित बचत संकलन गरियो ।',
        decision: 'संकलित रकम संस्थाको सम्बन्धित बचत खातामा आजै दाखिला गर्ने निर्णय गरियो ।',
        groupRecommendation: 'नियमित बचत समयमै संकलन गर्न सहमति ।'
      },
      {
        id: 'ag-2',
        key: 'new_loan',
        titleNp: '६. नयाँ ऋण लगानी',
        titleEn: '6. New Loan Investment',
        isSelected: true,
        discussion: 'सदस्य सीता देवी चौधरीले किराना पसल विस्तारका लागि रु. ६०,००० थप ऋण माग गर्नुभएकोमा छलफल गरियो ।',
        decision: 'समूहको तर्फबाट सिफारिस गरी संस्थामा ऋण स्वीकृतिका लागि पेश गर्ने निर्णय गरियो ।',
        groupRecommendation: 'सदस्यको आर्थिक कारोबार नियमित रहेकोले पूर्ण सिफारिस गर्दछौं ।',
        records: [
          {
            memberName: 'Sita Devi Chaudhary',
            memberNo: 'M-1001',
            requestedAmount: 60000,
            purpose: 'किराना पसल विस्तार',
            repaymentCapacity: 'राम्रो (मासिक आय रु. ३५,०००)',
            groupRecommendation: 'ऋण सिफारिस स्वीकृत',
            decision: 'संस्थामा फाइल पठाउने'
          }
        ]
      },
      {
        id: 'ag-3',
        key: 'financial_literacy',
        titleNp: '१४. वित्तीय साक्षरता छलफल',
        titleEn: '14. Financial Literacy',
        isSelected: true,
        discussion: 'क्षेत्रीय कर्मचारी चन्दनद्वारा डिजिटल कारोबार तथा मासिक पारिवारिक बजेट व्यवस्थापनबारे अभिमुखीकरण प्रदान गरियो ।',
        decision: 'प्रत्येक सदस्यले अनिवार्य रूपमा आम्दानी र खर्चको विवरण डायरीमा राख्ने ।',
        groupRecommendation: 'आगामी बैठकमा पनि यस्तै जानकारी निरन्तर गर्ने ।'
      }
    ],
    decisions: [
      {
        id: 'dec-1',
        meetingId: 'mtg-101',
        meetingNo: 'MTG-2083-001',
        groupName: 'Laxmi Mahila Samuh',
        decisionNo: 'निर्णय नं. १',
        relatedAgenda: 'नियमित बचत संकलन',
        subject: 'बचत संकलन तथा दाखिला',
        decisionText: 'संकलित रु. ३,००० बचत रकम संस्थाको खातामा दाखिला गर्ने ।',
        groupRecommendation: 'सर्वसम्मत पारित',
        institutionApprovalStatus: 'APPROVED',
        responsiblePerson: 'Geeta Kumari Mandal (सचिव)',
        deadlineBs: '2083-07-25',
        status: 'COMPLETED',
        remarks: 'दाखिला सम्पन्न'
      },
      {
        id: 'dec-2',
        meetingId: 'mtg-101',
        meetingNo: 'MTG-2083-001',
        groupName: 'Laxmi Mahila Samuh',
        decisionNo: 'निर्णय नं. २',
        relatedAgenda: 'नयाँ ऋण लगानी',
        subject: 'सीता देवी चौधरीको लघुव्यवसाय ऋण सिफारिस',
        decisionText: 'रु. ६०,००० ऋण लगानीका लागि संस्थाको कर्जा समितिमा सिफारिस गर्ने ।',
        groupRecommendation: 'शतप्रतिशत सिफारिस',
        institutionApprovalStatus: 'PENDING',
        responsiblePerson: 'Chandan (फिल्ड कर्मचारी)',
        deadlineBs: '2083-07-28',
        status: 'IN_PROGRESS',
        remarks: 'शाखामा फाइल पेश'
      }
    ],
    preMeetingSummary: 'बैठक पूर्व प्रस्ताव तयारी सम्पन्न । एजेन्डा: बचत संकलन, ऋण माग र वित्तीय साक्षरता ।',
    actualOutcomesSummary: '३ जना उपस्थित, १ जना बिदामा । रु. ३,००० बचत संकलन, १ वटा ऋण माग सिफारिस ।',
    status: 'APPROVED',
    chairmanSigned: true,
    secretarySigned: true,
    fieldStaffVerified: true,
    branchManagerApproved: true,
    verifiedAt: '2083-07-25',
    verifiedBy: 'Chandan / Branch Manager',
    createdAt: '2083-07-25',
    updatedAt: '2083-07-25'
  },
  {
    id: 'mtg-102',
    meetingNo: 'MTG-2083-002',
    groupId: 'grp-2',
    groupName: 'Radha Krishna Mahila Samuh',
    groupCode: 'G-002',
    centerId: 'c-1',
    centerName: 'Center 01 (Janaki Chowk)',
    branchName: 'Ratauli Central Head Office',
    groupFormationDate: '2080-03-20',
    groupChairperson: 'Parwati Devi Yadav',
    groupSecretary: 'Sunita Kumari Sah',
    totalMembersCount: 4,
    meetingDateBs: '2083-08-01',
    meetingDateAd: '2026-11-16',
    meetingTime: '08:00 AM',
    meetingLocation: 'राधा कृष्ण मन्दिर प्रांगण, जानकी चोक',
    meetingChairman: 'Parwati Devi Yadav',
    meetingSecretary: 'Sunita Kumari Sah',
    fieldStaffName: 'Chandan',
    fieldStaffId: 'EMP-01',
    meetingType: 'REGULAR',
    attendance: [
      { memberId: 'M-1005', name: 'Parwati Devi Yadav', role: 'Leader', status: 'PRESENT' },
      { memberId: 'M-1006', name: 'Sunita Kumari Sah', role: 'Secretary', status: 'PRESENT' },
      { memberId: 'M-1007', name: 'Manju Devi Mandal', role: 'Member', status: 'PRESENT' },
      { memberId: 'M-1008', name: 'Kavita Kumari Das', role: 'Member', status: 'PRESENT' }
    ],
    presentCount: 4,
    absentCount: 0,
    leaveCount: 0,
    inactiveCount: 0,
    selectedAgendas: [
      {
        id: 'ag-201',
        key: 'regular_savings',
        titleNp: '१. नियमित बचत संकलन',
        titleEn: '1. Regular Savings Collection',
        isSelected: true,
        discussion: 'चारै जना सदस्यको नियमित बचत संकलन गर्ने कार्यतालिका बनाइएको छ ।',
        decision: 'मासिक रु. १,००० का दरले रु. ४,००० संकलन गर्ने ।'
      },
      {
        id: 'ag-202',
        key: 'new_member',
        titleNp: '३. नयाँ सदस्य प्रवेश',
        titleEn: '3. New Member Admission',
        isSelected: true,
        discussion: 'स्थानीय रीता देवी दासले समूहमा आबद्ध हुन निवेदन दिनुभएकोले छलफल गरिनेछ ।',
        decision: 'सहमति भएमा आगामी महिनाबाट बचत सुरू गराउने ।',
        records: [
          {
            memberName: 'Rita Devi Das',
            address: 'पिपरा-६, महोत्तरी',
            contactNo: '9812345678',
            reason: 'नियमित बचत र महिला सशक्तिकरण',
            groupRecommendation: 'स्वीकार्य',
            decision: 'आगामी बैठकमा औपचारिकता पूरा गर्ने'
          }
        ]
      }
    ],
    decisions: [
      {
        id: 'dec-201',
        meetingId: 'mtg-102',
        meetingNo: 'MTG-2083-002',
        groupName: 'Radha Krishna Mahila Samuh',
        decisionNo: 'निर्णय नं. १',
        relatedAgenda: 'नयाँ सदस्य प्रवेश',
        subject: 'रीता देवी दासको सदस्यता आवेदन',
        decisionText: 'कागजात रुजु गरी समूहमा समावेश गर्ने प्रक्रिया अघि बढाउने ।',
        groupRecommendation: 'सर्वसम्मत',
        institutionApprovalStatus: 'PENDING',
        responsiblePerson: 'Sunita Kumari Sah (सचिव)',
        deadlineBs: '2083-08-05',
        status: 'PENDING',
        remarks: 'कागजात संकलन बाँकी'
      }
    ],
    preMeetingSummary: 'फिल्ड भ्रमण पूर्व माइन्युट ड्राफ्ट तयार । प्रिन्ट गरी बैठकमा लैजान योग्य ।',
    status: 'READY_TO_PRINT',
    createdAt: '2083-07-28',
    updatedAt: '2083-07-28'
  }
];

export const meetingMinutesService = {
  // Meetings CRUD
  getMeetings: (): GroupMeetingRecord[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_MEETINGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading meetings from storage:', e);
    }
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(SAMPLE_INITIAL_MEETINGS));
    return SAMPLE_INITIAL_MEETINGS;
  },

  saveMeetings: (meetings: GroupMeetingRecord[]): void => {
    assertDayNotEnded();
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(meetings));
  },

  getMeetingById: (id: string): GroupMeetingRecord | null => {
    const list = meetingMinutesService.getMeetings();
    return list.find(m => m.id === id) || null;
  },

  createMeeting: async (meeting: Omit<GroupMeetingRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<GroupMeetingRecord> => {
    assertDayNotEnded();
    const list = meetingMinutesService.getMeetings();
    const nowBs = (() => {
      try {
        return new NepaliDate().format('YYYY-MM-DD');
      } catch {
        return '2083-08-01';
      }
    })();

    const newMeeting: GroupMeetingRecord = {
      ...meeting,
      id: 'mtg-' + Date.now(),
      createdAt: nowBs,
      updatedAt: nowBs
    };

    const updated = [newMeeting, ...list];
    meetingMinutesService.saveMeetings(updated);

    // Sync to Supabase in background
    try {
      await supabase.from('group_meetings').upsert([{
        id: newMeeting.id,
        meeting_no: newMeeting.meetingNo,
        group_id: newMeeting.groupId,
        group_name: newMeeting.groupName,
        meeting_date_bs: newMeeting.meetingDateBs,
        status: newMeeting.status,
        payload: newMeeting,
        updated_at: new Date().toISOString()
      }], { onConflict: 'id' });
    } catch {
      // Supabase is optional/graceful fallback
    }

    return newMeeting;
  },

  updateMeeting: async (id: string, updates: Partial<GroupMeetingRecord>): Promise<GroupMeetingRecord> => {
    assertDayNotEnded();
    const list = meetingMinutesService.getMeetings();
    const nowBs = (() => {
      try {
        return new NepaliDate().format('YYYY-MM-DD');
      } catch {
        return '2083-08-01';
      }
    })();

    let updatedRecord: GroupMeetingRecord | null = null;
    const updated = list.map(item => {
      if (item.id === id) {
        updatedRecord = {
          ...item,
          ...updates,
          updatedAt: nowBs
        };
        return updatedRecord;
      }
      return item;
    });

    meetingMinutesService.saveMeetings(updated);

    // Sync to Supabase via upsert so local-created items also persist
    if (updatedRecord) {
      const rec = updatedRecord as GroupMeetingRecord;
      try {
        await supabase.from('group_meetings').upsert([{
          id: rec.id,
          meeting_no: rec.meetingNo,
          group_id: rec.groupId,
          group_name: rec.groupName,
          meeting_date_bs: rec.meetingDateBs,
          status: rec.status,
          payload: rec,
          updated_at: new Date().toISOString()
        }], { onConflict: 'id' });
      } catch {
        // graceful
      }
      return rec;
    }
    throw new Error('Meeting not found: ' + id);
  },

  deleteMeeting: async (id: string): Promise<boolean> => {
    assertDayNotEnded();
    const list = meetingMinutesService.getMeetings();
    const filtered = list.filter(m => m.id !== id);
    meetingMinutesService.saveMeetings(filtered);

    try {
      await supabase.from('group_meetings').delete().eq('id', id);
    } catch {
      // graceful
    }
    return true;
  },

  // Decisions list
  getAllDecisions: (): MeetingDecisionItem[] => {
    const meetings = meetingMinutesService.getMeetings();
    const allDecisions: MeetingDecisionItem[] = [];
    meetings.forEach(m => {
      if (Array.isArray(m.decisions)) {
        m.decisions.forEach(d => {
          allDecisions.push({
            ...d,
            meetingId: m.id,
            meetingNo: m.meetingNo,
            groupName: m.groupName
          });
        });
      }
    });
    return allDecisions;
  },

  updateDecisionStatus: async (
    meetingId: string,
    decisionId: string,
    newStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED',
    remarks?: string
  ): Promise<void> => {
    assertDayNotEnded();
    const meeting = meetingMinutesService.getMeetingById(meetingId);
    if (!meeting) return;

    const updatedDecisions = (meeting.decisions || []).map(d => {
      if (d.id === decisionId) {
        return {
          ...d,
          status: newStatus,
          remarks: remarks !== undefined ? remarks : d.remarks
        };
      }
      return d;
    });

    await meetingMinutesService.updateMeeting(meetingId, { decisions: updatedDecisions });
  },

  // Settings
  getSettings: (): MeetingMinutesSettings => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (data) {
        return { ...DEFAULT_MEETING_SETTINGS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Error reading meeting settings:', e);
    }
    return DEFAULT_MEETING_SETTINGS;
  },

  saveSettings: (settings: MeetingMinutesSettings): void => {
    assertDayNotEnded();
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    try {
      void supabase.from('mf_settings').upsert({
        id: 'mf_meeting_settings',
        data: settings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch {
      // graceful
    }
  },

  // Proposal & Decision Templates Management
  getProposalTemplates: (): ProposalDecisionTemplate[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_TEMPLATES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading proposal templates:', e);
    }
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(DEFAULT_PROPOSAL_TEMPLATES));
    return DEFAULT_PROPOSAL_TEMPLATES;
  },

  saveProposalTemplates: (templates: ProposalDecisionTemplate[]): void => {
    assertDayNotEnded();
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
    try {
      void supabase.from('mf_settings').upsert({
        id: 'mf_proposal_templates',
        data: { templates },
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch {
      // graceful
    }
  },

  fetchAllFromSupabase: async (): Promise<{
    meetings: GroupMeetingRecord[];
    settings: MeetingMinutesSettings;
    templates: ProposalDecisionTemplate[];
  }> => {
    const localMeetings = meetingMinutesService.getMeetings();
    const localSettings = meetingMinutesService.getSettings();
    const localTemplates = meetingMinutesService.getProposalTemplates();

    try {
      const [mtgRes, setRes, tplRes] = await Promise.all([
        supabase.from('group_meetings').select('payload').order('created_at', { ascending: false }),
        supabase.from('mf_settings').select('data').eq('id', 'mf_meeting_settings').maybeSingle(),
        supabase.from('mf_settings').select('data').eq('id', 'mf_proposal_templates').maybeSingle()
      ]);

      let meetings = localMeetings;
      if (!mtgRes.error && Array.isArray(mtgRes.data)) {
        const remoteList = mtgRes.data
          .map((r: { payload?: GroupMeetingRecord }) => r.payload)
          .filter((p): p is GroupMeetingRecord => Boolean(p && p.id));
        if (remoteList.length > 0) {
          meetings = remoteList;
          localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(meetings));
        } else if (localMeetings.length > 0) {
          void supabase.from('group_meetings').upsert(
            localMeetings.map(m => ({
              id: m.id,
              meeting_no: m.meetingNo,
              group_id: m.groupId,
              group_name: m.groupName,
              meeting_date_bs: m.meetingDateBs,
              status: m.status,
              payload: m,
              updated_at: new Date().toISOString()
            })),
            { onConflict: 'id' }
          );
        }
      }

      let settings = localSettings;
      if (!setRes.error && setRes.data?.data) {
        settings = { ...DEFAULT_MEETING_SETTINGS, ...(setRes.data.data as Partial<MeetingMinutesSettings>) };
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
      }

      let templates = localTemplates;
      const tplData = tplRes.data?.data as { templates?: ProposalDecisionTemplate[] } | undefined;
      if (!tplRes.error && Array.isArray(tplData?.templates) && tplData.templates.length > 0) {
        templates = tplData.templates;
        localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
      }

      return { meetings, settings, templates };
    } catch {
      return { meetings: localMeetings, settings: localSettings, templates: localTemplates };
    }
  },

  generateNextMeetingNumber: (groupCode: string): string => {
    const meetings = meetingMinutesService.getMeetings();
    const thisYear = (() => {
      try {
        return new NepaliDate().format('YYYY');
      } catch {
        return '2083';
      }
    })();
    const count = meetings.filter(m => m.groupCode === groupCode || m.meetingNo.includes(thisYear)).length + 1;
    const padded = String(count).padStart(3, '0');
    return `MTG-${thisYear}-${padded}`;
  }
};
