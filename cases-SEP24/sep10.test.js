import JWT from "jsonwebtoken";
import StellarSDK from "stellar-sdk";
import friendbot from "../util/friendbot";
import getTomlFile from "../util/getTomlFile";
import {
  getSep10Token,
  createAccountsFrom,
  mergeAccountsTo,
} from "../util/sep10";
import { resubmitOnRecoverableFailure } from "../util/transactions";
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
let skip =
  process.env.MAINNET === "true" || process.env.MAINNET === "1" ? xit : it;
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
const server = new StellarSDK.Server(horizonURL);
let accountPool = [];

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
  if (process.env.MAINNET === "true" || process.env.MAINNET === "1") {
    let kps = [];
    for (let i = 0; i < 10; i++){
      let kp = StellarSDK.Keypair.random();
      process.stdout.write("Generated keypair "+kp.publicKey()+":"+kp.secret()+"\n");
      kps.push(kp);
    }
    masterAccount.data = await server.loadAccount(masterAccount.kp.publicKey());
    accountPool = await createAccountsFrom(
      masterAccount,
      kps,
      server,
      networkPassphrase,
    );
  } else {
    for (let i = 0; i < 10; i++) {
      let kp = StellarSDK.Keypair.random();
      process.stdout.write("Generated keypair "+kp.publicKey()+":"+kp.secret()+"\n");
      accountPool.push({ kp: kp, data: null });
    }
    await Promise.all(
      accountPool.map(async (acc) => {
        await friendbot(acc.kp);
        acc.data = await server.loadAccount(acc.kp.publicKey());
      }),
    );
  }
});

afterAll(async () => {
  if (!masterAccount.data) return;
  if (process.env.MAINNET === "true" || process.env.MAINNET === "1") {
    try {
      await mergeAccountsTo(
        masterAccount,
        accountPool,
        server,
        networkPassphrase,
      );
    } catch (e) {
      console.log(e);
    }
  }
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
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      toml.WEB_AUTH_ENDPOINT + "?account=" + account,
    );
    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  it("gives an error with no account provided", async () => {
    const { json, status, logs } = await loggableFetch(toml.WEB_AUTH_ENDPOINT);
    expect(json.error, logs).toBeTruthy();
  });

  it("gives an error with an invalid account provided", async () => {
    const { json, status, logs } = await loggableFetch(
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

    it("returns SEP-10 2.0+ challenge", async () => {
      expect(json.error, logs).toBeFalsy();
      expect(json.transaction, logs).toBeTruthy();
      const tx = new StellarSDK.Transaction(
        json.transaction,
        networkPassphrase,
      );
      expect(tx.operations, logs).toHaveLength(1);
      let operation = tx.operations[0];
      expect(operation.name, logs).toEqual(
        expect.stringContaining(urlBuilder.hostname),
      );
    });

    describe("POST Response", () => {
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
      //Done: revert https://github.com/stellar/transfer-server-validator/commit/2c3ddfeb4041449a4ca3f60411c3806a7b004965
      it("fails if the signed challenge isn't signed by the servers SIGNING_KEY", async () => {
        const tx = new StellarSDK.Transaction(
          json.transaction,
          networkPassphrase,
        );
        // Remove the server signature, and later only sign by client
        for (let i = 0; i < tx.signatures.length; i++) {
          tx.signatures.pop();
        }
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

  describe("signers support", () => {
    afterAll(async () => {
      await friendbot.destroyAllFriends();
    });

    it("succeeds for a signer without an account", async () => {
      const kp = StellarSDK.Keypair.random();
      const { token, logs } = await getSep10Token(url, kp, [kp]);
      expect(token).toBeTruthy();
    });

    it("fails if a challenge for a nonexistent account has extra client signatures", async () => {
      const account = getAccount();
      const kp = StellarSDK.Keypair.random();
      const { token, logs } = await getSep10Token(url, kp, [kp, account.kp]);
      expect(token, logs).toBeFalsy();
    });

    /**
     * Removing the masterWeight for an account means that it can
     * no longer sign for itself.  This should mean that it can't
     * get a token with its own signature.
     */
    skip("fails for an account that can't sign for itself", async () => {
      const account = getAccount();
      const tmpSigner = StellarSDK.Keypair.random();
      let builder = new StellarSDK.TransactionBuilder(account.data, {
        fee: StellarSDK.BASE_FEE * 5,
        networkPassphrase: networkPassphrase,
      })
        .addOperation(
          StellarSDK.Operation.setOptions({
            // Add a new signer so we can create a transaction to add the
            // original signer back after test.
            signer: {
              ed25519PublicKey: tmpSigner.publicKey(),
              weight: 1,
            },
            masterWeight: 0,
            lowThreshold: 1,
            medThreshold: 1,
            highThreshold: 1,
          }),
        )
        .setTimeout(30);
      let transaction = builder.build();
      transaction.sign(account.kp);
      try {
        await server.submitTransaction(transaction);
      } catch (e) {
        await resubmitOnRecoverableFailure(
          e.response.data,
          account.kp,
          [account.kp],
          builder,
          server,
        );
      }
      let token, logs;
      try {
        ({ token, logs } = await getSep10Token(url, account.kp, [account.kp]));
      } catch (e) {
        // We need to do cleanup so we can't let the test fail here.
        // The test expects 'token' to be falsy, so make it non-falsy
        token = logs =
          "an error occurred when attempting to retrieve SEP10 token";
      }
      // Add original signer back so the account can be merged, if using mainnet
      if (process.env.MAINNET === "true" || process.env.MAINNET === "1") {
        builder = new StellarSDK.TransactionBuilder(account.data, {
          fee: StellarSDK.BASE_FEE * 5,
          networkPassphrase: networkPassphrase,
        })
          .addOperation(
            StellarSDK.Operation.setOptions({
              masterWeight: 1,
            }),
          )
          .setTimeout(30);
        let addBackSignerTx = builder.build();
        addBackSignerTx.sign(tmpSigner);
        try {
          await server.submitTransaction(addBackSignerTx);
        } catch (e) {
          await resubmitOnRecoverableFailure(
            e.response.data,
            account.kp,
            [tmpSigner],
            builder,
            server,
          );
        }
      }
      expect(token, logs).toBeFalsy();
    });

    it("succeeds for a signer of an account", async () => {
      const userAccount = getAccount();
      const signerAccount = getAccount();
      let builder = new StellarSDK.TransactionBuilder(userAccount.data, {
        fee: StellarSDK.BASE_FEE * 5,
        networkPassphrase: networkPassphrase,
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
        .setTimeout(30);
      let transaction = builder.build();
      transaction.sign(userAccount.kp);
      try {
        await server.submitTransaction(transaction);
      } catch (e) {
        await resubmitOnRecoverableFailure(
          e.response.data,
          userAccount.kp,
          [userAccount.kp],
          builder,
          server,
        );
      }
      const { token, logs } = await getSep10Token(url, userAccount.kp, [
        signerAccount.kp,
      ]);
      expect(token, logs).toBeTruthy();
    });

    /**
     * In this test case, since we have a signer with only half the required
     * weight of the thresholds, a malicious actor might try to sign twice
     * with the same key hoping the server doesn't de-duplicate signers, and
     * count its weight twice.
     */
    it("fails when trying to reuse the same signer to gain weight", async () => {
      const userAccount = getAccount();
      const signerAccount = getAccount();
      let builder = new StellarSDK.TransactionBuilder(userAccount.data, {
        fee: StellarSDK.BASE_FEE * 5,
        networkPassphrase: networkPassphrase,
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
        .setTimeout(30);
      let transaction = builder.build();
      transaction.sign(userAccount.kp);
      try {
        await server.submitTransaction(transaction);
      } catch (e) {
        await resubmitOnRecoverableFailure(
          e.response.data,
          userAccount.kp,
          [userAccount.kp],
          builder,
          server,
        );
      }
      let token, logs;
      try {
        ({ token, logs } = await getSep10Token(url, userAccount.kp, [
          signerAccount.kp,
          signerAccount.kp,
        ]));
      } catch (e) {
        // we need to do cleanup, but token and logs must be truthy to make
        // sure test fails when an exception is raised here.
        token = logs =
          "an error occurred when attempting to retrieve SEP10 token";
      }
      // Reduce thresholds back to 1 so master signer can sign alone again
      if (process.env.MAINNET === "true" || process.env.MAINNET === "1") {
        builder = new StellarSDK.TransactionBuilder(userAccount.data, {
          fee: StellarSDK.BASE_FEE * 5,
          networkPassphrase: networkPassphrase,
        })
          .addOperation(
            StellarSDK.Operation.setOptions({
              lowThreshold: 1,
              medThreshold: 1,
              highThreshold: 1,
            }),
          )
          .setTimeout(30);
        let lowerThresholdsTx = builder.build();
        // Need both signatures to reach current threshold
        lowerThresholdsTx.sign(signerAccount.kp, userAccount.kp);
        try {
          await server.submitTransaction(lowerThresholdsTx);
        } catch (e) {
          await resubmitOnRecoverableFailure(
            e.response.data,
            userAccount.kp,
            [userAccount.kp, signerAccount.kp],
            builder,
            server,
          );
        }
      }
      expect(token, logs).toBeFalsy();
    });

    it("succeeds with multiple signers", async () => {
      const userAccount = getAccount();
      const signerAccount1 = getAccount();
      const signerAccount2 = getAccount();
      let builder = new StellarSDK.TransactionBuilder(userAccount.data, {
        fee: StellarSDK.BASE_FEE * 5,
        networkPassphrase: networkPassphrase,
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
        .setTimeout(30);
      let transaction = builder.build();
      transaction.sign(userAccount.kp);
      try {
        await server.submitTransaction(transaction);
      } catch (e) {
        await resubmitOnRecoverableFailure(
          e.response.data,
          userAccount.kp,
          [userAccount.kp],
          builder,
          server,
        );
      }
      let token, logs;
      try {
        ({ token, logs } = await getSep10Token(url, userAccount.kp, [
          signerAccount1.kp,
          signerAccount2.kp,
        ]));
      } catch (e) {
        // Let execution continue to do cleanup. If an exception is raised here
        // token and logs will be falsy, ensuring the test fails.
      }
      // Reduce thresholds back to 1 so master signer can sign alone again
      if (process.env.MAINNET === "true" || process.env.MAINNET === "1") {
        let builder = new StellarSDK.TransactionBuilder(userAccount.data, {
          fee: StellarSDK.BASE_FEE * 5,
          networkPassphrase: networkPassphrase,
        })
          .addOperation(
            StellarSDK.Operation.setOptions({
              lowThreshold: 1,
              medThreshold: 1,
              highThreshold: 1,
            }),
          )
          .setTimeout(30);
        let lowerThresholdsTx = builder.build();
        // Need two signatures to reach current threshold
        lowerThresholdsTx.sign(signerAccount1.kp, userAccount.kp);
        try {
          await server.submitTransaction(lowerThresholdsTx);
        } catch (e) {
          await resubmitOnRecoverableFailure(
            e.response.data,
            userAccount.kp,
            [userAccount.kp, signerAccount1.kp],
            builder,
            server,
          );
        }
      }
      expect(token, logs).toBeTruthy();
    });
  });
});
