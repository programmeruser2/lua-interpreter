const { LuaFunction } = require('./classes');
function clone(obj) {
	if (typeof obj === 'function') return () => obj();
	if (typeof obj !== 'object' || obj === null) return obj;
	const res = {};
	for (property in obj) {
		if (obj.hasOwnProperty(property)) {
			if (typeof property === 'object' || typeof property === 'function') res[property] = clone(obj[property]);
			else res[property] = obj[property];
		}
	}
	if (obj instanceof LuaFunction) return new LuaFunction(res.call, res.toString);
	else return res;
}
function link(from, to) {
	for (const [property, value] of Object.entries(from)) {
		let storeOrig = value;
		let storeNew = clone(value);
		Object.defineProperty(from, property, {
			configurable: true,
			enumerable: true,
			get: () => storeOrig,
			set: function(val) {
				storeOrig = val, storeNew = val;
			}
		});
		Object.defineProperty(to, property, {
			configurable: true,
			enumerable: true,
			get: () => storeNew,
			set: function(val) {
				storeOrig = val, storeNew = val;
			}
		});
	}
}
class Scope {
	globalVariables = {};
	localVariables = {};
	functions = {};
	defineFunction(name, value) {
		if (this.globalVariables[name]) this.globalVariables[name] = null;
		if (this.localVariables[name]) this.localVariables[name] = null;
		this.functions[name] = value;
	}
	createLocalScope() {
		const scope = new Scope();
		link(this.globalVariables, scope.globalVariables);
		link(this.localVariables, scope.globalVariables);
		link(this.functions, scope.functions);
		return scope;
	}
}
module.exports = Scope;