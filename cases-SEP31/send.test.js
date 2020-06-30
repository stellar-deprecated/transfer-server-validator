import { Keypair } from "stellar-sdk";
import { fetch } from "../util/fetchShim";
import { loggableFetch } from "../util/loggableFetcher";
import getTomlFile from "./util/getTomlFile";
import { getActiveCurrency } from "./util/currency";
import { getSep10Token } from "../util/sep10";
import { convertSEP31Fields } from "./util/sep9-fields";
import { keyPair } from "./util/registeredKeypair";

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const testCurrency = process.env.CURRENCY;

describe("POST /send", () => {
  let infoJSON;
  let enabledCurrency;
  let jwt;
  let toml;

  beforeAll(async () => {
    toml = await getTomlFile(url);
    const server = toml.DIRECT_PAYMENT_SERVER;
    ({ enabledCurrency, infoJSON } = await getActiveCurrency(
      testCurrency,
      server,
      url,
    ));
    const tokenResponse = await getSep10Token(url, keyPair);
    jwt = tokenResponse.token;
  });

  it("fails with no authentication", async () => {
    const { json, status, logs } = await loggableFetch(
      toml.DIRECT_PAYMENT_SERVER + "/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 100,
        }),
      },
    );
    expect(status, logs).toBe(401);
  });

  it("fails with no amount", async () => {
    const values = convertSEP31Fields(infoJSON.receive[enabledCurrency].fields);
    const headers = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };
    const { json, status, logs } = await loggableFetch(
      toml.DIRECT_PAYMENT_SERVER + "/send",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          asset_code: enabledCurrency,
          fields: values,
        }),
      },
    );
    expect(status, logs).toBe(400);
  });

  it("succeeds", async () => {
    const values = convertSEP31Fields(infoJSON.receive[enabledCurrency].fields);
    const headers = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };
    const { json, status, logs } = await loggableFetch(
      toml.DIRECT_PAYMENT_SERVER + "/send",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: 100,
          asset_code: enabledCurrency,
          fields: values,
        }),
      },
    );
    expect(status, logs).toBe(200);
    expect(json.id, logs).toEqual(expect.any(String));
    expect(json.stellar_account_id, logs).toEqual(expect.any(String));
    expect(() => Keypair.fromPublicKey(json.stellar_account_id)).not.toThrow();
    expect(json.stellar_memo_type, logs).toEqual(
      expect.stringMatching(/text|hash|id/),
    );
  });
});
