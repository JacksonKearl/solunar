import { StationLevelAtTime } from '$/tideForTime'
import { Station } from '$/types'
import { bound2, LocalStorageState, time } from '$/utils'
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
		MakeOverlay(mapContainer)

		const mapState = new LocalStorageState('mapState', {
			zoom: 5,
			center: [-120, 40],
		})
		console.log(mapState)

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

			const data = time(() => GetStationsAsGeoJSON(Date.now()))

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
					'circle-radius': 6,
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

			let cursor = 0

			const resetInterval = () => {
				clearInterval(interval)

				const rateInput = document.getElementById(
					'map-time-select',
				) as HTMLInputElement

				const rate = parseFloat(rateInput.value)
				const timeout = bound2(100000 / rate, 50, 5000)

				interval = setInterval(() => {
					if (document.location.hash) clearInterval(interval)
					cursor += (timeout / 1000) * rate
					console.log('beeep', timeout, cursor)
					const data = GetStationsAsGeoJSON(Date.now() + cursor * 1000)
					stationSource.setData(data as any)
				}, timeout)
			}

			resetInterval()

			document
				.getElementById('map-time-select')!
				.addEventListener('input', () => resetInterval())
		})
	})

const MakeOverlay = (container: HTMLElement) => {
	const el = container.appendChild(document.createElement('div'))
	el.classList.add('map-overlay')
	el.innerHTML = `
<div class="map-overlay-inner">
<div id="legend" class="legend">
<div class="bar"></div>
<div style="display: flex; justify-content: space-between">
<span>Lo</span>
<span>MLLW</span>
<span>MSL</span>
<span>MHHW</span>
<span>Hi</span>
</div>
</div>
</div>

<div class="map-overlay-inner">
<div id="legend" class="legend">
<input id="map-time-select" type="range" min="1" max="10000" value="1" step="60">
<div style="display: flex; justify-content: space-between">
<span>1 Hz</span>
<span>100 Hz</span>
<span>10 kHz</span>
</div>
</div>
</div>
`
	return el
}
