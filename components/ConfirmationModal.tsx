
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantClasses = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white'
  };

  const iconClasses = {
    danger: 'text-rose-600 bg-rose-50',
    warning: 'text-amber-500 bg-amber-50',
    info: 'text-blue-600 bg-blue-50'
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9999] flex items-start justify-center pt-8 sm:pt-14 p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto sm:my-0">
        <div className="p-4 sm:p-5 flex items-start space-x-3.5">
          <div className={`p-2.5 rounded-xl shrink-0 ${iconClasses[variant]}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-slate-900 tracking-tight uppercase mb-1">{title}</h3>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-900 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 sm:px-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-bold uppercase text-[10px] tracking-wider text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm}
            className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer ${variantClasses[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
