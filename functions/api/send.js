// POST /api/send  { type: 'kiss' | 'hug', from: 'Papoi Biftekoulis' }
// Lets a home-screen widget send without opening the app: saves the message,
// adds it to the debt tab and notifies the other phone.
import { json, getDoc, createDoc, bumpLedger, push, WORDS } from '../_lib.js';

const COLORS = { kiss: '#e04a2a', hug: '#2e7fa4' };

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  const type = body?.type;
  const from = String(body?.from || '').trim().slice(0, 20);
  if (!COLORS[type]) return json({ error: 'type must be kiss or hug' }, 400);

  // only names already on the tab can send this way
  const ledger = await getDoc('kisses/_ledger');
  if (!from || !ledger?.sent || !(from in ledger.sent)) return json({ error: 'unknown name' }, 403);

  try {
    const id = await createDoc('kisses', {
      type, color: COLORS[type], location: null, mediaUrl: null,
      from: 'widget-' + from, fromName: from, time: Date.now()
    });
    await bumpLedger(from);
    const pushed = await push(env, {
      sender: from,
      heading: `${from} sent you ${WORDS[type]}`,
      content: 'Open it to see. You owe one back.',
      url: new URL('/', request.url).toString()
    });
    return json({ ok: true, id, pushed: pushed.ok });
  } catch (e) {
    return json({ ok: false, error: e.message }, 502);
  }
}

export const onRequest = () => json({ error: 'POST only' }, 405);
