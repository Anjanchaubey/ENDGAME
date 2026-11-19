import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { TodoistApi } from '@todoist/sdk';

const integrationRef = (store, uid) => store.doc(`users/${uid}/integrations/todoist`);
const tasksRef = (store, uid) => store.collection(`users/${uid}/tasks`);

function encryptionKey() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
  if (!serviceAccount.private_key) throw new Error('Firebase service account private key is unavailable');
  return createHash('sha256').update(serviceAccount.private_key).digest();
}

function encryptToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { tokenCiphertext: encrypted.toString('base64'), tokenIv: iv.toString('base64'), tokenTag: cipher.getAuthTag().toString('base64') };
}

function decryptToken(record) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(record.tokenIv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tokenTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.tokenCiphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function apiForUser(store, uid) {
  const snap = await integrationRef(store, uid).get();
  if (!snap.exists) throw new Error('Todoist is not connected');
  return new TodoistApi(decryptToken(snap.data()));
}

function priorityToTodoist(value) {
  return ({ Low: 1, Normal: 1, High: 3, Critical: 4 })[value] || 1;
}

function priorityFromTodoist(value) {
  return value >= 4 ? 'Critical' : value === 3 ? 'High' : value === 2 ? 'Normal' : 'Low';
}

function taskArgs(task, updating = false) {
  return {
    content: String(task.title || 'Untitled task'),
    description: String(task.description || ''),
    priority: priorityToTodoist(task.priority),
    ...(task.dueDate ? { dueString: task.dueDate } : updating ? { dueString: null } : {}),
  };
}

function listItems(page, key = 'results') {
  if (Array.isArray(page)) return page;
  return page?.[key] || page?.results || page?.items || [];
}

async function getAllPages(loadPage, key) {
  const result = [];
  let cursor;
  do {
    const page = await loadPage(cursor);
    result.push(...listItems(page, key));
    cursor = page?.nextCursor || page?.next_cursor || undefined;
  } while (cursor);
  return result;
}

function fieldsFromRemote(task, completed = false) {
  return {
    title: task.content || 'Untitled task',
    description: task.description || '',
    dueDate: task.due?.date || '',
    priority: priorityFromTodoist(task.priority),
    status: completed ? 'Completed' : 'Open',
    todoistTaskId: String(task.id),
    todoistUpdatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : (task.updatedAt || null),
  };
}

function matchesLocal(local, remote) {
  const localDue = local.dueDate || '';
  const remoteDue = remote.due?.date || '';
  return local.title === (remote.content || '') && localDue === remoteDue;
}

export async function connectTodoist(store, uid, token) {
  const api = new TodoistApi(token);
  await api.getTasks({ limit: 1 });
  await integrationRef(store, uid).set({ ...encryptToken(token), connectedAt: FieldValue.serverTimestamp() });
  return { connected: true };
}

export async function todoistStatus(store, uid) {
  const snap = await integrationRef(store, uid).get();
  return { connected: snap.exists };
}

export async function disconnectTodoist(store, uid) {
  await integrationRef(store, uid).delete();
  return { connected: false };
}

export async function pushTaskToTodoist(store, uid, taskId, reopen = false) {
  const ref = tasksRef(store, uid).doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('To-do not found');
  const task = snap.data();
  const api = await apiForUser(store, uid);
  let remote;
  if (task.todoistTaskId) {
    if (reopen && task.status !== 'Completed') await api.reopenTask(String(task.todoistTaskId));
    remote = await api.updateTask(String(task.todoistTaskId), taskArgs(task, true));
  } else {
    remote = await api.addTask(taskArgs(task));
  }
  if (task.status === 'Completed') await api.closeTask(String(remote.id));
  await ref.update({ todoistTaskId: String(remote.id), todoistUpdatedAt: remote.updatedAt instanceof Date ? remote.updatedAt.toISOString() : null });
  return { synced: true };
}

export async function deleteTodoistTask(store, uid, taskId) {
  const ref = tasksRef(store, uid).doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) return { deleted: true };
  const remoteId = snap.data().todoistTaskId;
  if (remoteId) await (await apiForUser(store, uid)).deleteTask(String(remoteId));
  return { deleted: true };
}

export async function syncTodoist(store, uid) {
  const api = await apiForUser(store, uid);
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  const until = now.toISOString();
  const [active, completed, localSnap] = await Promise.all([
    getAllPages(cursor => api.getTasks({ limit: 200, ...(cursor ? { cursor } : {}) })),
    getAllPages(cursor => api.getCompletedTasksByCompletionDate({ since, until, limit: 200, ...(cursor ? { cursor } : {}) }), 'items'),
    tasksRef(store, uid).get(),
  ]);
  const remoteTasks = [...active.map(task => ({ task, completed: false })), ...completed.map(task => ({ task, completed: true }))];
  const localDocs = localSnap.docs;
  const byTodoistId = new Map(localDocs.filter(d => d.data().todoistTaskId).map(d => [String(d.data().todoistTaskId), d]));
  const claimedLocalIds = new Set();
  let imported = 0, refreshed = 0, pushed = 0;

  for (const entry of remoteTasks) {
    const remote = entry.task;
    const remoteId = String(remote.id);
    let local = byTodoistId.get(remoteId);
    if (!local) {
      const candidates = localDocs.filter(d => !d.data().todoistTaskId && !claimedLocalIds.has(d.id) && matchesLocal(d.data(), remote));
      if (candidates.length === 1) local = candidates[0];
    }
    const fields = fieldsFromRemote(remote, entry.completed);
    if (local) {
      claimedLocalIds.add(local.id);
      const old = local.data();
      const changed = Object.entries(fields).some(([key, value]) => (old[key] ?? null) !== (value ?? null));
      if (changed) {
        await local.ref.update({ ...fields, ...(entry.completed ? { completedAt: old.completedAt || FieldValue.serverTimestamp() } : { completedAt: FieldValue.delete() }), updatedAt: FieldValue.serverTimestamp() });
        refreshed++;
      }
      if (!old.todoistTaskId) await local.ref.update({ todoistTaskId: remoteId });
    } else {
      const ref = tasksRef(store, uid).doc();
      await ref.set({ ...fields, category: 'Personal', source: 'Todoist', createdAt: FieldValue.serverTimestamp(), ...(entry.completed ? { completedAt: FieldValue.serverTimestamp() } : {}) });
      imported++;
    }
  }

  for (const local of localDocs) {
    const task = local.data();
    if (task.todoistTaskId || claimedLocalIds.has(local.id)) continue;
    const remote = await api.addTask(taskArgs(task));
    await local.ref.update({ todoistTaskId: String(remote.id), todoistUpdatedAt: remote.updatedAt instanceof Date ? remote.updatedAt.toISOString() : null });
    if (task.status === 'Completed') await api.closeTask(String(remote.id));
    pushed++;
  }

  return { connected: true, imported, refreshed, pushed, syncedAt: now.toISOString() };
}
