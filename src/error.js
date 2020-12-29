module.exports = function(line, msg) {
	const err =  new Error(`[line ${line}] ${msg}`);
	err.name = 'LuaError';
	throw err;
}
