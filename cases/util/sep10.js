import TOML from "toml";
import StellarSDK from "stellar-sdk";
import { fetch } from "./fetchShim";

export default async function getSep10Token(domain, keyPair, signers) {
  if (!signers) signers = [keyPair];
  let response = await fetch(domain + ".well-known/stellar.toml");
  const text = await response.text();
  const toml = TOML.parse(text);
  if (toml.WEB_AUTH_ENDPOINT[toml.WEB_AUTH_ENDPOINT.length - 1] !== "/") {
    toml.WEB_AUTH_ENDPOINT += "/";
  }
  response = await fetch(
    toml.WEB_AUTH_ENDPOINT + "?account=" + keyPair.publicKey()
  );
  const json = await response.json();
  const tx = new StellarSDK.Transaction(
    json.transaction,
    json.network_passphrase
  );
  signers.forEach(keyPair => {
    tx.sign(keyPair);
  });
  let resp = await fetch(toml.WEB_AUTH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ transaction: tx.toXDR() })
  });
  let tokenJson = await resp.json();
  return tokenJson.token;
}
