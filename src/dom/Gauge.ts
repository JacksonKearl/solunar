import { cos, sin } from '$/degreeMath'
import { bound2, scale, sploot, View } from '$/utils'
import { CanvasElement, DrawZone } from './CanvasElement'

type GaugeOptions = {
	label: string
	value: number
	minAngle: number
	maxAngle: number
	min: number
	max: number
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

	public attachObservable<N extends keyof GaugeOptions>(
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
		this.context.save()
		this.context.fillStyle = '#ffffff'
		this.context.beginPath()
		this.context.lineWidth = 20
		this.context.strokeStyle = '#000000'
		this.traceCircle(1)
		this.context.stroke()
		this.context.fill()

		this.context.beginPath()
		this.context.lineWidth = 3
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

		this.moveTo(0, 0)
		const r = 0.7
		this.traceLine(r * cos(valAngle), -r * sin(valAngle))
		this.context.stroke()

		this.context.restore()
	}
}
