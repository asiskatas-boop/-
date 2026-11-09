// GET /api/drawing?id=<message id>  -> the drawing as an image, for widgets.
import { getDoc } from '../_lib.js';

export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return new Response('bad id', { status: 400 });
  const doc = await getDoc(`kisses/${id}`);
  const src = doc?.mediaUrl;
  if (!src) return new Response('not found', { status: 404 });

  const headers = { 'cache-control': 'public, max-age=86400, immutable', 'access-control-allow-origin': '*' };
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(src);
  if (m) {
    const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
    return new Response(bytes, { headers: { ...headers, 'content-type': m[1] } });
  }
  if (/^https:\/\//.test(src)) {
    const r = await fetch(src);
    if (!r.ok) return new Response('image gone', { status: 502 });
    return new Response(r.body, { headers: { ...headers, 'content-type': r.headers.get('content-type') || 'image/jpeg' } });
  }
  return new Response('not an image', { status: 415 });
}
