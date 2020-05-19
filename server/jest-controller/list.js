const { spawn } = require("child_process");
const path = require("path");

module.exports = async () => {
  return new Promise((resolve, reject) => {
    let testProject = process.env.PROJECT ? process.env.PROJECT : "SEP24";
    const jest = spawn("node_modules/.bin/jest", [
      "--list-tests",
      `--roots=cases-${testProject}`,
    ]);
    let output = "";
    jest.stdout.on("data", (data) => {
      output += data.toString();
    });

    jest.stderr.on("data", (data) => {});

    jest.on("close", (code) => {
      const orderedTests = {
        SEP24: [
          "toml",
          "info",
          "sep10",
          "deposit",
          "withdraw",
          "transaction",
          "transactions",
          "fee.optional",
          "interactive-flows.optional",
        ],
        SEP31: ["toml", "info"],
        SEP6: [
          "toml",
          "info",
          "sep10",
          "deposit",
          "withdraw",
          "transaction",
          "transactions",
          "fee.optional",
        ],
      };

      let testProject = process.env.PROJECT ? process.env.PROJECT : "SEP24";

      const unorderedTests = output
        .trim()
        .split("\n")
        .map((line) => {
          const testName = path.basename(line).split(".test.js")[0];
          if (orderedTests[testProject].includes(testName)) {
            return null;
          }
          return testName;
        })
        .filter((name) => name !== null);

      const fullList = [...orderedTests[testProject], ...unorderedTests];
      resolve(fullList);
    });
  });
};
