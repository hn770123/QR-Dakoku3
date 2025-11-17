/**
 * Service Worker for PWA
 * Stale-While-Revalidate戦略を実装してオフライン動作を可能にする
 */

const CACHE_NAME = 'qr-dakoku-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/qr-generator.js',
  '/test.html',
  '/test.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jose@5.2.0/+esm'
];

/**
 * Service Workerのインストール時の処理
 * 必要なリソースをキャッシュに追加
 */
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
      .catch(error => {
        console.error('[Service Worker] Cache failed:', error);
      })
  );
  self.skipWaiting();
});

/**
 * Service Workerのアクティベーション時の処理
 * 古いキャッシュを削除
 */
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

/**
 * Fetch時の処理
 * Stale-While-Revalidate戦略を実装
 * キャッシュがあればすぐに返し、バックグラウンドで更新
 */
self.addEventListener('fetch', event => {
  // POSTリクエストなどはキャッシュしない
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        // キャッシュされたレスポンスを返す前に、バックグラウンドで更新
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // 成功したレスポンスのみキャッシュを更新
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(error => {
          console.log('[Service Worker] Fetch failed:', error);
          // ネットワークエラーの場合、キャッシュがあればそれを返す
          return cachedResponse;
        });

        // キャッシュがあればすぐに返す（Stale）
        // なければネットワークのレスポンスを待つ
        return cachedResponse || fetchPromise;
      });
    })
  );
});

/**
 * メッセージハンドラ
 * クライアントからのメッセージを処理
 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
