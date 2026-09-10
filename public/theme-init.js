// Applied before first paint so a stored/system dark preference doesn't flash
// light first — this mirrors src/theme/theme.ts's own logic. Kept as an external
// file (not an inline <script>) so the production CSP can stay `script-src 'self'`
// with no inline allowance. See firebase.json.
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
