import { fetch } from "../util/fetchShim";
import getTomlFile from "./util/getTomlFile";
import { getActiveCurrency } from "./util/currency";
import getSep10Token from "../util/sep10";
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
    ));
    ({ token: jwt } = await getSep10Token(url, keyPair));
  });

  it("fails with no authentication", async () => {
    const resp = await fetch(toml.DIRECT_PAYMENT_SERVER + "/send", {
      method: "POST",
      body: JSON.stringify({
        amount: 100,
      }),
    });
    expect(resp.status).toBe(401);
  });

  it("fails with no amount", async () => {
    const headers = { Authorization: `Bearer ${jwt}` };
    const resp = await fetch(toml.DIRECT_PAYMENT_SERVER + "/send", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(resp.status).toBe(403);
  });

  it("succeeds", async () => {
    const values = convertSEP31Fields(infoJSON.send[enabledCurrency].fields);
    const headers = { Authorization: `Bearer ${jwt}` };
    const resp = await fetch(toml.DIRECT_PAYMENT_SERVER + "/send", {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount: 100,
        fields: values,
      }),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.id).toBe(expect.any(String));
    expect(json.stellar_account_id).toBe(expect.any(String));
    expect(json.stellar_memo_type).toBe(expect.stringMatching(/text|hash|id/));
  });
});
