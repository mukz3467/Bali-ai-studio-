export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");
  const storageConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const vapidConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  const schedulerConfigured = Boolean(process.env.CRON_SECRET);
  return res.status(200).json({
    ready: storageConfigured && vapidConfigured && schedulerConfigured,
    storageConfigured,
    vapidConfigured,
    schedulerConfigured
  });
}
