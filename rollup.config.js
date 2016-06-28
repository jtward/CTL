import { rollup } from 'rollup';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
	entry: 'src/CTL.js',
	plugins: [
		nodeResolve({ jsnext: true })
	],
	dest: 'lib/CTL.js'
};
