// Cornell Maker Club — small site-wide behaviors.
(function () {
  // Site search: GitHub Pages has no search backend, so hand the query to Google, limited to this site.
  document.querySelectorAll('form.site-search').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      var input = form.querySelector('input[name="q"]');
      var term = (input.value || '').trim();
      e.preventDefault();
      if (!term) { input.focus(); return; }
      var root = location.hostname;
      var seg = location.pathname.split('/')[1];
      if (/\.github\.io$/.test(location.hostname) && seg && seg.indexOf('.') === -1) root += '/' + seg;
      location.href = 'https://www.google.com/search?q=' + encodeURIComponent('site:' + root + ' ' + term);
    });
  });

  // Keep the footer year current.
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
