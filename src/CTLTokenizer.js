import {includes} from 'lodash';

var Token = function(type, value) {
	return {
		'type': type,
		'value': value
	};
};

var SyntaxError = function(message) {
	return {
		'name': 'SyntaxError',
		'message': message
	};
};

var prefix = '-';
var suffix = '>';
var nonOpRegex = /^(?!^.*[AEXFGURW]+.*$)[\w\d\u0391-\u03C9\u00C0-\u00FF]+/;
var isNonOp = function(character) {
	return nonOpRegex.test(character);
};

var opRegex = /^[AEXFGURW&|!()]$/;
var isOp = function(character) {
	return opRegex.test(character);
};

var whitespaceRegex = /^\s$/;

export default function(input) {
	var c = 0, // The current character.
		from = 0, // The index of the start of the token.
		i = 0, // The index of the current character.
		length = input.length,
		n, // The number value.
		q, // The quote character.
		str, // The string value.
		result = [];
	
	// Begin tokenization. If the source string is empty, return nothing.
	if(!input) {
		return [];
	}

	c = input.charAt(i);
	while(c) {
		from = i;
		// Ignore whitespace.
		if (whitespaceRegex.test(c)) {
			i += 1;
			c = input.charAt(i);
		}
		//strings (delimited by either ' or ") can contain anything except backslashes.
		else if (c === '"' || c === '\'') {
			str = '';
			q = c;
			//skip over the opening string delimiter
			i += 1;
			for(;;) {
				c = input.charAt(i);
				if(c === '') {
					throw SyntaxError('Expected '+q+' but found end of input');
				}
				else if(c === '\\') {
					throw SyntaxError('Backslashes are not allowed in strings!');
				}
				i += 1;
				if(c === q) {
					break;
				}
				else {
					str += c;
				}
			}
			result.push(Token('atom', str));
			c = input.charAt(i);
		}

		//the non-operators '\T' and '\F' are special: they mean 'true' and 'false' respectively.
		// although 'T' would also be unambiguous, '\T' screams 'i'm special!', so there
		// is no way that \T could be confused with an ordinary property. F is an operator, so
		// we need to be able to tell F from \F (although the user could always specify !\T).
		else if(c === '\\') {
			var specials = ['T', 'F'];
			str = '\\';
			i += 1;
			c = input.charAt(i);
			if(includes(specials, c)) {
				str += c;
				i += 1;
				result.push(Token('atom', str));
				c = input.charAt(i);
			}
			else {
				throw SyntaxError('Unknown character: \'\\\'');
			}
		}
		
		//legal non-operator character
		else if(isNonOp(c)) {
			str = ''+c;
			i += 1;
			for(;;) {
				c = input.charAt(i);
				if(isNonOp(c)) {
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
		
		//prefix character (i.e. '-'; look for '>' next)
		else if(prefix.indexOf(c) >= 0) {
			str = c;
			i += 1;
			while(i < length) {
				c = input.charAt(i);
				if(suffix.indexOf(c)) {
					break;
				}
				str += c;
				i += 1;
			}
			result.push(Token('operator', str));
			c = input.charAt(i);
		}
		
		//prefix character (i.e. '-'; look for '>' next)
		else if(prefix.indexOf(c) >= 0) {
			str = c;
			i += 1;
			while(i < length) {
				c = input.charAt(i);
				if(suffix.indexOf(c) >= 0) {
					break;
				}
				str += c;
				i += 1;
			}
			result.push(Token('operator', str));
			c = input.charAt(i);
		}
		else if(isOp(c)) {
			i += 1;
			result.push(Token('operator', c));
			c = input.charAt(i);
		}
		else {
			throw SyntaxError('Unknown character: \''+input.charAt(i)+'\'');
		}
	}
	return result;
};