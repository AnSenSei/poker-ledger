'use client';

import BottomSheet from './BottomSheet';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  confirmColor?: 'red' | 'green';
}

export default function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = '确认',
  confirmColor = 'red',
}: Props) {
  const colorClass =
    confirmColor === 'red'
      ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
      : 'bg-green-600 hover:bg-green-700 active:bg-green-800';

  return (
    <BottomSheet open={open} onClose={onCancel} title={title}>
      {message && (
        <p className="text-gray-400 text-sm mb-4">{message}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-xl py-3 font-medium transition-colors"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 ${colorClass} text-white rounded-xl py-3 font-medium transition-colors`}
        >
          {confirmText}
        </button>
      </div>
    </BottomSheet>
  );
}
