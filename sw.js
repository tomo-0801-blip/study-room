// 自分の勉強部屋：オフラインでも画面が開けるように、アプリの外枠を保存しておく
const CACHE = "study-room-v17";
const SHELL = ["./", "index.html", "shim.js", "presets.js", "blogrender.js", "atlas.js", "blog.html", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png",
  "img/bg.jpg", "img/papers.jpg", "img/basics.jpg", "img/summaries.jpg", "img/materials.jpg", "img/quiz.jpg",
  "img/papers-icon.jpg", "img/basics-icon.jpg", "img/summaries-icon.jpg", "img/materials-icon.jpg", "img/quiz-icon.jpg", "img/memo.jpg", "img/memo-icon.jpg", "img/books.jpg", "img/books-icon.jpg", "img/blog.jpg", "img/blog-icon.jpg", "img/guide-wave.png", "img/guide-good.png", "img/guide-oops.png", "img/guide-think.png", "img/guide-read.png", "img/guide-scheme.png", "img/guide-pilates.png", "img/guide-face.png", "textbook.json"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Supabase やAIは常にネットへ
  // 画面と設定は「まずネット、だめなら保存分」、画像は「まず保存分」
  const isAsset = /\/(img|icons)\//.test(u.pathname);
  if (isAsset) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
  } else {
    e.respondWith(fetch(e.request.url, { cache: "no-cache" }).then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
  }
});
