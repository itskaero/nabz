/**
 * A last line of defence against the white screen.
 *
 * This exists because of a real failure: a rejected WASM module took the whole
 * app down and rendered nothing at all -- no message, no hint, no way for the
 * person in front of it to know whether the app was broken or still loading.
 * In a clinic that is the worst possible failure mode, so anything that throws
 * during render now produces a page that says so and offers a way out.
 *
 * The "your records are safe" line is not reassurance for its own sake: the
 * data is in IndexedDB, a render crash cannot touch it, and a doctor whose
 * screen just went blank deserves to be told that before anything else.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only. Nothing clinical leaves this device, and that includes
    // crash reports (PRODUCT.md rule 3.1).
    console.error('Nabz crashed while rendering:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            Nabz
            <small>on this device only</small>
          </div>
        </header>
        <div className="body">
          <section className="card">
            <h2>Something went wrong</h2>
            <p>
              Your saved records are safe. They live in this device&rsquo;s
              storage and a display problem cannot reach them.
            </p>
            <div className="warn-box" style={{ margin: '10px 0' }}>
              <strong>What failed</strong>
              {error.message}
            </div>
            <p className="hint">
              Reloading usually clears it. If it keeps happening, export a backup
              from Settings before doing anything else.
            </p>
            <div className="actionbar" style={{ padding: '10px 0 0', borderTop: 'none' }}>
              <button className="btn" onClick={() => window.location.reload()}>
                Reload
              </button>
              <button
                className="btn quiet"
                onClick={() => this.setState({ error: null })}
              >
                Try to continue
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }
}
