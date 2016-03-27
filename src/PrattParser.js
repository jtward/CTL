import { assign, includes, map } from 'lodash';
import tokenize from './CTLTokenizer';

const SyntaxError = (message) => {
	return {
		name: 'SyntaxError',
		message
	};
};

const Symbol = ({ id = undefined, value = id, leftBindingPower = 0, arity = 0, matches = undefined }) => {
	return {
		id,
		leftBindingPower,
		arity,
		value,
		matches
	};
};

const END = {
	id: {}
};

const throwExpected = (expectedId, token) => {
	const end = 'end of input';
	const expectedString = (expectedId === END.id) ? end : `'${token.id}'`;
	const foundString = (token === END) ? end : `'${token.value}'`;

	throw SyntaxError(`Expected ${expectedString} but found ${foundString}`);
};

const nud = (token, expression, advance) => {
	if (token.matches) {
		const e = expression(token.leftBindingPower);
		advance(token.matches);
		return e;
	}
	else if (token.arity <= 1) {
		return {
			id: token.id,
			value: token.value,
			subtrees: token.arity === 0 ? undefined : [expression(Infinity)]
		};
	}
	else {
		throw SyntaxError(`Missing argument to operator '${(token.value ? token.value : '')}'.`);
	}
};

export default (symbolTable, tokens) => {
	symbolTable = new Map(map(symbolTable, (symbol) => [symbol.id, Symbol(symbol)]));
	let token = tokens[0];

	const advance = (expectedId) => {
		if (expectedId && token.id !== expectedId) {
			throwExpected(expectedId, token);
		}

		if (tokens.length) {
			const { type, value } = tokens.shift();
			const t = symbolTable.get(type === 'operator' ? value : type);
			token = {
				id: t.id,
				value,
				subtrees: [],
				leftBindingPower: t.leftBindingPower,
				arity: t.arity,
				matches: t.matches
			};
		}
		else {
			token = END;
		}
	};

	const parseInfix = (rightBindingPower, parseTree) => {
		if (rightBindingPower < token.leftBindingPower) {
			const t = token;
			advance();
			return parseInfix(rightBindingPower, {
				id: t.id,
				value: t.value,
				subtrees: [
					parseTree,
					expression(t.leftBindingPower - 1)
				]
			});
		}
		else {
			return parseTree;
		}
	};

	const expression = (rightBindingPower) => {
		if (token === END) {
			throw SyntaxError('Unexpected end of input.');
		}

		const t = token;
		advance();
		return parseInfix(rightBindingPower, nud(t, expression, advance));
	};

	advance();
	const ast = expression(0);
	advance(END.id);
	return(ast);
};
