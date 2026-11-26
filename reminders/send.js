// Runs on GitHub Actions every few minutes. Sends push reminders for tasks that are due.
// Logs only counts (this repo is public, so logs are public): never log titles, ids or tokens.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const AHEAD = 2, GRACE = 90; // minutes: send up to 4 min early, catch up to 90 min late
const pad = n => String(n).padStart(2, '0');
const dow = d => new Date(d + 'T00:00:00Z').getUTCDay();
const t12 = t => { const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM'); };

function local(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
const U = d => new Date(d + 'T00:00:00Z');
const mdays = d => { const x = U(d); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); };
// Keep in sync with occurs() in index.html.
function occurs(t, d) {
  if (d < t.date) return false;
  if (t.repeat !== 'never' && t.until && d > t.until) return false; // repeat end date
  if (Array.isArray(t.skip) && t.skip.includes(d)) return false;    // skipped occurrences
  const a = U(t.date), b = U(d);
  switch (t.repeat) {
    case 'daily': return true;
    case 'weekdays': return dow(d) > 0 && dow(d) < 6;
    case 'weekly': return dow(d) === dow(t.date);
    case 'biweekly': return Math.round((b - a) / 864e5) % 14 === 0;
    case 'monthly': return b.getUTCDate() === Math.min(a.getUTCDate(), mdays(d));
    case 'yearly': return b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() === Math.min(a.getUTCDate(), mdays(d));
    case 'custom': return (t.days || []).includes(dow(d));
    default: return d === t.date;
  }
}

(async () => {
  let users = 0, sent = 0;
  const snap = await db.collection('users').get();
  for (const u of snap.docs) {
    const data = u.data();
    let s; try { s = JSON.parse(data.json); } catch (e) { continue; }
    let now; try { now = local(data.tz || 'UTC'); } catch (e) { now = local('UTC'); }
    const cutoff = new Date(Date.parse(now.date + 'T00:00:00Z') - 3 * 864e5).toISOString().slice(0, 10);
    const next = {};
    for (const [k, v] of Object.entries(data.sent || {})) if ((k.split('_')[1] || '') >= cutoff) next[k] = v;

        const due = [];
    const shift = n => new Date(Date.parse(now.date + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    for (const t of s.tasks || []) {
      if (!t.time || !/^\d\d:\d\d$/.test(t.time)) continue;
      const [h, m] = t.time.split(':').map(Number);
      for (const off of [-1, 0, 1]) { // yesterday, today, tomorrow: handles midnight crossings
        const d = shift(off);
        if (!occurs(t, d) || (t.done && t.done[d])) continue;
        // Keep in sync with remindAt() in index.html. before = remind N minutes early,
        // snz[d] = snoozed reminder minute (counted from that day's midnight).
        const before = [5, 15, 30, 60].includes(+t.before) ? +t.before : 0;
        const sz = t.snz && Number.isFinite(t.snz[d]) ? t.snz[d] : null;
        const at = off * 1440 + (sz != null ? sz : h * 60 + m - before);
        const key = sz != null ? `${t.id}_${d}_s${sz}` : before ? `${t.id}_${d}_${t.time}_b${before}` : `${t.id}_${d}_${t.time}`;
        if (next[key]) continue;
        const diff = now.min - at;
        if (diff >= -AHEAD && diff <= GRACE) due.push([t, key, d, sz != null, before, off]);
      }
    }
    // Each message: [key, data]. Task reminders first, then the optional evening preview.
    const msgs = due.map(([t, key, d, snoozed, before, off]) => {
      const when = snoozed ? ' (snoozed)' : before ? ` (in ${before >= 60 ? before / 60 + ' hour' : before + ' min'})` : '';
      return [key, { title: '⏰ Task Tracker', body: `${t.prio === 'high' ? '❗ ' : ''}${t.title} at ${t12(t.time)}${off > 0 ? ' tomorrow' : ''}${when}${t.note ? '\n📝 ' + t.note : ''}`, tag: key, id: String(t.id), d }];
    });
    // Evening preview at 8 PM local: tomorrow's open tasks (setting "eve" in the app).
    const EVE = 20 * 60, ekey = `eve_${now.date}`;
    if (s.eve && !next[ekey] && now.min - EVE >= -AHEAD && now.min - EVE <= GRACE) {
      const tm = shift(1), list = (s.tasks || []).filter(t => occurs(t, tm) && !(t.done && t.done[tm]))
        .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      if (list.length) {
        const first = list.find(t => t.time && /^\d\d:\d\d$/.test(t.time));
        const lines = list.slice(0, 4).map(t => '• ' + (t.time && /^\d\d:\d\d$/.test(t.time) ? t12(t.time) + ' ' : '') + t.title);
        msgs.push([ekey, { title: `🌙 Tomorrow: ${list.length} task${list.length > 1 ? 's' : ''}`, body: (first ? `First up: ${first.title} at ${t12(first.time)}\n` : '') + lines.join('\n') + (list.length > 4 ? `\n+${list.length - 4} more` : ''), tag: ekey }]);
      } else next[ekey] = 1;
    }
    if (!msgs.length) { if (next[ekey] && !(data.sent || {})[ekey]) await u.ref.update({ sent: next }); continue; }

    const dev = await u.ref.collection('devices').get();
    let tokens = dev.docs.map(d => d.get('token')).filter(Boolean);
    if (!tokens.length) continue;
    users++;
    const bad = new Set();
    for (const [key, payload] of msgs) {
      if (!tokens.length) break;
      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        data: payload,
        webpush: { headers: { Urgency: 'high', TTL: '3600' } },
      });
      res.responses.forEach((r, i) => {
        if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error && r.error.code)) bad.add(tokens[i]);
      });
      if (res.successCount > 0) { next[key] = 1; sent++; }
    }
    await u.ref.update({ sent: next });
    for (const d of dev.docs) if (bad.has(d.get('token'))) await d.ref.delete();
  }
  console.log(`Done. Users with due tasks: ${users}. Reminders sent: ${sent}.`);
})().catch(e => { console.error('Reminder run failed:', e.code || e.message); process.exit(1); });
