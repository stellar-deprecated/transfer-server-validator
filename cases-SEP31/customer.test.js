import { loggableFetch } from "../util/loggableFetcher";
import getTomlFile from "./util/getTomlFile";
import { getSep10Token } from "../util/sep10";
import { keyPair } from "./util/registeredKeypair";
import { createCustomer, getPutRequestBodyObj } from "./util/sep12";
import { sep12FieldsSchema } from "./util/schema";
import { randomBytes } from "crypto";
import FormData from "form-data";

jest.setTimeout(10000);

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const testCurrency = process.env.CURRENCY;

describe("/customer", () => {
  let toml;
  let jwt;
  let headers;
  let customer_id;
  let memo = Buffer.from(randomBytes(32)).toString("base64");
  let memo_type = "hash";
  let fieldsRequired;

  beforeAll(async () => {
    toml = await getTomlFile(url);
    expect(toml.KYC_SERVER).toEqual(expect.any(String));
    const tokenResponse = await getSep10Token(url, keyPair);
    jwt = tokenResponse.token;
    headers = {
      Authorization: `Bearer ${jwt}`,
    };
    ({ customer_id, fieldsRequired } = await createCustomer(
      keyPair.publicKey(),
      memo,
      memo_type,
      toml.KYC_SERVER,
      jwt,
    ));
  });

  describe("GET", () => {
    it("returns proper schema for unrecognized customer", async () => {
      let memo = encodeURIComponent(
        Buffer.from(randomBytes(32)).toString("base64"),
      );
      let { json, logs, status } = await loggableFetch(
        toml.KYC_SERVER +
          `/customer?account=${keyPair.publicKey()}&memo=${memo}&memo_type=hash`,
        {
          headers: headers,
        },
      );
      expect(status).toEqual(200);
      expect(json.status).toEqual("NEEDS_INFO");
      expect(json.fields).toMatchSchema(sep12FieldsSchema);
    });

    it("returns proper schema for existing customer", async () => {
      let encodedMemo = encodeURIComponent(memo);
      let { json, logs, status } = await loggableFetch(
        toml.KYC_SERVER +
          `/customer?account=${keyPair.publicKey()}&memo=${encodedMemo}&memo_type=${memo_type}`,
        { headers: headers },
      );
      expect(status).toBe(200);
      expect(["ACCEPTED", "PROCESSING"]).toContain(json.status);
      expect(json.id).toBe(expect.any(String));
    });
  });

  describe("PUT", () => {
    it("updates to existing customers are permitted", async () => {
      // This is actually something not clearly defined in the SEP:
      // Should anchors allow updates to customers that aren't in
      // NEEDS_INFO or REJECTED status? I assume so since users
      // may want to update info from their client.
      //
      // This brings up a larger question: should SEP-12 GET /customer
      // return `fields` for an existing account/memo record (assuming
      // the client is authenticated)? This may be a security concern
      // but it would allow clients to show users the info the anchor
      // has on file for the user.
      let encodedMemo = encodeURIComponent(memo);
      let standardVals = await getPutRequestBodyObj(
        keyPair.publicKey(),
        memo,
        memo_type,
        toml.KYC_SERVER,
        jwt,
        fieldsRequired,
      );
      if (standardVals["first_name"]) {
        standardVals["first_name"] += "test";
      } else {
        // This test is useless if the anchor doesn't require first names.
        // I assume every anchor would want this.
        return;
      }
      let formData = new FormData();
      formData.append("account", standardVals["account"]);
      formData.append("memo", standardVals["memo"]);
      formData.append("memo_type", standardVals["memo_type"]);
      for (let key in standardVals) {
        if (["account", "memo", "memo_type"].includes(key)) continue;
        formData.append(key, standardVals[key]);
      }
      let { json, logs, status } = await loggableFetch(
        toml.KYC_SERVER +
          `/customer?account=${keyPair.publicKey()}&memo=${encodedMemo}&memo_type=${memo_type}`,
        {
          headers: headers,
          method: "PUT",
          body: formData,
        },
      );
      expect(json.id).toBe(customer_id);
      expect(status).toBe(202);
    });
  });
});
