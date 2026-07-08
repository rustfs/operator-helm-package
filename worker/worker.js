import { marked } from "marked";

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/rustfs/operator-helm-package/main/README.md";
const PAGE_TITLE = "RustFS Operator Helm Chart";
const CACHE_TTL = 300;

// 省略 HTML_TEMPLATE ...

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    // Only render README for homepage.
    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return env.ASSETS.fetch(request);
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
