import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'info' | 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig = {
  info: {
    icon: Info,
    iconBg: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    button: 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
  },
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-50 dark:bg-red-500/10',
    iconColor: 'text-red-500',
    button: 'bg-red-500 text-white hover:bg-red-600',
  },
  warning: {
    icon: AlertCircle,
    iconBg: 'bg-amber-50 dark:bg-amber-500/10',
    iconColor: 'text-amber-500',
    button: 'bg-amber-500 text-white hover:bg-amber-600',
  },
} as const;

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Dialog open={isOpen} onClose={onCancel} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity data-closed:opacity-0 data-enter:duration-200 data-leave:duration-150"
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all data-closed:scale-95 data-closed:opacity-0 data-enter:duration-200 data-leave:duration-150 dark:bg-gray-900"
        >
          <div className="flex items-start gap-4">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', config.iconBg)}>
              <Icon className={cn('h-5 w-5', config.iconColor)} />
            </div>

            <div className="flex-1">
              <DialogTitle className="text-base font-bold text-gray-900 dark:text-white">
                {title}
              </DialogTitle>
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-gray-100 px-5 py-2 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={cn(
                'rounded-full px-5 py-2 text-[13px] font-bold transition-colors',
                config.button,
              )}
            >
              {confirmText}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
