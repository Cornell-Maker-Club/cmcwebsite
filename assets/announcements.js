// Cornell Maker Club — homepage announcements ("living poster").
// Reads the club's Announcements Google Sheet and shows each row as a poster.
// Paste the sheet's link into data-sheet="" on the cmc-announcements box in index.html.
// The sheet must be shared as "Anyone with the link can view".
//
// Sheet columns (first row = these headers, any order, extra columns ignored):
//   Title | Date | Details | Flyer | Link | Show until
//   - Flyer: a Google Drive share link to an image, or any image URL (optional)
//   - Link: where the poster should go when clicked (optional)
//   - Show until: a date like 2026-12-05; after that day the poster disappears (optional)
// Rows show in sheet order, top first. Leave Title blank to skip a row.
(function () {
  var section = document.getElementById('announcements');
  var board = document.getElementById('cmc-announcements');
  if (!section || !board) return;
  var sheet = (board.getAttribute('data-sheet') || '').trim();
  if (!sheet) return; // nothing configured: the section stays hidden

  var id = (sheet.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1] || sheet;
  var url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(id) + '/gviz/tq?tqx=out:csv';

  // Small CSV parser (handles quotes, commas and line breaks inside quotes).
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function imageURL(v) {
    v = (v || '').trim();
    if (!v) return '';
    var m = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200';
    return /^https?:\/\//.test(v) || /^[\w./-]+\.(png|jpe?g|gif|webp|svg)$/i.test(v) ? v : '';
  }
  function safeLink(v) { v = (v || '').trim(); return /^(https?:|mailto:|\.\.?\/|\/|#)/.test(v) ? v : ''; }
  function expired(v) {
    v = (v || '').trim();
    if (!v) return false;
    var d = new Date(v);
    if (isNaN(d)) return false;
    d.setHours(23, 59, 59, 999);
    return d < new Date();
  }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (k) { if (k != null) e.append(k); });
    return e;
  }

  fetch(url)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (text) {
      var rows = parseCSV(text);
      if (rows.length < 2) return;
      var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
      var col = function (row, name) { var i = head.indexOf(name); return i < 0 ? '' : (row[i] || '').trim(); };
      var items = rows.slice(1).filter(function (r) { return col(r, 'title') && !expired(col(r, 'show until')); });
      if (!items.length) return;

      board.replaceChildren.apply(board, items.map(function (r) {
        var link = safeLink(col(r, 'link')), src = imageURL(col(r, 'flyer'));
        var title = col(r, 'title'), date = col(r, 'date'), details = col(r, 'details');
        var img = src ? el('img', { src: src, alt: 'Flyer: ' + title, loading: 'lazy', class: 'poster-img' }) : null;
        // No flyer? Draw a simple typographic poster so every card has the same shape.
        var visual = img || el('div', { class: 'poster-block', 'aria-hidden': 'true' }, [
          date ? el('span', { class: 'poster-block-date' }, [date]) : null,
          el('span', { class: 'poster-block-title' }, [title]),
        ]);
        var kids = [
          link ? el('a', { href: link, class: 'poster-img-link', tabindex: '-1' }, [visual]) : visual,
          date ? el('span', { class: 'poster-date' }, [date]) : null,
          el('h3', { class: 'poster-title' }, [link ? el('a', { href: link }, [title]) : title]),
          details ? el('p', { class: 'poster-text' }, [details]) : null,
        ];
        return el('article', { class: 'poster' }, kids);
      }));
      section.hidden = false;
    })
    .catch(function () { /* sheet missing or not shared: keep the section hidden */ });
})();
