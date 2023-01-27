import { DatumName, Station } from '$/types'
import { setupCanvas, drawZoneForElement } from './CanvasElement'
import { Slider } from './Slider'
import { Toggle } from './Toggle'
import { TideOScope, TideOScopeOptions } from './TideOScope'
import { DisposableStore, MappedView } from '$/utils'
import { Gauge } from './Gauge'
import { Clock } from './Clock'
import { Rotary } from './Rotary'

declare const stations: Record<string, Station>

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

	const newport = stations['9410580']
	const ref = document.location.hash.slice(1)
	const active = stations[ref] ?? newport
	if (!active) {
		throw Error('not found')
	}

	const { ctx, dim } = setupCanvas(canvas)

	const mainDrawZone = optionsVisible
		? drawZoneForElement(main)
		: drawZoneForElement(document.body)
	const aspectRatio = Math.max(
		mainDrawZone.height / mainDrawZone.width,
		mainDrawZone.width / mainDrawZone.height,
	)

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
	const fullScreenToggle = new Toggle(
		ctx,
		optionsVisible
			? {
					height: mainDrawZone.height / 8,
					width: mainDrawZone.width / 8,
					left: mainDrawZone.left + mainDrawZone.width * 0.81,
					top: mainDrawZone.top + mainDrawZone.height * (7 / 8),
			  }
			: {
					height: Math.min((dim.minDim / 10) * aspectRatio, dim.height / 2),
					width: Math.min((dim.minDim / 10) * aspectRatio, dim.width / 2),
					left:
						dim.width -
						Math.min((dim.minDim / 10) * aspectRatio, dim.width / 2),
					top:
						dim.height -
						Math.min((dim.minDim / 10) * aspectRatio, dim.height / 2),
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

		value: defaultOptions.periodHiPass,
	})
	const lowpassCutoff = new Slider(ctx, drawZoneForElement(sliders[4]), {
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
		value: defaultOptions.periodLoPass,
	})

	const datumRotary = new Rotary(ctx, drawZoneForElement(rotaries[0]), {
		label: 'Datum',
		selectedIndex: 2,
		values: ['MLLW', 'MLW', 'MSL', 'MHW', 'MHHW'],
		minAngle: 40,
		maxAngle: -220,
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
		optionsVisible
			? {
					height: mainDrawZone.height / 4,
					width: mainDrawZone.width / 4,
					left: mainDrawZone.left + mainDrawZone.width * (3 / 4),
					top: mainDrawZone.top,
			  }
			: {
					height: Math.min((dim.minDim / 4) * aspectRatio, dim.height / 2),
					width: Math.min((dim.minDim / 4) * aspectRatio, dim.width / 2),
					left:
						dim.width - Math.min((dim.minDim / 4) * aspectRatio, dim.width / 2),
					top: 0,
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
		optionsVisible
			? {
					height: mainDrawZone.height / 4,
					width: mainDrawZone.width / 4,
					left: mainDrawZone.left,
					top: mainDrawZone.top,
			  }
			: {
					height: Math.min((dim.minDim / 4) * aspectRatio, dim.height / 2),
					width: Math.min((dim.minDim / 4) * aspectRatio, dim.width / 2),
					left: 0,
					top: 0,
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
		optionsVisible
			? {
					height: mainDrawZone.height / 4,
					width: mainDrawZone.width / 4,
					left: mainDrawZone.left,
					top: mainDrawZone.top + mainDrawZone.height * (3 / 4),
			  }
			: {
					height: Math.min((dim.minDim / 4) * aspectRatio, dim.height / 2),
					width: Math.min((dim.minDim / 4) * aspectRatio, dim.width / 2),
					left: 0,
					top:
						dim.height -
						Math.min((dim.minDim / 4) * aspectRatio, dim.height / 2),
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
			return active.datums[v as DatumName] - active.datums.MSL
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
			const offset = active.datums[v as DatumName] - active.datums.MSL
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

	const allComponents = optionsVisible
		? [
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
		: [
				tideOScope,
				tideFlowGauge,
				tideHeightGauge,
				fullScreenToggle,
				tideHeightGauge,
				clock,
		  ]

	disposables.add(...allComponents)
	allComponents.map((c) => c.render())
}

window.addEventListener('resize', go)
window.addEventListener('hashchange', go)
window.addEventListener('unload', () => {
	disposables.dispose()
})
go()
