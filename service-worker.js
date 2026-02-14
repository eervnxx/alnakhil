const CACHE_NAME = 'nakhil-dynamic-v2';
const urlsToCache = [
  '/h/',
  '/h/index.html',
  '/h/manifest.json',
  '/h/offline.html',
  '/h/icons/icon-72x72.png',
  '/h/icons/icon-96x96.png',
  '/h/icons/icon-128x128.png',
  '/h/icons/icon-144x144.png',
  '/h/icons/icon-152x152.png',
  '/h/icons/icon-192x192.png',
  '/h/icons/icon-384x384.png',
  '/h/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js'
];

// تخزين الملفات الثابتة
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ تم تخزين الملفات الثابتة');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// تنظيف الكاش القديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ حذف الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// استراتيجية: Network First ثم Cache لطلبات API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // لطلبات Firebase API - نحاول الشبكة أولاً
  if (url.hostname.includes('firebase') || url.pathname.includes('firestore')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          return response;
        })
        .catch(() => {
          // إذا فشلت الشبكة، نعيد رد فارغ مع إشارة أننا أوفلاين
          return new Response(JSON.stringify({ offline: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // للملفات الثابتة - Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(response => {
            // تخزين الملفات الجديدة
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // إذا كان طلب صفحة ولم نجدها في الكاش
            if (event.request.mode === 'navigate') {
              return caches.match('/h/offline.html');
            }
            return new Response('لا يوجد اتصال بالإنترنت', {
              status: 503,
              statusText: 'Offline'
            });
          });
      })
  );
});

// الاستماع لأحداث المزامنة الخلفية
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reservations') {
    event.waitUntil(syncReservations());
  }
});

// مزامنة الحجوزات المخزنة محلياً مع Firebase
async function syncReservations() {
  try {
    const cache = await caches.open('pending-reservations');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const cachedResponse = await cache.match(request);
        const reservationData = await cachedResponse.json();
        
        // محاولة إرسال الحجز إلى Firebase
        const response = await fetch(request, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reservationData)
        });
        
        if (response.ok) {
          // إذا نجح الإرسال، نحذف من الكاش المؤقت
          await cache.delete(request);
          console.log('✅ تم مزامنة حجز:', reservationData);
        }
      } catch (error) {
        console.log('❌ فشل مزامنة حجز:', error);
      }
    }
  } catch (error) {
    console.log('❌ خطأ في المزامنة:', error);
  }
}
