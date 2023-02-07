import replace from '@rollup/plugin-replace'
import typescript from '@rollup/plugin-typescript'
import * as dotenv from 'dotenv'
dotenv.config()

export default {
	input: 'src/dom/index.ts',
	output: {
		dir: 'public',
		format: 'esm',
	},
	plugins: [
		typescript(),
		replace({
			__rollup_ARCGIS_KEY: process.env.ARCGIS_KEY,
			preventAssignment: true,
		}),
	],
}
