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
  "/images/index/index3.jpg",
  "/images/maps/map2.jpg",
  "/images/maps/map3.jpg",
  "/images/icons/icon-192-v2.png",
  "/images/icons/icon-512-v2.png",
  "/images/shop/chest1.png",
  "/images/shop/chest2.png",
  "/images/index/chest2.gif",
  "/images/shop/ticket1.png",
  "/images/shop/ticket2.png",
  "/sound/map1.mp3"
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
