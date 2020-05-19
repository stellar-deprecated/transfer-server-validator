import getSep10Token from "../util/sep10";
import getTomlFile from "../util/getTomlFile";
import { createTransaction } from "./util/transactions";
import { loggableFetch } from "../util/loggableFetcher";
import StellarSDK from "stellar-sdk";
import { errorSchema } from "./util/schema";
import { ensureCORS } from "../util/ensureCORS";
import { getActiveCurrency } from "../util/currency";

jest.setTimeout(60000);

const urlBuilder = new URL(process.env.DOMAIN);
const testCurrency = process.env.CURRENCY;
const domain = urlBuilder.toString();
const keyPair = StellarSDK.Keypair.random();

describe("Transactions", () => {
  let toml;
  let enabledCurrency;
  let jwt;
  let transferServer;

  beforeAll(async () => {
    toml = await getTomlFile(domain);
    ({ token: jwt } = await getSep10Token(domain, keyPair));

    transferServer = toml.TRANSFER_SERVER_SEP0024 || toml.TRANSFER_SERVER;

    ({ enabledCurrency } = await getActiveCurrency(
      testCurrency,
      transferServer,
    ));

    expect(enabledCurrency).toBeDefined();
    expect(transferServer).toBeDefined();
    expect(toml.WEB_AUTH_ENDPOINT).toBeDefined();
  });

  it("has CORS on the transactions endpoint", async () => {
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      transferServer + "/transactions",
    );
    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  it("returns error schema for a request without jwt", async () => {
    const { json, status, logs } = await loggableFetch(
      transferServer + `/transactions?asset_code=${enabledCurrency}`,
    );
    expect(status, logs).toBeGreaterThanOrEqual(400);
    expect(status, logs).toBeLessThan(500);
    expect(json, logs).toMatchSchema(errorSchema);
  });

  it("return empty list for new account transactions", async () => {
    const kp_secret =
      "SAAG4XF7PRKFASDQTENBOQ7QQVVVV4ZH2WFABWVFWU3UL2QJARBUSGTY";
    const kp = StellarSDK.Keypair.fromSecret(kp_secret);
    const { token: sep10JWT } = await getSep10Token(domain, kp);

    const { json, status, logs } = await loggableFetch(
      transferServer + `/transactions?asset_code=${enabledCurrency}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${sep10JWT}`,
        },
      },
    );

    expect(status, logs).toEqual(200);
    expect(json.error, logs).not.toBeDefined();
    expect(json.transactions.length, logs).toEqual(0);
  });

  it("return proper error with missing params", async () => {
    const { json, status, logs } = await loggableFetch(
      transferServer + `/transactions`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    expect(status, logs).not.toEqual(200);
    expect(json, logs).toMatchSchema(errorSchema);
  });

  it("return proper error for a non-supported currency", async () => {
    const { json, status, logs } = await loggableFetch(
      transferServer + `/transactions?asset_code=XYXCEZZYBD`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    expect(status, logs).not.toEqual(200);
    expect(json, logs).toMatchSchema(errorSchema);
  });
});
