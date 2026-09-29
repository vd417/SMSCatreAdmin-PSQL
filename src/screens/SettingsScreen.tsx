import React from 'react';
import { Icon } from '../lib/icons';

type Theme = 'dark' | 'light';

interface Props {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const OPTIONS: { key: Theme; label: string; icon: typeof Icon.sun }[] = [
  { key: 'light', label: 'Light', icon: Icon.sun },
  { key: 'dark', label: 'Dark', icon: Icon.moon },
];

/** Thin, client-only app preferences. Persistence is handled by App (localStorage). */
export function SettingsScreen({ theme, setTheme }: Props): React.ReactElement {
  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title">Settings</h1>
        <p className="muted tiny" style={{ marginTop: 4 }}>Personal preferences for this device.</p>
      </div>

      <div className="card" style={{ padding: 16, maxWidth: 480 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Appearance</h2>
        <p className="muted tiny" style={{ marginTop: 4, marginBottom: 12 }}>Choose how the panel looks on this device.</p>
        <div className="row gap8">
          {OPTIONS.map(o => {
            const active = theme === o.key;
            return (
              <button
                key={o.key}
                type="button"
                className={'chip' + (active ? ' active' : '')}
                aria-pressed={active}
                onClick={() => setTheme(o.key)}
                style={{
                  borderColor: active ? 'var(--accent)' : undefined,
                  background: active ? 'var(--surface-2)' : undefined,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {React.createElement(o.icon, { size: 15 })}
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
