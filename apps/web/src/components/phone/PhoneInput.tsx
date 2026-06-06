import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'KR', name: '대한민국', dialCode: '+82', flag: '🇰🇷' },
  { code: 'US', name: '미국', dialCode: '+1', flag: '🇺🇸' },
  { code: 'CN', name: '중국', dialCode: '+86', flag: '🇨🇳' },
  { code: 'JP', name: '일본', dialCode: '+81', flag: '🇯🇵' },
  { code: 'GB', name: '영국', dialCode: '+44', flag: '🇬🇧' },
  { code: 'DE', name: '독일', dialCode: '+49', flag: '🇩🇪' },
  { code: 'FR', name: '프랑스', dialCode: '+33', flag: '🇫🇷' },
  { code: 'AU', name: '호주', dialCode: '+61', flag: '🇦🇺' },
  { code: 'CA', name: '캐나다', dialCode: '+1', flag: '🇨🇦' },
  { code: 'IN', name: '인도', dialCode: '+91', flag: '🇮🇳' },
  { code: 'BR', name: '브라질', dialCode: '+55', flag: '🇧🇷' },
  { code: 'RU', name: '러시아', dialCode: '+7', flag: '🇷🇺' },
  { code: 'IT', name: '이탈리아', dialCode: '+39', flag: '🇮🇹' },
  { code: 'ES', name: '스페인', dialCode: '+34', flag: '🇪🇸' },
  { code: 'MX', name: '멕시코', dialCode: '+52', flag: '🇲🇽' },
  { code: 'ID', name: '인도네시아', dialCode: '+62', flag: '🇮🇩' },
  { code: 'NL', name: '네덜란드', dialCode: '+31', flag: '🇳🇱' },
  { code: 'SG', name: '싱가포르', dialCode: '+65', flag: '🇸🇬' },
  { code: 'HK', name: '홍콩', dialCode: '+852', flag: '🇭🇰' },
  { code: 'TW', name: '대만', dialCode: '+886', flag: '🇹🇼' },
  { code: 'TH', name: '태국', dialCode: '+66', flag: '🇹🇭' },
  { code: 'VN', name: '베트남', dialCode: '+84', flag: '🇻🇳' },
  { code: 'PH', name: '필리핀', dialCode: '+63', flag: '🇵🇭' },
  { code: 'MY', name: '말레이시아', dialCode: '+60', flag: '🇲🇾' },
  { code: 'NZ', name: '뉴질랜드', dialCode: '+64', flag: '🇳🇿' },
];

export function toE164(dialCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? digits.slice(1) : digits;
  return `${dialCode}${normalized}`;
}

export function parseE164(e164: string): { country: Country; localNumber: string } | null {
  if (!e164.startsWith('+')) return null;
  for (const country of COUNTRIES.sort((a, b) => b.dialCode.length - a.dialCode.length)) {
    if (e164.startsWith(country.dialCode)) {
      return { country, localNumber: e164.slice(country.dialCode.length) };
    }
  }
  return null;
}

const INPUT_CLASS =
  'rounded-xl border border-gray-200 bg-gray-100 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:bg-gray-900';

interface PhoneInputProps {
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  className?: string;
}

export function PhoneInput({ value, onChange, disabled, className }: PhoneInputProps) {
  const parsed = value ? parseE164(value) : null;
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    parsed?.country ?? COUNTRIES[0],
  );
  const [localNumber, setLocalNumber] = useState(parsed?.localNumber ?? '');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) return;
    const p = parseE164(value);
    if (p) {
      setSelectedCountry(p.country);
      setLocalNumber(p.localNumber);
    }
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && e.target instanceof Node && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLocalChange = (v: string) => {
    const cleaned = v.replace(/[^\d\-\s]/g, '');
    setLocalNumber(cleaned);
    const e164 = toE164(selectedCountry.dialCode, cleaned);
    onChange(e164);
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearch('');
    if (localNumber) {
      onChange(toE164(country.dialCode, localNumber));
    }
  };

  const filtered = useMemo(
    () =>
      COUNTRIES.filter(
        (c) =>
          c.name.includes(search) ||
          c.dialCode.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  return (
    <div className={`relative flex min-w-0 gap-2 ${className ?? ''}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={`${INPUT_CLASS} flex shrink-0 items-center gap-1.5 px-3 py-2.5 disabled:opacity-50`}
        aria-label="국가코드 선택"
      >
        <span>{selectedCountry.flag}</span>
        <span className="text-xs">{selectedCountry.dialCode}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-100 p-2 dark:border-gray-800">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="국가 검색..."
              className="w-full rounded-lg bg-gray-50 px-3 py-1.5 text-xs outline-none dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => handleSelectCountry(c)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span>{c.flag}</span>
                  <span className="flex-1 text-gray-900 dark:text-gray-100">{c.name}</span>
                  <span className="text-gray-400">{c.dialCode}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-gray-400">검색 결과 없음</li>
            )}
          </ul>
        </div>
      )}

      <input
        type="tel"
        value={localNumber}
        onChange={(e) => handleLocalChange(e.target.value)}
        disabled={disabled}
        placeholder="010-1234-5678"
        className={`${INPUT_CLASS} w-0 min-w-0 flex-1 px-4 py-2.5 disabled:opacity-50`}
      />
    </div>
  );
}
