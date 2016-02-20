import {includes, assign} from 'lodash';
import tokenize from './CTLTokenizer';

var SyntaxError = function(message) {
	return {
		'name': 'SyntaxError',
		'message': message
	};
};

var _UnaryOperator = function(value, l) {
	return {
		0: l,
		value: value,
		args: 1
	};
};

var _BinaryOperator = function(value, l, r) {
	return {
		0: l,
		1: r,
		value: value,
		args: 2
	};
};

var TRUE = {
	args: 0,
	value: '\\T'
};

var _noarg = function() {
	throw SyntaxError('Missing argument to operator ' +
		(this.value ? this.value : '') + '.');
};

var _itself = function() {
	return this;
};

var CTLOperators = ['A', 'E'];
var LTLOperators = ['G', 'F', 'X', 'U', 'W', 'R'];
var isCTLOperator = function(value) {
	return includes(CTLOperators, value);
};
var isLTLOperator = function(value) {
	return includes(LTLOperators, value);
};
var combineOps = function(tree) {
	// Combine CTL-LTL operator pairs into single tokens.
	// Throw a syntax error if the pairs are not matched.
	var i;
	if (isCTLOperator(tree.value)) {
		tree.value = tree.value + tree[0].value;
		if (tree[0][1] !== undefined) {
			tree[1] = tree[0][1];
		}
		tree[0] = tree[0][0];
	}
	else if (isLTLOperator(tree.value)) {
		throw SyntaxError('Expected a CTL operator but found \'' +
			tree.value + '\'.');
	}

	i = tree.args;
	while(i--) {
		combineOps(tree[i]);
	}
	return tree;
};

var translate = function(tree) { //THROWS SystemError
	var a, b;
	if (!tree.args) {
		return tree;
	}
	else {
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
			a = tree[0];
			tree.value = 'EU';
			tree[0] = TRUE;
			tree[1] = a;
			break;
		case 'ER':
			//ER(a, b)  =  !AU(!a, !b)
			//          =  EU(b, a&b) & !EG(b)
			tree[0] = translate(tree[0]);
			tree[1] = translate(tree[1]);
			a = tree[0];
			b = tree[1];
			tree = _BinaryOperator(
				'&', 
				_BinaryOperator(
					'EU',
					b,
					_BinaryOperator('&', a, b)),
				_UnaryOperator(
					'!',
					_UnaryOperator('EG', b)));
			break;
		case 'EW':
			//EW(a, b)  =  !ER(b, a|b)
			//          =  EU(a|b, b&(a|b)) & !EG(a|b)
			//          =  EU(a|b, b) & !EG(a|b)
			tree[0] = translate(tree[0]);
			tree[1] = translate(tree[1]);
			a = tree[0];
			b = tree[1];
			tree = _BinaryOperator(
				'&',
				_BinaryOperator(
					'EU',
					_BinaryOperator('|', a, b),
					b),
				_UnaryOperator(
					'!',
					_UnaryOperator(
						'EG',
						_BinaryOperator('|', a, b))));
			break;
		case 'AX':
			//AX(a)  =  !EX(!a)
			//tree.first = this.translate(tree.first);
			// do the negation before translating to catch double negations
			a = translate(
				_UnaryOperator('!', tree[0]));
			tree = _UnaryOperator(
				'!',
				_UnaryOperator('EX', a));
			break;
		case 'AG':
			//AG(a)  =  !EF(!a)
			//       =  !EU(T, !a)
			// do the negation before translating to catch double negations
			a = translate(
				_UnaryOperator('!', tree[0]));
			tree = _UnaryOperator(
				'!',
				_BinaryOperator(
					'EU',
					TRUE,
					a));
			break;
		case 'AF':
			//AF(a)  =  !EG(!a)
			a = translate(
				_UnaryOperator('!', tree[0]));
			tree = _UnaryOperator(
				'!',
				_UnaryOperator('EG', a));
			break;
		case 'AU':
			//AU(a, b)  =  !EU(!b, !a & !b) | EG(!b)
			a = translate(
				_UnaryOperator('!', tree[0]));
			b = translate(
				_UnaryOperator('!', tree[1]));
			tree = _BinaryOperator(
				'|',
				_UnaryOperator(
					'!',
					_BinaryOperator(
						'EU',
						b,
						_BinaryOperator('&', a, b))),
				_UnaryOperator('EG', b));
			break;
		case 'AR':
			//AU(a, b)  =  !EU(!a, !b)
			a = translate(
				_UnaryOperator('!', tree[0]));
			b = translate(
				_UnaryOperator('!', tree[1]));
			tree = _UnaryOperator(
				'!',
				_BinaryOperator('EU', a, b));
			break;
		case 'AW':
			//AW(a, b)  =  !EU(!b, !a & !b)
			a = translate(
				_UnaryOperator('!', tree[0]));
			b = translate(
				_UnaryOperator('!', tree[1]));
			tree = _UnaryOperator(
				'!',
				_BinaryOperator(
					'EU',
					b,
					_BinaryOperator('&', a, b)));
			break;
		case '!':
			if (tree[0].value === '!') {
				//remove any number of double negations.
				while(tree.value === '!' &&
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
			throw SyntaxError('Expected an operator but found \''+
				tree.value+'\'.');
		}
		return tree;
	}
};

var sanitize = function(ast) {
	var p;
	for (p in ast) {
		if (ast.hasOwnProperty(p)) {
			if (!isNaN(parseInt(p))) {
				sanitize(ast[p]);
			}
			else if (p !== 'value' && p !== 'args') {
				delete ast[p];
			}
		}
	}
	return ast;
};


var Parser = function() {
	var context = this;

	this._token = null;
	this._tokens = null;
	this._token_nr = 0;
	this._symbol_table = {};
	this._symbol('(end)');
	this._symbol(')');

	this._symbol('(atom)').nud = _itself;

	this._infixr('->', 10);

	this._infixr('&', 20);
	this._infixr('|', 20);

	this._prefix('E', function() {
		this[0] = context._expression(40);
		if (!isLTLOperator(this[0].value)) {
			throw SyntaxError('Expected an LTL operator ' + 
				'but found \'' +
				this[0].value + '\'.');
		}
		return this;
	});
	this._prefix('A', function() {
		this[0] = context._expression(40);
		if (!isLTLOperator(this[0].value)) {
			throw SyntaxError('Expected an LTL operator ' +
				'but found \''+this[0].value +
				'\'.');
		}
		return this;
	});

	this._infixr('U', 40);
	this._infixr('R', 40);
	this._infixr('W', 40);

	this._prefix('!', function() {
		this[0] = context._expression(50);
		return this;
	});
	this._prefix('F', function() {
		this[0] = context._expression(50);
		return this;
	});
	this._prefix('G', function() {
		this[0] = context._expression(50);
		return this;
	});
	this._prefix('X', function() {
		this[0] = context._expression(50);
		return this;
	});
	this._prefix('(', function () {
		var e = context._expression(0);
		context._advance(')');
		return e;
	});
};



Parser.prototype._advance = function (id) {
	var a, o, t, v;
	if (id && this._token.id !== id) {
		var expString = '\'' + id + '\'',
			foundString = '\'' + this._token.value+ '\'';
		if (id === '(end)') {
			expString = 'end of input';
		}
		else if (this._token.value === '(end)') {
			foundString = 'end of input';
		}
		throw SyntaxError('Expected ' + expString +
			' but found ' + foundString + '.');
	}
	if (this._token_nr >= this._tokens.length) {
		this._token = this._symbol_table['(end)'];
		return null;
	}
	t = this._tokens[this._token_nr];
	this._token_nr += 1;

	v = t.value;
	a = t.type;
	if (a === 'atom') {
		o = this._symbol_table['(atom)'];
		a = 'atom';
	} else if (a === 'operator') {
		o = this._symbol_table[v];
		if (!o) {
			throw SyntaxError('Expected an operator ' + 
				'but found \'' + v + '\'.');
		}
	} else {
		throw SyntaxError('Expected a token ' +
			'but found \'{ type: ' +
			a + ', value: ' + 
			v +' }\'.');
	}
	this._token = assign({}, o);
	this._token.value = v;
	return this._token;
};

Parser.prototype._expression = function (rbp) {
	var left;
	var t = this._token;
	this._advance();
	if (t.value === '(end)') {
		throw SyntaxError('Unexpected end of input');
	}
	left = t.nud();
	while (rbp < this._token.lbp) {
		t = this._token;
		this._advance();
		left = t.led(left);
	}
	return left;
};

Parser.prototype._symbol = function(id, bp) {
	var s = this._symbol_table[id];
	bp = bp || 0;
	if (s) {
		if (bp >= s.lbp) {
			s.lbp = bp;
		}
	}
	else {
		s = {};
		s.nud = s.led = _noarg;
		s.id = s.value = id;
		s.lbp = bp;
		this._symbol_table[id] = s;
	}
	return s;
};

Parser.prototype._constant = function(s, v) {
	var x = this._symbol(s);
	x.args = 0;
	var context = this;
	x.nud = function() {
		this.value = context._symbol_table[this.id].value;
		return this;
	};
	x.value = v;
	return x;
};

Parser.prototype._infix = function(id, bp, led) {
	var s = this._symbol(id, bp);
	s.args = 2;
	var context = this;
	s.led = led || function(left) {
		this[0] = left;
		this[1] = context._expression(bp);
		return this;
	};
	return s;
};

Parser.prototype._infixr = function (id, bp, led) {
	var s = this._symbol(id, bp);
	s.args = 2;
	var context = this;
	s.led = led || function(left) {
		this[0] = left;
		this[1] = context._expression(bp - 1);
		return this;
	};
	return s;
};

Parser.prototype._prefix = function(id, nud) {
	var s = this._symbol(id);
	s.args = 1;
	var context = this;
	s.nud = nud || function () {
		this[0] = context._expression(70);
		return this;
	};
	return s;
};

Parser.prototype.parse = function(toks) {
	this._tokens = toks;
	this._token_nr = 0;
	this._advance();
	var s = this._expression(0);
	this._advance('(end)');
	return s;
};

export default function(data) {
	if ((typeof data) === 'string') {
		data = tokenize(data);
	}
	return sanitize(translate(combineOps(new Parser().parse(data))));
};
