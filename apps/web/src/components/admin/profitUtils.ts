/**
 * Shared helpers for admin profit components.
 */

export function fmt(val: string | number): string {
  return Number(val).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}
