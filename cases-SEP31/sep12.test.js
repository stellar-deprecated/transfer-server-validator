// https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0012.md
import getTomlFile from "../util/getTomlFile";
import { getActiveCurrency } from "./util/currency";
import { getSep10Token } from "../util/sep10";
import { keyPair } from "./util/registeredKeypair";
import { loggableFetch } from "../util/loggableFetcher";
import { convertSEP31Section } from "./util/sep9-fields";

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
console.log(url);
const testCurrency = process.env.CURRENCY;
jest.setTimeout(100000);
describe("SEP12", () => {
  let infoJSON;
  let enabledCurrency;
  let jwt;
  let toml;
  let KYC_SERVER;

  beforeAll(async () => {
    toml = await getTomlFile(url);
    KYC_SERVER = toml.KYC_SERVER;
    expect(KYC_SERVER, "TOML must define a KYC_SERVER").toBeTruthy();
    const server = toml.DIRECT_PAYMENT_SERVER;
    ({ enabledCurrency, infoJSON } = await getActiveCurrency(
      testCurrency,
      server,
      url,
    ));
    const tokenResponse = await getSep10Token(url, keyPair);
    jwt = tokenResponse.token;
  });

  it("can get fields using the /info endpoints keys", async () => {
    const senderType = infoJSON.receive[enabledCurrency].sender_sep12_type;
    const memo = Date.now().toString();
    let { json, status, logs } = await loggableFetch(
      `${KYC_SERVER}/customer?account=${keyPair.publicKey()}&memo=${memo}&type=${senderType}&memo_type=text`,
      {
        headers: { Authorization: `Bearer ${jwt}` },
      },
    );
    expect(status, logs).toBe(200);
    expect(json.status, logs).toBe("NEEDS_INFO");
    console.log(json.fields);
    const values = convertSEP31Section(json.fields);
    console.log("Values", values);
    const data = new FormData();
    data.append("account", keyPair.publicKey());
    console.log("Public key", keyPair.publicKey());
    data.append("memo", memo);
    data.append("memo_type", "text");
    Object.keys(values).forEach((key) => data.append(key, values[key]));

    const putResponse = await loggableFetch(`${KYC_SERVER}/customer`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "multipart/form-data",
      },
      body: data,
    });
    console.log(putResponse);
    expect(putResponse.status, logs).toBe(200);
    expect(putResponse.json.id).toBe(expect.any(String));
  });
});
