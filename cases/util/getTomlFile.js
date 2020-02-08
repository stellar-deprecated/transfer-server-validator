import { fetch } from "./fetchShim";
import TOML from "toml";

export default async function(domain) {
  let response = await fetch(domain + ".well-known/stellar.toml");
  const text = await response.text();
  const toml = TOML.parse(text);
  if (toml.WEB_AUTH_ENDPOINT[toml.WEB_AUTH_ENDPOINT.length - 1] !== "/") {
      toml.WEB_AUTH_ENDPOINT += "/";
    }    
  if (toml.TRANSFER_SERVER[toml.TRANSFER_SERVER.length - 1] !== "/") {
      toml.TRANSFER_SERVER += "/";
    }
  expect(toml).toBeDefined();
  return toml;
}
