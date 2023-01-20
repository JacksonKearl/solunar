import { View } from 'src/utils'
import { CanvasElement, DrawZone } from './CanvasElement'

type GaugeOptions = {
	label: string
	value: number
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
		console.log(this.dimensions)
	}

	public attachObservable<N extends keyof GaugeOptions>(
		inputName: N,
		view: View<GaugeOptions[N]>,
	) {
		this.store.add(
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
		this.traceCircle(0.9)
		this.context.stroke()
		this.context.fill()
		this.context.restore()
	}
}
