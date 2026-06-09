import React, { useEffect, useState } from 'react';
import { FaCheck, FaExclamationCircle } from 'react-icons/fa';

export type FormStatus = 'idle' | 'saving' | 'success' | 'error';

interface ProblemFormStatusRibbonProps {
  status: FormStatus;
  message?: string;
  autoDismissMs?: number;
}

/**
 * ProblemFormStatusRibbon: Low-profile inline status indicator for admin form submissions
 * 
 * Replaces floating success/error toasts with a contextual ribbon that:
 * - Slides in from top
 * - Shows spinner during save
 * - Shows checkmark on success, then auto-dismisses
 * - Shows error persistently until cleared
 * - Never blocks form interaction
 */
const ProblemFormStatusRibbon: React.FC<ProblemFormStatusRibbonProps> = ({
  status,
  message,
  autoDismissMs = 3000,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (status !== 'idle') {
      setIsVisible(true);

      if (status === 'success' && autoDismissMs > 0) {
        const timer = setTimeout(() => setIsVisible(false), autoDismissMs);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [status, autoDismissMs]);

  if (!isVisible || status === 'idle') return null;

  const statusStyles: Record<FormStatus, string> = {
    saving: 'bg-blue-950/40 text-blue-400 border-blue-800/50',
    success: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50',
    error: 'bg-rose-950/40 text-rose-400 border-rose-800/50',
    idle: 'hidden',
  };

  return (
    <div
      className={`
        mx-4 mb-4 px-4 py-3 rounded-lg border
        flex items-center gap-3
        transition-all duration-300
        ${statusStyles[status]}
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
      `}
    >
      {status === 'saving' && (
        <svg 
          className='animate-spin w-5 h-5 flex-shrink-0' 
          fill='none' 
          stroke='currentColor' 
          viewBox='0 0 24 24'
        >
          <circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='2' opacity='0.3' />
          <path d='M12 2a10 10 0 0110 10' strokeWidth='2' strokeLinecap='round' />
        </svg>
      )}
      {status === 'success' && <FaCheck className='flex-shrink-0' size={18} />}
      {status === 'error' && <FaExclamationCircle className='flex-shrink-0' size={18} />}

      <span className='text-sm font-medium'>{message}</span>
    </div>
  );
};

export default ProblemFormStatusRibbon;
