/* eslint-disable no-undef */
const CACHE_NAME = 'portfolio-tracker-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((err) => {
        console.log('Cache addAll error:', err);
      });
    })
  );
  self.skipWaiting(); // Activate new service worker immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Claim clients immediately
});

// Fetch event - Network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 🚀 DO NOT CACHE API REQUESTS - Ensure data is always fresh
  if (url.pathname.startsWith('/api/') || url.port === '3001') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Use Network-First strategy for everything else (HTML, JS, CSS)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If successful response, cache it and return
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails (offline), try to return from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If neither network nor cache works
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return new Response('Offline - please check your connection', {
              headers: { 'Content-Type': 'text/html' }
            });
          }
          
          // Return a 503 Service Unavailable or generic error Response for other types (JSON, images, etc.)
          return new Response(JSON.stringify({ error: 'Offline and no cached version available' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push event - handle incoming notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      let data;
      try {
        data = event.data.json();
      } catch (e) {
        // Fallback for plain text payloads
        data = {
          title: 'Portfolio Update',
          body: event.data.text()
        };
      }

      const options = {
        body: data.body || 'New update available',
        icon: data.icon || '/mainphoto.png',
        badge: data.badge || '/logo192.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.data?.url || '/'
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'Portfolio Update', options)
      );
    } catch (e) {
      console.error('Error handling push event:', e);
    }
  }
});

// Notification click event - open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data.url || '/';
      
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
