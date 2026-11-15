import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, CornerUpLeft, X, Send, ExternalLink, Lock } from 'lucide-react';

export interface TeamsToastData {
  id: string;
  senderId?: string;
  senderName: string;
  senderPhoto?: string;
  senderDesignation?: string;
  senderBranchName?: string;
  content: string;
  channelId?: string;
  channelName?: string;
  createdAt: number;
  target?: Record<string, unknown>;
}

interface TeamsNotificationToastProps {
  toast: TeamsToastData | null;
  onClose: () => void;
  onOpenChat?: () => void;
  onSendInlineReply?: (text: string) => Promise<void> | void;
  isLoggedOut?: boolean;
  onLoginPrompt?: () => void;
}

export const TeamsNotificationToast: React.FC<TeamsNotificationToastProps> = ({
  toast,
  onClose,
  onOpenChat,
  onSendInlineReply,
  isLoggedOut = false,
  onLoginPrompt
}) => {
  const [isReplyingInline, setIsReplyingInline] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverRef = useRef(false);

  // Auto-dismiss after 8 seconds if not replying or hovered
  useEffect(() => {
    if (!toast || isReplyingInline) return;

    const timer = setTimeout(() => {
      if (!hoverRef.current && !isReplyingInline) {
        onClose();
      }
    }, 8500);

    return () => clearTimeout(timer);
  }, [toast, isReplyingInline, onClose]);

  // Focus input when inline reply opens
  useEffect(() => {
    if (isReplyingInline) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isReplyingInline]);

  if (!toast) return null;

  const handleSubmitInline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || isSending) return;

    if (isLoggedOut) {
      if (onLoginPrompt) onLoginPrompt();
      onClose();
      return;
    }

    if (onSendInlineReply) {
      try {
        setIsSending(true);
        await onSendInlineReply(replyText.trim());
        setReplyText('');
        setIsReplyingInline(false);
        onClose();
      } catch (err) {
        console.error('Failed to send inline reply:', err);
      } finally {
        setIsSending(false);
      }
    } else if (onOpenChat) {
      onOpenChat();
      onClose();
    }
  };

  const handleReplyClick = () => {
    if (isLoggedOut) {
      if (onLoginPrompt) onLoginPrompt();
      onClose();
    } else {
      setIsReplyingInline(true);
    }
  };

  const handleCardClick = () => {
    if (isLoggedOut) {
      if (onLoginPrompt) onLoginPrompt();
      onClose();
    } else if (onOpenChat) {
      onOpenChat();
      onClose();
    }
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label={`New message notification from ${toast.senderName}`}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      className="fixed bottom-5 right-5 z-[8000] w-84 sm:w-96 rounded-2xl overflow-hidden shadow-[0_16px_45px_rgba(0,0,0,0.45)] border border-indigo-300/30 select-none animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto font-sans"
    >
      {/* Top Body - Signature Teams Purple (#464775) */}
      <div 
        onClick={handleCardClick}
        className="bg-[#464775] p-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-[#41426e] relative group"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/25 bg-[#333559] flex items-center justify-center text-white font-bold text-sm shadow-md">
            {toast.senderPhoto ? (
              <img 
                src={toast.senderPhoto} 
                alt={toast.senderName} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <span>{toast.senderName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {/* Status Indicator */}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#464775] rounded-full shadow-xs" />
        </div>

        {/* Sender Info & Message Snippet */}
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white font-bold text-sm tracking-tight truncate max-w-[190px]">
              {toast.senderName}
            </span>
            {toast.channelName && (
              <span className="text-[10px] px-1.5 py-0.2 bg-white/15 text-purple-100 rounded-md font-medium truncate max-w-[110px]">
                {toast.channelName}
              </span>
            )}
          </div>

          <p className="text-purple-100 text-xs font-normal mt-1 leading-snug line-clamp-2 break-words">
            {toast.content}
          </p>
        </div>

        {/* Top-Right: Teams Chat Icon & Close Button */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <span className="text-purple-200 opacity-90 p-1" title="Microsoft Teams Chat">
            <MessageSquare size={17} />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-purple-200 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Bottom Bar - Teams Dark Purple Action Footer (#383a66) */}
      <div className="bg-[#383a66] border-t border-indigo-400/20 px-3.5 py-2.5">
        {!isReplyingInline ? (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleReplyClick}
              className="flex items-center gap-2 text-white hover:text-purple-200 font-semibold text-xs transition-colors cursor-pointer py-0.5 group"
            >
              <CornerUpLeft size={16} className="text-purple-300 group-hover:-translate-x-0.5 transition-transform" />
              <span>{isLoggedOut ? 'Sign In to Reply' : 'Reply'}</span>
            </button>

            {!isLoggedOut && onOpenChat && (
              <button
                type="button"
                onClick={() => {
                  onOpenChat();
                  onClose();
                }}
                className="text-[11px] text-purple-300 hover:text-white flex items-center gap-1 font-medium transition-colors cursor-pointer"
                title="Open full conversation window"
              >
                <span>Open Chat</span>
                <ExternalLink size={12} />
              </button>
            )}

            {isLoggedOut && (
              <span className="text-[10px] text-purple-300/80 flex items-center gap-1">
                <Lock size={10} />
                <span>Login Required</span>
              </span>
            )}
          </div>
        ) : (
          /* Inline Quick Reply Field */
          <form onSubmit={handleSubmitInline} className="flex items-center gap-2 animate-in fade-in duration-150">
            <input
              ref={inputRef}
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${toast.senderName.split(' ')[0]}...`}
              disabled={isSending}
              className="flex-1 bg-black/25 text-white placeholder:text-purple-200/60 text-xs px-3 py-1.5 rounded-lg border border-purple-300/30 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/40"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsReplyingInline(false);
                }
              }}
            />
            <button
              type="submit"
              disabled={!replyText.trim() || isSending}
              className="p-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-xs cursor-pointer"
              title="Send reply"
            >
              <Send size={13} />
            </button>
            {onOpenChat && (
              <button
                type="button"
                onClick={() => {
                  onOpenChat();
                  onClose();
                }}
                className="p-1.5 text-purple-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Open in full window"
              >
                <ExternalLink size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsReplyingInline(false)}
              className="p-1.5 text-purple-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Cancel reply"
            >
              <X size={14} />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
};
