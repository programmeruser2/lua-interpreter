const lex = require('./lexer');
const parse = require('./parser');
const interpret = require('./interpeter');

const fs = require('fs');
const file = 'source.lua';
const code = fs.readFileSync(file).toString();

const tokens = lex(code);
const trees = parse(tokens);
const output = interpret(trees);
console.log('\x1b[32m=> ' + output + '\x1b[0m');
