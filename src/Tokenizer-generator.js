import 'babel-polyfill';
import { each, map } from 'lodash';

// turn the config into functions which create tokens from input
const getTokenizeRules = (rules) => {
	return map(rules, (rule) => {
		return (input, appendToken, skip) => {
			const matches = rule.regex.exec(input);
			if (matches) {
				if (rule.type) {
					appendToken(rule.type, matches[rule.valueCaptureGroup || 0]);
				}
				skip(matches[0].length);
			}
		};
	});
};

export default (rules) => {
	const tokenizeRules = getTokenizeRules(rules);

	return function* (input) {
		let token = undefined;

		const appendToken = (type, value) => {
			token = {
				type,
				value
			};
		};

		const skip = (n) => {
			token = token || n > 0;
			input = input.slice(n);
		};

		const tokenize = (rule) => {
			rule(input, appendToken, skip);
			return !token; // break out if we tokenized anything
		};

		while (input) {
			token = undefined;
			each(tokenizeRules, tokenize);

			if (typeof token === 'object') {
				yield token;
			}

			if (!token && input) {
				throw {
					name: 'SyntaxError',
					message: `Unknown character: '${input[0]}'.`
				};
			}
		}
	};
};
