// Service worker: only shows the notifications the site sends (Web Push) to
// the committee's phones — see src/lib/avisos.ts. It caches nothing, so the
// site works exactly the same with or without it.

self.addEventListener('push', (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { texto: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(aviso.titulo || 'Turma 32', {
      body: aviso.texto || '',
      icon: '/icone-180.png',
      data: { url: aviso.url || '/' },
    }),
  );
});

// Tapping the notification opens the page it's about (or brings it forward).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url === url);
      return aberta ? aberta.focus() : self.clients.openWindow(url);
    }),
  );
});
