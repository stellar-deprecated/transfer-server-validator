import { loggableFetch } from "../util/loggableFetcher";
import getTomlFile from "./util/getTomlFile";
import { getActiveCurrency } from "./util/currency";
import { getSep10Token } from "../util/sep10";
import { convertSEP31Fields } from "./util/sep9-fields";
import { keyPair } from "./util/registeredKeypair";
import { createCustomer } from "./util/sep12";
import { sep12FieldsSchema } from "./util/schema";

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

  beforeAll(async () => {
    toml = await getTomlFile(url);
    expect(toml.KYC_SERVER).toEqual(expect.any(String));
    const tokenResponse = await getSep10Token(url, keyPair);
    jwt = tokenResponse.token;
    headers = {
      Authorization: `Bearer ${jwt}`,
    };
    //customer_id = createCustomer(keyPair.publicKey(), "test", "text", toml.KYC_SERVER);
  });

  describe("GET", () => {
    it("returns proper schema for unrecognized customer", async () => {
      let { json, logs, status } = await loggableFetch(
        toml.KYC_SERVER + "/customer?id=123",
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
