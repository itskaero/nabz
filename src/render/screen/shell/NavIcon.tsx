/**
 * One glyph per destination, drawn rather than imported.
 *
 * An icon library is 40-200 kB to render fourteen shapes, and this app is a
 * PWA installed over a Pakistani mobile connection — the whole point of the
 * budget is that it opens on a phone that is not new. These are stroked paths
 * on a 24-grid at 1.6px, which is the weight that survives being drawn at
 * 18px on a 1x screen.
 *
 * The icons are DECORATION and the labels carry the meaning. Every nav row
 * shows both, every icon is `aria-hidden`, and nothing here is the only way to
 * tell two destinations apart — which is the rule that lets an icon be
 * imperfect without being a bug.
 */
import type { View } from './navModel.ts';

const PATHS: Partial<Record<View, string>> = {
  // a sheet with a line of writing on it
  write: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h6M10 16h4',
  // the same sheet, seen
  preview: 'M3 12s3.5-5.5 9-5.5S21 12 21 12s-3.5 5.5-9 5.5S3 12 3 12z M12 14a2 2 0 100-4 2 2 0 000 4z',
  // two people
  patients: 'M9 11a3.2 3.2 0 100-6.4A3.2 3.2 0 009 11z M2.5 20c0-3.3 2.9-5.2 6.5-5.2s6.5 1.9 6.5 5.2 M17 11.2a2.6 2.6 0 100-5.2 M18 14.9c2 .5 3.5 1.9 3.5 4.1',
  // a stack of past sheets
  history: 'M8 4h8l3 3v13H8z M5 7v13h11 M11 11h5M11 15h3',
  // a rising line
  growth: 'M4 19V5 M4 19h16 M7.5 15.5l3.5-4 3 2.5 4.5-6',
  // a kidney-ish bean
  gfr: 'M15.5 5.5c-4 0-7 2.9-7 6.5s2.5 6.5 6 6.5c2.2 0 3.5-1.2 3.5-2.8 0-2.8-4-2.1-4-4.2 0-1.8 3.5-1.3 3.5-3.9 0-1.3-.9-2.1-2-2.1z',
  // a body in a frame
  bmi: 'M5 4h14v16H5z M12 8.5a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6z M12 9.5v5 M9.5 11.5h5 M10 18l2-3.5 2 3.5',
  // a bowl
  malnutrition: 'M4 11h16c0 4.4-3.6 7-8 7s-8-2.6-8-7z M8 8c0-1.5 1.8-1.5 1.8-3 M12 8c0-1.8 2-1.8 2-3.5 M16 8c0-1.5 1.6-1.5 1.6-2.8',
  // a syringe
  dosecalc: 'M14.5 4.5l5 5 M17 7l-9 9-3.5 1 1-3.5 9-9z M11 10l2 2 M9 12l2 2',
  // a checklist
  scores: 'M8 4h11v16H8z M5 7v13h11 M11 9.5l1.2 1.2 2.6-2.6 M11 14.5l1.2 1.2 2.6-2.6',
  // a house
  home: 'M4 11l8-6.5 8 6.5 M6.5 9.8V20h11V9.8 M10 20v-5h4v5',
  // a building with a cross
  clinic: 'M5 20V7l7-3 7 3v13 M9 20v-4h6v4 M12 8.5v4 M10 10.5h4',
  // a cog
  settings:
    'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z M19.4 13a7.6 7.6 0 000-2l1.8-1.3-1.9-3.3-2.1.8a7.6 7.6 0 00-1.7-1l-.3-2.2h-3.8l-.3 2.2a7.6 7.6 0 00-1.7 1l-2.1-.8-1.9 3.3L7.2 11a7.6 7.6 0 000 2l-1.8 1.3 1.9 3.3 2.1-.8c.5.4 1.1.8 1.7 1l.3 2.2h3.8l.3-2.2c.6-.2 1.2-.6 1.7-1l2.1.8 1.9-3.3z',
  // a clipboard being edited
  builder: 'M9 5H6v15h12V5h-3 M9.5 3.5h5V6h-5z M9 11h4M9 14.5h6',
};

export function NavIcon({ id }: { id: View }) {
  const d = PATHS[id];
  if (!d) return null;
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {d.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : `M${seg}`} />
      ))}
    </svg>
  );
}
