import { loggableFetch } from "../util/loggableFetcher";
import getTomlFile from "./util/getTomlFile";
import { getActiveCurrency } from "./util/currency";
import { getSep10Token } from "../util/sep10";
import { convertSEP31Fields } from "./util/sep9-fields";
import { keyPair } from "./util/registeredKeypair";
import { createCustomer } from "./util/sep12";
import { sep12FieldsSchema } from "./util/schema";
import { randomBytes } from "crypto";

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const testCurrency = process.env.CURRENCY;

function validateFields(fields) {
  return;
}

describe("/customer", () => {
  let toml;
  let jwt;
  let headers;
  let customer_id;
  let memo = Buffer.from(randomBytes(32)).toString("base64");
  let memo_type = "hash";

  beforeAll(async () => {
    toml = await getTomlFile(url);
    expect(toml.KYC_SERVER).toEqual(expect.any(String));
    const tokenResponse = await getSep10Token(url, keyPair);
    jwt = tokenResponse.token;
    headers = {
      Authorization: `Bearer ${jwt}`,
    };
    customer_id = await createCustomer(
      keyPair.publicKey(),
      memo,
      memo_type,
      toml.KYC_SERVER,
      jwt,
    );
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
    it("returns proper schema for existing customer", () => {});
  });

  describe("PUT", () => {
    it("creates customer for valid request", () => {});
    it("updates to existing customers are permitted", () => {});
  });
});
