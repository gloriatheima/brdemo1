// src/config.js
// 统一配置读取：优先解析单个合并的 secret CONFIG_SECRET（或 CONFIG），回退到单独 env 变量。
// 返回一个简单对象 cfg，包含 CF_API_TOKEN, BR_ACCOUNT_ID, WORKERS_AI_ENDPOINT, BR_API_BASE 等。

export function getConfig(env = {}) {
    let cfg = {};
    try {
        // 支持两种 secret 名称：CONFIG_SECRET 或 CONFIG（兼容）
        const raw = env.CONFIG_SECRET || env.CONFIG || "";
        if (raw) {
            // 有时 wrangler secret 会以字符串形式注入（已序列化 JSON）
            // 如果 raw 看起来像 JSON 则 parse，否则保留 {}
            if (typeof raw === "string" && raw.trim().startsWith("{")) {
                cfg = JSON.parse(raw);
            }
        }
    } catch (e) {
        // 解析失败时降级为使用 individual env values
        console.warn("CONFIG_SECRET parse failed, falling back to individual env vars:", e);
        cfg = {};
    }

    // 支持：把单个 Cloudflare token 放在 CF_API_TOKEN 字段，或单独字段回退
    cfg.CF_API_TOKEN = cfg.CF_API_TOKEN || env.CF_API_TOKEN || env.BR_API_TOKEN || env.WORKERS_AI_KEY || "";
    cfg.BR_ACCOUNT_ID = cfg.BR_ACCOUNT_ID || env.BR_ACCOUNT_ID || "";
    cfg.WORKERS_AI_ENDPOINT = cfg.WORKERS_AI_ENDPOINT || env.WORKERS_AI_ENDPOINT || "";
    cfg.BR_API_BASE = cfg.BR_API_BASE || env.BR_API_BASE || "https://api.cloudflare.com/client/v4/accounts";

    // Optional extras (LLM / R2 / DO names)
    cfg.LLM_ENDPOINT = cfg.LLM_ENDPOINT || env.LLM_ENDPOINT || "";
    cfg.LLM_KEY = cfg.LLM_KEY || env.LLM_KEY || "";
    cfg.R2_BUCKET = cfg.R2_BUCKET || env.R2_BUCKET || env.AUDIO_BUCKET || ""; // not strictly necessary
    cfg.ALLOWED_ORIGINS = Array.isArray(cfg.ALLOWED_ORIGINS) ? cfg.ALLOWED_ORIGINS : (cfg.ALLOWED_ORIGINS ? [cfg.ALLOWED_ORIGINS] : []);

    return cfg;
}