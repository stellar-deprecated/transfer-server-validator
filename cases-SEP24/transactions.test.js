import { fetch } from "../util/fetchShim";
import { getSep10Token } from "../util/sep10";
import getTomlFile from "../util/getTomlFile";
import { createTransaction } from "./util/interactive";
import { loggableFetch } from "../util/loggableFetcher";
import StellarSDK from "stellar-sdk";
import {
  errorSchema,
  transactionsSchema,
  getTransactionSchema,
} from "./util/schema";
import { ensureCORS } from "../util/ensureCORS";
import { getTransactionBy } from "../util/transactions";
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
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });

    const { json, status, logs } = await loggableFetch(
      transferServer + `/transactions?asset_code=${enabledCurrency}`,
    );
    expect(status, logs).toBeGreaterThanOrEqual(400);
    expect(status, logs).toBeLessThan(500);
    expect(json, logs).toMatchSchema(errorSchema);
  });

  it("return proper formatted transactions list", async () => {
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });

    const { json, status, logs } = await loggableFetch(
      transferServer + `/transactions?asset_code=${enabledCurrency}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    expect(status, logs).toEqual(200);
    expect(json.error, logs).not.toBeDefined();
    expect(json, logs).toMatchSchema(transactionsSchema);

    json.transactions.forEach((transaction) => {
      const isDeposit = transaction.kind === "deposit";
      const schema = getTransactionSchema(isDeposit);
      expect(transaction, logs).toMatchSchema(schema.properties.transaction);
    });
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

  it("return proper amount of transactions with limit param", async () => {
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: false,
    });

    const { json, status, logs } = await loggableFetch(
      transferServer + `/transactions?asset_code=${enabledCurrency}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );
    expect(status, logs).toEqual(200);
    expect(json.error, logs).not.toBeDefined();
    expect(json.transactions.length, logs).toBe(1);
  });

  it("return proper transactions with no_older_than param", async () => {
    let { json: transactionJson } = await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: false,
    });

    transactionJson = await getTransactionBy({
      value: transactionJson.id,
      transferServer: toml.TRANSFER_SERVER_SEP0024 || toml.TRANSFER_SERVER,
      jwt: jwt,
    });
    let currentDate = new Date(transactionJson.transaction.started_at);
    currentDate.setSeconds(currentDate.getSeconds() - 1);

    const { json, status, logs } = await loggableFetch(
      transferServer +
        `/transactions?asset_code=${enabledCurrency}&no_older_than=${currentDate.toISOString()}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    expect(status, logs).toEqual(200);
    expect(json.error, logs).not.toBeDefined();
    expect(json.transactions.length, logs).toBeGreaterThanOrEqual(2);

    json.transactions.forEach((transaction) => {
      const transactionStartedTime = new Date(transaction.started_at).getTime();
      expect(transactionStartedTime, logs).toBeGreaterThanOrEqual(
        currentDate.getTime(),
      );
    });
  });

  it("return only deposit transactions with kind=deposit param", async () => {
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: false,
    });

    const { json, status, logs } = await loggableFetch(
      transferServer +
        `/transactions?asset_code=${enabledCurrency}&kind=deposit`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    expect(status, logs).toEqual(200);
    expect(json.error, logs).not.toBeDefined();
    expect(json.transactions.length, logs).toBeGreaterThanOrEqual(1);

    json.transactions.forEach((transaction) => {
      expect(transaction.kind, logs).toBe("deposit");
    });
  });

  it("return only withdrawal transactions with kind=withdrawal param", async () => {
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });
    await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: false,
    });

    const { json, status, logs } = await loggableFetch(
      transferServer +
        `/transactions?asset_code=${enabledCurrency}&kind=withdrawal`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    expect(status, logs).toEqual(200);
    expect(json.error, logs).not.toBeDefined();
    expect(json.transactions.length, logs).toBeGreaterThanOrEqual(1);

    json.transactions.forEach((transaction) => {
      expect(transaction.kind, logs).toBe("withdrawal");
    });
  });

  it("return proper transactions with paging_id param", async () => {
    let { json } = await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });
    const pagingId = json.id;

    const pagingTransaction = await fetch(
      transferServer + `/transaction?id=${pagingId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );
    const pagingJson = await pagingTransaction.json();

    var { json: transactionsJson, status, logs } = await loggableFetch(
      transferServer +
        `/transactions?asset_code=${enabledCurrency}&paging_id=${pagingId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    expect(status, logs).toEqual(200);
    expect(transactionsJson.error, logs).not.toBeDefined();

    transactionsJson.transactions.forEach((transaction) => {
      const transactionStartedTime = new Date(transaction.started_at).getTime();
      const pagingStartedTime = new Date(
        pagingJson.transaction.started_at,
      ).getTime();
      expect(transactionStartedTime, logs).toBeLessThanOrEqual(
        pagingStartedTime,
      );
      expect(transaction.id, logs).not.toBe(pagingJson.transaction.id);
      expect(transactionStartedTime, logs).toBeLessThan(pagingStartedTime);
    });
  });

  it("return proper transactions with all param", async () => {
    let { json: earliestTransactionJson } = await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });
    let { json } = await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });
    const pagingId = json.id;

    earliestTransactionJson = await getTransactionBy({
      value: earliestTransactionJson.id,
      transferServer: toml.TRANSFER_SERVER_SEP0024 || toml.TRANSFER_SERVER,
      jwt: jwt,
    });
    let currentDate = new Date(earliestTransactionJson.transaction.started_at);
    currentDate.setSeconds(currentDate.getSeconds() - 1);

    const pagingTransaction = await fetch(
      transferServer + `/transaction?id=${pagingId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );
    const pagingJson = await pagingTransaction.json();
    var { json: transactionsJson, status, logs } = await loggableFetch(
      `${transferServer}/transactions?asset_code=${enabledCurrency}&kind=deposit&limit=1&paging_id=${pagingId}&no_older_than=${currentDate.toISOString()}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    expect(status, logs).toEqual(200);
    expect(transactionsJson.error, logs).not.toBeDefined();
    expect(transactionsJson.transactions.length, logs).toBe(1);

    transactionsJson.transactions.forEach((transaction) => {
      const transactionStartedTime = new Date(transaction.started_at).getTime();
      const pagingStartedTime = new Date(
        pagingJson.transaction.started_at,
      ).getTime();
      expect(transaction.kind, logs).toBe("deposit");
      expect(transactionStartedTime, logs).toBeLessThanOrEqual(
        pagingStartedTime,
      );
      expect(transactionStartedTime, logs).toBeGreaterThanOrEqual(
        currentDate.getTime(),
      );
    });
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
