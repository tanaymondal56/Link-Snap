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

  // Ensure the backend receives the real client IP for analytics and rate-limiting
  const clientIP = request.headers.get('cf-connecting-ip');
  if (clientIP) {
    headers.set('X-Forwarded-For', clientIP);
    headers.set('X-Real-IP', clientIP);
  }

  // Remove hop-by-hop headers
  headers.delete('host');

  const upstreamRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'manual', // IMPORTANT: We must NOT follow redirects! We want to pass the 302 back to the browser.
  });

  try {
    const response = await fetch(upstreamRequest);

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
  }
}
