import { map, mapValues } from 'lodash';

const SyntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const Symbol = (id = undefined, { leftBindingPower = 0, arity = 0, matches = undefined }) => {
	return {
		id,
		leftBindingPower,
		arity,
		matches
	};
};

const END = {
	id: {}
};

const expect = (token, expectedId) => {
	if (token.id !== expectedId) {
		const end = 'end of input';
		const expectedString = (expectedId === END.id) ? end : `'${expectedId}'`;
		const foundString = (token === END) ? end : `'${token.value}'`;

		throw SyntaxError(`Expected ${expectedString} but found ${foundString}.`);
	}
};

const parser = (symbols) => {
	return (tokens) => {
		let peekToken, done;

		const next = () => {
			if (done) {
				throw SyntaxError('Unexpected end of input.');
			}

			done = !tokens.length;
			const token = peekToken;
			if (done) {
				peekToken = END;
			}
			else {
				const { type, value } = tokens.shift();
				const symbol = symbols[type === 'operator' ? value : type];

				peekToken = {
					id: symbol.id,
					value,
					subtrees: [],
					leftBindingPower: symbol.leftBindingPower,
					arity: symbol.arity,
					matches: symbol.matches
				};
			}
			return token;
		};

		const parsePrefixOrAtom = () => {
			const token = next();
			if (token.matches) {
				const e = parseExpression(token.leftBindingPower);
				expect(peekToken, token.matches);
				next(); // skip over matching token
				return e;
			}
			else if (token.arity <= 1) {
				return {
					id: token.id,
					value: token.value,
					subtrees: token.arity === 0 ? undefined : [parseExpression(Infinity)]
				};
			}
			else {
				throw SyntaxError(`Missing argument to operator '${token.id}'.`);
			}
		};

		const parseInfix = (rightBindingPower, parseTree) => {
			if (rightBindingPower < peekToken.leftBindingPower) {
				const token = next();
				return parseInfix(rightBindingPower, {
					id: token.id,
					value: token.value,
					subtrees: [
						parseTree,
						parseExpression(token.leftBindingPower - 1)
					]
				});
			}
			else {
				return parseTree;
			}
		};

		const parseExpression = (rightBindingPower) => {
			return parseInfix(rightBindingPower, parsePrefixOrAtom());
		};

		next();
		return(parseExpression(0));
	};
};

export default (symbols) => {
	symbols = mapValues(symbols, (symbol, id) => {
		return Symbol(id, symbol);
	});

	return parser(symbols);
};
