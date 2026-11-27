import type { Branch } from '../types';
import type {
  MFCenter,
  MFSamuhGroup,
  MFMember,
  MFSavingsRecord,
  MFLoanRecord,
  MFCollectionSheet,
  MFSignatureSheet
} from '../services/microFinanceService';
import type { GroupMeetingRecord } from '../services/meetingMinutesService';

export const MF_BRANCH_SCOPE_PREFIX = 'mf_branch_scope:';
export const MF_BRANCH_SCOPE_ALL = 'mf_branch_scope:all';

export const INS_BRANCH_SCOPE_PREFIX = 'ins_branch_scope:';
export const INS_BRANCH_SCOPE_ALL = 'ins_branch_scope:all';
export const INS_BRANCH_SCOPE_LOGIN_ONLY = 'ins_branch_scope:login_only';

export type UserMfBranchAccessMode = 'login_only' | 'all' | 'selected';
export type UserInsBranchOverrideMode = 'inherit_role' | 'login_only' | 'all' | 'selected';

export interface UserMfBranchAccess {
  mode: UserMfBranchAccessMode;
  /** Empty array when mode === 'all' (unrestricted). Otherwise canonical branch keys allowed for viewing. */
  allowedBranchKeys: string[];
  /** Selected branch keys explicitly stored on user (excluding implicit login branch fallback). */
  explicitBranchKeys: string[];
  /** True if user can view more than just their own logged-in branch (shows branch filter dropdown). */
  canSwitchViewBranch: boolean;
}

const normalizeText = (val?: string | null): string =>
  String(val || '').replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeId = (val?: string | null): string =>
  String(val || '').replace(/\s+/g, '').trim().toLowerCase();

const stripLeadingZeros = (val?: string | null): string =>
  normalizeId(val).replace(/^0+(?=\d)/, '');

/**
 * Resolves any branch identifier (id, code, display name, numeric legacy code, uppercase/lowercase variant)
 * to a canonical branch key (e.g. 'main', 'pipra', 'sahodba', 'parsa').
 */
export const resolveCanonicalBranchKey = (
  raw?: string | number | null,
  branches: Branch[] = []
): string => {
  const norm = normalizeText(raw !== undefined && raw !== null ? String(raw) : '');
  if (!norm || norm === 'select branch') return '';

  // 1. Direct or partial match against configured branches
  if (Array.isArray(branches) && branches.length > 0) {
    const exactMatch = branches.find(b => {
      if (!b) return false;
      const bId = normalizeText(b.id);
      const bCode = normalizeText(b.code);
      const bName = normalizeText(b.name);
      return norm === bId || (bCode !== '' && norm === bCode) || norm === bName;
    });
    if (exactMatch) return normalizeText(exactMatch.id);

    const partialMatch = branches.find(b => {
      if (!b) return false;
      const bId = normalizeText(b.id);
      const bName = normalizeText(b.name);
      if (bId && bId !== 'main' && norm.includes(bId)) return true;
      if (bName && (norm.includes(bName) || bName.includes(norm))) return true;
      return false;
    });
    if (partialMatch) return normalizeText(partialMatch.id);
  }

  // 2. Known cooperative branch aliases (handles numeric legacy IDs 1-4 and uppercase/display strings)
  if (norm === '2' || norm === 'sahodba' || norm === 'c02' || norm.includes('sahodba')) return 'sahodba';
  if (norm === '3' || norm === 'pipra' || norm === 'c03' || norm.includes('pipra')) return 'pipra';
  if (norm === '4' || norm === 'parsa' || norm === 'c04' || norm.includes('parsa')) return 'parsa';
  if (
    norm === '1' ||
    norm === 'main' ||
    norm === 'c01' ||
    norm.includes('ratauli') ||
    norm.includes('head office') ||
    norm.includes('central')
  ) {
    return 'main';
  }

  return norm;
};

/**
 * Finds the Branch object matching any raw branch name/id/code (case-insensitive & alias-aware).
 */
export const findMatchingBranch = (
  raw: string | undefined | null,
  branches: Branch[] = []
): Branch | undefined => {
  if (!Array.isArray(branches) || branches.length === 0) return undefined;
  const targetKey = resolveCanonicalBranchKey(raw, branches);
  if (!targetKey) return undefined;
  return branches.find(
    b =>
      resolveCanonicalBranchKey(b.id, branches) === targetKey ||
      resolveCanonicalBranchKey(b.name, branches) === targetKey
  );
};

/**
 * Parses designated per-user (or role) Micro-Finance branch access tokens stored in permissions.
 * - No token => 'login_only' (strictly logged-in branch)
 * - 'mf_branch_scope:all' => 'all' (can view all branches across all MF sub-menus)
 * - 'mf_branch_scope:<branchKey>' => 'selected' (can view explicitly selected branches + own login branch)
 */
export const parseUserMfBranchAccess = (
  userPermissions?: string[] | null,
  rolePermissions?: string[] | null,
  loggedInBranchKey?: string,
  branches: Branch[] = []
): UserMfBranchAccess => {
  const combined = [
    ...(Array.isArray(userPermissions) ? userPermissions : []),
    ...(Array.isArray(rolePermissions) ? rolePermissions : [])
  ].filter((p): p is string => typeof p === 'string');

  const scopeTokens = combined
    .filter(p => p.toLowerCase().startsWith(MF_BRANCH_SCOPE_PREFIX))
    .map(p => p.slice(MF_BRANCH_SCOPE_PREFIX.length).trim().toLowerCase())
    .filter(Boolean);

  const normalizedLoginKey = resolveCanonicalBranchKey(loggedInBranchKey, branches);

  if (scopeTokens.includes('all')) {
    return {
      mode: 'all',
      allowedBranchKeys: [],
      explicitBranchKeys: [],
      canSwitchViewBranch: true
    };
  }

  const explicitKeys = Array.from(
    new Set(
      scopeTokens
        .map(tok => resolveCanonicalBranchKey(tok, branches))
        .filter(Boolean)
    )
  );

  if (explicitKeys.length > 0) {
    const allowedSet = new Set<string>(explicitKeys);
    if (normalizedLoginKey) allowedSet.add(normalizedLoginKey);
    const allowedBranchKeys = Array.from(allowedSet);
    return {
      mode: 'selected',
      allowedBranchKeys,
      explicitBranchKeys: explicitKeys,
      canSwitchViewBranch:
        allowedBranchKeys.length > 1 ||
        (allowedBranchKeys.length === 1 && allowedBranchKeys[0] !== normalizedLoginKey)
    };
  }

  return {
    mode: 'login_only',
    allowedBranchKeys: normalizedLoginKey ? [normalizedLoginKey] : [],
    explicitBranchKeys: [],
    canSwitchViewBranch: false
  };
};

/**
 * Updates a user's permissions array with the chosen Micro-Finance branch access mode
 * while preserving all unrelated permissions untouched.
 */
export const applyUserMfBranchAccessToPermissions = (
  existingPermissions: string[] | undefined | null,
  mode: UserMfBranchAccessMode,
  selectedBranchIds: string[] = [],
  branches: Branch[] = []
): string[] => {
  const cleaned = (Array.isArray(existingPermissions) ? existingPermissions : []).filter(
    p => typeof p === 'string' && !p.toLowerCase().startsWith(MF_BRANCH_SCOPE_PREFIX)
  );

  if (mode === 'all') {
    return [...cleaned, MF_BRANCH_SCOPE_ALL];
  }

  if (mode === 'selected') {
    const canonicalKeys = Array.from(
      new Set(
        selectedBranchIds
          .map(id => resolveCanonicalBranchKey(id, branches))
          .filter(Boolean)
      )
    );
    if (canonicalKeys.length === 0) return cleaned;
    return [...cleaned, ...canonicalKeys.map(k => `${MF_BRANCH_SCOPE_PREFIX}${k}`)];
  }

  return cleaned;
};

/**
 * Short display badge summary for User Management table (returns null for default login-only users).
 */
export const getMfBranchAccessSummary = (
  userPermissions?: string[] | null,
  branches: Branch[] = []
): { label: string; isAll: boolean } | null => {
  const parsed = parseUserMfBranchAccess(userPermissions, [], undefined, branches);
  if (parsed.mode === 'all') {
    return { label: 'MF: All Branches', isAll: true };
  }
  if (parsed.mode === 'selected' && parsed.explicitBranchKeys.length > 0) {
    if (parsed.explicitBranchKeys.length === 1) {
      const b = findMatchingBranch(parsed.explicitBranchKeys[0], branches);
      return { label: `MF: ${b?.name || parsed.explicitBranchKeys[0]}`, isAll: false };
    }
    return { label: `MF: ${parsed.explicitBranchKeys.length} Branches`, isAll: false };
  }
  return null;
};

const extractInsScopeTokens = (perms?: string[] | null): string[] =>
  (Array.isArray(perms) ? perms : [])
    .filter((p): p is string => typeof p === 'string' && p.toLowerCase().startsWith(INS_BRANCH_SCOPE_PREFIX))
    .map(p => p.slice(INS_BRANCH_SCOPE_PREFIX.length).trim().toLowerCase())
    .filter(Boolean);

/**
 * Parses Insurance branch access scope from User permissions (explicit override if present)
 * falling back to Role permissions, and defaulting to 'login_only' (strictly logged-in branch).
 */
export const parseUserInsuranceBranchAccess = (
  userPermissions?: string[] | null,
  rolePermissions?: string[] | null,
  loggedInBranchKey?: string,
  branches: Branch[] = []
): UserMfBranchAccess => {
  const userTokens = extractInsScopeTokens(userPermissions);
  const roleTokens = extractInsScopeTokens(rolePermissions);
  // Explicit user-level override takes precedence over role-level scope
  const activeTokens = userTokens.length > 0 ? userTokens : roleTokens;
  const normalizedLoginKey = resolveCanonicalBranchKey(loggedInBranchKey, branches);

  if (activeTokens.includes('login_only')) {
    return {
      mode: 'login_only',
      allowedBranchKeys: normalizedLoginKey ? [normalizedLoginKey] : [],
      explicitBranchKeys: [],
      canSwitchViewBranch: false
    };
  }

  if (activeTokens.includes('all')) {
    return {
      mode: 'all',
      allowedBranchKeys: [],
      explicitBranchKeys: [],
      canSwitchViewBranch: true
    };
  }

  const explicitKeys = Array.from(
    new Set(
      activeTokens
        .map(tok => resolveCanonicalBranchKey(tok, branches))
        .filter(Boolean)
    )
  );

  if (explicitKeys.length > 0) {
    const allowedSet = new Set<string>(explicitKeys);
    if (normalizedLoginKey) allowedSet.add(normalizedLoginKey);
    const allowedBranchKeys = Array.from(allowedSet);
    return {
      mode: 'selected',
      allowedBranchKeys,
      explicitBranchKeys: explicitKeys,
      canSwitchViewBranch:
        allowedBranchKeys.length > 1 ||
        (allowedBranchKeys.length === 1 && allowedBranchKeys[0] !== normalizedLoginKey)
    };
  }

  return {
    mode: 'login_only',
    allowedBranchKeys: normalizedLoginKey ? [normalizedLoginKey] : [],
    explicitBranchKeys: [],
    canSwitchViewBranch: false
  };
};

/**
 * Parses a user's explicit Insurance branch override state for Admin Center -> User Management.
 */
export const parseUserInsuranceOverride = (
  userPermissions?: string[] | null,
  branches: Branch[] = []
): { mode: UserInsBranchOverrideMode; explicitBranchKeys: string[] } => {
  const userTokens = extractInsScopeTokens(userPermissions);
  if (userTokens.length === 0) {
    return { mode: 'inherit_role', explicitBranchKeys: [] };
  }
  if (userTokens.includes('login_only')) {
    return { mode: 'login_only', explicitBranchKeys: [] };
  }
  if (userTokens.includes('all')) {
    return { mode: 'all', explicitBranchKeys: [] };
  }
  const explicitKeys = Array.from(
    new Set(userTokens.map(tok => resolveCanonicalBranchKey(tok, branches)).filter(Boolean))
  );
  if (explicitKeys.length > 0) {
    return { mode: 'selected', explicitBranchKeys: explicitKeys };
  }
  return { mode: 'inherit_role', explicitBranchKeys: [] };
};

/**
 * Applies Insurance branch scope tokens to a Role or User permissions array while keeping unrelated permissions intact.
 * Pass `storeExplicitLoginOnly = true` for User-level overrides so 'login_only' can override a multi-branch Role.
 */
export const applyInsuranceBranchAccessToPermissions = (
  existingPermissions: string[] | undefined | null,
  mode: UserInsBranchOverrideMode,
  selectedBranchIds: string[] = [],
  branches: Branch[] = [],
  storeExplicitLoginOnly: boolean = false
): string[] => {
  const cleaned = (Array.isArray(existingPermissions) ? existingPermissions : []).filter(
    p => typeof p === 'string' && !p.toLowerCase().startsWith(INS_BRANCH_SCOPE_PREFIX)
  );

  if (mode === 'inherit_role') {
    return cleaned;
  }

  if (mode === 'login_only') {
    return storeExplicitLoginOnly ? [...cleaned, INS_BRANCH_SCOPE_LOGIN_ONLY] : cleaned;
  }

  if (mode === 'all') {
    return [...cleaned, INS_BRANCH_SCOPE_ALL];
  }

  if (mode === 'selected') {
    const canonicalKeys = Array.from(
      new Set(
        selectedBranchIds
          .map(id => resolveCanonicalBranchKey(id, branches))
          .filter(Boolean)
      )
    );
    if (canonicalKeys.length === 0) {
      return storeExplicitLoginOnly ? [...cleaned, INS_BRANCH_SCOPE_LOGIN_ONLY] : cleaned;
    }
    return [...cleaned, ...canonicalKeys.map(k => `${INS_BRANCH_SCOPE_PREFIX}${k}`)];
  }

  return cleaned;
};

/**
 * Short display badge summary for Insurance branch access (User table or Role header).
 */
export const getInsuranceBranchAccessSummary = (
  userPermissions?: string[] | null,
  rolePermissions?: string[] | null,
  branches: Branch[] = []
): { label: string; isAll: boolean; isRestrictedOverride?: boolean } | null => {
  const userTokens = extractInsScopeTokens(userPermissions);
  if (userTokens.includes('login_only')) {
    return { label: 'Ins: Own Branch Only', isAll: false, isRestrictedOverride: true };
  }
  const parsed = parseUserInsuranceBranchAccess(userPermissions, rolePermissions, undefined, branches);
  if (parsed.mode === 'all') {
    return { label: 'Ins: All Branches', isAll: true };
  }
  if (parsed.mode === 'selected' && parsed.explicitBranchKeys.length > 0) {
    if (parsed.explicitBranchKeys.length === 1) {
      const b = findMatchingBranch(parsed.explicitBranchKeys[0], branches);
      return { label: `Ins: ${b?.name || parsed.explicitBranchKeys[0]}`, isAll: false };
    }
    return { label: `Ins: ${parsed.explicitBranchKeys.length} Branches`, isAll: false };
  }
  return null;
};

export interface ScopedMicroFinanceInput {
  centers: MFCenter[];
  groups: MFSamuhGroup[];
  members: MFMember[];
  savings: MFSavingsRecord[];
  loans: MFLoanRecord[];
  closedLoansArchive?: MFLoanRecord[];
  sheets?: MFCollectionSheet[];
  signatureSheets?: MFSignatureSheet[];
  meetingMinutes?: GroupMeetingRecord[];
  /** Single branch key (empty or 'ALL' => unfiltered) */
  targetBranchKey?: string;
  /** Optional list of allowed canonical branch keys (empty => unfiltered when targetBranchKey is also empty) */
  targetBranchKeys?: string[];
  branches?: Branch[];
}

export interface ScopedMicroFinanceResult {
  centers: MFCenter[];
  groups: MFSamuhGroup[];
  members: MFMember[];
  savings: MFSavingsRecord[];
  loans: MFLoanRecord[];
  closedLoansArchive: MFLoanRecord[];
  sheets: MFCollectionSheet[];
  signatureSheets: MFSignatureSheet[];
  meetingMinutes: GroupMeetingRecord[];
}

const buildNormalizedBranchKeySet = (
  targetBranchKey?: string,
  targetBranchKeys?: string[],
  branches: Branch[] = []
): Set<string> | null => {
  if (Array.isArray(targetBranchKeys)) {
    if (targetBranchKeys.length === 0) return null; // Unfiltered
    const keys = targetBranchKeys
      .map(k => resolveCanonicalBranchKey(k === 'ALL' || k === 'all' ? '' : k, branches))
      .filter(Boolean);
    return keys.length > 0 ? new Set(keys) : null;
  }

  const single = resolveCanonicalBranchKey(
    targetBranchKey === 'ALL' || targetBranchKey === 'all' ? '' : targetBranchKey,
    branches
  );
  return single ? new Set([single]) : null;
};

/**
 * Filters all Micro-Finance datasets cleanly to one or more allowed branches.
 * If no target branch keys are specified (empty / 'ALL'), returns all records unfiltered.
 */
export const scopeMicroFinanceData = ({
  centers: rawCenters,
  groups: rawGroups,
  members: rawMembers,
  savings: rawSavings,
  loans: rawLoans,
  closedLoansArchive: rawClosedLoansArchive = [],
  sheets: rawSheets = [],
  signatureSheets: rawSignatureSheets = [],
  meetingMinutes: rawMeetingMinutes = [],
  targetBranchKey,
  targetBranchKeys,
  branches = []
}: ScopedMicroFinanceInput): ScopedMicroFinanceResult => {
  const allowedBranchKeys = buildNormalizedBranchKeySet(targetBranchKey, targetBranchKeys, branches);

  if (!allowedBranchKeys) {
    return {
      centers: rawCenters,
      groups: rawGroups,
      members: rawMembers,
      savings: rawSavings,
      loans: rawLoans,
      closedLoansArchive: rawClosedLoansArchive,
      sheets: rawSheets,
      signatureSheets: rawSignatureSheets,
      meetingMinutes: rawMeetingMinutes
    };
  }

  const isAllowedBranch = (raw?: string | null): boolean => {
    const k = resolveCanonicalBranchKey(raw, branches);
    return Boolean(k && allowedBranchKeys.has(k));
  };

  // Index all raw centers & groups for accurate parent-branch resolution
  const rawCenterById = new Map<string, MFCenter>();
  const rawCenterByName = new Map<string, MFCenter>();
  rawCenters.forEach(c => {
    if (c.id) rawCenterById.set(c.id, c);
    const n = normalizeText(c.name);
    if (n && !rawCenterByName.has(n)) rawCenterByName.set(n, c);
  });

  // 1. Centers belonging to allowedBranchKeys
  const centers = rawCenters.filter(c => isAllowedBranch(c.branch));
  const allowedCenterIds = new Set(centers.map(c => c.id).filter(Boolean));
  const allowedCenterNames = new Set(centers.map(c => normalizeText(c.name)).filter(Boolean));

  // 2. Groups belonging to scoped centers
  const rawGroupById = new Map<string, MFSamuhGroup>();
  const rawGroupByName = new Map<string, MFSamuhGroup>();
  rawGroups.forEach(g => {
    if (g.id) rawGroupById.set(g.id, g);
    const n = normalizeText(g.name);
    if (n && !rawGroupByName.has(n)) rawGroupByName.set(n, g);
  });

  const groups = rawGroups.filter(g => {
    const parentCenter =
      (g.centerId ? rawCenterById.get(g.centerId) : undefined) ||
      rawCenterByName.get(normalizeText(g.centerName));
    if (parentCenter) {
      return allowedCenterIds.has(parentCenter.id);
    }
    return (
      (Boolean(g.centerId) && allowedCenterIds.has(g.centerId)) ||
      (Boolean(g.centerName) && allowedCenterNames.has(normalizeText(g.centerName)))
    );
  });
  const allowedGroupIds = new Set(groups.map(g => g.id).filter(Boolean));
  const allowedGroupNames = new Set(groups.map(g => normalizeText(g.name)).filter(Boolean));

  // 3. Members belonging to scoped centers/groups/branch
  const members = rawMembers.filter(m => {
    const parentCenter =
      (m.centerId ? rawCenterById.get(m.centerId) : undefined) ||
      rawCenterByName.get(normalizeText(m.centerName));
    if (parentCenter) {
      return allowedCenterIds.has(parentCenter.id);
    }
    const parentGroup =
      (m.samuhId ? rawGroupById.get(m.samuhId) : undefined) ||
      rawGroupByName.get(normalizeText(m.samuhName));
    if (parentGroup) {
      return allowedGroupIds.has(parentGroup.id);
    }
    return isAllowedBranch(m.branch);
  });

  // Build lookup of ALL raw members vs ALLOWED scoped members so savings/loans resolve cleanly
  const allowedMemberRecordIds = new Set(members.map(m => m.id).filter(Boolean));
  const rawMemberByExactId = new Map<string, MFMember>();
  const rawMemberByStrippedId = new Map<string, MFMember>();
  const rawMemberByAcc = new Map<string, MFMember>();
  rawMembers.forEach(m => {
    const k = normalizeId(m.memberId);
    if (k && !rawMemberByExactId.has(k)) rawMemberByExactId.set(k, m);
    const s = stripLeadingZeros(m.memberId);
    if (s && !rawMemberByStrippedId.has(s)) rawMemberByStrippedId.set(s, m);
    const a = normalizeId(m.savingsAccountNo);
    if (a && !rawMemberByAcc.has(a)) rawMemberByAcc.set(a, m);
  });

  const findRawMember = (memberId?: string, accountNo?: string): MFMember | undefined => {
    const exact = normalizeId(memberId);
    if (exact) {
      const hit = rawMemberByExactId.get(exact);
      if (hit) return hit;
      const stripped = stripLeadingZeros(exact);
      if (stripped) {
        const sHit = rawMemberByStrippedId.get(stripped);
        if (sHit) return sHit;
      }
    }
    const acc = normalizeId(accountNo);
    if (acc) return rawMemberByAcc.get(acc);
    return undefined;
  };

  const belongsToScopedCenterOrGroup = (centerName?: string, groupName?: string): boolean => {
    const cNorm = normalizeText(centerName);
    if (cNorm) {
      const matchedCenter = rawCenterByName.get(cNorm);
      if (matchedCenter) return allowedCenterIds.has(matchedCenter.id);
      if (allowedCenterNames.has(cNorm)) return true;
    }
    const gNorm = normalizeText(groupName);
    if (gNorm) {
      const matchedGroup = rawGroupByName.get(gNorm);
      if (matchedGroup) return allowedGroupIds.has(matchedGroup.id);
      if (allowedGroupNames.has(gNorm)) return true;
    }
    return false;
  };

  // 4. Savings belonging to scoped members / centers / groups
  const savings = rawSavings.filter(s => {
    const linked = findRawMember(s.memberId, s.accountNo);
    if (linked) return allowedMemberRecordIds.has(linked.id);
    return belongsToScopedCenterOrGroup(s.centerName, s.groupName);
  });

  // 5. Loans & Closed Loans Archive belonging to scoped members / centers / groups
  const filterLoan = (l: MFLoanRecord): boolean => {
    const linked = findRawMember(l.memberId);
    if (linked) return allowedMemberRecordIds.has(linked.id);
    return belongsToScopedCenterOrGroup(l.centerName, l.groupName);
  };
  const loans = rawLoans.filter(filterLoan);
  const closedLoansArchive = rawClosedLoansArchive.filter(filterLoan);

  // 6. Collection Sheets
  const sheets = rawSheets.filter(sheet => {
    const parentCenter =
      (sheet.centerId ? rawCenterById.get(sheet.centerId) : undefined) ||
      rawCenterByName.get(normalizeText(sheet.centerName));
    if (parentCenter) return allowedCenterIds.has(parentCenter.id);
    if (sheet.groupId && rawGroupById.has(sheet.groupId)) {
      return allowedGroupIds.has(sheet.groupId);
    }
    return (
      (Boolean(sheet.centerId) && allowedCenterIds.has(sheet.centerId)) ||
      (Boolean(sheet.centerName) && allowedCenterNames.has(normalizeText(sheet.centerName))) ||
      (Boolean(sheet.groupName) && allowedGroupNames.has(normalizeText(sheet.groupName)))
    );
  });

  // 7. Signature Sheets
  const signatureSheets = rawSignatureSheets.filter(sig => {
    const parentCenter =
      (sig.centerId ? rawCenterById.get(sig.centerId) : undefined) ||
      rawCenterByName.get(normalizeText(sig.centerName));
    if (parentCenter) return allowedCenterIds.has(parentCenter.id);
    if (sig.branchName) {
      return isAllowedBranch(sig.branchName);
    }
    if (sig.groupId && rawGroupById.has(sig.groupId)) {
      return allowedGroupIds.has(sig.groupId);
    }
    return (
      (Boolean(sig.centerId) && allowedCenterIds.has(sig.centerId)) ||
      (Boolean(sig.centerName) && allowedCenterNames.has(normalizeText(sig.centerName)))
    );
  });

  // 8. Group Meeting Minutes
  const meetingMinutes = rawMeetingMinutes.filter(m => {
    const parentCenter =
      (m.centerId ? rawCenterById.get(m.centerId) : undefined) ||
      rawCenterByName.get(normalizeText(m.centerName));
    if (parentCenter) return allowedCenterIds.has(parentCenter.id);
    if (m.branchName) {
      return isAllowedBranch(m.branchName);
    }
    if (m.groupId && rawGroupById.has(m.groupId)) {
      return allowedGroupIds.has(m.groupId);
    }
    return (
      (Boolean(m.centerId) && allowedCenterIds.has(m.centerId)) ||
      (Boolean(m.centerName) && allowedCenterNames.has(normalizeText(m.centerName)))
    );
  });

  return {
    centers,
    groups,
    members,
    savings,
    loans,
    closedLoansArchive,
    sheets,
    signatureSheets,
    meetingMinutes
  };
};

/**
 * Helper for sub-modules (DepositSheetModule, GroupMeetingMinutesModule) that receive
 * already-scoped centers/groups as props but load their own saved sheet/meeting lists.
 */
export const matchesScopedSheetOrMeeting = (
  record: { centerId?: string; centerName?: string; groupId?: string; groupName?: string; branchName?: string },
  scopedCenters: MFCenter[],
  scopedGroups: MFSamuhGroup[],
  activeBranchKey?: string,
  branches: Branch[] = [],
  activeBranchKeys?: string[]
): boolean => {
  const allowedBranchKeys = buildNormalizedBranchKeySet(activeBranchKey, activeBranchKeys, branches);
  if (!allowedBranchKeys) return true; // Unfiltered (All Branches)

  const allowedCenterIds = new Set(scopedCenters.map(c => c.id).filter(Boolean));
  const allowedCenterNames = new Set(scopedCenters.map(c => normalizeText(c.name)).filter(Boolean));
  const allowedGroupIds = new Set(scopedGroups.map(g => g.id).filter(Boolean));
  const allowedGroupNames = new Set(scopedGroups.map(g => normalizeText(g.name)).filter(Boolean));

  if (record.centerId && allowedCenterIds.has(record.centerId)) return true;
  if (record.centerName && allowedCenterNames.has(normalizeText(record.centerName))) return true;
  if (record.groupId && allowedGroupIds.has(record.groupId)) return true;
  if (record.groupName && allowedGroupNames.has(normalizeText(record.groupName))) return true;
  if (record.branchName) {
    const key = resolveCanonicalBranchKey(record.branchName, branches);
    return Boolean(key && allowedBranchKeys.has(key));
  }
  return false;
};
