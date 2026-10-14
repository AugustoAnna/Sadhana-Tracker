import { setTheme, useThemeStore, type Theme } from '@/services/theme';
import { track } from '@/services/instrumentation';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light or dark, saved on this device. */
export function AppearanceSettings() {
  const theme = useThemeStore((s) => s.theme);

  const choose = (value: Theme) => {
    if (value === theme) return;
    void track('theme_changed', { from: theme, to: value });
    setTheme(value);
  };

  return (
    <section>
      <p className="section-header mb-2">Appearance</p>
      <div className="bg-card rounded-[14px] px-3 py-3">
        <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-2 gap-1 p-1 rounded-[10px] bg-page">
          {THEMES.map(({ value, label }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(value)}
                className={`min-h-11 rounded-[7px] text-body transition-colors ${
                  selected ? 'bg-card dark:bg-field text-ink shadow-sm' : 'text-secondary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
