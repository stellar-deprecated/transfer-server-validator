import StellarSDK from "stellar-sdk";
import StellarHDWallet from "stellar-hd-wallet";
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
  numAccounts,
  server,
  networkPassphrase,
) {
  const wallet = StellarHDWallet.fromSeed(
    new Buffer.from(masterAccount.kp.secret()).toString("hex"),
  );
  const keypairs = [...Array(numAccounts).keys()].map((x) =>
    wallet.getKeypair(x),
  );
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
        [masterAccount.kp],
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
        message: `An exception was raised when attempting to create accounts, but merging accounts also failed: ${e.message}`,
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
  let unsuccessfulSecrets = [];
  await Promise.all(
    accounts.map(async (accountObj) => {
      if (!accountObj.data) continue;
      try {
        await mergeAccountToMaster(
          masterAccount.kp,
          accountObj.kp,
          server,
          networkPassphrase,
        );
      } catch (e) {
        unsuccessfulSecrets.push(accountObj.kp.secret());
        console.log(e.error);
      }
    }),
  );
  if (unsuccessfulSecrets) console.log(unsuccessfulSecrets);
}

export async function mergeAccountToMaster(
  masterKeypair,
  keypair,
  server,
  networkPassphrase,
) {
  const tb = new StellarSDK.TransactionBuilder(
    await server.loadAccount(keypair),
    {
      fee: StellarSDK.BASE_FEE * 5,
      networkPassphrase: networkPassphrase,
    },
  );
  tb.addOperation(
    StellarSDK.Operation.accountMerge({
      destination: masterKeypair.publicKey(),
      source: keypair.publicKey(),
    }),
  );
  const tx = tb.setTimeout(60).build();
  tx.sign(keypair);
  let response;
  try {
    response = await server.submitTransaction(tx);
  } catch (e) {
    response = await resubmitOnRecoverableFailure(
      e.response.data,
      keypair,
      [keypair],
      tb,
      server,
    );
  }
  if (!response.successful) {
    throw {
      error: `Unabled to merge account ${keypair.secret()}`,
      data: response,
    };
  }
}
