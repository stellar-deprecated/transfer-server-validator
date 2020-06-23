import { fetch } from "../util/fetchShim";
import getTomlFile from "./util/getTomlFile";
import { getActiveCurrency } from "./util/currency";
import { getSep10Token } from "../util/sep10";
import { convertSEP31Fields } from "./util/sep9-fields";
import { keyPair } from "./util/registeredKeypair";
import { transactionSchema } from "./util/schema";

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const testCurrency = process.env.CURRENCY;

describe("GET /transaction", () => {
  let infoJSON;
  let enabledCurrency;
  let jwt;
  let toml;
  let transaction;
  let authorizedHeaders;

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
    const values = convertSEP31Fields(infoJSON.receive[enabledCurrency].fields);
    authorizedHeaders = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };
    const resp = await fetch(toml.DIRECT_PAYMENT_SERVER + "/send", {
      method: "POST",
      headers: authorizedHeaders,
      body: JSON.stringify({
        amount: 100,
        asset_code: enabledCurrency,
        fields: values,
      }),
    });
    expect(resp.status).toBe(200);
    transaction = await resp.json();
  });

  it("should 404 for a non-valid transaction", async () => {
    const resp = await fetch(
      toml.DIRECT_PAYMENT_SERVER + "/transaction?id=23456789",
      { headers: authorizedHeaders },
    );
    expect(resp.status).toBe(404);
  });

  it("should 401 for an unauthenticated request", async () => {
    const resp = await fetch(
      `${toml.DIRECT_PAYMENT_SERVER}/transaction?id=${transaction.id}`,
    );
    expect(resp.status).toBe(401);
  });

  it("should return a valid schema for a proper request", async () => {
    const resp = await fetch(
      `${toml.DIRECT_PAYMENT_SERVER}/transaction?id=${transaction.id}`,
      { headers: authorizedHeaders },
    );
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json, json).toMatchSchema(transactionSchema);
  });
});
