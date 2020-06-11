import StellarSDK from "stellar-sdk";
import StellarHDWallet from "stellar-hd-wallet";
import { resubmitOnRecoverableFailure } from "./transactions";

const server = StellarSDK.Server("https://horizon.stellar.org");
const masterKeypair = StellarSDK.Keypair.from_secret(
  process.env.MAINNET_MASTER_SECRET_KEY,
);
// Generate the same keypairs used in sep10.test.js
const wallet = StellarHDWallet.fromSeed(
  new Buffer.from(masterKeypair.secret()).toString("hex"),
);
const keypairs = [...Array(10).keys()].map((x) => wallet.getKeypair(x));

async function mergeAccountToMaster(keypair) {
  const tb = new StellarSDK.TransactionBuilder(
    await server.loadAccount(masterKeypair),
    {
      fee: StellarSDK.BASE_FEE * 5,
      networkPassphrase: StellarSDK.Networks.PUBLIC,
    },
  );
  tb.addOperation(
    StellarSDK.Operation.accountMerge({
      destination: masterKeypair.publicKey(),
      source: keypair.publicKey(),
    }),
  );
  const tx = tb.setTimeout(60).build();
  tx.sign(keypair, masterKeypair);
  let response;
  try {
    response = server.submitTransaction(tx);
  } catch (e) {
    response = resubmitOnRecoverableFailure(
      e.response.data,
      masterKeypair,
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

const results = await Promise.all(
  keypairs.map(async (kp) => {
    try {
      await mergeAccountToMaster(kp);
    } catch (e) {
      console.log(e);
      return false;
    }
    return true;
  }),
);
console.log(
  "Number of accounts merged successfully: " +
    results.filter((val) => val).length,
);
