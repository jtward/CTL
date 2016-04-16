const times = (n, f) => {
	let index = -1;
	while (++index < n) {
		f();
	}
};

const mapValues = (obj, f) => {
	const result = {};
	const keys = Object.keys(obj);
	const length = keys.length;

	let index = -1;
	while (++index < length) {
		const key = keys[index];
		result[key] = f(obj[key], key);
	}

	return result;
};

const identity = (a) => a;
const valid = () => true;

const syntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const toSymbol = ({ leftBindingPower = 0, arity = 0, matches, prefix = false, postfix = false, unary = false, rightAssociative = false, transform = identity, verify = valid }, id) => {
	return {
		id,
		leftBindingPower,
		arity,
		matches,
		prefix,
		postfix,
		unary,
		rightAssociative,
		transform,
		verify
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

const parseTree = ({ id, value, transform, verify }, subtrees) => {
	const node = {
		id,
		value,
		subtrees
	};

	const validity = verify(node);
	if (validity === true) {
		return transform(node);
	}
	else {
		throw syntaxError(validity);
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
					postfix: symbol.postfix,
					unary: symbol.unary,
					rightAssociative: symbol.rightAssociative,
					transform: symbol.transform,
					verify: symbol.verify
				};
			}
			return token;
		};

		const parsePostfix = (leftParseTree) => {
			if (peekToken.arity === 1 && peekToken.postfix) {
				const token = next();
				return parsePostfix(parseTree(token, [leftParseTree]));
			}
			else {
				return leftParseTree;
			}
		};

		const parsePrefixOrAtom = () => {
			const token = next();

			switch (token.arity) {
			case 0:
				// atoms are leaf nodes
				return parsePostfix(parseTree(token, undefined));
			case 1:
				if (token.matches) {
					// tokens with `matches` properties are grouping
					// operators, such as brackets
					const expression = parseTree(token, [parseExpression(token.leftBindingPower)]);
					expect(peekToken, token.matches);
					next(); // skip over matching token
					return parsePostfix(expression);
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
					return parseTree(token, times(token.arity, () => parseExpression(Infinity)));
				}
				else {
					// we don't expect binary operators here -
					// those are handled by parseInfix
					throw syntaxError(`Expected a value or prefix operator but found '${token.id}'.`);
				}
			}
		};

		const parseInfix = (rightBindingPower, leftParseTree) => {
			if (rightBindingPower < peekToken.leftBindingPower ||
				(rightBindingPower &&
					peekToken.rightAssociative &&
					rightBindingPower === peekToken.leftBindingPower)) {

				const token = next();

				if (token.arity === 2) {
					return parseInfix(rightBindingPower,
						parseTree(token, [
							leftParseTree,
							parseExpression(token.leftBindingPower)
						]));
				}
				else {
					throw syntaxError(`Expected an infix operator but found ${token.id}`);
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
