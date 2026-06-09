/* ============================================================
   Cloudflare Worker — Meta Conversions API (CAPI) relay
   for kinnisvara.lindjanar.ee
   ------------------------------------------------------------
   The browser fires each Pixel event with a unique event_id and
   ALSO POSTs the same event here. This Worker forwards it to
   Meta server-side. Meta deduplicates browser + server events by
   (event_name + event_id), so you get the resilience of CAPI
   (beats adblockers / iOS / cookie loss) with no double-counting.

   DEPLOY (one time):
     1. npm i -g wrangler        # or: npx wrangler ...
     2. wrangler login
     3. wrangler secret put META_CAPI_TOKEN   # paste token from
        Events Manager → Settings → Conversions API → Generate token
     4. wrangler deploy
     5. Copy the deployed URL (https://lindjanar-capi.<you>.workers.dev)
        into window.CAPI_ENDPOINT in index.html.

   OPTIONAL (verify in Test Events):
     wrangler secret put META_TEST_CODE   # paste the TEST#### code
        shown in Events Manager → Test Events. Remove it when done.
   ============================================================ */

const ALLOWED_ORIGIN = 'https://kinnisvara.lindjanar.ee';
const API_VERSION = 'v21.0';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }
    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405);
    }

    let p;
    try { p = await request.json(); } catch (e) {
      return json({ error: 'invalid JSON' }, 400);
    }

    const pixelId = env.META_PIXEL_ID;
    const token = env.META_CAPI_TOKEN;
    if (!pixelId || !token) return json({ error: 'server not configured' }, 500);

    // Server-side signals Cloudflare gives us for free.
    const user_data = {
      client_ip_address: request.headers.get('CF-Connecting-IP') || '',
      client_user_agent: request.headers.get('User-Agent') || ''
    };
    if (p.fbp) user_data.fbp = p.fbp;
    if (p.fbc) user_data.fbc = p.fbc;

    // Hash any PII the form collected (SHA-256, per Meta's spec).
    const pii = p.user_data || {};
    if (pii.email) user_data.em = [await sha256(String(pii.email).trim().toLowerCase())];
    if (pii.phone) user_data.ph = [await sha256(String(pii.phone).replace(/[^0-9]/g, ''))];

    const event = {
      event_name: p.event_name || 'PageView',
      event_time: Math.floor(Date.now() / 1000),
      event_id: p.event_id,
      event_source_url: p.event_source_url,
      action_source: 'website',
      user_data
    };

    const body = { data: [event] };
    if (env.META_TEST_CODE) body.test_event_code = env.META_TEST_CODE;

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${token}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    return json({ status: res.status, meta: await res.text() }, 200);
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors())
  });
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
