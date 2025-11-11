import { getConfig } from './config.js';
/* 
在文件顶部添加了一行 import（從 src/talk-worker.js 导入 handleTalkRequest 与 serveAudioFromR2），
并在 fetch handler 的开头（计算 pathname 后、原有 allowed 路由检查之前）插入了两条路由判断：
POST /talk 会调用 handleTalkRequest(request, env, ctx, cfg)，
GET /audio/:key 会调用 serveAudioFromR2(key, env)
 */
import { handleTalkRequest, serveAudioFromR2 } from './talk-worker.js';
// 新增：从 seo-analytic 模块导入处理函数（用于 POST /seo）
// 注意：这里改为相对于 backend/src 的本地导入（保持注释不变）
import { handleSeo } from './seo-analytic.js';


/**
 * backend Cloudflare Worker — Browser Rendering proxy
 * - Reads unified CONFIG_SECRET via src/config.js (getConfig)
 * - Uses cfg.CF_API_TOKEN (or fallbacks) for Authorization to BR
 * - Supports endpoints: /content /snapshot /screenshot /pdf /scrape /json /links /markdown /status
 *
 * NOTE: Ensure wrangler.toml declares:
 *  name = "br-proxy-worker"
 *  main = "src/index.js"
 *
 */

// 新增：从 backend 的 seo-analytic 导出 BrowserDo，以便 wrangler (v4) 能检测到 Durable Object 的 class 导出。
// 说明（中文注释）：确保 wrangler.toml 中 durable_objects.bindings[].class_name 与这里导出的类名一致（例如 BrowserDo）。
// 修正路径：从 backend/src/index.js 导出 backend 同目录实现（不要上跳到不存在的位置）
export { BrowserDo } from './seo-analytic.js';

// 如果你仍然想保留从本地 seo-analytic.js 的 handleSeo（同目录），上面的导出不会影响其行为。
// 注意：若你希望 handleSeo 来自其它路径，也可以把上面的 import 调整为相应路径。
// 这里保留你原有的导入以尊重你的项目结构（你可以在需要时统一路径）。

export default {
    async fetch(request, env, ctx) {
        // Use unified config (CONFIG_SECRET) and fallbacks
        const cfg = getConfig(env);

        try {
            const url = new URL(request.url);
            const pathname = url.pathname.replace(/\/+$/, "");

            // --- 临时调试路由：/_debug/secrets (仅用于本地调试，完成后请删除) ---
            if (pathname === "/_debug/secrets") {
                if (request.method !== "GET") {
                    return jsonError("method_not_allowed", 405);
                }
                try {
                    // 重新读取 cfg 并同时检测 env 直接绑定
                    const cfgNow = getConfig(env);
                    const cfgHas = !!(cfgNow && cfgNow.WORKERS_AI_ENDPOINT);
                    const envHas = !!env.WORKERS_AI_ENDPOINT;

                    // mask helper: 不暴露完整值，只展示开头+结尾
                    const mask = (s) => {
                        if (!s) return null;
                        s = String(s);
                        if (s.length <= 60) return s;
                        return `${s.slice(0, 40)}…${s.slice(-10)}`;
                    };

                    const out = {
                        cfgHas_WORKERS_AI_ENDPOINT: cfgHas,
                        envHas_WORKERS_AI_ENDPOINT: envHas,
                        cfg_WORKERS_AI_ENDPOINT_preview: mask(cfgNow && cfgNow.WORKERS_AI_ENDPOINT),
                        env_WORKERS_AI_ENDPOINT_preview: mask(env.WORKERS_AI_ENDPOINT),
                    };

                    return new Response(JSON.stringify({ ok: true, debug: out }, null, 2), {
                        status: 200,
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                    });
                } catch (e) {
                    console.error("debug route error", e);
                    return jsonError("debug_error", 500);
                }
            }
            // --- end debug route ---

            // New: handle POST /talk and GET /audio/:key routes (mounted from src/talk-worker.js)
            // These are placed before the BR proxy allowed-routes handling so /talk and /audio/* are served first.
            if (pathname === "/talk" && request.method === "POST") {
                return await handleTalkRequest(request, env, ctx, cfg);
            }

            if (request.method === "GET" && pathname.startsWith("/audio/")) {
                const key = decodeURIComponent(pathname.slice("/audio/".length));
                return await serveAudioFromR2(key, env);
            }

            // New: handle POST /seo (mounted from src/seo-analytic.js)
            // Accept both POST and OPTIONS (preflight) and forward to handleSeo.
            // 新增：handle POST /seo 路由（支持 POST 与 OPTIONS，方便浏览器预检）
            if (pathname === "/seo" && (request.method === "POST" || request.method === "OPTIONS")) {
                // 将请求转交给 seo-analytic.js 中导出的 handleSeo 处理
                return await handleSeo(request, env, ctx, cfg);
            }

            // allowed routes per your request
            const allowed = [
                "/content",
                "/snapshot",
                "/screenshot",
                "/pdf",
                "/scrape",
                "/json",
                "/links",
                "/markdown",
                "/status"
            ];
            if (!allowed.includes(pathname)) return jsonError("not_found", 404);

            if (pathname === "/status") {
                return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                });
            }

            if (request.method !== "GET") return jsonError("method_not_allowed", 405);

            const target = url.searchParams.get("url");
            if (!target && pathname !== "/scrape") {
                // for non-scrape endpoints url is required
                return jsonError("missing_url", 400);
            }
            if (target && !isHttpUrl(target)) return jsonError("invalid_url", 400);

            if (target) {
                const parsedTarget = new URL(target);
                if (isIpAddress(parsedTarget.hostname) && isPrivateIp(parsedTarget.hostname)) {
                    return jsonError("forbidden_target", 400);
                }
            }

            // Prefer values from CONFIG_SECRET (cfg), fallback to env.* for backwards compatibility
            const accountId = cfg.BR_ACCOUNT_ID || env.BR_ACCOUNT_ID || env.account_id || env.ACCOUNT_ID;
            if (!accountId) return jsonError("server_misconfigured: missing BR account id", 500);

            const token = cfg.CF_API_TOKEN || env.CF_API_TOKEN || env.BR_API_TOKEN || env.WORKERS_AI_KEY || "";
            if (!token) return jsonError("server_misconfigured: missing API token (set as secret)", 500);

            // determine action: map incoming route to BR action name directly
            let action = pathname.slice(1); // e.g. "screenshot" | "pdf" | "content" | "scrape"
            const brBase = cfg.BR_API_BASE || env.BR_API_BASE || "https://api.cloudflare.com/client/v4/accounts";
            const brEndpoint = `${brBase}/${accountId}/browser-rendering/${action}`;

            // optional params from querystring
            const width = url.searchParams.get("width") ? Number(url.searchParams.get("width")) : undefined;
            const height = url.searchParams.get("height") ? Number(url.searchParams.get("height")) : undefined;
            const deviceScaleFactor = url.searchParams.get("deviceScaleFactor") ? Number(url.searchParams.get("deviceScaleFactor")) : undefined;
            const fullPage = url.searchParams.get("fullPage") === "true";

            // For scrape: parse optional elements param (JSON string) - prefer elements if provided
            let elementsParam = null;
            if (action === "scrape") {
                const raw = url.searchParams.get("elements");
                if (raw) {
                    try {
                        // URLSearchParams.get already decodes percent-encoding
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                            // validate each entry is an object with selector string
                            const ok = parsed.every(item => item && typeof item.selector === "string");
                            if (ok) elementsParam = parsed.map(item => ({ selector: String(item.selector) }));
                            else console.warn("scrape: elements array exists but items invalid, ignoring elements param");
                        } else {
                            console.warn("scrape: elements param present but not an array, ignoring");
                        }
                    } catch (e) {
                        console.warn("scrape: elements param parse error:", e);
                        elementsParam = null;
                    }
                }
            }

            // Edge cache key
            const cacheKey = new Request(request.url, request);
            const cache = caches.default;
            const cached = await cache.match(cacheKey);
            if (cached) {
                const cachedClone = new Response(cached.body, cached);
                cachedClone.headers.set("Access-Control-Allow-Origin", "*");
                return cachedClone;
            }

            // Build payload(s) to send to BR.
            const mk = (obj) => JSON.parse(JSON.stringify(obj));
            let candidates = [];

            if (action === "scrape") {
                // Preferred payload: include both url and elements (if elements provided)
                if (elementsParam && elementsParam.length) {
                    candidates.push(mk({ url: target, elements: elementsParam }));
                    // also add a fallback with only elements (some BR variants may accept elements-only)
                    candidates.push(mk({ elements: elementsParam }));
                }
                // If elements not provided, fall back to url-only (must provide either url or elements)
                if (target) candidates.push(mk({ url: target }));
            } else {
                // general candidate payloads for other actions (viewport nested preferred)
                candidates = [
                    mk({ url: target }),
                    mk({ url: target, viewport: (width || height) ? { width, height, device_scale_factor: deviceScaleFactor } : undefined }),
                    mk({ url: target, options: { full_page: fullPage } }),
                    mk({ url: target, viewport: (width || height) ? { width, height, device_scale_factor: deviceScaleFactor } : undefined, options: { full_page: fullPage } }),
                    mk({ url: target, render_options: (width || height) ? { width, height, full_page: fullPage } : undefined }),
                    mk({ url: target, screenshot: (width || height || fullPage) ? { viewport: (width || height) ? { width, height } : undefined, full_page: fullPage } : undefined })
                ].map(p => {
                    // remove undefined nested objects
                    return JSON.parse(JSON.stringify(p));
                });
            }

            // overall timeout for trying payloads
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);

            let lastErr = null;
            try {
                for (const payload of candidates) {
                    const init = {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal,
                    };

                    let brResp;
                    try {
                        brResp = await fetch(brEndpoint, init);
                    } catch (err) {
                        console.error("fetch error for payload:", payload, err);
                        lastErr = { error: err.message || String(err), payload };
                        continue;
                    }

                    // inspect response body text (safe clone)
                    const bodyText = await brResp.clone().text().catch(() => "<non-text response>");
                    console.log("BR try payload:", JSON.stringify(payload), "action:", action, "status:", brResp.status, "body:", bodyText);

                    const ct = (brResp.headers.get("Content-Type") || "").toLowerCase();

                    // If JSON: robust handling (may be base64 result, dataURI, plain html/text, or structured JSON)
                    if (ct.includes("application/json") || looksLikeJson(bodyText)) {
                        let j = null;
                        try {
                            j = await brResp.clone().json();
                        } catch (e) {
                            j = null;
                        }
                        if (j) {
                            console.log("BR json returned (debug):", JSON.stringify(j));

                            // If result is a string, it may be HTML, dataURI, base64, or plain text
                            if (typeof j.result === "string") {
                                const s = j.result.trim();

                                // If looks like HTML (starts with '<'), use HTMLRewriter to fix relative URLs
                                if (s.startsWith("<")) {
                                    const origin = target ? new URL(target).origin : '';
                                    const response = new Response(s, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });

                                    const rewriter = new HTMLRewriter()
                                        .on('head', {
                                            element(element) {
                                                try {
                                                    if (origin) element.prepend(`<base href="${origin}">`, { html: true });
                                                } catch (e) { }
                                            }
                                        })
                                        .on('img', makeAbsolute(target))
                                        .on('script', makeAbsolute(target, ['src']))
                                        .on('link', makeAbsolute(target, ['href']))
                                        .on('a', makeAbsolute(target, ['href']))
                                        .on('source', makeAbsolute(target, ['src', 'srcset']))
                                        .on('video', makeAbsolute(target, ['poster', 'src']))
                                        .on('audio', makeAbsolute(target, ['src']))
                                        .on('script', removeIntegrity)
                                        .on('link', removeIntegrity);

                                    const transformed = rewriter.transform(response);
                                    clearTimeout(timeout);
                                    ctx.waitUntil((async () => {
                                        try {
                                            const cachedResp = transformed.clone();
                                            const headers = new Headers(cachedResp.headers);
                                            headers.set("Access-Control-Allow-Origin", "*");
                                            await cache.put(cacheKey, new Response(await cachedResp.text(), { status: 200, headers }));
                                        } catch (e) {
                                            console.error("cache put failed:", e);
                                        }
                                    })());
                                    return transformed;
                                }

                                // data URI handling
                                if (s.startsWith("data:")) {
                                    const match = s.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
                                    if (match) {
                                        const mime = match[1] || "application/octet-stream";
                                        const isBase64 = !!match[2];
                                        const payloadData = match[3] || "";
                                        if (isBase64) {
                                            try {
                                                const bytes = base64ToUint8Array(payloadData);
                                                const resp = new Response(bytes, {
                                                    status: 200,
                                                    headers: { "Content-Type": mime, "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" }
                                                });
                                                ctx.waitUntil(cache.put(cacheKey, resp.clone()));
                                                clearTimeout(timeout);
                                                return resp;
                                            } catch (e) {
                                                console.error("dataURI base64 decode failed:", e);
                                            }
                                        } else {
                                            const text = decodeURIComponent(payloadData);
                                            const resp = new Response(text, {
                                                status: 200,
                                                headers: { "Content-Type": mime, "Access-Control-Allow-Origin": "*" }
                                            });
                                            clearTimeout(timeout);
                                            return resp;
                                        }
                                    }
                                }

                                // plain base64 string handling
                                const cleaned = s.replace(/\s+/g, '');
                                if (isLikelyBase64(cleaned)) {
                                    try {
                                        const bytes = base64ToUint8Array(cleaned);
                                        const contentType = j.content_type || "application/octet-stream";
                                        const resp = new Response(bytes, {
                                            status: 200,
                                            headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" }
                                        });
                                        ctx.waitUntil(cache.put(cacheKey, resp.clone()));
                                        clearTimeout(timeout);
                                        return resp;
                                    } catch (e) {
                                        console.error("base64 decode failed:", e);
                                    }
                                }

                                // fallback: treat as HTML/text
                                const maybeCt = j.content_type || "text/html; charset=utf-8";
                                const respText = s;
                                const resp = new Response(respText, {
                                    status: 200,
                                    headers: { "Content-Type": maybeCt, "Access-Control-Allow-Origin": "*" }
                                });
                                clearTimeout(timeout);
                                return resp;
                            }

                            // j.result object handling (e.g., { html: "..."} or structured)
                            if (typeof j.result === "object" && j.result !== null) {
                                if (typeof j.result.html === "string") {
                                    const htmlStr = j.result.html;
                                    const origin = target ? new URL(target).origin : '';
                                    const response = new Response(htmlStr, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
                                    const rewriter = new HTMLRewriter()
                                        .on('head', { element(el) { try { if (origin) el.prepend(`<base href="${origin}">`, { html: true }); } catch (e) { } } })
                                        .on('img', makeAbsolute(target))
                                        .on('script', makeAbsolute(target, ['src']))
                                        .on('link', makeAbsolute(target, ['href']))
                                        .on('a', makeAbsolute(target, ['href']))
                                        .on('source', makeAbsolute(target, ['src', 'srcset']))
                                        .on('script', removeIntegrity)
                                        .on('link', removeIntegrity);
                                    const transformed = rewriter.transform(response);
                                    clearTimeout(timeout);
                                    return transformed;
                                }

                                const resp = new Response(JSON.stringify(j.result), {
                                    status: 200,
                                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                                });
                                clearTimeout(timeout);
                                return resp;
                            }

                            // fallback: raw JSON
                            const fallbackResp = new Response(JSON.stringify(j), {
                                status: brResp.status || 200,
                                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                            });
                            clearTimeout(timeout);
                            return fallbackResp;
                        } // end if j
                        // if j is null, fallthrough to next branch
                    } // end JSON handling

                    // Otherwise forward successful stream responses
                    if (brResp.ok) {
                        const forwardHeaders = new Headers();
                        const contentType = brResp.headers.get("Content-Type") || "application/octet-stream";
                        forwardHeaders.set("Content-Type", contentType);
                        const contentLength = brResp.headers.get("content-length");
                        if (contentLength) forwardHeaders.set("Content-Length", contentLength);
                        const cacheControl = brResp.headers.get("cache-control");
                        if (cacheControl) forwardHeaders.set("Cache-Control", cacheControl);
                        forwardHeaders.set("Access-Control-Allow-Origin", "*");
                        forwardHeaders.set("Vary", "Origin");

                        const response = new Response(brResp.body, { status: brResp.status, headers: forwardHeaders });

                        if (brResp.ok && !contentType.includes("text/html")) {
                            const responseForCache = response.clone();
                            responseForCache.headers.set("Cache-Control", `public, max-age=60`);
                            ctx.waitUntil(cache.put(cacheKey, responseForCache));
                        }

                        clearTimeout(timeout);
                        return response;
                    }

                    // record and try next candidate
                    lastErr = { status: brResp.status, body: bodyText, payload };
                }
            } finally {
                clearTimeout(timeout);
            }

            // all attempts failed
            console.error("All BR payload attempts failed. lastErr:", lastErr);
            return new Response(JSON.stringify({ error: "upstream_schema_mismatch", details: lastErr }), {
                status: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        } catch (err) {
            console.error("unexpected error:", err);
            return jsonError("internal_error", 500);
        }
    },
};

// helpers
function jsonError(message, status) {
    return new Response(JSON.stringify({ error: message, status }), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
function isHttpUrl(u) {
    try {
        const p = new URL(u);
        return p.protocol === "http:" || p.protocol === "https:";
    } catch (e) {
        return false;
    }
}
function isIpAddress(host) {
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-fA-F:]+$/;
    return ipv4.test(host) || ipv6.test(host);
}
function isPrivateIp(ip) {
    if (/^10\./.test(ip)) return true;
    if (/^127\./.test(ip)) return true;
    if (/^192\.168\./.test(ip)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
    if (ip === "::1") return true;
    return false;
}
function looksLikeJson(s) {
    if (!s || typeof s !== "string") return false;
    const t = s.trim();
    return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}
function isLikelyBase64(s) {
    if (!s || typeof s !== "string") return false;
    const cleaned = s.replace(/\s+/g, '');
    if (cleaned.length === 0) return false;
    if (cleaned.length % 4 !== 0) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned);
}
function base64ToUint8Array(base64) {
    const b64 = base64.replace(/\s+/g, '');
    try {
        if (typeof atob === "function") {
            const binary = atob(b64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes.buffer;
        } else {
            return Buffer.from(b64, "base64").buffer;
        }
    } catch (e) {
        const err = new Error("base64 decode failed: " + (e.message || e));
        err.cause = e;
        throw err;
    }
}

// HTMLRewriter helper: create a handler that makes listed attributes absolute relative to baseUrl
function makeAbsolute(baseUrl, attrs) {
    const attributes = attrs || ['src', 'href', 'srcset', 'poster'];
    return {
        element(element) {
            for (const name of attributes) {
                const val = element.getAttribute(name);
                if (!val) continue;
                try {
                    if (name === 'srcset') {
                        const parts = val.split(',').map(p => p.trim()).map(item => {
                            const [urlPart, descriptor] = item.split(/\s+/, 2);
                            const abs = new URL(urlPart, baseUrl).toString();
                            return descriptor ? `${abs} ${descriptor}` : abs;
                        });
                        element.setAttribute(name, parts.join(', '));
                    } else {
                        const abs = new URL(val, baseUrl).toString();
                        element.setAttribute(name, abs);
                    }
                } catch (e) {
                    // ignore invalid urls
                }
            }
        }
    };
}

// remove attributes that can break loading when we rewrite URLs (SRI/crossorigin)
const removeIntegrity = {
    element(element) {
        try {
            if (element.getAttribute('integrity')) element.removeAttribute('integrity');
            if (element.getAttribute('crossorigin')) element.removeAttribute('crossorigin');
        } catch (e) { }
    }
};

/* 
  Export a Durable Object class named BrDurableObject so wrangler (v4) can find it.
  This file previously didn't export a class matching the wrangler.toml class_name.
  We add a lightweight placeholder Durable Object implementation here that can be used
  in local development. If you have a more feature-rich BrowserDo class elsewhere,
  you can replace the internals of BrDurableObject.fetch to delegate to it.
*/
/* 
  导出一个 Durable Object class（占位），使 wrangler 能够检测到对应的 class_name 导出。
  如果你已经有 BrowserDo 类实现，可以把下面这个替换为导入并导出你的真实实现。
*/

export class BrDurableObject {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        // You can initialize per-instance state here, e.g., this.browser = null;
    }

    // Minimal fetch handler: accept a GET/POST request and return a simple JSON response.
    // The SEO handler will attempt to use Durable Object to render pages when useBrowser=true.
    // For now this implementation returns a placeholder and allows fallback to server-side fetch.
    // Minimal fetch handler: 接收 GET/POST 请求并返回 JSON（便于本地调试）
    // SEO handler 在 useBrowser=true 时会尝试调用 DO；若你需要 DO 返回渲染后的 HTML，
    // 请在这里实现 puppeteer 渲染逻辑，或将请求委托给实际的 BrowserDo 实现。
    async fetch(request) {
        try {
            // If the DO is called with a query param ?renderHtml=1 or similar, you could implement real rendering.
            // For development, return a basic JSON to indicate DO is reachable.
            // 如果 DO 接收到 ?renderHtml=1 之类的查询参数，可以实现真实渲染
            // 目前返回一个简单的 echo JSON，表示 DO 可达（便于本地验证）
            const url = new URL(request.url);
            // Simple echo behavior for debugging
            const body = {
                ok: true,
                message: "BrDurableObject placeholder response",
                method: request.method,
                url: url.href,
            };
            return new Response(JSON.stringify(body, null, 2), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: String(e) }, null, 2), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }
    }
}