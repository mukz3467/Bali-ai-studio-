self.addEventListener("push", event => {
  let data = { title: "Halal Finance Manager", body: "A market alert is ready. Review the market manually." };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: data.tag || "hfm-market-alert",
    data: { url: self.location.origin + self.registration.scope }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if ("focus" in client) { await client.focus(); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
