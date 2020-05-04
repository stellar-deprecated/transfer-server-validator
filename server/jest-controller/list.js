const { spawn } = require("child_process");
const path = require("path");

module.exports = async () => {
  return new Promise((resolve, reject) => {
    const jest = spawn("node_modules/.bin/jest", ["--list-tests"]);
    let output = "";
    jest.stdout.on("data", (data) => {
      output += data.toString();
    });

    jest.stderr.on("data", (data) => {});

    jest.on("close", (code) => {
      const SEP24orderedTests = [
        "toml",
        "info",
        "sep10",
        "deposit",
        "withdraw",
        "transaction",
        "transactions",
        "fee.optional",
        "interactive-flows.optional",
      ];

      const directPaymentOrderedTests = [
        "dummy",
      ];

      let testProject = process.env.PROJECT ? process.env.PROJECT : "SEP24";

      if (testProject == "DIRECT-PAYMENT") {
        orderedTests = directPaymentOrderedTests

      } else if(testProject == "SEP24") {
        orderedTests = SEP24orderedTests;
      }

      const unorderedTests = output
        .trim()
        .split("\n")
        .map((line) => {
          if (path.dirname(line) == `cases-${testProject}`) {
            const testName = path.basename(line).split(".test.js")[0];
            if (orderedTests.includes(testName)) {
              return null;
            }
            return testName;
          
          } else {
            return null;
          }
        })
        .filter((name) => name !== null);

      const fullList = [...orderedTests, ...unorderedTests];
      resolve(fullList);
    });
  });
};
