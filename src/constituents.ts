import { FactorFs, fFormula } from './factorF.js'
import { ConstituentName } from './types.js'

type CMap<T> = Record<ConstituentName, T>

// coefficients to be dotted with < T, s, h, p, p1, unity >
type V = [number?, number?, number?, number?, number?, number?]
// coefficients to be dotted with < Xi, Nu, NuPrime, NuDoublePrime, R, Q >
type u = [number?, number?, number?, number?, number?, number?]

export type ConstituentData = {
	description?: string
	group?: string

	V: V
	u: u

	f: fFormula
}

const unity = () => 1

// Schureman, page 180
export const Constituents: CMap<ConstituentData> = {
	'J1': {
		V: [1, 1, 1, -1, 0, -90],
		u: [0, -1],
		f: FactorFs[76],
	},
	'K1': {
		V: [1, 0, 1, 0, 0, -90],
		u: [0, 0, -1],
		f: FactorFs[227],
	},
	'K2': {
		V: [2, 0, 2],
		u: [0, 0, 0, -2],
		f: FactorFs[235],
	},
	'L2': {
		V: [2, -1, 2, -1, 0, 180],
		u: [2, -2, 0, 0, -1],
		f: FactorFs[215],
	},
	'M1': {
		V: [1, -1, 1, 0, 0, -90],
		u: [1, -1, 0, 0, 0, 1],
		f: FactorFs[206],
	},

	'M2': {
		V: [2, -2, 2],
		u: [2, -2],
		f: FactorFs[78],
	},
	'M3': {
		V: [3, -3, 3],
		u: [3, -3],
		f: FactorFs[149],
	},
	'M4': {
		V: [4, -4, 4],
		u: [4, -4],
		f: (l) => Constituents.M2.f(l) ** 2,
	},
	'M6': {
		V: [6, -6, 6],
		u: [6, -6],
		f: (l) => Constituents.M2.f(l) ** 3,
	},
	'M8': {
		V: [8, -8, 8],
		u: [8, -8],
		f: (l) => Constituents.M2.f(l) ** 4,
	},

	'N2': {
		V: [2, -3, 2, 1],
		u: [2, -2],
		f: FactorFs[78],
	},
	'2N': {
		V: [2, -4, 2, 2],
		u: [2, -2],
		f: FactorFs[78],
	},
	'O1': {
		V: [1, -2, 1, 0, 0, 90],
		u: [2, -1],
		f: FactorFs[75],
	},
	'OO': {
		V: [1, 2, 1, 0, 0, -90],
		u: [-2, -1],
		f: FactorFs[77],
	},

	'P1': { V: [1, 0, -1, 0, 0, 90], u: [], f: unity },
	'Q1': {
		V: [1, -3, 1, 1, 0, 90],
		u: [2, -1],
		f: FactorFs[75],
	},
	'2Q': {
		V: [1, -4, 1, 2, 0, 90],
		u: [2, -1],
		f: FactorFs[75],
	},
	'R2': { V: [2, 0, 1, 0, -1, 180], u: [], f: unity },

	'S1': { V: [1], u: [], f: unity },
	'S2': { V: [2], u: [], f: unity },
	'S4': { V: [4], u: [], f: unity },
	'S6': { V: [6], u: [], f: unity },
	'T2': { V: [2, 0, -1, 0, 1], u: [], f: unity },

	'Lambda2': {
		V: [2, -1, 0, 1, 0, 180],
		u: [2, -2],
		f: FactorFs[78],
	},
	'Mu2': {
		V: [2, -4, 4],
		u: [2, -2],
		f: FactorFs[78],
	},
	'Nu2': {
		V: [2, -3, 4, -1],
		u: [2, -2],
		f: FactorFs[78],
	},
	'Rho1': {
		V: [1, -3, 3, -1, 0, 90],
		u: [2, -1],
		f: FactorFs[75],
	},

	'MK': {
		V: [3, -2, 3, 0, 0, -90],
		u: [2, -2, -1],
		f: (l) => Constituents.M2.f(l) * Constituents.K1.f(l),
	},
	'2MK': {
		V: [3, -4, 3, 0, 0, 90],
		u: [4, -4, 1],
		f: (l) => Constituents.M2.f(l) ** 2 * Constituents.K1.f(l),
	},
	'MN': {
		V: [4, -5, 4, 1],
		u: [4, -4],
		f: (l) => Constituents.M2.f(l) ** 2,
	},
	'MS': {
		V: [4, -2, 2],
		u: [2, -2],
		f: (l) => Constituents.M2.f(l) ** 2,
	},
	'2SM': {
		V: [2, 2, -2],
		u: [-2, 2],
		f: (l) => Constituents.M2.f(l),
	},

	'Mf': { V: [0, 2], u: [-2], f: FactorFs[74] },
	'MSf': { V: [0, 2, -2], u: [], f: FactorFs[73] },
	'Mm': { V: [0, 1, 0, -1], u: [], f: FactorFs[73] },

	'Sa': { V: [0, 0, 1], u: [], f: unity },
	'Ssa': { V: [0, 0, 2], u: [], f: unity },
}
