/* ============================================================
   Theme selector UI (settings page). Reads/writes rh_theme via
   boot-auth.js helpers, highlights the active swatch.
   ============================================================ */
(function () {
  'use strict';
  var row = document.getElementById('themeRow');
  if (!row) return;

  function paint() {
    var cur = (window.rhGetTheme && window.rhGetTheme()) || 'light';
    row.querySelectorAll('.theme-btn').forEach(function (b) {
      b.classList.toggle('sel-theme', b.dataset.theme === cur);
    });
  }

  row.querySelectorAll('.theme-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      if (window.rhSetTheme) window.rhSetTheme(b.dataset.theme);
      paint();
    });
  });

  paint();
  window.addEventListener('rh:theme', paint);
})();
