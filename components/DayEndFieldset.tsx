import React from 'react';
import { useDayEndLock } from '../utils/dayEndLock';

interface DayEndFieldsetProps {
  children: React.ReactNode;
  branchId?: string | null;
  lockedOverride?: boolean;
  className?: string;
  title?: string;
}

const blockTextInputWhenLocked = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const blockKeyDownWhenLocked = (e: React.KeyboardEvent) => {
  // Allow Tab / Escape so keyboard users don't get trapped inside a modal or page
  if (e.key === 'Tab' || e.key === 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
};

export const DayEndFieldset: React.FC<DayEndFieldsetProps> = ({
  children,
  branchId,
  lockedOverride,
  className = '',
  title
}) => {
  const hookLocked = useDayEndLock(branchId);
  const isLocked = typeof lockedOverride === 'boolean' ? lockedOverride : hookLocked;

  if (!isLocked) {
    return className ? <div className={className}>{children}</div> : <>{children}</>;
  }

  return (
    <fieldset
      disabled={true}
      title={title || 'Day Closed: Form inputs are locked until Day Open.'}
      onBeforeInputCapture={blockTextInputWhenLocked}
      onPasteCapture={blockTextInputWhenLocked}
      onDropCapture={blockTextInputWhenLocked}
      onKeyDownCapture={blockKeyDownWhenLocked}
      className={`border-0 p-0 m-0 min-w-0 opacity-85 pointer-events-none select-none [&_input]:bg-slate-100 [&_input]:text-slate-500 [&_input]:cursor-not-allowed [&_select]:bg-slate-100 [&_select]:text-slate-500 [&_select]:cursor-not-allowed [&_textarea]:bg-slate-100 [&_textarea]:text-slate-500 [&_textarea]:cursor-not-allowed [&_button]:cursor-not-allowed ${className}`}
    >
      {children}
    </fieldset>
  );
};

export default DayEndFieldset;
