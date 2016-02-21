import { includes, assign } from 'lodash';
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
			tree.left = translate(tree.right);
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

const prefixOperatorNudForParser = (parser) => {
	return function() {
		this.left = parser.expression(50);
		return this;
	};
};

const ctlNudForParser = (parser) => {
	return function() {
		this.left = parser.expression(40);
		// CTL operators must be followed immetiately by an LTL operator
		if (!isLTLOperator(this.left.value)) {
			throw SyntaxError(`Expected an LTL operator but found '${this.left.value}'.`);
		}
		return this;
	};
};

const parenNudForParser = (parser) => {
	return function() {
		const expression = parser.expression(0);
		parser.advance(')');
		return expression;
	};
};

const Parser = function() {
	const parser = this;

	this.token = null;
	this.tokens = null;
	this.tokenIndex = 0;
	this.symbolTable = {};
	this.symbol({ id: '(end)' });
	this.symbol({ id: ')' });

	this.symbol({
		id: '(atom)',
		nud: itself
	});

	this.rightAssociativeInfixOperator({ id: '->', leftBindingPower: 10 });
	this.rightAssociativeInfixOperator({ id: '&', leftBindingPower: 20 });
	this.rightAssociativeInfixOperator({ id: '|', leftBindingPower: 20 });
	this.rightAssociativeInfixOperator({ id: 'U', leftBindingPower: 40 });
	this.rightAssociativeInfixOperator({ id: 'R', leftBindingPower: 40 });
	this.rightAssociativeInfixOperator({ id: 'W', leftBindingPower: 40 });

	const ctlNud = ctlNudForParser(this);
	this.prefixOperator({ id: 'E', nud: ctlNud });
	this.prefixOperator({ id: 'A', nud: ctlNud });

	const prefixOperatorNud = prefixOperatorNudForParser(this);
	this.prefixOperator({ id: '!', nud: prefixOperatorNud });
	this.prefixOperator({ id: 'F', nud: prefixOperatorNud });
	this.prefixOperator({ id: 'G', nud: prefixOperatorNud });
	this.prefixOperator({ id: 'X', nud: prefixOperatorNud });

	const parenNud = parenNudForParser(this);
	this.prefixOperator({ id: '(', nud: parenNud });
};


Parser.prototype.advance = function(expectedId) {
	if (expectedId && this.token.id !== expectedId) {
		let expectedString = `'${id}'`;
		let foundString = `'${this.token.value}'`;

		if (expectedId === '(end)') {
			expectedString = 'end of input';
		}
		else if (this.token.value === '(end)') {
			foundString = 'end of input';
		}

		throw SyntaxError(`Expected ${expString} but found ${foundString}`);
	}

	if (this.tokenIndex >= this.tokens.length) {
		this.token = this.symbolTable['(end)'];
		return null;
	}

	const token = this.tokens[this.tokenIndex];
	const v = token.value;
	const a = token.type;
	let o;

	this.tokenIndex += 1;

	if (a === 'atom') {
		o = this.symbolTable['(atom)'];
	}
	else if (a === 'operator') {
		o = this.symbolTable[v];
		if (!o) {
			throw SyntaxError(`Expected an operator but found '${v}'.`);
		}
	} else {
		throw SyntaxError(`Expected a token but found '{ type: ${a}, value: ${v} }'.`);
	}

	this.token = assign({}, o);
	this.token.value = v;
	return this.token;
};

Parser.prototype.expression = function(rightBindingPower) {
	let token = this.token;
	this.advance();

	if (token.value === '(end)') {
		throw SyntaxError('Unexpected end of input.');
	}

	let leftTree = token.nud();

	while (rightBindingPower < this.token.leftBindingPower) {
		let token = this.token;
		this.advance();
		leftTree = token.led(leftTree);
	}

	return leftTree;
};

Parser.prototype.symbol = function({ id = undefined, value = id, leftBindingPower = 0, arity = 0, nud = noarg, led = noarg }) {
	const existingSymbol = this.symbolTable[id];
	if (existingSymbol) {
		existingSymbol.leftBindingPower = Math.max(leftBindingPower, existingSymbol.leftBindingPower);
		return existingSymbol;
	}
	else {
		return this.symbolTable[id] = {
			id,
			leftBindingPower,
			arity,
			nud,
			led,
			value
		};
	}
};

Parser.prototype.rightAssociativeInfixOperator = function({ id = '', leftBindingPower = 0 }) {
	const parser = this;
	return this.symbol({
		id,
		leftBindingPower,
		arity: 2,
		led: function(left) {
			this.left = left;
			this.right = parser.expression(leftBindingPower - 1);
			return this;
		}
	});
};

Parser.prototype.prefixOperator = function({ id = '', nud = undefined }) {
	return this.symbol({
		id,
		bindingPower: 0,
		arity: 1,
		nud
	});
};

Parser.prototype.parse = function(tokens) {
	this.tokens = tokens;
	this.tokenIndex = 0;
	this.advance();
	const ast = this.expression(0);
	this.advance('(end)');
	return ast;
};

export default (data) => {
	if ((typeof data) === 'string') {
		data = tokenize(data);
	}
	return sanitize(translate(combineOps(new Parser().parse(data))));
};
