'use client';

import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-800 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up safe-area-bottom">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0">
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>
        {title && (
          <h3 className="text-lg font-semibold px-4 pb-3">{title}</h3>
        )}
        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}
