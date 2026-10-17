import { Redis } from "@upstash/redis";
import webpush from "web-push";

function hit(alert, price) {
  if (alert.type === "below") return price <= alert.value;
  if (alert.type === "above") return price >= alert.value;
  if (alert.type === "move-down") return price <= alert.base * (1 - alert.value / 100);
  if (alert.type === "move-up") return price >= alert.base * (1 + alert.value / 100);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : req.headers["x-cron-secret"];
  if (!expected || !supplied || supplied !== expected) return res.status(401).json({ error: "Unauthorized scheduler request." });
  const required = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
  if (required.some(key => !process.env[key])) return res.status(503).json({ error: "Push backend environment is incomplete." });

  try {
    const redis = Redis.fromEnv();
    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const ids = await redis.smembers("hfm:clients");
    let checked = 0, sent = 0, failed = 0;
    for (const id of ids) {
      const raw = await redis.get(`hfm:user:${id}`);
      if (!raw) continue;
      const user = typeof raw === "string" ? JSON.parse(raw) : raw;
      const active = (user.alerts || []).filter(a => a.active);
      if (!active.length || !user.subscription) continue;
      const symbols = [...new Set(active.map(a => a.symbol))];
      const query = encodeURIComponent(JSON.stringify(symbols));
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${query}`);
      if (!response.ok) { failed++; continue; }
      const rows = await response.json();
      const prices = Object.fromEntries(rows.map(row => [row.symbol, Number(row.price)]));
      let changed = false;
      let subscriptionExpired = false;
      for (const alert of active) {
        checked++;
        const price = prices[alert.symbol];
        if (!Number.isFinite(price) || !hit(alert, price)) continue;
        const payload = JSON.stringify({
          title: `Halal Finance alert: ${alert.symbol}`,
          body: `Price ${price} reached your configured condition. Review the market manually; no trade was placed.`,
          tag: `hfm-${alert.id}`
        });
        try {
          await webpush.sendNotification(user.subscription, payload, { TTL: 60 });
          sent++;
        } catch (error) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await redis.del(`hfm:user:${id}`);
            await redis.srem("hfm:clients", id);
            subscriptionExpired = true;
            break;
          }
          failed++;
          console.error("push delivery failed", error?.statusCode || error?.message);
          continue;
        }
        alert.active = false;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = price;
        changed = true;
      }
      if (changed && !subscriptionExpired) await redis.set(`hfm:user:${id}`, JSON.stringify(user));
    }
    return res.status(200).json({ ok: true, users: ids.length, alertsChecked: checked, pushesSent: sent, failures: failed });
  } catch (error) {
    console.error("alert monitor failed", error?.message);
    return res.status(500).json({ error: "Alert monitoring failed." });
  }
}
