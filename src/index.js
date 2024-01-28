const lex = require('./lexer');
const parse = require('./parser');
const interpret = require('./interpeter');

const fs = require('fs');
const readline = require('readline');
const rl = readine.createInterface({
  output: process.stdout,
  input: process.stdin
});

function run(code) {
  const tokens = lex(code);
  const trees = parse(tokens);
  const output = interpret(trees);
  console.log('\x1b[32m=> ' + output + '\x1b[0m');
}

function repl() {
  rl.question('> ', code => {
    try {
      run(code);
    } catch(err) {
      console.error(err);
    }
    repl();
  });
}

let args;
if (process.argv[0].indexOf('node') !== -1) {
  args = process.argv.slice(2)
} else {
  args = process.argv.slice(1);
}
if (args.length <= 0) {
  console.log('Lua Interpreter REPL');
  repl();
} else {
  const file = args[0];
  const code = fs.readFileSync(file).toString();
  run(code);
}



