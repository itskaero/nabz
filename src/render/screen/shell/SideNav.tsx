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
import { NavIcon } from './NavIcon.tsx';

export function SideNav({
  groups,
  view,
  onGo,
  disabled,
  context,
}: {
  groups: NavGroup[];
  view: View;
  onGo: (v: View) => void;
  /** view -> why it cannot be opened right now. Shown as the title, and disables it. */
  disabled?: Partial<Record<View, string>>;
  /** what this device is set up as, shown at the head of the rail */
  context?: { mark: string; name: string; note: string; onOpen: () => void } | undefined;
}) {
  return (
    <nav className="side-nav" aria-label="Sections">
      {/*
        THE CONTEXT CARD, which both reference layouts put here and which this
        app badly needed.

        A doctor can be running the paediatric pack or the medicine one, and
        the machine can be a consulting room or a front desk. Those two facts
        decide what every screen behind this rail will do — which medicines
        autocomplete, which doses are offered, whether a prescription may be
        stored at all — and they were visible only by going into Settings and
        reading two separate sections.

        It is a button, because the thing it names is the thing you would want
        to change.
      */}
      {context && (
        <button className="context-card" onClick={context.onOpen}>
          <span className="context-mark" aria-hidden="true">
            {context.mark}
          </span>
          <span className="context-text">
            <strong>{context.name}</strong>
            <small>{context.note}</small>
          </span>
          <span className="context-caret" aria-hidden="true">
            ⌃⌄
          </span>
        </button>
      )}

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
                <NavIcon id={item.id} />
                <span className="side-item-label">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="side-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
