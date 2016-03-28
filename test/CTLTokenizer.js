import assert from 'assert';
import CTL from '../src/CTL';

const tokenize = CTL.tokenize;

describe('tokenizer', function() {
	describe('empty input', function() {
		it('should treat the empty string as empty input', function() {
			const tokens = Array.from(tokenize(''));
			assert.strictEqual(tokens.length, 0);
		});

		it('should treat whitespace as empty input', function() {
			const tokens = Array.from(tokenize('   	\t\n\r\n\u00A0\uFEFF'));
			assert.strictEqual(tokens.length, 0);
		});
	});
    
	describe('atoms', function() {
		it('should tokenize an \'a\' as an atom', function () {
			const tokens = Array.from(tokenize('a'));
			assert.deepEqual(tokens[0], {
				type: 'atom',
				value: 'a'
			});
		});

		it('should tokenize a quoted \'a\' as an atom', function () {
			const tokens = Array.from(tokenize('"a"'));
			assert.deepEqual(tokens[0], {
				type: 'atom',
				value: 'a'
			});
		});

		it('should tokenize \\T as \'\\T\'', function () {
			const tokens = Array.from(tokenize('\\T'));
			assert.deepEqual(tokens[0], {
				type: 'atom',
				value: '\\T'
			});
		});

		it('should tokenize T as \'T\'', function () {
			const tokens = Array.from(tokenize('T'));
			assert.deepEqual(tokens[0], {
				type: 'atom',
				value: 'T'
			});
		});

		it('should throw a syntax error on an empty quoted atom', function () {
			assert.throws(function() {
				return Array.from(tokenize('""'));
			}, function(exception) {
				assert.equal(exception.name, 'SyntaxError');
				assert.equal(exception.message, 'Unknown character: \'"\'.');
				return true;
			}, 'Unexpected error');
		});

		it('should throw a syntax error when tokenizing a backslash', function () {
			assert.throws(function() {
				return Array.from(tokenize('\\'));
			}, function(exception) {
				assert.equal(exception.name, 'SyntaxError');
				assert.equal(exception.message, 'Unknown character: \'\\\'.');
				return true;
			}, 'Unexpected error');
		});

		it('should throw an error when tokenizing a backslash followed by a character', function () {
			assert.throws(function() {
				return Array.from(tokenize('\\a'));
			}, function(exception) {
				assert.equal(exception.name, 'SyntaxError');
				assert.equal(exception.message, 'Unknown character: \'\\\'.');
				return true;
			}, 'Unexpected error');
		});
	});

	describe('operators', function() {
		it('should tokenize ! as the not operator', function () {
			const tokens = Array.from(tokenize('!'));
			assert.deepEqual(tokens[0], {
				type: 'operator',
				value: '!'
			});
		});

		it('should tokenize -> as the implication operator', function () {
			const tokens = Array.from(tokenize('->'));
			assert.deepEqual(tokens[0], {
				type: 'operator',
				value: '->'
			});
		});
	});
});
