import { fetch } from "./fetchShim";
import { waitForLoad, openObservableWindow } from "./browser-util";
import { getTransactionSchema } from "./schema";
import FormData from "form-data";

export async function createTransaction({
  currency,
  account,
  toml,
  jwt,
  isDeposit,
}) {
  const params = new FormData();
  if (currency) params.append("asset_code", currency);
  if (account) params.append("account", account);

  const headers = Object.assign(
    { Authorization: `Bearer ${jwt}` },
    params.getHeaders(),
  );

  const transactionsUrl =
    toml.TRANSFER_SERVER +
    `/transactions/${isDeposit ? "deposit" : "withdraw"}/interactive`;
  const response = await fetch(transactionsUrl, {
    headers,
    method: "POST",
    body: params,
  });

  const status = response.status;
  const json = await response.json();

  return {
    status,
    json,
  };
}

export const doInteractiveFlow = async ({
  currency,
  account,
  jwt,
  toml,
  isDeposit,
}) => {
  const { status, json } = await createTransaction({
    currency: currency,
    account: account,
    jwt: jwt,
    toml: toml,
    isDeposit: isDeposit,
  });
  const builder = new URL(json.url);
  builder.searchParams.set("callback", "postMessage");
  const window = await openObservableWindow(builder.toString());
  // Lets wait until the whole flow finishes by observering for
  // a postMessage awaiting user transfer start
  let complete = false;
  window.observePostMessage(async (message) => {
    expect(message).toMatchSchema(getTransactionSchema(true));
    if (message.transaction.status == "pending_user_transfer_start") {
      await window.close();
      complete = true;
    }
  });
  const completePage = async () => {
    try {
      const elements = await driver.findElements(By.css("[test-value]"));
      elements.forEach((el) => {
        const val = el.getAttribute("test-value");
        el.sendKeys(val);
      });
      const submitButton = await driver.findElement(
        By.css("[test-action='submit']"),
      );
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      await submitButton.click();
    } catch (e) {
      // Not an automatable page, could be the receipt page postMessaging
    }
  };
  return new Promise(async (resolve, reject) => {
    while (!complete) {
      await waitForLoad();
      await completePage();
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }
    resolve(json.id);
  });
};
