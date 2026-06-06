import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 다음 규칙들은 React Compiler 의 실험적 최적화 신호 (동작 정확성 X, 최적화 가능성 O).
      // 점진적 리팩터 대상이라 'error' 대신 'warn' 으로 둬서 CI 게이트는 통과하되
      // dev 단계에서 계속 가시화. TODO: 차후 phase 별로 정리.
      // - set-state-in-effect: derived state 패턴 추출 (useMemo/init 함수)
      // - static-components: 함수 안 컴포넌트 정의를 모듈 스코프로 끌어올림
      // - preserve-manual-memoization: useCallback deps 정합화
      // - purity: render 중 Date.now() 등 impure call 제거
      // - immutability: TDZ-style 변수 참조 제거
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      // Fast Refresh HMR 권장. 컴포넌트+상수 혼재 파일 (PhoneInput, ThemeProvider)
      // 분리 리팩터 전까지 'warn'.
      'react-refresh/only-export-components': 'warn',
      // exhaustive-deps 는 default 가 'warn' 이라 그대로 두되 명시.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Playwright e2e fixture 의 use(...) 콜백이 react-hooks 규칙으로
  // 잘못 진단됨 (rules-of-hooks, static-components 등). e2e/ 는 React 코드가
  // 아니므로 react-hooks 룰 전체 비활성화.
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'no-empty-pattern': 'off',
      // Playwright fixture destructure (e.g. seededData) 는 fixture pre-load
      // 만 트리거하고 본문에서 사용하지 않는 경우가 있음. 의도된 패턴.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
])
