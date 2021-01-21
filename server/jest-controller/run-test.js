const fs = require("fs");
const { spawn } = require("child_process");

module.exports = async (domain, currency, mainnet, test, project) => {
  let PROJECT = project || process.env.PROJECT || "SEP24";
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    env.DOMAIN = domain;
    env.CURRENCY = currency;
    env.PROJECT = project;
    env.MAINNET = mainnet;
    const jest = spawn(
      "node_modules/.bin/jest",
      ["--json", "--noStackTrace", `cases-${PROJECT}/${test}.test.js`],
      {
        env,
      },
    );
    let jsonStr = "";
    jest.stdout.on("data", (data) => {
      jsonStr += data.toString().replace(/\\u001b\[[0-9]{1,2}m/g, "");
    });

    jest.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    jest.on("close", (code) => {
      const firstLineRegex = /\(([\/\w-\.]+):([0-9]+)/;
      const results = JSON.parse(jsonStr);
      results.testResults.forEach((testResult) => {
        const name = testResult.name.split("/").reduce((prev, cur) => cur);
        testResult.assertionResults.forEach((assertionResult) => {
          assertionResult.failureMessages.forEach((failureMessage) => {
            const [_, file, lineStr] = firstLineRegex.exec(failureMessage);
            const errorLine = parseInt(lineStr);
            try {
              const fileContents = fs.readFileSync(file).toString();
              const fileLines = fileContents.split("\n");
              const start = Math.max(0, errorLine - 4);
              const end = Math.min(fileLines.length - 1, errorLine + 3);
              const selectedLines = fileLines
                .slice(start, end)
                .map((line, i) => {
                  const lineNumber = i + start + 1;
                  return {
                    content: line,
                    lineNumber: lineNumber,
                    isErrorLine: lineNumber === errorLine,
                    directLink: `https://github.com/stellar/transfer-server-validator/blob/master/cases/${name}#L${lineNumber}`,
                  };
                });
              assertionResult.releventSource = selectedLines;
            } catch (e) {
              console.log("Couldn't read the file to create selected lines", e);
            }
          });
        });
      });
      resolve(results);
    });
  });
};
