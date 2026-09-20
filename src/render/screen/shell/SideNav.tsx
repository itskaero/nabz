/**
 * The desk nav: four labelled groups down the left.
 *
 * Only rendered at >= 900px (`useWideLayout`). It replaces a header strip that
 * scrolled sideways once the queue was turned on, which meant a reception
 * station with a 24" monitor was hiding buttons behind a gesture invented for
 * phones.
 *
 * The groups are headings rather than dividers because a heading can be read
 * and skipped; a divider has to be inferred. A group with nothing in it is not
 * rendered at all -- `navModel` drops it -- so a pack with no modules shows no
 * TOOLS heading rather than an empty one.
 */
import type { NavGroup, View } from './navModel.ts';

export function SideNav({
  groups,
  view,
  onGo,
  disabled,
}: {
  groups: NavGroup[];
  view: View;
  onGo: (v: View) => void;
  /** view -> why it cannot be opened right now. Shown as the title, and disables it. */
  disabled?: Partial<Record<View, string>>;
}) {
  return (
    <nav className="side-nav" aria-label="Sections">
      {groups.map((group) => (
        <div className="side-group" key={group.id}>
          <h2 className="side-group-label">{group.label}</h2>
          {group.items.map((item) => {
            const why = disabled?.[item.id];
            return (
              <button
                key={item.id}
                className="side-item"
                aria-current={view === item.id ? 'page' : undefined}
                disabled={Boolean(why)}
                title={why ?? item.hint}
                onClick={() => onGo(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
