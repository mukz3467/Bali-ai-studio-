import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

function jsonBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  // This endpoint is used by the web app; reject requests with no browser origin.
  if (typeof origin !== "string" || typeof req.headers.host !== "string") return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.host.toLowerCase() === req.headers.host.toLowerCase();
  } catch { return false; }
}
function validSymbol(value) { return typeof value === "string" && /^[A-Z0-9]{3,20}USDT$/.test(value); }
function validPushEndpoint(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (
      host === "fcm.googleapis.com" || host.endsWith(".fcm.googleapis.com") ||
      host === "push.services.mozilla.com" || host.endsWith(".push.services.mozilla.com") ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" || host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com")
    );
  } catch { return false; }
}
function validSubscription(subscription) {
  return !!subscription &&
    typeof subscription.endpoint === "string" &&
    subscription.endpoint.length <= 2048 &&
    validPushEndpoint(subscription.endpoint) &&
    typeof subscription.keys?.p256dh === "string" &&
    subscription.keys.p256dh.length >= 20 && subscription.keys.p256dh.length <= 200 &&
    typeof subscription.keys?.auth === "string" &&
    subscription.keys.auth.length >= 10 && subscription.keys.auth.length <= 100;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!sameOrigin(req)) return res.status(403).json({ error: "Same-origin browser request required." });
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({ error: "Push storage is not configured yet." });
  }

  let body;
  try { body = jsonBody(req); } catch { return res.status(400).json({ error: "Invalid JSON." }); }
  const { clientId, subscription, coins, alerts } = body;
  if (typeof clientId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(clientId)) {
    return res.status(400).json({ error: "Invalid client ID." });
  }
  if (!validSubscription(subscription)) return res.status(400).json({ error: "Invalid push subscription." });
  if (!Array.isArray(coins) || coins.length > 25 ||
      !coins.every(c => validSymbol(c?.symbol) && c?.reviewConfirmed === true) ||
      new Set(coins.map(c => c.symbol)).size !== coins.length) {
    return res.status(400).json({ error: "Invalid reviewed-asset list." });
  }
  if (!Array.isArray(alerts) || alerts.length > 100 || !alerts.every(a =>
    typeof a?.id === "string" && a.id.length >= 1 && a.id.length <= 64 &&
    validSymbol(a?.symbol) &&
    ["below", "above", "move-down", "move-up"].includes(a?.type) &&
    Number.isFinite(Number(a?.value)) && Number(a.value) > 0 && Number(a.value) <= 1e15 &&
    Number.isFinite(Number(a?.base)) && Number(a.base) > 0 && Number(a.base) <= 1e15 &&
    typeof a?.active === "boolean" && coins.some(c => c.symbol === a.symbol)
  ) || new Set(alerts.map(a => a?.id)).size !== alerts.length) {
    return res.status(400).json({ error: "Invalid alert rules." });
  }

  try {
    const redis = Redis.fromEnv();

    // Limit valid writes per client IP to reduce accidental or abusive Redis growth.
    // Hash the address rather than storing it directly.
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") ||
      req.socket?.remoteAddress || "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const rateKey = `hfm:ratelimit:subscribe:${ipHash}`;
    const count = await redis.incr(rateKey);
    if (count === 1) await redis.expire(rateKey, 60);
    if (count > 30) return res.status(429).json({ error: "Too many push updates. Try again in a minute." });

    const priorRaw = await redis.get(`hfm:user:${clientId}`);
    const prior = priorRaw ? (typeof priorRaw === "string" ? JSON.parse(priorRaw) : priorRaw) : null;
    const priorAlerts = new Map((prior?.alerts || []).map(a => [a.id, a]));
    const mergedAlerts = alerts.map(a => {
      const previous = priorAlerts.get(a.id);
      // Preserve a server-triggered alert's inactive state when the browser reconnects with stale localStorage.
      if (previous && previous.active === false && a.active === true && previous.triggeredAt) {
        return { ...a, active: false, triggeredAt: previous.triggeredAt, triggeredPrice: previous.triggeredPrice };
      }
      return { ...a, active: a.active };
    });
    const record = {
      clientId,
      subscription,
      coins: coins.map(c => ({ symbol: c.symbol, reviewConfirmed: true })),
      alerts: mergedAlerts,
      updatedAt: new Date().toISOString()
    };
    await redis.set(`hfm:user:${clientId}`, JSON.stringify(record));
    await redis.sadd("hfm:clients", clientId);
    return res.status(200).json({
      ok: true,
      message: "Push subscription and active alerts synced.",
      alerts: record.alerts.map(a => ({
        id: a.id, active: a.active,
        triggeredAt: a.triggeredAt || null,
        triggeredPrice: a.triggeredPrice || null
      }))
    });
  } catch (error) {
    console.error("push subscription storage failed", error?.message);
    return res.status(500).json({ error: "Could not save push settings." });
  }
}
