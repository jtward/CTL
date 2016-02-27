import { each, map } from 'lodash';

const rules = [{
	// whitespace
	regex: /^\s*/
}, {
	// unquoted atoms
	regex: /^(((?![FAUXGREW])[\w\d\u0391-\u03C9\u00C0-\u00FF])+)/,
	type: 'atom'
}, {
	// quoted atoms
	regex: /^(['"])(.*?)\1/,
	valueCaptureGroup: 2,
	type: 'atom'
}, {
	// boolean literals
	regex: /^\\[TF]/,
	type: 'atom'
}, {
	// operators
	regex: /^[FAUXGREW&|!()]|->/,
	type: 'operator'
}];

// turn the config into functions which create tokens from input
const tokenizers = map(rules, (rule) => {
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

export default (input) => {
	const output = [];
	let didTokenize = false;

	const appendToken = (type, value) => {
		didTokenize = true;
		output.push({
			type,
			value
		});
	};

	const skip = (n = 1) => {
		didTokenize = didTokenize || n > 0;
		input = input.slice(n);
	};

	while (input) {
		didTokenize = false;

		each(tokenizers, (rule) => {
			rule(input, appendToken, skip);
			return !didTokenize; // break out if we tokenized anything
		});

		if (!didTokenize && input) {
			throw {
				name: 'SyntaxError',
				message: `Unknown character: '${input[0]}'.`
			};
		}
	}

	return output;
};
