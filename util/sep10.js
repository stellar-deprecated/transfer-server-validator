import StellarSDK from "stellar-sdk";
import { loggableFetch } from "./loggableFetcher";
import getTomlFile from "./getTomlFile";

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
    fee: StellarSDK.BASE_FEE * keypairs.length,
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
      console.log(e);
      throw e;
    }
    if (!response.successful) {
      throw `Something went wrong when creating accounts on mainnet: ${json.result_xdr}`;
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
      console.log(e);
      let accountPublicKeys = accounts.map((acc) => acc.kp.publicKey());
      throw `An exception was raised when attempting to create accounts, but merging accounts also failed. Accounts: ${accountPublicKeys}`;
    }
    console.log(e);
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
    fee: StellarSDK.BASE_FEE * accounts.length,
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
  let response = await server.submitTransaction(tx);
  while (
    !response.successful &&
    response.extras.result_codes.transaction === "tx_bad_seq"
  ) {
    // Update sequence number
    // This could happen when running multiple sep10 test processes concurrently
    builder.source = await server.loadAccount(masterAccount.kp.publicKey());
    // setTimeout will raise an error if we try to set it without clearing the
    // original timeout
    builder.timeBounds = null;
    tx = builder.setTimeout(30).build();
    tx.sign(masterAccount.kp, ...accounts.map((acc) => acc.kp));
    response = await server.submitTransaction(tx);
  }
  let accountSecretKeys = accounts.map((acc) => acc.kp.secret());
  if (!response.successful) {
    throw `Unable to merge accounts back to master account, account SK's: ${accountSecretKeys}`;
  }
}
