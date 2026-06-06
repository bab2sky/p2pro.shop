import i18next from 'i18next';

/**
 * 사용자 브라우저 locale + timezone 으로 날짜/시간 포맷.
 *
 * 글로벌 진출 D-3 (2026-05-07): 기존 `toLocaleString('ko-KR')` 같이 locale 이
 * hardcode 된 곳을 점진적으로 이 유틸로 대체. timezone 자체는 ISO 8601 UTC
 * 응답 + brower timezone 자동 인식 (Intl) 으로 이미 정상 작동.
 *
 * 사용 예:
 *   formatDate(order.created_at)       // "2026. 5. 7." (ko) or "5/7/2026" (en)
 *   formatDateTime(order.created_at)   // "2026. 5. 7. 오후 12:30" / "5/7/2026, 12:30 PM"
 *   formatTime(message.created_at)     // "오후 12:30" / "12:30 PM"
 *
 * timezone 은 브라우저 기본값 자동 사용. 사용자가 명시 timezone 선호 시
 * (users.timezone 컬럼 활용) 옵션에 `{ timeZone: user.timezone }` 추가.
 */

const currentLocale = (): string => {
  const lang = i18next.language || 'ko';
  // i18next 'ko' → BCP 47 'ko-KR', 'en' → 'en-US'.
  if (lang === 'ko') return 'ko-KR';
  if (lang === 'en') return 'en-US';
  return lang;
};

export const formatDate = (
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: 'medium',
    ...options,
  }).format(date);
};

export const formatDateTime = (
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date);
};

export const formatTime = (
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(currentLocale(), {
    timeStyle: 'short',
    ...options,
  }).format(date);
};

/**
 * 상대 시간 ("3분 전", "어제", "2 hours ago").
 * Intl.RelativeTimeFormat 사용.
 */
export const formatRelative = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' });

  const absSec = Math.abs(diffSec);
  if (absSec < 60) return rtf.format(diffSec, 'second');
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (absSec < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (absSec < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (absSec < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
  return rtf.format(Math.round(diffSec / 31536000), 'year');
};
