/**
 * src/talk-worker.js
 *
 * talk-worker module with fallback to env.* for WORKERS_AI_ENDPOINT / keys.
 * Exported: handleTalkRequest(request, env, ctx, cfg) and serveAudioFromR2(key, env)
 *
 * This version is tolerant: if cfg (from getConfig) lacks endpoint or key,
 * it will fallback to environment variables (env.WORKERS_AI_ENDPOINT, env.WORKERS_AI_KEY, env.CF_API_TOKEN).
 * It logs debug info to the worker console (wrangler dev) about endpoint presence and TTS request failures.
 */

import { getConfig } from "./config.js";

export async function handleTalkRequest(request, env, ctx, cfg = null) {
    const config = cfg || getConfig(env);

    // merge env fallbacks
    const merged = Object.assign({}, config);
    if (!merged.WORKERS_AI_ENDPOINT && env.WORKERS_AI_ENDPOINT) merged.WORKERS_AI_ENDPOINT = env.WORKERS_AI_ENDPOINT;
    if (!merged.WORKERS_AI_KEY && env.WORKERS_AI_KEY) merged.WORKERS_AI_KEY = env.WORKERS_AI_KEY;
    if (!merged.CF_API_TOKEN && env.CF_API_TOKEN) merged.CF_API_TOKEN = env.CF_API_TOKEN;
    if (!merged.BR_API_TOKEN && env.BR_API_TOKEN) merged.BR_API_TOKEN = env.BR_API_TOKEN;

    // parse body
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return jsonError("invalid_json", 400);
    }

    const format = (body.format || "mp3").toLowerCase();
    let text = typeof body.text === "string" && body.text.trim() ? body.text.trim() : "";
    let extractedText = null;

    // If url provided and no direct text, extract via BR
    if (!text && body.url) {
        if (!isHttpUrl(body.url)) return jsonError("invalid_url", 400);
        try {
            const parsed = new URL(body.url);
            if (isIpAddress(parsed.hostname) && isPrivateIp(parsed.hostname)) {
                return jsonError("forbidden_target", 400);
            }
        } catch (e) {
            return jsonError("invalid_url", 400);
        }

        try {
            if (body.selector) {
                const brResp = await callBRWithConfig(merged, "scrape", { url: body.url, elements: [{ selector: String(body.selector) }] });
                extractedText = extractTextFromBrResult(brResp);
            } else {
                const brResp = await callBRWithConfig(merged, "content", { url: body.url });
                extractedText = extractTextFromBrResult(brResp);
            }
            if (extractedText) text = extractedText;
        } catch (e) {
            console.error("BR extraction failed", e);
            return jsonError("br_failed", 502);
        }
    }

    if (!text) return jsonError("no_text_provided", 400);

    // sanitize & cap
    text = sanitizeText(text);
    const MAX_CHARS = Number(merged.MAX_CHARS) || 8000;
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + "...";

    const voice = body.voice || "default";
    const key = await sha256Hex(`${voice}|${format}|${text}`);

    // check R2
    try {
        const head = await env.AUDIO_BUCKET.head(key).catch(() => null);
        if (head) {
            return jsonResponse({ key, extractedText }, 200);
        }
    } catch (e) {
        console.warn("R2 head check failed (continuing to generate):", e);
    }

    // debug log endpoint/token presence
    try {
        console.log("TTS debug: endpoint=", !!merged.WORKERS_AI_ENDPOINT ? merged.WORKERS_AI_ENDPOINT : "(none)");
        console.log("TTS debug: hasToken=", !!(merged.CF_API_TOKEN || merged.WORKERS_AI_KEY || merged.WORKERS_AI_KEY));
    } catch (e) { }

    // call TTS
    let audioBuffer;
    try {
        audioBuffer = await callTtsAndGetArrayBufferWithConfig(merged, { text, voice, format });
    } catch (e) {
        console.error("TTS call failed at handleTalkRequest:", e && e.message ? e.message : e);
        return jsonError("tts_failed", 502);
    }

    if (!audioBuffer || audioBuffer.byteLength === 0) {
        return jsonError("tts_no_audio", 502);
    }

    // store to R2
    try {
        await env.AUDIO_BUCKET.put(key, audioBuffer, {
            httpMetadata: { contentType: mimeForFormat(format) },
        });
    } catch (e) {
        console.error("R2 put failed, returning audio directly as fallback", e);
        return new Response(audioBuffer, {
            status: 200,
            headers: corsHeaders({ "Content-Type": mimeForFormat(format) }),
        });
    }

    return jsonResponse({ key, extractedText }, 200);
}

export async function serveAudioFromR2(key, env) {
    try {
        const obj = await env.AUDIO_BUCKET.get(key);
        if (!obj) return jsonError("not_found", 404);
        const contentType = (obj.httpMetadata && obj.httpMetadata.contentType) || "audio/mpeg";
        return new Response(obj.body, {
            status: 200,
            headers: corsHeaders({ "Content-Type": contentType }),
        });
    } catch (e) {
        console.error("serveAudioFromR2 error", e);
        return jsonError("r2_error", 500);
    }
}

// ----------------- BR / TTS callers -----------------
async function callBRWithConfig(cfg, action, payload) {
    const accountId = cfg.BR_ACCOUNT_ID || cfg.BR_ACCOUNT || "";
    const token = cfg.CF_API_TOKEN || cfg.BR_API_TOKEN || "";
    if (!accountId || !token) throw new Error("BR not configured");
    const brEndpoint = `${cfg.BR_API_BASE || "https://api.cloudflare.com/client/v4/accounts"}/${accountId}/browser-rendering/${action}`;

    const resp = await fetch(brEndpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!resp.ok) {
        const txt = await safeReadText(resp);
        console.error(`BR ${action} failed`, { status: resp.status, body: txt.slice(0, 2000) });
        throw new Error(`BR ${action} failed ${resp.status}`);
    }

    const ct = (resp.headers.get("Content-Type") || "").toLowerCase();
    if (ct.includes("application/json")) return await resp.json();
    return { result: await resp.text() };
}

/**
 * IMPORTANT CHANGE: use 'text' field (not 'input') because the Workers-AI /deepgram/aura-1
 * endpoint requires 'text' in the request body.
 */
async function callTtsAndGetArrayBufferWithConfig(cfg, { text, voice, format = "mp3" }) {
    const endpoint = cfg.WORKERS_AI_ENDPOINT || cfg.TTS_ENDPOINT || "";
    const token = cfg.CF_API_TOKEN || cfg.WORKERS_AI_KEY || cfg.TTS_KEY || "";
    if (!endpoint || !token) {
        console.error("TTS not configured: endpoint or token missing", { endpointPresent: !!endpoint, hasToken: !!token });
        throw new Error("TTS not configured");
    }

    // use 'text' property to match endpoint schema
    const payload = { text, voice, format };

    const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const respText = await safeReadText(resp);

    if (!resp.ok) {
        const headers = {};
        for (const [k, v] of resp.headers.entries()) headers[k] = v;
        console.error("TTS request failed", {
            status: resp.status,
            url: endpoint,
            headers,
            bodyPreview: respText.slice(0, 2000),
        });
        throw new Error(`TTS failed ${resp.status}: ${respText.slice(0, 1000)}`);
    }

    const ct = (resp.headers.get("Content-Type") || "").toLowerCase();
    if (ct.includes("application/json") || looksLikeJson(respText)) {
        let j = null;
        try {
            j = JSON.parse(respText);
        } catch (e) {
            console.warn("TTS returned JSON content type but parse failed; respText preview:", respText.slice(0, 1000));
            throw new Error("TTS returned unparsable JSON");
        }
        const b64 = j.audio_base64 || j.result || (j.data && j.data[0] && j.data[0].b64) || j.base64;
        if (!b64) {
            console.error("TTS JSON missing audio field", { jsonPreview: j });
            throw new Error("TTS JSON response missing audio field");
        }
        try {
            return base64ToArrayBuffer(b64);
        } catch (e) {
            console.error("base64 -> ArrayBuffer failed", e);
            throw new Error("TTS base64 decode failed");
        }
    } else {
        const cleaned = String(respText || "").replace(/\s+/g, '');
        if (isLikelyBase64(cleaned)) {
            try {
                return base64ToArrayBuffer(cleaned);
            } catch (e) {
                console.error("TTS returned base64-like text but decoding failed", e);
                throw new Error("TTS decode failed");
            }
        }
        console.warn("TTS returned non-json, non-base64 text; attempting re-fetch (debug)");
        const resp2 = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        if (!resp2.ok) {
            const t2 = await safeReadText(resp2);
            console.error("Second TTS fetch failed", { status: resp2.status, bodyPreview: t2.slice(0, 2000) });
            throw new Error(`TTS failed on re-fetch ${resp2.status}`);
        }
        try {
            return await resp2.arrayBuffer();
        } catch (e) {
            console.error("Second TTS fetch arrayBuffer failed", e);
            throw new Error("TTS binary fetch failed");
        }
    }
}

// ----------------- utilities & helpers -----------------
function mimeForFormat(format) {
    const f = String(format || "").toLowerCase();
    if (f === "mp3" || f === "mpeg") return "audio/mpeg";
    if (f === "wav") return "audio/wav";
    if (f === "ogg" || f === "opus") return "audio/ogg";
    return "application/octet-stream";
}

function jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: corsHeaders({ "Content-Type": "application/json" }) });
}
function jsonError(message, status = 400) {
    return new Response(JSON.stringify({ error: message, status }), { status, headers: corsHeaders({ "Content-Type": "application/json" }) });
}
function corsHeaders(extra = {}) {
    return Object.assign(
        {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        extra
    );
}

function sanitizeText(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
}

/*
  MODIFIED: improved extractTextFromBrResult
  - This version attempts to handle several BR response shapes:
    - brJson.result may be an array (common for scrape) containing items with `results: [{ text, html, ... }]`
    - brJson.result may be a string (HTML or plain) or an object with html/text/content fields
    - It prefers returning plain text (text field or stripped html) and falls back to JSON.stringify for debugging
  - We keep your original comments intact and only add the above clarifying comment block.
*/
function extractTextFromBrResult(brJson) {
    try {
        if (!brJson) return "";

        // helper: extract text from a single entry/object
        const extractFromEntry = (entry) => {
            if (!entry) return "";
            if (typeof entry === "string") {
                const s = entry.trim();
                if (s.startsWith("<")) return stripHtml(s);
                return s;
            }
            if (typeof entry === "object") {
                // direct common fields
                if (typeof entry.text === "string" && entry.text.trim()) return entry.text.trim();
                if (typeof entry.html === "string" && entry.html.trim()) return stripHtml(entry.html);
                if (typeof entry.content === "string" && entry.content.trim()) return stripHtml(entry.content);
                // nested result object
                if (entry.result) {
                    if (typeof entry.result === "string") {
                        const s = entry.result.trim();
                        if (s.startsWith("<")) return stripHtml(s);
                        return s;
                    }
                    if (typeof entry.result === "object") {
                        if (typeof entry.result.text === "string" && entry.result.text.trim()) return entry.result.text.trim();
                        if (typeof entry.result.html === "string" && entry.result.html.trim()) return stripHtml(entry.result.html);
                        if (typeof entry.result.content === "string" && entry.result.content.trim()) return stripHtml(entry.result.content);
                    }
                }
                // Browser Rendering 'results' array (e.g., scrape -> result: [{ results: [ ... ] }])
                if (Array.isArray(entry.results) && entry.results.length) {
                    for (const r of entry.results) {
                        const t = extractFromEntry(r);
                        if (t) return t;
                    }
                }
            }
            return "";
        };

        // Case: brJson.result is an array (common for scrape output)
        if (Array.isArray(brJson.result) && brJson.result.length) {
            for (const item of brJson.result) {
                // item may itself be an object with results[]
                const fromItem = extractFromEntry(item);
                if (fromItem) return fromItem;
                if (item && Array.isArray(item.results)) {
                    for (const r of item.results) {
                        const fr = extractFromEntry(r);
                        if (fr) return fr;
                    }
                }
            }
        }

        // Case: brJson.result is a string or object
        if (typeof brJson.result === "string") {
            const s = brJson.result.trim();
            if (s.startsWith("<")) return stripHtml(s);
            return s;
        }
        if (typeof brJson.result === "object" && brJson.result !== null) {
            if (typeof brJson.result.html === "string") return stripHtml(brJson.result.html);
            if (typeof brJson.result.text === "string") return brJson.result.text;
            if (typeof brJson.result.content === "string") return stripHtml(brJson.result.content);
            // handle nested result.results as fallback
            if (Array.isArray(brJson.result.results)) {
                for (const r of brJson.result.results) {
                    const t = extractFromEntry(r);
                    if (t) return t;
                }
            }
        }

        // Fallback: check top-level html/text/content
        if (typeof brJson.html === "string") return stripHtml(brJson.html);
        if (typeof brJson.text === "string") return brJson.text;
        if (typeof brJson.content === "string") return stripHtml(brJson.content);

        // last resort: return JSON string for debugging
        return JSON.stringify(brJson);
    } catch (e) {
        console.error("extractTextFromBrResult err", e);
        return "";
    }
}

function stripHtml(html) {
    const noTags = String(html)
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<\/?[^>]+>/g, " ");
    const collapsed = noTags.replace(/\s+/g, " ").trim();
    return collapsed.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function isHttpUrl(s) {
    try {
        const p = new URL(s);
        return p.protocol === "http:" || p.protocol === "https:";
    } catch {
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

async function sha256Hex(input) {
    const enc = new TextEncoder();
    const data = enc.encode(String(input));
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64ToArrayBuffer(b64) {
    const cleaned = String(b64).replace(/\s+/g, "");
    const binary = atob(cleaned);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

// safeReadText: read resp as text or binary-to-base64 string for debugging.
async function safeReadText(resp) {
    try {
        const ct = (resp.headers.get("Content-Type") || "").toLowerCase();
        if (ct.includes("application/json") || ct.includes("text/") || ct.includes("application/")) {
            const t = await resp.clone().text();
            return t;
        } else {
            const ab = await resp.clone().arrayBuffer();
            let binary = "";
            const bytes = new Uint8Array(ab);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }
    } catch (e) {
        console.warn("safeReadText failed", e);
        return "";
    }
}