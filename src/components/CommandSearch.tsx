import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../lib/icons';

export interface CommandItem {
  key: string;
  label: string;
  route: string;
  group: string;
  /** Extra route params, e.g. a client id for route 'client'. */
  params?: Record<string, unknown>;
  /** Extra text to match on (e.g. a client slug) that isn't shown as the label. */
  keywords?: string;
}

interface CommandSearchProps {
  items: CommandItem[];
  onNavigate: (route: string, params?: Record<string, unknown>) => void;
}

/** Top-bar command palette. ⌘K / Ctrl+K focuses it; typing filters the pages the
 *  current role can reach; ↑/↓ move the highlight, Enter or click navigates, Esc clears. */
export function CommandSearch({ items, onNavigate }: CommandSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it =>
      it.label.toLowerCase().includes(q) ||
      it.group.toLowerCase().includes(q) ||
      (it.keywords?.toLowerCase().includes(q) ?? false));
  }, [items, query]);

  // Reset the highlight to the top whenever the result set changes.
  useEffect(() => { setHighlight(0); }, [query]);

  // ⌘K / Ctrl+K focuses and opens the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close when clicking outside the box.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (it: CommandItem) => {
    onNavigate(it.route, it.params);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = results[highlight];
      if (it) choose(it);
    }
  };

  return (
    <div className="search-box" ref={boxRef}>
      <Icon.search size={15} />
      <input
        ref={inputRef}
        placeholder="Search pages…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKey}
        role="combobox"
        aria-expanded={open}
        aria-controls="command-search-results"
      />
      <span className="kbd">⌘K</span>
      {open && (
        <div className="command-results" id="command-search-results" role="listbox">
          {results.length === 0 ? (
            <div className="command-empty">No pages found</div>
          ) : (
            results.map((it, i) => (
              <button
                key={it.key}
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={'command-item' + (i === highlight ? ' active' : '')}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(it)}
              >
                <span className="command-item-label">{it.label}</span>
                <span className="command-item-group">{it.group}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
