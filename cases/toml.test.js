import { fetch } from "./util/fetchShim";
import TOML from "toml";

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
    const response = await fetch(url + ".well-known/stellar.toml", {
      method: "OPTIONS",
      headers: {
        Origin: "https://test.com",
      },
    });
    expect(
      response.headers.get("access-control-allow-origin"),
      "access-control-allow-origin response header for toml file should be set to *",
    ).toBe("*");
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
