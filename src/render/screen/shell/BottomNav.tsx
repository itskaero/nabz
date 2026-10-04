/**
 * The phone nav: four buttons within thumb reach.
 *
 * Rendered below 900px instead of the header strip, for the reason in
 * `navModel.ts`: the top of a 6" screen held one-handed is somewhere a doctor
 * at OPD speed has to shuffle their grip to reach, and the old strip put
 * six destinations there and then hid half of them off the right edge.
 *
 * It sits UNDER the action bar, and that ordering is deliberate: the action
 * bar is what to do with this document, the nav is where to go instead. Two
 * rows cost about 46px more than the header strip did; the banner collapse
 * gives back three times that, and nothing scrolls sideways any more.
 *
 * `Tools` and `More` open the same sheet component with different contents,
 * which is the phone's version of the sidebar's groups.
 */
import { useState } from 'react';
import { Dialog } from '../components/Dialog.tsx';
import type { BottomSlot, NavGroup, View } from './navModel.ts';

function NavSheet({
  label,
  groups,
  view,
  onGo,
  onClose,
  disabled,
}: {
  label: string;
  groups: NavGroup[];
  view: View;
  onGo: (v: View) => void;
  onClose: () => void;
  disabled?: Partial<Record<View, string>>;
}) {
  return (
    <Dialog label={label} onClose={onClose}>
      <div className="sheet-modal nav-sheet">
        <h3>{label}</h3>
        {groups.map((group) => (
          <div className="nav-sheet-group" key={group.id}>
            {/* Only where there is more than one: with several the headings are
                what make the list skimmable, and with one the heading would
                just repeat the title of the sheet you pressed to get here. */}
            {groups.length > 1 && <h4 className="side-group-label">{group.label}</h4>}
            {group.items.map((item) => {
              const why = disabled?.[item.id];
              return (
                <button
                  key={item.id}
                  className="nav-sheet-item"
                  aria-current={view === item.id ? 'page' : undefined}
                  disabled={Boolean(why)}
                  onClick={() => {
                    onGo(item.id);
                    onClose();
                  }}
                >
                  <strong>{item.label}</strong>
                  {(why ?? item.hint) && <span>{why ?? item.hint}</span>}
                </button>
              );
            })}
          </div>
        ))}
        <button className="btn quiet" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}

export function BottomNav({
  slots,
  view,
  onGo,
  disabled,
}: {
  slots: BottomSlot[];
  view: View;
  onGo: (v: View) => void;
  disabled?: Partial<Record<View, string>>;
}) {
  const [open, setOpen] = useState<'tools' | 'more' | null>(null);
  const sheet = slots.find((s) => s.kind === 'sheet' && s.id === open);

  return (
    <>
      <nav className="bottom-nav" aria-label="Sections">
        {slots.map((slot) => {
          if (slot.kind === 'item') {
            const why = disabled?.[slot.item.id];
            return (
              <button
                key={slot.item.id}
                className="bottom-item"
                aria-current={view === slot.item.id ? 'page' : undefined}
                disabled={Boolean(why)}
                onClick={() => onGo(slot.item.id)}
              >
                {slot.item.label}
              </button>
            );
          }
          /*
            aria-current on the group button when the current view is inside
            it: otherwise a doctor looking at the Growth panel sees a bottom
            bar with nothing marked, which reads as "you are nowhere".
          */
          const holdsView = slot.groups.some((g) => g.items.some((i) => i.id === view));
          return (
            <button
              key={slot.id}
              className="bottom-item"
              aria-current={holdsView ? 'page' : undefined}
              aria-haspopup="dialog"
              aria-expanded={open === slot.id}
              onClick={() => setOpen(open === slot.id ? null : slot.id)}
            >
              {slot.label}
            </button>
          );
        })}
      </nav>

      {sheet?.kind === 'sheet' && (
        <NavSheet
          label={sheet.label}
          groups={sheet.groups}
          view={view}
          onGo={onGo}
          onClose={() => setOpen(null)}
          {...(disabled ? { disabled } : {})}
        />
      )}
    </>
  );
}
