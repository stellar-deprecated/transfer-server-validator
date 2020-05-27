const list = require("./jest-controller/list");
module.exports = async (req, res) => {
  const tests = await list(req.query.project);
  res.send(tests);
};
