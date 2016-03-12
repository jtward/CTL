import { assign, includes, map } from 'lodash';
import tokenize from './CTLTokenizer';

const SyntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const throwExpected = (expectedId, token) => {
	let expectedString = `'${token.id}'`;
	let foundString = `'${token.value}'`;

	if (expectedId === '(end)') {
		expectedString = 'end of input';
	}
	else if (token.value === '(end)') {
		foundString = 'end of input';
	}

	throw SyntaxError(`Expected ${expectedString} but found ${foundString}`);
};


const UnaryOperator = (value, left) => {
	return {
		left,
		value,
		arity: 1
	};
};

const BinaryOperator = (value, left, right) => {
	return {
		left,
		right,
		value,
		arity: 2
	};
};

const TRUE = {
	arity: 0,
	value: '\\T'
};

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

const combineOps = function(tree) {
	if (tree) {
		// Combine CTL-LTL operator pairs into single tokens.
		// Throw a syntax error if the pairs are not matched.
		if (isCTLOperator(tree.value)) {
			tree.value = `${tree.value}${tree.left.value}`;
			if (tree.left.right) {
				tree.right = tree.left.right;
			}
			tree.left = tree.left.left;
		}
		else if (isLTLOperator(tree.value)) {
			throw SyntaxError(`Expected a CTL operator but found '${tree.value}'.`);
		}

		tree.left = combineOps(tree.left);
		tree.right = combineOps(tree.right);
	}
	return tree;
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
			// EF a  =  EU(TRUE, a)
			tree = BinaryOperator('EU', TRUE, translate(tree.left));
		}
		else if (tree.value === 'ER') {
			// ER(a, b) = !AU(!a, !b)
			//          = EU(b, a&b) & !EG(b)
			const a = translate(tree.left);
			const b = translate(tree.right);
			tree = BinaryOperator(
				'&',
				BinaryOperator(
					'EU',
					b,
					BinaryOperator('&', a, b)),
				UnaryOperator(
					'!',
					UnaryOperator('EG', b)));
		}
		else if (tree.value === 'EW') {
			// EW(a, b) = !ER(b, a|b)
			//          = EU(a|b, b&(a|b)) & !EG(a|b)
			//          = EU(a|b, b) & !EG(a|b)
			const a = translate(tree.left);
			const b = translate(tree.right);
			tree = BinaryOperator(
				'&',
				BinaryOperator(
					'EU',
					BinaryOperator('|', a, b),
					b),
				UnaryOperator(
					'!',
					UnaryOperator(
						'EG',
						BinaryOperator('|', a, b))));
		}
		else if (tree.value === 'AX') {
			// AX(a) = !EX(!a)
			// do the negation before translating to catch double negations
			tree = UnaryOperator(
				'!',
				UnaryOperator(
					'EX',
					translate(UnaryOperator('!', tree.left))));
		}
		else if (tree.value === 'AG') {
			// AG(a) = !EF(!a)
			//       = !EU(T, !a)
			// do the negation before translating to catch double negations
			tree = UnaryOperator(
				'!',
				BinaryOperator('EU', TRUE, translate(UnaryOperator('!', tree.left))));
		}
		else if (tree.value === 'AF') {
			// AF(a) = !EG(!a)
			tree = UnaryOperator(
				'!',
				UnaryOperator('EG', translate(UnaryOperator('!', tree.left))));
		}
		else if (tree.value === 'AU') {
			// AU(a, b) = !EU(!b, !a & !b) | EG(!b)
			const a = translate(UnaryOperator('!', tree.left));
			const b = translate(UnaryOperator('!', tree.right));
			tree = BinaryOperator(
				'|',
				UnaryOperator(
					'!',
					BinaryOperator(
						'EU',
						b,
						BinaryOperator('&', a, b))),
				UnaryOperator('EG', b));
		}
		else if (tree.value === 'AR') {
			// AU(a, b) = !EU(!a, !b)
			tree = UnaryOperator(
				'!',
				BinaryOperator(
					'EU',
					translate(UnaryOperator('!', tree.left)),
					translate(UnaryOperator('!', tree.right))));
		}
		else if (tree.value === 'AW') {
			// AW(a, b) = !EU(!b, !a & !b)
			const a = translate(UnaryOperator('!', tree.left));
			const b = translate(UnaryOperator('!', tree.right));
			tree = UnaryOperator(
				'!',
				BinaryOperator(
					'EU',
					b,
					BinaryOperator('&', a, b)));
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
		else if (tree.value === '&' || tree.value === '|' || tree.value === '->') {
			tree.left = translate(tree.left);
			tree.right = translate(tree.right);
		}
		else {
			throw SyntaxError(`Expected an operator but found '${tree.value}'.`);
		}
	}
	return tree;
};

const sanitize = function(ast) {
	const newAst = {};
	if (ast.left) {
		newAst.left = sanitize(ast.left);
	}
	if (ast.right) {
		newAst.right = sanitize(ast.right);
	}
	newAst.value = ast.value;
	newAst.arity = ast.arity;
	return newAst;
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
		token.left = expression(4);
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
	{ id: '&', arity: 2, leftBindingPower: 3 },
	{ id: '|', arity: 2, leftBindingPower: 3 },
	{ id: '->', arity: 2, leftBindingPower: 2 },
	{ id: 'U', arity: 2, leftBindingPower: 1 },
	{ id: 'R', arity: 2, leftBindingPower: 1 },
	{ id: 'W', arity: 2, leftBindingPower: 1 },
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
		else if (tokens.length) {
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
		else {
			const t = token;
			advance();
			let leftTree = nud(t, expression, advance);
			while (rightBindingPower < token.leftBindingPower) {
				const tk = token;
				advance();
				leftTree = led(tk, leftTree, expression);
			}

			return leftTree;
		}
	};

	advance();
	const ast = expression(0);
	advance('(end)');
	return(ast);
};

export default (data) => {
	const tokens = typeof data === 'string' ? tokenize(data) : data;

	return sanitize(translate(combineOps(parse(tokens))));
};
