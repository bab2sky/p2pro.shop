import { useThemeStore } from '@/stores/theme';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const next = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const icon = theme === 'dark' ? '🌙' : theme === 'system' ? '💻' : '☀️';

  return (
    <button
      onClick={next}
      className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
      title={`Theme: ${theme}`}
    >
      <span className="text-sm">{icon}</span>
    </button>
  );
}
