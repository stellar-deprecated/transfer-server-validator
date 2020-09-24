import TOML from "toml";
import StellarSDK from "stellar-sdk";
import { fetch } from "../util/fetchShim";
import { ensureCORS } from "../util/ensureCORS";
import { loggableFetch } from "../util/loggableFetcher";
const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
let horizonURL;
if (process.env.MAINNET === "true" || process.env.MAINNET === "1") {
  horizonURL = "https://horizon.stellar.org";
} else {
  horizonURL = "https://horizon-testnet.stellar.org";
}
const server = new StellarSDK.Server(horizonURL);
jest.setTimeout(100000);

describe("TOML File", () => {
  it("exists", async () => {
    const response = await fetch(url + ".well-known/stellar.toml");
    expect(response.status).toBe(200);
  });

  it("has correct content-type", async () => {
    const response = await fetch(url + ".well-known/stellar.toml");
    expect(response.headers.get("content-type")).toEqual(
      expect.stringContaining("text/plain"),
    );
  });

  it("has cors", async () => {
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      url + ".well-known/stellar.toml",
    );
    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  describe("fields", () => {
    let toml;
    let fileSize;
    beforeAll(async () => {
      const response = await fetch(url + ".well-known/stellar.toml");
      fileSize = response.headers.get("content-length");
      const text = await response.text();
      try {
        toml = TOML.parse(text);
      } catch (e) {
        throw "Invalid TOML formatting";
      }
    });

    it("is valid format", () => {
      expect(toml).not.toBeFalsy();
    });

    it("has a max file size of 100kb", () => {
      expect(parseInt(fileSize)).not.toBeGreaterThan(100000);
    });

    it("has a network passphrase", () => {
      expect(toml.NETWORK_PASSPHRASE).toBeTruthy();
    });

    it("has a valid SEND_SERVER_API URL", () => {
      expect(() => new URL(toml.DIRECT_PAYMENT_SERVER)).not.toThrow();
    });

    it("all URLs are https", () => {
      expect(new URL(toml.DIRECT_PAYMENT_SERVER).protocol).toMatch("https:");
      expect(urlBuilder.protocol).toMatch("https:");
    });

    it("has no URLs ending in a slash", () => {
      expect(
        toml.DIRECT_PAYMENT_SERVER[toml.DIRECT_PAYMENT_SERVER.length - 1] !==
          "/",
      ).toBeTruthy();
    });

    it("has home_domain set in the issuer account", async () => {
      let json;
      try {
        json = await server.loadAccount(toml.CURRENCIES[0].issuer);
      } catch (e) {
        throw e;
      }
      expect(url).toEqual(expect.stringContaining(json.home_domain));
    });
  });
});
