if (process.env.DOMAIN) {
  const { spawn } = require("child_process");
  run_op_tests = Boolean(parseInt(process.env.RUN_OPTIONAL_TESTS));
  let regex = '\\b(\\w*optional\\w*)\\b';
  args = run_op_tests ? [] : [`--testPathIgnorePatterns=${regex}`];
  spawn("node_modules/.bin/jest", args, {
    stdio: [process.stdin, process.stdout, process.stderr],
  });
} else {
  require("./server/api");
}
