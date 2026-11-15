import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  X, Send, Paperclip, Image as ImageIcon, FileText, Download, 
  Trash2, Smile, CornerDownRight, Search, 
  Users, Check, CheckCheck, Sparkles,
  Maximize2, Minimize2, Minus, RefreshCw, MessageSquare, Building2,
  ChevronDown, ChevronLeft, ChevronRight, User as UserIcon, Clock,
  Filter
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { storageService } from '../services/storageService';
import { ChatMessage, ChatAttachment, Employee, User, Branch, ChatReaction } from '../types';
import { 
  getUserChatProfile, 
  getTargetChatProfile, 
  isMessageFromMe, 
  isMessageForMe, 
  doesMessageBelongToTarget, 
  playChatNotificationSound, 
  triggerBrowserNotification,
  normalizeText
} from '../utils/chatHelpers';
import { TeamsNotificationToast } from './TeamsNotificationToast';

interface StaffChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  initialTarget?: ChatTarget | null;
}

interface ChatTarget {
  id: string;
  name: string;
  type: 'channel' | 'direct';
  subtitle?: string;
  photo?: string;
  branchName?: string;
  designation?: string;
  isOnline?: boolean;
  lastMessage?: string;
  lastMessageTime?: number;
}

interface IncomingToast {
  id: string;
  senderName: string;
  senderPhoto?: string;
  senderDesignation?: string;
  senderBranchName?: string;
  content: string;
  target: ChatTarget;
  createdAt: number;
}

const DEFAULT_CHANNELS: ChatTarget[] = [
  {
    id: 'general_all',
    name: 'General Staff Broadcast',
    type: 'channel',
    subtitle: 'All branches'
  },
  {
    id: 'operations_hub',
    name: 'Accounts & Operations',
    type: 'channel',
    subtitle: 'Operations team'
  },
  {
    id: 'remittance_loans',
    name: 'Loans & Remittance Desk',
    type: 'channel',
    subtitle: 'Credit & Remittance'
  }
];

const EMOJI_LIST = ['👍', '❤️', '👏', '🔥', '✅', '🚀', '🙏', '😊', '💡'];

export const StaffChatDrawer: React.FC<StaffChatDrawerProps> = ({ 
  isOpen, 
  onClose, 
  onOpen, 
  initialTarget 
}) => {
  const { user, isSuperAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Minimize & Sidebar Collapse state (Default to single chat view)
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Status Filter: 'all' | 'unread' | 'read' (Default: 'all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Category Tab State: 'recent' (Default) | 'channels' | 'user'
  const [activeTab, setActiveTab] = useState<'recent' | 'channels' | 'user'>('recent');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Selected Target (Channel or Direct Staff)
  const [activeTarget, setActiveTarget] = useState<ChatTarget>(DEFAULT_CHANNELS[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle incoming target selection from prop (e.g., clicking on notification)
  useEffect(() => {
    if (initialTarget) {
      setActiveTarget(initialTarget);
      setIsMinimized(false);
      setIsSidebarCollapsed(true);
    }
  }, [initialTarget]);

  // Incoming Notification Toast state
  const [incomingToast, setIncomingToast] = useState<IncomingToast | null>(null);

  // Window Dimension & Resizing
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>(() => {
    const savedW = localStorage.getItem('saccos_chat_w');
    const savedH = localStorage.getItem('saccos_chat_h');
    return {
      width: savedW ? Math.max(340, parseInt(savedW)) : 420,
      height: savedH ? Math.max(380, parseInt(savedH)) : 560
    };
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const isDraggingRef = useRef<{ type: 'corner' | 'left' | 'top'; startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Input State
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [replyMessage, setReplyMessage] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Close dropdowns on outside click
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Data
  const loadChatData = useCallback(async () => {
    try {
      const [allMsgs, allEmps, allUsers, allBranches] = await Promise.all([
        storageService.getChatMessages().catch(() => []),
        storageService.getEmployees().catch(() => []),
        storageService.getUsers().catch(() => []),
        storageService.getBranches().catch(() => [])
      ]);

      setMessages(allMsgs || []);
      setEmployees(allEmps || []);
      setUsersList(allUsers || []);
      setBranches(allBranches || []);
    } catch (err) {
      console.error("Failed to load chat data:", err);
    }
  }, []);

  useEffect(() => {
    loadChatData();
  }, [loadChatData]);

  // When isOpen changes to true, un-minimize
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      loadChatData();
    }
  }, [isOpen, loadChatData]);

  // Map branches by ID for name lookup
  const branchMap = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach(b => map.set(b.id, b.name));
    return map;
  }, [branches]);

  // User Chat Profile (for matching all aliases, employee codes, usernames, and IDs)
  const userProfile = useMemo(() => {
    return getUserChatProfile(user, employees, usersList);
  }, [user, employees, usersList]);

  // Compile Authorized Staff Targets (excluding current user)
  const staffTargets = useMemo<ChatTarget[]>(() => {
    const targets: ChatTarget[] = [];
    const addedIds = new Set<string>();
    const addedNames = new Set<string>();

    // 1. Add system users
    usersList.forEach(u => {
      const uId = String(u.id);
      const uUsername = normalizeText(u.username);
      const uFullName = normalizeText(u.fullName);
      // Exclude self
      if (userProfile.identifiers.has(uId) || userProfile.identifiers.has(uUsername) || userProfile.names.has(uFullName)) return;

      // Find matching employee if any
      const matchingEmp = employees.find(emp => {
        const empId = String(emp.id);
        const empCode = normalizeText(emp.employeeCode);
        const empName = normalizeText(emp.fullName);
        return (
          empId === uId ||
          empCode === uUsername ||
          empName === uFullName ||
          (empName && uFullName && (empName.includes(uFullName) || uFullName.includes(empName))) ||
          (emp.email && u.email && normalizeText(emp.email) === normalizeText(u.email)) ||
          (emp.mobile && u.mobile && emp.mobile.replace(/\D/g, '') === u.mobile.replace(/\D/g, ''))
        );
      });

      const bName = branchMap.get(matchingEmp?.branchId || u.branchId) || (u.branchId === 'main' ? 'Head Office' : u.branchId);
      const desig = matchingEmp?.designation || u.designation || (u.roleId === '1' ? 'Super Admin' : 'Staff Officer');

      addedIds.add(uId);
      if (matchingEmp) {
        addedIds.add(String(matchingEmp.id));
        if (matchingEmp.employeeCode) addedIds.add(normalizeText(matchingEmp.employeeCode));
        if (matchingEmp.fullName) addedNames.add(normalizeText(matchingEmp.fullName));
      }
      if (uFullName) addedNames.add(uFullName);
      if (uUsername) addedNames.add(uUsername);

      targets.push({
        id: u.id,
        name: u.fullName || matchingEmp?.fullName || u.username,
        type: 'direct',
        subtitle: desig,
        photo: u.profilePhoto || matchingEmp?.photoUrl,
        branchName: bName,
        designation: desig,
        isOnline: u.status === 'Active' || matchingEmp?.status === 'Active'
      });
    });

    // 2. Add employees who might not have user accounts yet
    employees.forEach(emp => {
      const empId = String(emp.id);
      const empCode = normalizeText(emp.employeeCode);
      const empName = normalizeText(emp.fullName);
      // Exclude self
      if (userProfile.identifiers.has(empId) || userProfile.identifiers.has(empCode) || userProfile.names.has(empName)) return;
      // Exclude if already added as user
      if (addedIds.has(empId) || (empCode && addedIds.has(empCode)) || (empName && addedNames.has(empName))) return;

      // Substring check against addedNames
      if (empName && Array.from(addedNames).some(an => an.length >= 3 && (empName.includes(an) || an.includes(empName)))) return;

      const bName = branchMap.get(emp.branchId) || 'Head Office';
      addedIds.add(empId);
      if (empCode) addedIds.add(empCode);
      if (empName) addedNames.add(empName);

      targets.push({
        id: emp.id,
        name: emp.fullName,
        type: 'direct',
        subtitle: emp.designation,
        photo: emp.photoUrl,
        branchName: bName,
        designation: emp.designation,
        isOnline: emp.status === 'Active'
      });
    });

    return targets;
  }, [usersList, employees, userProfile, branchMap]);

  // Dynamic Branch Channels
  const branchChannels = useMemo<ChatTarget[]>(() => {
    return branches.map(b => ({
      id: `channel_branch_${b.id}`,
      name: `${b.name} Channel`,
      type: 'channel',
      subtitle: `${b.code} Branch`,
      branchName: b.name
    }));
  }, [branches]);

  const allChannels = useMemo(() => {
    return [...DEFAULT_CHANNELS, ...branchChannels];
  }, [branchChannels]);

  // Map of all possible targets by ID
  const allTargetsMap = useMemo(() => {
    const map = new Map<string, ChatTarget>();
    allChannels.forEach(c => map.set(c.id, c));
    staffTargets.forEach(s => map.set(s.id, s));
    return map;
  }, [allChannels, staffTargets]);

  // Active target chat profile
  const activeTargetProfile = useMemo(() => {
    return getTargetChatProfile(activeTarget, employees, usersList);
  }, [activeTarget, employees, usersList]);

  // Handler to notify about incoming message
  const notifyIncomingMessage = useCallback((newMsg: ChatMessage) => {
    // Skip if from myself
    if (isMessageFromMe(newMsg, userProfile.identifiers, userProfile.names)) return;

    // Skip if not addressed to me
    if (!isMessageForMe(newMsg, userProfile.identifiers, userProfile.names, user?.branchId, userProfile.isSuperAdmin)) return;

    // Check if user is currently looking at this active conversation
    const isTargetCurrentlyActive = isOpen && !isMinimized && (
      (activeTarget.type === 'channel' && activeTarget.id === newMsg.channelId) ||
      (activeTarget.type === 'direct' && !newMsg.channelId && doesMessageBelongToTarget(
        newMsg,
        activeTarget,
        userProfile.identifiers,
        userProfile.names,
        activeTargetProfile.identifiers,
        activeTargetProfile.names
      ))
    );

    if (!isTargetCurrentlyActive) {
      // 1. Play audio chime
      playChatNotificationSound();

      // 2. Trigger native browser notification
      const notifTitle = newMsg.channelId
        ? `New post in ${allTargetsMap.get(newMsg.channelId)?.name || 'Channel'}`
        : `Message from ${newMsg.senderName}`;
      const notifBody = newMsg.content || (newMsg.attachments?.length ? 'Shared an attachment' : 'Sent you a message');
      triggerBrowserNotification(notifTitle, {
        body: notifBody,
        icon: newMsg.senderPhoto || undefined,
        tag: `saccos_msg_${newMsg.id}`
      });

      // 3. Resolve target to open
      let targetToOpen = allTargetsMap.get(newMsg.channelId || newMsg.senderId);
      if (!targetToOpen && !newMsg.channelId) {
        const found = staffTargets.find(s => {
          const tp = getTargetChatProfile(s, employees, usersList);
          return tp.identifiers.has(newMsg.senderId) || (newMsg.senderName && tp.names.has(normalizeText(newMsg.senderName)));
        });
        if (found) {
          targetToOpen = found;
        } else {
          targetToOpen = {
            id: newMsg.senderId,
            name: newMsg.senderName,
            type: 'direct',
            subtitle: newMsg.senderDesignation,
            photo: newMsg.senderPhoto,
            branchName: newMsg.senderBranchName
          };
        }
      }

      setIncomingToast({
        id: newMsg.id,
        senderName: newMsg.senderName,
        senderPhoto: newMsg.senderPhoto,
        senderDesignation: newMsg.senderDesignation,
        senderBranchName: newMsg.senderBranchName,
        content: newMsg.content || (newMsg.attachments?.length ? '📷 Sent an attachment' : 'New message'),
        target: targetToOpen || activeTarget,
        createdAt: Date.now()
      });
    }
  }, [userProfile, user?.branchId, isOpen, isMinimized, activeTarget, activeTargetProfile, allTargetsMap, staffTargets, employees, usersList]);

  // Track known message IDs to only notify on genuinely new messages
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadDoneRef = useRef(false);

  // Real-time Event Listener, BroadcastChannel & Polling with Notification Toast
  useEffect(() => {
    const handleNewMessage = (e: Event) => {
      const newMsg = (e as CustomEvent<ChatMessage>).detail;
      if (newMsg && newMsg.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) {
            return prev.map(m => m.id === newMsg.id ? newMsg : m);
          }
          return [...prev, newMsg];
        });

        if (!knownMessageIdsRef.current.has(newMsg.id)) {
          knownMessageIdsRef.current.add(newMsg.id);
          notifyIncomingMessage(newMsg);
        }
      }
    };

    const handleDeleteMessage = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail || {};
      if (id) {
        setMessages(prev => prev.filter(m => m.id !== id));
      }
    };

    const handleReaction = (e: Event) => {
      const { messageId, reactions } = (e as CustomEvent<{ messageId: string; reactions: ChatReaction[] }>).detail || {};
      if (messageId) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
      }
    };

    const handleStorageChange = () => {
      storageService.getChatMessages().then(msgs => {
        if (msgs) setMessages(msgs);
      }).catch(() => {});
    };

    // Cross-tab broadcast listener
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('saccos_chat_broadcast');
        broadcastChannel.onmessage = (event) => {
          const { type, detail } = event.data || {};
          if (type === 'saccos_chat_message' && detail?.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === detail.id)) {
                return prev.map(m => m.id === detail.id ? detail : m);
              }
              return [...prev, detail];
            });

            if (!knownMessageIdsRef.current.has(detail.id)) {
              knownMessageIdsRef.current.add(detail.id);
              notifyIncomingMessage(detail);
            }
          } else if (type === 'saccos_chat_delete' && detail?.id) {
            setMessages(prev => prev.filter(m => m.id !== detail.id));
          } else if (type === 'saccos_chat_reaction' && detail?.messageId) {
            setMessages(prev => prev.map(m => m.id === detail.messageId ? { ...m, reactions: detail.reactions } : m));
          } else if (type === 'saccos_chat_read' && detail?.messageIds) {
            setMessages(prev => prev.map(m => {
              if (detail.messageIds.includes(m.id)) {
                const readBy = m.readBy || [];
                if (!readBy.includes(detail.userId)) {
                  return { ...m, readBy: [...readBy, detail.userId] };
                }
              }
              return m;
            }));
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }

    // Periodic check from cloud storage
    const checkServerMessages = () => {
      storageService.getChatMessages().then(msgs => {
        if (msgs && msgs.length) {
          if (!isInitialLoadDoneRef.current) {
            msgs.forEach(m => knownMessageIdsRef.current.add(m.id));
            isInitialLoadDoneRef.current = true;
            setMessages(msgs);
            return;
          }

          const newlyReceived: ChatMessage[] = [];
          msgs.forEach(m => {
            if (!knownMessageIdsRef.current.has(m.id)) {
              knownMessageIdsRef.current.add(m.id);
              newlyReceived.push(m);
            }
          });

          setMessages(msgs);

          if (newlyReceived.length > 0) {
            const incomingForMe = newlyReceived.filter(m =>
              !isMessageFromMe(m, userProfile.identifiers, userProfile.names) &&
              isMessageForMe(m, userProfile.identifiers, userProfile.names, user?.branchId, userProfile.isSuperAdmin)
            );
            if (incomingForMe.length > 0) {
              notifyIncomingMessage(incomingForMe[incomingForMe.length - 1]);
            }
          }
        }
      }).catch(() => {});
    };

    window.addEventListener('saccos_chat_message', handleNewMessage);
    window.addEventListener('saccos_chat_delete', handleDeleteMessage);
    window.addEventListener('saccos_chat_reaction', handleReaction);
    window.addEventListener('storage', handleStorageChange);

    const pollInterval = setInterval(checkServerMessages, 2500);

    return () => {
      window.removeEventListener('saccos_chat_message', handleNewMessage);
      window.removeEventListener('saccos_chat_delete', handleDeleteMessage);
      window.removeEventListener('saccos_chat_reaction', handleReaction);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [notifyIncomingMessage, user?.branchId, userProfile.identifiers, userProfile.isSuperAdmin, userProfile.names]);

  // Auto dismiss toast after 6 seconds
  useEffect(() => {
    if (incomingToast) {
      const timer = setTimeout(() => {
        setIncomingToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [incomingToast]);

  // Request browser notification permission when user opens chat
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [isOpen]);

  // Compile "Recent" conversations based on actual chat history
  const recentTargets = useMemo<ChatTarget[]>(() => {
    const targetLastMessageMap = new Map<string, { lastText: string; time: number }>();
    const sortedMsgs = [...messages].sort((a, b) => b.createdAt - a.createdAt);

    sortedMsgs.forEach(m => {
      let targetId = '';
      if (m.channelId) {
        targetId = m.channelId;
      } else {
        const fromMe = isMessageFromMe(m, userProfile.identifiers, userProfile.names);
        const forMe = isMessageForMe(m, userProfile.identifiers, userProfile.names, user?.branchId, userProfile.isSuperAdmin);

        if (fromMe && m.recipientId) {
          targetId = m.recipientId;
        } else if (forMe && m.senderId) {
          targetId = m.senderId;
        }
      }

      if (targetId && !targetLastMessageMap.has(targetId)) {
        const text = m.content || (m.attachments && m.attachments.length > 0 ? (m.attachments[0].type === 'image' ? '📷 Image' : '📎 Document') : 'Message');
        targetLastMessageMap.set(targetId, {
          lastText: text,
          time: m.createdAt
        });
      }
    });

    const recents: ChatTarget[] = [];
    targetLastMessageMap.forEach((data, targetId) => {
      let existing = allTargetsMap.get(targetId);
      if (!existing) {
        const found = staffTargets.find(s => {
          const tp = getTargetChatProfile(s, employees, usersList);
          return tp.identifiers.has(targetId);
        });
        if (found) existing = found;
      }

      if (existing) {
        recents.push({
          ...existing,
          lastMessage: data.lastText,
          lastMessageTime: data.time
        });
      }
    });

    if (recents.length === 0) {
      allChannels.slice(0, 3).forEach(c => recents.push(c));
      staffTargets.slice(0, 3).forEach(s => recents.push(s));
    }

    return recents;
  }, [messages, userProfile, user?.branchId, allTargetsMap, staffTargets, allChannels, employees, usersList]);

  // Unread Count per target map & Total Unread Count
  const { unreadCountMap, totalUnreadCount } = useMemo(() => {
    const counts = new Map<string, number>();
    let total = 0;
    if (!user) return { unreadCountMap: counts, totalUnreadCount: 0 };

    messages.forEach(m => {
      if (isMessageFromMe(m, userProfile.identifiers, userProfile.names)) return;
      if (!isMessageForMe(m, userProfile.identifiers, userProfile.names, user.branchId, userProfile.isSuperAdmin)) return;

      const readBy = Array.isArray(m.readBy) ? m.readBy : [];
      const hasRead = Array.from(userProfile.identifiers).some(id => readBy.includes(id));
      if (hasRead) return;

      total += 1;
      if (m.channelId) {
        counts.set(m.channelId, (counts.get(m.channelId) || 0) + 1);
      } else {
        let matchedTargetId = m.senderId;
        const matchingStaff = staffTargets.find(s => {
          const tp = getTargetChatProfile(s, employees, usersList);
          return tp.identifiers.has(m.senderId) || (m.senderName && tp.names.has(normalizeText(m.senderName)));
        });
        if (matchingStaff) {
          matchedTargetId = matchingStaff.id;
        }

        counts.set(matchedTargetId, (counts.get(matchedTargetId) || 0) + 1);
        if (m.senderId !== matchedTargetId) {
          counts.set(m.senderId, (counts.get(m.senderId) || 0) + 1);
        }
      }
    });

    return { unreadCountMap: counts, totalUnreadCount: total };
  }, [messages, user, userProfile, staffTargets, employees, usersList]);

  // Mark active messages as read when active
  useEffect(() => {
    if (!isOpen || isMinimized || !user?.id) return;
    
    const unreadIds = messages.filter(m => {
      const belongs = doesMessageBelongToTarget(
        m,
        activeTarget,
        userProfile.identifiers,
        userProfile.names,
        activeTargetProfile.identifiers,
        activeTargetProfile.names
      );

      const fromMe = isMessageFromMe(m, userProfile.identifiers, userProfile.names);
      const readBy = Array.isArray(m.readBy) ? m.readBy : [];
      const hasRead = Array.from(userProfile.identifiers).some(id => readBy.includes(id));

      return belongs && !fromMe && !hasRead;
    }).map(m => m.id);

    if (unreadIds.length > 0) {
      storageService.markChatRead(unreadIds, user.id);
    }
  }, [isOpen, isMinimized, activeTarget, messages, user?.id, userProfile, activeTargetProfile]);

  // Filtered List of Targets based on active category tab, status filter (all, unread, read) & search query
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // 1. Get base list by active category tab
    let baseList: ChatTarget[] = [];
    if (activeTab === 'recent') {
      baseList = recentTargets;
    } else if (activeTab === 'channels') {
      baseList = allChannels;
    } else {
      baseList = staffTargets;
    }

    // 2. Apply Status Filter (all | unread | read)
    if (statusFilter === 'unread') {
      baseList = baseList.filter(item => (unreadCountMap.get(item.id) || 0) > 0);
    } else if (statusFilter === 'read') {
      baseList = baseList.filter(item => (unreadCountMap.get(item.id) || 0) === 0);
    }

    // 3. Apply Search Query
    if (q) {
      baseList = baseList.filter(item => 
        item.name.toLowerCase().includes(q) || 
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.designation && item.designation.toLowerCase().includes(q)) ||
        (item.lastMessage && item.lastMessage.toLowerCase().includes(q))
      );
    }

    return baseList;
  }, [activeTab, statusFilter, recentTargets, allChannels, staffTargets, searchQuery, unreadCountMap]);

  // Counts for tabs/filters
  const unreadCategoryCounts = useMemo(() => {
    let recentUnread = 0;
    let channelsUnread = 0;
    let userUnread = 0;

    recentTargets.forEach(t => {
      if ((unreadCountMap.get(t.id) || 0) > 0) recentUnread++;
    });
    allChannels.forEach(t => {
      if ((unreadCountMap.get(t.id) || 0) > 0) channelsUnread++;
    });
    staffTargets.forEach(t => {
      if ((unreadCountMap.get(t.id) || 0) > 0) userUnread++;
    });

    return { recentUnread, channelsUnread, userUnread };
  }, [recentTargets, allChannels, staffTargets, unreadCountMap]);

  // Filtered Messages for the active target
  const currentMessages = useMemo(() => {
    return messages.filter(m => {
      return doesMessageBelongToTarget(
        m,
        activeTarget,
        userProfile.identifiers,
        userProfile.names,
        activeTargetProfile.identifiers,
        activeTargetProfile.names
      );
    });
  }, [messages, activeTarget, userProfile, activeTargetProfile]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTarget]);

  // Handle Target Selection
  const handleSelectTarget = (target: ChatTarget) => {
    setActiveTarget(target);
  };

  // Open from Notification Toast
  const handleOpenFromToast = (toast: IncomingToast) => {
    if (onOpen) onOpen();
    setIsMinimized(false);
    setActiveTarget(toast.target);
    setIncomingToast(null);
  };

  // Inline Quick Reply directly from Teams notification toast
  const handleSendInlineReply = async (text: string, toast: IncomingToast) => {
    if (!text.trim() || !user) return;
    const currentBranchName = branchMap.get(user.branchId) || 'Head Office';
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      channelId: toast.target.type === 'channel' ? toast.target.id : undefined,
      recipientId: toast.target.type === 'direct' ? toast.target.id : undefined,
      recipientName: toast.target.type === 'direct' ? toast.target.name : undefined,
      senderId: user.id,
      senderName: user.fullName || user.username,
      senderUsername: user.username,
      senderDesignation: user.designation || (isSuperAdmin ? 'Super Admin' : 'Staff Officer'),
      senderBranchId: user.branchId,
      senderBranchName: currentBranchName,
      senderPhoto: user.profilePhoto,
      content: text.trim(),
      createdAt: Date.now(),
      readBy: [user.id]
    };

    setMessages(prev => [...prev, newMsg]);
    await storageService.sendChatMessage(newMsg);
  };

  // Toggle Sidebar Collapse & Auto-adjust width if needed
  const handleToggleSidebar = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
    if (!collapsed && windowSize.width < 580) {
      setWindowSize(prev => ({
        ...prev,
        width: Math.min(620, window.innerWidth - 30)
      }));
    }
  };

  // Resize Handlers (Drag to resize freely)
  const handleMouseDownResize = (e: React.MouseEvent, type: 'corner' | 'left' | 'top') => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startW: windowSize.width,
      startH: windowSize.height
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const { type, startX, startY, startW, startH } = isDraggingRef.current;
      const deltaX = startX - moveEvent.clientX; // Dragging left increases width
      const deltaY = startY - moveEvent.clientY; // Dragging up increases height

      let newW = startW;
      let newH = startH;

      if (type === 'corner' || type === 'left') {
        newW = Math.min(Math.max(340, startW + deltaX), window.innerWidth - 30);
      }
      if (type === 'corner' || type === 'top') {
        newH = Math.min(Math.max(360, startH + deltaY), window.innerHeight - 30);
      }

      setWindowSize({ width: newW, height: newH });
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        localStorage.setItem('saccos_chat_w', windowSize.width.toString());
        localStorage.setItem('saccos_chat_h', windowSize.height.toString());
      }
      isDraggingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle File & Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const files = e.target.files;
    if (!files || !files.length) return;

    setIsUploading(true);
    const newAttachments: ChatAttachment[] = [];

    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum allowed size is 10MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const isImg = file.type.startsWith('image/') || type === 'image';
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        
        newAttachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url: base64,
          size: file.size,
          type: isImg ? 'image' : (isPdf ? 'pdf' : 'file'),
          mimeType: file.type
        });

        if (newAttachments.length === files.length) {
          setAttachments(prev => [...prev, ...newAttachments]);
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeAttachment = (attId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || !user) return;

    const currentBranchName = branchMap.get(user.branchId) || 'Head Office';

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      channelId: activeTarget.type === 'channel' ? activeTarget.id : undefined,
      recipientId: activeTarget.type === 'direct' ? activeTarget.id : undefined,
      recipientName: activeTarget.type === 'direct' ? activeTarget.name : undefined,
      senderId: user.id,
      senderName: user.fullName || user.username,
      senderUsername: user.username,
      senderDesignation: user.designation || (isSuperAdmin ? 'Super Admin' : 'Staff Officer'),
      senderBranchId: user.branchId,
      senderBranchName: currentBranchName,
      senderPhoto: user.profilePhoto,
      content: inputText.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      replyTo: replyMessage ? {
        id: replyMessage.id,
        senderName: replyMessage.senderName,
        content: replyMessage.content || (replyMessage.attachments?.length ? 'Shared an attachment' : '')
      } : undefined,
      readBy: Array.from(new Set([user.id, ...Array.from(userProfile.identifiers)])),
      createdAt: Date.now()
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setAttachments([]);
    setReplyMessage(null);
    setShowEmojiPicker(false);

    try {
      await storageService.sendChatMessage(newMsg);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      await storageService.deleteChatMessage(msgId);
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  // React to message
  const handleReactionClick = async (messageId: string, emoji: string) => {
    if (!user) return;
    try {
      await storageService.addChatReaction(messageId, {
        emoji,
        userId: user.id,
        userName: user.fullName || user.username
      });
    } catch (err) {
      console.error("Failed to react to message:", err);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (timestamp: number) => {
    const d = new Date(timestamp);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isFullMaximized = isMaximized;

  // Selected Category Tab Info
  const activeTabDetails = {
    recent: { label: 'Recent', icon: Clock, count: unreadCategoryCounts.recentUnread },
    channels: { label: 'Channels', icon: Users, count: unreadCategoryCounts.channelsUnread },
    user: { label: 'User', icon: UserIcon, count: unreadCategoryCounts.userUnread },
  }[activeTab];

  return (
    <>
      {/* 1. Global Teams-style Incoming Notification Toast in Bottom-Right */}
      {incomingToast && (
        <TeamsNotificationToast
          toast={{
            id: incomingToast.id,
            senderName: incomingToast.senderName,
            senderPhoto: incomingToast.senderPhoto,
            senderDesignation: incomingToast.senderDesignation,
            senderBranchName: incomingToast.senderBranchName,
            content: incomingToast.content,
            channelName: incomingToast.target.type === 'channel' ? incomingToast.target.name : undefined,
            createdAt: incomingToast.createdAt
          }}
          onClose={() => setIncomingToast(null)}
          onOpenChat={() => handleOpenFromToast(incomingToast)}
          onSendInlineReply={(text) => handleSendInlineReply(text, incomingToast)}
        />
      )}

      {/* 2. Minimized Floating Pill Widget (When minimized) */}
      {isOpen && isMinimized && (
        <div className="fixed bottom-4 right-4 z-[6000] animate-in slide-in-from-bottom-3 duration-200">
          <div 
            onClick={() => setIsMinimized(false)}
            className="flex items-center space-x-2.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full shadow-2xl border-2 border-emerald-400/50 cursor-pointer transition-all hover:scale-105 select-none"
            title="Click to restore chat"
          >
            <div className="relative flex items-center justify-center">
              <MessageSquare size={18} />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[17px] h-[17px] bg-rose-500 text-white rounded-full border-2 border-white text-[9px] font-black flex items-center justify-center px-1 animate-pulse">
                  {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                </span>
              )}
            </div>
            
            <span className="text-xs font-black tracking-tight">
              Staff Messages
            </span>

            {totalUnreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[10px] font-black">
                {totalUnreadCount} new
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-0.5 rounded-full hover:bg-white/20 text-emerald-100 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close chat"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Resizable Messenger Box (When open and not minimized) */}
      {isOpen && !isMinimized && (
        <div className="fixed inset-0 z-[6000] pointer-events-none flex items-end justify-end p-3 sm:p-4">
          <div 
            style={{
              width: isFullMaximized ? 'calc(100vw - 24px)' : `${windowSize.width}px`,
              height: isFullMaximized ? 'calc(100vh - 24px)' : `${windowSize.height}px`,
              maxWidth: '100vw',
              maxHeight: '100vh'
            }}
            className="pointer-events-auto relative bg-white border border-emerald-200/90 shadow-2xl rounded-2xl flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200 transition-[width,height] ease-out"
          >
            
            {/* Resize Handles (Top Edge, Left Edge, Top-Left Corner) */}
            {!isFullMaximized && (
              <>
                {/* Top-Left Corner Drag Handle */}
                <div 
                  onMouseDown={(e) => handleMouseDownResize(e, 'corner')}
                  className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-50 group flex items-center justify-center"
                  title="Drag to resize box"
                >
                  <div className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full opacity-40 group-hover:opacity-100 group-hover:scale-150 transition-all" />
                </div>
                {/* Top Border Drag Handle */}
                <div 
                  onMouseDown={(e) => handleMouseDownResize(e, 'top')}
                  className="absolute top-0 left-4 right-10 h-1.5 cursor-ns-resize z-40 hover:bg-emerald-400/30 transition-colors"
                  title="Drag to adjust height"
                />
                {/* Left Border Drag Handle */}
                <div 
                  onMouseDown={(e) => handleMouseDownResize(e, 'left')}
                  className="absolute top-4 bottom-4 left-0 w-1.5 cursor-ew-resize z-40 hover:bg-emerald-400/30 transition-colors"
                  title="Drag to adjust width"
                />
              </>
            )}

            {/* Top Header - Compact Action Bar */}
            <div className="h-9 px-3 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white flex items-center justify-end shrink-0 shadow-xs select-none">
              {/* Header Action Controls: Refresh, Minimize, Maximize, Close */}
              <div className="flex items-center space-x-1">
                <button 
                  onClick={loadChatData}
                  title="Refresh"
                  className="p-1 text-emerald-100 hover:text-white hover:bg-white/15 rounded-md transition-all cursor-pointer"
                >
                  <RefreshCw size={13} />
                </button>
                
                {/* Minimize Button (Minus / Dock to pill) */}
                <button 
                  onClick={() => setIsMinimized(true)}
                  className="p-1 text-emerald-100 hover:text-white hover:bg-white/15 rounded-md transition-all cursor-pointer"
                  title="Minimize (Keep running in background)"
                >
                  <Minus size={13} />
                </button>

                {/* Maximize / Restore Button */}
                <button 
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1 text-emerald-100 hover:text-white hover:bg-white/15 rounded-md transition-all cursor-pointer"
                  title={isMaximized ? "Restore Size" : "Maximize"}
                >
                  {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>

                {/* Close Button */}
                <button 
                  onClick={onClose}
                  className="p-1 text-emerald-100 hover:text-white hover:bg-rose-500/80 rounded-md transition-all cursor-pointer"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Messenger Dual-Pane Body: Left User/Channel List + Right Live Chat Area */}
            <div className="flex-1 flex overflow-hidden bg-slate-50">
              
              {/* Left Panel: Conversations List with Compact Dropdown Filters & Search */}
              {!isSidebarCollapsed && (
                <div className="w-[200px] sm:w-[220px] md:w-[240px] border-r border-emerald-100 bg-white flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-left-2 duration-150">
                  
                  {/* Compact Dropdown Bar: Status Filter Dropdown & Category (Recent/Channels/User) Dropdown */}
                  <div className="p-2 border-b border-slate-100 bg-slate-50/70 space-y-1.5">
                    
                    {/* Two Dropdown Selectors Side-by-Side */}
                    <div className="grid grid-cols-2 gap-1.5">
                      
                      {/* 1. Category Dropdown (Recent, Channels, User) with Arrow */}
                      <div className="relative" ref={categoryDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                            setIsStatusDropdownOpen(false);
                          }}
                          className="w-full px-2 py-1 bg-white border border-emerald-300/80 hover:border-emerald-500 rounded-lg text-[10px] font-extrabold text-emerald-800 flex items-center justify-between shadow-2xs transition-all cursor-pointer"
                          title="Select category"
                        >
                          <div className="flex items-center space-x-1 truncate">
                            <activeTabDetails.icon size={11} className="text-emerald-600 shrink-0" />
                            <span className="truncate">{activeTabDetails.label}</span>
                          </div>
                          <ChevronDown size={12} className={`text-emerald-700 transition-transform shrink-0 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Category Dropdown Menu */}
                        {isCategoryDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-emerald-200 rounded-xl shadow-xl z-50 p-1 space-y-0.5 animate-in zoom-in-95 duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('recent');
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg text-left text-[10px] font-bold flex items-center justify-between cursor-pointer ${
                                activeTab === 'recent' ? 'bg-emerald-100/80 text-emerald-900 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5">
                                <Clock size={11} className="text-emerald-700" />
                                <span>Recent</span>
                              </div>
                              {unreadCategoryCounts.recentUnread > 0 && (
                                <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[9px] font-black">
                                  {unreadCategoryCounts.recentUnread}
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('channels');
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg text-left text-[10px] font-bold flex items-center justify-between cursor-pointer ${
                                activeTab === 'channels' ? 'bg-emerald-100/80 text-emerald-900 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5">
                                <Users size={11} className="text-emerald-700" />
                                <span>Channels</span>
                              </div>
                              {unreadCategoryCounts.channelsUnread > 0 && (
                                <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[9px] font-black">
                                  {unreadCategoryCounts.channelsUnread}
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('user');
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg text-left text-[10px] font-bold flex items-center justify-between cursor-pointer ${
                                activeTab === 'user' ? 'bg-emerald-100/80 text-emerald-900 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5">
                                <UserIcon size={11} className="text-emerald-700" />
                                <span>User</span>
                              </div>
                              {unreadCategoryCounts.userUnread > 0 && (
                                <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[9px] font-black">
                                  {unreadCategoryCounts.userUnread}
                                </span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 2. Status Filter Dropdown (All [Default], Unread, Read) with Arrow */}
                      <div className="relative" ref={statusDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsStatusDropdownOpen(!isStatusDropdownOpen);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-300 hover:border-emerald-500 rounded-lg text-[10px] font-extrabold text-slate-700 flex items-center justify-between shadow-2xs transition-all cursor-pointer"
                          title="Filter messages status"
                        >
                          <div className="flex items-center space-x-1 truncate">
                            <Filter size={10} className="text-slate-500 shrink-0" />
                            <span className="truncate">{statusFilter === 'all' ? 'All' : statusFilter === 'unread' ? 'Unread' : 'Read'}</span>
                          </div>
                          <ChevronDown size={12} className={`text-slate-500 transition-transform shrink-0 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Status Dropdown Menu */}
                        {isStatusDropdownOpen && (
                          <div className="absolute top-full right-0 mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 space-y-0.5 animate-in zoom-in-95 duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                setStatusFilter('all');
                                setIsStatusDropdownOpen(false);
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg text-left text-[10px] font-bold flex items-center justify-between cursor-pointer ${
                                statusFilter === 'all' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>All (Default)</span>
                              {statusFilter === 'all' && <Check size={12} className="text-emerald-700" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setStatusFilter('unread');
                                setIsStatusDropdownOpen(false);
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg text-left text-[10px] font-bold flex items-center justify-between cursor-pointer ${
                                statusFilter === 'unread' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>Unread</span>
                              {totalUnreadCount > 0 && (
                                <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[9px] font-black">
                                  {totalUnreadCount}
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setStatusFilter('read');
                                setIsStatusDropdownOpen(false);
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg text-left text-[10px] font-bold flex items-center justify-between cursor-pointer ${
                                statusFilter === 'read' ? 'bg-emerald-50 text-emerald-800 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>Read</span>
                              {statusFilter === 'read' && <Check size={12} className="text-emerald-700" />}
                            </button>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Search Input Box */}
                    <div className="relative flex items-center">
                      <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                      <input 
                        type="text"
                        placeholder="Search staff, channels..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-8 pl-8 pr-7 bg-white border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Clear search"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Left Stream: User / Channel List */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                    {filteredList.length === 0 ? (
                      <div className="p-4 text-center text-[11px] text-slate-400 font-medium">
                        {statusFilter === 'unread' ? 'No unread messages.' : 'No conversations found.'}
                      </div>
                    ) : (
                      filteredList.map(item => {
                        const isSelected = activeTarget.id === item.id;
                        const unread = unreadCountMap.get(item.id) || 0;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectTarget(item)}
                            className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer ${
                              isSelected 
                                ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/90 shadow-2xs' 
                                : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              {/* Avatar / Icon */}
                              <div className="relative shrink-0">
                                {item.type === 'channel' ? (
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                                    isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100'
                                  }`}>
                                    {item.branchName ? <Building2 size={13} /> : <Users size={13} />}
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 overflow-hidden">
                                    {item.photo ? (
                                      <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                      item.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                )}
                                {item.type === 'direct' && (
                                  <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white ${
                                    item.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`} />
                                )}
                              </div>

                              {/* Target Details */}
                              <div className="min-w-0">
                                <div className="text-[11px] truncate font-bold text-slate-800">
                                  {item.name}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate">
                                  {item.lastMessage ? (
                                    <span className="text-emerald-700 font-medium truncate block">{item.lastMessage}</span>
                                  ) : (
                                    item.subtitle || item.designation || 'Available'
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Unread Badge / Time */}
                            <div className="flex flex-col items-end shrink-0 ml-1">
                              {item.lastMessageTime && (
                                <span className="text-[8px] text-slate-400 font-medium">
                                  {formatTime(item.lastMessageTime)}
                                </span>
                              )}
                              {unread > 0 && (
                                <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-black rounded-full mt-0.5 shadow-2xs animate-pulse">
                                  {unread}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom Toggle Bar (Position highlighted in red box: Click to hide sidebar and show only chat) */}
                  <div className="p-1.5 border-t border-slate-200/80 bg-slate-50 flex items-center justify-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSidebar(true)}
                      className="w-full py-1 px-2 rounded-lg bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 flex items-center justify-center gap-1.5 text-[10px] font-black transition-all shadow-2xs cursor-pointer group"
                      title="Hide staff list & show only chat"
                    >
                      <ChevronLeft size={13} className="text-slate-500 group-hover:text-emerald-700 transition-transform group-hover:-translate-x-0.5" />
                      <span>Hide Staff List</span>
                    </button>
                  </div>

                </div>
              )}

              {/* Right Panel: Active Chat Stream & Header (Always shows active user/channel name on top) */}
              <div className="flex-1 bg-slate-50/70 flex flex-col overflow-hidden relative">
                
                {/* Active Chat Top Header Bar - Explicitly displays selected User/Channel Name & Status */}
                <div className="h-10 px-3 bg-white border-b border-emerald-100 flex items-center justify-between shrink-0 shadow-2xs">
                  <div className="flex items-center space-x-2 min-w-0">
                    {/* Show List Arrow button when sidebar is collapsed */}
                    {isSidebarCollapsed && (
                      <button
                        type="button"
                        onClick={() => handleToggleSidebar(false)}
                        className="mr-0.5 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 text-[10px] font-black shadow-2xs transition-all cursor-pointer group"
                        title="Show staff list"
                      >
                        <ChevronRight size={13} className="text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                        <span>Staff List</span>
                      </button>
                    )}
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] flex items-center justify-center overflow-hidden shrink-0">
                      {activeTarget.photo ? (
                        <img src={activeTarget.photo} alt={activeTarget.name} className="w-full h-full object-cover" />
                      ) : activeTarget.type === 'channel' ? (
                        <Building2 size={12} />
                      ) : (
                        activeTarget.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                        <span className="truncate">{activeTarget.name}</span>
                        {activeTarget.type === 'direct' && (
                          <span className={`w-1.5 h-1.5 rounded-full ${activeTarget.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-medium shrink-0">
                    {activeTarget.designation || activeTarget.subtitle || (activeTarget.type === 'channel' ? 'Broadcast Room' : 'Direct Message')}
                  </div>
                </div>

                {/* Message Stream Area */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {currentMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-1.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Sparkles size={16} />
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        Chat with {activeTarget.name}
                      </div>
                      <div className="text-[10px] text-slate-400 max-w-[180px]">
                        Send a message, file, or image to start conversation.
                      </div>
                    </div>
                  ) : (
                    currentMessages.map((msg, index) => {
                      const isMine = isMessageFromMe(msg, userProfile.identifiers, userProfile.names);
                      const prevMsg = index > 0 ? currentMessages[index - 1] : null;
                      const showDateHeader = !prevMsg || formatDateLabel(msg.createdAt) !== formatDateLabel(prevMsg.createdAt);

                      return (
                        <React.Fragment key={msg.id}>
                          {/* Date Separator */}
                          {showDateHeader && (
                            <div className="flex items-center justify-center my-1">
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-600 text-[9px] font-bold uppercase tracking-wider">
                                {formatDateLabel(msg.createdAt)}
                              </span>
                            </div>
                          )}

                          {/* Message Bubble Item */}
                          <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group`}>
                            
                            {!isMine && (
                              <div className="flex items-center space-x-1.5 mb-0.5 pl-1 text-[10px] font-bold text-emerald-800">
                                <span>{msg.senderName}</span>
                                {msg.senderDesignation && (
                                  <span className="text-[9px] font-normal text-slate-400">
                                    ({msg.senderDesignation})
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-end space-x-1 max-w-[88%]">
                              
                              {/* Main Bubble Container */}
                              <div className={`rounded-2xl p-2 shadow-2xs relative transition-all ${
                                isMine 
                                  ? 'bg-emerald-600 text-white rounded-br-xs' 
                                  : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80'
                              }`}>

                                {/* Quoted Reply snippet */}
                                {msg.replyTo && (
                                  <div className={`mb-1 p-1.5 rounded-lg border-l-2 text-[10px] ${
                                    isMine 
                                      ? 'bg-emerald-700/60 border-emerald-300 text-emerald-50' 
                                      : 'bg-slate-50 border-emerald-500 text-slate-600'
                                  }`}>
                                    <div className="text-[9px] font-bold">{msg.replyTo.senderName}</div>
                                    <div className="truncate">{msg.replyTo.content}</div>
                                  </div>
                                )}

                                {/* Text Content */}
                                {msg.content && (
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap font-normal break-words">
                                    {msg.content}
                                  </p>
                                )}

                                {/* Attachments Section */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {msg.attachments.map(att => (
                                      <div key={att.id}>
                                        {att.type === 'image' ? (
                                          <div className="relative group/img rounded-xl overflow-hidden border border-slate-200 shadow-2xs max-w-xs">
                                            <img 
                                              src={att.url} 
                                              alt={att.name} 
                                              className="max-h-40 w-full object-cover cursor-pointer hover:opacity-95"
                                              onClick={() => setPreviewImage(att.url)}
                                            />
                                            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                              <button
                                                onClick={() => setPreviewImage(att.url)}
                                                className="p-1.5 bg-white text-slate-800 rounded-lg shadow-xs"
                                                title="View full"
                                              >
                                                <Maximize2 size={12} />
                                              </button>
                                              <a
                                                href={att.url}
                                                download={att.name}
                                                className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs"
                                                title="Download"
                                              >
                                                <Download size={12} />
                                              </a>
                                            </div>
                                          </div>
                                        ) : (
                                          <a
                                            href={att.url}
                                            download={att.name}
                                            className={`flex items-center justify-between p-1.5 rounded-xl border transition-all ${
                                              isMine 
                                                ? 'bg-emerald-700/50 border-emerald-400/40 text-white' 
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                            }`}
                                          >
                                            <div className="flex items-center space-x-1.5 min-w-0 mr-2">
                                              <div className="p-1 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
                                                <FileText size={13} />
                                              </div>
                                              <div className="min-w-0">
                                                <div className="text-[11px] font-bold truncate">{att.name}</div>
                                                <div className="text-[8px] opacity-75">{formatFileSize(att.size)}</div>
                                              </div>
                                            </div>
                                            <div className="p-1 rounded-md bg-emerald-600 text-white shrink-0">
                                              <Download size={11} />
                                            </div>
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Reactions Display */}
                                {msg.reactions && msg.reactions.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                                      const count = msg.reactions?.filter(r => r.emoji === emoji).length || 0;
                                      const hasMyReaction = msg.reactions?.some(r => r.emoji === emoji && r.userId === user?.id);
                                      return (
                                        <button
                                          key={emoji}
                                          onClick={() => handleReactionClick(msg.id, emoji)}
                                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border transition-all flex items-center space-x-0.5 cursor-pointer ${
                                            hasMyReaction 
                                              ? 'bg-emerald-100 border-emerald-400 text-emerald-800' 
                                              : 'bg-slate-50 border-slate-200 text-slate-700'
                                          }`}
                                        >
                                          <span>{emoji}</span>
                                          <span className="text-[8px]">{count}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Time & Read Status Footer */}
                                <div className="mt-0.5 flex items-center justify-end space-x-1 text-[8px] opacity-75">
                                  <span>{formatTime(msg.createdAt)}</span>
                                  {isMine && (
                                    <span>
                                      {msg.readBy && msg.readBy.length > 1 ? (
                                        <CheckCheck size={10} className="text-emerald-200" />
                                      ) : (
                                        <Check size={10} className="text-white" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Quick Message Actions on Hover */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 pb-0.5">
                                <button
                                  onClick={() => setReplyMessage(msg)}
                                  className="p-1 rounded-md bg-white text-slate-500 hover:text-emerald-700 shadow-2xs border border-slate-200 transition-all cursor-pointer"
                                  title="Reply"
                                >
                                  <CornerDownRight size={10} />
                                </button>

                                {['👍', '❤️'].map(emo => (
                                  <button
                                    key={emo}
                                    onClick={() => handleReactionClick(msg.id, emo)}
                                    className="p-0.5 rounded-md bg-white text-slate-600 hover:bg-slate-50 shadow-2xs border border-slate-200 transition-all text-[10px] cursor-pointer"
                                    title={`React with ${emo}`}
                                  >
                                    {emo}
                                  </button>
                                ))}

                                {(isMine || isSuperAdmin) && (
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="p-1 rounded-md bg-white text-slate-400 hover:text-rose-600 shadow-2xs border border-slate-200 transition-all cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Replying Notice Banner */}
                {replyMessage && (
                  <div className="px-3 py-1 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between text-[11px] text-emerald-900 shrink-0">
                    <div className="flex items-center space-x-1.5 truncate">
                      <CornerDownRight size={11} className="text-emerald-700 shrink-0" />
                      <span className="font-bold">Replying to {replyMessage.senderName}:</span>
                      <span className="truncate opacity-80">{replyMessage.content || 'Attachment'}</span>
                    </div>
                    <button 
                      onClick={() => setReplyMessage(null)}
                      className="p-0.5 hover:bg-emerald-100 rounded-md text-emerald-800 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                {/* Pending Attachments List */}
                {attachments.length > 0 && (
                  <div className="px-3 py-1 bg-white border-t border-slate-200 flex flex-wrap gap-1 shrink-0">
                    {attachments.map(att => (
                      <div 
                        key={att.id}
                        className="flex items-center space-x-1 pl-1.5 pr-1 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700"
                      >
                        {att.type === 'image' ? <ImageIcon size={11} className="text-emerald-600" /> : <FileText size={11} className="text-emerald-700" />}
                        <span className="max-w-[110px] truncate text-[10px] font-medium">{att.name}</span>
                        <button 
                          onClick={() => removeAttachment(att.id)}
                          className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Input Bar */}
                <form onSubmit={handleSendMessage} className="p-2 bg-white border-t border-emerald-100 shrink-0">
                  <div className="flex items-end space-x-1 bg-slate-50 border border-slate-200 rounded-xl p-1 focus-within:border-emerald-500 focus-within:bg-white transition-all shadow-2xs">
                    
                    {/* Action Buttons: Attach File, Attach Image, Emoji */}
                    <div className="flex items-center space-x-0.5 pb-0.5 pl-0.5">
                      
                      {/* File Input */}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={(e) => handleFileUpload(e, 'file')} 
                        className="hidden" 
                        multiple 
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                        title="Share Documents"
                      >
                        <Paperclip size={14} />
                      </button>

                      {/* Image Input */}
                      <input 
                        type="file" 
                        ref={imageInputRef} 
                        accept="image/*" 
                        onChange={(e) => handleFileUpload(e, 'image')} 
                        className="hidden" 
                        multiple 
                      />
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                        title="Share Images"
                      >
                        <ImageIcon size={14} />
                      </button>

                      {/* Emoji Picker Popover Toggle */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                          title="Add Emoji"
                        >
                          <Smile size={14} />
                        </button>

                        {showEmojiPicker && (
                          <div className="absolute bottom-9 left-0 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 flex gap-1 animate-in zoom-in-95">
                            {EMOJI_LIST.map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  setInputText(prev => prev + emoji);
                                  setShowEmojiPicker(false);
                                }}
                                className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded-lg text-xs transition-transform hover:scale-125 cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Text Area */}
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      rows={1}
                      placeholder={`Message ${activeTarget.name}...`}
                      className="flex-1 max-h-24 min-h-[28px] py-1 px-1.5 bg-transparent text-[11px] text-slate-800 placeholder:text-slate-400 focus:outline-hidden resize-none font-normal leading-relaxed"
                    />

                    {/* Send Button */}
                    <div className="pb-0.5 pr-0.5">
                      <button
                        type="submit"
                        disabled={(!inputText.trim() && attachments.length === 0) || isUploading}
                        className="w-6.5 h-6.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-xs transition-all cursor-pointer"
                        title="Send message"
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                </form>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* High-Resolution Image Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[7000] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
              <a
                href={previewImage}
                download="chat_image"
                className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-all flex items-center space-x-1 text-xs font-bold"
              >
                <Download size={14} />
                <span>Download</span>
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-rose-600 hover:text-white shadow-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-h-[82vh] max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
};
