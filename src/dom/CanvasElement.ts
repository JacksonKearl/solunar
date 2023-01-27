import { bound2, DisposableStore } from '$/utils'
import { Disposable } from '$/types'
import { addElementListener, findDPR } from './utils'
import { atan2, cos, degToRad, sin } from '$/degreeMath'

/** Always in page-pixel-space (`page-space * dpr`) */
export type Location = { x: number; y: number }
export type CursorEvent = TouchEvent | MouseEvent
export type DrawZone = {
	top: number
	left: number
	width: number
	height: number
}
export type CanvasDimensions = {
	left: number
	right: number
	top: number
	bottom: number
	centerY: number
	centerX: number
	minDim: number
	width: number
	height: number
}

export const drawZoneForElement = (el: HTMLElement): DrawZone => {
	const dpr = findDPR()
	return {
		top: el.offsetTop * dpr,
		left: el.offsetLeft * dpr,
		height: el.offsetHeight * dpr,
		width: el.offsetWidth * dpr,
	}
}

export const setupCanvas = (
	canvas: HTMLCanvasElement,
): { ctx: CanvasRenderingContext2D; dim: CanvasDimensions } => {
	const dpr = findDPR()
	const rect = canvas.getBoundingClientRect()
	canvas.width = rect.width * dpr
	canvas.height = rect.height * dpr
	const ctx = canvas.getContext('2d')!
	const dim: CanvasDimensions = {
		top: 0,
		left: 0,
		bottom: canvas.height,
		right: canvas.width,
		centerY: canvas.height / 2,
		centerX: canvas.width / 2,
		minDim: Math.min(canvas.height, canvas.width),
		width: canvas.width,
		height: canvas.height,
	}

	return { ctx, dim }
}

export abstract class CanvasElement implements Disposable {
	protected disposables = new DisposableStore()
	protected dimensions: CanvasDimensions
	protected disposed = false

	protected centerX: number
	protected centerY: number
	protected scaleFactor: number
	protected active: boolean = false

	public abstract render(): void

	protected onClick(l: Location): void {}
	protected onDrag(l: Location & { dx: number; dy: number }): void {}

	constructor(protected context: CanvasRenderingContext2D, drawZone: DrawZone) {
		this.dimensions = {
			top: drawZone.top,
			bottom: drawZone.top + drawZone.height,
			left: drawZone.left,
			right: drawZone.left + drawZone.width,
			centerY: drawZone.top + drawZone.height / 2,
			centerX: drawZone.left + drawZone.width / 2,
			width: drawZone.width,
			height: drawZone.height,
			minDim: Math.min(drawZone.height, drawZone.width),
		}

		this.scaleFactor = this.dimensions.minDim / 2
		this.centerX = this.dimensions.centerX
		this.centerY = this.dimensions.centerY

		const touchTracker = new Map<number, Location>()
		this.disposables.add({
			dispose: () =>
				this.context.clearRect(
					this.dimensions.left,
					this.dimensions.top,
					this.dimensions.width,
					this.dimensions.height,
				),
		})
		this.disposables.add({ dispose: () => (this.disposed = true) })
		this.disposables.add(
			addElementListener(this.context.canvas, 'wheel', (e) => {
				const l = this.locationOfEvent(e)
				if (this.locationInBounds(l)) {
					const dpr = findDPR()
					this.onDrag({
						dx: -e.deltaX,
						dy: -e.deltaY,
						x: e.pageX * dpr,
						y: e.pageY * dpr,
					})
				}
			}),
			addElementListener(this.context.canvas, 'touchstart', (e) => {
				e.preventDefault()
				const l = this.locationOfEvent(e)
				if (l && this.locationInBounds(l)) {
					touchTracker.set(e.changedTouches[0].identifier, l)
					this.active = true
				}
			}),
			addElementListener(this.context.canvas, 'mousedown', (e) => {
				const l = this.locationOfEvent(e)
				if (this.locationInBounds(l)) {
					this.active = true
				}
			}),
			addElementListener(this.context.canvas, 'touchend', (e) => {
				e.preventDefault()
				const l = this.locationOfEvent(e)
				if (l && this.locationInBounds(l) && this.active) {
					this.onClick(l)
				}
				this.active = false
				touchTracker.delete(e.changedTouches[0].identifier)
			}),
			addElementListener(this.context.canvas, 'mouseup', (e) => {
				const l = this.locationOfEvent(e)
				if (l && this.locationInBounds(l) && this.active) {
					this.onClick(l)
				}
				this.active = false
			}),
			addElementListener(this.context.canvas, 'touchcancel', (e) => {
				this.active = false
				touchTracker.delete(e.changedTouches[0].identifier)
			}),
			addElementListener(this.context.canvas, 'mouseleave', (e) => {
				this.active = false
			}),
			addElementListener(this.context.canvas, 'mousemove', (e) => {
				if (this.active && e.buttons) {
					const dpr = findDPR()
					this.onDrag({
						dx: e.movementX * dpr,
						dy: e.movementY * dpr,
						x: e.pageX * dpr,
						y: e.pageY * dpr,
					})
				}
			}),
			addElementListener(this.context.canvas, 'touchmove', (e) => {
				if (this.active && e.changedTouches.length === 1) {
					e.preventDefault()
					const dpr = findDPR()
					const touch = e.changedTouches[0]
					const touchLocation: Location = {
						x: touch.pageX * dpr,
						y: touch.pageY * dpr,
					}

					const priorTouch = touchTracker.get(touch.identifier)
					const movementX = priorTouch ? touchLocation.x - priorTouch.x : 0
					const movementY = priorTouch ? touchLocation.y - priorTouch.y : 0
					this.onDrag({
						dx: movementX,
						dy: movementY,
						x: touchLocation.x,
						y: touchLocation.y,
					})
					touchTracker.set(touch.identifier, touchLocation)
				}
			}),
		)
	}

	protected locationInBounds(l: Location | undefined): boolean {
		return this.locationInDrawZone(l)
	}

	protected locationOfEvent(m: CursorEvent): Location | undefined {
		let e: MouseEvent | Touch | undefined
		if (m instanceof TouchEvent) {
			if (m.changedTouches.length !== 1) return undefined
			e = m.changedTouches[0]
		} else {
			e = m
		}

		const dpr = findDPR()
		return { x: e.pageX * dpr, y: e.pageY * dpr }
	}

	protected locationInRadius(l: Location | undefined, r: number): boolean {
		if (!l) return false
		const { x, y } = l
		return (
			Math.sqrt((x - this.centerX) ** 2 + (y - this.centerY) ** 2) <
			this.scaleFactor * r
		)
	}

	protected locationInDrawZone(l: Location | undefined): boolean {
		if (!l) return false
		return (
			bound2(l.x, this.dimensions.left, this.dimensions.right) === l.x &&
			bound2(l.y, this.dimensions.top, this.dimensions.bottom) === l.y
		)
	}

	protected setLineWidth(l: number) {
		this.context.lineWidth = this.scaleFactor * l
	}

	protected traceCircle(r: number, x: number = 0, y: number = 0) {
		const { canvasX, canvasY } = this.xyToCanvasCoords(x, y)
		this.context.arc(canvasX, canvasY, this.scaleFactor * r, 0, 2 * Math.PI)
	}

	protected traceLine(x: number, y: number) {
		const { canvasX, canvasY } = this.xyToCanvasCoords(x, y)
		this.context.lineTo(canvasX, canvasY)
	}

	protected xyToCanvasCoords(x: number, y: number) {
		return {
			canvasX: this.centerX + this.scaleFactor * x,
			canvasY: this.centerY + this.scaleFactor * y,
		}
	}

	protected toElementSpace(l: Location): {
		x: number
		y: number
		r: number
		deg: number
	} {
		const x = (l.x - this.centerX) / this.scaleFactor
		const y = -(l.y - this.centerY) / this.scaleFactor
		const r = Math.sqrt(x ** 2 + y ** 2)
		const deg = atan2(x, y)
		return { x, y, r, deg }
	}

	protected getRect(r: number, deg: number) {
		return {
			x: r * cos(deg),
			y: r * -sin(deg),
		}
	}

	protected withRotation(
		deg: number,
		centerX: number,
		centerY: number,
		cb: () => void,
	) {
		const { canvasX, canvasY } = this.xyToCanvasCoords(centerX, centerY)
		this.context.translate(canvasX, canvasY)
		this.context.rotate(-degToRad(deg))
		this.context.translate(-canvasX, -canvasY)
		cb()
		this.context.translate(canvasX, canvasY)
		this.context.rotate(degToRad(deg))
		this.context.translate(-canvasX, -canvasY)
	}

	protected traceRay(
		r: number,
		deg: number,
		startX: number = 0,
		startY: number = 0,
		offset: number = 0,
	) {
		if (offset) {
			this.moveTo(startX + offset * cos(deg), startY - offset * sin(deg))
		}
		this.traceLine(startX + r * cos(deg), startY - r * sin(deg))
	}

	protected moveTo(x: number, y: number) {
		this.context.moveTo(
			this.centerX + this.scaleFactor * x,
			this.centerY + this.scaleFactor * y,
		)
	}

	protected fillText(
		x: number,
		y: number,
		text: string,
		justifyAngle: number = 90,
	) {
		const textProps = this.context.measureText(text)
		const xJustifyAdjust =
			((-0.5 * cos(justifyAngle) + 1) * textProps.width) / 2
		const yJustifyAdjust = textProps.actualBoundingBoxAscent / 2
		this.context.fillText(
			text,
			this.centerX + this.scaleFactor * x - xJustifyAdjust,
			this.centerY + this.scaleFactor * y + yJustifyAdjust,
		)
	}

	dispose(): void {
		this.disposables.clear()
	}
}
