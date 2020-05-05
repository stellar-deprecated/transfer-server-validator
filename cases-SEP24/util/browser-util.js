export const waitForLoad = async () => {
  return driver.wait(function() {
    return driver
      .executeScript("return document.readyState")
      .then(function(readyState) {
        return readyState === "complete";
      });
  });
};

/**
 * Opens a window with a postMessage handler attached and checks
 * for new posted messages once a second.
 * @param {string} url
 */
export const openObservableWindow = async (url) => {
  await driver.get(`data:text/html,<script>window.open("${url}")</script>`);
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles[0]);
  await driver.executeScript(() => {
    window.addEventListener("message", (e) => {
      window.__LAST_POST_MESSAGE__ = e.data;
    });
  });
  await driver.switchTo().window(handles[1]);
  let observers = [];
  let passPostMessage = setInterval(async () => {
    await driver.switchTo().window(handles[0]);
    const lastMessage = await driver.executeScript((_) => {
      const lastMessage = window.__LAST_POST_MESSAGE__;
      delete window.__LAST_POST_MESSAGE__;
      return lastMessage;
    });
    await driver.switchTo().window(handles[1]);
    if (lastMessage) {
      observers.forEach((o) => o(lastMessage));
    }
  }, 1000);

  return {
    observePostMessage: (cb) => {
      observers.push(cb);
    },
    close: async () => {
      clearInterval(passPostMessage);
      await driver.switchTo().window(handles[1]);
      driver.close();
      await driver.switchTo().window(handles[0]);
    },
  };
};
