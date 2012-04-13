/**
 * a model looks like:
 * 
 * {
 *    any id,
 *    boolean isInitial,
 *    string[] properties,
 *    <id>[] outTransitions
 * }[]
 */
(function(CTL) {
    'use strict';
    var _equal = function(a, b) {
	return !_.without(a, b).length && 
	    !_.without(b, a).length;
    };
    
    var Checker = function() {
	this._S = [];
    };

    Checker.prototype.check = function(model, formula) {
	this._S = model;
	return _.any(this.SAT(formula), 
		     function(state) {
			 return state.isInitial;
		     });
    };

    Checker.prototype.SAT = function(formula) {
	var subset, i;
        if(!formula.args) {
            if(formula.value === "\\T") {
                //true is true for all states
                return this._S;
            }
            else if(formula.value === "\\F") {
                //false is true in no states
                return [];
            }
            else {
		subset = [], i = this._S.length;
                while(i--) {
		    if(_.indexOf(this._S[i].properties, formula.value) !== -1) {
			subset.push(this._S[i]);
		    }
                }
                return subset;
            }
        }
        else {
            switch(formula.value) {
            case "!":
                return _.without(
                    this._S, 
                    this.SAT(formula[0]));
            case "|":
                return _.union(
                    this.SAT(formula[0]), 
                    this.SAT(formula[1]));
            case "&":
                return _.intersection(
                    this.SAT(formula[0]), 
                    this.SAT(formula[1]));
            case "->":
                return _.union(
                    _.intersection(this.SAT(formula[0]), 
                                   this.SAT(formula[1])),
                    _.without(this._S, 
                              this.SAT(formula[0])));
            case "EX":
                return this.SAT_EX(formula[0]);
            case "EU":
                return this.SAT_EU(formula[0], formula[1]);
            case "EG":
                return this.SAT_EG(formula[0]);
            default:
                throw { 
                    name: "SystemError", 
	            message: "Expected an operator but found '"+
                        formula.value+"'." 
                };
            }
        }
    };

    Checker.prototype.preE = function(Y) {
        // return the set of states that make a transition 
        // to a state in Y
        var YIDs = _.map(Y, function(el) {
	    return el.id;
	});

	return _.filter(this._S,
			function(el) {
			    return _.intersection(el.outTransitions, YIDs).length > 0;
			});
    }
    
    Checker.prototype.SAT_EX = function(formula) {
        return this.preE(this.SAT(formula));
    };

    Checker.prototype.SAT_EU = function(/*object*/ first, /*object*/ second) {
        // return the set of states that satisfy EU(first, second)
        // increase the length of the path between a state in 
        // SAT(first) and a state in SAT(second) until there 
        // is no change.
        var W, X, Y, preY, intWPreY;
        W = this.SAT(first);
        X = this._S;
        Y = this.SAT(second);
        while(!_equal(X, Y)) {
            X = Y;
	    Y = _.union(Y, _.intersection(W, this.preE(Y)));
        }
        return Y;
    };

    Checker.prototype.SAT_EG = function(formula) {
        var X, Y;
        Y = this.SAT(formula);
        X = [];
        while(!_equal(X, Y)) {
            X = Y;
            Y = _.intersection(Y, this.preE(Y));
        }
        return Y;
    };

    CTL.check = function(model, formula, fairness) {
	if(typeof(formula) === 'string') {
	    formula = CTL.parse(formula);
	}
	var checker = new Checker();
	return checker.check(model, formula, fairness);
    };

    CTL.generateRandomModel = function(numStates) {
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
    };
}(CTL));