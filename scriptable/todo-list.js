// ENDGAME · To-do list · Scriptable
const fm = FileManager.local();
const cache = fm.joinPath(fm.documentsDirectory(), 'endgame-todo-cache.json');
const base = Keychain.contains('ENDGAME_BASE_URL') ? Keychain.get('ENDGAME_BASE_URL') : await ask('ENDGAME_BASE_URL', 'Your Netlify site origin');
const key = Keychain.contains('ENDGAME_API_KEY') ? Keychain.get('ENDGAME_API_KEY') : await ask('ENDGAME_API_KEY', 'Read-only API key');

async function ask(name, label) {
  const alert = new Alert();
  alert.title = 'ENDGAME setup';
  alert.message = label;
  alert.addTextField('', '');
  alert.addAction('Save');
  await alert.present();
  const value = alert.textFieldValue(0).trim();
  if (!value) throw new Error('Setup is required');
  Keychain.set(name, value);
  return value;
}

let data;
let offline = false;
try {
  const request = new Request(base.replace(/\/$/, '') + '/api/v1/tasks');
  request.headers = { Authorization: `Bearer ${key}` };
  data = await request.loadJSON();
  fm.writeString(cache, JSON.stringify(data));
} catch {
  offline = true;
  data = fm.fileExists(cache) ? JSON.parse(fm.readString(cache)) : { tasks: [] };
}

const tasks = data.tasks || [];
const widget = new ListWidget();
widget.backgroundColor = new Color('#17191f');
widget.setPadding(14, 16, 14, 16);
widget.url = base.replace(/\/$/, '');
const title = widget.addText('To-do');
title.font = Font.semiboldSystemFont(12);
title.textColor = new Color('#f2f1ed');
widget.addSpacer(6);
const count = widget.addText(`${tasks.length} open`);
count.font = Font.boldSystemFont(config.widgetFamily === 'small' ? 22 : 25);
count.textColor = new Color('#d2b363');
widget.addSpacer(8);

const maxItems = config.widgetFamily === 'small' ? 2 : config.widgetFamily === 'large' ? 8 : 5;
if (!tasks.length) {
  const empty = widget.addText(offline ? 'No saved list yet.' : 'You’re all caught up.');
  empty.font = Font.systemFont(11);
  empty.textColor = new Color('#a5a8af');
} else {
  for (const task of tasks.slice(0, maxItems)) {
    const row = widget.addStack();
    row.centerAlignContent();
    const check = row.addText('○');
    check.font = Font.systemFont(12);
    check.textColor = new Color('#c49a46');
    row.addSpacer(7);
    const text = row.addText(task.title);
    text.font = Font.systemFont(11);
    text.textColor = new Color('#e5e4df');
    text.lineLimit = 1;
    row.addSpacer();
    if (task.dueDate) {
      const due = row.addText(task.dueDate.slice(5));
      due.font = Font.systemFont(8);
      due.textColor = new Color('#a5a8af');
    }
    widget.addSpacer(7);
  }
}

widget.addSpacer();
const footer = widget.addText(offline ? 'OFFLINE · SAVED LIST' : 'ENDGAME · TO-DO');
footer.font = Font.mediumSystemFont(8);
footer.textColor = new Color(offline ? '#d2b363' : '#858b96');
Script.setWidget(widget);
Script.complete();
