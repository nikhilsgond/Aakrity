import { useEffect } from 'react';
import { useUIStore } from '@app/state/uiStore';
import { Moon, Sun } from 'lucide-react';

const ThemeToggle = () => {
  const { theme, setTheme } = useUIStore();

  useEffect(() => {
    // Initialize theme
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 p-2 rounded-full bg-card border border-border shadow-lg z-50 hover:bg-muted transition-colors"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4" />
      ) : (
        <Sun className="w-4 h-4" />
      )}
    </button>
  );
};

export default ThemeToggle;