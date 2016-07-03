import assert from 'assert';
import { each, map } from 'lodash';
import CTL from '../lib/CTL';

const aAtom = (value) => {
	return (ast) => {
		assert.equal(ast.subtrees, undefined);
		assert.equal(ast.value, value);
	};
};

const opAsserter = (arity, value) => {
	const asserter = (...asserts) => {
		return (ast) => {
			assert.equal(ast.value, value);
			each(asserts, (asserter, index) => {
				if (typeof asserter === 'function') {
					asserter(ast.subtrees[index]);
				}
				else if (typeof asserter === 'object') {
					assert.deepEqual(asserter, ast.subtrees[index]);
				}
			});
		};
	};
	asserter.arity = arity;
	asserter.value = value;
	return asserter;
};

const aNot = opAsserter(1, '!');
const aOr = opAsserter(2, '|');
const aAnd = opAsserter(2, '&');
const aImplies = opAsserter(2, '->');
const aEX = opAsserter(1, 'EX');
const aEG = opAsserter(1, 'EG');
const aEU = opAsserter(2, 'EU');

const unaryOperators = [aNot, aEX, aEG];
const infixBinaryOperators = [aOr, aAnd, aImplies];
const prefixBinaryOperators = [aEU];

const stripLocationData = (syntaxTree) => {
	syntaxTree.subtrees = map(syntaxTree.subtrees, stripLocationData);
	syntaxTree.loc = undefined;
	return syntaxTree;
};

describe('CTL Parser', () => {
	it('is exported', () => {
		assert.equal(typeof CTL.parse, 'function');
	});

	it('throws on empty input', () => {
		assert.throws(() => {
			CTL.parse('');
		});
	});

	it('parses an atom', () => {
		aAtom('foo')(CTL.parse('foo'));
	});

	it('parses a boolean atom', () => {
		const ast = CTL.parse('\\T');
		aAtom('\\T')(ast);
	});

	it('parses unary operators', () => {
		each(unaryOperators, (operator) => {
			const atom = 'foo';
			const ast = CTL.parse(`${operator.value} ${atom}`);
			operator(aAtom(atom))(ast);
		});
	});

	it('parses infix binary operators', () => {
		each(infixBinaryOperators, (operator) => {
			const leftAtom = 'a';
			const rightAtom = 'b';
			const ast = CTL.parse(`${leftAtom} ${operator.value} ${rightAtom}`);
			const left = aAtom(leftAtom);
			const right = aAtom(rightAtom);
			operator(left, right)(ast);
		});
	});

	it('parses EU', () => {
		const leftAtom = 'a';
		const rightAtom = 'b';
		const ast = CTL.parse(`E(${leftAtom} U ${rightAtom})`);
		const left = aAtom(leftAtom);
		const right = aAtom(rightAtom);
		aEU(left, right)(ast);
	});

	it('parses EF', () => {
		const leftAtom = 'a';
		const ast = CTL.parse(`EF ${leftAtom}`);
		const left = aAtom(leftAtom);
		const T = aAtom('\\T');
		aEU(T, left)(ast);
	});

	it('parses ER', () => {
		const leftAtom = 'a';
		const rightAtom = 'b';
		const ast = CTL.parse(`E(${leftAtom} R ${rightAtom})`);
		const left = aAtom(leftAtom);
		const right = aAtom(rightAtom);

		aAnd(
			aEU(right, aAnd(left, right)),
			aNot(aEG(right))
		)(ast);
	});

	it('parses EW', () => {
		const leftAtom = 'a';
		const rightAtom = 'b';
		const ast = CTL.parse(`E(${leftAtom} W ${rightAtom})`);
		const left = aAtom(leftAtom);
		const right = aAtom(rightAtom);

		aAnd(
			aEU(aOr(left, right), right),
			aNot(aEG(aOr(left, right)))
		)(ast);
	});

	it('parses AX', () => {
		const leftAtom = 'a';
		const ast = CTL.parse(`AX ${leftAtom}`);
		const left = aAtom(leftAtom);

		aNot(aEX(aNot(left)))(ast);
	});

	it('parses AG', () => {
		const leftAtom = 'a';
		const ast = CTL.parse(`AX ${leftAtom}`);
		const left = aAtom(leftAtom);
		const T = aAtom('\\T');

		aNot(aEU(T, aNot(left)));
	});

	it('parses AF', () => {
		const leftAtom = 'a';
		const ast = CTL.parse(`AX ${leftAtom}`);
		const left = aAtom(leftAtom);

		aNot(aEG(aNot(left)));
	});

	it('parses AU', () => {
		// !EU(!b, !a & !b) | EG(!b)
		const leftAtom = 'a';
		const rightAtom = 'b';
		const ast = CTL.parse(`A(${leftAtom} U ${rightAtom})`);
		const left = aAtom(leftAtom);
		const right = aAtom(rightAtom);
		const T = aAtom('\\T');

		aOr(
			aNot(
				aEU(
					aNot(right),
					aAnd(aNot(left), aNot(right))
				)
			),
			aEG(aNot(right))
		)(ast);
	});

	it('parses AW', () => {
		// !EU(!b, !a & !b)
		const leftAtom = 'a';
		const rightAtom = 'b';
		const ast = CTL.parse(`A(${leftAtom} W ${rightAtom})`);
		const left = aAtom(leftAtom);
		const right = aAtom(rightAtom);
		const T = aAtom('\\T');

		aNot(aEU(aNot(right), aAnd(aNot(left), aNot(right))))(ast);
	});

	it('collapses negations', () => {
		const ast = CTL.parse('!!!!!a');
		aNot(aAtom('a'))(ast);
	});

	describe('operator precedence', () => {
		it('binds not tighter than implication', () => {
			const atomA = 'a';
			const atomB = 'b';
			const a = aAtom(atomA);
			const b = aAtom(atomB);
			const ast1 = CTL.parse(`!${atomA} -> ${atomB}`);
			aImplies(aNot(a), b)(ast1);

			const ast2 = CTL.parse(`${atomA} -> !${atomB}`);
			aImplies(a, aNot(b))(ast2);
		});

		it('binds brackets tighter than implication', () => {
			const atomA = 'a';
			const atomB = 'b';
			const atomC = 'c';
			const a = aAtom(atomA);
			const b = aAtom(atomB);
			const c = aAtom(atomC);
			const ast = CTL.parse(`(${atomA} -> ${atomB}) | ${atomC}`);
			aOr(aImplies(a, b), c)(ast);
		});

		it('binds implication tighter than or', () => {
			const atomA = 'a';
			const atomB = 'b';
			const atomC = 'c';
			const a = aAtom(atomA);
			const b = aAtom(atomB);
			const c = aAtom(atomC);

			const ast1 = CTL.parse(`${atomA} -> ${atomB} | ${atomC}`);
			aImplies(a, aOr(b, c))(ast1);

			const ast2 = CTL.parse(`${atomA} | ${atomB} -> ${atomC}`);
			aImplies(aOr(a, b), c)(ast2);
		});

		it('binds and and or equally tightly', () => {
			const atomA = 'a';
			const atomB = 'b';
			const atomC = 'c';
			const a = aAtom(atomA);
			const b = aAtom(atomB);
			const c = aAtom(atomC);

			const ast1 = CTL.parse(`${atomA} & ${atomB} | ${atomC}`);
			aOr(aAnd(a, b), c)(ast1);

			const ast2 = CTL.parse(`${atomA} | ${atomB} & ${atomC}`);
			aAnd(aOr(a, b), c)(ast2);
		});

		it('binds or tighter than U', () => {
			const atomA = 'a';
			const atomB = 'b';
			const atomC = 'c';
			const a = aAtom(atomA);
			const b = aAtom(atomB);
			const c = aAtom(atomC);

			const ast1 = CTL.parse(`E(${atomA} U ${atomB} | ${atomC})`);
			aEU(a, aOr(b, c))(ast1);

			const ast2 = CTL.parse(`E(${atomA} | ${atomB} U ${atomC})`);
			aEU(aOr(a, b), c)(ast2);
		});

		it('binds or tighter than R', () => {
			const atomA = 'a';
			const atomB = 'b';
			const atomC = 'c';
			const a = aAtom(atomA);
			const b = aAtom(atomB);
			const c = aAtom(atomC);

			const ast1 = CTL.parse(`E(${atomA} R ${atomB} | ${atomC})`);
			assert.deepEqual(stripLocationData(ast1), stripLocationData(CTL.parse(`E(${atomA} R (${atomB} | ${atomC}))`)));

			const ast2 = CTL.parse(`E(${atomA} | ${atomB} R ${atomC})`);
			assert.deepEqual(stripLocationData(ast2), stripLocationData(CTL.parse(`E((${atomA} | ${atomB}) R ${atomC})`)));
		});

		it('binds EX tighter than implication', () => {
			const atomA = 'a';
			const atomB = 'b';
			const a = aAtom(atomA);
			const b = aAtom(atomB);

			const ast1 = CTL.parse(`EX ${atomA} -> ${atomB}`);
			aImplies(aEX(a), b)(ast1);
		});

		it('binds EG tighter than implication', () => {
			const atomA = 'a';
			const atomB = 'b';
			const a = aAtom(atomA);
			const b = aAtom(atomB);

			const ast1 = CTL.parse(`EG ${atomA} -> ${atomB}`);
			aImplies(aEG(a), b)(ast1);
		});

		it('binds EF tighter than implication', () => {
			const atomA = 'a';
			const atomB = 'b';
			const a = aAtom(atomA);
			const b = aAtom(atomB);

			const ast1 = CTL.parse(`EF ${atomA} -> ${atomB}`);
			aImplies(CTL.parse(`EF ${atomA}`), b)(ast1);
		});

		it('binds implication tighter than EU', () => {
			const atomA = 'a';
			const atomB = 'b';
			const atomC = 'c';
			const a = aAtom(atomA);
			const b = aAtom(atomB);
			const c = aAtom(atomC);

			const ast1 = CTL.parse(`E(${atomA} -> ${atomB} U ${atomC})`);
			aEU(aImplies(a, b), c)(ast1);

			const ast2 = CTL.parse(`E(${atomA} U ${atomB} -> ${atomC})`);
			aEU(a, aImplies(b, c))(ast2);
		});

		it('binds implication tighter than ER', () => {
			const atomA = 'a';
			const atomB = 'b';
			const atomC = 'c';

			const ast1 = CTL.parse(`E(${atomA} -> ${atomB} R ${atomC})`);
			assert.deepEqual(stripLocationData(ast1), stripLocationData(CTL.parse(`E((${atomA} -> ${atomB}) R ${atomC})`)));

			const ast2 = CTL.parse(`E(${atomA} R ${atomB} -> ${atomC})`);
			assert.deepEqual(stripLocationData(ast2), stripLocationData(CTL.parse(`E(${atomA} R (${atomB} -> ${atomC}))`)));
		});

		it('binds implication tighter than EW', () => {
			const atomA = 'a';
			const atomB = 'b';
			const atomC = 'c';

			const ast1 = CTL.parse(`E(${atomA} -> ${atomB} W ${atomC})`);
			assert.deepEqual(stripLocationData(ast1), stripLocationData(CTL.parse(`E((${atomA} -> ${atomB}) W ${atomC})`)));

			const ast2 = CTL.parse(`E(${atomA} W ${atomB} -> ${atomC})`);
			assert.deepEqual(stripLocationData(ast2), stripLocationData(CTL.parse(`E(${atomA} W (${atomB} -> ${atomC}))`)));
		});
	});
	describe('errors', () => {
		it('throws an unexpected end of input error after not', () => {
			assert.throws(() => {
				CTL.parse('!');
			}, (e) => {
				return (e.name === 'SyntaxError' && e.message === 'Unexpected end of input.');
			});
		});

		it('throws an unexpected end of input error after and', () => {
			assert.throws(() => {
				CTL.parse('a &');
			}, (e) => {
				return (e.name === 'SyntaxError' && e.message === 'Unexpected end of input.');
			});
		});

		it('throws a missing argument error after and', () => {
			assert.throws(() => {
				CTL.parse('& a');
			}, (e) => {
				return (e.name === 'SyntaxError' && e.message === 'Expected a value or prefix operator but found \'&\'.');
			});
		});
		it('throws an error for mismatched brackets', () => {
			assert.throws(() => {
				CTL.parse('( a ');
			}, (e) => {
				return (e.name === 'SyntaxError' && e.message === 'Expected \')\' but found end of input.');
			});
		});
		it('throws an error for CTL operators without a corresponding LTL operator', () => {
			assert.throws(() => {
				CTL.parse('E a');
			}, (e) => {
				return (e.name === 'SyntaxError' && e.message === 'Expected an LTL operator but found \'a\'.');
			});
		});
		it('throws an error for LTL operators without a corresponding CTL operator', () => {
			assert.throws(() => {
				CTL.parse('a & (X b)');
			}, (e) => {
				return (e.name === 'SyntaxError' && e.message === 'No matching CTL operator for LTL operator \'X\'.');
			});
		});
		it('throws an error for top-level LTL operators', () => {
			assert.throws(() => {
				CTL.parse('X a');
			}, (e) => {
				return (e.name === 'SyntaxError' && e.message === 'No matching CTL operator for LTL operator \'X\'.');
			});
		});
	});
});
