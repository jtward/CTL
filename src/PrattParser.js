import { mapValues, times } from 'lodash';

const syntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const toSymbol = ({ leftBindingPower = 0, arity = 0, matches, prefix = false, postfix = false }, id) => {
	return {
		id,
		leftBindingPower,
		arity,
		matches,
		prefix,
		postfix
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
					postfix: symbol.postfix
				};
			}
			return token;
		};

		const parsePrefixOrAtom = () => {
			const token = next();

			switch (token.arity) {
				case 0:
					// atoms are leaf nodes
					return {
						id: token.id,
						value: token.value,
						subtrees: undefined
					};
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
						return {
							id: token.id,
							value: token.value,
							subtrees: [parseExpression(Infinity)]
						};
					}
				default:
					if (token.prefix) {
						return {
							id: token.id,
							value: token.value,
							subtrees: times(token.arity, () => parseExpression(Infinity))
						};
					}
					else {
						// we don't expect binary operators here -
						// those are handled by parseInfix
						throw syntaxError(`Expected a value or prefix operator but found '${token.id}'.`);
					}
			}
		};

		const parseInfix = (rightBindingPower, parseTree) => {
			if (rightBindingPower < peekToken.leftBindingPower) {
				const token = next();

				switch (token.arity) {
					case 2:
						return parseInfix(rightBindingPower, {
							id: token.id,
							value: token.value,
							subtrees: [
								parseTree,
								parseExpression(token.leftBindingPower - 1)
							]
						});
					case 1:
						if (token.postfix) {
							return parseInfix(rightBindingPower, {
								id: token.id,
								value: token.value,
								subtrees: [
									parseTree
								]
							});
						}
						else {
							throw syntaxError(`Expected an infix or postfix operator but found ${token.id}`);
						}
					default:
						throw syntaxError(`Expected an infix or postfix operator but found ${token.id}`);
				}
			}
			else {
				return parseTree;
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
