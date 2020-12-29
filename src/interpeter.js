const error = require('./error');
const Scope = require('./scope');
const { Return, LuaFunction } = require('./classes');

function interpreter(trees, scope) {
	if (!scope) {
		scope = new Scope();
		scope.defineFunction('print', new LuaFunction((...objs) => {
			console.log(objs.map(obj => stringify(obj)).join(' '))
		}, '<Native Function print>'));
		scope.defineFunction('tostring', new LuaFunction(obj => {
			return stringify(obj);
		}), '<Native Function tostring>');
	}
	function stringify(object) {
		if (object === null) return 'nil';
		return object.toString();
	}
	function checkType(obj, line, errMsg, ...types) {
		if (!types.includes(typeof obj)) error(line, errMsg);
	}
	function interpretBlock(block, vars = {}) {
		const localScope = scope.createLocalScope();
		for (const [variable, value] of Object.entries(vars)) {
			localScope.localVariables[variable] = value;
		}
		interpreter(block, localScope);
	}
	function truthy(obj) {
		return !(obj === false || obj === null);
	}
	function nullc(obj, to) {
		return obj === undefined || obj === null ? to : obj;
	}
	function makeLuaFunction(name, funcargs, body) {
		const res = new LuaFunction((...args) => {
			const argMap = {[name]: res};
			for (const [index, arg] of funcargs.entries()) {
				argMap[arg] = args[index];
			}
			try {
				interpretBlock(body, argMap);
			} catch (err) {
				if (err instanceof Return) {
					return err.value;
				} else {
					throw err;
				}
			}
			return null;
		}, `<Function ${name}>`);
		return res;
	}
	function scopeGet(name) {
		return nullc(scope.localVariables[name], nullc(scope.globalVariables[name], nullc(scope.functions[name], null)));
	}
	function scopeSet(name, value) {
		if (scope.localVariables.hasOwnProperty(name)) return scope.localVariables[name] = value;
		if (scope.globalVariables.hasOwnProperty(name)) return scope.globalVariables[name] = value;
	}
	function type(obj) {
		if (obj === null || obj === undefined) return 'nil'; else return typeof obj;
	}
	function interpret(expr) {
		if (expr === undefined) return null;
		switch (expr.type) {
			case 'literal': return expr.value; break;
			case 'binary':
				const left = interpret(expr.left);
				const right = interpret(expr.right);
				switch (expr.operator) {
					case 'PLUS':
						checkType(left, expr.left.line, 'Cannot perform arithmetic on ' + type(left), 'number');
						checkType(right, expr.right.line, 'Cannot perform arithmetic on ' + type(right), 'number');
						return left + right;
					case 'MINUS':
						if (!left) {
							checkType(right, expr.right.line, 'Cannot perform arithmetic on ' + type(right), 'number');
							return -right;
						}
						checkType(left, expr.left.line, 'Cannot perform arithmetic on ' + type(left), 'number');
						checkType(right, expr.right.line, 'Cannot perform arithmetic on ' + type(right), 'number');
						return left - right;
					case 'TIMES':
						checkType(left, expr.left.line, 'Cannot perform arithmetic on ' + type(left), 'number');
						checkType(right, expr.right.line, 'Cannot perform arithmetic on ' + type(right), 'number');
						return left * right;
					case 'DIVIDE':
						checkType(left, expr.left.line, 'Cannot perform arithmetic on ' + type(left), 'number');
						checkType(right, expr.right.line, 'Cannot perform arithmetic on ' + type(right), 'number');
						return left + right;
					case 'AND':
						return truthy(left) && truthy(right);
					case 'OR':
						return truthy(left) || truthy(right);
					case 'NOT':
						return !truthy(right);
					case 'DOT_DOT':
						checkType(left, expr.left.line, 'Can only concat strings', 'string');
						checkType(right, expr.right.type, 'Can only concat strings', 'string');
						return left + right;
					case 'GREATER':
						checkType(left, expr.left.line, 'Can only compare numbers or strings', 'number', 'string');
						checkType(right, expr.right.line, 'Can only compare numbers or strings', 'number', 'string');
						if (typeof left !== typeof right) error(expr.line, 'Cannot compare ' + type(left) + ' with ' + type(right));
						return left > right;
					case 'GREATER_EQUALS':
						checkType(left, expr.left.line, 'Can only compare numbers or strings', 'number', 'string');
						checkType(right, expr.right.line, 'Can only compare numbers or strings', 'number', 'string');
						if (typeof left !== typeof right) error(expr.line, 'Cannot compare ' + type(left) + ' with ' + type(right));
						return left >= right;
					case 'LESS':
						checkType(left, expr.left.line, 'Can only compare numbers or strings', 'number', 'string');
						checkType(right, expr.right.line, 'Can only compare numbers or strings', 'number', 'string');
						if (typeof left !== typeof right) error(expr.line, 'Cannot compare ' + type(left) + ' with ' + type(right));
						return left < right;
					case 'LESS_EQUALS':
						checkType(left, expr.left.line, 'Can only compare numbers or strings', 'number', 'string');
						checkType(right, expr.right.line, 'Can only compare numbers or strings', 'number', 'string');
						if (typeof left !== typeof right) error(expr.line, 'Cannot compare ' + type(left) + ' with ' + type(right));
						return left <= right;
					case 'EQUALS_EQUALS':
						return left === right;
					case 'NOT_EQUALS':
						return left !== right;
				}
			case 'variable':
				return scopeGet(expr.name);
			case 'assignment':
				const name = expr.name.name || expr.name.value;
				if (scope.localVariables.hasOwnProperty(name) ||
				scope.globalVariables.hasOwnProperty(name)) return scopeSet(name, interpret(expr.value));
				else {
					if (expr.local) return scope.localVariables[name] = interpret(expr.value);
					else return scope.globalVariables[name] = interpret(expr.value);
				}
			case 'return':
				throw new Return(interpret(expr.value));
			case 'funcdef':
				scope.defineFunction(expr.name.value, makeLuaFunction(expr.name.value, expr.args.map(arg => arg.value), expr.body));
				return null;
			case 'funcexpr':
				return makeLuaFunction(expr.name.value, expr.args.map(arg => arg.value), expr.body);
			case 'funccall': 
				const callee = interpret(expr.callee);
				if (!(callee instanceof LuaFunction)) {
					error(expr.line, 'Cannot call ' + type(callee));
				}
				return callee.call.apply(callee, expr.args.map(arg => interpret(arg)));
			case 'block':
				interpretBlock(expr.body);
				return null;
			case 'if':
				if (truthy(interpret(expr.condition))) interpretBlock(expr.body)
				else {
					const doElse = true;
					for (const [condition, block] of expr.elseIfs) {
						doBlock = truthy(interpret(condition));
						doElse = doElse && !doBlock;
						if (doBlock) {
							interpretBlock(block)
							break;
						}
					}
					if (doElse) interpretBlock(expr.elseBlock);
				}
				return null;
			case 'for':
				for (interpret(expr.start); scopeGet(expr.start.name.value) < interpret(expr.end); scopeSet(expr.start.name.value, scopeGet(expr.start.name.value) + 1)) {
					interpretBlock(expr.body, {[expr.start.name.value]: scopeGet(expr.start.name.value)});
				}
				return null;
			case 'while':
				while(truthy(interpret(expr.condition))) interpretBlock(expr.body);
				return null;
			case 'repeat':
				do {
					interpretBlock(expr.body);
				} while(truthy(interpret(expr.condition)));
				return null;			
		}
	}
	let output = null;
	for (const tree of trees) {
		output = nullc(interpret(tree), null);
	}
	return stringify(output);
}
module.exports = interpreter;
