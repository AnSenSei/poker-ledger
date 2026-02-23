'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

interface ToastContextType {
  toast: (message: string, type?: ToastItem['type']) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (message: string, type: ToastItem['type'] = 'error') => {
      const id = nextId++;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-fade-in pointer-events-auto ${
              item.type === 'error'
                ? 'bg-red-900/90 text-red-200 border border-red-800'
                : item.type === 'success'
                ? 'bg-green-900/90 text-green-200 border border-green-800'
                : 'bg-gray-800/90 text-gray-200 border border-gray-700'
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
