// Helper utilities for Employee deduplication, phonetic matching, and uniqueness checks

/**
 * Normalizes a name for phonetic/transliteration comparison.
 * Handles common Nepali transliteration variations like:
 * - KAMNI vs KAMANI
 * - SHEKHAR vs SEKHAR
 * - YADAV vs YADAB
 * - SAFI vs SAPHI
 * - CHH vs CH
 */
export const normalizeNamePhonetic = (str: string): string => {
  if (!str) return '';
  return str
    .toUpperCase()
    .trim()
    .replace(/[^A-Z]/g, '')
    // Common Nepali transliteration variations:
    .replace(/SH/g, 'S')
    .replace(/V/g, 'B')
    .replace(/W/g, 'B')
    .replace(/EE/g, 'I')
    .replace(/OO/g, 'U')
    .replace(/TH/g, 'T')
    .replace(/DH/g, 'D')
    .replace(/BH/g, 'B')
    .replace(/KH/g, 'K')
    .replace(/CHH/g, 'CH')
    .replace(/PH/g, 'F')
    // Remove duplicate consecutive characters
    .replace(/(.)\1+/g, '$1')
    // Drop vowels except initial character
    .replace(/(?!^)[AEIOU]/g, '');
};

/**
 * Calculates similarity between two names (0 to 1).
 * Uses combination of phonetic comparison, word-by-word token matching, and Levenshtein distance.
 */
export const calculateNameSimilarity = (s1: string, s2: string): number => {
  const a = (s1 || '').trim().toUpperCase();
  const b = (s2 || '').trim().toUpperCase();
  if (!a || !b) return 0;
  if (a === b) return 1.0;

  // Exact phonetic match (e.g. KAMNI vs KAMANI, SEKHAR vs SHEKHAR)
  const pA = normalizeNamePhonetic(a);
  const pB = normalizeNamePhonetic(b);
  if (pA && pB && pA === pB) return 0.96;

  // Word-by-word token comparison (e.g. "KAMANI DEVI KARN" vs "KAMNI DEVI KARN")
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  if (wordsA.length === wordsB.length && wordsA.length >= 2) {
    let allWordsMatch = true;
    for (let i = 0; i < wordsA.length; i++) {
      const wa = wordsA[i];
      const wb = wordsB[i];
      if (wa !== wb && normalizeNamePhonetic(wa) !== normalizeNamePhonetic(wb)) {
        allWordsMatch = false;
        break;
      }
    }
    if (allWordsMatch) return 0.95;
  }

  // Levenshtein distance calculation
  const track = Array(b.length + 1).fill(null).map(() =>
    Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= b.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator,
      );
    }
  }
  const dist = track[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - (dist / maxLen);
};

/**
 * Returns true if two employee names are considered the same person.
 * Requires first name and last name phonetic match to prevent false positives
 * like AMIT KUMAR THAKUR vs SUMIT KUMAR THAKUR.
 */
export const isSameEmployeeName = (n1?: string, n2?: string): boolean => {
  if (!n1 || !n2) return false;
  const a = n1.trim().toUpperCase();
  const b = n2.trim().toUpperCase();
  if (a === b) return true;

  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  if (wordsA.length !== wordsB.length) return false;

  // First name must match phonetically
  const pFirstA = normalizeNamePhonetic(wordsA[0]);
  const pFirstB = normalizeNamePhonetic(wordsB[0]);
  if (pFirstA !== pFirstB) return false;

  // Last name must match phonetically
  const pLastA = normalizeNamePhonetic(wordsA[wordsA.length - 1]);
  const pLastB = normalizeNamePhonetic(wordsB[wordsB.length - 1]);
  if (pLastA !== pLastB) return false;

  const sim = calculateNameSimilarity(a, b);
  return sim >= 0.94;
};

/**
 * Normalizes citizenship numbers by stripping dashes, spaces, and slashes.
 */
export const cleanCitizenshipNo = (no?: string): string => {
  if (!no) return '';
  return no.trim().replace(/[-\s/]/g, '').toLowerCase();
};

/**
 * Normalizes mobile numbers by extracting the last 10 digits.
 */
export const cleanMobileNo = (mob?: string): string => {
  if (!mob) return '';
  const digits = mob.trim().replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

/**
 * Normalizes employee code.
 */
export const cleanEmployeeCode = (code?: string): string => {
  if (!code) return '';
  const c = code.trim().toLowerCase();
  return c === '-' || c === '--' || c === 'n/a' ? '' : c;
};

export const getNumericEmployeeCode = (code?: string): string => {
  if (!code) return '';
  const digits = code.replace(/\D/g, '');
  return digits ? String(parseInt(digits, 10)) : code.trim().toLowerCase();
};

/**
 * Safely deduplicates an array of Employee records.
 * Identifies duplicate entries of the same individual by:
 * 1. Exact ID
 * 2. Name equality / phonetic match (e.g. AMIT KUMAR THAKUR)
 * 3. Numeric employee code equality (e.g. "1" vs "EMP-001")
 * 4. Citizenship number equality
 * When merging two records of the same person:
 * - Preserves photoUrl if available
 * - Preserves specific branchId (e.g. 'parsa', 'sahodba', 'pipra')
 * - Preserves richer designation / department
 * - Preserves all KYC document fields
 */
export const deduplicateEmployees = <T extends Record<string, any>>(rawList: T[]): T[] => {
  if (!rawList || !Array.isArray(rawList)) return [];
  const result: T[] = [];

  for (const emp of rawList) {
    if (!emp || !emp.fullName) continue;

    const normName = (emp.fullName || '').trim().toUpperCase();
    const codeDigits = (emp.employeeCode ? String(emp.employeeCode) : '').replace(/\D/g, '');
    const cleanCit = cleanCitizenshipNo(emp.citizenshipNo);

    const existingIdx = result.findIndex(e => {
      // 1. Exact ID match
      if (emp.id && e.id && emp.id === e.id) return true;

      // 2. Name match (exact or phonetic)
      if (isSameEmployeeName(e.fullName, emp.fullName)) return true;

      // 3. Same numeric employee code (e.g. "1" vs "1" or "EMP-001")
      const eCodeDigits = (e.employeeCode ? String(e.employeeCode) : '').replace(/\D/g, '');
      if (codeDigits && eCodeDigits && codeDigits === eCodeDigits) {
        const eNorm = (e.fullName || '').trim().toUpperCase();
        if (normName[0] === eNorm[0] || isSameEmployeeName(e.fullName, emp.fullName)) {
          return true;
        }
      }

      // 4. Same citizenship number (if non-empty)
      if (cleanCit && cleanCit.length > 4) {
        const eCit = cleanCitizenshipNo(e.citizenshipNo);
        if (eCit && eCit === cleanCit) return true;
      }

      return false;
    });

    if (existingIdx === -1) {
      result.push({ ...emp });
    } else {
      const existing = result[existingIdx];
      const merged: T = {
        ...existing,
        ...emp,
        photoUrl: existing.photoUrl || emp.photoUrl || '',
        branchId: (existing.branchId && existing.branchId !== 'main' ? existing.branchId : emp.branchId) || existing.branchId || 'main',
        designation: (existing.designation && existing.designation !== 'STAFF' && existing.designation !== 'GENERAL' 
          ? existing.designation 
          : emp.designation) || existing.designation || emp.designation,
        department: (existing.department && existing.department !== 'GENERAL' 
          ? existing.department 
          : emp.department) || existing.department || emp.department,
        id: existing.photoUrl ? existing.id : (emp.photoUrl ? emp.id : existing.id),
        employeeCode: existing.employeeCode || emp.employeeCode
      };
      result[existingIdx] = merged;
    }
  }

  return result;
};

