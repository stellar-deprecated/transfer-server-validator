const runTest = require("./jest-controller/run-test");
module.exports = async (req, res) => {
  // Set up server-sent events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // It's important to write something to the stream immediately
  // otherwise heroku will timeout with an H15 Idle Connection error
  res.write("message: Starting Tests\n\n");

  const results = await runTest(req.query.domain, req.query.test);
  res.write(`data: ${JSON.stringify({ results })}\n\n`);
};
