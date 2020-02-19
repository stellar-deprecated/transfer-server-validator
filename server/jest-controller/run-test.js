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
      jsonStr += data.toString();
    });

    jest.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    jest.on("close", (code) => {
      const results = JSON.parse(jsonStr);
      resolve(results);
    });
  });
};
