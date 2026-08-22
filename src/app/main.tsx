/**
 * PWA entry point.
 *
 * Offline is not a nice-to-have here: a clinic with intermittent power and
 * patchy data still has to be able to print a script, and the app has no server
 * to fall back on by design (PRODUCT.md 3.1, 5).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from '@render/screen/App.tsx';
import { ErrorBoundary } from '@render/screen/ErrorBoundary.tsx';
import { StoreProvider } from '@render/screen/store.tsx';
import '@render/screen/styles.css';

const updateSW = registerSW({
  onNeedRefresh() {
    // An update mid-consultation would be worse than an update a minute later.
    // The doctor decides when.
    if (confirm('A new version of Nabz is ready. Reload now?')) void updateSW(true);
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);
