'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import Toast, { ToastType } from './Toast';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (
      type: ToastType,
      title: string,
      message?: string
    ) => {
      const id = crypto.randomUUID();

      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          title,
          message,
        },
      ]);

      setTimeout(() => {
        removeToast(id);
      }, 6000);
    },
    [removeToast]
  );

  const value = useMemo(
    () => ({
      success: (title: string, message?: string) =>
        addToast('success', title, message),

      error: (title: string, message?: string) =>
        addToast('error', title, message),

      info: (title: string, message?: string) =>
        addToast('info', title, message),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error(
      'useToast must be used inside ToastProvider'
    );
  }

  return ctx;
}