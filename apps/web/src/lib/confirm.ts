import { toast } from 'sonner';

/**
 * Show a confirmation toast that resolves when the user clicks Confirm or Cancel.
 * Drop-in replacement for `window.confirm()` that doesn't block the main thread.
 *
 * Usage:
 *   const ok = await confirmAction('삭제하시겠습니까?');
 *   if (ok) doDelete();
 */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    toast(message, {
      duration: Infinity,
      action: {
        label: '확인',
        onClick: () => resolve(true),
      },
      cancel: {
        label: '취소',
        onClick: () => resolve(false),
      },
      onDismiss: () => resolve(false),
    });
  });
}
