const { spawn } = require("child_process");

module.exports = async (req, res) => {
  // Set up server-sent events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  let i = 0;
  const sendLoadingMessage = _ => {
    const message = ["Running Tests", "Still running tests", "Still going"][
      i++ % 3
    ];
    res.write(`data: ${JSON.stringify({ loadingMessage: message })}\n\n`);
  };
  sendLoadingMessage();
  const timer = setInterval(sendLoadingMessage, 5000);
  const domain = req.query.domain;
  const env = { ...process.env };
  env.DOMAIN = domain;
  const jest = spawn("node_modules/.bin/jest", ["--json", "--noStackTrace"], {
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
    clearInterval(timer);
    res.write(`data: ${JSON.stringify({ results })}\n\n`);
    console.log(`child process exited with code ${code}`);
  });
};
