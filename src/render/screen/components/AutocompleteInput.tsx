/**
 * Free text first, autocomplete second.
 *
 * The expert is fast at typing prose and slow at hunting through dropdowns, so
 * this control never blocks: whatever is typed is accepted, suggestions are
 * offered from the doctor's OWN history, and Enter commits the typed text
 * rather than the highlighted suggestion unless one was deliberately chosen
 * (PRODUCT.md 16, DESIGN.md 9).
 */
import { useEffect, useRef, useState } from 'react';
import * as db from '@storage/db.ts';
import type { LearnedTerm } from '@storage/db.ts';

interface Props {
  field: LearnedTerm['field'];
  placeholder: string;
  onCommit: (text: string) => void;
  buttonLabel?: string;
  multiline?: boolean;
}

export function AutocompleteInput({
  field,
  placeholder,
  onCommit,
  buttonLabel = 'Add',
  multiline = false,
}: Props) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<LearnedTerm[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (text.trim().length < 2) {
      setItems([]);
      return;
    }
    void db.suggest(field, text).then((rows) => {
      if (cancelled) return;
      setItems(rows.filter((r) => r.text.toLowerCase() !== text.trim().toLowerCase()));
      setActive(-1);
    });
    return () => {
      cancelled = true;
    };
  }, [text, field]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const commit = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    onCommit(clean);
    setText('');
    setItems([]);
    setActive(-1);
    setOpen(false);
  };

  const visible = open && items.length > 0;

  return (
    <div className="compose" ref={box}>
      {multiline ? (
        <textarea
          rows={2}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit(text);
            }
          }}
        />
      ) : (
        <input
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && visible) {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === 'ArrowUp' && visible) {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, -1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              // A suggestion only wins if it was deliberately selected.
              commit(active >= 0 && items[active] ? items[active]!.text : text);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      )}
      <button className="btn" onClick={() => commit(text)} disabled={!text.trim()}>
        {buttonLabel}
      </button>
      {visible && (
        <div className="suggestions" role="listbox">
          <ul>
            {items.map((item, i) => (
              <li key={item.key}>
                <button
                  type="button"
                  className="suggestion"
                  data-active={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(item.text)}
                >
                  {item.text}
                  <span className="prov">used {item.count}&times;</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
