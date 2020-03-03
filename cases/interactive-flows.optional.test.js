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
let distributionAccount;
let asset;
let account;

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

  try {
    await server.submitTransaction(transaction);
  } catch (e) {
    console.log(e);
  }
});

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
    await new Promise(async (resolve) => {
      let timePassed = 0;
      while (!transactionJSON && timePassed < 10000) {
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        timePassed += 500;
      }
      resolve();
    });
    expect(transactionJSON).not.toEqual(undefined);

    // Poll /transaction endpoint until deposit is marked as complete
    let isComplete = false;
    await new Promise(async (resolve) => {
      let timePassed = 0;
      while (!isComplete && timePassed < 50000) {
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
        timePassed += 2000;
        let transactionResp = await fetch(
          toml.TRANSFER_SERVER + `/transaction?id=${transactionId}`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          },
        );
        let transactionRespJSON = await transactionResp.json();
        if (transactionRespJSON.transaction.status === "completed") {
          isComplete = true;
        }
      }
      resolve();
    });
    expect(isComplete).toBeTruthy();
  });
});

describe("Withdraw Flow", () => {
  let transactionId;
  let transactionJSON;
  it("can complete interactive flow", async () => {
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

  it("marks transaction as complete after submission", async () => {
    // Wait for transactionJSON to be defined
    await new Promise(async (resolve) => {
      let timePassed = 0;
      while (!transactionJSON && timePassed < 10000) {
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        timePassed += 500;
      }
      resolve();
    });
    expect(transactionJSON).not.toEqual(undefined);

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
      let submitResponse = await server.submitTransaction(transaction);
    } catch (e) {
      console.log(e);
    }
    console.log("json", await submitResponse.json());
  });

  /*it("fee charged matched /info or /fee responses", async () => {
    // Wait for _ to be defined
    await new Promise(async (resolve) => {
      let timePassed = 0;
      while (!_ && timePassed < 5000) {
        await new Promise(resolve => {setTimeout(resolve, 500)});
        timePassed += 500;
      }
      resolve();
    });
    expect(_).not.toEqual(undefined);

    let feeForTransaction;
    if (infoJSON.fee.authentication_required) {
      const paramString = `operation=withdraw&asset_code=${enabledCurrency}&amount=${transactionJSON.amount_in}`;
      const feeResponse = await fetch(toml.TRANSFER_SERVER + `/fee?${paramString}`, {
        headers: {"Authorization": `Bearer ${jwt}`}
      });
      const feeJSON = await feeResponse.json();
      feeForTransaction = feeJSON.fee;
    } else {
      const feeFixed = infoJSON.withdraw[enabledCurrency].withdraw_fee_fixed;
      const feePercent = infoJSON.withdraw[enabledCurrency].withdraw_fee_percent;
      feeForTransaction = feeFixed + (feePercent * transactionJSON.amount_in);
    }

  })*/
});
