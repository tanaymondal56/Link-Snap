// CF Pages /api/* BFF Proxy Function
// This is a Cloudflare Pages Function that proxies all /api/* requests
// to the private backend API, injecting Cloudflare Access Service Tokens
// so the backend is never directly reachable by the public internet.
//
// Architecture:
//   Browser → CF Pages (yourdomain.com)
//     → /api/* → this function
//       → injects CF-Access-Client-Id + CF-Access-Client-Secret headers
//         → api.lksnp.qzz.io (protected by CF Access — only accepts Service Tokens)
//           → Cloudflare Tunnel → K8s backend service
//
// Environment variables to set in CF Pages dashboard (Settings → Environment variables):
//   CF_CLIENT_ID      = your CF Access Service Token Client ID
//   CF_CLIENT_SECRET  = your CF Access Service Token Client Secret
//   API_BASE_URL      = https://api.lksnp.qzz.io  (your tunnel-connected API origin)

export async function onRequest(context) {
  const { request, env } = context;

  // Validate required environment variables
  if (!env.CF_CLIENT_ID || !env.CF_CLIENT_SECRET) {
    console.error('[BFF] Missing CF_CLIENT_ID or CF_CLIENT_SECRET env vars');
    return new Response(
      JSON.stringify({ error: 'Proxy misconfiguration' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiBase = env.API_BASE_URL || 'https://api.lksnp.qzz.io';

  // Reconstruct the target URL: strip the /api prefix and forward to backend
  const url = new URL(request.url);
  const targetUrl = `${apiBase}${url.pathname}${url.search}`;

  // Clone headers and inject CF Access Service Token
  const headers = new Headers(request.headers);
  headers.set('CF-Access-Client-Id', env.CF_CLIENT_ID);
  headers.set('CF-Access-Client-Secret', env.CF_CLIENT_SECRET);

  // Remove hop-by-hop headers that must not be forwarded
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('x-real-ip');

  // Forward the request to the backend
  const upstreamRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  });

  try {
    const response = await fetch(upstreamRequest);

    // Strip any upstream CORS headers — CF Pages will add its own
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('access-control-allow-origin');
    responseHeaders.delete('access-control-allow-credentials');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[BFF] Upstream fetch failed:', err.message);
    return new Response(
      JSON.stringify({ error: 'Backend unreachable', message: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
