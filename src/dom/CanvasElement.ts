import { bound2, DisposableStore, Observable, View } from '../utils.js'
import { Disposable } from '../types.js'
import { addElementListener, findDPR } from './utils.js'

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
	protected store = new DisposableStore()
	protected dimensions: CanvasDimensions
	protected disposed = false

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

		const touchTracker = new Map<number, Location>()
		this.scaleFactor = this.dimensions.minDim / 2
		this.store.add({ dispose: () => (this.disposed = true) })
		this.store.add(
			addElementListener(this.context.canvas, 'click', (e) => {
				const l = this.locationOfEvent(e)
				if (l && this.locationInDrawZone(l)) {
					this.onClick(l)
				}
			}),
			addElementListener(this.context.canvas, 'touchstart', (e) => {
				const l = this.locationOfEvent(e)
				if (l && this.locationInDrawZone(l)) {
					touchTracker.set(e.touches[0].identifier, l)
					this.active = true
				}
			}),
			addElementListener(this.context.canvas, 'mousedown', (e) => {
				const l = this.locationOfEvent(e)
				if (this.locationInDrawZone(l)) {
					this.active = true
				}
			}),
			addElementListener(this.context.canvas, 'touchend', (e) => {
				this.active = false
				touchTracker.delete(e.touches[0].identifier)
			}),
			addElementListener(this.context.canvas, 'mouseup', (e) => {
				this.active = false
			}),
			addElementListener(this.context.canvas, 'touchcancel', (e) => {
				this.active = false
				touchTracker.delete(e.touches[0].identifier)
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
				if (this.active && e.touches.length === 1) {
					e.preventDefault()
					const touch = e.touches[0]
					const priorTouch = touchTracker.get(touch.identifier)
					const movementX = priorTouch ? touch.pageX - priorTouch.x : 0
					const movementY = priorTouch ? touch.pageY - priorTouch.y : 0
					const dpr = findDPR()
					const location = { x: touch.pageX * dpr, y: touch.pageY * dpr }
					this.onDrag({
						dx: movementX * dpr,
						dy: movementY * dpr,
						...location,
					})
					touchTracker.set(touch.identifier, location)
				}
			}),
		)
	}

	protected locationOfEvent(m: CursorEvent): Location | undefined {
		let e: MouseEvent | Touch | undefined
		if (m instanceof TouchEvent) {
			if (m.touches.length !== 1) return undefined
			e = m.touches[0]
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
			Math.sqrt(
				(x - this.dimensions.centerX) ** 2 + (y - this.dimensions.centerY) ** 2,
			) <
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

	protected traceCircle(r: number, x: number = 0, y: number = 0) {
		this.context.arc(
			this.dimensions.centerX + this.scaleFactor * x,
			this.dimensions.centerY + this.scaleFactor * y,
			this.scaleFactor * r,
			0,
			2 * Math.PI,
		)
	}

	protected traceLine(x: number, y: number) {
		this.context.lineTo(
			this.dimensions.centerX + this.scaleFactor * x,
			this.dimensions.centerY + this.scaleFactor * y,
		)
	}

	protected moveTo(x: number, y: number) {
		this.context.moveTo(
			this.dimensions.centerX + this.scaleFactor * x,
			this.dimensions.centerY + this.scaleFactor * y,
		)
	}

	protected fillText(
		x: number,
		y: number,
		text: string,
		justify: 'center' | 'left' | 'right' = 'center',
	) {
		const textProps = this.context.measureText(text)
		const xJustifyAdjust = {
			center: textProps.width / 2,
			left: 0,
			right: textProps.width,
		}[justify]
		const yJustifyAdjust = textProps.fontBoundingBoxAscent / 2

		this.context.fillText(
			text.toLocaleUpperCase(),
			this.dimensions.centerX + this.scaleFactor * x - xJustifyAdjust,
			this.dimensions.centerY + this.scaleFactor * y + yJustifyAdjust,
		)
	}

	dispose(): void {
		this.store.clear()
	}
}
