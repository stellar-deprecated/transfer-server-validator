import StellarSDK from "stellar-sdk";
import { fetch } from "./fetchShim";
import getTomlFile from "./getTomlFile";

export default async function getSep10Token(domain, keyPair, signers) {
  if (!signers) signers = [keyPair];
  const toml = await getTomlFile(domain);
  let response = await fetch(
    toml.WEB_AUTH_ENDPOINT + "?account=" + keyPair.publicKey(),
  );
  const json = await response.json();
  const network_passphrase =
    toml.NETWORK_PASSPHRASE || StellarSDK.Networks.TESTNET;
  let tx;
  expect(() => {
    tx = new StellarSDK.Transaction(json.transaction, network_passphrase);
  }, `This test needs a valid SEP10 token but can't build the returned challenge: "${json.transaction}" and error: "${json.error}"`).not.toThrow();
  signers.forEach((keyPair) => {
    tx.sign(keyPair);
  });
  let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  });
  let tokenJson = await resp.json();
  return tokenJson.token;
}
