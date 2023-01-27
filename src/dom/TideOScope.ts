import {
	sploot,
	scale,
	View,
	DisposableStore,
	bound2,
	Observable,
	Event,
} from '$/utils'
import { sin, cos, wrap } from '$/degreeMath'
import { ConstituentName, Station } from '$/types'
import {
	StationLevelAtTime,
	MoonSynodicalAngleAtTime,
	SolarAngleAtTime,
	MoonTropicalAngleAtTime,
	LunarTropicalSpeed,
	TideOScopeDataPoint,
} from '$/tideForTime'
import { Constituents } from '$/constituents'
import { CanvasElement, DrawZone, Location } from './CanvasElement'

export type TideOScopeOptions = {
	renderScale: number
	center: number
	timeRange: number
	timeRate: number
	yRange: number
	labelConstituents: boolean
	renderMoon: boolean
	renderSun: boolean
	renderHarmonics: boolean
	periodLoPass: number
	periodHiPass: number
	crosshairRender: 'rad' | 'rect' | 'none'
	yOffset: number
}
export class TideOScope extends CanvasElement {
	private activeRadius: number
	private data: TideOScopeDataPoint[]
	private lastFetchWallTime: number | undefined
	private autoAdvanceDisposables = new DisposableStore()

	private centralDataObservable = new Observable<TideOScopeDataPoint>()
	public centralDataView = this.centralDataObservable.view

	private onDidRenderEvent = new Event()
	public onDidRender = this.onDidRenderEvent.view

	private timeSpeedObservable = new Observable<number>()
	public timeSpeedView = this.timeSpeedObservable.view

	public constructor(
		context: CanvasRenderingContext2D,
		drawZone: DrawZone,
		private station: Station,
		private options: TideOScopeOptions,
	) {
		super(context, drawZone)
		this.activeRadius = this.dimensions.minDim * (49 / 100)
		this.scaleFactor = this.activeRadius
		this.data = this.fetchAllData()
		this.resetAutoAdvanceTimer()
		this.disposables.add(this.autoAdvanceDisposables)
		this.disposables.add(
			this.isActive((active) => {
				if (active) {
					this.timeSpeedObservable.set(0)
				} else {
					this.timeSpeedObservable.set(this.options.timeRate)
				}
				this.resetFrame()
			}),
		)
	}

	public viewInput<N extends keyof TideOScopeOptions>(
		inputName: N,
		view: View<TideOScopeOptions[N]>,
	) {
		const toRunOnChange: {
			[K in keyof TideOScopeOptions]?: () => void
		} = {
			yOffset: () => {
				this.outputCentralData()
			},
			center: () => {
				this.fetchAllData()
			},
			timeRange: () => {
				this.resetFrame()
			},
			timeRate: () => {
				this.resetFrame()
				this.timeSpeedObservable.set(this.options.timeRate)
			},
			periodLoPass: () => {
				this.moveCenterWithTime()
			},
			periodHiPass: () => {
				this.moveCenterWithTime()
			},
		}

		this.disposables.add(
			view((v) => {
				if (this.options[inputName] !== v) {
					this.options[inputName] = v
					requestAnimationFrame(() => this.render())
					toRunOnChange[inputName]?.()
				}
			}),
		)
	}

	protected override locationInBounds(l: Location | undefined): boolean {
		return this.locationInRadius(l, 1)
	}

	// reads: renderScale, timeRange, timeRate, data
	// writes: center, data
	protected override onDrag(l: Location & { dx: number; dy: number }): void {
		this.panLevels((l.dx * -1) / this.options.renderScale)
	}

	// reads: timeRange, timeRate, data, periodHiPass, periodLoPass
	// writes: center, data
	private panAccumulator = 0
	private panLevels(numIndices: number) {
		this.panAccumulator += numIndices

		const amtToMove = Math.round(this.panAccumulator)
		const timePerPixel = this.options.timeRange / this.activeRadius
		if (Math.abs(amtToMove) > 1) {
			if (amtToMove > 0) {
				let cursor = +this.data[this.data.length - 1].time
				for (let i = 0; i < amtToMove; i++) {
					cursor += timePerPixel * this.options.renderScale
					this.data.shift()
					this.data.push(this.stationLevelAtTime(cursor))
					this.panAccumulator--
				}
			} else {
				let cursor = +this.data[0].time
				for (let i = 0; i < -amtToMove; i++) {
					cursor -= timePerPixel * this.options.renderScale
					this.data.pop()
					this.data.unshift(this.stationLevelAtTime(cursor))
					this.panAccumulator++
				}
			}
		}
		this.options.center += amtToMove * timePerPixel
		this.outputCentralData()
		this.render()
	}

	// reads timeRate
	// writes: center, data
	private moveCenterWithTime() {
		const t = Date.now()
		if (this.disposed) return
		if (this.active) {
			this.lastFetchWallTime = undefined
		} else {
			const delta =
				this.lastFetchWallTime === undefined || t === undefined
					? 0
					: t - this.lastFetchWallTime
			this.options.center += delta * this.options.timeRate

			this.fetchAllData()
		}
	}

	private resetFrame() {
		this.resetAutoAdvanceTimer()
		this.moveCenterWithTime()
	}

	// reads: timeRange, timeRate
	private resetAutoAdvanceTimer() {
		this.autoAdvanceDisposables.clear()

		const timeout = bound2((10 / this.options.timeRate) * 1000, 0, 5000)

		const doFrameUpdate = () => {
			if (this.active) {
				this.lastFetchWallTime = undefined
			} else {
				this.moveCenterWithTime()
				this.render()
			}
			this.resetAutoAdvanceTimer()
		}

		if (timeout < 10) {
			const handle = window.requestAnimationFrame(doFrameUpdate)
			this.autoAdvanceDisposables.add({
				dispose: () => window.cancelAnimationFrame(handle),
			})
		} else {
			const handle = window.setTimeout(doFrameUpdate, timeout)
			this.autoAdvanceDisposables.add({
				dispose: () => window.clearTimeout(handle),
			})
		}
	}

	// reads: center, timeRange, periodHiPass, periodLoPass
	// writes: data
	private fetchAllData() {
		this.lastFetchWallTime = Date.now()

		const start = this.options.center - this.options.timeRange
		const end = this.options.center + this.options.timeRange

		const levels = []
		for (
			let i = 0;
			i <= this.activeRadius * 2 + this.options.renderScale;
			i += this.options.renderScale
		) {
			const percWidth = i / (this.activeRadius * 2)
			const cursorTime = sploot(percWidth, start, end)
			levels.push(this.stationLevelAtTime(cursorTime))
		}
		this.data = levels
		this.outputCentralData()

		return this.data
	}

	// reads: center, data, renderHarmonics, renderMoon, renderSun, render12Hour, render24Hour, timeRange, timeRate, periodHiPass, periodLoPass
	override render() {
		this.context.save()
		this.renderClippingPath()
		this.renderBackground()
		this.renderTidePlot()
		if (this.options.renderHarmonics) {
			this.renderHarmonics()
		}
		if (this.options.renderMoon) {
			this.renderMoon()
		}
		if (this.options.renderSun) {
			this.renderSun()
		}
		this.renderCrosshairs()
		this.context.restore()

		this.onDidRenderEvent.fire()
	}

	// reads: data, yRange
	private renderTidePlot() {
		this.context.fillStyle = '#5a0073'
		this.context.beginPath()
		this.context.moveTo(this.dimensions.left, this.dimensions.bottom)
		for (let i = 0; i < this.data.length; i++) {
			const start = this.dimensions.centerX - this.activeRadius
			this.context.lineTo(
				start + i * this.options.renderScale,
				scale(
					this.data[i].total,
					-this.options.yRange,
					this.options.yRange,
					this.dimensions.centerY + this.activeRadius,
					this.dimensions.centerY - this.activeRadius,
				),
			)
		}
		this.context.lineTo(this.dimensions.right, this.dimensions.bottom)
		this.context.closePath()
		this.context.fill()
	}

	// reads: center, periodHiPass, periodLoPass
	private outputCentralData() {
		const raw = this.stationLevelAtTime(this.options.center)
		this.centralDataObservable.set({
			...raw,
			total: raw.total - this.options.yOffset,
		})
	}

	// reads: center, periodHiPass, periodLoPass
	private get centralData() {
		return this.stationLevelAtTime(this.options.center)
	}

	// reads: center
	private renderMoon() {
		const moonSynodicalAngle = MoonSynodicalAngleAtTime(this.centralData.time)
		const moonTropicalAngle = MoonTropicalAngleAtTime(this.centralData.time)

		const { x, y } = this.getCoordForData(moonTropicalAngle, {
			revsPerHour: LunarTropicalSpeed / 360,
		})
		this.context.fillStyle = '#eeeeee'
		const percentCycle = wrap(moonSynodicalAngle) / 360
		const outsidePath = []
		const insidePath = []
		const radius = this.activeRadius / 15
		for (let y = -radius; y <= radius; y++) {
			if (percentCycle < 0.5) {
				const xCircle = Math.sqrt(radius ** 2 - y ** 2)
				outsidePath.push([y, xCircle])
				insidePath.push([y, scale(percentCycle, 0, 0.5, 1, -1) * xCircle])
			} else {
				const xLead = -Math.sqrt(radius ** 2 - y ** 2)
				outsidePath.push([y, xLead])
				insidePath.push([y, scale(percentCycle, 0.5, 1, -1, 1) * xLead])
			}
		}

		this.context.beginPath()
		for (const [dy, dx] of [...outsidePath, ...insidePath.reverse()]) {
			this.context.lineTo(x + dx, y + dy)
		}
		this.context.fill()
	}

	// reads: center
	private renderSun() {
		const sunPhaseAngle = SolarAngleAtTime(this.centralData.time)
		const { x, y } = this.getCoordForData(sunPhaseAngle, {
			daysPerRev: 365.25,
		})
		this.context.fillStyle = '#F1CE01'

		this.context.beginPath()
		const radius = this.activeRadius / 15
		this.context.arc(x, y, radius, 0, 2 * Math.PI)
		this.context.fill()
	}
	// reads: center
	private renderHarmonics() {
		const constituentData = Object.entries(this.centralData.constituents).sort(
			([, a], [, b]) => b.amplitude - a.amplitude,
		)

		for (const [name, data] of constituentData) {
			if (data && data.amplitude > 0.0) {
				const { x, y, r } = this.getCoordForData(data.argument, {
					revsPerHour: (data.degreesPerSecond * 60 * 60) / 360,
				})
				const radius = (data.amplitude * r ** 2) ** (1 / 3)
				const eq = Constituents[name as ConstituentName]
				const [T, s, h] = [...eq.V, 0, 0, 0].map((x) =>
					Math.abs(x!),
				) as number[]
				const max = T + s + h + 0.5
				const greenBlue = T
				const blueRed = s
				const redGreen = h

				const rgb = [
					scale(redGreen + blueRed, 0, max, 0, 255),
					scale(redGreen + greenBlue, 0, max, 0, 255),
					scale(blueRed + greenBlue, 0, max, 0, 255),
				]

				const alpha = 230
				const toTwoDigitHexString = (n: number) =>
					Math.round(n).toString(16).padStart(2, '0')
				const color = `#` + [...rgb, alpha].map(toTwoDigitHexString).join('')
				// console.log(name, eq.V, rgb, color)
				this.context.fillStyle = color
				this.context.beginPath()
				this.context.arc(x, y, radius, 0, 2 * Math.PI)
				this.context.fill()

				if (this.options.labelConstituents) {
					this.context.fillStyle = 'black'
					const textProps = this.context.measureText(name)
					this.context.fillText(
						name,
						x - textProps.width / 2,
						y + textProps.actualBoundingBoxAscent / 2,
					)
				}
			}
		}
	}

	// reads: periodHiPass, periodLoPass
	private stationLevelAtTime(time: number) {
		return StationLevelAtTime(this.station, time, (degreesPerSecond) => {
			const revolutionsPerDay = (degreesPerSecond * (24 * 60 * 60)) / 360
			const daysPerRev = 1 / revolutionsPerDay
			const logDaysPerRev = Math.log2(daysPerRev)

			const loScale = bound2(
				scale(
					logDaysPerRev,
					this.options.periodLoPass + 0.25,
					this.options.periodLoPass - 0.25,
					0,
					1,
				),
				0,
				1,
			)
			const hiScale = bound2(
				scale(
					logDaysPerRev,
					this.options.periodHiPass - 0.25,
					this.options.periodHiPass + 0.25,
					0,
					1,
				),
				0,
				1,
			)

			return loScale * hiScale
		})
	}

	private renderCrosshairs() {
		// Null Zone
		this.context.beginPath()
		this.context.fillStyle = '#00a322'
		this.context.moveTo(this.dimensions.centerX, this.dimensions.centerY)
		const { r } = this.getCoordForData(0, { daysPerRev: 1 / 15 })
		this.context.arc(
			this.dimensions.centerX,
			this.dimensions.centerY,
			r,
			0,
			2 * Math.PI,
		)
		this.context.fill()

		// Crosshairs
		this.context.lineWidth = 2
		this.context.strokeStyle = '#00a322cc'

		this.context.beginPath()
		this.context.moveTo(this.dimensions.left, this.dimensions.centerY)
		this.context.lineTo(this.dimensions.right, this.dimensions.centerY)
		this.context.moveTo(this.dimensions.centerX, this.dimensions.top)
		this.context.lineTo(this.dimensions.centerX, this.dimensions.bottom)
		this.context.moveTo(this.dimensions.centerX, this.dimensions.centerY)
		this.context.stroke()

		let i = 0
		if (this.options.crosshairRender === 'rad') {
			for (const daysPerRev of [1 / 4, 1, 4, 16, 64, 256, 1024]) {
				this.context.beginPath()
				if (i % 2 === 0) {
					this.context.lineWidth = 1
					this.context.setLineDash([5, 10])
				} else {
					this.context.lineWidth = 2
					this.context.setLineDash([10, 5])
				}
				i++
				const { r } = this.getCoordForData(0, { daysPerRev: daysPerRev })
				this.context.arc(
					this.dimensions.centerX,
					this.dimensions.centerY,
					r,
					0,
					2 * Math.PI,
				)
				this.context.stroke()
			}
		}

		i = 0
		if (this.options.crosshairRender === 'rect') {
			for (const gridNum of [1, 2, 3, 4, 5, 6, 7]) {
				if (i % 2 === 0) {
					this.context.lineWidth = 1
					this.context.setLineDash([5, 10])
				} else {
					this.context.lineWidth = 2
					this.context.setLineDash([10, 5])
				}
				i++
				this.context.beginPath()
				this.traceLine(-1, gridNum / 8)
				this.traceLine(1, gridNum / 8)
				this.context.stroke()
				this.context.beginPath()
				this.traceLine(-1, -gridNum / 8)
				this.traceLine(1, -gridNum / 8)
				this.context.stroke()
				this.context.beginPath()
				this.traceLine(gridNum / 8, -1)
				this.traceLine(gridNum / 8, 1)
				this.context.stroke()
				this.context.beginPath()
				this.traceLine(-gridNum / 8, -1)
				this.traceLine(-gridNum / 8, 1)
				this.context.stroke()
			}
		}
		this.context.setLineDash([])

		if (this.options.yOffset) {
			this.context.strokeStyle = '#f004'
			this.setLineWidth(0.005)
			this.context.beginPath()
			this.traceLine(-1, -this.options.yOffset / this.options.yRange)
			this.traceLine(1, -this.options.yOffset / this.options.yRange)
			this.context.stroke()
		}
	}

	private renderClippingPath() {
		this.context.beginPath()
		this.context.lineWidth = 20
		this.context.strokeStyle = '#000000'
		this.context.arc(
			this.dimensions.centerX,
			this.dimensions.centerY,
			this.activeRadius,
			0,
			Math.PI * 2,
		)
		this.context.stroke()
		this.context.clip()
	}

	private renderBackground() {
		this.context.fillStyle = '#28caf9'
		this.context.fillRect(
			this.dimensions.left,
			this.dimensions.top,
			this.dimensions.right,
			this.dimensions.bottom,
		)
	}

	private getCoordForData(
		angle: number,
		speed:
			| { daysPerRev: number; revsPerHour?: never }
			| { revsPerHour: number; daysPerRev?: never },
	): { x: number; y: number; r: number } {
		const MAX_DIST = 22.2

		const revsPerHour = speed.revsPerHour ?? 1 / speed.daysPerRev / 24
		const logArg = (1 / revsPerHour ** 2) * (16 / 36)
		const distance = logArg > 1 ? Math.log(logArg) : 0
		const radius = this.activeRadius
		return {
			r: scale(distance, 0, MAX_DIST, 0, radius),
			x: scale(
				distance * sin(angle),
				-MAX_DIST,
				MAX_DIST,
				this.dimensions.centerX - radius,
				this.dimensions.centerX + radius,
			),
			y: scale(
				distance * cos(angle),
				-MAX_DIST,
				MAX_DIST,
				this.dimensions.centerY + radius,
				this.dimensions.centerY - radius,
			),
		}
	}
}
