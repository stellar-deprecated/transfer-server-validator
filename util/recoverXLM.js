import StellarSDK from "stellar-sdk";
import StellarHDWallet from "stellar-hd-wallet";
import { mergeAccountToMaster } from "./sep10";

const server = StellarSDK.Server("https://horizon.stellar.org");
const masterKeypair = StellarSDK.Keypair.from_secret(
  process.env.MAINNET_MASTER_SECRET_KEY,
);
// Generate the same keypairs used in sep10.test.js
const wallet = StellarHDWallet.fromSeed(
  new Buffer.from(masterKeypair.secret()).toString("hex"),
);
const keypairs = [...Array(10).keys()].map((x) => wallet.getKeypair(x));

const results = await Promise.all(
  keypairs.map(async (kp) => {
    try {
      await mergeAccountToMaster(
        masterKeypair,
        kp,
        server,
        StellarSDK.Networks.PUBLIC,
      );
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
