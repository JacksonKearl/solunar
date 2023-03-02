import { StationLevelAtTime } from '$/tideForTime'
import { Disposable, Station } from '$/types'
import { $, a, clearElement } from './utils'
import {
	DisposableStore,
	LocalStorageState,
	MappedView,
	Observable,
	time,
	View,
} from '$/utils'
import type { GeoJSONSource, LngLatLike, MapMouseEvent } from 'maplibre-gl'
import type { Point, Feature, Geometry, GeoJsonProperties } from 'geojson'
import { TideOScope } from './components/TideOScope'
import { setupCanvas } from './components/CanvasElement'

const GetStationsAsGeoJSON = (time: number) => ({
	type: 'FeatureCollection',
	crs: { type: 'name', properties: { name: 'All Stations with Tide' } },
	features: Object.values(stations).map((s: Station) => {
		const tide = StationLevelAtTime(s, time, false)
		return {
			type: 'Feature',
			properties: {
				id: s.id,
				name: s.name,
				tide: tide.total,
				norm:
					'MHHW' in s.datums
						? tide.total / (s.datums.MHHW - s.datums.MLLW)
						: null,
			},
			geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
		}
	}),
})

export const SelectStationId = () =>
	new Promise<string>((resolve) => {
		const disposables = new DisposableStore()

		const mapContainer = document.getElementById('map-container')!
		while (mapContainer.firstChild)
			mapContainer.removeChild(mapContainer.firstChild)

		const container = mapContainer.appendChild(document.createElement('div'))
		container.id = 'map'

		const overlay = MakeOverlay()
		disposables.add(overlay)

		mapContainer.appendChild(overlay.element)
		mapContainer.appendChild(
			a(
				$('img#jeff', { src: './jeff.jpg' }),
				'https://www.instagram.com/jeffersonstatepublicworks/',
			),
		)

		const mapState = new LocalStorageState('mapState', {
			zoom: 5,
			center: [-120, 40],
		})

		const basemapEnum = 'ArcGIS:Oceans'
		const map = new maplibregl.Map({
			container,
			style: `https://basemaps-api.arcgis.com/arcgis/rest/services/styles/${basemapEnum}?type=style&token=__rollup_ARCGIS_KEY`,
			center: mapState.value.center as any,
			zoom: mapState.value.zoom,
		})

		map.on('move', () => {
			mapState.value = {
				zoom: map.getZoom(),
				center: map.getCenter().toArray(),
			}
		})

		map.addControl(
			new maplibregl.GeolocateControl({
				fitBoundsOptions: { maxZoom: 10 },
				showUserLocation: false,
			}),
		)

		map.on('load', () => {
			map.removeLayer('Ocean point/Depth')

			const data = GetStationsAsGeoJSON(Date.now())

			map.addSource('stations', {
				type: 'geojson',
				data,
				cluster: true,
				clusterMaxZoom: 8,
				clusterRadius: 5,
				clusterProperties: {
					max: [
						'max',
						['case', ['==', ['get', 'norm'], null], -Infinity, ['get', 'norm']],
					],
					min: [
						'min',
						['case', ['==', ['get', 'norm'], null], +Infinity, ['get', 'norm']],
					],
				},
			})
			const stationSource = map.getSource('stations') as GeoJSONSource

			disposables.add(
				overlay.center((offset) => {
					if (document.location.hash) overlay.dispose()
					const data = time(() => GetStationsAsGeoJSON(offset + Date.now()))
					stationSource.setData(data as any)
				}),
			)

			const colorOrFallback = (src: string, def: any) =>
				[
					'case',
					['==', ['get', src], def],
					['rgba', 128, 128, 128, 0.5],
					[
						'interpolate-lab',
						['linear'],
						['get', src],
						-0.75,
						['rgba', 138, 43, 226, 0.9],
						+0.75,
						['rgba', 255, 215, 0, 0.9],
					],
				] as any

			const clusterSize = [
				'step',
				['get', 'point_count'],
				4,
				5,
				6,
				50,
				8,
			] as any

			map.addLayer({
				id: 'clusters',
				type: 'circle',
				source: 'stations',
				filter: ['has', 'point_count'],
				paint: {
					// https://maplibre.org/maplibre-gl-js-docs/style-spec/expressions/
					'circle-color': colorOrFallback('max', -Infinity),
					'circle-stroke-color': colorOrFallback('min', +Infinity),

					'circle-radius': clusterSize,
					'circle-stroke-width': clusterSize,
				},
			})

			map.addLayer({
				id: 'unclustered-point',
				type: 'circle',
				source: 'stations',
				filter: ['!', ['has', 'point_count']],
				paint: {
					'circle-color': colorOrFallback('norm', null),
					'circle-radius': [
						'interpolate',
						['linear'],
						['zoom'],
						5,
						8,
						7,
						6,
						12,
						40,
					],
				},
			})

			// inspect a cluster on click
			map.on('click', 'clusters', (e) => {
				const features = map.queryRenderedFeatures(e.point, {
					layers: ['clusters'],
				})[0]

				const geometry = features?.geometry as Point
				const coordinates = geometry?.coordinates.slice() as LngLatLike &
					number[]

				const clusterId = features.properties.cluster_id
				stationSource.getClusterExpansionZoom(clusterId, (err, zoom: any) => {
					if (err) return

					map.easeTo({
						center: coordinates,
						zoom: zoom,
					})
				})
			})

			const popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
			})

			let scope: TideOScope | undefined
			disposables.add({ dispose: () => scope?.dispose() })
			popup.on('close', () => {
				scope?.dispose()
			})

			const showPopupForEvent = (
				e: MapMouseEvent & {
					features?: Feature<Geometry, GeoJsonProperties>[] | undefined
				},
			) => {
				const features = e.features?.[0]
				const properties = features?.properties
				const geometry = features?.geometry as Point
				const coordinates = geometry?.coordinates.slice() as LngLatLike &
					number[]

				if (!features || !properties) {
					return
				}

				// Ensure that if the map is zoomed out such that
				// multiple copies of the feature are visible, the
				// popup appears over the copy being pointed to.
				while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
					coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
				}

				let canvas: HTMLCanvasElement
				const popupElement = $(
					'',
					{
						style: 'text-align: center; display: flex; flex-direction: column',
					},
					$('h3', properties.name),
					(canvas = $('canvas', {
						style: 'width: 100%; height: 250px; position: unset;',
					})),
					$(
						'button',
						{
							style: 'width: 100%',
							onclick: () => {
								disposables.dispose()
								resolve(properties.id)
							},
						},
						'Details',
					),
				)
				popup.setLngLat(coordinates).setDOMContent(popupElement).addTo(map)

				const HOUR = 1000 * 60 * 60
				const DAY = HOUR * 24
				const s = stations[properties.id]
				const { ctx, dim } = setupCanvas(canvas)

				scope?.dispose()
				scope = new TideOScope(ctx, dim, s, {
					renderScale: 1,
					labelConstituents: false,
					yRange: 8,
					center: Date.now(),
					timeRange: 2 * DAY,
					timeRate: 1,
					renderMoon: false,
					renderSun: false,
					renderHarmonics: false,
					periodLoPass: Math.log2(2 * 365),
					periodHiPass: Math.log2(1 / 24),
					crosshairRender: 'rad',
					yOffset: 0,
				})
				scope.render()

				scope.viewInput(
					'center',
					MappedView(overlay.center, (c) => c + Date.now()),
				)
			}

			map.on('click', () => {
				popup.remove()
			})

			map.on('click', 'unclustered-point', (e) => {
				showPopupForEvent(e)
			})

			let ins = 0
			map.on('mouseenter', 'clusters', () => {
				ins++
				map.getCanvas().style.cursor = 'pointer'
			})
			map.on('mouseenter', 'unclustered-point', (e) => {
				ins++
				map.getCanvas().style.cursor = 'pointer'
			})

			map.on('mouseleave', 'clusters', () => {
				ins--
				if (!ins) map.getCanvas().style.cursor = ''
			})
			map.on('mouseleave', 'unclustered-point', () => {
				ins--
				if (!ins) map.getCanvas().style.cursor = ''
			})
		})
	})

const MakeOverlay = (): Disposable & {
	element: HTMLElement
	center: View<number>
} => {
	const disposables = new DisposableStore()

	const speed = new Observable<number>()
	const center = new Observable<number>()
	center.set(0)
	speed.set(1)

	let lastUpdate: number
	const autoGo = new Auto(
		() => {
			if (center.value !== undefined && speed.value !== undefined) {
				const now = Date.now()
				lastUpdate ??= now
				const delta = now - lastUpdate
				center.set(center.value + delta * speed.value)
				lastUpdate = now
			}
		},
		MappedView(speed.view, (v) => Math.max(5 / v)),
	)

	disposables.add(autoGo)

	const detailSelect = new Observable<'speed' | 'offset' | 'none' | 'about'>()

	const optionsContainer = $('.options')

	const serviceWorkerInput = $('input', {
		type: 'checkbox',
		checked: ServiceWorkerRegistrationState.value,
	})
	const serviceWorkerCheckbox = $(
		'label',
		{
			onclick: async (e) => {
				e.preventDefault()
				if (ServiceWorkerRegistrationState.value) {
					await unregisterServiceWorker()
				} else {
					await registerServiceWorker()
				}
				window.location.reload()
			},
		},
		serviceWorkerInput,
		$('span', 'Enable Offline Access'),
	)

	ServiceWorkerRegistrationO.view((v) => {
		console.log('setting checked', v)
		serviceWorkerInput.checked = v
	})

	const speedInput = $('input', {
		type: 'range',
		min: '1',
		max: '100000',
		value: '1',
		step: '100',
		oninput() {
			speed.set(parseFloat(this.value))
		},
	})

	const centerInput = $('input', {
		type: 'range',
		min: '-86400',
		max: '86400',
		value: '0',
		step: '60',
		oninput() {
			center.set(parseFloat(this.value) * 1000)
		},
	})

	const optionsObjs = {
		speed: $(
			'.map-overlay-inner.speed',
			speedInput,
			$(
				'.key',
				{
					style: 'display: flex; justify-content: space-between',
				},
				$('span', '1x'),
				$('span', '100,000 x'),
			),
		),
		offset: $(
			'.map-overlay-inner.offset',
			centerInput,
			$(
				'.key',
				{ style: 'display: flex; justify-content: space-between' },
				$('span', '-24Hr'),
				$('span', 'Now'),
				$('span', '+24Hr'),
			),
		),
		about: $(
			'.map-overlay-inner.about',
			$('h2', 'SoLunar'),
			$('p', 'Live tide data from across USA. Select a station for more info!'),
			$(
				'p',
				'Mapping by ',
				a('Maplibre GL JS', 'https://github.com/MapLibre/maplibre-gl-js'),
				' and ',
				a('esri', 'https://www.esri.com/en-us/home'),
				'.',
				' View ',
				a('source', 'https://github.com/JacksonKearl/solunar'),
				'.',
			),
			serviceWorkerCheckbox,
		),
		none: $(
			'.none',
			$('button', { onclick: () => detailSelect.set('speed') }, 'Fast Forward'),
			$('button', { onclick: () => detailSelect.set('offset') }, 'Select Time'),
			$('button', { onclick: () => detailSelect.set('about') }, 'About'),
		),
	}

	disposables.add(
		detailSelect.view((option) => {
			detailMode.value = option
			clearElement(optionsContainer)
			optionsContainer.appendChild(optionsObjs[option])
			if (option !== 'none') {
				optionsContainer.appendChild(
					$(
						'button',
						{
							onclick: () => {
								centerInput.value = '0'
								speedInput.value = '1'
								center.set(0)
								speed.set(1)
								return detailSelect.set('none')
							},
						},
						'Options',
					),
				)
			}
		}),
	)

	const detailMode = new LocalStorageState<
		'speed' | 'offset' | 'none' | 'about'
	>('map-options-page', 'about')

	detailSelect.set(detailMode.value)

	return {
		center: center.view,
		dispose: () => disposables.dispose(),
		element: $(
			'.map-overlay',
			$(
				'.map-overlay-inner.legend',
				$('.bar'),
				$(
					'.key',
					{ style: 'display: flex; justify-content: space-between' },
					$('span', 'Lo'),
					$('span', 'MLLW'),
					$('span', 'MSL'),
					$('span', 'MHHW'),
					$('span', 'Hi'),
				),
			),
			optionsContainer,
		),
	}
}

class Auto implements Disposable {
	private disposables = new DisposableStore()
	private timeoutHandle: Disposable
	constructor(private task: () => void, timeout: View<number>) {
		this.timeoutHandle = timeout((n) => this.scheduleAt(n))
	}

	scheduleAt(n: number) {
		if (this.disposables.isDisposed) return

		this.disposables.clear()
		if (n <= 1 / 60) {
			const handle = requestAnimationFrame(() => {
				this.task()
				this.scheduleAt(n)
			})
			this.disposables.add({ dispose: () => cancelAnimationFrame(handle) })
		} else {
			const handle = setTimeout(() => {
				// don't refresh if we ain't lookin!
				requestAnimationFrame(() => {
					this.task()
					this.scheduleAt(n)
				})
			}, n * 1000)
			this.disposables.add({ dispose: () => clearTimeout(handle) })
		}
	}

	dispose(): void {
		this.disposables.dispose()
		this.timeoutHandle.dispose()
	}
}

const ServiceWorkerRegistrationState = new LocalStorageState(
	'offline-mode',
	false,
)
const ServiceWorkerRegistrationO = new Observable<boolean>()
ServiceWorkerRegistrationO.view(
	(v) => (ServiceWorkerRegistrationState.value = v),
)

const registerServiceWorker = async () => {
	if ('serviceWorker' in navigator) {
		try {
			const registration = await navigator.serviceWorker.register('/sw.js', {
				scope: '/',
			})
			if (registration.installing) {
				console.log('Service worker installing')
			} else if (registration.waiting) {
				console.log('Service worker installed')
			} else if (registration.active) {
				console.log('Service worker active')
			}
			ServiceWorkerRegistrationO.set(true)
		} catch (error) {
			console.error(`Registration failed with ${error}`)
			ServiceWorkerRegistrationO.set(false)
		}
	}
}

const unregisterServiceWorker = async () => {
	if ('serviceWorker' in navigator) {
		const rs = await navigator.serviceWorker.getRegistration('/sw.js')
		rs?.unregister()
		ServiceWorkerRegistrationO.set(false)
		console.log('service worker disabled')
	}
}
