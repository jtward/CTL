// lodash-like version of each which stops if the iteratee returns false
const each = (arr, f) => {
	let index = -1;
	while (++index < arr.length) {
		if (f(arr[index]) === false) {
			break;
		}
	}
};

// turn the config into functions which create tokens from input
const getTokenizeRules = (rules) => {
	return rules.map((rule) => {
		return (input, appendToken, skip) => {
			const matches = rule.regex.exec(input);
			if (matches) {
				const token = rule.type ? appendToken(rule.type, matches[rule.valueCaptureGroup || 0]) : undefined;
				skip(matches[0], token);
			}
		};
	});
};

export default (rules) => {
	const tokenizeRules = getTokenizeRules(rules);

	return (input) => {

		const output = [];
		let line = 0;
		let column = 0;
		let didTokenize = false;

		const appendToken = (type, value) => {
			didTokenize = true;

			const token = {
				type,
				value,
				loc: {
					start: {
						line,
						column
					}
				}
			};

			output.push(token);
			return token;
		};

		const skip = (value, token) => {
			for (const char of value) {
				if (char === '\n') {
					line += 1;
					column = 0;
				}
				else {
					column += 1;
				}
			}

			if (token) {
				token.loc.end = {
					line,
					column
				};
			}

			didTokenize = didTokenize || value.length > 0;
			input = input.slice(value.length);
		};

		const tokenize = (rule) => {
			rule(input, appendToken, skip);
			return !didTokenize; // break out if we tokenized anything
		};

		while (input) {
			didTokenize = false;

			each(tokenizeRules, tokenize);

			if (!didTokenize && input) {
				throw {
					name: 'SyntaxError',
					message: `Unknown character: '${input[0]}'.`
				};
			}
		}

		return output;
	};
};
