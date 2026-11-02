/**
 * Cornell Maker Club — training sign-up confirmations (Google Apps Script add-on)
 *
 * Add this file to the Apps Script project behind the training sign-up
 * (the one whose web app URL is in the Join page's data-endpoint), then call
 * sendTrainingConfirmation_() from your sign-up handler right after a sign-up is saved.
 *
 * Emails and invites are sent from whichever Google account DEPLOYS the script
 * ("Execute as: Me"). To send them from cornellmakerclub@gmail.com, own and deploy
 * the script from that account.
 *
 * What it sends:
 *  1. A Google Calendar invite: the person is added as a guest on the session's event
 *     on the club calendar (one event per session; guests can't see each other).
 *     Needs the advanced "Google Calendar API" service: Editor → Services (+) → Google Calendar API.
 *  2. A confirmation email with the session details, an "Add to Google Calendar" link
 *     and an .ics file, so it also works for people who don't use Google Calendar.
 *
 * Example, inside your sign-up handler after the row is written:
 *
 *   sendTrainingConfirmation_({
 *     name: 'Ezra Cornell',
 *     netid: 'ec1865',
 *     training: 'General lab training',          // or '3D printer', 'Laser cutter'
 *     start: new Date(session.start),            // a Date
 *     end: new Date(session.end),                // a Date
 *     location: '209 Phillips Hall',
 *     trainer: 'Parth Mittal',                   // optional
 *   });
 *
 * It never throws: if the invite or email fails, the error is logged and the
 * sign-up itself still succeeds.
 */

const CONFIRM = {
  CALENDAR_ID: 'ue21k89joh51i1u36r9ncgprpo@group.calendar.google.com', // the Training calendar (not the workshop calendar)
  SEND_INVITE: true,                         // add the person as a guest and email a Google Calendar invite
  SEND_EMAIL: true,                          // also send a confirmation email with an .ics file
  CLUB_NAME: 'Cornell Maker Club',
  REPLY_TO: 'cornellmakerclub@gmail.com',
  SITE_URL: 'https://YOUR-GITHUB-NAME.github.io/YOUR-REPO/join/#training',
  TIME_ZONE: 'America/New_York',
};

function sendTrainingConfirmation_(s) {
  const email = String(s.netid || '').trim().toLowerCase() + '@cornell.edu';
  const title = CONFIRM.CLUB_NAME + ': ' + s.training;
  const result = { invite: false, email: false };

  if (CONFIRM.SEND_INVITE) {
    try { inviteToSession_(title, s, email); result.invite = true; }
    catch (err) { console.error('Calendar invite failed for ' + email + ': ' + err); }
  }
  if (CONFIRM.SEND_EMAIL) {
    try { emailConfirmation_(title, s, email); result.email = true; }
    catch (err) { console.error('Confirmation email failed for ' + email + ': ' + err); }
  }
  return result;
}

/** Adds the guest to the session's event (creating the event the first time) and emails the invite. */
function inviteToSession_(title, s, email) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = Calendar.Events.list(CONFIRM.CALENDAR_ID, {
      timeMin: s.start.toISOString(),
      timeMax: s.end.toISOString(),
      singleEvents: true,
      q: s.training,
    }).items || [];
    const event = existing.filter(e => e.summary === title && new Date(e.start.dateTime).getTime() === s.start.getTime())[0];

    if (!event) {
      Calendar.Events.insert({
        summary: title,
        location: s.location || '',
        description: details_(s),
        start: { dateTime: s.start.toISOString(), timeZone: CONFIRM.TIME_ZONE },
        end: { dateTime: s.end.toISOString(), timeZone: CONFIRM.TIME_ZONE },
        attendees: [{ email: email, displayName: s.name || '' }],
        guestsCanSeeOtherGuests: false,
        guestsCanInviteOthers: false,
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
      }, CONFIRM.CALENDAR_ID, { sendUpdates: 'all' });
      return;
    }

    const attendees = event.attendees || [];
    if (attendees.some(a => String(a.email).toLowerCase() === email)) return; // already invited
    attendees.push({ email: email, displayName: s.name || '' });
    Calendar.Events.patch({ attendees: attendees, guestsCanSeeOtherGuests: false }, CONFIRM.CALENDAR_ID, event.id, { sendUpdates: 'all' });
  } finally {
    lock.releaseLock();
  }
}

/** Plain confirmation email with an Add to Google Calendar link and an .ics attachment. */
function emailConfirmation_(title, s, email) {
  const when = Utilities.formatDate(s.start, CONFIRM.TIME_ZONE, "EEEE, MMMM d 'at' h:mm a") +
    '–' + Utilities.formatDate(s.end, CONFIRM.TIME_ZONE, 'h:mm a');
  const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(title) +
    '&dates=' + utc_(s.start) + '/' + utc_(s.end) +
    '&location=' + encodeURIComponent(s.location || '') +
    '&details=' + encodeURIComponent(details_(s));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#201e1d;max-width:560px">' +
    '<p>Hi ' + esc(s.name || s.netid) + ',</p>' +
    '<p>You’re signed up for <b>' + esc(s.training) + '</b>.</p>' +
    '<table style="border-collapse:collapse;margin:8px 0 16px">' +
    '<tr><td style="padding:4px 16px 4px 0;color:#605d5d">When</td><td style="padding:4px 0"><b>' + esc(when) + '</b></td></tr>' +
    (s.location ? '<tr><td style="padding:4px 16px 4px 0;color:#605d5d">Where</td><td style="padding:4px 0">' + esc(s.location) + '</td></tr>' : '') +
    (s.trainer ? '<tr><td style="padding:4px 16px 4px 0;color:#605d5d">Trainer</td><td style="padding:4px 0">' + esc(s.trainer) + '</td></tr>' : '') +
    '</table>' +
    '<p><a href="' + gcal + '" style="background:#ec3013;color:#f3f2f2;padding:8px 14px;text-decoration:none;font-weight:bold">Add to Google Calendar</a></p>' +
    '<p>Wear closed-toe shoes, and read the lab safety rules before you come.</p>' +
    '<p>If you can no longer make it, reply to this email so someone else can take your spot.</p>' +
    '<p style="color:#605d5d;font-size:13px">' + esc(CONFIRM.CLUB_NAME) + ' · <a href="' + CONFIRM.SITE_URL + '" style="color:#ae1800">Trainings</a></p>' +
    '</div>';

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cornell Maker Club//Trainings//EN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + Utilities.getUuid() + '@cornellmakerclub',
    'DTSTAMP:' + utc_(new Date()),
    'DTSTART:' + utc_(s.start),
    'DTEND:' + utc_(s.end),
    'SUMMARY:' + icsText_(title),
    'LOCATION:' + icsText_(s.location || ''),
    'DESCRIPTION:' + icsText_(details_(s)),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');

  MailApp.sendEmail({
    to: email,
    replyTo: CONFIRM.REPLY_TO,
    name: CONFIRM.CLUB_NAME,
    subject: 'You’re signed up: ' + s.training + ' on ' + Utilities.formatDate(s.start, CONFIRM.TIME_ZONE, 'MMM d'),
    htmlBody: html,
    attachments: [Utilities.newBlob(ics, 'text/calendar', 'training.ics')],
  });
}

function details_(s) {
  return s.training + (s.trainer ? ' with ' + s.trainer : '') +
    '. Wear closed-toe shoes. If you can no longer make it, let the trainer know so someone else can take your spot.';
}
function utc_(d) { return Utilities.formatDate(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'"); }
function icsText_(t) { return String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }

/** Run once from the editor to check everything works: sends a test invite and email to the NetID you enter. */
function testTrainingConfirmation() {
  const start = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  start.setMinutes(0, 0, 0);
  console.log(sendTrainingConfirmation_({
    name: 'Test', netid: 'YOUR-NETID', training: 'Test training (delete me)',
    start: start, end: new Date(start.getTime() + 3600 * 1000), location: '209 Phillips Hall',
  }));
}
