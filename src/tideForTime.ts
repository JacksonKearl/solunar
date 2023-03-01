import { dot, scale, Year } from './utils'
import { sin, cos, tan, acos, atan, wrap, cot } from './degreeMath'
import { Constituents, ConstituentData } from './constituents'
import { OrbitState, LunarNodeState, Station, UnixTime } from './types'

const OrbitStateToArray = (o: OrbitState) => [o.T, o.s, o.h, o.p, o.p1, 1]
// Schureman, page 179
const OrbitVelocities: OrbitState = {
	T: 15.0,
	s: 0.54901653,
	h: 0.041068639,
	p: 0.00464183,
	p1: 0.00000196,
	N: -0.00220641,
}

const EpochTime = new Date('1900')
// Schureman, page 179
const EpochState: OrbitState = {
	T: 180.0,
	s: 277.026,
	h: 280.19,
	p: 334.384,
	p1: 281.221,
	N: 259.156,
}

const OrbitAtTime = (time: UnixTime): Record<keyof OrbitState, number> => {
	const deltaHours = (+time - +EpochTime) / 1000 / 60 / 60
	return {
		T: OrbitVelocities.T * deltaHours + EpochState.T,
		s: OrbitVelocities.s * deltaHours + EpochState.s,
		h: OrbitVelocities.h * deltaHours + EpochState.h,
		p: OrbitVelocities.p * deltaHours + EpochState.p,
		p1: OrbitVelocities.p1 * deltaHours + EpochState.p1,
		N: OrbitVelocities.N * deltaHours + EpochState.N,
	}
}

const LunarNodeStateToArray = (s: LunarNodeState) => [
	s.Xi,
	s.Nu,
	s.NuPrime,
	s.NuDoublePrime,
	s.R,
	s.Q,
]

const LunarNodeStateForOrbit = (orbit: OrbitState): LunarNodeState => {
	const { N, p } = orbit

	// tan 1/2 (N - Xi + Nu) = 1.01883 tan 1/2 N
	// tan 1/2 (N - Xi - Nu) = 0.64412 tan 1/2 N
	// Schureman, page 172
	const i = atan(1.01883 * tan(N / 2))
	const j = atan(0.64412 * tan(N / 2))
	const Nu = i - j
	const Xi = N - i - j

	// cos(I) = 0.91370 - 0.03569 * cos(N)
	// Schureman, page 172
	const I = acos(0.9137 - 0.03569 * cos(N))

	// Nu' = atan[ ( sin 2I sin Nu ) / ( sin 2I cos Nu + 0.3347 ) ]
	// Schureman, page 51
	const NuPrime = atan((sin(2 * I) * sin(Nu)) / (sin(2 * I) * cos(Nu) + 0.3347))

	// 2Nu'' = atan[ ( sin^2 I * sin 2Nu ) / ( sin^2 I cos 2Nu + 0.0727 ) ]
	// Schureman, page 52
	const NuDoublePrime =
		atan((sin(I) ** 2 * sin(2 * Nu)) / (sin(I) ** 2 * cos(2 * Nu) + 0.0727)) / 2

	// p = P + Xi
	// Schureman, page 47
	const P = wrap(p - Xi)

	// R = atan[ sin 2P / ( 1/6 cot^2 1/2 I - cos 2P ) ]
	// Schureman, page 50
	const R = atan(sin(2 * P) / (cot(I / 2) ** 2 / 6 - cos(2 * P)))

	// Q = atan [ (5 cos I - 1) / (7 cos I + 1) * tan P ]
	// Schureman, page 48
	const Q =
		atan(((5 * cos(I) - 1) / (7 * cos(I) + 1)) * tan(P)) +
		// Adjustment for quadrant selection
		(P > 90 ? 180 : 0) +
		(P > 270 ? 180 : 0)

	return { Xi, Nu, NuPrime, NuDoublePrime, R, Q, I, P }
}

const UniversalStateAtTime = (time: UnixTime) => {
	const orbit = OrbitAtTime(time)
	const lunarNode = LunarNodeStateForOrbit(orbit)

	const orbitVector = OrbitStateToArray(orbit)
	const lunarVector = LunarNodeStateToArray(lunarNode)
	return { orbitVector, lunarVector, lunarNode }
}

// Computed exactly how Schureman does it, with the Orbit data taken from the
// year start and the LunarNode data taken from the midpoint of the year.
// This is probably less precise than could be achieved using contemporary data,
// but is good for verification.
const ConstituentArgumentForYear = (
	constituent: ConstituentData,
	year: number,
): number => {
	const tStart = +Year(year)
	const o = OrbitAtTime(tStart)

	const tMid = (+Year(year) + +Year(year + 1)) / 2
	const oMid = OrbitAtTime(tMid)
	const l = LunarNodeStateForOrbit(oMid)

	const V = dot(constituent.V, OrbitStateToArray(o))
	const u = dot(constituent.u, LunarNodeStateToArray(l))

	return wrap(V + u)
}

const FactorFForYear = (constituent: ConstituentData, year: number): number => {
	const tStart = Year(year)
	const o = OrbitAtTime(+tStart)

	const tMid = (+Year(year) + +Year(year + 1)) / 2
	const oMid = OrbitAtTime(tMid)
	const l = LunarNodeStateForOrbit(oMid)

	return constituent.f(l)
}

const ConstituentArgumentAtTime = (
	constituent: ConstituentData,
	time: UnixTime,
): number => {
	const o = OrbitAtTime(time)
	const l = LunarNodeStateForOrbit(o)
	const V = dot(constituent.V, OrbitStateToArray(o))
	const u = dot(constituent.u, LunarNodeStateToArray(l))
	return wrap(V + u)
}

export type ConstituentContribution = {
	argument: number
	amplitude: number
	degreesPerSecond: number
}

export type TideOScopeDataPoint = {
	flow: number
	total: number
	time: UnixTime
	constituents: Record<string, ConstituentContribution>
}

export const StationLevelAtTime = (
	station: Station,
	time: UnixTime,
	includeConstituents: boolean,
	constituentScale = (degPerSec: number) => 1,
): TideOScopeDataPoint => {
	const vT = UniversalStateAtTime(time)
	const vTNext = UniversalStateAtTime(+time + 1000)

	const constituents: Record<string, ConstituentContribution> = {}
	let totalFlow = 0
	let totalOffset = 0
	for (const harmonic of station.harcon) {
		const cData = Constituents[harmonic.name]

		if (!cData) {
			// console.error(
			// 	'Dam! Missing reference data for',
			// 	harmonic.name,
			// 	'in station',
			// 	station.name + '.',
			// 	'Continuing merrily along with head buried in sand!',
			// )
			continue
		}

		const Vu = dot(cData.V, vT.orbitVector) + dot(cData.u, vT.lunarVector)
		const VuNext =
			dot(cData.V, vTNext.orbitVector) + dot(cData.u, vTNext.lunarVector)
		const degreesPerSecond = VuNext - Vu

		const scale = constituentScale(degreesPerSecond)

		const f = cData.f(vT.lunarNode) * scale
		const phaseLag = harmonic.phaseLag
		const amplitude = f * harmonic.amplitude
		const argument = wrap(Vu - phaseLag)
		const offset = f * amplitude * cos(argument)
		const constituentContribution: ConstituentContribution = {
			amplitude,
			argument,
			degreesPerSecond,
		}
		if (includeConstituents) {
			constituents[harmonic.name] = constituentContribution
		}
		totalOffset += offset

		const offsetNext = f * amplitude * cos(VuNext - phaseLag)
		totalFlow += (offsetNext - offset) * 60 * 60
	}

	return { total: totalOffset, flow: totalFlow, constituents, time }
}

// An Epoch for New Moons. Astronomical Algorithms, Jean Meeus
const FirstLunation = new Date('2000-01-06T18:14')
// Synodical Month, Schureman, page 179
export const LunarSynodicalSpeed = OrbitVelocities.s - OrbitVelocities.h
export const MoonSynodicalAngleAtTime = (time: UnixTime) => {
	const deltaHours = (time - +FirstLunation) / (1000 * 60 * 60)
	const deltaDegrees = deltaHours * LunarSynodicalSpeed
	return wrap(deltaDegrees)
}

// Tropical Month, Schureman, page 179
export const LunarTropicalSpeed = OrbitVelocities.s
export const MoonTropicalAngleAtTime = (time: UnixTime) => {
	const phaseOffset = SolarAngleAtTime(+FirstLunation)
	const deltaHours = (time - +FirstLunation) / (1000 * 60 * 60)
	const deltaDegrees = deltaHours * LunarTropicalSpeed + phaseOffset
	return wrap(deltaDegrees)
}

export const SolarAngleAtTime = (time: UnixTime) => {
	const yearStart = new Date(time)
	yearStart.setUTCMonth(0, 1)
	yearStart.setUTCHours(0, 0, 0, 0)

	const yearEnd = new Date(yearStart)
	yearEnd.setUTCFullYear(yearStart.getUTCFullYear() + 1)

	return scale(time, +yearStart, +yearEnd, 0, 360)
}
