if (process.env.DOMAIN) {
  const { spawn } = require("child_process");
  spawn("node_modules/.bin/jest", [], {
    stdio: [process.stdin, process.stdout, process.stderr],
  });
} else {
  require("./server/api");
}
