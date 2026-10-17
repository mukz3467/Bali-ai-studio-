export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.VAPID_PUBLIC_KEY;
  const missing = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "CRON_SECRET"].filter(name => !process.env[name]);
  if (missing.length) return res.status(503).json({ error: "Push backend is not fully configured.", missing });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ publicKey: key });
}
