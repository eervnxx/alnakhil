const CACHE_NAME = 'nakhil-cache-v1';
const urlsToCache = [
  '/h/',
  '/h/index.html',
  '/h/manifest.json',
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

// تثبيت Service Worker وتخزين الملفات
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ تم فتح الكاش وإضافة الملفات');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('❌ خطأ في التخزين المؤقت:', error);
      })
  );
  self.skipWaiting();
});

// تفعيل Service Worker وتنظيف الكاش القديم
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

// استراتيجية الجلب: Network First ثم Cache
self.addEventListener('fetch', event => {
  // تجاهل طلبات chrome-extension
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // تجاهل طلبات Firebase التي تحتاج اتصال مباشر
  if (event.request.url.includes('firebase')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(response => {
            // التحقق من صحة الرد
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // تخزين الملفات الجديدة في الكاش
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.log('❌ فشل الجلب، استخدام الكاش:', event.request.url);
            
            // محاولة إرجاع صفحة الخطأ المخصصة إذا كانت متوفرة
            if (event.request.mode === 'navigate') {
              return caches.match('/h/offline.html');
            }
            
            return new Response('أنت غير متصل بالإنترنت', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain; charset=utf-8'
              })
            });
          });
      })
  );
});

// التعامل مع الإشعارات الفورية (اختياري)
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: '/h/icons/icon-192x192.png',
    badge: '/h/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    dir: 'rtl',
    lang: 'ar',
    tag: 'nakhil-notification',
    renotify: true,
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('قاعة النخيل للمناسبات', options)
  );
});

// التعامل مع النقر على الإشعارات
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/h/')
    );
  }
});

// تحديث دوري للكاش (كل 24 ساعة)
self.addEventListener('sync', event => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = urlsToCache.map(url => new Request(url));
  
  try {
    await cache.addAll(requests);
    console.log('✅ تم تحديث الكاش بنجاح');
  } catch (error) {
    console.error('❌ فشل تحديث الكاش:', error);
  }
}