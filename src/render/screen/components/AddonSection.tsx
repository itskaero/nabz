/**
 * Addons, in Settings, next to the pack library they layer over.
 *
 * Two things this surface exists to make honest:
 *
 *  1. **It shows the key, not a tick.** A verified signature says the file has
 *     not changed since that key signed it. It does NOT say the key belongs to
 *     the society named on the manifest -- that is a human judgement, and
 *     hiding it behind a green tick would be claiming something the
 *     cryptography does not prove.
 *  2. **It keeps saying the warnings.** An addon installed with warnings
 *     carries them for as long as it is installed, rather than showing them
 *     once in a toast nobody reads twice.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InstalledAddon } from '@storage/db.ts';
import type { AddonIssue } from '@domain/addon.ts';
import type { Verdict } from '@domain/addonSignature.ts';
import { keyFingerprint } from '@domain/addonSignature.ts';
import { installAddon, listAddons, removeAddon } from '@data/provider.ts';

const VERDICT_LABEL: Record<Verdict, string> = {
  valid: 'signed',
  invalid: 'signature does not match',
  unverifiable: 'signature not checked',
  unsigned: 'unsigned',
};

export function AddonSection({
  packId,
  onChanged,
}: {
  packId: string;
  /** content has changed under the app; the store re-resolves */
  onChanged: () => void;
}) {
  const [installed, setInstalled] = useState<InstalledAddon[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [problems, setProblems] = useState<AddonIssue[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    void listAddons().then(setInstalled);
  }, []);
  useEffect(refresh, [refresh]);

  const install = async (file: File) => {
    setProblems([]);
    setStatus(null);
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setStatus('That file is not readable JSON.');
      return;
    }
    const result = await installAddon(raw, packId);
    if (!result.ok) {
      // Named, in full. An addon refuses for reasons a doctor can act on --
      // "this build has no malnutrition module" tells them to update the app.
      setProblems(result.errors);
      setStatus('Not installed.');
      return;
    }
    setProblems(result.warnings);
    setStatus(`Installed "${result.addon?.manifest.title}".`);
    refresh();
    onChanged();
  };

  const remove = async (id: string) => {
    await removeAddon(id);
    setStatus('Removed. The pack is back to what it was.');
    setProblems([]);
    refresh();
    onChanged();
  };

  return (
    <section className="card settings-section">
      <h3>Addons</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        An addon is a file that switches on a clinical tool this app already
        has, or adds content to your pack. It carries settings and words — never
        code — so it can only turn on something that shipped with the app and
        has been tested.
      </p>

      {installed.length === 0 && <p className="empty">Nothing installed.</p>}

      <div className="rows">
        {installed.map((entry) => (
          <div key={entry.id} className="addon-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{entry.addon.manifest.title}</strong>{' '}
              <span className="pill">{entry.addon.manifest.version}</span>{' '}
              {entry.verdict === 'valid' ? (
                <span className="pill good">{VERDICT_LABEL[entry.verdict]}</span>
              ) : (
                <span className="pill warn">{VERDICT_LABEL[entry.verdict]}</span>
              )}
              <div className="meta">{entry.addon.manifest.summary}</div>
              <div className="meta">
                by {entry.addon.manifest.author.name}
                {entry.addon.signature && (
                  <>
                    {' · key '}
                    {/*
                      The fingerprint, not a tick. A signature proves the file
                      has not changed, not that the signer is who the manifest
                      says — comparing this against what the author published
                      is the part only a person can do.
                    */}
                    <span className="mono">{keyFingerprint(entry.addon.signature.publicKey)}</span>
                  </>
                )}
              </div>
              {entry.warnings.map((w) => (
                <div key={w} className="meta addon-warn">
                  {w}
                </div>
              ))}
            </div>
            <button className="btn quiet danger" onClick={() => void remove(entry.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      {problems.length > 0 && (
        <div
          className={problems.some((p) => p.severity === 'error') ? 'warn-box' : 'ok-box'}
          style={{ margin: '10px 0' }}
        >
          <strong>
            {problems.some((p) => p.severity === 'error')
              ? 'This addon was not installed.'
              : 'Installed, with things worth knowing.'}
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
            {problems.map((p) => (
              <li key={p.where + p.message}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}

      {status && problems.length === 0 && (
        <p className="hint" style={{ margin: '6px 0 10px' }}>
          {status}
        </p>
      )}

      <button className="btn ghost" onClick={() => fileInput.current?.click()}>
        Install an addon from a file
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void install(file);
          e.target.value = '';
        }}
      />
    </section>
  );
}
