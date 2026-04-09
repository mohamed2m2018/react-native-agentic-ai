const fs = require('fs');
const code = fs.readFileSync('src/core/FiberTreeWalker.ts', 'utf8');
const modified = code.replace(
  "return elementOutput;",
  "console.log('TREE_NODE_DUMP: ' + elementOutput); return elementOutput;"
);
fs.writeFileSync('src/core/FiberTreeWalker.ts', modified);
