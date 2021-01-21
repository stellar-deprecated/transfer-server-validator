import StellarSDK from "stellar-sdk";

import { fetch } from "../util/fetchShim";
import getTomlFile from "../util/getTomlFile";
import { getSep10Token } from "../util/sep10";
import { errorSchema, feeSchema } from "./util/schema";
import { ensureCORS } from "../util/ensureCORS";

const keyPair = StellarSDK.Keypair.random();
const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();

jest.setTimeout(30000);

describe("Fee", () => {
  let jwt;
  let toml;
  let needFeeAuth;
  let transferServer;
  let depositAsset = {};

  beforeAll(async () => {
    try {
      toml = await getTomlFile(url);
    } catch (e) {
      throw "Invalid TOML formatting";
    }

    transferServer = toml.TRANSFER_SERVER;
    const response = await fetch(transferServer + "/info", {
      headers: {
        Origin: "https://www.website.com",
      },
    });

    const json = await response.json();

    const depositCurrencies = Object.keys(json.deposit);

    depositAsset.code = depositCurrencies.find(
      (currency) => json.deposit[currency],
    );
    depositAsset.minAmount = json.deposit[depositAsset.code].min_amount;
    needFeeAuth = Boolean(json.fee.authentication_required);

    if (needFeeAuth) {
      ({ token: jwt } = await getSep10Token(url, keyPair));
    }
  });

  it("has CORS on the fee endpoint", async () => {
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      transferServer + "/fee",
    );

    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  it("returns error for request with no authorization header if fee_required", async () => {
    if (needFeeAuth) {
      let response = await fetch(transferServer + "/fee");
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(await response.json()).toEqual({
        type: "authentication_required",
      });
    }
  });

  it("returns a proper error schema for a non-params fee request", async () => {
    const headers = needFeeAuth
      ? { Authorization: `Bearer ${jwt}` }
      : { Origin: "https://www.website.com" };
    const response = await fetch(transferServer + "/fee", {
      headers: headers,
    });
    const json = await response.json();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(json).toMatchSchema(errorSchema);
  });

  it("returns a proper fee schema for deposit fee request", async () => {
    const paramString = `operation=deposit&asset_code=${depositAsset.code}&amount=${depositAsset.minAmount}`;
    const headers = needFeeAuth
      ? { Authorization: `Bearer ${jwt}` }
      : { Origin: "https://www.website.com" };
    const response = await fetch(transferServer + `/fee?${paramString}`, {
      headers,
    });

    const json = await response.json();
    expect(response.status).toEqual(200);
    expect(json).toMatchSchema(feeSchema);
  });
});
