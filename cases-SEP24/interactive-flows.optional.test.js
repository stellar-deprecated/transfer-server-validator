/**
 * @jest-environment ./cases-SEP24/environment.js
 */
import { fetch } from "./util/fetchShim";
import getSep10Token from "./util/sep10";
import StellarSDK from "stellar-sdk";
import getTomlFile from "./util/getTomlFile";
import { getTransactionBy } from "./util/transactions";
import { doInteractiveFlow } from "./util/interactive";
import { getTransactionSchema } from "./util/schema";
import { getActiveCurrency } from "./util/currency";
const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const keyPair = StellarSDK.Keypair.random();
const horizonURL = "https://horizon-testnet.stellar.org";
const server = new StellarSDK.Server(horizonURL);
const testCurrency = process.env.CURRENCY;

jest.setTimeout(180000);

let infoJSON;
let enabledCurrency;
let jwt;
let toml;
let currencyInfo;
let issuerAccount;
let asset;
let account;
let transferServer;

function sleep(interval) {
  return new Promise((resolve) => {
    setTimeout(resolve, interval);
  });
}

/*
 ** waitUntilTruthy() and waitUntilTransactionComplete() block the test
 ** they are called from until their condition is met. This makes the
 ** tests in this file run serially. For example, the 'Withdraw Flow's
 ** 'can complete interactive flow' is blocked until depositTransactionJSON
 ** is defined, signaling to the withdraw test that the deposit was
 ** completed.
 */
function waitUntilTruthy(valObj, timeAllowed, interval) {
  return new Promise(async (resolve, reject) => {
    await new Promise(async (resolve) => {
      let timePassed = 0;
      while (!valObj.val && timePassed < timeAllowed) {
        await sleep(interval);
        timePassed += interval;
      }
      resolve();
    });
    if (valObj.val) {
      resolve();
    } else {
      reject("Timed out while waiting for test to finish!");
    }
  });
}

function waitUntilTransactionComplete(transactionId, timeAllowed, interval) {
  return new Promise(async (resolve, reject) => {
    let transactionJSON = await new Promise(async (resolve) => {
      let respJSON;
      let timePassed = 0;
      while (timePassed < timeAllowed) {
        await sleep(interval);
        timePassed += interval;
        let transactionResp = await fetch(
          transferServer + `/transaction?id=${transactionId}`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          },
        );
        respJSON = await transactionResp.json();
        if (respJSON.transaction.status === "completed") {
          break;
        }
      }
      resolve(respJSON.transaction);
    });
    if (transactionJSON.status === "completed") {
      resolve(transactionJSON);
    } else {
      reject("Timed out while waiting for transaction to complete!");
    }
  });
}

beforeAll(async () => {
  await fetch(`https://friendbot.stellar.org?addr=${keyPair.publicKey()}`);
  try {
    toml = await getTomlFile(url);
  } catch (e) {
    throw "Invalid TOML formatting";
  }

  transferServer = toml.TRANSFER_SERVER_SEP0024 || toml.TRANSFER_SERVER;

  ({ enabledCurrency, infoJSON } = await getActiveCurrency(
    testCurrency,
    transferServer,
    false,
  ));

  ({ token: jwt } = await getSep10Token(url, keyPair));

  // Get info for interactive tests
  currencyInfo = toml.CURRENCIES.find((obj) => obj.code === enabledCurrency);
  issuerAccount = currencyInfo.issuer;
  asset = new StellarSDK.Asset(enabledCurrency, issuerAccount);
  account = await server.loadAccount(keyPair.publicKey());

  // Establish trustline
  let transaction = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: "Test SDF Network ; September 2015",
  })
    .addOperation(
      StellarSDK.Operation.changeTrust({
        asset: asset,
        source: keyPair.publicKey(),
      }),
    )
    .setTimeout(30)
    .build();
  transaction.sign(keyPair);

  await server.submitTransaction(transaction);
});

let depositTransactionJSON = null;
describe("Deposit Flow", () => {
  let transactionId;
  let transactionJSON;
  it("can complete the interactive flow", async () => {
    transactionId = await doInteractiveFlow({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      jwt: jwt,
      toml: toml,
      isDeposit: true,
    });
    let transactionRespJSON = await getTransactionBy({
      iden: "id",
      value: transactionId,
      toml: toml,
      jwt: jwt,
    });
    transactionJSON = transactionRespJSON.transaction;
  });

  it("pending transactions are completed on testnet", async () => {
    // Wait for interactive flow to complete
    await waitUntilTruthy({ val: transactionJSON }, 15000, 1000);
    // Poll /transaction endpoint until deposit is marked as complete
    depositTransactionJSON = await waitUntilTransactionComplete(
      transactionId,
      125000,
      2000,
    );
  });
});

describe("Withdraw Flow", () => {
  let transactionId;
  let transactionJSON;
  it("can complete interactive flow", async () => {
    // Wait for deposit flow to complete
    await waitUntilTruthy({ val: depositTransactionJSON }, 20000, 2000);

    transactionId = await doInteractiveFlow({
      currency: enabledCurrency,
      account: keyPair.publicKey(),
      jwt: jwt,
      toml: toml,
      isDeposit: false,
    });
    let transactionRespJSON = await getTransactionBy({
      iden: "id",
      value: transactionId,
      expectStatus: 200,
      toml: toml,
      jwt: jwt,
    });
    transactionJSON = transactionRespJSON.transaction;
  });

  let withdrawJSON;
  it("marks transaction as complete after submission", async () => {
    // Wait for transactionJSON to be defined
    await waitUntilTruthy({ val: transactionJSON }, 25000, 2000);
    let memo = Buffer.from(transactionJSON.withdraw_memo, "base64").toString(
      "hex",
    );

    // Submit transaction
    const distributionAccount = transactionJSON.withdraw_anchor_account;
    let transaction = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: "Test SDF Network ; September 2015",
    })
      .addOperation(
        StellarSDK.Operation.payment({
          destination: distributionAccount,
          asset: asset,
          amount: transactionJSON.amount_in,
        }),
      )
      .addMemo(StellarSDK.Memo.hash(memo))
      .setTimeout(30)
      .build();
    transaction.sign(keyPair);
    try {
      await server.submitTransaction(transaction);
    } catch (e) {
      throw JSON.stringify(e);
    }

    // Wait until transaction is complete
    withdrawJSON = await waitUntilTransactionComplete(
      transactionId,
      20000,
      2000,
    );
  });

  it("fee charged matched /info or /fee responses", async () => {
    // Wait for withdrawJSON to be defined
    waitUntilTruthy({ val: withdrawJSON }, 30000, 2000);

    let feeForTransaction;
    if (infoJSON.fee.authentication_required) {
      const paramString = `operation=withdraw&asset_code=${enabledCurrency}&amount=${withdrawJSON.amount_in}`;
      const feeResponse = await fetch(transferServer + `/fee?${paramString}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const feeJSON = await feeResponse.json();
      feeForTransaction = feeJSON.fee;
    } else {
      const feeFixed = infoJSON.withdraw[enabledCurrency].withdraw_fee_fixed;
      const feePercent =
        infoJSON.withdraw[enabledCurrency].withdraw_fee_percent;
      feeForTransaction = feeFixed + feePercent * withdrawJSON.amount_in;
      // Since floating point arithmetic is not accurate:
      feeForTransaction = Math.round(feeForTransaction * 10000000) / 10000000;
    }

    expect(feeForTransaction).toEqual(parseFloat(withdrawJSON.amount_fee));
    // Adjust for floating point errors. Stellar supports up to 7 decimals
    let calculatedFee =
      Math.round(
        (withdrawJSON.amount_in - withdrawJSON.amount_out) * 10000000,
      ) / 10000000;
    expect(feeForTransaction).toEqual(calculatedFee);
  });

  it("Can retreive transaction by stellar_transaction_id once completed", async () => {
    // Wait for withdrawJSON to be defined
    waitUntilTruthy({ val: withdrawJSON }, 30000, 2000);

    let urlArgs = `stellar_transaction_id=${withdrawJSON.stellar_transaction_id}`;
    let response = await fetch(transferServer + `/transaction?${urlArgs}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });
    expect(response.status).toEqual(200);
    let json = await response.json();
    expect(json).toMatchSchema(getTransactionSchema(false));
  });

  it("withdraw_memo is base64-encoded", async () => {
    // Wait for withdrawJSON to be defined
    waitUntilTruthy({ val: withdrawJSON }, 30000, 2000);

    expect(withdrawJSON.withdraw_fee_percent).not.toEqual(null);
    expect(withdrawJSON.withdraw_fee_percent).not.toEqual("");
    function decode() {
      Buffer.from(withdrawJSON.withdraw_memo, "base64");
    }
    expect(decode).not.toThrow();
  });
});
