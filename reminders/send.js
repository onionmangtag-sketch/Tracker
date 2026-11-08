// Runs on GitHub Actions every few minutes. Sends push reminders for tasks that are due.
// Logs only counts (this repo is public, so logs are public): never log titles, ids or tokens.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const AHEAD = 1, GRACE = 90; // minutes: send up to 4 min early, catch up to 90 min late
const pad = n => String(n).padStart(2, '0');
const dow = d => new Date(d + 'T00:00:00Z').getUTCDay();
const t12 = t => { const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM'); };

function local(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
function occurs(t, d) {
  if (d < t.date) return false;
  switch (t.repeat) {
    case 'daily': return true;
    case 'weekdays': return dow(d) > 0 && dow(d) < 6;
    case 'weekly': return dow(d) === dow(t.date);
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
    for (const t of s.tasks || []) {
      if (!t.time || !/^\d\d:\d\d$/.test(t.time) || !occurs(t, now.date)) continue;
      if (t.done && t.done[now.date]) continue;
      const key = `${t.id}_${now.date}_${t.time}`;
      if (next[key]) continue;
      const [h, m] = t.time.split(':').map(Number);
      const diff = now.min - (h * 60 + m);
      if (diff >= -AHEAD && diff <= GRACE) due.push([t, key]);
    }
    if (!due.length) continue;

    const dev = await u.ref.collection('devices').get();
    let tokens = dev.docs.map(d => d.get('token')).filter(Boolean);
    if (!tokens.length) continue;
    users++;
    const bad = new Set();
    for (const [t, key] of due) {
      if (!tokens.length) break;
      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        data: { title: '⏰ Task Tracker', body: `${t.prio === 'high' ? '❗ ' : ''}${t.title} at ${t12(t.time)}`, tag: key },
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
