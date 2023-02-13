const putInCache = async (request, response) => {
	const cache = await caches.open('v1')
	await cache.put(request, response)
}

const askNetwork = async (request) => {
	const responseFromNetwork = await fetch(request)
	putInCache(request, responseFromNetwork.clone())
	return responseFromNetwork
}

const cacheFirst = async (request) => {
	const responseFromCache = await caches.match(request)
	if (responseFromCache) {
		askNetwork(request)
		return responseFromCache
	}
	return askNetwork(request)
}

self.addEventListener('install', (event) => {
	console.log('installed', event)
})

self.addEventListener('fetch', (event) => {
	const result = cacheFirst(event.request)
	event.respondWith(result)
})
