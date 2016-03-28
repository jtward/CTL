import { map } from 'lodash';
import tokenize from './CTLTokenizer';

const SyntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const Symbol = ({ id = undefined, value = id, leftBindingPower = 0, arity = 0, matches = undefined }) => {
	return {
		id,
		leftBindingPower,
		arity,
		value,
		matches
	};
};

const END = {
	id: {}
};

const nud = (token, expression, next) => {
	if (token.matches) {
		const e = expression(token.leftBindingPower);
		expect(next(), token.matches);
		return e;
	}
	else if (token.arity <= 1) {
		return {
			id: token.id,
			value: token.value,
			subtrees: token.arity === 0 ? undefined : [expression(Infinity)]
		};
	}
	else {
		throw SyntaxError(`Missing argument to operator '${(token.value ? token.value : '')}'.`);
	}
};

const expect = (token, expectedId) => {
	if (expectedId && token.id !== expectedId) {
		const end = 'end of input';
		const expectedString = (expectedId === END.id) ? end : `'${expectedId}'`;
		const foundString = (token === END) ? end : `'${token.value}'`;

		throw SyntaxError(`Expected ${expectedString} but found ${foundString}.`);
	}
};

const parser = (symbols) => {
	return (tokens) => {
		let peekToken, done;

		const next = (expectedId) => {
			done = !tokens.length;
			const t = peekToken;
			if (done) {
				peekToken = END;
			}
			else {
				const { type, value } = tokens.shift();
				const t = symbols.get(type === 'operator' ? value : type);
				peekToken = {
					id: t.id,
					value,
					subtrees: [],
					leftBindingPower: t.leftBindingPower,
					arity: t.arity,
					matches: t.matches
				};
			}
			return t;
		};

		const parseInfix = (rightBindingPower, parseTree) => {
			if (rightBindingPower < peekToken.leftBindingPower) {
				const t = next();
				return parseInfix(rightBindingPower, {
					id: t.id,
					value: t.value,
					subtrees: [
						parseTree,
						expression(t.leftBindingPower - 1)
					]
				});
			}
			else {
				return parseTree;
			}
		};

		const expression = (rightBindingPower) => {
			if (done) {
				throw SyntaxError('Unexpected end of input.');
			}

			return parseInfix(rightBindingPower, nud(next(), expression, next));
		};

		next();
		return(expression(0));
	};
};

export default (symbols) => {
	symbols = new Map(map(symbols, (symbol) => [symbol.id, Symbol(symbol)]));
	return parser(symbols);
};
