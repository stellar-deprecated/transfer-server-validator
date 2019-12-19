const express = require("express");
var cors = require("cors");
const port = process.env.PORT || 3000;
const listTests = require("./list-tests");
const runTests = require("./run-tests");

const app = express();
app.use(cors());
app.options("*", cors());
app.get("/", (req, res) => res.send("Hello World!"));

app.get("/list", listTests);
app.get("/run", runTests);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
