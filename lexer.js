const error = require('./error');
const reserved = [
	'nil', 'true', 'false',

	'local',
	
	'for', 'while', 
	'do','end',

	'if','or','and', 'not','then', 'else', 'elseif', 


	'and', 'or',

	'repeat', 'until',

	'function', 'return'
].reduce((res,curr) => {
	res[curr] = curr.toUpperCase();
	return res;
}, {});
module.exports = function(code) {
	let index = 0;
	let line = 1;
	const tokens = [];
	const isNumeric = ch => ch >= '0' && ch <= '9';
	const isAlpha = ch => ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z';
	const isAlphaNum = ch => isNumeric(ch) || isAlpha(ch);

	const addToken = (type, value = type) => tokens.push({type, value, line});
	const match = ch => {
		if (code[index + 1] === ch) {
			++index;
			return true;
		}
		return false;
	};

	for (; index < code.length; ) {
		if (isNumeric(code[index])) {
			let number = code[index];
			++index;
			while (isNumeric(code[index]) && index < code.length) {
				number += code[index];
				++index;
			} 
			if (code[index] === '.') {
				++index
				number += '.';
				while (isNumeric(code[index]) && index < code.length) {
					number += code[index];
					++index;
				} 
			}
			addToken('NUMBER', Number(number));
		} else if (isAlpha(code[index]) || code[index] === '_') {
			let text = code[index];
			++index;
			while((isAlphaNum(code[index]) || code[index] === '_') && index < code.length) {
				text += code[index];
				++index;
			}
			if (text in reserved) addToken(reserved[text]);
			else addToken('IDENTIFIER', text);
		} else {
			switch (code[index]) {
				case '-':
					if (match('-')) {
						if (match('[') && match('[')) {
							while (!(code[index + 1] === '-' && 
							code[index + 2] === '-' && 
							code[index + 3] === ']' && 
							code[index + 4] === ']') && 
							index < code.length) {
								++index;
								if (code[index] === '\n') ++line;
							}
							if (!(code[index + 1] === '-' && 
							code[index + 2] === '-' && 
							code[index + 3] === ']' && 
							code[index + 4] === ']')) {
								error(line, 'Unterminated multiline comment');
							}
							index += 4;
						} else {
							while (code[index + 1] !== '\n' && index < code.length) ++index;
						}
					} else {
						addToken('MINUS');
					}
					break;
				case '"':
				case "'":
					const quoteType = code[index];
					++index;
					let string = '';
					while (code[index] !== quoteType && code[index + 1] !== '\n') {
						if (code[index] === '\\') {
							switch (code[index + 1]) {
								case 'n': string += '\n'; break;
								case 'r': string += '\r'; break;
								case 't': string += '\t'; break;
								case '\\': string += '\\'; break;
								case '"': string += '"'; break;
								case "'": string += "'"; break;
							}
							index += 2;
						} else {
							string += code[index];
							++index;
						}
					}
					if (code[index] !== quoteType) error(line, 'Unterminated string literal');
					addToken('STRING', string);
					break;
				case ' ':
				case '\r':
				case '\t':
					break;
				case '\n':
					++line;
					break;
				case '.': match('.') ? addToken('DOT_DOT') : addToken('DOT'); break;
				case ',': addToken('COMMA'); break;
				case '=': match('=') ? addToken('EQUALS_EQUALS') : addToken('EQUALS'); break;
				case '~': match('=') ? addToken('NOT_EQUALS') : error(line, 'Unexpected character ~'); break;

				case '+': addToken('PLUS'); break;
				case '*': addToken('TIMES'); break;
				case '/': addToken('DIVIDE'); break;

				case '<': match('=') ? addToken('LESS_EQUALS') : addToken('LESS'); break;
				case '>': match('=') ? addToken('GREATER_EQUALS') : addToken('LESS_EQUALS'); break;

				//grouping
				case '(': addToken('OPEN_PAREN'); break;
				case ')': addToken('CLOSE_PAREN'); break;
				case '[': addToken('OPEN_SQUARE'); break;
				case ']': addToken('CLOSE_SQUARE'); break;
				case '{': addToken('OPEN_CURLY'); break;
				case '}': addToken('CLOSE_CURLY'); break;
				default: error(line, 'Unexpected character ' + code[index]);
			}
			++index;
		}
	}
	addToken('EOF');
	return tokens;
};