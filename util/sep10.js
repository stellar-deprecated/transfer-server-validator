import StellarSDK from "stellar-sdk";
import { loggableFetch } from "./loggableFetcher";
import getTomlFile from "./getTomlFile";
import { resubmitOnRecoverableFailure } from "./transactions";

export async function getSep10Token(domain, keyPair, signers) {
  if (!signers) signers = [keyPair];
  const toml = await getTomlFile(domain);
  let { json, logs } = await loggableFetch(
    toml.WEB_AUTH_ENDPOINT + "?account=" + keyPair.publicKey(),
  );
  const network_passphrase =
    toml.NETWORK_PASSPHRASE || StellarSDK.Networks.TESTNET;
  let tx;
  expect(() => {
    tx = new StellarSDK.Transaction(json.transaction, network_passphrase);
  }, `This test needs a valid SEP10 token but can't build the returned challenge: "${json.transaction}" and error: "${json.error}"` + logs).not.toThrow();
  signers.forEach((keyPair) => {
    tx.sign(keyPair);
  });
  ({ json, logs } = await loggableFetch(toml.WEB_AUTH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  }));
  return { token: json.token, logs };
}

export async function createAccountsFrom(
  masterAccount,
  keypairs,
  server,
  networkPassphrase,
) {
  const builder = new StellarSDK.TransactionBuilder(masterAccount.data, {
    fee: StellarSDK.BASE_FEE * keypairs.length * 5, // 5X base fee
    networkPassphrase: networkPassphrase,
  });
  let accounts = [];
  try {
    for (let kp of keypairs) {
      let createAccountOp = StellarSDK.Operation.createAccount({
        destination: kp.publicKey(),
        startingBalance: "4",
      });
      builder.addOperation(createAccountOp);
      accounts.push({ kp: kp, data: null });
    }
    let tx = builder.setTimeout(30).build();
    tx.sign(masterAccount.kp);
    let response;
    try {
      response = await server.submitTransaction(tx);
    } catch (e) {
      response = await resubmitOnRecoverableFailure(
        e.response.data,
        masterAccount.kp,
        keypairs,
        builder,
        server,
      );
    }
    if (!response.successful) {
      throw {
        error: "Something went wrong when creating accounts on mainnet",
        data: response,
      };
    }
    await Promise.all(
      accounts.map(async (acc) => {
        acc.data = await server.loadAccount(acc.kp.publicKey());
      }),
    );
  } catch (e) {
    try {
      await mergeAccountsTo(masterAccount, accounts, server, networkPassphrase);
    } catch (e) {
      throw {
        error:
          "An exception was raised when attempting to create accounts, but merging accounts also failed",
        data: e.data,
      };
    }
    throw e;
  }
  return accounts;
}

export async function mergeAccountsTo(
  masterAccount,
  accounts,
  server,
  networkPassphrase,
) {
  const builder = new StellarSDK.TransactionBuilder(masterAccount.data, {
    fee: StellarSDK.BASE_FEE * accounts.length * 5, // 5X base fee
    networkPassphrase: networkPassphrase,
  });
  for (let accountObj of accounts) {
    if (!accountObj.data) continue;
    builder.addOperation(
      StellarSDK.Operation.accountMerge({
        destination: masterAccount.kp.publicKey(),
        source: accountObj.kp.publicKey(),
      }),
    );
  }
  if (!builder.operations.length) return;
  let tx = builder.setTimeout(30).build();
  tx.sign(masterAccount.kp, ...accounts.map((acc) => acc.kp));
  let response;
  try {
    response = await server.submitTransaction(tx);
  } catch (e) {
    response = await resubmitOnRecoverableFailure(
      e.response.data,
      masterAccount.kp,
      accounts.map((acc) => acc.kp),
      builder,
      server,
    );
  }
  if (!response.successful) {
    throw {
      message: `Unable to merge accounts back to master account: ${response.status}, ${response.result_xdr}`,
      data: accounts.map((acc) => acc.kp.secret()),
    };
  }
}
