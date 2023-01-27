export type UnixTime = number

export type OrbitState = {
	/** Earth */
	T: number
	/** Moon */
	s: number
	/** Sun */
	h: number
	/** Lunar perigee */
	p: number
	/** Solar perigee */
	p1: number
	/** Lunar node */
	N: number
}

export type LunarNodeState = {
	/** Angle from Lunar Intersection to projection of Vernal Equinox onto Moon's Orbit */
	Xi: number
	/** Angle from Lunar Intersection to Vernal Equinox */
	Nu: number
	/** Derivative of Nu */
	NuPrime: number
	/** Derivative of NuPrime */
	NuDoublePrime: number
	/** Inclination of Moons Orbit relative to Equator */
	I: number
	/** Mean Longitude of the Lunar Perigee reckoned from Lunar Intersection */
	P: number

	// Helpful intermediary values
	R: number
	Q: number
}

export type DatumName = 'MHHW' | 'MHW' | 'MSL' | 'MLW' | 'MLLW'

export type Station = {
	id: string
	name: string
	lat: number
	lng: number
	state: string
	timezone: string | null
	timezoneOffset: number | null
	harcon: StationHarmonic[]
	datums: Record<DatumName, number>
	missingData?: true
}

export type StationHarmonic = {
	name: ConstituentName
	amplitude: number
	phaseLag: number
}

// prettier-ignore
export const ConstituentNames = [
	'J1', 'K1', 'K2', 'L2', 'M1',
	'M2', 'M3', 'M4', 'M6', 'M8',
	'N2', '2N', 'O1', 'OO',
	'P1', 'Q1', '2Q', 'R2',
	'S1', 'S2', 'S4', 'S6', 'T2',
	'Lambda2', 'Mu2', 'Nu2', 'Rho1',
	'MK', '2MK', 'MN', 'MS', '2SM',
	'Mf', 'MSf', 'Mm',
	'Sa', 'Ssa',
] as const;

export type ConstituentName = typeof ConstituentNames[number]

export type Disposable = { dispose(): void }
