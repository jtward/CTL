import { assign, includes, map } from 'lodash';
import tokenize from './CTLTokenizer';

const SyntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
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

const noarg = function() {
	throw SyntaxError(`Missing argument to operator '${(this.value ? this.value : '')}'.`);
};

const itself = function() {
	return this;
};

const Symbol = ({ id = undefined, value = id, leftBindingPower = 0, arity = 0, nud = noarg, led = noarg }) => {
	return {
		id,
		leftBindingPower,
		arity,
		nud,
		led,
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

const prefixOperatorNud = function(expression) {
	this.left = expression(4);
	return this;
};

const ctlNud = function(expression) {
	this.left = expression(4);
	// CTL operators must be followed immediately by an LTL operator
	if (!isLTLOperator(this.left.value)) {
		throw SyntaxError(`Expected an LTL operator but found '${this.left.value}'.`);
	}
	return this;
};

const parenNud = (expression, advance) => {
	const e = expression(0);
	advance(')');
	return e;
};

const rightAssociativeInfixOperator = ({ id = '', leftBindingPower = 0 }) => {
	return Symbol({
		id,
		leftBindingPower,
		arity: 2,
		led: function(left, expression) {
			this.left = left;
			this.right = expression(leftBindingPower - 1);
			return this;
		}
	});
};

const prefixOperator = ({ id = '', nud = undefined }) => {
	return Symbol({
		id,
		bindingPower: 0,
		arity: 1,
		nud
	});
};

const symbolTable = new Map(map([
	Symbol({
		id: '(atom)',
		nud: itself
	}),

	rightAssociativeInfixOperator({ id: '->', leftBindingPower: 2 }),
	rightAssociativeInfixOperator({ id: '&', leftBindingPower: 3 }),
	rightAssociativeInfixOperator({ id: '|', leftBindingPower: 3 }),
	rightAssociativeInfixOperator({ id: 'U', leftBindingPower: 1 }),
	rightAssociativeInfixOperator({ id: 'R', leftBindingPower: 1 }),
	rightAssociativeInfixOperator({ id: 'W', leftBindingPower: 1 }),

	prefixOperator({ id: 'E', nud: ctlNud }),
	prefixOperator({ id: 'A', nud: ctlNud }),

	prefixOperator({ id: '!', nud: prefixOperatorNud }),
	prefixOperator({ id: 'F', nud: prefixOperatorNud }),
	prefixOperator({ id: 'G', nud: prefixOperatorNud }),
	prefixOperator({ id: 'X', nud: prefixOperatorNud }),

	prefixOperator({ id: '(', nud: parenNud }),
	Symbol({ id: ')' }),

	Symbol({ id: '(end)' })
], (symbol) => {
	return [symbol.id, symbol];
}));

class Parser {
	constructor() {
		this.token = null;
		this.tokens = null;
		this.tokenIndex = 0;

		this.expression = this.expression.bind(this);
		this.advance = this.advance.bind(this);
	}

	advance(expectedId) {
		if (expectedId && this.token.id !== expectedId) {
			let expectedString = `'${this.token.id}'`;
			let foundString = `'${this.token.value}'`;

			if (expectedId === '(end)') {
				expectedString = 'end of input';
			}
			else if (this.token.value === '(end)') {
				foundString = 'end of input';
			}

			throw SyntaxError(`Expected ${expectedString} but found ${foundString}`);
		}

		if (this.tokenIndex >= this.tokens.length) {
			this.token = symbolTable.get('(end)');
		}
		else {
			const token = this.tokens[this.tokenIndex];
			this.tokenIndex += 1;
			const value = token.value;
			const type = token.type;

			const symbol = (() => {
				if (type === 'atom') {
					return symbolTable.get('(atom)');
				}
				else {
					return symbolTable.get(value);
				}
			})();

			this.token = assign({}, symbol);
			this.token.value = value;
		}
	}

	expression(rightBindingPower) {
		const token = this.token;
		this.advance();

		if (token.value === '(end)') {
			throw SyntaxError('Unexpected end of input.');
		}

		let leftTree = token.nud(this.expression, this.advance);

		while (rightBindingPower < this.token.leftBindingPower) {
			const token = this.token;
			this.advance();
			leftTree = token.led(leftTree, this.expression);
		}

		return leftTree;
	}

	parse(tokens) {
		this.tokens = tokens;
		this.tokenIndex = 0;
		this.advance();
		const ast = this.expression(0);
		this.advance('(end)');
		return ast;
	}
}

export default (data) => {
	if ((typeof data) === 'string') {
		data = tokenize(data);
	}
	return sanitize(translate(combineOps(new Parser().parse(data))));
};
