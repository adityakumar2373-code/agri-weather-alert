const CACHE_NAME = 'agri-alert-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/js/app.js',
    '/js/translations.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install and save the app to the phone
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Serve from memory if offline
self.addEventListener('fetch', (event) => {
    // Ignore external APIs, only save the UI
    if (event.request.url.includes('api.open-meteo') || event.request.url.includes('render.com')) return;
    
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});