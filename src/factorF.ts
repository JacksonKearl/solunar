import { sin, cos, tan } from './degreeMath'
import { LunarNodeState } from './types'

export type fFormula = (l: LunarNodeState) => number

// 1/Qa = [ 1/4 + (3/2 cos I / cos^2 1/2 I) * cos 2P + 9/4 cos^2 I / cos^4 1/2 I ]^(1/2)
// Schureman, page 47
const QaInv = (l: LunarNodeState) =>
	Math.sqrt(
		1 / 4 +
			(3 / 2) * (cos(l.I) / cos(l.I / 2) ** 2) * cos(2 * l.P) +
			(9 / 4) * (cos(l.I) ** 2 / cos(l.I / 2) ** 4),
	)

// 1/Ra = (1 - 12 tan^2 1/2 I cos 2P + 36tan^4 I/2)^(1/2)
// Schureman, page 50
const RaInv = (l: LunarNodeState) =>
	Math.sqrt(1 - 12 * tan(l.I / 2) ** 2 * cos(2 * l.P) + 36 * tan(l.I / 2) ** 4)

type EqDB = 73 | 74 | 75 | 76 | 77 | 78 | 149 | 206 | 215 | 227 | 235
export const FactorFs: Record<EqDB, fFormula> = {
	73: ({ I }) => (2 / 3 - sin(I) ** 2) / 0.5021,
	74: ({ I }) => sin(I) ** 2 / 0.1578,
	75: ({ I }) => (sin(I) * cos(I / 2) ** 2) / 0.38,
	76: ({ I }) => sin(2 * I) / 0.7214,
	77: ({ I }) => (sin(I) * sin(I / 2) ** 2) / 0.0164,
	78: ({ I }) => cos(I / 2) ** 4 / 0.9154,
	149: ({ I }) => cos(I / 2) ** 6 / 0.8758,
	206: (l) => FactorFs[75](l) * QaInv(l),
	215: (l) => FactorFs[78](l) * RaInv(l),
	227: ({ I, Nu }) =>
		Math.sqrt(
			0.8965 * sin(2 * I) ** 2 + 0.6001 * sin(2 * I) * cos(Nu) + 0.1006,
		),
	235: ({ I, Nu }) =>
		Math.sqrt(
			19.0444 * sin(I) ** 4 + 2.7702 * sin(I) ** 2 * cos(2 * Nu) + 0.0981,
		),
}
