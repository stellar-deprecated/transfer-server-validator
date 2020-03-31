import { fetch } from "./util/fetchShim";
import JWT from "jsonwebtoken";
import StellarSDK from "stellar-sdk";
import friendbot from "./util/friendbot";
import getTomlFile from "./util/getTomlFile";
import getSep10Token from "./util/sep10";
import { ensureCORS } from "./util/ensureCORS";

jest.setTimeout(100000);
const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const account = "GCQJX6WGG7SSFU2RBO5QANTFXY7C5GTTFJDCBAAO42JCCFIMZ7PEBURP";
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);
const server = new StellarSDK.Server("https://horizon-testnet.stellar.org");
const accountPool = [];

const getAccount = (function() {
  let accountPoolIdx = 0;
  return (_) => {
    try {
      return accountPool[accountPoolIdx++];
    } catch {
      throw "Not enough accounts!";
    }
  };
})();

beforeAll(async () => {
  for (let i = 0; i < 9; i++) {
    accountPool.push({ kp: StellarSDK.Keypair.random(), data: null });
  }
  await Promise.all(
    accountPool.map(async (acc) => {
      await friendbot(acc.kp);
      acc.data = await server.loadAccount(acc.kp.publicKey());
    }),
  );
});

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
    const { optionsCORS, getCORS, logs } = await ensureCORS(
      toml.WEB_AUTH_ENDPOINT + "?account=" + account,
    );
    expect(optionsCORS, logs).toBe("*");
    expect(getCORS, logs).toBe("*");
  });

  it("gives an error with no account provided", async () => {
    const response = await fetch(toml.WEB_AUTH_ENDPOINT);
    const json = await response.json();
    expect(json.error).toBeTruthy();
  });

  it("gives an error with an invalid account provided", async () => {
    const response = await fetch(
      toml.WEB_AUTH_ENDPOINT + "?account=GINVALIDACCOUNT",
    );
    const json = await response.json();
    expect(json.error).toBeTruthy();
  });

  it("works for an unfunded account", async () => {
    const unfundedKeypair = StellarSDK.Keypair.random();
    const json = await fetch(
      toml.WEB_AUTH_ENDPOINT + "?account=" + unfundedKeypair.publicKey(),
    ).then((r) => r.json());
    const tx = new StellarSDK.Transaction(
      json.transaction,
      toml.NETWORK_PASSPHRASE || StellarSDK.Networks.TESTNET,
    );
    tx.sign(unfundedKeypair);
    let tokenJson = await fetch(toml.WEB_AUTH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction: tx.toXDR() }),
    }).then((r) => r.json());
    expect(tokenJson.error).toBeFalsy();
    expect(tokenJson.token).toBeTruthy();
  });

  describe("GET Challenge", () => {
    let json;
    let network_passphrase;
    beforeAll(async () => {
      network_passphrase =
        toml.NETWORK_PASSPHRASE || StellarSDK.Networks.TESTNET;
      const response = await fetch(
        toml.WEB_AUTH_ENDPOINT + "?account=" + account,
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
        network_passphrase,
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
          network_passphrase,
        );
        tx.sign(keyPair);
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "transaction=" + encodeURIComponent(tx.toXDR()),
        });
        let tokenJson = await resp.json();
        expect(tokenJson.error).toBeFalsy();
        expect(tokenJson.token).toBeTruthy();
      });

      it("fails if no transaction is posted in the body", async () => {
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        expect(resp.status).not.toBe(200);
        let json = await resp.json();
        expect(json.error).toBeTruthy();
        expect(json.token).toBeFalsy();
      });

      it("fails if the client doesn't sign the challenge", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          network_passphrase,
        );
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transaction: tx.toXDR() }),
        });
        expect(resp.status).not.toBe(200);
        let tokenJson = await resp.json();
        expect(tokenJson.error).toBeTruthy();
      });

      it("fails if the signed challenge isn't signed by the servers SIGNING_KEY", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          network_passphrase,
        );
        // Remove the server signature, only sign by client
        tx.signatures = [];
        tx.sign(keyPair);
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transaction: tx.toXDR() }),
        });
        expect(resp.status).not.toBe(200);
        let tokenJson = await resp.json();
        expect(tokenJson.error).toBeTruthy();
      });

      let token;
      beforeAll(async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          network_passphrase,
        );
        tx.sign(keyPair);
        let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transaction: tx.toXDR() }),
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
            exp: expect.any(Number),
          }),
        );
      });
    });
  });

  describe("signers support", () => {
    afterAll(async () => {
      await friendbot.destroyAllFriends();
    });

    /**
     * Removing the masterWeight for an account means that it can
     * no longer sign for itself.  This should mean that it can't
     * get a token with its own signature.
     */
    it("fails for an account that can't sign for itself", async () => {
      const account = getAccount({ with_data: true });
      const transaction = new StellarSDK.TransactionBuilder(account.data, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            masterWeight: 0,
            lowThreshold: 1,
            medThreshold: 1,
            highThreshold: 1,
          }),
        )
        .setTimeout(30)
        .build();
      transaction.sign(account.kp);
      await server.submitTransaction(transaction);
      const token = await getSep10Token(url, account.kp, [account.kp]);
      expect(token).toBeFalsy();
    });

    it("succeeds for a signer of an account", async () => {
      const userAccount = getAccount({ with_data: true });
      const signerAccount = getAccount();
      const transaction = new StellarSDK.TransactionBuilder(userAccount.data, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            lowThreshold: 1,
            medThreshold: 1,
            highThreshold: 1,
            signer: {
              ed25519PublicKey: signerAccount.kp.publicKey(),
              weight: 1,
            },
          }),
        )
        .setTimeout(30)
        .build();
      transaction.sign(userAccount.kp);
      await server.submitTransaction(transaction);
      const token = await getSep10Token(url, userAccount.kp, [
        signerAccount.kp,
      ]);
      expect(token).toBeTruthy();
    });

    /**
     * In this test case, since we have a signer with only half the required
     * weight of the thresholds, a malicious actor might try to sign twice
     * with the same key hoping the server doesn't de-duplicate signers, and
     * count its weight twice.
     */
    it("fails when trying to reuse the same signer to gain weight", async () => {
      const userAccount = getAccount({ with_data: true });
      const signerAccount = getAccount();
      const transaction = new StellarSDK.TransactionBuilder(userAccount.data, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            lowThreshold: 2,
            medThreshold: 2,
            highThreshold: 2,
            signer: {
              ed25519PublicKey: signerAccount.kp.publicKey(),
              weight: 1,
            },
          }),
        )
        .setTimeout(30)
        .build();
      transaction.sign(userAccount.kp);
      await server.submitTransaction(transaction);
      const token = await getSep10Token(url, userAccount.kp, [
        signerAccount.kp,
        signerAccount.kp,
      ]);
      expect(token).toBeFalsy();
    });

    it("succeeds with multiple signers", async () => {
      const userAccount = getAccount({ with_data: true });
      const signerAccount1 = getAccount();
      const signerAccount2 = getAccount();
      const transaction = new StellarSDK.TransactionBuilder(userAccount.data, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            lowThreshold: 2,
            medThreshold: 2,
            highThreshold: 2,
            signer: {
              ed25519PublicKey: signerAccount1.kp.publicKey(),
              weight: 1,
            },
          }),
        )
        .addOperation(
          StellarSDK.Operation.setOptions({
            signer: {
              ed25519PublicKey: signerAccount2.kp.publicKey(),
              weight: 1,
            },
          }),
        )
        .setTimeout(30)
        .build();
      transaction.sign(userAccount.kp);
      await server.submitTransaction(transaction);
      const token = await getSep10Token(url, userAccount.kp, [
        signerAccount1.kp,
        signerAccount2.kp,
      ]);
      expect(token).toBeTruthy();
    });
  });
});
