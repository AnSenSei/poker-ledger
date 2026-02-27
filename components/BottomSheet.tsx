'use client';

import { useEffect, useRef, useState } from 'react';
import { hapticLight } from '@/lib/haptic';

const DISMISS_THRESHOLD = 100;

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const startY = useRef(0);
  const dragging = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setHasAnimated(false);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  function handleTouchStart(e: React.TouchEvent) {
    // Don't start drag when interacting with form elements
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    // Only start drag if sheet is scrolled to top
    if (sheetRef.current && sheetRef.current.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setDragY(dy);
    }
  }

  function handleTouchEnd() {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (dragY > DISMISS_THRESHOLD) {
      hapticLight();
      onClose();
    }
    setDragY(0);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        style={{ opacity: dragY > 0 ? Math.max(0.2, 1 - dragY / 300) : undefined }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-gray-800 rounded-t-2xl max-h-[85vh] overflow-y-auto safe-area-bottom"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          animation: !hasAnimated ? 'slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onAnimationEnd={() => setHasAnimated(true)}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0 cursor-grab">
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
