import { Station } from '$/types'
import Stations from '$/stationData'
import { setupCanvas, drawZoneForElement } from './CanvasElement'
import { Slider } from './Slider'
import { Toggle } from './Toggle'
import { TideOScope } from './TideOScope'
import { DisposableStore, MappedView } from '$/utils'
import { Gauge } from './Gauge'
import { Clock } from './Clock'

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
	makeConfigArea('toggles'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
]
const tideOScopeToggles = [
	makeConfigArea('toggle', configs[0]),
	makeConfigArea('toggle', configs[0]),
	makeConfigArea('toggle', configs[0]),
]
const clockToggles = [
	makeConfigArea('toggle', configs[1]),
	makeConfigArea('toggle', configs[1]),
	makeConfigArea('toggle', configs[1]),
]
configs[0].classList.add('flex')
configs[1].classList.add('flex')

const go = () => {
	disposables.clear()

	const ref = document.location.hash.slice(1)
	const active = Stations.find((s) => s.id === ref) as Station
	if (!active) {
		throw Error('not found')
	}

	const { ctx, dim } = setupCanvas(canvas)

	const mainDrawZone = drawZoneForElement(main)

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
		periodLoPass: 10,
		periodHiPass: -4,
	}

	// {
	// 	const timeGauge = new Clock(ctx, mainDrawZone, {
	// 		time: Date.now(),
	// 		offset: 480,
	// 		refreshTimeout: (1 / 60) * 1000,
	// 		timeRate: 1,
	// 	})
	// 	disposables.add(timeGauge)
	// }

	// return

	const tideOScope = new TideOScope(
		ctx,
		drawZoneForElement(main),
		active,
		defaultOptions,
	)

	const constituentToggle = new Toggle(
		ctx,
		drawZoneForElement(tideOScopeToggles[2]),
		{
			label: 'Harmonics',
			onLabel: 'Show',
			offLabel: 'Hide',
			value: defaultOptions.renderHarmonics,
		},
	)
	const moonToggle = new Toggle(ctx, drawZoneForElement(tideOScopeToggles[0]), {
		label: 'Moon',
		onLabel: 'Show',
		offLabel: 'Hide',
		value: defaultOptions.renderMoon,
	})
	const sunToggle = new Toggle(ctx, drawZoneForElement(tideOScopeToggles[1]), {
		label: 'Sun',
		onLabel: 'Show',
		offLabel: 'Hide',
		value: defaultOptions.renderSun,
	})
	const secondToggle = new Toggle(ctx, drawZoneForElement(clockToggles[0]), {
		label: 'Seconds',
		onLabel: 'Show',
		offLabel: 'Hide',
		value: false,
	})
	const numbers60Toggle = new Toggle(ctx, drawZoneForElement(clockToggles[1]), {
		label: '60-Count',
		onLabel: 'Show',
		offLabel: 'Hide',
		value: false,
	})
	const numbers12Toggle = new Toggle(ctx, drawZoneForElement(clockToggles[2]), {
		label: '12-Count',
		onLabel: 'Show',
		offLabel: 'Hide',
		value: true,
	})
	const scrollSpeedSlider = new Slider(ctx, drawZoneForElement(configs[2]), {
		label: 'Scroll Speed',
		max: 100,
		min: 1,
		value: defaultOptions.timeRate,
	})
	const windowRangeSlider = new Slider(ctx, drawZoneForElement(configs[3]), {
		label: 'Window Range',
		min: -3,
		max: 15,
		value: defaultOptions.timeRange,
	})
	const highpassCutoff = new Slider(ctx, drawZoneForElement(configs[4]), {
		label: 'Hi Pass',
		min: -4,
		max: 10,
		value: defaultOptions.periodHiPass,
	})
	const lowpassCutoff = new Slider(ctx, drawZoneForElement(configs[5]), {
		label: 'Lo Pass',
		min: -4,
		max: 10,
		value: defaultOptions.periodLoPass,
	})

	const UTCOffset = 0
	const LocalOffset = new Date().getTimezoneOffset()
	const StationOffset = -(active.timezoneOffset ?? 0) * 60

	const timeGauge = new Clock(
		ctx,
		{
			height: mainDrawZone.height / 4,
			width: mainDrawZone.width / 4,
			left: mainDrawZone.left + mainDrawZone.width * (3 / 4),
			top: mainDrawZone.top,
		},
		{
			time: defaultOptions.center,
			offset: StationOffset,
			refreshTimeout: (1 / 60) * 1000,
			timeRate: defaultOptions.timeRate,
			render60Count: false,
			renderSecondHand: false,
			render12Count: true,
			renderTimer: false,
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
			label: 'Height',
			min: -8,
			max: 8,
			value: 0,
			minAngle: 250,
			maxAngle: -70,
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
	timeGauge.attachObservable(
		'time',
		MappedView(tideOScope.centralDataView, (v) => v.time),
	)
	timeGauge.attachObservable('timeRate', scrollSpeedSlider.valueView)
	timeGauge.attachObservable('render60Count', numbers60Toggle.valueView)
	timeGauge.attachObservable('render12Count', numbers12Toggle.valueView)
	timeGauge.attachObservable('renderSecondHand', secondToggle.valueView)

	const allComponents = [
		windowRangeSlider,
		scrollSpeedSlider,
		highpassCutoff,
		lowpassCutoff,
		moonToggle,
		sunToggle,
		constituentToggle,
		tideOScope,
		heightGauge,
		timeGauge,
		numbers12Toggle,
		numbers60Toggle,
		secondToggle,
	]

	disposables.add(...allComponents)
	allComponents.map((c) => c.render())
}

window.addEventListener('resize', go)
window.addEventListener('hashchange', go)
go()
