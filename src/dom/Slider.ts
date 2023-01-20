import { scale, bound2, Observable } from '$/utils'
import { CanvasElement, DrawZone, Location } from './CanvasElement'

type SliderOptions = {
	value: number
	min: number
	max: number
	label: string
}
export class Slider extends CanvasElement {
	private vertical

	private value = new Observable<number>()
	public valueView = this.value.view

	constructor(
		context: CanvasRenderingContext2D,
		drawZone: DrawZone,
		private options: SliderOptions,
	) {
		super(context, drawZone)
		this.vertical = this.dimensions.height > this.dimensions.width
		this.value.set(options.value)
		this.scaleFactor = (this.vertical ? drawZone.height : drawZone.width) / 2
	}

	protected override onDrag(l: Location) {
		this.handleTouch(l)
	}

	protected override onClick(l: Location) {
		this.handleTouch(l)
	}

	private handleTouch(l: Location) {
		const scaleVal = this.vertical
			? scale(
					l.y,
					this.dimensions.bottom - this.scaleFactor * 0.1,
					this.dimensions.top + this.scaleFactor * 0.1,
					this.options.min,
					this.options.max,
			  )
			: scale(
					l.x,
					this.dimensions.left + this.scaleFactor * 0.1,
					this.dimensions.right - this.scaleFactor * 0.1,
					this.options.min,
					this.options.max,
			  )
		const boundVal = bound2(scaleVal, this.options.min, this.options.max)
		this.options.value = boundVal
		this.value.set(boundVal)
		this.render()
	}

	render(): void {
		this.context.fillStyle = '#333'
		this.context.fillRect(
			this.dimensions.left,
			this.dimensions.top,
			this.dimensions.width,
			this.dimensions.height,
		)

		this.context.save()
		this.context.beginPath()

		const [dX, dY] = this.vertical ? [0, 1] : [1, 0]
		this.moveTo(-dX, -dY)
		this.traceLine(dX, dY)

		this.context.lineWidth = 10
		this.context.strokeStyle = '#111'
		this.context.stroke()
		this.context.beginPath()

		const y = this.vertical
			? scale(this.options.value, this.options.min, this.options.max, 0.9, -0.9)
			: 0
		const x = this.vertical
			? 0
			: scale(this.options.value, this.options.min, this.options.max, -0.9, 0.9)

		this.traceCircle(0.1, x, y)
		this.context.fillStyle = '#444'
		this.context.fill()
		this.context.beginPath()
		this.traceCircle(0.05, x, y)
		this.context.fillStyle = '#f0f'
		this.context.fill()
		this.context.restore()
	}
}
