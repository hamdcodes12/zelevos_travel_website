import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface UseModalOptions {
  isOpen: boolean;
  onClose: () => void;
  isDirty?: boolean;
}

export function useModalA11y({ isOpen, onClose, isDirty }: UseModalOptions) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const requestClose = () => {
    if (isDirty) {
      if (!window.confirm("Discard unsaved changes?")) {
        return;
      }
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore focus on close
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Handle Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Focus the modal content or first focusable element
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const focusable = contentRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
          focusable.focus();
        } else {
          contentRef.current.focus();
        }
      }
    }, 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, isDirty]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
      requestClose();
    }
  };

  return {
    contentRef,
    requestClose,
    handleBackdropClick,
  };
}

export interface ModalCloseButtonProps {
  onClose: () => void;
  className?: string;
  ariaLabel?: string;
  isDirty?: boolean;
}

export function ModalCloseButton({ onClose, className, ariaLabel = "Close modal", isDirty }: ModalCloseButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }
    onClose();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={className || "absolute top-4 right-4 z-10 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"}
    >
      <X size={18} />
    </button>
  );
}
