/**
 * The sig editor: the one place in the app where structure pays and is safe.
 *
 * Two rules it exists to enforce:
 *  1. NOTHING is pre-filled from the library. A slot the doctor has not chosen
 *     stays empty and the row says so. The alternative -- helpfully defaulting a
 *     frequency -- is the app writing a prescription (PRODUCT.md rule 3.2).
 *  2. The Urdu composes LIVE as slots change, from the Urdu template's own word
 *     order. Seeing the patient's sentence form while choosing is what makes the
 *     doctor trust it, and it is the wedge made visible (DESIGN.md 5).
 */
import { useMemo, useState } from 'react';
import type { MedicationLine, Quantity, Sig } from '@domain/prescription.ts';
import type { Patch } from '@domain/patch.ts';
import { applyPatch } from '@domain/patch.ts';
import { composeSig } from '@domain/sig.ts';
import { templateSlots } from '@domain/phrases.ts';
import type { ContentPack } from '@domain/pack.ts';
import type { PackRegistry } from '@domain/phrases.ts';

interface Props {
  line: MedicationLine;
  pack: ContentPack;
  /** the live locale registry, passed in so an edited pack composes correctly */
  packs: PackRegistry;
  onSave: (sig: Sig) => void;
  onClose: () => void;
}

/** Dose units offered per template family. Data-shaped, not a switch on drug. */
const DOSE_UNITS: Record<string, string[]> = {
  'sig.oral.liquid': ['ml', 'tsp'],
  'sig.oral.solid': ['tablet', 'capsule', 'mg'],
  'sig.oral.sachet': ['sachet'],
  'sig.drops.eye': ['drop'],
  'sig.drops.ear': ['drop'],
  'sig.drops.nasal': ['drop'],
  'sig.inhaled': ['puff'],
  'sig.prn': ['ml', 'tablet', 'mg'],
  'sig.stat': ['ml', 'tablet', 'mg'],
  'sig.topical': ['application'],
};

const TEMPLATE_LABELS: Record<string, string> = {
  'sig.oral.liquid': 'Liquid by mouth',
  'sig.oral.solid': 'Tablet / capsule',
  'sig.oral.sachet': 'Sachet in water',
  'sig.prn': 'When needed (PRN)',
  'sig.stat': 'Single dose now',
  'sig.topical': 'Apply to skin',
  'sig.drops.eye': 'Eye drops',
  'sig.drops.ear': 'Ear drops',
  'sig.drops.nasal': 'Nose drops',
  'sig.inhaled': 'Inhaler',
};

export function SigEditor({ line, pack, packs, onSave, onClose }: Props) {
  const [sig, setSig] = useState<Sig>(() => ({ ...line.sig, slots: { ...line.sig.slots } }));

  const slots = useMemo(() => {
    const template = packs.en.templates[sig.templateId];
    return new Set(template ? templateSlots(template) : []);
  }, [sig.templateId]);

  const preview = useMemo(() => {
    const draft: MedicationLine = { ...line, sig };
    return {
      en: composeSig(draft, 'en', packs),
      ur: composeSig(draft, 'ur-PK', packs),
    };
  }, [line, sig]);

  const set = (patch: Patch<Sig>) => setSig((prev) => applyPatch(prev, patch));
  const setSlot = (id: string, value: string) =>
    setSig((prev) => ({ ...prev, slots: { ...prev.slots, [id]: value } }));

  const qty = (q: Quantity | undefined, value: string, unit: string): Quantity | undefined => {
    const n = Number(value);
    if (!value.trim() || !Number.isFinite(n) || n <= 0) return undefined;
    return { value: n, unit: unit || q?.unit || 'day' };
  };

  const units = DOSE_UNITS[sig.templateId] ?? ['ml', 'tablet', 'mg'];
  const enVocab = packs.en.vocab;

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Edit instructions">
      <div className="sheet-modal">
        <h3>{line.drug.brand || line.drug.generic || line.drug.raw || 'Medicine'}</h3>
        <p className="sub">
          Every value here is yours to choose. Nothing is filled in for you.
        </p>

        <div className="live-preview">
          <div className="en">
            {preview.en.complete ? (
              preview.en.plain
            ) : (
              <span className="incomplete">
                Still needed: {preview.en.missing.join(', ') || 'a template'}
              </span>
            )}
          </div>
          <div className="ur" dir="rtl" lang="ur">
            {preview.ur.plain}
          </div>
        </div>

        <div className="opt-group">
          <label>Form of instruction</label>
          <div className="opts">
            {pack.sigTemplates.map((id) => (
              <button
                key={id}
                className="opt"
                aria-pressed={sig.templateId === id}
                onClick={() => {
                  const nextUnits = DOSE_UNITS[id] ?? units;
                  set({
                    templateId: id,
                    dose: { ...sig.dose, unit: nextUnits[0] ?? sig.dose.unit },
                  });
                }}
              >
                {TEMPLATE_LABELS[id] ?? id}
              </button>
            ))}
          </div>
        </div>

        {slots.has('administer') && (
          <div className="opt-group">
            <label>Who is being told</label>
            <div className="opts">
              {Object.entries(enVocab.administer ?? {}).map(([id, label]) => (
                <button
                  key={id}
                  className="opt"
                  aria-pressed={sig.slots?.administer === id}
                  onClick={() => setSlot('administer', id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {slots.has('dose') && (
          <div className="opt-group">
            <label>Dose</label>
            <div className="num-row">
              <div className="field num">
                <input
                  inputMode="decimal"
                  aria-label="Dose amount"
                  value={Number.isFinite(sig.dose.value) && sig.dose.value > 0 ? String(sig.dose.value) : ''}
                  placeholder="e.g. 5"
                  onChange={(e) =>
                    set({ dose: { value: Number(e.target.value), unit: sig.dose.unit } })
                  }
                />
              </div>
              <div className="opts" style={{ flex: 2 }}>
                {units.map((unit) => (
                  <button
                    key={unit}
                    className="opt"
                    aria-pressed={sig.dose.unit === unit}
                    onClick={() => set({ dose: { ...sig.dose, unit } })}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {slots.has('frequency') && (
          <div className="opt-group">
            <label>How often</label>
            <div className="opts">
              {Object.entries(enVocab.frequency ?? {}).map(([id, label]) => (
                <button
                  key={id}
                  className="opt"
                  aria-pressed={sig.frequency === id}
                  onClick={() => set({ frequency: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {slots.has('timing') && (
          <div className="opt-group">
            <label>When (optional)</label>
            <div className="opts">
              {Object.entries(enVocab.timing ?? {}).map(([id, label]) => (
                <button
                  key={id}
                  className="opt"
                  aria-pressed={sig.timing === id}
                  onClick={() => set({ timing: sig.timing === id ? undefined : id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {slots.has('duration') && (
          <div className="opt-group">
            <label>For how long (optional)</label>
            <div className="num-row">
              <div className="field num">
                <input
                  inputMode="numeric"
                  aria-label="Duration"
                  value={sig.duration ? String(sig.duration.value) : ''}
                  placeholder="e.g. 7"
                  onChange={(e) =>
                    set({ duration: qty(sig.duration, e.target.value, sig.duration?.unit ?? 'day') })
                  }
                />
              </div>
              <div className="opts" style={{ flex: 2 }}>
                {['day', 'week', 'month'].map((unit) => (
                  <button
                    key={unit}
                    className="opt"
                    aria-pressed={(sig.duration?.unit ?? 'day') === unit}
                    onClick={() =>
                      set({
                        duration: sig.duration ? { ...sig.duration, unit } : undefined,
                      })
                    }
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {slots.has('max') && (
          <div className="opt-group">
            <label>Maximum in 24 hours</label>
            <div className="num-row">
              <div className="field num">
                <input
                  inputMode="numeric"
                  aria-label="Maximum doses in 24 hours"
                  value={sig.max ? String(sig.max.value) : ''}
                  placeholder="e.g. 4"
                  onChange={(e) => set({ max: qty(sig.max, e.target.value, 'dose') })}
                />
              </div>
              <span className="hint" style={{ alignSelf: 'center' }}>
                doses — prints on the parent&rsquo;s copy
              </span>
            </div>
          </div>
        )}

        <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
          <button className="btn quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => onSave(sig)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
