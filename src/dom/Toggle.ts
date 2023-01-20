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

		this.traceCircle(0.75)
		this.context.lineWidth = this.scaleFactor / 10
		this.context.fillStyle = '#000000'
		this.context.fill()
		this.context.strokeStyle = '#eeeeee'
		this.context.stroke()

		this.context.fillStyle = '#eeeeee'
		const mainLabelSize = this.scaleFactor * 0.8 + 'px'
		this.context.font = mainLabelSize + ' monospace'
		this.fillText(0, -2.7, this.options.label)

		const optionLabelSize = this.scaleFactor * 0.6 + 'px'
		this.context.font = optionLabelSize + ' monospace'
		this.fillText(1, -1.5, this.options.onLabel, 'left')
		this.fillText(1, +1.5, this.options.offLabel, 'left')

		this.context.beginPath()
		this.traceCircle(0.5)
		this.context.fillStyle = '#888'
		this.context.fill()

		const flipper = this.options.value ? -1 : 1
		this.context.beginPath()
		this.context.fillStyle = '#777'
		this.moveTo(0, 0)
		this.traceLine(-0.1, 0.05 * flipper)
		this.traceLine(+0.1, 0.05 * flipper)
		this.traceLine(+0.5, 1.7 * flipper)
		this.traceLine(+0.0, 1.9 * flipper)
		this.traceLine(-0.5, 1.7 * flipper)
		this.traceLine(-0.1, 0.05 * flipper)
		this.context.fill()

		this.context.beginPath()
		this.traceLine(+0.5, 1.7 * flipper)
		this.traceLine(0, 1.9 * flipper)
		this.traceLine(-0.5, 1.7 * flipper)
		this.context.closePath()
		this.context.fillStyle = '#888'
		this.context.fill()

		this.context.restore()
	}
}
