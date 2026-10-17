import { Redis } from "@upstash/redis";

function jsonBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function validSymbol(value) { return typeof value === "string" && /^[A-Z0-9]{3,20}USDT$/.test(value); }
function validPushEndpoint(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "fcm.googleapis.com" || host.endsWith(".fcm.googleapis.com") ||
      host === "push.services.mozilla.com" || host.endsWith(".push.services.mozilla.com") ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" || host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com");
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!sameOrigin(req)) return res.status(403).json({ error: "Cross-origin request rejected." });
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({ error: "Push storage is not configured yet." });
  }
  let body;
  try { body = jsonBody(req); } catch { return res.status(400).json({ error: "Invalid JSON." }); }
  const { clientId, subscription, coins, alerts } = body;
  if (typeof clientId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(clientId)) return res.status(400).json({ error: "Invalid client ID." });
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://") || !validPushEndpoint(subscription.endpoint) || !subscription.keys?.p256dh || !subscription.keys?.auth) return res.status(400).json({ error: "Invalid push subscription." });
  if (!Array.isArray(coins) || coins.length > 25 || !coins.every(c => validSymbol(c?.symbol) && c?.reviewConfirmed === true)) return res.status(400).json({ error: "Invalid reviewed-asset list." });
  if (!Array.isArray(alerts) || alerts.length > 100 || !alerts.every(a =>
    typeof a?.id === "string" && validSymbol(a?.symbol) &&
    ["below", "above", "move-down", "move-up"].includes(a?.type) &&
    Number.isFinite(Number(a?.value)) && Number(a.value) > 0 &&
    Number.isFinite(Number(a?.base)) && Number(a.base) > 0 &&
    typeof a?.active === "boolean" && coins.some(c => c.symbol === a.symbol)
  )) return res.status(400).json({ error: "Invalid alert rules." });

  try {
    const redis = Redis.fromEnv();
    const priorRaw = await redis.get(`hfm:user:${clientId}`);
    const prior = priorRaw ? (typeof priorRaw === "string" ? JSON.parse(priorRaw) : priorRaw) : null;
    const priorAlerts = new Map((prior?.alerts || []).map(a => [a.id, a]));
    const mergedAlerts = alerts.map(a => {
      const previous = priorAlerts.get(a.id);
      // Keep server-triggered alerts inactive when a browser reconnects with stale localStorage.
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
      alerts: record.alerts.map(a => ({ id: a.id, active: a.active, triggeredAt: a.triggeredAt || null, triggeredPrice: a.triggeredPrice || null }))
    });
  } catch (error) {
    console.error("push subscription storage failed", error?.message);
    return res.status(500).json({ error: "Could not save push settings." });
  }
}
