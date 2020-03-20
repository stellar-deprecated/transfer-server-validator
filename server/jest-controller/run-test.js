const fs = require("fs");
const { spawn } = require("child_process");

module.exports = async (domain, test) => {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    env.DOMAIN = domain;
    const jest = spawn(
      "node_modules/.bin/jest",
      ["--json", "--noStackTrace", `${test}.test.js`],
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
            const fileContents = fs.readFileSync(file).toString();
            const fileLines = fileContents.split("\n");
            const start = Math.max(0, errorLine - 4);
            const end = Math.min(fileLines.length - 1, errorLine + 3);
            const selectedLines = fileLines.slice(start, end).map((line, i) => {
              const lineNumber = i + start + 1;
              return {
                content: line,
                lineNumber: lineNumber,
                isErrorLine: lineNumber === errorLine,
                directLink: `https://github.com/stellar/transfer-server-validator/blob/master/cases/${name}#L${lineNumber}`,
              };
            });
            assertionResult.releventSource = selectedLines;
          });
        });
      });
      resolve(results);
    });
  });
};
