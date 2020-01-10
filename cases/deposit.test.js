import { fetch } from "./util/fetchShim";
import getSep10Token from "./util/sep10";
import TOML from "toml";
import StellarSDK from "stellar-sdk";
import FormData from "form-data";

const url = process.env.DOMAIN;
const account = "GCQJX6WGG7SSFU2RBO5QANTFXY7C5GTTFJDCBAAO42JCCFIMZ7PEBURP";
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);

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
      expect(status).toEqual(200);
      expect(json.error).toBeFalsy();
      expect(json.type).toEqual("interactive_customer_info_needed");
      expect(json.id).toEqual(expect.any(String));
      interactiveURL = json.url;
      expect(() => new URL(interactiveURL)).not.toThrow();
    });
  });
});
