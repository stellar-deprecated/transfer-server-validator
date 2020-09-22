import { fetch } from "../util/fetchShim";
import getTomlFile from "../util/getTomlFile";
import { infoSchema } from "./util/schema";
import { ensureCORS } from "../util/ensureCORS";
import { getSep10Token } from "../util/sep10";
import StellarSDK from "stellar-sdk";
import { loggableFetch } from "../util/loggableFetcher";

jest.setTimeout(30000);

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);

describe("Info", () => {
  let toml;
  let transferServer;
  beforeAll(async () => {
    try {
      toml = await getTomlFile(url);
    } catch (e) {
      throw "Invalid TOML formatting";
    }
  });

  it("has a TRANSFER_SERVER url in the toml", () => {
    transferServer = toml.TRANSFER_SERVER;
    expect(transferServer).toEqual(expect.stringContaining("http"));
    expect(() => new URL(transferServer)).not.toThrow();
  });

  it("has CORS on the info endpoint", async () => {
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      transferServer + "/info",
    );
    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  it("has home_domain set in the issuer account", async () => {
    const horizonUrl = "https://horizon-testnet.stellar.org";
    const url = horizonUrl + `/accounts/${toml.CURRENCIES[0].issuer}`;
    const { json, status, logs } = await loggableFetch(url);
    console.log(json);
  });

  describe("happy path", () => {
    let json;

    beforeAll(async () => {
      const response = await fetch(transferServer + "/info", {
        headers: {
          Origin: "https://www.website.com",
        },
      });
      expect(response.status).toEqual(200);
      expect(response.headers.get("content-type")).toEqual(
        expect.stringContaining("application/json"),
      );
      json = await response.json();
      expect(json).toBeTruthy();
    });

    it("has a proper schema", () => {
      expect(json).toMatchSchema(infoSchema);
    });
  });
});
