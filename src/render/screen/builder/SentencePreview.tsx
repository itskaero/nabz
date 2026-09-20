/**
 * The sentence, as a patient will read it.
 *
 * Shown directly under the fields that produce it, not behind a button. An
 * author reviewing Urdu should never have to ask to see the Urdu — and the
 * whole reason this component exists is that the builder used to ask people to
 * vouch for wording they could not read in context (see `specimen.ts`).
 *
 * It deliberately looks like the printed patient block rather than like the
 * editor around it: same tint, same Nastaliq, same right alignment. What the
 * author is checking is a document, so it should read as one.
 */
import type { Rendering } from './specimen.ts';

export function SentencePreview({
  renderings,
  note,
}: {
  renderings: Rendering[];
  /** one line saying what the numbers in the specimen are, where it is not obvious */
  note?: string;
}) {
  return (
    <div className="specimen">
      <span className="specimen-label">As it will print</span>
      {renderings.map((r) => (
        <p
          key={r.locale}
          className={r.locale === 'ur-PK' ? 'ur specimen-line' : 'specimen-line'}
          dir={r.locale === 'ur-PK' ? 'rtl' : 'ltr'}
          lang={r.locale === 'ur-PK' ? 'ur' : 'en'}
        >
          {r.plain.trim() ? (
            r.plain
          ) : (
            /*
              An empty locale is the failure this screen exists to make
              visible: a template written in one language and not the other
              prints the wrong language to a patient.
            */
            <span className="specimen-empty">nothing written in {r.locale}</span>
          )}
        </p>
      ))}
      {renderings.some((r) => r.missing.length > 0) && (
        <p className="specimen-missing">
          Unfilled:{' '}
          {[...new Set(renderings.flatMap((r) => r.missing))].join(', ')} — the
          sentence asks for something the pack does not define, so it would
          print with a hole in it.
        </p>
      )}
      {note && <p className="specimen-note">{note}</p>}
    </div>
  );
}
