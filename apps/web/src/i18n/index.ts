import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

/**
 * Vite glob import로 모든 namespace JSON 자동 등록.
 * 새 namespace 파일을 추가하면 (i18next-parser 자동 추출) index.ts 수정 불필요.
 *
 * 키 추가 워크플로우:
 *   1. 컴포넌트에서 useTranslation 의 t() 호출 추가
 *   2. `bun run i18n:extract` 실행
 *   3. 새 namespace 면 ko/{ns}.json + en/{ns}.json 자동 생성
 *   4. 한국어 번역 작성, 영어는 fallback (또는 직접 번역)
 */
const koModules = import.meta.glob<{ default: Record<string, unknown> }>('./ko/*.json', {
  eager: true,
});
const enModules = import.meta.glob<{ default: Record<string, unknown> }>('./en/*.json', {
  eager: true,
});

const buildResources = (modules: typeof koModules) =>
  Object.entries(modules).reduce<Record<string, Record<string, unknown>>>((acc, [path, mod]) => {
    // path 예: './ko/auth.json' → namespace 'auth'
    const namespace = path.split('/').pop()!.replace(/\.json$/, '');
    acc[namespace] = mod.default;
    return acc;
  }, {});

const koResources = buildResources(koModules);
const enResources = buildResources(enModules);
const namespaces = Object.keys(koResources);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: koResources,
      en: enResources,
    },
    defaultNS: 'common',
    ns: namespaces,
    fallbackLng: 'ko',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    nsSeparator: '.',
    keySeparator: '.',
    interpolation: { escapeValue: false },
  });

export default i18n;
