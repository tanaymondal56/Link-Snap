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
  // Security: Strip any client-supplied internal secrets or CF-Access assertions
  headers.delete('cf-access-client-id');
  headers.delete('cf-access-client-secret');
  headers.delete('cf-access-jwt-assertion');
  headers.delete('x-linksnap-proxy-secret');
  headers.delete('x-internal-analytics-secret');

  headers.set('CF-Access-Client-Id', env.CF_CLIENT_ID);
  headers.set('CF-Access-Client-Secret', env.CF_CLIENT_SECRET);

  // Extract and preserve real client IP from incoming Cloudflare request
  const rawClientIP = request.headers.get('cf-connecting-ip');
  const pseudoIPv4 = request.headers.get('cf-pseudo-ipv4');
  const clientIP = rawClientIP === '::1' || rawClientIP === '0:0:0:0:0:0:0:1' ? '127.0.0.1' : rawClientIP;
  if (clientIP) {
    headers.set('cf-connecting-ip', clientIP);
    headers.set('cf-visitor-ip', clientIP);
    headers.set('x-real-ip', clientIP);
    headers.set('x-forwarded-for', clientIP);
  }
  if (pseudoIPv4) {
    headers.set('cf-pseudo-ipv4', pseudoIPv4);
  }

  // Forward Cloudflare GeoIP metadata and Ray ID for request tracing
  const cf = request.cf || {};
  if (cf.city) headers.set('cf-ipcity', cf.city);
  if (cf.country) headers.set('cf-ipcountry', cf.country);
  const cfRay = request.headers.get('cf-ray');
  if (cfRay) headers.set('cf-ray', cfRay);

  // Forward original public host and protocol to backend
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

  // Remove hop-by-hop headers
  headers.delete('host');

  // Forward the request to the backend
  const upstreamRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  });

  // Explicit upstream timeout (30s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(upstreamRequest, { signal: controller.signal });

    // Strip lax/wildcard CORS headers, and enforce credentialless COEP
    const responseHeaders = new Headers(response.headers);
    const incomingOrigin = request.headers.get('origin');
    const acao = responseHeaders.get('access-control-allow-origin');
    if (acao === '*' || !incomingOrigin) {
      responseHeaders.delete('access-control-allow-origin');
      responseHeaders.delete('access-control-allow-credentials');
    }
    if (!responseHeaders.has('cross-origin-embedder-policy')) {
      responseHeaders.set('cross-origin-embedder-policy', 'credentialless');
    }

    // Preserve multiple Set-Cookie headers (Fetch Headers constructor folds them by default)
    if (typeof response.headers.getSetCookie === 'function') {
      const cookies = response.headers.getSetCookie();
      if (cookies && cookies.length > 0) {
        responseHeaders.delete('set-cookie');
        for (const cookie of cookies) {
          responseHeaders.append('set-cookie', cookie);
        }
      }
    }

    const hasNoBody = response.status === 204 || response.status === 304;
    return new Response(hasNoBody ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      console.error('[BFF] Upstream fetch timed out after 30s');
      return new Response(
        JSON.stringify({ error: 'Gateway timeout' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.error('[BFF] Upstream fetch failed:', err.message);
    return new Response(
      JSON.stringify({ error: 'Backend unreachable' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
