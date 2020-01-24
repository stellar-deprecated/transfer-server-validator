import { fetch } from "./util/fetchShim";
import JWT from "jsonwebtoken";
import TOML from "toml";
import StellarSDK from "stellar-sdk";
import { createAccount, cleanupAccountCreator } from "./util/accountCreator";
import getSep10Token from "./util/sep10";

const url = process.env.DOMAIN;
const account = "GCQJX6WGG7SSFU2RBO5QANTFXY7C5GTTFJDCBAAO42JCCFIMZ7PEBURP";
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);

const server = new StellarSDK.Server("https://horizon-testnet.stellar.org");
jest.setTimeout(100000);
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

  describe("signers support", () => {
    afterAll(async () => {
      await cleanupAccountCreator();
    });
    it("fails for an account that can't sign for itself", async () => {
      const accountA = StellarSDK.Keypair.random();
      await createAccount(accountA);
      const accountData = await server.loadAccount(accountA.publicKey());
      const transaction = new StellarSDK.TransactionBuilder(accountData, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            masterWeight: 0
          })
        )
        .setTimeout(30)
        .build();
      transaction.sign(accountA);
      await server.submitTransaction(transaction);
      const token = await getSep10Token(url, accountA, [accountA]);
      expect(token).toBeFalsy();
    });

    it("succeeds for a signer of an account", async () => {
      const userAccount = StellarSDK.Keypair.random();
      const signerAccount = StellarSDK.Keypair.random();
      await Promise.all([
        createAccount(userAccount),
        createAccount(signerAccount)
      ]);
      const accountData = await server.loadAccount(userAccount.publicKey());
      const transaction = new StellarSDK.TransactionBuilder(accountData, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            lowThreshold: 1,
            medThreshold: 1,
            highThreshold: 1,
            signer: {
              ed25519PublicKey: signerAccount.publicKey(),
              weight: 1
            }
          })
        )
        .setTimeout(30)
        .build();
      transaction.sign(userAccount);
      await server.submitTransaction(transaction);
      const token = await getSep10Token(url, userAccount, [signerAccount]);
      expect(token).toBeTruthy();
    });

    /**
     * In this test case, since we have a signer with only half the required
     * weight of the thresholds, a malicious actor might try to sign twice
     * with the same key hoping the server doesn't de-duplicate signers, and
     * count its weight twice.
     */
    it("fails when trying to reuse the same signer to gain weight", async () => {
      const userAccount = StellarSDK.Keypair.random();
      const signerAccount = StellarSDK.Keypair.random();
      await Promise.all([
        createAccount(userAccount),
        createAccount(signerAccount)
      ]);
      const accountData = await server.loadAccount(userAccount.publicKey());
      const transaction = new StellarSDK.TransactionBuilder(accountData, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            lowThreshold: 2,
            medThreshold: 2,
            highThreshold: 2,
            signer: {
              ed25519PublicKey: signerAccount.publicKey(),
              weight: 1
            }
          })
        )
        .setTimeout(30)
        .build();
      transaction.sign(userAccount);
      await server.submitTransaction(transaction);
      const token = await getSep10Token(url, userAccount, [
        signerAccount,
        signerAccount
      ]);
      expect(token).toBeFalsy();
    });

    it("succeeds with multiple signers", async () => {
      const userAccount = StellarSDK.Keypair.random();
      const signerAccount1 = StellarSDK.Keypair.random();
      const signerAccount2 = StellarSDK.Keypair.random();
      await Promise.all([
        createAccount(userAccount),
        createAccount(signerAccount1),
        createAccount(signerAccount2)
      ]);
      const accountData = await server.loadAccount(userAccount.publicKey());
      const transaction = new StellarSDK.TransactionBuilder(accountData, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            lowThreshold: 2,
            medThreshold: 2,
            highThreshold: 2,
            signer: {
              ed25519PublicKey: signerAccount1.publicKey(),
              weight: 1
            }
          })
        )
        .addOperation(
          StellarSDK.Operation.setOptions({
            signer: {
              ed25519PublicKey: signerAccount2.publicKey(),
              weight: 1
            }
          })
        )
        .setTimeout(30)
        .build();
      transaction.sign(userAccount);
      await server.submitTransaction(transaction);
      const token = await getSep10Token(url, userAccount, [
        signerAccount1,
        signerAccount2
      ]);
      expect(token).toBeTruthy();
    });
  });
});
