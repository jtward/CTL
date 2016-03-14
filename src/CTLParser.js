import { assign, includes, map } from 'lodash';
import tokenize from './CTLTokenizer';

const SyntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const throwExpected = (expectedId, token) => {
	const end = 'end of input';
	const expectedString = (expectedId === '(end)') ? end : `'${token.id}'`;
	const foundString = (token.value === '(end)') ? end : `'${token.value}'`;

	throw SyntaxError(`Expected ${expectedString} but found ${foundString}`);
};

const unaryOperator = (value) => {
	return (left) => {
		return {
			left,
			value,
			arity: 1
		};
	};
};

const binaryOperator = (value) => {
	return (left, right) => {
		return {
			left,
			right,
			value,
			arity: 2
		};
	};
};

const TRUE = {
	arity: 0,
	value: '\\T'
};

const _AND = binaryOperator('&');
const _OR = binaryOperator('|');
const _EU = binaryOperator('EU');
const _NOT = unaryOperator('!');
const _EX = unaryOperator('EX');
const _EG = unaryOperator('EG');

const Symbol = ({ id = undefined, value = id, leftBindingPower = 0, arity = 0 }) => {
	return {
		id,
		leftBindingPower,
		arity,
		value
	};
};

const CTLOperators = ['A', 'E'];
const LTLOperators = ['G', 'F', 'X', 'U', 'W', 'R'];
const isCTLOperator = (value) => {
	return includes(CTLOperators, value);
};
const isLTLOperator = (value) => {
	return includes(LTLOperators, value);
};

// combine CTL-LTL operator pairs into single tokens
// Throw a syntax error if the pairs are not matched.
const combineOps = function(tree) {
	if (tree.arity === 0) {
		return tree;
	}
	else if (isCTLOperator(tree.value)) {
		const value = `${tree.value}${tree.left.value}`;
		if (tree.left.right) {
			return binaryOperator(value)(
				combineOps(tree.left.left),
				combineOps(tree.left.right));
		}
		else {
			return unaryOperator(value)(combineOps(tree.left.left));
		}
	}
	else if (isLTLOperator(tree.value)) {
		throw SyntaxError(`Expected a CTL operator but found '${tree.value}'.`);
	}
	else {
		return {
			value: tree.value,
			arity: tree.arity,
			left: combineOps(tree.left),
			right: tree.arity > 1 ? combineOps(tree.right) : undefined
		};
	}
};

const translate = (tree) => {
	if (tree.arity) {
		if (tree.value === 'EX' || tree.value === 'EG') {
			tree.left = translate(tree.left);
		}
		else if (tree.value === 'EU') {
			tree.left = translate(tree.left);
			tree.right = translate(tree.right);
			tree.arity = 2;
		}
		else if (tree.value === 'EF') {
			// EF a = EU(TRUE, a)
			const a = translate(tree.left);
			tree = _EU(TRUE, a);
		}
		else if (tree.value === 'ER') {
			// ER(a, b) = !AU(!a, !b)
			//          = EU(b, a&b) & !EG(b)
			const a = translate(tree.left);
			const b = translate(tree.right);

			tree = _AND(_EU(b, _AND(a, b)), _NOT(_EG(b)));

		}
		else if (tree.value === 'EW') {
			// EW(a, b) = !ER(b, a|b)
			//          = EU(a|b, b&(a|b)) & !EG(a|b)
			//          = EU(a|b, b) & !EG(a|b)
			const a = translate(tree.left);
			const b = translate(tree.right);
			tree = _AND(_EU(_OR(a, b), b), _NOT(_EG(_OR(a, b))));
		}
		else if (tree.value === 'AX') {
			// AX(a) = !EX(!a)
			// do the negation before translating to catch double negations
			tree = _NOT(_EX(translate(_NOT(tree.left))));
		}
		else if (tree.value === 'AG') {
			// AG(a) = !EF(!a)
			//       = !EU(T, !a)
			const notA = translate(_NOT(tree.left));
			tree = _NOT(_EU(TRUE, notA));
		}
		else if (tree.value === 'AF') {
			// AF(a) = !EG(!a)
			tree = _NOT(_EG(translate(_NOT(tree.left))));
		}
		else if (tree.value === 'AU') {
			// AU(a, b) = !EU(!b, !a & !b) | EG(!b)
			const notA = translate(_NOT(tree.left));
			const notB = translate(_NOT(tree.right));

			tree =
				_OR(
					_NOT(
						_EU(
							notB,
							_AND(notA, notB))),
					_EG(notB));
		}
		else if (tree.value === 'AR') {
			// AU(a, b) = !EU(!a, !b)
			const notA = translate(_NOT(tree.left));
			const notB = translate(_NOT(tree.right));
			tree =
				_NOT(
					_EU(
						notA,
						notB));
		}
		else if (tree.value === 'AW') {
			// AW(a, b) = !EU(!b, !a & !b)
			const notA = translate(_NOT(tree.left));
			const notB = translate(_NOT(tree.right));
			tree = _NOT(_EU(notB, _AND(notA, notB)));
		}
		else if (tree.value === '!') {
			if (tree.left.value === '!') {
				// remove any number of double negations.
				while (tree.value === '!' &&
					tree.left.value === '!') {
					tree = tree.left.left;
				}
				tree = translate(tree);
			}
			else {
				tree.left = translate(tree.left);
			}
		}
		else if (tree.arity === 2) {
			tree.left = translate(tree.left);
			tree.right = translate(tree.right);
		}
		else {
			throw SyntaxError(`Expected an operator but found '${tree.value}'.`);
		}
	}
	return tree;
};

const nud = (token, expression, advance) => {
	if (token.id === '(atom)') {
		return token;
	}
	else if (token.id === '(') {
		const e = expression(0);
		advance(')');
		return e;
	}
	else if (token.arity === 1) {
		token.left = expression(40);
		return token;
	}
	else {
		throw SyntaxError(`Missing argument to operator '${(token.value ? token.value : '')}'.`);
	}
};

const led = (token, left, expression) => {
	token.left = left;
	token.right = expression(token.leftBindingPower - 1);
	return token;
};

const symbolTable = new Map(map([
	{ id: '(atom)' },
	{ id: '&', arity: 2, leftBindingPower: 30 },
	{ id: '|', arity: 2, leftBindingPower: 30 },
	{ id: '->', arity: 2, leftBindingPower: 20 },
	{ id: 'U', arity: 2, leftBindingPower: 10 },
	{ id: 'R', arity: 2, leftBindingPower: 10 },
	{ id: 'W', arity: 2, leftBindingPower: 10 },
	{ id: 'E', arity: 1 },
	{ id: 'A', arity: 1 },
	{ id: '!', arity: 1 },
	{ id: 'F', arity: 1 },
	{ id: 'G', arity: 1 },
	{ id: 'X', arity: 1 },
	{ id: '(', arity: 1 },
	{ id: ')' },
	{ id: '(end)' }
], (symbol) => {
	return [symbol.id, Symbol(symbol)];
}));

const parse = (tokens) => {
	let token = tokens[0];

	const advance = (expectedId) => {
		if (expectedId && token.id !== expectedId) {
			throwExpected(expectedId, token);
		}
		
		if (tokens.length) {
			const { type, value } = tokens.shift();
			token = assign({}, symbolTable.get(type === 'atom' ? '(atom)' : value));
			// set the value of the token for atoms
			token.value = value;
		}
		else {
			token = symbolTable.get('(end)');
		}
	};

	const expression = (rightBindingPower) => {
		if (token.value === '(end)') {
			throw SyntaxError('Unexpected end of input.');
		}

		const t = token;
		advance();
		let leftTree = nud(t, expression, advance);
		while (rightBindingPower < token.leftBindingPower) {
			const t = token;
			advance();
			leftTree = led(t, leftTree, expression);
		}

		return leftTree;
	};

	advance();
	const ast = expression(0);
	advance('(end)');
	return(ast);
};

export default (data) => {
	const tokens = typeof data === 'string' ? tokenize(data) : data;

	return translate(combineOps(parse(tokens)));
};
