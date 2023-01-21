import { Observable } from '$/utils'
import { CanvasElement, DrawZone, Location } from './CanvasElement'

type ToggleOptions = {
	value: boolean
	label: string
	onLabel: string
	offLabel: string
}
export class Toggle extends CanvasElement {
	private value = new Observable<boolean>()
	public valueView = this.value.view

	constructor(
		context: CanvasRenderingContext2D,
		drawZone: DrawZone,
		private options: ToggleOptions,
	) {
		super(context, drawZone)
		this.value.set(options.value)
		this.scaleFactor = this.dimensions.minDim * 0.15
	}

	protected override onClick(l: Location): void {
		if (this.locationInRadius(l, 2)) {
			this.options.value = !this.options.value
			this.value.set(this.options.value)
			this.render()
		}
	}

	override render() {
		this.context.fillStyle = '#333'
		this.context.fillRect(
			this.dimensions.left,
			this.dimensions.top,
			this.dimensions.width,
			this.dimensions.height,
		)

		this.context.save()
		this.context.beginPath()

		this.traceCircle(0.7)
		this.context.lineWidth = this.scaleFactor / 10
		this.context.fillStyle = '#000'
		this.context.fill()
		this.context.strokeStyle = '#fff'
		this.context.stroke()

		this.context.fillStyle = '#fff'
		const mainLabelSize = this.scaleFactor * 0.9 + 'px'
		this.context.font = mainLabelSize + ' system-ui'
		this.fillText(0, -2.7, this.options.label.toLocaleUpperCase())

		const optionLabelSize = this.scaleFactor * 0.5 + 'px'
		this.context.font = optionLabelSize + ' system-ui'
		this.fillText(0, -1.5, this.options.onLabel.toLocaleUpperCase())
		this.fillText(0, +1.5, this.options.offLabel.toLocaleUpperCase())

		this.context.beginPath()
		this.traceCircle(0.4)
		this.context.fillStyle = '#555'
		this.context.fill()

		const flipper = this.options.value ? -1 : 1
		this.context.beginPath()
		this.context.fillStyle = '#888'
		this.moveTo(0, 0)
		this.traceLine(-0.1, 0.05 * flipper)
		this.traceLine(+0.1, 0.05 * flipper)
		this.traceLine(+0.4, 1.0 * flipper)
		this.traceLine(+0.0, 1.3 * flipper)
		this.traceLine(-0.4, 1.0 * flipper)
		this.traceLine(-0.1, 0.05 * flipper)
		this.context.fill()

		this.context.beginPath()
		this.context.fillStyle = '#999'
		this.traceLine(+0.4, 1.0 * flipper)
		this.traceLine(0, 1.3 * flipper)
		this.traceLine(-0.4, 1.0 * flipper)
		this.context.closePath()
		this.context.fill()

		this.context.restore()
	}
}
