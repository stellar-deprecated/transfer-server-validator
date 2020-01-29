/**
 * @jest-environment ./cases/environment.js
 */
import { fetch } from "./util/fetchShim";
import getSep10Token from "./util/sep10";
import TOML from "toml";
import StellarSDK from "stellar-sdk";
import FormData from "form-data";
import { waitForLoad, openObservableWindow } from "./util/browser-util";
import { transactionSchema } from "./util/schema";
const url = process.env.DOMAIN;
const keyPair = StellarSDK.Keypair.random();

jest.setTimeout(200000); // 20 sec timeout since we're actually stepping through web forms

describe("Deposit", () => {
  let TRANSFER_SERVER;
  let infoJSON;
  let enabledCurrency;
  let jwt;

  const doPost = async (asset_code, account, authenticate) => {
    const params = new FormData();
    if (asset_code) params.append("asset_code", asset_code);
    if (account) params.append("account", account);
    const authenticatedHeaders = Object.assign(
      {
        Authorization: `Bearer ${jwt}`
      },
      params.getHeaders()
    );
    const response = await fetch(
      TRANSFER_SERVER + "transactions/deposit/interactive",
      {
        headers: authenticate ? authenticatedHeaders : params.getHeaders(),
        method: "POST",
        body: params
      }
    );
    const status = response.status;
    const json = await response.json();
    return {
      status,
      json
    };
  };
  beforeAll(async () => {
    await fetch(`https://friendbot.stellar.org?addr=${keyPair.publicKey()}`);
    const response = await fetch(url + "/.well-known/stellar.toml");
    const text = await response.text();
    const toml = TOML.parse(text);
    TRANSFER_SERVER = toml.TRANSFER_SERVER;
    if (TRANSFER_SERVER[TRANSFER_SERVER.length - 1] !== "/") {
      TRANSFER_SERVER += "/";
    }

    const infoResponse = await fetch(TRANSFER_SERVER + "info", {
      headers: {
        Origin: "https://www.website.com"
      }
    });
    infoJSON = await infoResponse.json();
    const currencies = Object.keys(infoJSON.deposit);
    enabledCurrency = currencies.find(
      currency => infoJSON.deposit[currency].enabled
    );
    jwt = await getSep10Token(url, keyPair);
  });

  it("has a currency enabled for deposit", () => {
    expect(enabledCurrency).toEqual(expect.any(String));
  });

  it("returns a proper error with no JWT", async () => {
    const { status, json } = await doPost(
      enabledCurrency,
      keyPair.publicKey(),
      false
    );
    expect(status).not.toEqual(200);
    expect(json.error).toBeTruthy();
  });

  it("returns a proper error with missing params", async () => {
    const { status, json } = await doPost(null, null, true);
    expect(status).not.toEqual(200);
    expect(json.error).toBeTruthy();
  });

  it("returns a proper error with unsupported currency", async () => {
    const { status, json } = await doPost(
      "NOTREAL",
      keyPair.publicKey(),
      false
    );
    expect(status).not.toEqual(200);
    expect(json.error).toBeTruthy();
  });

  describe("happy path", () => {
    let interactiveURL;
    it("returns successfully with an interactive url and a transaction id", async () => {
      expect.assertions(5);
      const { status, json } = await doPost(
        enabledCurrency,
        keyPair.publicKey(),
        true
      );
      interactiveURL = json.url;
      expect(json.error).toBeFalsy();
      expect(json.type).toEqual("interactive_customer_info_needed");
      expect(json.id).toEqual(expect.any(String));
      expect(() => new global.URL(interactiveURL)).not.toThrow();
      expect(status).toEqual(200);
    });

    it("can load the interactive url", async done => {
      const window = await openObservableWindow(interactiveURL);
      window.observe(message => {
        expect(message).toMatchSchema(transactionSchema);
        if (message.transaction.status == "pending_user_transfer_start") {
          done();
        }
      });
      await waitForLoad();
      const completePage = async () => {
        try {
          const elements = await driver.findElements(By.css("[test-value]"));
          elements.forEach(el => {
            const val = el.getAttribute("test-value");
            el.sendKeys(val);
          });
          const submitButton = await driver.findElement(
            By.css("[test-action='submit']")
          );
          await new Promise(resolve => {
            setTimeout(resolve, 100);
          });
          await submitButton.click();
        } catch (e) {
          console.log("Not an automatable page");
        }
      };
      return new Promise(async (resolve, reject) => {
        while (true) {
          await completePage();

          await waitForLoad();

          await new Promise(resolve => {
            setTimeout(resolve, 2000);
          });
        }
      });
    });
  });
});
