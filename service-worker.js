const CACHE_NAME = "fishing-pwa-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/fishing.html",
  "/js/main.js",
  "/js/firebase.js",
  "/js/login.js",
  "/css/main.css",
  "/manifest.json",
  "/images-webp/index/index3.webp",
  "/images-webp/maps/map2.webp",
  "/images-webp/maps/map3.webp",
  "/images-webp/icons/icon-192-v2.webp",
  "/images-webp/icons/icon-512-v2.webp",
  "/images-webp/shop/chest1.webp",
  "/images-webp/shop/chest2.webp",
  "/images-webp/index/chest2.gif",
  "/images-webp/shop/ticket1.webp",
  "/images-webp/shop/ticket2.webp",
  "/sound/map1.mp3",
  "/images-webp/index/index5.webp",
  "/images-webp/index/index7.webp",
  "/images-webp/index/refff.gif",
  "/images-webp/index/search.webp",
  "/images-webp/index/shop.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});
