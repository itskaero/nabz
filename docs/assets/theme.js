/**
 * Light/dark/system toggle for the marketing site (DESIGN.md 14a) -- same
 * localStorage key and same three-state model as the app's own
 * src/domain/colorScheme.ts, even though this is a separate static site with
 * no shared build step. A separate file from nav.js on purpose: that file's
 * own docblock scopes it to the mobile menu, and mixing concerns there would
 * misdescribe it.
 *
 * The no-FOUC guard runs synchronously as this script loads (not on
 * DOMContentLoaded), so it must be placed in <head> before assets/style.css
 * is of much use -- same reasoning as the app's own index.html inline script.
 */
(function () {
  var KEY = 'nabz.colorScheme';

  function stored() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function resolve(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    try {
      return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function apply(pref) {
    document.documentElement.dataset.theme = resolve(pref);
  }

  // Applied immediately -- this is the no-FOUC guard.
  apply(stored());

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    var label = function (pref) {
      return pref === 'light' ? 'Light' : pref === 'dark' ? 'Dark' : 'Auto';
    };
    var render = function () {
      btn.textContent = label(stored());
      btn.setAttribute('aria-label', 'Theme: ' + label(stored()) + '. Click to change.');
    };
    render();
    btn.addEventListener('click', function () {
      var order = ['light', 'dark', 'system'];
      var next = order[(order.indexOf(stored()) + 1) % order.length];
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {
        /* the toggle will simply not persist across reloads */
      }
      apply(next);
      render();
    });
  });

  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (stored() === 'system') apply('system');
    });
  }
})();
