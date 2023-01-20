// rollup.config.js
import typescript from '@rollup/plugin-typescript'

export default {
	input: 'src/dom/index.ts',
	output: {
		dir: 'public',
		format: 'esm',
	},
	plugins: [typescript()],
}
