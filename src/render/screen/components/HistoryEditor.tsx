/**
 * The background history: antenatal, birth, feeding, family.
 *
 * NOT `HistoryPanel.tsx`, which is the refill search wearing the same word.
 *
 * It renders whatever the active pack declares and knows nothing about
 * paediatrics -- the same relationship `ExamSection.tsx` has with examination
 * systems. A medicine pack declaring social and obstetric history gets the
 * same screen with no code change, which is the whole reason the questions are
 * pack data.
 *
 * EASE OF FILLING, AS RULES RATHER THAN AN INTENTION
 * --------------------------------------------------
 *  1. Every field is optional. Nothing here can block a save or a print.
 *  2. Written once, read forever: birth history is entered once in a child's
 *     life. That is the actual win, and it is the opposite of `problems` and
 *     `examination`, which are retyped at every visit.
 *  3. Tap first, type optional. Where the answers can be enumerated the pack
 *     enumerates them; `text` is the default kind so a question whose answers
 *     cannot be listed still gets a usable field.
 *  4. Collapsed, with a filled/total count on each heading, so you can see
 *     where there is content without opening seven sections.
 *  5. Autosave on blur. No Save button to forget when the next patient walks
 *     in.
 */
import { useEffect, useRef, useState } from 'react';
import type { HistoryFieldDefinition } from '@domain/pack.ts';
import type { HistoryAnswers } from '@domain/history.ts';
import {
  answerKey,
  historyProgress,
  resolveSections,
  setAnswer,
  toggleChip,
} from '@domain/history.ts';
import type { ContentPack } from '@domain/pack.ts';

export function HistoryEditor({
  pack,
  answers,
  ageDays,
  onChange,
}: {
  pack: ContentPack;
  answers: HistoryAnswers;
  ageDays?: number | undefined;
  onChange: (next: HistoryAnswers) => void;
}) {
  const resolved = resolveSections(pack.historySections, answers, ageDays);
  const [open, setOpen] = useState<string | null>(null);

  if (!pack.historySections?.length) {
    return (
      <section className="card">
        <h2>History</h2>
        <p className="empty">
          This pack does not ask for a background history. A pack that declares
          one gets this screen with no change to the app.
        </p>
      </section>
    );
  }

  if (resolved.length === 0) {
    return (
      <section className="card">
        <h2>History</h2>
        <p className="empty">Nothing in this pack’s history applies at this age.</p>
      </section>
    );
  }

  const progress = historyProgress(resolved);

  return (
    <section className="card">
      <h2>History</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Written once and read at every visit afterwards. Every field is optional
        — {progress.filled} of {progress.total} answered.
      </p>

      <div className="history-sections">
        {resolved.map(({ section, filled, total, outsideBand }) => (
          <div className="history-section" key={section.id}>
            <button
              className="history-head"
              aria-expanded={open === section.id}
              onClick={() => setOpen(open === section.id ? null : section.id)}
            >
              <span className="history-title">{section.label}</span>
              <span className="history-count" data-filled={filled > 0 ? 'true' : undefined}>
                {filled}/{total}
              </span>
            </button>
            {open === section.id && (
              <div className="history-fields">
                {section.note && <p className="hint" style={{ marginTop: 0 }}>{section.note}</p>}
                {outsideBand && (
                  <p className="hint">
                    Recorded earlier. This section is not usually asked at this
                    age, and is shown because it already has answers.
                  </p>
                )}
                {section.fields.map((field) => (
                  <Field
                    key={field.id}
                    sectionId={section.id}
                    field={field}
                    answers={answers}
                    onChange={onChange}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({
  sectionId,
  field,
  answers,
  onChange,
}: {
  sectionId: string;
  field: HistoryFieldDefinition;
  answers: HistoryAnswers;
  onChange: (next: HistoryAnswers) => void;
}) {
  const stored = answers[answerKey(sectionId, field.id)];
  const kind = field.kind ?? 'text';

  if (kind === 'choice') {
    const current = typeof stored?.value === 'string' ? stored.value : '';
    return (
      <div className="opt-group">
        <label>{field.label}</label>
        <div className="opts">
          {(field.options ?? []).map((option) => (
            <button
              key={option}
              className="opt"
              aria-pressed={current === option}
              onClick={() =>
                // Tapping the chosen one again clears it. A question answered
                // by mistake has to be un-answerable without a Clear button.
                onChange(setAnswer(answers, sectionId, field.id, current === option ? '' : option))
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'chips') {
    const current = Array.isArray(stored?.value) ? stored.value : [];
    return (
      <div className="opt-group">
        <label>{field.label}</label>
        <div className="opts">
          {(field.options ?? []).map((option) => (
            <button
              key={option}
              className="opt"
              aria-pressed={current.includes(option)}
              onClick={() => onChange(toggleChip(answers, sectionId, field.id, option))}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TextishField sectionId={sectionId} field={field} answers={answers} onChange={onChange} />
  );
}

/**
 * Text, number and date, which share one behaviour: edit locally, write on
 * blur.
 *
 * Writing on every keystroke would put a storage round-trip between the doctor
 * and the next character. Writing only on an explicit Save would lose the
 * field when the next patient walks in, which is the failure this is actually
 * designed around.
 */
function TextishField({
  sectionId,
  field,
  answers,
  onChange,
}: {
  sectionId: string;
  field: HistoryFieldDefinition;
  answers: HistoryAnswers;
  onChange: (next: HistoryAnswers) => void;
}) {
  const stored = answers[answerKey(sectionId, field.id)];
  const storedText = typeof stored?.value === 'string' ? stored.value : '';
  const [draft, setDraft] = useState(storedText);
  const lastStored = useRef(storedText);

  // Follow the record when it changes underneath (another patient opened, a
  // restore) without stamping on what is being typed right now.
  useEffect(() => {
    if (storedText !== lastStored.current) {
      lastStored.current = storedText;
      setDraft(storedText);
    }
  }, [storedText]);

  const commit = () => {
    if (draft === storedText) return;
    lastStored.current = draft;
    onChange(setAnswer(answers, sectionId, field.id, draft));
  };

  const kind = field.kind ?? 'text';
  return (
    <div className={kind === 'number' ? 'field num' : 'field'}>
      <label htmlFor={`h-${sectionId}-${field.id}`}>
        {field.label}
        {field.unit ? <span className="unit"> ({field.unit})</span> : null}
      </label>
      <input
        id={`h-${sectionId}-${field.id}`}
        type={kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text'}
        value={draft}
        placeholder={field.hint ?? ''}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
      {stored && <span className="field-noted">noted {stored.notedOn}</span>}
    </div>
  );
}
