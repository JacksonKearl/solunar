import { Disposable } from '$/types'

export const addWindowListener = <K extends keyof WindowEventMap>(
	type: K,
	listener: (this: Window, ev: WindowEventMap[K]) => any,
	options?: boolean | AddEventListenerOptions,
): Disposable => {
	window.addEventListener(type, listener, options)
	return { dispose: () => window.removeEventListener(type, listener) }
}

export const addElementListener = <K extends keyof HTMLElementEventMap>(
	element: HTMLElement,
	type: K,
	listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
	options?: boolean | AddEventListenerOptions,
): Disposable => {
	element.addEventListener(type, listener, options)
	return { dispose: () => element.removeEventListener(type, listener) }
}

export const findDPR = () => window.devicePixelRatio || 1
