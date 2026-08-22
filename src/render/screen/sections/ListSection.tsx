/**
 * Problems and Diagnosis: free text plus own-history autocomplete.
 *
 * DELIBERATELY NOT CHIPS. PRODUCT.md 8 is explicit that diagnosis is judgement
 * and that chip-ifying it trades the doctor's thinking for click convenience.
 * Problems are the patient's words and are unbounded for the same reason. The
 * accelerator here is the doctor's own history, nothing more.
 */
import { useStore } from '../store.tsx';
import { AutocompleteInput } from '../components/AutocompleteInput.tsx';

interface Props {
  field: 'problems' | 'diagnosis';
  title: string;
  placeholder: string;
  strong?: boolean;
  note?: string;
}

export function ListSection({ field, title, placeholder, strong, note }: Props) {
  const { rx, setList } = useStore();
  const items = rx[field];

  return (
    <section className="card">
      <h2>{title}</h2>
      {items.length === 0 && <p className="empty">Nothing recorded yet.</p>}
      {items.map((text, i) => (
        <div className="entry-row" key={`${text}-${i}`}>
          <span className={strong ? 'text strong' : 'text'}>{text}</span>
          <button
            className="mini"
            aria-label={`Remove ${text}`}
            onClick={() => setList(field, items.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <AutocompleteInput
        field={field === 'problems' ? 'problem' : 'diagnosis'}
        placeholder={placeholder}
        onCommit={(text) => setList(field, [...items, text])}
      />
      {note && <p className="hint">{note}</p>}
    </section>
  );
}
