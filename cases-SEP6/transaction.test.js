import { fetch } from "../util/fetchShim";
import { getSep10Token } from "../util/sep10";
import getTomlFile from "../util/getTomlFile";
import StellarSDK from "stellar-sdk";
import { getTransactionBy } from "../util/transactions";
import { createTransaction } from "./util/transactions";
import { errorSchema, getTransactionSchema } from "./util/schema";
import { ensureCORS } from "../util/ensureCORS";
import { getActiveCurrency } from "../util/currency";

jest.setTimeout(60000);

const urlBuilder = new URL(process.env.DOMAIN);
const testCurrency = process.env.CURRENCY;
const domain = urlBuilder.toString();
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);

describe("Transaction", () => {
  let toml;
  let enabledCurrency;
  let jwt;
  let transferServer;

  beforeAll(async () => {
    toml = await getTomlFile(domain);
    ({ token: jwt } = await getSep10Token(domain, keyPair));

    transferServer = toml.TRANSFER_SERVER;

    ({ enabledCurrency } = await getActiveCurrency(
      testCurrency,
      transferServer,
    ));

    expect(enabledCurrency).toBeDefined();
    expect(transferServer).toBeDefined();
  });

  async function checkTransactionResponse({ json }) {
    expect(json.error).not.toBeDefined();
    const schema =
      json.kind === "deposit"
        ? getTransactionSchema(true)
        : getTransactionSchema(false);
    expect(json).toMatchSchema(schema);
  }

  it("has CORS on the transaction endpoint", async () => {
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      transferServer + "/transaction",
    );
    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  it("returns error schema for a request without jwt", async () => {
    let { json, status } = await createTransaction({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      toml: toml,
      jwt: jwt,
      isDeposit: true,
    });
    if (status !== 200) throw "Unable to create transaction, aborting test";
    json = await getTransactionBy({
      value: json.id,
      transferServer: toml.TRANSFER_SERVER,
      jwt: null,
      expectStatusBetween: [400, 500],
    });
    expect(json.type).toEqual("authentication_required");
  });

  it("returns a proper error with missing params", async () => {
    const response = await fetch(transferServer + "/transaction", {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    const json = await response.json();
    expect(response.status).not.toEqual(200);
    expect(json).toMatchSchema(errorSchema);
  });

  it("returns a proper error for a non-existing transaction by id", async () => {
    const json = await getTransactionBy({
      value: "1277bd18-a2bd-4acd-9a87-2f541c7b8933",
      expectStatus: 404,
      transferServer: toml.TRANSFER_SERVER,
      jwt: jwt,
    });
    expect(json).toMatchSchema(errorSchema);
  });

  it("returns a proper error for a non-existing transaction by stellar_transaction_id", async () => {
    const json = await getTransactionBy({
      iden: "stellar_transaction_id",
      value: "17a670bc424ff5ce3b386dbfaae9990b66a2a37b4fbe51547e8794962a3f9e6a",
      expectStatus: 404,
      transferServer: toml.TRANSFER_SERVER,
      jwt: jwt,
    });
    expect(json).toMatchSchema(errorSchema);
  });

  it("returns a proper error for a non-existing transaction by external_transaction_id", async () => {
    const json = await getTransactionBy({
      iden: "external_transaction_id",
      value: "2dd16cb409513026fbe7defc0c6f826c2d2c65c3da993f747d09bf7dafd31093",
      expectStatus: 404,
      jwt: jwt,
      transferServer: toml.TRANSFER_SERVER,
    });
    expect(json).toMatchSchema(errorSchema);
  });
});
