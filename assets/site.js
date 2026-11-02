// Cornell Maker Club — small site-wide behaviors.
(function () {
  // Keep the footer year current.
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
