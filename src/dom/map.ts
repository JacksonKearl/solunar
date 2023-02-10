import { StationLevelAtTime } from '$/tideForTime'
import { Disposable, Station } from '$/types'
import { $, a, clearElement } from './utils'
import {
	DisposableStore,
	LocalStorageState,
	MappedView,
	Observable,
	scale,
	time,
	View,
} from '$/utils'
import type { GeoJSONSource, LngLatLike, MapMouseEvent } from 'maplibre-gl'
import type { Point, Feature, Geometry, GeoJsonProperties } from 'geojson'

let interval: number | undefined

const GetStationsAsGeoJSON = (time: number) => ({
	type: 'FeatureCollection',
	crs: { type: 'name', properties: { name: 'All Stations with Tide' } },
	features: Object.values(stations).map((s: Station) => {
		const tide = StationLevelAtTime(s, time)
		return {
			type: 'Feature',
			properties: {
				id: s.id,
				name: s.name,
				tide: tide.total,
				norm: s.datums.MHHW
					? tide.total / (s.datums.MHHW - s.datums.MLLW)
					: null,
			},
			geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
		}
	}),
})

export const SelectStationId = () =>
	new Promise<string>((resolve) => {
		const mapContainer = document.getElementById('map-container')!
		while (mapContainer.firstChild)
			mapContainer.removeChild(mapContainer.firstChild)

		const container = mapContainer.appendChild(document.createElement('div'))
		container.id = 'map'
		const overlay = MakeOverlay()
		mapContainer.appendChild(overlay.element)
		mapContainer.appendChild($('img#jeff', { src: './jeff.jpg' }))

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

				const popupElement = document.createElement('div')
				popupElement.style.textAlign = 'center'
				const title = popupElement.appendChild(document.createElement('h3'))
				const button = popupElement.appendChild(
					document.createElement('button'),
				)
				button.style.width = '100%'

				title.textContent = properties.name
				button.textContent = 'Details'

				button.onclick = () => {
					resolve(properties.id)
					clearInterval(interval)
				}

				popup.setLngLat(coordinates).setDOMContent(popupElement).addTo(map)
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

			overlay.center((offset) => {
				if (document.location.hash) overlay.dispose()
				const data = time(() => GetStationsAsGeoJSON(offset + Date.now()))
				stationSource.setData(data as any)
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
		MappedView(speed.view, (v) => 5 / v),
	)

	disposables.add(autoGo)

	const detailSelect = new Observable<'speed' | 'offset' | 'none' | 'about'>()

	const optionsContainer = $('.options')
	const optionsObjs = {
		speed: $(
			'.map-overlay-inner.speed',
			$('input', {
				type: 'range',
				min: '1',
				max: '100000',
				value: '1',
				step: '100',
				oninput() {
					speed.set(parseFloat(this.value))
				},
			}),
			$(
				'.key',
				{
					style: 'display: flex; justify-content: space-between',
				},
				$('span', '1x'),
				$('span', '100 x'),
				$('span', '100,000 x'),
			),
		),
		offset: $(
			'.map-overlay-inner.offset',
			$('input', {
				type: 'range',
				min: '-86400',
				max: '86400',
				value: '0',
				step: '60',
				oninput() {
					center.set(parseFloat(this.value) * 1000)
				},
			}),
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
				a('Mapbox GL JS', 'https://github.com/MapLibre/maplibre-gl-js'),
				' and ',
				a('esri', 'https://www.esri.com/en-us/home'),
				'.',
				' View ',
				a('source', 'https://github.com/JacksonKearl/solunar'),
				'.',
			),
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

	constructor(private task: () => void, timeout: View<number>) {
		timeout((n) => this.scheduleAt(n))
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
	}
}
