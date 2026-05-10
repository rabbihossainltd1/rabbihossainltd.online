/* RabbiHossainLTD — Content Protection */
(function () {
  'use strict';

  // Disable right-click context menu
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  });

  // Disable text selection via keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I / Cmd+Shift+I (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+C (Inspector)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (View Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u')) {
      e.preventDefault();
      return false;
    }
    // Ctrl+S (Save page)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      return false;
    }
    // Ctrl+A (Select all)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      return false;
    }
  });

  // Disable drag
  document.addEventListener('dragstart', function (e) {
    e.preventDefault();
    return false;
  });

  // Disable copy
  document.addEventListener('copy', function (e) {
    e.preventDefault();
    return false;
  });

  // CSS: disable text selection & image drag
  var style = document.createElement('style');
  style.textContent = '* { -webkit-user-select: none !important; -moz-user-select: none !important; -ms-user-select: none !important; user-select: none !important; } input, textarea { -webkit-user-select: text !important; -moz-user-select: text !important; user-select: text !important; }';
  document.head.appendChild(style);
})();
