export const waitForReady = async () => {
  return driver.wait(function() {
    return driver
      .executeScript("return document.readyState")
      .then(function(readyState) {
        return readyState === "complete";
      });
  });
};
