const express = require("express");
const cors = require("cors");
const path = require("path");
const listTests = require("./list-tests");
const runTests = require("./run-tests");

const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.options("*", cors());

app.get("/list", listTests);
app.get("/run", runTests);

app.use(express.static(path.join(__dirname, "/../client/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/../client/build/index.html"));
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
