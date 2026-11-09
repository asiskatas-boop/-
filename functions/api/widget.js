// GET /api/widget?name=Athinara
// Everything a home-screen widget shows, in one small JSON:
// your debt, the last message, the latest drawing and the open couch-agenda items.
import { json, getDoc, runQuery, debtFor, WORDS } from '../_lib.js';

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const name = (url.searchParams.get('name') || '').trim().slice(0, 20);

  const [ledger, recent, items] = await Promise.all([
    getDoc('kisses/_ledger'),
    runQuery({
      from: [{ collectionId: 'kisses' }],
      select: { fields: [{ fieldPath: 'type' }, { fieldPath: 'fromName' }, { fieldPath: 'time' }] },
      orderBy: [{ field: { fieldPath: 'time' }, direction: 'DESCENDING' }],
      limit: 40
    }),
    runQuery({
      from: [{ collectionId: 'together' }],
      orderBy: [{ field: { fieldPath: 'time' }, direction: 'DESCENDING' }],
      limit: 100
    }).catch(() => [])
  ]);

  const sent = ledger?.sent || {};
  const debt = debtFor(sent, name);
  const last = recent[0] || null;
  const drawing = recent.find(m => m.type === 'draw') || null;
  const open = items.filter(i => !i.done).sort((a, b) => a.time - b.time);
  const origin = url.origin;

  return json({
    name,
    names: Object.keys(sent),
    owes: debt.owes,
    debtLine: debt.line,
    last: last && {
      type: last.type,
      from: last.fromName || null,
      time: last.time,
      text: last.fromName
        ? (last.fromName === name ? `You sent ${WORDS[last.type] || 'something'}` : `${WORDS[last.type] ? WORDS[last.type][0].toUpperCase() + WORDS[last.type].slice(1) : 'Something'} from ${last.fromName}`)
        : `${WORDS[last.type] || 'Something'} was sent`
    },
    drawing: drawing && {
      id: drawing.id,
      from: drawing.fromName || null,
      time: drawing.time,
      image: `${origin}/api/drawing?id=${drawing.id}`
    },
    agenda: { open: open.length, items: open.slice(0, 5).map(i => ({ text: i.text, by: i.by })) },
    appUrl: `${origin}/`,
    updated: Date.now()
  }, 200, { 'cache-control': 'public, max-age=30' });
}
