import { scale, bound2, Observable, LocalStorageState } from '$/utils'
import { CanvasElement, DrawZone, Location } from './CanvasElement'

type RotaryOptions = {
	selectedIndex: number
	values: string[]
	label: string
	minAngle: number
	maxAngle: number
	id?: string
}

export class Rotary extends CanvasElement {
	private selectedIndex = new Observable<number>()
	public selectedIndexView = this.selectedIndex.view
	private selected = new Observable<string>()
	public selectedView = this.selected.view

	constructor(
		context: CanvasRenderingContext2D,
		drawZone: DrawZone,
		private options: RotaryOptions,
	) {
		super(context, drawZone)
		this.scaleFactor = this.dimensions.minDim * 0.7

		const valueStore = new LocalStorageState(
			options.id ?? options.label,
			options.selectedIndex,
		)
		this.options.selectedIndex = valueStore.value
		console.log(this.options)
		this.selectedIndex.set(this.options.selectedIndex)
		this.selected.set(this.options.values[this.options.selectedIndex])

		this.disposables.add(
			valueStore,
			this.selectedIndexView((v) => (valueStore.value = v)),
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
		if (deg > 90) deg -= 360
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
		this.selectedIndex.set(valIndex)
		this.selected.set(this.options.values[valIndex])
		this.options.selectedIndex = valIndex
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

		this.context.strokeStyle = '#fff'
		this.context.fillStyle = '#fff'

		this.context.font = this.scaleFactor * 0.2 + 'px system-ui'
		this.fillText(0, -0.6, this.options.label.toLocaleUpperCase())

		this.setLineWidth(0.03)
		this.context.font = this.scaleFactor * 0.15 + 'px system-ui'
		this.options.values.forEach((v, i) => {
			const rotation = this.optionIndexToRotation(i)
			this.withRotation(rotation, 0, 0, () => {
				this.context.beginPath()
				this.traceRay(0.4, 0, 0, 0, 0.25)
				this.context.stroke()
			})
			const { x, y } = this.getRect(0.54, rotation)
			this.fillText(x, y, v, rotation)
		})

		this.context.fillStyle = '#555'
		this.context.beginPath()
		this.traceCircle(0.25, 0, 0)
		this.context.clip()
		this.context.fill()

		const rotation = this.optionIndexToRotation(this.options.selectedIndex)
		this.withRotation(rotation, 0, 0, () => {
			this.context.beginPath()
			this.context.fillStyle = '#888'
			this.traceLine(0.5, 0)
			this.traceLine(0, -0.15)
			this.traceLine(-0.5, 0)
			this.traceLine(0, 0.15)
			this.context.fill()
			this.context.clip()

			this.context.beginPath()
			this.context.fillStyle = '#000'
			this.traceLine(0.3, 0)
			this.traceLine(0.15, -0.07)
			this.traceLine(-0.05, -0.03)
			this.traceLine(-0.05, 0.03)
			this.traceLine(0.15, 0.07)
			this.context.fill()

			this.context.beginPath()
			this.context.strokeStyle = '#fff'
			this.context.fillStyle = '#fff'
			this.setLineWidth(0.03)
			this.moveTo(0, 0)
			this.traceRay(0.15, 0)
			this.context.stroke()
			this.traceCircle(0.015)
			this.context.fill()

			this.context.beginPath()
			this.moveTo(0.15, 0.02)
			this.traceLine(0.15, 0.04)
			this.traceLine(0.225, 0.0)
			this.traceLine(0.15, -0.04)
			this.traceLine(0.15, 0.02)
			this.context.fill()
		})

		this.context.restore()
	}
}
