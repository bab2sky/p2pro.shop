import { useState } from 'react';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: '자주 사용',
    emojis: ['😀', '😂', '🥰', '😍', '🤩', '😎', '🥳', '🤔', '😢', '😭', '🥺', '😡', '🤯', '🫡', '🙏', '👍', '👎', '❤️', '🔥', '✅', '⭐', '🎉', '💯', '🚀', '💡', '📢', '⚠️', '🆕', '🆓', '💰'],
  },
  {
    label: '표정',
    emojis: ['😀', '😃', '😄', '😁', '😆', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '🤪', '😜', '🤑', '🤗', '🤭', '🫢', '🤫', '🤔', '🫡', '🤐', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🥴', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬'],
  },
  {
    label: '손/몸',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🙏', '💪', '🦾', '🖤'],
  },
  {
    label: '하트/기호',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '⭐', '🌟', '✨', '💫', '🔥', '💥', '💢', '💤', '💬', '💭', '🕳️', '💣', '💀', '☠️', '✅', '❌', '❓', '❗', '‼️', '⁉️', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪'],
  },
  {
    label: '물건/음식',
    emojis: ['🎁', '🎈', '🎉', '🎊', '🎀', '🏆', '🥇', '🥈', '🥉', '🎯', '📢', '📣', '📌', '📍', '📎', '🔗', '📝', '📋', '📁', '📂', '💰', '💵', '💸', '💳', '🛒', '📦', '📫', '📧', '💻', '📱', '⌚', '📸', '🔑', '🔒', '🔓', '⚙️', '🛠️', '🔔', '🔕', '📊', '📈', '📉', '🚀', '✈️', '🚗', '⏰', '🕐', '💡', '🔋', '🆕', '🆓', '🆗', '⚠️', '🚫', '♻️'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');

  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
  const uniqueAll = [...new Set(allEmojis)];

  const displayEmojis = search
    ? uniqueAll
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div
      className="w-[320px] rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Search */}
      <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이모티콘 검색..."
          className="w-full rounded-lg bg-gray-100 px-3 py-1.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200"
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex gap-1 border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveCategory(i)}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                activeCategory === i
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="grid max-h-[200px] grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {displayEmojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
