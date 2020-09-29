import JWT from "jsonwebtoken";
import StellarSDK from "stellar-sdk";
import getTomlFile from "../util/getTomlFile";
import { ensureCORS } from "../util/ensureCORS";
import { loggableFetch } from "../util/loggableFetcher";

jest.setTimeout(100000);
const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const account = "GCQJX6WGG7SSFU2RBO5QANTFXY7C5GTTFJDCBAAO42JCCFIMZ7PEBURP";
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);
let horizonURL;
let masterAccount = {};
let networkPassphrase;
if (process.env.MAINNET === "true" || process.env.MAINNET === "1") {
  masterAccount.kp = StellarSDK.Keypair.fromSecret(
    process.env.MAINNET_MASTER_SECRET_KEY,
  );
  horizonURL = "https://horizon.stellar.org";
  networkPassphrase = StellarSDK.Networks.PUBLIC;
} else {
  horizonURL = "https://horizon-testnet.stellar.org";
  networkPassphrase = StellarSDK.Networks.TESTNET;
}

describe("SEP10", () => {
  let toml;
  beforeAll(async () => {
    try {
      toml = await getTomlFile(url);
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
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      toml.WEB_AUTH_ENDPOINT + "?account=" + account,
    );
    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  it("gives an error with no account provided", async () => {
    const { json, logs } = await loggableFetch(toml.WEB_AUTH_ENDPOINT);
    expect(json.error, logs).toBeTruthy();
  });

  it("gives an error with an invalid account provided", async () => {
    const { json, logs } = await loggableFetch(
      toml.WEB_AUTH_ENDPOINT + "?account=GINVALIDACCOUNT",
    );
    expect(json.error, logs).toBeTruthy();
  });

  it("works for an unfunded account", async () => {
    const unfundedKeypair = StellarSDK.Keypair.random();
    const { json, logs } = await loggableFetch(
      toml.WEB_AUTH_ENDPOINT + "?account=" + unfundedKeypair.publicKey(),
    );
    expect(
      json.error,
      "Received an error trying to fetch a SEP10 challenge" + logs,
    ).toBeFalsy();
    const tx = new StellarSDK.Transaction(
      json.transaction,
      toml.NETWORK_PASSPHRASE || networkPassphrase,
    );
    tx.sign(unfundedKeypair);
    const { json: tokenJson, logs: tokenLogs } = await loggableFetch(
      toml.WEB_AUTH_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transaction: tx.toXDR() }),
      },
    );
    expect(tokenJson.error, tokenLogs).toBeFalsy();
    expect(tokenJson.token, tokenLogs).toBeTruthy();
  });

  describe("GET Challenge", () => {
    let json;
    let logs;
    beforeAll(async () => {
      ({ json, logs } = await loggableFetch(
        toml.WEB_AUTH_ENDPOINT + "?account=" + account,
      ));
    });

    it("gives a valid challenge transaction", async () => {
      expect(json.error, logs).toBeFalsy();
      expect(json.transaction, logs).toBeTruthy();
      const tx = new StellarSDK.Transaction(
        json.transaction,
        networkPassphrase,
      );

      expect(tx.sequence, logs).toBe("0");
      // TODO validate timeBounds
      expect(tx.operations, logs).toHaveLength(1);
      expect(tx.operations[0].type, logs).toBe("manageData");
      expect(tx.operations[0].source, logs).toBe(account);
      expect(tx.source, logs).toBe(toml.SIGNING_KEY);
    });

    it("returns SEP-10 2.0 challenge", async () => {
      expect(json.error, logs).toBeFalsy();
      expect(json.transaction, logs).toBeTruthy();
      const tx = new StellarSDK.Transaction(
        json.transaction,
        networkPassphrase,
      );
      expect(tx.operations, logs).toHaveLength(1);
      const expectedDomain = url
        .replace(/(^\w+:|^\/$)\/\//, "")
        .replace(/(\/.*?$)/, "");
      expect(tx.operations[0].name, logs).toEqual(
        expect.stringContaining(expectedDomain),
      );
    });

    describe("POST Response", () => {
      let tokenJson;
      let logs;
      beforeAll(async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          networkPassphrase,
        );
        tx.sign(keyPair);
        ({ json: tokenJson, logs } = await loggableFetch(
          toml.WEB_AUTH_ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ transaction: tx.toXDR() }),
          },
        ));
      });

      it("Accepts application/x-www-form-urlencoded", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          networkPassphrase,
        );
        tx.sign(keyPair);
        let { json: tokenJson, logs } = await loggableFetch(
          toml.WEB_AUTH_ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "transaction=" + encodeURIComponent(tx.toXDR()),
          },
        );
        expect(tokenJson.error, logs).toBeFalsy();
        expect(tokenJson.token, logs).toBeTruthy();
      });

      it("fails if no transaction is posted in the body", async () => {
        let { json, status, logs } = await loggableFetch(
          toml.WEB_AUTH_ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
        expect(status, logs).not.toBe(200);
        expect(json.error, logs).toBeTruthy();
        expect(json.token, logs).toBeFalsy();
      });

      it("fails if the client doesn't sign the challenge", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          networkPassphrase,
        );
        let { json: tokenJson, status, logs } = await loggableFetch(
          toml.WEB_AUTH_ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ transaction: tx.toXDR() }),
          },
        );
        expect(status, logs).not.toBe(200);
        expect(tokenJson.error, logs).toBeTruthy();
      });

      it.skip("fails if the signed challenge isn't signed by the servers SIGNING_KEY", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          networkPassphrase,
        );
        // Remove the server signature, only sign by client
        tx.signatures = [];
        tx.sign(keyPair);
        let { json: tokenJson, status, logs } = await loggableFetch(
          toml.WEB_AUTH_ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ transaction: tx.toXDR() }),
          },
        );
        expect(status, logs).not.toBe(200);
        expect(tokenJson.error, logs).toBeTruthy();
      });

      it("Has a valid token", () => {
        const jwt = JWT.decode(tokenJson.token);
        expect(jwt, logs).toBeTruthy();
        expect(jwt, logs).toEqual(
          expect.objectContaining({
            iss: expect.any(String),
            sub: account,
            iat: expect.any(Number),
            exp: expect.any(Number),
          }),
        );
      });
    });
  });
});
