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
	return {
		// TODO: do refs retained here cause the very problem this aims to solve?
		dispose: () => element.removeEventListener(type, listener),
	}
}

type OnEvents<L> = {
	[K in `on${keyof HTMLElementEventMap}`]?: K extends `on${infer E extends keyof HTMLElementEventMap}`
		? (this: L, ev: HTMLElementEventMap[E]) => any
		: never
}

type Attrs<E> = OnEvents<E> | Record<string, string | boolean | number>

export const findDPR = () => window.devicePixelRatio || 1

type SelectorToHTMLElement<S extends string> = S extends
	| `${infer T}.${string}`
	| `${infer T}#${string}`
	? SelectorToHTMLElement<T>
	: S extends ''
	? SelectorToHTMLElement<'div'>
	: S extends keyof HTMLElementTagNameMap
	? HTMLElementTagNameMap[S]
	: never

type $ =
	| (<S extends string>(
			selector: S,
			attrs: Attrs<SelectorToHTMLElement<S>>,
			...children: (Node | string)[]
	  ) => SelectorToHTMLElement<S>) &
			(<S extends string>(
				selector: S,
				...children: (Node | string)[]
			) => SelectorToHTMLElement<S>)

export const $: $ = <S extends string>(
	selector: S,
	...rest:
		| [Attrs<SelectorToHTMLElement<S>>, ...(Node | string)[]]
		| (Node | string)[]
): SelectorToHTMLElement<S> => {
	const { tag, id, classes } = parseSelector(selector)
	const el = document.createElement(tag) as SelectorToHTMLElement<S>
	if (id) el.id = id
	if (classes.length) el.classList.add(...classes)

	let children: (Node | string)[]
	if (
		rest.length === 0 ||
		typeof rest[0] === 'string' ||
		rest[0] instanceof HTMLElement
	) {
		children = rest as (Node | string)[]
	} else {
		const attrs = rest[0]
		Object.entries(attrs).forEach(([k, v]) => {
			if (k.startsWith('on')) {
				// hm
				addElementListener(el, k.slice(2) as any, v)
			} else {
				if (v === false) {
					el.removeAttribute(k)
				} else {
					el.setAttribute(k, v)
				}
			}
		})
		children = rest.slice(1) as (Node | string)[]
	}

	children.forEach((child) => {
		if (typeof child === 'string') {
			child = document.createTextNode(child)
		}
		el.appendChild(child)
	})

	return el
}

// this ought to be mich simpler, but I got into an optimization groove and here we are
// at least it's fast.
type ElementDescription = { tag: string; id: string; classes: string[] }
const parseSelector = (s: string): ElementDescription => {
	const r: ElementDescription = {
		tag: '',
		id: '',
		classes: [] as string[],
	}
	let part: keyof ElementDescription = 'tag'
	let i = 0
	let pieceStart = 0

	const flush = () => {
		const piece = s.slice(pieceStart, i)
		if (!piece) return

		if (part === 'classes') {
			r[part].push(piece)
		} else {
			if (r[part]) {
				throw Error('bad selector format: ' + s)
			}
			r[part] = piece
		}
	}

	while (i < s.length) {
		const c = s[i]
		if (c === '.' || c === '#') {
			flush()
			pieceStart = i + 1
			if (c === '.') part = 'classes'
			if (c === '#') part = 'id'
		}
		i++
	}
	flush()
	r.tag ||= 'div'
	return r
}

export const clearElement = (el: HTMLElement) => {
	while (el.firstChild) el.removeChild(el.firstChild)
}

export const a = (content: string | Node, href: string) =>
	$('a', { href, target: '_blank' }, content)
