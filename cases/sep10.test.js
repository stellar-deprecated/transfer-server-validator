import { fetch } from "../util";
import JWT from "jsonwebtoken";
import TOML from "toml";
import StellarSDK from "stellar-sdk";

const url = process.env.DOMAIN;
const account = "GCQJX6WGG7SSFU2RBO5QANTFXY7C5GTTFJDCBAAO42JCCFIMZ7PEBURP";
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);

describe("SEP10", () => {
  let toml;
  beforeAll(async () => {
    const response = await fetch(url + "/.well-known/stellar.toml");
    const text = await response.text();
    try {
      toml = TOML.parse(text);
    } catch (e) {
      throw "Invalid TOML formatting";
    }
  });

  it("has a valid WEB_AUTH_ENDPOINT in the TOML", () => {
    expect(toml.WEB_AUTH_ENDPOINT).toBeTruthy();
    const url = new URL(toml.WEB_AUTH_ENDPOINT);
    expect(url.protocol).toBe("https:");
  });

  it("has a signing key in the TOML", () => {
    expect(toml.SIGNING_KEY).toHaveLength(56);
  });

  it("has CORS on the auth endpoint", async () => {
    const response = await fetch(
      toml.WEB_AUTH_ENDPOINT + "?account=" + account,
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://www.website.com"
        }
      }
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("gives an error with no account provided", async () => {
    const response = await fetch(toml.WEB_AUTH_ENDPOINT);
    const json = await response.json();
    expect(json.error).toBeTruthy();
  });

  it("gives an error with an invalid account provided", async () => {
    const response = await fetch(
      toml.WEB_AUTH_ENDPOINT + "?account=GINVALIDACCOUNT"
    );
    const json = await response.json();
    expect(json.error).toBeTruthy();
  });

  describe("GET Challenge", () => {
    let json;
    beforeAll(async () => {
      const response = await fetch(
        toml.WEB_AUTH_ENDPOINT + "?account=" + account
      );
      json = await response.json();
    });

    it("gives a network passphrase", () => {
      expect(json.network_passphrase).toBeTruthy();
    });

    it("gives a valid challenge transaction", async () => {
      expect(json.error).toBeFalsy();
      expect(json.transaction).toBeTruthy();
      const tx = new StellarSDK.Transaction(
        json.transaction,
        json.network_passphrase
      );

      expect(tx.sequence).toBe("0");
      // TODO validate timeBounds
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0].type).toBe("manageData");
      expect(tx.operations[0].source).toBe(account);
      expect(tx.source).toBe(toml.SIGNING_KEY);
    });

    describe("POST Response", () => {
      it("Accepts application/x-www-form-urlencoded", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          json.network_passphrase
        );
        tx.sign(keyPair);
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: "transaction=" + tx.toXDR()
        });
        let tokenJson = await resp.json();
        expect(tokenJson.error).toBeFalsy();
        expect(tokenJson.token).toBeTruthy();
      });

      it("fails if no transaction is posted in the body", async () => {
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        });
        expect(resp.status).not.toBe(200);
        let json = await resp.json();
        expect(json.error).toBeTruthy();
        expect(json.token).toBeFalsy();
      });

      it("fails if the client doesn't sign the challenge", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          json.network_passphrase
        );
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ transaction: tx.toXDR() })
        });
        expect(resp.status).not.toBe(200);
        let tokenJson = await resp.json();
        expect(tokenJson.error).toBeTruthy();
      });

      it("fails if the signed challenge isn't signed by the servers SIGNING_KEY", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          json.network_passphrase
        );
        // Remove the server signature, only sign by client
        tx.signatures = [];
        tx.sign(keyPair);
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ transaction: tx.toXDR() })
        });
        expect(resp.status).not.toBe(200);
        let tokenJson = await resp.json();
        expect(tokenJson.error).toBeTruthy();
      });

      let token;
      beforeAll(async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          json.network_passphrase
        );
        tx.sign(keyPair);
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ transaction: tx.toXDR() })
        });
        let tokenJson = await resp.json();
        token = tokenJson.token;
      });

      it("Has a valid token", () => {
        const jwt = JWT.decode(token);
        expect(jwt).toBeTruthy();
        expect(jwt).toEqual(
          expect.objectContaining({
            iss: expect.any(String),
            sub: account,
            iat: expect.any(Number),
            exp: expect.any(Number)
          })
        );
      });
    });
  });
});
