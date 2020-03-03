/**
 * @jest-environment ./cases/environment.js
 */
import { fetch } from "./util/fetchShim";
import getSep10Token from "./util/sep10";
import StellarSDK from "stellar-sdk";
import getTomlFile from "./util/getTomlFile";
import { getTransactionBy } from "./util/transactions";
import { doInteractiveFlow } from "./util/interactive";
const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
const keyPair = StellarSDK.Keypair.random();
const horizonURL = "https://horizon-testnet.stellar.org";
const server = new StellarSDK.Server(horizonURL);

jest.setTimeout(180000);

let infoJSON;
let enabledCurrency;
let jwt;
let toml;
let currencyInfo;
let issuerAccount;
let asset;
let account;

function waitUntilTruthy(valObj, timeAllowed, interval) {
  return new Promise(async (resolve, reject) => {
    await new Promise(async (resolve) => {
      let timePassed = 0;
      while (!valObj.val && timePassed < timeAllowed) {
        await new Promise((resolve) => {
          setTimeout(resolve, interval);
        });
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
        await new Promise((resolve) => {
          setTimeout(resolve, interval);
        });
        timePassed += interval;
        let transactionResp = await fetch(
          toml.TRANSFER_SERVER + `/transaction?id=${transactionId}`,
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

  const infoResponse = await fetch(toml.TRANSFER_SERVER + "/info", {
    headers: {
      Origin: "https://www.website.com",
    },
  });
  infoJSON = await infoResponse.json();
  const currencies = Object.keys(infoJSON.withdraw);
  // Note that we're only testing the first asset found to be enabled
  enabledCurrency = currencies.find(
    (currency) => infoJSON.withdraw[currency].enabled,
  );
  jwt = await getSep10Token(url, keyPair);

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
      50000,
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
      .addMemo(StellarSDK.Memo.hash(transactionJSON.withdraw_memo))
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
    // Wait for _ to be defined
    waitUntilTruthy({ val: withdrawJSON }, 30000, 2000);

    let feeForTransaction;
    if (infoJSON.fee.authentication_required) {
      const paramString = `operation=withdraw&asset_code=${enabledCurrency}&amount=${withdrawJSON.amount_in}`;
      const feeResponse = await fetch(
        toml.TRANSFER_SERVER + `/fee?${paramString}`,
        {
          headers: { Authorization: `Bearer ${jwt}` },
        },
      );
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

    expect(feeForTransaction.toString()).toEqual(withdrawJSON.amount_fee);
    // Adjust for floating point errors. Stellar supports up to 7 decimals
    let calculatedFee =
      Math.round(
        (withdrawJSON.amount_in - withdrawJSON.amount_out) * 10000000,
      ) / 10000000;
    expect(feeForTransaction).toEqual(calculatedFee);
  });
});
