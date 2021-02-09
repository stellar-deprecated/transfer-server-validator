import { fetch } from "../util/fetchShim";
import { loggableFetch } from "../util/loggableFetcher";
import getTomlFile from "./util/getTomlFile";
import { getActiveCurrency } from "./util/currency";
import { getSep10Token } from "../util/sep10";
import { convertSEP31Fields } from "./util/sep9-fields";
import { keyPair } from "./util/registeredKeypair";
import { transactionSchema } from "./util/schema";
import { randomBytes } from "crypto";
import { createCustomer } from "./util/sep12";

jest.setTimeout(30000);

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const testCurrency = process.env.CURRENCY;

describe("/transactions", () => {
  let infoJSON;
  let enabledCurrency;
  let jwt;
  let toml;
  let transaction;
  let authorizedHeaders;
  let sender_id;
  let senderMemo = Buffer.from(randomBytes(32)).toString("base64");
  let senderFieldsRequired;
  let receiver_id;
  let receiverMemo = Buffer.from(randomBytes(32)).toString("base64");
  let receiverFieldsRequired;

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
    const transactionValues = convertSEP31Fields(
      infoJSON.receive[enabledCurrency].fields,
    );
    authorizedHeaders = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };
    let postBody = {
      amount: 100,
      asset_code: enabledCurrency,
      fields: transactionValues,
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
      sender_id = customer_id;
      senderFieldsRequired = fieldsRequired;
      postBody["sender_id"] = sender_id;
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
      receiver_id = customer_id;
      receiverFieldsRequired = fieldsRequired;
      postBody["receiver_id"] = receiver_id;
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
      const values = convertSEP31Fields(
        infoJSON.receive[enabledCurrency].fields,
      );
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
            fields: values,
          }),
        },
      );
      expect(status, logs).toBe(400);
    });
  });
});
