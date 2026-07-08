import { marked } from "marked";

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/rustfs/operator-helm-package/main/README.md";
const PAGE_TITLE = "RustFS Operator Helm Chart";
const CACHE_TTL = 300; // 5 minutes

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>__PAGE_TITLE__</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
  <style>
    :root {
      color-scheme: light;
      --page-bg: #f6f8fa;
      --content-bg: #ffffff;
      --border: #d0d7de;
      --text: #24292f;
      --muted: #57606a;
      --link: #0969da;
      --code-bg: #f6f8fa;
      --table-head-bg: #f6f8fa;
      --table-row-alt-bg: #fbfcfe;
    }

    * { box-sizing: border-box; }

    body {
      min-width: 200px;
      margin: 0 auto;
      padding: 48px 24px;
      background: var(--page-bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }

    .page-shell {
      max-width: 980px;
      margin: 0 auto;
      background: var(--content-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 16px 40px rgba(31, 35, 40, 0.08);
    }

    a { color: var(--link); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .markdown-body {
      max-width: 980px;
      padding: 40px;
      background: var(--content-bg);
      color: var(--text);
    }

    .markdown-body,
    .markdown-body p,
    .markdown-body li,
    .markdown-body td,
    .markdown-body th {
      color: var(--text) !important;
      opacity: 1 !important;
      text-shadow: none !important;
    }

    .markdown-body table {
      background: var(--content-bg) !important;
      border-color: var(--border) !important;
      filter: none !important;
    }

    .markdown-body tr {
      background: var(--content-bg) !important;
      border-top-color: var(--border) !important;
    }

    .markdown-body tr:nth-child(2n) {
      background: var(--table-row-alt-bg) !important;
    }

    .markdown-body thead tr,
    .markdown-body th {
      background: var(--table-head-bg) !important;
      color: var(--text) !important;
    }

    .markdown-body pre {
      background: var(--code-bg) !important;
      border: 1px solid var(--border) !important;
      color: var(--text) !important;
      filter: none !important;
      opacity: 1 !important;
    }

    .markdown-body pre code,
    .markdown-body code {
      color: var(--text) !important;
      background: transparent !important;
      opacity: 1 !important;
      text-shadow: none !important;
    }

    .markdown-body h1:first-child { margin-top: 0; }

    @media (max-width: 767px) {
      body { padding: 0; background: var(--content-bg); }
      .page-shell { border: 0; border-radius: 0; box-shadow: none; }
      .markdown-body { padding: 24px 16px; }
    }
  </style>
</head>
<body>
  <main class="page-shell">
    <article class="markdown-body">
      __CONTENT__
    </article>
  </main>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    // Check Cloudflare Cache
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let response = await cache.match(cacheKey);

    if (response) {
      return response;
    }

    // Fetch README from GitHub
    let htmlContent;
    try {
      const resp = await fetch(GITHUB_RAW_URL, {
        headers: { "User-Agent": "rustfs-operator-helm-pages" },
      });

      if (!resp.ok) {
        throw new Error(`GitHub returned ${resp.status}`);
      }

      const markdown = await resp.text();
      htmlContent = marked.parse(markdown);
    } catch (err) {
      return new Response(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px">
        <h1>Failed to load content</h1><p style="color:#666">${err.message}</p>
        <p><a href="https://github.com/rustfs/operator-helm-package">View on GitHub</a></p>
        </body></html>`,
        {
          status: 502,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    // Render page
    const html = HTML_TEMPLATE.replace("__PAGE_TITLE__", PAGE_TITLE).replace(
      "__CONTENT__",
      htmlContent,
    );

    response = new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
      },
    });

    // Store in Cloudflare Cache
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  },
};
