import { useState, useCallback, createElement } from 'react';
import { ConfirmModal, type ConfirmModalProps } from '@/components/common/ConfirmModal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmModalProps['variant'];
}

export function useConfirm() {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ isOpen: true, options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const ConfirmDialog = useCallback(
    () =>
      createElement(ConfirmModal, {
        isOpen: state.isOpen,
        title: state.options.title,
        message: state.options.message,
        confirmText: state.options.confirmText,
        cancelText: state.options.cancelText,
        variant: state.options.variant,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
      }),
    [state.isOpen, state.options, handleConfirm, handleCancel],
  );

  return { confirm, ConfirmDialog };
}
