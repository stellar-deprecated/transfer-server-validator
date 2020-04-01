import { loggableFetch } from "./util/loggableFetcher";
import TOML from "toml";
import { currencySchema } from "./util/schema";
import { ensureCORS } from "./util/ensureCORS";

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();

describe("TOML File", () => {
  it("exists", async () => {
    const { status, logs } = await loggableFetch(
      url + ".well-known/stellar.toml",
      {},
      false,
    );
    expect(status, logs).toBe(200);
  });

  it("has correct content-type", async () => {
    const { response, logs } = await loggableFetch(
      url + ".well-known/stellar.toml",
      {},
      false,
    );
    expect(response.headers.get("content-type"), logs).toEqual(
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
    let logs;
    beforeAll(async () => {
      const { response, json: text, logs: outputLogs } = await loggableFetch(
        url + ".well-known/stellar.toml",
        {},
        false,
      );
      logs = outputLogs;

      fileSize = response.headers.get("content-length");
      try {
        toml = TOML.parse(text);
      } catch (e) {
        throw "Invalid TOML formatting";
      }
    });

    it("uses TRANSFER_SERVER_SEP0024", async () => {
      expect(toml.TRANSFER_SERVER_SEP0024, logs).toBeTruthy();
    });

    it("has a max file size of 100kb", () => {
      expect(parseInt(fileSize), logs).not.toBeGreaterThan(100000);
    });

    it("has a network passphrase", () => {
      expect(toml.NETWORK_PASSPHRASE, logs).toBeTruthy();
    });

    it("has a valid transfer server URL", () => {
      expect(() => new URL(toml.TRANSFER_SERVER), logs).not.toThrow();
    });

    it("all URLs are https", () => {
      expect(new URL(toml.TRANSFER_SERVER).protocol, logs).toMatch("https:");
      expect(new URL(toml.TRANSFER_SERVER_SEP0024).protocol, logs).toMatch(
        "https:",
      );
      expect(urlBuilder.protocol, logs).toMatch("https:");
    });

    it("has currency section", () => {
      expect(toml.CURRENCIES, logs).not.toBeNull();
    });

    it("currencies have the correct schema", () => {
      toml.CURRENCIES.forEach((currency) => {
        expect(currency, logs).toMatchSchema(currencySchema);
      });
    });

    it("has issuer documentation", () => {
      expect(toml.DOCUMENTATION, logs).toEqual(
        expect.objectContaining({
          ORG_NAME: expect.any(String),
          ORG_URL: expect.any(String),
        }),
      );
    });
  });
});
