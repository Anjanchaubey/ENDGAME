// ENDGAME · Study Statistics · Scriptable
const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), 'endgame-weekly-cache.json');
const base = Keychain.contains('ENDGAME_BASE_URL') ? Keychain.get('ENDGAME_BASE_URL') : await ask('ENDGAME_BASE_URL', 'Your Netlify site origin');
const key = Keychain.contains('ENDGAME_API_KEY') ? Keychain.get('ENDGAME_API_KEY') : await ask('ENDGAME_API_KEY', 'Read-only API key');
async function ask(k, label) { const a = new Alert(); a.title = 'ENDGAME setup'; a.message = label; a.addTextField('', ''); a.addAction('Save'); await a.present(); const v = a.textFieldValue(0).trim(); if (!v) throw new Error('Setup is required'); Keychain.set(k, v); return v; }
let data, offline = false;
try { const r = new Request(base.replace(/\/$/, '') + '/api/v1/analytics/weekly'); r.headers = { Authorization: `Bearer ${key}` }; data = await r.loadJSON(); fm.writeString(cache, JSON.stringify(data)); }
catch { offline = true; data = JSON.parse(fm.readString(cache)); }
const w = new ListWidget(); w.backgroundColor = new Color('#111318'); w.setPadding(13, 15, 13, 15);
w.addText(`ENDGAME  /  STUDY${offline ? '  ·  OFFLINE' : ''}`).font = Font.mediumSystemFont(9); w.addSpacer(6);
const h = w.addText(`${(data.total_hours || 0).toFixed(1)}h`); h.font = Font.boldSystemFont(25); h.textColor = new Color('#d2b363');
w.addText('STUDY HOURS · LAST 7 DAYS').font = Font.mediumSystemFont(8); w.addSpacer(9);
const max = Math.max(1, ...data.days.map(x => x.study_hours)); const row = w.addStack(); row.centerAlignContent();
for (const d of data.days) { const col = row.addStack(); col.layoutVertically(); col.centerAlignContent(); const n = col.addText(d.study_hours ? `${d.study_hours}h` : '·'); n.font = Font.systemFont(7); n.textColor = new Color('#858b96'); col.addSpacer(3); const bar = col.addText('━'.repeat(Math.max(1, Math.round(d.study_hours / max * 4)))); bar.font = Font.systemFont(8); bar.textColor = new Color('#c49a46'); col.addSpacer(3); const day = col.addText(d.date.slice(5)); day.font = Font.systemFont(6); day.textColor = new Color('#858b96'); if (d !== data.days[data.days.length - 1]) row.addSpacer(); }
w.addSpacer(); const avg = data.days.filter(x => x.rating).reduce((n,x,a,all) => n + x.rating / all.length, 0); const foot = w.addText(`AVG RATING ${avg.toFixed(1)} / 10  ·  ${offline ? 'CACHED' : 'LIVE'}`); foot.font = Font.mediumSystemFont(8); foot.textColor = new Color('#858b96');
Script.setWidget(w); Script.complete();
