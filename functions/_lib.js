// Shared helpers for the Pages Functions (files starting with _ are not routes).

export const ONESIGNAL_APP_ID = '6752ffdc-ebef-4aec-b9c7-ccb73f791cfd';
const PROJECT = 'filaki';
const FIREBASE_KEY = 'AIzaSyBMsCKD2XexYnzfe1DXKF6mJMZ5P21k2Fw';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
export const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`;
export const WORDS = { kiss: 'a kiss', hug: 'a hug', papoi: 'a papoi', draw: 'a drawing' };

export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra }
  });

// Firestore REST value -> plain JS
export function plain(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return fields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}
export const fields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, plain(v)]));

export async function getDoc(path) {
  const r = await fetch(`${BASE}/${path}?key=${FIREBASE_KEY}`);
  if (!r.ok) return null;
  const d = await r.json();
  return { id: d.name.split('/').pop(), ...fields(d.fields) };
}

// Run a query. `select` keeps big fields (like inline drawings) out of the response.
export async function runQuery(structuredQuery) {
  const r = await fetch(`${BASE}:runQuery?key=${FIREBASE_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery })
  });
  if (!r.ok) throw new Error(`Firestore query failed (${r.status})`);
  const rows = await r.json();
  return rows.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...fields(x.document.fields) }));
}

export async function createDoc(collection, data) {
  const toV = v => typeof v === 'number' ? { integerValue: String(Math.round(v)) }
    : typeof v === 'boolean' ? { booleanValue: v }
    : v === null ? { nullValue: null } : { stringValue: String(v) };
  const r = await fetch(`${BASE}/${collection}?key=${FIREBASE_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toV(v)])) })
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out?.error?.message || `Firestore write failed (${r.status})`);
  return out.name.split('/').pop();
}

export async function bumpLedger(name) {
  const quoted = '`' + name.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit?key=${FIREBASE_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        transform: {
          document: `${DOC_ROOT}/kisses/_ledger`,
          fieldTransforms: [{ fieldPath: `sent.${quoted}`, increment: { integerValue: '1' } }]
        }
      }]
    })
  });
  if (!r.ok) throw new Error(`ledger update failed (${r.status})`);
}

// Debt for one person, the same rule as the app: everyone is measured against whoever sent the most.
export function debtFor(sent, name) {
  const names = Object.keys(sent || {});
  if (name && !names.includes(name)) names.push(name);
  const top = Math.max(0, ...names.map(n => sent?.[n] || 0));
  const rows = names.map(n => ({ name: n, sent: sent?.[n] || 0, owes: top - (sent?.[n] || 0) }));
  const me = rows.find(r => r.name === name);
  const others = rows.filter(r => r.name !== name);
  const plural = n => n === 1 ? '1 filaki' : `${n} filakia`;
  let line = 'All square';
  if (me && me.owes > 0) {
    const creditor = others.find(r => r.owes === 0);
    line = creditor && others.length === 1 ? `You owe ${creditor.name} ${plural(me.owes)}` : `You owe ${plural(me.owes)}`;
  } else if (me) {
    const debtor = others.filter(r => r.owes > 0).sort((a, b) => b.owes - a.owes)[0];
    if (debtor) line = `${debtor.name} owes you ${plural(debtor.owes)}`;
  } else {
    line = 'Pick your name';
  }
  return { owes: me ? me.owes : 0, line, rows };
}

// Push to everyone except `sender`.
export async function push(env, { sender, heading, content, url }) {
  if (!env.ONESIGNAL_REST_API_KEY) return { ok: false, error: 'ONESIGNAL_REST_API_KEY is not set' };
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: 'push',
    filters: sender
      ? [
          { field: 'tag', key: 'name', relation: '!=', value: sender },
          { operator: 'OR' },
          { field: 'tag', key: 'name', relation: 'not_exists' }
        ]
      : [{ field: 'tag', key: 'name', relation: 'not_exists' }],
    headings: { en: heading },
    contents: { en: content },
    url,
    web_push_topic: 'filaki'
  };
  const send = scheme => fetch('https://api.onesignal.com/notifications?c=push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `${scheme} ${env.ONESIGNAL_REST_API_KEY}` },
    body: JSON.stringify(payload)
  });
  let res = await send('Key');
  if (res.status === 401 || res.status === 403) res = await send('Basic');
  const out = await res.json().catch(() => ({}));
  const ok = res.ok && !!out.id && !(out.errors && out.errors.length);
  return { ok, onesignal: out };
}
