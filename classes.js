class Return extends Error {
	constructor(value = null) {
		super('Illegal return statement'); //if user tries to return outside function
		this.name = 'LuaError';
		this.value = value;
	}
}
class LuaFunction {
	constructor(call, toString = '<Function>') {
		this.call = call;
		this.toString = toString;
	}
}
module.exports = { Return, LuaFunction };