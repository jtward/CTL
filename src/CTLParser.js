import tokenize from './CTLTokenizer';
import { expressionParser } from 'generalpratt';

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
	return LTLOperators.includes(value);
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
		return (
			_OR(
				_NOT(
					_EU(
						_NOT(b),
						_AND(_NOT(a), _NOT(b)))),
				_EG(_NOT(b))));
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

const verifyLTL = (node) => {
	if (node.subtrees) {
		const LTLOperator = node.subtrees.find((subtree) => {
			return isLTLOperator(subtree.value);
		});

		if (LTLOperator) {
			return `No matching CTL operator for LTL operator '${LTLOperator.value}'.`;
		}
		else {
			return true;
		}
	}
	else {
		return true;
	}
};

const symbols = {
	'atom': {},
	'&': { arity: 2, leftBindingPower: 30, verify: verifyLTL },
	'|': { arity: 2, leftBindingPower: 30, verify: verifyLTL },
	'->': { arity: 2, leftBindingPower: 20, verify: verifyLTL },
	'U': { arity: 2, leftBindingPower: 10, verify: verifyLTL },
	'R': { arity: 2, leftBindingPower: 10, verify: verifyLTL },
	'W': { arity: 2, leftBindingPower: 10, verify: verifyLTL },
	'E': { arity: 1, prefix: true, leftBindingPower: 50, transform: transformCTL, verify: verifyCTL },
	'A': { arity: 1, prefix: true, leftBindingPower: 50, transform: transformCTL, verify: verifyCTL },
	'!': { arity: 1, prefix: true, leftBindingPower: 40, transform: transformNot, verify: verifyLTL },
	'F': { arity: 1, prefix: true, leftBindingPower: 40 },
	'G': { arity: 1, prefix: true, leftBindingPower: 40 },
	'X': { arity: 1, prefix: true, leftBindingPower: 40 },
	'(': { arity: 1, prefix: true, leftBindingPower: 0, matches: ')', transform: transformParen },
	')': {}
};

const parse = expressionParser(symbols);

export default (data) => {
	const tokens = typeof data === 'string' ? tokenize(data) : data;
	const ast = parse(tokens);

	if (isLTLOperator(ast.value)) {
		throw {
			name: 'SyntaxError',
			message: `No matching CTL operator for LTL operator '${ast.value}'.`
		};
	}

	return ast;
};
