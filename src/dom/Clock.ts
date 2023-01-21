import { wrap } from '$/degreeMath'
import { DisposableStore, scale, View } from '$/utils'
import { CanvasElement, DrawZone } from './CanvasElement'

type ClockOptions = {
	time: number
	offset: number
	timeRate: number
	refreshTimeout: number
	renderSecondHand: boolean
	render60Count: boolean
}

export class Clock extends CanvasElement {
	private lastTimeUpdateTime: number

	constructor(
		context: CanvasRenderingContext2D,
		drawZone: DrawZone,
		private options: ClockOptions,
	) {
		super(context, drawZone)
		this.lastTimeUpdateTime = Date.now()
		this.scaleFactor = this.dimensions.minDim * (3 / 7)
		this.resetAutoAdvanceTimer()
		this.store.add({ dispose: () => this.autoAdvanceDisposables.clear() })
	}

	public attachObservable<N extends keyof ClockOptions>(
		inputName: N,
		view: View<ClockOptions[N]>,
	) {
		const toRunOnChange: {
			[K in keyof ClockOptions]?: () => void
		} = {
			timeRate: () => {
				this.resetAutoAdvanceTimer()
			},
			refreshTimeout: () => {
				this.resetAutoAdvanceTimer()
			},
			time: () => {
				this.lastTimeUpdateTime = Date.now()
			},
		}

		this.store.add(
			view((v) => {
				if (this.options[inputName] !== v) {
					this.options[inputName] = v
					requestAnimationFrame(() => {
						this.render()
					})
					toRunOnChange[inputName]?.()
				}
			}),
		)
	}

	// reads: timeRate, refreshTimeout
	private autoAdvanceDisposables = new DisposableStore()
	private resetAutoAdvanceTimer() {
		this.autoAdvanceDisposables.clear()
		const timeout = this.options.refreshTimeout

		if (timeout < 10) {
			const handle = window.requestAnimationFrame(() => {
				if (!this.active) {
					this.render()
				}
				this.resetAutoAdvanceTimer()
			})

			this.autoAdvanceDisposables.add({
				dispose: () => window.cancelAnimationFrame(handle),
			})
		} else {
			const handle = window.setTimeout(() => {
				if (!this.active) {
					this.render()
				}
				this.resetAutoAdvanceTimer()
			}, timeout)

			this.autoAdvanceDisposables.add({
				dispose: () => window.clearTimeout(handle),
			})
		}
	}

	render(): void {
		this.context.save()

		this.context.strokeStyle = '#000'

		this.context.beginPath()
		this.setLineWidth(0.1)
		this.context.fillStyle = '#222'
		this.traceCircle(1)
		this.context.stroke()
		this.context.fill()

		this.context.beginPath()
		this.context.fillStyle = '#000'
		this.traceCircle(0.85)
		this.context.fill()

		this.context.beginPath()
		this.context.fillStyle = '#333'
		this.traceCircle(0.83)
		this.context.fill()

		const { hours, minutes, seconds } = this.getShowTime()

		this.context.strokeStyle = '#fff'
		this.context.fillStyle = '#fff'

		// this.context.beginPath()
		// this.traceCircle(0.03)
		// this.context.fill()

		// hourNumbers
		Array.from({ length: 12 }, (_, i) => i + 1).forEach((h) => {
			const r = 0.68
			const deg = scale(h, 0, 12, 90, -270)
			const { x, y } = this.getRect(r, deg)
			this.context.font = this.scaleFactor * 0.23 + 'px system-ui'
			this.fillText(x, y, String(h))
		})

		// secondNumbers
		if (this.options.render60Count) {
			Array.from({ length: 12 }, (_, i) => i + 1).forEach((s) => {
				const r = 0.95
				const deg = scale(s, 0, 12, 90, -270)
				const { x, y } = this.getRect(r, deg)
				this.context.font = this.scaleFactor * 0.07 + 'px system-ui'
				const displayNumber = s * 5
				const rotation: Record<number, number> = {
					5: -30,
					10: -60,
					20: 60,
					25: 30,
				}
				this.withRotation(rotation[displayNumber % 30] ?? 0, x, y, () => {
					this.fillText(x, y, String(displayNumber))
				})
			})
		}

		// secondIcons
		Array.from({ length: 60 }, (_, i) => i + 1).forEach((s) => {
			const deg = scale(s, 0, 60, 90, -270)
			if (s % 60 === 0) {
				this.context.beginPath()
				this.moveTo(0, -0.85)
				this.traceLine(0.04, -0.92)
				this.traceLine(-0.04, -0.92)
				this.traceLine(-0, -0.85)
				this.context.fill()
			} else if (s % 15 === 0) {
				this.context.beginPath()
				this.setLineWidth(0.05)
				this.traceRay(0.9, deg, 0, 0, 0.85)
				this.context.stroke()
			} else if (s % 5 === 0) {
				const { x, y } = this.getRect(0.875, deg)
				this.context.beginPath()
				this.traceCircle(0.025, x, y)
				this.context.fill()
			} else {
				this.context.beginPath()
				this.setLineWidth(0.02)
				this.traceRay(0.9, deg, 0, 0, 0.85)
				this.context.stroke()
			}
		})

		// hours
		const hourAngle = scale(wrap(hours, 12), 0, 12, 90, -270)
		const rHour = 0.55
		this.withRotation(hourAngle, 0, 0, () => {
			this.context.fillStyle = '#444'
			this.context.strokeStyle = '#000'
			this.setLineWidth(0.015)

			this.context.beginPath()
			this.moveTo(0, 0)
			this.traceCircle(0.1)
			this.context.stroke()
			this.context.fill()

			this.context.beginPath()
			this.moveTo(0, 0)
			this.traceLine(rHour * (0 / 3), rHour * (1 / 30))
			this.traceLine(rHour * (2 / 3), rHour * (5 / 30))
			this.traceLine(rHour * (3 / 3), rHour * (0 / 30))
			this.traceLine(rHour * (2 / 3), rHour * (-5 / 30))
			this.traceLine(rHour * (0 / 3), rHour * (-1 / 30))
			this.traceLine(0, 0)
			this.context.stroke()
			this.context.fill()

			this.context.fillStyle = '#fff'
			this.context.beginPath()
			this.traceLine(rHour * (1 / 3), rHour * (3 / 30))
			this.traceLine(rHour * (2 / 3), rHour * (5 / 30))
			this.traceLine(rHour * (3 / 3), rHour * (0 / 30))
			this.traceLine(rHour * (2 / 3), rHour * (-5 / 30))
			this.traceLine(rHour * (1 / 3), rHour * (-3 / 30))
			this.context.fill()

			this.context.fillStyle = '#444'
			this.context.beginPath()
			this.moveTo(0, 0)
			this.traceCircle(0.1)
			this.context.fill()
		})

		// minutes
		const minuteAngle = scale(wrap(minutes, 60), 0, 60, 90, -270)
		const rMinute = 0.79
		this.withRotation(minuteAngle, 0, 0, () => {
			this.context.fillStyle = '#444'
			this.context.strokeStyle = '#000'
			this.setLineWidth(0.015)

			this.context.beginPath()
			this.moveTo(0, 0)
			this.traceCircle(0.08)
			this.context.stroke()
			this.context.fill()

			this.context.beginPath()
			this.moveTo(0, 0)
			this.traceLine(rMinute * (0 / 3), rMinute * (1 / 40))
			this.traceLine(rMinute * (2 / 3), rMinute * (3 / 40))
			this.traceLine(rMinute * (3 / 3), rMinute * (0 / 40))
			this.traceLine(rMinute * (2 / 3), rMinute * (-3 / 40))
			this.traceLine(rMinute * (0 / 3), rMinute * (-1 / 40))
			this.traceLine(0, 0)
			this.context.stroke()
			this.context.fill()

			this.context.fillStyle = '#fff'
			this.context.beginPath()
			this.traceLine(rMinute * (1 / 4), rMinute * (5 / 3 / 40))
			this.traceLine(rMinute * (2 / 3), rMinute * (3 / 40))
			this.traceLine(rMinute * (3 / 3), rMinute * (0 / 40))
			this.traceLine(rMinute * (2 / 3), rMinute * (-3 / 40))
			this.traceLine(rMinute * (1 / 4), rMinute * (-(5 / 3) / 40))
			this.context.fill()

			this.context.fillStyle = '#444'
			this.context.beginPath()
			this.moveTo(0, 0)
			this.traceCircle(0.08)
			this.context.fill()
		})

		const renderTimer = false
		if (renderTimer) {
			// timer
			const timerAngle = scale(wrap(minutes, 60), 0, 60, 90, -270)
			const rTimer = 0.83
			this.withRotation(timerAngle, 0, 0, () => {
				this.context.fillStyle = '#444'
				this.context.strokeStyle = '#000'
				this.setLineWidth(0.015)

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(0.06)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceLine(rTimer * (0 / 7), rTimer * (1 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (1 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (5 / 80))
				this.traceLine(rTimer * (7 / 7), rTimer * (0 / 40))
				this.traceLine(rTimer * (6 / 7), rTimer * (-5 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (-1 / 80))
				this.traceLine(rTimer * (0 / 7), rTimer * (-1 / 80))
				this.traceLine(0, 0)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.context.fillStyle = '#fff'
				this.traceLine(rTimer * (5 / 7), rTimer * (1 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (1 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (5 / 80))
				this.traceLine(rTimer * (7 / 7), rTimer * (0 / 40))
				this.traceLine(rTimer * (6 / 7), rTimer * (-5 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (-1 / 80))
				this.traceLine(rTimer * (5 / 7), rTimer * (-1 / 80))
				this.context.fill()

				this.context.fillStyle = '#444'
				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(0.06)
				this.context.fill()
			})
		}

		// seconds
		if (this.options.renderSecondHand) {
			this.context.beginPath()
			this.moveTo(0, 0)
			this.setLineWidth(0.015)
			const secondAngle = scale(wrap(seconds, 60), 0, 60, 90, -270)
			const rSecond = 0.92
			this.withRotation(secondAngle, 0, 0, () => {
				this.context.fillStyle = '#333'
				this.context.strokeStyle = '#000'

				const centerCircleDiameter = renderTimer ? 0.04 : 0.06
				this.context.beginPath()
				this.traceCircle(centerCircleDiameter + 0.02, -0.4, 0)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.traceCircle(centerCircleDiameter, 0, 0)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.moveTo(rSecond * -(2 / 5), rSecond * (1 / 30))
				this.traceLine(rSecond * (5 / 5), rSecond * (1 / 120))
				this.traceLine(rSecond * (5 / 5), rSecond * -(1 / 120))
				this.traceLine(rSecond * -(2 / 5), rSecond * -(1 / 30))
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.traceCircle(centerCircleDiameter + 0.02, -(2 / 5), 0)
				this.context.fill()

				this.context.beginPath()
				this.traceCircle(centerCircleDiameter, 0, 0)
				this.context.fill()

				this.context.fillStyle = '#fff'
				this.context.beginPath()
				this.moveTo(rSecond * (1 / 6), rSecond * (2 / 90))
				this.traceLine(rSecond * (6 / 6), rSecond * (1 / 120))
				this.traceLine(rSecond * (6 / 6), rSecond * -(1 / 120))
				this.traceLine(rSecond * (1 / 6), rSecond * -(2 / 90))
				this.context.fill()
			})
		}

		this.context.restore()
	}

	// reads: time, lastUpdateTime, timeRate, offset
	private getShowTime() {
		const extrapolatedTime = this.extrapolateTime()
		const timezoneOffset = this.options.offset * 60 * 1000
		const timeToShow = extrapolatedTime - timezoneOffset
		const startOfDayInTimezone = new Date(timeToShow)

		startOfDayInTimezone.setUTCHours(0, 0, 0, 0)
		const offset = timeToShow - +startOfDayInTimezone
		const seconds = offset / 1000
		const minutes = seconds / 60
		const hours = minutes / 60
		return { hours, minutes, seconds }
	}

	// reads: time, lastUpdateTime, timeRate
	private extrapolateTime() {
		const clockTimeSinceUpdate = Date.now() - this.lastTimeUpdateTime
		const scaledTimeSinceUpdate = clockTimeSinceUpdate * this.options.timeRate
		return this.options.time + scaledTimeSinceUpdate
	}
}
