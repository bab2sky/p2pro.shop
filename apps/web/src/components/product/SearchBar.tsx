import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import api from '@/lib/api/client';

interface SearchBarProps {
  defaultValue?: string;
  onSearch: (query: string) => void;
}

export function SearchBar({ defaultValue = '', onSearch }: SearchBarProps) {
  const { t } = useTranslation('product');
  const [query, setQuery] = useState(defaultValue);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: suggestions } = useQuery({
    queryKey: ['autocomplete', debouncedQuery],
    queryFn: () =>
      api
        .get<{ data: string[] }>(`/products/search/autocomplete?q=${encodeURIComponent(debouncedQuery)}`)
        .then((r) => r.data.data),
    enabled: debouncedQuery.length >= 2,
  });

  const handleSelect = (value: string) => {
    setQuery(value);
    setShowSuggestions(false);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
    if (defaultValue) onSearch('');
  };

  return (
    <div ref={wrapperRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setShowSuggestions(false);
          onSearch(query);
        }}
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 stroke-[1.5]" />
          <input
            ref={inputRef}
            name="q"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={t('search.placeholder', '브랜드, 상품명, 태그 검색')}
            aria-label={t('search.placeholder', '검색')}
            className="h-12 w-full rounded-full bg-gray-100/80 pl-12 pr-24 text-[15px] font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:bg-gray-100 focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800/60 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-800 dark:focus:ring-gray-100/10"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700"
                aria-label="검색어 지우기"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              검색
            </button>
          </div>
        </div>
      </form>

      {/* Autocomplete Suggestions */}
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
          {suggestions.map((item, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Search className="h-4 w-4 shrink-0 text-gray-400" />
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
