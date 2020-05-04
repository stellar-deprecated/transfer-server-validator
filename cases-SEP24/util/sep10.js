import StellarSDK from "stellar-sdk";
import { loggableFetch } from "./loggableFetcher";
import getTomlFile from "./getTomlFile";

export default async function getSep10Token(domain, keyPair, signers) {
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
