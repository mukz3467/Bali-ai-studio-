export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");
  const raw = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
  if (!raw || !/^https:\/\//i.test(raw)) return res.status(200).json({ siteUrl: null });
  try {
    const site = new URL(raw);
    if (site.pathname !== "/" || site.search || site.hash || site.username || site.password) {
      return res.status(200).json({ siteUrl: null });
    }
    return res.status(200).json({ siteUrl: site.origin });
  } catch {
    return res.status(200).json({ siteUrl: null });
  }
}
