import { scale, bound2, Observable, LocalStorageState } from '$/utils'
import { CanvasElement, DrawZone, Location } from './CanvasElement'

type RotaryOptions = {
	value: string
	values: string[]
	label: string
	minAngle: number
	maxAngle: number
	id?: string
}

export class Rotary extends CanvasElement {
	private value = new Observable<string>()
	public valueView = this.value.view

	constructor(
		context: CanvasRenderingContext2D,
		drawZone: DrawZone,
		private options: RotaryOptions,
	) {
		super(context, drawZone)

		const valueStore = new LocalStorageState(
			options.id ?? options.label,
			options.value,
		)
		this.options.value = valueStore.value
		this.value.set(this.options.value)

		this.disposables.add(
			valueStore,
			this.valueView((v) => (valueStore.value = v)),
		)
	}

	protected override onDrag(l: Location & { dx: number; dy: number }) {
		this.handleTouch(l)
	}

	protected override onClick(l: Location) {
		this.handleTouch(l)
	}

	private locationToOptionIndex(l: Location): number {
		let { r, deg } = this.toElementSpace(l)
		// TODO: probably a better way to do this?
		if (deg < -90) deg += 360
		const i = Math.round(
			bound2(
				scale(
					deg,
					this.options.minAngle,
					this.options.maxAngle,
					0,
					this.options.values.length - 1,
				),
				0,
				this.options.values.length - 1,
			),
		)
		return i
	}

	private optionIndexToRotation(i: number): number {
		return scale(
			i,
			0,
			this.options.values.length - 1,
			this.options.minAngle,
			this.options.maxAngle,
		)
	}

	private handleTouch(l: Location) {
		const valIndex = this.locationToOptionIndex(l)
		this.value.set(this.options.values[valIndex])
		this.options.value = this.options.values[valIndex]
		this.render()
	}

	render(): void {
		this.context.save()

		this.context.fillStyle = '#333'
		this.context.fillRect(
			this.dimensions.left,
			this.dimensions.top,
			this.dimensions.width,
			this.dimensions.height,
		)

		this.context.fillStyle = '#888'
		this.context.beginPath()
		this.traceCircle(0.25, 0, 0)
		this.context.fill()

		const optionIndex = this.options.values.indexOf(this.options.value)
		const rotation = this.optionIndexToRotation(optionIndex)

		this.context.beginPath()
		this.context.lineWidth = 8
		this.context.strokeStyle = '#fff'
		this.moveTo(0, 0)
		this.traceRay(0.3, rotation)
		this.context.stroke()

		this.context.fillStyle = '#fff'
		this.context.lineWidth = 4
		this.context.font = this.scaleFactor * 0.2 + 'px system-ui'
		this.options.values.forEach((v, i) => {
			const rotation = this.optionIndexToRotation(i)
			this.context.beginPath()
			this.traceRay(0.4, rotation, 0, 0, 0.3)
			this.context.stroke()
			const { x, y } = this.getRect(0.55, rotation)
			const justification =
				rotation > 95 ? 'right' : rotation < 85 ? 'left' : 'center'

			this.fillText(x, y, v, justification)
		})

		this.context.restore()
	}
}
