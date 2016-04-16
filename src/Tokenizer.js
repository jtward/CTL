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

	return (input) => {
	
		const output = [];
		let didTokenize = false;

		const appendToken = (type, value) => {
			didTokenize = true;
			output.push({
				type,
				value
			});
		};

		const skip = (n) => {
			didTokenize = didTokenize || n > 0;
			input = input.slice(n);
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
