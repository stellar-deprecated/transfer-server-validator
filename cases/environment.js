const JSDOMEnvironment = require("jest-environment-jsdom");
const webdriver = require("selenium-webdriver");
const proxy = require("selenium-webdriver/proxy");
const chrome = require("selenium-webdriver/chrome");

class WebdriverEnvironment extends JSDOMEnvironment {
  constructor(config) {
    super(config);
    this.configuration = Object.assign(
      {
        capabilities: {
          browserName: "chrome"
        }
      },
      config.testEnvironmentOptions
    );
    this.global.webdriver = webdriver;
    this.global.By = webdriver.By;
    this.global.until = webdriver.until;
    this.global.configuration = this.configuration;
    this.global.cleanup = async () => {
      await this.global.driver.quit();
      this.global.driver = await buildDriver(this.configuration);
    };
  }

  async setup() {
    await super.setup();
    this.global.driver = await buildDriver(this.configuration);
  }

  async teardown() {
    if (this.global.driver) {
      await this.global.driver.quit();
    }
    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }
}

async function buildDriver(configuration) {
  var options = new chrome.Options();
  options.addArguments("headless");
  options.addArguments("disable-dev-shm-usage");
  options.addArguments("no-sandbox");
  const driver = new webdriver.Builder()
    .forBrowser("chrome")
    .setChromeOptions(options);

  if (configuration.server) driver.usingServer(configuration.server);
  if (configuration.proxyType) {
    let prxy;
    if (configuration.proxyType === "socks") {
      prxy = proxy.socks(
        configuration.proxyOptions.socksProxy,
        configuration.proxyOptions.socksVersion
      );
    } else {
      prxy = proxy[configuration.proxyType](configuration.proxyOptions);
    }
    driver.setProxy(prxy);
  }

  return driver.build();
}

module.exports = WebdriverEnvironment;
