const e = require("express");
const runTest = require("./jest-controller/run-test");

/**
 * @param {e.Request} req
 * @param {e.Response} res
 */
module.exports = async (req, res) => {
  // Set up server-sent events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // It's important to write something to the stream immediately
  // and intermittently otherwise heroku will timeout with
  // an H15 Idle Connection error
  const sendPing = () => {
    res.write("message: Running Tests\n\n");
  };
  sendPing();
  const timer = setInterval(sendPing, 15000);

  const results = await runTest(
    req.query.domain,
    req.query.currency,
    req.query.test,
    req.query.project,
  );
  clearTimeout(timer);
  res.write(`data: ${JSON.stringify({ results })}\n\n`);
  res.end();
};
