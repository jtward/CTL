import tokenize from './CTLTokenizer';
import parser from './PrattParser';

const identity = (a) => a;

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
	['&', '|', 'EU', '!', 'EX', 'EG'].map(operator);

const LTLOperators = ['G', 'F', 'X', 'U', 'W', 'R'];
const isLTLOperator = (value) => {
	return LTLOperators.indexOf(value) !== -1;
};

const CTLTransformations = {
	'EF': (node) => _EU(TRUE, node.subtrees[0]),
	'ER': (node) => {
		const [a, b] = node.subtrees;
		return _AND(_EU(b, _AND(a, b)), _NOT(_EG(b)));
	},
	'EW': (node) => {
		const [a, b] = node.subtrees;
		return _AND(_EU(_OR(a, b), b), _NOT(_EG(_OR(a, b))));
	},
	'AX': (node) => {
		const [a] = node.subtrees;
		return _NOT(_EX(_NOT(a)));
	},
	'AG': (node) => {
		const [a] = node.subtrees;
		return _NOT(_EU(TRUE, _NOT(a)));
	},
	'AF': (node) => {
		const [a] = node.subtrees;
		return _NOT(_EG(_NOT(a)));
	},
	'AU': (node) => {
		const [a, b] = node.subtrees;

		return _OR(
				_NOT(
					_EU(
						_NOT(b),
						_AND(_NOT(a), _NOT(b)))),
				_EG(_NOT(b)));
	},
	'AR': (node) => {
		const [a, b] = node.subtrees;

		return _NOT(_EU(_NOT(a), _NOT(b)));
	},
	'AW': (node) => {
		const [a, b] = node.subtrees;
		return _NOT(_EU(_NOT(b), _AND(_NOT(a), _NOT(b))));
	}
};

// TODO: Throw a syntax error if the pairs are not matched.
const transformCTL = (node) => {
	const subtree = node.subtrees[0];
	const combinedTree = {
		value: `${node.value}${subtree.value}`,
		subtrees: subtree.subtrees
	};

	const CTLTransformation = CTLTransformations[combinedTree.value] || identity;
	return CTLTransformation(combinedTree);
};

const verifyCTL = (node) => {
	const subtreeValue = node.subtrees[0].value;
	if (isLTLOperator(subtreeValue)) {
		return true;
	}
	else {
		return `Expected an LTL operator but found '${subtreeValue}'.`;
	}
};

const transformParen = (node) => {
	return node.subtrees[0];
};

const transformNot = (node) => {
	if (node.subtrees[0].value === node.value) {
		return node.subtrees[0].subtrees[0];
	}
	else {
		return node;
	}
};

const symbols = {
	'atom': {},
	'&': { arity: 2, leftBindingPower: 30 },
	'|': { arity: 2, leftBindingPower: 30 },
	'->': { arity: 2, leftBindingPower: 20 },
	'U': { arity: 2, leftBindingPower: 10 },
	'R': { arity: 2, leftBindingPower: 10 },
	'W': { arity: 2, leftBindingPower: 10 },
	'E': { arity: 1, transform: transformCTL, verify: verifyCTL },
	'A': { arity: 1, transform: transformCTL, verify: verifyCTL },
	'!': { arity: 1, transform: transformNot },
	'F': { arity: 1 },
	'G': { arity: 1 },
	'X': { arity: 1 },
	'(': { arity: 1, leftBindingPower: 0, matches: ')', transform: transformParen },
	')': {}
};

const parse = parser(symbols);

export default (data) => {
	const tokens = typeof data === 'string' ? tokenize(data) : data;
	return parse(tokens);
};
