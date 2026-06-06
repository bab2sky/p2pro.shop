/**
 * i18next-parser config — 코드를 스캔해서 t() 호출에서 키를 자동 추출.
 *
 * 워크플로우:
 *   1. 컴포넌트에서 t('auth.signup.cta_label') 추가
 *   2. `bun run i18n:extract` 실행
 *   3. ko/auth.json + en/auth.json 양쪽에 빈 키 자동 추가
 *   4. 한국어 번역 작성, 영어는 fallback (또는 직접 번역)
 *
 * dead key 처리:
 *   keepRemovedKeys: false → 코드에서 사라진 키는 자동 제거
 *
 * P2PRO 진출 단계: 한국어 + 영어만. 일본어/중국어 추가 시 locales 배열에 추가하면 됨.
 */
export default {
  // 스캔할 locale
  locales: ['ko', 'en'],

  // 사용 중인 namespace (i18n/index.ts 와 일치)
  defaultNamespace: 'common',

  // 출력 경로 — i18n/{locale}/{namespace}.json
  output: 'src/i18n/$LOCALE/$NAMESPACE.json',

  // 입력 파일 (스캔 대상)
  input: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/**/*.d.ts'],

  // 키 발견 시 새 namespace/locale 파일 자동 생성
  createOldCatalogs: false,

  // 새 키 기본값: 한국어는 키 자체로 두면 fallback 작동, 영어는 빈 값으로
  defaultValue: (locale, namespace, key) => {
    // 한국어: 빈 값 두면 fallbackLng 가 키 자체를 표시 → 직접 번역 필요 명시
    if (locale === 'ko') return '';
    // 영어: 빈 값 → i18next 가 fallbackLng (ko) 사용
    return '';
  },

  // 운영 중 keepRemoved 정책:
  //   true  = 코드에서 사라져도 보존 (마이그레이션/dynamic key 안전)
  //   false = 자동 제거 (분기별 cleanup 시 사용)
  // 기본값은 true (안전), 분기 cleanup 때만 `--keep-removed=false` 로 override.
  keepRemoved: true,

  // 키 / namespace 구분자 (i18n/index.ts 와 일치)
  keySeparator: '.',
  namespaceSeparator: '.',

  // 정렬 (diff 줄어듦)
  sort: true,

  // i18next-parser 가 인식할 함수 이름 (커스텀 wrapper 추가 시 여기에)
  lexers: {
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
    default: ['JavascriptLexer'],
  },

  verbose: false,
  failOnWarnings: false,

  // 참조 파일에 같은 키가 이미 있으면 그 값 보존 (번역 유지)
  // false 라면 매번 reset → 번역 손실
  resetDefaultValueLocale: null,
}
