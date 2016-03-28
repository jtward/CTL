import { map } from 'lodash';
import tokenize from './CTLTokenizer';
import parser from './PrattParser';


const operator = (value) => {
	return (...subtrees) => {
		return {
			value,
			subtrees
		};
	};
};

const TRUE = {
	value: '\\T',
	subtrees: undefined
};

const [_AND, _OR, _EU, _NOT, _EX, _EG] =
	map(['&', '|', 'EU', '!', 'EX', 'EG'], operator);

const CTLOperators = ['A', 'E'];
const LTLOperators = ['G', 'F', 'X', 'U', 'W', 'R'];
const isCTLOperator = (value) => {
	return CTLOperators.indexOf(value) !== -1;
};
const isLTLOperator = (value) => {
	return LTLOperators.indexOf(value) !== -1;
};

// combine CTL-LTL operator pairs into single tokens
// Throw a syntax error if the pairs are not matched.
const combineOps = function(tree) {
	if (tree.subtrees) {
		if (isCTLOperator(tree.value)) {
			const value = `${tree.value}${tree.subtrees[0].value}`;
			return operator(value)(...map(tree.subtrees[0].subtrees, combineOps));
		}
		else if (isLTLOperator(tree.value)) {
			throw SyntaxError(`Expected a CTL operator but found '${tree.value}'.`);
		}
		else {
			return {
				value: tree.value,
				subtrees: map(tree.subtrees, combineOps)
			};
		}
	}
	else {
		return tree;
	}
};

const translate = (tree) => {
	if (tree.subtrees) {
		if (tree.value === 'EX' || tree.value === 'EG') {
			return {
				value: tree.value,
				subtrees: map(tree.subtrees, translate)
			};
		}
		else if (tree.value === 'EU') {
			return {
				value: tree.value,
				subtrees: map(tree.subtrees, translate)
			};
		}
		else if (tree.value === 'EF') {
			// EF a = EU(TRUE, a)
			const a = translate(tree.subtrees[0]);
			return _EU(TRUE, a);
		}
		else if (tree.value === 'ER') {
			// ER(a, b) = !AU(!a, !b)
			//          = EU(b, a&b) & !EG(b)
			const [a, b] = map(tree.subtrees, translate);
			return _AND(_EU(b, _AND(a, b)), _NOT(_EG(b)));
		}
		else if (tree.value === 'EW') {
			// EW(a, b) = !ER(b, a|b)
			//          = EU(a|b, b&(a|b)) & !EG(a|b)
			//          = EU(a|b, b) & !EG(a|b)
			const [a, b] = map(tree.subtrees, translate);
			return _AND(_EU(_OR(a, b), b), _NOT(_EG(_OR(a, b))));
		}
		else if (tree.value === 'AX') {
			// AX(a) = !EX(!a)
			// do the negation before translating to catch double negations
			return _NOT(_EX(translate(_NOT(tree.subtrees[0]))));
		}
		else if (tree.value === 'AG') {
			// AG(a) = !EF(!a)
			//       = !EU(T, !a)
			const notA = translate(_NOT(tree.subtrees[0]));
			return _NOT(_EU(TRUE, notA));
		}
		else if (tree.value === 'AF') {
			// AF(a) = !EG(!a)
			return _NOT(_EG(translate(_NOT(tree.subtrees[0]))));
		}
		else if (tree.value === 'AU') {
			// AU(a, b) = !EU(!b, !a & !b) | EG(!b)
			const [notA, notB] = map(tree.subtrees, (subtree) => {
				return translate(_NOT(subtree));
			});

			return _OR(
					_NOT(
						_EU(
							notB,
							_AND(notA, notB))),
					_EG(notB));
		}
		else if (tree.value === 'AR') {
			// AU(a, b) = !EU(!a, !b)
			const [notA, notB] = map(tree.subtrees, (subtree) => {
				return translate(_NOT(subtree));
			});

			return _NOT(
					_EU(
						notA,
						notB));
		}
		else if (tree.value === 'AW') {
			// AW(a, b) = !EU(!b, !a & !b)
			const [notA, notB] = map(tree.subtrees, (subtree) => {
				return translate(_NOT(subtree));
			});

			return _NOT(_EU(notB, _AND(notA, notB)));
		}
		else if (tree.value === '!') {
			if (tree.subtrees[0].value === '!') {
				// remove any number of double negations.
				while (tree.value === '!' &&
					tree.subtrees[0].value === '!') {
					tree = tree.subtrees[0].subtrees[0];
				}
				return translate(tree);
			}
			else {
				return _NOT(translate(tree.subtrees[0]));
			}
		}
		else {
			return {
				value: tree.value,
				subtrees: map(tree.subtrees, translate)
			};
		}
	}
	else {
		return tree;
	}
};

const symbols = [
	{ id: 'atom' },
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
	{ id: '(', arity: 1, leftBindingPower: 0, matches: ')' },
	{ id: ')' }
];

const parse = parser(symbols);

export default (data) => {
	const tokens = typeof data === 'string' ? tokenize(data) : data;
	return translate(combineOps(parse(tokens)));
};
