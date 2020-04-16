import { fetch } from "./util/fetchShim";
import TOML from "toml";
import { currencySchema } from "./util/schema";
import { ensureCORS } from "./util/ensureCORS";

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();

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
      if (
        toml.NETWORK_PASSPHRASE ==
        "Public Global Stellar Network ; September 2015"
      ) {
        throw "The validator doesn't support mainnet testing";
      }
    });

    it("uses TRANSFER_SERVER_SEP0024", async () => {
      expect(toml.TRANSFER_SERVER_SEP0024).toBeTruthy();
    });

    it("has a max file size of 100kb", () => {
      expect(parseInt(fileSize)).not.toBeGreaterThan(100000);
    });

    it("has a network passphrase", () => {
      expect(toml.NETWORK_PASSPHRASE).toBeTruthy();
    });

    it("has a valid transfer server URL", () => {
      expect(() => new URL(toml.TRANSFER_SERVER)).not.toThrow();
    });

    it("all URLs are https", () => {
      expect(new URL(toml.TRANSFER_SERVER).protocol).toMatch("https:");
      expect(new URL(toml.TRANSFER_SERVER_SEP0024).protocol).toMatch("https:");
      expect(urlBuilder.protocol).toMatch("https:");
    });

    it("has currency section", () => {
      expect(toml.CURRENCIES).not.toBeNull();
    });

    it("currencies have the correct schema", () => {
      toml.CURRENCIES.forEach((currency) => {
        expect(currency).toMatchSchema(currencySchema);
      });
    });

    it("has issuer documentation", () => {
      expect(toml.DOCUMENTATION).toEqual(
        expect.objectContaining({
          ORG_NAME: expect.any(String),
          ORG_URL: expect.any(String),
        }),
      );
    });
  });
});
