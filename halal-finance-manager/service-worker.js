self.addEventListener("push", event => {
  let data = { title: "Halal Finance Manager", body: "A market alert is ready. Review the market manually." };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil((async () => {
    await self.registration.showNotification(data.title, {
      body: data.body,
      icon: new URL("icon.svg", self.registration.scope).href,
      badge: new URL("icon.svg", self.registration.scope).href,
      tag: data.tag || "hfm-market-alert",
      data: { url: self.registration.scope }
    });
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: "HFM_PUSH_ALERT", tag: data.tag || "" });
  })());
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
