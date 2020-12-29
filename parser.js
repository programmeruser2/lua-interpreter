const error = require('./error');
module.exports = function(tokens) {
	let index = 0;
	const peek = () => tokens[index];
	const advance = () => tokens[++index];
	const previous = () => tokens[index - 1];
	const isAtEnd = () => peek().type === 'EOF';
	const check = type => !isAtEnd() && peek().type === type;
	function match(...types) {
		for (const type of types) {
			if (check(type)) {
				advance();
				return true;
			}
		}
		return false;
	}
	function consume(type, expect) {
		if (peek().type != type) error(expect);
		return advance();
	}
	
	function declaration() {
		if (check('FUNCTION') && tokens[index + 1].type === 'IDENTIFIER') {
			advance();
			return funcDeclaration();
		}
		return statement();
	}

	function block(endToken = 'END', endTokenStr = endToken.toLowerCase()) {
		const statements = [];
		while (!check(endToken) && !isAtEnd()) {
			statements.push(declaration());
		}
		consume(endToken, `Expect "${endTokenStr}" after block`);
		return statements;
	}

	function funcDeclaration() {
		const line = previous().line;
		consume('IDENTIFIER', "Expect function name");
		const name = previous();
		consume('OPEN_PAREN', "Expect opening parenthesis");
		const args = [];
		do {
			if (check('CLOSE_PAREN')) break;
			consume('IDENTIFIER', "Expect function argument name");
			args.push(previous());
		} while (match('COMMA'));
		consume('CLOSE_PAREN', 'Expect closing parenthesis');
		const body = block();
		return {type: 'funcdef', name, line, args, body};
	}

	function statement() {
		if (match('IF')) return ifStatement();
		if (match('FOR')) return forStatement();
		if (match('WHILE')) return whileStatement();
		if (match('REPEAT')) return repeatStatement();
		if (match('DO')) return {type: 'block', line: previous().line, body: block()};
		if (match('RETURN')) return {type: 'return', line: previous().line, value: expression()};
		return expression();
	}
	function ifStatement() {
		const line = previous().line;
		const condition = expression();
		consume('THEN', 'Expect keyword "then"');
		const body = [];
		while (!check('END') && !check('ELSE') && !check('ELSEIF') && !isAtEnd()) {
			body.push(declaration());
		}
		if (!(check('END') || check('ELSE') || check('ELSEIF'))) {
			error(peek().line, 'Unterminated block');
		}
		if (check('END')) advance();
		const elseIfs = new Map();
		while(match('ELSEIF')) {
			const elseIfCond = expression();
			const elseIfBody = [];
			while (!check('END') && !check('ELSE') && !check('ELSEIF') && !isAtEnd()) {
				body.push(declaration());
			}
			if (!(check('END') || check('ELSE') || check('ELSEIF'))) {
				error(peek().line, 'Unterminated block');
			}
			elifs.set(elseIfCond, elseIfBody);
		}
		const elseBlock = [];
		if (match('ELSE')) {
			while (!check('END') && !isAtEnd()) {
				body.push(declaration());
			}
			if (!check('END')) {
				error(peek().line, 'Unterminated block');
			}
			advance();
		}
		return {type: 'if', body, condition, elseIfs, elseBlock, line};
	}
	function forStatement() {
		const line = previous().line;
		const start = assignment(false);
		consume('COMMA', 'Expect comma')
		const end = expression();
		let step = {type: 'literal', value: 1, line: null};
		let body = [];
		if (match('DO')) {
			body = block();
		} else {
			step = expression();
			consume('DO', 'Expect keyword "do"');
			body = block();
		}
		return {type: 'for', start, end, step, body, line};
	}
	function whileStatement() {
		const line = previous().line;
		const condition = expression();
		consume('DO', 'Expect keyword "do"');
		const body = block();
		return {type: 'while', condition, body, line};
	}
	function repeatStatement() {
		const line = previous().line;
		const body = block('UNTIL');
		const condition = expression();
		return {type: 'repeat', body, condition, line};
	}

	function expression() {
		if (match('FUNCTION')) return funcExpression();
		return assignment();
	}
	function funcExpression() {
		const line = previous().line;
		consume('OPEN_PAREN', 'Expect opening parenthesis');
		const args = [];
		do {
			if (check('CLOSE_PAREN')) break;
			consume('IDENTIFIER', 'Expect argument name');
			args.push(previous());
		} while(match('COMMA'));
		consume('CLOSE_PAREN', 'Expect closing parenthesis');
		const body = block();
		return {type: 'funcexpr', args, body, line};
	}
	function assignment(doLowerPrecedence = true) {
		let expr;
		if (doLowerPrecedence) expr = or();
		else {
			let local = false;
			if (match('LOCAL')) local = true;
			consume('IDENTIFIER', 'Expect variable name');
			const name = previous();
			const line = previous().line;
			consume('EQUALS', 'Expect =');
			const value = expression();
			return {type: 'assignment', name, value, line, local}
		}
		if (match('EQUALS')) {
			if (expr.type !== 'variable') error(expr.line, 'Expected variable name but got ' + expr.type);
			const value = expression();
			expr = {type: 'assignment', local: false, name: expr, value, line: expr.line};
		} else if (expr.type === 'local') {
			consume('IDENTIFIER', 'Expect variable name');
			const name = previous();
			consume('EQUALS', 'Expect "="');
			const value = expression();
			expr = {type: 'assignment', local: true, name, value, line: expr.line};
		}
		return expr;
	}
	function or() {
		let expr = and();
		while (match('OR')) {
			const operator = previous().value;
			const right = and();
			expr = {type: 'binary', left: expr, right, operator, line: expr.line};
		}
		return expr;
	}
	function and() {
		let expr = equality();
		while (match('AND')) {
			const operator = previous().value;
			const right = equality();
			expr = {type: 'binary', left: expr, right, operator, line: expr.line};
		}
		return expr;
		return expr;
	}
	function equality() {
		let expr = comparison();
		while (match('EQUALS_EQUALS', 'NOT_EQUALS')) {
			const operator = previous().value;
			const right = comparison();
			expr = {type: 'binary', left: expr, right, operator, line: expr.line};
		}
		return expr;
	}
	function comparison() {
		let expr = addition();
		while (match('GREATER', 'GREATER_EQUALS', 'LESS', 'LESS_EQUALS')) {
			const operator = previous().value;
			const right = addition();
			expr = {type: 'binary', left: expr, right, operator, line: expr.line};
		}
		return expr;
	}
	function addition() {
		let expr = multiplication();
		while (match('PLUS', 'MINUS', 'DOT_DOT')) {
			const operator = previous().value;
			const right = multiplication();
			expr = {type: 'binary', left: expr, right, operator, line: expr.line};
		}
		return expr;
	}
	function multiplication() {
		let expr = unary();
		while (match('TIMES', 'DIVIDE')) {
			const operator = previous().value;
			const right = unary();
			expr = {type: 'binary', left: expr, right, operator, line: expr.line};
		}
		return expr;
	}
	function unary() {
		if (match('NOT', 'MINUS')) {
			return {type: 'unary', operator: previous().value, right: unary(), line: previous().line};
		}
		return call();
	}
	function call() {
		let expr = primary();
		if (match('OPEN_PAREN')) {
			const args = [];
			do {
				if (check('CLOSE_PAREN')) break;
				args.push(expression());
			} while (match('COMMA'));
			consume('CLOSE_PAREN', 'Expect closing parenthesis after function arguments');
			expr = {type: 'funccall', callee: expr, args, line: expr.line};
		} else if (check('STRING')) {
			const args = [expression()];
			expr = {type: 'funccall', callee: expr, args, line: expr.line}
		}
		return expr;
	}
	function primary() {
		if (match('TRUE')) return {type: 'literal', value: true, line: previous().line};
		if (match('FALSE')) return {type: 'literal', value: false, line: previous().line};
		if (match('NUMBER', 'STRING')) return {type: 'literal', value: previous().value, line: previous().line};
		if (match('NIL')) return {type: 'literal', value: null, line: previous().line};
		if (match('OPEN_PAREN')) {
			const expr = expression();
			consume('CLOSE_PAREN', 'Expect closing parenthesis after expression');
			return expr;
		}
		if (match('IDENTIFIER')) return {type: 'variable', name: previous().value, line: previous().line};
		if (match('LOCAL')) return {type: 'local', line: previous().line};
		error(peek().line, 'Unexpected token ' + peek().value);
	}
	const statements = [];
	while (!isAtEnd()) {
		statements.push(declaration());
  }
	return statements;
};