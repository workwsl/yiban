import type { ReactNode } from 'react';
import { OPTIONS_SECTIONS, type OptionsSection } from './types';

interface OptionsShellProps {
  activeSection: OptionsSection;
  onSectionChange: (section: OptionsSection) => void;
  children: ReactNode;
}

export function OptionsShell({ activeSection, onSectionChange, children }: OptionsShellProps) {
  return (
    <div className="options-shell">
      <aside className="options-sidebar">
        <div className="options-sidebar-header">
          <h1 className="options-brand">译伴 设置</h1>
        </div>
        <nav className="options-nav" aria-label="设置导航">
          {OPTIONS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`options-nav-item${activeSection === section.id ? ' is-active' : ''}`}
              onClick={() => onSectionChange(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="options-content">{children}</main>
    </div>
  );
}
