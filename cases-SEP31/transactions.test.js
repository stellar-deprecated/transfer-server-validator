import { fetch } from "../util/fetchShim";
import { loggableFetch } from "../util/loggableFetcher";
import getTomlFile from "./util/getTomlFile";
import { getActiveCurrency } from "./util/currency";
import { getSep10Token } from "../util/sep10";
import { keyPair } from "./util/registeredKeypair";
import { transactionSchema } from "./util/schema";
import { randomBytes } from "crypto";
import { createCustomer } from "./util/sep12";
import { values } from "./util/sep9-fields";

jest.setTimeout(30000);

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const testCurrency = process.env.CURRENCY;

const customHardCodedFields = {
  "remittanceapi.perahub.com.ph": {
    purpose: "Living Expenses",
    relationship: "Brother",
  },
  "testanchor.stellar.org": {
    routing_number: "1234567",
    account_number: "1234568",
  },
};

function getSEP31TransactionFields(infoJSON, enabledCurrency) {
  let transactionFields = {};
  for (let key in infoJSON.receive[enabledCurrency].fields.transaction) {
    if (key in values) transactionFields[key] = values[key];
  }
  if (urlBuilder.host in customHardCodedFields) {
    transactionFields = {
      ...transactionFields,
      ...customHardCodedFields[urlBuilder.host],
    };
  }
  return transactionFields;
}

describe("/transactions", () => {
  let infoJSON;
  let enabledCurrency;
  let jwt;
  let toml;
  let transaction;
  let authorizedHeaders;
  let transactionFields;
  let senderMemo = Buffer.from(randomBytes(32)).toString("base64");
  let receiverMemo = Buffer.from(randomBytes(32)).toString("base64");

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
    authorizedHeaders = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };
    transactionFields = getSEP31TransactionFields(infoJSON, enabledCurrency);
    let postBody = {
      amount: 100,
      asset_code: enabledCurrency,
      fields: {
        transaction: transactionFields,
      },
    };
    let customer_id, fieldsRequired;
    if (infoJSON.receive[enabledCurrency].sender_sep12_type) {
      let type = infoJSON.receive[enabledCurrency].sender_sep12_type;
      ({ customer_id, fieldsRequired } = await createCustomer(
        keyPair.publicKey(),
        senderMemo,
        "hash",
        type,
        toml.KYC_SERVER,
        jwt,
      ));
      postBody["sender_id"] = customer_id;
    }
    if (infoJSON.receive[enabledCurrency].receiver_sep12_type) {
      let type = infoJSON.receive[enabledCurrency].receiver_sep12_type;
      ({ customer_id, fieldsRequired } = await createCustomer(
        keyPair.publicKey(),
        receiverMemo,
        "hash",
        type,
        toml.KYC_SERVER,
        jwt,
        true,
      ));
      postBody["receiver_id"] = customer_id;
    }
    const resp = await fetch(toml.DIRECT_PAYMENT_SERVER + "/transactions", {
      method: "POST",
      headers: authorizedHeaders,
      body: JSON.stringify(postBody),
    });
    expect([200, 201]).toContain(resp.status);
    transaction = await resp.json();
  });

  describe("GET", () => {
    it("should 404 for a non-valid transaction", async () => {
      const {
        json,
        status,
        logs,
      } = await loggableFetch(
        toml.DIRECT_PAYMENT_SERVER + "/transactions/23456789",
        { headers: authorizedHeaders },
      );
      expect(status, logs).toBe(404);
    });

    it("should 403 for an unauthenticated request", async () => {
      const resp = await fetch(
        `${toml.DIRECT_PAYMENT_SERVER}/transactions/${transaction.id}`,
      );
      expect(resp.status).toBe(403);
    });

    it("should return a valid schema for a proper request", async () => {
      const {
        json,
        logs,
        status,
      } = await loggableFetch(
        `${toml.DIRECT_PAYMENT_SERVER}/transactions/${transaction.id}`,
        { headers: authorizedHeaders },
      );
      expect(status).toBe(200);
      expect(json, logs).toMatchSchema(transactionSchema);
    });
  });

  describe("POST", () => {
    it("fails with no authentication", async () => {
      const { json, status, logs } = await loggableFetch(
        toml.DIRECT_PAYMENT_SERVER + "/transactions",
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
      expect(status, logs).toBe(403);
    });

    it("fails with no amount", async () => {
      const headers = {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      };
      const { json, status, logs } = await loggableFetch(
        toml.DIRECT_PAYMENT_SERVER + "/transactions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            asset_code: enabledCurrency,
            fields: { transaction: transactionFields },
          }),
        },
      );
      expect(status, logs).toBe(400);
    });
  });
});
