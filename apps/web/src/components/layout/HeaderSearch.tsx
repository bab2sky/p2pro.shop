import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HeaderSearch({ isOpen, onClose }: HeaderSearchProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  return (
    <div className="border-t border-gray-200 px-4 py-2 md:hidden dark:border-gray-700">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (searchQuery.trim()) {
            navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
            onClose();
            setSearchQuery('');
          }
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="상품 검색..."
          aria-label="상품 검색"
          autoFocus
          className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="submit"
          className="rounded-full bg-gray-900 dark:bg-white px-3 py-1.5 text-sm text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
        >
          검색
        </button>
      </form>
    </div>
  );
}
