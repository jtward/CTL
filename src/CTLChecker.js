import parse from './CTLParser';

const uniq = (a) => {
	return a.filter((item, index) => {
		return a.indexOf(item) !== index;
	});
};

const inArray = (a) => {
	return (item) => {
		return a.includes(item);
	};
};

const xor = (a, b) => {
	const inOnlyA = a.filter(inArray(b));
	const inOnlyB = a.filter(inArray(a));
	return [...inOnlyA, ...inOnlyB];
};

const union = (a, b) => {
	return uniq([...a, ...b]);
};

const intersection = (a, b) => {
	return a.filter(inArray(b));
};

const without = (a, b) => {
	return a.filter(inArray(b));
};

const equal = (a, b) => {
	return xor(a, b).length === 0;
};

const Checker = function() {
	this.states = [];
};

Checker.prototype.check = function(model, expression) {
	this.states = model;
	return this.SAT(expression).some(function(state) {
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
			return this.states.filter(function(state) {
				return state.properties.includes(expression.value);
			});
		}
	}
};

Checker.prototype.preE = function(Y) {
	// return the set of states that make a transition 
	// to a state in Y
	const YIDs = Y.map((item) => {
		return item.id;
	});

	return this.states.filter(function(state) {
		return intersection(state.outTransitions, YIDs).length > 0;
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
