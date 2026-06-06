import { AxiosError } from 'axios';

/**
 * Extract a human-readable error message from an API error.
 * Handles Axios errors with the project's `{ error: { code, message } }` envelope,
 * generic Error instances, and unknown values.
 */
export function extractApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const serverMessage = error.response?.data?.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.length > 0) {
      return serverMessage;
    }
    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '알 수 없는 오류가 발생했습니다.';
}
