import { intersection, isEmpty, filter, map, some, union, without, xor } from 'lodash-es';
import parse from './CTLParser';

const equal = (a, b) => {
	return isEmpty(xor(a, b));
};

const Checker = function() {
	this.states = [];
};

Checker.prototype.check = function(model, expression) {
	this.states = model;
	return some(this.SAT(expression), function(state) {
		return state.isInitial;
	});
};

Checker.prototype.SAT = function(expression) {
	if (expression.subtrees) {
		switch (expression.value) {
		case '!':
			return without(
				this.states,
				this.SAT(expression.subtrees[0]));
		case '|':
			return union(
				this.SAT(expression.subtrees[0]),
				this.SAT(expression.subtrees[1]));
		case '&':
			return intersection(
				this.SAT(expression.subtrees[0]),
				this.SAT(expression.subtrees[1]));
		case '->':
			return union(
				intersection(this.SAT(expression.subtrees[0]),
					this.SAT(expression.subtrees[1])),
				without(this.states,
					this.SAT(expression.subtrees[0])));
		case 'EX':
			return this.SAT_EX(expression.subtrees[0]);
		case 'EU':
			return this.SAT_EU(expression.subtrees[0], expression.subtrees[1]);
		case 'EG':
			return this.SAT_EG(expression.subtrees[0]);
		default:
			throw {
				name: 'SystemError',
				message: 'Expected an operator but found \'' + expression.value + '\'.'
			};
		}
	}
	else {
		if (expression.value === '\\T') {
			//true is true for all states
			return this.states;
		}
		else if (expression.value === '\\F') {
			//false is true in no states
			return [];
		}
		else {
			// return the set of states which include the given atom
			return filter(this.states, function(state) {
				return includes(state.properties, expression.value);
			});
		}
	}
};

Checker.prototype.preE = function(Y) {
	// return the set of states that make a transition 
	// to a state in Y
	const YIDs = map(Y, 'id');

	return filter(this.states, function(state) {
		return !isEmpty(intersection(state.outTransitions, YIDs));
	});
};
	
Checker.prototype.SAT_EX = function(expression) {
	return this.preE(this.SAT(expression));
};

Checker.prototype.SAT_EU = function(first, second) {
	// return the set of states that satisfy EU(first, second)
	// increase the length of the path between a state in 
	// SAT(first) and a state in SAT(second) until there 
	// is no change.
	const W = this.SAT(first);
	let X = this.states;
	let Y = this.SAT(second);

	while(!equal(X, Y)) {
		[X, Y] = [Y, union(Y, intersection(W, this.preE(Y)))];
	}

	return Y;
};

Checker.prototype.SAT_EG = function(expression) {
	let X = [];
	let Y = this.SAT(expression);

	while (!equal(X, Y)) {
		[X, Y] = [Y, intersection(Y, this.preE(Y))];
	}

	return Y;
};

export default (model, expression) => {
	if ((typeof expression) === 'string') {
		expression = parse(expression);
	}
	return new Checker().check(model, expression);
};

/*CTL.generateRandomModel = function(numStates) {
	var model = [], i = numStates, properties = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
	while(i--) {
		var numProperties = 1 + Math.floor(Math.random() * (properties.length - 1));
		var stateProperties = [];
		var j = numProperties;
		while(j--) {
			stateProperties.push(properties[Math.floor(Math.random() * properties.length)]);
		}
		stateProperties = _.uniq(stateProperties);
		var numTransitions = 1 + Math.floor(Math.random() * 4);
		var transitions = [];
		j = numTransitions;
		while(j--) {
			transitions.push(Math.floor(Math.random() * numStates));
		}
		transitions = _.uniq(transitions);
		model.push({
			id: i,
			isInitial: (Math.random() > 0.5),
			properties: stateProperties,
			outTransitions: transitions
		});
	}
	return model;
};*/
