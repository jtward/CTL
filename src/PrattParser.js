import { mapValues, times } from 'lodash';

const syntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const toSymbol = ({ leftBindingPower = 0, arity = 0, matches, prefix = false, postfix = false, unary = false, rightAssociative = false }, id) => {
	return {
		id,
		leftBindingPower,
		arity,
		matches,
		prefix,
		postfix,
		unary,
		rightAssociative
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

		throw syntaxError(`Expected ${expectedString} but found ${foundString}.`);
	}
};

const parseTree = (token, subtrees) => {
	return {
		id: token.id,
		value: token.value,
		subtrees
	};
};

const parser = (symbols) => {
	return (tokens) => {
		let peekToken, done;

		const next = () => {
			if (done) {
				throw syntaxError('Unexpected end of input.');
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
					matches: symbol.matches,
					prefix: symbol.prefix,
					postfix: symbol.postfix,
					unary: symbol.unary,
					rightAssociative: symbol.rightAssociative
				};
			}
			return token;
		};

		const parsePrefixOrAtom = () => {
			const token = next();

			switch (token.arity) {
			case 0:
				// atoms are leaf nodes
				return parseTree(token, undefined);
			case 1:
				if (token.matches) {
					// tokens with `matches` properties are grouping
					// operators, such as brackets
					const e = parseExpression(token.leftBindingPower);
					expect(peekToken, token.matches);
					next(); // skip over matching token
					return e;
				}
				else {
					// a prefix operator
					return parseTree(token, [parsePrefixOrAtom()]);
				}
			default:
				if (token.unary) {
					return parseTree(token, [parsePrefixOrAtom()]);
				}
				else if (token.prefix) {
					return parseTree(token, times(token.arity, (parseExpression(Infinity))));
				}
				else {
					// we don't expect binary operators here -
					// those are handled by parseInfix
					throw syntaxError(`Expected a value or prefix operator but found '${token.id}'.`);
				}
			}
		};

		const parseInfix = (rightBindingPower, leftParseTree) => {
			if (peekToken.postfix) {
				return parseInfix(rightBindingPower, parseTree(next(), [leftParseTree]));
			}

			else if (rightBindingPower < peekToken.leftBindingPower ||
				(rightBindingPower && peekToken.rightAssociative && rightBindingPower === peekToken.leftBindingPower)) {

				const token = next();

				if (token.arity === 2) {
					return parseInfix(rightBindingPower,
						parseTree(token, [
							leftParseTree, parseExpression(token.leftBindingPower)
						]));
				}
				else {
					throw syntaxError(`Expected an infix or postfix operator but found ${token.id}`);
				}
			}

			else {
				return leftParseTree;
			}
		};

		const parseExpression = (rightBindingPower) => {
			return parseInfix(rightBindingPower, parsePrefixOrAtom());
		};

		next();
		const ast = parseExpression(0);
		expect(peekToken, END.id);
		return ast;
	};
};

export default (symbols) => {
	return parser(mapValues(symbols, toSymbol));
};
