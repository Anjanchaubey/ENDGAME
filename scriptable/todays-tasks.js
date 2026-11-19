// ENDGAME · Today's Tasks · Scriptable
const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), 'endgame-tasks-cache.json');
const base = Keychain.contains('ENDGAME_BASE_URL') ? Keychain.get('ENDGAME_BASE_URL') : await ask('ENDGAME_BASE_URL', 'Your Netlify site origin');
const key = Keychain.contains('ENDGAME_API_KEY') ? Keychain.get('ENDGAME_API_KEY') : await ask('ENDGAME_API_KEY', 'Read-only API key');
async function ask(k, label) { const a = new Alert(); a.title = 'ENDGAME setup'; a.message = label; a.addTextField('', ''); a.addAction('Save'); await a.present(); const v = a.textFieldValue(0).trim(); if (!v) throw new Error('Setup is required'); Keychain.set(k, v); return v; }
let data, offline = false;
try { const r = new Request(base.replace(/\/$/, '') + '/api/v1/today'); r.headers = { Authorization: `Bearer ${key}` }; data = await r.loadJSON(); fm.writeString(cache, JSON.stringify(data)); }
catch { offline = true; data = JSON.parse(fm.readString(cache)); }
const w = new ListWidget(); w.backgroundColor = new Color('#111318'); w.setPadding(13, 15, 13, 15);
w.addText(`ENDGAME  /  TODAY${offline ? '  ·  OFFLINE' : ''}`).font = Font.mediumSystemFont(9); w.addSpacer(8);
const items = data.tasks || [], done = (data.completed_count || 0), pending = items.length;
const count = w.addText(`${done} DONE  /  ${pending} OPEN`); count.font = Font.boldSystemFont(18); count.textColor = new Color('#d2b363'); w.addSpacer(5);
if (!items.length) w.addText('No open tasks. Your queue is clear.').font = Font.systemFont(10);
for (const t of items.slice(0, config.widgetFamily === 'small' ? 2 : config.widgetFamily === 'large' ? 7 : 4)) { const row = w.addText(`◦ ${t.title}${t.dueDate ? '  ·  ' + t.dueDate : ''}`); row.font = Font.systemFont(10); row.textColor = new Color('#d5d5d0'); row.lineLimit = 1; w.addSpacer(4); }
w.addSpacer(); const foot = w.addText(`${offline ? 'CACHED' : 'UPDATED'}  ·  ENDGAME`); foot.font = Font.mediumSystemFont(8); foot.textColor = new Color('#858b96');
Script.setWidget(w); Script.complete();
