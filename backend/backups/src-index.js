// backend Cloudflare Worker — try several payload shapes and forward BR response
export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const pathname = url.pathname.replace(/\/+$/, "");
            const allowed = ["/screenshot", "/pdf", "/content"];
            if (!allowed.includes(pathname)) return jsonError("not_found", 404);

            if (pathname === "/status") {
                return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            if (request.method !== "GET") return jsonError("method_not_allowed", 405);

            const target = url.searchParams.get("url");
            if (!target) return jsonError("missing_url", 400);
            if (!isHttpUrl(target)) return jsonError("invalid_url", 400);

            const parsedTarget = new URL(target);
            if (isIpAddress(parsedTarget.hostname) && isPrivateIp(parsedTarget.hostname)) {
                return jsonError("forbidden_target", 400);
            }

            const accountId = env.BR_ACCOUNT_ID || env.account_id || env.ACCOUNT_ID;
            if (!accountId) return jsonError("server_misconfigured: missing BR account id", 500);
            const token = env.BR_API_TOKEN;
            if (!token) return jsonError("server_misconfigured: missing BR_API_TOKEN (set as secret)", 500);

            const action = pathname.slice(1); // screenshot|render|pdf
            // <-- corrected path per your note: use browser-rendering (dash) not browser_rendering (underscore)
            const brEndpoint = `${env.BR_API_BASE || "https://api.cloudflare.com/client/v4/accounts"}/${accountId}/browser-rendering/${action}`;

            // optional params
            const width = url.searchParams.get("width") ? Number(url.searchParams.get("width")) : undefined;
            const height = url.searchParams.get("height") ? Number(url.searchParams.get("height")) : undefined;
            const fullPage = url.searchParams.get("fullPage") === "true";

            // Edge cache key
            const cacheKey = new Request(request.url, request);
            const cache = caches.default;
            const cached = await cache.match(cacheKey);
            if (cached) {
                const cachedClone = new Response(cached.body, cached);
                cachedClone.headers.set("Access-Control-Allow-Origin", "*");
                return cachedClone;
            }

            // candidate payloads (cleaned of undefined fields)
            const mk = (obj) => JSON.parse(JSON.stringify(obj));
            const candidates = [
                mk({ url: target }),
                mk({ url: target, viewport: (width || height) ? { width, height } : undefined }),
                mk({ url: target, options: { full_page: fullPage } }),
                mk({ url: target, viewport: (width || height) ? { width, height } : undefined, options: { full_page: fullPage } }),
                mk({ url: target, render_options: (width || height) ? { width, height, full_page: fullPage } : undefined }),
                mk({ url: target, screenshot: (width || height || fullPage) ? { viewport: (width || height) ? { width, height } : undefined, full_page: fullPage } : undefined })
            ];

            // single controller for overall attempts (per-request timeout)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);

            let lastErr = null;
            try {
                for (const payload of candidates) {
                    // skip payloads that are effectively identical to previous (optional)
                    const init = {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    };

                    let brResp;
                    try {
                        brResp = await fetch(brEndpoint, init);
                    } catch (err) {
                        // network/abort errors: log and try next
                        console.error("fetch error for payload:", payload, err);
                        lastErr = { error: err.message || String(err), payload };
                        continue;
                    }

                    // Clone and inspect body text for debugging / schema errors without consuming original stream
                    const bodyText = await brResp.clone().text().catch(() => "<non-text response>");

                    console.log("BR try payload:", JSON.stringify(payload), "status:", brResp.status, "body:", bodyText);

                    // If BR returned JSON which contains base64 result, handle that
                    const ct = brResp.headers.get("Content-Type") || "";
                    if (ct.includes("application/json")) {
                        let j = null;
                        try {
                            j = await brResp.clone().json();
                        } catch (e) {
                            j = null;
                        }
                        if (j && j.result && typeof j.result === "string") {
                            const contentType = j.content_type || "application/octet-stream";
                            const bytes = base64ToUint8Array(j.result);
                            const resp = new Response(bytes, {
                                status: 200,
                                headers: {
                                    "Content-Type": contentType,
                                    "Access-Control-Allow-Origin": "*",
                                    "Cache-Control": "public, max-age=60"
                                }
                            });
                            // cache and return
                            ctx.waitUntil(cache.put(cacheKey, resp.clone()));
                            clearTimeout(timeout);
                            return resp;
                        }
                    }

                    // If status is OK or 2xx, forward the stream directly
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

                    // otherwise record error and try next candidate
                    lastErr = { status: brResp.status, body: bodyText, payload };
                    // continue to next payload
                }
            } finally {
                clearTimeout(timeout);
            }

            // If all candidates failed, return last error (useful for debugging)
            console.error("All BR payload attempts failed. lastErr:", lastErr);
            return new Response(JSON.stringify({ error: "upstream_schema_mismatch", details: lastErr }), {
                status: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });

        } catch (err) {
            console.error("unexpected error:", err);
            return jsonError("internal_error", 500);
        }
    }
};

// helpers
function jsonError(message, status) {
    return new Response(JSON.stringify({ error: message, status }), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
}
function isHttpUrl(u) {
    try { const p = new URL(u); return p.protocol === "http:" || p.protocol === "https:"; } catch (e) { return false; }
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
function base64ToUint8Array(base64) {
    // atob is available in Workers / Miniflare
    const binary = (typeof atob === "function") ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}