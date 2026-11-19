import { createHash, randomBytes } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'null',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
function response(statusCode, body) { return { statusCode, headers: corsHeaders, body: JSON.stringify(body) }; }
function db() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('Server configuration is incomplete');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getFirestore();
}
const hash = token => createHash('sha256').update(token).digest('hex');
async function rateLimit(store, id, limit = 60) {
  const ref = store.doc(`apiRateLimits/${hash(id).slice(0, 40)}`);
  const now = Date.now();
  return store.runTransaction(async tx => {
    const snap = await tx.get(ref), state = snap.exists ? snap.data() : {};
    const windowStart = state.windowStart?.toMillis?.() || 0;
    const count = windowStart < now - 60_000 ? 0 : (state.count || 0);
    if (count >= limit) return false;
    tx.set(ref, { count: count + 1, windowStart: windowStart < now - 60_000 ? Timestamp.fromMillis(now) : state.windowStart });
    return true;
  });
}
async function authenticate(req, store) {
  const token = (req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: response(401, { error: 'Authorization required' }) };
  // Key issuance/revocation uses a Firebase ID token; data endpoints use an ENDGAME API key.
  if (token.startsWith('eyJ')) {
    try { const decoded = await getAuth().verifyIdToken(token); return { uid: decoded.uid, mode: 'session' }; }
    catch { return { error: response(401, { error: 'Invalid session token' }) }; }
  }
  const digest = hash(token);
  const hit = await store.collectionGroup('apiKeys').where('hash', '==', digest).limit(1).get();
  if (hit.empty) return { error: response(401, { error: 'Invalid API key' }) };
  const keyDoc = hit.docs[0];
  if (keyDoc.data().revoked) return { error: response(401, { error: 'API key revoked' }) };
  const uid = keyDoc.ref.parent.parent.id;
  if (!(await rateLimit(store, `key:${keyDoc.id}`, 60))) return { error: response(429, { error: 'Rate limit exceeded' }) };
  await keyDoc.ref.update({ lastUsedAt: FieldValue.serverTimestamp() });
  return { uid, mode: 'api' };
}
const dayId = d => d.toISOString().slice(0, 10);
const zoneDay = (date, zone) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return `${parts.find(x => x.type === 'year').value}-${parts.find(x => x.type === 'month').value}-${parts.find(x => x.type === 'day').value}`;
};
const shiftDay = (day, amount) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return dayId(d); };
export const handler = async (event) => {
  const req = { method: event.httpMethod, path: event.path, headers: event.headers, body: event.body };
  const method = req.method;
  const requestPath = req.path || '';
  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  try {
    const store = db(), route = requestPath.replace(/^\/.netlify\/functions\/api\/?/, '').replace(/^api\/v1\/?/, '');
    if (method === 'POST' && route === 'keys') {
      const session = await authenticate(req, store); if (session.error) return session.error;
      if (session.mode !== 'session') return response(403, { error: 'A signed-in session is required' });
      const body = JSON.parse(req.body || '{}'), name = String(body.name || '').trim().slice(0, 64);
      if (!name) return response(400, { error: 'Key name is required' });
      if (!(await rateLimit(store, `issue:${session.uid}`, 5))) return response(429, { error: 'Key creation limit reached' });
      const raw = `eg_live_${randomBytes(32).toString('base64url')}`, ref = store.collection('users').doc(session.uid).collection('apiKeys').doc();
      await ref.set({ name, hash: hash(raw), createdAt: FieldValue.serverTimestamp(), lastUsedAt: null, revoked: false, permissions: ['read'] });
      return response(201, { id: ref.id, name, createdAt: new Date().toISOString(), key: raw, permissions: ['read'] });
    }
    const authn = await authenticate(req, store); if (authn.error) return authn.error;
    if (method === 'DELETE' && route.startsWith('keys/')) {
      if (authn.mode !== 'session') return response(403, { error: 'A signed-in session is required' });
      const id = route.slice(5); await store.doc(`users/${authn.uid}/apiKeys/${id}`).update({ revoked: true, revokedAt: FieldValue.serverTimestamp() });
      return response(200, { ok: true });
    }
    if (method === 'GET' && route === 'keys') {
      if (authn.mode !== 'session') return response(403, { error: 'A signed-in session is required' });
      const snap = await store.collection('users').doc(authn.uid).collection('apiKeys').orderBy('createdAt', 'desc').get();
      return response(200, { keys: snap.docs.map(d => { const x=d.data(); return { id:d.id,name:x.name,createdAt:x.createdAt?.toDate?.().toISOString(),lastUsedAt:x.lastUsedAt?.toDate?.().toISOString()||null,revoked:!!x.revoked,permissions:x.permissions }; }) });
    }
    if (method !== 'GET') return response(405, { error: 'Method not allowed' });
    if (authn.mode !== 'api') return response(403, { error: 'Use an API key for data endpoints' });
    const root = `users/${authn.uid}`, [daysSnap, tasksSnap, settingsSnap] = await Promise.all([
      store.collection(`${root}/days`).get(), store.collection(`${root}/tasks`).get(),
      store.doc(`${root}/settings/profile`).get(),
    ]);
    const days = Object.fromEntries(daysSnap.docs.map(d => [d.id, d.data()]));
    const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const now = new Date(), settings = settingsSnap.exists ? settingsSnap.data() : {}, zone = settings.timezone || 'UTC';
    const today = zoneDay(now, zone), duration = Number(settings.missionDuration) || 90, completeDays = Object.values(days).filter(d => d.status === 'Completed').length;
    const hours = Object.values(days).reduce((n,d) => n + (Number(d.studyHours)||0),0);
    const todayTasks = tasks.filter(t => t.status !== 'Completed' && (!t.dueDate || t.dueDate <= today));
    if (route === 'mission') {
      let streak = 0;
      for (let n = 0; n < duration && days[shiftDay(today, -n)]?.status === 'Completed'; n++) streak++;
      const ratings = Object.values(days).filter(d => Number(d.rating) > 0);
      const completedToday = tasks.filter(t => t.status === 'Completed' && t.completedAt?.toDate && zoneDay(t.completedAt.toDate(), zone) === today).length;
      return response(200, { mission: { total_days: duration, completed_days: completeDays, remaining_days: Math.max(0,duration-completeDays), progress: Math.round(completeDays/duration*10000)/100 }, today: { study_hours: days[today]?.studyHours||0, rating: days[today]?.rating||null, tasks_completed: completedToday, tasks_pending: todayTasks.length }, current_streak: streak, average_rating: ratings.length ? ratings.reduce((a,d)=>a+Number(d.rating),0)/ratings.length : 0 });
    }
    if (route === 'today') return response(200, { date: today, journal: days[today] || null, completed_count: tasks.filter(t => t.status === 'Completed' && t.completedAt?.toDate && zoneDay(t.completedAt.toDate(), zone) === today).length, tasks: todayTasks });
    if (route === 'tasks') return response(200, { tasks: tasks.filter(t=>t.status!=='Completed').sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')) });
    if (route === 'tasks/history') { const cutoff = new Date(now.getTime()-9*86400000), since = cutoff.getTime(); return response(200, { since: zoneDay(cutoff, zone), tasks: tasks.filter(t=>{ const created=t.createdAt?.toDate?.()?.getTime?.()||0, completed=t.completedAt?.toDate?.()?.getTime?.()||0; return created>=since||completed>=since; }) }); }
    if (route === 'analytics/weekly') { const result=[]; for(let i=6;i>=0;i--){const id=shiftDay(today,-i);result.push({date:id,study_hours:days[id]?.studyHours||0,rating:days[id]?.rating||null});} return response(200,{days:result,total_hours:result.reduce((n,x)=>n+x.study_hours,0)}); }
    return response(404, { error: 'Route not found' });
  } catch (error) {
    console.error('ENDGAME API error', error);
    return response(500, { error: 'Unable to process request' });
  }
};
