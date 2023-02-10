import { scale, bound2, Observable, LocalStorageState } from '$/utils'
import { CanvasElement, DrawZone, Location } from './CanvasElement'

type SliderOptions = {
	value: number
	min: number
	max: number
	label: string
	subtitle?: string
	id?: string
	tics?: [number, string][]
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

		const valueStore = new LocalStorageState(
			options.id ?? options.label,
			options.value,
		)
		this.options.value = valueStore.value

		this.vertical = this.dimensions.height > this.dimensions.width
		this.value.set(this.options.value)
		this.scaleFactor =
			(this.vertical ? drawZone.height : drawZone.width) * (3 / 8)

		this.disposables.add(
			valueStore,
			this.valueView((v) => (valueStore.value = v)),
		)

		if (!this.vertical) {
			this.centerY = this.dimensions.centerY + this.scaleFactor * 0.1
		}
	}

	protected override onDrag(l: { dx: number; dy: number }) {
		const { dx, dy } = l

		let newVal
		if (this.vertical) {
			const valLoc = scale(
				this.options.value,
				this.options.min,
				this.options.max,
				this.dimensions.centerY + this.scaleFactor,
				this.dimensions.centerY - this.scaleFactor,
			)
			const newValLoc = bound2(
				valLoc + dy,
				this.dimensions.centerY + this.scaleFactor,
				this.dimensions.centerY - this.scaleFactor,
			)
			newVal = scale(
				newValLoc,
				this.dimensions.centerY + this.scaleFactor,
				this.dimensions.centerY - this.scaleFactor,
				this.options.min,
				this.options.max,
			)
		} else {
			const valLoc = scale(
				this.options.value,
				this.options.min,
				this.options.max,
				this.dimensions.centerX - this.scaleFactor,
				this.dimensions.centerX + this.scaleFactor,
			)
			const newValLoc = bound2(
				valLoc + dx,
				this.dimensions.centerX - this.scaleFactor,
				this.dimensions.centerX + this.scaleFactor,
			)
			newVal = scale(
				newValLoc,
				this.dimensions.centerX - this.scaleFactor,
				this.dimensions.centerX + this.scaleFactor,
				this.options.min,
				this.options.max,
			)
		}

		this.options.value = newVal
		this.value.set(newVal)
		this.render()
	}

	protected override onClick(l: Location) {
		this.handleTouch(l)
	}

	private handleTouch(l: Location) {
		const scaleVal = this.vertical
			? scale(
					l.y,
					this.dimensions.centerY + this.scaleFactor,
					this.dimensions.centerY - this.scaleFactor,
					this.options.min,
					this.options.max,
			  )
			: scale(
					l.x,
					this.dimensions.centerX - this.scaleFactor,
					this.dimensions.centerX + this.scaleFactor,
					this.options.min,
					this.options.max,
			  )

		let boundVal = bound2(scaleVal, this.options.min, this.options.max)

		for (const [tic] of this.options.tics ?? []) {
			if (
				Math.abs(tic - boundVal) <
				0.05 * Math.abs(this.options.max - this.options.min)
			) {
				boundVal = tic
			}
		}

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

		this.context.fillStyle = '#fff'
		const subtitleToRender =
			this.options.subtitle && this.options.subtitle.length > 3
				? this.options.subtitle.toLocaleUpperCase()
				: this.options.subtitle

		if (this.vertical) {
			this.context.font = this.dimensions.width * 0.15 + 'px system-ui'
			this.fillText(0, 1.2, this.options.label.toLocaleUpperCase())
			this.context.font = this.dimensions.width * 0.1 + 'px system-ui'
			this.fillText(0, 1.3, subtitleToRender ?? '')
		} else {
			this.context.font = this.dimensions.height * 0.15 + 'px system-ui'
			this.fillText(0, -0.3, this.options.label.toLocaleUpperCase())
			this.context.font = this.dimensions.height * 0.1 + 'px system-ui'
			this.fillText(0, -0.18, subtitleToRender ?? '')
		}

		this.context.strokeStyle = '#fff'
		this.setLineWidth(0.01)
		for (const tic of this.options.tics ?? []) {
			this.context.beginPath()
			if (this.vertical) {
				const ticLoc = scale(tic[0], this.options.min, this.options.max, 1, -1)
				this.traceLine(-0.1, ticLoc)
				this.traceLine(0.1, ticLoc)
				this.context.font = this.scaleFactor * 0.06 + 'px system-ui'
				this.fillText(0.12, ticLoc, tic[1], 180)
			} else {
				const ticLoc = scale(tic[0], this.options.min, this.options.max, -1, 1)
				this.traceLine(ticLoc, -0.1)
				this.traceLine(ticLoc, 0.1)
				this.context.font = this.scaleFactor * 0.06 + 'px system-ui'
				this.fillText(ticLoc, 0.15, tic[1])
			}
			this.context.stroke()
		}

		this.context.beginPath()

		const [dX, dY] = this.vertical ? [0, 1.01] : [1.01, 0]
		this.moveTo(-dX, -dY)
		this.traceLine(dX, dY)

		this.setLineWidth(0.04)
		this.context.strokeStyle = '#111'
		this.context.stroke()

		const y = 0
		const x = this.vertical
			? scale(this.options.value, this.options.min, this.options.max, 1, -1)
			: scale(this.options.value, this.options.min, this.options.max, -1, 1)

		const traceLine = (x: number, y: number) =>
			this.vertical ? this.traceLine(y, x) : this.traceLine(x, y)

		this.context.beginPath()
		this.context.fillStyle = '#888'
		// this.traceLine(x, y)
		traceLine(x + 0.1, y + 0.08)
		traceLine(x + 0.1, y - 0.08)
		traceLine(x + 0, y - 0.06)
		traceLine(x - 0.1, y - 0.08)
		traceLine(x - 0.1, y + 0.08)
		traceLine(x + 0, y + 0.06)
		traceLine(x + 0.1, y + 0.08)
		this.context.fill()
		this.context.clip()

		this.context.beginPath()
		traceLine(x, y - 1)
		traceLine(x, y + 1)
		this.context.strokeStyle = '#000'
		this.setLineWidth(0.06)
		this.context.stroke()
		this.setLineWidth(0.015)
		this.context.strokeStyle = '#fff'
		this.context.stroke()

		this.context.strokeStyle = '#555'
		this.setLineWidth(0.005)
		for (const delta of [0.05, 0.08]) {
			this.context.beginPath()
			traceLine(x + delta, y - 1)
			traceLine(x + delta, y + 1)
			this.context.stroke()
			this.context.beginPath()
			traceLine(x - delta, y - 1)
			traceLine(x - delta, y + 1)
			this.context.stroke()
		}

		this.context.restore()
	}
}
