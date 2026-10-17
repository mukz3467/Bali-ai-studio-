export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).send("Method not allowed");
  const raw = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
  if (!raw || !/^https:\/\//i.test(raw)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("Set SITE_URL to the final production HTTPS origin to enable the sitemap.\n");
  }
  let site;
  try { site = new URL(raw); } catch {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("SITE_URL is invalid.\n");
  }
  if (site.pathname !== "/" || site.search || site.hash || site.username || site.password) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("SITE_URL must be an origin only, without a path, query, or fragment.\n");
  }
  const origin = site.origin;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${origin}/</loc></url>\n` +
    `</urlset>\n`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(xml);
}
