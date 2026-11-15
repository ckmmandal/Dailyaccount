import { User, Employee, ChatMessage, ChatTarget } from '../types';

/**
 * Normalizes text for matching (lowercase, trimmed)
 */
export const normalizeText = (text?: string): string => {
  if (!text) return '';
  return text.trim().toLowerCase();
};

/**
 * Helper to match full names or first+last names accurately without false positives
 */
export const matchFullName = (nameA?: string, nameB?: string): boolean => {
  const a = normalizeText(nameA);
  const b = normalizeText(nameB);
  if (!a || !b) return false;
  if (a === b) return true;

  const partsA = a.split(/\s+/).filter(Boolean);
  const partsB = b.split(/\s+/).filter(Boolean);
  if (partsA.length >= 2 && partsB.length >= 2) {
    if (partsA[0] === partsB[0] && partsA[partsA.length - 1] === partsB[partsB.length - 1]) {
      return true;
    }
  }
  return false;
};

/**
 * Builds a comprehensive set of identifiers (IDs, usernames, emails, mobile)
 * and full names for the current user to ensure message routing matches regardless
 * of whether the sender targeted their User ID, Employee ID, username, or full name.
 */
export const getUserChatProfile = (
  currentUser: User | null,
  employees: Employee[] = [],
  users: User[] = []
): { identifiers: Set<string>; names: Set<string>; isSuperAdmin: boolean } => {
  const identifiers = new Set<string>();
  const names = new Set<string>();

  if (!currentUser) {
    return { identifiers, names, isSuperAdmin: false };
  }

  const currentId = currentUser.id ? String(currentUser.id) : '';
  const currentUsername = normalizeText(currentUser.username);
  const currentFullName = normalizeText(currentUser.fullName);
  const currentMobile = currentUser.mobile?.replace(/\D/g, '') || '';
  const currentEmail = normalizeText(currentUser.email);

  if (currentId) identifiers.add(currentId);
  if (currentUsername) identifiers.add(currentUsername);
  if (currentMobile) identifiers.add(currentMobile);
  if (currentEmail) identifiers.add(currentEmail);

  if (currentFullName) {
    names.add(currentFullName);
    const parts = currentFullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      names.add(`${parts[0]} ${parts[parts.length - 1]}`);
    }
  }
  if (currentUsername) {
    names.add(currentUsername);
  }

  // If user is Admin or Super Admin
  const isSuperAdmin = currentUser.roleId === '1' || currentUsername === 'admin' || currentId === '1';
  if (isSuperAdmin) {
    identifiers.add('admin-temp');
    identifiers.add('admin');
    identifiers.add('1');
    names.add('system administrator');
    names.add('admin');
  }

  // Find linked employee records by ID, employeeCode, name, email, or mobile
  employees.forEach(emp => {
    const empId = String(emp.id);
    const empCode = normalizeText(emp.employeeCode);
    const empName = normalizeText(emp.fullName);
    const empEmail = normalizeText(emp.email);
    const empMobile = emp.mobile?.replace(/\D/g, '') || '';

    const isMatch =
      (empId && empId === currentId) ||
      (empCode && (empCode === currentUsername || empCode === currentId)) ||
      (empName && currentFullName && matchFullName(empName, currentFullName)) ||
      (empEmail && currentEmail && empEmail === currentEmail) ||
      (empMobile && currentMobile && empMobile === currentMobile);

    if (isMatch) {
      if (empId) identifiers.add(empId);
      if (empCode) identifiers.add(empCode);
      if (empEmail) identifiers.add(empEmail);
      if (empMobile) identifiers.add(empMobile);
      if (empName) {
        names.add(empName);
        const parts = empName.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          names.add(`${parts[0]} ${parts[parts.length - 1]}`);
        }
      }
    }
  });

  // Find matching user record in users list
  users.forEach(u => {
    const uId = String(u.id);
    const uUsername = normalizeText(u.username);
    const uName = normalizeText(u.fullName);
    const uEmail = normalizeText(u.email);
    const uMobile = u.mobile?.replace(/\D/g, '') || '';

    const isMatch =
      (uId && uId === currentId) ||
      (uUsername && uUsername === currentUsername) ||
      (uName && currentFullName && matchFullName(uName, currentFullName)) ||
      (uEmail && currentEmail && uEmail === currentEmail) ||
      (uMobile && currentMobile && uMobile === currentMobile);

    if (isMatch) {
      if (uId) identifiers.add(uId);
      if (uUsername) identifiers.add(uUsername);
      if (uEmail) identifiers.add(uEmail);
      if (uMobile) identifiers.add(uMobile);
      if (uName) {
        names.add(uName);
        const parts = uName.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          names.add(`${parts[0]} ${parts[parts.length - 1]}`);
        }
      }
    }
  });

  return { identifiers, names, isSuperAdmin };
};

/**
 * Builds all identifiers and names for a chat target (contact).
 * Links user accounts and employee records together bidirectionally.
 */
export const getTargetChatProfile = (
  target: ChatTarget,
  employees: Employee[] = [],
  users: User[] = []
): { identifiers: Set<string>; names: Set<string> } => {
  const identifiers = new Set<string>();
  const names = new Set<string>();

  const targetId = target.id ? String(target.id) : '';
  const targetName = normalizeText(target.name);

  if (targetId) identifiers.add(targetId);
  if (targetName) {
    names.add(targetName);
    const parts = targetName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      names.add(`${parts[0]} ${parts[parts.length - 1]}`);
    }
  }

  if (targetName === 'admin' || targetName === 'system administrator' || targetId === 'admin-temp' || targetId === 'admin' || targetId === '1') {
    identifiers.add('admin-temp');
    identifiers.add('admin');
    identifiers.add('1');
    names.add('system administrator');
    names.add('admin');
  }

  // Cross-reference with users
  users.forEach(u => {
    const uId = String(u.id);
    const uUsername = normalizeText(u.username);
    const uName = normalizeText(u.fullName);

    const matchesUser =
      uId === targetId ||
      uUsername === targetName ||
      (uName && targetName && matchFullName(uName, targetName));

    if (matchesUser) {
      identifiers.add(uId);
      if (uUsername) identifiers.add(uUsername);
      if (u.email) identifiers.add(normalizeText(u.email));
      if (u.mobile) identifiers.add(u.mobile.replace(/\D/g, ''));
      if (uName) {
        names.add(uName);
        const parts = uName.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          names.add(`${parts[0]} ${parts[parts.length - 1]}`);
        }
      }

      // Also find linked employee for this user
      employees.forEach(emp => {
        const empId = String(emp.id);
        const empCode = normalizeText(emp.employeeCode);
        const empName = normalizeText(emp.fullName);
        const empEmail = normalizeText(emp.email);
        const empMobile = emp.mobile?.replace(/\D/g, '') || '';

        const linksWithUser =
          (empId && empId === uId) ||
          (empCode && (empCode === uUsername || empCode === uId)) ||
          (empName && uName && matchFullName(empName, uName)) ||
          (empEmail && u.email && empEmail === normalizeText(u.email)) ||
          (empMobile && u.mobile && empMobile === u.mobile.replace(/\D/g, ''));

        if (linksWithUser) {
          identifiers.add(empId);
          if (empCode) identifiers.add(empCode);
          if (empName) {
            names.add(empName);
            const parts = empName.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
              names.add(`${parts[0]} ${parts[parts.length - 1]}`);
            }
          }
        }
      });
    }
  });

  // Cross-reference with employees
  employees.forEach(emp => {
    const empId = String(emp.id);
    const empCode = normalizeText(emp.employeeCode);
    const empName = normalizeText(emp.fullName);

    const matchesEmp =
      empId === targetId ||
      empCode === targetName ||
      (empName && targetName && matchFullName(empName, targetName));

    if (matchesEmp) {
      identifiers.add(empId);
      if (empCode) identifiers.add(empCode);
      if (emp.email) identifiers.add(normalizeText(emp.email));
      if (emp.mobile) identifiers.add(emp.mobile.replace(/\D/g, ''));
      if (empName) {
        names.add(empName);
        const parts = empName.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          names.add(`${parts[0]} ${parts[parts.length - 1]}`);
        }
      }

      // Also find linked user account for this employee
      users.forEach(u => {
        const uId = String(u.id);
        const uUsername = normalizeText(u.username);
        const uName = normalizeText(u.fullName);
        const uEmail = normalizeText(u.email);
        const uMobile = u.mobile?.replace(/\D/g, '') || '';

        const linksWithEmp =
          (uId && uId === empId) ||
          (uUsername && (uUsername === empCode || uUsername === empId)) ||
          (uName && empName && matchFullName(uName, empName)) ||
          (uEmail && emp.email && uEmail === normalizeText(emp.email)) ||
          (uMobile && emp.mobile && uMobile === emp.mobile.replace(/\D/g, ''));

        if (linksWithEmp) {
          identifiers.add(uId);
          if (uUsername) identifiers.add(uUsername);
          if (uName) {
            names.add(uName);
            const parts = uName.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
              names.add(`${parts[0]} ${parts[parts.length - 1]}`);
            }
          }
        }
      });
    }
  });

  return { identifiers, names };
};

/**
 * Determines whether a message was sent by the current user.
 */
export const isMessageFromMe = (
  message: ChatMessage,
  myIdentifiers: Set<string>,
  myNames: Set<string>
): boolean => {
  const senderId = message.senderId ? String(message.senderId) : '';
  const senderUsername = normalizeText(message.senderUsername);
  const senderName = normalizeText(message.senderName);

  if (senderId && myIdentifiers.has(senderId)) return true;
  if (senderUsername && myIdentifiers.has(senderUsername)) return true;
  if (senderName && myNames.has(senderName)) return true;

  for (const name of myNames) {
    if (matchFullName(senderName, name)) return true;
  }

  return false;
};

/**
 * Determines whether a direct or channel message is addressed to the current user.
 */
export const isMessageForMe = (
  message: ChatMessage,
  myIdentifiers: Set<string>,
  myNames: Set<string>,
  userBranchId?: string,
  isSuperAdmin: boolean = false
): boolean => {
  // If message has channelId -> it's a channel broadcast
  if (message.channelId) {
    if (message.channelId.startsWith('channel_branch_')) {
      const branchId = message.channelId.replace('channel_branch_', '');
      return isSuperAdmin || branchId === userBranchId || branchId === 'main';
    }
    return true; // General staff channel
  }

  // Direct message matching
  const recipientId = message.recipientId ? String(message.recipientId) : '';
  const recipientName = normalizeText(message.recipientName);

  if (recipientId && myIdentifiers.has(recipientId)) return true;
  if (recipientName && myNames.has(recipientName)) return true;

  // Match full name
  for (const name of myNames) {
    if (matchFullName(recipientName, name)) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if a message belongs to the conversation with the active target.
 */
export const doesMessageBelongToTarget = (
  message: ChatMessage,
  target: ChatTarget,
  myIdentifiers: Set<string>,
  myNames: Set<string>,
  targetIdentifiers: Set<string>,
  targetNames: Set<string>
): boolean => {
  if (target.type === 'channel') {
    return message.channelId === target.id;
  }

  // Direct message must not have channelId
  if (message.channelId) return false;

  const senderId = message.senderId ? String(message.senderId) : '';
  const senderUsername = normalizeText(message.senderUsername);
  const senderName = normalizeText(message.senderName);

  const recipientId = message.recipientId ? String(message.recipientId) : '';
  const recipientName = normalizeText(message.recipientName);

  // Check if sender is Me
  const senderIsMe =
    (senderId && myIdentifiers.has(senderId)) ||
    (senderUsername && myIdentifiers.has(senderUsername)) ||
    (senderName && myNames.has(senderName));

  // Check if recipient is Target
  const recipientIsTarget =
    (recipientId && targetIdentifiers.has(recipientId)) ||
    (recipientName && targetNames.has(recipientName));

  if (senderIsMe && recipientIsTarget) return true;

  // Check if sender is Target
  const senderIsTarget =
    (senderId && targetIdentifiers.has(senderId)) ||
    (senderUsername && targetIdentifiers.has(senderUsername)) ||
    (senderName && targetNames.has(senderName));

  // Check if recipient is Me
  const recipientIsMe =
    (recipientId && myIdentifiers.has(recipientId)) ||
    (recipientName && myNames.has(recipientName));

  if (senderIsTarget && recipientIsMe) return true;

  // Check full name matching
  for (const tName of targetNames) {
    if (senderIsMe && matchFullName(recipientName, tName)) return true;
    if (recipientIsMe && matchFullName(senderName, tName)) return true;
  }

  return false;
};

/**
 * Plays a pleasant modern notification audio chime using the Web Audio API.
 * Fails gracefully and silently if audio context is blocked by browser policy.
 */
export const playChatNotificationSound = (): void => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // 2-tone melodic chime: Tone 1 (659.25 Hz - E5) followed by Tone 2 (880 Hz - A5)
    const now = ctx.currentTime;

    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.debug('Chat notification audio chime suppressed:', e);
  }
};

/**
 * Triggers native HTML5 Browser Notification if permitted.
 */
export const triggerBrowserNotification = (
  title: string,
  options?: NotificationOptions
): void => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, options);
    } catch (e) {
      console.debug('Browser notification failed:', e);
    }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(title, options);
        } catch (e) {
          console.debug('Browser notification failed:', e);
        }
      }
    });
  }
};
