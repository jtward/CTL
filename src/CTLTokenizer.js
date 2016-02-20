import { includes, partial } from 'lodash';

const Token = function(type, value) {
	return {
		'type': type,
		'value': value
	};
};

const SyntaxError = function(message) {
	return {
		'name': 'SyntaxError',
		'message': message
	};
};

const dash = '-';
const rightAngleBracket = '>';

const nonOpRegex = /^(?!^.*[AEXFGURW]+.*$)[\w\d\u0391-\u03C9\u00C0-\u00FF]+/;
const isNonOp = function(character) {
	return nonOpRegex.test(character);
};

const opRegex = /^[AEXFGURW&|!()]$/;
const isOp = function(character) {
	return opRegex.test(character);
};

const whitespaceRegex = /^\s$/;
const isWhitespaceChar = function(c) {
	return whitespaceRegex.test(c);
};

const isBooleanChar = function(c) {
	return (c === 'T') || (c === 'F');
};

const stringDelimiterRegex = /^['"]$/;
const isStringDelimiterChar = function(c) {
	return stringDelimiterRegex.test(c);
};

export default function(input) {
	const result = [];
	
	if (input) {
		let i = 0;
		let c = input.charAt(i);
		while (c) {
			// Ignore whitespace.
			if (isWhitespaceChar(c)) {
				i += 1;
				c = input.charAt(i);
			}

			// strings (delimited by either ' or ") can contain anything except backslashes.
			else if (isStringDelimiterChar(c)) {
				let str = '';
				let q = c;
				// skip over the opening string delimiter
				i += 1;
				for (;;) {
					c = input.charAt(i);
					if (c === '') {
						throw SyntaxError(`Expected ${q} but found end of input.`);
					}
					else if (c === '\\') {
						throw SyntaxError('Backslashes are not allowed in strings!');
					}
					i += 1;
					if (c === q) {
						break;
					}
					else {
						str += c;
					}
				}
				result.push(Token('atom', str));
				c = input.charAt(i);
			}

			// the non-operators '\T' and '\F' are special: they mean 'true' and 'false' respectively.
			// although 'T' would also be unambiguous, '\T' screams 'i'm special!', so there
			// is no way that \T could be confused with an ordinary property. F is an operator, so
			// we need to be able to tell F from \F (although the user could always specify !\T).
			else if (c === '\\') {
				let str = c;
				i += 1;
				c = input.charAt(i);
				if (isBooleanChar(c)) {
					str += c;
					i += 1;
					result.push(Token('atom', str));
					c = input.charAt(i);
				}
				else {
					throw SyntaxError(`Unknown character: '\\'`);
				}
			}

			else if (isOp(c)) {
				i += 1;
				result.push(Token('operator', c));
				c = input.charAt(i);
			}

			// dashes must be followed immediately by right angle brackets
			else if (c === dash) {
				let str = c;
				i += 1;
				c = input.charAt(i);
				if (c === rightAngleBracket) {
					str += c;
					i += 1;
					result.push(Token('operator', str));
					c = input.charAt(i);
				}
				else {
					throw SyntaxError(`Unknown character: '-'.`);
				}
			}

			// legal non-operator character
			else if (isNonOp(c)) {
				let str = c;
				i += 1;
				for (;;) {
					c = input.charAt(i);
					if (isNonOp(c)) {
						str += c;
						i += 1;
					}
					else {
						break;
					}
				}
				result.push(Token('atom', str));
				c = input.charAt(i);
			}

			else {
				throw SyntaxError(`Unknown character: '${input.charAt(i)}'.`);
			}
		}
	}
	return result;
};
