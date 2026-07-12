// オフライン対応は「案内ページを出す」まで。
// データのオフライン閲覧・登録（キャッシュ／キュー同期）は未対応。
//
// 静的アセット（/_next/static/ 配下）はファイル名に内容ハッシュが入っており
// 中身が変わらないため、cache-firstで配信して2回目以降のJS/CSSダウンロードを
// なくす。HTML（navigate）は常にネットワークなので、デプロイ後に古い画面が
// 表示され続けることはない（古いHTMLが参照する旧アセットもハッシュ名で共存できる）。
const OFFLINE_CACHE = "mellow-offline-v1";
const STATIC_CACHE = "mellow-static-v1";
const OFFLINE_PAGE = "/offline.html";
// 数デプロイ分のアセットを保持できる上限。超えた分は古い順に削除する。
const STATIC_CACHE_MAX_ENTRIES = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_PAGE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== OFFLINE_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

const isStaticAsset = (request) => {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
};

// CacheStorageのkeys()は追加順を保つため、先頭から消せば古い順になる
const pruneStaticCache = async (cache) => {
  const keys = await cache.keys();
  if (keys.length <= STATIC_CACHE_MAX_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - STATIC_CACHE_MAX_ENTRIES).map((key) => cache.delete(key)));
};

const staticAssetResponse = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await pruneStaticCache(cache);
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)));
    return;
  }
  if (isStaticAsset(event.request)) {
    event.respondWith(staticAssetResponse(event.request));
  }
});
