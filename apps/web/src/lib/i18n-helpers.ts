import i18next from 'i18next';

/**
 * DB-driven 다국어 필드 (예: categories.name + name_en) 에서
 * 현재 i18n 언어에 맞는 값을 선택.
 *
 * 글로벌 진출 D-3 추가 — backend 가 ko/en 양쪽 컬럼 반환하면 frontend 가 분기.
 *
 * 사용 예:
 *   localizedName(category.name, category.name_en)
 *   → 'ko' 시 한국어, 'en' 시 영어 (없으면 한국어 fallback)
 */
export function localizedName(
  ko: string | null | undefined,
  en?: string | null,
): string {
  const lang = (i18next.language || 'ko').slice(0, 2);
  if (lang === 'en' && en) return en;
  return ko ?? '';
}
