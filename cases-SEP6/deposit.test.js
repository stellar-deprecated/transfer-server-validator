import { fetch } from "../util/fetchShim";
import { getSep10Token } from "../util/sep10";
import getTomlFile from "../util/getTomlFile";
import { putKYCInfo, createTransaction } from "./util/transactions";
import { getActiveCurrency } from "../util/currency";
import StellarSDK from "stellar-sdk";
const urlBuilder = new URL(process.env.DOMAIN);
const testCurrency = process.env.CURRENCY;
const url = urlBuilder.toString();
const keyPair = StellarSDK.Keypair.random();

jest.setTimeout(200000);

describe("Deposit", () => {
  let infoJSON;
  let enabledCurrency;
  let currencies;
  let jwt;
  let toml;

  beforeAll(async () => {
    try {
      toml = await getTomlFile(url);
    } catch (e) {
      throw "Invalid TOML formatting";
    }
    const transferServer = toml.TRANSFER_SERVER;

    ({ enabledCurrency, infoJSON, currencies } = await getActiveCurrency(
      testCurrency,
      transferServer,
    ));

    ({ token: jwt } = await getSep10Token(url, keyPair));
  });

  it("has a currency enabled for deposit", () => {
    expect(currencies).toEqual(expect.arrayContaining([enabledCurrency]));
    expect(
      infoJSON.deposit[enabledCurrency].enabled,
      "The selected currency is not enabled for deposit",
    ).toBeTruthy();
  });

  it("returns a proper error with no JWT", async () => {
    const { status, json } = await createTransaction({
      asset_code: enabledCurrency,
      account: keyPair.publicKey(),
      jwt: null,
      toml: toml,
      isDeposit: true,
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    expect(json.type).toEqual("authentication_required");
  });

  it("returns a proper error with missing params", async () => {
    const { status, json } = await createTransaction({
      asset_code: null,
      account: null,
      jwt: jwt,
      toml: toml,
      isDeposit: true,
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    expect(json.error).toBeTruthy();
  });

  it("returns a proper error with unsupported currency", async () => {
    const { status, json } = await createTransaction({
      asset_code: "NOTREAL",
      account: keyPair.publicKey(),
      jwt: jwt,
      toml: toml,
      isDeposit: true,
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    expect(json.error).toBeTruthy();
  });

  it("returns 403 or 200 Success", async () => {
    const { status, json } = await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      jwt: jwt,
      toml: toml,
      isDeposit: true,
    });
    expect(json.error).toBeFalsy();
    expect([200, 403]).toContain(status);
    if (json.type) {
      expect(json.type).toEqual("non_interactive_customer_info_needed");
      expect(json.fields).toBeTruthy();
    }
  });

  it("returns 200 Success or 403 customer_info_status after PUT request to KYC server", async () => {
    if (toml.KYC_SERVER) {
      await putKYCInfo({ toml: toml, account: keyPair.publicKey(), jwt: jwt });
    }
    const { status, json } = await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      jwt: jwt,
      toml: toml,
      isDeposit: true,
    });
    expect([200, 403]).toContain(status);
    expect(json.error).toBeFalsy();
    if (status === 200) expect(json.how).toBeTruthy();
    if (status === 403) {
      expect(json.type).toEqual("customer_info_status");
      expect(["pending", "denied"]).toContain(json.status);
    }
  });
});
