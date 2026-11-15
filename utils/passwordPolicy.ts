import { User } from '../types';
import NepaliDate from 'nepali-date-converter';

// 3 Months = 90 Days Policy
export const PASSWORD_EXPIRY_DAYS = 90;
export const PASSWORD_EXPIRY_MS = PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export interface PasswordCriteria {
  length: boolean;     // Minimum 8 characters
  uppercase: boolean;  // At least 1 uppercase letter (A-Z)
  lowercase: boolean;  // At least 1 lowercase letter (a-z)
  number: boolean;     // At least 1 number (0-9)
  symbol: boolean;     // At least 1 special symbol (!@#$%^&*...)
}

export interface PasswordValidationResult {
  isValid: boolean;
  criteria: PasswordCriteria;
  errors: string[];
  score: number; // 0 to 100
  strength: 'very-weak' | 'weak' | 'medium' | 'strong';
  strengthLabel: string;
}

/**
 * Validates whether a password complies with the strict 5-rule password policy:
 * 1. Minimum 8 characters
 * 2. At least one capital/uppercase letter
 * 3. At least one small/lowercase letter
 * 4. At least one numeric digit
 * 5. At least one special symbol
 * Note: Admin user (@admin) is permitted to keep custom self-managed credentials (e.g. 'admin').
 */
export function validateStrongPassword(password: string = '', username?: string): PasswordValidationResult {
  // If user is system administrator, permit admin password flexibility
  if (username && username.toLowerCase() === 'admin') {
    if (password.length >= 3) {
      return {
        isValid: true,
        criteria: {
          length: true,
          uppercase: true,
          lowercase: true,
          number: true,
          symbol: true,
        },
        errors: [],
        score: 100,
        strength: 'strong',
        strengthLabel: 'Admin Managed',
      };
    }
  }

  const criteria: PasswordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password),
  };

  const errors: string[] = [];
  if (!criteria.length) {
    errors.push('Must be at least 8 characters long');
  }
  if (!criteria.uppercase) {
    errors.push('Must contain at least 1 uppercase letter (A-Z)');
  }
  if (!criteria.lowercase) {
    errors.push('Must contain at least 1 lowercase letter (a-z)');
  }
  if (!criteria.number) {
    errors.push('Must contain at least 1 numeric digit (0-9)');
  }
  if (!criteria.symbol) {
    errors.push('Must contain at least 1 special symbol (@, #, $, %, !)');
  }

  const metCount = Object.values(criteria).filter(Boolean).length;
  const score = Math.round((metCount / 5) * 100);

  let strength: 'very-weak' | 'weak' | 'medium' | 'strong' = 'very-weak';
  let strengthLabel = 'Very Weak';

  if (metCount === 5) {
    strength = 'strong';
    strengthLabel = 'Strong & Secure';
  } else if (metCount >= 4) {
    strength = 'medium';
    strengthLabel = 'Moderate';
  } else if (metCount >= 2) {
    strength = 'weak';
    strengthLabel = 'Weak';
  }

  return {
    isValid: metCount === 5,
    criteria,
    errors,
    score,
    strength,
    strengthLabel,
  };
}

/**
 * Checks whether a user's password has exceeded the 3-month (90 days) expiration period
 * Note: Admin account (@admin) is exempt from 3-month forced expiration and changes password only when desired.
 */
export function isPasswordExpired(user?: User | null): boolean {
  if (!user) return false;
  
  // If force password flag is explicitly set (e.g. after Super Admin reset)
  if (user.forcePasswordChange) return true;

  // System admin account is exempt from auto 3-month expiry (changes password only when desired)
  if (user.username && user.username.toLowerCase() === 'admin') {
    return false;
  }

  const now = Date.now();
  const lastUpdated = user.passwordUpdatedAt || user.accountCreated || (now - (PASSWORD_EXPIRY_MS + 1000));

  return (now - lastUpdated) >= PASSWORD_EXPIRY_MS;
}

/**
 * Returns formatted expiration details, days left, and badge styling for display in Admin Center / User list
 */
export function getPasswordExpiryDetails(user: User): {
  daysLeft: number;
  isExpired: boolean;
  isWarning: boolean;
  lastChangedDateStr: string;
  statusBadge: string;
  statusColorClass: string;
} {
  // Admin account display
  if (user.username && user.username.toLowerCase() === 'admin') {
    return {
      daysLeft: 999,
      isExpired: Boolean(user.forcePasswordChange),
      isWarning: false,
      lastChangedDateStr: 'Admin Managed',
      statusBadge: user.forcePasswordChange ? 'Password Reset Required' : 'Admin (Exempt)',
      statusColorClass: user.forcePasswordChange 
        ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse' 
        : 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold',
    };
  }

  const now = Date.now();
  const lastUpdated = user.passwordUpdatedAt || user.accountCreated;
  
  if (!lastUpdated) {
    return {
      daysLeft: 0,
      isExpired: true,
      isWarning: true,
      lastChangedDateStr: 'Not recorded',
      statusBadge: 'Expired (Change Required)',
      statusColorClass: 'bg-rose-100 text-rose-700 border-rose-300',
    };
  }

  const elapsedMs = now - lastUpdated;
  const remainingMs = PASSWORD_EXPIRY_MS - elapsedMs;
  const daysLeft = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const isExpired = remainingMs <= 0 || Boolean(user.forcePasswordChange);
  const isWarning = daysLeft <= 15;

  let lastChangedDateStr = 'Unknown';
  try {
    const nd = new NepaliDate(new Date(lastUpdated));
    lastChangedDateStr = nd.format('YYYY-MM-DD');
  } catch {
    lastChangedDateStr = new Date(lastUpdated).toISOString().split('T')[0];
  }

  let statusBadge = `Active (${daysLeft} Days Left)`;
  let statusColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';

  if (isExpired) {
    statusBadge = 'Expired';
    statusColorClass = 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse';
  } else if (isWarning) {
    statusBadge = `Expiring Soon (${daysLeft} Days)`;
    statusColorClass = 'bg-amber-100 text-amber-800 border-amber-300';
  }

  return {
    daysLeft,
    isExpired,
    isWarning,
    lastChangedDateStr,
    statusBadge,
    statusColorClass,
  };
}
