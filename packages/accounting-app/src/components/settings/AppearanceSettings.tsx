import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

const AppearanceSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'light', label: 'Light', icon: <Sun className="w-6 h-6" /> },
    { id: 'dark', label: 'Dark', icon: <Moon className="w-6 h-6" /> },
    { id: 'system', label: 'System', icon: <Monitor className="w-6 h-6" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Color Scheme</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose how the app looks. Select a single theme or let your system settings decide.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as any)}
              className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                theme === t.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div
                className={`${
                  theme === t.id ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {t.icon}
              </div>
              <span className="text-sm font-medium text-foreground">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview Card */}
      <div className="p-6 bg-card border border-border rounded-2xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Preview</h3>
        <div className="space-y-3">
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <p className="text-sm text-foreground">Primary Button</p>
            <button className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              Sample Button
            </button>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">Secondary Text</p>
            <p className="mt-2 text-xs text-muted-foreground">This is how secondary text looks</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <p className="text-sm text-blue-600 dark:text-blue-400">
          🎨 Your theme preference will be saved automatically across all your devices.
        </p>
      </div>
    </div>
  );
};

export default AppearanceSettings;
