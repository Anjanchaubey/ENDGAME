// ENDGAME · Mission Progress · Scriptable
const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), 'endgame-mission-cache.json');
const base = Keychain.contains('ENDGAME_BASE_URL') ? Keychain.get('ENDGAME_BASE_URL') : await ask('ENDGAME_BASE_URL', 'Your Netlify site origin');
const key = Keychain.contains('ENDGAME_API_KEY') ? Keychain.get('ENDGAME_API_KEY') : await ask('ENDGAME_API_KEY', 'Read-only API key');
async function ask(k, label) { const a = new Alert(); a.title = 'ENDGAME setup'; a.message = label; a.addTextField('', ''); a.addAction('Save'); await a.present(); const v = a.textFieldValue(0).trim(); if (!v) throw new Error('Setup is required'); Keychain.set(k, v); return v; }
let data, offline = false;
try { const r = new Request(base.replace(/\/$/, '') + '/api/v1/mission'); r.headers = { Authorization: `Bearer ${key}` }; data = await r.loadJSON(); fm.writeString(cache, JSON.stringify(data)); }
catch { offline = true; data = JSON.parse(fm.readString(cache)); }
const w = new ListWidget(); w.backgroundColor = new Color('#111318'); w.setPadding(14, 16, 14, 16);
w.addText('ENDGAME  /  MISSION').font = Font.mediumSystemFont(9); w.addSpacer(9);
const pct = data.mission.progress; const title = w.addText(`${pct}%`); title.font = Font.boldSystemFont(32); title.textColor = new Color('#d2b363'); w.addSpacer(3);
w.addText(`${data.mission.completed_days} COMPLETE  ·  ${data.mission.remaining_days} DAYS LEFT`).font = Font.mediumSystemFont(9);
w.addSpacer(9); const bar = w.addText('YOUR MISSION. YOUR DISCIPLINE. YOUR LEGACY.'); bar.font = Font.systemFont(8); bar.textColor = new Color('#858b96');
w.addSpacer(); const foot = w.addText(`${offline ? 'OFFLINE CACHE' : 'LIVE DATA'}  ·  STREAK ${data.current_streak || 0}D  ·  RATING ${Number(data.average_rating || 0).toFixed(1)}`); foot.font = Font.mediumSystemFont(8); foot.textColor = new Color(offline ? '#c49a46' : '#858b96');
Script.setWidget(w); Script.complete();
