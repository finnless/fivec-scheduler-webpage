// On install, cache everything
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('v1').then((cache) => {
            return cache.addAll([
                'index.html',
                'css/main.css',
                'css/sweetalert2.min.css',
                'scripts/app.js',
                'scripts/constructors.js',
                'scripts/data.js',
                'scripts/prelude.js',
                'scripts/startup.js',
                'scripts/utils.js',
                'scripts/libs/fuse.js',
                'scripts/libs/localforage.min.js',
                'scripts/libs/qrcodegen-v1.7.0-es6.js',
                'scripts/libs/rasterizeHTML.allinone.js',
                'scripts/libs/sweetalert2.min.js',
                'img/delete.png',
                'img/merge.png',
                'img/favicon.png',
                'android-chrome-192x192.png',
                'android-chrome-512x512.png',
                'apple-touch-icon.png',
                'browserconfig.xml',
                'favicon-16x16.png',
                'favicon-32x32.png',
                'favicon.ico',
                'mstile-150x150.png',
                'safari-pinned-tab.svg',
                'site.webmanifest',
                'sw.js',
            ]);
        })
    );
});

// Catch and intercept all fetch requests
// and service them with the SW
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((resp) => {
            return resp || fetch(event.request).then((response) => {
                let responseClone = response.clone();
                caches.open('v1').then((cache) => {
                    cache.put(event.request, responseClone);
                });

                return response;
            }).catch(() => {
                return caches.match('favicon-32x32.png');
            })
        })
    );
});

self.addEventListener('activate', (event) => {
    var cacheKeeplist = ['v1'];

    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (cacheKeeplist.indexOf(key) === -1) {
                    return caches.delete(key);
                }
            }));
        })
    );
});