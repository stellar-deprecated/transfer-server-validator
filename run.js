const { spawn } = require("child_process");
const jest = spawn("node_modules/.bin/jest", ["--json"]);
let jsonStr = "";
jest.stdout.on("data", data => {
  jsonStr += data.toString();
});

jest.stderr.on("data", data => {
  console.error(data);
});

jest.on("close", code => {
  const results = JSON.parse(jsonStr);
  results.testResults.forEach(resultSet => {
    resultSet.assertionResults.forEach(assertionResult => {
      const icon = assertionResult.status === "passed" ? "✅" : "❌";
      console.log(
        icon +
          ": " +
          assertionResult.ancestorTitles.join(" > ") +
          " > " +
          assertionResult.fullName
      );
      if (assertionResult.status !== "passed") {
        console.log("  > " + assertionResult.failureMessages[0]);
      }
    });
  });
  debugger;
  console.log(`child process exited with code ${code}`);
});
