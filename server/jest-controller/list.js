const { spawn } = require("child_process");
const path = require("path");

module.exports = async () => {
  return new Promise((resolve, reject) => {
    const jest = spawn("node_modules/.bin/jest", ["--list-tests"]);
    let output = "";
    jest.stdout.on("data", data => {
      output += data.toString();
    });

    jest.stderr.on("data", data => {});

    jest.on("close", code => {
      console.log(output);
      const lines = output
        .trim()
        .split("\n")
        .map(line => path.basename(line).split(".test.js")[0]);
      resolve(lines);
    });
  });
};
