// CF Pages Catch-all Edge Router for Short Links
// Intercepts all requests that are not matched by a more specific function (like api/[[path]].js)
// or an exact static file. It forwards short link requests to the backend for resolution.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. If it's the homepage or index.html, serve it directly from static assets.
  // Other static assets (js, css, images) are already excluded in _routes.json
  // and will bypass this function entirely.
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return env.ASSETS.fetch(request);
  }

  const apiBase = env.API_BASE_URL || 'https://api.lksnp.qzz.io';
  // Note: we forward the original path and search query to the backend's root
  const targetUrl = `${apiBase}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
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
    const existingXFF = request.headers.get('x-forwarded-for');
    headers.set('x-forwarded-for', existingXFF ? `${clientIP}, ${existingXFF}` : clientIP);
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

  // Remove hop-by-hop headers
  headers.delete('host');

  const upstreamRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'manual', // IMPORTANT: We must NOT follow redirects! We want to pass the 302 back to the browser.
  });

  // Explicit upstream timeout (30s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(upstreamRequest, { signal: controller.signal });

    // If the backend returns a 404, it means this isn't a valid short link.
    // It's likely a React Router SPA path (e.g., /dashboard).
    // So we gracefully fallback to serving the React app's index.html.
    if (response.status === 404) {
      const indexRequest = new Request(new URL('/', request.url), request);
      return env.ASSETS.fetch(indexRequest);
    }

    // Otherwise, return the backend's response (301, 302, 200 HTML, etc)
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('access-control-allow-origin');
    responseHeaders.delete('access-control-allow-credentials');

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

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[Edge Router] Upstream fetch failed:', err.message);

    // If backend is down, fallback to the React app so the dashboard still works
    const indexRequest = new Request(new URL('/', request.url), request);
    return env.ASSETS.fetch(indexRequest);
  } finally {
    clearTimeout(timeoutId);
  }
}
