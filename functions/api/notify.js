// POST /api/notify  { id, kind?: 'message' | 'item' }
// Looks the message or list item up in Firestore (so nobody can push made-up text),
// then notifies everyone except whoever sent or added it.
// Needs the secret ONESIGNAL_REST_API_KEY in Cloudflare Pages settings.
import { json, getDoc, push, WORDS } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  const { id, kind = 'message' } = body || {};
  if (typeof id !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(id)) return json({ error: 'bad id' }, 400);

  const doc = await getDoc(kind === 'item' ? `together/${id}` : `kisses/${id}`);
  if (!doc) return json({ error: 'not found' }, 404);
  if (!doc.time || Math.abs(Date.now() - doc.time) > 5 * 60 * 1000) return json({ error: 'too old' }, 409);

  const url = new URL('/', request.url).toString();
  let msg;
  if (kind === 'item') {
    const by = String(doc.by || '').slice(0, 20);
    msg = { sender: by, heading: `${by || 'Someone'} added to the couch agenda`, content: String(doc.text || '').slice(0, 140), url };
  } else {
    const sender = String(doc.fromName || '').slice(0, 20);
    const what = WORDS[doc.type] || 'something';
    msg = { sender, heading: sender ? `${sender} sent you ${what}` : `You got ${what}`, content: 'Open it to see. You owe one back.', url };
  }
  const out = await push(env, msg);
  return json(out, out.ok ? 200 : (out.error ? 500 : 502));
}

export const onRequest = () => json({ error: 'POST only' }, 405);
