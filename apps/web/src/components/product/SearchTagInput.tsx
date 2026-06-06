import { useState, type KeyboardEvent } from 'react';

interface SearchTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export default function SearchTagInput({ tags, onChange, maxTags = 20 }: SearchTagInputProps) {
  const [input, setInput] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[40px] border rounded-xl px-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-gray-900/10">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-sm px-2 py-0.5 rounded-full"
          >
            #{tag}
            <button
              onClick={() => removeTag(i)}
              className="text-gray-400 hover:text-red-500"
            >
              x
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input && addTag(input)}
          placeholder={tags.length === 0 ? '검색 태그 입력 (Enter로 추가)' : ''}
          className="flex-1 min-w-[120px] outline-none text-sm py-0.5"
        />
      </div>
      <p className="text-xs text-gray-400">{tags.length}/{maxTags} 태그</p>
    </div>
  );
}
