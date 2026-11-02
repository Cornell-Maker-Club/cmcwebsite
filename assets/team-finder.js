// Cornell Maker Club — Team Finder.
// Talks to the Google Apps Script backend (google/Code.gs) set in assets/config.js.
// With no backend set, it runs in preview mode and keeps posts in this browser only.
(function () {
  var ENDPOINT = ((window.CMC_CONFIG && window.CMC_CONFIG.teamFinderEndpoint) || '').trim();
  var KEY = 'cmc-team-finder-posts';
  var WORK = ['Electrical', 'Mechanical', 'Software', 'CAD / Design', 'Fabrication', 'Other'];
  var NETID = /^[a-z]{2,4}[0-9]{1,5}$/;
  var INPUT = 'font: inherit; font-size: 16px; padding: 10px 12px; border: 2px solid var(--color-divider); background: var(--color-bg); color: var(--color-text); border-radius: 0; width: 100%; box-sizing: border-box;';

  var state = { work: [], posts: [], busy: false, askId: null, sent: {} };
  var $ = function (id) { return document.getElementById(id); };
  var form = $('post-form'), chipsEl = $('chips'), postsEl = $('posts');

  // ---------- small DOM helper ----------
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'style') el.style.cssText = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) el.append(c); });
    return el;
  }
  function show(el, text) { el.textContent = text || ''; el.hidden = !text; }

  // ---------- storage / network ----------
  function readLocal() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function writeLocal(posts) { try { localStorage.setItem(KEY, JSON.stringify(posts)); } catch (e) {} }

  function call(body) {
    // text/plain keeps this a "simple" request, so Apps Script accepts it without a CORS preflight.
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }

  function load() {
    var status = $('board-status');
    if (!ENDPOINT) {
      $('demo-note').hidden = false;
      state.posts = readLocal();
      return render();
    }
    status.style.color = 'var(--color-neutral-700)';
    status.removeAttribute('role');
    show(status, 'Loading projects…');
    fetch(ENDPOINT + (ENDPOINT.indexOf('?') > -1 ? '&' : '?') + 'action=list')
      .then(function (r) { return r.json(); })
      .then(function (r) { state.posts = r.posts || []; render(); })
      .catch(function () {
        state.posts = [];
        render();
        status.style.color = 'var(--color-accent-700)';
        status.setAttribute('role', 'alert');
        show(status, 'Couldn’t load projects. Refresh to try again.');
      });
  }

  // ---------- post form ----------
  function renderChips() {
    chipsEl.replaceChildren.apply(chipsEl, WORK.map(function (label) {
      var on = state.work.indexOf(label) > -1;
      return h('button', {
        type: 'button', 'aria-pressed': String(on),
        style: 'font: inherit; font-size: 14px; padding: 8px 14px; border: 2px solid var(--color-divider); border-radius: 0; cursor: pointer;' +
          'background: ' + (on ? 'var(--color-text)' : 'var(--color-bg)') + '; color: ' + (on ? 'var(--color-bg)' : 'var(--color-text)') +
          '; border-color: ' + (on ? 'var(--color-text)' : 'var(--color-divider)') + ';',
        onclick: function () {
          state.work = on ? state.work.filter(function (x) { return x !== label; }) : state.work.concat(label);
          show($('post-error'));
          renderChips();
          chipsEl.children[WORK.indexOf(label)].focus();
        },
      }, [label]);
    }));
  }

  form.addEventListener('input', function () { show($('post-error')); show($('post-done')); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (state.busy) return;
    var f = form.elements, netid = f.netid.value.trim().toLowerCase();
    var error = '';
    if (!NETID.test(netid)) error = 'Enter a valid NetID, like abc123.';
    else if (!f.title.value.trim()) error = 'Add a project name.';
    else if (!f.desc.value.trim()) error = 'Add a short description.';
    else if (!state.work.length) error = 'Pick at least one kind of work.';
    if (error) return show($('post-error'), error);

    var post = {
      netid: netid, title: f.title.value.trim(), desc: f.desc.value.trim(),
      count: Math.min(20, Math.max(1, parseInt(f.count.value, 10) || 1)), work: state.work.slice(), commit: f.commit.value.trim(),
    };
    function reset(msg) {
      form.reset(); state.work = []; renderChips(); show($('post-error')); show($('post-done'), msg);
    }
    if (!ENDPOINT) {
      post.id = String(Date.now()); post.ts = Date.now();
      state.posts = [post].concat(state.posts);
      writeLocal(state.posts);
      render();
      return reset('Posted (preview mode). Once the Google backend is connected, this step emails ' + netid + '@cornell.edu a confirmation link instead.');
    }
    setBusy(true);
    post.action = 'create';
    call(post).then(function (r) {
      setBusy(false);
      if (!r.ok) return show($('post-error'), r.error || 'Something went wrong.');
      reset('Almost done. Check ' + netid + '@cornell.edu and click the confirmation link to publish your post.');
    }).catch(function () { setBusy(false); show($('post-error'), 'Couldn’t reach the server. Try again.'); });
  });

  function setBusy(b) {
    state.busy = b;
    $('post-submit').disabled = b;
    $('post-submit').textContent = b ? 'Posting…' : 'Post project';
  }

  // ---------- board ----------
  function render() {
    var n = state.posts.length;
    $('count').textContent = n === 1 ? '1 project' : n + ' projects';
    show($('board-status'), n ? '' : 'No projects posted yet. Be the first.');
    $('board-status').style.color = 'var(--color-neutral-700)';
    postsEl.replaceChildren.apply(postsEl, state.posts.map(card));
  }

  function card(p) {
    var count = Number(p.count) || 1;
    var date = new Date(p.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var kids = [
      h('div', { style: 'display: flex; justify-content: space-between; gap: 12px; font-size: 14px;' }, [
        h('span', { style: 'font-weight: 700;' }, [p.netid]),
        h('span', { style: 'color: var(--color-neutral-700);' }, [date]),
      ]),
      h('h3', { style: 'font-family: var(--font-heading); font-weight: var(--font-heading-weight); font-size: 22px; letter-spacing: -0.01em; margin: 0;' }, [p.title]),
      h('p', { style: 'font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-line;' }, [p.desc]),
      h('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px;' }, (p.work || []).map(function (w) { return h('span', { class: 'tag tag-outline' }, [w]); })),
      h('div', { style: 'display: grid; gap: 2px; font-size: 14px; padding-top: 12px; border-top: 1px solid var(--color-neutral-300);' }, [
        h('span', { style: 'font-weight: 700; color: var(--color-accent-700);' }, ['Looking for ' + count + (count === 1 ? ' person' : ' people')]),
        p.commit ? h('span', {}, [p.commit]) : null,
      ]),
    ];
    if (state.sent[p.id]) {
      kids.push(h('p', { role: 'status', style: 'margin: 0; font-size: 14px;' }, ['Sent. ' + p.netid + ' will get your message by email, and you’re copied.']));
    } else if (state.askId === p.id) {
      kids.push(askForm(p));
    } else {
      kids.push(h('div', { style: 'display: flex;' }, [
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: function () { state.askId = p.id; render(); focusAsk(); } }, ['I’m interested']),
      ]));
    }
    return h('article', { style: 'display: grid; gap: 12px; align-content: start; padding: 24px; border-right: 2px solid var(--color-divider); border-bottom: 2px solid var(--color-divider);' }, kids);
  }

  function focusAsk() { var el = postsEl.querySelector('form input[name="netid"]'); if (el) el.focus(); }

  function askForm(p) {
    var netidIn = h('input', { name: 'netid', placeholder: 'xyz789', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', style: INPUT });
    var msgIn = h('textarea', { name: 'message', rows: '3', maxlength: '1500', placeholder: 'What you’d like to work on and relevant experience', style: INPUT + ' resize: vertical; line-height: 1.5;' });
    var err = h('p', { role: 'alert', hidden: '', style: 'margin: 0; font-size: 14px; color: var(--color-accent-700);' });
    var send = h('button', { type: 'submit', class: 'btn btn-primary' }, ['Send']);
    var f = h('form', { novalidate: '', style: 'display: grid; gap: 12px; padding-top: 4px;' }, [
      h('label', { style: 'display: grid; gap: 6px;' }, [h('span', { style: 'font-size: 14px; font-weight: 700;' }, ['Your NetID']), netidIn]),
      h('label', { style: 'display: grid; gap: 6px;' }, [h('span', { style: 'font-size: 14px; font-weight: 700;' }, ['Message to ' + p.netid]), msgIn]),
      err,
      h('div', { style: 'display: flex; flex-wrap: wrap; gap: 8px;' }, [
        send,
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { state.askId = null; render(); } }, ['Cancel']),
      ]),
    ]);
    f.addEventListener('input', function () { show(err); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (send.disabled) return;
      var netid = netidIn.value.trim().toLowerCase(), message = msgIn.value.trim();
      if (!NETID.test(netid)) return show(err, 'Enter a valid NetID, like abc123.');
      if (!message) return show(err, 'Add a short message.');
      function done() { state.askId = null; state.sent[p.id] = true; render(); }
      if (!ENDPOINT) return done();
      send.disabled = true; send.textContent = 'Sending…';
      call({ action: 'interest', id: p.id, netid: netid, message: message }).then(function (r) {
        if (r.ok) return done();
        send.disabled = false; send.textContent = 'Send'; show(err, r.error || 'Something went wrong.');
      }).catch(function () { send.disabled = false; send.textContent = 'Send'; show(err, 'Couldn’t reach the server. Try again.'); });
    });
    return f;
  }

  renderChips();
  load();
})();
