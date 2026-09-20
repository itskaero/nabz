/**
 * Everything that needs saying, on one line until you ask.
 *
 * WHAT WAS WRONG
 * --------------
 * Four of these could stack at once -- a plain-HTTP origin, a backup overdue,
 * the typeface still loading or failed, content rejected -- each a full-width
 * amber bar above the working area. On a 390px phone that is up to 136px of
 * the screen spent on conditions that are, by construction, not urgent: every
 * one of them has been true since the app opened and will still be true in an
 * hour.
 *
 * Worse, stacking them flattens them. Four amber bars read as wallpaper, and
 * the day one of them actually matters it looks exactly like the three that
 * did not.
 *
 * WHAT THIS IS NOT
 * ----------------
 * The allergy banner. That one is clinical, it is red, it carries
 * `role="alert"`, and it stays exactly where it is and as loud as it is. There
 * must be exactly one thing on this screen allowed to shout (DESIGN.md 3), and
 * folding it into a count would be the single worst change this file could
 * make.
 *
 * Nor is it the "still needs a patient name before it can print" line. That is
 * about THIS document, it sits next to the button it explains, and it goes
 * away by typing. These are conditions of the device and the app.
 *
 * ONE DOES NOT COLLAPSE
 * ---------------------
 * "1 thing needs attention [Show]" is a tap to read one sentence. A lone
 * notice renders as the banner it always was; two or more earn the summary.
 *
 * AND PROGRESS IS NOT ATTENTION
 * -----------------------------
 * "Loading the Urdu typeface" asks nothing of anybody. Counting it would make
 * "2 things need attention" a lie with a button on it, so a `progress` notice
 * keeps its own quiet line, in no colour at all -- amber here means "not
 * vetted", and a font that is loading is not unvetted, it is loading.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';

export interface Notice {
  id: string;
  /**
   * `progress` is a thing happening; the default, `attention`, is a thing to
   * do. Only the latter is counted or collapsed.
   */
  tone?: 'attention' | 'progress';
  /** the sentence in bold: what is true */
  title: string;
  /** what it costs and what to do about it. A node, so an address can be <code>. */
  body: ReactNode;
  action?: { label: string; run: () => void };
}

function Body({ notice }: { notice: Notice }) {
  return (
    <>
      <span>
        <strong>{notice.title}</strong> {notice.body}
      </span>
      {notice.action && (
        <button onClick={notice.action.run}>{notice.action.label}</button>
      )}
    </>
  );
}

export function StatusNotices({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const progress = notices.filter((n) => n.tone === 'progress');
  const attention = notices.filter((n) => n.tone !== 'progress');

  return (
    <>
      {progress.map((n) => (
        <div className="banner banner-progress" role="status" key={n.id}>
          <Body notice={n} />
        </div>
      ))}

      {attention.length === 1 && (
        <div className="banner banner-backup" role="status">
          <Body notice={attention[0]!} />
        </div>
      )}

      {attention.length > 1 && (
        <div className="banner banner-backup status-line" role="status">
          <button
            className="status-summary"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <span>{attention.length} things need attention</span>
            <span className="status-toggle">{open ? 'Hide' : 'Show'}</span>
          </button>
          {open && (
            <ul className="status-details">
              {attention.map((n) => (
                <li key={n.id}>
                  <Body notice={n} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
