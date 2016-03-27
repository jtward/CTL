import Tokenizer from './Tokenizer';

const CTLRules = [{
	// whitespace
	regex: /^\s*/
}, {
	// unquoted atoms
	regex: /^(((?![FAUXGREW])[\w\d\u0391-\u03C9\u00C0-\u00FF])+)/,
	type: 'atom'
}, {
	// quoted atoms
	regex: /^(['"])(.+?)\1/,
	valueCaptureGroup: 2,
	type: 'atom'
}, {
	// boolean literals
	regex: /^\\[TF]/,
	type: 'atom'
}, {
	// operators
	regex: /^[FAUXGREW&|!()]|->/,
	type: 'operator'
}];

export default Tokenizer(CTLRules);
