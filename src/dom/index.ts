import { DatumName, Station } from '$/types'
import { setupCanvas, drawZoneForElement } from './components/CanvasElement'
import { Slider } from './components/Slider'
import { Toggle } from './components/Toggle'
import { TideOScope, TideOScopeOptions } from './components/TideOScope'
import {
	ArrayView,
	DisposableStore,
	LocalStorageState,
	MappedView,
	nbsp,
	sigfig,
} from '$/utils'
import { Gauge } from './components/Gauge'
import { Clock } from './components/Clock'
import { Rotary } from './components/Rotary'
import { SelectStationId } from './map'
import { $, clearElement } from './utils'

const disposables = new DisposableStore()

const HOUR = 1000 * 60 * 60
const DAY = HOUR * 24
const YEAR = DAY * 365

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
	makeConfigArea('rotaries'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
	makeConfigArea('slider'),
]
const sliders = configs.slice(3)

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
const rotaries = [
	makeConfigArea('rotary', configs[2]),
	makeConfigArea('rotary', configs[2]),
	makeConfigArea('rotary', configs[2]),
]
configs[0].classList.add('flex')
configs[1].classList.add('flex')
configs[2].classList.add('flex')

const go = () => {
	const optionsVisible = JSON.parse(localStorage.getItem('Options') ?? 'true')
	if (!optionsVisible) {
		config.setAttribute('style', 'display: none !important')
	}
	if (optionsVisible) {
		config.setAttribute('style', 'display: flex !important')
	}
	disposables.clear()

	const ref = document.location.hash.slice(1) || selectedStation.value
	const active = stations[ref] as Station
	if (!active) {
		selectedStation.value = ''
		document.location.hash = ''
		return fromTheTop()
	}

	const title = $(
		'#title',
		$(
			'button',
			{
				type: 'button',
				onclick: () => {
					selectedStation.value = ''
					document.location.hash = ''
					fromTheTop()
				},
			},
			'Back',
		),
		$(
			'.name',
			{ style: 'text-align: center;' },
			$('h2', active.name),
			$('h3', active.state),
		),
		$(
			'button',
			{
				type: 'button',
				onclick: () => {
					tideOScope.onReset()
				},
			},
			'Reset',
		),
	)
	const content = $('#content')
	const foot = $('#foot', 'Hello')
	clearElement(main)

	main.appendChild(title)
	main.appendChild(content)
	main.appendChild(foot)

	const { ctx, dim } = setupCanvas(canvas)

	const mainDrawZone = drawZoneForElement(content)

	// Background
	ctx.fillStyle = '#333'
	ctx.fillRect(dim.left, dim.top, dim.width, dim.height)

	const defaultOptions: TideOScopeOptions = {
		renderScale: 1,
		labelConstituents: false,
		yRange: 8,
		center: Date.now(),
		timeRange: 2 * DAY,
		timeRate: 1,
		renderMoon: true,
		renderSun: true,
		renderHarmonics: false,
		periodLoPass: Math.log2(2 * 365),
		periodHiPass: Math.log2(1 / 24),
		crosshairRender: 'rad',
		yOffset: 0,
	} as const

	const tideOScope = new TideOScope(ctx, mainDrawZone, active, defaultOptions)

	const bigR = Math.min(mainDrawZone.height, mainDrawZone.width) * 0.5
	const h = mainDrawZone.height
	const w = mainDrawZone.width

	const negB = bigR + (h + w) / 2
	const bSquaredMinus4AC = 2 * bigR * bigR + h * bigR + w * bigR + (h * w) / 2

	const littleR = Math.min(
		h / 4,
		w / 4,
		negB + Math.sqrt(bSquaredMinus4AC),
		negB - Math.sqrt(bSquaredMinus4AC),
	)

	const gaugeSize = Math.max(littleR * 2, bigR / 2)

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
		value: true,
	})
	const numbers60Toggle = new Toggle(ctx, drawZoneForElement(clockToggles[2]), {
		label: '60-Count',
		onLabel: 'Show',
		offLabel: 'Hide',
		value: true,
	})
	const numbers12Toggle = new Toggle(ctx, drawZoneForElement(clockToggles[1]), {
		label: '12-Count',
		onLabel: 'Show',
		offLabel: 'Hide',
		value: true,
	})

	const toggleSize = Math.min(bigR / 2, littleR * 2)
	const fullScreenToggle = new Toggle(
		ctx,
		{
			height: toggleSize,
			width: toggleSize,
			left: mainDrawZone.left + mainDrawZone.width - toggleSize,
			top: mainDrawZone.top + mainDrawZone.height - toggleSize,
		},
		{
			label: 'Options',
			onLabel: 'Show',
			offLabel: 'Hide',
			value: true,
		},
	)
	const scrollSpeedSlider = new Slider(ctx, drawZoneForElement(sliders[0]), {
		label: 'Speed',
		subtitle: 'Hz',
		max: Math.log(30000000),
		min: Math.log(1),
		tics: [
			[Math.log(1), '1'],
			[Math.log(30), '30'],
			[Math.log(1000), '1k'],
			[Math.log(30000), '30k'],
			[Math.log(1000000), '1M'],
			[Math.log(30000000), '30M'],
		],
		value: Math.log(defaultOptions.timeRate),
	})
	const windowRangeSlider = new Slider(ctx, drawZoneForElement(sliders[1]), {
		label: 'X Range',
		subtitle: 'Time / grid',
		min: Math.log(1 * HOUR * 8),
		max: Math.log(2 * YEAR * 8),
		tics: [
			[Math.log(1 * HOUR * 8), '1h'],
			[Math.log(6 * HOUR * 8), '6h'],
			[Math.log(1 * DAY * 8), '1d'],
			[Math.log(7 * DAY * 8), '1w'],
			[Math.log(28 * DAY * 8), '28d'],
			[Math.log(180 * DAY * 8), '180d'],
			[Math.log(2 * YEAR * 8), '2y'],
		],
		value: Math.log(defaultOptions.timeRange),
	})
	const tideRange = new Slider(ctx, drawZoneForElement(sliders[2]), {
		label: 'Y Range',
		subtitle: 'Feet / grid',
		min: Math.log2((1 / 2) * 8),
		max: Math.log2(8 * 8),
		tics: [
			[Math.log2(0.5 * 8), '0.5'],
			[Math.log2(1 * 8), '1'],
			[Math.log2(2 * 8), '2'],
			[Math.log2(4 * 8), '4'],
			[Math.log2(8 * 8), '8'],
		],
		value: Math.log2(defaultOptions.yRange),
	})
	const highpassCutoff = new Slider(ctx, drawZoneForElement(sliders[3]), {
		label: 'Lo Pass',
		subtitle: 'time / cycle',
		min: Math.log2(1 / 24),
		max: Math.log2(365 * 2),
		tics: [
			[Math.log2(1 / 24), '1h'],
			[Math.log2(1 / 4), '6h'],
			[Math.log2(1), '1d'],
			[Math.log2(7), '1w'],
			[Math.log2(28), '28d'],
			[Math.log2(180), '180d'],
			[Math.log2(365 * 2), '2y'],
		],

		value: defaultOptions.periodHiPass,
	})
	const lowpassCutoff = new Slider(ctx, drawZoneForElement(sliders[4]), {
		label: 'Hi Pass',
		subtitle: 'time / cycle',
		min: Math.log2(1 / 24),
		max: Math.log2(365 * 2),
		tics: [
			[Math.log2(1 / 24), '1h'],
			[Math.log2(1 / 4), '6h'],
			[Math.log2(1), '1d'],
			[Math.log2(7), '1w'],
			[Math.log2(28), '28d'],
			[Math.log2(180), '180d'],
			[Math.log2(365 * 2), '2y'],
		],
		value: defaultOptions.periodLoPass,
	})

	const datumRotary = new Rotary(ctx, drawZoneForElement(rotaries[0]), {
		label: 'Datum',
		selectedIndex: 2,
		values: ['MLLW', 'MLW', 'MSL', 'MHW', 'MHHW'],
		minAngle: -220,
		maxAngle: 40,
	})

	const timezoneRotary = new Rotary(ctx, drawZoneForElement(rotaries[1]), {
		label: 'Time Zone',
		selectedIndex: 0,
		values: ['DEV', 'GMT', 'STA'],
		minAngle: -150,
		maxAngle: -30,
	})

	const crosshairRotary = new Rotary(ctx, drawZoneForElement(rotaries[2]), {
		label: 'grid',
		selectedIndex: 0,
		values: ['RAD', 'RECT', 'OFF'],
		minAngle: -150,
		maxAngle: -30,
	})

	const UTCOffset = 0
	const LocalOffset = new Date().getTimezoneOffset()
	const StationOffset = -(active.timezoneOffset ?? 0) * 60

	const clock = new Clock(
		ctx,
		{
			height: gaugeSize,
			width: gaugeSize,
			left: mainDrawZone.left + mainDrawZone.width - gaugeSize,
			top: mainDrawZone.top,
		},
		{
			time: defaultOptions.center,
			offset: StationOffset,
			timeRate: defaultOptions.timeRate,
			render60Count: true,
			renderSecondHand: true,
			render12Count: true,
			renderTimer: false,
		},
	)
	const tideHeightGauge = new Gauge(
		ctx,
		{
			height: gaugeSize,
			width: gaugeSize,
			left: mainDrawZone.left,
			top: mainDrawZone.top,
		},
		{
			title: 'Tide',
			subtitle: 'Feet',
			range: defaultOptions.yRange * 2,
			center: 0,
			value: 0,
			minAngle: 30,
			maxAngle: -210,
			numMajorTics: 9,
			numMinorTics: 3,
		},
	)

	const tideFlowGauge = new Gauge(
		ctx,
		{
			height: gaugeSize,
			width: gaugeSize,
			left: mainDrawZone.left,
			top: mainDrawZone.top + mainDrawZone.height - gaugeSize,
		},
		{
			title: 'Flow',
			subtitle: 'feet / hour',
			range: defaultOptions.yRange,
			center: 0,
			value: 0,
			minAngle: 30,
			maxAngle: -210,
			numMajorTics: 9,
			numMinorTics: 3,
		},
	)

	tideOScope.viewInput(
		'yOffset',
		MappedView(datumRotary.selectedView, (v) => {
			return 'MSL' in active.datums
				? active.datums[v as DatumName] - active.datums.MSL
				: 0
		}),
	)

	tideOScope.viewInput(
		'crosshairRender',
		MappedView(
			crosshairRotary.selectedIndexView,
			(i) => (['rad', 'rect', 'none'] as const)[i],
		),
	)
	tideOScope.viewInput('renderHarmonics', constituentToggle.valueView)
	tideOScope.viewInput('periodLoPass', lowpassCutoff.valueView)
	tideOScope.viewInput('periodHiPass', highpassCutoff.valueView)
	tideOScope.viewInput('renderMoon', moonToggle.valueView)
	tideOScope.viewInput('renderSun', sunToggle.valueView)
	tideOScope.viewInput(
		'timeRange',
		MappedView(windowRangeSlider.valueView, (v) => Math.E ** v),
	)
	tideOScope.viewInput(
		'timeRate',
		MappedView(scrollSpeedSlider.valueView, (v) => Math.E ** v),
	)
	tideOScope.viewInput(
		'yRange',
		MappedView(tideRange.valueView, (v) => 2 ** v),
	)

	disposables.add(
		ArrayView(
			tideOScope.centralDataView,
			timezoneRotary.selectedIndexView,
		)(([{ time, total }, selectedIndex]) => {
			const offset =
				([LocalOffset, UTCOffset, StationOffset][selectedIndex] -
					new Date().getTimezoneOffset()) *
				60 *
				1000

			const t = new Date(time - offset)
			t.setSeconds(0)

			const roundedTide = sigfig(total, 3)
			const noSecondsTime = t.toLocaleTimeString().replace(/:00/, '')
			const fixedLengthHoursTime = noSecondsTime.replace(/^(\d):/, nbsp + '$1:')
			foot.innerText = `${roundedTide}' @ ${fixedLengthHoursTime}, ${t.toLocaleDateString()} `
		}),
	)

	tideFlowGauge.viewInput(
		'value',
		MappedView(tideOScope.centralDataView, (v) => v.flow),
	)
	tideHeightGauge.viewInput(
		'value',
		MappedView(tideOScope.centralDataView, (v) => v.total),
	)
	tideHeightGauge.viewInput(
		'range',
		MappedView(tideRange.valueView, (v) => 2 * 2 ** Math.round(v)),
	)
	tideHeightGauge.viewInput(
		'center',
		MappedView(datumRotary.selectedView, (v) => {
			const offset =
				'MSL' in active.datums
					? active.datums[v as DatumName] - active.datums.MSL
					: 0
			return -Math.round(offset)
		}),
	)
	clock.viewInput(
		'time',
		MappedView(tideOScope.centralDataView, (v) => v.time),
	)
	clock.viewInput('timeRate', tideOScope.timeSpeedView)
	clock.viewInput('render60Count', numbers60Toggle.valueView)
	clock.viewInput('render12Count', numbers12Toggle.valueView)
	clock.viewInput('renderSecondHand', secondToggle.valueView)

	clock.viewInput(
		'offset',
		MappedView(
			timezoneRotary.selectedIndexView,
			(v) => [LocalOffset, UTCOffset, StationOffset][v],
		),
	)

	// hack to prevent these being drawn underneath the main scope...
	// ideally they'd be on a different layer of canvas or something?
	// TODO: Different canvas layers.
	disposables.add(
		tideOScope.onDidRender(() => {
			tideFlowGauge.render()
			tideHeightGauge.render()
			clock.render()
		}),
	)

	disposables.add(
		fullScreenToggle.valueView((v) => {
			requestAnimationFrame(() => {
				if (v !== optionsVisible) {
					go()
				}
			})
		}),
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
		tideHeightGauge,
		clock,
		numbers12Toggle,
		numbers60Toggle,
		secondToggle,
		tideFlowGauge,
		tideRange,
		datumRotary,
		timezoneRotary,
		crosshairRotary,
		fullScreenToggle,
	]

	disposables.add(...allComponents)
	allComponents.map((c) => c.render())
}

const selectedStation = new LocalStorageState('selected-station', '')

let isSelecting = false
const fromTheTop = async () => {
	if (isSelecting) return // don't re-enter
	const ref = document.location.hash.slice(1) || selectedStation.value

	const map = document.getElementById('map-container')!
	if (!ref) {
		map.style.display = 'block'
		isSelecting = true
		const id = await SelectStationId()
		isSelecting = false
		document.location.hash = id
		selectedStation.value = id
		go()
	} else {
		map.style.display = 'none'
		window.addEventListener('resize', go)
		go()
	}
}

window.addEventListener('hashchange', fromTheTop)
window.addEventListener('unload', () => {
	disposables.dispose()
})

fromTheTop()
