import { Disposable, Entries } from './types'

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
export const sploot = (amt: number, min: number, max: number) =>
	scale(amt, 0, 1, min, max)

export const bound2 = (val: number, min: number, max: number) =>
	Math.max(min, Math.min(val, max))

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
	private watchers = new Set<(v: T) => void>()
	constructor() {
		this.view = (w) => {
			this.watchers.add(w)
			if (this.value) {
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

export const MappedView =
	<T, U>(view: View<T>, mapper: (v: T) => U): View<U> =>
	(watcher) => {
		const disposable = view((v) => watcher(mapper(v)))
		return { dispose: () => disposable.dispose() }
	}

// export const ThrottledView = <T>(
// 	view: View<T>,
// 	minTimeBetweenUpdates: number,
// ): View<T> => {
// 	return (watcher) => {
// 		let handle: number | undefined
// 		let lastForwarded: T

// 		const disposable = view((latest) => {
// 			if (lastForwarded === latest) return

// 			if (!handle) {
// 				watcher(latest)
// 				lastForwarded = latest
// 				handle = setTimeout(() => {
// 					handle = undefined
// 					if (latest !== lastForwarded) {
// 						watcher(latest)
// 						lastForwarded = latest
// 					}
// 				}, minTimeBetweenUpdates)
// 			}
// 		})

// 		return {
// 			dispose: () => {
// 				clearTimeout(handle)
// 				disposable.dispose()
// 			},
// 		}
// 	}
// }

export class DisposableStore {
	private store = new Set<Disposable>()
	clear(): void {
		this.store.forEach((v) => v.dispose())
		this.store.clear()
	}
	add<Ds extends Disposable[]>(...ds: Ds): Ds {
		ds.forEach((d) => this.store.add(d))
		return ds
	}
}

export const ViewFromArray = <T>(
	views: View<T>[],
	disposables: DisposableStore,
): View<T[]> => {
	const values: T[] = Array.from({ length: views.length })
	const watchers = new Set<(v: T[]) => void>()
	views.forEach((view, index) =>
		disposables.add(
			view((v) => {
				values[index] = v
				watchers.forEach((w) => w(values))
			}),
		),
	)
	return (w) => {
		watchers.add(w)
		return { dispose: () => watchers.delete(w) }
	}
}
