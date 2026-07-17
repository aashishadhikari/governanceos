'use client';

import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  onClose: (id: string) => void;
}

export default function Toast({
  id,
  type,
  title,
  message,
  onClose,
}: ToastProps) {
  const config = {
    success: {
      icon: CheckCircle2,
      border: 'border-green-200',
      bg: 'bg-green-50',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      messageColor: 'text-green-700',
    },
    error: {
      icon: AlertCircle,
      border: 'border-red-200',
      bg: 'bg-red-50',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      messageColor: 'text-red-700',
    },
    info: {
      icon: Info,
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      messageColor: 'text-blue-700',
    },
  };

  const c = config[type];
  const Icon = c.icon;

  return (
    <div
      className={`
        w-[440px] rounded-xl border shadow-lg
        ${c.bg}
        ${c.border}
        pointer-events-auto
      `}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className={`w-5 h-5 mt-0.5 ${c.iconColor}`} />

        <div className="flex-1 min-w-0">
          <div className={`font-medium ${c.titleColor}`}>
            {title}
          </div>

          {message && (
            <div className={`text-sm mt-1 ${c.messageColor}`}>
              {message}
            </div>
          )}
        </div>

        <button
          onClick={() => onClose(id)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}