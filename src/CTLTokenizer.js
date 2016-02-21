const Token = (type, value) => {
	return {
		type,
		value
	};
};

const SyntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const backslash = '\\';
const dash = '-';
const rightAngleBracket = '>';
const startAtom = /^(?![FAUXGREW])[\w\d\u0391-\u03C9\u00C0-\u00FF]/;
const atom = /^(((?![FAUXGREW])[\w\d\u0391-\u03C9\u00C0-\u00FF])*)/;
const operator = /^[FAUXGREW&|!()]$/;
const whitespace = /^\s$/;
const str = /^(['"])([^\\]*?)\1/;

const isBoolean = (c) => {
	return (c === 'T') || (c === 'F');
};

const isStringDelimiter = (c) => {
	return (c === '\'') || (c === '"');
};

const tokenizeString = (delimiter, input) => {
	const matches = str.exec(input);
	if (matches) {
		return matches[2];
	}
	else if (input.indexOf(delimiter) !== -1) {
		throw SyntaxError('Backslashes are not allowed in strings!');
	}
	else {
		throw SyntaxError(`Expected ${q} but found end of input.`);
	}
};

const tokenizeAtom = (input) => {
	const matches = atom.exec(input);
	return matches[1];
};

export default (input) => {
	const result = [];
	
	if (input) {
		let c;

		const { skip, rest } = (() => {
			let i = 0;
			c = input.charAt(i);
			return {
				skip: (n = 1) => {
					i += n;
					c = input.charAt(i);
				},
				rest: () => {
					return input.slice(i);
				}
			};
		})();

		while (c) {
			// Ignore whitespace.
			if (whitespace.test(c)) {
				skip();
			}

			else if (isStringDelimiter(c)) {
				const str = tokenizeString(c, rest());
				result.push(Token('atom', str));
				skip(str.length + 2); // add 2 for the delimiters, which are not part of the string
			}

			// the non-operators '\T' and '\F' are special: they mean 'true' and 'false' respectively.
			// although 'T' would also be unambiguous, '\T' screams 'i'm special!', so there
			// is no way that \T could be confused with an ordinary property. F is an operator, so
			// we need to be able to tell F from \F (although the user could always specify !\T).
			else if (c === backslash) {
				skip(); // over backslash
				if (isBoolean(c)) {
					result.push(Token('atom', `\\${c}`));
					skip();
				}
				else {
					throw SyntaxError('Unknown character: \'\\\'');
				}
			}

			else if (operator.test(c)) {
				result.push(Token('operator', c));
				skip();
			}

			// dashes must be followed immediately by right angle brackets
			else if (c === dash) {
				skip();
				if (c === rightAngleBracket) {
					result.push(Token('operator', '->'));
					skip();
				}
				else {
					throw SyntaxError('Unknown character: \'-\'.');
				}
			}

			else if (startAtom.test(c)) {
				const atom = tokenizeAtom(rest());
				skip(atom.length);
				result.push(Token('atom', atom));
			}

			else {
				throw SyntaxError(`Unknown character: '${input.charAt(i)}'.`);
			}
		}
	}
	return result;
};
