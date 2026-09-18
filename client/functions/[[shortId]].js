// CF Pages Catch-all Edge Router for Short Links
// Intercepts all requests that are not matched by a more specific function (like api/[[path]].js)
// or an exact static file. It forwards short link requests to the backend for resolution.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Helper to serve assets from env.ASSETS while stripping lax CORS and enforcing COEP
  const serveCleanAsset = async (req) => {
    const assetRes = await env.ASSETS.fetch(req);
    const assetHeaders = new Headers(assetRes.headers);
    assetHeaders.delete('access-control-allow-origin');
    assetHeaders.delete('access-control-allow-credentials');
    const hasNoBody = assetRes.status === 204 || assetRes.status === 304;
    return new Response(hasNoBody ? null : assetRes.body, {
      status: assetRes.status,
      statusText: assetRes.statusText,
      headers: assetHeaders,
    });
  };

  // 1. Static asset and root files guard:
  // If request is for an asset, workbox script, service worker, or any file with an extension,
  // serve directly from env.ASSETS. Never proxy static file requests to the shortlink backend.
  const isStaticFile =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/workbox-') ||
    url.pathname === '/sw.js' ||
    /\.[a-zA-Z0-9]+$/.test(url.pathname);

  if (url.pathname === '/' || url.pathname === '/index.html' || isStaticFile) {
    const assetRes = await serveCleanAsset(request);
    // If the asset exists, return it. If a static file is not found, return 404 (NEVER index.html)
    if (assetRes.status !== 404 || !isStaticFile) {
      return assetRes;
    }
    return new Response('Asset not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const apiBase = env.API_BASE_URL || 'https://api.lksnp.qzz.io';
  // Note: we forward the original path and search query to the backend's root
  const targetUrl = `${apiBase}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  // Security: Strip any client-supplied internal secrets or CF-Access assertions
  headers.delete('cf-access-client-id');
  headers.delete('cf-access-client-secret');
  headers.delete('cf-access-jwt-assertion');
  headers.delete('x-linksnap-proxy-secret');
  headers.delete('x-internal-analytics-secret');

  // Inject Cloudflare Access Service Tokens so the backend accepts the request
  if (env.CF_CLIENT_ID && env.CF_CLIENT_SECRET) {
    headers.set('CF-Access-Client-Id', env.CF_CLIENT_ID);
    headers.set('CF-Access-Client-Secret', env.CF_CLIENT_SECRET);
  }

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

  const upstreamRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'manual', // IMPORTANT: We must NOT follow redirects! We want to pass the 302 back to the browser.
  });

  // Explicit upstream timeout (12s for better mobile responsiveness before SPA fallback)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(upstreamRequest, { signal: controller.signal });

    // If the backend returns a 404, it means this isn't a valid short link.
    // It's likely a React Router SPA path (e.g., /dashboard).
    // So we gracefully fallback to serving the React app's index.html.
    if (response.status === 404) {
      const indexRequest = new Request(new URL('/', request.url), {
        method: 'GET',
        headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      });
      return serveCleanAsset(indexRequest);
    }

    // Otherwise, return the backend's response (301, 302, 200 HTML, etc)
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
    console.error('[Edge Router] Upstream fetch failed:', err.message);

    // If backend is down, fallback to the React app so the dashboard still works.
    // Construct a clean GET request to avoid WinterCG "disturbed body" TypeError.
    const indexRequest = new Request(new URL('/', request.url), {
      method: 'GET',
      headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    });
    return serveCleanAsset(indexRequest);
  } finally {
    clearTimeout(timeoutId);
  }
}
