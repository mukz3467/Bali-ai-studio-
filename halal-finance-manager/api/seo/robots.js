export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).send("Method not allowed");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  const siteUrl = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
  const lines = ["User-agent: *", "Allow: /"];
  if (siteUrl && /^https:\/\//i.test(siteUrl)) lines.push("", `Sitemap: ${siteUrl}/sitemap.xml`);
  return res.status(200).send(lines.join("\n") + "\n");
}
