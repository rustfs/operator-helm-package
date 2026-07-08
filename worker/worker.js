import { marked } from "marked";

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/rustfs/operator-helm-package/main/README.md";
const PAGE_TITLE = "RustFS Operator Helm Chart";
const CACHE_TTL = 300;

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>__PAGE_TITLE__</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
</head>
<body>
  <main class="markdown-body" style="max-width:980px;margin:40px auto;padding:24px;">
    __CONTENT__
  </main>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return env.ASSETS.fetch(request);
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let response = await cache.match(cacheKey);

    if (response) {
      return response;
    }

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

    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  },
};
