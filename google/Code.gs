/**
 * Cornell Maker Club — Team Finder backend (Google Apps Script)
 * Paste into Extensions → Apps Script of a new Google Sheet. See README.md (Team Finder setup).
 * The GitHub site calls this as a web app: GET ?action=list, POST {action:'create'|'interest'}.
 */

const ADMIN_EMAIL = 'your-club-account@cornell.edu'; // who gets notified of new posts
const SITE_URL = 'https://YOUR-GITHUB-NAME.github.io/YOUR-REPO/team-finder/'; // the Team Finder page on your GitHub site
const REQUIRE_APPROVAL = false; // true = confirmed posts wait for you to set status to "open"
const MAX_ACTIVE_PER_NETID = 3;

const SHEET = 'Posts';
const HEAD = ['id', 'created', 'netid', 'title', 'description', 'count', 'work', 'commitment', 'status', 'token'];
const COL = { id: 1, status: 9, token: 10 };
const NETID = /^[a-z]{2,4}[0-9]{1,5}$/;

/** Run once from the editor to create the sheets. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange('I2:I').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['unverified', 'pending', 'open', 'removed']).build()
  );
  sh.hideColumns(COL.token);
  const log = ss.getSheetByName('Interest') || ss.insertSheet('Interest');
  log.getRange(1, 1, 1, 4).setValues([['time', 'postId', 'fromNetid', 'message']]).setFontWeight('bold');
  log.setFrozenRows(1);
}

// ---------- HTTP ----------

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'list') return json_({ ok: true, posts: listOpen_() });
  if (p.action === 'confirm' || p.action === 'remove') return tokenAction_(p);
  // No action: the page itself lives on the GitHub site, so send visitors there.
  return page_('Team Finder', 'The Team Finder is on the Cornell Maker Club website.');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (body.action === 'create') return json_(create_(body));
    if (body.action === 'interest') return json_(interest_(body));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong. Try again.' });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Actions ----------

function create_(b) {
  const netid = clean_(b.netid, 12).toLowerCase();
  const title = clean_(b.title, 120);
  const desc = clean_(b.desc, 1500);
  const work = (Array.isArray(b.work) ? b.work : []).map(w => clean_(w, 40)).filter(Boolean).slice(0, 8);
  const count = Math.min(20, Math.max(1, parseInt(b.count, 10) || 1));
  const commit = clean_(b.commit, 160);

  if (!NETID.test(netid)) return { ok: false, error: 'Enter a valid NetID, like abc123.' };
  if (!title || !desc || !work.length) return { ok: false, error: 'Fill in the project name, description and kind of work.' };

  const active = rows_().filter(r => r.netid === netid && (r.status === 'open' || r.status === 'unverified' || r.status === 'pending'));
  if (active.length >= MAX_ACTIVE_PER_NETID) return { ok: false, error: 'You already have ' + active.length + ' active posts. Remove one first.' };

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const token = Utilities.getUuid();
  sheet_().appendRow([id, new Date(), netid, title, desc, count, work.join(', '), commit, 'unverified', token]);

  MailApp.sendEmail({
    to: netid + '@cornell.edu',
    subject: 'Confirm your Team Finder post: ' + title,
    htmlBody:
      '<p>Hi ' + netid + ',</p>' +
      '<p>Someone (hopefully you) posted <b>' + title + '</b> to the Cornell Maker Club Team Finder.</p>' +
      '<p><a href="' + url_('confirm', id, token) + '">Confirm and publish this post</a></p>' +
      '<p>Keep this email. You can remove the post at any time with this link:<br>' +
      '<a href="' + url_('remove', id, token) + '">Remove my post</a></p>' +
      '<p>If you didn’t make this post, ignore this email and it will never be published.</p>',
    name: 'Cornell Maker Club',
  });
  return { ok: true };
}

function interest_(b) {
  const from = clean_(b.netid, 12).toLowerCase();
  const message = clean_(b.message, 1500);
  if (!NETID.test(from)) return { ok: false, error: 'Enter a valid NetID, like abc123.' };
  if (!message) return { ok: false, error: 'Add a short message.' };

  const f = find_(b.id);
  if (!f || f.r.status !== 'open') return { ok: false, error: 'This project is no longer listed.' };
  if (f.r.netid === from) return { ok: false, error: 'That’s your own post.' };

  MailApp.sendEmail({
    to: f.r.netid + '@cornell.edu',
    cc: from + '@cornell.edu',
    replyTo: from + '@cornell.edu',
    subject: 'Team Finder: ' + from + ' is interested in ' + f.r.title,
    htmlBody:
      '<p><b>' + from + '</b> wants to help with <b>' + f.r.title + '</b>:</p>' +
      '<blockquote style="border-left:3px solid #ccc;margin:0;padding-left:12px">' + message.replace(/\n/g, '<br>') + '</blockquote>' +
      '<p>Reply to this email to reach them directly.</p>' +
      '<p style="color:#777;font-size:12px">Sent via the Cornell Maker Club Team Finder. ' + from + ' is copied on this email.</p>',
    name: 'Cornell Maker Club',
  });
  SpreadsheetApp.getActive().getSheetByName('Interest').appendRow([new Date(), f.r.id, from, message]);
  return { ok: true };
}

function tokenAction_(p) {
  const f = find_(p.id);
  if (!f || !p.token || f.r.token !== p.token) return page_('Link not valid', 'This link is incorrect or the post no longer exists.');

  if (p.action === 'remove') {
    setStatus_(f.row, 'removed');
    return page_('Post removed', '“' + f.r.title + '” is no longer listed.');
  }
  if (f.r.status !== 'unverified') return page_('Already confirmed', '“' + f.r.title + '” was already confirmed.');

  const next = REQUIRE_APPROVAL ? 'pending' : 'open';
  setStatus_(f.row, next);
  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: (REQUIRE_APPROVAL ? 'Team Finder post awaiting approval: ' : 'New Team Finder post: ') + f.r.title,
    htmlBody:
      '<p><b>' + f.r.netid + '</b> posted <b>' + f.r.title + '</b> (' + f.r.count + ' needed, ' + f.r.work + ').</p>' +
      '<p>' + f.r.description + '</p>' +
      '<p><a href="' + SpreadsheetApp.getActive().getUrl() + '">Open the sheet</a>' +
      (REQUIRE_APPROVAL ? ' and set status to “open” to publish it.' : ' · <a href="' + url_('remove', f.r.id, f.r.token) + '">Remove this post</a>') + '</p>',
    name: 'Team Finder',
  });
  return page_(
    REQUIRE_APPROVAL ? 'Confirmed' : 'Your project is live',
    REQUIRE_APPROVAL ? 'Thanks. An officer will review “' + f.r.title + '” shortly.' : '“' + f.r.title + '” is now on the Team Finder board.'
  );
}

// ---------- Helpers ----------

function sheet_() { return SpreadsheetApp.getActive().getSheetByName(SHEET); }

function rows_() {
  const v = sheet_().getDataRange().getValues();
  v.shift();
  return v.map(r => ({
    id: String(r[0]), created: r[1], netid: String(r[2]), title: r[3], description: r[4],
    count: r[5], work: r[6], commitment: r[7], status: r[8], token: r[9],
  }));
}

function find_(id) {
  const all = rows_();
  for (let i = 0; i < all.length; i++) if (all[i].id === String(id)) return { row: i + 2, r: all[i] };
  return null;
}

function listOpen_() {
  return rows_()
    .filter(r => r.status === 'open')
    .sort((a, b) => new Date(b.created) - new Date(a.created))
    .map(r => ({
      id: r.id, ts: new Date(r.created).getTime(), netid: r.netid, title: r.title, desc: r.description,
      count: Number(r.count) || 1, work: String(r.work).split(',').map(s => s.trim()).filter(Boolean), commit: r.commitment,
    }));
}

function setStatus_(row, status) { sheet_().getRange(row, COL.status).setValue(status); }
function clean_(s, max) { return String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, max); }
function url_(action, id, token) { return ScriptApp.getService().getUrl() + '?action=' + action + '&id=' + encodeURIComponent(id) + '&token=' + token; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function page_(title, msg) {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:64px auto;padding:0 20px;color:#201e1d">' +
    '<h1 style="font-size:28px;margin:0 0 12px">' + title + '</h1>' +
    '<p style="font-size:16px;line-height:1.6">' + msg + '</p>' +
    '<p><a href="' + SITE_URL + '" style="color:#b3200e">Back to Team Finder</a></p></div>'
  ).setTitle(title);
}
