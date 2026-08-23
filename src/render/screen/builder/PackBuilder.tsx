/**
 * The pack builder (DESIGN.md 12).
 *
 * Its distinctive job is not editing — it is REFUSING. Anyone can build a form
 * over a JSON blob; what makes this worth having is that it will not let a pack
 * out of the door with an uncited dose, a half-translated phrase, an unsigned
 * red flag or two spellings of one generic. Those four are the failures that
 * reach a patient silently, and every one of them is checked here at the moment
 * a human is present to fix it.
 *
 * The validators are not re-implemented: this is a surface over
 * `validateContentPack`, `validatePacks` and the generics guard, all of which
 * the clinical app already depends on and the test suite already covers.
 */
import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store.tsx';
import { forkForEditing, publishContent, revertToShipped, shippedContent } from '@data/provider.ts';
import { useDraft } from './useDraft.ts';
import { downloadPack, parsePackFile, serialisePack } from './packFile.ts';
import { ExamTab } from './tabs/ExamTab.tsx';
import { LabsTab } from './tabs/LabsTab.tsx';
import { FormularyTab } from './tabs/FormularyTab.tsx';
import { DosingTab } from './tabs/DosingTab.tsx';
import { AdviceTab } from './tabs/AdviceTab.tsx';
import { PhrasesTab } from './tabs/PhrasesTab.tsx';
import { ReviewTab } from './tabs/ReviewTab.tsx';

type Tab = 'exam' | 'labs' | 'formulary' | 'dosing' | 'advice' | 'phrases' | 'review';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'formulary', label: 'Medicines' },
  { id: 'dosing', label: 'Doses' },
  { id: 'phrases', label: 'Phrases' },
  { id: 'advice', label: 'Advice' },
  { id: 'exam', label: 'Exam' },
  { id: 'labs', label: 'Tests' },
  { id: 'review', label: 'Review & export' },
];

export function PackBuilder({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const initial = useMemo(
    () => forkForEditing({ ...shippedContent, pack: store.pack, phrases: store.phrases }),
    [store.pack, store.phrases],
  );
  const draft = useDraft(initial.pack, initial.phrases);
  const [tab, setTab] = useState<Tab>('formulary');
  const [status, setStatus] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = async () => {
    const result = await publishContent(draft.pack, draft.phrases);
    if (!result.ok) {
      setStatus(`Not saved — ${result.errors.length} problem(s) must be fixed first.`);
      setTab('review');
      return;
    }
    await store.refreshContent();
    draft.markClean();
    setStatus('Saved. Every script you write from now on uses this content.');
  };

  const importFile = async (file: File) => {
    try {
      const parsed = parsePackFile(await file.text());
      draft.setPack(parsed.pack);
      draft.setPhrases(parsed.phrases);
      setStatus(`Loaded ${file.name}. Nothing is live until you save.`);
      setTab('review');
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  const revert = async () => {
    const content = await revertToShipped();
    draft.setPack(structuredClone(content.pack));
    draft.setPhrases(structuredClone(content.phrases));
    await store.refreshContent();
    draft.markClean();
    setConfirmRevert(false);
    setStatus('Back to the content this build shipped with.');
  };

  const errorCount = draft.errors.length;

  return (
    <>
      <div className="builder-bar">
        <div>
          <strong>Pack builder</strong>
          <small>
            {draft.pack.specialty} · {draft.stats.brands} medicines ·{' '}
            {draft.stats.generics} generics · {draft.stats.dosing} cited doses
          </small>
        </div>
        <span className="spacer" />
        {draft.dirty && <span className="pill">unsaved</span>}
        <span className={errorCount ? 'pill bad' : 'pill good'}>
          {errorCount ? `${errorCount} blocking` : 'ready to export'}
        </span>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            <strong>
              {t.label}
              {t.id === 'review' && errorCount > 0 && <span className="badge bad">{errorCount}</span>}
              {t.id === 'formulary' && draft.stats.unreconciled > 0 && (
                <span className="badge">{draft.stats.unreconciled}</span>
              )}
              {t.id === 'advice' && draft.stats.unreviewedRedFlags > 0 && (
                <span className="badge bad">{draft.stats.unreviewedRedFlags}</span>
              )}
            </strong>
          </button>
        ))}
      </nav>

      <div className="body">
        {status && <p className="hint builder-status">{status}</p>}

        {tab === 'formulary' && <FormularyTab draft={draft} />}
        {tab === 'dosing' && <DosingTab draft={draft} />}
        {tab === 'phrases' && <PhrasesTab draft={draft} />}
        {tab === 'advice' && <AdviceTab draft={draft} />}
        {tab === 'exam' && <ExamTab draft={draft} />}
        {tab === 'labs' && <LabsTab draft={draft} />}
        {tab === 'review' && (
          <ReviewTab draft={draft} json={serialisePack(draft.pack, draft.phrases)} />
        )}

        {confirmRevert && (
          <div className="scrim" role="dialog" aria-modal="true">
            <div className="sheet-modal">
              <h3>Discard your edits?</h3>
              <div className="warn-box" style={{ margin: '10px 0' }}>
                <strong>This cannot be undone.</strong>
                Every change you have saved to the drug list, doses, phrases and
                chips goes back to what this build shipped with. Export first if
                you want to keep them.
              </div>
              <div className="actionbar" style={{ padding: 0, borderTop: 'none' }}>
                <button className="btn quiet" onClick={() => setConfirmRevert(false)}>
                  Cancel
                </button>
                <button className="btn danger" onClick={revert}>
                  Discard and use the built-in pack
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="actionbar">
        <button className="btn quiet" onClick={onDone}>
          Back to the script
        </button>
        <button className="btn quiet" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = '';
          }}
        />
        <button
          className="btn ghost"
          disabled={!draft.exportable}
          title={draft.exportable ? undefined : 'Fix the blocking problems first'}
          onClick={() => downloadPack(draft.pack, draft.phrases)}
        >
          Export
        </button>
        <button className="btn quiet danger" onClick={() => setConfirmRevert(true)}>
          Reset
        </button>
        <button className="btn" disabled={!draft.dirty || !draft.exportable} onClick={save}>
          Save
        </button>
      </footer>
    </>
  );
}
