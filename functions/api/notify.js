// Cloudflare Pages Function: POST /api/notify  { id: "<kisses doc id>" }
// Looks the message up in Firestore (so nobody can push made-up text),
// then asks OneSignal to notify everyone except the sender.
//
// Needs one secret in Cloudflare Pages > Settings > Variables and Secrets:
//   ONESIGNAL_REST_API_KEY = the "App API key" from OneSignal > Settings > Keys & IDs

const ONESIGNAL_APP_ID = '6752ffdc-ebef-4aec-b9c7-ccb73f791cfd';
const FIREBASE_KEY = 'AIzaSyBMsCKD2XexYnzfe1DXKF6mJMZ5P21k2Fw';
const DOC_URL = id =>
  `https://firestore.googleapis.com/v1/projects/filaki/databases/(default)/documents/kisses/${id}?key=${FIREBASE_KEY}`;
const WORDS = { kiss: 'a kiss', hug: 'a hug', papoi: 'a papoi', draw: 'a drawing' };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  if (!env.ONESIGNAL_REST_API_KEY) return json({ error: 'ONESIGNAL_REST_API_KEY is not set' }, 500);

  let id;
  try { ({ id } = await request.json()); } catch { return json({ error: 'bad body' }, 400); }
  if (typeof id !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(id)) return json({ error: 'bad id' }, 400);

  const docRes = await fetch(DOC_URL(id));
  if (!docRes.ok) return json({ error: `message lookup failed (${docRes.status})` }, 404);
  const f = (await docRes.json()).fields || {};
  const val = k => f[k] && Object.values(f[k])[0];

  const time = Number(val('time'));
  if (!time || Math.abs(Date.now() - time) > 5 * 60 * 1000) return json({ error: 'message too old' }, 409);

  const sender = String(val('fromName') || '').slice(0, 20);
  const what = WORDS[val('type')] || 'something';
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: 'push',
    // everyone whose name isn't the sender's (and phones that haven't picked a name yet)
    filters: sender
      ? [
          { field: 'tag', key: 'name', relation: '!=', value: sender },
          { operator: 'OR' },
          { field: 'tag', key: 'name', relation: 'not_exists' }
        ]
      : [{ field: 'tag', key: 'name', relation: 'not_exists' }],
    headings: { en: sender ? `${sender} sent you ${what}` : `You got ${what}` },
    contents: { en: 'Open it to see. You owe one back.' },
    url: new URL('/', request.url).toString(),
    web_push_topic: 'filaki'
  };

  const send = scheme => fetch('https://api.onesignal.com/notifications?c=push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `${scheme} ${env.ONESIGNAL_REST_API_KEY}` },
    body: JSON.stringify(payload)
  });
  let res = await send('Key');                                   // current OneSignal keys
  if (res.status === 401 || res.status === 403) res = await send('Basic'); // legacy keys
  const out = await res.json().catch(() => ({}));
  return json({ ok: res.ok, onesignal: out }, res.ok ? 200 : 502);
}

export const onRequest = () => json({ error: 'POST only' }, 405);
