import { bound2, scale, sploot, View } from '$/utils'
import { CanvasElement, DrawZone } from './CanvasElement'

type GaugeOptions = {
	value: number
	minAngle: number
	maxAngle: number
	min: number
	max: number
	numMinorTics: number
	numMajorTics: number
	title: string
	subtitle: string
}

export class Gauge extends CanvasElement {
	constructor(
		context: CanvasRenderingContext2D,
		drawZone: DrawZone,
		private options: GaugeOptions,
	) {
		super(context, drawZone)
		this.scaleFactor = this.dimensions.minDim * (3 / 7)
	}

	public viewInput<N extends keyof GaugeOptions>(
		inputName: N,
		view: View<GaugeOptions[N]>,
	) {
		this.disposables.add(
			view((v) => {
				if (this.options[inputName] !== v) {
					this.options[inputName] = v
					requestAnimationFrame(() => {
						this.render()
					})
				}
			}),
		)
	}

	render(): void {
		const renderCasing = () => {
			this.context.strokeStyle = '#000'

			this.context.beginPath()
			this.setLineWidth(0.1)
			this.context.fillStyle = '#222'
			this.traceCircle(1)
			this.context.stroke()
			this.context.fill()
		}
		const renderHand = () => {
			const valPercent = scale(
				this.options.value,
				this.options.min,
				this.options.max,
				0,
				1,
			)
			const bounded = bound2(valPercent, 0, 1)
			const valAngle = sploot(
				bounded,
				this.options.minAngle,
				this.options.maxAngle,
			)
			const rGauge = 0.8
			this.withRotation(valAngle, 0, 0, () => {
				this.context.fillStyle = '#444'
				this.context.strokeStyle = '#000'
				this.setLineWidth(0.015)

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(1 / 20)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceLine(rGauge * (0 / 3), rGauge * (1 / 20))
				this.traceLine(rGauge * (2 / 3), rGauge * (1 / 20))
				this.traceLine(rGauge * (3 / 3), rGauge * (0 / 20))
				this.traceLine(rGauge * (2 / 3), rGauge * (-1 / 20))
				this.traceLine(rGauge * (0 / 3), rGauge * (-1 / 20))
				this.traceLine(0, 0)
				this.context.stroke()
				this.context.fill()

				this.context.fillStyle = '#fff'
				this.context.beginPath()
				this.traceLine(rGauge * (1 / 4), rGauge * (1 / 20))
				this.traceLine(rGauge * (2 / 3), rGauge * (1 / 20))
				this.traceLine(rGauge * (3 / 3), rGauge * (0 / 20))
				this.traceLine(rGauge * (2 / 3), rGauge * (-1 / 20))
				this.traceLine(rGauge * (1 / 4), rGauge * (-1 / 20))
				this.context.fill()

				this.context.fillStyle = '#444'
				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(1 / 20)
				this.context.fill()
			})
		}
		const renderTics = () => {
			this.context.strokeStyle = '#fff'
			this.context.fillStyle = '#fff'

			Array.from({ length: this.options.numMajorTics }, (_, iMaj) => {
				const majorDeg = scale(
					iMaj,
					0,
					this.options.numMajorTics - 1,
					this.options.minAngle,
					this.options.maxAngle,
				)
				const val = scale(
					iMaj,
					0,
					this.options.numMajorTics - 1,
					this.options.min,
					this.options.max,
				)
				const { x, y } = this.getRect(0.65, majorDeg)
				this.context.font = this.scaleFactor * 0.2 + 'px system-ui'
				this.fillText(x, y, String(val))

				this.context.beginPath()
				this.setLineWidth(0.02)
				this.traceRay(0.95, majorDeg, 0, 0, 0.8)
				this.context.stroke()

				if (iMaj < this.options.numMajorTics - 1) {
					Array.from({ length: this.options.numMinorTics }, (_, iMin) => {
						const nextMajDeg = scale(
							iMaj + 1,
							0,
							this.options.numMajorTics - 1,
							this.options.minAngle,
							this.options.maxAngle,
						)
						const minorDeg = scale(
							iMin + 1,
							0,
							this.options.numMinorTics + 1,
							majorDeg,
							nextMajDeg,
						)

						this.context.beginPath()
						this.setLineWidth(0.02)
						const offset =
							iMin + 1 === (this.options.numMinorTics + 1) / 2 ? 0.85 : 0.9
						this.traceRay(0.95, minorDeg, 0, 0, offset)
						this.context.stroke()
					})
				}
			})
		}
		const renderTitle = () => {
			this.context.fillStyle = '#fff'

			this.context.font = this.scaleFactor * 0.2 + 'px system-ui'
			this.fillText(0, -0.6, this.options.title.toLocaleUpperCase())
			this.context.font = this.scaleFactor * 0.1 + 'px system-ui'
			this.fillText(0, -0.4, this.options.subtitle.toLocaleUpperCase())
		}

		this.context.save()

		renderCasing()
		renderHand()
		renderTics()
		renderTitle()

		this.context.restore()
	}
}
