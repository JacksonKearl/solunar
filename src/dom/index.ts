import { Station } from '../types.js'
import Stations from '../stationData.js'
import { setupCanvas, drawZoneForElement } from './CanvasElement'
import { Slider } from './Slider'
import { Toggle } from './Toggle'
import { TideOScope } from './TideOScope'
import { DisposableStore, MappedView } from 'src/utils.js'
import { Gauge } from './Gauge.js'

const disposables = new DisposableStore()

const HOUR = 1000 * 60 * 60
const DAY = HOUR * 24

const canvas = document.querySelector('canvas')
const main = document.querySelector('main')
const config = document.querySelector('form')

if (!(canvas && main && config)) {
	throw Error('bad DOM, elements not found')
}

const makeConfigArea = (className: string, parent: HTMLElement = config) => {
	const el = parent.appendChild(document.createElement('div'))
	el.className = className
	return el
}

const configs = [
	makeConfigArea('toggles'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
]
const toggles = [
	makeConfigArea('toggle', configs[0]),
	makeConfigArea('toggle', configs[0]),
	makeConfigArea('toggle', configs[0]),
	makeConfigArea('toggle', configs[0]),
	makeConfigArea('toggle', configs[0]),
]
configs[0].classList.add('flex')

const go = () => {
	disposables.clear()

	const ref = document.location.hash.slice(1)
	const active = Stations.find((s) => s.id === ref) as Station
	if (!active) {
		throw Error('not found')
	}

	const { ctx, dim } = setupCanvas(canvas)

	// Background
	ctx.fillStyle = '#333'
	ctx.fillRect(dim.left, dim.top, dim.width, dim.height)

	const defaultOptions = {
		renderScale: 1,
		labelConstituents: false,
		yRange: 8,
		center: Date.now(),
		timeRange: 2 * DAY,
		timeRate: 1,
		renderMoon: true,
		renderSun: true,
		renderHarmonics: false,
		render12Hour: false,
		render24Hour: false,
		periodLoPass: 10,
		periodHiPass: -4,
	}

	const tideOScope = new TideOScope(
		ctx,
		drawZoneForElement(main),
		active,
		defaultOptions,
	)

	const constituentToggle = new Toggle(ctx, drawZoneForElement(toggles[2]), {
		label: 'Harmonics',
		onLabel: 'On',
		offLabel: 'Off',
		value: defaultOptions.renderHarmonics,
	})
	const moonToggle = new Toggle(ctx, drawZoneForElement(toggles[0]), {
		label: 'Moon',
		onLabel: 'On',
		offLabel: 'Off',
		value: defaultOptions.renderMoon,
	})
	const sunToggle = new Toggle(ctx, drawZoneForElement(toggles[1]), {
		label: 'Sun',
		onLabel: 'On',
		offLabel: 'Off',
		value: defaultOptions.renderSun,
	})
	const hour12Toggle = new Toggle(ctx, drawZoneForElement(toggles[3]), {
		label: 'Hour (12)',
		onLabel: 'On',
		offLabel: 'Off',
		value: defaultOptions.render12Hour,
	})
	const hour24Toggle = new Toggle(ctx, drawZoneForElement(toggles[4]), {
		label: 'Hour (24)',
		onLabel: 'On',
		offLabel: 'Off',
		value: defaultOptions.render24Hour,
	})
	const scrollSpeedSlider = new Slider(ctx, drawZoneForElement(configs[1]), {
		label: 'Scroll Speed',
		max: 10000,
		min: 1,
		value: defaultOptions.timeRate,
	})
	const windowRangeSlider = new Slider(ctx, drawZoneForElement(configs[2]), {
		label: 'Window Range',
		min: -3,
		max: 15,
		value: defaultOptions.timeRange,
	})
	const highpassCutoff = new Slider(ctx, drawZoneForElement(configs[3]), {
		label: 'Hi Pass',
		min: -4,
		max: 10,
		value: defaultOptions.periodHiPass,
	})
	const lowpassCutoff = new Slider(ctx, drawZoneForElement(configs[4]), {
		label: 'Lo Pass',
		min: -4,
		max: 10,
		value: defaultOptions.periodLoPass,
	})

	const mainDrawZone = drawZoneForElement(main)

	const timeGauge = new Gauge(
		ctx,
		{
			height: mainDrawZone.height / 4,
			width: mainDrawZone.width / 4,
			left: mainDrawZone.left + mainDrawZone.width * (3 / 4),
			top: mainDrawZone.top,
		},
		{
			label: 'Lo Pass',
			min: -10,
			max: 10,
			value: 0,
		},
	)
	const heightGauge = new Gauge(
		ctx,
		{
			height: mainDrawZone.height / 4,
			width: mainDrawZone.width / 4,
			left: mainDrawZone.left,
			top: mainDrawZone.top,
		},
		{
			label: 'Lo Pass',
			min: -10,
			max: 10,
			value: 0,
		},
	)

	tideOScope.attachObservable('renderHarmonics', constituentToggle.valueView)
	tideOScope.attachObservable('periodLoPass', lowpassCutoff.valueView)
	tideOScope.attachObservable('periodHiPass', highpassCutoff.valueView)
	tideOScope.attachObservable('renderMoon', moonToggle.valueView)
	tideOScope.attachObservable('renderSun', sunToggle.valueView)
	tideOScope.attachObservable('timeRange', windowRangeSlider.valueView)
	tideOScope.attachObservable('timeRate', scrollSpeedSlider.valueView)

	heightGauge.attachObservable(
		'value',
		MappedView(tideOScope.centralDataView, (v) => v.total),
	)

	const allComponents = [
		windowRangeSlider,
		scrollSpeedSlider,
		highpassCutoff,
		lowpassCutoff,
		moonToggle,
		sunToggle,
		constituentToggle,
		tideOScope,
		hour12Toggle,
		hour24Toggle,
		heightGauge,
		timeGauge,
	]

	disposables.add(...allComponents)
	allComponents.map((c) => c.render())
}

window.addEventListener('resize', go)
window.addEventListener('hashchange', go)
go()
