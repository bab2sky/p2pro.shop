import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
] as const;

interface LanguageSwitcherProps {
  variant?: 'default' | 'compact' | 'icon';
  className?: string;
}

/**
 * 언어 변경 UI. 글로벌 진출 D-2 추가.
 *
 * variant:
 *   default — label "언어/Language" + select (footer/panel 용)
 *   compact — globe 아이콘 + 작은 select (데스크톱 헤더 용)
 *   icon    — globe 아이콘 + 현재 언어 라벨만 (모바일 헤더 용)
 */
export function LanguageSwitcher({ variant = 'default', className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const currentCode = (i18n.language || 'ko').slice(0, 2);
  const current = LANGUAGES.find((l) => l.code === currentCode) ?? LANGUAGES[0];

  const onChange = (code: string) => {
    i18n.changeLanguage(code);
    // localStorage 에 저장 (LanguageDetector cache)
    try {
      localStorage.setItem('i18nextLng', code);
    } catch {
      // ignore
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <select
          value={currentCode}
          onChange={(e) => onChange(e.target.value)}
          aria-label={i18n.language === 'ko' ? '언어 선택' : 'Select language'}
          className="rounded-md border-none bg-transparent py-1 pe-1 text-[13px] font-medium text-gray-700 outline-none hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => onChange(currentCode === 'ko' ? 'en' : 'ko')}
        aria-label={i18n.language === 'ko' ? '언어 전환' : 'Switch language'}
        className={`flex items-center gap-1 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white ${className}`}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="text-[12px] font-medium">{current.code.toUpperCase()}</span>
      </button>
    );
  }

  // default
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-900 ${className}`}>
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 dark:text-gray-400">
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        {i18n.language === 'ko' ? '언어' : 'Language'}
      </span>
      <select
        value={currentCode}
        onChange={(e) => onChange(e.target.value)}
        aria-label={i18n.language === 'ko' ? '언어 선택' : 'Select language'}
        className="rounded-lg border-none bg-transparent text-[12px] font-bold text-gray-900 outline-none dark:text-white"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
