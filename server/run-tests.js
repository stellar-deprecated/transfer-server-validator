const runTest = require("./jest-controller/run-test");
module.exports = async (req, res) => {
  // Set up server-sent events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  let i = 0;
  const sendLoadingMessage = (_) => {
    const message = ["Running Tests", "Still running tests", "Still going"][
      i++ % 3
    ];
    res.write(`data: ${JSON.stringify({ loadingMessage: message })}\n\n`);
  };
  sendLoadingMessage();

  const timer = setInterval(sendLoadingMessage, 5000);
  const results = await runTest(req.query.domain, req.query.test);
  clearInterval(timer);
  res.write(`data: ${JSON.stringify({ results })}\n\n`);
};
