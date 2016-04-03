import { mapValues, times } from 'lodash';

const SyntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const Symbol = (id = undefined, { leftBindingPower = 0, arity = 0, matches = undefined, prefix = false, postfix = false }) => {
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
						throw SyntaxError(`Missing argument to operator '${token.id}'.`);
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
							throw SyntaxError();
						}
					default:
						throw SyntaxError();
				}
			}
			else {
				return parseTree;
			}
		};

		const parseExpression = (rightBindingPower) => {
			const expression = parseInfix(rightBindingPower, parsePrefixOrAtom());
			return expression;
		};

		next();
		const ast = parseExpression(0);
		if (peekToken.id !== END.id) {
			console.log(peekToken);
		}
		expect(peekToken, END.id);
		return ast;
	};
};

export default (symbols) => {
	symbols = mapValues(symbols, (symbol, id) => {
		return Symbol(id, symbol);
	});

	return parser(symbols);
};
