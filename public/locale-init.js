// Sets <html lang> before first paint from the stored locale. External (not inline)
// so the production CSP can stay `script-src 'self'`. Mirrors theme-init.js; the
// provider in src/i18n keeps the attribute current afterwards.
(function () {
  try {
    var stored = localStorage.getItem('vcb.locale');
    document.documentElement.lang = stored === 'it' ? 'it' : 'en';
  } catch (e) {}
})();
