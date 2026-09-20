/**
 * Where a doctor can go, as data.
 *
 * WHAT WAS WRONG
 * --------------
 * The shell used to stack two horizontally-scrolling strips: up to six
 * destinations in the header, then six or seven section tabs under it. On a
 * 390px phone that is two places the content runs off the right edge, neither
 * of which announces that it does. A button you cannot see is a button you
 * cannot press, and the old header comment said as much while treating the
 * scroll as the fix.
 *
 * WHAT REPLACED IT
 * ----------------
 * One nav per width, both generated from here: a grouped sidebar where there
 * is room, a bottom bar of four where there is not. Bottom rather than top,
 * because this is a one-handed phone app and the top of a 6" screen is out of
 * thumb reach.
 *
 * The grouping is the point. Six flat buttons force a doctor to read all six;
 * four labelled groups let them read one word and stop. `WRITE` is the
 * document, `RECORDS` is the past, `TOOLS` is arithmetic, `CLINIC` is the
 * building.
 *
 * This file is framework-free so the interesting half -- which destinations
 * exist for a given pack and device, and which of them fit on a phone -- is
 * testable without rendering anything.
 */
import { MODULE_META } from '@domain/modules/index.ts';
import type { ModuleId } from '@domain/pack.ts';

/**
 * `ModuleId` folds straight into `View`: every module id IS a valid
 * destination, chosen the moment it is added to `domain/pack.ts`'s closed
 * union. That is what lets the nav be GENERATED from `pack.modules` rather
 * than hardcoding one button per module -- the Growth button used to be gated
 * on device role alone and never on whether the active pack offered growth, so
 * a pack with `modules: []` still showed a tab leading nowhere.
 */
export type View =
  | 'write'
  | 'preview'
  | 'history'
  | 'settings'
  | 'builder'
  | 'clinic'
  | 'scores'
  | ModuleId;

export type NavGroupId = 'write' | 'records' | 'tools' | 'clinic';

export interface NavItem {
  id: View;
  label: string;
  /**
   * One line saying what is behind it. Optional: "Growth" needs no gloss, but
   * "Preview" and "Queue" are destinations a doctor may never have opened, and
   * the phone sheet has the room to say so.
   */
  hint?: string;
}

export interface NavGroup {
  id: NavGroupId;
  /** The heading. Uppercasing it is a CSS decision, not a data one. */
  label: string;
  items: NavItem[];
}

export interface NavInput {
  /** `pack.modules` -- the clinical tools THIS pack offers, in its own order */
  modules: readonly ModuleId[];
  /** how many scores the pack offers; zero means there is no Scores destination */
  scores: number;
  /** `profile.clinic.enabled` */
  queue: boolean;
  /**
   * A reception station. The clinical destinations are not rendered -- not
   * disabled, not PIN-hidden. There is nothing behind them on that machine,
   * and a greyed-out button implies there is (`domain/deviceRole.ts`).
   */
  reception: boolean;
}

/** Every destination the current pack, profile and device actually offer. */
export function navGroups(input: NavInput): NavGroup[] {
  const groups: NavGroup[] = [];
  const push = (id: NavGroupId, label: string, items: NavItem[]) => {
    if (items.length) groups.push({ id, label, items });
  };

  if (!input.reception) {
    push('write', 'Write', [
      { id: 'write', label: 'Script', hint: 'The document you are writing now' },
      { id: 'preview', label: 'Preview', hint: 'The page exactly as it will print' },
    ]);
    push('records', 'Records', [
      { id: 'history', label: 'History', hint: 'Scripts saved on this device' },
    ]);
    push('tools', 'Tools', [
      ...input.modules.map((id) => ({ id, label: MODULE_META[id].label })),
      ...(input.scores > 0 ? [{ id: 'scores' as const, label: 'Scores' }] : []),
    ]);
  }

  push('clinic', 'Clinic', [
    ...(input.queue
      ? [{ id: 'clinic' as const, label: 'Queue', hint: 'Today’s waiting list' }]
      : []),
    { id: 'settings', label: 'Settings', hint: 'Your details, backup, appearance' },
  ]);

  return groups;
}

/**
 * A slot on the phone's bottom bar: either a destination of its own, or a
 * button that opens a sheet holding several.
 */
export type BottomSlot =
  | { kind: 'item'; item: NavItem }
  | { kind: 'sheet'; id: 'tools' | 'more'; label: string; groups: NavGroup[] };

/** Destinations that earn their own button before anything is folded away. */
const PINNED: View[] = ['write', 'clinic'];

/**
 * The same destinations, folded to fit four buttons.
 *
 * Script and the Queue are pinned because they are what a doctor taps between
 * all morning. Tools gets its own button rather than hiding inside More
 * because a paediatrician opens Growth on most children, and a tool two taps
 * deep is a tool that gets done in someone's head instead.
 *
 * A single leftover is rendered as itself, not as a one-entry sheet: a
 * reception station offers Queue and Settings and should show two buttons, not
 * one button and a menu.
 */
export function bottomSlots(groups: NavGroup[]): BottomSlot[] {
  const flat = groups.flatMap((g) => g.items);
  const pinned = PINNED.map((id) => flat.find((i) => i.id === id)).filter(
    (i): i is NavItem => Boolean(i),
  );
  const taken = new Set<View>(pinned.map((i) => i.id));

  const tools = groups.find((g) => g.id === 'tools');
  if (tools) for (const i of tools.items) taken.add(i.id);

  const rest = groups
    .filter((g) => g.id !== 'tools')
    .map((g) => ({ ...g, items: g.items.filter((i) => !taken.has(i.id)) }))
    .filter((g) => g.items.length > 0);

  const slots: BottomSlot[] = pinned.map((item) => ({ kind: 'item', item }));
  if (tools) slots.push({ kind: 'sheet', id: 'tools', label: 'Tools', groups: [tools] });

  const leftovers = rest.flatMap((g) => g.items);
  if (leftovers.length === 1) slots.push({ kind: 'item', item: leftovers[0]! });
  else if (leftovers.length > 1) {
    slots.push({ kind: 'sheet', id: 'more', label: 'More', groups: rest });
  }

  return slots;
}
