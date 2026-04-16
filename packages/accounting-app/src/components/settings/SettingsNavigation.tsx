import React from 'react';
import clsx from 'clsx';
import { SettingsSection } from '../SettingsPage';

interface SettingsSectionConfig {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  category: 'primary' | 'secondary' | 'danger';
}

interface SettingsNavigationProps {
  sections: SettingsSectionConfig[];
  activeSection: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
}

const SettingsNavigation: React.FC<SettingsNavigationProps> = ({
  sections,
  activeSection,
  onSelectSection,
}) => {
  const primarySections = sections.filter(s => s.category === 'primary');
  const secondarySections = sections.filter(s => s.category === 'secondary');
  const dangerSections = sections.filter(s => s.category === 'danger');

  const NavSection = ({
    title,
    items,
  }: {
    title?: string;
    items: SettingsSectionConfig[];
  }) => (
    <div>
      {title && (
        <p className="px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">
          {title}
        </p>
      )}
      <div className="space-y-1">
        {items.map(section => (
          <button
            key={section.id}
            onClick={() => onSelectSection(section.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
              'text-left text-sm font-medium',
              activeSection === section.id
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted/50'
            )}
          >
            <span className="flex-shrink-0 opacity-60">{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <aside className="w-72 h-full sticky top-0 overflow-y-auto">
      <nav className="py-6 pr-4 space-y-8">
        <NavSection items={primarySections} />
        <div className="border-t border-border" />
        <NavSection title="More" items={secondarySections} />
        <div className="border-t border-border" />
        <NavSection items={dangerSections} />
      </nav>
    </aside>
  );
};

export default SettingsNavigation;
