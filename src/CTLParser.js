import { includes, assign } from 'lodash';
import tokenize from './CTLTokenizer';

const SyntaxError = function(message) {
	return {
		'name': 'SyntaxError',
		'message': message
	};
};

const UnaryOperator = function(value, l) {
	return {
		0: l,
		value: value,
		arity: 1
	};
};

const BinaryOperator = function(value, l, r) {
	return {
		0: l,
		1: r,
		value: value,
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
const isCTLOperator = function(value) {
	return includes(CTLOperators, value);
};
const isLTLOperator = function(value) {
	return includes(LTLOperators, value);
};
const combineOps = function(tree) {
	// Combine CTL-LTL operator pairs into single tokens.
	// Throw a syntax error if the pairs are not matched.
	if (isCTLOperator(tree.value)) {
		tree.value = tree.value + tree[0].value;
		if (tree[0][1] !== undefined) {
			tree[1] = tree[0][1];
		}
		tree[0] = tree[0][0];
	}
	else if (isLTLOperator(tree.value)) {
		throw SyntaxError(`Expected a CTL operator but found '${tree.value}'.`);
	}

	let i = tree.arity;
	while (i--) {
		combineOps(tree[i]);
	}
	return tree;
};

const translate = function(tree) { //THROWS SystemError
	if (tree.arity) {
		switch(tree.value) {
		case 'EX':
		case 'EG':
			tree[0] = translate(tree[0]);
			break;
		case 'EU':
			tree[0] = translate(tree[0]);
			tree[1] = translate(tree[1]);
			break;
		case 'EF':
			//EF a  =  EU(TRUE, a)
			tree[0] = translate(tree[0]);
			const a = tree[0];
			tree.value = 'EU';
			tree[0] = TRUE;
			tree[1] = a;
			break;
		case 'ER':
			//ER(a, b)  =  !AU(!a, !b)
			//          =  EU(b, a&b) & !EG(b)
			tree[0] = translate(tree[0]);
			tree[1] = translate(tree[1]);
			tree = BinaryOperator(
				'&', 
				BinaryOperator(
					'EU',
					b,
					BinaryOperator('&', tree[0], tree[1])),
				UnaryOperator(
					'!',
					UnaryOperator('EG', tree[1])));
			break;
		case 'EW':
			//EW(a, b)  =  !ER(b, a|b)
			//          =  EU(a|b, b&(a|b)) & !EG(a|b)
			//          =  EU(a|b, b) & !EG(a|b)
			tree[0] = translate(tree[0]);
			tree[1] = translate(tree[1]);
			tree = BinaryOperator(
				'&',
				BinaryOperator(
					'EU',
					BinaryOperator('|', tree[0], tree[1]),
					b),
				UnaryOperator(
					'!',
					UnaryOperator(
						'EG',
						BinaryOperator('|', tree[0], tree[1]))));
			break;
		case 'AX':
			//AX(a)  =  !EX(!a)
			//tree.first = this.translate(tree.first);
			// do the negation before translating to catch double negations
			const a = translate(UnaryOperator('!', tree[0]));
			tree = UnaryOperator('!', UnaryOperator('EX', a));
			break;
		case 'AG':
			//AG(a)  =  !EF(!a)
			//       =  !EU(T, !a)
			// do the negation before translating to catch double negations
			tree = UnaryOperator(
				'!',
				BinaryOperator('EU', TRUE, translate(UnaryOperator('!', tree[0]))));
			break;
		case 'AF':
			//AF(a)  =  !EG(!a)
			tree = UnaryOperator(
				'!',
				UnaryOperator('EG', translate(UnaryOperator('!', tree[0]))));
			break;
		case 'AU':
			//AU(a, b)  =  !EU(!b, !a & !b) | EG(!b)
			const a = translate(UnaryOperator('!', tree[0]));
			const b = translate(UnaryOperator('!', tree[1]));
			tree = BinaryOperator(
				'|',
				UnaryOperator(
					'!',
					BinaryOperator(
						'EU',
						b,
						BinaryOperator('&', a, b))),
				UnaryOperator('EG', b));
			break;
		case 'AR':
			//AU(a, b)  =  !EU(!a, !b)
			tree = UnaryOperator(
				'!',
				BinaryOperator(
					'EU',
					translate(UnaryOperator('!', tree[0])),
					translate(UnaryOperator('!', tree[1]))));
			break;
		case 'AW':
			//AW(a, b)  =  !EU(!b, !a & !b)
			a = translate(UnaryOperator('!', tree[0]));
			b = translate(UnaryOperator('!', tree[1]));
			tree = UnaryOperator(
				'!',
				BinaryOperator(
					'EU',
					b,
					BinaryOperator('&', a, b)));
			break;
		case '!':
			if (tree[0].value === '!') {
				// remove any number of double negations.
				while (tree.value === '!' &&
			  		tree[0].value === '!') {
					tree = tree[0][0];
				}
				tree = translate(tree);
			}
			else {
				tree[0] = translate(tree[0]);
			}
			break;
		case '&':
		case '|':
		case '->':
			tree[0] = translate(tree[0]);
			tree[1] = translate(tree[1]);
			break;
		default:
			throw SyntaxError(`Expected an operator but found '${tree.value}'.`);
		}
	}
	return tree;
};

const sanitize = function(ast) {
	for (let p in ast) {
		if (ast.hasOwnProperty(p)) {
			if (!isNaN(parseInt(p, 10))) {
				sanitize(ast[p]);
			}
			else if (p !== 'value' && p !== 'arity') {
				delete ast[p];
			}
		}
	}
	return ast;
};

const prefixOperatorNudForParser = (parser) => {
	return function() {
		this[0] = parser.expression(50);
		return this;
	};
};

const quantifierNudForParser = (parser) => {
	return function() {
		this[0] = parser.expression(40);
		if (!isLTLOperator(this[0].value)) {
			throw SyntaxError(`Expected an LTL operator but found '${this[0].value}'.`);
		}
		return this;
	};
};

const parenNudForParser = (parser) => {
	return function() {
		const e = parser.expression(0);
		parser.advance(')');
		return e;
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
	this.rightAssociativeInfixOperator({ id: 'R', leftBindingPower: 40});
	this.rightAssociativeInfixOperator({ id: 'W', leftBindingPower: 40 });

	const quantifierNud = quantifierNudForParser(this);
	this.prefixOperator({ id: 'E', nud: quantifierNud });
	this.prefixOperator({ id: 'A', nud: quantifierNud });

	const prefixOperatorNud = prefixOperatorNudForParser(this);
	this.prefixOperator({ id: '!', nud: prefixOperatorNud });
	this.prefixOperator({ id: 'F', nud: prefixOperatorNud });
	this.prefixOperator({ id: 'G', nud: prefixOperatorNud });
	this.prefixOperator({ id: 'X', nud: prefixOperatorNud });

	const parenNud = parenNudForParser(this);
	this.prefixOperator({ id: '(', nud: parenNud });
};


Parser.prototype.advance = function(id) {
	if (id && this.token.id !== id) {
		const expString = `' ${id} '`;
		const foundString = `' ${this.token.value} '`;

		if (id === '(end)') {
			expString = 'end of input';
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

	const t = this.tokens[this.tokenIndex];
	const v = t.value;
	const a = t.type;
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
		s.leftBindingPower = Math.max(leftBindingPower, s.leftBindingPower);
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
			this[0] = left;
			this[1] = parser.expression(leftBindingPower - 1);
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
	const s = this.expression(0);
	this.advance('(end)');
	return s;
};

export default function(data) {
	if ((typeof data) === 'string') {
		data = tokenize(data);
	}
	return sanitize(translate(combineOps(new Parser().parse(data))));
};
