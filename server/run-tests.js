const { spawn } = require("child_process");
module.exports = (req, res) => {
  const domain = req.query.domain;
  const env = { ...process.env };
  env.DOMAIN = domain;
  const jest = spawn("node_modules/.bin/jest", ["--json"], {
    env
  });
  let jsonStr = "";
  jest.stdout.on("data", data => {
    jsonStr += data.toString();
  });

  jest.stderr.on("data", data => {
    console.log(data.toString());
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
      });
    });
    res.send(results);
    debugger;
    console.log(`child process exited with code ${code}`);
  });
};
