/**
 * @jest-environment ./cases/environment.js
 */
import { fetch } from "./util/fetchShim";
import getSep10Token from "./util/sep10";
import StellarSDK from "stellar-sdk";
import getTomlFile from "./util/getTomlFile";
import { getTransactionBy } from "./util/transactions";
import { createTransaction, doInteractiveFlow } from "./util/interactive";
const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const keyPair = StellarSDK.Keypair.random();

jest.setTimeout(200000); // 20 sec timeout since we're actually stepping through web forms

describe("Withdraw", () => {
  let infoJSON;
  let enabledCurrency;
  let jwt;
  let toml;

  beforeAll(async () => {
    await fetch(`https://friendbot.stellar.org?addr=${keyPair.publicKey()}`);
    try {
      toml = await getTomlFile(url);
    } catch (e) {
      throw "Invalid TOML formatting";
    }

    const infoResponse = await fetch(toml.TRANSFER_SERVER + "/info", {
      headers: {
        Origin: "https://www.website.com",
      },
    });
    infoJSON = await infoResponse.json();
    const currencies = Object.keys(infoJSON.withdraw);
    enabledCurrency = currencies.find(
      (currency) => infoJSON.withdraw[currency].enabled,
    );
    jwt = await getSep10Token(url, keyPair);
  });

  it("has a currency enabled for withdraw", () => {
    expect(enabledCurrency).toEqual(expect.any(String));
  });

  it("returns a proper error with no JWT", async () => {
    const { status, json } = await createTransaction({
      asset_code: enabledCurrency,
      account: keyPair.publicKey(),
      jwt: null,
      toml: toml,
      isDeposit: false,
    });
    expect(status).not.toEqual(200);
    expect(json.error).toBeTruthy();
  });

  it("returns a proper error with missing params", async () => {
    const { status, json } = await createTransaction({
      asset_code: null,
      account: null,
      jwt: jwt,
      toml: toml,
      isDeposit: false,
    });
    expect(status).not.toEqual(200);
    expect(json.error).toBeTruthy();
  });

  it("returns a proper error with unsupported currency", async () => {
    const { status, json } = await createTransaction({
      asset_code: "NOTREAL",
      account: keyPair.publicKey(),
      jwt: jwt,
      toml: toml,
      isDeposit: false,
    });
    expect(status).not.toEqual(200);
    expect(json.error).toBeTruthy();
  });

  it("returns successfully with an interactive url and a transaction id", async () => {
    expect.assertions(5);
    const { status, json } = await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      jwt: jwt,
      toml: toml,
      isDeposit: false,
    });
    let interactiveURL = json.url;
    expect(json.error).toBeFalsy();
    expect(json.type).toEqual("interactive_customer_info_needed");
    expect(json.id).toEqual(expect.any(String));
    expect(() => new global.URL(interactiveURL)).not.toThrow();
    expect(status).toEqual(200);
  });

  describe("happy path", () => {
    it("can load get through the interactive flow", async () => {
      let transactionId = await doInteractiveFlow({
        currency: enabledCurrency,
        account: keyPair.publicKey(),
        jwt: jwt,
        toml: toml,
        isDeposit: false,
      });
      await getTransactionBy({
        iden: "id",
        value: transactionId,
        expectStatus: 200,
        toml: toml,
        jwt: jwt,
      });
    });
  });
});
