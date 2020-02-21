if (process.env.DOMAIN) {
  const { spawn } = require("child_process");
  const runOpTests = Boolean(parseInt(process.env.RUN_OPTIONAL_TESTS));
  const regex = '\\b(\\w*optional\\w*)\\b';
  const args = runOpTests ? [] : [`--testPathIgnorePatterns=${regex}`];
  spawn("node_modules/.bin/jest", args, {
    stdio: [process.stdin, process.stdout, process.stderr],
  });
} else {
  require("./server/api");
}
