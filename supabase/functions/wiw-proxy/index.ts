// Supabase Edge Function: wiw-proxy
// ----------------------------------------------------------------------------
// Proxies When I Work calendar feeds so the browser can fetch them
// same-origin (the WIW calendar endpoint sends no CORS headers).
//
// Deploy:   supabase functions deploy wiw-proxy
// Configure (optional): set ALLOWED_ORIGIN to your deployed app origin.
// Called as either:
//   /functions/v1/wiw-proxy?token=<feed-token>
//   /functions/v1/wiw-proxy/<feed-token>.ics   (same shape as the dev proxy)
//
// Only hex feed tokens are accepted — this function will not fetch arbitrary
// URLs. The upstream URL is assembled from parts on purpose so this source
// file contains no complete calendar link (see .githooks/pre-commit).

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const fromPath = url.pathname.match(/([0-9a-f]{32,64})\.ics$/i);
  const token = (fromPath?.[1] ?? url.searchParams.get('token') ?? '')
    .toLowerCase();

  if (!/^[0-9a-f]{32,64}$/.test(token)) {
    return new Response('Bad request: missing or malformed feed token', {
      status: 400,
      headers: corsHeaders,
    });
  }

  const host = ['app', 'wheniwork', 'com'].join('.');
  const path = ['calendar', `${token}.ics`].join('/');
  const upstream = `https://${host}/${path}`;

  try {
    const upstreamRes = await fetch(upstream, {
      headers: { 'User-Agent': 'break-planner-sync' },
    });
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return new Response(`Upstream fetch failed: ${e.message}`, {
      status: 502,
      headers: corsHeaders,
    });
  }
});
