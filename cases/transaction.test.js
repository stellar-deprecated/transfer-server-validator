import { fetch } from "./util/fetchShim";
import getSep10Token from "./util/sep10";
import getTomlFile from "./util/getTomlFile";
import TOML from "toml";
import StellarSDK from "stellar-sdk";
import FormData from "form-data";
import { transactionSchema } from "./util/schema";

const urlBuilder = new URL(process.env.DOMAIN);
const domain = urlBuilder.toString();
const account = "GCQJX6WGG7SSFU2RBO5QANTFXY7C5GTTFJDCBAAO42JCCFIMZ7PEBURP";
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);

describe("Transaction", () => {
  let toml;
  let enabledCurrency;
  let jwt;

  const createTransaction = async (asset_code, account, authenticate) => {
    const params = new FormData();
    if (asset_code) params.append("asset_code", asset_code);
    if (account) params.append("account", account);
    const authenticatedHeaders = Object.assign(
      {
        Authorization: `Bearer ${jwt}`
      },
      params.getHeaders()
    );
    const response = await fetch(
      toml.TRANSFER_SERVER + "transactions/deposit/interactive",
      {
        headers: authenticate ? authenticatedHeaders : params.getHeaders(),
        method: "POST",
        body: params
      }
    );
    const status = response.status;
    const json = await response.json();
    return {
      status,
      json
    };
  };
  beforeAll(async () => {
    toml = await getTomlFile(domain);
    jwt = await getSep10Token(domain, keyPair);
    if (toml.TRANSFER_SERVER[toml.TRANSFER_SERVER.length - 1] !== "/") {
      toml.TRANSFER_SERVER += "/";
    }
    const infoResponse = await fetch(toml.TRANSFER_SERVER + "info", {
      headers: {
        Origin: "https://www.website.com"
      }
    });
    const infoJSON = await infoResponse.json();
    const currencies = Object.keys(infoJSON.deposit);
    enabledCurrency = currencies.find(
      currency => infoJSON.deposit[currency].enabled
    );
    expect(toml.TRANSFER_SERVER).toBeDefined();
  });

  it("has the correct properties for an existing transaction", async () => {
    let { json } = await createTransaction(
      enabledCurrency,
      keyPair.publicKey(),
      true
    );
    const response = await fetch(
      toml.TRANSFER_SERVER + "transaction?id=" + json.id,
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    );
    json = await response.json();
    expect(response.status).toEqual(200);
    expect(json.error).not.toBeDefined();

    expect(json).toMatchSchema(transactionSchema);
  });
  it("returns a proper error for a non-existing transaction", async () => {
    const response = await fetch(
      toml.TRANSFER_SERVER +
        "transaction?id=1277bd18-a2bd-4acd-9a87-2f541c7b8933",
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    );
    const json = await response.json();
    expect(response.status).toEqual(404);
    expect(json.error).toBeDefined();
  });
});
