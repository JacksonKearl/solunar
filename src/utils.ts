import { Disposable } from './types'

export const dot = (a: (number | undefined)[], b: (number | undefined)[]) => {
	const l = Math.min(a.length, b.length)
	let result = 0
	for (let i = 0; i < l; i++) {
		result += (a[i] ?? 0) * (b[i] ?? 0)
	}
	return result
}

export const Year = (yearNumber: number): Date => new Date(String(yearNumber))

export const scale = (
	value: number,
	inMin: number,
	inMax: number,
	outMin: number,
	outMax: number,
) => ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin

/** rescale amt from 0-1 to min-max */
export const sploot = (amt: number, min: number, max: number): number =>
	scale(amt, 0, 1, min, max)

export const bound2 = (val: number, min: number, max: number): number =>
	min > max ? bound2(val, max, min) : Math.max(min, Math.min(val, max))

const perfStart = performance.now()
let last = perfStart
export const logTime = (msg: string) => {
	const now = performance.now()
	console.log(msg, now - last)
	last = now
}

export type View<T> = { (viewer: (value: T) => void): Disposable }
export class Observable<T> {
	view: View<T>
	value: T | undefined
	protected watchers = new Set<(v: T) => void>()
	constructor() {
		this.view = (w) => {
			this.watchers.add(w)
			if (this.value !== undefined) {
				w(this.value)
			}
			return { dispose: () => this.watchers.delete(w) }
		}
	}
	set(v: T) {
		if (v !== this.value) {
			this.value = v
			this.watchers.forEach((w) => w(v))
		}
	}
}
export class Event extends Observable<void> {
	constructor() {
		super()
	}
	fire() {
		this.watchers.forEach((w) => w())
	}
}

export const MappedView =
	<T, U>(view: View<T>, mapper: (v: T) => U): View<U> =>
	(watcher) => {
		const disposable = view((v) => watcher(mapper(v)))
		return { dispose: () => disposable.dispose() }
	}

type ViewType<V> = V extends View<infer T>
	? T
	: V extends Array<View<any>>
	? { [K in keyof V]: ViewType<V[K]> }
	: never

export const ArrayView =
	<Ts extends View<any>[]>(...views: Ts): View<ViewType<Ts>> =>
	(watcher) => {
		const store = new DisposableStore()
		const numViews = views.length

		const touched = Array.from({ length: numViews }, () => false)
		const data: ViewType<Ts> = Array.from({
			length: numViews,
		}) as ViewType<Ts>

		const triggerIfAllDefined = () => {
			if (touched.every((v) => v)) {
				watcher(data)
			}
		}

		for (let i = 0; i < numViews; i++) {
			store.add(
				views[i]((v) => {
					data[i] = v
					touched[i] = true
					triggerIfAllDefined()
				}),
			)
		}

		return store
	}

export class LocalStorageState<V> implements Disposable {
	private _value: V
	public get value(): V {
		return this._value
	}
	public set value(value: V) {
		this._value = value
		localStorage.setItem(this.id, this.serializer(this._value))
	}
	constructor(
		private id: string,
		defaultValue: V,
		private serializer: (v: V) => string = JSON.stringify,
		deserializer: (s: string) => V = JSON.parse,
	) {
		this._value = defaultValue
		const prior = localStorage.getItem(id)
		if (prior) {
			try {
				this.value = deserializer(prior)
			} catch (e) {
				console.error(
					'Error deserializing key',
					id,
					'from local storage data ',
					prior,
					e,
				)
			}
		}
	}

	dispose(): void {
		localStorage.setItem(this.id, this.serializer(this.value))
	}
}

export class DisposableStore implements Disposable {
	private store = new Set<Disposable>()
	public isDisposed = false
	clear(): void {
		this.store.forEach((d) => d.dispose())
		this.store.clear()
	}
	add<Ds extends Disposable[]>(...ds: Ds): Ds {
		if (this.isDisposed) {
			console.trace(
				'Alert! Attempting to add to a disposed store. This is probably a bug. These objects will be immediately disposed:',
				ds,
			)
			ds.forEach((d) => d.dispose())
		} else {
			ds.forEach((d) => this.store.add(d))
		}
		return ds
	}
	dispose(): void {
		this.clear()
		this.isDisposed = true
	}
}

export const time = <T>(f: () => T): T => {
	const start = Date.now()
	const r = f()
	if (r instanceof Promise) {
		r.then(() => console.log(f, Date.now() - start))
	} else {
		console.log(f, Date.now() - start)
	}

	return r
}

export const nbsp = '\xa0'

export const sigfig = (n: number, sig: number): string => {
	const isNeg = n < 0
	if (isNeg) n = -n

	const magnitude = 10 ** Math.floor(Math.log10(n))
	const reduced = n / magnitude
	const shift = 10 ** (sig - 1)
	const rounded = Math.round(reduced * shift) / shift

	let string = String(rounded * magnitude)

	const hasDecimal = string.includes('.')
	if (hasDecimal) {
		string = string.slice(0, sig + 1)
	}
	if (!hasDecimal && string.length < sig) {
		string += '.'
	}
	string = string.padEnd(sig + 1, '0')

	if (isNeg) string = '-' + string
	else string = nbsp + string

	return string
}
